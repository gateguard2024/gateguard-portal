'use client'

/**
 * CableGuide — Interactive field reference for cable testing
 * Three modes: CAT Cable (T568B) · Two-Wire Series · Two-Wire Parallel
 */

import { useState } from 'react'

const MONO = '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace'
const SANS = '"IBM Plex Sans", -apple-system, system-ui, sans-serif'

type CableTab = 'cat' | 'series' | 'parallel'

const C = {
  blue:   '#6B7EFF',
  green:  '#059669',
  amber:  '#D97706',
  red:    '#DC2626',
  purple: '#7C3AED',
}

// ─── CAT Cable SVG ────────────────────────────────────────────────────────────

// T568B pinout — the dominant commercial wiring standard
const T568B = [
  { pin: 1, pair: 2, color: 'White/Orange', hex: '#FF9B3B', stripe: true  },
  { pin: 2, pair: 2, color: 'Orange',       hex: '#FF6B00', stripe: false },
  { pin: 3, pair: 3, color: 'White/Green',  hex: '#22C55E', stripe: true  },
  { pin: 4, pair: 1, color: 'Blue',         hex: '#3B82F6', stripe: false },
  { pin: 5, pair: 1, color: 'White/Blue',   hex: '#93C5FD', stripe: true  },
  { pin: 6, pair: 3, color: 'Green',        hex: '#16A34A', stripe: false },
  { pin: 7, pair: 4, color: 'White/Brown',  hex: '#B45309', stripe: true  },
  { pin: 8, pair: 4, color: 'Brown',        hex: '#78350F', stripe: false },
]

function CatCableSVG() {
  const [hoveredPin, setHoveredPin] = useState<number | null>(null)

  const W = 360, H = 200
  // RJ45 connector body
  const CX = 50, CY = 60      // connector center
  const PIN_START_X = 28
  const PIN_W = 8, PIN_GAP = 3
  const PIN_H = 30
  const LABEL_Y = 130

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 400 }}>
      {/* Connector body */}
      <rect x={15} y={40} width={82} height={70} rx={4} ry={4} fill="#D1D5DB" stroke="#9CA3AF" strokeWidth={1.5} />
      <rect x={20} y={48} width={72} height={52} rx={2} ry={2} fill="#F9FAFB" stroke="#E5E7EB" strokeWidth={1} />
      {/* Locking tab */}
      <rect x={36} y={38} width={40} height={8} rx={4} fill="#9CA3AF" />

      {/* Pins */}
      {T568B.map((p, i) => {
        const x = PIN_START_X + i * (PIN_W + PIN_GAP)
        const isHov = hoveredPin === p.pin
        return (
          <g key={p.pin}
            onMouseEnter={() => setHoveredPin(p.pin)}
            onMouseLeave={() => setHoveredPin(null)}
            style={{ cursor: 'pointer' }}
          >
            {/* Pin blade */}
            <rect x={x} y={53} width={PIN_W} height={PIN_H} rx={1}
              fill={isHov ? p.hex : p.hex + 'CC'}
              stroke={isHov ? '#0F172A' : 'none'}
              strokeWidth={1}
            />
            {/* Stripe overlay for striped wires */}
            {p.stripe && (
              <>
                <rect x={x+1} y={58} width={PIN_W-2} height={2} fill="white" opacity={0.6} />
                <rect x={x+1} y={64} width={PIN_W-2} height={2} fill="white" opacity={0.6} />
                <rect x={x+1} y={70} width={PIN_W-2} height={2} fill="white" opacity={0.6} />
              </>
            )}
            {/* Pin number below connector */}
            <text x={x + PIN_W/2} y={LABEL_Y} textAnchor="middle"
              fontFamily={MONO} fontSize={8} fill={isHov ? '#0F172A' : '#64748B'} fontWeight={isHov ? 'bold' : 'normal'}>
              {p.pin}
            </text>
          </g>
        )
      })}

      {/* Hover tooltip */}
      {hoveredPin !== null && (() => {
        const p = T568B.find(p => p.pin === hoveredPin)!
        return (
          <g>
            <rect x={115} y={38} width={235} height={42} rx={6} fill={p.hex + '18'} stroke={p.hex} strokeWidth={1} />
            <text x={124} y={56} fontFamily={MONO} fontSize={9} fontWeight="bold" fill="#0F172A">
              Pin {p.pin} — {p.color}
            </text>
            <text x={124} y={72} fontFamily={SANS} fontSize={10} fill="#475569">
              Pair {p.pair} · {p.pin <= 2 ? 'PoE/Data' : p.pin <= 6 ? 'PoE/Data' : 'Spare pair'}
            </text>
          </g>
        )
      })()}

      {/* Static labels when no hover */}
      {hoveredPin === null && (
        <>
          <rect x={115} y={38} width={235} height={42} rx={6} fill="#F1F5F9" stroke="#E2E8F0" strokeWidth={1} />
          <text x={124} y={56} fontFamily={MONO} fontSize={8} fill="#94A3B8" letterSpacing="0.08em">
            T568B STANDARD  (tap a pin)
          </text>
          <text x={124} y={72} fontFamily={SANS} fontSize={10} fill="#64748B">
            Pairs: 1=Blue · 2=Orange · 3=Green · 4=Brown
          </text>
        </>
      )}

      {/* Pair wires running out the back */}
      {T568B.map((p, i) => {
        const x = PIN_START_X + i * (PIN_W + PIN_GAP) + PIN_W / 2
        const isHov = hoveredPin === p.pin
        return (
          <line key={p.pin}
            x1={x} y1={110} x2={x} y2={H - 10}
            stroke={p.hex} strokeWidth={isHov ? 3 : 2}
            opacity={isHov ? 1 : 0.6}
          />
        )
      })}

      {/* "↓ to wall jack / patch panel" */}
      <text x={50} y={H - 2} textAnchor="middle" fontFamily={MONO} fontSize={7} fill="#94A3B8" letterSpacing="0.06em">
        ↓ cable
      </text>
    </svg>
  )
}

