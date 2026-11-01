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
import { useUser } from "@clerk/nextjs";
// Clean line icons (replaces legacy emoji for a calmer, on-brand look).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Printer, X, Truck, MapPin, CheckCircle2, Star, FileText, Mail, RotateCcw, Key, Lock, Bot, RefreshCw } = require("lucide-react") as any;
import { siteActivation, SITE_STATUS_LABELS, SITE_STATUS_COLORS } from "@/lib/site-lifecycle";
import { ActivityTimeline } from "@/components/nexus/ActivityTimeline";
import { SiteSystems } from "@/components/nexus/SiteSystems";
import CalendarViews from "@/components/nexus/CalendarViews";

type RealWO = { id: string; property?: string; assignedTech?: string | null; assignedTechId?: string | null; eta?: string; priority: string; status: string; woNumber?: string | null; title?: string | null; rawStatus?: string | null; rawPriority?: string | null; createdAt?: string | null; dueDate?: string | null };
type RealTech = { id: string; name: string };

const JOB_COLUMNS: { key: string; label: string; from: string[]; accent: string }[] = [
  { key: "New",         label: "New",         from: ["Pending", "open", "New", "Approved"],                          accent: "#64748b" },
  { key: "Procurement", label: "Procurement", from: ["procurement", "Procurement", "Waiting Parts", "Ordered"],      accent: "#0071E3" },
  { key: "Scheduled",   label: "Scheduled",   from: ["Assigned", "scheduled", "Scheduled"],                          accent: "#3b82f6" },
  { key: "In Progress", label: "In-Progress", from: ["In Progress", "in_progress", "On Site", "En Route"],           accent: "#B25000" },
  { key: "Stuck",       label: "Stuck",       from: ["stuck", "Stuck", "blocked", "Blocked", "On Hold"],             accent: "#ef4444" },
  { key: "Done",        label: "Complete",    from: ["Done", "completed", "Complete"],                               accent: "#10b981" },
];
const bucketOf = (s: string) => { const v = String(s ?? "").toLowerCase().trim(); return JOB_COLUMNS.find(c => c.from.some(f => f.toLowerCase() === v))?.key ?? "New"; };
const COL_TO_DB: Record<string, string> = { New: "open", Procurement: "procurement", Scheduled: "scheduled", "In Progress": "in_progress", Stuck: "stuck", Done: "completed" };
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

// Steps on a job are grouped into phases (a row in work_order_phases). These are
// the phases the install crews actually run, offered as one-tap presets so nobody
// has to type them. Any other phase name can still be typed by hand.
const PRESET_PHASES = ["Wiring", "Trim", "Headend", "Program"];
// Bucket key for steps with phase_id = null — they still show, never disappear.
const PHASE_OTHER = "__other";

// ── Light look tokens — same as the Operations / Sales pages (white cards on
// the navy-to-light fade, one blue accent, Apple system fonts).
const INK = "#1D1D1F", INK2 = "#3A3A3C", INK3 = "#6E6E73", LINE = "rgba(0,0,0,0.08)", BLUE = "#0071E3";
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
const card = { background: "#FFFFFF", borderRadius: 14, padding: 18, boxShadow: "0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)" } as const;
const btn = { background: BLUE, color: "white", border: 0, borderRadius: 10, padding: "9px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" } as const;
// Secondary button (white with a hairline) — for every non-primary action.
const btn2 = { ...btn, background: "#FFFFFF", color: INK, border: "1px solid rgba(0,0,0,0.12)" } as const;
const input = { width: "100%", boxSizing: "border-box" as const, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.14)", color: INK, borderRadius: 8, padding: "9px 10px", fontSize: 14, fontFamily: "inherit" };
const sel = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.14)", color: INK, borderRadius: 8, padding: "6px 8px", fontSize: 12.5, fontFamily: "inherit" } as const;
const Small = ({ children }: { children: React.ReactNode }) => <div style={{ color: INK3, fontSize: 13 }}>{children}</div>;
const Big = ({ children, color }: { children: React.ReactNode; color?: string }) => <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: color ?? INK, margin: "4px 0 0" }}>{children}</div>;
const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => <div style={{ ...card, ...style }}>{children}</div>;
function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  const t = tone === "urgent" ? { background: "#FFECEC", color: "#D70015" } : tone === "high" ? { background: "#FFF4E5", color: "#B25000" } : tone === "good" ? { background: "#E8F6EC", color: "#1A7F37" } : { background: "#F5F5F7", color: INK2 };
  return <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", ...t }}>{children}</span>;
}
const num = (v: unknown) => Number(v) || 0;

/* ── Parts & procurement ──────────────────────────────────────────────────
 * Where a part is, in the words a tech would actually use. The DB stores
 * `supply_status` as a short code; nobody should ever read "at_office".     */
