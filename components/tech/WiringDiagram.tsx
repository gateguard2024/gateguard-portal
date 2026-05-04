'use client'

/**
 * WiringDiagram — SVG terminal-to-terminal wiring diagram
 * Renders a split-panel diagram: Device A on the left, Device B on the right,
 * with color-coded wire curves between connected terminals.
 */

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  type WiringMap, type DeviceDef, type DeviceTerminal,
  getDevice, getMap, getCompatiblePartners, matchDeviceToProduct,
  WIRING_MAPS, TERMINAL_COLORS,
} from '@/lib/wiring-library'

function browserDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

const MONO = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'
const SANS = '"IBM Plex Sans", -apple-system, system-ui, sans-serif'

// ─── Layout constants (SVG coordinate space) ──────────────────────────────────
const SVG_W        = 520
const DEV_W        = 172   // each device panel width
const WIRE_W       = SVG_W - DEV_W * 2  // 176px wire area
const LEFT_X       = 0
const RIGHT_X      = DEV_W + WIRE_W     // 348
const HEADER_H     = 46
const ROW_H        = 30
const ROW_PAD_TOP  = 8
const DOT_R        = 5
const LEFT_DOT_X   = DEV_W             // right edge of left panel
const RIGHT_DOT_X  = RIGHT_X           // left edge of right panel

// ─── Helpers ──────────────────────────────────────────────────────────────────

function terminalY(index: number): number {
  return HEADER_H + ROW_PAD_TOP + index * ROW_H + ROW_H / 2
}

