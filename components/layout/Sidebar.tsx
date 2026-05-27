"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Camera, Shield, FileText,
  Wrench, CreditCard, Settings, ChevronRight, ChevronDown,
  Radio, MessageSquare, Bell, Phone, Calendar,
  Network, Truck, Package, Repeat, TrendingUp,
  Globe, ClipboardList, Headphones, FileCheck,
  Megaphone, Map, BookOpen, Tv, Zap,
  Layers, Server, UserCheck, ShieldCheck, Star,
  GraduationCap, Crosshair, Activity,
  User, RefreshCw, Wrench as TechIcon,
  ClipboardCheck, Building2, DollarSign,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowRightLeft, UserCog, LogOut, CheckSquare, CalendarDays, FolderOpen, AlertOctagon, BarChart3: BarChart3Icon, Tv: Satellite, Flame, Hash, Ruler, PenTool, MousePointer, FileSignature, HardHat, Trophy } = require("lucide-react") as any;
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
  description?: string;
};

type NavSection = {
  key: string;
  label: string;
  icon: React.ElementType;
  color?: string;
  items: NavItem[];
  directLink?: boolean;
};

// ─── Navigation Architecture ──────────────────────────────────────────────────
// 8 primary sections matching the sketch: Dashboard · Operations · Field & Tech
// Security · Dealer Network · Intelligence · Money · Settings

