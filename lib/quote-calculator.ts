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

  // ── Monthly Service Fee ────────────────────────────────────────────────────
  const baseMonthly = Math.max(units * PRICING.monthly.perUnit, PRICING.monthly.minimum);
  items.push({
    id: makeId(),
    description: `GateGuard Monthly Service — ${units} units @ $${PRICING.monthly.perUnit}/unit/mo${
      units * PRICING.monthly.perUnit < PRICING.monthly.minimum ? ' (minimum applies)' : ''
    }`,
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

    if (t2.accessPoints.working > 0) {
      items.push({ id: makeId(), description: 'GateGuard Access Point — Reader + Controller (Working)', qty: t2.accessPoints.working, unitPrice: p.accessPoint.working, total: p.accessPoint.working * t2.accessPoints.working, recurring: false, billing: 'billable', editable: true });
    }
    if (t2.accessPoints.nonWorking > 0) {
      items.push({ id: makeId(), description: 'GateGuard Access Point — Reader + Controller (Non-Working)', qty: t2.accessPoints.nonWorking, unitPrice: p.accessPoint.nonWorking, total: p.accessPoint.nonWorking * t2.accessPoints.nonWorking, recurring: false, billing: 'billable', editable: true });
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

  // ── Gate Maintenance ───────────────────────────────────────────────────────
  const gm = survey.addOns.gateMaintenance;
  if (gm.enabled) {
    if (gm.initialRepairCost > 0) {
      items.push({ id: makeId(), description: 'Entry Gate Repair — Initial Service' + (gm.initialRepairBilling === 'included' ? ' (Included)' : ''), qty: 1, unitPrice: gm.initialRepairBilling === 'billable' ? gm.initialRepairCost : 0, total: gm.initialRepairBilling === 'billable' ? gm.initialRepairCost : 0, recurring: false, billing: gm.initialRepairBilling, editable: true });
    }
    if (gm.entryGates > 0) {
      const maintMonthly = PRICING.addOns.gateMaintenancePerGate * gm.entryGates;
      items.push({ id: makeId(), description: `Entry Gate Repair Plan — ${gm.entryGates} gate${gm.entryGates > 1 ? 's' : ''} (up to 2 leafs each)`, qty: gm.entryGates, unitPrice: PRICING.addOns.gateMaintenancePerGate, total: maintMonthly, recurring: true, period: 'monthly', billing: 'billable', editable: true });
    }
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

export function calculateTotals(lineItems: QuoteLineItem[], property: QuoteProperty): QuoteTotals {
  const setupTotal = lineItems
    .filter(i => !i.recurring)
    .reduce((sum, i) => sum + i.total, 0);

  // Only billable one-time items drive the deposit
  const billableSetupTotal = lineItems
    .filter(i => !i.recurring && i.billing !== 'included')
    .reduce((sum, i) => sum + i.total, 0);

  const monthlyTotal = lineItems
    .filter(i => i.recurring)
    .reduce((sum, i) => sum + i.total, 0);

  const contractMonths = PRICING.contract.months;
  const yearOneTotal   = setupTotal + (monthlyTotal * 12);
  const contractValue  = setupTotal + (monthlyTotal * contractMonths);

  // Deposit = 50% of billable setup + 1st month; same at go-live
  const depositDue    = billableSetupTotal * PRICING.contract.depositPercent + monthlyTotal;
  const goLivePayment = billableSetupTotal * PRICING.contract.goLivePercent  + monthlyTotal;

  const units    = property.units || 0;
  const dealerMRR = Math.min(units * PRICING.monthly.dealerOverrideMax, monthlyTotal * 0.25);

  return { setupTotal, billableSetupTotal, monthlyTotal, yearOneTotal, contractValue, depositDue, goLivePayment, dealerMRR };
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
