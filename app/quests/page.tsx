'use client'

import { useEffect, useState } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { Zap, Star } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Target, Trophy, Award, Flame } = require('lucide-react') as any

// ─── Quest definitions ────────────────────────────────────────────────────────

interface Quest {
  id: string
  title: string
  desc: string
  target: number
  reward: number
  days: number
  metric: string
}

const QUESTS: Quest[] = [
  { id: 'q_surveys_5',    title: 'Survey Sprint',      desc: 'Complete 5 site surveys this month',       target: 5, reward: 100, days: 30, metric: 'surveys' },
  { id: 'q_quotes_3',     title: 'Quote Blitz',        desc: 'Get 3 quotes approved in a week',          target: 3, reward: 150, days: 7,  metric: 'quotes' },
  { id: 'q_zero_overdue', title: 'Clean Slate',        desc: 'Zero overdue work orders for 30 days',     target: 1, reward: 200, days: 30, metric: 'overdue' },
  { id: 'q_certs_2',      title: 'Knowledge Builder',  desc: 'Earn 2 training certifications',           target: 2, reward: 120, days: 60, metric: 'certs' },
  { id: 'q_five_star_5',  title: 'Five Star Run',      desc: 'Collect 5 five-star job ratings',          target: 5, reward: 175, days: 30, metric: 'ratings' },
]

// ─── Tier logic ───────────────────────────────────────────────────────────────

interface Tier {
  label: string
  min: number
  max: number
  color: string
  bg: string
  next: string | null
  nextMin: number
}

function getTier(points: number): Tier {
  if (points >= 95)  return { label: 'Elite',     min: 95,  max: 100, color: '#7C3AED', bg: '#F5F3FF', next: null,        nextMin: 100 }
  if (points >= 85)  return { label: 'Certified', min: 85,  max: 94,  color: '#2563eb', bg: '#EFF6FF', next: 'Elite',     nextMin: 95  }
  if (points >= 75)  return { label: 'Gold',      min: 75,  max: 84,  color: '#D97706', bg: '#FFFBEB', next: 'Certified', nextMin: 85  }
  if (points >= 60)  return { label: 'Silver',    min: 60,  max: 74,  color: '#64748B', bg: '#F8FAFC', next: 'Gold',      nextMin: 75  }
  return               { label: 'Bronze',    min: 0,   max: 59,  color: '#B45309', bg: '#FEF3C7', next: 'Silver',    nextMin: 60  }
}

// ─── Demo progress fallback ───────────────────────────────────────────────────

const DEMO_PROGRESS: Record<string, number> = {
  q_surveys_5:    2,
  q_quotes_3:     1,
  q_zero_overdue: 1,
  q_certs_2:      1,
  q_five_star_5:  3,
}

// ─── Quest Card ───────────────────────────────────────────────────────────────

