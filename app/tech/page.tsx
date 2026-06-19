'use client'

/**
 * /tech — GateGuard Field Diagnostic Tool  v4
 *
 * Complete diagnostic engine:
 *   pin     → auth
 *   home    → device picker
 *   choice  → VIEW MANUAL | TROUBLESHOOT
 *   symptom → fault description + quick picks
 *   diag    → AI step engine (question/action/measure/select/photo/resolved/escalate)
 */

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams }                        from 'next/navigation'
import { WiringGuide }  from '@/components/tech/WiringDiagram'
import { CableGuide }   from '@/components/tech/CableGuide'

// ─── Types ────────────────────────────────────────────────────────────────────
type StepType = 'question' | 'action' | 'measure' | 'select' | 'photo' | 'resolved' | 'escalate'
type Screen   = 'pin' | 'identity' | 'home' | 'choice' | 'symptom' | 'diag' | 'wiring' | 'cable' | 'install' | 'survey' | 'survey_add' | 'survey_transcript' | 'training' | 'training_course' | 'netscout' | 'jobs'

// ─── Site Survey Types ────────────────────────────────────────────────────────
interface SurveyDevice {
  id:          string
  name:        string
  brand:       string
  model:       string
  location:    string
  condition:   'good' | 'fair' | 'poor'
  action:      'keep' | 'service' | 'replace' | 'new_install'
  notes:       string
  photoDataUrl?: string
}

interface ProposalLineItem {
  description: string
  qty:         number
  note:        string
  priority:    'urgent' | 'recommended' | 'optional'
}

interface SowCategoryItem {
  label:     string
  condition: 'good' | 'fair' | 'poor'
  action:    string
}

interface SowCategory {
  category: string
  count:    number
  items:    SowCategoryItem[]
}

interface SowWorkItem {
  name:     string
  location: string
  action:   'service' | 'replace' | 'new_install'
  issue:    string
  priority: 'urgent' | 'recommended' | 'optional'
}

interface SowExpectation {
  scope:        string
  timeline:     string
  deliverables: string[]
  outcomes:     string[]
}

interface SurveyProposal {
  // SOW sections
  whatIsThere: {
    categories:   SowCategory[]
    totalGates:   number
    totalDoors:   number
    totalDevices: number
    summary:      string
  }
  whatNeedsWork: SowWorkItem[]
  whatToExpect:  SowExpectation
  // Legacy fields
  summary:         string
  lineItems:       ProposalLineItem[]
  recommendations: string[]
  urgentItems:     string[]
  installNotes:    string[]
}

interface Step {
  type:       StepType
  text:       string
  detail:     string | null
  unit?:      string | null      // for measure (VAC, VDC, Ω, ms, A)
  expected?:  string | null      // for measure (e.g. "115±10", ">12", "0")
  choices?:   string[] | null    // for select
  manual_ref: { url: string | null; page: number | null; section: string | null } | null
  session_id: string
}

interface HistoryItem { question: string; answer: string }

interface Product {
  id:          string
  name:        string
  brand:       string
  category:    string
  sku:         string
  manual_url:  string | null
  image_url:   string | null
  description: string | null
  specs:       string | null
  tags:        string[] | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────
// Two-tone: dark navy header strip + clean white content area.
// Reference: IntraMD (dark hero bar → white list), BMW (dark top → white sheet).
const C = {
  bg:            '#070B14',   // deep near-black navy — content area background
  bgDeep:        '#040710',   // deeper — nested panels, detail blocks
  bgCard:        'rgba(255,255,255,0.045)',   // glass card surfaces (over the dark gradient)
  bgInput:       'rgba(4,8,18,0.55)',          // input fields
  bgSurface:     'rgba(255,255,255,0.07)',     // elevated surfaces, hover states
  topBarBg:      'rgba(8,14,28,0.72)',          // glass topBar / header
  border:        'rgba(255,255,255,0.09)',
  borderMed:     'rgba(255,255,255,0.16)',
  textPrimary:   '#DCE8FF',   // bright white-blue — main text on dark
  textSecondary: '#6B8CAE',   // mid blue-gray — secondary text
  textMuted:     '#334966',   // muted labels
  textOnDark:    '#DCE8FF',   // same on dark backgrounds
  blue:    '#6B7EFF',
  cyan:    '#00C8FF',
  amber:   '#F59E0B',
  green:   '#10B981',
  red:     '#F87171',
  purple:  '#A78BFA',
  blueAlpha:   'rgba(107,126,255,0.15)',
  amberAlpha:  'rgba(245,158,11,0.15)',
  greenAlpha:  'rgba(16,185,129,0.15)',
  redAlpha:    'rgba(248,113,113,0.15)',
  purpleAlpha: 'rgba(167,139,250,0.15)',
}

// Clean line-icons for the bottom nav (replaces emoji). Stroke uses currentColor.
function NavIcon({ k, size = 22 }: { k: string; size?: number }) {
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<string, React.ReactNode> = {
    diagnose: <><circle cx="11" cy="11" r="7" {...p} /><line x1="21" y1="21" x2="16.65" y2="16.65" {...p} /></>,
    jobs:     <><rect x="3" y="7" width="18" height="13" rx="2" {...p} /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" {...p} /><line x1="3" y1="12" x2="21" y2="12" {...p} /></>,
    wiring:   <path d="M13 2 3 14h8l-1 8 11-12h-8l0-8z" {...p} />,
    cable:    <><path d="M9 2v6M15 2v6" {...p} /><path d="M7 8h10v3a5 5 0 0 1-10 0V8z" {...p} /><path d="M12 16v6" {...p} /></>,
    survey:   <><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" {...p} /><circle cx="12" cy="10" r="2.5" {...p} /></>,
    netscout: <><path d="M2 9a16 16 0 0 1 20 0" {...p} /><path d="M5 12.5a11 11 0 0 1 14 0" {...p} /><path d="M8.5 16a6 6 0 0 1 7 0" {...p} /><circle cx="12" cy="19.5" r="1" fill="currentColor" stroke="none" /></>,
    train:    <><path d="M22 10 12 5 2 10l10 5 10-5z" {...p} /><path d="M6 12v5c0 1.1 2.7 3 6 3s6-1.9 6-3v-5" {...p} /></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">{paths[k] ?? null}</svg>
}

const STEP_CFG: Record<StepType, {
  accent: string; surface: string; border: string; label: string; numColor: string
}> = {
  question: { accent: C.blue,   surface: 'rgba(107,126,255,0.09)',  border: 'rgba(107,126,255,0.38)',  label: 'VERIFY',   numColor: C.blue   },
  action:   { accent: C.amber,  surface: 'rgba(245,158,11,0.09)',   border: 'rgba(245,158,11,0.38)',   label: 'ACTION',   numColor: C.amber  },
  measure:  { accent: C.purple, surface: 'rgba(167,139,250,0.09)',  border: 'rgba(167,139,250,0.38)',  label: 'MEASURE',  numColor: C.purple },
  select:   { accent: C.blue,   surface: 'rgba(107,126,255,0.09)',  border: 'rgba(107,126,255,0.38)',  label: 'SELECT',   numColor: C.blue   },
  photo:    { accent: C.amber,  surface: 'rgba(245,158,11,0.09)',   border: 'rgba(245,158,11,0.38)',   label: 'CAPTURE',  numColor: C.amber  },
  resolved: { accent: C.green,  surface: 'rgba(16,185,129,0.09)',   border: 'rgba(16,185,129,0.38)',   label: 'RESOLVED', numColor: C.green  },
  escalate: { accent: C.red,    surface: 'rgba(248,113,113,0.09)',  border: 'rgba(248,113,113,0.38)',  label: 'ESCALATE', numColor: C.red    },
}

// ─── Meter configuration per unit type ───────────────────────────────────────
interface MeterCaution { text: string; level: 'danger' | 'warn' }
interface MeterConfig {
  setting:  string    // dial position label
  range:    string    // range advice
  jackPos:  string    // + probe jack
  jackNeg:  string    // − probe jack
  dialPos:  string    // short token for SVG highlight
  cautions: MeterCaution[]
}

const METER_CONFIGS: Record<string, MeterConfig> = {
  VAC: {
    setting: 'AC Voltage  V~',
    range:   'Auto-range or set ABOVE expected value',
    jackPos: 'V / VΩmA',
    jackNeg: 'COM',
    dialPos: 'V~',
    cautions: [
      { text: 'LIVE VOLTAGE — do not touch bare probe tips or circuit contacts', level: 'danger' },
      { text: 'Never use DC voltage (V—) mode on AC circuits — misleading reading, possible meter damage', level: 'danger' },
      { text: 'Set range to auto or one step above expected before making contact', level: 'warn' },
      { text: 'Inspect probe insulation before use — cracked insulation is a shock hazard', level: 'warn' },
    ],
  },
  VDC: {
    setting: 'DC Voltage  V—',
    range:   'Auto-range or set ABOVE expected value',
    jackPos: 'V / VΩmA',
    jackNeg: 'COM',
    dialPos: 'V—',
    cautions: [
      { text: 'Red probe (+) to positive, black probe (COM) to negative for correct polarity', level: 'warn' },
      { text: 'Do NOT probe AC mains in DC mode — reading near 0 masks live danger', level: 'danger' },
      { text: 'Verify COM is in the COM jack, not the A (current) jack', level: 'warn' },
    ],
  },
  'Ω': {
    setting: 'Resistance  Ω',
    range:   'Auto-range or estimated range',
    jackPos: 'V / VΩmA',
    jackNeg: 'COM',
    dialPos: 'Ω',
    cautions: [
      { text: 'POWER OFF and capacitors discharged before measuring resistance — live voltage destroys meter and gives false readings', level: 'danger' },
      { text: 'Disconnect at least one lead of the component — parallel paths give false low readings', level: 'warn' },
      { text: 'Short probes together first — confirm ~0 Ω and zero out lead resistance', level: 'warn' },
    ],
  },
  A: {
    setting: 'Current  A',
    range:   'Start at highest range, step down',
    jackPos: 'A (dedicated current jack)',
    jackNeg: 'COM',
    dialPos: 'A',
    cautions: [
      { text: 'USE the dedicated A jack — using VΩ jack for current blows the fuse or destroys meter', level: 'danger' },
      { text: 'Meter goes IN SERIES — break the circuit to insert the meter', level: 'danger' },
      { text: 'Always start on highest range and step down to avoid fuse damage', level: 'warn' },
    ],
  },
  mA: {
    setting: 'Milliamps  mA',
    range:   'mA range',
    jackPos: 'mA / VΩmA',
    jackNeg: 'COM',
    dialPos: 'mA',
    cautions: [
      { text: 'Use mA jack if present — do not use the V/Ω jack for current measurement', level: 'danger' },
      { text: 'Meter in series — break circuit to insert', level: 'danger' },
      { text: 'mA fuse blows easily at low overload — start on highest range', level: 'warn' },
    ],
  },
  ms: {
    setting: 'Frequency / Time  Hz',
    range:   'Hz or timing mode',
    jackPos: 'V / VΩmA',
    jackNeg: 'COM',
    dialPos: 'Hz',
    cautions: [
      { text: 'Most field meters measure frequency (Hz), not delay time in ms — use oscilloscope for precise timing', level: 'warn' },
      { text: 'Apply to signal-level voltages only, not power lines', level: 'warn' },
    ],
  },
}

// Normalize unit strings to a config key
function meterConfigKey(unit: string): string {
  const u = unit.trim()
  if (/^v?ac$/i.test(u) || u === 'VAC') return 'VAC'
  if (/^v?dc$/i.test(u) || u === 'VDC' || u === 'V') return 'VDC'
  if (u === 'Ω' || u.toLowerCase() === 'ohm' || u.toLowerCase() === 'ohms') return 'Ω'
  if (u === 'A' || u.toLowerCase() === 'amp' || u.toLowerCase() === 'amps') return 'A'
  if (u.toLowerCase() === 'ma' || u.toLowerCase() === 'milliamp') return 'mA'
  if (u.toLowerCase() === 'ms' || u.toLowerCase() === 'hz') return 'ms'
  return 'VDC'  // default fallback
}

// Parse expected strings like "115±10", ">12", "0-24", "0", "12"
function parseMeasureExpected(expected: string): { min: number; max: number } | null {
  const s = expected.trim()
  // 115±10
  const pm = s.match(/^([+-]?\d+\.?\d*)\s*[±]\s*(\d+\.?\d*)$/)
  if (pm) { const c = parseFloat(pm[1]), d = parseFloat(pm[2]); return { min: c - d, max: c + d } }
  // 0-24 or 0–24
  const rng = s.match(/^([+-]?\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)$/)
  if (rng) return { min: parseFloat(rng[1]), max: parseFloat(rng[2]) }
  // >12 or ≥12
  const gt = s.match(/^([>≥])\s*=?\s*([+-]?\d+\.?\d*)$/)
  if (gt) { const v = parseFloat(gt[2]); return { min: gt[1] === '≥' ? v : v + 0.001, max: Infinity } }
  // <1 or ≤1
  const lt = s.match(/^([<≤])\s*=?\s*([+-]?\d+\.?\d*)$/)
  if (lt) { const v = parseFloat(lt[2]); return { min: -Infinity, max: lt[1] === '≤' ? v : v - 0.001 } }
  // plain number — ±10% tolerance, except 0 which uses ±0.5
  const num = s.match(/^([+-]?\d+\.?\d*)$/)
  if (num) { const v = parseFloat(num[1]); return v === 0 ? { min: -0.5, max: 0.5 } : { min: v * 0.9, max: v * 1.1 } }
  return null
}

function checkMeasureResult(input: string, expected: string): 'pass' | 'fail' | null {
  const val = parseFloat(input)
  if (isNaN(val)) return null
  const range = parseMeasureExpected(expected)
  if (!range) return null
  return (val >= range.min && val <= range.max) ? 'pass' : 'fail'
}

// ─── Meter Guide SVG ──────────────────────────────────────────────────────────
function MeterGuideSVG({ dialPos }: { dialPos: string }) {
  // Dial positions arranged in a semicircle (left to right)
  const positions = ['OFF', 'V~', 'V—', 'mA', 'A', 'Ω', 'Hz', 'DIODE']
  const cx = 88, cy = 116, r = 56
  const startAngle = Math.PI         // left (180°)
  const endAngle   = 0               // right (0°)
  const total      = positions.length - 1

  return (
    <svg viewBox="0 0 176 210" style={{ width: '100%', maxWidth: 200, display: 'block', margin: '0 auto' }}>
      {/* Meter body */}
      <rect x={4} y={4} width={168} height={202} rx={14} fill="#1E293B" />
      <rect x={8} y={8} width={160} height={194} rx={12} fill="#0F172A" stroke="#334155" strokeWidth={1} />

      {/* Display */}
      <rect x={18} y={16} width={140} height={42} rx={6} fill="#0D1117" stroke="#1E293B" strokeWidth={1} />
      <text x={88} y={34} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={9} fill="#475569" letterSpacing="0.12em">READING</text>
      <text x={88} y={51} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={14} fontWeight="bold" fill="#94A3B8" letterSpacing="0.08em">— — —</text>

      {/* Dial arc background */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1E293B" strokeWidth={18} strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#334155" strokeWidth={16} strokeLinecap="round" />

      {/* Dial position labels */}
      {positions.map((pos, i) => {
        const angle  = startAngle + (endAngle - startAngle) * (i / total)
        // offset inward from arc
        const pr  = r - 4
        const lx  = cx + pr * Math.cos(angle)
        const ly  = cy - pr * Math.sin(angle)
        const isActive = pos === dialPos
        return (
          <g key={pos}>
            {isActive && (
              <circle cx={lx} cy={ly} r={9} fill="#7C3AED" opacity={0.9} />
            )}
            <text
              x={lx} y={ly + 3.5}
              textAnchor="middle"
              fontFamily='"IBM Plex Mono",monospace'
              fontSize={isActive ? 7 : 6}
              fontWeight={isActive ? 'bold' : 'normal'}
              fill={isActive ? '#FFFFFF' : '#475569'}
            >
              {pos}
            </text>
          </g>
        )
      })}

      {/* Dial pointer needle */}
      {(() => {
        const idx    = positions.indexOf(dialPos)
        const i      = idx >= 0 ? idx : 0
        const angle  = startAngle + (endAngle - startAngle) * (i / total)
        const nx     = cx + (r - 18) * Math.cos(angle)
        const ny     = cy - (r - 18) * Math.sin(angle)
        return (
          <g>
            <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={4} fill="#334155" stroke="#7C3AED" strokeWidth={1.5} />
          </g>
        )
      })()}

      {/* Probe jack labels */}
      <rect x={18} y={152} width={64} height={24} rx={5} fill="#1E293B" stroke="#374151" strokeWidth={1} />
      <text x={50} y={162} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={7} fill="#64748B" letterSpacing="0.06em">COM</text>
      <text x={50} y={171} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={8} fontWeight="bold" fill="#94A3B8">−</text>
      <circle cx={50} cy={180} r={5} fill="#1E293B" stroke="#374151" strokeWidth={1.5} />

      <rect x={94} y={152} width={64} height={24} rx={5} fill="#1E293B" stroke="#374151" strokeWidth={1} />
      <text x={126} y={162} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={7} fill="#64748B" letterSpacing="0.06em">VΩmA</text>
      <text x={126} y={171} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={8} fontWeight="bold" fill="#EF4444">+</text>
      <circle cx={126} cy={180} r={5} fill="#1E293B" stroke="#EF4444" strokeWidth={1.5} />

      {/* Probe lines */}
      <line x1={50} y1={185} x2={50} y2={198} stroke="#64748B" strokeWidth={2} strokeLinecap="round" />
      <line x1={126} y1={185} x2={126} y2={198} stroke="#EF4444" strokeWidth={2} strokeLinecap="round" />
      <text x={50} y={207} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={6} fill="#475569">BLACK</text>
      <text x={126} y={207} textAnchor="middle" fontFamily='"IBM Plex Mono",monospace' fontSize={6} fill="#EF4444">RED</text>
    </svg>
  )
}

// ─── Connected device options — what else might be wired to this device?
const CONNECTED_OPTS: Record<string, string[]> = {
  'Gate Operator':   ['Photobeam', 'Safety Loop (under arm)', 'Exit Loop Detector', 'Safety Edge', 'Keypad', 'Callbox', 'UniFi Intercom', 'Access Reader', 'Battery Backup'],
  'Barrier Arm':     ['Photobeam', 'Safety Loop (under arm)', 'Exit Loop Detector', 'Keypad', 'Access Reader', 'Safety Edge'],
  'Callbox':         ['Gate Operator', 'Access Reader', 'Camera', 'Door Strike'],
  'Video Intercom':  ['Gate Operator', 'Brivo ACS300', 'Door Strike', 'Camera', 'PoE Switch'],
  'Access Control':  ['Gate Operator', 'REX Sensor', 'Mag Lock', 'Electric Strike', 'Keypad', 'UniFi Intercom', 'Photobeam', 'Loop Detector'],
  'Access Controller':['Gate Operator', 'REX Sensor', 'Mag Lock', 'Electric Strike', 'Keypad', 'UniFi Intercom', 'Photobeam', 'Loop Detector'],
  'Camera':          ['NVR/DVR', 'PoE Switch', 'Access Control'],
  'Intercom':        ['Gate Operator', 'Door Strike', 'Camera'],
}
const DEFAULT_CONNECTED_OPTS = ['Photobeam', 'Safety Loop (under arm)', 'Exit Loop Detector', 'Keypad', 'Callbox', 'UniFi Intercom', 'Brivo ACS300', 'Access Reader', 'Gate Operator']

// Quick-pick faults per device category
const QUICK_PICKS: Record<string, string[]> = {
  'Gate Operator':  ["WON'T OPEN", "WON'T CLOSE", "NO POWER", "MOTOR HUMS", "ARM STUCK", "LOOP FAULT", "LIMIT FAULT", "NO COMM", "OBSTRUCTION", "BATTERY LOW"],
  'Barrier Arm':    ["WON'T OPEN", "WON'T CLOSE", "NO POWER", "ARM STUCK", "LOOP FAULT", "SPRING FAIL", "NO COMM"],
  'Access Control': ["WON'T UNLOCK", "ACCESS DENIED", "READER OFFLINE", "NO POWER", "LED FAULT", "COMM ERROR", "CREDENTIAL FAIL"],
  'Camera':         ["NO IMAGE", "OFFLINE", "POOR IMAGE", "IR FAULT", "RECORDING FAIL", "NO POWER", "WRONG ANGLE"],
  'Callbox':        ["NO AUDIO", "NO VIDEO", "WON'T CALL", "NO POWER", "DOOR WON'T UNLOCK", "KEYPAD FAIL", "OFFLINE"],
  'Intercom':        ["NO AUDIO", "NO VIDEO", "NO POWER", "WON'T CONNECT", "POOR QUALITY"],
  'Video Intercom':  ["NO AUDIO", "NO VIDEO", "NO POWER", "WON'T CALL", "RELAY NOT FIRING", "OFFLINE", "APP NOT RECEIVING", "POOR QUALITY", "DOOR WON'T OPEN"],
  'Safety Device':   ["CONSTANT STOP FAULT", "BEAM MISALIGNED", "NO POWER", "FALSE TRIGGERS", "INTERMITTENT FAULT", "LOOP FAULT", "DETECTOR OFFLINE"],
}
const DEFAULT_PICKS = ["NO POWER", "WON'T RESPOND", "COMM ERROR", "FAULT CODE", "INTERMITTENT", "NO COMM"]

const MONO = '"IBM Plex Mono", "SFMono-Regular", "Consolas", monospace'
const SANS = '"IBM Plex Sans", -apple-system, system-ui, sans-serif'

function pad2(n: number) { return String(n).padStart(2, '0') }

// ─── Demo: Install Commissioning Phases ───────────────────────────────────────
interface InstallStep {
  id:           string
  text:         string
  detail?:      string
  type:         'check' | 'wire' | 'test'
  wiringMapId?: string   // if set, shows "📐 VIEW WIRING" button
}
interface InstallPhase {
  id:    string
  title: string
  icon:  string
  color: string
  steps: InstallStep[]
}

const DEMO_SYSTEM_DEVICES = [
  { label: 'G3 Intercom',       sku: 'UA-G3-Intercom',    color: '#6B7EFF' },
  { label: 'Access Hub Mini',   sku: 'UA-Hub-Door-Mini',  color: '#7C3AED' },
  { label: 'Brivo ACS300',      sku: 'ACS300',            color: '#0EA5E9' },
  { label: 'DoorKing 6050 ×2',  sku: 'DK-6050',           color: '#059669' },
  { label: 'Photobeam',         sku: 'SAFETY-BEAM',       color: '#D97706' },
  { label: 'Safety Loops ×2',   sku: 'LOOP-DET',          color: '#E11D48' },
]

const INSTALL_PHASES: InstallPhase[] = [
  {
    id: 'preinstall', title: 'PRE-INSTALL CHECKLIST', icon: '📋', color: '#0EA5E9',
    steps: [
      { id: 'pi-1', type: 'check', text: 'All devices on-site: G3 Intercom, Hub Mini, Brivo ACS300, (2) DK6050 operators' },
      { id: 'pi-2', type: 'check', text: 'DK6050 units pre-programmed — open/close limits set, relay output configured' },
      { id: 'pi-3', type: 'check', text: 'Brivo ACS300 pre-provisioned in portal with door assignments for this property' },
      { id: 'pi-4', type: 'check', text: 'G3 Intercom claimed in UniFi Protect — relay output mode enabled in settings' },
      { id: 'pi-5', type: 'check', text: 'Network ready: PoE switch ports available, VLAN configured for access control' },
      { id: 'pi-6', type: 'check', text: 'Power confirmed: 110VAC to gate operators, PoE to intercom and hub mini' },
    ],
  },
  {
    id: 'mount', title: 'MOUNT & POWER UP', icon: '🔩', color: '#D97706',
    steps: [
      { id: 'mp-1', type: 'check', text: 'Mount G3 Intercom at gate entry column — eye level, camera aimed for face capture', detail: 'Run CAT6 from nearby PoE switch. Weatherproof enclosure required.' },
      { id: 'mp-2', type: 'check', text: 'Mount Access Door Hub Mini inside gate control box — rail or surface mount', detail: 'Position near ACS300 for short Wiegand run (<150 ft). Needs PoE.' },
      { id: 'mp-3', type: 'check', text: 'Mount Brivo ACS300 in control cabinet — secure, ventilated, near hub mini', detail: '12VDC power supply or PoE. CAT6 to PoE switch.' },
      { id: 'mp-4', type: 'check', text: 'Power up both DK6050 operators — verify loop indicators are solid (no fault)' },
      { id: 'mp-5', type: 'check', text: 'Confirm PoE LED solid green on G3 Intercom and Hub Mini in UniFi dashboard' },
    ],
  },
  {
    id: 'wiring', title: 'WIRE CONNECTIONS', icon: '⚡', color: '#7C3AED',
    steps: [
      { id: 'w-1', type: 'wire', text: 'G3 Intercom → DK6050 Gate 1 — visitor call release relay',    wiringMapId: 'unifi_intercom_to_dk6050',    detail: '18AWG dry contact: Relay NO → DK6050 OPEN, Relay COM → DK6050 COM' },
      { id: 'w-2', type: 'wire', text: 'Brivo ACS300 Relay 1 → DK6050 Gate 1 — access control output', wiringMapId: 'acs300_to_dk6050',             detail: 'ACS300 Relay 1 NO → DK6050 OPEN. 18AWG, max 30VDC 1A.' },
      { id: 'w-3', type: 'wire', text: 'Brivo ACS300 Relay 2 → DK6050 Gate 2 — dual gate second relay',wiringMapId: 'acs300_to_dk6050_door2',        detail: 'ACS300 Relay 2 NO → Gate 2 DK6050 OPEN. Same gauge, separate run.' },
      { id: 'w-4', type: 'wire', text: 'Photobeam → DK6050 STOP input — safety, stops gate on beam break', wiringMapId: 'photobeam_to_dk6050_stop', detail: 'N.C. output to STOP terminal. Align beam before final commissioning.' },
      { id: 'w-5', type: 'wire', text: 'Exit loop detector → DK6050 FE input — free exit on vehicle detection', wiringMapId: 'loop_det_to_dk6050_fe', detail: 'N.O. output to FE (Free Exit). Loop must be in clear field, no metal.' },
      { id: 'w-6', type: 'wire', text: 'Safety loop (under arm) → DK6050 STOP — detects vehicle under gate arm', wiringMapId: 'loop_det_to_dk6050_stop', detail: 'N.C. output to STOP. Inductive loop in pavement directly under arm.' },
    ],
  },
  {
    id: 'test', title: 'VERIFY & TEST', icon: '✅', color: '#059669',
    steps: [
      { id: 't-1', type: 'test', text: 'Brivo portal: test credential — access event triggers Gate 1 relay, arm opens' },
      { id: 't-2', type: 'test', text: 'G3 Intercom: place call, answer on Protect app, tap Unlock — gate arm opens' },
      { id: 't-3', type: 'test', text: 'Photobeam safety: block beam while gate closing — arm stops immediately' },
      { id: 't-4', type: 'test', text: 'Exit loop: drive through zone — gate opens without credential, arm fully clears' },
      { id: 't-5', type: 'test', text: 'Safety arm loop: trigger manually while arm closing — arm reverses, does not close' },
    ],
  },
  {
    id: 'signoff', title: 'SIGN OFF', icon: '🏁', color: '#6B7EFF',
    steps: [
      { id: 'so-1', type: 'check', text: 'Record all serial numbers and firmware versions in work order notes' },
      { id: 'so-2', type: 'check', text: 'Photograph each device, each wiring connection, and full system overview' },
      { id: 'so-3', type: 'check', text: 'Mark work order complete in GateGuard portal — commissioning record saved' },
    ],
  },
]
function shortSession(id: string | null) {
  if (!id) return '——'
  return '#' + id.replace(/-/g, '').slice(-4).toUpperCase()
}

// ─── Main component ───────────────────────────────────────────────────────────
function TechTool() {
  const params   = useSearchParams()
  const presetId = params.get('product_id') ?? undefined
  const demoParam = params.get('demo') ?? null

  // Core state
  const [screen,    setScreen]    = useState<Screen>('pin')
  const [techCode,  setTechCode]  = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [products,  setProducts]  = useState<Product[]>([])
  const [search,    setSearch]    = useState('')
  const [activeCat, setActiveCat] = useState('ALL')
  const [selected,  setSelected]  = useState<Product | null>(null)

  // Symptom state
  const [symptom,          setSymptom]          = useState('')
  const [errorCode,        setErrorCode]        = useState('')
  const [connectedDevices, setConnectedDevices] = useState<string[]>([])

  // Diagnostic state
  const [history,   setHistory]   = useState<HistoryItem[]>([])
  const [current,   setCurrent]   = useState<Step | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [loadingStage, setLoadingStage] = useState<'searching' | 'generating' | 'slow' | null>(null)
  const [diagError,    setDiagError]    = useState<string | null>(null)
  const [lastHistory,  setLastHistory]  = useState<HistoryItem[]>([])  // for retry
  const [freeText,  setFreeText]  = useState('')
  const [logFixed,  setLogFixed]  = useState(false)

  // Measure step state
  const [measureInput,    setMeasureInput]    = useState('')
  const [showMeterGuide,  setShowMeterGuide]  = useState(false)

  // Resolution capture state
  const [resolutionConfirmed,  setResolutionConfirmed]  = useState<'yes' | 'no' | null>(null)
  const [resolutionNote,       setResolutionNote]       = useState('')
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false)
  const [resolutionSaved,      setResolutionSaved]      = useState(false)

  // Photo step state
  const [photoData,     setPhotoData]     = useState<string | null>(null)
  const [photoAnalysis, setPhotoAnalysis] = useState<string | null>(null)
  const [analyzing,     setAnalyzing]     = useState(false)

  // Survey state
  const [surveyDevices,   setSurveyDevices]   = useState<SurveyDevice[]>([])
  const [surveyPropName,  setSurveyPropName]  = useState('')
  const [editingDevice,   setEditingDevice]   = useState<SurveyDevice | null>(null)
  const [surveyProposal,  setSurveyProposal]  = useState<SurveyProposal | null>(null)
  const [surveyLoading,   setSurveyLoading]   = useState(false)
  const [savedSurveyId,   setSavedSurveyId]   = useState<string | null>(null)
  const [savingToPortal,  setSavingToPortal]  = useState(false)
  const [activeCourse,    setActiveCourse]    = useState<string | null>(null)
  // Fields for survey_add form
  const [sdName,      setSdName]      = useState('')
  const [sdBrand,     setSdBrand]     = useState('')
  const [sdModel,     setSdModel]     = useState('')
  const [sdLocation,  setSdLocation]  = useState('')
  const [sdCondition, setSdCondition] = useState<SurveyDevice['condition']>('good')
  const [sdAction,    setSdAction]    = useState<SurveyDevice['action']>('keep')
  const [sdNotes,     setSdNotes]     = useState('')

  // Voice transcript state
  const [transcriptText,       setTranscriptText]       = useState('')
  const [transcriptParsing,    setTranscriptParsing]    = useState(false)
  const [transcriptError,      setTranscriptError]      = useState<string | null>(null)
  const [parsedDevices,        setParsedDevices]        = useState<SurveyDevice[]>([])
  const [parsedSelected,       setParsedSelected]       = useState<Set<string>>(new Set())
  const [parsedPropertyName,   setParsedPropertyName]   = useState<string | null>(null)
  // Plaud audio upload state
  const [plaudUploading,       setPlaudUploading]       = useState(false)
  const [plaudStatus,          setPlaudStatus]          = useState<string | null>(null)
  const plaudFileRef = useRef<HTMLInputElement>(null)

  // NETSCOUT state
  const [netscoutRunning,  setNetscoutRunning]  = useState(false)
  const [netscoutData,     setNetscoutData]     = useState<{
    timestamp: string
    probes: Array<{ label: string; url: string; status: 'ok' | 'slow' | 'fail'; latency_ms: number | null; http_code?: number; error?: string }>
    unifi_clients: Array<{ mac: string; hostname: string | null; name: string | null; ip: string | null; is_wired: boolean; rssi?: number | null; signal?: number | null; essid?: string | null }>
    unifi_error: string | null
    unifi_count: number
  } | null>(null)
  const [netscoutError,    setNetscoutError]    = useState<string | null>(null)

  // GPS / identity state
  const [techId,     setTechId]     = useState<string | null>(null)
  const [techName,   setTechName]   = useState<string | null>(null)
  // My Jobs (work orders assigned to this tech)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [myJobs,     setMyJobs]     = useState<any[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [openJob,    setOpenJob]    = useState<any>(null)
  const [jobHours,   setJobHours]   = useState('')
  const [allTechs,   setAllTechs]   = useState<{ id: string; name: string; initials: string }[]>([])
  const [gpsGranted, setGpsGranted] = useState(false)

  // Demo / install mode state
  const [prevScreen,      setPrevScreen]     = useState<Screen | null>(null)
  const [wiringInitMapId, setWiringInitMapId] = useState<string | null>(null)
  const [installChecked,  setInstallChecked]  = useState<Set<string>>(new Set())
  const [expandedPhases,  setExpandedPhases]  = useState<Set<string>>(new Set<string>(['preinstall']))

  const bottomRef   = useRef<HTMLDivElement>(null)
  const photoRef    = useRef<HTMLInputElement>(null)

  // ── On mount: check sessionStorage for saved code + restore identity ────────
  useEffect(() => {
    const saved = sessionStorage.getItem('gg_tech_code')
    if (saved) { setTechCode(saved); setScreen('home') }
    const savedTechId   = localStorage.getItem('gg_tech_id')
    const savedTechName = localStorage.getItem('gg_tech_name')
    if (savedTechId && savedTechName) {
      setTechId(savedTechId)
      setTechName(savedTechName)
    }
  }, [])

  // ── Demo mode: install flow bypasses PIN (no API calls needed) ────────────
  useEffect(() => {
    if (demoParam === 'install') setScreen('install')
  }, [demoParam])

  // ── Demo mode: fault scenario — auto-populate after products load ─────────
  useEffect(() => {
    if (demoParam !== 'fault') return
    if (!techCode || products.length === 0 || screen !== 'home') return
    const target = products.find(p =>
      p.sku?.toLowerCase().includes('acs300') ||
      p.brand?.toLowerCase().includes('brivo')
    ) ?? products.find(p => p.category?.toLowerCase().includes('access')) ?? products[0]
    if (!target) return
    setSelected(target)
    setSymptom("Gate arm stays down — Brivo ACS300 grants access but DK6050 gate operator does not respond. Mobile app shows 'Access Granted' event. Both fob credentials and app unlock fail to open gate. ACS300 relay LED cycles on access attempt.")
    setConnectedDevices(['UniFi Intercom', 'Safety Loop (under arm)', 'Exit Loop Detector', 'Photobeam'])
    setScreen('symptom')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoParam, techCode, products.length, screen])

  // ── Load products once authenticated ──────────────────────────────────────
  useEffect(() => {
    if (!techCode) return
    fetch('/api/kb/products', { headers: { 'x-tech-code': techCode } })
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
  }, [techCode])

  // ── Auto-select from URL param ────────────────────────────────────────────
  useEffect(() => {
    if (presetId && products.length > 0) {
      const p = products.find(p => p.id === presetId || p.sku === presetId)
      if (p) { setSelected(p); setScreen('choice') }
    }
  }, [presetId, products])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, current, loading])

