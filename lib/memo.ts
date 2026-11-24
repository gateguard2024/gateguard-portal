/**
 * lib/memo.ts — keep a slow answer (Brivo, Eagle Eye, health) for a short time per
 * server, and share one in-flight request between callers asking at the same moment.
 * Failures are never kept. For live screens only — writes must not rely on it.
 */
const store = new Map<string, { at: number; value?: unknown; pending?: Promise<unknown> }>()

export async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit?.pending) return hit.pending as Promise<T>
  if (hit && 'value' in hit && Date.now() - hit.at < ttlMs) return hit.value as T
  const pending = fn().then(
    v => { store.set(key, { at: Date.now(), value: v }); return v },
    e => { store.delete(key); throw e },
  )
  store.set(key, { at: Date.now(), pending })
  if (store.size > 2000) store.delete(store.keys().next().value as string)
  return pending
}

export function forget(prefix: string) { for (const k of Array.from(store.keys())) if (k.startsWith(prefix)) store.delete(k) }
