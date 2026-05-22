"use client";

import { useState } from "react";
import {
  Zap, Star, Users, ChevronRight, Plus, X, Check,
  Clock, Filter, MoreHorizontal, ArrowRight, TrendingUp,
  Activity, Bell, MessageSquare, Bookmark,
} from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Medal, Sparkles, Crown, Target, Rocket, ThumbsUp, Flame, Trophy, Award, Share2 } = require("lucide-react") as any;

// ─── Types ────────────────────────────────────────────────────────────────────

type PostType = "diagnostic" | "quote" | "badge" | "challenge" | "intro" | "spotlight";
type Level    = "Rookie" | "Field Tech" | "Senior Tech" | "Master Installer" | "GateGuard Elite";

interface Post {
  id: string;
  author: string;
  org: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
  timeAgo: string;
  type: PostType;
  content: string;
  xp: number;
  badges: string[];
  reactions: { fire: number; thumbsUp: number; comments: number };
}

interface LeaderEntry {
  rank: number;
  name: string;
  org: string;
  initials: string;
  avatarBg: string;
  avatarText: string;
  xp: number;
  level: Level;
}

interface Challenge {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  title: string;
  desc: string;
  progress: number;
  total: number;
  daysLeft: number;
  prize: string;
}

interface Badge {
  label: string;
  bg: string;
  text: string;
  locked?: boolean;
}

// ─── Level helpers ────────────────────────────────────────────────────────────

function levelFromXp(xp: number): Level {
  if (xp >= 10000) return "GateGuard Elite";
  if (xp >= 5000)  return "Master Installer";
  if (xp >= 2000)  return "Senior Tech";
  if (xp >= 500)   return "Field Tech";
  return "Rookie";
}

