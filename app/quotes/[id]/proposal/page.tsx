'use client';

import { useState } from 'react';
import {
  Shield, Check, CheckCircle2, XCircle, Phone, Mail,
  MapPin, Calendar, Clock, FileText, ChevronDown, ChevronUp, Building2,
} from 'lucide-react';
import { formatCurrency } from '@/lib/quote-calculator';

// ── Mock proposal data (will come from Supabase) ─────────────────────────────
const MOCK_PROPOSAL = {
  quoteNumber: 'GG-2026-0042',
  status: 'viewed',
  validUntil: '2026-05-24',
  createdAt: 'April 17, 2026',
  property: {
    name: 'The Villages on Riverwalk',
    address: '1200 Riverwalk Pkwy',
    city: 'Augusta', state: 'GA', zip: '30901',
    units: 248,
    contactName: 'Marcus Davis',
    contactEmail: 'mdavis@riverwalkvillages.com',
    contactPhone: '(706) 555-0182',
    managementCompany: 'Willow Creek Property Management',
  },
  lineItems: [
    { id: '1', description: 'GateGuard Monthly Service — 248 units @ $10/unit/mo', qty: 1, unitPrice: 2480, total: 2480, recurring: true },
    { id: '2', description: 'Working Vehicular Gate — Setup Fee', qty: 2, unitPrice: 500, total: 1000, recurring: false },
    { id: '3', description: 'Non-Working Amenity Door — Setup Fee', qty: 3, unitPrice: 750, total: 2250, recurring: false },
    { id: '4', description: 'Callbox Installation — Unifi Gate Access (replaces existing)', qty: 2, unitPrice: 2500, total: 5000, recurring: false },
    { id: '5', description: 'New Camera Installation (included with service contract)', qty: 4, unitPrice: 0, total: 0, recurring: false },
    { id: '6', description: 'Camera Cloud Monitoring — New Cameras', qty: 4, unitPrice: 100, total: 400, recurring: true },
    { id: '7', description: 'Camera Cloud Monitoring — Existing Cameras', qty: 1, unitPrice: 85, total: 85, recurring: true },
  ],
  totals: {
    setupTotal: 8250,
    monthlyTotal: 2965,
    depositDue: 7090,
    goLivePayment: 7090,
    contractValue: 186150,
    dealerMRR: 497,
  },
  preparedBy: {
    name: 'Russel Feldman',
    title: 'Gate Guard, LLC',
    phone: '844-469-4283',
    email: 'rfeldman@gateguard.co',
  },
};

