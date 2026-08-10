import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Edit3, Settings, ShieldCheck, LogOut, Mail, AtSign, User as UserIcon } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { AppColors } from '../../utils/colors';

interface ProfileScreenProps {
  onBack?: () => void;
  onEditProfile?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToTerms?: () => void;
  onLogout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onEditProfile,
  onNavigateToSettings,
  onNavigateToTerms,
  onLogout,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();

  const fullName = `${profile.firstName} ${profile.lastName}`.trim() || 'User';
  const handle = profile.username ? `@${profile.username}` : '@user';
  const initials = `${(profile.firstName[0] || '').toUpperCase()}${(profile.lastName[0] || '').toUpperCase()}` || 'U';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.paper }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Apple-Style Minimalist Back Bar */}
      <View style={styles.topNavRow}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backTouch}>
          <ChevronLeft size={24} color={colors.tealDark} />
          <Text style={[styles.backText, { color: colors.tealDark }]}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 48 }}
      >
        {/* Large Apple-Style Left-Aligned Title */}
        <Text style={[styles.largeAppleTitle, { color: colors.ink }]}>Profile</Text>
        {/* Profile Card Header */}
        <View style={[styles.profileAvatarCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.profileAvatarCircle}>
            <Text style={styles.profileAvatarText}>{initials}</Text>
          </View>
          <Text style={[styles.profileAvatarName, { color: colors.ink }]}>{fullName}</Text>
          <Text style={[styles.profileAvatarHandle, { color: colors.inkSoft }]}>{handle}</Text>

          <TouchableOpacity
            onPress={onEditProfile}
            activeOpacity={0.88}
            style={styles.editPillBtn}
          >
            <Edit3 size={16} color="#FFFFFF" />
            <Text style={styles.editPillBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* User Account Details Section */}
        <Text style={[styles.sectionTitle, { color: colors.inkSoft }]}>Account Details</Text>
        <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={[styles.detailRow, { borderBottomColor: colors.cardBorder }]}>
            <UserIcon size={18} color={colors.tealDark} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailLabel, { color: colors.inkSoft }]}>Full Name</Text>
              <Text style={[styles.detailValue, { color: colors.ink }]}>{fullName}</Text>
            </View>
          </View>

          <View style={[styles.detailRow, { borderBottomColor: colors.cardBorder }]}>
            <AtSign size={18} color={colors.tealDark} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailLabel, { color: colors.inkSoft }]}>Username</Text>
              <Text style={[styles.detailValue, { color: colors.ink }]}>{handle}</Text>
            </View>
          </View>

          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Mail size={18} color={colors.tealDark} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.detailLabel, { color: colors.inkSoft }]}>Email Address</Text>
              <Text style={[styles.detailValue, { color: colors.ink }]}>{profile.email || 'No email provided'}</Text>
            </View>
          </View>
        </View>

        {/* Quick Menu Options */}
        <Text style={[styles.sectionTitle, { color: colors.inkSoft }]}>Quick Actions</Text>
        <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={onNavigateToSettings} activeOpacity={0.7} style={[styles.actionRow, { borderBottomColor: colors.cardBorder }]}>
            <Settings size={18} color={colors.tealDark} />
            <Text style={[styles.actionText, { color: colors.ink }]}>App Settings</Text>
            <ChevronLeft size={16} color={colors.inkSoft} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onNavigateToTerms} activeOpacity={0.7} style={[styles.actionRow, { borderBottomWidth: 0 }]}>
            <ShieldCheck size={18} color={colors.tealDark} />
            <Text style={[styles.actionText, { color: colors.ink }]}>Terms & Privacy Policy</Text>
            <ChevronLeft size={16} color={colors.inkSoft} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={onLogout}
          activeOpacity={0.88}
          style={[
            styles.logoutBtn,
            {
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2',
              borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
            },
          ]}
        >
          <LogOut size={18} color={isDark ? '#F87171' : '#DC2626'} />
          <Text style={[styles.logoutBtnText, { color: isDark ? '#F87171' : '#DC2626' }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppColors.paper,
  },
  topNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  largeAppleTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 4,
    marginBottom: 20,
  },
  profileAvatarCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  profileAvatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: AppColors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  profileAvatarName: {
    fontSize: 22,
    fontWeight: '800',
    color: AppColors.ink,
  },
  profileAvatarHandle: {
    fontSize: 14,
    color: AppColors.inkSoft,
    marginTop: 2,
  },
  profileBioText: {
    fontSize: 13,
    color: AppColors.inkSoft,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  editPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AppColors.tealDark,
    borderRadius: 100,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  editPillBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: AppColors.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 8,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6E8F0',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8F0',
  },
  detailLabel: {
    fontSize: 11,
    color: AppColors.inkSoft,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.ink,
    marginTop: 2,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6E8F0',
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E6E8F0',
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.ink,
    marginLeft: 12,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 100,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    color: '#DC2626',
    fontSize: 15,
    fontWeight: '700',
  },
});
