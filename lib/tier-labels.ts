/**
 * lib/tier-labels.ts
 * Central source of truth for org tier display names.
 * DB enum values never change — only these UI labels do.
 */

export const TIER_LABELS: Record<string, string> = {
  corporate:          'GateGuard Corporate',
  master_agent:       'Master Agent',
  master_dealer:      'MSO — Master System Operator',
  full_dealer:        'Dealer',
  service_dealer:     'Service Partner',
  install_contractor: 'Installation Partner',
  sales_partner:      'Sales Partner',
  client:             'Client',
}

export const TIER_SHORT: Record<string, string> = {
  corporate:          'Corporate',
  master_agent:       'Master Agent',
  master_dealer:      'MSO',
  full_dealer:        'Dealer',
  service_dealer:     'Service Partner',
  install_contractor: 'Install Partner',
  sales_partner:      'Sales Partner',
  client:             'Client',
}

export const TIER_BADGE_CLASS: Record<string, string> = {
  corporate:          'bg-brand-400/10 text-brand-400 border border-brand-400/20',
  master_agent:       'bg-violet-50 text-violet-700 border border-violet-200',
  master_dealer:      'bg-sky-50 text-sky-700 border border-sky-200',
  full_dealer:        'bg-emerald-50 text-emerald-700 border border-emerald-200',
  service_dealer:     'bg-yellow-50 text-yellow-700 border border-yellow-200',
  install_contractor: 'bg-orange-50 text-orange-700 border border-orange-200',
  sales_partner:      'bg-pink-50 text-pink-700 border border-pink-200',
  client:             'bg-amber-50 text-amber-700 border border-amber-200',
}

// Opportunity type labels
export const OPP_TYPE_LABELS: Record<string, string> = {
  master_agent:    'Master Agent',
  mso:             'MSO — Master System Operator',
  dealer:          'Dealer',
  install_partner: 'Installation Partner',
  service_partner: 'Service Partner',
  sales_partner:   'Sales Partner',
  property:        'Property',
  company:         'Company',
  customer:        'Customer',
}

export const OPP_TYPE_BADGE: Record<string, string> = {
  master_agent:    'bg-violet-50 text-violet-700',
  mso:             'bg-sky-50 text-sky-700',
  dealer:          'bg-emerald-50 text-emerald-700',
  install_partner: 'bg-orange-50 text-orange-700',
  service_partner: 'bg-yellow-50 text-yellow-700',
  sales_partner:   'bg-pink-50 text-pink-700',
  property:        'bg-teal-50 text-teal-700',
  company:         'bg-blue-50 text-blue-700',
  customer:        'bg-purple-50 text-purple-700',
}
