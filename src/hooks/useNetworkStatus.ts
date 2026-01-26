import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { supabase } from '@/integrations/supabase/client';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string | null;
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: null,
  });
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const lastOnlineRef = useRef(navigator.onLine);

  const reconnectRealtime = useCallback(async () => {
    if (isReconnecting) return;
    
    setIsReconnecting(true);
    
    try {
      // Get all active channels and reconnect them
      const channels = supabase.getChannels();
      
      for (const channel of channels) {
        // Unsubscribe and resubscribe to force reconnection
        await channel.unsubscribe();
        await new Promise(resolve => setTimeout(resolve, 100));
        channel.subscribe();
      }
      
      console.log('[NetworkStatus] Reconnected realtime channels');
    } catch (error) {
      console.error('[NetworkStatus] Failed to reconnect:', error);
    } finally {
      setIsReconnecting(false);
    }
  }, [isReconnecting]);

  const handleOnline = useCallback(() => {
    console.log('[NetworkStatus] Network online');
    setStatus(prev => ({ ...prev, isOnline: true }));
    
    // If we were offline, schedule a reconnection
    if (!lastOnlineRef.current) {
      // Clear any pending reconnection
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      // Delay reconnection slightly to ensure network is stable
      reconnectTimeoutRef.current = window.setTimeout(() => {
        reconnectRealtime();
      }, 1000);
    }
    
    lastOnlineRef.current = true;
  }, [reconnectRealtime]);

  const handleOffline = useCallback(() => {
    console.log('[NetworkStatus] Network offline');
    setStatus(prev => ({ ...prev, isOnline: false }));
    lastOnlineRef.current = false;
  }, []);

  useEffect(() => {
    // Web API listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Capacitor Network plugin for native apps
    let networkListener: { remove: () => void } | null = null;
    
    if (Capacitor.isNativePlatform()) {
      // Get initial status
      Network.getStatus().then((networkStatus) => {
        setStatus({
          isOnline: networkStatus.connected,
          connectionType: networkStatus.connectionType,
        });
        lastOnlineRef.current = networkStatus.connected;
      });

      // Listen for changes
      Network.addListener('networkStatusChange', (networkStatus) => {
        console.log('[NetworkStatus] Native status change:', networkStatus);
        setStatus({
          isOnline: networkStatus.connected,
          connectionType: networkStatus.connectionType,
        });

        if (networkStatus.connected && !lastOnlineRef.current) {
          // Clear any pending reconnection
          if (reconnectTimeoutRef.current) {
            window.clearTimeout(reconnectTimeoutRef.current);
          }
          
          // Delay reconnection slightly
          reconnectTimeoutRef.current = window.setTimeout(() => {
            reconnectRealtime();
          }, 1000);
        }

        lastOnlineRef.current = networkStatus.connected;
      }).then(listener => {
        networkListener = listener;
      });
    }

    // Visibility change handler - reconnect when app comes back to foreground
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && status.isOnline) {
        console.log('[NetworkStatus] App visible, checking connection');
        // Small delay then reconnect to ensure fresh data
        if (reconnectTimeoutRef.current) {
          window.clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = window.setTimeout(() => {
          reconnectRealtime();
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      
      networkListener?.remove();
    };
  }, [handleOnline, handleOffline, reconnectRealtime, status.isOnline]);

  return {
    isOnline: status.isOnline,
    connectionType: status.connectionType,
    isReconnecting,
    reconnect: reconnectRealtime,
  };
}
