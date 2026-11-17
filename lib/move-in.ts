/**
 * Move-in setup (Part 3) — server helpers. The URL token is the credential.
 * Everything here uses the service client; callers must look the invite up by token first.
 */
import { createServiceClient } from '@/lib/supabase'
import { quoteFee, type FeeCode, type FeeQuote, type FeeRules, type PaidBy } from '@/lib/access-fee'

export interface HouseholdMember {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  /** Resident chose to give this person access. */
  include?: boolean
  /** Came from the lease (vs added by the resident). */
  from_lease?: boolean
}

export interface Vehicle {
  make?: string
  model?: string
  color?: string
  plate?: string
  state?: string
}

export interface CartLine { product_id: string; qty: number }

export interface SiteProduct {
  id: string
  sku: string
  name: string
  description: string | null
  price_cents: number
  site_share_cents: number
  max_per_unit: number
  fulfillment: 'office_pickup' | 'ship'
}

export const MAX_HOUSEHOLD = 6
export const MAX_VEHICLES = 4

export interface MoveInInvite {
  id: string
  token: string
  site_id: string
  kind: 'move_in' | 'renewal'
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  unit_number: string | null
  move_in_date: string | null
  lease_end_date: string | null
  household: HouseholdMember[]
  lease_household: HouseholdMember[] | null
  cart: CartLine[]
  vehicles: Vehicle[]
  access_confirmed_at: string | null
  fee_cents: number
  fee_paid_by: PaidBy
  resident_fee_cents: number | null
  fee_charge_per: 'lease' | 'person'
  property_covers_cents: number
  term_months: number
  code_id: string | null
  amount_due_cents: number | null
  property_owes_cents: number | null
  payment_status: 'unpaid' | 'pending' | 'paid' | 'not_required'
  stripe_session_id: string | null
  paid_at: string | null
  access_id: string | null
  status: string
  step: string
  details_confirmed_at: string | null
  photo_path: string | null
  photo_skipped: boolean
  completed_at: string | null
  expires_at: string
  sent_count: number
}

export const PHOTO_BUCKET = 'resident-photos'
export const TOKEN_RE = /^[a-f0-9]{48}$/

