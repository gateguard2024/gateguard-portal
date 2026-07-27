# Gate Guard — Company Context

> Internal reference. Captures who Gate Guard is, what we sell, why we're different, and the
> industry gaps we play against. Directional strategy in places — verify hard numbers before
> using externally.

---

## 1. What Gate Guard is

Gate Guard is a **proptech + physical-security company for multifamily (MDU) properties** —
apartment communities, gated developments, and student/senior housing. We put the access, video,
intercom, smart-unit, connectivity, and monitoring stack on a property, tie it together on one
cloud platform, and back it with a live monitoring/dispatch center — then we run the whole thing
through a **dealer/reseller channel** rather than selling only direct.

The through-line: property managers are drowning in disconnected point solutions (one vendor for
gates, another for cameras, another for the intercom, another for internet). Gate Guard is the
**single operator** that installs, integrates, monitors, and maintains all of it, and pays a
channel of dealers and reps to grow it.

---

## 2. What we sell (services)

**Access control & gates.** Gate operators, controllers, readers, callboxes/intercoms, and
credentials — built on Brivo as the cloud access layer, with middleware bridging Brivo ↔ UniFi and
other systems. Per-property Brivo provisioning is handled inside our platform.

**Video / cameras.** IP cameras and cloud VMS on Eagle Eye Networks, with an optional
**call-center-monitored** tier (live eyes on the feed) versus unmonitored recording.

**Intercom / visitor management.** Callboxes and IP intercoms plus **GateCard** — our property
platform for visitor management and a resident kiosk.

**Smart units.** Per-unit smart devices — smart locks, thermostats, and full smart-unit packages —
priced per unit, with tiers (lock only → lock + thermostat + smart unit).

**Connectivity.** Cellular/IoT relays and managed-network options at the property, and the ability
to displace or ride alongside bulk-internet agreements (a major MDU lever).

**Monitoring & dispatch (SOC).** A live Security Operations Center / call center (ggsoc.com) that
monitors cameras, answers callbox calls, and dispatches — the recurring service that turns hardware
into a subscription.

**The platform (Nexus).** Our operating system for the whole business: dealer ops, quoting/CPQ,
field service and work orders, a floor-plan/system-design tool, billing, and an **AI Army** of
agents — ARIA (lead intelligence on multifamily properties), TRINITY (voice), SCOUT (market),
BEACON (client comms), FORGE (quote builder), and others.

**How it's priced.** A **per-unit monthly recurring** model (site fee + entry points + cameras +
smart + connectivity, floored) plus a **one-time install** fee, with a built-in distribution split
across dealer, sales rep, distributor, and Gate Guard.

---

## 3. Who we sell through (channel & structure)

Gate Guard runs a **six-tier hierarchy**: corporate → master agent → master dealer →
(sales partner / install dealer / service dealer) → client. Dealers quote, install, and maintain
sites; corporate provides the platform, the SOC, the integrations, and the pricing floors; reps and
distributors earn a per-unit cut. The economics are deliberately simple and per-unit so a dealer can
forecast a deal in their head, with a **dealer maintenance floor ($150 / entry point / month)** that
guarantees the installer is paid to keep the gates working.

---

## 4. What makes us unique

- **One operator for the whole stack.** Access + video + intercom + smart + connectivity +
  monitoring under one roof, integrated — versus the norm of 4–5 disconnected vendors per property.
- **Middleware, not lock-in.** We bridge best-of-breed systems (Brivo, Eagle Eye, UniFi) instead of
  forcing a single proprietary box, so we can enter properties with incumbent gear and displace it
  over time.
- **A live SOC behind the hardware.** Most access/camera vendors sell a box; we sell an outcome —
  someone is actually watching and answering. That's the recurring moat.
- **A real dealer channel with clean economics.** Per-unit pricing, transparent splits, and a
  maintenance floor make Gate Guard easy to sell *and* easy to service for a channel partner.
- **An AI-native go-to-market.** ARIA finds and scores multifamily prospects by their actual pain
  (broken gates, expiring bulk-internet contracts, aging proptech), surfaces the decision-maker
  chain, and hands reps a plan — intelligence most security integrators simply don't have.

---

## 5. Strengths (pros)

- **Vertical focus.** Purpose-built for multifamily, not a generic security company stretching to
  fit — the pricing, the SOC scripts, the survey/design tools all assume an apartment community.
- **Recurring revenue by design.** Monitoring + smart + connectivity convert one-time installs into
  monthly subscriptions.
- **Displacement strategy.** Because we integrate rather than rip-and-replace, expiring bulk
  agreements and aging access hardware are entry points, not obstacles.
- **Owned distribution + owned platform.** We control both the channel and the software, so margin
  and data stay in-house.
- **Data advantage.** The Intel DB (aria_properties) accumulates a persistent, growing map of
  properties, their tech stacks, contracts, and decision-makers — an asset that compounds.

---

## 6. Industry shortfalls we play against

The multifamily physical-security / proptech market has structural gaps Gate Guard is built to
exploit:

- **Fragmentation.** Properties run a patchwork of single-purpose vendors that don't talk to each
  other; nobody owns the integrated outcome.
- **"Sold and forgotten" hardware.** Gates and access systems are installed and then left to rot —
  broken gates, always-open entrances, and no one accountable for maintenance is the #1 resident
  complaint we see in the field.
- **Bulk-internet lock-in expiring.** Class B/C properties are tied into aging bulk-internet and
  ROE agreements; as those windows open, the incumbent connectivity + proptech is up for grabs.
- **No live monitoring.** Cameras that record but nobody watches; callboxes that ring to a
  disconnected number. The "someone is actually there" layer is missing.
- **Weak, generic sales motions.** Security integrators prospect by cold list, not by property-level
  pain signals — they don't know which specific community has a failing gate or an expiring contract.
- **Data silos.** Property intel (units, systems, contracts, decision-makers) lives nowhere durable;
  every rep re-researches from scratch.

Gate Guard's answer to each: one integrated operator, a maintenance-backed SOC subscription, a
displacement playbook timed to contract windows, and an AI intel layer (ARIA) that targets by pain.

---

## 7. Honest gaps / where we're still building

For balance — the shortfalls to keep working on:

- **Contact-data trust at scale.** Verified, dialable decision-maker data is the make-or-break for a
  sales team; deepening and verifying contacts is an ongoing priority.
- **Coverage completeness.** Reps need confidence they're seeing the *whole* market in an area, not a
  sample — discovery breadth and "we found ~X% of 250+ unit properties" honesty signals matter.
- **Workflow integration.** The tool must push cleanly into reps' CRM/pipeline and enforce territory
  + dedup so a team can adopt it without friction.
- **Monitoring/trigger automation.** Turning ARIA into a daily-login product means proactive alerts
  ("bulk contract expiring," "management changed") rather than only on-demand lookups.
- **Channel enablement.** Onboarding, training, and clean per-deal economics need to keep scaling as
  the dealer base grows.

---

## 8. One-liner

**Gate Guard is the single operator that installs, integrates, monitors, and maintains the entire
access-and-security stack for apartment communities — sold through a dealer channel, run on one
AI-native platform, and backed by a live SOC — in an industry full of disconnected boxes nobody is
watching.**
