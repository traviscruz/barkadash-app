import React, { useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, MapPin, Users, Heart, Award } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';

interface TripRecapScreenProps {
  /** When true, skips the SafeArea + top padding so it can be embedded inside HomeScreen tabs. */
  embedded?: boolean;
  onScrollDirection?: (direction: 'up' | 'down') => void;
}

// TODO: Implement in later sprint — single trip post-recap detail page.
export const TripRecapScreen: React.FC<TripRecapScreenProps> = ({ embedded, onScrollDirection }) => {
  const { colors } = useTheme();
  const { sp, fs, bottomNavOffset } = useResponsive();
  const lastOffsetY = useRef(0);

  const stats = [
    { label: 'Days', value: '3' },
    { label: 'Spots', value: '9' },
    { label: 'Photos', value: '128' },
    { label: 'Vibes', value: '100%' },
  ];

  const Wrapper: any = embedded ? View : SafeAreaView;

  return (
    <Wrapper style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          const currentY = e.nativeEvent.contentOffset.y;
          const delta = currentY - lastOffsetY.current;
          lastOffsetY.current = currentY;

          if (currentY < 15) {
            onScrollDirection?.('up');
          } else if (delta > 2) {
            onScrollDirection?.('down');
          } else if (delta < -2) {
            onScrollDirection?.('up');
          }
        }}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: sp.lg,
          paddingBottom: bottomNavOffset,
        }}
      >
        {/* Recap Hero */}
        <View style={styles.hero}>
          <View style={[styles.stamp, { borderColor: colors.redAccent }]}>
            <Award size={20} color={colors.redAccent} />
            <Text style={[styles.stampText, { color: colors.redAccent }]}>TRIP</Text>
          </View>
          <Text style={[styles.heroTitle, { color: colors.ink }]}>El Nido Escape</Text>
          <Text style={[styles.heroSub, { color: colors.inkSoft }]}>
            Your barkada's post-trip recap — coming soon.
          </Text>
        </View>

        {/* Scrapbook grid placeholder */}
        <View style={styles.scrapGrid}>
          {[
            { wide: true, label: 'Cover photo', icon: <Camera size={16} color="#FFFFFF" />, bg: colors.tealAccent },
            { wide: false, label: 'Day 1', icon: <MapPin size={14} color="#FFFFFF" />, bg: colors.orangeAccent },
            { wide: false, label: 'Day 2', icon: <MapPin size={14} color="#FFFFFF" />, bg: colors.sky },
          ].map((s, i) => (
            <View
              key={i}
              style={[
                styles.scrapPhoto,
                s.wide && styles.scrapPhotoWide,
                { backgroundColor: s.bg },
              ]}
            >
              {s.icon}
              <Text style={styles.scrapLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              <Text style={[styles.statValue, { color: colors.ink }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.inkSoft }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Quote placeholder */}
        <View style={styles.quoteRow}>
          <Heart size={14} color={colors.redAccent} fill={colors.redAccent} />
          <Text style={[styles.quoteText, { color: colors.inkSoft }]}>
            "tara na sa El Nido!!" — your barkada
          </Text>
          <Users size={14} color={colors.inkSoft} />
        </View>

        {/* TODO note */}
        <View style={[styles.todoNote, { backgroundColor: colors.paperDim }]}>
          <Text style={[styles.todoText, { color: colors.inkSoft }]}>
            Recap detail page — coming in a later sprint.
          </Text>
        </View>
      </ScrollView>
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 6,
  },
  stamp: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-6deg' }],
    marginBottom: 10,
    gap: 2,
  },
  stampText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroSub: {
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
  },
  scrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 10,
  },
  scrapPhoto: {
    width: '48%',
    height: 74,
    borderRadius: 8,
    padding: 8,
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  scrapPhotoWide: {
    width: '100%',
    height: 92,
    flexGrow: 0,
  },
  scrapLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 6,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  quoteText: {
    fontSize: 12,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  todoNote: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  todoText: {
    fontSize: 11,
    fontWeight: '600',
  },
});