import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StatusBar,
  Animated,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Heart,
  MapPin,
  Calendar,
  Users,
  Globe,
  BedDouble,
  Compass,
  Star,
  Clock,
  Utensils,
  Car,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { useUser } from '../../context/UserContext';
import { TripRecapService } from '../../services/tripRecapService';
import { TripRecapData, TripRecapPost } from '../../types/tripRecap';
import { formatCurrency } from '../../utils/formatters';
import { ShimmerImage } from '../../components/common/ShimmerImage';
import { getPlacePhotoUrl } from '../../services/googlePlaces';

interface TripPostDetailScreenProps {
  post: TripRecapPost;
  onBack: () => void;
  onLikeToggled?: (tripId: string, isLiked: boolean, likesCount: number) => void;
}

export const TripPostDetailScreen: React.FC<TripPostDetailScreenProps> = ({
  post,
  onBack,
  onLikeToggled,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs, bottomNavOffset } = useResponsive();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, 14);

  const [loading, setLoading] = useState(true);
  const [recapData, setRecapData] = useState<TripRecapData | null>(null);
  const [isLiked, setIsLiked] = useState(post.isLikedByMe);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [liking, setLiking] = useState(false);

  // Main Tab State: 'Itinerary' | 'Stays' | 'Gallery' | 'Reviews'
  const [activeTab, setActiveTab] = useState<'Itinerary' | 'Stays' | 'Gallery' | 'Reviews'>('Itinerary');
  const [mainBarWidth, setMainBarWidth] = useState(0);
  
  // Day Filter Index State
  const [selectedDayFilterIndex, setSelectedDayFilterIndex] = useState(0); // 0 = All
  const [dayBarWidth, setDayBarWidth] = useState(0);

  // Animated Values
  const scrollY = useRef(new Animated.Value(0)).current;
  const mainTabSlideAnim = useRef(new Animated.Value(0)).current;
  const daySlideAnim = useRef(new Animated.Value(0)).current;

  // Header Background Fill Opacity on Scroll
  const headerBgOpacity = scrollY.interpolate({
    inputRange: [0, 110],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    setIsLiked(post.isLikedByMe);
    setLikesCount(post.likesCount);
    setLoading(true);

    TripRecapService.getInstance()
      .fetchTripRecap(post.tripId)
      .then((data) => {
        setRecapData(data);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [post.tripId, post.isLikedByMe, post.likesCount]);

  const handleToggleLike = async () => {
    if (liking || !profile?.id) return;
    setLiking(true);
    const prevLiked = isLiked;
    const prevCount = likesCount;

    // Optimistic UI update
    const nextLiked = !prevLiked;
    const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
    setIsLiked(nextLiked);
    setLikesCount(nextCount);

    const res = await TripRecapService.getInstance().toggleLikeTripPostDB(post.tripId, profile.id);
    if (res.success) {
      setIsLiked(res.isLiked);
      setLikesCount(res.newLikesCount);
      if (onLikeToggled) onLikeToggled(post.tripId, res.isLiked, res.newLikesCount);
    } else {
      // Rollback
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
    setLiking(false);
  };

  const placesVisited = recapData?.placesVisited || post.placesVisited || [];
  const stays = recapData?.stays || post.stays || [];
  const memories = recapData?.memories || post.memories || [];
  
  // Triple check photos: combine cover photo, recap photos, and memory photos
  const rawPhotos = [
    ...(post.coverPhotoUrl ? [post.coverPhotoUrl] : []),
    ...(recapData?.photos || post.photos || []),
    ...memories.flatMap((m) => m.photos || (m.photoUrl ? [m.photoUrl] : [])),
  ];
  const photos = Array.from(new Set(rawPhotos.filter(Boolean)));

  const distinctDays = Array.from(new Set(placesVisited.map((p) => p.dayNumber || 1))).sort((a, b) => a - b);
  const filterTabs = ['All', ...distinctDays.map((d) => `Day ${d}`)];
  const selectedDay = selectedDayFilterIndex === 0 ? 'all' : distinctDays[selectedDayFilterIndex - 1];

  const displayedPlaces = placesVisited.filter((p) =>
    selectedDay === 'all' ? true : p.dayNumber === selectedDay
  );

  const handleSelectMainTab = (tab: 'Itinerary' | 'Stays' | 'Gallery' | 'Reviews', index: number) => {
    setActiveTab(tab);
    Animated.spring(mainTabSlideAnim, {
      toValue: index,
      stiffness: 350,
      damping: 28,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  };

  const handleSelectDay = (index: number) => {
    setSelectedDayFilterIndex(index);
    Animated.spring(daySlideAnim, {
      toValue: index,
      stiffness: 350,
      damping: 28,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  };

  const coverUrl = post.coverPhotoUrl || photos[0];

  const getTagIcon = (tag?: string) => {
    const t = (tag || '').toUpperCase();
    if (t.includes('FOOD') || t.includes('MEAL') || t.includes('DINING')) return Utensils;
    if (t.includes('TRANSPORT') || t.includes('CAR') || t.includes('FLIGHT')) return Car;
    if (t.includes('MEETUP') || t.includes('STAY')) return BedDouble;
    return MapPin;
  };

  const heroHeight = 290 + topInset;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* 📌 STICKY TOP HEADER BAR */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        {/* Solid Theme Fill Color Header Background on Scroll */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              opacity: headerBgOpacity,
              backgroundColor: colors.paper,
              borderBottomWidth: 1,
              borderColor: colors.cardBorder,
              shadowColor: isDark ? '#000' : '#8A7F6A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.08,
              shadowRadius: 5,
              elevation: 3,
            },
          ]}
        />

        {/* Safe Zone Navigation Header Buttons Row */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: topInset + 6,
            paddingBottom: 10,
          }}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={onBack}
            activeOpacity={0.8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(0,0,0,0.45)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.25)',
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Like Button Pill */}
          <TouchableOpacity
            onPress={handleToggleLike}
            disabled={liking}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: isLiked ? 'rgba(239,68,68,0.95)' : 'rgba(0,0,0,0.45)',
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 100,
              borderWidth: 1,
              borderColor: isLiked ? '#EF4444' : 'rgba(255,255,255,0.25)',
            }}
          >
            <Heart
              size={16}
              color="#FFFFFF"
              fill={isLiked ? '#FFFFFF' : 'none'}
            />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: '#FFFFFF',
              }}
            >
              {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Page Scroll Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.tealDark} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 12 }}>
            Loading Trip Experience...
          </Text>
        </View>
      ) : (
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingBottom: bottomNavOffset + 40 }}
        >
          {/* 1. Full-Bleed Hero Cover Banner */}
          <View style={{ height: heroHeight, width: '100%', backgroundColor: colors.paperDim, position: 'relative' }}>
            {coverUrl ? (
              <ShimmerImage source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            ) : (
              <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paperDim }}>
                <Compass size={56} color={colors.tealDark} />
              </View>
            )}

            {/* Gradient Overlay for Text Readability */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.38)',
                justifyContent: 'flex-end',
                paddingHorizontal: 16,
                paddingBottom: 18,
              }}
            >
              {/* Host Avatar Badge & Destination */}
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.tealDark,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 2,
                      borderColor: '#FFF',
                      overflow: 'hidden',
                    }}
                  >
                    {post.hostAvatar ? (
                      <Image source={{ uri: post.hostAvatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{post.hostInitials}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{post.hostName}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                      <Globe size={11} color="#38BDF8" />
                      <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
                        {post.visibility === 'public' ? 'Public Post' : 'Friends Only'}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFF', letterSpacing: -0.4 }}>
                  {post.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MapPin size={13} color="#38BDF8" />
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#38BDF8' }}>
                      {post.destination}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>•</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Calendar size={12} color="rgba(255,255,255,0.8)" />
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' }}>
                      {post.dateRange}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* 2. Boarding Pass Summary Card (Group Spend & Member Stack) */}
          <View style={{ paddingHorizontal: sp.lg, paddingTop: sp.md }}>
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 22,
                padding: 16,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-around',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
                elevation: 2,
              }}
            >
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Group Total Spend
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.tealDark, marginTop: 2 }}>
                  {formatCurrency(post.totalSpent)}
                </Text>
              </View>

              <View style={{ width: 1, height: 32, backgroundColor: colors.cardBorder }} />

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Barkada Members
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: -6 }}>
                    {post.participantAvatars.slice(0, 3).map((p, idx) => (
                      <View
                        key={p.id || idx}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          backgroundColor: colors.tealDark,
                          borderWidth: 2,
                          borderColor: colors.card,
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {p.avatarUrl ? (
                          <Image source={{ uri: p.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '800' }}>{p.initials}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink }}>
                    {post.participantsCount}
                  </Text>
                </View>
              </View>
            </View>

            {/* Host Review / Summary Caption (Facebook Post Style) */}
            {post.summaryNote && (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: colors.card,
                  borderRadius: 20,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {post.hostAvatar ? (
                      <Image source={{ uri: post.hostAvatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>{post.hostInitials}</Text>
                    )}
                  </View>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>{post.hostName}</Text>
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.inkSoft }}>Host Post</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 13.5, fontWeight: '500', color: colors.ink, lineHeight: 20 }}>
                  {post.summaryNote}
                </Text>
              </View>
            )}
          </View>

          {/* 3. TRIP PLANNER TABS WITH BOUNCING SPRING INDICATOR */}
          <View style={{ marginTop: 20, paddingHorizontal: sp.lg }}>
            <View
              onLayout={(e) => setMainBarWidth(e.nativeEvent.layout.width)}
              style={{
                flexDirection: 'row',
                backgroundColor: colors.card,
                borderRadius: 100,
                padding: 4,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                marginBottom: 16,
                position: 'relative',
              }}
            >
              {mainBarWidth > 0 && (
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 4,
                    bottom: 4,
                    left: 4,
                    width: (mainBarWidth - 8) / 4,
                    backgroundColor: colors.tealDark,
                    borderRadius: 100,
                    transform: [
                      {
                        translateX: mainTabSlideAnim.interpolate({
                          inputRange: [0, 1, 2, 3],
                          outputRange: [0, 1, 2, 3].map(
                            (i) => ((mainBarWidth - 8) / 4) * i
                          ),
                        }),
                      },
                    ],
                  }}
                />
              )}
              {(['Itinerary', 'Stays', 'Gallery', 'Reviews'] as const).map((tab, idx) => {
                const isSelected = activeTab === tab;
                return (
                  <TouchableOpacity
                    key={tab}
                    onPress={() => handleSelectMainTab(tab, idx)}
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 100,
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: isSelected ? '#FFFFFF' : colors.inkSoft,
                      }}
                    >
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* TAB 1: ITINERARY WITH BOUNCING SPRING DAY SELECTOR */}
            {activeTab === 'Itinerary' && (
              <View>
                {/* 🔵 SEGMENTED BOUNCING SPRING DAY SELECTOR */}
                {filterTabs.length > 2 && (
                  <View
                    onLayout={(e) => setDayBarWidth(e.nativeEvent.layout.width)}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#F0F9FF',
                      padding: 4,
                      borderRadius: 100,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#BAE6FD',
                      marginBottom: 16,
                      position: 'relative',
                    }}
                  >
                    {dayBarWidth > 0 && (
                      <Animated.View
                        style={{
                          position: 'absolute',
                          top: 4,
                          bottom: 4,
                          left: 4,
                          width: (dayBarWidth - 8) / filterTabs.length,
                          backgroundColor: '#0284C7',
                          borderRadius: 100,
                          transform: [
                            {
                              translateX: daySlideAnim.interpolate({
                                inputRange: filterTabs.map((_, i) => i),
                                outputRange: filterTabs.map(
                                  (_, i) => ((dayBarWidth - 8) / filterTabs.length) * i
                                ),
                              }),
                            },
                          ],
                        }}
                      />
                    )}
                    {filterTabs.map((tabLabel, idx) => {
                      const isSelected = selectedDayFilterIndex === idx;
                      return (
                        <TouchableOpacity
                          key={`day-pill-${idx}`}
                          onPress={() => handleSelectDay(idx)}
                          activeOpacity={0.8}
                          style={{
                            flex: 1,
                            paddingVertical: 7,
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: isSelected ? '#FFFFFF' : isDark ? '#7DD3FC' : '#0369A1',
                            }}
                          >
                            {tabLabel}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Big Location Cards */}
                {displayedPlaces.length === 0 ? (
                  <View style={{ padding: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <MapPin size={36} color={colors.inkSoft} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 10 }}>
                      No itinerary places logged for this day filter.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 16 }}>
                    {displayedPlaces.map((place) => {
                      const placeImgUrl = place.photoReference ? getPlacePhotoUrl(place.photoReference, 800) : null;
                      const TagIcon = getTagIcon(place.category);

                      return (
                        <View
                          key={place.id}
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: 24,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 3 },
                            shadowOpacity: 0.06,
                            shadowRadius: 8,
                            elevation: 3,
                          }}
                        >
                          {/* BIGGER LOCATION IMAGE (Height: 200px) */}
                          <View style={{ height: 200, width: '100%', backgroundColor: colors.paperDim, position: 'relative' }}>
                            {placeImgUrl ? (
                              <ShimmerImage source={{ uri: placeImgUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB' }}>
                                <TagIcon size={44} color={colors.tealDark} />
                              </View>
                            )}

                            {/* Overlaid Badges */}
                            <View
                              style={{
                                position: 'absolute',
                                top: 12,
                                left: 12,
                                right: 12,
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                              }}
                            >
                              <View
                                style={{
                                  backgroundColor: colors.tealDark,
                                  paddingHorizontal: 12,
                                  paddingVertical: 5,
                                  borderRadius: 100,
                                }}
                              >
                                <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  Day {place.dayNumber}
                                </Text>
                              </View>

                              <View
                                style={{
                                  backgroundColor: 'rgba(0,0,0,0.65)',
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 100,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <TagIcon size={12} color="#FFF" />
                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#FFF', textTransform: 'uppercase' }}>
                                  {place.category || 'LOCATION'}
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Card Text Content */}
                          <View style={{ padding: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>
                              {place.title}
                            </Text>

                            {place.location && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                                <MapPin size={13} color={colors.tealDark} />
                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.inkSoft, flex: 1 }} numberOfLines={1}>
                                  {place.location}
                                </Text>
                              </View>
                            )}

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderColor: colors.cardBorder }}>
                              {place.time ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                  <Clock size={13} color={colors.tealDark} />
                                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>
                                    {place.time}
                                  </Text>
                                </View>
                              ) : <View />}

                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
                                <CheckCircle2 size={12} color="#10B981" />
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#10B981' }}>Visited</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: STAYS WITH BIGGER ACCOMMODATION IMAGES */}
            {activeTab === 'Stays' && (
              <View>
                {stays.length === 0 ? (
                  <View style={{ padding: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <BedDouble size={36} color={colors.inkSoft} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 10 }}>
                      No stays logged for this trip.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 16 }}>
                    {stays.map((stay) => {
                      const stayImgUrl = stay.photoReference ? getPlacePhotoUrl(stay.photoReference, 800) : null;
                      return (
                        <View
                          key={stay.id}
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: 24,
                            overflow: 'hidden',
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                          }}
                        >
                          <View style={{ height: 180, width: '100%', backgroundColor: colors.paperDim }}>
                            {stayImgUrl ? (
                              <ShimmerImage source={{ uri: stayImgUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                            ) : (
                              <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB' }}>
                                <BedDouble size={40} color={colors.tealDark} />
                              </View>
                            )}
                          </View>

                          <View style={{ padding: 16 }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink }}>
                              {stay.title}
                            </Text>
                            {stay.placeAddress && (
                              <Text style={{ fontSize: 12, fontWeight: '500', color: colors.inkSoft, marginTop: 3 }}>
                                {stay.placeAddress}
                              </Text>
                            )}
                            {stay.note && (
                              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.tealDark, marginTop: 6 }}>
                                {stay.note}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* TAB 3: HIGH RESOLUTION GALLERY GRID */}
            {activeTab === 'Gallery' && (
              <View>
                {photos.length === 0 ? (
                  <View style={{ padding: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={36} color={colors.inkSoft} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 10 }}>
                      No photo gallery uploaded for this trip.
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {photos.map((pUrl, idx) => (
                      <View
                        key={`photo-${idx}`}
                        style={{
                          width: '48.5%',
                          height: 160,
                          borderRadius: 20,
                          overflow: 'hidden',
                          backgroundColor: colors.paperDim,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 4,
                          elevation: 2,
                        }}
                      >
                        <ShimmerImage source={{ uri: pUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* TAB 4: REVIEWS & SQUAD MEMORIES (FACEBOOK STATUS POST STYLE) */}
            {activeTab === 'Reviews' && (
              <View>
                {memories.length === 0 ? (
                  <View style={{ padding: 28, alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={36} color={colors.inkSoft} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 10 }}>
                      No squad reviews shared yet.
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 14 }}>
                    {memories.map((mem) => (
                      <View
                        key={mem.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 22,
                          padding: 16,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.04,
                          shadowRadius: 6,
                          elevation: 2,
                        }}
                      >
                        {/* Facebook Post Header Bar */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                backgroundColor: colors.tealDark,
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {mem.userAvatar ? (
                                <Image source={{ uri: mem.userAvatar }} style={{ width: '100%', height: '100%' }} />
                              ) : (
                                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '800' }}>{mem.userInitials}</Text>
                              )}
                            </View>
                            <View>
                              <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink }}>
                                {mem.userName}
                              </Text>
                              <Text style={{ fontSize: 10.5, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                                Squad Review
                              </Text>
                            </View>
                          </View>

                          {mem.rating && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#FEF3C7', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 100 }}>
                              <Star size={12} color="#F59E0B" fill="#F59E0B" />
                              <Text style={{ fontSize: 11, fontWeight: '900', color: '#D97706' }}>{mem.rating}/5</Text>
                            </View>
                          )}
                        </View>

                        {/* Facebook Post Body Text */}
                        {mem.title && (
                          <Text style={{ fontSize: 13.5, fontWeight: '800', color: colors.tealDark, marginBottom: 4 }}>
                            {mem.title}
                          </Text>
                        )}
                        {mem.content && (
                          <Text style={{ fontSize: 13, fontWeight: '500', color: colors.ink, lineHeight: 19 }}>
                            {mem.content}
                          </Text>
                        )}

                        {/* Attached Memory Photo */}
                        {(mem.photoUrl || (mem.photos && mem.photos[0])) && (
                          <View style={{ marginTop: 12, height: 180, width: '100%', borderRadius: 16, overflow: 'hidden', backgroundColor: colors.paperDim }}>
                            <ShimmerImage source={{ uri: mem.photoUrl || mem.photos![0] }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </Animated.ScrollView>
      )}
    </View>
  );
};
