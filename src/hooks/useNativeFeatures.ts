import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { Keyboard } from '@capacitor/keyboard';
import { toast } from 'sonner';

interface NetworkStatus {
  connected: boolean;
  connectionType: string | null;
}

export function useNativeFeatures() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    connected: true,
    connectionType: null,
  });
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  const checkConnection = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return true;
    
    try {
      const status = await Network.getStatus();
      setNetworkStatus({
        connected: status.connected,
        connectionType: status.connectionType,
      });
      return status.connected;
    } catch {
      return true; // Assume connected if we can't check
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initNative = async () => {
      // Get initial network status
      try {
        const status = await Network.getStatus();
        setNetworkStatus({
          connected: status.connected,
          connectionType: status.connectionType,
        });

        if (!status.connected) {
          toast.error('No internet connection', {
            id: 'network-offline',
            duration: Infinity,
          });
        }
      } catch (error) {
        console.warn('[NativeFeatures] Failed to get network status:', error);
      }

      // Listen for network changes
      try {
        Network.addListener('networkStatusChange', (status) => {
          console.log('[NativeFeatures] Network status changed:', status);
          setNetworkStatus({
            connected: status.connected,
            connectionType: status.connectionType,
          });

          if (!status.connected) {
            toast.error('No internet connection', {
              id: 'network-offline',
              duration: Infinity,
            });
          } else {
            toast.dismiss('network-offline');
            toast.success('Back online', { duration: 2000 });
          }
        });
      } catch (error) {
        console.warn('[NativeFeatures] Failed to add network listener:', error);
      }

      // Keyboard listeners
      try {
        Keyboard.addListener('keyboardWillShow', () => {
          setIsKeyboardOpen(true);
          document.body.classList.add('keyboard-open');
        });

        Keyboard.addListener('keyboardDidShow', () => {
          setIsKeyboardOpen(true);
          document.body.classList.add('keyboard-open');
        });

        Keyboard.addListener('keyboardWillHide', () => {
          setIsKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        });

        Keyboard.addListener('keyboardDidHide', () => {
          setIsKeyboardOpen(false);
          document.body.classList.remove('keyboard-open');
        });
      } catch (error) {
        console.warn('[NativeFeatures] Failed to add keyboard listeners:', error);
      }
    };

    initNative();

    return () => {
      try {
        Network.removeAllListeners();
        Keyboard.removeAllListeners();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  return {
    networkStatus,
    isOnline: networkStatus.connected,
    isKeyboardOpen,
    checkConnection,
  };
}