// ─── Series circuit SVG ───────────────────────────────────────────────────────

function SeriesSVG() {
  const W = 360, H = 140
  const devices = ['Device 1', 'Device 2', 'Device 3']
  const spacing = 90
  const startX = 30, y = 60
  const endX = startX + devices.length * spacing

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 400 }}>
      {/* Power supply */}
      <rect x={4} y={y - 18} width={22} height={36} rx={4} fill="#0F172A" />
      <text x={15} y={y - 24} textAnchor="middle" fontFamily={MONO} fontSize={7} fill="#64748B">PWR</text>
      <line x1={26} y1={y - 10} x2={startX} y2={y - 10} stroke="#DC2626" strokeWidth={2.5} />
      <line x1={26} y1={y + 10} x2={startX} y2={y + 10} stroke="#1e293b" strokeWidth={2.5} />

      {/* Devices in series (top rail = +, bottom rail = return) */}
      {devices.map((name, i) => {
        const x = startX + i * spacing
        const nextX = x + spacing
        return (
          <g key={i}>
            {/* Device box */}
            <rect x={x + 8} y={y - 16} width={spacing - 16} height={32} rx={6}
              fill="#FFFFFF" stroke="#6B7EFF" strokeWidth={1.5} />
            <text x={x + spacing / 2} y={y + 4} textAnchor="middle"
              fontFamily={MONO} fontSize={8} fill="#0F172A">{name}</text>
            {/* Wire to next device (top rail) */}
            {i < devices.length - 1 && (
              <line x1={x + spacing - 8} y1={y - 10} x2={nextX + 8} y2={y - 10}
                stroke="#DC2626" strokeWidth={2.5} />
            )}
            {/* Wire to next device (bottom rail) */}
            {i < devices.length - 1 && (
              <line x1={x + spacing - 8} y1={y + 10} x2={nextX + 8} y2={y + 10}
                stroke="#1e293b" strokeWidth={2.5} />
            )}
          </g>
        )
      })}

      {/* Close the loop — return wire */}
      <line x1={startX + devices.length * spacing - 8} y1={y - 10}
            x2={W - 10} y2={y - 10} stroke="#DC2626" strokeWidth={2.5} />
      <line x1={startX + devices.length * spacing - 8} y1={y + 10}
            x2={W - 10} y2={y + 10} stroke="#1e293b" strokeWidth={2.5} />
      <line x1={W - 10} y1={y - 10} x2={W - 10} y2={y + 10}
            stroke="#94A3B8" strokeWidth={2} strokeDasharray="3 2" />

      {/* Break indicator */}
      <g transform={`translate(${startX + spacing - 8}, ${y - 10})`}>
        <line x1={-4} y1={0} x2={4} y2={0} stroke="#DC2626" strokeWidth={3} strokeDasharray="2 3" />
        <text x={0} y={-8} textAnchor="middle" fontFamily={MONO} fontSize={7} fill="#DC2626">BREAK</text>
        <text x={0} y={-17} textAnchor="middle" fontFamily={MONO} fontSize={7} fill="#DC2626">= ALL FAIL</text>
      </g>

      {/* Legend */}
      <line x1={10} y1={H - 12} x2={30} y2={H - 12} stroke="#DC2626" strokeWidth={2.5} />
      <text x={34} y={H - 8} fontFamily={MONO} fontSize={8} fill="#64748B">+V (positive)</text>
      <line x1={115} y1={H - 12} x2={135} y2={H - 12} stroke="#1e293b" strokeWidth={2.5} />
      <text x={139} y={H - 8} fontFamily={MONO} fontSize={8} fill="#64748B">GND (return)</text>
    </svg>
  )
}

