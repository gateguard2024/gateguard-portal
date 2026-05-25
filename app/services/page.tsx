'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Search, CheckCircle2, X, ChevronRight, Info, Plus } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Star, ExternalLink, TrendingUp, Shield, Wifi, Tv, Package, Lock, Camera, Network, Zap, AlertCircle } = require('lucide-react') as any

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = 'all' | 'tv' | 'internet' | 'video_monitoring' | 'package_lockers' | 'access_control' | 'smart_locks' | 'security' | 'network_mgmt' | 'energy'
type BillingType = 'per_unit' | 'per_property' | 'flat_fee' | 'per_device' | 'per_camera'

interface Service {
  id:                    string
  name:                  string
  provider:              string
  provider_id:           string   // used for logo lookup → /logos/{provider_id}.png
  category:              Category
  description:           string
  provider_color:        string
  billing_type:          BillingType
  base_price:            number
  unit_label:            string
  min_units:             number
  contract_months:       number
  dealer_commission_pct: number
  gg_commission_pct:     number
  is_featured:           boolean
  requires_enrollment:   boolean
  enrollment_url?:       string
  notes?:                string
}

// ─── Static catalog ───────────────────────────────────────────────────────────

const CATALOG: Service[] = [
  // TV
  { id:'tv-1',  name:'DIRECTV STREAM Bulk',       provider:'AT&T DIRECTV',       provider_id:'directv',   category:'tv',              description:'Bulk MDU video — 190+ channels, 4K HDR, no satellite dish. Revenue share per activated unit.',                           provider_color:'#00A8E0', billing_type:'per_unit',     base_price:12,  unit_label:'unit',     min_units:20, contract_months:24, dealer_commission_pct:12, gg_commission_pct:3,   is_featured:true,  requires_enrollment:true,  notes:'Requires AT&T MDU dealer certification. Contact ATLAS for onboarding.' },
  { id:'tv-2',  name:'DIRECTV via Satellite',      provider:'AT&T DIRECTV',       provider_id:'directv',   category:'tv',              description:'Traditional bulk satellite MDU agreement. Best for properties without reliable internet.',                              provider_color:'#00A8E0', billing_type:'per_unit',     base_price:9,   unit_label:'unit',     min_units:50, contract_months:24, dealer_commission_pct:10, gg_commission_pct:3,   is_featured:false, requires_enrollment:true,  notes:'Min 50 units. Satellite dish install required.' },
  { id:'tv-3',  name:'Spectrum TV Select',         provider:'Spectrum Enterprise', provider_id:'spectrum',  category:'tv',              description:'Charter/Spectrum bulk TV agreement — MDU rate card. Local market availability varies.',                                provider_color:'#0099D9', billing_type:'per_unit',     base_price:11,  unit_label:'unit',     min_units:30, contract_months:24, dealer_commission_pct:8,  gg_commission_pct:2.5, is_featured:false, requires_enrollment:true,  notes:'Check market availability before quoting.' },
  // Internet
  { id:'isp-1', name:'AT&T Fiber Bulk MDU',        provider:'AT&T',               provider_id:'att',       category:'internet',        description:'Gigabit fiber internet for MDU — included-in-rent option available. Best-in-class MDU ISP.',                           provider_color:'#00A8E0', billing_type:'per_unit',     base_price:18,  unit_label:'unit',     min_units:20, contract_months:36, dealer_commission_pct:10, gg_commission_pct:3,   is_featured:true,  requires_enrollment:true,  notes:'Fiber availability map required before quote.' },
  { id:'isp-2', name:'Comcast Business MDU',        provider:'Comcast / Xfinity',  provider_id:'xfinity',   category:'internet',        description:'Xfinity bulk internet — up to 1.2 Gbps. Included-in-rent or tiered upgrade packages.',                               provider_color:'#E1251B', billing_type:'per_unit',     base_price:15,  unit_label:'unit',     min_units:20, contract_months:24, dealer_commission_pct:8,  gg_commission_pct:2.5, is_featured:false, requires_enrollment:true  },
  { id:'isp-3', name:'Starlink for MDU',            provider:'SpaceX Starlink',    provider_id:'starlink',  category:'internet',        description:'Satellite broadband where fiber is unavailable. $500 hardware + monthly service.',                                   provider_color:'#1C1C1C', billing_type:'per_property', base_price:500, unit_label:'property', min_units:1,  contract_months:12, dealer_commission_pct:5,  gg_commission_pct:2,   is_featured:false, requires_enrollment:false, notes:'Best for rural/suburban without fiber.' },
  // Video Monitoring
  { id:'vm-1',  name:'Video Monitoring — Remote',  provider:'Keystone Security',  provider_id:'keystone',  category:'video_monitoring', description:'24/7 live video monitoring with human response — alarm verification, virtual guard tours, deterrence.',               provider_color:'#7C3AED', billing_type:'per_property', base_price:395, unit_label:'property', min_units:1,  contract_months:12, dealer_commission_pct:15, gg_commission_pct:5,   is_featured:true,  requires_enrollment:false, notes:'GateGuard installs Eagle Eye cameras. Keystone monitors. Clean handoff.' },
  { id:'vm-2',  name:'Video Monitoring — AI',      provider:'Envision AI',        provider_id:'envision',  category:'video_monitoring', description:'AI-powered analytics — loitering detection, LPR, crowd alerts. No human monitoring required.',                       provider_color:'#6B7EFF', billing_type:'per_camera',   base_price:18,  unit_label:'camera',   min_units:4,  contract_months:12, dealer_commission_pct:12, gg_commission_pct:4,   is_featured:false, requires_enrollment:false, notes:'Requires Eagle Eye cameras already installed.' },
  { id:'vm-3',  name:'Virtual Guard Tours',         provider:'Securitas Digital',  provider_id:'securitas', category:'video_monitoring', description:'Scheduled virtual patrol tours via existing cameras. Incident reporting included.',                                 provider_color:'#1E293B', billing_type:'per_property', base_price:250, unit_label:'property', min_units:1,  contract_months:12, dealer_commission_pct:10, gg_commission_pct:3,   is_featured:false, requires_enrollment:true  },
  // Package Lockers
  { id:'pl-1',  name:'Luxer One Smart Lockers',    provider:'Luxer One',          provider_id:'luxer',     category:'package_lockers', description:'Smart locker — residents get PIN/app notification on delivery. Reduces package theft 95%+.',                          provider_color:'#FF6B35', billing_type:'flat_fee',     base_price:149, unit_label:'property', min_units:1,  contract_months:36, dealer_commission_pct:20, gg_commission_pct:5,   is_featured:true,  requires_enrollment:false, notes:'Hardware sold separately. Min 4-door unit for <100 units.' },
  { id:'pl-2',  name:'Amazon Hub Apartment',        provider:'Amazon',             provider_id:'amazon',    category:'package_lockers', description:'Amazon-branded locker — Amazon covers hardware cost, property earns revenue share on deliveries.',                   provider_color:'#FF9900', billing_type:'flat_fee',     base_price:0,   unit_label:'property', min_units:1,  contract_months:36, dealer_commission_pct:0,  gg_commission_pct:2,   is_featured:false, requires_enrollment:true,  notes:'Amazon pays dealer a referral fee at install. No monthly SaaS cost.' },
  { id:'pl-3',  name:'Package Concierge',           provider:'Package Concierge',  provider_id:'pkgconcierge', category:'package_lockers', description:'Full-service package room management — smart locker + attendant option.',                                      provider_color:'#0F4C81', billing_type:'flat_fee',     base_price:199, unit_label:'property', min_units:1,  contract_months:24, dealer_commission_pct:15, gg_commission_pct:4,   is_featured:false, requires_enrollment:false },
  // Access Control
  { id:'ac-1',  name:'GateGuard Access + Gate Plan', provider:'GateGuard',        provider_id:'gateguard', category:'access_control',  description:'GateGuard signature plan — gate operators, Brivo cloud, mobile credentials, 24/7 monitoring, all-inclusive service.',  provider_color:'#6B7EFF', billing_type:'per_unit',     base_price:5,   unit_label:'unit',     min_units:1,  contract_months:36, dealer_commission_pct:0,  gg_commission_pct:100, is_featured:true,  requires_enrollment:false, notes:'Core GateGuard product. Dealer earns on install margin.' },
  { id:'ac-2',  name:'Brivo Cloud Access Control',  provider:'Brivo',             provider_id:'brivo',     category:'access_control',  description:'Brivo ACS cloud subscription — $3/door/month. Doors, readers, credentials managed in Brivo portal.',                 provider_color:'#0069C0', billing_type:'per_unit',     base_price:3,   unit_label:'door',     min_units:1,  contract_months:12, dealer_commission_pct:8,  gg_commission_pct:2,   is_featured:false, requires_enrollment:true,  notes:'Dealer must be Brivo certified.' },
  // Smart Locks
  { id:'sl-1',  name:'Yale Smart Locks',            provider:'Yale',               provider_id:'yale',      category:'smart_locks',     description:'Z-wave smart deadbolts with cloud management. Integrates with Brivo for keyless resident access.',                   provider_color:'#003DA5', billing_type:'flat_fee',     base_price:12,  unit_label:'door',     min_units:10, contract_months:24, dealer_commission_pct:18, gg_commission_pct:4,   is_featured:true,  requires_enrollment:false, notes:'Yale Approach or Assure series. Requires Z-wave hub or Brivo.' },
  { id:'sl-2',  name:'Schlage Encode Plus',         provider:'Schlage',            provider_id:'schlage',   category:'smart_locks',     description:'Apple Home Key + WiFi deadbolt. Best for properties with Apple ecosystem residents.',                                 provider_color:'#1C3D5A', billing_type:'flat_fee',     base_price:10,  unit_label:'door',     min_units:10, contract_months:24, dealer_commission_pct:15, gg_commission_pct:3.5, is_featured:false, requires_enrollment:false },
  { id:'sl-3',  name:'Latch M Smart Lock',          provider:'Latch',              provider_id:'latch',     category:'smart_locks',     description:'Resident app, keycard, touchscreen entry. Subscription includes cloud management.',                                  provider_color:'#000000', billing_type:'per_unit',     base_price:6,   unit_label:'door',     min_units:20, contract_months:24, dealer_commission_pct:10, gg_commission_pct:3,   is_featured:false, requires_enrollment:true,  notes:'Verify Latch contract terms — company in financial stress.' },
  // Security
  { id:'sec-1', name:'ADT Commercial Security',     provider:'ADT',                provider_id:'adt',       category:'security',        description:'ADT commercial intrusion, fire alarm, video integration. Central station monitoring included.',                       provider_color:'#0066FF', billing_type:'per_property', base_price:89,  unit_label:'property', min_units:1,  contract_months:36, dealer_commission_pct:12, gg_commission_pct:3,   is_featured:false, requires_enrollment:true,  notes:'Requires ADT commercial dealer agreement.' },
  { id:'sec-2', name:'Verkada Cloud Security',      provider:'Verkada',            provider_id:'verkada',   category:'security',        description:'Cloud-managed cameras, access control, and alarms on one platform. All-in-one enterprise.',                           provider_color:'#1A1A2E', billing_type:'per_device',   base_price:20,  unit_label:'device',   min_units:5,  contract_months:12, dealer_commission_pct:10, gg_commission_pct:3,   is_featured:false, requires_enrollment:true,  notes:'Hardware is expensive. Position as premium tier.' },
  // Network
  { id:'net-1', name:'GateGuard Network Mgmt',      provider:'GateGuard',          provider_id:'gateguard', category:'network_mgmt',    description:'Managed UniFi for leasing offices and common areas. Monthly health monitoring, firmware updates, 4-hr response SLA.',   provider_color:'#6B7EFF', billing_type:'per_property', base_price:199, unit_label:'property', min_units:1,  contract_months:12, dealer_commission_pct:0,  gg_commission_pct:80,  is_featured:true,  requires_enrollment:false, notes:'Dealer earns on hardware margin at install.' },
  { id:'net-2', name:'Comcast Business Ethernet',   provider:'Comcast Business',   provider_id:'xfinity',   category:'network_mgmt',    description:'Dedicated fiber Ethernet for leasing office — 99.9% SLA, static IP, 24/7 NOC.',                                       provider_color:'#E1251B', billing_type:'per_property', base_price:299, unit_label:'property', min_units:1,  contract_months:36, dealer_commission_pct:8,  gg_commission_pct:2,   is_featured:false, requires_enrollment:true,  notes:'Best for properties needing guaranteed uptime for gate/access.' },
  // Energy
  { id:'nrg-1', name:'Solstice Community Solar',    provider:'Solstice Power',     provider_id:'solstice',  category:'energy',          description:'Community solar — residents get 10–15% off electricity, property earns referral income.',                            provider_color:'#F59E0B', billing_type:'per_unit',     base_price:2,   unit_label:'unit',     min_units:50, contract_months:12, dealer_commission_pct:8,  gg_commission_pct:2,   is_featured:false, requires_enrollment:true,  notes:'No hardware install required. Residents opt in individually.' },
]