export default function ProposalPage() {
  const [showTerms, setShowTerms] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const p = MOCK_PROPOSAL;
  const setupItems = p.lineItems.filter(i => !i.recurring);
  const monthlyItems = p.lineItems.filter(i => i.recurring);

  if (accepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-400/10 border-2 border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Proposal Accepted!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you, {p.property.contactName}. The GateGuard team will be in touch within 1 business day to schedule your kickoff call.
          </p>
          <div className="bg-card border border-border rounded-xl p-5 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground mb-3">Next Steps</p>
            {[
              'GateGuard sends your service agreement for e-signature',
              `Deposit of ${formatCurrency(p.totals.depositDue)} collected at signing`,
              'Site survey scheduled with your installation technician',
              'Equipment pre-configured and shipped to job site',
              'Go-live scheduled — dealer on-site 9 AM – 6 PM',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-400/20 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</div>
                <p className="text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Questions? Call {p.preparedBy.phone} or email {p.preparedBy.email}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      {/* Branded Header */}
      <div className="bg-navy border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-400/20 border border-brand-400/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">GateGuard</p>
              <p className="text-xs text-muted-foreground">Unrivaled Security</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-mono">{p.quoteNumber}</p>
            <p className="text-xs text-muted-foreground">Valid until {p.validUntil}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="space-y-2">
          <p className="text-xs text-brand-400 font-semibold uppercase tracking-widest">Security Proposal</p>
          <h1 className="text-3xl font-bold text-foreground">{p.property.name}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{p.property.city}, {p.property.state}</span>
            <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 opacity-0" />{p.property.units} residential units</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Prepared {p.createdAt}</span>
          </div>
        </div>

        {/* What's included */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">What&apos;s Included</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Proactive monitoring & preventative maintenance',
              'Remote technical support — unlimited',
              'Brivo access control — controllers & readers',
              'Brivo Mobile Pass for all residents',
              'GateGuard camera system (cloud-managed)',
              'RealPage / Yardi / Entrata API integration',
              'All parts & labor for GateGuard hardware',
              'RMA replacements shipped within 1 business day',
              'Dealer on-site monthly health checks',
              'SaaS platform — GateGuard OS portal access',
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Setup fees */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">One-Time Setup</h2>
            <p className="text-sm text-muted-foreground">Paid in two installments — see payment schedule below</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Description</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Qty</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Unit</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-6 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {setupItems.map(item => (
                <tr key={item.id}>
                  <td className="px-6 py-3 text-sm text-foreground">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">
                    {item.unitPrice === 0 ? <span className="text-emerald-400 font-medium">Included</span> : formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-foreground">
                    {item.total === 0 ? <span className="text-emerald-400">$0</span> : formatCurrency(item.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background/50">
                <td colSpan={3} className="px-6 py-4 text-sm font-bold text-foreground text-right">Setup Total</td>
                <td className="px-6 py-4 text-lg font-bold text-foreground text-right">{formatCurrency(p.totals.setupTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Monthly recurring */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Monthly Recurring</h2>
            <p className="text-sm text-muted-foreground">60-month service agreement · auto-renews annually after Year 5</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-background/50">
                <th className="text-left text-xs text-muted-foreground font-medium px-6 py-3">Service</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Qty</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-4 py-3">Rate</th>
                <th className="text-right text-xs text-muted-foreground font-medium px-6 py-3">Monthly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthlyItems.map(item => (
                <tr key={item.id}>
                  <td className="px-6 py-3 text-sm text-foreground">{item.description}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{item.qty}</td>
                  <td className="px-4 py-3 text-sm text-right text-muted-foreground">{formatCurrency(item.unitPrice)}/mo</td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-foreground">{formatCurrency(item.total)}/mo</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-background/50">
                <td colSpan={3} className="px-6 py-4 text-sm font-bold text-foreground text-right">Monthly Total</td>
                <td className="px-6 py-4 text-xl font-bold text-brand-400 text-right">{formatCurrency(p.totals.monthlyTotal)}/mo</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payment schedule */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Payment Schedule</h2>
          <div className="space-y-3">
            {[
              { label: 'Deposit — Due at Signing', amount: p.totals.depositDue, sub: '50% of setup fees + first month service', color: 'text-amber-400', dot: 'bg-amber-400' },
              { label: 'Go-Live Payment', amount: p.totals.goLivePayment, sub: '50% of setup fees + first month service (due on scheduled go-live date)', color: 'text-blue-400', dot: 'bg-blue-400' },
              { label: 'Monthly Recurring', amount: p.totals.monthlyTotal, sub: 'Begins on the 15th of the month following go-live', color: 'text-brand-400', dot: 'bg-brand-400', suffix: '/mo' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-border">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.dot}`} />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${item.color}`}>{formatCurrency(item.amount)}{item.suffix || ''}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Early termination (collapsible) */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowTerms(!showTerms)}
            className="w-full flex items-center justify-between p-6 text-left hover:bg-background/40 transition-colors"
          >
            <div>
              <h2 className="text-sm font-semibold text-foreground">Contract Terms & Early Termination</h2>
              <p className="text-xs text-muted-foreground mt-0.5">60-month agreement · click to expand</p>
            </div>
            {showTerms ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showTerms && (
            <div className="px-6 pb-6 space-y-4 border-t border-border pt-4">
              <p className="text-sm text-muted-foreground">Standard contract term is 60 months, auto-renewing annually thereafter. Early termination fees:</p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium py-2">Termination Year</th>
                    <th className="text-right text-xs text-muted-foreground font-medium py-2">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {[['Year 1','30% of remaining contract value'],['Year 2','20% of remaining contract value'],['Year 3','10% of remaining contract value'],['Year 4+','No fee']].map(([yr,fee]) => (
                    <tr key={yr}><td className="py-2 text-foreground">{yr}</td><td className="py-2 text-right text-muted-foreground">{fee}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">In the event of cancellation or non-payment, GateGuard reserves the right to remove all installed equipment including cameras, locks, access systems, and network hardware.</p>
            </div>
          )}
        </div>

        {/* Prepared by */}
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Prepared By</h2>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-400/10 border border-brand-400/20 flex items-center justify-center">
              <Shield className="w-6 h-6 text-brand-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">{p.preparedBy.name}</p>
              <p className="text-xs text-muted-foreground">{p.preparedBy.title}</p>
              <div className="flex gap-4 mt-1">
                <a href={`tel:${p.preparedBy.phone}`} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                  <Phone className="w-3 h-3" />{p.preparedBy.phone}
                </a>
                <a href={`mailto:${p.preparedBy.email}`} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                  <Mail className="w-3 h-3" />{p.preparedBy.email}
                </a>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">gateguard.co</p>
              <p className="text-xs text-muted-foreground">844-4MY-GATE</p>
              <p className="text-xs text-muted-foreground">Atlanta, GA 30328</p>
            </div>
          </div>
        </div>

        {/* Accept / Decline */}
        <div className="bg-card border border-brand-400/20 rounded-2xl p-6 text-center space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Ready to get started?</h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            By accepting this proposal, you agree to the GateGuard service agreement terms. A deposit of{' '}
            <span className="text-foreground font-semibold">{formatCurrency(p.totals.depositDue)}</span> is due at signing.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setAccepted(true)}
              className="flex items-center gap-2 px-8 py-3 bg-brand-400 hover:bg-brand-500 text-navy font-bold rounded-xl transition-colors gg-glow"
            >
              <CheckCircle2 className="w-5 h-5" />
              Accept Proposal
            </button>
            <button className="flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground hover:text-foreground rounded-xl transition-colors text-sm">
              <XCircle className="w-4 h-4" />
              Decline
            </button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Proposal valid until {p.validUntil}
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-6 space-y-1">
          <p>GateGuard, LLC · 980 Hammond Drive, Ste. 200 · Atlanta, GA 30328</p>
          <p>844-4MY-GATE · info@gateguard.co · gateguard.co</p>
          <p className="text-xs opacity-50 mt-2">Quote {p.quoteNumber} · Generated {p.createdAt}</p>
        </div>
      </div>
    </div>
  );
}
