import { Trip, DestinationPollOption, BarkadaActivity, ItineraryItem } from '../types/trip';
import { SpotItem, PlaceItem } from '../types/aiRecommendation';
import { supabase } from '../utils/supabase';
import { NotificationService } from './notificationService';

const elnidoImg = require('../../assets/images/elnido.jpg');
const sagadaImg = require('../../assets/images/sagada.jpeg');
const zambalesImg = require('../../assets/images/zambales.jpg');
const bigLagoonImg = require('../../assets/images/biglagoon.jpg');
const nacpanImg = require('../../assets/images/nacpan.jpg');
const elnidoEscapeImg = require('../../assets/images/elnidoescape.jpg');

export class TripService {
  private static instance: TripService;

  private trips: Trip[] = [
    {
      id: 'trip_1',
      title: 'El Nido Escape',
      destination: 'El Nido, Palawan',
      dateRange: 'Aug 14–17 · 5 barkadas',
      memberCount: 5,
      status: 'Active',
      imageUrl: elnidoEscapeImg,
      totalBudget: 30000,
      spentAmount: 18400,
      daysLeft: 5,
      weatherTemp: '29°C',
      weatherCondition: 'Sunny',
      nextActivityTitle: 'Island Hopping Tour A (Big Lagoon)',
      nextActivityTime: 'Tomorrow, 8:00 AM',
      inviteCode: '7X92K1',
      inviteLink: 'https://barkadash.app/join/7X92K1',
      hostName: 'You',
      planningStage: 'READY',
      day1Itinerary: [
        {
          id: 'i1',
          time: '07:30 AM',
          title: 'Assembly & Breakfast at Artcafe',
          category: 'Dining',
          location: 'El Nido Town Proper',
          estCost: '₱350/pax',
          note: 'Meet up at lobby by 7:15 AM sharp',
          isCompleted: true,
        },
        {
          id: 'i2',
          time: '09:00 AM',
          title: 'Island Hopping Tour A Kayaking',
          category: 'Activity',
          location: 'Big Lagoon',
          estCost: '₱1,200/pax',
          note: 'Includes environmental fee & kayak rental',
          isCompleted: false,
        },
        {
          id: 'i3',
          time: '01:00 PM',
          title: 'Seafood Buffet Lunch on Boat',
          category: 'Dining',
          location: 'Shimizu Island',
          estCost: 'Included in Tour',
          isCompleted: false,
        },
        {
          id: 'i4',
          time: '05:30 PM',
          title: 'Sunset Cocktails & Chill',
          category: 'Leisure',
          location: 'Las Cabañas Beach',
          estCost: '₱400/pax',
          isCompleted: false,
        },
      ],
    },
  ];

  private activeTripId: string = 'trip_1';

  private pollOptions: DestinationPollOption[] = [
    {
      id: 'p1',
      tripId: 'trip_1',
      type: 'place',
      title: 'El Nido, Palawan',
      imagePath: elnidoImg,
      votes: 3,
      votedUserIds: [],
      createdByUserId: 'system',
      createdByName: 'Harry',
      isVotedByMe: true,
      leaderComment: '"tara na sa El Nido!!" — Harry',
    },
    {
      id: 'p2',
      tripId: 'trip_1',
      type: 'place',
      title: 'Sagada Sunrise',
      imagePath: sagadaImg,
      votes: 1,
      votedUserIds: [],
      createdByUserId: 'system',
      createdByName: 'Steven',
      isVotedByMe: false,
      leaderComment: '"chill weather & coffee vibes" — Steven',
    },
    {
      id: 'p3',
      tripId: 'trip_1',
      type: 'place',
      title: 'Zambales Beach Camp',
      imagePath: zambalesImg,
      votes: 1,
      votedUserIds: [],
      createdByUserId: 'system',
      createdByName: 'Ahiah',
      isVotedByMe: false,
      leaderComment: '"near Manila & surfing!" — Ahiah',
    },
  ];

  private listeners: (() => void)[] = [];

