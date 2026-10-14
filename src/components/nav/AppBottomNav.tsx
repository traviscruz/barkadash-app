import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Pressable,
  Dimensions,
  Easing,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, MapPin, Receipt, Globe } from 'lucide-react-native';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';

import { useTheme } from '../../context/ThemeContext';

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
  { label: 'Explore', icon: Globe },
];

const CONTAINER_PADDING = 8;
const SPRING_BOUNCINESS = 2.2;
const SPRING_SPEED = 7.5;

export const AppBottomNav: React.FC<AppBottomNavProps> = ({
  currentIndex,
  onTabChange,
  isExpanded = true,
  onExpand,
}) => {
  const insets = useSafeAreaInsets();
  const safeBottom = insets.bottom;
  const { colors, isDark } = useTheme();

  // Solid theme colors for selected menu item
  const activeBgColor = isDark ? '#007AFF' : '#38BDF8';
  const activeContentColor = isDark ? '#FFFFFF' : '#08162B';
  const inactiveContentColor = colors.inkSoft;

  // Track outer bar width to calculate tab slot positions deterministically
  const initialWidth = Dimensions.get('window').width - 40;
  const [barWidth, setBarWidth] = useState<number>(initialWidth);

  // Calculate widths for active vs inactive tabs deterministically
  const innerWidth = Math.max(260, barWidth - CONTAINER_PADDING * 2);
  const inactiveWidth = Math.round((innerWidth - 100) / (TABS.length - 1));
  const activeWidth = innerWidth - (TABS.length - 1) * inactiveWidth;

  // Center offset when navbar is collapsed on scroll so items & pill are always centered
  const collapsedOffset = Math.round((innerWidth - TABS.length * inactiveWidth) / 2);

  const getPillLeftForIndex = useCallback(
    (index: number, expanded: boolean = isExpanded) => {
      const baseLeft = CONTAINER_PADDING + index * inactiveWidth;
      return expanded ? baseLeft : baseLeft + collapsedOffset;
    },
    [inactiveWidth, collapsedOffset, isExpanded]
  );

  // Animated values for sliding solid pill indicator
  const slideLeftAnim = useRef(new Animated.Value(getPillLeftForIndex(currentIndex))).current;
  const slideWidthAnim = useRef(new Animated.Value(activeWidth)).current;
  const ovalOpacityAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  // Animated progress for each tab (0 = inactive, 1 = active)
  const tabAnims = useRef(
    TABS.map((_, i) => new Animated.Value(i === currentIndex && isExpanded ? 1 : 0))
  ).current;

  // Dedicated entrance animations for active icon (fade up & move up)
  const iconEntranceAnims = useRef(
    TABS.map((_, i) => new Animated.Value(i === currentIndex ? 1 : 0))
  ).current;

  // Staggered typewriter letter-by-letter animations for each tab label
  const letterAnims = useRef(
    TABS.map((tab, tabIdx) =>
      tab.label.split('').map(
        (_, charIdx) => new Animated.Value(tabIdx === currentIndex ? 1 : 0)
      )
    )
  ).current;

  // Scale & Opacity for scroll expand/collapse
  const scaleAnim = useRef(new Animated.Value(isExpanded ? 1.0 : 0.90)).current;
  const opacityAnim = useRef(new Animated.Value(isExpanded ? 1.0 : 0.82)).current;

  // Spring animation whenever currentIndex or dimensions change
  useEffect(() => {
    const targetX = getPillLeftForIndex(currentIndex, isExpanded);
    const targetPillWidth = isExpanded ? activeWidth : inactiveWidth;

    const springConfig = {
      bounciness: SPRING_BOUNCINESS,
      speed: SPRING_SPEED,
      useNativeDriver: false,
    };

    Animated.parallel([
      Animated.spring(slideLeftAnim, {
        toValue: targetX,
        ...springConfig,
      }),
      Animated.spring(slideWidthAnim, {
        toValue: targetPillWidth,
        ...springConfig,
      }),
      ...TABS.map((_, idx) =>
        Animated.spring(tabAnims[idx], {
          toValue: idx === currentIndex && isExpanded ? 1 : 0,
          ...springConfig,
        })
      ),
    ]).start();

    // Trigger smooth icon fade-up and subtle lift
    iconEntranceAnims[currentIndex].setValue(0);
    Animated.spring(iconEntranceAnims[currentIndex], {
      toValue: 1,
      bounciness: 2.2,
      speed: 7.5,
      useNativeDriver: false,
    }).start();

    // Reset other tabs' letters & entrance values
    TABS.forEach((_, idx) => {
      if (idx !== currentIndex) {
        letterAnims[idx].forEach((anim) => anim.setValue(0));
        iconEntranceAnims[idx].setValue(0);
      }
    });

    // Silky staggered typography cascade rolling up
    letterAnims[currentIndex].forEach((anim) => anim.setValue(0));
    Animated.stagger(
      22,
      letterAnims[currentIndex].map((anim) =>
        Animated.spring(anim, {
          toValue: 1,
          bounciness: 2.2,
          speed: 8,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [currentIndex, isExpanded, activeWidth, inactiveWidth, getPillLeftForIndex]);

  // Animate scale, opacity and indicator visibility on scroll
  useEffect(() => {
    Animated.parallel([
      Animated.timing(ovalOpacityAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: isExpanded ? 1.0 : 0.90,
        bounciness: 2.5,
        speed: 8,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: isExpanded ? 1.0 : 0.82,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  }, [isExpanded]);

  // Tab switch handler
  const handleTabPress = (idx: number) => {
    if (!isExpanded && onExpand) {
      onExpand();
    }
    if (idx === currentIndex) {
      // Re-trigger icon fade/move up and typewriter cascade on active tab re-tap
      iconEntranceAnims[idx].setValue(0);
      Animated.spring(iconEntranceAnims[idx], {
        toValue: 1,
        bounciness: 2.5,
        speed: 8,
        useNativeDriver: false,
      }).start();

      letterAnims[idx].forEach((anim) => anim.setValue(0));
      Animated.stagger(
        20,
        letterAnims[idx].map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            bounciness: 2.2,
            speed: 8,
            useNativeDriver: false,
          })
        )
      ).start();
      return;
    }
    onTabChange(idx);
  };


  return (
    <>
      {/* Background Progressive Blur/Fade Up (Optical Diffusion) */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: safeBottom > 0 ? safeBottom + 110 : 130,
          zIndex: 40,
        }}
        pointerEvents="none"
      >
        <Svg height="100%" width="100%">
          <Defs>
            <SvgGradient id="fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.paper} stopOpacity="0" />
              <Stop offset="25%" stopColor={colors.paper} stopOpacity="0.22" />
              <Stop offset="48%" stopColor={colors.paper} stopOpacity="0.55" />
              <Stop offset="70%" stopColor={colors.paper} stopOpacity="0.82" />
              <Stop offset="88%" stopColor={colors.paper} stopOpacity="0.96" />
              <Stop offset="100%" stopColor={colors.paper} stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#fade)" />
        </Svg>
      </View>

      {/* Floating Bottom Solid Pill Navbar */}
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
          <Pressable
            onPress={() => {
              if (!isExpanded && onExpand) {
                onExpand();
              }
            }}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && Math.abs(w - barWidth) > 2) {
                setBarWidth(w);
              }
            }}
            style={{
              height: 62,
              borderRadius: 36,
              backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
              borderWidth: 1,
              borderColor: isDark ? '#2C2C2E' : '#EAE4D7',
              paddingHorizontal: CONTAINER_PADDING,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: isDark ? 0.35 : 0.08,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            {/* Solid Bouncy Sliding Active Indicator Pill */}
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 7,
                bottom: 7,
                left: slideLeftAnim,
                width: slideWidthAnim,
                borderRadius: 24,
                backgroundColor: activeBgColor,
                shadowColor: activeBgColor,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: isDark ? 0.40 : 0.28,
                shadowRadius: 8,
                elevation: 4,
                opacity: ovalOpacityAnim,
              }}
            />

            {/* Tab Items */}
            {TABS.map((tab, idx) => {
              const isActive = currentIndex === idx;
              const IconComponent = tab.icon;

              const itemWidth = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [inactiveWidth, activeWidth],
              });

              const labelOpacity = tabAnims[idx].interpolate({
                inputRange: [0, 0.4, 1],
                outputRange: [0, 0, 1],
              });

              const labelMaxWidth = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 72],
              });

              const labelMarginLeft = tabAnims[idx].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 6],
              });

              // Active Icon fade-up and move-up animation (gentle and smooth)
              const iconTranslateY = isActive
                ? iconEntranceAnims[idx].interpolate({
                    inputRange: [0, 1],
                    outputRange: [2.5, 0],
                  })
                : 0;

              const iconOpacity = isActive
                ? iconEntranceAnims[idx].interpolate({
                    inputRange: [0, 0.4, 1],
                    outputRange: [0.6, 0.92, 1],
                  })
                : 1;

              const iconScale = isActive
                ? iconEntranceAnims[idx].interpolate({
                    inputRange: [0, 0.6, 1],
                    outputRange: [0.97, 1.02, 1],
                  })
                : 1;

              return (
                <TouchableOpacity
                  key={tab.label}
                  activeOpacity={0.8}
                  onPress={() => handleTabPress(idx)}
                  style={{ zIndex: 2, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Animated.View
                    style={{
                      width: itemWidth,
                      height: 48,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 24,
                    }}
                  >
                    {/* Animated Icon (Fades up & Moves up) */}
                    <Animated.View
                      style={{
                        transform: [{ translateY: iconTranslateY }, { scale: iconScale }],
                        opacity: iconOpacity,
                      }}
                    >
                      <IconComponent
                        size={21}
                        color={isActive ? activeContentColor : inactiveContentColor}
                        strokeWidth={isActive ? 2.5 : 1.8}
                      />
                    </Animated.View>

                    {/* Animated Label with Staggered Typewriter Typography */}
                    <Animated.View
                      style={{
                        maxWidth: labelMaxWidth,
                        opacity: labelOpacity,
                        marginLeft: labelMarginLeft,
                        overflow: 'hidden',
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {tab.label.split('').map((char, charIdx) => {
                          const charAnim = letterAnims[idx][charIdx];
                          const charTranslateY = charAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [3, 0],
                          });
                          const charOpacity = charAnim.interpolate({
                            inputRange: [0, 0.35, 1],
                            outputRange: [0, 0.6, 1],
                          });

                          return (
                            <Animated.Text
                              key={charIdx}
                              style={{
                                color: activeContentColor,
                                fontWeight: '700',
                                fontSize: 12.5,
                                letterSpacing: -0.2,
                                opacity: charOpacity,
                                transform: [{ translateY: charTranslateY }],
                              }}
                            >
                              {char}
                            </Animated.Text>
                          );
                        })}
                      </View>
                    </Animated.View>
                  </Animated.View>
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
};

