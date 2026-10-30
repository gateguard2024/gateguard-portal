'use client'

/**
 * Task detail — side panel, or a full page when expanded.
 * Design: "Task · Side panel", "Task · Full page", "Task · How each field edits" (Dealer · My Day canvas page).
 * Every value edits in place and saves at once. Loads everything from GET /api/todos/[id].
 * Who can do what is decided by the server (can.edit / can.comment): creator, owner or corporate
 * edit; watchers can comment.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { PRIORITY, STATUS, T, addDays, fmtDue, initials, isOverdue, linkTypeLabel, localISO, PriorityIcon, type Person, type Task, type TaskPriority, type TaskStatus } from './shared'
import { DatesEditor, OptionsEditor, PeoplePicker, Pop, RecordSearch, StatusEditor, TagsEditor, TaskSearch, WAITING_ON, type RecordHit } from './TaskEditors'
import { ActivitySection, Checklist, Description, Files, SectionStyles, Subtasks, type Activity, type ChecklistItem, type Comment, type FileRow, type Subtask } from './TaskSections'

type Link = { id: string; linked_type: string; linked_id: string; linked_label: string | null }
type Dep = { id: string; blocked_by_todo_id: string; todos: { id: string; title: string; status: TaskStatus; task_number: number | null } | null }
type TimeEntry = { id: string; user_id: string; user_name: string | null; started_at: string; ended_at: string | null; minutes: number | null }
type Detail = {
  todo: Task & { body?: string | null; created_by?: string; created_by_name?: string | null; created_at?: string }
  parent: { id: string; title: string; task_number: number | null } | null
  checklist: ChecklistItem[]
  subtasks: Subtask[]
  comments: Comment[]
  activity: Activity[]
  links: Link[]
  blocked_by: Dep[]
  time: { entries: TimeEntry[]; logged_mins: number; running: TimeEntry | null }
  files: FileRow[]
  can: { edit: boolean; comment: boolean }
}
type Editor = 'status' | 'priority' | 'owner' | 'dates' | 'link' | 'repeat' | 'watchers' | 'tags' | 'estimate' | 'log' | 'blocked' | 'more' | null

const REPEAT: { value: string; label: string }[] = [
  { value: 'none', label: 'Does not repeat' }, { value: 'daily', label: 'Every day' }, { value: 'weekly', label: 'Every week' },
  { value: 'monthly', label: 'Every month' }, { value: 'yearly', label: 'Every year' },
]

const CSS = `
.tkp{position:fixed;top:0;right:0;bottom:0;z-index:95;width:560px;max-width:100%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.06),-20px 0 50px -20px rgba(0,0,0,.35);display:flex;flex-direction:column}
.tkp-full{position:fixed;inset:0;z-index:96;overflow-y:auto;background-color:#EEF2F7;background-image:linear-gradient(180deg,#0E1726 0px,#1C2B47 150px,#E6ECF4 420px,#EEF2F7 640px);background-repeat:no-repeat;background-attachment:local}
.tkp-full-main{max-width:1440px;margin:0 auto;padding:20px 32px calc(48px + env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:16px}
.tkp-full-grid{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:20px;align-items:start}
.tkp-card{background:#fff;border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 20px -12px rgba(0,0,0,.18);padding:22px 26px;display:flex;flex-direction:column;gap:24px;min-width:0}
.tkp-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}
.tkp-top{display:flex;align-items:center;gap:6px;padding:12px 12px 0 20px}
.tkp-body{flex:1;overflow-y:auto;padding:12px 22px 28px;display:flex;flex-direction:column;gap:22px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.tkp-key{font:600 12px ui-monospace,SFMono-Regular,Menlo,monospace;color:${T.ink3}}
.tkp-ibtn{width:36px;height:36px;border:0;border-radius:8px;background:none;color:${T.ink3};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.tkp-ibtn:hover{background:rgba(0,0,0,.05);color:${T.ink}}
.tkp-title{width:100%;border:1px solid transparent;border-radius:8px;padding:4px 8px;margin:0 -8px;font-family:inherit;font-size:22px;font-weight:600;letter-spacing:-.02em;line-height:1.25;color:${T.ink};background:none;resize:none;field-sizing:content}
.tkp-title:hover{border-color:rgba(0,0,0,.12)}
.tkp-title:focus{outline:2px solid ${T.blue};outline-offset:-1px;border-color:transparent}
.tkp-props{display:grid;grid-template-columns:112px minmax(0,1fr);gap:2px 10px;align-items:center;font-size:13px}
.tkp-l{color:${T.ink3};display:flex;align-items:center;gap:8px;min-height:36px}
.tkp-cell{position:relative;min-width:0}
.tkp-val{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:36px;padding:4px 8px;margin-left:-8px;border-radius:8px;border:1px solid transparent;background:none;font-family:inherit;font-size:13px;color:${T.ink};text-align:left;cursor:pointer;width:calc(100% + 8px)}
.tkp-val:hover{background:#F5F5F7;border-color:rgba(0,0,0,.06)}
.tkp-val:disabled{cursor:default;background:none;border-color:transparent}
.tkp-val .add{color:${T.ink3}}
.tkp-chip{display:inline-flex;align-items:center;gap:4px;padding:1px 4px 1px 8px;border-radius:6px;font-size:12px;font-weight:500;background:#F2F2F4;color:${T.ink2};max-width:100%;text-align:left}
.tkp-chip .tk-sub{white-space:nowrap}
.tkp-chip button{border:0;background:none;color:inherit;opacity:.6;cursor:pointer;width:20px;height:20px;border-radius:4px;font-size:14px;line-height:1}
.tkp-chip button:hover{opacity:1;background:rgba(0,0,0,.06)}
.tkp-err{margin:8px 20px 0;padding:8px 12px;border-radius:10px;background:#FDECEA;color:#8A1209;font-size:13px;display:flex;gap:8px;align-items:flex-start}
.tkp-foot{display:flex;gap:8px;flex-wrap:wrap}
@media (max-width:1100px){.tkp-full-grid{grid-template-columns:1fr}.tkp-two{grid-template-columns:1fr}}
@media (max-width:899px){.tkp-full-main{padding:14px 16px 48px}.tkp-card{padding:18px}}
`

const ic = (d: string, size = 16) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
const I = {
  status: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 01-3 3H3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  tag: '<path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
  block: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
  expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
  collapse: '<path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
}

const mins = (m: number | null | undefined) => {
  if (!m) return '0m'
  const h = Math.floor(m / 60), r = m % 60
  return h ? `${h}h${r ? ` ${r}m` : ''}` : `${r}m`
}

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? 'That did not save.')
  return data
}

export function TaskPanel({ taskId, row, allTasks, people, me, expanded, onExpand, onClose, onOpen, onRowChange, onRowAdd, onRowRemove }: {
  taskId: string
  row: Task | null
  allTasks: Task[]
  people: Person[]
  me: string
  expanded: boolean
  onExpand: (v: boolean) => void
  onClose: () => void
  onOpen: (id: string) => void
  onRowChange: (id: string, changes: Partial<Task>) => void
  onRowAdd: (t: Task) => void
  onRowRemove: (id: string) => void
}) {
  const [d, setD] = useState<Detail | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [ed, setEd] = useState<Editor>(null)
  const [title, setTitle] = useState(row?.title ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [estDraft, setEstDraft] = useState('')
  const [logDraft, setLogDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [tick, setTick] = useState(0)

  const fail = useCallback((e: unknown) => setErr(e instanceof Error ? e.message : 'That did not save.'), [])
  const close = useCallback(() => setEd(null), [])

  const reload = useCallback(async () => {
    try {
      const data = (await api('GET', `/api/todos/${taskId}`)) as Detail
      setD(data); setTitle(data.todo.title)
      const t = data.todo
      onRowChange(taskId, {
        title: t.title, status: t.status, priority: t.priority, due_date: t.due_date, start_date: t.start_date,
        assigned_to: t.assigned_to, assigned_to_name: t.assigned_to_name, linked_type: t.linked_type, linked_id: t.linked_id,
        linked_label: t.linked_label, tags: t.tags, watcher_ids: t.watcher_ids, waiting_on: t.waiting_on, key: t.key,
        checklist_total: data.checklist.length, checklist_done: data.checklist.filter(i => i.done).length,
      })
    } catch (e) { fail(e) }
  }, [taskId, onRowChange, fail])
  useEffect(() => { void reload() }, [reload])

  // Running timer display ticks every 30 s.
  useEffect(() => {
    if (!d?.time.running) return
    const t = setInterval(() => setTick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [d?.time.running])

  const t = d?.todo ?? (row as Detail['todo'] | null)
  const can = d?.can ?? { edit: false, comment: false }

  const save = useCallback(async (updates: Record<string, unknown>) => {
    if (!d) return
    setErr(null)
    setD({ ...d, todo: { ...d.todo, ...updates } as Detail['todo'] })   // show it now
    onRowChange(taskId, updates as Partial<Task>)
    try {
      const res = await api('PATCH', `/api/todos/${taskId}`, updates)
      if (res?.spawned) onRowAdd({ ...(res.spawned as Task), key: res.spawned.task_number ? `T-${res.spawned.task_number}` : undefined })
    } catch (e) { fail(e) }
    await reload()
  }, [d, taskId, onRowChange, onRowAdd, fail, reload])

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setErr(null)
    try { await fn() } catch (e) { fail(e) }
    await reload()
  }, [fail, reload])

  // ── actions ────────────────────────────────────────────────────────────────
  const pickLink = (r: RecordHit) => {
    if (!t?.linked_id) void save({ linked_type: r.type, linked_id: r.id, linked_label: r.label })
    else void run(() => api('POST', `/api/todos/${taskId}/links`, { kind: 'link', linked_type: r.type, linked_id: r.id, linked_label: r.label }))
  }
  const removePrimaryLink = () => {
    const next = d?.links[0]
    if (next) {
      void (async () => {
        await save({ linked_type: next.linked_type, linked_id: next.linked_id, linked_label: next.linked_label })
        await run(() => api('DELETE', `/api/todos/${taskId}/links?kind=link&link_id=${next.id}`))
      })()
    } else void save({ linked_type: null, linked_id: null, linked_label: null })
  }
  const toggleWatcher = (p: Person | null) => {
    if (!p || !t) return
    const cur = t.watcher_ids ?? []
    void save({ watcher_ids: cur.includes(p.id) ? cur.filter(x => x !== p.id) : [...cur, p.id] })
  }
  const duplicate = async () => {
    if (!t) return
    setEd(null)
    try {
      const row2 = await api('POST', '/api/todos', {
        title: `Copy of ${t.title}`, body: t.body ?? null, priority: t.priority, due_date: t.due_date, start_date: t.start_date ?? null,
        assigned_to: t.assigned_to ?? undefined, assigned_to_name: t.assigned_to_name ?? undefined, tags: t.tags ?? [],
        linked_type: t.linked_type ?? undefined, linked_id: t.linked_id ?? undefined, linked_label: t.linked_label ?? undefined,
      })
      onRowAdd(row2 as Task); onOpen((row2 as Task).id)
    } catch (e) { fail(e) }
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/?tab=my-day&task=${taskId}`); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
    setEd(null)
  }
  const remove = async () => {
    try { await api('DELETE', `/api/todos/${taskId}`); onRowRemove(taskId) } catch (e) { fail(e); setConfirmDelete(false) }
  }
  const snooze = () => { if (t) void save({ due_date: addDays(t.due_date && t.due_date >= localISO() ? t.due_date : localISO(), 1) }); setEd(null) }

  const tagSuggestions = useMemo(() => Array.from(new Set(allTasks.flatMap(x => x.tags ?? []))).sort(), [allTasks])
  const peopleById = useMemo(() => new Map(people.map(p => [p.id, p])), [people])

  if (!t) {
    return (
      <aside className="tkp" aria-label="Task">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="tkp-top"><span style={{ flex: 1 }} /><button type="button" className="tkp-ibtn" onClick={onClose} aria-label="Close">{ic(I.x)}</button></div>
        {err ? <div className="tkp-err" role="alert">{err}</div> : <div className="tk-empty">Loading task…</div>}
      </aside>
    )
  }

  const done = t.status === 'done'
  const late = isOverdue(t)
  const st = STATUS.find(s => s.key === t.status) ?? STATUS[0]
  const running = d?.time.running
  const logged = (d?.time.logged_mins ?? 0) + (running ? Math.max(0, Math.round((Date.now() - new Date(running.started_at).getTime()) / 60000)) : 0)
  void tick

  // A property row: label + a value button that opens its editor (or plain text when read-only).
  const prop = (key: Exclude<Editor, null | 'more' | 'log'>, icon: string, label: string, value: ReactNode, editor: ReactNode, extra?: ReactNode) => (
    <>
      <span className="tkp-l">{ic(icon)}{label}</span>
      <div className="tkp-cell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button type="button" className="tkp-val" disabled={!can.edit} aria-haspopup="dialog" aria-expanded={ed === key} onClick={() => setEd(ed === key ? null : key)} style={{ flex: '1 1 170px' }}>{value}</button>
          {extra}
        </div>
        {ed === key && can.edit && editor}
      </div>
    </>
  )

  // A row of removable chips + an "add" button that opens its editor.
  const chipProp = (key: Exclude<Editor, null | 'more' | 'log'>, icon: string, label: string, chips: ReactNode, addLabel: string, empty: string, hasChips: boolean, editor: ReactNode) => (
    <>
      <span className="tkp-l">{ic(icon)}{label}</span>
      <div className="tkp-cell">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 36 }}>
          {chips}
          {can.edit
            ? <button type="button" className="tkp-val" style={{ width: 'auto', margin: 0, minHeight: 28, padding: '0 6px' }} aria-haspopup="dialog" aria-expanded={ed === key} onClick={() => setEd(ed === key ? null : key)}><span className="add">{hasChips ? addLabel : empty}</span></button>
            : !hasChips && <span className="tk-sub">{empty.replace(/^\+ /, '')}</span>}
        </div>
        {ed === key && can.edit && editor}
      </div>
    </>
  )

  const props = (
    <div className="tkp-props">
      {prop('status', I.status, 'Status',
        <><span className="tk-st" style={{ background: st.bg, color: st.fg }}><span className="tk-dot" style={{ background: st.dot }} />{st.label}</span>
          {t.status === 'waiting' && t.waiting_on && <span className="tk-sub">on {WAITING_ON.find(w => w.key === t.waiting_on)?.label.toLowerCase() ?? t.waiting_on}</span>}</>,
        <StatusEditor status={t.status} waitingOn={t.waiting_on ?? null} onClose={close} onPick={(s, w) => void save({ status: s, waiting_on: s === 'waiting' ? (w ?? 'parts') : null })} />)}
      {prop('priority', I.flag, 'Priority', <PriorityIcon p={t.priority} label />,
        <OptionsEditor label="Priority" value={t.priority} onClose={close}
          options={(Object.keys(PRIORITY) as TaskPriority[]).map(p => ({ value: p, label: <PriorityIcon p={p} label /> }))}
          onPick={p => { void save({ priority: p }); close() }} />)}
      {prop('owner', I.user, 'Owner',
        t.assigned_to ? <><span className="tk-av">{initials(t.assigned_to_name)}</span>{t.assigned_to_name ?? 'Someone'}</> : <span className="add">Unassigned</span>,
        <PeoplePicker label="Choose owner" people={people} me={me} selected={t.assigned_to ? [t.assigned_to] : []} onClose={close}
          onPick={p => void save({ assigned_to: p?.id ?? null, assigned_to_name: p?.name ?? null })} />)}
      {prop('dates', I.cal, 'Dates',
        (t.start_date || t.due_date)
          ? <>{t.start_date && <span className="tk-due">Start {fmtDue(t.start_date)}</span>}{t.start_date && t.due_date && <span className="tk-sub">→</span>}
              {t.due_date && <span className={`tk-due${late ? ' late' : ''}`}>{late ? 'Overdue · ' : 'Due '}{fmtDue(t.due_date)}</span>}</>
          : <span className="add">No dates</span>,
        <DatesEditor start={t.start_date ?? null} due={t.due_date} onClose={close} onSave={(s, du) => void save({ start_date: s, due_date: du })} />)}
      {chipProp('link', I.link, 'Linked to',
        <>
          {t.linked_label && (
            <span className="tkp-chip">{t.linked_label}<span className="tk-sub" style={{ fontSize: 11 }}>{linkTypeLabel(t.linked_type)}</span>
              {can.edit && <button type="button" aria-label={`Unlink ${t.linked_label}`} onClick={removePrimaryLink}>×</button>}</span>
          )}
          {d?.links.map(l => (
            <span key={l.id} className="tkp-chip">{l.linked_label ?? l.linked_type}<span className="tk-sub" style={{ fontSize: 11 }}>{linkTypeLabel(l.linked_type)}</span>
              {can.edit && <button type="button" aria-label={`Unlink ${l.linked_label ?? l.linked_type}`} onClick={() => void run(() => api('DELETE', `/api/todos/${taskId}/links?kind=link&link_id=${l.id}`))}>×</button>}</span>
          ))}
        </>,
        '+ Link', '+ Link a site, customer or work order', !!t.linked_label || (d?.links.length ?? 0) > 0,
        <RecordSearch onClose={close} onPick={pickLink} />)}
      {prop('repeat', I.repeat, 'Repeat',
        (t.recurrence_type && t.recurrence_type !== 'none') ? <>{REPEAT.find(r => r.value === t.recurrence_type)?.label}{!t.due_date && <span className="tk-sub">· needs a due date</span>}</> : <span className="add">Does not repeat</span>,
        <OptionsEditor label="Repeat" value={t.recurrence_type ?? 'none'} onClose={close}
          options={REPEAT} onPick={v => { void save({ recurrence_type: v }); close() }}
          footer={<div className="tkp-note" style={{ padding: '8px 10px', fontSize: 12, color: T.ink3 }}>The next copy is created when this one is marked done.</div>} />)}
      {prop('watchers', I.eye, 'Watchers',
        <>{(t.watcher_ids ?? []).map(id => <span key={id} className="tk-av" title={peopleById.get(id)?.name}>{peopleById.get(id)?.initials ?? '?'}</span>)}<span className="add">{(t.watcher_ids ?? []).length ? '+ Add' : 'No watchers'}</span></>,
        <PeoplePicker label="Watchers" multi people={people} me={me} selected={t.watcher_ids ?? []} onClose={close} onPick={toggleWatcher} />)}
      {chipProp('tags', I.tag, 'Tags',
        <>{(t.tags ?? []).map(tag => (
          <span key={tag} className="tkp-chip" style={{ background: '#EFEAFB', color: '#5B3BB0' }}>{tag}
            {can.edit && <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => void save({ tags: (t.tags ?? []).filter(x => x !== tag) })}>×</button>}</span>
        ))}</>,
        '+ Tag', '+ Add a tag', (t.tags ?? []).length > 0,
        <TagsEditor tags={t.tags ?? []} suggestions={tagSuggestions} onClose={close} onSave={tags => void save({ tags })} />)}
      {prop('estimate', I.clock, 'Time',
        <><span>{mins(logged)} logged</span>{t.estimate_mins ? <span className="tk-sub">of {mins(t.estimate_mins)} estimate</span> : <span className="add">· set estimate</span>}</>,
        <Pop label="Estimate" onClose={close}>
          <form onSubmit={e => { e.preventDefault(); const h = Number(estDraft); void save({ estimate_mins: Number.isFinite(h) && h > 0 ? Math.round(h * 60) : null }); close() }} style={{ display: 'flex', gap: 8, padding: 4, alignItems: 'center' }}>
            <label className="tk-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Estimate (hours)
              <input autoFocus className="tk-input" type="number" min="0" step="0.25" style={{ width: 90 }} value={estDraft} onChange={e => setEstDraft(e.target.value)} placeholder={t.estimate_mins ? String(t.estimate_mins / 60) : '2'} /></label>
            <button type="submit" className="tk-btn pri" style={{ minHeight: 34 }}>Set</button>
          </form>
        </Pop>,
        can.edit ? (
          <span style={{ position: 'relative', display: 'inline-flex', gap: 6 }}>
            <button type="button" className="tk-btn" style={{ minHeight: 32, fontSize: 13, padding: '0 10px' }}
              onClick={() => void run(() => api('POST', `/api/todos/${taskId}/time`, { action: running ? 'stop' : 'start' }))}>
              {running ? <><span className="tk-dot" style={{ background: '#FF3B30' }} />Stop</> : <>▶ Start timer</>}
            </button>
            <button type="button" className="tk-btn" style={{ minHeight: 32, fontSize: 13, padding: '0 10px' }} onClick={() => setEd(ed === 'log' ? null : 'log')} aria-expanded={ed === 'log'}>+ Log</button>
            {ed === 'log' && (
              <Pop label="Log time" align="right" onClose={close}>
                <form onSubmit={e => { e.preventDefault(); const m = Math.round(Number(logDraft)); if (m > 0) { void run(() => api('POST', `/api/todos/${taskId}/time`, { action: 'log', minutes: m })); setLogDraft('') } close() }} style={{ display: 'flex', gap: 8, padding: 4, alignItems: 'center' }}>
                  <label className="tk-sub" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Minutes
                    <input autoFocus className="tk-input" type="number" min="1" max="1440" style={{ width: 90 }} value={logDraft} onChange={e => setLogDraft(e.target.value)} placeholder="30" /></label>
                  <button type="submit" className="tk-btn pri" style={{ minHeight: 34 }}>Add</button>
                </form>
              </Pop>
            )}
          </span>
        ) : undefined)}
      {chipProp('blocked', I.block, 'Blocked by',
        <>{(d?.blocked_by ?? []).map(b => (
          <span key={b.id} className="tkp-chip" style={b.todos?.status === 'done' ? undefined : { background: '#FDECEA', color: '#B3150C' }}>
            <button type="button" style={{ width: 'auto', height: 'auto', opacity: 1, fontSize: 12, fontWeight: 500, padding: 0, textAlign: 'left', color: 'inherit' }} onClick={() => { if (b.todos) onOpen(b.todos.id) }}>
              {b.todos?.task_number ? `T-${b.todos.task_number} ` : ''}{b.todos?.title ?? 'Task'}{b.todos?.status === 'done' ? ' (done)' : ''}
            </button>
            {can.edit && <button type="button" aria-label="Remove blocker" onClick={() => void run(() => api('DELETE', `/api/todos/${taskId}/links?kind=blocked_by&dep_id=${b.id}`))}>×</button>}
          </span>
        ))}</>,
        '+ Add', '+ Not blocked — add a blocker', (d?.blocked_by ?? []).length > 0,
        <TaskSearch tasks={allTasks} exclude={[taskId, ...(d?.blocked_by ?? []).map(b => b.blocked_by_todo_id)]} onClose={close}
          onPick={o => void run(() => api('POST', `/api/todos/${taskId}/links`, { kind: 'blocked_by', blocked_by_todo_id: o.id }))} />)}
    </div>
  )

  const titleBlock = (
    <div>
      {d?.parent && (
        <button type="button" className="tk-back" style={{ color: T.blue, minHeight: 28, padding: 0, fontSize: 13 }} onClick={() => onOpen(d.parent!.id)}>
          {ic(I.up, 14)}Subtask of {d.parent.task_number ? `T-${d.parent.task_number} ` : ''}{d.parent.title}
        </button>
      )}
      <label className="tk-sr" htmlFor={`tkp-title-${taskId}`}>Title</label>
      <textarea id={`tkp-title-${taskId}`} className="tkp-title" rows={2} readOnly={!can.edit} value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={() => { const v = title.trim(); if (v && v !== t.title) void save({ title: v }); else setTitle(t.title) }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }} />
      <div className="tk-sub" style={{ marginTop: 4 }}>
        {t.created_by_name ? `Created by ${t.created_by_name}` : 'Created'}{t.created_at ? ` · ${new Date(t.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : ''}
        {!can.edit && d && ' · view only'}
      </div>
    </div>
  )

  const moreMenu = ed === 'more' && (
    <Pop label="More actions" align="right" onClose={() => { close(); setConfirmDelete(false) }}>
      {!done && can.edit && <button type="button" className="tkp-opt" onClick={snooze}>Snooze 1 day</button>}
      <button type="button" className="tkp-opt" onClick={() => void duplicate()}>Duplicate task</button>
      <button type="button" className="tkp-opt" onClick={() => void copyLink()}>Copy link</button>
      {can.edit && (
        <>
          <div className="tkp-sep" />
          {confirmDelete
            ? <button type="button" className="tkp-opt" style={{ color: '#B3150C', fontWeight: 600 }} onClick={() => void remove()}>Yes, delete {d?.subtasks.length ? `it and ${d.subtasks.length} subtask${d.subtasks.length === 1 ? '' : 's'}` : 'this task'}</button>
            : <button type="button" className="tkp-opt" style={{ color: '#B3150C' }} onClick={() => setConfirmDelete(true)}>Delete task…</button>}
        </>
      )}
    </Pop>
  )

  const markDone = can.edit && (
    <button type="button" className={`tk-btn${done ? '' : ' pri'}`} style={{ minHeight: 34, fontSize: 13 }} onClick={() => void save({ status: done ? 'open' : 'done' })}>
      {ic(I.check, 14)}{done ? 'Reopen' : 'Mark done'}
    </button>
  )

  const sections = {
    checklist: d && <Checklist taskId={taskId} items={d.checklist} canEdit={can.edit} onChanged={() => void reload()} onFail={fail} />,
    subtasks: d && <Subtasks taskId={taskId} items={d.subtasks} canEdit={can.edit} onOpen={onOpen} onFail={fail}
      onChanged={(id, ch) => { onRowChange(id, ch); void reload() }} onAdded={r => { onRowAdd(r); void reload() }} />,
    description: d && <Description key={`${taskId}-desc`} value={t.body ?? ''} canEdit={can.edit} onSave={v => void save({ body: v || null })} />,
    files: d && <Files taskId={taskId} files={d.files} canEdit={can.edit} me={me} onChanged={() => void reload()} onFail={fail} />,
    activity: d && <ActivitySection taskId={taskId} comments={d.comments} activity={d.activity} people={people} me={me} canComment={can.comment} onChanged={() => void reload()} onFail={fail} />,
  }

  const errBox = err && (
    <div className="tkp-err" role="alert"><span style={{ flex: 1 }}>{err}</span><button type="button" className="tkp-ibtn" style={{ width: 24, height: 24 }} onClick={() => setErr(null)} aria-label="Dismiss">{ic(I.x, 14)}</button></div>
  )

  if (expanded) {
    return (
      <div className="tkp-full" role="dialog" aria-label={`Task ${t.key ?? ''}: ${t.title}`}>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <SectionStyles />
        <div className="tkp-full-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <button type="button" className="tk-back" style={{ color: '#8EC1FF' }} onClick={onClose}>{ic(I.back)}Tasks</button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#C9D2E0', fontSize: 13 }}>
                <span className="tkp-key" style={{ color: '#C9D2E0' }}>{t.key}</span>{t.linked_label && <span>{t.linked_label}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="tk-btn" style={{ minHeight: 34, fontSize: 13, background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }} onClick={() => onExpand(false)}>{ic(I.collapse, 14)}Back to panel</button>
              <button type="button" className="tk-btn" style={{ minHeight: 34, fontSize: 13, background: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,255,255,.2)', color: '#fff' }} onClick={() => void copyLink()}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
          </div>
          {errBox}
          <div className="tkp-full-grid">
            <section className="tkp-card" aria-label="Task">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>{titleBlock}</div>
                {markDone}
                <span style={{ position: 'relative' }}><button type="button" className="tkp-ibtn" aria-label="More actions" aria-expanded={ed === 'more'} onClick={() => setEd(ed === 'more' ? null : 'more')}>{ic(I.more)}</button>{moreMenu}</span>
              </div>
              {sections.description}
              <div className="tkp-two">{sections.checklist}{sections.subtasks}</div>
              {sections.files}
              {sections.activity}
            </section>
            <aside className="tkp-card" style={{ padding: '18px 20px', gap: 12 }} aria-label="Details">
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink3, letterSpacing: '.02em', textTransform: 'uppercase' }}>Details</div>
              {props}
            </aside>
          </div>
        </div>
      </div>
    )
  }

  return (
    <aside className="tkp" role="dialog" aria-label={`Task ${t.key ?? ''}: ${t.title}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SectionStyles />
      <div className="tkp-top">
        <span className="tkp-key">{t.key}</span>
        {t.linked_type === 'work_order' && <span className="tk-tag wo">Work order</span>}
        <span style={{ flex: 1 }} />
        {markDone}
        <button type="button" className="tkp-ibtn" onClick={() => onExpand(true)} aria-label="Open full page" title="Open full page">{ic(I.expand)}</button>
        <span style={{ position: 'relative' }}><button type="button" className="tkp-ibtn" aria-label="More actions" aria-expanded={ed === 'more'} onClick={() => setEd(ed === 'more' ? null : 'more')}>{ic(I.more)}</button>{moreMenu}</span>
        <button type="button" className="tkp-ibtn" onClick={onClose} aria-label="Close task">{ic(I.x)}</button>
      </div>
      {copied && <div className="tk-sub" style={{ padding: '4px 20px 0' }}>Link copied.</div>}
      {errBox}
      <div className="tkp-body">
        {titleBlock}
        {props}
        {sections.checklist}
        {sections.subtasks}
        {sections.description}
        {sections.files}
        {sections.activity}
      </div>
    </aside>
  )
}

export default TaskPanel
