'use client'

import { useState, useMemo } from 'react'
import { TrendingUp, Search, CheckCircle2, Star, ExternalLink, Plus, X } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Zap, DollarSign, ShoppingBag, Tag, Info } = require('lucide-react') as any

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'all' | 'tv' | 'internet' | 'video_monitoring' | 'package_lockers' | 'access_control' | 'smart_locks' | 'security' | 'network_mgmt' | 'energy'
type BillingType = 'per_unit' | 'per_property' | 'flat_fee' | 'per_device' | 'per_camera'

interface Service {
  id:                   string
  name:                 string
  provider:             string
  category:             Category
  description:          string
  logo_emoji:           string
  provider_color:       string
  billing_type:         BillingType
  base_price:           number
  unit_label:           string
  min_units:            number
  contract_months:      number
  dealer_commission_pct:number
  gg_commission_pct:    number
  is_featured:          boolean
  requires_enrollment:  boolean
  enrollment_url?:      string
  notes?:               string
}

// ─── Static catalog (mirrors migration 070 seed data) ────────────────────────

const CATALOG: Service[] = [
  // TV
  { id:'tv-1',   name:'DIRECTV STREAM Bulk',        provider:'AT&T DIRECTV',       category:'tv',              description:'Bulk MDU video — 190+ channels, 4K HDR, no satellite dish. Revenue share per activated unit.',          logo_emoji:'📺', provider_color:'#00A8E0', billing_type:'per_unit',     base_price:12,   unit_label:'unit',     min_units:20,  contract_months:24, dealer_commission_pct:12, gg_commission_pct:3,  is_featured:true,  requires_enrollment:true,  notes:'Requires AT&T MDU dealer certification. Contact ATLAS for onboarding.' },
  { id:'tv-2',   name:'DIRECTV via Satellite',      provider:'AT&T DIRECTV',       category:'tv',              description:'Traditional bulk satellite MDU agreement. Best for properties without reliable internet.',              logo_emoji:'🛰️', provider_color:'#00A8E0', billing_type:'per_unit',     base_price:9,    unit_label:'unit',     min_units:50,  contract_months:24, dealer_commission_pct:10, gg_commission_pct:3,  is_featured:false, requires_enrollment:true,  notes:'Min 50 units. Satellite dish install required.' },
  { id:'tv-3',   name:'Spectrum TV Select',         provider:'Spectrum Enterprise', category:'tv',              description:'Charter/Spectrum bulk TV agreement — MDU rate card. Local market availability varies.',                 logo_emoji:'📡', provider_color:'#0099D9', billing_type:'per_unit',     base_price:11,   unit_label:'unit',     min_units:30,  contract_months:24, dealer_commission_pct:8,  gg_commission_pct:2.5,is_featured:false, requires_enrollment:true,  notes:'Check market availability before quoting.' },
  // Internet
  { id:'isp-1',  name:'AT&T Fiber Bulk MDU',        provider:'AT&T',               category:'internet',        description:'Gigabit fiber internet for MDU. Included-in-rent option available.',                                   logo_emoji:'🌐', provider_color:'#00A8E0', billing_type:'per_unit',     base_price:18,   unit_label:'unit',     min_units:20,  contract_months:36, dealer_commission_pct:10, gg_commission_pct:3,  is_featured:true,  requires_enrollment:true,  notes:'Fiber availability map required before quote.' },
  { id:'isp-2',  name:'Comcast Business MDU',       provider:'Comcast/Xfinity',    category:'internet',        description:'Xfinity bulk internet — up to 1.2 Gbps. Included-in-rent or tiered upgrade packages.',                 logo_emoji:'📶', provider_color:'#E1251B', billing_type:'per_unit',     base_price:15,   unit_label:'unit',     min_units:20,  contract_months:24, dealer_commission_pct:8,  gg_commission_pct:2.5,is_featured:false, requires_enrollment:true,  notes:undefined },
  { id:'isp-3',  name:'Starlink for MDU',           provider:'SpaceX Starlink',    category:'internet',        description:'Satellite broadband where fiber is unavailable. $500 hardware + monthly service.',                     logo_emoji:'🚀', provider_color:'#FF5733', billing_type:'per_property', base_price:500,  unit_label:'property', min_units:1,   contract_months:12, dealer_commission_pct:5,  gg_commission_pct:2,  is_featured:false, requires_enrollment:false, notes:'Best for rural/suburban without fiber.' },
  // Video Monitoring
  { id:'vm-1',   name:'Video Monitoring — Remote',  provider:'Keystone Security',  category:'video_monitoring', description:'24/7 live video monitoring with human response — alarm verification, virtual guard tours, deterrence.', logo_emoji:'👁️', provider_color:'#7C3AED', billing_type:'per_property', base_price:395,  unit_label:'property', min_units:1,   contract_months:12, dealer_commission_pct:15, gg_commission_pct:5,  is_featured:true,  requires_enrollment:false, notes:'GateGuard installs Eagle Eye cameras. Keystone monitors. Clean handoff.' },
  { id:'vm-2',   name:'Video Monitoring — AI',      provider:'Envision AI',        category:'video_monitoring', description:'AI-powered analytics — loitering detection, LPR, crowd alerts. No human monitoring.',                   logo_emoji:'🤖', provider_color:'#6B7EFF', billing_type:'per_camera',   base_price:18,   unit_label:'camera',   min_units:4,   contract_months:12, dealer_commission_pct:12, gg_commission_pct:4,  is_featured:false, requires_enrollment:false, notes:'Requires Eagle Eye cameras already installed.' },
  { id:'vm-3',   name:'Virtual Guard Tours',        provider:'Securitas Digital',  category:'video_monitoring', description:'Scheduled virtual patrol tours via existing cameras. Incident reporting included.',                     logo_emoji:'🔒', provider_color:'#1E293B', billing_type:'per_property', base_price:250,  unit_label:'property', min_units:1,   contract_months:12, dealer_commission_pct:10, gg_commission_pct:3,  is_featured:false, requires_enrollment:true,  notes:undefined },
  // Package Lockers
  { id:'pl-1',   name:'Luxer One Smart Lockers',    provider:'Luxer One',          category:'package_lockers', description:'Smart locker — residents get PIN/app notification on delivery. Reduces package theft 95%+.',              logo_emoji:'📦', provider_color:'#FF6B35', billing_type:'flat_fee',     base_price:149,  unit_label:'property', min_units:1,   contract_months:36, dealer_commission_pct:20, gg_commission_pct:5,  is_featured:true,  requires_enrollment:false, notes:'Hardware sold separately. SaaS fee shown. Min 4-door unit for < 100 units.' },
  { id:'pl-2',   name:'Amazon Hub Apartment',       provider:'Amazon',             category:'package_lockers', description:'Amazon-branded locker — Amazon covers hardware cost, property earns revenue share on deliveries.',       logo_emoji:'📬', provider_color:'#FF9900', billing_type:'flat_fee',     base_price:0,    unit_label:'property', min_units:1,   contract_months:36, dealer_commission_pct:0,  gg_commission_pct:2,  is_featured:false, requires_enrollment:true,  notes:'Amazon pays dealer a referral fee at install. No monthly SaaS cost to property.' },
  { id:'pl-3',   name:'Package Concierge',          provider:'Package Concierge',  category:'package_lockers', description:'Full-service package room management — smart locker + attendant option.',                               logo_emoji:'🏢', provider_color:'#0F4C81', billing_type:'flat_fee',     base_price:199,  unit_label:'property', min_units:1,   contract_months:24, dealer_commission_pct:15, gg_commission_pct:4,  is_featured:false, requires_enrollment:false, notes:undefined },
  // Access Control
  { id:'ac-1',   name:'GateGuard Access + Gate Plan', provider:'GateGuard',          category:'access_control',  description:'GateGuard signature plan — gate operators, Brivo cloud, mobile credentials, 24/7 monitoring, all-inclusive.', logo_emoji:'🔑', provider_color:'#6B7EFF', billing_type:'per_unit', base_price:5, unit_label:'unit', min_units:1, contract_months:36, dealer_commission_pct:0, gg_commission_pct:100, is_featured:true, requires_enrollment:false, notes:'Core GateGuard product. Dealer earns on install margin.' },
  { id:'ac-2',   name:'Brivo Cloud Access Control', provider:'Brivo',              category:'access_control',  description:'Brivo ACS cloud subscription — $3/door/month. Doors, readers, credentials in Brivo portal.',             logo_emoji:'🚪', provider_color:'#0069C0', billing_type:'per_unit',     base_price:3,    unit_label:'door',     min_units:1,   contract_months:12, dealer_commission_pct:8,  gg_commission_pct:2,  is_featured:false, requires_enrollment:true,  notes:'Dealer must be Brivo certified.' },
  // Smart Locks
  { id:'sl-1',   name:'Yale Smart Locks',           provider:'Yale',               category:'smart_locks',     description:'Z-wave smart deadbolts with cloud management. Integrates with Brivo for keyless resident access.',         logo_emoji:'🔐', provider_color:'#003DA5', billing_type:'flat_fee',     base_price:12,   unit_label:'door',     min_units:10,  contract_months:24, dealer_commission_pct:18, gg_commission_pct:4,  is_featured:true,  requires_enrollment:false, notes:'Yale Approach or Assure series. Requires Z-wave hub or Brivo.' },
  { id:'sl-2',   name:'Schlage Encode Plus',        provider:'Schlage',            category:'smart_locks',     description:'Apple Home Key + WiFi deadbolt. Best for properties with Apple ecosystem residents.',                     logo_emoji:'🗝️', provider_color:'#1C3D5A', billing_type:'flat_fee',     base_price:10,   unit_label:'door',     min_units:10,  contract_months:24, dealer_commission_pct:15, gg_commission_pct:3.5,is_featured:false, requires_enrollment:false, notes:undefined },
  { id:'sl-3',   name:'Latch M Smart Lock',         provider:'Latch',              category:'smart_locks',     description:'Resident app, keycard, touchscreen entry. Subscription includes cloud management.',                        logo_emoji:'📱', provider_color:'#00D4AA', billing_type:'per_unit',     base_price:6,    unit_label:'door',     min_units:20,  contract_months:24, dealer_commission_pct:10, gg_commission_pct:3,  is_featured:false, requires_enrollment:true,  notes:'Verify Latch contract terms — company in financial stress.' },
  // Security
  { id:'sec-1',  name:'ADT Commercial Security',    provider:'ADT',                category:'security',        description:'ADT commercial intrusion, fire alarm, video integration. Central station monitoring included.',           logo_emoji:'🛡️', provider_color:'#0066FF', billing_type:'per_property', base_price:89,   unit_label:'property', min_units:1,   contract_months:36, dealer_commission_pct:12, gg_commission_pct:3,  is_featured:false, requires_enrollment:true,  notes:'Requires ADT commercial dealer agreement.' },
  { id:'sec-2',  name:'Verkada Cloud Security',     provider:'Verkada',            category:'security',        description:'Cloud-managed cameras, access control, and alarms on one platform. All-in-one.',                         logo_emoji:'📷', provider_color:'#1A1A2E', billing_type:'per_device',   base_price:20,   unit_label:'device',   min_units:5,   contract_months:12, dealer_commission_pct:10, gg_commission_pct:3,  is_featured:false, requires_enrollment:true,  notes:'Hardware is expensive. Position as premium tier.' },
  // Network
  { id:'net-1',  name:'GateGuard Network Mgmt',     provider:'GateGuard',          category:'network_mgmt',    description:'Managed UniFi for leasing offices and common areas. Monthly health monitoring, firmware, 4-hr response SLA.', logo_emoji:'🌐', provider_color:'#6B7EFF', billing_type:'per_property', base_price:199, unit_label:'property', min_units:1, contract_months:12, dealer_commission_pct:0, gg_commission_pct:80, is_featured:true, requires_enrollment:false, notes:'Dealer earns on hardware margin at install.' },
  { id:'net-2',  name:'Comcast Business Ethernet',  provider:'Comcast Business',   category:'network_mgmt',    description:'Dedicated fiber Ethernet for leasing office — 99.9% SLA, static IP, 24/7 NOC.',                           logo_emoji:'🔌', provider_color:'#E1251B', billing_type:'per_property', base_price:299,  unit_label:'property', min_units:1,   contract_months:36, dealer_commission_pct:8,  gg_commission_pct:2,  is_featured:false, requires_enrollment:true,  notes:'Best for properties needing guaranteed uptime for gate/access.' },
  // Energy
  { id:'nrg-1',  name:'Solstice Community Solar',   provider:'Solstice Power',     category:'energy',          description:'Community solar — residents get 10-15% off electricity, property earns referral income.',                 logo_emoji:'☀️', provider_color:'#F59E0B', billing_type:'per_unit',     base_price:2,    unit_label:'unit',     min_units:50,  contract_months:12, dealer_commission_pct:8,  gg_commission_pct:2,  is_featured:false, requires_enrollment:true,  notes:'No hardware install required. Residents opt in individually.' },
]

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',              label: 'All Services',   emoji: '🏪' },
  { id: 'access_control',  label: 'Access Control', emoji: '🔑' },
  { id: 'tv',              label: 'TV & Streaming',  emoji: '📺' },
  { id: 'internet',        label: 'Internet',        emoji: '🌐' },
  { id: 'video_monitoring',label: 'Video Monitoring',emoji: '👁️' },
  { id: 'package_lockers', label: 'Package Lockers', emoji: '📦' },
  { id: 'smart_locks',     label: 'Smart Locks',     emoji: '🔐' },
  { id: 'security',        label: 'Security',        emoji: '🛡️' },
  { id: 'network_mgmt',    label: 'Network',         emoji: '📡' },
  { id: 'energy',          label: 'Energy',          emoji: '☀️' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(s: Service) {
  if (s.base_price === 0) return 'FREE'
  const p = `$${s.base_price.toFixed(0)}`
  if (s.billing_type === 'per_unit')     return `${p}/${s.unit_label}/mo`
  if (s.billing_type === 'per_property') return `${p}/property/mo`
  if (s.billing_type === 'flat_fee')     return `${p}/${s.unit_label}/mo`
  if (s.billing_type === 'per_camera')  return `${p}/camera/mo`
  if (s.billing_type === 'per_device')  return `${p}/device/mo`
  return `${p}/mo`
}

function mrrEstimate(s: Service, units: number) {
  const base = s.base_price * units
  return base * (s.dealer_commission_pct / 100)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [category,  setCategory]  = useState<Category>('all')
  const [search,    setSearch]    = useState('')
  const [detail,    setDetail]    = useState<Service | null>(null)
  const [calcUnits, setCalcUnits] = useState(50)
  const [enrolled,  setEnrolled]  = useState<Set<string>>(new Set(['ac-1', 'net-1']))

  const filtered = useMemo(() => {
    return CATALOG.filter(s => {
      if (category !== 'all' && s.category !== category) return false
      if (search) {
        const q = search.toLowerCase()
        if (!s.name.toLowerCase().includes(q) && !s.provider.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [category, search])

  const featured = CATALOG.filter(s => s.is_featured)

  // Summary stats
  const enrolledServices = CATALOG.filter(s => enrolled.has(s.id))
  const totalMRR = enrolledServices.reduce((sum, s) => sum + mrrEstimate(s, calcUnits), 0)

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-brand-500" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Service Marketplace</h1>
                <span className="text-xs font-semibold bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full border border-brand-200">
                  {CATALOG.length} Services
                </span>
              </div>
              <p className="text-sm text-gray-500 max-w-xl">
                Bundle recurring services into every property quote. TV, internet, video monitoring, smart locks, and more — all tracked in GateGuard with your commission built in.
              </p>
            </div>

            {/* MRR estimator summary */}
            <div className="bg-white border border-border rounded-xl p-4 min-w-[260px]">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">MRR ESTIMATOR</div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-gray-500">Units per property:</span>
                <input
                  type="number"
                  value={calcUnits}
                  onChange={e => setCalcUnits(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-8 border border-border rounded-lg px-2 text-sm font-mono text-center"
                />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-brand-500">${totalMRR.toFixed(0)}</span>
                <span className="text-sm text-gray-400">/mo dealer commission</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">from {enrolled.size} enrolled services × {calcUnits} units</div>
            </div>
          </div>
        </div>

        {/* Featured strip */}
        {category === 'all' && !search && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-700">Featured — Highest Earning</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {featured.map(s => (
                <button
                  key={s.id}
                  onClick={() => setDetail(s)}
                  className="text-left bg-white border border-border rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border" style={{ background: `${s.provider_color}14`, borderColor: `${s.provider_color}30` }}>
                      {s.logo_emoji}
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-900 leading-tight">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.provider}</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold" style={{ color: s.provider_color }}>{formatPrice(s)}</div>
                  <div className="text-xs text-emerald-600 font-semibold mt-1">
                    {s.dealer_commission_pct > 0 ? `${s.dealer_commission_pct}% dealer commission` : 'Install margin'}
                  </div>
                  {enrolled.has(s.id) && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Enrolled
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + category filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services, providers…"
              className="w-full h-9 pl-9 pr-4 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`h-9 px-3 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap
                  ${category === c.id
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'bg-white border-border text-gray-600 hover:border-brand-300'
                  }`}
              >
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-gray-400 mb-4 font-mono">
          {filtered.length} service{filtered.length !== 1 ? 's' : ''} {category !== 'all' ? `in ${CATEGORIES.find(c => c.id === category)?.label}` : 'total'}
          {search ? ` matching "${search}"` : ''}
        </div>

        {/* Service cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => (
            <ServiceCard
              key={s.id}
              service={s}
              enrolled={enrolled.has(s.id)}
              calcUnits={calcUnits}
              onEnroll={() => setEnrolled(prev => {
                const next = new Set(prev)
                if (next.has(s.id)) next.delete(s.id); else next.add(s.id)
                return next
              })}
              onDetail={() => setDetail(s)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <div className="font-semibold text-gray-600 mb-1">No services found</div>
            <div className="text-sm">Try a different category or clear your search.</div>
          </div>
        )}

        {/* Enrolled services summary */}
        {enrolled.size > 0 && (
          <div className="mt-12">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-semibold text-gray-700">Your Enrolled Services ({enrolled.size})</span>
            </div>
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-gray-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Commission</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Est. MRR</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledServices.map((s, i) => (
                    <tr key={s.id} className={i < enrolledServices.length - 1 ? 'border-b border-border' : ''}>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        <span className="mr-2">{s.logo_emoji}</span>{s.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{s.provider}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{formatPrice(s)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-semibold text-emerald-600">
                          {s.dealer_commission_pct > 0 ? `${s.dealer_commission_pct}%` : 'Install margin'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-brand-600">
                        ${mrrEstimate(s, calcUnits).toFixed(0)}/mo
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-brand-50 border-t border-brand-200">
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-brand-700">Total @ {calcUnits} units</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-brand-700">${totalMRR.toFixed(0)}/mo</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-xs text-gray-400">
              * Estimates based on {calcUnits} units per property. Actual MRR depends on enrolled property count and unit count per site.
            </div>
          </div>
        )}

      </div>

      {/* Detail slide-over */}
      {detail && (
        <ServiceDetail
          service={detail}
          enrolled={enrolled.has(detail.id)}
          calcUnits={calcUnits}
          onClose={() => setDetail(null)}
          onEnroll={() => setEnrolled(prev => {
            const next = new Set(prev)
            if (next.has(detail.id)) next.delete(detail.id); else next.add(detail.id)
            return next
          })}
        />
      )}
    </div>
  )
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service: s, enrolled, calcUnits, onEnroll, onDetail }: {
  service:   Service
  enrolled:  boolean
  calcUnits: number
  onEnroll:  () => void
  onDetail:  () => void
}) {
  const estMRR = mrrEstimate(s, calcUnits)

  return (
    <div className="bg-white border border-border rounded-xl p-5 hover:shadow-sm transition-shadow flex flex-col gap-3">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border shrink-0"
          style={{ background: `${s.provider_color}12`, borderColor: `${s.provider_color}28` }}>
          {s.logo_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <div className="text-sm font-bold text-gray-900 leading-tight">{s.name}</div>
            {s.is_featured && (
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0 mt-0.5" />
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{s.provider}</div>
          <CategoryBadge cat={s.category} />
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{s.description}</p>

      {/* Pricing row */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-lg font-bold" style={{ color: s.provider_color }}>
            {formatPrice(s)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {s.contract_months}mo contract · min {s.min_units} {s.unit_label}{s.min_units !== 1 ? 's' : ''}
          </div>
        </div>
        <div className="text-right">
          {s.dealer_commission_pct > 0 ? (
            <>
              <div className="text-sm font-bold text-emerald-600">{s.dealer_commission_pct}% commission</div>
              <div className="text-xs text-gray-400">≈ ${estMRR.toFixed(0)}/mo @ {calcUnits}u</div>
            </>
          ) : (
            <div className="text-xs font-semibold text-gray-500">Install margin</div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onEnroll}
          className={`flex-1 h-8 rounded-lg text-xs font-semibold border transition-colors
            ${enrolled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700'
            }`}
        >
          {enrolled ? (
            <span className="flex items-center justify-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Enrolled</span>
          ) : (
            <span className="flex items-center justify-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Enroll</span>
          )}
        </button>
        <button
          onClick={onDetail}
          className="w-8 h-8 rounded-lg border border-border text-gray-400 hover:text-gray-700 hover:border-gray-300 flex items-center justify-center transition-colors"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      {s.requires_enrollment && !enrolled && (
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
          <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Requires provider enrollment to quote
        </div>
      )}
    </div>
  )
}

// ─── Category Badge ───────────────────────────────────────────────────────────

const CAT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  tv:               { bg: 'bg-sky-50',     text: 'text-sky-700',     label: 'TV' },
  internet:         { bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Internet' },
  video_monitoring: { bg: 'bg-purple-50',  text: 'text-purple-700',  label: 'Video' },
  package_lockers:  { bg: 'bg-orange-50',  text: 'text-orange-700',  label: 'Lockers' },
  access_control:   { bg: 'bg-indigo-50',  text: 'text-indigo-700',  label: 'Access' },
  smart_locks:      { bg: 'bg-cyan-50',    text: 'text-cyan-700',    label: 'Smart Locks' },
  security:         { bg: 'bg-red-50',     text: 'text-red-700',     label: 'Security' },
  network_mgmt:     { bg: 'bg-teal-50',    text: 'text-teal-700',    label: 'Network' },
  energy:           { bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'Energy' },
  other:            { bg: 'bg-gray-50',    text: 'text-gray-700',    label: 'Other' },
}

function CategoryBadge({ cat }: { cat: string }) {
  const s = CAT_STYLES[cat] ?? CAT_STYLES.other
  return (
    <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ─── Detail Slide-over ────────────────────────────────────────────────────────

function ServiceDetail({ service: s, enrolled, calcUnits, onClose, onEnroll }: {
  service:   Service
  enrolled:  boolean
  calcUnits: number
  onClose:   () => void
  onEnroll:  () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-border sticky top-0 bg-white z-10">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl border shrink-0"
            style={{ background: `${s.provider_color}14`, borderColor: `${s.provider_color}30` }}>
            {s.logo_emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 leading-tight">{s.name}</div>
            <div className="text-sm text-gray-400">{s.provider}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-6">
          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed">{s.description}</p>

          {/* Pricing details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Rate',          value: formatPrice(s) },
                { label: 'Contract',      value: `${s.contract_months} months` },
                { label: 'Minimum',       value: `${s.min_units} ${s.unit_label}${s.min_units !== 1 ? 's' : ''}` },
                { label: 'Billing',       value: s.billing_type.replace(/_/g, ' ') },
              ].map(r => (
                <div key={r.label} className="bg-white rounded-lg p-3 border border-border">
                  <div className="text-xs text-gray-400 mb-1">{r.label}</div>
                  <div className="text-sm font-semibold text-gray-900 capitalize">{r.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Commission breakdown */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-3">Revenue Share</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Dealer commission</span>
                <span className="font-bold text-emerald-700">
                  {s.dealer_commission_pct > 0 ? `${s.dealer_commission_pct}%` : 'Install margin only'}
                </span>
              </div>
              {s.gg_commission_pct > 0 && s.gg_commission_pct < 100 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GateGuard platform fee</span>
                  <span className="font-semibold text-gray-700">{s.gg_commission_pct}%</span>
                </div>
              )}
              {s.dealer_commission_pct > 0 && (
                <>
                  <div className="border-t border-emerald-200 pt-2 mt-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">Est. @ {calcUnits} units</span>
                      <span className="text-emerald-700">${mrrEstimate(s, calcUnits).toFixed(0)}/mo</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>Annual</span>
                      <span>${(mrrEstimate(s, calcUnits) * 12).toFixed(0)}/yr</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notes */}
          {s.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">Notes</div>
              <p className="text-sm text-amber-800">{s.notes}</p>
            </div>
          )}

          {/* Enrollment callout */}
          {s.requires_enrollment && !enrolled && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2">Enrollment Required</div>
              <p className="text-sm text-blue-700 mb-3">You must complete provider enrollment before quoting this service to customers.</p>
              <a
                href={s.enrollment_url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                Start Enrollment <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border sticky bottom-0 bg-white">
          <button
            onClick={onEnroll}
            className={`w-full h-10 rounded-xl text-sm font-semibold border transition-colors
              ${enrolled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                : 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700'
              }`}
          >
            {enrolled
              ? <span className="flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" /> Enrolled — Click to Remove</span>
              : <span className="flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Enroll in This Service</span>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
