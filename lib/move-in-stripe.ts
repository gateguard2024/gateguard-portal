/** Stripe Checkout for the move-in P&A fee. */
import Stripe from 'stripe'

export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as const })
}

export const MOVE_IN_KIND = 'move_in_fee'
