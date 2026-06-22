'use client'
import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Zap } = require('lucide-react') as any

interface Automation {
  id: string
  name: string
  enabled: boolean
  trigger_type: string
  trigger_config: Record<string, unknown>
  action_type: string
  action_config: Record<string, unknown>
  run_count: number
  last_run_at?: string
  created_at: string
}

const TRIGGER_TYPES = [
  { key: 'status_changes_to',   label: 'Status changes to' },
  { key: 'due_date_is_today',   label: 'Due date is today' },
  { key: 'due_date_overdue',    label: 'Item is overdue' },
  { key: 'item_created',        label: 'Item is created' },
  { key: 'assignee_changes_to', label: 'Assignee changes to' },
  { key: 'progress_reaches',    label: 'Progress reaches %' },
]

const ACTION_TYPES = [
  { key: 'change_status_to',  label: 'Change status to' },
  { key: 'assign_to',         label: 'Assign to' },
  { key: 'create_sub_item',   label: 'Create sub-item named' },
  { key: 'send_notification', label: 'Send notification to' },
  { key: 'set_due_date',      label: 'Set due date to today +N days' },
  { key: 'move_to_group',     label: 'Move to group' },
]

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'In Review', 'On Hold', 'Done', 'Blocked']

interface AutomationsPanelProps {
  onClose: () => void
}

export function AutomationsPanel({ onClose }: AutomationsPanelProps) {
  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'status_changes_to',
    trigger_value: '',
    action_type: 'change_status_to',
    action_value: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tracker/automations')
      if (res.ok) {
        const d = await res.json()
        setAutomations(d.automations ?? [])
      }
    } catch { /* noop */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleEnabled(auto: Automation) {
    try {
      await fetch('/api/tracker/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: auto.id, enabled: !auto.enabled }),
      })
      setAutomations(prev => prev.map(a => a.id === auto.id ? { ...a, enabled: !auto.enabled } : a))
    } catch { /* noop */ }
  }

  async function createAutomation() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/tracker/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          trigger_type: form.trigger_type,
          trigger_config: { value: form.trigger_value },
          action_type: form.action_type,
          action_config: { value: form.action_value },
        }),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ name: '', trigger_type: 'status_changes_to', trigger_value: '', action_type: 'change_status_to', action_value: '' })
        await load()
      }
    } catch { /* noop */ } finally { setSaving(false) }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86400000)
    if (d < 1) return 'today'
    if (d === 1) return 'yesterday'
    return `${d}d ago`
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7,
    fontSize: 12, outline: 'none', boxSizing: 'border-box', background: '#F8FAFC',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div
        style={{
          width: '100%', maxWidth: 460, maxHeight: '92vh',
          background: '#fff', boxShadow: '0 30px 80px rgba(0,0,0,0.25)',
          border: '1px solid #E2E8F0', borderRadius: 18, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={18} color="#6B7EFF" />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#1E293B', margin: 0 }}>Automations</h2>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>Automate repetitive actions when conditions are met</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94A3B8' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13 }}>Loading automations...</span>
            </div>
          ) : (
            <>
              {automations.length === 0 && !showForm && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#94A3B8' }}>
                  <Zap size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
                  <p style={{ fontSize: 13, margin: 0 }}>No automations yet.<br />Create your first one below.</p>
                </div>
              )}

              {/* Automation list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                {automations.map(auto => (
                  <div key={auto.id} style={{
                    border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px',
                    background: auto.enabled ? '#fff' : '#F8FAFC',
                    opacity: auto.enabled ? 1 : 0.6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1E293B' }}>{auto.name}</span>
                      {/* Toggle */}
                      <div
                        onClick={() => toggleEnabled(auto)}
                        style={{
                          width: 36, height: 20, borderRadius: 10, cursor: 'pointer',
                          background: auto.enabled ? '#6B7EFF' : '#E2E8F0',
                          position: 'relative', transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', background: '#fff',
                          position: 'absolute', top: 2,
                          left: auto.enabled ? 18 : 2,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: '#64748B', lineHeight: 1.6 }}>
                      <span style={{ color: '#94A3B8' }}>When </span>
                      <span style={{ fontWeight: 600, color: '#6B7EFF' }}>{TRIGGER_TYPES.find(t => t.key === auto.trigger_type)?.label ?? auto.trigger_type}</span>
                      {auto.trigger_config.value ? <span style={{ color: '#94A3B8' }}> &ldquo;{String(auto.trigger_config.value)}&rdquo;</span> : null}
                      <span style={{ color: '#94A3B8' }}> → </span>
                      <span style={{ fontWeight: 600, color: '#10B981' }}>{ACTION_TYPES.find(a => a.key === auto.action_type)?.label ?? auto.action_type}</span>
                      {auto.action_config.value ? <span style={{ color: '#94A3B8' }}> &ldquo;{String(auto.action_config.value)}&rdquo;</span> : null}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 10, color: '#94A3B8' }}>
                      <span>Run {auto.run_count}x</span>
                      {auto.last_run_at && <span>Last run {timeAgo(auto.last_run_at)}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* New automation form */}
              {showForm ? (
                <div style={{ border: '1px solid #6B7EFF', borderRadius: 12, padding: '14px', background: '#EEF2FF' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>New Automation</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#64748B', fontWeight: 600, display: 'block', marginBottom: 4 }}>Name</label>
                      <input
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="e.g. Mark urgent when overdue"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Trigger — When this happens</p>
                      <select value={form.trigger_type} onChange={e => setForm(f => ({ ...f, trigger_type: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                        {TRIGGER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      {(form.trigger_type === 'status_changes_to') && (
                        <select value={form.trigger_value} onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))} style={inputStyle}>
                          <option value="">Select status...</option>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {form.trigger_type === 'progress_reaches' && (
                        <input type="number" min={0} max={100} value={form.trigger_value}
                          onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                          placeholder="e.g. 100" style={inputStyle} />
                      )}
                      {form.trigger_type === 'assignee_changes_to' && (
                        <input value={form.trigger_value}
                          onChange={e => setForm(f => ({ ...f, trigger_value: e.target.value }))}
                          placeholder="User name..." style={inputStyle} />
                      )}
                    </div>

                    <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', border: '1px solid #E2E8F0' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 6 }}>Action — Do this</p>
                      <select value={form.action_type} onChange={e => setForm(f => ({ ...f, action_type: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                        {ACTION_TYPES.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                      </select>
                      {['change_status_to'].includes(form.action_type) && (
                        <select value={form.action_value} onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))} style={inputStyle}>
                          <option value="">Select status...</option>
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      )}
                      {['create_sub_item', 'send_notification', 'assign_to'].includes(form.action_type) && (
                        <input value={form.action_value}
                          onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))}
                          placeholder={form.action_type === 'create_sub_item' ? 'Sub-item title...' : 'User name...'}
                          style={inputStyle} />
                      )}
                      {form.action_type === 'set_due_date' && (
                        <input type="number" value={form.action_value}
                          onChange={e => setForm(f => ({ ...f, action_value: e.target.value }))}
                          placeholder="Days from today (e.g. 7)" style={inputStyle} />
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={() => setShowForm(false)}
                        style={{ padding: '7px 16px', borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#64748B' }}>
                        Cancel
                      </button>
                      <button onClick={createAutomation} disabled={saving || !form.name.trim()}
                        style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: '#6B7EFF', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                        Save Automation
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowForm(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                    padding: '10px 14px', borderRadius: 10, border: '1px dashed #6B7EFF',
                    background: 'transparent', color: '#6B7EFF', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} /> Add Automation
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
