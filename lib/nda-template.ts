/**
 * GateGuard Mutual NDA Template (Dealer Program) — v2, May 2026
 * Merge vars: {{EFFECTIVE_DATE}}, {{DEALER_LEGAL_NAME}},
 *             {{DEALER_STATE_AND_ENTITY_TYPE}}, {{DEALER_ADDRESS}}
 *
 * Updates from v1:
 *   - Legally Compelled Disclosure clause (§3)
 *   - IT Backup Exception in Return/Destruction (§5)
 *   - Mutual Non-Solicitation clause (§6)
 *   - Bulleted exclusions & obligations for readability
 *   - "AS IS" disclaimer in No License section
 *   - Strengthened injunctive relief language (no bond requirement)
 *   - Explicit state & federal court venue in Fulton County
 */

export interface NdaMergeVars {
  effectiveDate: string              // e.g. "May 26, 2026"
  dealerLegalName: string            // org name
  dealerStateAndEntityType: string   // e.g. "Georgia limited liability company"
  dealerAddress: string              // "123 Main St, Atlanta, GA 30301"
}

export function buildNdaHtml(vars: NdaMergeVars): string {
  return NDA_TEMPLATE
    .replace(/\{\{EFFECTIVE_DATE\}\}/g,                  vars.effectiveDate)
    .replace(/\{\{DEALER_LEGAL_NAME\}\}/g,               vars.dealerLegalName)
    .replace(/\{\{DEALER_STATE_AND_ENTITY_TYPE\}\}/g,    vars.dealerStateAndEntityType)
    .replace(/\{\{DEALER_ADDRESS\}\}/g,                  vars.dealerAddress)
}

