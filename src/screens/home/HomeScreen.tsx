import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TripService } from '../../services/tripService';
import { DestinationPollOption, BarkadaActivity, Trip } from '../../types/trip';
import { TripCard } from '../../components/cards/TripCard';
import { AppCard } from '../../components/cards/AppCard';
import { SectionHeader } from '../../components/common/SectionHeader';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { PolaroidStack } from '../../components/home/PolaroidStack';
import { NoTripWelcome } from '../../components/home/NoTripWelcome';
import { TripMember } from '../../components/trip/TripDetailsModal';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { NotificationService } from '../../services/notificationService';
import { supabase } from '../../utils/supabase';
import { getPlacePhotoUrl } from '../../services/googlePlaces';
import * as Location from 'expo-location';
import { AppColors } from '../../utils/colors';
import { SubScreenType } from '../../components/nav/MainAppContainer';
import {
  Sun,
  Bell,
  ChevronRight,
  Clock,
  Menu,
} from 'lucide-react-native';

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
  const { colors, isDark } = useTheme();
  const { profile } = useUser();

  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<BarkadaActivity[]>([]);
  const [polls, setPolls] = useState<DestinationPollOption[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentLocation, setCurrentLocation] = useState('My Location');
  const lastOffsetY = useRef(0);
  const { sp, fs, icon, bottomNavOffset } = useResponsive();

  const placePolls = polls.filter((p) => p.type === 'place');
  const isTripLocked = !!activeTrip && (activeTrip.planningStage === 'READY' || activeTrip.planningStage === 'ITINERARY_BUILDING');
  const winnerPlace = placePolls.length > 0
    ? placePolls.slice().sort((a, b) => {
        if (b.votes !== a.votes) return b.votes - a.votes;
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      })[0]
    : null;

  const fetchUnread = async () => {
    if (profile?.id) {
      const count = await NotificationService.getUnreadCount(profile.id);
      setUnreadCount(count);
    } else {
      setUnreadCount(0);
    }
  };

  const refreshPolls = async (tripId: string | null) => {
    if (!tripId) {
      setPolls([]);
      return;
    }
    const dbPolls = await TripService.getInstance().fetchTripPollsDB(tripId);
    setPolls(
      dbPolls.map((p) => ({
        ...p,
        isVotedByMe: p.votedUserIds.includes(profile?.id || ''),
        imagePath: p.photoReference
          ? { uri: getPlacePhotoUrl(p.photoReference, 400) }
          : p.imagePath,
      }))
    );
  };

  const refreshMembers = async (tripId: string | null) => {
    if (!tripId) {
      setMembers([]);
      return;
    }
    const dbMembers = await TripService.getInstance().fetchTripParticipantsDB(tripId);
    setMembers(dbMembers);
  };

  const refreshFromService = () => {
    const trip = TripService.getInstance().getActiveTrip();
    setActiveTrip(trip);
    refreshPolls(trip?.id || null);
    refreshMembers(trip?.id || null);
  };

  useEffect(() => {
    const service = TripService.getInstance();
    setLoading(true);
    service.fetchUserTripsDB(profile?.id)
      .then(() => {
        refreshFromService();
        setLoading(false);
      })
      .catch(() => setLoading(false));

    setActivities(service.getRecentActivities());

    const unsubscribeTrip = service.subscribe(() => {
      refreshFromService();
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
          paddingBottom: bottomNavOffset + 40,
          flexGrow: 1,
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

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.tealDark} />
            <Text style={[styles.loadingText, { color: colors.inkSoft }]}>Rounding up your barkada…</Text>
          </View>
        ) : activeTrip ? (
          <>
            {/* Active Trip Card */}
            <TripCard
              trip={activeTrip}
              members={members}
              onPress={() => onNavigateToTab && onNavigateToTab(1)}
            />

            {/* Next Up Banner */}
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

            {/* Polaroid Winner Gallery */}
            {winnerPlace && (
              <>
                <SectionHeader
                  title={isTripLocked ? `PICKED TRIP · ${activeTrip?.title?.toUpperCase() || 'LOCKED'}` : 'TOP PICK DESTINATION'}
                  actionText="View Trip"
                  onActionPress={() => onNavigateToTab && onNavigateToTab(1)}
                />
                <PolaroidStack
                  polls={[winnerPlace]}
                  isLocked={isTripLocked}
                />
              </>
            )}
          </>
        ) : (
          /* Empty state — landing page when no trip yet */
          <NoTripWelcome
            variant="landing"
            onGetStarted={() => onNavigateToTab?.(1)}
          />
        )}

        {/* Live Barkada Updates */}
        {activities.length > 0 && (
          <>
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
          </>
        )}
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 360,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
