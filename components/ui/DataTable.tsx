'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { SkeletonRow } from '@/components/ui/SkeletonRow'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Column<T = Record<string, unknown>> {
  key: string
  label: string
  width?: string        // e.g. "w-40", "w-[120px]", "min-w-0 flex-1"
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  render?: (value: unknown, row: T) => React.ReactNode
}

export interface DataTableProps<T = Record<string, unknown>> {
  columns: Column<T>[]
  data: T[]
  rowKey: keyof T | ((row: T) => string)
  loading?: boolean
  skeletonRows?: number
  onRowClick?: (row: T) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectChange?: (ids: Set<string>) => void
  actions?: (row: T) => React.ReactNode
  emptyState?: React.ReactNode
  className?: string
  stickyHeader?: boolean
  compact?: boolean
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getRowId<T>(row: T, rowKey: DataTableProps<T>['rowKey']): string {
  if (typeof rowKey === 'function') return rowKey(row)
  return String((row as Record<string, unknown>)[rowKey as string] ?? '')
}

function getCellValue<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T = Record<string, unknown>>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 5,
  onRowClick,
  selectable = false,
  selectedIds,
  onSelectChange,
  actions,
  emptyState,
  className,
  stickyHeader = false,
  compact = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey]       = useState<string | null>(null)
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }, [sortKey])

  const sortedData = sortKey
    ? [...data].sort((a, b) => {
        const av = getCellValue(a, sortKey)
        const bv = getCellValue(b, sortKey)
        const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    : data

  // ── Select all ────────────────────────────────────────────────────────────
  const allIds      = data.map(r => getRowId(r, rowKey))
  const allSelected = selectable && selectedIds && allIds.length > 0 && allIds.every(id => selectedIds.has(id))
  const someSelected = selectable && selectedIds && allIds.some(id => selectedIds.has(id)) && !allSelected

  const toggleAll = () => {
    if (!onSelectChange || !selectedIds) return
    if (allSelected) {
      const next = new Set(selectedIds)
      allIds.forEach(id => next.delete(id))
      onSelectChange(next)
    } else {
      const next = new Set(selectedIds)
      allIds.forEach(id => next.add(id))
      onSelectChange(next)
    }
  }

  const toggleRow = (id: string) => {
    if (!onSelectChange || !selectedIds) return
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id); else next.add(id)
    onSelectChange(next)
  }

  const cellPad = compact ? 'px-3 py-2' : 'px-4 py-3'

  return (
    <div className={cn('w-full overflow-x-auto rounded-xl border border-border bg-card', className)}>
      <table className="w-full text-sm border-collapse">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <thead className={cn(stickyHeader && 'sticky top-0 z-10')}>
          <tr className="border-b border-border bg-muted/40">
            {selectable && (
              <th className={cn('w-10 text-center', cellPad)}>
                <button
                  onClick={toggleAll}
                  className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                    allSelected
                      ? 'bg-[#6B7EFF] border-[#6B7EFF]'
                      : someSelected
                        ? 'bg-[#6B7EFF]/30 border-[#6B7EFF]'
                        : 'border-border hover:border-[#6B7EFF]'
                  )}
                >
                  {(allSelected || someSelected) && <Check size={10} className="text-white" />}
                </button>
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  cellPad,
                  'text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap',
                  col.align === 'center' && 'text-center',
                  col.align === 'right'  && 'text-right',
                  col.width,
                  col.sortable && 'cursor-pointer select-none hover:text-foreground transition-colors'
                )}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    sortDir === 'asc'
                      ? <ChevronUp size={12} className="text-[#6B7EFF]" />
                      : <ChevronDown size={12} className="text-[#6B7EFF]" />
                  )}
                </span>
              </th>
            ))}
            {actions && <th className={cn('w-16 text-right', cellPad)} />}
          </tr>
        </thead>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} className="p-4">
                <SkeletonRow rows={skeletonRows} cols={columns.length} />
              </td>
            </tr>
          ) : sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)}>
                {emptyState ?? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <p className="text-sm">No data</p>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            sortedData.map((row, idx) => {
              const id = getRowId(row, rowKey)
              const isSelected = selectedIds?.has(id) ?? false
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'border-b border-border/50 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-accent/50',
                    isSelected && 'bg-[#6B7EFF]/5',
                    idx % 2 === 1 && !isSelected && 'bg-muted/20'
                  )}
                >
                  {selectable && (
                    <td className={cn('w-10 text-center', cellPad)} onClick={e => { e.stopPropagation(); toggleRow(id) }}>
                      <div className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-colors mx-auto',
                        isSelected ? 'bg-[#6B7EFF] border-[#6B7EFF]' : 'border-border hover:border-[#6B7EFF]'
                      )}>
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                    </td>
                  )}
                  {columns.map(col => {
                    const raw = getCellValue(row, col.key)
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          cellPad,
                          'text-foreground align-middle',
                          col.align === 'center' && 'text-center',
                          col.align === 'right'  && 'text-right',
                          col.width
                        )}
                      >
                        {col.render ? col.render(raw, row) : (
                          <span className="text-sm text-foreground">
                            {raw == null ? '—' : String(raw)}
                          </span>
                        )}
                      </td>
                    )
                  })}
                  {actions && (
                    <td className={cn('text-right', cellPad)} onClick={e => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  )}
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

export default DataTable
