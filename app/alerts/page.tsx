'use client'

import { useState } from 'react'
import {
  Bell, AlertTriangle, Info, CheckCircle2, Building2,
  Wifi, WifiOff, Clock, ArrowRight, Filter, Wrench, Shield,
} from 'lucide-react'

const { AlertOctagon, Flame, FileWarning, UserPlus, Star } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type AlertSeverity = 'critical' | 'warning' | 'info'
type TabKey = 'all' | AlertSeverity
type AlertCategory = 'gate' | 'permit' | 'work_order' | 'lead' | 'camera' | 'compliance' | 'billing'

interface GGAlert {
  id: string
  severity: AlertSeverity
  category: AlertCategory
  message: string
  property: string
  timeAgo: string
  read: boolean
  href: string
}

/* ─── Config ─────────────────────────────────────────────────── */
const SEVERITY_CONFIG: Record<AlertSeverity, { bar: string; icon: React.ElementType; iconColor: string; label: string }> = {
  critical: { bar: 'bg-red-500',   icon: AlertOctagon, iconColor: 'text-red-500',   label: 'Critical' },
  warning:  { bar: 'bg-amber-400', icon: AlertTriangle, iconColor: 'text-amber-500', label: 'Warning'  },
  info:     { bar: 'bg-blue-400',  icon: Info,         iconColor: 'text-blue-500',  label: 'Info'     },
}

const CATEGORY_ICONS: Record<AlertCategory, React.ElementType> = {
  gate:        WifiOff,
  permit:      FileWarning,
  work_order:  Wrench,
  lead:        UserPlus,
  camera:      Shield,
  compliance:  Flame,
  billing:     Star,
}

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all',      label: 'All'      },
  { key: 'critical', label: 'Critical' },
  { key: 'warning',  label: 'Warnings' },
  { key: 'info',     label: 'Info'     },
]

/* ─── Demo alerts ────────────────────────────────────────────── */
const DEMO_ALERTS: GGAlert[] = [
  {
    id: 'a1',
    severity: 'critical',
    category: 'gate',
    message: 'Main vehicle gate offline — East Ponce Village. No response from controller since 7:42 AM.',
    property: 'East Ponce Village',
    timeAgo: '18 min ago',
    read: false,
    href: '/sites',
  },
  {
    id: 'a2',
    severity: 'critical',
    category: 'camera',
    message: '2 cameras offline — Stonegate Preserve. PoE switch port 4 and 7 not responding.',
    property: 'Stonegate Preserve',
    timeAgo: '1 hr ago',
    read: false,
    href: '/cameras',
  },
  {
    id: 'a3',
    severity: 'warning',
    category: 'permit',
    message: 'Gate operator permit expiring in 12 days — Vinings Place. Renewal required before Jun 1.',
    property: 'Vinings Place',
    timeAgo: '3 hr ago',
    read: false,
    href: '/compliance',
  },
  {
    id: 'a4',
    severity: 'warning',
    category: 'work_order',
    message: 'Work order WO-2841 is 3 days overdue — The Canopy at Buckhead. Assigned to Jake R.',
    property: 'The Canopy at Buckhead',
    timeAgo: '5 hr ago',
    read: false,
    href: '/maintenance',
  },
  {
    id: 'a5',
    severity: 'warning',
    category: 'compliance',
    message: 'UL 325 certification renewal due in 30 days — Peachtree Commons. Upload renewed cert.',
    property: 'Peachtree Commons',
    timeAgo: '6 hr ago',
    read: true,
    href: '/compliance',
  },
  {
    id: 'a6',
    severity: 'info',
    category: 'lead',
    message: 'New lead submitted — Broadstone at the Boro, 312 units. Assigned to ARIA for outreach.',
    property: 'Broadstone at the Boro',
    timeAgo: '2 hr ago',
    read: true,
    href: '/crm/leads',
  },
  {
    id: 'a7',
    severity: 'info',
    category: 'lead',
    message: 'Quote GG-Q-00092 was viewed 3 times — The Reserve at Hamilton Mill. No response yet.',
    property: 'The Reserve at Hamilton Mill',
    timeAgo: '4 hr ago',
    read: true,
    href: '/quotes',
  },
  {
    id: 'a8',
    severity: 'info',
    category: 'billing',
    message: 'Invoice GG-INV-120047 paid — Stonegate Preserve. $3,750 received via ACH.',
    property: 'Stonegate Preserve',
    timeAgo: '1 day ago',
    read: true,
    href: '/billing',
  },
  {
    id: 'a9',
    severity: 'warning',
    category: 'permit',
    message: 'Fire marshal inspection overdue — Vinings Place. Last completed Apr 2025.',
    property: 'Vinings Place',
    timeAgo: '1 day ago',
    read: true,
    href: '/compliance',
  },
  {
    id: 'a10',
    severity: 'info',
    category: 'work_order',
    message: 'Work order WO-2847 marked complete — East Ponce Village. Loop detector replaced.',
    property: 'East Ponce Village',
    timeAgo: '2 days ago',
    read: true,
    href: '/maintenance',
  },
]

