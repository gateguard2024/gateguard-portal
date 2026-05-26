"use client";

import { useState } from "react";
import Image from "next/image";
import {
  Shield, AlertTriangle, CheckCircle2, Clock, Eye, EyeOff,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HardHat, Briefcase, Wrench, CalendarDays, MapPin, ArrowRight } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicSubcontractor {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  trade: string | null;
  license_expiry: string | null;
  insurance_expiry: string | null;
  status: string;
}

interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  customer_name: string;
  status: string;
  priority: string;
  job_type: string;
  scheduled_date: string | null;
  description: string | null;
  site_id: string | null;
}

interface Assignment {
  id: string;
  work_order_id: string;
  assigned_at: string;
  notes: string | null;
  work_orders: WorkOrder;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function WOStatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    open:        { label: "Open",        cls: "bg-blue-100 text-blue-700",   icon: <Clock size={10} /> },
    in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-700", icon: <Clock size={10} /> },
    completed:   { label: "Completed",   cls: "bg-green-100 text-green-700", icon: <CheckCircle2 size={10} /> },
    on_hold:     { label: "On Hold",     cls: "bg-gray-100 text-gray-600",   icon: <Clock size={10} /> },
    cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-600",     icon: <AlertTriangle size={10} /> },
  };
  const { label, cls, icon } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>
      {icon} {label}
    </span>
  );
}

