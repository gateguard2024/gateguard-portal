'use client'

/** Sections inside a task: checklist, subtasks, description, files, comments + history. */
import { useMemo, useRef, useState } from 'react'
import { StatusPill, T, fmtDue, initials, isOverdue, type Person, type Task } from './shared'

export type ChecklistItem = { id: string; title: string; done: boolean; sort_order: number }
export type Subtask = { id: string; title: string; status: Task['status']; due_date: string | null; assigned_to: string | null; assigned_to_name: string | null; key: string }
export type Comment = { id: string; author_user_id: string; author_name: string | null; body: string; mention_ids: string[]; created_at: string; edited_at: string | null }
export type Activity = { id: string; user_name: string | null; action: string; field_name: string | null; old_value: string | null; new_value: string | null; created_at: string }
export type FileRow = { id: string; name: string; url: string; size_bytes: number | null; mime_type: string | null; uploaded_by: string; created_at: string }

const CSS = `
.tks-sec{display:flex;flex-direction:column;gap:8px}
.tks-h{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:32px}
.tks-h b{font-size:12px;font-weight:600;color:${T.ink3};letter-spacing:.02em;text-transform:uppercase}
.tks-link{border:0;background:none;color:${T.blue};font-family:inherit;font-size:13px;font-weight:500;cursor:pointer;min-height:32px;padding:0 4px}
.tks-prog{height:6px;border-radius:3px;background:#E5E5EA;overflow:hidden}
.tks-prog span{display:block;height:100%;background:#34C759;transition:width .2s}
.tks-ck{display:flex;align-items:center;gap:10px;min-height:38px;padding:0 6px;border-radius:8px}
.tks-ck:hover{background:#F7F7F9}
.tks-ck.drag-over{box-shadow:inset 0 2px 0 ${T.blue}}
.tks-ck input[type=checkbox]{width:18px;height:18px;margin:0;accent-color:${T.blue};flex:none;cursor:pointer}
.tks-grip{color:#C7C7CC;cursor:grab;font-size:12px;letter-spacing:-2px;user-select:none;padding:0 2px}
.tks-x{opacity:0;border:0;background:none;color:${T.ink3};cursor:pointer;width:28px;height:28px;border-radius:6px;font-size:16px;flex:none}
.tks-ck:hover .tks-x,.tks-sub:hover .tks-x,.tks-file:hover .tks-x,.tks-x:focus-visible{opacity:1}
.tks-x:hover{background:rgba(0,0,0,.06)}
.tks-add{display:flex;align-items:center;gap:10px;padding:0 6px}
.tks-add input{border:0;font-family:inherit;font-size:14px;min-height:36px;flex:1;outline:none;background:none;color:${T.ink}}
.tks-sub{display:grid;grid-template-columns:20px 1fr auto auto auto 28px;gap:10px;align-items:center;min-height:42px;padding:0 6px;border-bottom:1px solid rgba(0,0,0,.05)}
.tks-sub input{width:16px;height:16px;margin:0;accent-color:${T.blue}}
.tks-title{border:0;background:none;padding:0;font-family:inherit;font-size:14px;font-weight:500;color:${T.ink};text-align:left;cursor:pointer;min-width:0}
.tks-title:hover{color:${T.blue}}
.tks-key{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:${T.ink3};margin-right:6px}
.tks-desc{width:100%;min-height:88px;padding:10px 12px;border-radius:10px;border:1px solid transparent;background:#F7F7F9;font-family:inherit;font-size:14px;line-height:1.45;color:${T.ink};resize:vertical}
.tks-desc:hover{border-color:rgba(0,0,0,.08)}
.tks-desc:focus{background:#fff;outline:2px solid ${T.blue};outline-offset:-1px}
.tks-files{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
.tks-file{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(0,0,0,.08);border-radius:10px;background:#fff;min-width:0}
.tks-thumb{width:36px;height:36px;border-radius:6px;background:#E5E9F0;display:flex;align-items:center;justify-content:center;color:${T.ink3};font-size:10px;font-weight:700;flex:none;overflow:hidden}
.tks-thumb img{width:100%;height:100%;object-fit:cover}
.tks-drop{border:1.5px dashed rgba(0,0,0,.15);border-radius:10px;padding:12px;text-align:center;color:${T.ink3};font-size:13px;cursor:pointer;background:none;font-family:inherit;width:100%}
.tks-drop.over{border-color:${T.blue};background:#F0F6FE;color:${T.blueDark}}
.tks-tabs{display:flex;gap:18px;border-bottom:1px solid rgba(0,0,0,.08)}
.tks-tabs button{border:0;background:none;padding:0 0 10px;font-family:inherit;font-size:13px;font-weight:600;color:${T.ink3};border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer}
.tks-tabs button[aria-selected=true]{color:${T.ink};border-bottom-color:${T.blue}}
.tks-cm{display:flex;gap:10px}
.tks-cm p{margin:3px 0 0;font-size:14px;white-space:pre-wrap;word-break:break-word}
.tks-mention{color:${T.blueDark};background:#E8F1FD;border-radius:4px;padding:0 3px}
.tks-composer{border:1px solid rgba(0,0,0,.14);border-radius:12px;background:#fff;padding:10px 12px;display:flex;flex-direction:column;gap:8px;position:relative}
.tks-composer:focus-within{border-color:${T.blue}}
.tks-composer textarea{border:0;resize:none;font-family:inherit;font-size:14px;min-height:44px;outline:none;color:${T.ink}}
.tks-ment-pop{position:absolute;left:10px;bottom:calc(100% + 4px);z-index:20;background:#fff;border-radius:10px;box-shadow:0 0 0 1px rgba(0,0,0,.08),0 12px 30px -10px rgba(0,0,0,.35);padding:4px;min-width:220px}
.tks-hist{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:${T.ink2};min-height:26px}
`

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error ?? 'That did not save.')
  return data
}
export type Fail = (e: unknown) => void

