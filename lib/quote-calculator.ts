// GateGuard Quote Calculator
// Generates line items and totals from site survey inputs

import {
  SiteSurvey,
  QuoteLineItem,
  QuoteTotals,
  QuoteProperty,
  PRICING,
} from '@/types/quote';

let lineItemCounter = 0;
function makeId() {
  return `li_${++lineItemCounter}_${Date.now()}`;
}

export function calculateLineItems(survey: SiteSurvey, property: QuoteProperty): QuoteLineItem[] {
  const items: QuoteLineItem[] = [];
  const units = property.units || 0;

  // ── Monthly Service Fee — GateGuard bills property directly ────────────────
  const baseMonthly = Math.max(units * PRICING.monthly.perUnit, PRICING.monthly.minimum);
  items.push({
    id: makeId(),
    description: `GateGuard Access & Maintenance Plan — ${units} units @ $${PRICING.monthly.perUnit}/unit/mo${
      units * PRICING.monthly.perUnit < PRICING.monthly.minimum ? ' ($1,200/mo minimum applies)' : ''
    } (GateGuard bills property directly)`,
    qty: 1,
    unitPrice: baseMonthly,
    total: baseMonthly,
    recurring: true,
    period: 'monthly',
    billing: 'billable',
    editable: false,
  });

  // ── Access Control — Tier 1 (Mobile Pass) ─────────────────────────────────
  if (survey.accessTier === 'tier1_mobile') {
    const t1 = survey.tier1;
    const p  = PRICING.tier1;

    const t1Lines: [string, number, number][] = [
      ['Primary Door — Controller + Reader (Working)',      t1.primaryDoors.working,    p.primaryDoor.working],
      ['Primary Door — Controller + Reader (Non-Working)',  t1.primaryDoors.nonWorking, p.primaryDoor.nonWorking],
      ['Secondary Door — Controller Only (Working)',        t1.secondaryDoors.working,    p.secondaryDoor.working],
      ['Secondary Door — Controller Only (Non-Working)',    t1.secondaryDoors.nonWorking, p.secondaryDoor.nonWorking],
      ['Guest Gate — App-Only Controller (Working)',        t1.guestGates.working,    p.guestGate.working],
      ['Guest Gate — App-Only Controller (Non-Working)',    t1.guestGates.nonWorking, p.guestGate.nonWorking],
      ['Resident Gate — Reader (Working)',                  t1.residentGates.working,    p.residentGate.working],
      ['Resident Gate — Reader (Non-Working)',              t1.residentGates.nonWorking, p.residentGate.nonWorking],
    ];

    for (const [desc, qty, unitPrice] of t1Lines) {
      if (qty > 0) {
        items.push({ id: makeId(), description: desc, qty, unitPrice, total: unitPrice * qty, recurring: false, billing: 'billable', editable: true });
      }
    }

    if (t1.callbox) {
      items.push({ id: makeId(), description: 'GateGuard Video Callbox Installation', qty: 1, unitPrice: p.callbox, total: p.callbox, recurring: false, billing: 'billable', editable: true });
    }
  }

  // ── Access Control — Tier 2 (GateGuard Integrated) ────────────────────────
  if (survey.accessTier === 'tier2_gg') {
    const t2 = survey.tier2;
    const p  = PRICING.tier2;

    const t2Lines: [string, number, number][] = [
      ['Resident Gate — Full Reader + Controller (Working)',      t2.residentGates.working,    p.residentGate.working],
      ['Resident Gate — Full Reader + Controller (Non-Working)',  t2.residentGates.nonWorking, p.residentGate.nonWorking],
      ['Guest Gate — Full Reader + Controller (Working)',         t2.guestGates.working,    p.guestGate.working],
      ['Guest Gate — Full Reader + Controller (Non-Working)',     t2.guestGates.nonWorking, p.guestGate.nonWorking],
      ['Primary Door — Full Reader + Controller (Working)',       t2.primaryDoors.working,    p.primaryDoor.working],
      ['Primary Door — Full Reader + Controller (Non-Working)',   t2.primaryDoors.nonWorking, p.primaryDoor.nonWorking],
      ['Secondary Door — Full Reader + Controller (Working)',     t2.secondaryDoors.working,    p.secondaryDoor.working],
      ['Secondary Door — Full Reader + Controller (Non-Working)', t2.secondaryDoors.nonWorking, p.secondaryDoor.nonWorking],
    ];

    for (const [desc, qty, unitPrice] of t2Lines) {
      if (qty > 0) {
        items.push({ id: makeId(), description: desc, qty, unitPrice, total: unitPrice * qty, recurring: false, billing: 'billable', editable: true });
      }
    }
    if (t2.callbox) {
      items.push({ id: makeId(), description: 'GateGuard Video Callbox Installation', qty: 1, unitPrice: p.callbox, total: p.callbox, recurring: false, billing: 'billable', editable: true });
    }
  }

  // ── Network Infrastructure ─────────────────────────────────────────────────
  const net = survey.network;
  const netLines: [string, number, number, typeof net.router.billing][] = [
    ['Network Router',          net.router.qty,       PRICING.network.router,       net.router.billing],
    ['4-Port PoE Switch',       net.switch4port.qty,  PRICING.network.switch4port,  net.switch4port.billing],
    ['8-Port PoE Switch',       net.switch8port.qty,  PRICING.network.switch8port,  net.switch8port.billing],
    ['16-Port PoE Switch',      net.switch16port.qty, PRICING.network.switch16port, net.switch16port.billing],
    ['PTP Radio — Small',       net.radioSmall.qty,   PRICING.network.radioSmall,   net.radioSmall.billing],
    ['PTP Radio — Medium',      net.radioMedium.qty,  PRICING.network.radioMedium,  net.radioMedium.billing],
    ['PTP Radio — Large',       net.radioLarge.qty,   PRICING.network.radioLarge,   net.radioLarge.billing],
    ['Weatherproof Enclosure',  net.enclosure.qty,    PRICING.network.enclosure,    net.enclosure.billing],
  ];

  for (const [desc, qty, unitPrice, billing] of netLines) {
    if (qty > 0) {
      const isBillable = billing === 'billable';
      items.push({ id: makeId(), description: desc + (isBillable ? '' : ' (Included)'), qty, unitPrice: isBillable ? unitPrice : 0, total: isBillable ? unitPrice * qty : 0, recurring: false, billing, editable: true });
    }
  }

  // ── Cameras ────────────────────────────────────────────────────────────────
  const cam = survey.cameras;

  // Existing — monitored
  if (cam.existing.monitored > 0) {
    items.push({ id: makeId(), description: 'Existing Camera Reprogramming (Included with Monitoring)', qty: cam.existing.monitored, unitPrice: 0, total: 0, recurring: false, billing: 'included', editable: false });
    items.push({ id: makeId(), description: 'Camera Cloud Monitoring — Existing Cameras', qty: cam.existing.monitored, unitPrice: PRICING.cameras.existingMonitoredMonthly, total: PRICING.cameras.existingMonitoredMonthly * cam.existing.monitored, recurring: true, period: 'monthly', billing: 'billable', editable: true });
  }

  // Existing — standalone (billable reprogramming, no MRR)
  if (cam.existing.standalone > 0) {
    items.push({ id: makeId(), description: 'Existing Camera Reprogramming — Billable Labor', qty: cam.existing.standalone, unitPrice: PRICING.cameras.existingStandaloneSetup, total: PRICING.cameras.existingStandaloneSetup * cam.existing.standalone, recurring: false, billing: 'billable', editable: true });
  }

  // New — monitored, included billing (hardware free, $100/mo)
  if (cam.new.monitored.qty > 0 && cam.new.monitored.billing === 'included') {
    items.push({ id: makeId(), description: 'New Camera Installation (Included with Service Contract)', qty: cam.new.monitored.qty, unitPrice: 0, total: 0, recurring: false, billing: 'included', editable: false });
    items.push({ id: makeId(), description: 'Camera Cloud Monitoring — New Cameras', qty: cam.new.monitored.qty, unitPrice: PRICING.cameras.newMonitoredIncludedMonthly, total: PRICING.cameras.newMonitoredIncludedMonthly * cam.new.monitored.qty, recurring: true, period: 'monthly', billing: 'billable', editable: true });
  }

  // New — monitored, billable ($350 install, $85/mo)
  if (cam.new.monitored.qty > 0 && cam.new.monitored.billing === 'billable') {
    items.push({ id: makeId(), description: 'New Camera Installation — Billable', qty: cam.new.monitored.qty, unitPrice: PRICING.cameras.newMonitoredBillableSetup, total: PRICING.cameras.newMonitoredBillableSetup * cam.new.monitored.qty, recurring: false, billing: 'billable', editable: true });
    items.push({ id: makeId(), description: 'Camera Cloud Monitoring — New Cameras', qty: cam.new.monitored.qty, unitPrice: PRICING.cameras.newMonitoredBillableMonthly, total: PRICING.cameras.newMonitoredBillableMonthly * cam.new.monitored.qty, recurring: true, period: 'monthly', billing: 'billable', editable: true });
  }

  // New — standalone (always billable, no MRR)
  if (cam.new.standalone > 0) {
    items.push({ id: makeId(), description: 'New Camera Installation — Standalone (Billable)', qty: cam.new.standalone, unitPrice: PRICING.cameras.newStandaloneSetup, total: PRICING.cameras.newStandaloneSetup * cam.new.standalone, recurring: false, billing: 'billable', editable: true });
  }

  // ── LPR Cameras ───────────────────────────────────────────────────────────
  if (survey.addOns.lprCameras.qty > 0) {
    const lprQty = survey.addOns.lprCameras.qty;
    items.push({ id: makeId(), description: 'LPR Camera Installation', qty: lprQty, unitPrice: PRICING.cameras.lprSetup, total: PRICING.cameras.lprSetup * lprQty, recurring: false, billing: 'billable', editable: true });
    items.push({ id: makeId(), description: 'LPR Camera Monitoring & Analytics', qty: lprQty, unitPrice: PRICING.cameras.lprMonthly, total: PRICING.cameras.lprMonthly * lprQty, recurring: true, period: 'monthly', billing: 'billable', editable: true });
  }

  // ── Gate Operator Service Plan ─────────────────────────────────────────────
  // INCLUDED in base GateGuard plan — operators, wiring & control equipment only.
  // Not billable. Shown on quote to set expectations.
  // The physical iron/steel gate itself is NOT covered — see Physical Gate Coverage below.
  const gm = survey.addOns.gateMaintenance;
  if (gm.entryGates > 0) {
    // One-time initial repair (if gates need pre-service work before plan starts)
    if (gm.initialRepairCost > 0) {
      items.push({ id: makeId(), description: 'Gate Operator Initial Service' + (gm.initialRepairBilling === 'included' ? ' (Included)' : ''), qty: 1, unitPrice: gm.initialRepairBilling === 'billable' ? gm.initialRepairCost : 0, total: gm.initialRepairBilling === 'billable' ? gm.initialRepairCost : 0, recurring: false, billing: gm.initialRepairBilling, editable: true });
    }
    // Ongoing operator service plan — INCLUDED at $0/mo (part of base plan)
    items.push({ id: makeId(), description: `Gate Operator Service Plan — ${gm.entryGates} gate${gm.entryGates > 1 ? 's' : ''} · operators, wiring & control equipment (Included with base plan)`, qty: gm.entryGates, unitPrice: 0, total: 0, recurring: true, period: 'monthly', billing: 'included', editable: false });
  }

  // ── Physical Gate Structure Coverage (optional add-on) ─────────────────────
  // Covers steel gate panel, tracks, hinges, rollers, and structural components
  const pgc = survey.addOns.physicalGateCoverage;
  if (pgc && pgc.enabled && pgc.entryGates > 0) {
    const pgcMonthly = PRICING.addOns.gateMaintenancePerGate * pgc.entryGates;
    items.push({ id: makeId(), description: `Physical Gate Coverage — ${pgc.entryGates} gate${pgc.entryGates > 1 ? 's' : ''} · steel gate, tracks & structural components`, qty: pgc.entryGates, unitPrice: PRICING.addOns.gateMaintenancePerGate, total: pgcMonthly, recurring: true, period: 'monthly', billing: 'billable', editable: true });
  }

  // ── Custom / Missing Equipment Items ──────────────────────────────────────
  for (const item of survey.addOns.customItems) {
    if (item.qty > 0 && item.unitPrice > 0 && item.description.trim()) {
      const isBillable = item.billing === 'billable';
      items.push({ id: makeId(), description: item.description + (isBillable ? '' : ' (Included)'), qty: item.qty, unitPrice: isBillable ? item.unitPrice : 0, total: isBillable ? item.unitPrice * item.qty : 0, recurring: false, billing: item.billing, editable: true });
    }
  }

  return items;
}

