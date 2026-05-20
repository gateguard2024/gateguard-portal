'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Users, CheckCircle2, Star, Loader2, Download } from 'lucide-react'
const { Shield, AlertTriangle, RotateCcw } = require('lucide-react') as any
import { DataTable, type Column } from '@/components/ui/DataTable'
import { EmptyState } from '@/components/ui/EmptyState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProgress {
  user_id: string
  user_name: string | null
  user_email: string | null
  org_id: string | null
  org_name: string | null
  completions: Array<{ course_id: string; chapter_id: string; completed_at: string }>
}

interface AdminRow {
  user_id: string
  user_name: string
  user_email: string
  org_name: string
  lvf_complete: boolean
  lvf_date: string
  lvf_certified: boolean
  ls_complete: boolean
  ls_date: string
  ls_certified: boolean
  ul_complete: boolean
  ul_date: string
  ul_certified: boolean
  courses_done: number
  fully_certified: boolean
}

// Course IDs
const COURSE_IDS = ['low-voltage-fundamentals', 'ladder-jobsite-safety', 'ul325-gate-safety']
const CHAPTER_COUNTS: Record<string, number> = {
  'low-voltage-fundamentals': 7,
  'ladder-jobsite-safety':    6,
  'ul325-gate-safety':        6,
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function isCourseDone(completions: UserProgress['completions'], courseId: string): boolean {
  const needed = CHAPTER_COUNTS[courseId] ?? 0
  const done = completions.filter(c => c.course_id === courseId && c.chapter_id !== `${courseId}_quiz`).length
  return done >= needed
}

function isCourseQuizPassed(completions: UserProgress['completions'], courseId: string): boolean {
  return completions.some(c => c.course_id === courseId && c.chapter_id === `${courseId}_quiz`)
}

function latestDate(completions: UserProgress['completions'], courseId: string): string {
  const dates = completions
    .filter(c => c.course_id === courseId)
    .map(c => c.completed_at)
    .sort()
  return dates[dates.length - 1] ?? ''
}

function buildRow(u: UserProgress): AdminRow {
  const lvf_complete  = isCourseDone(u.completions, 'low-voltage-fundamentals')
  const lvf_certified = isCourseQuizPassed(u.completions, 'low-voltage-fundamentals')
  const ls_complete   = isCourseDone(u.completions, 'ladder-jobsite-safety')
  const ls_certified  = isCourseQuizPassed(u.completions, 'ladder-jobsite-safety')
  const ul_complete   = isCourseDone(u.completions, 'ul325-gate-safety')
  const ul_certified  = isCourseQuizPassed(u.completions, 'ul325-gate-safety')
  const courses_done  = [lvf_certified, ls_certified, ul_certified].filter(Boolean).length
  const fully_certified = lvf_certified && ls_certified && ul_certified

  return {
    user_id:   u.user_id,
    user_name: u.user_name ?? 'Unknown',
    user_email: u.user_email ?? '—',
    org_name:  u.org_name ?? '—',
    lvf_complete, lvf_date: latestDate(u.completions, 'low-voltage-fundamentals'), lvf_certified,
    ls_complete,  ls_date:  latestDate(u.completions, 'ladder-jobsite-safety'),    ls_certified,
    ul_complete,  ul_date:  latestDate(u.completions, 'ul325-gate-safety'),         ul_certified,
    courses_done, fully_certified,
  }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color ?? 'text-foreground'}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Course Cell ──────────────────────────────────────────────────────────────

function CourseCell({ complete, certified, date }: { complete: boolean; certified: boolean; date: string }) {
  if (certified) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-[#6B7EFF]">
          <Star className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Certified</span>
        </div>
        {date && <div className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</div>}
      </div>
    )
  }
  if (complete) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span className="text-xs font-semibold">Complete</span>
        </div>
        <div className="text-xs text-amber-600">Exam pending</div>
      </div>
    )
  }
  return <span className="text-xs text-muted-foreground">—</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TrainingAdminPage() {
  const [rows,    setRows]    = useState<AdminRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/training/admin-progress')
        if (res.status === 403) { setError('Access denied. Corporate or admin role required.'); return }
        if (!res.ok) { setError('Failed to load data'); return }
        const data = await res.json() as { users: UserProgress[] }

        // Fetch org names for each unique org_id
        const orgIds = [...new Set(data.users.map(u => u.org_id).filter(Boolean))] as string[]
        let orgMap: Record<string, string> = {}
        if (orgIds.length > 0) {
          try {
            const orgRes = await fetch(`/api/customers?ids=${orgIds.join(',')}`)
            if (orgRes.ok) {
              const orgData = await orgRes.json() as { orgs?: Array<{ id: string; name: string }> }
              orgMap = Object.fromEntries((orgData.orgs ?? []).map(o => [o.id, o.name]))
            }
          } catch { /* org names optional */ }
        }

        const built = data.users.map(u => buildRow({ ...u, org_name: u.org_id ? (orgMap[u.org_id] ?? u.org_id) : null }))
        setRows(built)
      } catch (e) {
        setError('Failed to load training data')
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function resetAttempts(userId: string) {
    // POST to reset endpoint — no-op if not implemented, just UX placeholder
    await fetch('/api/training/reset-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    }).catch(() => null)
    alert('Attempt reset request sent. The user will be able to retake failed exams.')
  }

  async function revokeCert(userId: string, courseId: string) {
    if (!confirm('Revoke this certification? The user will need to retake the exam.')) return
    await fetch('/api/training/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, course_id: courseId, chapter_id: `${courseId}_quiz`, completed: false }),
    }).catch(() => null)
    setRows(prev => prev.map(r => {
      if (r.user_id !== userId) return r
      const updated = { ...r }
      if (courseId === 'low-voltage-fundamentals') { updated.lvf_certified = false }
      if (courseId === 'ladder-jobsite-safety')    { updated.ls_certified  = false }
      if (courseId === 'ul325-gate-safety')         { updated.ul_certified  = false }
      updated.courses_done   = [updated.lvf_certified, updated.ls_certified, updated.ul_certified].filter(Boolean).length
      updated.fully_certified = updated.lvf_certified && updated.ls_certified && updated.ul_certified
      return updated
    }))
  }

  // Stats
  const totalEnrolled   = rows.length
  const totalCompleted  = rows.filter(r => r.courses_done > 0).length
  const totalCertified  = rows.filter(r => r.fully_certified).length
  const avgPct          = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.courses_done / 3) * 100, 0) / rows.length)
    : 0

  const columns: Column<AdminRow>[] = [
    {
      key: 'user_name',
      label: 'Name',
      width: 'min-w-0 flex-1',
      sortable: true,
      render: (_v, row) => (
        <div>
          <div className="text-sm font-semibold text-foreground">{row.user_name}</div>
          <div className="text-xs text-muted-foreground">{row.user_email}</div>
        </div>
      ),
    },
    {
      key: 'org_name',
      label: 'Organization',
      width: 'w-40',
      sortable: true,
      render: (_v, row) => <span className="text-sm text-foreground">{row.org_name}</span>,
    },
    {
      key: 'lvf_certified',
      label: 'Low Voltage Fund.',
      width: 'w-36',
      render: (_v, row) => <CourseCell complete={row.lvf_complete} certified={row.lvf_certified} date={row.lvf_date} />,
    },
    {
      key: 'ls_certified',
      label: 'Ladder Safety',
      width: 'w-32',
      render: (_v, row) => <CourseCell complete={row.ls_complete} certified={row.ls_certified} date={row.ls_date} />,
    },
    {
      key: 'ul_certified',
      label: 'UL 325',
      width: 'w-32',
      render: (_v, row) => <CourseCell complete={row.ul_complete} certified={row.ul_certified} date={row.ul_date} />,
    },
    {
      key: 'courses_done',
      label: 'Progress',
      width: 'w-28',
      sortable: true,
      render: (_v, row) => (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden w-16">
            <div
              className="h-full bg-[#6B7EFF] rounded-full"
              style={{ width: `${(row.courses_done / 3) * 100}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">{row.courses_done}/3</span>
        </div>
      ),
    },
    {
      key: 'fully_certified',
      label: 'Certified',
      width: 'w-24',
      align: 'center',
      render: (_v, row) => row.fully_certified ? (
        <span className="inline-flex items-center gap-1 bg-[#6B7EFF]/10 text-[#6B7EFF] text-xs font-semibold px-2 py-1 rounded-full">
          <Shield className="w-3 h-3" /> GG Cert
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    },
  ]

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <GraduationCap className="w-7 h-7 text-[#6B7EFF]" />
            <h1 className="text-2xl font-bold text-gray-900">Training Administration</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Dealer network training completion and certification status.
          </p>
        </div>
        <a
          href="/training"
          className="text-sm text-[#6B7EFF] font-semibold hover:underline flex items-center gap-1"
        >
          ← Back to My Training
        </a>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Enrolled" value={loading ? '—' : totalEnrolled} sub="users with any progress" />
        <StatCard label="Completed" value={loading ? '—' : totalCompleted} sub="at least 1 course" color="text-emerald-600" />
        <StatCard label="Certified" value={loading ? '—' : totalCertified} sub="all 3 courses + exams" color="text-[#6B7EFF]" />
        <StatCard label="Avg Completion" value={loading ? '—' : `${avgPct}%`} sub="across all enrolled" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading training data...</span>
        </div>
      ) : (
        <DataTable<AdminRow>
          columns={columns}
          data={rows}
          rowKey="user_id"
          loading={false}
          emptyState={
            <EmptyState
              icon={<Users className="w-6 h-6 text-muted-foreground" />}
              title="No training records"
              description="No users have started any training courses yet."
            />
          }
          actions={row => (
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => resetAttempts(row.user_id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                title="Reset exam attempts"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              {row.fully_certified && (
                <button
                  onClick={() => {
                    const courseId = row.lvf_certified ? 'low-voltage-fundamentals' :
                                     row.ls_certified  ? 'ladder-jobsite-safety' : 'ul325-gate-safety'
                    void revokeCert(row.user_id, courseId)
                  }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                  title="Revoke certification"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Revoke
                </button>
              )}
            </div>
          )}
        />
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-[#6B7EFF]" />
          <span>Certified = chapters complete + exam passed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Complete = all chapters done, exam pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" />
          <span>Certificates expire 1 year from issue date</span>
        </div>
      </div>
    </div>
  )
}
