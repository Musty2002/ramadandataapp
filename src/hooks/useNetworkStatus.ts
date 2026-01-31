import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: string | null;
}

/**
 * Simple network status hook - monitors connectivity without aggressive reconnection.
 * Let Supabase handle its own reconnection logic.
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: null,
  });

  const checkConnection = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      return navigator.onLine;
    }
    
    try {
      const networkStatus = await Network.getStatus();
      setStatus({
        isOnline: networkStatus.connected,
        connectionType: networkStatus.connectionType,
      });
      return networkStatus.connected;
    } catch {
      return true; // Assume connected if we can't check
    }
  }, []);

  useEffect(() => {
    // Web API listeners
    const handleOnline = () => {
      console.log('[NetworkStatus] Network online');
      setStatus(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      console.log('[NetworkStatus] Network offline');
      setStatus(prev => ({ ...prev, isOnline: false }));
    };

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
      });

      // Listen for changes
      Network.addListener('networkStatusChange', (networkStatus) => {
        console.log('[NetworkStatus] Native status change:', networkStatus);
        setStatus({
          isOnline: networkStatus.connected,
          connectionType: networkStatus.connectionType,
        });
      }).then(listener => {
        networkListener = listener;
      });
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      networkListener?.remove();
    };
  }, []);

  return {
    isOnline: status.isOnline,
    connectionType: status.connectionType,
    checkConnection,
  };
}
