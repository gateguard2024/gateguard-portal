"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Eye,
  Plus,
  Radio,
  Users,
  TrendingUp,
  DollarSign,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit2,
  Trash2,
  Tv,
  MessageSquare,
  Zap,
  Wrench,
  Calendar,
  X,
  BarChart3,
  CreditCard,
  FileText,
  CheckCircle,
  Circle,
} from "lucide-react";

// ─── Mock Data ────────────────────────────────────────────────────────────────

type PropertyStatus = "Live" | "Paused" | "Setup";
type PropertyType = "Multifamily" | "HOA" | "Commercial";
type ChannelType = "DIRECTV MDU" | "IPTV" | "Lobby Screen";

interface Property {
  id: number;
  name: string;
  type: PropertyType;
  status: PropertyStatus;
  channelLabel: string;
  channelType: ChannelType;
  postsUsed: number;
  postsFree: number;
  billedAmount: number | null;
}

const PROPERTIES: Property[] = [
  {
    id: 1,
    name: "Stonegate Townhomes",
    type: "Multifamily",
    status: "Live",
    channelLabel: "Ch. 5 DIRECTV MDU",
    channelType: "DIRECTV MDU",
    postsUsed: 3,
    postsFree: 5,
    billedAmount: null,
  },
  {
    id: 2,
    name: "Ashford Glen",
    type: "Multifamily",
    status: "Live",
    channelLabel: "IPTV Ch. 3",
    channelType: "IPTV",
    postsUsed: 5,
    postsFree: 5,
    billedAmount: 12,
  },
  {
    id: 3,
    name: "Maple Ridge HOA",
    type: "HOA",
    status: "Live",
    channelLabel: "Lobby Screen",
    channelType: "Lobby Screen",
    postsUsed: 2,
    postsFree: 5,
    billedAmount: null,
  },
  {
    id: 4,
    name: "Camden Crossing",
    type: "Multifamily",
    status: "Setup",
    channelLabel: "Ch. 5 DIRECTV MDU",
    channelType: "DIRECTV MDU",
    postsUsed: 0,
    postsFree: 5,
    billedAmount: null,
  },
  {
    id: 5,
    name: "Harbor View Apts",
    type: "Multifamily",
    status: "Live",
    channelLabel: "IPTV Ch. 3",
    channelType: "IPTV",
    postsUsed: 4,
    postsFree: 5,
    billedAmount: null,
  },
  {
    id: 6,
    name: "Northgate Plaza",
    type: "Commercial",
    status: "Paused",
    channelLabel: "Lobby Screen",
    channelType: "Lobby Screen",
    postsUsed: 0,
    postsFree: 5,
    billedAmount: null,
  },
  {
    id: 7,
    name: "Lakewood HOA",
    type: "HOA",
    status: "Live",
    channelLabel: "IPTV Ch. 3",
    channelType: "IPTV",
    postsUsed: 5,
    postsFree: 5,
    billedAmount: 9,
  },
  {
    id: 8,
    name: "Riverside Apts",
    type: "Multifamily",
    status: "Live",
    channelLabel: "Ch. 5 DIRECTV MDU",
    channelType: "DIRECTV MDU",
    postsUsed: 1,
    postsFree: 5,
    billedAmount: null,
  },
];

type PostStatus = "Active" | "Scheduled" | "Standby";
type PostType =
  | "Announcement"
  | "Community Meeting"
  | "Maintenance Notice"
  | "Emergency"
  | "Custom Promo";

interface ScheduledPost {
  id: number;
  type: PostType;
  content: string;
  scheduled: string;
  status: PostStatus;
  cost: string;
}

const CONTENT_QUEUE: ScheduledPost[] = [
  {
    id: 1,
    type: "Announcement",
    content: "Pool Hours: Mon–Fri 8am–10pm, Sat–Sun 8am–11pm",
    scheduled: "Live now",
    status: "Active",
    cost: "Free",
  },
  {
    id: 2,
    type: "Community Meeting",
    content: "Meeting Thurs May 2nd 7pm Clubhouse",
    scheduled: "May 1, 9:00 AM",
    status: "Scheduled",
    cost: "Free",
  },
  {
    id: 3,
    type: "Maintenance Notice",
    content: "Elevator B maintenance Tue 9am–12pm",
    scheduled: "Apr 30, 8:00 AM",
    status: "Scheduled",
    cost: "Free",
  },
  {
    id: 4,
    type: "Emergency",
    content: "Gate A offline — use Entrance B",
    scheduled: "On trigger",
    status: "Standby",
    cost: "$8.00",
  },
  {
    id: 5,
    type: "Custom Promo",
    content: "Summer lease special — contact leasing office",
    scheduled: "May 5, 10:00 AM",
    status: "Scheduled",
    cost: "$3.00",
  },
];

