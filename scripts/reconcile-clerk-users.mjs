/**
 * reconcile-clerk-users.mjs
 * ---------------------------------------------------------------------------
 * After moving to PRODUCTION Clerk (live keys), your people are re-created in
 * the production Clerk instance with BRAND-NEW user IDs. Everything in the
 * database was tagged with their OLD (dev) IDs. This script matches people by
 * EMAIL and re-tags their records to the new production IDs.
 *
 * It is SAFE: it prints exactly what it will change and does NOTHING until you
 * add --apply. Run the dry run first, read it, then run --apply.
 *
 * RUN AGAINST PRODUCTION (main):
 *   export NEXT_PUBLIC_SUPABASE_URL="https://<PROD>.supabase.co"
 *   export SUPABASE_SERVICE_ROLE_KEY="<PROD service role key>"
 *   export CLERK_SECRET_KEY="sk_live_...<PROD secret key>"
 *
 *   node scripts/reconcile-clerk-users.mjs            # dry run — shows the plan
 *   node scripts/reconcile-clerk-users.mjs --apply    # actually makes changes
 *
 * ORDER OF OPERATIONS: invite everyone into production Clerk and have them
 * ACCEPT first — accounts only exist after acceptance. Anyone still missing is
 * listed at the bottom of the dry run so you know who still needs to accept.
 * ---------------------------------------------------------------------------
 */
import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const CLERK_SECRET = process.env.CLERK_SECRET_KEY
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!CLERK_SECRET || !SB_URL || !SB_KEY) {
  console.error('Missing env. Set CLERK_SECRET_KEY (sk_live_...), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
if (!CLERK_SECRET.startsWith('sk_live_')) {
  console.error(`Refusing to run: CLERK_SECRET_KEY is "${CLERK_SECRET.slice(0, 8)}…" — this must be your PRODUCTION (sk_live_) key.`)
  process.exit(1)
}

const supabase = createClient(SB_URL, SB_KEY)

// The columns that store a raw Clerk user-ID string (these need remapping).
// Columns that reference profiles.id (an internal UUID) are NOT here — those
// stay correct automatically because profiles.id never changes.
const TEXT_COLUMNS = [
  ['user_permissions',     'clerk_user_id'],
  ['user_feature_access',  'clerk_user_id'],
  ['member_system_access', 'clerk_user_id'],
  ['site_members',         'clerk_user_id'],
  ['reps',                 'clerk_user_id'],
  ['leads',                'assigned_to_user_id'],
  ['tracker_items',        'owner_user_id'],
  ['jobs',                 'created_by_user_id'],
  ['property_events',      'host_user_id'],
  ['property_events',      'owner_user_id'],
  ['aria_searches',        'user_id'],
]

async function loadProdClerkUsers() {
  const map = new Map() // lowercased email -> prod clerk id
  let offset = 0
  while (true) {
    const res = await fetch(`https://api.clerk.com/v1/users?limit=100&offset=${offset}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET}` },
    })
    if (!res.ok) throw new Error(`Clerk API ${res.status}: ${await res.text()}`)
    const users = await res.json()
    if (!Array.isArray(users) || users.length === 0) break
    for (const u of users) {
      const primary = u.email_addresses?.find(e => e.id === u.primary_email_address_id) ?? u.email_addresses?.[0]
      const email = (primary?.email_address ?? '').toLowerCase().trim()
      if (email) map.set(email, u.id)
    }
    if (users.length < 100) break
    offset += 100
  }
  return map
}

async function main() {
  console.log(APPLY ? '=== APPLY MODE — changes WILL be written ===\n' : '=== DRY RUN — no changes ===\n')

  const clerkByEmail = await loadProdClerkUsers()
  console.log(`Production Clerk currently has ${clerkByEmail.size} users.`)

  const { data: profiles, error } = await supabase.from('profiles').select('id, clerk_user_id, email')
  if (error) { console.error('Could not read profiles:', error.message); process.exit(1) }

  const remaps = []   // { email, oldId, newId, profileRowId }
  const missing = []  // emails with no production Clerk account yet
  const ok = []       // already correct
  for (const p of profiles ?? []) {
    const email = (p.email ?? '').toLowerCase().trim()
    if (!email) continue
    const newId = clerkByEmail.get(email)
    if (!newId) { missing.push(email); continue }
    if (p.clerk_user_id === newId) { ok.push(email); continue }
    remaps.push({ email, oldId: p.clerk_user_id, newId, profileRowId: p.id })
  }

  console.log(`\nAlready connected: ${ok.length}`)
  console.log(`Need reconnecting:  ${remaps.length}`)
  for (const r of remaps) console.log(`   ${r.email.padEnd(34)} ${String(r.oldId ?? '(none)').padEnd(34)} ->  ${r.newId}`)
  console.log(`\nNOT yet in production Clerk — invite these people and have them accept first: ${missing.length}`)
  for (const m of missing) console.log(`   ${m}`)

  if (!APPLY) { console.log('\nDRY RUN complete. Re-run with --apply once the list looks right.'); return }

  console.log('\nApplying…')
  for (const r of remaps) {
    if (r.oldId) {
      for (const [table, col] of TEXT_COLUMNS) {
        const { error: e } = await supabase.from(table).update({ [col]: r.newId }).eq(col, r.oldId)
        if (e && !/does not exist/i.test(e.message)) console.warn(`   warn ${table}.${col} (${r.email}): ${e.message}`)
      }
    }
    const { error: pe } = await supabase.from('profiles').update({ clerk_user_id: r.newId }).eq('id', r.profileRowId)
    if (pe) console.warn(`   warn profiles (${r.email}): ${pe.message} — if this is a unique conflict, a prod-id profile already exists; the record remap above still ran.`)
    else console.log(`   ✓ ${r.email}`)
  }
  console.log('\nDone. Next: run the "Sync profiles" action on main, and have users log in once (self-heal applies their org).')
}

main().catch(e => { console.error(e); process.exit(1) })
