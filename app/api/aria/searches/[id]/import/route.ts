/**
 * POST /api/aria/searches/[id]/import
 *
 * Creates a show_leads record for each prospect in the saved ARIA search.
 * Skips prospects whose property name already matches an existing show_lead.
 * Returns the count of leads created.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@clerk/nextjs/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Load the saved search
    const { data: search, error: searchErr } = await supabase
      .from('aria_searches')
      .select('*')
      .eq('id', params.id)
      .single()

    if (searchErr || !search) {
      return NextResponse.json({ error: 'Search not found' }, { status: 404 })
    }

    if (new Date(search.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Search has expired' }, { status: 410 })
    }

    const results = search.results as {
      prospects: Array<{
        property: {
          name: string; address: string; units: number;
          property_type: string; management_company: string;
          isp_providers?: string[]; video_providers?: string[];
          bulk_agreements?: Array<{ provider: string; service_type: string; agreement_type: string; expiry_estimate: string }>;
          proptech?: {
            gate_operators?: string[]; access_control?: string[]; intercoms?: string[];
            cameras?: string[]; smart_locks?: string[]; resident_apps?: string[];
            package_solutions?: string[]; tech_generation?: string; sara_signals?: boolean;
            replacement_window?: string; displacement_targets?: string[];
          };
        };
        decision_maker: {
          name: string; title: string; email: string; phone: string;
        };
        pain_signals: Array<{ source: string; signal_type: string; quote: string; severity: string }>;
        profile: {
          buy_score: number; urgency: string; primary_concern: string;
          current_vendor: string; contract_window: string;
        };
        email_variants?: Array<{
          angle: string; subject: string; body: string;
          predicted_reply_rate: number; tone: string;
        }>;
        generic_reply_rate?: number;
      }>;
    }

    const prospects = results?.prospects ?? []
    if (prospects.length === 0) {
      return NextResponse.json({ error: 'No prospects in this search' }, { status: 400 })
    }

    // Check which property names already exist so we don't dupe
    const propertyNames = prospects.map(p => p.property.name).filter(Boolean)
    const { data: existingLeads } = await supabase
      .from('show_leads')
      .select('property_name')
      .in('property_name', propertyNames)

    const existingNames = new Set(
      (existingLeads ?? []).map((l: any) => l.property_name?.toLowerCase())
    )

    // Build rows to insert
    const rows = prospects
      .filter(p => !existingNames.has(p.property.name?.toLowerCase()))
      .map(p => {
        // Build notes summary from pain signals + connectivity intel
        const painLines = (p.pain_signals ?? [])
          .map(s => `[${s.severity.toUpperCase()}] ${s.signal_type}: "${s.quote}"`)
          .join('\n')

        const connLines: string[] = []
        if (p.property.isp_providers?.length) {
          connLines.push(`ISP: ${p.property.isp_providers.join(', ')}`)
        }
        if (p.property.video_providers?.length) {
          connLines.push(`Video: ${p.property.video_providers.join(', ')}`)
        }
        if (p.property.bulk_agreements?.length) {
          p.property.bulk_agreements.forEach(a => {
            connLines.push(`${a.agreement_type.toUpperCase()} ${a.service_type} agreement with ${a.provider} — expires ~${a.expiry_estimate}`)
          })
        }

        const noteParts = [
          `ARIA Buy Score: ${p.profile.buy_score}/10 (${p.profile.urgency} urgency)`,
          `Primary Concern: ${p.profile.primary_concern}`,
          p.profile.current_vendor ? `Current Vendor: ${p.profile.current_vendor}` : null,
          p.profile.contract_window ? `Contract Window: ${p.profile.contract_window}` : null,
          painLines ? `\nPain Signals:\n${painLines}` : null,
          connLines.length ? `\nConnectivity Intel (AI-estimated):\n${connLines.join('\n')}` : null,
          `\nSource query: "${search.query}"`,
        ].filter(Boolean).join('\n')

        // Parse city/state from address
        const addrParts = (p.property.address ?? '').split(',').map((s: string) => s.trim())
        const city  = addrParts[1] ?? null
        const state = addrParts[2]?.split(' ')[1] ?? null

        return {
          name:          p.decision_maker.name ?? 'Unknown Contact',
          email:         p.decision_maker.email ?? null,
          phone:         p.decision_maker.phone ?? null,
          property_name: p.property.name,
          source:        'aria',
          city,
          state,
          property_type: p.property.property_type ?? 'Multifamily',
          contact_title: p.decision_maker.title ?? null,
          units:         p.property.units ?? null,
          notes:         noteParts,
          property_intel: {
            // Connectivity
            isp_providers:   p.property.isp_providers ?? [],
            video_providers: p.property.video_providers ?? [],
            bulk_agreements: p.property.bulk_agreements ?? [],
            // PropTech
            gate_operators:      p.property.proptech?.gate_operators ?? [],
            access_control:      p.property.proptech?.access_control ?? [],
            intercoms:           p.property.proptech?.intercoms ?? [],
            cameras:             p.property.proptech?.cameras ?? [],
            smart_locks:         p.property.proptech?.smart_locks ?? [],
            resident_apps:       p.property.proptech?.resident_apps ?? [],
            package_solutions:   p.property.proptech?.package_solutions ?? [],
            tech_generation:     p.property.proptech?.tech_generation ?? 'unknown',
            sara_signals:        p.property.proptech?.sara_signals ?? false,
            replacement_window:  p.property.proptech?.replacement_window ?? null,
            displacement_targets: p.property.proptech?.displacement_targets ?? [],
            // ARIA email variants — stored so SCOUT can send without re-running ARIA
            email_variants:      p.email_variants ?? [],
            generic_reply_rate:  p.generic_reply_rate ?? 2,
            // Profile intel for SCOUT personalization
            buy_score:          p.profile.buy_score,
            urgency:            p.profile.urgency,
            primary_concern:    p.profile.primary_concern,
            current_vendor:     p.profile.current_vendor ?? null,
            contract_window:    p.profile.contract_window ?? null,
            // Metadata
            source:       'aria',
            generated_at: new Date().toISOString(),
          },
          property_intel_updated_at: new Date().toISOString(),
          property_intel_source: 'aria',
          scout_status: 'queued',
          scout_enrolled_at: new Date().toISOString(),
        }
      })

    if (rows.length === 0) {
      // All already exist — fetch their IDs so Scout can still launch campaigns
      const { data: existingLeadData } = await supabase
        .from('show_leads')
        .select('id')
        .in('property_name', propertyNames)

      return NextResponse.json({
        created: 0,
        skipped: prospects.length,
        lead_ids: (existingLeadData ?? []).map((l: { id: string }) => l.id),
        message: 'All prospects already exist as leads',
      })
    }

    const { data: created, error: insertErr } = await supabase
      .from('show_leads')
      .insert(rows)
      .select('id')

    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

    // Update imported_count + imported_at on the search
    await supabase
      .from('aria_searches')
      .update({
        imported_count: (search.imported_count ?? 0) + (created?.length ?? 0),
        imported_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    return NextResponse.json({
      created:  created?.length ?? 0,
      skipped:  prospects.length - rows.length,
      lead_ids: (created ?? []).map((r: any) => r.id),
    })
  } catch (err: any) {
    console.error('[aria/searches/import]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
