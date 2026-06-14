/**
 * lib/doc-status.ts
 *
 * Maps a document's (document_type, status) to the public view model the
 * /document/[slug] glass portal renders. Pure logic — safe on client + server.
 */

export type DocKind = 'signature' | 'proposal'
export type DocStage =
  | 'review'           // unsigned — show document + sign/approve action
  | 'awaiting_counter' // signed by counterparty, pending GateGuard countersignature
  | 'final'            // fully executed / approved — show final copy
  | 'declined'
  | 'expired'
  | 'unavailable'      // cancelled / not found

export function docKind(documentType: string): DocKind {
  return documentType === 'proposal' ? 'proposal' : 'signature'
}

export function docTypeLabel(t: string): string {
  switch (t) {
    case 'nda':                       return 'Non-Disclosure Agreement'
    case 'master_agent_agreement':    return 'Master Agent Agreement'
    case 'dealer_agreement':          return 'Dealer Agreement'
    case 'service_agreement':         return 'Service Agreement'
    case 'install_partner_agreement': return 'Install Partner Agreement'
    case 'sales_partner_agreement':   return 'Sales Partner Agreement'
    case 'customer_contract':         return 'Customer Contract'
    case 'proposal':                  return 'Proposal'
    default:                          return 'Document'
  }
}

// Short noun used in status labels ("NDA Sent", "Contract Fully Executed", …)
function shortNoun(t: string): string {
  if (t === 'nda') return 'NDA'
  if (t === 'proposal') return 'Proposal'
  if (t === 'customer_contract') return 'Contract'
  return 'Agreement'
}

export interface DocView {
  kind: DocKind
  stage: DocStage
  typeLabel: string
  statusLabel: string
  steps: string[]
  canSign: boolean
  canApprove: boolean   // proposals
  showFinal: boolean
}

export function resolveDocView(
  documentType: string,
  status: string,
  opts: { expired?: boolean } = {},
): DocView {
  const kind = docKind(documentType)
  const typeLabel = docTypeLabel(documentType)
  const noun = shortNoun(documentType)

  const base: DocView = {
    kind, typeLabel, stage: 'review', statusLabel: '', steps: [],
    canSign: false, canApprove: false, showFinal: false,
  }

  if (opts.expired || status === 'expired') {
    return { ...base, stage: 'expired', statusLabel: 'Link Expired' }
  }
  if (status === 'declined') {
    return { ...base, stage: 'declined', statusLabel: `${noun} Declined` }
  }
  if (status === 'cancelled') {
    return { ...base, stage: 'unavailable', statusLabel: 'Document Unavailable' }
  }

  if (kind === 'proposal') {
    if (status === 'fully_executed') {
      return { ...base, stage: 'final', statusLabel: 'Proposal Approved', showFinal: true, steps: ['Reviewed', 'Approved', 'Complete'] }
    }
    // pending
    return { ...base, stage: 'review', statusLabel: 'Proposal Sent', canApprove: true, steps: ['Review Proposal', 'Ask Questions / Approve', 'Submit Approval'] }
  }

  // signature documents
  const signSteps = ['Review Document', 'Sign / Approve', 'Done']
  if (status === 'fully_executed') {
    return { ...base, stage: 'final', statusLabel: `${noun} Fully Executed`, showFinal: true, steps: signSteps }
  }
  if (status === 'counterparty_signed') {
    return { ...base, stage: 'awaiting_counter', statusLabel: `${noun} Signed — Pending GateGuard Countersignature`, steps: signSteps }
  }
  // pending
  return { ...base, stage: 'review', statusLabel: `${noun} Sent`, canSign: true, steps: signSteps }
}
