"use client";
import { useState } from "react";
import { Mail, Search, Star, Archive, Trash2, RefreshCw, Plus, ChevronDown, Inbox } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Send, Edit2, Gmail, ArrowLeft, MoreVertical, Paperclip, Tag: TagIcon, CheckSquare } = require("lucide-react") as any;

const FOLDERS = [
  { label: "Inbox",    icon: Inbox, count: 4, active: true  },
  { label: "Sent",     icon: Send,  count: 0, active: false },
  { label: "Starred",  icon: Star,  count: 2, active: false },
  { label: "Archived", icon: Archive, count: 0, active: false },
];

const MOCK_THREADS = [
  {
    id: "1",
    from: "nicole@gateguard.co",
    fromName: "Nicole G.",
    subject: "Friday L10 — agenda items",
    preview: "Hi Russel, adding the Riverside Commons WO to the issues list. Also can we discuss the Q3 rock on dealer onboarding?",
    time: "9:14 AM",
    unread: true,
    starred: true,
    labels: ["Internal"],
  },
  {
    id: "2",
    from: "mike@sunsetcommons.com",
    fromName: "Mike Alvarez",
    subject: "RE: Gate repair quote — GG-QT-00234",
    preview: "That looks good. Can you adjust the labor line to reflect 4 hours instead of 6? We had our own tech on site for part of it.",
    time: "8:47 AM",
    unread: true,
    starred: false,
    labels: ["Quote"],
  },
  {
    id: "3",
    from: "alex@adi.com",
    fromName: "Alex Chen — ADI Global",
    subject: "Q2 parts pricing update",
    preview: "Please find attached the updated ADI pricing sheet effective June 1. Notable changes: Brivo ACS300 up 3.2%, LiftMaster SL3000 unchanged.",
    time: "Yesterday",
    unread: false,
    starred: false,
    labels: ["Vendor"],
  },
  {
    id: "4",
    from: "permits@cityofatlanta.gov",
    fromName: "City of Atlanta — Permits",
    subject: "Permit #ATL-2026-4421 — Approved",
    preview: "Your permit application for 1200 Peachtree Industrial Blvd gate installation has been approved. Work may commence within 30 days.",
    time: "Yesterday",
    unread: false,
    starred: true,
    labels: ["Compliance"],
  },
  {
    id: "5",
    from: "sarah@riverviewapts.com",
    fromName: "Sarah Mendez",
    subject: "Access credential issue — Unit 4B",
    preview: "One of our residents is having trouble with their fob at the pedestrian gate. They say it worked fine last week but now nothing.",
    time: "Mon",
    unread: false,
    starred: false,
    labels: ["Support"],
  },
];

const LABEL_COLORS: Record<string, string> = {
  Internal:   "bg-[#6B7EFF]/15 text-[#6B7EFF]",
  Quote:      "bg-emerald-500/15 text-emerald-600",
  Vendor:     "bg-orange-500/15 text-orange-600",
  Compliance: "bg-amber-500/15 text-amber-600",
  Support:    "bg-sky-500/15 text-sky-600",
};

const CONNECTED_ACCOUNTS = [
  { email: "rfeldman@gateguard.co", provider: "Google", status: "connected", color: "#6B7EFF" },
  { email: "info@gateguard.co",     provider: "Google", status: "pending",   color: "#F59E0B" },
];

export default function EmailPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState("Inbox");

  const selectedThread = MOCK_THREADS.find(t => t.id === selected);

  return (
    <div className="h-screen flex overflow-hidden bg-[#F8FAFC]">
      {/* Left rail — folders + accounts */}
      <div className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: "#6B7EFF" }}>
            <Plus size={14} /> Compose
          </button>
        </div>

        {/* Folder list */}
        <nav className="flex-1 p-2 space-y-0.5">
          {FOLDERS.map(folder => {
            const Icon = folder.icon;
            const isActive = activeFolder === folder.label;
            return (
              <button
                key={folder.label}
                onClick={() => setActiveFolder(folder.label)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  isActive ? "bg-[#6B7EFF]/10 text-[#6B7EFF]" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="flex-1">{folder.label}</span>
                {folder.count > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? "bg-[#6B7EFF] text-white" : "bg-gray-200 text-gray-600"}`}>
                    {folder.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Connected accounts */}
        <div className="p-3 border-t border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 px-1 mb-2">Accounts</p>
          {CONNECTED_ACCOUNTS.map(acct => (
            <div key={acct.email} className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: acct.status === "connected" ? "#10B981" : "#F59E0B" }} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-gray-700 truncate">{acct.email}</p>
                <p className="text-[9px] text-gray-400">{acct.provider} · {acct.status}</p>
              </div>
            </div>
          ))}
          <button className="mt-2 w-full text-[10px] text-[#6B7EFF] font-semibold hover:underline text-left px-2">
            + Connect account
          </button>
        </div>
      </div>

      {/* Thread list */}
      <div className="w-80 shrink-0 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input placeholder="Search email…" className="w-full pl-8 pr-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {MOCK_THREADS.map(thread => (
            <button
              key={thread.id}
              onClick={() => setSelected(thread.id)}
              className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${selected === thread.id ? "bg-[#6B7EFF]/5 border-r-2 border-[#6B7EFF]" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className={`text-sm truncate ${thread.unread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                  {thread.fromName}
                </span>
                <span className="text-[10px] text-gray-400 shrink-0">{thread.time}</span>
              </div>
              <p className={`text-xs truncate mb-1 ${thread.unread ? "font-semibold text-gray-800" : "text-gray-600"}`}>
                {thread.subject}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{thread.preview}</p>
              <div className="flex items-center gap-1 mt-2">
                {thread.unread && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#6B7EFF" }} />
                )}
                {thread.labels.map(l => (
                  <span key={l} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${LABEL_COLORS[l] || "bg-gray-100 text-gray-500"}`}>
                    {l}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread detail / empty state */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <div>
                <h2 className="font-bold text-gray-900">{selectedThread.subject}</h2>
                <p className="text-xs text-gray-500 mt-0.5">From {selectedThread.fromName} &lt;{selectedThread.from}&gt;</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Star size={14} /></button>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Archive size={14} /></button>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#6B7EFF]/20 flex items-center justify-center text-sm font-bold text-[#6B7EFF]">
                      {selectedThread.fromName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{selectedThread.fromName}</p>
                      <p className="text-xs text-gray-500">{selectedThread.from}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{selectedThread.time}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{selectedThread.preview}</p>
              </div>
            </div>
            {/* Reply bar */}
            <div className="px-6 py-4 bg-white border-t border-gray-200">
              <div className="rounded-xl border border-gray-200 p-3">
                <textarea
                  placeholder={`Reply to ${selectedThread.fromName}…`}
                  rows={3}
                  className="w-full text-sm text-gray-700 resize-none focus:outline-none placeholder:text-gray-400"
                />
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors"><Paperclip size={13} /></button>
                    <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 transition-colors"><TagIcon size={13} /></button>
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors" style={{ background: "#6B7EFF" }}>
                    <Send size={12} /> Send
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-[#6B7EFF]/10 flex items-center justify-center mb-4">
              <Mail size={28} className="text-[#6B7EFF]" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">NEXUS Email</h3>
            <p className="text-sm text-gray-500 max-w-sm mb-6">
              Your connected inbox — Gmail, Outlook, and more. All GateGuard conversations in one place.
            </p>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors" style={{ background: "#6B7EFF" }}>
              <Plus size={14} /> Connect Gmail
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
