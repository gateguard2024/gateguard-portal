'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Shield, DollarSign, FileText,
  ChevronRight, ChevronLeft,
  Plus, Minus, Check,
  Camera, Network, Radio, Wifi,
  Loader2,
} from 'lucide-react';
import {
  calculateLineItems, calculateTotals, generateQuoteNumber,
  formatCurrency,
} from '@/lib/quote-calculator';
import {
  QuoteProperty, SiteSurvey,
  AccessTier, GateCondition, BillingMode,
} from '@/types/quote';

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
  accessTier: 'tier1_mobile',
  network: {
    backhaul:   { needed: false, qty: 1, billing: 'included' },
    radioLinks: { needed: false, qty: 1, billing: 'included' },
  },
  tier1: {
    primaryDoors:   { qty: 1, condition: 'working' },
    secondaryDoors: { qty: 0, condition: 'working' },
    guestGates:     { qty: 0, condition: 'working' },
    residentGates:  { qty: 0, condition: 'working' },
    callbox: true,
  },
  tier2: {
    accessPoints: { qty: 0, condition: 'working' },
    callbox: false,
  },
  cameras: {
    existing: { monitored: 0, standalone: 0 },
    new:      { monitored: 0, standalone: 0 },
  },
  addOns: {
    lprCameras: { qty: 0 },
    gateMaintenance: false,
    equipmentReplacement: false,
  },
};

// ── Reusable primitives ───────────────────────────────────────────────────────
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

