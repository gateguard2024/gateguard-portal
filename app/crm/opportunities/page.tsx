"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus, Search, X, MoreHorizontal, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonRow } from '@/components/ui/SkeletonRow';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──────────────────────────────────────────────────────────────────
type Stage =
  | "meet_present"
  | "survey"
  | "propose"
  | "negotiate"
  | "contract"
  | "deposit"
  | "won"
  | "lost";

type OppType =
  | 'master_agent' | 'mso' | 'dealer'
  | 'install_partner' | 'service_partner' | 'sales_partner'
  | 'property' | 'company' | 'customer';

const OPP_TYPE_BADGE: Record<OppType, string> = {
  master_agent:    'bg-violet-100 text-violet-700',
  mso:             'bg-sky-100 text-sky-700',
  dealer:          'bg-emerald-100 text-emerald-700',
  install_partner: 'bg-orange-100 text-orange-700',
  service_partner: 'bg-yellow-100 text-yellow-700',
  sales_partner:   'bg-pink-100 text-pink-700',
  property:        'bg-teal-100 text-teal-700',
  company:         'bg-blue-100 text-blue-700',
  customer:        'bg-purple-100 text-purple-700',
};

const OPP_TYPE_LABELS: Record<OppType, string> = {
  master_agent: 'Master Agent', mso: 'MSO', dealer: 'Dealer',
  install_partner: 'Install Partner', service_partner: 'Service Partner',
  sales_partner: 'Sales Partner', property: 'Property', company: 'Company', customer: 'Customer',
};

interface Opportunity {
  id: string;
  name: string;
  account_name: string;
  stage: Stage;
  opp_type?: OppType;
  amount: number;
  close_date: string;
  owner_name: string;
  owner_initials: string;
  site_contact_name?: string;
  site_contact_phone?: string;
  units?: number;
  description?: string;
  created_at: string;
  updated_at?: string;
  won_at?: string;
}

interface StageGroup {
  label: string;
  records: Opportunity[];
  total: number;
}

interface OpportunitiesResponse {
  records: Opportunity[];
  grouped: Record<Stage, StageGroup>;
  pipelineTotal: number;
  counts: { total: number; open: number; won: number };
}

interface NewOppForm {
  name: string;
  account_name: string;
  stage: Stage;
  amount: string;
  close_date: string;
  site_contact_name: string;
  site_contact_phone: string;
  units: string;
  description: string;
}

// ── Stage Config ──────────────────────────────────────────────────────────
const STAGE_CONFIG: Record<
  Stage,
  { label: string; dot: string; pill: string; col: string }
> = {
  meet_present: {
    label: "Meet & Present",
    dot: "bg-blue-400",
    pill: "bg-blue-100 text-blue-700",
    col: "bg-blue-50 border-blue-200",
  },
  survey: {
    label: "Site Survey",
    dot: "bg-violet-400",
    pill: "bg-violet-100 text-violet-700",
    col: "bg-violet-50 border-violet-200",
  },
  propose: {
    label: "Proposal",
    dot: "bg-amber-400",
    pill: "bg-amber-100 text-amber-700",
    col: "bg-amber-50 border-amber-200",
  },
  negotiate: {
    label: "Negotiate",
    dot: "bg-orange-400",
    pill: "bg-orange-100 text-orange-700",
    col: "bg-orange-50 border-orange-200",
  },
  contract: {
    label: "Contract & Sign",
    dot: "bg-cyan-400",
    pill: "bg-cyan-100 text-cyan-700",
    col: "bg-cyan-50 border-cyan-200",
  },
  deposit: {
    label: "Deposit",
    dot: "bg-teal-400",
    pill: "bg-teal-100 text-teal-700",
    col: "bg-teal-50 border-teal-200",
  },
  won: {
    label: "Closed Won",
    dot: "bg-emerald-500",
    pill: "bg-emerald-100 text-emerald-700",
    col: "bg-emerald-50 border-emerald-200",
  },
  lost: {
    label: "Lost",
    dot: "bg-red-400",
    pill: "bg-red-100 text-red-600",
    col: "bg-red-50 border-red-200",
  },
};

const KANBAN_STAGES: Stage[] = [
  "meet_present",
  "survey",
  "propose",
  "negotiate",
  "contract",
  "deposit",
  "won",
];

