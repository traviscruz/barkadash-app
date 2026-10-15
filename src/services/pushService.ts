import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotificationsAsync as registerPushAsync,
  unregisterPushTokenAsync,
} from '../lib/pushToken';

export const PushService = {
  /**
   * Ask for permission and save the user's push token (Native FCM/APNs or Expo) to Supabase.
   */
  async registerPushToken(userId?: string): Promise<boolean> {
    if (!userId || Platform.OS === 'web') return false;
    try {
      const token = await registerPushAsync(userId);
      return !!token;
    } catch (err: any) {
      console.warn('PushService.registerPushToken exception:', err?.message);
      return false;
    }
  },

  /**
   * Remove the stored push token on logout so the user stops getting pushes.
   */
  async unregisterPushToken(userId?: string): Promise<void> {
    if (!userId || Platform.OS === 'web') return;
    try {
      await unregisterPushTokenAsync(userId);
    } catch (err: any) {
      console.warn('PushService.unregisterPushToken error:', err?.message);
    }
  },

  /**
   * Run once when the user taps a push notification (app backgrounded/killed).
   * `cb` receives the payload so the app can navigate to the right screen.
   */
  listenForPushResponses(cb: (payload: Record<string, any>) => void): () => void {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      cb(data);
    });

    // Handle the case where the app was opened from a cold start by tapping.
    Notifications.getLastNotificationResponseAsync?.().then((lastResponse) => {
      if (lastResponse) {
        cb(lastResponse.notification.request.content.data || {});
      }
    });

    return () => sub.remove();
  },
};

export const registerForPushNotificationsAsync =
  PushService.registerPushToken.bind(PushService);

