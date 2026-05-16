"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Camera, Shield, FileText,
  Wrench, CreditCard, Settings, ChevronRight, ChevronDown,
  Radio, MessageSquare, BarChart3,
  Network, Truck, Package, Repeat, TrendingUp,
  Globe, ClipboardList, Headphones, FileCheck,
  Megaphone, Map, BookOpen, Tv, Zap,
  Layers, Server, UserCheck, ShieldCheck, Star,
  GraduationCap, Tv as Satellite, Crosshair,
  User, RefreshCw, Sparkles, Wrench as TechIcon,
  ClipboardCheck, Building2,
} from "lucide-react";
// Icons not in type declarations for lucide-react 0.383.0 but available at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowRightLeft, UserCog, LogOut } = require("lucide-react") as any;
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect, useCallback } from "react";
import { useUser, useClerk, useSession } from "@clerk/nextjs";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  external?: boolean;
  description?: string; // short tooltip description for new users
};

type NavSection = {
  key: string;
  label: string;
  icon: React.ElementType;
  color?: string;
  items: NavItem[];
};

// ─── Navigation Architecture ──────────────────────────────────────────────────
// 7 primary sections, each with an accordion of sub-items.
// Designed for clarity: a non-technical user can find anything in ≤2 clicks.

const NAV_SECTIONS: NavSection[] = [
  {
    key: "operations",
    label: "Operations",
    icon: LayoutDashboard,
    items: [
      { label: "Dashboard",          href: "/",    icon: LayoutDashboard, description: "Your command center — KPIs, alerts, activity" },
      { label: "Operating System",   href: "/eos", icon: Layers,          description: "EOS — V/TO, Rocks, Scorecard, L10 meetings" },
      { label: "CRM",                href: "/crm", icon: MessageSquare,   description: "Leads, opportunities, pipeline" },
      { label: "Customers",    href: "/customers",   icon: Users,           description: "All customer accounts" },
      { label: "Quotes",       href: "/quotes",      icon: FileText,        description: "Proposals and approvals" },
      { label: "Billing",      href: "/billing",     icon: CreditCard,      description: "Invoices and payments" },
      { label: "Renewals",     href: "/renewals",    icon: Repeat,          description: "Contract renewals and alerts" },
      { label: "Revenue",      href: "/revenue",     icon: TrendingUp,      description: "MRR/ARR and commission overview" },
      { label: "Contracts",    href: "/contracts",   icon: FileCheck,       description: "Contract storage" },
    ],
  },
  {
    key: "field",
    label: "Field & Tech",
    icon: TechIcon,
    items: [
      { label: "Tech Tool",      href: "/tech",        icon: Sparkles,       description: "AI diagnostic tool for field techs", badge: "AI" },
      { label: "Knowledge Base", href: "/kb",          icon: BookOpen,       description: "Troubleshooting articles and manuals" },
      { label: "Products",       href: "/products",    icon: Package,        description: "Equipment catalog and manuals" },
      { label: "Properties",      href: "/sites",       icon: Building2,      description: "Installed sites, equipment, and asset map" },
      { label: "Maintenance",    href: "/maintenance", icon: Wrench,         description: "Work orders and service history" },
      { label: "Dispatch",       href: "/dispatch",    icon: Truck,          description: "Tech scheduling and job board" },
      { label: "Inventory",      href: "/inventory",   icon: Package,        description: "Parts, stock, and POs" },
      { label: "Site Survey",    href: "/survey",      icon: ClipboardCheck, description: "Site walk and proposal builder" },
      { label: "Reports",        href: "/reports",     icon: BarChart3,      description: "Multi-site rollup and analytics" },
    ],
  },
  {
    key: "security",
    label: "Security",
    icon: Shield,
    color: "#0B7285",
    items: [
      { label: "Cameras",        href: "/cameras",    icon: Camera,  description: "Eagle Eye live feeds and clips" },
      { label: "Access Control", href: "/access",     icon: Shield,  description: "Brivo credentials and logs" },
      { label: "Network",        href: "/network",    icon: Server,  description: "UniFi infrastructure and VLANs" },
      { label: "SOC",            href: "https://ggsoc.com", icon: Radio, external: true, description: "Live call center (opens ggsoc.com)" },
    ],
  },
  {
    key: "dealer",
    label: "Dealer Network",
    icon: UserCheck,
    color: "#7C3AED",
    items: [
      { label: "Dealers",                   href: "/admin/dealers", icon: Users,        description: "Onboard and manage dealer orgs", badge: "Admin" },
      { label: "Reps & Commissions",       href: "/reps",          icon: UserCheck,    description: "Rep hierarchy and payouts" },
      { label: "Compliance",               href: "/compliance",    icon: ShieldCheck,  description: "Permits, certs, and expiry alerts" },
      { label: "Territory Map",            href: "/map",           icon: Map,          description: "Property pins by health status" },
      { label: "Scorecard",                href: "/scorecard",     icon: Star,         description: "Dealer performance metrics" },
      { label: "Training & Certification", href: "/training",      icon: GraduationCap,description: "Courses and certifications" },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    icon: Sparkles,
    color: "#6B7EFF",
    items: [
      { label: "ARIA — Lead Intel",      href: "/aria",     icon: Crosshair,     description: "AI-powered outreach and lead research", badge: "AI" },
      { label: "DirecTV / ATLAS",        href: "/directv",  icon: Satellite,     description: "DirecTV channel dashboard and orders" },
      { label: "New Order",              href: "/orders/new", icon: Zap,          description: "Submit a DirecTV order" },
      { label: "SARA Bridge",            href: "/migrate",  icon: ArrowRightLeft,description: "Migrate from SARA Plus to Nexus" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    icon: Megaphone,
    color: "#B45309",
    items: [
      { label: "Marketing Hub",    href: "/marketing",         icon: Megaphone, description: "Campaigns and content" },
      { label: "Social",           href: "/marketing/social",  icon: Globe,     description: "GateGuard and dealer social posts" },
      { label: "Co-op Pool",       href: "/marketing/coop",    icon: Users,     description: "Shared lead pool" },
      { label: "Dealer Sites",     href: "/marketing/website", icon: Globe,     description: "Hosted dealer landing pages" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      { label: "Company Setup",    href: "/onboarding",       icon: Building2,    description: "Company info, logo, team, integrations" },
      { label: "Organizations",    href: "/admin",            icon: Network,      description: "5-tier org hierarchy" },
      { label: "User Management",  href: "/admin/users",      icon: UserCog,      description: "Roles and access control" },
      { label: "Communications",   href: "/communications",   icon: Headphones,   description: "Messaging and notifications" },
      { label: "Customer Portal",  href: "/portal",           icon: Globe,        description: "Property manager view" },
    ],
  },
];

const integrations = [
  { label: "Eagle Eye",   status: "connected" as const },
  { label: "Brivo",      status: "connected" as const },
  { label: "DirecTV",    status: "connected" as const },
  { label: "QuickBooks", status: "pending"   as const },
  { label: "Twilio",     status: "pending"   as const },
];

const aiAgents = [
  { name: "ARIA",    role: "Lead Intel",    color: "#6B7EFF", active: true,  href: "/aria" },
  { name: "TRINITY", role: "Voice",         color: "#0B7285", active: true,  href: null },
  { name: "SCOUT",   role: "Market",        color: "#7C3AED", active: true,  href: null },
  { name: "BEACON",  role: "Client Comms",  color: "#B45309", active: false, href: null },
  { name: "FORGE",   role: "Quote Builder", color: "#0B7285", active: true,  href: null },
  { name: "ATLAS",   role: "DirecTV",       color: "#3B5BDB", active: true,  href: "/directv" },
  { name: "SAGE",    role: "Training",      color: "#15803D", active: false, href: null },
  { name: "RELAY",   role: "Tier-1 Support",color: "#6B7EFF", active: false, href: null },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getSectionForPath(pathname: string): string | null {
  for (const section of NAV_SECTIONS) {
    for (const item of section.items) {
      if (!item.external) {
        const match = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        if (match) return section.key;
      }
    }
  }
  return null;
}

// ─── Sidebar Component ────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [armyExpanded, setArmyExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [integrationsExpanded, setIntegrationsExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Accordion state — which sections are open
  const activeSection = getSectionForPath(pathname);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(activeSection ? [activeSection] : ["operations"])
  );

  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { session } = useSession();

  const displayName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Russel Feldman";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "rfeldman@gateguard.co";
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "RF";

  // Auto-expand section when route changes
  useEffect(() => {
    const section = getSectionForPath(pathname);
    if (section) {
      setExpandedSections(prev => {
        if (prev.has(section)) return prev;
        return new Set([...prev, section]);
      });
    }
  }, [pathname]);

  // Close user menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    try {
      await session?.touch();
      router.refresh();
    } finally {
      setRefreshing(false);
      setUserMenuOpen(false);
    }
  };

  const activeAgentCount = aiAgents.filter(a => a.active).length;

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200",
      "bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]",
      collapsed ? "w-16" : "w-64"
    )}>

      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <Image src="/logo.png" alt="GateGuard Nexus" width={36} height={36} className="object-contain" priority />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-white tracking-wide">GateGuard</span>
            <p className="text-[10px] font-bold tracking-widest uppercase -mt-0.5" style={{ color: "#6B7EFF" }}>
              NEXUS
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={cn(
            "p-1 rounded text-[hsl(var(--sidebar-text))] hover:text-white transition-colors",
            collapsed && "mx-auto"
          )}
        >
          <ChevronRight size={13} className={cn("transition-transform", !collapsed && "rotate-180")} />
        </button>
      </div>

      {/* ── Company context pill ───────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-brand-400/5 border border-brand-400/15 flex items-center gap-2 shrink-0">
          <div className="w-6 h-6 rounded-full bg-brand-400/20 flex items-center justify-center text-[10px] font-bold text-brand-400 shrink-0">
            RF
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white truncate">Gate Guard, LLC</p>
            <p className="text-[10px] text-brand-400/80">System Operator (SO)</p>
          </div>
        </div>
      )}

      {/* ── AI Army ───────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-2 shrink-0">
          <button
            onClick={() => setArmyExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#6B7EFF" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#6B7EFF" }} />
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
              AI Army
            </span>
            <span className="ml-auto text-[10px] font-medium" style={{ color: "#6B7EFF" }}>
              {activeAgentCount}/8 active
            </span>
            <ChevronDown
              size={10}
              className="transition-transform shrink-0"
              style={{ color: "#6B7EFF", transform: armyExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
          {armyExpanded && (
            <div className="mt-1 space-y-0.5 pb-1">
              {aiAgents.map(agent => {
                const Wrapper = agent.href ? Link : ("div" as React.ElementType);
                return (
                  <Wrapper
                    key={agent.name}
                    {...(agent.href ? { href: agent.href } : {})}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded transition-colors",
                      agent.href && "hover:bg-white/5 cursor-pointer"
                    )}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: agent.active ? agent.color : "#334155" }}
                    >
                      {agent.name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-semibold text-white">{agent.name}</span>
                      <span className="text-[9px] text-[hsl(var(--sidebar-text))] ml-1">{agent.role}</span>
                    </div>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      agent.active ? "status-online" : "bg-zinc-600"
                    )} />
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Main nav (accordion) ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {NAV_SECTIONS.map(section => {
          const SectionIcon = section.icon;
          const isExpanded = expandedSections.has(section.key);
          const isSectionActive = getSectionForPath(pathname) === section.key;

          if (collapsed) {
            // Collapsed: show section icon only, no accordion
            return (
              <div key={section.key} className="relative group">
                <button
                  onClick={() => toggleSection(section.key)}
                  className={cn(
                    "w-full flex items-center justify-center p-2.5 rounded-lg transition-colors",
                    isSectionActive
                      ? "bg-brand-400/10 text-brand-400"
                      : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                  )}
                  title={section.label}
                >
                  <SectionIcon size={18} />
                </button>
              </div>
            );
          }

          return (
            <div key={section.key}>
              {/* Section header — clickable accordion trigger */}
              <button
                onClick={() => toggleSection(section.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group",
                  isSectionActive && !isExpanded
                    ? "bg-brand-400/10 text-brand-400"
                    : isExpanded
                    ? "bg-white/8 text-white"
                    : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                )}
              >
                <SectionIcon
                  size={16}
                  className="shrink-0"
                  style={section.color && !isSectionActive ? { color: section.color } : undefined}
                />
                <span className="flex-1 text-sm font-semibold">{section.label}</span>
                {isSectionActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: "#6B7EFF" }}
                  />
                )}
                <ChevronDown
                  size={13}
                  className={cn(
                    "transition-transform shrink-0 text-[hsl(var(--sidebar-text))]",
                    isExpanded && "rotate-180"
                  )}
                />
              </button>

              {/* Sub-items — accordion body */}
              {isExpanded && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5 pb-1">
                  {section.items.map(item => {
                    const Icon = item.icon;
                    const isActive = !item.external && (
                      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                    );
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        target={item.external ? "_blank" : undefined}
                        rel={item.external ? "noopener noreferrer" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all group/item",
                          isActive
                            ? "bg-brand-400/10 text-brand-400 border border-brand-400/20"
                            : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                        )}
                        title={item.description}
                      >
                        <Icon size={13} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white shrink-0"
                            style={{ background: item.badge === "AI" ? "#6B7EFF" : "#334155" }}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.external && (
                          <span className="text-[9px] text-[hsl(var(--sidebar-text))]/50 shrink-0">↗</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Live Integrations ─────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="px-2 pb-2 border-t border-[hsl(var(--sidebar-border))] pt-2 shrink-0">
          <button
            onClick={() => setIntegrationsExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
            <span className="text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-text))]/60 font-medium flex-1 text-left">
              Live Integrations
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">
              {integrations.filter(i => i.status === "connected").length}/{integrations.length}
            </span>
            <ChevronDown
              size={10}
              className={cn("transition-transform text-[hsl(var(--sidebar-text))]/50", integrationsExpanded && "rotate-180")}
            />
          </button>
          {integrationsExpanded && (
            <div className="mt-1 space-y-0.5 px-1">
              {integrations.map(int => (
                <div key={int.label} className="flex items-center gap-2 px-3 py-1.5">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    int.status === "connected" ? "status-online" : "status-warning"
                  )} />
                  <span className="text-[11px] text-[hsl(var(--sidebar-text))] flex-1">{int.label}</span>
                  <span className={cn(
                    "text-[10px] font-medium",
                    int.status === "connected" ? "text-emerald-400" : "text-amber-400"
                  )}>
                    {int.status === "connected" ? "Live" : "Setup"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── User menu ─────────────────────────────────────────────────────── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 relative shrink-0" ref={menuRef}>
        {userMenuOpen && !collapsed && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#1E293B] border border-[hsl(var(--sidebar-border))] rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-[hsl(var(--sidebar-border))]">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate mt-0.5">{displayEmail}</p>
            </div>
            <div className="py-1">
              <button
                onClick={() => { openUserProfile(); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5 transition-colors text-left"
              >
                <User size={14} className="shrink-0" /> My Account
              </button>
              <Link
                href="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings size={14} className="shrink-0" /> Settings
              </Link>
              <button
                onClick={handleRefreshSession}
                disabled={refreshing}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5 transition-colors text-left disabled:opacity-50"
              >
                <RefreshCw size={14} className={cn("shrink-0", refreshing && "animate-spin")} />
                {refreshing ? "Refreshing…" : "Refresh Session"}
              </button>
            </div>
            <div className="border-t border-[hsl(var(--sidebar-border))] py-1">
              <button
                onClick={() => signOut({ redirectUrl: "/sign-in" })}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors text-left"
              >
                <LogOut size={14} className="shrink-0" /> Sign Out
              </button>
            </div>
          </div>
        )}
        <button
          onClick={() => setUserMenuOpen(o => !o)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors",
            collapsed && "justify-center",
            userMenuOpen && "bg-white/5"
          )}
        >
          <div className="w-7 h-7 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center text-[11px] font-bold text-brand-400 shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium text-white truncate">{displayName}</p>
                <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate">{displayEmail}</p>
              </div>
              <ChevronDown
                size={11}
                className={cn(
                  "text-[hsl(var(--sidebar-text))] transition-transform shrink-0",
                  userMenuOpen && "rotate-180"
                )}
              />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
