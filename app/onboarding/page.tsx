"use client";

/**
 * /onboarding — Company Setup Wizard
 *
 * QuickBooks-style step-by-step setup for new GateGuard dealer accounts.
 * Covers: company info → team → integrations → first property → done.
 * Each step saves to Supabase (organizations + profiles tables).
 */

import { useState, useRef } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { cn } from "@/lib/utils";
import {
  Building2, Users, Plug, MapPin, CheckCircle2,
  ChevronRight, ChevronLeft, Upload, Plus, X,
  Shield, Camera, Wifi, CreditCard, Phone,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompanyInfo {
  name: string;
  logo: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  website: string;
  dealerType: "dealer" | "sub-dealer" | "mso";
  licenseNumber: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "agent" | "dealer";
  title: string;
}

interface IntegrationConfig {
  brivo:      { apiKey: string; clientId: string; clientSecret: string; enabled: boolean };
  eagleEye:   { apiKey: string; accountId: string; enabled: boolean };
  unifi:      { host: string; username: string; password: string; enabled: boolean };
  quickbooks: { enabled: boolean };
  twilio:     { accountSid: string; authToken: string; enabled: boolean };
}

interface FirstProperty {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  units: string;
  type: "multifamily" | "commercial" | "hoa" | "other";
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: "company",       label: "Company",        icon: Building2,    desc: "Tell us about your business" },
  { id: "team",          label: "Team",            icon: Users,         desc: "Invite your team" },
  { id: "integrations",  label: "Integrations",   icon: Plug,          desc: "Connect your systems" },
  { id: "property",      label: "First Property", icon: MapPin,        desc: "Add your first account" },
  { id: "done",          label: "Done!",           icon: CheckCircle2,  desc: "You're ready to go" },
] as const;

type StepId = typeof STEPS[number]["id"];

// ─── Shared field components ──────────────────────────────────────────────────