export function SectionStyles() { return <style dangerouslySetInnerHTML={{ __html: CSS }} /> }

// ── Checklist ────────────────────────────────────────────────────────────────
export function Checklist({ taskId, items, canEdit, onChanged, onFail }: { taskId: string; items: ChecklistItem[]; canEdit: boolean; onChanged: () => void; onFail: Fail }) {
  const [draft, setDraft] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [local, setLocal] = useState<ChecklistItem[] | null>(null)
  const list = local ?? items
  const done = list.filter(i => i.done).length
  const shown = hideDone ? list.filter(i => !i.done) : list
  const url = `/api/todos/${taskId}/checklist`

  const run = async (fn: () => Promise<unknown>) => { try { await fn() } catch (e) { onFail(e) } finally { setLocal(null); onChanged() } }
  const toggle = (i: ChecklistItem) => { setLocal(list.map(x => (x.id === i.id ? { ...x, done: !x.done } : x))); void run(() => api('PATCH', url, { item_id: i.id, done: !i.done })) }
  const remove = (i: ChecklistItem) => { setLocal(list.filter(x => x.id !== i.id)); void run(() => api('DELETE', `${url}?item_id=${i.id}`)) }
  const add = () => { const t = draft.trim(); if (!t) return; setDraft(''); void run(() => api('POST', url, { title: t })) }
  const drop = (targetId: string) => {
    if (!dragId || dragId === targetId) return
    const order = list.map(x => x.id).filter(id => id !== dragId)
    order.splice(order.indexOf(targetId), 0, dragId)
    setLocal(order.map(id => list.find(x => x.id === id)!))
    void run(() => api('PATCH', url, { order }))
  }

  return (
    <section className="tks-sec" aria-label="Checklist">
      <div className="tks-h"><b>Checklist{list.length ? ` · ${done} of ${list.length}` : ''}</b>{done > 0 && <button type="button" className="tks-link" onClick={() => setHideDone(h => !h)}>{hideDone ? 'Show done' : 'Hide done'}</button>}</div>
      {list.length > 0 && <div className="tks-prog" role="progressbar" aria-valuenow={done} aria-valuemax={list.length} aria-label="Checklist progress"><span style={{ width: `${(done / list.length) * 100}%` }} /></div>}
      <div>
        {shown.map(i => (
          <div key={i.id} className={`tks-ck${overId === i.id ? ' drag-over' : ''}`}
            draggable={canEdit} onDragStart={() => setDragId(i.id)} onDragEnd={() => { setDragId(null); setOverId(null) }}
            onDragOver={e => { if (dragId) { e.preventDefault(); setOverId(i.id) } }} onDragLeave={() => setOverId(null)} onDrop={e => { e.preventDefault(); drop(i.id); setOverId(null) }}>
            {canEdit && <span className="tks-grip" aria-hidden="true">⋮⋮</span>}
            <input type="checkbox" checked={i.done} disabled={!canEdit} onChange={() => toggle(i)} aria-label={`${i.done ? 'Uncheck' : 'Check'}: ${i.title}`} />
            <span style={{ flex: 1, ...(i.done ? { color: T.ink3, textDecoration: 'line-through' } : {}) }}>{i.title}</span>
            {canEdit && <button type="button" className="tks-x" onClick={() => remove(i)} aria-label={`Remove ${i.title}`}>×</button>}
          </div>
        ))}
      </div>
      {canEdit && (
        <form className="tks-add" onSubmit={e => { e.preventDefault(); add() }}>
          <span style={{ color: T.blue, fontSize: 18, lineHeight: 1 }} aria-hidden="true">+</span>
          <label className="tk-sr" htmlFor={`ck-${taskId}`}>Add checklist item</label>
          <input id={`ck-${taskId}`} placeholder="Add an item — press Enter" value={draft} onChange={e => setDraft(e.target.value)} />
        </form>
      )}
    </section>
  )
}

