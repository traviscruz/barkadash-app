import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { getCommitmentTier } from '../../types/trip';
import { useTheme } from '../../context/ThemeContext';

interface CircularCommitmentDraggerProps {
  value: number; // 0 to 100
  onChange: (val: number) => void;
  onChangeEnd?: (val: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  size?: number;
  strokeWidth?: number;
  disabled?: boolean;
}

const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians),
  };
};

const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const arcSweep = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${arcSweep} 0 ${end.x} ${end.y}`;
};

export const CircularCommitmentDragger: React.FC<CircularCommitmentDraggerProps> = ({
  value,
  onChange,
  onChangeEnd,
  onDragStart,
  onDragEnd,
  size = 260,
  strokeWidth = 14,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();
  const [isDragging, setIsDragging] = useState(false);
  const [internalValue, setInternalValue] = useState(value);

  // Bounce animations
  const knobScaleAnim = useRef(new Animated.Value(1)).current;
  const numberBounceAnim = useRef(new Animated.Value(1)).current;
  const lastEmittedValue = useRef(value);
  const lastMilestone = useRef(Math.floor(value / 25));

  useEffect(() => {
    setInternalValue(value);
    lastEmittedValue.current = value;
  }, [value]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - strokeWidth - 28) / 2;

  const START_ANGLE = 225;
  const SWEEP_ANGLE = 270;

  const currentPercent = Math.max(0, Math.min(100, internalValue));
  const currentAngle = START_ANGLE + (currentPercent / 100) * SWEEP_ANGLE;
  const tierInfo = getCommitmentTier(currentPercent);

  // Trigger micro-bounce when passing 25%, 50%, 75%, 100%
  const triggerMilestoneBounce = (pct: number) => {
    const m = Math.floor(pct / 25);
    if (m !== lastMilestone.current) {
      lastMilestone.current = m;
      Animated.sequence([
        Animated.timing(numberBounceAnim, { toValue: 1.15, duration: 80, useNativeDriver: true }),
        Animated.spring(numberBounceAnim, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
      ]).start();
    }
  };

  const calculatePercentFromTouch = (touchX: number, touchY: number): number => {
    const dx = touchX - cx;
    const dy = touchY - cy;
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    if (angle >= 135 && angle <= 225) {
      const mid = 180;
      return angle >= mid ? 0 : 100;
    }

    let relativeAngle = angle - START_ANGLE;
    if (relativeAngle < 0) relativeAngle += 360;

    const pct = Math.round((relativeAngle / SWEEP_ANGLE) * 100);
    return Math.max(0, Math.min(100, pct));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        setIsDragging(true);
        onDragStart?.();

        Animated.spring(knobScaleAnim, {
          toValue: 1.35,
          friction: 4,
          tension: 200,
          useNativeDriver: true,
        }).start();

        const { locationX, locationY } = evt.nativeEvent;
        const newPct = calculatePercentFromTouch(locationX, locationY);
        setInternalValue(newPct);
        lastEmittedValue.current = newPct;
        onChange(newPct);
        triggerMilestoneBounce(newPct);
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const newPct = calculatePercentFromTouch(locationX, locationY);
        if (newPct !== lastEmittedValue.current) {
          setInternalValue(newPct);
          lastEmittedValue.current = newPct;
          onChange(newPct);
          triggerMilestoneBounce(newPct);
        }
      },

      onPanResponderRelease: () => {
        setIsDragging(false);
        onDragEnd?.();

        Animated.spring(knobScaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 160,
          useNativeDriver: true,
        }).start();

        // Final satisfying snap bounce
        Animated.sequence([
          Animated.timing(numberBounceAnim, { toValue: 1.1, duration: 80, useNativeDriver: true }),
          Animated.spring(numberBounceAnim, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
        ]).start();

        onChangeEnd?.(lastEmittedValue.current);
      },

      onPanResponderTerminate: () => {
        setIsDragging(false);
        onDragEnd?.();
        Animated.spring(knobScaleAnim, { toValue: 1, useNativeDriver: true }).start();
      },
    })
  ).current;

  // Background track path
  const bgPath = describeArc(cx, cy, radius, START_ANGLE, START_ANGLE + SWEEP_ANGLE);

  // Active progress path
  const progressPath = describeArc(
    cx,
    cy,
    radius,
    START_ANGLE,
    START_ANGLE + Math.max(1, (currentPercent / 100) * SWEEP_ANGLE)
  );

  // Knob position
  const knobPos = polarToCartesian(cx, cy, radius, currentAngle);

  return (
    <View style={styles.container}>
      <View
        style={[styles.svgWrapper, { width: size, height: size }]}
        {...panResponder.panHandlers}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="gradientTrack" x1="0%" y1="100%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={tierInfo.gradientStart} />
              <Stop offset="100%" stopColor={tierInfo.gradientEnd} />
            </LinearGradient>
          </Defs>

          {/* Minimal Background Inactive Track */}
          <Path
            d={bgPath}
            stroke={isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />

          {/* Glowing Active Progress Arc */}
          <Path
            d={progressPath}
            stroke="url(#gradientTrack)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />

          {/* Knob Handle */}
          <G>
            {/* Outer Glow Halo on Drag */}
            {isDragging && (
              <Circle
                cx={knobPos.x}
                cy={knobPos.y}
                r={strokeWidth / 2 + 10}
                fill={tierInfo.color}
                opacity={0.25}
              />
            )}
            {/* White Ring Base */}
            <Circle
              cx={knobPos.x}
              cy={knobPos.y}
              r={strokeWidth / 2 + 3}
              fill="#FFFFFF"
              stroke={tierInfo.color}
              strokeWidth={3}
            />
            {/* Knob Center Color Accent */}
            <Circle
              cx={knobPos.x}
              cy={knobPos.y}
              r={strokeWidth / 2 - 2}
              fill={tierInfo.color}
            />
          </G>
        </Svg>

        {/* Center Information with Spring Bounce */}
        <View style={styles.centerContent} pointerEvents="none">
          <Animated.View
            style={[
              styles.centerInner,
              { transform: [{ scale: numberBounceAnim }] },
            ]}
          >
            <View style={styles.percentRow}>
              <Text style={[styles.percentNumber, { color: colors.ink }]}>
                {currentPercent}
              </Text>
              <Text style={[styles.percentSign, { color: tierInfo.color }]}>%</Text>
            </View>

            <View style={[styles.tierPill, { backgroundColor: tierInfo.badgeBg }]}>
              <Text
                style={[
                  styles.tierLabel,
                  { color: tierInfo.color },
                ]}
                numberOfLines={1}
              >
                {tierInfo.label}
              </Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  svgWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 14,
  },
  centerInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  percentNumber: {
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: -1.8,
    lineHeight: 60,
  },
  percentSign: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    marginLeft: 2,
  },
  tierPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 4,
  },
  tierLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
});