const SUPPLY_ORDER = ["not_ordered", "ordered", "shipped", "at_office", "on_truck", "installed"] as const;
const SUPPLY_LABEL: Record<string, string> = {
  not_ordered: "Not ordered",
  ordered:     "Ordered",
  shipped:     "Shipped",
  at_office:   "At the office",
  on_truck:    "On the truck",
  installed:   "Installed",
};
// Red = nobody has ordered it. Amber = ordered, but not here yet. Green = here.
const SUPPLY_COLOR: Record<string, string> = {
  not_ordered: "#D70015",
  ordered:     "#B25000",
  shipped:     "#B25000",
  at_office:   "#248A3D",
  on_truck:    "#248A3D",
  installed:   "#248A3D",
};
// Plain phrases for the summary line ("2 not ordered yet, 1 shipped").
const SUPPLY_PENDING_PHRASE: Record<string, string> = {
  not_ordered: "not ordered yet",
  ordered:     "ordered",
  shipped:     "shipped",
};
// A purchase order's own status, again in plain words.
const PO_STATUS_LABEL: Record<string, string> = {
  draft:     "Not sent yet",
  sent:      "Sent to supplier",
  ordered:   "Ordered",
  confirmed: "Confirmed",
  partial:   "Some arrived",
  received:  "All arrived",
  closed:    "Closed",
  cancelled: "Cancelled",
};
const PO_STATUS_TONE: Record<string, string> = {
  draft: "default", sent: "high", ordered: "high", confirmed: "high",
  partial: "high", received: "good", closed: "good", cancelled: "urgent",
};
const supplyOf    = (v: unknown) => (typeof v === "string" && SUPPLY_LABEL[v] ? v : "not_ordered");
const supplyHere  = (v: unknown) => { const s = supplyOf(v); return s === "at_office" || s === "on_truck" || s === "installed"; };
// "2026-03-03" → "Mar 3". Parsed by hand so a date-only string never shifts a
// day from timezone math.
const dayLabel = (d: unknown) => {
  const s = String(d ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(y, m - 1, dd).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Open a clean, printer-friendly work order in a new tab and trigger print.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function printWorkOrder(wo: any, equip: any[]) {
  const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  const rows = (equip || []).map((a: any) => `<tr><td>${esc(a.product_name || a.name || "Equipment")}</td><td>${esc(a.serial_number || "")}</td><td>${esc(a.location_note || "")}</td></tr>`).join(""); // eslint-disable-line @typescript-eslint/no-explicit-any
  const addr = [wo.site_address, wo.site_city, wo.site_state, wo.site_zip].filter(Boolean).map(esc).join(", ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(wo.wo_number || "Work Order")}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:32px;max-width:760px;margin:0 auto}
    h1{margin:0 0 2px;font-size:24px}h2{font-size:15px;border-bottom:2px solid #111;padding-bottom:4px;margin-bottom:6px}
    .muted{color:#555}.sec{margin-top:20px}.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#666}
    .grid{display:flex;gap:32px;flex-wrap:wrap}table{width:100%;border-collapse:collapse;margin-top:6px}
    td,th{border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:13px}
  </style></head><body>
    <h1>Work Order ${esc(wo.wo_number || "")}</h1>
    <div class="muted">${esc(wo.title || "")}</div>
    <div class="sec"><span class="label">Site</span><div style="font-weight:600">${esc(wo.customer_name || "—")}</div><div class="muted">${addr}</div></div>
    <div class="sec grid">
      <div><span class="label">Status</span><div>${esc(wo.status || "")}</div></div>
      <div><span class="label">Priority</span><div>${esc(wo.priority || "")}</div></div>
      <div><span class="label">Assigned to</span><div>${esc(wo.assignee_name || "Unassigned")}</div></div>
      <div><span class="label">Scheduled</span><div>${esc(String(wo.scheduled_date || "").slice(0, 10) || "—")}</div></div>
    </div>
    <div class="sec"><h2>Work to perform</h2><div style="white-space:pre-wrap">${esc(wo.description || wo.notes || "—")}</div></div>
    <div class="sec"><h2>Equipment on site</h2>${rows ? `<table><tr><th>Equipment</th><th>Serial</th><th>Location</th></tr>${rows}</table>` : '<div class="muted">None recorded.</div>'}</div>
    <div class="sec"><span class="label">On-site contact</span><div>${esc(wo.site_contact_name || "—")}${wo.site_contact_phone ? " · " + esc(wo.site_contact_phone) : ""}</div></div>
    ${wo.site_access_notes ? `<div class="sec"><span class="label">Access / gate notes</span><div>${esc(wo.site_access_notes)}</div></div>` : ""}
    <div class="sec" style="margin-top:36px;border-top:1px solid #ccc;padding-top:8px"><span class="label">Tech signature</span><div style="height:48px"></div></div>
    <div class="muted" style="font-size:11px;margin-top:12px">GateGuard · printed ${new Date().toLocaleString()}</div>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => w.print(), 350);
}

// Simple centered popup for data entry — keeps forms out of the page flow so
// each task is a clear, focused step (easy enough for a 5th grader).
function Modal({ title, onClose, children, maxWidth = 460 }: { title: string; onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.42)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ width: `min(${maxWidth}px, 100%)`, maxHeight: "88vh", overflowY: "auto", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch", background: "#FFFFFF", borderRadius: 16, padding: 20, paddingBottom: "calc(96px + env(safe-area-inset-bottom))", color: INK, fontFamily: FONT, letterSpacing: "-0.01em", boxShadow: "0 24px 60px rgba(0,0,0,0.28)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
        <button onClick={onClose} aria-label="Close" style={{ background: "#F5F5F7", border: 0, color: INK3, borderRadius: 999, width: 32, height: 32, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>;
}
const TABS = ["Dashboard", "Work Orders", "Schedule", "Analytics", "Requests", "Locations", "Techs", "Parts", "Procurement", "PM", "Playbooks"] as const;
type Tab = typeof TABS[number];
const TAB_HINT: Record<Tab, string> = {
  Dashboard: "Snapshot + jobs board",
  "Work Orders": "Create, assign, track",
  Schedule: "What's scheduled — jobs, PMs & to-dos",
  Analytics: "Utilization + first-time-fix",
  Requests: "Incoming requests → turn into jobs",
  Locations: "Your sites — tap to edit details",
  Techs: "Add techs + set their app code",
  Parts: "Inventory + stock levels",
  Procurement: "Purchase orders to suppliers",
  PM: "Recurring maintenance",
  Playbooks: "Step-by-step templates to assign",
};

/* ── Status / priority helpers on the raw DB values ───────────────────────
 * /api/dispatch maps status + priority into old display words (and used to
 * squash "high" and "critical" into "urgent", so the Urgent filter never
 * matched). The hub reads the raw values when they're there. */
const stOf = (w: { status?: string; rawStatus?: string | null }) => String(w.rawStatus ?? w.status ?? "");
const prOf = (w: RealWO) => String(w.rawPriority ?? w.priority ?? "").toLowerCase();
const PRI_RANK: Record<string, number> = { critical: 0, urgent: 0, high: 1, medium: 2, normal: 2, scheduled: 3, low: 3 };
const prRank = (w: RealWO) => PRI_RANK[prOf(w)] ?? 2;
const isUrgent = (w: RealWO) => prRank(w) <= 1;
const prLabel = (w: RealWO) => { const p = prOf(w) || "normal"; return p === "scheduled" ? "Normal" : p[0].toUpperCase() + p.slice(1); };
const prDot = (w: RealWO) => prRank(w) === 0 ? "#FF3B30" : prRank(w) === 1 ? "#FF9F0A" : prRank(w) === 2 ? BLUE : "#8E8E93";
const isOpenWO = (w: RealWO) => bucketOf(stOf(w)) !== "Done";
const schedOf = (w: RealWO) => (w.eta && w.eta !== "TBD" ? String(w.eta).slice(0, 10) : null);
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const isOverdue = (w: RealWO) => { const s = schedOf(w); return isOpenWO(w) && !!s && s < todayKey(); };
const ageDays = (w: RealWO) => (w.createdAt ? Math.max(0, Math.floor((Date.now() - new Date(w.createdAt).getTime()) / 86400000)) : null);
const ageLabel = (n: number | null) => (n == null ? "—" : n === 0 ? "Today" : `${n}d`);
const woName = (w: RealWO) => w.woNumber || w.title || "Work order";

// Work-order list filters. "b:<column>" filters to one board column
// (set by tapping a count on the Dashboard).
const WO_FILTERS = [
  { key: "open", label: "Open" },
  { key: "unassigned", label: "Unassigned" },
  { key: "urgent", label: "Urgent" },
  { key: "overdue", label: "Overdue" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
];
const woMatches = (w: RealWO, f: string) => {
  if (f.startsWith("b:")) return bucketOf(stOf(w)) === f.slice(2);
  if (f === "open") return isOpenWO(w);
  if (f === "unassigned") return isOpenWO(w) && !w.assignedTechId;
  if (f === "urgent") return isOpenWO(w) && isUrgent(w);
  if (f === "overdue") return isOverdue(w);
  if (f === "done") return !isOpenWO(w);
  return true;
};

const OH_CSS = `
.oh *{box-sizing:border-box}
.oh h2{font-weight:600;letter-spacing:-.01em}
.oh button,.oh select,.oh input,.oh textarea{font-family:inherit}
.oh-hd{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px;margin:2px 0 16px}
.oh-back{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 2px;margin-bottom:2px;border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer}
.oh-hd h1{margin:0;color:#fff;font-size:30px;font-weight:600;letter-spacing:-.025em;line-height:1.15}
.oh-hd .sub{margin-top:4px;color:rgba(255,255,255,.66);font-size:14px}.oh-hd .sub b{color:#fff;font-weight:600}
.oh-acts{display:flex;gap:8px}
.oh-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;padding:0 16px;border-radius:10px;border:0;font:600 14px ${FONT};cursor:pointer;white-space:nowrap}
.oh-btn.pri{background:${BLUE};color:#fff}.oh-btn.pri:hover{background:#0058B0}
.oh-btn.dark{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font-weight:500}
.oh-btn.sm{height:32px;padding:0 12px;font-size:13px}
.oh-btn.line{background:#fff;border:1px solid rgba(0,0,0,.12);color:${INK}}
.oh-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:rgba(255,255,255,.12);overflow-x:auto;scrollbar-width:none;width:max-content;max-width:100%}
.oh-tabs::-webkit-scrollbar{display:none}
.oh-tabs button{flex:none;min-height:34px;display:inline-flex;align-items:center;gap:6px;padding:0 12px;border-radius:9px;border:0;background:none;font:500 13px ${FONT};color:#C9D2E0;cursor:pointer;white-space:nowrap}
.oh-tabs button:hover{color:#fff}
.oh-tabs button[aria-selected=true]{background:#fff;color:${INK};font-weight:600}
.oh-tabs b{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:rgba(255,255,255,.18);color:#fff;font-size:11px;font-weight:600}
.oh-tabs button[aria-selected=true] b{background:#EEF4FF;color:#0058B0}
.oh-tabs b.red,.oh-tabs button[aria-selected=true] b.red{background:#FF3B30;color:#fff}
.oh-hint{margin:10px 2px 16px;color:rgba(255,255,255,.66);font-size:13px}
.oh-toast{position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:300;display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);padding:10px 14px;border-radius:10px;background:#1D1D1F;color:#fff;font:500 13px ${FONT};box-shadow:0 10px 30px rgba(0,0,0,.3)}
.oh-toast button{border:0;background:none;color:#4AA3FF;font:600 13px ${FONT};cursor:pointer}
.oh-sec{font-size:15px;font-weight:600;margin:0}
.oh-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.oh-stat{display:block;width:100%;text-align:left;border:0;cursor:pointer;font:inherit;color:inherit}
.oh-stat:hover{transform:translateY(-1px)}
.oh-stat .l{font-size:12px;font-weight:500;color:${INK3};display:flex;align-items:center;gap:6px}
.oh-stat .v{font-size:26px;font-weight:600;letter-spacing:-.02em;margin-top:2px;line-height:1.15}
.oh-stat .s{font-size:12px;color:${INK3};margin-top:1px}
.oh-dot{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
.oh-chips{display:flex;flex-wrap:wrap;gap:6px}
.oh-chip{display:inline-flex;align-items:center;gap:6px;min-height:32px;padding:0 12px;border-radius:999px;border:1px solid rgba(0,0,0,.12);background:#fff;font:500 13px ${FONT};color:${INK2};cursor:pointer}
.oh-chip[aria-pressed=true]{background:${INK};border-color:${INK};color:#fff}
.oh-chip b{font-weight:600}
.oh-search{flex:1;min-width:200px;height:36px;padding:0 12px;border:1px solid rgba(0,0,0,.14);border-radius:10px;font:400 14px ${FONT};color:${INK};background:#fff}
.oh-search:focus,.oh select:focus,.oh input:focus{outline:2px solid ${BLUE};outline-offset:-1px;border-color:transparent}
.oh-bulk{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-radius:10px;background:#EEF4FF;color:#0058B0;font-size:13px;font-weight:500}
.oh-tbl{width:100%;border-collapse:collapse;font-size:14px}
.oh-tbl th{position:sticky;top:0;background:#fff;z-index:1;font-size:12px;font-weight:500;color:${INK3};text-align:left;padding:8px 10px;border-bottom:1px solid ${LINE};white-space:nowrap}
.oh-tbl th button{border:0;background:none;font:inherit;color:inherit;cursor:pointer;padding:0}
.oh-tbl th button[aria-pressed=true]{color:${INK};font-weight:600}
.oh-tbl td{padding:8px 10px;border-bottom:1px solid ${LINE};vertical-align:middle}
.oh-tbl tbody tr{cursor:pointer}
.oh-tbl tbody tr:hover td{background:#F7F8FA}
.oh-tbl tbody tr.sel td{background:#EEF4FF}
.oh-tbl td.num{font-variant-numeric:tabular-nums;white-space:nowrap}
.oh-tbl .t{font-weight:500}.oh-tbl .m{font-size:12.5px;color:${INK3}}
.oh-late{color:#D70015;font-weight:600}
.oh-cards{display:none}
@media (max-width:820px){.oh-tblwrap{display:none}.oh-cards{display:grid;gap:8px}}
.oh-card{padding:12px;border-radius:12px;background:#F5F5F7}
.oh-col{background:#EEF1F5;border-radius:12px;padding:8px;min-width:0;min-height:96px;transition:background .12s}
.oh-col.over{background:#DCE8F8;outline:2px dashed ${BLUE};outline-offset:-2px}
.oh-colh{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:4px 6px 8px;font-size:13px;font-weight:600}
.oh-colh span{color:${INK3};font-weight:500}
.oh-bcard{display:block;width:100%;text-align:left;background:#fff;border:1px solid rgba(0,0,0,.04);border-radius:10px;padding:10px 11px;margin-bottom:8px;box-shadow:0 1px 2px rgba(0,0,0,.06);font:inherit;color:inherit}
.oh-bcard:hover{box-shadow:0 1px 2px rgba(0,0,0,.06),0 6px 16px -8px rgba(0,0,0,.25)}
.oh-bcard .t{font-size:13.5px;font-weight:600}.oh-bcard .m{font-size:12px;color:${INK3};margin-top:2px}
.oh-board{display:grid;grid-template-columns:repeat(5,minmax(200px,1fr));gap:10px;overflow-x:auto;padding-bottom:4px}
@media (max-width:640px){.oh-hd h1{font-size:24px}.oh-acts{width:100%}.oh-acts .oh-btn{flex:1;padding:0 8px}}
`;

export function OperationsHub({ embedded, initialTab, onBack }: { embedded?: boolean; initialTab?: string; onBack?: () => void } = {}) {
  void embedded;
  const [page, setPage] = useState<Tab>(initialTab && (TABS as readonly string[]).includes(initialTab) ? initialTab as Tab : "Dashboard");
  const [jobs, setJobs] = useState<RealWO[]>([]);
  const [techs, setTechs] = useState<RealTech[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [woFilter, setWoFilter] = useState("open");
  const [newOpen, setNewOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reqCount, setReqCount] = useState(0);
  const [pmOverdue, setPmOverdue] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadOps = React.useCallback(() => {
    setLoading(true);
    fetch("/api/dispatch").then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setLoadError(d?.error || `Couldn’t load work orders (${r.status}).`); return; }
      setLoadError(null); setJobs(d.jobs ?? []); setTechs(d.techs ?? []);
    }).catch(() => setLoadError("Couldn’t load work orders — check your connection.")).finally(() => setLoading(false));
  }, []);
  // Tab badges: open requests + overdue maintenance (reads only).
  const loadCounts = React.useCallback(() => {
    fetch("/api/requests").then(r => r.ok ? r.json() : null).then(d => setReqCount((d?.requests ?? []).length)).catch(() => {});
    fetch("/api/pm-schedules").then(r => r.ok ? r.json() : null).then(d => {
      const t = todayKey();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPmOverdue((d?.pm_schedules ?? []).filter((s: any) => s.next_due_at && String(s.next_due_at).slice(0, 10) < t).length);
    }).catch(() => {});
  }, []);
  useEffect(() => { loadOps(); loadCounts(); }, [loadOps, loadCounts]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);
  // Creating a work order must never fail silently. This used to be
  // `.catch(() => {})`, so a rejected insert looked EXACTLY like a successful
  // one — nothing appeared, nothing was said. Return the error so the caller
  // can show it.
  const [woError, setWoError] = useState<string | null>(null);
  const createWO = async (p: Record<string, unknown>): Promise<boolean> => {
    setWoError(null);
    try {
      const r = await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setWoError(d?.error || `Could not create the work order (${r.status}).`);
        console.error("[createWO] failed:", d?.error || r.status, p);
        return false;
      }
      loadOps();
      return true;
    } catch (e) {
      const m = e instanceof Error ? e.message : "Could not create the work order.";
      setWoError(m);
      console.error("[createWO] threw:", m);
      return false;
    }
  };
  // One PATCH; says so if it fails (this used to swallow errors, so a change
  // that didn't save just snapped back on refresh with no explanation).
  const patchOne = async (id: string, patch: Record<string, unknown>): Promise<boolean> => {
    try {
      const r = await fetch(`/api/maintenance/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      return r.ok;
    } catch { return false; }
  };
  const updateWO = async (id: string, patch: Record<string, unknown>) => {
    const ok = await patchOne(id, patch);
    if (!ok) setToast("That change didn’t save. Try again.");
    loadOps();
  };
  const bulkUpdate = async (ids: string[], patch: Record<string, unknown>) => {
    const results = await Promise.all(ids.map(id => patchOne(id, patch)));
    const failed = results.filter(r => !r).length;
    setToast(failed ? `${ids.length - failed} updated, ${failed} didn’t save.` : `${ids.length} work order${ids.length === 1 ? "" : "s"} updated.`);
    loadOps();
  };
  const refreshAll = () => { loadOps(); loadCounts(); };
  const goWO = (filter: string) => { setWoFilter(filter); setPage("Work Orders"); };

  const openN = jobs.filter(isOpenWO).length;
  const unassignedN = jobs.filter(w => isOpenWO(w) && !w.assignedTechId).length;
  const overdueN = jobs.filter(isOverdue).length;
  const badge = (p: Tab): { n: number; red?: boolean } | null =>
    p === "Work Orders" ? (openN ? { n: openN } : null)
    : p === "Requests" ? (reqCount ? { n: reqCount, red: true } : null)
    : p === "PM" ? (pmOverdue ? { n: pmOverdue, red: true } : null)
    : null;

  return <div className="oh" style={{ color: INK, fontFamily: FONT, letterSpacing: "-0.01em", paddingBottom: 120 }}>
    <style>{OH_CSS}</style>
    <header className="oh-hd">
      <div style={{ minWidth: 0 }}>
        {onBack && <button type="button" className="oh-back" onClick={onBack}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M15 18l-6-6 6-6" /></svg> Operations
        </button>}
        <h1>Operations Hub</h1>
        <div className="sub">{loading && !jobs.length ? "Loading…" : <><b>{openN}</b> open · <b>{unassignedN}</b> need a tech · <b>{overdueN}</b> overdue</>}</div>
      </div>
      <div className="oh-acts">
        <button type="button" className="oh-btn pri" onClick={() => { setPage("Work Orders"); setNewOpen(true); }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M12 5v14M5 12h14" /></svg> New work order
        </button>
        <button type="button" className="oh-btn dark" onClick={refreshAll} aria-label="Refresh"><RefreshCw size={15} /> Refresh</button>
      </div>
    </header>
    <nav className="oh-tabs" role="tablist" aria-label="Operations Hub sections">
      {TABS.map(p => { const b = badge(p); return <button key={p} type="button" role="tab" aria-selected={page === p} onClick={() => setPage(p)}>{p}{b && <b className={b.red ? "red" : undefined}>{b.n}</b>}</button>; })}
    </nav>
    <p className="oh-hint">{TAB_HINT[page]}</p>
    {loadError && <div style={{ ...card, padding: "12px 16px", marginBottom: 14, color: "#D70015", fontSize: 13 }}>{loadError} <button type="button" onClick={loadOps} style={{ ...btn2, padding: "4px 10px", marginLeft: 8 }}>Try again</button></div>}

    {page === "Dashboard" && <Dashboard jobs={jobs} techs={techs} loading={loading} onOpen={setOpenId} onUpdate={updateWO} onFilter={goWO} />}
    {page === "Work Orders" && <WorkOrders jobs={jobs} techs={techs} loading={loading} onCreate={createWO} onUpdate={updateWO} onBulk={bulkUpdate} onOpen={setOpenId} createError={woError} filter={woFilter} setFilter={setWoFilter} newOpen={newOpen} setNewOpen={setNewOpen} />}
    {page === "Schedule" && <CalendarViews />}
    {page === "Analytics" && <AnalyticsView onOpen={setOpenId} />}
    {page === "Requests" && <Requests onConverted={() => { loadOps(); loadCounts(); }} />}
    {page === "Locations" && <Locations />}
    {page === "Techs" && <Techs />}
    {page === "Parts" && <Parts />}
    {page === "Procurement" && <Procurement />}
    {page === "PM" && <PM />}
    {page === "Playbooks" && <Playbooks />}
    {openId && <JobDetailDrawer id={openId} techs={techs} onClose={() => { setOpenId(null); loadOps(); }} onUpdate={updateWO} />}
    {toast && <div className="oh-toast" role="status">{toast}<button type="button" onClick={() => setToast(null)}>OK</button></div>}
  </div>;
}

/* ── Dashboard: tap any count to see those work orders ───────────────────── */
function Dashboard({ jobs, techs, loading, onOpen, onUpdate, onFilter }: { jobs: RealWO[]; techs: RealTech[]; loading: boolean; onOpen: (id: string) => void; onUpdate: (id: string, patch: Record<string, unknown>) => void; onFilter: (f: string) => void }) {
  const unassigned = jobs.filter(j => isOpenWO(j) && !j.assignedTechId).sort((a, b) => prRank(a) - prRank(b));
  const n = (f: (w: RealWO) => boolean) => (loading && !jobs.length ? "—" : String(jobs.filter(f).length));
  const attention = [
    { l: "Need a tech", v: n(w => isOpenWO(w) && !w.assignedTechId), s: "Open, nobody assigned", f: "unassigned", dot: "#FF9F0A" },
    { l: "Overdue", v: n(isOverdue), s: "Scheduled date has passed", f: "overdue", dot: "#FF3B30" },
    { l: "Urgent", v: n(w => isOpenWO(w) && isUrgent(w)), s: "High or critical, still open", f: "urgent", dot: "#FF3B30" },
    { l: "Stuck", v: n(w => bucketOf(stOf(w)) === "Stuck"), s: "Blocked or on hold", f: "b:Stuck", dot: "#8E8E93" },
  ];
  return <div style={{ display: "grid", gap: 16 }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12 }}>
      {attention.map(a => <button key={a.l} type="button" className="oh-stat" style={card} onClick={() => onFilter(a.f)} title={`Show ${a.l.toLowerCase()} work orders`}>
        <div className="l"><span className="oh-dot" style={{ background: a.dot }} />{a.l}</div>
        <div className="v">{a.v}</div>
        <div className="s">{a.s}</div>
      </button>)}
    </div>

    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div className="oh-row" style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}` }}>
        <h2 className="oh-sec">By status</h2><Small>Tap a status to see its jobs</Small>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))" }}>
        {JOB_COLUMNS.map((col, i) => <button key={col.key} type="button" className="oh-stat" onClick={() => onFilter(col.key === "Done" ? "done" : `b:${col.key}`)} style={{ background: "transparent", padding: "14px 18px", borderLeft: i ? `1px solid ${LINE}` : 0 }}>
          <div className="l"><span className="oh-dot" style={{ background: col.accent }} />{col.label}</div>
          <div className="v">{loading && !jobs.length ? "—" : jobs.filter(j => bucketOf(stOf(j)) === col.key).length}</div>
        </button>)}
      </div>
    </Card>

    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div className="oh-row" style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}` }}>
        <h2 className="oh-sec">Needs a tech</h2>
        <Small>{techs.length} {techs.length === 1 ? "tech" : "techs"} on the team</Small>
      </div>
      {loading && !jobs.length ? <div style={{ padding: 18 }}><Small>Loading…</Small></div> : unassigned.length === 0 ? <div style={{ padding: 18 }}><Small>Everything’s assigned.</Small></div> : <div>
        {unassigned.slice(0, 8).map((w, i) => <div key={w.id} className="oh-row" style={{ padding: "10px 18px", borderTop: i ? `1px solid ${LINE}` : 0, flexWrap: "wrap" }}>
          <button type="button" onClick={() => onOpen(w.id)} style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1, border: 0, background: "none", padding: 0, cursor: "pointer", textAlign: "left", fontSize: 14, color: "inherit" }}>
            <span className="oh-dot" style={{ background: prDot(w) }} aria-label={`${prLabel(w)} priority`} />
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b style={{ fontWeight: 500 }}>{woName(w)}</b>{w.title && w.woNumber ? <span style={{ color: INK3 }}> · {w.title}</span> : null}<span style={{ color: INK3 }}> · {w.property || "—"}</span></span>
            <span style={{ color: INK3, fontSize: 12, flex: "none" }}>{ageLabel(ageDays(w))}</span>
          </button>
          <select defaultValue="" aria-label={`Assign ${woName(w)}`} onChange={e => { const t = techs.find(x => x.id === e.target.value); if (e.target.value) onUpdate(w.id, { assignee_id: e.target.value, assignee_name: t?.name ?? null, status: "scheduled" }); }} style={sel}>
            <option value="">Assign tech…</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>)}
        {unassigned.length > 8 && <button type="button" onClick={() => onFilter("unassigned")} style={{ ...btn2, border: 0, borderTop: `1px solid ${LINE}`, borderRadius: 0, width: "100%", color: BLUE }}>See all {unassigned.length}</button>}
      </div>}
    </Card>

    <Board jobs={jobs} onOpen={onOpen} onUpdate={onUpdate} />
  </div>;
}

/* ── Work Orders: search, filter, sort, bulk actions, CSV, table + board ─── */
type SortKey = "newest" | "oldest" | "priority" | "scheduled";
function WorkOrders({ jobs, techs, loading, onCreate, onUpdate, onBulk, onOpen, createError, filter, setFilter, newOpen, setNewOpen }: { jobs: RealWO[]; techs: RealTech[]; loading: boolean; onCreate: (p: Record<string, unknown>) => Promise<boolean>; onUpdate: (id: string, patch: Record<string, unknown>) => void; onBulk: (ids: string[], patch: Record<string, unknown>) => Promise<void>; onOpen: (id: string) => void; createError?: string | null; filter: string; setFilter: (f: string) => void; newOpen: boolean; setNewOpen: (v: boolean) => void }) {
  const showNew = newOpen, setShowNew = (v: boolean | ((s: boolean) => boolean)) => setNewOpen(typeof v === "function" ? v(newOpen) : v);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ site_id: "", customer_name: "", title: "", priority: "medium", assignee_id: "", scheduled_date: "", notify: true, isTask: false });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Site picker for the New WO popup.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sites, setSites] = useState<any[]>([]);
  const [siteQ, setSiteQ] = useState("");
  const [sitesLoading, setSitesLoading] = useState(false);
  useEffect(() => {
    if (!showNew || sites.length) return;
    setSitesLoading(true);
    fetch("/api/sites?limit=300").then(r => r.json())
      .then(d => setSites(Array.isArray(d) ? d : (d.sites ?? d.records ?? [])))
      .catch(() => {}).finally(() => setSitesLoading(false));
  }, [showNew, sites.length]);
  const siteMatches = sites.filter(s => !siteQ || `${s.name ?? ""} ${s.address ?? ""} ${s.city ?? ""}`.toLowerCase().includes(siteQ.toLowerCase())).slice(0, 30);
  function resetForm() { setForm({ site_id: "", customer_name: "", title: "", priority: "medium", assignee_id: "", scheduled_date: "", notify: true, isTask: false }); setSiteQ(""); }
  // Only close the popup if the work order ACTUALLY saved.
  // This used to fire onCreate() without awaiting it and then close + reset
  // unconditionally — so a rejected insert looked exactly like a success: the
  // popup shut, the list refreshed, and no work order existed. Anything the
  // user typed was also thrown away, so they couldn't even retry.
  async function submit() {
    const t = techs.find(x => x.id === form.assignee_id);
    setSubmitting(true);
    let ok = false;
    try {
      if (form.isTask) {
        if (!form.title.trim()) return;
        ok = await onCreate({ job_type: "task", title: form.title.trim(), priority: form.priority, assignee_id: form.assignee_id || null, assignee_name: t?.name ?? null, scheduled_date: form.scheduled_date || null, notify: form.notify });
      } else {
        if (!form.customer_name.trim()) return;
        ok = await onCreate({ site_id: form.site_id || null, customer_name: form.customer_name.trim(), title: form.title.trim() || form.customer_name.trim(), priority: form.priority, assignee_id: form.assignee_id || null, assignee_name: t?.name ?? null, scheduled_date: form.scheduled_date || null, notify: form.notify });
      }
    } finally {
      setSubmitting(false);
    }
    // Failed? Keep the popup open with their typing intact so they can retry.
    if (ok) { resetForm(); setShowNew(false); }
  }
  const canSubmit = form.isTask ? !!form.title.trim() : !!form.customer_name.trim();
  const shown = jobs.filter(w => {
    if (!woMatches(w, filter)) return false;
    if (q && !`${w.woNumber ?? ""} ${w.title ?? ""} ${w.property ?? ""} ${w.assignedTech ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "priority") return prRank(a) - prRank(b) || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
    if (sort === "scheduled") return (schedOf(a) ?? "9999").localeCompare(schedOf(b) ?? "9999");
    if (sort === "oldest") return String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? ""));
    return String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });
  // Selection only ever covers what's on screen.
  const pickedShown = shown.filter(w => picked.has(w.id)).map(w => w.id);
  const allPicked = shown.length > 0 && pickedShown.length === shown.length;
  const toggle = (id: string) => setPicked(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(shown.map(w => w.id)));
  async function bulk(patch: Record<string, unknown>) {
    if (!pickedShown.length) return;
    setBulkBusy(true);
    try { await onBulk(pickedShown, patch); setPicked(new Set()); } finally { setBulkBusy(false); }
  }
  function exportCsv() {
    const cell = (v: unknown) => { const t = String(v ?? ""); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const head = ["WO #", "Job", "Site", "Priority", "Status", "Tech", "Scheduled", "Created", "Days open"];
    const rows = shown.map(w => [w.woNumber, w.title, w.property, prLabel(w), JOB_COLUMNS.find(c => c.key === bucketOf(stOf(w)))?.label, w.assignedTech || "Unassigned", schedOf(w), String(w.createdAt ?? "").slice(0, 10), ageDays(w)]);
    const csv = [head, ...rows].map(r => r.map(cell).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `work-orders-${todayKey()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const count = (f: string) => jobs.filter(w => woMatches(w, f)).length;
  const bucketChip = filter.startsWith("b:") ? JOB_COLUMNS.find(c => c.key === filter.slice(2)) : null;
  const statusSel = (w: RealWO) => <select value={bucketOf(stOf(w))} onClick={e => e.stopPropagation()} onChange={e => onUpdate(w.id, { status: COL_TO_DB[e.target.value] })} style={sel} aria-label={`Status of ${woName(w)}`}>{JOB_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select>;
  const techSel = (w: RealWO) => <select value={w.assignedTechId ?? ""} onClick={e => e.stopPropagation()} onChange={e => { const t = techs.find(x => x.id === e.target.value); onUpdate(w.id, { assignee_id: e.target.value || null, assignee_name: t?.name ?? null }); }} style={sel} aria-label={`Tech for ${woName(w)}`}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>;

  return <div style={{ display: "grid", gap: 16 }}>
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${LINE}`, display: "grid", gap: 10 }}>
        <div className="oh-row" style={{ flexWrap: "wrap" }}>
          <h2 className="oh-sec">Work orders <span style={{ color: INK3, fontWeight: 500 }}>{shown.length}</span></h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)} style={{ ...sel, height: 32 }} aria-label="Sort work orders">
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="priority">Priority</option><option value="scheduled">Scheduled date</option>
            </select>
            <button type="button" className="oh-btn sm line" onClick={exportCsv} disabled={!shown.length}>Export CSV</button>
            <button type="button" className="oh-btn sm pri" onClick={() => setShowNew(true)}>+ New</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="oh-search" placeholder="Search WO #, job, site, tech…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search work orders" />
          <div className="oh-chips">
            {bucketChip && <button type="button" className="oh-chip" aria-pressed onClick={() => setFilter("open")} title="Clear this filter">{bucketChip.label} <b>{count(filter)}</b> ✕</button>}
            {WO_FILTERS.map(f => <button key={f.key} type="button" className="oh-chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label} <b>{count(f.key)}</b></button>)}
          </div>
        </div>
        {pickedShown.length > 0 && <div className="oh-bulk">
          <span>{pickedShown.length} selected</span>
          <select defaultValue="" disabled={bulkBusy} onChange={e => { const v = e.target.value; e.target.value = ""; if (!v) return; const t = techs.find(x => x.id === v); void bulk(v === "__none" ? { assignee_id: null, assignee_name: null } : { assignee_id: v, assignee_name: t?.name ?? null }); }} style={sel} aria-label="Assign selected">
            <option value="">Assign to…</option><option value="__none">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select defaultValue="" disabled={bulkBusy} onChange={e => { const v = e.target.value; e.target.value = ""; if (v) void bulk({ status: COL_TO_DB[v] }); }} style={sel} aria-label="Set status of selected">
            <option value="">Set status…</option>{JOB_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {bulkBusy && <span>Saving…</span>}
          <button type="button" className="oh-btn sm line" onClick={() => setPicked(new Set())} style={{ marginLeft: "auto" }}>Clear</button>
        </div>}
      </div>
      {showNew && <Modal title="New work order" onClose={() => { resetForm(); setShowNew(false); }}>
        <div style={{ display: "grid", gap: 10 }}>
          {/* Task vs site-based work order */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A3A3C", cursor: "pointer", padding: "2px 0" }}>
            <input type="checkbox" checked={form.isTask} onChange={e => setForm({ ...form, isTask: e.target.checked })} style={{ width: 16, height: 16 }} />
            General task — not tied to a site
          </label>
          {/* Step 1: pick the site (site work orders only) */}
          {!form.isTask && <div>
            <div style={{ color: "#6E6E73", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>1. Which site is this for? *</div>
            {form.site_id
              ? <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "#EEF4FF", border: "1px solid rgba(0,163,255,0.4)" }}>
                  <span style={{ fontSize: 14, display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={13} /> {form.customer_name}</span>
                  <button onClick={() => setForm({ ...form, site_id: "", customer_name: "" })} style={{ ...sel, cursor: "pointer" }}>Change</button>
                </div>
              : <>
                  <input placeholder="Search your sites…" value={siteQ} onChange={e => setSiteQ(e.target.value)} style={input} />
                  <div style={{ maxHeight: 180, overflowY: "auto", marginTop: 6, display: "grid", gap: 4 }}>
                    {sitesLoading ? <Small>Loading sites…</Small>
                      : sites.length === 0 ? <Small>No sites found. Add one in the Locations tab first.</Small>
                      : siteMatches.length === 0 ? <Small>No sites match “{siteQ}”.</Small>
                      : siteMatches.map(s => <button key={s.id} onClick={() => setForm({ ...form, site_id: s.id, customer_name: s.name || "" })} style={{ textAlign: "left", cursor: "pointer", padding: "8px 10px", borderRadius: 10, background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.12)", color: "#1D1D1F" }}>
                          <div style={{ fontSize: 13.5 }}>{s.name || "Unnamed site"}</div>
                          {(s.address || s.city) && <div style={{ fontSize: 11, color: "#3A3A3C" }}>{[s.address, s.city, s.state].filter(Boolean).join(", ")}</div>}
                        </button>)}
                  </div>
                </>}
          </div>}
          {/* Step 2: what + who + when */}
          <div>
            <div style={{ color: "#6E6E73", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>{form.isTask ? "What is the task?" : "2. What needs doing?"}</div>
            <input placeholder="e.g. Gate motor won't open" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={input} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={{ ...sel, flex: 1, padding: 10 }}>{["low", "medium", "high", "critical"].map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)} priority</option>)}</select>
            <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ ...sel, flex: 1, padding: 10 }}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          </div>
          <div><div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 3 }}>Schedule date (shows on Calendar)</div><input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} style={input} /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A3A3C", cursor: "pointer", padding: "4px 0" }}>
            <input type="checkbox" checked={form.notify} onChange={e => setForm({ ...form, notify: e.target.checked })} style={{ width: 16, height: 16 }} />
            <Mail size={14} /> Email the assigned tech about this job
          </label>
          {/* If the save failed, SAY SO. Silence here is what made this look
              like "work orders can't be created" instead of a fixable error. */}
          {createError && (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: "#FFECEC", border: "1px solid rgba(244,63,94,0.35)", color: "#D70015", fontSize: 12 }}>
              Couldn’t create the work order — nothing was saved.
              <div style={{ color: "#8A1209", opacity: 0.75, fontSize: 11, marginTop: 4 }}>{createError}</div>
            </div>
          )}
          <button onClick={submit} disabled={!canSubmit || submitting} style={{ ...btn, opacity: (canSubmit && !submitting) ? 1 : 0.5 }}>
            {submitting ? "Saving…" : form.isTask ? (form.title.trim() ? "Create task" : "Enter a task") : (form.site_id ? "Create work order" : "Pick a site first")}
          </button>
        </div>
      </Modal>}
      {loading && !jobs.length ? <div style={{ padding: 18 }}><Small>Loading…</Small></div>
        : jobs.length === 0 ? <div style={{ padding: 18 }}><Small>No work orders yet. Tap “+ New”.</Small></div>
        : shown.length === 0 ? <div style={{ padding: 18 }}><Small>No work orders match.</Small></div>
        : <>
          <div className="oh-tblwrap" style={{ maxHeight: 560, overflowY: "auto" }}>
            <table className="oh-tbl">
              <thead><tr>
                <th style={{ width: 36 }}><input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="Select all shown" /></th>
                <th>WO #</th><th>Job</th>
                <th><button type="button" aria-pressed={sort === "priority"} onClick={() => setSort("priority")}>Priority</button></th>
                <th>Status</th><th>Tech</th>
                <th><button type="button" aria-pressed={sort === "scheduled"} onClick={() => setSort("scheduled")}>Scheduled</button></th>
                <th><button type="button" aria-pressed={sort === "newest" || sort === "oldest"} onClick={() => setSort(sort === "oldest" ? "newest" : "oldest")} title="Days since it was created">Age{sort === "oldest" ? " ↓" : ""}</button></th>
              </tr></thead>
              <tbody>
                {shown.map(w => { const s = schedOf(w); const late = isOverdue(w); return <tr key={w.id} className={picked.has(w.id) ? "sel" : undefined} onClick={() => onOpen(w.id)}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={picked.has(w.id)} onChange={() => toggle(w.id)} aria-label={`Select ${woName(w)}`} /></td>
                  <td className="num m">{w.woNumber || "—"}</td>
                  <td style={{ maxWidth: 340 }}><div className="t" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title || w.property || "Work order"}</div><div className="m" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.property || "—"}</div></td>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}><span className="oh-dot" style={{ background: prDot(w) }} />{prLabel(w)}</span></td>
                  <td onClick={e => e.stopPropagation()}>{statusSel(w)}</td>
                  <td onClick={e => e.stopPropagation()}>{techSel(w)}</td>
                  <td className={`num${late ? " oh-late" : ""}`}>{s ? dayLabel(s) : <span style={{ color: INK3 }}>Not set</span>}{late && " · late"}</td>
                  <td className="num m">{ageLabel(ageDays(w))}</td>
                </tr>; })}
              </tbody>
            </table>
          </div>
          <div className="oh-cards" style={{ padding: 12 }}>
            {shown.map(w => <WORow key={w.id} wo={w} picked={picked.has(w.id)} onPick={() => toggle(w.id)} statusSel={statusSel(w)} techSel={techSel(w)} onOpen={onOpen} />)}
          </div>
        </>}
    </Card>
    <Board jobs={jobs} onOpen={onOpen} onUpdate={onUpdate} />
  </div>;
}

// Phone layout for one work order (the table hides under 820px).
function WORow({ wo, picked, onPick, statusSel, techSel, onOpen }: { wo: RealWO; picked: boolean; onPick: () => void; statusSel: React.ReactNode; techSel: React.ReactNode; onOpen: (id: string) => void }) {
  const s = schedOf(wo); const late = isOverdue(wo);
  return <div className="oh-card" style={picked ? { background: "#EEF4FF" } : undefined}>
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <input type="checkbox" checked={picked} onChange={onPick} aria-label={`Select ${woName(wo)}`} style={{ marginTop: 3 }} />
      <button type="button" onClick={() => onOpen(wo.id)} style={{ flex: 1, minWidth: 0, border: 0, background: "none", padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}>
        <div className="oh-row"><b style={{ fontWeight: 600, fontSize: 14 }}>{woName(wo)}</b><span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: INK3 }}><span className="oh-dot" style={{ background: prDot(wo) }} />{prLabel(wo)}</span></div>
        {wo.title && wo.woNumber && <div style={{ fontSize: 13.5, marginTop: 2 }}>{wo.title}</div>}
        <div style={{ fontSize: 12.5, color: INK3, marginTop: 2 }}>{wo.property || "—"} · <span className={late ? "oh-late" : undefined}>{s ? dayLabel(s) : "No date"}{late ? " (late)" : ""}</span> · {ageLabel(ageDays(wo))} old</div>
      </button>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, paddingLeft: 26 }}>{statusSel}{techSel}</div>
  </div>;
}

