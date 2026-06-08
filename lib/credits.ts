import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export function currentBillingPeriod(date = new Date()) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, '0')}`
}

export async function spendCredits({
  profileId,
  clerkUserId,
  orgId,
  featureKey,
  actionType,
  credits,
  metadata = {},
}: {
  profileId?: string | null
  clerkUserId?: string | null
  orgId: string
  featureKey: string
  actionType: string
  credits: number
  metadata?: Record<string, unknown>
}) {
  if (!orgId) throw new Error('Missing orgId')
  if (!featureKey) throw new Error('Missing featureKey')
  if (!actionType) throw new Error('Missing actionType')
  if (!Number.isFinite(credits) || credits < 0) throw new Error('Invalid credit amount')

  const billingPeriod = currentBillingPeriod()

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id, billing_parent_org_id')
    .eq('id', orgId)
    .single()

  if (orgError || !org) throw new Error('Organization not found')

  const billingOrgId = org.billing_parent_org_id || org.id

  const { data: feature, error: featureError } = await supabaseAdmin
    .from('feature_catalog')
    .select('key, is_active, is_paid, default_credit_cost, overage_allowed')
    .eq('key', featureKey)
    .single()

  if (featureError || !feature) throw new Error(`Feature not found: ${featureKey}`)
  if (!feature.is_active) throw new Error(`Feature inactive: ${featureKey}`)

  const chargeCredits = credits || feature.default_credit_cost || 0

  let { data: wallet, error: walletError } = await supabaseAdmin
    .from('credit_wallets')
    .select('*')
    .eq('org_id', billingOrgId)
    .eq('billing_period', billingPeriod)
    .maybeSingle()

  if (walletError) throw new Error(walletError.message)

  if (!wallet) {
    const created = await supabaseAdmin
      .from('credit_wallets')
      .insert({
        org_id: billingOrgId,
        billing_period: billingPeriod,
        starting_credits: 0,
        purchased_credits: 0,
        used_credits: 0,
      })
      .select('*')
      .single()

    if (created.error || !created.data) {
      throw new Error(created.error?.message || 'Unable to create credit wallet')
    }

    wallet = created.data
  }

  if (wallet.status !== 'active') {
    throw new Error('Credit wallet is not active')
  }

  if (wallet.remaining_credits < chargeCredits && !feature.overage_allowed) {
    throw new Error('Insufficient credits')
  }

  const nextUsedCredits = wallet.used_credits + chargeCredits

  const { error: updateError } = await supabaseAdmin
    .from('credit_wallets')
    .update({ used_credits: nextUsedCredits })
    .eq('id', wallet.id)

  if (updateError) throw new Error(updateError.message)

  const { error: txError } = await supabaseAdmin
    .from('credit_transactions')
    .insert({
      wallet_id: wallet.id,
      org_id: orgId,
      user_id: profileId || null,
      clerk_user_id: clerkUserId || null,
      billing_parent_org_id: billingOrgId,
      feature_key: featureKey,
      action_type: actionType,
      credits_used: chargeCredits,
      billing_period: billingPeriod,
      metadata,
    })

  if (txError) throw new Error(txError.message)

  return {
    charged: chargeCredits,
    billingPeriod,
    orgId,
    billingOrgId,
    remainingCredits: wallet.remaining_credits - chargeCredits,
    overage: wallet.remaining_credits < chargeCredits,
  }
}
