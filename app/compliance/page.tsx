import { TopBar } from "@/components/layout/TopBar";
import { AISearch } from "@/components/ai/AISearch";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  FileText,
  Plus,
} from "lucide-react";

type ComplianceStatus = "Compliant" | "Expiring Soon" | "Expired";

interface PermitRow {
  property: string;
  type: string;
  issuedBy: string;
  issueDate: string;
  expiryDate: string;
  daysRemaining: string;
  status: ComplianceStatus;
}

const PERMITS: PermitRow[] = [
  {
    property: "Angel Oak Properties",
    type: "Gate Permit",
    issuedBy: "City of Atlanta",
    issueDate: "Jan 15, 2026",
    expiryDate: "Jan 15, 2027",
    daysRemaining: "258 days",
    status: "Compliant",
  },
  {
    property: "Angel Oak Properties",
    type: "Fire Marshal",
    issuedBy: "Fulton County",
    issueDate: "Mar 1, 2026",
    expiryDate: "Sep 1, 2026",
    daysRemaining: "122 days",
    status: "Expiring Soon",
  },
  {
    property: "Stonegate Townhomes",
    type: "Gate Permit",
    issuedBy: "City of Savannah",
    issueDate: "Apr 10, 2025",
    expiryDate: "Apr 10, 2026",
    daysRemaining: "EXPIRED",
    status: "Expired",
  },
  {
    property: "Stonegate Townhomes",
    type: "HOA Certificate",
    issuedBy: "Chatham HOA",
    issueDate: "Jan 1, 2026",
    expiryDate: "Jan 1, 2027",
    daysRemaining: "243 days",
    status: "Compliant",
  },
  {
    property: "Pegasus Properties",
    type: "Gate Permit",
    issuedBy: "City of Augusta",
    issueDate: "Feb 20, 2026",
    expiryDate: "Feb 20, 2027",
    daysRemaining: "293 days",
    status: "Compliant",
  },
  {
    property: "3888 Peachtree",
    type: "City License",
    issuedBy: "City of Atlanta",
    issueDate: "Nov 1, 2025",
    expiryDate: "Nov 1, 2026",
    daysRemaining: "182 days",
    status: "Compliant",
  },
  {
    property: "Midwood Gardens",
    type: "Gate Permit",
    issuedBy: "DeKalb County",
    issueDate: "May 5, 2025",
    expiryDate: "May 5, 2026",
    daysRemaining: "3 days",
    status: "Expiring Soon",
  },
  {
    property: "Midwood Gardens",
    type: "Fire Marshal",
    issuedBy: "DeKalb County",
    issueDate: "Aug 10, 2025",
    expiryDate: "Aug 10, 2026",
    daysRemaining: "100 days",
    status: "Compliant",
  },
  {
    property: "Flint River",
    type: "Gate Permit",
    issuedBy: "City of Griffin",
    issueDate: "Jan 1, 2025",
    expiryDate: "Jan 1, 2026",
    daysRemaining: "EXPIRED",
    status: "Expired",
  },
  {
    property: "Elevate Eagles Landing",
    type: "Gate Permit",
    issuedBy: "Cherokee County",
    issueDate: "Mar 15, 2026",
    expiryDate: "Mar 15, 2027",
    daysRemaining: "317 days",
    status: "Compliant",
  },
  {
    property: "Columbia Residential",
    type: "HOA Certificate",
    issuedBy: "Richland HOA",
    issueDate: "Dec 1, 2025",
    expiryDate: "Jun 1, 2026",
    daysRemaining: "29 days",
    status: "Expiring Soon",
  },
  {
    property: "Mitul Patel",
    type: "Gate Permit",
    issuedBy: "City of Atlanta",
    issueDate: "Apr 1, 2026",
    expiryDate: "Apr 1, 2027",
    daysRemaining: "333 days",
    status: "Compliant",
  },
];

const expiredCount = PERMITS.filter((p) => p.status === "Expired").length;

function StatusBadge({ status }: { status: ComplianceStatus }) {
  if (status === "Compliant") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">
        Compliant
      </span>
    );
  }
  if (status === "Expiring Soon") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-400">
        Expiring Soon
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-400/10 text-red-400">
      Expired
    </span>
  );
}

function DaysCell({ days, status }: { days: string; status: ComplianceStatus }) {
  if (status === "Expired") {
    return <span className="font-semibold text-red-400">{days}</span>;
  }
  if (status === "Expiring Soon") {
    return <span className="font-semibold text-amber-400">{days}</span>;
  }
  return <span className="text-foreground">{days}</span>;
}

export default function CompliancePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Compliance & Permits"
        subtitle="Gate permits, inspections, and regulatory deadlines per property"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-400 text-white text-xs font-semibold hover:bg-brand-500 transition-colors">
            <Plus size={13} />
            Add Permit
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">
        {/* Expired Alert Banner */}
        {expiredCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
            <XCircle size={16} className="shrink-0" />
            <p className="text-sm font-medium">
              {expiredCount} permit{expiredCount > 1 ? "s" : ""} expired — immediate action required
            </p>
          </div>
        )}

        {/* AI Search */}
        <AISearch placeholder='Try "show expiring permits in Atlanta" or "fire marshal certificates"' />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-brand-400/10">
              <FileText size={16} className="text-brand-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">28</p>
              <p className="text-xs text-muted-foreground">Total Items</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-400/10">
              <ShieldCheck size={16} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">19</p>
              <p className="text-xs text-muted-foreground">Compliant</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-400/10">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">6</p>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-red-400/10">
              <XCircle size={16} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">3</p>
              <p className="text-xs text-muted-foreground">Expired / Overdue</p>
            </div>
          </div>
        </div>

        {/* Permits Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <ShieldCheck size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Permit & Compliance Registry</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-background/30">
                  {[
                    "Property",
                    "Type",
                    "Issued By",
                    "Issue Date",
                    "Expiry Date",
                    "Days Remaining",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-muted-foreground font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMITS.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/50 hover:bg-accent/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {row.property}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.type}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.issuedBy}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.issueDate}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {row.expiryDate}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <DaysCell days={row.daysRemaining} status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
