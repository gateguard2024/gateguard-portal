'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, XCircle, Send, Check, X, Loader2 } from 'lucide-react';

/* ─── Design tokens ──────────────────────────────────────────────────────────── */
const NAVY   = '#0E1E3D';
const CREAM  = '#F5F1E8';
const CREAM2 = '#EDE9DF';
const BLUE   = '#6B7EFF';
const GREEN  = '#22C55E';
const RED    = '#EF4444';
const TEXT   = '#0F172A';
const MUTED  = '#64748B';
const BORDER = '#E2E8F0';
const WHITE  = '#FFFFFF';
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
  property_address: string | null;
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
  try {
    return new Date(raw).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return raw; }
}

/* ─── Main component ─────────────────────────────────────────────────────────── */
export default function QuoteApprovePage({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [quote, setQuote]           = useState<Quote | null>(null);

  // Interaction state
  const [selectedPkg, setSelectedPkg]       = useState<string | null>(null);
  const [itemSelections, setItemSelections] = useState<Record<string, boolean>>({});
  const [commentText, setCommentText]       = useState('');
  const [comments, setComments]             = useState<Comment[]>([]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showDeclineForm, setShowDeclineForm]     = useState(false);
  const [declineNote, setDeclineNote]             = useState('');
  const [submitting, setSubmitting]               = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);

  /* ── Fetch quote data ──────────────────────────────────────────────────────── */
  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/quotes/${params.id}/public`);
        if (!r.ok) { setPageStatus('error'); return; }
        const { quote: q } = await r.json();
        setQuote(q);

        // If already accepted/declined, show that screen
        if (q.status === 'accepted') { setPageStatus('approved'); return; }
        if (q.status === 'declined') { setPageStatus('declined'); return; }

        // Pre-select recommended package or previously selected
        if (q.package_mode && q.selected_package) setSelectedPkg(q.selected_package);

        // Initialize optional item checkboxes
        const init: Record<string, boolean> = {};
        for (const item of q.quote_line_items ?? []) {
          if (item.is_optional) init[item.id] = item.is_included;
        }
        setItemSelections(init);

        // Seed a greeting comment from the quote preparer
        if (q.created_by_name && q.client_name) {
          setComments([{
            id: '0',
            author: q.created_by_name,
            text: `${q.client_name} — happy to answer any questions on this proposal. Just reply below or reach out directly.`,
            ts: 'Sent with proposal',
            fromClient: false,
          }]);
        }

        setPageStatus('pending');
      } catch {
        setPageStatus('error');
      }
    }
    load();
  }, [params.id]);

  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Auto-print when ?print=1 is set (for PDF export)
  useEffect(() => {
    if (searchParams.get('print') === '1' && pageStatus === 'pending') {
      const t = setTimeout(() => window.print(), 500);
      return () => clearTimeout(t);
    }
  }, [searchParams, pageStatus]);

  /* ── Computed values ───────────────────────────────────────────────────────── */
  const items = quote?.quote_line_items ?? [];
  const isPackageMode = quote?.package_mode === true;

  // Package tiers present in the quote
  const tiers = Array.from(new Set(items.filter(i => i.package_tier).map(i => i.package_tier!)));
  const hasTiers = tiers.length > 0;

  // Optional items (client-selectable add-ons)
  const optionalItems = items.filter(i => i.is_optional);
  const requiredItems = items.filter(i => !i.is_optional);

  // Running totals (for package mode, filter by selected tier)
  function calcTotal(pkgTier: string | null = null): number {
    const filtered = pkgTier
      ? items.filter(i => i.package_tier === pkgTier || (!i.package_tier && !i.is_optional))
      : items.filter(i => !i.is_optional || itemSelections[i.id]);
    return filtered.reduce((s, i) => s + i.qty * i.unit_price, 0);
  }

  const displayTotal = isPackageMode && selectedPkg
    ? calcTotal(selectedPkg)
    : calcTotal();

  const taxRate     = quote?.tax_rate ?? 0;
  const discPct     = quote?.discount_percent ?? 0;
  const depPct      = quote?.deposit_percent ?? 50;
  const afterDisc   = displayTotal * (1 - discPct / 100);
  const tax         = afterDisc * (taxRate / 100);
  const grandTotal  = afterDisc + tax;
  const deposit     = grandTotal * (depPct / 100);
  const mrr         = items.filter(i => i.is_recurring).reduce((s, i) => s + i.qty * i.unit_price, 0);

  /* ── Actions ───────────────────────────────────────────────────────────────── */
  async function handleApprove() {
    if (!quote) return;
    if (isPackageMode && hasTiers && !selectedPkg) return;
    setSubmitting(true);
    try {
      const sels = Object.entries(itemSelections).map(([id, is_included]) => ({ id, is_included }));
      const r = await fetch(`/api/quotes/${params.id}/public`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', decline_note: declineNote }),
      });
      if (r.ok) setPageStatus('declined');
    } finally { setSubmitting(false); }
  }

  function submitComment() {
    if (!commentText.trim() || !quote) return;
    setSubmittingComment(true);
    setTimeout(() => {
      setComments(prev => [...prev, {
        id: Date.now().toString(),
        author: quote.client_name ?? 'Client',
        text: commentText.trim(),
        ts: nowStr(),
        fromClient: true,
      }]);
      setCommentText('');
      setSubmittingComment(false);
    }, 400);
  }

  /* ── Loading ────────────────────────────────────────────────────────────────── */
  if (pageStatus === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={32} color={BLUE} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading proposal…</p>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (pageStatus === 'error' || !quote) {
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: SANS }}>
        <div style={{ maxWidth: 400, textAlign: 'center' }}>
          <XCircle size={40} color={RED} style={{ margin: '0 auto 16px' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT, marginBottom: 8 }}>Proposal Not Found</h1>
          <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>This link may have expired or the proposal may no longer be active. Contact your GateGuard representative for a new link.</p>
        </div>
      </div>
    );
  }

  const preparedBy = quote.created_by_name ?? 'GateGuard';
  const clientName = quote.client_name ?? 'there';
  const propName   = quote.property_name ?? 'Your Property';
  const expiryStr  = expiry(quote);

  /* ── Declined screen ─────────────────────────────────────────────────────────── */
  if (pageStatus === 'declined') {
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: SANS }}>
        <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <XCircle size={36} color={RED} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: '0 0 8px' }}>Got it — thank you for the feedback.</h1>
          <p style={{ color: MUTED, marginBottom: 24, lineHeight: 1.65, fontSize: 13 }}>
            {preparedBy} will follow up shortly. If timing or scope changes, the door is always open.
          </p>
        </div>
      </div>
    );
  }

  /* ── Approved screen ─────────────────────────────────────────────────────────── */
  if (pageStatus === 'approved') {
    const chosenTier = selectedPkg ?? quote.selected_package;
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: SANS }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle2 size={40} color={GREEN} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Proposal Approved!</h1>
          {chosenTier && (
            <div style={{ display: 'inline-block', background: NAVY, color: WHITE, borderRadius: 20, padding: '4px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
              {chosenTier.toUpperCase()} PACKAGE SELECTED
            </div>
          )}
          <p style={{ color: MUTED, marginBottom: 28, lineHeight: 1.65, fontSize: 14 }}>
            Thank you, {clientName}. The GateGuard team will be in touch within 1 business day to send your service agreement for signature.
          </p>
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What Happens Next</p>
            {[
              'GateGuard sends your service agreement for e-signature',
              'Setup fee collected at contract signing',
              'Site visit scheduled with your installation technician',
              'Equipment pre-configured and shipped to job site',
              'Go-live day — GateGuard on-site for full commissioning',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EFF1FF', color: BLUE, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</div>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.55 }}>{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════════
     MAIN PROPOSAL PAGE
  ══════════════════════════════════════════════════════════════════════════ */

  // Group required items by section
  const sections = Array.from(new Set(requiredItems.map(i => i.section_name ?? 'Items')));

  // Package tier display names
  const TIER_META: Record<string, { name: string; color: string; desc: string }> = {
    basic:    { name: 'Basic',    color: '#64748B', desc: 'Core essentials' },
    standard: { name: 'Standard', color: BLUE,      desc: 'Most popular' },
    premium:  { name: 'Premium',  color: '#8B5CF6', desc: 'Complete solution' },
  };

  const canApprove = !isPackageMode || !hasTiers || !!selectedPkg;

  return (
    <div style={{ fontFamily: SANS, background: CREAM, minHeight: '100vh', color: TEXT }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      {/* ── COVER PAGE ─────────────────────────────────────────────────────────── */}
      <div style={{ background: NAVY, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 32px', position: 'relative' }}>
        <div style={{ width: 100, height: 100, marginBottom: 32, background: 'linear-gradient(135deg, #1B3A6B 0%, #243E72 100%)', border: '2px solid rgba(107,126,255,0.35)', clipPath: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: BLUE, fontFamily: MONO, letterSpacing: '-1px' }}>GG</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(160,180,255,0.7)', letterSpacing: '0.22em', marginBottom: 16, textTransform: 'uppercase' }}>P R E P A R E D &nbsp; F O R</div>
        <h1 style={{ fontSize: 52, fontWeight: 900, color: WHITE, margin: '0 0 10px', letterSpacing: '-2px', lineHeight: 1.0 }}>{propName}</h1>
        {quote.property_address && (
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>{quote.property_address}</div>
        )}
        <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.12)', border: '1px solid rgba(107,126,255,0.30)', borderRadius: 6, padding: '7px 20px', fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.14em', marginBottom: 40 }}>
          {quote.quote_number}{quote.units ? ` · ${quote.units} UNITS` : ''}
          {isPackageMode ? ' · PACKAGE PROPOSAL' : ' · ACCESS CONTROL PROPOSAL'}
        </div>
        <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center', fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.16em' }}>
          PREPARED BY {(quote.org_name ?? preparedBy).toUpperCase()}
          {expiryStr ? ` · VALID UNTIL ${expiryStr.toUpperCase()}` : ''}
        </div>
      </div>

      {/* ── COVER LETTER (if present) ─────────────────────────────────────────── */}
      {quote.cover_message && (
        <div style={{ background: CREAM }}>
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 32px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.18em', marginBottom: 18, textTransform: 'uppercase' }}>
              {quote.org_name ?? 'Gate Guard, LLC'}
            </div>
            <h2 style={{ fontSize: 36, fontWeight: 800, color: NAVY, margin: '0 0 28px', letterSpacing: '-1px', lineHeight: 1.15 }}>
              {clientName}, thanks for the opportunity.
            </h2>
            {quote.cover_message.split('\n\n').map((para, i) => (
              <p key={i} style={{ fontSize: 15, color: '#374151', lineHeight: 1.8, marginBottom: 18 }}>{para}</p>
            ))}
            <div style={{ fontSize: 22, color: BLUE, margin: '28px 0 18px', letterSpacing: '0.08em' }}>∿∿∿∿∿</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{preparedBy}</div>
            {quote.org_name && <div style={{ fontSize: 13, color: MUTED }}>{quote.org_name}</div>}
          </div>
        </div>
      )}

      {/* ── PACKAGES (if package_mode + tiers) ────────────────────────────────── */}
      {isPackageMode && hasTiers && (
        <div style={{ background: NAVY }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>PACKAGES</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: WHITE, margin: '0 0 8px', letterSpacing: '-0.8px' }}>Choose Your Package</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Select the option that fits your goals — each is available immediately.</p>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiers.length}, 1fr)`, gap: 14 }}>
              {tiers.map(tier => {
                const tierItems = items.filter(i => i.package_tier === tier);
                const tierTotal = tierItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
                const meta = TIER_META[tier] ?? { name: tier, color: BLUE, desc: '' };
                const isSelected = selectedPkg === tier;
                return (
                  <div key={tier} onClick={() => setSelectedPkg(isSelected ? null : tier)}
                    style={{ background: isSelected ? 'rgba(107,126,255,0.15)' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${isSelected ? BLUE : 'rgba(255,255,255,0.1)'}`, borderRadius: 14, padding: 20, cursor: 'pointer', position: 'relative', transition: 'border-color 0.2s, background 0.2s' }}>
                    {isSelected && (
                      <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={12} color={WHITE} strokeWidth={3} />
                      </div>
                    )}
                    <div style={{ fontFamily: MONO, fontSize: 9, color: meta.color, letterSpacing: '0.1em', marginBottom: 4 }}>{meta.name.toUpperCase()}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: '-1px', lineHeight: 1, marginBottom: 4 }}>{fmt(tierTotal)}</div>
                    {meta.desc && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>{meta.desc}</div>}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
                      {tierItems.map(item => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(107,126,255,0.3)', border: `1px solid ${BLUE}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <Check size={8} color={WHITE} strokeWidth={3} />
                          </div>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45 }}>{item.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>Click a package to select it · you can change before approving</p>
          </div>
        </div>
      )}

      {/* ── LINE ITEMS (non-package mode or required items) ─────────────────── */}
      {(!isPackageMode || !hasTiers) && (
        <div style={{ background: WHITE }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>SCOPE OF WORK</div>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: NAVY, margin: '0 0 28px', letterSpacing: '-0.8px' }}>
              {quote.title ?? `Proposal for ${propName}`}
            </h2>

            {sections.map(section => {
              const sectionItems = requiredItems.filter(i => (i.section_name ?? 'Items') === section);
              if (sectionItems.length === 0) return null;
              return (
                <div key={section} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: BLUE, letterSpacing: '0.1em', background: 'rgba(107,126,255,0.08)', border: '1px solid rgba(107,126,255,0.2)', borderRadius: 4, padding: '3px 8px' }}>#</div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{section}</p>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                  <div style={{ background: CREAM, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    {sectionItems.map((item, idx) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: idx < sectionItems.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: '0 0 2px' }}>{item.description}</p>
                          {item.notes && <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>{item.notes}</p>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 12, color: MUTED, margin: '0 0 2px' }}>{item.qty} × {fmt(item.unit_price)}{item.unit !== 'each' ? `/${item.unit}` : ''}</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>{fmt(item.qty * item.unit_price)}{item.is_recurring ? '/mo' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Optional / add-on items */}
            {optionalItems.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.1em', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, padding: '3px 8px' }}>OPT</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Optional Add-Ons</p>
                  <div style={{ flex: 1, height: 1, background: BORDER }} />
                  <span style={{ fontSize: 11, color: MUTED }}>Check to include</span>
                </div>
                <div style={{ background: CREAM, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                  {optionalItems.map((item, idx) => {
                    const included = itemSelections[item.id] ?? item.is_included;
                    return (
                      <div key={item.id} onClick={() => setItemSelections(prev => ({ ...prev, [item.id]: !included }))}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: idx < optionalItems.length - 1 ? `1px solid ${BORDER}` : 'none', cursor: 'pointer', transition: 'background 0.15s', background: included ? 'rgba(107,126,255,0.04)' : 'transparent' }}>
                        <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${included ? BLUE : BORDER}`, background: included ? BLUE : WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, transition: 'all 0.15s' }}>
                          {included && <Check size={11} color={WHITE} strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: TEXT, margin: '0 0 2px' }}>{item.description}</p>
                          {item.notes && <p style={{ fontSize: 11, color: MUTED, margin: 0, lineHeight: 1.5 }}>{item.notes}</p>}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, opacity: included ? 1 : 0.5 }}>
                          <p style={{ fontSize: 12, color: MUTED, margin: '0 0 2px' }}>{item.qty} × {fmt(item.unit_price)}</p>
                          <p style={{ fontSize: 13, fontWeight: 700, color: TEXT, margin: 0 }}>{fmt(item.qty * item.unit_price)}{item.is_recurring ? '/mo' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Running totals */}
            <div style={{ background: NAVY, borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                {[
                  ...(discPct > 0 ? [{ label: `Subtotal`, value: fmt(displayTotal) }, { label: `Discount (${discPct}%)`, value: `−${fmt(displayTotal * discPct / 100)}` }] : []),
                  ...(taxRate > 0 ? [{ label: `Tax (${taxRate}%)`, value: fmt(tax) }] : []),
                  { label: 'Total', value: fmt(grandTotal), large: true },
                  ...(depPct > 0 ? [{ label: `Deposit (${depPct}%)`, value: fmt(deposit), sub: 'Due at signing' }] : []),
                  ...(mrr > 0 ? [{ label: 'Monthly Recurring', value: `${fmt(mrr)}/mo`, green: true }] : []),
                ].map((r, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>{r.label.toUpperCase()}</div>
                    <div style={{ fontSize: (r as {large?: boolean}).large ? 28 : 18, fontWeight: 800, color: (r as {green?: boolean}).green ? '#10B981' : WHITE, letterSpacing: '-1px' }}>{r.value}</div>
                    {(r as {sub?: string}).sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{(r as {sub?: string}).sub}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMENTS ─────────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ background: WHITE }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>CONVERSATION</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: NAVY, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Questions or Comments?</h2>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>Leave a message below — the GateGuard team will respond within 1 business day.</p>

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
                  <div style={{ background: c.fromClient ? '#EFF1FF' : CREAM, border: `1px solid ${c.fromClient ? 'rgba(107,126,255,0.2)' : BORDER}`, borderRadius: c.fromClient ? '14px 14px 4px 14px' : '14px 14px 14px 4px', padding: '12px 16px', fontSize: 13, color: TEXT, lineHeight: 1.65 }}>
                    {c.text}
                  </div>
                </div>
              </div>
            ))}
            <div ref={commentEndRef} />
          </div>

          <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            <textarea value={commentText} onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
              placeholder={`Ask a question or leave a comment…`} rows={3}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', fontSize: 13, color: TEXT, fontFamily: SANS, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${BORDER}`, background: WHITE }}>
              <span style={{ fontSize: 11, color: MUTED }}>⌘↵ to send</span>
              <button onClick={submitComment} disabled={!commentText.trim() || submittingComment}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: commentText.trim() ? BLUE : CREAM2, color: commentText.trim() ? WHITE : MUTED, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: commentText.trim() ? 'pointer' : 'default', transition: 'background 0.15s' }}>
                <Send size={13} />
                {submittingComment ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── APPROVAL CTA ──────────────────────────────────────────────────────────── */}
      <div className="no-print" style={{ background: NAVY }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: WHITE, margin: '0 0 8px', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Ready to Move Forward?
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.7 }}>
            Review the scope above, select your package if applicable, then approve below. The team will be in touch within one business day.
          </p>

          {/* Package chips (repeat in CTA if package mode) */}
          {isPackageMode && hasTiers && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
              {tiers.map(tier => {
                const tierItems  = items.filter(i => i.package_tier === tier);
                const tierTotal  = tierItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
                const meta       = TIER_META[tier] ?? { name: tier, color: BLUE, desc: '' };
                const isSelected = selectedPkg === tier;
                return (
                  <div key={tier} onClick={() => setSelectedPkg(tier)}
                    style={{ background: isSelected ? BLUE : 'rgba(255,255,255,0.07)', border: `1.5px solid ${isSelected ? BLUE : 'rgba(255,255,255,0.15)'}`, borderRadius: 10, padding: '12px 20px', cursor: 'pointer', minWidth: 130, textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: isSelected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>{meta.name.toUpperCase()}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: WHITE, letterSpacing: '-0.5px' }}>{fmt(tierTotal)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {!canApprove && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Select a package above before approving</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380, margin: '0 auto' }}>
            <button onClick={handleApprove} disabled={!canApprove || submitting}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '17px 24px', background: canApprove ? BLUE : 'rgba(107,126,255,0.25)', color: canApprove ? WHITE : 'rgba(255,255,255,0.35)', border: `1.5px solid ${canApprove ? BLUE : 'rgba(107,126,255,0.2)'}`, borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: canApprove && !submitting ? 'pointer' : 'default', boxShadow: canApprove ? '0 4px 20px rgba(107,126,255,0.45)' : 'none', letterSpacing: '0.04em', transition: 'all 0.15s' }}>
              {submitting ? <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : <><CheckCircle2 size={20} /> APPROVE PROPOSAL</>}
            </button>

            {!showDeclineForm ? (
              <button onClick={() => setShowDeclineForm(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <XCircle size={15} /> Decline
              </button>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textAlign: 'left' }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10, fontWeight: 600 }}>Help us understand — what&apos;s holding you back?</p>
                <textarea value={declineNote} onChange={e => setDeclineNote(e.target.value)} placeholder="Timing, budget, scope concerns…" rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: WHITE, fontFamily: SANS, resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleDecline} disabled={submitting}
                    style={{ flex: 1, padding: '10px', background: RED, color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {submitting ? 'Sending…' : 'Send & Decline'}
                  </button>
                  <button onClick={() => setShowDeclineForm(false)}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 24 }}>
            {quote.quote_number}{expiryStr ? ` · Valid until ${expiryStr}` : ''}
          </p>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────────── */}
      <div style={{ background: '#070F1F', padding: '28px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
            {quote.org_name ?? 'Gate Guard, LLC'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
            {quote.quote_number} · Prepared by {preparedBy}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
