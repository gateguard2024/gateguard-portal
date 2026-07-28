/**
 * migrate-beta-user.mjs
 * ---------------------------------------------------------------------------
 * Copies a person's WORK DATA from the BETA database into the MAIN (prod)
 * database, re-tagged to their production account, so their leads/to-dos/tasks
 * follow them to main.
 *
 * SAFE BY DESIGN: prints a plan and changes NOTHING until you add --apply.
 * Always run the dry run first, read it, and if anything looks off, STOP and
 * ask a developer before using --apply.
 *
 * BEFORE running this, the person must already be able to LOG IN to main
 * (invited into production Clerk + accepted) AND appear on main once (so they
 * have a prod profile). See the handoff doc, Part A.
 *
 * WHAT IT COPIES (records the person owns): their leads, the notes/calls on
 * those leads, their to-dos, and their tracker tasks. Opportunities are NOT
 * copied — those belong to the whole organization, not one person.
 *
 * KEY DETAIL: some "owner" columns are the person's Clerk id (text), others are
 * their profile id (a uuid). This script writes the correct one to each. Links
 * to things that don't exist on main yet (contact, company, site) are cleared;
 * the readable names stay, so nothing breaks.
 *
 * ENV (set all):
 *   BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY       — BETA database
 *   PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY       — MAIN database
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

const { BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY, PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY } = process.env
for (const [k, v] of Object.entries({ BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY, PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY })) {
  if (!v) { console.error(`Missing env: ${k}`); process.exit(1) }
}
if (EMAILS.length === 0) { console.error('Pass --emails "a@x.com,b@x.com"'); process.exit(1) }

const beta = createClient(BETA_SUPABASE_URL, BETA_SERVICE_ROLE_KEY)
const prod = createClient(PROD_SUPABASE_URL, PROD_SERVICE_ROLE_KEY)

// Reshape a beta row for insertion into prod:
//   new id · uuid owner cols -> prod PROFILE id · text owner cols -> prod CLERK id
//   org_id -> prod org · clearCols -> null · extra overrides last.
function reshape(row, { newId, prodProfileId, prodClerkId, prodOrgId, uuidOwnerCols = [], textOwnerCols = [], clearCols = [], extra = {} }) {
  const out = { ...row, id: newId }
  delete out.created_at
  for (const c of uuidOwnerCols) if (c in out) out[c] = prodProfileId
  for (const c of textOwnerCols) if (c in out && out[c]) out[c] = prodClerkId
  if ('org_id' in out) out.org_id = prodOrgId
  for (const c of clearCols) if (c in out) out[c] = null
  return { ...out, ...extra }
}

async function copyTable(label, betaRows, prodTable, opts) {
  if (!betaRows.length) { console.log(`   ${label}: 0`); return new Map() }
  const map = new Map()
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
  const { data: bp } = await beta.from('profiles').select('id, clerk_user_id, org_id').ilike('email', email).maybeSingle()
  if (!bp) { console.log('   no beta profile — skipping'); return }

  const { data: pp } = await prod.from('profiles').select('id, clerk_user_id, org_id').ilike('email', email).maybeSingle()
  if (!pp) { console.log('   NOT on main yet — invite + accept + let them appear once (handoff Part A), then re-run'); return }

  const owner = { prodProfileId: pp.id, prodClerkId: pp.clerk_user_id, prodOrgId: pp.org_id }
  const betaProfileId = bp.id, betaClerkId = bp.clerk_user_id

  // 1. Leads they own (by clerk id OR profile id on beta)
  const { data: leads = [] } = await beta.from('leads').select('*').or(`assigned_to_user_id.eq.${betaClerkId},assigned_to.eq.${betaProfileId}`)
  const leadMap = await copyTable('leads', leads, 'leads', {
    ...owner,
    uuidOwnerCols: ['assigned_to'],                 // -> prod profile id
    textOwnerCols: ['assigned_to_user_id'],         // -> prod clerk id
    clearCols: ['contact_id', 'company_id', 'opportunity_id'],
  })

  // 2. Notes/calls on those leads (remap lead_id to the new prod lead id)
  const leadIds = [...leadMap.keys()]
  let acts = []
  if (leadIds.length) { const { data = [] } = await beta.from('crm_activities').select('*').in('lead_id', leadIds); acts = data }
  await copyTable('crm_activities', acts, 'crm_activities', {
    ...owner, clearCols: ['contact_id', 'opportunity_id'],
    extra: (r) => ({ lead_id: r.lead_id ? leadMap.get(r.lead_id) ?? null : null }),
  })

  // 3. To-dos assigned to them (assigned_to + created_by are Clerk text)
  const { data: todos = [] } = await beta.from('todos').select('*').eq('assigned_to', betaClerkId)
  await copyTable('todos', todos, 'todos', { ...owner, textOwnerCols: ['assigned_to', 'created_by'], clearCols: ['work_order_id', 'site_id'] })

  // 4. Tracker tasks they own (owner_user_id is Clerk text)
  const { data: tracker = [] } = await beta.from('tracker_items').select('*').eq('owner_user_id', betaClerkId)
  await copyTable('tracker_items', tracker, 'tracker_items', { ...owner, textOwnerCols: ['owner_user_id'], clearCols: ['group_id', 'parent_item_id'] })
}

async function main() {
  console.log(APPLY ? '=== APPLY — writing to the MAIN database ===' : '=== DRY RUN — nothing will change ===')
  for (const email of EMAILS) await migrateOne(email)
  console.log(APPLY ? '\nDone. Spot-check a couple leads in main.' : '\nDRY RUN complete. Re-run with --apply once it looks right.')
}
main().catch(e => { console.error(e); process.exit(1) })
