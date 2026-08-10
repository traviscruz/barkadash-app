import './global.css';
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from './src/context/ThemeContext';
import { UserProvider } from './src/context/UserContext';
import { AuthFlowContainer } from './src/screens/auth/AuthFlowContainer';
import { MainAppContainer } from './src/components/nav/MainAppContainer';
import { supabase } from './src/utils/supabase';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkPersistedAuth = async () => {
      try {
        const rememberMeValue = await AsyncStorage.getItem('@barkadash_remember_me');
        const isLoggedInValue = await AsyncStorage.getItem('@barkadash_logged_in');
        const { data: { session } } = await supabase.auth.getSession();

        if ((session || isLoggedInValue === 'true') && rememberMeValue !== 'false') {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (e) {
        console.warn('Auth check error:', e);
        setIsAuthenticated(false);
      }
    };

    checkPersistedAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        setIsAuthenticated(true);
      } else if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.setItem('@barkadash_logged_in', 'false');
    } catch (e) {
      console.warn('Logout error:', e);
    }
    setIsAuthenticated(false);
  };

  return (
    <ThemeProvider>
      <UserProvider>
        <SafeAreaProvider>
          {isAuthenticated === null ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B132B' }}>
              <ActivityIndicator size="large" color="#38BDF8" />
            </View>
          ) : isAuthenticated ? (
            <MainAppContainer onLogout={handleLogout} />
          ) : (
            <AuthFlowContainer onAuthenticated={() => setIsAuthenticated(true)} />
          )}
        </SafeAreaProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
