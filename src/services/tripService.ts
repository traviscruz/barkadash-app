import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, DestinationPollOption, BarkadaActivity, ItineraryItem, ItineraryTag, ItineraryReaction, TripStay, TripStayReaction, TripStayComment, MemberCommitment } from '../types/trip';
import { SpotItem, PlaceItem } from '../types/aiRecommendation';
import { supabase } from '../utils/supabase';
import { sortItineraryChronological, getTripDayInfo } from '../utils/tripDates';
import { NotificationService } from './notificationService';

const sagadaImg = require('../../assets/images/sagada.jpeg');
const elnidoEscapeImg = require('../../assets/images/elnidoescape.jpg');

const PLACEHOLDER_DESTINATIONS = ['Voting in Progress', 'Voting Phase', 'Destination Voting'];
const PLACEHOLDER_DATE_RANGES = ['Dates TBD', 'Upcoming Dates', 'Upcoming'];

const cleanInviteField = (value: string | null, placeholders: string[]): string => {
  if (!value) return '';
  return placeholders.includes(value) ? '' : value;
};

export class TripService {
  private static instance: TripService;

  private static STORAGE_ACTIVE_TRIP_ID = '@barkadash_selected_trip_id';
  private static STORAGE_ACTIVE_TRIP_NAME = '@barkadash_selected_trip_name';

  private trips: Trip[] = [];
  private reopenedTripIds: Set<string> = new Set();

  private activeTripId: string = '';
  private activeTripName: string = '';

  private pollOptions: DestinationPollOption[] = [];

  private listeners: (() => void)[] = [];

  private constructor() {
    this.loadPersistedActiveTrip();
  }

  public static getInstance(): TripService {
    if (!TripService.instance) {
      TripService.instance = new TripService();
    }
    return TripService.instance;
  }

  public async loadPersistedActiveTrip(): Promise<{ id: string; name: string }> {
    try {
      const [savedId, savedName] = await Promise.all([
        AsyncStorage.getItem(TripService.STORAGE_ACTIVE_TRIP_ID),
        AsyncStorage.getItem(TripService.STORAGE_ACTIVE_TRIP_NAME),
      ]);
      if (savedId) {
        this.activeTripId = savedId;
      }
      if (savedName) {
        this.activeTripName = savedName;
      }
      return { id: savedId || '', name: savedName || '' };
    } catch (e) {
      console.warn('loadPersistedActiveTrip error:', e);
      return { id: '', name: '' };
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }

  public generateShortCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public getTrips(): Trip[] {
    return [...this.trips];
  }

  public getActiveTrip(): Trip | null {
    if (this.activeTripId) {
      const found = this.trips.find((t) => t.id === this.activeTripId);
      if (found) return found;
    }
    if (this.activeTripName) {
      const foundByName = this.trips.find(
        (t) => t.title.trim().toLowerCase() === this.activeTripName.trim().toLowerCase()
      );
      if (foundByName) {
        this.activeTripId = foundByName.id;
        return foundByName;
      }
    }
    return this.trips[0] || null;
  }

  public setActiveTripId(id: string) {
    this.activeTripId = id;
    const trip = this.trips.find((t) => t.id === id);
    if (trip?.title) {
      this.activeTripName = trip.title;
      AsyncStorage.setItem(TripService.STORAGE_ACTIVE_TRIP_NAME, trip.title).catch(() => {});
    }
    AsyncStorage.setItem(TripService.STORAGE_ACTIVE_TRIP_ID, id).catch(() => {});
    this.notify();
  }

  /**
   * Returns true if the trip is ended (status is 'Completed' or date range has passed without being reopened).
   */
  public isTripEnded(trip: Trip | { id?: string; status?: string; dateRange?: string } | null): boolean {
    if (!trip) return false;
    if (trip.status === 'Completed') return true;
    if (trip.id && this.reopenedTripIds.has(trip.id)) return false;
    const dayInfo = getTripDayInfo(trip.dateRange);
    return !!dayInfo?.isEnded;
  }

  /**
   * Database-backed Trip Creation (Host)
   * Inserts trip into public.trips and participants into public.trip_participants
   */
  public async createTripDB(params: {
    title: string;
    hostId: string;
    invitedFriendIds?: string[];
    targetDates?: string;
  }): Promise<{ success: boolean; trip?: Trip; message?: string }> {
    try {
      const titleClean = params.title.trim() || 'New Barkada Trip';
      let effectiveHostId = params.hostId;

      if (!effectiveHostId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveHostId = authData.user?.id || '';
      }

      if (!effectiveHostId) {
        return {
          success: false,
          message: 'User authentication required to host a trip.',
        };
      }
      
      // Retry invite code generation if unique constraint hit
      let inviteCode = this.generateShortCode();
      let tripInserted: any = null;
      let retries = 3;
      let lastInsertError: string = '';

      while (retries > 0) {
        const { data, error } = await supabase
          .from('trips')
          .insert({
            title: titleClean,
            host_id: effectiveHostId,
            invite_code: inviteCode,
            destination: 'Voting in Progress',
            date_range: params.targetDates || 'Dates TBD',
            planning_stage: 'DESTINATION_VOTING',
            status: 'Active',
          })
          .select()
          .single();

        if (!error && data) {
          tripInserted = data;
          break;
        }

        if (error) {
          lastInsertError = error.message;
          if (error.code === '23505') {
            // Unique violation on invite_code, retry with new code
            inviteCode = this.generateShortCode();
            retries--;
          } else {
            console.warn('Supabase createTripDB insert error:', error.message);
            break;
          }
        }
      }

      const friendIds = params.invitedFriendIds || [];

      if (tripInserted) {
        // Insert Host into trip_participants
        const participantsToInsert = [
          {
            trip_id: tripInserted.id,
            user_id: effectiveHostId,
            role: 'host',
            status: 'accepted',
          },
          ...friendIds.map((fId) => ({
            trip_id: tripInserted.id,
            user_id: fId,
            role: 'member',
            status: 'pending',
          })),
        ];

        const { error: partErr } = await supabase
          .from('trip_participants')
          .insert(participantsToInsert);

        if (partErr) {
          console.warn('Supabase trip_participants insert warning:', partErr.message);
        }

        // Fetch host profile name for notification
        let hostNameStr = 'Your friend';
        if (effectiveHostId) {
          const { data: hostProf } = await supabase
            .from('profiles')
            .select('first_name, last_name')
            .eq('id', effectiveHostId)
            .maybeSingle();
          if (hostProf?.first_name) {
            hostNameStr = `${hostProf.first_name} ${hostProf.last_name || ''}`.trim();
          }
        }

        // Send trip_invite notifications to invited friends
        if (friendIds.length > 0) {
          const notificationPayloads = friendIds.map((fId) => ({
            user_id: fId,
            actor_id: effectiveHostId,
            type: 'trip_invite',
            title: 'Trip Invitation',
            message: `${hostNameStr} is inviting you to join "${titleClean}"!`,
            is_read: false,
          }));

          await supabase.from('notifications').insert(notificationPayloads);
        }

        const newTrip: Trip = {
          id: tripInserted.id,
          title: tripInserted.title,
          destination: tripInserted.destination || 'Voting in Progress',
          dateRange: `${tripInserted.date_range || 'Dates TBD'} · ${1 + friendIds.length} barkadas`,
          memberCount: 1 + friendIds.length,
          status: 'Active',
          imageUrl: elnidoEscapeImg,
          totalBudget: Number(tripInserted.total_budget) || 15000,
          spentAmount: Number(tripInserted.spent_amount) || 0,
          daysLeft: null,
          weatherTemp: '--',
          weatherCondition: 'Planning Phase',
          nextActivityTitle: 'Vote on Destination Poll',
          nextActivityTime: 'Open for Voting',
          inviteCode: tripInserted.invite_code,
          inviteLink: `https://barkadash.app/join/${tripInserted.invite_code}`,
          hostName: 'You',
          hostId: effectiveHostId,
          votingDeadline: tripInserted.voting_deadline || null,
          planningStage: tripInserted.planning_stage || 'DESTINATION_VOTING',
          invitedFriendIds: friendIds,
          day1Itinerary: [
            {
              id: 'i_init1',
              time: '10:00 AM',
              title: 'Cast Votes on Destination Poll',
              category: 'VOTING',
              location: 'Barkadash Poll',
              estCost: 'Free',
              note: 'Everyone choose your top spot!',
              isCompleted: false,
            },
          ],
        };

        this.trips.unshift(newTrip);
        this.activeTripId = newTrip.id;
        this.notify();
        return { success: true, trip: newTrip };
      }

      // Fallback local creation if DB insertion was unavailable
      const fallbackTrip = this.createTrip({
        title: titleClean,
        targetDates: params.targetDates,
        invitedFriendIds: friendIds,
      });

      return { success: true, trip: fallbackTrip };
    } catch (err: any) {
      console.warn('createTripDB exception:', err?.message);
      const fallbackTrip = this.createTrip({
        title: params.title,
        invitedFriendIds: params.invitedFriendIds,
      });
      return { success: true, trip: fallbackTrip };
    }
  }

  /**
   * Database-backed Join Trip by Code
   * Searches public.trips by invite_code and adds user to public.trip_participants
   */
  public async joinTripByCodeDB(
    code: string,
    userId?: string
  ): Promise<{ success: boolean; trip?: Trip; message?: string }> {
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanCode.length < 5) {
      return { success: false, message: 'Please enter a valid 6-character trip code' };
    }

    try {
      // 1. Query Supabase trips table for invite_code
      const { data: tripData, error: tripErr } = await supabase
        .from('trips')
        .select('*')
        .eq('invite_code', cleanCode)
        .maybeSingle();

      if (tripErr) {
        console.warn('Supabase joinTripByCodeDB query notice:', tripErr.message);
      }

      if (tripData) {
        let memberCount = 1;

        if (userId) {
          // Add user to trip_participants table
          const { error: joinErr } = await supabase.from('trip_participants').upsert(
            {
              trip_id: tripData.id,
              user_id: userId,
              role: 'member',
            },
            { onConflict: 'trip_id,user_id' }
          );

          if (joinErr) {
            console.warn('Supabase join trip_participants error:', joinErr.message);
          }

          // Count total participants in trip
          const { count } = await supabase
            .from('trip_participants')
            .select('*', { count: 'exact', head: true })
            .eq('trip_id', tripData.id);

          if (count) memberCount = count;
        }

        const joinedTrip: Trip = {
          id: tripData.id,
          title: tripData.title,
          destination: tripData.destination || 'Destination Voting',
          dateRange: `${tripData.date_range || 'Upcoming'} · ${memberCount} barkadas`,
          memberCount: memberCount,
          status: 'Active',
          imageUrl: sagadaImg,
          totalBudget: Number(tripData.total_budget) || 20000,
          spentAmount: Number(tripData.spent_amount) || 0,
          daysLeft: null,
          weatherTemp: '28°C',
          weatherCondition: 'Sunny',
          nextActivityTitle: 'Join Destination Poll',
          nextActivityTime: 'Today',
          inviteCode: tripData.invite_code,
          inviteLink: `https://barkadash.app/join/${tripData.invite_code}`,
          hostName: 'Barkada Host',
          hostId: tripData.host_id || undefined,
          votingDeadline: tripData.voting_deadline || null,
          planningStage: tripData.planning_stage || 'DESTINATION_VOTING',
          day1Itinerary: [
            {
              id: `ij_${Date.now()}`,
              time: '09:00 AM',
              title: 'Welcome to the Trip!',
              category: 'JOINED',
              location: 'Barkadash App',
              estCost: 'Free',
              note: `You joined using trip code ${cleanCode}`,
              isCompleted: true,
            },
          ],
        };

        // Remove duplicate if exists and unshift
        this.trips = this.trips.filter((t) => t.id !== joinedTrip.id);
        this.trips.unshift(joinedTrip);
        this.activeTripId = joinedTrip.id;
        this.notify();

        return { success: true, trip: joinedTrip };
      }

      // Fallback local check if DB trip wasn't found
      return this.joinTripByCode(cleanCode);
    } catch (err: any) {
      console.warn('joinTripByCodeDB exception:', err?.message);
      return this.joinTripByCode(cleanCode);
    }
  }

