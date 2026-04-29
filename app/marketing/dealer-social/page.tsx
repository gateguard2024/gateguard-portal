"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  ChevronRight,
  Eye,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
  Send,
  Globe,
  Share2,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "published" | "scheduled" | "pending" | "draft";
type SocialChannel = "FB" | "IG" | "LI" | "X";

interface ContentItem {
  id: number;
  title: string;
  caption: string;
  dealerCount: number;
  channels: SocialChannel[];
  status: PostStatus;
  approved: string; // "20/23" or "—"
  gradientFrom: string;
  gradientTo: string;
}

interface DealerRow {
  id: number;
  name: string;
  slug: string;
  channels: SocialChannel[];
  lastActive: string;
  initials: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const channelColors: Record<SocialChannel, string> = {
  FB: "#1877F2",
  IG: "#E1306C",
  LI: "#0A66C2",
  X: "#000000",
};

const contentItems: ContentItem[] = [
  {
    id: 1,
    title: "Gate Season is Here",
    caption: "Spring is the perfect time to upgrade your gate access...",
    dealerCount: 23,
    channels: ["FB", "IG", "LI", "X"],
    status: "published",
    approved: "20/23",
    gradientFrom: "#3B82F6",
    gradientTo: "#6366F1",
  },
  {
    id: 2,
    title: "Why Cloud Access Control?",
    caption: "Still managing access with physical keys?...",
    dealerCount: 15,
    channels: ["LI"],
    status: "published",
    approved: "15/15",
    gradientFrom: "#0A66C2",
    gradientTo: "#2563EB",
  },
  {
    id: 3,
    title: "GateGuard Dealer Spotlight",
    caption: "Proud to feature [Dealer Name] this month...",
    dealerCount: 1,
    channels: ["FB", "IG", "LI", "X"],
    status: "pending",
    approved: "0/1",
    gradientFrom: "#7C3AED",
    gradientTo: "#A855F7",
  },
  {
    id: 4,
    title: "ISC West Recap 2026",
    caption: "Our team just got back from Vegas with some...",
    dealerCount: 23,
    channels: ["FB", "IG", "LI", "X"],
    status: "scheduled",
    approved: "21/23",
    gradientFrom: "#059669",
    gradientTo: "#10B981",
  },
  {
    id: 5,
    title: "Monthly Security Tip",
    caption: "Did you know that 60% of unauthorized entries...",
    dealerCount: 23,
    channels: ["FB", "IG"],
    status: "pending",
    approved: "19/23",
    gradientFrom: "#D97706",
    gradientTo: "#F59E0B",
  },
  {
    id: 6,
    title: "Case Study: HOA Community",
    caption: "How Stonegate Townhomes reduced incidents by 40%...",
    dealerCount: 8,
    channels: ["FB", "IG", "LI", "X"],
    status: "published",
    approved: "8/8",
    gradientFrom: "#0F766E",
    gradientTo: "#14B8A6",
  },
  {
    id: 7,
    title: "New Product Alert",
    caption: "Introducing the EagleEye 8MP AI Dome Camera...",
    dealerCount: 23,
    channels: ["FB", "IG", "LI", "X"],
    status: "scheduled",
    approved: "22/23",
    gradientFrom: "#DC2626",
    gradientTo: "#EF4444",
  },
  {
    id: 8,
    title: "Refer a Property",
    caption: "Know a property that needs better security?...",
    dealerCount: 23,
    channels: ["FB"],
    status: "draft",
    approved: "—",
    gradientFrom: "#6B7280",
    gradientTo: "#9CA3AF",
  },
];

const dealerRows: DealerRow[] = [
  {
    id: 1,
    name: "SecureATL",
    slug: "@secureATL",
    channels: ["FB", "IG", "LI"],
    lastActive: "Active 2h ago",
    initials: "SA",
  },
  {
    id: 2,
    name: "Peach State Access",
    slug: "@peachstateaccess",
    channels: ["FB", "IG"],
    lastActive: "Active 1d ago",
    initials: "PS",
  },
  {
    id: 3,
    name: "Southeast Security Group",
    slug: "@sesecuritygroup",
    channels: ["FB", "LI"],
    lastActive: "Active 3d ago",
    initials: "SS",
  },
  {
    id: 4,
    name: "Gate Masters LLC",
    slug: "@gatemasters",
    channels: ["FB", "IG", "LI", "X"],
    lastActive: "Active 1h ago",
    initials: "GM",
  },
  {
    id: 5,
    name: "Premier Access Control",
    slug: "@premieraccess",
    channels: ["FB"],
    lastActive: "Active 1w ago",
    initials: "PA",
  },
  {
    id: 6,
    name: "ClearView Security",
    slug: "@clearviewsec",
    channels: ["FB", "IG"],
    lastActive: "Active 2d ago",
    initials: "CV",
  },
];

type FilterTab = "all" | "pending" | "scheduled" | "published";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PostStatus }) {
  const map: Record<PostStatus, { label: string; bg: string; text: string; icon?: React.ReactNode }> = {
    published: {
      label: "Published",
      bg: "#D1FAE5",
      text: "#065F46",
      icon: <CheckCircle2 size={11} />,
    },
    scheduled: {
      label: "Scheduled",
      bg: "#DBEAFE",
      text: "#1D4ED8",
      icon: <Calendar size={11} />,
    },
    pending: {
      label: "Pending",
      bg: "#FEF3C7",
      text: "#92400E",
      icon: <AlertTriangle size={11} />,
    },
    draft: {
      label: "Draft",
      bg: "#F3F4F6",
      text: "#6B7280",
      icon: <Clock size={11} />,
    },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.icon}
      {s.label}
    </span>
  );
}