  public static getInstance(): TripService {
    if (!TripService.instance) {
      TripService.instance = new TripService();
    }
    return TripService.instance;
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

  private fallbackTrip: Trip = {
    id: 'empty_trip',
    title: 'No Active Trip',
    destination: 'Host or Join a Trip',
    dateRange: 'Select or create a trip to get started',
    memberCount: 0,
    status: 'Active',
    imageUrl: elnidoEscapeImg,
    totalBudget: 0,
    spentAmount: 0,
    daysLeft: 0,
    weatherTemp: '--',
    weatherCondition: '--',
    nextActivityTitle: 'Create or Join a Trip',
    nextActivityTime: 'Now',
    inviteCode: '',
    inviteLink: '',
    hostName: '',
    planningStage: 'DESTINATION_VOTING',
    day1Itinerary: [],
  };

  public getActiveTrip(): Trip {
    const found = this.trips.find((t) => t.id === this.activeTripId);
    return found || this.trips[0] || this.fallbackTrip;
  }

  public setActiveTripId(id: string) {
    this.activeTripId = id;
    this.notify();
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
          daysLeft: 14,
          weatherTemp: '--',
          weatherCondition: 'Planning Phase',
          nextActivityTitle: 'Vote on Destination Poll',
          nextActivityTime: 'Open for Voting',
          inviteCode: tripInserted.invite_code,
          inviteLink: `https://barkadash.app/join/${tripInserted.invite_code}`,
          hostName: 'You',
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
          daysLeft: 10,
          weatherTemp: '28°C',
          weatherCondition: 'Sunny',
          nextActivityTitle: 'Join Destination Poll',
          nextActivityTime: 'Today',
          inviteCode: tripData.invite_code,
          inviteLink: `https://barkadash.app/join/${tripData.invite_code}`,
          hostName: 'Barkada Host',
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

          tripMap.set(t.id, {
            id: t.id,
            title: t.title,
            destination: t.destination || 'Voting in Progress',
            dateRange: t.date_range || 'Dates TBD',
            memberCount: 1,
            status: t.status || 'Active',
            imageUrl: elnidoEscapeImg,
            totalBudget: Number(t.total_budget) || 15000,
            spentAmount: Number(t.spent_amount) || 0,
            daysLeft: 14,
            weatherTemp: '--',
            weatherCondition: 'Planning Phase',
            nextActivityTitle: 'Vote on Destination Poll',
            nextActivityTime: 'Open for Voting',
            inviteCode: t.invite_code,
            inviteLink: `https://barkadash.app/join/${t.invite_code}`,
            hostName: p.role === 'host' ? 'You' : 'Barkada Host',
            planningStage: t.planning_stage || 'DESTINATION_VOTING',
            day1Itinerary: [],
          });
        }
      }