/** Plain-text version used for signing page display and email previews */
export const NDA_TEMPLATE = `MUTUAL NON-DISCLOSURE AGREEMENT
(Dealer Program)

THIS MUTUAL NON-DISCLOSURE AGREEMENT ("Agreement") is entered into as of {{EFFECTIVE_DATE}} ("Effective Date") by and between:

Gate Guard, LLC, a Georgia limited liability company with an address at 980 Hammond Drive, Suite 200, Atlanta, Georgia 30328 ("Gate Guard"), and

{{DEALER_LEGAL_NAME}}, a {{DEALER_STATE_AND_ENTITY_TYPE}} with an address at {{DEALER_ADDRESS}} ("Recipient").

Each of Gate Guard and Recipient may be referred to herein individually as a "Party" and collectively as the "Parties."

BACKGROUND

In connection with the Parties' consideration of a potential business relationship under the Gate Guard Dealer Program (the "Purpose"), each Party may disclose to the other certain confidential, proprietary, and sensitive information. The Parties desire to protect such information under the terms and conditions set forth herein.

AGREEMENT

1. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any non-public, proprietary information that a Party ("Disclosing Party") discloses to the other Party ("Receiving Party"), whether disclosed directly or indirectly, in writing, orally, visually, or by any other means. Confidential Information includes information that is designated as confidential or that a reasonable person would understand to be confidential given the nature of the information and the circumstances of disclosure.

Confidential Information includes, without limitation: business plans and strategies, pricing structures, commission models, software architecture, APIs, source code, customer lists, prospect data, property data, technical specifications, financial data, and any proprietary information related to the Gate Guard platform ("Nexus"), its hardware, its products, or its dealer network.

Confidential Information does not include information that:

  (a) Is or becomes publicly known through no wrongful act or breach of this Agreement by the Receiving Party;

  (b) Was rightfully known by the Receiving Party prior to its disclosure by the Disclosing Party, without an obligation of confidentiality;

  (c) Is rightfully received by the Receiving Party from a third party without restriction on disclosure; or

  (d) Is independently developed by the Receiving Party without access to or use of the Disclosing Party's Confidential Information.

2. OBLIGATIONS OF THE RECEIVING PARTY

The Receiving Party agrees to:

  (a) Hold the Disclosing Party's Confidential Information in strict confidence, using at least the same degree of care it uses to protect its own confidential information of a similar nature, but in no event less than a reasonable degree of care;

  (b) Use the Confidential Information solely for the Purpose of evaluating or conducting the Parties' contemplated business relationship;

  (c) Not disclose the Confidential Information to any third party without the prior written consent of the Disclosing Party; and

  (d) Limit internal disclosure strictly to its employees, officers, directors, contractors, and legal or financial advisors who have a verifiable need to know for the Purpose, provided that such individuals are bound by written confidentiality obligations no less protective than those contained in this Agreement.

3. LEGALLY COMPELLED DISCLOSURE

If the Receiving Party becomes legally compelled (by law, regulation, subpoena, court order, or similar legal process) to disclose any of the Disclosing Party's Confidential Information, the Receiving Party shall, to the extent legally permitted, provide the Disclosing Party with prompt written notice thereof prior to any disclosure. This notice allows the Disclosing Party the opportunity to seek a protective order or other appropriate remedy. If such protective order is not obtained, the Receiving Party shall furnish only that portion of the Confidential Information that is legally required and shall exercise reasonable efforts to obtain reliable assurance that confidential treatment will be accorded to the information disclosed.

4. TERM

This Agreement shall govern all disclosures of Confidential Information made during the period commencing on the Effective Date and ending three (3) years thereafter. The Receiving Party's obligations of confidentiality and non-use with respect to the Confidential Information shall survive for a period of three (3) years following the expiration or termination of this Agreement. Notwithstanding the foregoing, the Receiving Party's obligations with respect to any Confidential Information that constitutes a "Trade Secret" under applicable law shall survive in perpetuity for so long as such information remains a trade secret.

5. RETURN OR DESTRUCTION OF INFORMATION

Upon the written request of the Disclosing Party, or upon the termination of this Agreement or the cessation of the Parties' business relationship, the Receiving Party shall promptly return or certifiably destroy all tangible materials containing or reflecting the Confidential Information, including all copies, extracts, notes, and summaries thereof.

IT Backup Exception: Notwithstanding the foregoing, the Receiving Party shall not be required to destroy or delete Confidential Information that is stored on routine, automated computer or cloud-based backup systems, provided that such retained information shall remain subject to the confidentiality and non-use obligations of this Agreement until it is eventually overwritten or destroyed in the ordinary course of business.

6. MUTUAL NON-SOLICITATION

To protect the proprietary interests of both Parties, each Party agrees that during the term of this Agreement and for a period of twelve (12) months following its termination, neither Party shall, directly or indirectly, solicit for employment, hire, or engage as an independent contractor any current employee of the other Party who was introduced to or became known to the soliciting Party in connection with the Purpose. This restriction shall not prohibit the hiring of any individual who responds to a general public advertisement or job posting not specifically directed at the other Party's employees.

7. NO LICENSE OR WARRANTIES

All Confidential Information remains the sole and exclusive property of the Disclosing Party. Nothing in this Agreement grants, or shall be construed to grant, the Receiving Party any license, right, title, or interest in or to the Disclosing Party's intellectual property, trademarks, copyrights, patents, or Confidential Information. All Confidential Information is provided "AS IS," without any warranty, express or implied, regarding its accuracy or completeness.

8. REMEDIES

Each Party acknowledges that a breach or threatened breach of this Agreement may cause severe and irreparable harm to the Disclosing Party for which monetary damages alone would be an inadequate remedy. Accordingly, the Parties agree that the Disclosing Party shall be entitled to seek equitable relief, including temporary and permanent injunctions and specific performance, in addition to all other remedies available at law or in equity, without the necessity of posting a bond.

9. GENERAL PROVISIONS

9.1 Governing Law & Venue. This Agreement shall be governed by and construed in accordance with the laws of the State of Georgia, without regard to its conflict of law principles. Exclusive jurisdiction and venue for any dispute arising hereunder shall lie in the state and federal courts located in Fulton County, Georgia.

9.2 Entire Agreement. This Agreement constitutes the entire agreement between the Parties concerning the subject matter hereof and supersedes all prior or contemporaneous agreements, representations, and understandings, whether written or oral.

9.3 Amendment & Waiver. This Agreement may not be amended, modified, or waived except by a written instrument explicitly referencing this Agreement and signed by authorized representatives of both Parties.

9.4 Severability. If any provision of this Agreement is found by a court of competent jurisdiction to be invalid or unenforceable, such provision shall be severed, and the remaining provisions shall continue in full force and effect.

9.5 Counterparts & Electronic Signatures. This Agreement may be executed in counterparts, each of which shall be deemed an original, but all of which together shall constitute one and the same instrument. Electronic, facsimile, or digitally verified signatures shall be deemed valid and binding to the same extent as original ink signatures under the ESIGN Act and UETA.

IN WITNESS WHEREOF, the Parties, through their duly authorized representatives, have executed this Mutual Non-Disclosure Agreement as of the Effective Date.

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
