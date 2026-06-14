'use client';

import { useEffect } from 'react';

/**
 * Registers the GateGuard service worker.
 * Keep registration conservative so the PWA does not force-reload while users work.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let mounted = true;

    // The public Nexus Document Portal (nexus.gateguard.co/document/[slug]) is a
    // chrome-free, no-login surface for external recipients. It must NOT run the
    // portal PWA — a stale service worker there serves offline.html ("you are
    // offline") when the origin can't be reached. Skip registration on those
    // pages/host and actively unregister + clear caches to heal stale installs.
    const isPublicSurface =
      window.location.pathname.startsWith('/document') ||
      window.location.pathname.startsWith('/sign') ||
      /(^|\.)nexus\./i.test(window.location.hostname);

    if (isPublicSurface) {
      void (async () => {
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch {
          /* best effort */
        }
      })();
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        if (!mounted) return;

        // Check for updates, but do not force a page reload.
        // The new service worker will take over naturally on the next launch/navigation.
        void registration.update().catch(() => undefined);

        if (process.env.NODE_ENV === 'development') {
          console.log('[GG SW] Registered, scope:', registration.scope);
        }
      } catch (err) {
        console.warn('[GG SW] Registration failed:', err);
      }
    };

    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      mounted = false;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
