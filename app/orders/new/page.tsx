"use client";
import { useState } from "react";
import {
  MapPin, User, CreditCard, Tv, Calendar, CheckCircle2,
  AlertCircle, Loader2, ChevronRight, Zap, Phone, Mail,
  Home, Shield, Wifi, TrendingUp, Clock, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── TYPES ───────────────────────────────────────────────────────────────────
type Step = "address" | "customer" | "package" | "schedule" | "confirm";
type CreditResult = "LOW" | "MEDIUM" | "HIGH" | "REVIEW" | null;
type Package = { id: string; name: string; price: number; features: string[]; tag?: string };

// ─── PACKAGES (simulates ATLAS PD response for a qualifying address) ──────────
const PACKAGES: Package[] = [
  {
    id: "CHOICE",
    name: "DIRECTV CHOICE",
    price: 84.99,
    features: ["185+ channels", "3 months SHOWTIME® included", "HD DVR Genie included", "1 additional receiver"],
    tag: "Most Popular",
  },
  {
    id: "CHOICE_PLUS",
    name: "DIRECTV CHOICE+",
    price: 99.99,
    features: ["250+ channels", "6 months SHOWTIME® included", "HD DVR Genie included", "Up to 3 additional receivers", "Regional Sports Networks"],
    tag: "Best Value",
  },
  {
    id: "ULTIMATE",
    name: "DIRECTV ULTIMATE",
    price: 119.99,
    features: ["330+ channels", "12 months SHOWTIME® included", "HD DVR Genie included", "Up to 4 additional receivers", "Regional Sports Networks", "STARZ®"],
  },
  {
    id: "SELECT",
    name: "DIRECTV SELECT",
    price: 69.99,
    features: ["155+ channels", "HD DVR Genie included", "1 additional receiver"],
  },
];

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: "address",  label: "Address",    icon: MapPin     },
  { id: "customer", label: "Customer",   icon: User       },
  { id: "package",  label: "Package",    icon: Tv         },
  { id: "schedule", label: "Schedule",   icon: Calendar   },
  { id: "confirm",  label: "Confirm",    icon: CheckCircle2 },
];

const STEP_ORDER: Step[] = ["address", "customer", "package", "schedule", "confirm"];

const creditColors: Record<string, string> = {
  LOW:    "text-emerald-600 bg-emerald-50 border-emerald-200",
  MEDIUM: "text-amber-600 bg-amber-50 border-amber-200",
  HIGH:   "text-red-600 bg-red-50 border-red-200",
  REVIEW: "text-violet-600 bg-violet-50 border-violet-200",
};