export function calculateTotals(lineItems: QuoteLineItem[], property: QuoteProperty, discountPercent = 0, depositPercent = 50, discountMode: 'percent' | 'amount' = 'percent', discountAmount = 0, mrrDiscount = 0, mrrDiscountMode: 'percent' | 'amount' = 'percent'): QuoteTotals {
  const setupTotal = lineItems
    .filter(i => !i.recurring)
    .reduce((sum, i) => sum + i.total, 0);

  // Only billable one-time items drive the deposit
  const billableSetupTotal = lineItems
    .filter(i => !i.recurring && i.billing !== 'included')
    .reduce((sum, i) => sum + i.total, 0);

  // Apply discount to billable setup
  const clampedDiscount      = Math.min(Math.max(discountPercent, 0), 100);
  const discountFactor       = 1 - clampedDiscount / 100;
  const discountedSetupTotal = discountMode === 'amount'
    ? Math.max(0, billableSetupTotal - discountAmount)
    : billableSetupTotal * discountFactor;
  const discountSavings      = billableSetupTotal - discountedSetupTotal;

  const mrrRaw = lineItems.filter(i => i.recurring).reduce((s, i) => s + i.total, 0);
  const mrrDiscountAmount2 = mrrDiscountMode === 'amount'
    ? Math.min(mrrDiscount, mrrRaw)
    : mrrRaw * (mrrDiscount / 100);
  const monthlyTotal = Math.max(0, mrrRaw - mrrDiscountAmount2);

  const contractMonths = PRICING.contract.months;
  const yearOneTotal   = discountedSetupTotal + (monthlyTotal * 12);
  const contractValue  = discountedSetupTotal + (monthlyTotal * contractMonths);

  // Deposit = depositPercent% of discounted setup + 1st month; balance = remainder + 1st month
  const depositFraction = Math.min(Math.max(depositPercent, 0), 100) / 100;
  const depositDue      = discountedSetupTotal * depositFraction + monthlyTotal;
  const goLivePayment   = discountedSetupTotal * (1 - depositFraction) + monthlyTotal;

  const units     = property.units || 0;
  const dealerMRR = Math.min(units * PRICING.monthly.dealerOverrideMax, monthlyTotal * 0.25);

  const mrrDiscountSavings = mrrRaw - monthlyTotal;
  return { setupTotal, billableSetupTotal, discountedSetupTotal, discountSavings, monthlyTotal, mrrDiscountSavings, yearOneTotal, contractValue, depositDue, goLivePayment, dealerMRR };
}

export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const seq  = String(Math.floor(Math.random() * 9000) + 1000);
  return `GG-${year}-${seq}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}

export function getValidUntilDate(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