const NAV_SECTIONS: NavSection[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    directLink: true,
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard, description: "Command center — KPIs, alerts, activity" },
    ],
  },
  {
    key: "sales",
    label: "Sales & Marketing",
    icon: TrendingUp,
    color: "#059669",
    items: [
      { label: "CRM",                 href: "/crm",       icon: MessageSquare,  description: "Leads, opportunities, pipeline" },
      { label: "Quotes",              href: "/quotes",    icon: FileText,       description: "Proposals and approvals" },
      { label: "Site Survey",         href: "/survey",    icon: ClipboardCheck, description: "Site walk and proposal builder" },
      { label: "Service Marketplace", href: "/services",  icon: Package,        description: "TV, internet, video monitoring & more", badge: "New" },
      { label: "Reps & Commissions",  href: "/reps",      icon: UserCheck,      description: "Rep hierarchy and payouts" },
      { label: "Marketing Hub",       href: "/marketing", icon: Megaphone,      description: "Campaigns and content" },
    ],
  },
  {
    key: "business",
    label: "Business",
    icon: Building2,
    items: [
      { label: "Operating System", href: "/eos",      icon: Layers,    description: "EOS — Rocks, Scorecard, L10" },
      { label: "Customers",        href: "/customers", icon: Users,     description: "All customer accounts" },
      { label: "Properties",       href: "/sites",     icon: Building2, description: "Installed sites and assets" },
      { label: "Billing",          href: "/billing",   icon: CreditCard,description: "Invoices and payments" },
      { label: "Expenses",         href: "/expenses",  icon: DollarSign,description: "Expense tracking" },
      { label: "Revenue",          href: "/revenue",   icon: TrendingUp,description: "MRR/ARR dashboard" },
    ],
  },
  {
    key: "documents",
    label: "Documents",
    icon: FileText,
    items: [
      { label: "Contracts",         href: "/contracts",         icon: FileCheck,   description: "Contract storage" },
      { label: "Renewals",          href: "/renewals",          icon: Repeat,      description: "Contract renewals and alerts" },
      { label: "Vendor Compliance", href: "/vendor-compliance", icon: ShieldCheck, description: "Vendor permits, certs, expiry alerts" },
    ],
  },
  {
    key: "field",
    label: "Field & Tech",
    icon: TechIcon,
    items: [
      { label: "Incidents",       href: "/incidents",      icon: AlertOctagon, description: "Gate failures, security events" },
      { label: "Tech Tool",       href: "/tech",           icon: Zap,          description: "AI field diagnostic tool", badge: "AI" },
      { label: "Knowledge Base",  href: "/kb",             icon: BookOpen,     description: "Articles and manuals" },
      { label: "Products",        href: "/products",       icon: Package,      description: "Equipment catalog" },
      { label: "Work Orders",     href: "/maintenance",    icon: Wrench,       description: "Work orders and service history" },
      { label: "Dispatch",        href: "/dispatch",       icon: Truck,        description: "Tech scheduling and job board" },
      { label: "Inventory",       href: "/inventory",      icon: Package,      description: "Parts, stock, and POs" },
      { label: "Sub-Contractors", href: "/subcontractors", icon: Users,        description: "Manage subcontractors, compliance & WO access" },
    ],
  },
  {
    key: "design",
    label: "Design",
    icon: Layers,
    color: "#0891B2",
    items: [
      { label: "Floor Plans",   href: "/design/floor-plans", icon: FileText,  description: "Place devices on blueprints" },
      { label: "System Design", href: "/design/system",      icon: Zap,       description: "I/O schematics + wiring" },
      { label: "As-Builts",     href: "/design/as-builts",   icon: FileCheck, description: "Auto-generate install docs" },
      { label: "E-Sign",        href: "/design/esign",       icon: FileCheck, description: "Legal document signatures" },
    ],
  },
  {
    key: "systems",
    label: "Systems",
    icon: Shield,
    color: "#0B7285",
    items: [
      { label: "Cameras",        href: "/cameras",          icon: Camera,  description: "Eagle Eye live feeds and clips" },
      { label: "Access Control", href: "/access",           icon: Shield,  description: "Brivo credentials and logs" },
      { label: "Networks",       href: "/network",          icon: Server,  description: "UniFi infrastructure and VLANs" },
      { label: "SOC",            href: "https://ggsoc.com", icon: Radio,   external: true, description: "Live call center (ggsoc.com)" },
    ],
  },
  {
    key: "dealer",
    label: "Dealer Network",
    icon: UserCheck,
    color: "#7C3AED",
    items: [
      { label: "Dealers",         href: "/admin/dealers",          icon: Users,         description: "Onboard and manage dealer orgs", badge: "Admin" },
      { label: "Platform Users",  href: "/admin/users",            icon: Shield,        description: "Set module permissions per user", badge: "Admin" },
      { label: "Feature Settings",href: "/admin/settings/features",icon: Settings,      description: "Global tier defaults + Stripe hooks", badge: "Admin" },
      { label: "Compliance",    href: "/compliance",        icon: ShieldCheck,   description: "Permits, certs, expiry alerts" },
      { label: "Territory Map", href: "/map",               icon: Map,           description: "Property pins by health status" },
      { label: "Scorecard",     href: "/scorecard",         icon: Star,          description: "Dealer performance metrics" },
      { label: "Quests",        href: "/quests",            icon: Trophy,        description: "Time-boxed challenges and tier points", badge: "New" },
      { label: "Reviews",       href: "/reviews",           icon: Star,          description: "Post-WO ratings and Google reviews" },
      { label: "Training",      href: "/training",          icon: GraduationCap, description: "Courses and certifications" },
      { label: "Dealer Sites",  href: "/marketing/website", icon: Globe,         description: "Hosted dealer landing pages" },
    ],
  },
  {
    key: "internal",
    label: "Internal",
    icon: Globe,
    color: "#6B7EFF",
    items: [
      { label: "Playbooks",        href: "/playbooks",      icon: BookOpen, description: "Internal playbooks and SOPs" },
      { label: "Co-Op Pool",       href: "/marketing/coop", icon: Users,    description: "Shared lead pool" },
      { label: "Customer Portals", href: "/portal",         icon: Globe,    description: "Property manager view" },
    ],
  },
];

