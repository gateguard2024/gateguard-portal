'use client'

/**
 * OpsComingSoon — the Operations roadmap, shown on the Operations landing as
 * "Coming soon" tiles. Tap a tile to see what it will do and why.
 *
 * Source of truth for the vision: docs/nexus/OPERATIONS_VISION.md.
 * Keep the two in step. When a feature ships, delete its entry here and wire
 * the real tile into OperationsLanding.
 */
import { useEffect, useState } from 'react'

export type OpsRoadmapItem = {
  key: string
  glyph: string
  title: string
  line: string          // one sentence on the tile
  today: string         // how it works today (honest)
  will: string[]        // what it will do, plain words
  why: string           // the payoff
  phase: 1 | 2 | 3
}

export const OPS_ROADMAP: OpsRoadmapItem[] = [
  {
    key: 'agreements', glyph: '▣', phase: 1,
    title: 'Service Agreements',
    line: 'One contract per property that runs the service, billing and renewals.',
    today: 'There is no contract record. Monthly billing, maintenance plans and renewals are tracked by hand.',
    will: [
      'Pick the property, the coverage tier and the monthly amount — that’s the agreement',
      'It builds the maintenance plan, the monthly invoice and the response-time promise for you',
      'Renewals list shows every agreement ending in the next 90 days',
      'One click renews it, with the price increase you choose',
    ],
    why: 'This is the recurring revenue engine. Everything else on this list hangs off it.',
  },
  {
    key: 'sla', glyph: '◷', phase: 1,
    title: 'Response-Time Promises (SLA)',
    line: 'Every work order shows how long you have left to respond and fix.',
    today: 'Work orders have a priority but no deadline, so the board can’t tell you what is about to be late.',
    will: [
      'Due-by times set automatically from the property’s agreement and the priority',
      'Green, amber and red on the dispatch board as the clock runs',
      'A warning before a promise is missed, not after',
      'A monthly report the property manager can see: promises kept vs missed',
    ],
    why: 'Dispatch always knows what to do next, and you can prove the service you sell.',
  },
  {
    key: 'handoff', glyph: '⇢', phase: 1,
    title: 'Proposal → Install Handoff',
    line: 'A won proposal becomes a ready-to-build job, parts and all.',
    today: 'Winning a deal creates an install work order with only a description. Equipment is retyped and quote margin shows $0.',
    will: [
      'The accepted proposal’s equipment list becomes the job’s parts list',
      'Purchase orders are drafted for anything not in stock',
      'The job remembers which proposal it came from',
      'At the end you see quoted vs actual cost on every install',
    ],
    why: 'No retyping, nothing forgotten, and real profit numbers per job.',
  },
  {
    key: 'parts', glyph: '⬚', phase: 2,
    title: 'Parts & Truck Stock',
    line: 'Receive parts into stock and know what’s on every truck.',
    today: 'Marking a purchase order received doesn’t add stock. There is one shared truck count and no vendor list.',
    will: [
      'Receive a purchase order (or part of one) and stock goes up',
      'Stock per truck, per tech, plus the warehouse',
      'Move parts warehouse → truck with a tap',
      'Low-stock alerts and a vendor list with your pricing',
    ],
    why: 'Techs stop driving to the supply house for parts you already bought.',
  },
  {
    key: 'timecards', glyph: '⏱', phase: 2,
    title: 'Timecards & Payroll',
    line: 'Clock in and out from the tech app; approve the week; export payroll.',
    today: 'Hours are typed in by hand after the fact. There is no weekly approval or payroll export.',
    will: [
      'Clock in, travel and on-site time tracked from the tech app',
      'Weekly timesheet each manager approves',
      'Payroll export file for your payroll provider',
      'Labor cost lands on each job automatically',
    ],
    why: 'Payroll from real hours, and true labor cost on every job.',
  },
  {
    key: 'deficiency', glyph: '⚑', phase: 2,
    title: 'Repair Quotes from the Field',
    line: 'Tech spots a problem, property approves the fix online.',
    today: 'A tech who finds a worn-out operator or broken hinge has to call the office. It often never becomes a quote.',
    will: [
      'Tech taps “Flag a problem”, adds photos and a note',
      'Office turns it into a repair quote in one click',
      'Property manager approves online from their phone',
      'Approval creates the work order and orders the part',
    ],
    why: 'The biggest revenue lever in service work. Every visit finds the next job.',
  },
  {
    key: 'autoticket', glyph: '⚡', phase: 2,
    title: 'Auto-Tickets from Monitoring',
    line: 'A gate that goes down opens its own work order.',
    today: 'Device health opens an incident, but someone has to click “Send tech”. Gate alarms from the SOC never reach that button.',
    will: [
      'Device offline or gate alarm for a set time → incident opens',
      'If the property has an agreement, a work order is created and dispatched',
      'The property manager is told it’s already being handled',
    ],
    why: 'You fix the gate before the property calls you.',
  },
  {
    key: 'comms', glyph: '✉', phase: 3,
    title: 'Customer Updates on Autopilot',
    line: 'Reminders, live “tech on the way” link and a service report, sent for you.',
    today: 'On-my-way and completed texts exist but someone has to press the button. No reminders, live map or report.',
    will: [
      'Day-before appointment reminder by text and email',
      'Live “your tech is on the way” link with arrival time',
      'Service report with photos emailed when the job closes',
      'All of it visible in the property manager portal',
    ],
    why: 'Fewer “where’s the tech?” calls, and proof of every visit.',
  },
  {
    key: 'pm', glyph: '↻', phase: 3,
    title: 'Smarter Maintenance Plans',
    line: 'Maintenance tied to each gate and camera, with the right checklist every time.',
    today: 'Plans are per site, every N days, with no checklist copied into the visit.',
    will: [
      'Maintenance plan per device (gate operator, reader, camera)',
      'Checklist templates per job type, added to every visit',
      '12-month forecast of upcoming visits and labor hours',
    ],
    why: 'Every visit is done the same, complete way, and you can plan crews ahead.',
  },
  {
    key: 'onejob', glyph: '◫', phase: 3,
    title: 'One Job, Many Visits',
    line: 'An install job holds all of its visits, parts and costs in one place.',
    today: 'Projects and work orders are two separate lists that don’t know about each other.',
    will: [
      'An install or project is the parent; each trip is a visit under it',
      'One timeline, one parts list, one profit number per job',
      'Service calls still work exactly as today',
    ],
    why: 'One place to look for everything about a job.',
  },
]

