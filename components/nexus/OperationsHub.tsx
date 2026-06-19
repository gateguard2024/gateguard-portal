'use client';
// Operations Hub — the one place for jobs, work orders, dispatch, sites, parts
// and preventive maintenance. Glass, 5th-grader simple. Reused inline inside the
// Jobs tab (seamless, no page jump) and at /cmms.
//
// Folds the old 11-tab CMMS into 5 plain-English tabs. The heavy work-order
// detail (money/profitability, checklist a.k.a. procedures, parts used, team
// chat a.k.a. messages, complete) lives inside the job drawer — open any job.
//
// All data from existing endpoints (no new tables):
//   /api/dispatch                       jobs + techs (list + create)
//   /api/maintenance/[id]               work_order + checklist + comments + parts_used
//   /api/maintenance/[id] (PATCH)       status / assignee / complete
//   /api/maintenance/[id]/checklist     add + toggle checklist (procedures)
//   /api/maintenance/[id]/comments      add team chat (messages)
//   /api/sites                          locations (asset + open-WO counts)
//   /api/products                       parts inventory
//   /api/pm-schedules                   preventive maintenance
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
const Big = ({ children, color }: { children: React.ReactNode; color?: string }) => <div style={{ fontSize: 30, fontWeight: 800, color: color ?? "#00C8FF", margin: "6px 0" }}>{children}</div>;
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <div style={{ ...card, ...style }}>{children}</div>;
function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  const bg = tone === "urgent" ? "rgba(255,80,80,.18)" : tone === "high" ? "rgba(255,170,0,.18)" : tone === "good" ? "rgba(52,211,153,.18)" : "rgba(255,255,255,.08)";
  return <span style={{ padding: "4px 9px", borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,.1)", fontSize: 11 }}>{children}</span>;
}
const num = (v: unknown) => Number(v) || 0;
const TABS = ["Dashboard", "Work Orders", "Calendar", "Locations", "Techs", "Parts", "PM"] as const;
type Tab = typeof TABS[number];
const TAB_HINT: Record<Tab, string> = {
  Dashboard: "Snapshot + jobs board",
  "Work Orders": "Create, assign, track",
  Calendar: "What's scheduled, by day",
  Locations: "Your sites — tap to edit details",
  Techs: "Add techs + set their app code",
  Parts: "Inventory + stock levels",
  PM: "Recurring maintenance",
};

export function OperationsHub({ embedded }: { embedded?: boolean } = {}) {
  const [page, setPage] = useState<Tab>("Dashboard");
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
      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginBottom: 16 }}>Jobs, work orders, dispatch, sites, and parts — in one place.</p>
    </>}
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
      {TABS.map(p => {
        const on = page === p;
        return <button key={p} onClick={() => setPage(p)} style={{ padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
          background: on ? "linear-gradient(135deg, rgba(0,124,255,0.42), rgba(0,200,255,0.16))" : "rgba(255,255,255,0.02)",
          border: on ? "1px solid rgba(0,200,255,0.42)" : "0.5px solid rgba(255,255,255,0.07)", color: on ? "white" : "rgba(255,255,255,0.5)" }}>{p}</button>;
      })}
      <button onClick={loadOps} title="Refresh" style={{ ...btn, background: "rgba(255,255,255,0.06)" }}>↻</button>
    </div>
    <p style={{ color: "rgba(255,255,255,0.34)", fontSize: 12, marginBottom: 18 }}>{TAB_HINT[page]}</p>

    {page === "Dashboard" && <Dashboard jobs={jobs} techs={techs} loading={loading} onOpen={setOpenId} onUpdate={updateWO} />}
    {page === "Work Orders" && <WorkOrders jobs={jobs} techs={techs} loading={loading} onCreate={createWO} onUpdate={updateWO} onOpen={setOpenId} />}
    {page === "Calendar" && <CalendarView onOpenWO={setOpenId} />}
    {page === "Locations" && <Locations />}
    {page === "Techs" && <Techs />}
    {page === "Parts" && <Parts />}
    {page === "PM" && <PM />}
    {openId && <JobDetailDrawer id={openId} techs={techs} onClose={() => { setOpenId(null); loadOps(); }} onUpdate={updateWO} />}
  </div>;
}

