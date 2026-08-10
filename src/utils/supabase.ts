import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const SafeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key)
        }
        return null
      }
      return await AsyncStorage.getItem(key)
    } catch (e) {
      console.warn('Supabase storage getItem error:', e)
      return null
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value)
        }
        return
      }
      await AsyncStorage.setItem(key, value)
    } catch (e) {
      console.warn('Supabase storage setItem error:', e)
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key)
        }
        return
      }
      await AsyncStorage.removeItem(key)
    } catch (e) {
      console.warn('Supabase storage removeItem error:', e)
    }
  },
}

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  {
    auth: {
      storage: SafeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)