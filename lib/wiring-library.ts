/**
 * GateGuard Wiring Library
 * Terminal definitions and verified wiring maps for common installation pairs.
 * Terminal labels match the actual board silk-screen.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type TerminalType =
  | 'vcc'         // DC+ power
  | 'gnd'         // DC- / ground
  | 'relay_com'   // relay common
  | 'relay_no'    // relay normally open
  | 'relay_nc'    // relay normally closed
  | 'input_no'    // dry-contact input (N.O.)
  | 'input_nc'    // dry-contact input (N.C.)
  | 'input_com'   // dry-contact input common
  | 'data_d0'     // Wiegand data 0
  | 'data_d1'     // Wiegand data 1
  | 'led'         // reader LED control
  | 'buzzer'      // reader buzzer
  | 'rs485_a'     // RS-485 A (non-inverting)
  | 'rs485_b'     // RS-485 B (inverting)
  | 'ac_hot'      // AC line (L / Hot)
  | 'ac_neutral'  // AC neutral (N)
  | 'ac_ground'   // AC safety ground
  | 'tamper'      // tamper switch
  | 'aux'         // general auxiliary

export interface DeviceTerminal {
  id: string          // unique key within device
  label: string       // board silk-screen label (e.g. "COM1")
  desc: string        // human-readable (e.g. "Lock Relay 1 Common")
  type: TerminalType
  group?: string      // for visual grouping (e.g. "Lock Relay 1")
}

export interface DeviceDef {
  id: string
  name: string
  brand: string
  category: string
  note?: string       // e.g. "Rev-B board layout"
  terminals: DeviceTerminal[]
}

export interface WireRun {
  from: string        // terminal.id on device A
  to: string          // terminal.id on device B
  wireColor: string   // hex — represents physical wire color
  gauge?: string      // e.g. "18 AWG"
  label?: string      // short label shown on wire mid-path
}

export interface WiringMap {
  id: string
  deviceAId: string
  deviceBId: string
  title: string
  summary: string
  wires: WireRun[]
  notes: string[]
  cautions: string[]
  settings?: { device: string; setting: string; value: string }[]
}

// ─── Device Definitions ───────────────────────────────────────────────────────

export const DEVICES: DeviceDef[] = [

  // ── Brivo ACS300 Two-Door Controller ─────────────────────────────────────
  {
    id: 'brivo_acs300',
    name: 'ACS300 Two-Door Controller',
    brand: 'Brivo',
    category: 'Access Controller',
    note: 'J-block terminal reference. Board label prefix varies by firmware revision.',
    terminals: [
      // Power
      { id: 'pwr_vcc',    label: 'V+',   desc: 'DC Power Input +12–24V',    type: 'vcc',       group: 'Power (J1)' },
      { id: 'pwr_gnd',    label: 'V–',   desc: 'DC Power Input Ground',     type: 'gnd',       group: 'Power (J1)' },
      // Lock Relay 1 (J2)
      { id: 'lk1_com',    label: 'COM1', desc: 'Lock Relay 1 — Common',     type: 'relay_com', group: 'Lock Relay 1 (J2)' },
      { id: 'lk1_no',     label: 'NO1',  desc: 'Lock Relay 1 — Normally Open',  type: 'relay_no',  group: 'Lock Relay 1 (J2)' },
      { id: 'lk1_nc',     label: 'NC1',  desc: 'Lock Relay 1 — Normally Closed', type: 'relay_nc',  group: 'Lock Relay 1 (J2)' },
      // Lock Relay 2 (J3)
      { id: 'lk2_com',    label: 'COM2', desc: 'Lock Relay 2 — Common',     type: 'relay_com', group: 'Lock Relay 2 (J3)' },
      { id: 'lk2_no',     label: 'NO2',  desc: 'Lock Relay 2 — Normally Open',  type: 'relay_no',  group: 'Lock Relay 2 (J3)' },
      { id: 'lk2_nc',     label: 'NC2',  desc: 'Lock Relay 2 — Normally Closed', type: 'relay_nc',  group: 'Lock Relay 2 (J3)' },
      // REX / Door Contact (J4)
      { id: 'rex1',       label: 'REX1', desc: 'Request to Exit 1 (N.O. to GND)', type: 'input_no',  group: 'Inputs (J4)' },
      { id: 'dc1',        label: 'DC1',  desc: 'Door Contact 1 (N.C. to GND)',    type: 'input_nc',  group: 'Inputs (J4)' },
      // Reader 1 (J6)
      { id: 'rd1_vcc',    label: '+12V', desc: 'Reader 1 Power +12VDC',     type: 'vcc',       group: 'Reader 1 (J6)' },
      { id: 'rd1_gnd',    label: 'GND',  desc: 'Reader 1 Ground',           type: 'gnd',       group: 'Reader 1 (J6)' },
      { id: 'rd1_d0',     label: 'D0',   desc: 'Reader 1 Wiegand Data 0',   type: 'data_d0',   group: 'Reader 1 (J6)' },
      { id: 'rd1_d1',     label: 'D1',   desc: 'Reader 1 Wiegand Data 1',   type: 'data_d1',   group: 'Reader 1 (J6)' },
      { id: 'rd1_led',    label: 'LED1', desc: 'Reader 1 LED Control',      type: 'led',       group: 'Reader 1 (J6)' },
      { id: 'rd1_bz',     label: 'BZ1',  desc: 'Reader 1 Buzzer',           type: 'buzzer',    group: 'Reader 1 (J6)' },
      // RS-485 network (J8)
      { id: 'net_a',      label: 'A',    desc: 'RS-485 Network A (to Hub)', type: 'rs485_a',   group: 'Network (J8)' },
      { id: 'net_b',      label: 'B',    desc: 'RS-485 Network B (to Hub)', type: 'rs485_b',   group: 'Network (J8)' },
    ],
  },

  // ── Brivo ACS100 Single-Door Door Pack ────────────────────────────────────
  {
    id: 'brivo_acs100',
    name: 'ACS100 Single-Door Pack',
    brand: 'Brivo',
    category: 'Access Controller',
    terminals: [
      { id: 'pwr_vcc',   label: 'V+',   desc: 'DC Power Input +12–24V',   type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',   label: 'V–',   desc: 'DC Power Ground',          type: 'gnd',       group: 'Power' },
      { id: 'lk_com',    label: 'COM',  desc: 'Lock Relay — Common',      type: 'relay_com', group: 'Lock Relay' },
      { id: 'lk_no',     label: 'NO',   desc: 'Lock Relay — Normally Open', type: 'relay_no', group: 'Lock Relay' },
      { id: 'lk_nc',     label: 'NC',   desc: 'Lock Relay — Normally Closed', type: 'relay_nc', group: 'Lock Relay' },
      { id: 'rex',       label: 'REX',  desc: 'Request to Exit (N.O.)',   type: 'input_no',  group: 'Inputs' },
      { id: 'dc',        label: 'DC',   desc: 'Door Contact (N.C.)',      type: 'input_nc',  group: 'Inputs' },
      { id: 'rd_vcc',    label: '+12V', desc: 'Reader Power +12VDC',      type: 'vcc',       group: 'Reader' },
      { id: 'rd_gnd',    label: 'GND',  desc: 'Reader Ground',            type: 'gnd',       group: 'Reader' },
      { id: 'rd_d0',     label: 'D0',   desc: 'Wiegand Data 0',           type: 'data_d0',   group: 'Reader' },
      { id: 'rd_d1',     label: 'D1',   desc: 'Wiegand Data 1',           type: 'data_d1',   group: 'Reader' },
      { id: 'rd_led',    label: 'LED',  desc: 'Reader LED Control',       type: 'led',       group: 'Reader' },
    ],
  },

  // ── DoorKing 6050 Traffic Arm Barrier Gate ────────────────────────────────
  {
    id: 'dk_6050',
    name: '6050 Traffic Arm Barrier',
    brand: 'DoorKing',
    category: 'Gate Operator',
    note: 'Terminal block labels per 6050 Installation & Maintenance Manual (Rev. G). AC wiring by licensed electrician only.',
    terminals: [
      // AC Power (J1) — licensed electrician
      { id: 'ac_hot',    label: 'L',    desc: 'AC Hot — 120VAC ⚠ Electrician', type: 'ac_hot',     group: 'AC Power (J1)' },
      { id: 'ac_neu',    label: 'N',    desc: 'AC Neutral — 120VAC',           type: 'ac_neutral', group: 'AC Power (J1)' },
      { id: 'ac_gnd',    label: 'G',    desc: 'AC Safety Ground',              type: 'ac_ground',  group: 'AC Power (J1)' },
      // Control Inputs (J2) — dry contact, momentary N.O. to COM
      { id: 'ctl_open',  label: 'OPEN', desc: 'Open Input (N.O. moment. to COM)', type: 'input_no', group: 'Control Inputs (J2)' },
      { id: 'ctl_com',   label: 'COM',  desc: 'Control Input Common',          type: 'input_com',  group: 'Control Inputs (J2)' },
      { id: 'ctl_close', label: 'CLOSE',desc: 'Close Input (N.O. moment. to COM)', type: 'input_no', group: 'Control Inputs (J2)' },
      { id: 'ctl_stop',  label: 'STOP', desc: 'Stop Input (N.O. moment. to COM)', type: 'input_no', group: 'Control Inputs (J2)' },
      { id: 'ctl_fe',    label: 'FE',   desc: 'Free Exit Input (loop det.)',   type: 'input_no',   group: 'Control Inputs (J2)' },
      // Accessory Power (J3)
      { id: 'aux_vcc',   label: '+12V', desc: '12VDC Accessory Output',        type: 'vcc',        group: 'Accessory Power (J3)' },
      { id: 'aux_gnd',   label: 'GND',  desc: 'Accessory Ground',              type: 'gnd',        group: 'Accessory Power (J3)' },
      // Gate Status (J4)
      { id: 'stat_com',  label: 'S-COM',desc: 'Status Relay Common',           type: 'relay_com',  group: 'Gate Status (J4)' },
      { id: 'stat_no',   label: 'S-NO', desc: 'Status Relay N.O. (closed when gate open)', type: 'relay_no', group: 'Gate Status (J4)' },
    ],
  },

  // ── LiftMaster SL3000UL Commercial Slide Gate ─────────────────────────────
  {
    id: 'lm_sl3000',
    name: 'SL3000UL Commercial Slide Gate',
    brand: 'LiftMaster',
    category: 'Gate Operator',
    note: 'Control board TB terminal layout per LiftMaster SL3000UL Installation Manual.',
    terminals: [
      { id: 'ac_hot',    label: 'L',    desc: 'AC Hot 115VAC ⚠ Electrician',   type: 'ac_hot',     group: 'AC Power' },
      { id: 'ac_neu',    label: 'N',    desc: 'AC Neutral',                    type: 'ac_neutral', group: 'AC Power' },
      { id: 'open_1',    label: 'OPEN1',desc: 'Open Input Terminal 1',         type: 'input_no',   group: 'Open (TB2)' },
      { id: 'open_2',    label: 'OPEN2',desc: 'Open Input Terminal 2 (Common)',type: 'input_com',  group: 'Open (TB2)' },
      { id: 'close_1',   label: 'CLOSE1',desc: 'Close Input Terminal 1',       type: 'input_no',   group: 'Close (TB2)' },
      { id: 'close_2',   label: 'CLOSE2',desc: 'Close Input Terminal 2 (Common)', type: 'input_com', group: 'Close (TB2)' },
      { id: 'stop_1',    label: 'STOP1',desc: 'Stop Input Terminal 1',         type: 'input_no',   group: 'Stop (TB2)' },
      { id: 'stop_2',    label: 'STOP2',desc: 'Stop Input Terminal 2 (Common)',type: 'input_com',  group: 'Stop (TB2)' },
      { id: 'fe_1',      label: 'FE1',  desc: 'Free Exit Terminal 1',          type: 'input_no',   group: 'Free Exit (TB2)' },
      { id: 'fe_2',      label: 'FE2',  desc: 'Free Exit Terminal 2 (Common)', type: 'input_com',  group: 'Free Exit (TB2)' },
      { id: 'aux_vcc',   label: '+12V', desc: '12VDC Accessory Out',           type: 'vcc',        group: 'Accessory (TB3)' },
      { id: 'aux_gnd',   label: 'GND',  desc: 'Accessory Ground',              type: 'gnd',        group: 'Accessory (TB3)' },
    ],
  },

  // ── Linear OSCO SW050 Swing Gate Operator ─────────────────────────────────
  {
    id: 'linear_sw050',
    name: 'SW050 / SW100 Swing Gate',
    brand: 'Linear OSCO',
    category: 'Gate Operator',
    terminals: [
      { id: 'ac_hot',    label: 'L',    desc: 'AC Hot ⚠ Electrician',         type: 'ac_hot',     group: 'AC Power' },
      { id: 'ac_neu',    label: 'N',    desc: 'AC Neutral',                    type: 'ac_neutral', group: 'AC Power' },
      { id: 'ctl_open',  label: 'OPEN', desc: 'Open Trigger (N.O. to COM)',    type: 'input_no',   group: 'Control' },
      { id: 'ctl_com',   label: 'COM',  desc: 'Control Input Common',          type: 'input_com',  group: 'Control' },
      { id: 'ctl_close', label: 'CLOSE',desc: 'Close Trigger (N.O. to COM)',   type: 'input_no',   group: 'Control' },
      { id: 'ctl_stop',  label: 'STOP', desc: 'Stop Trigger (N.O. to COM)',    type: 'input_no',   group: 'Control' },
      { id: 'aux_vcc',   label: '+12V', desc: '12VDC Accessory Output',        type: 'vcc',        group: 'Accessory' },
      { id: 'aux_gnd',   label: 'GND',  desc: 'Accessory Ground',              type: 'gnd',        group: 'Accessory' },
    ],
  },

  // ── Generic Wiegand Proximity Reader ──────────────────────────────────────
  {
    id: 'wiegand_reader',
    name: 'Wiegand Proximity Reader',
    brand: 'Generic',
    category: 'Access Reader',
    note: 'Standard 26-bit Wiegand. Wire colors per ANSI/SIA AC-01 convention. Color may vary by manufacturer.',
    terminals: [
      { id: 'red',    label: 'RED',    desc: 'Power +12VDC',          type: 'vcc',       group: 'Power' },
      { id: 'black',  label: 'BLK',    desc: 'Ground',                type: 'gnd',       group: 'Power' },
      { id: 'green',  label: 'GRN',    desc: 'Wiegand Data 0 (D0)',   type: 'data_d0',   group: 'Data' },
      { id: 'white',  label: 'WHT',    desc: 'Wiegand Data 1 (D1)',   type: 'data_d1',   group: 'Data' },
      { id: 'blue',   label: 'BLU',    desc: 'LED Control (optional)',type: 'led',       group: 'Optional' },
      { id: 'orange', label: 'ORG',    desc: 'Beeper (optional)',     type: 'buzzer',    group: 'Optional' },
    ],
  },

  // ── Generic Magnetic Lock (Maglok) ────────────────────────────────────────
  {
    id: 'mag_lock',
    name: 'Electromagnetic Lock (Mag Lock)',
    brand: 'Generic',
    category: 'Electric Lock',
    note: 'Most mag locks are 12VDC or 24VDC. Verify voltage rating before wiring. Current draw: 300–600 mA typical.',
    terminals: [
      { id: 'vcc',  label: '+V',  desc: '+12VDC or +24VDC Power In', type: 'vcc', group: 'Power' },
      { id: 'gnd',  label: 'GND', desc: 'Ground',                   type: 'gnd', group: 'Power' },
    ],
  },

  // ── Generic Electric Strike ───────────────────────────────────────────────
  {
    id: 'electric_strike',
    name: 'Electric Door Strike',
    brand: 'Generic',
    category: 'Electric Lock',
    note: '12VDC fail-safe (power to lock) or fail-secure (power to unlock). Verify type before wiring.',
    terminals: [
      { id: 'vcc',  label: '+V',  desc: '+12VDC Power In',  type: 'vcc', group: 'Power' },
      { id: 'gnd',  label: 'GND', desc: 'Ground / Return',  type: 'gnd', group: 'Power' },
    ],
  },
]

// ─── Wiring Maps ──────────────────────────────────────────────────────────────

export const WIRING_MAPS: WiringMap[] = [

  // ── Brivo ACS300 → DoorKing 6050 (Relay open) ────────────────────────────
  {
    id: 'acs300_to_dk6050_relay',
    deviceAId: 'brivo_acs300',
    deviceBId: 'dk_6050',
    title: 'Gate Open via Relay (Door 1)',
    summary: 'Brivo Lock Relay 1 triggers DoorKing 6050 open input via momentary dry-contact closure.',
    wires: [
      { from: 'lk1_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'lk1_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'Brivo Lock 1 relay outputs a momentary dry-contact closure to DoorKing OPEN input.',
      'Configure Brivo relay mode to "momentary" (0.5–2 sec pulse) in Brivo Admin.',
      'DoorKing 6050 AC power (120VAC) must be wired by a licensed electrician — do not connect.',
      'Brivo ACS300 requires its own separate 12–24VDC power supply (sold separately).',
      'For two-direction control, wire Lock Relay 2 COM/NO → DK6050 CLOSE/COM.',
      'Test: grant access in Brivo Admin, verify arm raises within 1 second.',
    ],
    cautions: [
      '⚠ DoorKing J1 (L/N/G) is 120VAC — do not wire without licensed electrician.',
      '⚠ Brivo relay is rated 30VDC 1A max — do not connect to AC supply.',
      '⚠ Verify relay pulse duration matches gate response time before commissioning.',
    ],
    settings: [
      { device: 'Brivo ACS300', setting: 'Lock 1 Relay Mode', value: 'Momentary (0.5–2 sec)' },
      { device: 'Brivo ACS300', setting: 'Lock 1 Unlock Duration', value: '1.5 sec (adjust to taste)' },
      { device: 'DoorKing 6050', setting: 'Input Mode', value: 'Single-Button (OPEN triggers arm up)' },
    ],
  },

  // ── Brivo ACS300 → LiftMaster SL3000 ─────────────────────────────────────
  {
    id: 'acs300_to_sl3000_relay',
    deviceAId: 'brivo_acs300',
    deviceBId: 'lm_sl3000',
    title: 'Gate Open via Relay (Door 1)',
    summary: 'Brivo Lock Relay 1 triggers LiftMaster SL3000 open input via dry-contact closure.',
    wires: [
      { from: 'lk1_com', to: 'open_2', wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'lk1_no',  to: 'open_1', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'Brivo Lock 1 NO/COM creates a momentary dry-contact across SL3000 OPEN1/OPEN2.',
      'SL3000 OPEN input accepts normally-open momentary contact — no voltage from Brivo.',
      'Configure Brivo relay for momentary unlock (1 sec typical).',
      'SL3000 AC power must be wired by a licensed electrician.',
    ],
    cautions: [
      '⚠ SL3000 AC power is 115VAC — licensed electrician only.',
      '⚠ Do not apply DC power to the SL3000 gate control inputs.',
    ],
    settings: [
      { device: 'Brivo ACS300', setting: 'Lock 1 Relay Mode', value: 'Momentary (1 sec)' },
      { device: 'LiftMaster SL3000', setting: 'Single-button open', value: 'Enable' },
    ],
  },

  // ── Brivo ACS300 → Linear OSCO ───────────────────────────────────────────
  {
    id: 'acs300_to_linear_relay',
    deviceAId: 'brivo_acs300',
    deviceBId: 'linear_sw050',
    title: 'Gate Open via Relay',
    summary: 'Brivo Lock Relay 1 triggers Linear OSCO open input via dry-contact closure.',
    wires: [
      { from: 'lk1_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'lk1_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'Momentary dry-contact from Brivo NO/COM → Linear OPEN/COM triggers gate cycle.',
      'Linear operators default to toggle mode — each pulse alternates open/close.',
      'Configure for "open-only" mode in Linear DIP switches if available.',
    ],
    cautions: [
      '⚠ Linear AC power is 115VAC — licensed electrician only.',
    ],
    settings: [
      { device: 'Brivo ACS300', setting: 'Lock 1 Relay Mode', value: 'Momentary (1 sec)' },
    ],
  },

  // ── Wiegand Reader → Brivo ACS300 Reader Port 1 ──────────────────────────
  {
    id: 'wiegand_to_acs300_rd1',
    deviceAId: 'wiegand_reader',
    deviceBId: 'brivo_acs300',
    title: 'Reader 1 Wiegand Connection',
    summary: 'Standard 26-bit Wiegand proximity reader wired to Brivo ACS300 Reader Port 1.',
    wires: [
      { from: 'red',    to: 'rd1_vcc', wireColor: '#DC2626', gauge: '22 AWG', label: '+12V' },
      { from: 'black',  to: 'rd1_gnd', wireColor: '#1e293b', gauge: '22 AWG', label: 'GND' },
      { from: 'green',  to: 'rd1_d0',  wireColor: '#059669', gauge: '22 AWG', label: 'D0' },
      { from: 'white',  to: 'rd1_d1',  wireColor: '#94a3b8', gauge: '22 AWG', label: 'D1' },
      { from: 'blue',   to: 'rd1_led', wireColor: '#6B7EFF', gauge: '22 AWG', label: 'LED' },
    ],
    notes: [
      'Standard ANSI/SIA AC-01 Wiegand color convention — verify against reader documentation.',
      'Maximum run: 500 ft at 22 AWG, 1,000 ft at 18 AWG (Wiegand data signal limit).',
      'Use shielded cable (e.g. 22/6 shielded). Connect shield drain wire to GND at controller end only.',
      'Do not run Wiegand cable parallel to 120VAC wiring — 6" minimum separation, or use conduit.',
      'Brivo J6 Reader 1: left-to-right terminal order is +12V, GND, D0, D1, LED, BZ.',
      'Orange (buzzer) wire optional — connect to BZ1 if reader has integrated sounder.',
    ],
    cautions: [
      '⚠ Verify reader supply voltage — some readers are 5VDC, not 12VDC.',
      '⚠ Reverse polarity on +12V/GND will damage the reader.',
      '⚠ Swapping D0/D1 does not break power but credentials will not read — verify orientation.',
    ],
    settings: [
      { device: 'Brivo ACS300', setting: 'Reader 1 Format', value: '26-bit Wiegand (Standard)' },
      { device: 'Brivo Admin', setting: 'Reader 1 LED Mode', value: 'Normally red, green on access' },
    ],
  },

  // ── Brivo ACS300 → Mag Lock ───────────────────────────────────────────────
  {
    id: 'acs300_to_maglok',
    deviceAId: 'brivo_acs300',
    deviceBId: 'mag_lock',
    title: 'Mag Lock (Fail-Safe)',
    summary: 'Brivo Lock Relay 1 energizes a 12VDC mag lock via a switched power supply. Fail-safe: power holds door locked.',
    wires: [
      { from: 'pwr_vcc', to: 'vcc', wireColor: '#DC2626', gauge: '18 AWG', label: '+12V (via PSU)' },
      { from: 'pwr_gnd', to: 'gnd', wireColor: '#1e293b', gauge: '18 AWG', label: 'GND' },
    ],
    notes: [
      'Mag locks require a dedicated 12VDC power supply — do NOT power from Brivo V+ directly.',
      'Recommended: 12VDC 1.5A (or higher) power supply with battery backup.',
      'Wire relay in series with the positive power feed: PSU(+) → Relay COM → Relay NO → Mag Lock(+). PSU(−) → Mag Lock(−).',
      'Fail-safe: relay energized (power flowing) = door locked. Access granted = relay opens = door unlocks.',
      'Install a suppression diode across the mag lock terminals to protect relay contacts.',
      'Most jurisdictions require mag locks on fire egress doors to have a manual release (request-to-exit motion sensor).',
    ],
    cautions: [
      '⚠ Mag locks draw 300–600 mA — relay contacts are rated 1A. Verify current draw before wiring.',
      '⚠ Use a freewheel (flyback) diode across the lock coil — back-EMF will damage relay contacts over time.',
      '⚠ Fire-egress compliance: verify local code for mag lock + REX requirements.',
    ],
    settings: [
      { device: 'Brivo ACS300', setting: 'Lock 1 Mode', value: 'Fail-Safe (NC = power off = unlocked)' },
      { device: 'Brivo ACS300', setting: 'Lock 1 Relay NC/NO', value: 'Use NC terminal for fail-safe wiring' },
    ],
  },
]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getDevice(id: string): DeviceDef | undefined {
  return DEVICES.find(d => d.id === id)
}

export function getMapsForDevice(deviceId: string): WiringMap[] {
  return WIRING_MAPS.filter(m => m.deviceAId === deviceId || m.deviceBId === deviceId)
}

export function getMap(id: string): WiringMap | undefined {
  return WIRING_MAPS.find(m => m.id === id)
}

/** Find wiring maps where the product name/category/brand roughly matches a device */
export function matchDeviceToProduct(product: {
  name: string; brand: string; category: string; sku: string
}): DeviceDef[] {
  const q = `${product.name} ${product.brand} ${product.sku}`.toLowerCase()
  return DEVICES.filter(d => {
    const match = `${d.name} ${d.brand} ${d.id}`.toLowerCase()
    // Exact brand match
    if (d.brand.toLowerCase() === product.brand.toLowerCase()) {
      if (q.includes(d.name.toLowerCase().split(' ')[0].toLowerCase())) return true
    }
    // Category match (Gate Operator ↔ Gate Operator)
    if (d.category.toLowerCase() === product.category.toLowerCase()) return true
    // SKU substring in device ID
    if (q.includes('acs300') && d.id === 'brivo_acs300') return true
    if (q.includes('acs100') && d.id === 'brivo_acs100') return true
    if (q.includes('6050')   && d.id === 'dk_6050') return true
    if (q.includes('sl3000') && d.id === 'lm_sl3000') return true
    return false
  })
}