/* ── Dashboard: counts + dispatch strip + jobs board ─────────────────────── */
function Dashboard({ jobs, techs, loading, onOpen, onUpdate }: { jobs: RealWO[]; techs: RealTech[]; loading: boolean; onOpen: (id: string) => void; onUpdate: (id: string, patch: Record<string, unknown>) => void }) {
  const unassigned = jobs.filter(j => !j.assignedTechId && bucketOf(j.status) !== "Done");
  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 14 }}>
      {JOB_COLUMNS.map(col => <Card key={col.key}><Small>{col.label}</Small><Big color={col.accent === "#10b981" ? "#34d399" : undefined}>{loading ? "…" : String(jobs.filter(j => bucketOf(j.status) === col.key).length)}</Big></Card>)}
    </div>

    {/* Dispatch strip — folds dispatch in without a crowded separate page */}
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 16 }}>Needs a tech</h2>
        <Small>{techs.length} {techs.length === 1 ? "tech" : "techs"} available</Small>
      </div>
      {loading ? <Small>Loading…</Small> : unassigned.length === 0 ? <Small>Everything's assigned. 🎉</Small> : <div style={{ display: "grid", gap: 8 }}>
        {unassigned.map(w => <div key={w.id} style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", padding: 10, borderRadius: 12, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)" }}>
          <div onClick={() => onOpen(w.id)} style={{ cursor: "pointer", minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>{w.woNumber || w.title || "Work Order"}</b>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{w.property || "—"}</div>
          </div>
          <select defaultValue="" onChange={e => { const t = techs.find(x => x.id === e.target.value); if (e.target.value) onUpdate(w.id, { assignee_id: e.target.value, assignee_name: t?.name ?? null, status: "scheduled" }); }} style={sel}>
            <option value="">Assign tech…</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>)}
      </div>}
    </Card>

    <Board jobs={jobs} onOpen={onOpen} />
  </div>;
}

/* ── Work Orders: create + list + board ──────────────────────────────────── */
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