const TILE_STYLE = { background: 'linear-gradient(165deg,rgba(255,255,255,0.045),transparent 55%), linear-gradient(180deg,rgba(32,44,66,0.82),rgba(18,26,42,0.78))', border: '1px solid #1E293B', boxShadow: '0 14px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.14)' } as const
const PHASE_LABEL: Record<1 | 2 | 3, string> = { 1: 'Next', 2: 'Then', 3: 'Later' }

export function OpsComingSoon() {
  const [open, setOpen] = useState<OpsRoadmapItem | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="mt-4">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: '#00A3FF' }}>Coming soon</div>
          <div className="text-[12px]" style={{ color: '#c3d3e2' }}>What we&rsquo;re building next for Operations. Tap one to see what it will do.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {OPS_ROADMAP.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => setOpen(item)}
            className="flex flex-col gap-1.5 rounded-2xl p-3.5 text-left transition-transform hover:-translate-y-0.5"
            style={TILE_STYLE}
            aria-label={`${item.title} — coming soon. Show details`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[15px]" aria-hidden style={{ color: '#00A3FF' }}>{item.glyph}</span>
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em]" style={{ background: 'rgba(0,163,255,0.12)', border: '1px solid rgba(0,163,255,0.25)', color: 'rgba(210,245,255,0.92)' }}>Coming soon</span>
            </div>
            <div className="text-[13px] font-semibold leading-snug" style={{ color: '#eaf2fb' }}>{item.title}</div>
            <div className="text-[11px] leading-snug" style={{ color: '#c3d3e2' }}>{item.line}</div>
          </button>
        ))}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ background: 'rgba(5,10,20,0.55)', backdropFilter: 'blur(4px)' }}
          onClick={() => setOpen(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ops-cs-title"
            className="w-full max-w-[520px] overflow-y-auto rounded-2xl bg-white p-6"
            style={{ maxHeight: '88vh', color: '#1D1D1F', boxShadow: '0 24px 60px rgba(0,0,0,0.35)', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#EEF4FF', color: '#0058B0' }}>Coming soon · {PHASE_LABEL[open.phase]}</span>
                <h3 id="ops-cs-title" className="mt-2 text-[20px] font-semibold leading-tight" style={{ letterSpacing: '-0.02em' }}>{open.title}</h3>
              </div>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[18px]" style={{ background: '#F5F5F7', color: '#6E6E73' }}>×</button>
            </div>

            <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#6E6E73' }}>Today</div>
            <p className="mt-1 text-[14px] leading-relaxed" style={{ color: '#3A3A3C' }}>{open.today}</p>

            <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: '#6E6E73' }}>What it will do</div>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {open.will.map(w => (
                <li key={w} className="flex gap-2 text-[14px] leading-snug"><span aria-hidden style={{ color: '#248A3D' }}>✓</span><span>{w}</span></li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl px-3.5 py-3 text-[14px] leading-snug" style={{ background: '#F5F5F7' }}>
              <span className="font-semibold">Why it matters: </span>{open.why}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OpsComingSoon
