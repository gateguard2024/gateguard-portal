'use client';

import { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Shield, Check, CheckCircle2, XCircle, Phone, Mail,
  MapPin, Calendar, Clock, Building2, ChevronDown, ChevronUp,
  Loader2, AlertTriangle, TrendingUp, Download, FileText,
} from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Pen, RotateCcw } = require('lucide-react') as any;
import { formatCurrency, buildRampSchedule, type RampRow } from '@/lib/quote-calculator';

// ── Types ──────────────────────────────────────────────────────────────────────

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
  unit?: string;
  sku?: string;
  model_number?: string;
}

interface Attachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

interface PaymentScheduleItem {
  label: string;
  description: string;
  amount: number;
  suffix?: string;
  color: 'amber' | 'blue' | 'brand';
}

interface QuoteData {
  id: string;
  quote_number: string;
  status: string;
  created_at: string;
  expiry_date?: string;
  property_name?: string;
  property_address?: string;
  units?: number;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  cover_message?: string;
  total_one_time?: number;
  total_mrr?: number;
  tax_rate?: number;
  discount_percent?: number;
  deposit_percent?: number;
  payment_plan?: string;
  ramp_up_start_pct?: number;
  ramp_up_step_pct?: number;
  ramp_up_full_month?: number;
  opportunity_id?: string;
  org_name?: string;
  created_by_name?: string;
  // new fields
  whats_included?: string[];
  payment_schedule_json?: PaymentScheduleItem[] | null;
  sow_text?: string;
  agreement_type?: string;
  agreement_html?: string;
  attachments?: Attachment[];
  signed_at?: string;
  signer_name?: string;
  accepted_by_rep?: boolean;
  accepted_by_rep_name?: string;
}

interface PublicResponse {
  quote: QuoteData;
  lineItems: LineItem[];
  org_name?: string;
}

// ── Default "What's Included" list ────────────────────────────────────────────

const DEFAULT_WHATS_INCLUDED = [
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
];

// ── Default agreement by type ────────────────────────────────────────────────

