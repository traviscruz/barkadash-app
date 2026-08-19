import { supabase } from '../utils/supabase';

export interface AppNotification {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  actorHandle?: string;
  actorInitials?: string;
  actorAvatarBg?: string;
  type:
    | 'follow'
    | 'follow_back'
    | 'system'
    | 'trip_invite'
    | 'poll_result'
    | 'trip_invite_response'
    | 'itinerary_added'
    | 'itinerary_reaction'
    | 'stay_added'
    | 'stay_reaction'
    | 'stay_comment';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  timeAgo: string;
  isFollowingActor?: boolean;
  tripId?: string;
  itineraryItemId?: string;
  stayId?: string;
}

const AVATAR_BG_COLORS = [
  '#0171F8',
  '#4F86C6',
  '#E11D48',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#3B82F6',
  '#EC4899',
];

const getAvatarBg = (id?: string) => {
  if (!id) return '#0171F8';
  let charSum = 0;
  for (let i = 0; i < id.length; i++) {
    charSum += id.charCodeAt(i);
  }
  return AVATAR_BG_COLORS[charSum % AVATAR_BG_COLORS.length];
};

export const NotificationService = {
  /**
   * Fetch real notifications for a specific user from Supabase public.notifications
   */
  async fetchNotifications(userId?: string): Promise<AppNotification[]> {
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          actor_id,
          type,
          title,
          message,
          is_read,
          created_at,
          trip_id,
          itinerary_item_id,
          stay_id,
          profiles:actor_id (
            first_name,
            last_name,
            username,
            avatar_url
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) {
        console.warn('Supabase fetchNotifications notice:', error?.message);
        return [];
      }

      // Check which actors the current user is following
      let followingSet = new Set<string>();
      if (userId) {
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId);

        if (followsData) {
          followsData.forEach((f) => followingSet.add(f.following_id));
        }
      }

      const mapped = data.map((n: any) => {
        const actor = n.profiles || {};
        const firstName = actor.first_name || 'Someone';
        const lastName = actor.last_name || '';
        const actorName = `${firstName} ${lastName}`.trim();
        const actorHandle = actor.username ? `@${actor.username}` : '@user';
        const actorInitials =
          `${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').toUpperCase()}` || 'U';

        return {
          id: n.id,
          userId: n.user_id,
          actorId: n.actor_id,
          actorName,
          actorHandle,
          actorInitials,
          actorAvatarBg: getAvatarBg(n.actor_id),
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.is_read ?? false,
          createdAt: n.created_at,
          timeAgo: formatTimeAgo(n.created_at),
          isFollowingActor: n.actor_id ? followingSet.has(n.actor_id) : false,
          tripId: n.trip_id || undefined,
          itineraryItemId: n.itinerary_item_id || undefined,
          stayId: n.stay_id || undefined,
        };
      });

      // Collapse redundant "started following you" duplicates (same actor, same
      // follow type) down to the latest one, so logging in / stale rows don't
      // flood the notification page with repeats.
      const seenFollowActors = new Set<string>();
      return mapped.filter((n) => {
        if (n.type === 'follow' || n.type === 'follow_back') {
          if (!n.actorId || seenFollowActors.has(n.actorId)) return false;
          seenFollowActors.add(n.actorId);
        }
        return true;
      });
    } catch (err: any) {
      console.warn('NotificationService fetchNotifications error:', err.message);
      return [];
    }
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId?: string): Promise<number> {
    if (!userId) return 0;
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) return 0;
      return count || 0;
    } catch {
      return 0;
    }
  },

  /**
   * Create a follow / follow_back notification when user A follows user B
   */
  async createFollowNotification(followerId: string, followingId: string, followerName: string): Promise<boolean> {
    if (followerId === followingId) return false;

    try {
      // Check if followingId is already following followerId back
      const { data: reciprocal } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', followingId)
        .eq('following_id', followerId)
        .maybeSingle();

      const isFollowBack = !!reciprocal;
      const type = isFollowBack ? 'follow_back' : 'follow';
      const title = 'New Follower';
      const message = isFollowBack
        ? `${followerName} followed you back.`
        : `${followerName} started following you.`;

      const { error } = await supabase.from('notifications').insert({
        user_id: followingId,
        actor_id: followerId,
        type,
        title,
        message,
        is_read: false,
      });

      if (error) {
        console.warn('Supabase createFollowNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService createFollowNotification error:', err.message);
      return false;
    }
  },

  /**
   * Send trip invitation notification to an invited user
   */
  async createTripInviteNotification(
    hostId: string,
    invitedUserId: string,
    hostName: string,
    tripTitle: string
  ): Promise<boolean> {
    if (!invitedUserId || hostId === invitedUserId) return false;
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: invitedUserId,
        actor_id: hostId,
        type: 'trip_invite',
        title: 'Trip Invitation',
        message: `${hostName} is inviting you to join "${tripTitle}"!`,
        is_read: false,
      });

      if (error) {
        console.warn('Supabase createTripInviteNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService createTripInviteNotification error:', err.message);
      return false;
    }
  },

  /**
   * Send notification to trip host when a user accepts or declines their trip invitation
   */
  async createTripInviteResponseNotification(
    userId: string,
    tripId: string,
    action: 'accepted' | 'declined'
  ): Promise<boolean> {
    try {
      if (!userId || !tripId) return false;

      // 1. Find Host user ID from trip_participants (role = 'host')
      const { data: hostParticipant } = await supabase
        .from('trip_participants')
        .select('user_id')
        .eq('trip_id', tripId)
        .eq('role', 'host')
        .maybeSingle();

      let hostUserId = hostParticipant?.user_id;

      // 2. Fallback: Find Host user ID from trips table (host_id column)
      if (!hostUserId) {
        const { data: tripData } = await supabase
          .from('trips')
          .select('host_id')
          .eq('id', tripId)
          .maybeSingle();
        hostUserId = tripData?.host_id;
      }

      // Do not notify if host is not found or if responder is the host
      if (!hostUserId || hostUserId === userId) return false;

      // 3. Fetch Trip title
      const { data: tripInfo } = await supabase
        .from('trips')
        .select('title')
        .eq('id', tripId)
        .maybeSingle();

      // 4. Fetch Responder Profile
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('first_name, last_name, username')
        .eq('id', userId)
        .maybeSingle();

      const userName = userProfile
        ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.username || 'Someone'
        : 'Someone';

      const tripTitle = tripInfo?.title || 'Barkada Trip';
      const isAccepted = action === 'accepted';
      const title = isAccepted ? 'Invitation Accepted' : 'Invitation Declined';
      const message = isAccepted
        ? `${userName} accepted your invitation to join "${tripTitle}".`
        : `${userName} declined your invitation to join "${tripTitle}".`;

      const { error: insErr } = await supabase.from('notifications').insert({
        user_id: hostUserId,
        actor_id: userId,
        type: 'trip_invite_response',
        title,
        message,
        is_read: false,
      });

      if (insErr) {
        console.warn('createTripInviteResponseNotification insert error:', insErr.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService createTripInviteResponseNotification error:', err.message);
      return false;
    }
  },

  /**
   * Notify the other members of a trip that someone added an itinerary item.
   */
  async createItineraryAddedNotification(
    actorId: string,
    tripId: string,
    actorName: string,
    itemTitle: string,
    itineraryItemId: string,
    tripTitle: string
  ): Promise<boolean> {
    try {
      if (!actorId || !tripId) return false;
      const members = await this.fetchAcceptedTripMemberIds(tripId);
      const targets = members.filter((id) => id !== actorId);
      if (targets.length === 0) return true;

      const rows = targets.map((userId) => ({
        user_id: userId,
        actor_id: actorId,
        type: 'itinerary_added',
        title: 'New Itinerary Spot',
        message: `${actorName} added "${itemTitle}" to the ${tripTitle} itinerary — check it out!`,
        is_read: false,
        trip_id: tripId,
        itinerary_item_id: itineraryItemId,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) {
        console.warn('createItineraryAddedNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService createItineraryAddedNotification error:', err.message);
      return false;
    }
  },

  /**
   * Notify the creator of an itinerary item when another member likes or
   * dislikes their spot.
   */
  async createItineraryReactionNotification(
    actorId: string,
    itemCreatorId: string,
    actorName: string,
    itemTitle: string,
    itineraryItemId: string,
    tripId: string,
    tripTitle: string,
    reaction: 'like' | 'dislike'
  ): Promise<boolean> {
    try {
      if (!actorId || !itemCreatorId || actorId === itemCreatorId) return false;

      const { error } = await supabase.from('notifications').insert({
        user_id: itemCreatorId,
        actor_id: actorId,
        type: 'itinerary_reaction',
        title: reaction === 'like' ? 'Spot Liked' : 'Spot Disliked',
        message:
          reaction === 'like'
            ? `${actorName} liked "${itemTitle}" in your ${tripTitle} itinerary.`
            : `${actorName} disliked "${itemTitle}" in your ${tripTitle} itinerary — maybe consider swapping it.`,
        is_read: false,
        trip_id: tripId,
        itinerary_item_id: itineraryItemId,
      });

      if (error) {
        console.warn('createItineraryReactionNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService createItineraryReactionNotification error:', err.message);
      return false;
    }
  },

  /**
   * Notify the other members of a trip that the host added a stay.
   */
  async createStayAddedNotification(
    actorId: string,
    tripId: string,
    actorName: string,
    stayTitle: string,
    stayId: string,
    tripTitle: string
  ): Promise<boolean> {
    try {
      if (!actorId || !tripId) return false;
      const members = await this.fetchAcceptedTripMemberIds(tripId);
      const targets = members.filter((id) => id !== actorId);
      if (targets.length === 0) return true;

      const rows = targets.map((userId) => ({
        user_id: userId,
        actor_id: actorId,
        type: 'stay_added',
        title: 'New Stay Added',
        message: `${actorName} picked "${stayTitle}" for the ${tripTitle} stay — check it out!`,
        is_read: false,
        trip_id: tripId,
        stay_id: stayId,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) {
        console.warn('createStayAddedNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('createStayAddedNotification error:', err.message);
      return false;
    }
  },

  /**
   * Notify the other trip members when someone likes or dislikes a stay.
   */
  async createStayReactionNotification(
    actorId: string,
    tripId: string,
    actorName: string,
    stayTitle: string,
    stayId: string,
    tripTitle: string,
    reaction: 'like' | 'dislike'
  ): Promise<boolean> {
    try {
      if (!actorId || !tripId) return false;
      const members = await this.fetchAcceptedTripMemberIds(tripId);
      const targets = members.filter((id) => id !== actorId);
      if (targets.length === 0) return true;

      const rows = targets.map((userId) => ({
        user_id: userId,
        actor_id: actorId,
        type: 'stay_reaction',
        title: reaction === 'like' ? 'Stay Liked' : 'Stay Disliked',
        message:
          reaction === 'like'
            ? `${actorName} liked "${stayTitle}" for your ${tripTitle} stay.`
            : `${actorName} disliked "${stayTitle}" for your ${tripTitle} stay — maybe consider swapping it.`,
        is_read: false,
        trip_id: tripId,
        stay_id: stayId,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) {
        console.warn('createStayReactionNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('createStayReactionNotification error:', err.message);
      return false;
    }
  },

  /**
   * Notify the other trip members when someone comments on a stay.
   */
  async createStayCommentNotification(
    actorId: string,
    tripId: string,
    actorName: string,
    stayTitle: string,
    commentText: string,
    stayId: string,
    tripTitle: string
  ): Promise<boolean> {
    try {
      if (!actorId || !tripId) return false;
      const members = await this.fetchAcceptedTripMemberIds(tripId);
      const targets = members.filter((id) => id !== actorId);
      if (targets.length === 0) return true;

      const snippet = `${commentText.slice(0, 60)}${commentText.length > 60 ? '…' : ''}`;
      const rows = targets.map((userId) => ({
        user_id: userId,
        actor_id: actorId,
        type: 'stay_comment',
        title: 'New Comment on Stay',
        message: `${actorName} commented on "${stayTitle}": "${snippet}"`,
        is_read: false,
        trip_id: tripId,
        stay_id: stayId,
      }));

      const { error } = await supabase.from('notifications').insert(rows);
      if (error) {
        console.warn('createStayCommentNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('createStayCommentNotification error:', err.message);
      return false;
    }
  },

  /**
   * Fetch the accepted member ids of a trip (used to fan out notifications).
   */
  async fetchAcceptedTripMemberIds(tripId: string): Promise<string[]> {
    try {
      const { data } = await supabase
        .from('trip_participants')
        .select('user_id')
        .eq('trip_id', tripId)
        .eq('status', 'accepted');
      return (data || []).map((row: any) => row.user_id);
    } catch {
      return [];
    }
  },

  /**
   * Mark a single notification as read.
   */
  async markAsRead(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) {
        console.warn('NotificationService markAsRead error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService markAsRead error:', err.message);
      return false;
    }
  },

  /**
   * Delete a single notification (swipe-to-delete)
   */
  async deleteNotification(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) {
        console.warn('NotificationService deleteNotification error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService deleteNotification error:', err.message);
      return false;
    }
  },

  /**
   * Delete every notification for a user ("delete all")
   */
  async deleteAllNotifications(userId: string): Promise<boolean> {
    if (!userId) return false;
    try {
      const { error } = await supabase.from('notifications').delete().eq('user_id', userId);
      if (error) {
        console.warn('NotificationService deleteAllNotifications error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService deleteAllNotifications error:', err.message);
      return false;
    }
  },

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);

      if (error) {
        console.warn('Supabase markAllAsRead error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('NotificationService markAllAsRead error:', err.message);
      return false;
    }
  },
};

function formatTimeAgo(dateString: string): string {
  if (!dateString) return '1m';
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (diffSec < 60) return '1m';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w`;
}
