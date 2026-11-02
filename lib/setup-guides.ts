/**
 * Setup guides — the ONE place the "how do I set this up" steps live.
 *
 * Used by:
 *   • Systems → a property → Setup tab (checklist with live status)  components/nexus/systems/SetupTab.tsx
 *   • The floating How-to button                                     components/nexus/HowToWindow.tsx
 *   • Lexi's nexus_help tool                                         lib/lexi/nexus-guide.ts
 *
 * KEEP THIS CURRENT: when a setup screen or button changes, change the steps here
 * in the same commit. Write it so a 5th grader could follow it: one action per
 * step, the exact button name in quotes, what you should see after.
 *
 * Plain data only (no React, no server imports) so both the browser and the
 * server can use it.
 */

/** What the Setup tab checks to show a green tick. */
export type SetupCheck = 'brivo' | 'eagle_eye' | 'edge' | 'shelly' | 'unifi' | 'gate_watch' | 'door_cameras' | 'portal' | 'none'

export type SetupGuide = {
  id: string
  title: string
  /** One line: what you get once it's set up. */
  what: string
  /** Who is allowed to do it. */
  who: string
  /** Where in Nexus it's done. */
  where: string
  keywords: string
  steps: string[]
  tips?: string[]
  check: SetupCheck
  /** Systems tab to jump to after (when there is one). */
  tab?: 'live' | 'doors' | 'network' | 'controllers'
  /** Needs the corporate-only Setup & keys screen. */
  needsKeys?: boolean
  soon?: boolean
}

export const SETUP_START: SetupGuide = {
  id: 'setup-new-site',
  title: 'New property: where to start',
  what: 'The order to set up a new property so everything works the first time.',
  who: 'Gate Guard corporate (keys) · dealer admin (everything else)',
  where: 'Systems → the property → Setup tab',
  keywords: 'new site new property setup set up onboard install start checklist add feature getting started first time commission go live',
  check: 'none',
  steps: [
    'Add the property: Operations → Operations Hub → Locations → "+ Add a site". Put in the real address and unit count.',
    'Open Systems (bottom bar), search the property and tap it. Then tap the "Setup" tab. This checklist is your to-do list.',
    'Connect the systems that are installed there, in this order: Brivo (doors and gates), cameras (Eagle Eye or the Gate Guard Edge box), Shelly (relays), UniFi (internet). Each one has its own steps below.',
    'Link a camera to each gate or door: Doors & gates → the door → "Add camera".',
    'Turn on Gate Watch for each gate so you get a text if it is left open.',
    'Give the property manager their portal: Admin → Customer Portals.',
    'Come back to the Setup tab. When every line you need has a green check, the property is ready.',
  ],
  tips: ['Only Gate Guard corporate can see or type vendor logins ("Setup & keys"). Dealers: ask Gate Guard to do those steps, then do the rest yourself.'],
}

