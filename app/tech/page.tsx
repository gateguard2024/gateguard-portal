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
type Screen   = 'pin' | 'home' | 'choice' | 'symptom' | 'diag' | 'wiring' | 'cable' | 'install'

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
  description: string | null
  specs:       string | null
  tags:        string[] | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:            '#F1F5F9',
  bgDeep:        '#E8EEF6',
  bgCard:        '#FFFFFF',
  bgInput:       '#F8FAFC',
  border:        'rgba(15,23,42,0.08)',
  borderMed:     'rgba(15,23,42,0.15)',
  textPrimary:   '#0F172A',
  textSecondary: '#64748B',
  textMuted:     '#94A3B8',
  blue:    '#6B7EFF',
  amber:   '#D97706',
  green:   '#059669',
  red:     '#DC2626',
  purple:  '#7C3AED',
  blueAlpha:   'rgba(107,126,255,0.09)',
  amberAlpha:  'rgba(217,119,6,0.09)',
  greenAlpha:  'rgba(5,150,105,0.09)',
  redAlpha:    'rgba(220,38,38,0.09)',
  purpleAlpha: 'rgba(124,58,237,0.09)',
}

const STEP_CFG: Record<StepType, {
  accent: string; surface: string; border: string; label: string; numColor: string
}> = {
  question: { accent: C.blue,   surface: C.blueAlpha,   border: 'rgba(56,189,248,0.18)',  label: 'VERIFY',   numColor: C.blue   },
  action:   { accent: C.amber,  surface: C.amberAlpha,  border: 'rgba(245,158,11,0.18)',  label: 'ACTION',   numColor: C.amber  },
  measure:  { accent: C.purple, surface: C.purpleAlpha, border: 'rgba(167,139,250,0.18)', label: 'MEASURE',  numColor: C.purple },
  select:   { accent: C.blue,   surface: C.blueAlpha,   border: 'rgba(56,189,248,0.18)',  label: 'SELECT',   numColor: C.blue   },
  photo:    { accent: C.amber,  surface: C.amberAlpha,  border: 'rgba(245,158,11,0.18)',  label: 'CAPTURE',  numColor: C.amber  },
  resolved: { accent: C.green,  surface: C.greenAlpha,  border: 'rgba(16,185,129,0.18)',  label: 'RESOLVED', numColor: C.green  },
  escalate: { accent: C.red,    surface: C.redAlpha,    border: 'rgba(239,68,68,0.18)',   label: 'ESCALATE', numColor: C.red    },
}

