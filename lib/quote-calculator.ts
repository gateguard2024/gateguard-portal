// GateGuard Quote Calculator
// Auto-generates line items and totals from site survey inputs

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

  // ── Vehicular Gate Setup Fees ──────────────────────────────────────────────
  for (const gate of survey.vehicularGates) {
    if (gate.qty <= 0) continue;
    const price = gate.condition === 'working'
      ? PRICING.setup.workingGate
      : PRICING.setup.nonWorkingGate;
    const label = gate.condition === 'working' ? 'Working' : 'Non-Working';
    items.push({
      id: makeId(),
      description: `${label} Vehicular Gate — Setup Fee`,
      qty: gate.qty,
      unitPrice: price,
      total: price * gate.qty,
      recurring: false,
      editable: true,
    });
  }

  // ── Amenity Door / Pedestrian Gate Setup Fees ─────────────────────────────
  for (const door of survey.amenityDoors) {
    if (door.qty <= 0) continue;
    const price = door.condition === 'working'
      ? PRICING.setup.workingDoor
      : PRICING.setup.nonWorkingDoor;
    const label = door.condition === 'working' ? 'Working' : 'Non-Working';
    items.push({
      id: makeId(),
      description: `${label} Pedestrian Gate / Amenity Door — Setup Fee`,
      qty: door.qty,
      unitPrice: price,
      total: price * door.qty,
      recurring: false,
      editable: true,
    });
  }

  // ── Callbox Installation ───────────────────────────────────────────────────
  for (const cb of survey.callboxes) {
    if (cb.qty <= 0) continue;
    if (cb.tier === 'tier2_replace') {
      items.push({
        id: makeId(),
        description: 'Callbox Installation — Unifi Gate Access (replaces existing)',
        qty: cb.qty,
        unitPrice: PRICING.setup.newCallbox,
        total: PRICING.setup.newCallbox * cb.qty,
        recurring: false,
        editable: true,
      });
    } else if (cb.tier === 'tier1_remove') {
      items.push({
        id: makeId(),
        description: 'Callbox Removal & GateGuard QR Sign Installation',
        qty: cb.qty,
        unitPrice: 0,
        total: 0,
        recurring: false,
        editable: true,
      });
    }
    // tier3_retain = no charge, excluded from scope
  }

  // ── Camera Setup + Monitoring ──────────────────────────────────────────────
  const { newCameras, existingCameras } = survey.cameras;

  if (newCameras > 0) {
    items.push({
      id: makeId(),
      description: 'New Camera Installation (included with service contract)',
      qty: newCameras,
      unitPrice: PRICING.cameras.newCameraSetup,
      total: 0,
      recurring: false,
      editable: false,
    });
    items.push({
      id: makeId(),
      description: 'Camera Cloud Monitoring — New Cameras',
      qty: newCameras,
      unitPrice: PRICING.cameras.newCameraMonthly,
      total: PRICING.cameras.newCameraMonthly * newCameras,
      recurring: true,
      period: 'monthly',
      editable: true,
    });
  }

  if (existingCameras > 0) {
    items.push({
      id: makeId(),
      description: 'Camera Cloud Monitoring — Existing Cameras (monitoring only)',
      qty: existingCameras,
      unitPrice: PRICING.cameras.existingCameraMonthly,
      total: PRICING.cameras.existingCameraMonthly * existingCameras,
      recurring: true,
      period: 'monthly',
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

  // Payment schedule
  const depositDue = setupTotal * PRICING.contract.depositPercent + monthlyTotal;
  const goLivePayment = setupTotal * PRICING.contract.goLivePercent + monthlyTotal;

  // Dealer MRR override (up to $2.50/unit/month)
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
