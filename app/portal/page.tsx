"use client";

import { useState } from "react";
import {
  Shield, Camera, CreditCard, FileText, CheckCircle2, Clock,
  AlertCircle, Phone, Mail, Send, Globe, Building2, ChevronRight,
  DollarSign, Calendar, Headphones, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types & Data ────────────────────────────────────────────────────────────

type Tab = "overview" | "invoices" | "services" | "support";

const services = [
  {
    name: "GateGuard Standard Monitoring",
    detail: "12 cameras",
    price: "$1,200/mo",
    status: "Active",
  },
  {
    name: "EagleEye Cloud Recording (90-day)",
    detail: "12 camera streams",
    price: "$480/mo",
    status: "Active",
  },
  {
    name: "Brivo Access Control",
    detail: "4 doors",
    price: "$360/mo",
    status: "Active",
  },
  {
    name: "Emergency Response SLA",
    detail: "24/7 dispatch",
    price: "$360/mo",
    status: "Active",
  },
];

const invoices = [
  { id: "#INV-0091", date: "Apr 1, 2026", amount: "$2,400", status: "Paid" },
  { id: "#INV-0084", date: "Mar 1, 2026", amount: "$2,400", status: "Paid" },
  { id: "#INV-0077", date: "Feb 1, 2026", amount: "$2,400", status: "Paid" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function NavTab({ label, value, active, onClick }: { label: string; value: Tab; active: boolean; onClick: (v: Tab) => void }) {
  return (
    <button
      onClick={() => onClick(value)}
      className={cn(
        "px-5 py-3 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-[#2563EB] text-[#2563EB]"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
      )}
    >
      {label}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-full bg-slate-50">
      {/* Dealer preview banner */}
      <div className="bg-[#2563EB] text-white px-6 py-2.5 flex items-center gap-3 text-sm">
        <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
          <AlertCircle size={12} className="text-white" />
        </div>
        <span className="font-medium">You&apos;re viewing the customer portal as:</span>
        <span className="font-bold bg-white/10 px-2.5 py-0.5 rounded-full">Stonegate Townhomes</span>
        <span className="ml-auto text-white/70 text-xs">Dealer Preview Mode · Changes are read-only</span>
      </div>

      {/* Customer portal header */}
      <div className="bg-[#0f1c3f] text-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#2563EB] flex items-center justify-center">
              <Shield size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white leading-tight">Stonegate Townhomes</p>
              <p className="text-[11px] text-blue-300 font-medium">Powered by GateGuard</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-300">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </span>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Phone size={15} />
            </button>
          </div>
        </div>
        {/* Nav tabs */}
        <div className="max-w-5xl mx-auto px-6 flex border-t border-white/10">
          {(["overview", "invoices", "services", "support"] as Tab[]).map((t) => (
            <NavTab
              key={t}
              label={t.charAt(0).toUpperCase() + t.slice(1)}
              value={t}
              active={activeTab === t}
              onClick={setActiveTab}
            />
          ))}
        </div>
      </div>

      {/* Portal body */}
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Overview tab */}
        {activeTab === "overview" && (
          <>
            {/* Welcome card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Welcome back, Property Manager</h2>
                <div className="flex items-center gap-4 mt-1.5 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-slate-400" />
                    Account <span className="font-semibold text-slate-700">SG-2847</span>
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1.5">
                    <Calendar size={13} className="text-slate-400" />
                    Member since <span className="font-semibold text-slate-700">Jan 2024</span>
                  </span>
                </div>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/8 border border-[#2563EB]/15 flex items-center justify-center">
                <Shield size={24} className="text-[#2563EB]" />
              </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "Monthly Total",
                  value: "$2,400",
                  sub: "Due May 1, 2026",
                  icon: DollarSign,
                  color: "text-[#2563EB]",
                  bg: "bg-blue-50",
                  border: "border-blue-100",
                },
                {
                  label: "Cameras Active",
                  value: "12/12",
                  sub: "All online · No alerts",
                  icon: Camera,
                  color: "text-emerald-600",
                  bg: "bg-emerald-50",
                  border: "border-emerald-100",
                },
                {
                  label: "Next Invoice",
                  value: "May 1",
                  sub: "$2,400 · Auto-pay on",
                  icon: Calendar,
                  color: "text-slate-600",
                  bg: "bg-slate-100",
                  border: "border-slate-200",
                },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.label}
                    className={cn("bg-white rounded-xl border shadow-sm p-5 flex items-center gap-4", s.border)}
                  >
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", s.bg)}>
                      <Icon size={18} className={s.color} />
                    </div>
                    <div>
                      <p className="text-xl font-bold text-slate-900">{s.value}</p>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">{s.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Services */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Shield size={15} className="text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-slate-900">Active Services</h3>
                </div>
                <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  All services running
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {services.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{svc.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{svc.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-slate-700">{svc.price}</span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-100">
                        {svc.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">4 active services</span>
                <span className="text-sm font-bold text-slate-900">Total: $2,400/mo</span>
              </div>
            </div>

            {/* Payment Method + Contract */}
            <div className="grid grid-cols-2 gap-4">
              {/* Payment method */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={14} className="text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-slate-900">Payment Method</h3>
                </div>
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-7 rounded-md bg-[#1a1a2e] flex items-center justify-center text-white text-[10px] font-bold tracking-wider">
                    VISA
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Visa ending 4242</p>
                    <p className="text-xs text-slate-400">Exp 12/26 · Auto-pay enabled</p>
                  </div>
                  <CheckCircle2 size={16} className="text-emerald-500 ml-auto" />
                </div>
                <button className="mt-3 w-full py-2 rounded-lg border border-[#2563EB]/30 bg-[#2563EB]/5 text-[#2563EB] text-sm font-semibold hover:bg-[#2563EB]/10 transition-colors">
                  Update Payment Method
                </button>
              </div>

              {/* Contract */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText size={14} className="text-[#2563EB]" />
                  <h3 className="text-sm font-bold text-slate-900">Contract</h3>
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Start date</span>
                    <span className="font-semibold text-slate-800">Jan 15, 2024</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">End date</span>
                    <span className="font-semibold text-slate-800">Jan 15, 2027</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Remaining</span>
                    <span className="font-semibold text-[#2563EB]">34 months</span>
                  </div>
                </div>
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#2563EB] rounded-full" style={{ width: "37%" }} />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 text-right">37% of term elapsed</p>
                <button className="mt-2 w-full py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                  <ExternalLink size={13} />
                  View Contract
                </button>
              </div>
            </div>
          </>
        )}

        {/* Invoices section — always shown below overview */}
        {(activeTab === "overview" || activeTab === "invoices") && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#2563EB]" />
                <h3 className="text-sm font-bold text-slate-900">
                  {activeTab === "overview" ? "Recent Invoices" : "Invoices"}
                </h3>
              </div>
              <button className="text-xs text-[#2563EB] font-semibold hover:underline flex items-center gap-1">
                View All Invoices <ChevronRight size={12} />
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {["Invoice", "Date", "Amount", "Status"].map((h) => (
                    <th key={h} className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                  <th className="px-6 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => (
                  <tr
                    key={inv.id}
                    className={cn(
                      "hover:bg-slate-50/60 transition-colors",
                      i < invoices.length - 1 && "border-b border-slate-50"
                    )}
                  >
                    <td className="px-6 py-3.5 font-mono font-semibold text-slate-700">{inv.id}</td>
                    <td className="px-6 py-3.5 text-slate-500">{inv.date}</td>
                    <td className="px-6 py-3.5 font-bold text-slate-900">{inv.amount}</td>
                    <td className="px-6 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-100">
                        <CheckCircle2 size={11} />
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button className="text-xs text-slate-400 hover:text-[#2563EB] transition-colors font-medium">
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Services tab */}
        {activeTab === "services" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">All Active Services</h3>
            <div className="space-y-3">
              {services.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div>
                    <p className="font-semibold text-slate-800">{svc.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{svc.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{svc.price}</p>
                    <span className="text-[11px] text-emerald-600 font-semibold">{svc.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Support tab */}
        {activeTab === "support" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center">
            <Headphones size={32} className="text-[#2563EB] mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-900 mb-1">GateGuard Support</h3>
            <p className="text-sm text-slate-500 mb-4">We&apos;re here to help. Submit a request or reach us directly.</p>
            <button className="mx-auto flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
              <Send size={14} /> Submit Service Request
            </button>
          </div>
        )}

        {/* Need Help card */}
        <div className="bg-[#0f1c3f] rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Headphones size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Need Help?</p>
              <p className="text-xs text-slate-300 mt-0.5">Our support team is available 24/7 for emergency issues</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:8446942283" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
              <Phone size={13} /> 844-694-2283
            </a>
            <a href="mailto:support@gateguard.co" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors">
              <Mail size={13} /> support@gateguard.co
            </a>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-blue-600 text-white text-sm font-semibold transition-colors">
              <Send size={13} /> Submit Request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