function Board({ jobs, onOpen, onUpdate }: { jobs: RealWO[]; onOpen: (id: string) => void; onUpdate?: (id: string, patch: Record<string, unknown>) => void }) {
  const [showDone, setShowDone] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const activeCols = JOB_COLUMNS.filter(c => c.key !== "Done");
  const doneItems = jobs.filter(w => bucketOf(stOf(w)) === "Done");
  // Drag a card to another column → change its status.
  const dropTo = (colKey: string) => {
    const id = dragId; setDragId(null); setOverCol(null);
    if (!id || !onUpdate) return;
    const wo = jobs.find(w => w.id === id);
    if (!wo || bucketOf(stOf(wo)) === colKey) return;
    onUpdate(id, { status: COL_TO_DB[colKey] });
  };
  return <Card>
    <div className="oh-row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
      <h2 className="oh-sec">Jobs board</h2>
      {onUpdate && <Small>Drag a card to another column to change its status.</Small>}
    </div>
    <div className="oh-board">
      {activeCols.map(col => {
        const items = jobs.filter(w => bucketOf(stOf(w)) === col.key).sort((a, b) => prRank(a) - prRank(b));
        const isOver = overCol === col.key;
        return <section key={col.key} aria-label={col.label} className={`oh-col${isOver ? " over" : ""}`}
          onDragOver={onUpdate ? (e => { e.preventDefault(); if (overCol !== col.key) setOverCol(col.key); }) : undefined}
          onDragLeave={onUpdate ? (() => setOverCol(c => c === col.key ? null : c)) : undefined}
          onDrop={onUpdate ? (e => { e.preventDefault(); dropTo(col.key); }) : undefined}>
          <div className="oh-colh"><span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: INK, fontWeight: 600 }}><span className="oh-dot" style={{ background: col.accent }} />{col.label}</span><span>{items.length}</span></div>
          {items.map(w => <button type="button" key={w.id} className="oh-bcard" draggable={!!onUpdate} onDragStart={onUpdate ? (e => { setDragId(w.id); e.dataTransfer.effectAllowed = "move"; }) : undefined} onDragEnd={() => { setDragId(null); setOverCol(null); }} onClick={() => onOpen(w.id)} style={{ cursor: onUpdate ? "grab" : "pointer", opacity: dragId === w.id ? 0.4 : 1, boxShadow: isOverdue(w) ? "inset 3px 0 0 #FF3B30, 0 1px 2px rgba(0,0,0,.06)" : undefined }}>
            <div className="oh-row"><span className="t" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{woName(w)}</span><span className="oh-dot" style={{ background: prDot(w) }} aria-label={`${prLabel(w)} priority`} /></div>
            {w.title && w.woNumber && <div style={{ fontSize: 12.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{w.title}</div>}
            <div className="m">{w.property || "—"}{w.assignedTech ? ` · ${w.assignedTech}` : " · Unassigned"}</div>
            {isOverdue(w) && <div className="m" style={{ color: "#D70015", fontWeight: 600 }}>Late · was due {dayLabel(schedOf(w))}</div>}
          </button>)}
          {items.length === 0 && <p style={{ color: INK3, fontSize: 12, textAlign: "center", padding: "10px 0", margin: 0 }}>{isOver ? "Drop here" : "Nothing here"}</p>}
        </section>;
      })}
    </div>
    {/* Completed jobs stay one click away, but don't take board real estate. */}
    <div style={{ marginTop: 12 }}>
      <button type="button" onClick={() => setShowDone(s => !s)} aria-expanded={showDone} style={{ width: "100%", textAlign: "left", cursor: "pointer", padding: "9px 12px", borderRadius: 10, background: "#E8F6EC", border: 0, color: "#1A7F37", fontSize: 13, fontWeight: 600, fontFamily: "inherit" }}>
        {showDone ? "▾" : "▸"} Complete <span style={{ color: INK3, fontWeight: 500 }}>({doneItems.length})</span>
      </button>
      {showDone && <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
        {doneItems.length === 0 ? <Small>No completed jobs yet.</Small> : doneItems.map(w => <button type="button" key={w.id} onClick={() => onOpen(w.id)} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 12px", borderRadius: 10, background: "#F5F5F7", border: 0, cursor: "pointer", font: "inherit", color: "inherit", textAlign: "left" }}>
          <span style={{ fontSize: 13 }}>{woName(w)}{w.title && w.woNumber ? ` · ${w.title}` : ""}</span>
          <span style={{ fontSize: 12, color: INK3 }}>{w.property || "—"}</span>
        </button>)}
      </div>}
    </div>
  </Card>;
}

