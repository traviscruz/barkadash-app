import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { SlideUpModal } from '../common/SlideUpModal';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import {
  X,
  MapPin,
  CheckCircle2,
  Circle,
  Search,
  Calendar,
  Clock,
  Compass,
  Utensils,
  Camera,
  Car,
  Tag,
  DollarSign,
} from 'lucide-react-native';

interface AllPlacesVisitedModalProps {
  visible: boolean;
  onClose: () => void;
  tripTitle: string;
  places: Array<{
    id: string;
    title: string;
    category?: string;
    time?: string;
    dayNumber: number;
    location?: string;
    estCost?: string;
    isCompleted?: boolean;
    photoReference?: string;
  }>;
}

export const AllPlacesVisitedModal: React.FC<AllPlacesVisitedModalProps> = ({
  visible,
  onClose,
  tripTitle,
  places = [],
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilterIndex, setSelectedFilterIndex] = useState(0); // 0 = All, 1 = Day 1, 2 = Day 2...
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Extract distinct days
  const distinctDays = Array.from(new Set(places.map((p) => p.dayNumber || 1))).sort((a, b) => a - b);
  const filterTabs = ['ALL', ...distinctDays.map((d) => `DAY ${d}`)];

  const selectedDayNumber = selectedFilterIndex === 0 ? 'all' : distinctDays[selectedFilterIndex - 1];

  const filteredPlaces = places.filter((p) => {
    const matchesQuery =
      !searchQuery.trim() ||
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesDay = selectedDayNumber === 'all' || p.dayNumber === selectedDayNumber;
    return matchesQuery && matchesDay;
  });

  const completedCount = places.filter((p) => p.isCompleted).length;
  const totalCount = places.length;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedFilterIndex,
      useNativeDriver: true,
      bounciness: 7,
      speed: 13,
    }).start();
  }, [selectedFilterIndex, slideAnim]);

  // Group filtered places by day
  const daysMap = new Map<number, typeof places>();
  filteredPlaces.forEach((item) => {
    const day = item.dayNumber || 1;
    const list = daysMap.get(day) || [];
    list.push(item);
    daysMap.set(day, list);
  });
  const groupedDays = Array.from(daysMap.keys()).sort((a, b) => a - b);

  const getCategoryTheme = (category?: string) => {
    const cat = (category || '').toUpperCase();
    if (cat.includes('FOOD') || cat.includes('DINING') || cat.includes('EAT')) {
      return { icon: Utensils, color: '#F97316', bg: isDark ? 'rgba(249,115,22,0.15)' : '#FFEDD5', label: 'Dining' };
    }
    if (cat.includes('PHOTO') || cat.includes('SIGHT') || cat.includes('VIEW')) {
      return { icon: Camera, color: '#8B5CF6', bg: isDark ? 'rgba(139,92,246,0.15)' : '#EDE9FE', label: 'Sightseeing' };
    }
    if (cat.includes('TRAVEL') || cat.includes('TRANS') || cat.includes('RIDE')) {
      return { icon: Car, color: '#3B82F6', bg: isDark ? 'rgba(59,130,246,0.15)' : '#DBEAFE', label: 'Transit' };
    }
    return { icon: Compass, color: colors.tealDark, bg: isDark ? 'rgba(59,122,158,0.15)' : '#E0F2FE', label: category || 'Spot' };
  };

  const containerPadding = 40; // modal padding total
  const selectorWidth = windowWidth - containerPadding;
  const tabPillWidth = filterTabs.length > 0 ? (selectorWidth - 10) / Math.min(filterTabs.length, 5) : 80;

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.65}>
      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          height: Math.min(windowHeight * 0.90, 760),
          paddingHorizontal: 20,
          paddingBottom: Platform.OS === 'ios' ? 34 : 20,
          borderWidth: 1,
          borderColor: colors.cardBorder,
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: 'center', paddingVertical: 10 }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: isDark ? '#4B5563' : '#D1D5DB' }} />
        </View>

        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontSize: fs.lg, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
              Itinerary Places
            </Text>
            <Text style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
              {completedCount} of {totalCount} places visited in {tripTitle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: colors.subtleBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={colors.inkSoft} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            borderRadius: 14,
            paddingHorizontal: 12,
            marginBottom: 12,
          }}
        >
          <Search size={16} color={colors.inkSoft} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search spot name, location, or tag..."
            placeholderTextColor={colors.inkSoft}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 8,
              fontSize: fs.xs,
              color: colors.ink,
              fontWeight: '600',
            }}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color={colors.inkSoft} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Animated Bouncing Segmented Day Selector */}
        {filterTabs.length > 1 && (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.card,
              padding: 5,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              marginBottom: 14,
              position: 'relative',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <Animated.View
              style={{
                position: 'absolute',
                top: 5,
                bottom: 5,
                left: 5,
                width: tabPillWidth,
                backgroundColor: colors.tealDark,
                borderRadius: 100,
                transform: [
                  {
                    translateX: slideAnim.interpolate({
                      inputRange: filterTabs.map((_, i) => i),
                      outputRange: filterTabs.map((_, i) => tabPillWidth * i),
                    }),
                  },
                ],
              }}
            />

            {filterTabs.map((tabLabel, idx) => {
              const isSelected = selectedFilterIndex === idx;
              return (
                <TouchableOpacity
                  key={tabLabel}
                  onPress={() => setSelectedFilterIndex(idx)}
                  activeOpacity={0.8}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                    zIndex: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '900',
                      color: isSelected ? '#FFFFFF' : colors.inkSoft,
                      letterSpacing: 0.5,
                    }}
                  >
                    {tabLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Places Stream */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {groupedDays.length > 0 ? (
            <View style={{ gap: 16 }}>
              {groupedDays.map((dayNum) => {
                const daySpots = daysMap.get(dayNum) || [];
                const dayDone = daySpots.filter((s) => s.isCompleted).length;

                return (
                  <View key={dayNum}>
                    {/* Day Pill Section Header */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View
                          style={{
                            backgroundColor: colors.tealDark,
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                            borderRadius: 100,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>
                            Day {dayNum}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.inkSoft }}>
                          {daySpots.length} {daySpots.length === 1 ? 'place' : 'places'}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '800',
                          color: dayDone === daySpots.length ? '#059669' : colors.inkSoft,
                        }}
                      >
                        {dayDone} / {daySpots.length} visited
                      </Text>
                    </View>

                    {/* Spot Cards */}
                    <View style={{ gap: 9 }}>
                      {daySpots.map((item, idx) => {
                        const isDone = !!item.isCompleted;
                        const catTheme = getCategoryTheme(item.category);
                        const IconComp = catTheme.icon;

                        return (
                          <View
                            key={item.id || idx}
                            style={{
                              backgroundColor: colors.card,
                              borderRadius: 18,
                              borderWidth: 1,
                              borderColor: isDone
                                ? (isDark ? 'rgba(5,150,105,0.3)' : '#A7F3D0')
                                : colors.cardBorder,
                              padding: 14,
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.03,
                              shadowRadius: 6,
                              elevation: 1,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                              {/* Status Icon */}
                              <View
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 18,
                                  backgroundColor: isDone
                                    ? (isDark ? '#064E3B' : '#D1FAE5')
                                    : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginTop: 2,
                                }}
                              >
                                {isDone ? (
                                  <CheckCircle2 size={20} color="#059669" strokeWidth={2.4} />
                                ) : (
                                  <Circle size={18} color={colors.inkSoft} strokeWidth={2.2} />
                                )}
                              </View>

                              {/* Spot Info */}
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Text
                                    style={{
                                      fontSize: fs.sm,
                                      fontWeight: isDone ? '700' : '900',
                                      color: isDone ? colors.inkSoft : colors.ink,
                                      textDecorationLine: isDone ? 'line-through' : 'none',
                                      flex: 1,
                                      paddingRight: 6,
                                    }}
                                  >
                                    {item.title}
                                  </Text>

                                  {/* Visited / Category Tag */}
                                  {isDone ? (
                                    <View
                                      style={{
                                        backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        borderRadius: 100,
                                      }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '900', color: '#059669' }}>
                                        VISITED
                                      </Text>
                                    </View>
                                  ) : (
                                    <View
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 3,
                                        backgroundColor: catTheme.bg,
                                        paddingHorizontal: 8,
                                        paddingVertical: 3,
                                        borderRadius: 100,
                                      }}
                                    >
                                      <IconComp size={11} color={catTheme.color} />
                                      <Text style={{ fontSize: 10, fontWeight: '800', color: catTheme.color }}>
                                        {catTheme.label}
                                      </Text>
                                    </View>
                                  )}
                                </View>

                                {/* Meta Chips: Time, Location, Cost */}
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                  {item.time && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                      <Clock size={11} color={colors.inkSoft} />
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft }}>
                                        {item.time}
                                      </Text>
                                    </View>
                                  )}
                                  {item.location && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 }}>
                                      <MapPin size={11} color={colors.tealDark} />
                                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft }} numberOfLines={1}>
                                        {item.location}
                                      </Text>
                                    </View>
                                  )}
                                  {item.estCost && (
                                    <View
                                      style={{
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 6,
                                      }}
                                    >
                                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.tealDark }}>
                                        {item.estCost}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: colors.card,
                padding: 28,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 20,
              }}
            >
              <Compass size={32} color={colors.inkSoft} strokeWidth={1.8} />
              <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink, marginTop: 10 }}>
                No places found
              </Text>
              <Text style={{ fontSize: 11, color: colors.inkSoft, marginTop: 3 }}>
                Try adjusting your search or selected day filter
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
