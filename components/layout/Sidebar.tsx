"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, Camera, Shield, FileText,
  Wrench, CreditCard, Settings, ChevronRight,
  Radio, MessageSquare, BarChart3, ChevronDown,
  Network, Truck, Package, Repeat, TrendingUp,
  Globe, ClipboardList, Headphones, FileCheck,
  Megaphone, Map, BookOpen, Tv, Zap,
  Layers, Server, UserCheck, ShieldCheck, Star, ClipboardCheck,
  GraduationCap, Tv as Satellite, Crosshair,
  User, RefreshCw,
} from "lucide-react";
// Icons not in the type declarations for lucide-react 0.383.0 but available at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ArrowRightLeft, UserCog, LogOut } = require("lucide-react") as any;
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { useUser, useClerk, useSession } from "@clerk/nextjs";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  external?: boolean;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard",      href: "/",             icon: LayoutDashboard },
      { label: "Customers",      href: "/customers",    icon: Users           },
      { label: "CRM",            href: "/crm",          icon: MessageSquare   },
      { label: "Organizations",  href: "/admin",        icon: Network         },
      { label: "User Management", href: "/admin/users", icon: UserCog         },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "Cameras",        href: "/cameras",      icon: Camera          },
      { label: "Access Control", href: "/access",       icon: Shield          },
      { label: "SOC",            href: "https://ggsoc.com", icon: Radio, external: true },
    ],
  },
  {
    label: "Revenue",
    items: [
      { label: "Quotes",         href: "/quotes",       icon: FileText        },
      { label: "Billing",        href: "/billing",      icon: CreditCard      },
      { label: "Renewals",       href: "/renewals",     icon: Repeat          },
      { label: "Revenue",        href: "/revenue",      icon: TrendingUp      },
      { label: "Contracts",      href: "/contracts",    icon: FileCheck       },
    ],
  },
  {
    label: "Field",
    items: [
      { label: "Maintenance",    href: "/maintenance",  icon: Wrench          },
      { label: "Dispatch",       href: "/dispatch",     icon: Truck           },
      { label: "Inventory",      href: "/inventory",    icon: Package         },
      { label: "Reports",        href: "/reports",      icon: BarChart3       },
    ],
  },
  {
    label: "Dealer Network",
    items: [
      { label: "Reps & Commissions",      href: "/reps",       icon: UserCheck    },
      { label: "Compliance",              href: "/compliance", icon: ShieldCheck  },
      { label: "Territory Map",           href: "/map",        icon: Map          },
      { label: "Scorecard",               href: "/scorecard",  icon: Star         },
      { label: "Training & Certification",href: "/training",   icon: GraduationCap},
    ],
  },
  {
    label: "DirecTV Channel",
    items: [
      { label: "ATLAS Dashboard", href: "/directv",    icon: Satellite      },
      { label: "New Order",       href: "/orders/new", icon: Zap            },
      { label: "SARA Bridge",     href: "/migrate",    icon: ArrowRightLeft },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "Onboarding",       href: "/onboarding",    icon: ClipboardList  },
      { label: "Communications",   href: "/communications", icon: Headphones    },
      { label: "Customer Portal",  href: "/portal",        icon: Globe          },
      { label: "Site Survey",      href: "/survey",        icon: ClipboardCheck },
      { label: "Knowledge Base",   href: "/kb",            icon: BookOpen       },
      { label: "Community Channel",href: "/channel",       icon: Tv             },
      { label: "Visitor Mgmt",     href: "/visitor",       icon: Users          },
      { label: "Product Catalog",  href: "/products",      icon: Layers         },
      { label: "Energy",           href: "/energy",        icon: Zap            },
      { label: "Network Infra",    href: "/network",       icon: Server         },
      { label: "Delivery Hub",     href: "/deliveries",    icon: Package        },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "Marketing Hub", href: "/marketing", icon: Megaphone },
      { label: "ARIA — Lead Intel", href: "/aria", icon: Crosshair, badge: "AI" },
    ],
  },
];

const integrations = [
  { label: "EagleEye",   status: "connected" as const },
  { label: "Brivo",      status: "connected" as const },
  { label: "DirecTV",    status: "connected" as const },
  { label: "QuickBooks", status: "pending"   as const },
  { label: "Twilio",     status: "pending"   as const },
];

