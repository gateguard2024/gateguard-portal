/**
 * Customer update drafts for a work order — the ONE list of presets.
 *
 * Today: the job page shows these as editable drafts the person chooses to send
 * (text and/or email). Later the same presets can be sent automatically when a
 * job changes (scheduled, parts ordered, finished…) — `autoOn` marks which job
 * event each one fits, so that wiring is a lookup, not a rewrite.
 *
 * Plain data + pure functions only (used in the browser and on the server).
 * Anything the person must fill in is written as [in square brackets]; the send
 * route refuses a message that still has brackets in it.
 */

export type UpdateCtx = {
  contactFirst?: string | null   // "Dana"
  site?: string | null           // property name
  woNumber?: string | null
  title?: string | null          // the job title
  date?: string | null           // YYYY-MM-DD scheduled date
  tech?: string | null           // assigned tech full name
  doneSteps?: string[]           // checklist items marked done
  parts?: { name: string; qty?: number | null; status?: string | null; expected?: string | null }[]
  sender?: string | null         // who is sending (first name)
}

export type UpdatePreset = {
  key: string
  label: string
  /** Short hint shown under the label. */
  when: string
  /** Job event this would auto-send on later (not wired yet). */
  autoOn?: 'scheduled' | 'parts_ordered' | 'completed' | 'cancelled' | 'rescheduled' | 'issue_logged'
  subject: (c: UpdateCtx) => string
  body: (c: UpdateCtx) => string
}

export const niceDate = (ymd?: string | null) => {
  if (!ymd) return null
  const d = new Date(`${String(ymd).slice(0, 10)}T12:00:00Z`)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
}
const hi = (c: UpdateCtx) => `Hi ${c.contactFirst?.trim() || 'there'},`
const job = (c: UpdateCtx) => c.title?.trim() || 'your service request'
const at = (c: UpdateCtx) => c.site?.trim() || 'the property'
const ref = (c: UpdateCtx) => (c.woNumber ? ` (work order ${c.woNumber})` : '')
const sign = (c: UpdateCtx) => `Thank you,\n${c.sender?.trim() ? `${c.sender.trim()}\n` : ''}Gate Guard Service`
const techLine = (c: UpdateCtx) => (c.tech?.trim() ? `${c.tech.trim().split(' ')[0]} from our team` : 'One of our technicians')
const list = (items: string[]) => items.map(i => `• ${i}`).join('\n')
const partsList = (c: UpdateCtx, onlyPending = false) => {
  const ps = (c.parts ?? []).filter(p => !onlyPending || !['on_truck', 'installed', 'at_office'].includes(String(p.status ?? '')))
  return ps.map(p => `${p.qty && p.qty > 1 ? `${p.qty} × ` : ''}${p.name}`)
}
const latestExpected = (c: UpdateCtx) => (c.parts ?? []).map(p => p.expected).filter(Boolean).sort().pop() ?? null

