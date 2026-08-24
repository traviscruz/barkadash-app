import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Trip } from '../../types/trip';
import { TripMember } from '../trip/TripDetailsModal';
import { formatCurrency } from '../../utils/formatters';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { Calendar, Users, Clock, Sparkles } from 'lucide-react-native';

import { parseTripDateRange } from '../../utils/tripDates';

interface TripCardProps {
  trip: Trip;
  members?: TripMember[];
  onPress?: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, members, onPress }) => {
  const { sp, fs, isTablet } = useResponsive();
  const { colors } = useTheme();
  const avatarSize = isTablet ? 34 : 30;

  const acceptedMembers = (members || []).filter((m) => m.status === 'accepted');
  const displayMembers = acceptedMembers.length > 0 ? acceptedMembers : (members || []);
  const memberCount = displayMembers.length || trip.memberCount;
  const shownAvatars = displayMembers.slice(0, 5);
  const isLocked = trip.planningStage === 'READY' || trip.planningStage === 'ITINERARY_BUILDING';
  const parsedDates = parseTripDateRange(trip.dateRange);

  const lockedDateLabel = (() => {
    if (!parsedDates) return 'TBD';
    const start = parsedDates.start;
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const today = new Date();
    const todayDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const diff = Math.round((startDay - todayDay) / 86400000);
    if (diff > 0) return diff === 1 ? '1 Day Left' : `${diff} Days Left`;
    return `Day ${Math.abs(diff) + 1}`;
  })();

  const daysLeftLabel = isLocked
    ? lockedDateLabel
    : trip.daysLeft == null || trip.daysLeft < 0
      ? 'TBD'
      : `${trip.daysLeft} Days Left`;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, { marginBottom: sp.lg }]}>
      <TouchableOpacity
        activeOpacity={0.94}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View style={styles.cardContainer}>
          {/* Decorative Boarding Pass Notches */}
          <View style={[styles.notchLeft, { backgroundColor: colors.paper }]} />
          <View style={[styles.notchRight, { backgroundColor: colors.paper }]} />

          {/* Top Banner Header: BOARDING PASS */}
          <View style={styles.headerRow}>
            <View style={styles.tripTypeTag}>
              <Text style={styles.tripTypeText}>BOARDING PASS</Text>
            </View>

            {/* Redesigned 5 Days Left Badge */}
            <View style={styles.daysCountPill}>
              <Clock size={13} color="#0F2A3C" />
              <Text style={styles.daysCountText}>{daysLeftLabel}</Text>
            </View>
          </View>

          {/* Main Destination Title & Date Range */}
          <View style={styles.destinationBox}>
            <Text style={styles.destinationTitle}>{trip.title}</Text>
            <View style={styles.dateRow}>
              <Calendar size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.dateText}>{trip.dateRange}</Text>
            </View>
          </View>

          {/* Ticket Dashed Divider Line */}
          <View style={styles.dividerContainer}>
            <View style={styles.dashedLine} />
          </View>

          {/* Bottom Stats & Barkada Avatars */}
          <View style={styles.footerRow}>
            <View style={styles.budgetBox}>
              <Text style={styles.budgetLabel}>ESTIMATED BUDGET</Text>
              <Text style={styles.budgetValue}>{formatCurrency(trip.spentAmount)}</Text>
            </View>

            {/* Overlapping Member Avatars */}
            <View style={styles.avatarsWrapper}>
              <View style={styles.avatarLabelRow}>
                <Users size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.avatarGroupText}>
                  {memberCount} On Trip
                </Text>
              </View>
              <View style={styles.avatarsRow}>
                {shownAvatars.map((item, idx) => (
                  <View
                    key={item.id || idx}
                    style={[
                      styles.avatarCircle,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                        backgroundColor: item.avatarBg,
                        marginLeft: idx > 0 ? -9 : 0,
                      },
                    ]}
                  >
                    <Text style={styles.avatarText}>{item.initials}</Text>
                  </View>
                ))}
                {memberCount > shownAvatars.length && (
                  <View
                    style={[
                      styles.avatarCircle,
                      styles.avatarOverflow,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                        marginLeft: -9,
                        backgroundColor: '#F0A93E',
                      },
                    ]}
                  >
                    <Text style={styles.avatarText}>+{memberCount - shownAvatars.length}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#0F2A3C',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#0F2A3C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 7,
  },
  notchLeft: {
    position: 'absolute',
    left: -12,
    top: '48%',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    zIndex: 10,
  },
  notchRight: {
    position: 'absolute',
    right: -12,
    top: '48%',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FAF8F5',
    zIndex: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  tripTypeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tripTypeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.2,
  },
  daysCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5A65B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  daysCountText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0F2A3C',
    letterSpacing: 0.3,
  },
  destinationBox: {
    marginVertical: 4,
  },
  destinationTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },
  dividerContainer: {
    marginVertical: 16,
    alignItems: 'center',
  },
  dashedLine: {
    width: '96%',
    height: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderStyle: 'dashed',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  budgetBox: {
    justifyContent: 'center',
  },
  budgetLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.2,
  },
  budgetValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 3,
  },
  avatarsWrapper: {
    alignItems: 'flex-end',
  },
  avatarLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  avatarGroupText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
  },
  avatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    borderWidth: 2,
    borderColor: '#0F2A3C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOverflow: {
    opacity: 0.95,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
