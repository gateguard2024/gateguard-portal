'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Shield, Check, CheckCircle2, XCircle, Phone, Mail,
  MapPin, Calendar, Clock, Building2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { formatCurrency } from '@/lib/quote-calculator';

// ── Types ────────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  recurring: boolean;
  section_name?: string;
  is_optional?: boolean;
  is_included?: boolean;
}

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  created_at: string;
  expiry_date?: string;
  // property / contact
  property_name?: string;
  property_address?: string;
  property_city?: string;
  property_state?: string;
  property_zip?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  units?: number;
  cover_message?: string;
  // financial
  total_one_time?: number;
  total_mrr?: number;
  tax_rate?: number;
  discount_percent?: number;
  deposit_percent?: number;
  // relations
  opportunity_id?: string;
  org_name?: string;
  created_by_name?: string;
}

interface PublicResponse {
  quote: QuoteData;
  lineItems: LineItem[];
  org_name?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeTotals(items: LineItem[]) {
  const setupItems   = items.filter(i => !i.recurring);
  const monthlyItems = items.filter(i => i.recurring);
  const setupTotal   = setupItems.reduce((s, i) => s + (i.total ?? 0), 0);
  const monthlyTotal = monthlyItems.reduce((s, i) => s + (i.total ?? 0), 0);
  const depositDue   = setupTotal / 2 + monthlyTotal;
  const goLivePayment = setupTotal / 2 + monthlyTotal;
  const contractValue = setupTotal + monthlyTotal * 60;
  return { setupTotal, monthlyTotal, depositDue, goLivePayment, contractValue, setupItems, monthlyItems };
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return iso; }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ProposalPage() {
  const params   = useParams<{ id: string }>();
  const quoteId  = params?.id ?? '';

  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [data,      setData]      = useState<PublicResponse | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [accepted,  setAccepted]  = useState(false);
  const [declined,  setDeclined]  = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Fetch quote ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quoteId) return;
    fetch(`/api/quotes/${quoteId}/public`)
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => { throw new Error(d.error ?? `HTTP ${r.status}`) }))
      .then((d: PublicResponse) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quoteId]);

  // ── Accept / Decline ───────────────────────────────────────────────────────
  async function handleAccept() {
    setSubmitting(true);
    try {
      const r = await fetch(`/api/quotes/${quoteId}/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept' }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to accept');

      // If linked to an opportunity, push financial fields
      if (data?.quote.opportunity_id) {
        const totals = computeTotals(data.lineItems);
        void fetch(`/api/crm/opportunities/${data.quote.opportunity_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            est_deposit:   totals.depositDue,
            monthly_total: totals.monthlyTotal,
            est_mrr:       totals.monthlyTotal,
            units:         data.quote.units ?? undefined,
          }),
        }).catch(() => { /* non-blocking */ });
      }

      setAccepted(true);
    } catch (e: unknown) {
      alert((e instanceof Error ? e.message : 'Error') + ' — please try again or contact your dealer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setSubmitting(true);
    try {
      await fetch(`/api/quotes/${quoteId}/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      setDeclined(true);
    } catch {
      setDeclined(true); // still show declined state even if call fails
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Proposal Not Found</h1>
          <p className="text-sm text-muted-foreground">{error ?? 'This proposal link may have expired or been removed.'}</p>
        </div>
      </div>
    );
  }

  const q      = data.quote;
  const items  = data.lineItems;
  const totals = computeTotals(items);

  const propertyName = q.property_name || 'Your Property';
  const propertyCity = [q.property_city, q.property_state].filter(Boolean).join(', ');
  const contactName  = q.client_name || 'there';
  const orgName      = data.org_name || q.org_name || 'GateGuard';
  const preparedBy   = q.created_by_name || 'GateGuard Team';
  const expiryDate   = q.expiry_date ? fmtDate(q.expiry_date) : '';
  const createdDate  = fmtDate(q.created_at);
  const quoteNumber  = q.quote_number || `GQ-${q.id.slice(0, 8).toUpperCase()}`;

  // ── Accepted screen ────────────────────────────────────────────────────────
  if (accepted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-emerald-400/10 border-2 border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Proposal Accepted!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you, {contactName}. The GateGuard team will be in touch within 1 business day to schedule your kickoff call.
          </p>
          <div className="bg-card border border-border rounded-xl p-5 text-left space-y-2">
            <p className="text-sm font-semibold text-foreground mb-3">Next Steps</p>
            {[
              'GateGuard sends your service agreement for e-signature',
              `Deposit of ${formatCurrency(totals.depositDue)} collected at signing`,
              'Site survey scheduled with your installation technician',
              'Equipment pre-configured and shipped to job site',
              'Go-live scheduled — dealer on-site 9 AM – 6 PM',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-brand-400/20 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
                <p className="text-sm text-muted-foreground">{step}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            Questions? Visit <span className="text-brand-400">gateguard.co</span>
          </p>
        </div>
      </div>
    );
  }

  // ── Declined screen ────────────────────────────────────────────────────────
  if (declined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <XCircle className="w-14 h-14 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Proposal Declined</h1>
          <p className="text-sm text-muted-foreground">
            We&#39;ve recorded your response. If you change your mind or have questions, reach out to your GateGuard representative.
          </p>
        </div>
      </div>
    );
  }

  // ── Main proposal view ─────────────────────────────────────────────────────
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
          <div className="text-right flex items-center gap-3">
            <div>
              <p className="text-xs text-muted-foreground font-mono">{quoteNumber}</p>
              {expiryDate && <p className="text-xs text-muted-foreground">Valid until {expiryDate}</p>}
            </div>
            {/* Internal portal link — only visible in browser (no auth required, just helpful) */}
            <a
              href={`/quotes/${quoteId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1 text-[10px] text-brand-400/60 hover:text-brand-400 transition-colors"
              title="View in portal"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Hero */}
        <div className="space-y-2">
          <p className="text-xs text-brand-400 font-semibold uppercase tracking-widest">Security Proposal</p>
          <h1 className="text-3xl font-bold text-foreground">{propertyName}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {propertyCity && (
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{propertyCity}</span>
            )}
            {q.units && (
              <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{q.units} residential units</span>
            )}
            {createdDate && (
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Prepared {createdDate}</span>
            )}
          </div>
          {q.cover_message && (
            <p className="text-sm text-muted-foreground mt-3 max-w-2xl whitespace-pre-wrap">{q.cover_message}</p>
          )}
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
        {totals.setupItems.length > 0 && (
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
                {totals.setupItems.map(item => (
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
                  <td className="px-6 py-4 text-lg font-bold text-foreground text-right">{formatCurrency(totals.setupTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Monthly recurring */}
        {totals.monthlyItems.length > 0 && (
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
                {totals.monthlyItems.map(item => (
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
                  <td className="px-6 py-4 text-xl font-bold text-brand-400 text-right">{formatCurrency(totals.monthlyTotal)}/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Payment schedule */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Payment Schedule</h2>
          <div className="space-y-3">
            {[
              { label: 'Deposit — Due at Signing', amount: totals.depositDue, sub: '50% of setup fees + first month service', color: 'text-amber-400', dot: 'bg-amber-400' },
              { label: 'Go-Live Payment', amount: totals.goLivePayment, sub: '50% of setup fees + first month service (due on scheduled go-live date)', color: 'text-blue-400', dot: 'bg-blue-400' },
              { label: 'Monthly Recurring', amount: totals.monthlyTotal, sub: 'Begins on the 15th of the month following go-live', color: 'text-brand-400', dot: 'bg-brand-400', suffix: '/mo' },
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

        {/* Contract terms (collapsible) */}
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
                  {[['Year 1','30% of remaining contract value'],['Year 2','20% of remaining contract value'],['Year 3','10% of remaining contract value'],['Year 4+','No fee']].map(([yr, fee]) => (
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
              <p className="text-sm font-semibold text-foreground">{preparedBy}</p>
              <p className="text-xs text-muted-foreground">{orgName}</p>
              <div className="flex gap-4 mt-1">
                <a href="tel:844-469-4283" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                  <Phone className="w-3 h-3" />844-469-4283
                </a>
                <a href="mailto:info@gateguard.co" className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300">
                  <Mail className="w-3 h-3" />info@gateguard.co
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
            <span className="text-foreground font-semibold">{formatCurrency(totals.depositDue)}</span> is due at signing.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={handleAccept}
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 bg-brand-400 hover:bg-brand-500 text-navy font-bold rounded-xl transition-colors gg-glow disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Accept Proposal
            </button>
            <button
              onClick={handleDecline}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground hover:text-foreground rounded-xl transition-colors text-sm disabled:opacity-60"
            >
              <XCircle className="w-4 h-4" />
              Decline
            </button>
          </div>
          {expiryDate && (
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              Proposal valid until {expiryDate}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-6 space-y-1">
          <p>GateGuard, LLC · 980 Hammond Drive, Ste. 200 · Atlanta, GA 30328</p>
          <p>844-4MY-GATE · info@gateguard.co · gateguard.co</p>
          <p className="text-xs opacity-50 mt-2">Quote {quoteNumber} · Generated {createdDate}</p>
        </div>
      </div>
    </div>
  );
}