  // ── GPS: ping every 10 minutes while tool is open and tech is identified ──
  useEffect(() => {
    if (!techId) return
    pingGPS('ping')
    const interval = setInterval(() => pingGPS('ping'), 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [techId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ──────────────────────────────────────────────────────────────────
  function apiHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json', 'x-tech-code': techCode }
  }

  // ── My Jobs (work orders assigned to this tech) ─────────────────────────────
  function loadMyJobs() {
    setJobsLoading(true)
    const url = techId ? `/api/tech/work-orders?tech_id=${techId}` : '/api/tech/work-orders'
    fetch(url, { headers: apiHeaders() })
      .then(r => r.json())
      .then(d => setMyJobs(d.work_orders ?? []))
      .catch(() => {})
      .finally(() => setJobsLoading(false))
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function refreshOpenJob(woId: string, base?: any) {
    const [d, ph] = await Promise.all([
      fetch(`/api/maintenance/${woId}`, { headers: apiHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`/api/maintenance/${woId}/photos`, { headers: apiHeaders() }).then(r => r.json()).catch(() => null),
    ])
    setOpenJob({ ...(base ?? openJob), _checklist: d?.checklist ?? [], _description: d?.work_order?.description ?? base?.description, _photos: ph?.photos ?? [], status: d?.work_order?.status ?? base?.status })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function toggleJobStep(woId: string, item: any) {
    const next = !(item.is_complete || item.completed)
    await fetch(`/api/maintenance/${woId}/checklist`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ item_id: item.id, is_complete: next }) }).catch(() => {})
    refreshOpenJob(woId)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function openJobDetail(job: any) { refreshOpenJob(job.id, job) }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function setJobStatus(woId: string, status: string) {
    await fetch(`/api/maintenance/${woId}`, { method: 'PATCH', headers: apiHeaders(), body: JSON.stringify({ status }) }).catch(() => {})
    refreshOpenJob(woId); loadMyJobs()
  }
  async function uploadJobPhoto(woId: string, file: File) {
    if (!file) return
    try {
      const up = await fetch(`/api/maintenance/${woId}/photo-upload-url`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ filename: file.name }) }).then(r => r.json())
      if (up?.signedUrl) {
        await fetch(up.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file })
        await fetch(`/api/maintenance/${woId}/photos`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ file_url: up.publicUrl, caption: file.name, technician_name: techName }) }).catch(() => {})
      }
    } catch (_) { /* ignore */ }
    refreshOpenJob(woId)
  }
  async function logJobHours(woId: string, hours: number) {
    if (!hours || hours <= 0) return
    await fetch(`/api/maintenance/${woId}/time`, { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ hours, technician_name: techName }) }).catch(() => {})
    refreshOpenJob(woId)
  }

  // ── GPS ping helper — fire-and-forget, never blocks UI ───────────────────
  function pingGPS(eventType: string = 'ping', workOrderId?: string) {
    if (!techId || !gpsGranted || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`/api/dispatch/technicians/${techId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tech-code': techCode },
          body: JSON.stringify({
            lat:          pos.coords.latitude,
            lng:          pos.coords.longitude,
            accuracy_m:   pos.coords.accuracy,
            event_type:   eventType,
            work_order_id: workOrderId ?? null,
          }),
        }).catch(() => {}) // fire and forget, never block UI
      },
      () => {}, // ignore errors silently
      { timeout: 8000, maximumAge: 60000 }
    )
  }

  async function submitCode() {
    setCodeError(false)
    const code = codeInput.trim().toUpperCase()
    if (!code) { setCodeError(true); return }
    const res = await fetch('/api/kb/products', { headers: { 'x-tech-code': code } })
    if (res.ok) {
      const data = await res.json()
      sessionStorage.setItem('gg_tech_code', code)
      setTechCode(code); setProducts(data.products ?? [])
      const savedTechId = localStorage.getItem('gg_tech_id')
      if (savedTechId) {
        setScreen('home')
      } else {
        // Fetch tech list and go to identity screen
        fetch('/api/tech/identity', { headers: { 'x-tech-code': code } })
          .then(r => r.json())
          .then(d => { setAllTechs(d.technicians ?? []); setScreen('identity') })
          .catch(() => setScreen('home')) // graceful fallback
      }
    } else if (res.status === 401) {
      setCodeError(true); setCodeInput('')
    } else {
      setCodeError(true); setCodeInput('')   // show in-app error instead of a native alert
    }
  }

  // ── Diagnostic helpers ────────────────────────────────────────────────────
  async function startDiag() {
    if (!symptom.trim()) return
    setDiagError(null)
    pingGPS('job_start')
    setScreen('diag'); await fetchStep([])
  }

  async function fetchStep(h: HistoryItem[]) {
    setLoading(true)
    setLoadingStage('searching')
    setDiagError(null)
    setCurrent(null)
    setLastHistory(h)

    // Show "generating" after 4s, then "slow connection" after 15s
    const stageTimer  = setTimeout(() => setLoadingStage('generating'), 4000)
    const slowTimer   = setTimeout(() => setLoadingStage('slow'),       15000)

    // Abort after 20s — surface a clean retry instead of infinite spinner
    const controller = new AbortController()
    const abortTimer = setTimeout(() => controller.abort(), 55000)  // 55s — server maxDuration is 60s

    try {
      const res = await fetch('/api/kb/ask', {
        method: 'POST',
        headers: apiHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          symptom, error_code: errorCode || undefined,
          product_id: selected?.id, history: h, session_id: sessionId,
          connected_devices: connectedDevices,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!sessionId && data.session_id) setSessionId(data.session_id)
      setCurrent(data as Step)
    } catch (err: any) {
      const msg = err.name === 'AbortError'
        ? 'Request timed out — tap RETRY to try again'
        : (err.message || 'Network error')
      setDiagError(msg)
    } finally {
      clearTimeout(stageTimer)
      clearTimeout(slowTimer)
      clearTimeout(abortTimer)
      setLoading(false)
      setLoadingStage(null)
    }
  }

  async function answer(ans: string) {
    if (!current) return
    const newH: HistoryItem[] = [...history, { question: current.text, answer: ans }]
    setHistory(newH)
    setCurrent(null)
    setMeasureInput('')
    setShowMeterGuide(false)
    setPhotoData(null); setPhotoAnalysis(null)
    setResolutionConfirmed(null); setResolutionNote('')
    if (current.type === 'resolved' || current.type === 'escalate') return
    await fetchStep(newH)
  }

  // ── Resolution submission ──────────────────────────────────────────────────
  async function submitResolution() {
    if (!resolutionNote.trim()) return
    setResolutionSubmitting(true)
    try {
      await fetch('/api/kb/resolve', {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({
          session_id:      sessionId,
          product_id:      selected?.id,
          symptom,
          history,
          resolution_note: resolutionNote.trim(),
        }),
      })
      setResolutionSaved(true)
    } catch {
      // Silently fail — don't block the tech from moving on
      setResolutionSaved(true)
    } finally {
      setResolutionSubmitting(false)
    }
  }

  // ── Photo capture ─────────────────────────────────────────────────────────
  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      // Strip data URL prefix to get raw base64
      const base64 = dataUrl.split(',')[1]
      setPhotoData(dataUrl)
      setAnalyzing(true)

      try {
        const res = await fetch('/api/kb/analyze-image', {
          method: 'POST', headers: apiHeaders(),
          body: JSON.stringify({
            image:   base64,
            context: `Device: ${selected?.name} (${selected?.sku}). Problem: ${symptom}. Current diagnostic step: ${current?.text}`,
          }),
        })
        const data = await res.json()
        setPhotoAnalysis(data.analysis ?? 'Unable to analyze image.')
      } catch {
        setPhotoAnalysis('Image captured — unable to analyze automatically.')
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function reset() {
    setScreen('home'); setSelected(null); setSymptom(''); setErrorCode('')
    setConnectedDevices([])
    setHistory([]); setCurrent(null); setSessionId(null)
    setFreeText(''); setLogFixed(false); setMeasureInput('')
    setPhotoData(null); setPhotoAnalysis(null)
    setPrevScreen(null); setWiringInitMapId(null)
    setResolutionConfirmed(null); setResolutionNote(''); setResolutionSubmitting(false); setResolutionSaved(false)
    setDiagError(null); setLastHistory([]); setLoadingStage(null)
  }

  const stepCount  = history.length + (current ? 1 : 0)
  const cfg        = current ? STEP_CFG[current.type] : null
  const isTerminal = current?.type === 'resolved' || current?.type === 'escalate'

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: PIN
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'pin') {
    return (
      <div style={{ ...S.shell, justifyContent: 'center', alignItems: 'center' }}>
        <div style={S.pinCard} className="gg-fade-in">
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ ...S.pinLogo, padding: 16, background: 'rgba(255,255,255,0.06)' }} className="gg-pin-logo"><img src="/logo.png" alt="GateGuard" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.2em', color: C.textMuted, marginTop: 10 }}>
              GATEGUARD FIELD TOOL
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, marginBottom: 8 }}>
            ACCESS CODE
          </div>
          <input
            type="text" value={codeInput} autoFocus autoCapitalize="characters" maxLength={16}
            onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(false) }}
            onKeyDown={e => e.key === 'Enter' && submitCode()}
            placeholder="ENTER CODE"
            style={{
              ...S.monoInput, fontSize: 18, letterSpacing: '0.22em', textAlign: 'center',
              borderColor: codeError ? C.red : C.borderMed,
              color: codeError ? C.red : C.textPrimary,
            }}
          />
          {codeError && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.red, letterSpacing: '0.1em', marginTop: 8, textAlign: 'center' }}>
              INVALID CODE — CONTACT YOUR DEALER
            </div>
          )}
          <button
            onClick={submitCode}
            style={{ ...S.primaryBtn, marginTop: 16 }}
          >
            AUTHENTICATE ›
          </button>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, textAlign: 'center', marginTop: 20, letterSpacing: '0.1em' }}>
            CODE PROVIDED BY YOUR GATEGUARD DEALER
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: IDENTITY — tech self-identification for GPS tracking
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'identity') {
    return (
      <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <div style={{ fontSize: 28 }}>👋</div>
        <div style={{ color: C.textPrimary, fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.04em' }}>WHO ARE YOU?</div>
        <div style={{ color: C.textSecondary, fontSize: 13, textAlign: 'center', fontFamily: 'IBM Plex Sans, system-ui, sans-serif', lineHeight: 1.5 }}>Select your name so dispatch can track your location</div>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allTechs.map(t => (
            <button
              key={t.id}
              onClick={() => {
                localStorage.setItem('gg_tech_id', t.id)
                localStorage.setItem('gg_tech_name', t.name)
                setTechId(t.id)
                setTechName(t.name)
                setScreen('home')
                // Request GPS permission immediately on selection
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => {
                      setGpsGranted(true)
                      fetch(`/api/dispatch/technicians/${t.id}/location`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-tech-code': techCode },
                        body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy_m: pos.coords.accuracy, event_type: 'ping' }),
                      }).catch(() => {})
                    },
                    () => setGpsGranted(false),
                    { timeout: 10000 }
                  )
                }
              }}
              style={{ background: C.bgCard, border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: '16px 18px', color: C.textPrimary, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', fontFamily: 'IBM Plex Sans, system-ui, sans-serif', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
            >
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6B7EFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace' }}>
                {t.initials}
              </div>
              <span>{t.name}</span>
            </button>
          ))}
          {allTechs.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', padding: 16, fontFamily: 'IBM Plex Sans, system-ui, sans-serif' }}>No techs found — contact your admin</div>
          )}
        </div>
        <button
          onClick={() => setScreen('home')}
          style={{ marginTop: 8, color: C.textMuted, fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '0.08em' }}
        >
          Skip for now
        </button>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: MY JOBS — work orders dispatched to this tech
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'jobs') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checklist = (openJob?._checklist ?? []) as any[]
    const doneCount = checklist.filter((c) => c.is_complete || c.completed).length
    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => { openJob ? setOpenJob(null) : setScreen('home') }}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>{openJob ? (openJob.wo_number || 'WORK ORDER') : 'MY JOBS'}</div>
            <div style={S.topBarSub}>{openJob ? (openJob.site_name || openJob.customer_name || '') : (techName || 'DISPATCHED TO YOU')}</div>
          </div>
          {!openJob && <button style={S.iconBtn} onClick={loadMyJobs}>↻</button>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {/* LIST */}
          {!openJob && (jobsLoading ? (
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.textMuted }}>Loading your jobs…</div>
          ) : myJobs.length === 0 ? (
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.textMuted }}>No jobs assigned to you right now.</div>
          ) : myJobs.map((j) => (
            <div key={j.id} onClick={() => openJobDetail(j)} style={{ background: C.bgCard, borderRadius: 14, border: `1px solid ${C.border}`, padding: 14, marginBottom: 12, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{j.title || j.wo_number || 'Work Order'}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.blue }}>{j.status}</span>
              </div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>{j.site_name || j.customer_name || '—'}{j.scheduled_date ? ` · ${String(j.scheduled_date).slice(0, 10)}` : ''}</div>
              {j.site_address && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>📍 {j.site_address}</div>}
              {j.checklist_total > 0 && <div style={{ fontFamily: MONO, fontSize: 9, color: C.green, marginTop: 6 }}>✓ {j.checklist_done}/{j.checklist_total} steps</div>}
            </div>
          )))}

          {/* DETAIL */}
          {openJob && (
            <>
              {openJob.site_access_notes && (
                <div style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.1em' }}>🔑 ACCESS / GATE NOTES</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{openJob.site_access_notes}</div>
                </div>
              )}
              {(openJob.site_contact_name || openJob.site_contact_phone) && (
                <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>ON-SITE CONTACT</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>{openJob.site_contact_name || '—'}{openJob.site_contact_phone ? <a href={`tel:${openJob.site_contact_phone}`} style={{ color: C.blue, marginLeft: 8 }}>{openJob.site_contact_phone}</a> : ''}</div>
                </div>
              )}
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>WORK TO PERFORM</div>
                <div style={{ fontSize: 13, marginTop: 4, whiteSpace: 'pre-wrap' }}>{openJob._description || 'No description provided.'}</div>
              </div>
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>STEPS</span>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.green }}>{doneCount}/{checklist.length}</span>
                </div>
                {checklist.length === 0 ? <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>No steps yet.</div> : checklist.map((c) => {
                  const done = c.is_complete || c.completed
                  return (
                    <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 0', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!done} onChange={() => toggleJobStep(openJob.id, c)} />
                      <span style={{ fontSize: 13, textDecoration: done ? 'line-through' : 'none', color: done ? C.textMuted : C.textPrimary }}>{c.title || c.label}</span>
                    </label>
                  )
                })}
              </div>

              {/* Photos (proof) */}
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em' }}>PHOTOS ({(openJob._photos ?? []).length})</span>
                  <label style={{ fontFamily: MONO, fontSize: 9, color: C.blue, cursor: 'pointer' }}>+ ADD PHOTO
                    <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadJobPhoto(openJob.id, f); e.target.value = '' }} />
                  </label>
                </div>
                {(openJob._photos ?? []).length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px,1fr))', gap: 6, marginTop: 8 }}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(openJob._photos ?? []).map((p: any, i: number) => <img key={p.id || i} src={p.file_url || p.url} alt="" style={{ width: '100%', height: 60, objectFit: 'cover', borderRadius: 8 }} />)}
                  </div>
                )}
              </div>

              {/* Log hours */}
              <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', flex: 1 }}>LOG LABOR</span>
                <input type="number" step="0.25" placeholder="hrs" value={jobHours} onChange={e => setJobHours(e.target.value)} style={{ width: 70, background: '#0a1322', border: `1px solid ${C.border}`, borderRadius: 8, color: C.textPrimary, padding: 8, fontSize: 13 }} />
                <button onClick={() => { logJobHours(openJob.id, Number(jobHours)); setJobHours('') }} disabled={!jobHours} style={{ padding: '8px 14px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', fontFamily: MONO, fontSize: 10, fontWeight: 700, cursor: jobHours ? 'pointer' : 'not-allowed', opacity: jobHours ? 1 : 0.5 }}>LOG</button>
              </div>

              <button onClick={() => { setSymptom(openJob.title || ''); setConnectedDevices([]); setScreen('symptom') }} style={{ width: '100%', padding: 14, borderRadius: 12, background: 'rgba(0,200,255,0.12)', border: '1px solid rgba(0,200,255,0.34)', color: '#7dd3fc', fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.06em', marginBottom: 12 }}>🤖 GET AI TECH SUPPORT</button>

              {/* Mark complete — proof gated */}
              {(() => {
                const allDone = checklist.length > 0 && doneCount === checklist.length
                const hasPhoto = (openJob._photos ?? []).length > 0
                const can = allDone && hasPhoto
                const isDone = ['completed', 'complete', 'done'].includes(String(openJob.status || '').toLowerCase())
                if (isDone) return <div style={{ textAlign: 'center', fontFamily: MONO, fontSize: 11, color: C.green, padding: 10 }}>✓ JOB COMPLETE</div>
                return (
                  <>
                    <button onClick={() => can && setJobStatus(openJob.id, 'completed')} disabled={!can} style={{ width: '100%', padding: 14, borderRadius: 12, background: can ? C.green : 'rgba(255,255,255,0.06)', color: can ? '#06120c' : C.textMuted, border: 'none', fontFamily: MONO, fontSize: 12, fontWeight: 800, cursor: can ? 'pointer' : 'not-allowed', letterSpacing: '0.06em' }}>✓ COMPLETE JOB</button>
                    {!can && <div style={{ textAlign: 'center', fontSize: 11, color: C.amber, marginTop: 6 }}>🔒 {!allDone ? (checklist.length === 0 ? 'Add & finish steps first' : `Finish all steps (${doneCount}/${checklist.length})`) : 'Add at least one photo'}</div>}
                  </>
                )
              })()}
            </>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: HOME — device picker
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'home') {
    const EXCLUDE = ['wire', 'hardware', 'cable', 'conduit', 'connector', 'supply']
    const serviceProds = products.filter(p =>
      !EXCLUDE.some(x => p.category.toLowerCase().includes(x))
    )
    const cats    = ['ALL', ...Array.from(new Set(serviceProds.map(p => p.category || 'Other'))).sort()]
    const q       = search.toLowerCase()
    const visible = serviceProds.filter(p => {
      const matchCat    = activeCat === 'ALL' || p.category === activeCat
      const matchSearch = !q || p.name.toLowerCase().includes(q) ||
                          p.brand.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      return matchCat && matchSearch
    })

    const brandInitials = (b: string) => b.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const PALETTE = ['#6B7EFF','#7C3AED','#059669','#D97706','#E11D48','#0EA5E9']
    const brandHues: Record<string, string> = {}
    serviceProds.forEach(p => {
      if (!brandHues[p.brand]) brandHues[p.brand] = PALETTE[Object.keys(brandHues).length % PALETTE.length]
    })

    return (
      <div style={S.shell}>
        <style>{`.gg-chips::-webkit-scrollbar,.gg-list::-webkit-scrollbar{display:none}`}</style>
        <div style={S.topBar}>
          <div style={{ ...S.ggMark, padding: 6, background: 'rgba(255,255,255,0.06)' }}><img src="/logo.png" alt="GateGuard" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>GATEGUARD FIELD TOOL</div>
            <div style={S.topBarSub}>SELECT DEVICE</div>
          </div>
          {techName ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'IBM Plex Mono, monospace', fontSize: 9, color: C.textOnDark, letterSpacing: '0.08em' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: gpsGranted ? C.green : C.amber, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{techName.split(' ')[0].toUpperCase()}</span>
              </div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, color: 'rgba(160,190,255,0.5)', letterSpacing: '0.06em' }}>
                {gpsGranted ? '📍 GPS ON' : '📍 GPS —'}
              </div>
              <a href="/" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, color: 'rgba(160,190,255,0.45)', letterSpacing: '0.06em', textDecoration: 'none', marginTop: 1 }}>
                ← PORTAL
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={S.statusPill}>● ONLINE</div>
              <a href="/" style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 8, color: 'rgba(160,190,255,0.45)', letterSpacing: '0.06em', textDecoration: 'none' }}>
                ← PORTAL
              </a>
            </div>
          )}
        </div>

        {/* Search bar */}
        <div style={{ padding: '10px 12px 0' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 17, pointerEvents: 'none', lineHeight: 1 }}>⌕</span>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, brand, or SKU…"
              style={{ width: '100%', boxSizing: 'border-box', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 14, padding: '15px 14px 15px 44px', fontFamily: SANS, fontSize: 15, color: C.textPrimary, outline: 'none', WebkitAppearance: 'none', WebkitTextFillColor: C.textPrimary, boxShadow: '0 2px 16px rgba(0,0,0,0.30)' }}
            />
          </div>
        </div>

        {/* Category filter chips */}
        {cats.length > 2 && (
          <div className="gg-chips" style={{ display: 'flex', gap: 6, padding: '8px 12px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' } as React.CSSProperties}>
            {cats.map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)} style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                padding: '7px 13px', borderRadius: 20, whiteSpace: 'nowrap',
                cursor: 'pointer', flexShrink: 0,
                border: `1px solid ${activeCat === cat ? C.blue : C.border}`,
                background: activeCat === cat ? 'rgba(107,126,255,0.12)' : C.bgCard,
                color: activeCat === cat ? C.blue : C.textMuted,
              }}>
                {cat === 'ALL' ? 'ALL' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* ── Device list — padded wrapper prevents iOS overflow ── */}
        <div className="gg-list" style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 8px', scrollbarWidth: 'none' } as React.CSSProperties}>
          {visible.map(p => {
            const color     = brandHues[p.brand] ?? C.blue
            const hasManual = !!p.manual_url
            return (
              // Wrapper div owns the horizontal padding; button is 100% of it.
              // This avoids iOS Safari's broken width:calc on button elements.
              <div key={p.id} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => { setSelected(p); setScreen('choice') }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center',
                    padding: '16px 14px', gap: 14,
                    background: C.bgCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 16,
                    cursor: 'pointer', textAlign: 'left',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.bgSurface)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.bgCard)}
                >
                  {/* Brand avatar — product image if available, else initials */}
                  <div style={{
                    width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                    background: p.image_url ? C.bgInput : `${color}18`,
                    border: p.image_url ? `1px solid ${C.border}` : `1.5px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden',
                    fontFamily: MONO, fontSize: 13, fontWeight: 700, color, letterSpacing: '0.04em',
                  }}>
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                        onError={e => {
                          // On broken image — hide img, show parent initials
                          const el = e.currentTarget
                          el.style.display = 'none'
                          el.parentElement!.style.background = `${color}18`
                          el.parentElement!.style.border = `1.5px solid ${color}44`
                          el.insertAdjacentHTML('afterend', `<span style="font-family:monospace;font-size:13px;font-weight:700;color:${color}">${brandInitials(p.brand)}</span>`)
                        }}
                      />
                    ) : (
                      brandInitials(p.brand)
                    )}
                  </div>

                  {/* Text block — flex:1 + minWidth:0 enables proper ellipsis */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: SANS, fontSize: 16, fontWeight: 700,
                      color: C.textPrimary, lineHeight: 1.3,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {p.name}
                    </div>
                    <div style={{
                      fontFamily: MONO, fontSize: 10, color: C.textSecondary,
                      marginTop: 4, letterSpacing: '0.06em',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {p.brand.toUpperCase()} · {p.sku}
                    </div>
                  </div>

                  {/* Right indicator — always visible, fixed width */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, flexShrink: 0, width: 24 }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: hasManual ? C.green : C.textMuted,
                      boxShadow: hasManual ? `0 0 8px ${C.green}88` : 'none',
                    }} />
                    <span style={{ color: C.textSecondary, fontSize: 16, lineHeight: 1 }}>›</span>
                  </div>
                </button>
              </div>
            )
          })}
          {visible.length === 0 && serviceProds.length > 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em' }}>NO DEVICES MATCH</div>
          )}
          {serviceProds.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em' }}>LOADING…</div>
          )}
        </div>

        {/* ── Bottom navigation bar ── */}
        <div style={S.legendStrip}>
          {/* DIAGNOSE — currently active */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: `2.5px solid ${C.blue}`, background: 'rgba(107,126,255,0.06)' }}>
            <span style={{ color: C.blue, display: 'flex' }}><NavIcon k="diagnose" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.blue, letterSpacing: '0.06em' }}>DIAGNOSE</span>
          </div>
          {/* MY JOBS */}
          <button onClick={() => { setOpenJob(null); setScreen('jobs'); loadMyJobs() }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="jobs" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>MY JOBS</span>
          </button>
          {/* WIRING */}
          <button onClick={() => setScreen('wiring')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="wiring" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>WIRING</span>
          </button>
          {/* CABLE */}
          <button
            onClick={() => setScreen('cable')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="cable" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>CABLE</span>
          </button>
          {/* SURVEY */}
          <button
            onClick={() => { setSurveyProposal(null); setScreen('survey') }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="survey" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>SURVEY</span>
          </button>
          {/* NETSCOUT */}
          <button
            onClick={() => setScreen('netscout')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="netscout" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>NETSCOUT</span>
          </button>
          {/* TRAIN */}
          <button
            onClick={() => setScreen('training')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="train" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>TRAIN</span>
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: CHOICE — manual vs troubleshoot
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'choice') {
    const hasManual = !!selected?.manual_url
    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('home')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>{selected?.sku}</div>
            <div style={S.topBarSub}>{selected?.brand.toUpperCase()}</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: hasManual ? C.green : C.amber, letterSpacing: '0.1em' }}>
            {hasManual ? '● AI-READY' : '● NO MANUAL'}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 16px', gap: 12 }}>
          {/* Device info */}
          <div style={{ background: C.bgCard, borderRadius: 14, padding: '16px', border: `1px solid ${C.border}`, marginBottom: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.30)' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.14em', marginBottom: 6 }}>
              {selected?.category.toUpperCase()}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 17, fontWeight: 700, color: C.textPrimary, lineHeight: 1.3 }}>
              {selected?.name}
            </div>
            {selected?.description && (
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, marginTop: 8, lineHeight: 1.5 }}>
                {selected.description.slice(0, 120)}{selected.description.length > 120 ? '…' : ''}
              </div>
            )}
          </div>

          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.18em', textAlign: 'center', marginBottom: 4 }}>
            SELECT MODE
          </div>

          {/* View Manual */}
          <button
            onClick={() => hasManual && window.open(selected!.manual_url!, '_blank')}
            disabled={!hasManual}
            style={{
              padding: '20px', borderRadius: 12, textAlign: 'left', cursor: hasManual ? 'pointer' : 'not-allowed',
              background: hasManual ? 'rgba(107,126,255,0.14)' : C.bgInput,
              border: `1px solid ${hasManual ? 'rgba(107,126,255,0.38)' : C.border}`,
              opacity: hasManual ? 1 : 0.45,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>📄</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: hasManual ? C.blue : C.textMuted, letterSpacing: '0.1em', marginBottom: 3 }}>
                  VIEW MANUAL
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary }}>
                  {hasManual ? 'Full PDF manual opens in new tab' : 'No manual uploaded yet — upload via portal KB'}
                </div>
              </div>
              {hasManual && <span style={{ color: C.blue, fontSize: 18 }}>↗</span>}
            </div>
          </button>

          {/* Troubleshoot */}
          <button
            onClick={() => { setConnectedDevices([]); setScreen('symptom') }}
            style={{ padding: '20px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', background: 'rgba(16,185,129,0.14)', border: `1px solid rgba(16,185,129,0.42)`, boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>🔧</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: '0.1em', marginBottom: 3 }}>
                  TROUBLESHOOT
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary }}>
                  {hasManual ? 'AI-guided diagnosis with manual references' : 'AI-guided diagnosis — general knowledge mode'}
                </div>
              </div>
              <span style={{ color: C.green, fontSize: 18 }}>›</span>
            </div>
          </button>

          {/* Wiring Guide */}
          <button
            onClick={() => setScreen('wiring')}
            style={{ padding: '20px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', background: 'rgba(245,158,11,0.14)', border: `1px solid rgba(245,158,11,0.42)`, boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>📐</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.amber, letterSpacing: '0.1em', marginBottom: 3 }}>
                  WIRING GUIDE
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary }}>
                  Terminal diagrams for connecting to gates, locks, and readers
                </div>
              </div>
              <span style={{ color: C.amber, fontSize: 18 }}>›</span>
            </div>
          </button>

          {/* Cable Guide */}
          <button
            onClick={() => setScreen('cable')}
            style={{ padding: '20px', borderRadius: 14, textAlign: 'left', cursor: 'pointer', background: 'rgba(167,139,250,0.14)', border: `1px solid rgba(167,139,250,0.42)`, boxShadow: '0 2px 16px rgba(0,0,0,0.25)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 22, lineHeight: 1 }}>🔌</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.purple, letterSpacing: '0.1em', marginBottom: 3 }}>
                  CABLE GUIDE
                </div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary }}>
                  CAT cable pinouts · 2-wire series · 2-wire parallel testing
                </div>
              </div>
              <span style={{ color: C.purple, fontSize: 18 }}>›</span>
            </div>
          </button>

          {/* Manual + Troubleshoot combined */}
          {hasManual && (
            <button
              onClick={() => { setConnectedDevices([]); window.open(selected!.manual_url!, '_blank'); setScreen('symptom') }}
              style={{ padding: '13px 16px', borderRadius: 10, textAlign: 'center', cursor: 'pointer', background: 'transparent', border: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em' }}
            >
              OPEN MANUAL + START DIAGNOSTIC ›
            </button>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: WIRING GUIDE
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'wiring') {
    const themeObj = {
      bg: C.bg, bgCard: C.bgCard, border: C.border,
      blue: C.blue, textPrimary: C.textPrimary,
      textSecondary: C.textSecondary, textMuted: C.textMuted,
    }
    return (
      <WiringGuide
        defaultMapId={wiringInitMapId ?? undefined}
        product={{
          name:     selected?.name     ?? '',
          brand:    selected?.brand    ?? '',
          category: selected?.category ?? '',
          sku:      selected?.sku      ?? '',
        }}
        onBack={() => { setWiringInitMapId(null); setScreen(prevScreen ?? 'choice') }}
        theme={themeObj}
      />
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: CABLE GUIDE
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'cable') {
    const themeObj = {
      bg: C.bg, bgCard: C.bgCard, border: C.border,
      blue: C.blue, textPrimary: C.textPrimary,
      textSecondary: C.textSecondary, textMuted: C.textMuted,
    }
    return (
      <CableGuide
        onBack={() => setScreen(selected ? 'choice' : 'home')}
        theme={themeObj}
      />
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: INSTALL — Commissioning wizard (demo mode)
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'install') {
    const allSteps    = INSTALL_PHASES.flatMap(p => p.steps)
    const totalSteps  = allSteps.length
    const doneCount   = allSteps.filter(s => installChecked.has(s.id)).length
    const pct         = Math.round((doneCount / totalSteps) * 100)

    const toggleCheck = (id: string) =>
      setInstallChecked(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
    const togglePhase = (id: string) =>
      setExpandedPhases(prev => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })

    function launchFault() {
      // Navigate to fault demo — sessionStorage code will be picked up automatically,
      // or PIN screen will prompt for code then auto-launch the fault scenario.
      window.location.href = '/tech?demo=fault'
    }

    return (
      <div style={S.shell}>
        <style>{`.gg-install::-webkit-scrollbar{display:none}`}</style>

        {/* Top bar */}
        <div style={S.topBar}>
          <div style={{ ...S.ggMark, padding: 6, background: 'rgba(255,255,255,0.06)' }}><img src="/logo.png" alt="GateGuard" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>NEW INSTALLATION — DEMO</div>
            <div style={S.topBarSub}>G3 INTERCOM + HUB MINI + ACS300 + DK6050 ×2</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.1em', border: `1px solid rgba(217,119,6,0.3)`, borderRadius: 5, padding: '3px 7px', background: 'rgba(217,119,6,0.07)', flexShrink: 0 }}>
            ⚡ DEMO
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: C.border, flexShrink: 0 }}>
          <div style={{ height: '100%', background: C.green, transition: 'width 0.4s', width: `${pct}%` }} />
        </div>

        <div className="gg-install" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>

          {/* System summary */}
          <div style={{ background: C.bgCard, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.border}` }}>
            <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.16em', marginBottom: 10 }}>SYSTEM COMPONENTS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {DEMO_SYSTEM_DEVICES.map(d => (
                <div key={d.sku} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: `${d.color}12`, border: `1px solid ${d.color}30`,
                  borderRadius: 6, padding: '4px 9px',
                }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.05em' }}>{d.label}</span>
                </div>
              ))}
            </div>
            {/* Progress counter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <div style={{ flex: 1, height: 4, background: C.border, borderRadius: 3 }}>
                <div style={{ height: '100%', background: C.green, borderRadius: 3, transition: 'width 0.4s', width: `${pct}%` }} />
              </div>
              <span style={{ fontFamily: MONO, fontSize: 9, color: pct === 100 ? C.green : C.textMuted, letterSpacing: '0.08em', flexShrink: 0 }}>
                {doneCount}/{totalSteps} STEPS
              </span>
            </div>
          </div>

          {/* Phase cards */}
          {INSTALL_PHASES.map(phase => {
            const phaseSteps   = phase.steps
            const phaseDone    = phaseSteps.filter(s => installChecked.has(s.id)).length
            const isExpanded   = expandedPhases.has(phase.id)
            const isComplete   = phaseDone === phaseSteps.length

            return (
              <div key={phase.id} style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${isComplete ? `${phase.color}40` : C.border}`, overflow: 'hidden' }}>
                {/* Phase header — div avoids browser button-sizing bugs inside overflow:hidden */}
                <div
                  role="button" tabIndex={0}
                  onClick={() => togglePhase(phase.id)}
                  onKeyDown={e => e.key === 'Enter' && togglePhase(phase.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: `${phase.color}18`, border: `1px solid ${phase.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: isComplete ? '50%' : 2, background: isComplete ? phase.color : `${phase.color}80` }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: isComplete ? phase.color : C.textPrimary, letterSpacing: '0.1em' }}>
                      {phase.title}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: isComplete ? phase.color : C.textMuted, letterSpacing: '0.06em', marginTop: 2 }}>
                      {isComplete ? '✓ COMPLETE' : `${phaseDone}/${phaseSteps.length} complete`}
                    </div>
                  </div>
                  <span style={{ color: C.textMuted, fontSize: 16, flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block', lineHeight: 1 }}>›</span>
                </div>

                {/* Steps */}
                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${C.border}` }}>
                    {phaseSteps.map((step, idx) => {
                      const checked = installChecked.has(step.id)
                      return (
                        <div key={step.id} style={{
                          padding: '12px 16px',
                          borderBottom: idx < phaseSteps.length - 1 ? `1px solid ${C.border}` : 'none',
                          background: checked ? `${phase.color}06` : 'transparent',
                        }}>
                          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            {/* Checkbox */}
                            <button
                              onClick={() => toggleCheck(step.id)}
                              style={{
                                width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                                border: `2px solid ${checked ? phase.color : C.borderMed}`,
                                background: checked ? phase.color : 'transparent',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginTop: 1, transition: 'all 0.15s',
                              }}
                            >
                              {checked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                            </button>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: checked ? C.textMuted : C.textPrimary, lineHeight: 1.45, textDecoration: checked ? 'line-through' : 'none' }}>
                                {step.text}
                              </div>
                              {step.detail && !checked && (
                                <div style={{ fontFamily: MONO, fontSize: 10, color: C.textSecondary, marginTop: 5, lineHeight: 1.6, letterSpacing: '0.02em' }}>
                                  {step.detail}
                                </div>
                              )}
                              {/* Wiring diagram button */}
                              {step.wiringMapId && (
                                <button
                                  onClick={() => {
                                    setPrevScreen('install')
                                    setWiringInitMapId(step.wiringMapId!)
                                    setScreen('wiring')
                                  }}
                                  style={{
                                    marginTop: 7, padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
                                    background: 'rgba(217,119,6,0.08)', border: `1px solid rgba(217,119,6,0.25)`,
                                    fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 5,
                                  }}
                                >
                                  📐 VIEW WIRING DIAGRAM
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

          {/* Fault demo CTA */}
          <div style={{ marginTop: 8, background: C.bgCard, borderRadius: 12, border: `1px solid rgba(220,38,38,0.2)`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.red, letterSpacing: '0.14em', fontWeight: 700 }}>⚠ DEMO SCENARIO 2</div>
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4 }}>
              System installed and running. Simulate a live fault — AI-guided troubleshooting ending in a bad wire discovery.
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.textSecondary, lineHeight: 1.6 }}>
              Brivo grants access, DK6050 doesn't respond. Walk through the full AI diagnostic until the wiring fault is identified, then jump to the cable guide.
            </div>
            <button
              onClick={launchFault}
              style={{
                width: '100%', padding: '16px', borderRadius: 12,
                background: 'rgba(220,38,38,0.08)', border: `1px solid rgba(220,38,38,0.3)`,
                color: C.red, fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', cursor: 'pointer',
              }}
            >
              SIMULATE FAULT SCENARIO →
            </button>
          </div>

        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: SURVEY — site walk inventory + proposal generator
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'survey') {
    const TEAL    = '#2DD4BF'
    const tealBg  = 'rgba(45,212,191,0.12)'
    const condColor = (c: SurveyDevice['condition']) =>
      c === 'good' ? C.green : c === 'fair' ? C.amber : C.red
    const actionLabel = (a: SurveyDevice['action']) =>
      ({ keep: 'KEEP', service: 'SERVICE', replace: 'REPLACE', new_install: 'NEW INSTALL' })[a]
    const actionColor = (a: SurveyDevice['action']) =>
      a === 'keep' ? C.green : a === 'service' ? C.amber : a === 'replace' ? C.red : TEAL
    const priorityColor = (p: string) =>
      p === 'urgent' ? C.red : p === 'recommended' ? C.amber : C.textMuted

    async function generateProposal() {
      if (!surveyDevices.length) return
      setSurveyLoading(true)
      setSurveyProposal(null)
      setSavedSurveyId(null)
      try {
        const res = await fetch('/api/kb/survey-proposal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tech-code': techCode },
          body: JSON.stringify({ propertyName: surveyPropName, devices: surveyDevices }),
        })
        const data = await res.json()
        if (data.proposal) setSurveyProposal(data.proposal)
      } catch { /* silent */ } finally {
        setSurveyLoading(false)
      }
    }

    async function saveToPortal() {
      if (!surveyDevices.length) return
      setSavingToPortal(true)
      pingGPS('on_site')
      try {
        const res = await fetch('/api/surveys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tech-code': techCode },
          body: JSON.stringify({
            property_name:    surveyPropName || 'Field Survey',
            surveyor_type:    'sales',
            survey_date:      new Date().toISOString().slice(0, 10),
            devices:          surveyDevices,
          }),
        })
        const data = await res.json()
        if (data.survey?.id) setSavedSurveyId(data.survey.id)
      } catch { /* silent */ } finally {
        setSavingToPortal(false)
      }
    }

    function startAddDevice(existing?: SurveyDevice) {
      if (existing) {
        setSdName(existing.name); setSdBrand(existing.brand); setSdModel(existing.model)
        setSdLocation(existing.location); setSdCondition(existing.condition)
        setSdAction(existing.action); setSdNotes(existing.notes)
        setEditingDevice(existing)
      } else {
        setSdName(''); setSdBrand(''); setSdModel(''); setSdLocation('')
        setSdCondition('good'); setSdAction('keep'); setSdNotes('')
        setEditingDevice(null)
      }
      setScreen('survey_add')
    }

    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('home')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>SITE SURVEY</div>
            <div style={S.topBarSub}>{surveyDevices.length} DEVICE{surveyDevices.length !== 1 ? 'S' : ''} DOCUMENTED</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: TEAL, letterSpacing: '0.1em' }}>📍 WALK MODE</div>
        </div>

        <div style={{ padding: '12px 16px 0' }}>
          <input
            value={surveyPropName}
            onChange={e => setSurveyPropName(e.target.value)}
            placeholder="Property name (optional)…"
            style={{ width: '100%', boxSizing: 'border-box', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', fontFamily: SANS, fontSize: 14, color: C.textPrimary, outline: 'none', WebkitAppearance: 'none', WebkitTextFillColor: C.textPrimary }}
          />
        </div>

        {/* Device list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0 8px', scrollbarWidth: 'none' } as React.CSSProperties}>
          {surveyDevices.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 48, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', lineHeight: 2 }}>
              NO DEVICES YET{'\n'}TAP + ADD DEVICE TO START
            </div>
          )}
          {surveyDevices.map((d, idx) => (
            <button
              key={d.id}
              onClick={() => startAddDevice(d)}
              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', padding: '13px 16px', gap: 12, background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left' }}
            >
              {/* Index */}
              <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: tealBg, border: `1px solid ${TEAL}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 10, fontWeight: 700, color: TEAL }}>
                {String(idx + 1).padStart(2, '0')}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.name || 'Unnamed Device'}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 2, letterSpacing: '0.06em' }}>
                  {[d.brand, d.model].filter(Boolean).join(' · ')}
                  {d.location && ` — ${d.location.toUpperCase()}`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em', color: condColor(d.condition), fontWeight: 700 }}>
                  ● {d.condition.toUpperCase()}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em', color: actionColor(d.action) }}>
                  {actionLabel(d.action)}
                </span>
              </div>
            </button>
          ))}

          {/* Proposal output — SOW */}
          {surveyProposal && (
            <div style={{ margin: '12px 16px 0', borderRadius: 12, background: C.bgCard, border: `1px solid ${C.border}`, overflow: 'hidden' }}>

              {/* Header strip */}
              <div style={{ background: TEAL, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: '#fff', fontWeight: 700 }}>STATEMENT OF WORK</div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.08em' }}>{surveyProposal.whatIsThere.summary}</div>
              </div>

              <div style={{ padding: 14 }}>

                {/* Executive summary */}
                <p style={{ fontFamily: SANS, fontSize: 12, color: C.textPrimary, lineHeight: 1.65, margin: '0 0 14px' }}>{surveyProposal.summary}</p>

                {/* ── SECTION 1: WHAT IS THERE ── */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 3, height: 14, borderRadius: 2, background: '#6B7EFF' }} />
                    <div style={{ fontFamily: MONO, fontSize: 9, color: '#6B7EFF', letterSpacing: '0.12em', fontWeight: 700 }}>WHAT IS THERE</div>
                  </div>

                  {/* Count strip */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    {surveyProposal.whatIsThere.totalGates > 0 && (
                      <div style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.25)', fontFamily: MONO, fontSize: 9, color: '#6B7EFF', letterSpacing: '0.06em' }}>
                        🚧 {surveyProposal.whatIsThere.totalGates} GATE{surveyProposal.whatIsThere.totalGates !== 1 ? 'S' : ''}
                      </div>
                    )}
                    {surveyProposal.whatIsThere.totalDoors > 0 && (
                      <div style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.25)', fontFamily: MONO, fontSize: 9, color: '#6B7EFF', letterSpacing: '0.06em' }}>
                        🚪 {surveyProposal.whatIsThere.totalDoors} DOOR ENTRY PT{surveyProposal.whatIsThere.totalDoors !== 1 ? 'S' : ''}
                      </div>
                    )}
                    <div style={{ padding: '3px 8px', borderRadius: 4, background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.25)', fontFamily: MONO, fontSize: 9, color: '#6B7EFF', letterSpacing: '0.06em' }}>
                      📋 {surveyProposal.whatIsThere.totalDevices} TOTAL DEVICES
                    </div>
                  </div>

                  {surveyProposal.whatIsThere.categories.map((cat, ci) => (
                    <div key={ci} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 8, background: C.bgInput, border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.08em', fontWeight: 700 }}>{cat.category.toUpperCase()}</span>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted }}>×{cat.count}</span>
                      </div>
                      {cat.items.map((item, ii) => (
                        <div key={ii} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 8, marginBottom: 2 }}>
                          <span style={{ fontFamily: SANS, fontSize: 11, color: C.textPrimary }}>{item.label}</span>
                          <span style={{ fontFamily: MONO, fontSize: 8, color: condColor(item.condition as 'good'|'fair'|'poor'), letterSpacing: '0.06em', flexShrink: 0, marginLeft: 6 }}>● {item.condition.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* ── SECTION 2: WHAT NEEDS WORK ── */}
                {surveyProposal.whatNeedsWork.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: C.amber }} />
                      <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.12em', fontWeight: 700 }}>WHAT NEEDS WORK</div>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted }}>({surveyProposal.whatNeedsWork.length} item{surveyProposal.whatNeedsWork.length !== 1 ? 's' : ''})</span>
                    </div>

                    {surveyProposal.whatNeedsWork.map((w, i) => {
                      const actionBadge = w.action === 'replace'      ? { label: 'REPLACE',  color: C.red }
                                        : w.action === 'new_install'   ? { label: 'INSTALL',  color: '#6B7EFF' }
                                        :                                 { label: 'SERVICE',  color: C.amber }
                      return (
                        <div key={i} style={{ marginBottom: 6, padding: '8px 10px', borderRadius: 8, background: C.bgInput, border: `1px solid ${w.priority === 'urgent' ? C.red + '60' : C.border}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontFamily: SANS, fontSize: 12, color: C.textPrimary, fontWeight: 500 }}>{w.name}</div>
                              <div style={{ fontFamily: SANS, fontSize: 11, color: C.textMuted, marginTop: 1 }}>📍 {w.location}</div>
                              <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, marginTop: 3, lineHeight: 1.4 }}>{w.issue}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                              <span style={{ fontFamily: MONO, fontSize: 8, color: actionBadge.color, background: actionBadge.color + '18', padding: '2px 6px', borderRadius: 3, letterSpacing: '0.06em' }}>{actionBadge.label}</span>
                              <span style={{ fontFamily: MONO, fontSize: 8, color: priorityColor(w.priority), letterSpacing: '0.06em' }}>{w.priority.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {surveyProposal.whatNeedsWork.length === 0 && (
                  <div style={{ marginBottom: 14, padding: '8px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <span style={{ fontFamily: SANS, fontSize: 12, color: '#22C55E' }}>✓ No service or replacement items identified — system is in good condition.</span>
                  </div>
                )}

                {/* ── SECTION 3: WHAT TO EXPECT ── */}
                {surveyProposal.whatToExpect && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 3, height: 14, borderRadius: 2, background: '#22C55E' }} />
                      <div style={{ fontFamily: MONO, fontSize: 9, color: '#22C55E', letterSpacing: '0.12em', fontWeight: 700 }}>WHAT TO EXPECT</div>
                    </div>

                    {/* Scope + Timeline */}
                    <div style={{ padding: '8px 10px', borderRadius: 8, background: C.bgInput, border: `1px solid ${C.border}`, marginBottom: 6 }}>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: C.textPrimary, lineHeight: 1.5, marginBottom: 4 }}>{surveyProposal.whatToExpect.scope}</div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.06em' }}>⏱ {surveyProposal.whatToExpect.timeline}</div>
                    </div>

                    {/* Deliverables */}
                    {surveyProposal.whatToExpect.deliverables?.length > 0 && (
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>DELIVERABLES</div>
                        {surveyProposal.whatToExpect.deliverables.map((d, i) => (
                          <div key={i} style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, paddingLeft: 10, borderLeft: `2px solid ${C.border}`, marginBottom: 3, lineHeight: 1.45 }}>✓ {d}</div>
                        ))}
                      </div>
                    )}

                    {/* Outcomes */}
                    {surveyProposal.whatToExpect.outcomes?.length > 0 && (
                      <div>
                        <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>OUTCOMES FOR PROPERTY</div>
                        {surveyProposal.whatToExpect.outcomes.map((o, i) => (
                          <div key={i} style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, paddingLeft: 10, borderLeft: `2px solid rgba(34,197,94,0.4)`, marginBottom: 3, lineHeight: 1.45 }}>→ {o}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Urgent items banner */}
                {surveyProposal.urgentItems?.length > 0 && (
                  <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.07)', border: `1px solid ${C.red}40` }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: C.red, letterSpacing: '0.1em', marginBottom: 4 }}>⚠ IMMEDIATE ATTENTION REQUIRED</div>
                    {surveyProposal.urgentItems.map((item, i) => (
                      <div key={i} style={{ fontFamily: SANS, fontSize: 12, color: C.red, lineHeight: 1.5, marginBottom: 2 }}>• {item}</div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                {surveyProposal.recommendations?.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>ADDITIONAL RECOMMENDATIONS</div>
                    {surveyProposal.recommendations.map((r, i) => (
                      <div key={i} style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, lineHeight: 1.5, paddingLeft: 10, borderLeft: `2px solid ${C.border}`, marginBottom: 3 }}>• {r}</div>
                    ))}
                  </div>
                )}

              </div>

              {/* Copy button */}
              <button
                onClick={() => {
                  const inv = surveyProposal.whatIsThere
                  const work = surveyProposal.whatNeedsWork
                  const exp = surveyProposal.whatToExpect
                  const lines = [
                    `STATEMENT OF WORK — ${surveyPropName || 'Property'}`,
                    `Generated: ${new Date().toLocaleDateString()}`,
                    '='.repeat(48),
                    '',
                    surveyProposal.summary,
                    '',
                    '─── WHAT IS THERE ───────────────────────────────',
                    inv.summary,
                    '',
                    ...inv.categories.flatMap(cat => [
                      `${cat.category} (${cat.count}):`,
                      ...cat.items.map(item => `  • ${item.label} [${item.condition}]`),
                      '',
                    ]),
                    '─── WHAT NEEDS WORK ─────────────────────────────',
                    work.length === 0 ? '  No service or replacement items.' : '',
                    ...work.map(w => `  [${w.priority.toUpperCase()}] ${w.name} @ ${w.location}\n    → ${w.action.replace('_', ' ')}: ${w.issue}`),
                    '',
                    '─── WHAT TO EXPECT ──────────────────────────────',
                    exp.scope,
                    `Timeline: ${exp.timeline}`,
                    '',
                    'Deliverables:',
                    ...(exp.deliverables ?? []).map(d => `  ✓ ${d}`),
                    '',
                    'Outcomes:',
                    ...(exp.outcomes ?? []).map(o => `  → ${o}`),
                  ].join('\n')
                  navigator.clipboard?.writeText(lines).catch(() => {})
                }}
                style={{ width: '100%', padding: '11px', borderRadius: 0, border: 'none', borderTop: `1px solid ${C.border}`, background: tealBg, fontFamily: MONO, fontSize: 10, color: TEAL, letterSpacing: '0.08em', cursor: 'pointer' } as React.CSSProperties}
              >
                📋 COPY SOW TEXT
              </button>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div style={{ padding: '10px 16px 16px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => startAddDevice()}
              style={{ flex: 1, padding: '13px', borderRadius: 10, border: `1px solid ${TEAL}40`, background: tealBg, fontFamily: MONO, fontSize: 10, color: TEAL, letterSpacing: '0.1em', cursor: 'pointer', fontWeight: 700 }}
            >
              + ADD DEVICE
            </button>
            {surveyDevices.length > 0 && (
              <button
                onClick={generateProposal}
                disabled={surveyLoading}
                style={{ flex: 1.5, padding: '13px', borderRadius: 10, border: 'none', background: surveyLoading ? C.bgInput : TEAL, fontFamily: MONO, fontSize: 10, color: surveyLoading ? C.textMuted : '#FFFFFF', letterSpacing: '0.1em', cursor: surveyLoading ? 'default' : 'pointer', fontWeight: 700 }}
              >
                {surveyLoading ? 'GENERATING…' : '⚡ GENERATE PROPOSAL'}
              </button>
            )}
          </div>
          <button
            onClick={() => {
              setTranscriptText('')
              setTranscriptError(null)
              setParsedDevices([])
              setParsedSelected(new Set())
              setParsedPropertyName(null)
              setScreen('survey_transcript')
            }}
            style={{ width: '100%', padding: '11px', borderRadius: 10, border: `1px solid rgba(107,126,255,0.25)`, background: C.blueAlpha, fontFamily: MONO, fontSize: 10, color: C.blue, letterSpacing: '0.1em', cursor: 'pointer', fontWeight: 700 }}
          >
            🎤 PASTE VOICE NOTES
          </button>
          {surveyDevices.length > 0 && (
            savedSurveyId ? (
              <div style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', textAlign: 'center' }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: '#22C55E', letterSpacing: '0.1em', marginBottom: 3 }}>✓ SAVED TO PORTAL</div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted }}>Open Site Surveys in the portal to view and create a quote</div>
              </div>
            ) : (
              <button
                onClick={saveToPortal}
                disabled={savingToPortal}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: `1px solid rgba(107,126,255,0.4)`, background: savingToPortal ? C.bgInput : 'rgba(107,126,255,0.12)', fontFamily: MONO, fontSize: 10, color: savingToPortal ? C.textMuted : C.blue, letterSpacing: '0.1em', cursor: savingToPortal ? 'default' : 'pointer', fontWeight: 700 }}
              >
                {savingToPortal ? '⌛ SAVING…' : '☁ SAVE TO PORTAL'}
              </button>
            )
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: SURVEY_ADD — add or edit a device on the site walk
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'survey_add') {
    const TEAL   = '#2DD4BF'
    const tealBg = 'rgba(45,212,191,0.12)'

    const condOpts:   SurveyDevice['condition'][] = ['good', 'fair', 'poor']
    const actionOpts: { value: SurveyDevice['action']; label: string; color: string }[] = [
      { value: 'keep',        label: 'KEEP',         color: C.green  },
      { value: 'service',     label: 'SERVICE',      color: C.amber  },
      { value: 'replace',     label: 'REPLACE',      color: C.red    },
      { value: 'new_install', label: 'NEW INSTALL',  color: TEAL     },
    ]
    const condColor = (c: SurveyDevice['condition']) =>
      c === 'good' ? C.green : c === 'fair' ? C.amber : C.red

    function saveDevice() {
      if (!sdName.trim()) return
      const dev: SurveyDevice = {
        id:        editingDevice?.id ?? crypto.randomUUID(),
        name:      sdName.trim(),
        brand:     sdBrand.trim(),
        model:     sdModel.trim(),
        location:  sdLocation.trim(),
        condition: sdCondition,
        action:    sdAction,
        notes:     sdNotes.trim(),
      }
      setSurveyDevices(prev =>
        editingDevice
          ? prev.map(d => d.id === editingDevice.id ? dev : d)
          : [...prev, dev]
      )
      setSurveyProposal(null)  // invalidate any existing proposal
      setScreen('survey')
    }

    function deleteDevice() {
      if (!editingDevice) return
      setSurveyDevices(prev => prev.filter(d => d.id !== editingDevice.id))
      setSurveyProposal(null)
      setScreen('survey')
    }

    const inputStyle: React.CSSProperties = {
      width: '100%', boxSizing: 'border-box',
      background: C.bgInput, border: `1px solid ${C.border}`,
      borderRadius: 8, padding: '10px 14px',
      fontFamily: SANS, fontSize: 14, color: C.textPrimary,
      outline: 'none', WebkitAppearance: 'none',
      WebkitTextFillColor: C.textPrimary,
      marginBottom: 10,
    }
    const labelStyle: React.CSSProperties = {
      fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em',
      color: C.textMuted, marginBottom: 5, display: 'block',
    }

    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('survey')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>{editingDevice ? 'EDIT DEVICE' : 'ADD DEVICE'}</div>
            <div style={S.topBarSub}>SITE SURVEY</div>
          </div>
          {editingDevice && (
            <button
              onClick={deleteDevice}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 9, color: C.red, letterSpacing: '0.08em', padding: '4px 8px' }}
            >
              DELETE
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px', scrollbarWidth: 'none' } as React.CSSProperties}>

          <label style={labelStyle}>DEVICE NAME *</label>
          <input
            value={sdName} onChange={e => setSdName(e.target.value)}
            placeholder="e.g. DoorKing 6050 Gate Operator"
            style={inputStyle}
            autoFocus
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>BRAND</label>
              <input value={sdBrand} onChange={e => setSdBrand(e.target.value)} placeholder="e.g. DoorKing" style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>MODEL / SKU</label>
              <input value={sdModel} onChange={e => setSdModel(e.target.value)} placeholder="e.g. DK-6050" style={inputStyle} />
            </div>
          </div>

          <label style={labelStyle}>LOCATION ON SITE</label>
          <input
            value={sdLocation} onChange={e => setSdLocation(e.target.value)}
            placeholder="e.g. Entry Gate, Exit Lane, Front Panel…"
            style={inputStyle}
          />

          <label style={labelStyle}>CONDITION</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {condOpts.map(c => (
              <button key={c} onClick={() => setSdCondition(c)} style={{
                flex: 1, padding: '13px 4px', minHeight: 44, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${sdCondition === c ? condColor(c) : C.border}`,
                background: sdCondition === c ? `${condColor(c)}15` : 'transparent',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                color: sdCondition === c ? condColor(c) : C.textMuted, fontWeight: sdCondition === c ? 700 : 400,
              }}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          <label style={labelStyle}>RECOMMENDED ACTION</label>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {actionOpts.map(o => (
              <button key={o.value} onClick={() => setSdAction(o.value)} style={{
                flex: '1 0 auto', padding: '13px 6px', minHeight: 44, borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${sdAction === o.value ? o.color : C.border}`,
                background: sdAction === o.value ? `${o.color}15` : 'transparent',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                color: sdAction === o.value ? o.color : C.textMuted, fontWeight: sdAction === o.value ? 700 : 400,
              }}>
                {o.label}
              </button>
            ))}
          </div>

          <label style={labelStyle}>NOTES</label>
          <textarea
            value={sdNotes} onChange={e => setSdNotes(e.target.value)}
            placeholder="Age, damage, error codes, owner notes…"
            rows={3}
            style={{ ...inputStyle, resize: 'none', lineHeight: 1.6, fontFamily: SANS } as React.CSSProperties}
          />
        </div>

        <div style={{ padding: '10px 16px 16px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={saveDevice}
            disabled={!sdName.trim()}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: sdName.trim() ? TEAL : C.bgInput,
              fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
              color: sdName.trim() ? '#FFFFFF' : C.textMuted,
              cursor: sdName.trim() ? 'pointer' : 'default',
            }}
          >
            {editingDevice ? '✓ SAVE CHANGES' : '+ SAVE DEVICE'}
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: SURVEY_TRANSCRIPT — paste voice notes, AI extracts device list
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'survey_transcript') {
    const TEAL   = '#2DD4BF'
    const tealBg = 'rgba(45,212,191,0.12)'
    const condColor = (c: SurveyDevice['condition']) =>
      c === 'good' ? C.green : c === 'fair' ? C.amber : C.red
    const actionLabel = (a: SurveyDevice['action']) =>
      ({ keep: 'KEEP', service: 'SERVICE', replace: 'REPLACE', new_install: 'NEW INSTALL' })[a]
    const actionColor = (a: SurveyDevice['action']) =>
      a === 'keep' ? C.green : a === 'service' ? C.amber : a === 'replace' ? C.red : TEAL

    // ── Plaud audio upload → transcribe → fill textarea ─────────────────────
    async function handlePlaudUpload(file: File) {
      setPlaudUploading(true)
      setPlaudStatus('Uploading recording…')
      setTranscriptError(null)
      try {
        const form = new FormData()
        form.append('audio', file)
        setPlaudStatus('Transcribing with Plaud AI…')
        const res = await fetch('/api/plaud/transcribe', {
          method: 'POST',
          headers: { 'x-tech-code': techCode },
          body: form,
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        setTranscriptText(data.transcript ?? '')
        setPlaudStatus(null)
      } catch (err: any) {
        setTranscriptError(err.message || 'Plaud transcription failed')
        setPlaudStatus(null)
      } finally {
        setPlaudUploading(false)
      }
    }

    async function parseTranscript() {
      if (!transcriptText.trim()) return
      setTranscriptParsing(true)
      setTranscriptError(null)
      setParsedDevices([])
      setParsedSelected(new Set())
      setParsedPropertyName(null)
      try {
        const res = await fetch('/api/kb/parse-survey-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-tech-code': techCode },
          body: JSON.stringify({ transcript: transcriptText, propertyName: surveyPropName || undefined }),
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        const devices: SurveyDevice[] = data.devices ?? []
        setParsedDevices(devices)
        setParsedPropertyName(data.propertyName ?? null)
        // Pre-select all by default
        setParsedSelected(new Set(devices.map((d: SurveyDevice) => d.id)))
      } catch (err: any) {
        setTranscriptError(err.message || 'Parse failed — try again')
      } finally {
        setTranscriptParsing(false)
      }
    }

    function addSelectedDevices() {
      const toAdd = parsedDevices.filter(d => parsedSelected.has(d.id))
      if (toAdd.length === 0) return
      setSurveyDevices(prev => {
        // Avoid duplicates by id
        const existing = new Set(prev.map(d => d.id))
        return [...prev, ...toAdd.filter(d => !existing.has(d.id))]
      })
      if (parsedPropertyName && !surveyPropName) {
        setSurveyPropName(parsedPropertyName)
      }
      setSurveyProposal(null)
      setScreen('survey')
    }

    function toggleDevice(id: string) {
      setParsedSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      })
    }

    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('survey')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>VOICE NOTES</div>
            <div style={S.topBarSub}>AI DEVICE EXTRACTION</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.blue, letterSpacing: '0.1em' }}>🎤 PLAUD</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 8px', scrollbarWidth: 'none' } as React.CSSProperties}>

          {/* Hidden Plaud file input */}
          <input
            ref={plaudFileRef}
            type="file"
            accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac,.mp4"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePlaudUpload(file)
              e.target.value = ''
            }}
          />

          {/* Instructions */}
          {parsedDevices.length === 0 && (
            <div style={{ background: C.blueAlpha, border: `1px solid rgba(107,126,255,0.2)`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.blue, letterSpacing: '0.1em', marginBottom: 6 }}>HOW TO USE</div>
              <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, lineHeight: 1.65 }}>
                Record your site walk on Plaud, then tap <strong>Upload Recording</strong> below — or paste the transcript directly. AI extracts every device automatically.
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 8, lineHeight: 1.8 }}>
                EXAMPLE: "Main gate has a DoorKing 6050, looks beat up. Side entry has a new Brivo reader installed last month…"
              </div>
            </div>
          )}

          {/* Plaud upload button — shown before parse, not during upload */}
          {parsedDevices.length === 0 && (
            <button
              onClick={() => plaudFileRef.current?.click()}
              disabled={plaudUploading || transcriptParsing}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '13px 16px', borderRadius: 10, marginBottom: 10,
                border: `1.5px dashed ${plaudUploading ? C.borderMed : 'rgba(107,126,255,0.5)'}`,
                background: plaudUploading ? C.bgInput : C.blueAlpha,
                cursor: plaudUploading ? 'default' : 'pointer',
                fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em',
                color: plaudUploading ? C.textMuted : C.blue, fontWeight: 700,
              }}
            >
              {plaudUploading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                  {plaudStatus ?? 'PROCESSING…'}
                </>
              ) : (
                <>🎙 UPLOAD PLAUD RECORDING</>
              )}
            </button>
          )}

          {/* Transcript input — shown only before parse */}
          {parsedDevices.length === 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 6 }}>
                {transcriptText ? 'TRANSCRIPT — EDIT IF NEEDED' : 'OR PASTE TRANSCRIPT / TYPE NOTES'}
              </div>
              <textarea
                value={transcriptText}
                onChange={e => setTranscriptText(e.target.value)}
                placeholder="Paste your Plaud transcript or type site walk notes here…"
                rows={10}
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: C.bgInput, border: `1px solid ${C.borderMed}`,
                  borderRadius: 10, padding: '12px 14px',
                  fontFamily: SANS, fontSize: 13, color: C.textPrimary,
                  lineHeight: 1.65, outline: 'none',
                  WebkitAppearance: 'none', WebkitTextFillColor: C.textPrimary,
                  minHeight: 180,
                } as React.CSSProperties}
              />
              {transcriptError && (
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: C.redAlpha, border: `1px solid rgba(220,38,38,0.2)`, fontFamily: SANS, fontSize: 12, color: C.red }}>
                  ⚠ {transcriptError}
                </div>
              )}
            </>
          )}

          {/* Parsed results */}
          {parsedDevices.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: TEAL, letterSpacing: '0.1em' }}>
                  {parsedDevices.length} DEVICE{parsedDevices.length !== 1 ? 'S' : ''} FOUND — DESELECT TO SKIP
                </div>
                <button
                  onClick={() => {
                    setParsedDevices([])
                    setParsedSelected(new Set())
                    setTranscriptError(null)
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.08em' }}
                >
                  ← RE-ENTER
                </button>
              </div>

              {parsedPropertyName && !surveyPropName && (
                <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: tealBg, border: `1px solid ${TEAL}30`, fontFamily: SANS, fontSize: 12, color: TEAL }}>
                  📍 Property detected: <strong>{parsedPropertyName}</strong>
                </div>
              )}

              {parsedDevices.map((d) => {
                const selected = parsedSelected.has(d.id)
                return (
                  <button
                    key={d.id}
                    onClick={() => toggleDevice(d.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start',
                      padding: '12px 14px', gap: 12,
                      background: selected ? C.bgCard : 'transparent',
                      border: `1px solid ${selected ? `${TEAL}40` : C.border}`,
                      borderRadius: 10, marginBottom: 8, cursor: 'pointer', textAlign: 'left',
                      opacity: selected ? 1 : 0.45,
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                      background: selected ? TEAL : 'transparent',
                      border: `2px solid ${selected ? TEAL : C.borderMed}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: MONO, fontSize: 10, color: '#FFF',
                    }}>
                      {selected ? '✓' : ''}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
                        {d.name || 'Unknown Device'}
                      </div>
                      {(d.brand || d.model) && (
                        <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 2, letterSpacing: '0.06em' }}>
                          {[d.brand, d.model].filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {d.location && (
                        <div style={{ fontFamily: SANS, fontSize: 11, color: C.textSecondary, marginTop: 2 }}>
                          📍 {d.location}
                        </div>
                      )}
                      {d.notes && (
                        <div style={{ fontFamily: SANS, fontSize: 11, color: C.textMuted, marginTop: 3, fontStyle: 'italic' }}>
                          {d.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em', color: condColor(d.condition), fontWeight: 700 }}>
                        ● {d.condition.toUpperCase()}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.08em', color: actionColor(d.action) }}>
                        {actionLabel(d.action)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* Bottom action */}
        <div style={{ padding: '10px 16px 16px', borderTop: `1px solid ${C.border}` }}>
          {parsedDevices.length === 0 ? (
            <button
              onClick={parseTranscript}
              disabled={transcriptParsing || !transcriptText.trim()}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: transcriptParsing || !transcriptText.trim() ? C.bgInput : C.blue,
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
                color: transcriptParsing || !transcriptText.trim() ? C.textMuted : '#FFFFFF',
                cursor: transcriptParsing || !transcriptText.trim() ? 'default' : 'pointer',
              }}
            >
              {transcriptParsing ? 'EXTRACTING DEVICES…' : '⚡ EXTRACT DEVICES'}
            </button>
          ) : (
            <button
              onClick={addSelectedDevices}
              disabled={parsedSelected.size === 0}
              style={{
                width: '100%', padding: '14px', borderRadius: 10, border: 'none',
                background: parsedSelected.size === 0 ? C.bgInput : TEAL,
                fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', fontWeight: 700,
                color: parsedSelected.size === 0 ? C.textMuted : '#FFFFFF',
                cursor: parsedSelected.size === 0 ? 'default' : 'pointer',
              }}
            >
              + ADD {parsedSelected.size} DEVICE{parsedSelected.size !== 1 ? 'S' : ''} TO SURVEY
            </button>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: SYMPTOM
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'symptom') {
    const picks = QUICK_PICKS[selected?.category ?? ''] ?? DEFAULT_PICKS
    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen(demoParam === 'fault' ? 'home' : 'choice')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>{selected?.sku} — {selected?.brand.toUpperCase()}</div>
            <div style={S.topBarSub}>DESCRIBE THE FAULT</div>
          </div>
          {demoParam === 'fault' && (
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.red, letterSpacing: '0.1em', border: `1px solid rgba(220,38,38,0.3)`, borderRadius: 5, padding: '3px 7px', background: 'rgba(220,38,38,0.07)', flexShrink: 0 }}>
              ⚠ DEMO FAULT
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={S.fieldLabel}>QUICK SELECT</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {picks.map(c => (
              <button key={c} onClick={() => setSymptom(c)} style={{
                ...S.chip,
                background:  symptom === c ? C.blueAlpha : C.bgInput,
                borderColor: symptom === c ? C.blue : C.border,
                color:       symptom === c ? C.blue : C.textSecondary,
              }}>{c}</button>
            ))}
          </div>

          <div style={S.fieldLabel}>FAULT DESCRIPTION</div>
          <textarea
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder={`Describe what's happening…\ne.g. Gate stalls halfway through travel`}
            style={S.textarea} rows={4} autoFocus
          />

          <div style={S.fieldLabel}>
            ERROR CODE / LED STATUS <span style={{ color: C.textMuted, fontWeight: 400 }}>OPTIONAL</span>
          </div>
          <input
            type="text" value={errorCode} onChange={e => setErrorCode(e.target.value)}
            placeholder="e.g. E-04 · RED+AMBER FLASH"
            style={S.monoInput}
          />

          {/* Connected devices */}
          {(() => {
            const devOpts = CONNECTED_OPTS[selected?.category ?? ''] ?? DEFAULT_CONNECTED_OPTS
            const toggleDevice = (d: string) =>
              setConnectedDevices(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
            return (
              <div>
                <div style={{ ...S.fieldLabel, display: 'flex', alignItems: 'center', gap: 8 }}>
                  OTHER DEVICES IN THIS SYSTEM
                  <span style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, fontWeight: 400, letterSpacing: '0.08em' }}>
                    SELECT ALL THAT APPLY
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
                  {devOpts.map(d => {
                    const on = connectedDevices.includes(d)
                    return (
                      <button key={d} onClick={() => toggleDevice(d)} style={{
                        fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em',
                        padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                        border: `1px solid ${on ? C.blue : C.border}`,
                        background: on ? C.blueAlpha : C.bgInput,
                        color: on ? C.blue : C.textSecondary,
                        transition: 'all 0.12s',
                      }}>
                        {on ? '✓ ' : ''}{d.toUpperCase()}
                      </button>
                    )
                  })}
                </div>
                {connectedDevices.length > 0 && (
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 6, letterSpacing: '0.07em' }}>
                    AI will consider interconnection faults between these devices
                  </div>
                )}
              </div>
            )
          })()}

          {selected?.specs && (
            <div style={{ background: C.bgCard, borderRadius: 8, padding: '10px 12px', border: `1px solid ${C.border}` }}>
              <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.16em', marginBottom: 4 }}>DEVICE SPECS</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.textSecondary, lineHeight: 1.7 }}>{selected.specs}</div>
            </div>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={startDiag} disabled={!symptom.trim()}
            style={{ ...S.primaryBtn, opacity: symptom.trim() ? 1 : 0.25 }}
          >
            INITIALIZE DIAGNOSTIC ›
          </button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: DIAGNOSTIC
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.shell}>
      <div style={S.diagHeader}>
        <button style={S.iconBtn} onClick={reset}>✕</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.topBarTitle}>{selected?.sku} — {selected?.brand.toUpperCase()}</div>
          <div style={S.topBarSub}>
            {symptom.length > 38 ? symptom.slice(0, 38).toUpperCase() + '…' : symptom.toUpperCase()}
          </div>
          {connectedDevices.length > 0 && (
            <div style={{ fontFamily: MONO, fontSize: 8, color: C.blue, letterSpacing: '0.08em', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              + {connectedDevices.join(' · ').toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={S.sessionId}>{shortSession(sessionId)}</div>
          <div style={S.topBarSub}>SESSION</div>
        </div>
      </div>

      <div style={S.progressBar}>
        <div style={{ ...S.progressFill, width: `${Math.min(stepCount * 10, 100)}%` }} />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0 24px' }}>

        {/* History log */}
        {history.length > 0 && (
          <div style={S.historyLog}>
            <div style={S.logLabel}>DIAGNOSTIC LOG</div>
            {history.map((h, i) => {
              const ansLower  = h.answer.toLowerCase()
              const ansColor  = ansLower === 'yes' ? C.green : ansLower === 'no' ? C.red : C.amber
              return (
                <div key={i} style={S.logRow}>
                  <span style={S.logNum}>{pad2(i + 1)}</span>
                  <span style={S.logText}>{h.question}</span>
                  <span style={{ ...S.logAns, color: ansColor }}>{h.answer.length > 18 ? h.answer.slice(0, 18) + '…' : h.answer.toUpperCase()}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Loading — staged messaging so tech knows it's working */}
        {loading && (
          <div style={{ margin: '8px 16px', padding: '18px 16px', borderRadius: 14, background: C.bgCard, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={S.spinner} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: C.blue, letterSpacing: '0.10em', fontWeight: 700 }}>
                {loadingStage === 'slow' ? 'STILL WORKING…' : loadingStage === 'generating' ? 'GENERATING NEXT STEP…' : 'SEARCHING KNOWLEDGE BASE…'}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.06em', marginTop: 4 }}>
                {loadingStage === 'slow' ? 'COLD START — HOLD TIGHT' : loadingStage === 'generating' ? 'CROSS-REFERENCING MANUAL SPECS' : 'AI ANALYZING DEVICE KNOWLEDGE + MANUALS'}
              </div>
            </div>
          </div>
        )}

        {/* Error + retry — shown instead of spinner when request fails or times out */}
        {!loading && diagError && (
          <div style={{ margin: '0 16px', padding: '16px', borderRadius: 14, background: 'rgba(220,38,38,0.09)', border: `1px solid rgba(220,38,38,0.30)` }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.red, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 8 }}>
              ⚠ CONNECTION ERROR
            </div>
            <div style={{ fontFamily: SANS, fontSize: 13, color: C.textSecondary, marginBottom: 12, lineHeight: 1.5 }}>
              {diagError}
            </div>
            <button
              onClick={() => fetchStep(lastHistory)}
              style={{ padding: '10px 18px', borderRadius: 9, background: C.blue, border: 'none', color: '#FFF', fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}
            >
              RETRY ›
            </button>
          </div>
        )}

        {/* Active step */}
        {current && cfg && !loading && (
          <div style={{ padding: '0 16px' }}>
            <div style={{ ...S.stepCard, borderColor: cfg.border, background: cfg.surface }}>

              {/* Step header */}
              <div style={S.stepHeader}>
                <div style={{ ...S.stepNum, color: cfg.numColor }}>{pad2(history.length + 1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.stepTypeLabel, color: cfg.accent }}>{cfg.label}</div>
                  {current.manual_ref?.url && (
                    <a
                      href={`${current.manual_ref.url}${current.manual_ref.page ? `#page=${current.manual_ref.page}` : ''}`}
                      target="_blank" rel="noopener noreferrer" style={S.manualRef}
                    >
                      📄 MANUAL{current.manual_ref.page ? ` P.${current.manual_ref.page}` : ''}
                      {current.manual_ref.section ? ` · ${current.manual_ref.section.toUpperCase().slice(0, 26)}` : ''}
                    </a>
                  )}
                </div>
              </div>

              <div style={S.stepText}>{current.text}</div>

              {current.detail && (
                <div style={S.detailBlock}>{current.detail}</div>
              )}

              {/* Measure: expected spec + meter guide toggle */}
              {current.type === 'measure' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {current.expected ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(167,139,250,0.06)', borderRadius: 7, border: '1px solid rgba(167,139,250,0.15)' }}>
                        <span style={{ fontFamily: MONO, fontSize: 9, color: C.purple, letterSpacing: '0.1em' }}>EXPECTED</span>
                        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{current.expected} {current.unit}</span>
                      </div>
                    ) : (
                      <div style={{ flex: 1 }} />
                    )}
                    {/* Meter guide toggle */}
                    <button
                      onClick={() => setShowMeterGuide(v => !v)}
                      title="Meter setup guide"
                      style={{
                        flexShrink: 0, width: 44, height: 44, borderRadius: 8,
                        border: `1px solid ${showMeterGuide ? C.purple : C.border}`,
                        background: showMeterGuide ? 'rgba(124,58,237,0.1)' : C.bgInput,
                        cursor: 'pointer', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 1,
                        fontFamily: MONO, fontSize: 7, color: showMeterGuide ? C.purple : C.textMuted,
                        letterSpacing: '0.04em',
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>⊕</span>
                      <span>METER</span>
                    </button>
                  </div>

                  {/* Meter guide panel */}
                  {showMeterGuide && (() => {
                    const cfg = METER_CONFIGS[meterConfigKey(current.unit ?? '')] ?? METER_CONFIGS.VDC
                    return (
                      <div style={{ marginTop: 10, borderRadius: 10, border: `1px solid rgba(124,58,237,0.2)`, background: 'rgba(124,58,237,0.04)', overflow: 'hidden' }}>
                        {/* Header */}
                        <div style={{ padding: '8px 12px', borderBottom: `1px solid rgba(124,58,237,0.1)`, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.12em', color: C.purple, fontWeight: 700 }}>METER SETUP</span>
                          <span style={{ fontFamily: MONO, fontSize: 9, color: C.textPrimary, fontWeight: 700 }}>{cfg.setting}</span>
                        </div>

                        <div style={{ display: 'flex', gap: 0 }}>
                          {/* SVG meter */}
                          <div style={{ width: 110, flexShrink: 0, padding: '10px 8px 10px 10px' }}>
                            <MeterGuideSVG dialPos={cfg.dialPos} />
                          </div>

                          {/* Info column */}
                          <div style={{ flex: 1, padding: '10px 10px 10px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Range */}
                            <div style={{ padding: '6px 8px', borderRadius: 6, background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.12)' }}>
                              <div style={{ fontFamily: MONO, fontSize: 7, color: C.purple, letterSpacing: '0.1em', marginBottom: 3 }}>RANGE</div>
                              <div style={{ fontFamily: SANS, fontSize: 11, color: C.textPrimary, lineHeight: 1.4 }}>{cfg.range}</div>
                            </div>

                            {/* Probes */}
                            <div style={{ padding: '6px 8px', borderRadius: 6, background: C.bgInput, border: `1px solid ${C.border}` }}>
                              <div style={{ fontFamily: MONO, fontSize: 7, color: C.textMuted, letterSpacing: '0.1em', marginBottom: 4 }}>PROBE JACKS</div>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <div style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 5, background: '#7F1D1D', border: '1px solid #EF4444' }}>
                                  <div style={{ fontFamily: MONO, fontSize: 8, color: '#EF4444', fontWeight: 700 }}>+  RED</div>
                                  <div style={{ fontFamily: MONO, fontSize: 7, color: '#FCA5A5', marginTop: 1 }}>{cfg.jackPos}</div>
                                </div>
                                <div style={{ flex: 1, textAlign: 'center', padding: '4px 2px', borderRadius: 5, background: '#0F172A', border: '1px solid #475569' }}>
                                  <div style={{ fontFamily: MONO, fontSize: 8, color: '#94A3B8', fontWeight: 700 }}>−  BLK</div>
                                  <div style={{ fontFamily: MONO, fontSize: 7, color: '#64748B', marginTop: 1 }}>{cfg.jackNeg}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Cautions */}
                        <div style={{ borderTop: `1px solid rgba(124,58,237,0.1)`, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {cfg.cautions.map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                              <span style={{ fontFamily: MONO, fontSize: 9, color: c.level === 'danger' ? '#EF4444' : '#D97706', flexShrink: 0, marginTop: 1 }}>
                                {c.level === 'danger' ? '⚠' : '○'}
                              </span>
                              <span style={{ fontFamily: SANS, fontSize: 11, color: c.level === 'danger' ? '#FCA5A5' : C.textSecondary, lineHeight: 1.45 }}>
                                {c.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              <div style={S.divider} />

              {/* ── YES/NO question ── */}
              {current.type === 'question' && (
                <div style={S.answerRow}>
                  <button style={S.yesBtn} onClick={() => answer('Yes')}>
                    <span style={S.btnLabel as React.CSSProperties}>YES</span>
                    <span style={S.btnSub as React.CSSProperties}>PASS / CONFIRMED</span>
                  </button>
                  <button style={S.noBtn} onClick={() => answer('No')}>
                    <span style={S.btnLabel as React.CSSProperties}>NO</span>
                    <span style={S.btnSub as React.CSSProperties}>FAIL / NOT PRESENT</span>
                  </button>
                </div>
              )}

              {/* ── Action ── */}
              {current.type === 'action' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button style={S.doneBtn} onClick={() => answer('Done')}>DONE — CONTINUE ›</button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text" value={freeText} onChange={e => setFreeText(e.target.value)}
                      placeholder="Describe what you observed…"
                      style={{ ...S.monoInput, flex: 1, margin: 0 }}
                      onKeyDown={e => { if (e.key === 'Enter' && freeText.trim()) { answer(freeText); setFreeText('') }}}
                    />
                    <button style={S.sendBtn} onClick={() => { if (freeText.trim()) { answer(freeText); setFreeText('') }}}>›</button>
                  </div>
                </div>
              )}

              {/* ── Measure ── */}
              {current.type === 'measure' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Input row */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number" inputMode="decimal" value={measureInput}
                      onChange={e => setMeasureInput(e.target.value)}
                      placeholder="0.0" autoFocus
                      style={{ ...S.monoInput, flex: 1, fontSize: 22, textAlign: 'center', padding: '14px' }}
                      onKeyDown={e => { if (e.key === 'Enter' && measureInput) answer(`${measureInput} ${current.unit || ''}`.trim()) }}
                    />
                    {current.unit && (
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.purple, flexShrink: 0, minWidth: 40, textAlign: 'center' }}>
                        {current.unit}
                      </div>
                    )}
                  </div>

                  {/* Real-time pass/fail indicator */}
                  {measureInput && current.expected && (() => {
                    const result = checkMeasureResult(measureInput, current.expected)
                    const range  = parseMeasureExpected(current.expected)
                    if (!result) return null
                    const isPass = result === 'pass'
                    return (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 8,
                        background: isPass ? 'rgba(5,150,105,0.13)' : 'rgba(220,38,38,0.13)',
                        border: `1px solid ${isPass ? 'rgba(5,150,105,0.38)' : 'rgba(220,38,38,0.38)'}`,
                      }}>
                        <span style={{ fontSize: 18 }}>{isPass ? '✓' : '✗'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: isPass ? C.green : C.red, letterSpacing: '0.1em' }}>
                            {isPass ? 'IN SPEC' : 'OUT OF SPEC'}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 2 }}>
                            {range && isFinite(range.min) && isFinite(range.max)
                              ? `Expected ${range.min.toFixed(1)} – ${range.max.toFixed(1)} ${current.unit ?? ''}`
                              : `Expected ${current.expected} ${current.unit ?? ''}`}
                          </div>
                        </div>
                        <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: isPass ? C.green : C.red }}>
                          {parseFloat(measureInput).toFixed(1)} {current.unit ?? ''}
                        </span>
                      </div>
                    )
                  })()}

                  <button
                    onClick={() => { if (measureInput) answer(`${measureInput} ${current.unit || ''}`.trim()) }}
                    disabled={!measureInput}
                    style={{ ...S.doneBtn, opacity: measureInput ? 1 : 0.3, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', color: C.purple }}
                  >
                    SUBMIT READING ›
                  </button>
                  <button style={{ ...S.ghostSmBtn }} onClick={() => answer('Could not measure')}>
                    UNABLE TO MEASURE
                  </button>
                </div>
              )}

              {/* ── Select (multiple choice) ── */}
              {current.type === 'select' && current.choices && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {current.choices.map(choice => (
                    <button key={choice} onClick={() => answer(choice)} style={{
                      width: '100%', padding: '13px 16px', borderRadius: 9,
                      background: 'rgba(56,189,248,0.10)', border: `1px solid rgba(56,189,248,0.32)`,
                      color: C.textPrimary, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                      fontFamily: SANS, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      {choice}
                      <span style={{ color: C.blue, fontSize: 16 }}>›</span>
                    </button>
                  ))}
                </div>
              )}

              {/* ── Photo capture ── */}
              {current.type === 'photo' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    ref={photoRef} type="file" accept="image/*" capture="environment"
                    onChange={handlePhoto} style={{ display: 'none' }}
                  />
                  {!photoData ? (
                    <button onClick={() => photoRef.current?.click()} style={{
                      padding: '20px', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(245,158,11,0.10)', border: `1.5px dashed rgba(245,158,11,0.42)`,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ fontSize: 28 }}>📷</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.amber, letterSpacing: '0.1em' }}>TAP TO TAKE PHOTO</span>
                      <span style={{ fontFamily: SANS, fontSize: 12, color: C.textMuted }}>Camera opens for capture</span>
                    </button>
                  ) : (
                    <div>
                      <img src={photoData} alt="Captured" style={{ width: '100%', borderRadius: 8, marginBottom: 10, maxHeight: 200, objectFit: 'cover' }} />
                      {analyzing && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                          <div style={S.spinner} />
                          <span style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted, letterSpacing: '0.08em' }}>AI ANALYZING IMAGE…</span>
                        </div>
                      )}
                      {photoAnalysis && !analyzing && (
                        <div style={{ ...S.detailBlock, borderLeft: `2px solid ${C.amber}`, marginBottom: 10 }}>
                          <div style={{ fontFamily: MONO, fontSize: 8, color: C.amber, letterSpacing: '0.14em', marginBottom: 4 }}>AI OBSERVATION</div>
                          {photoAnalysis}
                        </div>
                      )}
                      {!analyzing && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => { setPhotoData(null); setPhotoAnalysis(null) }} style={{ ...S.ghostSmBtn, flex: 1 }}>RETAKE</button>
                          <button
                            onClick={() => answer(photoAnalysis ? `Photo analysis: ${photoAnalysis}` : 'Photo captured')}
                            style={{ flex: 2, padding: '12px', borderRadius: 9, background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.3)`, color: C.amber, fontFamily: MONO, fontSize: 11, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em' }}
                          >
                            CONTINUE ›
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button style={S.ghostSmBtn} onClick={() => answer('Skipped photo')}>SKIP PHOTO</button>
                </div>
              )}

              {/* ── Terminal: escalate ── */}
              {current.type === 'escalate' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button style={S.newSessionBtn} onClick={reset}>NEW SESSION</button>
                  <button style={S.keepGoingBtn} onClick={() => answer('Continue diagnosing')}>CONTINUE</button>
                </div>
              )}

              {/* ── Terminal: resolved — resolution capture + learning loop ── */}
              {current.type === 'resolved' && (
                <div>
                  {/* Did this fix it? */}
                  {resolutionConfirmed === null && !resolutionSaved && (
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: C.textMuted, marginBottom: 10 }}>
                        DID THIS FIX IT?
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          style={{ flex: 1, padding: '16px 12px', borderRadius: 13, background: 'rgba(5,150,105,0.14)', border: `1px solid rgba(5,150,105,0.42)`, color: C.green, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 2px 14px rgba(16,185,129,0.12)' }}
                          onClick={() => { setResolutionConfirmed('yes'); pingGPS('job_end') }}
                        >
                          ✓ YES
                        </button>
                        <button
                          style={{ flex: 1, padding: '16px 12px', borderRadius: 13, background: 'rgba(220,38,38,0.12)', border: `1px solid rgba(220,38,38,0.38)`, color: C.red, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}
                          onClick={() => answer('No — issue persists')}
                        >
                          ✗ NO
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Yes → capture what fixed it */}
                  {resolutionConfirmed === 'yes' && !resolutionSaved && (
                    <div>
                      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: C.green, marginBottom: 8 }}>
                        ✓ GREAT — WHAT FIXED IT?
                      </div>
                      <div style={{ fontFamily: SANS, fontSize: 12, color: C.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
                        Your note gets saved to our knowledge base so the AI learns from this fix.
                      </div>
                      <textarea
                        value={resolutionNote}
                        onChange={e => setResolutionNote(e.target.value)}
                        placeholder="e.g. Replaced faulty photobeam receiver — RX LED was showing misaligned but beam was actually damaged internally. Swapped unit, re-aligned, gate resumed normal operation."
                        rows={4}
                        style={{ ...S.textarea, fontSize: 13, marginBottom: 10 }}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          onClick={submitResolution}
                          disabled={!resolutionNote.trim() || resolutionSubmitting}
                          style={{
                            flex: 2, padding: '13px', borderRadius: 12,
                            background: resolutionNote.trim() ? C.blue : C.bgInput,
                            border: resolutionNote.trim() ? 'none' : `1px solid ${C.border}`,
                            color: resolutionNote.trim() ? '#FFF' : C.textMuted,
                            fontFamily: MONO, fontSize: 11, fontWeight: 700,
                            letterSpacing: '0.1em', cursor: resolutionNote.trim() ? 'pointer' : 'not-allowed',
                            opacity: resolutionSubmitting ? 0.6 : 1,
                          }}
                        >
                          {resolutionSubmitting ? 'SAVING…' : 'SUBMIT & SAVE TO KB ›'}
                        </button>
                        <button
                          style={{ flex: 1, padding: '13px', borderRadius: 12, background: C.bgInput, border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer' }}
                          onClick={() => { setResolutionSaved(true) }}
                        >
                          SKIP
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Saved confirmation */}
                  {resolutionSaved && (
                    <div>
                      <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(5,150,105,0.08)', border: `1px solid rgba(5,150,105,0.25)`, marginBottom: 10 }}>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: '0.14em', fontWeight: 700 }}>
                          {resolutionNote.trim() ? '✓ RESOLUTION SAVED TO KNOWLEDGE BASE' : '✓ SESSION CLOSED'}
                        </div>
                        {resolutionNote.trim() && (
                          <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
                            The AI will surface this fix in future sessions with similar symptoms.
                          </div>
                        )}
                      </div>
                      <button style={{ ...S.newSessionBtn, width: '100%' }} onClick={reset}>NEW SESSION</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div style={S.footer}>
        <span style={{ color: C.green }}>● ONLINE</span>
        <span style={{ color: C.textMuted }}>STEP {pad2(stepCount)} · {shortSession(sessionId)}</span>
        {selected?.manual_url
          ? <span style={{ color: C.blue }}>AI-READY</span>
          : <span style={{ color: C.amber }}>GENERAL MODE</span>
        }
      </div>
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: TRAINING — course catalog
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'training') {
    const courses = [
      {
        id: 'ul325',
        title: 'UL 325 — Gate Operator Safety',
        subtitle: 'Entrapment protection, operator classes, required devices & field compliance',
        icon: '🚧',
        color: C.amber,
        lessons: 6,
        duration: '~20 min',
        badge: 'REQUIRED',
      },
      {
        id: 'nec',
        title: 'NEC 725 — Low Voltage Wiring',
        subtitle: 'Class 2 circuits, voltage limits, separation rules for access control',
        icon: '⚡',
        color: C.blue,
        lessons: 4,
        duration: '~15 min',
        badge: 'COMING SOON',
        locked: true,
      },
      {
        id: 'brivo',
        title: 'Brivo ACS — Commissioning',
        subtitle: 'Panel setup, credential provisioning, door config & reader pairing',
        icon: '🔐',
        color: C.green,
        lessons: 5,
        duration: '~25 min',
        badge: 'COMING SOON',
        locked: true,
      },
    ]
    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('home')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>TRAINING &amp; CERTIFICATION</div>
            <div style={S.topBarSub}>GATEGUARD FIELD TECH PROGRAM</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.1em' }}>🎓 1 ACTIVE</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.14em', marginBottom: 14 }}>
            COURSE CATALOG
          </div>

          {courses.map(course => (
            <div
              key={course.id}
              onClick={() => { if (!course.locked) { setActiveCourse(course.id); setScreen('training_course') } }}
              style={{
                background: C.bgCard,
                borderRadius: 14,
                border: `1px solid ${course.locked ? C.border : course.color + '44'}`,
                padding: '16px',
                marginBottom: 12,
                cursor: course.locked ? 'default' : 'pointer',
                opacity: course.locked ? 0.55 : 1,
                boxShadow: course.locked ? 'none' : '0 2px 10px rgba(107,126,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: course.color + '18', border: `1.5px solid ${course.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                  {course.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: course.locked ? C.textMuted : C.textPrimary, letterSpacing: '0.04em' }}>{course.title}</div>
                    <div style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, color: course.locked ? C.textMuted : course.color, background: (course.locked ? C.border : course.color + '18'), borderRadius: 4, padding: '2px 6px', letterSpacing: '0.08em', flexShrink: 0 }}>
                      {course.badge}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>{course.subtitle}</div>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted }}>{course.lessons} lessons</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted }}>{course.duration}</span>
                  </div>
                </div>
                {!course.locked && (
                  <div style={{ fontFamily: MONO, fontSize: 18, color: course.color, flexShrink: 0 }}>›</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: TRAINING COURSE — UL 325 content
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'training_course' && activeCourse === 'ul325') {
    const sections = [
      {
        id: 'overview',
        title: 'What is UL 325?',
        icon: '📋',
        color: C.blue,
        content: [
          { type: 'body', text: 'UL 325 is the Underwriters Laboratories safety standard for door, drapery, gate, louver, and window operators and systems. In the gate industry, UL 325 is the primary safety compliance standard governing all vehicular and pedestrian gate operators installed in the United States.' },
          { type: 'body', text: 'The standard requires that gate operators include entrapment protection to prevent people or objects from being trapped, crushed, or struck by a moving gate.' },
          { type: 'callout', color: C.amber, title: 'Why It Matters in the Field', text: 'An operator installed without compliant entrapment protection is a liability for the dealer, the property owner, and potentially criminal exposure if injury occurs. This is not optional.' },
        ],
      },
      {
        id: 'classes',
        title: 'Gate Operator Classes (I–IV)',
        icon: '🏷️',
        color: C.blue,
        content: [
          { type: 'table', rows: [
            { label: 'Class I', value: 'Residential vehicular gate operator — single-family residence', color: C.green },
            { label: 'Class II', value: 'Commercial or general access — multi-family, business, school', color: C.blue },
            { label: 'Class III', value: 'Industrial/limited access — for authorized pedestrians only', color: C.amber },
            { label: 'Class IV', value: 'Restricted access — prisons, security facilities, no unauthorized access', color: C.red },
          ]},
          { type: 'callout', color: C.blue, title: 'Class Determines Requirements', text: 'Class II is the most common in multifamily. The entrapment protection requirements are more stringent for Class II than Class I. When in doubt, classify UP.' },
        ],
      },
      {
        id: 'zones',
        title: 'Entrapment Protection Zones',
        icon: '📐',
        color: C.purple,
        content: [
          { type: 'body', text: 'UL 325 defines 8 entrapment protection zones — specific areas around the gate travel path where a person could become trapped. Each zone must be protected by at least one listed entrapment protection device.' },
          { type: 'table', rows: [
            { label: 'Zone 1', value: 'Leading edge of gate travel (direction of travel)' },
            { label: 'Zone 2', value: 'Trailing edge of gate travel' },
            { label: 'Zone 3', value: 'Post / pillar on the leading edge side' },
            { label: 'Zone 4', value: 'Post / pillar on the trailing edge side' },
            { label: 'Zone 5', value: 'Under the gate (bottom edge, vertical lift)' },
            { label: 'Zone 6', value: 'Between the gate panels (sliding / folding)' },
            { label: 'Zone 7', value: 'Pinch point between moving and stationary parts' },
            { label: 'Zone 8', value: 'Any exposed moving mechanical component' },
          ]},
          { type: 'callout', color: C.purple, title: 'Field Reality', text: 'For a standard residential swing or slide gate, you primarily worry about Zones 1–4. For industrial or barrier gates, all 8 zones apply. Sketch the gate, mark each zone, then confirm device coverage.' },
        ],
      },
      {
        id: 'devices',
        title: 'Required Entrapment Protection Devices',
        icon: '🔒',
        color: C.green,
        content: [
          { type: 'body', text: 'UL 325 requires at least one PRIMARY and one SECONDARY entrapment protection device for each required zone. The specific combination depends on operator class.' },
          { type: 'table', rows: [
            { label: 'Photo Eye (Photobeam)', value: 'PRIMARY — non-contact sensor. Required on leading edge (Zone 1). Must be listed for vehicular gate use.', color: C.blue },
            { label: 'Safety Edge / Sensing Edge', value: 'PRIMARY or SECONDARY — contact sensor strip on gate edge. Triggers reverse on contact.', color: C.green },
            { label: 'Loop Detector (Vehicle)', value: 'SECONDARY — detects vehicle presence in gate path. Does NOT count for pedestrian entrapment.', color: C.amber },
            { label: 'Monitored Entrapment Device', value: 'Active sensor that confirms device is operational. Required by some operators on Class II+.', color: C.purple },
            { label: 'Obstruction Reset', value: 'After entrapment event, gate must require manual reset before resuming auto-close.', color: C.red },
          ]},
          { type: 'callout', color: C.red, title: '⚠ Critical Rule — 2 Device Minimum', text: 'Class II operators require a minimum of TWO entrapment protection devices per protected zone. One photo eye alone is NOT sufficient for a commercial/multifamily install. You must have a photo eye AND a safety edge or secondary device.' },
        ],
      },
      {
        id: 'placards',
        title: 'Warning Labels & Placards',
        icon: '⚠️',
        color: C.amber,
        content: [
          { type: 'body', text: 'UL 325 mandates specific warning labels be permanently attached to the operator. Failure to install required placards makes the installation non-compliant — regardless of device coverage.' },
          { type: 'table', rows: [
            { label: 'Operator Placard', value: 'On the operator housing. Includes emergency release instructions, keep-clear warning, and entrapment zone diagram.' },
            { label: 'Keep Clear Sign', value: 'Posted at gate entry/exit. "WARNING — MOVING GATE CAN CAUSE SEVERE INJURY OR DEATH — KEEP CLEAR"' },
            { label: 'Emergency Release', value: 'Label on or next to manual release mechanism (breakaway chain, handle, or key switch).' },
            { label: 'Contact Info', value: 'Installer/service company name and phone number must be affixed to the operator. This is you.' },
          ]},
          { type: 'callout', color: C.amber, title: 'Installer Liability', text: 'Your company name goes on the operator. If a future injury occurs and there\'s no installer placard, the trail leads back to whoever last serviced the gate. Always install the label.' },
        ],
      },
      {
        id: 'testing',
        title: 'Field Testing & Monthly Test Procedure',
        icon: '✅',
        color: C.green,
        content: [
          { type: 'body', text: 'After installation and during every service visit, you must verify entrapment protection devices are operational. Document the test in your work order.' },
          { type: 'table', rows: [
            { label: 'Step 1 — Visual', value: 'Confirm photo eyes are mounted, aligned, and indicator light shows beam is clear.' },
            { label: 'Step 2 — Break Beam', value: 'While gate is in motion, break the photo eye beam. Gate must stop and reverse within ≤0.5 seconds.' },
            { label: 'Step 3 — Safety Edge', value: 'Apply moderate pressure to the sensing edge. Gate must stop and reverse on contact.' },
            { label: 'Step 4 — Loop Detector', value: 'Activate loop to confirm vehicle detection. Gate should not close on active loop.' },
            { label: 'Step 5 — Auto-Close Timer', value: 'Verify auto-close delay is set. Gate should not leave open indefinitely.' },
            { label: 'Step 6 — Manual Release', value: 'Test emergency release. Gate must be manually movable after release engagement.' },
            { label: 'Step 7 — Document', value: 'Log date, tech initials, and PASS/FAIL for each test point in the work order.' },
          ]},
          { type: 'callout', color: C.green, title: '✓ Compliance Check — Leave This on Site', text: 'On every service call where you touch a gate operator, run this checklist and leave a signed copy with the property. If you\'re ever called into a post-incident investigation, your documentation is your proof of compliance.' },
        ],
      },
    ]

    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('training')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>UL 325 — GATE OPERATOR SAFETY</div>
            <div style={S.topBarSub}>FIELD TECH CERTIFICATION · {sections.length} SECTIONS</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.1em' }}>🚧 REQUIRED</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Course header */}
          <div style={{ background: C.bgCard, borderRadius: 14, padding: '16px', marginBottom: 16, border: `1px solid ${C.amber}44`, boxShadow: '0 2px 10px rgba(245,158,11,0.10)' }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.amber, letterSpacing: '0.14em', marginBottom: 6 }}>UNDERWRITERS LABORATORIES</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary, lineHeight: 1.3, marginBottom: 8 }}>Standard for Safety — Door, Drapery, Gate, Louver, and Window Operators and Systems</div>
            <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.55 }}>
              The governing safety standard for all gate operator installations in the US. Covers entrapment protection, operator classification, required devices, warning labels, and testing requirements. Compliance is not optional — it is the legal baseline for every install.
            </div>
          </div>

          {sections.map((section, si) => (
            <div key={section.id} style={{ marginBottom: 16 }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: section.color + '18', border: `1.5px solid ${section.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {section.icon}
                </div>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.14em', marginBottom: 2 }}>SECTION {si + 1} OF {sections.length}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{section.title}</div>
                </div>
              </div>

              {/* Section content */}
              {section.content.map((block: { type: string; text?: string; title?: string; color?: string; rows?: Array<{ label: string; value: string; color?: string }> }, bi) => {
                if (block.type === 'body') {
                  return (
                    <div key={bi} style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.65, marginBottom: 10, padding: '0 4px' }}>
                      {block.text}
                    </div>
                  )
                }
                if (block.type === 'table') {
                  return (
                    <div key={bi} style={{ background: C.bgCard, borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 10 }}>
                      {block.rows!.map((row, ri) => (
                        <div key={ri} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: ri < block.rows!.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'flex-start' }}>
                          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: row.color ?? section.color, flexShrink: 0, minWidth: 70, paddingTop: 1 }}>{row.label}</div>
                          <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{row.value}</div>
                        </div>
                      ))}
                    </div>
                  )
                }
                if (block.type === 'callout') {
                  return (
                    <div key={bi} style={{ borderRadius: 10, padding: '12px 14px', marginBottom: 10, background: (block.color ?? C.blue) + '10', border: `1px solid ${(block.color ?? C.blue)}33` }}>
                      {block.title && <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: block.color ?? C.blue, letterSpacing: '0.1em', marginBottom: 5 }}>{block.title}</div>}
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6 }}>{block.text}</div>
                    </div>
                  )
                }
                return null
              })}

              {si < sections.length - 1 && <div style={{ height: 1, background: C.border, margin: '4px 0 4px' }} />}
            </div>
          ))}

          {/* Completion card */}
          <div style={{ background: C.bgCard, borderRadius: 14, padding: '18px', border: `1px solid ${C.green}44`, boxShadow: '0 2px 10px rgba(16,185,129,0.10)', marginTop: 8, marginBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: '0.14em', marginBottom: 6 }}>✓ COURSE COMPLETE</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>UL 325 — Gate Operator Safety</div>
            <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.6, marginBottom: 14 }}>
              You covered operator classification (Classes I–IV), all 8 entrapment protection zones, primary and secondary device requirements, warning label placement, and the 7-step field testing procedure.
            </div>
            <div style={{ background: C.bgInput, borderRadius: 8, padding: '10px 14px', fontFamily: MONO, fontSize: 10, color: C.textMuted, letterSpacing: '0.1em' }}>
              PORTAL CERTIFICATION · Coming soon — complete test in portal to receive tech cert badge
            </div>
          </div>

          <button
            style={{ ...S.primaryBtn, marginBottom: 24 }}
            onClick={() => setScreen('training')}
          >
            ← BACK TO COURSES
          </button>

        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SCREEN: NETSCOUT — connectivity probe + network scanner
  // ═══════════════════════════════════════════════════════════════════════════
  if (screen === 'netscout') {
    const runScan = async () => {
      setNetscoutRunning(true)
      setNetscoutError(null)
      try {
        const res = await fetch('/api/tech/netscout', {
          headers: { 'x-tech-code': techCode },
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setNetscoutData(data)
      } catch (e) {
        setNetscoutError(e instanceof Error ? e.message : 'Scan failed')
      } finally {
        setNetscoutRunning(false)
      }
    }

    const statusColor = (s: string) =>
      s === 'ok' ? C.green : s === 'slow' ? C.amber : C.red

    const statusIcon = (s: string) =>
      s === 'ok' ? '✓' : s === 'slow' ? '⚠' : '✗'

    // Browser connection info
    const conn = typeof navigator !== 'undefined' && 'connection' in navigator
      ? (navigator as unknown as { connection: { effectiveType?: string; downlink?: number; rtt?: number; type?: string } }).connection
      : null

    return (
      <div style={S.shell}>
        {/* Top bar */}
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('home')}>←</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>📡 NETSCOUT</div>
            <div style={S.topBarSub}>CONNECTIVITY · NETWORK · CLIENTS</div>
          </div>
          <div style={{ ...S.statusPill, color: netscoutData ? C.green : C.textMuted }}>
            {netscoutData ? '● SCANNED' : '○ READY'}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>

          {/* Device connection info */}
          {conn != null && (() => {
            const c = conn!
            return (
              <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.16em', marginBottom: 10 }}>📶 THIS DEVICE</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {c.effectiveType && (
                    <div style={{ background: C.bgInput, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.blue }}>{c.effectiveType!.toUpperCase()}</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>SIGNAL</div>
                    </div>
                  )}
                  {c.downlink !== undefined && (
                    <div style={{ background: C.bgInput, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{c.downlink} Mbps</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>DOWNLINK</div>
                    </div>
                  )}
                  {c.rtt !== undefined && (
                    <div style={{ background: C.bgInput, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: (c.rtt ?? 0) > 200 ? C.amber : C.green }}>{c.rtt}ms</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>RTT</div>
                    </div>
                  )}
                  {c.type && (
                    <div style={{ background: C.bgInput, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{c.type!.toUpperCase()}</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.1em', marginTop: 2 }}>TYPE</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Scan button */}
          <button
            style={{ ...S.primaryBtn, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            onClick={runScan}
            disabled={netscoutRunning}
          >
            {netscoutRunning
              ? <><span style={S.spinner} />SCANNING…</>
              : <>{netscoutData ? '↺ RE-SCAN' : '⚡ RUN NETWORK SCAN'}</>
            }
          </button>

          {netscoutError && (
            <div style={{ background: 'rgba(248,113,113,0.08)', border: `1px solid rgba(248,113,113,0.28)`, borderRadius: 10, padding: '12px 14px', marginBottom: 12, fontFamily: MONO, fontSize: 11, color: C.red, letterSpacing: '0.06em' }}>
              ✗ {netscoutError}
            </div>
          )}

          {/* Probe results */}
          {netscoutData != null && (() => {
            const nd = netscoutData!
            return (
            <>
              <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 12 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.16em', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: C.bgInput }}>
                  🌐 ENDPOINT CONNECTIVITY
                  <span style={{ float: 'right', color: C.textMuted }}>
                    {new Date(nd.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {nd.probes.map((p, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '12px 14px', borderBottom: i < nd.probes.length - 1 ? `1px solid ${C.border}` : 'none', gap: 12 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${statusColor(p.status)}18`, border: `1px solid ${statusColor(p.status)}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: statusColor(p.status), flexShrink: 0 }}>
                      {statusIcon(p.status)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.04em' }}>{p.label}</div>
                      {p.error && <div style={{ fontFamily: MONO, fontSize: 9, color: C.red, letterSpacing: '0.06em', marginTop: 2 }}>{p.error}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: statusColor(p.status) }}>
                        {p.status.toUpperCase()}
                      </div>
                      <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, marginTop: 1 }}>
                        {p.latency_ms !== null ? `${p.latency_ms}ms` : '—'}
                        {p.http_code ? ` · ${p.http_code}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary chips */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {(['ok', 'slow', 'fail'] as const).map(s => {
                  const count = nd.probes.filter(p => p.status === s).length
                  if (count === 0) return null
                  return (
                    <div key={s} style={{ background: `${statusColor(s)}14`, border: `1px solid ${statusColor(s)}40`, borderRadius: 8, padding: '6px 12px', fontFamily: MONO, fontSize: 10, color: statusColor(s), fontWeight: 700, letterSpacing: '0.08em' }}>
                      {statusIcon(s)} {count} {s.toUpperCase()}
                    </div>
                  )
                })}
              </div>

              {/* UniFi clients */}
              {nd.unifi_count > 0 && (
                <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.16em', padding: '10px 14px', borderBottom: `1px solid ${C.border}`, background: C.bgInput }}>
                    🔌 UNIFI CLIENTS ({nd.unifi_count})
                  </div>
                  {nd.unifi_clients.slice(0, 20).map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < Math.min(nd.unifi_clients.length, 20) - 1 ? `1px solid ${C.border}` : 'none', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: c.is_wired ? 'rgba(16,185,129,0.12)' : 'rgba(107,126,255,0.12)', border: `1px solid ${c.is_wired ? 'rgba(16,185,129,0.30)' : 'rgba(107,126,255,0.30)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>
                        {c.is_wired ? '🔌' : '📶'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.hostname ?? c.name ?? c.mac}
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.04em' }}>
                          {c.ip ?? '—'}{c.essid ? ` · ${c.essid}` : ''}
                        </div>
                      </div>
                      {c.signal !== null && c.signal !== undefined && !c.is_wired && (
                        <div style={{ fontFamily: MONO, fontSize: 10, color: c.signal > -65 ? C.green : c.signal > -80 ? C.amber : C.red, fontWeight: 700, flexShrink: 0 }}>
                          {c.signal}dBm
                        </div>
                      )}
                    </div>
                  ))}
                  {nd.unifi_count > 20 && (
                    <div style={{ padding: '10px 14px', fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', textAlign: 'center' }}>
                      +{nd.unifi_count - 20} more clients
                    </div>
                  )}
                </div>
              )}

              {nd.unifi_error && (
                <div style={{ background: C.bgInput, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontFamily: MONO, fontSize: 10, color: C.textMuted, letterSpacing: '0.06em' }}>
                  ℹ UniFi: {nd.unifi_error} — no org UniFi credentials configured
                </div>
              )}

              {/* Tips */}
              <div style={{ background: C.bgCard, borderRadius: 12, border: `1px solid ${C.border}`, padding: '14px 16px', marginBottom: 24 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.16em', marginBottom: 10 }}>💡 FIELD TIPS</div>
                {[
                  { label: 'Brivo offline?', tip: 'Check auth.brivo.com probe. If fail: site internet issue, not a Brivo outage.' },
                  { label: 'Portal slow?', tip: 'RTT >3s = poor cellular. Move closer to window or switch to WiFi.' },
                  { label: 'All probes fail?', tip: 'Total connectivity loss. Check cellular data on, airplane mode off.' },
                  { label: 'UniFi not showing?', tip: 'Org needs UniFi host + API key configured in dealer settings.' },
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, marginBottom: i < 3 ? 8 : 0 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.blue, flexShrink: 0, minWidth: 120 }}>{t.label}</div>
                    <div style={{ fontFamily: SANS, fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>{t.tip}</div>
                  </div>
                ))}
              </div>
            </>
            )
          })()}

          {/* Empty state before first scan */}
          {!netscoutData && !netscoutRunning && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📡</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.04em', marginBottom: 8 }}>NETWORK SCANNER</div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.6, maxWidth: 280, margin: '0 auto' }}>
                Probe GateGuard endpoints, Brivo, Eagle Eye, and pull connected UniFi clients from the property controller.
              </div>
            </div>
          )}

        </div>

        {/* Bottom nav */}
        <div style={S.legendStrip}>
          <button onClick={() => setScreen('home')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="diagnose" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>DIAGNOSE</span>
          </button>
          <button onClick={() => setScreen('wiring')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="wiring" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>WIRING</span>
          </button>
          <button onClick={() => setScreen('cable')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="cable" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>CABLE</span>
          </button>
          <button onClick={() => { setSurveyProposal(null); setScreen('survey') }} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="survey" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>SURVEY</span>
          </button>
          {/* NETSCOUT — active */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: `2.5px solid ${C.blue}`, background: 'rgba(107,126,255,0.06)' }}>
            <span style={{ fontSize: 22 }}>📡</span>
            <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: C.blue, letterSpacing: '0.06em' }}>NETSCOUT</span>
          </div>
          <button onClick={() => setScreen('training')} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0', borderTop: '2.5px solid transparent', background: 'none', border: 'none', cursor: 'pointer' }}>
            <span style={{ color: C.textSecondary, display: 'flex' }}><NavIcon k="train" /></span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.textSecondary, letterSpacing: '0.06em' }}>TRAIN</span>
          </button>
        </div>
      </div>
    )
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// Two-tone layout: dark navy topBar + clean white/light content.
// Touch targets ≥44px — outdoor / gloved use.
const S: Record<string, React.CSSProperties> = {
  shell:        { minHeight: '100dvh', maxHeight: '100dvh', background: 'radial-gradient(ellipse at 50% -10%, rgba(0,124,255,0.12), transparent 55%), linear-gradient(180deg, #0a1430 0%, #060b1a 60%, #04060f 100%)', display: 'flex', flexDirection: 'column', fontFamily: SANS, maxWidth: 480, margin: '0 auto', overflow: 'hidden' },

  // ── PIN screen card ───────────────────────────────────────────────────────
  pinCard:      { width: '100%', maxWidth: 360, padding: '44px 32px', background: C.bgCard, borderRadius: 28, border: `1px solid ${C.borderMed}`, margin: '0 20px', boxShadow: '0 0 60px rgba(107,126,255,0.18), 0 4px 40px rgba(0,0,0,0.6)' },
  pinLogo:      { width: 84, height: 84, borderRadius: 22, background: 'rgba(107,126,255,0.15)', border: `1.5px solid rgba(107,126,255,0.50)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 24, fontWeight: 700, color: C.blue, margin: '0 auto', letterSpacing: '0.05em', boxShadow: '0 0 32px rgba(107,126,255,0.30), inset 0 1px 0 rgba(255,255,255,0.08)' },

  // ── Top bar — DEEP DARK (header identity strip) ───────────────────────────
  topBar:       { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', paddingTop: 'calc(14px + env(safe-area-inset-top))', background: C.topBarBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, boxShadow: '0 2px 24px rgba(0,0,0,0.5)' },
  diagHeader:   { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top))', background: C.topBarBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 },
  ggMark:       { width: 40, height: 40, borderRadius: 11, background: 'rgba(107,126,255,0.18)', border: '1.5px solid rgba(107,126,255,0.50)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.blue, flexShrink: 0, letterSpacing: '0.05em', boxShadow: '0 0 14px rgba(107,126,255,0.22)' },
  topBarTitle:  { fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.textOnDark, letterSpacing: '0.08em' },
  topBarSub:    { fontFamily: MONO, fontSize: 9, color: 'rgba(107,160,255,0.50)', letterSpacing: '0.12em', marginTop: 2 },
  statusPill:   { fontFamily: MONO, fontSize: 9, color: C.green, letterSpacing: '0.12em', border: '1px solid rgba(16,185,129,0.38)', borderRadius: 5, padding: '4px 8px', flexShrink: 0, background: 'rgba(16,185,129,0.10)' },
  sessionId:    { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.textOnDark, letterSpacing: '0.06em' },
  iconBtn:      { width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(200,220,255,0.80)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: MONO },

  // ── Progress / indicators ─────────────────────────────────────────────────
  progressBar:  { height: 3, background: C.bgDeep, flexShrink: 0 },
  progressFill: { height: '100%', background: `linear-gradient(90deg, ${C.blue} 0%, #9B6BFF 100%)`, transition: 'width 0.4s ease' },

  // ── Bottom navigation bar ─────────────────────────────────────────────────
  legendStrip:  { display: 'flex', borderTop: '1px solid rgba(255,255,255,0.08)', background: C.topBarBg, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', flexShrink: 0, boxShadow: '0 -4px 24px rgba(0,0,0,0.45)', minHeight: 64, paddingBottom: 'env(safe-area-inset-bottom)' },

  // ── Form elements ─────────────────────────────────────────────────────────
  fieldLabel:   { fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: C.textMuted, marginBottom: -4 },
  textarea:     { width: '100%', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 15px', color: C.textPrimary, fontSize: 15, lineHeight: 1.65, outline: 'none', resize: 'none', fontFamily: SANS, boxSizing: 'border-box' },
  monoInput:    { width: '100%', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 12, padding: '13px 14px', color: C.textPrimary, fontSize: 14, outline: 'none', fontFamily: MONO, letterSpacing: '0.04em', boxSizing: 'border-box' },
  chip:         { padding: '9px 15px', borderRadius: 8, border: '1px solid', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer' },
  primaryBtn:   { width: '100%', padding: '20px', borderRadius: 14, background: 'linear-gradient(135deg, #6B7EFF 0%, #7C3AED 100%)', border: 'none', color: '#FFFFFF', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em', boxShadow: '0 4px 24px rgba(107,126,255,0.45)' },

  // ── Diagnostic history log ────────────────────────────────────────────────
  historyLog:   { margin: '0 16px 12px', background: C.bgCard, borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}` },
  logLabel:     { fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.bgDeep },
  logRow:       { display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${C.border}` },
  logNum:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.textMuted, flexShrink: 0, letterSpacing: '0.04em' },
  logText:      { fontFamily: SANS, fontSize: 13, color: C.textSecondary, flex: 1, lineHeight: 1.45 },
  logAns:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 },

  // ── Step cards ────────────────────────────────────────────────────────────
  stepCard:     { borderRadius: 16, border: '1px solid', padding: '20px', marginBottom: 4, boxShadow: '0 4px 28px rgba(0,0,0,0.35)' },
  stepHeader:   { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  stepNum:      { fontFamily: MONO, fontSize: 54, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', flexShrink: 0, opacity: 0.80 },
  stepTypeLabel:{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 4 },
  manualRef:    { fontFamily: MONO, fontSize: 9, color: C.blue, letterSpacing: '0.08em', textDecoration: 'none', display: 'inline-block', marginTop: 2 },
  stepText:     { fontFamily: SANS, fontSize: 19, fontWeight: 600, color: C.textPrimary, lineHeight: 1.55 },
  detailBlock:  { marginTop: 12, padding: '12px 14px', background: C.bgDeep, borderRadius: 10, borderLeft: `3px solid rgba(107,126,255,0.28)`, fontFamily: MONO, fontSize: 12, color: C.textSecondary, lineHeight: 1.75, letterSpacing: '0.01em', whiteSpace: 'pre-line' },
  divider:      { height: 1, background: 'rgba(107,126,255,0.10)', margin: '16px 0' },
  answerRow:    { display: 'flex', gap: 10 },
  yesBtn:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '22px 12px', borderRadius: 14, background: 'linear-gradient(160deg, rgba(5,150,105,0.28) 0%, rgba(16,185,129,0.15) 100%)', border: '1.5px solid rgba(16,185,129,0.50)', cursor: 'pointer', boxShadow: '0 2px 20px rgba(16,185,129,0.14)' },
  noBtn:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '22px 12px', borderRadius: 14, background: 'linear-gradient(160deg, rgba(220,38,38,0.24) 0%, rgba(248,113,113,0.13) 100%)', border: '1.5px solid rgba(248,113,113,0.50)', cursor: 'pointer', boxShadow: '0 2px 20px rgba(248,113,113,0.12)' },
  btnLabel:     { fontFamily: MONO, fontSize: 28, fontWeight: 700, letterSpacing: '0.05em', color: C.textPrimary },
  btnSub:       { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: C.textMuted },
  doneBtn:      { width: '100%', padding: '17px', borderRadius: 13, background: 'linear-gradient(135deg, rgba(245,158,11,0.20) 0%, rgba(245,158,11,0.11) 100%)', border: '1.5px solid rgba(245,158,11,0.42)', color: C.amber, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.12em' },
  sendBtn:      { padding: '12px 18px', borderRadius: 10, background: 'rgba(107,126,255,0.12)', border: '1px solid rgba(107,126,255,0.32)', color: C.blue, fontSize: 16, cursor: 'pointer', fontFamily: MONO },
  ghostSmBtn:   { width: '100%', padding: '13px', borderRadius: 10, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer' },
  logFixBtn:    { flex: 1, padding: '14px', borderRadius: 13, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.30)', color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  newSessionBtn:{ flex: 1, padding: '14px', borderRadius: 13, background: C.bgCard, border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  keepGoingBtn: { flex: 1, padding: '14px', borderRadius: 13, background: 'rgba(248,113,113,0.10)', border: '1px solid rgba(248,113,113,0.30)', color: C.red, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  footer:       { display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid rgba(107,126,255,0.10)', background: C.bgCard, fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', flexShrink: 0 },
  spinner:      { width: 22, height: 22, borderRadius: '50%', border: `2.5px solid rgba(107,126,255,0.15)`, borderTopColor: C.blue, animation: 'spin 0.7s linear infinite', flexShrink: 0 },
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function TechPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes gg-pulse { 0%,100% { box-shadow: 0 0 24px rgba(107,126,255,0.28); } 50% { box-shadow: 0 0 42px rgba(107,126,255,0.55); } }
        @keyframes gg-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { margin: 0; background: #070B14; overscroll-behavior: none; }
        button:active { opacity: 0.78; }
        ::placeholder { color: rgba(107,140,174,0.35); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .gg-chips::-webkit-scrollbar, .gg-list::-webkit-scrollbar, .gg-install::-webkit-scrollbar { display: none; }
        .gg-pin-logo { animation: gg-pulse 3s ease-in-out infinite; }
        .gg-fade-in { animation: gg-fade-in 0.4s ease-out both; }
      `}</style>
      <Suspense fallback={<div style={{ minHeight: '100dvh', background: C.bgDeep }} />}>
        <TechTool />
      </Suspense>
    </>
  )
}