function ChannelBadge({ ch, size = "sm" }: { ch: SocialChannel; size?: "sm" | "xs" }) {
  const sizeClass = size === "sm" ? "w-5 h-5 text-[9px]" : "w-4 h-4 text-[8px]";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded font-bold text-white flex-shrink-0",
        sizeClass
      )}
      style={{ backgroundColor: channelColors[ch] }}
      title={ch}
    >
      {ch[0]}
    </span>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] px-5 py-4 space-y-1">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p
        className="text-2xl font-bold tracking-tight"
        style={{ color: accent ?? "#111827" }}
      >
        {value}
      </p>
      {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
    </div>
  );
}

// ─── Connect Dealer Modal ─────────────────────────────────────────────────────

function ConnectDealerModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.18)] border border-gray-100 w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-gray-900">Connect a Dealer</h2>
            <p className="text-sm text-gray-500">
              Send an OAuth invite to let your dealer connect their social accounts.
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* How it works */}
        <div className="bg-[#EFF6FF] rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-[#1D4ED8] uppercase tracking-wide">
            How it works
          </p>
          {[
            "Dealer receives an email invite with a secure link",
            "They click 'Connect Social Accounts' and authorize via OAuth",
            "Their channels appear in your dealer network instantly",
            "You can now push branded content to their accounts",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <p className="text-xs text-[#1E40AF]">{step}</p>
            </div>
          ))}
        </div>

        {/* Platforms */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Platforms to connect
          </label>
          <div className="flex gap-2">
            {(["FB", "IG", "LI", "X"] as SocialChannel[]).map((ch) => (
              <div
                key={ch}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 cursor-pointer hover:border-gray-300 transition-all"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: channelColors[ch] }}
                />
                {ch}
              </div>
            ))}
          </div>
        </div>

        {/* Email input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Dealer email address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="dealer@example.com"
            className="w-full text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button className="flex-1 flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm">
            <Send size={13} />
            Send Connection Invite
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Content Card ─────────────────────────────────────────────────────────────

function ContentCard({ item }: { item: ContentItem }) {
  return (
    <div className="flex items-start gap-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow">
      {/* Thumbnail */}
      <div
        className="w-20 h-20 rounded-xl flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${item.gradientFrom}, ${item.gradientTo})`,
        }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">{item.title}</h4>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.caption}</p>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Dealers */}
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users size={11} className="text-gray-400" />
            <span>Sent to {item.dealerCount} dealers</span>
          </div>

          {/* Channels */}
          <div className="flex items-center gap-1">
            {item.channels.map((ch) => (
              <ChannelBadge key={ch} ch={ch} size="xs" />
            ))}
          </div>

          {/* Approval rate */}
          {item.approved !== "—" && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <CheckCircle2 size={11} className="text-[#059669]" />
              <span>{item.approved} approved</span>
            </div>
          )}
        </div>
      </div>

      {/* View Details */}
      <button className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] px-3 py-1.5 rounded-lg transition-all self-center">
        <Eye size={12} />
        View
      </button>
    </div>
  );
}

