"use client";
import { useState } from "react";
import {
  ArrowRightLeft, Upload, CheckCircle2, AlertCircle,
  ChevronRight, FileText, Users, DollarSign, Wrench,
  ArrowRight, Loader2, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "upload" | "preview" | "confirm" | "done";

// ── SYNTHETIC PREVIEW DATA ──────────────────────────────────────────────────
const previewData = {
  dealer: "Gulf Coast A/V",
  exportDate: "May 4, 2026",
  records: [
    { category: "Customers",     icon: Users,     count: 84,   mapped: 84,   skipped: 0, color: "#3B5BDB" },
    { category: "Work Orders",   icon: Wrench,    count: 312,  mapped: 308,  skipped: 4, color: "#0B7285" },
    { category: "Quotes",        icon: FileText,  count: 147,  mapped: 147,  skipped: 0, color: "#7C3AED" },
    { category: "Commission Log",icon: DollarSign,count: 1840, mapped: 1840, skipped: 0, color: "#15803D" },
  ],
  warnings: [
    "4 work orders reference archived SARA product codes — these will be imported as legacy line items.",
    "Commission records before Jan 2024 use a legacy rate table — imported as-is for historical reference.",
  ],
};

const fieldMappings = [
  { sara: "cust_id",        nexus: "organization.id",         status: "mapped"   },
  { sara: "cust_name",      nexus: "organization.name",       status: "mapped"   },
  { sara: "cust_addr",      nexus: "organization.address",    status: "mapped"   },
  { sara: "wo_number",      nexus: "maintenance.work_order",  status: "mapped"   },
  { sara: "wo_status_code", nexus: "maintenance.status",      status: "mapped"   },
  { sara: "dtv_acct",       nexus: "directv.account_id",      status: "mapped"   },
  { sara: "sara_prod_code", nexus: "products.sku",            status: "partial"  },
  { sara: "sara_arch_code", nexus: "(legacy field)",          status: "warning"  },
];

export default function MigratePage() {
  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  function simulateUpload() {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setStep("preview");
    }, 1800);
  }

  function simulateMigrate() {
    setMigrating(true);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 18 + 4;
      if (p >= 100) {
        clearInterval(iv);
        setProgress(100);
        setTimeout(() => {
          setMigrating(false);
          setStep("done");
        }, 600);
      } else {
        setProgress(Math.round(p));
      }
    }, 300);
  }

  const steps: { id: Step; label: string }[] = [
    { id: "upload",  label: "Upload SARA Export" },
    { id: "preview", label: "Review Mapping"     },
    { id: "confirm", label: "Confirm & Import"   },
    { id: "done",    label: "Complete"            },
  ];

  const stepIdx: Record<Step, number> = { upload: 0, preview: 1, confirm: 2, done: 3 };
  const current = stepIdx[step];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ background: "#3B5BDB" }}
        >
          AT
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">SARA Bridge</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#EEF0FF", color: "#3B5BDB" }}>
              Powered by ATLAS
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Migrate your entire SARA Plus history into GateGuard Nexus in 48 hours. No data lost.
          </p>
        </div>
      </div>

      {/* Pitch bar */}
      <div
        className="rounded-xl p-4 border"
        style={{ background: "#EEF0FF", borderColor: "#C5CAF5" }}
      >
        <div className="flex items-center gap-3">
          <ShieldCheck size={18} style={{ color: "#3B5BDB" }} className="shrink-0" />
          <p className="text-sm font-medium" style={{ color: "#3B5BDB" }}>
            You don&apos;t lose your data. You don&apos;t start over. You level up.
          </p>
          <span className="ml-auto text-xs font-medium" style={{ color: "#6B7EFF" }}>
            ATLAS maps every SARA field to Nexus automatically
          </span>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                i < current
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : i === current
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-400"
              )}>
                {i < current ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-1 text-center leading-tight",
                i === current
                  ? "text-indigo-600 dark:text-indigo-400"
                  : i < current
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-400"
              )}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mb-4 transition-all",
                i < current ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Step 1 — Export from SARA Plus</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              In SARA Plus go to <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Admin → Data Export → Full Export (CSV)</span>.
              Download the ZIP file and upload it below.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); simulateUpload(); }}
              onClick={simulateUpload}
              className={cn(
                "border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-all",
                dragOver
                  ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 size={32} className="text-indigo-500 animate-spin" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Reading SARA export…</p>
                  <p className="text-xs text-gray-400">ATLAS is mapping fields to Nexus schema</p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Upload size={22} style={{ color: "#3B5BDB" }} />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">Drop your SARA export ZIP here</p>
                    <p className="text-xs text-gray-400 mt-1">or click to browse · CSV or ZIP · up to 500 MB</p>
                  </div>
                </>
              )}
            </div>

            {/* What transfers list */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              {["Customer accounts", "Work order history", "Quote records", "Commission logs", "Contact information", "DirecTV account IDs"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === "preview" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Step 2 — Review What Transfers</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Dealer: <span className="font-medium text-gray-700 dark:text-gray-200">{previewData.dealer}</span>
                  &nbsp;·&nbsp;Export date: {previewData.exportDate}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Mapped by</p>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <div className="w-4 h-4 rounded text-white font-bold text-[8px] flex items-center justify-center" style={{ background: "#3B5BDB" }}>AT</div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">ATLAS</span>
                </div>
              </div>
            </div>

            {/* Record counts */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {previewData.records.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.category} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                    <Icon size={14} className="mb-2" style={{ color: r.color }} />
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{r.count.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{r.category}</p>
                    <p className="text-[10px] mt-1">
                      <span className="text-emerald-500 font-medium">{r.mapped} mapped</span>
                      {r.skipped > 0 && <span className="text-amber-500 ml-1">· {r.skipped} flagged</span>}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Field mappings */}
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Field Mapping Preview</h3>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">SARA Field</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500 w-5">→</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Nexus Field</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {fieldMappings.map((m) => (
                    <tr key={m.sara} className="hover:bg-gray-50 dark:hover:bg-gray-700/20">
                      <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-300">{m.sara}</td>
                      <td className="px-3 py-2 text-gray-400"><ArrowRight size={10} /></td>
                      <td className="px-3 py-2 font-mono text-gray-600 dark:text-gray-300">{m.nexus}</td>
                      <td className="px-3 py-2">
                        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                          m.status === "mapped"   ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                          m.status === "partial"  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
                                                    "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        )}>
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warnings */}
          {previewData.warnings.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {previewData.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-300">{w}</p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={() => setStep("confirm")}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ background: "#3B5BDB" }}
            >
              Looks good — continue
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step: Confirm */}
      {step === "confirm" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Step 3 — Confirm & Import</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              This will import 2,383 records from SARA Plus into GateGuard Nexus. The import runs in the background —
              you can keep working. You&apos;ll receive an email when it&apos;s complete.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
            {[
              ["Dealer",         previewData.dealer    ],
              ["Total records",  "2,383"               ],
              ["Est. time",      "Under 48 hours"      ],
              ["SARA data",      "Preserved in archive"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">{k}</span>
                <span className="font-medium text-gray-900 dark:text-white">{v}</span>
              </div>
            ))}
          </div>

          {migrating && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Importing records…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%`, background: "#3B5BDB" }}
                />
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <button
              onClick={() => setStep("preview")}
              className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={simulateMigrate}
              disabled={migrating}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60"
              style={{ background: "#3B5BDB" }}
            >
              {migrating ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
              {migrating ? "Importing…" : "Start Import"}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === "done" && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 size={32} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Migration started</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
              2,383 records are being imported from SARA Plus into GateGuard Nexus.
              You&apos;ll receive a confirmation email within 48 hours.
            </p>
          </div>
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-5 py-3">
            <p className="text-sm font-medium" style={{ color: "#3B5BDB" }}>
              Your SARA subscription can now be cancelled.
            </p>
          </div>
          <button
            onClick={() => window.location.href = "/"}
            className="mt-2 text-sm font-medium px-5 py-2 rounded-lg text-white transition-colors"
            style={{ background: "#3B5BDB" }}
          >
            Back to Dashboard
          </button>
        </div>
      )}

    </div>
  );
}