// ── Subtasks ─────────────────────────────────────────────────────────────────
export function Subtasks({ taskId, items, canEdit, onOpen, onChanged, onAdded, onFail }: {
  taskId: string; items: Subtask[]; canEdit: boolean; onOpen: (id: string) => void; onChanged: (id: string, changes: Partial<Task>) => void; onAdded: (t: Task) => void; onFail: Fail
}) {
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const done = items.filter(s => s.status === 'done').length
  const toggle = async (s: Subtask) => {
    const status = s.status === 'done' ? 'open' : 'done'
    try { await api('PATCH', `/api/todos/${s.id}`, { status }); onChanged(s.id, { status }) } catch (e) { onFail(e) }
  }
  const add = async () => {
    const t = draft.trim(); if (!t) return
    setDraft('')
    try { const row = await api('POST', '/api/todos', { title: t, parent_task_id: taskId }); onAdded(row as Task) } catch (e) { onFail(e) }
  }
  return (
    <section className="tks-sec" aria-label="Subtasks">
      <div className="tks-h"><b>Subtasks{items.length ? ` · ${done} of ${items.length}` : ''}</b>{canEdit && <button type="button" className="tks-link" onClick={() => setAdding(true)}>+ Add subtask</button>}</div>
      <div>
        {items.map(s => {
          const late = isOverdue(s as unknown as Task)
          return (
            <div key={s.id} className="tks-sub">
              <input type="checkbox" checked={s.status === 'done'} disabled={!canEdit} onChange={() => void toggle(s)} aria-label={`Done: ${s.title}`} />
              <button type="button" className="tks-title" onClick={() => onOpen(s.id)} style={s.status === 'done' ? { color: T.ink3, textDecoration: 'line-through' } : undefined}>
                <span className="tks-key">{s.key}</span>{s.title}
              </button>
              <StatusPill s={s.status} />
              <span className="tk-av" title={s.assigned_to_name ?? 'Unassigned'}>{initials(s.assigned_to_name)}</span>
              <span className={`tk-due${late ? ' late' : ''}`}>{fmtDue(s.due_date)}</span>
              <span />
            </div>
          )
        })}
      </div>
      {canEdit && adding && (
        <form className="tks-add" onSubmit={e => { e.preventDefault(); void add() }}>
          <span style={{ color: T.blue, fontSize: 18, lineHeight: 1 }} aria-hidden="true">+</span>
          <label className="tk-sr" htmlFor={`sub-${taskId}`}>New subtask</label>
          <input id={`sub-${taskId}`} autoFocus placeholder="Subtask title — press Enter" value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => { if (!draft.trim()) setAdding(false) }} />
        </form>
      )}
      {items.length === 0 && !adding && <span className="tk-sub">No subtasks.</span>}
    </section>
  )
}

// ── Description ──────────────────────────────────────────────────────────────
export function Description({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  return (
    <section className="tks-sec" aria-label="Description">
      <div className="tks-h"><b>Description</b></div>
      <label className="tk-sr" htmlFor="tks-desc">Description</label>
      <textarea id="tks-desc" className="tks-desc" placeholder={canEdit ? 'Add details…' : 'No description.'} readOnly={!canEdit} value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v) }} />
    </section>
  )
}

