/**
 * lib/service-agreement.ts — Gate Guard's Gate Protection & Access Control
 * Service Agreement, parameterized per property. This is the real contract text
 * (from the master agreement) with the property-specific numbers merged in from
 * the quote. A quote's own `agreement_html` still overrides this when set.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Quote = Record<string, any>

const money = (n: number) => '$' + Math.round(n || 0).toLocaleString()
const money2 = (n: number) => '$' + (Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export interface AgreementDoc { title: string; subtitle: string; sections: { h: string; p: string }[] }

export function buildServiceAgreement(quote: Quote, opts: { monthly: number; setup: number }): AgreementDoc {
  const property = quote?.property_name || quote?.client_name || '________________________'
  const address = quote?.property_address || '________________________'
  const units = Number(quote?.units) || 0
  const term = Number(quote?.contract_term) || 60
  const years = Math.max(1, Math.round(term / 12))
  const monthly = opts.monthly
  const setup = opts.setup
  const perUnit = units > 0 ? monthly / units : 10
  const totalStart = setup + monthly * 2           // setup + first + last month
  const halfStart = totalStart / 2
  const preparedBy = quote?.created_by_name || 'Russel Feldman'
  const unitsTxt = units > 0 ? `${units} residential units` : 'the residential units at the Property'

  const sections: { h: string; p: string }[] = [
    { h: 'What this agreement does, in plain English', p:
`Gate Guard brings the Property’s access points to full working condition for a one-time set-up fee of ${money(setup)}. After that, every repair — parts, labor, trip charges, preventative maintenance — is covered by one fixed monthly fee of ${money(monthly)} for a ${years}-year term.

No fobs. No access cards. No DoorKing fees. No trip charges. No surprise repair invoices. The monthly price does not change during the term, no matter how many times a gate goes down.

The plain-English summaries in this document are provided for convenience. Where a summary and the numbered terms differ, the numbered terms control.` },

    { h: 'Parties & Effective Date', p:
`This Gate Protection & Access Control Service Agreement (the “Agreement”) is entered into as of the Effective Date, by and between:

SERVICE PROVIDER — Gate Guard, LLC, 980 Hammond Drive, Ste. 200, Atlanta, GA 30328. Phone 844-4MY-GATE / (770) 776-8095. Email info@gateguard.co. Contact: ${preparedBy}.

CUSTOMER — ${property}${address && address !== '________________________' ? `, ${address}` : ''}.

Gate Guard, LLC and Customer are referred to individually as a “Party” and together as the “Parties.”` },

    { h: '1. Definitions & Scope', p:
`1.1 These terms govern the access control, proactive gate monitoring, preventative maintenance, repair, and reporting services (the “Services”) provided by Gate Guard, LLC (“Gate Guard”) to Customer at the Property. By signing this Agreement or using the Services, Customer agrees to be bound by these terms.
1.2 “Access Point” means any vehicular gate, pedestrian gate, amenity door, or office door listed in the Proposal.
1.3 “Gate Guard Equipment” means all hardware supplied or installed by Gate Guard — controllers, readers, callboxes, cameras, network devices, and software licenses. Gate Guard Equipment remains the property of Gate Guard throughout the Term.
1.4 “Physical Gate” means the steel gate panel, frame, posts, hinges, and structural welds — the barrier itself — as distinct from the motors, operators, controllers, readers, callboxes, and cameras that operate it.
1.5 “Covered Repair” means any repair, service call, part, or replacement on Gate Guard Equipment or on gate motors, operators, callboxes, and related access hardware at a listed Access Point, arising from normal use or failure, and not excluded under Section 4.
1.6 This Agreement, together with the Proposal, is the entire understanding of the Parties. In any conflict, this Agreement controls.` },

    { h: '2. Covered Access Points & Property Scope', p:
`2.1 Gate Guard will bring to full operating condition and thereafter maintain the Access Points set forth in the Proposal. All work required to bring each opening online is included in the one-time set-up fee, with no change orders for the scope described in the Proposal.
2.2 Monitored Cameras. Gate Guard will install and monitor the cameras described in the Proposal, included in the monthly fee unless otherwise stated. Cameras are monitored, not merely recorded. When an Access Point is struck or damaged, Gate Guard will make the relevant footage available so damage can be attributed to the responsible driver and pursued as a chargeback. Gate Guard does not guarantee recovery from any third party.
2.3 Unit Count. Monthly fees are based on ${unitsTxt}. If the unit count changes by more than five percent (5%), either Party may request a good-faith adjustment of the monthly fee at the same ${money2(perUnit)} per unit per month rate.` },

    { h: '3. Services Provided', p:
`3.1 Repair or Replace to Full Operating Condition. Gate Guard will do whatever is required to bring each listed Access Point online — parts, welding, operator repair, and replacement of failed components — as part of the one-time set-up. Thereafter every Covered Repair is Gate Guard’s responsibility: parts, labor, monthly preventative maintenance, and trip charges, at no additional cost.
3.2 Mobile Access & PMS Integration. Residents enter by mobile phone credential — no fobs or access cards issued, purchased, or replaced. API integration with Yardi, Entrata, or RealPage synchronizes move-ins and move-outs automatically. Gate Guard assumes all software and platform fees. Existing DoorKing hardware, its phone line, and DoorKing charges are retired.
3.3 Monitoring, Maintenance & Support. Monitored cameras as described in the Proposal; scheduled monthly preventative maintenance at each Access Point; remote support and non-scheduled repair dispatch with zero trip charges; software updates, user management, and video retrieval.
3.4 Customer Portal. Gate Guard may provide a digital portal to view daily reports, camera feeds, and gate-health analytics, subject to Section 6.` },

    { h: '4. Maintenance & Support Scope — Covered vs. Excluded', p:
`4.1 Included in the monthly program: installation and repair of motors, operators, callboxes, controllers, and readers; maintenance, repair, or replacement of Gate Guard-supplied cameras, controllers, readers, and callboxes due to failure; scheduled preventative maintenance; remote support and non-scheduled repairs; software updates, user management, PMS integration, and video retrieval — with no trip charges.
Excluded / billable: Customer-provided power and internet at all locations; the Physical Gate panel, hinges, door leaf and frame (physical gate & hinge coverage available as an add-on under Section 8.1); replacement of equipment damaged, removed, or disabled by or at Customer’s direction; damage caused by Customer or ownership; custom development or integration with unsupported systems. A trip charge applies only if Gate Guard is denied confirmed access.
THE ONE THING NOT COVERED: Gate Guard covers everything at each opening except the Physical Gate itself and its hinges. That coverage is available for $150 per gate per month under Section 8.1.
4.2 Customer Responsibilities. Customer shall, at its cost: (a) provide and maintain power and internet at each Access Point; (b) provide safe, timely technician access during confirmed appointments; (c) maintain the Property in a condition safe for technicians; and (d) promptly report faults, damage, or outages.
4.3 Power Requirement. Working power must be present at each Access Point. Gate Guard’s obligations at an Access Point are suspended while power or internet is unavailable there through no fault of Gate Guard.` },

    { h: '5. Term, Renewal & Termination', p:
`5.1 Initial Term. The Initial Term is ${years} year${years === 1 ? '' : 's'} (${term} months), beginning on the Go-Live Date.
5.2 Automatic Renewal. After the Initial Term this Agreement renews for successive one-year terms unless either Party gives written notice of non-renewal at least sixty (60) days before the term expires. Renewal terms may be terminated by Customer at any time on sixty (60) days’ notice with no early termination fee.
5.3 Termination for Cause. Either Party may terminate for material breach not cured within sixty (60) days after written notice. If an Access Point remains non-operational for more than thirty (30) consecutive days for reasons within Gate Guard’s control without a written remediation plan, that is a material breach by Gate Guard. No early termination fee is owed if Customer terminates for cause.
5.4 Termination for Convenience & Early Termination Fee. Customer may terminate for convenience on sixty (60) days’ notice. If notice is given in the first year of the Initial Term, the amount due is all remaining monthly fees for that year plus all twelve monthly fees for the following year. In the second year, the amount due is the greater of the remaining monthly fees for that year or two (2) monthly fees. In the final year of the Initial Term and in any renewal term, no early termination fee applies — sixty (60) days’ notice only, with the monthly fee paid through the notice period.
5.5 “Monthly fee” means the then-current recurring monthly amount under Section 7, including elected add-ons under Section 8. The last-month payment held under Section 7.4 is credited against any amount due under Section 5.4.
5.6 Any early termination fee is due within thirty (30) days of termination and is agreed liquidated damages (a reasonable estimate of Gate Guard’s front-loaded, unrecovered equipment, repair, and installation investment), not a penalty.
5.7 Effect of Termination — Equipment Return. On expiration or termination and payment in full, Gate Guard may remove all Gate Guard Equipment within thirty (30) days, during business hours, leaving each opening safe and secured with penetrations capped or patched. Customer may instead elect to purchase the installed equipment in place at its then-current fair market value on written request before removal.` },

    { h: '6. User Accounts & Data', p:
`Customer is responsible for the confidentiality of login credentials and all activity under its accounts. Access is granted solely for Customer’s internal business use during the Term. Customer must notify Gate Guard immediately of any unauthorized use or breach; Gate Guard may disable access if a security threat is identified and will restore it once resolved. Resident data synchronized from Customer’s PMS is used solely to operate the Services, is not sold, and is handled per applicable privacy laws. Camera footage is retained for the platform’s standard retention period, available to Customer on request, and may be released to law enforcement pursuant to lawful process.` },

    { h: '7. Fees & Payment Terms', p:
`7.1 Recurring Monthly Program: ${money2(monthly)} per month (${units > 0 ? `${units} units × ${money2(perUnit)}/unit/mo` : 'per the Proposal'}) — access control, all parts & labor, preventative maintenance, and monitoring. Monitored cameras per the Proposal are included.
7.2 One-Time Set-Up: ${money2(setup)}, itemized by Access Point in the Proposal, not subject to change orders for the scope described.
7.3 Total Due to Start: ${money2(totalStart)} (one-time set-up ${money2(setup)} + first and last month of service ${money2(monthly * 2)}).
7.4 Payment Schedule. Deposit — ${money2(halfStart)} (fifty percent of the Total to Start), due on signing. Go-Live payment — ${money2(halfStart)} (the remaining fifty percent), due when the gates go live. Recurring monthly fees begin on the 15th of the calendar month following Go-Live, and in no event less than thirty (30) days after Go-Live. The last-month payment is held for the Term and applied to the final month (or credited under Section 5.4); it is not an additional charge. Amounts are exclusive of applicable taxes, which are Customer’s responsibility.
7.5 Price Lock. The monthly fee will not increase during the Initial Term regardless of the number, frequency, or cost of repairs. Gate Guard may adjust pricing for any renewal on at least ninety (90) days’ notice; if Customer declines, it may decline renewal under Section 5.2 with no fee.
7.6 Late Payment. Invoices are due within thirty (30) days. Amounts more than thirty (30) days past due accrue interest at the lesser of 1.5% per month or the maximum permitted by law. Gate Guard will give written notice and ten (10) business days to cure before suspending Service for non-payment, and will not leave an Access Point unsecured.` },

    { h: '8. Optional Add-Ons — Customer Elections', p:
`None of the following is required; each is included only if elected on the Proposal. Unchecked items are excluded from all totals.
8.1 Physical Gate & Hinge Coverage — $150 per gate, per month. Extends coverage to the Physical Gate panel, frame, posts, hinges, and welds — the one category otherwise excluded under Section 4.
8.2 Additional Monitored Cameras — $100 per camera, per month. Added to the existing invoice; no new vendor or contract. Cameras may be added at any time during the Term at this rate.
8.3 Other add-ons as set forth and elected on the Proposal. Elected add-ons are billed on the same schedule as the base program and are included in the “monthly fee” for purposes of Section 5.4.` },

    { h: '9. Implementation & Go-Live', p:
`9.1 After signature and receipt of the deposit: (1) Customer approves the program and confirms elected add-ons; (2) Customer signs and pays the deposit; (3) Gate Guard brings the openings to full operating condition; (4) the system is integrated with Yardi, Entrata, or RealPage; (5) Go-Live — cameras come online, residents move to phone entry, monitoring begins, and the balance is due.
9.2 “Go-Live Date” means the date all Access Points are operational and monitoring is active, confirmed in writing (email sufficient) by both Parties. Customer will not unreasonably withhold or delay confirmation.
9.3 Delays outside Gate Guard’s control — power, internet, permitting, gate access, or third-party utility work — extend the Go-Live target day for day.
9.4 Customer’s PMS is Yardi, Entrata, RealPage, or other as stated; Customer will provide the API credentials and authorizations needed for integration.` },

    { h: '10. Intellectual Property & Equipment Ownership', p:
`10.1 All software, platforms, analytics, methods, and processes used to deliver the Services remain the exclusive IP of Gate Guard, LLC; nothing transfers ownership to Customer.
10.2 Gate Guard grants Customer a non-exclusive, non-transferable license to use the platform and portal at the Property during the Term.
10.3 Gate Guard Equipment remains Gate Guard’s personal property and does not become a fixture regardless of attachment. Customer will not encumber, move, modify, or permit third-party service of Gate Guard Equipment without prior written consent.
10.4 Video footage and incident data are handled securely and per applicable privacy laws.` },

    { h: '11. Insurance', p:
`Gate Guard maintains commercial general liability insurance of not less than $1,000,000 per occurrence, workers’ compensation as required by Georgia law, and commercial automobile liability. Gate Guard will furnish a certificate naming Customer as an additional insured on written request.` },

    { h: '12. Indemnification', p:
`12.1 By Customer. Customer will indemnify, defend, and hold harmless Gate Guard and its officers, employees, and contractors from claims, damages, or losses (including reasonable attorneys’ fees) arising from Customer’s negligence, misuse of the Services, or failure to maintain the Property safely for technicians.
12.2 By Gate Guard. Gate Guard will indemnify, defend, and hold harmless Customer from third-party claims arising from Gate Guard’s negligence, gross negligence, or willful misconduct, subject to Section 13.` },

    { h: '13. Limitation of Liability', p:
`13.1 Gate Guard is a service provider, not an insurer; fees are for services only, not insurance premiums. Customer maintains its own property and liability insurance.
13.2 No access-control or camera system prevents all unauthorized entry, crime, or loss; Gate Guard does not guarantee prevention of any injury, loss, or damage.
13.3 Gate Guard is not liable for failures caused by misuse, vandalism, theft, loss of internet, power outages, third parties, or events beyond its reasonable control.
13.4 Gate Guard’s total aggregate liability is capped at the total service fees paid in the six (6) months preceding the claim.
13.5 Neither Party is liable for indirect, incidental, special, punitive, or consequential damages or lost profits; this does not limit Customer’s obligation to pay amounts due under Sections 5.4 and 7.` },

    { h: '14. General Provisions', p:
`Force Majeure — neither Party is liable for delay or failure caused by events beyond its reasonable control; fees abate for any Service materially suspended more than thirty (30) consecutive days. Assignment — no assignment without consent (not unreasonably withheld), except to an affiliate or successor on a sale of the Property or assets; binds permitted successors, including any purchaser of the Property. Notices — in writing, by hand, overnight courier, or email with confirmation; termination notices also by courier or certified mail. Independent Contractor — Gate Guard performs as an independent contractor; no partnership, agency, or employment is created. Amendment & Waiver — only by a writing signed by both Parties; no waiver by non-enforcement. Severability — an unenforceable provision is modified minimally; the rest stays in effect. Entire Agreement — this Agreement and the Proposal are the complete and exclusive agreement and supersede prior discussions. Counterparts & Electronic Signature — may be signed in counterparts and delivered electronically; electronic and scanned signatures have the same effect as originals.` },

    { h: '15. Governing Law & Dispute Resolution', p:
`This Agreement is governed by Georgia law without regard to conflict-of-law principles. Before filing suit, the Parties will attempt in good faith to resolve any dispute through senior representatives for thirty (30) days after written notice. Any action will be brought exclusively in the state or federal courts in Fulton County, Georgia, and each Party consents to that jurisdiction and venue. The prevailing Party in any enforcement action is entitled to its reasonable attorneys’ fees and costs.` },

    { h: 'The short version', p:
`One repair quote elsewhere costs $5,000 to $10,000 and covers a single gate a single time. ${money(setup)} brings the openings online, and ${money(monthly)} a month keeps them that way for ${years} year${years === 1 ? '' : 's'} — with no fobs, no cards, no DoorKing fees, no trip charges, and cameras that show you who damaged the gate. You never buy the same repair twice.

By signing below, the Customer accepts the Proposal and agrees to the terms above. Prepared by ${preparedBy}, Gate Guard.` },
  ]

  return {
    title: 'Gate Protection & Access Control Service Agreement',
    subtitle: `${property}${units > 0 ? ` — ${units} Units` : ''}`,
    sections,
  }
}
