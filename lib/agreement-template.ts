/**
 * GateGuard Authorized Dealer & Reseller Agreement Template
 *
 * Merge vars (standard):
 *   {{EFFECTIVE_DATE}}              — e.g. "May 26, 2026"
 *   {{DEALER_LEGAL_NAME}}           — org name
 *   {{DEALER_STATE_AND_ENTITY_TYPE}} — e.g. "Georgia limited liability company"
 *   {{DEALER_ADDRESS}}              — street, city, state, zip
 *
 * Exhibit A merge vars (filled from org commission config):
 *   {{APPROVED_TERRITORY}}          — service area states, e.g. "GA, FL, SC"
 *   {{CHECKBOX_FULL_DEALER}}        — "X" if selected, " " if not
 *   {{CHECKBOX_SERVICE_DEALER}}     — same
 *   {{CHECKBOX_INSTALLING_CONTRACTOR}}
 *   {{CHECKBOX_SALES_PARTNER}}
 *   {{CHECKBOX_MSO}}
 *   {{CHECKBOX_MASTER_AGENT}}
 *   {{HARDWARE_DISCOUNT_PERCENTAGE}} — e.g. "40"
 *   {{SOFTWARE_MRR_PERCENTAGE}}      — e.g. "30"
 *   {{MASTER_AGENT_OVERRIDE_AMOUNT}} — e.g. "0.50" (hidden unless MA tier)
 *   {{INSTALL_FEE_PERCENTAGE}}       — e.g. "100"
 *   {{DYNAMIC_TIER_NOTES}}          — tier-specific SLA / notes paragraph
 */

export interface AgreementMergeVars {
  effectiveDate: string
  dealerLegalName: string
  dealerStateAndEntityType: string
  dealerAddress: string
  approvedTerritory: string
  /** Tier checkboxes — pass 'X' for selected, ' ' for unselected */
  checkboxFullDealer: string
  checkboxServiceDealer: string
  checkboxInstallingContractor: string
  checkboxSalesPartner: string
  checkboxMso: string
  checkboxMasterAgent: string
  /** Commission figures */
  hardwareDiscountPercentage: string   // e.g. "40"
  softwareMrrPercentage: string        // e.g. "30"
  masterAgentOverrideAmount: string    // e.g. "0.50"
  installFeePercentage: string         // e.g. "100"
  dynamicTierNotes: string
}

export function buildAgreementText(vars: AgreementMergeVars): string {
  return AGREEMENT_TEMPLATE
    .replace(/\{\{EFFECTIVE_DATE\}\}/g,                  vars.effectiveDate)
    .replace(/\{\{DEALER_LEGAL_NAME\}\}/g,               vars.dealerLegalName)
    .replace(/\{\{DEALER_STATE_AND_ENTITY_TYPE\}\}/g,    vars.dealerStateAndEntityType)
    .replace(/\{\{DEALER_ADDRESS\}\}/g,                  vars.dealerAddress)
    .replace(/\{\{APPROVED_TERRITORY\}\}/g,              vars.approvedTerritory)
    .replace(/\{\{CHECKBOX_FULL_DEALER\}\}/g,            vars.checkboxFullDealer)
    .replace(/\{\{CHECKBOX_SERVICE_DEALER\}\}/g,         vars.checkboxServiceDealer)
    .replace(/\{\{CHECKBOX_INSTALLING_CONTRACTOR\}\}/g,  vars.checkboxInstallingContractor)
    .replace(/\{\{CHECKBOX_SALES_PARTNER\}\}/g,          vars.checkboxSalesPartner)
    .replace(/\{\{CHECKBOX_MSO\}\}/g,                    vars.checkboxMso)
    .replace(/\{\{CHECKBOX_MASTER_AGENT\}\}/g,           vars.checkboxMasterAgent)
    .replace(/\{\{HARDWARE_DISCOUNT_PERCENTAGE\}\}/g,    vars.hardwareDiscountPercentage)
    .replace(/\{\{SOFTWARE_MRR_PERCENTAGE\}\}/g,         vars.softwareMrrPercentage)
    .replace(/\{\{MASTER_AGENT_OVERRIDE_AMOUNT\}\}/g,    vars.masterAgentOverrideAmount)
    .replace(/\{\{INSTALL_FEE_PERCENTAGE\}\}/g,          vars.installFeePercentage)
    .replace(/\{\{DYNAMIC_TIER_NOTES\}\}/g,              vars.dynamicTierNotes)
}