// ─── Parallel circuit SVG ─────────────────────────────────────────────────────

function ParallelSVG() {
  const W = 360, H = 160
  const devices = ['Device 1', 'Device 2', 'Device 3']
  const BUS_X1 = 30, BUS_X2 = W - 30
  const BUS_Y_TOP = 18, BUS_Y_BOT = H - 18
  const spacing = (BUS_X2 - BUS_X1) / devices.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', maxWidth: 400 }}>
      {/* Bus bars */}
      <line x1={BUS_X1} y1={BUS_Y_TOP} x2={BUS_X2} y2={BUS_Y_TOP} stroke="#DC2626" strokeWidth={3} />
      <line x1={BUS_X1} y1={BUS_Y_BOT} x2={BUS_X2} y2={BUS_Y_BOT} stroke="#1e293b" strokeWidth={3} />
      <text x={BUS_X1 - 2} y={BUS_Y_TOP - 4} fontFamily={MONO} fontSize={7} fill="#DC2626">+ BUS</text>
      <text x={BUS_X1 - 2} y={BUS_Y_BOT + 12} fontFamily={MONO} fontSize={7} fill="#64748B">GND BUS</text>

      {/* Power supply connections */}
      <rect x={4} y={(BUS_Y_TOP + BUS_Y_BOT) / 2 - 14} width={22} height={28} rx={4} fill="#0F172A" />
      <line x1={26} y1={BUS_Y_TOP} x2={BUS_X1} y2={BUS_Y_TOP} stroke="#DC2626" strokeWidth={3} />
      <line x1={26} y1={BUS_Y_BOT} x2={BUS_X1} y2={BUS_Y_BOT} stroke="#1e293b" strokeWidth={3} />

      {/* Devices hanging from bus */}
      {devices.map((name, i) => {
        const cx = BUS_X1 + (i + 0.5) * spacing
        const devY1 = BUS_Y_TOP + 20
        const devY2 = BUS_Y_BOT - 20
        const midY = (devY1 + devY2) / 2
        return (
          <g key={i}>
            {/* Drop down from + bus */}
            <line x1={cx} y1={BUS_Y_TOP} x2={cx} y2={devY1} stroke="#DC2626" strokeWidth={2.5} />
            {/* Device */}
            <rect x={cx - 24} y={midY - 16} width={48} height={32} rx={6}
              fill="#FFFFFF" stroke="#6B7EFF" strokeWidth={1.5} />
            <text x={cx} y={midY + 4} textAnchor="middle"
              fontFamily={MONO} fontSize={8} fill="#0F172A">{name}</text>
            {/* Return to GND bus */}
            <line x1={cx} y1={devY2} x2={cx} y2={BUS_Y_BOT} stroke="#1e293b" strokeWidth={2.5} />
          </g>
        )
      })}

      {/* Break indicator on one branch */}
      <g transform={`translate(${BUS_X1 + 0.5 * spacing}, ${BUS_Y_TOP + 10})`}>
        <line x1={0} y1={0} x2={0} y2={6} stroke="#DC2626" strokeWidth={3} strokeDasharray="2 3" />
        <text x={0} y={-4} textAnchor="middle" fontFamily={MONO} fontSize={7} fill="#DC2626">BREAK</text>
        <text x={0} y={-13} textAnchor="middle" fontFamily={MONO} fontSize={6} fill="#D97706">others OK</text>
      </g>
    </svg>
  )
}

