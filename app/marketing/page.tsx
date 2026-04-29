"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  Megaphone,
  Share2,
  Crosshair,
  Layout,
  ChevronRight,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Bell,
  Globe,
  Users,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface HubCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  stats: { label: string; value: string }[];
  href: string;
  accentColor: string;
  bgColor: string;
}

interface ActivityItem {
  id: number;
  text: string;
  time: string;
  icon: React.ReactNode;
  iconBg: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const hubCards: HubCard[] = [
  {
    icon: <Megaphone size={22} color="#2563EB" />,
    title: "GateGuard Social",
    description:
      "Schedule and publish content across all GateGuard channels. Plan your content calendar weeks in advance.",
    stats: [
      { label: "Posts scheduled", value: "14" },
      { label: "Channels connected", value: "4" },
      { label: "Avg reach", value: "2.4K" },
    ],
    href: "/marketing/social",
    accentColor: "#2563EB",
    bgColor: "#EFF6FF",
  },
  {
    icon: <Share2 size={22} style={{ color: "#7C3AED" }} />,
    title: "Dealer Network Content",
    description:
      "Push branded content to your dealers' social accounts. One post, entire network.",
    stats: [
      { label: "Dealers connected", value: "23" },
      { label: "Pending approval", value: "3" },
      { label: "Network reach", value: "18K" },
    ],
    href: "/marketing/dealer-social",
    accentColor: "#7C3AED",
    bgColor: "#F5F3FF",
  },
  {
    icon: <Crosshair size={22} style={{ color: "#059669" }} />,
    title: "Co-Op Lead Pool",
    description:
      "Pooled advertising fund generates qualified leads and routes them to the right dealer automatically.",
    stats: [
      { label: "Pool balance", value: "$4,200" },
      { label: "Leads this month", value: "47" },
      { label: "Avg cost per lead", value: "$89" },
    ],
    href: "/marketing/coop",
    accentColor: "#059669",
    bgColor: "#ECFDF5",
  },
  {
    icon: <Layout size={22} style={{ color: "#D97706" }} />,
    title: "Dealer Websites",
    description:
      "Hosted landing pages for every dealer. Quote requests feed directly into GateGuard CRM as leads.",
    stats: [
      { label: "Sites live", value: "12" },
      { label: "Leads from sites", value: "34" },
      { label: "Pending setup", value: "3" },
    ],
    href: "/marketing/website",
    accentColor: "#D97706",
    bgColor: "#FFFBEB",
  },
];

const activityFeed: ActivityItem[] = [
  {
    id: 1,
    text: "Post published: 'GateGuard Summer Campaign' — Instagram + Facebook",
    time: "2h ago",
    icon: <CheckCircle2 size={15} color="#059669" />,
    iconBg: "#ECFDF5",
  },
  {
    id: 2,
    text: "New lead from dealer site: Stonegate Security → Ashford Glen HOA",
    time: "3h ago",
    icon: <ArrowUpRight size={15} color="#2563EB" />,
    iconBg: "#EFF6FF",
  },
  {
    id: 3,
    text: "Dealer social approved: Marcus Webb approved 3 posts for next week",
    time: "5h ago",
    icon: <CheckCircle2 size={15} color="#7C3AED" />,
    iconBg: "#F5F3FF",
  },
  {
    id: 4,
    text: "Co-op lead routed: 'Riverside Plaza Commercial' → SecureATL",
    time: "Yesterday",
    icon: <Crosshair size={15} color="#059669" />,
    iconBg: "#ECFDF5",
  },
  {
    id: 5,
    text: "New dealer connected: Peach State Access connected Instagram",
    time: "Yesterday",
    icon: <Users size={15} color="#7C3AED" />,
    iconBg: "#F5F3FF",
  },
  {
    id: 6,
    text: "Campaign performance: April campaign — 312 clicks, 12 leads, 3 demos booked",
    time: "2 days ago",
    icon: <Bell size={15} color="#D97706" />,
    iconBg: "#FFFBEB",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wide leading-none">
        {label}
      </span>
      <span className="text-sm font-bold text-gray-800 leading-tight">{value}</span>
    </div>
  );
}

function HubCard({ card }: { card: HubCard }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={card.href} className="block group" tabIndex={-1}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          "relative bg-white rounded-2xl border border-gray-100 p-6 flex flex-col gap-4",
          "transition-all duration-200 cursor-pointer",
          hovered
            ? "shadow-[0_8px_30px_rgba(0,0,0,0.10)] -translate-y-0.5 border-gray-200"
            : "shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
        )}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: card.bgColor }}
        >
          {card.icon}
        </div>

        {/* Title + Description */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{card.title}</h3>
            <div
              className={cn(
                "flex items-center gap-0.5 text-xs font-semibold transition-all duration-150",
                hovered ? "gap-1" : "gap-0.5"
              )}
              style={{ color: card.accentColor }}
            >
              <span>Go to</span>
              <ArrowUpRight size={13} />
            </div>
          </div>
          <p className="text-sm text-gray-500 leading-relaxed">{card.description}</p>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-50" />

        {/* Stats */}
        <div className="flex items-center gap-5">
          {card.stats.map((s) => (
            <StatPill key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      </div>
    </Link>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div
        className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: item.iconBg }}
      >
        {item.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 leading-snug">{item.text}</p>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
        <Clock size={11} />
        <span>{item.time}</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketingPage() {
  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Marketing</h1>
            <p className="text-sm text-gray-500">
              Brand, leads, and dealer growth — all in one place
            </p>
          </div>
          <button className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors duration-150 shadow-sm">
            <Plus size={15} />
            New Campaign
          </button>
        </div>

        {/* 2×2 Hub Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {hubCards.map((card) => (
            <HubCard key={card.href} card={card} />
          ))}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
            <button className="text-xs text-[#2563EB] font-medium hover:underline">
              View all
            </button>
          </div>
          <div className="px-6 divide-y divide-gray-50">
            {activityFeed.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
