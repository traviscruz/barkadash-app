import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  SafeAreaView,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Eye, EyeOff, Check } from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useTheme } from '../../context/ThemeContext';
import { AppColors } from '../../utils/colors';
import { supabase } from '../../utils/supabase';

interface LoginScreenProps {
  onNavigateToRegister?: () => void;
  onNavigateToForgotPassword?: () => void;
  onNavigateToTerms?: () => void;
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onNavigateToRegister,
  onNavigateToForgotPassword,
  onNavigateToTerms,
  onLoginSuccess,
}) => {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const loadSavedCredentials = async () => {
      try {
        const savedRemember = await AsyncStorage.getItem('@barkadash_remember_me');
        const savedEmail = await AsyncStorage.getItem('@barkadash_remembered_email');
        if (savedRemember !== 'false') {
          setRememberMe(true);
          if (savedEmail) setEmail(savedEmail);
        } else {
          setRememberMe(false);
        }
      } catch (e) {
        console.warn('Error loading remember me credentials:', e);
      }
    };
    loadSavedCredentials();
  }, []);

  const saveLoginState = async (userEmail: string) => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem('@barkadash_remember_me', 'true');
        if (userEmail) {
          await AsyncStorage.setItem('@barkadash_remembered_email', userEmail);
        }
      } else {
        await AsyncStorage.setItem('@barkadash_remember_me', 'false');
        await AsyncStorage.removeItem('@barkadash_remembered_email');
      }
      await AsyncStorage.setItem('@barkadash_logged_in', 'true');
    } catch (e) {
      console.warn('Error saving login state:', e);
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    const inputVal = email.trim();
    if (!inputVal) {
      setErrorMessage('Please enter your email address or username.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }
    setIsLoading(true);
    try {
      let targetEmail = inputVal;

      // If user typed a username without @, lookup corresponding email in profiles table
      if (!inputVal.includes('@')) {
        const { data: dbProfile } = await supabase
          .from('profiles')
          .select('email')
          .ilike('username', inputVal)
          .maybeSingle();

        if (dbProfile?.email) {
          targetEmail = dbProfile.email;
        }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });

      if (error) {
        if (!inputVal.includes('@') && error.message.includes('Invalid login credentials')) {
          setErrorMessage('Incorrect username or password.');
        } else {
          setErrorMessage(error.message);
        }
      } else {
        await saveLoginState(inputVal);
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.centerContainer}>
            {/* Top Logo */}
            <View style={styles.header}>
              <BarkadashLogo height={64} style={styles.logo} />
              <Text style={[styles.title, { color: colors.ink }]}>Welcome Back</Text>
              <Text style={[styles.subtitle, { color: colors.inkSoft }]}>Sign in to your Barkadash account</Text>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Email / Username Input */}
            <TouchableWithoutFeedback onPress={() => emailInputRef.current?.focus()}>
              <View
                style={[
                  styles.field,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  emailFocused && { borderColor: colors.tealDark },
                ]}
              >
                <TextInput
                  ref={emailInputRef}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address or username"
                  placeholderTextColor={colors.inkSoft}
                  keyboardType="default"
                  autoCapitalize="none"
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  style={[styles.fieldInput, { color: colors.ink }]}
                />
              </View>
            </TouchableWithoutFeedback>

            {/* Password Input */}
            <TouchableWithoutFeedback onPress={() => passwordInputRef.current?.focus()}>
              <View
                style={[
                  styles.field,
                  { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 },
                  passwordFocused && { borderColor: colors.tealDark },
                ]}
              >
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={colors.inkSoft}
                  secureTextEntry={!showPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  style={[styles.fieldInput, { flex: 1, color: colors.ink }]}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.6}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  {showPassword ? (
                    <EyeOff size={18} color={colors.inkSoft} />
                  ) : (
                    <Eye size={18} color={colors.inkSoft} />
                  )}
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>

            {/* Options Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
                style={styles.rememberRow}
              >
                <View
                  style={[
                    styles.checkbox,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    rememberMe && { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
                  ]}
                >
                  {rememberMe ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
                <Text style={[styles.rememberText, { color: colors.inkSoft }]}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onNavigateToForgotPassword}
                activeOpacity={0.7}
              >
                <Text style={[styles.forgotText, { color: colors.tealDark }]}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Primary Sign In Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.88}
              style={[styles.mainBtn, { backgroundColor: colors.tealDark, marginBottom: 20 }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.mainBtnText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Footer Links */}
            <View style={styles.footer}>
              <TouchableOpacity onPress={onNavigateToRegister} activeOpacity={0.7}>
                <Text style={[styles.footerText, { color: colors.inkSoft }]}>
                  Don't have an account? <Text style={[styles.footerLink, { color: colors.tealDark }]}>Sign up</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onNavigateToTerms}
                activeOpacity={0.6}
                style={{ marginTop: 20 }}
              >
                <Text style={[styles.termsText, { color: colors.inkSoft }]}>Terms of Service · Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppColors.paper,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center', // Vertically centered
    paddingHorizontal: 28,
    paddingVertical: 36,
  },
  centerContainer: {
    width: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: AppColors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.inkSoft,
    marginTop: 6,
    fontWeight: '400',
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'center',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 100, // Oval Pill
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#E6E8F0',
  },
  fieldFocused: {
    borderColor: AppColors.tealDark, // Pure color change, no dynamic layout shadow jump
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 14, // Inside input padding for solid tap target
    fontSize: 15,
    color: AppColors.ink,
    fontWeight: '500',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#C5C9D6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: AppColors.tealDark,
    borderColor: AppColors.tealDark,
  },
  rememberText: {
    fontSize: 13,
    color: AppColors.inkSoft,
    fontWeight: '500',
  },
  forgotText: {
    fontSize: 13,
    color: AppColors.tealDark,
    fontWeight: '700',
  },
  mainBtn: {
    backgroundColor: AppColors.tealDark,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E6E8F0',
  },
  dividerLabel: {
    fontSize: 12,
    color: '#9BA3B8',
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E6E8F0',
    gap: 10,
  },
  googleIconText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EA4335',
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.ink,
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    fontSize: 14,
    color: AppColors.inkSoft,
  },
  footerLink: {
    color: AppColors.tealDark,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: '#9BA3B8',
    fontWeight: '500',
  },
  dbTestContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  dbTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 100,
    backgroundColor: '#E6F4F1',
    borderWidth: 1,
    borderColor: AppColors.tealAccent,
  },
  dbTestBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.tealDark,
  },
  dbStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    width: '100%',
  },
  dbStatusSuccess: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  dbStatusError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dbStatusText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  dbStatusTextSuccess: {
    color: '#059669',
  },
  dbStatusTextError: {
    color: '#DC2626',
  },
});
