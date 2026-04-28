"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Camera, Shield, FileText,
  Wrench, CreditCard, Settings, ChevronRight,
  Radio, MessageSquare, BarChart3, ChevronDown,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navSections = [
  {
    label: "Operations",
    items: [
      { label: "Dashboard",      href: "/",             icon: LayoutDashboard },
      { label: "Customers",      href: "/customers",    icon: Users           },
      { label: "CRM",            href: "/crm",          icon: MessageSquare },
      { label: "Organizations",  href: "/admin",        icon: Network       },
    ],
  },
  {
    label: "Security",
    items: [
      { label: "Cameras",        href: "/cameras",      icon: Camera          },
      { label: "Access Control", href: "/access",       icon: Shield          },
      { label: "SOC",            href: "/soc",          icon: Radio, badge: "Soon" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { label: "Quotes",         href: "/quotes",       icon: FileText        },
      { label: "Billing",        href: "/billing",      icon: CreditCard      },
    ],
  },
  {
    label: "Field",
    items: [
      { label: "Maintenance",    href: "/maintenance",  icon: Wrench          },
      { label: "Reports",        href: "/reports",      icon: BarChart3, badge: "Soon" },
    ],
  },
];

const integrations = [
  { label: "EagleEye",   status: "connected" as const },
  { label: "Brivo",      status: "connected" as const },
  { label: "QuickBooks", status: "pending"   as const },
  { label: "Twilio",     status: "pending"   as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen flex flex-col z-40 transition-all duration-200",
      "bg-[hsl(var(--sidebar-bg))] border-r border-[hsl(var(--sidebar-border))]",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[hsl(var(--sidebar-border))]">
        <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden flex items-center justify-center">
          <Image src="/logo.png" alt="GateGuard" width={36} height={36} className="object-contain" priority />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-white tracking-wide">GateGuard</span>
            <p className="text-[10px] text-brand-400/80 -mt-0.5 font-medium tracking-widest uppercase">Dealer OS</p>
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
                const isActive = item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
                const isSoon = item.badge === "Soon";
                return (
                  <Link
                    key={item.href}
                    href={isSoon ? "#" : item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group relative",
                      isActive
                        ? "bg-brand-400/10 text-brand-400 border border-brand-400/20"
                        : isSoon
                        ? "text-[hsl(var(--sidebar-text))]/40 cursor-not-allowed"
                        : "text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5",
                      collapsed && "justify-center px-0"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide",
                            item.badge === "Soon"
                              ? "bg-zinc-700 text-zinc-400"
                              : "bg-brand-400/20 text-brand-400"
                          )}>
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

      {/* Settings + user */}
      <div className="border-t border-[hsl(var(--sidebar-border))] p-2">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[hsl(var(--sidebar-text))] hover:text-white hover:bg-white/5 transition-all",
            collapsed && "justify-center"
          )}
        >
          <Settings size={16} className="shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors mt-0.5">
            <div className="w-7 h-7 rounded-full bg-brand-400/20 border border-brand-400/30 flex items-center justify-center text-[11px] font-bold text-brand-400 shrink-0">RF</div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">Russel Feldman</p>
              <p className="text-[10px] text-[hsl(var(--sidebar-text))] truncate">rfeldman@gateguard.co</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