const LEVEL_STYLE: Record<Level, { bg: string; text: string; border: string }> = {
  "Rookie":            { bg: "bg-slate-100",   text: "text-slate-600",   border: "border-slate-200"  },
  "Field Tech":        { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200"   },
  "Senior Tech":       { bg: "bg-purple-100",  text: "text-purple-700",  border: "border-purple-200" },
  "Master Installer":  { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200"  },
  "GateGuard Elite":   { bg: "bg-yellow-100",  text: "text-yellow-700",  border: "border-yellow-200" },
};

// ─── Demo data ────────────────────────────────────────────────────────────────

const ME = {
  name: "Russel Feldman", initials: "RF", level: "Senior Tech" as Level,
  xp: 2380, xpNext: 3500, streak: 12, rank: 2,
  avatarBg: "bg-[#6B7EFF]/10", avatarText: "text-[#6B7EFF]",
};

const POSTS: Post[] = [
  {
    id: "1", author: "Danny Cruz", org: "SoCal Gate Pros", initials: "DC", timeAgo: "2h ago",
    avatarBg: "bg-blue-100", avatarText: "text-blue-700",
    type: "diagnostic",
    content: "Resolved DK6050 gate failure in 3 steps — photobeam knocked out of alignment by landscapers. Back up in 22 minutes. Meter reading confirmed 12VDC at J3 the whole time. Classic photobeam call.",
    xp: 150, badges: ["Speed Demon", "First Call Fix"], reactions: { fire: 12, thumbsUp: 7, comments: 3 },
  },
  {
    id: "2", author: "Marcus Webb", org: "GateForce Miami", initials: "MW", timeAgo: "5h ago",
    avatarBg: "bg-purple-100", avatarText: "text-purple-700",
    type: "quote",
    content: "Quote accepted — 48-unit property, full Brivo + UniFi install. $34,200 job. Went from site survey to signed quote in 4 days. FORGE drafted the proposal and the PM signed same day.",
    xp: 200, badges: ["Deal Closer"], reactions: { fire: 31, thumbsUp: 18, comments: 8 },
  },
  {
    id: "3", author: "Sarah K.", org: "Pacific Access Co.", initials: "SK", timeAgo: "8h ago",
    avatarBg: "bg-emerald-100", avatarText: "text-emerald-700",
    type: "challenge",
    content: "Challenge complete! Finished the June Speed Run — 10 diagnostics resolved under 30 minutes each. That $250 Visa is already spent on coffee for the crew. Thanks GateGuard.",
    xp: 250, badges: ["Speed Demon", "Challenge Champion"], reactions: { fire: 24, thumbsUp: 15, comments: 6 },
  },
  {
    id: "4", author: "GateGuard HQ", org: "GateGuard Corporate", initials: "GG", timeAgo: "Yesterday",
    avatarBg: "bg-[#6B7EFF]/10", avatarText: "text-[#6B7EFF]",
    type: "spotlight",
    content: "Dealer spotlight: GateForce Miami just hit 100 installed properties. In 18 months. Starting from zero. That's the compounding loop in action — hardware install → platform → word of mouth → repeat. Congratulations to Marcus and the whole team.",
    xp: 500, badges: ["Century Club"], reactions: { fire: 47, thumbsUp: 39, comments: 14 },
  },
  {
    id: "5", author: "Danny Cruz", org: "SoCal Gate Pros", initials: "DC", timeAgo: "Yesterday",
    avatarBg: "bg-blue-100", avatarText: "text-blue-700",
    type: "diagnostic",
    content: "Site survey completed at Parkview Apartments (72 units) → AI proposal → client signed the quote by end of day. Fastest turnaround yet. The survey tool is something else.",
    xp: 100, badges: ["Survey King"], reactions: { fire: 9, thumbsUp: 11, comments: 2 },
  },
  {
    id: "6", author: "Carlos M.", org: "SoCal Gate Pros", initials: "CM", timeAgo: "2d ago",
    avatarBg: "bg-teal-100", avatarText: "text-teal-700",
    type: "intro",
    content: "Just joined SoCal Gate Pros as a field tech. First day using the tech tool — diagnosed a Brivo ACS300 issue in 15 minutes that would have taken me an hour with a manual. This thing is legit.",
    xp: 10, badges: ["Rookie"], reactions: { fire: 14, thumbsUp: 22, comments: 5 },
  },
  {
    id: "7", author: "Sarah K.", org: "Pacific Access Co.", initials: "SK", timeAgo: "2d ago",
    avatarBg: "bg-emerald-100", avatarText: "text-emerald-700",
    type: "diagnostic",
    content: "Brivo ACS300 unresponsive after power outage — resolved in 4 steps. Failed 12V aux supply, not the board. Saved the customer a $400 board replacement call.",
    xp: 120, badges: ["Board Saver"], reactions: { fire: 7, thumbsUp: 9, comments: 1 },
  },
  {
    id: "8", author: "Marcus Webb", org: "GateForce Miami", initials: "MW", timeAgo: "3d ago",
    avatarBg: "bg-purple-100", avatarText: "text-purple-700",
    type: "quote",
    content: "TRINITY handled the initial qualification call, scheduled the site survey, and flagged it as a high-priority lead. Showed up to a warm meeting. Closed on the spot.",
    xp: 80, badges: [], reactions: { fire: 19, thumbsUp: 14, comments: 7 },
  },
];

const LEADERBOARD: LeaderEntry[] = [
  { rank: 1, name: "Marcus Webb",  org: "GateForce Miami",    initials: "MW", avatarBg: "bg-purple-100", avatarText: "text-purple-700", xp: 8400, level: "Master Installer"  },
  { rank: 2, name: "Russel F.",    org: "GateGuard HQ",       initials: "RF", avatarBg: "bg-[#6B7EFF]/10", avatarText: "text-[#6B7EFF]", xp: 7200, level: "Master Installer" },
  { rank: 3, name: "Sarah K.",     org: "Pacific Access Co.", initials: "SK", avatarBg: "bg-emerald-100", avatarText: "text-emerald-700", xp: 5900, level: "Master Installer" },
  { rank: 4, name: "Danny Cruz",   org: "SoCal Gate Pros",   initials: "DC", avatarBg: "bg-blue-100",    avatarText: "text-blue-700",   xp: 4100, level: "Senior Tech"      },
  { rank: 5, name: "Carlos M.",    org: "SoCal Gate Pros",   initials: "CM", avatarBg: "bg-teal-100",    avatarText: "text-teal-700",   xp: 820,  level: "Field Tech"       },
];

const CHALLENGES: Challenge[] = [
  { id: "c1", icon: Trophy,  iconColor: "text-amber-500",  title: "June Speed Run",   desc: "Resolve 10 diagnostics under 30 min each",    progress: 6,  total: 10, daysLeft: 9,  prize: "$250 Visa"  },
  { id: "c2", icon: Target,  iconColor: "text-[#6B7EFF]",  title: "Survey Surge",     desc: "Convert 3 surveys to signed quotes",           progress: 1,  total: 3,  daysLeft: 12, prize: "$250 Visa"  },
  { id: "c3", icon: Rocket,  iconColor: "text-emerald-600",title: "Network Builder",  desc: "Complete 5 TRINITY calls this week",          progress: 3,  total: 5,  daysLeft: 3,  prize: "$100 Visa"  },
];

const MY_BADGES: Badge[] = [
  { label: "Speed Demon",    bg: "bg-blue-100",    text: "text-blue-700"   },
  { label: "First Call Fix", bg: "bg-emerald-100", text: "text-emerald-700"},
  { label: "Survey King",    bg: "bg-purple-100",  text: "text-purple-700" },
  { label: "Deal Closer",    bg: "bg-amber-100",   text: "text-amber-700"  },
  { label: "Century Club",   bg: "bg-yellow-100",  text: "text-yellow-700" },
  { label: "Rain or Shine",  bg: "bg-teal-100",    text: "text-teal-700"   },
  { label: "Board Saver",    bg: "bg-slate-100",   text: "text-slate-500",  locked: true },
  { label: "TRINITY Pro",    bg: "bg-slate-100",   text: "text-slate-500",  locked: true },
];

const FILTER_TABS = [
  { id: "all",        label: "All"         },
  { id: "diagnostic", label: "Diagnostics" },
  { id: "quote",      label: "Sales Wins"  },
  { id: "challenge",  label: "Challenges"  },
  { id: "spotlight",  label: "Spotlights"  },
];

const POST_TYPE_STYLE: Record<PostType, { dot: string; label: string }> = {
  diagnostic: { dot: "bg-blue-500",    label: "Diagnostic resolved" },
  quote:      { dot: "bg-emerald-500", label: "Deal closed"         },
  badge:      { dot: "bg-purple-500",  label: "Badge earned"        },
  challenge:  { dot: "bg-amber-500",   label: "Challenge complete"  },
  intro:      { dot: "bg-teal-500",    label: "New team member"     },
  spotlight:  { dot: "bg-[#6B7EFF]",   label: "Spotlight"           },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function LevelBadge({ level, small }: { level: Level; small?: boolean }) {
  const s = LEVEL_STYLE[level];
  return (
    <span className={`inline-flex items-center gap-1 font-mono font-medium border rounded-full ${s.bg} ${s.text} ${s.border} ${small ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"}`}>
      {level === "GateGuard Elite" && <Crown size={10} />}
      {level === "Master Installer" && <Medal size={10} />}
      {level}
    </span>
  );
}

function Avatar({ initials, bg, text, size = "md" }: { initials: string; bg: string; text: string; size?: "sm" | "md" | "lg" }) {
  const sz = size === "lg" ? "w-12 h-12 text-sm" : size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div className={`${sz} ${bg} ${text} rounded-full flex items-center justify-center font-mono font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const [reacted, setReacted]       = useState<Record<string, boolean>>({});
  const [localReact, setLocalReact] = useState(post.reactions);
  const typeStyle = POST_TYPE_STYLE[post.type];

  function handleReact(key: "fire" | "thumbsUp") {
    if (reacted[key]) return;
    setReacted(prev => ({ ...prev, [key]: true }));
    setLocalReact(prev => ({ ...prev, [key]: prev[key] + 1 }));
  }

  return (
    <div className="bg-white border border-border rounded-xl p-4 hover:border-[#6B7EFF]/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Avatar initials={post.initials} bg={post.avatarBg} text={post.avatarText} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-foreground">{post.author}</span>
              <span className="text-xs text-muted-foreground">{post.org}</span>
              <span className="w-1 h-1 rounded-full bg-border flex-shrink-0" />
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={10} />{post.timeAgo}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${typeStyle.dot}`} />
              <span className="text-[11px] text-muted-foreground">{typeStyle.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {post.xp > 0 && (
            <span className="font-mono text-xs font-semibold text-[#6B7EFF] bg-[#6B7EFF]/10 border border-[#6B7EFF]/20 rounded-full px-2 py-0.5">
              +{post.xp} XP
            </span>
          )}
          <button className="text-muted-foreground hover:text-foreground p-1 rounded">
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      <p className="text-sm text-foreground leading-relaxed mb-3">{post.content}</p>

      {post.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.badges.map(b => (
            <span key={b} className="font-mono text-[11px] bg-[#6B7EFF]/10 text-[#6B7EFF] border border-[#6B7EFF]/20 rounded-full px-2 py-0.5">
              {b}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-border">
        <button
          onClick={() => handleReact("fire")}
          className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${reacted.fire ? "bg-red-50 border-red-200 text-red-600" : "border-border text-muted-foreground hover:border-red-200 hover:text-red-500"}`}
        >
          <Flame size={13} />{localReact.fire}
        </button>
        <button
          onClick={() => handleReact("thumbsUp")}
          className={`flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${reacted.thumbsUp ? "bg-blue-50 border-blue-200 text-blue-600" : "border-border text-muted-foreground hover:border-blue-200 hover:text-blue-500"}`}
        >
          <ThumbsUp size={13} />{localReact.thumbsUp}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full px-3 py-1 border border-border">
          <MessageSquare size={13} />{localReact.comments}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground rounded-full px-3 py-1 border border-border ml-auto">
          <Share2 size={13} /> Share
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [composing, setComposing]       = useState(false);
  const [draftText, setDraftText]       = useState("");

  const xpPct = Math.round((ME.xp / ME.xpNext) * 100);

  const filtered = activeFilter === "all"
    ? POSTS
    : POSTS.filter(p => p.type === activeFilter);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Flame size={20} className="text-[#6B7EFF]" />
              The Feed
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your dealer network — every win, fix, and milestone celebrated in real time
            </p>
          </div>
          <button
            onClick={() => setComposing(!composing)}
            className="flex items-center gap-2 text-sm font-medium text-white bg-[#6B7EFF] hover:bg-[#5a6ee8] rounded-lg px-4 py-2 transition-colors"
          >
            <Plus size={16} /> Post Update
          </button>
        </div>

        {/* ── Your stats bar ── */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <Avatar initials={ME.initials} bg={ME.avatarBg} text={ME.avatarText} size="lg" />
              <div>
                <div className="text-sm font-medium text-foreground">{ME.name}</div>
                <LevelBadge level={ME.level} small />
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{ME.xp.toLocaleString()} / {ME.xpNext.toLocaleString()} XP to Master Installer</span>
                <span className="text-xs font-mono text-[#6B7EFF]">{xpPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#6B7EFF] rounded-full transition-all" style={{ width: `${xpPct}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm">
              <div className="text-center">
                <div className="flex items-center gap-1 font-semibold text-foreground">
                  <Flame size={14} className="text-red-500" />{ME.streak}
                </div>
                <div className="text-[10px] text-muted-foreground">day streak</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground">#{ME.rank}</div>
                <div className="text-[10px] text-muted-foreground">this month</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-foreground">{ME.xp.toLocaleString()}</div>
                <div className="text-[10px] text-muted-foreground">total XP</div>
              </div>
            </div>
            <button className="text-xs text-[#6B7EFF] hover:underline flex items-center gap-1 ml-auto">
              My profile <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {/* ── Composer (when open) ── */}
        {composing && (
          <div className="bg-white border border-[#6B7EFF]/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Share a win or update</span>
              <button onClick={() => setComposing(false)} className="text-muted-foreground hover:text-foreground">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={draftText}
              onChange={e => setDraftText(e.target.value)}
              placeholder="What happened today? Resolved a tough diagnostic? Closed a deal? Share it..."
              rows={3}
              className="w-full text-sm border border-border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 focus:border-[#6B7EFF] bg-[#F8FAFC] text-foreground placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Posts from the tech tool and portal auto-publish here too</span>
              <button
                onClick={() => { setDraftText(""); setComposing(false); }}
                disabled={!draftText.trim()}
                className="text-sm font-medium text-white bg-[#6B7EFF] hover:bg-[#5a6ee8] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-1.5 transition-colors"
              >
                Post
              </button>
            </div>
          </div>
        )}

        {/* ── Two-column layout ── */}
        <div className="flex gap-6 items-start">

          {/* ── Feed column ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Filter tabs */}
            <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  className={`flex-1 text-xs font-medium rounded-lg py-1.5 px-2 transition-colors ${
                    activeFilter === tab.id
                      ? "bg-[#6B7EFF] text-white"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Posts */}
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="bg-white border border-border rounded-xl p-12 text-center">
                  <Activity size={32} className="text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No posts in this category yet</p>
                </div>
              ) : (
                filtered.map(post => <PostCard key={post.id} post={post} />)
              )}
            </div>
          </div>

          {/* ── Right sidebar ── */}
          <div className="w-72 flex-shrink-0 space-y-4">

            {/* Leaderboard */}
            <div className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Trophy size={15} className="text-amber-500" /> June Leaderboard
                </h3>
                <span className="text-[10px] text-muted-foreground">by XP</span>
              </div>
              <div className="space-y-2">
                {LEADERBOARD.map(entry => {
                  const isMe = entry.name === "Russel F.";
                  return (
                    <div
                      key={entry.rank}
                      className={`flex items-center gap-3 rounded-lg p-2 ${isMe ? "bg-[#6B7EFF]/5 border border-[#6B7EFF]/15" : "hover:bg-slate-50"} ${entry.rank === 1 ? "border-l-2 border-l-amber-400 pl-1.5" : ""}`}
                    >
                      <span className={`font-mono text-xs font-bold w-5 text-center flex-shrink-0 ${entry.rank === 1 ? "text-amber-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-amber-700" : "text-muted-foreground"}`}>
                        #{entry.rank}
                      </span>
                      <Avatar initials={entry.initials} bg={entry.avatarBg} text={entry.avatarText} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{entry.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{entry.org}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-mono text-xs font-semibold text-[#6B7EFF]">{entry.xp.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">XP</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="mt-3 w-full text-xs text-[#6B7EFF] hover:underline flex items-center justify-center gap-1">
                Full leaderboard <ArrowRight size={11} />
              </button>
            </div>

            {/* Active Challenges */}
            <div className="bg-white border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Zap size={15} className="text-[#6B7EFF]" /> Active Challenges
                </h3>
                <span className="text-[10px] text-[#6B7EFF] font-medium cursor-pointer hover:underline">+ Join</span>
              </div>
              <div className="space-y-3">
                {CHALLENGES.map(ch => {
                  const pct = Math.round((ch.progress / ch.total) * 100);
                  const CIcon = ch.icon;
                  return (
                    <div key={ch.id} className="border border-border rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <CIcon size={16} className={`${ch.iconColor} flex-shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-foreground">{ch.title}</div>
                          <div className="text-[11px] text-muted-foreground">{ch.desc}</div>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-[#6B7EFF] rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">{ch.progress}/{ch.total} · {ch.daysLeft}d left</span>
                        <span className="text-[10px] font-semibold text-amber-600">{ch.prize}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Your Badges */}
            <div className="bg-white border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Award size={15} className="text-purple-500" /> Your Badges
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {MY_BADGES.map(b => (
                  <span
                    key={b.label}
                    className={`font-mono text-[10px] font-medium rounded-full px-2 py-0.5 border ${
                      b.locked
                        ? "bg-slate-50 text-slate-400 border-slate-200 opacity-50"
                        : `${b.bg} ${b.text} border-transparent`
                    }`}
                    title={b.locked ? "Not yet unlocked" : b.label}
                  >
                    {b.locked ? "?" : b.label}
                  </span>
                ))}
              </div>
              <button className="mt-3 w-full text-xs text-[#6B7EFF] hover:underline flex items-center justify-center gap-1">
                See all 24 badges <ArrowRight size={11} />
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
