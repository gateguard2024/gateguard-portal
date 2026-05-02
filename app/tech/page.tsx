'use client'

/**
 * /tech  — Field Tech Diagnostic Tool  v3
 *
 * Precision instrument aesthetic: IBM Plex Mono, near-black surfaces,
 * large step numbers, semantic-only color, one-screen-one-action.
 * Reference: Snap-on Zeus, Fluke Connect, Boeing MCC aesthetics.
 */

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ────────────────────────────────────────────────────────────────────
type StepType = 'question' | 'action' | 'resolved' | 'escalate'

interface Step {
  type:       StepType
  text:       string
  detail:     string | null
  manual_ref: { url: string | null; page: number | null; section: string | null } | null
  session_id: string
}

interface HistoryItem {
  question: string
  answer:   string
}

interface Product {
  id:         string
  name:       string
  brand:      string
  category:   string
  sku:        string
  manual_url: string | null
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#111318',
  bgDeep:       '#0C0F14',
  bgCard:       '#181C23',
  bgInput:      '#1C2028',
  border:       'rgba(255,255,255,0.07)',
  borderMed:    'rgba(255,255,255,0.12)',
  textPrimary:  '#E8ECF0',
  textSecondary:'rgba(232,236,240,0.45)',
  textMuted:    'rgba(232,236,240,0.22)',
  // Semantic — ONLY used for their strict meaning
  blue:   '#38BDF8',   // verify / question
  amber:  '#F59E0B',   // action required
  green:  '#10B981',   // pass / resolved
  red:    '#EF4444',   // fault / escalate
  // Derived surfaces
  blueAlpha:  'rgba(56,189,248,0.08)',
  amberAlpha: 'rgba(245,158,11,0.08)',
  greenAlpha: 'rgba(16,185,129,0.08)',
  redAlpha:   'rgba(239,68,68,0.08)',
}

