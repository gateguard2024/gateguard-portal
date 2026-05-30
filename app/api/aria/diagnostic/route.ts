/**
 * GET /api/aria/diagnostic
 *
 * Returns the last 5 ARIA searches with a field-by-field breakdown of what
 * was actually collected at each phase. Opens in browser — no body needed.
 *
 * Use to audit real data quality before and after engine changes.
 *
 * Usage: open beta.portal.gateguard.co/api/aria/diagnostic in browser (must be logged in)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Field presence check ──────────────────────────────────────────────────────

function present(val: unknown): boolean {
  if (val === null || val === undefined) return false
  if (typeof val === 'string') return val.trim() !== '' && val !== 'null' && val !== 'undefined'
  if (typeof val === 'number') return val > 0
  if (Array.isArray(val)) return val.length > 0
  if (typeof val === 'object') return Object.keys(val as object).length > 0
  return Boolean(val)
}

function val(v: unknown): string {
  if (!present(v)) return '—'
  if (Array.isArray(v)) return (v as unknown[]).slice(0, 3).map(x =>
    typeof x === 'object' ? (x as any).name || (x as any).provider || JSON.stringify(x).slice(0, 60) : String(x)
  ).join(', ') + (v.length > 3 ? ` (+${v.length - 3} more)` : '')
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 100)
  return String(v).slice(0, 120)
}

// ── Phase attribution — where does each final field come from? ────────────────

function analyseProspect(p: any) {
  const prop   = p?.property ?? {}
  const dm     = p?.decision_maker ?? {}
  const chain  = p?.decision_maker_chain ?? []
  const pain   = p?.pain_signals ?? []
  const scout  = p?.scout_queue ?? {}
  const conn   = scout?.connectivity ?? {}
  const proptech = prop?.proptech ?? {}
  const ownership = p?.ownership ?? {}

  return {
    phase1a: [
      { field: 'Property Name',       v: prop.name,               ok: present(prop.name) },
      { field: 'Address',             v: prop.address,            ok: present(prop.address) },
      { field: 'City',                v: prop.city,               ok: present(prop.city) },
      { field: 'State',               v: prop.state,              ok: present(prop.state) },
      { field: 'Units',               v: prop.units,              ok: present(prop.units) },
      { field: 'Year Built',          v: prop.year_built,         ok: present(prop.year_built) },
      { field: 'Phone',               v: prop.phone,              ok: present(prop.phone) },
      { field: 'Website',             v: prop.website,            ok: present(prop.website) },
      { field: 'Management Co',       v: prop.management_company, ok: present(prop.management_company) },
      { field: 'Listing ISP (amenity)', v: (prop.isp_providers ?? [])[0], ok: present(prop.isp_providers) },
    ],
    phase2: [
      { field: 'Owner Entity',        v: ownership.owner_entity,  ok: present(ownership.owner_entity) },
      { field: 'Owner Type',          v: ownership.owner_type,    ok: present(ownership.owner_type) },
      { field: 'Acquisition Year',    v: ownership.acquisition_year, ok: present(ownership.acquisition_year) },
      { field: 'ISP Providers',       v: prop.isp_providers,      ok: present(prop.isp_providers) },
      { field: 'Video Providers',     v: prop.video_providers,    ok: present(prop.video_providers) },
      { field: 'Bulk Detected',       v: prop.bulk_agreements?.length > 0 ? 'yes' : 'no', ok: (prop.bulk_agreements?.length ?? 0) > 0 },
      { field: 'Bulk Agreements',     v: prop.bulk_agreements,    ok: present(prop.bulk_agreements) },
      { field: 'ROE Detected',        v: prop.roe_detected ? 'yes' : 'no', ok: prop.roe_detected === true },
      { field: 'ROE Expiry Year',     v: prop.roe_expiry_year,    ok: present(prop.roe_expiry_year) },
      { field: 'FCC Verified',        v: prop._fcc_verified ? 'yes' : 'no', ok: prop._fcc_verified === true },
      { field: 'FCC Providers',       v: prop._fcc_providers,     ok: present(prop._fcc_providers) },
      { field: 'CapEx Signal',        v: ownership.capex_signal,  ok: present(ownership.capex_signal) },
    ],
    phase3: [
      { field: 'Gate Operators',      v: proptech.gate_operators,   ok: present(proptech.gate_operators) },
      { field: 'Access Control',      v: proptech.access_control,   ok: present(proptech.access_control) },
      { field: 'Intercoms',           v: proptech.intercoms,        ok: present(proptech.intercoms) },
      { field: 'Cameras',             v: proptech.cameras,          ok: present(proptech.cameras) },
      { field: 'Smart Locks',         v: proptech.smart_locks,      ok: present(proptech.smart_locks) },
      { field: 'Tech Generation',     v: proptech.tech_generation,  ok: present(proptech.tech_generation) },
      { field: 'Pain Signals',        v: `${pain.length} found`,    ok: pain.length > 0 },
      { field: 'Top DM Name',         v: dm.name,                   ok: present(dm.name) },
      { field: 'Top DM Title',        v: dm.title,                  ok: present(dm.title) },
      { field: 'Top DM Email',        v: dm.email,                  ok: present(dm.email) },
      { field: 'Top DM Phone',        v: dm.phone,                  ok: present(dm.phone) },
      { field: 'DM Chain Depth',      v: `${chain.length} contacts`, ok: chain.length > 0 },
      { field: 'Email Format',        v: dm.top_email_format,       ok: present(dm.top_email_format) },
    ],
    phase4: [
      { field: 'Occupancy',           v: prop.occupancy,            ok: present(prop.occupancy) },
      { field: 'Property Class',      v: prop.class,                ok: present(prop.class) },
      { field: 'Buy Score',           v: p?.profile?.buy_score,     ok: present(p?.profile?.buy_score) },
      { field: 'Key Finding',         v: p?.profile?.primary_concern, ok: present(p?.profile?.primary_concern) },
      { field: 'Behavioral Profile',  v: p?.behavioral_profile,     ok: present(p?.behavioral_profile) },
      { field: 'Pitch Strategy',      v: p?.pitch_strategy?.primary_hook, ok: present(p?.pitch_strategy) },
      { field: 'Buying Trends',       v: p?.buying_trends,          ok: present(p?.buying_trends) },
      { field: 'Outreach Plan',       v: scout?.outreach_plan ? `${Object.keys(scout.outreach_plan).length} months` : null, ok: present(scout?.outreach_plan) },
    ],
  }
}

// ── Render HTML ───────────────────────────────────────────────────────────────

function row(label: string, v: unknown, ok: boolean): string {
  const badge = ok
    ? `<span style="background:#dcfce7;color:#166534;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">✓ FOUND</span>`
    : `<span style="background:#fee2e2;color:#991b1b;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600">✗ EMPTY</span>`
  const display = ok ? `<span style="color:#1e293b;font-size:11px">${val(v)}</span>` : ''
  return `<tr>
    <td style="padding:4px 8px;color:#64748b;font-size:11px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${label}</td>
    <td style="padding:4px 8px;border-bottom:1px solid #f1f5f9">${badge} ${display}</td>
  </tr>`
}

function phaseBlock(title: string, color: string, fields: { field: string; v: unknown; ok: boolean }[]): string {
  const found = fields.filter(f => f.ok).length
  const pct = Math.round((found / fields.length) * 100)
  const bar = `<div style="height:4px;background:#e2e8f0;border-radius:2px;margin-bottom:10px"><div style="height:4px;background:${color};border-radius:2px;width:${pct}%"></div></div>`
  return `
    <div style="background:white;border-radius:8px;border:1px solid #e2e8f0;padding:12px;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:8px;height:8px;border-radius:50%;background:${color}"></div>
        <strong style="font-size:12px;color:#0f172a">${title}</strong>
        <span style="margin-left:auto;font-size:11px;color:${pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'};font-weight:600">${found}/${fields.length} (${pct}%)</span>
      </div>
      ${bar}
      <table style="width:100%;border-collapse:collapse">${fields.map(f => row(f.field, f.v, f.ok)).join('')}</table>
    </div>`
}

function renderSearch(s: any, idx: number): string {
  const results = s.results ?? {}
  const prospects = results.prospects ?? []
  const p = prospects[0]
  if (!p) return `<div style="background:#fef2f2;border-radius:8px;padding:12px;margin-bottom:16px"><strong>#${idx + 1} ${s.query}</strong> — No prospect data found</div>`

  const analysis = analyseProspect(p)

  const phase1Total = analysis.phase1a.filter(f => f.ok).length
  const phase2Total = analysis.phase2.filter(f => f.ok).length
  const phase3Total = analysis.phase3.filter(f => f.ok).length
  const phase4Total = analysis.phase4.filter(f => f.ok).length
  const totalFields = analysis.phase1a.length + analysis.phase2.length + analysis.phase3.length + analysis.phase4.length
  const totalFound  = phase1Total + phase2Total + phase3Total + phase4Total
  const overallPct  = Math.round((totalFound / totalFields) * 100)

  const date = new Date(s.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const engineVer = results.engine_version || '?'

  return `
    <div style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;padding:14px;margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span style="background:#6b7eff;color:white;border-radius:5px;padding:2px 8px;font-size:11px;font-weight:700">#${idx + 1}</span>
        <strong style="font-size:13px;color:#0f172a">${s.query}</strong>
        <span style="font-size:10px;color:#94a3b8">${date} · Engine ${engineVer}</span>
        <span style="margin-left:auto;font-size:12px;font-weight:700;color:${overallPct >= 60 ? '#16a34a' : overallPct >= 35 ? '#d97706' : '#dc2626'}">${totalFound}/${totalFields} fields (${overallPct}%)</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          ${phaseBlock('Phase 1A — Listing Sites', '#22c55e', analysis.phase1a)}
          ${phaseBlock('Phase 3 — Intelligence', '#a855f7', analysis.phase3)}
        </div>
        <div>
          ${phaseBlock('Phase 2 — Enrichment', '#f97316', analysis.phase2)}
          ${phaseBlock('Phase 4 — Sonnet Synthesis', '#3b82f6', analysis.phase4)}
        </div>
      </div>
    </div>`
}

export async function GET(_req: NextRequest) {
  try {
    // Last 5 searches across all users — admin diagnostic
    const { data: rows, error } = await supabase
      .from('aria_searches')
      .select('id, query, query_interpretation, created_at, results, search_type, user_email')
      .eq('search_type', 'deep')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      return new NextResponse(`<pre>DB error: ${error.message}</pre>`, { headers: { 'Content-Type': 'text/html' } })
    }

    if (!rows || rows.length === 0) {
      return new NextResponse(`<html><body style="font-family:sans-serif;padding:24px"><h2>No deep searches found</h2></body></html>`, {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ARIA Diagnostic — Last 5 Searches</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; }
    body { background: #f1f5f9; padding: 20px; color: #1e293b; }
    h1 { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .sub { font-size: 12px; color: #64748b; margin-bottom: 20px; }
    .legend { display:flex;gap:12px;margin-bottom:16px;font-size:10px;font-weight:600;color:#64748b }
    .leg { display:flex;align-items:center;gap:4px }
    .leg span { width:8px;height:8px;border-radius:50%;display:inline-block }
  </style>
</head>
<body>
  <h1>ARIA Diagnostic — Last 5 Deep Searches</h1>
  <p class="sub">Field-by-field breakdown of what each phase actually collected. Phase 1A = listing sites, Phase 2 = enrichment/FCC, Phase 3 = contacts/proptech, Phase 4 = Sonnet synthesis.</p>
  <div class="legend">
    <div class="leg"><span style="background:#22c55e"></span> Phase 1A</div>
    <div class="leg"><span style="background:#f97316"></span> Phase 2</div>
    <div class="leg"><span style="background:#a855f7"></span> Phase 3</div>
    <div class="leg"><span style="background:#3b82f6"></span> Phase 4</div>
  </div>
  ${rows.map((s, i) => renderSearch(s, i)).join('')}
  <p style="font-size:10px;color:#94a3b8;margin-top:8px">Data from aria_searches table. Rendered at ${new Date().toISOString()}</p>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (err: any) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;padding:24px;color:red"><h2>Error</h2><pre>${err?.message ?? String(err)}</pre></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    )
  }
}
