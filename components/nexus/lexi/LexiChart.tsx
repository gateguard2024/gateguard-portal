'use client'
/**
 * LexiChart — draws a report chart from Lexi's run_report tool (bar or line).
 * Thin marks, 4px rounded bar ends on the baseline, 2px lines, recessive grid,
 * hover tooltip, legend when there are 2+ series, a table view and CSV download.
 * Colors: validated reference palette (slot 1 blue, slot 2 orange).
 */
import { useEffect, useMemo, useRef, useState } from 'react'

export type LexiChartData = { kind: 'bar' | 'line'; title: string; unit: 'money' | 'count'; labels: string[]; series: { name: string; values: number[] }[]; note?: string }

const COLORS = ['#2a78d6', '#eb6834']
const INK = '#1D1D1F', INK2 = '#3A3A3C', INK3 = '#6E6E73', GRID = 'rgba(0,0,0,0.08)'
const H = 240, PAD = { l: 52, r: 12, t: 20, b: 40 }

function fmt(v: number, unit: 'money' | 'count', short = false) {
  if (unit === 'count') return v.toLocaleString()
  if (short && Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1)}M`
  if (short && Math.abs(v) >= 1e3) return `$${Math.round(v / 1e3)}k`
  return `$${Math.round(v).toLocaleString()}`
}
function niceMax(v: number) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

export function LexiChart({ chart }: { chart: LexiChartData }) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  // Draw at the real width (no scaling), so labels stay readable on a phone.
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = boxRef.current; if (!el) return
    const set = () => setW(Math.max(260, Math.round(el.clientWidth)))
    set()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(set) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [table])
  const n = chart.labels.length
  const max = useMemo(() => niceMax(Math.max(0, ...chart.series.flatMap(s => s.values))), [chart])
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
  const x0 = (i: number) => PAD.l + (iw / n) * i
  const y = (v: number) => PAD.t + ih - (v / max) * ih
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => f * max)
  const multi = chart.series.length > 1
  const empty = n === 0 || chart.series.every(s => s.values.every(v => !v))

  function csv() {
    const rows = [['', ...chart.series.map(s => s.name)], ...chart.labels.map((l, i) => [l, ...chart.series.map(s => String(s.values[i] ?? 0))])]
    const text = rows.map(r => r.map(c => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = `${chart.title.replace(/[^\w]+/g, '-').toLowerCase()}.csv`; a.click()
  }

  // Bars: groups per label, 2px gap between adjacent bars, rounded top only.
  const groupW = iw / Math.max(1, n), barGap = 2
  const bw = Math.max(4, Math.min(48, (groupW * 0.7 - barGap * (chart.series.length - 1)) / chart.series.length))
  const barPath = (x: number, top: number, w: number, base: number) => {
    const h = base - top; if (h <= 0) return ''
    const r = Math.min(4, w / 2, h)
    return `M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${base}Z`
  }
  const labelEvery = Math.ceil(n / Math.max(3, Math.floor(iw / 64)))

  return <figure style={{ margin: '10px 0 0', maxWidth: 760, background: '#FAFAFB', border: `1px solid ${GRID}`, borderRadius: 12, padding: '12px 12px 8px' }}>
    <figcaption style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: INK }}>{chart.title}{chart.note ? <span style={{ fontWeight: 400, color: INK3 }}> · {chart.note}</span> : null}</span>
      <span style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
        <button type="button" onClick={() => setTable(t => !t)} style={{ border: 0, background: 'none', color: '#0071E3', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>{table ? 'Show chart' : 'Show table'}</button>
        <button type="button" onClick={csv} style={{ border: 0, background: 'none', color: '#0071E3', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}>Download CSV</button>
      </span>
    </figcaption>
    {multi && <div style={{ display: 'flex', gap: 14, fontSize: 12.5, color: INK2, marginBottom: 4 }}>{chart.series.map((s, i) => <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: chart.kind === 'line' ? 2 : 10, borderRadius: 2, background: COLORS[i % COLORS.length] }} />{s.name}</span>)}</div>}
    {empty ? <div style={{ padding: '24px 0', textAlign: 'center', color: INK3, fontSize: 13.5 }}>No data for this report yet.</div>
      : table ? <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead><tr><th style={{ textAlign: 'left', color: INK3, fontWeight: 500, padding: '6px 8px', borderBottom: `1px solid ${GRID}` }} />{chart.series.map(s => <th key={s.name} style={{ textAlign: 'right', color: INK3, fontWeight: 500, padding: '6px 8px', borderBottom: `1px solid ${GRID}` }}>{s.name}</th>)}</tr></thead>
        <tbody>{chart.labels.map((l, i) => <tr key={l + i}><td style={{ padding: '6px 8px', borderBottom: `1px solid ${GRID}`, color: INK }}>{l}</td>{chart.series.map(s => <td key={s.name} style={{ padding: '6px 8px', borderBottom: `1px solid ${GRID}`, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: INK }}>{fmt(s.values[i] ?? 0, chart.unit)}</td>)}</tr>)}</tbody>
      </table></div>
      : <div ref={boxRef} style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${chart.title}: ${chart.labels.map((l, i) => `${l} ${chart.series.map(s => fmt(s.values[i] ?? 0, chart.unit)).join(' / ')}`).join(', ')}`} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setHover(null)}>
          {ticks.map(t => <g key={t}><line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} /><text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill={INK3}>{fmt(t, chart.unit, true)}</text></g>)}
          {chart.labels.map((l, i) => i % labelEvery === 0 && <text key={l + i} x={x0(i) + groupW / 2} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill={INK3}>{l.length > 12 ? `${l.slice(0, 11)}…` : l}</text>)}
          {chart.kind === 'bar'
            ? chart.labels.map((_, i) => {
              const gx = x0(i) + (groupW - (bw * chart.series.length + barGap * (chart.series.length - 1))) / 2
              return <g key={i}>
                {chart.series.map((s, si) => <path key={s.name} d={barPath(gx + si * (bw + barGap), y(s.values[i] ?? 0), bw, y(0))} fill={COLORS[si % COLORS.length]} opacity={hover === null || hover === i ? 1 : 0.45} />)}
                {!multi && n <= Math.floor(iw / 44) && (s => <text x={gx + bw / 2} y={y(s) - 6} textAnchor="middle" fontSize={11} fill={INK2}>{fmt(s, chart.unit, true)}</text>)(chart.series[0].values[i] ?? 0)}
              </g>
            })
            : chart.series.map((s, si) => <g key={s.name}>
              <polyline fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={s.values.map((v, i) => `${x0(i) + groupW / 2},${y(v)}`).join(' ')} />
              {hover !== null && <circle cx={x0(hover) + groupW / 2} cy={y(s.values[hover] ?? 0)} r={4} fill={COLORS[si % COLORS.length]} stroke="#FAFAFB" strokeWidth={2} />}
            </g>)}
          {chart.kind === 'line' && hover !== null && <line x1={x0(hover) + groupW / 2} x2={x0(hover) + groupW / 2} y1={PAD.t} y2={y(0)} stroke={INK3} strokeWidth={1} strokeDasharray="3 3" />}
          {/* Hit targets: full-height column per label, bigger than the mark. */}
          {chart.labels.map((_, i) => <rect key={i} x={x0(i)} y={PAD.t} width={groupW} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} />)}
        </svg>
        {hover !== null && <div role="status" style={{ position: 'absolute', top: 0, left: `${Math.min(78, Math.max(4, ((x0(hover) + groupW / 2) / W) * 100 - 10))}%`, background: '#fff', border: `1px solid ${GRID}`, borderRadius: 10, padding: '6px 10px', boxShadow: '0 4px 14px rgba(10,20,40,.12)', fontSize: 12.5, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div style={{ fontWeight: 600, color: INK }}>{chart.labels[hover]}</div>
          {chart.series.map((s, si) => <div key={s.name} style={{ color: INK2, display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[si % COLORS.length] }} />{multi ? `${s.name}: ` : ''}{fmt(s.values[hover] ?? 0, chart.unit)}</div>)}
        </div>}
      </div>}
  </figure>
}