/** Build AgreementMergeVars from org data */
export function buildAgreementVarsFromOrg(opts: {
  effectiveDate: string
  dealerLegalName: string
  dealerStateAndEntityType: string
  dealerAddress: string
  approvedTerritory: string
  orgTier: string
  salesPartnerRate?: number   // $/unit/mo — used to derive software MRR %
  serviceRate?: number
  commissionNotes?: string
}): AgreementMergeVars {
  const tier = opts.orgTier

  const checkbox = (match: string) => tier === match ? 'X' : ' '

  // Derive percentages from commission rates — rough mapping
  const softwarePct  = opts.salesPartnerRate  ? Math.round(opts.salesPartnerRate  / 10 * 100).toString() : '30'
  const serviceDiscPct = opts.serviceRate ? Math.round(opts.serviceRate / 10 * 100).toString() : '30'
  const hardwareDisc = tier === 'master_dealer' || tier === 'master_agent' ? '45' : '40'
  const installPct   = tier === 'install_contractor' ? '100' : tier === 'full_dealer' ? '100' : '0'
  const maOverride   = tier === 'master_agent' ? '0.50' : 'N/A'

  const tierNotes: Record<string, string> = {
    full_dealer:        'Dealer may self-perform sales, installation, and service roles. Dealer is responsible for maintaining all applicable low-voltage licenses in their service territory. SLA: respond to End User service requests within 48 hours of submission.',
    service_dealer:     'Dealer is the primary ongoing service contact for all assigned properties. SLA: acknowledge all work orders within 24 hours; resolve standard service issues within 72 hours.',
    install_contractor: 'Dealer provides initial hardware installation and commissioning only. All equipment must be installed in compliance with Gate Guard installation standards and local codes. No recurring service obligations after sign-off.',
    sales_partner:      'Dealer brings new property leads to Gate Guard. Dealer is not responsible for installation or service. Commissions begin upon first full billing month of End User activation and continue for the life of the account.',
    master_dealer:      'MSO acts as the billing entity for all properties in its portfolio. MSO is responsible for setting commission templates for affiliated Full Dealers, Service Dealers, and Install Contractors. MSO must maintain portal-based oversight of all active sites.',
    master_agent:       'Master Agent earns a per-unit monthly override on all properties activated through their recruited dealer network. Operational involvement is expected during dealer recruitment and onboarding; access reverts to read-only once the recruited dealer is live.',
    corporate:          'Gate Guard Direct account. No commission splits apply. All revenue is retained by Gate Guard, LLC.',
  }

  return {
    effectiveDate:               opts.effectiveDate,
    dealerLegalName:             opts.dealerLegalName,
    dealerStateAndEntityType:    opts.dealerStateAndEntityType,
    dealerAddress:               opts.dealerAddress,
    approvedTerritory:           opts.approvedTerritory,
    checkboxFullDealer:          checkbox('full_dealer'),
    checkboxServiceDealer:       checkbox('service_dealer'),
    checkboxInstallingContractor: checkbox('install_contractor'),
    checkboxSalesPartner:        checkbox('sales_partner'),
    checkboxMso:                 checkbox('master_dealer'),
    checkboxMasterAgent:         checkbox('master_agent'),
    hardwareDiscountPercentage:  hardwareDisc,
    softwareMrrPercentage:       softwarePct,
    masterAgentOverrideAmount:   maOverride,
    installFeePercentage:        installPct,
    dynamicTierNotes:            tierNotes[tier] ?? 'See Gate Guard Dealer Program Guide for role-specific SLA requirements.',
  }
}

