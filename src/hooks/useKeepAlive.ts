import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { supabase } from '@/integrations/supabase/client';

interface KeepAliveOptions {
  /** Interval in milliseconds for keep-alive pings (default: 20 seconds) */
  interval?: number;
  /** Whether to enable keep-alive (default: true) */
  enabled?: boolean;
}

/**
 * Robust hook to keep the Supabase connection alive.
 * - Pings backend periodically
 * - Handles network state changes aggressively
 * - Reconnects realtime channels on recovery
 * - Refreshes auth session proactively
 */
export function useKeepAlive(options: KeepAliveOptions = {}) {
  const { interval = 20000, enabled = true } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);
  const lastPingRef = useRef<number>(Date.now());
  const failedPingsRef = useRef(0);
  const maxFailedPings = 3;

  const reconnectChannels = useCallback(async () => {
    try {
      const channels = supabase.getChannels();
      console.log('[KeepAlive] Reconnecting', channels.length, 'channels');
      
      for (const channel of channels) {
        try {
          await channel.unsubscribe();
          await new Promise(resolve => setTimeout(resolve, 50));
          channel.subscribe();
        } catch (e) {
          console.warn('[KeepAlive] Channel reconnect failed:', e);
        }
      }
    } catch (error) {
      console.warn('[KeepAlive] Failed to reconnect channels:', error);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.warn('[KeepAlive] Session refresh failed:', error.message);
      } else if (data.session) {
        console.log('[KeepAlive] Session refreshed');
      }
    } catch (error) {
      console.warn('[KeepAlive] Session refresh error:', error);
    }
  }, []);

  const ping = useCallback(async (isRecovery = false) => {
    if (!isActiveRef.current) return;

    const now = Date.now();
    const timeSinceLastPing = now - lastPingRef.current;

    try {
      // Simple lightweight query to keep connection alive
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      lastPingRef.current = now;
      failedPingsRef.current = 0;

      // If this is a recovery ping or we've been away for too long, refresh everything
      if (isRecovery || timeSinceLastPing > 60000) {
        console.log('[KeepAlive] Recovery mode - refreshing session and channels');
        await refreshSession();
        await reconnectChannels();
      }
    } catch (error) {
      console.warn('[KeepAlive] Ping failed:', error);
      failedPingsRef.current++;

      // After multiple failures, try aggressive recovery
      if (failedPingsRef.current >= maxFailedPings) {
        console.log('[KeepAlive] Multiple ping failures, attempting full recovery');
        failedPingsRef.current = 0;
        await refreshSession();
        await reconnectChannels();
      }
    }
  }, [refreshSession, reconnectChannels]);

  const startKeepAlive = useCallback(() => {
    if (intervalRef.current) return;

    console.log('[KeepAlive] Starting with interval:', interval);
    intervalRef.current = setInterval(() => ping(false), interval);
  }, [interval, ping]);

  const stopKeepAlive = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[KeepAlive] Stopped');
    }
  }, []);

  const handleResume = useCallback(() => {
    console.log('[KeepAlive] App resumed - triggering recovery');
    isActiveRef.current = true;

    // Immediate recovery ping
    ping(true);

    // Restart periodic pings
    startKeepAlive();
  }, [ping, startKeepAlive]);

  const handlePause = useCallback(() => {
    console.log('[KeepAlive] App paused');
    isActiveRef.current = false;
    stopKeepAlive();
  }, [stopKeepAlive]);

  useEffect(() => {
    if (!enabled) return;

    // Initial ping and start
    ping(false);
    startKeepAlive();

    const handles: Promise<import('@capacitor/core').PluginListenerHandle>[] = [];

    if (Capacitor.isNativePlatform()) {
      // App lifecycle
      try {
        handles.push(
          App.addListener('resume', handleResume),
          App.addListener('pause', handlePause)
        );
      } catch (e) {
        console.warn('[KeepAlive] Failed to add app listeners:', e);
      }

      // Network state changes
      try {
        handles.push(
          Network.addListener('networkStatusChange', (status) => {
            console.log('[KeepAlive] Network changed:', status);
            if (status.connected) {
              // Network came back - recovery mode
              isActiveRef.current = true;
              ping(true);
              startKeepAlive();
            } else {
              // Network lost
              isActiveRef.current = false;
              stopKeepAlive();
            }
          })
        );
      } catch (e) {
        console.warn('[KeepAlive] Failed to add network listener:', e);
      }
    }

    // Visibility change (works on web and native)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[KeepAlive] Visibility restored');
        isActiveRef.current = true;
        ping(true);
        startKeepAlive();
      } else {
        isActiveRef.current = false;
        stopKeepAlive();
      }
    };

    // Focus/blur for additional coverage
    const handleFocus = () => {
      console.log('[KeepAlive] Window focused');
      isActiveRef.current = true;
      ping(true);
      startKeepAlive();
    };

    const handleOnline = () => {
      console.log('[KeepAlive] Browser online');
      isActiveRef.current = true;
      ping(true);
      startKeepAlive();
    };

    const handleOffline = () => {
      console.log('[KeepAlive] Browser offline');
      isActiveRef.current = false;
      stopKeepAlive();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      stopKeepAlive();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      handles.forEach((p) => p.then((h) => h.remove()).catch(() => {}));
    };
  }, [enabled, ping, startKeepAlive, stopKeepAlive, handleResume, handlePause]);
}