/* ─── Alert row ──────────────────────────────────────────────── */
function AlertRow({ alert, onMarkRead }: { alert: GGAlert; onMarkRead: (id: string) => void }) {
  const sevCfg  = SEVERITY_CONFIG[alert.severity]
  const CatIcon = CATEGORY_ICONS[alert.category]
  const SevIcon = sevCfg.icon

  return (
    <div className={`flex items-start gap-0 border-b border-slate-100 last:border-0 transition-colors ${alert.read ? '' : 'bg-blue-50/40'}`}>
      {/* Severity bar */}
      <div className={`w-1 self-stretch rounded-l-xl shrink-0 ${sevCfg.bar}`} />

      {/* Main content */}
      <div className="flex-1 flex items-start gap-3 px-4 py-3.5">
        {/* Icon */}
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
          <CatIcon size={14} className="text-slate-500" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          {!alert.read && (
            <span className="inline-block w-2 h-2 rounded-full bg-brand-400 mb-1 align-middle mr-1" />
          )}
          <p className="text-sm text-slate-800 leading-snug">{alert.message}</p>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Building2 size={10} />
              {alert.property}
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={10} />
              {alert.timeAgo}
            </div>
            <span className={`text-xs font-semibold ${sevCfg.iconColor}`}>
              {sevCfg.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!alert.read && (
            <button
              onClick={() => onMarkRead(alert.id)}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors whitespace-nowrap"
            >
              Mark read
            </button>
          )}
          <a
            href={alert.href}
            className="flex items-center gap-1 text-xs font-semibold text-brand-400 hover:text-brand-500 transition-colors whitespace-nowrap"
          >
            View <ArrowRight size={11} />
          </a>
        </div>
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [alerts, setAlerts]       = useState(DEMO_ALERTS)

  const markAllRead = () => setAlerts(prev => prev.map(a => ({ ...a, read: true })))
  const markRead    = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a))

  const filtered = alerts.filter(a =>
    activeTab === 'all' ? true : a.severity === activeTab
  )

  const unreadCount = alerts.filter(a => !a.read).length
  const tabCount    = (key: TabKey) =>
    key === 'all' ? alerts.length : alerts.filter(a => a.severity === key).length

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Bell size={24} className="text-brand-400" />
            Alerts
            {unreadCount > 0 && (
              <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Gate events, permit expirations, overdue work orders, and new leads
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 h-9 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-600 hover:border-brand-400 hover:text-brand-400 transition-colors shrink-0"
          >
            <CheckCircle2 size={14} /> Mark all read
          </button>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-0.5 border-b border-slate-200">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-brand-400 text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              activeTab === tab.key ? 'bg-brand-100 text-brand-600' : 'bg-slate-100 text-slate-500'
            }`}>
              {tabCount(tab.key)}
            </span>
          </button>
        ))}
      </div>

      {/* ── Alert list ────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle2 size={40} className="text-emerald-400 mb-4 opacity-50" />
          <p className="font-semibold text-slate-700 text-lg">All clear</p>
          <p className="text-sm text-slate-400 mt-1">No {activeTab === 'all' ? '' : activeTab + ' '}alerts at this time</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filtered.map(alert => (
            <AlertRow key={alert.id} alert={alert} onMarkRead={markRead} />
          ))}
        </div>
      )}
    </div>
  )
}
