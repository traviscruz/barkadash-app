import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User,
  Settings,
  ShieldCheck,
  LogOut,
  X,
  ChevronRight,
} from 'lucide-react-native';
import { BarkadashLogo } from '../common/BarkadashLogo';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { SubScreenType } from './MainAppContainer';

interface CabinetDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToSubScreen: (screen: SubScreenType) => void;
  onLogout?: () => void;
}

export const CabinetDrawerModal: React.FC<CabinetDrawerModalProps> = ({
  visible,
  onClose,
  onNavigateToSubScreen,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { profile } = useUser();

  const drawerAnim = useRef(new Animated.Value(-300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  const userFullName = `${profile.firstName} ${profile.lastName}`.trim() || 'User';
  const userHandle = profile.username ? `@${profile.username}` : '@user';
  const userInitials =
    `${(profile.firstName[0] || '').toUpperCase()}${(profile.lastName[0] || '').toUpperCase()}` ||
    'U';

  useEffect(() => {
    if (visible) {
      drawerAnim.setValue(-300);
      backdropAnim.setValue(0);
      requestAnimationFrame(() => {
        Animated.parallel([
          Animated.timing(backdropAnim, {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(drawerAnim, {
            toValue: 0,
            stiffness: 350,
            damping: 32,
            mass: 0.8,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  }, [visible, drawerAnim, backdropAnim]);

  const handleCloseAnimation = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(drawerAnim, {
        toValue: -300,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (callback) callback();
    });
  };

  const handleMenuClick = (action: string) => {
    handleCloseAnimation(() => {
      if (action === 'profile') onNavigateToSubScreen('profile');
      else if (action === 'settings') onNavigateToSubScreen('settings');
      else if (action === 'privacy') onNavigateToSubScreen('terms');
      else if (action === 'logout' && onLogout) onLogout();
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => handleCloseAnimation()}>
      <View style={styles.modalRoot}>
        <TouchableWithoutFeedback onPress={() => handleCloseAnimation()}>
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: 'rgba(15, 42, 60, 0.45)',
                opacity: backdropAnim,
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.drawerCabinet,
            {
              transform: [{ translateX: drawerAnim }],
              backgroundColor: colors.card,
              paddingTop: Math.max(insets.top + 12, 24),
              paddingBottom: Math.max(insets.bottom + 12, 24),
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.drawerHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ height: 32, justifyContent: 'center', overflow: 'hidden' }}>
                  <BarkadashLogo height={32} />
                </View>
                <Text style={[styles.brandText, { color: colors.ink }]}>Barkadash</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCloseAnimation()}
                style={[styles.closeBtn, { backgroundColor: colors.paper }]}
                activeOpacity={0.7}
              >
                <X size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Profile Header Summary */}
            <TouchableOpacity
              onPress={() => handleMenuClick('profile')}
              activeOpacity={0.8}
              style={styles.profileSection}
            >
              <View style={[styles.avatarCircle, { backgroundColor: colors.tealDark }]}>
                <Text style={styles.avatarText}>{userInitials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.profileName, { color: colors.ink }]}>{userFullName}</Text>
                <Text style={[styles.profileHandle, { color: colors.inkSoft }]}>{userHandle}</Text>
              </View>
              <ChevronRight size={18} color={colors.inkSoft} />
            </TouchableOpacity>

            <View style={[styles.menuDivider, { backgroundColor: colors.cardBorder }]} />

            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {/* 1. Profile */}
              <TouchableOpacity
                onPress={() => handleMenuClick('profile')}
                activeOpacity={0.7}
                style={styles.menuItem}
              >
                <View style={[styles.menuIconBox, { backgroundColor: colors.paper }]}>
                  <User size={18} color={colors.tealDark} />
                </View>
                <Text style={[styles.menuItemText, { color: colors.ink }]}>Profile</Text>
              </TouchableOpacity>

              {/* 2. Settings */}
              <TouchableOpacity
                onPress={() => handleMenuClick('settings')}
                activeOpacity={0.7}
                style={styles.menuItem}
              >
                <View style={[styles.menuIconBox, { backgroundColor: colors.paper }]}>
                  <Settings size={18} color={colors.tealDark} />
                </View>
                <Text style={[styles.menuItemText, { color: colors.ink }]}>Settings</Text>
              </TouchableOpacity>

              {/* 3. Terms & Privacy */}
              <TouchableOpacity
                onPress={() => handleMenuClick('privacy')}
                activeOpacity={0.7}
                style={styles.menuItem}
              >
                <View style={[styles.menuIconBox, { backgroundColor: colors.paper }]}>
                  <ShieldCheck size={18} color={colors.tealDark} />
                </View>
                <Text style={[styles.menuItemText, { color: colors.ink }]}>Terms & Privacy</Text>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { marginVertical: 12, backgroundColor: colors.cardBorder }]} />

              {/* 4. Logout */}
              <TouchableOpacity
                onPress={() => handleMenuClick('logout')}
                activeOpacity={0.7}
                style={[styles.menuItem, styles.logoutMenuItem]}
              >
                <View
                  style={[
                    styles.menuIconBox,
                    { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEE2E2' },
                  ]}
                >
                  <LogOut size={18} color={isDark ? '#F87171' : '#DC2626'} />
                </View>
                <Text style={[styles.logoutText, { color: isDark ? '#F87171' : '#DC2626' }]}>
                  Logout
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  drawerCabinet: {
    width: 280,
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 16,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  brandText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
  },
  profileHandle: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E6E8F0',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
  },
  menuIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutMenuItem: {
    marginTop: 4,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
