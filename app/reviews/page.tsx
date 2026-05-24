"use client";

import { useEffect, useState, useCallback } from "react";
import { TopBar } from "@/components/layout/TopBar";
import { Star, Send, RefreshCw, ExternalLink, CheckCircle2 } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ThumbsUp, ThumbsDown } = require("lucide-react") as any;
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id:            string;
  work_order_id: string | null;
  wo_number:     string | null;
  wo_title:      string | null;
  property_name: string | null;
  tech_name:     string | null;
  reviewer_name: string | null;
  rating:        number | null;
  review_text:   string | null;
  sms_sent_at:   string | null;
  response_at:   string | null;
  google_posted: boolean;
  created_at:    string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StarRating({ rating, size = 14 }: { rating: number | null; size?: number }) {
  if (!rating) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          size={size}
          className={i <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-200"}
        />
      ))}
    </div>
  );
}

function StatusChip({ review }: { review: Review }) {
  if (review.response_at)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-500"><CheckCircle2 size={9} />Responded</span>;
  if (review.sms_sent_at)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-400/10 text-blue-500"><Send size={9} />Sent</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">Pending</span>;
}

// ─── Rating Distribution Bar Chart ───────────────────────────────────────────

function RatingDistribution({ reviews }: { reviews: Review[] }) {
  const responded = reviews.filter(r => r.rating !== null);
  const total     = responded.length;

  const counts = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: responded.filter(r => r.rating === star).length,
    pct:   total > 0 ? Math.round((responded.filter(r => r.rating === star).length / total) * 100) : 0,
  }));

  const avg = total > 0
    ? (responded.reduce((s, r) => s + (r.rating ?? 0), 0) / total).toFixed(1)
    : null;

  return (
    <div className="flex items-start gap-8">
      {/* Average score */}
      <div className="text-center shrink-0">
        <p className="text-5xl font-bold text-foreground">{avg ?? "—"}</p>
        <StarRating rating={avg ? Math.round(Number(avg)) : null} size={16} />
        <p className="text-[10px] text-muted-foreground mt-1">{total} review{total !== 1 ? "s" : ""}</p>
      </div>

      {/* Distribution bars */}
      <div className="flex-1 space-y-2">
        {counts.map(({ star, count, pct }) => (
          <div key={star} className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 w-16 shrink-0">
              <Star size={12} className="text-amber-400 fill-amber-400" />
              <span className="text-xs text-muted-foreground">{star}</span>
            </div>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
              {count > 0 ? `${count} (${pct}%)` : "0"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/reviews");
      const json = await res.json() as { reviews?: Review[] };
      setReviews(json.reviews ?? []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────
  const sent       = reviews.filter(r => r.sms_sent_at).length;
  const responded  = reviews.filter(r => r.response_at).length;
  const responseRate = sent > 0 ? Math.round((responded / sent) * 100) : 0;
  const ratedReviews = reviews.filter(r => r.rating !== null);
  const avgRating    = ratedReviews.length > 0
    ? (ratedReviews.reduce((s, r) => s + (r.rating ?? 0), 0) / ratedReviews.length).toFixed(1)
    : null;

  // Submitted reviews (with actual ratings/text)
  const submittedReviews = reviews
    .filter(r => r.rating !== null)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // ── Table columns ──────────────────────────────────────────────────
  const requestColumns: Column<Review>[] = [
    {
      key: "wo_number",
      label: "WO #",
      sortable: true,
      render: (_, row) => row.wo_number
        ? <span className="font-mono text-xs text-muted-foreground">{row.wo_number}</span>
        : <span className="text-border">—</span>,
    },
    {
      key: "property_name",
      label: "Property",
      sortable: true,
      render: (_, row) => (
        <span className="font-medium text-foreground whitespace-nowrap">
          {row.property_name ?? row.wo_title ?? "—"}
        </span>
      ),
    },
    {
      key: "tech_name",
      label: "Tech",
      render: (_, row) => (
        <span className="text-muted-foreground">{row.tech_name ?? "—"}</span>
      ),
    },
    {
      key: "sms_sent_at",
      label: "Sent At",
      sortable: true,
      render: (_, row) => (
        <span className="text-muted-foreground whitespace-nowrap">{fmtDate(row.sms_sent_at)}</span>
      ),
    },
    {
      key: "response_at",
      label: "Status",
      render: (_, row) => <StatusChip review={row} />,
    },
    {
      key: "rating",
      label: "Rating",
      render: (_, row) => <StarRating rating={row.rating} />,
    },
    {
      key: "id",
      label: "",
      render: (_, row) => (
        <button
          onClick={async e => {
            e.stopPropagation();
            // Re-send SMS by calling /api/reviews/send
            try {
              await fetch("/api/reviews/send", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                  work_order_id:  row.work_order_id,
                  reviewer_phone: row.reviewer_name, // stored in reviewer_phone column
                  wo_number:      row.wo_number,
                  property_name:  row.property_name,
                }),
              });
              void load();
            } catch { /* non-fatal */ }
          }}
          className="text-xs text-brand-400 hover:underline whitespace-nowrap"
        >
          Resend
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <TopBar
        title="Reviews"
        subtitle="Post-WO ratings and Google review management"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-accent/30 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      <div className="flex-1 p-6 space-y-6 max-w-screen-xl mx-auto w-full">

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Sent",     value: loading ? "—" : String(sent),                          icon: <Send size={16} className="text-brand-400" />,           bg: "bg-brand-400/10"   },
            { label: "Responded",      value: loading ? "—" : String(responded),                     icon: <CheckCircle2 size={16} className="text-emerald-400" />,  bg: "bg-emerald-400/10" },
            { label: "Response Rate",  value: loading ? "—" : `${responseRate}%`,                    icon: <ThumbsUp size={16} className="text-sky-400" />,          bg: "bg-sky-400/10"     },
            { label: "Avg Rating",     value: loading ? "—" : (avgRating ? `${avgRating} ★` : "—"),  icon: <Star size={16} className="text-amber-400" />,            bg: "bg-amber-400/10"   },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${s.bg}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Section 1 — Review Requests */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Send size={15} className="text-brand-400" />
            <h2 className="text-sm font-semibold">Review Requests</h2>
            {!loading && reviews.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{reviews.length} total</span>
            )}
          </div>

          <DataTable<Review>
            columns={requestColumns}
            data={reviews}
            rowKey="id"
            loading={loading}
            skeletonRows={5}
            emptyState={
              <EmptyState
                icon={<Star size={32} className="text-muted-foreground" />}
                title="No review requests yet"
                description="Review requests are sent automatically when a work order is marked complete"
              />
            }
          />
        </div>

        {/* Section 2 — Submitted Reviews */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
            <Star size={15} className="text-amber-400 fill-amber-400" />
            <h2 className="text-sm font-semibold">Submitted Reviews</h2>
            {!loading && submittedReviews.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{submittedReviews.length} reviews</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading…
            </div>
          ) : submittedReviews.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyState
                icon={<Star size={32} className="text-muted-foreground" />}
                title="No submitted reviews yet"
                description="Customer ratings will appear here after they respond to SMS requests"
              />
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Rating distribution */}
              <div className="bg-muted/30 rounded-xl p-5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Rating Distribution</h3>
                <RatingDistribution reviews={submittedReviews} />
              </div>

              {/* Review list */}
              <div className="space-y-3">
                {submittedReviews.map(review => (
                  <div key={review.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <StarRating rating={review.rating} size={13} />
                          {review.reviewer_name && (
                            <span className="text-xs font-medium text-foreground">{review.reviewer_name}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{fmtDate(review.response_at ?? review.created_at)}</span>
                        </div>
                        {review.review_text && (
                          <p className="text-sm text-foreground mt-1">{review.review_text}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          {review.wo_number && (
                            <span className="text-[10px] text-muted-foreground font-mono">{review.wo_number}</span>
                          )}
                          {review.property_name && (
                            <span className="text-[10px] text-muted-foreground">{review.property_name}</span>
                          )}
                          {review.tech_name && (
                            <span className="text-[10px] text-muted-foreground">Tech: {review.tech_name}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {(review.rating ?? 0) >= 4 && (
                          <a
                            href="https://www.google.com/maps"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-400/30 text-brand-400 text-xs font-medium hover:bg-brand-400/10 transition-colors"
                          >
                            <ExternalLink size={11} />
                            Post to Google
                          </a>
                        )}
                        {(review.rating ?? 0) < 4 && review.rating !== null && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-400 font-medium">
                            <ThumbsDown size={10} />
                            Follow up needed
                          </span>
                        )}
                        {review.google_posted && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                            <CheckCircle2 size={10} />
                            Posted to Google
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