// ── Helpers ───────────────────────────────────────────────────────────────
function fmt$(n: number | undefined | null): string {
  if (n == null) return "$0";
  if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const BLANK_FORM: NewOppForm = {
  name: "",
  account_name: "",
  stage: "meet_present",
  amount: "",
  close_date: "",
  site_contact_name: "",
  site_contact_phone: "",
  units: "",
  description: "",
};

// ── Aging badge helper ────────────────────────────────────────────────────
function getAgingDays(updated_at: string | undefined): number | null {
  if (!updated_at) return null;
  const diffMs = Date.now() - new Date(updated_at).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function AgingBadge({ updated_at }: { updated_at?: string }) {
  const days = getAgingDays(updated_at);
  if (days == null || days < 3) return null;
  const isRed = days > 7;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${isRed ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isRed ? "bg-red-500" : "bg-amber-400"}`} />
      {days}d
    </span>
  );
}

// Build a flat map of oppId → stage for quick lookup during drag
function buildStageMap(grouped: Record<Stage, StageGroup>): Record<string, Stage> {
  const map: Record<string, Stage> = {};
  for (const stage of KANBAN_STAGES) {
    for (const opp of grouped[stage]?.records ?? []) {
      map[opp.id] = stage;
    }
  }
  return map;
}

// ── Droppable Column Wrapper ───────────────────────────────────────────────
function DroppableColumn({
  stage,
  isOver,
  children,
}: {
  stage: Stage;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: stage });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 space-y-2 overflow-y-auto rounded-xl transition-all duration-150 min-h-[80px] p-1",
        isOver && "ring-2 ring-[#6B7EFF]/40 bg-[#6B7EFF]/5"
      )}
    >
      {children}
    </div>
  );
}

// ── Sortable Opp Card ─────────────────────────────────────────────────────
function SortableOppCard({
  opp,
  isDragging: forceDragging,
}: {
  opp: Opportunity;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opp.id, data: { opp } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || forceDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <OppCard opp={opp} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function OpportunitiesPageWrapper() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}><div style={{color:'#6B7EFF'}}>Loading...</div></div>}>
      <OpportunitiesPage />
    </Suspense>
  );
}

function OpportunitiesPage() {
  const searchParams = useSearchParams();
  const initialStage = (searchParams.get("stage") as Stage) ?? null;
  const openNew = searchParams.get("new") === "1";

  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPanel, setShowPanel] = useState(openNew);
  const [form, setForm] = useState<NewOppForm>({
    ...BLANK_FORM,
    stage: initialStage ?? "meet_present",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Drag state
  const [activeOpp, setActiveOpp] = useState<Opportunity | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const columnRefs = useRef<Record<Stage, HTMLDivElement | null>>({} as Record<Stage, HTMLDivElement | null>);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        // Require a 6px move before activating drag — lets clicks through
        distance: 6,
      },
    })
  );

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/opportunities");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (initialStage && columnRefs.current[initialStage]) {
      columnRefs.current[initialStage]?.scrollIntoView({
        behavior: "smooth",
        inline: "center",
      });
    }
  }, [initialStage, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/crm/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          amount: form.amount ? parseFloat(form.amount) : null,
          units: form.units ? parseInt(form.units) : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setForm(BLANK_FORM);
      setShowPanel(false);
      await fetchData();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Drag handlers ────────────────────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    if (!data) return;
    const stageMap = buildStageMap(data.grouped);
    const oppId = event.active.id as string;
    const stage = stageMap[oppId];
    if (!stage) return;
    const opp = (data.grouped[stage]?.records ?? []).find((o: Opportunity) => o.id === oppId) ?? null;
    setActiveOpp(opp);
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over || !data) {
      setOverStage(null);
      return;
    }
    const overId = event.over.id as string;
    // If over a stage column droppable
    if ((KANBAN_STAGES as string[]).includes(overId)) {
      setOverStage(overId as Stage);
      return;
    }
    // If over another card, look up that card's stage
    const stageMap = buildStageMap(data.grouped);
    const targetStage = stageMap[overId];
    setOverStage(targetStage ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveOpp(null);
    setOverStage(null);

    const { active, over } = event;
    if (!over || !data) return;

    const oppId = active.id as string;
    const overId = over.id as string;

    // Determine current stage
    const stageMap = buildStageMap(data.grouped);
    const currentStage = stageMap[oppId];
    if (!currentStage) return;

    // Determine target stage
    let targetStage: Stage;
    if ((KANBAN_STAGES as string[]).includes(overId)) {
      targetStage = overId as Stage;
    } else {
      targetStage = stageMap[overId] ?? currentStage;
    }

    if (targetStage === currentStage) return;

    // Optimistic update
    const opp = (data.grouped[currentStage]?.records ?? []).find((o) => o.id === oppId);
    if (!opp) return;
    const updatedOpp = { ...opp, stage: targetStage };

    setData((prev) => {
      if (!prev) return prev;
      const newGrouped = { ...prev.grouped };
      newGrouped[currentStage] = {
        ...newGrouped[currentStage],
        records: (newGrouped[currentStage]?.records ?? []).filter((o) => o.id !== oppId),
      };
      newGrouped[targetStage] = {
        ...newGrouped[targetStage],
        records: [updatedOpp, ...(newGrouped[targetStage]?.records ?? [])],
      };
      const newRecords = prev.records.map((r) =>
        r.id === oppId ? updatedOpp : r
      );
      return { ...prev, grouped: newGrouped, records: newRecords };
    });

    // Persist to API
    try {
      const res = await fetch(`/api/crm/opportunities/${oppId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: targetStage }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // Revert on failure
      await fetchData();
    }
  };

  const grouped = data?.grouped ?? ({} as Record<Stage, StageGroup>);

  // Filter by search
  const filteredGrouped = Object.fromEntries(
    KANBAN_STAGES.map((stage) => [
      stage,
      (grouped[stage]?.records ?? []).filter(
        (o) =>
          !search ||
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          (o.account_name ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    ])
  ) as Record<Stage, Opportunity[]>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      <TopBar
        title="Opportunities"
        subtitle="Pipeline view"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] w-48"
              />
            </div>
            <button
              onClick={() => {
                setForm(BLANK_FORM);
                setShowPanel(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] transition-colors"
            >
              <Plus size={14} />
              New Opportunity
            </button>
          </div>
        }
      />

      {/* Pipeline Summary Bar */}
      {!loading && data && (
        <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-3 overflow-x-auto flex-shrink-0">
          {KANBAN_STAGES.map((stage) => {
            const cfg = STAGE_CONFIG[stage];
            const recs = grouped[stage]?.records ?? [];
            const total = recs.reduce((s, r) => s + (r.amount ?? 0), 0);
            return (
              <button
                key={stage}
                onClick={() => {
                  columnRefs.current[stage]?.scrollIntoView({
                    behavior: "smooth",
                    inline: "center",
                    block: "nearest",
                  });
                }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80",
                  cfg.col
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                <span>{cfg.label}</span>
                <span className="font-mono">{fmt$(total)}</span>
                <span className="opacity-60">({recs.length})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchData}
            className="text-xs font-medium underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto px-6 py-5">
        {loading ? (
          <div className="px-6 py-5">
            <SkeletonRow rows={6} cols={5} />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 pb-4" style={{ minHeight: "calc(100vh - 220px)" }}>
              {KANBAN_STAGES.map((stage) => {
                const cfg = STAGE_CONFIG[stage];
                const opps = filteredGrouped[stage] ?? [];
                const colTotal = opps.reduce((s, r) => s + (r.amount ?? 0), 0);
                const isColumnOver = overStage === stage;
                return (
                  <div
                    key={stage}
                    ref={(el) => { columnRefs.current[stage] = el; }}
                    className="min-w-[240px] max-w-[260px] flex flex-col"
                  >
                    {/* Column Header */}
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)} />
                      <span className="text-sm font-semibold text-foreground flex-1 truncate">
                        {cfg.label}
                      </span>
                      <span className="text-xs font-mono bg-white border border-border px-1.5 py-0.5 rounded-full text-muted-foreground">
                        {opps.length}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono px-1 mb-2">
                      {fmt$(colTotal)}
                    </div>

                    {/* Cards — droppable zone */}
                    <SortableContext
                      items={opps.map((o) => o.id)}
                      strategy={verticalListSortingStrategy}
                      id={stage}
                    >
                      <DroppableColumn stage={stage} isOver={isColumnOver}>
                        {opps.map((opp) => (
                          <SortableOppCard key={opp.id} opp={opp} />
                        ))}

                        {opps.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50">
                            <p className="text-xs">No opportunities</p>
                          </div>
                        )}

                        {/* Add button */}
                        <button
                          onClick={() => {
                            setForm({ ...BLANK_FORM, stage });
                            setShowPanel(true);
                          }}
                          className="w-full py-2 text-xs text-muted-foreground border border-dashed border-border rounded-xl hover:border-[#6B7EFF] hover:text-[#6B7EFF] transition-colors flex items-center justify-center gap-1"
                        >
                          <Plus size={12} />
                          Add
                        </button>
                      </DroppableColumn>
                    </SortableContext>
                  </div>
                );
              })}
            </div>

            {/* Drag overlay — ghost card that follows the cursor */}
            <DragOverlay dropAnimation={null}>
              {activeOpp ? (
                <div className="rotate-1 scale-105 shadow-2xl">
                  <OppCard opp={activeOpp} isOverlay />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* New Opportunity Slide-over */}
      {showPanel && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
            onClick={() => setShowPanel(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-white z-50 shadow-xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">New Opportunity</h2>
              <button
                onClick={() => setShowPanel(false)}
                className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {submitError && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {submitError}
                </div>
              )}

              <Field label="Opportunity Name *">
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Ashford Glen Phase 2"
                  className={inputCls}
                />
              </Field>

              <Field label="Account Name">
                <input
                  type="text"
                  value={form.account_name}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  placeholder="e.g. Pegasus Residential"
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Opportunity Type">
                  <select
                    value={(form as NewOppForm & { opp_type?: string }).opp_type ?? ""}
                    onChange={(e) => setForm({ ...form, opp_type: e.target.value } as never)}
                    className={inputCls}
                  >
                    <option value="">Select type…</option>
                    {(Object.keys(OPP_TYPE_LABELS) as OppType[]).map(t => (
                      <option key={t} value={t}>{OPP_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Stage">
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value as Stage })}
                    className={inputCls}
                  >
                    {KANBAN_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_CONFIG[s].label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Amount ($)">
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="e.g. 45000"
                  className={inputCls}
                />
              </Field>

              <Field label="Close Date">
                <input
                  type="date"
                  value={form.close_date}
                  onChange={(e) => setForm({ ...form, close_date: e.target.value })}
                  className={inputCls}
                />
              </Field>

              <Field label="Site Contact Name">
                <input
                  type="text"
                  value={form.site_contact_name}
                  onChange={(e) => setForm({ ...form, site_contact_name: e.target.value })}
                  placeholder="e.g. Maria Reyes"
                  className={inputCls}
                />
              </Field>

              <Field label="Site Contact Phone">
                <input
                  type="tel"
                  value={form.site_contact_phone}
                  onChange={(e) => setForm({ ...form, site_contact_phone: e.target.value })}
                  placeholder="(404) 555-0100"
                  className={inputCls}
                />
              </Field>

              <Field label="Units">
                <input
                  type="number"
                  min="0"
                  value={form.units}
                  onChange={(e) => setForm({ ...form, units: e.target.value })}
                  placeholder="e.g. 312"
                  className={inputCls}
                />
              </Field>

              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Notes about this opportunity…"
                  className={cn(inputCls, "resize-none")}
                />
              </Field>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-slate-50">
              <button
                type="button"
                onClick={() => setShowPanel(false)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !form.name.trim()}
                className="px-4 py-2 text-sm font-medium bg-[#6B7EFF] text-white rounded-lg hover:bg-[#5a6de8] disabled:opacity-50 transition-colors"
              >
                {submitting ? "Creating…" : "Create Opportunity"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Opp Card ──────────────────────────────────────────────────────────────
function OppCard({
  opp,
  dragHandleProps,
  isOverlay,
}: {
  opp: Opportunity;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  isOverlay?: boolean;
}) {
  function fmt$(n: number | undefined | null): string {
    if (n == null) return "$0";
    if (n >= 1_000_000) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-border p-3 hover:shadow-md hover:border-[#6B7EFF]/30 transition-all group relative",
        isOverlay && "shadow-2xl border-[#6B7EFF]/40 ring-2 ring-[#6B7EFF]/20"
      )}
    >
      {/* Drag handle — touch/grab target, doesn't interfere with link */}
      <div
        {...dragHandleProps}
        className="absolute top-2.5 right-8 p-1 rounded text-muted-foreground opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing transition-all touch-none"
        onClick={(e) => e.preventDefault()}
        aria-label="Drag to reorder"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="8" cy="3" r="1.2" />
          <circle cx="4" cy="6" r="1.2" />
          <circle cx="8" cy="6" r="1.2" />
          <circle cx="4" cy="9" r="1.2" />
          <circle cx="8" cy="9" r="1.2" />
        </svg>
      </div>

      <Link href={`/crm/opportunities/${opp.id}`} className="block">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="text-sm font-semibold text-foreground truncate leading-tight pr-8">
            {opp.name}
          </p>
          <button
            onClick={(e) => e.preventDefault()}
            className="p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-accent transition-all flex-shrink-0"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
        {opp.account_name && (
          <p className="text-xs text-muted-foreground truncate mb-1">
            {opp.account_name}
          </p>
        )}
        {opp.opp_type && OPP_TYPE_BADGE[opp.opp_type] && (
          <span className={cn(
            "inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded-full mb-2",
            OPP_TYPE_BADGE[opp.opp_type]
          )}>
            {OPP_TYPE_LABELS[opp.opp_type]}
          </span>
        )}
        <p className="text-base font-bold text-[#6B7EFF] mb-2">{fmt$(opp.amount)}</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {opp.close_date ? (
              <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                {new Date(opp.close_date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            ) : null}
            <AgingBadge updated_at={opp.updated_at} />
          </div>
          {opp.owner_initials && (
            <div className="w-6 h-6 rounded-full bg-[#6B7EFF]/20 border border-[#6B7EFF]/30 flex items-center justify-center text-[10px] font-bold text-[#6B7EFF]">
              {opp.owner_initials}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6B7EFF] bg-white";

// Suppress unused import warning — ChevronRight is kept for future use
void ChevronRight;