const AGREEMENT_TEMPLATES: Record<string, string> = {
  install_only: `<h3>Installation Agreement</h3>
<p>This quotation is not a contract or bill. It is our best estimate of the total price for the services and goods described. Payment will be due prior to delivery of service and goods.</p>
<h4>Requirements</h4>
<p><strong>Internet Requirements:</strong> For us to provide our monitoring services, we require internet connectivity with sufficient upload speeds to transmit fluid video to our control center. We require 2 Mbps upload per monitored gate & camera.</p>
<p><strong>Network Security:</strong> We will comply with customer demands as they relate to network security protocols. Customer is responsible for providing GateGuard Activation Team requirements in writing.</p>
<p><strong>Power and Lighting:</strong> Customer must provide 120V outlets with constant power to proposed enclosure locations. GateGuard will send day and night camera views after installation.</p>
<p><strong>Additional Requirements:</strong> If additional equipment and/or labor is needed beyond what is described above, an additional cost will apply. All wiring will not be installed inside conduit unless specified in this proposal.</p>
<p><strong>PM Visit Required:</strong> Upon approval, one of our Project Managers will tour the site and create a detailed installation guide. Any additional equipment determined necessary will be billed on a time and materials basis.</p>`,

  install_service: `<h3>Installation & Service Agreement</h3>
<p>This agreement covers both the one-time installation and ongoing managed service described in this proposal. The monthly service fee begins 30 days after the "go-live" date.</p>
<h4>Service Plan Terms</h4>
<p><strong>Term:</strong> 60-month initial service term, auto-renewing annually thereafter unless cancelled in writing with 90 days prior notice.</p>
<p><strong>Early Termination:</strong> Year 1: 30% of remaining contract value. Year 2: 20%. Year 3: 10%. Year 4+: No fee.</p>
<p><strong>Equipment Ownership:</strong> All GateGuard-supplied hardware remains the property of GateGuard, LLC during the service term. In the event of cancellation or non-payment, GateGuard reserves the right to remove all installed equipment.</p>
<p><strong>Internet Requirements:</strong> Customer must maintain internet connectivity with minimum 2 Mbps upload per monitored gate & camera. Service disruptions caused by customer-side internet outages are not covered under this agreement.</p>
<p><strong>Network Security:</strong> Customer is responsible for providing network security requirements in writing. GateGuard will comply with reasonable security protocols.</p>
<p><strong>Power Requirements:</strong> Customer must provide 120V outlets with constant power to all enclosure locations.</p>`,

  gate_maintenance: `<h3>Gate Operator Service Plan</h3>
<p>In addition to the installation and managed service terms, this agreement includes coverage of the gate operator system under GateGuard's Gate Operator Service Plan.</p>
<h4>Gate Operator Coverage</h4>
<p><strong>Covered Equipment:</strong> Gate operators, wiring, control boards, and associated control equipment installed by GateGuard.</p>
<p><strong>NOT Covered:</strong> Physical gate structure — panels, frames, tracks, hinges, rollers, and any structural steel. Physical damage from vehicle impact or vandalism is excluded.</p>
<p><strong>Response Time:</strong> Emergency service dispatched within 4 business hours. Non-emergency scheduled within 3 business days.</p>
<p><strong>Physical Gate Coverage (Optional Add-On):</strong> Coverage for the physical gate structure (panels, tracks, hinges, rollers) is available as an optional add-on at $250/gate/month.</p>
<h4>Installation & Service Terms</h4>
<p>All standard Installation & Service Agreement terms apply as listed above.</p>`,

  full_service: `<h3>Full Service Agreement — GateGuard Complete</h3>
<p>This agreement covers installation, ongoing managed service, gate operator maintenance, and all applicable ancillary services described in this proposal.</p>
<h4>Complete Coverage Includes</h4>
<p>All terms from the Installation & Service Agreement and Gate Operator Service Plan apply. See those sections for full detail.</p>
<h4>SLA Commitments</h4>
<p><strong>Monitoring Uptime:</strong> 99.5% uptime guarantee for cloud monitoring services. Credits applied for downtime exceeding threshold.</p>
<p><strong>RMA Replacement:</strong> Failed hardware shipped within 1 business day of confirmed failure diagnosis.</p>
<p><strong>Monthly Health Check:</strong> Dealer technician on-site visit every 30 days. Written report provided to property manager within 48 hours of visit.</p>`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeTotals(items: LineItem[]) {
  const setupItems    = items.filter(i => !i.recurring);
  const monthlyItems  = items.filter(i => i.recurring);
  const setupTotal    = setupItems.reduce((s, i) => s + (i.total ?? 0), 0);
  const monthlyTotal  = monthlyItems.reduce((s, i) => s + (i.total ?? 0), 0);
  const depositDue    = setupTotal / 2 + monthlyTotal;
  const goLivePayment = setupTotal / 2 + monthlyTotal;
  const contractValue = setupTotal + monthlyTotal * 60;
  return { setupTotal, monthlyTotal, depositDue, goLivePayment, contractValue, setupItems, monthlyItems };
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return iso; }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Ramp-Up Schedule ──────────────────────────────────────────────────────────

function RampUpSchedule({ mrr, startPct, stepPct, fullMonth }: {
  mrr: number; startPct: number; stepPct: number; fullMonth: number;
}) {
  const rows    = buildRampSchedule(mrr, startPct, stepPct, fullMonth);
  const savings = rows.slice(0, -1).reduce((s: number, r: RampRow) => s + (mrr - r.amount), 0);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-[#6B7EFF]" />
        <h2 className="text-lg font-semibold text-gray-900">Ramp-Up Schedule</h2>
      </div>
      <p className="text-sm text-gray-500">Your monthly rate starts lower and increases gradually, giving your team time to fully onboard residents before paying full rate.</p>
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left text-xs text-gray-500 font-medium px-4 py-3">Month</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Rate</th>
              <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Monthly Bill</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <tr className="bg-blue-50/50">
              <td className="px-4 py-2.5 text-sm font-medium text-gray-900">Month 1</td>
              <td className="px-4 py-2.5 text-sm text-right text-gray-500">100% (deposit)</td>
              <td className="px-4 py-2.5 text-sm text-right font-semibold text-gray-900">{formatCurrency(mrr)}</td>
            </tr>
            {rows.map(r => (
              <tr key={r.month} className={r.pct === 100 ? 'bg-emerald-50/50' : ''}>
                <td className="px-4 py-2.5 text-sm font-medium text-gray-900">Month {r.month}{r.pct === 100 ? '+' : ''}</td>
                <td className="px-4 py-2.5 text-sm text-right text-gray-500">{r.pct.toFixed(0)}%</td>
                <td className="px-4 py-2.5 text-sm text-right font-semibold text-gray-900">{formatCurrency(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {savings > 0 && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700"><span className="font-semibold">{formatCurrency(savings)}</span> total savings during ramp-up period</p>
        </div>
      )}
    </div>
  );
}

// ── Signature Canvas ──────────────────────────────────────────────────────────

function SignatureCanvas({ onSign, onClear, signed }: {
  onSign: (dataUrl: string) => void;
  onClear: () => void;
  signed: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing   = useRef(false);
  const lastPos   = useRef<{ x: number; y: number } | null>(null);
  const hasStrokes = useRef(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top)  * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (signed) return;
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || signed) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
    hasStrokes.current = true;
  };

  const endDraw = () => {
    drawing.current = false;
    if (hasStrokes.current && canvasRef.current) {
      onSign(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    onClear();
  };

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 overflow-hidden" style={{ touchAction: 'none' }}>
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-40 cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!signed && !hasStrokes.current && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-gray-400">
              <Pen className="w-4 h-4" />
              <span className="text-sm">Sign here</span>
            </div>
          </div>
        )}
        {/* Signature line */}
        <div className="absolute bottom-8 left-8 right-8 border-b border-gray-300 pointer-events-none" />
        <p className="absolute bottom-2 left-8 text-xs text-gray-400 pointer-events-none">Signature</p>
      </div>
      {!signed && (
        <button onClick={clear} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <RotateCcw className="w-3 h-3" /> Clear
        </button>
      )}
    </div>
  );
}

// ── Page wrapper (Suspense required for useSearchParams) ──────────────────────

export default function ProposalPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-8 w-8 animate-spin text-[#6B7EFF]" /></div>}>
      <ProposalPage />
    </Suspense>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function ProposalPage() {
  const params        = useParams<{ id: string }>();
  const searchParams  = useSearchParams();
  const quoteId       = params?.id ?? '';
  const autoPrint     = searchParams?.get('print') === '1';
  const printTriggered = useRef(false);

  const [loading,     setLoading]    = useState(true);
  const [error,       setError]      = useState<string | null>(null);
  const [data,        setData]       = useState<PublicResponse | null>(null);
  const [showTerms,   setShowTerms]  = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [accepted,    setAccepted]   = useState(false);
  const [declined,    setDeclined]   = useState(false);
  const [submitting,  setSubmitting] = useState(false);

  // Signature state
  const [signerName,   setSignerName]   = useState('');
  const [signerEmail,  setSignerEmail]  = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [showSigForm,  setShowSigForm]  = useState(false);
  const [sigError,     setSigError]     = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quoteId) return;
    fetch(`/api/quotes/${quoteId}/public`)
      .then(r => r.ok ? r.json() : r.json().then((d: { error?: string }) => { throw new Error(d.error ?? `HTTP ${r.status}`) }))
      .then((d: PublicResponse) => {
        setData(d);
        // Pre-fill signer email from quote if available
        if (d.quote.client_email) setSignerEmail(d.quote.client_email);
        if (d.quote.client_name)  setSignerName(d.quote.client_name);
        // If already signed/accepted
        if (d.quote.status === 'accepted') setAccepted(true);
        if (d.quote.status === 'declined') setDeclined(true);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [quoteId]);

  // ── Auto-print ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!autoPrint || loading || error || !data || printTriggered.current) return;
    printTriggered.current = true;
    const t = setTimeout(() => window.print(), 900);
    return () => clearTimeout(t);
  }, [autoPrint, loading, error, data]);

  // ── Sign & Accept ──────────────────────────────────────────────────────────
  const handleSign = useCallback(async () => {
    if (!signerName.trim()) { setSigError('Please enter your full name.'); return; }
    if (!signatureData)     { setSigError('Please draw your signature above.'); return; }
    setSigError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/quotes/${quoteId}/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:         'sign',
          signer_name:    signerName.trim(),
          signer_email:   signerEmail.trim() || null,
          signature_data: signatureData,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to submit');

      // Push financial data back to opportunity
      if (data?.quote.opportunity_id) {
        const totals = computeTotals(data.lineItems);
        void fetch(`/api/crm/opportunities/${data.quote.opportunity_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ est_deposit: totals.depositDue, monthly_total: totals.monthlyTotal, est_mrr: totals.monthlyTotal, units: data.quote.units }),
        }).catch(() => {});
      }
      setAccepted(true);
    } catch (e: unknown) {
      setSigError((e instanceof Error ? e.message : 'Error') + ' — please try again or contact your dealer.');
    } finally {
      setSubmitting(false);
    }
  }, [signerName, signerEmail, signatureData, quoteId, data]);

  const handleDecline = useCallback(async () => {
    if (!confirm('Are you sure you want to decline this proposal?')) return;
    setSubmitting(true);
    try {
      await fetch(`/api/quotes/${quoteId}/public`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline' }),
      });
      setDeclined(true);
    } catch { setDeclined(true); }
    finally { setSubmitting(false); }
  }, [quoteId]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#6B7EFF] animate-spin" />
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proposal Not Found</h1>
        <p className="text-sm text-gray-500">{error ?? 'This proposal link may have expired or been removed.'}</p>
      </div>
    </div>
  );

  const q      = data.quote;
  const items  = data.lineItems ?? [];
  const totals = computeTotals(items);

  const propertyName  = q.property_name  || 'Your Property';
  const contactName   = q.client_name    || 'there';
  const orgName       = data.org_name    || q.org_name || 'GateGuard';
  const preparedBy    = q.created_by_name || 'GateGuard Team';
  const expiryDate    = q.expiry_date ? fmtDate(q.expiry_date) : '';
  const createdDate   = fmtDate(q.created_at);
  const quoteNumber   = q.quote_number || `GQ-${q.id.slice(0, 8).toUpperCase()}`;

  const showRampUp    = q.payment_plan === 'ramp_up' && totals.monthlyTotal > 0;
  const rampStartPct  = q.ramp_up_start_pct  ?? 10;
  const rampStepPct   = q.ramp_up_step_pct   ?? 7.5;
  const rampFullMonth = q.ramp_up_full_month ?? 14;
  const displayDeposit = totals.setupTotal / 2 + totals.monthlyTotal;

  // "What's Included" — use custom list if provided, else defaults (only if there's MRR)
  const whatsIncluded: string[] = (q.whats_included && q.whats_included.length > 0)
    ? q.whats_included
    : totals.monthlyTotal > 0 ? DEFAULT_WHATS_INCLUDED : [];

  // Payment schedule — custom override or computed
  const paymentSchedule: PaymentScheduleItem[] = q.payment_schedule_json ?? [
    ...(totals.setupTotal > 0 ? [
      { label: 'Deposit — Due at Signing',  description: '50% of setup fees + first month service', amount: displayDeposit, color: 'amber' as const },
      { label: 'Go-Live Payment',           description: '50% of setup fees + first month service (due on scheduled go-live date)', amount: totals.goLivePayment, color: 'blue' as const },
    ] : []),
    ...(totals.monthlyTotal > 0 ? [
      { label: showRampUp ? 'Monthly Recurring (ramp-up)' : 'Monthly Recurring',
        description: showRampUp ? `Begins below full rate — reaches 100% in Month ${rampFullMonth}` : 'Begins on the 15th of the month following go-live',
        amount: totals.monthlyTotal, suffix: '/mo', color: 'brand' as const },
    ] : []),
  ];

  const dotColor = { amber: 'bg-amber-400', blue: 'bg-blue-500', brand: 'bg-[#6B7EFF]' };
  const textColor = { amber: 'text-amber-500', blue: 'text-blue-600', brand: 'text-[#6B7EFF]' };

  // Agreement HTML — custom or template by type
  const agreementHtml = q.agreement_html || AGREEMENT_TEMPLATES[q.agreement_type ?? 'install_only'] || AGREEMENT_TEMPLATES.install_only;
  const attachments: Attachment[] = q.attachments ?? [];

  // ── Accepted screen ────────────────────────────────────────────────────────
  if (accepted) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-emerald-100 border-2 border-emerald-300 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Proposal Accepted!</h1>
        <p className="text-gray-500 mb-6">
          Thank you{contactName !== 'there' ? `, ${contactName}` : ''}. The GateGuard team will be in touch within 1 business day to schedule your kickoff call.
        </p>
        {q.signer_name && (
          <p className="text-sm text-gray-400 mb-4">Signed by <span className="font-medium text-gray-600">{q.signer_name}</span> on {fmtDate(q.signed_at)}</p>
        )}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-left space-y-2">
          <p className="text-sm font-semibold text-gray-900 mb-3">Next Steps</p>
          {[
            `Deposit of ${formatCurrency(displayDeposit)} collected at signing`,
            'Site survey scheduled with your installation technician',
            'Equipment pre-configured and shipped to job site',
            'Go-live scheduled — dealer on-site 9 AM – 6 PM',
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-5 h-5 rounded-full bg-[#6B7EFF]/20 text-[#6B7EFF] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-sm text-gray-500">{step}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-6">Questions? Contact <span className="text-[#6B7EFF]">info@gateguard.co</span> or 844-469-4283</p>
      </div>
    </div>
  );

  if (declined) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <XCircle className="w-14 h-14 text-gray-300 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-900 mb-2">Proposal Declined</h1>
        <p className="text-sm text-gray-500">We&apos;ve recorded your response. If you change your mind or have questions, reach out to your GateGuard representative.</p>
      </div>
    </div>
  );

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print / PDF stylesheet */}
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #ffffff !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
          .sig-section { display: none !important; }
          a { color: inherit !important; text-decoration: none !important; }
        }
        .agreement-content h3 { font-size: 1rem; font-weight: 700; margin: 1rem 0 0.5rem; color: #0f172a; }
        .agreement-content h4 { font-size: 0.875rem; font-weight: 600; margin: 0.875rem 0 0.375rem; color: #1e293b; }
        .agreement-content p  { font-size: 0.8125rem; color: #475569; margin: 0.375rem 0; line-height: 1.6; }
        .agreement-content strong { color: #1e293b; }
      `}</style>

      <div className="min-h-screen bg-white">

        {/* Header */}
        <div className="bg-[#0B1728] border-b border-white/10 print:bg-[#0B1728]">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#6B7EFF]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">GateGuard</p>
                <p className="text-xs text-white/50">Unrivaled Security</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-white/50 font-mono">{quoteNumber}</p>
                {expiryDate && <p className="text-xs text-white/40">Valid until {expiryDate}</p>}
              </div>
              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white text-xs rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

          {/* Hero */}
          <div className="space-y-2">
            <p className="text-xs text-[#6B7EFF] font-semibold uppercase tracking-widest">Security Proposal</p>
            <h1 className="text-3xl font-bold text-gray-900">{propertyName}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
              {q.property_address && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{q.property_address}</span>}
              {q.units            && <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />{q.units} residential units</span>}
              {createdDate        && <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" />Prepared {createdDate}</span>}
            </div>
            {q.cover_message && (
              <p className="text-sm text-gray-500 mt-3 max-w-2xl whitespace-pre-wrap">{q.cover_message}</p>
            )}
          </div>

          {/* What's Included — only shown if list is non-empty */}
          {whatsIncluded.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">What&apos;s Included</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {whatsIncluded.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#6B7EFF] shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SOW — only if present */}
          {q.sow_text && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#6B7EFF]" />
                <h2 className="text-lg font-semibold text-gray-900">Scope of Work</h2>
              </div>
              <div className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{q.sow_text}</div>
            </div>
          )}

          {/* One-Time Setup */}
          {totals.setupItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">One-Time Setup</h2>
                {totals.monthlyTotal > 0 && <p className="text-sm text-gray-500">Paid in two installments — see payment schedule below</p>}
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Description</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Qty</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Unit</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-6 py-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {totals.setupItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-6 py-3 text-sm text-gray-800">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{item.qty}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">
                        {item.unitPrice === 0 ? <span className="text-emerald-600 font-medium">Included</span> : formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                        {item.total === 0 ? <span className="text-emerald-600">$0</span> : formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">Setup Total</td>
                    <td className="px-6 py-4 text-lg font-bold text-gray-900 text-right">{formatCurrency(totals.setupTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Monthly Recurring */}
          {totals.monthlyItems.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Monthly Recurring</h2>
                <p className="text-sm text-gray-500">60-month service agreement · auto-renews annually after Year 5</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left text-xs text-gray-500 font-medium px-6 py-3">Service</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Qty</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-4 py-3">Rate</th>
                    <th className="text-right text-xs text-gray-500 font-medium px-6 py-3">Monthly</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {totals.monthlyItems.map(item => (
                    <tr key={item.id}>
                      <td className="px-6 py-3 text-sm text-gray-800">{item.description}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{item.qty}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500">{formatCurrency(item.unitPrice)}/mo</td>
                      <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(item.total)}/mo</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td colSpan={3} className="px-6 py-4 text-sm font-bold text-gray-900 text-right">Monthly Total</td>
                    <td className="px-6 py-4 text-xl font-bold text-[#6B7EFF] text-right">{formatCurrency(totals.monthlyTotal)}/mo</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Ramp-Up */}
          {showRampUp && (
            <RampUpSchedule mrr={totals.monthlyTotal} startPct={rampStartPct} stepPct={rampStepPct} fullMonth={rampFullMonth} />
          )}

          {/* Payment Schedule — only if there's something to show */}
          {paymentSchedule.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Payment Schedule</h2>
              <div className="space-y-3">
                {paymentSchedule.map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${dotColor[item.color]}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                        <p className="text-xs text-gray-500">{item.description}</p>
                      </div>
                    </div>
                    <p className={`text-lg font-bold ${textColor[item.color]}`}>{formatCurrency(item.amount)}{item.suffix || ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agreement (collapsible) */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowAgreement(!showAgreement)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Service Agreement</h2>
                <p className="text-xs text-gray-500 mt-0.5">Review terms before signing · click to expand</p>
              </div>
              {showAgreement ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showAgreement && (
              <div className="px-6 pb-6 border-t border-gray-200 pt-4">
                <div
                  className="agreement-content"
                  dangerouslySetInnerHTML={{ __html: agreementHtml }}
                />
              </div>
            )}
          </div>

          {/* Contract terms */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowTerms(!showTerms)}
              className="w-full flex items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Contract Terms & Early Termination</h2>
                <p className="text-xs text-gray-500 mt-0.5">60-month agreement · click to expand</p>
              </div>
              {showTerms ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showTerms && (
              <div className="px-6 pb-6 space-y-4 border-t border-gray-200 pt-4">
                <p className="text-sm text-gray-500">Standard contract term is 60 months, auto-renewing annually thereafter. Early termination fees:</p>
                <table className="w-full">
                  <thead><tr className="border-b border-gray-200">
                    <th className="text-left text-xs text-gray-500 font-medium py-2">Termination Year</th>
                    <th className="text-right text-xs text-gray-500 font-medium py-2">Fee</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {[['Year 1','30% of remaining contract value'],['Year 2','20% of remaining contract value'],['Year 3','10% of remaining contract value'],['Year 4+','No fee']].map(([yr, fee]) => (
                      <tr key={yr}><td className="py-2 text-gray-800">{yr}</td><td className="py-2 text-right text-gray-500">{fee}</td></tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-500">In the event of cancellation or non-payment, GateGuard reserves the right to remove all installed equipment including cameras, locks, access systems, and network hardware.</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">Attachments</h2>
              <div className="space-y-2">
                {attachments.map((att, i) => (
                  <a
                    key={i}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-colors group"
                  >
                    <FileText className="w-4 h-4 text-[#6B7EFF] shrink-0" />
                    <span className="text-sm text-gray-700 flex-1 group-hover:text-gray-900">{att.name}</span>
                    {att.size && <span className="text-xs text-gray-400">{formatBytes(att.size)}</span>}
                    <Download className="w-3.5 h-3.5 text-gray-400 group-hover:text-[#6B7EFF]" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Prepared By */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Prepared By</h2>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#6B7EFF]/10 border border-[#6B7EFF]/20 flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#6B7EFF]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900">{preparedBy}</p>
                <p className="text-xs text-gray-500">{orgName}</p>
                <div className="flex gap-4 mt-1">
                  <a href="tel:844-469-4283" className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline"><Phone className="w-3 h-3" />844-469-4283</a>
                  <a href="mailto:info@gateguard.co" className="flex items-center gap-1 text-xs text-[#6B7EFF] hover:underline"><Mail className="w-3 h-3" />info@gateguard.co</a>
                </div>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>gateguard.co</p>
                <p>844-4MY-GATE</p>
                <p>Atlanta, GA 30328</p>
              </div>
            </div>
          </div>

          {/* Signature / Accept section */}
          <div className="sig-section no-print">
            {!showSigForm ? (
              <div className="bg-white border border-[#6B7EFF]/30 rounded-2xl p-6 text-center space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Ready to get started?</h2>
                <p className="text-sm text-gray-500 max-w-lg mx-auto">
                  By accepting this proposal, you agree to the GateGuard service agreement terms.{totals.setupTotal > 0 && <> A deposit of <span className="text-gray-900 font-semibold">{formatCurrency(displayDeposit)}</span> is due at signing.</>}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setShowSigForm(true)}
                    className="flex items-center gap-2 px-8 py-3 bg-[#6B7EFF] hover:bg-[#5a6de8] text-white font-bold rounded-xl transition-colors shadow-sm"
                  >
                    <Pen className="w-4 h-4" />
                    Sign &amp; Accept Proposal
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={submitting}
                    className="flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-500 hover:text-gray-700 rounded-xl transition-colors text-sm disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    Decline
                  </button>
                </div>
                {expiryDate && (
                  <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                    <Clock className="w-3.5 h-3.5" />Proposal valid until {expiryDate}
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-white border border-[#6B7EFF]/30 rounded-2xl p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Sign &amp; Accept</h2>
                  <p className="text-sm text-gray-500 mt-1">By signing below you agree to the terms of this proposal and service agreement.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={e => setSignerName(e.target.value)}
                      placeholder="Jane Smith"
                      className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/40 focus:border-[#6B7EFF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={signerEmail}
                      onChange={e => setSignerEmail(e.target.value)}
                      placeholder="jane@property.com"
                      className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/40 focus:border-[#6B7EFF]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2">Signature <span className="text-red-500">*</span></label>
                  <SignatureCanvas
                    onSign={d => setSignatureData(d)}
                    onClear={() => setSignatureData(null)}
                    signed={false}
                  />
                </div>

                {sigError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />{sigError}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleSign}
                    disabled={submitting || !signatureData || !signerName.trim()}
                    className="flex items-center gap-2 px-8 py-3 bg-[#6B7EFF] hover:bg-[#5a6de8] text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Submit Signature
                  </button>
                  <button
                    onClick={() => setShowSigForm(false)}
                    className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-400 pb-6 space-y-1">
            <p>GateGuard, LLC · 980 Hammond Drive, Ste. 200 · Atlanta, GA 30328</p>
            <p>844-4MY-GATE · info@gateguard.co · gateguard.co</p>
            <p className="opacity-50 mt-2">Quote {quoteNumber} · Generated {createdDate}</p>
          </div>

        </div>
      </div>
    </>
  );
}
