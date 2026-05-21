"use client";

/**
 * AddToL10Button — ambient floating button available on every portal page.
 *
 * Captures the current page context and lets users instantly create an EOS
 * Issue or To-Do for the next L10 meeting without leaving their current view.
 */

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Zap, X, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type ItemType = "issue" | "todo";

interface L10Item {
  type: ItemType;
  text: string;
  priority: "Critical" | "High" | "Normal";
  owner: string;
}

// Map pathnames to friendly page names for auto-context
function getPageContext(pathname: string): string {
  const map: Record<string, string> = {
    "/":              "Dashboard",
    "/crm":           "CRM / Pipeline",
    "/customers":     "Customers",
    "/quotes":        "Quotes",
    "/billing":       "Billing",
    "/renewals":      "Renewals",
    "/revenue":       "Revenue",
    "/maintenance":   "Maintenance / Work Orders",
    "/dispatch":      "Dispatch",
    "/inventory":     "Inventory",
    "/cameras":       "Cameras",
    "/access":        "Access Control",
    "/network":       "Network",
    "/reps":          "Reps & Commissions",
    "/compliance":    "Compliance",
    "/map":           "Territory Map",
    "/scorecard":     "Scorecard",
    "/reports":       "Reports",
    "/products":      "Products",
    "/kb":            "Knowledge Base",
    "/directv":       "DirecTV / ATLAS",
    "/aria":          "ARIA Lead Intel",
    "/eos":           "Operating System (EOS)",
    "/onboarding":    "Company Setup",
    "/admin":         "Admin",
  };
  for (const [path, label] of Object.entries(map)) {
    if (pathname === path || (path !== "/" && pathname.startsWith(path))) return label;
  }
  return "Portal";
}

export function AddToL10Button() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [type, setType] = useState<ItemType>("issue");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<L10Item["priority"]>("Normal");
  const [owner, setOwner] = useState("RF");
  const panelRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const pageContext = getPageContext(pathname);

  // Don't show on /tech (field tool has its own UI) or /eos (has coach panel)
  const shouldHide = pathname.startsWith("/tech");
  if (shouldHide) return null;

  // Auto-focus textarea on open
  useEffect(() => {
    if (open) {
      setTimeout(() => textRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSave = () => {
    if (!text.trim()) return;
    // In production: POST to /api/eos/items with { type, text, priority, owner, source_page: pathname }
    // For now we show success feedback
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
      setText("");
      setPriority("Normal");
      setType("issue");
    }, 1800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === "Escape") setOpen(false);
  };

  if (saved) {
    return (
      <div className="fixed bottom-6 left-72 z-50">
        <div className="flex items-center gap-2.5 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 size={16} />
          Added to next L10 {type === "issue" ? "Issues" : "To-Do"} list
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-72 z-50" ref={panelRef}>
      {/* Expanded panel */}
      {open && (
        <div className="absolute bottom-full left-0 mb-3 w-96 bg-white rounded-2xl shadow-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#6B7EFF]/5 to-white border-b border-border">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-[#6B7EFF]" />
              <span className="text-sm font-bold text-foreground">Add to L10</span>
              <span className="text-[10px] text-muted-foreground bg-slate-100 px-2 py-0.5 rounded-full">
                from {pageContext}
              </span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 transition-colors">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Type selector */}
            <div className="flex gap-2">
              {([
                { key: "issue", label: "Issue", icon: AlertTriangle, desc: "Needs IDS in the meeting" },
                { key: "todo",  label: "To-Do", icon: CheckCircle2,  desc: "7-day action item" },
              ] as const).map(t => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className={cn(
                    "flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all",
                    type === t.key
                      ? "border-[#6B7EFF] bg-[#6B7EFF]/5 text-[#6B7EFF] font-semibold"
                      : "border-border text-muted-foreground hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <t.icon size={13} />
                  <div className="text-left">
                    <p className="text-xs font-semibold leading-none">{t.label}</p>
                    <p className="text-[10px] leading-none mt-0.5 opacity-70">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                Describe it
              </label>
              <textarea
                ref={textRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={type === "issue"
                  ? "What's the real issue? (not the symptom)"
                  : "What needs to happen in the next 7 days?"}
                rows={3}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 resize-none bg-white placeholder:text-muted-foreground"
              />
            </div>

            {/* Priority + Owner row */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Priority
                </label>
                <div className="relative">
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as L10Item["priority"])}
                    className="w-full appearance-none border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white pr-8"
                  >
                    <option value="Critical">🔴 Critical</option>
                    <option value="High">🟠 High</option>
                    <option value="Normal">🔵 Normal</option>
                  </select>
                  <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Owner
                </label>
                <input
                  value={owner}
                  onChange={e => setOwner(e.target.value)}
                  placeholder="RF"
                  className="w-full border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30 bg-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!text.trim()}
                className="flex-1 py-2.5 rounded-xl bg-[#6B7EFF] text-white text-sm font-semibold hover:bg-[#5B6EEF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to L10 ⌘↵
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-white border border-border text-slate-600 px-4 py-2.5 rounded-2xl shadow-md hover:shadow-lg hover:border-[#6B7EFF]/30 hover:text-[#6B7EFF] transition-all text-sm font-semibold group"
        >
          <Zap size={14} className="text-[#6B7EFF] group-hover:scale-110 transition-transform" />
          Add to L10
        </button>
      )}
    </div>
  );
}