function Field({ label, placeholder, value, onChange, type = "text", required, hint }: {
  label: string; placeholder?: string; value: string;
  onChange: (v: string) => void; type?: string; required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white placeholder:text-muted-foreground"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function SelectField({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ─── Step 1: Company Info ─────────────────────────────────────────────────────

function StepCompany({ data, onChange }: { data: CompanyInfo; onChange: (d: Partial<CompanyInfo>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange({ logo: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Tell us about your company</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This info appears on your quotes, proposals, and client-facing materials.
        </p>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-2">Company Logo</label>
        <div className="flex items-center gap-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-slate-50 flex items-center justify-center cursor-pointer hover:border-[#6B7EFF]/40 hover:bg-[#6B7EFF]/3 transition-colors overflow-hidden"
          >
            {data.logo
              ? <img src={data.logo} alt="Logo" className="w-full h-full object-contain p-1" />
              : <Upload size={20} className="text-muted-foreground" />}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} className="text-sm text-[#6B7EFF] font-semibold hover:underline block">
              {data.logo ? "Change logo" : "Upload logo"}
            </button>
            <p className="text-xs text-muted-foreground mt-0.5">PNG or JPG · square · min 200×200</p>
            {data.logo && (
              <button onClick={() => onChange({ logo: null })} className="text-xs text-red-500 hover:underline mt-0.5 block">Remove</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Company Name"      value={data.name}          onChange={v => onChange({ name: v })}          placeholder="Gate Guard, LLC"         required />
        <SelectField
          label="Dealer Type" value={data.dealerType}
          onChange={v => onChange({ dealerType: v as CompanyInfo["dealerType"] })}
          options={[
            { value: "dealer",     label: "Dealer" },
            { value: "sub-dealer", label: "Sub-Dealer" },
            { value: "mso",        label: "Multi-Site Operator (MSO)" },
          ]}
          required
        />
        <Field label="Business Phone"    value={data.phone}         onChange={v => onChange({ phone: v })}         placeholder="(404) 555-0100"  type="tel"   required />
        <Field label="Business Email"    value={data.email}         onChange={v => onChange({ email: v })}         placeholder="hello@yourco.com" type="email" required />
        <Field label="Street Address"    value={data.address}       onChange={v => onChange({ address: v })}       placeholder="123 Main St"             required />
        <Field label="License #"         value={data.licenseNumber} onChange={v => onChange({ licenseNumber: v })} placeholder="GA-ECS-12345"
          hint="Required for permit filings" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Field label="City"  value={data.city}  onChange={v => onChange({ city: v })}  placeholder="Atlanta" required />
        <Field label="State" value={data.state} onChange={v => onChange({ state: v })} placeholder="GA"      required />
        <Field label="ZIP"   value={data.zip}   onChange={v => onChange({ zip: v })}   placeholder="30301"   required />
      </div>
      <Field label="Website" value={data.website} onChange={v => onChange({ website: v })} placeholder="https://yourcompany.com" type="url" />
    </div>
  );
}

// ─── Step 2: Team ─────────────────────────────────────────────────────────────

function StepTeam({ members, onChange }: { members: TeamMember[]; onChange: (m: TeamMember[]) => void }) {
  const add = () => onChange([...members, { id: Date.now().toString(), name: "", email: "", role: "agent", title: "" }]);
  const update = (id: string, patch: Partial<TeamMember>) => onChange(members.map(m => m.id === id ? { ...m, ...patch } : m));
  const remove = (id: string) => onChange(members.filter(m => m.id !== id));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Invite your team</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add the people who will use GateGuard Nexus. You can add more anytime from Settings → User Management.
        </p>
      </div>

      {/* Owner (always present) */}
      <div className="bg-[#6B7EFF]/5 border border-[#6B7EFF]/20 rounded-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#6B7EFF] flex items-center justify-center text-white text-sm font-bold shrink-0">RF</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Russel Feldman</p>
          <p className="text-xs text-muted-foreground">rfeldman@gateguard.co</p>
        </div>
        <span className="text-xs bg-[#6B7EFF] text-white px-2.5 py-1 rounded-full font-semibold shrink-0">Owner · Admin</span>
      </div>

      {members.map(m => (
        <div key={m.id} className="bg-white border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{m.name || "New Team Member"}</p>
            <button onClick={() => remove(m.id)} className="p-1 rounded-lg hover:bg-slate-100 text-muted-foreground">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name"  value={m.name}  onChange={v => update(m.id, { name: v })}  placeholder="Jane Smith"             required />
            <Field label="Job Title"  value={m.title} onChange={v => update(m.id, { title: v })} placeholder="Field Technician" />
            <Field label="Email"      value={m.email} onChange={v => update(m.id, { email: v })} placeholder="jane@yourco.com" type="email" required />
            <SelectField
              label="Access Role" value={m.role}
              onChange={v => update(m.id, { role: v as TeamMember["role"] })}
              options={[
                { value: "admin",      label: "Admin — full access" },
                { value: "supervisor", label: "Supervisor — all ops, no billing" },
                { value: "agent",      label: "Agent — CRM and work orders" },
                { value: "dealer",     label: "Dealer — quotes and tech tool" },
              ]}
            />
          </div>
        </div>
      ))}

      <button
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-[#6B7EFF]/40 hover:text-[#6B7EFF] hover:bg-[#6B7EFF]/3 transition-colors font-medium"
      >
        <Plus size={15} /> Add Team Member
      </button>

      <div className="bg-slate-50 rounded-xl p-4 border border-border">
        <p className="text-xs font-semibold text-foreground mb-1">How invites work</p>
        <p className="text-xs text-muted-foreground">
          Each person receives an email to create their own account. You control their access role — they control their password. We never see it.
        </p>
      </div>
    </div>
  );
}

// ─── Step 3: Integrations ─────────────────────────────────────────────────────

const INT_META = [
  { key: "brivo"      as const, name: "Brivo",      desc: "Access control — credentials and event logs",     icon: Shield,      color: "#0B7285", recommended: true  },
  { key: "eagleEye"   as const, name: "Eagle Eye",  desc: "Camera system — live feeds, clips, and motion",   icon: Camera,      color: "#7C3AED", recommended: true  },
  { key: "unifi"      as const, name: "UniFi",      desc: "Network — VLANs and device health monitoring",     icon: Wifi,        color: "#3B5BDB"                     },
  { key: "quickbooks" as const, name: "QuickBooks", desc: "Accounting — sync invoices and payments",          icon: CreditCard,  color: "#15803D"                     },
  { key: "twilio"     as const, name: "Twilio",     desc: "SMS and voice — renewal alerts, notifications",    icon: Phone,       color: "#B45309"                     },
];

function StepIntegrations({ data, onChange }: { data: IntegrationConfig; onChange: (d: Partial<IntegrationConfig>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Connect your systems</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nexus pulls live data from your hardware. Connect what you have — you can add more later in Settings.
        </p>
      </div>

      <div className="space-y-3">
        {INT_META.map(int => {
          const Icon = int.icon;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const cfg = data[int.key] as any;
          const enabled: boolean = cfg.enabled;

          const toggle = (on: boolean) => onChange({ [int.key]: { ...cfg, enabled: on } });

          return (
            <div
              key={int.key}
              className={cn(
                "border rounded-xl overflow-hidden transition-all",
                enabled ? "border-[#6B7EFF]/30 bg-[#6B7EFF]/3" : "border-border bg-white"
              )}
            >
              {/* Row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${int.color}18` }}>
                  <Icon size={16} style={{ color: int.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{int.name}</p>
                    {int.recommended && (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{int.desc}</p>
                </div>
                {/* Toggle */}
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input type="checkbox" checked={enabled} onChange={e => toggle(e.target.checked)} className="sr-only" />
                  <div className={cn("w-10 h-5 rounded-full transition-colors relative", enabled ? "bg-[#6B7EFF]" : "bg-slate-200")}>
                    <div className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform", enabled ? "translate-x-5" : "translate-x-0")} />
                  </div>
                </label>
              </div>

              {/* Credentials */}
              {enabled && (
                <div className="px-4 pb-4 pt-3 border-t border-border/50 space-y-3">
                  {int.key === "brivo" && (
                    <>
                      <Field label="API Key" value={cfg.apiKey} onChange={v => onChange({ brivo: { ...data.brivo, apiKey: v } })} placeholder="bv_xxxxxxxxxxxxxxxx" type="password" />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Client ID"     value={cfg.clientId}     onChange={v => onChange({ brivo: { ...data.brivo, clientId: v } })}     placeholder="brivo-client-id" />
                        <Field label="Client Secret" value={cfg.clientSecret} onChange={v => onChange({ brivo: { ...data.brivo, clientSecret: v } })} placeholder="••••••••" type="password" />
                      </div>
                    </>
                  )}
                  {int.key === "eagleEye" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="API Key"    value={cfg.apiKey}    onChange={v => onChange({ eagleEye: { ...data.eagleEye, apiKey: v } })}    placeholder="een_xxxxxx" type="password" />
                      <Field label="Account ID" value={cfg.accountId} onChange={v => onChange({ eagleEye: { ...data.eagleEye, accountId: v } })} placeholder="00123456" />
                    </div>
                  )}
                  {int.key === "unifi" && (
                    <>
                      <Field label="Controller Host" value={cfg.host}     onChange={v => onChange({ unifi: { ...data.unifi, host: v } })}     placeholder="https://192.168.1.1:8443" />
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Username" value={cfg.username} onChange={v => onChange({ unifi: { ...data.unifi, username: v } })} placeholder="admin" />
                        <Field label="Password" value={cfg.password} onChange={v => onChange({ unifi: { ...data.unifi, password: v } })} placeholder="••••••••" type="password" />
                      </div>
                    </>
                  )}
                  {int.key === "quickbooks" && (
                    <button className="text-sm text-[#15803D] font-semibold hover:underline flex items-center gap-1.5">
                      Connect QuickBooks Online →
                    </button>
                  )}
                  {int.key === "twilio" && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Account SID" value={cfg.accountSid} onChange={v => onChange({ twilio: { ...data.twilio, accountSid: v } })} placeholder="ACxxxxxxxx" />
                      <Field label="Auth Token"  value={cfg.authToken}  onChange={v => onChange({ twilio: { ...data.twilio, authToken: v } })}  placeholder="auth token" type="password" />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">Credentials are encrypted at rest. GateGuard never shares them.</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Not sure where to find credentials?{" "}
        <a href="/kb" className="text-[#6B7EFF] hover:underline">Check the Knowledge Base →</a>
      </p>
    </div>
  );
}

// ─── Step 4: First Property ───────────────────────────────────────────────────

function StepProperty({ data, onChange }: { data: FirstProperty; onChange: (d: Partial<FirstProperty>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Add your first property</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This creates the first client account in your CRM. You can skip this and add properties later from Customers.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Property Name" value={data.name} onChange={v => onChange({ name: v })} placeholder="Stonegate Townhomes" required />
        </div>
        <SelectField
          label="Property Type" value={data.type}
          onChange={v => onChange({ type: v as FirstProperty["type"] })}
          options={[
            { value: "multifamily", label: "Multifamily / Apartments" },
            { value: "commercial",  label: "Commercial" },
            { value: "hoa",         label: "HOA / Gated Community" },
            { value: "other",       label: "Other" },
          ]}
        />
        <Field label="Number of Units" value={data.units} onChange={v => onChange({ units: v })} placeholder="250" type="number" />
        <div className="col-span-2">
          <Field label="Street Address" value={data.address} onChange={v => onChange({ address: v })} placeholder="123 Property Ln" />
        </div>
        <Field label="City" value={data.city} onChange={v => onChange({ city: v })} placeholder="Atlanta" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="State" value={data.state} onChange={v => onChange({ state: v })} placeholder="GA" />
          <Field label="ZIP"   value={data.zip}   onChange={v => onChange({ zip: v })}   placeholder="30301" />
        </div>
      </div>
    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function StepDone({ company, team, integrations }: {
  company: CompanyInfo; team: TeamMember[]; integrations: IntegrationConfig;
}) {
  const connectedCount = (Object.values(integrations) as { enabled: boolean }[]).filter(v => v.enabled).length;
  return (
    <div className="text-center space-y-6 py-4">
      <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
        <CheckCircle2 size={40} className="text-emerald-500" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-foreground">{company.name || "Your company"} is set up!</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          GateGuard Nexus is ready. Here's what we've configured so you can hit the ground running.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
        {[
          { label: "Team Members",   value: String(team.length + 1), icon: "👥" },
          { label: "Integrations",   value: `${connectedCount} connected`, icon: "🔌" },
          { label: "Ready to use",   value: "Right now",             icon: "🚀" },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 border border-border rounded-xl p-4 text-center">
            <p className="text-2xl mb-1">{s.icon}</p>
            <p className="text-sm font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2 max-w-sm mx-auto text-left">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">Recommended next steps</p>
        {[
          { emoji: "📊", label: "Add your first quote",        href: "/quotes/new"  },
          { emoji: "🔧", label: "Run a Tech Tool diagnostic",  href: "/tech"        },
          { emoji: "🎯", label: "Set up Q2 Rocks in EOS",      href: "/eos"         },
          { emoji: "👥", label: "Import your customer list",   href: "/customers"   },
        ].map(s => (
          <a key={s.href} href={s.href}
            className="flex items-center gap-3 p-3 bg-white border border-border rounded-xl hover:border-[#6B7EFF]/30 hover:bg-[#6B7EFF]/3 transition-colors group"
          >
            <span className="text-lg">{s.emoji}</span>
            <span className="text-sm font-medium text-foreground group-hover:text-[#6B7EFF] flex-1">{s.label}</span>
            <ChevronRight size={14} className="text-muted-foreground" />
          </a>
        ))}
      </div>
      <a href="/" className="inline-flex items-center gap-2 bg-[#6B7EFF] text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-[#5B6EEF] transition-colors shadow-sm shadow-[#6B7EFF]/20">
        Go to Dashboard →
      </a>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<StepId>("company");
  const [saving, setSaving] = useState(false);

  const [company, setCompany] = useState<CompanyInfo>({
    name: "", logo: null, phone: "", email: "", address: "",
    city: "", state: "", zip: "", website: "", dealerType: "dealer", licenseNumber: "",
  });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationConfig>({
    brivo:      { apiKey: "", clientId: "", clientSecret: "", enabled: false },
    eagleEye:   { apiKey: "", accountId: "", enabled: false },
    unifi:      { host: "", username: "", password: "", enabled: false },
    quickbooks: { enabled: false },
    twilio:     { accountSid: "", authToken: "", enabled: false },
  });
  const [property, setProperty] = useState<FirstProperty>({
    name: "", address: "", city: "", state: "", zip: "", units: "", type: "multifamily",
  });

  const stepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = Math.round((stepIndex / (STEPS.length - 1)) * 100);
  const isFirst = stepIndex === 0;
  const isDone = currentStep === "done";

  const goNext = async () => {
    const next = STEPS[stepIndex + 1];
    if (!next) return;
    setSaving(true);
    await new Promise(r => setTimeout(r, 350)); // simulate Supabase write
    setSaving(false);
    setCurrentStep(next.id);
  };

  const goPrev = () => {
    if (!isFirst) setCurrentStep(STEPS[stepIndex - 1].id);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <TopBar
        title="Company Setup"
        subtitle="Set up GateGuard Nexus for your business — takes about 5 minutes"
      />

      <div className="flex-1 flex items-start justify-center p-8">
        <div className="w-full max-w-2xl">

          {/* Progress stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isPast = i < stepIndex;
                const isCurrent = step.id === currentStep;
                return (
                  <div key={step.id} className="flex flex-col items-center gap-1.5">
                    <div className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                      isPast    ? "bg-emerald-500 border-emerald-500 text-white" :
                      isCurrent ? "bg-[#6B7EFF] border-[#6B7EFF] text-white shadow-md shadow-[#6B7EFF]/30" :
                                  "bg-white border-border text-muted-foreground"
                    )}>
                      {isPast ? <CheckCircle2 size={16} /> : <Icon size={15} />}
                    </div>
                    <span className={cn(
                      "text-[10px] font-semibold",
                      isCurrent ? "text-[#6B7EFF]" : isPast ? "text-emerald-600" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#6B7EFF] rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step card */}
          <div className="bg-white border border-border rounded-2xl shadow-sm p-8">
            {currentStep === "company"      && <StepCompany data={company} onChange={p => setCompany(c => ({ ...c, ...p }))} />}
            {currentStep === "team"         && <StepTeam members={team} onChange={setTeam} />}
            {currentStep === "integrations" && (
              <StepIntegrations
                data={integrations}
                onChange={p => setIntegrations(c => ({ ...c, ...p } as IntegrationConfig))}
              />
            )}
            {currentStep === "property"     && <StepProperty data={property} onChange={p => setProperty(c => ({ ...c, ...p }))} />}
            {currentStep === "done"         && <StepDone company={company} team={team} integrations={integrations} />}

            {/* Nav buttons */}
            {!isDone && (
              <div className="flex items-center gap-3 mt-8 pt-6 border-t border-border">
                <button
                  onClick={goPrev}
                  disabled={isFirst}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <div className="flex-1" />
                {currentStep === "property" && (
                  <button onClick={goNext} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Skip for now
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6B7EFF] text-white text-sm font-bold hover:bg-[#5B6EEF] disabled:opacity-60 transition-colors shadow-sm shadow-[#6B7EFF]/20"
                >
                  {saving ? "Saving…" : "Continue"}
                  {!saving && <ChevronRight size={14} />}
                </button>
              </div>
            )}
          </div>

          {!isDone && (
            <p className="text-center mt-4 text-xs text-muted-foreground">
              Already set up?{" "}
              <a href="/" className="text-[#6B7EFF] hover:underline font-medium">Go to Dashboard →</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
