'use client'

import { useEffect, useState } from 'react'

type Kind = 'office' | 'technician' | 'contractor' | 'subcontractor'
type AssignableOrg = { id: string; name: string; org_tier: string | null; tier_label: string; is_own: boolean }
type LoginMethod = 'field_code' | 'full_login' | 'none'
type Role = 'admin' | 'supervisor' | 'user'

const KINDS: { id: Kind; title: string; sub: string }[] = [
  { id: 'office',        title: 'Office / portal user', sub: 'Gets a login and a role. Works in the portal.' },
  { id: 'technician',    title: 'Field technician',     sub: 'Does the work. Employee.' },
  { id: 'contractor',    title: 'Contractor',           sub: 'Does the work. 1099 individual.' },
  { id: 'subcontractor', title: 'Subcontractor company', sub: 'You hand off whole jobs to an outside firm.' },
]
const ROLES: { id: Role; title: string; sub: string }[] = [
  { id: 'admin',      title: 'Admin',      sub: 'Everything in the org + can manage users.' },
  { id: 'supervisor', title: 'Supervisor', sub: 'Everything in the org. No user management.' },
  { id: 'user',       title: 'User',       sub: 'Only work assigned to them.' },
]
const LOGINS: { id: LoginMethod; title: string; sub: string }[] = [
  { id: 'field_code', title: 'Just the field app', sub: 'A code for the /tech tool. No email login.' },
  { id: 'full_login', title: 'Full login',         sub: 'Portal invite + Tech role. Sees their work orders.' },
  { id: 'none',       title: 'No login yet',        sub: 'Just track them. Add access later.' },
]

function Card({ active, title, sub, onClick }: { active: boolean; title: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="rounded-2xl p-3 text-left transition-all hover:-translate-y-0.5"
      style={{ background: active ? 'rgba(139,92,246,0.16)' : 'rgba(0,0,0,0.18)', border: active ? '1px solid rgba(139,92,246,0.45)' : '1px solid rgba(255,255,255,0.07)' }}>
      <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.92)' }}>{title}</div>
      <div className="mt-1 text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{sub}</div>
    </button>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' }} />
    </label>
  )
}

