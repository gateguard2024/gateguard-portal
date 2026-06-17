'use client';

import React, { useState, useEffect } from "react";
type Status = "New" | "Approved" | "In Progress" | "Waiting Parts" | "Complete";
type Priority = "Low" | "Medium" | "High" | "Urgent";
// Real work-order + tech shapes from /api/dispatch (existing data — no new tables).
type RealWO = { id: string; property?: string; jobType?: string; assignedTech?: string | null; assignedTechId?: string | null; eta?: string; priority: Priority; status: string; woNumber?: string | null; title?: string | null; site_id?: string | null };
type RealTech = { id: string; name: string; initials?: string; status?: string };
const brand = "#6B7EFF";
const cyan = "#00C8FF";
const products = [
  { id: "p1", sku: "CAM-EE-4MP", name: "Eagle Eye 4MP Camera", brand: "Eagle Eye", category: "Camera", dealer_cost: 180, sell_price: 325, stock: 12, low: 5 },
  { id: "p2", sku: "BRV-CTRL-2D", name: "Brivo 2-Door Controller", brand: "Brivo", category: "Access Control", dealer_cost: 410, sell_price: 725, stock: 3, low: 4 },
  { id: "p3", sku: "SPK-TALK", name: "Talk-Down Speaker", brand: "GateGuard", category: "Audio", dealer_cost: 75, sell_price: 165, stock: 9, low: 3 },
];
const sites = [
  { id: "s1", name: "The Stratford", city: "Sandy Springs, GA", revenue: 47800, cost: 18400 },
  { id: "s2", name: "Raleigh Exchange", city: "Raleigh, NC", revenue: 31200, cost: 12600 },
  { id: "s3", name: "Sirona Apartments", city: "Atlanta, GA", revenue: 15900, cost: 7200 },
];
const technicians = [
  { id: "t1", name: "Mike Jones", cost_rate: 38, bill_rate: 95 },
  { id: "t2", name: "Sarah Tech", cost_rate: 42, bill_rate: 110 },
];
const assets = [
  { id: "a1", site_id: "s1", product_id: "p1", serial: "EE-22892", mac: "AA:11:22", ip: "10.0.1.12", firmware: "5.4.2", location_zone: "Front Gate", status: "Online", last_seen_at: "Today 8:21 AM", work_order_id: "wo1" },
  { id: "a2", site_id: "s1", product_id: "p2", serial: "BR-9921", mac: "BB:33:44", ip: "10.0.1.20", firmware: "3.2.1", location_zone: "Pool Door", status: "Online", last_seen_at: "Today 7:44 AM", work_order_id: "wo2" },
  { id: "a3", site_id: "s2", product_id: "p3", serial: "GG-7712", mac: "CC:55:66", ip: "10.0.2.10", firmware: "1.0.8", location_zone: "Dumpster", status: "Offline", last_seen_at: "Yesterday 5:11 PM", work_order_id: "wo3" },
];
const workOrders = [
  { id: "wo1", wo_number: "WO-10382", site_id: "s1", asset_id: "a1", assigned_to: "t1", priority: "High" as Priority, status: "In Progress" as Status, due_date: "2026-06-20", completed_at: null },
  { id: "wo2", wo_number: "WO-10383", site_id: "s1", asset_id: "a2", assigned_to: "t2", priority: "Medium" as Priority, status: "Waiting Parts" as Status, due_date: "2026-06-18", completed_at: null },
  { id: "wo3", wo_number: "WO-10384", site_id: "s2", asset_id: "a3", assigned_to: "t1", priority: "Urgent" as Priority, status: "New" as Status, due_date: "2026-06-15", completed_at: null },
];
type WorkOrder = (typeof workOrders)[number];
const woParts = [
  { wo_id: "wo1", product_id: "p1", qty: 1, unit_cost: 180, unit_price: 325, billable: true },
  { wo_id: "wo1", product_id: "p3", qty: 2, unit_cost: 75, unit_price: 165, billable: true },
];
const woLabor = [
  { wo_id: "wo1", technician_id: "t1", hours: 3, cost_rate: 38, bill_rate: 95, billable: true },
  { wo_id: "wo2", technician_id: "t2", hours: 1.5, cost_rate: 42, bill_rate: 110, billable: true },
];
const requests = [
  { id: "r1", site_id: "s1", name: "Pool gate not opening", submitted_by: "Property Manager", priority: "High" },
  { id: "r2", site_id: "s2", name: "Dumpster camera offline", submitted_by: "Resident QR Form", priority: "Medium" },
];
const pmSchedules = [
  { id: "pm1", site_id: "s1", name: "Monthly Camera Health Check", interval_days: 30, next_due_at: "2026-06-21" },
  { id: "pm2", site_id: "s2", name: "Gate Access Control Inspection", interval_days: 60, next_due_at: "2026-06-25" },
];
const procedures = [
  { id: "pr1", name: "Camera Health Check", steps: ["Verify online status", "Clean lens", "Check view angle", "Confirm recording"] },
  { id: "pr2", name: "Access Control Test", steps: ["Test reader", "Test mobile pass", "Check door strike", "Confirm event log"] },
];
// One simple, canonical 4-stage status set for Jobs/Work Orders (5th-grader clear).
// Every underlying status maps into exactly one of these buckets.
const JOB_COLUMNS: { key: string; label: string; from: string[]; accent: string }[] = [
  { key: "New",         label: "New",          from: ["Pending", "open", "New", "Approved"],                  accent: "#64748b" },
  { key: "Scheduled",   label: "Scheduled",    from: ["Assigned", "scheduled", "Scheduled"],                  accent: "#3b82f6" },
  { key: "In Progress", label: "In Progress",  from: ["In Progress", "in_progress", "On Site", "En Route", "Waiting Parts"], accent: "#f59e0b" },
  { key: "Done",        label: "Done",         from: ["Done", "completed", "Complete"],                       accent: "#10b981" },
];
const bucketOf = (status: string) => JOB_COLUMNS.find(c => c.from.includes(status))?.key ?? "New";

