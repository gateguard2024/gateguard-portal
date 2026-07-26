'use client';

// DocumentLibrary — the shared document database. Everyone sees their org's docs
// plus corporate-published library docs their TIER is allowed to see. Corporate can
// upload + set tier visibility (all tiers / corporate-only / pick). Any doc can be
// sent for signature via Acrobat Sign, tracked in the "Out for signature" list.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';

const FRAME = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.05) 0 1px,transparent 1px 4px), linear-gradient(180deg,#5a6c84,#45556a)', border: '1px solid rgba(10,16,24,0.4)', boxShadow: '0 26px 54px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.3)', borderRadius: 32, padding: 22 } as const;
const TILE = { background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.04) 0 1px,transparent 1px 4px), linear-gradient(180deg,#2b3c52,#1e2a3a)', border: '1px solid rgba(140,170,200,0.22)', borderRadius: 14, padding: 12 } as const;
const WELL = 'linear-gradient(180deg,#22303f,#1a2532)';
const INPUT = { background: '#16232f', border: '1px solid rgba(140,170,200,0.22)', color: '#eaf2fb', borderRadius: 10, padding: '8px 10px', fontSize: 13, outline: 'none' } as const;
const ICE = { background: '#22303f', border: '1px solid rgba(95,184,224,0.28)', color: '#9FD8EC', borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const;
const GO = { background: '#26374a', border: '1px solid rgba(140,170,200,0.3)', color: '#cfe0f0', borderRadius: 9, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;
const CATEGORIES = ['contract', 'permit', 'certificate', 'insurance', 'manual', 'report', 'legal', 'other'];
const TIERS = [
  { id: 'corporate', label: 'Corporate' }, { id: 'master_agent', label: 'Master Agent' },
  { id: 'master_dealer', label: 'Master Dealer' }, { id: 'full_dealer', label: 'Full Dealer' },
  { id: 'service_dealer', label: 'Service Dealer' }, { id: 'install_contractor', label: 'Install Contractor' },
  { id: 'sales_partner', label: 'Sales Partner' }, { id: 'client', label: 'Client' },
];
const STATUS_COLOR: Record<string, string> = { out_for_signature: '#fbbf24', sent: '#9FD8EC', signed: '#7ee0a8', completed: '#7ee0a8', cancelled: '#f2637e' };

export function DocumentLibrary() {
  const { user } = useUser();
  const isCorporate = ((user?.publicMetadata as Any)?.org_tier) === 'corporate';
  const [docs, setDocs] = useState<Any[] | null>(null);
  const [agreements, setAgreements] = useState<Any[]>([]);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sign, setSign] = useState<{ doc: Any } | null>(null);
  const [flash, setFlash] = useState<string>('');

  const load = useCallback(async () => {
    try { const j = await fetch('/api/documents', { cache: 'no-store' }).then(r => r.json()); setDocs(Array.isArray(j.documents) ? j.documents : []); } catch { setDocs([]); }
    try { const j = await fetch('/api/esign/agreements', { cache: 'no-store' }).then(r => r.json()); setAgreements(j.agreements ?? []); } catch { /* ignore */ }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => (docs ?? []).filter(d =>
    (!cat || d.category === cat) &&
    (!q || `${d.name ?? ''} ${d.description ?? ''}`.toLowerCase().includes(q.toLowerCase()))
  ), [docs, q, cat]);

  function tierBadge(d: Any) {
    if (d.visibility !== 'shared') return null;
    const at: string[] | null = d.allowed_tiers;
    const label = !at || at.length === 0 ? 'All tiers' : at.length === 1 && at[0] === 'corporate' ? 'Corporate only' : `${at.length} tiers`;
    return <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#9FD8EC', border: '1px solid rgba(95,184,224,0.4)', borderRadius: 999, padding: '1px 7px' }}>{label}</span>;
  }

  return (
    <section style={{ width: '100%', maxWidth: 1160, margin: '0 auto', padding: '24px 12px 140px' }}>
      <div style={FRAME}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#2f4a63' }}>Documents</div>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 600, color: '#152535' }}>Document Library</h1>
            <p style={{ fontSize: 13, color: '#37485c', margin: '2px 0 0' }}>Contracts, agreements &amp; forms — send any for e-signature.</p>
          </div>
          <button onClick={() => setUploadOpen(true)} style={{ ...GO, padding: '9px 16px', fontSize: 13 }}>＋ Upload document</button>
        </div>

        {flash && <div style={{ marginBottom: 10, fontSize: 12, color: '#7ee0a8' }}>{flash}</div>}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" style={{ ...INPUT, flex: 1, minWidth: 180 }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...INPUT, padding: '8px 8px' }}>
            <option value="" style={{ background: '#111a24' }}>All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111a24' }}>{c}</option>)}
          </select>
        </div>

        {docs == null ? <div style={{ fontSize: 13, color: '#37485c' }}>Loading documents…</div>
          : shown.length === 0 ? <div style={{ fontSize: 13, color: '#37485c' }}>No documents yet — upload one to start the library.</div>
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 10 }}>
              {shown.map(d => {
                const url = d.file_url || null;
                return (
                  <div key={d.id} style={TILE}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span aria-hidden>📄</span>
                      <span style={{ color: '#eaf2fb', fontSize: 13.5, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
                      {tierBadge(d)}
                    </div>
                    <div style={{ fontSize: 10.5, color: '#98abbd', marginBottom: 8 }}>{d.category}{d.description ? ` · ${d.description}` : ''}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {url && <a href={url} target="_blank" rel="noreferrer" style={{ ...ICE, textDecoration: 'none' }}>Open</a>}
                      <button onClick={() => setSign({ doc: d })} style={GO}>✎ Send to sign</button>
                    </div>
                  </div>
                );
              })}
            </div>}

        {/* Out for signature */}
        {agreements.length > 0 && (
          <div style={{ marginTop: 18, background: WELL, border: '1px solid rgba(140,170,200,0.18)', borderRadius: 16, padding: 14 }}>
            <div style={{ color: '#9FD8EC', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Out for signature</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {agreements.slice(0, 30).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '5px 0', borderBottom: '1px solid rgba(140,170,200,0.08)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATUS_COLOR[a.status] ?? '#9FD8EC', flexShrink: 0 }} />
                  <span style={{ color: '#e2ebf4' }}>{a.name}</span>
                  <span style={{ color: '#98abbd' }}>· {a.signer_email}</span>
                  <span style={{ color: '#7f96ab', marginLeft: 'auto', textTransform: 'capitalize' }}>{String(a.status ?? '').replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {uploadOpen && <UploadModal isCorporate={isCorporate} onClose={() => setUploadOpen(false)} onDone={(m) => { setUploadOpen(false); setFlash(m); void load(); setTimeout(() => setFlash(''), 4000); }} />}
      {sign && <SignModal doc={sign.doc} onClose={() => setSign(null)} onSent={(m) => { setSign(null); setFlash(m); void load(); setTimeout(() => setFlash(''), 4000); }} />}
    </section>
  );
}

function UploadModal({ isCorporate, onClose, onDone }: { isCorporate: boolean; onClose: () => void; onDone: (msg: string) => void }) {
  const [f, setF] = useState({ name: '', category: 'contract', description: '' });
  const [file, setFile] = useState<File | null>(null);
  const [shared, setShared] = useState(false);
  const [allTiers, setAllTiers] = useState(true);
  const [tiers, setTiers] = useState<string[]>(['corporate']);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!f.name.trim() || !file) return;
    setBusy(true);
    try {
      const up = await fetch('/api/documents/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name }) }).then(r => r.json());
      if (!up.signedUrl) throw new Error(up.error || 'upload url failed');
      await fetch(up.signedUrl, { method: 'PUT', body: file });
      const body: Any = { name: f.name, category: f.category, description: f.description || null, file_url: up.publicUrl, storage_path: up.storagePath, file_size_kb: Math.round(file.size / 1024) };
      if (isCorporate && shared) { body.visibility = 'shared'; body.allowed_tiers = allTiers ? [] : tiers; }
      await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      onDone(`Uploaded ${f.name}`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Upload failed'); } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, maxHeight: '88dvh', overflowY: 'auto', background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.28)', borderRadius: 22, padding: 18 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#eaf2fb', marginBottom: 12 }}>Upload document</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="file" accept="application/pdf,image/*,.doc,.docx" onChange={e => { const x = e.target.files?.[0] ?? null; setFile(x); if (x && !f.name) setF({ ...f, name: x.name.replace(/\.[^.]+$/, '') }); }} style={{ ...INPUT, padding: 8 }} />
          <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Document name" style={INPUT} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <select value={f.category} onChange={e => setF({ ...f, category: e.target.value })} style={{ ...INPUT, padding: '8px 8px' }}>
              {CATEGORIES.map(c => <option key={c} value={c} style={{ background: '#111a24' }}>{c}</option>)}
            </select>
            <input value={f.description} onChange={e => setF({ ...f, description: e.target.value })} placeholder="Description (optional)" style={INPUT} />
          </div>

          {isCorporate && (
            <div style={{ ...TILE, borderRadius: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#e2ebf4', cursor: 'pointer' }}>
                <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Publish to shared library (choose who can access)
              </label>
              {shared && (
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#c3d3e2', cursor: 'pointer' }}>
                    <input type="checkbox" checked={allTiers} onChange={e => setAllTiers(e.target.checked)} /> All tiers
                  </label>
                  {!allTiers && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {TIERS.map(t => {
                        const on = tiers.includes(t.id);
                        return <button key={t.id} onClick={() => setTiers(on ? tiers.filter(x => x !== t.id) : [...tiers, t.id])} style={{ borderRadius: 999, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: on ? 'rgba(95,184,224,0.2)' : '#16232f', border: `1px solid ${on ? 'rgba(95,184,224,0.5)' : 'rgba(140,170,200,0.2)'}`, color: on ? '#bfe6ff' : '#8ba0b4' }}>{t.label}</button>;
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#98abbd', fontSize: 12.5, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={busy || !file || !f.name.trim()} style={{ ...GO, padding: '8px 16px', opacity: busy || !file || !f.name.trim() ? 0.4 : 1 }}>{busy ? 'Uploading…' : 'Upload'}</button>
        </div>
      </div>
    </div>
  );
}

function SignModal({ doc, onClose, onSent }: { doc: Any; onClose: () => void; onSent: (msg: string) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [signUrl, setSignUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');

  async function send() {
    if (!email.trim()) return;
    setBusy(true); setErr('');
    try {
      const j = await fetch('/api/adobe-sign/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: doc.id, signer_email: email.trim(), signer_name: name.trim() || undefined }) }).then(r => r.json());
      if (j.error) throw new Error(j.error);
      if (j.signing_url) setSignUrl(j.signing_url); else onSent(`Sent “${doc.name}” to ${email} for signature`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Send failed'); } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: signUrl ? 900 : 440, maxHeight: '90dvh', overflowY: 'auto', background: 'linear-gradient(180deg,#1d2a39,#141d28)', border: '1px solid rgba(140,170,200,0.28)', borderRadius: 22, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#eaf2fb' }}>Send for signature</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#98abbd', fontSize: 12.5, cursor: 'pointer' }}>Close</button>
        </div>
        {signUrl ? (
          <iframe src={signUrl} title="Sign document" style={{ width: '100%', height: '70dvh', border: '1px solid rgba(140,170,200,0.2)', borderRadius: 12, background: '#fff' }} />
        ) : (
          <>
            <div style={{ fontSize: 12.5, color: '#98abbd', marginBottom: 10 }}>{doc.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Signer name (optional)" style={INPUT} />
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Signer email" style={INPUT} />
              {err && <div style={{ fontSize: 12, color: '#f2637e' }}>{err}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button onClick={send} disabled={busy || !email.trim()} style={{ ...GO, padding: '8px 16px', opacity: busy || !email.trim() ? 0.4 : 1 }}>{busy ? 'Sending…' : 'Send via Acrobat Sign'}</button>
            </div>
            <div style={{ fontSize: 9.5, color: '#6f8397', marginTop: 8 }}>Uses Adobe Acrobat Sign. If embedded signing is available on your plan, it opens here; otherwise Adobe emails the signer.</div>
          </>
        )}
      </div>
    </div>
  );
}
