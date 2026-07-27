/**
 * migrate-beta-user.mjs
 * ---------------------------------------------------------------------------
 * Copies a person's WORK DATA from the BETA database into the MAIN (prod)
 * database, re-tagged to their production account, so their leads/opps/etc.
 * follow them to main.
 *
 * SAFE BY DESIGN: prints a plan and changes NOTHING until you add --apply.
 * Always run the dry run first, read it, and if anything looks off, STOP and
 * ask a developer before using --apply.
 *
 * BEFORE running this, the person must already be able to LOG IN to main
 * (invited into production Clerk + accepted). See the handoff doc, Part A.
 *
 * Copies (records the person owns): leads, opportunities, CRM activities on
 * those records, to-dos, and tracker items. Cross-references that don't exist
 * in main yet (contact_id, company_id, site_id) are cleared, but the readable
 * name fields are kept, so nothing breaks.
 *
 * ENV (set all of these):
 *   BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY       — the BETA database
 *   PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY       — the MAIN database
 *   CLERK_SECRET_KEY  (sk_live_… PRODUCTION key)   — to find their main account
 *
 * RUN:
 *   node scripts/migrate-beta-user.mjs --emails "a@x.com,b@x.com"          # dry run
 *   node scripts/migrate-beta-user.mjs --emails "a@x.com,b@x.com" --apply  # do it
 * ---------------------------------------------------------------------------
 */
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const APPLY = process.argv.includes('--apply')
const emailsArg = (process.argv.find(a => a.startsWith('--emails=')) || '').split('=')[1]
  || process.argv[process.argv.indexOf('--emails') + 1]
const EMAILS = String(emailsArg || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)

const { BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY, PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY, CLERK_SECRET_KEY } = process.env
for (const [k, v] of Object.entries({ BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY, PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY, CLERK_SECRET_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1) }
}
if (!CLERK_SECRET_KEY.startsWith('sk_live_')) { console.error('CLERK_SECRET_KEY must be the PRODUCTION (sk_live_) key.'); process.exit(1) }
if (EMAILS.length === 0) { console.error('Pass --emails "a@x.com,b@x.com"'); process.exit(1) }

const beta = createClient(BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY)
const prod = createClient(PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY)

async function prodClerkIdByEmail(email) {
  const res = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`, { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } })
  if (!res.ok) return null
  const users = await res.json()
  return Array.isArray(users) && users[0] ? users[0].id : null
}

// Strip a beta row down to something safe to insert into prod: new id, remapped
// owner/org, cleared cross-FKs (names are kept via denormalized columns).
function reshape(row, { newId, prodClerkId, prodOrgId, ownerCols, clearCols, extra = {} }) {
  const out = { ...row, id: newId, ...extra }
  delete out.created_at
  for (const c of ownerCols) if (c in out && out[c]) out[c] = prodClerkId
  if ('org_id' in out) out.org_id = prodOrgId
  if ('dealer_org_id' in out) out.dealer_org_id = prodOrgId
  for (const c of clearCols) if (c in out) out[c] = null
  return out
}

async function copyTable(label, betaRows, prodTable, opts) {
  if (!betaRows.length) { console.log(`   ${label}: 0`); return new Map() }
  const map = new Map() // beta id -> prod id
  const rows = betaRows.map(r => { const newId = randomUUID(); map.set(r.id, newId); return reshape(r, { ...opts, newId, extra: opts.extra?.(r) ?? {} }) })
  console.log(`   ${label}: ${rows.length}${APPLY ? '' : ' (dry run)'}`)
  if (APPLY) {
    const { error } = await prod.from(prodTable).insert(rows)
    if (error) console.warn(`     ! ${prodTable}: ${error.message}`)
  }
  return map
}

async function migrateOne(email) {
  console.log(`\n── ${email} ──`)
  const { data: bp } = await beta.from('profiles').select('clerk_user_id, org_id').ilike('email', email).maybeSingle()
  if (!bp) { console.log('   no beta profile for this email — skipping'); return }
  const betaId = bp.clerk_user_id

  const prodClerkId = await prodClerkIdByEmail(email)
  if (!prodClerkId) { console.log('   NOT in production Clerk yet — invite + accept first (handoff Part A), then re-run'); return }

  const { data: pp } = await prod.from('profiles').select('org_id').eq('clerk_user_id', prodClerkId).maybeSingle()
  const prodOrgId = pp?.org_id ?? null
  if (!prodOrgId) { console.log('   no prod profile/org yet — run "Sync profiles" on main first, then re-run'); return }

  const owner = { prodClerkId, prodOrgId }

  // 1. Leads (owned by them on beta)
  const { data: leads = [] } = await beta.from('leads').select('*').or(`assigned_to_user_id.eq.${betaId},assigned_to.eq.${betaId}`)
  const leadMap = await copyTable('leads', leads, 'leads', { ...owner, ownerCols: ['assigned_to_user_id', 'assigned_to'], clearCols: ['contact_id', 'company_id', 'opportunity_id'] })

  // 2. Opportunities (owned by them)
  const { data: opps = [] } = await beta.from('opportunities').select('*').eq('assigned_to', betaId)
  const oppMap = await copyTable('opportunities', opps, 'opportunities', { ...owner, ownerCols: ['assigned_to', 'created_by'], clearCols: ['site_id', 'contact_id', 'company_id', 'lead_id'] })

  // 3. CRM activities on those leads/opps (remap the parent id to the new prod id)
  const leadIds = [...leadMap.keys()], oppIds = [...oppMap.keys()]
  let acts = []
  if (leadIds.length) { const { data = [] } = await beta.from('crm_activities').select('*').in('lead_id', leadIds); acts = acts.concat(data) }
  if (oppIds.length) { const { data = [] } = await beta.from('crm_activities').select('*').in('opportunity_id', oppIds); acts = acts.concat(data) }
  await copyTable('crm_activities', acts, 'crm_activities', {
    ...owner, ownerCols: [], clearCols: ['contact_id'],
    extra: (r) => ({ lead_id: r.lead_id ? leadMap.get(r.lead_id) ?? null : null, opportunity_id: r.opportunity_id ? oppMap.get(r.opportunity_id) ?? null : null }),
  })

  // 4. To-dos assigned to them
  const { data: todos = [] } = await beta.from('todos').select('*').eq('assigned_to', betaId)
  await copyTable('todos', todos, 'todos', { ...owner, ownerCols: ['assigned_to'], clearCols: ['work_order_id', 'site_id'] })

  // 5. Tracker items they own
  const { data: tracker = [] } = await beta.from('tracker_items').select('*').eq('owner_user_id', betaId)
  await copyTable('tracker_items', tracker, 'tracker_items', { ...owner, ownerCols: ['owner_user_id'], clearCols: ['group_id', 'parent_item_id'] })
}

async function main() {
  console.log(APPLY ? '=== APPLY — writing to the MAIN database ===' : '=== DRY RUN — nothing will change ===')
  for (const email of EMAILS) await migrateOne(email)
  console.log(APPLY ? '\nDone. Spot-check a couple records in main.' : '\nDRY RUN complete. Re-run with --apply once it looks right.')
}
main().catch(e => { console.error(e); process.exit(1) })