function money(n: number) {
  return `$${n.toLocaleString()}`;
}
function marginForWO(woId: string) {
  const parts = woParts.filter(p => p.wo_id === woId);
  const labor = woLabor.filter(l => l.wo_id === woId);
  const partsCost = parts.reduce((s, p) => s + p.qty * p.unit_cost, 0);
  const partsRevenue = parts.reduce((s, p) => s + p.qty * p.unit_price, 0);
  const laborCost = labor.reduce((s, l) => s + l.hours * l.cost_rate, 0);
  const laborRevenue = labor.reduce((s, l) => s + l.hours * l.bill_rate, 0);
  const cost = partsCost + laborCost;
  const revenue = partsRevenue + laborRevenue;
  const margin = revenue - cost;
  const marginPct = revenue ? Math.round((margin / revenue) * 100) : 0;
  return { partsCost, partsRevenue, laborCost, laborRevenue, cost, revenue, margin, marginPct };
}
function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  const bg =
    tone === "urgent" ? "rgba(255,80,80,.18)" :
    tone === "high" ? "rgba(255,170,0,.18)" :
    tone === "good" ? "rgba(0,200,255,.16)" :
    "rgba(255,255,255,.08)";
  return <span style={{ padding: "7px 10px", borderRadius: 999, background: bg, border: "1px solid rgba(255,255,255,.1)", fontSize: 12 }}>{children}</span>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18, padding: 18 }}>{children}</div>;
}
function App() {
  const pages = ["Dashboard", "Work Orders", "WO Detail", "Requests", "Assets", "Locations", "PM", "Procedures", "Parts", "Reporting", "Messages"];
  const [page, setPage] = useState("Dashboard");
  // Real Work Orders + Dispatch (from /api/dispatch). Other pages still mock for now.
  const [jobs, setJobs] = useState<RealWO[]>([]);
  const [techs, setTechs] = useState<RealTech[]>([]);
  const [loading, setLoading] = useState(true);
  const loadOps = React.useCallback(() => {
    setLoading(true);
    fetch('/api/dispatch').then(r => r.json()).then(d => { setJobs(d.jobs ?? []); setTechs(d.techs ?? []); }).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadOps(); }, [loadOps]);
  const selectedWO = workOrders[0];
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, #1c2455, #050712 45%)", color: "white", fontFamily: "Inter, Arial, sans-serif", padding: 24 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        {pages.map(p => (
          <button key={p} onClick={() => setPage(p)} style={{ padding: "12px 16px", borderRadius: 14, border: `1px solid ${page === p ? cyan : "rgba(255,255,255,.1)"}`, background: page === p ? "rgba(0,200,255,.16)" : "rgba(255,255,255,.04)", color: "white", cursor: "pointer" }}>
            {p}
          </button>
        ))}
      </div>
      <h1 style={{ marginBottom: 8 }}>GateGuard CMMS</h1>
      <p style={{ color: "#aab", marginBottom: 24 }}>MaintainX-style maintenance layered on Nexus data.</p>
      {page === "Dashboard" && <Dashboard jobs={jobs} loading={loading} />}
      {page === "Work Orders" && <WorkOrders jobs={jobs} techs={techs} loading={loading} onRefresh={loadOps} />}
      {page === "WO Detail" && <WODetail wo={selectedWO} />}
      {page === "Requests" && <Requests />}
      {page === "Assets" && <Assets />}
      {page === "Locations" && <Locations />}
      {page === "PM" && <PM />}
      {page === "Procedures" && <Procedures />}
      {page === "Parts" && <Parts />}
      {page === "Reporting" && <Reporting />}
      {page === "Messages" && <Messages />}
    </div>
  );
}
function Dashboard({ jobs, loading }: { jobs: RealWO[]; loading: boolean }) {
  // KPI cards mirror the 4 board columns so the numbers and the board always agree.
  return <Grid>
    {JOB_COLUMNS.map(col => (
      <Card key={col.key}><Small>{col.label}</Small><Big>{loading ? '…' : String(jobs.filter(j => bucketOf(j.status) === col.key).length)}</Big></Card>
    ))}
    <WorkOrderBoard jobs={jobs} />
  </Grid>;
}
function WorkOrders({ jobs, loading, onRefresh }: { jobs: RealWO[]; techs: RealTech[]; loading: boolean; onRefresh: () => void }) {
  return <Grid>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2>Work Orders</h2><button onClick={onRefresh} style={{ ...btn, marginTop: 0, padding: "8px 12px" }}>↻ Refresh</button></div>
      {loading ? <p style={{ color: "#aab" }}>Loading…</p> : jobs.length === 0 ? <p style={{ color: "#aab" }}>No work orders yet.</p> : jobs.map(wo => <WOCard key={wo.id} wo={wo} />)}
    </Card>
    <WorkOrderBoard jobs={jobs} />
    <Card><h2>Schedule</h2>{jobs.length === 0 ? <p style={{ color: "#aab" }}>Nothing scheduled.</p> : jobs.map(wo => <p key={wo.id}>{wo.eta || 'TBD'} — {wo.woNumber || wo.title || 'WO'}</p>)}</Card>
  </Grid>;
}
function WODetail({ wo }: { wo: WorkOrder }) {
  const site = sites.find(s => s.id === wo.site_id);
  const asset = assets.find(a => a.id === wo.asset_id);
  const m = marginForWO(wo.id);
  return <Grid>
    <Card>
      <h2>{wo.wo_number}</h2>
      <p>{site?.name} / {asset?.location_zone}</p>
      <Badge tone="high">{wo.priority}</Badge> <Badge tone="good">{wo.status}</Badge>
    </Card>
    <Card>
      <h2>Live Profitability</h2>
      <p>Parts Cost: {money(m.partsCost)} | Parts Revenue: {money(m.partsRevenue)}</p>
      <p>Labor Cost: {money(m.laborCost)} | Labor Revenue: {money(m.laborRevenue)}</p>
      <Big>{money(m.margin)} Margin</Big>
      <Badge tone="good">{m.marginPct}%</Badge>
    </Card>
    <Card>
      <h2>Checklist</h2>
      {procedures[0].steps.map(s => <label key={s} style={{ display: "block", margin: "12px 0" }}><input type="checkbox" /> {s}</label>)}
    </Card>
    <Card>
      <h2>Parts Used</h2>
      {woParts.filter(p => p.wo_id === wo.id).map(p => {
        const prod = products.find(x => x.id === p.product_id);
        return <p key={p.product_id}>{prod?.name} × {p.qty} — Margin {money((p.unit_price - p.unit_cost) * p.qty)}</p>;
      })}
      <button style={btn}>+ Add Part</button>
    </Card>
    <Card>
      <h2>Labor</h2>
      {woLabor.filter(l => l.wo_id === wo.id).map(l => {
        const tech = technicians.find(t => t.id === l.technician_id);
        return <p key={l.technician_id}>{tech?.name}: {l.hours} hrs — Margin {money((l.bill_rate - l.cost_rate) * l.hours)}</p>;
      })}
      <button style={btn}>+ Log Labor</button>
    </Card>
    <Card>
      <h2>Complete Gate</h2>
      <p>Checklist complete, photos attached, parts/labor reviewed.</p>
      <button style={btn}>Complete Work Order</button>
    </Card>
  </Grid>;
}
function Requests() {
  return <Grid>
    <Card><h2>Incoming Requests</h2>{requests.map(r => <p key={r.id}><b>{r.name}</b><br />{r.submitted_by} <br /><button style={btn}>Convert to WO</button></p>)}</Card>
    <Card><h2>Public QR Request Form</h2><input placeholder="Name" style={input} /><input placeholder="Issue" style={input} /><button style={btn}>Submit Request</button></Card>
  </Grid>;
}
function Assets() {
  return <Grid>{assets.map(a => {
    const site = sites.find(s => s.id === a.site_id);
    const prod = products.find(p => p.id === a.product_id);
    return <Card key={a.id}><h2>{prod?.name}</h2><p>{site?.name}</p><p>Serial: {a.serial}</p><p>MAC/IP: {a.mac} / {a.ip}</p><p>Status: {a.status}</p><p>Last Seen: {a.last_seen_at}</p><button style={btn}>View Service History</button></Card>;
  })}</Grid>;
}
function Locations() {
  return <Grid>{sites.map(s => {
    const margin = s.revenue - s.cost;
    return <Card key={s.id}><h2>{s.name}</h2><p>{s.city}</p><p>Assets: {assets.filter(a => a.site_id === s.id).length}</p><p>Open WOs: {workOrders.filter(w => w.site_id === s.id && w.status !== "Complete").length}</p><Big>{money(margin)}</Big><Small>Lifetime Margin</Small></Card>;
  })}</Grid>;
}
function PM() {
  return <Grid>{pmSchedules.map(pm => <Card key={pm.id}><h2>{pm.name}</h2><p>Every {pm.interval_days} days</p><p>Next due: {pm.next_due_at}</p><button style={btn}>Generate Now</button></Card>)}</Grid>;
}
function Procedures() {
  return <Grid>{procedures.map(p => <Card key={p.id}><h2>{p.name}</h2>{p.steps.map(s => <p key={s}>✓ {s}</p>)}<button style={btn}>Attach to WO</button></Card>)}</Grid>;
}
function Parts() {
  return <Grid>{products.map(p => <Card key={p.id}><h2>{p.name}</h2><p>{p.sku}</p><p>Cost: {money(p.dealer_cost)} | Price: {money(p.sell_price)}</p><p>On Hand: {p.stock}</p>{p.stock <= p.low && <Badge tone="urgent">Low Stock</Badge>}<br /><br /><button style={btn}>Adjust Stock</button></Card>)}</Grid>;
}
function Reporting() {
  const rows = workOrders.map(w => ({ ...w, ...marginForWO(w.id) }));
  return <Grid>{rows.map(r => <Card key={r.id}><h2>{r.wo_number}</h2><p>Revenue: {money(r.revenue)}</p><p>Cost: {money(r.cost)}</p><Big>{money(r.margin)}</Big><Small>{r.marginPct}% margin</Small></Card>)}</Grid>;
}
function Messages() {
  return <Grid><Card><h2>WO Team Chat</h2><p><b>Mike:</b> Camera replaced and view angle corrected.</p><p><b>Sarah:</b> Need Brivo controller from stock.</p><input placeholder="Write a comment..." style={input} /><button style={btn}>Send</button></Card></Grid>;
}
function WorkOrderBoard({ jobs }: { jobs: RealWO[] }) {
  // Always the same 4 columns, in order — New → Scheduled → In Progress → Done.
  return <Card><h2 style={{ marginBottom: 12 }}>Jobs board</h2>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
      {JOB_COLUMNS.map(col => {
        const items = jobs.filter(w => bucketOf(w.status) === col.key);
        return <div key={col.key}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 12, background: `${col.accent}22`, border: `1px solid ${col.accent}55`, marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{col.label}</span>
            <span style={{ fontSize: 12, color: "#aab" }}>{items.length}</span>
          </div>
          {items.map(w => <WOCard key={w.id} wo={w} />)}
          {items.length === 0 && <p style={{ color: "#556", fontSize: 12, textAlign: "center", padding: "8px 0" }}>—</p>}
        </div>;
      })}
    </div>
  </Card>;
}
function WOCard({ wo }: { wo: RealWO }) {
  return <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", marginBottom: 10 }}>
    <b>{wo.woNumber || wo.title || "Work Order"}</b>
    <p style={{ color: "#aab", fontSize: 13, margin: "4px 0" }}>{wo.property || "—"}{wo.assignedTech ? ` · ${wo.assignedTech}` : " · Unassigned"}</p>
    <Badge tone={wo.priority === "Urgent" ? "urgent" : wo.priority === "High" ? "high" : "default"}>{wo.priority}</Badge>
  </div>;
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>{children}</div>;
}
function Small({ children }: { children: React.ReactNode }) {
  return <div style={{ color: "#aab", fontSize: 13 }}>{children}</div>;
}
function Big({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 34, fontWeight: 800, color: cyan, margin: "8px 0" }}>{children}</div>;
}
const btn: React.CSSProperties = {
  background: brand,
  color: "white",
  border: 0,
  borderRadius: 12,
  padding: "12px 16px",
  cursor: "pointer",
  marginTop: 8,
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,.05)",
  border: "1px solid rgba(255,255,255,.12)",
  color: "white",
  borderRadius: 12,
  padding: 14,
  marginBottom: 12,
};
export default App;