function ConditionToggle({ value, onChange }: { value: GateCondition; onChange: (v: GateCondition) => void }) {
  return (
    <div className="flex gap-1.5">
      {(['working', 'non_working'] as GateCondition[]).map(c => (
        <button key={c} onClick={() => onChange(c)}
          className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
            value === c
              ? c === 'working'
                ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                : 'bg-amber-400/10 border-amber-400/30 text-amber-400'
              : 'bg-background border-border text-muted-foreground hover:text-foreground'
          }`}>
          {c === 'working' ? '✓ Working' : '⚠ Non-Working'}
        </button>
      ))}
    </div>
  );
}

function BillingToggle({ value, onChange }: { value: BillingMode; onChange: (v: BillingMode) => void }) {
  return (
    <div className="flex gap-1.5">
      {(['included', 'billable'] as BillingMode[]).map(b => (
        <button key={b} onClick={() => onChange(b)}
          className={`px-2.5 py-1 rounded-md border text-xs font-medium capitalize transition-colors ${
            value === b
              ? b === 'included'
                ? 'bg-brand-400/10 border-brand-400/30 text-brand-400'
                : 'bg-violet-400/10 border-violet-400/30 text-violet-400'
              : 'bg-background border-border text-muted-foreground hover:text-foreground'
          }`}>
          {b === 'included' ? 'Included' : 'Billable'}
        </button>
      ))}
    </div>
  );
}

// Survey row: label + optional sublabel + condition/billing toggle + counter
function SurveyRow({
  label, sub, condition, onCondition, count, onCount, price,
}: {
  label: string; sub?: string;
  condition?: GateCondition; onCondition?: (v: GateCondition) => void;
  count: number; onCount: (v: number) => void;
  price?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 border-t border-border first:border-0 first:pt-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      {condition !== undefined && onCondition && (
        <ConditionToggle value={condition} onChange={onCondition} />
      )}
      <Counter value={count} onChange={onCount} />
      {price && <p className="text-xs text-muted-foreground w-20 text-right">{price}</p>}
    </div>
  );
}

// Section card
function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-1">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-brand-400" />}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
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

  const lineItems = calculateLineItems(survey, property);
  const totals    = calculateTotals(lineItems, property);

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
        <div />
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
  const Step2 = () => {
    const set = <K extends keyof SiteSurvey>(key: K, val: SiteSurvey[K]) =>
      setSurvey(s => ({ ...s, [key]: val }));

    const t1 = survey.tier1;
    const t2 = survey.tier2;
    const net = survey.network;

    return (
      <div className="space-y-5">

        {/* Access Tier Selector */}
        <div className="grid grid-cols-2 gap-3">
          {([
            {
              tier: 'tier1_mobile' as AccessTier,
              label: 'Tier 1 — Mobile Pass',
              sub: 'Door-specific access points. Primary doors get controller + reader; secondary doors and guest gates get controller only.',
            },
            {
              tier: 'tier2_ubiquity' as AccessTier,
              label: 'Tier 2 — Ubiquity / Unifi',
              sub: 'Every access point gets a reader. Full Unifi stack with callbox integration.',
            },
          ]).map(({ tier, label, sub }) => (
            <button key={tier} onClick={() => set('accessTier', tier)}
              className={`text-left p-4 rounded-xl border transition-all ${
                survey.accessTier === tier
                  ? 'border-brand-400/50 bg-brand-400/5'
                  : 'border-border bg-background hover:bg-card'
              }`}>
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  survey.accessTier === tier ? 'border-brand-400' : 'border-border'
                }`}>
                  {survey.accessTier === tier && <div className="w-2 h-2 rounded-full bg-brand-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{sub}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Tier 1 Access Points */}
        {survey.accessTier === 'tier1_mobile' && (
          <Section title="Access Points — Tier 1 (Mobile Pass)" icon={Shield}>
            <SurveyRow
              label="Primary Doors"
              sub="Controller + Reader — residents tap to enter"
              condition={t1.primaryDoors.condition}
              onCondition={c => setSurvey(s => ({ ...s, tier1: { ...s.tier1, primaryDoors: { ...s.tier1.primaryDoors, condition: c } } }))}
              count={t1.primaryDoors.qty}
              onCount={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, primaryDoors: { ...s.tier1.primaryDoors, qty: v } } }))}
              price={t1.primaryDoors.condition === 'working' ? '$500 ea.' : '$750 ea.'}
            />
            <SurveyRow
              label="Secondary Doors"
              sub="Controller only — amenity rooms, utility doors"
              condition={t1.secondaryDoors.condition}
              onCondition={c => setSurvey(s => ({ ...s, tier1: { ...s.tier1, secondaryDoors: { ...s.tier1.secondaryDoors, condition: c } } }))}
              count={t1.secondaryDoors.qty}
              onCount={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, secondaryDoors: { ...s.tier1.secondaryDoors, qty: v } } }))}
              price={t1.secondaryDoors.condition === 'working' ? '$350 ea.' : '$500 ea.'}
            />
            <SurveyRow
              label="Guest Gates"
              sub="App-only controller — no reader, app controls gate"
              condition={t1.guestGates.condition}
              onCondition={c => setSurvey(s => ({ ...s, tier1: { ...s.tier1, guestGates: { ...s.tier1.guestGates, condition: c } } }))}
              count={t1.guestGates.qty}
              onCount={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, guestGates: { ...s.tier1.guestGates, qty: v } } }))}
              price={t1.guestGates.condition === 'working' ? '$350 ea.' : '$500 ea.'}
            />
            <SurveyRow
              label="Resident Gates"
              sub="Reader only — exit tap or credential check"
              condition={t1.residentGates.condition}
              onCondition={c => setSurvey(s => ({ ...s, tier1: { ...s.tier1, residentGates: { ...s.tier1.residentGates, condition: c } } }))}
              count={t1.residentGates.qty}
              onCount={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, residentGates: { ...s.tier1.residentGates, qty: v } } }))}
              price={t1.residentGates.condition === 'working' ? '$200 ea.' : '$350 ea.'}
            />
            {/* Callbox toggle */}
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div>
                <p className="text-sm text-foreground">Video Callbox</p>
                <p className="text-xs text-muted-foreground">GateGuard / Unifi video entry — $2,500 installed</p>
              </div>
              <button onClick={() => setSurvey(s => ({ ...s, tier1: { ...s.tier1, callbox: !s.tier1.callbox } }))}
                className={`w-12 h-6 rounded-full border-2 transition-all relative ${
                  t1.callbox ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
                }`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  t1.callbox ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
          </Section>
        )}

        {/* Tier 2 Access Points */}
        {survey.accessTier === 'tier2_ubiquity' && (
          <Section title="Access Points — Tier 2 (Ubiquity / Unifi)" icon={Shield}>
            <SurveyRow
              label="Access Points"
              sub="Every point gets reader + controller via Unifi stack"
              condition={t2.accessPoints.condition}
              onCondition={c => setSurvey(s => ({ ...s, tier2: { ...s.tier2, accessPoints: { ...s.tier2.accessPoints, condition: c } } }))}
              count={t2.accessPoints.qty}
              onCount={v => setSurvey(s => ({ ...s, tier2: { ...s.tier2, accessPoints: { ...s.tier2.accessPoints, qty: v } } }))}
              price={t2.accessPoints.condition === 'working' ? '$500 ea.' : '$750 ea.'}
            />
            <div className="flex items-center justify-between py-3 border-t border-border">
              <div>
                <p className="text-sm text-foreground">Unifi Video Callbox</p>
                <p className="text-xs text-muted-foreground">$2,500 installed</p>
              </div>
              <button onClick={() => setSurvey(s => ({ ...s, tier2: { ...s.tier2, callbox: !s.tier2.callbox } }))}
                className={`w-12 h-6 rounded-full border-2 transition-all relative ${
                  t2.callbox ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
                }`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  t2.callbox ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
          </Section>
        )}

        {/* Network / Backhaul */}
        <Section title="Network Infrastructure" icon={Network}>
          {/* Backhaul */}
          <div className="py-2">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-foreground">Network Backhaul</p>
                <p className="text-xs text-muted-foreground">Dedicated network run to gate/panel location</p>
              </div>
              <button onClick={() => setSurvey(s => ({ ...s, network: { ...s.network, backhaul: { ...s.network.backhaul, needed: !s.network.backhaul.needed } } }))}
                className={`w-12 h-6 rounded-full border-2 transition-all relative ${
                  net.backhaul.needed ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
                }`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  net.backhaul.needed ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
            {net.backhaul.needed && (
              <div className="flex items-center gap-4 pl-4 mt-2">
                <BillingToggle
                  value={net.backhaul.billing}
                  onChange={b => setSurvey(s => ({ ...s, network: { ...s.network, backhaul: { ...s.network.backhaul, billing: b } } }))}
                />
                <Counter
                  value={net.backhaul.qty}
                  onChange={v => setSurvey(s => ({ ...s, network: { ...s.network, backhaul: { ...s.network.backhaul, qty: v } } }))}
                  min={1}
                />
                {net.backhaul.billing === 'billable' && (
                  <p className="text-xs text-muted-foreground">$500 ea.</p>
                )}
              </div>
            )}
          </div>

          {/* Radio Links */}
          <div className="py-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm text-foreground">Radio Link Bridge</p>
                <p className="text-xs text-muted-foreground">Wireless backhaul for locations without cable run</p>
              </div>
              <button onClick={() => setSurvey(s => ({ ...s, network: { ...s.network, radioLinks: { ...s.network.radioLinks, needed: !s.network.radioLinks.needed } } }))}
                className={`w-12 h-6 rounded-full border-2 transition-all relative ${
                  net.radioLinks.needed ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
                }`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                  net.radioLinks.needed ? 'left-6' : 'left-0.5'
                }`} />
              </button>
            </div>
            {net.radioLinks.needed && (
              <div className="flex items-center gap-4 pl-4 mt-2">
                <BillingToggle
                  value={net.radioLinks.billing}
                  onChange={b => setSurvey(s => ({ ...s, network: { ...s.network, radioLinks: { ...s.network.radioLinks, billing: b } } }))}
                />
                <Counter
                  value={net.radioLinks.qty}
                  onChange={v => setSurvey(s => ({ ...s, network: { ...s.network, radioLinks: { ...s.network.radioLinks, qty: v } } }))}
                  min={1}
                />
                {net.radioLinks.billing === 'billable' && (
                  <p className="text-xs text-muted-foreground">$750 ea.</p>
                )}
              </div>
            )}
          </div>
        </Section>

        {/* Cameras */}
        <Section title="Cameras" icon={Camera}>
          {/* Existing cameras */}
          <div className="pb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Existing Cameras</p>
            <div className="space-y-0">
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-foreground">Monitored</p>
                  <p className="text-xs text-muted-foreground">Reprogramming included · $85/mo monitoring</p>
                </div>
                <Counter
                  value={survey.cameras.existing.monitored}
                  onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existing: { ...s.cameras.existing, monitored: v } } }))}
                />
              </div>
              <div className="flex items-center justify-between py-2.5 border-t border-border">
                <div>
                  <p className="text-sm text-foreground">Standalone (no monitoring)</p>
                  <p className="text-xs text-muted-foreground">Reprogramming labor billable · $150/camera</p>
                </div>
                <Counter
                  value={survey.cameras.existing.standalone}
                  onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existing: { ...s.cameras.existing, standalone: v } } }))}
                />
              </div>
            </div>
          </div>

          {/* New cameras */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">New Cameras</p>
            <div className="space-y-0">
              <div className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-foreground">Monitored</p>
                  <p className="text-xs text-muted-foreground">Hardware included with contract · $100/mo monitoring</p>
                </div>
                <Counter
                  value={survey.cameras.new.monitored}
                  onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, monitored: v } } }))}
                />
              </div>
              <div className="flex items-center justify-between py-2.5 border-t border-border">
                <div>
                  <p className="text-sm text-foreground">Standalone (billable)</p>
                  <p className="text-xs text-muted-foreground">Full install billable · $350/camera · no monitoring MRR</p>
                </div>
                <Counter
                  value={survey.cameras.new.standalone}
                  onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, standalone: v } } }))}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Optional Add-Ons */}
        <Section title="Optional Add-Ons" icon={Wifi}>
          {/* LPR cameras */}
          <SurveyRow
            label="LPR Cameras"
            sub="License plate recognition · $1,500 install · $150/mo"
            count={survey.addOns.lprCameras.qty}
            onCount={v => setSurvey(s => ({ ...s, addOns: { ...s.addOns, lprCameras: { qty: v } } }))}
          />
          {/* Gate maintenance */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="text-sm text-foreground">Physical Gate Maintenance & Repair</p>
              <p className="text-xs text-muted-foreground">Ongoing monthly service · $250/mo</p>
            </div>
            <button onClick={() => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: !s.addOns.gateMaintenance } }))}
              className={`w-12 h-6 rounded-full border-2 transition-all relative ${
                survey.addOns.gateMaintenance ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
              }`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                survey.addOns.gateMaintenance ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>
          {/* Equipment replacement */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="text-sm text-foreground">Missing Equipment Replacement</p>
              <p className="text-xs text-muted-foreground">Allowance for damaged or missing hardware · $500</p>
            </div>
            <button onClick={() => setSurvey(s => ({ ...s, addOns: { ...s.addOns, equipmentReplacement: !s.addOns.equipmentReplacement } }))}
              className={`w-12 h-6 rounded-full border-2 transition-all relative ${
                survey.addOns.equipmentReplacement ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
              }`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                survey.addOns.equipmentReplacement ? 'left-6' : 'left-0.5'
              }`} />
            </button>
          </div>
        </Section>

      </div>
    );
  };

  // ── Step 3: Line Items ──────────────────────────────────────────────────────
  const Step3 = () => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">All pricing auto-calculated from your survey. Items marked "Included" are at $0 — value is built into the contract.</p>

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
              <tr key={item.id} className={item.billing === 'included' ? 'opacity-60' : ''}>
                <td className="px-5 py-3 text-sm text-foreground">
                  {item.description}
                  {item.billing === 'included' && (
                    <span className="ml-2 text-xs text-brand-400 font-medium">INCLUDED</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                  {item.total === 0 ? '—' : formatCurrency(item.unitPrice)}
                </td>
                <td className="px-5 py-3 text-sm text-right font-medium text-foreground">
                  {item.total === 0 ? '—' : formatCurrency(item.total)}
                </td>
              </tr>
            ))}
            <tr className="bg-background/50">
              <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-foreground text-right">Setup Total</td>
              <td className="px-5 py-3 text-sm font-bold text-foreground text-right">{formatCurrency(totals.setupTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border bg-background/50">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Recurring</p>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted-foreground px-5 py-2">Description</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Qty</th>
              <th className="text-right text-xs text-muted-foreground px-4 py-2">Unit</th>
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
          { label: 'One-Time Setup',         value: formatCurrency(totals.setupTotal),          sub: 'Total setup fees',              color: 'text-foreground' },
          { label: 'Monthly Recurring',      value: `${formatCurrency(totals.monthlyTotal)}/mo`, sub: '60-month term',                 color: 'text-brand-400' },
          { label: 'Deposit Due at Signing', value: formatCurrency(totals.depositDue),           sub: '50% setup + 1st month',         color: 'text-amber-400' },
          { label: 'Go-Live Payment',        value: formatCurrency(totals.goLivePayment),        sub: '50% setup + 1st month',         color: 'text-blue-400' },
          { label: 'Contract Value (5 yr)',  value: formatCurrency(totals.contractValue),        sub: 'Setup + 60 months recurring',   color: 'text-foreground' },
          { label: 'Dealer Override MRR',    value: `${formatCurrency(totals.dealerMRR)}/mo`,   sub: 'Up to $2.50/unit/mo',           color: 'text-violet-400' },
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
          <span className="text-muted-foreground">Access Tier</span>
          <span className="text-foreground">{survey.accessTier === 'tier1_mobile' ? 'Tier 1 — Mobile Pass' : 'Tier 2 — Ubiquity'}</span>
          <span className="text-muted-foreground">Contact</span>
          <span className="text-foreground">{property.contactName || '—'}</span>
        </div>
      </div>

      <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4 flex gap-3">
        <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Ready to generate proposal</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Creates a shareable proposal link valid for 30 days. You can edit before sending.
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
    const _qn = generateQuoteNumber(); // eslint-disable-line @typescript-eslint/no-unused-vars
    await new Promise(r => setTimeout(r, 800));
    router.push('/quotes/q2/proposal');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-foreground">New Quote</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Build a proposal in under 2 minutes</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button
                onClick={() => done && setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  active ? 'bg-brand-400/10 text-brand-400' :
                  done   ? 'text-emerald-400 cursor-pointer hover:bg-emerald-400/5' :
                           'text-muted-foreground'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border
                  ${active ? 'border-brand-400 bg-brand-400 text-navy' :
                    done   ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400' :
                             'border-border bg-background text-muted-foreground'}`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : s.id}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
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
          disabled={step === 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors
            ${step === 1 ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'text-foreground hover:bg-card'}`}
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
