import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/current-user'
import { resolveOrgScope, applyOrgScope } from '@/lib/org-scope'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

// GET /api/documents — returns (a) this org-subtree's own documents PLUS (b) shared
// library documents whose allowed_tiers include the caller's tier (or that are open
// to all tiers). Corporate sees everything.
export async function GET() {
  const user  = await getCurrentUser()
  const scope = await resolveOrgScope(user)

  // (a) org-scoped documents (visibility 'org' or legacy null)
  let orgQ = supabase.from('org_documents').select('*')
    .or('visibility.is.null,visibility.eq.org')
    .order('created_at', { ascending: false }).limit(500)
  orgQ = applyOrgScope(orgQ, scope, 'org_id')

  // (b) shared library documents
  const sharedQ = supabase.from('org_documents').select('*')
    .eq('visibility', 'shared')
    .order('created_at', { ascending: false }).limit(500)

  const [{ data: orgDocs, error: e1 }, { data: sharedAll, error: e2 }] = await Promise.all([orgQ, sharedQ])
  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 })
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

  // Filter shared docs by tier in JS (allowed_tiers null/empty = all tiers).
  const tier = user.org_tier
  const shared = (sharedAll ?? []).filter(d => {
    if (user.isCorporate) return true
    const at: string[] | null = d.allowed_tiers
    if (!at || at.length === 0) return true
    return !!tier && at.includes(tier)
  })

  // Merge + de-dupe by id (a shared doc could also match org scope).
  const seen = new Set<string>()
  const documents = [...(orgDocs ?? []), ...shared].filter(d => (seen.has(d.id) ? false : (seen.add(d.id), true)))
  return NextResponse.json({ documents })
}

// POST /api/documents — create a document. Only corporate may publish a SHARED
// (tier-visible) library document; everyone else creates an org-scoped document.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  const body = await req.json()
  const { name, category, file_url, storage_path, file_size_kb, uploaded_by, expires_at, site_id, opportunity_id, description, is_template } = body

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const wantsShared = body.visibility === 'shared'
  if (wantsShared && !user.isCorporate) {
    return NextResponse.json({ error: 'Only Gate Guard corporate can publish shared library documents.' }, { status: 403 })
  }
  const visibility = wantsShared ? 'shared' : 'org'
  // Normalize allowed_tiers: empty/absent on a shared doc = all tiers (stored null).
  let allowed_tiers: string[] | null = null
  if (wantsShared && Array.isArray(body.allowed_tiers) && body.allowed_tiers.length > 0) {
    allowed_tiers = body.allowed_tiers.map((t: unknown) => String(t))
  }

  const { data, error } = await supabase
    .from('org_documents')
    .insert({
      org_id:         user.isCorporate ? (body.org_id ?? user.org_id ?? null) : (user.org_id ?? null),
      site_id:        site_id ?? null,
      opportunity_id: opportunity_id ?? null,
      name,
      description:  description ?? null,
      category:     category ?? 'other',
      file_url:     file_url ?? null,
      storage_path: storage_path ?? null,
      file_size_kb: file_size_kb ?? null,
      uploaded_by:  uploaded_by ?? user.name ?? null,
      expires_at:   expires_at ?? null,
      visibility,
      allowed_tiers,
      is_template:  !!is_template,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ document: data }, { status: 201 })
}
