'use client';

// Controllers (control panels) for a site — the hybrid hardware registry
// (Systems → Controllers). Corporate adds/programs serials + door names. A field
// tech/dealer can enter a replacement serial (no Brivo needed); corporate then
// confirms the swap in one click with the door mapping preserved. Won deals
// arrive as "requested" panels whose door list the dealer confirms.
import React, { useCallback, useEffect, useState } from 'react';
import { type Any, Card, Dot, DOT, Field, Note, Sheet, getJson, send, type Notify } from '@/components/nexus/systems/shared';

const doorNames = (doors: unknown): string[] => (Array.isArray(doors) ? doors : []).map((d: unknown) => typeof d === 'string' ? d : (d as { name?: string })?.name).filter(Boolean) as string[];
const STATUS: Record<string, { t: string; c: string }> = {
  live: { t: 'Live', c: DOT.green }, programmed: { t: 'Programmed', c: DOT.blue },
  replace_pending: { t: 'Replacement pending', c: DOT.orange }, requested: { t: 'Requested', c: DOT.gray },
};
const splitDoors = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

export function SitePanels({ siteId, isCorporate, notify }: { siteId: string; isCorporate: boolean; notify?: Notify }) {
  const [panels, setPanels] = useState<Any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [replace, setReplace] = useState<Any | null>(null);
  const [doorsFor, setDoorsFor] = useState<Any | null>(null);
  const say: Notify = useCallback((m, ok = true) => { if (notify) notify(m, ok); else setErr(ok ? null : m); }, [notify]);

  const load = useCallback(async () => {
    const r = await getJson(`/api/sites/${siteId}/panels`);
    setPanels(Array.isArray(r.data.panels) ? r.data.panels : []);
    setErr(r.ok ? null : (r.data.error || 'Couldn’t load controllers.'));
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);

  async function put(p: Any | null, body: Any, done: string) {
    setBusy(p?.id ?? 'x');
    const r = await send(`/api/sites/${siteId}/panels`, 'PUT', body);
    setBusy(null);
    if (!r.ok || r.data.ok === false) { say(r.data.error || 'Didn’t save.', false); return false; }
    say(done); await load(); return true;
  }

  return (
    <Card title={`Controllers${panels?.length ? ` (${panels.length})` : ''}`}
      sub={isCorporate ? 'Serial numbers and the doors each controller runs. Techs can enter a replacement serial; you confirm the swap.' : 'The access controllers at this property.'}
      right={isCorporate ? <button type="button" className="sy-b blue sm" onClick={() => setAdding(true)}>Add controller</button> : undefined}>
      {err && <div style={{ marginBottom: 8 }}><Note tone="red">{err}</Note></div>}
      {panels == null ? <div className="sy-empty">Loading…</div>
        : !panels.length ? <div className="sy-empty">No controllers recorded yet.{isCorporate ? '' : ' Gate Guard adds these during setup.'}</div>
        : panels.map(p => {
          const st = STATUS[p.status] ?? STATUS.requested;
          const names = doorNames(p.doors);
          const kickoff = p.source === 'kickoff' && p.status === 'requested' && !p.dealer_confirmed;
          return (
            <div key={p.id} style={{ padding: '12px 0', borderTop: '1px solid rgba(0,0,0,.08)' }}>
              <div className="sy-row" style={{ borderTop: 0, padding: 0, flexWrap: 'wrap' }}>
                <Dot c={st.c} />
                <div className="main" style={{ minWidth: 200 }}>
                  <div className="t">{p.model || 'Controller'} <span className="sy-pill" style={{ marginLeft: 6 }}>{st.t}</span>{p.dealer_confirmed && <span className="sy-pill" style={{ marginLeft: 6 }}>Doors confirmed</span>}</div>
                  <div className="m">Serial {p.serial || '—'}{p.pending_serial ? ` · new serial ${p.pending_serial}` : ''}{names.length ? ` · ${names.join(', ')}` : ''}</div>
                </div>
                {p.serial && p.status !== 'replace_pending' && <button type="button" className="sy-b line sm" onClick={() => setReplace(p)} disabled={busy === p.id}>Replace controller</button>}
                {isCorporate && p.status === 'replace_pending' && <button type="button" className="sy-b pri sm" onClick={() => { if (window.confirm(`Confirm the swap to serial ${p.pending_serial}? Do this after it’s set up in Brivo.`)) void put(p, { action: 'confirm_swap', panel_id: p.id }, 'Swap confirmed.'); }} disabled={busy === p.id}>Confirm swap</button>}
              </div>
              {kickoff && (
                <div style={{ marginTop: 10 }}>
                  <Note tone="blue">
                    <b style={{ fontWeight: 600 }}>Deal won — check the door list.</b> We filled these in from the survey. Fix anything that’s wrong, then confirm and Gate Guard will program the controller.
                    <div className="sy-acts" style={{ marginTop: 8 }}>
                      <button type="button" className="sy-b line sm" onClick={() => setDoorsFor(p)}>Edit door list</button>
                      <button type="button" className="sy-b pri sm" onClick={() => put(p, { action: 'confirm_doors', panel_id: p.id }, 'Door list confirmed — Gate Guard will program it.')} disabled={busy === p.id}>Confirm door list</button>
                    </div>
                  </Note>
                </div>
              )}
            </div>
          );
        })}

      {adding && <AddSheet onClose={() => setAdding(false)} onSave={async f => { setBusy('add'); const r = await send(`/api/sites/${siteId}/panels`, 'POST', { model: f.model.trim() || null, serial: f.serial.trim() || null, doors: splitDoors(f.doors) }); setBusy(null); if (!r.ok || r.data.ok === false) { say(r.data.error || 'Couldn’t add.', false); return; } say('Controller added.'); setAdding(false); void load(); }} busy={busy === 'add'} />}
      {replace && <SerialSheet panel={replace} onClose={() => setReplace(null)} onSave={async s => { if (await put(replace, { action: 'request_replace', panel_id: replace.id, new_serial: s }, 'New serial sent — Gate Guard will confirm the swap.')) setReplace(null); }} busy={busy === replace.id} />}
      {doorsFor && <DoorsSheet panel={doorsFor} onClose={() => setDoorsFor(null)} onSave={async d => { if (await put(doorsFor, { action: 'set_doors', panel_id: doorsFor.id, doors: splitDoors(d) }, 'Door list saved.')) setDoorsFor(null); }} busy={busy === doorsFor.id} />}
    </Card>
  );
}

function AddSheet({ onClose, onSave, busy }: { onClose: () => void; onSave: (f: { model: string; serial: string; doors: string }) => void; busy: boolean }) {
  const [f, setF] = useState({ model: '', serial: '', doors: '' });
  return (
    <Sheet title="Add controller" onClose={onClose} width={460}>
      <Field label="Model"><input className="sy-in" value={f.model} onChange={e => setF({ ...f, model: e.target.value })} placeholder="2-door controller" /></Field>
      <Field label="Serial number"><input className="sy-in" value={f.serial} onChange={e => setF({ ...f, serial: e.target.value })} /></Field>
      <Field label="Doors it runs (comma-separated)"><input className="sy-in" value={f.doors} onChange={e => setF({ ...f, doors: e.target.value })} placeholder="Front Gate, Pool, Lobby" /></Field>
      <button type="button" className="sy-b pri" onClick={() => onSave(f)} disabled={busy}>{busy ? 'Adding…' : 'Add controller'}</button>
    </Sheet>
  );
}
function SerialSheet({ panel, onClose, onSave, busy }: { panel: Any; onClose: () => void; onSave: (s: string) => void; busy: boolean }) {
  const [s, setS] = useState('');
  return (
    <Sheet title="Replace controller" sub={`${panel.model || 'Controller'} · current serial ${panel.serial}`} onClose={onClose} width={440}>
      <Field label="New controller’s serial number"><input className="sy-in" value={s} onChange={e => setS(e.target.value)} autoFocus /></Field>
      <div style={{ fontSize: 12, color: '#6E6E73' }}>Doors keep their names. Gate Guard confirms the swap in Brivo.</div>
      <button type="button" className="sy-b pri" onClick={() => s.trim() && onSave(s.trim())} disabled={busy || !s.trim()}>{busy ? 'Sending…' : 'Send new serial'}</button>
    </Sheet>
  );
}
function DoorsSheet({ panel, onClose, onSave, busy }: { panel: Any; onClose: () => void; onSave: (d: string) => void; busy: boolean }) {
  const [d, setD] = useState(doorNames(panel.doors).join(', '));
  return (
    <Sheet title="Door list" sub={panel.model || 'Controller'} onClose={onClose} width={460}>
      <Field label="Door names (comma-separated)"><textarea className="sy-in" rows={3} value={d} onChange={e => setD(e.target.value)} /></Field>
      <button type="button" className="sy-b pri" onClick={() => onSave(d)} disabled={busy}>{busy ? 'Saving…' : 'Save door list'}</button>
    </Sheet>
  );
}
