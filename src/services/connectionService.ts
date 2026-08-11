import { supabase } from '../utils/supabase';
import { NotificationService } from './notificationService';

export interface DBUserConnection {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  isFollowing: boolean;
  isFollower: boolean;
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

const getAvatarBg = (id: string) => {
  let charSum = 0;
  for (let i = 0; i < id.length; i++) {
    charSum += id.charCodeAt(i);
  }
  return AVATAR_BG_COLORS[charSum % AVATAR_BG_COLORS.length];
};

export const ConnectionService = {
  /**
   * Search users from Supabase DB by name or username,
   * along with follow relationships relative to the current logged-in user.
   */
  async searchUsers(query: string, currentUserId?: string): Promise<DBUserConnection[]> {
    try {
      let supabaseQuery = supabase.from('profiles').select('*');

      if (query.trim().length > 0) {
        const cleanQuery = query.trim();
        supabaseQuery = supabaseQuery.or(
          `first_name.ilike.%${cleanQuery}%,last_name.ilike.%${cleanQuery}%,username.ilike.%${cleanQuery}%`
        );
      }

      const { data: dbProfiles, error } = await supabaseQuery.limit(30);

      if (error || !dbProfiles) {
        console.warn('Supabase searchUsers notice:', error?.message);
        return [];
      }

      // Filter out current user if logged in
      const filteredProfiles = currentUserId
        ? dbProfiles.filter((p) => p.id !== currentUserId)
        : dbProfiles;

      if (filteredProfiles.length === 0) return [];

      let followingSet = new Set<string>();
      let followerSet = new Set<string>();

      if (currentUserId) {
        // Fetch users the current user is following
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId);

        if (followingData) {
          followingData.forEach((row) => followingSet.add(row.following_id));
        }

        // Fetch users following the current user
        const { data: followerData } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', currentUserId);

        if (followerData) {
          followerData.forEach((row) => followerSet.add(row.follower_id));
        }
      }

      return filteredProfiles.map((p) => {
        const firstName = p.first_name || 'User';
        const lastName = p.last_name || '';
        const name = `${firstName} ${lastName}`.trim();
        const handle = p.username ? `@${p.username}` : '@user';
        const initials =
          `${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').toUpperCase()}` || 'U';

        return {
          id: p.id,
          name,
          handle,
          initials,
          avatarBg: getAvatarBg(p.id),
          avatarUrl: p.avatar_url || undefined,
          isFollowing: followingSet.has(p.id),
          isFollower: followerSet.has(p.id),
        };
      });
    } catch (err: any) {
      console.warn('connectionService searchUsers exception:', err.message);
      return [];
    }
  },

  /**
   * Follow a user in Supabase public.follows table
   */
  async followUser(followerId: string, followingId: string, followerName?: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('follows').insert({
        follower_id: followerId,
        following_id: followingId,
      });

      if (error) {
        console.warn('Supabase followUser error:', error.message);
        return false;
      }

      // Automatically dispatch notification for recipient
      await NotificationService.createFollowNotification(
        followerId,
        followingId,
        followerName || 'A user'
      );

      return true;
    } catch (err: any) {
      console.warn('connectionService followUser exception:', err.message);
      return false;
    }
  },

  /**
   * Unfollow a user in Supabase public.follows table
   */
  async unfollowUser(followerId: string, followingId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('following_id', followingId);

      if (error) {
        console.warn('Supabase unfollowUser error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('connectionService unfollowUser exception:', err.message);
      return false;
    }
  },
};
