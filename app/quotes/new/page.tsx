'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, MapPin, Users, ChevronRight, ChevronLeft,
  Plus, Minus, Check, DollarSign, FileText,
  Camera, Shield, Phone, Mail, Loader2,
} from 'lucide-react';
import {
  calculateLineItems, calculateTotals, generateQuoteNumber,
  formatCurrency, getValidUntilDate,
} from '@/lib/quote-calculator';
import { QuoteProperty, SiteSurvey, GateCondition, CallboxTier } from '@/types/quote';

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Property',    icon: Building2 },
  { id: 2, label: 'Site Survey', icon: Shield },
  { id: 3, label: 'Line Items',  icon: DollarSign },
  { id: 4, label: 'Review',      icon: FileText },
];

// ── Default state ─────────────────────────────────────────────────────────────
const defaultProperty: QuoteProperty = {
  name: '', address: '', city: '', state: 'GA', zip: '',
  units: 0, contactName: '', contactEmail: '', contactPhone: '',
  propertyManager: '', managementCompany: '',
};

const defaultSurvey: SiteSurvey = {
  vehicularGates: [{ condition: 'working', qty: 1 }],
  amenityDoors: [],
  callboxes: [{ tier: 'tier2_replace', qty: 1 }],
  cameras: { newCameras: 0, existingCameras: 0 },
};

