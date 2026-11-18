/**
 * Removed technicians (migration 232: technicians.active = false).
 * A removed tech keeps their history but drops off dispatch, assignment and
 * pick-who-you-are lists, and their field-app code is cleared.
 * Drift-safe: before 232 runs the column is missing → nobody counts as removed.
 */
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function removedTechIds(): Promise<Set<string>> {
  const { data, error } = await db().from('technicians').select('id').eq('active', false)
  if (error) return new Set()
  return new Set((data ?? []).map((r: { id: string }) => r.id))
}

/** Drop removed techs from a list of rows that have an `id`. */
export async function withoutRemoved<T extends { id: string }>(rows: T[]): Promise<T[]> {
  const gone = await removedTechIds()
  return gone.size ? rows.filter((r) => !gone.has(r.id)) : rows
}

export async function isTechRemoved(id: string | null | undefined): Promise<boolean> {
  if (!id) return false
  return (await removedTechIds()).has(String(id))
}