const aiAgents = [
  { name: "ARIA",    role: "Lead Intel",     color: "#6B7EFF", active: true,  href: "/aria",       featureKey: "ai.aria"    },
  { name: "TRINITY", role: "Voice",          color: "#0B7285", active: true,  href: "/trinity",    featureKey: "ai.trinity" },
  { name: "SCOUT",   role: "Market",         color: "#7C3AED", active: true,  href: "/scout",      featureKey: "ai.scout"   },
  { name: "BEACON",  role: "Client Comms",   color: "#B45309", active: false, href: "/beacon",     featureKey: "ai.beacon"  },
  { name: "FORGE",   role: "Quote Builder",  color: "#0B7285", active: true,  href: "/quotes/new", featureKey: "ai.forge"   },
  { name: "ATLAS",   role: "DirecTV",        color: "#3B5BDB", active: true,  href: "/directv",    featureKey: "ai.atlas"   },
  { name: "SAGE",    role: "Training",       color: "#15803D", active: false, href: "/training",   featureKey: "ai.sage"    },
  { name: "RELAY",   role: "Tier-1 Support", color: "#6B7EFF", active: false, href: "/relay",      featureKey: "ai.relay"   },
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
  const [socialExpanded, setSocialExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeSection = getSectionForPath(pathname);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = activeSection && activeSection !== "dashboard" ? activeSection : "sales";
    return new Set([initial]);
  });

  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { session } = useSession();

  const displayName  = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Russel Feldman";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "rfeldman@gateguard.co";
  const initials     = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "RF";

  // ─── Tier visibility ────────────────────────────────────────────────────────
  const orgTier             = (user?.publicMetadata?.org_tier as string | undefined) ?? "corporate";
  const isCorporate         = orgTier === "corporate";
  const isMasterAgent       = orgTier === "master_agent";
  const isMasterDealer      = orgTier === "master_dealer";
  const isFullDealer        = orgTier === "full_dealer";
  const isServiceDealer     = orgTier === "service_dealer";
  const isInstallContractor = orgTier === "install_contractor";
  const isSalesPartner      = orgTier === "sales_partner";
  const clerkRole           = (user?.publicMetadata?.role as string | undefined) ?? "admin";
  const isAdminRole         = ["admin", "supervisor"].includes(clerkRole);

  const showAdmin        = isCorporate;
  const showOperations   = isCorporate || isMasterDealer || isFullDealer || isSalesPartner || isMasterAgent;
  const showFieldFull    = isCorporate || isMasterDealer || isFullDealer;
  const showWOs          = isCorporate || isMasterDealer || isFullDealer || isServiceDealer || isInstallContractor;
  const showSites        = isCorporate || isMasterDealer || isFullDealer || isServiceDealer;
  const showDispatch     = isCorporate || isMasterDealer || isFullDealer;
  const showCRM          = isCorporate || isMasterDealer || isFullDealer || isSalesPartner;
  const showQuotes       = isCorporate || isMasterDealer || isFullDealer || isSalesPartner;
  const showCommissions  = isCorporate || isMasterAgent || isMasterDealer || isFullDealer || isSalesPartner || isServiceDealer;
  const showNetwork      = isCorporate || isMasterAgent || isMasterDealer || isFullDealer;
  const showFinancials   = isCorporate || isMasterAgent || isMasterDealer || isFullDealer || isAdminRole;
  const showCompliance   = isCorporate || isMasterDealer || isFullDealer || isServiceDealer;
  const showSecurity     = isCorporate || isMasterDealer || isFullDealer;
  const showIntelligence = isCorporate || isMasterDealer || isFullDealer || isMasterAgent;
  const showDesign       = isCorporate || isMasterDealer || isFullDealer || isInstallContractor || isServiceDealer;

  // ─── Feature flag filtering ─────────────────────────────────────────────
  const [featureFlags, setFeatureFlags] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch("/api/user-features/me");
        const data = await res.json();
        setFeatureFlags(data.features ?? {});
      } catch (_) { /* silently skip — show all items if unavailable */ }
    })();
  }, []);

  // href → feature key lookup (derived from feature_catalog seed)
  const HREF_TO_FEATURE: Record<string, string> = {
    "/":                       "dashboard",
    "/crm":                    "sales.crm",
    "/quotes":                 "sales.quotes",
    "/survey":                 "sales.survey",
    "/services":               "sales.services",
    "/reps":                   "sales.reps",
    "/marketing":              "sales.marketing",
    "/eos":                    "business.eos",
    "/customers":              "business.customers",
    "/sites":                  "business.properties",
    "/billing":                "business.billing",
    "/expenses":               "business.expenses",
    "/revenue":                "business.revenue",
    "/contracts":              "documents.contracts",
    "/renewals":               "documents.renewals",
    "/vendor-compliance":      "documents.vendor_compliance",
    "/incidents":              "field.incidents",
    "/tech":                   "field.tech_tool",
    "/kb":                     "field.kb",
    "/products":               "field.products",
    "/maintenance":            "field.work_orders",
    "/dispatch":               "field.dispatch",
    "/inventory":              "field.inventory",
    "/subcontractors":         "field.subcontractors",
    "/design/floor-plans":     "design.floor_plans",
    "/design/system":          "design.system_design",
    "/design/as-builts":       "design.as_builts",
    "/design/esign":           "design.esign",
    "/cameras":                "systems.cameras",
    "/access":                 "systems.access_control",
    "/network":                "systems.networks",
    "https://ggsoc.com":       "systems.soc",
    "/admin/dealers":               "dealer.dealers",
    "/admin/users":                 "dealer.platform_users",
    "/admin/settings/features":     "dealer.feature_settings",
    "/compliance":             "dealer.compliance",
    "/map":                    "dealer.territory_map",
    "/scorecard":              "dealer.scorecard",
    "/quests":                 "dealer.quests",
    "/reviews":                "dealer.reviews",
    "/training":               "dealer.training",
    "/marketing/website":      "dealer.dealer_sites",
    "/playbooks":              "internal.playbooks",
    "/marketing/coop":         "internal.coop",
    "/portal":                 "internal.portals",
    // AI Agents
    "/aria":                   "ai.aria",
    "/trinity":                "ai.trinity",
    "/scout":                  "ai.scout",
    "/beacon":                 "ai.beacon",
    "/quotes/new":             "ai.forge",
    "/directv":                "ai.atlas",
    "/relay":                  "ai.relay",
  };

  const isFeatureVisible = (href: string): boolean => {
    const key = HREF_TO_FEATURE[href];
    if (!key) return true; // no flag → show by default
    if (Object.keys(featureFlags).length === 0) return true; // not loaded yet → show all
    const level = featureFlags[key];
    if (!level) return true; // feature not in catalog → show
    return level !== "none"; // hide only if explicitly none
  };

  const activeAgentCount = aiAgents.filter(a => a.active).length;

  // Org display info
  const orgName    = (user?.publicMetadata?.org_name as string | undefined) ?? "GateGuard, LLC";
  const parentOrg  = (user?.publicMetadata?.parent_org as string | undefined) ?? "GateGuard Corp";
  const tierLabel: Record<string, string> = {
    corporate: "System Operator", master_agent: "Master Agent",
    master_dealer: "MSO", full_dealer: "Dealer",
    service_dealer: "Service Partner", install_contractor: "Install Partner",
    sales_partner: "Sales Partner", client: "Client",
  };

  useEffect(() => {
    const section = getSectionForPath(pathname);
    if (section) {
      setExpandedSections(prev => prev.has(section) ? prev : new Set([...prev, section]));
    }
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    try { await session?.touch(); router.refresh(); }
    finally { setRefreshing(false); setUserMenuOpen(false); }
  };

  return (
    <aside
      className={cn(
        "h-screen flex flex-col shrink-0 z-40 transition-all duration-200",
        "border-r border-[hsl(var(--sidebar-border))]",
        collapsed ? "w-16" : "w-64"
      )}
      style={{
        background: "radial-gradient(ellipse at 50% 68%, #0d2150 0%, #060e28 38%, #020810 68%, #000306 100%)",
      }}
    >

      {/* ── Logo + collapse toggle ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="w-8 h-8 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <Image src="/logo.png" alt="GateGuard" width={32} height={32} className="object-contain" priority />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-base font-black tracking-[0.12em] uppercase leading-none" style={{ color: "#6B7EFF" }}>NEXUS</span>
            <p className="text-[9px] font-semibold tracking-[0.18em] uppercase -mt-0.5 text-white/50">by GateGuard</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className={cn("p-1 rounded text-[hsl(var(--sidebar-text))] hover:text-white transition-colors", collapsed && "mx-auto")}
        >
          <ChevronRight size={12} className={cn("transition-transform", !collapsed && "rotate-180")} />
        </button>
      </div>

      {/* ── Org context strip ─────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-2.5 px-3 py-2 rounded-xl bg-white/4 border border-white/8 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center text-[10px] font-bold text-brand-400 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-bold text-white truncate">{orgName}</p>
                <span className="text-[8px] px-1 py-0.5 rounded bg-brand-400/15 text-brand-400 font-bold uppercase tracking-wide shrink-0">Org</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate">{parentOrg}</p>
                <span className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-white/40 font-medium shrink-0">{tierLabel[orgTier] ?? orgTier}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick-action icon strip: Bell · Calendar · To-Dos ─────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-2 flex items-center gap-1 shrink-0">
          <Link
            href="/alerts"
            title="Alerts"
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors group",
              pathname.startsWith("/alerts")
                ? "bg-brand-400/20 text-brand-400"
                : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
            )}
          >
            <Bell size={14} />
            <span className="text-[8px] font-semibold uppercase tracking-wide">Alerts</span>
          </Link>
          <Link
            href="/calendar"
            title="Calendar"
            className={cn(
              "flex items-center justify-center p-2.5 rounded-lg transition-colors",
              pathname.startsWith("/calendar")
                ? "bg-brand-400/20 text-brand-400"
                : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
            )}
          >
            <CalendarDays size={14} />
          </Link>
          <Link
            href="/todos"
            title="To-Dos"
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors group",
              pathname.startsWith("/todos")
                ? "bg-brand-400/20 text-brand-400"
                : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
            )}
          >
            <CheckSquare size={14} />
            <span className="text-[8px] font-semibold uppercase tracking-wide">To-Dos</span>
          </Link>
        </div>
      )}

      {/* ── AI ARMY ───────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-2 shrink-0">
          <button
            onClick={() => setArmyExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {/* Pulsing live dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#6B7EFF" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#6B7EFF" }} />
            </span>
            <span className="text-[10px] font-black tracking-[0.15em] uppercase" style={{ color: "#6B7EFF" }}>
              AI Army
            </span>
            <span className="ml-auto text-[10px] font-semibold" style={{ color: "#6B7EFF" }}>
              {activeAgentCount}/8
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
                // Feature flag gate for AI agents
                if (agent.featureKey && Object.keys(featureFlags).length > 0 && featureFlags[agent.featureKey] === "none") return null;
                const Wrapper = agent.href ? Link : ("div" as React.ElementType);
                return (
                  <Wrapper
                    key={agent.name}
                    {...(agent.href ? { href: agent.href } : {})}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1 rounded transition-colors",
                      agent.href && "hover:bg-white/5 cursor-pointer"
                    )}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-black text-white shrink-0"
                      style={{ background: agent.active ? agent.color : "#334155" }}
                    >
                      {agent.name.slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-white">{agent.name}</span>
                      <span className="text-[9px] text-[hsl(var(--sidebar-text))] ml-1">{agent.role}</span>
                    </div>
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0",
                      agent.active ? "bg-emerald-400" : "bg-zinc-600"
                    )} />
                  </Wrapper>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Admin quick-links (corporate only) ───────────────────────────── */}
      {!collapsed && showAdmin && (
        <div className="mx-3 mt-2 shrink-0">
          <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-white/30 px-1 mb-1">Access Control</p>
          <div className="flex gap-1">
            <Link
              href="/admin/settings/features"
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors text-center",
                pathname.startsWith("/admin/settings/features")
                  ? "bg-brand-400/20 text-brand-400"
                  : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
              )}
              title="Feature Settings — Global tier defaults"
            >
              <Settings size={13} />
              <span className="text-[8px] font-semibold leading-tight">Features</span>
            </Link>
            <Link
              href="/admin/dealers"
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors text-center",
                pathname.startsWith("/admin/dealers")
                  ? "bg-brand-400/20 text-brand-400"
                  : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
              )}
              title="Dealers — Per-org feature overrides"
            >
              <Users size={13} />
              <span className="text-[8px] font-semibold leading-tight">Dealers</span>
            </Link>
            <Link
              href="/admin/users"
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors text-center",
                pathname.startsWith("/admin/users")
                  ? "bg-brand-400/20 text-brand-400"
                  : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
              )}
              title="Platform Users — Per-user feature access"
            >
              <UserCheck size={13} />
              <span className="text-[8px] font-semibold leading-tight">Users</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-3 mt-2 border-t border-white/8 shrink-0" />
      )}

      {/* ── Main nav (8 sections) ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {NAV_SECTIONS.map(section => {
          // Section-level tier gates
          if (section.key === "sales"     && !showCRM && !showQuotes)          return null;
          if (section.key === "business"  && !showSites && !showFinancials)    return null;
          if (section.key === "documents" && !showFinancials)                  return null;
          if (section.key === "design"    && !showDesign)                      return null;
          if (section.key === "systems"   && !showSecurity)                    return null;
          if (section.key === "dealer"    && !showNetwork)                     return null;
          if (section.key === "internal"  && !isCorporate)                     return null;
          // Install contractor: hide sales-heavy, dealer, and internal sections
          if (isInstallContractor && section.key === "sales")     return null;
          if (isInstallContractor && section.key === "dealer")    return null;
          if (isInstallContractor && section.key === "internal")  return null;

          const SectionIcon = section.icon;
          const isExpanded      = expandedSections.has(section.key);
          const isSectionActive = getSectionForPath(pathname) === section.key ||
            (section.directLink && section.items[0] && (
              section.items[0].href === "/" ? pathname === "/" : pathname.startsWith(section.items[0].href)
            ));

          // Collapsed mode — icon only
          if (collapsed) {
            const href = section.directLink ? section.items[0]?.href : undefined;
            const W = href ? Link : ("button" as React.ElementType);
            return (
              <div key={section.key} className="relative group">
                <W
                  {...(href ? { href } : { onClick: () => toggleSection(section.key) })}
                  className={cn(
                    "w-full flex items-center justify-center p-2.5 rounded-lg transition-colors cursor-pointer",
                    isSectionActive
                      ? "bg-brand-400/20 text-brand-400"
                      : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                  )}
                  title={section.label}
                >
                  <SectionIcon size={17} />
                </W>
              </div>
            );
          }

          // Direct-link section (Dashboard)
          if (section.directLink && section.items[0]) {
            return (
              <div key={section.key}>
                <Link
                  href={section.items[0].href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-sm font-semibold",
                    isSectionActive
                      ? "bg-brand-400/20 text-white border border-brand-400/30"
                      : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                  )}
                >
                  <SectionIcon size={15} className={cn("shrink-0", isSectionActive && "text-brand-400")} />
                  <span className="flex-1">{section.label}</span>
                  {isSectionActive && (
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6B7EFF", boxShadow: "0 0 5px #6B7EFF" }} />
                  )}
                </Link>
              </div>
            );
          }

          return (
            <div key={section.key}>
              <button
                onClick={() => toggleSection(section.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left",
                  isSectionActive && !isExpanded
                    ? "bg-brand-400/20 text-white"
                    : isExpanded
                    ? "bg-white/5 text-white"
                    : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                )}
              >
                <SectionIcon
                  size={15}
                  className="shrink-0"
                  style={section.color && !isSectionActive ? { color: section.color } : undefined}
                />
                <span className="flex-1 text-sm font-semibold">{section.label}</span>
                {isSectionActive && !isExpanded && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6B7EFF" }} />
                )}
                <ChevronDown
                  size={12}
                  className={cn("transition-transform shrink-0 text-[hsl(var(--sidebar-text))]", isExpanded && "rotate-180")}
                />
              </button>

              {isExpanded && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-white/8 space-y-0.5 pb-1">
                  {section.items.map(item => {
                    // Item-level tier gates
                    if (item.href === "/subcontractors"   && !isInstallContractor && !isCorporate && !isMasterDealer && !isFullDealer) return null;
                    if (item.href === "/crm"              && !showCRM)        return null;
                    if (item.href === "/customers"        && !showOperations) return null;
                    if (item.href === "/quotes"           && !showQuotes)     return null;
                    if (item.href === "/billing"          && !showFinancials) return null;
                    if (item.href === "/expenses"         && !showFinancials) return null;
                    if (item.href === "/renewals"         && !showFinancials) return null;
                    if (item.href === "/revenue"          && !showFinancials) return null;
                    if (item.href === "/contracts"        && !showFinancials) return null;
                    if (item.href === "/reps"             && !showCommissions)return null;
                    if (item.href === "/sites"            && !showSites)      return null;
                    if (item.href === "/maintenance"      && !showWOs)        return null;
                    if (item.href === "/dispatch"         && !showDispatch)   return null;
                    if (item.href === "/inventory"        && !showFieldFull)  return null;
                    if (item.href === "/survey"           && !showFieldFull)  return null;
                    if (item.href === "/admin/dealers"    && !showAdmin)      return null;
                    if (item.href === "/compliance"       && !showCompliance) return null;
                    if (item.href === "/vendor-compliance"&& !showCompliance) return null;
                    if (item.href === "/scorecard"        && !showNetwork)    return null;
                    if (item.href === "/training"         && !showNetwork)    return null;
                    if (item.href === "/admin"            && !showAdmin)      return null;
                    if (item.href === "/admin/users"      && !showAdmin)      return null;
                    if (item.href === "/playbooks"        && !isCorporate)    return null;
                    if (item.href === "/admin/settings/features" && !showAdmin) return null;
                    // Feature flag gate: hide items the org/user has no access to
                    if (!isFeatureVisible(item.href)) return null;

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
                          "flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                          isActive
                            ? "bg-brand-400/20 text-white border border-brand-400/25"
                            : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                        )}
                        title={item.description}
                      >
                        <Icon size={12} className="shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className="text-[8px] px-1.5 py-0.5 rounded-full font-bold text-white shrink-0"
                            style={{ background: item.badge === "AI" ? "#6B7EFF" : "#334155" }}
                          >
                            {item.badge}
                          </span>
                        )}
                        {item.external && <span className="text-[9px] opacity-40 shrink-0">↗</span>}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Comms & Social ────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="mx-2 border-t border-[hsl(var(--sidebar-border))] pt-2 pb-1 shrink-0">
          <button
            onClick={() => setSocialExpanded(v => !v)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <span className="text-[9px] uppercase tracking-[0.15em] text-[hsl(var(--sidebar-text))]/60 font-bold flex-1 text-left">
              Comms &amp; Social
            </span>
            <ChevronDown
              size={9}
              className={cn("transition-transform text-[hsl(var(--sidebar-text))]/40", socialExpanded && "rotate-180")}
            />
          </button>
          {socialExpanded && (
            <div className="mt-1 space-y-0.5 px-1">
              <Link
                href="/messages"
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  pathname.startsWith("/messages")
                    ? "bg-brand-400/20 text-white border border-brand-400/25"
                    : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                )}
              >
                <Hash size={12} className="shrink-0" />
                <span>Messages</span>
                <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-bold text-white shrink-0" style={{ background: "#334155" }}>New</span>
              </Link>
              <Link
                href="/pwa/messenger"
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  pathname.startsWith("/pwa/messenger")
                    ? "bg-brand-400/20 text-white border border-brand-400/25"
                    : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                )}
              >
                <MessageSquare size={12} className="shrink-0" />
                <span>Messenger PWA</span>
              </Link>
              <Link
                href="/feed"
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  pathname.startsWith("/feed")
                    ? "bg-brand-400/20 text-white border border-brand-400/25"
                    : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                )}
              >
                <Flame size={12} className="shrink-0" />
                <span>The Feed</span>
                <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded-full font-bold text-white shrink-0" style={{ background: "#334155" }}>New</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── User profile (bottom) ─────────────────────────────────────────── */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 relative shrink-0" ref={menuRef}>
        {/* Flyup menu */}
        {userMenuOpen && !collapsed && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#1E293B] border border-[hsl(var(--sidebar-border))] rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-[hsl(var(--sidebar-border))]">
              <p className="text-xs font-bold text-white truncate">{displayName}</p>
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

        {/* Avatar button */}
        <button
          onClick={() => setUserMenuOpen(o => !o)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors",
            collapsed && "justify-center",
            userMenuOpen && "bg-white/5"
          )}
        >
          {/* Avatar — uses photo if available, initials as fallback */}
          {user?.imageUrl ? (
            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-brand-400/30">
              <Image src={user.imageUrl} alt={displayName} width={32} height={32} className="object-cover w-full h-full" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center text-[11px] font-bold text-brand-400 shrink-0">
              {initials}
            </div>
          )}
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate">{displayEmail}</p>
              </div>
              <ChevronDown
                size={10}
                className={cn("text-[hsl(var(--sidebar-text))] transition-transform shrink-0", userMenuOpen && "rotate-180")}
              />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