const ACTIVE_POSTS_PROPERTY = [
  {
    id: 1,
    type: "Announcement",
    content: "Pool Hours: Mon–Fri 8am–10pm, Sat–Sun 8am–11pm",
    posted: "Apr 28, 10:00 AM",
    views: 214,
  },
  {
    id: 2,
    type: "Community Meeting",
    content: "Community meeting Thursday May 2nd at 7pm in the Clubhouse",
    posted: "Apr 27, 9:00 AM",
    views: 189,
  },
  {
    id: 3,
    type: "Maintenance Notice",
    content: "Elevator B maintenance Tuesday 9am–12pm — please use Elevator A",
    posted: "Apr 26, 8:00 AM",
    views: 143,
  },
];

const INVOICE_HISTORY = [
  { month: "April 2026", posts: 6, free: 5, paid: 1, total: 3.0 },
  { month: "March 2026", posts: 7, free: 5, paid: 2, total: 6.0 },
  { month: "February 2026", posts: 5, free: 5, paid: 0, total: 0.0 },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: PropertyStatus }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full flex-shrink-0",
        status === "Live" && "bg-green-500",
        status === "Paused" && "bg-amber-400",
        status === "Setup" && "bg-gray-400"
      )}
    />
  );
}

function TypeBadge({ type }: { type: PropertyType }) {
  return (
    <span
      className={cn(
        "text-[10px] font-medium px-1.5 py-0.5 rounded",
        type === "Multifamily" && "bg-blue-50 text-blue-700",
        type === "HOA" && "bg-purple-50 text-purple-700",
        type === "Commercial" && "bg-slate-100 text-slate-600"
      )}
    >
      {type}
    </span>
  );
}

function PostTypeBadge({ type }: { type: PostType }) {
  const styles: Record<PostType, string> = {
    Announcement: "bg-blue-50 text-blue-700",
    "Community Meeting": "bg-teal-50 text-teal-700",
    "Maintenance Notice": "bg-amber-50 text-amber-700",
    Emergency: "bg-red-50 text-red-700",
    "Custom Promo": "bg-purple-50 text-purple-700",
  };
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", styles[type])}>
      {type}
    </span>
  );
}

function PostStatusBadge({ status }: { status: PostStatus }) {
  if (status === "Active")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
        <CheckCircle2 size={12} />
        Active
      </span>
    );
  if (status === "Scheduled")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-blue-700 font-medium">
        <Clock size={12} />
        Scheduled
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-medium">
      <AlertTriangle size={12} />
      Standby
    </span>
  );
}

// ─── Channel Preview Mockup ───────────────────────────────────────────────────