/* ── Calendar: scheduled work, by day (real /api/calendar/events) ────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CalendarView({ onOpenWO }: { onOpenWO: (id: string) => void }) {
  const today = new Date();
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() + 1 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/calendar/events?year=${ym.y}&month=${ym.m}&scope=team`).then(r => r.json()).then(d => setEvents(d.events ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, [ym]);
  const monthName = new Date(ym.y, ym.m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstDow = new Date(ym.y, ym.m - 1, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m, 0).getDate();
  const EVENT_COLOR: Record<string, string> = { work_order: "#34d399", work_order_phase: "#f59e0b", pm_schedule: "#0ea5e9", todo: "#6B7EFF", crm_activity: "#a78bfa", tracker_task: "#a78bfa", nexus_event: "#94a3b8", gcal: "#c084fc" };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayEvents = (day: number) => { const d = `${ym.y}-${String(ym.m).padStart(2, "0")}-${String(day).padStart(2, "0")}`; return events.filter((e: any) => String(e.date ?? "").slice(0, 10) === d); };
  const shift = (delta: number) => setYm(p => { let m = p.m + delta, y = p.y; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; } return { y, m }; });
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  return <Card>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
      <button onClick={() => shift(-1)} style={{ ...btn, background: "rgba(255,255,255,0.06)" }}>‹</button>
      <h2 style={{ fontSize: 16 }}>{loading ? "Loading…" : monthName}</h2>
      <button onClick={() => shift(1)} style={{ ...btn, background: "rgba(255,255,255,0.06)" }}>›</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.4)", padding: 4 }}>{d}</div>)}
      {cells.map((day, i) => {
        if (day === null) return <div key={`x${i}`} />;
        const evs = dayEvents(day);
        const isToday = ym.y === today.getFullYear() && ym.m === today.getMonth() + 1 && day === today.getDate();
        return <div key={day} style={{ minHeight: 78, padding: 6, borderRadius: 10, background: isToday ? "rgba(0,200,255,0.10)" : "rgba(255,255,255,0.03)", border: isToday ? "1px solid rgba(0,200,255,0.4)" : "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 3 }}>{day}</div>
          {evs.slice(0, 3).map((e, j) => <div key={e.id || j} onClick={() => e.type === "work_order" && onOpenWO(e.id)} title={e.title} style={{ cursor: e.type === "work_order" ? "pointer" : "default", fontSize: 10, lineHeight: 1.3, marginBottom: 2, padding: "1px 4px", borderRadius: 5, background: `${EVENT_COLOR[e.type] ?? "#94a3b8"}26`, borderLeft: `2px solid ${EVENT_COLOR[e.type] ?? "#94a3b8"}`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.title}</div>)}
          {evs.length > 3 && <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>+{evs.length - 3} more</div>}
        </div>;
      })}
    </div>
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
      <span><span style={{ color: "#34d399" }}>■</span> Work order</span>
      <span><span style={{ color: "#f59e0b" }}>■</span> Job phase</span>
      <span><span style={{ color: "#0ea5e9" }}>■</span> PM</span>
      <span><span style={{ color: "#6B7EFF" }}>■</span> To-do</span>
    </div>
  </Card>;
}

/* ── Techs: add technicians + set their /tech app code (password) ────────── */
function genTechCode(initials: string) { return `GG-${(initials || "GG").toUpperCase().slice(0, 2)}-${Math.floor(1000 + Math.random() * 9000)}`; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Techs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [techs, setTechs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Tech", phone: "", email: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const load = React.useCallback(() => { setLoading(true); fetch("/api/dispatch/technicians").then(r => r.json()).then(d => setTechs(d.technicians ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  async function addTech() {
    if (!form.name.trim()) return;
    await fetch("/api/dispatch/technicians", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }).catch(() => {});
    setForm({ name: "", role: "Tech", phone: "", email: "" }); setShowNew(false); load();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function setCode(t: any) {
    const code = genTechCode(t.initials || (t.name || "").split(" ").map((w: string) => w[0]).join(""));
    await fetch(`/api/dispatch/technicians/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tech_code: code }) }).catch(() => {});
    load();
  }
  function copy(code: string) { navigator.clipboard?.writeText(code).then(() => { setCopied(code); setTimeout(() => setCopied(null), 1500); }).catch(() => {}); }
  return <div style={{ display: "grid", gap: 14 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16 }}>Technicians</h2>
        <button onClick={() => setShowNew(s => !s)} style={btn}>+ Add tech</button>
      </div>
      <Small>Each tech logs into the field tool at <b style={{ color: "rgba(255,255,255,0.7)" }}>/tech</b> using their personal code below.</Small>
      {showNew && <div style={{ ...card, marginTop: 12, display: "grid", gap: 8 }}>
        <input placeholder="Full name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Role" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ ...input, flex: 1 }} />
          <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ ...input, flex: 1 }} />
        </div>
        <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={input} />
        <button onClick={addTech} disabled={!form.name.trim()} style={{ ...btn, opacity: form.name.trim() ? 1 : 0.5 }}>Add technician</button>
      </div>}
    </Card>
    {loading ? <Card><Small>Loading…</Small></Card> : techs.length === 0 ? <Card><Small>No technicians yet. Tap “+ Add tech”.</Small></Card> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 14 }}>
        {techs.map(t => <Card key={t.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{t.name}</b>
            <Badge tone={t.status === "available" ? "good" : "default"}>{t.role || "Tech"}</Badge>
          </div>
          {(t.phone || t.email) && <Small>{[t.phone, t.email].filter(Boolean).join(" · ")}</Small>}
          <div style={{ marginTop: 12 }}>
            <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 4 }}>App code (their password for /tech)</div>
            {t.tech_code ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontFamily: "monospace", fontSize: 14, background: "rgba(0,200,255,0.12)", border: "1px solid rgba(0,200,255,0.3)", borderRadius: 8, padding: "5px 10px" }}>{t.tech_code}</code>
              <button onClick={() => copy(t.tech_code)} style={{ ...btn, background: "rgba(255,255,255,0.08)", padding: "6px 10px" }}>{copied === t.tech_code ? "Copied!" : "Copy"}</button>
              <button onClick={() => setCode(t)} style={{ ...btn, background: "rgba(255,255,255,0.08)", padding: "6px 10px" }}>Regen</button>
            </div> : <button onClick={() => setCode(t)} style={btn}>Generate code</button>}
          </div>
        </Card>)}
      </div>}
  </div>;
}

/* ── Locations: sites with asset + open-WO counts (real /api/sites) ──────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Locations() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSite, setOpenSite] = useState<string | null>(null);
  const load = React.useCallback(() => { setLoading(true); fetch("/api/sites?limit=60").then(r => r.json()).then(d => setSites(d.sites ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  if (loading) return <Card><Small>Loading sites…</Small></Card>;
  if (sites.length === 0) return <Card><Small>No sites found yet. These come from your customer / org sites.</Small></Card>;
  return <>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
      {sites.map(s => <Card key={s.id} style={{ cursor: "pointer" }}>
        <div onClick={() => setOpenSite(s.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{s.name || "Site"}</b>
            {s.offline_asset_count > 0 ? <Badge tone="urgent">{s.offline_asset_count} offline</Badge> : <Badge tone="good">healthy</Badge>}
          </div>
          <Small>{[s.city, s.state].filter(Boolean).join(", ") || "—"}</Small>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13 }}>
            <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Units</div><b>{num(s.units) || "—"}</b></div>
            <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Assets</div><b>{num(s.asset_count)}</b></div>
            <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Open WOs</div><b>{num(s.open_wo_count)}</b></div>
          </div>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 10 }}>Tap to view & edit details →</p>
        </div>
      </Card>)}
    </div>
    {openSite && <SiteDetailDrawer id={openSite} onClose={() => { setOpenSite(null); load(); }} />}
  </>;
}

/* ── Site detail: full canonical site, editable (real /api/sites/[id]) ───── */
const SITE_FIELDS: { key: string; label: string; full?: boolean }[] = [
  { key: "name", label: "Property name", full: true },
  { key: "address", label: "Street address", full: true },
  { key: "city", label: "City" }, { key: "state", label: "State" }, { key: "zip", label: "ZIP" },
  { key: "property_type", label: "Property type" }, { key: "units", label: "Units" },
  { key: "primary_contact_name", label: "Contact name" }, { key: "primary_contact_phone", label: "Contact phone" },
  { key: "primary_contact_email", label: "Contact email", full: true },
  { key: "pm_name", label: "Property manager" }, { key: "pm_phone", label: "PM phone" },
  { key: "pm_email", label: "PM email", full: true },
  { key: "access_notes", label: "Access / gate notes", full: true },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SiteDetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [site, setSite] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assets, setAssets] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wos, setWos] = useState<any[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setLoading(true);
    fetch(`/api/sites/${id}`).then(r => r.json()).then(d => { setSite(d.site ?? null); setAssets(d.assets ?? d.site_assets ?? []); setWos(d.work_orders ?? d.workOrders ?? []); }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);
  const val = (k: string) => (k in edit ? edit[k] : (site?.[k] ?? "")) as string;
  async function save() {
    if (Object.keys(edit).length === 0) { onClose(); return; }
    setSaving(true);
    const r = await fetch(`/api/sites/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) }).catch(() => null);
    setSaving(false);
    if (r && r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); setEdit({}); const d = await r.json().catch(() => null); if (d?.site) setSite(d.site); }
  }
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "min(600px,100%)", height: "100%", overflowY: "auto", background: "linear-gradient(180deg,#0c1530,#060b1a)", borderLeft: "1px solid rgba(0,200,255,0.22)", padding: 20, color: "white" }}>
      <button onClick={onClose} style={{ ...btn, background: "rgba(255,255,255,0.06)", marginBottom: 16 }}>✕ Close</button>
      {loading ? <Small>Loading…</Small> : !site ? <Small>Couldn’t load this site.</Small> : <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(0,200,255,0.8)", letterSpacing: "0.1em" }}>SITE</div>
          <h2 style={{ margin: "4px 0", fontSize: 22 }}>{site.name || "Site"}</h2>
          <Small>{[site.city, site.state].filter(Boolean).join(", ") || "—"}</Small>
        </div>
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>Details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SITE_FIELDS.map(f => <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : undefined }}>
              <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, marginBottom: 3 }}>{f.label}</div>
              <input value={val(f.key)} onChange={e => setEdit(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...input, padding: 9, fontSize: 13 }} />
            </div>)}
          </div>
          <button onClick={save} disabled={saving} style={{ ...btn, marginTop: 12, background: saved ? "#10b981" : "#6366f1" }}>{saving ? "Saving…" : saved ? "✓ Saved" : "Save details"}</button>
        </Card>
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Assets ({assets.length})</h2>
          {assets.length === 0 ? <Small>No assets logged at this site yet.</Small> : assets.map((a, i) => <p key={a.id || i} style={{ margin: "5px 0", fontSize: 14 }}>{a.name || a.device_type || "Asset"} {a.status && <Badge tone={a.status === "offline" ? "urgent" : "good"}>{a.status}</Badge>}</p>)}
        </Card>
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Recent work orders ({wos.length})</h2>
          {wos.length === 0 ? <Small>None yet.</Small> : wos.slice(0, 8).map((w, i) => <p key={w.id || i} style={{ margin: "5px 0", fontSize: 14 }}>{w.wo_number || w.title || "WO"} <span style={{ color: "rgba(255,255,255,0.5)" }}>· {w.status}</span></p>)}
        </Card>
      </div>}
    </div>
  </div>;
}