function svgHeight(maxTerminals: number): number {
  return HEADER_H + ROW_PAD_TOP + maxTerminals * ROW_H + 14
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface DevicePanelProps {
  device: DeviceDef
  visibleTerminals: DeviceTerminal[]   // subset that appears in the wiring map
  side: 'left' | 'right'
  connectedIds: Set<string>            // terminal IDs that have a wire
  highlightId: string | null
}

function DevicePanel({ device, visibleTerminals, side, connectedIds, highlightId }: DevicePanelProps) {
  const isLeft = side === 'left'
  const panelX = isLeft ? LEFT_X : RIGHT_X

  const headerColor = device.category === 'Access Controller' ? '#6B7EFF'
    : device.category === 'Gate Operator' ? '#059669'
    : device.category === 'Access Reader' ? '#D97706'
    : '#475569'

  return (
    <g>
      {/* Panel background */}
      <rect
        x={panelX} y={0}
        width={DEV_W} height={svgHeight(visibleTerminals.length)}
        rx={8} ry={8}
        fill="#FFFFFF" stroke="#E2E8F0" strokeWidth={1}
      />
      {/* Header band */}
      <rect
        x={panelX} y={0}
        width={DEV_W} height={HEADER_H}
        rx={8} ry={8} fill={headerColor}
      />
      <rect x={panelX} y={HEADER_H - 8} width={DEV_W} height={8} fill={headerColor} />

      {/* Brand */}
      <text
        x={panelX + (isLeft ? 10 : DEV_W - 10)}
        y={18}
        textAnchor={isLeft ? 'start' : 'end'}
        fontFamily={MONO} fontSize={8} fill="rgba(255,255,255,0.7)"
        letterSpacing="0.08em"
      >
        {device.brand.toUpperCase()}
      </text>

      {/* Model name — wrap long names */}
      <text
        x={panelX + (isLeft ? 10 : DEV_W - 10)}
        y={34}
        textAnchor={isLeft ? 'start' : 'end'}
        fontFamily={MONO} fontSize={9} fontWeight="bold" fill="#FFFFFF"
        letterSpacing="0.05em"
      >
        {device.name.length > 22 ? device.name.slice(0, 21) + '…' : device.name}
      </text>

      {/* Terminals */}
      {visibleTerminals.map((t, i) => {
        const y     = terminalY(i)
        const dotX  = isLeft ? LEFT_DOT_X : RIGHT_DOT_X
        const isConn = connectedIds.has(t.id)
        const isHl   = highlightId === t.id
        const tColor = TERMINAL_COLORS[t.type] ?? '#94A3B8'

        // Group separator label
        const prevGroup = i > 0 ? visibleTerminals[i - 1].group : null
        const showGroup = t.group && t.group !== prevGroup

        // Extract connector ID badge: "Lock Relay 1 (J2)" → "J2"
        const connBadge = (group: string) => {
          const m = group.match(/\(([^)]+)\)/)
          if (m) return m[1]
          return group.split(' ').slice(-1)[0] ?? group
        }

        return (
          <g key={t.id}>
            {/* Group separator — connector block id + name */}
            {showGroup && i > 0 && (() => {
              const badge      = connBadge(t.group!)
              const lineY      = y - ROW_H / 2 + 2
              const badgeW     = Math.min(badge.length * 5.5 + 10, 52)
              const badgeX     = isLeft ? panelX + 4 : panelX + DEV_W - badgeW - 4
              const groupShort = (t.group ?? '').replace(/\s*\([^)]*\)/, '').trim()
              const groupLabel = groupShort.length > 16 ? groupShort.slice(0, 15) + '…' : groupShort
              const textX      = isLeft ? badgeX + badgeW + 4 : badgeX - 4
              return (
                <g>
                  <line
                    x1={panelX + 4} y1={lineY}
                    x2={panelX + DEV_W - 4} y2={lineY}
                    stroke="#E2E8F0" strokeWidth={0.5} strokeDasharray="2 2"
                  />
                  <rect x={badgeX} y={lineY - 5} width={badgeW} height={10} rx={3}
                    fill={isConn ? '#6B7EFF' : '#E2E8F0'} opacity={0.9}
                  />
                  <text x={badgeX + badgeW / 2} y={lineY + 3.5} textAnchor="middle"
                    fontFamily={MONO} fontSize={6.5} fontWeight="bold"
                    fill={isConn ? '#FFFFFF' : '#64748B'} letterSpacing="0.06em"
                  >
                    {badge}
                  </text>
                  {groupLabel && (
                    <text x={textX} y={lineY + 3.5}
                      textAnchor={isLeft ? 'start' : 'end'}
                      fontFamily={MONO} fontSize={6} fill="#94A3B8" letterSpacing="0.04em"
                    >
                      {groupLabel}
                    </text>
                  )}
                </g>
              )
            })()}

            {/* Row background on hover target */}
            <rect
              x={panelX} y={y - ROW_H / 2 + 2}
              width={DEV_W} height={ROW_H - 2}
              fill={isHl ? 'rgba(107,126,255,0.06)' : 'transparent'}
            />

            {/* Terminal dot */}
            <circle
              cx={dotX} cy={y} r={DOT_R}
              fill={isConn ? tColor : '#CBD5E1'}
              stroke={isConn ? tColor : '#E2E8F0'}
              strokeWidth={isConn ? 0 : 1}
              opacity={isConn ? 1 : 0.55}
            />

            {/* Terminal label */}
            <text
              x={isLeft ? dotX - DOT_R - 6 : dotX + DOT_R + 6}
              y={y + 4}
              textAnchor={isLeft ? 'end' : 'start'}
              fontFamily={MONO} fontSize={9} fontWeight="bold"
              fill={isConn ? '#0F172A' : '#94A3B8'}
            >
              {t.label}
            </text>

            {/* Terminal description */}
            <text
              x={isLeft ? dotX - DOT_R - 6 : dotX + DOT_R + 6}
              y={y + 16}
              textAnchor={isLeft ? 'end' : 'start'}
              fontFamily={SANS} fontSize={7}
              fill={isConn ? '#64748B' : '#CBD5E1'}
            >
              {t.desc.length > 28 ? t.desc.slice(0, 27) + '…' : t.desc}
            </text>
          </g>
        )
      })}
    </g>
  )
}

// ─── Wire path between two terminals ─────────────────────────────────────────

