/**
 * Comments on a task (migration 194: todo_comments).
 * POST   { body, mention_ids?: string[] } — add a comment; @mentioned people + owner + watchers are notified
 * PATCH  { comment_id, body }            — edit your own comment
 * DELETE ?comment_id=…                   — delete your own comment (corporate: any)
 * Commenting needs edit rights or being a watcher.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/current-user'
import { supabaseAdmin as supabase, loadTodoFor, logActivity, notify, taskKey } from '@/lib/todo-activity'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'comment')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const todo = found.todo
    const { body, mention_ids } = await req.json()
    if (!body?.trim()) return NextResponse.json({ error: 'Comment is empty.' }, { status: 400 })
    const mentions: string[] = Array.isArray(mention_ids) ? mention_ids.filter((m: unknown) => typeof m === 'string') : []

    const { data, error } = await supabase.from('todo_comments')
      .insert({ todo_id: todo.id, author_user_id: caller.id, author_name: caller.name, body: body.trim(), mention_ids: mentions })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await logActivity(todo.id, caller, [{ action: 'commented' }])
    const label = `${taskKey(todo.task_number)} ${todo.title}`.trim()
    const snippet = data.body.length > 140 ? `${data.body.slice(0, 140)}…` : data.body
    await notify(mentions, caller, { type: 'task_mention', title: `${caller.name} mentioned you on ${label}`, body: snippet, todo })
    await notify(
      [todo.assigned_to, todo.created_by, ...(todo.watcher_ids ?? [])].filter(r => !mentions.includes(r as string)),
      caller,
      { type: 'task_comment', title: `${caller.name} commented on ${label}`, body: snippet, todo },
    )
    return NextResponse.json({ comment: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

async function ownComment(commentId: string, todoId: string) {
  return supabase.from('todo_comments').select('id, author_user_id').eq('id', commentId).eq('todo_id', todoId).maybeSingle()
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'comment')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const { comment_id, body } = await req.json()
    if (!comment_id || !body?.trim()) return NextResponse.json({ error: 'comment_id and body are required' }, { status: 400 })
    const { data: c } = await ownComment(comment_id, params.id)
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (c.author_user_id !== caller.id) return NextResponse.json({ error: 'You can only edit your own comments.' }, { status: 403 })
    const { data, error } = await supabase.from('todo_comments')
      .update({ body: body.trim(), edited_at: new Date().toISOString() }).eq('id', comment_id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comment: data })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const caller = await getCurrentUser()
    const found = await loadTodoFor(params.id, caller, 'comment')
    if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status })
    const commentId = new URL(req.url).searchParams.get('comment_id')
    if (!commentId) return NextResponse.json({ error: 'comment_id is required' }, { status: 400 })
    const { data: c } = await ownComment(commentId, params.id)
    if (!c) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (c.author_user_id !== caller.id && !caller.isCorporate) return NextResponse.json({ error: 'You can only delete your own comments.' }, { status: 403 })
    const { error } = await supabase.from('todo_comments').delete().eq('id', commentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
