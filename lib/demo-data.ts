/**
 * GateGuard Nexus — Demo Data
 * Single source of truth for all synthetic demo datasets.
 * Used by: /directv (ATLAS dashboard), /migrate (SARA Bridge), /dashboard KPIs
 * DO NOT reference SARA Plus data anywhere except /migrate.
 */

// ─── DIRECTV / ATLAS DEALERS ──────────────────────────────────────────────────
export type DtvDealer = {
  id: string;
  name: string;
  city: string;
  state: string;
  status: "elite" | "active" | "watch";
  activations_mtd: number;
  activations_ytd: number;
  ars_pct: number;
  abp_pct: number;
  commission_mtd: number;
  joined: string;
};

export const DTV_DEALERS: DtvDealer[] = [
  { id: "D001", name: "Gate Guard, LLC",            city: "Atlanta",        state: "GA", status: "elite",  activations_mtd: 47,  activations_ytd: 412,  ars_pct: 91.4, abp_pct: 78.2, commission_mtd: 31420, joined: "2022-03" },
  { id: "D002", name: "Premier Satellite Services", city: "Marietta",       state: "GA", status: "elite",  activations_mtd: 38,  activations_ytd: 344,  ars_pct: 89.1, abp_pct: 76.5, commission_mtd: 25660, joined: "2022-06" },
  { id: "D003", name: "SouthStar Communications",   city: "Alpharetta",     state: "GA", status: "elite",  activations_mtd: 41,  activations_ytd: 388,  ars_pct: 92.0, abp_pct: 80.1, commission_mtd: 28740, joined: "2021-11" },
  { id: "D004", name: "Horizon Direct Solutions",   city: "Kennesaw",       state: "GA", status: "active", activations_mtd: 29,  activations_ytd: 267,  ars_pct: 85.6, abp_pct: 71.3, commission_mtd: 18900, joined: "2023-01" },
  { id: "D005", name: "Pinnacle TV & Access",       city: "Smyrna",         state: "GA", status: "active", activations_mtd: 24,  activations_ytd: 218,  ars_pct: 83.2, abp_pct: 69.8, commission_mtd: 15480, joined: "2023-04" },
  { id: "D006", name: "BlueSky Telecom Group",      city: "Roswell",        state: "GA", status: "active", activations_mtd: 31,  activations_ytd: 291,  ars_pct: 87.4, abp_pct: 74.0, commission_mtd: 21300, joined: "2022-09" },
  { id: "D007", name: "Metro Access & TV",          city: "Sandy Springs",  state: "GA", status: "active", activations_mtd: 19,  activations_ytd: 174,  ars_pct: 81.0, abp_pct: 67.2, commission_mtd: 12100, joined: "2023-07" },
  { id: "D008", name: "Cardinal Satellite",         city: "Duluth",         state: "GA", status: "watch",  activations_mtd: 11,  activations_ytd:  98,  ars_pct: 74.3, abp_pct: 58.4, commission_mtd:  6820, joined: "2023-10" },
  { id: "D009", name: "Peach State Direct",         city: "Lawrenceville",  state: "GA", status: "active", activations_mtd: 26,  activations_ytd: 241,  ars_pct: 86.8, abp_pct: 72.9, commission_mtd: 17440, joined: "2022-12" },
  { id: "D010", name: "Lakeside Signal Group",      city: "Decatur",        state: "GA", status: "active", activations_mtd: 22,  activations_ytd: 204,  ars_pct: 84.1, abp_pct: 70.5, commission_mtd: 14520, joined: "2023-02" },
  { id: "D011", name: "Georgia Connect Pro",        city: "College Park",   state: "GA", status: "watch",  activations_mtd:  9,  activations_ytd:  82,  ars_pct: 71.6, abp_pct: 55.0, commission_mtd:  5540, joined: "2024-01" },
  { id: "D012", name: "Magnolia Direct Services",   city: "Macon",          state: "GA", status: "active", activations_mtd: 18,  activations_ytd: 163,  ars_pct: 82.4, abp_pct: 68.7, commission_mtd: 11820, joined: "2023-05" },
];

