'use client'

import { useState } from 'react'
import { TrendingUp, Building2, Wifi, Wrench, ChevronDown, Activity } from 'lucide-react'

const { BarChart3, LineChart, PieChart, Target } = require('lucide-react') as any

/* ─── Types ──────────────────────────────────────────────────── */
type DateRange = '30d' | '90d' | '12mo'

/* ─── Shimmer / placeholder chart ───────────────────────────── */
function ChartPlaceholder({ title, icon: Icon, height = 'h-48' }: {
  title: string
  icon: React.ElementType
  height?: string
}) {
  return (
    <div className={`border border-border rounded-xl bg-card p-4 flex flex-col gap-3`}>
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-brand-400" />
        <span className="font-semibold text-sm text-slate-700">{title}</span>
      </div>
      <div className={`relative ${height} rounded-lg overflow-hidden bg-slate-50 flex items-center justify-center`}>
        {/* Shimmer bars */}
        <div className="absolute inset-0 flex items-end gap-2 px-4 pb-4 opacity-20">
          {[65, 40, 75, 55, 85, 45, 70, 60, 80, 50, 90, 65].map((h, i) => (
            <div
              key={i}
              className="flex-1 bg-brand-400 rounded-t-sm animate-pulse"
              style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        {/* Overlay label */}
        <div className="relative z-10 flex flex-col items-center gap-2 bg-white/90 border border-slate-200 rounded-xl px-6 py-3 shadow-sm">
          <Activity size={18} className="text-brand-400" />
          <span className="text-xs font-semibold text-slate-600">Live data coming soon</span>
          <span className="text-[10px] text-slate-400 text-center">Connect your data sources to<br />see real-time analytics here</span>
        </div>
      </div>
    </div>
  )
}

/* ─── KPI card ───────────────────────────────────────────────── */
function KpiCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  color: string
  trend?: string
}) {
  return (
    <div className="border border-border rounded-xl bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-slate-400">{sub}</p>
        {trend && (
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

/* ─── Main page ──────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>('30d')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const DATE_RANGE_LABELS: Record<DateRange, string> = {
    '30d':  'Last 30 days',
    '90d':  'Last 90 days',
    '12mo': 'Last 12 months',
  }

  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <BarChart3 size={24} className="text-brand-400" />
            Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Business performance, property health, and tech efficiency metrics
          </p>
        </div>

        {/* Date range selector */}
        <div className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen(o => !o)}
            className="flex items-center gap-2 px-4 py-2 h-9 border border-slate-200 bg-white rounded-lg text-sm font-medium text-slate-700 hover:border-brand-400 transition-colors"
          >
            {DATE_RANGE_LABELS[dateRange]}
            <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
              {(Object.entries(DATE_RANGE_LABELS) as [DateRange, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setDateRange(key); setDropdownOpen(false) }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-slate-50 ${
                    dateRange === key ? 'text-brand-400 font-semibold' : 'text-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total MRR"
          value="$—"
          sub="Monthly recurring revenue"
          icon={TrendingUp}
          color="bg-brand-400"
          trend="Live soon"
        />
        <KpiCard
          label="Active Properties"
          value="—"
          sub="Installed & monitored sites"
          icon={Building2}
          color="bg-emerald-500"
        />
        <KpiCard
          label="Gate Uptime"
          value="—%"
          sub="Across all managed gates"
          icon={Wifi}
          color="bg-sky-500"
        />
        <KpiCard
          label="Open Work Orders"
          value="—"
          sub="Pending service items"
          icon={Wrench}
          color="bg-amber-500"
        />
      </div>

      {/* ── Chart placeholders — top row ──────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="MRR Trend" icon={LineChart} height="h-56" />
        <ChartPlaceholder title="Work Order Volume" icon={BarChart3} height="h-56" />
      </div>

      {/* ── Chart placeholders — bottom row ───────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartPlaceholder title="Property Health Distribution" icon={PieChart} height="h-48" />
        <ChartPlaceholder title="Tech Performance (FCR Rate)" icon={Target} height="h-48" />
      </div>

      {/* ── Coming soon banner ────────────────────────────────── */}
      <div className="border border-brand-200 bg-brand-50 rounded-xl p-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center shrink-0 mt-0.5">
          <Activity size={16} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-brand-800 text-sm">Analytics engine under construction</p>
          <p className="text-xs text-brand-600 mt-0.5">
            Live data pipelines for MRR, uptime, and tech performance are being wired to your Supabase tables.
            Charts will populate automatically once connected. No action required.
          </p>
        </div>
      </div>

    </div>
  )
}