function QuestCard({ quest, progress }: { quest: Quest; progress: number }) {
  const completed = progress >= quest.target
  const pct = Math.round(Math.min(progress / quest.target, 1) * 100)

  return (
    <div className="bg-white rounded-xl border border-border p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-foreground">{quest.title}</p>
            {completed && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                <Award size={10} /> Done
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{quest.desc}</p>
        </div>
        <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#2563eb]/10 text-[#2563eb] whitespace-nowrap shrink-0">
          +{quest.reward} pts
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>{progress}/{quest.target}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: completed ? '#10b981' : '#2563eb',
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          🗓 {quest.days}-day challenge
        </span>
        {completed
          ? <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              ✓ Completed
            </span>
          : <span className="text-xs text-muted-foreground">
              {quest.days}d remaining
            </span>
        }
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QuestsPage() {
  const [progress, setProgress] = useState<Record<string, number>>(DEMO_PROGRESS)
  const [totalPoints, setTotalPoints] = useState(850)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/quests/progress')
        if (res.ok) {
          const data = await res.json() as { progress: Record<string, number>; totalPoints: number }
          setProgress(data.progress ?? DEMO_PROGRESS)
          setTotalPoints(data.totalPoints ?? 850)
        }
      } catch {
        // non-critical — demo values already set
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const tier = getTier(totalPoints)
  const completedQuests = QUESTS.filter(q => (progress[q.id] ?? 0) >= q.target)
  const activeQuests = QUESTS.filter(q => (progress[q.id] ?? 0) < q.target)

  // Progress to next tier (as a 0–100 percentage within current band)
  const tierRange = tier.nextMin - tier.min
  const tierProgress = tierRange > 0
    ? Math.round(Math.min((totalPoints - tier.min) / tierRange, 1) * 100)
    : 100

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Quests" subtitle="Complete missions to earn tier points" />

      <div className="px-6 py-6 space-y-6 flex-1">

        {/* ── Points Summary Bar ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-6">

            {/* Total Points */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#EFF6FF' }}>
                <Trophy size={24} style={{ color: '#2563eb' }} />
              </div>
              <div>
                <p className="text-3xl font-black text-foreground tabular-nums">
                  {loading ? '—' : totalPoints.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground font-medium">Total Points</p>
              </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-border" />

            {/* Tier + Progress */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: tier.bg, color: tier.color }}
                  >
                    {tier.label}
                  </span>
                  <span className="text-xs text-muted-foreground">Current Tier</span>
                </div>
                {tier.next && (
                  <span className="text-xs text-muted-foreground">
                    {tier.nextMin - totalPoints} pts to <span className="font-semibold" style={{ color: tier.color }}>{tier.next}</span>
                  </span>
                )}
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${tierProgress}%`, background: tier.color }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{tier.label} ({tier.min})</span>
                {tier.next
                  ? <span>{tier.next} ({tier.nextMin})</span>
                  : <span className="font-bold" style={{ color: tier.color }}>Max Tier</span>
                }
              </div>
            </div>

            <div className="hidden md:block w-px h-12 bg-border" />

            {/* How to earn */}
            <div className="shrink-0">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                <Flame size={11} /> How to Earn Points
              </p>
              <ul className="space-y-0.5 text-[11px] text-muted-foreground">
                <li><span className="font-semibold text-foreground">+100</span> Survey completed</li>
                <li><span className="font-semibold text-foreground">+150</span> Quote approved</li>
                <li><span className="font-semibold text-foreground">+50</span>  Chapter completed</li>
                <li><span className="font-semibold text-foreground">+200</span> Zero overdue WOs</li>
                <li><span className="font-semibold text-foreground">+175</span> Five-star rating</li>
              </ul>
            </div>
          </div>
        </div>

        {/* ── Active Quests ───────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-[#2563eb]" />
            <h2 className="text-sm font-bold text-foreground">Active Quests</h2>
            <span className="text-xs text-muted-foreground">({activeQuests.length} in progress)</span>
          </div>

          {activeQuests.length === 0 ? (
            <div className="bg-white rounded-xl border border-border p-8 text-center shadow-sm">
              <div className="text-4xl mb-3">🏆</div>
              <p className="font-semibold text-foreground">All quests completed!</p>
              <p className="text-sm text-muted-foreground mt-1">New challenges drop at the start of each month.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeQuests.map(quest => (
                <QuestCard
                  key={quest.id}
                  quest={quest}
                  progress={progress[quest.id] ?? 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Completed Quests ────────────────────────────────────────────── */}
        {completedQuests.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Star size={16} className="text-emerald-500" />
              <h2 className="text-sm font-bold text-foreground">Completed</h2>
              <span className="text-xs text-muted-foreground">({completedQuests.length} done)</span>
            </div>

            <div className="bg-white rounded-xl border border-border shadow-sm divide-y divide-border">
              {completedQuests.map(quest => {
                const earned = quest.reward
                return (
                  <div key={quest.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center">
                        <Award size={14} style={{ color: '#10b981' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{quest.title}</p>
                        <p className="text-xs text-muted-foreground">{quest.desc}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">
                        +{earned} pts
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                        <Zap size={11} /> Completed
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
