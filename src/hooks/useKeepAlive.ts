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
  const pingInFlightRef = useRef(false);
  const pingStartedAtRef = useRef<number>(0);
  const pingAbortControllerRef = useRef<AbortController | null>(null);
  const pingAbortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryInFlightRef = useRef(false);
  const failedPingsRef = useRef(0);
  const maxFailedPings = 3;

  const clearInFlightPing = useCallback(() => {
    if (pingAbortTimeoutRef.current) {
      clearTimeout(pingAbortTimeoutRef.current);
      pingAbortTimeoutRef.current = null;
    }
    pingAbortControllerRef.current = null;
    pingInFlightRef.current = false;
    pingStartedAtRef.current = 0;
  }, []);

  const abortInFlightPing = useCallback(() => {
    // On mobile, JS timers/fetch can freeze while backgrounded.
    // If a ping is mid-flight when that happens, our `finally` may never run,
    // leaving `pingInFlightRef=true` forever. We must actively abort/reset.
    try {
      pingAbortControllerRef.current?.abort();
    } catch {
      // ignore
    } finally {
      clearInFlightPing();
    }
  }, [clearInFlightPing]);

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
      // Avoid throwing "Auth session missing!" when the user isn't logged in
      // (or auth hasn't hydrated yet).
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) return;

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

    // Avoid piling up in-flight requests (a common cause of "network stops working" on mobile)
    if (pingInFlightRef.current) {
      // If the app was backgrounded mid-request, the promise can get "stuck".
      // If it's been too long, treat it as stale and reset so recovery can proceed.
      const age = Date.now() - (pingStartedAtRef.current || Date.now());
      if (age > 15000) {
        console.warn('[KeepAlive] Detected stale in-flight ping, aborting/resetting');
        abortInFlightPing();
      } else {
        return;
      }
    }
    pingInFlightRef.current = true;
    pingStartedAtRef.current = Date.now();

    const now = Date.now();
    const timeSinceLastPing = now - lastPingRef.current;

    const controller = new AbortController();
    pingAbortControllerRef.current = controller;
    // Longer timeout than before: aggressive aborts can cause false failures on slow mobile.
    pingAbortTimeoutRef.current = setTimeout(() => controller.abort(), 12000);

    try {
      // Simple lightweight query to keep connection alive
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal)
        .maybeSingle();

      if (error) {
        throw error;
      }

      lastPingRef.current = now;
      failedPingsRef.current = 0;

      // If this is a recovery ping or we've been away for too long, refresh everything
      if (isRecovery || timeSinceLastPing > 60000) {
        if (!recoveryInFlightRef.current) {
          recoveryInFlightRef.current = true;
          try {
            console.log('[KeepAlive] Recovery mode - refreshing session and channels');
            await refreshSession();
            await reconnectChannels();
          } finally {
            recoveryInFlightRef.current = false;
          }
        }
      }
    } catch (error) {
      console.warn('[KeepAlive] Ping failed:', error);
      failedPingsRef.current++;

      // After multiple failures, try aggressive recovery
      if (failedPingsRef.current >= maxFailedPings) {
        failedPingsRef.current = 0;
        if (!recoveryInFlightRef.current) {
          recoveryInFlightRef.current = true;
          try {
            console.log('[KeepAlive] Multiple ping failures, attempting full recovery');
            await refreshSession();
            await reconnectChannels();
          } finally {
            recoveryInFlightRef.current = false;
          }
        }
      }
    } finally {
      clearInFlightPing();
    }
  }, [abortInFlightPing, clearInFlightPing, refreshSession, reconnectChannels]);

  const startKeepAlive = useCallback(() => {
    if (intervalRef.current) return;

    console.log('[KeepAlive] Starting with interval:', interval);
    intervalRef.current = setInterval(() => {
      // Only one ping at a time
      ping(false);
    }, interval);
  }, [interval, ping]);

  const stopKeepAlive = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[KeepAlive] Stopped');
    }
    // Ensure we never keep a "stuck" ping flagged as in-flight.
    abortInFlightPing();
  }, [abortInFlightPing]);

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
          App.addListener('appStateChange', ({ isActive }) => {
            console.log('[KeepAlive] App state change:', { isActive });
            if (isActive) {
              handleResume();
            } else {
              handlePause();
            }
          }),
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

    const isNative = Capacitor.isNativePlatform();

    // Focus/online/offline are reliable on web, but can be noisy/unreliable in native webviews.
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
    if (!isNative) {
      window.addEventListener('focus', handleFocus);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    return () => {
      stopKeepAlive();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (!isNative) {
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }

      handles.forEach((p) => p.then((h) => h.remove()).catch(() => {}));
    };
  }, [enabled, ping, startKeepAlive, stopKeepAlive, handleResume, handlePause]);
}
