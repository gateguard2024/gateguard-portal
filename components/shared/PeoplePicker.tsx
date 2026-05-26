"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, User, Building2, Wrench, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Person {
  id: string;
  name: string;
  email?: string;
  source: "technician" | "organization" | "custom";
  role?: string;
}

interface PeoplePickerProps {
  value: string;                       // current display name (plain string stored in DB)
  onChange: (name: string) => void;    // called with new display name
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  /** inline = compact text-click mode; form = full input field */
  mode?: "inline" | "form";
  disabled?: boolean;
}

// Module-level cache so we only fetch once per page load
let suggestionCache: Person[] | null = null;
let fetchingPromise: Promise<Person[]> | null = null;

async function fetchSuggestions(): Promise<Person[]> {
  if (suggestionCache) return suggestionCache;
  if (fetchingPromise) return fetchingPromise;
  fetchingPromise = fetch("/api/eos/meetings/attendee-suggestions")
    .then(r => r.ok ? r.json() : [])
    .then((data: Person[]) => {
      suggestionCache = data;
      fetchingPromise = null;
      return data;
    })
    .catch(() => {
      fetchingPromise = null;
      return [];
    });
  return fetchingPromise;
}

// Initials avatar
function Avatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
  ];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full font-semibold shrink-0",
      size === "sm" ? "w-6 h-6 text-[10px]" : "w-7 h-7 text-xs",
      color
    )}>
      {initials || <User className="w-3 h-3" />}
    </span>
  );
}

function SourceBadge({ source }: { source: Person["source"] }) {
  if (source === "technician") return (
    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
      <Wrench className="w-2.5 h-2.5" /> Tech
    </span>
  );
  if (source === "organization") return (
    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
      <Building2 className="w-2.5 h-2.5" /> Org
    </span>
  );
  return null;
}

export default function PeoplePicker({
  value,
  onChange,
  placeholder = "Assign to…",
  className,
  inputClassName,
  mode = "form",
  disabled = false,
}: PeoplePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load suggestions when dropdown opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchSuggestions().then(data => {
      setSuggestions(data);
      setLoading(false);
    });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setAddingNew(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opens
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = query.trim()
    ? suggestions.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        (p.email || "").toLowerCase().includes(query.toLowerCase())
      )
    : suggestions;

  const exactMatch = suggestions.some(
    p => p.name.toLowerCase() === query.toLowerCase()
  );

  const select = useCallback((name: string) => {
    onChange(name);
    setOpen(false);
    setQuery("");
    setAddingNew(false);
  }, [onChange]);

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  const saveNew = () => {
    if (!newName.trim()) return;
    // Invalidate cache so new contact shows next time
    suggestionCache = suggestionCache
      ? [...suggestionCache, { id: `custom-${Date.now()}`, name: newName.trim(), email: newEmail.trim() || undefined, source: "custom" }]
      : null;
    select(newName.trim());
    setNewName("");
    setNewEmail("");
    setAddingNew(false);
  };

  // ── Inline mode: click-to-edit chip ──────────────────────────────────────
  if (mode === "inline") {
    return (
      <div ref={containerRef} className={cn("relative", className)}>
        {!open ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setOpen(true)}
            className={cn(
              "flex items-center gap-1.5 text-sm rounded px-1.5 py-0.5 hover:bg-slate-100 transition-colors group",
              disabled && "cursor-default",
              inputClassName
            )}
          >
            {value ? (
              <>
                <Avatar name={value} size="sm" />
                <span className="text-slate-700">{value}</span>
                {!disabled && (
                  <X
                    className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={clear}
                  />
                )}
              </>
            ) : (
              <span className="text-slate-400 italic text-xs">{placeholder}</span>
            )}
          </button>
        ) : (
          <Dropdown
            query={query}
            setQuery={setQuery}
            filtered={filtered}
            loading={loading}
            exactMatch={exactMatch}
            addingNew={addingNew}
            setAddingNew={setAddingNew}
            newName={newName}
            setNewName={setNewName}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            select={select}
            saveNew={saveNew}
            inputRef={inputRef}
            onClose={() => { setOpen(false); setQuery(""); }}
          />
        )}
      </div>
    );
  }

  // ── Form mode: full input field ───────────────────────────────────────────
  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 h-9 w-full border border-border rounded-lg px-3 bg-white cursor-pointer hover:border-[#6B7EFF]/50 transition-colors",
          open && "border-[#6B7EFF] ring-2 ring-[#6B7EFF]/20",
          disabled && "opacity-60 cursor-not-allowed bg-slate-50",
          inputClassName
        )}
        onClick={() => !disabled && setOpen(prev => !prev)}
      >
        {value ? (
          <>
            <Avatar name={value} size="sm" />
            <span className="flex-1 text-sm text-foreground truncate">{value}</span>
            {!disabled && (
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground shrink-0" onClick={clear} />
            )}
          </>
        ) : (
          <>
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-sm text-muted-foreground">{placeholder}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </>
        )}
      </div>

      {open && (
        <Dropdown
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          loading={loading}
          exactMatch={exactMatch}
          addingNew={addingNew}
          setAddingNew={setAddingNew}
          newName={newName}
          setNewName={setNewName}
          newEmail={newEmail}
          setNewEmail={setNewEmail}
          select={select}
          saveNew={saveNew}
          inputRef={inputRef}
          onClose={() => { setOpen(false); setQuery(""); }}
        />
      )}
    </div>
  );
}

