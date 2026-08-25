import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import {
  X,
  Heart,
  MapPin,
  Calendar,
  Users,
  DollarSign,
  Globe,
  Lock,
  BedDouble,
  Compass,
  Star,
  CheckCircle2,
  Camera,
  MessageSquare,
  Clock,
  Utensils,
  Car,
  Layers,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { useUser } from '../../context/UserContext';
import { TripRecapService } from '../../services/tripRecapService';
import { TripRecapData, TripRecapPost } from '../../types/tripRecap';
import { formatCurrency } from '../../utils/formatters';
import { ShimmerImage } from '../../components/common/ShimmerImage';
import { getPlacePhotoUrl } from '../../services/googlePlaces';

interface TripPostDetailModalProps {
  visible: boolean;
  post: TripRecapPost | null;
  onClose: () => void;
  onLikeToggled?: (tripId: string, isLiked: boolean, likesCount: number) => void;
}

export const TripPostDetailModal: React.FC<TripPostDetailModalProps> = ({
  visible,
  post,
  onClose,
  onLikeToggled,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs } = useResponsive();
  const { width: windowWidth } = useWindowDimensions();

  const [loading, setLoading] = useState(true);
  const [recapData, setRecapData] = useState<TripRecapData | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [liking, setLiking] = useState(false);
  const [selectedDayFilterIndex, setSelectedDayFilterIndex] = useState(0); // 0 = ALL

  useEffect(() => {
    if (visible && post) {
      setIsLiked(post.isLikedByMe);
      setLikesCount(post.likesCount);
      setSelectedDayFilterIndex(0);
      setLoading(true);

      TripRecapService.getInstance()
        .fetchTripRecap(post.tripId)
        .then((data) => {
          setRecapData(data);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [visible, post?.tripId]);

  if (!post) return null;

  const handleToggleLike = async () => {
    if (liking || !profile?.id) return;
    setLiking(true);
    const prevLiked = isLiked;
    const prevCount = likesCount;

    // Optimistic UI
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
  const distinctDays = Array.from(new Set(placesVisited.map((p) => p.dayNumber || 1))).sort((a, b) => a - b);
  const filterTabs = ['ALL', ...distinctDays.map((d) => `Day ${d}`)];
  const selectedDay = selectedDayFilterIndex === 0 ? 'all' : distinctDays[selectedDayFilterIndex - 1];

  const displayedPlaces = placesVisited.filter((p) =>
    selectedDay === 'all' ? true : p.dayNumber === selectedDay
  );

  const coverUrl = post.coverPhotoUrl || recapData?.photos[0];

  const getTagIcon = (tag?: string) => {
    const t = (tag || '').toUpperCase();
    if (t.includes('FOOD') || t.includes('MEAL') || t.includes('DINING')) return Utensils;
    if (t.includes('TRANSPORT') || t.includes('CAR') || t.includes('FLIGHT')) return Car;
    if (t.includes('MEETUP') || t.includes('STAY')) return BedDouble;
    return MapPin;
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            height: '93%',
            backgroundColor: colors.paper,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            overflow: 'hidden',
          }}
        >
          {/* Header Bar */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 14,
              backgroundColor: colors.card,
              borderBottomWidth: 1,
              borderColor: colors.cardBorder,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Host info */}
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
                {post.hostAvatar ? (
                  <Image source={{ uri: post.hostAvatar }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>{post.hostInitials}</Text>
                )}
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>{post.hostName}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                  <Globe size={11} color={colors.tealDark} />
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.inkSoft }}>
                    {post.visibility === 'public' ? 'Public Post' : 'Friends Only'}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.subtleBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} color={colors.ink} />
            </TouchableOpacity>
          </View>

          {/* Content Body */}
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color={colors.tealDark} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 12 }}>
                Loading Trip Details...
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50 }}>
              {/* Hero Image Header */}
              <View style={{ height: 220, width: '100%', backgroundColor: colors.paperDim, position: 'relative' }}>
                {coverUrl ? (
                  <ShimmerImage source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
                    <Compass size={48} color={colors.tealDark} />
                  </View>
                )}

                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.35)',
                    justifyContent: 'space-between',
                    padding: 18,
                  }}
                >
                  {/* Destination Tag */}
                  <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MapPin size={12} color="#FFF" />
                    <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{post.destination}</Text>
                  </View>

                  {/* Title & Dates */}
                  <View>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFF', letterSpacing: -0.4 }}>
                      {post.title}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                      {post.dateRange}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Bar (Like Button & Count) */}
              <View
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 12,
                  backgroundColor: colors.card,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottomWidth: 1,
                  borderColor: colors.cardBorder,
                }}
              >
                <TouchableOpacity
                  onPress={handleToggleLike}
                  disabled={liking}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    backgroundColor: isLiked ? (isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2') : colors.subtleBg,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 100,
                    borderWidth: 1,
                    borderColor: isLiked ? '#EF4444' : colors.cardBorder,
                  }}
                >
                  <Heart size={18} color="#EF4444" fill={isLiked ? '#EF4444' : 'none'} />
                  <Text style={{ fontSize: 13, fontWeight: '900', color: isLiked ? '#DC2626' : colors.ink }}>
                    {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: -6 }}>
                  {post.participantAvatars.slice(0, 4).map((p, idx) => (
                    <View
                      key={p.id || idx}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
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
                        <Text style={{ color: '#FFF', fontSize: 10, fontWeight: '800' }}>{p.initials}</Text>
                      )}
                    </View>
                  ))}
                </View>
              </View>

              {/* Main Info Body */}
              <View style={{ padding: 20, gap: 20 }}>
                {/* 1. Group Total Spend Stats Card */}
                <View
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 20,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                  }}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase' }}>
                      Group Total Spend
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: colors.tealDark, marginTop: 2 }}>
                      {formatCurrency(post.totalSpent)}
                    </Text>
                  </View>

                  <View style={{ width: 1, height: 30, backgroundColor: colors.cardBorder }} />

                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase' }}>
                      Barkada Members
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginTop: 2 }}>
                      {post.participantsCount} Members
                    </Text>
                  </View>
                </View>

                {/* 2. Host Summary Note */}
                {post.summaryNote && (
                  <View
                    style={{
                      backgroundColor: isDark ? 'rgba(59,122,158,0.12)' : '#F0F9FF',
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: isDark ? 'rgba(59,122,158,0.3)' : '#BAE6FD',
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '900', color: colors.tealDark, textTransform: 'uppercase', marginBottom: 6 }}>
                      Host Review & Notes
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.ink, lineHeight: 19 }}>
                      "{post.summaryNote}"
                    </Text>
                  </View>
                )}

                {/* 3. TRIP PLANNER ITINERARY SECTION */}
                {placesVisited.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 10 }}>
                      Itinerary & Visited Places ({placesVisited.length})
                    </Text>

                    {/* Day Filter Pills (from Trip Planner) */}
                    {filterTabs.length > 2 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                        {filterTabs.map((tabLabel, idx) => {
                          const isSelected = selectedDayFilterIndex === idx;
                          return (
                            <TouchableOpacity
                              key={`day-tab-${idx}`}
                              onPress={() => setSelectedDayFilterIndex(idx)}
                              activeOpacity={0.8}
                              style={{
                                paddingVertical: 6,
                                paddingHorizontal: 14,
                                borderRadius: 100,
                                backgroundColor: isSelected ? colors.tealDark : colors.subtleBg,
                                borderWidth: 1,
                                borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: '800',
                                  color: isSelected ? '#FFFFFF' : colors.inkSoft,
                                }}
                              >
                                {tabLabel}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    )}

                    {/* Detailed Place Cards (with Google Places Images) */}
                    <View style={{ gap: 12 }}>
                      {displayedPlaces.map((place) => {
                        const placeImgUrl = place.photoReference ? getPlacePhotoUrl(place.photoReference, 600) : null;
                        const TagIcon = getTagIcon(place.category);

                        return (
                          <View
                            key={place.id}
                            style={{
                              backgroundColor: colors.card,
                              borderRadius: 18,
                              padding: 12,
                              borderWidth: 1,
                              borderColor: colors.cardBorder,
                              flexDirection: 'row',
                              gap: 12,
                              alignItems: 'flex-start',
                            }}
                          >
                            {/* Google Places Image */}
                            <View style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.paperDim }}>
                              {placeImgUrl ? (
                                <ShimmerImage source={{ uri: placeImgUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              ) : (
                                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB' }}>
                                  <TagIcon size={24} color={colors.tealDark} />
                                </View>
                              )}
                            </View>

                            <View style={{ flex: 1, justifyContent: 'space-between' }}>
                              <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, flex: 1, marginRight: 6 }} numberOfLines={1}>
                                    {place.title}
                                  </Text>
                                  <View style={{ backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 }}>
                                    <Text style={{ fontSize: 9.5, fontWeight: '800', color: colors.tealDark }}>
                                      Day {place.dayNumber}
                                    </Text>
                                  </View>
                                </View>

                                {place.location && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    <MapPin size={11} color={colors.inkSoft} />
                                    <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, flex: 1 }} numberOfLines={1}>
                                      {place.location}
                                    </Text>
                                  </View>
                                )}
                              </View>

                              {place.time && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                  <Clock size={11} color={colors.tealDark} />
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.tealDark }}>
                                    {place.time}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 4. WHERE THEY STAYED SECTION (from Trip Planner) */}
                {recapData && recapData.stays && recapData.stays.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 10 }}>
                      Where They Stayed
                    </Text>
                    <View style={{ gap: 10 }}>
                      {recapData.stays.map((stay) => {
                        const stayImgUrl = stay.photoReference ? getPlacePhotoUrl(stay.photoReference, 600) : null;
                        return (
                          <View
                            key={stay.id}
                            style={{
                              backgroundColor: colors.card,
                              borderRadius: 18,
                              padding: 12,
                              borderWidth: 1,
                              borderColor: colors.cardBorder,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <View style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.paperDim }}>
                              {stayImgUrl ? (
                                <ShimmerImage source={{ uri: stayImgUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                              ) : (
                                <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB' }}>
                                  <BedDouble size={24} color={colors.tealDark} />
                                </View>
                              )}
                            </View>

                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink }}>
                                {stay.title}
                              </Text>
                              {stay.placeAddress && (
                                <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 2 }} numberOfLines={1}>
                                  {stay.placeAddress}
                                </Text>
                              )}
                              {stay.note && (
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.tealDark, marginTop: 3 }}>
                                  {stay.note}
                                </Text>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 5. Photos Gallery Reel */}
                {recapData && recapData.photos && recapData.photos.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 10 }}>
                      Trip Photo Gallery ({recapData.photos.length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                      {recapData.photos.map((pUrl, idx) => (
                        <View
                          key={`gallery-${idx}`}
                          style={{
                            width: 140,
                            height: 140,
                            borderRadius: 16,
                            overflow: 'hidden',
                            backgroundColor: colors.paperDim,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                          }}
                        >
                          <ShimmerImage source={{ uri: pUrl }} style={{ width: '100%', height: '100%' }} />
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* 6. Squad Memories & Reviews */}
                {recapData && recapData.memories && recapData.memories.length > 0 && (
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 10 }}>
                      Squad Highlights & Reviews
                    </Text>
                    <View style={{ gap: 10 }}>
                      {recapData.memories.map((mem) => (
                        <View
                          key={mem.id}
                          style={{
                            backgroundColor: colors.card,
                            borderRadius: 16,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: colors.cardBorder,
                            gap: 6,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                              {mem.userName}
                            </Text>
                            {mem.rating && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                                <Star size={12} color="#F59E0B" fill="#F59E0B" />
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#F59E0B' }}>{mem.rating}/5</Text>
                              </View>
                            )}
                          </View>
                          {mem.title && (
                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.tealDark }}>
                              {mem.title}
                            </Text>
                          )}
                          {mem.content && (
                            <Text style={{ fontSize: 12, fontWeight: '500', color: colors.inkSoft, lineHeight: 18 }}>
                              {mem.content}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};
