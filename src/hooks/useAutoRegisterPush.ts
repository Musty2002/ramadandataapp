import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Auto-register push notifications on app launch - works without user login
 */
export function useAutoRegisterPush() {
  const [isRegistered, setIsRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

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
      console.log('Push token registered:', data);
      return data;
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }, []);

  const initializePushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
      return;
    }

    try {
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
        console.log('Created default notification channel');
      }

      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();
      
      // If not determined, request permission
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission not granted');
        return;
      }

      // Register for push notifications
      await PushNotifications.register();
      console.log('Registered for push notifications');
      setIsRegistered(true);

    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Registration success handler
    const registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setFcmToken(token.value);
      
      // Get current user if logged in
      const { data: { user } } = await supabase.auth.getUser();
      await saveTokenToBackend(token.value, user?.id);
    });

    // Registration error handler
    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Foreground notification handler
    const foregroundListener = PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('Push received in foreground:', notification);
        
        // Show local notification when app is in foreground
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title: notification.title || 'New Notification',
              body: notification.body || '',
              sound: 'default',
              channelId: 'default',
            },
          ],
        });
      }
    );

    // Notification action handler
    const actionListener = PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        console.log('Push action performed:', action);
      }
    );

    // Initialize immediately on mount
    initializePushNotifications();

    // Cleanup
    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      foregroundListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [initializePushNotifications, saveTokenToBackend]);

  // Also update token with user_id when user logs in
  useEffect(() => {
    if (!fcmToken) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user && fcmToken) {
        // Update the token with the user's ID
        await saveTokenToBackend(fcmToken, session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [fcmToken, saveTokenToBackend]);

  return {
    isRegistered,
    fcmToken,
  };
}
