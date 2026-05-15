'use client';

import { useEffect } from 'react';

/**
 * Registers the GateGuard service worker.
 * Runs once on mount, client-side only.
 * Sends SKIP_WAITING when a new SW is waiting to activate.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        // When a new service worker is waiting, tell it to activate immediately
        const activateWaiting = (sw: ServiceWorker | null) => {
          if (sw?.state === 'installed') {
            sw.postMessage({ type: 'SKIP_WAITING' });
          }
        };

        if (registration.waiting) {
          activateWaiting(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const newSW = registration.installing;
          newSW?.addEventListener('statechange', () => {
            if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Reload on controller change (new SW activated)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });

        if (process.env.NODE_ENV === 'development') {
          console.log('[GG SW] Registered, scope:', registration.scope);
        }
      } catch (err) {
        console.warn('[GG SW] Registration failed:', err);
      }
    };

    // Register after page load to not block initial render
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }
  }, []);

  return null;
}
