'use client';

import { useEffect, useState } from 'react';
import { useOfflineSync } from '@/lib/useOfflineSync';

export function OfflineBanner() {
  const { isOnline, queueLength } = useOfflineSync();
  const [visible, setVisible] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Only show the banner client-side to avoid hydration mismatch
  useEffect(() => {
    if (!isOnline) {
      setVisible(true);
      setSyncing(false);
    } else if (visible) {
      // Was offline, now back online — show brief "syncing" state then hide
      setSyncing(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setSyncing(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: syncing ? '#D1FAE5' : '#FEF3C7',
        borderBottom: `1px solid ${syncing ? '#6EE7B7' : '#FDE68A'}`,
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        fontSize: '0.8125rem',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontWeight: 500,
        color: syncing ? '#065F46' : '#B45309',
        transition: 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease',
      }}
    >
      {syncing ? (
        <>
          <SyncingSpinner />
          <span>Back online — syncing changes&hellip;</span>
        </>
      ) : (
        <>
          <WifiOffIcon />
          <span>
            Working offline — changes will sync when reconnected
            {queueLength > 0 && (
              <span
                style={{
                  marginLeft: '0.5rem',
                  background: '#B45309',
                  color: '#FEF3C7',
                  borderRadius: '999px',
                  padding: '0 0.45rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  lineHeight: '1.6',
                  display: 'inline-block',
                  verticalAlign: 'middle',
                }}
              >
                {queueLength}
              </span>
            )}
          </span>
        </>
      )}
    </div>
  );
}

function WifiOffIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <circle cx="12" cy="20" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SyncingSpinner() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, animation: 'gg-spin 1s linear infinite' }}
    >
      <style>{`@keyframes gg-spin { to { transform: rotate(360deg); } }`}</style>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.5" />
    </svg>
  );
}
