// GateGuard Quote System — Type Definitions
// Pricing sourced from GateGuard Dealer Program Reference Guide

export type QuoteStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';

export type CallboxTier = 'tier1_remove' | 'tier2_replace' | 'tier3_retain';

export type GateCondition = 'working' | 'non_working';

export interface SiteSurvey {
  // Vehicular gates
  vehicularGates: {
    condition: GateCondition;
    qty: number;
  }[];

  // Pedestrian gates / amenity doors
  amenityDoors: {
    condition: GateCondition;
    qty: number;
  }[];

  // Callboxes
  callboxes: {
    tier: CallboxTier;
    qty: number;
  }[];

  // Cameras
  cameras: {
    newCameras: number;       // new installs — free hardware, $100/mo monitoring
    existingCameras: number;  // existing retain — free setup, $85/mo monitoring
  };
}

export interface QuoteLineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  recurring: boolean;       // true = monthly recurring, false = one-time
  period?: 'monthly';
  editable?: boolean;       // allow manual override
}

export interface QuoteTotals {
  setupTotal: number;       // one-time fees
  monthlyTotal: number;     // recurring monthly
  yearOneTotal: number;     // setupTotal + (monthlyTotal * 12)
  contractValue: number;    // setupTotal + (monthlyTotal * 60) — 5-year term
  depositDue: number;       // 50% of setup + first month
  goLivePayment: number;    // remaining 50% of setup + first month
  dealerMRR: number;        // dealer override (up to $2.50/unit/month)
}

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

export interface Quote {
  id: string;
  quoteNumber: string;       // e.g. GG-2026-0042
  status: QuoteStatus;
  property: QuoteProperty;
  survey: SiteSurvey;
  lineItems: QuoteLineItem[];
  totals: QuoteTotals;
  notes?: string;
  validUntil: string;        // ISO date
  contractMonths: number;    // default 60
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  createdBy?: string;
  dealerId?: string;
}

// Pricing constants — GateGuard Dealer Program
export const PRICING = {
  monthly: {
    perUnit: 10.00,
    minimum: 1200.00,
    dealerOverrideMax: 2.50,  // per unit per month
  },
  setup: {
    workingGate: 500.00,
    nonWorkingGate: 750.00,
    workingDoor: 500.00,
    nonWorkingDoor: 750.00,
    newCallbox: 2500.00,
  },
  cameras: {
    newCameraSetup: 0.00,          // free with contract
    newCameraMonthly: 100.00,      // per camera per month
    existingCameraSetup: 0.00,     // free monitoring onboard
    existingCameraMonthly: 85.00,  // per camera per month
  },
  contract: {
    months: 60,
    depositPercent: 0.50,   // 50% at signing
    goLivePercent: 0.50,    // 50% + first month at go-live
  },
  earlyTermination: {
    year1: 0.30,
    year2: 0.20,
    year3: 0.10,
    year4plus: 0.00,
  },
} as const;
