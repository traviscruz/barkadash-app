import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../utils/supabase';

// Present incoming pushes quietly while the app is open — the in-app
// notification banner (driven by realtime) shows the message instead, so
// we avoid double banners. A sound still plays.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getProjectId = (): string | undefined => {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId
  );
};

const getDeviceToken = async (): Promise<string | null> => {
  const projectId = getProjectId();
  try {
    if (projectId) {
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      return token.data;
    }
    // Fallback for projects without an explicit EAS project id.
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (err: any) {
    console.warn('Push token fetch failed:', err?.message);
    return null;
  }
};

export const PushService = {
  /**
   * Ask for permission and save the user's Expo push token to Supabase.
   * Safe to call on every sign-in; it self-heals when the token rotates.
   */
  async registerPushToken(userId?: string): Promise<boolean> {
    if (!userId) return false;
    if (Platform.OS === 'web') return false;

    try {
      // Android 13+ requires a channel before the permission prompt shows.
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Barkadash Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
        });
      }

      const current = await Notifications.getPermissionsAsync();
      let granted = current.granted;
      if (Platform.OS === 'ios') {
        granted =
          granted ||
          current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      }
      if (!granted) {
        const requested = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
        granted =
          requested.granted ||
          requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
      }
      if (!granted) return false;

      const token = await getDeviceToken();
      if (!token) return false;

      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (error) {
        console.warn('push_tokens upsert error:', error.message);
        return false;
      }
      return true;
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
      await supabase.from('push_tokens').delete().eq('user_id', userId);
    } catch (err: any) {
      console.warn('push_tokens delete error:', err?.message);
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