      // Process hosted trips
      if (hostedData && hostedData.length > 0) {
        for (const t of hostedData) {
          if (!tripMap.has(t.id)) {
            tripMap.set(t.id, {
              id: t.id,
              title: t.title,
              destination: t.destination || 'Voting in Progress',
              dateRange: t.date_range || 'Dates TBD',
              memberCount: 1,
              status: t.status || 'Active',
              imageUrl: elnidoEscapeImg,
              totalBudget: Number(t.total_budget) || 15000,
              spentAmount: Number(t.spent_amount) || 0,
              daysLeft: 14,
              weatherTemp: '--',
              weatherCondition: 'Planning Phase',
              nextActivityTitle: 'Vote on Destination Poll',
              nextActivityTime: 'Open for Voting',
              inviteCode: t.invite_code,
              inviteLink: `https://barkadash.app/join/${t.invite_code}`,
              hostName: 'You',
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
        if (!this.trips.some((t) => t.id === this.activeTripId)) {
          this.activeTripId = this.trips[0].id;
        }
      } else {
        this.activeTripId = '';
      }
      this.notify();

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

      return data
        .filter((row: any) => row.trips)
        .map((row: any) => {
          const t = row.trips;
          const hostProf = t.profiles || {};
          const fn = hostProf.first_name || 'Barkada';
          const ln = hostProf.last_name || 'Host';
          const hostName = `${fn} ${ln}`.trim();

          return {
            tripId: t.id,
            tripTitle: t.title,
            destination: t.destination || 'Voting Phase',
            dateRange: t.date_range || 'Upcoming Dates',
            hostName: hostName,
            inviteCode: t.invite_code || '',
            memberCount: 3,
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

  // --- TRIP VOTING POLLS STORAGE & HANDLERS ---
  private pollStore: Map<string, DestinationPollOption[]> = new Map();

  private getInitialPolls(tripId: string): DestinationPollOption[] {
    if (this.pollStore.has(tripId)) {
      return this.pollStore.get(tripId)!;
    }
    const initial: DestinationPollOption[] = [
      {
        id: `poll_p1_${tripId}`,
        tripId,
        title: 'El Nido, Palawan',
        type: 'place',
        subtitle: 'Island Hopping & Lagoon Kayaking',
        votes: 3,
        votedUserIds: [],
        createdByUserId: 'system',
        createdByName: 'Host Recommendation',
      },
      {
        id: `poll_p2_${tripId}`,
        tripId,
        title: 'Baguio City',
        type: 'place',
        subtitle: 'Cool weather, Strawberry Picking & Cafes',
        votes: 1,
        votedUserIds: [],
        createdByUserId: 'system',
        createdByName: 'Host Recommendation',
      },
      {
        id: `poll_p3_${tripId}`,
        tripId,
        title: 'Boracay Island',
        type: 'place',
        subtitle: 'White Beach, Sunset Cruise & Nightlife',
        votes: 2,
        votedUserIds: [],
        createdByUserId: 'system',
        createdByName: 'Host Recommendation',
      },
      {
        id: `poll_d1_${tripId}`,
        tripId,
        title: 'Aug 20 – 24, 2026',
        type: 'date',
        subtitle: '5 Days / 4 Nights (Long Weekend)',
        votes: 4,
        votedUserIds: [],
        createdByUserId: 'system',
        createdByName: 'Host Recommendation',
      },
      {
        id: `poll_d2_${tripId}`,
        tripId,
        title: 'Sep 10 – 14, 2026',
        type: 'date',
        subtitle: '5 Days / 4 Nights',
        votes: 2,
        votedUserIds: [],
        createdByUserId: 'system',
        createdByName: 'Host Recommendation',
      },
    ];
    this.pollStore.set(tripId, initial);
    return initial;
  }

  public getTripPolls(tripId: string): DestinationPollOption[] {
    return this.getInitialPolls(tripId);
  }

  public addTripPollOption(params: {
    tripId: string;
    title: string;
    type: 'place' | 'date';
    subtitle?: string;
    userId: string;
    userName: string;
  }): DestinationPollOption {
    const list = this.getInitialPolls(params.tripId);
    const newOption: DestinationPollOption = {
      id: `poll_${Date.now()}`,
      tripId: params.tripId,
      title: params.title.trim(),
      type: params.type,
      subtitle: params.subtitle?.trim() || (params.type === 'place' ? 'Proposed Destination' : 'Proposed Date Range'),
      votes: 1,
      votedUserIds: [params.userId],
      createdByUserId: params.userId,
      createdByName: params.userName,
    };
    list.push(newOption);
    this.pollStore.set(params.tripId, [...list]);
    this.notify();
    return newOption;
  }

  public toggleVoteTripPoll(pollId: string, tripId: string, userId: string): DestinationPollOption[] {
    const list = this.getInitialPolls(tripId);
    const target = list.find((p) => p.id === pollId);
    if (target) {
      const alreadyVoted = target.votedUserIds.includes(userId);
      if (alreadyVoted) {
        target.votedUserIds = target.votedUserIds.filter((id) => id !== userId);
        target.votes = Math.max(0, target.votes - 1);
      } else {
        target.votedUserIds.push(userId);
        target.votes += 1;
      }
    }
    this.pollStore.set(tripId, [...list]);
    this.notify();
    return [...list];
  }

  public updateTripPollOption(pollId: string, tripId: string, newTitle: string, newSubtitle?: string): boolean {
    const list = this.getInitialPolls(tripId);
    const target = list.find((p) => p.id === pollId);
    if (target) {
      target.title = newTitle.trim();
      if (newSubtitle !== undefined) target.subtitle = newSubtitle.trim();
      this.pollStore.set(tripId, [...list]);
      this.notify();
      return true;
    }
    return false;
  }

  public deleteTripPollOption(pollId: string, tripId: string): boolean {
    const list = this.getInitialPolls(tripId);
    const updated = list.filter((p) => p.id !== pollId);
    this.pollStore.set(tripId, updated);
    this.notify();
    return true;
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
      daysLeft: 14,
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
        daysLeft: 10,
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
    return [
      {
        id: 'act1',
        memberName: 'Ahiah',
        action: 'voted El Nido, Palawan in destination poll',
        timeAgo: '10m ago',
        avatarBgHex: '#3B7A9E',
      },
      {
        id: 'act2',
        memberName: 'Travis',
        action: 'added ₱2,500 Grocery & Drinks expense',
        timeAgo: '1h ago',
        avatarBgHex: '#E2604A',
      },
      {
        id: 'act3',
        memberName: 'Harry',
        action: 'confirmed RSVP for El Nido trip (Confidence 100%)',
        timeAgo: '3h ago',
        avatarBgHex: '#F0A93E',
      },
    ];
  }

  public getSpots(): SpotItem[] {
    return [
      {
        id: 's1',
        name: 'Secret Lagoon',
        rating: '4.9 ★',
        category: 'Nature',
        imagePath: bigLagoonImg,
        fallbackColor: '#CDE7DF',
      },
      {
        id: 's2',
        name: 'Nacpan Beach',
        rating: '4.8 ★',
        category: 'Sunset Spot',
        imagePath: nacpanImg,
        fallbackColor: '#FDEBD3',
      },
    ];
  }

  public getPlaces(): PlaceItem[] {
    return [
      {
        id: 'pl1',
        title: 'Sea Breeze Grill',
        subtitle: 'Fresh Grill & Seafood · 0.4km away',
        priceOrTime: '₱450-800',
        unit: 'per head',
        iconName: 'utensils',
        iconBg: '#FDEBD3',
        iconColor: '#F0A93E',
      },
      {
        id: 'pl2',
        title: 'Spin Designer Hostel',
        subtitle: 'Boutique Stay · Town Center',
        priceOrTime: '₱1,800',
        unit: '/ night',
        iconName: 'home',
        iconBg: '#E4F0EA',
        iconColor: '#3A8E71',
      },
    ];
  }
}