/* ── Calendar: month / week / day, filter by tech (real /api/calendar/events) */
const EVENT_COLOR: Record<string, string> = { work_order: "#248A3D", work_order_phase: "#B25000", pm_schedule: "#0071E3", todo: "#0071E3", crm_activity: "#0071E3", tracker_task: "#0071E3", nexus_event: "#94a3b8", gcal: "#0071E3" };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const evTime = (e: any) => (e.time ? String(e.time).slice(0, 5) : "");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CalendarView({ onOpenWO, jobs = [] }: { onOpenWO: (id: string) => void; jobs?: RealWO[] }) {
  const today = new Date(); const todayKey = ymd(today);
  const [view, setView] = useState<"month" | "week" | "day">("month");
  const [anchor, setAnchor] = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const range = React.useMemo(() => {
    if (view === "day") return { start: new Date(anchor), end: new Date(anchor) };
    if (view === "week") { const s = new Date(anchor); s.setDate(anchor.getDate() - anchor.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return { start: s, end: e }; }
    return { start: new Date(anchor.getFullYear(), anchor.getMonth(), 1), end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0) };
  }, [view, anchor]);

  const months = React.useMemo(() => {
    const out: { y: number; m: number }[] = []; let cur = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
    while (cur <= range.end) { out.push({ y: cur.getFullYear(), m: cur.getMonth() + 1 }); cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1); }
    return out;
  }, [range]);
  const monthsKey = months.map(x => `${x.y}-${x.m}`).join(",");

  useEffect(() => {
    setLoading(true);
    Promise.all(months.map(({ y, m }) => fetch(`/api/calendar/events?year=${y}&month=${m}&scope=team`).then(r => r.json()).catch(() => ({}))))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((results: any[]) => { const all: any[] = []; const seen = new Set<string>(); for (const r of results) for (const e of (r.events ?? [])) if (!seen.has(e.id)) { seen.add(e.id); all.push(e); } setEvents(all); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsKey]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const techOf = (e: any): string | null => e.type === "work_order" ? (e.owner_name || "Unassigned") : null;
  const techList = React.useMemo(() => {
    const s = new Set<string>(); let unassigned = false;
    for (const e of events) if (e.type === "work_order") { if (e.owner_name) s.add(e.owner_name); else unassigned = true; }
    const arr = [...s].sort(); if (unassigned) arr.push("Unassigned"); return arr;
  }, [events]);
  const visible = events.filter(e => { const t = techOf(e); return t === null ? true : !hidden.has(t); });
  const dayEvents = (key: string) => visible.filter(e => String(e.date ?? "").slice(0, 10) === key).sort((a, b) => evTime(a).localeCompare(evTime(b)));
  const toggleTech = (t: string) => setHidden(h => { const n = new Set(h); n.has(t) ? n.delete(t) : n.add(t); return n; });

  const shift = (d: number) => setAnchor(a => { const n = new Date(a); if (view === "day") n.setDate(a.getDate() + d); else if (view === "week") n.setDate(a.getDate() + 7 * d); else n.setMonth(a.getMonth() + d); return n; });
  const label = view === "day" ? anchor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : view === "week" ? `${range.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${range.end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : anchor.toLocaleString("en-US", { month: "long", year: "numeric" });

  const Chip = ({ e, mini }: { e: typeof events[number]; mini?: boolean }) => <div onClick={() => e.type === "work_order" && onOpenWO(e.id)} title={e.title} style={{ cursor: e.type === "work_order" ? "pointer" : "default", fontSize: mini ? 9 : 12, lineHeight: 1.3, marginBottom: 3, padding: mini ? "1px 4px" : "5px 8px", borderRadius: 6, background: `${EVENT_COLOR[e.type] ?? "#94a3b8"}26`, borderLeft: `2px solid ${EVENT_COLOR[e.type] ?? "#94a3b8"}`, whiteSpace: mini ? "nowrap" : "normal", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{evTime(e) && <b style={{ opacity: 0.85 }}>{evTime(e)} </b>}{e.title}{!mini && e.owner_name && <span style={{ color: "#3A3A3C" }}> · {e.owner_name}</span>}</div>;

  // Assigned/created jobs that have no date yet never land on a calendar grid —
  // surface them here so a job is never invisible. Respects the tech show/hide chips.
  const unscheduled = jobs.filter(w => (!w.eta || w.eta === "TBD") && bucketOf(stOf(w)) !== "Done" && !hidden.has(w.assignedTech || "Unassigned"));

  return <Card>
    {unscheduled.length > 0 && <div style={{ marginBottom: 12, padding: 10, borderRadius: 12, background: "#FFF4E5", border: "1px solid rgba(245,158,11,0.3)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#B25000", marginBottom: 6 }}>⏳ Needs a date ({unscheduled.length}) — these jobs won't show on the calendar until scheduled</div>
      <div style={{ display: "grid", gap: 5 }}>
        {unscheduled.slice(0, 8).map(w => <button key={w.id} onClick={() => onOpenWO(w.id)} style={{ textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 8, padding: "7px 10px", borderRadius: 9, background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.12)", color: "#1D1D1F" }}>
          <span style={{ fontSize: 13 }}>{w.woNumber || w.title || "Work Order"}</span>
          <span style={{ fontSize: 11.5, color: "#6E6E73" }}>{w.assignedTech || "Unassigned"} · tap to schedule</span>
        </button>)}
      </div>
    </div>}
    {/* Toolbar */}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 6 }}>
        {(["month", "week", "day"] as const).map(v => <button key={v} onClick={() => setView(v)} style={{ ...sel, padding: "6px 12px", cursor: "pointer", background: view === v ? "#EEF4FF" : "#F5F5F7", border: view === v ? "1px solid rgba(0,163,255,0.42)" : "1px solid rgba(0,0,0,0.12)", color: "#1D1D1F", textTransform: "capitalize" }}>{v}</button>)}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => shift(-1)} style={{ ...btn2, padding: "8px 12px" }}>‹</button>
        <button onClick={() => setAnchor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))} style={{ ...btn2, padding: "8px 12px" }}>Today</button>
        <button onClick={() => shift(1)} style={{ ...btn2, padding: "8px 12px" }}>›</button>
      </div>
    </div>
    <h2 style={{ fontSize: 16, textAlign: "center", marginBottom: 12 }}>{loading ? "Loading…" : label}</h2>

    {/* Tech filter */}
    {techList.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: "#8E8E93", alignSelf: "center" }}>Show techs:</span>
      {techList.map(t => { const off = hidden.has(t); return <button key={t} onClick={() => toggleTech(t)} style={{ ...sel, cursor: "pointer", padding: "4px 10px", opacity: off ? 0.4 : 1, background: off ? "#F5F5F7" : "#E8F6EC", border: off ? "1px solid rgba(0,0,0,0.12)" : "1px solid rgba(0,230,153,.34)", color: "#1D1D1F" }}>{off ? "○" : "●"} {t}</button>; })}
    </div>}

    {/* Month grid */}
    {view === "month" && (() => {
      const firstDow = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay();
      const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
      const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
      return <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 5, width: "100%" }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <div key={i} style={{ minWidth: 0, textAlign: "center", fontSize: 10, color: "#8E8E93", padding: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`x${i}`} style={{ minWidth: 0 }} />;
          const key = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const evs = dayEvents(key); const isToday = key === todayKey;
          return <div key={day} style={{ minWidth: 0, boxSizing: "border-box", minHeight: 72, padding: 5, borderRadius: 10, overflow: "hidden", background: isToday ? "#EEF4FF" : "#FAFAFB", border: isToday ? "1px solid rgba(0,163,255,0.4)" : "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ fontSize: 11, color: "#6E6E73", marginBottom: 3 }}>{day}</div>
            {evs.slice(0, 3).map((e, j) => <Chip key={e.id || j} e={e} mini />)}
            {evs.length > 3 && <div style={{ fontSize: 9, color: "#8E8E93" }}>+{evs.length - 3} more</div>}
          </div>;
        })}
      </div>;
    })()}

    {/* Week grid */}
    {view === "week" && <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr))", gap: 6, width: "100%" }}>
      {Array.from({ length: 7 }, (_, i) => { const d = new Date(range.start); d.setDate(range.start.getDate() + i); return d; }).map(d => {
        const key = ymd(d); const evs = dayEvents(key); const isToday = key === todayKey;
        return <div key={key} style={{ minWidth: 0, boxSizing: "border-box", minHeight: 200, padding: 7, borderRadius: 10, overflow: "hidden", background: isToday ? "#EEF4FF" : "#FAFAFB", border: isToday ? "1px solid rgba(0,163,255,0.4)" : "1px solid rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 10, color: "#3A3A3C" }}>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{d.getDate()}</div>
          {evs.length === 0 ? <div style={{ fontSize: 10, color: "#8E8E93" }}>—</div> : evs.map((e, j) => <Chip key={e.id || j} e={e} mini />)}
        </div>;
      })}
    </div>}

    {/* Day list */}
    {view === "day" && (() => {
      const evs = dayEvents(ymd(anchor));
      return <div style={{ display: "grid", gap: 6 }}>
        {evs.length === 0 ? <Small>Nothing scheduled this day.</Small> : evs.map((e, j) => <Chip key={e.id || j} e={e} />)}
      </div>;
    })()}

    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, fontSize: 11, color: "#6E6E73" }}>
      <span><span style={{ color: "#248A3D" }}>■</span> Work order</span>
      <span><span style={{ color: "#B25000" }}>■</span> Job phase</span>
      <span><span style={{ color: "#0071E3" }}>■</span> PM</span>
      <span><span style={{ color: "#0071E3" }}>■</span> To-do</span>
    </div>
  </Card>;
}

/* ── Techs: add technicians + set their /tech app code (password) ────────── */
function genTechCode(initials: string) { return `GG-${(initials || "GG").toUpperCase().slice(0, 2)}-${Math.floor(1000 + Math.random() * 9000)}`; }
const TECH_LEVELS = ["Apprentice", "Tech", "Senior Tech", "Lead", "Supervisor"];
const TECH_STATUS = ["available", "offline", "on_job"];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
type TimeOff = { start: string; end: string; reason: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function techOffToday(t: any): TimeOff | null {
  const today = ymd(new Date());
  const list: TimeOff[] = t?.schedule?.time_off ?? [];
  return list.find(o => o.start && o.end && o.start <= today && today <= o.end) ?? null;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Techs() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [techs, setTechs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", role: "Tech", phone: "", email: "" });
  const [copied, setCopied] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [sched, setSched] = useState<{ days: string[]; start: string; end: string; timeOff: TimeOff[] }>({ days: [], start: "08:00", end: "17:00", timeOff: [] });
  const [savingId, setSavingId] = useState<string | null>(null);
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function startEdit(t: any) {
    setEditId(t.id);
    setEdit({ name: t.name ?? "", phone: t.phone ?? "", email: t.email ?? "", role: t.role ?? "Tech", level: t.level ?? "", status: t.status ?? "offline", skills: Array.isArray(t.skills) ? t.skills.join(", ") : (t.skills ?? "") });
    const sc = t.schedule ?? {};
    setSched({ days: Array.isArray(sc.days) ? sc.days : [], start: sc.start || "08:00", end: sc.end || "17:00", timeOff: Array.isArray(sc.time_off) ? sc.time_off : [] });
  }
  async function saveEdit(id: string) {
    setSavingId(id);
    const payload: Record<string, unknown> = {
      name: edit.name?.trim(), phone: edit.phone?.trim() || null, email: edit.email?.trim() || null,
      role: edit.role || "Tech", level: edit.level || null, status: edit.status || "offline",
      skills: (edit.skills || "").split(",").map(s => s.trim()).filter(Boolean),
      schedule: { days: sched.days, start: sched.start, end: sched.end, time_off: sched.timeOff.filter(o => o.start && o.end) },
    };
    if (edit.name?.trim()) payload.initials = edit.name.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    await fetch(`/api/dispatch/technicians/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {});
    setSavingId(null); setEditId(null); load();
  }
  return <div style={{ display: "grid", gap: 14 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16 }}>Technicians</h2>
        <button onClick={() => setShowNew(s => !s)} style={btn}>+ Add tech</button>
      </div>
      <Small>Tap a tech to edit their details. Each logs into the field tool at <b style={{ color: "#6E6E73" }}>/tech</b> using their personal code.</Small>
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
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, cursor: "pointer", alignItems: "center" }} onClick={() => editId === t.id ? setEditId(null) : startEdit(t)}>
            <b style={{ fontSize: 15 }}>{t.name}</b>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {techOffToday(t) && <Badge tone="urgent">Off: {techOffToday(t)?.reason || "PTO"}</Badge>}
              <Badge tone={t.status === "available" ? "good" : "default"}>{t.level || t.role || "Tech"}</Badge>
            </div>
          </div>
          {(t.phone || t.email) && <Small>{[t.phone, t.email].filter(Boolean).join(" · ")}</Small>}
          {Array.isArray(t.skills) && t.skills.length > 0 && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>{t.skills.map((s: string, i: number) => <span key={i} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "#EEEEFF", border: "1px solid rgba(99,102,241,0.3)" }}>{s}</span>)}</div>}

          {editId === t.id && <div style={{ ...card, marginTop: 10, display: "grid", gap: 8 }}>
            <input placeholder="Full name" value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Phone" value={edit.phone} onChange={e => setEdit({ ...edit, phone: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
              <input placeholder="Email" value={edit.email} onChange={e => setEdit({ ...edit, email: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 3 }}>Level</div><select value={edit.level} onChange={e => setEdit({ ...edit, level: e.target.value })} style={{ ...sel, width: "100%", padding: 9 }}><option value="">—</option>{TECH_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select></div>
              <div style={{ flex: 1 }}><div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 3 }}>Status</div><select value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })} style={{ ...sel, width: "100%", padding: 9 }}>{TECH_STATUS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            </div>
            <input placeholder="Role / title (e.g. Install Tech)" value={edit.role} onChange={e => setEdit({ ...edit, role: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} />
            <div><div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 3 }}>Skills / certifications (comma-separated)</div><input placeholder="Brivo, fiber splicing, OSHA-10" value={edit.skills} onChange={e => setEdit({ ...edit, skills: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} /></div>

            {/* Working days + hours */}
            <div style={{ paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 5 }}>Working days</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {WEEK_DAYS.map(d => { const on = sched.days.includes(d); return <button key={d} onClick={() => setSched(s => ({ ...s, days: on ? s.days.filter(x => x !== d) : [...s.days, d] }))} style={{ ...sel, cursor: "pointer", padding: "4px 9px", background: on ? "#EEF4FF" : "#F5F5F7", border: on ? "1px solid rgba(0,163,255,0.42)" : "1px solid rgba(0,0,0,0.12)", color: "#1D1D1F" }}>{d}</button>; })}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                <span style={{ color: "#6E6E73", fontSize: 11 }}>Hours</span>
                <input type="time" value={sched.start} onChange={e => setSched(s => ({ ...s, start: e.target.value }))} style={{ ...sel, padding: 8 }} />
                <span style={{ color: "#8E8E93" }}>to</span>
                <input type="time" value={sched.end} onChange={e => setSched(s => ({ ...s, end: e.target.value }))} style={{ ...sel, padding: 8 }} />
              </div>
            </div>

            {/* Time off / unavailable */}
            <div style={{ paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ color: "#6E6E73", fontSize: 11 }}>Time off / unavailable (vacation, PTO)</span>
                <button onClick={() => setSched(s => ({ ...s, timeOff: [...s.timeOff, { start: "", end: "", reason: "" }] }))} style={{ ...btn2, padding: "4px 10px", fontSize: 12 }}>+ Add</button>
              </div>
              {sched.timeOff.length === 0 ? <Small>None — tech is available on working days.</Small> : sched.timeOff.map((o, i) => <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <input type="date" value={o.start} onChange={e => setSched(s => ({ ...s, timeOff: s.timeOff.map((x, j) => j === i ? { ...x, start: e.target.value } : x) }))} style={{ ...sel, padding: 7 }} />
                <input type="date" value={o.end} onChange={e => setSched(s => ({ ...s, timeOff: s.timeOff.map((x, j) => j === i ? { ...x, end: e.target.value } : x) }))} style={{ ...sel, padding: 7 }} />
                <input placeholder="Reason" value={o.reason} onChange={e => setSched(s => ({ ...s, timeOff: s.timeOff.map((x, j) => j === i ? { ...x, reason: e.target.value } : x) }))} style={{ ...input, padding: 7, fontSize: 12, flex: 1, minWidth: 80 }} />
                <button onClick={() => setSched(s => ({ ...s, timeOff: s.timeOff.filter((_, j) => j !== i) }))} style={{ ...btn2, color: "#D70015", padding: "0 10px" }}>×</button>
              </div>)}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveEdit(t.id)} disabled={savingId === t.id} style={{ ...btn, flex: 1, opacity: savingId === t.id ? 0.6 : 1 }}>{savingId === t.id ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditId(null)} style={{ ...btn2 }}>Cancel</button>
            </div>
          </div>}

          <div style={{ marginTop: 12 }}>
            <div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 4 }}>App code (their password for /tech)</div>
            {t.tech_code ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontFamily: "monospace", fontSize: 14, background: "#EEF4FF", border: "1px solid rgba(0,163,255,0.3)", borderRadius: 8, padding: "5px 10px" }}>{t.tech_code}</code>
              <button onClick={() => copy(t.tech_code)} style={{ ...btn2, padding: "6px 10px" }}>{copied === t.tech_code ? "Copied!" : "Copy"}</button>
              <button onClick={() => setCode(t)} style={{ ...btn2, padding: "6px 10px" }}>Regen</button>
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
  const [openToSetup, setOpenToSetup] = useState(false);   // new sites open on the Setup tab
  // + Add a site (5th-grade simple: name + basics → opens the site to add its keys)
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", city: "", state: "", units: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = React.useCallback(() => { setLoading(true); fetch("/api/sites?limit=60").then(r => r.json()).then(d => setSites(d.sites ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  async function createSite() {
    if (!form.name.trim() || busy) return; setBusy(true); setMsg(null);
    const body: Record<string, unknown> = { name: form.name.trim(), address: form.address.trim() || null, city: form.city.trim() || null, state: form.state.trim() || null };
    if (form.units && !isNaN(Number(form.units))) body.units = Number(form.units);
    const r = await fetch("/api/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(x => x.json()).catch(() => null);
    setBusy(false);
    const newId = r?.site?.id;
    if (newId) { setForm({ name: "", address: "", city: "", state: "", units: "" }); setShowNew(false); load(); setOpenToSetup(true); setOpenSite(newId); }
    else setMsg((r && r.error) || "Couldn't create the site.");
  }
  const input = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.12)", color: "#3A3A3C", borderRadius: 10, padding: "9px 11px", width: "100%", fontSize: 13 } as const;
  const addBar = <Card style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div><b style={{ fontSize: 15 }}>Add a site</b><div style={{ fontSize: 12, color: "#6E6E73" }}>Name it, create it, then add its own gate/camera logins.</div></div>
      <button onClick={() => { setShowNew(s => !s); setMsg(null); }} style={btn}>{showNew ? "Cancel" : "+ Add a site"}</button>
    </div>
    {showNew && <div style={{ ...card, marginTop: 12, display: "grid", gap: 8 }}>
      <input placeholder="Site / property name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
      <input placeholder="Street address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} style={input} />
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="City" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={{ ...input, flex: 2 }} />
        <input placeholder="State" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} style={{ ...input, flex: 1 }} />
        <input placeholder="Units" value={form.units} onChange={e => setForm({ ...form, units: e.target.value.replace(/[^0-9]/g, "") })} style={{ ...input, flex: 1 }} />
      </div>
      <button onClick={createSite} disabled={!form.name.trim() || busy} style={{ ...btn, opacity: form.name.trim() && !busy ? 1 : 0.5 }}>{busy ? "Creating…" : "Create site → add its keys"}</button>
      {msg && <p style={{ fontSize: 12, color: "#D70015", margin: 0 }}>{msg}</p>}
    </div>}
  </Card>;
  if (loading) return <>{addBar}<Card><Small>Loading sites…</Small></Card></>;
  if (sites.length === 0) return <>{addBar}<Card><Small>No sites yet. Tap “+ Add a site” to create your first one.</Small></Card>{openSite && <SiteDetailDrawer id={openSite} systemsTab={openToSetup ? "setup" : undefined} onClose={() => { setOpenSite(null); setOpenToSetup(false); load(); }} />}</>;
  return <>
    {addBar}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
      {sites.map(s => <Card key={s.id} style={{ cursor: "pointer" }}>
        <div onClick={() => setOpenSite(s.id)}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{s.name || "Site"}</b>
            {s.offline_asset_count > 0 ? <Badge tone="urgent">{s.offline_asset_count} offline</Badge> : <Badge tone="good">healthy</Badge>}
          </div>
          <Small>{[s.city, s.state].filter(Boolean).join(", ") || "—"}</Small>
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13 }}>
            <div><div style={{ color: "#6E6E73", fontSize: 11 }}>Units</div><b>{num(s.units) || "—"}</b></div>
            <div><div style={{ color: "#6E6E73", fontSize: 11 }}>Assets</div><b>{num(s.asset_count)}</b></div>
            <div><div style={{ color: "#6E6E73", fontSize: 11 }}>Open WOs</div><b>{num(s.open_wo_count)}</b></div>
          </div>
          <p style={{ color: "#3A3A3C", fontSize: 11, marginTop: 10 }}>Tap to view & edit details →</p>
        </div>
      </Card>)}
    </div>
    {openSite && <SiteDetailDrawer id={openSite} systemsTab={openToSetup ? "setup" : undefined} onClose={() => { setOpenSite(null); setOpenToSetup(false); load(); }} />}
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
/* ── Analytics: tech utilization + re-work / first-time-fix ──────────────── */
function AnalyticsView({ onOpen }: { onOpen: (id: string) => void }) {
  const [days, setDays] = useState(30);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetch(`/api/dispatch/analytics?days=${days}`).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false)); }, [days]);
  const t = data?.totals ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perTech: any[] = data?.perTech ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callbacks: any[] = data?.callbackList ?? [];
  const utilColor = (p: number) => p >= 80 ? "#248A3D" : p >= 50 ? "#B25000" : "#D70015";
  const kpi = (label: string, val: string | number, accent: string) => (
    <Card><Small>{label}</Small><div style={{ fontSize: 26, fontWeight: 600, color: accent, marginTop: 4 }}>{val}</div></Card>
  );
  const rangeBtn = (d: number) => <button key={d} onClick={() => setDays(d)} style={{ ...btn, padding: "5px 12px", background: days === d ? "#EEF4FF" : "#F5F5F7", border: days === d ? "1px solid rgba(0,163,255,0.45)" : "1px solid rgba(0,0,0,0.12)", color: days === d ? "#0071E3" : "#6E6E73" }}>{d}d</button>;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", gap: 6 }}>{[7, 30, 90].map(rangeBtn)}</div>
      {loading ? <Card><Small>Crunching numbers…</Small></Card> : <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
          {kpi("First-time-fix", t.ftfPct == null ? "—" : `${t.ftfPct}%`, t.ftfPct == null ? "#6E6E73" : t.ftfPct >= 90 ? "#248A3D" : t.ftfPct >= 75 ? "#B25000" : "#D70015")}
          {kpi("Callbacks / re-work", t.callbacks ?? 0, (t.callbacks ?? 0) === 0 ? "#248A3D" : "#D70015")}
          {kpi("Completed", t.completed ?? 0, "#0071E3")}
          {kpi("Hours logged", t.hours ?? 0, "#0071E3")}
          {kpi("Avg utilization", `${t.avgUtilizationPct ?? 0}%`, utilColor(t.avgUtilizationPct ?? 0))}
        </div>

        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>Technician utilization</h2>
          {perTech.length === 0 ? <Small>No technicians yet.</Small> : <div style={{ display: "grid", gap: 8 }}>
            {perTech.map(tech => (
              <div key={tech.id} style={{ display: "grid", gridTemplateColumns: "150px 1fr 70px", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#3A3A3C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{tech.name}</span>
                <div>
                  <div style={{ height: 8, borderRadius: 5, background: "#F5F5F7", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(tech.utilizationPct, 100)}%`, height: "100%", background: utilColor(tech.utilizationPct) }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "#3A3A3C", marginTop: 3 }}>{tech.jobs} jobs · {tech.completed} done · {tech.hours} hrs</div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, textAlign: "right", color: utilColor(tech.utilizationPct) }}>{tech.utilizationPct}%</span>
              </div>
            ))}
          </div>}
          <Small>Utilization = hours logged ÷ available (weekdays × 8h) over the period.</Small>
        </Card>

        {callbacks.length > 0 && (
          <Card>
            <h2 style={{ fontSize: 15, marginBottom: 8 }}>Callbacks / re-work ({callbacks.length})</h2>
            <div style={{ display: "grid", gap: 5 }}>
              {callbacks.map(c => (
                <div key={c.id} onClick={() => onOpen(c.id)} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, padding: "7px 10px", background: "#FFECEC", border: "1px solid rgba(255,77,77,0.22)", borderRadius: 9, cursor: "pointer" }}>
                  <span style={{ color: "#3A3A3C" }}>{c.title || c.wo_number || "WO"} <span style={{ color: "#3A3A3C" }}>· {c.customer_name || ""}</span></span>
                  <span style={{ color: "#3A3A3C" }}>{c.assignee_name || "Unassigned"}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </>}
    </div>
  );
}

/* ── Dispatch: drag-drop tech × day scheduling board ─────────────────────── */
function DispatchBoard({ jobs, techs, loading, onOpen, onUpdate }: { jobs: RealWO[]; techs: RealTech[]; loading: boolean; onOpen: (id: string) => void; onUpdate: (id: string, patch: Record<string, unknown>) => void }) {
  const [weekStart, setWeekStart] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCell, setOverCell] = useState<string | null>(null);

  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const jobDate = (w: RealWO) => (w.eta && /^\d{4}-\d{2}-\d{2}/.test(w.eta)) ? w.eta.slice(0, 10) : null;
  const rows: RealTech[] = [{ id: "", name: "Unassigned" }, ...techs];
  const unscheduled = jobs.filter(w => !jobDate(w) && bucketOf(stOf(w)) !== "Done");
  const navBtn = { ...btn2, padding: "6px 12px" } as const;

  const drop = (techId: string, dayIso: string) => {
    const id = dragId; setDragId(null); setOverCell(null);
    if (!id) return;
    const t = techs.find(x => x.id === techId);
    onUpdate(id, { assignee_id: techId || null, assignee_name: t?.name ?? null, scheduled_date: dayIso, status: "scheduled" });
  };

  const card = (w: RealWO) => (
    <div key={w.id} draggable onDragStart={e => { setDragId(w.id); e.dataTransfer.effectAllowed = "move"; }} onDragEnd={() => { setDragId(null); setOverCell(null); }} onClick={() => onOpen(w.id)}
      style={{ padding: "6px 8px", borderRadius: 8, background: "#EEF4FF", border: "1px solid rgba(0,163,255,0.28)", marginBottom: 5, cursor: "grab", fontSize: 11.5, opacity: dragId === w.id ? 0.4 : 1 }}>
      <div style={{ fontWeight: 600, color: "#3A3A3C", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.title || w.woNumber || "WO"}</div>
      {w.property && <div style={{ color: "#6E6E73", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.property}</div>}
    </div>
  );

  if (loading) return <Card><Small>Loading schedule…</Small></Card>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} style={navBtn}>‹</button>
        <button onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setWeekStart(d); }} style={navBtn}>Today</button>
        <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} style={navBtn}>›</button>
        <span style={{ marginLeft: 8, fontSize: 13, color: "#6E6E73" }}>{days[0].toLocaleDateString([], { month: "short", day: "numeric" })} – {days[6].toLocaleDateString([], { month: "short", day: "numeric" })}</span>
      </div>

      {unscheduled.length > 0 && (
        <div style={{ background: "#FAFAFB", border: "1px dashed rgba(0,0,0,0.12)", borderRadius: 12, padding: 10 }}>
          <Small>Unscheduled ({unscheduled.length}) — drag onto a tech &amp; day</Small>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>{unscheduled.map(w => <div key={w.id} style={{ width: 150 }}>{card(w)}</div>)}</div>
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px repeat(7, minmax(120px,1fr))", gap: 6, minWidth: 900 }}>
          <div />
          {days.map(d => <div key={iso(d)} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 600, color: "#6E6E73", padding: "4px 0" }}>{d.toLocaleDateString([], { weekday: "short" })}<div style={{ fontSize: 10, color: "#8E8E93" }}>{d.toLocaleDateString([], { month: "short", day: "numeric" })}</div></div>)}
          {rows.map(row => (
            <React.Fragment key={row.id || "unassigned"}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#3A3A3C", padding: "8px 6px", display: "flex", alignItems: "center" }}>{row.name}</div>
              {days.map(d => {
                const key = `${row.id}|${iso(d)}`;
                const cell = jobs.filter(w => (w.assignedTechId || "") === row.id && jobDate(w) === iso(d));
                return (
                  <div key={key} onDragOver={e => { e.preventDefault(); if (overCell !== key) setOverCell(key); }} onDragLeave={() => setOverCell(c => c === key ? null : c)} onDrop={e => { e.preventDefault(); drop(row.id, iso(d)); }}
                    style={{ minHeight: 60, background: overCell === key ? "#EEF4FF" : "#FAFAFB", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: 5 }}>
                    {cell.map(card)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteDetailDrawer({ id, onClose, systemsTab }: { id: string; onClose: () => void; systemsTab?: string }) {
  // Credentials are corporate-only; dealers see Doors/cameras but not Connections.
  const { user } = useUser();
  const isCorporate = ((user?.publicMetadata as Record<string, unknown> | undefined)?.org_tier) === "corporate";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [site, setSite] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [assets, setAssets] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [wos, setWos] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [events, setEvents] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pm, setPm] = useState<any[]>([]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // add-equipment / add-note / upload state
  const [showAddEq, setShowAddEq] = useState(false);
  const [eq, setEq] = useState({ product_name: "", serial_number: "", location_note: "", status: "active" });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  // + new work order from this site
  const [showNewWo, setShowNewWo] = useState(false);
  const [woTitle, setWoTitle] = useState("");
  const [woMsg, setWoMsg] = useState<string | null>(null);
  const load = React.useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/sites/${id}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/pm-schedules`).then(r => r.json()).catch(() => ({})),
    ]).then(([d, p]) => {
      setSite(d.site ?? null); setAssets(d.assets ?? d.site_assets ?? []);
      setWos(d.work_orders ?? d.workOrders ?? []); setEvents(d.events ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setPm((p.pm_schedules ?? []).filter((s: any) => s.site_id === id));
    }).finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const isDone = (s?: string) => ["completed", "complete", "done", "closed"].includes(String(s || "").toLowerCase());
  const pastWos = wos.filter(w => isDone(w.status));
  const upcomingWos = wos.filter(w => !isDone(w.status));
  const photos = events.filter(e => ["as_built", "photo", "site_photo"].includes(String(e.event_type)) && /^https?:\/\//.test(String(e.description || "")));
  const noteEvents = events.filter(e => !["as_built", "photo", "site_photo"].includes(String(e.event_type)));

  async function addEquipment() {
    if (!eq.product_name.trim() || busy) return; setBusy(true);
    await fetch(`/api/sites/${id}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: eq.product_name.trim(), serial_number: eq.serial_number.trim() || null, location_note: eq.location_note.trim() || null, status: eq.status }) }).catch(() => {});
    setEq({ product_name: "", serial_number: "", location_note: "", status: "active" }); setShowAddEq(false); setBusy(false); load();
  }
  async function addNote() {
    if (!note.trim() || busy) return; setBusy(true);
    await fetch(`/api/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event_type: "note", title: note.trim().slice(0, 80), description: note.trim(), site_id: id }) }).catch(() => {});
    setNote(""); setBusy(false); load();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function uploadPhoto(file: File) {
    if (!file || uploading) return; setUploading(true); setUploadErr(null);
    try {
      // One-shot server upload: file → storage + site_events row in a single request.
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/sites/${id}/asbuilt`, { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error || `Upload failed (${res.status})`); }
    } catch (err) {
      setUploadErr(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false); load();
  }
  async function createWorkOrder() {
    if (!woTitle.trim() || busy) return; setBusy(true); setWoMsg(null);
    const r = await fetch(`/api/dispatch`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_name: site?.name || "Site", site_id: id, title: woTitle.trim(), priority: "normal" }) }).catch(() => null);
    setBusy(false);
    if (r && r.ok) { setWoTitle(""); setShowNewWo(false); setWoMsg("Work order created ✓ — find it in Work Orders."); load(); }
    else setWoMsg("Couldn't create the work order.");
  }
  const val = (k: string) => (k in edit ? edit[k] : (site?.[k] ?? "")) as string;
  async function save() {
    if (Object.keys(edit).length === 0) { onClose(); return; }
    setSaving(true);
    const r = await fetch(`/api/sites/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edit) }).catch(() => null);
    setSaving(false);
    if (r && r.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); setEdit({}); const d = await r.json().catch(() => null); if (d?.site) setSite(d.site); }
  }
  return <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 130, background: "rgba(15,23,42,0.42)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div onClick={e => e.stopPropagation()} style={{ width: "min(760px,100%)", maxHeight: "92vh", overflowY: "auto", background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: 20, paddingBottom: "calc(120px + env(safe-area-inset-bottom))", color: "#1D1D1F", boxShadow: "0 1px 2px rgba(10,20,40,0.06), 0 8px 24px rgba(10,20,40,0.08)" }}>
      <button onClick={onClose} style={{ ...btn2, border: "1px solid rgba(0,0,0,0.12)", color: "#3A3A3C", marginBottom: 16, display: "inline-flex", alignItems: "center", gap: 6 }}><X size={15} /> Close</button>
      {loading ? <Small>Loading…</Small> : !site ? <Small>Couldn’t load this site.</Small> : <div style={{ display: "grid", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#0071E3", letterSpacing: "0.1em" }}>SITE</div>
          <h2 style={{ margin: "4px 0", fontSize: 22 }}>{site.name || "Site"}</h2>
          <Small>{[site.city, site.state].filter(Boolean).join(", ") || "—"}</Small>
          {/* Lifecycle status (#60): Active only when contract signed AND deposit paid */}
          {(() => {
            const a = siteActivation(site);
            return <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${SITE_STATUS_COLORS[a.status]}22`, border: `1px solid ${SITE_STATUS_COLORS[a.status]}66`, color: SITE_STATUS_COLORS[a.status] }}>{SITE_STATUS_LABELS[a.status]}</span>
              {!a.active && a.blockers.length > 0 && <span style={{ fontSize: 11, color: "#6E6E73" }}>To activate: {a.blockers.join(" · ")}</span>}
            </div>;
          })()}
        </div>

        {/* + New work order from this site */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 15 }}>Work at this site</h2>
            <button onClick={() => { setShowNewWo(s => !s); setWoMsg(null); }} style={btn}>+ New work order</button>
          </div>
          {showNewWo && <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <input placeholder="What needs doing? (e.g. Gate won't open)" value={woTitle} onChange={e => setWoTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createWorkOrder(); }} style={{ ...input, padding: 9 }} />
            <button onClick={createWorkOrder} disabled={!woTitle.trim() || busy} style={{ ...btn, opacity: woTitle.trim() && !busy ? 1 : 0.5 }}>Create</button>
          </div>}
          {woMsg && <p style={{ fontSize: 12, color: woMsg.includes("✓") ? "#248A3D" : "#D70015", marginTop: 8 }}>{woMsg}</p>}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            <div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 6 }}>Public request form — give this link (or a QR of it) to the property manager so they can report issues:</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ fontSize: 11, background: "#EEF4FF", border: "1px solid rgba(0,163,255,0.25)", borderRadius: 8, padding: "5px 9px", wordBreak: "break-all" }}>{`/request/${id}`}</code>
              <button onClick={() => { const url = `${typeof window !== "undefined" ? window.location.origin : ""}/request/${id}`; navigator.clipboard?.writeText(url).then(() => setWoMsg("Request link copied ✓")).catch(() => {}); }} style={{ ...btn2, padding: "5px 12px", fontSize: 12 }}>Copy link</button>
              <a href={`/request/${id}`} target="_blank" rel="noreferrer" style={{ ...btn2, padding: "5px 12px", fontSize: 12, textDecoration: "none" }}>Open</a>
            </div>
          </div>
        </Card>

        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>Details</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {SITE_FIELDS.map(f => <div key={f.key} style={{ gridColumn: f.full ? "1 / -1" : undefined }}>
              <div style={{ color: "#6E6E73", fontSize: 11, marginBottom: 3 }}>{f.label}</div>
              <input value={val(f.key)} onChange={e => setEdit(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...input, padding: 9, fontSize: 13 }} />
            </div>)}
          </div>
          <button onClick={save} disabled={saving} style={{ ...btn, marginTop: 12, background: saved ? "#248A3D" : "#0071E3" }}>{saving ? "Saving…" : saved ? "✓ Saved" : "Save details"}</button>
        </Card>

        {/* Equipment on site */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15 }}>Equipment on site ({assets.length})</h2>
            <button onClick={() => setShowAddEq(s => !s)} style={{ ...btn, padding: "6px 12px" }}>+ Add</button>
          </div>
          {showAddEq && <div style={{ ...card, marginBottom: 10, display: "grid", gap: 8 }}>
            <input placeholder="Equipment name * (e.g. Eagle Eye 4MP Camera)" value={eq.product_name} onChange={e => setEq({ ...eq, product_name: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="Serial #" value={eq.serial_number} onChange={e => setEq({ ...eq, serial_number: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
              <input placeholder="Location (Front Gate)" value={eq.location_note} onChange={e => setEq({ ...eq, location_note: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={eq.status} onChange={e => setEq({ ...eq, status: e.target.value })} style={{ ...sel, flex: 1, padding: 9 }}>{["active", "offline", "retired"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select>
              <button onClick={addEquipment} disabled={!eq.product_name.trim() || busy} style={{ ...btn, opacity: eq.product_name.trim() && !busy ? 1 : 0.5 }}>{busy ? "Adding…" : "Add equipment"}</button>
            </div>
          </div>}
          {assets.length === 0 ? <Small>No equipment logged at this site yet.</Small> : assets.map((a, i) => <div key={a.id || i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 0", borderBottom: i < assets.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none" }}>
            <div style={{ fontSize: 14 }}>{a.product_name || a.name || a.device_type || "Equipment"}{a.serial_number ? <span style={{ color: "#8E8E93", fontSize: 12 }}> · {a.serial_number}</span> : ""}{a.location_note ? <span style={{ color: "#3A3A3C", fontSize: 12 }}> · {a.location_note}</span> : ""}</div>
            {a.status && <Badge tone={a.status === "offline" ? "urgent" : "good"}>{a.status}</Badge>}
          </div>)}
        </Card>

        {/* As-builts & photos */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15 }}>As-builts & photos ({photos.length})</h2>
            <label style={{ ...btn, padding: "6px 12px", display: "inline-block" }}>{uploading ? "Uploading…" : "+ Upload"}
              <input type="file" accept="image/*,application/pdf,.pdf,.dwg,.png,.jpg,.jpeg,.webp" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ""; }} />
            </label>
          </div>
          {uploadErr && <div style={{ marginBottom: 8, fontSize: 12, color: "#D70015", background: "#FFECEC", border: "1px solid rgba(255,77,77,0.3)", borderRadius: 8, padding: "8px 10px" }}>Upload failed: {uploadErr}</div>}
          {photos.length === 0 ? <Small>No drawings or photos yet. Upload an as-built or site photo (image or PDF).</Small> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 8 }}>
            {photos.map((p, i) => { const isImg = /\.(png|jpe?g|webp|gif)(\?|$)/i.test(String(p.description || "")); return (
              <a key={p.id || i} href={p.description} target="_blank" rel="noreferrer" title={p.title} style={{ display: "block", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
                {isImg
                  ? <img src={p.description} alt={p.title || "Site photo"} style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} />
                  : <div style={{ width: "100%", height: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, background: "#F5F5F7", color: "#6E6E73", fontSize: 11, padding: 6, textAlign: "center" }}><span style={{ fontSize: 20 }}>📄</span><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{p.title || "Document"}</span></div>}
              </a>
            ); })}
          </div>}
        </Card>

        {/* Planned service */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Planned service</h2>
          {pm.length === 0 && upcomingWos.length === 0 ? <Small>Nothing scheduled. Set up recurring service in the PM tab.</Small> : <>
            {pm.map((s, i) => <p key={s.id || i} style={{ display: "flex", alignItems: "center", gap: 6, margin: "5px 0", fontSize: 14 }}><RotateCcw size={13} style={{ flexShrink: 0, opacity: 0.7 }} /> {s.title} <span style={{ color: "#6E6E73" }}>· every {s.interval_days}d{s.next_due_at ? ` · next ${String(s.next_due_at).slice(0, 10)}` : ""}</span></p>)}
            {upcomingWos.map((w, i) => <p key={w.id || i} style={{ margin: "5px 0", fontSize: 14 }}>{w.wo_number || w.title || "WO"} <span style={{ color: "#6E6E73" }}>· {w.status}{w.scheduled_date ? ` · ${String(w.scheduled_date).slice(0, 10)}` : ""}</span></p>)}
          </>}
        </Card>

        {/* Service history — past work orders */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Service history ({pastWos.length})</h2>
          {pastWos.length === 0 ? <Small>No completed work orders yet.</Small> : pastWos.slice(0, 12).map((w, i) => <p key={w.id || i} style={{ margin: "5px 0", fontSize: 14 }}>{w.wo_number || w.title || "WO"} <span style={{ color: "#6E6E73" }}>· {w.completed_at ? String(w.completed_at).slice(0, 10) : w.status}</span></p>)}
        </Card>

        {/* Site notes & history (events) */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Site activity — notes & history</h2>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input placeholder="Add a note about this site…" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(); }} style={{ ...input, padding: 9, fontSize: 13 }} />
            <button onClick={addNote} disabled={!note.trim() || busy} style={{ ...btn, opacity: note.trim() && !busy ? 1 : 0.5 }}>Add</button>
          </div>
          {noteEvents.length === 0 ? <Small>No notes or activity yet.</Small> : noteEvents.slice(0, 20).map((e, i) => <div key={e.id || i} style={{ padding: "6px 0", borderBottom: i < Math.min(noteEvents.length, 20) - 1 ? "1px solid rgba(0,0,0,0.08)" : "none" }}>
            <div style={{ fontSize: 13 }}>{e.description || e.summary || e.title || e.event_type}</div>
            <div style={{ fontSize: 11, color: "#8E8E93" }}>{e.event_type}{e.created_at ? ` · ${String(e.created_at).slice(0, 10)}` : ""}</div>
          </div>)}
        </Card>

        {/* One tabbed panel: Security · Doors · Relays · Network · (Setup, corporate) */}
        <SiteSystems siteId={id} isCorporate={isCorporate} initialTab={systemsTab} headerTheme="light" />

        {/* Unified activity timeline (#59) */}
        <ActivityTimeline entity="site" id={id} title="Site activity" />
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
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", brand: "", sku: "", category: "", sell_price: "", manual_url: "", image_url: "" });
  // Part-Finder: web lookup -> proposed product the user confirms
  const [findQ, setFindQ] = useState("");
  const [finding, setFinding] = useState(false);
  const [findMsg, setFindMsg] = useState<string | null>(null);
  async function findProduct() {
    const v = findQ.trim();
    if (!v || finding) return;
    setFinding(true); setFindMsg(null); setMsg(null);
    const isUrl = /^https?:\/\//i.test(v);
    const r = await fetch("/api/products/find", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isUrl ? { url: v } : { query: v }) }).then(x => x.json()).catch(() => null);
    setFinding(false);
    if (r && r.proposed && r.proposed.name) {
      const p = r.proposed;
      setForm({
        name: p.name || "", brand: p.brand || "", sku: p.sku || p.model || "",
        category: p.category || "", sell_price: "",
        manual_url: p.manual_url || "", image_url: p.image_url || "",
      });
      setShowNew(true);
      setFindMsg(`Found: ${p.name}${p.manual_url ? " — manual linked ✓" : " — no manual found, paste one if you have it"}. Review the fields below and tap Add.`);
    } else {
      setFindMsg((r && r.error) || "Couldn't find that product. Paste the product page URL, or fill it in manually below.");
    }
  }
  // AI manual coverage: product_id -> { chunks, figures }
  const [coverage, setCoverage] = useState<Record<string, { chunks: number; figures: number }>>({});
  const [ingestState, setIngestState] = useState<Record<string, "queued" | "error">>({});
  const loadCoverage = React.useCallback(() => { fetch("/api/kb/coverage").then(r => r.json()).then(d => setCoverage(d.coverage ?? {})).catch(() => {}); }, []);
  const load = React.useCallback(() => { setLoading(true); fetch("/api/products?limit=80").then(r => r.json()).then(d => setParts(d.products ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); loadCoverage(); }, [load, loadCoverage]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function vectorize(p: any) {
    if (!p?.id) return;
    setIngestState(s => ({ ...s, [p.id]: "queued" }));
    const r = await fetch("/api/kb/ingest-manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: p.id }) }).catch(() => null);
    if (!r || !r.ok) setIngestState(s => ({ ...s, [p.id]: "error" }));
  }
  async function create() {
    if (!form.name.trim() || busy) return; setBusy(true); setMsg(null);
    const body: Record<string, unknown> = { name: form.name.trim(), brand: form.brand.trim() || null, sku: form.sku.trim() || null, category: form.category.trim() || null, manual_url: form.manual_url.trim() || null, image_url: form.image_url.trim() || null };
    if (form.sell_price && !isNaN(Number(form.sell_price))) body.sell_price = Number(form.sell_price);
    const r = await fetch("/api/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(false);
    if (r && r.ok) { setForm({ name: "", brand: "", sku: "", category: "", sell_price: "", manual_url: "", image_url: "" }); setShowNew(false); setMsg(form.manual_url.trim() ? "Added ✓ — run the manual ingest to vectorize its manual + figures." : "Product added ✓"); load(); }
    else setMsg("Couldn't add the product.");
  }
  // Upload a manual PDF to storage and return its public URL (no binary through Vercel).
  const [mUploading, setMUploading] = useState<string | null>(null);
  async function uploadManual(productId: string, file: File): Promise<string | null> {
    const up = await fetch("/api/kb/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_id: productId, filename: file.name }) }).then(r => r.json()).catch(() => null);
    if (!up?.signedUrl) return null;
    const put = await fetch(up.signedUrl, { method: "PUT", body: file, headers: { "Content-Type": "application/pdf" } }).catch(() => null);
    return put && put.ok ? (up.publicUrl ?? null) : null;
  }
  // Attach a manual to an existing product, then auto-vectorize.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function attachManualToProduct(p: any, file: File) {
    setMUploading(p.id); setMsg(null);
    const url = await uploadManual(p.id, file);
    if (url) { await fetch("/api/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, manual_url: url }) }).catch(() => {}); setMsg(`Manual attached to ${p.name} ✓ — vectorizing now.`); load(); loadCoverage(); }
    else setMsg("Upload failed — try a smaller PDF or paste the URL.");
    setMUploading(null);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cost = (p: any) => num(p.dealer_cost ?? p.unit_cost ?? p.cost);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const price = (p: any) => num(p.sell_price ?? p.unit_price ?? p.price ?? p.list_price);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onHand = (p: any) => p.on_hand ?? p.qty_on_hand ?? p.stock ?? null;
  const shown = parts.filter(p => !q || `${p.name ?? ""} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  if (loading) return <Card><Small>Loading parts…</Small></Card>;
  return <div style={{ display: "grid", gap: 14 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 16 }}>Add a product</h2>
        <button onClick={() => { setShowNew(s => !s); setMsg(null); }} style={btn}>{showNew ? "Cancel" : "+ Add product"}</button>
      </div>
      {/* Part-Finder: paste a part # / name / product URL and we look it up */}
      <div style={{ ...card, marginTop: 12, display: "grid", gap: 8 }}>
        <Small>🔎 Find it for me — type a part number / name, or paste the product page URL.</Small>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="e.g. LiftMaster CSL24UL  or  https://…/manual.pdf" value={findQ} onChange={e => setFindQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") findProduct(); }} style={{ ...input, flex: 1 }} />
          <button onClick={findProduct} disabled={!findQ.trim() || finding} style={{ ...btn, opacity: findQ.trim() && !finding ? 1 : 0.5 }}>{finding ? "Looking…" : "Look it up"}</button>
        </div>
        {findMsg && <p style={{ fontSize: 12, color: findMsg.startsWith("Found") ? "#248A3D" : "#B25000", margin: 0 }}>{findMsg}</p>}
      </div>
      {showNew ? <div style={{ ...card, marginTop: 12, display: "grid", gap: 8 }}>
        <input placeholder="Product name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={input} />
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Brand" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} style={{ ...input, flex: 1 }} />
          <input placeholder="Model / SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} style={{ ...input, flex: 1 }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Category (Camera, Gate…)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ ...input, flex: 1 }} />
          <input placeholder="Sell price $" value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} style={{ ...input, flex: 1 }} />
        </div>
        <input placeholder="Manual PDF URL (or upload below)" value={form.manual_url} onChange={e => setForm({ ...form, manual_url: e.target.value })} style={input} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#0071E3", cursor: "pointer", background: "#EEF4FF", border: "1px dashed rgba(0,163,255,0.4)", borderRadius: 10, padding: "8px 12px" }}>
          {mUploading === "new" ? "Uploading…" : form.manual_url ? "📎 Manual attached ✓ — replace?" : "📎 Upload a manual PDF from your computer"}
          <input type="file" accept="application/pdf" style={{ display: "none" }} disabled={mUploading === "new"} onChange={async e => { const f = e.target.files?.[0]; if (!f) return; setMUploading("new"); const url = await uploadManual(`intake-${Date.now()}`, f); setMUploading(null); if (url) { setForm(s => ({ ...s, manual_url: url })); setMsg("Manual uploaded ✓ — it'll vectorize after you Add."); } else setMsg("Upload failed — try a smaller PDF or paste a URL."); }} />
        </label>
        <input placeholder="Image URL (optional)" value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} style={input} />
        <button onClick={create} disabled={!form.name.trim() || busy} style={{ ...btn, opacity: form.name.trim() && !busy ? 1 : 0.5 }}>{busy ? "Adding…" : "Add to catalog"}</button>
      </div> : <Small>Name is all you need. Add a manual PDF link and it powers the field tool's AI diagnostics, wiring help, and step images.</Small>}
      {msg && <p style={{ fontSize: 12, color: msg.includes("✓") ? "#248A3D" : "#D70015", marginTop: 8 }}>{msg}</p>}
    </Card>
    <input placeholder="Search parts by name or SKU" value={q} onChange={e => setQ(e.target.value)} style={input} />
    {shown.length === 0 ? <Card><Small>No parts found.</Small></Card> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 14 }}>
      {shown.map(p => {
        const oh = onHand(p);
        const low = oh != null && num(oh) <= 3;
        const cov = coverage[String(p.id)];
        const aiReady = !!cov && cov.chunks > 0;
        const state = ingestState[String(p.id)];
        return <Card key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <a href={`/?tab=catalog&product=${p.id}`} style={{ fontSize: 15, fontWeight: 700, color: "#1D1D1F", textDecoration: "none" }} title="Open the product page">{p.name || "Part"} <span style={{ color: "#0071E3", fontWeight: 500, fontSize: 12.5 }}>Product page →</span></a>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {low && <Badge tone="urgent">Low stock</Badge>}
              {aiReady && <Badge tone="good">AI ready{cov.figures > 0 ? ` · ${cov.figures} 🖼` : ""}</Badge>}
            </div>
          </div>
          {p.sku && <Small>{p.sku}</Small>}
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 13 }}>
            <div><div style={{ color: "#6E6E73", fontSize: 11 }}>Cost</div><b>{cost(p) ? money(cost(p)) : "—"}</b></div>
            <div><div style={{ color: "#6E6E73", fontSize: 11 }}>Price</div><b>{price(p) ? money(price(p)) : "—"}</b></div>
            {oh != null && <div><div style={{ color: "#6E6E73", fontSize: 11 }}>On hand</div><b>{num(oh)}</b></div>}
          </div>
          {/* AI manual intake: vectorize on demand so the field tool gets diagnostics + diagrams */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.08)" }}>
            {!p.manual_url ? (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#0071E3", cursor: "pointer", background: "#EEF4FF", border: "1px dashed rgba(0,163,255,0.4)", borderRadius: 9, padding: "5px 11px" }}>
                {mUploading === p.id ? "Uploading…" : "📎 Add manual PDF"}
                <input type="file" accept="application/pdf" style={{ display: "none" }} disabled={mUploading === p.id} onChange={e => { const f = e.target.files?.[0]; if (f) attachManualToProduct(p, f); }} />
              </label>
            ) : state === "queued" ? (
              <Small>Vectorizing manual… this runs in the background. Refresh in a minute.</Small>
            ) : state === "error" ? (
              <span style={{ fontSize: 12, color: "#D70015" }}>Couldn&apos;t queue — <button onClick={() => vectorize(p)} style={{ ...btn, padding: "2px 8px", fontSize: 12 }}>Retry</button></span>
            ) : (
              <button onClick={() => vectorize(p)} style={{ ...btn, padding: "5px 12px", fontSize: 12 }}>{aiReady ? "Re-vectorize manual" : "Vectorize manual now"}</button>
            )}
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
  // Soonest (and overdue) first.
  const sorted = [...items].sort((a, b) => String(a.next_due_at ?? "9999").localeCompare(String(b.next_due_at ?? "9999")));
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 14 }}>
    {sorted.map(s => <Card key={s.id}>
      <b style={{ fontSize: 15 }}>{s.title || "Schedule"}</b>
      <div style={{ marginTop: 8, fontSize: 13, color: "#6E6E73" }}>
        {s.interval_days ? `Every ${s.interval_days} days` : "—"}
        {s.next_due_at && (String(s.next_due_at).slice(0, 10) < todayKey()
          ? <div style={{ color: "#D70015", fontWeight: 600 }}>Overdue — was due {dayLabel(s.next_due_at)}</div>
          : <div style={{ color: "#6E6E73" }}>Next due: {dayLabel(s.next_due_at)}</div>)}
      </div>
      {s.description && <p style={{ color: "#3A3A3C", fontSize: 12, marginTop: 8 }}>{s.description}</p>}
    </Card>)}
  </div>;
}

/* ── Requests: incoming work requests → convert to a work order ──────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Requests({ onConverted }: { onConverted: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = React.useCallback(() => { setLoading(true); fetch("/api/requests").then(r => r.json()).then(d => setItems(d.requests ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function convert(r: any) {
    if (busyId) return; setBusyId(r.id);
    try {
      const woRes = await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customer_name: r.site_name || "Site", site_id: r.site_id, title: r.title, notes: r.description || r.area || null, priority: r.priority_requested || "normal" }) }).then(x => x.json()).catch(() => null);
      const woId = woRes?.id || woRes?.work_order?.id || woRes?.job?.id || null;
      await fetch("/api/request", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: r.id, status: "converted", converted_wo_id: woId }) }).catch(() => {});
    } catch (_) { /* ignore */ }
    setBusyId(null); load(); onConverted();
  }
  if (loading) return <Card><Small>Loading requests…</Small></Card>;
  if (items.length === 0) return <Card><Small>No open requests. New requests from QR forms or property managers will appear here.</Small></Card>;
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px,1fr))", gap: 14 }}>
    {items.map(r => <Card key={r.id}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
        <b style={{ fontSize: 15 }}>{r.title}</b>
        <Badge tone={["urgent", "high"].includes(String(r.priority_requested)) ? "urgent" : "default"}>{r.priority_requested || "normal"}</Badge>
      </div>
      <Small>{r.site_name || "—"}{r.site_city ? ` · ${r.site_city}, ${r.site_state}` : ""}{r.area ? ` · ${r.area}` : ""}</Small>
      {r.description && <p style={{ color: "#6E6E73", fontSize: 13, margin: "8px 0 0" }}>{r.description}</p>}
      {(r.contact_name || r.contact_phone) && <p style={{ color: "#3A3A3C", fontSize: 12, margin: "6px 0 0" }}>From: {r.contact_name || "—"}{r.contact_phone ? ` · ${r.contact_phone}` : ""}</p>}
      <button onClick={() => convert(r)} disabled={busyId === r.id} style={{ ...btn, marginTop: 12, opacity: busyId === r.id ? 0.6 : 1 }}>{busyId === r.id ? "Converting…" : "Convert to work order →"}</button>
    </Card>)}
  </div>;
}