export const UPDATE_PRESETS: UpdatePreset[] = [
  {
    key: 'issue_found', label: 'Issue found', when: 'You found a problem that needs fixing', autoOn: 'issue_logged',
    subject: c => `Issue found at ${at(c)}${ref(c)}`,
    body: c => `${hi(c)}

During our visit to ${at(c)} for ${job(c)}, we found an issue: [what is wrong].

What it means: [how it affects the gate / system — e.g. the gate may not close on its own].

What we recommend: [the repair]. [Estimated cost or "We'll send a quote today."]

Reply to this message to approve, or call us with any questions.

${sign(c)}`,
  },
  {
    key: 'scheduled', label: 'Repair / service scheduled', when: 'The visit has a date', autoOn: 'scheduled',
    subject: c => `Service scheduled${c.date ? ` for ${niceDate(c.date)}` : ''} — ${at(c)}`,
    body: c => `${hi(c)}

${job(c)} at ${at(c)} is scheduled for ${niceDate(c.date) ?? '[day]'}, between [time window].

${techLine(c)} will be there. [Anything they need — gate code, access to the equipment room, someone on site.]

If that time doesn't work, just reply and we'll find a better one.

${sign(c)}`,
  },
  {
    key: 'summary', label: 'Repair summary', when: 'The work is done — what was done', autoOn: 'completed',
    subject: c => `Service completed at ${at(c)}${ref(c)}`,
    body: c => {
      const done = (c.doneSteps ?? []).filter(Boolean)
      const parts = partsList(c)
      return `${hi(c)}

We finished ${job(c)} at ${at(c)} today.

What we did:
${done.length ? list(done) : '• [work performed]'}
${parts.length ? `\nParts installed:\n${list(parts)}\n` : ''}
Status: [Everything is working / what is left to do].

[Any recommendation for the property — e.g. we suggest replacing the photo eyes in the next few months.]

${sign(c)}`
    },
  },
  {
    key: 'waiting_parts', label: 'Waiting on parts', when: 'Parts are ordered', autoOn: 'parts_ordered',
    subject: c => `Parts ordered for ${at(c)}${ref(c)}`,
    body: c => {
      const parts = partsList(c, true)
      const exp = niceDate(latestExpected(c))
      return `${hi(c)}

Quick update on ${job(c)} at ${at(c)}: we've ordered the parts needed for the repair.
${parts.length ? `\n${list(parts)}\n` : ''}
They should arrive by ${exp ?? '[date]'}. As soon as they're in, we'll schedule the visit and let you know.

[In the meantime: what the property can do — e.g. the gate is in manual open mode.]

${sign(c)}`
    },
  },
  {
    key: 'rescheduled', label: 'Visit rescheduled', when: 'The date changed or the tech is running late', autoOn: 'rescheduled',
    subject: c => `New time for your service visit — ${at(c)}`,
    body: c => `${hi(c)}

We need to move the visit for ${job(c)} at ${at(c)}. The new time is ${niceDate(c.date) ?? '[day]'}, between [time window].

Reason: [short reason — e.g. waiting on a part, weather, the earlier job ran long].

Sorry for the change. Reply if the new time doesn't work.

${sign(c)}`,
  },
  {
    key: 'need_access', label: 'Need access or info', when: 'You need a code, a key or a person on site',
    subject: c => `We need a little help to finish ${job(c)}`,
    body: c => `${hi(c)}

To finish ${job(c)} at ${at(c)}, we need: [gate code / key to the equipment room / someone on site / a photo of the panel].

Could you reply with that, or let us know who to contact?

${sign(c)}`,
  },
  {
    key: 'approval', label: 'Approval needed', when: 'Extra work or cost needs a yes',
    subject: c => `Approval needed — ${at(c)}${ref(c)}`,
    body: c => `${hi(c)}

While working on ${job(c)} at ${at(c)}, we found that [extra work needed].

Cost: [amount]. Without it: [what happens if it isn't done].

Reply "Approved" and we'll go ahead, or call us and we'll walk you through it.

${sign(c)}`,
  },
  {
    key: 'follow_up', label: 'Follow-up visit needed', when: 'Another trip is needed to finish',
    subject: c => `Follow-up visit for ${at(c)}`,
    body: c => `${hi(c)}

We made progress on ${job(c)} at ${at(c)} today: [what was done].

We'll need one more visit to finish: [what is left]. We'll be back ${niceDate(c.date) ?? '[day]'}.

${sign(c)}`,
  },
  {
    key: 'all_clear', label: 'Checked — all working', when: 'Inspection or call-out found nothing wrong',
    subject: c => `All clear at ${at(c)}`,
    body: c => `${hi(c)}

We checked ${job(c)} at ${at(c)} and everything is working the way it should.

[What we tested — e.g. opened and closed the gate 10 times, tested the loops, photo eyes and keypad.]

If it happens again, note the time and let us know — it helps us find the cause.

${sign(c)}`,
  },
  {
    key: 'cancelled', label: 'Job cancelled', when: 'Let them know it is off', autoOn: 'cancelled',
    subject: c => `Service request cancelled — ${at(c)}`,
    body: c => `${hi(c)}

As discussed, we've cancelled ${job(c)} at ${at(c)}${ref(c)}. [Reason, if useful.]

If you still need help, just reply and we'll set it up again.

${sign(c)}`,
  },
]

/** Parts the person still has to fill in, e.g. ["what is wrong", "time window"]. */
export function blanksIn(text: string): string[] {
  return [...new Set([...String(text).matchAll(/\[([^\]\n]{1,120})\]/g)].map(m => m[1]))]
}
