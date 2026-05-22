'use client';

import { useEffect, useState, useCallback } from 'react';

interface OfflineSyncState {
  isOnline: boolean;
  queueLength: number;
}

/**
 * useOfflineSync
 *
 * Tracks online/offline status and the number of mutations queued in the
 * service worker's IndexedDB sync queue.
 *
 * Returns:
 *  - isOnline       — current network status
 *  - queueLength    — number of requests waiting to be replayed
 *  - triggerSync    — manually request a sync flush (call on reconnect)
 */
export function useOfflineSync(): OfflineSyncState & { triggerSync: () => void } {
  // Always initialise to true on both server and client to avoid hydration mismatch.
  // The real value is synced in useEffect (client-only).
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queueLength, setQueueLength] = useState<number>(0);

  // Ask the service worker for the current queue length
  const requestQueueLength = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
    navigator.serviceWorker.controller.postMessage({ type: 'GET_QUEUE_LENGTH' });
  }, []);

  // Trigger a background sync flush
  const triggerSync = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker?.controller) return;
    navigator.serviceWorker.controller.postMessage({ type: 'TRIGGER_SYNC' });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Sync real online status now that we're on the client
    setIsOnline(navigator.onLine);

    // Listen to SW messages (QUEUE_LENGTH updates)
    const onSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'QUEUE_LENGTH') {
        setQueueLength(event.data.count ?? 0);
      }
      if (event.data?.type === 'SYNC_FAILED') {
        console.warn('[GG] Sync failed for:', event.data.url);
      }
    };

    navigator.serviceWorker?.addEventListener('message', onSWMessage);

    // Online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync replay when we come back online
      triggerSync();
      // Ask for updated queue length
      requestQueueLength();

      // Show browser notification if there are queued items
      if (queueLength > 0 && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('GateGuard Nexus', {
          body: `Back online — syncing ${queueLength} queued change${queueLength !== 1 ? 's' : ''}.`,
          icon: '/logo-sm.png',
          tag: 'gg-sync',
        });
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial queue length request (after SW is ready)
    navigator.serviceWorker?.ready.then(() => requestQueueLength());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      navigator.serviceWorker?.removeEventListener('message', onSWMessage);
    };
  }, [triggerSync, requestQueueLength, queueLength]);

  return { isOnline, queueLength, triggerSync };
}
