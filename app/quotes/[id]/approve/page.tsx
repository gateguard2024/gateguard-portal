'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Send, Check, X, Loader2, Copy, Mail, Shield, Calendar, Zap, ChevronDown, ChevronUp } from 'lucide-react';

/* ─── Design tokens ──────────────────────────────────────────────────────────── */
const NAVY   = '#0E1E3D';
const NAVY2  = '#0A1628';
const BLUE   = '#6B7EFF';
const GREEN  = '#10B981';
const RED    = '#EF4444';
const AMBER  = '#F59E0B';
const TEXT   = '#0F172A';
const MUTED  = '#64748B';
const BORDER = '#E2E8F0';
const WHITE  = '#FFFFFF';
const CREAM  = '#F5F1E8';
const CREAM2 = '#EDE9DF';
const LIGHT  = '#F8FAFC';
const SANS   = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO   = "'IBM Plex Mono', 'Courier New', monospace";

/* ─── Types ──────────────────────────────────────────────────────────────────── */
interface LineItem {
  id: string; sort_order: number; category: string; description: string;
  qty: number; unit_price: number; unit: string; is_recurring: boolean;
  section_name: string; item_type: string; is_optional: boolean; is_included: boolean;
  package_tier: string | null; image_url: string | null;
  model_number: string | null; notes: string | null; sku: string | null;
}

interface Quote {
  id: string; quote_number: string; title: string | null; status: string;
  property_name: string | null; units: number | null;
  total_one_time: number | null; total_mrr: number | null;
  valid_until: string | null; expiry_date: string | null;
  client_name: string | null; client_email: string | null; client_phone: string | null;
  property_address: string | null; notes: string | null;
  cover_message: string | null; terms_text: string | null;
  tax_rate: number | null; discount_percent: number | null; deposit_percent: number | null;
  package_mode: boolean | null; selected_package: string | null;
  created_by_name: string | null; quote_mode: string | null;
  org_name: string | null;
  quote_line_items: LineItem[];
}

type PageStatus = 'loading' | 'error' | 'pending' | 'approved' | 'declined';
type Comment = { id: string; author: string; text: string; ts: string; fromClient: boolean };

/* ─── Helpers ────────────────────────────────────────────────────────────────── */
function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}
function nowStr() {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}
function expiry(q: Quote) {
  const raw = q.expiry_date ?? q.valid_until;
  if (!raw) return null;
  try { return new Date(raw).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return raw; }
}

/* ─── SOW parser — splits ALL CAPS section headers into blocks ───────────────── */
function parseSow(text: string): { heading: string; body: string }[] {
  if (!text) return [];
  // Split on lines that are ALL CAPS (section headers)
  const lines = text.split('\n');
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { if (current) current.body += '\n'; continue; }
    // ALL CAPS header detection (≥4 chars, majority uppercase)
    const upper = trimmed.toUpperCase();
    const isHeader = trimmed === upper && trimmed.length >= 4 && /^[A-Z\s\/\-\.]+$/.test(trimmed);
    if (isHeader) {
      if (current) sections.push(current);
      current = { heading: trimmed, body: '' };
    } else {
      if (!current) current = { heading: '', body: '' };
      current.body += (current.body ? '\n' : '') + trimmed;
    }
  }
  if (current && (current.heading || current.body.trim())) sections.push(current);
  return sections.filter(s => s.body.trim());
}

/* ─── Email template builder ─────────────────────────────────────────────────── */
function buildEmail(q: Quote, pageUrl: string): string {
  const client = q.client_name ?? 'there';
  const prop   = q.property_name ?? 'your property';
  const addr   = q.property_address ? ` at ${q.property_address}` : '';
  const prep   = q.created_by_name ?? 'The GateGuard Team';
  const org    = q.org_name ?? 'GateGuard';

  const nonRecurring = (q.quote_line_items ?? []).filter(i => !i.is_optional && !i.is_recurring);
  const recurring    = (q.quote_line_items ?? []).filter(i => !i.is_optional && i.is_recurring);
  const setupTotal   = nonRecurring.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const mrrTotal     = recurring.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const dep          = q.deposit_percent ?? 50;

  return `Subject: GateGuard Access Control Proposal for ${prop} — ${q.quote_number}

Hi ${client},

I wanted to personally send over the GateGuard proposal for ${prop}${addr}. We put together a tailored access control program that will modernize your entry points, eliminate your current monitoring fees, and put your community on the GateGuard platform from day one.

Here's a quick summary of what we've put together:

• One-Time Setup Investment: ${fmt(setupTotal)} (${fmt(setupTotal * 0.5)} deposit at signing · balance due after install)
${mrrTotal > 0 ? `• Monthly Access Plan: ${fmt(mrrTotal)}/month${q.units ? ` (${q.units} units × $10/unit)` : ''} — 60-month agreement` : ''}
• Deposit at signing: ${fmt(setupTotal * 0.5 + mrrTotal * 0.5)} (50% setup + 50% first month)
• Residents are billed a $150 one-time move-in access fee by your property — netting ~$30/unit/year positive cash flow

You can view the full proposal and approve directly here:
${pageUrl}

The link is fully interactive — you can review the scope, toggle add-ons, leave comments, and approve with one click. No login required.

This proposal is valid until ${expiry(q) ?? '30 days from send date'}. I'm happy to jump on a call to walk through any questions — just reply here or text me directly.

Looking forward to getting ${prop} live on GateGuard.

${prep}
${org}`;
}