interface WireProps {
  y1: number
  y2: number
  color: string
  label?: string
  dimmed?: boolean
}

function WirePath({ y1, y2, color, label, dimmed }: WireProps) {
  const x1  = LEFT_DOT_X
  const x2  = RIGHT_DOT_X
  const cx1 = x1 + WIRE_W * 0.35
  const cx2 = x2 - WIRE_W * 0.35
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2

  const d = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`

  return (
    <g opacity={dimmed ? 0.2 : 1}>
      {/* Shadow for depth */}
      <path d={d} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={4} strokeLinecap="round" />
      {/* Wire */}
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      {/* Label pill */}
      {label && (
        <>
          <rect
            x={midX - 16} y={midY - 8}
            width={32} height={14}
            rx={3} fill={color} opacity={0.15}
          />
          <text
            x={midX} y={midY + 3.5}
            textAnchor="middle"
            fontFamily={MONO} fontSize={7} fontWeight="bold" fill={color}
          >
            {label}
          </text>
        </>
      )}
    </g>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface WiringDiagramProps {
  map: WiringMap
}

export function WiringDiagram({ map }: WiringDiagramProps) {
  const [hoveredWire, setHoveredWire] = useState<string | null>(null)
  const [activeNote, setActiveNote]   = useState<number | null>(null)

  const deviceA = getDevice(map.deviceAId)
  const deviceB = getDevice(map.deviceBId)

  // Collect terminal IDs that appear in wire runs
  const connectedA = useMemo(() => new Set(map.wires.map(w => w.from)), [map])
  const connectedB = useMemo(() => new Set(map.wires.map(w => w.to)), [map])

  // Build ordered visible terminal lists (connected first, then others relevant to their groups)
  const visibleA = useMemo(() => {
    if (!deviceA) return []
    const connectedGroups = new Set(
      map.wires.map(w => deviceA.terminals.find(t => t.id === w.from)?.group).filter(Boolean)
    )
    return deviceA.terminals.filter(t =>
      connectedA.has(t.id) || (t.group && connectedGroups.has(t.group))
    )
  }, [deviceA, map, connectedA])

  const visibleB = useMemo(() => {
    if (!deviceB) return []
    const connectedGroups = new Set(
      map.wires.map(w => deviceB.terminals.find(t => t.id === w.to)?.group).filter(Boolean)
    )
    return deviceB.terminals.filter(t =>
      connectedB.has(t.id) || (t.group && connectedGroups.has(t.group))
    )
  }, [deviceB, map, connectedB])

  // Build index of terminal ID → row index for positioning
  const indexA = useMemo(() => {
    const m: Record<string, number> = {}
    visibleA.forEach((t, i) => { m[t.id] = i })
    return m
  }, [visibleA])

  const indexB = useMemo(() => {
    const m: Record<string, number> = {}
    visibleB.forEach((t, i) => { m[t.id] = i })
    return m
  }, [visibleB])

  if (!deviceA || !deviceB) return null

  const maxRows = Math.max(visibleA.length, visibleB.length)
  const height  = svgHeight(maxRows)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Diagram title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.2)',
          borderRadius: 6, padding: '4px 10px',
          fontFamily: MONO, fontSize: 9, color: '#6B7EFF', letterSpacing: '0.1em',
        }}>
          WIRING DIAGRAM
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748B', flex: 1 }}>
          {map.title}
        </div>
      </div>

      {/* SVG diagram */}
      <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '12px 8px', border: '1px solid #E2E8F0', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${SVG_W} ${height}`}
          width="100%"
          style={{ display: 'block', minWidth: 320 }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Wire area background */}
          <rect
            x={DEV_W} y={0}
            width={WIRE_W} height={height}
            fill="#F1F5F9"
          />

          {/* Device panels */}
          <DevicePanel
            device={deviceA}
            visibleTerminals={visibleA}
            side="left"
            connectedIds={connectedA}
            highlightId={hoveredWire
              ? (map.wires.find(w => w.wireColor + w.label === hoveredWire)?.from ?? null)
              : null}
          />
          <DevicePanel
            device={deviceB}
            visibleTerminals={visibleB}
            side="right"
            connectedIds={connectedB}
            highlightId={hoveredWire
              ? (map.wires.find(w => w.wireColor + w.label === hoveredWire)?.to ?? null)
              : null}
          />

          {/* Wires */}
          {map.wires.map((wire, i) => {
            const rowA = indexA[wire.from]
            const rowB = indexB[wire.to]
            if (rowA === undefined || rowB === undefined) return null
            const y1 = terminalY(rowA)
            const y2 = terminalY(rowB)
            const key = wire.wireColor + wire.label
            return (
              <g key={i}
                onMouseEnter={() => setHoveredWire(key)}
                onMouseLeave={() => setHoveredWire(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Wider invisible hit area */}
                <path
                  d={`M ${LEFT_DOT_X} ${y1} C ${LEFT_DOT_X + WIRE_W * 0.35} ${y1}, ${RIGHT_DOT_X - WIRE_W * 0.35} ${y2}, ${RIGHT_DOT_X} ${y2}`}
                  fill="none" stroke="transparent" strokeWidth={16}
                />
                <WirePath
                  y1={y1} y2={y2}
                  color={wire.wireColor}
                  label={wire.label}
                  dimmed={hoveredWire !== null && hoveredWire !== key}
                />
              </g>
            )
          })}

          {/* "WIRE AREA" label */}
          <text
            x={DEV_W + WIRE_W / 2} y={height - 6}
            textAnchor="middle"
            fontFamily={MONO} fontSize={7} fill="#CBD5E1" letterSpacing="0.12em"
          >
            WIRE AREA
          </text>
        </svg>
      </div>

      {/* Wire legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {map.wires.map((w, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#F8FAFC', border: '1px solid #E2E8F0',
            borderRadius: 6, padding: '5px 10px',
          }}>
            <div style={{ width: 20, height: 3, background: w.wireColor, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontFamily: MONO, fontSize: 9, color: '#64748B' }}>
              {w.label}
            </span>
            {w.gauge && (
              <span style={{ fontFamily: MONO, fontSize: 8, color: '#94A3B8' }}>
                · {w.gauge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Settings strip */}
      {map.settings && map.settings.length > 0 && (
        <div style={{ background: 'rgba(107,126,255,0.05)', border: '1px solid rgba(107,126,255,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: '#6B7EFF', letterSpacing: '0.12em', marginBottom: 8 }}>
            REQUIRED SETTINGS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {map.settings.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontFamily: MONO, fontSize: 8, color: '#94A3B8', whiteSpace: 'nowrap', minWidth: 120 }}>
                  {s.device}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: '#475569', flex: 1 }}>
                  {s.setting}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: '#059669', fontWeight: 700, textAlign: 'right' }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cautions */}
      {map.cautions.length > 0 && (
        <div style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 10, padding: '12px 14px' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: '#DC2626', letterSpacing: '0.12em', marginBottom: 8 }}>
            ⚠ CAUTIONS
          </div>
          {map.cautions.map((c, i) => (
            <div key={i} style={{ fontFamily: SANS, fontSize: 12, color: '#7F1D1D', lineHeight: 1.5, marginBottom: 4 }}>
              {c}
            </div>
          ))}
        </div>
      )}

      {/* Installation notes */}
      <div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: '#64748B', letterSpacing: '0.12em', marginBottom: 8 }}>
          INSTALLATION NOTES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {map.notes.map((note, i) => (
            <button
              key={i}
              onClick={() => setActiveNote(activeNote === i ? null : i)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, textAlign: 'left',
                background: activeNote === i ? 'rgba(107,126,255,0.06)' : '#F8FAFC',
                border: `1px solid ${activeNote === i ? 'rgba(107,126,255,0.2)' : '#E2E8F0'}`,
                borderRadius: 8, padding: '10px 12px', cursor: 'pointer', width: '100%',
              }}
            >
              <span style={{
                fontFamily: MONO, fontSize: 9, color: '#6B7EFF', fontWeight: 700,
                minWidth: 18, marginTop: 1,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: SANS, fontSize: 12, color: '#334155', lineHeight: 1.55, flex: 1 }}>
                {note}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── WiringGuide screen — device selector + diagram ──────────────────────────

interface WiringGuideProps {
  product: { id?: string; name: string; brand: string; category: string; sku: string }
  onBack: () => void
  theme: { bg: string; bgCard: string; border: string; blue: string; textPrimary: string; textSecondary: string; textMuted: string }
  defaultMapId?: string   // pre-select a specific wiring map (e.g. from install demo)
}

export function WiringGuide({ product, onBack, theme, defaultMapId }: WiringGuideProps) {
  const [selectedMapId, setSelectedMapId] = useState<string | null>(defaultMapId ?? null)
  const [aiDevice,      setAiDevice]      = useState<DeviceDef | null>(null)
  const [wiringHints,   setWiringHints]   = useState<string[]>([])

  // Fetch AI-extracted device definition from Supabase if product has an id
  useEffect(() => {
    if (!product.id) return
    browserDb()
      .from('device_suggestions')
      .select('device_def, wiring_hints, status')
      .eq('product_id', product.id)
      .in('status', ['ai_generated', 'verified'])
      .maybeSingle()
      .then(({ data }) => {
        if (data?.device_def) setAiDevice(data.device_def as DeviceDef)
        if (data?.wiring_hints) setWiringHints(data.wiring_hints as string[])
      })
  }, [product.id])

  // Find matching device definitions — static library first, then AI supplement
  const matchedDevices = useMemo(() => {
    const matched = matchDeviceToProduct(product)
    if (matched.length > 0) {
      return matched.flatMap((d: DeviceDef) => getCompatiblePartners(d.id))
    }
    return []
  }, [product])

  const selectedMap = selectedMapId ? getMap(selectedMapId) : null

  return (
    <div style={{ background: theme.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* Top bar */}
      <div style={{
        background: theme.bgCard, borderBottom: `1px solid ${theme.border}`,
        padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: MONO, fontSize: 18, color: theme.textMuted, padding: '0 4px',
        }}>‹</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: theme.blue, letterSpacing: '0.14em', fontWeight: 700 }}>
            WIRING GUIDE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: theme.textMuted, letterSpacing: '0.06em' }}>
            {product.sku} — {product.brand.toUpperCase()}
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: theme.textMuted, letterSpacing: '0.08em' }}>
          📐 DIAGRAMS
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 32px' }}>

        {/* Pairing selector */}
        {!selectedMap && (
          <>
            <div style={{ fontFamily: MONO, fontSize: 9, color: theme.textMuted, letterSpacing: '0.14em', marginBottom: 12 }}>
              SELECT CONNECTION TYPE
            </div>

            {/* AI-extracted terminal reference (shows alongside or instead of static maps) */}
            {aiDevice && matchedDevices.length === 0 && (
              <div style={{
                background: 'rgba(107,126,255,0.06)', border: '1px solid rgba(107,126,255,0.2)',
                borderRadius: 12, padding: 16, marginBottom: 14,
              }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: '#6B7EFF', letterSpacing: '0.14em', marginBottom: 10 }}>
                  ⚡ AI-EXTRACTED TERMINAL MAP
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: theme.textPrimary, fontWeight: 700, marginBottom: 6 }}>
                  {aiDevice.name}
                </div>
                {aiDevice.note && (
                  <div style={{ fontFamily: SANS, fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>
                    {aiDevice.note}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {aiDevice.terminals?.map((t) => (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '6px 10px', background: theme.bgCard, borderRadius: 7,
                    }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: TERMINAL_COLORS[t.type] ?? '#94A3B8',
                      }} />
                      <div style={{ fontFamily: MONO, fontSize: 9, color: theme.textPrimary, fontWeight: 700, minWidth: 52 }}>
                        {t.label}
                      </div>
                      <div style={{ fontFamily: SANS, fontSize: 10, color: theme.textMuted }}>
                        {t.desc}
                      </div>
                    </div>
                  ))}
                </div>
                {wiringHints.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: theme.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>
                      PAIRING NOTES
                    </div>
                    {wiringHints.map((hint, i) => (
                      <div key={i} style={{ fontFamily: SANS, fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>
                        • {hint}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {matchedDevices.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {matchedDevices.map(({ device, map }: { device: DeviceDef; map: WiringMap }) => (
                  <button
                    key={map.id}
                    onClick={() => setSelectedMapId(map.id)}
                    style={{
                      background: theme.bgCard, border: `1px solid ${theme.border}`,
                      borderRadius: 12, padding: '16px', textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 14,
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 20,
                    }}>
                      {device.category === 'Gate Operator' ? '🚧'
                        : device.category === 'Access Reader' ? '📟'
                        : device.category === 'Electric Lock' ? '🔒'
                        : '🔌'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: theme.textPrimary, marginBottom: 3 }}>
                        {map.title}
                      </div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: theme.textSecondary, lineHeight: 1.4 }}>
                        → {device.brand} {device.name}
                      </div>
                      <div style={{ fontFamily: SANS, fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                        {map.summary}
                      </div>
                    </div>
                    <span style={{ color: theme.blue, fontSize: 18, flexShrink: 0 }}>›</span>
                  </button>
                ))}
              </div>
            ) : (
              /* No match — show generic library */
              <GenericLibraryList onSelect={setSelectedMapId} theme={theme} />
            )}

            {/* Generic library button */}
            {matchedDevices.length > 0 && (
              <button
                onClick={() => setSelectedMapId('__browse__')}
                style={{
                  marginTop: 14, width: '100%', background: 'transparent',
                  border: `1px solid ${theme.border}`, borderRadius: 10,
                  padding: '12px 16px', fontFamily: MONO, fontSize: 9,
                  color: theme.textMuted, letterSpacing: '0.1em', cursor: 'pointer',
                }}
              >
                BROWSE ALL WIRING DIAGRAMS ›
              </button>
            )}
          </>
        )}

        {/* Browse all */}
        {selectedMapId === '__browse__' && (
          <>
            <button onClick={() => setSelectedMapId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 9, color: theme.blue, letterSpacing: '0.1em', marginBottom: 14 }}>
              ‹ BACK
            </button>
            <GenericLibraryList onSelect={setSelectedMapId} theme={theme} />
          </>
        )}

        {/* Show diagram */}
        {selectedMap && (
          <>
            <button onClick={() => setSelectedMapId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 9, color: theme.blue, letterSpacing: '0.1em', marginBottom: 14 }}>
              ‹ BACK TO LIST
            </button>
            <WiringDiagram map={selectedMap} />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Generic library browser ──────────────────────────────────────────────────

function GenericLibraryList({ onSelect, theme }: {
  onSelect: (id: string) => void
  theme: WiringGuideProps['theme']
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {(WIRING_MAPS as WiringMap[]).map((map) => {
        const a = getDevice(map.deviceAId) as DeviceDef | undefined
        const b = getDevice(map.deviceBId) as DeviceDef | undefined
        return (
          <button
            key={map.id}
            onClick={() => onSelect(map.id)}
            style={{
              background: theme.bgCard, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: '14px 16px', textAlign: 'left', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: theme.textPrimary }}>
              {a?.brand} {a?.name.split(' ')[0]} → {b?.brand} {b?.name.split(' ')[0]}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: theme.textSecondary }}>
              {map.title}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: theme.textMuted }}>
              {map.wires.length} wire{map.wires.length !== 1 ? 's' : ''} · {map.notes.length} installation note{map.notes.length !== 1 ? 's' : ''}
            </div>
          </button>
        )
      })}
    </div>
  )
}
