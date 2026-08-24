import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, StatusBar, Animated, Easing, Dimensions } from 'react-native';
import { AppBottomNav } from './AppBottomNav';
import { HomeScreen } from '../../screens/home/HomeScreen';
import { TripPlannerScreen } from '../../screens/planner/TripPlannerScreen';
import { BarkadaRadarScreen } from '../../screens/radar/BarkadaRadarScreen';
import { ExpenseLedgerScreen } from '../../screens/expenses/ExpenseLedgerScreen';
import { ExploreScreen } from '../../screens/explore/ExploreScreen';
import { ProfileScreen } from '../../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../../screens/profile/EditProfileScreen';
import { SocialConnectionsScreen } from '../../screens/profile/SocialConnectionsScreen';
import { SettingsScreen } from '../../screens/settings/SettingsScreen';
import { TermsPrivacyScreen } from '../../screens/auth/TermsPrivacyScreen';
import { NotificationsScreen } from '../../screens/notifications/NotificationsScreen';
import { CommitmentTrackerScreen } from '../../screens/trip/CommitmentTrackerScreen';
import { PackingChecklistScreen } from '../../screens/checklist/PackingChecklistScreen';
import { CabinetDrawerModal } from './CabinetDrawerModal';
import { PendingTripInvite } from '../trip/TripInvitationModal';
import { TripInvitationBanner } from '../trip/TripInvitationBanner';
import {
  InAppNotificationBanner,
  InAppNotifPayload,
} from '../notifications/InAppNotificationBanner';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { TripService } from '../../services/tripService';
import { NotificationService } from '../../services/notificationService';
import { PushService } from '../../services/pushService';
import { supabase } from '../../utils/supabase';
import { FloatingAiButton } from '../ai/FloatingAiButton';
import { AiChatModal } from '../ai/AiChatModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type SubScreenType = 'profile' | 'edit-profile' | 'settings' | 'terms' | 'connections' | 'notifications' | 'commitment' | 'checklist' | null;

interface MainAppContainerProps {
  onLogout?: () => void;
}