  /**
   * Fetch all user trips from Supabase DB
   */
  public async fetchUserTripsDB(userId?: string): Promise<Trip[]> {
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }

    if (!effectiveUserId) return this.trips;

    try {
      // 1. Query trip_participants joined with trips
      const { data: partData, error: partErr } = await supabase
        .from('trip_participants')
        .select(`
          trip_id,
          role,
          status,
          trips:trip_id (
            id,
            title,
            host_id,
            invite_code,
            destination,
            date_range,
            planning_stage,
            status,
            total_budget,
            spent_amount,
            voting_deadline,
            created_at
          )
        `)
        .eq('user_id', effectiveUserId);

      // 2. Query trips hosted by this user
      const { data: hostedData, error: hostErr } = await supabase
        .from('trips')
        .select('*')
        .eq('host_id', effectiveUserId);

      if (partErr && hostErr) {
        console.warn('fetchUserTripsDB errors:', partErr?.message, hostErr?.message);
        return this.trips;
      }

      const tripMap = new Map<string, Trip>();

      // Process participant trips
      if (partData && partData.length > 0) {
        for (const p of partData) {
          const t = (p as any).trips;
          if (!t) continue;
          // Pending or declined invites MUST NOT be shown as joined active trips!
          if (p.role !== 'host' && p.status !== 'accepted') continue;

          const rawStatus = t.status || 'Active';
          const dayInfo = getTripDayInfo(t.date_range);
          const isPast = !!dayInfo?.isEnded;
          const isReopened = this.reopenedTripIds.has(t.id);
          const effectiveStatus: Trip['status'] = (rawStatus === 'Completed' || (isPast && !isReopened))
            ? 'Completed'
            : (rawStatus as Trip['status']);

          if (isPast && rawStatus === 'Active' && !isReopened) {
            supabase.from('trips').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', t.id).then();
          }

          tripMap.set(t.id, {
            id: t.id,
            title: t.title,
            destination: t.destination || 'Voting in Progress',
            dateRange: t.date_range || 'Dates TBD',
            memberCount: 1,
            status: effectiveStatus,
            imageUrl: elnidoEscapeImg,
            totalBudget: Number(t.total_budget) || 15000,
            spentAmount: Number(t.spent_amount) || 0,
            daysLeft: null,
            weatherTemp: '--',
            weatherCondition: 'Planning Phase',
            nextActivityTitle: 'Vote on Destination Poll',
            nextActivityTime: 'Open for Voting',
            inviteCode: t.invite_code,
            inviteLink: `https://barkadash.app/join/${t.invite_code}`,
            hostName: p.role === 'host' ? 'You' : 'Barkada Host',
            hostId: t.host_id || undefined,
            votingDeadline: t.voting_deadline || null,
            planningStage: t.planning_stage || 'DESTINATION_VOTING',
            day1Itinerary: [],
          });
        }
      }

      // Process hosted trips
      if (hostedData && hostedData.length > 0) {
        for (const t of hostedData) {
          if (!tripMap.has(t.id)) {
            const rawStatus = t.status || 'Active';
            const dayInfo = getTripDayInfo(t.date_range);
            const isPast = !!dayInfo?.isEnded;
            const isReopened = this.reopenedTripIds.has(t.id);
            const effectiveStatus: Trip['status'] = (rawStatus === 'Completed' || (isPast && !isReopened))
              ? 'Completed'
              : (rawStatus as Trip['status']);

            if (isPast && rawStatus === 'Active' && !isReopened) {
              supabase.from('trips').update({ status: 'Completed', updated_at: new Date().toISOString() }).eq('id', t.id).then();
            }

            tripMap.set(t.id, {
              id: t.id,
              title: t.title,
              destination: t.destination || 'Voting in Progress',
              dateRange: t.date_range || 'Dates TBD',
              memberCount: 1,
              status: effectiveStatus,
              imageUrl: elnidoEscapeImg,
              totalBudget: Number(t.total_budget) || 15000,
              spentAmount: Number(t.spent_amount) || 0,
              daysLeft: null,
              weatherTemp: '--',
              weatherCondition: 'Planning Phase',
              nextActivityTitle: 'Vote on Destination Poll',
              nextActivityTime: 'Open for Voting',
              inviteCode: t.invite_code,
              inviteLink: `https://barkadash.app/join/${t.invite_code}`,
              hostName: 'You',
              hostId: t.host_id || undefined,
              votingDeadline: t.voting_deadline || null,
              planningStage: t.planning_stage || 'DESTINATION_VOTING',
              day1Itinerary: [],
            });
          }
        }
      }

      // Compute actual participant counts for all trips
      const allTripIds = Array.from(tripMap.keys());
      if (allTripIds.length > 0) {
        const { data: countData } = await supabase
          .from('trip_participants')
          .select('trip_id')
          .in('trip_id', allTripIds);

        if (countData) {
          const counts: Record<string, number> = {};
          countData.forEach((row: any) => {
            counts[row.trip_id] = (counts[row.trip_id] || 0) + 1;
          });

          for (const [id, trip] of tripMap.entries()) {
            if (counts[id]) {
              trip.memberCount = counts[id];
            }
          }
        }
      }

      const fetchedTrips = Array.from(tripMap.values());
      this.trips = fetchedTrips;

      if (this.trips.length > 0) {
        // 1. Try matching current activeTripId
        let match = this.trips.find((t) => t.id === this.activeTripId);

        // 2. Try matching activeTripName
        if (!match && this.activeTripName) {
          match = this.trips.find(
            (t) => t.title.trim().toLowerCase() === this.activeTripName.trim().toLowerCase()
          );
        }

        // 3. Try reading from persistent AsyncStorage if in-memory was empty
        if (!match) {
          try {
            const [savedId, savedName] = await Promise.all([
              AsyncStorage.getItem(TripService.STORAGE_ACTIVE_TRIP_ID),
              AsyncStorage.getItem(TripService.STORAGE_ACTIVE_TRIP_NAME),
            ]);
            if (savedId) {
              match = this.trips.find((t) => t.id === savedId);
            }
            if (!match && savedName) {
              match = this.trips.find(
                (t) => t.title.trim().toLowerCase() === savedName.trim().toLowerCase()
              );
            }
          } catch (e) {}
        }

        if (match) {
          this.activeTripId = match.id;
          this.activeTripName = match.title;
        } else {
          this.activeTripId = this.trips[0].id;
          this.activeTripName = this.trips[0].title;
        }
      } else {
        this.activeTripId = '';
        this.activeTripName = '';
      }
      this.notify();

      // Check if any trip's voting deadline has passed while still in voting stage — auto-finalize winners
      for (const trip of fetchedTrips) {
        if (
          trip.votingDeadline &&
          new Date(trip.votingDeadline).getTime() <= Date.now() &&
          (trip.planningStage === 'DESTINATION_VOTING' || !trip.planningStage)
        ) {
          this.finalizeEndedPollDB(trip.id).catch((e) =>
            console.warn('Auto finalizeEndedPollDB notice:', e?.message)
          );
        }
      }

      return this.trips;
    } catch (err: any) {
      console.warn('fetchUserTripsDB exception:', err?.message);
      return this.trips;
    }
  }

  /**
   * Fetch pending trip invitations for a user
   */
  public async fetchPendingTripInvitesDB(userId?: string): Promise<Array<{
    tripId: string;
    tripTitle: string;
    destination: string;
    dateRange: string;
    hostName: string;
    inviteCode: string;
    memberCount: number;
  }>> {
    let effectiveUserId = userId;
    if (!effectiveUserId) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveUserId = authData?.user?.id;
    }
    if (!effectiveUserId) return [];

    try {
      const { data, error } = await supabase
        .from('trip_participants')
        .select(`
          trip_id,
          role,
          status,
          trips:trip_id (
            id,
            title,
            destination,
            date_range,
            invite_code,
            host_id,
            profiles:host_id (
              first_name,
              last_name
            )
          )
        `)
        .eq('user_id', effectiveUserId)
        .eq('status', 'pending');

      if (error || !data) return [];

      const rows = data.filter((row: any) => row.trips);
      if (rows.length === 0) return [];

      // Count members who have actually JOINED (status = accepted) per trip,
      // so the invite shows the real number already in.
      const tripIds = rows.map((r: any) => r.trip_id);
      const { data: joinedRows } = await supabase
        .from('trip_participants')
        .select('trip_id')
        .in('trip_id', tripIds)
        .eq('status', 'accepted');

      const joinedCount: Record<string, number> = {};
      if (joinedRows) {
        joinedRows.forEach((c: any) => {
          joinedCount[c.trip_id] = (joinedCount[c.trip_id] || 0) + 1;
        });
      }

      return rows.map((row: any) => {
        const t = row.trips;
        const hostProf = t.profiles || {};
        const fn = hostProf.first_name || 'Barkada';
        const ln = hostProf.last_name || 'Host';
        const hostName = `${fn} ${ln}`.trim();

        return {
          tripId: t.id,
          tripTitle: t.title,
          destination: cleanInviteField(t.destination, PLACEHOLDER_DESTINATIONS),
          dateRange: cleanInviteField(t.date_range, PLACEHOLDER_DATE_RANGES),
          hostName: hostName,
          inviteCode: t.invite_code || '',
          memberCount: joinedCount[t.id] || 1,
        };
      });
    } catch (err: any) {
      console.warn('fetchPendingTripInvitesDB error:', err?.message);
      return [];
    }
  }

  /**
   * Accept pending trip invitation
   */
  public async acceptTripInviteDB(tripId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_participants')
        .upsert(
          {
            trip_id: tripId,
            user_id: userId,
            role: 'member',
            status: 'accepted',
          },
          { onConflict: 'trip_id,user_id' }
        );

      if (error) {
        console.warn('acceptTripInviteDB error:', error.message);
        return false;
      }

      await this.fetchUserTripsDB(userId);
      this.setActiveTripId(tripId);

      // Notify host that user accepted their trip invitation
      await NotificationService.createTripInviteResponseNotification(userId, tripId, 'accepted');

      return true;
    } catch (err: any) {
      console.warn('acceptTripInviteDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Decline pending trip invitation (deletes participant row so user can be re-invited in future)
   */
  public async declineTripInviteDB(tripId: string, userId: string): Promise<boolean> {
    try {
      // Notify host BEFORE deleting row
      await NotificationService.createTripInviteResponseNotification(userId, tripId, 'declined');

      const { error } = await supabase
        .from('trip_participants')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      if (error) {
        console.warn('declineTripInviteDB error:', error.message);
        return false;
      }
      // Remove left trip from local trips list & switch active trip immediately
      this.trips = this.trips.filter((t) => t.id !== tripId);
      if (this.activeTripId === tripId) {
        this.activeTripId = this.trips.length > 0 ? this.trips[0].id : '';
      }

      await this.fetchUserTripsDB(userId);
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('declineTripInviteDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Remove/kick a participant from a trip in Supabase DB (Host action)
   */
  public async removeParticipantDB(tripId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_participants')
        .delete()
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      if (error) {
        console.warn('removeParticipantDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('removeParticipantDB exception:', err?.message);
      return false;
    }
  }

  // --- TRIP VOTING POLLS (SUPABASE-BACKED) ---

  /**
   * Fetch poll options for a trip from Supabase DB (with live vote counts).
   * RLS ensures only accepted trip members can read them.
   */
  public async fetchTripPollsDB(tripId: string): Promise<DestinationPollOption[]> {
    try {
      const { data, error } = await supabase
        .from('trip_poll_options')
        .select(`
          id,
          trip_id,
          type,
          title,
          subtitle,
          place_id,
          place_name,
          place_address,
          photo_reference,
          created_by,
          created_at,
          trip_poll_votes ( user_id )
        `)
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });

      if (error || !data) {
        console.warn('fetchTripPollsDB error:', error?.message);
        return [];
      }

      const creatorIds = [...new Set(data.map((o: any) => o.created_by))];
      const creatorNames: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, username')
          .in('id', creatorIds);
        (profs || []).forEach((p: any) => {
          creatorNames[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.username || 'Barkada';
        });
      }

      return data.map((row: any) => {
        const votes = row.trip_poll_votes || [];
        return {
          id: row.id,
          tripId: row.trip_id,
          title: row.title,
          type: row.type,
          createdAt: row.created_at || undefined,
          subtitle: row.subtitle || undefined,
          placeId: row.place_id || undefined,
          placeName: row.place_name || undefined,
          placeAddress: row.place_address || undefined,
          photoReference: row.photo_reference || undefined,
          votes: votes.length,
          votedUserIds: votes.map((v: any) => v.user_id),
          createdByUserId: row.created_by,
          createdByName: creatorNames[row.created_by] || 'Barkada',
        };
      });
    } catch (err: any) {
      console.warn('fetchTripPollsDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Add a poll option to Supabase DB and auto-cast the creator's vote.
   * RLS restricts to accepted trip members.
   */
  public async addTripPollOptionDB(params: {
    tripId: string;
    title: string;
    type: 'place' | 'date';
    subtitle?: string;
    placeId?: string;
    placeName?: string;
    placeAddress?: string;
    photoReference?: string;
    userId: string;
  }): Promise<DestinationPollOption | null> {
    try {
      const { data, error } = await supabase
        .from('trip_poll_options')
        .insert({
          trip_id: params.tripId,
          type: params.type,
          title: params.title.trim(),
          subtitle: params.subtitle?.trim() || null,
          place_id: params.placeId || null,
          place_name: params.placeName || null,
          place_address: params.placeAddress || null,
          photo_reference: params.photoReference || null,
          created_by: params.userId,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.warn('addTripPollOptionDB error:', error?.message);
        return null;
      }

      // Creator auto-votes for their proposal (single-vote trigger moves any prior vote)
      // App-side: drop any prior vote the creator had in the SAME section first,
      // so a place vote never steals a date vote (and vice versa).
      const { data: sameTypeOptions } = await supabase
        .from('trip_poll_options')
        .select('id')
        .eq('trip_id', params.tripId)
        .eq('type', params.type);
      const sameTypeIds = (sameTypeOptions || []).map((o: any) => o.id);
      if (sameTypeIds.length > 0) {
        await supabase
          .from('trip_poll_votes')
          .delete()
          .in('option_id', sameTypeIds)
          .eq('user_id', params.userId);
      }
      await supabase.from('trip_poll_votes').insert({ option_id: data.id, user_id: params.userId });

      const list = await this.fetchTripPollsDB(params.tripId);
      return list.find((o) => o.id === data.id) || null;
    } catch (err: any) {
      console.warn('addTripPollOptionDB exception:', err?.message);
      return null;
    }
  }

  /**
   * Toggle the current user's vote on a poll option.
   * One vote PER SECTION: voting for a date never removes your place vote
   * (and vice versa). Picking a different option in the same section moves
   * your vote there.
   */
  public async toggleVoteTripPollDB(pollId: string, tripId: string, userId: string): Promise<DestinationPollOption[]> {
    try {
      const { data: opt } = await supabase
        .from('trip_poll_options')
        .select('type')
        .eq('id', pollId)
        .maybeSingle();
      const type = opt?.type as 'place' | 'date' | undefined;

      const { data: existing } = await supabase
        .from('trip_poll_votes')
        .select('id')
        .eq('option_id', pollId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        // Unvote the option they already voted for
        await supabase.from('trip_poll_votes').delete().eq('option_id', pollId).eq('user_id', userId);
      } else {
        // Vote on a different option in this section → drop their prior same-section vote first
        if (type) {
          const { data: sameTypeOptions } = await supabase
            .from('trip_poll_options')
            .select('id')
            .eq('trip_id', tripId)
            .eq('type', type);
          const sameTypeIds = (sameTypeOptions || []).map((o: any) => o.id);
          if (sameTypeIds.length > 0) {
            await supabase
              .from('trip_poll_votes')
              .delete()
              .in('option_id', sameTypeIds)
              .eq('user_id', userId);
          }
        }
        await supabase.from('trip_poll_votes').insert({ option_id: pollId, user_id: userId });
      }
      return this.fetchTripPollsDB(tripId);
    } catch (err: any) {
      console.warn('toggleVoteTripPollDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Update a poll option's title/subtitle (creator only, enforced by RLS).
   */
  public async updateTripPollOptionDB(params: {
    pollId: string;
    tripId: string;
    newTitle: string;
    newSubtitle?: string;
    placeId?: string;
    placeName?: string;
    placeAddress?: string;
    photoReference?: string;
  }): Promise<DestinationPollOption[]> {
    try {
      await supabase
        .from('trip_poll_options')
        .update({
          title: params.newTitle.trim(),
          subtitle: params.newSubtitle?.trim() || null,
          place_id: params.placeId || null,
          place_name: params.placeName || null,
          place_address: params.placeAddress || null,
          photo_reference: params.photoReference || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.pollId);
      return this.fetchTripPollsDB(params.tripId);
    } catch (err: any) {
      console.warn('updateTripPollOptionDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Delete a poll option (creator only, enforced by RLS). Cascades votes.
   */
  public async deleteTripPollOptionDB(pollId: string, tripId: string): Promise<DestinationPollOption[]> {
    try {
      await supabase.from('trip_poll_options').delete().eq('id', pollId);
      return this.fetchTripPollsDB(tripId);
    } catch (err: any) {
      console.warn('deleteTripPollOptionDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Fetch the itinerary items for a trip (optionally for one day) from Supabase,
   * with like/dislike reactions and creator/editor names attached.
   */
  public async fetchTripItineraryDB(tripId: string, dayNumber?: number): Promise<ItineraryItem[]> {
    try {
      let query = supabase
        .from('trip_itinerary_items')
        .select(`
          id,
          trip_id,
          day_number,
          title,
          time,
          tag,
          location,
          est_cost,
          note,
          is_completed,
          place_id,
          place_name,
          place_address,
          photo_reference,
          created_by,
          created_at,
          updated_at,
          updated_by,
          creator_profile:created_by ( first_name, last_name ),
          editor_profile:updated_by ( first_name, last_name ),
          reactions:trip_itinerary_reactions (
            id,
            user_id,
            reaction,
            user_profile:user_id ( first_name, last_name )
          )
        `)
        .eq('trip_id', tripId);
      if (dayNumber) query = query.eq('day_number', dayNumber);
      const { data, error } = await query.order('time', { ascending: true });

      if (error || !data) {
        console.warn('fetchTripItineraryDB error:', error?.message);
        return [];
      }

      const me = (await supabase.auth.getUser()).data?.user?.id;

      const items: ItineraryItem[] = data.map((row: any) => {
        const reactions: ItineraryReaction[] = (row.reactions || []).map((r: any) => {
          const prof = r.user_profile || {};
          const fn = prof.first_name || '';
          const ln = prof.last_name || '';
          return {
            id: r.id,
            itemId: row.id,
            userId: r.user_id,
            reaction: r.reaction,
            userFirstName: fn,
            userLastName: ln,
            userInitials: `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'U',
          };
        });
        const likeCount = reactions.filter((r) => r.reaction === 'like').length;
        const dislikeCount = reactions.filter((r) => r.reaction === 'dislike').length;
        const mine = reactions.find((r) => r.userId === me)?.reaction || null;

        const creator = row.creator_profile || {};
        const editor = row.editor_profile || {};

        return {
          id: row.id,
          time: row.time || '',
          title: row.title,
          category: row.tag || 'ACTIVITY',
          location: row.place_name || row.location || row.place_address || '',
          estCost: row.est_cost || '',
          note: row.note || undefined,
          isCompleted: !!row.is_completed,
          dayNumber: row.day_number,
          tag: row.tag,
          placeId: row.place_id || undefined,
          placeName: row.place_name || undefined,
          placeAddress: row.place_address || undefined,
          photoReference: row.photo_reference || undefined,
          createdBy: row.created_by,
          createdByName: `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Barkada',
          createdAt: row.created_at || undefined,
          updatedAt: row.updated_at || undefined,
          updatedByName: editor.first_name
            ? `${editor.first_name} ${editor.last_name || ''}`.trim()
            : undefined,
          reactions,
          likeCount,
          dislikeCount,
          myReaction: mine as 'like' | 'dislike' | null,
        };
      });

      return sortItineraryChronological(items);
    } catch (err: any) {
      console.warn('fetchTripItineraryDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Add an itinerary item to a trip (creator auto-set). Fans out "New
   * Itinerary Spot" notifications to the other members.
   */
  public async addItineraryItemDB(params: {
    tripId: string;
    dayNumber: number;
    title: string;
    time?: string;
    tag?: ItineraryTag;
    location?: string;
    estCost?: string;
    note?: string;
    placeId?: string;
    placeName?: string;
    placeAddress?: string;
    photoReference?: string;
    userId: string;
  }): Promise<ItineraryItem | null> {
    try {
      const { data, error } = await supabase
        .from('trip_itinerary_items')
        .insert({
          trip_id: params.tripId,
          day_number: params.dayNumber,
          title: params.title.trim(),
          time: params.time?.trim() || null,
          tag: params.tag || 'ACTIVITY',
          location: params.location?.trim() || null,
          est_cost: params.estCost?.trim() || null,
          note: params.note?.trim() || null,
          place_id: params.placeId || null,
          place_name: params.placeName || null,
          place_address: params.placeAddress || null,
          photo_reference: params.photoReference || null,
          created_by: params.userId,
          updated_by: params.userId,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.warn('addItineraryItemDB error:', error?.message);
        return null;
      }

      // Notify the other members
      let actorName = 'Someone';
      if (params.userId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', params.userId)
          .maybeSingle();
        if (prof?.first_name) actorName = `${prof.first_name} ${prof.last_name || ''}`.trim();
      }
      let tripTitle = 'Barkada Trip';
      if (params.tripId) {
        const { data: tripRow } = await supabase
          .from('trips')
          .select('title')
          .eq('id', params.tripId)
          .maybeSingle();
        if (tripRow?.title) tripTitle = tripRow.title;
      }
      const notified = await NotificationService.createItineraryAddedNotification(
        params.userId,
        params.tripId,
        actorName,
        params.title.trim(),
        data.id,
        tripTitle
      );
      if (!notified) console.warn('addItineraryItemDB: itinerary-added notification not sent');

      const list = await this.fetchTripItineraryDB(params.tripId, params.dayNumber);
      return list.find((i) => i.id === data.id) || null;
    } catch (err: any) {
      console.warn('addItineraryItemDB exception:', err?.message);
      return null;
    }
  }

  /**
   * Edit an itinerary item (creator only, enforced by RLS).
   */
  public async updateItineraryItemDB(
    itemId: string,
    params: {
      title: string;
      time?: string;
      tag?: ItineraryTag;
      location?: string;
      estCost?: string;
      note?: string;
      placeId?: string;
      placeName?: string;
      placeAddress?: string;
      photoReference?: string;
    },
    userId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_itinerary_items')
        .update({
          title: params.title.trim(),
          time: params.time?.trim() || null,
          tag: params.tag || 'ACTIVITY',
          location: params.location?.trim() || null,
          est_cost: params.estCost?.trim() || null,
          note: params.note?.trim() || null,
          place_id: params.placeId || null,
          place_name: params.placeName || null,
          place_address: params.placeAddress || null,
          photo_reference: params.photoReference || null,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq('id', itemId);

      if (error) {
        console.warn('updateItineraryItemDB error:', error?.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('updateItineraryItemDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Toggle completion status of an itinerary item (done / strikethrough).
   */
  public async toggleItineraryCompletedDB(itemId: string, isCompleted: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_itinerary_items')
        .update({
          is_completed: isCompleted,
          updated_at: new Date().toISOString(),
        })
        .eq('id', itemId);

      if (error) {
        console.warn('toggleItineraryCompletedDB error:', error?.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('toggleItineraryCompletedDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Delete an itinerary item (creator only, enforced by RLS).
   */
  public async deleteItineraryItemDB(itemId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('trip_itinerary_items').delete().eq('id', itemId);
      if (error) {
        console.warn('deleteItineraryItemDB error:', error?.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('deleteItineraryItemDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Toggle a member's like / dislike on an itinerary item and notify the item
   * creator on the first time they react to it.
   */
  public async toggleItineraryReactionDB(
    itemId: string,
    tripId: string,
    userId: string,
    reaction: 'like' | 'dislike'
  ): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('trip_itinerary_reactions')
        .select('id, reaction')
        .eq('item_id', itemId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        if (existing.reaction === reaction) {
          // Same reaction tapped again → remove it
          await supabase.from('trip_itinerary_reactions').delete().eq('id', existing.id);
        } else {
          // Switch like <-> dislike
          await supabase
            .from('trip_itinerary_reactions')
            .update({ reaction, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
        return true;
      }

      await supabase.from('trip_itinerary_reactions').insert({ item_id: itemId, user_id: userId, reaction });

      // Notify the item creator (only on the first reaction to this item)
      const { data: item } = await supabase
        .from('trip_itinerary_items')
        .select('created_by, title')
        .eq('id', itemId)
        .maybeSingle();
      if (item && item.created_by !== userId) {
        let actorName = 'Someone';
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        if (prof?.first_name) actorName = `${prof.first_name} ${prof.last_name || ''}`.trim();
        let tripTitle = 'Barkada Trip';
        const { data: tripRow } = await supabase
          .from('trips')
          .select('title')
          .eq('id', tripId)
          .maybeSingle();
        if (tripRow?.title) tripTitle = tripRow.title;
        const notified = await NotificationService.createItineraryReactionNotification(
          userId,
          item.created_by,
          actorName,
          item.title,
          itemId,
          tripId,
          tripTitle,
          reaction
        );
        if (!notified) console.warn('toggleItineraryReactionDB: itinerary-reaction notification not sent');
      }
      return true;
    } catch (err: any) {
      console.warn('toggleItineraryReactionDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Fetch all stays ("where you'll stay") for a trip, with like/dislike
   * reactions, member comments, and the host's name attached. RLS ensures
   * only accepted members can read them.
   */
  public async fetchTripStaysDB(tripId: string): Promise<TripStay[]> {
    try {
      const { data, error } = await supabase
        .from('trip_stays')
        .select(`
          id,
          trip_id,
          title,
          start_day,
          end_day,
          place_id,
          place_name,
          place_address,
          photo_reference,
          link,
          note,
          created_by,
          created_at,
          updated_at,
          creator_profile:created_by ( first_name, last_name ),
          reactions:trip_stay_reactions (
            id,
            user_id,
            reaction,
            user_profile:user_id ( first_name, last_name )
          ),
          comments:trip_stay_comments (
            id,
            user_id,
            comment,
            created_at,
            user_profile:user_id ( first_name, last_name )
          )
        `)
        .eq('trip_id', tripId)
        .order('start_day', { ascending: true })
        .order('created_at', { ascending: true });

      if (error || !data) {
        console.warn('fetchTripStaysDB error:', error?.message);
        return [];
      }

      const me = (await supabase.auth.getUser()).data?.user?.id;

      return data.map((row: any) => {
        const reactions: TripStayReaction[] = (row.reactions || []).map((r: any) => {
          const prof = r.user_profile || {};
          const fn = prof.first_name || '';
          const ln = prof.last_name || '';
          return {
            id: r.id,
            stayId: row.id,
            userId: r.user_id,
            reaction: r.reaction,
            userFirstName: fn,
            userLastName: ln,
            userInitials: `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'U',
          };
        });
        const likeCount = reactions.filter((r) => r.reaction === 'like').length;
        const dislikeCount = reactions.filter((r) => r.reaction === 'dislike').length;
        const mine = reactions.find((r) => r.userId === me)?.reaction || null;

        const creator = row.creator_profile || {};
        const comments: TripStayComment[] = (row.comments || []).map((c: any) => {
          const prof = c.user_profile || {};
          const fn = prof.first_name || '';
          const ln = prof.last_name || '';
          return {
            id: c.id,
            stayId: row.id,
            userId: c.user_id,
            comment: c.comment,
            createdAt: c.created_at || undefined,
            userFirstName: fn,
            userLastName: ln,
            userInitials: `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'U',
          };
        });

        return {
          id: row.id,
          tripId: row.trip_id,
          title: row.title,
          startDay: row.start_day || 1,
          endDay: row.end_day || 1,
          placeId: row.place_id || undefined,
          placeName: row.place_name || undefined,
          placeAddress: row.place_address || undefined,
          photoReference: row.photo_reference || undefined,
          link: row.link || undefined,
          note: row.note || undefined,
          createdBy: row.created_by,
          createdByName: `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Barkada',
          createdAt: row.created_at || undefined,
          updatedAt: row.updated_at || undefined,
          reactions,
          likeCount,
          dislikeCount,
          myReaction: mine as 'like' | 'dislike' | null,
          comments,
          commentCount: comments.length,
        };
      });
    } catch (err: any) {
      console.warn('fetchTripStaysDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Add a stay to a trip. Host-only (enforced by RLS) and only allowed once
   * the tour is locked (planning_stage READY / ITINERARY_BUILDING). Fans out
   * "New Stay Added" notifications to the other members.
   */
  public async addTripStayDB(params: {
    tripId: string;
    title: string;
    startDay: number;
    endDay: number;
    placeId?: string;
    placeName?: string;
    placeAddress?: string;
    photoReference?: string;
    link?: string;
    note?: string;
    userId: string;
  }): Promise<TripStay | null> {
    try {
      const startDay = Math.max(1, params.startDay);
      const endDay = Math.max(startDay, params.endDay);

      const { data, error } = await supabase
        .from('trip_stays')
        .insert({
          trip_id: params.tripId,
          title: params.title.trim(),
          start_day: startDay,
          end_day: endDay,
          place_id: params.placeId || null,
          place_name: params.placeName || null,
          place_address: params.placeAddress || null,
          photo_reference: params.photoReference || null,
          link: params.link?.trim() || null,
          note: params.note?.trim() || null,
          created_by: params.userId,
        })
        .select('id')
        .single();

      if (error || !data) {
        console.warn('addTripStayDB error:', error?.message);
        return null;
      }

      // Notify the other members
      let actorName = 'Your host';
      if (params.userId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', params.userId)
          .maybeSingle();
        if (prof?.first_name) actorName = `${prof.first_name} ${prof.last_name || ''}`.trim();
      }
      let tripTitle = 'Barkada Trip';
      if (params.tripId) {
        const { data: tripRow } = await supabase
          .from('trips')
          .select('title')
          .eq('id', params.tripId)
          .maybeSingle();
        if (tripRow?.title) tripTitle = tripRow.title;
      }
      const notified = await NotificationService.createStayAddedNotification(
        params.userId,
        params.tripId,
        actorName,
        params.title.trim(),
        data.id,
        tripTitle
      );
      if (!notified) console.warn('addTripStayDB: stay-added notification not sent');

      const list = await this.fetchTripStaysDB(params.tripId);
      return list.find((s) => s.id === data.id) || null;
    } catch (err: any) {
      console.warn('addTripStayDB exception:', err?.message);
      return null;
    }
  }

  /**
   * Edit a stay (host only, enforced by RLS).
   */
  public async updateTripStayDB(
    stayId: string,
    params: Partial<{
      title: string;
      startDay: number;
      endDay: number;
      placeId?: string;
      placeName?: string;
      placeAddress?: string;
      photoReference?: string;
      link?: string;
      note?: string;
    }>
  ): Promise<boolean> {
    try {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (params.title !== undefined) updatePayload.title = params.title.trim();
      if (params.startDay !== undefined) updatePayload.start_day = Math.max(1, params.startDay);
      if (params.endDay !== undefined) updatePayload.end_day = Math.max(1, params.endDay);
      if (params.placeId !== undefined) updatePayload.place_id = params.placeId || null;
      if (params.placeName !== undefined) updatePayload.place_name = params.placeName || null;
      if (params.placeAddress !== undefined) updatePayload.place_address = params.placeAddress || null;
      if (params.photoReference !== undefined) updatePayload.photo_reference = params.photoReference || null;
      if (params.link !== undefined) updatePayload.link = params.link?.trim() || null;
      if (params.note !== undefined) updatePayload.note = params.note?.trim() || null;

      const { error } = await supabase
        .from('trip_stays')
        .update(updatePayload)
        .eq('id', stayId);

      if (error) {
        console.warn('updateTripStayDB error:', error?.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('updateTripStayDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Delete a stay (host only, enforced by RLS). Cascades reactions/comments.
   */
  public async deleteTripStayDB(stayId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('trip_stays').delete().eq('id', stayId);
      if (error) {
        console.warn('deleteTripStayDB error:', error?.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('deleteTripStayDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Toggle a member's like / dislike on a stay and notify the host on their
   * first reaction to it.
   */
  public async toggleTripStayReactionDB(
    stayId: string,
    tripId: string,
    userId: string,
    reaction: 'like' | 'dislike'
  ): Promise<boolean> {
    try {
      const { data: existing } = await supabase
        .from('trip_stay_reactions')
        .select('id, reaction')
        .eq('stay_id', stayId)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        if (existing.reaction === reaction) {
          // Same reaction tapped again → remove it
          await supabase.from('trip_stay_reactions').delete().eq('id', existing.id);
        } else {
          // Switch like <-> dislike
          await supabase
            .from('trip_stay_reactions')
            .update({ reaction, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        }
        return true;
      }

      await supabase.from('trip_stay_reactions').insert({ stay_id: stayId, user_id: userId, reaction });

      // Notify the other trip members on a reaction to this stay
      const { data: stay } = await supabase
        .from('trip_stays')
        .select('created_by, title')
        .eq('id', stayId)
        .maybeSingle();
      if (stay) {
        let actorName = 'Someone';
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        if (prof?.first_name) actorName = `${prof.first_name} ${prof.last_name || ''}`.trim();
        let tripTitle = 'Barkada Trip';
        const { data: tripRow } = await supabase
          .from('trips')
          .select('title')
          .eq('id', tripId)
          .maybeSingle();
        if (tripRow?.title) tripTitle = tripRow.title;
        const notified = await NotificationService.createStayReactionNotification(
          userId,
          tripId,
          actorName,
          stay.title,
          stayId,
          tripTitle,
          reaction
        );
        if (!notified) console.warn('toggleTripStayReactionDB: stay-reaction notification not sent');
      }
      return true;
    } catch (err: any) {
      console.warn('toggleTripStayReactionDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Add a member comment to a stay and notify the host.
   */
  public async addTripStayCommentDB(
    stayId: string,
    tripId: string,
    userId: string,
    comment: string
  ): Promise<boolean> {
    const text = comment.trim();
    if (!text) return false;
    try {
      const { data, error } = await supabase
        .from('trip_stay_comments')
        .insert({ stay_id: stayId, user_id: userId, comment: text })
        .select('id')
        .single();

      if (error || !data) {
        console.warn('addTripStayCommentDB error:', error?.message);
        return false;
      }

      const { data: stay } = await supabase
        .from('trip_stays')
        .select('created_by, title')
        .eq('id', stayId)
        .maybeSingle();
      if (stay) {
        let actorName = 'Someone';
        const { data: prof } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        if (prof?.first_name) actorName = `${prof.first_name} ${prof.last_name || ''}`.trim();
        let tripTitle = 'Barkada Trip';
        const { data: tripRow } = await supabase
          .from('trips')
          .select('title')
          .eq('id', tripId)
          .maybeSingle();
        if (tripRow?.title) tripTitle = tripRow.title;
        const notified = await NotificationService.createStayCommentNotification(
          userId,
          tripId,
          actorName,
          stay.title,
          text,
          stayId,
          tripTitle
        );
        if (!notified) console.warn('addTripStayCommentDB: stay-comment notification not sent');
      }
      return true;
    } catch (err: any) {
      console.warn('addTripStayCommentDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Delete a stay comment (author only, enforced by RLS).
   */
  public async deleteTripStayCommentDB(commentId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('trip_stay_comments').delete().eq('id', commentId);
      if (error) {
        console.warn('deleteTripStayCommentDB error:', error?.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('deleteTripStayCommentDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Fetch host + voting deadline for a trip (used to show host-only UI).
   */
  public async fetchTripSettingsDB(tripId: string): Promise<{ hostId: string | null; votingDeadline: string | null; planningStage: string | null }> {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('host_id, voting_deadline, planning_stage')
        .eq('id', tripId)
        .maybeSingle();

      if (error || !data) return { hostId: null, votingDeadline: null, planningStage: null };
      return {
        hostId: data.host_id || null,
        votingDeadline: data.voting_deadline || null,
        planningStage: data.planning_stage || null,
      };
    } catch (err: any) {
      console.warn('fetchTripSettingsDB exception:', err?.message);
      return { hostId: null, votingDeadline: null, planningStage: null };
    }
  }

  /**
   * Set or clear the host-only voting deadline on a trip.
   * Also updates the local in-memory cache so the UI reflects immediately.
   */
  public async setTripVotingDeadlineDB(tripId: string, deadline: string | null): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trips')
        .update({ voting_deadline: deadline, updated_at: new Date().toISOString() })
        .eq('id', tripId);

      if (error) {
        console.warn('setTripVotingDeadlineDB error:', error.message);
        return false;
      }

      // Update local cache so deadlinePassed state reflects immediately
      this.trips = this.trips.map((t) =>
        t.id === tripId ? { ...t, votingDeadline: deadline } : t
      );
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('setTripVotingDeadlineDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Finalizes an ended poll by extracting the winning destination (place poll)
   * and date range (date poll) from the poll options and uploading them to
   * Supabase trips table. Sets planning_stage to 'READY' and updates local cache.
   * Can be called when the host locks the trip or automatically when the voting deadline expires.
   *
   * Only finalizes if there is at least one poll option with at least one vote.
   * If no votes exist, still marks as READY but keeps placeholder destination/date.
   */
  public async finalizeEndedPollDB(
    tripId: string
  ): Promise<{ success: boolean; destination?: string; dateRange?: string; message?: string }> {
    try {
      // Fetch current trip data from DB to get the freshest state
      const { data: tripRow, error: tripFetchErr } = await supabase
        .from('trips')
        .select('destination, date_range, planning_stage, voting_deadline')
        .eq('id', tripId)
        .maybeSingle();

      if (tripFetchErr) {
        console.warn('finalizeEndedPollDB trip fetch error:', tripFetchErr.message);
      }

      // Already finalized — don't run again
      if (tripRow?.planning_stage === 'READY' || tripRow?.planning_stage === 'ITINERARY_BUILDING') {
        const existingDest = tripRow.destination || 'Destination Locked';
        const existingDate = tripRow.date_range || 'Dates TBD';
        return { success: true, destination: existingDest, dateRange: existingDate };
      }

      // Fetch all poll options + votes for this trip
      const { data: pollRows, error: pollErr } = await supabase
        .from('trip_poll_options')
        .select('id, type, title, created_at, trip_poll_votes ( user_id )')
        .eq('trip_id', tripId);

      if (pollErr) {
        console.warn('finalizeEndedPollDB poll fetch error:', pollErr.message);
      }

      const options = (pollRows || []) as Array<{
        id: string;
        type: string;
        title: string;
        created_at: string;
        trip_poll_votes: Array<{ user_id: string }>;
      }>;

      const pickWinner = (list: typeof options) => {
        if (!list || list.length === 0) return null;
        const withVotes = list.filter((o) => o.trip_poll_votes.length > 0);
        if (withVotes.length === 0) return null; // no votes at all
        return withVotes.slice().sort((a, b) => {
          if (b.trip_poll_votes.length !== a.trip_poll_votes.length)
            return b.trip_poll_votes.length - a.trip_poll_votes.length;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        })[0];
      };

      const placePoll = options.filter((o) => (o.type || '').toLowerCase().trim() === 'place');
      const datePoll = options.filter((o) => (o.type || '').toLowerCase().trim() === 'date');

      const placeWinner = pickWinner(placePoll);
      const dateWinner = pickWinner(datePoll);

      // Build the update payload — always set planning_stage to READY
      const updatePayload: Record<string, any> = {
        planning_stage: 'READY',
        updated_at: new Date().toISOString(),
      };

      const winningDestination = placeWinner?.title?.trim() || null;
      const winningDateRange = dateWinner?.title?.trim() || null;

      if (winningDestination) {
        updatePayload.destination = winningDestination;
      }
      if (winningDateRange) {
        updatePayload.date_range = winningDateRange;
      }

      const { error: updateErr } = await supabase
        .from('trips')
        .update(updatePayload)
        .eq('id', tripId);

      if (updateErr) {
        console.warn('finalizeEndedPollDB update error:', updateErr.message);
        return { success: false, message: updateErr.message };
      }

      // Resolve the final values for local cache update
      const existingTrip = this.trips.find((t) => t.id === tripId);
      const finalDestination = winningDestination || (tripRow?.destination && !/^(Voting in Progress|Planning Stage|Destination Voting)$/i.test(tripRow.destination) ? tripRow.destination : existingTrip?.destination || 'Destination Locked');
      const finalDateRange = winningDateRange || (tripRow?.date_range && !/^(Dates TBD|TBD|Upcoming|Planning Phase|Planning Stage)$/i.test(tripRow.date_range) ? tripRow.date_range : existingTrip?.dateRange || 'Dates TBD');

      this.trips = this.trips.map((t) =>
        t.id === tripId
          ? {
              ...t,
              destination: finalDestination,
              dateRange: finalDateRange,
              planningStage: 'READY' as Trip['planningStage'],
            }
          : t
      );

      this.notify();
      return { success: true, destination: finalDestination, dateRange: finalDateRange };
    } catch (err: any) {
      console.warn('finalizeEndedPollDB exception:', err?.message);
      return { success: false, message: err?.message };
    }
  }

  /**
   * Host-only: lock the tour by finalizing the winning destination (place poll)
   * and date range (date poll). Winners = most votes, ties broken by earliest
   * proposal. Sets planning_stage to 'READY' and persists destination/date_range.
   * Returns true on success.
   */
  public async lockTripDB(tripId: string, userId?: string): Promise<{ success: boolean; message?: string }> {
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }
      if (!effectiveUserId) return { success: false, message: 'Not signed in.' };

      const settings = await this.fetchTripSettingsDB(tripId);
      if (!settings.hostId || settings.hostId !== effectiveUserId) {
        return { success: false, message: 'Only the trip host can lock the tour.' };
      }

      const res = await this.finalizeEndedPollDB(tripId);
      return { success: res.success, message: res.message };
    } catch (err: any) {
      console.warn('lockTripDB exception:', err?.message);
      return { success: false, message: err?.message };
    }
  }

  /**
   * Host-only: reactivate the tour's voting (planning_stage back to
   * DESTINATION_VOTING) and set a new mandatory voting deadline.
   */
  public async reactivateTripVotingDB(
    tripId: string,
    deadline: string,
    userId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }
      if (!effectiveUserId) return { success: false, message: 'Not signed in.' };

      const settings = await this.fetchTripSettingsDB(tripId);
      if (!settings.hostId || settings.hostId !== effectiveUserId) {
        return { success: false, message: 'Only the trip host can edit the tour.' };
      }

      const { error } = await supabase
        .from('trips')
        .update({
          planning_stage: 'DESTINATION_VOTING',
          voting_deadline: deadline,
          // Reset destination and date_range to placeholders so old winning
          // values don't leak through while voting is still in progress.
          destination: 'Voting in Progress',
          date_range: 'Dates TBD',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (error) {
        console.warn('reactivateTripVotingDB error:', error.message);
        return { success: false, message: error.message };
      }

      this.trips = this.trips.map((t) =>
        t.id === tripId
          ? {
              ...t,
              planningStage: 'DESTINATION_VOTING' as Trip['planningStage'],
              destination: 'Voting in Progress',
              dateRange: 'Dates TBD',
              votingDeadline: deadline,
            }
          : t
      );

      this.notify();
      return { success: true };
    } catch (err: any) {
      console.warn('reactivateTripVotingDB exception:', err?.message);
      return { success: false, message: err?.message };
    }
  }

  /**
   * Host-only: Mark a trip as Completed.
   * Can be triggered at the end of the trip or early in emergencies/plan changes.
   */
  public async completeTripDB(
    tripId: string,
    userId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }
      if (!effectiveUserId) return { success: false, message: 'Not signed in.' };

      const settings = await this.fetchTripSettingsDB(tripId);
      if (!settings.hostId || settings.hostId !== effectiveUserId) {
        return { success: false, message: 'Only the trip host can complete the trip.' };
      }

      const { error } = await supabase
        .from('trips')
        .update({
          status: 'Completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (error) {
        console.warn('completeTripDB error:', error.message);
        return { success: false, message: error.message };
      }

      // Update local cache
      this.reopenedTripIds.delete(tripId);
      this.trips = this.trips.map((t) =>
        t.id === tripId ? { ...t, status: 'Completed' as Trip['status'] } : t
      );

      // Notify other participants
      const tripObj = this.trips.find((t) => t.id === tripId);
      const tripTitle = tripObj?.title || 'Your Barkada trip';
      try {
        const { data: participants } = await supabase
          .from('trip_participants')
          .select('user_id')
          .eq('trip_id', tripId)
          .neq('user_id', effectiveUserId);

        if (participants && participants.length > 0) {
          const notifications = participants.map((p) => ({
            user_id: p.user_id,
            actor_id: effectiveUserId,
            type: 'system',
            title: 'Trip Completed',
            message: `"${tripTitle}" has been marked as completed by the host.`,
            is_read: false,
            trip_id: tripId,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifErr) {
        console.warn('completeTripDB notification notice:', notifErr);
      }

      this.notify();
      return { success: true };
    } catch (err: any) {
      console.warn('completeTripDB exception:', err?.message);
      return { success: false, message: err?.message };
    }
  }

  /**
   * Host-only: Reopen a completed trip (Undo Complete) back to Active.
   */
  public async reopenTripDB(
    tripId: string,
    userId?: string
  ): Promise<{ success: boolean; message?: string }> {
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }
      if (!effectiveUserId) return { success: false, message: 'Not signed in.' };

      const settings = await this.fetchTripSettingsDB(tripId);
      if (!settings.hostId || settings.hostId !== effectiveUserId) {
        return { success: false, message: 'Only the trip host can reopen the trip.' };
      }

      const tripTarget = this.trips.find((t) => t.id === tripId);
      if (tripTarget) {
        const dayInfo = getTripDayInfo(tripTarget.dateRange);
        if (dayInfo?.isEnded) {
          return { success: false, message: 'Cannot reopen a trip whose registered dates have already passed.' };
        }
      }

      const { error } = await supabase
        .from('trips')
        .update({
          status: 'Active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      if (error) {
        console.warn('reopenTripDB error:', error.message);
        return { success: false, message: error.message };
      }

      // Update local cache
      this.reopenedTripIds.add(tripId);
      this.trips = this.trips.map((t) =>
        t.id === tripId ? { ...t, status: 'Active' as Trip['status'] } : t
      );

      // Notify other participants
      const tripObj = this.trips.find((t) => t.id === tripId);
      const tripTitle = tripObj?.title || 'Your Barkada trip';
      try {
        const { data: participants } = await supabase
          .from('trip_participants')
          .select('user_id')
          .eq('trip_id', tripId)
          .neq('user_id', effectiveUserId);

        if (participants && participants.length > 0) {
          const notifications = participants.map((p) => ({
            user_id: p.user_id,
            actor_id: effectiveUserId,
            type: 'system',
            title: 'Trip Reopened',
            message: `"${tripTitle}" has been reopened by the host.`,
            is_read: false,
            trip_id: tripId,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      } catch (notifErr) {
        console.warn('reopenTripDB notification notice:', notifErr);
      }

      this.notify();
      return { success: true };
    } catch (err: any) {
      console.warn('reopenTripDB exception:', err?.message);
      return { success: false, message: err?.message };
    }
  }

  /**
   * Delete a trip permanently (host only, enforced by RLS).
   * Removes participants, then the trip (poll options/votes cascade).
   * Returns true on success and removes it from local state.
   */
  public async deleteTripDB(tripId: string, userId?: string): Promise<boolean> {
    try {
      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }
      if (!effectiveUserId) return false;

      const { data: trip } = await supabase
        .from('trips')
        .select('host_id')
        .eq('id', tripId)
        .maybeSingle();

      if (!trip || trip.host_id !== effectiveUserId) {
        console.warn('deleteTripDB denied: only the host can delete this trip');
        return false;
      }

      // Remove participants first (FK-safe), polls/votes cascade from trips
      await supabase.from('trip_participants').delete().eq('trip_id', tripId);
      const { error: delErr } = await supabase.from('trips').delete().eq('id', tripId);

      if (delErr) {
        console.warn('deleteTripDB error:', delErr.message);
        return false;
      }

      this.trips = this.trips.filter((t) => t.id !== tripId);
      if (this.activeTripId === tripId) {
        this.activeTripId = this.trips.length > 0 ? this.trips[0].id : '';
      }
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('deleteTripDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Rename a trip (host only, enforced by RLS). Updates local state on success.
   */
  public async renameTripDB(tripId: string, newTitle: string, userId?: string): Promise<boolean> {
    try {
      const title = newTitle.trim();
      if (!title) return false;

      let effectiveUserId = userId;
      if (!effectiveUserId) {
        const { data: authData } = await supabase.auth.getUser();
        effectiveUserId = authData?.user?.id;
      }
      if (!effectiveUserId) return false;

      const { data: trip } = await supabase
        .from('trips')
        .select('host_id')
        .eq('id', tripId)
        .maybeSingle();
      if (!trip || trip.host_id !== effectiveUserId) return false;

      const { error } = await supabase
        .from('trips')
        .update({ title, updated_at: new Date().toISOString() })
        .eq('id', tripId);

      if (error) {
        console.warn('renameTripDB error:', error.message);
        return false;
      }

      this.trips = this.trips.map((t) => (t.id === tripId ? { ...t, title } : t));
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('renameTripDB exception:', err?.message);
      return false;
    }
  }

  private realtimeChannel: any = null;

  /**
   * Subscribe to Supabase Realtime changes for trips and trip_participants.
   * Automatically updates local state whenever rows are inserted, updated, or deleted in Supabase DB!
   */
  public subscribeRealtime(userId: string) {
    if (!userId) return () => {};

    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = supabase
      .channel(`realtime:trips:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trips' },
        () => {
          this.fetchUserTripsDB(userId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_participants' },
        () => {
          this.fetchUserTripsDB(userId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_poll_options' },
        () => {
          this.fetchUserTripsDB(userId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_poll_votes' },
        () => {
          this.fetchUserTripsDB(userId);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_itinerary_items' },
        () => {
          this.notify();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_itinerary_reactions' },
        () => {
          this.notify();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stays' },
        () => {
          this.notify();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stay_reactions' },
        () => {
          this.notify();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stay_comments' },
        () => {
          this.notify();
        }
      )
      .subscribe();

    return () => {
      if (this.realtimeChannel) {
        supabase.removeChannel(this.realtimeChannel);
        this.realtimeChannel = null;
      }
    };
  }

  /**
   * Fetch trip participants for a given trip from Supabase DB
   */
  public async fetchTripParticipantsDB(tripId: string): Promise<Array<{
    id: string;
    name: string;
    handle: string;
    initials: string;
    avatarBg: string;
    avatarUrl?: string;
    role: 'host' | 'member';
    status: 'accepted' | 'pending';
  }>> {
    try {
      const { data, error } = await supabase
        .from('trip_participants')
        .select(`
          user_id,
          role,
          status,
          joined_at,
          profiles:user_id (
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .eq('trip_id', tripId);

      if (error || !data || data.length === 0) {
        return [];
      }

      const AVATAR_BG_COLORS = ['#0171F8', '#4F86C6', '#E11D48', '#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'];
      const getBg = (id: string) => {
        let sum = 0;
        for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
        return AVATAR_BG_COLORS[sum % AVATAR_BG_COLORS.length];
      };

      return data
        .filter((p: any) => p.status !== 'declined')
        .map((p: any) => {
          const prof = p.profiles || {};
          const fn = prof.first_name || 'User';
          const ln = prof.last_name || '';
          const name = `${fn} ${ln}`.trim();
          const handle = prof.username ? `@${prof.username}` : '@user';
          const initials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'U';

          return {
            id: p.user_id,
            name,
            handle,
            initials,
            avatarBg: getBg(p.user_id),
            avatarUrl: prof.avatar_url || undefined,
            role: p.role === 'host' ? 'host' : 'member',
            status: p.role === 'host' ? 'accepted' : ((p.status || 'accepted') as 'accepted' | 'pending'),
          };
        });
    } catch (err: any) {
      console.warn('fetchTripParticipantsDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Fetch all trip participants with their commitment levels and notes
   */
  public async fetchTripCommitmentsDB(tripId: string): Promise<MemberCommitment[]> {
    try {
      const { data, error } = await supabase
        .from('trip_participants')
        .select(`
          user_id,
          role,
          status,
          joined_at,
          commitment_level,
          commitment_note,
          commitment_updated_at,
          profiles:user_id (
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .eq('trip_id', tripId);

      if (error || !data || data.length === 0) {
        // Fallback: fetch without new columns if migration not yet applied
        const fallbackMembers = await this.fetchTripParticipantsDB(tripId);
        return fallbackMembers.map((m) => ({
          userId: m.id,
          name: m.name,
          handle: m.handle,
          initials: m.initials,
          avatarBg: m.avatarBg,
          avatarUrl: m.avatarUrl,
          role: m.role,
          status: m.status,
          commitmentLevel: 100,
          commitmentNote: undefined,
          updatedAt: undefined,
        }));
      }

      const AVATAR_BG_COLORS = ['#0171F8', '#4F86C6', '#E11D48', '#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899'];
      const getBg = (id: string) => {
        let sum = 0;
        for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i);
        return AVATAR_BG_COLORS[sum % AVATAR_BG_COLORS.length];
      };

      return data
        .filter((p: any) => p.status !== 'declined')
        .map((p: any) => {
          const prof = p.profiles || {};
          const fn = prof.first_name || 'User';
          const ln = prof.last_name || '';
          const name = `${fn} ${ln}`.trim();
          const handle = prof.username ? `@${prof.username}` : '@user';
          const initials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'U';
          const rawLevel = p.commitment_level;
          const commitmentLevel = typeof rawLevel === 'number' ? Math.max(0, Math.min(100, rawLevel)) : 100;

          return {
            userId: p.user_id,
            name,
            handle,
            initials,
            avatarBg: getBg(p.user_id),
            avatarUrl: prof.avatar_url || undefined,
            role: p.role === 'host' ? 'host' : 'member',
            status: p.role === 'host' ? 'accepted' : ((p.status || 'accepted') as 'accepted' | 'pending'),
            commitmentLevel,
            commitmentNote: p.commitment_note || undefined,
            updatedAt: p.commitment_updated_at || p.joined_at || undefined,
          };
        });
    } catch (err: any) {
      console.warn('fetchTripCommitmentsDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Update a user's commitment level and note for a specific trip
   */
  public async updateTripCommitmentDB(
    tripId: string,
    userId: string,
    level: number,
    note?: string
  ): Promise<boolean> {
    try {
      const sanitizedLevel = Math.max(0, Math.min(100, Math.round(level)));
      const { error } = await supabase
        .from('trip_participants')
        .update({
          commitment_level: sanitizedLevel,
          commitment_note: note !== undefined ? note.trim() : null,
          commitment_updated_at: new Date().toISOString(),
        })
        .eq('trip_id', tripId)
        .eq('user_id', userId);

      if (error) {
        console.warn('updateTripCommitmentDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('updateTripCommitmentDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Send a fun nudge notification to a member or to all pending/undecided members
   */
  public async sendCommitmentNudgeDB(
    tripId: string,
    senderId: string,
    senderName: string,
    tripTitle: string,
    targetUserId?: string
  ): Promise<boolean> {
    try {
      let recipientIds: string[] = [];

      if (targetUserId) {
        recipientIds = [targetUserId];
      } else {
        const commitments = await this.fetchTripCommitmentsDB(tripId);
        recipientIds = commitments
          .filter((c) => c.userId !== senderId && c.commitmentLevel < 100)
          .map((c) => c.userId);
      }

      if (recipientIds.length === 0) return true;

      const notifs = recipientIds.map((rId) => ({
        user_id: rId,
        actor_id: senderId,
        trip_id: tripId,
        type: 'commitment_nudge',
        title: 'Barkada Nudge! 📣',
        message: `${senderName} is asking: "G ka na ba sa ${tripTitle}?" Pa-update ng commitment level mo! 🚀`,
        is_read: false,
      }));

      await supabase.from('notifications').insert(notifs);
      return true;
    } catch (err: any) {
      console.warn('sendCommitmentNudgeDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Invite additional friends to an existing trip in Supabase DB
   */
  public async inviteFriendsToTripDB(
    tripId: string,
    friendIds: string[],
    hostId: string,
    tripTitle: string,
    inviteCode: string
  ): Promise<boolean> {
    if (friendIds.length === 0) return true;
    try {
      const inserts = friendIds.map((fId) => ({
        trip_id: tripId,
        user_id: fId,
        role: 'member',
        status: 'pending',
      }));

      await supabase.from('trip_participants').upsert(inserts, { onConflict: 'trip_id,user_id' });

      // Fetch host profile name for notification
      let hostNameStr = 'Your friend';
      if (hostId) {
        const { data: hostProf } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', hostId)
          .maybeSingle();
        if (hostProf?.first_name) {
          hostNameStr = `${hostProf.first_name} ${hostProf.last_name || ''}`.trim();
        }
      }

      // Notifications with trip_invite type
      const notifs = friendIds.map((fId) => ({
        user_id: fId,
        actor_id: hostId || undefined,
        type: 'trip_invite',
        title: 'Trip Invitation',
        message: `${hostNameStr} is inviting you to join "${tripTitle}"!`,
        is_read: false,
      }));

      await supabase.from('notifications').insert(notifs);
      return true;
    } catch (err: any) {
      console.warn('inviteFriendsToTripDB error:', err?.message);
      return false;
    }
  }

  public createTrip(params: {
    title: string;
    targetDates?: string;
    invitedFriendIds?: string[];
  }): Trip {
    const code = this.generateShortCode();
    const newTrip: Trip = {
      id: `trip_${Date.now()}`,
      title: params.title || 'New Barkada Trip',
      destination: 'Voting in Progress',
      dateRange: params.targetDates || 'Dates TBD · 1 barkada',
      memberCount: 1 + (params.invitedFriendIds?.length || 0),
      status: 'Active',
      imageUrl: elnidoEscapeImg,
      totalBudget: 15000,
      spentAmount: 0,
      daysLeft: null,
      weatherTemp: '--',
      weatherCondition: 'Planning Phase',
      nextActivityTitle: 'Vote on Destination Poll',
      nextActivityTime: 'Open for Voting',
      inviteCode: code,
      inviteLink: `https://barkadash.app/join/${code}`,
      hostName: 'You',
      planningStage: 'DESTINATION_VOTING',
      invitedFriendIds: params.invitedFriendIds || [],
      day1Itinerary: [
        {
          id: 'i_init1',
          time: '10:00 AM',
          title: 'Cast Votes on Destination Poll',
          category: 'VOTING',
          location: 'Barkadash Poll',
          estCost: 'Free',
          note: 'Everyone choose your top spot!',
          isCompleted: false,
        },
        {
          id: 'i_init2',
          time: '02:00 PM',
          title: 'Barkada Group Chat & Ideas',
          category: 'DISCUSSION',
          location: 'Barkadash Chat',
          estCost: 'Free',
          note: 'Suggest spots & food places',
          isCompleted: false,
        },
      ],
    };

    this.trips.unshift(newTrip);
    this.activeTripId = newTrip.id;
    this.notify();
    return newTrip;
  }

  public joinTripByCode(code: string): { success: boolean; trip?: Trip; message?: string } {
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const found = this.trips.find(
      (t) => t.inviteCode?.toUpperCase() === cleanCode
    );

    if (found) {
      this.activeTripId = found.id;
      this.notify();
      return { success: true, trip: found };
    }

    if (cleanCode.length >= 6) {
      const joinedTrip: Trip = {
        id: `trip_joined_${Date.now()}`,
        title: `Barkada Trip (${cleanCode})`,
        destination: 'Destination Voting',
        dateRange: 'Upcoming · 4 barkadas',
        memberCount: 4,
        status: 'Active',
        imageUrl: sagadaImg,
        totalBudget: 20000,
        spentAmount: 0,
        daysLeft: null,
        weatherTemp: '28°C',
        weatherCondition: 'Sunny',
        nextActivityTitle: 'Join Destination Poll',
        nextActivityTime: 'Today',
        inviteCode: cleanCode,
        inviteLink: `https://barkadash.app/join/${cleanCode}`,
        hostName: 'Barkada Host',
        planningStage: 'DESTINATION_VOTING',
        day1Itinerary: [
          {
            id: 'ij_1',
            time: '09:00 AM',
            title: 'Welcome to the Trip!',
            category: 'JOINED',
            location: 'Barkadash App',
            estCost: 'Free',
            note: 'You joined using code ' + cleanCode,
            isCompleted: true,
          },
        ],
      };

      this.trips.unshift(joinedTrip);
      this.activeTripId = joinedTrip.id;
      this.notify();
      return { success: true, trip: joinedTrip };
    }

    return { success: false, message: 'Please enter a valid 6-character trip code' };
  }

  public getPollOptions(): DestinationPollOption[] {
    return [...this.pollOptions];
  }

  public voteDestination(pollId: string) {
    this.pollOptions = this.pollOptions.map((item) => {
      if (item.id === pollId) {
        const newIsVoted = !item.isVotedByMe;
        const newVotes = newIsVoted ? item.votes + 1 : item.votes - 1;
        return { ...item, votes: newVotes, isVotedByMe: newIsVoted };
      }
      return item;
    });
    this.notify();
  }

  public getRecentActivities(): BarkadaActivity[] {
    return [];
  }

  public getSpots(): SpotItem[] {
    return [];
  }

  public getPlaces(): PlaceItem[] {
    return [];
  }
}

