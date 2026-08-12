import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Modal,
  Animated,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { TripService } from '../../services/tripService';
import { DestinationPollOption, BarkadaActivity, Trip } from '../../types/trip';
import { TripCard } from '../../components/cards/TripCard';
import { AppCard } from '../../components/cards/AppCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { PollDetailModal } from '../../components/poll/PollDetailModal';
import { NotificationModal } from '../../components/notifications/NotificationModal';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { PolaroidStack } from '../../components/home/PolaroidStack';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { NotificationService } from '../../services/notificationService';
import { supabase } from '../../utils/supabase';
import * as Location from 'expo-location';
import { AppColors } from '../../utils/colors';
import { SubScreenType } from '../../components/nav/MainAppContainer';
import {
  Sun,
  Bell,
  Vote,
  ChevronRight,
  Clock,
  Menu,
  User,
  Settings,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react-native';

import { TripInvitationModal, PendingTripInvite } from '../../components/trip/TripInvitationModal';

interface HomeScreenProps {
  onNavigateToTab?: (index: number) => void;
  onNavigateToSubScreen?: (screen: SubScreenType) => void;
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onLogout?: () => void;
  onOpenCabinet?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToTab,
  onNavigateToSubScreen,
  onScrollDirection,
  onLogout,
  onOpenCabinet,
}) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { profile } = useUser();

  const userFullName = `${profile.firstName} ${profile.lastName}`.trim() || 'User';
  const userHandle = profile.username ? `@${profile.username}` : '@user';
  const userInitials = `${(profile.firstName[0] || '').toUpperCase()}${(profile.lastName[0] || '').toUpperCase()}` || 'U';
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<BarkadaActivity[]>([]);
  const [polls, setPolls] = useState<DestinationPollOption[]>([]);
  const [pollModalVisible, setPollModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [pendingInvites, setPendingInvites] = useState<PendingTripInvite[]>([]);
  const [currentInvite, setCurrentInvite] = useState<PendingTripInvite | null>(null);
  const [currentLocation, setCurrentLocation] = useState('My Location');
  const lastOffsetY = useRef(0);
  const { sp, fs, icon, bottomNavOffset } = useResponsive();

  const fetchUnread = async () => {
    if (profile?.id) {
      const count = await NotificationService.getUnreadCount(profile.id);
      setUnreadCount(count);
    } else {
      setUnreadCount(0);
    }
  };

  const checkPendingInvites = async () => {
    if (profile?.id) {
      const invites = await TripService.getInstance().fetchPendingTripInvitesDB(profile.id);
      setPendingInvites(invites);
      if (invites.length > 0) {
        setCurrentInvite(invites[0]);
      }
    }
  };

  useEffect(() => {
    const service = TripService.getInstance();
    service.fetchUserTripsDB(profile?.id).then(() => {
      setActiveTrip(service.getActiveTrip());
    });

    setActivities(service.getRecentActivities());
    setPolls(service.getPollOptions());

    if (profile?.id) {
      checkPendingInvites();
    }

    const unsubscribeTrip = service.subscribe(() => {
      setActiveTrip(service.getActiveTrip());
      setPolls(service.getPollOptions());
    });

    fetchUnread();

    if (profile?.id) {
      const channel = supabase
        .channel(`home:notifications:${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          () => {
            fetchUnread();
            checkPendingInvites();
          }
        )
        .subscribe();

      return () => {
        unsubscribeTrip();
        supabase.removeChannel(channel);
      };
    }

    return () => {
      unsubscribeTrip();
    };
  }, [profile?.id]);

  // Show the user's current location instead of a hardcoded city.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setCurrentLocation('My Location');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [place] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (cancelled) return;
        const name =
          place?.city
          || place?.subregion
          || place?.region
          || place?.name;
        setCurrentLocation(name && name !== 'Apple Inc.' ? name : 'My Location');
      } catch (e) {
        if (!cancelled) setCurrentLocation('My Location');
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const currentY = e.nativeEvent.contentOffset.y;
          const delta = currentY - lastOffsetY.current;
          lastOffsetY.current = currentY;

          if (currentY < 15) {
            onScrollDirection?.('up');
          } else if (delta > 2) {
            onScrollDirection?.('down');
          } else if (delta < -2) {
            onScrollDirection?.('up');
          }
        }}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: sp.lg,
          paddingTop: sp.sm,
          paddingBottom: bottomNavOffset + 20,
        }}
      >
        {/* App Header with Borderless Hamburger Button */}
        <View style={styles.appHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity onPress={onOpenCabinet} activeOpacity={0.7} style={styles.borderlessMenuBtn}>
              <Menu size={22} color={colors.ink} strokeWidth={2.2} />
            </TouchableOpacity>
            <BarkadashLogo height={32} />
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
            {/* Weather Badge */}
            <View style={[styles.weatherBadge, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <View style={styles.sunIconCircle}>
                <Sun size={14} color="#D97706" />
              </View>
              <Text style={[styles.weatherTempText, { color: colors.ink }]}>29°C</Text>
              <View style={[styles.weatherDivider, { backgroundColor: colors.cardBorder }]} />
              <Text style={[styles.weatherLocText, { color: colors.inkSoft }]} numberOfLines={1}>{currentLocation}</Text>
            </View>

            {/* Notification Bell Button */}
            <TouchableOpacity
              onPress={() => onNavigateToSubScreen?.('notifications')}
              style={[styles.bellButton, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
              activeOpacity={0.8}
            >
              <Bell size={18} color={colors.ink} />
              {unreadCount > 0 && (
                <View style={styles.bellBadgeCircle}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Active Trip Card */}
        {activeTrip && (
          <TripCard
            trip={activeTrip}
            onPress={() => onNavigateToTab && onNavigateToTab(1)}
          />
        )}

        {/* Next Up Banner */}
        {activeTrip && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onNavigateToTab && onNavigateToTab(1)}
            style={[styles.nextUpBanner, { backgroundColor: isDark ? colors.card : '#0F2A3C', borderColor: isDark ? colors.cardBorder : 'rgba(255,255,255,0.1)' }]}
          >
            <View style={styles.nextUpIconBox}>
              <Clock size={icon.lg} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextUpLabel}>NEXT UP ON ITINERARY</Text>
              <Text style={styles.nextUpTitle} numberOfLines={1}>
                {activeTrip.nextActivityTitle}
              </Text>
              <Text style={styles.nextUpTime}>
                {activeTrip.nextActivityTime}
              </Text>
            </View>
            <ChevronRight size={icon.lg} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {/* Destination Poll Widget */}
        <View style={styles.pollQuickSection}>
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={() => setPollModalVisible(true)}
            style={[styles.pollWidgetCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
          >
            <View style={styles.pollWidgetHeader}>
              <View style={[styles.pollTagPill, { backgroundColor: colors.lightOrangeBg }]}>
                <Vote size={14} color={colors.orangeAccent} />
                <Text style={[styles.pollTagText, { color: colors.orangeAccent }]}>QUICK ACCESS • DESTINATION POLL</Text>
              </View>
            </View>

            <View style={styles.pollWidgetBody}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.pollWidgetTitle, { color: colors.ink }]}>Where to Next?</Text>
                <Text style={[styles.pollWidgetSub, { color: colors.inkSoft }]}>
                  3 destinations competing • Tap to cast or change vote
                </Text>
              </View>

              <View style={[styles.castVoteButton, { backgroundColor: colors.tealDark }]}>
                <Text style={styles.castVoteText}>Cast Vote</Text>
                <ChevronRight size={14} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Polaroid Poll Gallery */}
        <SectionHeader
          title="WHERE TO NEXT? VOTE NOW"
          actionText="View All Options"
          onActionPress={() => setPollModalVisible(true)}
        />

        {polls && polls.length > 0 && (
          <PolaroidStack
            polls={polls}
            onVotePress={() => setPollModalVisible(true)}
          />
        )}

        {/* Live Barkada Updates */}
        <SectionHeader title="LIVE BARKADA UPDATES" />
        <View style={{ gap: sp.sm, marginBottom: sp.xl }}>
          {activities.map((act) => (
            <AppCard key={act.id} className="p-3">
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: sp.md,
                    backgroundColor: act.avatarBgHex,
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.xs }}>
                    {act.memberName[0]}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fs.xs, color: colors.ink }}>
                    <Text style={{ fontWeight: '800', fontSize: fs.sm, color: colors.ink }}>{act.memberName}</Text>{' '}
                    {act.action}
                  </Text>
                </View>
                <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '600' }}>
                  {act.timeAgo}
                </Text>
              </View>
            </AppCard>
          ))}
        </View>
      </ScrollView>

      {/* MODALS */}
      <PollDetailModal
        visible={pollModalVisible}
        onClose={() => setPollModalVisible(false)}
      />

      <TripInvitationModal
        visible={!!currentInvite}
        invite={currentInvite}
        onClose={() => setCurrentInvite(null)}
        onAccept={async (tripId) => {
          if (profile?.id) {
            await TripService.getInstance().acceptTripInviteDB(tripId, profile.id);
            setCurrentInvite(null);
            onNavigateToTab?.(1); // Auto navigate to Planner tab on accept!
          }
        }}
        onDecline={async (tripId) => {
          if (profile?.id) {
            await TripService.getInstance().declineTripInviteDB(tripId, profile.id);
            setCurrentInvite(null);
          }
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  borderlessMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  weatherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF7',
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FDE68A',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 5,
  },
  sunIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTempText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D97706',
  },
  weatherDivider: {
    width: 1,
    height: 10,
    backgroundColor: '#FCD34D',
  },
  weatherLocText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F2A3C',
    maxWidth: 90,
  },
  bellButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAE4D7',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadgeCircle: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#E2604A',
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
  drawerCabinet: {
    width: 280,
    height: '100%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 20,
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
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: AppColors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.ink,
  },
  profileHandle: {
    fontSize: 12,
    color: AppColors.inkSoft,
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#EAE4D7',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: AppColors.ink,
  },
  logoutMenuItem: {
    marginTop: 2,
  },
  logoutIconBox: {
    backgroundColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  nextUpBanner: {
    marginBottom: 20,
    backgroundColor: '#0F2A3C',
    padding: 16,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  nextUpIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  nextUpLabel: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: 'rgba(255,255,255,0.6)',
  },
  nextUpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  nextUpTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  pollQuickSection: {
    marginBottom: 24,
  },
  pollWidgetCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAE4D7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  pollWidgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pollTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FDEBD3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  pollTagText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B8791E',
    letterSpacing: 0.8,
  },
  pollWidgetBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pollWidgetTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1D2D',
  },
  pollWidgetSub: {
    fontSize: 11,
    color: '#6E738A',
    fontWeight: '500',
    marginTop: 2,
  },
  castVoteButton: {
    backgroundColor: '#1F4E67',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  castVoteText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