/* ─── Main component ─────────────────────────────────────────────────────────── */
export default function QuoteApprovePageWrapper({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 style={{ width: 32, height: 32, color: '#6B7EFF' }} className="animate-spin" /></div>}>
      <QuoteApprovePage params={params} />
    </Suspense>
  );
}

function QuoteApprovePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [quote, setQuote]           = useState<Quote | null>(null);

  const [selectedPkg, setSelectedPkg]             = useState<string | null>(null);
  const [itemSelections, setItemSelections]       = useState<Record<string, boolean>>({});
  const [commentText, setCommentText]             = useState('');
  const [comments, setComments]                   = useState<Comment[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showDeclineForm, setShowDeclineForm]     = useState(false);
  const [declineNote, setDeclineNote]             = useState('');
  const [submitting, setSubmitting]               = useState(false);
  const [showEmail, setShowEmail]                 = useState(false);
  const [emailCopied, setEmailCopied]             = useState(false);
  const [expandedSow, setExpandedSow]             = useState<Record<string, boolean>>({});
  const commentEndRef = useRef<HTMLDivElement>(null);

  /* ── Fetch ───────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/quotes/${params.id}/public`);
        if (!r.ok) { setPageStatus('error'); return; }
        const { quote: q } = await r.json();
        setQuote(q);
        if (q.status === 'accepted') { setPageStatus('approved'); return; }
        if (q.status === 'declined') { setPageStatus('declined'); return; }
        if (q.package_mode && q.selected_package) setSelectedPkg(q.selected_package);
        const init: Record<string, boolean> = {};
        for (const item of q.quote_line_items ?? []) {
          if (item.is_optional) init[item.id] = item.is_included;
        }
        setItemSelections(init);
        if (q.created_by_name && q.client_name) {
          setComments([{ id: '0', author: q.created_by_name,
            text: `${q.client_name} — happy to answer any questions on this proposal. Just reply below or reach out directly.`,
            ts: 'Sent with proposal', fromClient: false }]);
        }
        // Expand first SOW section by default
        const sow = parseSow(q.notes ?? '');
        if (sow.length > 0) setExpandedSow({ [sow[0].heading]: true });
        setPageStatus('pending');
      } catch { setPageStatus('error'); }
    }
    load();
  }, [params.id]);

  useEffect(() => { commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [comments]);

  useEffect(() => {
    if (searchParams.get('print') === '1' && pageStatus === 'pending') {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [searchParams, pageStatus]);

  /* ── Computed ────────────────────────────────────────────────────────────────── */
  const items       = quote?.quote_line_items ?? [];
  const isPackage   = quote?.package_mode === true;
  const tiers       = Array.from(new Set(items.filter(i => i.package_tier).map(i => i.package_tier!)));
  const hasTiers    = tiers.length > 0;
  const optional    = items.filter(i => i.is_optional);
  const required    = items.filter(i => !i.is_optional);
  const nonRecurring = required.filter(i => !i.is_recurring);
  const recurring    = required.filter(i => i.is_recurring);
  const setupTotal  = nonRecurring.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const mrrTotal    = recurring.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const discPct     = quote?.discount_percent ?? 0;
  const taxRate     = quote?.tax_rate ?? 0;
  const depPct      = quote?.deposit_percent ?? 50;
  const discSetup   = setupTotal * (1 - discPct / 100);
  const tax         = (discSetup + mrrTotal) * (taxRate / 100);
  const deposit     = discSetup * (depPct / 100);
  const canApprove  = !isPackage || !hasTiers || !!selectedPkg;
  const sowSections = parseSow(quote?.notes ?? '');
  const hasSow      = sowSections.length > 0;

  /* ── Actions ──────────────────────────────────────────────────────────────────── */
  async function handleApprove() {
    if (!quote || !canApprove) return;
    setSubmitting(true);
    try {
      const sels = Object.entries(itemSelections).map(([id, is_included]) => ({ id, is_included }));
      const r = await fetch(`/api/quotes/${params.id}/public`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', selected_option: selectedPkg, item_selections: sels }),
      });
      if (r.ok) setPageStatus('approved');
    } finally { setSubmitting(false); }
  }

  async function handleDecline() {
    if (!quote) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/quotes/${params.id}/public`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', decline_note: declineNote }),
      });
      if (r.ok) setPageStatus('declined');
    } finally { setSubmitting(false); }
  }

  function submitComment() {
    if (!commentText.trim() || !quote) return;
    setSubmittingComment(true);
    setTimeout(() => {
      setComments(prev => [...prev, { id: Date.now().toString(), author: quote.client_name ?? 'Client',
        text: commentText.trim(), ts: nowStr(), fromClient: true }]);
      setCommentText(''); setSubmittingComment(false);
    }, 400);
  }

  function copyEmail() {
    if (!quote) return;
    const url = typeof window !== 'undefined' ? window.location.href : '';
    navigator.clipboard.writeText(buildEmail(quote, url)).then(() => {
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2500);
    });
  }

  /* ── Loading ──────────────────────────────────────────────────────────────────── */
  if (pageStatus === 'loading') return (
    <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS }}>
      <div style={{ textAlign: 'center' }}>
        <Loader2 size={32} color={BLUE} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading proposal…</p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );

  if (pageStatus === 'error' || !quote) return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: SANS }}>
      <div style={{ maxWidth: 400, textAlign: 'center' }}>
        <XCircle size={40} color={RED} style={{ margin: '0 auto 16px' }} />
        <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Proposal Not Found</h1>
        <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>This link may have expired or the proposal may no longer be active. Contact your GateGuard representative for a new link.</p>
      </div>
    </div>
  );

  const preparedBy = quote.created_by_name ?? 'GateGuard';
  const clientName = quote.client_name ?? 'there';
  const propName   = quote.property_name ?? 'Your Property';
  const expiryStr  = expiry(quote);

  /* ── Declined ────────────────────────────────────────────────────────────────── */
  if (pageStatus === 'declined') return (
    <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: SANS }}>
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <XCircle size={36} color={RED} />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: '0 0 8px' }}>Got it — thank you for the feedback.</h1>
        <p style={{ color: MUTED, marginBottom: 24, lineHeight: 1.65, fontSize: 13 }}>{preparedBy} will follow up shortly. If timing or scope changes, the door is always open.</p>
      </div>
    </div>
  );

  /* ── Approved ────────────────────────────────────────────────────────────────── */
  if (pageStatus === 'approved') {
    const chosenTier = selectedPkg ?? quote.selected_package;
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: SANS }}>
        <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #D1FAE5, #A7F3D0)', border: '2px solid #6EE7B7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 8px 32px rgba(16,185,129,0.2)' }}>
            <CheckCircle2 size={44} color={GREEN} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: NAVY, margin: '0 0 8px', letterSpacing: '-1px' }}>Proposal Approved!</h1>
          {chosenTier && (
            <div style={{ display: 'inline-block', background: NAVY, color: WHITE, borderRadius: 20, padding: '4px 18px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 14 }}>
              {chosenTier.toUpperCase()} PACKAGE SELECTED
            </div>
          )}
          <p style={{ color: MUTED, marginBottom: 32, lineHeight: 1.7, fontSize: 14 }}>
            Thank you, {clientName}. The GateGuard team will be in touch within 1 business day to kick off your onboarding.
          </p>
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28, textAlign: 'left' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: TEXT, marginBottom: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>What Happens Next</p>
            {[
              {
                label: 'Service Agreement',
                detail: 'GateGuard sends your service agreement for e-signature.',
                icon: '📄', color: BLUE,
              },
              {
                label: 'Deposit Invoice',
                detail: `50% of setup fee + 50% of first month's access plan due at signing. If you elect the MRR ramp-up model, last month is also collected in the deposit.`,
                icon: '💳', color: AMBER,
              },
              {
                label: 'Install Scheduled',
                detail: 'Site visit booked with your GateGuard installation tech once deposit clears.',
                icon: '📅', color: '#8B5CF6',
              },
              {
                label: 'Final Invoice',
                detail: 'Remaining 50% of the setup fee is invoiced upon install completion.',
                icon: '✅', color: GREEN,
              },
              {
                label: 'Launch',
                detail: 'Go-live is scheduled after the full setup fee is paid. Your Day 1 Launch Event kicks off resident onboarding.',
                icon: '🚀', color: GREEN,
              },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, marginBottom: i < 4 ? 18 : 0, position: 'relative' }}>
                {i < 4 && <div style={{ position: 'absolute', left: 17, top: 38, width: 2, height: 'calc(100% + 4px)', background: BORDER }} />}
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}18`, border: `1.5px solid ${item.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, position: 'relative', zIndex: 1 }}>{item.icon}</div>
                <div style={{ flex: 1, paddingTop: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: '0 0 3px' }}>{item.label}</p>
                  <p style={{ fontSize: 12, color: MUTED, margin: 0, lineHeight: 1.65 }}>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     MAIN PROPOSAL
  ═══════════════════════════════════════════════════════════════════════════ */
  const TIER_META: Record<string, { name: string; color: string; desc: string }> = {
    basic:    { name: 'Basic',    color: '#64748B', desc: 'Core essentials' },
    standard: { name: 'Standard', color: BLUE,      desc: 'Most popular' },
    premium:  { name: 'Premium',  color: '#8B5CF6', desc: 'Complete solution' },
  };

  return (
    <div style={{ fontFamily: SANS, background: LIGHT, minHeight: '100vh', color: TEXT }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-break { page-break-before: always; }
        }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── EMAIL TEMPLATE PANEL (no-print) ────────────────────────────────────── */}
      {showEmail && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowEmail(false); }}>
          <div style={{ background: WHITE, borderRadius: 20, width: '100%', maxWidth: 660, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'fadeIn 0.2s ease' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: TEXT, margin: 0 }}>Email Template</p>
                <p style={{ fontSize: 12, color: MUTED, margin: '2px 0 0' }}>Copy and paste to send this proposal to the client</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyEmail} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: emailCopied ? GREEN : BLUE, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}>
                  {emailCopied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy All</>}
                </button>
                <button onClick={() => setShowEmail(false)} style={{ width: 36, height: 36, borderRadius: 8, background: LIGHT, border: `1px solid ${BORDER}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} color={MUTED} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <pre style={{ fontFamily: SANS, fontSize: 13, color: TEXT, lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {buildEmail(quote, typeof window !== 'undefined' ? window.location.href : '')}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── COVER PAGE ──────────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY2} 0%, ${NAVY} 60%, #162040 100%)`, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 32px', position: 'relative', overflow: 'hidden' }}>
        {/* Background grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(107,126,255,0.08) 1px, transparent 0)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
        {/* Glow */}
        <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%, -50%)', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(107,126,255,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Logo mark */}
          <div style={{ margin: '0 auto 36px', width: 80, height: 80, background: 'linear-gradient(135deg, rgba(107,126,255,0.2), rgba(107,126,255,0.08))', border: '1px solid rgba(107,126,255,0.4)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)' }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: BLUE, fontFamily: MONO, letterSpacing: '-1px' }}>GG</span>
          </div>

          <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(160,180,255,0.6)', letterSpacing: '0.22em', marginBottom: 14, textTransform: 'uppercase' }}>
            Access Control Proposal &nbsp;·&nbsp; Prepared For
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, color: WHITE, margin: '0 0 12px', letterSpacing: '-2px', lineHeight: 1.0 }}>
            {propName}
          </h1>
          {quote.property_address && (
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', margin: '0 0 16px' }}>{quote.property_address}</p>
          )}

          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 560, margin: '0 auto 20px', lineHeight: 1.75, fontStyle: 'italic' }}>
            Moving away from &ldquo;run-to-fail&rdquo; maintenance to a unified, automated, and predictable access control model. Parts, labor, and peace of mind included.
          </p>

          {/* Quote badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(107,126,255,0.12)', border: '1px solid rgba(107,126,255,0.3)', borderRadius: 8, padding: '8px 20px', fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 48 }}>
            <span>{quote.quote_number}</span>
            {quote.units && <><span style={{ color: 'rgba(107,126,255,0.4)' }}>·</span><span>{quote.units} UNITS</span></>}
            {expiryStr && <><span style={{ color: 'rgba(107,126,255,0.4)' }}>·</span><span>VALID THRU {expiryStr.toUpperCase()}</span></>}
          </div>

          {/* Investment callouts — matches Qwilr: Setup | Monthly | Due Today */}
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {setupTotal > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '18px 24px', textAlign: 'center', minWidth: 160 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 6 }}>ONE-TIME SETUP</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: '-1px' }}>{fmt(discSetup)}</div>
              </div>
            )}
            {mrrTotal > 0 && (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 14, padding: '18px 24px', textAlign: 'center', minWidth: 160 }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(16,185,129,0.7)', letterSpacing: '0.1em', marginBottom: 6 }}>MONTHLY PLAN</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#6EE7B7', letterSpacing: '-1px' }}>{fmt(mrrTotal)}<span style={{ fontSize: 14, fontWeight: 600 }}>/mo</span></div>
              </div>
            )}
            <div style={{ background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.35)', borderRadius: 14, padding: '18px 24px', textAlign: 'center', minWidth: 160 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.1em', marginBottom: 6 }}>DEPOSIT AT SIGNING</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: '-1px' }}>{fmt(discSetup * 0.5 + mrrTotal * 0.5)}</div>
              <div style={{ fontSize: 9, color: 'rgba(107,126,255,0.5)', marginTop: 4, fontFamily: MONO }}>50% setup + 50% first month</div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
          <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em' }}>
            PREPARED BY {(quote.org_name ?? preparedBy).toUpperCase()}
          </span>
          <button className="no-print" onClick={() => setShowEmail(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.3)', borderRadius: 6, color: BLUE, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.08em' }}>
            <Mail size={12} /> EMAIL TEMPLATE
          </button>
        </div>
      </div>

      {/* ── COVER LETTER ───────────────────────────────────────────────────────── */}
      {quote.cover_message && (
        <div style={{ background: WHITE }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '72px 32px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.07)', border: '1px solid rgba(107,126,255,0.2)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.16em', marginBottom: 20 }}>
              {quote.org_name ?? 'GATEGUARD, LLC'}
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, margin: '0 0 28px', letterSpacing: '-1px', lineHeight: 1.15 }}>
              {clientName !== 'there' ? `${clientName}, thanks for the opportunity.` : 'Thanks for the opportunity.'}
            </h2>
            {quote.cover_message.split('\n\n').map((para, i) => (
              <p key={i} style={{ fontSize: 15, color: '#374151', lineHeight: 1.85, marginBottom: 18 }}>{para}</p>
            ))}
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: `1px solid ${BORDER}` }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: TEXT, margin: '0 0 4px' }}>{preparedBy}</p>
              {quote.org_name && <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>{quote.org_name}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── PACKAGES (if applicable) ─────────────────────────────────────────── */}
      {isPackage && hasTiers && (
        <div style={{ background: NAVY }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '64px 24px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.25)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 16 }}>PACKAGES</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: WHITE, margin: '0 0 8px', letterSpacing: '-1px' }}>Choose Your Package</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 36 }}>Select the option that fits your goals — each can be activated immediately.</p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(tiers.length, 3)}, 1fr)`, gap: 16 }}>
              {tiers.map(tier => {
                const tierItems = items.filter(i => i.package_tier === tier);
                const tierTotal = tierItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
                const meta = TIER_META[tier] ?? { name: tier, color: BLUE, desc: '' };
                const isSelected = selectedPkg === tier;
                return (
                  <div key={tier} onClick={() => setSelectedPkg(isSelected ? null : tier)}
                    style={{ background: isSelected ? 'rgba(107,126,255,0.18)' : 'rgba(255,255,255,0.05)', border: `2px solid ${isSelected ? BLUE : 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: 24, cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: -10, right: 16, background: BLUE, borderRadius: 20, padding: '3px 12px', fontSize: 10, fontWeight: 700, color: WHITE, letterSpacing: '0.08em' }}>SELECTED</div>
                    )}
                    <div style={{ fontFamily: MONO, fontSize: 9, color: isSelected ? BLUE : 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 8 }}>{meta.name.toUpperCase()}</div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: WHITE, letterSpacing: '-1.5px', lineHeight: 1, marginBottom: 4 }}>{fmt(tierTotal)}</div>
                    {meta.desc && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>{meta.desc}</div>}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                      {tierItems.map(item => (
                        <div key={item.id} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: isSelected ? 'rgba(107,126,255,0.3)' : 'rgba(255,255,255,0.08)', border: `1px solid ${isSelected ? BLUE : 'rgba(255,255,255,0.15)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <Check size={9} color={WHITE} strokeWidth={3} />
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.45 }}>{item.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── INVESTMENT SUMMARY ────────────────────────────────────────────────── */}
      {(!isPackage || !hasTiers) && (
        <div style={{ background: WHITE }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '72px 32px' }}>

            {/* Section header */}
            <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.07)', border: '1px solid rgba(107,126,255,0.2)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 16 }}>YOUR INVESTMENT</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, margin: '0 0 8px', letterSpacing: '-1px' }}>{quote.title ?? `GateGuard for ${propName}`}</h2>
            <p style={{ fontSize: 15, color: MUTED, marginBottom: 40, lineHeight: 1.7 }}>
              A full-stack access control solution — one provider, one agreement, one monthly line item.
            </p>

            {/* Setup fee line items — each entry point */}
            {nonRecurring.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={15} color={BLUE} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0, letterSpacing: '0.03em' }}>Entry Point Setup</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>One-time installation and commissioning per access point</p>
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: TEXT, margin: 0 }}>{fmt(nonRecurring.reduce((s, i) => s + i.qty * i.unit_price, 0))}</p>
                    <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>one-time</p>
                  </div>
                </div>
                <div style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  {nonRecurring.map((item, idx) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px', borderBottom: idx < nonRecurring.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.description.toLowerCase().includes('non-working') || item.description.toLowerCase().includes('not working') ? AMBER : GREEN, flexShrink: 0 }} />
                      <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>{item.description}</p>
                      {item.notes && <p style={{ fontSize: 11, color: MUTED, margin: 0, marginRight: 8 }}>{item.notes}</p>}
                      <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: 0, flexShrink: 0 }}>{fmt(item.qty * item.unit_price)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Monthly recurring */}
            {recurring.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={15} color={GREEN} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>Monthly Access Plan</p>
                    <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>60-month agreement · MRR ramps over Year 1 · Full run-rate by Month 12</p>
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 18, fontWeight: 800, color: GREEN, margin: 0 }}>{fmt(mrrTotal)}<span style={{ fontSize: 12, fontWeight: 600, color: MUTED }}>/mo</span></p>
                    <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>at full run-rate</p>
                  </div>
                </div>
                <div style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  {recurring.map((item, idx) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '13px 18px', borderBottom: idx < recurring.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, flexShrink: 0 }} />
                      <p style={{ flex: 1, fontSize: 14, fontWeight: 600, color: TEXT, margin: 0 }}>{item.description}</p>
                      {item.notes && <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>{item.notes}</p>}
                      <p style={{ fontSize: 14, fontWeight: 700, color: GREEN, margin: 0, flexShrink: 0 }}>{fmt(item.qty * item.unit_price)}<span style={{ fontSize: 11, fontWeight: 500, color: MUTED }}>/mo</span></p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional add-ons */}
            {optional.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: AMBER, letterSpacing: '0.1em', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '3px 8px' }}>OPTIONAL</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>Add-On Services</p>
                  <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>— select what fits your needs</p>
                </div>
                <div style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                  {optional.map((item, idx) => {
                    const included = itemSelections[item.id] ?? item.is_included;
                    return (
                      <div key={item.id} onClick={() => setItemSelections(prev => ({ ...prev, [item.id]: !included }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderBottom: idx < optional.length - 1 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', background: included ? 'rgba(107,126,255,0.03)' : 'transparent', transition: 'background 0.15s' }}>
                        <div style={{ width: 22, height: 22, borderRadius: 7, border: `2px solid ${included ? BLUE : BORDER}`, background: included ? BLUE : WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                          {included && <Check size={12} color={WHITE} strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: TEXT, margin: '0 0 1px' }}>{item.description}</p>
                          {item.notes && <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>{item.notes}</p>}
                        </div>
                        <div style={{ textAlign: 'right', opacity: included ? 1 : 0.45, transition: 'opacity 0.15s' }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: item.is_recurring ? GREEN : TEXT, margin: 0 }}>{fmt(item.unit_price)}{item.is_recurring ? '/mo' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Totals summary bar — matches Qwilr layout: Setup | Monthly | Due Today */}
            <div style={{ background: `linear-gradient(135deg, ${NAVY} 0%, #1a2f5e 100%)`, borderRadius: 16, padding: '28px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 24, marginBottom: discPct > 0 || taxRate > 0 ? 20 : 0 }}>
                {setupTotal > 0 && (
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 6 }}>SETUP FEES</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: '-1px' }}>{fmt(discSetup)}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>one-time, due at signing</div>
                  </div>
                )}
                {mrrTotal > 0 && (
                  <div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(16,185,129,0.6)', letterSpacing: '0.1em', marginBottom: 6 }}>MONTHLY RECURRING</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#6EE7B7', letterSpacing: '-1px' }}>{fmt(mrrTotal)}<span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(110,231,183,0.7)' }}>/mo</span></div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>60-month term · full run-rate by Month 12</div>
                  </div>
                )}
                <div style={{ background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.3)', borderRadius: 12, padding: '18px 20px' }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.1em', marginBottom: 6 }}>DEPOSIT AT SIGNING</div>
                  <div style={{ fontSize: 32, fontWeight: 900, color: WHITE, letterSpacing: '-1.5px' }}>{fmt(discSetup * 0.5 + mrrTotal * 0.5)}</div>
                  <div style={{ fontSize: 10, color: 'rgba(107,126,255,0.6)', marginTop: 3 }}>50% setup + 50% first month</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>balance due after install</div>
                </div>
              </div>
              {(discPct > 0 || taxRate > 0) && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, display: 'flex', gap: 24 }}>
                  {discPct > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Discount applied: <strong style={{ color: '#6EE7B7' }}>−{fmt(setupTotal * discPct / 100)}</strong> ({discPct}%)</div>}
                  {taxRate > 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Tax: {fmt(tax)} ({taxRate}%)</div>}
                </div>
              )}
            </div>

            {/* Net-to-property note */}
            {mrrTotal > 0 && quote.units && (
              <div style={{ marginTop: 16, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: GREEN, marginTop: 6, flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: '#065F46', margin: 0, lineHeight: 1.65 }}>
                  <strong>Resident billing model:</strong> GateGuard costs your property {fmt(mrrTotal)}/mo. Residents pay a one-time $150 move-in access fee directly to your property — netting approximately <strong>{fmt(quote.units * 30)}/year positive cash flow</strong> under the Elevate Model.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SCOPE OF WORK ─────────────────────────────────────────────────────── */}
      {hasSow && (
        <div className="print-break" style={{ background: LIGHT, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '72px 32px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.07)', border: '1px solid rgba(107,126,255,0.2)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 16 }}>SCOPE OF WORK</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, margin: '0 0 8px', letterSpacing: '-1px' }}>Full Scope &amp; Conditions</h2>
            <p style={{ fontSize: 15, color: MUTED, marginBottom: 40, lineHeight: 1.7 }}>
              The following scope has been prepared specifically for {propName}. Review each section by clicking to expand.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sowSections.map((section, i) => {
                const key   = section.heading || `section-${i}`;
                const open  = expandedSow[key] ?? false;
                // Skip rollout schedule from SOW render — we show it separately below
                if (section.heading === 'ROLLOUT SCHEDULE') return null;
                return (
                  <div key={key} style={{ background: WHITE, border: `1px solid ${open ? 'rgba(107,126,255,0.25)' : BORDER}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <button onClick={() => setExpandedSow(prev => ({ ...prev, [key]: !open }))}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: open ? 'rgba(107,126,255,0.1)' : LIGHT, border: `1px solid ${open ? 'rgba(107,126,255,0.25)' : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: open ? BLUE : MUTED, fontFamily: MONO }}>{String(i + 1).padStart(2, '0')}</span>
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: open ? NAVY : TEXT, letterSpacing: '0.04em' }}>{section.heading}</span>
                      {open ? <ChevronUp size={16} color={MUTED} /> : <ChevronDown size={16} color={MUTED} />}
                    </button>
                    {open && (
                      <div style={{ padding: '0 20px 20px 62px', animation: 'fadeIn 0.15s ease' }}>
                        {section.body.split('\n').filter(l => l.trim()).map((line, li) => (
                          <p key={li} style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, margin: li === 0 ? '0 0 10px' : '0 0 10px', borderLeft: line.startsWith('Day ') || line.startsWith('Barrier') ? `3px solid ${BLUE}` : 'none', paddingLeft: line.startsWith('Day ') || line.startsWith('Barrier') ? 12 : 0 }}>{line}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── REQUIREMENTS ──────────────────────────────────────────────────────── */}
      {quote.terms_text && parseSow(quote.terms_text).length > 0 && (
        <div style={{ background: LIGHT, borderTop: `1px solid ${BORDER}` }}>
          <div style={{ maxWidth: 780, margin: '0 auto', padding: '72px 32px' }}>
            <div style={{ display: 'inline-block', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: AMBER, letterSpacing: '0.14em', marginBottom: 16 }}>SITE REQUIREMENTS</div>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, margin: '0 0 8px', letterSpacing: '-1px' }}>Requirements &amp; Conditions</h2>
            <p style={{ fontSize: 15, color: MUTED, marginBottom: 40, lineHeight: 1.7 }}>
              The following requirements must be met prior to the installation date. Please review and confirm with your GateGuard project manager.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {parseSow(quote.terms_text).map((section, i) => (
                <div key={i} style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: '24px 28px' }}>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: AMBER, fontFamily: MONO }}>{String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 style={{ fontSize: 12, fontWeight: 800, color: TEXT, margin: 0, letterSpacing: '0.1em', textTransform: 'uppercase', paddingTop: 6 }}>{section.heading}</h3>
                  </div>
                  <div style={{ paddingLeft: 42 }}>
                    {section.body.split('\n').filter(l => l.trim()).map((line, li) => (
                      <p key={li} style={{ fontSize: 14, color: '#374151', lineHeight: 1.8, margin: '0 0 8px' }}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ROLLOUT SCHEDULE ──────────────────────────────────────────────────── */}
      <div style={{ background: NAVY }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '72px 32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.25)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 16 }}>
            <Calendar size={10} /> ROLLOUT SCHEDULE
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: WHITE, margin: '0 0 8px', letterSpacing: '-1px' }}>Go-Live Timeline</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 48, lineHeight: 1.7, maxWidth: 560 }}>
            GateGuard follows a proven 15-day launch sequence designed to orient residents, minimize disruption, and maximize adoption before enforcing full access control.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {[
              {
                day: 'Day 1',
                title: 'Launch Event',
                desc: 'Gate hours 10:00 AM – 6:00 PM, Monday through Saturday. Barrier arms remain inactive — community orientation and resident onboarding phase.',
                color: BLUE,
                icon: '🚀',
              },
              {
                day: 'Day 8',
                title: 'Expanded Hours',
                desc: 'Gate hours extend to 8:00 AM – 8:00 PM. Barrier arms remain inactive. Resident adoption continues to build.',
                color: '#8B5CF6',
                icon: '📡',
              },
              {
                day: 'Day 15',
                title: 'Full 24/7 Operation',
                desc: 'Gates operate around the clock. During office hours, center lane may remain open for prospective residents and visitors.',
                color: GREEN,
                icon: '✅',
              },
            ].map((phase, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 16, padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: phase.color, borderRadius: '16px 16px 0 0' }} />
                <div style={{ fontSize: 28, marginBottom: 12 }}>{phase.icon}</div>
                <div style={{ fontFamily: MONO, fontSize: 9, color: phase.color, letterSpacing: '0.1em', marginBottom: 6 }}>{phase.day.toUpperCase()}</div>
                <p style={{ fontSize: 16, fontWeight: 700, color: WHITE, margin: '0 0 10px' }}>{phase.title}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, margin: 0 }}>{phase.desc}</p>
              </div>
            ))}
          </div>

          {/* Barrier arms note */}
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>🚧</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#FCD34D', margin: '0 0 6px' }}>Barrier Arms</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', margin: 0, lineHeight: 1.7 }}>
                Physical barrier arms are typically activated <strong style={{ color: WHITE }}>30–60 days after Day 1</strong>, based on community traffic patterns and observed gate usage. Exact timing is determined in coordination with property management to ensure a smooth transition.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHY GATEGUARD ─────────────────────────────────────────────────────── */}
      <div style={{ background: WHITE }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '72px 32px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.07)', border: '1px solid rgba(107,126,255,0.2)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 16 }}>THE PLATFORM</div>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: NAVY, margin: '0 0 40px', letterSpacing: '-1px' }}>One Platform. Total Control.</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { icon: '📱', title: 'Resident Mobile App', desc: 'Residents manage access, visitors, and deliveries from one app. No fobs, no friction.' },
              { icon: '🎯', title: 'Entry Code + Key Fob Access', desc: 'Flexible credential options for every resident need — app, code, or fob.' },
              { icon: '📦', title: 'Delivery Management', desc: 'Package carriers get time-limited access codes. No more missed deliveries.' },
              { icon: '🔧', title: 'Maintenance Included', desc: 'GateGuard Access & Maintenance Plan covers ongoing service and support.' },
              { icon: '💰', title: 'Positive Cash Flow Model', desc: 'Resident billing offsets your monthly cost — net positive by Year 1.' },
              { icon: '🔄', title: 'Subscription Consolidation', desc: 'Replaces DoorKing, GateWise, SARA Plus, and other legacy monitoring fees.' },
            ].map((item, i) => (
              <div key={i} style={{ background: LIGHT, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 22 }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>{item.icon}</div>
                <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: '0 0 6px' }}>{item.title}</p>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.65, margin: 0 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── COMMENTS ─────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ background: LIGHT, borderTop: `1px solid ${BORDER}` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '64px 32px' }}>
          <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.07)', border: '1px solid rgba(107,126,255,0.2)', borderRadius: 6, padding: '4px 12px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 16 }}>CONVERSATION</div>
          <h2 style={{ fontSize: 30, fontWeight: 900, color: NAVY, margin: '0 0 6px', letterSpacing: '-0.8px' }}>Questions?</h2>
          <p style={{ fontSize: 14, color: MUTED, marginBottom: 32, lineHeight: 1.6 }}>Leave a message — the GateGuard team will respond within 1 business day.</p>

          <div style={{ marginBottom: 20 }}>
            {comments.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 12, marginBottom: 16, flexDirection: c.fromClient ? 'row-reverse' : 'row' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.fromClient ? CREAM2 : NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: c.fromClient ? NAVY : WHITE, flexShrink: 0 }}>
                  {c.author.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </div>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, justifyContent: c.fromClient ? 'flex-end' : 'flex-start' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{c.author}</span>
                    <span style={{ fontSize: 10, color: MUTED }}>{c.ts}</span>
                  </div>
                  <div style={{ background: c.fromClient ? '#EFF1FF' : WHITE, border: `1px solid ${c.fromClient ? 'rgba(107,126,255,0.2)' : BORDER}`, borderRadius: c.fromClient ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '12px 16px', fontSize: 14, color: TEXT, lineHeight: 1.65 }}>
                    {c.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={commentEndRef} />
          </div>

          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
              placeholder="Ask a question or leave a note…" rows={3}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', fontSize: 14, color: TEXT, fontFamily: SANS, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: 11, color: MUTED }}>⌘↵ to send</span>
              <button onClick={submitComment} disabled={!commentText.trim() || submittingComment}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: commentText.trim() ? BLUE : LIGHT, color: commentText.trim() ? WHITE : MUTED, border: `1px solid ${commentText.trim() ? BLUE : BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: commentText.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
                <Send size={13} />
                {submittingComment ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── APPROVAL CTA ────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ background: `linear-gradient(160deg, ${NAVY2} 0%, ${NAVY} 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(107,126,255,0.06) 1px, transparent 0)', backgroundSize: '24px 24px', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.25)', borderRadius: 20, padding: '5px 16px', fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.14em', marginBottom: 24 }}>
            <Check size={10} /> READY TO PROCEED
          </div>
          <h2 style={{ fontSize: 44, fontWeight: 900, color: WHITE, margin: '0 0 12px', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Let&apos;s get {propName} live.
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', maxWidth: 460, margin: '0 auto 40px', lineHeight: 1.75 }}>
            Approve below and we&apos;ll send your service agreement within 1 business day. Deposit invoice follows — 50% of setup + 50% of first month. Install is scheduled once deposit clears. Launch after full setup is paid.
          </p>

          {/* Package chips repeat */}
          {isPackage && hasTiers && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
              {tiers.map(tier => {
                const tierTotal  = items.filter(i => i.package_tier === tier).reduce((s, i) => s + i.qty * i.unit_price, 0);
                const meta       = TIER_META[tier] ?? { name: tier, color: BLUE, desc: '' };
                const isSelected = selectedPkg === tier;
                return (
                  <div key={tier} onClick={() => setSelectedPkg(tier)}
                    style={{ background: isSelected ? BLUE : 'rgba(255,255,255,0.07)', border: `2px solid ${isSelected ? BLUE : 'rgba(255,255,255,0.12)'}`, borderRadius: 12, padding: '14px 22px', cursor: 'pointer', minWidth: 140, textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>{meta.name.toUpperCase()}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: WHITE }}>{fmt(tierTotal)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {!canApprove && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>Select a package above to continue</p>
          )}

          {/* Acceptance statement */}
          <div style={{ maxWidth: 480, margin: '0 auto 28px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 14, padding: '20px 24px', textAlign: 'left' }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, margin: '0 0 18px' }}>
              By approving this proposal, <strong style={{ color: WHITE }}>{clientName !== 'there' ? clientName : 'the undersigned'}</strong> acknowledges receipt of this proposal and agrees to the requirements and conditions outlined above. A formal service agreement will be provided for e-signature prior to installation.
            </p>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 6 }}>ACCEPTED BY</div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 5 }}>
                  <span style={{ fontSize: 13, color: clientName !== 'there' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', fontStyle: clientName !== 'there' ? 'normal' : 'italic' }}>
                    {clientName !== 'there' ? clientName : '________________________'}
                  </span>
                </div>
              </div>
              <div style={{ minWidth: 100 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 6 }}>DATE</div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 5 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div style={{ minWidth: 100 }}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', marginBottom: 6 }}>PROPOSAL #</div>
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: 5 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: MONO }}>{quote.quote_number}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400, margin: '0 auto' }}>
            <button onClick={handleApprove} disabled={!canApprove || submitting}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '18px 28px', background: canApprove ? BLUE : 'rgba(107,126,255,0.2)', color: canApprove ? WHITE : 'rgba(255,255,255,0.3)', border: `2px solid ${canApprove ? BLUE : 'rgba(107,126,255,0.15)'}`, borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: canApprove && !submitting ? 'pointer' : 'default', boxShadow: canApprove ? '0 8px 32px rgba(107,126,255,0.4)' : 'none', letterSpacing: '0.04em', transition: 'all 0.2s' }}>
              {submitting ? <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : <><CheckCircle2 size={20} /> APPROVE PROPOSAL</>}
            </button>

            {!showDeclineForm ? (
              <button onClick={() => setShowDeclineForm(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', background: 'transparent', color: 'rgba(255,255,255,0.35)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                <XCircle size={15} /> Not ready yet
              </button>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: 18, textAlign: 'left', animation: 'fadeIn 0.15s ease' }}>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 12, fontWeight: 600 }}>What&apos;s holding you back? We want to help.</p>
                <textarea value={declineNote} onChange={e => setDeclineNote(e.target.value)}
                  placeholder="Timing, budget, scope concerns — let us know…" rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: WHITE, fontFamily: SANS, resize: 'none', outline: 'none', marginBottom: 12, lineHeight: 1.6, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleDecline} disabled={submitting}
                    style={{ flex: 1, padding: '11px', background: RED, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {submitting ? 'Sending…' : 'Send Feedback & Decline'}
                  </button>
                  <button onClick={() => setShowDeclineForm(false)}
                    style={{ padding: '11px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 28, fontFamily: MONO, letterSpacing: '0.08em' }}>
            {quote.quote_number}{expiryStr ? ` · VALID UNTIL ${expiryStr.toUpperCase()}` : ''}
          </p>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <div style={{ background: '#060D1A', padding: '28px 32px' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{quote.org_name ?? 'Gate Guard, LLC'}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: '3px 0 0', fontFamily: MONO, letterSpacing: '0.06em' }}>{quote.quote_number} · {preparedBy}</p>
          </div>
          <button className="no-print" onClick={() => setShowEmail(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'rgba(107,126,255,0.12)', border: '1px solid rgba(107,126,255,0.25)', borderRadius: 8, color: BLUE, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: MONO, letterSpacing: '0.08em' }}>
            <Mail size={13} /> Get Email Template
          </button>
        </div>
      </div>
    </div>
  );
}
