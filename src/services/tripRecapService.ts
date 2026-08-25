import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../utils/supabase';
import { TripService } from './tripService';
import { ExpenseService } from './expenseService';
import { TripRecapData, TripRecapMemory, RecapMemoryType, RecapVisibility, TripRecapPost } from '../types/tripRecap';
import { isWithinTripDates, getTripDayInfo } from '../utils/tripDates';

const RECAP_CACHE_KEY_PREFIX = '@barkadash_trip_recap_memories_';

const decodeBase64ToUint8Array = (base64: string): Uint8Array => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export class TripRecapService {
  private static instance: TripRecapService;

  public static getInstance(): TripRecapService {
    if (!TripRecapService.instance) {
      TripRecapService.instance = new TripRecapService();
    }
    return TripRecapService.instance;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Uploads a recap photo to Supabase Storage using FileSystem binary bytes.
   * Auto-creates the 'trip-photos' bucket if it doesn't exist yet.
   */
  private async uploadPhoto(uri: string, tripId: string): Promise<string> {
    try {
      if (uri.startsWith('http://') || uri.startsWith('https://')) {
        return uri;
      }
      const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const fileName = `recap_${tripId}_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `recap/${tripId}/${fileName}`;

      let fileBytes: Uint8Array | ArrayBuffer | null = null;

      // 1. Read via FileSystem as base64
      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (base64) {
          fileBytes = decodeBase64ToUint8Array(base64);
        }
      } catch (fsErr) {
        console.warn('TripRecap FileSystem read notice, trying fetch blob:', fsErr);
      }

      // 2. Fallback to fetch blob
      if (!fileBytes) {
        const res = await fetch(uri);
        const blob = await res.blob();
        fileBytes = await new Response(blob).arrayBuffer();
      }

      if (!fileBytes || (fileBytes instanceof Uint8Array && fileBytes.length === 0)) {
        throw new Error('Empty file content');
      }

      // 3. Upload exclusively to dedicated 'trip-photos' bucket
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('trip-photos')
        .upload(filePath, fileBytes, {
          contentType,
          upsert: true,
        });

      if (!uploadErr && uploadData) {
        const { data: pubData } = supabase.storage
          .from('trip-photos')
          .getPublicUrl(uploadData.path || filePath);
        if (pubData?.publicUrl) return pubData.publicUrl;
      } else if (uploadErr) {
        console.warn('TripRecapService trip-photos upload error:', uploadErr.message);
      }
    } catch (e) {
      console.warn('TripRecapService uploadPhoto error, falling back to local uri:', e);
    }
    return uri;
  }

  /**
   * Fetch complete recap data for a trip (stats, participants, places visited, expenses, memories)
   */
  public async fetchTripRecap(tripId: string): Promise<TripRecapData | null> {
    if (!tripId) return null;

    try {
      const tripService = TripService.getInstance();
      const trips = tripService.getTrips();
      const trip = trips.find((t) => t.id === tripId) || tripService.getActiveTrip();
      if (!trip) return null;

      const dayInfo = getTripDayInfo(trip.dateRange);
      const isCompleted = trip.status === 'Completed';
      const isHappeningNow = isWithinTripDates(trip.dateRange);
      const isAfterTrip = !!dayInfo?.isEnded;
      const isUnlocked = isCompleted || isHappeningNow || isAfterTrip;

      // 1. Fetch participants
      const rawParticipants = await tripService.fetchTripParticipantsDB(tripId).catch(() => []);
      const participants = rawParticipants.map((p) => ({
        id: p.id,
        name: p.name,
        avatarUrl: p.avatarUrl,
        initials: p.initials,
        role: p.role,
      }));

      // 2. Fetch All Stays
      const stays = await tripService.fetchTripStaysDB(tripId).catch(() => []);

      // 3. Fetch Itinerary Places from Trip Planner across all days
      const rawItinerary = await tripService.fetchTripItineraryDB(tripId).catch(() => []);
      const placesVisited = rawItinerary.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.tag || 'ACTIVITY',
        time: item.time,
        dayNumber: item.dayNumber || 1,
        location: item.location || item.placeAddress || item.placeName,
        estCost: item.estCost,
        isCompleted: !!item.isCompleted,
        photoReference: item.photoReference,
      }));

      // Calculate total days from maximum dayNumber in itinerary or date range
      const maxDayInItinerary = placesVisited.reduce((max, p) => Math.max(max, p.dayNumber), 1);
      const parsedDays = parseInt(trip.dateRange?.match(/(\d+)\s*days?/i)?.[1] || '0', 10);
      const totalDays = Math.max(1, maxDayInItinerary, parsedDays);

      // 4. Fetch Exact Total Spent from Expense Ledger
      let totalSpent = 0;
      try {
        const expenses = await ExpenseService.getInstance().fetchExpensesDB(tripId);
        if (expenses && expenses.length > 0) {
          totalSpent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        } else if (trip.spentAmount) {
          totalSpent = Number(trip.spentAmount) || 0;
        }
      } catch (e) {
        totalSpent = Number(trip.spentAmount) || 0;
      }

      const participantsCount = Math.max(1, participants.length || trip.memberCount || 1);
      const perPersonSpent = Math.round(totalSpent / participantsCount);

      // 5. Fetch Recap Memories (from Supabase DB + local fallback)
      let memories: TripRecapMemory[] = [];
      try {
        const { data: dbMemories, error: memErr } = await supabase
          .from('trip_recap_memories')
          .select(`
            id,
            trip_id,
            user_id,
            type,
            title,
            content,
            photo_url,
            place_name,
            day_number,
            rating,
            created_at,
            profiles:user_id (
              id,
              first_name,
              last_name,
              username,
              avatar_url
            )
          `)
          .eq('trip_id', tripId)
          .order('created_at', { ascending: false });

        if (!memErr && dbMemories && dbMemories.length > 0) {
          memories = dbMemories.map((m: any) => {
            const prof = m.profiles || {};
            const fn = prof.first_name || 'Barkada Member';
            const ln = prof.last_name || '';
            const userName = `${fn} ${ln}`.trim();
            const userInitials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'B';

            let parsedPhotos: string[] = [];
            let singlePhoto: string | undefined = undefined;
            if (m.photo_url) {
              if (m.photo_url.startsWith('[') && m.photo_url.endsWith(']')) {
                try {
                  const arr = JSON.parse(m.photo_url);
                  if (Array.isArray(arr)) {
                    parsedPhotos = arr;
                    singlePhoto = arr[0];
                  }
                } catch (e) {
                  singlePhoto = m.photo_url;
                  parsedPhotos = [m.photo_url];
                }
              } else {
                singlePhoto = m.photo_url;
                parsedPhotos = [m.photo_url];
              }
            }

            return {
              id: m.id,
              tripId: m.trip_id,
              userId: m.user_id,
              userName,
              userAvatar: prof.avatar_url,
              userInitials,
              type: m.type as RecapMemoryType,
              title: m.title,
              content: m.content,
              photoUrl: singlePhoto,
              photos: parsedPhotos.length > 0 ? parsedPhotos : undefined,
              placeName: m.place_name,
              dayNumber: m.day_number,
              rating: m.rating,
              createdAt: m.created_at,
            };
          });
        }
      } catch (e) {
        console.warn('trip_recap_memories DB query notice:', e);
      }

      // Merge with local storage memories
      try {
        const localRaw = await AsyncStorage.getItem(`${RECAP_CACHE_KEY_PREFIX}${tripId}`);
        if (localRaw) {
          const localParsed: TripRecapMemory[] = JSON.parse(localRaw);
          if (Array.isArray(localParsed)) {
            const existingIds = new Set(memories.map((m) => m.id));
            for (const lm of localParsed) {
              if (!existingIds.has(lm.id)) {
                memories.unshift(lm);
              }
            }
          }
        }
      } catch (e) {}

      // 6. Fetch general trip recap settings if existing
      let summaryNote: string | undefined;
      let coverPhotoUrl: string | undefined;
      let isPublic = false;
      let visibility: RecapVisibility = 'private';
      try {
        const { data: recapSettings } = await supabase
          .from('trip_recaps')
          .select('*')
          .eq('trip_id', tripId)
          .maybeSingle();

        if (recapSettings) {
          summaryNote = recapSettings.summary_notes;
          coverPhotoUrl = recapSettings.cover_photo_url;
          isPublic = recapSettings.is_public ?? false;
          visibility = (recapSettings.visibility || (recapSettings.is_public ? 'public' : 'private')) as RecapVisibility;
        }
      } catch (e) {}

      const photos = memories.filter((m) => m.photoUrl).map((m) => m.photoUrl!) as string[];
      const notes = memories.filter((m) => m.type === 'note' || m.type === 'highlight');
      const tips = memories.filter((m) => m.type === 'tip');

      return {
        tripId: trip.id,
        title: trip.title,
        destination: trip.destination,
        dateRange: trip.dateRange,
        status: trip.status || 'Active',
        isCompleted,
        isHappeningNow,
        isAfterTrip,
        isUnlocked,
        totalDays,
        totalBudget: trip.totalBudget || 15000,
        totalSpent,
        perPersonSpent,
        participantsCount,
        participants,
        placesVisited,
        stays: stays.map((s) => ({
          id: s.id,
          title: s.title,
          placeAddress: s.placeAddress,
          note: s.note,
          photoReference: s.photoReference,
        })),
        memories,
        photos,
        notes,
        tips,
        summaryNote,
        coverPhotoUrl,
        isPublic,
        visibility,
      };
    } catch (e) {
      console.warn('fetchTripRecap error:', e);
      return null;
    }
  }

  /**
   * Add a new memory, note, photo, or tip to the trip recap (supports multiple photos).
   */
  public async addMemory(params: {
    tripId: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    userInitials: string;
    type: RecapMemoryType;
    title?: string;
    content?: string;
    photoUri?: string;
    photoUris?: string[];
    placeName?: string;
    dayNumber?: number;
    rating?: number;
  }): Promise<TripRecapMemory> {
    const id = this.generateUUID();
    const urisToUpload = params.photoUris && params.photoUris.length > 0
      ? params.photoUris
      : params.photoUri
      ? [params.photoUri]
      : [];

    let uploadedUrls: string[] = [];
    if (urisToUpload.length > 0) {
      uploadedUrls = await Promise.all(
        urisToUpload.map((uri) => this.uploadPhoto(uri, params.tripId))
      );
    }

    const primaryPhotoUrl = uploadedUrls[0] || undefined;
    const finalPhotos = uploadedUrls.length > 0 ? uploadedUrls : undefined;

    // Serialize multi-photos to store in photo_url column as JSON if multiple, or simple string if single
    const dbPhotoField = uploadedUrls.length > 1
      ? JSON.stringify(uploadedUrls)
      : primaryPhotoUrl || null;

    const memory: TripRecapMemory = {
      id,
      tripId: params.tripId,
      userId: params.userId,
      userName: params.userName,
      userAvatar: params.userAvatar,
      userInitials: params.userInitials,
      type: params.type,
      title: params.title?.trim() || undefined,
      content: params.content?.trim() || undefined,
      photoUrl: primaryPhotoUrl,
      photos: finalPhotos,
      placeName: params.placeName?.trim() || undefined,
      dayNumber: params.dayNumber,
      rating: params.rating,
      createdAt: new Date().toISOString(),
    };

    // 1. Try DB Insert
    try {
      await supabase.from('trip_recap_memories').insert({
        id,
        trip_id: params.tripId,
        user_id: params.userId,
        type: params.type,
        title: params.title?.trim() || null,
        content: params.content?.trim() || null,
        photo_url: dbPhotoField,
        place_name: params.placeName?.trim() || null,
        day_number: params.dayNumber || null,
        rating: params.rating || null,
      });
    } catch (e) {
      console.warn('addMemory DB insert notice:', e);
    }

    // 2. Save to local AsyncStorage cache
    try {
      const cacheKey = `${RECAP_CACHE_KEY_PREFIX}${params.tripId}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      const list: TripRecapMemory[] = raw ? JSON.parse(raw) : [];
      list.unshift(memory);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(list));
    } catch (e) {
      console.warn('addMemory AsyncStorage error:', e);
    }

    return memory;
  }

  /**
   * Update an existing memory / note / tip / photos (author only).
   */
  public async updateMemory(
    memoryId: string,
    tripId: string,
    userId: string,
    updates: {
      title?: string;
      content?: string;
      rating?: number;
      placeName?: string;
      photoUris?: string[];
      oldPhotosToDelete?: string[];
    }
  ): Promise<{ success: boolean; finalPhotos?: string[] }> {
    // 1. Delete removed photos from storage
    if (updates.oldPhotosToDelete && updates.oldPhotosToDelete.length > 0) {
      await this.deleteStoragePhotos(updates.oldPhotosToDelete);
    }

    // 2. Upload any new local URIs
    let finalPhotos: string[] | undefined = undefined;
    let dbPhotoField: string | null = null;

    if (updates.photoUris !== undefined) {
      finalPhotos = await Promise.all(
        updates.photoUris.map((uri) => this.uploadPhoto(uri, tripId))
      );
      dbPhotoField = finalPhotos.length > 1
        ? JSON.stringify(finalPhotos)
        : finalPhotos[0] || null;
    }

    // 3. Update DB
    try {
      const updatePayload: any = {
        title: updates.title !== undefined ? updates.title?.trim() || null : undefined,
        content: updates.content !== undefined ? updates.content?.trim() || null : undefined,
        rating: updates.rating !== undefined ? updates.rating || null : undefined,
        place_name: updates.placeName !== undefined ? updates.placeName?.trim() || null : undefined,
        updated_at: new Date().toISOString(),
      };
      if (updates.photoUris !== undefined) {
        updatePayload.photo_url = dbPhotoField;
      }

      // Clean undefined keys
      Object.keys(updatePayload).forEach(
        (key) => updatePayload[key] === undefined && delete updatePayload[key]
      );

      await supabase
        .from('trip_recap_memories')
        .update(updatePayload)
        .eq('id', memoryId)
        .eq('user_id', userId);
    } catch (e) {
      console.warn('updateMemory DB notice:', e);
    }

    // 4. Update AsyncStorage cache
    try {
      const cacheKey = `${RECAP_CACHE_KEY_PREFIX}${tripId}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const list: TripRecapMemory[] = JSON.parse(raw);
        const updated = list.map((m) =>
          m.id === memoryId
            ? {
                ...m,
                title: updates.title !== undefined ? updates.title.trim() || undefined : m.title,
                content: updates.content !== undefined ? updates.content.trim() || undefined : m.content,
                rating: updates.rating !== undefined ? updates.rating : m.rating,
                placeName: updates.placeName !== undefined ? updates.placeName.trim() || undefined : m.placeName,
                photos: finalPhotos !== undefined ? (finalPhotos.length > 0 ? finalPhotos : undefined) : m.photos,
                photoUrl: finalPhotos !== undefined ? finalPhotos[0] || undefined : m.photoUrl,
              }
            : m
        );
        await AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
      }
    } catch (e) {
      console.warn('updateMemory AsyncStorage error:', e);
    }

    return { success: true, finalPhotos };
  }

  /**
   * Delete photos from Supabase Storage bucket ('trip-photos' or 'expense-receipts').
   */
  public async deleteStoragePhotos(photoUrls: string[]): Promise<void> {
    if (!photoUrls || photoUrls.length === 0) return;
    for (const url of photoUrls) {
      try {
        if (url.includes('/storage/v1/object/public/')) {
          const parts = url.split('/storage/v1/object/public/');
          if (parts[1]) {
            const bucketAndPath = parts[1];
            const firstSlash = bucketAndPath.indexOf('/');
            const bucket = bucketAndPath.substring(0, firstSlash);
            const path = bucketAndPath.substring(firstSlash + 1);
            await supabase.storage.from(bucket).remove([path]);
          }
        } else if (url.includes('trip-photos/')) {
          const path = url.substring(url.indexOf('trip-photos/') + 'trip-photos/'.length);
          await supabase.storage.from('trip-photos').remove([path]);
        } else if (url.includes('expense-receipts/')) {
          const path = url.substring(url.indexOf('expense-receipts/') + 'expense-receipts/'.length);
          await supabase.storage.from('expense-receipts').remove([path]);
        } else if (url.startsWith('recap/')) {
          await supabase.storage.from('trip-photos').remove([url]);
          await supabase.storage.from('expense-receipts').remove([url]);
        }
      } catch (e) {
        console.warn('deleteStoragePhotos error:', e);
      }
    }
  }

  /**
   * Delete a memory / note / tip (author only).
   */
  public async deleteMemory(memoryId: string, tripId: string, userId: string): Promise<boolean> {
    try {
      await supabase
        .from('trip_recap_memories')
        .delete()
        .eq('id', memoryId)
        .eq('user_id', userId);
    } catch (e) {}

    try {
      const cacheKey = `${RECAP_CACHE_KEY_PREFIX}${tripId}`;
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const list: TripRecapMemory[] = JSON.parse(raw);
        const filtered = list.filter((m) => m.id !== memoryId);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(filtered));
      }
    } catch (e) {}

    return true;
  }

  /**
   * Host Action: Publish or update visibility settings of a trip post.
   */
  public async publishTripPostDB(
    tripId: string,
    hostId: string,
    visibility: RecapVisibility,
    summaryNotes?: string,
    coverPhotoUrl?: string
  ): Promise<boolean> {
    try {
      const isPublic = visibility === 'public';
      const payload: any = {
        trip_id: tripId,
        visibility,
        is_public: isPublic,
        summary_notes: summaryNotes !== undefined ? summaryNotes?.trim() || null : undefined,
        cover_photo_url: coverPhotoUrl !== undefined ? coverPhotoUrl || null : undefined,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

      const { error } = await supabase
        .from('trip_recaps')
        .upsert(payload, { onConflict: 'trip_id' });

      if (error) {
        console.warn('publishTripPostDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('publishTripPostDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Host Action: Unpublish / set trip post back to private draft.
   */
  public async unpublishTripPostDB(tripId: string, hostId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('trip_recaps')
        .update({
          visibility: 'private',
          is_public: false,
          updated_at: new Date().toISOString(),
        })
        .eq('trip_id', tripId);

      if (error) {
        console.warn('unpublishTripPostDB error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('unpublishTripPostDB exception:', err?.message);
      return false;
    }
  }

  /**
   * Toggle Like on a trip post in Supabase DB.
   */
  public async toggleLikeTripPostDB(
    tripId: string,
    userId: string
  ): Promise<{ success: boolean; isLiked: boolean; newLikesCount: number }> {
    try {
      const { data: existing } = await supabase
        .from('trip_recap_likes')
        .select('id')
        .eq('trip_id', tripId)
        .eq('user_id', userId)
        .maybeSingle();

      let isLiked = false;
      if (existing) {
        // Unlike
        await supabase
          .from('trip_recap_likes')
          .delete()
          .eq('trip_id', tripId)
          .eq('user_id', userId);
        isLiked = false;
      } else {
        // Like
        await supabase.from('trip_recap_likes').insert({
          trip_id: tripId,
          user_id: userId,
        });
        isLiked = true;

        // Send notification to trip host if not self
        try {
          const { data: trip } = await supabase
            .from('trips')
            .select('host_id, title')
            .eq('id', tripId)
            .maybeSingle();
          if (trip && trip.host_id && trip.host_id !== userId) {
            const { data: userProf } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', userId)
              .maybeSingle();
            const actorName = `${userProf?.first_name || 'Someone'} ${userProf?.last_name || ''}`.trim();
            await supabase.from('notifications').insert({
              user_id: trip.host_id,
              actor_id: userId,
              trip_id: tripId,
              type: 'trip_recap_like',
              title: 'Trip Post Liked! ❤️',
              message: `${actorName} liked your trip post "${trip.title}"!`,
              is_read: false,
            });
          }
        } catch (nErr) {}
      }

      // Fetch fresh likes count
      const { count } = await supabase
        .from('trip_recap_likes')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', tripId);

      const newLikesCount = count ?? 0;

      // Update likes_count cache column on trip_recaps if column exists
      try {
        await supabase
          .from('trip_recaps')
          .update({ likes_count: newLikesCount })
          .eq('trip_id', tripId);
      } catch (uErr) {}

      return { success: true, isLiked, newLikesCount };
    } catch (err: any) {
      console.warn('toggleLikeTripPostDB error:', err?.message);
      return { success: false, isLiked: false, newLikesCount: 0 };
    }
  }

  /**
   * Fetch Published Trip Feed Posts (Following feed or Explore feed) directly from Supabase DB!
   */
  public async fetchFeedPostsDB(
    userId: string,
    feedType: 'following' | 'explore'
  ): Promise<TripRecapPost[]> {
    try {
      // 1. Fetch user follows if following feed
      let followedUserIds: string[] = [userId];
      if (feedType === 'following') {
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);
        if (followsData && followsData.length > 0) {
          followedUserIds.push(...followsData.map((f: any) => f.following_id));
        }
      }

      // 2. Fetch recaps with trips & host profile
      let query = supabase
        .from('trip_recaps')
        .select(`
          trip_id,
          summary_notes,
          cover_photo_url,
          is_public,
          visibility,
          likes_count,
          published_at,
          trips:trip_id (
            id,
            title,
            destination,
            date_range,
            status,
            total_budget,
            spent_amount,
            host_id,
            profiles:host_id (
              id,
              first_name,
              last_name,
              username,
              avatar_url
            )
          )
        `);

      if (feedType === 'explore') {
        query = query.or('visibility.eq.public,is_public.eq.true');
      } else {
        query = query.or('visibility.eq.friends,visibility.eq.public,is_public.eq.true');
      }

      const { data: recapsData, error: recapsErr } = await query;
      if (recapsErr || !recapsData || recapsData.length === 0) {
        return [];
      }

      // Filter rows
      let validRows = recapsData.filter((row: any) => row.trips);

      if (feedType === 'following') {
        // Filter rows where host is followed or user is a participant
        validRows = validRows.filter((row: any) => {
          const hostId = row.trips.host_id;
          return followedUserIds.includes(hostId);
        });
      }

      if (validRows.length === 0) return [];

      const tripIds = validRows.map((r: any) => r.trip_id);

      // 3. Fetch user likes for these trips
      let likedTripSet = new Set<string>();
      if (userId) {
        const { data: likesData } = await supabase
          .from('trip_recap_likes')
          .select('trip_id')
          .eq('user_id', userId)
          .in('trip_id', tripIds);
        if (likesData) {
          likesData.forEach((l: any) => likedTripSet.add(l.trip_id));
        }
      }

      // 4. Fetch real participant avatars per trip
      const { data: partsData } = await supabase
        .from('trip_participants')
        .select(`
          trip_id,
          user_id,
          profiles:user_id (
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .in('trip_id', tripIds)
        .eq('status', 'accepted');

      const participantsMap: Record<string, Array<{ id: string; name: string; avatarUrl?: string; initials: string }>> = {};
      if (partsData) {
        partsData.forEach((p: any) => {
          const tId = p.trip_id;
          const prof = p.profiles || {};
          const fn = prof.first_name || 'Member';
          const ln = prof.last_name || '';
          const name = `${fn} ${ln}`.trim();
          const initials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'M';
          if (!participantsMap[tId]) participantsMap[tId] = [];
          participantsMap[tId].push({
            id: p.user_id,
            name,
            avatarUrl: prof.avatar_url,
            initials,
          });
        });
      }

      // 5. Fetch real expenses totals per trip
      const { data: expData } = await supabase
        .from('expenses')
        .select('trip_id, amount')
        .in('trip_id', tripIds);

      const expTotalsMap: Record<string, number> = {};
      if (expData) {
        expData.forEach((e: any) => {
          const tId = e.trip_id;
          expTotalsMap[tId] = (expTotalsMap[tId] || 0) + Number(e.amount || 0);
        });
      }

      // 6. Fetch itinerary items for all trips (for Google Places photos)
      const { data: itinData } = await supabase
        .from('trip_itinerary_items')
        .select('*')
        .in('trip_id', tripIds)
        .order('day_number', { ascending: true })
        .order('created_at', { ascending: true });

      const tripPlacesMap: Record<string, any[]> = {};
      if (itinData) {
        itinData.forEach((item: any) => {
          const tId = item.trip_id;
          if (!tripPlacesMap[tId]) tripPlacesMap[tId] = [];
          tripPlacesMap[tId].push({
            id: item.id,
            title: item.title,
            category: item.tag || 'ACTIVITY',
            time: item.time,
            dayNumber: item.day_number || 1,
            location: item.location || item.place_address || item.place_name,
            estCost: item.est_cost,
            isCompleted: !!item.is_completed,
            photoReference: item.photo_reference,
          });
        });
      }

      // 7. Fetch recap photo count & cover photo fallback
      const { data: memData } = await supabase
        .from('trip_recap_memories')
        .select(`
          id,
          trip_id,
          user_id,
          type,
          title,
          content,
          photo_url,
          place_name,
          day_number,
          rating,
          created_at,
          profiles:user_id (
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .in('trip_id', tripIds);

      const tripPhotosMap: Record<string, string[]> = {};
      const tripMemoriesMap: Record<string, TripRecapMemory[]> = {};

      if (memData) {
        memData.forEach((m: any) => {
          const tId = m.trip_id;
          const prof = m.profiles || {};
          const fn = prof.first_name || 'Member';
          const ln = prof.last_name || '';
          const userName = `${fn} ${ln}`.trim();
          const userInitials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'B';

          let parsedPhotos: string[] = [];
          let singlePhoto: string | undefined = undefined;
          if (m.photo_url) {
            if (m.photo_url.startsWith('[')) {
              try {
                const arr = JSON.parse(m.photo_url);
                if (Array.isArray(arr)) {
                  parsedPhotos = arr;
                  singlePhoto = arr[0];
                }
              } catch (e) {
                singlePhoto = m.photo_url;
                parsedPhotos = [m.photo_url];
              }
            } else {
              singlePhoto = m.photo_url;
              parsedPhotos = [m.photo_url];
            }
          }

          if (parsedPhotos.length > 0) {
            if (!tripPhotosMap[tId]) tripPhotosMap[tId] = [];
            tripPhotosMap[tId].push(...parsedPhotos);
          }

          if (!tripMemoriesMap[tId]) tripMemoriesMap[tId] = [];
          tripMemoriesMap[tId].push({
            id: m.id,
            tripId: m.trip_id,
            userId: m.user_id,
            userName,
            userAvatar: prof.avatar_url,
            userInitials,
            type: m.type,
            title: m.title,
            content: m.content,
            photoUrl: singlePhoto,
            photos: parsedPhotos.length > 0 ? parsedPhotos : undefined,
            placeName: m.place_name,
            dayNumber: m.day_number,
            rating: m.rating,
            createdAt: m.created_at,
          });
        });
      }

      // Build Feed Posts
      const posts: TripRecapPost[] = validRows.map((row: any) => {
        const trip = row.trips;
        const hostProf = trip.profiles || {};
        const hostFn = hostProf.first_name || 'Barkada';
        const hostLn = hostProf.last_name || 'Host';
        const hostName = `${hostFn} ${hostLn}`.trim();
        const hostInitials = `${(hostFn[0] || '').toUpperCase()}${(hostLn[0] || '').toUpperCase()}` || 'H';

        const parts = participantsMap[trip.id] || [];
        const partsCount = Math.max(1, parts.length);
        const totalSpent = expTotalsMap[trip.id] !== undefined ? expTotalsMap[trip.id] : Number(trip.spent_amount || 0);
        const photos = tripPhotosMap[trip.id] || [];
        const places = tripPlacesMap[trip.id] || [];
        const memories = tripMemoriesMap[trip.id] || [];
        const coverPhotoUrl = row.cover_photo_url || photos[0] || undefined;

        return {
          tripId: trip.id,
          title: trip.title,
          destination: trip.destination || 'Barkada Destination',
          dateRange: trip.date_range || 'Dates TBD',
          hostId: trip.host_id,
          hostName,
          hostAvatar: hostProf.avatar_url || undefined,
          hostInitials,
          visibility: (row.visibility || (row.is_public ? 'public' : 'private')) as RecapVisibility,
          isPublic: !!row.is_public || row.visibility === 'public',
          coverPhotoUrl,
          summaryNote: row.summary_notes || undefined,
          totalSpent,
          participantsCount: partsCount,
          participantAvatars: parts,
          likesCount: Number(row.likes_count) || 0,
          isLikedByMe: likedTripSet.has(trip.id),
          publishedAt: row.published_at || row.created_at,
          placesCount: places.length,
          photosCount: photos.length,
          memoriesCount: memories.length,
          placesVisited: places,
          memories,
          photos,
        };
      });

      return posts;
    } catch (err: any) {
      console.warn('fetchFeedPostsDB exception:', err?.message);
      return [];
    }
  }

  /**
   * Fetch all trip posts liked by the user (for "My Likes" cabinet screen).
   */
  public async fetchMyLikedTripsDB(userId: string): Promise<TripRecapPost[]> {
    if (!userId) return [];
    try {
      // 1. Fetch liked trip_ids for this user
      const { data: likesData, error: likesErr } = await supabase
        .from('trip_recap_likes')
        .select('trip_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (likesErr || !likesData || likesData.length === 0) {
        return [];
      }

      const likedTripIds = likesData.map((l: any) => l.trip_id).filter(Boolean);
      if (likedTripIds.length === 0) return [];

      // 2. Fetch published trip recaps for these liked trip_ids
      const { data: recapRows, error: recapErr } = await supabase
        .from('trip_recaps')
        .select(`
          trip_id,
          summary_notes,
          cover_photo_url,
          is_public,
          visibility,
          likes_count,
          published_at,
          created_at,
          trips:trip_id (
            id,
            title,
            destination,
            date_range,
            status,
            total_budget,
            spent_amount,
            host_id,
            profiles:host_id (
              id,
              first_name,
              last_name,
              username,
              avatar_url
            )
          )
        `)
        .in('trip_id', likedTripIds);

      if (recapErr || !recapRows || recapRows.length === 0) {
        return [];
      }

      const validRows = recapRows.filter((tr: any) => tr && tr.trips);
      if (validRows.length === 0) return [];

      const tripIds = validRows.map((r: any) => r.trip_id);

      // Fetch participants
      const { data: partsData } = await supabase
        .from('trip_participants')
        .select(`
          trip_id,
          user_id,
          profiles:user_id (
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .in('trip_id', tripIds)
        .eq('status', 'accepted');

      const participantsMap: Record<string, Array<{ id: string; name: string; avatarUrl?: string; initials: string }>> = {};
      if (partsData) {
        partsData.forEach((p: any) => {
          const tId = p.trip_id;
          const prof = p.profiles || {};
          const fn = prof.first_name || 'Member';
          const ln = prof.last_name || '';
          const name = `${fn} ${ln}`.trim();
          const initials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'M';
          if (!participantsMap[tId]) participantsMap[tId] = [];
          participantsMap[tId].push({
            id: p.user_id,
            name,
            avatarUrl: prof.avatar_url,
            initials,
          });
        });
      }

      // Fetch expenses
      const { data: expData } = await supabase
        .from('expenses')
        .select('trip_id, amount')
        .in('trip_id', tripIds);

      const expTotalsMap: Record<string, number> = {};
      if (expData) {
        expData.forEach((e: any) => {
          const tId = e.trip_id;
          expTotalsMap[tId] = (expTotalsMap[tId] || 0) + Number(e.amount || 0);
        });
      }

      // Fetch itinerary items for liked trips
      const { data: itinData } = await supabase
        .from('trip_itinerary_items')
        .select('*')
        .in('trip_id', tripIds)
        .order('day_number', { ascending: true });

      const tripPlacesMap: Record<string, any[]> = {};
      if (itinData) {
        itinData.forEach((item: any) => {
          const tId = item.trip_id;
          if (!tripPlacesMap[tId]) tripPlacesMap[tId] = [];
          tripPlacesMap[tId].push({
            id: item.id,
            title: item.title,
            category: item.tag || 'ACTIVITY',
            time: item.time,
            dayNumber: item.day_number || 1,
            location: item.location || item.place_address || item.place_name,
            estCost: item.est_cost,
            isCompleted: !!item.is_completed,
            photoReference: item.photo_reference,
          });
        });
      }

      // Fetch recap photos & memories
      const { data: memData } = await supabase
        .from('trip_recap_memories')
        .select(`
          id,
          trip_id,
          user_id,
          type,
          title,
          content,
          photo_url,
          place_name,
          day_number,
          rating,
          created_at,
          profiles:user_id (
            id,
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .in('trip_id', tripIds);

      const tripPhotosMap: Record<string, string[]> = {};
      const tripMemoriesMap: Record<string, TripRecapMemory[]> = {};

      if (memData) {
        memData.forEach((m: any) => {
          const tId = m.trip_id;
          const prof = m.profiles || {};
          const fn = prof.first_name || 'Member';
          const ln = prof.last_name || '';
          const userName = `${fn} ${ln}`.trim();
          const userInitials = `${(fn[0] || '').toUpperCase()}${(ln[0] || '').toUpperCase()}` || 'B';

          let parsedPhotos: string[] = [];
          let singlePhoto: string | undefined = undefined;
          if (m.photo_url) {
            if (m.photo_url.startsWith('[')) {
              try {
                const arr = JSON.parse(m.photo_url);
                if (Array.isArray(arr)) {
                  parsedPhotos = arr;
                  singlePhoto = arr[0];
                }
              } catch (e) {
                singlePhoto = m.photo_url;
                parsedPhotos = [m.photo_url];
              }
            } else {
              singlePhoto = m.photo_url;
              parsedPhotos = [m.photo_url];
            }
          }

          if (parsedPhotos.length > 0) {
            if (!tripPhotosMap[tId]) tripPhotosMap[tId] = [];
            tripPhotosMap[tId].push(...parsedPhotos);
          }

          if (!tripMemoriesMap[tId]) tripMemoriesMap[tId] = [];
          tripMemoriesMap[tId].push({
            id: m.id,
            tripId: m.trip_id,
            userId: m.user_id,
            userName,
            userAvatar: prof.avatar_url,
            userInitials,
            type: m.type,
            title: m.title,
            content: m.content,
            photoUrl: singlePhoto,
            photos: parsedPhotos.length > 0 ? parsedPhotos : undefined,
            placeName: m.place_name,
            dayNumber: m.day_number,
            rating: m.rating,
            createdAt: m.created_at,
          });
        });
      }

      return validRows.map((row: any) => {
        const trip = row.trips;
        const hostProf = trip.profiles || {};
        const hostFn = hostProf.first_name || 'Barkada';
        const hostLn = hostProf.last_name || 'Host';
        const hostName = `${hostFn} ${hostLn}`.trim();
        const hostInitials = `${(hostFn[0] || '').toUpperCase()}${(hostLn[0] || '').toUpperCase()}` || 'H';

        const parts = participantsMap[trip.id] || [];
        const partsCount = Math.max(1, parts.length);
        const totalSpent = expTotalsMap[trip.id] !== undefined ? expTotalsMap[trip.id] : Number(trip.spent_amount || 0);
        const photos = tripPhotosMap[trip.id] || [];
        const places = tripPlacesMap[trip.id] || [];
        const memories = tripMemoriesMap[trip.id] || [];
        const coverPhotoUrl = row.cover_photo_url || photos[0] || undefined;

        return {
          tripId: trip.id,
          title: trip.title,
          destination: trip.destination || 'Barkada Destination',
          dateRange: trip.date_range || 'Dates TBD',
          hostId: trip.host_id,
          hostName,
          hostAvatar: hostProf.avatar_url || undefined,
          hostInitials,
          visibility: (row.visibility || (row.is_public ? 'public' : 'private')) as RecapVisibility,
          isPublic: !!row.is_public || row.visibility === 'public',
          coverPhotoUrl,
          summaryNote: row.summary_notes || undefined,
          totalSpent,
          participantsCount: partsCount,
          participantAvatars: parts,
          likesCount: Number(row.likes_count) || 0,
          isLikedByMe: true,
          publishedAt: row.published_at || row.created_at,
          placesCount: places.length,
          photosCount: photos.length,
          memoriesCount: memories.length,
          placesVisited: places,
          memories,
          photos,
        };
      });
    } catch (err: any) {
      console.warn('fetchMyLikedTripsDB exception:', err?.message);
      return [];
    }
  }
}