/** Get the partner devices that can be wired to a given device */
export function getCompatiblePartners(deviceId: string): Array<{ device: DeviceDef; map: WiringMap }> {
  return WIRING_MAPS
    .filter(m => m.deviceAId === deviceId || m.deviceBId === deviceId)
    .map(m => {
      const partnerId = m.deviceAId === deviceId ? m.deviceBId : m.deviceAId
      const device = getDevice(partnerId)
      return device ? { device, map: m } : null
    })
    .filter(Boolean) as Array<{ device: DeviceDef; map: WiringMap }>
}

// Wire type colors for the SVG renderer
export const TERMINAL_COLORS: Record<TerminalType, string> = {
  vcc:          '#DC2626',  // red
  gnd:          '#1e293b',  // near-black
  relay_com:    '#D97706',  // amber
  relay_no:     '#059669',  // green
  relay_nc:     '#7C3AED',  // purple
  input_no:     '#0EA5E9',  // sky blue
  input_nc:     '#6366F1',  // indigo
  input_com:    '#94A3B8',  // slate
  data_d0:      '#059669',  // green
  data_d1:      '#94a3b8',  // light gray/white
  led:          '#6B7EFF',  // brand blue
  buzzer:       '#F59E0B',  // yellow-amber
  rs485_a:      '#6B7EFF',  // blue
  rs485_b:      '#7C3AED',  // purple
  ac_hot:       '#EF4444',  // bright red
  ac_neutral:   '#D1D5DB',  // light gray
  ac_ground:    '#6B7280',  // gray
  tamper:       '#F59E0B',  // amber
  aux:          '#94A3B8',  // slate
}
