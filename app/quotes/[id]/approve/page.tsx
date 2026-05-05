'use client';

import { useState, useRef, useEffect } from 'react';
import { CheckCircle2, XCircle, MessageSquare, Phone, Mail, Send, Check, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'pending' | 'approved' | 'declined';
type Comment = { id: string; author: string; text: string; ts: string; fromClient: boolean };

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY   = '#0E1E3D';
const NAVY2  = '#162952';
const CREAM  = '#F5F1E8';
const CREAM2 = '#EDE9DF';
const BLUE   = '#6B7EFF';
const GREEN  = '#22C55E';
const AMBER  = '#F59E0B';
const RED    = '#EF4444';
const TEXT   = '#0F172A';
const MUTED  = '#64748B';
const BORDER = '#E2E8F0';
const WHITE  = '#FFFFFF';

const SANS = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
const MONO = "'IBM Plex Mono', 'Courier New', monospace";

// ─── Mock data — The Hendrix ──────────────────────────────────────────────────
const PROPOSAL = {
  quoteNumber: 'GG-2026-0089',
  validUntil: 'May 31, 2026',
  createdAt: 'April 2026',
  property: {
    name: 'The Hendrix',
    city: 'Brookhaven', state: 'GA',
    units: 360,
    contactName: 'David',
  },
  preparedBy: {
    name: 'Russel Feldman',
    title: 'Gate Guard, LLC',
    phone: '770-776-8095',
    cell: '770-776-8095',
    office: '844-4MY-GATE',
    email: 'rfeldman@gateguard.co',
    web: 'gateguard.co',
    address: '980 Hammond Drive, Ste. 200, Atlanta, GA 30328',
  },
  tagline: 'Turn a parking deck liability into up to $540,000 in asset value — and let residents fund every dollar of it.',
  coverLetter: `David — thank you for the time walking the site at The Hendrix. After reviewing every level of the parking structure and the full door, camera, and network inventory, we've built three options around what ownership actually needs: real security, modern technology, and a financial outcome that makes sense for the asset.\n\nYour existing 16 cameras cover amenity areas around the property — the parking deck has only an entrance camera watching vehicles come off the street. The upper levels of the structure are completely unmonitored. One incident is documented. The liability grows every day without action. We're proposing 25 new cameras covering all five deck levels — tied into your existing 16 for 41 cameras site-wide, monitored by a live call center 24/7.\n\nBeyond cameras, The Hendrix has 46 access points running on aging DoorKing hardware alongside a passive Hikvision/LTS camera system with no active monitoring, no alerts, and no response capability. Option 3 replaces all of it — Schlage XE360 smart locks, Brivo cloud access, Gate Guard callboxes and network — structured so your residents fund the entire program at $20–$25/unit/month while the property generates up to $3,600 in monthly profit and adds up to $540,000 to the asset.\n\nThree options. One decision. Let's close this.`,
  siteStats: [
    { label: 'UNITS', value: '360', sub: 'Residential' },
    { label: 'ACCESS POINTS', value: '46', sub: 'Doors & Gates' },
    { label: 'PARKING', value: '5-Story', sub: 'Deck' },
    { label: 'CAMERAS', value: '16', sub: 'LTS/Hikvision' },
    { label: 'VEHICLE ENTRY', value: '1 Gate', sub: '+ 3 Callboxes' },
    { label: 'LEGACY SYSTEMS', value: 'DKS +', sub: 'Hikvision', alert: true },
  ],
  findings: [
    { title: 'Parking Deck — No Coverage Above the Entrance', color: RED, body: 'Existing cameras capture vehicles entering from the street. The moment a car passes through the gate, all five levels of the structure are completely unmonitored. One incident already documented. Liability grows daily.' },
    { title: 'DoorKing System — No API, Annual Fees, No Future', color: RED, body: 'The existing DKS access control system carries annual licensing costs and cannot integrate with modern PMS platforms. No remote credential management. No automation. No path forward.' },
    { title: 'Hikvision/LTS — Passive Recording, Not Active Security', color: AMBER, body: 'Cameras record but are not monitored. No call center. No alerts. No response. The existing camera system provides zero active protection. This stops with GateGuard — every camera becomes a live, monitored asset.' },
    { title: '46 Doors — Mixed Hardware, Uncontrolled Credentials', color: AMBER, body: 'Combination of mag locks, push bars, failing readers, and non-functional strikes across leasing, amenity, and parking entries. Key fobs cannot be remotely deactivated at move-out.' },
    { title: '1 Vehicle Gate & 3 Callboxes — Outdated Hardware', color: BLUE, body: 'The vehicle entry gate and three existing callboxes run legacy hardware with no video, no app integration, and no visitor logging. Visitor management is manual, untracked, and unsecured.' },
    { title: 'Network — Upgrade Required for Full Coverage', color: GREEN, body: 'Existing switching infrastructure cannot support Brivo controllers, 25 new cameras, PtP radios, and callboxes simultaneously. Gate Guard Network Solutions handles the full infrastructure upgrade as part of the program.' },
  ],
  options: [
    {
      id: 'opt1',
      num: '1',
      name: 'Secure',
      subtitle: 'Resolve the incident liability. Cover the deck. Clean one-time close.',
      priceLabel: 'ONE-TIME INVESTMENT',
      price: '$61,270',
      priceSub: 'Full deck install & network — no monthly',
      recommended: false,
      includes: [
        { text: '25 new cameras — all 5 parking deck levels', check: true },
        { text: 'Gate Guard Network Solutions — full infrastructure', check: true },
        { text: 'PtP radios & bridges — deck connectivity', check: true },
        { text: 'No active monitoring', check: false },
        { text: 'No door upgrades', check: false },
        { text: 'Existing camera system remains in place', check: false },
      ],
      footer: 'Immediate liability resolution. Upgrade path to Options 2 or 3 available at any time.',
    },
    {
      id: 'opt2',
      num: '2',
      name: 'Monitor',
      subtitle: 'Cameras installed free. Active 24/7 monitoring. Your scale, your terms.',
      priceLabel: 'MONTHLY STARTING AT',
      price: '$1,000',
      priceSub: '10 cameras · $0 upfront · scales to $3,860 for all 41',
      recommended: false,
      includes: [
        { text: 'All cameras installed at no upfront cost', check: true },
        { text: '24/7 live call center monitoring', check: true },
        { text: 'Choose 10, 20, or all 41 cameras', check: true },
        { text: '3 vehicle entry callboxes included', check: true },
        { text: 'OpEx ($0 upfront) or CapEx (pay install → $85/cam/mo)', check: true },
        { text: 'No door program or smart lock upgrade', check: false },
      ],
      footer: 'Active security now. Flexible spend. Existing camera system eliminated. Upgrade path to Option 3 at any time.',
    },
    {
      id: 'opt3',
      num: '3',
      name: 'Elevate',
      subtitle: 'Complete transformation. Residents fund it. The asset wins.',
      priceLabel: 'SETUP + MONTHLY',
      price: '$34,500',
      priceSub: 'setup only · then $15/unit/mo to GG · property bills $20–$25',
      recommended: true,
      includes: [
        { text: 'All 41 cameras monitored — installed free', check: true },
        { text: '46 doors — Schlage XE360 no-tour smart locks', check: true },
        { text: '3 Gate Guard video callboxes', check: true },
        { text: 'Eagle Eye + DKS fully eliminated', check: true },
        { text: 'Full PMS API integration — Brivo + Yardi / RealPage', check: true },
        { text: 'Up to $540,000 added to asset value', check: true, highlight: true },
      ],
      footer: 'The only option where the property profits. Residents fund the program. Ownership captures the equity.',
    },
  ],
  financialEngine: {
    toGG: { amount: '$5,400', label: 'Monthly to Gate Guard', sub: '$15/unit × 360 — GG bills ownership monthly after setup' },
    collected: { amount: '$7,200–$9K', label: 'Monthly Collected', sub: '$20–$25/unit billed to residents — rolled out at lease renewal' },
    profit: { amount: '$1,800–$3,600', label: 'Monthly Profit', sub: 'Security becomes a revenue line — funded entirely by residents' },
    asset: { amount: '$270K–$540K', label: 'Asset Value Added', sub: 'Annual NOI ÷ 8% cap rate — permanent equity creation for ownership' },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function now() {
  return new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function QuoteApprovePage({ params }: { params: { id: string } }) {
  const p = PROPOSAL;
  const [status, setStatus]       = useState<Status>('pending');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [commentText, setCommentText]       = useState('');
  const [comments, setComments]             = useState<Comment[]>([
    {
      id: '0',
      author: 'Russel Feldman',
      text: "David — let me know if you have any questions on the options or the financials. Happy to walk through Option 3 on a quick call if that helps.",
      ts: 'Apr 28, 10:14 AM',
      fromClient: false,
    },
  ]);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showDeclineForm, setShowDeclineForm]     = useState(false);
  const [declineNote, setDeclineNote]             = useState('');
  const commentEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  function submitComment() {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    setTimeout(() => {
      setComments(prev => [...prev, {
        id: Date.now().toString(),
        author: p.property.contactName,
        text: commentText.trim(),
        ts: now(),
        fromClient: true,
      }]);
      setCommentText('');
      setSubmittingComment(false);
      // TODO: POST /api/quotes/[id]/comment
    }, 400);
  }

  // ── Declined screen ─────────────────────────────────────────────────────────
  if (status === 'declined') {
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: SANS }}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <XCircle size={36} color={RED} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: NAVY, margin: '0 0 8px' }}>Got it — thank you for the feedback.</h1>
          <p style={{ color: MUTED, marginBottom: 24, lineHeight: 1.65, fontSize: 13 }}>
            Russel will follow up shortly. If timing or scope changes, the door is always open.
          </p>
          <a href={`mailto:${p.preparedBy.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: BLUE, textDecoration: 'none', fontWeight: 600 }}>
            <Mail size={14} /> {p.preparedBy.email}
          </a>
        </div>
      </div>
    );
  }

  // ── Approved screen ─────────────────────────────────────────────────────────
  if (status === 'approved') {
    const chosen = p.options.find(o => o.id === selectedOption);
    return (
      <div style={{ minHeight: '100vh', background: CREAM, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', fontFamily: SANS }}>
        <div style={{ maxWidth: '480px', width: '100%', textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle2 size={40} color={GREEN} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: NAVY, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Proposal Approved!</h1>
          {chosen && (
            <div style={{ display: 'inline-block', background: NAVY, color: WHITE, borderRadius: 20, padding: '4px 16px', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}>
              OPTION {chosen.num} — {chosen.name.toUpperCase()} SELECTED
            </div>
          )}
          <p style={{ color: MUTED, marginBottom: 28, lineHeight: 1.65, fontSize: 14 }}>
            Thank you, {p.property.contactName}. The GateGuard team will be in touch within 1 business day to send your service agreement for signature.
          </p>
          <div style={{ background: WHITE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 24, textAlign: 'left' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>What Happens Next</p>
            {['GateGuard sends your service agreement for e-signature', 'Setup fee collected at contract signing', 'Site survey scheduled with your installation technician', 'Equipment pre-configured — shipped to job site', 'Go-live day — GateGuard on-site 9 AM – 6 PM'].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#EFF1FF', color: BLUE, fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i+1}</div>
                <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.55 }}>{step}</p>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: MUTED, marginTop: 20 }}>
            Questions?{' '}
            <a href={`mailto:${p.preparedBy.email}`} style={{ color: BLUE, textDecoration: 'none' }}>{p.preparedBy.email}</a>
            {' · '}
            <a href={`tel:${p.preparedBy.cell}`} style={{ color: BLUE, textDecoration: 'none' }}>{p.preparedBy.phone}</a>
          </p>
        </div>
      </div>
    );
  }

  // ── Main proposal page ──────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: SANS, background: CREAM, minHeight: '100vh', color: TEXT }}>

      {/* ── HERO / COVER ─────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(160deg, ${NAVY} 0%, ${NAVY2} 100%)`, padding: '0 0 60px', position: 'relative', overflow: 'hidden' }}>
        {/* subtle grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(107,126,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.04) 1px, transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />

        {/* top bar */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* GG logo mark */}
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(107,126,255,0.15)', border: '1.5px solid rgba(107,126,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: BLUE, letterSpacing: '-1px' }}>GG</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: WHITE, letterSpacing: '-0.3px' }}>GateGuard</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.06em' }}>UNRIVALED SECURITY</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>{p.quoteNumber}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Valid until {p.validUntil}</div>
          </div>
        </div>

        {/* hero text */}
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 24px 0', position: 'relative', textAlign: 'center' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.15em', marginBottom: 10, textTransform: 'uppercase' }}>PREPARED FOR</div>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: WHITE, margin: '0 0 6px', letterSpacing: '-1.5px', lineHeight: 1.05 }}>{p.property.name}</h1>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}>{p.property.city}, {p.property.state}</div>
          <div style={{ display: 'inline-block', background: 'rgba(107,126,255,0.15)', border: '1px solid rgba(107,126,255,0.35)', borderRadius: 6, padding: '6px 18px', fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 32 }}>
            {p.property.units} UNITS · SECURITY & ACCESS MODERNIZATION
          </div>
          <div style={{ maxWidth: 540, margin: '0 auto', fontSize: 16, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: 1.6 }}>
            "{p.tagline}"
          </div>
        </div>
      </div>

      {/* ── COVER LETTER ────────────────────────────────────────────────────── */}
      <div style={{ background: WHITE }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
          <div style={{ display: 'flex', gap: 36, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}>
              {/* Avatar placeholder — replace with real photo URL */}
              <div style={{ width: 96, height: 96, borderRadius: 14, background: NAVY2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: '-1px' }}>RF</div>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{p.preparedBy.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{p.preparedBy.title}</div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 260 }}>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: NAVY, margin: '0 0 18px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>The parking deck incident is a signal. Here's how we answer it.</h2>
              {p.coverLetter.split('\n\n').map((para, i) => (
                <p key={i} style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 14 }}
                  dangerouslySetInnerHTML={{ __html: para.replace(/Option 3/g, '<strong>Option 3</strong>').replace(/\$\d[\d,K–]+/g, m => `<strong>${m}</strong>`) }}
                />
              ))}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  <a href={`mailto:${p.preparedBy.email}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: BLUE, textDecoration: 'none' }}>
                    <Mail size={12} />{p.preparedBy.email}
                  </a>
                  <a href={`tel:${p.preparedBy.cell}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: BLUE, textDecoration: 'none' }}>
                    <Phone size={12} />{p.preparedBy.phone}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SITE ASSESSMENT ──────────────────────────────────────────────────── */}
      <div style={{ background: CREAM }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>SITE ASSESSMENT · {p.property.name.toUpperCase()}</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: NAVY, margin: '0 0 28px', letterSpacing: '-0.8px' }}>What We Found</h2>

          {/* Stats grid */}
          <div style={{ background: WHITE, borderRadius: 14, padding: '20px 24px', marginBottom: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, border: `1px solid ${BORDER}` }}>
            {p.siteStats.map((stat, i) => (
              <div key={i} style={{ padding: '12px 16px', borderRight: i % 3 !== 2 ? `1px solid ${BORDER}` : 'none', borderBottom: i < 3 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: stat.alert ? RED : BLUE, letterSpacing: '0.1em', marginBottom: 4, textTransform: 'uppercase' }}>{stat.label}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: stat.alert ? RED : NAVY, lineHeight: 1.1, marginBottom: 2 }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{stat.sub}</div>
              </div>
            ))}
          </div>

          {/* Findings grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {p.findings.map((f, i) => (
              <div key={i} style={{ background: WHITE, borderRadius: 12, padding: '16px 18px', border: `1px solid ${BORDER}`, borderLeft: `3px solid ${f.color}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 6, lineHeight: 1.3 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.65 }}>{f.body}</div>
              </div>
            ))}
          </div>

          {/* Legacy elimination banner */}
          <div style={{ marginTop: 16, background: NAVY, borderRadius: 10, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 16 }}>🔄</span>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.65 }}>
              <strong style={{ color: WHITE }}>Legacy systems being eliminated:</strong> Hikvision/LTS (existing camera system) · DoorKing / DKS (access control & annual fees) · Outdated callboxes (vehicle gate + 3 entries). Replaced by one GateGuard platform — one monthly fee, zero legacy costs going forward.
            </p>
          </div>
        </div>
      </div>

      {/* ── THREE OPTIONS ─────────────────────────────────────────────────────── */}
      <div style={{ background: NAVY }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>THREE PATHS FORWARD · {p.property.name.toUpperCase()}</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: WHITE, margin: '0 0 8px', letterSpacing: '-0.8px' }}>Choose Your Level</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32 }}>Select the option that fits your goals — each is available immediately.</p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {p.options.map(opt => {
              const isSelected = selectedOption === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setSelectedOption(isSelected ? null : opt.id)}
                  style={{
                    background: isSelected ? 'rgba(107,126,255,0.15)' : 'rgba(255,255,255,0.06)',
                    border: `1.5px solid ${isSelected ? BLUE : opt.recommended ? 'rgba(107,126,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 14, padding: 20, cursor: 'pointer', position: 'relative',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                >
                  {opt.recommended && (
                    <div style={{ position: 'absolute', top: -1, right: 12, background: BLUE, color: WHITE, fontFamily: MONO, fontSize: 9, fontWeight: 700, padding: '3px 10px', borderRadius: '0 0 6px 6px', letterSpacing: '0.08em' }}>RECOMMENDED</div>
                  )}
                  {isSelected && (
                    <div style={{ position: 'absolute', top: 12, left: 12, width: 20, height: 20, borderRadius: '50%', background: BLUE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={12} color={WHITE} strokeWidth={3} />
                    </div>
                  )}
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BLUE, letterSpacing: '0.1em', marginBottom: 4 }}>OPTION {opt.num}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: WHITE, marginBottom: 4, letterSpacing: '-0.5px' }}>{opt.name}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 16, lineHeight: 1.5 }}>{opt.subtitle}</div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14, marginBottom: 14 }}>
                    <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>{opt.priceLabel}</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: WHITE, letterSpacing: '-1px', lineHeight: 1 }}>{opt.price}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{opt.priceSub}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {opt.includes.map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7, opacity: item.check ? 1 : 0.4 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.check ? (item.highlight ? '#10B981' : 'rgba(107,126,255,0.3)') : 'rgba(255,255,255,0.1)', border: `1px solid ${item.check ? (item.highlight ? '#10B981' : BLUE) : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          {item.check
                            ? <Check size={8} color={WHITE} strokeWidth={3} />
                            : <X size={7} color="rgba(255,255,255,0.4)" strokeWidth={2} />
                          }
                        </div>
                        <span style={{ fontSize: 11, color: item.highlight ? '#10B981' : 'rgba(255,255,255,0.75)', fontWeight: item.highlight ? 700 : 400, lineHeight: 1.45 }}>{item.text}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14, fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.55, fontStyle: 'italic' }}>{opt.footer}</div>
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 16 }}>Click an option to select it · you can change your selection before approving</p>
        </div>
      </div>

      {/* ── OPTION 3 FINANCIAL ENGINE ─────────────────────────────────────────── */}
      <div style={{ background: NAVY2 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>OPTION 3 · THE FULL TRANSFORMATION</div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: WHITE, margin: '0 0 28px', letterSpacing: '-0.8px' }}>Where Security Becomes Asset Value</h2>

          {/* 4-metric strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {Object.values(p.financialEngine).map((m, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#10B981', letterSpacing: '-1px', lineHeight: 1, marginBottom: 6 }}>{m.amount}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: WHITE, marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Line item breakdown */}
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            {[
              { label: 'Setup fee — 46 doors × $750', value: '$34,500', note: 'the only upfront cost to ownership', highlight: false },
              { label: 'Monthly billed to ownership by GateGuard — 360 units × $15', value: '$5,400 / month', note: '', highlight: false },
              { label: 'Resident technology fee ownership collects — $20–$25/unit', value: '$7,200–$9,000 / month collected', note: '', highlight: false },
              { label: 'All 41 cameras installed', value: 'No additional charge — included in monthly', note: '', highlight: false },
              { label: 'Full PMS API integration (Yardi / RealPage / Entrata)', value: 'Included — auto-credential at lease signing', note: '', highlight: false },
              { label: 'Hikvision/LTS system & DoorKing fees', value: 'Eliminated on day one', note: '', highlight: true, valueColor: '#10B981' },
              { label: 'All repairs, parts & maintenance — all 46 doors', value: 'Included — zero trip charges, ever', note: '', highlight: true, valueColor: '#10B981' },
              { label: 'Ownership monthly profit', value: '+$1,800–$3,600 / month → $270K–$540K in asset value', note: '', highlight: true, valueColor: '#10B981', bold: true },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, padding: '12px 18px', borderBottom: i < 7 ? '1px solid rgba(255,255,255,0.06)' : 'none', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: row.bold ? WHITE : 'rgba(255,255,255,0.6)', fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: (row as any).valueColor || WHITE, textAlign: 'right', flexShrink: 0 }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Easy Start callout */}
          <div style={{ background: 'rgba(107,126,255,0.1)', border: '1px solid rgba(107,126,255,0.25)', borderRadius: 10, padding: '14px 18px' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: BLUE }}>📈 Optional Easy Start — 12-Month Ramp: </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.65 }}>Add a 12-month introductory period before the 60-month program begins. Month 1: $34,500 setup billed in full, installations begin. Months 2–12: billing ramps from 10% to 100% as the $20/unit tech fee rolls out at lease renewal. Ownership is never cash-negative. Full program rate begins month 13 — by which point residents have funded every dollar.</span>
          </div>
        </div>
      </div>

      {/* ── COMMENTS / QUESTIONS ─────────────────────────────────────────────── */}
      <div style={{ background: WHITE }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px' }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BLUE, letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>CONVERSATION</div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: NAVY, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Questions or Comments?</h2>
          <p style={{ fontSize: 13, color: MUTED, marginBottom: 28, lineHeight: 1.6 }}>Leave a message below — the GateGuard team will respond within 1 business day. You can also request scope changes, ask about pricing, or schedule a call.</p>

          {/* Thread */}
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

          {/* Compose */}
          <div style={{ background: CREAM, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: 'hidden' }}>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment(); }}
              placeholder={`Ask a question or leave a comment, ${p.property.contactName}…`}
              rows={3}
              style={{ width: '100%', border: 'none', background: 'transparent', padding: '14px 16px', fontSize: 13, color: TEXT, fontFamily: SANS, resize: 'none', outline: 'none', boxSizing: 'border-box', lineHeight: 1.65 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: `1px solid ${BORDER}`, background: WHITE }}>
              <span style={{ fontSize: 11, color: MUTED }}>⌘↵ to send</span>
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || submittingComment}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: commentText.trim() ? BLUE : CREAM2, color: commentText.trim() ? WHITE : MUTED, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: commentText.trim() ? 'pointer' : 'default', transition: 'background 0.15s' }}
              >
                <Send size={13} />
                {submittingComment ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── APPROVAL CTA ─────────────────────────────────────────────────────── */}
      <div style={{ background: NAVY }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '52px 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 40, fontWeight: 900, color: WHITE, margin: '0 0 8px', letterSpacing: '-1px', lineHeight: 1.1 }}>
            Let's Win<br />{p.property.name}.
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.7 }}>
            One decision eliminates the existing camera system, retires DoorKing, covers every level of the parking deck, upgrades 46 access points, and adds up to $540,000 to the asset.
          </p>

          {/* Option summary chips */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 36, flexWrap: 'wrap' }}>
            {p.options.map(opt => (
              <div
                key={opt.id}
                onClick={() => setSelectedOption(opt.id)}
                style={{
                  background: selectedOption === opt.id ? BLUE : 'rgba(255,255,255,0.07)',
                  border: `1.5px solid ${selectedOption === opt.id ? BLUE : opt.recommended ? 'rgba(107,126,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 10, padding: '12px 20px', cursor: 'pointer', minWidth: 140, textAlign: 'center', transition: 'all 0.15s',
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 8, color: selectedOption === opt.id ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', marginBottom: 4 }}>OPTION {opt.num} — {opt.name.toUpperCase()}{opt.recommended ? ' ★' : ''}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: WHITE, letterSpacing: '-0.5px' }}>{opt.price}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{opt.num === '1' ? 'One-time · No monthly' : opt.num === '2' ? 'Monthly · $0 upfront install' : '$34,500 setup · prop bills $20–$25'}</div>
              </div>
            ))}
          </div>

          {!selectedOption && (
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Select an option above before approving</p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 380, margin: '0 auto' }}>
            <button
              onClick={() => { if (selectedOption) setStatus('approved'); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: '17px 24px',
                background: selectedOption ? BLUE : 'rgba(107,126,255,0.25)',
                color: selectedOption ? WHITE : 'rgba(255,255,255,0.35)',
                border: `1.5px solid ${selectedOption ? BLUE : 'rgba(107,126,255,0.2)'}`,
                borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: selectedOption ? 'pointer' : 'default',
                boxShadow: selectedOption ? '0 4px 20px rgba(107,126,255,0.45)' : 'none',
                letterSpacing: '0.04em', transition: 'all 0.15s',
              }}
            >
              <CheckCircle2 size={20} />
              APPROVE PROPOSAL
            </button>

            {!showDeclineForm ? (
              <button
                onClick={() => setShowDeclineForm(true)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px 24px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                <XCircle size={15} />
                Decline
              </button>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 16, textAlign: 'left' }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 10, fontWeight: 600 }}>Help us understand — what's holding you back?</p>
                <textarea
                  value={declineNote}
                  onChange={e => setDeclineNote(e.target.value)}
                  placeholder="Timing, budget, scope concerns…"
                  rows={3}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: WHITE, fontFamily: SANS, resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setStatus('declined'); }}
                    style={{ flex: 1, padding: '10px', background: '#EF4444', color: WHITE, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Send & Decline
                  </button>
                  <button
                    onClick={() => setShowDeclineForm(false)}
                    style={{ padding: '10px 16px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 24 }}>
            Proposal {p.quoteNumber} · Valid until {p.validUntil}
          </p>
        </div>
      </div>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <div style={{ background: '#070F1F', padding: '28px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Gate Guard, LLC</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{p.preparedBy.address}</div>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'Cell', val: p.preparedBy.phone },
              { label: 'Office', val: p.preparedBy.office },
              { label: 'Email', val: p.preparedBy.email },
              { label: 'Web', val: p.preparedBy.web },
            ].map(item => (
              <div key={item.label}>
                <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', marginBottom: 2 }}>{item.label.toUpperCase()}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>{item.val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
