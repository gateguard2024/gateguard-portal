'use client'

/**
 * /tech  — Field Tech Diagnostic Tool  v3
 *
 * Precision instrument aesthetic: IBM Plex Mono, near-black surfaces,
 * large step numbers, semantic-only color, one-screen-one-action.
 *
 * Auth flow:
 *   1. Clerk-authed dealer → skips PIN screen, full access
 *   2. Field tech (no Clerk) → enters TECH_ACCESS_CODE on first visit
 *      Code is stored in sessionStorage, sent as x-tech-code on all API calls
 */

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams }                        from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────
type StepType = 'question' | 'action' | 'resolved' | 'escalate'
type Screen   = 'pin' | 'home' | 'symptom' | 'diag'

interface Step {
  type:       StepType
  text:       string
  detail:     string | null
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
  tags:        string[] | null
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
  blue:   '#38BDF8',
  amber:  '#F59E0B',
  green:  '#10B981',
  red:    '#EF4444',
  blueAlpha:  'rgba(56,189,248,0.08)',
  amberAlpha: 'rgba(245,158,11,0.08)',
  greenAlpha: 'rgba(16,185,129,0.08)',
  redAlpha:   'rgba(239,68,68,0.08)',
}

const STEP_CFG: Record<StepType, {
  accent: string; surface: string; border: string; label: string; numColor: string
}> = {
  question: { accent: C.blue,  surface: C.blueAlpha,  border: 'rgba(56,189,248,0.18)',  label: 'VERIFY',   numColor: C.blue  },
  action:   { accent: C.amber, surface: C.amberAlpha, border: 'rgba(245,158,11,0.18)',  label: 'ACTION',   numColor: C.amber },
  resolved: { accent: C.green, surface: C.greenAlpha, border: 'rgba(16,185,129,0.18)',  label: 'RESOLVED', numColor: C.green },
  escalate: { accent: C.red,   surface: C.redAlpha,   border: 'rgba(239,68,68,0.18)',   label: 'ESCALATE', numColor: C.red   },
}

const MONO = '"IBM Plex Mono", "SFMono-Regular", "Consolas", monospace'
const SANS = '"IBM Plex Sans", -apple-system, system-ui, sans-serif'

function pad2(n: number) { return String(n).padStart(2, '0') }
function shortSession(id: string | null) {
  if (!id) return '——'
  return '#' + id.replace(/-/g, '').slice(-4).toUpperCase()
}

