'use client';
// Operations Hub — work orders + dispatch, glass, 5th-grader simple.
// Reused inline inside the Jobs tab (seamless, no page jump) and at /cmms.
// All data from existing endpoints: /api/dispatch (list+create) and
// /api/maintenance/[id] (+ /time) for detail/edit. No new tables.
import React, { useEffect, useState } from "react";

type RealWO = { id: string; property?: string; assignedTech?: string | null; assignedTechId?: string | null; eta?: string; priority: string; status: string; woNumber?: string | null; title?: string | null };
type RealTech = { id: string; name: string };

const JOB_COLUMNS: { key: string; label: string; from: string[]; accent: string }[] = [
  { key: "New",         label: "New",         from: ["Pending", "open", "New", "Approved"],                                    accent: "#64748b" },
  { key: "Scheduled",   label: "Scheduled",   from: ["Assigned", "scheduled", "Scheduled"],                                    accent: "#3b82f6" },
  { key: "In Progress", label: "In Progress", from: ["In Progress", "in_progress", "On Site", "En Route", "Waiting Parts"],    accent: "#f59e0b" },
  { key: "Done",        label: "Done",        from: ["Done", "completed", "Complete"],                                         accent: "#10b981" },
];
const bucketOf = (s: string) => JOB_COLUMNS.find(c => c.from.includes(s))?.key ?? "New";
const COL_TO_DB: Record<string, string> = { New: "open", Scheduled: "scheduled", "In Progress": "in_progress", Done: "completed" };
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const card = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 } as const;
const btn = { background: "#6366f1", color: "white", border: 0, borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600 } as const;
const input = { width: "100%", boxSizing: "border-box" as const, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.12)", color: "white", borderRadius: 12, padding: 12, fontSize: 14 };
const sel = { background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", color: "white", borderRadius: 10, padding: "6px 8px", fontSize: 12 } as const;
const Small = ({ children }: { children: React.ReactNode }) => <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{children}</div>;
const Big = ({ children }: { children: React.ReactNode }) => <div style={{ fontSize: 30, fontWeight: 800, color: "#00C8FF", margin: "6px 0" }}>{children}</div>;
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <div style={{ ...card, ...style }}>{children}</div>;
function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  const bg = tone === "urgent" ? "rgba(255,80,80,.18)" : tone === "high" ? "rgba(255,170,0,.18)" : "rgba(255,255,255,.08)";
  return <span style={{ padding: "4px 9px", borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,.1)", fontSize: 11 }}>{children}</span>;
}

export function OperationsHub({ embedded }: { embedded?: boolean } = {}) {
  const [page, setPage] = useState("Dashboard");
  const [jobs, setJobs] = useState<RealWO[]>([]);
  const [techs, setTechs] = useState<RealTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const loadOps = React.useCallback(() => {
    setLoading(true);
    fetch("/api/dispatch").then(r => r.json()).then(d => { setJobs(d.jobs ?? []); setTechs(d.techs ?? []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadOps(); }, [loadOps]);
  const createWO = async (p: Record<string, unknown>) => { await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) }).catch(() => {}); loadOps(); };
  const updateWO = async (id: string, patch: Record<string, unknown>) => { await fetch(`/api/maintenance/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => {}); loadOps(); };

  return <div style={{ color: "white" }}>
    {!embedded && <>
      <div style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "rgba(0,200,255,0.8)" }}>Nexus</div>
      <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 700 }}>Operations Hub</h1>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 16 }}>Jobs, work orders, and dispatch — in one place.</p>
    </>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
      {["Dashboard", "Work Orders"].map(p => {
        const on = page === p;
        return <button key={p} onClick={() => setPage(p)} style={{ padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: on ? "linear-gradient(135deg, rgba(0,124,255,0.42), rgba(0,200,255,0.16))" : "rgba(255,255,255,0.02)",
          border: on ? "1px solid rgba(0,200,255,0.42)" : "0.5px solid rgba(255,255,255,0.07)", color: on ? "white" : "rgba(255,255,255,0.5)" }}>{p}</button>;
      })}
      <button onClick={loadOps} style={{ ...btn, background: "rgba(255,255,255,0.06)" }}>↻</button>
    </div>
    {page === "Dashboard" && <Dashboard jobs={jobs} loading={loading} onOpen={setOpenId} />}
    {page === "Work Orders" && <WorkOrders jobs={jobs} techs={techs} loading={loading} onCreate={createWO} onUpdate={updateWO} onOpen={setOpenId} />}
    {openId && <JobDetailDrawer id={openId} techs={techs} onClose={() => { setOpenId(null); loadOps(); }} onUpdate={updateWO} />}
  </div>;
}

function Dashboard({ jobs, loading, onOpen }: { jobs: RealWO[]; loading: boolean; onOpen: (id: string) => void }) {
  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
      {JOB_COLUMNS.map(col => <Card key={col.key}><Small>{col.label}</Small><Big>{loading ? "…" : String(jobs.filter(j => bucketOf(j.status) === col.key).length)}</Big></Card>)}
    </div>
    <Board jobs={jobs} onOpen={onOpen} />
  </div>;
}

function WorkOrders({ jobs, techs, loading, onCreate, onUpdate, onOpen }: { jobs: RealWO[]; techs: RealTech[]; loading: boolean; onCreate: (p: Record<string, unknown>) => void; onUpdate: (id: string, patch: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ customer_name: "", title: "", priority: "medium", assignee_id: "" });
  function submit() {
    if (!form.customer_name.trim()) return;
    const t = techs.find(x => x.id === form.assignee_id);
    onCreate({ customer_name: form.customer_name.trim(), title: form.title.trim() || form.customer_name.trim(), priority: form.priority, assignee_id: form.assignee_id || null, assignee_name: t?.name ?? null });
    setForm({ customer_name: "", title: "", priority: "medium", assignee_id: "" }); setShowNew(false);
  }
  return <div style={{ display: "grid", gap: 16 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16 }}>Work Orders</h2>
        <button onClick={() => setShowNew(s => !s)} style={btn}>+ New</button>
      </div>
      {showNew && <div style={{ ...card, marginBottom: 12, display: "grid", gap: 8 }}>
        <input placeholder="Customer / site *" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} style={input} />
        <input placeholder="What needs doing?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={input} />
        <div style={{ display: "flex", gap: 8 }}>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ ...sel, flex: 1 }}>{["low", "medium", "high", "critical"].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)} priority</option>)}</select>
          <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ ...sel, flex: 1 }}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        </div>
        <button onClick={submit} disabled={!form.customer_name.trim()} style={{ ...btn, opacity: form.customer_name.trim() ? 1 : 0.5 }}>Create work order</button>
      </div>}
      {loading ? <Small>Loading…</Small> : jobs.length === 0 ? <Small>No work orders yet. Tap “+ New”.</Small> : jobs.map(wo => <WORow key={wo.id} wo={wo} techs={techs} onUpdate={onUpdate} onOpen={onOpen} />)}
    </Card>
    <Board jobs={jobs} onOpen={onOpen} />
  </div>;
}

function WORow({ wo, techs, onUpdate, onOpen }: { wo: RealWO; techs: RealTech[]; onUpdate: (id: string, patch: Record<string, unknown>) => void; onOpen: (id: string) => void }) {
  return <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 8 }}>
    <div onClick={() => onOpen(wo.id)} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{wo.woNumber || wo.title || "Work Order"}</b><Badge tone={wo.priority === "Urgent" ? "urgent" : wo.priority === "High" ? "high" : "default"}>{wo.priority}</Badge></div>
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "4px 0 8px" }}>{wo.property || "—"} <span style={{ color: "rgba(255,255,255,0.3)" }}>· tap for detail</span></p>
    </div>
    <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <select value={bucketOf(wo.status)} onChange={e => onUpdate(wo.id, { status: COL_TO_DB[e.target.value] })} style={sel}>{JOB_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
      <select value={wo.assignedTechId ?? ""} onChange={e => { const t = techs.find(x => x.id === e.target.value); onUpdate(wo.id, { assignee_id: e.target.value || null, assignee_name: t?.name ?? null }); }} style={sel}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
    </div>
  </div>;
}

function Board({ jobs, onOpen }: { jobs: RealWO[]; onOpen: (id: string) => void }) {
  return <Card><h2 style={{ fontSize: 16, marginBottom: 12 }}>Jobs board</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
      {JOB_COLUMNS.map(col => {
        const items = jobs.filter(w => bucketOf(w.status) === col.key);
        return <div key={col.key}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 12, background: `${col.accent}22`, border: `1px solid ${col.accent}55`, marginBottom: 10 }}><span style={{ fontWeight: 700, fontSize: 13 }}>{col.label}</span><span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}>{items.length}</span></div>
          {items.map(w => <div key={w.id} onClick={() => onOpen(w.id)} style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 10, cursor: "pointer" }}>
            <b style={{ fontSize: 13 }}>{w.woNumber || w.title || "Work Order"}</b>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, margin: "4px 0" }}>{w.property || "—"}{w.assignedTech ? ` · ${w.assignedTech}` : " · Unassigned"}</p>
          </div>)}
          {items.length === 0 && <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, textAlign: "center", padding: "8px 0" }}>—</p>}
        </div>;
      })}
    </div>
  </Card>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobDetailDrawer({ id, techs, onClose, onUpdate }: { id: string; techs: RealTech[]; onClose: () => void; onUpdate: (id: string, patch: Record<string, unknown>) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wo, setWo] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parts, setParts] = useState<any[]>([]);
  const [laborMins, setLaborMins] = useState(0);
  const [loading, setLoading] = useState(true);
  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/maintenance/${id}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/time`).then(r => r.json()).catch(() => ({})),
    ]).then(([d, t]) => { setWo(d.work_order ?? null); setParts(d.parts_used ?? []); setLaborMins(t.totalMins ?? 0); }).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = (v: any) => Number(v) || 0;
  const partsCost = parts.reduce((s, p) => s + n(p.unit_cost) * n(p.qty), 0);
  const partsRev = parts.reduce((s, p) => s + n(p.unit_price) * n(p.qty), 0);
  const patchField = (p: Record<string, unknown>) => { onUpdate(id, p); setWo((w: typeof wo) => w ? { ...w, ...p } : w); };
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "min(560px,100%)", height: "100%", overflowY: "auto", background: "linear-gradient(180deg,#0c1530,#060b1a)", borderLeft: "1px solid rgba(0,200,255,0.22)", padding: 20, color: "white" }}>
      <button onClick={onClose} style={{ ...btn, background: "rgba(255,255,255,0.06)", marginBottom: 16 }}>✕ Close</button>
      {loading ? <Small>Loading…</Small> : !wo ? <Small>Couldn’t load this work order.</Small> : <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(0,200,255,0.8)", letterSpacing: "0.1em" }}>{wo.wo_number || "WORK ORDER"}</div>
          <h2 style={{ margin: "4px 0", fontSize: 22 }}>{wo.title || "Work order"}</h2>
          <Small>{wo.customer_name || "—"}{wo.scheduled_date ? ` · ${wo.scheduled_date}` : ""}</Small>
        </div>
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Status</Small><select value={bucketOf(wo.status)} onChange={e => patchField({ status: COL_TO_DB[e.target.value] })} style={{ ...sel, width: "100%", marginTop: 4 }}>{JOB_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Assigned to</Small><select value={wo.assignee_id ?? ""} onChange={e => { const t = techs.find(x => x.id === e.target.value); patchField({ assignee_id: e.target.value || null, assignee_name: t?.name ?? null }); }} style={{ ...sel, width: "100%", marginTop: 4 }}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
        </Card>
        <Card>
          <h2 style={{ fontSize: 15 }}>Money on this job</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <div><Small>Parts cost</Small><div style={{ fontSize: 18, fontWeight: 700 }}>{money(partsCost)}</div></div>
            <div><Small>Parts price</Small><div style={{ fontSize: 18, fontWeight: 700 }}>{money(partsRev)}</div></div>
            <div><Small>Parts margin</Small><div style={{ fontSize: 18, fontWeight: 700, color: "#34d399" }}>{money(partsRev - partsCost)}</div></div>
            <div><Small>Labor logged</Small><div style={{ fontSize: 18, fontWeight: 700 }}>{Math.round((laborMins / 60) * 10) / 10} hrs</div></div>
          </div>
        </Card>
        <Card>
          <h2 style={{ fontSize: 15 }}>Parts used</h2>
          {parts.length === 0 ? <Small>None yet.</Small> : parts.map((p, i) => <p key={p.id || i} style={{ margin: "6px 0" }}>{p.name || "Part"} × {n(p.qty)} <span style={{ color: "#34d399" }}>· {money((n(p.unit_price) - n(p.unit_cost)) * n(p.qty))} margin</span></p>)}
        </Card>
        {wo.description && <Card><h2 style={{ fontSize: 15 }}>Notes</h2><p style={{ color: "rgba(255,255,255,0.8)", whiteSpace: "pre-wrap" }}>{wo.description}</p></Card>}
      </div>}
    </div>
  </div>;
}