// ── Shared dropdown panel ─────────────────────────────────────────────────────

interface DropdownProps {
  query: string;
  setQuery: (v: string) => void;
  filtered: Person[];
  loading: boolean;
  exactMatch: boolean;
  addingNew: boolean;
  setAddingNew: (v: boolean) => void;
  newName: string;
  setNewName: (v: string) => void;
  newEmail: string;
  setNewEmail: (v: string) => void;
  select: (name: string) => void;
  saveNew: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
}

function Dropdown({
  query, setQuery, filtered, loading, exactMatch,
  addingNew, setAddingNew, newName, setNewName, newEmail, setNewEmail,
  select, saveNew, inputRef, onClose,
}: DropdownProps) {
  return (
    <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
      {/* Search */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && filtered.length === 1) select(filtered[0].name);
            if (e.key === "Enter" && query && !exactMatch && filtered.length === 0) {
              select(query.trim());
            }
          }}
          placeholder="Search people…"
          className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Results list */}
      <div className="max-h-52 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">Loading contacts…</div>
        ) : filtered.length === 0 && !query ? (
          <div className="px-4 py-6 text-center text-xs text-muted-foreground">No contacts found</div>
        ) : (
          filtered.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(p.name); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 transition-colors text-left"
            >
              <Avatar name={p.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.email && <p className="text-[10px] text-muted-foreground truncate">{p.email}</p>}
              </div>
              <SourceBadge source={p.source} />
            </button>
          ))
        )}

        {/* "Use exactly what I typed" option */}
        {query.trim() && !exactMatch && (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); select(query.trim()); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 border-t border-border text-left"
          >
            <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-slate-500" />
            </span>
            <p className="text-sm text-foreground">
              Use &quot;<span className="font-medium">{query.trim()}</span>&quot;
            </p>
          </button>
        )}
      </div>

      {/* Add new contact */}
      <div className="border-t border-border">
        {!addingNew ? (
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); setAddingNew(true); }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-[#6B7EFF] hover:bg-[#6B7EFF]/5 transition-colors font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add new contact
          </button>
        ) : (
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">New contact</p>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Full name *"
              className="w-full h-8 border border-border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
              onKeyDown={e => e.key === "Enter" && saveNew()}
            />
            <input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="Email (optional)"
              type="email"
              className="w-full h-8 border border-border rounded-lg px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6B7EFF]/30"
              onKeyDown={e => e.key === "Enter" && saveNew()}
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setAddingNew(false); }}
                className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newName.trim()}
                onMouseDown={e => { e.preventDefault(); saveNew(); }}
                className="px-2.5 py-1 text-xs font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
