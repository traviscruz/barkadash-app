import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensureNotificationPermission } from './notify';

/**
 * Cancels all scheduled notifications whose identifier starts with a given prefix.
 */
export async function cancelNotificationsWithPrefix(prefix: string): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        const all = await Notifications.getAllScheduledNotificationsAsync();
        for (const notif of all) {
            if (notif.identifier.startsWith(prefix)) {
                await Notifications.cancelScheduledNotificationAsync(notif.identifier);
            }
        }
    } catch (err) {
        console.warn('[notificationScheduler] cancelNotificationsWithPrefix error:', err);
    }
}

/**
 * Schedules a recurring daily notification (e.g., Daily Squad Briefing at 8:00 AM).
 */
export async function scheduleDailyReminder(hour: number = 8, minute: number = 0): Promise<void> {
    if (Platform.OS === 'web') return;

    try {
        const granted = await ensureNotificationPermission();
        if (!granted) return;

        await cancelNotificationsWithPrefix('daily-morning-briefing');

        await Notifications.scheduleNotificationAsync({
            identifier: 'daily-morning-briefing',
            content: {
                title: 'Barkadash Daily Update',
                body: 'Open Barkadash to check your squad trips, voting updates, and travel plans.',
                sound: true,
                data: { actionUrl: 'notifications' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            } as any,
        });
    } catch (err) {
        console.warn('[notificationScheduler] scheduleDailyReminder error:', err);
    }
}

/**
 * Schedules a one-time reminder at a specific Date & Time.
 */
export async function scheduleDateReminder(
    id: string,
    title: string,
    body: string,
    triggerDate: Date,
    data?: Record<string, any>
): Promise<void> {
    if (Platform.OS === 'web' || triggerDate.getTime() <= Date.now()) return;

    try {
        const granted = await ensureNotificationPermission();
        if (!granted) return;

        const identifier = `reminder-${id}`;
        await Notifications.cancelScheduledNotificationAsync(identifier);

        await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
                title,
                body,
                sound: true,
                data: data || {},
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
            } as any,
        });
    } catch (err) {
        console.warn('[notificationScheduler] scheduleDateReminder error:', err);
    }
}

/**
 * 1-Day Advance Reminder for an upcoming trip departure.
 */
export async function scheduleTripDepartureReminder(
    tripId: string,
    tripTitle: string,
    departureDate: Date
): Promise<void> {
    const triggerDate = new Date(departureDate.getTime() - 24 * 60 * 60 * 1000);
    // Set notification time to 9:00 AM the day before departure
    triggerDate.setHours(9, 0, 0, 0);

    await scheduleDateReminder(
        `trip-dep-${tripId}`,
        'Trip Departing Tomorrow! ✈️',
        `Get ready! "${tripTitle}" kicks off tomorrow. Double check your packing checklist and itinerary.`,
        triggerDate,
        { tripId, type: 'trip_departure' }
    );
}

/**
 * 1-Hour Advance Reminder before a trip poll voting deadline expires.
 */
export async function scheduleVotingDeadlineReminder(
    tripId: string,
    tripTitle: string,
    deadlineDate: Date
): Promise<void> {
    const triggerDate = new Date(deadlineDate.getTime() - 60 * 60 * 1000);

    await scheduleDateReminder(
        `voting-deadline-${tripId}`,
        '1 Hour Left to Vote! 🗳️',
        `Voting for "${tripTitle}" ends in 1 hour. Cast your vote for the best spots now!`,
        triggerDate,
        { tripId, type: 'poll_deadline' }
    );
}

/**
 * 1-Hour Advance Reminder before a scheduled itinerary activity.
 */
export async function scheduleItinerarySpotReminder(
    itemId: string,
    itemTitle: string,
    activityTime: Date
): Promise<void> {
    const triggerDate = new Date(activityTime.getTime() - 60 * 60 * 1000);

    await scheduleDateReminder(
        `itinerary-spot-${itemId}`,
        'Upcoming Squad Activity 📍',
        `"${itemTitle}" starts in 1 hour. Time to gather with the squad!`,
        triggerDate,
        { itineraryItemId: itemId, type: 'itinerary_upcoming' }
    );
}