// ─── DIRECTV ACTIVATIONS ─────────────────────────────────────────────────────
export type DtvActivation = {
  id: string;
  date: string;
  customer: string;
  address: string;
  city: string;
  state: string;
  package: string;
  install_type: "SELF" | "COMBINED" | "SPLIT";
  credit_tier: "LOW" | "MEDIUM" | "HIGH";
  dealer_id: string;
  dealer_name: string;
  ars: boolean;
  abp: boolean;
  commission: number;
};

export const DTV_ACTIVATIONS: DtvActivation[] = [
  { id: "ACT-2841", date: "2026-05-04", customer: "Marcus Williams",    address: "2847 Cascade Rd SW",       city: "Atlanta",       state: "GA", package: "CHOICE",     install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D001", dealer_name: "Gate Guard, LLC",            ars: true,  abp: true,  commission: 840 },
  { id: "ACT-2840", date: "2026-05-04", customer: "Jennifer Torres",    address: "1422 Peachtree St NE",     city: "Atlanta",       state: "GA", package: "CHOICE+",    install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D001", dealer_name: "Gate Guard, LLC",            ars: true,  abp: true,  commission: 920 },
  { id: "ACT-2839", date: "2026-05-03", customer: "Robert Kim",         address: "4912 Tilly Mill Rd",       city: "Dunwoody",      state: "GA", package: "ULTIMATE",   install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D003", dealer_name: "SouthStar Communications",   ars: true,  abp: true,  commission: 1080 },
  { id: "ACT-2838", date: "2026-05-03", customer: "Patricia Johnson",   address: "834 N Marietta Pkwy NW",   city: "Marietta",      state: "GA", package: "CHOICE",     install_type: "SELF",     credit_tier: "MEDIUM", dealer_id: "D002", dealer_name: "Premier Satellite Services", ars: true,  abp: false, commission: 680 },
  { id: "ACT-2837", date: "2026-05-02", customer: "David Chen",         address: "2203 Holcomb Bridge Rd",   city: "Roswell",       state: "GA", package: "CHOICE+",    install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D006", dealer_name: "BlueSky Telecom Group",      ars: true,  abp: true,  commission: 860 },
  { id: "ACT-2836", date: "2026-05-02", customer: "Sandra Mitchell",    address: "715 Shallowford Rd NE",    city: "Kennesaw",      state: "GA", package: "SELECT",     install_type: "SPLIT",    credit_tier: "HIGH",   dealer_id: "D004", dealer_name: "Horizon Direct Solutions",   ars: false, abp: false, commission: 420 },
  { id: "ACT-2835", date: "2026-05-01", customer: "Thomas Brooks",      address: "5544 Peachtree Dunwoody",  city: "Sandy Springs", state: "GA", package: "ULTIMATE",   install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D001", dealer_name: "Gate Guard, LLC",            ars: true,  abp: true,  commission: 1120 },
  { id: "ACT-2834", date: "2026-05-01", customer: "Lisa Nguyen",        address: "1108 Old Alabama Rd",      city: "Alpharetta",    state: "GA", package: "CHOICE",     install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D003", dealer_name: "SouthStar Communications",   ars: true,  abp: true,  commission: 800 },
  { id: "ACT-2833", date: "2026-04-30", customer: "James Patel",        address: "3321 Buford Hwy NE",       city: "Duluth",        state: "GA", package: "CHOICE+",    install_type: "SELF",     credit_tier: "MEDIUM", dealer_id: "D009", dealer_name: "Peach State Direct",         ars: true,  abp: false, commission: 640 },
  { id: "ACT-2832", date: "2026-04-30", customer: "Angela Davis",       address: "420 Grayson Pkwy",         city: "Lawrenceville", state: "GA", package: "SELECT",     install_type: "COMBINED", credit_tier: "MEDIUM", dealer_id: "D009", dealer_name: "Peach State Direct",         ars: true,  abp: true,  commission: 580 },
  { id: "ACT-2831", date: "2026-04-29", customer: "Michael Turner",     address: "682 Windy Hill Rd SE",     city: "Smyrna",        state: "GA", package: "CHOICE",     install_type: "COMBINED", credit_tier: "LOW",    dealer_id: "D005", dealer_name: "Pinnacle TV & Access",       ars: true,  abp: true,  commission: 780 },
  { id: "ACT-2830", date: "2026-04-29", customer: "Rebecca Flores",     address: "9043 Already Rd",          city: "College Park",  state: "GA", package: "SELECT",     install_type: "SPLIT",    credit_tier: "HIGH",   dealer_id: "D011", dealer_name: "Georgia Connect Pro",        ars: false, abp: false, commission: 380 },
];

// ─── COMMISSION SUMMARY ───────────────────────────────────────────────────────
export const DTV_COMMISSION_SUMMARY = {
  activations_commission: 94200,
  abp_bonus:              12800,
  ars_bonus:               8400,
  total_payout:          115400,
  prior_month_total:     108900,
  pct_change:              5.97,
};

// ─── ATLAS DASHBOARD KPIS ─────────────────────────────────────────────────────
export const ATLAS_KPIS = {
  active_dealers:    47,
  activations_mtd:   1284,
  ars_pct:           91.4,
  ars_target:        90.0,
  abp_pct:           78.2,
  abp_target:        75.0,
  mrr:               94200,
  commission_mtd:    31420,
};

// ─── SARA BRIDGE MIGRATION COUNTS ────────────────────────────────────────────
// These match the hardcoded values in /migrate page Step 2
export const SARA_MIGRATION_COUNTS = {
  customers:    84,
  work_orders:  312,
  quotes:       147,
  commissions:  1840,
};

// ─── SARA BRIDGE: SAMPLE CUSTOMER EXPORT (simulates a SARA Plus CSV) ─────────
export type SaraCustomer = {
  customer_id: string;
  last_name: string;
  first_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  att_account: string;
  credit_tier: "LOW" | "MEDIUM" | "HIGH";
  install_type: "SELF" | "COMBINED" | "SPLIT";
  service_type: "DTV" | "IPBB" | "ATV" | "Wireless";
  install_date: string;
  rep_code: string;
  work_order_no: string;
};

// 20-record sample — full 84 reside in the simulated import
export const SARA_CUSTOMER_SAMPLE: SaraCustomer[] = [
  { customer_id: "SP-10042", last_name: "Williams",  first_name: "Marcus",    address: "2847 Cascade Rd SW",     city: "Atlanta",       state: "GA", zip: "30311", att_account: "ATT-882-441-7731", credit_tier: "LOW",    install_type: "COMBINED", service_type: "DTV",      install_date: "2024-08-12", rep_code: "REP-GG-001", work_order_no: "WO-18841" },
  { customer_id: "SP-10043", last_name: "Torres",    first_name: "Jennifer",  address: "1422 Peachtree St NE",   city: "Atlanta",       state: "GA", zip: "30309", att_account: "ATT-772-330-5514", credit_tier: "LOW",    install_type: "COMBINED", service_type: "DTV",      install_date: "2024-09-03", rep_code: "REP-GG-001", work_order_no: "WO-18842" },
  { customer_id: "SP-10044", last_name: "Kim",       first_name: "Robert",    address: "4912 Tilly Mill Rd",     city: "Dunwoody",      state: "GA", zip: "30338", att_account: "ATT-663-228-4401", credit_tier: "LOW",    install_type: "COMBINED", service_type: "IPBB",     install_date: "2024-07-21", rep_code: "REP-GG-003", work_order_no: "WO-18843" },
  { customer_id: "SP-10045", last_name: "Johnson",   first_name: "Patricia",  address: "834 N Marietta Pkwy NW", city: "Marietta",      state: "GA", zip: "30062", att_account: "ATT-554-119-3388", credit_tier: "MEDIUM", install_type: "SELF",     service_type: "DTV",      install_date: "2024-10-14", rep_code: "REP-GG-002", work_order_no: "WO-18844" },
  { customer_id: "SP-10046", last_name: "Chen",      first_name: "David",     address: "2203 Holcomb Bridge Rd", city: "Roswell",       state: "GA", zip: "30076", att_account: "ATT-445-007-2275", credit_tier: "LOW",    install_type: "COMBINED", service_type: "ATV",      install_date: "2024-11-02", rep_code: "REP-GG-006", work_order_no: "WO-18845" },
  { customer_id: "SP-10047", last_name: "Mitchell",  first_name: "Sandra",    address: "715 Shallowford Rd NE",  city: "Kennesaw",      state: "GA", zip: "30144", att_account: "ATT-336-896-1162", credit_tier: "HIGH",   install_type: "SPLIT",    service_type: "DTV",      install_date: "2024-06-30", rep_code: "REP-GG-004", work_order_no: "WO-18846" },
  { customer_id: "SP-10048", last_name: "Brooks",    first_name: "Thomas",    address: "5544 Peachtree Dunwoody",city: "Sandy Springs", state: "GA", zip: "30342", att_account: "ATT-227-785-0049", credit_tier: "LOW",    install_type: "COMBINED", service_type: "DTV",      install_date: "2024-12-08", rep_code: "REP-GG-001", work_order_no: "WO-18847" },
  { customer_id: "SP-10049", last_name: "Nguyen",    first_name: "Lisa",      address: "1108 Old Alabama Rd",    city: "Alpharetta",    state: "GA", zip: "30022", att_account: "ATT-118-674-8936", credit_tier: "LOW",    install_type: "COMBINED", service_type: "IPBB",     install_date: "2025-01-15", rep_code: "REP-GG-003", work_order_no: "WO-18848" },
  { customer_id: "SP-10050", last_name: "Patel",     first_name: "James",     address: "3321 Buford Hwy NE",     city: "Duluth",        state: "GA", zip: "30096", att_account: "ATT-009-563-7823", credit_tier: "MEDIUM", install_type: "SELF",     service_type: "Wireless", install_date: "2025-02-20", rep_code: "REP-GG-009", work_order_no: "WO-18849" },
  { customer_id: "SP-10051", last_name: "Davis",     first_name: "Angela",    address: "420 Grayson Pkwy",       city: "Lawrenceville", state: "GA", zip: "30046", att_account: "ATT-890-452-6610", credit_tier: "MEDIUM", install_type: "COMBINED", service_type: "DTV",      install_date: "2025-01-28", rep_code: "REP-GG-009", work_order_no: "WO-18850" },
  { customer_id: "SP-10052", last_name: "Turner",    first_name: "Michael",   address: "682 Windy Hill Rd SE",   city: "Smyrna",        state: "GA", zip: "30080", att_account: "ATT-781-341-5497", credit_tier: "LOW",    install_type: "COMBINED", service_type: "ATV",      install_date: "2025-03-05", rep_code: "REP-GG-005", work_order_no: "WO-18851" },
  { customer_id: "SP-10053", last_name: "Flores",    first_name: "Rebecca",   address: "9043 Already Rd",        city: "College Park",  state: "GA", zip: "30349", att_account: "ATT-672-230-4386", credit_tier: "HIGH",   install_type: "SPLIT",    service_type: "DTV",      install_date: "2024-05-11", rep_code: "REP-GG-011", work_order_no: "WO-18852" },
  { customer_id: "SP-10054", last_name: "Robinson",  first_name: "Kevin",     address: "1820 Delk Rd SE",        city: "Marietta",      state: "GA", zip: "30067", att_account: "ATT-563-119-3271", credit_tier: "LOW",    install_type: "COMBINED", service_type: "DTV",      install_date: "2025-03-19", rep_code: "REP-GG-002", work_order_no: "WO-18853" },
  { customer_id: "SP-10055", last_name: "Lewis",     first_name: "Carol",     address: "4401 Flat Shoals Pkwy",  city: "Decatur",       state: "GA", zip: "30034", att_account: "ATT-454-008-2158", credit_tier: "MEDIUM", install_type: "COMBINED", service_type: "IPBB",     install_date: "2025-04-01", rep_code: "REP-GG-010", work_order_no: "WO-18854" },
  { customer_id: "SP-10056", last_name: "Walker",    first_name: "George",    address: "7703 Spalding Dr",       city: "Norcross",      state: "GA", zip: "30092", att_account: "ATT-345-897-1044", credit_tier: "LOW",    install_type: "COMBINED", service_type: "DTV",      install_date: "2025-04-14", rep_code: "REP-GG-006", work_order_no: "WO-18855" },
  { customer_id: "SP-10057", last_name: "Hall",      first_name: "Denise",    address: "310 N Atlanta St",       city: "Roswell",       state: "GA", zip: "30075", att_account: "ATT-236-786-0931", credit_tier: "LOW",    install_type: "COMBINED", service_type: "ATV",      install_date: "2025-04-22", rep_code: "REP-GG-006", work_order_no: "WO-18856" },
  { customer_id: "SP-10058", last_name: "Allen",     first_name: "Brian",     address: "618 Church St",          city: "Marietta",      state: "GA", zip: "30060", att_account: "ATT-127-675-9820", credit_tier: "MEDIUM", install_type: "SELF",     service_type: "DTV",      install_date: "2025-04-28", rep_code: "REP-GG-002", work_order_no: "WO-18857" },
  { customer_id: "SP-10059", last_name: "Young",     first_name: "Theresa",   address: "2240 Mt Paran Rd NW",    city: "Atlanta",       state: "GA", zip: "30327", att_account: "ATT-018-564-8717", credit_tier: "LOW",    install_type: "COMBINED", service_type: "DTV",      install_date: "2025-05-01", rep_code: "REP-GG-001", work_order_no: "WO-18858" },
  { customer_id: "SP-10060", last_name: "Hernandez", first_name: "Carlos",    address: "881 Piedmont Ave NE",    city: "Atlanta",       state: "GA", zip: "30308", att_account: "ATT-909-453-7604", credit_tier: "LOW",    install_type: "COMBINED", service_type: "IPBB",     install_date: "2025-05-02", rep_code: "REP-GG-001", work_order_no: "WO-18859" },
  { customer_id: "SP-10061", last_name: "Scott",     first_name: "Amanda",    address: "5101 Lavista Rd",        city: "Tucker",        state: "GA", zip: "30084", att_account: "ATT-800-342-6493", credit_tier: "MEDIUM", install_type: "COMBINED", service_type: "DTV",      install_date: "2025-05-04", rep_code: "REP-GG-010", work_order_no: "WO-18860" },
];

// ─── SARA BRIDGE FIELD MAP ─────────────────────────────────────────────────────
export const SARA_FIELD_MAP = [
  { sara_field: "customer_id",    nexus_field: "org_id",          status: "mapped"   as const, note: "Auto-prefix NX-" },
  { sara_field: "work_order_no",  nexus_field: "maintenance_id",  status: "mapped"   as const, note: "Direct map"      },
  { sara_field: "rep_code",       nexus_field: "rep_id",          status: "mapped"   as const, note: "Lookup by code"  },
  { sara_field: "install_date",   nexus_field: "scheduled_date",  status: "mapped"   as const, note: "Date preserved"  },
  { sara_field: "att_account",    nexus_field: "external_ref",    status: "mapped"   as const, note: "Stored as ref"   },
  { sara_field: "credit_tier",    nexus_field: "billing_tier",    status: "partial"  as const, note: "Needs review"    },
  { sara_field: "install_type",   nexus_field: "service_type",    status: "mapped"   as const, note: "Enum mapped"     },
  { sara_field: "service_type",   nexus_field: "package_type",    status: "mapped"   as const, note: "Direct map"      },
  { sara_field: "pay_period",     nexus_field: "commission_period",status: "mapped"  as const, note: "Date formatted"  },
  { sara_field: "reconcile_amt",  nexus_field: "commission_amount",status: "mapped"  as const, note: "USD preserved"   },
  { sara_field: "rep_name",       nexus_field: "rep_display_name", status: "partial" as const, note: "Manual confirm"  },
  { sara_field: "quote_id",       nexus_field: "quote_id",         status: "mapped"  as const, note: "Direct map"      },
];
