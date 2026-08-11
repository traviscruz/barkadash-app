import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
  UIManager,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, MapPin, Receipt, Grid } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';

import { useTheme } from '../../context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AppBottomNavProps {
  currentIndex: number;
  onTabChange: (index: number) => void;
  isExpanded?: boolean;
  onExpand?: () => void;
}

const TABS = [
  { label: 'Home', icon: Home },
  { label: 'Plan', icon: Compass },
  { label: 'Radar', icon: MapPin },
  { label: 'Ledger', icon: Receipt },
  { label: 'Recap', icon: Grid },
];

export const AppBottomNav: React.FC<AppBottomNavProps> = ({
  currentIndex,
  onTabChange,
  isExpanded = true,
  onExpand,
}) => {
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom;
  const { colors, isDark } = useTheme();

  // Track dynamic layout x & width for each tab to fit the oval highlight perfectly
  const [tabLayouts, setTabLayouts] = useState<{ [key: number]: { x: number; width: number } }>({});

  const slideLeftAnim = useRef(new Animated.Value(0)).current;
  const slideWidthAnim = useRef(new Animated.Value(0)).current;
  const ovalOpacityAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const containerPaddingAnim = useRef(new Animated.Value(isExpanded ? 10 : 18)).current;

  // Animation values for each tab label's expansion & fade off
  const tabAnims = useRef(
    TABS.map((_, i) => new Animated.Value(i === currentIndex && isExpanded ? 1 : 0))
  ).current;

  // Scale & Opacity for scroll expand/collapse
  const scaleAnim = useRef(new Animated.Value(isExpanded ? 1.0 : 0.88)).current;
  const opacityAnim = useRef(new Animated.Value(isExpanded ? 1.0 : 0.80)).current;

  const activeX = tabLayouts[currentIndex]?.x;
  const activeWidth = tabLayouts[currentIndex]?.width;

  // Smooth sliding highlight oval centered perfectly around active tab
  useEffect(() => {
    if (activeX !== undefined && activeWidth !== undefined && activeWidth > 0) {
      Animated.parallel([
        Animated.timing(slideLeftAnim, {
          toValue: activeX,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(slideWidthAnim, {
          toValue: activeWidth,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [currentIndex, activeX, activeWidth]);

  // Animate oval opacity, container padding, scale and bar opacity on scroll
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ovalOpacityAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(containerPaddingAnim, {
        toValue: isExpanded ? 10 : 18,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(scaleAnim, {
        toValue: isExpanded ? 1.0 : 0.88,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isExpanded ? 1.0 : 0.80,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpanded]);

  // Animate fade in / fade off of nav bar names (labels) for all tabs smoothly
  useEffect(() => {
    TABS.forEach((_, idx) => {
      const shouldBeExpanded = idx === currentIndex && isExpanded;
      Animated.timing(tabAnims[idx], {
        toValue: shouldBeExpanded ? 1 : 0,
        duration: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [currentIndex, isExpanded]);

  // Tab switch handler
  const handleTabPress = (idx: number) => {
    if (!isExpanded && onExpand) {
      onExpand();
    }
    onTabChange(idx);
  };

  const activeColor = isDark ? '#38BDF8' : '#007AFF';

  return (
    <>
      {/* Background Gradient Fade (height 160) */}
      <View
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 160, zIndex: 40 }}
        pointerEvents="none"
      >
        <Svg height="100%" width="100%">
          <Defs>
            <SvgGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.paper} stopOpacity="0" />
              <Stop offset="1" stopColor={colors.paper} stopOpacity="0.9" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>

      {/* Floating Light/Dark Glassmorphism Pill */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: safeBottom > 0 ? safeBottom : 18,
          zIndex: 50,
          alignItems: 'center',
        }}
      >
        <Animated.View
          style={{
            width: '100%',
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          }}
        >
          <AnimatedPressable
            onPress={() => {
              if (!isExpanded && onExpand) {
                onExpand();
              }
            }}
            style={{
              height: 62,
              borderRadius: 50,
              backgroundColor: colors.pillBg,
              borderWidth: 1,
              borderColor: colors.pillBorder,
              paddingHorizontal: containerPaddingAnim,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.35 : 0.10,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {/* Perfectly Fitted Responsive Sliding Active Highlight Oval */}
            {tabLayouts[currentIndex] && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 7,
                  bottom: 7,
                  left: slideLeftAnim,
                  width: slideWidthAnim,
                  borderRadius: 24,
                  backgroundColor: isDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(0, 122, 255, 0.13)',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(0, 122, 255, 0.22)',
                  opacity: ovalOpacityAnim,
                }}
              />
            )}

            {/* Tab Items */}
            {TABS.map((tab, idx) => {
              const isActive = currentIndex === idx;
              const IconComponent = tab.icon;

              const labelOpacity = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              });

              const labelMaxWidth = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 80],
              });

              const labelMarginLeft = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 6],
              });

              const labelScale = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              });

              const itemPaddingHorizontal = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [8, 12],
              });

              return (
                <AnimatedTouchableOpacity
                  key={tab.label}
                  activeOpacity={0.8}
                  onPress={() => handleTabPress(idx)}
                  onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout;
                    setTabLayouts((prev) => {
                      const current = prev[idx];
                      if (current && Math.abs(current.x - x) < 2 && Math.abs(current.width - width) < 2) return prev;
                      return { ...prev, [idx]: { x, width } };
                    });
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: itemPaddingHorizontal,
                    paddingVertical: 9,
                    borderRadius: 24,
                    zIndex: 2,
                  }}
                >
                  <IconComponent
                    size={21}
                    color={isActive ? activeColor : colors.inkSoft}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  <Animated.View
                    style={{
                      maxWidth: labelMaxWidth,
                      opacity: labelOpacity,
                      marginLeft: labelMarginLeft,
                      transform: [{ scale: labelScale }],
                      overflow: 'hidden',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        color: activeColor,
                        fontWeight: '700',
                        fontSize: 12.5,
                        letterSpacing: -0.2,
                      }}
                    >
                      {tab.label}
                    </Text>
                  </Animated.View>
                </AnimatedTouchableOpacity>
              );
            })}
          </AnimatedPressable>
        </Animated.View>
      </View>
    </>
  );
};








