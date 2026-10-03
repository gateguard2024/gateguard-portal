'use client'

/**
 * SurveyEditor — dark-steel left rail (matches the Nexus workbench) for filling in
 * every variable on the Pre-Proposal Survey record, with the live SurveyRecord
 * document on the right. Loads via /survey/[id]/record. Images uploaded here are
 * saved as opportunity images; Save/Send log activities on the opportunity.
 */
import { useEffect, useRef, useState } from 'react'
import { SurveyRecord } from '@/components/public/SurveyRecord'
import type { SurveyDocConfig, PriorityFinding, OpenItem, Recommendation } from '@/lib/survey-doc'

const INK = '#17293e', MUT = '#5a708c'
const LBL_DK = '#9fb4c9', SEC_DK = '#7fc4ec', TXT_DK = '#dbe4f0'
const inS: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 9, background: '#f7fafd', border: '1px solid rgba(70,100,140,0.22)', color: INK, fontSize: 13 }
const taS: React.CSSProperties = { ...inS, resize: 'vertical', minHeight: 70, lineHeight: 1.5 }
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: LBL_DK }
const Field = ({ l, children }: { l: string; children: React.ReactNode }) => (<label style={lbl}>{l}{children}</label>)
const Sec = ({ t }: { t: string }) => <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: SEC_DK, margin: '16px 0 6px' }}>{t}</div>
const groupCard: React.CSSProperties = { padding: 10, borderRadius: 10, background: 'linear-gradient(180deg,#22303f,#1a2532)', border: '1px solid rgba(140,170,200,0.2)', marginBottom: 8 }

// Pipe-delimited list parsing/serialising so the rep can edit repeatable blocks
// as plain text (one per line, fields separated by " | ").
const parseFindings = (txt: string): PriorityFinding[] => txt.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => { const [a, b, c] = l.split('|').map(x => x.trim()); return { ref: `F${i + 1}`, title: a || '', detail: b || '', priority: (c || 'MEDIUM').toUpperCase() as PriorityFinding['priority'] } })
const parseOpen = (txt: string): OpenItem[] => txt.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => { const [a, b, c] = l.split('|').map(x => x.trim()); return { ref: `O${String(i + 1).padStart(2, '0')}`, item: a || '', why: b || '', owner: c || '' } })
const parseRecs = (txt: string): Recommendation[] => txt.split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => { const [a, b, c, d] = l.split('|').map(x => x.trim()); return { ref: `R${i + 1}`, title: a || '', detail: b || '', owner: c || '', priority: (d || 'MEDIUM').toUpperCase() as Recommendation['priority'] } })
const serFindings = (f?: PriorityFinding[]) => (f || []).map(x => [x.title, x.detail, x.priority].filter(Boolean).join(' | ')).join('\n')
const serOpen = (f?: OpenItem[]) => (f || []).map(x => [x.item, x.why, x.owner].filter(Boolean).join(' | ')).join('\n')
const serRecs = (f?: Recommendation[]) => (f || []).map(x => [x.title, x.detail, x.owner, x.priority].filter(Boolean).join(' | ')).join('\n')