// ── Files ────────────────────────────────────────────────────────────────────
export function Files({ taskId, files, canEdit, me, isCorporate, onChanged, onFail }: { taskId: string; files: FileRow[]; canEdit: boolean; me: string; isCorporate?: boolean; onChanged: () => void; onFail: Fail }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const upload = async (list: FileList | File[]) => {
    setBusy(true)
    try {
      for (const f of Array.from(list)) {
        const fd = new FormData(); fd.append('file', f)
        const res = await fetch(`/api/todos/${taskId}/attachments`, { method: 'POST', body: fd })
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d?.error ?? `Could not upload ${f.name}.`) }
      }
    } catch (e) { onFail(e) } finally { setBusy(false); onChanged() }
  }
  const remove = async (f: FileRow) => {
    try { await api('DELETE', `/api/todos/${taskId}/attachments?attachment_id=${f.id}`) } catch (e) { onFail(e) } finally { onChanged() }
  }
  const isImg = (f: FileRow) => (f.mime_type ?? '').startsWith('image/')
  const ext = (f: FileRow) => (f.name.split('.').pop() ?? 'FILE').slice(0, 4).toUpperCase()
  return (
    <section className="tks-sec" aria-label="Files"
      onPaste={e => { if (canEdit && e.clipboardData.files.length) void upload(e.clipboardData.files) }}>
      <div className="tks-h"><b>Files{files.length ? ` · ${files.length}` : ''}</b>{canEdit && <button type="button" className="tks-link" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</button>}</div>
      {files.length > 0 && (
        <div className="tks-files">
          {files.map(f => (
            <div key={f.id} className="tks-file">
              <span className="tks-thumb">{isImg(f) ? <img src={f.url} alt="" /> : ext(f)}</span>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ minWidth: 0, flex: 1, fontSize: 13, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</a>
              {(f.uploaded_by === me || isCorporate) && <button type="button" className="tks-x" onClick={() => void remove(f)} aria-label={`Remove ${f.name}`}>×</button>}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <>
          <input ref={input} type="file" multiple hidden onChange={e => { if (e.target.files?.length) void upload(e.target.files); e.target.value = '' }} />
          <button type="button" className={`tks-drop${over ? ' over' : ''}`} onClick={() => input.current?.click()}
            onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
            onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files) }}>
            {busy ? 'Uploading…' : 'Drop files here, paste a photo, or click to choose'}
          </button>
        </>
      )}
    </section>
  )
}

// ── Comments + History ───────────────────────────────────────────────────────
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function renderBody(body: string, people: Person[]) {
  // Highlight "@Full Name" for people on the team.
  const names = people.map(p => p.name).filter(Boolean).sort((a, b) => b.length - a.length)
  if (names.length === 0) return body
  const esc = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = body.split(new RegExp(`(@(?:${esc.join('|')}))`, 'g'))
  return parts.map((p, i) => (p.startsWith('@') && names.includes(p.slice(1)) ? <span key={i} className="tks-mention">{p}</span> : p))
}

function historyLine(a: Activity) {
  const f = a.field_name
  if (a.action === 'created') return <>created this task</>
  if (a.action === 'commented') return <>commented</>
  if (f && a.old_value !== null && a.new_value !== null) return <>changed {f} <b>{a.old_value}</b> → <b>{a.new_value}</b></>
  if (f && a.new_value !== null) return <>{f.includes(' ') ? f : `set ${f} to`} <b>{a.new_value}</b></>
  if (f && a.old_value !== null) return <>{f.includes(' ') ? f : `cleared ${f}`} <b>{a.old_value}</b></>
  return <>{f ?? a.action}</>
}

