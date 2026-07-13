// app/api/webhooks/gate-alarm/route.ts
//
// Inbound webhook from the SOC (ggsoc.com / gateguard-dispatch-ui).
// Called by the gate-monitor cron whenever a gate goes stuck-open or is restored.
//
// Translates SOC alarm data → portal site_events so each dealer sees alerts
// for their own properties on portal.gateguard.co/alerts.
//
// Auth: X-Webhook-Secret header must equal PORTAL_WEBHOOK_SECRET env var.
//
// POST body shape:
// {
//   event:        'gate_stuck_open' | 'gate_restored',
//   account_id:   string,    // EEN account UUID — matches organizations.eagleeye_account_id
//   site_name:    string,    // zone name from SOC — fuzzy-matched to portal sites.name
//   gate_label:   string,    // e.g. 'Exit' | 'Resident' | 'Guest'
//   alarm_id:     string,    // SOC alarms.id UUID (stored in metadata for traceability)
//   idle_minutes: number,    // how long gate was idle-open before alarm
// }
//
// On gate_stuck_open:
//   - Looks up org by eagleeye_account_id → site by name (fuzzy) or first site
//   - Inserts site_events row: severity=critical, event_type=alert, resolved=false
//   - Deduplicates: skips insert if an unresolved event for this gate already exists
//
// On gate_restored:
//   - Resolves (resolved=true) any matching open critical events for this gate
//   - Inserts an info-severity audit trail event (resolved=true immediately)

import { NextResponse }  from 'next/server';
import { createClient }  from '@supabase/supabase-js';

// Use service role key — this runs server-side, bypasses RLS for writes.
// Reads by dealers still go through the normal auth + org-scoped API.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const incoming = request.headers.get('x-webhook-secret');
  if (!incoming || incoming !== process.env.PORTAL_WEBHOOK_SECRET) {
    console.warn('[gate-alarm-webhook] Rejected — bad or missing X-Webhook-Secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    event,
    account_id,
    site_name,
    gate_label,
    alarm_id,
    idle_minutes,
  } = body as {
    event:         string;
    account_id:    string;
    site_name?:    string;
    gate_label:    string;
    alarm_id?:     string;
    idle_minutes?: number;
  };

  if (!event || !account_id || !gate_label) {
    return NextResponse.json({ error: 'event, account_id, and gate_label are required' }, { status: 400 });
  }

  // ── Resolve org by EEN account ID ─────────────────────────────────────────
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('eagleeye_account_id', account_id)
    .maybeSingle();

  if (orgErr) {
    console.error('[gate-alarm-webhook] Org lookup error:', orgErr.message);
    return NextResponse.json({ error: orgErr.message }, { status: 500 });
  }

  if (!org) {
    console.warn(`[gate-alarm-webhook] No org found for eagleeye_account_id=${account_id}`);
    return NextResponse.json(
      { error: `No organization matched EEN account ${account_id}` },
      { status: 404 },
    );
  }

  // ── Resolve site ──────────────────────────────────────────────────────────
  // Strategy 1: fuzzy name match on first 3 words of site_name
  let site: { id: string; name: string } | null = null;

  if (site_name) {
    const nameTokens = site_name.trim().split(/\s+/).slice(0, 3).join('%');
    const { data: byName } = await supabase
      .from('sites')
      .select('id, name')
      .or(`master_dealer_id.eq.${org.id},org_id.eq.${org.id}`)
      .ilike('name', `%${nameTokens}%`)
      .limit(1)
      .maybeSingle();
    site = byName ?? null;
  }

  // Strategy 2: first site for this org (fallback for single-site dealers)
  if (!site) {
    const { data: fallback } = await supabase
      .from('sites')
      .select('id, name')
      .or(`master_dealer_id.eq.${org.id},org_id.eq.${org.id}`)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    site = fallback ?? null;
  }

  if (!site) {
    console.warn(`[gate-alarm-webhook] No site found for org ${org.id} (${org.name})`);
    return NextResponse.json(
      { error: `No site found for organization ${org.name}` },
      { status: 404 },
    );
  }

  // ── Handle event ──────────────────────────────────────────────────────────

  if (event === 'gate_stuck_open') {
    // Deduplication: if an unresolved critical alert for this gate already exists, skip.
    const { data: existing } = await supabase
      .from('site_events')
      .select('id')
      .eq('site_id', site.id)
      .eq('event_type', 'alert')
      .eq('severity', 'critical')
      .eq('resolved', false)
      .ilike('title', `%${gate_label}%`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(`[gate-alarm-webhook] Dedup: unresolved alert for ${gate_label} already exists at ${site.name}`);
      return NextResponse.json({ ok: true, deduped: true, site_id: site.id });
    }

    const min     = idle_minutes ?? 0;
    const minText = min > 0 ? `${min} minute${min !== 1 ? 's' : ''}` : 'an unknown duration';

    const { error: insertErr } = await supabase.from('site_events').insert({
      org_id:       org.id,
      site_id:      site.id,
      event_type:   'alert',
      event_source: 'eagle_eye',
      title:        `Gate Left Open — ${gate_label}`,
      description:  `${gate_label} has been idle-open for ${minText} with no active traffic. Confirmed by Vision AI. Possible stuck gate, mechanical fault, or unauthorized prop-open.`,
      severity:     'critical',
      resolved:     false,
      metadata: {
        soc_alarm_id: alarm_id,
        gate_label,
        idle_minutes: min,
        eagleeye_account_id: account_id,
        site_name_soc: site_name,
      },
    });

    if (insertErr) {
      console.error('[gate-alarm-webhook] Insert failed:', insertErr.message);
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    console.log(`[gate-alarm-webhook] ✓ gate_stuck_open → ${site.name} (${org.name}) — ${gate_label} ${min}min`);
    return NextResponse.json({ ok: true, site_id: site.id, org_id: org.id, site_name: site.name });
  }

  if (event === 'gate_restored') {
    // Resolve any open stuck-open alerts for this gate
    const { error: resolveErr } = await supabase
      .from('site_events')
      .update({ resolved: true })
      .eq('site_id', site.id)
      .eq('event_type', 'alert')
      .eq('severity', 'critical')
      .eq('resolved', false)
      .ilike('title', `%${gate_label}%`);

    if (resolveErr) {
      console.warn('[gate-alarm-webhook] Resolve update error (non-fatal):', resolveErr.message);
    }

    // Audit-trail info event (immediately resolved — shows in activity, not alerts tab)
    const { error: trailErr } = await supabase.from('site_events').insert({
      org_id:       org.id,
      site_id:      site.id,
      event_type:   'alert',
      event_source: 'eagle_eye',
      title:        `Gate Restored — ${gate_label}`,
      description:  `${gate_label} confirmed closed by Vision AI. Gate is now secure.`,
      severity:     'info',
      resolved:     true,
      metadata: {
        soc_alarm_id:        alarm_id,
        gate_label,
        eagleeye_account_id: account_id,
      },
    });

    if (trailErr) {
      console.error('[gate-alarm-webhook] Restore audit insert failed:', trailErr.message);
      return NextResponse.json({ error: trailErr.message }, { status: 500 });
    }

    console.log(`[gate-alarm-webhook] ✓ gate_restored → resolved alerts for ${gate_label} @ ${site.name}`);
    return NextResponse.json({ ok: true, site_id: site.id, org_id: org.id, site_name: site.name });
  }

  return NextResponse.json({ error: `Unknown event type: ${event}` }, { status: 400 });
}