export function SurveyEditor({ id }: { id: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [survey, setSurvey] = useState<any>(null)
  const [cfg, setCfg] = useState<SurveyDocConfig>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  // text mirrors for the list editors
  const [findingsTxt, setFindingsTxt] = useState('')
  const [openTxt, setOpenTxt] = useState('')
  const [recsTxt, setRecsTxt] = useState('')
  // send
  const [sendOpen, setSendOpen] = useState(false)
  const [sendTo, setSendTo] = useState('')
  const [sendCc, setSendCc] = useState('')
  const [sendSubject, setSendSubject] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const heroRef = useRef<HTMLInputElement>(null)
  const aerialRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/surveys/${id}`).then(r => r.json()).then(j => {
      if (j?.error) { setErr(j.error); return }
      const sv = j.survey || {}
      setSurvey(sv)
      const d: SurveyDocConfig = (sv.survey_doc && typeof sv.survey_doc === 'object') ? sv.survey_doc : {}
      setCfg(d)
      setFindingsTxt(serFindings(d.priority_findings))
      setOpenTxt(serOpen(d.open_items))
      setRecsTxt(serRecs(d.recommendations))
      setSendTo(sv.client_email ?? '')
    }).catch(() => setErr('Could not load this survey.'))
  }, [id])

  const set = (k: keyof SurveyDocConfig, v: unknown) => { setCfg(p => ({ ...p, [k]: v })); setSaved(false) }

  async function uploadImage(file: File, which: 'hero_url' | 'aerial_url') {
    setUploading(which); setErr(null)
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch(`/api/surveys/${id}/upload-image`, { method: 'POST', body: fd })
      const j = await r.json()
      if (!r.ok || !j.url) { setErr(j.error || 'Upload failed.'); return }
      set(which, j.url)
    } catch { setErr('Upload failed.') }
    finally { setUploading(null) }
  }

  async function save() {
    setSaving(true); setErr(null)
    try {
      const doc: SurveyDocConfig = { ...cfg, priority_findings: parseFindings(findingsTxt), open_items: parseOpen(openTxt), recommendations: parseRecs(recsTxt) }
      const r = await fetch(`/api/surveys/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ survey_doc: doc }) })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j?.error || 'Save failed.'); return }
      setCfg(doc); setSaved(true)
    } catch { setErr('Save failed.') }
    finally { setSaving(false) }
  }

  async function sendSurvey() {
    setSending(true); setSendMsg(null)
    try {
      await save()
      const r = await fetch(`/api/surveys/${id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: sendTo, cc: sendCc || undefined, subject: sendSubject || undefined }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setSendMsg({ ok: false, text: j?.error || 'Could not send.' }); return }
      setSendMsg({ ok: true, text: `Sent to ${j.to} ✓` })
    } catch { setSendMsg({ ok: false, text: 'Could not send.' }) }
    finally { setSending(false) }
  }

  if (err && !survey) return <div style={{ padding: 40, color: '#b91c1c' }}>{err}</div>
  if (!survey) return <div style={{ padding: 40, color: MUT }}>Loading…</div>

  const previewCfg: SurveyDocConfig = { ...cfg, priority_findings: parseFindings(findingsTxt), open_items: parseOpen(openTxt), recommendations: parseRecs(recsTxt) }
  const repFirst = (String(survey?.surveyor_name || '').trim().split(/\s+/)[0]) || 'Gate Guard'
  const autoSubject = `${survey?.property_name || 'Your property'} - GateGuard Pre-Proposal Survey from ${repFirst}`

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#EEF3FA 0%,#E7EEF7 100%)', display: 'flex' }}>
      <style>{`@media print { .sv-form { display:none !important } .sv-prev { width:100% !important } }`}</style>
      <aside className="sv-form" style={{ width: 380, flexShrink: 0, height: '100vh', overflowY: 'auto', padding: 18, borderRight: '1px solid rgba(10,16,24,0.4)', background: 'linear-gradient(180deg,#2b3c52 0%,#16202e 100%)' }}>
        <div style={{ marginBottom: 10 }}>
          <button onClick={() => {
            if (typeof window === 'undefined') return
            window.close()
            setTimeout(() => { if (!window.closed) window.location.href = survey?.opportunity_id ? `/crm/opportunities/${survey.opportunity_id}` : '/?tab=opps' }, 150)
          }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(70,100,140,0.25)', background: '#fff', color: MUT, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>← Back to opportunity</button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 0, fontWeight: 800, fontSize: 13, color: '#04231a', background: 'linear-gradient(135deg,#3ddc97,#12b886)', cursor: 'pointer' }}>{saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save survey'}</button>
          <button onClick={() => window.print()} style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid rgba(47,127,184,0.4)', background: '#e2eefb', color: '#2f7fb8', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>PDF</button>
        </div>
        {err && <div style={{ fontSize: 11.5, color: '#fca5a5', marginBottom: 8 }}>{err}</div>}

        <Sec t="Send survey to client" />
        <button onClick={() => { setSendOpen(o => !o); setSendMsg(null) }} style={{ width: '100%', padding: '10px', borderRadius: 10, border: 0, fontWeight: 800, fontSize: 13, color: '#fff', background: 'linear-gradient(135deg,#2f7fb8,#1d5c86)', cursor: 'pointer' }}>✉ Send survey to client</button>
        {sendOpen && (
          <div style={{ ...groupCard, marginTop: 8 }}>
            <Field l="To"><input value={sendTo} onChange={e => setSendTo(e.target.value)} placeholder="client@email.com" style={inS} /></Field>
            <div style={{ height: 8 }} /><Field l="CC (optional)"><input value={sendCc} onChange={e => setSendCc(e.target.value)} placeholder="you@gateguard.co" style={inS} /></Field>
            <div style={{ height: 8 }} /><Field l="Subject (optional — auto)"><input value={sendSubject} onChange={e => setSendSubject(e.target.value)} placeholder={autoSubject} style={inS} /></Field>
            <div style={{ fontSize: 11, color: '#9fb4c9', marginTop: 8, padding: '8px 10px', background: 'rgba(47,127,184,0.14)', border: '1px solid rgba(95,184,224,0.3)', borderRadius: 8 }}>The survey record is attached as a PDF and a CRM activity is logged on the opportunity when you send.</div>
            <button onClick={sendSurvey} disabled={sending || !sendTo} style={{ marginTop: 8, width: '100%', padding: '9px', borderRadius: 10, border: 0, fontWeight: 800, fontSize: 13, color: '#04231a', background: 'linear-gradient(135deg,#3ddc97,#12b886)', cursor: 'pointer', opacity: sending || !sendTo ? 0.6 : 1 }}>{sending ? 'Sending…' : 'Send now'}</button>
            {sendMsg && <div style={{ fontSize: 11.5, marginTop: 6, color: sendMsg.ok ? '#12855f' : '#fca5a5' }}>{sendMsg.text}</div>}
          </div>
        )}

        <Sec t="Record header" />
        <Field l="Record no."><input value={cfg.record_no ?? ''} onChange={e => set('record_no', e.target.value)} placeholder="GG-EN-2026-01" style={inS} /></Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><Field l="Version"><input value={cfg.version ?? ''} onChange={e => set('version', e.target.value)} placeholder="1.0" style={inS} /></Field></div>
          <div style={{ flex: 2 }}><Field l="Issued date"><input value={cfg.issued_date ?? ''} onChange={e => set('issued_date', e.target.value)} placeholder="October 2, 2026" style={inS} /></Field></div>
        </div>
        <div style={{ height: 8 }} /><Field l="Prepared for"><input value={cfg.prepared_for_name ?? ''} onChange={e => set('prepared_for_name', e.target.value)} placeholder={survey.property_name} style={inS} /></Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><Field l="Contact"><input value={cfg.prepared_for_contact ?? ''} onChange={e => set('prepared_for_contact', e.target.value)} placeholder="Nelsy Marcelino" style={inS} /></Field></div>
          <div style={{ flex: 1 }}><Field l="Title"><input value={cfg.contact_title ?? ''} onChange={e => set('contact_title', e.target.value)} placeholder="Property Manager" style={inS} /></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><Field l="Surveyed by"><input value={cfg.surveyed_by ?? ''} onChange={e => set('surveyed_by', e.target.value)} placeholder="GateGuard" style={inS} /></Field></div>
          <div style={{ flex: 1 }}><Field l="Role"><input value={cfg.surveyor_role ?? ''} onChange={e => set('surveyor_role', e.target.value)} placeholder="Field survey" style={inS} /></Field></div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}><Field l="Walk start"><input value={cfg.walk_start ?? ''} onChange={e => set('walk_start', e.target.value)} placeholder="12:46 pm" style={inS} /></Field></div>
          <div style={{ flex: 1 }}><Field l="Walk end"><input value={cfg.walk_end ?? ''} onChange={e => set('walk_end', e.target.value)} placeholder="12:58 pm" style={inS} /></Field></div>
        </div>

        <Sec t="Cover + aerial images" />
        <div style={groupCard}>
          <input ref={heroRef} type="file" accept="image/*" className="hidden" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImage(f, 'hero_url') }} />
          <button onClick={() => heroRef.current?.click()} disabled={uploading === 'hero_url'} style={{ width: '100%', padding: '9px', borderRadius: 9, border: '1px dashed rgba(95,184,224,0.4)', background: 'rgba(95,184,224,0.1)', color: '#9FD8EC', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{uploading === 'hero_url' ? 'Uploading…' : (cfg.hero_url ? '✓ Replace cover photo' : '+ Cover photo')}</button>
          <div style={{ height: 8 }} /><Field l="Cover caption"><input value={cfg.hero_caption ?? ''} onChange={e => set('hero_caption', e.target.value)} placeholder="Pool and clubhouse" style={inS} /></Field>
          <div style={{ height: 8 }} />
          <input ref={aerialRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) void uploadImage(f, 'aerial_url') }} />
          <button onClick={() => aerialRef.current?.click()} disabled={uploading === 'aerial_url'} style={{ width: '100%', padding: '9px', borderRadius: 9, border: '1px dashed rgba(95,184,224,0.4)', background: 'rgba(95,184,224,0.1)', color: '#9FD8EC', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{uploading === 'aerial_url' ? 'Uploading…' : (cfg.aerial_url ? '✓ Replace aerial' : '+ Site aerial')}</button>
        </div>

        <Sec t="Narrative" />
        <Field l="Executive summary"><textarea value={cfg.exec_summary ?? ''} onChange={e => set('exec_summary', e.target.value)} rows={6} placeholder="None of the three gated entrances is working…" style={taS} /></Field>
        <div style={{ height: 8 }} /><Field l="Scope note"><textarea value={cfg.scope_note ?? ''} onChange={e => set('scope_note', e.target.value)} rows={3} placeholder="auto — vehicle gates, operators, callboxes…" style={taS} /></Field>
        <div style={{ height: 8 }} /><Field l="Method note"><textarea value={cfg.method_note ?? ''} onChange={e => set('method_note', e.target.value)} rows={2} placeholder="auto — one on-site walk…" style={taS} /></Field>

        <Sec t="Openings notes" />
        <Field l="Hardware in place"><input value={cfg.hardware_note ?? ''} onChange={e => set('hardware_note', e.target.value)} placeholder="Swing gates on DoorKing operators…" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Head-end"><input value={cfg.headend_note ?? ''} onChange={e => set('headend_note', e.target.value)} placeholder="Controller / admin not established…" style={inS} /></Field>
        <div style={{ height: 8 }} /><Field l="Video"><input value={cfg.video_note ?? ''} onChange={e => set('video_note', e.target.value)} placeholder="Flock Safety poles, outside scope" style={inS} /></Field>

        <Sec t="Priority findings" />
        <div style={{ fontSize: 10.5, color: '#9fb4c9', marginBottom: 4 }}>One per line · title | detail | HIGH</div>
        <textarea value={findingsTxt} onChange={e => { setFindingsTxt(e.target.value); setSaved(false) }} rows={5} placeholder="All three entrances out of service | Gates standing open | HIGH" style={taS} />

        <Sec t="Open items" />
        <div style={{ fontSize: 10.5, color: '#9fb4c9', marginBottom: 4 }}>One per line · item | why it matters | owner</div>
        <textarea value={openTxt} onChange={e => { setOpenTxt(e.target.value); setSaved(false) }} rows={4} placeholder="Unit count | Not recorded on the walk | Property" style={taS} />

        <Sec t="Recommendations" />
        <div style={{ fontSize: 10.5, color: '#9fb4c9', marginBottom: 4 }}>One per line · title | detail | owner | HIGH</div>
        <textarea value={recsTxt} onChange={e => { setRecsTxt(e.target.value); setSaved(false) }} rows={5} placeholder="Restore all three gate sets | Replace operators, reattach arm | GateGuard | HIGH" style={taS} />
        <div style={{ height: 24 }} />
      </aside>

      <div className="sv-prev" style={{ flex: 1, overflowY: 'auto', height: '100vh', padding: '24px 0' }}>
        <SurveyRecord survey={survey} cfg={previewCfg} />
      </div>
    </div>
  )
}

export default SurveyEditor
