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
    editable: false,
  });

  // ── Access Control — Tier 1 (Mobile Pass) ─────────────────────────────────
  if (survey.accessTier === 'tier1_mobile') {
    const t1 = survey.tier1;
    const p = PRICING.tier1;

    if (t1.primaryDoors.qty > 0) {
      const unitPrice = t1.primaryDoors.condition === 'working' ? p.primaryDoor.working : p.primaryDoor.nonWorking;
      items.push({
        id: makeId(),
        description: `Primary Door — Controller + Reader (${t1.primaryDoors.condition === 'working' ? 'Working' : 'Non-Working'})`,
        qty: t1.primaryDoors.qty,
        unitPrice,
        total: unitPrice * t1.primaryDoors.qty,
        recurring: false,
        editable: true,
      });
    }

    if (t1.secondaryDoors.qty > 0) {
      const unitPrice = t1.secondaryDoors.condition === 'working' ? p.secondaryDoor.working : p.secondaryDoor.nonWorking;
      items.push({
        id: makeId(),
        description: `Secondary Door — Controller Only (${t1.secondaryDoors.condition === 'working' ? 'Working' : 'Non-Working'})`,
        qty: t1.secondaryDoors.qty,
        unitPrice,
        total: unitPrice * t1.secondaryDoors.qty,
        recurring: false,
        editable: true,
      });
    }

    if (t1.guestGates.qty > 0) {
      const unitPrice = t1.guestGates.condition === 'working' ? p.guestGate.working : p.guestGate.nonWorking;
      items.push({
        id: makeId(),
        description: `Guest Gate — App-Only Controller (${t1.guestGates.condition === 'working' ? 'Working' : 'Non-Working'})`,
        qty: t1.guestGates.qty,
        unitPrice,
        total: unitPrice * t1.guestGates.qty,
        recurring: false,
        editable: true,
      });
    }

    if (t1.residentGates.qty > 0) {
      const unitPrice = t1.residentGates.condition === 'working' ? p.residentGate.working : p.residentGate.nonWorking;
      items.push({
        id: makeId(),
        description: `Resident Gate — Reader (${t1.residentGates.condition === 'working' ? 'Working' : 'Non-Working'})`,
        qty: t1.residentGates.qty,
        unitPrice,
        total: unitPrice * t1.residentGates.qty,
        recurring: false,
        editable: true,
      });
    }

    if (t1.callbox) {
      items.push({
        id: makeId(),
        description: 'Video Callbox Installation',
        qty: 1,
        unitPrice: p.callbox,
        total: p.callbox,
        recurring: false,
        editable: true,
      });
    }
  }

  // ── Access Control — Tier 2 (Ubiquity/Unifi) ──────────────────────────────
  if (survey.accessTier === 'tier2_ubiquity') {
    const t2 = survey.tier2;
    const p = PRICING.tier2;

    if (t2.accessPoints.qty > 0) {
      const unitPrice = t2.accessPoints.condition === 'working' ? p.accessPoint.working : p.accessPoint.nonWorking;
      items.push({
        id: makeId(),
        description: `Unifi Access Point — Reader + Controller (${t2.accessPoints.condition === 'working' ? 'Working' : 'Non-Working'})`,
        qty: t2.accessPoints.qty,
        unitPrice,
        total: unitPrice * t2.accessPoints.qty,
        recurring: false,
        editable: true,
      });
    }

    if (t2.callbox) {
      items.push({
        id: makeId(),
        description: 'Unifi Video Callbox Installation',
        qty: 1,
        unitPrice: p.callbox,
        total: p.callbox,
        recurring: false,
        editable: true,
      });
    }
  }

  // ── Network / Backhaul ─────────────────────────────────────────────────────
  const net = survey.network;
  if (net.backhaul.needed && net.backhaul.qty > 0) {
    const isBillable = net.backhaul.billing === 'billable';
    items.push({
      id: makeId(),
      description: `Network Backhaul${isBillable ? '' : ' (Included)'}`,
      qty: net.backhaul.qty,
      unitPrice: isBillable ? PRICING.network.backhaulSetup : 0,
      total: isBillable ? PRICING.network.backhaulSetup * net.backhaul.qty : 0,
      recurring: false,
      billing: net.backhaul.billing,
      editable: true,
    });
  }

  if (net.radioLinks.needed && net.radioLinks.qty > 0) {
    const isBillable = net.radioLinks.billing === 'billable';
    items.push({
      id: makeId(),
      description: `Radio Link Bridge${isBillable ? '' : ' (Included)'}`,
      qty: net.radioLinks.qty,
      unitPrice: isBillable ? PRICING.network.radioLinkSetup : 0,
      total: isBillable ? PRICING.network.radioLinkSetup * net.radioLinks.qty : 0,
      recurring: false,
      billing: net.radioLinks.billing,
      editable: true,
    });
  }

  // ── Cameras ────────────────────────────────────────────────────────────────
  const cam = survey.cameras;

  if (cam.new.monitored > 0) {
    items.push({
      id: makeId(),
      description: 'New Camera Installation (included with service contract)',
      qty: cam.new.monitored,
      unitPrice: PRICING.cameras.newMonitoredSetup,
      total: 0,
      recurring: false,
      billing: 'included',
      editable: false,
    });
    items.push({
      id: makeId(),
      description: 'Camera Cloud Monitoring — New Cameras',
      qty: cam.new.monitored,
      unitPrice: PRICING.cameras.newMonitoredMonthly,
      total: PRICING.cameras.newMonitoredMonthly * cam.new.monitored,
      recurring: true,
      period: 'monthly',
      editable: true,
    });
  }

  if (cam.new.standalone > 0) {
    items.push({
      id: makeId(),
      description: 'New Camera Installation — Standalone (billable)',
      qty: cam.new.standalone,
      unitPrice: PRICING.cameras.newStandaloneSetup,
      total: PRICING.cameras.newStandaloneSetup * cam.new.standalone,
      recurring: false,
      billing: 'billable',
      editable: true,
    });
  }

  if (cam.existing.monitored > 0) {
    items.push({
      id: makeId(),
      description: 'Existing Camera Reprogramming (included with monitoring)',
      qty: cam.existing.monitored,
      unitPrice: PRICING.cameras.existingMonitoredSetup,
      total: 0,
      recurring: false,
      billing: 'included',
      editable: false,
    });
    items.push({
      id: makeId(),
      description: 'Camera Cloud Monitoring — Existing Cameras',
      qty: cam.existing.monitored,
      unitPrice: PRICING.cameras.existingMonitoredMonthly,
      total: PRICING.cameras.existingMonitoredMonthly * cam.existing.monitored,
      recurring: true,
      period: 'monthly',
      editable: true,
    });
  }

  if (cam.existing.standalone > 0) {
    items.push({
      id: makeId(),
      description: 'Existing Camera Reprogramming — Billable Labor',
      qty: cam.existing.standalone,
      unitPrice: PRICING.cameras.existingStandaloneSetup,
      total: PRICING.cameras.existingStandaloneSetup * cam.existing.standalone,
      recurring: false,
      billing: 'billable',
      editable: true,
    });
  }

  // ── Optional Add-Ons ───────────────────────────────────────────────────────
  const addOns = survey.addOns;

  if (addOns.lprCameras.qty > 0) {
    items.push({
      id: makeId(),
      description: 'LPR Camera Installation',
      qty: addOns.lprCameras.qty,
      unitPrice: PRICING.cameras.lprSetup,
      total: PRICING.cameras.lprSetup * addOns.lprCameras.qty,
      recurring: false,
      editable: true,
    });
    items.push({
      id: makeId(),
      description: 'LPR Camera Monitoring & Analytics',
      qty: addOns.lprCameras.qty,
      unitPrice: PRICING.cameras.lprMonthly,
      total: PRICING.cameras.lprMonthly * addOns.lprCameras.qty,
      recurring: true,
      period: 'monthly',
      editable: true,
    });
  }

  if (addOns.gateMaintenance) {
    items.push({
      id: makeId(),
      description: 'Physical Gate Maintenance & Repair Service',
      qty: 1,
      unitPrice: PRICING.addOns.gateMaintenanceMonthly,
      total: PRICING.addOns.gateMaintenanceMonthly,
      recurring: true,
      period: 'monthly',
      editable: true,
    });
  }

  if (addOns.equipmentReplacement) {
    items.push({
      id: makeId(),
      description: 'Missing / Damaged Equipment Replacement Allowance',
      qty: 1,
      unitPrice: PRICING.addOns.equipmentReplacement,
      total: PRICING.addOns.equipmentReplacement,
      recurring: false,
      billing: 'billable',
      editable: true,
    });
  }

  return items;
}

export function calculateTotals(lineItems: QuoteLineItem[], property: QuoteProperty): QuoteTotals {
  const setupTotal = lineItems
    .filter(i => !i.recurring)
    .reduce((sum, i) => sum + i.total, 0);

  const monthlyTotal = lineItems
    .filter(i => i.recurring)
    .reduce((sum, i) => sum + i.total, 0);

  const contractMonths = PRICING.contract.months;
  const yearOneTotal = setupTotal + (monthlyTotal * 12);
  const contractValue = setupTotal + (monthlyTotal * contractMonths);

  const depositDue = setupTotal * PRICING.contract.depositPercent + monthlyTotal;
  const goLivePayment = setupTotal * PRICING.contract.goLivePercent + monthlyTotal;

  const units = property.units || 0;
  const dealerMRR = Math.min(units * PRICING.monthly.dealerOverrideMax, monthlyTotal * 0.25);

  return {
    setupTotal,
    monthlyTotal,
    yearOneTotal,
    contractValue,
    depositDue,
    goLivePayment,
    dealerMRR,
  };
}

export function generateQuoteNumber(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `GG-${year}-${seq}`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function getValidUntilDate(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}
