import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

interface UserContextType {
  profile: UserProfile;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (updated: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
}

const defaultProfile: UserProfile = {
  id: '',
  firstName: 'User',
  lastName: '',
  username: 'user',
  email: '',
  avatarUrl: '',
};

const UserContext = createContext<UserContextType>({
  profile: defaultProfile,
  isLoading: false,
  refreshProfile: async () => {},
  updateProfile: async () => ({ success: false, error: 'Not initialized' }),
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(defaultProfile);
        return;
      }

      // Try fetching profile from public.profiles table
      const { data: dbProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (dbProfile && !error) {
        setProfile({
          id: user.id,
          firstName: dbProfile.first_name || user.user_metadata?.first_name || 'User',
          lastName: dbProfile.last_name || user.user_metadata?.last_name || '',
          username: dbProfile.username || user.user_metadata?.username || user.email?.split('@')[0] || 'user',
          email: dbProfile.email || user.email || '',
          avatarUrl: dbProfile.avatar_url || '',
        });
      } else {
        // Fallback to auth metadata if DB query returns nothing or table not created yet
        const meta = user.user_metadata || {};
        setProfile({
          id: user.id,
          firstName: meta.first_name || 'User',
          lastName: meta.last_name || '',
          username: meta.username || user.email?.split('@')[0] || 'user',
          email: user.email || '',
          avatarUrl: meta.avatar_url || '',
        });
      }
    } catch (err) {
      console.warn('UserContext fetchProfile error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchProfile();
      } else {
        setProfile(defaultProfile);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const updateProfile = async (updated: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'User is not authenticated' };
      }

      // 1. Update Supabase Auth user metadata
      await supabase.auth.updateUser({
        data: {
          first_name: updated.firstName ?? profile.firstName,
          last_name: updated.lastName ?? profile.lastName,
          username: updated.username ?? profile.username,
        },
      });

      // 2. Prepare database updates
      const updates: any = {
        id: user.id,
        updated_at: new Date().toISOString(),
      };

      if (updated.firstName !== undefined) updates.first_name = updated.firstName;
      if (updated.lastName !== undefined) updates.last_name = updated.lastName;
      if (updated.username !== undefined) updates.username = updated.username;
      if (updated.email !== undefined) updates.email = updated.email;
      if (updated.avatarUrl !== undefined) updates.avatar_url = updated.avatarUrl;

      // 3. Upsert profile in Supabase profiles table
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      if (dbError) {
        console.warn('Profiles table upsert error:', dbError.message);
        if (dbError.code === '42501' || dbError.message.includes('permission denied')) {
          return {
            success: false,
            error: 'Permission denied for table "profiles". Please run the SQL permission script in Supabase.',
          };
        }
        return { success: false, error: dbError.message };
      }

      // 4. Update local state
      setProfile((prev) => ({
        ...prev,
        ...updated,
      }));

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to update profile' };
    }
  };

  return (
    <UserContext.Provider
      value={{
        profile,
        isLoading,
        refreshProfile: fetchProfile,
        updateProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
