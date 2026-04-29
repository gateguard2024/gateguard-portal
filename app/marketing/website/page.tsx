"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Plus,
  Search,
  ExternalLink,
  Edit2,
  Eye,
  Globe,
  Users,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Wifi,
  Shield,
  Camera,
  DoorOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteStatus = "live" | "setup" | "draft";

interface DealerSite {
  id: number;
  name: string;
  initials: string;
  slug: string;
  status: SiteStatus;
  visitors: number | null;
  leads: number | null;
  updatedLabel: string;
  avatarColor: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const sites: DealerSite[] = [
  { id: 1, name: "SecureATL",              initials: "SA",  slug: "secureATL",    status: "live",  visitors: 340, leads: 8, updatedLabel: "2d ago",  avatarColor: "#2563EB" },
  { id: 2, name: "Gate Masters LLC",       initials: "GM",  slug: "gatemasters",  status: "live",  visitors: 220, leads: 5, updatedLabel: "1w ago",  avatarColor: "#7C3AED" },
  { id: 3, name: "Peach State Access",     initials: "PS",  slug: "peachstate",   status: "live",  visitors: 195, leads: 6, updatedLabel: "3d ago",  avatarColor: "#059669" },
  { id: 4, name: "ClearView Security",     initials: "CV",  slug: "clearview",    status: "live",  visitors: 178, leads: 4, updatedLabel: "2w ago",  avatarColor: "#0D9488" },
  { id: 5, name: "Premier Access Control", initials: "PA",  slug: "premieraccess",status: "live",  visitors: 156, leads: 4, updatedLabel: "1w ago",  avatarColor: "#D97706" },
  { id: 6, name: "Southeast Security Group",initials:"SS",  slug: "sesecurity",   status: "live",  visitors: 134, leads: 3, updatedLabel: "3d ago",  avatarColor: "#DC2626" },
  { id: 7, name: "Apex Gate Systems",      initials: "AG",  slug: "apexgate",     status: "setup", visitors: null,leads: null,updatedLabel: "Started 3d ago", avatarColor: "#6B7280" },
  { id: 8, name: "TrueGuard Security",     initials: "TG",  slug: "trueguard",    status: "draft", visitors: null,leads: null,updatedLabel: "Created 1w ago",avatarColor: "#6B7280" },
];

const statusConfig: Record<SiteStatus, { label: string; className: string; dot: string }> = {
  live:  { label: "Live",              className: "bg-emerald-50 text-emerald-700 border border-emerald-200", dot: "bg-emerald-500 animate-pulse" },
  setup: { label: "Setup in Progress", className: "bg-amber-50 text-amber-700 border border-amber-200",      dot: "bg-amber-500" },
  draft: { label: "Draft",             className: "bg-gray-100 text-gray-500 border border-gray-200",        dot: "bg-gray-400" },
};

// ─── Website Preview ──────────────────────────────────────────────────────────

function WebsitePreview({ site }: { site: DealerSite }) {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      {/* Browser chrome */}
      <div className="bg-[#E8EAED] border-b border-gray-300 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
          <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
          <span className="w-3 h-3 rounded-full bg-[#28C840]" />
        </div>
        <div className="flex-1 bg-white rounded-md border border-gray-200 flex items-center gap-2 px-3 py-1.5">
          <Globe size={11} className="text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-600 font-medium truncate">{site.slug}.gateguard.co</span>
        </div>
      </div>

      {/* Mocked website content */}
      <div className="bg-white overflow-y-auto" style={{ maxHeight: "520px" }}>
        {/* Nav */}
        <nav className="bg-[#0F172A] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center">
              <Shield size={13} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm">{site.name}</span>
          </div>
          <div className="hidden sm:flex items-center gap-5">
            {["Home", "Services", "About", "Contact"].map((item) => (
              <button key={item} className="text-gray-400 hover:text-white text-xs font-medium transition-colors duration-100">
                {item}
              </button>
            ))}
          </div>
          <button className="bg-[#2563EB] text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#1d4ed8] transition-colors duration-150">
            Free Quote
          </button>
        </nav>

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#0F172A] to-[#1E3A5F] px-6 py-10 text-center">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-300 bg-blue-900/40 px-3 py-1 rounded-full mb-4 border border-blue-800/40">
            <CheckCircle2 size={10} />
            Licensed & Insured
          </span>
          <h1 className="text-white font-bold text-xl leading-tight mb-3">
            Professional Security Solutions<br />for Metro Atlanta
          </h1>
          <p className="text-gray-400 text-xs leading-relaxed max-w-xs mx-auto mb-5">
            Gate systems, camera installation, and access control for residential communities and commercial properties.
          </p>
          <button className="bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors duration-150">
            Get a Free Quote
          </button>
        </div>

        {/* Services */}
        <div className="bg-gray-50 px-5 py-6">
          <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">Our Services</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: <DoorOpen size={18} className="text-[#2563EB]" />, title: "Gate Systems", desc: "Automated entry systems for any property type or size" },
              { icon: <Camera size={18} className="text-[#7C3AED]" />,   title: "Camera Installation", desc: "HD surveillance with remote monitoring and alerts" },
              { icon: <Shield size={18} className="text-[#059669]" />,   title: "Access Control", desc: "Keycard and mobile access with full audit trails" },
            ].map((svc) => (
              <div key={svc.title} className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
                <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center mx-auto mb-2">
                  {svc.icon}
                </div>
                <p className="text-xs font-semibold text-gray-900 mb-1">{svc.title}</p>
                <p className="text-[10px] text-gray-500 leading-relaxed">{svc.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quote Form */}
        <div className="px-5 py-6 bg-white">
          <p className="text-center text-sm font-bold text-gray-900 mb-1">Get a Free Quote</p>
          <p className="text-center text-xs text-gray-500 mb-4">We&apos;ll respond within 1 business day</p>
          <div className="max-w-sm mx-auto space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Full Name"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 bg-gray-50"
                readOnly
              />
              <input
                type="email"
                placeholder="Email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none bg-gray-50"
                readOnly
              />
            </div>
            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none bg-gray-50"
              readOnly
            />
            <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-500 focus:outline-none bg-gray-50">
              <option>Property Type</option>
              <option>Multifamily / Apartment</option>
              <option>HOA / Community</option>
              <option>Commercial</option>
            </select>
            <textarea
              placeholder="Tell us about your property..."
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none bg-gray-50 resize-none"
              readOnly
            />
            <button className="w-full bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-semibold text-xs py-2.5 rounded-xl transition-colors duration-150">
              Submit Request
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#0F172A] px-5 py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-white font-semibold text-xs">{site.name}</p>
              <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
                <Phone size={10} />
                <span>(404) 555-0192</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
                <Mail size={10} />
                <span>info@{site.slug}.com</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-400 text-[10px]">
                <MapPin size={10} />
                <span>Atlanta, GA 30301</span>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="flex items-center gap-2 justify-end">
                {["FB", "IG", "LI"].map((s) => (
                  <div key={s} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-gray-400">{s}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5">
                <div className="w-3.5 h-3.5 rounded bg-[#2563EB] flex items-center justify-center">
                  <Shield size={8} className="text-white" />
                </div>
                <span className="text-[9px] font-medium text-gray-400">Powered by GateGuard</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toggle Row ───────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={onToggle}
        className={cn(
          "relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none",
          value ? "bg-[#2563EB]" : "bg-gray-200"
        )}
        style={{ minWidth: "40px", height: "22px" }}
        role="switch"
        aria-checked={value}
      >
        <span
          className={cn(
            "absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform duration-200",
            value ? "translate-x-5" : "translate-x-0.5"
          )}
          style={{ width: "18px", height: "18px", top: "2px", left: value ? "18px" : "2px" }}
        />
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebsitePage() {
  const [selectedId, setSelectedId] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [templateEnabled, setTemplateEnabled] = useState(true);
  const [customDomainEnabled, setCustomDomainEnabled] = useState(false);
  const [leadNotificationsEnabled, setLeadNotificationsEnabled] = useState(true);

  const selectedSite = sites.find((s) => s.id === selectedId) ?? sites[0];

  const filteredSites = sites.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.slug.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const liveSites    = sites.filter((s) => s.status === "live").length;
  const pendingSites = sites.filter((s) => s.status === "setup").length;
  const leadsTotal   = sites.reduce((acc, s) => acc + (s.leads ?? 0), 0);
  const avgVisitors  = Math.round(
    sites.filter((s) => s.visitors !== null).reduce((acc, s) => acc + (s.visitors ?? 0), 0) /
    sites.filter((s) => s.visitors !== null).length
  );

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="max-w-[1400px] mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1.5">
              <span>Marketing</span>
              <ChevronRight size={12} />
              <span className="text-gray-600 font-medium">Websites</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dealer Websites</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Hosted landing pages for every dealer with CRM-connected lead forms.
            </p>
          </div>
          <button className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors duration-150 shadow-sm flex-shrink-0">
            <Plus size={14} />
            New Site
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Sites Live",             value: String(liveSites),    icon: <CheckCircle2 size={18} />, iconBg: "#ECFDF5", iconColor: "#059669" },
            { label: "Sites Pending Setup",    value: String(pendingSites), icon: <Loader2 size={18} />,     iconBg: "#FFFBEB", iconColor: "#D97706" },
            { label: "Leads From Sites",       value: `${leadsTotal} this month`, icon: <ArrowUpRight size={18} />, iconBg: "#EFF6FF", iconColor: "#2563EB" },
            { label: "Avg Monthly Visitors",   value: avgVisitors.toLocaleString(), icon: <Users size={18} />,    iconBg: "#F5F3FF", iconColor: "#7C3AED" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-5 flex items-start gap-4">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ backgroundColor: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-none mb-1">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight">{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[45%_55%] gap-5 items-start">

          {/* Left — Sites List */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">All Sites</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sites..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl placeholder-gray-400 text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all duration-150"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[640px] overflow-y-auto">
              {filteredSites.map((site) => {
                const sc = statusConfig[site.status];
                const isSelected = site.id === selectedId;
                return (
                  <div
                    key={site.id}
                    onClick={() => setSelectedId(site.id)}
                    className={cn(
                      "px-5 py-4 flex items-start gap-3.5 cursor-pointer transition-all duration-150",
                      isSelected
                        ? "bg-blue-50 border-l-2 border-l-[#2563EB]"
                        : "hover:bg-gray-50 border-l-2 border-l-transparent"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ backgroundColor: site.avatarColor }}
                    >
                      {site.initials}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-900 truncate">{site.name}</span>
                        <span className={cn("flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0", sc.className)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", sc.dot)} />
                          {sc.label}
                        </span>
                      </div>

                      <a
                        href={`https://${site.slug}.gateguard.co`}
                        onClick={(e) => e.stopPropagation()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline mb-1.5"
                      >
                        <Globe size={10} />
                        {site.slug}.gateguard.co
                        <ExternalLink size={10} />
                      </a>

                      {site.status === "live" && (
                        <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                          <span className="flex items-center gap-1">
                            <Users size={10} className="text-gray-400" />
                            {site.visitors?.toLocaleString()}/mo
                          </span>
                          <span className="flex items-center gap-1">
                            <ArrowUpRight size={10} className="text-gray-400" />
                            {site.leads} leads
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={9} />
                          {site.updatedLabel}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(site.id); }}
                            className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors duration-150"
                          >
                            <Edit2 size={10} />
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(site.id); }}
                            className="flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors duration-150"
                          >
                            <Eye size={10} />
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right — Preview */}
          <div className="space-y-4">
            {/* Preview header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: selectedSite.avatarColor }}
                  >
                    {selectedSite.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedSite.name}</p>
                    <p className="text-xs text-gray-400">{selectedSite.slug}.gateguard.co</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border",
                    statusConfig[selectedSite.status].className
                  )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", statusConfig[selectedSite.status].dot)} />
                    {statusConfig[selectedSite.status].label}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <WebsitePreview site={selectedSite} />
              </div>
            </div>

            {/* Settings panel */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Site Settings</h3>
              </div>
              <div className="px-5 divide-y divide-gray-50">
                <ToggleRow
                  label="Template"
                  description="Use GateGuard branded template with your dealer info"
                  value={templateEnabled}
                  onToggle={() => setTemplateEnabled((v) => !v)}
                />
                <ToggleRow
                  label="Custom Domain"
                  description="Connect your own domain (e.g. secureATL.com)"
                  value={customDomainEnabled}
                  onToggle={() => setCustomDomainEnabled((v) => !v)}
                />
                <ToggleRow
                  label="Lead Notifications"
                  description="Email alert when a form submission comes in"
                  value={leadNotificationsEnabled}
                  onToggle={() => setLeadNotificationsEnabled((v) => !v)}
                />
              </div>
              <div className="px-5 py-4">
                <button className="w-full flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors duration-150 shadow-sm">
                  <Edit2 size={14} />
                  Customize Site
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
