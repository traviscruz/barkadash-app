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
import {
  Eye,
  EyeOff,
  Check,
  ChevronLeft,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useTheme } from '../../context/ThemeContext';
import { AppColors } from '../../utils/colors';
import { supabase } from '../../utils/supabase';
import { OTPService } from '../../services/otpService';

interface SignupScreenProps {
  onNavigateToLogin?: () => void;
  onNavigateToTerms?: () => void;
  onSignupSuccess?: () => void;
}

type Step = 1 | 2 | 3 | 4;

export const SignupScreen: React.FC<SignupScreenProps> = ({
  onNavigateToLogin,
  onNavigateToTerms,
  onSignupSuccess,
}) => {
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>(1);

  // Form Fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  // Input Refs for reliable focus on tap
  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);

  // OTP State (6 Digits)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const otpInputsRef = useRef<Array<TextInput | null>>([]);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Focus States
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 4 && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  const handleOtpChange = (text: string, index: number) => {
    const cleanDigit = text.replace(/[^0-9]/g, '').slice(-1);
    const updated = [...otpDigits];
    updated[index] = cleanDigit;
    setOtpDigits(updated);

    if (cleanDigit && index < 5) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await OTPService.sendRegistrationOtp(email.trim(), `${firstName} ${lastName}`.trim());
      if (!res.success) {
        setErrorMessage(res.error || 'Failed to send verification email.');
      } else {
        setResendTimer(30);
        setCanResend(false);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to resend verification code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = async () => {
    setErrorMessage(null);

    if (step === 1) {
      if (!firstName.trim()) {
        setErrorMessage('Please enter your first name.');
        return;
      }
      if (!lastName.trim()) {
        setErrorMessage('Please enter your last name.');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!username.trim()) {
        setErrorMessage('Please choose a username.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!password || password.length < 6) {
        setErrorMessage('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }
      if (!agreeToTerms) {
        setErrorMessage('Please agree to the Terms & Privacy Policy.');
        return;
      }

      setIsLoading(true);
      try {
        // Trigger Supabase signup which sends email via custom SMTP (melgranttravis@gmail.com)
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              username: username.trim(),
            },
          },
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes('already registered') || msg.includes('user already exists')) {
            setErrorMessage('This email is already registered. Please sign in.');
            return;
          }
          // If error is just email sending failure, log warning and proceed with OTP verification
          if (!msg.includes('email') && !msg.includes('confirmation') && !msg.includes('smtp')) {
            setErrorMessage(error.message);
            return;
          }
          console.warn('Supabase auth email dispatch notice:', error.message);
        }

        // Also generate local OTP record
        await OTPService.sendRegistrationOtp(email.trim(), `${firstName} ${lastName}`.trim());

        // Go to Step 4 OTP input
        setStep(4);
        setResendTimer(30);
        setCanResend(false);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to initiate verification.');
      } finally {
        setIsLoading(false);
      }
      return;
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    const otpCode = otpDigits.join('');
    if (otpCode.length < 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Attempt Supabase verifyOtp with custom SMTP token
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpCode,
        type: 'signup',
      });

      if (error) {
        // 2. Fallback to local OTP verification
        const verifyRes = await OTPService.verifyOtp(email.trim(), otpCode);
        if (!verifyRes.success) {
          setErrorMessage(error.message || verifyRes.error || 'Invalid verification code.');
          setIsLoading(false);
          return;
        }
      }

      if (onSignupSuccess) onSignupSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      if (onSignupSuccess) onSignupSuccess();
    }, 900);
  };

  const handleBack = () => {
    setErrorMessage(null);
    if (step > 1) {
      setStep((prev) => (prev - 1) as Step);
    } else if (onNavigateToLogin) {
      onNavigateToLogin();
    }
  };

  const stepTitles = ['Your Name', 'Username & Email', 'Set Password', 'Verify Email'];
  const stepSubtitles = [
    'Tell us how your barkada calls you',
    'Choose your unique handle and email',
    'Create a secure password for your account',
    `Enter the 6-digit code sent to ${email || 'your email'}`,
  ];

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
            {/* Header Row: Back Button & Logo */}
            <View style={styles.headerRow}>
              <TouchableOpacity
                onPress={handleBack}
                activeOpacity={0.7}
                style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              >
                <ChevronLeft size={22} color={colors.ink} />
              </TouchableOpacity>
              <BarkadashLogo height={44} style={styles.headerLogo} />
              <View style={{ width: 40 }} />
            </View>

            {/* Numbered Step Progress Bar (1 - 2 - 3 - 4) */}
            <View style={styles.stepIndicatorContainer}>
              {[1, 2, 3, 4].map((num) => {
                const isActive = step === num;
                const isDone = step > num;
                return (
                  <React.Fragment key={num}>
                    <View style={styles.stepBadgeWrapper}>
                      <View
                        style={[
                          styles.stepBadge,
                          { backgroundColor: colors.card, borderColor: colors.cardBorder },
                          isActive && { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
                          isDone && { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
                        ]}
                      >
                        {isDone ? (
                          <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        ) : (
                          <Text
                            style={[
                              styles.stepBadgeNumber,
                              { color: isActive || isDone ? '#FFFFFF' : colors.inkSoft },
                            ]}
                          >
                            {num}
                          </Text>
                        )}
                      </View>
                    </View>
                    {num < 4 ? (
                      <View
                        style={[
                          styles.stepLine,
                          { backgroundColor: step > num ? colors.tealDark : colors.cardBorder },
                        ]}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

            {/* Title & Subtitle */}
            <View style={styles.titleContainer}>
              <Text style={[styles.title, { color: colors.ink }]}>{stepTitles[step - 1]}</Text>
              <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{stepSubtitles[step - 1]}</Text>
            </View>

            {/* Error Message */}
            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* ─── STEP 1: First & Last Name ─── */}
            {step === 1 ? (
              <View>
                <TouchableWithoutFeedback onPress={() => firstNameRef.current?.focus()}>
                  <View
                    style={[
                      styles.field,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      focusedField === 'fn' && { borderColor: colors.tealDark },
                    ]}
                  >
                    <TextInput
                      ref={firstNameRef}
                      value={firstName}
                      onChangeText={setFirstName}
                      placeholder="First Name"
                      placeholderTextColor={colors.inkSoft}
                      onFocus={() => setFocusedField('fn')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.fieldInput, { color: colors.ink }]}
                    />
                  </View>
                </TouchableWithoutFeedback>

                <TouchableWithoutFeedback onPress={() => lastNameRef.current?.focus()}>
                  <View
                    style={[
                      styles.field,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 },
                      focusedField === 'ln' && { borderColor: colors.tealDark },
                    ]}
                  >
                    <TextInput
                      ref={lastNameRef}
                      value={lastName}
                      onChangeText={setLastName}
                      placeholder="Last Name"
                      placeholderTextColor={colors.inkSoft}
                      onFocus={() => setFocusedField('ln')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.fieldInput, { color: colors.ink }]}
                    />
                  </View>
                </TouchableWithoutFeedback>

                <TouchableOpacity
                  onPress={handleNextStep}
                  activeOpacity={0.88}
                  style={[styles.mainBtn, { backgroundColor: colors.tealDark, marginTop: 28 }]}
                >
                  <Text style={styles.mainBtnText}>Next Step</Text>
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
                  <Text style={[styles.dividerLabel, { color: colors.inkSoft }]}>or</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
                </View>

                {/* Google Sign-up Button */}
                <TouchableOpacity
                  onPress={handleGoogleSignup}
                  activeOpacity={0.8}
                  style={[styles.googleBtn, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
                >
                  <Text style={styles.googleIconText}>G</Text>
                  <Text style={[styles.googleBtnText, { color: colors.ink }]}>Continue with Google</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ─── STEP 2: Username & Email ─── */}
            {step === 2 ? (
              <View>
                <TouchableWithoutFeedback onPress={() => usernameRef.current?.focus()}>
                  <View
                    style={[
                      styles.field,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      focusedField === 'un' && { borderColor: colors.tealDark },
                    ]}
                  >
                    <Text style={[styles.atPrefix, { color: colors.inkSoft }]}>@</Text>
                    <TextInput
                      ref={usernameRef}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="username"
                      placeholderTextColor={colors.inkSoft}
                      autoCapitalize="none"
                      onFocus={() => setFocusedField('un')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.fieldInput, { flex: 1, color: colors.ink }]}
                    />
                  </View>
                </TouchableWithoutFeedback>

                <TouchableWithoutFeedback onPress={() => emailRef.current?.focus()}>
                  <View
                    style={[
                      styles.field,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 },
                      focusedField === 'em' && { borderColor: colors.tealDark },
                    ]}
                  >
                    <TextInput
                      ref={emailRef}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="Email address"
                      placeholderTextColor={colors.inkSoft}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onFocus={() => setFocusedField('em')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.fieldInput, { color: colors.ink }]}
                    />
                  </View>
                </TouchableWithoutFeedback>

                <TouchableOpacity
                  onPress={handleNextStep}
                  activeOpacity={0.88}
                  style={[styles.mainBtn, { backgroundColor: colors.tealDark, marginTop: 28 }]}
                >
                  <Text style={styles.mainBtnText}>Next Step</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ─── STEP 3: Password & Terms ─── */}
            {step === 3 ? (
              <View>
                <TouchableWithoutFeedback onPress={() => passwordRef.current?.focus()}>
                  <View
                    style={[
                      styles.field,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      focusedField === 'pw' && { borderColor: colors.tealDark },
                    ]}
                  >
                    <TextInput
                      ref={passwordRef}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Password"
                      placeholderTextColor={colors.inkSoft}
                      secureTextEntry={!showPassword}
                      onFocus={() => setFocusedField('pw')}
                      onBlur={() => setFocusedField(null)}
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

                <TouchableWithoutFeedback onPress={() => confirmPasswordRef.current?.focus()}>
                  <View
                    style={[
                      styles.field,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder, marginTop: 12 },
                      focusedField === 'cp' && { borderColor: colors.tealDark },
                    ]}
                  >
                    <TextInput
                      ref={confirmPasswordRef}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm Password"
                      placeholderTextColor={colors.inkSoft}
                      secureTextEntry={!showPassword}
                      onFocus={() => setFocusedField('cp')}
                      onBlur={() => setFocusedField(null)}
                      style={[styles.fieldInput, { color: colors.ink }]}
                    />
                  </View>
                </TouchableWithoutFeedback>

                <TouchableOpacity
                  onPress={() => setAgreeToTerms(!agreeToTerms)}
                  activeOpacity={0.7}
                  style={styles.tosRow}
                >
                  <View
                    style={[
                      styles.tosBox,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                      agreeToTerms && { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
                    ]}
                  >
                    {agreeToTerms ? <Check size={10} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <Text style={[styles.tosText, { color: colors.inkSoft }]}>
                    I agree to the{' '}
                    <Text onPress={onNavigateToTerms} style={[styles.tosLink, { color: colors.tealDark }]}>
                      Terms of Service
                    </Text>{' '}
                    and{' '}
                    <Text onPress={onNavigateToTerms} style={[styles.tosLink, { color: colors.tealDark }]}>
                      Privacy Policy
                    </Text>
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleNextStep}
                  activeOpacity={0.88}
                  style={[styles.mainBtn, { backgroundColor: colors.tealDark, marginTop: 28 }]}
                >
                  <Text style={styles.mainBtnText}>Continue to Verification</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ─── STEP 4: 6-Digit Email OTP Verification ─── */}
            {step === 4 ? (
              <View>
                <View style={styles.otpContainer}>
                  {[0, 1, 2, 3, 4, 5].map((idx) => (
                    <TextInput
                      key={idx}
                      ref={(ref) => {
                        otpInputsRef.current[idx] = ref;
                      }}
                      value={otpDigits[idx]}
                      onChangeText={(val) => handleOtpChange(val, idx)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, idx)}
                      maxLength={1}
                      keyboardType="number-pad"
                      selectTextOnFocus
                      style={[
                        styles.otpBox,
                        { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.ink },
                        otpDigits[idx] ? { borderColor: colors.tealDark } : null,
                      ]}
                    />
                  ))}
                </View>

                <View style={styles.resendRow}>
                  <TouchableOpacity onPress={handleResendOtp} disabled={!canResend} activeOpacity={0.7}>
                    <Text
                      style={[
                        styles.resendText,
                        { color: colors.inkSoft },
                        canResend && { color: colors.tealDark, fontWeight: '700' },
                      ]}
                    >
                      {canResend ? 'Resend OTP Code' : `Resend in ${resendTimer}s`}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={isLoading}
                  activeOpacity={0.88}
                  style={[styles.mainBtn, { backgroundColor: colors.tealDark, marginTop: 28 }]}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.mainBtnText}>Complete Registration</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Switch to Login Footer */}
            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: colors.inkSoft }]}>
                Already have an account?{' '}
                <Text onPress={onNavigateToLogin} style={[styles.switchLink, { color: colors.tealDark }]}>
                  Sign in
                </Text>
              </Text>
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
    paddingVertical: 28,
  },
  centerContainer: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  headerLogo: {
    alignSelf: 'center',
  },
  stepIndicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  stepBadgeWrapper: {
    alignItems: 'center',
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeActive: {
    backgroundColor: AppColors.tealDark,
  },
  stepBadgeDone: {
    backgroundColor: AppColors.emerald,
  },
  stepBadgeInactive: {
    backgroundColor: '#E6E8F0',
  },
  stepBadgeNumber: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepTextLight: {
    color: '#FFFFFF',
  },
  stepTextDark: {
    color: AppColors.inkSoft,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginHorizontal: 6,
  },
  stepLineActive: {
    backgroundColor: AppColors.emerald,
  },
  stepLineInactive: {
    backgroundColor: '#E6E8F0',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: AppColors.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: AppColors.inkSoft,
    marginTop: 4,
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
    borderRadius: 100,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#E6E8F0',
  },
  fieldFocused: {
    borderColor: AppColors.tealDark,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: AppColors.ink,
    fontWeight: '500',
  },
  atPrefix: {
    fontSize: 15,
    color: AppColors.inkSoft,
    fontWeight: '700',
    marginRight: 6,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
    width: '100%',
  },
  otpBox: {
    flex: 1,
    aspectRatio: 0.8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E8F0',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: AppColors.ink,
  },
  otpBoxFilled: {
    borderColor: AppColors.tealDark,
    backgroundColor: 'rgba(31, 78, 103, 0.05)',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 18,
  },
  resendText: {
    fontSize: 13,
    color: '#9BA3B8',
    fontWeight: '600',
  },
  resendTextActive: {
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
    marginVertical: 18,
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
  switchRow: {
    alignItems: 'center',
    marginTop: 28,
  },
  switchText: {
    fontSize: 14,
    color: AppColors.inkSoft,
  },
  switchLink: {
    color: AppColors.tealDark,
    fontWeight: '700',
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  tosBox: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#C5C9D6',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  tosBoxActive: {
    backgroundColor: AppColors.tealDark,
    borderColor: AppColors.tealDark,
  },
  tosText: {
    fontSize: 13,
    color: AppColors.inkSoft,
    lineHeight: 18,
    flex: 1,
  },
  tosLink: {
    color: AppColors.tealDark,
    fontWeight: '700',
  },
});
