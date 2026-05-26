/**
 * POST /api/kb/seed-articles
 *
 * Seeds starter KB articles covering the 8 knowledge base categories.
 * Safe to call multiple times — skips articles whose title already exists.
 *
 * Body: { dry_run?: boolean }
 *
 * Requires: Clerk auth (admin only in practice; guards against accidental public call)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth }                       from '@clerk/nextjs/server'
import { serviceDb, embedBatch }      from '@/lib/vectorize'

export const maxDuration = 120
export const dynamic     = 'force-dynamic'

// ─── Starter articles (category → articles[]) ────────────────────────────────

const STARTER_ARTICLES = [

  // ── Gate Systems ──────────────────────────────────────────────────────────

  {
    category:   'Gate Systems',
    title:      'Gate won\'t open — full diagnostic checklist',
    description: 'Step-by-step checklist for diagnosing a gate that fails to open from any trigger (keypad, fob, vehicle loop, or app).',
    difficulty: 'Basic',
    content: `SYMPTOM: Gate won't open from any trigger

STEP 1 — VERIFY POWER
Check that the operator has 115VAC at the power input terminals (L1 and L2). Measure with a multimeter set to ACV. Expected: 115 ± 10V. If no power, trace the circuit breaker in the electrical panel.

STEP 2 — CHECK DISPLAY / LIGHTS
Most operators have an LED or LCD status indicator. A dark display with power present often means a blown fuse on the control board. Check the on-board fuse (typically 5A automotive) and replace if blown.

STEP 3 — SAFETY DEVICE CHECK
Gate operators will not run if a safety input is tripped. Check:
- Photobeam alignment (TX and RX LEDs should be solid, not flashing)
- Vehicle loop detector — test with a large metal object under the loop
- Obstruction sensor / ENTRAP loop — may show as steady red on the detector

STEP 4 — RELAY TEST
Using a jumper wire, briefly connect the COM and NO terminals on the access relay (typically Relay 1 on DoorKing boards). If the gate opens, the operator is fine and the issue is upstream in the access control wiring.

STEP 5 — MOTOR / CAPACITOR
If relay test passes and gate still won't move, check the run capacitor (typical: 25–35 µF for swing operators). A failed capacitor causes motor hum with no movement. Replace the capacitor and retest.

RESOLUTION: Most gate-won't-open calls fall into Step 1 (tripped breaker), Step 3 (misaligned photobeam), or Step 4 (access relay wiring). Confirm the root cause before leaving site.`,
    active: true,
  },

  {
    category:   'Gate Systems',
    title:      'Gate opens but won\'t close — loop detector / obstruction fault',
    description: 'Gate cycles open but stops before closing or immediately reverses. Usually a loop detector or shadow loop issue.',
    difficulty: 'Basic',
    content: `SYMPTOM: Gate opens fine but won't close, or reverses before fully closed

MOST COMMON CAUSE: A vehicle loop detector is sensing a vehicle (or false loop) and holding the gate open.

STEP 1 — IDENTIFY WHICH LOOP
DoorKing operators have distinct loops: OPEN loop (triggers open), CLOSE/SHADOW loop (prevents closing on a vehicle), ENTRAP/REVERSE loop (reopens if gate hits object). Check all loop detector LEDs — any solid or blinking red means that loop is detecting.

STEP 2 — TEST THE SHADOW LOOP
Drive a vehicle completely off the driveway pad. If the gate now closes, the shadow loop was detecting a vehicle or is oversensitive. Adjust the sensitivity trim pot on the detector (clockwise = less sensitive).

STEP 3 — CHECK FOR WIRING ISSUES
A broken loop wire will cause the detector to show a permanent "detect" state. Use a multimeter on ohms: measure loop resistance at the detector terminals. A 6-foot square loop of 14AWG should read about 0.2–0.5 Ω. >10 Ω or open circuit = broken wire.

STEP 4 — BYPASS TEST
Most operators have a timer close feature (timed auto-close). Enable it temporarily via the operator DIP switches or menu to confirm the operator itself can close — rules out a motor / limit switch issue vs a loop hold-open.

RESOLUTION: Adjust shadow loop sensitivity or replace damaged loop wire. If using inductive loops in an asphalt driveway with cracks, recommend installing a sealed replacement loop.`,
    active: true,
  },

  {
    category:   'Gate Systems',
    title:      'DoorKing operator error codes E3 / E7 — limit switch adjustment',
    description: 'E3 (gate didn\'t reach open limit) and E7 (gate didn\'t reach close limit) on DoorKing 6000/9000-series operators. Limit switch and obstruction troubleshooting.',
    difficulty: 'Intermediate',
    content: `SYMPTOM: DoorKing operator displays E3 or E7 error code

E3 = Gate failed to reach the open limit within the allotted time
E7 = Gate failed to reach the close limit within the allotted time

STEP 1 — CLEAR AND RETEST
Press and hold the OPEN button to clear the fault. Manually observe the gate while it cycles. Listen for motor hesitation or grinding that would indicate a mechanical bind.

STEP 2 — MECHANICAL CHECK
Inspect the arm, pivot points, chain/belt (on DK6050/9050), and any crash stops. Lubricate all pivot pins with white lithium grease. A stiff pivot under load will cause the operator to timeout before reaching the limit.

STEP 3 — LIMIT SWITCH ADJUSTMENT
Open the operator cover. Locate the open limit cam and close limit cam on the output shaft assembly. The micro-switch plunger should contact the cam smoothly — not abruptly. Adjust the cam position: loosen the set screw, rotate the cam so the switch trips just before the gate reaches the physical stop, retighten.

STEP 4 — TIMER SETTING
If limits are correct but E3/E7 still appears, the open/close timer may be set too short for the gate travel distance. Enter programming mode and increase the OPEN TIME and CLOSE TIME values by 2–3 seconds.

STEP 5 — MOTOR LOAD TEST
Measure motor amperage during a full open cycle with a clamp meter. Compare to nameplate rating (typically 4–6A running). >8A running = excessive load; check for bind or seized gearbox.

RESOLUTION: 80% of E3/E7 faults resolve with limit cam adjustment + lubrication. If recurring after adjustment, inspect chain tension (DK6050: 1/2" slack is correct) or replace the output shaft assembly.`,
    active: true,
  },

  // ── Camera Systems ────────────────────────────────────────────────────────

  {
    category:   'Camera Systems',
    title:      'Camera offline — Eagle Eye / NVR troubleshooting',
    description: 'Camera shows offline in Eagle Eye or NVR. Power, PoE, and network diagnostic steps.',
    difficulty: 'Basic',
    content: `SYMPTOM: Camera showing offline in Eagle Eye dashboard or NVR

STEP 1 — VERIFY PoE POWER
At the PoE switch, check the port LED for the camera's port. A solid amber LED usually means PoE is active; no LED means no PoE. Verify the port is enabled in the UniFi switch controller and PoE mode is set to "Auto" (not off).

Measure voltage at the camera's RJ45 jack with a PoE tester — should read 48VDC nominal (44–57V range).

STEP 2 — CABLE CONTINUITY
A failed pair in CAT5/6 will prevent PoE from reaching the camera. Run a continuity test (T568B pinout: pins 1,2,3,6 carry data; pins 4,5,7,8 carry PoE). A single broken pair kills the camera even if partial continuity exists.

STEP 3 — POWER CYCLE
Disable PoE on the port in UniFi for 10 seconds, then re-enable. Most cameras boot in 45–90 seconds. If this restores the camera temporarily but it goes offline again, check for overheating or intermittent cable.

STEP 4 — PING TEST
From a laptop on the same VLAN, ping the camera IP. If it responds but Eagle Eye still shows offline, the issue is with the Eagle Eye CMVR registration, not connectivity. Log into the CMVR web interface and force a re-sync.

STEP 5 — REPLACE CAMERA
If no PoE, no ping, and cable tests good, the camera itself has failed. Eagle Eye cameras typically have a 2-year hardware warranty — initiate RMA through Eagle Eye partner portal.

RESOLUTION: Most camera offline calls are PoE switch issues (disabled port, insufficient PoE budget) or cable failures. Rule out both before replacing hardware.`,
    active: true,
  },

  {
    category:   'Camera Systems',
    title:      'Camera image blurry or no video — focus and IR cut filter',
    description: 'Camera is online but image is blurry, washed out at night, or shows as a white screen. Focus, IR cut filter, and lens cleaning.',
    difficulty: 'Basic',
    content: `SYMPTOM: Camera is online but video is blurry, washed out at night, or appears as solid white

CAUSE A — DIRTY DOME / LENS
Use a microfiber cloth to clean the dome bubble. Spider webs, condensation residue, and dust on the inside of the dome cause diffused / hazy image. For internal condensation, remove the dome and use a desiccant packet.

CAUSE B — VARIFOCAL LENS OUT OF FOCUS
Some cameras ship with motorized zoom lenses. Log into the camera web interface (direct IP) → PTZ or Image settings → Auto Focus. If manual, use the zoom/focus dials on the lens housing. View a distant subject (a license plate or sign 30+ feet away) while adjusting.

CAUSE C — IR OVEREXPOSURE AT NIGHT (white screen)
If the camera is mounted too close to a reflective surface (white wall, glass), the IR LEDs flood back into the lens. Reposition the camera away from reflective surfaces, or cover 2–3 of the IR LEDs with black electrical tape to reduce intensity.

CAUSE D — IR CUT FILTER STUCK
During daylight the IR cut filter should be IN (blocks IR for color accuracy). At night it should swing OUT (allows IR light). A stuck filter causes washed-out color video at night or black-and-white video during the day. Power cycle the camera; if persistent, the filter mechanism needs replacement.

CAUSE E — INCORRECT WDR / EXPOSURE SETTING
In bright outdoor scenes, Wide Dynamic Range (WDR) should be enabled. Log into the camera interface → Image → WDR: On. Reduces blown highlights (sky, windows) and crushed shadows.

RESOLUTION: Clean dome first (fastest fix). For night-only issues, test IR cut filter with a power cycle. For daytime overexposure, enable WDR.`,
    active: true,
  },

  // ── Access Control ────────────────────────────────────────────────────────

  {
    category:   'Access Control',
    title:      'Brivo reader flashing red — credential not recognized',
    description: 'Brivo door reader flashing red when credential is presented. Troubleshooting unrecognized fobs, mobile credentials, and reader connectivity.',
    difficulty: 'Basic',
    content: `SYMPTOM: Brivo reader flashes red and door doesn't unlock when credential is presented

FLASH PATTERN MEANINGS:
- Solid red pulse: credential not recognized by the panel (or panel offline)
- Rapid red flash: panel connected, credential known but access denied for this door/time
- No response at all: reader may be offline / not getting power

STEP 1 — VERIFY PANEL CONNECTIVITY
In Brivo Onair (web), check the panel status. A yellow or red indicator means the panel is offline. Most panel issues are network-related — confirm the panel's LAN port has link and the panel can reach *.brivo.com on port 443.

STEP 2 — CHECK CREDENTIAL IN BRIVO
Look up the user in Brivo Onair → confirm the credential (fob number or mobile) is assigned, active (not expired), and the user has access to this door in their Group's schedule.

STEP 3 — SYNC PANEL
In Brivo Onair → Devices → select the panel → "Sync Panel." This pushes updated credential and schedule data down. Wait 60 seconds then test again.

STEP 4 — MOBILE CREDENTIAL ISSUE
For Brivo Mobile Pass: confirm the user has a mobile credential in Brivo Onair (not just a PIN/fob). The user must have Bluetooth enabled and the app open (background BLE varies by phone model). Test with a physical fob first to isolate whether it's a credential issue vs mobile-specific.

STEP 5 — READER VOLTAGE CHECK
Measure the reader's red and black wires at the panel's reader port terminals. Should read 12VDC ± 1V. Under 10V = insufficient power, causing intermittent reads. Check wire gauge (26AWG max run is ~100 ft at 12V).

RESOLUTION: 70% of "flashing red" calls are either a sync issue (Step 3) or an expired/misconfigured credential (Step 2). Always check Brivo Onair before replacing hardware.`,
    active: true,
  },

  {
    category:   'Access Control',
    title:      'Door held open / forced door alarm — Brivo troubleshooting',
    description: 'Brivo is generating "Door Held Open" or "Door Forced" alerts. Door sensor calibration and strike/mag lock troubleshooting.',
    difficulty: 'Intermediate',
    content: `SYMPTOM: Brivo generates repeated "Door Held Open" or "Door Forced" alerts

DOOR HELD OPEN: Door was unlocked but not re-secured within the configured "door held open" time (default 30 seconds in most configs).

DOOR FORCED: Door was opened without a valid credential — monitored circuit shows open state without prior unlock event.

TROUBLESHOOTING HELD OPEN:

1. Confirm the door closes and latches fully — a misaligned strike plate or worn door closer causes the door to latch slowly, triggering the timer. Adjust the door closer spring tension (ISO 2–4 for standard doors).

2. Check the magnetic door position sensor — it should read CLOSED (circuit complete) when the door is fully shut. In Brivo Onair → Device I/O, verify the door sensor shows "Secured" state with the door closed.

3. If the door closer is mechanical, verify it has enough tension to pull a heavy exterior door against wind pressure. Consider upgrading to a higher-duty closer.

4. Increase "Door Held Open" time in Brivo Onair → Door Configuration → Held Open Time: increase from 30s to 45s if users are slow to clear the doorway.

TROUBLESHOOTING DOOR FORCED:

1. Confirm the door sensor is correctly mounted — sensor face aligned within 1/8" of the magnet. A gap >1/4" causes false "open" readings.

2. Check for vibration — HVAC blowers or traffic vibration can momentarily trip a poorly mounted sensor.

3. Rule out tailgating — if alerts occur at predictable times (shift change, deliveries), the door may be propped or someone is physically preventing latching.

RESOLUTION: Most false alerts resolve with door closer adjustment + sensor alignment. Configure Brivo Onair alert thresholds to reduce noise while keeping real security alerts actionable.`,
    active: true,
  },

  // ── Networking & Connectivity ─────────────────────────────────────────────

  {
    category:   'Networking & Connectivity',
    title:      'UniFi device adoption failed — can\'t adopt AP or switch',
    description: 'UniFi controller shows a device as pending adoption but adoption fails or device goes to "Managed by Other". Common causes and fixes.',
    difficulty: 'Intermediate',
    content: `SYMPTOM: UniFi device shows in controller as "Pending Adoption" but adoption fails, or shows "Managed by Other"

CAUSE 1 — DEVICE PREVIOUSLY ADOPTED BY ANOTHER CONTROLLER
The device has a controller IP stored in its config. You must factory reset it first:
- For APs: hold the reset button 10 seconds until LED flashes white. Device reboots into factory state.
- For switches: hold reset on back of unit 10 seconds.
After factory reset, the device appears as "Pending Adoption" on the same L2 network as the controller.

CAUSE 2 — CONTROLLER NOT ON SAME SUBNET (L3 adoption)
UniFi adoption uses L2 broadcast by default. If the device is on a different VLAN/subnet:
1. SSH into the device: ssh ubnt@<device_ip> (default pass: ubnt)
2. Run: set-inform http://<controller_ip>:8080/inform
3. In the controller, click Adopt within 30 seconds.

CAUSE 3 — INFORM URL MISMATCH
If the controller moved IPs, devices may still be pointing to the old IP. SSH into each device and run set-inform with the new controller IP/hostname.

CAUSE 4 — FIREWALL BLOCKING PORT 8080
Controller communication uses TCP 8080 (inform) and TCP 8443 (portal). Ensure these ports are reachable from the device VLAN to the controller IP. Test with: curl http://<controller_ip>:8080/inform from a device on the same subnet.

RESOLUTION: Factory reset + set-inform via SSH resolves 90% of adoption failures. For large deployments, use DHCP option 43 to auto-provision the controller IP.`,
    active: true,
  },

  {
    category:   'Networking & Connectivity',
    title:      'PoE budget exceeded — devices dropping offline',
    description: 'Multiple PoE devices (cameras, APs, readers) drop offline intermittently or after adding a new device. PoE budget troubleshooting.',
    difficulty: 'Basic',
    content: `SYMPTOM: Devices drop offline intermittently, especially after adding a new PoE device. Multiple devices affected.

ROOT CAUSE: PoE switch has a total power budget (watts) shared across all PoE ports. When total draw exceeds the budget, the switch drops lower-priority ports.

STEP 1 — CHECK TOTAL PoE DRAW
In UniFi Network → Devices → select the switch → Ports tab. Each port shows actual wattage being drawn. Sum all active PoE ports. Compare to the switch's PoE budget:
- USW-24-PoE: 95W total budget
- USW-48-Pro: 195W total budget
- USW-Enterprise-24: 400W

STEP 2 — IDENTIFY HIGH DRAW DEVICES
PTZ cameras draw 15–25W. Dome cameras: 8–12W. APs: 12–18W. Door stations: 6–10W. Identify any devices drawing unexpectedly high wattage (could indicate a failing PSU inside the device).

STEP 3 — REDISTRIBUTE LOAD
If budget is exceeded:
- Move some devices to a second PoE injector or switch
- On UniFi switches, use the port PoE priority settings to protect critical devices (cameras) over lower-priority ones (decorative lights, etc.)
- Disable PoE on any inactive ports

STEP 4 — UPGRADE THE SWITCH
If load consistently exceeds 80% of budget, plan for a higher-wattage switch. A USW-Enterprise-24 (400W) handles large camera deployments.

STEP 5 — CHECK FOR CABLE LOSS
Excessive cable resistance causes the switch to deliver higher wattage (V drops, I increases). Runs over 300 feet of 24AWG CAT5e can cause inefficient PoE delivery. Use 23AWG or shorter runs.

RESOLUTION: PoE budget issues are silent — devices drop without error messages. Always check budget utilization when devices drop on PoE switches.`,
    active: true,
  },

  // ── Power & Wiring ────────────────────────────────────────────────────────

  {
    category:   'Power & Wiring',
    title:      'Mag lock not releasing — wiring and power troubleshooting',
    description: 'Magnetic lock (fail-secure) holds the door even after valid credential or REX. Relay wiring and voltage troubleshooting.',
    difficulty: 'Intermediate',
    content: `SYMPTOM: Mag lock stays energized (door stays locked) even after valid credential or REX button press

IMPORTANT: Standard mag locks are fail-secure — they lock when powered, unlock when power is cut. If the door unlocks during a power outage, the lock is wired in fail-SAFE configuration (inverted relay).

STEP 1 — VERIFY UNLOCK SIGNAL
With a multimeter on the relay output terminals of the access panel, trigger an unlock. The relay COM-NO circuit should open (go from ~0Ω to OL) for the duration of the access time. If relay switches but lock stays engaged, the issue is downstream.

STEP 2 — CHECK LOCK POWER
Measure voltage at the lock's red (+) and black (-) wires at the lock itself (not at the panel). Should be 12VDC ± 0.5V or 24VDC ± 1V (check the lock's voltage rating on the nameplate). Under-voltage causes reduced holding force but the lock stays engaged.

STEP 3 — TRACE THE RELAY WIRING
Standard wiring: Panel relay COM → Lock power supply (+), Lock (-) → Lock. The relay interrupts the positive leg.
If wired through a delay-egress timer module, check that the module is functioning — a failed delay-egress board can hold the circuit permanently closed.

STEP 4 — DIODE CHECK
Most mag locks require a flyback diode across the coil terminals to suppress voltage spikes. If the diode is missing or shorted, relay contacts may weld closed (stuck on). Inspect the diode across the lock terminals — should read ~0.6V in forward bias, OL in reverse.

STEP 5 — BRIVO / ACCESS PANEL SETTINGS
In Brivo Onair, confirm the door's "Lock Type" is set correctly (mag lock vs electric strike — they have opposite relay logic). An incorrect setting causes the relay to activate the wrong way.

RESOLUTION: Most "lock won't release" issues are relay wiring errors (using NC instead of NO) or access panel configuration (lock type set to strike instead of mag lock).`,
    active: true,
  },

  // ── Mobile App & Cloud ────────────────────────────────────────────────────

  {
    category:   'Mobile App & Cloud',
    title:      'Brivo Mobile Pass not opening gate — Bluetooth and credential setup',
    description: 'User has Brivo app installed but tapping the pass doesn\'t unlock the gate or door. Bluetooth, credential, and reader configuration checklist.',
    difficulty: 'Basic',
    content: `SYMPTOM: User has Brivo Mobile Pass installed but the door/gate doesn't respond

STEP 1 — VERIFY BLUETOOTH IS ON
Brivo Mobile Pass uses Bluetooth Low Energy (BLE). The user must have Bluetooth enabled on their phone. Airplane mode disables BLE even if the user re-enables WiFi.

STEP 2 — CONFIRM MOBILE CREDENTIAL IS ASSIGNED
In Brivo Onair → Users → find the user → Credentials tab. Confirm there is a Mobile Pass credential (type: Mobile) that is Active and not expired. A physical fob credential alone does NOT enable mobile access.

STEP 3 — CHECK READER CAPABILITY
Not all Brivo readers support mobile credentials. Confirm the reader model:
- ACS300 / ACS6100: supports mobile via Bluetooth + firmware v4.x or later
- Older HID readers: may not support BLE mobile credentials
Check Devices → select the reader → firmware version. If outdated, initiate firmware update from the Brivo panel interface.

STEP 4 — READER BLE RANGE
Brivo Mobile Pass has a typical range of 3–10 feet depending on obstructions. Metal doors and concrete walls reduce range. The user should hold the phone within 2 feet of the reader and tap the credential on-screen.

STEP 5 — APP BACKGROUND REFRESH
On iOS, go to Settings → Brivo → ensure Background App Refresh is ON. On Android, disable battery optimization for the Brivo app. Without this, the app may not maintain BLE handshake.

STEP 6 — FORCE SYNC PANEL
In Brivo Onair → Devices → Panel → "Sync Panel" to push the mobile credential to the reader. Wait 60 seconds and retry.

RESOLUTION: Missing credential in Brivo (Step 2) and Bluetooth off (Step 1) account for 80% of mobile pass failures. Always check the credential assignment before blaming hardware.`,
    active: true,
  },

  // ── Installation Guides ────────────────────────────────────────────────────

  {
    category:   'Installation Guides',
    title:      'New gate operator commissioning checklist',
    description: 'Post-installation commissioning checklist for any gate operator (swing or slide). Safety tests, limit adjustments, and sign-off steps.',
    difficulty: 'Intermediate',
    content: `PURPOSE: Verify a new gate operator installation is safe and fully functional before handing off to the property.

PRE-COMMISSIONING (before applying power):
□ Confirm operator is securely bolted to concrete pad or welded to frame (no wobble)
□ Verify gate hangs level and swings/slides freely with no bind through full travel
□ Confirm all safety device wiring is connected: photobeam, vehicle loops, edge sensors
□ Verify E-stop (emergency stop) button is accessible and wired
□ Confirm proper wire gauge for power run (12 AWG minimum for 115V, <100 ft)

POWERING UP:
□ Apply 115VAC. Verify no tripped breaker, blown fuse, or smoke/burning smell
□ Check control board display / status LED — should show standby state with no fault codes
□ Confirm all inputs show correct state (loops open, beams aligned, REX not triggered)

PROGRAMMING:
□ Set open and close time limits via manufacturer procedure (DK: learn limits by pressing and holding OPEN then CLOSE)
□ Set auto-close timer per property requirements (recommended: 30 seconds after full open)
□ Configure obstruction sensitivity / PRES setting (how hard the gate can push before reversing)
□ Set radio codes / Wiegand programming for the access control system

SAFETY TESTING (REQUIRED before sign-off):
□ Photobeam test: break beam while gate is closing — gate must immediately reverse
□ Loop detector test: drive a vehicle onto the exit loop — gate must hold open
□ Obstruction test: apply light resistance to gate during close — must stop and reverse within 2 inches
□ E-stop test: press emergency stop mid-cycle — gate must stop immediately

FINAL CHECKS:
□ Photograph the completed installation (gate, operator, control board, wiring)
□ Affix the GateGuard asset QR code label to the operator housing
□ Complete site survey in GateGuard portal and generate SOW
□ Walk the property manager through the manual release procedure

SIGN-OFF: Obtain property manager signature on the work order before leaving site.`,
    active: true,
  },

  // ── Warranty & RMA ────────────────────────────────────────────────────────

  {
    category:   'Warranty & RMA',
    title:      'DoorKing warranty claim — RMA process and field replacement',
    description: 'How to initiate a DoorKing warranty claim, what\'s covered, and how to handle the field replacement while waiting for the RMA.',
    difficulty: 'Basic',
    content: `DOORKING WARRANTY COVERAGE:
- Gate operators: 2-year limited warranty on parts, 1-year labor
- Control boards: 2-year parts
- Motors and gearboxes: 2-year parts
- Telephone entry systems: 2-year parts
- Exclusions: damage from lightning, incorrect wiring, improper installation, physical damage

INITIATING AN RMA:

1. Document the fault thoroughly: error codes, symptom description, voltage readings at the failed component, photos of the wiring at the control board.

2. Contact DoorKing Technical Support: 800-826-7493 (M–F 7am–5pm PT). Have the model number and serial number ready (stamped on the operator housing or control board).

3. DoorKing will issue an RMA number. Ship the defective part with the RMA number written on the outside of the box. DoorKing pays return shipping on approved warranty claims.

4. Turnaround: typically 5–10 business days for a replacement board.

FIELD HANDLING WHILE AWAITING RMA:

Option A — Temporary bypass: If the control board failed but the motor is good, a basic relay module can temporarily run the gate on a manual timer while the replacement board is in transit. Notify the property in writing that the gate is on temporary bypass.

Option B — Loaner board: GateGuard maintains a small inventory of common DoorKing control boards for emergency swaps. Contact your GateGuard dispatcher to check availability.

AFTER RECEIVING REPLACEMENT:
- Install and commission the replacement board per the DoorKing installation manual
- Re-program all limits, timers, and relay settings (these are not stored on a replaced board)
- Update the site asset record in GateGuard portal with the new serial number
- Ship the defective unit to DoorKing with the RMA paperwork

DOCUMENTATION: Always update the work order with the RMA number, replacement serial, and any warranty claim correspondence.`,
    active: true,
  },

]

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { dry_run = false } = body

  const db = serviceDb()

  // Get existing article titles to avoid duplication
  const { data: existing } = await db
    .from('kb_articles')
    .select('title')

  const existingTitles = new Set((existing ?? []).map((a: { title: string }) => a.title))

  const toInsert = STARTER_ARTICLES.filter(a => !existingTitles.has(a.title))

  if (toInsert.length === 0) {
    return NextResponse.json({ message: 'All starter articles already exist', inserted: 0 })
  }

  if (dry_run) {
    return NextResponse.json({
      dry_run: true,
      would_insert: toInsert.length,
      skipping: STARTER_ARTICLES.length - toInsert.length,
      articles: toInsert.map(a => ({ title: a.title, category: a.category })),
    })
  }

  // Embed all articles in one batch
  const contents   = toInsert.map(a => `${a.title}\n\n${a.description}\n\n${a.content}`)
  const embeddings = await embedBatch(contents)

  const rows = toInsert.map((a, i) => ({
    category:    a.category,
    title:       a.title,
    description: a.description,
    difficulty:  a.difficulty,
    content:     a.content,
    author:      'GateGuard Technical Team',
    active:      true,
    embedding:   embeddings[i],
  }))

  const { error } = await db.from('kb_articles').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    inserted: rows.length,
    categories: [...new Set(rows.map(r => r.category))],
  })
}
