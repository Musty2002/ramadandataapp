import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

interface KeepAliveOptions {
  /** Interval in milliseconds for background pings (default: 30 seconds) */
  interval?: number;
  /** Whether to enable keep-alive (default: true on native platforms) */
  enabled?: boolean;
}

/**
 * Hook to keep the Supabase connection alive by periodically pinging the backend.
 * This prevents connection issues when the app is in the background or idle.
 */
export function useKeepAlive(options: KeepAliveOptions = {}) {
  const { interval = 30000, enabled = Capacitor.isNativePlatform() } = options;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!enabled) return;

    const ping = async () => {
      if (!isActiveRef.current) return;
      
      try {
        // Simple lightweight query to keep connection alive
        await supabase.from('profiles').select('id').limit(1).maybeSingle();
      } catch (error) {
        console.warn('[KeepAlive] Ping failed:', error);
      }
    };

    const startKeepAlive = () => {
      if (intervalRef.current) return;
      
      // Initial ping
      ping();
      
      // Set up periodic pings
      intervalRef.current = setInterval(ping, interval);
      console.log('[KeepAlive] Started with interval:', interval);
    };

    const stopKeepAlive = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('[KeepAlive] Stopped');
      }
    };

    // Start immediately
    startKeepAlive();

    // Handle app state changes on native platforms
    let resumeHandle: Promise<import('@capacitor/core').PluginListenerHandle> | null = null;
    let pauseHandle: Promise<import('@capacitor/core').PluginListenerHandle> | null = null;

    if (Capacitor.isNativePlatform()) {
      try {
        resumeHandle = App.addListener('resume', () => {
          console.log('[KeepAlive] App resumed, restarting keep-alive');
          isActiveRef.current = true;
          // Immediate ping on resume to refresh connection
          ping();
          startKeepAlive();
        });

        pauseHandle = App.addListener('pause', () => {
          console.log('[KeepAlive] App paused, stopping keep-alive');
          isActiveRef.current = false;
          stopKeepAlive();
        });
      } catch (error) {
        console.warn('[KeepAlive] Failed to add app state listeners:', error);
      }
    }

    // Also listen for visibility changes (works on web and some native scenarios)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        isActiveRef.current = true;
        ping();
        startKeepAlive();
      } else {
        isActiveRef.current = false;
        stopKeepAlive();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopKeepAlive();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (resumeHandle) {
        resumeHandle.then(h => h.remove()).catch(() => {});
      }
      if (pauseHandle) {
        pauseHandle.then(h => h.remove()).catch(() => {});
      }
    };
  }, [enabled, interval]);
}