// ── AI ARMY ─────────────────────────────────────────────────────────────────
const aiAgents = [
  { name: "ARIA",   role: "Lead Intel",    color: "#6B7EFF", active: true  },
  { name: "TRINITY", role: "Voice",         color: "#0B7285", active: true  },
  { name: "SCOUT",  role: "Market",        color: "#7C3AED", active: true  },
  { name: "BEACON", role: "Client Comms",  color: "#B45309", active: false },
  { name: "FORGE",  role: "Quote Builder", color: "#0B7285", active: true  },
  { name: "ATLAS",  role: "DirecTV",       color: "#3B5BDB", active: true  },
  { name: "SAGE",   role: "Training",      color: "#15803D", active: false },
  { name: "RELAY",  role: "Tier-1 Support",color: "#6B7EFF", active: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [armyExpanded, setArmyExpanded] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  const { session } = useSession();

  const displayName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "Russel Feldman";
  const displayEmail = user?.primaryEmailAddress?.emailAddress ?? "rfeldman@gateguard.co";
  const initials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || "RF";

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const handleRefreshSession = async () => {
    setRefreshing(true);
    try {
      // Force Clerk to refresh the session token — fixes stale JWT on page loads
      await session?.touch();
      // Hard reload the current page so the new token is used immediately
      router.refresh();
    } finally {
      setRefreshing(false);
      setUserMenuOpen(false);
    }
  };

  const activeCount = aiAgents.filter(a => a.active).length;

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200",
      "bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo — Nexus branding */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <Image src="/logo.png" alt="GateGuard Nexus" width={36} height={36} className="object-contain" priority />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-white tracking-wide">GateGuard</span>
            <p className="text-[10px] text-brand-400/80 -mt-0.5 font-bold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
              NEXUS
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn("p-1 rounded text-[hsl(var(--sidebar-text))] hover:text-white transition-colors", collapsed && "mx-auto")}
        >
          <ChevronRight size={13} className={cn("transition-transform", !collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Role context pill */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-brand-400/5 border border-brand-400/15 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-400/20 flex items-center justify-center text-[10px] font-bold text-brand-400">RF</div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-white truncate">Gate Guard, LLC</p>
            <p className="text-[10px] text-brand-400/80">System Operator (SO)</p>
          </div>
          <ChevronDown size={11} className="text-[hsl(var(--sidebar-text))]" />
        </div>
      )}

      {/* AI Army panel */}
      {!collapsed && (
        <div className="mx-3 mt-2">
          <button
            onClick={() => setArmyExpanded(!armyExpanded)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            {/* pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#6B7EFF" }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#6B7EFF" }} />
            </span>
            <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#6B7EFF" }}>
              AI Army
            </span>
            <span className="ml-auto text-[10px] font-medium" style={{ color: "#6B7EFF" }}>
              {activeCount}/8 active
            </span>
            <ChevronDown
              size={10}
              className="transition-transform shrink-0"
              style={{ color: "#6B7EFF", transform: armyExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>

          {armyExpanded && (
            <div className="mt-1 space-y-0.5 pb-1">
              {aiAgents.map((agent) => {
                const agentHref = agent.name === "ARIA" ? "/aria" : null;
                const Wrapper = agentHref ? Link : "div" as any;
                return (
                  <Wrapper
                    key={agent.name}
                    {...(agentHref ? { href: agentHref } : {})}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded transition-colors",
                      agentHref ? "hover:bg-white/5 cursor-pointer" : ""
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

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-text))]/50 px-3 mb-1.5 font-medium">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isExternal = item.external;
                const isActive = !isExternal && (item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href));
                const isSoon = item.badge === "Soon";
                // Highlight DirecTV Channel items specially
                const isDTV = item.href === "/directv" || item.href === "/migrate";
                return (
                  <Link
                    key={item.href}
                    href={isSoon ? "#" : item.href}
                    target={isExternal ? "_blank" : undefined}
                    rel={isExternal ? "noopener noreferrer" : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative",
                      isActive
                        ? "bg-brand-400/10 text-brand-400 border border-brand-400/20"
                        : isSoon
                        ? "text-[hsl(var(--sidebar-text))]/40 cursor-not-allowed"
                        : isDTV && !isActive
                        ? "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5"
                        : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon
                      size={16}
                      className="shrink-0"
                      style={isDTV && !isActive ? { color: "#3B5BDB" } : undefined}
                    />
                    {!collapsed && (
                      <>
                        <span className="flex-1" style={isDTV && !isActive ? { color: "#93C5FD" } : undefined}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide",
                            item.badge === "Soon"
                              ? "bg-zinc-700 text-zinc-400"
                              : item.badge === "AI"
                              ? "text-white"
                              : "bg-brand-400/20 text-brand-400"
                          )}
                          style={item.badge === "AI" ? { background: "#6B7EFF" } : undefined}>
                            {item.badge}
                          </span>
                        )}
                        {isActive && !item.badge && (
                          <ChevronRight size={12} className="text-brand-400/60" />
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Integrations */}
      {!collapsed && (
        <div className="px-3 pb-3 border-t border-[hsl(var(--sidebar-border))] pt-3">
          <p className="text-[10px] uppercase tracking-widest text-[hsl(var(--sidebar-text))]/50 px-1 mb-2 font-medium">Live Integrations</p>
          <div className="space-y-1">
            {integrations.map((int) => (
              <div key={int.label} className="flex items-center gap-2 px-2 py-1">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  int.status === "connected" ? "status-online" : "status-warning"
                )} />
                <span className="text-[11px] text-[hsl(var(--sidebar-text))]">{int.label}</span>
                <span className={cn(
                  "ml-auto text-[10px] font-medium",
                  int.status === "connected" ? "text-emerald-400" : "text-amber-400"
                )}>
                  {int.status === "connected" ? "Live" : "Setup"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User menu */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2 relative" ref={menuRef}>
        {/* Popout menu — renders above the trigger */}
        {userMenuOpen && !collapsed && (
          <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#1E293B] border border-[hsl(var(--sidebar-border))] rounded-xl shadow-2xl overflow-hidden z-50">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-[hsl(var(--sidebar-border))]">
              <p className="text-xs font-semibold text-white truncate">{displayName}</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate mt-0.5">{displayEmail}</p>
            </div>
            {/* Menu items */}
            <div className="py-1">
              <button
                onClick={() => { openUserProfile(); setUserMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5 transition-colors text-left"
              >
                <User size={14} className="shrink-0" />
                My Account
              </button>
              <Link
                href="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5 transition-colors"
              >
                <Settings size={14} className="shrink-0" />
                Settings
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
                <LogOut size={14} className="shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Trigger — user row */}
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
                className={cn("text-[hsl(var(--sidebar-text))] transition-transform shrink-0", userMenuOpen && "rotate-180")}
              />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
