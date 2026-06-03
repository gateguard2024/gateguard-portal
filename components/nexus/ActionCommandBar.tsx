'use client'

import { useState, useRef, useCallback } from 'react'
import { useModalScope, SCOPE_PLACEHOLDER } from '@/components/nexus/context/ModalScopeContext'

interface Props {
  onSubmit: (query: string) => void | Promise<void>
  isLoading?: boolean
  /** Override placeholder — if omitted, auto-resolved from ModalScopeContext */
  placeholder?: string
}

export function ActionCommandBar({ onSubmit, isLoading = false, placeholder: placeholderProp }: Props) {
  const [value, setValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Read scope from context — drives placeholder and API metadata
  const { scope, isCommandLoading } = useModalScope()
  const activePlaceholder = placeholderProp ?? SCOPE_PLACEHOLDER[scope]
  const activeLoading = isLoading || isCommandLoading
  const canSubmit = Boolean(value.trim()) && !activeLoading

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || activeLoading) return
    void onSubmit(trimmed)
    setValue('')
  }, [value, activeLoading, onSubmit])

  return (
    <div className="w-full max-w-2xl">
      <div
        className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 cursor-text"
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: isFocused
            ? '1px solid rgba(107,126,255,0.55)'
            : '1px solid rgba(255,255,255,0.09)',
          boxShadow: isFocused
            ? '0 0 0 1px rgba(107,126,255,0.15), 0 8px 32px rgba(107,126,255,0.12)'
            : '0 4px 24px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(12px)',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Sparkle icon */}
        <svg
          width="18" height="18" viewBox="0 0 18 18" fill="none"
          className="flex-shrink-0"
          aria-hidden="true"
        >
          <path d="M9 1L10.2 6.8H16L11.4 10.2L13 16L9 12.6L5 16L6.6 10.2L2 6.8H7.8L9 1Z"
            fill={isFocused ? '#6B7EFF' : 'rgba(107,126,255,0.5)'}
            style={{ transition: 'fill 0.2s' }}
          />
        </svg>

        {/* Input field */}
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          placeholder={activePlaceholder}
          disabled={activeLoading}
          className="flex-1 bg-transparent outline-none text-sm"
          style={{
            color: 'rgba(255,255,255,0.85)',
            caretColor: '#6B7EFF',
          }}
        />

        {/* Waveform decoration (visible when not focused and no value) */}
        {!value && !isFocused && (
          <svg
            width="60" height="20" viewBox="0 0 60 20"
            className="flex-shrink-0 opacity-20"
            aria-hidden="true"
          >
            <rect x="0"  y="8"  width="3" height="4"  rx="1.5" fill="#6B7EFF" />
            <rect x="5"  y="5"  width="3" height="10" rx="1.5" fill="#6B7EFF" />
            <rect x="10" y="3"  width="3" height="14" rx="1.5" fill="#6B7EFF" />
            <rect x="15" y="6"  width="3" height="8"  rx="1.5" fill="#6B7EFF" />
            <rect x="20" y="9"  width="3" height="2"  rx="1.5" fill="#6B7EFF" />
            <rect x="25" y="4"  width="3" height="12" rx="1.5" fill="#6B7EFF" />
            <rect x="30" y="7"  width="3" height="6"  rx="1.5" fill="#6B7EFF" />
            <rect x="35" y="2"  width="3" height="16" rx="1.5" fill="#6B7EFF" />
            <rect x="40" y="6"  width="3" height="8"  rx="1.5" fill="#6B7EFF" />
            <rect x="45" y="8"  width="3" height="4"  rx="1.5" fill="#6B7EFF" />
            <rect x="50" y="5"  width="3" height="10" rx="1.5" fill="#6B7EFF" />
            <rect x="55" y="9"  width="3" height="2"  rx="1.5" fill="#6B7EFF" />
          </svg>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mic */}
          <button
            type="button"
            aria-label="Voice input"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'rgba(107,126,255,0.12)' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="4.5" y="1" width="5" height="7" rx="2.5" stroke="#6B7EFF" strokeWidth="1.2"/>
              <path d="M2 7.5A5 5 0 0012 7.5" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
              <line x1="7" y1="12.5" x2="7" y2="10" stroke="#6B7EFF" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            aria-label="Send"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{
              background: canSubmit ? '#6B7EFF' : 'rgba(107,126,255,0.15)',
              opacity: canSubmit ? 1 : 0.4,
            }}
          >
            {activeLoading ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="animate-spin">
                <circle cx="7" cy="7" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
                <path d="M7 1.5A5.5 5.5 0 0112.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
