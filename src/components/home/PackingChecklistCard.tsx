import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Trip } from '../../types/trip';
import { ChecklistService } from '../../services/checklistService';
import { ChecklistItem } from '../../types/checklistItem';
import { supabase } from '../../utils/supabase';
import { CheckSquare, ChevronRight } from 'lucide-react-native';

interface PackingChecklistCardProps {
  trip: Trip | null;
  onPress: () => void;
}

export const PackingChecklistCard: React.FC<PackingChecklistCardProps> = ({
  trip,
  onPress,
}) => {
  const { colors, isDark } = useTheme();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const pressScale = useRef(new Animated.Value(1)).current;

  const loadChecklist = useCallback(async () => {
    if (!trip?.id) return;
    try {
      const res = await ChecklistService.getInstance().fetchTripChecklistDB(trip.id);
      setItems(res);
    } catch (e) {
      console.warn('Error loading checklist for card:', e);
    }
  }, [trip?.id]);

  useEffect(() => {
    loadChecklist();

    if (!trip?.id) return;
    const channel = supabase
      .channel(`card_checklist:${trip.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_checklist_items',
          filter: `trip_id=eq.${trip.id}`,
        },
        () => {
          loadChecklist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trip?.id, loadChecklist]);

  if (!trip) return null;

  const total = items.length;
  const packed = items.filter((i) => i.isCompleted).length;
  const percent = total > 0 ? Math.round((packed / total) * 100) : 0;

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
        {/* Top Header */}
        <View style={styles.topRow}>
          <View style={styles.tagWrap}>
            <View style={[styles.iconBox, { backgroundColor: isDark ? colors.subtleBg : 'rgba(31,78,103,0.08)' }]}>
              <CheckSquare size={14} color={colors.tealDark} strokeWidth={2.2} />
            </View>
            <Text style={[styles.label, { color: colors.inkSoft }]}>PACKING LIST</Text>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: percent === 100 ? 'rgba(16,185,129,0.12)' : colors.subtleBg,
              },
            ]}
          >
            <Text
              style={[
                styles.badgeText,
                { color: percent === 100 ? '#10B981' : colors.ink },
              ]}
            >
              {total > 0 ? `${percent}% Packed` : 'Empty List'}
            </Text>
          </View>
        </View>

        {/* Content Row */}
        <View style={styles.mainRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.ink }]}>
              {total > 0 ? `${packed} of ${total} items packed` : 'Start your packing checklist'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
              {total > 0
                ? percent === 100
                  ? 'All items checked and ready to go'
                  : 'Tap to check off or generate suggestions'
                : 'Auto-suggest essentials for your trip'}
            </Text>
          </View>

          <View style={styles.chevronBox}>
            <ChevronRight size={16} color={colors.inkSoft} strokeWidth={2.2} />
          </View>
        </View>

        {/* Progress Bar */}
        {total > 0 && (
          <View style={[styles.progressTrack, { backgroundColor: colors.subtleBg }]}>
            <View
              style={[
                styles.progressBar,
                {
                  width: `${percent}%`,
                  backgroundColor: percent === 100 ? '#10B981' : colors.tealDark,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
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
    marginBottom: 10,
  },
  tagWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  badge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2.5,
  },
});