/* ── Parts: inventory (real /api/products) ───────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Parts() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  useEffect(() => { fetch("/api/products?limit=60").then(r => r.json()).then(d => setParts(d.products ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cost = (p: any) => num(p.dealer_cost ?? p.unit_cost ?? p.cost);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const price = (p: any) => num(p.sell_price ?? p.unit_price ?? p.price ?? p.list_price);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHand = (p: any) => p.on_hand ?? p.qty_on_hand ?? p.stock ?? null;
  const shown = parts.filter(p => !q || `${p.name ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  if (loading) return <Card><Small>Loading parts…</Small></Card>;
  return <div style={{ display: "grid", gap: 14 }}>
    <input placeholder="Search parts by name or SKU" value={q} onChange={e => setQ(e.target.value)} style={input} />
    {shown.length === 0 ? <Card><Small>No parts found.</Small></Card> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
      {shown.map(p => {
        const oh = onHand(p);
        const low = oh != null && num(oh) <= 3;
        return <Card key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{p.name || "Part"}</b>
            {low && <Badge tone="urgent">Low stock</Badge>}
          </div>
          {p.sku && <Small>{p.sku}</Small>}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13 }}>
            <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Cost</div><b>{cost(p) ? money(cost(p)) : "—"}</b></div>
            <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Price</div><b>{price(p) ? money(price(p)) : "—"}</b></div>
            {oh != null && <div><div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>On hand</div><b>{num(oh)}</b></div>}
          </div>
        </Card>;
      })}
    </div>}
  </div>;
}

/* ── PM: preventive maintenance schedules (real /api/pm-schedules) ───────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PM() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch("/api/pm-schedules").then(r => r.json()).then(d => setItems(d.pm_schedules ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  if (loading) return <Card><Small>Loading schedules…</Small></Card>;
  if (items.length === 0) return <Card><Small>No preventive-maintenance schedules yet.</Small></Card>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 14 }}>
    {items.map(s => <Card key={s.id}>
      <b style={{ fontSize: 15 }}>{s.title || "Schedule"}</b>
      <div style={{ marginTop: 8, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
        {s.interval_days ? `Every ${s.interval_days} days` : "—"}
        {s.next_due_at && <div style={{ color: "rgba(255,255,255,0.5)" }}>Next due: {String(s.next_due_at).slice(0, 10)}</div>}
      </div>
      {s.description && <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, marginTop: 8 }}>{s.description}</p>}
    </Card>)}
  </div>;
}

/* ── Job drawer: detail + money + checklist + parts + team chat + complete ─ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function JobDetailDrawer({ id, techs, onClose, onUpdate }: { id: string; techs: RealTech[]; onClose: () => void; onUpdate: (id: string, patch: Record<string, unknown>) => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wo, setWo] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [parts, setParts] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [checklist, setChecklist] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [comments, setComments] = useState<any[]>([]);
  const [laborMins, setLaborMins] = useState(0);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState("");
  const [chat, setChat] = useState("");
  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/maintenance/${id}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/time`).then(r => r.json()).catch(() => ({})),
    ]).then(([d, t]) => {
      setWo(d.work_order ?? null); setParts(d.parts_used ?? []);
      setChecklist(d.checklist ?? []); setComments(d.comments ?? []);
      setLaborMins(t.totalMins ?? 0);
    }).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const partsCost = parts.reduce((s, p) => s + num(p.unit_cost) * num(p.qty), 0);
  const partsRev = parts.reduce((s, p) => s + num(p.unit_price) * num(p.qty), 0);
  const margin = partsRev - partsCost;
  const marginPct = partsRev > 0 ? Math.round((margin / partsRev) * 100) : 0;
  const doneCount = checklist.filter(c => c.is_complete || c.completed || c.done).length;
  const patchField = (p: Record<string, unknown>) => { onUpdate(id, p); setWo((w: typeof wo) => w ? { ...w, ...p } : w); };

  async function addChecklist() {
    const title = newItem.trim(); if (!title) return; setNewItem("");
    await fetch(`/api/maintenance/${id}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => {});
    load();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function toggleChecklist(item: any) {
    const next = !(item.is_complete || item.completed || item.done);
    await fetch(`/api/maintenance/${id}/checklist`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: item.id, is_complete: next }) }).catch(() => {});
    load();
  }
  async function addComment() {
    const content = chat.trim(); if (!content) return; setChat("");
    await fetch(`/api/maintenance/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }).catch(() => {});
    load();
  }

  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "flex-end" }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "min(580px,100%)", height: "100%", overflowY: "auto", background: "linear-gradient(180deg,#0c1530,#060b1a)", borderLeft: "1px solid rgba(0,200,255,0.22)", padding: 20, color: "white" }}>
      <button onClick={onClose} style={{ ...btn, background: "rgba(255,255,255,0.06)", marginBottom: 16 }}>✕ Close</button>
      {loading ? <Small>Loading…</Small> : !wo ? <Small>Couldn’t load this work order.</Small> : <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "rgba(0,200,255,0.8)", letterSpacing: "0.1em" }}>{wo.wo_number || "WORK ORDER"}</div>
          <h2 style={{ margin: "4px 0", fontSize: 22 }}>{wo.title || "Work order"}</h2>
          <Small>{wo.customer_name || wo.site_address || "—"}{wo.scheduled_date ? ` · ${String(wo.scheduled_date).slice(0, 10)}` : ""}</Small>
        </div>

        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Status</Small><select value={bucketOf(wo.status)} onChange={e => patchField({ status: COL_TO_DB[e.target.value] })} style={{ ...sel, width: "100%", marginTop: 4 }}>{JOB_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Assigned to</Small><select value={wo.assignee_id ?? ""} onChange={e => { const t = techs.find(x => x.id === e.target.value); patchField({ assignee_id: e.target.value || null, assignee_name: t?.name ?? null }); }} style={{ ...sel, width: "100%", marginTop: 4 }}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
        </Card>

        {/* Money / profitability (was WO Detail + Reporting) */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 15 }}>Money on this job</h2>
            {partsRev > 0 && <Badge tone="good">{marginPct}% margin</Badge>}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#00C8FF", margin: "6px 0" }}>{money(margin)} <span style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>margin</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <div><Small>Parts cost</Small><div style={{ fontSize: 16, fontWeight: 700 }}>{money(partsCost)}</div></div>
            <div><Small>Parts price</Small><div style={{ fontSize: 16, fontWeight: 700 }}>{money(partsRev)}</div></div>
            <div><Small>Labor logged</Small><div style={{ fontSize: 16, fontWeight: 700 }}>{Math.round((laborMins / 60) * 10) / 10} hrs</div></div>
          </div>
        </Card>

        {/* Checklist (was Procedures) */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15 }}>Checklist</h2>
            <Small>{doneCount}/{checklist.length} done</Small>
          </div>
          {checklist.map(c => {
            const done = c.is_complete || c.completed || c.done;
            return <label key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={!!done} onChange={() => toggleChecklist(c)} />
              <span style={{ textDecoration: done ? "line-through" : "none", color: done ? "rgba(255,255,255,0.45)" : "white", fontSize: 14 }}>{c.title || c.label}</span>
            </label>;
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input placeholder="Add a step…" value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addChecklist(); }} style={{ ...input, padding: 9 }} />
            <button onClick={addChecklist} style={btn}>Add</button>
          </div>
        </Card>

        {/* Parts used */}
        <Card>
          <h2 style={{ fontSize: 15 }}>Parts used</h2>
          {parts.length === 0 ? <Small>None yet.</Small> : parts.map((p, i) => <p key={p.id || i} style={{ margin: "6px 0" }}>{p.name || "Part"} × {num(p.qty)} <span style={{ color: "#34d399" }}>· {money((num(p.unit_price) - num(p.unit_cost)) * num(p.qty))} margin</span></p>)}
        </Card>

        {/* Team chat (was Messages) */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Team chat</h2>
          {comments.length === 0 ? <Small>No messages yet.</Small> : comments.map((c, i) => <p key={c.id || i} style={{ margin: "6px 0", fontSize: 14 }}><b>{c.author_name || c.created_by || "Team"}:</b> <span style={{ color: "rgba(255,255,255,0.82)" }}>{c.content || c.body}</span></p>)}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input placeholder="Write a message…" value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addComment(); }} style={{ ...input, padding: 9 }} />
            <button onClick={addComment} style={btn}>Send</button>
          </div>
        </Card>

        {wo.description && <Card><h2 style={{ fontSize: 15 }}>Notes</h2><p style={{ color: "rgba(255,255,255,0.8)", whiteSpace: "pre-wrap" }}>{wo.description}</p></Card>}

        {bucketOf(wo.status) !== "Done" && <button onClick={() => patchField({ status: "completed" })} style={{ ...btn, background: "#10b981", padding: 14, fontSize: 15 }}>✓ Complete Work Order</button>}
      </div>}
    </div>
  </div>;
}
