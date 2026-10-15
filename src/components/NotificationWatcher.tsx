import { useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { createNotification } from '@/lib/notify';
import {
    scheduleDailyReminder,
    scheduleVotingDeadlineReminder,
    scheduleTripDepartureReminder,
} from '@/lib/notificationScheduler';

const inFlightAlertKeys = new Set<string>();

async function alreadyAlerted(key: string): Promise<boolean> {
    if (inFlightAlertKeys.has(key)) return true;
    try {
        const val = await AsyncStorage.getItem(key);
        if (val !== null) {
            inFlightAlertKeys.add(key);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

async function markAlerted(key: string): Promise<void> {
    inFlightAlertKeys.add(key);
    try {
        await AsyncStorage.setItem(key, '1');
    } catch {
        // best-effort
    }
}

export function NotificationWatcher({ userId }: { userId?: string }) {
    const userRef = useRef<string | undefined>(userId);
    userRef.current = userId;

    // Cache of notification IDs recently triggered to avoid double-bannering
    const seenNotifIds = useRef<Set<string>>(new Set());

    // ── 1. Check Upcoming Squad Events (Deadlines, Trips, Settlements) ──
    const checkUpcomingTripAlerts = useCallback(async (currentUserId: string) => {
        const today = new Date().toLocaleDateString('en-CA');

        try {
            // A. Fetch trips where the user is an accepted participant
            const { data: participations } = await supabase
                .from('trip_participants')
                .select('trip_id, trips(id, title, voting_deadline, planning_stage, date_range)')
                .eq('user_id', currentUserId)
                .eq('status', 'accepted');

            if (participations) {
                const now = Date.now();

                for (const part of participations as any[]) {
                    const trip = part.trips;
                    if (!trip) continue;

                    // 1. Voting Deadline Check (1 hour window or upcoming)
                    if (trip.voting_deadline && trip.planning_stage === 'DESTINATION_VOTING') {
                        const deadlineDate = new Date(trip.voting_deadline);
                        const msUntilDeadline = deadlineDate.getTime() - now;

                        // Schedule push notification reminder 1 hour before
                        if (msUntilDeadline > 60 * 60 * 1000) {
                            await scheduleVotingDeadlineReminder(trip.id, trip.title, deadlineDate);
                        } else if (msUntilDeadline > 0 && msUntilDeadline <= 60 * 60 * 1000) {
                            // Already within the 1-hour window today
                            const alertKey = `voting_closing_soon_${trip.id}_${today}`;
                            if (!(await alreadyAlerted(alertKey))) {
                                await createNotification({
                                    userId: currentUserId,
                                    tripId: trip.id,
                                    title: '1 Hour Left to Vote! 🗳️',
                                    message: `Voting for "${trip.title}" is closing soon. Tap to make your vote count!`,
                                    type: 'poll_result',
                                    category: 'poll',
                                    skipLocalPush: false,
                                });
                                await markAlerted(alertKey);
                            }
                        }
                    }

                    // 2. Upcoming Trip Departure Check
                    if (trip.date_range && trip.date_range !== 'Dates TBD') {
                        // Example parse: "Oct 20, 2026 - Oct 25, 2026"
                        const firstDateStr = trip.date_range.split('-')[0]?.trim();
                        if (firstDateStr) {
                            const parsedDate = new Date(firstDateStr);
                            if (!isNaN(parsedDate.getTime()) && parsedDate.getTime() > now) {
                                await scheduleTripDepartureReminder(trip.id, trip.title, parsedDate);
                            }
                        }
                    }
                }
            }

            // B. Pending Expense Settlements awaiting payee verification
            const { data: pendingSettlements } = await supabase
                .from('expense_settlements')
                .select('id, amount, payer_id, trips(title), profiles:payer_id(first_name, username)')
                .eq('payee_id', currentUserId)
                .eq('status', 'pending');

            if (pendingSettlements && pendingSettlements.length > 0) {
                for (const settlement of pendingSettlements as any[]) {
                    const alertKey = `settlement_pending_${settlement.id}_${today}`;
                    if (!(await alreadyAlerted(alertKey))) {
                        const payerName = settlement.profiles?.first_name || settlement.profiles?.username || 'A squad member';
                        const tripTitle = settlement.trips?.title || 'Trip';
                        await createNotification({
                            userId: currentUserId,
                            title: 'Payment Verification Needed 💸',
                            message: `${payerName} submitted a payment proof for ₱${settlement.amount} (${tripTitle}). Tap to review and verify.`,
                            type: 'expense_alert',
                            category: 'expense',
                            skipLocalPush: false,
                        });
                        await markAlerted(alertKey);
                    }
                }
            }
        } catch (err) {
            console.warn('[NotificationWatcher] checkUpcomingTripAlerts error:', err);
        }
    }, []);

    useEffect(() => {
        if (!userId) return;

        // 1. Schedule Recurring Daily Squad Briefing (8:00 AM)
        scheduleDailyReminder(8, 0);

        // 2. Run initial check for upcoming trip events
        checkUpcomingTripAlerts(userId);

        // 3. Subscribe to Realtime Supabase PostgreSQL changes for this user
        const channel = supabase
            .channel(`barkadash-user-notifs-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const row = payload.new as any;
                    if (!row || !row.id) return;

                    // Avoid re-alerting if we've already handled this notification ID
                    if (seenNotifIds.current.has(row.id)) return;
                    seenNotifIds.current.add(row.id);

                    // Ignore historical row replays (older than 30 seconds)
                    if (row.created_at) {
                        const ageMs = Date.now() - new Date(row.created_at).getTime();
                        if (ageMs > 30000) return;
                    }

                    // Trigger in-app local notification banner
                    createNotification({
                        userId: row.user_id,
                        title: row.title || 'Barkadash',
                        message: row.message || '',
                        type: row.type || 'info',
                        category: row.category || 'system',
                        actionUrl: row.action_url,
                        actorId: row.actor_id,
                        tripId: row.trip_id,
                        itineraryItemId: row.itinerary_item_id,
                        stayId: row.stay_id,
                        skipLocalPush: false,
                    });
                }
            )
            .subscribe();

        // 4. Periodic check every 5 minutes for state transitions
        const interval = setInterval(() => {
            if (userRef.current) {
                checkUpcomingTripAlerts(userRef.current);
            }
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [userId, checkUpcomingTripAlerts]);

    return null;
}
