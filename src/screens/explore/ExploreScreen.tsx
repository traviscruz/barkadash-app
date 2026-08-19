import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Menu, Ticket, BedDouble, Plane } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { FareTab } from './FareTab';
import { StaycationTab } from './StaycationTab';
import { FlightTab } from './FlightTab';

type ExploreTabKey = 'fare' | 'staycation' | 'flights';

const EXPLORE_TABS: { key: ExploreTabKey; label: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }[] = [
  { key: 'fare', label: 'Fare', icon: Ticket },
  { key: 'staycation', label: 'Staycation', icon: BedDouble },
  { key: 'flights', label: 'Flights', icon: Plane },
];

interface ExploreScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
}

export const ExploreScreen: React.FC<ExploreScreenProps> = ({ onScrollDirection, onOpenCabinet }) => {
  const { colors, isDark } = useTheme();
  const { sp } = useResponsive();

  const [activeTab, setActiveTab] = useState<ExploreTabKey>('fare');
  const [tabLayouts, setTabLayouts] = useState<{ [key: string]: { x: number; width: number } }>({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const widthAnim = useRef(new Animated.Value(0)).current;

  const activeLayout = tabLayouts[activeTab];

  // Blue for fares, green for staycations, violet for flights.
  const accentFor = (key: ExploreTabKey): string =>
    key === 'fare'
      ? (isDark ? '#38BDF8' : '#4F86C6')
      : key === 'staycation'
        ? (isDark ? '#34D399' : '#2A8563')
        : (isDark ? '#A78BFA' : '#7C3AED');

  const activeAccent = accentFor(activeTab);

  // Text/icon color on the filled accent pill: light theme uses darker accents
  // (white text reads best), dark theme uses lighter accents (dark text reads best).
  const activePillColor = isDark ? colors.paper : '#FFFFFF';

  // Bouncy spring slide (same feel as the trip planner day pill).
  useEffect(() => {
    if (activeLayout && activeLayout.width > 0) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: activeLayout.x,
          useNativeDriver: false,
          bounciness: 6,
          speed: 12,
        }),
        Animated.spring(widthAnim, {
          toValue: activeLayout.width,
          useNativeDriver: false,
          bounciness: 6,
          speed: 12,
        }),
      ]).start();
    }
  }, [activeTab, activeLayout?.x, activeLayout?.width]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Pinned header */}
      <View style={{ paddingHorizontal: sp.lg, paddingTop: sp.sm }}>
        {/* App Logo & Borderless Hamburger */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: sp.sm }}>
          <TouchableOpacity
            onPress={onOpenCabinet}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}
          >
            <Menu size={22} color={colors.ink} strokeWidth={2.2} />
          </TouchableOpacity>
          <BarkadashLogo height={32} />
        </View>

        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
          Explore
        </Text>
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: colors.inkSoft, marginTop: 2, marginBottom: sp.md, lineHeight: 18 }}>
          Browse fares and staycation spots for your next barkada trip.
        </Text>

        {/* Segmented pill tabs */}
        <View style={[styles.tabBar, { backgroundColor: colors.subtleBg }]}>
          {activeLayout && activeLayout.width > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.tabHighlight,
                {
                  left: slideAnim,
                  width: widthAnim,
                  backgroundColor: activeAccent,
                },
              ]}
            />
          )}
          {EXPLORE_TABS.map((tab) => {
            const isSelected = activeTab === tab.key;
            const IconComponent = tab.icon;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.8}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  setTabLayouts((prev) => {
                    const current = prev[tab.key];
                    if (current && Math.abs(current.x - x) < 2 && Math.abs(current.width - width) < 2) return prev;
                    return { ...prev, [tab.key]: { x, width } };
                  });
                }}
                style={styles.tabItem}
              >
                <IconComponent
                  size={15}
                  color={isSelected ? activePillColor : colors.inkSoft}
                  strokeWidth={isSelected ? 2.6 : 1.9}
                />
                <Text style={[styles.tabText, { color: isSelected ? activePillColor : colors.inkSoft }]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Active tab content */}
      {activeTab === 'fare' ? (
        <FareTab accentColor={activeAccent} onScrollDirection={onScrollDirection} />
      ) : activeTab === 'staycation' ? (
        <StaycationTab accentColor={activeAccent} onScrollDirection={onScrollDirection} />
      ) : (
        <FlightTab accentColor={activeAccent} onScrollDirection={onScrollDirection} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    position: 'relative',
    flexDirection: 'row',
    borderRadius: 26,
    padding: 4,
    marginBottom: 6,
  },
  tabHighlight: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 22,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 22,
    zIndex: 1,
  },
  tabText: {
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});