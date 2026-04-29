"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Trash2,
  X,
  Send,
  Image,
  Calendar,
  Clock,
  TrendingUp,
  MessageSquare,
  Eye,
  Zap,
} from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type PostStatus = "scheduled" | "draft" | "published";
type Channel = "FB" | "IG" | "LI" | "X";

interface ScheduledPost {
  id: number;
  caption: string;
  channels: Channel[];
  date: string; // "Apr 28"
  time: string;
  status: PostStatus;
  chipColor: string;
}

interface QueuePost extends ScheduledPost {
  fullCaption: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const channelConfig: Record<
  Channel,
  { label: string; color: string; dotColor: string; followers: string }
> = {
  FB: { label: "Facebook", color: "#1877F2", dotColor: "#1877F2", followers: "1.2K followers" },
  IG: { label: "Instagram", color: "#E1306C", dotColor: "#E1306C", followers: "3.4K followers" },
  LI: { label: "LinkedIn", color: "#0A66C2", dotColor: "#0A66C2", followers: "890 followers" },
  X: { label: "X / Twitter", color: "#000000", dotColor: "#000000", followers: "445 followers" },
};

const calendarPosts: ScheduledPost[] = [
  {
    id: 1,
    caption: "Spring Install Season is here 🌿",
    channels: ["FB", "IG"],
    date: "Apr 28",
    time: "9:00 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
  {
    id: 2,
    caption: "Customer spotlight: Ashford Glen",
    channels: ["LI"],
    date: "Apr 29",
    time: "10:30 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
  {
    id: 3,
    caption: "Did you know? 78% of break-ins...",
    channels: ["FB", "IG", "LI", "X"],
    date: "Apr 30",
    time: "8:00 AM",
    status: "scheduled",
    chipColor: "#D1FAE5",
  },
  {
    id: 4,
    caption: "GateGuard team at ISC West 2026",
    channels: ["FB", "IG"],
    date: "May 1",
    time: "11:00 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
  {
    id: 5,
    caption: "Weekly tip: How to test your gate...",
    channels: ["FB"],
    date: "May 2",
    time: "2:00 PM",
    status: "draft",
    chipColor: "#FEF3C7",
  },
  {
    id: 6,
    caption: "New product: EagleEye 8MP AI Dome",
    channels: ["FB", "IG", "LI", "X"],
    date: "May 5",
    time: "9:00 AM",
    status: "scheduled",
    chipColor: "#D1FAE5",
  },
  {
    id: 7,
    caption: "Case study: Riverside Apts saved...",
    channels: ["LI"],
    date: "May 7",
    time: "10:00 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
];

const queuePosts: QueuePost[] = [
  {
    id: 1,
    caption: "Spring Install Season is here 🌿 — Don't miss the busiest...",
    fullCaption: "Spring Install Season is here 🌿 — Don't miss the busiest season for gate access upgrades. Contact your GateGuard dealer today.",
    channels: ["FB", "IG"],
    date: "Apr 28",
    time: "9:00 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
  {
    id: 2,
    caption: "Customer spotlight: Ashford Glen HOA — See how they cut...",
    fullCaption: "Customer spotlight: Ashford Glen HOA — See how they cut unauthorized vehicle entries by 60% with GateGuard cloud access.",
    channels: ["LI"],
    date: "Apr 29",
    time: "10:30 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
  {
    id: 3,
    caption: "Did you know? 78% of break-ins happen through the front...",
    fullCaption: "Did you know? 78% of break-ins happen through the front gate or main entrance. GateGuard's AI-powered access control keeps every entry point secure.",
    channels: ["FB", "IG", "LI", "X"],
    date: "Apr 30",
    time: "8:00 AM",
    status: "scheduled",
    chipColor: "#D1FAE5",
  },
  {
    id: 4,
    caption: "GateGuard team at ISC West 2026! Stop by booth #1242...",
    fullCaption: "GateGuard team at ISC West 2026! Stop by booth #1242 and see our latest innovations in AI-powered access control.",
    channels: ["FB", "IG"],
    date: "May 1",
    time: "11:00 AM",
    status: "scheduled",
    chipColor: "#DBEAFE",
  },
  {
    id: 5,
    caption: "Weekly tip: How to test your gate sensor in 60 seconds...",
    fullCaption: "Weekly tip: How to test your gate sensor in 60 seconds. A quick weekly test can prevent 90% of unexpected access failures.",
    channels: ["FB"],
    date: "May 2",
    time: "2:00 PM",
    status: "draft",
    chipColor: "#FEF3C7",
  },
  {
    id: 6,
    caption: "New product: EagleEye 8MP AI Dome — now available through...",
    fullCaption: "New product: EagleEye 8MP AI Dome — now available through your local GateGuard dealer. 4K clarity, license plate recognition, and weatherproof design.",
    channels: ["FB", "IG", "LI", "X"],
    date: "May 5",
    time: "9:00 AM",
    status: "scheduled",
    chipColor: "#D1FAE5",
  },
];

const calendarWeeks = [
  {
    week: "Apr 28 – May 2",
    days: [
      { label: "Mon Apr 28", shortDate: "Apr 28" },
      { label: "Tue Apr 29", shortDate: "Apr 29" },
      { label: "Wed Apr 30", shortDate: "Apr 30" },
      { label: "Thu May 1", shortDate: "May 1" },
      { label: "Fri May 2", shortDate: "May 2" },
    ],
  },
  {
    week: "May 5 – May 9",
    days: [
      { label: "Mon May 5", shortDate: "May 5" },
      { label: "Tue May 6", shortDate: "May 6" },
      { label: "Wed May 7", shortDate: "May 7" },
      { label: "Thu May 8", shortDate: "May 8" },
      { label: "Fri May 9", shortDate: "May 9" },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PostStatus }) {
  const map: Record<PostStatus, { label: string; bg: string; text: string }> = {
    scheduled: { label: "Scheduled", bg: "#DBEAFE", text: "#1D4ED8" },
    draft: { label: "Draft", bg: "#F3F4F6", text: "#6B7280" },
    published: { label: "Published", bg: "#D1FAE5", text: "#065F46" },
  };
  const s = map[status];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

function ChannelBadge({ ch }: { ch: Channel }) {
  const c = channelConfig[ch];
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded text-white text-[9px] font-bold flex-shrink-0"
      style={{ backgroundColor: c.color }}
      title={c.label}
    >
      {ch}
    </span>
  );
}

interface PopoverProps {
  post: ScheduledPost;
  onClose: () => void;
}

function PostPopover({ post, onClose }: PopoverProps) {
  return (
    <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-100 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 leading-snug">{post.caption}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <X size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1">
        {post.channels.map((ch) => (
          <ChannelBadge key={ch} ch={ch} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <Clock size={11} />
        <span>
          {post.date} · {post.time}
        </span>
      </div>
      <StatusBadge status={post.status} />
    </div>
  );
}

// ─── Composer Panel ───────────────────────────────────────────────────────────

function ComposerPanel() {
  const [caption, setCaption] = useState("");
  const [selectedChannels, setSelectedChannels] = useState<Channel[]>(["FB"]);
  const [schedDate, setSchedDate] = useState("2026-05-10");
  const [schedTime, setSchedTime] = useState("09:00");

  const toggleChannel = (ch: Channel) => {
    setSelectedChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">New Post</h3>

      {/* Caption */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Caption</label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write your post caption..."
          rows={4}
          className="w-full text-sm text-gray-800 placeholder-gray-400 border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-all"
        />
        <div className="text-right text-[11px] text-gray-400">{caption.length}/280</div>
      </div>

      {/* Channels */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Channels</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(channelConfig) as Channel[]).map((ch) => (
            <button
              key={ch}
              onClick={() => toggleChannel(ch)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-150",
                selectedChannels.includes(ch)
                  ? "border-transparent text-white"
                  : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"
              )}
              style={
                selectedChannels.includes(ch)
                  ? { backgroundColor: channelConfig[ch].color }
                  : {}
              }
            >
              {ch}
              <span className="font-normal opacity-70">{channelConfig[ch].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date + Time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#2563EB]/30 focus-within:border-[#2563EB] transition-all">
            <Calendar size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="date"
              value={schedDate}
              onChange={(e) => setSchedDate(e.target.value)}
              className="w-full text-sm text-gray-800 bg-transparent focus:outline-none"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Time</label>
          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#2563EB]/30 focus-within:border-[#2563EB] transition-all">
            <Clock size={13} className="text-gray-400 flex-shrink-0" />
            <input
              type="time"
              value={schedTime}
              onChange={(e) => setSchedTime(e.target.value)}
              className="w-full text-sm text-gray-800 bg-transparent focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Image upload placeholder */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-[#2563EB]/50 hover:bg-[#EFF6FF]/30 transition-all">
        <Image size={20} className="text-gray-300" />
        <p className="text-xs text-gray-400">Click to attach image or video</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button className="flex-1 flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold py-2.5 rounded-xl transition-colors shadow-sm">
          <Send size={13} />
          Schedule
        </button>
        <button className="px-4 py-2.5 border border-gray-200 text-sm font-medium text-gray-600 rounded-xl hover:bg-gray-50 transition-colors">
          Save Draft
        </button>
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView() {
  const [activePopover, setActivePopover] = useState<number | null>(null);

  const getPostsForDate = (shortDate: string) =>
    calendarPosts.filter((p) => p.date === shortDate);

  return (
    <div className="space-y-3">
      {/* Month header */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] px-5 py-3">
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <h3 className="text-sm font-semibold text-gray-900">April – May 2026</h3>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Weeks */}
      {calendarWeeks.map((week) => (
        <div
          key={week.week}
          className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] overflow-hidden"
        >
          <div className="grid grid-cols-5 divide-x divide-gray-50">
            {week.days.map((day) => {
              const posts = getPostsForDate(day.shortDate);
              const isOpenSlot = day.shortDate === "May 8";
              return (
                <div key={day.shortDate} className="min-h-[100px] p-3 space-y-2">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    {day.label}
                  </div>
                  {posts.map((post) => (
                    <div key={post.id} className="relative">
                      <button
                        onClick={() =>
                          setActivePopover(activePopover === post.id ? null : post.id)
                        }
                        className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium text-gray-800 leading-tight hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: post.chipColor }}
                      >
                        <div className="truncate">{post.caption}</div>
                        <div className="flex gap-0.5 mt-1">
                          {post.channels.map((ch) => (
                            <span
                              key={ch}
                              className="inline-flex w-3.5 h-3.5 rounded items-center justify-center text-white text-[7px] font-bold"
                              style={{ backgroundColor: channelConfig[ch].color }}
                            >
                              {ch[0]}
                            </span>
                          ))}
                        </div>
                      </button>
                      {activePopover === post.id && (
                        <PostPopover
                          post={post}
                          onClose={() => setActivePopover(null)}
                        />
                      )}
                    </div>
                  ))}
                  {isOpenSlot && (
                    <div className="w-full px-2 py-1.5 rounded-lg border-2 border-dashed border-gray-200 text-[11px] text-gray-400 text-center cursor-pointer hover:border-[#2563EB]/40 hover:text-[#2563EB] transition-all">
                      + Open slot
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Queue View ───────────────────────────────────────────────────────────────

function QueueView() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Post list */}
      <div className="lg:col-span-2 space-y-2">
        {queuePosts.map((post) => (
          <div
            key={post.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] px-4 py-3.5 flex items-center gap-4 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] transition-shadow"
          >
            {/* Channel badges */}
            <div className="flex gap-1 flex-shrink-0">
              {post.channels.map((ch) => (
                <ChannelBadge key={ch} ch={ch} />
              ))}
            </div>

            {/* Caption */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{post.caption}</p>
              <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                <Clock size={10} />
                <span>
                  {post.date} · {post.time}
                </span>
              </div>
            </div>

            {/* Status */}
            <StatusBadge status={post.status} />

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#2563EB] hover:bg-[#EFF6FF] transition-all">
                <Edit2 size={13} />
              </button>
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="lg:col-span-1">
        <ComposerPanel />
      </div>
    </div>
  );
}

// ─── Analytics Strip ──────────────────────────────────────────────────────────

function AnalyticsStrip() {
  const stats = [
    { label: "Total Posts", value: "18", icon: <MessageSquare size={15} color="#2563EB" />, bg: "#EFF6FF" },
    { label: "Total Reach", value: "42K", icon: <Eye size={15} color="#059669" />, bg: "#ECFDF5" },
    { label: "Avg Engagement", value: "4.2%", icon: <TrendingUp size={15} color="#7C3AED" />, bg: "#F5F3FF" },
    {
      label: "Best Performer",
      value: "Spring campaign",
      sub: "8.4K reach",
      icon: <Zap size={15} color="#D97706" />,
      bg: "#FFFBEB",
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.05)] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Last 30 Days</h3>
        <span className="text-[11px] text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">Analytics</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: s.bg }}
            >
              {s.icon}
            </div>
            <div>
              <p className="text-[11px] text-gray-400 leading-none mb-0.5">{s.label}</p>
              <p className="text-sm font-bold text-gray-900 leading-tight">{s.value}</p>
              {s.sub && <p className="text-[11px] text-gray-400">{s.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState<"calendar" | "queue">("calendar");

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Link href="/marketing" className="hover:text-[#2563EB] transition-colors">
                Marketing
              </Link>
              <ChevronRight size={12} />
              <span className="text-gray-600 font-medium">Social</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">GateGuard Social</h1>
          </div>
          <button className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1d4ed8] active:bg-[#1e40af] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
            <Plus size={15} />
            New Post
          </button>
        </div>

        {/* Channel Status Bar */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(channelConfig) as [Channel, typeof channelConfig[Channel]][]).map(
            ([ch, cfg]) => (
              <div
                key={ch}
                className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-full px-4 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.05)]"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg.dotColor }}
                />
                <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                <span className="text-xs text-gray-400">Connected</span>
                <span className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                  {cfg.followers}
                </span>
              </div>
            )
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
          {(["calendar", "queue"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-150",
                activeTab === tab
                  ? "bg-[#2563EB] text-white shadow-sm"
                  : "text-gray-500 hover:text-gray-800 hover:bg-gray-50"
              )}
            >
              {tab === "calendar" ? "Calendar" : "Queue"}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "calendar" ? <CalendarView /> : <QueueView />}

        {/* Analytics Strip */}
        <AnalyticsStrip />

      </div>
    </div>
  );
}
