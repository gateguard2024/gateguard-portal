import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export type PlaybookStep = {
  step: number
  title: string
  content: string
  code?: string
  warning?: string
  tip?: string
}

export type Playbook = {
  id: string
  title: string
  category: 'integration' | 'configuration' | 'hardware' | 'network'
  tags: string[]
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimated_time: string
  description: string
  steps: PlaybookStep[]
  last_updated: string
}

const PLAYBOOKS: Playbook[] = [
  {
    id: 'brivo-yardi-integration',
    title: 'Brivo + Yardi API Integration',
    category: 'integration',
    tags: ['brivo', 'yardi', 'access-control', 'pms', 'residents'],
    difficulty: 'advanced',
    estimated_time: '2-3 hours',
    description:
      'Connect your Yardi PMS (RESideplus or Voyager) to Brivo so resident move-in/move-out events automatically provision and revoke access credentials. Eliminates manual Brivo updates and reduces credential leakage at move-out.',
    last_updated: '2026-05-01',
    steps: [
      {
        step: 1,
        title: 'Prerequisites',
        content:
          'Before you start, gather the following credentials and identifiers. You will need all of them before writing a single line of code.',
        tip: 'Store all credentials in your .env.local file — never commit them to git.',
        code: `# Yardi credentials (RESideplus or Voyager)
YARDI_USERNAME=your_username
YARDI_PASSWORD=your_password
YARDI_SERVER_NAME=your_server          # e.g. "PRODSQL"
YARDI_DATABASE=your_database           # e.g. "aftp_db"
YARDI_ENTITY=your_entity               # e.g. "someentity"
YARDI_PLATFORM=SQL                     # or "Azure"

# Brivo API
BRIVO_API_KEY=your_brivo_api_key
BRIVO_CLIENT_ID=your_client_id
BRIVO_CLIENT_SECRET=your_client_secret
BRIVO_SITE_ID=12345                    # Brivo Site ID for this property`,
      },
      {
        step: 2,
        title: 'Configure Yardi Webhook',
        content:
          'In your Yardi Voyager admin panel, navigate to Setup → Integrations → Event Notifications. Create a new webhook pointing to your GateGuard ingest endpoint. You want move-in and move-out events.',
        warning:
          'Yardi webhooks require your ingest URL to be publicly reachable over HTTPS. Use ngrok for local development.',
        code: `// Webhook payload shape Yardi sends on move-in / move-out
{
  "EventType": "ResidentMoveIn",       // or "ResidentMoveOut"
  "PropertyCode": "PROP001",
  "UnitNumber": "204",
  "ResidentId": "R-00012345",
  "ResidentName": "Jane Smith",
  "ResidentEmail": "jane@example.com",
  "MoveInDate": "2026-06-01",
  "MoveOutDate": null,                  // populated on move-out
  "LeaseId": "L-00098765"
}

// Ingest endpoint to configure in Yardi:
// https://your-domain.com/api/integrations/yardi/events`,
      },
      {
        step: 3,
        title: 'Map Yardi Units to Brivo Groups',
        content:
          'In Brivo, each unit number maps to an Access Group (e.g. "Building A – All Floors" or "Unit 204"). Create a mapping table in Supabase that joins Yardi unit_number to Brivo group_id. This mapping drives which credentials get provisioned.',
        code: `-- Supabase migration: yardi_brivo_unit_map
create table if not exists yardi_brivo_unit_map (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid references sites(id),
  yardi_property_code text not null,
  unit_number   text not null,
  brivo_group_id integer not null,   -- Brivo Access Group ID
  created_at    timestamptz default now(),
  unique (site_id, yardi_property_code, unit_number)
);

-- Example rows
insert into yardi_brivo_unit_map (site_id, yardi_property_code, unit_number, brivo_group_id)
values
  ('YOUR-SITE-UUID', 'PROP001', '101', 88001),
  ('YOUR-SITE-UUID', 'PROP001', '102', 88001),
  ('YOUR-SITE-UUID', 'PROP001', '204', 88002);`,
      },
      {
        step: 4,
        title: 'Create Resident Sync Function',
        content:
          'Create a TypeScript helper that handles Yardi events and calls the Brivo API to provision or revoke credentials.',
        code: `// lib/integrations/yardi-brivo-sync.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const BRIVO_BASE = 'https://auth.brivo.com'

async function getBrivoToken(): Promise<string> {
  const res = await fetch(\`\${BRIVO_BASE}/oauth/token\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.BRIVO_CLIENT_ID!,
      client_secret: process.env.BRIVO_CLIENT_SECRET!,
    }),
  })
  const data = await res.json()
  return data.access_token as string
}

export async function provisionResident(payload: {
  propertyCode: string
  unitNumber: string
  residentId: string
  residentName: string
  residentEmail: string
  siteId: string
}): Promise<{ success: boolean; brivoUserId?: number; error?: string }> {
  const token = await getBrivoToken()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: \`Bearer \${token}\`,
    'api-key': process.env.BRIVO_API_KEY!,
  }

  // 1. Look up the Brivo group for this unit
  const { data: mapping } = await supabase
    .from('yardi_brivo_unit_map')
    .select('brivo_group_id')
    .eq('site_id', payload.siteId)
    .eq('yardi_property_code', payload.propertyCode)
    .eq('unit_number', payload.unitNumber)
    .single()

  if (!mapping) {
    return { success: false, error: \`No Brivo group mapped for unit \${payload.unitNumber}\` }
  }

  // 2. Create Brivo user
  const userRes = await fetch('https://api.brivo.com/v1/api/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      firstName: payload.residentName.split(' ')[0],
      lastName: payload.residentName.split(' ').slice(1).join(' '),
      externalId: payload.residentId,
      emails: [{ address: payload.residentEmail, type: 'personal' }],
    }),
  })
  const user = await userRes.json()
  if (!userRes.ok) return { success: false, error: user.message }

  // 3. Assign user to access group
  await fetch(
    \`https://api.brivo.com/v1/api/access-objects/\${mapping.brivo_group_id}/users/\${user.id}\`,
    { method: 'PUT', headers }
  )

  // 4. Issue mobile credential
  await fetch('https://api.brivo.com/v1/api/credentials', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userId: user.id,
      credentialFormat: { id: 4 }, // 4 = Mobile Pass
    }),
  })

  return { success: true, brivoUserId: user.id }
}

export async function revokeResident(payload: {
  residentId: string
  gracePeriodHours?: number
}): Promise<{ success: boolean; scheduledAt?: string; error?: string }> {
  // Find Brivo user by externalId
  const token = await getBrivoToken()
  const headers = {
    Authorization: \`Bearer \${token}\`,
    'api-key': process.env.BRIVO_API_KEY!,
  }

  const searchRes = await fetch(
    \`https://api.brivo.com/v1/api/users?externalId=\${encodeURIComponent(payload.residentId)}\`,
    { headers }
  )
  const { data: users } = await searchRes.json()
  if (!users?.length) return { success: false, error: 'Brivo user not found' }

  const brivoUserId = users[0].id
  const gracePeriod = payload.gracePeriodHours ?? 24
  const revokeAt = new Date(Date.now() + gracePeriod * 3600 * 1000).toISOString()

  // Schedule revocation (or revoke immediately if gracePeriod === 0)
  if (gracePeriod === 0) {
    await fetch(\`https://api.brivo.com/v1/api/users/\${brivoUserId}\`, {
      method: 'DELETE',
      headers,
    })
    return { success: true }
  }

  // Store scheduled revocation in Supabase for cron to pick up
  await supabase.from('scheduled_revocations').insert({
    brivo_user_id: brivoUserId,
    resident_id: payload.residentId,
    revoke_at: revokeAt,
  })

  return { success: true, scheduledAt: revokeAt }
}`,
      },
      {
        step: 5,
        title: 'Test with a Demo Resident',
        content:
          'Before enabling live webhooks, test the sync function with a dummy resident record to make sure credentials are created and assigned correctly in Brivo.',
        code: `// scripts/test-yardi-brivo.mjs
// Run: node scripts/test-yardi-brivo.mjs

import { provisionResident } from '../lib/integrations/yardi-brivo-sync.js'

const result = await provisionResident({
  propertyCode: 'PROP001',
  unitNumber: '204',
  residentId: 'TEST-RESIDENT-001',
  residentName: 'Test Resident',
  residentEmail: 'test+resident@gateguard.co',
  siteId: 'YOUR-SITE-UUID',
})

console.log('Result:', JSON.stringify(result, null, 2))
// Expected: { success: true, brivoUserId: 12345 }
// Then log into Brivo and confirm the user + credential appear.`,
        tip: 'Check Brivo dashboard → Users to confirm the test resident was created. Delete them after testing.',
      },
      {
        step: 6,
        title: 'Enable Auto-Provisioning',
        content:
          'Create the API route that receives Yardi webhooks and calls the sync function. Deploy and update the Yardi webhook URL in your Yardi admin panel.',
        code: `// app/api/integrations/yardi/events/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { provisionResident, revokeResident } from '@/lib/integrations/yardi-brivo-sync'

export async function POST(req: NextRequest) {
  // Validate Yardi shared secret
  const secret = req.headers.get('x-yardi-secret')
  if (secret !== process.env.YARDI_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { EventType, PropertyCode, UnitNumber, ResidentId, ResidentName, ResidentEmail } = body

  if (EventType === 'ResidentMoveIn') {
    const siteId = req.nextUrl.searchParams.get('site_id') ?? ''
    const result = await provisionResident({
      propertyCode: PropertyCode,
      unitNumber: UnitNumber,
      residentId: ResidentId,
      residentName: ResidentName,
      residentEmail: ResidentEmail,
      siteId,
    })
    return NextResponse.json(result)
  }

  if (EventType === 'ResidentMoveOut') {
    const result = await revokeResident({ residentId: ResidentId, gracePeriodHours: 24 })
    return NextResponse.json(result)
  }

  return NextResponse.json({ skipped: true, eventType: EventType })
}`,
      },
      {
        step: 7,
        title: 'Configure Revocation',
        content:
          'Set up a Vercel cron job that runs nightly and revokes any credentials whose grace period has expired. This ensures move-out revocations are never missed even if the webhook fires at midnight.',
        warning: 'Without this cron, residents who move out may retain access if the scheduled_revocations row is not processed.',
        code: `// vercel.json — add this to the existing crons array
{
  "crons": [
    {
      "path": "/api/cron/revoke-credentials",
      "schedule": "0 3 * * *"
    }
  ]
}

// app/api/cron/revoke-credentials/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  if (req.headers.get('Authorization') !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: due } = await supabase
    .from('scheduled_revocations')
    .select('*')
    .lte('revoke_at', new Date().toISOString())
    .is('revoked_at', null)

  let revoked = 0
  for (const row of due ?? []) {
    // DELETE Brivo user (or just remove from all access groups)
    const token = await getBrivoToken()
    await fetch(\`https://api.brivo.com/v1/api/users/\${row.brivo_user_id}\`, {
      method: 'DELETE',
      headers: {
        Authorization: \`Bearer \${token}\`,
        'api-key': process.env.BRIVO_API_KEY!,
      },
    })
    await supabase
      .from('scheduled_revocations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', row.id)
    revoked++
  }

  return NextResponse.json({ revoked })
}`,
        tip: 'Add scheduled_revocations table via a Supabase migration: id uuid, brivo_user_id int, resident_id text, revoke_at timestamptz, revoked_at timestamptz.',
      },
    ],
  },
  {
    id: 'ggsoc-gate-api-config',
    title: 'GGSOC Gate API Configuration',
    category: 'configuration',
    tags: ['ggsoc', 'gate', 'api', 'webhook', 'access-control'],
    difficulty: 'intermediate',
    estimated_time: '30 min',
    description:
      'Wire your GGSOC (SOC at ggsoc.com) instance to the Portal so gate alarms automatically create incidents in /incidents, and you can open/close the gate via API from the SOC agent interface.',
    last_updated: '2026-05-10',
    steps: [
      {
        step: 1,
        title: 'Get GGSOC API Credentials',
        content:
          'Log into ggsoc.com with your SOC supervisor account. Navigate to Settings → API Access. Generate a new API key pair. You will see a client_id and client_secret — copy both immediately, as the secret will not be shown again.',
        tip: 'Label the key "Portal Integration" so the SOC team knows its purpose. Store in the Portal\'s Vercel env vars as GGSOC_CLIENT_ID and GGSOC_CLIENT_SECRET.',
        code: `# Add to Vercel environment (both beta and prod)
GGSOC_CLIENT_ID=ggsoc_live_xxxxxxxx
GGSOC_CLIENT_SECRET=ggsoc_sk_xxxxxxxxxxxxxxxx
GGSOC_BASE_URL=https://ggsoc.com`,
      },
      {
        step: 2,
        title: 'Configure Gate Relay Endpoint',
        content:
          'In the GGSOC agent interface, each gate device has a Relay Configuration panel. Enter the gate\'s IP address and relay port. GGSOC uses this to send open/close commands directly to the gate controller over your local LAN or VPN.',
        code: `// Relay config values (set in GGSOC dashboard per gate)
{
  "gate_id": "gate_main_entry",
  "relay_ip": "192.168.10.55",
  "relay_port": 502,          // Modbus TCP (common for LiftMaster, DoorKing)
  "relay_channel": 1,         // 1-indexed relay channel
  "open_duration_ms": 5000,   // how long to hold relay open
  "protocol": "modbus"        // or "http" for IP-based gate controllers
}`,
        warning: 'The gate controller must be on the same VLAN as the GGSOC agent machine, or reachable via the dealer\'s site VPN tunnel.',
      },
      {
        step: 3,
        title: 'Set Up Alarm-to-Work-Order Bridge',
        content:
          'Configure GGSOC to POST alarm events to the Portal ingest endpoint. The Portal creates an /incidents entry for each alarm. Set the GGSOC_INGEST_SECRET env var — this is a shared secret GGSOC will include in every POST so the Portal can verify it.',
        code: `# 1. Add to Vercel env vars
GGSOC_INGEST_SECRET=a_random_secret_you_generate

# 2. In GGSOC Settings → Alarm Webhooks, add:
#    URL: https://portal.gateguard.co/api/incidents/ingest
#    Secret header: X-GGSOC-Secret: <your secret>
#    Events: GateOffline, GateForced, TamperDetected, AlarmTriggered, AlarmCleared

// app/api/incidents/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-ggsoc-secret')
  if (secret !== process.env.GGSOC_INGEST_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { event_type, gate_id, property_name, occurred_at, severity, description } = body

  const ALERT_TYPES = ['GateOffline', 'GateForced', 'TamperDetected', 'AlarmTriggered']
  if (!ALERT_TYPES.includes(event_type)) {
    return NextResponse.json({ skipped: true })
  }

  const { error } = await supabase.from('incidents').insert({
    title: \`\${event_type} — \${property_name}\`,
    description: description ?? event_type,
    severity: severity ?? 'medium',
    source: 'ggsoc',
    source_ref: gate_id,
    occurred_at: occurred_at ?? new Date().toISOString(),
    status: 'open',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: true })
}`,
      },
      {
        step: 4,
        title: 'Test Gate Open/Close via API',
        content:
          'Before relying on this in production, test the gate open command using curl. Replace the token, base URL, and gate_id with your values.',
        code: `# 1. Get an access token
curl -X POST https://ggsoc.com/api/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{"client_id":"ggsoc_live_xxx","client_secret":"ggsoc_sk_xxx"}' \\
  | jq .access_token

# 2. Send a gate open command
curl -X POST https://ggsoc.com/api/gates/gate_main_entry/open \\
  -H "Authorization: Bearer <token_from_step_1>" \\
  -H "Content-Type: application/json" \\
  -d '{"duration_ms": 5000, "reason": "manual_test"}'

# Expected response:
# { "success": true, "gate_id": "gate_main_entry", "state": "open", "closes_at": "..." }`,
        tip: 'Test the close command too: replace /open with /close in the URL.',
      },
      {
        step: 5,
        title: 'Configure Alert Thresholds',
        content:
          'Not every GGSOC event should create an incident in Portal. Configure which alarm types auto-create incidents vs which are logged silently. Use the severity field to route urgency.',
        code: `// lib/ggsoc-alert-config.ts
export const GGSOC_ALERT_RULES: Record<string, { createIncident: boolean; severity: 'low' | 'medium' | 'high' | 'critical' }> = {
  GateOffline:      { createIncident: true,  severity: 'high' },
  GateForced:       { createIncident: true,  severity: 'critical' },
  TamperDetected:   { createIncident: true,  severity: 'critical' },
  AlarmTriggered:   { createIncident: true,  severity: 'high' },
  AlarmCleared:     { createIncident: false, severity: 'low' },
  HeartbeatMissed:  { createIncident: true,  severity: 'medium' },
  MaintenanceDue:   { createIncident: false, severity: 'low' },
}

// Import and use in /api/incidents/ingest to filter events before inserting`,
      },
      {
        step: 6,
        title: 'Verify in Portal',
        content:
          'With the bridge configured, trigger a test alarm in GGSOC (Settings → Test Alarm → GateOffline). Wait 5 seconds, then navigate to /incidents in the Portal and confirm a new incident row appears with source "ggsoc".',
        tip: 'Filter the /incidents page by Source = GGSOC to isolate these alerts. You can also check the Supabase table directly: select * from incidents where source = \'ggsoc\' order by created_at desc limit 5;',
      },
    ],
  },
  {
    id: 'raspberry-pi-unifi-brivo-bridge',
    title: 'Raspberry Pi Local Hub — UniFi Intercom ↔ Brivo Bridge',
    category: 'hardware',
    tags: ['raspberry-pi', 'unifi', 'brivo', 'intercom', 'local-hub', 'hardware'],
    difficulty: 'advanced',
    estimated_time: '3-4 hours',
    description:
      'Deploy a Raspberry Pi 4 on-site to bridge the UniFi G3 Intercom / Access Hub to Brivo. When a resident presents a fob or QR code at the UniFi reader, the Pi validates against Brivo in real time and fires the gate relay — all locally, with no cloud round-trip latency.',
    last_updated: '2026-05-15',
    steps: [
      {
        step: 1,
        title: 'Hardware Requirements',
        content:
          'Gather the following hardware before starting. Everything must be on the same local LAN (or VLAN) as your UniFi Access Hub and gate controller.',
        code: `Required hardware:
  - Raspberry Pi 4 Model B (2GB RAM minimum, 4GB recommended)
  - MicroSD card — 16GB or larger, Class 10 (Samsung Endurance Pro recommended for 24/7 use)
  - USB-C power supply (5V 3A)
  - Ethernet cable (do NOT use Wi-Fi for this — too unreliable)
  - Optional: PoE HAT (Raspberry Pi PoE+ HAT) to power via the same cable as data

Network requirements:
  - Pi, UniFi Access Hub, and gate controller must be on the same VLAN
  - Pi needs outbound internet access to reach Brivo API (api.brivo.com)
  - Recommended: assign Pi a static DHCP reservation in UniFi Network`,
        tip: 'Use the Raspberry Pi PoE+ HAT if you are running a single Ethernet cable to the Pi. It eliminates the separate power supply and simplifies the wiring.',
      },
      {
        step: 2,
        title: 'Flash and Configure Pi OS',
        content:
          'Flash Raspberry Pi OS Lite (64-bit, no desktop) to the SD card using Raspberry Pi Imager. Enable SSH and set hostname during the flash step — no monitor needed.',
        code: `# In Raspberry Pi Imager:
# OS: Raspberry Pi OS Lite (64-bit)
# Advanced Options (gear icon):
#   ✓ Set hostname: gateguard-hub
#   ✓ Enable SSH → Use password authentication
#   ✓ Set username: gg   password: <strong password>
#   ✓ Configure Wi-Fi: leave blank (using Ethernet)

# After flash, insert SD, power on Pi, find its IP via UniFi Network dashboard
# or: ping gateguard-hub.local

ssh gg@gateguard-hub.local

# Update OS
sudo apt-get update && sudo apt-get upgrade -y

# Set static IP (optional but recommended)
sudo nano /etc/dhcpcd.conf
# Add at bottom:
# interface eth0
# static ip_address=192.168.10.200/24
# static routers=192.168.10.1
# static domain_name_servers=1.1.1.1

sudo reboot`,
        tip: 'Write down the static IP you assign — you will need it when configuring the UniFi Access Hub to call back to the Pi.',
      },
      {
        step: 3,
        title: 'Install Node.js + Dependencies',
        content:
          'Install Node.js 20 LTS using the NodeSource installer, then install the npm packages the bridge script needs.',
        code: `# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version   # v20.x.x
npm --version    # 10.x.x

# Create project directory
mkdir -p /opt/gg-bridge && cd /opt/gg-bridge
npm init -y

# Install dependencies
npm install axios dotenv express ws node-cron

# Create .env file
cat > .env << 'EOF'
UNIFI_HOST=192.168.10.1
UNIFI_PORT=8443
UNIFI_API_KEY=your_unifi_local_api_key
UNIFI_SITE=default
UNIFI_ACCESS_HUB_ID=your_hub_device_id

BRIVO_API_KEY=your_brivo_api_key
BRIVO_CLIENT_ID=your_brivo_client_id
BRIVO_CLIENT_SECRET=your_brivo_client_secret
BRIVO_SITE_ID=12345

GATE_RELAY_IP=192.168.10.55
GATE_RELAY_PORT=502
LOG_LEVEL=info
EOF

chmod 600 .env`,
        warning: 'The .env file contains secrets. Set permissions to 600 so only the gg user can read it.',
      },
      {
        step: 4,
        title: 'Configure UniFi API Access',
        content:
          'Enable the UniFi Access Hub local API and generate an API key. This lets the bridge script subscribe to door/reader events.',
        code: `# In UniFi Network Controller:
# Settings → System → Advanced → Local API
# Enable: ✓ Allow Local API
# Click "Generate API Key" → copy the key → paste into .env as UNIFI_API_KEY

# Find your Access Hub device ID
curl -k -H "X-API-KEY: your_unifi_api_key" \\
  https://192.168.10.1:8443/proxy/network/v2/api/site/default/device \\
  | jq '.[].id,.[]._id,..[].name' 2>/dev/null | grep -A1 "Access Hub"

# Test the event stream (should see JSON events when someone scans a card)
curl -k -H "X-API-KEY: your_unifi_api_key" \\
  https://192.168.10.1:8443/proxy/access/api/v2/live/events`,
        tip: 'The Hub device ID looks like a MAC address string: aa:bb:cc:dd:ee:ff. Paste it into UNIFI_ACCESS_HUB_ID in .env.',
      },
      {
        step: 5,
        title: 'Configure Brivo API Access',
        content:
          'The bridge calls Brivo to validate credentials. Get your Site ID from the Brivo dashboard — it appears in the URL when you view a site: https://user.brivo.com/site/NNNNNN',
        code: `# Test Brivo API access from the Pi
curl -X POST https://auth.brivo.com/oauth/token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=\${BRIVO_CLIENT_ID}" \\
  -d "client_secret=\${BRIVO_CLIENT_SECRET}" \\
  | jq .access_token

# List users at your site (confirms connectivity)
TOKEN=$(curl -s -X POST https://auth.brivo.com/oauth/token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=\${BRIVO_CLIENT_ID}" \\
  -d "client_secret=\${BRIVO_CLIENT_SECRET}" | jq -r .access_token)

curl https://api.brivo.com/v1/api/users \\
  -H "Authorization: Bearer \$TOKEN" \\
  -H "api-key: \${BRIVO_API_KEY}" \\
  | jq '.data[0]'`,
      },
      {
        step: 6,
        title: 'Deploy the Bridge Script',
        content:
          'The bridge polls the UniFi Access event stream. When it sees a credential scan event, it looks up the credential in Brivo. If valid, it fires the Modbus relay to open the gate.',
        code: `// /opt/gg-bridge/index.js
require('dotenv').config()
const axios = require('axios')
const https = require('https')
const net = require('net')

// ─── Brivo token cache ────────────────────────────────────────────────────────
let brivoToken = null
let tokenExpiry = 0

async function getBrivoToken() {
  if (brivoToken && Date.now() < tokenExpiry) return brivoToken
  const res = await axios.post('https://auth.brivo.com/oauth/token', null, {
    params: {
      grant_type: 'client_credentials',
      client_id: process.env.BRIVO_CLIENT_ID,
      client_secret: process.env.BRIVO_CLIENT_SECRET,
    },
  })
  brivoToken = res.data.access_token
  tokenExpiry = Date.now() + (res.data.expires_in - 60) * 1000
  return brivoToken
}

// ─── Validate credential against Brivo ───────────────────────────────────────
async function validateCredential(cardNumber) {
  const token = await getBrivoToken()
  try {
    const res = await axios.get('https://api.brivo.com/v1/api/credentials', {
      headers: {
        Authorization: \`Bearer \${token}\`,
        'api-key': process.env.BRIVO_API_KEY,
      },
      params: { referenceId: cardNumber },
    })
    const cred = res.data.data?.[0]
    if (!cred) return { valid: false, reason: 'unknown_credential' }
    if (!cred.enabled) return { valid: false, reason: 'credential_disabled' }
    return { valid: true, userId: cred.userId, credentialId: cred.id }
  } catch (err) {
    console.error('Brivo validation error:', err.message)
    return { valid: false, reason: 'api_error' }
  }
}

// ─── Fire Modbus relay ────────────────────────────────────────────────────────
function openGateRelay(durationMs = 5000) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket()
    // Modbus TCP: Function 05 (Write Single Coil) — coil 0 → ON (0xFF00)
    const modbusCmd = Buffer.from([0x00,0x01, 0x00,0x00, 0x00,0x06, 0x01,0x05, 0x00,0x00, 0xFF,0x00])
    client.connect(Number(process.env.GATE_RELAY_PORT), process.env.GATE_RELAY_IP, () => {
      client.write(modbusCmd)
      setTimeout(() => {
        // Send OFF command after duration
        const offCmd = Buffer.from([0x00,0x02, 0x00,0x00, 0x00,0x06, 0x01,0x05, 0x00,0x00, 0x00,0x00])
        client.write(offCmd)
        client.destroy()
        resolve(true)
      }, durationMs)
    })
    client.on('error', (err) => { client.destroy(); reject(err) })
  })
}

// ─── Poll UniFi Access event stream ──────────────────────────────────────────
async function startEventLoop() {
  const agent = new https.Agent({ rejectUnauthorized: false }) // self-signed UniFi cert
  console.log('GateGuard bridge starting — polling UniFi Access events...')

  const res = await axios.get(
    \`https://\${process.env.UNIFI_HOST}:\${process.env.UNIFI_PORT}/proxy/access/api/v2/live/events\`,
    {
      headers: { 'X-API-KEY': process.env.UNIFI_API_KEY },
      httpsAgent: agent,
      responseType: 'stream',
      timeout: 0,
    }
  )

  res.data.on('data', async (chunk) => {
    const lines = chunk.toString().split('\\n').filter(Boolean)
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const event = JSON.parse(line.slice(5).trim())
        if (event.event !== 'access.door.credential.accepted' &&
            event.event !== 'access.door.credential.rejected') continue

        const cardNum = event.data?.credential?.card_number
        if (!cardNum) continue

        console.log(\`Credential scanned: \${cardNum} — validating with Brivo...\`)
        const result = await validateCredential(cardNum)

        if (result.valid) {
          console.log(\`✓ Valid — opening gate for user \${result.userId}\`)
          await openGateRelay(5000)
        } else {
          console.log(\`✗ Denied — \${result.reason}\`)
        }
      } catch (_) { /* malformed event, skip */ }
    }
  })

  res.data.on('error', (err) => {
    console.error('Stream error, reconnecting in 5s:', err.message)
    setTimeout(startEventLoop, 5000)
  })
}

startEventLoop().catch(console.error)`,
      },
      {
        step: 7,
        title: 'Set Up systemd Service',
        content:
          'Create a systemd service so the bridge starts automatically on boot and restarts if it crashes.',
        code: `# Create systemd unit file
sudo tee /etc/systemd/system/gg-bridge.service << 'EOF'
[Unit]
Description=GateGuard UniFi-Brivo Bridge
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=gg
WorkingDirectory=/opt/gg-bridge
ExecStart=/usr/bin/node /opt/gg-bridge/index.js
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=gg-bridge
EnvironmentFile=/opt/gg-bridge/.env

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable gg-bridge
sudo systemctl start gg-bridge

# Check status
sudo systemctl status gg-bridge`,
        tip: 'Use "sudo systemctl restart gg-bridge" after editing index.js. The service will auto-restart after any crash within 5 seconds.',
      },
      {
        step: 8,
        title: 'Test End-to-End',
        content:
          'With everything running, test the full flow: resident presents fob at the UniFi Access Hub → bridge picks up the event → validates with Brivo → fires relay → gate opens.',
        code: `# Watch live logs during test
sudo journalctl -u gg-bridge -f

# Expected output when a valid fob is scanned:
# Credential scanned: 1234567890 — validating with Brivo...
# ✓ Valid — opening gate for user 98765
# [gate relay fires, gate opens for 5 seconds]

# For an invalid/unknown fob:
# Credential scanned: 9999999999 — validating with Brivo...
# ✗ Denied — unknown_credential

# You can also trigger a manual relay open to test the gate hardware:
node -e "
require('dotenv').config()
const { openGateRelay } = require('./index.js')
openGateRelay(3000).then(() => console.log('Gate opened')).catch(console.error)
"`,
        warning: 'Stand clear of the gate during hardware testing. Alert anyone in the area before firing the relay.',
      },
      {
        step: 9,
        title: 'Monitoring + Logs',
        content:
          'The bridge logs to the systemd journal. Set up log rotation and optionally POST heartbeat events to the Portal so you know the Pi is alive.',
        code: `# View recent logs
sudo journalctl -u gg-bridge --since "1 hour ago"

# View last 50 lines
sudo journalctl -u gg-bridge -n 50 --no-pager

# Set up log rotation (journald handles this, but limit size)
sudo tee /etc/systemd/journald.conf.d/gg-bridge.conf << 'EOF'
[Journal]
SystemMaxUse=100M
SystemMaxFileSize=10M
MaxRetentionSec=7day
EOF
sudo systemctl restart systemd-journald

# Optional: heartbeat to Portal every 5 minutes
# Add to index.js using node-cron:
const cron = require('node-cron')
cron.schedule('*/5 * * * *', async () => {
  try {
    await axios.post('https://portal.gateguard.co/api/sites/YOUR-SITE-ID/heartbeat', {
      source: 'pi-bridge',
      version: '1.0.0',
      uptime: process.uptime(),
    }, {
      headers: { 'x-tech-code': process.env.TECH_ACCESS_CODE }
    })
  } catch (_) { /* non-blocking */ }
})`,
        tip: 'Forward logs to your team\'s Slack channel using a simple cron that posts errors to a Slack webhook. Add "| grep ERROR" to the journalctl pipe and POST to SLACK_WEBHOOK_URL.',
      },
    ],
  },
]

export async function GET() {
  return NextResponse.json({ playbooks: PLAYBOOKS })
}
