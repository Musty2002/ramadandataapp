import { useEffect, useCallback, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePushNotifications() {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const initialized = useRef(false);
  const isInitializing = useRef(false);

  const saveTokenToDatabase = useCallback(async (token: string) => {
    if (!user) {
      console.log('[PushNotifications] No user logged in, skipping token save');
      return;
    }

    try {
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ 
            endpoint: token,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
        console.log('[PushNotifications] Updated push subscription');
      } else {
        const { error } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: user.id,
            endpoint: token,
            device_info: {
              platform: Capacitor.getPlatform(),
              isNative: Capacitor.isNativePlatform(),
            }
          });

        if (error) throw error;
        console.log('[PushNotifications] Created new push subscription');
      }
    } catch (error) {
      console.error('[PushNotifications] Error saving push token:', error);
    }
  }, [user]);

  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PushNotifications] Push notifications only work on native platforms');
      return;
    }

    // Guard against multiple initializations
    if (initialized.current || isInitializing.current) {
      console.log('[PushNotifications] Already initialized, skipping');
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
        console.log('[PushNotifications] Created default notification channel');
      }

      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('[PushNotifications] Push notification permission not granted');
        isInitializing.current = false;
        return;
      }

      // Add listeners AFTER removing old ones
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('[PushNotifications] Push registration success, token:', token.value);
        setFcmToken(token.value);
        initialized.current = true;
        isInitializing.current = false;

        // Don't block the registration callback; defer token persistence.
        setTimeout(() => {
          void saveTokenToDatabase(token.value);
        }, 1500);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[PushNotifications] Push registration error:', error);
        isInitializing.current = false;
      });

      // Foreground notification handler - NON-BLOCKING
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('[PushNotifications] Push received in foreground:', notification);
        
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
          console.warn('[PushNotifications] Failed to schedule local notification:', err);
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[PushNotifications] Push action performed:', action);
      });

      // Register for push notifications
      await PushNotifications.register();
      console.log('[PushNotifications] Registered for push notifications');
      setIsRegistered(true);

    } catch (error) {
      console.error('[PushNotifications] Error initializing push notifications:', error);
      isInitializing.current = false;
    }
  }, [saveTokenToDatabase]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    // Initialize
    initializePushNotifications();

    // Cleanup on unmount
    return () => {
      PushNotifications.removeAllListeners();
    };
  }, [user, initializePushNotifications]);

  const requestPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('[PushNotifications] Push notifications only work on native platforms');
      return false;
    }

    const permStatus = await PushNotifications.requestPermissions();
    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
      return true;
    }
    return false;
  }, []);

  return {
    isRegistered,
    fcmToken,
    requestPermission,
  };
}
