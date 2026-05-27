/**
 * GateGuard Mutual NDA Template (Dealer Program)
 * Merge vars: {{EFFECTIVE_DATE}}, {{DEALER_LEGAL_NAME}},
 *             {{DEALER_STATE_AND_ENTITY_TYPE}}, {{DEALER_ADDRESS}}
 */

export interface NdaMergeVars {
  effectiveDate: string              // e.g. "May 26, 2026"
  dealerLegalName: string            // org name
  dealerStateAndEntityType: string   // e.g. "Georgia limited liability company"
  dealerAddress: string              // "123 Main St, Atlanta, GA 30301"
}

export function buildNdaHtml(vars: NdaMergeVars): string {
  return NDA_TEMPLATE
    .replace(/\{\{EFFECTIVE_DATE\}\}/g,            vars.effectiveDate)
    .replace(/\{\{DEALER_LEGAL_NAME\}\}/g,         vars.dealerLegalName)
    .replace(/\{\{DEALER_STATE_AND_ENTITY_TYPE\}\}/g, vars.dealerStateAndEntityType)
    .replace(/\{\{DEALER_ADDRESS\}\}/g,            vars.dealerAddress)
}

/** Plain-text version used for email previews and portal display */
export const NDA_TEMPLATE = `MUTUAL NON-DISCLOSURE AGREEMENT
(Dealer Program)

THIS MUTUAL NON-DISCLOSURE AGREEMENT ("Agreement") is entered into as of {{EFFECTIVE_DATE}} ("Effective Date") by and between:

Gate Guard, LLC, a Georgia limited liability company with an address at 980 Hammond Drive, Suite 200, Atlanta, Georgia 30328 ("Gate Guard"), and

{{DEALER_LEGAL_NAME}}, a {{DEALER_STATE_AND_ENTITY_TYPE}} with an address at {{DEALER_ADDRESS}} ("Recipient").

Each of Gate Guard and Recipient may be referred to herein individually as a "Party" and collectively as the "Parties."

BACKGROUND

In connection with the Parties' consideration of a potential business relationship under the Gate Guard Dealer Program, each Party may disclose to the other certain confidential and proprietary information. The Parties desire to protect such information under the terms set forth herein.

AGREEMENT

1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any non-public information that a Party ("Disclosing Party") discloses to the other Party ("Receiving Party"), directly or indirectly, in writing, orally, or by any other means, that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and circumstances of disclosure. Confidential Information includes, without limitation: business plans and strategies, pricing structures and commission models, software architecture, APIs, customer lists, prospect data, property data, technical specifications, financial data, and any proprietary information related to the Gate Guard platform ("Nexus"), its products, or its dealer network.

Confidential Information does not include information that: (a) is or becomes publicly known through no wrongful act of the Receiving Party; (b) was rightfully known by the Receiving Party prior to disclosure; (c) is received from a third party without restriction; or (d) is independently developed by the Receiving Party without use of the Confidential Information.

2. OBLIGATIONS OF THE RECEIVING PARTY

Each Receiving Party agrees to: (a) hold the Disclosing Party's Confidential Information in strict confidence using at least the same degree of care it uses for its own confidential information, but in no event less than reasonable care; (b) use the Confidential Information solely for evaluating or conducting the Parties' contemplated business relationship; (c) not disclose the Confidential Information to any third party without the prior written consent of the Disclosing Party; and (d) limit disclosure to its employees, contractors, and advisors who have a need to know and who are bound by confidentiality obligations no less protective than those in this Agreement.

3. TERM

This Agreement shall remain in effect for a period of three (3) years from the Effective Date. Notwithstanding the foregoing, obligations with respect to Trade Secrets shall survive in perpetuity under applicable law.

4. RETURN OR DESTRUCTION OF INFORMATION

Upon request by the Disclosing Party, or upon termination of this Agreement or any related business relationship, the Receiving Party shall promptly return or certifiably destroy all tangible materials containing Confidential Information, including all copies, extracts, and summaries thereof.

5. NO LICENSE

Nothing in this Agreement grants either Party any license, right, title, or interest in or to the other Party's intellectual property, trademarks, or Confidential Information, except as expressly provided herein.

6. REMEDIES

Each Party acknowledges that a breach of this Agreement may cause irreparable harm for which monetary damages may be an inadequate remedy. Accordingly, each Party agrees that the Disclosing Party shall be entitled to seek equitable relief, including injunction and specific performance, in addition to all other remedies available at law or in equity.

7. GENERAL PROVISIONS

7.1 Governing Law. This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of law provisions. Exclusive venue for any dispute arising hereunder shall be in Fulton County, Georgia.

7.2 Entire Agreement. This Agreement constitutes the entire agreement between the Parties concerning its subject matter and supersedes all prior agreements, representations, and understandings.

7.3 Amendment. This Agreement may not be modified except by a written instrument signed by both Parties.

7.4 Severability. If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force.

7.5 Counterparts / Electronic Signatures. This Agreement may be executed in counterparts. Electronic signatures shall be deemed valid and binding to the same extent as original signatures under the ESIGN Act and UETA.

IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Effective Date.

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
`
