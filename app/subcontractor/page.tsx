"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Wrench, FileText, Upload, AlertTriangle, CheckCircle2, Clock, Shield, Building2, User } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { HardHat, ShieldAlert } = require("lucide-react") as any;
import { EmptyState } from "@/components/ui/EmptyState";
import { SlideOver, SlideOverFooter } from "@/components/ui/SlideOver";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkOrder {
  id: string;
  wo_number: string;
  title: string;
  customer_name: string;
  status: string;
  priority: string;
  job_type: string;
  scheduled_date: string | null;
  assignee_name: string | null;
  site_id: string | null;
}

interface CoiRecord {
  id: string;
  org_id: string;
  carrier_name: string;
  policy_number: string;
  coverage_amount: number;
  expiry_date: string;
  status: "active" | "expiring" | "expired";
  document_url: string | null;
  created_at: string;
}

interface PermitDoc {
  id: string;
  permit_number: string;
  site_name: string;
  permit_type: string;
  status: string;
  expiry_date: string | null;
  jurisdiction: string | null;
}

// ─── Status helpers ───────────────────────────────────────────────────────────

function WOStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open:        { label: "Open",        cls: "bg-blue-100 text-blue-700 border-blue-200" },
    in_progress: { label: "In Progress", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    completed:   { label: "Completed",   cls: "bg-green-100 text-green-700 border-green-200" },
    on_hold:     { label: "On Hold",     cls: "bg-gray-100 text-gray-600 border-gray-200" },
    cancelled:   { label: "Cancelled",   cls: "bg-red-100 text-red-600 border-red-200" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function CoiStatusBadge({ status }: { status: string }) {
  if (status === "active")   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700 border border-green-200"><CheckCircle2 size={10} /> Active</span>;
  if (status === "expiring") return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200"><AlertTriangle size={10} /> Expiring</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200"><AlertTriangle size={10} /> Expired</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubcontractorPage() {
  const [workOrders, setWorkOrders]   = useState<WorkOrder[]>([]);
  const [coi, setCoi]                 = useState<CoiRecord | null>(null);
  const [permits, setPermits]         = useState<PermitDoc[]>([]);
  const [loading, setLoading]         = useState(true);
  const [coiOpen, setCoiOpen]         = useState(false);
  const [uploading, setUploading]     = useState(false);

  // COI upload form state
  const [coiForm, setCoiForm] = useState({
    carrier_name: "",
    policy_number: "",
    coverage_amount: "",
    expiry_date: "",
  });
  const [coiFile, setCoiFile] = useState<File | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [woRes, coiRes, permitsRes] = await Promise.all([
        fetch("/api/maintenance?limit=50"),
        fetch("/api/compliance/coi"),
        fetch("/api/permits?limit=20"),
      ]);

      if (woRes.ok) {
        const d = await woRes.json();
        setWorkOrders(d.work_orders ?? []);
      }
      if (coiRes.ok) {
        const d = await coiRes.json();
        setCoi(d.coi ?? null);
      }
      if (permitsRes.ok) {
        const d = await permitsRes.json();
        setPermits(d.permits ?? []);
      }
    } catch {
      // graceful fallback — show empty states
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCoiUpload = async () => {
    if (!coiForm.carrier_name || !coiForm.policy_number || !coiForm.expiry_date) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("carrier_name", coiForm.carrier_name);
      formData.append("policy_number", coiForm.policy_number);
      formData.append("coverage_amount", coiForm.coverage_amount);
      formData.append("expiry_date", coiForm.expiry_date);
      if (coiFile) formData.append("document", coiFile);

      const res = await fetch("/api/compliance/coi", { method: "POST", body: formData });
      if (res.ok) {
        setCoiOpen(false);
        setCoiForm({ carrier_name: "", policy_number: "", coverage_amount: "", expiry_date: "" });
        setCoiFile(null);
        await fetchData();
      }
    } finally {
      setUploading(false);
    }
  };

  // ─── Summary stats ─────────────────────────────────────────────────────────
  const openWOs      = workOrders.filter(w => w.status === "open").length;
  const inProgressWOs = workOrders.filter(w => w.status === "in_progress").length;
  const completedWOs = workOrders.filter(w => w.status === "completed").length;
  const coiOk        = coi?.status === "active";
  const coiMissing   = !coi;

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6B7EFF]/10 flex items-center justify-center">
            <HardHat size={20} className="text-[#6B7EFF]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Subcontractor Portal</h1>
            <p className="text-sm text-muted-foreground">Your assigned work orders, documents, and compliance status</p>
          </div>
          <div className="ml-auto">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20">
              Install Partner
            </span>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-7xl">

        {/* ── COI Alert Banner ──────────────────────────────────────────── */}
        {coiMissing && !loading && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200">
            <ShieldAlert size={18} className="text-red-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-800">No COI on file — upload required to receive work orders</p>
              <p className="text-xs text-red-600 mt-0.5">A current Certificate of Insurance is required before work orders can be assigned to your org.</p>
            </div>
            <button
              onClick={() => setCoiOpen(true)}
              className="shrink-0 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              Upload COI
            </button>
          </div>
        )}

        {coi?.status === "expiring" && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 flex-1">
              Your COI expires on {new Date(coi.expiry_date).toLocaleDateString()} — please upload a renewal soon.
            </p>
            <button onClick={() => setCoiOpen(true)} className="shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">
              Update COI
            </button>
          </div>
        )}

        {/* ── Stats Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Open WOs",      value: openWOs,       icon: <Wrench size={16} className="text-blue-500" />,   color: "text-blue-700"  },
            { label: "In Progress",   value: inProgressWOs, icon: <Clock size={16} className="text-amber-500" />,   color: "text-amber-700" },
            { label: "Completed",     value: completedWOs,  icon: <CheckCircle2 size={16} className="text-green-500" />, color: "text-green-700" },
            { label: "COI Status",    value: coiMissing ? "None" : coi?.status === "active" ? "Active" : coi?.status === "expiring" ? "Expiring" : "Expired",
              icon: <Shield size={16} className={coiOk ? "text-green-500" : "text-red-500"} />,
              color: coiOk ? "text-green-700" : "text-red-700" },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                {stat.icon}
              </div>
              <div>
                <p className={`text-lg font-bold ${stat.color}`}>{loading ? "—" : stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── My Work Orders ────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Wrench size={15} className="text-[#6B7EFF]" />
              My Work Orders
            </h2>
            <Link href="/maintenance" className="text-xs text-[#6B7EFF] font-medium hover:underline">
              View all →
            </Link>
          </div>

          <div className="bg-white border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="divide-y divide-border">
                {[1,2,3].map(i => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4 animate-pulse">
                    <div className="w-24 h-4 bg-muted rounded" />
                    <div className="flex-1 h-4 bg-muted rounded" />
                    <div className="w-20 h-5 bg-muted rounded-full" />
                    <div className="w-24 h-4 bg-muted rounded" />
                  </div>
                ))}
              </div>
            ) : workOrders.length === 0 ? (
              <EmptyState
                icon={<Wrench size={24} className="text-muted-foreground" />}
                title="No work orders assigned"
                description="Work orders assigned to your organization will appear here."
              />
            ) : (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[100px_1fr_120px_120px_140px_80px] gap-4 px-4 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>WO #</span>
                  <span>Property / Title</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Scheduled</span>
                  <span></span>
                </div>
                <div className="divide-y divide-border">
                  {workOrders.map(wo => (
                    <div key={wo.id} className="grid grid-cols-[100px_1fr_120px_120px_140px_80px] gap-4 px-4 py-3 items-center hover:bg-muted/30 transition-colors text-sm">
                      <span className="font-mono text-xs font-semibold text-[#6B7EFF]">
                        #{wo.wo_number}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{wo.title}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Building2 size={10} /> {wo.customer_name}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{wo.job_type}</span>
                      <WOStatusBadge status={wo.status} />
                      <span className="text-xs text-muted-foreground">
                        {wo.scheduled_date
                          ? new Date(wo.scheduled_date).toLocaleDateString()
                          : <span className="text-gray-400">—</span>}
                      </span>
                      <Link
                        href={`/maintenance/${wo.id}`}
                        className="text-xs font-medium text-[#6B7EFF] hover:underline text-right"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* ── Documents + COI ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Permit Documents */}
          <section>
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <FileText size={15} className="text-[#6B7EFF]" />
              Permits &amp; Documents
            </h2>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              {loading ? (
                <div className="divide-y divide-border">
                  {[1,2].map(i => (
                    <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                      <div className="w-32 h-4 bg-muted rounded" />
                      <div className="flex-1 h-4 bg-muted rounded" />
                      <div className="w-16 h-5 bg-muted rounded-full" />
                    </div>
                  ))}
                </div>
              ) : permits.length === 0 ? (
                <EmptyState
                  icon={<FileText size={22} className="text-muted-foreground" />}
                  title="No permits on file"
                  description="Permits associated with your work sites appear here."
                />
              ) : (
                <div className="divide-y divide-border">
                  {permits.map(p => (
                    <div key={p.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{p.permit_number}</p>
                        <p className="text-xs text-muted-foreground">{p.site_name} · {p.permit_type}</p>
                      </div>
                      {p.expiry_date && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          Exp {new Date(p.expiry_date).toLocaleDateString()}
                        </span>
                      )}
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        p.status === "compliant" ? "bg-green-100 text-green-700 border-green-200" :
                        p.status === "expiring"  ? "bg-amber-100 text-amber-700 border-amber-200" :
                        "bg-red-100 text-red-700 border-red-200"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* COI Status Card */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Shield size={15} className="text-[#6B7EFF]" />
                Certificate of Insurance
              </h2>
              <button
                onClick={() => setCoiOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee0] transition-colors"
              >
                <Upload size={12} /> Upload COI
              </button>
            </div>

            <div className="bg-white border border-border rounded-xl p-5">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              ) : !coi ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-3">
                    <ShieldAlert size={22} className="text-red-500" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No COI on file</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">Upload your Certificate of Insurance to receive work order assignments.</p>
                  <button
                    onClick={() => setCoiOpen(true)}
                    className="px-4 py-2 bg-[#6B7EFF] text-white rounded-lg text-xs font-semibold hover:bg-[#5a6ee0] transition-colors"
                  >
                    Upload COI Now
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
                    <CoiStatusBadge status={coi.status} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Carrier</span>
                    <span className="text-sm font-semibold text-foreground">{coi.carrier_name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Policy #</span>
                    <span className="text-sm font-mono text-foreground">{coi.policy_number}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Coverage</span>
                    <span className="text-sm font-semibold text-foreground">
                      {coi.coverage_amount ? `$${Number(coi.coverage_amount).toLocaleString()}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Expires</span>
                    <span className={`text-sm font-semibold ${coi.status === "expired" ? "text-red-600" : coi.status === "expiring" ? "text-amber-600" : "text-foreground"}`}>
                      {new Date(coi.expiry_date).toLocaleDateString()}
                    </span>
                  </div>
                  {coi.document_url && (
                    <a
                      href={coi.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[#6B7EFF] font-medium hover:underline mt-1"
                    >
                      <FileText size={12} /> View Document
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── COI Upload SlideOver ──────────────────────────────────────── */}
      <SlideOver
        open={coiOpen}
        onClose={() => setCoiOpen(false)}
        title="Upload Certificate of Insurance"
        subtitle="Provide your current COI details below."
        size="md"
        footer={
          <SlideOverFooter
            onCancel={() => setCoiOpen(false)}
            onSave={handleCoiUpload}
            saveLabel="Submit COI"
            saving={uploading}
            disabled={!coiForm.carrier_name || !coiForm.policy_number || !coiForm.expiry_date}
          />
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Carrier Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={coiForm.carrier_name}
              onChange={e => setCoiForm(f => ({ ...f, carrier_name: e.target.value }))}
              placeholder="e.g. Travelers, Nationwide, State Farm"
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Policy Number <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={coiForm.policy_number}
              onChange={e => setCoiForm(f => ({ ...f, policy_number: e.target.value }))}
              placeholder="e.g. GL-1234567-89"
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Coverage Amount</label>
            <input
              type="number"
              value={coiForm.coverage_amount}
              onChange={e => setCoiForm(f => ({ ...f, coverage_amount: e.target.value }))}
              placeholder="e.g. 1000000"
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Expiry Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={coiForm.expiry_date}
              onChange={e => setCoiForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full h-9 px-3 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">COI Document (PDF or image)</label>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-[#6B7EFF]/40 transition-colors"
              onClick={() => document.getElementById("coi-file-input")?.click()}
            >
              <Upload size={20} className="mx-auto text-muted-foreground mb-2" />
              {coiFile ? (
                <p className="text-sm font-semibold text-foreground">{coiFile.name}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG up to 20MB</p>
                </>
              )}
              <input
                id="coi-file-input"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="hidden"
                onChange={e => setCoiFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700 flex items-start gap-1.5">
              <User size={12} className="shrink-0 mt-0.5" />
              GateGuard must be listed as an additional insured on your policy. Please verify this with your insurance carrier before submitting.
            </p>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}