function PriorityChip({ priority }: { priority: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    urgent:   { label: "Urgent",   cls: "bg-red-100 text-red-700"    },
    high:     { label: "High",     cls: "bg-orange-100 text-orange-700" },
    normal:   { label: "Normal",   cls: "bg-gray-100 text-gray-600"  },
    low:      { label: "Low",      cls: "bg-blue-50 text-blue-600"   },
  };
  const { label, cls } = map[priority] ?? { label: priority, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${cls}`}>
      {label}
    </span>
  );
}

function daysDiff(date: string): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SubcontractorPortalPage() {
  const [code, setCode]             = useState("");
  const [showCode, setShowCode]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [sub, setSub]               = useState<PublicSubcontractor | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subcontractors/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_code: code.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Invalid access code. Please try again.");
        return;
      }
      const d = await res.json();
      setSub(d.subcontractor);
      setAssignments(d.assignments ?? []);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSignOut() {
    setSub(null);
    setAssignments([]);
    setCode("");
    setError(null);
  }

  // ─── Login Screen ────────────────────────────────────────────────
  if (!sub) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
        {/* Top bar */}
        <header className="bg-[#0B1728] px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center">
            <HardHat size={16} className="text-[#6B7EFF]" />
          </div>
          <div>
            <span className="text-sm font-black tracking-[0.12em] uppercase text-[#6B7EFF]">NEXUS</span>
            <span className="text-xs text-white/40 ml-1.5">by GateGuard</span>
          </div>
        </header>

        {/* Login card */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="bg-white border border-border rounded-2xl shadow-sm p-8">
              {/* Icon */}
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-[#6B7EFF]/10 flex items-center justify-center">
                  <HardHat size={32} className="text-[#6B7EFF]" />
                </div>
              </div>

              <h1 className="text-xl font-bold text-foreground text-center mb-1">
                Subcontractor Portal
              </h1>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Enter your 8-character access code to view your assigned work orders.
              </p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Access Code
                  </label>
                  <div className="relative">
                    <input
                      type={showCode ? "text" : "password"}
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                      placeholder="XXXXXXXX"
                      maxLength={8}
                      autoComplete="off"
                      autoCapitalize="characters"
                      className="w-full h-11 px-4 pr-10 text-center font-mono text-lg font-bold tracking-widest border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background uppercase"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowCode(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                    <AlertTriangle size={14} className="text-red-500 shrink-0" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length < 6}
                  className="w-full h-11 bg-[#6B7EFF] text-white font-semibold rounded-xl hover:bg-[#5a6ee0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    <>Access Portal <ArrowRight size={15} /></>
                  )}
                </button>
              </form>

              <p className="text-xs text-muted-foreground text-center mt-6">
                Access code provided by your GateGuard dealer.
                <br />
                Need help? Contact <a href="mailto:support@gateguard.co" className="text-[#6B7EFF] hover:underline">support@gateguard.co</a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-4">
          <p className="text-xs text-muted-foreground">Powered by GateGuard</p>
        </footer>
      </div>
    );
  }

  // ─── Authenticated Portal ────────────────────────────────────────
  const openWOs     = assignments.filter(a => a.work_orders?.status === "open").length;
  const inProgWOs   = assignments.filter(a => a.work_orders?.status === "in_progress").length;
  const doneWOs     = assignments.filter(a => a.work_orders?.status === "completed").length;

  const licenseWarning  = sub.license_expiry   && daysDiff(sub.license_expiry)   <= 30;
  const insuranceWarning = sub.insurance_expiry && daysDiff(sub.insurance_expiry) <= 30;
  const licenseExpired  = sub.license_expiry   && daysDiff(sub.license_expiry)   < 0;
  const insuranceExpired = sub.insurance_expiry && daysDiff(sub.insurance_expiry) < 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Top bar */}
      <header className="bg-[#0B1728] px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center">
          <HardHat size={16} className="text-[#6B7EFF]" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-black tracking-[0.12em] uppercase text-[#6B7EFF]">NEXUS</span>
          <span className="text-xs text-white/40 ml-1.5">Subcontractor Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-white">{sub.name}</p>
            {sub.company && <p className="text-[10px] text-white/50">{sub.company}</p>}
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-white/50 hover:text-white transition-colors underline"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full p-4 space-y-4 pb-8">

        {/* ── Compliance Warnings ───────────────────────────────── */}
        {(licenseExpired || insuranceExpired) && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Compliance action required</p>
              <ul className="text-xs text-red-700 mt-1 space-y-0.5">
                {licenseExpired   && <li>• Your contractor license has expired</li>}
                {insuranceExpired && <li>• Your insurance has expired</li>}
              </ul>
              <p className="text-xs text-red-600 mt-1">Contact your GateGuard dealer to update your records.</p>
            </div>
          </div>
        )}
        {!licenseExpired && !insuranceExpired && (licenseWarning || insuranceWarning) && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Renewal reminder</p>
              <ul className="text-xs text-amber-700 mt-1 space-y-0.5">
                {licenseWarning   && <li>• License expires {new Date(sub.license_expiry!).toLocaleDateString()}</li>}
                {insuranceWarning && <li>• Insurance expires {new Date(sub.insurance_expiry!).toLocaleDateString()}</li>}
              </ul>
            </div>
          </div>
        )}

        {/* ── Profile Card ─────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-[#6B7EFF]/10 border border-[#6B7EFF]/20 flex items-center justify-center">
              <span className="text-lg font-black text-[#6B7EFF]">
                {sub.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-bold text-foreground">{sub.name}</p>
              {sub.company && <p className="text-xs text-muted-foreground">{sub.company}</p>}
              {sub.trade   && <p className="text-xs font-medium text-[#6B7EFF] mt-0.5">{sub.trade}</p>}
            </div>
            <div className="ml-auto">
              {sub.status === "active"
                ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 size={11} /> Active</span>
                : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700"><AlertTriangle size={11} /> {sub.status}</span>
              }
            </div>
          </div>

          {/* Compliance grid */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">License Expiry</p>
              {sub.license_expiry ? (
                <p className={`text-sm font-semibold ${licenseExpired ? "text-red-600" : licenseWarning ? "text-amber-600" : "text-foreground"}`}>
                  {new Date(sub.license_expiry).toLocaleDateString()}
                </p>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Insurance Expiry</p>
              {sub.insurance_expiry ? (
                <p className={`text-sm font-semibold ${insuranceExpired ? "text-red-600" : insuranceWarning ? "text-amber-600" : "text-foreground"}`}>
                  {new Date(sub.insurance_expiry).toLocaleDateString()}
                </p>
              ) : <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </div>
        </div>

        {/* ── WO Stats ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Open",        value: openWOs,   color: "text-blue-700",  bg: "bg-blue-50"  },
            { label: "In Progress", value: inProgWOs, color: "text-amber-700", bg: "bg-amber-50" },
            { label: "Completed",   value: doneWOs,   color: "text-green-700", bg: "bg-green-50" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-border rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Work Order Cards ─────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Wrench size={14} className="text-[#6B7EFF]" />
            Assigned Work Orders
          </h2>

          {assignments.length === 0 ? (
            <div className="bg-white border border-border rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Wrench size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">No work orders assigned yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your dealer will assign work orders here. Check back soon.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => {
                const wo = a.work_orders;
                if (!wo) return null;
                return (
                  <div key={a.id} className="bg-white border border-border rounded-xl p-4 shadow-sm">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{wo.title}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">#{wo.wo_number}</p>
                      </div>
                      <WOStatusChip status={wo.status} />
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin size={11} className="shrink-0 text-[#6B7EFF]" />
                        <span className="truncate">{wo.customer_name}</span>
                      </div>
                      {wo.scheduled_date && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarDays size={11} className="shrink-0 text-[#6B7EFF]" />
                          <span>{new Date(wo.scheduled_date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                        </div>
                      )}
                      {wo.description && (
                        <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border line-clamp-2">
                          {wo.description}
                        </p>
                      )}
                    </div>

                    {/* Footer chips */}
                    <div className="flex items-center gap-2 mt-3">
                      <PriorityChip priority={wo.priority} />
                      {wo.job_type && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {wo.job_type}
                        </span>
                      )}
                      {a.notes && (
                        <span className="ml-auto text-[11px] text-muted-foreground italic truncate max-w-[140px]">
                          {a.notes}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Powered by <span className="font-semibold text-[#6B7EFF]">GateGuard</span></p>
      </footer>
    </div>
  );
}