// ─── Dealer Row ───────────────────────────────────────────────────────────────

function DealerRowItem({ dealer }: { dealer: DealerRow }) {
  const isRecent = dealer.lastActive.includes("h ago") || dealer.lastActive.includes("1d ago");
  return (
    <div className="flex items-center gap-3 py-3">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-xl bg-[#2563EB] flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">{dealer.initials}</span>
      </div>

      {/* Name + slug */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{dealer.name}</p>
        <p className="text-[11px] text-gray-400 truncate">{dealer.slug}</p>
      </div>

      {/* Channels */}
      <div className="flex gap-1 flex-shrink-0">
        {dealer.channels.map((ch) => (
          <ChannelBadge key={ch} ch={ch} size="xs" />
        ))}
      </div>

      {/* Last active */}
      <div
        className={cn(
          "text-[10px] font-medium whitespace-nowrap flex-shrink-0",
          isRecent ? "text-[#059669]" : "text-gray-400"
        )}
      >
        {dealer.lastActive}
      </div>

      {/* Manage */}
      <button className="flex-shrink-0 text-xs font-semibold text-[#2563EB] hover:bg-[#EFF6FF] px-2.5 py-1.5 rounded-lg transition-all">
        Manage
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DealerSocialPage() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [showModal, setShowModal] = useState(false);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending Approval" },
    { key: "scheduled", label: "Scheduled" },
    { key: "published", label: "Published" },
  ];

  const filteredContent =
    activeFilter === "all"
      ? contentItems
      : contentItems.filter((item) => item.status === activeFilter);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {showModal && <ConnectDealerModal onClose={() => setShowModal(false)} />}

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Link href="/marketing" className="hover:text-[#2563EB] transition-colors">
                Marketing
              </Link>
              <ChevronRight size={12} />
              <span className="text-gray-600 font-medium">Dealer Social</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Dealer Network Content
            </h1>
            <p className="text-sm text-gray-500">
              Create once. Publish to your entire dealer network.
            </p>
          </div>
          <button className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <Plus size={15} />
            New Content
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Dealers Connected" value="23" sub="All channels" />
          <StatCard
            label="Pending Approval"
            value="3"
            sub="Awaiting review"
            accent="#D97706"
          />
          <StatCard label="Posts This Month" value="67" sub="Across network" />
          <StatCard label="Network Reach" value="18.4K" sub="Combined followers" />
        </div>

        {/* Two-panel layout */}
        <div className="flex gap-4 items-start">

          {/* Left panel — Content Library (60%) */}
          <div className="flex-[3] min-w-0 space-y-3">
            {/* Filter tabs */}
            <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
              {filterTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 whitespace-nowrap",
                    activeFilter === tab.key
                      ? "bg-[#2563EB] text-white shadow-sm"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
                  )}
                >
                  {tab.label}
                  {tab.key === "pending" && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                      3
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content cards */}
            <div className="space-y-2">
              {filteredContent.map((item) => (
                <ContentCard key={item.id} item={item} />
              ))}
              {filteredContent.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-12 text-center">
                  <Share2 size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-400">No content in this filter</p>
                </div>
              )}
            </div>
          </div>

          {/* Right panel — Dealer Connections (40%) */}
          <div className="flex-[2] min-w-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden">
              {/* Panel header */}
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-900">Connected Dealers</h2>
                </div>
                <span className="text-xs font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                  {dealerRows.length} dealers
                </span>
              </div>

              {/* Dealer list */}
              <div className="px-5 divide-y divide-gray-50">
                {dealerRows.map((dealer) => (
                  <DealerRowItem key={dealer.id} dealer={dealer} />
                ))}
              </div>

              {/* Connect dealer button */}
              <div className="px-5 py-4 border-t border-gray-50">
                <button
                  onClick={() => setShowModal(true)}
                  className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-[#2563EB]/40 text-[#2563EB] text-sm font-semibold py-2.5 rounded-xl hover:bg-[#EFF6FF] hover:border-[#2563EB]/60 transition-all"
                >
                  <Plus size={15} />
                  Connect Dealer
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
