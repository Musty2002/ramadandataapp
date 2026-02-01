import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import { App } from "@capacitor/app";
import { onlineManager, focusManager, QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Syncs Capacitor's native Network + App lifecycle events with TanStack Query.
 * This fixes the "stuck offline" issue on mobile where TanStack Query's default
 * browser-based online detection fails after app minimize/resume.
 */
export function useCapacitorNetworkSync(queryClient: QueryClient) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let removeNetwork: { remove: () => Promise<void> } | null = null;
    let removeAppState: { remove: () => Promise<void> } | null = null;

    const setup = async () => {
      try {
        // Initialize online state once
        const status = await Network.getStatus();
        console.log('[CapacitorNetworkSync] Initial network status:', status.connected);
        onlineManager.setOnline(status.connected);

        // Keep TanStack "online" state accurate on native
        removeNetwork = await Network.addListener("networkStatusChange", (s) => {
          console.log('[CapacitorNetworkSync] Network status changed:', s.connected);
          onlineManager.setOnline(!!s.connected);
        });

        // On resume: refresh session + refetch critical queries
        removeAppState = await App.addListener("appStateChange", async ({ isActive }) => {
          console.log('[CapacitorNetworkSync] App state changed, isActive:', isActive);
          focusManager.setFocused(isActive);

          if (isActive) {
            // 1) Make sure auth/session is not stale after sleep
            // (supabase-js usually handles it, but mobile sleep can pause refresh timers)
            try {
              await supabase.auth.getSession();
              console.log('[CapacitorNetworkSync] Session refreshed on resume');
            } catch (error) {
              console.warn('[CapacitorNetworkSync] Failed to refresh session:', error);
            }

            // 2) Kick queries back to life
            queryClient.invalidateQueries();
            queryClient.refetchQueries({ type: "active" });
            console.log('[CapacitorNetworkSync] Queries invalidated and refetching');
          }
        });

        console.log('[CapacitorNetworkSync] Listeners set up successfully');
      } catch (error) {
        console.warn('[CapacitorNetworkSync] Failed to set up listeners:', error);
      }
    };

    setup();

    return () => {
      removeNetwork?.remove();
      removeAppState?.remove();
    };
  }, [queryClient]);
}