const creditLabels: Record<string, string> = {
  LOW: "Low Risk — Approved", MEDIUM: "Medium Risk — Conditional",
  HIGH: "High Risk — Deposit Required", REVIEW: "Manual Review Required",
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function NewOrderPage() {
  const [step, setStep] = useState<Step>("address");
  const [addressChecked, setAddressChecked] = useState(false);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [checkingCredit, setCheckingCredit] = useState(false);
  const [creditResult, setCreditResult] = useState<CreditResult>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [installType, setInstallType] = useState<"COMBINED" | "SELF" | "SPLIT">("COMBINED");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    street: "", city: "", state: "GA", zip: "",
    firstName: "", lastName: "", phone: "", email: "",
    ssn4: "", dob: "",
    installDate: "", installWindow: "08:00-12:00", techId: "",
  });

  const stepIndex = STEP_ORDER.indexOf(step);

  function setField(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  function checkAddress() {
    setCheckingAddress(true);
    setTimeout(() => { setCheckingAddress(false); setAddressChecked(true); }, 1600);
  }

  function runCreditCheck() {
    setCheckingCredit(true);
    setTimeout(() => {
      setCheckingCredit(false);
      // Simulate credit result based on SSN4 for demo
      const results: CreditResult[] = ["LOW", "LOW", "LOW", "MEDIUM", "HIGH", "REVIEW"];
      setCreditResult(results[Math.floor(Math.random() * results.length)]);
    }, 2200);
  }

  function submitOrder() {
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setSubmitted(true); }, 2800);
  }

  const orderId = `ACT-${2842 + Math.floor(Math.random() * 100)}`;
  const pkg = PACKAGES.find(p => p.id === selectedPackage);

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "#EEF0FF" }}>
          <CheckCircle2 size={32} style={{ color: "#3B5BDB" }} />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Order Submitted</h1>
        <p className="text-muted-foreground mb-1">Order ID: <span className="font-mono font-semibold text-foreground">{orderId}</span></p>
        <p className="text-muted-foreground mb-6">ATLAS has transmitted the order to AT&T Gateway · Response code 0000 (Success)</p>
        <div className="bg-card border border-border rounded-2xl p-5 text-left space-y-2 mb-6">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Customer</span><span className="font-medium text-foreground">{form.firstName} {form.lastName}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Address</span><span className="font-medium text-foreground">{form.street}, {form.city}, {form.state} {form.zip}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Package</span><span className="font-medium text-foreground">{pkg?.name}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Install</span><span className="font-medium text-foreground">{form.installDate} · {form.installWindow}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Credit Tier</span><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", creditColors[creditResult||"LOW"])}>{creditLabels[creditResult||"LOW"]}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Install Type</span><span className="font-medium text-foreground">{installType}</span></div>
        </div>
        <div className="flex gap-3 justify-center">
          <a href="/orders" className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">View All Orders</a>
          <a href="/dispatch" className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors" style={{ background: "#3B5BDB" }}>Go to Dispatch</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
          style={{ background: "#3B5BDB" }}>AT</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">New AT&T / DIRECTV Order</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#EEF0FF", color: "#3B5BDB" }}>ATLAS</span>
          </div>
          <p className="text-sm text-muted-foreground">Powered by GateGuard Nexus — AT&T Order Gateway integration</p>
        </div>
      </div>

      {/* Step bar */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center">
          {STEPS.map((s, i) => {
            const done = STEP_ORDER.indexOf(s.id) < stepIndex;
            const active = s.id === step;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    active ? "text-white" : done ? "text-white" : "bg-muted text-muted-foreground"
                  )} style={active ? { background: "#3B5BDB" } : done ? { background: "#10b981" } : {}}>
                    {done ? <CheckCircle2 size={16} /> : <Icon size={15} />}
                  </div>
                  <span className={cn("text-[10px] font-medium whitespace-nowrap",
                    active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn("flex-1 h-0.5 mx-2 mb-4 transition-all",
                    done ? "bg-emerald-400" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── STEP: ADDRESS ─────────────────────────────────────────────────────── */}
      {step === "address" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Customer Service Address</h2>
            <p className="text-sm text-muted-foreground">ATLAS will run an address lookup to confirm available AT&T / DIRECTV packages at this location.</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Street Address</label>
              <input value={form.street} onChange={e => setField("street", e.target.value)}
                placeholder="e.g. 2847 Cascade Rd SW"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">City</label>
                <input value={form.city} onChange={e => setField("city", e.target.value)}
                  placeholder="Atlanta"
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">State</label>
                <select value={form.state} onChange={e => setField("state", e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40">
                  {["AL","FL","GA","NC","SC","TN","TX","VA"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">ZIP</label>
                <input value={form.zip} onChange={e => setField("zip", e.target.value)}
                  placeholder="30311" maxLength={5}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
              </div>
            </div>
          </div>

          {/* Address check result */}
          {addressChecked && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Address Validated — {PACKAGES.length} packages available</span>
                <span className="ml-auto text-xs text-emerald-600 dark:text-emerald-500 font-mono">Code: 0000</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {["DIRECTV Available", "AT&T IPBB Available", "ATV Bundle Available", "eSIM Eligible"].map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-800/40 text-emerald-700 dark:text-emerald-300 font-medium">{tag}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            {!addressChecked ? (
              <button onClick={checkAddress}
                disabled={!form.street || !form.city || !form.zip || checkingAddress}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
                style={{ background: "#3B5BDB" }}>
                {checkingAddress ? <><Loader2 size={14} className="animate-spin" /> Checking with ATLAS...</> : <><MapPin size={14} /> Check Address</>}
              </button>
            ) : (
              <button onClick={() => setStep("customer")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all"
                style={{ background: "#3B5BDB" }}>
                Continue <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: CUSTOMER INFO + CREDIT CHECK ────────────────────────────────── */}
      {step === "customer" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Customer Information</h2>
            <p className="text-sm text-muted-foreground">Enter customer details, then run the ATLAS credit & fraud check.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label:"First Name", key:"firstName", placeholder:"Marcus",                icon:<User size={13}/> },
              { label:"Last Name",  key:"lastName",  placeholder:"Williams",              icon:<User size={13}/> },
              { label:"Phone",      key:"phone",     placeholder:"(404) 555-0182",        icon:<Phone size={13}/> },
              { label:"Email",      key:"email",     placeholder:"m.williams@email.com",  icon:<Mail size={13}/> },
              { label:"Last 4 SSN", key:"ssn4",      placeholder:"••••",                  icon:<Shield size={13}/> },
              { label:"Date of Birth", key:"dob",    placeholder:"MM/DD/YYYY",            icon:<Calendar size={13}/> },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1.5 block">
                  {f.icon} {f.label}
                </label>
                <input value={(form as any)[f.key]} onChange={e => setField(f.key, e.target.value)}
                  placeholder={f.placeholder} type={f.key === "ssn4" ? "password" : "text"}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
              </div>
            ))}
          </div>

          {/* Credit check result */}
          {creditResult && (
            <div className={cn("rounded-xl border p-4", creditColors[creditResult])}>
              <div className="flex items-center gap-2 mb-1">
                {creditResult === "LOW" ? <CheckCircle2 size={15}/> : <AlertCircle size={15}/>}
                <span className="text-sm font-semibold">{creditLabels[creditResult]}</span>
                <span className="ml-auto text-xs font-mono opacity-70">CC Response: 0000</span>
              </div>
              <p className="text-xs opacity-80">
                {creditResult === "LOW" && "Customer qualifies for standard terms. No deposit required."}
                {creditResult === "MEDIUM" && "Customer qualifies with conditional approval. Confirm billing info."}
                {creditResult === "HIGH" && "Deposit required before activation. Collect $199 setup fee."}
                {creditResult === "REVIEW" && "Analyst review required. Do not proceed until cleared by AT&T."}
              </p>
            </div>
          )}

          <div className="flex justify-between gap-3">
            <button onClick={() => setStep("address")} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted/40 transition-colors">
              Back
            </button>
            <div className="flex gap-3">
              {!creditResult ? (
                <button onClick={runCreditCheck}
                  disabled={!form.firstName || !form.lastName || !form.ssn4 || checkingCredit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-all"
                  style={{ background: "#0B7285" }}>
                  {checkingCredit ? <><Loader2 size={14} className="animate-spin"/>Running Credit Check...</> : <><Shield size={14}/>Run Credit Check</>}
                </button>
              ) : (creditResult !== "REVIEW" && (
                <button onClick={() => setStep("package")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
                  style={{ background: "#3B5BDB" }}>
                  Select Package <ChevronRight size={14}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: PACKAGE SELECTION ────────────────────────────────────────────── */}
      {step === "package" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Select Package & Install Type</h2>
            <p className="text-sm text-muted-foreground">Available DIRECTV packages for {form.street}, {form.city} · Credit tier: <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", creditColors[creditResult||"LOW"])}>{creditResult}</span></p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map(pkg => (
              <div key={pkg.id}
                onClick={() => setSelectedPackage(pkg.id)}
                className={cn(
                  "relative rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-sm",
                  selectedPackage === pkg.id ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10" : "border-border hover:border-border/80"
                )}>
                {pkg.tag && (
                  <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#EEF0FF", color: "#3B5BDB" }}>{pkg.tag}</span>
                )}
                <div className="flex items-start gap-2 mb-2">
                  <div className={cn("w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center",
                    selectedPackage === pkg.id ? "border-indigo-500" : "border-gray-300")}>
                    {selectedPackage === pkg.id && <div className="w-2 h-2 rounded-full" style={{ background: "#3B5BDB" }}/>}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{pkg.name}</p>
                    <p className="text-xl font-bold mt-0.5" style={{ color: "#3B5BDB" }}>${pkg.price}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
                  </div>
                </div>
                <ul className="space-y-1 ml-6">
                  {pkg.features.map(f => (
                    <li key={f} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <CheckCircle2 size={11} className="text-emerald-500 shrink-0"/>{f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Install Type</label>
            <div className="flex gap-3">
              {(["COMBINED", "SELF", "SPLIT"] as const).map(t => (
                <button key={t} onClick={() => setInstallType(t)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                    installType === t ? "border-indigo-500 text-indigo-600 dark:text-indigo-400" : "border-border text-muted-foreground hover:border-border/60"
                  )}>
                  {t === "COMBINED" ? "Combined Install" : t === "SELF" ? "Self Install" : "Split Install"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between">
            <button onClick={() => setStep("customer")} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted/40 transition-colors">Back</button>
            <button onClick={() => setStep("schedule")} disabled={!selectedPackage}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#3B5BDB" }}>
              Schedule Install <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: SCHEDULE ────────────────────────────────────────────────────── */}
      {step === "schedule" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Schedule Installation</h2>
            <p className="text-sm text-muted-foreground">Select install date and window. Available techs shown from Dispatch.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Install Date</label>
              <input type="date" value={form.installDate} onChange={e => setField("installDate", e.target.value)} min={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5 block">Window</label>
              <select value={form.installWindow} onChange={e => setField("installWindow", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-brand-400/40">
                <option value="08:00-12:00">Morning (8am – 12pm)</option>
                <option value="12:00-16:00">Afternoon (12pm – 4pm)</option>
                <option value="16:00-20:00">Evening (4pm – 8pm)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">Assign Technician (from Dispatch)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id:"T01", name:"Carlos Rivera",    jobs:3, rating:4.9 },
                { id:"T02", name:"James Patel",      jobs:2, rating:4.8 },
                { id:"T03", name:"Denise Hall",      jobs:4, rating:4.7 },
              ].map(t => (
                <button key={t.id} onClick={() => setField("techId", t.id)}
                  className={cn(
                    "p-3 rounded-xl border-2 text-left transition-all",
                    form.techId === t.id ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10" : "border-border hover:border-border/60"
                  )}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold mb-1.5"
                    style={{ background: "#3B5BDB" }}>{t.name.split(" ").map(n=>n[0]).join("")}</div>
                  <p className="text-xs font-semibold text-foreground">{t.name}</p>
                  <p className="text-[10px] text-muted-foreground">{t.jobs} jobs today · ★{t.rating}</p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep("package")} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted/40 transition-colors">Back</button>
            <button onClick={() => setStep("confirm")} disabled={!form.installDate || !form.techId}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
              style={{ background: "#3B5BDB" }}>
              Review Order <ChevronRight size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: CONFIRM ─────────────────────────────────────────────────────── */}
      {step === "confirm" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Review & Submit Order</h2>
            <p className="text-sm text-muted-foreground">ATLAS will transmit to AT&T Order Gateway (Response code 0000 expected)</p>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            {[
              { label:"Customer",      value:`${form.firstName} ${form.lastName}` },
              { label:"Address",       value:`${form.street}, ${form.city}, ${form.state} ${form.zip}` },
              { label:"Phone / Email", value:`${form.phone} · ${form.email}` },
              { label:"Package",       value:pkg?.name || "—" },
              { label:"Monthly Price", value:`$${pkg?.price}/mo` },
              { label:"Install Type",  value:installType },
              { label:"Install Date",  value:`${form.installDate} · ${form.installWindow}` },
              { label:"Credit Tier",   value:creditLabels[creditResult||"LOW"] },
              { label:"AT&T Gateway",  value:"api.saraplus.com/api/prod → Nexus ATLAS layer" },
            ].map((r, i) => (
              <div key={r.label} className={cn("flex items-center justify-between px-4 py-3 text-sm",
                i < 8 ? "border-b border-border" : "")}>
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium text-foreground text-right max-w-xs">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep("schedule")} className="px-4 py-2.5 rounded-lg text-sm text-muted-foreground border border-border hover:bg-muted/40 transition-colors">Back</button>
            <button onClick={submitOrder} disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-70 transition-all"
              style={{ background: "#3B5BDB" }}>
              {submitting ? <><Loader2 size={14} className="animate-spin"/>Transmitting to AT&T...</> : <><Zap size={14}/>Submit Order via ATLAS</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