export function ActivitySection({ taskId, comments, activity, people, me, canComment, onChanged, onFail }: {
  taskId: string; comments: Comment[]; activity: Activity[]; people: Person[]; me: string; canComment: boolean; onChanged: () => void; onFail: Fail
}) {
  const [tab, setTab] = useState<'comments' | 'history'>('comments')
  const [text, setText] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [mq, setMq] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const suggestions = useMemo(() => (mq === null ? [] : people.filter(p => p.id !== me && p.name.toLowerCase().includes(mq.toLowerCase())).slice(0, 6)), [mq, people, me])

  const onType = (v: string) => {
    setText(v)
    const caret = ta.current?.selectionStart ?? v.length
    const m = /@([\w .'-]{0,30})$/.exec(v.slice(0, caret))
    setMq(m ? m[1] : null)
  }
  const pick = (p: Person) => {
    const caret = ta.current?.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@([\w .'-]{0,30})$/, `@${p.name} `)
    setText(before + text.slice(caret)); setMq(null)
    setMentions(m => (m.includes(p.id) ? m : [...m, p.id]))
    setTimeout(() => ta.current?.focus(), 0)
  }
  const send = async () => {
    const body = text.trim(); if (!body) return
    setBusy(true)
    try {
      const ids = mentions.filter(id => { const p = people.find(x => x.id === id); return p && body.includes(`@${p.name}`) })
      await api('POST', `/api/todos/${taskId}/comments`, { body, mention_ids: ids })
      setText(''); setMentions([])
    } catch (e) { onFail(e) } finally { setBusy(false); onChanged() }
  }
  const remove = async (c: Comment) => { try { await api('DELETE', `/api/todos/${taskId}/comments?comment_id=${c.id}`) } catch (e) { onFail(e) } finally { onChanged() } }

  return (
    <section className="tks-sec" aria-label="Comments and history">
      <div className="tks-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'comments'} onClick={() => setTab('comments')}>Comments{comments.length ? ` · ${comments.length}` : ''}</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>History</button>
      </div>
      {tab === 'comments' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 6 }}>
          {comments.length === 0 && <span className="tk-sub">No comments yet.</span>}
          {comments.map(c => (
            <div key={c.id} className="tks-cm">
              <span className="tk-av" style={{ width: 28, height: 28, fontSize: 11 }}>{initials(c.author_name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name ?? 'Someone'}</span> <span className="tk-sub">{when(c.created_at)}{c.edited_at ? ' · edited' : ''}</span>
                {c.author_user_id === me && <button type="button" className="tks-link" style={{ minHeight: 0, fontSize: 12, color: T.ink3 }} onClick={() => void remove(c)}>Delete</button>}
                <p>{renderBody(c.body, people)}</p>
              </div>
            </div>
          ))}
          {canComment ? (
            <div className="tks-composer">
              {suggestions.length > 0 && (
                <div className="tks-ment-pop" role="listbox" aria-label="Mention someone" data-tk-pop="">
                  {suggestions.map(p => (
                    <button key={p.id} type="button" className="tkp-opt" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 36, width: '100%', border: 0, background: 'none', padding: '0 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}
                      onMouseDown={e => { e.preventDefault(); pick(p) }}>
                      <span className="tk-av">{p.initials}</span>{p.name}
                    </button>
                  ))}
                </div>
              )}
              <label className="tk-sr" htmlFor={`cm-${taskId}`}>Add a comment</label>
              <textarea id={`cm-${taskId}`} ref={ta} placeholder="Write a comment — type @ to mention someone" value={text}
                onChange={e => onType(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send() }
                  if (e.key === 'Enter' && suggestions.length > 0 && !e.shiftKey) { e.preventDefault(); pick(suggestions[0]) }
                  if (e.key === 'Escape' && mq !== null) { e.stopPropagation(); setMq(null) }
                }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="tk-sub" style={{ fontSize: 12 }}>@mentions get a notification · ⌘↵ to send</span>
                <span style={{ flex: 1 }} />
                <button type="button" className="tk-btn pri" style={{ minHeight: 32, fontSize: 13 }} disabled={busy || !text.trim()} onClick={() => void send()}>{busy ? 'Sending…' : 'Comment'}</button>
              </div>
            </div>
          ) : <span className="tk-sub">Only the owner, the creator and watchers can comment.</span>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6 }}>
          {activity.length === 0 && <span className="tk-sub">No history yet.</span>}
          {activity.map(a => (
            <div key={a.id} className="tks-hist">
              <span className="tk-dot" style={{ background: a.field_name === 'status' ? '#FF9500' : a.action === 'created' ? T.blue : '#8E8E93', marginTop: 6 }} />
              <span><b style={{ fontWeight: 600 }}>{a.user_name ?? 'Someone'}</b> {historyLine(a)} <span className="tk-sub">· {when(a.created_at)}</span></span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
