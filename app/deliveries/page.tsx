"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Download,
  Key,
  Bell,
  Camera,
  Package,
  X,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  Filter,
  Search,
  ChevronDown,
  RefreshCw,
  Settings,
  Wifi,
  Check,
  RotateCcw,
  FileText,
  BarChart3,
  Archive,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type DeliveryStatus = "Awaiting Pickup" | "Picked Up" | "Access Granted" | "Delivered" | "Overdue";
type CarrierKey = "AMZ" | "UPS" | "FED" | "USP" | "UBR" | "DDR" | "INS";

interface LiveEvent {
  id: string;
  carrier: CarrierKey;
  carrierName: string;
  service: string;
  property: string;
  unit: string;
  eventType: string;
  timeAgo: string;
  status: DeliveryStatus;
  overdue?: boolean;
}

interface PropertySummary {
  name: string;
  deliveries: number;
  inLocker: number;
  overdue: number;
  breakdown: { label: string; pct: number; color: string }[];
  alert?: boolean;
}

interface LockerUnit {
  id: string;
  state: "available" | "occupied" | "overdue" | "out-of-service" | "picked-up";
  carrier?: CarrierKey;
  unit?: string;
  timeDeposited?: string;
}

interface LockerActivity {
  locker: string;
  unit: string;
  carrier: string;
  deposited: string;
  status: string;
  notified: number;
}

interface CarrierProgram {
  name: string;
  status: "connected" | "pending" | "not-connected";
  description: string;
  meta?: string;
  stats?: string;
  action: string;
}

interface AccessLogRow {
  time: string;
  carrier: string;
  driverId: string;
  property: string;
  method: string;
  duration: string;
}

