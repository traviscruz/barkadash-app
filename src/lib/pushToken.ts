import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

let lastRegisteredToken: string | null = null;
let lastRegisteredUser: string | null = null;

const getEASProjectId = (): string | undefined => {
    return (
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId
    );
};

/**
 * Registers the device for push notifications with dual-mode support:
 * 1. Attempts Native Device Push Token first (FCM on Android, APNs on iOS) for production builds.
 * 2. Gracefully falls back to Expo Push Token if native credentials are not present (Expo Go / Simulator).
 * 3. Upserts the token into Supabase `user_push_tokens` (and backwards-compatible `push_tokens`).
 */
export async function registerForPushNotificationsAsync(userId?: string): Promise<string | null> {
    if (Platform.OS === 'web' || !userId) return null;

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync({
                ios: {
                    allowAlert: true,
                    allowBadge: true,
                    allowSound: true,
                },
            });
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            return null;
        }

        // Configure default Android Notification Channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Barkadash Notifications',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#4F46E5',
            });
        }

        let token: string | null = null;
        const projectId = getEASProjectId();

        // ── 1. Try Native Device Push Token (FCM for Android, APNs for iOS) ──
        try {
            if (Platform.OS === 'android') {
                const tokenData = await Notifications.getDevicePushTokenAsync();
                token = typeof tokenData.data === 'string'
                    ? tokenData.data
                    : (tokenData as any)?.data?.token ?? null;
            } else {
                try {
                    const tokenData = await Notifications.getDevicePushTokenAsync();
                    token = typeof tokenData.data === 'string' ? tokenData.data : null;
                } catch {
                    // Fallback on iOS if APNs entitlement is missing (e.g., Simulator / Expo Go)
                    const expoToken = await Notifications.getExpoPushTokenAsync(
                        projectId ? { projectId } : undefined
                    );
                    token = expoToken.data;
                }
            }
        } catch {
            // ── 2. Automatic Development Fallback for Expo Go ──
            try {
                const fallback = await Notifications.getExpoPushTokenAsync(
                    projectId ? { projectId } : undefined
                );
                token = fallback.data;
            } catch (fallbackError) {
                console.warn('[pushToken] Fallback token retrieval failed:', fallbackError);
                token = null;
            }
        }

        if (!token) return null;

        // Skip redundant database writes if the token and user haven't changed
        if (token === lastRegisteredToken && userId === lastRegisteredUser) {
            return token;
        }

        // ── 3. Persist Push Token to Supabase (Multi-device user_push_tokens) ──
        try {
            const { error: userTokensError } = await supabase.from('user_push_tokens').upsert(
                {
                    user_id: userId,
                    fcm_token: token,
                    device_type: Platform.OS,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,fcm_token' }
            );

            if (userTokensError) {
                console.warn('[pushToken] user_push_tokens upsert notice:', userTokensError.message);
            }
        } catch (e) {
            console.warn('[pushToken] user_push_tokens write error:', e);
        }

        // Backwards compatibility with existing push_tokens table
        try {
            await supabase.from('push_tokens').upsert(
                {
                    user_id: userId,
                    token: token,
                    platform: Platform.OS,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );
        } catch {
            // best-effort
        }

        lastRegisteredToken = token;
        lastRegisteredUser = userId;

        return token;
    } catch (error) {
        console.warn('[pushToken] Registration error:', error);
        return null;
    }
}

/**
 * Removes the registered push token when the user logs out.
 */
export async function unregisterPushTokenAsync(userId?: string): Promise<void> {
    if (!userId || Platform.OS === 'web') return;

    try {
        if (lastRegisteredToken) {
            await supabase.from('user_push_tokens').delete().match({
                user_id: userId,
                fcm_token: lastRegisteredToken,
            });
        }
        await supabase.from('push_tokens').delete().eq('user_id', userId);
        lastRegisteredToken = null;
        lastRegisteredUser = null;
    } catch (err) {
        console.warn('[pushToken] unregister error:', err);
    }
}
