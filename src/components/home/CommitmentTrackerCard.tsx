import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { Trip, MemberCommitment, getCommitmentTier } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { ChevronRight, Users, CheckCircle2 } from 'lucide-react-native';

interface CommitmentTrackerCardProps {
  trip: Trip | null;
  onPress: () => void;
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

export const CommitmentTrackerCard: React.FC<CommitmentTrackerCardProps> = ({
  trip,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const [commitments, setCommitments] = useState<MemberCommitment[]>([]);
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (trip?.id) {
      TripService.getInstance()
        .fetchTripCommitmentsDB(trip.id)
        .then((res) => setCommitments(res))
        .catch(() => {});
    }
  }, [trip?.id]);

  if (!trip) return null;

  const totalMembers = commitments.length;
  const avgPercent = totalMembers > 0
    ? Math.round(commitments.reduce((sum, c) => sum + (c.commitmentLevel ?? 100), 0) / totalMembers)
    : 100;
  const committedCount = commitments.filter((c) => (c.commitmentLevel ?? 100) >= 75).length;

  const myCommitment = commitments.find((c) => c.userId === profile?.id);
  const myLevel = myCommitment?.commitmentLevel ?? 100;
  const myTier = getCommitmentTier(myLevel);
  const groupTier = getCommitmentTier(avgPercent);

  // Mini circular meter calculation
  const size = 52;
  const strokeWidth = 5.5;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth - 4) / 2;
  const bgPath = describeArc(cx, cy, r, 0, 359.9);
  const sweepAngle = Math.max(1, (avgPercent / 100) * 359.9);
  const progressPath = describeArc(cx, cy, r, 0, sweepAngle);

  const handlePressIn = () => {
    Animated.spring(pressScale, { toValue: 0.98, friction: 6, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressScale }], marginBottom: 14 }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
            shadowColor: isDark ? '#000' : '#8A7F6A',
          },
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.topRow}>
          <View style={styles.tagWrap}>
            <View style={[styles.dotIndicator, { backgroundColor: groupTier.color }]} />
            <Text style={[styles.label, { color: colors.inkSoft }]}>TRIP COMMITMENT</Text>
          </View>

          <View style={[styles.pillBadge, { backgroundColor: groupTier.badgeBg }]}>
            <Text style={[styles.pillBadgeText, { color: groupTier.color }]}>
              {avgPercent}% Ready
            </Text>
          </View>
        </View>

        {/* Main Section: Left Text + Right Mini Radial Dial */}
        <View style={styles.mainRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.mainTitle, { color: colors.ink }]}>
              {avgPercent >= 75
                ? 'Barkada is Ready'
                : avgPercent >= 40
                ? 'Planning in Progress'
                : 'Commitment Needed'}
            </Text>
            <Text style={[styles.mainSubtitle, { color: colors.inkSoft }]}>
              {committedCount} of {totalMembers} members are locked in
            </Text>

            {/* Personal status highlight */}
            <View style={styles.personalStatusRow}>
              <Text style={[styles.personalLabel, { color: colors.inkSoft }]}>You:</Text>
              <View style={[styles.myMiniPill, { backgroundColor: myTier.badgeBg }]}>
                <Text style={[styles.myMiniPillText, { color: myTier.color }]}>
                  {myLevel}% {myTier.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Mini Radial SVG Dial */}
          <View style={styles.dialWrap}>
            <Svg width={size} height={size}>
              <Defs>
                <LinearGradient id="homeMeterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={groupTier.gradientStart} />
                  <Stop offset="100%" stopColor={groupTier.gradientEnd} />
                </LinearGradient>
              </Defs>
              <Path
                d={bgPath}
                stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Path
                d={progressPath}
                stroke="url(#homeMeterGrad)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
              />
            </Svg>
            <View style={styles.dialCenter}>
              <Text style={[styles.dialText, { color: colors.ink }]}>{avgPercent}</Text>
              <Text style={[styles.dialPercent, { color: colors.inkSoft }]}>%</Text>
            </View>
          </View>
        </View>

        {/* Bottom Avatar Row & View Button */}
        <View style={[styles.bottomRow, { borderTopColor: colors.cardBorder }]}>
          <View style={styles.avatarStack}>
            {commitments.slice(0, 4).map((member, index) => {
              const mTier = getCommitmentTier(member.commitmentLevel ?? 100);
              return (
                <View
                  key={member.userId}
                  style={[
                    styles.avatarWrap,
                    {
                      marginLeft: index === 0 ? 0 : -8,
                      zIndex: 10 - index,
                      borderColor: colors.card,
                      backgroundColor: member.avatarBg,
                    },
                  ]}
                >
                  {member.avatarUrl ? (
                    <Image source={{ uri: member.avatarUrl }} style={styles.avatarImg} />
                  ) : (
                    <Text style={styles.avatarText}>{member.initials}</Text>
                  )}
                </View>
              );
            })}
            {commitments.length > 4 && (
              <View
                style={[
                  styles.avatarWrap,
                  {
                    marginLeft: -8,
                    zIndex: 0,
                    borderColor: colors.card,
                    backgroundColor: colors.subtleBg,
                  },
                ]}
              >
                <Text style={[styles.moreText, { color: colors.inkSoft }]}>
                  +{commitments.length - 4}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.viewRosterBtn}>
            <Text style={[styles.viewRosterText, { color: colors.tealDark }]}>View Roster</Text>
            <ChevronRight size={14} color={colors.tealDark} strokeWidth={2.2} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pillBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  pillBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  mainTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  mainSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  personalStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  personalLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  myMiniPill: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 8,
  },
  myMiniPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  dialWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialCenter: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  dialText: {
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  dialPercent: {
    fontSize: 8.5,
    fontWeight: '700',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 26,
    height: 26,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
  },
  moreText: {
    fontSize: 9,
    fontWeight: '800',
  },
  viewRosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  viewRosterText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