interface HistoryRow {
  dateTime: string;
  property: string;
  unit: string;
  carrier: string;
  type: string;
  method: string;
  status: string;
  notified: string;
  pickupTime: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const LIVE_EVENTS: LiveEvent[] = [
  { id: "e01", carrier: "AMZ", carrierName: "Amazon Prime",    service: "Amazon Prime",      property: "Stonegate Townhomes", unit: "Unit 204",      eventType: "Delivered to Locker B-3",        timeAgo: "2 min ago",   status: "Awaiting Pickup" },
  { id: "e02", carrier: "UPS", carrierName: "UPS",             service: "UPS Ground",        property: "Ashford Glen",        unit: "Unit 112",      eventType: "Door Drop",                      timeAgo: "8 min ago",   status: "Awaiting Pickup" },
  { id: "e03", carrier: "AMZ", carrierName: "Amazon Key",      service: "Amazon Key",        property: "Maple Ridge HOA",     unit: "Building Entry", eventType: "Access Granted (gate opened)",   timeAgo: "12 min ago",  status: "Access Granted" },
  { id: "e04", carrier: "DDR", carrierName: "DoorDash",        service: "DoorDash",          property: "Stonegate Townhomes", unit: "Unit 308",      eventType: "Guest Access Code Used",         timeAgo: "18 min ago",  status: "Delivered" },
  { id: "e05", carrier: "FED", carrierName: "FedEx",           service: "FedEx Express",     property: "Harbor View Apts",    unit: "Unit 501",      eventType: "Delivered to Locker C-1",        timeAgo: "24 min ago",  status: "Picked Up" },
  { id: "e06", carrier: "USP", carrierName: "USPS",            service: "USPS",              property: "Ashford Glen",        unit: "Unit 215",      eventType: "Delivered to Locker A-7",        timeAgo: "31 min ago",  status: "Awaiting Pickup" },
  { id: "e07", carrier: "INS", carrierName: "Instacart",       service: "Instacart",         property: "Maple Ridge HOA",     unit: "Unit 104",      eventType: "Guest Access Code Used",         timeAgo: "45 min ago",  status: "Delivered" },
  { id: "e08", carrier: "AMZ", carrierName: "Amazon Prime",    service: "Amazon Prime",      property: "Camden Crossing",     unit: "Unit 402",      eventType: "Delivered to Locker D-2",        timeAgo: "52 min ago",  status: "Awaiting Pickup" },
  { id: "e09", carrier: "UBR", carrierName: "Uber Eats",       service: "Uber Eats",         property: "Stonegate Townhomes", unit: "Unit 116",      eventType: "Guest Access Code Used",         timeAgo: "1h ago",      status: "Delivered" },
  { id: "e10", carrier: "UPS", carrierName: "UPS",             service: "UPS Ground",        property: "Harbor View Apts",    unit: "Unit 303",      eventType: "Door Drop",                      timeAgo: "1h 15m ago",  status: "Awaiting Pickup" },
  { id: "e11", carrier: "AMZ", carrierName: "Amazon Prime",    service: "Amazon Prime",      property: "Northgate Plaza",     unit: "Suite 200",     eventType: "Delivered to Locker A-1",        timeAgo: "1h 30m ago",  status: "Picked Up" },
  { id: "e12", carrier: "FED", carrierName: "FedEx",           service: "FedEx Ground",      property: "Stonegate Townhomes", unit: "Unit 412",      eventType: "Door Drop",                      timeAgo: "1h 45m ago",  status: "Awaiting Pickup" },
  { id: "e13", carrier: "USP", carrierName: "USPS",            service: "USPS Priority",     property: "Camden Crossing",     unit: "Unit 208",      eventType: "Delivered to Locker B-5",        timeAgo: "2h ago",      status: "Awaiting Pickup" },
  { id: "e14", carrier: "AMZ", carrierName: "Amazon Key",      service: "Amazon Key",        property: "Ashford Glen",        unit: "Building Entry", eventType: "Access Granted",                timeAgo: "2h 20m ago",  status: "Access Granted" },
  { id: "e15", carrier: "DDR", carrierName: "DoorDash",        service: "DoorDash",          property: "Harbor View Apts",    unit: "Unit 601",      eventType: "Guest Access Code Used",         timeAgo: "2h 35m ago",  status: "Delivered" },
  { id: "e16", carrier: "AMZ", carrierName: "Amazon Prime",    service: "Amazon Prime",      property: "Stonegate Townhomes", unit: "Unit 510",      eventType: "Delivered to Locker B-1",        timeAgo: "2h 50m ago",  status: "Picked Up" },
  { id: "e17", carrier: "INS", carrierName: "Instacart",       service: "Instacart",         property: "Northgate Plaza",     unit: "Suite 105",     eventType: "Guest Access Code Used",         timeAgo: "3h ago",      status: "Delivered" },
  { id: "e18", carrier: "UPS", carrierName: "UPS",             service: "UPS Express",       property: "Maple Ridge HOA",     unit: "Unit 210",      eventType: "Delivered to Locker A-4",        timeAgo: "3h 20m ago",  status: "Picked Up" },
  { id: "e19", carrier: "USP", carrierName: "USPS",            service: "USPS",              property: "Stonegate Townhomes", unit: "Unit 301",      eventType: "Door Drop",                      timeAgo: "3h 45m ago",  status: "Awaiting Pickup" },
  { id: "e20", carrier: "AMZ", carrierName: "Amazon Prime",    service: "Amazon Prime",      property: "Camden Crossing",     unit: "Unit 307",      eventType: "Delivered to Locker C-3",        timeAgo: "4h ago",      status: "Awaiting Pickup", overdue: true },
];

const PROPERTY_SUMMARIES: PropertySummary[] = [
  {
    name: "Stonegate Townhomes", deliveries: 14, inLocker: 5, overdue: 1,
    breakdown: [
      { label: "AMZ", pct: 57, color: "bg-orange-400" },
      { label: "UPS", pct: 14, color: "bg-yellow-700" },
      { label: "Other", pct: 29, color: "bg-slate-400" },
    ],
  },
  {
    name: "Ashford Glen", deliveries: 9, inLocker: 3, overdue: 0,
    breakdown: [
      { label: "AMZ", pct: 44, color: "bg-orange-400" },
      { label: "USPS", pct: 34, color: "bg-blue-400" },
      { label: "Other", pct: 22, color: "bg-slate-400" },
    ],
  },
  {
    name: "Harbor View Apts", deliveries: 11, inLocker: 2, overdue: 1,
    breakdown: [
      { label: "AMZ", pct: 45, color: "bg-orange-400" },
      { label: "FED", pct: 27, color: "bg-purple-500" },
      { label: "Other", pct: 28, color: "bg-slate-400" },
    ],
  },
  {
    name: "Camden Crossing", deliveries: 7, inLocker: 2, overdue: 1,
    breakdown: [
      { label: "AMZ", pct: 43, color: "bg-orange-400" },
      { label: "USPS", pct: 29, color: "bg-blue-400" },
      { label: "Other", pct: 28, color: "bg-slate-400" },
    ],
    alert: true,
  },
];

const BANK_A: LockerUnit[] = [
  { id: "A1", state: "occupied",      carrier: "AMZ", unit: "Unit 204",  timeDeposited: "2m ago" },
  { id: "A2", state: "available" },
  { id: "A3", state: "occupied",      carrier: "USP", unit: "Unit 215",  timeDeposited: "31m ago" },
  { id: "A4", state: "available" },
  { id: "A5", state: "available" },
  { id: "A6", state: "occupied",      carrier: "UPS", unit: "Unit 412",  timeDeposited: "1h 45m" },
  { id: "A7", state: "available" },
  { id: "A8", state: "available" },
];

const BANK_B: LockerUnit[] = [
  { id: "B1", state: "picked-up",     carrier: "AMZ", unit: "Unit 510",  timeDeposited: "2h 50m" },
  { id: "B2", state: "available" },
  { id: "B3", state: "overdue",       carrier: "AMZ", unit: "Unit 204",  timeDeposited: "26h ago" },
  { id: "B4", state: "available" },
  { id: "B5", state: "available" },
  { id: "B6", state: "available" },
  { id: "B7", state: "available" },
  { id: "B8", state: "out-of-service" },
];

const LOCKER_ACTIVITY: LockerActivity[] = [
  { locker: "A1", unit: "Unit 204",  carrier: "Amazon Prime",  deposited: "9:12 AM",  status: "Awaiting Pickup", notified: 1 },
  { locker: "A3", unit: "Unit 215",  carrier: "USPS",          deposited: "9:43 AM",  status: "Awaiting Pickup", notified: 1 },
  { locker: "A6", unit: "Unit 412",  carrier: "UPS Ground",    deposited: "8:29 AM",  status: "Awaiting Pickup", notified: 1 },
  { locker: "B1", unit: "Unit 510",  carrier: "Amazon Prime",  deposited: "7:24 AM",  status: "Picked Up 9:58 AM", notified: 2 },
  { locker: "B3", unit: "Unit 204",  carrier: "Amazon Prime",  deposited: "Yesterday 8:05 AM", status: "OVERDUE", notified: 4 },
  { locker: "C1", unit: "Unit 501",  carrier: "FedEx Express", deposited: "9:50 AM",  status: "Picked Up 10:14 AM", notified: 1 },
  { locker: "D2", unit: "Unit 402",  carrier: "Amazon Prime",  deposited: "9:22 AM",  status: "Awaiting Pickup", notified: 1 },
  { locker: "B5", unit: "Unit 208",  carrier: "USPS Priority", deposited: "8:14 AM",  status: "Awaiting Pickup", notified: 2 },
  { locker: "A4", unit: "Unit 210",  carrier: "UPS Express",   deposited: "6:54 AM",  status: "Picked Up 8:40 AM", notified: 1 },
  { locker: "A1", unit: "Suite 200", carrier: "Amazon Prime",  deposited: "8:44 AM",  status: "Picked Up 10:02 AM", notified: 1 },
];

const CARRIER_PROGRAMS: CarrierProgram[] = [
  {
    name: "Amazon Key for Business",
    status: "connected",
    description: "Amazon delivery drivers get one-time gate access codes. Packages tracked from van to locker.",
    stats: "14 accesses today · 0 incidents",
    action: "Manage",
  },
  {
    name: "USPS Carrier Access",
    status: "connected",
    description: "USPS mail carriers have scheduled access windows. No code required during delivery hours.",
    meta: "Schedule: Mon–Sat 9am–5pm",
    action: "Edit Schedule",
  },
  {
    name: "UPS My Choice for Business",
    status: "connected",
    description: "UPS drivers use carrier-specific access codes. Full delivery tracking via UPS API.",
    stats: "8 deliveries today",
    action: "Manage",
  },
  {
    name: "FedEx Delivery Manager",
    status: "connected",
    description: "FedEx drivers authorized via FedEx Business API. Delivery photo confirmation logged.",
    stats: "6 deliveries today",
    action: "Manage",
  },
  {
    name: "USPS Informed Delivery",
    status: "pending",
    description: "Scan incoming mail and alert residents before it arrives.",
    action: "Connect",
  },
  {
    name: "OnTrac / LSO / Regional Carriers",
    status: "not-connected",
    description: "Guest access code fallback used for unrecognized carriers.",
    action: "Configure",
  },
];

const ACCESS_LOG: AccessLogRow[] = [
  { time: "10:14 AM", carrier: "Amazon Prime",    driverId: "AMZ-8842",  property: "Stonegate Townhomes", method: "One-time Code", duration: "3m 12s" },
  { time: "10:08 AM", carrier: "UPS Ground",      driverId: "UPS-2291",  property: "Harbor View Apts",    method: "Carrier Code",  duration: "2m 48s" },
  { time: "9:55 AM",  carrier: "FedEx Express",   driverId: "FDX-6617",  property: "Ashford Glen",        method: "API Auth",      duration: "1m 55s" },
  { time: "9:43 AM",  carrier: "USPS",            driverId: "USPS-Sch",  property: "Stonegate Townhomes", method: "Schedule",      duration: "11m 02s" },
  { time: "9:22 AM",  carrier: "Amazon Prime",    driverId: "AMZ-5503",  property: "Camden Crossing",     method: "One-time Code", duration: "4m 18s" },
  { time: "9:12 AM",  carrier: "DoorDash",        driverId: "DDR-9941",  property: "Stonegate Townhomes", method: "Timed Code",    duration: "2m 07s" },
  { time: "8:50 AM",  carrier: "Instacart",       driverId: "INS-3375",  property: "Maple Ridge HOA",     method: "Timed Code",    duration: "3m 44s" },
  { time: "8:29 AM",  carrier: "UPS Express",     driverId: "UPS-8814",  property: "Maple Ridge HOA",     method: "Carrier Code",  duration: "1m 59s" },
];

const HISTORY_ROWS: HistoryRow[] = [
  { dateTime: "Apr 29 10:14 AM", property: "Stonegate",     unit: "Unit 204",  carrier: "Amazon Prime",  type: "Package",   method: "Locker",      status: "Awaiting Pickup", notified: "Yes (1)",     pickupTime: "—" },
  { dateTime: "Apr 29 10:08 AM", property: "Harbor View",   unit: "Unit 303",  carrier: "UPS Ground",    type: "Package",   method: "Door Drop",   status: "Awaiting Pickup", notified: "Yes (1)",     pickupTime: "—" },
  { dateTime: "Apr 29 9:55 AM",  property: "Ashford Glen",  unit: "Unit 501",  carrier: "FedEx Express", type: "Package",   method: "Locker",      status: "Picked Up",       notified: "Yes (1)",     pickupTime: "24 min" },
  { dateTime: "Apr 29 9:43 AM",  property: "Stonegate",     unit: "Unit 215",  carrier: "USPS",          type: "Mail",      method: "Locker",      status: "Awaiting Pickup", notified: "Yes (1)",     pickupTime: "—" },
  { dateTime: "Apr 29 9:22 AM",  property: "Camden",        unit: "Unit 402",  carrier: "Amazon Prime",  type: "Package",   method: "Locker",      status: "Awaiting Pickup", notified: "Yes (1)",     pickupTime: "—" },
  { dateTime: "Apr 29 9:12 AM",  property: "Stonegate",     unit: "Unit 308",  carrier: "DoorDash",      type: "Food",      method: "Access Code", status: "Delivered",       notified: "Yes (1)",     pickupTime: "N/A" },
  { dateTime: "Apr 29 8:50 AM",  property: "Maple Ridge",   unit: "Unit 104",  carrier: "Instacart",     type: "Grocery",   method: "Access Code", status: "Delivered",       notified: "Yes (1)",     pickupTime: "N/A" },
  { dateTime: "Apr 29 8:29 AM",  property: "Maple Ridge",   unit: "Unit 210",  carrier: "UPS Express",   type: "Package",   method: "Locker",      status: "Picked Up",       notified: "Yes (1)",     pickupTime: "1h 46m" },
  { dateTime: "Apr 28 4:12 PM",  property: "Harbor View",   unit: "Unit 601",  carrier: "DoorDash",      type: "Food",      method: "Access Code", status: "Delivered",       notified: "Yes (1)",     pickupTime: "N/A" },
  { dateTime: "Apr 28 3:55 PM",  property: "Camden",        unit: "Unit 208",  carrier: "USPS Priority", type: "Mail",      method: "Locker",      status: "Awaiting Pickup", notified: "Yes (2)",     pickupTime: "—" },
  { dateTime: "Apr 28 2:30 PM",  property: "Stonegate",     unit: "Unit 116",  carrier: "Uber Eats",     type: "Food",      method: "Access Code", status: "Delivered",       notified: "Yes (1)",     pickupTime: "N/A" },
  { dateTime: "Apr 28 1:45 PM",  property: "Northgate",     unit: "Suite 200", carrier: "Amazon Prime",  type: "Package",   method: "Locker",      status: "Picked Up",       notified: "Yes (1)",     pickupTime: "48 min" },
  { dateTime: "Apr 28 12:10 PM", property: "Ashford Glen",  unit: "Unit 112",  carrier: "UPS Ground",    type: "Package",   method: "Door Drop",   status: "Awaiting Pickup", notified: "Yes (1)",     pickupTime: "—" },
  { dateTime: "Apr 28 11:22 AM", property: "Stonegate",     unit: "Unit 412",  carrier: "FedEx Ground",  type: "Package",   method: "Door Drop",   status: "Awaiting Pickup", notified: "Yes (1)",     pickupTime: "—" },
  { dateTime: "Apr 28 9:05 AM",  property: "Camden",        unit: "Unit 307",  carrier: "Amazon Prime",  type: "Package",   method: "Locker",      status: "OVERDUE",         notified: "Yes (4)",     pickupTime: "—" },
];

const CARRIER_BREAKDOWN = [
  { label: "Amazon",        pct: 47, color: "bg-orange-400" },
  { label: "USPS",          pct: 18, color: "bg-blue-500" },
  { label: "UPS",           pct: 16, color: "bg-yellow-700" },
  { label: "FedEx",         pct: 12, color: "bg-purple-500" },
  { label: "Food Delivery", pct: 7,  color: "bg-rose-500" },
];

const TABS = ["Live Feed", "Package Lockers", "Carrier Access", "Delivery History"] as const;
type Tab = typeof TABS[number];

const LOCKER_PROPS = ["Stonegate", "Ashford", "Harbor View", "Camden"] as const;

// ─── Helper Components ────────────────────────────────────────────────────────

const CARRIER_COLORS: Record<CarrierKey, { bg: string; text: string; label: string }> = {
  AMZ: { bg: "bg-orange-500",  text: "text-white", label: "AMZ" },
  UPS: { bg: "bg-yellow-800",  text: "text-white", label: "UPS" },
  FED: { bg: "bg-purple-600",  text: "text-white", label: "FED" },
  USP: { bg: "bg-blue-600",    text: "text-white", label: "USP" },
  UBR: { bg: "bg-gray-900",    text: "text-white", label: "UBR" },
  DDR: { bg: "bg-red-600",     text: "text-white", label: "DDR" },
  INS: { bg: "bg-green-600",   text: "text-white", label: "INS" },
};

function CarrierBadge({ carrier }: { carrier: CarrierKey }) {
  const c = CARRIER_COLORS[carrier];
  return (
    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", c.bg, c.text)}>
      {c.label}
    </div>
  );
}

function StatusBadge({ status, overdue }: { status: DeliveryStatus; overdue?: boolean }) {
  if (overdue) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">OVERDUE</span>;
  }
  const map: Record<DeliveryStatus, string> = {
    "Awaiting Pickup": "bg-amber-100 text-amber-700",
    "Picked Up":       "bg-emerald-100 text-emerald-700",
    "Access Granted":  "bg-blue-100 text-blue-700",
    "Delivered":       "bg-emerald-100 text-emerald-700",
    "Overdue":         "bg-red-100 text-red-700",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", map[status])}>
      {status}
    </span>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none",
        on ? "bg-blue-600" : "bg-slate-200"
      )}
    >
      <span className={cn("inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-4.5" : "translate-x-0.5")} />
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DeliveriesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Live Feed");
  const [lockerProp, setLockerProp] = useState<string>("Stonegate");

  // Gig delivery toggles
  const [gigToggles, setGigToggles] = useState({
    autoCode: true,
    notifyOnUse: true,
    requireConfirm: false,
    cameraSnap: true,
    uberEats: true,
    doordash: true,
    instacart: true,
    grubhub: false,
    shipt: false,
    amazonFresh: true,
  });

  const flipGig = (key: keyof typeof gigToggles) =>
    setGigToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col min-h-full bg-slate-50">

      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Delivery Hub</h1>
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </div>
            <p className="text-sm text-slate-500">Every delivery, every carrier, every property — tracked in real time.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              <Download size={14} /> Export Log
            </button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
              <Key size={14} /> Manage Access
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 space-y-6">

        {/* ── Stats Row ── */}
        <div className="grid grid-cols-6 gap-4">
          {[
            { label: "Deliveries Today",   value: "47",  sub: "",               accent: "text-slate-800",    bg: "bg-white",          border: "border-slate-200" },
            { label: "In Lockers",         value: "12",  sub: "awaiting pickup", accent: "text-amber-600",   bg: "bg-amber-50",       border: "border-amber-200" },
            { label: "Overdue Pickups",    value: "3",   sub: ">24h",            accent: "text-red-600",     bg: "bg-red-50",         border: "border-red-200" },
            { label: "Carriers Active",    value: "8",   sub: "today",           accent: "text-blue-600",    bg: "bg-blue-50",        border: "border-blue-200" },
            { label: "Amazon Key Events",  value: "14",  sub: "",               accent: "text-orange-600",   bg: "bg-orange-50",      border: "border-orange-200" },
            { label: "Avg Pickup Time",    value: "3.2h", sub: "",              accent: "text-emerald-600",  bg: "bg-emerald-50",     border: "border-emerald-200" },
          ].map((stat) => (
            <div key={stat.label} className={cn("rounded-xl border p-4 flex flex-col gap-1", stat.bg, stat.border)}>
              <p className={cn("text-2xl font-bold tabular-nums", stat.accent)}>{stat.value}</p>
              <p className="text-xs font-medium text-slate-600 leading-tight">{stat.label}</p>
              {stat.sub && <p className="text-[10px] text-slate-400">{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            TAB 1 — Live Feed
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Live Feed" && (
          <div className="flex gap-5">

            {/* LEFT 60% — Activity Stream */}
            <div className="flex-[6] min-w-0 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">Activity Stream</p>
                <button className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {LIVE_EVENTS.map((ev) => (
                <div
                  key={ev.id}
                  className={cn(
                    "bg-white rounded-xl border px-4 py-3 flex items-start gap-3 hover:shadow-sm transition-shadow",
                    ev.overdue ? "border-red-200 bg-red-50/40" : "border-slate-200"
                  )}
                >
                  <CarrierBadge carrier={ev.carrier} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">{ev.service}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{ev.property}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-medium text-slate-600">{ev.unit}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{ev.eventType}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <StatusBadge status={ev.status} />
                      {ev.overdue && <StatusBadge status={ev.status} overdue />}
                      <span className="flex items-center gap-1 text-[10px] text-slate-400">
                        <Clock size={10} /> {ev.timeAgo}
                      </span>
                    </div>
                  </div>

                  {/* Camera placeholder */}
                  <div className="w-14 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                    <Camera size={14} className="text-slate-400" />
                  </div>

                  {/* Bell button */}
                  <button className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors">
                    <Bell size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* RIGHT 40% — Property Summary Cards */}
            <div className="flex-[4] min-w-0 space-y-3">
              <p className="text-sm font-semibold text-slate-700 mb-3">Today by Property</p>

              {PROPERTY_SUMMARIES.map((prop) => (
                <div
                  key={prop.name}
                  className={cn(
                    "bg-white rounded-xl border p-4 space-y-3",
                    prop.alert ? "border-red-200" : "border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{prop.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-500">{prop.deliveries} deliveries</span>
                        <span className="text-xs text-amber-600 font-medium">{prop.inLocker} in locker</span>
                        {prop.overdue > 0 && (
                          <span className="text-xs text-red-600 font-medium">{prop.overdue} overdue</span>
                        )}
                      </div>
                    </div>
                    {prop.alert && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                        <AlertTriangle size={10} /> OVERDUE ALERT
                      </span>
                    )}
                  </div>

                  {/* Carrier breakdown bar */}
                  <div>
                    <div className="flex h-2 rounded-full overflow-hidden gap-px">
                      {prop.breakdown.map((seg) => (
                        <div key={seg.label} className={cn("h-full", seg.color)} style={{ width: `${seg.pct}%` }} />
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      {prop.breakdown.map((seg) => (
                        <div key={seg.label} className="flex items-center gap-1">
                          <div className={cn("w-2 h-2 rounded-full", seg.color)} />
                          <span className="text-[10px] text-slate-500">{seg.label} {seg.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 2 — Package Lockers
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Package Lockers" && (
          <div className="space-y-5">

            {/* Header row */}
            <div className="bg-white rounded-xl border border-slate-200 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 tracking-widest">
                  LUXER ONE
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Connected — 4 properties
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <Settings size={12} /> Manage Lockers
              </button>
            </div>

            {/* Property selector */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
              {LOCKER_PROPS.map((p) => (
                <button
                  key={p}
                  onClick={() => setLockerProp(p)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors",
                    lockerProp === p ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Locker Grid */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-6">

              {[{ label: "Bank A", units: BANK_A }, { label: "Bank B", units: BANK_B }].map((bank) => (
                <div key={bank.label}>
                  <p className="text-sm font-semibold text-slate-700 mb-3">{bank.label}</p>
                  <div className="grid grid-cols-4 gap-2.5">
                    {bank.units.map((locker) => {
                      const isAvailable    = locker.state === "available";
                      const isOccupied     = locker.state === "occupied";
                      const isOverdue      = locker.state === "overdue";
                      const isOOS          = locker.state === "out-of-service";
                      const isPickedUp     = locker.state === "picked-up";

                      return (
                        <div
                          key={locker.id}
                          className={cn(
                            "aspect-square rounded-xl flex flex-col items-center justify-center p-2 border text-center transition-all",
                            isAvailable  && "bg-slate-50  border-dashed border-slate-300",
                            isOccupied   && "bg-blue-600  border-blue-700 text-white",
                            isOverdue    && "bg-red-600   border-red-700  text-white",
                            isOOS        && "bg-slate-700 border-slate-800 text-slate-400",
                            isPickedUp   && "bg-emerald-500 border-emerald-600 text-white",
                          )}
                        >
                          <p className="text-xs font-bold">{locker.id}</p>

                          {isAvailable && (
                            <p className="text-[10px] text-slate-400 mt-1">Available</p>
                          )}
                          {(isOccupied || isPickedUp) && locker.carrier && (
                            <>
                              <Package size={14} className="mt-1 opacity-90" />
                              <p className="text-[9px] font-semibold mt-1 leading-tight">{locker.carrier}</p>
                              <p className="text-[9px] opacity-80 leading-tight">{locker.unit}</p>
                              <p className="text-[9px] opacity-70">{locker.timeDeposited}</p>
                              {isPickedUp && <p className="text-[9px] font-bold mt-0.5">Picked Up</p>}
                            </>
                          )}
                          {isOverdue && locker.carrier && (
                            <>
                              <Package size={14} className="mt-1 opacity-90" />
                              <p className="text-[9px] font-bold mt-1 text-red-100">OVERDUE</p>
                              <p className="text-[9px] opacity-80 leading-tight">{locker.unit}</p>
                              <p className="text-[9px] opacity-70">{locker.timeDeposited}</p>
                            </>
                          )}
                          {isOOS && (
                            <>
                              <X size={14} className="mt-1" />
                              <p className="text-[9px] mt-1">Out of Service</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Locker Activity Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Locker Activity</p>
                <span className="text-xs text-slate-400">Recent 10 entries</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Locker", "Unit #", "Carrier", "Deposited", "Status", "Notified"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LOCKER_ACTIVITY.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">{row.locker}</td>
                      <td className="px-4 py-2.5 text-slate-700">{row.unit}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.carrier}</td>
                      <td className="px-4 py-2.5 text-slate-500">{row.deposited}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                          row.status === "OVERDUE"                     ? "bg-red-100 text-red-700" :
                          row.status === "Awaiting Pickup"             ? "bg-amber-100 text-amber-700" :
                          row.status.startsWith("Picked Up")           ? "bg-emerald-100 text-emerald-700" :
                          "bg-slate-100 text-slate-600"
                        )}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Bell size={10} /> {row.notified}×
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Integration Settings */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <p className="text-sm font-semibold text-slate-800">Luxer One Integration Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">API Key</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-mono text-slate-600">lxr_••••••••••••••••4f2a</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Webhook URL</label>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-xs font-mono text-slate-600 truncate">https://api.gateguard.co/webhooks/luxer</span>
                  </div>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Auto-notify on deposit</p>
                    <p className="text-[10px] text-slate-400">Push notification when package delivered</p>
                  </div>
                  <Toggle on={true} onChange={() => {}} />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Overdue alert threshold</p>
                    <p className="text-[10px] text-slate-400">Alert after this many hours</p>
                  </div>
                  <select className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700">
                    <option>12h</option>
                    <option selected>24h</option>
                    <option>48h</option>
                    <option>72h</option>
                  </select>
                </div>
              </div>
              <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                <Wifi size={12} /> Test Connection
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 3 — Carrier Access
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Carrier Access" && (
          <div className="space-y-6">

            {/* Section A — Automated Carrier Programs */}
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-3">Automated Carrier Programs</p>
              <div className="grid grid-cols-2 gap-4">
                {CARRIER_PROGRAMS.map((prog) => (
                  <div key={prog.name} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800 leading-tight">{prog.name}</p>
                      <span className={cn(
                        "shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold",
                        prog.status === "connected"     ? "bg-emerald-100 text-emerald-700" :
                        prog.status === "pending"       ? "bg-amber-100 text-amber-700" :
                        "bg-slate-100 text-slate-500"
                      )}>
                        {prog.status === "connected" ? "CONNECTED" : prog.status === "pending" ? "PENDING SETUP" : "NOT CONNECTED"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{prog.description}</p>
                    {prog.meta  && <p className="text-xs text-blue-600 font-medium">{prog.meta}</p>}
                    {prog.stats && <p className="text-xs text-slate-500">{prog.stats}</p>}
                    <button className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      prog.status === "connected"
                        ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    )}>
                      {prog.action}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Section B — Gig & Food Delivery */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-800 mb-1">Gig & Food Delivery</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Gig delivery drivers (Uber Eats, DoorDash, Instacart, GrubHub) are issued time-limited one-time access codes automatically when a resident places an order.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-8">
                {[
                  { key: "autoCode",       label: "Auto-generate code on delivery request", sub: "Code created when resident places order" },
                  { key: "notifyOnUse",    label: "Notify resident when code is used",       sub: "Push + SMS on gate entry" },
                  { key: "requireConfirm", label: "Require resident confirmation before granting access", sub: "Adds 1-tap approval step" },
                  { key: "cameraSnap",     label: "Log camera snapshot on entry",            sub: "Snapshot archived for 30 days" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between py-2 border-b border-slate-50">
                    <div>
                      <p className="text-xs font-medium text-slate-700">{item.label}</p>
                      <p className="text-[10px] text-slate-400">{item.sub}</p>
                    </div>
                    <Toggle
                      on={gigToggles[item.key as keyof typeof gigToggles] as boolean}
                      onChange={() => flipGig(item.key as keyof typeof gigToggles)}
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Code valid window</p>
                    <p className="text-[10px] text-slate-400">One-time code expiry</p>
                  </div>
                  <select className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700">
                    <option>15 min</option>
                    <option>30 min</option>
                    <option selected>45 min</option>
                    <option>60 min</option>
                    <option>90 min</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Supported Platforms</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "uberEats",    label: "Uber Eats",    color: "bg-black" },
                    { key: "doordash",    label: "DoorDash",     color: "bg-red-600" },
                    { key: "instacart",   label: "Instacart",    color: "bg-green-600" },
                    { key: "grubhub",     label: "GrubHub",      color: "bg-orange-600" },
                    { key: "shipt",       label: "Shipt",        color: "bg-red-700" },
                    { key: "amazonFresh", label: "Amazon Fresh",  color: "bg-orange-500" },
                  ].map((platform) => {
                    const isOn = gigToggles[platform.key as keyof typeof gigToggles] as boolean;
                    return (
                      <div
                        key={platform.key}
                        onClick={() => flipGig(platform.key as keyof typeof gigToggles)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg border cursor-pointer transition-all",
                          isOn ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white opacity-60"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", platform.color)} />
                          <span className="text-xs font-medium text-slate-700">{platform.label}</span>
                        </div>
                        <div className={cn(
                          "w-4 h-4 rounded flex items-center justify-center",
                          isOn ? "bg-blue-600" : "bg-slate-200"
                        )}>
                          {isOn && <Check size={10} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Section C — Delivery Access Log */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Delivery Access Log — Today</p>
                <span className="text-xs text-slate-400">8 entries</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Time", "Carrier", "Driver ID", "Property", "Method", "Duration"].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ACCESS_LOG.map((row, i) => (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{row.time}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.carrier}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-500">{row.driverId}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.property}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700">{row.method}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{row.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            TAB 4 — Delivery History
        ══════════════════════════════════════════════════════ */}
        {activeTab === "Delivery History" && (
          <div className="space-y-5">

            {/* Filter bar */}
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 min-w-[160px]">
                <Clock size={12} /> Apr 22 – Apr 29, 2026
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 min-w-[140px]">
                <Filter size={12} /> All Properties <ChevronDown size={10} className="ml-1" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 min-w-[130px]">
                <Truck size={12} /> All Carriers <ChevronDown size={10} className="ml-1" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 min-w-[110px]">
                <Search size={12} /><input placeholder="Unit #" className="outline-none w-16 bg-transparent text-xs text-slate-700" />
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 min-w-[110px]">
                <Filter size={12} /> All Statuses <ChevronDown size={10} className="ml-1" />
              </div>
              <button className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors">
                <RotateCcw size={11} /> Reset
              </button>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: "Total Deliveries",      value: "312",  color: "text-slate-800" },
                { label: "Avg Per Day",            value: "44.6", color: "text-blue-600" },
                { label: "Most Active Carrier",    value: "Amazon 47%", color: "text-orange-600" },
                { label: "Overdue Rate",           value: "2.1%", color: "text-red-600" },
                { label: "Locker Utilization",     value: "68%",  color: "text-emerald-600" },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-4">
                  <p className={cn("text-xl font-bold tabular-nums", stat.color)}>{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Carrier breakdown chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-sm font-semibold text-slate-800 mb-4">Carrier Breakdown — Last 7 Days</p>
              <div className="space-y-2.5">
                {CARRIER_BREAKDOWN.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-slate-600 font-medium text-right shrink-0">{bar.label}</div>
                    <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", bar.color)}
                        style={{ width: `${bar.pct}%` }}
                      />
                    </div>
                    <div className="w-10 text-xs font-semibold text-slate-700 text-right">{bar.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* History table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Delivery Log</p>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    <FileText size={12} /> Export CSV
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    <Archive size={12} /> Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {["Date / Time", "Property", "Unit #", "Carrier", "Type", "Method", "Status", "Notified", "Pickup Time"].map((h) => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {HISTORY_ROWS.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">{row.dateTime}</td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium whitespace-nowrap">{row.property}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.unit}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.carrier}</td>
                        <td className="px-4 py-2.5 text-slate-500">{row.type}</td>
                        <td className="px-4 py-2.5 text-slate-500">{row.method}</td>
                        <td className="px-4 py-2.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            row.status === "OVERDUE"          ? "bg-red-100 text-red-700" :
                            row.status === "Awaiting Pickup"  ? "bg-amber-100 text-amber-700" :
                            row.status === "Picked Up"        ? "bg-emerald-100 text-emerald-700" :
                            row.status === "Delivered"        ? "bg-emerald-100 text-emerald-700" :
                            "bg-blue-50 text-blue-700"
                          )}>
                            {row.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{row.notified}</td>
                        <td className="px-4 py-2.5 text-slate-500">{row.pickupTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400">Showing 15 of 312 entries</p>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, "...", 21].map((page, i) => (
                    <button
                      key={i}
                      className={cn(
                        "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                        page === 1 ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"
                      )}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
