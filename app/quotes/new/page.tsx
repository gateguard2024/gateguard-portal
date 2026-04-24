'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2, Shield, DollarSign, FileText,
  ChevronRight, ChevronLeft,
  Plus, Minus, Check,
  Camera, Network, Wifi, Trash2,
  Loader2,
} from 'lucide-react';
import {
  calculateLineItems, calculateTotals, generateQuoteNumber, formatCurrency,
} from '@/lib/quote-calculator';
import {
  QuoteProperty, SiteSurvey, AccessTier, BillingMode,
  NetworkSurvey, CustomSurveyItem,
} from '@/types/quote';

// ── Step definitions ──────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: 'Property',    icon: Building2 },
  { id: 2, label: 'Site Survey', icon: Shield },
  { id: 3, label: 'Line Items',  icon: DollarSign },
  { id: 4, label: 'Review',      icon: FileText },
];

// ── Defaults ──────────────────────────────────────────────────────────────────
const defaultProperty: QuoteProperty = {
  name: '', address: '', city: '', state: 'GA', zip: '',
  units: 0, contactName: '', contactEmail: '', contactPhone: '',
  propertyManager: '', managementCompany: '',
};

function netItem(qty = 0, billing: BillingMode = 'included') {
  return { qty, billing };
}

const defaultSurvey: SiteSurvey = {
  accessTier: 'tier1_mobile',
  network: {
    router:       netItem(1, 'included'),
    switch4port:  netItem(),
    switch8port:  netItem(),
    switch16port: netItem(),
    radioSmall:   netItem(),
    radioMedium:  netItem(),
    radioLarge:   netItem(),
    enclosure:    netItem(),
  },
  tier1: {
    primaryDoors:   { working: 1, nonWorking: 0 },
    secondaryDoors: { working: 0, nonWorking: 0 },
    guestGates:     { working: 0, nonWorking: 0 },
    residentGates:  { working: 0, nonWorking: 0 },
    callbox: true,
  },
  tier2: {
    accessPoints: { working: 0, nonWorking: 0 },
    callbox: false,
  },
  cameras: {
    existing: { monitored: 0, standalone: 0 },
    new: { monitored: { qty: 0, billing: 'included' }, standalone: 0 },
  },
  addOns: {
    lprCameras: { qty: 0 },
    gateMaintenance: {
      enabled: false,
      initialRepairCost: 0,
      initialRepairBilling: 'billable',
      entryGates: 1,
    },
    customItems: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Primitive UI components — defined at MODULE SCOPE to prevent re-mounting
// on every render (which causes input focus loss / one-letter-at-a-time bug)
// ─────────────────────────────────────────────────────────────────────────────
function Counter({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
        className="w-7 h-7 rounded border border-border bg-background hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Minus className="w-3 h-3" />
      </button>
      <span className="w-7 text-center text-sm font-semibold text-foreground tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded border border-border bg-background hover:bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
        <Plus className="w-3 h-3" />
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

// Uncontrolled-style text input — value prop only for initial render; uses defaultValue
// to avoid React remounting wiping the field. Parent state is updated on change.
function TextInput({ value, onChange, placeholder, type = 'text' }: {
  value: string | number; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type}
      defaultValue={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
    />
  );
}

function BillingToggle({ value, onChange }: { value: BillingMode; onChange: (v: BillingMode) => void }) {
  return (
    <div className="flex gap-1">
      {(['included', 'billable'] as BillingMode[]).map(b => (
        <button key={b} type="button" onClick={() => onChange(b)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            value === b
              ? b === 'included' ? 'bg-brand-400/15 border border-brand-400/30 text-brand-400' : 'bg-violet-400/15 border border-violet-400/30 text-violet-400'
              : 'border border-border text-muted-foreground hover:text-foreground'
          }`}>
          {b === 'included' ? 'Included' : 'Billable'}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`w-11 h-6 rounded-full border-2 transition-all relative shrink-0 ${
        checked ? 'bg-brand-400 border-brand-400' : 'bg-background border-border'
      }`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
        checked ? 'left-5' : 'left-0.5'
      }`} />
    </button>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {Icon && <Icon className="w-4 h-4 text-brand-400" />}
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {children}
    </div>
  );
}

// Dual counter for access points — working and non-working side by side
function DualCounter({
  working, nonWorking, onWorking, onNonWorking,
  workingPrice, nonWorkingPrice,
}: {
  working: number; nonWorking: number;
  onWorking: (v: number) => void; onNonWorking: (v: number) => void;
  workingPrice: string; nonWorkingPrice: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-emerald-400 w-20">✓ Working</span>
        <Counter value={working} onChange={onWorking} />
        <span className="text-xs text-muted-foreground">{workingPrice}</span>
      </div>
      <div className="w-px h-6 bg-border" />
      <div className="flex items-center gap-2">
        <span className="text-xs text-amber-400 w-24">⚠ Non-Working</span>
        <Counter value={nonWorking} onChange={onNonWorking} />
        <span className="text-xs text-muted-foreground">{nonWorkingPrice}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NewQuotePage() {
  const router = useRouter();
  const [step, setStep]       = useState(1);
  const [property, setProperty] = useState<QuoteProperty>(defaultProperty);
  const [survey, setSurvey]   = useState<SiteSurvey>(defaultSurvey);
  const [saving, setSaving]   = useState(false);

  // Stable property setter — defined once per component mount
  const setProp = (key: keyof QuoteProperty) => (val: string) =>
    setProperty(p => ({ ...p, [key]: key === 'units' ? parseInt(val) || 0 : val }));

  const lineItems = calculateLineItems(survey, property);
  const totals    = calculateTotals(lineItems, property);

  // ── Network item setter helper ─────────────────────────────────────────────
  const setNet = (key: keyof NetworkSurvey, patch: Partial<{ qty: number; billing: BillingMode }>) =>
    setSurvey(s => ({ ...s, network: { ...s.network, [key]: { ...s.network[key], ...patch } } }));

  // ── Custom items helpers ───────────────────────────────────────────────────
  function addCustomItem() {
    const item: CustomSurveyItem = { id: `ci_${Date.now()}`, description: '', qty: 1, unitPrice: 0, billing: 'billable' };
    setSurvey(s => ({ ...s, addOns: { ...s.addOns, customItems: [...s.addOns.customItems, item] } }));
  }
  function updateCustomItem(id: string, patch: Partial<CustomSurveyItem>) {
    setSurvey(s => ({ ...s, addOns: { ...s.addOns, customItems: s.addOns.customItems.map(i => i.id === id ? { ...i, ...patch } : i) } }));
  }
  function removeCustomItem(id: string) {
    setSurvey(s => ({ ...s, addOns: { ...s.addOns, customItems: s.addOns.customItems.filter(i => i.id !== id) } }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEP RENDERERS — called as functions, NOT as JSX components.
  // This avoids React unmounting/remounting inputs on every state update,
  // which was causing the "one character at a time" typing bug.
  // ══════════════════════════════════════════════════════════════════════════

  function renderStep1() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Property Name" required>
              <TextInput value={property.name} onChange={setProp('name')} placeholder="e.g. East Ponce Village" />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Street Address">
              <TextInput value={property.address} onChange={setProp('address')} placeholder="123 Main Street" />
            </Field>
          </div>
          <Field label="City">
            <TextInput value={property.city} onChange={setProp('city')} placeholder="Atlanta" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State">
              <TextInput value={property.state} onChange={setProp('state')} placeholder="GA" />
            </Field>
            <Field label="ZIP">
              <TextInput value={property.zip} onChange={setProp('zip')} placeholder="30328" />
            </Field>
          </div>
          <Field label="Total Units" required>
            <TextInput value={property.units || ''} onChange={setProp('units')} placeholder="120" type="number" />
          </Field>
          <div />
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Contact</p>
            <p className="text-xs text-brand-400">CRM lookup coming soon</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Contact Name">
              <TextInput value={property.contactName} onChange={setProp('contactName')} placeholder="Jane Smith" />
            </Field>
            <Field label="Phone">
              <TextInput value={property.contactPhone} onChange={setProp('contactPhone')} placeholder="(404) 555-0100" />
            </Field>
            <Field label="Email">
              <TextInput value={property.contactEmail} onChange={setProp('contactEmail')} placeholder="jane@property.com" />
            </Field>
            <Field label="Property Manager">
              <TextInput value={property.propertyManager || ''} onChange={setProp('propertyManager')} placeholder="Jane Smith" />
            </Field>
            <div className="col-span-2">
              <Field label="Management Company">
                <TextInput value={property.managementCompany || ''} onChange={setProp('managementCompany')} placeholder="Columbia Residential" />
              </Field>
            </div>
          </div>
        </div>

        {property.units > 0 && (
          <div className="bg-brand-400/5 border border-brand-400/20 rounded-xl p-4">
            <p className="text-xs text-brand-400 font-semibold uppercase tracking-wide mb-1">Estimated Base Monthly Service</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(Math.max(property.units * 10, 1200))}
              <span className="text-sm font-normal text-muted-foreground">/mo</span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.units} units @ $10/unit{property.units * 10 < 1200 && ' — $1,200/mo minimum applies'}
            </p>
          </div>
        )}
      </div>
    );
  }

  function renderStep2() {
    const t1 = survey.tier1;
    const t2 = survey.tier2;
    const net = survey.network;
    const gm  = survey.addOns.gateMaintenance;

    return (
      <div className="space-y-5">

        {/* ── Access Tier Selector ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { tier: 'tier1_mobile' as AccessTier, label: 'Tier 1 — Mobile Pass', sub: 'Door-specific equipment. Primary doors get controller + reader; secondary/amenity doors get controller only; guest gates app-only; resident gates reader only.' },
            { tier: 'tier2_gg'     as AccessTier, label: 'Tier 2 — GateGuard Integrated', sub: 'Every access point gets a full reader + controller via the GateGuard integrated stack. Uniform setup, optional video callbox at entry.' },
          ]).map(({ tier, label, sub }) => (
            <button key={tier} type="button" onClick={() => setSurvey(s => ({ ...s, accessTier: tier }))}
              className={`text-left p-4 rounded-xl border transition-all ${survey.accessTier === tier ? 'border-brand-400/50 bg-brand-400/5' : 'border-border bg-background hover:bg-card'}`}>
              <div className="flex items-start gap-2">
                <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${survey.accessTier === tier ? 'border-brand-400' : 'border-border'}`}>
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

        {/* ── Tier 1 Access Points ─────────────────────────────────────── */}
        {survey.accessTier === 'tier1_mobile' && (
          <SectionCard title="Access Points — Tier 1 (Mobile Pass)" icon={Shield}>
            <div className="space-y-4">
              {([
                { label: 'Primary Doors', sub: 'Controller + Reader', key: 'primaryDoors' as const, wp: '$500', nwp: '$750' },
                { label: 'Secondary Doors', sub: 'Controller Only — amenity rooms, utility doors', key: 'secondaryDoors' as const, wp: '$350', nwp: '$500' },
                { label: 'Guest Gates', sub: 'App-Only Controller — no reader', key: 'guestGates' as const, wp: '$350', nwp: '$500' },
                { label: 'Resident Gates', sub: 'Reader Only — exit tap', key: 'residentGates' as const, wp: '$200', nwp: '$350' },
              ]).map(({ label, sub, key, wp, nwp }, i) => (
                <div key={key} className={i > 0 ? 'pt-4 border-t border-border' : ''}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">{sub}</p>
                    </div>
                    <DualCounter
                      working={t1[key].working}
                      nonWorking={t1[key].nonWorking}
                      onWorking={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, [key]: { ...s.tier1[key], working: v } } }))}
                      onNonWorking={v => setSurvey(s => ({ ...s, tier1: { ...s.tier1, [key]: { ...s.tier1[key], nonWorking: v } } }))}
                      workingPrice={wp}
                      nonWorkingPrice={nwp}
                    />
                  </div>
                </div>
              ))}
              {/* Callbox */}
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-foreground">GateGuard Video Callbox</p>
                  <p className="text-xs text-muted-foreground">$2,500 installed</p>
                </div>
                <Toggle checked={t1.callbox} onChange={() => setSurvey(s => ({ ...s, tier1: { ...s.tier1, callbox: !s.tier1.callbox } }))} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Tier 2 Access Points ─────────────────────────────────────── */}
        {survey.accessTier === 'tier2_gg' && (
          <SectionCard title="Access Points — Tier 2 (GateGuard Integrated)" icon={Shield}>
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-foreground">Access Points</p>
                  <p className="text-xs text-muted-foreground">Every point gets full reader + controller</p>
                </div>
                <DualCounter
                  working={t2.accessPoints.working}
                  nonWorking={t2.accessPoints.nonWorking}
                  onWorking={v => setSurvey(s => ({ ...s, tier2: { ...s.tier2, accessPoints: { ...s.tier2.accessPoints, working: v } } }))}
                  onNonWorking={v => setSurvey(s => ({ ...s, tier2: { ...s.tier2, accessPoints: { ...s.tier2.accessPoints, nonWorking: v } } }))}
                  workingPrice="$500"
                  nonWorkingPrice="$750"
                />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <div>
                  <p className="text-sm text-foreground">GateGuard Video Callbox</p>
                  <p className="text-xs text-muted-foreground">$2,500 installed</p>
                </div>
                <Toggle checked={t2.callbox} onChange={() => setSurvey(s => ({ ...s, tier2: { ...s.tier2, callbox: !s.tier2.callbox } }))} />
              </div>
            </div>
          </SectionCard>
        )}

        {/* ── Network Infrastructure ────────────────────────────────────── */}
        <SectionCard title="Network Infrastructure" icon={Network}>
          <p className="text-xs text-muted-foreground mb-3">Every install includes at least 1 router. Set qty to 0 to omit any item.</p>
          <div className="space-y-3">
            {([
              { key: 'router'       as keyof NetworkSurvey, label: 'Router',              sub: 'Required — at least 1',       price: '$350' },
              { key: 'switch4port'  as keyof NetworkSurvey, label: '4-Port PoE Switch',   sub: 'Up to 4 access points',       price: '$200' },
              { key: 'switch8port'  as keyof NetworkSurvey, label: '8-Port PoE Switch',   sub: 'Up to 8 access points',       price: '$350' },
              { key: 'switch16port' as keyof NetworkSurvey, label: '16-Port PoE Switch',  sub: 'Up to 16 access points',      price: '$600' },
              { key: 'radioSmall'   as keyof NetworkSurvey, label: 'PTP Radio — Small',   sub: 'Short-range wireless bridge', price: '$500' },
              { key: 'radioMedium'  as keyof NetworkSurvey, label: 'PTP Radio — Medium',  sub: 'Mid-range wireless bridge',   price: '$800' },
              { key: 'radioLarge'   as keyof NetworkSurvey, label: 'PTP Radio — Large',   sub: 'Long-range wireless bridge',  price: '$1,200' },
              { key: 'enclosure'    as keyof NetworkSurvey, label: 'Weatherproof Enclosure', sub: 'Outdoor panel housing',    price: '$250' },
            ]).map(({ key, label, sub, price }, i) => (
              <div key={key} className={`flex items-center gap-3 ${i > 0 ? 'pt-3 border-t border-border' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
                <BillingToggle
                  value={net[key].billing}
                  onChange={b => setNet(key, { billing: b })}
                />
                <Counter
                  value={net[key].qty}
                  onChange={v => setNet(key, { qty: v })}
                  min={0}
                />
                {net[key].billing === 'billable' && net[key].qty > 0 && (
                  <p className="text-xs text-muted-foreground w-14 text-right">{price} ea.</p>
                )}
                {(net[key].billing === 'included' || net[key].qty === 0) && (
                  <p className="text-xs text-muted-foreground w-14 text-right opacity-40">{price} ea.</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* ── Cameras ──────────────────────────────────────────────────── */}
        <SectionCard title="Cameras" icon={Camera}>

          {/* Existing */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Existing Cameras</p>
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">Monitored</p>
                <p className="text-xs text-muted-foreground">Reprogramming included · $85/mo monitoring</p>
              </div>
              <Counter value={survey.cameras.existing.monitored} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existing: { ...s.cameras.existing, monitored: v } } }))} />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <p className="text-sm text-foreground">Standalone (no monitoring)</p>
                <p className="text-xs text-muted-foreground">Reprogramming billable · $150/camera</p>
              </div>
              <Counter value={survey.cameras.existing.standalone} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, existing: { ...s.cameras.existing, standalone: v } } }))} />
            </div>
          </div>

          {/* New */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pt-4 border-t border-border">New Cameras</p>
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm text-foreground">Monitored</p>
                <p className="text-xs text-muted-foreground mb-2">
                  {survey.cameras.new.monitored.billing === 'included'
                    ? 'Hardware included with contract · $100/mo monitoring'
                    : 'Hardware billable $350/camera · $85/mo monitoring'}
                </p>
                <BillingToggle
                  value={survey.cameras.new.monitored.billing}
                  onChange={b => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, monitored: { ...s.cameras.new.monitored, billing: b } } } }))}
                />
              </div>
              <Counter value={survey.cameras.new.monitored.qty} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, monitored: { ...s.cameras.new.monitored, qty: v } } } }))} />
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div>
                <p className="text-sm text-foreground">Standalone (billable, no monitoring)</p>
                <p className="text-xs text-muted-foreground">Full install $350/camera</p>
              </div>
              <Counter value={survey.cameras.new.standalone} onChange={v => setSurvey(s => ({ ...s, cameras: { ...s.cameras, new: { ...s.cameras.new, standalone: v } } }))} />
            </div>
          </div>
        </SectionCard>

        {/* ── Add-Ons ───────────────────────────────────────────────────── */}
        <SectionCard title="Add-Ons & Optional Items" icon={Wifi}>

          {/* LPR Cameras */}
          <div className="flex items-center justify-between pb-4">
            <div>
              <p className="text-sm text-foreground">LPR Cameras</p>
              <p className="text-xs text-muted-foreground">License plate recognition · $1,500 billable install · $150/mo required</p>
            </div>
            <Counter value={survey.addOns.lprCameras.qty} onChange={v => setSurvey(s => ({ ...s, addOns: { ...s.addOns, lprCameras: { qty: v } } }))} />
          </div>

          {/* Gate Maintenance */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-foreground">Physical Gate Maintenance & Repair</p>
                <p className="text-xs text-muted-foreground">$250/mo per entry gate (up to 2 leafs)</p>
              </div>
              <Toggle checked={gm.enabled} onChange={() => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, enabled: !s.addOns.gateMaintenance.enabled } } }))} />
            </div>
            {gm.enabled && (
              <div className="bg-background/60 border border-border rounded-lg p-4 space-y-4 mt-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-foreground">Initial Repair Cost</p>
                    <p className="text-xs text-muted-foreground mb-2">Enter estimated repair labor + parts</p>
                    <BillingToggle
                      value={gm.initialRepairBilling}
                      onChange={b => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, initialRepairBilling: b } } }))}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-muted-foreground">$</span>
                    <input
                      type="number"
                      value={gm.initialRepairCost || ''}
                      onChange={e => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, initialRepairCost: parseFloat(e.target.value) || 0 } } }))}
                      placeholder="0"
                      className="w-24 px-2 py-1.5 bg-background border border-border rounded text-sm text-foreground text-right focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div>
                    <p className="text-sm text-foreground">Entry Gates</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(250 * gm.entryGates)}/mo ongoing maintenance</p>
                  </div>
                  <Counter value={gm.entryGates} onChange={v => setSurvey(s => ({ ...s, addOns: { ...s.addOns, gateMaintenance: { ...s.addOns.gateMaintenance, entryGates: v } } }))} min={1} />
                </div>
              </div>
            )}
          </div>

          {/* Custom / Missing Equipment Items */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm text-foreground">Custom Line Items</p>
                <p className="text-xs text-muted-foreground">Missing equipment, special materials, or other billable items</p>
              </div>
              <button type="button" onClick={addCustomItem}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-400/30 text-brand-400 hover:bg-brand-400/5 text-xs font-medium transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            {survey.addOns.customItems.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No custom items added</p>
            )}
            <div className="space-y-3">
              {survey.addOns.customItems.map((item) => (
                <div key={item.id} className="bg-background/60 border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateCustomItem(item.id, { description: e.target.value })}
                      placeholder="Item description..."
                      className="flex-1 px-2 py-1.5 bg-background border border-border rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button type="button" onClick={() => removeCustomItem(item.id)}
                      className="p-1.5 rounded hover:bg-red-400/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <BillingToggle value={item.billing} onChange={b => updateCustomItem(item.id, { billing: b })} />
                    <Counter value={item.qty} onChange={v => updateCustomItem(item.id, { qty: v })} min={1} />
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={item.unitPrice || ''}
                        onChange={e => updateCustomItem(item.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-24 px-2 py-1 bg-background border border-border rounded text-sm text-right text-foreground focus:outline-none focus:ring-1 focus:ring-brand-400"
                      />
                      <span className="text-xs text-muted-foreground">ea.</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </SectionCard>
      </div>
    );
  }

  function renderStep3() {
    const setupItems   = lineItems.filter(i => !i.recurring);
    const monthlyItems = lineItems.filter(i => i.recurring);
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Auto-calculated from your survey. Items marked INCLUDED are $0 — value is built into the contract.</p>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-background/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">One-Time Setup Fees</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted-foreground px-5 py-2">Description</th>
                <th className="text-right text-xs text-muted-foreground px-4 py-2">Qty</th>
                <th className="text-right text-xs text-muted-foreground px-4 py-2">Unit</th>
                <th className="text-right text-xs text-muted-foreground px-5 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {setupItems.map(item => (
                <tr key={item.id} className={item.billing === 'included' ? 'opacity-50' : ''}>
                  <td className="px-5 py-3 text-sm text-foreground">
                    {item.description}
                    {item.billing === 'included' && <span className="ml-2 text-xs text-brand-400 font-medium">INCLUDED</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.total === 0 ? '—' : formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3 text-sm text-right font-medium text-foreground">{item.total === 0 ? '—' : formatCurrency(item.total)}</td>
                </tr>
              ))}
              <tr className="bg-background/50">
                <td colSpan={2} className="px-5 py-3 text-xs text-muted-foreground">Billable only: {formatCurrency(totals.billableSetupTotal)}</td>
                <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">Setup Total</td>
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
              {monthlyItems.map(item => (
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
  }

  function renderStep4() {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Setup Fees',          value: formatCurrency(totals.setupTotal),                                sub: `${formatCurrency(totals.billableSetupTotal)} billable`,     color: 'text-foreground' },
            { label: 'Monthly Recurring',         value: `${formatCurrency(totals.monthlyTotal)}/mo`,                     sub: '60-month term',                                              color: 'text-brand-400' },
            { label: 'Deposit at Signing (50%)',  value: formatCurrency(totals.depositDue),                               sub: '50% billable setup + 1st month MRR',                         color: 'text-amber-400' },
            { label: 'Launch Event Payment (50%)',value: formatCurrency(totals.goLivePayment),                            sub: '50% billable setup + 1st month MRR',                         color: 'text-blue-400' },
            { label: 'Contract Value (5 yr)',      value: formatCurrency(totals.contractValue),                            sub: 'Setup + 60 months recurring',                                color: 'text-foreground' },
            { label: 'Dealer Override MRR',        value: `${formatCurrency(totals.dealerMRR)}/mo`,                       sub: 'Up to $2.50/unit/mo',                                        color: 'text-violet-400' },
          ].map(item => (
            <div key={item.label} className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
              <p className={`text-xl font-bold ${item.color} mt-1`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <p className="text-sm font-semibold text-foreground">Summary</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Property</span>
            <span className="text-foreground font-medium">{property.name || '—'}</span>
            <span className="text-muted-foreground">Units</span>
            <span className="text-foreground">{property.units}</span>
            <span className="text-muted-foreground">Location</span>
            <span className="text-foreground">{property.city}, {property.state}</span>
            <span className="text-muted-foreground">Access Tier</span>
            <span className="text-foreground">{survey.accessTier === 'tier1_mobile' ? 'Tier 1 — Mobile Pass' : 'Tier 2 — GG Integrated'}</span>
            <span className="text-muted-foreground">Contact</span>
            <span className="text-foreground">{property.contactName || '—'}</span>
          </div>
        </div>

        <div className="bg-emerald-400/5 border border-emerald-400/20 rounded-xl p-4 flex gap-3">
          <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Ready to generate proposal</p>
            <p className="text-xs text-muted-foreground mt-0.5">Creates a shareable proposal link valid for 30 days. You can edit before sending.</p>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const Icon   = s.icon;
          const done   = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1">
              <button type="button" onClick={() => done && setStep(s.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${active ? 'bg-brand-400/10 text-brand-400' : done ? 'text-emerald-400 cursor-pointer hover:bg-emerald-400/5' : 'text-muted-foreground'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border ${active ? 'border-brand-400 bg-brand-400 text-navy' : done ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400' : 'border-border bg-background text-muted-foreground'}`}>
                  {done ? <Check className="w-3.5 h-3.5" /> : s.id}
                </div>
                <span className="text-xs font-medium hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border mx-1" />}
            </div>
          );
        })}
      </div>

      {/* Step content — rendered as function calls, NOT as JSX components */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-5">{STEPS[step - 1].label}</h2>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => step > 1 && setStep(s => s - 1)} disabled={step === 1}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium transition-colors ${step === 1 ? 'opacity-30 cursor-not-allowed text-muted-foreground' : 'text-foreground hover:bg-card'}`}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < 4 ? (
          <button type="button" onClick={() => setStep(s => s + 1)} disabled={!canProceed}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${canProceed ? 'bg-brand-400 hover:bg-brand-500 text-navy gg-glow' : 'bg-border text-muted-foreground cursor-not-allowed'}`}>
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="button" onClick={handleCreate} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-400 hover:bg-brand-500 text-navy text-sm font-semibold transition-colors gg-glow">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><FileText className="w-4 h-4" /> Create Proposal</>}
          </button>
        )}
      </div>
    </div>
  );
}
