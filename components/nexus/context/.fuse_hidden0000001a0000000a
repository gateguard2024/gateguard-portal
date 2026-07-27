'use client'

import { createContext, useContext } from 'react'

// ─── Scope identifiers ────────────────────────────────────────────────────────
// Each maps to a specific data domain inside the modal.
// The command bar reads this to (a) change its placeholder text and
// (b) include the scope tag in every API call so the AI responds in context
// rather than triggering global navigation.

export type ModalScope =
  | 'dispatch_work_orders'   // My Day → Work Orders detail + explorer
  | 'tasks'                  // My Day → Tasks detail
  | 'calendar'               // My Day → Calendar detail
  | 'recent_work'            // Recent Work tab
  | 'opps_leads'             // New Opps/Leads tab
  | 'jobs'                   // Jobs tab
  | 'field'                  // Field tab
  | 'people'                 // People tab
  | 'global'                 // Home screen / no modal open

// ─── Placeholder copy per scope ───────────────────────────────────────────────

export const SCOPE_PLACEHOLDER: Record<ModalScope, string> = {
  dispatch_work_orders: 'Tell Nexus what to do with these orders…',
  tasks:                'What tasks should I create or update?',
  calendar:             'What events should I check or schedule?',
  recent_work:          'Search or filter recent jobs…',
  opps_leads:           'Create a lead, move a deal, or search accounts…',
  jobs:                 'Find a job, update a status, or schedule a phase…',
  field:                'Assign a tech, check a site, or log a finding…',
  people:               'Look up a contact, team member, or dealer…',
  global:               'Ask Nexus anything — schedule, leads, quotes, field ops…',
}

// ─── Context value ────────────────────────────────────────────────────────────

export interface ModalScopeValue {
  /** Current scope — drives placeholder text and API metadata */
  scope:            ModalScope

  /** AI response from a scoped command (null = none yet) */
  commandResult:    string | null

  /** True while a scoped command is in-flight */
  isCommandLoading: boolean
}

const DEFAULT: ModalScopeValue = {
  scope:            'global',
  commandResult:    null,
  isCommandLoading: false,
}

export const ModalScopeContext = createContext<ModalScopeValue>(DEFAULT)

/** Read the current modal scope from anywhere inside a modal view. */
export function useModalScope(): ModalScopeValue {
  return useContext(ModalScopeContext)
}
