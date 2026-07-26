/**
 * lib/incident-taxonomy.ts — the shared vocabulary for site fault tracking.
 * Categories = the affected system class. Causes = the structured "why it's down"
 * per category. Used by the Site faults widget (dropdowns) and, later, by the AI
 * watcher + ggsoc.com so machine-raised incidents use the same codes as manual ones.
 * No secrets — safe to import from both client and server.
 */

export type IncidentCategory = 'network' | 'camera' | 'gate' | 'access' | 'door' | 'intercom' | 'relay' | 'other'
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed'
export type IncidentSource = 'manual' | 'ai' | 'ggsoc' | 'monitor'

export interface CauseOption { id: string; label: string }
export interface CategoryDef { id: IncidentCategory; label: string; icon: string; causes: CauseOption[] }

const c = (id: string, label: string): CauseOption => ({ id, label })

export const INCIDENT_CATEGORIES: CategoryDef[] = [
  {
    id: 'network', label: 'Network', icon: 'router',
    causes: [
      c('power_outage', 'Power outage'),
      c('isp_outage', 'ISP / internet down'),
      c('router_offline', 'Router / gateway offline'),
      c('switch_offline', 'Switch offline'),
      c('cable_damage', 'Cable damaged / cut'),
      c('config_change', 'Config change / misconfig'),
      c('bandwidth', 'Bandwidth saturated'),
      c('unknown', 'Unknown — investigating'),
    ],
  },
  {
    id: 'camera', label: 'Camera', icon: 'video',
    causes: [
      c('power_loss', 'Power loss'),
      c('poe_failure', 'PoE / injector failure'),
      c('network_loss', 'Lost network connection'),
      c('lens_obstructed', 'Lens blocked / dirty'),
      c('physical_damage', 'Physical damage / vandalism'),
      c('storage_full', 'Recording / storage full'),
      c('firmware_fault', 'Firmware / software fault'),
      c('unknown', 'Offline — cause unknown'),
    ],
  },
  {
    id: 'gate', label: 'Gate', icon: 'door-enter',
    causes: [
      c('bumped_by_vehicle', 'Bumped by a vehicle'),
      c('physical_damage', 'Physical damage'),
      c('motor_failure', 'Operator / motor failure'),
      c('obstruction', 'Obstruction in path'),
      c('power_loss', 'Power loss'),
      c('control_board', 'Control board fault'),
      c('safety_loop', 'Safety loop / sensor'),
      c('chain_belt', 'Chain / belt / arm broken'),
      c('remote_dead', 'Remote / receiver dead'),
      c('stuck_open', 'Stuck open'),
      c('stuck_closed', 'Stuck closed'),
      c('unknown', 'Unknown — investigating'),
    ],
  },
  {
    id: 'access', label: 'Access control', icon: 'key',
    causes: [
      c('reader_failure', 'Reader failure'),
      c('controller_offline', 'Controller offline'),
      c('power_loss', 'Power loss'),
      c('credential_db', 'Credential / sync issue'),
      c('lock_mechanism', 'Lock / strike mechanism'),
      c('wiring_fault', 'Wiring fault'),
      c('tamper', 'Tamper / forced'),
      c('unknown', 'Unknown — investigating'),
    ],
  },
  {
    id: 'door', label: 'Door', icon: 'door',
    causes: [
      c('held_open', 'Held / propped open'),
      c('forced_open', 'Forced open'),
      c('lock_failure', 'Lock failure'),
      c('closer_broken', 'Closer / hinge broken'),
      c('sensor_fault', 'Sensor / contact fault'),
      c('power_loss', 'Power loss'),
      c('unknown', 'Unknown — investigating'),
    ],
  },
  {
    id: 'intercom', label: 'Intercom / entry', icon: 'phone',
    causes: [
      c('power_loss', 'Power loss'),
      c('network_loss', 'Lost network connection'),
      c('audio_fault', 'Audio fault'),
      c('video_fault', 'Video fault'),
      c('call_button', 'Call button broken'),
      c('unknown', 'Unknown — investigating'),
    ],
  },
  {
    id: 'relay', label: 'Relay / automation', icon: 'bolt',
    causes: [
      c('power_loss', 'Power loss'),
      c('relay_stuck', 'Relay stuck / failed'),
      c('wiring_fault', 'Wiring fault'),
      c('unknown', 'Unknown — investigating'),
    ],
  },
  {
    id: 'other', label: 'Other', icon: 'alert-triangle',
    causes: [c('unknown', 'Unknown — investigating')],
  },
]

export const CATEGORY_BY_ID: Record<string, CategoryDef> = Object.fromEntries(INCIDENT_CATEGORIES.map(x => [x.id, x]))

export function causeLabel(category: string | null | undefined, cause: string | null | undefined): string {
  if (!cause) return ''
  const cat = category ? CATEGORY_BY_ID[category] : undefined
  const found = cat?.causes.find(x => x.id === cause)
  if (found) return found.label
  // Fall back to a title-cased version of the raw code.
  return String(cause).replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase())
}
export function categoryLabel(category: string | null | undefined): string {
  if (!category) return 'Other'
  return CATEGORY_BY_ID[category]?.label ?? category
}

// One-tap presets for the "Log issue" button — the common real-world faults.
export interface IncidentPreset { key: string; label: string; category: IncidentCategory; cause: string; severity: IncidentSeverity }
export const INCIDENT_PRESETS: IncidentPreset[] = [
  { key: 'gate_stuck_open', label: 'Gate stuck open', category: 'gate', cause: 'stuck_open', severity: 'high' },
  { key: 'gate_bumped', label: 'Gate bumped / damaged', category: 'gate', cause: 'bumped_by_vehicle', severity: 'high' },
  { key: 'camera_down', label: 'Camera down', category: 'camera', cause: 'unknown', severity: 'medium' },
  { key: 'network_down', label: 'Network / internet down', category: 'network', cause: 'isp_outage', severity: 'high' },
  { key: 'door_held', label: 'Door held open', category: 'door', cause: 'held_open', severity: 'medium' },
  { key: 'reader_down', label: 'Reader / access down', category: 'access', cause: 'reader_failure', severity: 'medium' },
]

export const SEVERITY_META: Record<IncidentSeverity, { label: string; color: string }> = {
  low: { label: 'Low', color: '#9FD8EC' },
  medium: { label: 'Medium', color: '#fbbf24' },
  high: { label: 'High', color: '#f59e6b' },
  critical: { label: 'Critical', color: '#f2637e' },
}
