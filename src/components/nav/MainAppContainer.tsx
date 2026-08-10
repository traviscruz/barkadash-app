import React, { useState } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import { AppBottomNav } from './AppBottomNav';
import { HomeScreen } from '../../screens/home/HomeScreen';
import { TripPlannerScreen } from '../../screens/planner/TripPlannerScreen';
import { BarkadaRadarScreen } from '../../screens/radar/BarkadaRadarScreen';
import { ExpenseLedgerScreen } from '../../screens/expenses/ExpenseLedgerScreen';
import { TripFeedScreen } from '../../screens/feed/TripFeedScreen';
import { ProfileScreen } from '../../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../../screens/profile/EditProfileScreen';
import { SettingsScreen } from '../../screens/settings/SettingsScreen';
import { TermsPrivacyScreen } from '../../screens/auth/TermsPrivacyScreen';
import { CabinetDrawerModal } from './CabinetDrawerModal';
import { useTheme } from '../../context/ThemeContext';

export type SubScreenType = 'profile' | 'edit-profile' | 'settings' | 'terms' | null;

interface MainAppContainerProps {
  onLogout?: () => void;
}

export const MainAppContainer: React.FC<MainAppContainerProps> = ({ onLogout }) => {
  const [currentTab, setCurrentTab] = useState(0);
  const [activeSubScreen, setActiveSubScreen] = useState<SubScreenType>(null);
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [cabinetVisible, setCabinetVisible] = useState(false);
  const { colors } = useTheme();

  const handleTabChange = (index: number) => {
    setActiveSubScreen(null);
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
        {/* Main Tab Screens (Always kept mounted in memory to eliminate back button flicker/glitch) */}
        <View style={[styles.mainTabsWrapper, { display: activeSubScreen === null ? 'flex' : 'none' }]}>
          <View style={[styles.tabScreenContainer, { display: currentTab === 0 ? 'flex' : 'none' }]}>
            <HomeScreen
              onNavigateToTab={handleTabChange}
              onNavigateToSubScreen={(screen) => setActiveSubScreen(screen)}
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

        {/* Sub Screens (Kept mounted for zero-lag display toggling like nav bar tabs) */}
        <View style={[styles.subScreenContainer, { display: activeSubScreen === 'profile' ? 'flex' : 'none' }]}>
          <ProfileScreen
            onBack={() => setActiveSubScreen(null)}
            onEditProfile={() => setActiveSubScreen('edit-profile')}
            onNavigateToSettings={() => setActiveSubScreen('settings')}
            onNavigateToTerms={() => setActiveSubScreen('terms')}
            onLogout={onLogout}
          />
        </View>
        <View style={[styles.subScreenContainer, { display: activeSubScreen === 'edit-profile' ? 'flex' : 'none' }]}>
          <EditProfileScreen
            onBack={() => setActiveSubScreen('profile')}
            onSaveSuccess={() => setActiveSubScreen('profile')}
          />
        </View>
        <View style={[styles.subScreenContainer, { display: activeSubScreen === 'settings' ? 'flex' : 'none' }]}>
          <SettingsScreen
            onBack={() => setActiveSubScreen(null)}
            onNavigateToTerms={() => setActiveSubScreen('terms')}
            onLogout={onLogout}
          />
        </View>
        <View style={[styles.subScreenContainer, { display: activeSubScreen === 'terms' ? 'flex' : 'none' }]}>
          <TermsPrivacyScreen
            onBack={() => setActiveSubScreen(null)}
          />
        </View>
      </View>

      {/* Global Cabinet Drawer Overlay */}
      <CabinetDrawerModal
        visible={cabinetVisible}
        onClose={() => setCabinetVisible(false)}
        onNavigateToSubScreen={(screen) => setActiveSubScreen(screen)}
        onLogout={onLogout}
      />

      {/* Floating Bottom Glassmorphism Navbar (Only show when on main tabs) */}
      {!activeSubScreen ? (
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
