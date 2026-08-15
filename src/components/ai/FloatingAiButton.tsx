import React, { useRef, useEffect } from 'react';
import {
  Animated,
  PanResponder,
  Dimensions,
  StyleSheet,
  Image,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const BUBBLE_SIZE = 60;

const aiMascotImg = require('../../../assets/mascot/ai_mascot.png');

// In-session memory of the last resting spot, so the bubble doesn't snap back
// to a default corner when the chat modal (which unmounts it) opens and closes.
let lastPos: { x: number; y: number } | null = null;
const POS_STORAGE_KEY = '@barkadash_ai_bubble_pos';

interface FloatingAiButtonProps {
  onPress: () => void;
}

export const FloatingAiButton: React.FC<FloatingAiButtonProps> = ({ onPress }) => {
  const { isDark } = useTheme();
  const { sp } = useResponsive();

  // NOTE: translate/scale/pulse MUST use the JS driver (useNativeDriver: false)
  // so we can call setValue() during drags — native-driven values get frozen
  // and throw "attempted to set the key `_value`" errors.
  const clampX = (x: number) => Math.max(sp.md, Math.min(SCREEN_W - BUBBLE_SIZE - sp.md, x));
  const clampY = (y: number) => Math.max(sp.md, Math.min(SCREEN_H - BUBBLE_SIZE - sp.md, y));

  const initial = lastPos ?? { x: SCREEN_W - BUBBLE_SIZE - sp.md, y: SCREEN_H * 0.55 };
  const translateX = useRef(new Animated.Value(clampX(initial.x))).current;
  const translateY = useRef(new Animated.Value(clampY(initial.y))).current;
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const dragOffset = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  // Restore the persisted position after a fresh app launch too.
  useEffect(() => {
    AsyncStorage.getItem(POS_STORAGE_KEY).then((raw) => {
      if (!raw) return;
      try {
        const saved = JSON.parse(raw);
        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
          lastPos = { x: saved.x, y: saved.y };
          translateX.setValue(clampX(saved.x));
          translateY.setValue(clampY(saved.y));
        }
      } catch {
        // ignore corrupt stored value
      }
    });
  }, [translateX, translateY]);

  // Gentle idle pulse so it feels alive
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.035,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        dragging.current = false;
        Animated.spring(scale, {
          toValue: 1.12,
          bounciness: 12,
          speed: 20,
          useNativeDriver: false,
        }).start();
        Animated.spring(glow, {
          toValue: 1,
          bounciness: 10,
          speed: 20,
          useNativeDriver: false,
        }).start();
        translateX.stopAnimation((v) => (dragOffset.current.x = v));
        translateY.stopAnimation((v) => (dragOffset.current.y = v));
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) + Math.abs(gesture.dy) > 8) {
          dragging.current = true;
        }
        translateX.setValue(dragOffset.current.x + gesture.dx);
        translateY.setValue(dragOffset.current.y + gesture.dy);
      },
      onPanResponderRelease: (_, gesture) => {
        const currentX = dragOffset.current.x + gesture.dx;
        const currentY = dragOffset.current.y + gesture.dy;

        Animated.spring(glow, {
          toValue: 0,
          bounciness: 10,
          speed: 20,
          useNativeDriver: false,
        }).start();

        if (!dragging.current) {
          // It was a tap — bounce and fire the press
          Animated.sequence([
            Animated.spring(scale, {
              toValue: 1.3,
              bounciness: 18,
              speed: 30,
              useNativeDriver: false,
            }),
            Animated.spring(scale, {
              toValue: 1,
              bounciness: 10,
              speed: 20,
              useNativeDriver: false,
            }),
          ]).start();
          onPress();
          return;
        }

        // Snap to the nearest horizontal edge with a bouncy settle
        const margin = sp.md;
        const snapLeft = currentX < SCREEN_W / 2 - BUBBLE_SIZE / 2;
        const targetX = snapLeft ? margin : SCREEN_W - BUBBLE_SIZE - margin;
        const clampedY = Math.max(margin, Math.min(SCREEN_H - BUBBLE_SIZE - margin, currentY));

        // Remember the resting spot so the bubble stays put across remounts
        // (chat open/close) and even after the app relaunches.
        lastPos = { x: targetX, y: clampedY };
        AsyncStorage.setItem(POS_STORAGE_KEY, JSON.stringify(lastPos)).catch(() => {});

        Animated.spring(translateX, {
          toValue: targetX,
          bounciness: 14,
          speed: 16,
          useNativeDriver: false,
        }).start();
        Animated.spring(translateY, {
          toValue: clampedY,
          bounciness: 12,
          speed: 16,
          useNativeDriver: false,
        }).start();
        Animated.spring(scale, {
          toValue: 1,
          bounciness: 12,
          speed: 20,
          useNativeDriver: false,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(scale, {
          toValue: 1,
          bounciness: 12,
          speed: 20,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        {
          transform: [
            { translateX },
            { translateY },
            { scale: Animated.multiply(pulse, scale) },
          ],
        },
      ]}
    >
      {/* Subtle outer shadow (no color tint) */}
      <Animated.View
        style={[
          styles.shadowRing,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.7],
            }),
            backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)',
          },
        ]}
      />
      {/* Frosted glass bubble */}
      <Animated.View
        style={[
          styles.glassBubble,
          {
            backgroundColor: isDark
              ? 'rgba(30, 45, 58, 0.6)'
              : 'rgba(255, 255, 255, 0.55)',
            borderColor: isDark
              ? 'rgba(255,255,255,0.35)'
              : 'rgba(255,255,255,0.9)',
          },
        ]}
      >
        {/* Inner frosted fill (keeps the mascot readable) */}
        <View
          style={[
            styles.innerCircle,
            {
              backgroundColor: isDark
                ? 'rgba(15, 30, 42, 0.35)'
                : 'rgba(255, 255, 255, 0.35)',
            },
          ]}
        >
          {/* Top glass highlight sweep */}
          <View
            style={[
              styles.glassHighlight,
              {
                backgroundColor: isDark
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(255,255,255,0.55)',
              },
            ]}
          />
          {/* Mascot rendered above the highlight */}
          <Image source={aiMascotImg} style={styles.mascot} resizeMode="contain" />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    zIndex: 999,
  },
  shadowRing: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: BUBBLE_SIZE + 6,
  },
  glassBubble: {
    flex: 1,
    borderRadius: BUBBLE_SIZE / 2,
    padding: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircle: {
    flex: 1,
    borderRadius: (BUBBLE_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // no overflow:hidden — that was clipping the mascot image
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    borderTopLeftRadius: (BUBBLE_SIZE - 8) / 2,
    borderTopRightRadius: (BUBBLE_SIZE - 8) / 2,
  },
  mascot: {
    position: 'absolute',
    width: BUBBLE_SIZE * 0.82,
    height: BUBBLE_SIZE * 0.82,
  },
});