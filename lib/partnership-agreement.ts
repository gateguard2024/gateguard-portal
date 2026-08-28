/**
 * lib/partnership-agreement.ts — the GateGuard Property Partnership service
 * agreement, generated from the SAME partnership config as the proposal so the two
 * always match. Billing-mode aware (resident-funded vs property bulk monthly).
 */
import { resolvePartnership, money, type PartnershipConfig } from '@/lib/partnership-proposal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>
export interface AgreementSection { h: string; p: string }
export interface AgreementDoc { title: string; subtitle: string; sections: AgreementSection[] }

export function buildPartnershipAgreement(quote: Quote, cfg: PartnershipConfig = {}): AgreementDoc {
  const r = resolvePartnership(quote, cfg)
  const resident = r.billingMode === 'resident'
  const property = r.property
  const units = r.units

  const fundingIntro = resident
    ? `The ongoing program is funded by residents through a parking & amenity fee of ${money(r.residentFee)} per unit, which Gate Guard bills and collects directly at each lease signing and renewal — never through the Property’s office.`
    : `After set-up, the Property covers the parking & amenity program at a flat ${money(r.propertyMonthly)} per month, billed to the Property in bulk. Residents are not billed individually.`

  const feeLine = resident
    ? `7.3 Resident Parking & Amenity Fee. The program is funded by a parking & amenity fee of ${money(r.residentFee)} per unit, billed and collected by Gate Guard directly from residents at each lease signing and renewal, covering a 12-month parking and amenity term. The fee is never billed through the Property’s office. Customer authorizes Gate Guard to present the fee to residents in coordination with the Customer’s PMS.`
    : `7.3 Property Bulk Parking & Amenity Fee. In lieu of resident billing, the Property pays Gate Guard a flat ${money(r.propertyMonthly)} per month covering the parking & amenity program for all units, beginning on the 15th of the calendar month following the Go-Live Date. Residents are not billed individually. The monthly fee will not increase during the Initial Term.`

  const sections: AgreementSection[] = [
    { h: 'What this agreement does, in plain English', p:
`Gate Guard brings the Property’s access points to full working condition for a one-time set-up fee of ${money(r.setupFee)}${r.setupNote ? ` — ${r.setupNote}` : ''}, half at signing and half at Go-Live. ${resident ? 'After that, the Property pays Gate Guard nothing on an ongoing basis — no monthly fee, no service calls, no parts or labor billing.' : `After that, the Property covers the program at a flat ${money(r.propertyMonthly)} per month, billed in bulk.`}

${fundingIntro}

No fobs. No access cards. No DoorKing fees. No trip charges. No surprise repair invoices. Every repair — parts, labor, trip charges, and preventative maintenance — is covered for the ${r.termMonths}-month Term.

Where a plain-English summary and the numbered terms differ, the numbered terms control.` },

    { h: 'Parties & Effective Date', p:
`This Gate Protection & Access Control Service Agreement (the “Agreement”) is entered into as of the Effective Date, by and between:

SERVICE PROVIDER — Gate Guard, LLC, 980 Hammond Drive, Ste. 200, Atlanta, GA 30328. Phone 844-4MY-GATE / (770) 776-8095. Email info@gateguard.co. Contact: ${r.preparedBy} — rfeldman@gateguard.co.

CUSTOMER — Legal Entity Name: ____________________  ·  Property: ${property}${r.address ? `, ${r.address}` : ''}  ·  ${units > 0 ? `${units} residential units` : ''}  ·  Management Company: ${r.managementCo || '____________________'}  ·  Contact: ${r.contactName || '____________________'}.

Effective Date: ____________   Target Go-Live Date: ____________. Gate Guard, LLC and Customer are each a “Party.”` },

    { h: '1. Definitions & Scope', p:
`1.1 These terms govern the access control, proactive gate monitoring, preventative maintenance, repair, and reporting services (the “Services”) provided by Gate Guard, LLC (“Gate Guard”) to Customer at the Property.
1.2 “Access Point” means any vehicular gate, pedestrian gate, amenity door, or office door listed in Section 2.
1.3 “Gate Guard Equipment” means all hardware supplied or installed by Gate Guard — controllers, readers, callboxes, cameras, network devices, and software licenses — which remains Gate Guard’s property throughout the Term.
1.4 “Physical Gate” means the steel gate panel, frame, posts, hinges, and welds — the barrier itself — as distinct from the motors, operators, controllers, readers, callboxes, and cameras that operate it.
1.5 “Covered Repair” means any repair, part, or replacement on Gate Guard Equipment or on gate motors, operators, callboxes, and related access hardware at a listed Access Point, arising from normal use or failure, not excluded under Section 4.
1.6 This Agreement, together with the GateGuard Property Partnership Proposal for the Property, is the entire understanding of the Parties. In any conflict, this Agreement controls.` },

    { h: '2. Covered Access Points & Property Scope', p:
`2.1 Gate Guard will bring to full operating condition and thereafter maintain the ${r.accessPoints} Access Points at the Property — ${r.gates} vehicle gate${r.gates === 1 ? '' : 's'}${r.gateNote ? ` (${r.gateNote})` : ''} and ${r.amenityDoors} amenity door${r.amenityDoors === 1 ? '' : 's'}. All work required to bring each opening online is included in the one-time set-up fee in Section 7, with no change orders for the scope described in the Proposal.
2.2 Monitored Cameras. Gate Guard will install and monitor ${r.cameras} camera${r.cameras === 1 ? '' : 's'}${r.cameraNote ? ` (${r.cameraNote})` : ''}, monitored, not merely recorded, and included in the program. When an Access Point is struck or damaged, Gate Guard will make the relevant footage available so the damage can be attributed to the responsible driver and pursued as a chargeback. Gate Guard does not guarantee recovery from any third party.
2.3 Unit Count. The program is based on ${units} residential units. If the unit count changes by more than five percent (5%), either Party may request a good-faith adjustment at the same per-unit basis.` },

    { h: '3. Services Provided', p:
`3.1 Repair or Replace to Full Operating Condition. Gate Guard will do whatever is required to bring each listed Access Point online — parts, welding, operator repair, and replacement of failed components — as part of the one-time set-up. Thereafter every Covered Repair is Gate Guard’s responsibility: parts, labor, monthly preventative maintenance, and trip charges, at no additional cost.
3.2 Mobile Access & PMS Integration. Residents enter by mobile phone credential — no fobs or access cards issued, purchased, or replaced. API integration with Yardi, Entrata, or RealPage synchronizes move-ins and move-outs automatically. Gate Guard assumes all software and platform fees. Existing DoorKing hardware, its phone line, and DoorKing charges are retired.
3.3 Monitoring, Maintenance & Support. Monitored cameras per Section 2.2; scheduled monthly preventative maintenance at each Access Point; remote support and non-scheduled repair dispatch with zero trip charges; software updates, user management, and video retrieval.
3.4 Resident Support. Access questions, credentials, and troubleshooting are handled by Gate Guard directly.` },

    { h: '4. Maintenance & Support Scope — Covered vs. Excluded', p:
`4.1 Included: installation and repair of motors, operators, callboxes, controllers, and readers; maintenance, repair, or replacement of Gate Guard-supplied cameras, controllers, readers, and callboxes due to failure; scheduled preventative maintenance; remote support and non-scheduled repairs; software updates, user management, PMS integration, and video retrieval — with no trip charges. Excluded / billable: Customer-provided power and internet at all locations; the Physical Gate panel, hinges, door leaf and frame (physical gate & hinge coverage available under Section 8.1); replacement of equipment damaged, removed, or disabled by or at Customer’s direction; damage caused by Customer or ownership; custom development with unsupported systems. A trip charge applies only if Gate Guard is denied confirmed access.
THE ONE THING NOT COVERED. Gate Guard covers everything at each opening except the Physical Gate itself and its hinges. That coverage is available for ${money(r.addonGateRate)} per gate per month under Section 8.1.
4.2 Customer Responsibilities. Customer shall, at its cost, provide and maintain power and internet at each Access Point; provide safe, timely technician access during confirmed appointments; maintain the Property safely for technicians; and promptly report faults, damage, or outages.
4.3 Power Requirement. Gate Guard’s obligations at an Access Point are suspended while power or internet is unavailable there through no fault of Gate Guard.` },

    { h: '5. Term, Renewal & Termination', p:
`5.1 Initial Term. The Initial Term is ${r.termYears} year${r.termYears === 1 ? '' : 's'} (${r.termMonths} months), beginning on the Go-Live Date.
5.2 Automatic Renewal. After the Initial Term this Agreement renews for successive one-year terms unless either Party gives written notice of non-renewal at least sixty (60) days before the term expires.
5.3 Termination for Cause. Either Party may terminate for material breach not cured within sixty (60) days after written notice. If an Access Point remains non-operational for more than thirty (30) consecutive days for reasons within Gate Guard’s control without a written remediation plan, that is a material breach by Gate Guard.
5.4 Effect of Termination — Equipment Return. On expiration or termination and payment in full, Gate Guard may remove all Gate Guard Equipment within thirty (30) days, during business hours, leaving each opening safe and secured. Customer may instead elect to purchase the installed equipment in place at its then-current fair market value on written request before removal.` },

    { h: '6. User Accounts & Data', p:
`Customer is responsible for the confidentiality of login credentials and all activity under its accounts. Access is granted solely for Customer’s internal business use during the Term. Customer must notify Gate Guard immediately of any unauthorized use or breach. Resident data synchronized from Customer’s PMS is used solely to operate the Services, is not sold, and is handled per applicable privacy laws. Camera footage is retained for the platform’s standard retention period, available to Customer on request, and may be released to law enforcement pursuant to lawful process.` },

    { h: '7. Fees & Payment Terms', p:
`7.1 One-Time Set-Up. ${money(r.setupFee)}, covering the openings in Section 2. Deposit of ${money(r.deposit)} (50%) is due on signing; the remaining ${money(r.goLive)} is due at Go-Live.
7.2 ${resident ? `No Ongoing Cost to the Property. The Property owes Gate Guard no monthly fee, service-call charge, or parts and labor billing during the Term.` : `Ongoing Cost to the Property. ${money(r.propertyMonthly)} per month, billed to the Property.`}
${feeLine}
7.4 Taxes are excluded and are the responsible Party’s obligation. Amounts more than thirty (30) days past due accrue interest at the lesser of 1.5% per month or the maximum permitted by law.` },

    { h: '8. Optional Add-Ons — Customer Elections', p:
`None of the following is required; each is included only if elected on the Proposal. 8.1 Physical Gate & Hinge Coverage — ${money(r.addonGateRate)} per gate, per month, extends coverage to the Physical Gate panel, frame, posts, hinges, and welds. 8.2 Additional Monitored Cameras — ${money(r.addonCameraRate)} per camera, per month, beyond the ${r.cameras} included. Where elected add-ons carry a recurring charge, the Parties will confirm in writing whether it is resident-funded or billed to the Property.` },

    { h: '9. Implementation & Go-Live', p:
`9.1 After signature and the deposit: (1) Customer approves the program and elected add-ons; (2) Customer signs and pays the deposit; (3) Gate Guard brings the openings to full operating condition; (4) the system integrates with Yardi, Entrata, or RealPage${resident ? ' and resident billing is configured' : ''}; (5) Go-Live — cameras come online, residents move to phone entry, monitoring begins, and the balance is due.
9.2 “Go-Live Date” means the date all Access Points are operational and monitoring is active, confirmed in writing by both Parties. Delays outside Gate Guard’s control extend Go-Live day for day.` },

    { h: '10. Intellectual Property & Equipment Ownership', p:
`All software, platforms, analytics, and processes used to deliver the Services remain the exclusive IP of Gate Guard, LLC; nothing transfers ownership to Customer. Gate Guard grants Customer a non-exclusive, non-transferable license to use the platform and portal at the Property during the Term. Gate Guard Equipment remains Gate Guard’s personal property and does not become a fixture regardless of attachment.` },

    { h: '11. Insurance', p:
`Gate Guard maintains commercial general liability insurance of not less than $1,000,000 per occurrence, workers’ compensation as required by Georgia law, and commercial automobile liability. Gate Guard will furnish a certificate naming Customer as an additional insured on written request.` },

    { h: '12. Indemnification', p:
`12.1 Customer will indemnify, defend, and hold harmless Gate Guard and its officers, employees, and contractors from claims arising from Customer’s negligence, misuse of the Services, or failure to maintain the Property safely for technicians. 12.2 Gate Guard will indemnify, defend, and hold harmless Customer from third-party claims arising from Gate Guard’s negligence, gross negligence, or willful misconduct, subject to Section 13.` },

    { h: '13. Limitation of Liability', p:
`Gate Guard is a service provider, not an insurer. No access-control or camera system prevents all unauthorized entry, crime, or loss; Gate Guard does not guarantee prevention of any injury, loss, or damage, and is not liable for failures caused by misuse, vandalism, theft, loss of internet, power outages, third parties, or events beyond its reasonable control. Gate Guard’s total aggregate liability is capped at the total fees Gate Guard received attributable to the Property in the six (6) months preceding the claim. Neither Party is liable for indirect, incidental, special, punitive, or consequential damages or lost profits.` },

    { h: '14. General Provisions', p:
`Force Majeure — neither Party is liable for delay or failure caused by events beyond its reasonable control. Assignment — no assignment without consent (not unreasonably withheld), except to an affiliate or successor on a sale of the Property or assets; binds permitted successors, including any purchaser of the Property. Notices — in writing, by hand, overnight courier, or email with confirmation. Independent Contractor — Gate Guard performs as an independent contractor; no partnership, agency, or employment is created. Amendment & Waiver — only by a writing signed by both Parties. Severability — an unenforceable provision is modified minimally; the rest stays in effect. Entire Agreement — this Agreement and the Proposal are the complete agreement and supersede prior discussions. Counterparts & Electronic Signature — may be signed in counterparts and delivered electronically.` },

    { h: '15. Governing Law & Dispute Resolution', p:
`This Agreement is governed by Georgia law without regard to conflict-of-law principles. Before filing suit, the Parties will attempt in good faith to resolve any dispute through senior representatives for thirty (30) days after written notice. Any action will be brought exclusively in the state or federal courts in Fulton County, Georgia, and each Party consents to that jurisdiction and venue. The prevailing Party is entitled to its reasonable attorneys’ fees and costs.` },

    { h: 'The short version', p:
`One repair quote elsewhere costs $5,000 to $10,000 and covers a single gate a single time. ${money(r.setupFee)} brings the openings at ${property} online${resident ? ' — and after that the Property pays nothing. Residents fund the program through a ' + money(r.residentFee) + ' per-unit parking & amenity fee' : ` — and after that the Property covers the program at ${money(r.propertyMonthly)} per month`}, and the gates stay covered for ${r.termYears} years, with no fobs, no cards, no DoorKing fees, and no trip charges.` },
  ]

  return {
    title: 'Gate Protection & Access Control Service Agreement',
    subtitle: `${property}${units > 0 ? ` — ${units} Units — Property Partnership Program` : ' — Property Partnership Program'}`,
    sections,
  }
}