export const AGREEMENT_TEMPLATE = `GATE GUARD, LLC AUTHORIZED DEALER & RESELLER AGREEMENT

THIS RESELLER AGREEMENT (this "Agreement") is made as of {{EFFECTIVE_DATE}} (the "Effective Date") by and between:

Gate Guard, LLC, a Georgia Limited Liability Company with an address at 980 Hammond Drive, Suite 200, Atlanta, Georgia 30328 ("Gate Guard"), and

{{DEALER_LEGAL_NAME}}, a {{DEALER_STATE_AND_ENTITY_TYPE}} with an address at {{DEALER_ADDRESS}} ("Dealer").

BACKGROUND

Gate Guard designs, manufactures, sells, licenses, and distributes proprietary gate access, security management products, and subscription services ("Products"). Dealer is engaged in the marketing, sale, installation, or support of such products. Gate Guard maintains a tiered network of partners, and Dealer desires to participate in the Gate Guard network subject to the specific tier, terms, and conditions of this Agreement.

AGREEMENT

In consideration of the mutual promises herein contained, the parties agree as follows:

1. Appointment and Dealer Tier

1.1 Appointment: Subject to the terms of this Agreement, Gate Guard hereby appoints Dealer as an authorized participant in the Gate Guard network. All rights granted are non-exclusive. Gate Guard reserves the right to market and sell Products directly (via "Gate Guard Direct") or through other partners without restriction.

1.2 Dealer Tier & Scope: Dealer's specific operational rights, responsibilities (sales, installation, service, or management), and commission structures are strictly dictated by their designated "Dealer Tier," which is defined and executed in Exhibit A (Dealer Tier & Commission Addendum) attached hereto.

1.3 License: Gate Guard grants Dealer a limited, non-exclusive, non-assignable right during the Term to market, promote, and (if applicable to their Tier) install and service the Products and subscriptions to End Users.

2. Products and Subscriptions

2.1 Purchase and Sale: Gate Guard agrees to sell hardware and license subscription services to Dealer (or directly to End Users via Dealer referral, per the applicable Tier) based on Gate Guard's then-current standard Price List.

2.2 Subscriptions: The "Your Gate Guard" program and all other software/camera services are provided as Subscription Services. Dealer shall ensure that all End Users agree to Gate Guard's standard Terms of Service and End User License Agreements (EULA) prior to activation.

2.3 End User Account Portability: End Users own their property data. So long as an End User is in material compliance with its contractual obligations, they have the right to transfer their account for the Products to another authorized Gate Guard dealer. Dealer will reasonably cooperate with such transfers.

3. Prices, Invoicing, and Commissions

3.1 Pricing: Dealer shall purchase hardware and services at Gate Guard's standard list price less the applicable discount/commission rate defined in Exhibit A. Gate Guard reserves the right to change prices with thirty (30) days written notice.

3.2 Taxes: Prices are exclusive of all taxes. Dealer is responsible for any applicable sales, use, or value-added taxes unless proper exemption documentation is provided.

3.3 Commissions & Payments: Commissions, recurring revenue splits, or setup fees shall be paid out according to the schedule and terms defined in Dealer's specific Tier in Exhibit A. If Dealer is responsible for billing the End User (e.g., MSO Tier), Dealer's payment obligations to Gate Guard are not contingent upon Dealer's collection from the End User.

4. Dealer Obligations

4.1 Promotion and Conduct: Dealer agrees to conduct business in a manner that reflects favorably on the goodwill and reputation of Gate Guard. Dealer will not engage in deceptive or unethical practices.

4.2 Role-Specific Duties: Dealer must fulfill the obligations of their assigned Tier (e.g., an "Installing Contractor" must provide professional, workmanlike installation; a "Service Dealer" must maintain prompt day-to-day service levels).

4.3 Technical Support: Depending on the assigned Tier, Dealer may be responsible for providing first-line technical support to the End User. Gate Guard will provide Tier 2/Helpdesk support to the Dealer.

4.4 Compliance: Dealer will comply with all local, state, and federal laws, including municipal gate ordinances, emergency access requirements (e.g., SOS/RFID compliance), and necessary low-voltage or contracting licenses required in their territory.

5. Term and Termination

5.1 Term: The initial term of this Agreement shall be one (1) year commencing on the Effective Date, automatically renewing for consecutive one-year periods unless either party provides sixty (60) days written notice of non-renewal.

5.2 Termination for Cause: Either party may terminate this Agreement immediately upon written notice if the other party materially breaches this Agreement and fails to cure such breach within thirty (30) days.

5.3 Termination by Gate Guard: Gate Guard may terminate this Agreement immediately if Dealer (i) fails to provide adequate service to End Users, (ii) breaches confidentiality, or (iii) fails to make payment within sixty (60) days of an invoice.

5.4 Effect of Termination: Upon termination, Dealer will cease identifying as an authorized Gate Guard dealer. Recurring commissions will be handled as dictated by Exhibit A. Surviving End User subscriptions shall remain active and may be reassigned to Gate Guard Direct or another Master System Operator.

6. Warranties and Liability

6.1 Hardware Warranty: Gate Guard warrants its proprietary hardware in accordance with its then-current standard Warranty Policy. Third-party hardware is subject only to the original manufacturer's warranty.

6.2 Disclaimers: EXCEPT AS EXPRESSLY PROVIDED, GATE GUARD PROVIDES THE PRODUCTS "AS IS." GATE GUARD DISCLAIMS ALL IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.

6.3 Limitation of Liability: UNDER NO CIRCUMSTANCES WILL GATE GUARD BE LIABLE FOR CONSEQUENTIAL, INCIDENTAL, SPECIAL, OR LOSS OF PROFIT DAMAGES. GATE GUARD'S MAXIMUM LIABILITY SHALL NOT EXCEED THE FEES PAID BY DEALER IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

7. Confidentiality and Intellectual Property

7.1 Confidentiality: Dealer will keep all Gate Guard technical data, software, pricing, API structures, and business models strictly confidential during the Term and for five (5) years thereafter (perpetually for Trade Secrets).

7.2 Intellectual Property: Gate Guard retains all exclusive ownership of its Intellectual Property, software, firmware, and trademarks. Dealer will not copy, reverse engineer, decompile, or create derivative works from Gate Guard's technology.

8. General Provisions

8.1 Governing Law: This Agreement shall be governed by the laws of the State of Georgia, without regard to conflict of law principles. Exclusive venue for disputes shall be Fulton County, Georgia.

8.2 Non-Assignment: Dealer may not assign this Agreement without Gate Guard's prior written consent.

8.3 Entire Agreement: This Agreement and its Exhibits constitute the entire understanding between the parties.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.

Gate Guard, LLC

Signature: ___________________________
Name: Russel Feldman
Title: ___________________________
Date: ___________________________

{{DEALER_LEGAL_NAME}}

Signature: ___________________________
Name: ___________________________
Title: ___________________________
Date: ___________________________

─────────────────────────────────────────────────────────────────────

EXHIBIT A: DEALER TIER & COMMISSION ADDENDUM

This Exhibit A designates the specific operational tier, rights, and compensation structure for the Dealer under the Gate Guard Authorized Dealer & Reseller Agreement.

Dealer Legal Name: {{DEALER_LEGAL_NAME}}
Territory/Market: {{APPROVED_TERRITORY}}

1. DESIGNATED DEALER TIER

The Dealer is authorized to operate under the following tier(s):

  [ {{CHECKBOX_FULL_DEALER}} ]  Full Dealership (Flagship): Authorized to sell, install, and service Gate Guard products. Sets commission templates for their network. May subcontract roles. Earns full margin splits on hardware and recurring software.

  [ {{CHECKBOX_SERVICE_DEALER}} ]  Service Dealer: Primary ongoing relationship with properties. Handles day-to-day work orders and maintenance. Earns recurring service commissions.

  [ {{CHECKBOX_INSTALLING_CONTRACTOR}} ]  Installing Contractor: Handles initial physical install and commissioning only. Paid from one-time setup fees. Earns zero recurring commissions.

  [ {{CHECKBOX_SALES_PARTNER}} ]  Sales Partner: Brings in new property leads and closes sales. Earns lifetime recurring sales commission on closed units. No installation or service responsibilities.

  [ {{CHECKBOX_MSO}} ]  MSO (Master System Operator): Dealer group account owner. The billing entity for a portfolio of properties. Sets commission templates and manages full dealers, service dealers, and installers beneath them.

  [ {{CHECKBOX_MASTER_AGENT}} ]  Master Agent: Recruits and oversees dealers. Earns a defined per-unit/month override on every property successfully activated in their network. Operational access drops once the recruited dealer is live.

2. COMMISSION & COMPENSATION STRUCTURE

Based on the selected tier above, the following financial terms, hardware discounts, and recurring revenue splits apply to the Dealer:

  • Hardware Purchase Discount: {{HARDWARE_DISCOUNT_PERCENTAGE}}% off Gate Guard's then-current standard MSRP.
  • Software/Subscription Split: Dealer retains {{SOFTWARE_MRR_PERCENTAGE}}% of monthly recurring revenue (MRR) collected from the End User.
  • Master Agent Override (If Applicable): \${{MASTER_AGENT_OVERRIDE_AMOUNT}} per unit/month.
  • Installation/Setup Fees: Dealer retains {{INSTALL_FEE_PERCENTAGE}}% of standard installation fees.

3. TIER-SPECIFIC OBLIGATIONS & NOTES

{{DYNAMIC_TIER_NOTES}}

Acknowledged and Agreed:

Gate Guard, LLC: ___________________ (Initials)
Dealer: ___________________________ (Initials)
`