// ── Reusable counter ──────────────────────────────────────────────────────────
function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg border border-border bg-background hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-sm font-semibold text-foreground">{value}</span>
      <button onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg border border-border bg-background hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text' }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [property, setProperty] = useState<QuoteProperty>(defaultProperty);
  const [survey, setSurvey] = useState<SiteSurvey>(defaultSurvey);
  const [saving, setSaving] = useState(false);

  const prop = (key: keyof QuoteProperty) => (val: string) =>
    setProperty(p => ({ ...p, [key]: key === 'units' ? parseInt(val) || 0 : val }));

  // Derived line items + totals (recalculated live)
  const lineItems = calculateLineItems(survey, property);
  const totals = calculateTotals(lineItems, property);

  // ── Step 1: Property ────────────────────────────────────────────────────────
  const Step1 = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Field label="Property Name" required>
            <Input value={property.name} onChange={prop('name')} placeholder="e.g. East Ponce Village" />
          </Field>
        </div>
        <div className="col-span-2">
          <Field label="Street Address">
            <Input value={property.address} onChange={prop('address')} placeholder="123 Main Street" />
          </Field>
        </div>
        <Field label="City">
          <Input value={property.city} onChange={prop('city')} placeholder="Atlanta" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="State">
            <Input value={property.state} onChange={prop('state')} placeholder="GA" />
          </Field>
          <Field label="ZIP">
            <Input value={property.zip} onChange={prop('zip')} placeholder="30328" />
          </Field>
        </div>
        <Field label="Total Units" required>
          <Input value={property.units || ''} onChange={prop('units')} placeholder="120" type="number" />
        </Field>
        <div className="col-span-1" />
      </div>

      <div className="border-t border-border pt-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Primary Contact</p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact Name">
            <Input value={property.contactName} onChange={prop('contactName')} placeholder="Jane Smith" />
          </Field>
          <Field label="Phone">
            <Input value={property.contactPhone} onChange={prop('contactPhone')} placeholder="(404) 555-0100" />
          </Field>
          <Field label="Email">
            <Input value={property.contactEmail} onChange={prop('contactEmail')} placeholder="jane@property.com" />
          </Field>
          <Field label="Property Manager">
            <Input value={property.propertyManager || ''} onChange={prop('propertyManager')} placeholder="Jane Smith" />
          </Field>
          <div className="col-span-2">
            <Field label="Management Company">
              <Input value={property.managementCompany || ''} onChange={prop('managementCompany')} placeholder="Columbia Residential" />
            </Field>
          </div>
        </div>
      </div>

      {/* Live monthly estimate */}
      {property.units > 0 && (
        <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-4">
          <p className="text-xs text-brand-400 font-semibold uppercase tracking-wide mb-1">Estimated Monthly Service</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(Math.max(property.units * 10, 1200))}
            <span className="text-sm font-normal text-muted-foreground">/mo</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {property.units} units @ $10/unit
            {property.units * 10 < 1200 && ' — minimum $1,200/mo applies'}
          </p>
        </div>
      )}
    </div>
  );

  // ── Step 2: Site Survey ─────────────────────────────────────────────────────
  const Step2 = () => (
    <div className="space-y-6">

      {/* Vehicular Gates */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Vehicular Gates</p>
          <button
            onClick={() => setSurvey(s => ({ ...s, vehicularGates: [...s.vehicularGates, { condition: 'working', qty: 1 }] }))}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add gate type
          </button>
        </div>
        {survey.vehicularGates.map((gate, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-t border-border first:border-0 first:pt-0">
            <div className="flex gap-2">
              {(['working','non_working'] as GateCondition[]).map(c => (
                <button key={c} onClick={() => setSurvey(s => {
                  const g = [...s.vehicularGates]; g[i] = { ...g[i], condition: c }; return { ...s, vehicularGates: g };
                })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    gate.condition === c
                      ? c === 'working' ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  {c === 'working' ? '✓ Working' : '⚠ Non-Working'}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Counter value={gate.qty} onChange={qty => setSurvey(s => {
              const g = [...s.vehicularGates]; g[i] = { ...g[i], qty }; return { ...s, vehicularGates: g };
            })} min={0} />
            <p className="text-xs text-muted-foreground w-20 text-right">
              {formatCurrency(gate.condition === 'working' ? 500 : 750)} ea.
            </p>
          </div>
        ))}
      </div>

      {/* Pedestrian Gates / Amenity Doors */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Pedestrian Gates / Amenity Doors</p>
          <button
            onClick={() => setSurvey(s => ({ ...s, amenityDoors: [...s.amenityDoors, { condition: 'working', qty: 1 }] }))}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {survey.amenityDoors.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No amenity doors added</p>
        )}
        {survey.amenityDoors.map((door, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-t border-border first:border-0 first:pt-0">
            <div className="flex gap-2">
              {(['working','non_working'] as GateCondition[]).map(c => (
                <button key={c} onClick={() => setSurvey(s => {
                  const d = [...s.amenityDoors]; d[i] = { ...d[i], condition: c }; return { ...s, amenityDoors: d };
                })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    door.condition === c
                      ? c === 'working' ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  {c === 'working' ? '✓ Working' : '⚠ Non-Working'}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <Counter value={door.qty} onChange={qty => setSurvey(s => {
              const d = [...s.amenityDoors]; d[i] = { ...d[i], qty }; return { ...s, amenityDoors: d };
            })} min={0} />
            <p className="text-xs text-muted-foreground w-20 text-right">
              {formatCurrency(door.condition === 'working' ? 500 : 750)} ea.
            </p>
          </div>
        ))}
      </div>

      {/* Callboxes */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Callboxes</p>
          <button
            onClick={() => setSurvey(s => ({ ...s, callboxes: [...s.callboxes, { tier: 'tier2_replace', qty: 1 }] }))}
            className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
        {survey.callboxes.map((cb, i) => (
          <div key={i} className="space-y-2 py-3 border-t border-border first:border-0 first:pt-0">
            <div className="flex gap-2 flex-wrap">
              {([
                { tier: 'tier1_remove', label: 'Tier 1 — Remove (QR Sign)', price: 'Included' },
                { tier: 'tier2_replace', label: 'Tier 2 — Replace (Unifi)', price: '$2,500' },
                { tier: 'tier3_retain', label: 'Tier 3 — Retain (Legacy)', price: 'N/A' },
              ] as const).map(({ tier, label, price }) => (
                <button key={tier} onClick={() => setSurvey(s => {
                  const c = [...s.callboxes]; c[i] = { ...c[i], tier }; return { ...s, callboxes: c };
                })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                    cb.tier === tier
                      ? 'bg-brand-400/10 border-brand-400/30 text-brand-400'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}>
                  {label} <span className="opacity-60">{price}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-3">
              <Counter value={cb.qty} onChange={qty => setSurvey(s => {
                const c = [...s.callboxes]; c[i] = { ...c[i], qty }; return { ...s, callboxes: c };
              })} min={0} />
            </div>
          </div>
        ))}
      </div>

      {/* Cameras */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-4">Cameras</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">New Camera Installations</p>
              <p className="text-xs text-muted-foreground">Free with contract · $100/mo monitoring</p>
            </div>
            <Counter
              value={survey.cameras.newCameras}
              onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, newCameras: v } }))}
            />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-sm text-foreground">Existing Cameras (monitoring only)</p>
              <p className="text-xs text-muted-foreground">No setup fee · $85/mo monitoring</p>
            </div>
            <Counter
              value={survey.cameras.existingCameras}
              onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existingCameras: v } }))}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 3: Line Items ──────────────────────────────────────────────────────
  const Step3 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Review and adjust line items below. All pricing auto-calculated from your survey.</p>

      {/* One-time */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-background/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">One-Time Setup Fees</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground px-5 py-2">Description</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Qty</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Unit Price</th>
              <th className="text-right text-xs text-muted-foreground px-5 py-2">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineItems.filter(i => !i.recurring).map(item => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-sm text-foreground">{item.description}</td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                <td className="px-5 py-3 text-sm text-right font-medium text-foreground">{formatCurrency(item.total)}</td>
              </tr>
            ))}
            <tr className="bg-background/50">
              <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-foreground text-right">Setup Total</td>
              <td className="px-5 py-3 text-sm font-bold text-foreground text-right">{formatCurrency(totals.setupTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Monthly */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-background/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Recurring</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground px-5 py-2">Description</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Qty</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Unit Price</th>
              <th className="text-right text-xs text-muted-foreground px-5 py-2">Monthly</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lineItems.filter(i => i.recurring).map(item => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-sm text-foreground">{item.description}</td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatCurrency(item.unitPrice)}/mo</td>
                <td className="px-5 py-3 text-sm text-right font-medium text-foreground">{formatCurrency(item.total)}/mo</td>
              </tr>
            ))}
            <tr className="bg-background/50">
              <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-foreground text-right">Monthly Total</td>
              <td className="px-5 py-3 text-sm font-bold text-brand-400 text-right">{formatCurrency(totals.monthlyTotal)}/mo</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Step 4: Review ──────────────────────────────────────────────────────────
  const Step4 = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: 'One-Time Setup', value: formatCurrency(totals.setupTotal), sub: 'Total setup fees', color: 'text-foreground' },
          { label: 'Monthly Recurring', value: `${formatCurrency(totals.monthlyTotal)}/mo`, sub: '60-month term', color: 'text-brand-400' },
          { label: 'Deposit Due at Signing', value: formatCurrency(totals.depositDue), sub: '50% setup + 1st month', color: 'text-amber-400' },
          { label: 'Go-Live Payment', value: formatCurrency(totals.goLivePayment), sub: '50% setup + 1st month', color: 'text-blue-400' },
          { label: 'Contract Value (5 yr)', value: formatCurrency(totals.contractValue), sub: 'Setup + 60 months recurring', color: 'text-foreground' },
          { label: 'Dealer Override MRR', value: `${formatCurrency(totals.dealerMRR)}/mo`, sub: 'Up to $2.50/unit/mo', color: 'text-violet-400' },
        ].map(item => (
          <div key={item.label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
            <p className={`text-xl font-bold ${item.color} mt-1`}>{item.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <p className="text-sm font-semibold text-foreground">Property Summary</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-foreground">Property</span>
          <span className="text-foreground font-medium">{property.name || '—'}</span>
          <span className="text-muted-foreground">Units</span>
          <span className="text-foreground">{property.units}</span>
          <span className="text-muted-foreground">Location</span>
          <span className="text-foreground">{property.city}, {property.state}</span>
          <span className="text-muted-foreground">Contact</span>
          <span className="text-foreground">{property.contactName || '—'}</span>
        </div>
      </div>

      <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4 flex gap-3">
        <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Ready to generate proposal</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            This will create a shareable proposal link valid for 30 days. You can edit before sending.
          </p>
        </div>
      </div>
    </div>
  );

  const steps = [Step1, Step2, Step3, Step4];
  const CurrentStep = steps[step - 1];
  const canProceed = step === 1 ? property.name.trim().length > 0 && property.units > 0 : true;

  async function handleCreate() {
    setSaving(true);
    // TODO: Save to Supabase
    await new Promise(r => setTimeout(r, 800));
    router.push('/quotes/q2/proposal');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">New Quote</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Build a proposal in under 2 minutes</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => done && setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  active ? 'bg-brand-400/10 text-brand-400' :
                  done ? 'text-emerald-400 cursor-pointer hover:bg-emerald-400/5' :
                  'text-muted-foreground'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border
                  ${active ? 'border-brand-400 bg-brand-400 text-navy' :
                    done ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400' :
                    'border-border bg-background text-muted-foreground'}`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : s.id}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-border mx-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-5">{STEPS[step - 1].label}</h2>
        <CurrentStep />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => step > 1 ? setStep(s => s - 1) : undefined}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors
            ${step === 1 ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'text-foreground hover:bg-card'}`}
          disabled={step === 1}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors
              ${canProceed
                ? 'bg-brand-400 hover:bg-brand-500 text-navy gg-glow'
                : 'bg-border text-muted-foreground cursor-not-allowed'}`}
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy text-sm font-semibold transition-colors gg-glow"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><FileText className="w-4 h-4" /> Create Proposal</>}
          </button>
        )}
      </div>
    </div>
  );
}