// ─── Step card ────────────────────────────────────────────────────────────────

interface StepCard {
  num: number
  title: string
  detail: string
  tool?: string
  reading?: string
  pass?: string
  fail?: string
  tip?: string
}

function Step({ s }: { s: StepCard }) {
  const [open, setOpen] = useState(false)
  return (
    <button
      onClick={() => setOpen(o => !o)}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: open ? 'rgba(107,126,255,0.06)' : '#FFFFFF',
        border: `1px solid ${open ? 'rgba(107,126,255,0.22)' : '#E2E8F0'}`,
        borderRadius: 10, padding: '12px 14px', marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#6B7EFF',
          minWidth: 24, background: 'rgba(107,126,255,0.1)', borderRadius: 4,
          padding: '2px 5px', textAlign: 'center',
        }}>
          {String(s.num).padStart(2, '0')}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#0F172A', flex: 1 }}>
          {s.title}
        </span>
        <span style={{ color: '#94A3B8', fontSize: 14 }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7, paddingLeft: 34 }}>
          <p style={{ fontFamily: SANS, fontSize: 13, color: '#334155', lineHeight: 1.55, margin: 0 }}>
            {s.detail}
          </p>
          {s.tool && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: '#D97706', letterSpacing: '0.06em' }}>
              🔧 TOOL: {s.tool}
            </div>
          )}
          {s.reading && (
            <div style={{ background: '#F1F5F9', borderRadius: 6, padding: '7px 10px', fontFamily: MONO, fontSize: 10, color: '#475569' }}>
              📐 EXPECT: {s.reading}
            </div>
          )}
          {(s.pass || s.fail) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {s.pass && (
                <div style={{ flex: 1, background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 6, padding: '6px 10px', fontFamily: SANS, fontSize: 11, color: '#065F46' }}>
                  ✓ {s.pass}
                </div>
              )}
              {s.fail && (
                <div style={{ flex: 1, background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)', borderRadius: 6, padding: '6px 10px', fontFamily: SANS, fontSize: 11, color: '#7F1D1D' }}>
                  ✗ {s.fail}
                </div>
              )}
            </div>
          )}
          {s.tip && (
            <div style={{ fontFamily: SANS, fontSize: 11, color: '#6B7EFF', fontStyle: 'italic' }}>
              💡 {s.tip}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function CatCableContent() {
  const steps: StepCard[] = [
    {
      num: 1,
      title: 'Inspect the jacket',
      detail: 'Look for kinks, crush damage, or nick cuts in the outer jacket. A damaged jacket in a conduit run will absorb water over time. If the jacket is compromised, the run needs to be replaced.',
      tool: 'Eyes / flashlight',
      pass: 'Jacket smooth, no damage', fail: 'Any damage = replace run',
    },
    {
      num: 2,
      title: 'Check connector seating',
      detail: 'At both ends, confirm the RJ45 plug is fully seated in the jack/device. The locking tab should click audibly. A half-seated plug is the #1 cause of "no link light" calls.',
      tool: 'Thumb pressure at connector',
      pass: 'Click felt, no rocking', fail: 'Re-terminate or replace plug',
    },
    {
      num: 3,
      title: 'Verify link light',
      detail: 'Plug both ends in. Confirm the link LED on the switch port or device is solid (not blinking). On PoE devices, wait 10 seconds for negotiation. Blinking usually means traffic; solid means link established.',
      tool: 'Network switch or PoE injector',
      reading: 'Solid amber (100 Mb) or solid green (1 Gb)',
      pass: 'Solid link light on switch', fail: 'No light — proceed to continuity test',
    },
    {
      num: 4,
      title: 'Continuity test (cable tester)',
      detail: 'Use a cable tester (e.g. Fluke CableIQ or basic RJ45 tester). Insert both ends. The tester sends a signal across all 8 wires. LEDs 1–8 should light sequentially. A mis-wired pair shows out of order. An open shows no light.',
      tool: 'RJ45 cable tester (basic 2-piece or Fluke)',
      reading: 'Pins 1-2-3-4-5-6-7-8 all light in order',
      pass: 'All 8 pins pass in sequence', fail: 'Out-of-order = split pair. Missing = open/break.',
      tip: 'A "split pair" passes continuity but causes high crosstalk and link failures over distance. Re-terminate using T568B standard.',
    },
    {
      num: 5,
      title: 'Identify T568B vs T568A mismatch',
      detail: 'If you have a link on one side but errors, check whether one end is T568A and the other T568B. An A-B crossover cable will still pass continuity but will create a crossover — fine for older switches, wrong for modern straight-through runs.',
      tool: 'Ethernet tester with wire map display',
      reading: 'Both ends should be T568B: 1=W/Or, 2=Or, 3=W/Gr, 4=Bl, 5=W/Bl, 6=Gr, 7=W/Br, 8=Br',
      pass: 'Both ends match T568B', fail: 'One end T568A = crossover cable. OK for uplinks between switches; re-terminate for device runs.',
    },
    {
      num: 6,
      title: 'PoE voltage check',
      detail: 'For cameras or access controllers on PoE: with a multimeter set to DC, measure between pins 1(+) and 2(−) of the RJ45, and separately between pins 3(+) and 6(−). You should read approximately 48–56VDC on each pair pair when the switch detects a valid PoE device.',
      tool: 'Multimeter (DC setting)',
      reading: '48–56 VDC between pins 1-2 and between pins 3-6',
      pass: '~48V on both pairs = switch is delivering PoE', fail: '0V = PoE budget exceeded or port disabled. Check switch config.',
      tip: 'Never test PoE voltage with a cable tester — the high voltage will damage the tester.',
    },
    {
      num: 7,
      title: 'Length and loss (long runs)',
      detail: 'Cat5e/Cat6 has a 328 ft (100 m) maximum. Runs over 250 ft may show marginal PoE performance. If using a basic tester, use tone & probe to trace the run and estimate length. A Fluke CableIQ will report length and attenuation directly.',
      tool: 'Tone & probe, or Fluke CableIQ',
      reading: 'Under 100 m (328 ft) for Cat5e/Cat6',
      pass: 'Under 100 m, <6 dB insertion loss', fail: 'Over 100 m = install switch/injector mid-run or replace with fiber',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#64748B', letterSpacing: '0.12em', marginBottom: 10 }}>
          T568B PINOUT — TAP A PIN FOR DETAIL
        </div>
        <CatCableSVG />
      </div>

      {/* Quick reference table */}
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 8, color: '#94A3B8', letterSpacing: '0.12em', marginBottom: 8 }}>
          T568B QUICK REF
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {T568B.map(p => (
            <div key={p.pin} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.hex, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: 8 }}>
                <span style={{ color: '#0F172A', fontWeight: 700 }}>{p.pin}</span>
                <span style={{ color: '#94A3B8' }}> {p.color.split('/').join('/').replace('White/', 'W/')}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9, color: '#64748B', letterSpacing: '0.12em', marginBottom: 10 }}>
        TESTING PROCEDURE
      </div>
      {steps.map(s => <Step key={s.num} s={s} />)}
    </div>
  )
}

