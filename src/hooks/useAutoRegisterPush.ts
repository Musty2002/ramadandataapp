import { useEffect, useCallback, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-register push notifications on app launch - works without user login
 * Uses singleton pattern with refs to prevent double initialization
 */
export function useAutoRegisterPush() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const fcmTokenRef = useRef<string | null>(null);
  const initialized = useRef(false);
  const isInitializing = useRef(false);

  useEffect(() => {
    fcmTokenRef.current = fcmToken;
  }, [fcmToken]);

  const saveTokenToBackend = useCallback(async (token: string, userId?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('register-push-token', {
        body: {
          token,
          user_id: userId || null,
          device_info: {
            platform: Capacitor.getPlatform(),
            isNative: Capacitor.isNativePlatform(),
            registeredAt: new Date().toISOString(),
          }
        }
      });

      if (error) throw error;
      console.log('[AutoRegisterPush] Push token registered:', data);
      return data;
    } catch (error) {
      console.error('[AutoRegisterPush] Error saving push token:', error);
    }
  }, []);

  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[AutoRegisterPush] Push notifications only work on native platforms');
      return;
    }

    // Guard against multiple initializations
    if (initialized.current || isInitializing.current) {
      console.log('[AutoRegisterPush] Already initialized, skipping');
      return;
    }
    isInitializing.current = true;

    try {
      // CRITICAL: Remove existing listeners BEFORE adding new ones
      await PushNotifications.removeAllListeners();

      // Create default notification channel for Android
      if (Capacitor.getPlatform() === 'android') {
        await LocalNotifications.createChannel({
          id: 'default',
          name: 'Default Notifications',
          description: 'Default notification channel',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        });
        console.log('[AutoRegisterPush] Created default notification channel');
      }

      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();
      
      // If not determined, request permission
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('[AutoRegisterPush] Push notification permission not granted');
        isInitializing.current = false;
        return;
      }

      // Add listeners AFTER removing old ones
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('[AutoRegisterPush] Push registration success, token:', token.value);
        setFcmToken(token.value);
        initialized.current = true;
        isInitializing.current = false;
        
        // IMPORTANT: Do not block the registration callback.
        // Defer backend sync to avoid blocking network recovery.
        setTimeout(() => {
          void supabase.auth
            .getUser()
            .then(({ data }) => saveTokenToBackend(token.value, data.user?.id));
        }, 1500);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[AutoRegisterPush] Push registration error:', error);
        isInitializing.current = false;
      });

      // Foreground notification handler - NON-BLOCKING
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[AutoRegisterPush] Push received in foreground:', notification);
        
        // Show local notification when app is in foreground (non-blocking)
        LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: notification.title || 'New Notification',
              body: notification.body || '',
              sound: 'default',
              channelId: 'default',
            },
          ],
        }).catch(err => {
          console.warn('[AutoRegisterPush] Failed to schedule local notification:', err);
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[AutoRegisterPush] Push action performed:', action);
      });

      // Register for push notifications
      await PushNotifications.register();
      console.log('[AutoRegisterPush] Registered for push notifications');
      setIsRegistered(true);

    } catch (error) {
      console.error('[AutoRegisterPush] Error initializing push notifications:', error);
      isInitializing.current = false;
    }
  }, [saveTokenToBackend]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Initialize immediately on mount
    initializePushNotifications();

    // Cleanup on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [initializePushNotifications]);

  // Update token with user_id when user logs in
  useEffect(() => {
    if (!fcmToken) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && fcmToken) {
        // Defer to avoid blocking auth flow
        setTimeout(() => {
          void saveTokenToBackend(fcmToken, session.user.id);
        }, 1500);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fcmToken, saveTokenToBackend]);

  return {
    isRegistered,
    fcmToken,
  };
}