export const MainAppContainer: React.FC<MainAppContainerProps> = ({ onLogout }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [activeSubScreen, setActiveSubScreen] = useState<SubScreenType>(null);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [cabinetVisible, setCabinetVisible] = useState(false);
  const { colors } = useTheme();
  const { profile } = useUser();

  const [pendingInvites, setPendingInvites] = useState<PendingTripInvite[]>([]);
  const [currentInvite, setCurrentInvite] = useState<PendingTripInvite | null>(null);
  const [bannerQueue, setBannerQueue] = useState<InAppNotifPayload[]>([]);
  const [aiChatVisible, setAiChatVisible] = useState(false);

  const checkPendingInvites = useCallback(async () => {
    if (profile?.id) {
      const invites = await TripService.getInstance().fetchPendingTripInvitesDB(profile.id);
      setPendingInvites(invites);
      setCurrentInvite((prev) => {
        if (prev && invites.some((i) => i.tripId === prev.tripId)) return prev;
        return invites.length > 0 ? invites[0] : null;
      });
    }
  }, [profile?.id]);

  const closeBanner = useCallback(() => {
    setBannerQueue((prev) => prev.slice(1));
  }, []);

  const showBanner = useCallback((payload: InAppNotifPayload) => {
    setBannerQueue((prev) => {
      if (prev.some((b) => b.id === payload.id)) return prev;
      return [...prev, payload];
    });
  }, []);

  // Remember recently shown banner ids so realtime redeliveries don't double up
  const shownBannerIds = useRef<Set<string>>(new Set());
  const markBannerShown = useCallback((id: string) => {
    shownBannerIds.current.add(id);
    setTimeout(() => {
      shownBannerIds.current.delete(id);
    }, 15000);
  }, []);

  // Push token registration + tapping a push opens the applicable screen
  useEffect(() => {
    if (profile?.id) {
      PushService.registerPushToken(profile.id);
    }
    const unlisten = PushService.listenForPushResponses((data) => {
      const type = data?.type;
      if (type === 'follow' || type === 'follow_back') {
        handleOpenSubScreen('connections');
      } else if (type === 'itinerary_added' || type === 'itinerary_reaction' || type === 'poll_result' || type === 'stay_added' || type === 'stay_reaction' || type === 'stay_comment') {
        handleTabChange(1);
      } else {
        handleOpenSubScreen('notifications');
      }
    });
    return () => unlisten();
  }, [profile?.id]);

  useEffect(() => {
    checkPendingInvites();

    if (profile?.id) {
      const channel = supabase
        .channel(`app:invites:${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          (payload: any) => {
            checkPendingInvites();
            const row = payload?.new;
            // Invite banners render their own Accept/Decline — skip the generic
            // banner for trip invites to avoid a doubled/redundant popup.
            if (payload.eventType === 'INSERT' && row?.id && row?.type !== 'trip_invite') {
              if (shownBannerIds.current.has(row.id)) return;
              // Only banner genuinely-new notifications. Realtime can replay the
              // most recent row when a channel connects (login / reconnect),
              // which would otherwise re-pop old "following you" banners.
              if (row.created_at) {
                const ageMs = Date.now() - new Date(row.created_at).getTime();
                if (ageMs > 15000) return;
              }
              markBannerShown(row.id);
              showBanner({
                id: row.id,
                title: row.title || 'Barkadash',
                message: row.message || '',
                type: row.type || 'system',
              });
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [profile?.id, checkPendingInvites]);

  const handleOpenInvitation = useCallback(() => {
    if (pendingInvites.length > 0) {
      setCurrentInvite(pendingInvites[0]);
    }
  }, [pendingInvites]);

  const handleBannerPress = useCallback(() => {
    const notif = bannerQueue[0];
    if (!notif) return;
    if (notif.type === 'follow' || notif.type === 'follow_back') {
      handleOpenSubScreen('connections');
    } else if (notif.type === 'itinerary_added' || notif.type === 'itinerary_reaction' || notif.type === 'poll_result' || notif.type === 'stay_added' || notif.type === 'stay_reaction' || notif.type === 'stay_comment') {
      handleTabChange(1);
    } else {
      handleOpenSubScreen('notifications');
    }
    closeBanner();
  }, [bannerQueue]);

  // Level 1 Sub-Screen Slide Animation (Profile, Settings, Terms, Connections)
  const rootSubAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  // Level 2 Sub-Screen Slide Animation (Edit Profile slides over Profile)
  const editProfileAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const handleOpenSubScreen = (screen: SubScreenType) => {
    if (screen === 'edit-profile') {
      setIsEditProfileOpen(true);
      editProfileAnim.setValue(SCREEN_WIDTH);
      Animated.spring(editProfileAnim, {
        toValue: 0,
        stiffness: 350,
        damping: 32,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    } else {
      setActiveSubScreen(screen);
      rootSubAnim.setValue(SCREEN_WIDTH);
      Animated.spring(rootSubAnim, {
        toValue: 0,
        stiffness: 350,
        damping: 32,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleBackRootSub = () => {
    Animated.timing(rootSubAnim, {
      toValue: SCREEN_WIDTH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setActiveSubScreen(null);
    });
  };

  const handleBackEditProfile = () => {
    Animated.timing(editProfileAnim, {
      toValue: SCREEN_WIDTH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsEditProfileOpen(false);
    });
  };

  const handleTabChange = (index: number) => {
    setActiveSubScreen(null);
    setIsEditProfileOpen(false);
    setCurrentTab(index);
    setIsNavExpanded(true);
  };

  const handleOpenCabinet = () => {
    setCabinetVisible(true);
  };

  const handleScrollDirection = (direction: 'up' | 'down') => {
    setIsNavExpanded(direction === 'up');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />
      <View style={styles.content}>
        {/* Main Tab Screens (Kept mounted in memory underneath animated sub-screens) */}
        <View style={styles.mainTabsWrapper}>
          <View style={[styles.tabScreenContainer, { display: currentTab === 0 ? 'flex' : 'none' }]}>
            <HomeScreen
              onNavigateToTab={handleTabChange}
              onNavigateToSubScreen={(screen) => handleOpenSubScreen(screen)}
              onScrollDirection={handleScrollDirection}
              onLogout={onLogout}
              onOpenCabinet={handleOpenCabinet}
            />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 1 ? 'flex' : 'none' }]}>
            <TripPlannerScreen
              onScrollDirection={handleScrollDirection}
              onOpenCabinet={handleOpenCabinet}
              pendingInvite={pendingInvites.length > 0 ? pendingInvites[0] : null}
              onViewInvitation={handleOpenInvitation}
            />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 2 ? 'flex' : 'none' }]}>
            <BarkadaRadarScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 3 ? 'flex' : 'none' }]}>
            <ExpenseLedgerScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 4 ? 'flex' : 'none' }]}>
            <ExploreScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
          </View>
        </View>

        {/* Level 1 Animated Sub-Screen Layer */}
        {activeSubScreen !== null && (
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: colors.paper,
                zIndex: 100,
                transform: [{ translateX: rootSubAnim }],
              },
            ]}
          >
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'profile' ? 'flex' : 'none' }]}>
              <ProfileScreen
                onBack={handleBackRootSub}
                onEditProfile={() => handleOpenSubScreen('edit-profile')}
                onNavigateToSettings={() => handleOpenSubScreen('settings')}
                onNavigateToTerms={() => handleOpenSubScreen('terms')}
                onNavigateToConnections={() => handleOpenSubScreen('connections')}
                onLogout={onLogout}
              />
            </View>
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'settings' ? 'flex' : 'none' }]}>
              <SettingsScreen
                onBack={handleBackRootSub}
                onNavigateToTerms={() => handleOpenSubScreen('terms')}
                onLogout={onLogout}
              />
            </View>
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'terms' ? 'flex' : 'none' }]}>
              <TermsPrivacyScreen
                onBack={handleBackRootSub}
              />
            </View>
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'connections' ? 'flex' : 'none' }]}>
              <SocialConnectionsScreen
                onBack={handleBackRootSub}
              />
            </View>
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'notifications' ? 'flex' : 'none' }]}>
              <NotificationsScreen
                onBack={handleBackRootSub}
                onNavigateToTab={handleTabChange}
                onNavigateToConnections={() => handleOpenSubScreen('connections')}
              />
            </View>
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'commitment' ? 'flex' : 'none' }]}>
              <CommitmentTrackerScreen
                onBack={handleBackRootSub}
              />
            </View>
            <View style={[styles.subScreenContainer, { display: activeSubScreen === 'checklist' ? 'flex' : 'none' }]}>
              <PackingChecklistScreen
                onBack={handleBackRootSub}
              />
            </View>

            {/* Level 2 Animated Sub-Screen Overlay: Edit Profile (Slides smoothly over ProfileScreen) */}
            {isEditProfileOpen && (
              <Animated.View
                style={[
                  StyleSheet.absoluteFillObject,
                  {
                    backgroundColor: colors.paper,
                    zIndex: 200,
                    transform: [{ translateX: editProfileAnim }],
                  },
                ]}
              >
                <EditProfileScreen
                  onBack={handleBackEditProfile}
                  onSaveSuccess={handleBackEditProfile}
                />
              </Animated.View>
            )}
          </Animated.View>
        )}
      </View>

      {/* Global Cabinet Drawer Overlay */}
      <CabinetDrawerModal
        visible={cabinetVisible}
        onClose={() => setCabinetVisible(false)}
        onNavigateToSubScreen={(screen) => handleOpenSubScreen(screen)}
        onLogout={onLogout}
      />

      {/* Pending Trip Invitation Banner — dynamic-island style top popup */}
      <TripInvitationBanner
        invite={currentInvite}
        onClose={() => setCurrentInvite(null)}
        onAccept={async (tripId) => {
          if (profile?.id) {
            await TripService.getInstance().acceptTripInviteDB(tripId, profile.id);
            NotificationService.createTripInviteResponseNotification(profile.id, tripId, 'accepted');
            setCurrentInvite(null);
            await checkPendingInvites();
            handleTabChange(1);
          }
        }}
        onDecline={async (tripId) => {
          if (profile?.id) {
            await TripService.getInstance().declineTripInviteDB(tripId, profile.id);
            NotificationService.createTripInviteResponseNotification(profile.id, tripId, 'declined');
            setCurrentInvite(null);
            await checkPendingInvites();
          }
        }}
      />

      {/* In-app notification banner (someone followed you, poll ended, etc.) */}
      <InAppNotificationBanner
        notification={bannerQueue[0] || null}
        onPress={handleBannerPress}
        onClose={closeBanner}
        topOffset={currentInvite ? 225 : 0}
      />

      {/* Floating Bottom Glassmorphism Navbar (Only show when on main tabs) */}
      {!activeSubScreen && !isEditProfileOpen ? (
        <AppBottomNav
          currentIndex={currentTab}
          onTabChange={handleTabChange}
          isExpanded={isNavExpanded}
          onExpand={() => setIsNavExpanded(true)}
        />
      ) : null}

      {/* Floating draggable AI Assist button — accessible everywhere */}
      {!aiChatVisible && (
        <FloatingAiButton onPress={() => setAiChatVisible(true)} />
      )}

      {/* AI Chat (ChatGPT-style, with history) */}
      <AiChatModal
        visible={aiChatVisible}
        onClose={() => setAiChatVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  mainTabsWrapper: {
    flex: 1,
  },
  tabScreenContainer: {
    flex: 1,
  },
  subScreenContainer: {
    flex: 1,
  },
});