function ChannelPreviewMockup() {
  return (
    <div className="w-full border-2 border-gray-800 rounded-xl overflow-hidden bg-gray-900 shadow-inner">
      {/* TV top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a2744] border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#2563EB] rounded flex items-center justify-center">
            <Radio size={12} className="text-white" />
          </div>
          <span className="text-white text-xs font-semibold tracking-wide">
            Stonegate Townhomes
          </span>
          <span className="text-gray-400 text-[10px] ml-1">Ch. 5</span>
        </div>
        <span className="text-gray-300 text-xs font-mono">2:34 PM</span>
      </div>

      {/* Main content area */}
      <div className="flex" style={{ minHeight: "160px" }}>
        {/* Left 60% — current slide */}
        <div className="flex-[3] flex flex-col justify-center items-center bg-gradient-to-br from-[#1a2744] to-[#0f1a35] p-5 border-r border-gray-700">
          <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center mb-3">
            <Zap size={20} className="text-blue-400" />
          </div>
          <p className="text-white text-sm font-semibold text-center leading-snug">
            Pool Hours
          </p>
          <p className="text-gray-300 text-xs text-center mt-1 leading-relaxed">
            Mon–Fri 8am–10pm
            <br />
            Sat–Sun 8am–11pm
          </p>
        </div>

        {/* Right 40% — recent activity */}
        <div className="flex-[2] bg-[#111827] p-3">
          <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider mb-2">
            Recent Activity
          </p>
          <div className="space-y-2">
            {[
              { text: "Gate A — Amazon Delivery", time: "2:28 PM" },
              { text: "Package — Unit 204", time: "2:15 PM" },
              { text: "Visitor — Main Entrance", time: "1:55 PM" },
            ].map((item, i) => (
              <div key={i} className="flex items-start justify-between gap-1">
                <div className="flex items-start gap-1.5">
                  <Circle size={5} className="text-green-400 mt-1 fill-green-400 flex-shrink-0" />
                  <span className="text-gray-300 text-[10px] leading-tight">{item.text}</span>
                </div>
                <span className="text-gray-500 text-[9px] font-mono flex-shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom ticker */}
      <div className="bg-[#2563EB] px-3 py-1.5 overflow-hidden">
        <p className="text-white text-[10px] font-medium whitespace-nowrap">
          Community Meeting — Thursday May 2nd at 7pm in Clubhouse &nbsp;·&nbsp; Pool heater
          maintenance complete &nbsp;·&nbsp; Reminder: Quiet hours 10pm–8am
        </p>
      </div>
    </div>
  );
}

// ─── Compose Panel ────────────────────────────────────────────────────────────

function ComposePanel() {
  const [postType, setPostType] = useState<PostType>("Announcement");
  const [content, setContent] = useState("");
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [duration, setDuration] = useState("remove");
  const [preview, setPreview] = useState(false);

  const POST_TYPE_OPTIONS: { label: PostType; price: string }[] = [
    { label: "Announcement", price: "Free" },
    { label: "Maintenance Notice", price: "Free" },
    { label: "Community Meeting", price: "Free" },
    { label: "Emergency", price: "$8.00" },
    { label: "Custom Promo", price: "$3.00" },
  ];

  return (
    <div className="border border-gray-200 rounded-xl bg-white p-4 space-y-4">
      <p className="text-sm font-semibold text-gray-900">Compose Post</p>

      {/* Post type */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Post type</label>
        <div className="flex flex-wrap gap-2">
          {POST_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setPostType(opt.label)}
              className={cn(
                "text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors",
                postType === opt.label
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              {opt.label}
              {opt.price !== "Free" && (
                <span className="ml-1 text-[10px] text-amber-600 font-semibold">{opt.price}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">Content</label>
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message here..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400"
        />
      </div>

      {/* Schedule + Duration row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Schedule</label>
          <div className="flex gap-2">
            <button
              onClick={() => setScheduleMode("now")}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors",
                scheduleMode === "now"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              Now
            </button>
            <button
              onClick={() => setScheduleMode("later")}
              className={cn(
                "flex-1 text-xs py-1.5 rounded-lg border font-medium transition-colors",
                scheduleMode === "later"
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              )}
            >
              Schedule
            </button>
          </div>
          {scheduleMode === "later" && (
            <input
              type="datetime-local"
              className="mt-2 w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="remove">Until manually removed</option>
            <option value="24h">24 hours</option>
            <option value="48h">48 hours</option>
            <option value="1week">1 week</option>
          </select>
        </div>
      </div>

      {/* Preview toggle */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <button
          onClick={() => setPreview((p) => !p)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            preview ? "bg-blue-600" : "bg-gray-200"
          )}
        >
          <span
            className={cn(
              "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
              preview ? "translate-x-4" : "translate-x-0.5"
            )}
          />
        </button>
        <span className="text-xs text-gray-600">Preview on channel before posting</span>
      </label>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button className="flex-1 bg-[#2563EB] hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors">
          Post Now
        </button>
        <button className="flex-1 border border-gray-200 hover:border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors">
          Schedule
        </button>
      </div>
    </div>
  );
}

// ─── Dealer View ──────────────────────────────────────────────────────────────

function DealerView() {
  const [selectedPropertyId, setSelectedPropertyId] = useState(1);
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState(CONTENT_QUEUE);

  const selectedProperty = PROPERTIES.find((p) => p.id === selectedPropertyId)!;
  const filtered = PROPERTIES.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const removePost = (id: number) => setQueue((q) => q.filter((p) => p.id !== id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Community Channel</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage broadcast content for all properties.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Eye size={15} />
            Channel Preview
          </button>
          <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={15} />
            Schedule Post
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: "Active Channels",
            value: "18",
            icon: <Radio size={16} className="text-blue-600" />,
            sub: "across all properties",
          },
          {
            label: "Posts This Month",
            value: "47",
            icon: <MessageSquare size={16} className="text-purple-600" />,
            sub: "↑ 12% vs last month",
          },
          {
            label: "Avg Daily Views",
            value: "2,340",
            icon: <TrendingUp size={16} className="text-teal-600" />,
            sub: "across active channels",
          },
          {
            label: "Revenue This Month",
            value: "$3,420",
            icon: <DollarSign size={16} className="text-green-600" />,
            sub: "from per-post charges",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{stat.label}</span>
              {stat.icon}
            </div>
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Pricing banner */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800">
        <BarChart3 size={14} className="text-blue-500 flex-shrink-0" />
        <span>
          <span className="font-semibold">Post pricing:</span> First 5 posts/property/month included
          free &nbsp;·&nbsp; Additional posts: <span className="font-semibold">$3.00 each</span>{" "}
          &nbsp;·&nbsp; Premium posts (emergency/full-screen):{" "}
          <span className="font-semibold">$8.00 each</span>
        </span>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-5" style={{ alignItems: "flex-start" }}>
        {/* Left panel — 40% */}
        <div className="w-[40%] flex-shrink-0 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search properties..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Property list */}
          <div className="space-y-2">
            {filtered.map((property) => (
              <button
                key={property.id}
                onClick={() => setSelectedPropertyId(property.id)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all",
                  selectedPropertyId === property.id
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusDot status={property.status} />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {property.name}
                    </span>
                  </div>
                  <TypeBadge type={property.type} />
                </div>
                <div className="flex items-center justify-between gap-2 pl-4">
                  <span className="text-xs text-gray-500">{property.channelLabel}</span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      property.status === "Live" && "text-green-600",
                      property.status === "Paused" && "text-amber-600",
                      property.status === "Setup" && "text-gray-500"
                    )}
                  >
                    {property.status}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-4 mt-1">
                  <div className="flex items-center gap-1.5">
                    {/* Free post pip indicators */}
                    <div className="flex gap-0.5">
                      {Array.from({ length: property.postsFree }).map((_, i) => (
                        <span
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            i < property.postsUsed ? "bg-blue-500" : "bg-gray-200"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-gray-500">
                      {property.postsUsed}/{property.postsFree} free posts used
                    </span>
                  </div>
                  {property.billedAmount && (
                    <span className="text-[11px] font-semibold text-amber-700">
                      ${property.billedAmount} billed
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right panel — 60% */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Selected property header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tv size={16} className="text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">
                {selectedProperty.name}
              </span>
              <span className="text-xs text-gray-400">— {selectedProperty.channelLabel}</span>
            </div>
            <button className="text-xs text-blue-600 hover:underline font-medium">Manage</button>
          </div>

          {/* Channel preview mockup */}
          <ChannelPreviewMockup />

          {/* Content queue */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Content Queue</p>
              <span className="text-xs text-gray-400">{queue.length} posts</span>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500">Type</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500">Content</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500 whitespace-nowrap">
                      Scheduled
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500">Status</th>
                    <th className="text-left px-3 py-2.5 font-medium text-gray-500">Cost</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {queue.map((post, idx) => (
                    <tr
                      key={post.id}
                      className={cn(
                        "border-b border-gray-100 last:border-0",
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <PostTypeBadge type={post.type} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[180px]">
                        <span className="line-clamp-2 leading-snug">{post.content}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                        {post.scheduled}
                      </td>
                      <td className="px-3 py-2.5">
                        <PostStatusBadge status={post.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "font-medium",
                            post.cost === "Free" ? "text-green-600" : "text-amber-700"
                          )}
                        >
                          {post.cost}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => removePost(post.id)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compose panel */}
          <ComposePanel />
        </div>
      </div>
    </div>
  );
}

// ─── Property View ────────────────────────────────────────────────────────────

function PropertyView() {
  const [activeTab, setActiveTab] = useState<"active" | "schedule" | "billing">("active");

  const TABS: { key: "active" | "schedule" | "billing"; label: string }[] = [
    { key: "active", label: "Active Posts" },
    { key: "schedule", label: "Schedule" },
    { key: "billing", label: "Billing" },
  ];

  const TYPE_ICONS: Record<string, React.ReactNode> = {
    Announcement: <MessageSquare size={13} className="text-blue-500" />,
    "Community Meeting": <Users size={13} className="text-teal-500" />,
    "Maintenance Notice": <Wrench size={13} className="text-amber-500" />,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Stonegate Townhomes — Community Channel
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your property's channel content and schedule.
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <Eye size={15} />
          Preview Channel
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active Posts tab */}
      {activeTab === "active" && (
        <div className="space-y-4">
          {/* Usage indicator */}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full",
                    i < 3 ? "bg-blue-500" : "bg-blue-100"
                  )}
                />
              ))}
            </div>
            <span className="text-sm text-blue-800">
              <span className="font-semibold">3 of 5 free posts</span> used this month.
              Additional posts: <span className="font-semibold">$3.00 each.</span>
            </span>
          </div>

          {/* Active post cards */}
          <div className="space-y-3">
            {ACTIVE_POSTS_PROPERTY.map((post) => (
              <div
                key={post.id}
                className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {TYPE_ICONS[post.type] || <MessageSquare size={13} className="text-gray-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <PostTypeBadge type={post.type as PostType} />
                      <span className="text-xs text-gray-400">{post.posted}</span>
                    </div>
                    <p className="text-sm text-gray-800 leading-snug">{post.content}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Eye size={11} className="text-gray-400" />
                      <span className="text-xs text-gray-400">{post.views} views</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    <Edit2 size={13} />
                  </button>
                  <button className="p-1.5 rounded-lg border border-red-100 text-red-400 hover:bg-red-50 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* New post button */}
          <button className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium hover:border-blue-400 hover:bg-blue-50/50 transition-colors">
            <Plus size={16} />
            New Post
          </button>
        </div>
      )}

      {/* Schedule tab */}
      {activeTab === "schedule" && (
        <div className="space-y-4">
          <div className="text-center py-10 space-y-2">
            <Calendar size={36} className="text-gray-300 mx-auto" />
            <p className="text-sm font-medium text-gray-500">No upcoming scheduled posts</p>
            <p className="text-xs text-gray-400">Schedule a post to appear here</p>
            <button className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2563EB] text-white text-sm font-medium hover:bg-blue-700 transition-colors">
              <Plus size={14} />
              Schedule a Post
            </button>
          </div>
        </div>
      )}

      {/* Billing tab */}
      {activeTab === "billing" && (
        <div className="space-y-5">
          <p className="text-xs text-gray-500">
            Posts are billed to your GateGuard account monthly. Free posts reset on the 1st of each
            month.
          </p>

          {/* Current month */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">May 2026 (current)</span>
              <span className="text-xs text-gray-400">Billing closes Jun 1</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total posts", value: "3" },
                { label: "Free posts", value: "3 / 5" },
                { label: "Amount due", value: "$0.00" },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                  <p className="text-base font-semibold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice history */}
          <div>
            <p className="text-sm font-semibold text-gray-900 mb-3">Invoice history</p>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              {INVOICE_HISTORY.map((inv, idx) => (
                <div
                  key={inv.month}
                  className={cn(
                    "flex items-center justify-between px-4 py-3",
                    idx < INVOICE_HISTORY.length - 1 && "border-b border-gray-100"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                      <FileText size={13} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{inv.month}</p>
                      <p className="text-xs text-gray-400">
                        {inv.posts} posts · {inv.free} free
                        {inv.paid > 0 ? ` + ${inv.paid} paid` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        inv.total === 0 ? "text-green-600" : "text-gray-900"
                      )}
                    >
                      {inv.total === 0 ? "Free" : `$${inv.total.toFixed(2)}`}
                    </span>
                    {inv.total > 0 && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <CheckCircle size={12} className="text-green-500" />
                        Paid
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment method note */}
          <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <CreditCard size={15} className="text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 leading-relaxed">
              Channel charges are bundled with your monthly GateGuard service invoice. To update
              your payment method, visit the{" "}
              <span className="text-blue-600 font-medium cursor-pointer hover:underline">
                Billing Settings
              </span>{" "}
              page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelPage() {
  const [view, setView] = useState<"dealer" | "property">("dealer");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* View toggle */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit mb-8">
          <button
            onClick={() => setView("dealer")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              view === "dealer"
                ? "bg-[#2563EB] text-white"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Dealer View
          </button>
          <button
            onClick={() => setView("property")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              view === "property"
                ? "bg-[#2563EB] text-white"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            Property View
          </button>
        </div>

        {view === "dealer" ? <DealerView /> : <PropertyView />}
      </div>
    </div>
  );
}