// Connected device options — what else might be wired to this device?
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
  const [loading,   setLoading]   = useState(false)
  const [freeText,  setFreeText]  = useState('')
  const [logFixed,  setLogFixed]  = useState(false)

  // Measure step state
  const [measureInput, setMeasureInput] = useState('')

  // Photo step state
  const [photoData,     setPhotoData]     = useState<string | null>(null)
  const [photoAnalysis, setPhotoAnalysis] = useState<string | null>(null)
  const [analyzing,     setAnalyzing]     = useState(false)

  // Demo / install mode state
  const [prevScreen,      setPrevScreen]     = useState<Screen | null>(null)
  const [wiringInitMapId, setWiringInitMapId] = useState<string | null>(null)
  const [installChecked,  setInstallChecked]  = useState<Set<string>>(new Set())
  const [expandedPhases,  setExpandedPhases]  = useState<Set<string>>(new Set(INSTALL_PHASES.map(p => p.id)))

  const bottomRef   = useRef<HTMLDivElement>(null)
  const photoRef    = useRef<HTMLInputElement>(null)

  // ── On mount: check sessionStorage for saved code ─────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('gg_tech_code')
    if (saved) { setTechCode(saved); setScreen('home') }
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

  // ── Auth ──────────────────────────────────────────────────────────────────
  function apiHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json', 'x-tech-code': techCode }
  }

  async function submitCode() {
    setCodeError(false)
    const code = codeInput.trim().toUpperCase()
    if (!code) return
    const res = await fetch('/api/kb/products', { headers: { 'x-tech-code': code } })
    if (res.ok) {
      const data = await res.json()
      sessionStorage.setItem('gg_tech_code', code)
      setTechCode(code); setProducts(data.products ?? []); setScreen('home')
    } else if (res.status === 401) {
      setCodeError(true); setCodeInput('')
    } else {
      alert(`Server error (${res.status}) — check Vercel env vars.`)
    }
  }

  // ── Diagnostic helpers ────────────────────────────────────────────────────
  async function startDiag() {
    if (!symptom.trim()) return
    setScreen('diag'); await fetchStep([])
  }

  async function fetchStep(h: HistoryItem[]) {
    setLoading(true)
    setCurrent(null)
    try {
      const res = await fetch('/api/kb/ask', {
        method: 'POST', headers: apiHeaders(),
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
      alert('Diagnostic error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function answer(ans: string) {
    if (!current) return
    const newH: HistoryItem[] = [...history, { question: current.text, answer: ans }]
    setHistory(newH)
    setCurrent(null)
    setMeasureInput('')
    setPhotoData(null); setPhotoAnalysis(null)
    if (current.type === 'resolved' || current.type === 'escalate') return
    await fetchStep(newH)
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
        <div style={S.pinCard}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={S.pinLogo}>GG</div>
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
            onClick={submitCode} disabled={!codeInput.trim()}
            style={{ ...S.primaryBtn, marginTop: 16, opacity: codeInput.trim() ? 1 : 0.25 }}
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
          <div style={S.ggMark}>GG</div>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>GATEGUARD FIELD TOOL</div>
            <div style={S.topBarSub}>SELECT DEVICE</div>
          </div>
          <div style={S.statusPill}>● ONLINE</div>
        </div>

        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: C.textMuted, fontSize: 14, pointerEvents: 'none' }}>⌕</span>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, brand, or SKU…"
              style={{ width: '100%', boxSizing: 'border-box', background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 8, padding: '11px 14px 11px 32px', fontFamily: SANS, fontSize: 14, color: C.textPrimary, outline: 'none', WebkitAppearance: 'none', WebkitTextFillColor: C.textPrimary }}
            />
          </div>
        </div>

        {cats.length > 2 && (
          <div className="gg-chips" style={{ display: 'flex', gap: 6, padding: '8px 16px', overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' } as React.CSSProperties}>
            {cats.map(cat => (
              <button key={cat} onClick={() => setActiveCat(cat)} style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                padding: '5px 11px', borderRadius: 20, whiteSpace: 'nowrap',
                cursor: 'pointer', flexShrink: 0,
                border: `1px solid ${activeCat === cat ? C.blue : C.border}`,
                background: activeCat === cat ? 'rgba(56,189,248,0.12)' : 'transparent',
                color: activeCat === cat ? C.blue : C.textMuted,
              }}>
                {cat === 'ALL' ? 'ALL' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        <div className="gg-list" style={{ flex: 1, overflowY: 'auto', padding: '4px 0 40px', scrollbarWidth: 'none' } as React.CSSProperties}>
          {visible.map(p => {
            const color     = brandHues[p.brand] ?? C.blue
            const hasManual = !!p.manual_url
            return (
              <button key={p.id}
                onClick={() => { setSelected(p); setScreen('choice') }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 14, background: 'transparent', border: 'none', borderBottom: `1px solid ${C.border}`, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em' }}>
                  {brandInitials(p.brand)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.textPrimary, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.textMuted, marginTop: 3, letterSpacing: '0.07em' }}>
                    {p.brand.toUpperCase()} · {p.sku}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasManual ? C.green : C.border, boxShadow: hasManual ? `0 0 6px ${C.green}` : 'none' }} />
                  <span style={{ color: C.textMuted, fontSize: 16 }}>›</span>
                </div>
              </button>
            )
          })}
          {visible.length === 0 && serviceProds.length > 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em' }}>NO DEVICES MATCH</div>
          )}
          {serviceProds.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em' }}>LOADING…</div>
          )}
        </div>

        <div style={S.legendStrip}>
          <span style={{ color: C.green }}>● AI-READY</span>
          <span style={{ color: C.textMuted }}>● MANUAL PENDING</span>
          <button
            onClick={() => setScreen('cable')}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontFamily: MONO, fontSize: 9, color: C.purple, letterSpacing: '0.08em', padding: 0 }}
          >
            🔌 CABLE GUIDE
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
          <div style={{ background: C.bgCard, borderRadius: 12, padding: '16px', border: `1px solid ${C.border}`, marginBottom: 8 }}>
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
              background: hasManual ? 'rgba(56,189,248,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${hasManual ? 'rgba(56,189,248,0.22)' : C.border}`,
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
            style={{ padding: '20px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', background: 'rgba(16,185,129,0.06)', border: `1px solid rgba(16,185,129,0.22)` }}
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
            style={{ padding: '20px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', background: 'rgba(217,119,6,0.06)', border: `1px solid rgba(217,119,6,0.22)` }}
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
            style={{ padding: '20px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', background: 'rgba(124,58,237,0.06)', border: `1px solid rgba(124,58,237,0.22)` }}
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
          <div style={S.ggMark}>GG</div>
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

        <div className="gg-install" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12, scrollbarWidth: 'none' } as React.CSSProperties}>

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
                {/* Phase header */}
                <button
                  onClick={() => togglePhase(phase.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{phase.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: isComplete ? phase.color : C.textPrimary, letterSpacing: '0.1em' }}>
                      {phase.title}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: C.textMuted, letterSpacing: '0.06em', marginTop: 2 }}>
                      {phaseDone}/{phaseSteps.length} complete
                    </div>
                  </div>
                  {isComplete && (
                    <span style={{ fontFamily: MONO, fontSize: 10, color: phase.color, flexShrink: 0 }}>✓</span>
                  )}
                  <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>›</span>
                </button>

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

        {/* Loading */}
        {loading && (
          <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={S.spinner} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.textMuted, letterSpacing: '0.08em' }}>
              ANALYZING FAULT…
            </span>
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

              {/* Measure: expected spec */}
              {current.type === 'measure' && current.expected && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', background: 'rgba(167,139,250,0.06)', borderRadius: 7, border: '1px solid rgba(167,139,250,0.15)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.purple, letterSpacing: '0.1em' }}>EXPECTED</span>
                  <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.textPrimary }}>{current.expected} {current.unit}</span>
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
                      background: 'rgba(56,189,248,0.06)', border: `1px solid rgba(56,189,248,0.2)`,
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
                      background: 'rgba(245,158,11,0.06)', border: `1px dashed rgba(245,158,11,0.3)`,
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

              {/* ── Terminal ── */}
              {isTerminal && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {!logFixed
                    ? <button style={S.logFixBtn} onClick={() => setLogFixed(true)}>LOG FIX</button>
                    : <div style={{ ...S.logFixBtn, background: C.greenAlpha, borderColor: 'rgba(16,185,129,0.3)', color: C.green, cursor: 'default' }}>✓ LOGGED</div>
                  }
                  <button style={S.newSessionBtn} onClick={reset}>NEW SESSION</button>
                  {current.type === 'escalate' && (
                    <button style={S.keepGoingBtn} onClick={() => answer('Continue diagnosing')}>CONTINUE</button>
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
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  shell:        { minHeight: '100dvh', maxHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: SANS, maxWidth: 480, margin: '0 auto', overflow: 'hidden' },
  pinCard:      { width: '100%', maxWidth: 340, padding: '32px 24px', background: C.bgCard, borderRadius: 20, border: `1px solid ${C.border}`, margin: '0 16px', boxShadow: '0 4px 32px rgba(15,23,42,0.08)' },
  pinLogo:      { width: 52, height: 52, borderRadius: 14, background: 'rgba(107,126,255,0.1)', border: `1px solid rgba(107,126,255,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.blue, margin: '0 auto', letterSpacing: '0.05em' },
  topBar:       { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0, boxShadow: '0 1px 0 rgba(15,23,42,0.06)' },
  diagHeader:   { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.bgCard, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  ggMark:       { width: 34, height: 34, borderRadius: 9, background: 'rgba(107,126,255,0.1)', border: `1px solid rgba(107,126,255,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.blue, flexShrink: 0, letterSpacing: '0.05em' },
  topBarTitle:  { fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.08em' },
  topBarSub:    { fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.12em', marginTop: 2 },
  statusPill:   { fontFamily: MONO, fontSize: 9, color: C.green, letterSpacing: '0.12em', border: `1px solid rgba(5,150,105,0.3)`, borderRadius: 5, padding: '3px 7px', flexShrink: 0, background: 'rgba(5,150,105,0.07)' },
  sessionId:    { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' },
  iconBtn:      { width: 34, height: 34, borderRadius: 8, background: C.bgInput, border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: MONO },
  progressBar:  { height: 2, background: C.border, flexShrink: 0 },
  progressFill: { height: '100%', background: C.blue, transition: 'width 0.4s ease' },
  legendStrip:  { display: 'flex', gap: 20, padding: '10px 16px', borderTop: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', flexShrink: 0, background: C.bgCard },
  fieldLabel:   { fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: C.textMuted, marginBottom: -4 },
  textarea:     { width: '100%', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '13px 14px', color: C.textPrimary, fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'none', fontFamily: SANS, boxSizing: 'border-box' },
  monoInput:    { width: '100%', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '11px 13px', color: C.textPrimary, fontSize: 13, outline: 'none', fontFamily: MONO, letterSpacing: '0.04em', boxSizing: 'border-box' },
  chip:         { padding: '6px 12px', borderRadius: 5, border: '1px solid', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer' },
  primaryBtn:   { width: '100%', padding: '16px', borderRadius: 12, background: C.blue, border: 'none', color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em', boxShadow: '0 2px 8px rgba(107,126,255,0.25)' },
  historyLog:   { margin: '0 16px 12px', background: C.bgCard, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` },
  logLabel:     { fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.bgInput },
  logRow:       { display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', borderBottom: `1px solid ${C.border}` },
  logNum:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.textMuted, flexShrink: 0, letterSpacing: '0.04em' },
  logText:      { fontFamily: SANS, fontSize: 12, color: C.textSecondary, flex: 1, lineHeight: 1.4 },
  logAns:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 },
  stepCard:     { borderRadius: 14, border: '1px solid', padding: '16px', marginBottom: 4, boxShadow: '0 1px 4px rgba(15,23,42,0.06)' },
  stepHeader:   { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  stepNum:      { fontFamily: MONO, fontSize: 42, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', flexShrink: 0, opacity: 0.85 },
  stepTypeLabel:{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 4 },
  manualRef:    { fontFamily: MONO, fontSize: 9, color: C.blue, letterSpacing: '0.08em', textDecoration: 'none', display: 'inline-block', marginTop: 2 },
  stepText:     { fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.textPrimary, lineHeight: 1.45 },
  detailBlock:  { marginTop: 12, padding: '11px 13px', background: C.bgInput, borderRadius: 8, borderLeft: `3px solid ${C.borderMed}`, fontFamily: MONO, fontSize: 12, color: C.textSecondary, lineHeight: 1.7, letterSpacing: '0.01em', whiteSpace: 'pre-line' },
  divider:      { height: 1, background: C.border, margin: '16px 0' },
  answerRow:    { display: 'flex', gap: 10 },
  yesBtn:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 12px', borderRadius: 12, background: 'rgba(5,150,105,0.07)', border: `1px solid rgba(5,150,105,0.25)`, cursor: 'pointer' },
  noBtn:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 12px', borderRadius: 12, background: 'rgba(220,38,38,0.07)', border: `1px solid rgba(220,38,38,0.25)`, cursor: 'pointer' },
  btnLabel:     { fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: '0.05em', color: C.textPrimary },
  btnSub:       { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: C.textMuted },
  doneBtn:      { width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(217,119,6,0.08)', border: `1px solid rgba(217,119,6,0.25)`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.12em' },
  sendBtn:      { padding: '11px 16px', borderRadius: 9, background: 'rgba(107,126,255,0.1)', border: `1px solid rgba(107,126,255,0.25)`, color: C.blue, fontSize: 16, cursor: 'pointer', fontFamily: MONO },
  ghostSmBtn:   { width: '100%', padding: '10px', borderRadius: 9, background: 'transparent', border: `1px solid ${C.border}`, color: C.textMuted, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer' },
  logFixBtn:    { flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(217,119,6,0.07)', border: `1px solid rgba(217,119,6,0.2)`, color: C.amber, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  newSessionBtn:{ flex: 1, padding: '12px', borderRadius: 12, background: C.bgInput, border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  keepGoingBtn: { flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(220,38,38,0.07)', border: `1px solid rgba(220,38,38,0.2)`, color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  footer:       { display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: `1px solid ${C.border}`, background: C.bgCard, fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', flexShrink: 0 },
  spinner:      { width: 18, height: 18, borderRadius: '50%', border: `2px solid ${C.border}`, borderTopColor: C.blue, animation: 'spin 0.7s linear infinite', flexShrink: 0 },
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function TechPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { margin: 0; background: ${C.bg}; overscroll-behavior: none; }
        button:active { opacity: 0.75; }
        ::placeholder { color: rgba(15,23,42,0.28); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        .gg-chips::-webkit-scrollbar, .gg-list::-webkit-scrollbar { display: none; }
      `}</style>
      <Suspense fallback={<div style={{ minHeight: '100dvh', background: C.bgDeep }} />}>
        <TechTool />
      </Suspense>
    </>
  )
}
