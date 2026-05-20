'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SlideOverProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** 'sm' = 384px  'md' = 512px (default)  'lg' = 640px  'xl' = 768px */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Override z-index if nested inside another overlay */
  zIndex?: string
}

const sizeClass: Record<NonNullable<SlideOverProps['size']>, string> = {
  sm: 'w-96',
  md: 'w-[512px]',
  lg: 'w-[640px]',
  xl: 'w-[768px]',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = 'md',
  zIndex = 'z-50',
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className={cn('fixed inset-0 flex', zIndex)}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — slides in from right */}
      <div
        ref={panelRef}
        className={cn(
          'absolute right-0 top-0 h-full bg-background shadow-2xl flex flex-col',
          'border-l border-border',
          'animate-in slide-in-from-right duration-200',
          sizeClass[size]
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0 pr-4">
            <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body — scrollable ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {children}
        </div>

        {/* ── Footer — sticky at bottom ────────────────────────────────────── */}
        {footer && (
          <div className="shrink-0 border-t border-border px-6 py-4 bg-muted/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Convenience footer ───────────────────────────────────────────────────────

export interface SlideOverFooterProps {
  onCancel: () => void
  onSave: () => void
  saveLabel?: string
  cancelLabel?: string
  saving?: boolean
  disabled?: boolean
  destructive?: boolean
  extra?: React.ReactNode
}

export function SlideOverFooter({
  onCancel,
  onSave,
  saveLabel = 'Save',
  cancelLabel = 'Cancel',
  saving = false,
  disabled = false,
  destructive = false,
  extra,
}: SlideOverFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {extra}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={disabled || saving}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2',
            destructive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-[#6B7EFF] hover:bg-[#5a6ee0] text-white'
          )}
        >
          {saving && (
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          )}
          {saveLabel}
        </button>
      </div>
    </div>
  )
}

export default SlideOver