// ─── Category config ──────────────────────────────────────────────────────────

type CatConfig = { id: Category; label: string; icon: React.ElementType }

const CATEGORIES: CatConfig[] = [
  { id: 'all',              label: 'All Services',    icon: Package },
  { id: 'access_control',  label: 'Access Control',  icon: Shield },
  { id: 'tv',              label: 'TV & Streaming',   icon: Tv },
  { id: 'internet',        label: 'Internet',         icon: Wifi },
  { id: 'video_monitoring',label: 'Video Monitoring', icon: Camera },
  { id: 'package_lockers', label: 'Package Lockers',  icon: Package },
  { id: 'smart_locks',     label: 'Smart Locks',      icon: Lock },
  { id: 'security',        label: 'Security',         icon: Shield },
  { id: 'network_mgmt',    label: 'Network',          icon: Network },
  { id: 'energy',          label: 'Energy',           icon: Zap },
]

// ─── Provider Logo ────────────────────────────────────────────────────────────

function ProviderLogo({ providerId, providerName, size = 'md' }: {
  providerId: string
  providerName: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const dims = size === 'sm' ? 32 : size === 'lg' ? 56 : 44
  const textSize = size === 'sm' ? 'text-[9px]' : size === 'lg' ? 'text-sm' : 'text-[11px]'
  const initials = providerName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3)

  // Attempt to load /logos/{provider_id}.png; fallback to styled initials
  return (
    <div
      className="relative shrink-0 rounded-lg overflow-hidden bg-white border border-gray-100 flex items-center justify-center"
      style={{ width: dims, height: dims }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/logos/${providerId}.png`}
        alt={providerName}
        width={dims}
        height={dims}
        className="object-contain w-full h-full p-1"
        onError={e => {
          // Hide img and show fallback
          const target = e.currentTarget as HTMLImageElement
          target.style.display = 'none'
          const fallback = target.nextElementSibling as HTMLElement
          if (fallback) fallback.style.display = 'flex'
        }}
      />
      <div
        className={`absolute inset-0 items-center justify-center font-bold text-white hidden`}
        style={{ background: '#334155' }}
      >
        <span className={textSize}>{initials}</span>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(s: Service): { value: string; per: string } {
  if (s.base_price === 0) return { value: 'FREE', per: '' }
  const p = `$${s.base_price % 1 === 0 ? s.base_price.toFixed(0) : s.base_price.toFixed(2)}`
  if (s.billing_type === 'per_unit')     return { value: p, per: `/${s.unit_label}/mo` }
  if (s.billing_type === 'per_property') return { value: p, per: '/property/mo' }
  if (s.billing_type === 'flat_fee')     return { value: p, per: `/${s.unit_label}/mo` }
  if (s.billing_type === 'per_camera')   return { value: p, per: '/camera/mo' }
  if (s.billing_type === 'per_device')   return { value: p, per: '/device/mo' }
  return { value: p, per: '/mo' }
}

function commissionLabel(s: Service) {
  if (s.dealer_commission_pct === 0) return 'Install margin'
  return `${s.dealer_commission_pct}% commission`
}

function mrrEstimate(s: Service, units: number) {
  return s.base_price * units * (s.dealer_commission_pct / 100)
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [category,  setCategory]  = useState<Category>('all')
  const [search,    setSearch]    = useState('')
  const [detail,    setDetail]    = useState<Service | null>(null)
  const [calcUnits, setCalcUnits] = useState(50)
  const [enrolled,  setEnrolled]  = useState<Set<string>>(new Set(['ac-1', 'net-1']))

  const filtered = useMemo(() => CATALOG.filter(s => {
    if (category !== 'all' && s.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      if (!s.name.toLowerCase().includes(q) && !s.provider.toLowerCase().includes(q) && !s.description.toLowerCase().includes(q)) return false
    }
    return true
  }), [category, search])

  const featured        = CATALOG.filter(s => s.is_featured)
  const enrolledSvcs    = CATALOG.filter(s => enrolled.has(s.id))
  const totalMRR        = enrolledSvcs.reduce((sum, s) => sum + mrrEstimate(s, calcUnits), 0)

  function toggleEnroll(id: string) {
    setEnrolled(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">

      {/* ── Left nav ───────────────────────────────────────────────────────── */}
      <aside className="w-[220px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">

        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-[13px] font-bold text-gray-900 tracking-tight">Service Marketplace</h1>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">Add recurring revenue to every property.</p>
        </div>

        <nav className="flex-1 py-3 px-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-2">Categories</p>
          {CATEGORIES.map(c => {
            const count = c.id === 'all' ? CATALOG.length : CATALOG.filter(s => s.category === c.id).length
            const Icon = c.icon
            const active = category === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left mb-0.5 transition-all group ${
                  active ? 'bg-[#6B7EFF]/8 text-[#6B7EFF]' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={13} className={`shrink-0 ${active ? 'text-[#6B7EFF]' : 'text-gray-400 group-hover:text-gray-600'}`} />
                <span className={`flex-1 text-[12px] font-medium truncate`}>{c.label}</span>
                <span className={`text-[10px] font-semibold tabular-nums min-w-[18px] text-center px-1 py-0.5 rounded ${
                  active ? 'text-[#6B7EFF]' : 'text-gray-400'
                }`}>{count}</span>
              </button>
            )
          })}
        </nav>

        {/* MRR Estimator */}
        <div className="mx-3 mb-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">MRR Estimator</p>
          <div className="mb-3">
            <label className="text-[11px] text-gray-500 block mb-1">Units per property</label>
            <input
              type="number"
              value={calcUnits}
              onChange={e => setCalcUnits(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-8 border border-gray-200 rounded-lg px-3 text-sm font-mono bg-white focus:outline-none focus:ring-1 focus:ring-[#6B7EFF]/40 transition"
            />
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="text-xl font-bold text-[#6B7EFF] tabular-nums">${totalMRR.toFixed(0)}<span className="text-xs font-normal text-gray-400">/mo</span></div>
            <div className="text-[10px] text-gray-400 mt-0.5">{enrolled.size} service{enrolled.size !== 1 ? 's' : ''} enrolled</div>
            {enrolled.size > 0 && (
              <div className="mt-1.5 text-[11px] text-emerald-600 font-semibold">${(totalMRR * 12).toFixed(0)}/yr est. commission</div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Header bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-3.5 flex items-center gap-4 shrink-0">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search services or providers…"
              className="w-full h-8 pl-8 pr-8 border border-gray-200 rounded-lg text-[12px] bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/25 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <span className="text-[12px] text-gray-500">
            <span className="font-semibold text-gray-800">{filtered.length}</span> service{filtered.length !== 1 ? 's' : ''}
            {category !== 'all' && <> in <span className="font-semibold text-gray-800">{CATEGORIES.find(c => c.id === category)?.label}</span></>}
          </span>

          {enrolled.size > 0 && (
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" />
              {enrolled.size} enrolled
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Featured */}
          {category === 'all' && !search && (
            <section className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                <span className="text-[12px] font-semibold text-gray-700">Featured — Highest Earning</span>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {featured.map(s => {
                  const { value, per } = formatPrice(s)
                  return (
                    <button
                      key={s.id}
                      onClick={() => setDetail(s)}
                      className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-[#6B7EFF]/40 hover:shadow-sm transition-all group relative overflow-hidden"
                    >
                      {enrolled.has(s.id) && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-400" title="Enrolled" />
                      )}
                      <div className="flex items-center gap-3 mb-3">
                        <ProviderLogo providerId={s.provider_id} providerName={s.provider} size="sm" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-gray-900 leading-tight truncate">{s.name}</p>
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">{s.provider}</p>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-gray-900 tabular-nums">
                        {value}<span className="text-[10px] font-normal text-gray-400">{per}</span>
                      </div>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{commissionLabel(s)}</div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Divider */}
          {category === 'all' && !search && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[11px] font-semibold text-gray-500">All Services</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
          )}

          {/* Grid */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(s => (
                <ServiceCard
                  key={s.id}
                  service={s}
                  enrolled={enrolled.has(s.id)}
                  calcUnits={calcUnits}
                  onEnroll={() => toggleEnroll(s.id)}
                  onDetail={() => setDetail(s)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Search className="w-8 h-8 mb-3 opacity-30" />
              <p className="font-semibold text-gray-600 mb-1">No services found</p>
              <p className="text-sm">Try a different category or clear your search.</p>
            </div>
          )}

          {/* Enrolled table */}
          {enrolled.size > 0 && (
            <section className="mt-8">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-[12px] font-semibold text-gray-700">Enrolled Services ({enrolled.size})</span>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Service</th>
                      <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Provider</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rate</th>
                      <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Commission</th>
                      <th className="text-right px-5 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Est. MRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolledSvcs.map((s, i) => {
                      const { value, per } = formatPrice(s)
                      return (
                        <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${i < enrolledSvcs.length - 1 ? 'border-b border-gray-100' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <ProviderLogo providerId={s.provider_id} providerName={s.provider} size="sm" />
                              <span className="font-semibold text-gray-900">{s.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-gray-500 hidden md:table-cell">{s.provider}</td>
                          <td className="px-4 py-3.5 text-right font-mono text-gray-700">{value}{per}</td>
                          <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              {s.dealer_commission_pct > 0 ? `${s.dealer_commission_pct}%` : 'Install margin'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-bold text-[#6B7EFF] tabular-nums">
                            ${mrrEstimate(s, calcUnits).toFixed(0)}/mo
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-[#6B7EFF]/5 border-t-2 border-[#6B7EFF]/20">
                      <td colSpan={4} className="px-5 py-3.5 font-bold text-[#6B7EFF]">Total @ {calcUnits} units/property</td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-[#6B7EFF] text-sm tabular-nums">${totalMRR.toFixed(0)}/mo</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-gray-400">Estimates based on {calcUnits} units per property. Actual commission depends on enrolled property count.</p>
            </section>
          )}
        </div>
      </main>

      {/* Detail panel */}
      {detail && (
        <ServiceDetail
          service={detail}
          enrolled={enrolled.has(detail.id)}
          calcUnits={calcUnits}
          onClose={() => setDetail(null)}
          onEnroll={() => toggleEnroll(detail.id)}
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
  const { value, per } = formatPrice(s)
  const estMRR = mrrEstimate(s, calcUnits)

  return (
    <div className={`bg-white border rounded-xl flex flex-col transition-all hover:shadow-sm ${
      enrolled ? 'border-emerald-200' : 'border-gray-200 hover:border-gray-300'
    }`}>
      {/* Card header */}
      <div className="px-5 pt-4 pb-3 flex items-start gap-3 border-b border-gray-100">
        <ProviderLogo providerId={s.provider_id} providerName={s.provider} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-bold text-gray-900 leading-tight">{s.name}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.provider}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              {s.is_featured && (
                <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
              )}
              <CategoryPill cat={s.category} />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-3 flex-1">
        <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{s.description}</p>
      </div>

      {/* Pricing */}
      <div className="px-5 pb-3">
        <div className="bg-gray-50 rounded-lg px-4 py-3 flex items-center justify-between gap-2">
          <div>
            <div className="text-base font-bold text-gray-900 tabular-nums leading-tight">
              {value}<span className="text-[10px] font-normal text-gray-400">{per}</span>
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">{s.contract_months}mo · min {s.min_units} {s.unit_label}{s.min_units !== 1 ? 's' : ''}</div>
          </div>
          <div className="text-right">
            {s.dealer_commission_pct > 0 ? (
              <>
                <div className="text-[11px] font-bold text-emerald-600">{s.dealer_commission_pct}%</div>
                <div className="text-[10px] text-gray-400">≈ ${estMRR.toFixed(0)}/mo</div>
              </>
            ) : (
              <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Install margin</span>
            )}
          </div>
        </div>
      </div>

      {/* Enrollment required banner */}
      {s.requires_enrollment && !enrolled && (
        <div className="mx-5 mb-3 flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          <AlertCircle className="w-3 h-3 shrink-0" />
          Requires provider enrollment
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-4 flex gap-2">
        <button
          onClick={onEnroll}
          className={`flex-1 h-8 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors border ${
            enrolled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              : 'bg-[#6B7EFF] border-[#6B7EFF] text-white hover:bg-[#5a6ee8]'
          }`}
        >
          {enrolled ? (
            <><CheckCircle2 className="w-3 h-3" /> Enrolled</>
          ) : (
            <><Plus className="w-3 h-3" /> Enroll</>
          )}
        </button>
        <button
          onClick={onDetail}
          className="w-8 h-8 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 flex items-center justify-center transition-colors shrink-0"
          title="Details"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Category Pill ────────────────────────────────────────────────────────────

const CAT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  tv:               { bg: 'bg-sky-50',     text: 'text-sky-600',     label: 'TV' },
  internet:         { bg: 'bg-blue-50',    text: 'text-blue-600',    label: 'Internet' },
  video_monitoring: { bg: 'bg-violet-50',  text: 'text-violet-600',  label: 'Video' },
  package_lockers:  { bg: 'bg-orange-50',  text: 'text-orange-600',  label: 'Lockers' },
  access_control:   { bg: 'bg-indigo-50',  text: 'text-indigo-600',  label: 'Access' },
  smart_locks:      { bg: 'bg-cyan-50',    text: 'text-cyan-600',    label: 'Locks' },
  security:         { bg: 'bg-red-50',     text: 'text-red-600',     label: 'Security' },
  network_mgmt:     { bg: 'bg-teal-50',    text: 'text-teal-600',    label: 'Network' },
  energy:           { bg: 'bg-amber-50',   text: 'text-amber-600',   label: 'Energy' },
}

function CategoryPill({ cat }: { cat: string }) {
  const s = CAT_STYLES[cat] ?? { bg: 'bg-gray-50', text: 'text-gray-600', label: cat }
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

// ─── Detail Slide-Over ────────────────────────────────────────────────────────

function ServiceDetail({ service: s, enrolled, calcUnits, onClose, onEnroll }: {
  service:   Service
  enrolled:  boolean
  calcUnits: number
  onClose:   () => void
  onEnroll:  () => void
}) {
  const { value, per } = formatPrice(s)
  const estMRR = mrrEstimate(s, calcUnits)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-md h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-start gap-4">
          <ProviderLogo providerId={s.provider_id} providerName={s.provider} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-gray-900 leading-tight">{s.name}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{s.provider}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <CategoryPill cat={s.category} />
              {s.is_featured && (
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">Featured</span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-5 space-y-5">
          <p className="text-sm text-gray-600 leading-relaxed">{s.description}</p>

          {/* Pricing summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Dealer Rate</p>
              <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
              <p className="text-[10px] text-gray-400">{per}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Commission</p>
              <p className="text-xl font-bold text-emerald-700 tabular-nums">
                {s.dealer_commission_pct > 0 ? `${s.dealer_commission_pct}%` : '—'}
              </p>
              <p className="text-[10px] text-emerald-600">≈ ${estMRR.toFixed(0)}/mo @ {calcUnits}u</p>
            </div>
          </div>

          {/* Details table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {[
              ['Contract', `${s.contract_months} months`],
              ['Minimum', `${s.min_units} ${s.unit_label}${s.min_units !== 1 ? 's' : ''}`],
              ['Billing', s.billing_type.replace('_', ' ')],
              ['GateGuard Margin', `${s.gg_commission_pct}%`],
              ['Enrollment Required', s.requires_enrollment ? 'Yes' : 'No'],
            ].map(([label, val], i) => (
              <div key={label} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <span className="text-[11px] text-gray-500 font-medium">{label}</span>
                <span className="text-[11px] font-semibold text-gray-800">{val}</span>
              </div>
            ))}
          </div>

          {/* Notes */}
          {s.notes && (
            <div className="flex items-start gap-2.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-800">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{s.notes}</p>
            </div>
          )}

          {s.enrollment_url && (
            <a
              href={s.enrollment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-[#6B7EFF] font-semibold hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Open provider enrollment
            </a>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onEnroll}
            className={`flex-1 h-9 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition-colors ${
              enrolled
                ? 'bg-white border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                : 'bg-[#6B7EFF] text-white hover:bg-[#5a6ee8]'
            }`}
          >
            {enrolled ? <><CheckCircle2 className="w-4 h-4" /> Enrolled</> : <><Plus className="w-4 h-4" /> Enroll Now</>}
          </button>
          <button onClick={onClose} className="px-4 h-9 rounded-xl border border-gray-200 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