// ─── Main component ───────────────────────────────────────────────────────────
function TechTool() {
  const params   = useSearchParams()
  const presetId = params.get('product_id') ?? undefined

  const [screen,    setScreen]    = useState<Screen>('pin')
  const [techCode,  setTechCode]  = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [products,  setProducts]  = useState<Product[]>([])
  const [search,    setSearch]    = useState('')
  const [activeCat, setActiveCat] = useState('ALL')
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

  // ── On mount: check sessionStorage for saved code ─────────────────────────
  useEffect(() => {
    const saved = sessionStorage.getItem('gg_tech_code')
    if (saved) {
      setTechCode(saved)
      setScreen('home')
    }
  }, [])

  // ── Load products once we have a code ────────────────────────────────────
  useEffect(() => {
    if (!techCode && screen !== 'home') return
    fetch('/api/kb/products', {
      headers: { 'x-tech-code': techCode },
    })
      .then(r => r.json())
      .then(d => setProducts(d.products ?? []))
      .catch(() => {})
  }, [techCode, screen])

  // ── Auto-select product from URL param ───────────────────────────────────
  useEffect(() => {
    if (presetId && products.length > 0) {
      const p = products.find(p => p.id === presetId || p.sku === presetId)
      if (p) { setSelected(p); setScreen('symptom') }
    }
  }, [presetId, products])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, current, loading])

  // ── Auth helpers ──────────────────────────────────────────────────────────
  function apiHeaders(): HeadersInit {
    return { 'Content-Type': 'application/json', 'x-tech-code': techCode }
  }

  async function submitCode() {
    setCodeError(false)
    const code = codeInput.trim().toUpperCase()
    if (!code) return

    // Validate by hitting the products endpoint
    const res = await fetch('/api/kb/products', {
      headers: { 'x-tech-code': code },
    })

    if (res.ok) {
      const data = await res.json()
      sessionStorage.setItem('gg_tech_code', code)
      setTechCode(code)
      setProducts(data.products ?? [])
      setScreen('home')
    } else if (res.status === 401) {
      setCodeError(true)
      setCodeInput('')
    } else {
      // Server error (500) — code may be correct but backend issue
      alert(`Server error (${res.status}) — check Vercel env vars and Supabase migrations. Code may be correct.`)
    }
  }

  // ── Diagnostic helpers ────────────────────────────────────────────────────
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
        headers: apiHeaders(),
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

  // ── SCREEN: PIN entry ─────────────────────────────────────────────────────
  if (screen === 'pin') {
    return (
      <div style={{ ...S.shell, justifyContent: 'center', alignItems: 'center', gap: 0 }}>
        <div style={S.pinCard}>
          {/* Logo */}
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
            type="text"
            value={codeInput}
            onChange={e => { setCodeInput(e.target.value.toUpperCase()); setCodeError(false) }}
            onKeyDown={e => e.key === 'Enter' && submitCode()}
            placeholder="ENTER CODE"
            maxLength={16}
            autoFocus
            autoCapitalize="characters"
            style={{
              ...S.monoInput,
              fontSize: 18,
              letterSpacing: '0.22em',
              textAlign: 'center',
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
            disabled={!codeInput.trim()}
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

  // ── SCREEN: Home — device picker ──────────────────────────────────────────
  if (screen === 'home') {
    // Strip consumables — tech tool shows serviceable equipment only
    const EXCLUDE = ['wire', 'hardware', 'cable', 'conduit', 'connector', 'supply']
    const serviceProds = products.filter(p =>
      !EXCLUDE.some(x => p.category.toLowerCase().includes(x))
    )

    // Dynamic category chips from remaining products
    const cats = ['ALL', ...Array.from(new Set(serviceProds.map(p => p.category || 'Other'))).sort()]

    // Apply search + category filter
    const q = search.toLowerCase()
    const visible = serviceProds.filter(p => {
      const matchCat = activeCat === 'ALL' || p.category === activeCat
      const matchSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q)
      return matchCat && matchSearch
    })

    // Brand initials for avatar
    const brandInitials = (brand: string) =>
      brand.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()

    // Color per brand (deterministic)
    const brandHues: Record<string, string> = {}
    const PALETTE = ['#38BDF8','#818CF8','#34D399','#FB923C','#F472B6','#A78BFA']
    serviceProds.forEach(p => {
      if (!brandHues[p.brand]) {
        brandHues[p.brand] = PALETTE[Object.keys(brandHues).length % PALETTE.length]
      }
    })

    return (
      <div style={S.shell}>
        {/* Top bar */}
        <div style={S.topBar}>
          <div style={S.ggMark}>GG</div>
          <div style={{ flex: 1 }}>
            <div style={S.topBarTitle}>GATEGUARD FIELD TOOL</div>
            <div style={S.topBarSub}>SELECT DEVICE</div>
          </div>
          <div style={S.statusPill}>● ONLINE</div>
        </div>

        {/* Search bar */}
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: C.textMuted, fontSize: 14, pointerEvents: 'none',
            }}>⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, brand, or SKU…"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: C.bgInput, border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '11px 14px 11px 32px',
                fontFamily: SANS, fontSize: 14, color: C.textPrimary,
                outline: 'none', WebkitAppearance: 'none',
                WebkitTextFillColor: C.textPrimary,
              }}
            />
          </div>
        </div>

        {/* Category chips — hide scrollbar cross-browser */}
        <style>{`.gg-chips::-webkit-scrollbar{display:none}`}</style>
        {cats.length > 2 && (
          <div className="gg-chips" style={{
            display: 'flex', gap: 6,
            padding: '8px 16px 8px',
            overflowX: 'auto', flexShrink: 0,
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          } as React.CSSProperties}>
            {cats.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCat(cat)}
                style={{
                  fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
                  padding: '5px 11px', borderRadius: 20,
                  border: `1px solid ${activeCat === cat ? C.blue : C.border}`,
                  background: activeCat === cat ? 'rgba(56,189,248,0.12)' : 'transparent',
                  color: activeCat === cat ? C.blue : C.textMuted,
                  whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
                }}
              >
                {cat === 'ALL' ? 'ALL' : cat.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Device list */}
        <style>{`.gg-list::-webkit-scrollbar{display:none}`}</style>
        <div className="gg-list" style={{ flex: 1, overflowY: 'auto', padding: '6px 0 40px', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}>
          {visible.map((p, i) => {
            const color = brandHues[p.brand] ?? C.blue
            const hasManual = !!p.manual_url
            return (
              <button
                key={p.id}
                onClick={() => { setSelected(p); setScreen('symptom') }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  padding: '14px 16px', gap: 14,
                  background: 'transparent', border: 'none',
                  borderBottom: `1px solid ${C.border}`,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Brand avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                  background: `${color}18`,
                  border: `1px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: MONO, fontSize: 11, fontWeight: 700,
                  color, letterSpacing: '0.04em',
                }}>
                  {brandInitials(p.brand)}
                </div>

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: SANS, fontSize: 15, fontWeight: 600,
                    color: C.textPrimary, lineHeight: 1.25,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {p.name}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, color: C.textMuted,
                    marginTop: 3, letterSpacing: '0.07em',
                  }}>
                    {p.brand.toUpperCase()} · {p.sku}
                  </div>
                </div>

                {/* Status + chevron */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: hasManual ? C.green : C.border,
                    boxShadow: hasManual ? `0 0 6px ${C.green}` : 'none',
                  }} />
                  <span style={{ color: C.textMuted, fontSize: 16, lineHeight: 1 }}>›</span>
                </div>
              </button>
            )
          })}

          {visible.length === 0 && serviceProds.length > 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em' }}>
              NO DEVICES MATCH SEARCH
            </div>
          )}
          {serviceProds.length === 0 && (
            <div style={{ color: C.textMuted, textAlign: 'center', marginTop: 60, fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em' }}>
              LOADING DEVICE DATABASE…
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={S.legendStrip}>
          <span style={{ color: C.green }}>● AI-READY</span>
          <span style={{ color: C.textMuted }}>● MANUAL PENDING</span>
          <span style={{ color: C.textMuted, marginLeft: 'auto' }}>
            {visible.length} DEVICE{visible.length !== 1 ? 'S' : ''}
          </span>
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
          <div style={S.fieldLabel}>FAULT DESCRIPTION</div>
          <textarea
            value={symptom}
            onChange={e => setSymptom(e.target.value)}
            placeholder={"e.g. Gate won't open after power outage\nBarrier arm stuck in up position\nOperator hums but doesn't move"}
            style={S.textarea}
            rows={4}
            autoFocus
          />

          <div style={S.fieldLabel}>
            ERROR CODE / LED STATUS <span style={{ color: C.textMuted }}>OPTIONAL</span>
          </div>
          <input
            type="text"
            value={errorCode}
            onChange={e => setErrorCode(e.target.value)}
            placeholder="e.g. E-04 · RED+AMBER FLASH"
            style={S.monoInput}
          />

          <div style={S.fieldLabel}>QUICK SELECT</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {["WON'T OPEN","WON'T CLOSE","NO POWER","MOTOR HUMS","ARM STUCK","LOOP FAULT","LIMIT FAULT","NO COMM"].map(c => (
              <button key={c} onClick={() => setSymptom(c)} style={{
                ...S.chip,
                background:  symptom === c ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                borderColor: symptom === c ? C.blue : 'rgba(255,255,255,0.08)',
                color:       symptom === c ? C.blue : C.textMuted,
              }}>
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
      <div style={S.diagHeader}>
        <button style={S.iconBtn} onClick={reset}>✕</button>
        <div style={{ flex: 1 }}>
          <div style={S.topBarTitle}>{selected?.sku} — {selected?.brand.toUpperCase()}</div>
          <div style={S.topBarSub}>
            {symptom.length > 38 ? symptom.slice(0, 38).toUpperCase() + '…' : symptom.toUpperCase()}
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0 24px' }}>

        {/* History log */}
        {history.length > 0 && (
          <div style={S.historyLog}>
            <div style={S.logLabel}>DIAGNOSTIC LOG</div>
            {history.map((h, i) => {
              const ansColor = h.answer === 'Yes' ? C.green : h.answer === 'No' ? C.red : C.amber
              return (
                <div key={i} style={S.logRow}>
                  <span style={S.logNum}>{pad2(i + 1)}</span>
                  <span style={S.logText}>{h.question}</span>
                  <span style={{ ...S.logAns, color: ansColor }}>{h.answer.toUpperCase()}</span>
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
              QUERYING VECTOR DATABASE…
            </span>
          </div>
        )}

        {/* Active step */}
        {current && cfg && !loading && (
          <div style={{ padding: '0 16px' }}>
            <div style={{ ...S.stepCard, borderColor: cfg.border, background: cfg.surface }}>
              <div style={S.stepHeader}>
                <div style={{ ...S.stepNum, color: cfg.numColor }}>{pad2(history.length + 1)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ ...S.stepTypeLabel, color: cfg.accent }}>{cfg.label}</div>
                  {current.manual_ref?.url && (
                    <a
                      href={`${current.manual_ref.url}${current.manual_ref.page ? `#page=${current.manual_ref.page}` : ''}`}
                      target="_blank" rel="noopener noreferrer"
                      style={S.manualRef}
                    >
                      MANUAL{current.manual_ref.page ? ` P.${current.manual_ref.page}` : ''}
                      {current.manual_ref.section ? ` · ${current.manual_ref.section.toUpperCase().slice(0,28)}` : ''}
                    </a>
                  )}
                </div>
              </div>

              <div style={S.stepText}>{current.text}</div>

              {current.detail && (
                <div style={S.detailBlock}>{current.detail}</div>
              )}

              <div style={S.divider} />

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
                      onKeyDown={e => { if (e.key === 'Enter' && freeText.trim()) { answer(freeText); setFreeText('') }}}
                    />
                    <button
                      style={S.sendBtn}
                      onClick={() => { if (freeText.trim()) { answer(freeText); setFreeText('') }}}
                    >›</button>
                  </div>
                </div>
              )}

              {isTerminal && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {!logFixed
                    ? <button style={S.logFixBtn} onClick={() => setLogFixed(true)}>LOG FIX</button>
                    : <div style={{ ...S.logFixBtn, background: C.greenAlpha, borderColor: 'rgba(16,185,129,0.3)', color: C.green, cursor: 'default' }}>✓ LOGGED</div>
                  }
                  <button style={S.newSessionBtn} onClick={reset}>NEW SESSION</button>
                  {current.type === 'escalate' && (
                    <button style={S.keepGoingBtn} onClick={() => answer('Keep diagnosing')}>CONTINUE</button>
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
          : <span style={{ color: C.amber }}>NO MANUAL</span>
        }
      </div>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  shell:        { minHeight: '100dvh', maxHeight: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: SANS, maxWidth: 480, margin: '0 auto', overflow: 'hidden' },
  pinCard:      { width: '100%', maxWidth: 340, padding: '32px 24px', background: C.bgCard, borderRadius: 16, border: `1px solid ${C.border}`, margin: '0 16px' },
  pinLogo:      { width: 52, height: 52, borderRadius: 14, background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 14, fontWeight: 700, color: C.blue, margin: '0 auto', letterSpacing: '0.05em' },
  topBar:       { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: C.bgDeep, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  diagHeader:   { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: C.bgDeep, borderBottom: `1px solid ${C.border}`, flexShrink: 0 },
  ggMark:       { width: 34, height: 34, borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.25)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.blue, flexShrink: 0, letterSpacing: '0.05em' },
  topBarTitle:  { fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.08em' },
  topBarSub:    { fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.12em', marginTop: 2 },
  statusPill:   { fontFamily: MONO, fontSize: 9, color: C.green, letterSpacing: '0.12em', border: `1px solid rgba(16,185,129,0.25)`, borderRadius: 4, padding: '3px 7px', flexShrink: 0 },
  sessionId:    { fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.06em' },
  iconBtn:      { width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: MONO },
  progressBar:  { height: 2, background: 'rgba(255,255,255,0.05)', flexShrink: 0 },
  progressFill: { height: '100%', background: C.blue, transition: 'width 0.4s ease' },
  catHeader:    { fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, padding: '18px 16px 6px' },
  deviceRow:    { width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: 'transparent', cursor: 'pointer', textAlign: 'left' },
  deviceBrand:  { fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: C.blue },
  deviceName:   { fontFamily: SANS, fontSize: 15, fontWeight: 600, color: C.textPrimary, margin: '3px 0 2px' },
  deviceSku:    { fontFamily: MONO, fontSize: 10, color: C.textMuted },
  legendStrip:  { display: 'flex', gap: 20, padding: '10px 16px', borderTop: `1px solid ${C.border}`, fontFamily: MONO, fontSize: 9, letterSpacing: '0.1em', flexShrink: 0, background: C.bgDeep },
  fieldLabel:   { fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', color: C.textMuted, marginBottom: -6 },
  textarea:     { width: '100%', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 10, padding: '13px 14px', color: C.textPrimary, fontSize: 14, lineHeight: 1.6, outline: 'none', resize: 'none', fontFamily: SANS, boxSizing: 'border-box' },
  monoInput:    { width: '100%', background: C.bgInput, border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: '11px 13px', color: C.textPrimary, fontSize: 13, outline: 'none', fontFamily: MONO, letterSpacing: '0.04em', boxSizing: 'border-box' },
  chip:         { padding: '6px 12px', borderRadius: 4, border: '1px solid', fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', cursor: 'pointer' },
  primaryBtn:   { width: '100%', padding: '16px', borderRadius: 10, background: C.blue, border: 'none', color: C.bgDeep, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  historyLog:   { margin: '0 16px 12px', background: C.bgCard, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` },
  logLabel:     { fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted, padding: '8px 12px', borderBottom: `1px solid ${C.border}`, background: C.bgDeep },
  logRow:       { display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 12px', borderBottom: `1px solid rgba(255,255,255,0.04)` },
  logNum:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.textMuted, flexShrink: 0, letterSpacing: '0.04em' },
  logText:      { fontFamily: SANS, fontSize: 12, color: C.textSecondary, flex: 1, lineHeight: 1.4 },
  logAns:       { fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', flexShrink: 0 },
  stepCard:     { borderRadius: 12, border: '1px solid', padding: '16px', background: C.bgCard },
  stepHeader:   { display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  stepNum:      { fontFamily: MONO, fontSize: 42, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em', flexShrink: 0, opacity: 0.9 },
  stepTypeLabel:{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', marginBottom: 4 },
  manualRef:    { fontFamily: MONO, fontSize: 9, color: C.textMuted, letterSpacing: '0.1em', textDecoration: 'none', borderBottom: `1px solid ${C.border}` },
  stepText:     { fontFamily: SANS, fontSize: 17, fontWeight: 600, color: C.textPrimary, lineHeight: 1.45 },
  detailBlock:  { marginTop: 12, padding: '11px 13px', background: 'rgba(0,0,0,0.25)', borderRadius: 7, borderLeft: `2px solid rgba(255,255,255,0.1)`, fontFamily: MONO, fontSize: 12, color: C.textSecondary, lineHeight: 1.7, letterSpacing: '0.01em', whiteSpace: 'pre-line' },
  divider:      { height: 1, background: C.border, margin: '16px 0' },
  answerRow:    { display: 'flex', gap: 10 },
  yesBtn:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 12px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: `1px solid rgba(16,185,129,0.3)`, cursor: 'pointer' },
  noBtn:        { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '16px 12px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: `1px solid rgba(239,68,68,0.3)`, cursor: 'pointer' },
  btnLabel:     { fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: '0.05em', color: C.textPrimary },
  btnSub:       { fontFamily: MONO, fontSize: 8, letterSpacing: '0.14em', color: C.textMuted },
  doneBtn:      { width: '100%', padding: '14px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: `1px solid rgba(245,158,11,0.3)`, color: C.amber, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.12em' },
  sendBtn:      { padding: '11px 16px', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: `1px solid rgba(56,189,248,0.25)`, color: C.blue, fontSize: 16, cursor: 'pointer', fontFamily: MONO },
  logFixBtn:    { flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: `1px solid rgba(245,158,11,0.2)`, color: C.amber, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  newSessionBtn:{ flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.textSecondary, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  keepGoingBtn: { flex: 1, padding: '12px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: `1px solid rgba(239,68,68,0.2)`, color: C.red, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.1em' },
  footer:       { display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: `1px solid ${C.border}`, background: C.bgDeep, fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', flexShrink: 0 },
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
