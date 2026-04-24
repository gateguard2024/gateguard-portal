// GateGuard Quote System — Type Definitions
// Pricing sourced from GateGuard Dealer Program Reference Guide

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export type AccessTier = 'tier1_mobile' | 'tier2_ubiquity';

export type GateCondition = 'working' | 'non_working';

export type BillingMode = 'included' | 'billable';

// ── Kept for backwards compatibility ─────────────────────────────────────────
export type CallboxTier = 'tier1_remove' | 'tier2_replace' | 'tier3_retain';

// ── Network / Backhaul ────────────────────────────────────────────────────────
export interface NetworkSurvey {
  backhaul: {
    needed: boolean;
    qty: number;
    billing: BillingMode;
  };
  radioLinks: {
    needed: boolean;
    qty: number;
    billing: BillingMode;
  };
}

// ── Access Control — Tier 1 (Mobile Pass Only) ────────────────────────────────
// Primary doors:  controller + reader  (residents tap in)
// Secondary doors: controller only    (amenity doors without reader)
// Guest gates:    controller only     (app-controlled, no reader needed)
// Resident gates: reader only         (exit / read-only gate)
// Callbox:        optional video callbox at entry
export interface Tier1AccessSurvey {
  primaryDoors: { qty: number; condition: GateCondition };
  secondaryDoors: { qty: number; condition: GateCondition };
  guestGates: { qty: number; condition: GateCondition };
  residentGates: { qty: number; condition: GateCondition };
  callbox: boolean;
}

// ── Access Control — Tier 2 (Ubiquity/Unifi) ─────────────────────────────────
// Every access point gets a reader + controller via Unifi stack
export interface Tier2AccessSurvey {
  accessPoints: { qty: number; condition: GateCondition };
  callbox: boolean;
}

// ── Cameras ───────────────────────────────────────────────────────────────────
export interface CameraSurvey {
  existing: {
    monitored: number;   // reprogramming included — charged via monitoring MRR
    standalone: number;  // reprogramming billed as one-time labor
  };
  new: {
    monitored: number;   // hardware free with contract — charged via monitoring MRR
    standalone: number;  // full installation labor + hardware billable
  };
}

// ── Optional Add-Ons ──────────────────────────────────────────────────────────
export interface AddOnsSurvey {
  lprCameras: { qty: number };
  gateMaintenance: boolean;         // ongoing monthly service
  equipmentReplacement: boolean;    // line item for missing/damaged parts
}

// ── Composite Site Survey ──────────────────────────────────────────────────────
export interface SiteSurvey {
  accessTier: AccessTier;
  network: NetworkSurvey;
  tier1: Tier1AccessSurvey;         // used when accessTier === 'tier1_mobile'
  tier2: Tier2AccessSurvey;         // used when accessTier === 'tier2_ubiquity'
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
  recurring: boolean;       // true = monthly recurring, false = one-time
  period?: 'monthly';
  billing?: BillingMode;    // 'included' | 'billable' (for network/camera items)
  editable?: boolean;
}

export interface QuoteTotals {
  setupTotal: number;
  monthlyTotal: number;
  yearOneTotal: number;
  contractValue: number;
  depositDue: number;
  goLivePayment: number;
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

  // Access Control — Tier 1 (Mobile Pass)
  tier1: {
    primaryDoor: {
      working: 500.00,        // controller + reader, working hardware
      nonWorking: 750.00,     // controller + reader, new hardware
    },
    secondaryDoor: {
      working: 350.00,        // controller only, working hardware
      nonWorking: 500.00,     // controller only, new hardware
    },
    guestGate: {
      working: 350.00,        // controller only (app), working
      nonWorking: 500.00,     // controller only (app), new
    },
    residentGate: {
      working: 200.00,        // reader only, working hardware
      nonWorking: 350.00,     // reader only, new hardware
    },
    callbox: 2500.00,         // Unifi / GateGuard video callbox
  },

  // Access Control — Tier 2 (Ubiquity/Unifi — every point gets reader)
  tier2: {
    accessPoint: {
      working: 500.00,        // full reader + controller, working
      nonWorking: 750.00,     // full reader + controller, new hardware
    },
    callbox: 2500.00,
  },

  // Network Infrastructure
  network: {
    backhaulSetup: 500.00,    // per backhaul run — billable or included
    radioLinkSetup: 750.00,   // per radio link bridge — billable or included
    backhaulMonthly: 0.00,    // recurring (typically included in MRR)
  },

  // Cameras
  cameras: {
    // Monitored new cameras — hardware free with contract
    newMonitoredSetup: 0.00,
    newMonitoredMonthly: 100.00,
    // Standalone new cameras — billable install + no MRR
    newStandaloneSetup: 350.00,
    newStandaloneMonthly: 0.00,
    // Existing monitored — reprogramming included
    existingMonitoredSetup: 0.00,
    existingMonitoredMonthly: 85.00,
    // Existing standalone — reprogramming billable, no MRR
    existingStandaloneSetup: 150.00,
    existingStandaloneMonthly: 0.00,
    // LPR cameras
    lprSetup: 1500.00,
    lprMonthly: 150.00,
  },

  // Add-ons
  addOns: {
    gateMaintenanceMonthly: 250.00,   // physical gate maintenance & repair
    equipmentReplacement: 500.00,     // budgeted allowance for missing equipment
  },

  contract: {
    months: 60,
    depositPercent: 0.50,
    goLivePercent: 0.50,
  },

  earlyTermination: {
    year1: 0.30,
    year2: 0.20,
    year3: 0.10,
    year4plus: 0.00,
  },
} as const;
