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

  // ── UniFi G3 Intercom (UA-G3-Intercom) ───────────────────────────────────
  {
    id: 'unifi_ai_intercom',
    name: 'G3 Intercom',
    brand: 'Ubiquiti UniFi',
    category: 'Video Intercom',
    note: 'SKU: UA-G3-Intercom. PoE powered (802.3af). Relay output is a dry-contact rated 30VDC 1A. Terminal block on rear of unit. G3 and G4 share the same relay pinout.',
    terminals: [
      // PoE network (power + data via Ethernet — no separate terminal)
      { id: 'poe_rj45',   label: 'PoE',   desc: 'PoE Input — RJ45 to UniFi switch (802.3af)',    type: 'aux',       group: 'Network / Power' },
      // Relay output (dry contact) — J1
      { id: 'rly_com',    label: 'COM',   desc: 'Door Relay — Common',                           type: 'relay_com', group: 'Door Relay (J1)' },
      { id: 'rly_no',     label: 'NO',    desc: 'Door Relay — Normally Open',                    type: 'relay_no',  group: 'Door Relay (J1)' },
      { id: 'rly_nc',     label: 'NC',    desc: 'Door Relay — Normally Closed',                  type: 'relay_nc',  group: 'Door Relay (J1)' },
      // Door sense input — J2
      { id: 'ds_in',      label: 'DS',    desc: 'Door Sensor Input (N.C. contact)',               type: 'input_nc',  group: 'Door Sense (J2)' },
      { id: 'ds_gnd',     label: 'GND',   desc: 'Door Sensor Ground Reference',                  type: 'gnd',       group: 'Door Sense (J2)' },
      // 12VDC auxiliary output — J3 (limited current, for small strike only)
      { id: 'aux_vcc',    label: '+12V',  desc: '12VDC Aux Output (max 300mA — small strike only)', type: 'vcc',    group: 'Aux Power (J3)' },
      { id: 'aux_gnd',    label: 'GND',   desc: 'Aux Ground',                                    type: 'gnd',       group: 'Aux Power (J3)' },
    ],
  },

  // ── UniFi Access Door Hub Mini (UA-Hub-Door-Mini) ────────────────────────
  {
    id: 'unifi_hub_mini',
    name: 'Access Door Hub Mini',
    brand: 'Ubiquiti UniFi',
    category: 'Access Controller',
    note: 'SKU: UA-Hub-Door-Mini. PoE powered. Controls one door/gate. Integrates with UniFi Access app. Terminal block rear-mounted. Lock relay rated 12/24VDC 2A.',
    terminals: [
      { id: 'poe_in',     label: 'PoE',    desc: 'PoE Input — RJ45 (802.3at)',                   type: 'aux',       group: 'Network / Power' },
      // Lock relay — J1
      { id: 'lk_no',      label: 'NO',     desc: 'Lock Relay — Normally Open',                   type: 'relay_no',  group: 'Lock Relay (J1)' },
      { id: 'lk_com',     label: 'COM',    desc: 'Lock Relay — Common',                          type: 'relay_com', group: 'Lock Relay (J1)' },
      { id: 'lk_nc',      label: 'NC',     desc: 'Lock Relay — Normally Closed',                 type: 'relay_nc',  group: 'Lock Relay (J1)' },
      // REX and door contact — J2
      { id: 'rex',        label: 'REX',    desc: 'Request to Exit (N.O. to GND)',                type: 'input_no',  group: 'Inputs (J2)' },
      { id: 'dc',         label: 'DC',     desc: 'Door Contact Sensor (N.C. to GND)',            type: 'input_nc',  group: 'Inputs (J2)' },
      { id: 'sig_gnd',    label: 'GND',    desc: 'Signal Ground Reference',                      type: 'gnd',       group: 'Inputs (J2)' },
      // Reader port — J3 (Wiegand or OSDP)
      { id: 'rd_vcc',     label: '+12V',   desc: 'Reader Power +12VDC (max 300mA)',               type: 'vcc',       group: 'Reader (J3)' },
      { id: 'rd_gnd',     label: 'GND',    desc: 'Reader Ground',                                type: 'gnd',       group: 'Reader (J3)' },
      { id: 'rd_d0',      label: 'D0',     desc: 'Wiegand Data 0 / OSDP Data+',                  type: 'data_d0',   group: 'Reader (J3)' },
      { id: 'rd_d1',      label: 'D1',     desc: 'Wiegand Data 1 / OSDP Data−',                  type: 'data_d1',   group: 'Reader (J3)' },
    ],
  },

  // ── Generic Photobeam (Safety / Obstruction Sensor) ───────────────────────
  {
    id: 'generic_photobeam',
    name: 'Photobeam Safety Sensor',
    brand: 'Generic',
    category: 'Safety Device',
    note: 'Retroreflective or through-beam. Output is N.C. (closed when beam clear, opens when obstructed). Used on gate edge/column pairs. BEA, Optex, and NICE all use this pinout.',
    terminals: [
      { id: 'pwr_vcc',  label: '+12V',  desc: 'DC Power +12–24VDC',                             type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',  label: 'GND',   desc: 'DC Power Ground',                                type: 'gnd',       group: 'Power' },
      { id: 'out_nc',   label: 'NC',    desc: 'Safety Output — Normally Closed (opens when beam broken)', type: 'relay_nc', group: 'Output' },
      { id: 'out_com',  label: 'COM',   desc: 'Safety Output — Common',                         type: 'relay_com', group: 'Output' },
      { id: 'out_no',   label: 'NO',    desc: 'Safety Output — Normally Open (optional)',        type: 'relay_no',  group: 'Output' },
    ],
  },

  // ── Generic Loop Detector (Vehicle Inductive Loop) ────────────────────────
  {
    id: 'generic_loop_det',
    name: 'Vehicle Loop Detector',
    brand: 'Generic',
    category: 'Safety Device',
    note: 'Inductive loop detector. Loop wire buried in pavement (1–3 turns, ~70–200 µH). Relay output closes when vehicle detected. Sensitivity adjustable via DIP switch. Common brands: NORTECH, Diablo Controls, RFT.',
    terminals: [
      { id: 'pwr_vcc',  label: '+12V',  desc: 'DC Power +12–24VDC',                             type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',  label: 'GND',   desc: 'DC Power Ground',                                type: 'gnd',       group: 'Power' },
      { id: 'loop_a',   label: 'LOOP A',desc: 'Inductive Loop Wire — Terminal A',                type: 'aux',       group: 'Loop Input' },
      { id: 'loop_b',   label: 'LOOP B',desc: 'Inductive Loop Wire — Terminal B',                type: 'aux',       group: 'Loop Input' },
      { id: 'out_no',   label: 'NO',    desc: 'Relay Output — Normally Open (closes on detect)', type: 'relay_no',  group: 'Output' },
      { id: 'out_com',  label: 'COM',   desc: 'Relay Output — Common',                          type: 'relay_com', group: 'Output' },
      { id: 'out_nc',   label: 'NC',    desc: 'Relay Output — Normally Closed',                 type: 'relay_nc',  group: 'Output' },
    ],
  },

  // ── Brivo ACS6100 Four-Door Controller ───────────────────────────────────
  {
    id: 'brivo_acs6100',
    name: 'ACS6100 Four-Door Controller',
    brand: 'Brivo',
    category: 'Access Controller',
    note: 'Cloud-managed 4-door controller. Terminal layout per ACS6100 Installation Guide. Each door has an independent lock relay, reader port, REX, and door contact input. Requires 12–24VDC power supply.',
    terminals: [
      // Power
      { id: 'pwr_vcc',    label: 'V+',    desc: 'DC Power Input +12–24V',         type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',    label: 'V-',    desc: 'DC Power Ground',                type: 'gnd',       group: 'Power' },
      // Lock Relay 1
      { id: 'lk1_com',    label: 'COM1',  desc: 'Lock Relay 1 — Common',          type: 'relay_com', group: 'Lock Relay 1' },
      { id: 'lk1_no',     label: 'NO1',   desc: 'Lock Relay 1 — Normally Open',   type: 'relay_no',  group: 'Lock Relay 1' },
      { id: 'lk1_nc',     label: 'NC1',   desc: 'Lock Relay 1 — Normally Closed', type: 'relay_nc',  group: 'Lock Relay 1' },
      // Lock Relay 2
      { id: 'lk2_com',    label: 'COM2',  desc: 'Lock Relay 2 — Common',          type: 'relay_com', group: 'Lock Relay 2' },
      { id: 'lk2_no',     label: 'NO2',   desc: 'Lock Relay 2 — Normally Open',   type: 'relay_no',  group: 'Lock Relay 2' },
      { id: 'lk2_nc',     label: 'NC2',   desc: 'Lock Relay 2 — Normally Closed', type: 'relay_nc',  group: 'Lock Relay 2' },
      // Lock Relay 3
      { id: 'lk3_com',    label: 'COM3',  desc: 'Lock Relay 3 — Common',          type: 'relay_com', group: 'Lock Relay 3' },
      { id: 'lk3_no',     label: 'NO3',   desc: 'Lock Relay 3 — Normally Open',   type: 'relay_no',  group: 'Lock Relay 3' },
      { id: 'lk3_nc',     label: 'NC3',   desc: 'Lock Relay 3 — Normally Closed', type: 'relay_nc',  group: 'Lock Relay 3' },
      // Lock Relay 4
      { id: 'lk4_com',    label: 'COM4',  desc: 'Lock Relay 4 — Common',          type: 'relay_com', group: 'Lock Relay 4' },
      { id: 'lk4_no',     label: 'NO4',   desc: 'Lock Relay 4 — Normally Open',   type: 'relay_no',  group: 'Lock Relay 4' },
      { id: 'lk4_nc',     label: 'NC4',   desc: 'Lock Relay 4 — Normally Closed', type: 'relay_nc',  group: 'Lock Relay 4' },
      // Inputs Door 1
      { id: 'rex1',       label: 'REX1',  desc: 'Request to Exit 1 (N.O. to GND)', type: 'input_no', group: 'Inputs Door 1' },
      { id: 'dc1',        label: 'DC1',   desc: 'Door Contact 1 (N.C. to GND)',    type: 'input_nc', group: 'Inputs Door 1' },
      // Inputs Door 2
      { id: 'rex2',       label: 'REX2',  desc: 'Request to Exit 2 (N.O. to GND)', type: 'input_no', group: 'Inputs Door 2' },
      { id: 'dc2',        label: 'DC2',   desc: 'Door Contact 2 (N.C. to GND)',    type: 'input_nc', group: 'Inputs Door 2' },
      // Reader 1 (Wiegand)
      { id: 'rd1_vcc',    label: '+12V',  desc: 'Reader 1 Power +12VDC',           type: 'vcc',       group: 'Reader 1' },
      { id: 'rd1_gnd',    label: 'GND',   desc: 'Reader 1 Ground',                 type: 'gnd',       group: 'Reader 1' },
      { id: 'rd1_d0',     label: 'D0',    desc: 'Reader 1 Wiegand Data 0',         type: 'data_d0',   group: 'Reader 1' },
      { id: 'rd1_d1',     label: 'D1',    desc: 'Reader 1 Wiegand Data 1',         type: 'data_d1',   group: 'Reader 1' },
      { id: 'rd1_led',    label: 'LED1',  desc: 'Reader 1 LED Control',            type: 'led',       group: 'Reader 1' },
      // RS-485 Network
      { id: 'net_a',      label: 'A',     desc: 'RS-485 Network A',                type: 'rs485_a',   group: 'Network' },
      { id: 'net_b',      label: 'B',     desc: 'RS-485 Network B',                type: 'rs485_b',   group: 'Network' },
    ],
  },

  // ── Brivo 100 Single-Door Cloud Controller ────────────────────────────────
  {
    id: 'brivo_100',
    name: 'Brivo 100 Single-Door Controller',
    brand: 'Brivo',
    category: 'Access Controller',
    note: 'Compact cloud-managed single-door controller. Ethernet-connected (no RS-485 hub required). Terminal layout per Brivo 100 Installation Guide. Supports Wiegand reader. 12–24VDC power.',
    terminals: [
      { id: 'pwr_vcc',   label: 'V+',   desc: 'DC Power Input +12–24VDC',     type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',   label: 'V-',   desc: 'DC Power Ground',              type: 'gnd',       group: 'Power' },
      { id: 'lk_com',    label: 'COM',  desc: 'Lock Relay — Common',          type: 'relay_com', group: 'Lock Relay' },
      { id: 'lk_no',     label: 'NO',   desc: 'Lock Relay — Normally Open',   type: 'relay_no',  group: 'Lock Relay' },
      { id: 'lk_nc',     label: 'NC',   desc: 'Lock Relay — Normally Closed', type: 'relay_nc',  group: 'Lock Relay' },
      { id: 'rex',       label: 'REX',  desc: 'Request to Exit (N.O. to GND)',type: 'input_no',  group: 'Inputs' },
      { id: 'dc',        label: 'DC',   desc: 'Door Contact (N.C. to GND)',   type: 'input_nc',  group: 'Inputs' },
      { id: 'sig_gnd',   label: 'GND',  desc: 'Signal Ground (inputs ref)',   type: 'gnd',       group: 'Inputs' },
      { id: 'rd_vcc',    label: '+12V', desc: 'Reader Power +12VDC',          type: 'vcc',       group: 'Reader' },
      { id: 'rd_gnd',    label: 'GND',  desc: 'Reader Ground',                type: 'gnd',       group: 'Reader' },
      { id: 'rd_d0',     label: 'D0',   desc: 'Wiegand Data 0',               type: 'data_d0',   group: 'Reader' },
      { id: 'rd_d1',     label: 'D1',   desc: 'Wiegand Data 1',               type: 'data_d1',   group: 'Reader' },
      { id: 'rd_led',    label: 'LED',  desc: 'Reader LED Control',           type: 'led',       group: 'Reader' },
      { id: 'eth_rj45',  label: 'ETH',  desc: 'Ethernet — RJ45 to switch (cloud connectivity)', type: 'aux', group: 'Network' },
    ],
  },

  // ── DoorKing 9050 Swing Gate Operator ────────────────────────────────────
  {
    id: 'dk_9050',
    name: '9050 Swing Gate Operator',
    brand: 'DoorKing',
    category: 'Gate Operator',
    note: 'Heavy-duty commercial swing gate operator. AC 115VAC single-phase. Terminal block layout per DoorKing 9050 Installation Manual. Similar control input structure to 6050 traffic arm.',
    terminals: [
      { id: 'ac_hot',    label: 'L',     desc: 'AC Hot 115VAC — ⚠ Electrician only',     type: 'ac_hot',     group: 'AC Power' },
      { id: 'ac_neu',    label: 'N',     desc: 'AC Neutral',                              type: 'ac_neutral', group: 'AC Power' },
      { id: 'ac_gnd',    label: 'G',     desc: 'AC Safety Ground',                        type: 'ac_ground',  group: 'AC Power' },
      { id: 'ctl_open',  label: 'OPEN',  desc: 'Open Input (N.O. momentary to COM)',      type: 'input_no',   group: 'Control Inputs' },
      { id: 'ctl_com',   label: 'COM',   desc: 'Control Input Common',                   type: 'input_com',  group: 'Control Inputs' },
      { id: 'ctl_close', label: 'CLOSE', desc: 'Close Input (N.O. momentary to COM)',     type: 'input_no',   group: 'Control Inputs' },
      { id: 'ctl_stop',  label: 'STOP',  desc: 'Stop / Reverse Input (N.O. to COM)',      type: 'input_no',   group: 'Control Inputs' },
      { id: 'ctl_fe',    label: 'FE',    desc: 'Free Exit Input (loop detector)',          type: 'input_no',   group: 'Control Inputs' },
      { id: 'aux_vcc',   label: '+12V',  desc: '12VDC Accessory Output (limited current)',type: 'vcc',        group: 'Accessory' },
      { id: 'aux_gnd',   label: 'GND',   desc: 'Accessory Ground',                        type: 'gnd',        group: 'Accessory' },
      { id: 'stat_com',  label: 'S-COM', desc: 'Gate Status Relay — Common',              type: 'relay_com',  group: 'Status Output' },
      { id: 'stat_no',   label: 'S-NO',  desc: 'Status Relay N.O. (closed when gate open)', type: 'relay_no', group: 'Status Output' },
    ],
  },

  // ── DoorKing 1600 Heavy-Duty Traffic Arm ─────────────────────────────────
  {
    id: 'dk_1600',
    name: '1600 Heavy-Duty Barrier Arm',
    brand: 'DoorKing',
    category: 'Gate Operator',
    note: 'High-cycle heavy-duty traffic arm operator. AC 115VAC. Used for parking/traffic control. Same control terminal block structure as DK6050. Supports dual-arm and dual-operator configurations.',
    terminals: [
      { id: 'ac_hot',    label: 'L',     desc: 'AC Hot 115VAC — ⚠ Electrician only',     type: 'ac_hot',     group: 'AC Power' },
      { id: 'ac_neu',    label: 'N',     desc: 'AC Neutral',                              type: 'ac_neutral', group: 'AC Power' },
      { id: 'ac_gnd',    label: 'G',     desc: 'AC Safety Ground',                        type: 'ac_ground',  group: 'AC Power' },
      { id: 'ctl_open',  label: 'OPEN',  desc: 'Open Input (N.O. momentary to COM)',      type: 'input_no',   group: 'Control Inputs' },
      { id: 'ctl_com',   label: 'COM',   desc: 'Control Input Common',                   type: 'input_com',  group: 'Control Inputs' },
      { id: 'ctl_close', label: 'CLOSE', desc: 'Close Input (N.O. momentary to COM)',     type: 'input_no',   group: 'Control Inputs' },
      { id: 'ctl_stop',  label: 'STOP',  desc: 'Stop Input (N.C. loop for safety)',       type: 'input_nc',   group: 'Control Inputs' },
      { id: 'ctl_fe',    label: 'FE',    desc: 'Free Exit (loop detector, N.O. to COM)',  type: 'input_no',   group: 'Control Inputs' },
      { id: 'aux_vcc',   label: '+12V',  desc: '12VDC Accessory Output',                 type: 'vcc',        group: 'Accessory' },
      { id: 'aux_gnd',   label: 'GND',   desc: 'Accessory Ground',                        type: 'gnd',        group: 'Accessory' },
    ],
  },

  // ── DoorKing 1835 Telephone Entry System (Callbox) ────────────────────────
  {
    id: 'dk_1835',
    name: '1835 Telephone Entry System',
    brand: 'DoorKing',
    category: 'Entry System',
    note: 'Two-wire telephone entry callbox. Resident presses their unit number; system dials their phone. Resident presses 9 to open gate via DK relay output. Terminal block at rear of unit.',
    terminals: [
      // AC Power
      { id: 'ac_hot',    label: 'L',    desc: 'AC Hot 115VAC — ⚠ Electrician',            type: 'ac_hot',     group: 'AC Power' },
      { id: 'ac_neu',    label: 'N',    desc: 'AC Neutral',                               type: 'ac_neutral', group: 'AC Power' },
      // Telephone line
      { id: 'tel_t',     label: 'T',    desc: 'Phone Line Tip (POTS or 2-wire intercom)', type: 'aux',        group: 'Telephone (J2)' },
      { id: 'tel_r',     label: 'R',    desc: 'Phone Line Ring',                          type: 'aux',        group: 'Telephone (J2)' },
      // Gate relay output (dry contact)
      { id: 'rly_com',   label: 'COM',  desc: 'Gate Relay — Common',                      type: 'relay_com',  group: 'Gate Relay (J3)' },
      { id: 'rly_no',    label: 'NO',   desc: 'Gate Relay — Normally Open (momentary on "9" press)', type: 'relay_no', group: 'Gate Relay (J3)' },
      // 12VDC accessory
      { id: 'aux_vcc',   label: '+12V', desc: '12VDC Accessory Output',                   type: 'vcc',        group: 'Accessory (J4)' },
      { id: 'aux_gnd',   label: 'GND',  desc: 'Accessory Ground',                         type: 'gnd',        group: 'Accessory (J4)' },
    ],
  },

  // ── DoorKing 2334-010 VoIP Entry System ──────────────────────────────────
  {
    id: 'dk_2334',
    name: '2334 VoIP Entry System',
    brand: 'DoorKing',
    category: 'Entry System',
    note: 'IP-based VoIP callbox. Connects to Ethernet/PoE. Calls resident via VoIP or SIP. Gate relay output for access. DKS cloud programming required.',
    terminals: [
      { id: 'poe_rj45',  label: 'PoE',  desc: 'PoE Input — RJ45 (802.3af) for power + data', type: 'aux',      group: 'Network / Power' },
      { id: 'rly_com',   label: 'COM',  desc: 'Gate Relay — Common',                       type: 'relay_com',  group: 'Gate Relay' },
      { id: 'rly_no',    label: 'NO',   desc: 'Gate Relay — Normally Open (dry contact)',   type: 'relay_no',   group: 'Gate Relay' },
      { id: 'rly_nc',    label: 'NC',   desc: 'Gate Relay — Normally Closed',               type: 'relay_nc',   group: 'Gate Relay' },
      { id: 'aux_vcc',   label: '+12V', desc: '12VDC Auxiliary Output (limited)',            type: 'vcc',        group: 'Auxiliary' },
      { id: 'aux_gnd',   label: 'GND',  desc: 'Auxiliary Ground',                           type: 'gnd',        group: 'Auxiliary' },
    ],
  },

  // ── DoorKing 9410-010 Single-Channel Loop Detector ────────────────────────
  {
    id: 'dk_9410',
    name: '9410-010 Loop Detector (Single)',
    brand: 'DoorKing',
    category: 'Safety Device',
    note: 'DoorKing-branded single-channel inductive loop detector. DIP-switch sensitivity and frequency selection. 12–24VDC input. N.O. and N.C. relay outputs. Designed to integrate directly with DK gate operators.',
    terminals: [
      { id: 'pwr_vcc',  label: '+12V',  desc: 'DC Power +12–24VDC',                      type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',  label: 'GND',   desc: 'DC Power Ground',                         type: 'gnd',       group: 'Power' },
      { id: 'loop_a',   label: 'LOOP A',desc: 'Inductive Loop Wire — Terminal A',         type: 'aux',       group: 'Loop Input' },
      { id: 'loop_b',   label: 'LOOP B',desc: 'Inductive Loop Wire — Terminal B',         type: 'aux',       group: 'Loop Input' },
      { id: 'out_no',   label: 'NO',    desc: 'Relay Output — N.O. (closes on detect)',   type: 'relay_no',  group: 'Output' },
      { id: 'out_com',  label: 'COM',   desc: 'Relay Output — Common',                   type: 'relay_com', group: 'Output' },
      { id: 'out_nc',   label: 'NC',    desc: 'Relay Output — N.C. (opens on detect)',    type: 'relay_nc',  group: 'Output' },
    ],
  },

  // ── DoorKing 9409-010 Dual-Channel Loop Detector ──────────────────────────
  {
    id: 'dk_9409',
    name: '9409-010 Loop Detector (Dual)',
    brand: 'DoorKing',
    category: 'Safety Device',
    note: 'DoorKing dual-channel loop detector. Two independent loop inputs (Ch1/Ch2) each with separate relay outputs. Ideal for simultaneous free-exit + safety loop on a single board.',
    terminals: [
      { id: 'pwr_vcc',   label: '+12V',   desc: 'DC Power +12–24VDC',                    type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',   label: 'GND',    desc: 'DC Power Ground',                       type: 'gnd',       group: 'Power' },
      { id: 'ch1_loop_a',label: 'L1A',    desc: 'Channel 1 Loop Wire — A',               type: 'aux',       group: 'Loop Ch1' },
      { id: 'ch1_loop_b',label: 'L1B',    desc: 'Channel 1 Loop Wire — B',               type: 'aux',       group: 'Loop Ch1' },
      { id: 'ch1_no',    label: 'NO1',    desc: 'Channel 1 Relay N.O.',                  type: 'relay_no',  group: 'Output Ch1' },
      { id: 'ch1_com',   label: 'COM1',   desc: 'Channel 1 Relay Common',                type: 'relay_com', group: 'Output Ch1' },
      { id: 'ch1_nc',    label: 'NC1',    desc: 'Channel 1 Relay N.C.',                  type: 'relay_nc',  group: 'Output Ch1' },
      { id: 'ch2_loop_a',label: 'L2A',    desc: 'Channel 2 Loop Wire — A',               type: 'aux',       group: 'Loop Ch2' },
      { id: 'ch2_loop_b',label: 'L2B',    desc: 'Channel 2 Loop Wire — B',               type: 'aux',       group: 'Loop Ch2' },
      { id: 'ch2_no',    label: 'NO2',    desc: 'Channel 2 Relay N.O.',                  type: 'relay_no',  group: 'Output Ch2' },
      { id: 'ch2_com',   label: 'COM2',   desc: 'Channel 2 Relay Common',                type: 'relay_com', group: 'Output Ch2' },
      { id: 'ch2_nc',    label: 'NC2',    desc: 'Channel 2 Relay N.C.',                  type: 'relay_nc',  group: 'Output Ch2' },
    ],
  },

  // ── Viking G5 Gate Operator (Slide) ──────────────────────────────────────
  {
    id: 'viking_g5',
    name: 'G5 Slide Gate Operator',
    brand: 'Viking Access',
    category: 'Gate Operator',
    note: 'Commercial slide gate operator. 115VAC. Control board TB terminal layout per Viking G5 Installation Manual. Supports bi-directional control and free-exit loop input.',
    terminals: [
      { id: 'ac_hot',    label: 'L',    desc: 'AC Hot 115VAC — ⚠ Electrician only',      type: 'ac_hot',     group: 'AC Power' },
      { id: 'ac_neu',    label: 'N',    desc: 'AC Neutral',                              type: 'ac_neutral', group: 'AC Power' },
      { id: 'ac_gnd',    label: 'GND',  desc: 'AC Safety Ground',                        type: 'ac_ground',  group: 'AC Power' },
      { id: 'ctl_open',  label: 'OPEN', desc: 'Open Input (N.O. momentary to COM)',       type: 'input_no',   group: 'Control' },
      { id: 'ctl_com',   label: 'COM',  desc: 'Control Input Common',                    type: 'input_com',  group: 'Control' },
      { id: 'ctl_close', label: 'CLOSE',desc: 'Close Input (N.O. momentary to COM)',      type: 'input_no',   group: 'Control' },
      { id: 'ctl_stop',  label: 'STOP', desc: 'Stop Input (safety — N.C. circuit)',       type: 'input_nc',   group: 'Control' },
      { id: 'ctl_fe',    label: 'FE',   desc: 'Free Exit Input (loop detector N.O.)',     type: 'input_no',   group: 'Control' },
      { id: 'aux_vcc',   label: '+12V', desc: '12VDC Accessory Output',                  type: 'vcc',        group: 'Accessory' },
      { id: 'aux_gnd',   label: 'GND',  desc: 'Accessory Ground',                        type: 'gnd',        group: 'Accessory' },
    ],
  },

  // ── Securitron EEB2 Electric Bond Sensor ─────────────────────────────────
  {
    id: 'securitron_eeb2',
    name: 'EEB2 Electric Bond Sensor',
    brand: 'Securitron',
    category: 'Safety Device',
    note: 'Monitors magnetic holding force of an electromagnetic lock. Outputs N.C. contact when bond is confirmed (door closed and locked). Used as a door-position/lock-status feedback input to access controllers. 12VDC powered.',
    terminals: [
      { id: 'pwr_vcc',  label: '+12V', desc: 'DC Power +12VDC',                          type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',  label: 'GND',  desc: 'DC Power Ground',                          type: 'gnd',       group: 'Power' },
      { id: 'out_nc',   label: 'NC',   desc: 'Bond Status — N.C. (closed = door bonded)', type: 'relay_nc',  group: 'Output' },
      { id: 'out_com',  label: 'COM',  desc: 'Output Common',                             type: 'relay_com', group: 'Output' },
      { id: 'out_no',   label: 'NO',   desc: 'Output N.O. (closed = bond lost)',          type: 'relay_no',  group: 'Output' },
    ],
  },

  // ── Bosch DS160 PIR Motion Sensor (REX) ──────────────────────────────────
  {
    id: 'bosch_ds160',
    name: 'DS160 PIR Motion Detector',
    brand: 'Bosch',
    category: 'Safety Device',
    note: 'Passive infrared motion detector. Commonly used as a Request-to-Exit (REX) sensor on the secure side of a door. N.C. relay output closes when motion detected. 12VDC powered. Wide 110-degree coverage angle.',
    terminals: [
      { id: 'pwr_vcc',  label: '+12V', desc: 'DC Power +12VDC',                          type: 'vcc',       group: 'Power' },
      { id: 'pwr_gnd',  label: 'GND',  desc: 'DC Power Ground',                          type: 'gnd',       group: 'Power' },
      { id: 'rly_nc',   label: 'NC',   desc: 'Relay N.C. — opens when motion detected',  type: 'relay_nc',  group: 'Output' },
      { id: 'rly_com',  label: 'COM',  desc: 'Relay Common',                             type: 'relay_com', group: 'Output' },
      { id: 'rly_no',   label: 'NO',   desc: 'Relay N.O. — closes when motion detected', type: 'relay_no',  group: 'Output' },
      { id: 'tamper',   label: 'TAMP', desc: 'Tamper Switch Output',                     type: 'tamper',    group: 'Tamper' },
    ],
  },

  // ── Alarm Controls 1200S Electromagnetic Lock ─────────────────────────────
  {
    id: 'ac_1200s',
    name: '1200S Electromagnetic Lock',
    brand: 'Alarm Controls',
    category: 'Electric Lock',
    note: '1200 lb holding force electromagnetic lock. 12VDC or 24VDC (jumper selectable). Fail-safe: power on = door locked. Current: 500mA at 12V / 250mA at 24V. Includes door position sensor (DPS) output.',
    terminals: [
      { id: 'vcc',      label: '+V',   desc: '+12VDC or +24VDC Power (jumper selectable)', type: 'vcc',     group: 'Power' },
      { id: 'gnd',      label: 'GND',  desc: 'Ground',                                    type: 'gnd',     group: 'Power' },
      { id: 'dps_nc',   label: 'DPS-NC', desc: 'Door Position Sensor — N.C. (closed when door closed)', type: 'relay_nc', group: 'DPS Output' },
      { id: 'dps_com',  label: 'DPS-C',  desc: 'Door Position Sensor — Common',          type: 'relay_com', group: 'DPS Output' },
    ],
  },

  // ── Alarm Controls AES-100 Electric Strike ────────────────────────────────
  {
    id: 'ac_aes100',
    name: 'AES-100 Electric Strike',
    brand: 'Alarm Controls',
    category: 'Electric Lock',
    note: 'Fail-secure electric strike (no power = door locked; power applied = door unlocks). 12VDC or 24VDC. Current: 300mA. Install suppression diode across terminals. UL Listed.',
    terminals: [
      { id: 'vcc',  label: '+V',  desc: '+12VDC or +24VDC Power',  type: 'vcc', group: 'Power' },
      { id: 'gnd',  label: 'GND', desc: 'Ground / Return',          type: 'gnd', group: 'Power' },
    ],
  },

  // ── Ubiquiti UniFi Cloud Gateway Ultra (UCG-Ultra) ────────────────────────
  {
    id: 'ubnt_ucg_ultra',
    name: 'UniFi Cloud Gateway Ultra',
    brand: 'Ubiquiti',
    category: 'Network',
    note: 'SKU: UCG-Ultra. All-in-one router, UniFi Network controller, and UniFi Access controller. WAN: 1x 2.5GbE RJ45. LAN: 4x 1GbE. Powers UniFi Access ecosystem. Connects to ISP modem/ONT on WAN port.',
    terminals: [
      { id: 'wan',      label: 'WAN',    desc: '2.5GbE WAN — to ISP modem or ONT (RJ45)',    type: 'aux', group: 'Network Ports' },
      { id: 'lan1',     label: 'LAN 1',  desc: '1GbE LAN — to switch or device',             type: 'aux', group: 'Network Ports' },
      { id: 'lan2',     label: 'LAN 2',  desc: '1GbE LAN',                                   type: 'aux', group: 'Network Ports' },
      { id: 'lan3',     label: 'LAN 3',  desc: '1GbE LAN',                                   type: 'aux', group: 'Network Ports' },
      { id: 'lan4',     label: 'LAN 4',  desc: '1GbE LAN',                                   type: 'aux', group: 'Network Ports' },
      { id: 'pwr',      label: 'DC IN',  desc: 'DC Power Input (included adapter)',           type: 'vcc', group: 'Power' },
    ],
  },

  // ── Ubiquiti UniFi Flex Switch (USW-Flex) ─────────────────────────────────
  {
    id: 'ubnt_usw_flex',
    name: 'UniFi Flex Switch (5-Port)',
    brand: 'Ubiquiti',
    category: 'Network',
    note: 'SKU: USW-Flex. 5-port managed PoE switch. PoE-in on port 1 (802.3af/at passthrough). 4x PoE-out ports (802.3af, 46W total budget). Powers cameras, intercoms, access hubs. IP55 rated for outdoor junction boxes.',
    terminals: [
      { id: 'port1_poe_in', label: 'Port 1', desc: 'PoE In — uplink to UCG or PoE switch (powers the Flex)', type: 'aux', group: 'Uplink' },
      { id: 'port2',        label: 'Port 2',  desc: 'PoE Out 802.3af — camera, reader, intercom',            type: 'aux', group: 'PoE Out' },
      { id: 'port3',        label: 'Port 3',  desc: 'PoE Out 802.3af',                                        type: 'aux', group: 'PoE Out' },
      { id: 'port4',        label: 'Port 4',  desc: 'PoE Out 802.3af',                                        type: 'aux', group: 'PoE Out' },
      { id: 'port5',        label: 'Port 5',  desc: 'PoE Out 802.3af',                                        type: 'aux', group: 'PoE Out' },
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

  // ── Brivo ACS300 → DoorKing 6050 (Door 2 / Second Gate) ─────────────────
  {
    id: 'acs300_to_dk6050_door2',
    deviceAId: 'brivo_acs300',
    deviceBId: 'dk_6050',
    title: 'Gate Open via Relay (Door 2 — Dual Gate)',
    summary: 'Brivo Lock Relay 2 triggers a second DoorKing 6050 open input. Used when controlling two gates or a bi-parting gate.',
    wires: [
      { from: 'lk2_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'lk2_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'Uses ACS300 Lock Relay 2 (COM2 / NO2) — same wiring as Door 1 but using J3 terminal block.',
      'Each DoorKing 6050 is a separate unit — each requires its own 120VAC power (electrician).',
      'For bi-parting (two leaves on same opening), both operators open simultaneously on same credential.',
      'Configure Lock 2 in Brivo Admin to the same door/credential as Lock 1, or as a separate entry point.',
      'Pulse duration: set both Lock 1 and Lock 2 to identical timing so both leaves open together.',
      'Label each relay in Brivo Admin clearly: e.g. "Gate Left Leaf" / "Gate Right Leaf".',
    ],
    cautions: [
      '⚠ Two separate 120VAC circuits — licensed electrician required for both units.',
      '⚠ Brivo ACS300 relay 2 is rated 30VDC 1A — dry contact only, no AC voltage.',
      '⚠ For bi-parting gates, verify leaf timing: one leaf must not contact the other.',
    ],
    settings: [
      { device: 'Brivo ACS300', setting: 'Lock 2 Relay Mode', value: 'Momentary (match Lock 1 duration)' },
      { device: 'DoorKing 6050 (Unit 2)', setting: 'Input Mode', value: 'Single-Button (OPEN triggers arm up)' },
    ],
  },

  // ── UniFi AI Intercom → DoorKing 6050 (Visitor Release) ──────────────────
  {
    id: 'unifi_intercom_to_dk6050',
    deviceAId: 'unifi_ai_intercom',
    deviceBId: 'dk_6050',
    title: 'Visitor Gate Release via Intercom Relay',
    summary: 'UniFi AI Intercom dry-contact relay triggers DoorKing 6050 open input when resident/manager grants access through the UniFi app.',
    wires: [
      { from: 'rly_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'rly_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'UniFi Intercom relay fires when a resident/manager taps "Unlock" in the UniFi Protect or Access app.',
      'Relay is dry-contact only — it shorts COM to NO for the configured unlock duration (1–10 sec, set in UniFi console).',
      'DK6050 OPEN and COM inputs receive the momentary short, triggering arm up.',
      'Set UniFi relay unlock duration to match DK6050 response time — typically 1.5–2 sec.',
      'This path is for visitor/intercom access only. Resident credential access goes through Brivo ACS300.',
      'Two unlock paths run in parallel — both correctly trigger the same DK6050 OPEN terminal.',
      'Run 18 AWG 2-conductor from intercom J1 terminal block to DK6050 J2 control terminal.',
    ],
    cautions: [
      '⚠ UniFi relay is rated 30VDC 1A maximum — dry contact only, no AC.',
      '⚠ DK6050 J1 (AC power) is 120VAC — do not confuse with J2 control inputs.',
      '⚠ Verify UniFi console relay mode is set to "Momentary" — not "Toggle" or "Latching".',
    ],
    settings: [
      { device: 'UniFi AI Intercom', setting: 'Relay Mode', value: 'Momentary' },
      { device: 'UniFi AI Intercom', setting: 'Unlock Duration', value: '1.5–2 sec' },
      { device: 'UniFi Console', setting: 'Door Type', value: 'Gate (configure in UniFi Access)' },
    ],
  },

  // ── Photobeam → DoorKing 6050 Safety (STOP) ──────────────────────────────
  {
    id: 'photobeam_to_dk6050_stop',
    deviceAId: 'generic_photobeam',
    deviceBId: 'dk_6050',
    title: 'Photobeam Safety — STOP Input',
    summary: 'Photobeam N.C. output wired in series with DoorKing 6050 STOP input. Beam broken = gate halts and reverses.',
    wires: [
      { from: 'out_nc',  to: 'ctl_stop', wireColor: '#7C3AED', gauge: '18 AWG', label: 'SAFETY' },
      { from: 'out_com', to: 'ctl_com',  wireColor: '#94A3B8', gauge: '18 AWG', label: 'COM' },
    ],
    notes: [
      'Photobeam output is N.C. (normally closed when beam is clear). When beam is broken, contact opens.',
      'DK6050 STOP input is "active-low" — opening the N.C. contact triggers a stop and reversal.',
      'Wire photobeam N.C. terminal → DK6050 STOP, and photobeam COM → DK6050 COM.',
      'Multiple photobeams can be wired in series on the same STOP circuit — any single break stops the gate.',
      'Power the photobeam from DK6050 accessory output (+12V / GND on J3) to simplify wiring.',
      'For dual-opener setups, wire photobeam in series on BOTH gate STOP inputs.',
      'Align photobeam across the gate opening at vehicle side-mirror height (~40"). Test with a hand.',
    ],
    cautions: [
      '⚠ Never use N.O. output for safety — a broken wire would allow gate to close on obstruction.',
      '⚠ Verify photobeam alignment after install: partial misalignment causes intermittent STOP faults.',
      '⚠ Bright sunlight can wash out retroreflective beams — use weatherproof mounting bracket.',
    ],
    settings: [
      { device: 'DoorKing 6050', setting: 'STOP Input Mode', value: 'N.C. Loop (factory default)' },
      { device: 'Photobeam', setting: 'Output Mode', value: 'N.C. (normally closed when clear)' },
    ],
  },

  // ── Loop Detector → DoorKing 6050 Free Exit (FE) ─────────────────────────
  {
    id: 'loop_det_to_dk6050_fe',
    deviceAId: 'generic_loop_det',
    deviceBId: 'dk_6050',
    title: 'Exit Loop Detector — Free Exit (FE)',
    summary: 'Vehicle inductive loop detector output wired to DoorKing 6050 FE (Free Exit) input. Vehicle approaching from inside triggers gate to open automatically.',
    wires: [
      { from: 'out_no',  to: 'ctl_fe',  wireColor: '#059669', gauge: '18 AWG', label: 'DETECT' },
      { from: 'out_com', to: 'ctl_com', wireColor: '#94A3B8', gauge: '18 AWG', label: 'COM' },
    ],
    notes: [
      'Loop detector relay NO closes when vehicle is detected over the buried loop wire.',
      'DK6050 FE (Free Exit) input: momentary closure triggers gate open — vehicle exits without credential.',
      'Loop wire is 1–3 turns of 14–16 AWG wire in a saw-cut slot in the pavement, sealed with backer rod + sealant.',
      'Run the loop lead wire (the twisted pair from the loop to the detector) in separate conduit from AC lines.',
      'Loop wire connects to detector LOOP A and LOOP B terminals — polarity does not matter.',
      'Power the loop detector from DK6050 J3 accessory output (+12V / GND) to simplify wiring.',
      'Sensitivity: start at factory default. Increase if detector misses motorcycles; decrease if false-triggers.',
      'For safety loop (under the gate arm): wire to STOP input instead of FE — stops gate if car is under arm.',
    ],
    cautions: [
      '⚠ Loop wire requires a saw cut in the pavement — schedule before asphalt is completed.',
      '⚠ Do not run loop lead wire parallel to 120VAC wiring — causes false detections.',
      '⚠ Safety loop under the gate arm must use STOP input, not FE — wrong wiring allows arm to close on car.',
    ],
    settings: [
      { device: 'Loop Detector', setting: 'Sensitivity', value: 'Medium (adjust on site — motorcycle test)' },
      { device: 'Loop Detector', setting: 'Operate Mode', value: 'Presence (relay held while vehicle on loop)' },
      { device: 'DoorKing 6050', setting: 'FE Input', value: 'N.O. momentary contact (factory default)' },
    ],
  },

  // ── Safety Loop Detector → DoorKing 6050 STOP ────────────────────────────
  {
    id: 'loop_det_to_dk6050_stop',
    deviceAId: 'generic_loop_det',
    deviceBId: 'dk_6050',
    title: 'Safety Loop Detector — STOP (Under-Arm)',
    summary: 'Safety loop under the gate arm. Vehicle detected while arm is closing → triggers STOP and reversal. Prevents arm strike.',
    wires: [
      { from: 'out_nc',  to: 'ctl_stop', wireColor: '#7C3AED', gauge: '18 AWG', label: 'SAFETY' },
      { from: 'out_com', to: 'ctl_com',  wireColor: '#94A3B8', gauge: '18 AWG', label: 'COM' },
    ],
    notes: [
      'Safety loop is positioned directly under the gate arm — typically a 3×6 ft rectangle.',
      'Use N.C. output wired to STOP — this fails safe: broken wire = gate stops (same as photobeam).',
      'Loop detector must be in "Presence" mode so relay holds closed the entire time a vehicle is detected.',
      'Can be wired in series with photobeam on the same STOP circuit.',
      'Safety loop and free-exit loop are separate detectors — two distinct buried loops.',
    ],
    cautions: [
      '⚠ N.C. output required for safety loop — N.O. would allow arm to strike a car on wire break.',
      '⚠ Safety loop must cover the full arm swing width, not just the center.',
    ],
    settings: [
      { device: 'Loop Detector', setting: 'Output', value: 'N.C. (use NC terminal for STOP wiring)' },
      { device: 'Loop Detector', setting: 'Operate Mode', value: 'Presence' },
    ],
  },

  // ── Brivo ACS6100 → DoorKing 6050 (Relay — Door 1) ──────────────────────
  {
    id: 'acs6100_to_dk6050_relay',
    deviceAId: 'brivo_acs6100',
    deviceBId: 'dk_6050',
    title: 'Gate Open via Relay (Door 1)',
    summary: 'Brivo ACS6100 Lock Relay 1 triggers DoorKing 6050 OPEN input via momentary dry-contact closure.',
    wires: [
      { from: 'lk1_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'lk1_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'ACS6100 Lock Relay 1 (COM1/NO1) provides momentary dry-contact closure to DK6050 OPEN/COM.',
      'Configure relay mode to "Momentary" in Brivo Admin — typically 1.0–2.0 sec pulse.',
      'ACS6100 requires 12–24VDC power supply (sold separately) — not powered by PoE.',
      'DK6050 AC power (120VAC) must be connected by a licensed electrician.',
      'Remaining relay outputs (2, 3, 4) can control additional gates or doors independently.',
      'Test: grant access from Brivo Admin > Doors > Manual Unlock, verify gate arm raises.',
    ],
    cautions: [
      '⚠ DK6050 J1 AC terminals are 120VAC — licensed electrician required.',
      '⚠ ACS6100 relay is dry-contact rated — do not apply external voltage to relay terminals.',
      '⚠ Confirm ACS6100 is online in Brivo cloud before testing (solid LED on front panel).',
    ],
    settings: [
      { device: 'Brivo ACS6100', setting: 'Lock 1 Relay Mode', value: 'Momentary (1.5 sec)' },
      { device: 'DoorKing 6050', setting: 'Input Mode', value: 'Single-Button Open' },
    ],
  },

  // ── Brivo ACS6100 → DoorKing 9050 Swing Gate ─────────────────────────────
  {
    id: 'acs6100_to_dk9050_relay',
    deviceAId: 'brivo_acs6100',
    deviceBId: 'dk_9050',
    title: 'Swing Gate Open via Relay',
    summary: 'Brivo ACS6100 Lock Relay 1 triggers DoorKing 9050 swing gate operator OPEN input.',
    wires: [
      { from: 'lk1_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'lk1_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'Same relay wiring pattern as ACS6100 → DK6050 — both accept N.O. dry contact on OPEN/COM.',
      'DK9050 swing travel time is longer than a traffic arm — adjust Brivo pulse to 1.5–2 sec.',
      'For dual-leaf swing gates: use ACS6100 Lock Relay 2 on the second operator.',
      'Ensure gate obstruction sensors (photobeam/edge) are wired to DK9050 STOP input.',
      'DK9050 AC power (115VAC) must be wired by a licensed electrician.',
    ],
    cautions: [
      '⚠ 115VAC on DK9050 power terminals — licensed electrician only.',
      '⚠ Swing gates can injure pedestrians — verify all safety devices are installed before commissioning.',
    ],
    settings: [
      { device: 'Brivo ACS6100', setting: 'Lock 1 Relay Mode', value: 'Momentary (2 sec)' },
      { device: 'DoorKing 9050', setting: 'Relay Open Time', value: 'Match Brivo pulse duration' },
    ],
  },

  // ── Wiegand Reader → Brivo ACS6100 Reader Port 1 ─────────────────────────
  {
    id: 'wiegand_to_acs6100_rd1',
    deviceAId: 'wiegand_reader',
    deviceBId: 'brivo_acs6100',
    title: 'Reader 1 Wiegand Connection',
    summary: 'Standard 26-bit Wiegand proximity reader wired to Brivo ACS6100 Reader Port 1.',
    wires: [
      { from: 'red',    to: 'rd1_vcc', wireColor: '#DC2626', gauge: '22 AWG', label: '+12V' },
      { from: 'black',  to: 'rd1_gnd', wireColor: '#1e293b', gauge: '22 AWG', label: 'GND' },
      { from: 'green',  to: 'rd1_d0',  wireColor: '#059669', gauge: '22 AWG', label: 'D0' },
      { from: 'white',  to: 'rd1_d1',  wireColor: '#94a3b8', gauge: '22 AWG', label: 'D1' },
      { from: 'blue',   to: 'rd1_led', wireColor: '#6B7EFF', gauge: '22 AWG', label: 'LED' },
    ],
    notes: [
      'Standard Wiegand color convention (ANSI/SIA AC-01) — verify against reader manual.',
      'ACS6100 Reader 1 port: +12V, GND, D0, D1, LED (left to right on terminal block).',
      'Use shielded 22/6 cable. Terminate shield drain at controller end only.',
      'Maximum recommended run: 500 ft at 22 AWG.',
      'ACS6100 supports up to 4 readers (one per door).',
    ],
    cautions: [
      '⚠ Verify reader is 12VDC — some readers require 5VDC and will be damaged by 12V.',
      '⚠ D0/D1 swap prevents reads but does not damage hardware — verify orientation if reader does not read.',
    ],
    settings: [
      { device: 'Brivo ACS6100', setting: 'Reader 1 Format', value: '26-bit Wiegand' },
      { device: 'Brivo Admin', setting: 'Reader 1 LED Mode', value: 'Red idle, green on grant' },
    ],
  },

  // ── Brivo 100 → Alarm Controls AES-100 Electric Strike ───────────────────
  {
    id: 'brivo100_to_aes100',
    deviceAId: 'brivo_100',
    deviceBId: 'ac_aes100',
    title: 'Electric Strike — Fail-Secure',
    summary: 'Brivo 100 lock relay controls an Alarm Controls AES-100 fail-secure electric strike via a switched 12VDC power supply.',
    wires: [
      { from: 'lk_com', to: 'vcc', wireColor: '#D97706', gauge: '18 AWG', label: 'SWITCHED +V (via PSU)' },
      { from: 'lk_nc',  to: 'gnd', wireColor: '#1e293b', gauge: '18 AWG', label: 'GND' },
    ],
    notes: [
      'AES-100 is fail-secure: power applied = strike releases = door unlocks.',
      'Wire: PSU(+) → Relay COM → Relay NO → Strike(+). PSU(−) → Strike(−).',
      'Brivo relay opens on access grant, energizing the strike.',
      'Use a dedicated 12VDC 1A power supply — do not power from Brivo V+ terminal.',
      'Install a suppression diode (1N4007) across strike terminals to protect relay contacts.',
      'Brivo 100 connects to LAN via Ethernet for cloud programming — no RS-485 hub needed.',
      'Verify door contact (DC) is wired to confirm door closed after each access event.',
    ],
    cautions: [
      '⚠ Fail-secure = no power = locked. Verify egress requirements — may need override.',
      '⚠ Flyback diode across strike terminals is mandatory — omitting it degrades relay contacts.',
      '⚠ Check local fire code: some jurisdictions prohibit fail-secure on egress doors.',
    ],
    settings: [
      { device: 'Brivo 100', setting: 'Lock Relay Mode', value: 'Momentary (1–3 sec per door)' },
      { device: 'Brivo 100', setting: 'Lock Type', value: 'Fail-Secure (NO wiring)' },
    ],
  },

  // ── Brivo 100 → Alarm Controls 1200S Mag Lock ────────────────────────────
  {
    id: 'brivo100_to_1200s',
    deviceAId: 'brivo_100',
    deviceBId: 'ac_1200s',
    title: 'Mag Lock — Fail-Safe',
    summary: 'Brivo 100 lock relay controls Alarm Controls 1200S electromagnetic lock. Fail-safe: power on = locked, relay opens on access grant = unlocks.',
    wires: [
      { from: 'lk_com', to: 'vcc', wireColor: '#DC2626', gauge: '18 AWG', label: '+V (via PSU NC)' },
      { from: 'lk_nc',  to: 'gnd', wireColor: '#1e293b', gauge: '18 AWG', label: 'GND' },
    ],
    notes: [
      '1200S mag lock is fail-safe: power continuously holds the door locked.',
      'Relay wiring: PSU(+) → Relay COM → Relay NC → Lock(+). PSU(−) → Lock(−).',
      'On access grant: relay de-energizes, NC contact opens, power to lock is cut = unlocks.',
      'Use dedicated 12VDC 1.5A power supply (500mA lock draw + headroom).',
      'Recommended: use a 12VDC PSU with battery backup for fail-safe compliance.',
      'Install a freewheel (flyback) diode (1N4007) across lock terminals.',
      'REX (request-to-exit) sensor required on secure side for fire egress compliance.',
      'Brivo 100 DPS/door-contact input monitors 1200S built-in door position sensor output.',
    ],
    cautions: [
      '⚠ 1200S draws 500mA — verify PSU and relay contact ratings.',
      '⚠ Flyback diode is required — back-EMF from mag lock coil will damage relay contacts.',
      '⚠ Fire egress compliance: mag locks must have a manual override (motion REX or push-to-exit).',
    ],
    settings: [
      { device: 'Brivo 100', setting: 'Lock Relay Mode', value: 'Continuous (fail-safe — NC wiring)' },
      { device: 'Alarm Controls 1200S', setting: 'Voltage', value: '12VDC (jumper position per label)' },
    ],
  },

  // ── DoorKing 1835 Callbox → DoorKing 6050 Gate Relay ─────────────────────
  {
    id: 'dk1835_to_dk6050_relay',
    deviceAId: 'dk_1835',
    deviceBId: 'dk_6050',
    title: 'Callbox Gate Release',
    summary: 'DoorKing 1835 callbox dry-contact relay output triggers DoorKing 6050 OPEN input when resident presses "9" during a call.',
    wires: [
      { from: 'rly_com', to: 'ctl_com',  wireColor: '#D97706', gauge: '18 AWG', label: 'COM' },
      { from: 'rly_no',  to: 'ctl_open', wireColor: '#059669', gauge: '18 AWG', label: 'OPEN' },
    ],
    notes: [
      'When a resident presses "9" on their phone during a call from the 1835, the relay closes briefly.',
      'DK1835 relay output is a momentary dry-contact (approx. 2 sec) — triggers DK6050 OPEN/COM.',
      'Both units need separate AC power (115VAC) — do not daisy-chain from the same circuit.',
      'For DK1835 telephone line: connect to a POTS phone line (T/R) or DKS 2-wire intercom wiring.',
      'DKS cloud programming configures resident directory, unit codes, and relay duration.',
      'Test: visitor presses unit number, resident answers, presses 9 — gate arm raises.',
    ],
    cautions: [
      '⚠ DK1835 requires active phone line (POTS or ATA for VoIP) to function.',
      '⚠ DK6050 AC power is 120VAC — licensed electrician required.',
      '⚠ Relay pulse from 1835 is fixed at ~2 sec — ensure DK6050 responds within that window.',
    ],
    settings: [
      { device: 'DoorKing 1835', setting: 'Gate Code', value: '9 (factory default — can be changed)' },
      { device: 'DoorKing 1835', setting: 'Relay Duration', value: '2 sec (DKS cloud configurable)' },
      { device: 'DoorKing 6050', setting: 'Input Mode', value: 'Single-Button Open' },
    ],
  },

  // ── DK9410 Single Loop → DoorKing 6050 Free Exit ─────────────────────────
  {
    id: 'dk9410_to_dk6050_fe',
    deviceAId: 'dk_9410',
    deviceBId: 'dk_6050',
    title: 'Exit Loop — Free Exit (FE)',
    summary: 'DoorKing 9410 single loop detector triggers DK6050 Free Exit input. Vehicle approaching from inside opens gate automatically.',
    wires: [
      { from: 'out_no',  to: 'ctl_fe',  wireColor: '#059669', gauge: '18 AWG', label: 'DETECT' },
      { from: 'out_com', to: 'ctl_com', wireColor: '#94A3B8', gauge: '18 AWG', label: 'COM' },
    ],
    notes: [
      '9410 N.O. relay closes when vehicle detected over loop — triggers DK6050 FE (Free Exit) input.',
      'Loop wire is 14–16 AWG, 1–3 turns, in a saw-cut slot in the pavement. Position before the gate.',
      'Connect loop wire leads to 9410 LOOP A and LOOP B (polarity does not matter).',
      'Power 9410 from DK6050 J3 accessory output (+12V / GND) to simplify wiring.',
      'Set DIP switch for frequency to avoid interference if multiple loop detectors are near each other.',
      'Detector operate mode: set to "Presence" — relay holds while vehicle remains on loop.',
    ],
    cautions: [
      '⚠ Pavement saw cut must be done before final asphalt is laid.',
      '⚠ Exit loop and safety loop are separate circuits — do not mix FE and STOP inputs.',
    ],
    settings: [
      { device: 'DK 9410', setting: 'Sensitivity', value: 'Medium (adjust for motorcycle detection)' },
      { device: 'DK 9410', setting: 'Operate Mode', value: 'Presence' },
      { device: 'DoorKing 6050', setting: 'FE Input', value: 'N.O. momentary (factory default)' },
    ],
  },

  // ── DK9410 Safety Loop → DoorKing 6050 STOP ──────────────────────────────
  {
    id: 'dk9410_to_dk6050_stop',
    deviceAId: 'dk_9410',
    deviceBId: 'dk_6050',
    title: 'Safety Loop — STOP (Under-Arm)',
    summary: 'DoorKing 9410 loop detector under the gate arm. Vehicle detected during closing triggers STOP and reversal. Prevents arm strike.',
    wires: [
      { from: 'out_nc',  to: 'ctl_stop', wireColor: '#7C3AED', gauge: '18 AWG', label: 'SAFETY' },
      { from: 'out_com', to: 'ctl_com',  wireColor: '#94A3B8', gauge: '18 AWG', label: 'COM' },
    ],
    notes: [
      'Use N.C. output for safety — if wire breaks, loop opens and gate stops (fail-safe behavior).',
      'Safety loop is a 3×6 ft rectangle directly under the arm travel path.',
      'Can be wired in series with photobeam on the same DK6050 STOP input circuit.',
      'Power from DK6050 J3 accessory output (+12V / GND).',
      'Set 9410 to "Presence" mode — relay holds entire time vehicle is on loop.',
    ],
    cautions: [
      '⚠ N.C. wiring is mandatory for safety loops — N.O. would allow arm to close on a vehicle.',
      '⚠ Loop must cover full arm swing arc width, not just center.',
    ],
    settings: [
      { device: 'DK 9410', setting: 'Output', value: 'N.C. terminal for STOP circuit' },
      { device: 'DK 9410', setting: 'Operate Mode', value: 'Presence' },
    ],
  },

  // ── Bosch DS160 PIR REX → Brivo 100 ──────────────────────────────────────
  {
    id: 'ds160_to_brivo100_rex',
    deviceAId: 'bosch_ds160',
    deviceBId: 'brivo_100',
    title: 'PIR Motion REX (Request to Exit)',
    summary: 'Bosch DS160 PIR sensor wired to Brivo 100 REX input. Motion on secure side triggers door unlock without credential.',
    wires: [
      { from: 'rly_no',  to: 'rex',     wireColor: '#059669', gauge: '22 AWG', label: 'REX' },
      { from: 'rly_com', to: 'sig_gnd', wireColor: '#94A3B8', gauge: '22 AWG', label: 'GND' },
      { from: 'pwr_vcc', to: 'rd_vcc',  wireColor: '#DC2626', gauge: '22 AWG', label: '+12V' },
      { from: 'pwr_gnd', to: 'rd_gnd',  wireColor: '#1e293b', gauge: '22 AWG', label: 'GND' },
    ],
    notes: [
      'DS160 N.O. relay closes when motion is detected — momentarily shorts REX to GND on Brivo 100.',
      'Brivo 100 REX input is active-low (N.O. to GND) — contact closure triggers door release.',
      'Power DS160 from Brivo 100 reader +12V output (verify current draw is under 300mA).',
      'DS160 has adjustable detection range (6–12 ft) and sensitivity — set to avoid false triggers.',
      'Mount DS160 on interior side at 6–8 ft height, aimed at the door swing zone.',
      'REX events are logged in Brivo Admin for audit purposes.',
    ],
    cautions: [
      '⚠ Avoid mounting DS160 near HVAC vents — temperature changes cause false triggers.',
      '⚠ Adjust sensitivity before final commissioning — overly sensitive PIR causes nuisance unlocks.',
    ],
    settings: [
      { device: 'Bosch DS160', setting: 'Sensitivity', value: 'Medium (adjust on site)' },
      { device: 'Brivo 100', setting: 'REX Input', value: 'N.O. to GND (factory default)' },
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
    if (q.includes('acs300')               && d.id === 'brivo_acs300') return true
    if (q.includes('acs100')               && d.id === 'brivo_acs100') return true
    if (q.includes('acs6100')              && d.id === 'brivo_acs6100') return true
    if ((q.includes('brivo 100') || q.includes('brivo-100')) && d.id === 'brivo_100') return true
    if (q.includes('6050')                 && d.id === 'dk_6050') return true
    if (q.includes('9050')                 && d.id === 'dk_9050') return true
    if (q.includes('1600')                 && d.id === 'dk_1600') return true
    if ((q.includes('1835') || q.includes('dk1835')) && d.id === 'dk_1835') return true
    if ((q.includes('2334') || q.includes('dk2334')) && d.id === 'dk_2334') return true
    if ((q.includes('9409') || q.includes('dk9409')) && d.id === 'dk_9409') return true
    if ((q.includes('9410') || q.includes('dk9410')) && d.id === 'dk_9410') return true
    if (q.includes('sl3000')               && d.id === 'lm_sl3000') return true
    if ((q.includes('viking') || q.includes('g5'))  && d.id === 'viking_g5') return true
    if ((q.includes('intercom') || q.includes('g3') || q.includes('g4') || q.includes('ua-g3')) && d.id === 'unifi_ai_intercom') return true
    if ((q.includes('hub mini') || q.includes('hub-door') || q.includes('door hub') || q.includes('ua-hub')) && d.id === 'unifi_hub_mini') return true
    if ((q.includes('ucg') || q.includes('cloud gateway')) && d.id === 'ubnt_ucg_ultra') return true
    if ((q.includes('usw-flex') || q.includes('usw flex') || q.includes('flex switch')) && d.id === 'ubnt_usw_flex') return true
    if ((q.includes('eeb2') || q.includes('securitron')) && d.id === 'securitron_eeb2') return true
    if ((q.includes('ds160') || q.includes('bosch')) && d.id === 'bosch_ds160') return true
    if ((q.includes('1200s') || q.includes('alarm controls') || q.includes('maglok') || q.includes('mag lock')) && d.id === 'ac_1200s') return true
    if ((q.includes('aes-100') || q.includes('aes100') || q.includes('electric strike')) && d.id === 'ac_aes100') return true
    if ((q.includes('photobeam') || q.includes('photoeye') || q.includes('infrared')) && d.id === 'generic_photobeam') return true
    if ((q.includes('loop') || q.includes('inductive')) && d.id === 'generic_loop_det') return true
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