/* ── Procurement: purchase orders to suppliers (real /api/purchase-orders) ─ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Procurement() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pos, setPos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ supplier: "", po_number: "", notes: "" });
  const [lines, setLines] = useState<{ name: string; qty: string; unit_cost: string }[]>([{ name: "", qty: "1", unit_cost: "" }]);
  const load = React.useCallback(() => { setLoading(true); fetch("/api/purchase-orders").then(r => r.json()).then(d => setPos(d.records ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  const linesTotal = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0), 0);
  async function create() {
    if (!form.supplier.trim() || busy) return; setBusy(true);
    const items = lines.filter(l => l.name.trim()).map(l => ({ name: l.name.trim(), qty: Number(l.qty) || 1, unit_cost: Number(l.unit_cost) || 0 }));
    await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ supplier: form.supplier.trim(), po_number: form.po_number.trim() || null, notes: form.notes.trim() || null, items }) }).catch(() => {});
    setForm({ supplier: "", po_number: "", notes: "" }); setLines([{ name: "", qty: "1", unit_cost: "" }]); setShowNew(false); setBusy(false); load();
  }
  async function setStatus(id: string, status: string) { await fetch(`/api/purchase-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {}); load(); }
  const poTone = (s: string) => s === "received" || s === "closed" ? "good" : s === "draft" ? "default" : "high";
  return <div style={{ display: "grid", gap: 14 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 16 }}>Purchase orders</h2>
        <button onClick={() => setShowNew(s => !s)} style={btn}>+ New PO</button>
      </div>
      {showNew && <div style={{ ...card, marginTop: 12, display: "grid", gap: 8 }}>
        <input placeholder="Supplier *" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} style={input} />
        <input placeholder="PO number (optional)" value={form.po_number} onChange={e => setForm({ ...form, po_number: e.target.value })} style={input} />
        <div style={{ color: "#6E6E73", fontSize: 11 }}>Line items</div>
        {lines.map((l, i) => <div key={i} style={{ display: "flex", gap: 6 }}>
          <input placeholder="Item" value={l.name} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} style={{ ...input, padding: 9, fontSize: 13, flex: 2 }} />
          <input type="number" placeholder="Qty" value={l.qty} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} style={{ ...input, padding: 9, fontSize: 13, width: 64 }} />
          <input type="number" placeholder="$ ea" value={l.unit_cost} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, unit_cost: e.target.value } : x))} style={{ ...input, padding: 9, fontSize: 13, width: 80 }} />
          {lines.length > 1 && <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} style={{ ...btn2, color: "#D70015", padding: "0 10px" }}>×</button>}
        </div>)}
        <button onClick={() => setLines(ls => [...ls, { name: "", qty: "1", unit_cost: "" }])} style={{ ...btn2, justifySelf: "start", padding: "6px 12px" }}>+ Add line</button>
        <input placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={input} />
        <button onClick={create} disabled={!form.supplier.trim() || busy} style={{ ...btn, opacity: form.supplier.trim() && !busy ? 1 : 0.5 }}>{busy ? "Creating…" : `Create PO · ${money(linesTotal)}`}</button>
      </div>}
    </Card>
    {loading ? <Card><Small>Loading…</Small></Card> : pos.length === 0 ? <Card><Small>No purchase orders yet.</Small></Card> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 14 }}>
        {pos.map(p => <Card key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{p.supplier || "Supplier"}</b>
            <Badge tone={poTone(p.status)}>{p.status}</Badge>
          </div>
          <Small>{p.po_number ? `PO ${p.po_number}` : "No PO #"}{p.expected_at ? ` · expected ${String(p.expected_at).slice(0, 10)}` : ""}</Small>
          <div style={{ fontSize: 22, fontWeight: 600, color: "#0071E3", margin: "8px 0 0" }}>{money(num(p.total))}</div>
          {(p.purchase_order_items ?? []).length > 0 && <div style={{ marginTop: 8 }}>{(p.purchase_order_items ?? []).slice(0, 6).map((it: { id?: string; name?: string; description?: string; qty?: number; unit_cost?: number }, i: number) => <p key={it.id || i} style={{ margin: "3px 0", fontSize: 13, color: "#6E6E73" }}>{it.name || it.description || "Item"} × {num(it.qty)}{it.unit_cost ? ` · ${money(num(it.unit_cost))}` : ""}</p>)}</div>}
          {p.notes && <p style={{ color: "#3A3A3C", fontSize: 12, marginTop: 8 }}>{p.notes}</p>}
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {p.status === "draft" && <button onClick={() => setStatus(p.id, "ordered")} style={{ ...btn, padding: "6px 12px" }}>Mark ordered</button>}
            {p.status === "ordered" && <button onClick={() => setStatus(p.id, "received")} style={{ ...btn, padding: "6px 12px", background: "#248A3D" }}>Mark received ✓</button>}
            {p.status !== "received" && p.status !== "cancelled" && <button onClick={() => setStatus(p.id, "cancelled")} style={{ ...btn2, padding: "6px 12px", color: "#D70015" }}>Cancel</button>}
          </div>
        </Card>)}
      </div>}
  </div>;
}

/* ── Playbooks: reusable step templates (global + org), assignable to WOs ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Playbooks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", description: "", stepsText: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [eForm, setEForm] = useState({ title: "", category: "", stepsText: "" });
  const load = React.useCallback(() => { setLoading(true); fetch("/api/playbooks").then(r => r.json()).then(d => setItems(d.playbooks ?? [])).catch(() => {}).finally(() => setLoading(false)); }, []);
  useEffect(() => { load(); }, [load]);
  async function create() {
    const steps = form.stepsText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!form.title.trim() || steps.length === 0 || busy) return; setBusy(true);
    await fetch("/api/playbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.title.trim(), category: form.category.trim() || null, description: form.description.trim() || null, steps }) }).catch(() => {});
    setForm({ title: "", category: "", description: "", stepsText: "" }); setShowNew(false); setBusy(false); load();
  }
  async function remove(id: string) { await fetch(`/api/playbooks/${id}`, { method: "DELETE" }).catch(() => {}); load(); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function startEdit(p: any) { setEditId(p.id); setEForm({ title: p.title ?? "", category: p.category ?? "", stepsText: (p.steps ?? []).map((s: unknown) => typeof s === "string" ? s : (s as { title?: string })?.title).filter(Boolean).join("\n") }); }
  async function saveEdit(id: string) {
    const steps = eForm.stepsText.split("\n").map(s => s.trim()).filter(Boolean);
    if (!eForm.title.trim() || busy) return; setBusy(true);
    await fetch(`/api/playbooks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: eForm.title.trim(), category: eForm.category.trim() || null, steps }) }).catch(() => {});
    setEditId(null); setBusy(false); load();
  }
  return <div style={{ display: "grid", gap: 14 }}>
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <h2 style={{ fontSize: 16 }}>Playbooks</h2>
        <button onClick={() => setShowNew(s => !s)} style={btn}>+ New playbook</button>
      </div>
      <Small>Build a reusable list of steps once, then assign it to any work order in one tap. Global playbooks are shared by GateGuard; yours are private to your team.</Small>
      {showNew && <div style={{ ...card, marginTop: 12, display: "grid", gap: 8 }}>
        <input placeholder="Playbook name * (e.g. Quarterly Gate PM)" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={input} />
        <input placeholder="Category (Gate, Camera, Access Control…)" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={input} />
        <input placeholder="Short description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={input} />
        <textarea placeholder={"Steps — one per line:\nPower off at disconnect\nInspect chain tension\nTest safety loops"} value={form.stepsText} onChange={e => setForm({ ...form, stepsText: e.target.value })} rows={6} style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
        <button onClick={create} disabled={!form.title.trim() || !form.stepsText.trim() || busy} style={{ ...btn, opacity: form.title.trim() && form.stepsText.trim() && !busy ? 1 : 0.5 }}>{busy ? "Saving…" : "Save playbook"}</button>
      </div>}
    </Card>
    {loading ? <Card><Small>Loading…</Small></Card> : items.length === 0 ? <Card><Small>No playbooks yet. Tap “+ New playbook”.</Small></Card> :
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px,1fr))", gap: 14 }}>
        {items.map(p => <Card key={p.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <b style={{ fontSize: 15 }}>{p.title}</b>
            {p.org_id ? <Badge>Yours</Badge> : <Badge tone="good">Global</Badge>}
          </div>
          {p.category && <Small>{p.category}</Small>}
          {editId === p.id ? <div style={{ ...card, marginTop: 10, display: "grid", gap: 8 }}>
            <input placeholder="Name" value={eForm.title} onChange={e => setEForm({ ...eForm, title: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} />
            <input placeholder="Category" value={eForm.category} onChange={e => setEForm({ ...eForm, category: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} />
            <textarea value={eForm.stepsText} onChange={e => setEForm({ ...eForm, stepsText: e.target.value })} rows={6} style={{ ...input, padding: 9, fontSize: 13, resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveEdit(p.id)} disabled={busy} style={{ ...btn, flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
              <button onClick={() => setEditId(null)} style={{ ...btn2 }}>Cancel</button>
            </div>
          </div> : <>
            <ol style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13, color: "#3A3A3C" }}>
              {(p.steps ?? []).slice(0, 8).map((s: unknown, i: number) => <li key={i} style={{ margin: "3px 0" }}>{typeof s === "string" ? s : (s as { title?: string })?.title}</li>)}
            </ol>
            {p.org_id && <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button onClick={() => startEdit(p)} style={{ ...btn2, padding: "5px 12px", fontSize: 12 }}>Edit</button>
              <button onClick={() => remove(p.id)} style={{ ...btn2, color: "#D70015", border: "1px solid rgba(255,80,80,0.3)", padding: "5px 10px", fontSize: 12 }}>Delete</button>
            </div>}
          </>}
        </Card>)}
      </div>}
  </div>;
}

/* ── Job drawer: detail + money + checklist + parts + team chat + complete ─ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// Customer sign-off pad (touch or mouse). Saves a PNG.
function SignOffPad({ onSave, onCancel, busy }: { onSave: (dataUrl: string) => void; onCancel: () => void; busy?: boolean }) {
  const ref = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const [dirty, setDirty] = useState(false);
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => { const c = ref.current!; const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) }; };
  const clear = () => { const c = ref.current; if (!c) return; const ctx = c.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); setDirty(false); };
  useEffect(() => { clear(); }, []);
  return <div>
    <canvas ref={ref} width={640} height={200} aria-label="Sign here"
      onPointerDown={e => { drawing.current = true; const ctx = ref.current!.getContext("2d")!; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (!drawing.current) return; const ctx = ref.current!.getContext("2d")!; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.strokeStyle = "#1D1D1F"; ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.stroke(); setDirty(true); }}
      onPointerUp={() => { drawing.current = false; }} onPointerLeave={() => { drawing.current = false; }}
      style={{ width: "100%", height: 160, borderRadius: 12, background: "#fff", touchAction: "none", border: "1px dashed rgba(0,0,0,0.25)", display: "block" }} />
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <button type="button" disabled={!dirty || busy} onClick={() => onSave(ref.current!.toDataURL("image/png"))} style={{ ...btn, flex: 1, opacity: !dirty || busy ? 0.55 : 1 }}>{busy ? "Saving…" : "Save signature"}</button>
      <button type="button" onClick={clear} style={btn2}>Clear</button>
      <button type="button" onClick={onCancel} style={btn2}>Cancel</button>
    </div>
  </div>;
}

// The job page. Opened from the Operations Hub and from the Operations page
// (JobsSurface). Full-screen, light look, every feature of the old drawer kept.
export function JobDetailDrawer({ id, techs: techsProp, onClose, onUpdate: onUpdateProp }: { id: string; techs?: RealTech[]; onClose: () => void; onUpdate?: (id: string, patch: Record<string, unknown>) => void | Promise<void> }) {
  // Self-sufficient when opened outside the Hub: load the tech list and save
  // changes directly (and say so when a change doesn't save).
  const [techsOwn, setTechsOwn] = useState<RealTech[]>([]);
  useEffect(() => { if (!techsProp?.length) fetch("/api/dispatch").then(r => r.json()).then(d => setTechsOwn(d.techs ?? [])).catch(() => {}); }, [techsProp]);
  const techs = techsProp?.length ? techsProp : techsOwn;
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const onUpdate = async (wid: string, patch: Record<string, unknown>) => {
    setSaveErr(null);
    if (onUpdateProp) { await onUpdateProp(wid, patch); return; }
    try {
      const r = await fetch(`/api/maintenance/${wid}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) setSaveErr("That change didn’t save. Try again.");
    } catch { setSaveErr("That change didn’t save. Try again."); }
  };
  // Linked tasks, files and follow-up work orders (from the job window feed).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [extra, setExtra] = useState<{ tasks: any[]; files: any[]; subs: any[] }>({ tasks: [], files: [], subs: [] });
  const [taskForm, setTaskForm] = useState({ title: "", due: "" });
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraMsg, setExtraMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  // Job timer (clock in / out) and customer sign-off.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeEntry, setActiveEntry] = useState<any>(null);
  const [timerBusy, setTimerBusy] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [showSign, setShowSign] = useState(false);
  const [signBusy, setSignBusy] = useState(false);
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
  // Steps grouped by phase. `addOpen` is the id of the group whose "Add step"
  // form is open (PHASE_OTHER for ungrouped) — only one is open at a time so the
  // next action is always obvious. `stepErr` surfaces write failures instead of
  // swallowing them: a tick that silently doesn't save is worse than an error.
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({ title: "", detail: "" });
  const [newPhaseName, setNewPhaseName] = useState("");
  const [stepErr, setStepErr] = useState<{ msg: string; detail?: string } | null>(null);
  const [stepBusy, setStepBusy] = useState(false);
  const [chat, setChat] = useState("");
  // site + equipment pull-through, manuals, playbooks, AI support
  const [siteId, setSiteId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [siteEquip, setSiteEquip] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [siteHistory, setSiteHistory] = useState<any[]>([]);
  const [manualMap, setManualMap] = useState<Record<string, string>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [playbooks, setPlaybooks] = useState<any[]>([]);
  const [aiQ, setAiQ] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiStep, setAiStep] = useState<any>(null);
  const [aiBusy, setAiBusy] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [photos, setPhotos] = useState<any[]>([]);
  const [woUploading, setWoUploading] = useState(false);
  const [showAddPart, setShowAddPart] = useState(false);
  const [pForm, setPForm] = useState({ name: "", qty: "1", unit_cost: "", unit_price: "" });
  const [laborH, setLaborH] = useState("");
  const [partBusy, setPartBusy] = useState(false);
  // Purchase orders raised for this job + the id of the part currently saving.
  // `partErr` surfaces a failed status change in plain English — a dropdown that
  // silently snaps back is how a tech drives out without his parts.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [jobPos, setJobPos] = useState<any[]>([]);
  const [partSaving, setPartSaving] = useState<string | null>(null);
  const [partErr, setPartErr] = useState<{ msg: string; detail?: string } | null>(null);
  const [showAddEq, setShowAddEq] = useState(false);
  const [eqForm, setEqForm] = useState({ product_name: "", serial_number: "", location_note: "" });
  const [eqBusy, setEqBusy] = useState(false);
  const [notifyOnChange, setNotifyOnChange] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [crew, setCrew] = useState<any[]>([]);     // additional assigned techs (multi-resource)
  const [crewPick, setCrewPick] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [phases, setPhases] = useState<any[]>([]); // visits / phases
  const [phaseForm, setPhaseForm] = useState({ name: "", scheduled_date: "" });
  const [costPhase, setCostPhase] = useState(""); // which visit new labor/parts attach to ("" = whole job)
  const [tab, setTab] = useState<"Overview" | "Scope" | "Execution" | "Activity">("Overview");
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsMsg, setSmsMsg] = useState<string | null>(null);
  const [eta, setEta] = useState("");
  const [invBusy, setInvBusy] = useState(false);
  // silent=true refreshes data in the background without flashing the whole panel
  // to "Loading…" — used after every in-drawer action so it doesn't blink/jump.
  const load = React.useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      fetch(`/api/maintenance/${id}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/time`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/photos`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/crew`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/phases`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/maintenance/${id}/parts`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/purchase-orders?work_order_id=${id}`).then(r => r.json()).catch(() => ({})),
      fetch(`/api/nexus/jobs/job-window/${id}`).then(r => r.json()).catch(() => ({})),
    ]).then(([d, t, ph, cr, vs, pp, pos, jw]) => {
      setExtra({ tasks: jw?.tasks ?? [], files: jw?.files ?? [], subs: jw?.subWorkOrders ?? [] });
      setWo(d.work_order ?? null);
      // Prefer the procurement-aware parts feed (same rows, plus each part's PO
      // number / supplier). Fall back to the plain list on the detail payload so
      // parts still show if that call fails.
      setParts(Array.isArray(pp?.parts) ? pp.parts : (d.parts_used ?? []));
      setJobPos(Array.isArray(pos?.records) ? pos.records : []);
      setChecklist(d.checklist ?? []); setComments(d.comments ?? []);
      setLaborMins(t.totalMins ?? 0); setActiveEntry(t.activeEntry ?? null); setSiteId(d.work_order?.site_id ?? null);
      setPhotos(ph.photos ?? []); setCrew(cr.crew ?? []); setPhases(vs.phases ?? []);
    }).finally(() => { if (!silent) setLoading(false); });
  }, [id]);
  useEffect(() => { load(); }, [load]);
  // manual links + playbook templates (load once)
  useEffect(() => {
    fetch(`/api/products?limit=300`).then(r => r.json()).then(d => {
      const m: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d.products ?? []).forEach((p: any) => { if (p.manual_url) { if (p.id) m[String(p.id)] = p.manual_url; if (p.name) m[String(p.name).toLowerCase()] = p.manual_url; } });
      setManualMap(m);
    }).catch(() => {});
    fetch(`/api/playbooks`).then(r => r.json()).then(d => setPlaybooks(d.playbooks ?? [])).catch(() => {});
  }, []);
  // equipment on the linked site + that site's service history
  const loadEquip = React.useCallback(() => {
    if (!siteId) { setSiteEquip([]); setSiteHistory([]); return; }
    fetch(`/api/sites/${siteId}`).then(r => r.json()).then(d => { setSiteEquip(d.assets ?? []); setSiteHistory((d.work_orders ?? []).filter((w: { id: string }) => w.id !== id)); }).catch(() => {});
  }, [siteId, id]);
  useEffect(() => { loadEquip(); }, [loadEquip]);
  async function addEquipment() {
    if (!siteId || !eqForm.product_name.trim() || eqBusy) return;
    setEqBusy(true);
    await fetch(`/api/sites/${siteId}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ product_name: eqForm.product_name.trim(), serial_number: eqForm.serial_number.trim() || null, location_note: eqForm.location_note.trim() || null, status: "online" }) }).catch(() => {});
    setEqBusy(false); setEqForm({ product_name: "", serial_number: "", location_note: "" }); setShowAddEq(false); loadEquip();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manualFor = (a: any) => manualMap[String(a.product_id)] || manualMap[String(a.product_name || a.name || "").toLowerCase()] || null;

  const partsCost = parts.reduce((s, p) => s + num(p.unit_cost) * num(p.qty), 0);
  const partsRev = parts.reduce((s, p) => s + num(p.unit_price) * num(p.qty), 0);
  const margin = partsRev - partsCost;
  const marginPct = partsRev > 0 ? Math.round((margin / partsRev) * 100) : 0;
  // "3 of 7 parts are here. 2 shipped, 2 not ordered yet." — the one line a tech
  // reads before he decides whether it's worth driving out.
  const partsHere = parts.filter(p => supplyHere(p.supply_status)).length;
  const partsPending = SUPPLY_ORDER
    .filter(s => SUPPLY_PENDING_PHRASE[s])
    .map(s => ({ s, n: parts.filter(p => supplyOf(p.supply_status) === s).length }))
    .filter(x => x.n > 0)
    .map(x => `${x.n} ${SUPPLY_PENDING_PHRASE[x.s]}`);
  const partsSummary = parts.length === 0 ? ""
    : `${partsHere} of ${parts.length} ${parts.length === 1 ? "part is" : "parts are"} here.`
      + (partsPending.length ? ` ${partsPending.join(", ")}.` : "");
  const doneCount = checklist.filter(c => c.is_complete || c.completed || c.done).length;
  const allStepsDone = checklist.length > 0 && doneCount === checklist.length;
  const hasPhoto = photos.length > 0;
  const canComplete = allStepsDone && hasPhoto;
  const completeBlockReason = !allStepsDone ? (checklist.length === 0 ? "Add at least one step, then check it off" : `Finish all steps (${doneCount}/${checklist.length})`) : !hasPhoto ? "Add at least one photo as proof" : "";
  const patchField = (p: Record<string, unknown>) => { onUpdate(id, { ...p, send_notifications: notifyOnChange }); setWo((w: typeof wo) => w ? { ...w, ...p } : w); };

  // Every step/phase write goes through here. Returns false AND shows a plain
  // message on failure — nothing is swallowed. The raw server text is kept in a
  // muted "Details" line so the user reads English, not Postgres.
  async function stepReq(url: string, init: RequestInit, friendly: string): Promise<boolean> {
    try {
      const r = await fetch(url, init);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d: any = await r.json().catch(() => ({}));
      if (!r.ok || d?.error) { setStepErr({ msg: friendly, detail: d?.error ? String(d.error) : `Server said ${r.status}.` }); return false; }
      setStepErr(null); return true;
    } catch { setStepErr({ msg: friendly, detail: "Couldn't reach the server." }); return false; }
  }
  // Steps belonging to one phase (null = ungrouped), in their saved order.
  const stepsIn = (phaseId: string | null) =>
    checklist.filter(c => (c.phase_id ?? null) === phaseId).sort((a, b) => num(a.sort_order) - num(b.sort_order));
  // Add a step inside a phase. `category` is deliberately NOT set — it's a
  // CHECK-constrained badge enum ('task'|'safety'|…), never the group name.
  async function addStep(phaseId: string | null) {
    const title = stepForm.title.trim(); if (!title || stepBusy) return;
    setStepBusy(true);
    const sort_order = stepsIn(phaseId).reduce((m, c) => Math.max(m, num(c.sort_order)), -1) + 1;
    const ok = await stepReq(`/api/maintenance/${id}/checklist`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notes: stepForm.detail.trim() || null, phase_id: phaseId, sort_order }),
    }, "Couldn't add that step.");
    setStepBusy(false);
    if (ok) { setStepForm({ title: "", detail: "" }); setAddOpen(null); load(true); }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function toggleChecklist(item: any) {
    const next = !(item.is_complete || item.completed || item.done);
    // Optimistic flip so the box ticks instantly, then persist + reload. If the
    // save fails, load(true) puts the box back where it really is.
    setChecklist(cs => cs.map(c => c.id === item.id ? { ...c, completed: next, is_complete: next } : c));
    await stepReq(`/api/maintenance/${id}/checklist`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: item.id, completed: next }) }, "Couldn't save that step.");
    load(true);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function removeChecklist(item: any) {
    setChecklist(cs => cs.filter(c => c.id !== item.id));
    await stepReq(`/api/maintenance/${id}/checklist`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: item.id }) }, "Couldn't remove that step.");
    load(true);
  }
  // Reorder a step within its own phase. Reassigns sequential sort_order across
  // the whole group rather than swapping two values — older rows were all saved
  // with sort_order 0, and swapping equal numbers would move nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function moveStep(group: any[], idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= group.length) return;
    const next = [...group];
    [next[idx], next[j]] = [next[j], next[idx]];
    const order = new Map<string, number>(next.map((c, i) => [String(c.id), i]));
    setChecklist(cs => cs.map(c => order.has(String(c.id)) ? { ...c, sort_order: order.get(String(c.id)) } : c)); // optimistic
    await Promise.all(next.map((c, i) => stepReq(`/api/maintenance/${id}/checklist`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: c.id, sort_order: i }) }, "Couldn't reorder the steps.")));
    load(true);
  }
  // Add a phase by name (preset button or typed). Skips exact duplicates.
  async function addPhaseNamed(name: string) {
    const n = name.trim(); if (!n || stepBusy) return;
    if (phases.some(p => String(p.name).trim().toLowerCase() === n.toLowerCase())) { setNewPhaseName(""); return; }
    setStepBusy(true);
    const ok = await stepReq(`/api/maintenance/${id}/phases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: n }) }, "Couldn't add that phase.");
    setStepBusy(false);
    if (ok) { setNewPhaseName(""); load(true); }
  }
  // Delete a phase. Its steps survive — phase_id goes null (ON DELETE SET NULL)
  // and they drop into "Other steps".
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function deletePhase(p: any) {
    if (!window.confirm(`Delete the phase "${p.name}"?\n\nIts steps are kept and moved to "Other steps".`)) return;
    const ok = await stepReq(`/api/maintenance/${id}/phases/${p.id}`, { method: "DELETE" }, "Couldn't delete that phase.");
    if (ok) { if (costPhase === p.id) setCostPhase(""); load(true); }
  }
  // Move a phase up/down. The phases API PATCH passes the body straight through,
  // so sort_order is persisted the same way the list is read back (order by sort_order).
  async function movePhase(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= phases.length) return;
    const next = [...phases];
    [next[idx], next[j]] = [next[j], next[idx]];
    setPhases(next.map((p, i) => ({ ...p, sort_order: i }))); // optimistic
    await Promise.all(next.map((p, i) => stepReq(`/api/maintenance/${id}/phases/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: i }) }, "Couldn't reorder the phases.")));
    load(true);
  }
  async function addComment() {
    const content = chat.trim(); if (!content) return; setChat("");
    await fetch(`/api/maintenance/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }).catch(() => {});
    load(true);
  }
  async function askAI() {
    const symptom = aiQ.trim(); if (!symptom || aiBusy) return; setAiBusy(true); setAiStep(null);
    try {
      const r = await fetch(`/api/kb/ask`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symptom, connected_devices: siteEquip.map(a => a.product_name || a.name).filter(Boolean) }) });
      const d = await r.json(); if (d.error) throw new Error(d.error); setAiStep(d);
    } catch (e) { setAiStep({ text: e instanceof Error ? e.message : "Couldn't reach AI support.", type: "escalate" }); }
    setAiBusy(false);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function assignPlaybook(pb: any) {
    if (!pb) return;
    const steps: string[] = (pb.steps ?? []).map((s: unknown) => typeof s === "string" ? s : ((s as { title?: string; text?: string })?.title || (s as { text?: string })?.text || "")).filter(Boolean);
    for (const title of steps) await fetch(`/api/maintenance/${id}/checklist`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) }).catch(() => {});
    load(true);
  }
  async function uploadWoPhoto(file: File) {
    if (!file || woUploading) return; setWoUploading(true);
    try {
      const up = await fetch(`/api/maintenance/${id}/photo-upload-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) }).then(r => r.json());
      if (up?.signedUrl) {
        await fetch(up.signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "image/jpeg" }, body: file });
        await fetch(`/api/maintenance/${id}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_url: up.publicUrl, caption: file.name }) }).catch(() => {});
      }
    } catch (_) { /* ignore */ }
    setWoUploading(false); load(true);
  }
  async function addPart() {
    if (!pForm.name.trim() || partBusy) return; setPartBusy(true);
    await fetch(`/api/maintenance/${id}/parts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: pForm.name.trim(), qty: Number(pForm.qty) || 1, unit_cost: pForm.unit_cost ? Number(pForm.unit_cost) : null, unit_price: pForm.unit_price ? Number(pForm.unit_price) : null, phase_id: costPhase || null }) }).catch(() => {});
    setPForm({ name: "", qty: "1", unit_cost: "", unit_price: "" }); setShowAddPart(false); setPartBusy(false); load(true);
  }
  // Update one part's procurement fields. Optimistic so the dropdown answers
  // instantly; on failure the old value is put back and the reason is shown.
  async function patchPart(partId: string, body: Record<string, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = parts.find((p: any) => p.id === partId);
    setPartErr(null); setPartSaving(partId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setParts(ps => ps.map((p: any) => p.id === partId ? { ...p, ...body } : p));
    try {
      const r = await fetch(`/api/maintenance/${id}/parts`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part_id: partId, ...body }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let j: any = {}; try { j = await r.json(); } catch { /* empty body */ }
      if (!r.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (before) setParts(ps => ps.map((p: any) => p.id === partId ? before : p));
        setPartErr({ msg: "That change didn’t save.", detail: j?.error || `Server said ${r.status}.` });
      } else if (j?.part) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setParts(ps => ps.map((p: any) => p.id === partId ? { ...p, ...j.part } : p));
      }
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (before) setParts(ps => ps.map((p: any) => p.id === partId ? before : p));
      setPartErr({ msg: "That change didn’t save — you may be offline.", detail: (e as Error)?.message });
    }
    setPartSaving(null);
  }
  async function logLabor() {
    const h = Number(laborH); if (!h || h <= 0 || partBusy) return; setPartBusy(true);
    await fetch(`/api/maintenance/${id}/time`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours: h, phase_id: costPhase || null }) }).catch(() => {});
    setLaborH(""); setPartBusy(false); load(true);
  }
  async function addCrew(techId: string, role = "crew") {
    if (!techId) return; setCrewPick("");
    await fetch(`/api/maintenance/${id}/crew`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ technician_id: techId, role }) }).catch(() => {});
    load(true);
  }
  async function removeCrew(memberId: string) {
    setCrew(c => c.filter(x => x.id !== memberId));
    await fetch(`/api/maintenance/${id}/crew?member_id=${memberId}`, { method: "DELETE" }).catch(() => {});
    load(true);
  }
  async function addPhase() {
    const name = phaseForm.name.trim(); if (!name) return;
    await fetch(`/api/maintenance/${id}/phases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, scheduled_date: phaseForm.scheduled_date || null }) }).catch(() => {});
    setPhaseForm({ name: "", scheduled_date: "" }); load(true);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function patchPhase(phaseId: string, body: any) {
    setPhases(ps => ps.map(p => p.id === phaseId ? { ...p, ...body } : p)); // optimistic
    await fetch(`/api/maintenance/${id}/phases/${phaseId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
    load(true);
  }
  async function removePhase(phaseId: string) {
    setPhases(ps => ps.filter(p => p.id !== phaseId));
    if (costPhase === phaseId) setCostPhase("");
    await fetch(`/api/maintenance/${id}/phases/${phaseId}`, { method: "DELETE" }).catch(() => {});
    load(true);
  }
  async function jobAction(payload: Record<string, unknown>, okMsg: string): Promise<boolean> {
    setExtraBusy(true); setExtraMsg(null);
    try {
      const r = await fetch(`/api/nexus/jobs/job-window/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.success === false) { setExtraMsg(d?.message || "That didn’t save. Try again."); return false; }
      setExtraMsg(okMsg); load(true); return true;
    } catch { setExtraMsg("That didn’t save. Try again."); return false; }
    finally { setExtraBusy(false); }
  }
  async function addJobTask() {
    if (!taskForm.title.trim()) return;
    if (await jobAction({ action: "create_task", title: taskForm.title.trim(), due_date: taskForm.due }, "Task added.")) setTaskForm({ title: "", due: "" });
  }
  async function uploadJobFile(file: File) {
    setExtraBusy(true); setExtraMsg(null);
    try {
      const u = await fetch(`/api/nexus/jobs/job-window/${id}/attachment-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name }) });
      const ud = await u.json().catch(() => ({}));
      if (!u.ok) throw new Error(ud?.error || "Couldn’t start the upload.");
      const put = await fetch(ud.signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("Upload failed.");
      setExtraBusy(false);
      await jobAction({ action: "add_attachment", file_name: file.name, url: ud.publicUrl, file_type: file.type, size_bytes: file.size }, "File added.");
    } catch (e) { setExtraMsg(e instanceof Error ? e.message : "Upload failed."); setExtraBusy(false); }
  }
  useEffect(() => { if (!activeEntry) return; const t = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(t); }, [activeEntry]);
  async function toggleTimer() {
    if (timerBusy) return; setTimerBusy(true); setSaveErr(null);
    try {
      const r = activeEntry
        ? await fetch(`/api/maintenance/${id}/time`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entry_id: activeEntry.id }) })
        : await fetch(`/api/maintenance/${id}/time`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok && r.status !== 409) setSaveErr(activeEntry ? "Couldn’t stop the timer. Try again." : "Couldn’t start the timer. Try again.");
    } catch { setSaveErr("Couldn’t reach the server. Try again."); }
    setTimerBusy(false); load(true);
  }
  async function saveSignature(dataUrl: string) {
    setSignBusy(true); setExtraMsg(null);
    try {
      const b64 = dataUrl.split(",")[1] ?? ""; const bin = atob(b64); const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const up = await fetch(`/api/maintenance/${id}/photo-upload-url`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: "customer-signature.png" }) }).then(r => r.json());
      if (!up?.signedUrl) throw new Error("no url");
      const put = await fetch(up.signedUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Blob([arr], { type: "image/png" }) });
      if (!put.ok) throw new Error("upload");
      const r = await fetch(`/api/maintenance/${id}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file_url: up.publicUrl, file_name: "signature|customer-signature.png", caption: "signature" }) });
      if (!r.ok) throw new Error("save");
      setShowSign(false); setExtraMsg("Customer signature saved.");
    } catch { setExtraMsg("The signature didn’t save. Try again."); }
    setSignBusy(false); load(true);
  }
  async function notifyCustomer(event: string) {
    setSmsBusy(true); setSmsMsg(null);
    const r = await fetch(`/api/maintenance/${id}/notify-customer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, tech_eta: event === "in_route" ? (eta || undefined) : undefined }) }).then(x => x.json()).catch(() => null);
    setSmsBusy(false);
    setSmsMsg(r?.ok ? `Texted customer ✓ — ${r.sent_to}` : (r?.error || "Couldn't send text."));
    load(true);
  }
  async function createInvoice() {
    if (invBusy || !wo) return; setInvBusy(true); setSmsMsg(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineItems = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...parts.map((p: any) => ({ description: p.name, qty: p.qty ?? 1, unit_price: Number(p.unit_price ?? p.unit_cost ?? 0), service_type: "part" })),
      ...(laborMins > 0 ? [{ description: `Labor — ${Math.round((laborMins / 60) * 10) / 10} hrs`, qty: Math.round((laborMins / 60) * 10) / 10, unit_price: 0, service_type: "labor" }] : []),
    ];
    const r = await fetch(`/api/invoices`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ site_id: wo.site_id ?? null, work_order_id: id, line_items: lineItems, notes: `From work order ${wo.wo_number || ""}`.trim() }) }).then(x => x.json()).catch(() => null);
    setInvBusy(false);
    setSmsMsg(r?.id || r?.invoice?.id ? "Invoice created ✓ — open Money/Docs to set rates, send & collect payment." : (r?.error || "Couldn't create invoice."));
  }

  // One phase block: header ("Headend — 2 of 3 done"), its steps indented under
  // it, and its own "+ Add step". Written as a plain function, not a nested
  // component, so React keeps the inputs mounted (and focused) while you type.
  function renderStepGroup(gid: string, phaseId: string | null, name: string, phaseIndex: number) {
    const group = stepsIn(phaseId);
    const gDone = group.filter(c => c.is_complete || c.completed || c.done).length;
    const arrow = { background: "none", border: "none", color: "#3A3A3C", cursor: "pointer", fontSize: 11, lineHeight: 1.05, padding: "0 2px" } as const;
    const isPhase = phaseId !== null;
    return <div key={gid} style={{ background: "#FAFAFB", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1, minWidth: 110 }}>{name}</span>
        <Small>{gDone} of {group.length} done</Small>
        {isPhase && <>
          <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <button onClick={() => movePhase(phaseIndex, -1)} disabled={phaseIndex === 0} title="Move phase up" style={{ ...arrow, opacity: phaseIndex === 0 ? 0.25 : 1 }}>▲</button>
            <button onClick={() => movePhase(phaseIndex, 1)} disabled={phaseIndex === phases.length - 1} title="Move phase down" style={{ ...arrow, opacity: phaseIndex === phases.length - 1 ? 0.25 : 1 }}>▼</button>
          </div>
          <button onClick={() => deletePhase(phases[phaseIndex])} style={{ ...sel, cursor: "pointer", color: "#D70015", border: "1px solid rgba(255,77,77,0.35)", padding: "4px 9px", flexShrink: 0 }}>Delete</button>
        </>}
      </div>
      <div style={{ display: "grid", gap: 2, marginTop: 8, paddingLeft: 10, borderLeft: "2px solid rgba(0,163,255,0.22)" }}>
        {group.length === 0 && <Small>No steps yet — add the first one.</Small>}
        {group.map((c, i) => {
          const done = c.is_complete || c.completed || c.done;
          return <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", flex: 1, cursor: "pointer", minWidth: 0 }}>
              <input type="checkbox" checked={!!done} onChange={() => toggleChecklist(c)} style={{ marginTop: 3, flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", textDecoration: done ? "line-through" : "none", color: done ? "#6E6E73" : "#1D1D1F", fontSize: 14 }}>{c.title || c.label}</span>
                {c.notes && <span style={{ display: "block", fontSize: 12, color: "#3A3A3C", marginTop: 1, lineHeight: 1.4 }}>{c.notes}</span>}
              </span>
            </label>
            <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
              <button onClick={() => moveStep(group, i, -1)} disabled={i === 0} title="Move up" style={{ ...arrow, opacity: i === 0 ? 0.25 : 1 }}>▲</button>
              <button onClick={() => moveStep(group, i, 1)} disabled={i === group.length - 1} title="Move down" style={{ ...arrow, opacity: i === group.length - 1 ? 0.25 : 1 }}>▼</button>
            </div>
            <button onClick={() => removeChecklist(c)} title="Remove step" style={{ background: "none", border: "none", color: "#D70015", cursor: "pointer", fontSize: 15, flexShrink: 0 }}>×</button>
          </div>;
        })}
      </div>
      {addOpen === gid ? <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
        <input autoFocus placeholder="What to do — e.g. Location 1" value={stepForm.title} onChange={e => setStepForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") addStep(phaseId); }} style={{ ...input, padding: 9, fontSize: 13 }} />
        <input placeholder="Detail (optional) — e.g. pull CAT6 from the pool gate" value={stepForm.detail} onChange={e => setStepForm(f => ({ ...f, detail: e.target.value }))} onKeyDown={e => { if (e.key === "Enter") addStep(phaseId); }} style={{ ...input, padding: 9, fontSize: 13 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => addStep(phaseId)} disabled={!stepForm.title.trim() || stepBusy} style={{ ...btn, opacity: stepForm.title.trim() && !stepBusy ? 1 : 0.5 }}>{stepBusy ? "Adding…" : "Add step"}</button>
          <button onClick={() => { setAddOpen(null); setStepForm({ title: "", detail: "" }); }} style={{ ...btn2 }}>Cancel</button>
        </div>
      </div> : <button onClick={() => { setAddOpen(gid); setStepForm({ title: "", detail: "" }); }} style={{ ...sel, cursor: "pointer", marginTop: 8, padding: "6px 10px" }}>+ Add step</button>}
    </div>;
  }

  // ── Page header data ──────────────────────────────────────────────────────
  const bucket = wo ? bucketOf(stOf(wo)) : "New";
  const onHold = bucket === "Procurement" || bucket === "Stuck";
  const STEPS: { key: string; label: string }[] = [{ key: "New", label: "New" }, { key: "Scheduled", label: "Scheduled" }, { key: "In Progress", label: "Working" }, { key: "Done", label: "Done" }];
  const stepIdx = onHold ? 1 : Math.max(0, STEPS.findIndex(x => x.key === bucket));
  const addr = wo ? [wo.site_address, wo.site_city, wo.site_state, wo.site_zip].filter(Boolean).join(", ") : "";
  const phone = wo ? (wo.site_contact_phone || wo.site_pm_phone || "") : "";
  const sched = wo?.scheduled_date ? String(wo.scheduled_date).slice(0, 10) : null;
  const late = !!sched && bucket !== "Done" && sched < todayKey();
  const laborHrs = Math.round((laborMins / 60) * 10) / 10;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signed = photos.some((p: any) => String(p.file_name ?? p.caption ?? "").split("|")[0].toLowerCase() === "signature");
  const runSecs = activeEntry?.clock_in ? Math.max(0, Math.floor((nowTick - new Date(activeEntry.clock_in).getTime()) / 1000)) : 0;
  const runLabel = `${Math.floor(runSecs / 3600)}:${String(Math.floor((runSecs % 3600) / 60)).padStart(2, "0")}:${String(runSecs % 60).padStart(2, "0")}`;
  function goStep(key: string) {
    if (!wo) return;
    if (key === "Done" && !canComplete) { setHint(completeBlockReason + " — then finish the job."); setTab(!allStepsDone ? "Execution" : "Activity"); return; }
    setHint(null); patchField({ status: COL_TO_DB[key] });
  }
  // The one obvious next thing to do (ServiceTitan / Housecall Pro style).
  const primary: { label: string; run: () => void; tone?: string } | null = !wo ? null
    : bucket === "Done" ? { label: invBusy ? "Creating invoice…" : "Create invoice", run: createInvoice, tone: "#248A3D" }
    : onHold ? { label: "Resume job", run: () => goStep("Scheduled") }
    : bucket === "In Progress" ? { label: "Finish job", run: () => goStep("Done"), tone: "#248A3D" }
    : bucket === "Scheduled" ? { label: "Start job", run: () => goStep("In Progress") }
    : !wo.assignee_id ? { label: "Assign a tech", run: () => { setTab("Overview"); setTimeout(() => document.getElementById("jp-tech")?.focus(), 60); } }
    : !sched ? { label: "Set a date", run: () => { setTab("Overview"); setTimeout(() => document.getElementById("jp-date")?.focus(), 60); } }
    : { label: "Mark scheduled", run: () => goStep("Scheduled") };
  const link = typeof window !== "undefined" ? `${window.location.origin}/maintenance/${id}` : `/maintenance/${id}`;

  return <div className="jp" style={{ position: "fixed", inset: 0, zIndex: 130, overflowY: "auto", backgroundColor: "#EEF2F7", backgroundImage: "linear-gradient(180deg,#0E1726 0px,#18263F 200px,#283B5E 380px,#5D7193 560px,#B4C1D6 760px,#E2E8F1 940px,#EEF2F7 1100px)", backgroundRepeat: "no-repeat", backgroundAttachment: "local", color: INK, fontFamily: FONT, letterSpacing: "-0.01em", WebkitOverflowScrolling: "touch" }}>
    <style>{`
      .jp *{box-sizing:border-box}
      .jp h2{font-weight:600;letter-spacing:-.01em}
      .jp button,.jp select,.jp input,.jp textarea{font-family:inherit}
      .jp-wrap{max-width:1180px;margin:0 auto;padding:20px 24px calc(140px + env(safe-area-inset-bottom))}
      .jp-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .jp-back{display:inline-flex;align-items:center;gap:6px;min-height:34px;border:0;background:none;color:#8EC1FF;font:500 14px ${FONT};cursor:pointer;padding:0 2px}
      .jp-tbtn{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;font:500 13px ${FONT};cursor:pointer;text-decoration:none;white-space:nowrap}
      .jp-hd{margin:14px 0 16px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
      .jp-hd .no{color:#8EC1FF;font-size:13px;font-weight:500;letter-spacing:.02em}
      .jp-hd h1{margin:2px 0 0;color:#fff;font-size:28px;font-weight:600;letter-spacing:-.025em;line-height:1.2}
      .jp-hd .sub{color:rgba(255,255,255,.72);font-size:14px;margin-top:4px}
      .jp-pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
      .jp-cmd{background:#fff;border-radius:16px;box-shadow:0 1px 2px rgba(10,20,40,.06),0 8px 24px rgba(10,20,40,.08);padding:16px 18px;margin-bottom:16px;display:grid;gap:14px}
      .jp-steps{display:flex;align-items:flex-start;flex:1;min-width:260px}
      .jp-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;cursor:pointer;padding:0;font:inherit;color:${INK3};position:relative}
      .jp-step .d{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;background:#F0F1F4;color:${INK3};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.08);z-index:1}
      .jp-step.done .d{background:${BLUE};color:#fff}
      .jp-step.cur .d{background:#fff;color:${BLUE};box-shadow:0 0 0 2px ${BLUE}}
      .jp-step.cur{color:${INK};font-weight:600}
      .jp-step .l{font-size:12.5px}
      .jp-step:not(:last-child)::after{content:'';position:absolute;top:13px;left:calc(50% + 14px);right:calc(-50% + 14px);height:2px;background:#E5E5EA}
      .jp-step.done:not(:last-child)::after{background:${BLUE}}
      .jp-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .jp-pri{height:42px;padding:0 20px;border-radius:12px;border:0;color:#fff;font:600 15px ${FONT};cursor:pointer;white-space:nowrap}
      .jp-pri:disabled{opacity:.6}
      .jp-quick{display:flex;gap:8px;flex-wrap:wrap}
      .jp-q{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:10px;border:1px solid rgba(0,0,0,.12);background:#fff;color:${INK};font:500 13px ${FONT};cursor:pointer;text-decoration:none}
      .jp-q[aria-disabled=true]{opacity:.45;pointer-events:none}
      .jp-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid ${LINE};padding-top:12px}
      .jp-k{padding:0 12px;border-left:1px solid ${LINE};min-width:0}
      .jp-k:first-child{border-left:0;padding-left:0}
      .jp-k .l{font-size:12px;color:${INK3};font-weight:500}
      .jp-k .v{font-size:16px;font-weight:600;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .jp-k .bar{height:4px;border-radius:2px;background:#EEF0F4;margin-top:6px;overflow:hidden}
      .jp-k .bar i{display:block;height:100%;background:${BLUE}}
      .jp-tabs{display:flex;gap:2px;padding:3px;border-radius:12px;background:#E8EBF0;width:max-content;max-width:100%;overflow-x:auto;position:sticky;top:8px;z-index:3;box-shadow:0 1px 2px rgba(0,0,0,.06)}
      .jp-tabs button{min-height:34px;padding:0 16px;border-radius:9px;border:0;background:none;font:500 13.5px ${FONT};color:${INK2};cursor:pointer;white-space:nowrap}
      .jp-tabs button[aria-selected=true]{background:#fff;color:${INK};font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
      @media (max-width:860px){.jp-kpis{grid-template-columns:repeat(3,minmax(0,1fr));row-gap:12px}.jp-k:nth-child(4){border-left:0;padding-left:0}}
      @media (max-width:640px){.jp-row>div:last-child{width:100%}.jp-row>div:last-child select{flex:1}.jp-wrap{padding:16px 14px calc(140px + env(safe-area-inset-bottom))}.jp-hd h1{font-size:23px}.jp-pri{width:100%}.jp-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.jp-k{border-left:0!important;padding-left:0!important}}
    `}</style>
    <div className="jp-wrap">
      <div className="jp-top">
        <button type="button" className="jp-back" onClick={onClose}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path d="M15 18l-6-6 6-6" /></svg> Back</button>
        {wo && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="jp-tbtn" onClick={() => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>{copied ? "Link copied ✓" : "Copy link"}</button>
          <button type="button" className="jp-tbtn" onClick={() => printWorkOrder(wo, siteEquip)}><Printer size={14} /> Print</button>
        </div>}
      </div>
      {loading ? <div style={{ color: "rgba(255,255,255,.75)", marginTop: 30 }}>Loading the job…</div> : !wo ? <div style={{ color: "#fff", marginTop: 30 }}>Couldn’t load this work order. <button type="button" className="jp-tbtn" onClick={() => load()}>Try again</button></div> : <>
      <div className="jp-hd">
        <div style={{ minWidth: 0 }}>
          <div className="no">{wo.wo_number || "Work order"}{wo.job_type ? ` · ${wo.job_type}` : ""}</div>
          <h1>{wo.title || "Work order"}</h1>
          <div className="sub">{wo.customer_name || "No site"}{addr ? ` · ${addr}` : ""}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {wo.priority && <span className="jp-pill" style={/crit|urg/.test(String(wo.priority).toLowerCase()) ? { background: "#FFECEC", color: "#D70015" } : String(wo.priority).toLowerCase() === "high" ? { background: "#FFF4E5", color: "#B25000" } : { background: "rgba(255,255,255,.14)", color: "#fff" }}>{String(wo.priority)[0].toUpperCase() + String(wo.priority).slice(1)} priority</span>}
          {onHold && <span className="jp-pill" style={{ background: "#FFF4E5", color: "#B25000" }}>{bucket === "Procurement" ? "Waiting on parts" : "Stuck"}</span>}
          {late && <span className="jp-pill" style={{ background: "#FFECEC", color: "#D70015" }}>Late</span>}
          {wo.is_callback && <span className="jp-pill" style={{ background: "#FFF4E5", color: "#B25000" }}>Callback</span>}
        </div>
      </div>

      {/* Command card: where the job is, the next thing to do, reach the customer, the numbers. */}
      <section className="jp-cmd" aria-label="Job status">
        <div className="jp-row">
          <div className="jp-steps" role="group" aria-label="Job progress — tap a step to move the job">
            {STEPS.map((st, i) => <button key={st.key} type="button" className={`jp-step${i < stepIdx || (bucket === "Done" && i === stepIdx) ? " done" : ""}${i === stepIdx && bucket !== "Done" ? " cur" : ""}`} onClick={() => goStep(st.key)} aria-current={i === stepIdx ? "step" : undefined}>
              <span className="d">{i < stepIdx || bucket === "Done" ? "✓" : i + 1}</span><span className="l">{st.label}</span>
            </button>)}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {!onHold && bucket !== "Done" && <select aria-label="Put on hold" value="" onChange={e => { if (e.target.value) goStep(e.target.value); }} style={{ ...sel, height: 34 }}>
              <option value="">Put on hold…</option><option value="Procurement">Waiting on parts</option><option value="Stuck">Stuck / blocked</option>
            </select>}
            {primary && <button type="button" className="jp-pri" onClick={primary.run} disabled={invBusy} style={{ background: primary.tone ?? BLUE }}>{primary.label}</button>}
          </div>
        </div>
        {(hint || saveErr) && <div role="status" style={{ fontSize: 13, color: "#B25000", background: "#FFF4E5", borderRadius: 10, padding: "8px 12px" }}>{saveErr || hint}</div>}
        {smsMsg && smsMsg.toLowerCase().includes("invoice") && <div role="status" style={{ fontSize: 13, color: smsMsg.includes("✓") ? "#1A7F37" : "#D70015", background: smsMsg.includes("✓") ? "#E8F6EC" : "#FFECEC", borderRadius: 10, padding: "8px 12px" }}>{smsMsg}</div>}
        <div className="jp-quick">
          <a className="jp-q" href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone} title={phone || "No phone on this site"}>Call{wo.site_contact_name ? ` ${String(wo.site_contact_name).split(" ")[0]}` : ""}</a>
          <a className="jp-q" href={phone ? `sms:${phone}` : undefined} aria-disabled={!phone}>Text</a>
          <a className="jp-q" href={addr ? `https://maps.google.com/?q=${encodeURIComponent(addr)}` : undefined} target="_blank" rel="noreferrer" aria-disabled={!addr}>Directions</a>
          <button type="button" className="jp-q" onClick={() => setTab("Overview")}>Send customer an update</button>
          <button type="button" className="jp-q" onClick={toggleTimer} disabled={timerBusy} style={activeEntry ? { background: "#E8F6EC", borderColor: "rgba(36,138,61,.35)", color: "#1A7F37", fontVariantNumeric: "tabular-nums" } : undefined}>{activeEntry ? `● Stop timer · ${runLabel}` : "▶ Start timer"}</button>
          <button type="button" className="jp-q" onClick={() => { setTab("Activity"); setShowSign(true); }} style={signed ? { background: "#E8F6EC", borderColor: "rgba(36,138,61,.35)", color: "#1A7F37" } : undefined}>{signed ? "Customer signed ✓" : "Get customer signature"}</button>
          {wo.site_access_notes && <span className="jp-q" style={{ background: "#FFF4E5", borderColor: "rgba(245,158,11,.35)", color: "#B25000", cursor: "default" }} title={String(wo.site_access_notes)}>Access: {String(wo.site_access_notes).slice(0, 40)}{String(wo.site_access_notes).length > 40 ? "…" : ""}</span>}
        </div>
        <div className="jp-kpis">
          <div className="jp-k"><div className="l">Scheduled</div><div className="v" style={late ? { color: "#D70015" } : undefined}>{sched ? dayLabel(sched) : "Not set"}</div></div>
          <div className="jp-k"><div className="l">Tech</div><div className="v">{wo.assignee_name || "Unassigned"}{crew.length ? ` +${crew.length}` : ""}</div></div>
          <div className="jp-k"><div className="l">Steps</div><div className="v">{doneCount}/{checklist.length}</div><div className="bar"><i style={{ width: `${checklist.length ? (doneCount / checklist.length) * 100 : 0}%` }} /></div></div>
          <div className="jp-k"><div className="l">Parts here</div><div className="v" style={parts.length && partsHere < parts.length ? { color: "#B25000" } : undefined}>{parts.length ? `${partsHere}/${parts.length}` : "None"}</div></div>
          <div className="jp-k"><div className="l">Labor</div><div className="v">{laborHrs} hrs{activeEntry ? <span style={{ color: "#1A7F37", fontSize: 12, fontWeight: 500 }}> · running</span> : null}</div></div>
          <div className="jp-k"><div className="l">Parts margin</div><div className="v">{partsRev > 0 ? `${money(margin)} · ${marginPct}%` : "—"}</div></div>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr)", gap: 16 }}>
        {/* Tabs — every feature one tap away */}
        <div className="jp-tabs" role="tablist" aria-label="Job sections">
          {(["Overview", "Scope", "Execution", "Activity"] as const).map(tb => <button key={tb} type="button" role="tab" aria-selected={tab === tb} onClick={() => setTab(tb)}>{tb === "Execution" ? "Work & money" : tb === "Activity" ? "Notes, photos & files" : tb}</button>)}
        </div>

        {tab === "Overview" && (<>
        <Card>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Status</Small><select value={bucketOf(stOf(wo))} onChange={e => patchField({ status: COL_TO_DB[e.target.value] })} style={{ ...sel, width: "100%", marginTop: 4 }}>{JOB_COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Assigned to</Small><select id="jp-tech" value={wo.assignee_id ?? ""} onChange={e => { const t = techs.find(x => x.id === e.target.value); patchField({ assignee_id: e.target.value || null, assignee_name: t?.name ?? null }); }} style={{ ...sel, width: "100%", marginTop: 4 }}><option value="">Unassigned</option>{techs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Schedule date</Small><input id="jp-date" type="date" value={wo.scheduled_date ? String(wo.scheduled_date).slice(0, 10) : ""} onChange={e => patchField({ scheduled_date: e.target.value || null })} style={{ ...sel, width: "100%", marginTop: 4 }} /></div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Priority</Small><select value={String(wo.priority ?? "medium").toLowerCase() === "normal" ? "medium" : String(wo.priority ?? "medium").toLowerCase()} onChange={e => patchField({ priority: e.target.value })} style={{ ...sel, width: "100%", marginTop: 4 }}><option value="low">Low</option><option value="medium">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></div>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Due by (promised to customer)</Small><input type="date" value={wo.due_date ? String(wo.due_date).slice(0, 10) : ""} onChange={e => patchField({ due_date: e.target.value || null })} style={{ ...sel, width: "100%", marginTop: 4 }} /></div>
            <div style={{ flex: 1, minWidth: 140 }}><Small>Job type</Small><div style={{ ...sel, width: "100%", marginTop: 4, display: "flex", alignItems: "center", background: "#F7F8FA" }}>{wo.job_type || "—"}</div></div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6E6E73", cursor: "pointer", marginTop: 10 }}>
            <input type="checkbox" checked={notifyOnChange} onChange={e => setNotifyOnChange(e.target.checked)} style={{ width: 15, height: 15 }} />
            <Mail size={14} style={{ flexShrink: 0 }} /> Email the tech &amp; customer when I change this job
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#6E6E73", cursor: "pointer", marginTop: 8 }}>
            <input type="checkbox" checked={!!wo.is_callback} onChange={e => patchField({ is_callback: e.target.checked })} style={{ width: 15, height: 15 }} />
            <RotateCcw size={14} style={{ flexShrink: 0 }} /> This is a callback / re-work (counts against first-time-fix)
          </label>
          {wo.is_callback && siteHistory.length > 0 && (
            <select value={wo.callback_of_id ?? ""} onChange={e => patchField({ callback_of_id: e.target.value || null })} style={{ ...sel, width: "100%", marginTop: 6 }}>
              <option value="">Link the original job (optional)…</option>
              {siteHistory.map(h => <option key={h.id} value={h.id}>{h.wo_number || h.title || String(h.id).slice(0, 8)}</option>)}
            </select>
          )}
        </Card>

        {/* Customer updates — one-tap SMS to the customer (on my way / arrived / done / review) */}
        <Card>
          <Small>Text the customer</Small>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
            <input placeholder="ETA e.g. 2:30 PM" value={eta} onChange={e => setEta(e.target.value)} style={{ ...sel, width: 130 }} />
            <button onClick={() => notifyCustomer("in_route")} disabled={smsBusy} style={{ ...btn2, color: BLUE, border: "1px solid rgba(0,163,255,0.4)", display: "inline-flex", alignItems: "center", gap: 6 }}><Truck size={14} /> On my way</button>
            <button onClick={() => notifyCustomer("on_site")} disabled={smsBusy} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> Arrived</button>
            <button onClick={() => notifyCustomer("completed")} disabled={smsBusy} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}><CheckCircle2 size={14} /> Job done</button>
            <button onClick={() => notifyCustomer("review_request")} disabled={smsBusy} style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}><Star size={14} /> Ask for review</button>
          </div>
          {smsMsg && !smsMsg.toLowerCase().includes("invoice") && <div style={{ fontSize: 12, color: smsMsg.includes("✓") ? "#248A3D" : "#D70015", marginTop: 8 }}>{smsMsg}</div>}
        </Card>

        {/* Crew — multiple techs/resources on one job (lead = primary assignee). */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Small>Crew on this job</Small>
            <select value={crewPick} onChange={e => addCrew(e.target.value)} style={{ ...sel, maxWidth: 200 }}>
              <option value="">+ Add crew…</option>
              {techs.filter(t => t.id !== wo.assignee_id && !crew.some(c => c.technician?.id === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {wo.assignee_name && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "#EEF4FF", border: "1px solid rgba(0,163,255,0.4)", color: "#0071E3", borderRadius: 20, padding: "5px 12px" }}><Star size={12} /> {wo.assignee_name}<span style={{ opacity: 0.6 }}>· lead</span></span>}
            {crew.map(c => (
              <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.12)", color: "#3A3A3C", borderRadius: 20, padding: "5px 10px" }}>
                {c.technician?.name || "Tech"}<span style={{ opacity: 0.55 }}>· {c.role}</span>
                <button onClick={() => removeCrew(c.id)} aria-label="Remove crew member" style={{ background: "none", border: "none", color: "#6E6E73", cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center" }}><X size={13} /></button>
              </span>
            ))}
            {!wo.assignee_name && crew.length === 0 && <Small>No one assigned yet — set the lead above, add crew here.</Small>}
          </div>
        </Card>

        {/* Visits — multi-day / return trips. Each can be scheduled + status-tracked. */}
        <Card>
          <Small>Visits</Small>
          <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
            {phases.length === 0 && <Small>Single visit so far. Add visits for multi-day jobs or return trips.</Small>}
            {phases.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "8px 10px" }}>
                <span style={{ flex: 1, minWidth: 120, fontSize: 13 }}>{p.name}</span>
                <input type="date" value={p.scheduled_date ? String(p.scheduled_date).slice(0, 10) : ""} onChange={e => patchPhase(p.id, { scheduled_date: e.target.value || null })} style={{ ...sel, width: 150 }} />
                <select value={p.status} onChange={e => patchPhase(p.id, { status: e.target.value })} style={{ ...sel, width: 140 }}>
                  {["pending", "in_progress", "complete", "skipped"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <button onClick={() => removePhase(p.id)} aria-label="Remove visit" style={{ ...btn2, color: "#D70015", border: "1px solid rgba(255,77,77,0.4)", display: "inline-flex", alignItems: "center" }}><X size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <input placeholder="New visit (e.g. Day 2 – Commissioning)" value={phaseForm.name} onChange={e => setPhaseForm(f => ({ ...f, name: e.target.value }))} style={{ ...sel, flex: 1, minWidth: 160 }} />
            <input type="date" value={phaseForm.scheduled_date} onChange={e => setPhaseForm(f => ({ ...f, scheduled_date: e.target.value }))} style={{ ...sel, width: 150 }} />
            <button onClick={addPhase} disabled={!phaseForm.name.trim()} style={{ ...btn2, color: BLUE, border: "1px solid rgba(0,163,255,0.45)", opacity: phaseForm.name.trim() ? 1 : 0.5 }}>+ Add visit</button>
          </div>
        </Card>
        </>)}

        {tab === "Scope" && (<>
        {/* Work to perform — editable so anyone can spell out the scope for the tech. */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 6 }}>Work to perform</h2>
          <textarea
            key={wo.id}
            defaultValue={wo.description || wo.notes || ""}
            placeholder="Type exactly what the tech should do — e.g. Replace the gate motor, test the safety loop, confirm it opens and closes."
            onBlur={e => { const v = e.target.value.trim(); if (v !== String(wo.description || wo.notes || "")) patchField({ description: v }); }}
            style={{ ...input, minHeight: 90, resize: "vertical", lineHeight: 1.5 }}
          />
          <Small>Tip: changes save when you click out of the box.</Small>
          {wo.priority && <div style={{ marginTop: 8 }}><Badge tone={String(wo.priority).toLowerCase() === "critical" || String(wo.priority).toLowerCase() === "urgent" ? "urgent" : String(wo.priority).toLowerCase() === "high" ? "high" : "default"}>{wo.priority} priority</Badge></div>}
        </Card>

        {/* Site pull-through */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 6 }}>Site</h2>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{wo.customer_name || "—"}</div>
          {(wo.site_address || wo.site_city) && <Small>{[wo.site_address, wo.site_city, wo.site_state, wo.site_zip].filter(Boolean).join(", ")}</Small>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            {(wo.site_contact_name || wo.site_contact_phone) && <div><Small>On-site contact</Small><div style={{ fontSize: 13 }}>{wo.site_contact_name || "—"}{wo.site_contact_phone ? ` · ${wo.site_contact_phone}` : ""}</div></div>}
            {(wo.site_pm_name || wo.site_pm_phone) && <div><Small>Property manager</Small><div style={{ fontSize: 13 }}>{wo.site_pm_name || "—"}{wo.site_pm_phone ? ` · ${wo.site_pm_phone}` : ""}</div></div>}
          </div>
          {wo.site_access_notes && <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#FFF4E5", border: "1px solid rgba(245,158,11,0.28)" }}><Small><span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Key size={12} /> Access / gate notes</span></Small><div style={{ fontSize: 13, color: "#3A3A3C", marginTop: 2 }}>{wo.site_access_notes}</div></div>}
          {siteHistory.length > 0 && <div style={{ marginTop: 10 }}><Small>Past work at this site ({siteHistory.length})</Small>{siteHistory.slice(0, 5).map((w, i) => <p key={w.id || i} style={{ margin: "4px 0", fontSize: 13 }}>{w.wo_number || w.title || "WO"} <span style={{ color: "#3A3A3C" }}>· {w.status}{w.scheduled_date ? ` · ${String(w.scheduled_date).slice(0, 10)}` : ""}</span></p>)}</div>}
        </Card>

        {/* Equipment on site + manuals */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, margin: 0 }}>Equipment on site ({siteEquip.length})</h2>
            {siteId && <button onClick={() => setShowAddEq(true)} style={{ ...sel, cursor: "pointer", padding: "6px 12px" }}>+ Add equipment</button>}
          </div>
          {!siteId && <Small>Link this work order to a site to track its equipment.</Small>}
          {showAddEq && <Modal title="Add equipment to this site" onClose={() => setShowAddEq(false)}>
            <div style={{ display: "grid", gap: 10 }}>
              <div><div style={{ color: "#6E6E73", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>What is it? *</div><input placeholder="e.g. LiftMaster gate operator" value={eqForm.product_name} onChange={e => setEqForm({ ...eqForm, product_name: e.target.value })} style={input} /></div>
              <div><div style={{ color: "#6E6E73", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Serial number (optional)</div><input placeholder="Serial / model #" value={eqForm.serial_number} onChange={e => setEqForm({ ...eqForm, serial_number: e.target.value })} style={input} /></div>
              <div><div style={{ color: "#6E6E73", fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Where is it? (optional)</div><input placeholder="e.g. Front gate, Pool entrance" value={eqForm.location_note} onChange={e => setEqForm({ ...eqForm, location_note: e.target.value })} style={input} /></div>
              <button onClick={addEquipment} disabled={!eqForm.product_name.trim() || eqBusy} style={{ ...btn, opacity: eqForm.product_name.trim() && !eqBusy ? 1 : 0.5 }}>{eqBusy ? "Adding…" : "Add equipment"}</button>
            </div>
          </Modal>}
          {siteEquip.length === 0 ? <Small>No equipment recorded for this site yet.</Small> : siteEquip.map((a, i) => { const man = manualFor(a); return <div key={a.id || i} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", padding: "6px 0", borderBottom: i < siteEquip.length - 1 ? "1px solid rgba(0,0,0,0.08)" : "none" }}>
            <div style={{ fontSize: 14, minWidth: 0 }}>{a.product_id ? <a href={`/?tab=catalog&product=${a.product_id}`} style={{ color: "#1D1D1F", textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.2)" }}>{a.product_name || a.name || "Equipment"}</a> : (a.product_name || a.name || "Equipment")}{a.serial_number ? <span style={{ color: "#8E8E93", fontSize: 12 }}> · {a.serial_number}</span> : ""}{a.location_note ? <span style={{ color: "#3A3A3C", fontSize: 12 }}> · {a.location_note}</span> : ""}</div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              {a.status && <Badge tone={a.status === "offline" ? "urgent" : "good"}>{a.status}</Badge>}
              {man && <a href={man} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#0071E3", textDecoration: "none", padding: "3px 8px", borderRadius: 8, border: "1px solid rgba(125,211,252,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}><FileText size={11} /> Manual</a>}
            </div>
          </div>; })}
        </Card>
        </>)}

        {tab === "Execution" && (<>
        {/* AI Tech Support */}
        <Card style={{ background: "#EEF4FF", border: "1px solid rgba(0,163,255,0.22)" }}>
          <h2 style={{ fontSize: 15, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}><Bot size={16} /> AI Tech Support</h2>
          <Small>Describe the symptom — get guided, manual-backed steps.</Small>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input placeholder="e.g. Gate won't open, motor hums" value={aiQ} onChange={e => setAiQ(e.target.value)} onKeyDown={e => { if (e.key === "Enter") askAI(); }} style={{ ...input, padding: 9 }} />
            <button onClick={askAI} disabled={aiBusy || !aiQ.trim()} style={{ ...btn, opacity: aiBusy || !aiQ.trim() ? 0.5 : 1 }}>{aiBusy ? "Thinking…" : "Ask"}</button>
          </div>
          {aiStep && <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize: 11, color: "#0071E3", textTransform: "uppercase", letterSpacing: "0.08em" }}>{aiStep.type || "step"}</div>
            <div style={{ fontSize: 14, fontWeight: 600, margin: "4px 0" }}>{aiStep.text}</div>
            {aiStep.detail && <div style={{ fontSize: 13, color: "#6E6E73" }}>{aiStep.detail}</div>}
            {aiStep.expected && <div style={{ fontSize: 12, color: "#6E6E73", marginTop: 4 }}>Expected: {aiStep.expected}{aiStep.unit ? ` ${aiStep.unit}` : ""}</div>}
            {aiStep.manual_ref?.url && <a href={aiStep.manual_ref.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "#0071E3" }}><FileText size={12} /> Manual{aiStep.manual_ref.page ? ` p.${aiStep.manual_ref.page}` : ""}</a>}
          </div>}
        </Card>

        {/* Money / profitability (was WO Detail + Reporting) */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2 style={{ fontSize: 15 }}>Money on this job</h2>
            {partsRev > 0 && <Badge tone="good">{marginPct}% margin</Badge>}
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#0071E3", margin: "6px 0" }}>{money(margin)} <span style={{ fontSize: 14, color: "#6E6E73", fontWeight: 600 }}>margin</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
            <div><Small>Parts cost</Small><div style={{ fontSize: 16, fontWeight: 700 }}>{money(partsCost)}</div></div>
            <div><Small>Parts price</Small><div style={{ fontSize: 16, fontWeight: 700 }}>{money(partsRev)}</div></div>
            <div><Small>Labor logged</Small><div style={{ fontSize: 16, fontWeight: 700 }}>{Math.round((laborMins / 60) * 10) / 10} hrs</div></div>
          </div>
          {phases.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
              <Small>Apply new labor / parts to</Small>
              <select value={costPhase} onChange={e => setCostPhase(e.target.value)} style={{ ...sel, flex: 1 }}>
                <option value="">Whole job</option>
                {phases.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
            <input type="number" step="0.25" placeholder="Hours" value={laborH} onChange={e => setLaborH(e.target.value)} style={{ ...input, padding: 9, width: 110 }} />
            <button onClick={logLabor} disabled={!laborH || partBusy} style={{ ...btn, opacity: laborH && !partBusy ? 1 : 0.5 }}>Log labor</button>
          </div>
          <button onClick={createInvoice} disabled={invBusy} style={{ ...btn, marginTop: 12, width: "100%", background: "#E8F6EC", border: "1px solid rgba(0,230,153,0.4)", color: "#248A3D", opacity: invBusy ? 0.5 : 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{invBusy ? "Creating…" : <><FileText size={14} /> Create invoice from this job</>}</button>
          {smsMsg && smsMsg.toLowerCase().includes("invoice") && <div style={{ fontSize: 12, color: smsMsg.includes("✓") ? "#248A3D" : "#D70015", marginTop: 8 }}>{smsMsg}</div>}
        </Card>

        {/* Checklist / Playbook steps (was Procedures) */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15 }}>Steps / Checklist</h2>
            <Small>{doneCount}/{checklist.length} done</Small>
          </div>
          {playbooks.length > 0 && <div style={{ marginBottom: 10 }}>
            <select defaultValue="" onChange={e => { const pb = playbooks.find(p => String(p.id) === e.target.value); if (pb) { assignPlaybook(pb); e.target.value = ""; } }} style={{ ...sel, width: "100%", padding: 9 }}>
              <option value="">▶ Assign a playbook…</option>
              {playbooks.map(p => <option key={p.id} value={p.id}>{p.title}{p.org_id ? "" : " (global)"} — {(p.steps ?? []).length} steps</option>)}
            </select>
          </div>}
          {/* Phase controls — one tap for the phases we actually run, or type your own. */}
          <div style={{ background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            {phases.length === 0 && <div style={{ marginBottom: 8 }}><Small>Group your steps into phases (Wiring, Trim, Headend, Program).</Small></div>}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {PRESET_PHASES.map(name => {
                const already = phases.some(p => String(p.name).trim().toLowerCase() === name.toLowerCase());
                return <button key={name} onClick={() => addPhaseNamed(name)} disabled={already || stepBusy} title={already ? `${name} is already added` : `Add the ${name} phase`}
                  style={{ ...sel, cursor: already ? "default" : "pointer", opacity: already ? 0.4 : 1, padding: "6px 10px" }}>{already ? `✓ ${name}` : `+ ${name}`}</button>;
              })}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input placeholder="Or type a phase name…" value={newPhaseName} onChange={e => setNewPhaseName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addPhaseNamed(newPhaseName); }} style={{ ...input, padding: 9, fontSize: 13 }} />
              <button onClick={() => addPhaseNamed(newPhaseName)} disabled={!newPhaseName.trim() || stepBusy} style={{ ...btn, opacity: newPhaseName.trim() && !stepBusy ? 1 : 0.5, whiteSpace: "nowrap" }}>+ Add phase</button>
            </div>
          </div>

          {stepErr && <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 10, background: "#FFECEC", border: "1px solid rgba(255,77,77,0.35)" }}>
            <div style={{ fontSize: 13, color: "#D70015" }}>{stepErr.msg} Nothing was saved — please try again.</div>
            {stepErr.detail && <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>Details: {stepErr.detail}</div>}
          </div>}

          {/* Each phase, in order, then anything not in a phase — so no step is ever lost. */}
          <div style={{ display: "grid", gap: 10 }}>
            {phases.map((p, pi) => renderStepGroup(String(p.id), String(p.id), p.name, pi))}
            {(stepsIn(null).length > 0 || phases.length === 0) && renderStepGroup(PHASE_OTHER, null, phases.length === 0 ? "Steps" : "Other steps", -1)}
          </div>
        </Card>

        {/* Parts & procurement — where every part is, before the truck rolls */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <h2 style={{ fontSize: 15 }}>Parts &amp; procurement</h2>
            <button onClick={() => setShowAddPart(s => !s)} style={{ ...btn, padding: "6px 12px" }}>+ Add</button>
          </div>
          {parts.length > 0 && <div style={{ fontSize: 13, fontWeight: 600, color: partsHere === parts.length ? "#248A3D" : "#3A3A3C", marginBottom: 10 }}>{partsSummary}</div>}
          {partErr && <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 10, background: "#FFECEC", border: "1px solid rgba(255,77,77,0.35)" }}>
            <div style={{ fontSize: 13, color: "#D70015" }}>{partErr.msg} Please try again.</div>
            {partErr.detail && <div style={{ fontSize: 11, color: "#8E8E93", marginTop: 2 }}>Details: {partErr.detail}</div>}
          </div>}
          {showAddPart && <div style={{ ...card, marginBottom: 10, display: "grid", gap: 8 }}>
            <input placeholder="Part name *" value={pForm.name} onChange={e => setPForm({ ...pForm, name: e.target.value })} style={{ ...input, padding: 9, fontSize: 13 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" placeholder="Qty" value={pForm.qty} onChange={e => setPForm({ ...pForm, qty: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
              <input type="number" placeholder="Cost $" value={pForm.unit_cost} onChange={e => setPForm({ ...pForm, unit_cost: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
              <input type="number" placeholder="Price $" value={pForm.unit_price} onChange={e => setPForm({ ...pForm, unit_price: e.target.value })} style={{ ...input, padding: 9, fontSize: 13, flex: 1 }} />
            </div>
            <button onClick={addPart} disabled={!pForm.name.trim() || partBusy} style={{ ...btn, opacity: pForm.name.trim() && !partBusy ? 1 : 0.5 }}>{partBusy ? "Adding…" : "Add part"}</button>
          </div>}
          {parts.length === 0 ? <Small>No parts on this job yet.</Small> : <div style={{ display: "grid", gap: 8 }}>
            {parts.map((p, i) => {
              const s = supplyOf(p.supply_status);
              const c = SUPPLY_COLOR[s];
              const saving = partSaving === p.id;
              return <div key={p.id || i} style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderLeft: `3px solid ${c}`, borderRadius: 12, padding: "10px 12px", opacity: saving ? 0.6 : 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.product_id ? <a href={`/?tab=catalog&product=${p.product_id}`} style={{ color: "#1D1D1F", textDecoration: "underline", textDecorationColor: "rgba(0,0,0,0.2)" }}>{p.name || "Part"}</a> : (p.name || "Part")}{p.sku ? <span style={{ color: "#8E8E93", fontWeight: 400 }}> · {p.sku}</span> : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#6E6E73" }}>
                      Qty {num(p.qty)}
                      {num(p.unit_price) > 0 && <span style={{ color: "#248A3D" }}> · {money((num(p.unit_price) - num(p.unit_cost)) * num(p.qty))} margin</span>}
                    </div>
                  </div>
                  {/* One tap: where is this part right now? */}
                  <select value={s} disabled={!p.id || saving} title="Where is this part right now?"
                    onChange={e => patchPart(String(p.id), { supply_status: e.target.value })}
                    style={{ ...sel, flexShrink: 0, cursor: "pointer", fontWeight: 700, fontSize: 12, padding: "7px 8px", color: c, background: `${c}1f`, border: `1px solid ${c}66` }}>
                    {SUPPLY_ORDER.map(v => <option key={v} value={v} style={{ background: "#FFFFFF", color: "#1D1D1F" }}>{SUPPLY_LABEL[v]}</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                  {p.po && <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 999, background: "#EEEEFF", border: "1px solid rgba(99,102,241,0.4)", color: "#3634A3" }}>
                    {p.po.po_number ? `PO ${p.po.po_number}` : "On a PO"}{p.po.supplier ? ` · ${p.po.supplier}` : ""}
                  </span>}
                  <label title="Wire, connectors, screws — stuff you don't track one by one" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6E6E73", cursor: "pointer" }}>
                    <input type="checkbox" checked={!!p.is_expendable} disabled={!p.id || saving} onChange={e => patchPart(String(p.id), { is_expendable: e.target.checked })} style={{ accentColor: "#0071E3", cursor: "pointer" }} />
                    Expendable
                  </label>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "#6E6E73" }}>{p.expected_at ? `Expected ${dayLabel(p.expected_at)}` : "Expected"}</span>
                    <input type="date" value={String(p.expected_at ?? "").slice(0, 10)} disabled={!p.id || saving} title="When do we expect it?"
                      onChange={e => patchPart(String(p.id), { expected_at: e.target.value || null })}
                      style={{ ...sel, colorScheme: "dark", padding: "5px 6px", cursor: "pointer" }} />
                  </span>
                </div>
              </div>;
            })}
          </div>}
          {/* Purchase orders raised for this job */}
          {jobPos.length > 0 && <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "#6E6E73", marginBottom: 6 }}>Purchase orders for this job</div>
            <div style={{ display: "grid", gap: 6 }}>
              {jobPos.map((po, i) => <div key={po.id || i} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", background: "#F5F5F7", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "8px 10px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{po.po_number ? `PO ${po.po_number}` : "No PO number"}</div>
                  <div style={{ fontSize: 12, color: "#6E6E73" }}>{po.supplier || "No supplier"}{po.expected_at ? ` · expected ${dayLabel(po.expected_at)}` : ""}</div>
                </div>
                <Badge tone={PO_STATUS_TONE[String(po.status)] ?? "default"}>{PO_STATUS_LABEL[String(po.status)] ?? String(po.status ?? "—")}</Badge>
              </div>)}
            </div>
          </div>}
        </Card>
        </>)}

        {tab === "Activity" && (<>
        {/* Team chat (was Messages) */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Team chat</h2>
          {comments.length === 0 ? <Small>No messages yet.</Small> : comments.map((c, i) => <p key={c.id || i} style={{ margin: "6px 0", fontSize: 14 }}><b>{c.author_name || c.created_by || "Team"}:</b> <span style={{ color: "#3A3A3C" }}>{c.content || c.body}</span></p>)}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input placeholder="Write a message…" value={chat} onChange={e => setChat(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addComment(); }} style={{ ...input, padding: 9 }} />
            <button onClick={addComment} style={btn}>Send</button>
          </div>
        </Card>

        {/* Customer sign-off (ServiceTitan / Housecall Pro style) */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: showSign ? 10 : 0 }}>
            <div>
              <h2 style={{ fontSize: 15 }}>Customer sign-off</h2>
              <Small>{signed ? "Signed ✓ — saved with the job photos." : "Have the customer sign on your phone or tablet when the work is done."}</Small>
            </div>
            {!showSign && <button type="button" onClick={() => setShowSign(true)} style={signed ? btn2 : btn}>{signed ? "Sign again" : "Get signature"}</button>}
          </div>
          {showSign && <SignOffPad onSave={saveSignature} onCancel={() => setShowSign(false)} busy={signBusy} />}
        </Card>

        {/* Photos (proof) */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15 }}>Photos ({photos.length})</h2>
            <label style={{ ...btn, padding: "6px 12px", display: "inline-block" }}>{woUploading ? "Uploading…" : "+ Photo"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadWoPhoto(f); e.target.value = ""; }} />
            </label>
          </div>
          {photos.length === 0 ? <Small>No photos yet. At least one is required to complete the job.</Small> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px,1fr))", gap: 8 }}>
            {photos.map((p, i) => <a key={p.id || i} href={p.file_url || p.url} target="_blank" rel="noreferrer" style={{ display: "block", borderRadius: 10, overflow: "hidden", border: "1px solid rgba(0,0,0,0.12)" }}>
              <img src={p.file_url || p.url} alt={p.caption || "Photo"} style={{ width: "100%", height: 84, objectFit: "cover", display: "block" }} />
            </a>)}
          </div>}
        </Card>

        {wo.description && <Card><h2 style={{ fontSize: 15 }}>Notes</h2><p style={{ color: "#3A3A3C", whiteSpace: "pre-wrap" }}>{wo.description}</p></Card>}

        {extraMsg && <div role="status" style={{ fontSize: 13, color: /didn|fail|couldn/i.test(extraMsg) ? "#D70015" : "#1A7F37", background: /didn|fail|couldn/i.test(extraMsg) ? "#FFECEC" : "#E8F6EC", borderRadius: 10, padding: "8px 12px" }}>{extraMsg}</div>}

        {/* Tasks linked to this job (they also show in To-Dos and on My Day) */}
        <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Tasks ({extra.tasks.length})</h2>
          {extra.tasks.length === 0 ? <Small>No tasks yet. Add follow-ups like “order the replacement motor”.</Small> : <div style={{ display: "grid", gap: 6 }}>
            {extra.tasks.map(t => { const done = t.status === "done" || t.status === "completed"; const due = t.due_date ? String(t.due_date).slice(0, 10) : null; const lateT = !!due && !done && due < todayKey();
              return <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#F7F8FA" }}>
                <span style={{ fontSize: 14, textDecoration: done ? "line-through" : undefined, color: done ? "#6E6E73" : INK }}>{t.title}</span>
                <span style={{ fontSize: 12.5, color: lateT ? "#D70015" : "#6E6E73", whiteSpace: "nowrap" }}>{due ? `${lateT ? "Late · " : ""}${dayLabel(due)}` : "No date"}</span>
              </div>; })}
          </div>}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input aria-label="New task" placeholder="Add a task…" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} onKeyDown={e => { if (e.key === "Enter") addJobTask(); }} style={{ ...input, padding: 9, flex: "1 1 200px" }} />
            <input aria-label="Task due date" type="date" value={taskForm.due} onChange={e => setTaskForm({ ...taskForm, due: e.target.value })} style={{ ...input, padding: 9, width: 150, flex: "0 0 auto" }} />
            <button onClick={addJobTask} disabled={extraBusy || !taskForm.title.trim()} style={{ ...btn, opacity: extraBusy || !taskForm.title.trim() ? 0.6 : 1 }}>Add</button>
          </div>
        </Card>

        {/* Files: drawings, quotes, permits, manuals */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15 }}>Files ({extra.files.length})</h2>
            <label style={{ ...btn, padding: "6px 12px", display: "inline-block" }}>{extraBusy ? "Working…" : "+ File"}
              <input type="file" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadJobFile(f); e.target.value = ""; }} />
            </label>
          </div>
          {extra.files.length === 0 ? <Small>No files yet. Add drawings, permits or the signed quote.</Small> : <div style={{ display: "grid", gap: 6 }}>
            {extra.files.map(f => <a key={f.id} href={f.url} target="_blank" rel="noreferrer" style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#F7F8FA", color: INK, textDecoration: "none", fontSize: 14 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.file_name || "File"}</span>
              <span style={{ fontSize: 12.5, color: "#6E6E73", whiteSpace: "nowrap" }}>{f.created_at ? dayLabel(String(f.created_at).slice(0, 10)) : ""}</span>
            </a>)}
          </div>}
        </Card>

        {/* Follow-up work orders spun off this job */}
        {extra.subs.length > 0 && <Card>
          <h2 style={{ fontSize: 15, marginBottom: 8 }}>Follow-up work orders ({extra.subs.length})</h2>
          <div style={{ display: "grid", gap: 6 }}>
            {extra.subs.map(w => <a key={w.id} href={`/maintenance/${w.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "8px 10px", borderRadius: 10, background: "#F7F8FA", color: INK, textDecoration: "none", fontSize: 14 }}>
              <span>{w.wo_number ? `${w.wo_number} · ` : ""}{w.title || "Work order"}</span>
              <span style={{ fontSize: 12.5, color: "#6E6E73", whiteSpace: "nowrap" }}>{bucketOf(String(w.status ?? ""))}{w.assignee_name ? ` · ${w.assignee_name}` : ""}</span>
            </a>)}
          </div>
        </Card>}
        </>)}

        {bucketOf(stOf(wo)) !== "Done" && <div>
          <button onClick={() => canComplete && patchField({ status: "completed" })} disabled={!canComplete} style={{ ...btn, width: "100%", background: canComplete ? "#248A3D" : "#F5F5F7", color: canComplete ? "white" : "#6E6E73", padding: 14, fontSize: 15, cursor: canComplete ? "pointer" : "not-allowed", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}><CheckCircle2 size={17} /> Complete Work Order</button>
          {!canComplete && <p style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#B25000", textAlign: "center", marginTop: 8 }}><Lock size={12} /> {completeBlockReason}</p>}
        </div>}
      </div>
      </>}
    </div>
  </div>;
}
