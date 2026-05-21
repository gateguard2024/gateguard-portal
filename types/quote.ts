// GateGuard Quote System — Type Definitions
// Pricing sourced from GateGuard Dealer Program Reference Guide

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export type AccessTier = 'tier1_mobile' | 'tier2_gg';

export type GateCondition = 'working' | 'non_working';

export type BillingMode = 'included' | 'billable';

// ── Access Control — Tier 1 (Mobile Pass Only) ────────────────────────────────
// Sites can have a mix of working and non-working hardware at each point type
export interface Tier1AccessSurvey {
  primaryDoors:   { working: number; nonWorking: number }; // controller + reader
  secondaryDoors: { working: number; nonWorking: number }; // controller only
  guestGates:     { working: number; nonWorking: number }; // app-only controller
  residentGates:  { working: number; nonWorking: number }; // reader only
  callbox: boolean;
}

// ── Access Control — Tier 2 (GateGuard Integrated) ───────────────────────────
// Every access point gets a full reader + controller (same 4 categories as Tier 1)
export interface Tier2AccessSurvey {
  residentGates:  { working: number; nonWorking: number };
  guestGates:     { working: number; nonWorking: number };
  primaryDoors:   { working: number; nonWorking: number };
  secondaryDoors: { working: number; nonWorking: number };
  callbox: boolean;
}

// ── Network Infrastructure ────────────────────────────────────────────────────
export interface NetworkItem {
  qty: number;
  billing: BillingMode;
}

export interface NetworkSurvey {
  router:      NetworkItem;   // always at least 1
  switch4port: NetworkItem;   // 4-port PoE switch
  switch8port: NetworkItem;   // 8-port PoE switch
  switch16port: NetworkItem;  // 16-port PoE switch
  radioSmall:  NetworkItem;   // small PTP radio
  radioMedium: NetworkItem;   // medium PTP radio
  radioLarge:  NetworkItem;   // large PTP radio
  enclosure:   NetworkItem;   // weatherproof enclosure
}

// ── Cameras ───────────────────────────────────────────────────────────────────
export interface CameraSurvey {
  existing: {
    monitored: number;   // reprogramming included — $85/mo monitoring
    standalone: number;  // reprogramming billable — $150 labor, no MRR
  };
  new: {
    // billing='included': hardware free with contract, $100/mo monitoring
    // billing='billable':  hardware billed $350/unit, $85/mo monitoring
    monitored: { qty: number; billing: BillingMode };
    standalone: number;  // full install billable $350, no monitoring MRR
  };
}

// ── Gate Operator Service Plan ────────────────────────────────────────────────
// INCLUDED in the GateGuard base plan — operators, wiring & control equipment only.
// This is NOT optional and does NOT add to the invoice total.
// The physical iron/steel gate structure is NOT covered here.
// Physical gate coverage is a SEPARATE optional add-on at $250/gate/month.
export interface GateMaintenanceSurvey {
  enabled: boolean;                   // always true; kept for backwards compat
  initialRepairCost: number;          // one-time pre-service repair (if gates need work first)
  initialRepairBilling: BillingMode;  // whether that one-time cost is billable or included
  entryGates: number;                 // number of entry gates at this property
}

// ── Physical Gate Structure Coverage (separate add-on) ────────────────────────
// Covers the physical steel gate panel, tracks, hinges, rollers, and structural components.
// $250/gate/month per entry gate.
export interface PhysicalGateCoverageSurvey {
  enabled: boolean;
  entryGates: number;
}

// ── Custom / Missing Equipment Items ─────────────────────────────────────────
export interface CustomSurveyItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  billing: BillingMode;
}

// ── Optional Add-Ons ──────────────────────────────────────────────────────────
export interface AddOnsSurvey {
  lprCameras: { qty: number };        // always billable install + required MRR
  gateMaintenance: GateMaintenanceSurvey;
  physicalGateCoverage: PhysicalGateCoverageSurvey; // steel gate structure — separate from operator plan
  customItems: CustomSurveyItem[];    // agent-entered custom line items
}

// ── Composite Site Survey ──────────────────────────────────────────────────────
export interface SiteSurvey {
  accessTier: AccessTier;
  network: NetworkSurvey;
  tier1: Tier1AccessSurvey;
  tier2: Tier2AccessSurvey;
  cameras: CameraSurvey;
  addOns: AddOnsSurvey;
}

