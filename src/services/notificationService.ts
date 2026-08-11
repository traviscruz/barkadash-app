import { supabase } from '../utils/supabase';

export interface AppNotification {
  id: string;
  userId: string;
  actorId?: string;
  actorName?: string;
  actorHandle?: string;
  actorInitials?: string;
  actorAvatarBg?: string;
  type: 'follow' | 'follow_back' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  timeAgo: string;
  isFollowingActor?: boolean;
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

      return data.map((n: any) => {
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
        };
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