function SeriesContent() {
  const steps: StepCard[] = [
    {
      num: 1,
      title: 'Understand the topology',
      detail: 'In a series circuit, all devices share one continuous loop of wire. Current flows through each device in sequence. One break anywhere in the loop = NO power to all devices downstream of the break. Common in: photobeam pairs, some older keypad/reader daisy chains, basic sensor loops.',
      tip: 'Series wiring is simple to run but has one big weakness: single point of failure. If you find one device dead, check the entire run.',
    },
    {
      num: 2,
      title: 'Identify all points in the series run',
      detail: 'Before testing, trace and list every device in the loop. Note the wire entry and exit terminals at each device. A wiring diagram helps here — request one from the gate/access installer if available.',
      tool: 'Wiring diagram or pen & paper',
    },
    {
      num: 3,
      title: 'Check voltage at the power source',
      detail: 'With the circuit energized, measure DC voltage at the power supply output terminals. Verify it matches spec (typically 12VDC or 24VDC). If no voltage at source, the problem is the power supply, not the run.',
      tool: 'Multimeter — DC voltage setting',
      reading: '12.0–13.5 VDC (12V system) or 24.0–26.5 VDC (24V system)',
      pass: 'Voltage within spec', fail: 'No voltage = PSU failure, breaker tripped, or blown fuse',
    },
    {
      num: 4,
      title: 'Check voltage at each device in order',
      detail: 'Work down the series run. Check voltage at the + input terminal of each device. When voltage disappears between Device N and Device N+1, the break is in the wire segment between those two points.',
      tool: 'Multimeter — DC voltage setting',
      reading: 'Same supply voltage present at each device until the break',
      pass: 'Voltage present = that wire segment is good', fail: '0V = break is in the wire before this device',
    },
    {
      num: 5,
      title: 'Isolate the broken segment',
      detail: 'Once you\'ve identified which two connection points the break falls between, de-energize the circuit. Use your multimeter in continuity/beep mode across that wire segment (disconnect both ends first). Clip one probe to each end of the suspect wire run.',
      tool: 'Multimeter — continuity (beep/Ω) mode',
      reading: 'Beep or reading < 2Ω = wire is intact',
      pass: 'Continuity confirmed — break may be at a terminal (loose screw)', fail: 'No beep / OL = wire is broken — replace the run segment',
    },
    {
      num: 6,
      title: 'Check terminals and connectors',
      detail: 'Before declaring a wire dead, check terminals at both ends. A wire with correct resistance but no continuity often has a loose terminal screw or a damaged insulation displacement connector (IDC). Tug gently on each wire at every terminal in the suspect segment.',
      tip: 'Many "broken wire" service calls are actually a $0 fix: one loose terminal screw.',
    },
    {
      num: 7,
      title: 'Restore and verify',
      detail: 'After repairing, re-energize the circuit and re-test each device. Walk the entire series run one final time to confirm all devices are powered and responding before closing up.',
      pass: 'All devices power on, voltage reaches end of run', fail: 'Still failing = secondary break in the run',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#64748B', letterSpacing: '0.12em', marginBottom: 10 }}>
          SERIES CIRCUIT — ONE BREAK KILLS ALL
        </div>
        <SeriesSVG />
      </div>

      <div style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
        <p style={{ fontFamily: SANS, fontSize: 12, color: '#7F1D1D', margin: 0, lineHeight: 1.55 }}>
          <strong>Key rule:</strong> In a series circuit, a single wire break kills power to every device after the break. Finding the break = walking the run, checking voltage at each device until it disappears.
        </p>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9, color: '#64748B', letterSpacing: '0.12em', marginBottom: 10 }}>
        TESTING PROCEDURE
      </div>
      {steps.map(s => <Step key={s.num} s={s} />)}
    </div>
  )
}