// ── Line Item & Totals ─────────────────────────────────────────────────────────
export interface QuoteLineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  recurring: boolean;
  period?: 'monthly';
  billing?: BillingMode;
  editable?: boolean;
}

export interface QuoteTotals {
  setupTotal: number;              // all one-time items (for display)
  billableSetupTotal: number;      // one-time billable items only (before discount)
  discountedSetupTotal: number;    // billableSetupTotal after discount (drives deposit)
  discountSavings: number;         // dollar amount saved by discount
  monthlyTotal: number;            // after mrr discount
  mrrDiscountSavings: number;      // mrr discount dollar amount (0 if none)
  yearOneTotal: number;
  contractValue: number;
  depositDue: number;              // discountedSetup × 50% + 1st month
  goLivePayment: number;           // discountedSetup × 50% + 1st month (at launch)
  dealerMRR: number;
}

// ── Property ──────────────────────────────────────────────────────────────────
export interface QuoteProperty {
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  units: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  propertyManager?: string;
  managementCompany?: string;
}

// ── Full Quote ─────────────────────────────────────────────────────────────────
export interface Quote {
  id: string;
  quoteNumber: string;
  status: QuoteStatus;
  property: QuoteProperty;
  survey: SiteSurvey;
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
  notes?: string;
  validUntil: string;
  contractMonths: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  createdBy?: string;
  dealerId?: string;
}

// ── Pricing Constants ─────────────────────────────────────────────────────────
export const PRICING = {
  monthly: {
    perUnit: 10.00,
    minimum: 1200.00,
    dealerOverrideMax: 2.50,
  },

  // Tier 1 (Mobile Pass) — per entry point, uniform rate regardless of hardware type
  // $500 working / $750 non-working per opening (same as Tier 2)
  tier1: {
    primaryDoor:   { working: 500.00,  nonWorking: 750.00  },  // controller + reader
    secondaryDoor: { working: 500.00,  nonWorking: 750.00  },  // controller only
    guestGate:     { working: 500.00,  nonWorking: 750.00  },  // app-only controller
    residentGate:  { working: 500.00,  nonWorking: 750.00  },  // reader
    callbox: 2500.00,
  },

  // Tier 2 (GateGuard Integrated) — every point gets full reader + controller (same pricing as Tier 1)
  tier2: {
    residentGate:  { working: 500.00, nonWorking: 750.00 },
    guestGate:     { working: 500.00, nonWorking: 750.00 },
    primaryDoor:   { working: 500.00, nonWorking: 750.00 },
    secondaryDoor: { working: 500.00, nonWorking: 750.00 },
    callbox: 2500.00,
  },

  // Network Infrastructure — one-time setup, included or billable
  network: {
    router:       350.00,
    switch4port:  200.00,
    switch8port:  350.00,
    switch16port: 600.00,
    radioSmall:   500.00,
    radioMedium:  800.00,
    radioLarge:   1200.00,
    enclosure:    250.00,
  },

  // Cameras
  cameras: {
    // New cameras — monitored (billing=included): hardware free, $100/mo
    newMonitoredIncludedSetup:   0.00,
    newMonitoredIncludedMonthly: 100.00,
    // New cameras — monitored (billing=billable): hardware billed, $85/mo
    newMonitoredBillableSetup:   350.00,
    newMonitoredBillableMonthly: 85.00,
    // New cameras — standalone (always billable): full install, no MRR
    newStandaloneSetup:          350.00,
    // Existing cameras — monitored: reprogramming included, $85/mo
    existingMonitoredSetup:      0.00,
    existingMonitoredMonthly:    85.00,
    // Existing cameras — standalone: reprogramming billable, no MRR
    existingStandaloneSetup:     150.00,
    // LPR cameras — always billable install + required MRR
    lprSetup:                    1500.00,
    lprMonthly:                  150.00,
  },

  // Add-ons
  addOns: {
    gateMaintenancePerGate: 250.00,   // per entry gate per month (up to 2 leafs)
  },

  contract: {
    months: 60,
    depositPercent: 0.50,   // % of billable setup at signing
    goLivePercent:  0.50,   // % of billable setup at launch event
  },

  earlyTermination: {
    year1: 0.30,
    year2: 0.20,
    year3: 0.10,
    year4plus: 0.00,
  },
} as const;
