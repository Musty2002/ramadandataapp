import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function usePushNotifications() {
  const { user } = useAuth();
  const [isRegistered, setIsRegistered] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const saveTokenToDatabase = useCallback(async (token: string) => {
    if (!user) {
      console.log('No user logged in, skipping token save');
      return;
    }

    try {
      // Check if subscription already exists for this user
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // Update existing subscription
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ 
            endpoint: token,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (error) throw error;
        console.log('Updated push subscription');
      } else {
        // Insert new subscription
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
        console.log('Created new push subscription');
      }
    } catch (error) {
      console.error('Error saving push token:', error);
    }
  }, [user]);

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

      // Request permission
      let permStatus = await PushNotifications.checkPermissions();
      
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
    if (!Capacitor.isNativePlatform() || !user) return;

    // Registration success handler
    const registrationListener = PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token:', token.value);
      setFcmToken(token.value);
      await saveTokenToDatabase(token.value);
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
        // Handle notification tap - can navigate to specific screens based on data
      }
    );

    // Initialize
    initializePushNotifications();

    // Cleanup
    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      foregroundListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [user, initializePushNotifications, saveTokenToDatabase]);

  const requestPermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications only work on native platforms');
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
