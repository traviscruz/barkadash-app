import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Trip } from '../../types/trip';
import { formatCurrency } from '../../utils/formatters';
import { useResponsive } from '../../utils/responsive';
import { Calendar, Users, Clock, Sparkles } from 'lucide-react-native';

interface TripCardProps {
  trip: Trip;
  onPress?: () => void;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onPress }) => {
  const { sp, fs, isTablet } = useResponsive();
  const avatarSize = isTablet ? 34 : 30;

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
          <View style={styles.notchLeft} />
          <View style={styles.notchRight} />

          {/* Top Banner Header: BOARDING PASS */}
          <View style={styles.headerRow}>
            <View style={styles.tripTypeTag}>
              <Text style={styles.tripTypeText}>BOARDING PASS</Text>
            </View>

            {/* Redesigned 5 Days Left Badge */}
            <View style={styles.daysCountPill}>
              <Clock size={13} color="#0F2A3C" />
              <Text style={styles.daysCountText}>{trip.daysLeft} Days Left</Text>
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
                <Text style={styles.avatarGroupText}>5 On Trip</Text>
              </View>
              <View style={styles.avatarsRow}>
                {[
                  { initial: 'T', bg: '#4F86C6' },
                  { initial: 'S', bg: '#F5A65B' },
                  { initial: 'H', bg: '#3B7A9E' },
                  { initial: 'A', bg: '#00C9A7' },
                  { initial: 'I', bg: '#E2604A' },
                ].map((item, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.avatarCircle,
                      {
                        width: avatarSize,
                        height: avatarSize,
                        borderRadius: avatarSize / 2,
                        backgroundColor: item.bg,
                        marginLeft: idx > 0 ? -9 : 0,
                      },
                    ]}
                  >
                    <Text style={styles.avatarText}>{item.initial}</Text>
                  </View>
                ))}
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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
});