/** baseUrl: pass the request's origin so beta links stay on beta (production uses NEXT_PUBLIC_APP_URL). */
export function setupUrl(token: string, baseUrl?: string) {
  const base = (baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://portal.gateguard.co').replace(/\/$/, '')
  return `${base}/move-in/${token}`
}

/** Look up a live invite by token. Returns null for bad, expired or cancelled links. */
export async function getInvite(token: string): Promise<{ invite: MoveInInvite; propertyName: string; officePhone: string | null } | { error: 'not_found' | 'expired' | 'cancelled' }> {
  if (!TOKEN_RE.test(token)) return { error: 'not_found' }
  const db = createServiceClient()
  const { data } = await db.from('move_in_invites').select('*').eq('token', token).maybeSingle()
  if (!data) return { error: 'not_found' }
  const invite = data as MoveInInvite
  if (invite.status === 'cancelled') return { error: 'cancelled' }
  if (invite.status !== 'complete' && new Date(invite.expires_at).getTime() < Date.now()) return { error: 'expired' }
  const { data: site } = await db.from('sites').select('name, primary_contact_phone').eq('id', invite.site_id).maybeSingle()
  return { invite, propertyName: site?.name ?? 'your community', officePhone: site?.primary_contact_phone ?? null }
}

export function inviteRules(invite: MoveInInvite): FeeRules {
  return {
    enabled: invite.fee_cents > 0,
    amountCents: invite.fee_cents,
    chargePer: invite.fee_charge_per ?? 'lease',
    paidBy: invite.fee_paid_by,
    propertyCoversCents: invite.property_covers_cents ?? 0,
    termMonths: invite.term_months ?? 12,
  }
}

/** Resident + household members they chose to include. */
export function peopleCount(invite: MoveInInvite) {
  return 1 + (invite.household ?? []).filter((h) => h.include !== false && h.email).length
}

export async function inviteCode(invite: MoveInInvite): Promise<FeeCode | null> {
  if (!invite.code_id) return null
  const db = createServiceClient()
  const { data } = await db.from('access_fee_codes').select('id, code, covers, amount_off_cents').eq('id', invite.code_id).maybeSingle()
  return data ? { id: data.id, code: data.code, covers: data.covers, amountOffCents: data.amount_off_cents } : null
}

export function inviteQuote(invite: MoveInInvite, code: FeeCode | null): FeeQuote {
  return quoteFee(inviteRules(invite), peopleCount(invite), code)
}

/** What the resident's browser is allowed to see — no ids beyond what it needs. */
export function publicView(invite: MoveInInvite, propertyName: string, officePhone: string | null, code: FeeCode | null = null) {
  return {
    kind: invite.kind,
    propertyName,
    officePhone,
    email: invite.email,
    firstName: invite.first_name,
    lastName: invite.last_name,
    phone: invite.phone,
    unit: invite.unit_number,
    moveInDate: invite.move_in_date,
    household: (invite.household ?? []).map((h) => ({ ...h, include: h.include !== false })),
    leaseHasEmails: (invite.lease_household ?? invite.household ?? []).map((h) => !!h.email),
    vehicles: invite.vehicles ?? [],
    fee: { cents: invite.fee_cents, paidBy: invite.fee_paid_by, chargePer: invite.fee_charge_per, termMonths: invite.term_months },
    quote: inviteQuote(invite, code),
    code: code?.code ?? null,
    paymentStatus: invite.payment_status,
    step: invite.step,
    status: invite.status,
    hasPhoto: !!invite.photo_path,
    photoSkipped: invite.photo_skipped,
  }
}

export async function updateInvite(id: string, patch: Partial<MoveInInvite> & Record<string, unknown>) {
  const db = createServiceClient()
  return db.from('move_in_invites').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
}

/** Add-ons this property offers at move-in (gate key fob, …). */
export async function moveInProducts(siteId: string): Promise<SiteProduct[]> {
  const db = createServiceClient()
  const { data } = await db
    .from('site_products')
    .select('id, sku, name, description, price_cents, site_share_cents, max_per_unit, fulfillment')
    .eq('site_id', siteId).eq('enabled', true).eq('offer_at_move_in', true)
    .order('sort_order')
  return (data ?? []) as SiteProduct[]
}

/** Cart priced against the property's current products (unknown / disabled items drop out). */
export function priceCart(cart: CartLine[], products: SiteProduct[]) {
  const lines = (cart ?? []).flatMap((c) => {
    const p = products.find((x) => x.id === c.product_id)
    if (!p || c.qty < 1) return []
    const qty = Math.min(c.qty, p.max_per_unit)
    return [{ product: p, qty, cents: p.price_cents * qty }]
  })
  return { lines, totalCents: lines.reduce((a, l) => a + l.cents, 0) }
}

/** Everything the setup page needs, in one call. */
export async function inviteView(invite: MoveInInvite, propertyName: string, officePhone: string | null) {
  const [code, products] = await Promise.all([inviteCode(invite), moveInProducts(invite.site_id)])
  const base = publicView(invite, propertyName, officePhone, code)
  const cart = priceCart(invite.cart ?? [], products)
  return {
    ...base,
    products: products.map((p) => ({ id: p.id, name: p.name, description: p.description, priceCents: p.price_cents, maxQty: p.max_per_unit, fulfillment: p.fulfillment })),
    cart: cart.lines.map((l) => ({ productId: l.product.id, name: l.product.name, qty: l.qty, cents: l.cents })),
    cartCents: cart.totalCents,
    totalDueCents: base.quote.dueCents + cart.totalCents,
  }
}
