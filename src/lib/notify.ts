import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

// Enable foreground banners and sounds so notifications appear even while the app is active
if (Platform.OS !== 'web') {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

export type NotificationType =
    | 'info'
    | 'warning'
    | 'error'
    | 'success'
    | 'system'
    | 'follow'
    | 'follow_back'
    | 'trip_invite'
    | 'trip_invite_response'
    | 'poll_result'
    | 'itinerary_added'
    | 'itinerary_reaction'
    | 'stay_added'
    | 'stay_reaction'
    | 'stay_comment'
    | 'expense_alert'
    | 'packing_alert';

export const PUSH_NOTIFS_ENABLED_KEY = '@barkadash_push_notifications_enabled';

/**
 * Checks whether push notifications are enabled by the user in app settings.
 */
export async function isPushNotificationEnabled(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(PUSH_NOTIFS_ENABLED_KEY);
        return val === null ? true : val === 'true';
    } catch {
        return true;
    }
}

/**
 * Persists the user's push notification preference.
 */
export async function setPushNotificationEnabled(enabled: boolean): Promise<void> {
    try {
        await AsyncStorage.setItem(PUSH_NOTIFS_ENABLED_KEY, enabled ? 'true' : 'false');
    } catch (err) {
        console.error('[notify] setPushNotificationEnabled error:', err);
    }
}

/**
 * Ensures system notification permissions have been granted.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'web') return false;

    try {
        const isEnabled = await isPushNotificationEnabled();
        if (!isEnabled) return false;

        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;

        const { status } = await Notifications.requestPermissionsAsync({
            ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
            },
        });
        return status === 'granted';
    } catch {
        return false;
    }
}

export interface CreateNotificationInput {
    userId: string;
    title: string;
    message: string;
    type?: NotificationType;
    category?: string;
    actionUrl?: string;
    actorId?: string;
    tripId?: string;
    itineraryItemId?: string;
    stayId?: string;
    skipLocalPush?: boolean;
}

const recentNotificationCache = new Set<string>();

/**
 * Centralized notification dispatcher:
 * 1. Deduplicates repetitive alerts within the same day/session.
 * 2. Persists the notification to Supabase `notifications` table.
 * 3. Immediately triggers a local foreground banner (works seamlessly in Expo Go without an external push server).
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
    const today = new Date().toLocaleDateString('en-CA');
    const dedupeKey = `${input.userId}::${input.title}::${input.message}::${today}`;

    if (recentNotificationCache.has(dedupeKey)) return;
    recentNotificationCache.add(dedupeKey);

    // ── 1. Save persistent notification in Supabase ──
    try {
        const insertPayload: Record<string, any> = {
            user_id: input.userId,
            title: input.title,
            message: input.message,
            type: input.type || 'info',
            category: input.category || 'system',
            action_url: input.actionUrl || null,
        };

        if (input.actorId) insertPayload.actor_id = input.actorId;
        if (input.tripId) insertPayload.trip_id = input.tripId;
        if (input.itineraryItemId) insertPayload.itinerary_item_id = input.itineraryItemId;
        if (input.stayId) insertPayload.stay_id = input.stayId;

        const { error } = await supabase.from('notifications').insert(insertPayload);
        if (error) {
            console.warn('[notify] Supabase notifications insert error:', error.message);
        }
    } catch (err) {
        console.error('[notify] insert error:', err);
    }

    if (input.skipLocalPush) return;

    // ── 2. Trigger immediate local push banner (Works out of the box in Expo Go) ──
    try {
        const granted = await ensureNotificationPermission();
        if (!granted) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: input.title,
                body: input.message,
                sound: true,
                data: {
                    actionUrl: input.actionUrl,
                    tripId: input.tripId,
                    type: input.type,
                    itineraryItemId: input.itineraryItemId,
                    stayId: input.stayId,
                },
            },
            trigger: null, // null trigger = fire immediately
        });
    } catch (err) {
        console.error('[notify] local push error:', err);
    }
}