export const SETUP_GUIDES: SetupGuide[] = [
  {
    id: 'setup-brivo', title: 'Brivo (doors and gates)', check: 'brivo', tab: 'doors', needsKeys: true,
    what: 'See every door and gate, open them from Nexus, see who came in, and manage residents.',
    who: 'Gate Guard corporate',
    where: 'Systems → the property → "Setup & keys" → Brivo',
    keywords: 'brivo door gate access control unlock open remote activate credential username password api key client id secret site id control from browser',
    steps: [
      'Get the Brivo login for this property: username, password, API key, client ID, client secret, and the Brivo site ID (a number).',
      'In Nexus: Systems → the property → tap "Setup & keys" (top right).',
      'Next to Brivo tap "Set up". Fill in the boxes and tap "Save".',
      'Tap "Test". You should see "Connection works."',
      'In Brivo\'s Account Config Tool, open each door or gate and check "Control From Browser". Without it, the Open button in Nexus will not work.',
      'Close Setup. Open "Doors & gates" — every door should be listed. Tap "Unlock" on one to try it.',
    ],
    tips: ['If Open says "Brivo would not open this door", the door is missing "Control From Browser" or the Brivo login is not allowed to unlock it.'],
  },
  {
    id: 'setup-eagle-eye', title: 'Cameras: Eagle Eye', check: 'eagle_eye', tab: 'live', needsKeys: true,
    what: 'Live cameras, recordings, and camera events (motion, people, cars, plates).',
    who: 'Gate Guard corporate',
    where: 'Systems → the property → "Setup & keys" → Eagle Eye',
    keywords: 'eagle eye een camera cameras video recordings events motion plate lpr live view connect client id secret oauth',
    steps: [
      'Make sure the cameras are in this property\'s Eagle Eye account and recording to the cloud.',
      'Get the Eagle Eye client ID and client secret (from the Eagle Eye API app).',
      'In Nexus: Systems → the property → "Setup & keys" → Eagle Eye → "Set up". Paste both and tap "Save".',
      'Tap "Connect Eagle Eye". Sign in to Eagle Eye and tap Allow. You come back to Nexus.',
      'Close Setup and open the "Live" tab. The cameras should show within a minute. Tap one to open the viewer with its recordings.',
      'Camera events: in Eagle Eye, turn on motion (and line-crossing or plate reading if the camera has it) for each camera. Nexus shows what Eagle Eye records, in the viewer\'s "Events" list.',
    ],
    tips: [
      'The Eagle Eye app must list this redirect address: <your Nexus address>/api/eagle-eye/callback.',
      'No events showing? Eagle Eye only sends events for cameras where motion or analytics are turned on.',
    ],
  },
  {
    id: 'setup-edge', title: 'Cameras: Gate Guard Edge box', check: 'edge', tab: 'live', needsKeys: true,
    what: 'Fast live view and AI events from the Edge box (Jetson + Frigate) on site.',
    who: 'Gate Guard corporate',
    where: 'Systems → the property → "Setup & keys" → Gate Guard Edge',
    keywords: 'edge jetson frigate box device local camera ai events go2rtc device id address pass secret',
    steps: [
      'Install the Edge box and make sure it is online (the Edge team gives you its address and device ID).',
      'In Nexus: Systems → the property → "Setup & keys" → Gate Guard Edge → "Set up".',
      'Type the device address (like https://gge-0001.edge.gateguard.co), the device ID (like GGE-0001), and the pass secret. The secret must be the same one that is on the box.',
      'Tap "Save", then "Test".',
      'Open the "Live" tab. The Edge cameras show next to any Eagle Eye cameras.',
    ],
    tips: ['Video goes straight from the box to your screen, not through Nexus. If live view is blank but the test passed, the box may be blocked by the property\'s network.'],
  },
  {
    id: 'setup-shelly', title: 'Shelly relays (gate pulse and power reset)', check: 'shelly', tab: 'doors', needsKeys: true,
    what: 'Pulse a gate open, or turn the power off and on to reset stuck gear.',
    who: 'Gate Guard corporate',
    where: 'Systems → the property → "Setup & keys" → Shelly',
    keywords: 'shelly relay relays pulse power cycle reboot reset gate operator auth key cloud server device tag name',
    steps: [
      'In the Shelly app, name every relay at this property with the property name in it (for example "Marbella Front Gate"). Nexus only shows relays whose name includes the property name.',
      'In the Shelly app go to Settings → Authorization cloud key. Copy the key and the server name (like shelly-12-eu.shelly.cloud).',
      'In Nexus: Systems → the property → "Setup & keys" → Shelly → "Set up". Paste the key and server and tap "Save", then "Test".',
      'Open "Doors & gates". The relays show under Relays.',
      'Optional: under "Open / reset gate", set up a reset macro (relay off, wait, on, then open the gate) for a gate that gets stuck.',
    ],
    tips: ['Relay names don\'t include the property name? Fill in "Property tag in device names" with a word that is in them.'],
  },
  {
    id: 'setup-unifi', title: 'UniFi (internet and network)', check: 'unifi', tab: 'network', needsKeys: true,
    what: 'Internet speed and outages, network gear, restart a device, power-cycle a port, guest Wi-Fi codes.',
    who: 'Gate Guard corporate',
    where: 'Systems → the property → "Setup & keys" → UniFi',
    keywords: 'unifi ubiquiti network internet wifi wi-fi isp outage switch access point gateway restart power cycle poe port voucher guest cloud api key site manager',
    steps: [
      'Sign in at unifi.ui.com with the account that owns this property\'s console. Go to API and make a new API key. Copy it.',
      'In Nexus: Systems → the property → "Setup & keys" → UniFi → "Set up". Paste the key.',
      'Tap "Find my UniFi sites" and pick this property from the list.',
      'Tap "Save", then "Test".',
      'Open the "Network" tab. You should see internet history, the gear list, and connected devices.',
    ],
    tips: ['Restart, power-cycle, client list and guest codes need the console to be online and connected to the UniFi cloud.'],
  },
  {
    id: 'setup-door-cameras', title: 'Link a camera to each gate', check: 'door_cameras', tab: 'doors',
    what: 'See the right camera next to every door and gate, and on every door event.',
    who: 'Anyone who runs this property\'s systems',
    where: 'Systems → the property → Doors & gates',
    keywords: 'link camera door gate add camera door camera mapping which camera',
    steps: [
      'Connect Brivo and a camera system first (steps above).',
      'Open "Doors & gates". Next to a door tap "Add camera".',
      'Pick the camera that sees that door and tap Save.',
      'Do this for every gate and main door.',
    ],
  },
  {
    id: 'setup-gate-watch', title: 'Gate Watch (AI text if a gate is left open)', check: 'gate_watch', tab: 'doors',
    what: 'The AI checks each gate camera every 1–2 minutes and texts you if a gate stays open too long.',
    who: 'Gate Guard corporate or a dealer admin',
    where: 'Systems → the property → Doors & gates → Gate Watch',
    keywords: 'gate watch ai gate left open stuck open alert text sms camera outline teach pictures threshold minutes hold open hours',
    steps: [
      'Cameras must be connected first (Eagle Eye or Edge).',
      'Open "Doors & gates". In the Gate Watch card tap "Add a gate".',
      'Pick the camera that sees the gate. Give it a name and pick the kind of gate.',
      'Set "Alert if open longer than" (5 minutes is normal). Add the phone numbers to text. Pick the Brivo door if there is one.',
      'Outline the gate: click its corners on the picture. Include the space the gate swings or slides into. Tap "Add gate".',
      'Teach it: when the gate is closed tap "Gate is closed now — save picture". Open the gate (the "Open the gate now (Brivo)" button helps) and tap "Gate is open now — save picture". Save 2–3 of each, day and night.',
      'Tap "Test now". It should say the right answer. Done — it now watches all day.',
    ],
    tips: [
      'Gate open on purpose during the day? Add hold-open hours so it doesn\'t text then.',
      'Wrong answer? Tap "Wrong?" on the gate. That picture is saved and it learns.',
      'Two or more gates in one camera picture (entry and exit, or two lanes)? Add each one as its own gate with the same camera, and outline only that gate. Other gates on that camera show as white dashed outlines. After saving, "Add another gate on this camera" starts the next one.',
    ],
  },
  {
    id: 'setup-portal', title: 'Property manager portal', check: 'portal',
    what: 'The property manager sees cameras, gate activity, packages and billing at /portal/<name> with a PIN.',
    who: 'Gate Guard corporate',
    where: 'Admin → Customer Portals',
    keywords: 'portal property manager customer portal pin slug client dashboard',
    steps: [
      'Open Admin → Customer Portals.',
      'Pick this property and give the portal a short name (it becomes /portal/<name>).',
      'Pick which cameras and gates the manager can see, and set the PIN.',
      'Save. Open the link yourself and type the PIN to check it.',
      'Send the link and PIN to the property manager.',
    ],
  },
  {
    id: 'setup-package-room', title: 'Package Room', check: 'none', soon: true,
    what: 'iPad drop-off, door control, resident texts, pickup codes and aging. Coming soon.',
    who: 'Gate Guard corporate or a dealer admin',
    where: 'Systems → the property → Packages (coming soon)',
    keywords: 'package room packages mail delivery locker luxer hello package concierge ipad kiosk driver pickup code',
    steps: [
      'Coming soon. You will name the room, pick its door (Brivo, or the Edge box with the door board) and cameras, then pair the iPad.',
    ],
  },
]

export const ALL_SETUP_GUIDES: SetupGuide[] = [SETUP_START, ...SETUP_GUIDES]

/** Plain text of a guide (for the How-to window and Lexi). */
export function setupGuideText(g: SetupGuide): string {
  const lines = [g.what, `Who: ${g.who}.`, `Where: ${g.where}.`, '', ...g.steps.map((s, i) => `${i + 1}. ${s}`)]
  if (g.tips?.length) lines.push('', ...g.tips.map(t => `Tip: ${t}`))
  return lines.join('\n')
}
