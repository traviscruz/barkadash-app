import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Animated,
} from 'react-native';
import { LandingScreen } from './LandingScreen';
import { LoginScreen } from './LoginScreen';
import { SignupScreen } from './SignupScreen';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { TermsPrivacyScreen } from './TermsPrivacyScreen';
import { CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { AppColors } from '../../utils/colors';

export type AuthScreenType =
  | 'landing'
  | 'login'
  | 'signup'
  | 'forgot-password'
  | 'terms-privacy';

interface AuthFlowContainerProps {
  onAuthenticated?: () => void;
}

export const AuthFlowContainer: React.FC<AuthFlowContainerProps> = ({ onAuthenticated }) => {
  const { colors } = useTheme();
  const [currentScreen, setCurrentScreen] = useState<AuthScreenType>('landing');
  const [showNotification, setShowNotification] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  const navigateTo = (nextScreen: AuthScreenType) => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setCurrentScreen(nextScreen);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const triggerToast = (msg: string) => {
    setShowNotification(msg);
    toastAnim.setValue(0);

    // Smooth spring slide up + fade in
    Animated.spring(toastAnim, {
      toValue: 1,
      stiffness: 300,
      damping: 24,
      useNativeDriver: true,
    }).start();

    // Smooth slide down + fade out after delay
    setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setShowNotification(null);
      });
    }, 2600);
  };

  const handleLoginSuccess = () => {
    triggerToast('Welcome back! Signed in successfully.');
    if (onAuthenticated) {
      setTimeout(() => onAuthenticated(), 800);
    }
  };

  const handleSignupSuccess = () => {
    triggerToast('Account created! Welcome to Barkadash.');
    if (onAuthenticated) {
      setTimeout(() => onAuthenticated(), 800);
    } else {
      navigateTo('login');
    }
  };

  const toastTranslateY = toastAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [40, 0],
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {/* Animated Screen Router */}
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
        }}
      >
        {currentScreen === 'landing' ? (
          <LandingScreen
            onGetStarted={() => navigateTo('signup')}
            onSignIn={() => navigateTo('login')}
          />
        ) : null}

        {currentScreen === 'login' ? (
          <LoginScreen
            onNavigateToRegister={() => navigateTo('signup')}
            onNavigateToForgotPassword={() => navigateTo('forgot-password')}
            onNavigateToTerms={() => navigateTo('terms-privacy')}
            onLoginSuccess={handleLoginSuccess}
          />
        ) : null}

        {currentScreen === 'signup' ? (
          <SignupScreen
            onNavigateToLogin={() => navigateTo('login')}
            onNavigateToTerms={() => navigateTo('terms-privacy')}
            onSignupSuccess={handleSignupSuccess}
          />
        ) : null}

        {currentScreen === 'forgot-password' ? (
          <ForgotPasswordScreen onBackToLogin={() => navigateTo('login')} />
        ) : null}

        {currentScreen === 'terms-privacy' ? (
          <TermsPrivacyScreen
            onBack={() => navigateTo('login')}
            onAccept={() => {
              triggerToast('Terms & Privacy accepted.');
              navigateTo('login');
            }}
          />
        ) : null}
      </Animated.View>

      {/* Floating Bottom Toast Notification (Modern Oval Pill with Spring Motion) */}
      {showNotification ? (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: 36,
            left: 24,
            right: 24,
            zIndex: 999,
            backgroundColor: '#1A1D2D',
            borderRadius: 100, // Fully rounded pill
            paddingVertical: 14,
            paddingHorizontal: 20,
            flexDirection: 'row',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 10,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.15)',
            opacity: toastAnim,
            transform: [{ translateY: toastTranslateY }],
          }}
        >
          <CheckCircle2 size={20} color={AppColors.emerald} />
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', flex: 1, marginLeft: 10 }}>
            {showNotification}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
};
