# Opportunity Life Cycle — Vision

Principle for every stage: **all glass, all 5th-grader simple.** One job per screen, large targets, plain language. This is the *vision* (where we're going), not just what's already in the system — several stages are net-new and bigger than today's pieces.

The 7 stages live on the opportunity record as a guided flow:
**Survey → Financials → Proposals → Negotiate → Contract & Invoice → Sign → Payment.**

---

## 1. Survey
At its core a **simple question format** that gathers what's needed to define the **SOW** and **BOM**.
- Guided Q&A (not a blank form) — answers build the scope and the bill of materials.
- **Audio capture**: record a walkthrough; the system **transcribes + interprets** it into the structured survey (devices, doors, units, notes) → SOW + BOM.
- Output: a clean SOW + BOM that flows straight into Financials.
- *Net-new vs today:* the audio→structured-survey interpretation.

## 2. Financials (quote builder)
The pricing calculator we built **plus install cost from the BOM** → full profitability.
- Takes the BOM (parts + labor) and computes **cost of install**, not just monthly fees.
- Produces **profitability** for the deal.
- At its core an **IRR model** — ensures the *dealer* stays profitable over the deal's life (upfront cost vs. recurring revenue over time). Keeps the dealer from signing an unprofitable deal.
- Reuses: the Gate Guard cost + dealer Fee/Retail engine; quote_line_items.
- *Net-new vs today:* BOM-driven install cost + IRR / lifetime-profitability modeling.

## 3. Proposals
A **landing-page proposal**, designed like **Qwilr / QuotientApp** — a beautiful web page, not a PDF.
- Interactive, branded, mobile-friendly customer-facing page.
- **Optional add-ons are a must** — toggleable upsells the customer can add themselves (cameras, monitoring, smart locks, etc.). **Add-ons are where we make more money**, so they're front and center.
- Live total updates as the customer toggles add-ons.
- Reuses: proposal v2 + public doc portal (`/document/[slug]`) as the delivery rails.
- *Net-new vs today:* the Qwilr-style interactive template + customer-toggleable add-on pricing.

## 4. Negotiate
An **agentic tool** that coaches the dealer through negotiation.
- AI assistant: objection handling, what to concede, where margin allows movement (tied to the IRR model so it never pushes the dealer below profitable).
- Suggests counter-offers, talking points, and the profitability impact of each concession in real time.
- *Net-new vs today:* this whole agentic negotiation assistant.

## 5. Contract & Invoice
**Contract creation + deposit invoicing.**
- Generate the contract from the agreed proposal (agreement template).
- Create the **deposit invoice** (Stripe payment link).
- Reuses: agreement template, invoices + Stripe.

## 6 + 7. Sign & Payment
Signing + deposit payment is the **conversion point**.
- E-sign the contract; collect the deposit.
- On **contract signed AND deposit paid** → the opportunity **hands over**: creates a **Customer** (if not already one) and a **Job** (active install).
- Reuses: `document_signatures` e-sign (`/sign/[token]`), Stripe; ties to site-activation rule (#60).

---

## Build notes
- **Glass audit:** confirm Survey, Quote builder, Proposal, Sign pages are glass (or rebuild) — vision is all-glass, no legacy screens in the flow.
- Order of net-new effort: BOM→install-cost + IRR (Financials), Qwilr-style proposal w/ add-ons, audio→survey, agentic Negotiate.
- The deposit→Customer+Job automation is the capstone (#82, #60).