export function AddPersonWizard({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [kind, setKind] = useState<Kind | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [trade, setTrade] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [login, setLogin] = useState<LoginMethod>('field_code')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [orgs, setOrgs] = useState<AssignableOrg[]>([])
  const [orgId, setOrgId] = useState<string>('')

  // Load the companies this admin may add people into (own org + subtree;
  // corporate = all). If there's more than one, we show a company picker.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/nexus/internal/assignable-orgs')
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        const list: AssignableOrg[] = data.orgs ?? []
        setOrgs(list)
        const own = list.find(o => o.is_own) ?? list[0]
        setOrgId(data.own_org_id ?? own?.id ?? '')
      } catch { /* leave empty — route defaults to caller's own org */ }
    })()
    return () => { cancelled = true }
  }, [])

  const isTech = kind === 'technician' || kind === 'contractor'
  const needsEmail = kind === 'office' || (isTech && login === 'full_login')
  const canContinue = !!kind && name.trim().length > 0 && (!needsEmail || email.trim().length > 0)

  async function submit() {
    if (!kind) return
    setBusy(true); setResult(null)
    try {
      const res = await fetch('/api/nexus/internal/add-person', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind, name, email, phone,
          ...(orgId ? { org_id: orgId } : {}),
          ...(kind === 'office' ? { role } : {}),
          ...(isTech ? { login_method: login } : {}),
          ...(kind === 'subcontractor' ? { company, trade } : {}),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.success === false) throw new Error(json?.message ?? 'Could not add person.')
      setResult({ ok: true, message: json.message ?? 'Added.' })
      if (onDone) onDone()
    } catch (e) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Could not add person.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[96] overflow-hidden bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto flex h-auto max-h-[calc(100dvh-3rem)] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] p-5 shadow-2xl"
        style={{
          background: 'radial-gradient(circle at 16% 0%, rgba(139,92,246,0.16), transparent 34%), linear-gradient(180deg, rgba(8,18,34,0.97), rgba(3,9,22,0.97))',
          border: '1px solid rgba(139,92,246,0.22)', boxShadow: '0 30px 100px rgba(0,0,0,0.6), 0 0 58px rgba(139,92,246,0.12)', backdropFilter: 'blur(28px)',
        }}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(196,181,253,0.86)' }}>Add Person</div>
            <h2 className="mt-1 text-xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>
              {step === 1 ? 'Who are you adding?' : step === 2 ? 'Their details' : 'Review & add'}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>✕</button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {result && (
            <div className="rounded-2xl p-3 text-xs" style={{ background: result.ok ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)', border: `1px solid ${result.ok ? 'rgba(52,211,153,0.35)' : 'rgba(248,113,113,0.35)'}`, color: result.ok ? '#6ee7b7' : '#fca5a5' }}>
              {result.message}
            </div>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {KINDS.map(k => <Card key={k.id} active={kind === k.id} title={k.title} sub={k.sub} onClick={() => { setKind(k.id); setResult(null) }} />)}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {orgs.length > 1 && (
                <label className="block">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>Company / organization</div>
                  <select value={orgId} onChange={e => setOrgId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.92)' }}>
                    {orgs.map(o => (
                      <option key={o.id} value={o.id} style={{ background: '#0b1424' }}>
                        {o.name}{o.is_own ? ' (your org)' : ''} · {o.tier_label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>This person will belong to the company you pick here.</div>
                </label>
              )}
              <Field label="Name" value={name} onChange={setName} placeholder="Full name" />
              <Field label={needsEmail ? 'Email (required)' : 'Email (optional)'} value={email} onChange={setEmail} type="email" placeholder="name@company.com" />
              <Field label="Phone (optional)" value={phone} onChange={setPhone} placeholder="(555) 555-5555" />

              {kind === 'office' && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>What can they do?</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {ROLES.map(r => <Card key={r.id} active={role === r.id} title={r.title} sub={r.sub} onClick={() => setRole(r.id)} />)}
                  </div>
                </div>
              )}

              {isTech && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.55)' }}>How will they sign in?</div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {LOGINS.map(l => <Card key={l.id} active={login === l.id} title={l.title} sub={l.sub} onClick={() => setLogin(l.id)} />)}
                  </div>
                </div>
              )}

              {kind === 'subcontractor' && (
                <>
                  <Field label="Company (optional)" value={company} onChange={setCompany} placeholder="Company name" />
                  <Field label="Trade (optional)" value={trade} onChange={setTrade} placeholder="e.g. Electrical, Low-voltage" />
                </>
              )}
            </div>
          )}

          {step === 3 && kind && (
            <div className="space-y-2 rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Row label="Adding" value={KINDS.find(k => k.id === kind)!.title} />
              {orgs.length > 1 && orgId && <Row label="Company" value={orgs.find(o => o.id === orgId)?.name ?? '—'} />}
              <Row label="Name" value={name} />
              {email && <Row label="Email" value={email} />}
              {phone && <Row label="Phone" value={phone} />}
              {kind === 'office' && <Row label="Role" value={ROLES.find(r => r.id === role)!.title} />}
              {isTech && <Row label="Sign in" value={LOGINS.find(l => l.id === login)!.title} />}
              {kind === 'subcontractor' && company && <Row label="Company" value={company} />}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => (step === 1 ? onClose() : setStep((step - 1) as 1 | 2 | 3))}
            className="rounded-2xl px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {result?.ok ? (
            <button type="button" onClick={onClose} className="rounded-2xl px-4 py-2 text-xs font-semibold" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>Done</button>
          ) : step < 3 ? (
            <button type="button" disabled={step === 1 ? !kind : !canContinue} onClick={() => setStep((step + 1) as 1 | 2 | 3)}
              className="rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>
              Continue
            </button>
          ) : (
            <button type="button" disabled={busy || !canContinue} onClick={submit}
              className="rounded-2xl px-4 py-2 text-xs font-semibold disabled:opacity-40" style={{ background: 'linear-gradient(135deg, #8B5CF6, #007CFF)', color: 'white' }}>
              {busy ? 'Adding…' : 'Add Person'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</div>
      <div className="text-sm" style={{ color: 'rgba(255,255,255,0.88)' }}>{value}</div>
    </div>
  )
}
