export type AriaSearchMode = 'search_all' | 'isp_internet' | 'cable_video' | 'gates_access' | 'cameras'

export type AriaMinimumFact =
  | 'units'
  | 'phone'
  | 'address'
  | 'management'
  | 'owner'
  | 'gate_access_status'
  | 'camera_security'
  | 'unit_automation'
  | 'package_lockers'
  | 'isp_bulk_status'
  | 'video_bulk_status'
  | 'social_posts'

export type AriaResearchQualityStatus = 'complete' | 'partial' | 'failed'
export type AriaChargeRecommendation = 'full_credit' | 'partial_or_free' | 'no_charge'

export type AriaResearchQuality = {
  mode: AriaSearchMode
  status: AriaResearchQualityStatus
  good_enough_to_call: boolean
  good_enough_to_create_lead: boolean
  charge_recommendation: AriaChargeRecommendation
  found: AriaMinimumFact[]
  missing: AriaMinimumFact[]
  unknown: AriaMinimumFact[]
}

export const ARIA_MINIMUM_PAYLOADS: Record<AriaSearchMode, AriaMinimumFact[]> = {
  search_all: [
    'units',
    'phone',
    'address',
    'management',
    'owner',
    'gate_access_status',
    'camera_security',
    'unit_automation',
    'package_lockers',
    'isp_bulk_status',
    'video_bulk_status',
    'social_posts',
  ],
  isp_internet: [
    'units',
    'phone',
    'address',
    'management',
    'owner',
    'isp_bulk_status',
    'social_posts',
  ],
  cable_video: [
    'units',
    'phone',
    'address',
    'management',
    'owner',
    'video_bulk_status',
    'social_posts',
  ],
  gates_access: [
    'units',
    'phone',
    'address',
    'management',
    'owner',
    'gate_access_status',
    'unit_automation',
    'package_lockers',
    'social_posts',
  ],
  cameras: [
    'units',
    'phone',
    'address',
    'management',
    'owner',
    'camera_security',
    'social_posts',
  ],
}

export const ARIA_MINIMUM_FACT_LABELS: Record<AriaMinimumFact, string> = {
  units: 'Unit count',
  phone: 'Leasing/property phone',
  address: 'Property address',
  management: 'Management company',
  owner: 'Owner / ownership group',
  gate_access_status: 'Gate / access status',
  camera_security: 'Camera and security status',
  unit_automation: 'Smart locks / SmartRent / unit automation',
  package_lockers: 'Package lockers',
  isp_bulk_status: 'ISP provider + bulk yes/no',
  video_bulk_status: 'Video provider + bulk yes/no',
  social_posts: 'Social media / resident posts',
}

export function normalizeAriaSearchMode(value: unknown): AriaSearchMode {
  if (value === 'isp' || value === 'isp_internet') return 'isp_internet'
  if (value === 'video' || value === 'cable_video') return 'cable_video'
  if (value === 'gate' || value === 'gates_access') return 'gates_access'
  if (value === 'cameras') return 'cameras'
  return 'search_all'
}

export function buildAriaResearchQuality(
  mode: AriaSearchMode,
  foundFacts: Partial<Record<AriaMinimumFact, boolean>>
): AriaResearchQuality {
  const required = ARIA_MINIMUM_PAYLOADS[mode]
  const found = required.filter(fact => foundFacts[fact] === true)
  const missing = required.filter(fact => foundFacts[fact] === false)
  const unknown = required.filter(fact => foundFacts[fact] !== true && foundFacts[fact] !== false)

  const complete = missing.length === 0 && unknown.length === 0
  const hasContactPath = found.includes('phone') || found.includes('management')
  const hasCoreProperty = found.includes('address') && found.includes('management')
  const hasSalesContext = found.includes('social_posts') || found.includes('gate_access_status') || found.includes('isp_bulk_status') || found.includes('video_bulk_status') || found.includes('camera_security')
  const goodEnoughToCall = hasContactPath && hasSalesContext
  const goodEnoughToCreateLead = hasCoreProperty && hasContactPath

  let status: AriaResearchQualityStatus = 'partial'
  if (complete) status = 'complete'
  else if (!goodEnoughToCall && !goodEnoughToCreateLead) status = 'failed'

  let chargeRecommendation: AriaChargeRecommendation = 'partial_or_free'
  if (status === 'complete') chargeRecommendation = 'full_credit'
  if (status === 'failed') chargeRecommendation = 'no_charge'

  return {
    mode,
    status,
    good_enough_to_call: goodEnoughToCall,
    good_enough_to_create_lead: goodEnoughToCreateLead,
    charge_recommendation: chargeRecommendation,
    found,
    missing,
    unknown,
  }
}