const STEP_CFG: Record<StepType, {
  accent: string; surface: string; border: string
  label: string; numColor: string
}> = {
  question: { accent: C.blue,  surface: C.blueAlpha,  border: 'rgba(56,189,248,0.18)',  label: 'VERIFY',   numColor: C.blue  },
  action:   { accent: C.amber, surface: C.amberAlpha, border: 'rgba(245,158,11,0.18)',  label: 'ACTION',   numColor: C.amber },
  resolved: { accent: C.green, surface: C.greenAlpha, border: 'rgba(16,185,129,0.18)',  label: 'RESOLVED', numColor: C.green },
  escalate: { accent: C.red,   surface: C.redAlpha,   border: 'rgba(239,68,68,0.18)',   label: 'ESCALATE', numColor: C.red   },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pad2(n: number) { return String(n).padStart(2, '0') }

function shortSession(id: string | null) {
  if (!id) return '——'
  return '#' + id.replace(/-/g, '').slice(-4).toUpperCase()
}

// ─── Main component ───────────────────────────────────────────────────────────
function TechTool() {
  const params   = useSearchParams()
  const presetId = params.get('product_id') ?? undefined

  const [screen,    setScreen]    = useState<'home' | 'symptom' | 'diag'>('home')
  const [products,  setProducts]  = useState<Product[]>([])
  const [selected,  setSelected]  = useState<Product | null>(null)
  const [symptom,   setSymptom]   = useState('')
  const [errorCode, setErrorCode] = useState('')
  const [history,   setHistory]   = useState<HistoryItem[]>([])
  const [current,   setCurrent]   = useState<Step | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)
  const [freeText,  setFreeText]  = useState('')
  const [logFixed,  setLogFixed]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load products
  useEffect(() => {
    supabase.from('products').select('id,name,brand,category,sku,manual_url')
      .eq('active', true).order('brand').order('name')
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  // Auto-select if product_id passed in URL
  useEffect(() => {
    if (presetId && products.length > 0) {
      const p = products.find(p => p.id === presetId)
      if (p) { setSelected(p); setScreen('symptom') }
    }
  }, [presetId, products])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, current, loading])

  async function startDiag() {
    if (!symptom.trim()) return
    setScreen('diag')
    await fetchStep([])
  }

  async function fetchStep(h: HistoryItem[]) {
    setLoading(true)
    try {
      const res = await fetch('/api/kb/ask', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          symptom,
          error_code:  errorCode || undefined,
          product_id:  selected?.id,
          history:     h,
          session_id:  sessionId,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      if (!sessionId && data.session_id) setSessionId(data.session_id)
      setCurrent(data as Step)
    } catch (err: any) {
      alert('API error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  async function answer(ans: string) {
    if (!current) return
    const newH: HistoryItem[] = [...history, { question: current.text, answer: ans }]
    setHistory(newH)
    setCurrent(null)
    if (current.type === 'resolved' || current.type === 'escalate') return
    await fetchStep(newH)
  }

  function reset() {
    setScreen('home'); setSelected(null); setSymptom(''); setErrorCode('')
    setHistory([]); setCurrent(null); setSessionId(null); setFreeText(''); setLogFixed(false)
  }

  const stepCount  = history.length + (current ? 1 : 0)
  const cfg        = current ? STEP_CFG[current.type] : null
  const isTerminal = current?.type === 'resolved' || current?.type === 'escalate'

  // ── SCREEN: Home ─────────────────────────────────────────────────────────
  if (screen === 'home') {
    const grouped = products.reduce<Record<string, Product[]>>((acc, p) => {
      const cat = p.category || 'Other'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(p)
      return acc
    }, {})

    return (
      <div style={S.shell}>
        {/* Top bar */}
        <div style={S.topBar}>
          <div style={S.ggMark}>GG</div>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>GATEGUARD FIELD TOOL</div>
            <div style={S.topBarSub}>SELECT DEVICE</div>
          </div>
          <div style={S.statusPill}>ONLINE</div>
        </div>

        {/* Device list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 40px' }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div style={S.catHeader}>{cat.toUpperCase()}</div>
              {items.map(p => (
                <button
                  key={p.id}
                  style={S.deviceRow}
                  onClick={() => { setSelected(p); setScreen('symptom') }}
                >
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={S.deviceBrand}>{p.brand.toUpperCase()}</div>
                    <div style={S.deviceName}>{p.name}</div>
                    <div style={S.deviceSku}>{p.sku}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {p.manual_url
                      ? <span style={{ ...S.statusDot, background: C.green }} title="AI Ready" />
                      : <span style={{ ...S.statusDot, background: C.amber }} title="No manual" />
                    }
                    <span style={S.chevron}>›</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
          {products.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
              LOADING DEVICE DATABASE…
            </div>
          )}
        </div>

        {/* Legend strip */}
        <div style={S.legendStrip}>
          <span style={{ color: C.green }}>● AI-READY</span>
          <span style={{ color: C.amber }}>● MANUAL PENDING</span>
        </div>
      </div>
    )
  }

  // ── SCREEN: Symptom entry ─────────────────────────────────────────────────
  if (screen === 'symptom') {
    return (
      <div style={S.shell}>
        <div style={S.topBar}>
          <button style={S.iconBtn} onClick={() => setScreen('home')}>‹</button>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>{selected?.sku} — {selected?.brand.toUpperCase()}</div>
            <div style={S.topBarSub}>ENTER FAULT DESCRIPTION</div>
          </div>
        </div>

        <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Field label */}
          <div style={S.fieldLabel}>FAULT DESCRIPTION</div>
          <textarea
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder={"e.g. Gate won't open after power outage\nBarrier arm stuck in up position\nOperator hums but doesn't move"}
            style={S.textarea}
            rows={4}
            autoFocus
          />

          <div style={S.fieldLabel}>ERROR CODE / LED STATUS <span style={{ color: C.textMuted }}>OPTIONAL</span></div>
          <input
            type="text"
            value={errorCode}
            onChange={e => setErrorCode(e.target.value)}
            placeholder="e.g. E-04, RED+AMBER FLASH"
            style={S.monoInput}
          />

          {/* Quick select chips */}
          <div style={S.fieldLabel}>QUICK SELECT</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {["WON'T OPEN", "WON'T CLOSE", 'NO POWER', 'MOTOR HUMS', 'ARM STUCK', 'LOOP FAULT', 'LIMIT FAULT', 'NO COMM'].map(c => (
              <button
                key={c}
                onClick={() => setSymptom(c)}
                style={{
                  ...S.chip,
                  background:   symptom === c ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                  borderColor:  symptom === c ? C.blue : 'rgba(255,255,255,0.08)',
                  color:        symptom === c ? C.blue : C.textMuted,
                }}
              >
                {c}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button
            onClick={startDiag}
            disabled={!symptom.trim()}
            style={{ ...S.primaryBtn, opacity: symptom.trim() ? 1 : 0.25 }}
          >
            INITIALIZE DIAGNOSTIC ›
          </button>
        </div>
      </div>
    )
  }

  // ── SCREEN: Diagnostic flow ───────────────────────────────────────────────
  return (
    <div style={S.shell}>
      {/* Header bar */}
      <div style={S.diagHeader}>
        <button style={S.iconBtn} onClick={reset}>✕</button>
        <div style={{ flex: 1 }}>
          <div style={S.topBarTitle}>{selected?.sku} — {selected?.brand.toUpperCase()}</div>
          <div style={S.topBarSub} title={symptom}>
            {symptom.length > 38 ? symptom.slice(0, 38) + '…' : symptom.toUpperCase()}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={S.sessionId}>{shortSession(sessionId)}</div>
          <div style={S.topBarSub}>SESSION</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={S.progressBar}>
        <div style={{ ...S.progressFill, width: `${Math.min(stepCount * 12, 100)}%` }} />
      </div>

      {/* Scroll area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0 24px' }}>

        {/* Completed history log */}
        {history.length > 0 && (
          <div style={S.historyLog}>
            <div style={S.logLabel}>DIAGNOSTIC LOG</div>
            {history.map((h, i) => {
              const ans = h.answer
              const ansColor = ans === 'Yes' ? C.green
                             : ans === 'No'  ? C.red
                             : C.amber
              return (
                <div key={i} style={S.logRow}>
                  <span style={S.logNum}>{pad2(i + 1)}</span>
                  <span style={S.logText}>{h.question}</span>
                  <span style={{ ...S.logAns, color: ansColor }}>
                    {ans.toUpperCase()}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div style={{ padding: '20px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={S.spinner} />
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: C.textMuted, letterSpacing: '0.08em' }}>
              QUERYING VECTOR DATABASE…
            </span>
          </div>
        )}

        {/* Active step card */}
        {current && cfg && !loading && (
          <div style={{ padding: '0 16px' }}>
            <div style={{ ...S.stepCard, borderColor: cfg.border, background: cfg.surface }}>

              {/* Step header row */}
              <div style={S.stepHeader}>
                <div style={{ ...S.stepNum, color: cfg.numColor }}>{pad2(history.length + 1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.stepTypeLabel, color: cfg.accent }}>{cfg.label}</div>
                  {selected?.manual_url && current.manual_ref?.url && (
                    <a
                      href={`${current.manual_ref.url}${current.manual_ref.page ? `#page=${current.manual_ref.page}` : ''}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={S.manualRef}
                    >
                      MANUAL{current.manual_ref.page ? ` P.${current.manual_ref.page}` : ''}
                      {current.manual_ref.section ? ` · ${current.manual_ref.section.toUpperCase().slice(0, 28)}` : ''}
                    </a>
                  )}
                </div>
              </div>

              {/* Main instruction */}
              <div style={S.stepText}>{current.text}</div>

              {/* Detail / procedure block */}
              {current.detail && (
                <div style={S.detailBlock}>
                  {current.detail}
                </div>
              )}

              {/* Divider */}
              <div style={S.divider} />

              {/* YES / NO */}
              {current.type === 'question' && (
                <div style={S.answerRow}>
                  <button style={S.yesBtn} onClick={() => answer('Yes')}>
                    <span style={S.btnLabel}>YES</span>
                    <span style={S.btnSub}>PASS / CONFIRMED</span>
                  </button>
                  <button style={S.noBtn} onClick={() => answer('No')}>
                    <span style={S.btnLabel}>NO</span>
                    <span style={S.btnSub}>FAIL / NOT PRESENT</span>
                  </button>
                </div>
              )}

              {/* ACTION */}
              {current.type === 'action' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button style={S.doneBtn} onClick={() => answer('Done')}>
                    DONE — CONTINUE ›
                  </button>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="text"
                      value={freeText}
                      onChange={e => setFreeText(e.target.value)}
                      placeholder="Describe what you observed…"
                      style={{ ...S.monoInput, flex: 1, margin: 0 }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && freeText.trim()) {
                          answer(freeText); setFreeText('')
                        }
                      }}
                    />
                    <button
                      style={S.sendBtn}
                      onClick={() => { if (freeText.trim()) { answer(freeText); setFreeText('') } }}
                    >
                      ›
                    </button>
                  </div>
                </div>
              )}

              {/* RESOLVED / ESCALATE */}
              {isTerminal && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {!logFixed && (
                    <button
                      style={S.logFixBtn}
                      onClick={() => setLogFixed(true)}
                    >
                      LOG FIX
                    </button>
                  )}
                  {logFixed && (
                    <div style={{ ...S.logFixBtn, background: C.greenAlpha, borderColor: 'rgba(16,185,129,0.3)', color: C.green, cursor: 'default' }}>
                      ✓ LOGGED
                    </div>
                  )}
                  <button style={S.newSessionBtn} onClick={reset}>
                    NEW SESSION
                  </button>
                  {current.type === 'escalate' && (
                    <button style={S.keepGoingBtn} onClick={() => answer('Keep diagnosing')}>
                      CONTINUE
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Status footer */}
      <div style={S.footer}>
        <span style={{ color: C.green }}>● ONLINE</span>
        <span style={{ color: C.textMuted }}>
          STEP {pad2(stepCount)} · {shortSession(sessionId)}
        </span>
        {selected?.manual_url
          ? <span style={{ color: C.blue }}>AI-READY</span>
          : <span style={{ color: C.amber }}>NO MANUAL</span>
        }
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const MONO = '"IBM Plex Mono", "SFMono-Regular", "Consolas", monospace'
const SANS = '"IBM Plex Sans", -apple-system, system-ui, sans-serif'

const S: Record<string, React.CSSProperties> = {
  shell:        { minHeight: '100dvh', maxHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: SANS, maxWidth: 480, margin: '0 auto', overflowY: 'hidden' },

  // Top bar
  topBar:       { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.bgDeep, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  diagHeader:   { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.bgDeep, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  ggMark:       { width: 34, height: 34, borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.blue, flexShrink: 0, letterSpacing: '0.05em' },
  topBarTitle:  { fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.08em', margin: 0 },
  topBarSub:    { fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.12em', marginTop: 2 },
  statusPill:   { fontFamily: MONO, fontSize: 9, color: C.green, letterSpacing: '0.12em', border: `1px solid rgba(16,185,129,0.25)`, borderRadius: 4, padding: '3px 7px', flexShrink: 0 },
  sessionId:    { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' },
  iconBtn:      { width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: MONO },

  // Progress
  progressBar:  { height: 2, background: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  progressFill: { height: '100%', background: C.blue, transition: 'width 0.4s ease' },

  // Device list
  catHeader:    { fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, padding: '18px 16px 6px' },
  deviceRow:    { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', textAlign: 'left' },
  deviceBrand:  { fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: C.blue, margin: 0 },
  deviceName:   { fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.textPrimary, margin: '3px 0 2px' },
  deviceSku:    { fontFamily: MONO, fontSize: 10, color: C.textMuted, margin: 0 },
  statusDot:    { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  chevron:      { fontFamily: MONO, fontSize: 20, color: C.textMuted, flexShrink: 0 },
  legendStrip:  { display: 'flex', gap: 20, padding: '10px 16px', borderTop: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', flexShrink: 0, background: C.bgDeep },

  // Symptom entry
  fieldLabel:   { fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: C.textMuted, marginBottom: -6 },
  textarea:     { width: '100%', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '13px 14px', color: C.textPrimary, fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'none', fontFamily: SANS, boxSizing: 'border-box' },
  monoInput:    { width: '100%', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '11px 13px', color: C.textPrimary, fontSize: 13, outline: 'none', fontFamily: MONO, letterSpacing: '0.04em', boxSizing: 'border-box' },
  chip:         { padding: '6px 12px', borderRadius: 4, border: '1px solid', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer' },
  primaryBtn:   { width: '100%', padding: '16px', borderRadius: 10, background: C.blue, border: 'none', color: C.bgDeep, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },

  // History log
  historyLog:   { margin: '0 16px 12px', background: C.bgCard, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` },
  logLabel:     { fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.bgDeep },
  logRow:       { display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', borderBottom: `1px solid rgba(255,255,255,0.04)` },
  logNum:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.textMuted, flexShrink: 0, letterSpacing: '0.04em' },
  logText:      { fontFamily: SANS, fontSize: 12, color: C.textSecondary, flex: 1, lineHeight: 1.4 },
  logAns:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 },

  // Active step card
  stepCard:     { borderRadius: 12, border: '1px solid', padding: '16px', background: C.bgCard },
  stepHeader:   { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  stepNum:      { fontFamily: MONO, fontSize: 42, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', flexShrink: 0, opacity: 0.9 },
  stepTypeLabel:{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 4 },
  manualRef:    { fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', textDecoration: 'none', borderBottom: `1px solid ${C.border}` },
  stepText:     { fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.textPrimary, lineHeight: 1.45, marginBottom: 0 },
  detailBlock:  { marginTop: 12, padding: '11px 13px', background: 'rgba(0,0,0,0.25)', borderRadius: 7, borderLeft: `2px solid rgba(255,255,255,0.1)`, fontFamily: MONO, fontSize: 12, color: C.textSecondary, lineHeight: 1.7, letterSpacing: '0.01em', whiteSpace: 'pre-line' },
  divider:      { height: 1, background: C.border, margin: '16px 0' },

  // Answer buttons
  answerRow:    { display: 'flex', gap: 10 },
  yesBtn:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: `1px solid rgba(16,185,129,0.3)`, cursor: 'pointer' },
  noBtn:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, cursor: 'pointer' },
  btnLabel:     { fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: '0.05em', color: C.textPrimary } as React.CSSProperties,
  btnSub:       { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: C.textMuted } as React.CSSProperties,

  doneBtn:      { width: '100%', padding: '14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.3)`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.12em' },
  sendBtn:      { padding: '11px 16px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.25)`, color: C.blue, fontSize: 16, cursor: 'pointer', fontFamily: MONO },

  logFixBtn:    { flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`, color: C.amber, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  newSessionBtn:{ flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  keepGoingBtn: { flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`, color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },

  // Footer
  footer:       { display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: `1px solid ${C.border}`, background: C.bgDeep, fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', flexShrink: 0 },

  // Spinner
  spinner:      { width: 18, height: 18, borderRadius: '50%', border: `2px solid rgba(56,189,248,0.15)`, borderTopColor: C.blue, animation: 'spin 0.7s linear infinite', flexShrink: 0 },
}

// ─── Export ───────────────────────────────────────────────────────────────────
export default function TechPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        html, body { margin: 0; background: ${C.bgDeep}; overscroll-behavior: none; }
        button:active { opacity: 0.75; }
        ::placeholder { color: rgba(232,236,240,0.2); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>
      <Suspense fallback={<div style={{ minHeight: '100dvh', background: C.bgDeep }} />}>
        <TechTool />
      </Suspense>
    </>
  )
}
