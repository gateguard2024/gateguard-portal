'use client'
import { useState } from 'react'
import type { TrackerItem, TrackerGroup } from './BoardView'

type ChartType = 'donut' | 'bar' | 'progress' | 'velocity'

const STATUS_OPTIONS = [
  { key: 'new',         label: 'Not Started', color: '#94A3B8' },
  { key: 'in_progress', label: 'In Progress',  color: '#6B7EFF' },
  { key: 'in_review',   label: 'In Review',    color: '#06B6D4' },
  { key: 'on_hold',     label: 'On Hold',      color: '#F59E0B' },
  { key: 'done',        label: 'Done',          color: '#10B981' },
  { key: 'blocked',     label: 'Blocked',       color: '#EF4444' },
]

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function DonutChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 12, padding: 20 }}>No items</div>

  let cumAngle = -90
  const R = 80; const cx = 120; const cy = 120
  const arcs = data.map(d => {
    const angle = (d.value / total) * 360
    const startAngle = cumAngle
    cumAngle += angle
    const start = polarToCartesian(cx, cy, R, startAngle)
    const end   = polarToCartesian(cx, cy, R, cumAngle - 0.1)
    const largeArc = angle > 180 ? 1 : 0
    const path = `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} L ${cx} ${cy} Z`
    return { ...d, path, angle }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
      <svg width={240} height={240} viewBox="0 0 240 240">
        {arcs.filter(a => a.angle > 0).map((a, i) => (
          <path key={i} d={a.path} fill={a.color} opacity={0.87} />
        ))}
        <circle cx={cx} cy={cy} r={52} fill="white" />
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle" fontSize={26} fontWeight="700" fill="#1E293B">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#94A3B8">total items</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {arcs.map((a, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: a.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151' }}>{a.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', marginLeft: 'auto', minWidth: 28, textAlign: 'right' }}>{a.value}</span>
            <span style={{ fontSize: 11, color: '#94A3B8', minWidth: 36 }}>{total > 0 ? Math.round((a.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function BarByGroup({ groups, items }: { groups: TrackerGroup[]; items: TrackerItem[] }) {
  const max = Math.max(...groups.map(g => items.filter(i => i.group_id === g.id && !i.parent_item_id).length), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {groups.map(g => {
        const count = items.filter(i => i.group_id === g.id && !i.parent_item_id).length
        const pct = (count / max) * 100
        return (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#374151', minWidth: 120, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name}</span>
            <div style={{ flex: 1, height: 20, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: g.color, borderRadius: 4, transition: 'width 0.6s ease', minWidth: count > 0 ? 4 : 0 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', minWidth: 24, textAlign: 'right' }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function ProgressByGroup({ groups, items }: { groups: TrackerGroup[]; items: TrackerItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {groups.map(g => {
        const groupItems = items.filter(i => i.group_id === g.id && !i.parent_item_id)
        const done = groupItems.filter(i => i.status === 'done').length
        const pct = groupItems.length > 0 ? Math.round((done / groupItems.length) * 100) : 0
        return (
          <div key={g.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{g.name}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? '#10B981' : '#6B7EFF' }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: '#F1F5F9', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: pct >= 100 ? '#10B981' : '#6B7EFF',
                borderRadius: 5, transition: 'width 0.6s ease',
              }} />
            </div>
            <span style={{ fontSize: 10, color: '#94A3B8', marginTop: 2, display: 'block' }}>{done} / {groupItems.length} done</span>
          </div>
        )
      })}
    </div>
  )
}

function VelocityChart({ items }: { items: TrackerItem[] }) {
  const today = new Date()
  const weeks: { label: string; count: number }[] = []
  for (let w = 7; w >= 0; w--) {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - w * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)
    const count = items.filter(i => {
      if (i.status !== 'done' || !i.updated_at) return false
      const d = new Date(i.updated_at)
      return d >= weekStart && d < weekEnd
    }).length
    const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    weeks.push({ label, count })
  }

  const maxVal = Math.max(...weeks.map(w => w.count), 1)
  const H = 120; const W = 480; const padX = 40; const padY = 20
  const plotW = W - padX * 2; const plotH = H - padY * 2
  const pts = weeks.map((w, i) => ({
    x: padX + (i / (weeks.length - 1)) * plotW,
    y: padY + plotH - (w.count / maxVal) * plotH,
    ...w,
  }))
  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Items Completed Per Week (last 8 weeks)</p>
      <svg width={W} height={H + 24} style={{ overflow: 'visible' }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
          <line key={i} x1={padX} y1={padY + plotH * (1 - f)} x2={padX + plotW} y2={padY + plotH * (1 - f)}
            stroke="#F1F5F9" strokeWidth={1} />
        ))}
        {/* Line */}
        <polyline points={polyline} fill="none" stroke="#6B7EFF" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* Area fill */}
        <polygon
          points={`${pts[0].x},${padY + plotH} ${polyline} ${pts[pts.length - 1].x},${padY + plotH}`}
          fill="#6B7EFF" opacity={0.08}
        />
        {/* Dots + labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={4} fill="#6B7EFF" />
            {p.count > 0 && (
              <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize={10} fill="#374151" fontWeight="700">{p.count}</text>
            )}
            <text x={p.x} y={padY + plotH + 16} textAnchor="middle" fontSize={9} fill="#94A3B8">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

interface ChartViewProps {
  items: TrackerItem[]
  groups: TrackerGroup[]
}

export function ChartView({ items, groups }: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>('donut')

  const donutData = STATUS_OPTIONS.map(s => ({
    label: s.label,
    value: items.filter(i => i.status === s.key && !i.parent_item_id).length,
    color: s.color,
  })).filter(d => d.value > 0)

  const charts: { key: ChartType; label: string }[] = [
    { key: 'donut',    label: 'Status Donut' },
    { key: 'bar',      label: 'By Group' },
    { key: 'progress', label: 'Progress' },
    { key: 'velocity', label: 'Velocity' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Chart type selector */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {charts.map(c => (
          <button
            key={c.key}
            onClick={() => setChartType(c.key)}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${chartType === c.key ? '#6B7EFF' : '#E2E8F0'}`,
              background: chartType === c.key ? '#6B7EFF' : '#fff',
              color: chartType === c.key ? '#fff' : '#64748B',
            }}
          >{c.label}</button>
        ))}
      </div>

      {/* Chart area */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
        {chartType === 'donut'    && <DonutChart data={donutData} />}
        {chartType === 'bar'      && <BarByGroup groups={groups} items={items} />}
        {chartType === 'progress' && <ProgressByGroup groups={groups} items={items} />}
        {chartType === 'velocity' && <VelocityChart items={items} />}
      </div>
    </div>
  )
}