function ParallelContent() {
  const steps: StepCard[] = [
    {
      num: 1,
      title: 'Understand the topology',
      detail: 'In a parallel circuit, every device connects individually between a shared positive bus and a shared ground (return) bus. Each device has its own independent path to power. One device failing or one wire breaking only affects that single device — all others stay powered. Common in: 12V keypad power runs, multi-device access control power, lighting circuits.',
      tip: 'Parallel is more fault-tolerant but requires more wire. Each device needs its own homerun back to the power supply (or to a shared bus bar).',
    },
    {
      num: 2,
      title: 'Verify bus voltage',
      detail: 'Check voltage between the + bus and GND bus at the power supply output. This is your baseline. All devices should see this same voltage minus any voltage drop from wire resistance.',
      tool: 'Multimeter — DC voltage',
      reading: '12.0–13.5 VDC (12V) or 24.0–26.5 VDC (24V)',
      pass: 'Bus voltage within spec', fail: 'Check PSU, fuse, breaker',
    },
    {
      num: 3,
      title: 'Isolate which device/branch is affected',
      detail: 'If only one device is dead, the fault is in that device\'s branch (its two wires from bus to device), not the main supply. Disconnect all other devices from the bus and confirm bus voltage is stable. Then reconnect them one at a time. If voltage collapses when one device is added, that device may be drawing excessive current (shorted).',
      tool: 'Multimeter — DC voltage',
      pass: 'Bus stays stable as each device is reconnected', fail: 'Voltage drops when specific device added = that device is shorted',
    },
    {
      num: 4,
      title: 'Check voltage at the dead device',
      detail: 'At the non-working device, measure voltage between its + terminal and its GND terminal. If voltage is present but the device is still dead, the device itself has failed. If no voltage is present, the problem is in the wire run from the bus to that device.',
      tool: 'Multimeter — DC voltage',
      reading: 'Same as bus voltage (allow 0.5V for wire drop)',
      pass: 'Full voltage at device = device has failed internally', fail: 'No voltage at device = wire break or bus connection problem',
    },
    {
      num: 5,
      title: 'Test the suspect wire run',
      detail: 'De-energize. Disconnect both ends of the suspect wire run. Set multimeter to continuity (beep) mode. Test the + wire: clip one probe to each end. Repeat for the GND wire. Both should beep (< 2Ω).',
      tool: 'Multimeter — continuity mode',
      reading: 'Beep or < 2Ω on each conductor',
      pass: 'Both conductors have continuity = terminal connection issue', fail: 'No continuity = broken wire — trace the run and locate the physical break',
      tip: 'For long runs, split the run in half and test each half separately to quickly find the break location.',
    },
    {
      num: 6,
      title: 'Check current draw (overcurrent)',
      detail: 'For intermittent failures or tripped fuses, measure current draw of each device. Set meter to DC amps, break the circuit on the + wire, and place meter in series. Compare to device spec.',
      tool: 'Multimeter — DC amps (in-series)',
      reading: 'Per device nameplate — typically 50–500 mA for access devices',
      pass: 'Within 20% of rated draw', fail: 'Significantly over rating = device fault or wiring short',
    },
    {
      num: 7,
      title: 'Check for shared ground issues',
      detail: 'Parallel circuits are vulnerable to ground loops if the GND bus is connected to more than one external earth ground point. Symptoms: noisy video, reader intermittency, false alarms. Verify GND bus connects to earth ground at ONE point only — typically at the main panel or PSU.',
      tip: 'Ground loops are common when a camera system and access control system both have their GND bus connected to building ground at different points. Use isolation transformers or optical isolation if ground loops are suspected.',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: '#64748B', letterSpacing: '0.12em', marginBottom: 10 }}>
          PARALLEL CIRCUIT — ONE BREAK = ONE DEVICE ONLY
        </div>
        <ParallelSVG />
      </div>

      <div style={{ background: 'rgba(5,150,105,0.05)', border: '1px solid rgba(5,150,105,0.15)', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
        <p style={{ fontFamily: SANS, fontSize: 12, color: '#065F46', margin: 0, lineHeight: 1.55 }}>
          <strong>Key rule:</strong> In a parallel circuit, each device has its own independent path to power. One failure only affects one device. Start by isolating which branch is affected, then trace only that run.
        </p>
      </div>

      <div style={{ fontFamily: MONO, fontSize: 9, color: '#64748B', letterSpacing: '0.12em', marginBottom: 10 }}>
        TESTING PROCEDURE
      </div>
      {steps.map(s => <Step key={s.num} s={s} />)}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface CableGuideProps {
  onBack: () => void
  theme: {
    bg: string; bgCard: string; border: string; blue: string
    textPrimary: string; textSecondary: string; textMuted: string
  }
}

export function CableGuide({ onBack, theme }: CableGuideProps) {
  const [tab, setTab] = useState<CableTab>('cat')

  const tabs: { id: CableTab; label: string; icon: string }[] = [
    { id: 'cat',      label: 'CAT Cable',   icon: '🔌' },
    { id: 'series',   label: '2-Wire Series',  icon: '⛓' },
    { id: 'parallel', label: '2-Wire Parallel', icon: '⚡' },
  ]

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
            CABLE GUIDE
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: theme.textMuted, letterSpacing: '0.06em' }}>
            PINOUTS · TESTING · TROUBLESHOOTING
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', background: theme.bgCard,
        borderBottom: `1px solid ${theme.border}`, flexShrink: 0,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '10px 4px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${tab === t.id ? theme.blue : 'transparent'}`,
              fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
              color: tab === t.id ? theme.blue : theme.textMuted,
              fontWeight: tab === t.id ? 700 : 400,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 14, marginBottom: 2 }}>{t.icon}</div>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 40px' }}>
        {tab === 'cat'      && <CatCableContent />}
        {tab === 'series'   && <SeriesContent />}
        {tab === 'parallel' && <ParallelContent />}
      </div>
    </div>
  )
}
