'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import {
  Plus, X, Check, ChevronDown, Users, Calendar,
  Trash2, AlertTriangle, ExternalLink, CheckCircle2,
  Layers, ClipboardList,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { GitBranch, HardHat, FlaskConical, Rocket, Beaker, Cpu, Globe2, Pencil } = require('lucide-react') as any

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StepDef {
  id: string
  title: string
  description: string
  required: boolean
}

interface StepProgress {
  done: boolean
  done_by?: string
  done_at?: string
  notes?: string
}

interface PlaybookRun {
  id: string
  type: 'site_job' | 'dev_rd'
  name: string
  phase?: string
  status: string
  assignee?: string
  due_date?: string
  completed_at?: string
  project_name?: string
  project_repo?: string
  template_id?: string
  step_progress: Record<string, StepProgress>
  notes?: string
  created_at: string
  updated_at: string
}

interface PlaybookTemplate {
  id: string
  type: 'site_job' | 'dev_rd'
  name: string
  description: string
  category: string
  steps: StepDef[]
  is_system: boolean
}

// ─── Demo data (fallback when DB is empty) ────────────────────────────────────

const DEMO_SITE_RUNS: PlaybookRun[] = [
  {
    id: 'demo-1', type: 'site_job', name: 'Sunset Commons Pre-Launch',
    status: 'active', assignee: 'Russel Feldman',
    due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    template_id: '10000000-0000-0000-0000-000000000001',
    step_progress: { s1: { done: true, done_by: 'Russel', done_at: new Date().toISOString() }, s2: { done: true, done_by: 'Russel', done_at: new Date().toISOString() }, s3: { done: false }, s4: { done: false }, s5: { done: false }, s6: { done: false }, s7: { done: false } },
    notes: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-2', type: 'site_job', name: 'Riverview Apts Hardware Upgrade',
    status: 'active', assignee: 'Nicole Gagliardi',
    due_date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
    template_id: '10000000-0000-0000-0000-000000000002',
    step_progress: { h1: { done: true, done_by: 'Nicole', done_at: new Date().toISOString() }, h2: { done: true, done_by: 'Nicole', done_at: new Date().toISOString() }, h3: { done: true, done_by: 'Nicole', done_at: new Date().toISOString() }, h4: { done: false }, h5: { done: false }, h6: { done: false }, h7: { done: false }, h8: { done: false } },
    notes: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-3', type: 'site_job', name: 'Atlanta Pines Dealer Onboarding',
    status: 'completed', assignee: 'Russel Feldman',
    due_date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    completed_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    template_id: '10000000-0000-0000-0000-000000000003',
    step_progress: { d1: { done: true }, d2: { done: true }, d3: { done: true }, d4: { done: true }, d5: { done: true }, d6: { done: true } },
    notes: '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

const DEMO_DEV_RUNS: PlaybookRun[] = [
  {
    id: 'demo-d1', type: 'dev_rd', name: 'GateGuard Nexus Portal',
    phase: 'production', status: 'active',
    project_name: 'GateGuard Nexus Portal', project_repo: 'https://github.com/GateGuardCo/gateguard-portal',
    assignee: 'Russel Feldman',
    step_progress: { f1: { done: true }, f2: { done: true }, f3: { done: true }, f4: { done: true }, f5: { done: true }, f6: { done: true }, f7: { done: true }, f8: { done: true } },
    notes: 'Live at portal.gateguard.co',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-d2', type: 'dev_rd', name: 'gatecard.co',
    phase: 'beta', status: 'active',
    project_name: 'gatecard.co', project_repo: 'https://github.com/GateGuardCo/gatecard.co',
    assignee: 'Russel Feldman',
    step_progress: { g1: { done: true }, g2: { done: true }, g3: { done: true }, g4: { done: true }, g5: { done: true }, g6: { done: true }, g7: { done: false }, g8: { done: false } },
    notes: 'Visitor mgmt + resident sync platform',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-d3', type: 'dev_rd', name: 'TRINITY Voice AI',
    phase: 'beta', status: 'active',
    project_name: 'TRINITY Voice AI', project_repo: '',
    assignee: 'Russel Feldman',
    step_progress: { f1: { done: true }, f2: { done: true }, f3: { done: true }, f4: { done: true }, f5: { done: true }, f6: { done: false }, f7: { done: false }, f8: { done: false } },
    notes: 'Twilio + Claude + ElevenLabs voice agent',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-d4', type: 'dev_rd', name: 'ARIA Lead Intelligence',
    phase: 'beta', status: 'active',
    project_name: 'ARIA Lead Intelligence', project_repo: '',
    assignee: 'Russel Feldman',
    step_progress: { f1: { done: true }, f2: { done: true }, f3: { done: true }, f4: { done: true }, f5: { done: true }, f6: { done: true }, f7: { done: false }, f8: { done: false } },
    notes: 'AI outreach with Tavily web research',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-d5', type: 'dev_rd', name: 'Raspberry Pi Brivo↔UniFi Sync',
    phase: 'alpha', status: 'active',
    project_name: 'Raspberry Pi Brivo↔UniFi Sync', project_repo: '',
    assignee: 'Russel Feldman',
    step_progress: { f1: { done: true }, f2: { done: true }, f3: { done: false }, f4: { done: false }, f5: { done: false }, f6: { done: false }, f7: { done: false }, f8: { done: false } },
    notes: 'Hardware sync device: Brivo access → UniFi VLAN provisioning',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-d6', type: 'dev_rd', name: 'LPR Integration',
    phase: 'r_and_d', status: 'active',
    project_name: 'LPR Integration', project_repo: '',
    assignee: 'Russel Feldman',
    step_progress: { f1: { done: false }, f2: { done: false }, f3: { done: false }, f4: { done: false }, f5: { done: false }, f6: { done: false }, f7: { done: false }, f8: { done: false } },
    notes: 'Eagle Eye LPR → Brivo credential or gate relay trigger',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'demo-d7', type: 'dev_rd', name: 'Digital Twin',
    phase: 'r_and_d', status: 'active',
    project_name: 'Digital Twin', project_repo: '',
    assignee: 'Russel Feldman',
    step_progress: { f1: { done: false }, f2: { done: false }, f3: { done: false }, f4: { done: false }, f5: { done: false }, f6: { done: false }, f7: { done: false }, f8: { done: false } },
    notes: 'Real-time 3D property twin from floor plan + live device telemetry',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

const SITE_JOB_TEMPLATE_STEPS: Record<string, StepDef[]> = {
  '10000000-0000-0000-0000-000000000001': [
    { id: 's1', title: 'Run Supabase migrations on beta', description: 'Confirm all pending migrations are applied and smoke-tested on beta Supabase project', required: true },
    { id: 's2', title: 'Verify Vercel env vars', description: 'Check all required env vars are set in Vercel project (SUPABASE, CLERK, ANTHROPIC, MAPBOX, etc.)', required: true },
    { id: 's3', title: 'Smoke test all portal flows', description: 'Test login, WO creation, camera feed, access control, and tech tool PIN', required: true },
    { id: 's4', title: 'Configure site in portal', description: 'Create site record, assign org, set billing rates (video fee + per-unit rate)', required: true },
    { id: 's5', title: 'Send PM portal invite', description: 'Create client user in Clerk with client role, send welcome email', required: true },
    { id: 's6', title: 'Deliver as-built documentation', description: 'Upload final as-built PDF to site record in /design/as-builts', required: false },
    { id: 's7', title: 'Schedule 30-day follow-up', description: 'Add follow-up To-Do in /eos for 30 days post-launch', required: false },
  ],
  '10000000-0000-0000-0000-000000000002': [
    { id: 'h1', title: 'Site survey complete', description: 'Use /tech Site Survey to inventory all existing devices and document conditions', required: true },
    { id: 'h2', title: 'Parts ordered and confirmed', description: 'Verify all required parts are in inventory or PO is created', required: true },
    { id: 'h3', title: 'PM notified of install window', description: 'Send outage/access notice to property manager at least 48 hours in advance', required: true },
    { id: 'h4', title: 'Install day checklist complete', description: 'All new devices powered, wired, and tested per wiring guide', required: true },
    { id: 'h5', title: 'Brivo and UniFi updated', description: 'New devices registered in Brivo ACS and UniFi network', required: true },
    { id: 'h6', title: 'Camera feeds verified', description: 'All camera feeds visible in Eagle Eye dashboard', required: false },
    { id: 'h7', title: 'As-built updated', description: 'Floor plan and as-built docs updated in /design to reflect new devices', required: true },
    { id: 'h8', title: 'WO marked completed', description: 'Close work order, attach photos, capture tech resolution note', required: true },
  ],
  '10000000-0000-0000-0000-000000000003': [
    { id: 'd1', title: 'Create org in portal', description: 'Set org tier, commission config, and parent org in /admin/dealers/new', required: true },
    { id: 'd2', title: 'Send NDA + Agreement', description: 'Auto-send via /api/admin/dealers/send-docs — tier determines which NDA version', required: true },
    { id: 'd3', title: 'Confirm docs signed', description: 'Verify e-sign completion via /design/esign before granting portal access', required: true },
    { id: 'd4', title: 'Create Clerk account', description: 'Invite dealer to portal with dealer role scoped to their org', required: true },
    { id: 'd5', title: 'Send welcome email with tech tool code', description: 'Include TECH_ACCESS_CODE, /tech URL, and training course links', required: true },
    { id: 'd6', title: 'Schedule onboarding L10 call', description: 'Book 1-hour walkthrough call within 5 business days of go-live', required: false },
  ],
  '10000000-0000-0000-0000-000000000004': [
    { id: 'pm1', title: 'Gate cycle test', description: 'Run 20 full open/close cycles, check for noise, hesitation, or limit switch drift', required: true },
    { id: 'pm2', title: 'Safety device test', description: 'Test all photobeams, loop detectors, and edge sensors for proper function', required: true },
    { id: 'pm3', title: 'Camera health check', description: 'Verify all Eagle Eye feeds are online and PTZ controls respond', required: true },
    { id: 'pm4', title: 'Brivo credential audit', description: 'Confirm no orphaned credentials; check access log for anomalies', required: true },
    { id: 'pm5', title: 'UniFi network health', description: 'Check uptime, check for offline APs or switches in UniFi dashboard', required: true },
    { id: 'pm6', title: 'Firmware updates', description: 'Apply pending firmware to gate operator, Brivo panels, UniFi devices', required: false },
    { id: 'pm7', title: 'Lubricate mechanical components', description: 'Grease chain, hinges, rollers, and arm pivot per operator spec', required: true },
    { id: 'pm8', title: 'Photo documentation', description: 'Capture before/after photos, attach to WO in portal', required: false },
    { id: 'pm9', title: 'PM report sent to property manager', description: 'Send summary email with findings and any recommended follow-up work', required: true },
  ],
}

const DEV_TEMPLATE_STEPS: Record<string, StepDef[]> = {
  '10000000-0000-0000-0000-000000000005': [
    { id: 'f1', title: 'Add to CLAUDE.md context', description: 'Document the feature intent, file locations, and API routes in the relevant CLAUDE.md', required: true },
    { id: 'f2', title: 'Write Supabase migration', description: 'Schema changes, RLS policies, seed data — numbered sequentially after last migration', required: true },
    { id: 'f3', title: 'Build API routes', description: 'GET, POST, PATCH, DELETE with Clerk auth or x-tech-code as appropriate', required: true },
    { id: 'f4', title: 'Build UI page/component', description: 'Follow portal design system: DataTable, SlideOver, EmptyState, SkeletonRow', required: true },
    { id: 'f5', title: 'Add to Sidebar nav', description: 'Wire route in components/layout/Sidebar.tsx under correct section', required: true },
    { id: 'f6', title: 'Test on beta branch', description: 'Verify against beta Supabase project — run migration on beta first', required: true },
    { id: 'f7', title: 'Update CLAUDE.md What is Live section', description: 'Document what was built, what files changed, for future Claude sessions', required: true },
    { id: 'f8', title: 'Push to main and verify on live', description: 'Final git push, Vercel deploy, smoke test on production', required: true },
  ],
  '10000000-0000-0000-0000-000000000006': [
    { id: 'g1', title: 'Site survey complete', description: 'All devices inventoried via /tech Site Survey, as-built drafted in /design/floor-plans', required: true },
    { id: 'g2', title: 'Create Supabase org and site records', description: 'Seed org, site, and initial device records on gatecard.co Supabase project', required: true },
    { id: 'g3', title: 'Configure Brivo account', description: 'Set up doors, credentials, access schedules, and holiday groups', required: true },
    { id: 'g4', title: 'Configure UniFi network', description: 'VLANs, SSIDs, PoE switches confirmed and all devices adopted', required: true },
    { id: 'g5', title: 'Deploy gatecard.co site slug', description: 'Verify /[site-slug] resolves and loads live data in gatecard.co', required: true },
    { id: 'g6', title: 'Resident import', description: 'Upload resident CSV — Brivo credentials auto-created via sync pipeline', required: true },
    { id: 'g7', title: 'PM walkthrough', description: 'Live demo with property manager: kiosk, visitor management, resident app', required: true },
    { id: 'g8', title: 'Go-live sign-off', description: 'PM confirms acceptance, billing start date set in portal /billing', required: true },
  ],
}

const ALL_TEMPLATE_STEPS = { ...SITE_JOB_TEMPLATE_STEPS, ...DEV_TEMPLATE_STEPS }

const DEMO_TEMPLATES: PlaybookTemplate[] = [
  { id: '10000000-0000-0000-0000-000000000001', type: 'site_job', name: 'New Site Pre-Launch', description: 'Full pre-launch checklist before a new property goes live', category: 'Pre-Launch', is_system: true, steps: SITE_JOB_TEMPLATE_STEPS['10000000-0000-0000-0000-000000000001'] },
  { id: '10000000-0000-0000-0000-000000000002', type: 'site_job', name: 'Hardware Upgrade', description: 'End-to-end checklist for a hardware upgrade or expansion', category: 'Hardware', is_system: true, steps: SITE_JOB_TEMPLATE_STEPS['10000000-0000-0000-0000-000000000002'] },
  { id: '10000000-0000-0000-0000-000000000003', type: 'site_job', name: 'New Dealer Onboarding', description: 'Complete dealer setup from signed agreement to first login', category: 'Onboarding', is_system: true, steps: SITE_JOB_TEMPLATE_STEPS['10000000-0000-0000-0000-000000000003'] },
  { id: '10000000-0000-0000-0000-000000000004', type: 'site_job', name: 'Recurring PM Visit', description: 'Quarterly preventive maintenance checklist', category: 'Maintenance', is_system: true, steps: SITE_JOB_TEMPLATE_STEPS['10000000-0000-0000-0000-000000000004'] },
  { id: '10000000-0000-0000-0000-000000000005', type: 'dev_rd', name: 'New App Feature Sprint', description: 'Standard dev lifecycle for any new portal or gatecard.co feature', category: 'Portal', is_system: true, steps: DEV_TEMPLATE_STEPS['10000000-0000-0000-0000-000000000005'] },
  { id: '10000000-0000-0000-0000-000000000006', type: 'dev_rd', name: 'New Site Platform Build (gatecard.co)', description: 'Full lifecycle for deploying a new multifamily property on gatecard.co', category: 'Site Platform', is_system: true, steps: DEV_TEMPLATE_STEPS['10000000-0000-0000-0000-000000000006'] },
]

// ─── Phase config ──────────────────────────────────────────────────────────────

const PHASES = [
  { key: 'r_and_d',    label: 'R&D',        color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: FlaskConical },
  { key: 'alpha',      label: 'Alpha',       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Beaker },
  { key: 'beta',       label: 'Beta',        color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', icon: GitBranch },
  { key: 'production', label: 'Production',  color: '#059669', bg: '#F0FDF4', border: '#BBF7D0', icon: Rocket },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getStepsForRun(run: PlaybookRun, templates: PlaybookTemplate[]): StepDef[] {
  if (run.template_id) {
    // Check local step map first (for demo data)
    if (ALL_TEMPLATE_STEPS[run.template_id]) return ALL_TEMPLATE_STEPS[run.template_id]
    // Then check loaded templates
    const tmpl = templates.find(t => t.id === run.template_id)
    if (tmpl) return tmpl.steps
  }
  return []
}

function getProgress(run: PlaybookRun, steps: StepDef[]) {
  if (!steps.length) return { done: 0, total: 0, pct: 0 }
  const done  = steps.filter(s => run.step_progress[s.id]?.done).length
  const total = steps.length
  return { done, total, pct: Math.round((done / total) * 100) }
}

function isOverdue(run: PlaybookRun) {
  if (!run.due_date || run.status === 'completed') return false
  return new Date(run.due_date) < new Date()
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_STYLES: Record<string, { label: string; bg: string; color: string }> = {
  active:    { label: 'Active',    bg: '#EFF6FF', color: '#2563EB' },
  completed: { label: 'Completed', bg: '#F0FDF4', color: '#059669' },
  paused:    { label: 'Paused',    bg: '#F8FAFC', color: '#64748B' },
  cancelled: { label: 'Cancelled', bg: '#FEF2F2', color: '#DC2626' },
}

// ─── Step Checklist ────────────────────────────────────────────────────────────

function StepChecklist({
  run, steps, onToggle,
}: {
  run: PlaybookRun
  steps: StepDef[]
  onToggle: (stepId: string, done: boolean) => void
}) {
  const { done, total, pct } = getProgress(run, steps)

  if (!steps.length) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400">
        No steps defined for this playbook.
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : '#6B7EFF' }}
          />
        </div>
        <span className="text-xs text-gray-500 tabular-nums">{done}/{total}</span>
      </div>

      {/* Steps */}
      {steps.map(step => {
        const prog = run.step_progress[step.id]
        const checked = prog?.done ?? false
        return (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer
              ${checked ? 'bg-green-50 border-green-100' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
            onClick={() => onToggle(step.id, !checked)}
          >
            <div className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all
              ${checked ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'}`}
            >
              {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${checked ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                  {step.title}
                </span>
                {step.required && !checked && (
                  <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                    required
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{step.description}</p>
              {checked && prog?.done_at && (
                <p className="text-xs text-green-600 mt-1">
                  Done {fmtDate(prog.done_at)}{prog.done_by ? ` · ${prog.done_by}` : ''}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Site/Job Card ─────────────────────────────────────────────────────────────

function SiteJobCard({
  run, templates, onStepToggle, onDelete,
}: {
  run: PlaybookRun
  templates: PlaybookTemplate[]
  onStepToggle: (runId: string, stepId: string, done: boolean) => void
  onDelete: (runId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const steps = getStepsForRun(run, templates)
  const { done, total, pct } = getProgress(run, steps)
  const overdue = isOverdue(run)
  const st = STATUS_STYLES[run.status] ?? STATUS_STYLES.active

  const categoryLabel = templates.find(t => t.id === run.template_id)?.category ?? ''

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-shadow hover:shadow-sm
      ${run.status === 'completed' ? 'border-green-100' : overdue ? 'border-red-100' : 'border-border'}`}
    >
      {/* Card header */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800 text-sm truncate">{run.name}</span>
              {categoryLabel && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {categoryLabel}
                </span>
              )}
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded"
                style={{ background: st.bg, color: st.color }}
              >
                {st.label}
              </span>
            </div>

            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {run.assignee && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  {run.assignee}
                </div>
              )}
              {run.due_date && (
                <div className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                  <Calendar className="w-3 h-3" />
                  {overdue ? 'Overdue · ' : ''}Due {fmtDate(run.due_date)}
                  {overdue && <AlertTriangle className="w-3 h-3" />}
                </div>
              )}
              <span className="text-xs text-gray-400">{done}/{total} steps</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Mini progress ring */}
            <div className="relative w-10 h-10">
              <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke={pct === 100 ? '#059669' : '#6B7EFF'}
                  strokeWidth="3"
                  strokeDasharray={`${(pct / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-600">
                {pct}%
              </span>
            </div>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Expanded checklist */}
      {expanded && (
        <div className="border-t border-gray-100">
          <StepChecklist
            run={run}
            steps={steps}
            onToggle={(stepId, done) => onStepToggle(run.id, stepId, done)}
          />
          {!run.id.startsWith('demo') && (
            <div className="px-4 pb-4 flex justify-end">
              <button
                onClick={() => onDelete(run.id)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete playbook
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Dev/R&D Card ─────────────────────────────────────────────────────────────

function DevCard({
  run, templates, onStepToggle, onPhaseChange,
}: {
  run: PlaybookRun
  templates: PlaybookTemplate[]
  onStepToggle: (runId: string, stepId: string, done: boolean) => void
  onPhaseChange: (runId: string, phase: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const steps = getStepsForRun(run, templates)
  const { done, total, pct } = getProgress(run, steps)
  const phase = PHASES.find(p => p.key === run.phase) ?? PHASES[0]
  const PhaseIcon = phase.icon

  const nextPhaseIdx = PHASES.findIndex(p => p.key === run.phase)
  const nextPhase   = PHASES[nextPhaseIdx + 1]

  return (
    <div
      className="bg-white rounded-xl border overflow-hidden hover:shadow-sm transition-shadow"
      style={{ borderColor: phase.border }}
    >
      <div className="p-4 cursor-pointer select-none" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-800 text-sm">{run.project_name || run.name}</span>
              {run.project_repo && (
                <a
                  href={run.project_repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-indigo-500 hover:text-indigo-700 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {run.notes && (
              <p className="text-xs text-gray-400 mt-1 truncate">{run.notes}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {run.assignee && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  {run.assignee}
                </div>
              )}
              <span className="text-xs text-gray-400">{done}/{total} steps · {pct}%</span>
            </div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
        </div>

        {/* Progress bar */}
        <div className="mt-3 h-1 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : phase.color }}
          />
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t" style={{ borderColor: phase.border }}>
          <StepChecklist
            run={run}
            steps={steps}
            onToggle={(stepId, done) => onStepToggle(run.id, stepId, done)}
          />
          {nextPhase && !run.id.startsWith('demo') && (
            <div className="px-4 pb-4">
              <button
                onClick={e => { e.stopPropagation(); onPhaseChange(run.id, nextPhase.key) }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Move to {nextPhase.label}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── New Playbook Slide-Over ────────────────────────────────────────────────────

function NewPlaybookSlideOver({
  open, onClose, templates, activeTab, onCreate,
}: {
  open: boolean
  onClose: () => void
  templates: PlaybookTemplate[]
  activeTab: 'site_job' | 'dev_rd' | 'corp_admin'
  onCreate: (run: PlaybookRun) => void
}) {
  const [type, setType] = useState<'site_job' | 'dev_rd'>(activeTab === 'corp_admin' ? 'site_job' : activeTab)
  const [templateId, setTemplateId] = useState('')
  const [name, setName] = useState('')
  const [assignee, setAssignee] = useState('Russel Feldman')
  const [dueDate, setDueDate] = useState('')
  const [projectName, setProjectName] = useState('')
  const [projectRepo, setProjectRepo] = useState('')
  const [phase, setPhase] = useState<string>('r_and_d')
  const [saving, setSaving] = useState(false)

  // auto-fill name from template
  const filteredTemplates = templates.filter(t => t.type === type)

  useEffect(() => { if (activeTab !== 'corp_admin') setType(activeTab) }, [activeTab])
  useEffect(() => {
    if (templateId) {
      const tmpl = templates.find(t => t.id === templateId)
      if (tmpl && !name) setName(tmpl.name)
    }
  }, [templateId, templates, name])

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        type, name, assignee, template_id: templateId || undefined,
        due_date: dueDate || undefined,
      }
      if (type === 'dev_rd') {
        body.project_name = projectName || name
        body.project_repo = projectRepo || undefined
        body.phase = phase
      }

      const res = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (json.run) {
        onCreate(json.run)
        onClose()
      }
    } catch {
      // Optimistic fallback
      const fakeRun: PlaybookRun = {
        id: `local-${Date.now()}`,
        type, name, assignee, template_id: templateId || undefined,
        due_date: dueDate || undefined,
        project_name: type === 'dev_rd' ? (projectName || name) : undefined,
        project_repo: type === 'dev_rd' ? projectRepo : undefined,
        phase: type === 'dev_rd' ? phase : undefined,
        status: 'active',
        step_progress: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      onCreate(fakeRun)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-gray-800">New Playbook</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Type toggle */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Playbook Type</label>
            <div className="flex gap-2">
              {(['site_job', 'dev_rd'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setType(t); setTemplateId('') }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-all
                    ${type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {t === 'site_job' ? 'Site / Job' : 'Dev / R&D'}
                </button>
              ))}
            </div>
          </div>

          {/* Template picker */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Start from template</label>
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Blank playbook</option>
              {filteredTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={type === 'site_job' ? 'e.g. Sunset Commons Pre-Launch' : 'e.g. gatecard.co Sprint 4'}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Dev/R&D extra fields */}
          {type === 'dev_rd' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Project name</label>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="e.g. gatecard.co"
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">GitHub repo URL</label>
                <input
                  type="url"
                  value={projectRepo}
                  onChange={e => setProjectRepo(e.target.value)}
                  placeholder="https://github.com/..."
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Starting phase</label>
                <div className="grid grid-cols-2 gap-2">
                  {PHASES.map(p => {
                    const PIcon = p.icon
                    return (
                      <button
                        key={p.key}
                        onClick={() => setPhase(p.key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all
                          ${phase === p.key ? 'border-2' : 'border-gray-200 hover:bg-gray-50'}`}
                        style={phase === p.key ? { borderColor: p.color, background: p.bg, color: p.color } : {}}
                      >
                        <PIcon className="w-3.5 h-3.5" />
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Assignee */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Assignee</label>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Due date (site_job only) */}
          {type === 'site_job' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-9 px-4 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || saving}
            className="flex-1 h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Creating…' : 'Create Playbook'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

// ─── Corp Admin Tab — static how-to playbooks + tech onboarding ───────────────

const CORP_HOWTOS = [
  {
    id: 'pi',
    icon: '🍓',
    title: 'Set Up Raspberry Pi Middleware',
    desc: 'Configure Pi as local-host programmer for UniFi intercom + door relay bridge',
    steps: [
      'Flash Raspberry Pi OS Lite (64-bit) to SD card using Raspberry Pi Imager',
      'Enable SSH: add empty file named `ssh` to /boot partition before first boot',
      'Connect Pi to property LAN switch — same subnet as UniFi controller',
      'SSH in: `ssh pi@<pi-ip>` (default password: raspberry — change immediately)',
      'Run: `sudo apt update && sudo apt install -y nodejs npm git`',
      'Clone GateGuard Pi middleware: `git clone https://github.com/GateGuardCo/pi-middleware`',
      'Copy `.env.example` → `.env`, fill in UNIFI_HOST, UNIFI_USER, UNIFI_PASS, SITE_ID, BRIVO_API_KEY',
      'Run: `npm install && npm start` — verify webhook endpoint responds on port 3030',
      'Set up PM2 for auto-restart: `npm install -g pm2 && pm2 start app.js --name gatecard && pm2 save`',
      'Test door trigger: `curl -X POST http://<pi-ip>:3030/trigger -d \'{"door_id":"1"}\'`',
      'Register Pi webhook URL in GateGuard Portal under site Integrations tab',
    ],
  },
  {
    id: 'app_property',
    icon: '📱',
    title: 'Set Up App for a Property',
    desc: 'Provision GateCard.co for a new property — resident access, visitor management, kiosk',
    steps: [
      'Create org in portal at /admin/dealers/new — org_tier: client, assign to dealer',
      'Create site at /sites — link to client org, enter full property address',
      'In site detail > Integrations tab — add Eagle Eye account_id + API key',
      'Add Brivo client_id, client_secret, api_key to site Integrations tab',
      'Add UniFi host, credentials, site_id to site Integrations tab',
      'Go to GateCard.co admin — create property (slug = site id from portal)',
      'Invite property manager via Clerk portal invite (role: client)',
      'Test resident QR scan → door open flow end-to-end',
      'Set up visitor kiosk tablet — navigate to gatecard.co/kiosk/<site-slug>',
      'Train property manager on GateCard visitor approval workflow',
    ],
  },
  {
    id: 'brivo',
    icon: '🔐',
    title: 'Brivo API Integration',
    desc: 'Connect a property to Brivo Access Control — credentials, sync, door mapping',
    steps: [
      'Log in to Brivo Developer Portal — developer.brivo.com',
      'Create OAuth2 client application — record client_id + client_secret',
      'Generate API key for the property account',
      'In portal site Integrations tab — enter Brivo client_id, client_secret, api_key',
      'Test auth: GET https://auth.brivo.com/oauth/token with credentials',
      'Fetch site list: GET /v1/api/sites — confirm target property appears',
      'Map Brivo door IDs to GateGuard site asset IDs in site_asset_terminals table',
      'Test credential provision: POST /v1/api/credentials — create mobile credential for test user',
      'Set up webhook in Brivo for door events → GateGuard /api/webhooks/brivo',
      'Verify resident sync: trigger /api/sync/residents → confirm Brivo credentials created',
    ],
  },
  {
    id: 'een',
    icon: '📷',
    title: 'Eagle Eye Networks API',
    desc: 'Connect Eagle Eye cameras — live feeds, motion alerts, GGSOC integration',
    steps: [
      'Log in to Eagle Eye Networks account at login.eagleeyenetworks.com',
      'Go to Account Settings > API Access — create API key',
      'Note Account ID from dashboard top bar',
      'In portal site Integrations tab — enter EEN api_key and account_id',
      'Test auth: GET https://rest.eagleeyenetworks.com/g/device/list?auth_key=<api_key>',
      'Fetch camera list — map camera ESNs to GateGuard site asset IDs',
      'Set up motion alert webhook → GateGuard /api/webhooks/een for incident creation',
      'In GGSOC admin — link EEN account to SOC property for live feed access',
      'Test live feed: confirm camera streams appear in /cameras portal page',
      'Test incident: trigger motion alert → confirm incident appears in /incidents',
    ],
  },
  {
    id: 'unifi',
    icon: '🌐',
    title: 'UniFi Network API',
    desc: 'Connect UniFi controller — network monitoring, intercom, VLAN management',
    steps: [
      'Log in to UniFi Network controller (local IP or unifi.ui.com)',
      'Create local admin user for API access — Settings > Admins',
      'Note controller host IP, admin username/password, site name',
      'In portal site Integrations tab — enter UniFi host, username, password, site_id',
      'Test API: curl -X POST https://<host>:8443/api/login -d \'{"username":"...","password":"..."}\'',
      'Test device list: GET https://<host>:8443/api/s/<site>/stat/device',
      'For G3 Intercom: set webhook in UniFi to POST to Pi middleware on doorbell press',
      'Map UniFi device MAC addresses to site_assets in portal',
      'Configure VLAN rules in UniFi for IoT network isolation (cameras on VLAN 20, access on VLAN 30)',
      'Verify network stats appear in /network portal page for this site',
    ],
  },
  {
    id: 'new_api',
    icon: '🔌',
    title: 'Adding a New API Integration',
    desc: 'Template for onboarding any new vendor API to GateGuard',
    steps: [
      'Create `lib/<vendor>.ts` helper file (auth, fetch device list, trigger action)',
      'Add credentials schema to org api_credentials JSONB (migration if new fields needed)',
      'Create /api/webhooks/<vendor>/route.ts for inbound events',
      'Add vendor to site Integrations panel in /customers/[id] (Integrations slide-over)',
      'Write migration if new site_assets or site_asset_terminals columns needed',
      'Add vendor constants to /tech wiring library if field diagnostic support needed',
      'Add vendor to NEXUS system prompt context if AI needs to understand it',
      'Test webhook end-to-end: trigger vendor event → confirm portal record created',
      'Add to GGSOC event routing if vendor events should create SOC incidents',
      'Document in portal CLAUDE.md under Env Vars + Key Source Files',
    ],
  },
]

const TECH_ONBOARDING_STEPS = [
  { id: 'to1', title: 'Confirm Order', desc: 'Verify purchase order, equipment list, and site address. Confirm scheduling with property manager. Collect access badge/keys.', badge: '1' },
  { id: 'to2', title: 'Set Up Brivo API', desc: 'Create OAuth client in Brivo Developer Portal. Enter client_id, client_secret, api_key in site Integrations tab. Test door list fetch. Map door IDs to site assets.', badge: '2' },
  { id: 'to3', title: 'Set Up Eagle Eye API', desc: 'Generate EEN API key + note Account ID. Enter in site Integrations tab. Fetch camera list. Map camera ESNs to site assets. Verify live feed in /cameras.', badge: '3' },
  { id: 'to4', title: 'Tie Site into GGSOC', desc: 'Log into GGSOC admin (ggsoc.com). Create property record — link EEN account + Brivo site ID. Assign to monitoring queue. Test live camera access from SOC agent view.', badge: '4' },
  { id: 'to5', title: 'GGSOC Incidents → Portal Alerts', desc: 'Configure GGSOC webhook to POST to /api/webhooks/ggsoc on incident creation. Verify incident appears in /incidents portal page. Confirm alerts show in /alerts with correct site tag.', badge: '5' },
  { id: 'to6', title: 'Set Up UniFi API', desc: 'Enter UniFi controller host, admin credentials, site_id in site Integrations tab. Test device list fetch. Map device MACs to site assets. Verify /network page shows live data.', badge: '6' },
  { id: 'to7', title: 'UniFi Intercom + Pi Middleware', desc: 'Flash Pi with latest OS. Install GateGuard pi-middleware (see Pi setup playbook). Configure .env with UniFi + Brivo credentials. Set UniFi doorbell webhook → Pi endpoint. Test: ring intercom → Brivo credential check → door open.', badge: '7' },
  { id: 'to8', title: 'Set Up QR Code App for Site', desc: 'In portal site detail — generate site QR code (links to gatecard.co/<site-slug>). Print and laminate for lobby/entrance. Test QR scan on both iOS and Android. Confirm visitor flow: scan → enter name → send host SMS → host approves → door opens.', badge: '8' },
]

function CorpAdminTab() {
  const [expandedHowto, setExpandedHowto] = useState<string | null>(null)
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({})
  const [expandedOnboarding, setExpandedOnboarding] = useState<string | null>(null)

  const totalChecked = Object.values(checkedSteps).filter(Boolean).length

  return (
    <div className="space-y-8">

      {/* Tech Onboarding Workflow */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
              <span className="w-7 h-7 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 text-sm">🔧</span>
              Tech Onboarding Workflow
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 ml-9">Required sequence for every new site activation</p>
          </div>
          <span className="text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1">
            {totalChecked}/{TECH_ONBOARDING_STEPS.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${(totalChecked / TECH_ONBOARDING_STEPS.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          {TECH_ONBOARDING_STEPS.map((step, i) => {
            const checked = checkedSteps[step.id] ?? false
            const isOpen  = expandedOnboarding === step.id
            const prev    = i === 0 ? true : (checkedSteps[TECH_ONBOARDING_STEPS[i - 1].id] ?? false)
            return (
              <div
                key={step.id}
                className={`bg-white border rounded-xl overflow-hidden transition-all ${
                  checked ? 'border-emerald-200 bg-emerald-50/30' : !prev ? 'border-gray-100 opacity-60' : 'border-border hover:border-indigo-200'
                }`}
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer"
                  onClick={() => setExpandedOnboarding(isOpen ? null : step.id)}
                >
                  <button
                    onClick={e => { e.stopPropagation(); setCheckedSteps(c => ({ ...c, [step.id]: !c[step.id] })) }}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </button>
                  <span
                    className="w-6 h-6 rounded-md bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0"
                  >
                    {step.badge}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${checked ? 'text-emerald-700 line-through' : 'text-gray-800'}`}>{step.title}</p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
                {isOpen && (
                  <div className="px-4 pb-4 pt-0 ml-12">
                    <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                    {step.id === 'to7' && (
                      <button
                        onClick={() => {}}
                        className="mt-2 text-xs text-indigo-500 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> View Pi Setup playbook
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* How-To Guides */}
      <div>
        <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600 text-sm">📖</span>
          Integration Playbooks
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {CORP_HOWTOS.map(guide => {
            const isOpen = expandedHowto === guide.id
            return (
              <div key={guide.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedHowto(isOpen ? null : guide.id)}
                  className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{guide.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{guide.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{guide.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                    <span className="text-[10px] text-gray-400">{guide.steps.length} steps</span>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t border-border bg-gray-50 px-4 py-3">
                    <ol className="space-y-2">
                      {guide.steps.map((step, idx) => (
                        <li key={idx} className="flex gap-2 text-xs text-gray-600">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

export default function PlaybooksPage() {
  const [activeTab, setActiveTab] = useState<'site_job' | 'dev_rd' | 'corp_admin'>('site_job')
  const [siteRuns, setSiteRuns] = useState<PlaybookRun[]>([])
  const [devRuns, setDevRuns]   = useState<PlaybookRun[]>([])
  const [templates, setTemplates] = useState<PlaybookTemplate[]>(DEMO_TEMPLATES)
  const [showSlideOver, setShowSlideOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const [usingDemo, setUsingDemo] = useState(false)

  // Load data
  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [siteRes, devRes, tmplRes] = await Promise.all([
          fetch('/api/playbooks?type=site_job'),
          fetch('/api/playbooks?type=dev_rd'),
          fetch('/api/playbooks/templates'),
        ])
        const [siteJson, devJson, tmplJson] = await Promise.all([
          siteRes.json(), devRes.json(), tmplRes.json(),
        ])

        const siteData: PlaybookRun[] = siteJson.runs ?? []
        const devData: PlaybookRun[]  = devJson.runs ?? []
        const tmplData: PlaybookTemplate[] = tmplJson.templates ?? []

        if (!siteData.length && !devData.length) {
          setSiteRuns(DEMO_SITE_RUNS)
          setDevRuns(DEMO_DEV_RUNS)
          setUsingDemo(true)
        } else {
          setSiteRuns(siteData)
          setDevRuns(devData)
        }
        if (tmplData.length) setTemplates(tmplData)
      } catch {
        setSiteRuns(DEMO_SITE_RUNS)
        setDevRuns(DEMO_DEV_RUNS)
        setUsingDemo(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Toggle a step (optimistic update + PATCH)
  const handleStepToggle = useCallback(async (runId: string, stepId: string, done: boolean) => {
    const isDemo = runId.startsWith('demo')

    const patchRun = (run: PlaybookRun): PlaybookRun => ({
      ...run,
      step_progress: {
        ...run.step_progress,
        [stepId]: {
          done,
          done_by: done ? 'Russel Feldman' : undefined,
          done_at: done ? new Date().toISOString() : undefined,
        },
      },
    })

    setSiteRuns(prev => prev.map(r => r.id === runId ? patchRun(r) : r))
    setDevRuns(prev  => prev.map(r => r.id === runId ? patchRun(r) : r))

    if (!isDemo) {
      const allRuns = [...siteRuns, ...devRuns]
      const run = allRuns.find(r => r.id === runId)
      if (!run) return
      const newProgress = { ...run.step_progress, [stepId]: { done, done_by: 'Russel Feldman', done_at: new Date().toISOString() } }
      await fetch(`/api/playbooks/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step_progress: newProgress }),
      }).catch(() => {})
    }
  }, [siteRuns, devRuns])

  const handlePhaseChange = useCallback(async (runId: string, phase: string) => {
    setDevRuns(prev => prev.map(r => r.id === runId ? { ...r, phase } : r))
    if (!runId.startsWith('demo')) {
      await fetch(`/api/playbooks/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase }),
      }).catch(() => {})
    }
  }, [])

  const handleDelete = useCallback(async (runId: string) => {
    setSiteRuns(prev => prev.filter(r => r.id !== runId))
    setDevRuns(prev  => prev.filter(r => r.id !== runId))
    await fetch(`/api/playbooks/${runId}`, { method: 'DELETE' }).catch(() => {})
  }, [])

  const handleCreate = useCallback((run: PlaybookRun) => {
    if (run.type === 'site_job') setSiteRuns(prev => [run, ...prev])
    else setDevRuns(prev => [run, ...prev])
    setUsingDemo(false)
  }, [])

  // ── Stats ──
  const activeCount    = siteRuns.filter(r => r.status === 'active').length
  const completedCount = siteRuns.filter(r => r.status === 'completed').length
  const overdueCount   = siteRuns.filter(r => isOverdue(r)).length

  const devActive      = devRuns.filter(r => r.status === 'active').length

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <TopBar
        title="Playbooks"
        subtitle="Build processes & deployment checklists"
        actions={
          <button
            onClick={() => setShowSlideOver(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Playbook
          </button>
        }
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">

        {/* Demo banner */}
        {usingDemo && !loading && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700">
              Showing demo data — run migration <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">081_playbooks.sql</code> on Supabase to persist real playbooks.
            </p>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('site_job')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'site_job' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <HardHat className="w-4 h-4" />
            Site &amp; Job
          </button>
          <button
            onClick={() => setActiveTab('dev_rd')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'dev_rd' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <FlaskConical className="w-4 h-4" />
            Dev &amp; R&amp;D
          </button>
          <button
            onClick={() => setActiveTab('corp_admin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === 'corp_admin' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Cpu className="w-4 h-4" />
            GG Dev / Admin
          </button>
        </div>

        {/* ── SITE/JOB TAB ───────────────────────────────────────────────── */}
        {activeTab === 'site_job' && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Active Runs',          value: activeCount,    color: 'text-blue-600',  bg: 'bg-blue-50',  icon: ClipboardList },
                { label: 'Completed This Month', value: completedCount, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
                { label: 'Overdue',              value: overdueCount,   color: 'text-red-600',   bg: 'bg-red-50',   icon: AlertTriangle },
              ].map(stat => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                      <div className="text-xs text-gray-500">{stat.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Active runs */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Runs</h3>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => (
                    <div key={i} className="h-24 bg-white border border-border rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : siteRuns.filter(r => r.status === 'active').length === 0 ? (
                <div className="bg-white border border-border rounded-xl p-12 text-center">
                  <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="font-medium text-gray-600">No active site playbooks</p>
                  <p className="text-sm text-gray-400 mt-1">Create one from a template to get started</p>
                  <button
                    onClick={() => setShowSlideOver(true)}
                    className="mt-4 flex items-center gap-2 mx-auto bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Playbook
                  </button>
                </div>
              ) : (
                <div className="grid gap-3">
                  {siteRuns.filter(r => r.status === 'active').map(run => (
                    <SiteJobCard
                      key={run.id}
                      run={run}
                      templates={templates}
                      onStepToggle={handleStepToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Completed runs */}
            {siteRuns.filter(r => r.status === 'completed').length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 mb-3">Completed</h3>
                <div className="grid gap-3">
                  {siteRuns.filter(r => r.status === 'completed').map(run => (
                    <SiteJobCard
                      key={run.id}
                      run={run}
                      templates={templates}
                      onStepToggle={handleStepToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DEV/R&D TAB ────────────────────────────────────────────────── */}
        {activeTab === 'dev_rd' && (
          <div className="space-y-6">
            {/* Summary stat */}
            <div className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3">
              <GitBranch className="w-4 h-4 text-indigo-500" />
              <span className="text-sm text-gray-600">
                <strong className="text-gray-800">{devActive}</strong> active projects across{' '}
                <strong className="text-gray-800">{PHASES.length}</strong> phases
              </span>
            </div>

            {/* Phase swimlanes */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {PHASES.map(phase => {
                const PhaseIcon = phase.icon
                const phaseRuns = devRuns.filter(r => r.phase === phase.key)
                return (
                  <div key={phase.key} className="flex flex-col gap-3">
                    {/* Lane header */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                      style={{ background: phase.bg, borderColor: phase.border }}
                    >
                      <PhaseIcon className="w-4 h-4" style={{ color: phase.color }} />
                      <span className="text-sm font-semibold" style={{ color: phase.color }}>
                        {phase.label}
                      </span>
                      <span
                        className="ml-auto text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: phase.color, color: '#fff' }}
                      >
                        {phaseRuns.length}
                      </span>
                    </div>

                    {/* Cards */}
                    {loading ? (
                      <div className="h-24 bg-white border border-gray-100 rounded-xl animate-pulse" />
                    ) : phaseRuns.length === 0 ? (
                      <div
                        className="border-2 border-dashed rounded-xl p-6 text-center"
                        style={{ borderColor: phase.border }}
                      >
                        <p className="text-xs text-gray-400">No projects in {phase.label}</p>
                      </div>
                    ) : (
                      phaseRuns.map(run => (
                        <DevCard
                          key={run.id}
                          run={run}
                          templates={templates}
                          onStepToggle={handleStepToggle}
                          onPhaseChange={handlePhaseChange}
                        />
                      ))
                    )}
                  </div>
                )
              })}
            </div>

            {/* Templates reference */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Dev Templates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEMO_TEMPLATES.filter(t => t.type === 'dev_rd').map(tmpl => (
                  <div
                    key={tmpl.id}
                    className="bg-white border border-border rounded-xl p-4 flex items-start gap-3 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => setShowSlideOver(true)}
                  >
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Layers className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{tmpl.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{tmpl.description}</p>
                      <p className="text-xs text-indigo-500 mt-1">{tmpl.steps.length} steps</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

        {/* ── CORP ADMIN TAB ─────────────────────────────────────────────── */}
        {activeTab === 'corp_admin' && <CorpAdminTab />}

      {/* New Playbook Slide-Over */}
      <NewPlaybookSlideOver
        open={showSlideOver}
        onClose={() => setShowSlideOver(false)}
        templates={templates}
        activeTab={activeTab}
        onCreate={handleCreate}
      />
    </div>
  )
}
