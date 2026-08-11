import React, { useState, useRef } from 'react';
import { View, StyleSheet, StatusBar, Animated, Easing, Dimensions } from 'react-native';
import { AppBottomNav } from './AppBottomNav';
import { HomeScreen } from '../../screens/home/HomeScreen';
import { TripPlannerScreen } from '../../screens/planner/TripPlannerScreen';
import { BarkadaRadarScreen } from '../../screens/radar/BarkadaRadarScreen';
import { ExpenseLedgerScreen } from '../../screens/expenses/ExpenseLedgerScreen';
import { TripFeedScreen } from '../../screens/feed/TripFeedScreen';
import { ProfileScreen } from '../../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../../screens/profile/EditProfileScreen';
import { SocialConnectionsScreen } from '../../screens/profile/SocialConnectionsScreen';
import { SettingsScreen } from '../../screens/settings/SettingsScreen';
import { TermsPrivacyScreen } from '../../screens/auth/TermsPrivacyScreen';
import { NotificationsScreen } from '../../screens/notifications/NotificationsScreen';
import { CabinetDrawerModal } from './CabinetDrawerModal';
import { useTheme } from '../../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type SubScreenType = 'profile' | 'edit-profile' | 'settings' | 'terms' | 'connections' | 'notifications' | null;

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
            <TripPlannerScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 2 ? 'flex' : 'none' }]}>
            <BarkadaRadarScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 3 ? 'flex' : 'none' }]}>
            <ExpenseLedgerScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
          </View>
          <View style={[styles.tabScreenContainer, { display: currentTab === 4 ? 'flex' : 'none' }]}>
            <TripFeedScreen onScrollDirection={handleScrollDirection} onOpenCabinet={handleOpenCabinet} />
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

      {/* Floating Bottom Glassmorphism Navbar (Only show when on main tabs) */}
      {!activeSubScreen && !isEditProfileOpen ? (
        <AppBottomNav
          currentIndex={currentTab}
          onTabChange={handleTabChange}
          isExpanded={isNavExpanded}
          onExpand={() => setIsNavExpanded(true)}
        />
      ) : null}
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
