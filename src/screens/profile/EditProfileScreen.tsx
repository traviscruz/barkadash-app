import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Eye, EyeOff, Check, Camera } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { AppColors } from '../../utils/colors';

interface EditProfileScreenProps {
  onBack?: () => void;
  onSaveSuccess?: () => void;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  onBack,
  onSaveSuccess,
}) => {
  const { colors } = useTheme();
  const { profile, updateProfile } = useUser();

  const [firstName, setFirstName] = useState(profile.firstName || '');
  const [lastName, setLastName] = useState(profile.lastName || '');
  const [username, setUsername] = useState(profile.username || '');
  const [email, setEmail] = useState(profile.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setUsername(profile.username || '');
      setEmail(profile.email || '');
    }
  }, [profile]);

  const firstNameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const handleSave = async () => {
    setErrorMessage('');
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!username.trim()) {
      setErrorMessage('Please enter a username.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        email: email.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Failed to update profile.');
      } else {
        setSavedSuccess(true);
        setTimeout(() => {
          if (onSaveSuccess) onSaveSuccess();
          else if (onBack) onBack();
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Centered Top Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
          <ChevronLeft size={24} color={colors.tealDark} />
          <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Edit Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48 }}
        >

          {/* Error / Success Notifications */}
          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {savedSuccess ? (
            <View style={styles.successBox}>
              <Check size={16} color={AppColors.emerald} />
              <Text style={styles.successText}>Profile updated successfully!</Text>
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Profile Picture Avatar Circle with Camera Edit Badge */}
            <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 4 }}>
              <View style={{ position: 'relative' }}>
                <View
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                    backgroundColor: colors.tealDark,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800' }}>
                    {`${(firstName[0] || '').toUpperCase()}${(lastName[0] || '').toUpperCase()}` || 'U'}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    backgroundColor: colors.tealDark,
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2.5,
                    borderColor: colors.card,
                  }}
                >
                  <Camera size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.inkSoft, marginTop: 8 }}>
                Change Profile Photo
              </Text>
            </View>
            {/* First Name & Last Name */}
            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>First Name</Text>
            <TouchableWithoutFeedback onPress={() => firstNameRef.current?.focus()}>
              <View style={[styles.field, { backgroundColor: colors.paper, borderColor: colors.cardBorder }, focusedField === 'fn' && { borderColor: colors.tealDark }]}>
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

            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>Last Name</Text>
            <TouchableWithoutFeedback onPress={() => lastNameRef.current?.focus()}>
              <View style={[styles.field, { backgroundColor: colors.paper, borderColor: colors.cardBorder }, focusedField === 'ln' && { borderColor: colors.tealDark }]}>
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

            {/* Username */}
            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>Username</Text>
            <TouchableWithoutFeedback onPress={() => usernameRef.current?.focus()}>
              <View style={[styles.field, { backgroundColor: colors.paper, borderColor: colors.cardBorder }, focusedField === 'un' && { borderColor: colors.tealDark }]}>
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

            {/* Email Address */}
            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>Email Address</Text>
            <TouchableWithoutFeedback onPress={() => emailRef.current?.focus()}>
              <View style={[styles.field, { backgroundColor: colors.paper, borderColor: colors.cardBorder }, focusedField === 'em' && { borderColor: colors.tealDark }]}>
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

            {/* Optional Password Change */}
            <Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>New Password (Optional)</Text>
            <TouchableWithoutFeedback onPress={() => passwordRef.current?.focus()}>
              <View style={[styles.field, { backgroundColor: colors.paper, borderColor: colors.cardBorder }, focusedField === 'pw' && { borderColor: colors.tealDark }]}>
                <TextInput
                  ref={passwordRef}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Leave blank to keep current password"
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

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.88}
              style={[styles.saveBtn, { backgroundColor: colors.tealDark }]}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  largeAppleTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 20,
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
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E4F0EA',
    borderRadius: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(42, 133, 99, 0.3)',
  },
  successText: {
    fontSize: 13,
    color: AppColors.emerald,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.inkSoft,
    marginBottom: 6,
    marginTop: 12,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF8F5',
    borderRadius: 100, // Oval Pill input matching signup page
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: '#E6E8F0',
  },
  fieldFocused: {
    borderColor: AppColors.tealDark,
  },
  fieldInput: {
    flex: 1,
    paddingVertical: 13,
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
  saveBtn: {
    backgroundColor: AppColors.tealDark,
    borderRadius: 100, // Slim Oval Pill Button
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
