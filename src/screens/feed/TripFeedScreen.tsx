import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, Menu, Compass, MapPin, Globe, Users } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { ShimmerImage } from '../../components/common/ShimmerImage';
import { TripRecapService } from '../../services/tripRecapService';
import { TripRecapPost } from '../../types/tripRecap';
import { formatCurrency } from '../../utils/formatters';
import { TripPostDetailScreen } from './TripPostDetailScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TripFeedScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
  /** When true, skips the SafeArea + logo header so it can be embedded inside HomeScreen tabs. */
  embedded?: boolean;
  onSelectPost?: (post: TripRecapPost) => void;
}

export const TripFeedScreen: React.FC<TripFeedScreenProps> = ({
  onScrollDirection,
  onOpenCabinet,
  embedded,
  onSelectPost,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs, icon, bottomNavOffset, isTablet } = useResponsive();

  const [activeTab, setActiveTab] = useState<'Following' | 'Explore'>('Following');
  const [posts, setPosts] = useState<TripRecapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<TripRecapPost | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const lastOffsetY = useRef(0);
  const cardImgHeight = isTablet ? 220 : 180;

  const loadFeed = useCallback(async (silent = false) => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const feedType = activeTab === 'Explore' ? 'explore' : 'following';
      const data = await TripRecapService.getInstance().fetchFeedPostsDB(profile.id, feedType);
      setPosts(data);
    } catch (e) {
      console.warn('loadFeed error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, activeTab]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFeed(true);
  };

  const handleOpenDetail = (post: TripRecapPost) => {
    if (onSelectPost) {
      onSelectPost(post);
      return;
    }
    setSelectedPost(post);
    slideAnim.setValue(SCREEN_WIDTH);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const handleCloseDetail = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_WIDTH,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setSelectedPost(null);
    });
  };

  const handleCardToggleLike = async (tripId: string, e: any) => {
    e.stopPropagation();
    if (!profile?.id) return;

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.tripId === tripId) {
          const nextLiked = !p.isLikedByMe;
          const nextCount = nextLiked ? p.likesCount + 1 : Math.max(0, p.likesCount - 1);
          return { ...p, isLikedByMe: nextLiked, likesCount: nextCount };
        }
        return p;
      })
    );

    const res = await TripRecapService.getInstance().toggleLikeTripPostDB(tripId, profile.id);
    if (res.success) {
      setPosts((prev) =>
        prev.map((p) =>
          p.tripId === tripId
            ? { ...p, isLikedByMe: res.isLiked, likesCount: res.newLikesCount }
            : p
        )
      );
    }
  };

  const Wrapper: any = embedded ? View : SafeAreaView;

  return (
    <Wrapper style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />
      <View style={{ flex: 1, paddingHorizontal: sp.lg, paddingTop: sp.sm }}>
        {/* App Logo & Borderless Hamburger */}
        {!embedded && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: sp.md }}>
            <TouchableOpacity
              onPress={onOpenCabinet}
              activeOpacity={0.7}
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
              }}
            >
              <Menu size={22} color={colors.ink} strokeWidth={2.2} />
            </TouchableOpacity>
            <BarkadashLogo height={32} />
          </View>
        )}

        {/* Following / Explore Tab Selector */}
        <View style={{ flexDirection: 'row', gap: sp.sm, marginBottom: sp.md }}>
          {(['Following', 'Explore'] as const).map((tab) => {
            const isSelected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.8}
                onPress={() => setActiveTab(tab)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 100,
                  backgroundColor: isSelected ? colors.tealDark : colors.paperDim,
                }}
              >
                <Text
                  style={{
                    fontSize: fs.xs,
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

        {/* Feed Cards List */}
        {loading && !refreshing ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={colors.tealDark} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 12 }}>
              Loading trip feed...
            </Text>
          </View>
        ) : posts.length === 0 ? (
          <ScrollView
            style={{ flex: 1 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.tealDark}
                colors={[colors.tealDark]}
              />
            }
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingBottom: bottomNavOffset }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <Compass size={32} color={colors.tealDark} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, textAlign: 'center' }}>
              {activeTab === 'Following' ? 'No Friend Posts Yet' : 'No Public Posts Yet'}
            </Text>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '500',
                color: colors.inkSoft,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 18,
              }}
            >
              {activeTab === 'Following'
                ? 'Follow barkada friends or post a trip recap as host to share on your feed.'
                : 'Be the first host to post a public trip recap in Explore.'}
            </Text>
          </ScrollView>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.tealDark}
                colors={[colors.tealDark]}
              />
            }
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
            contentContainerStyle={{ paddingBottom: bottomNavOffset + 20, gap: sp.lg }}
          >
            {posts.map((item) => (
              <TouchableOpacity
                key={item.tripId}
                onPress={() => handleOpenDetail(item)}
                activeOpacity={0.9}
                style={{
                  backgroundColor: colors.card,
                  borderRadius: 24,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                {/* Photo with Overlay */}
                <View style={{ height: cardImgHeight, width: '100%', backgroundColor: colors.paperDim, position: 'relative' }}>
                  {item.coverPhotoUrl ? (
                    <ShimmerImage source={{ uri: item.coverPhotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                  ) : (
                    <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
                      <Compass size={40} color={colors.tealDark} />
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
                      padding: sp.md,
                    }}
                  >
                    {/* Top Spend Tag & Host info */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {item.hostAvatar ? (
                            <Image source={{ uri: item.hostAvatar }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF' }}>{item.hostInitials}</Text>
                          )}
                        </View>
                        <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '700' }}>{item.hostName}</Text>
                      </View>

                      <View style={{ backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: sp.xs, borderRadius: 100 }}>
                        <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '900' }}>
                          {formatCurrency(item.totalSpent)}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Title & Destination */}
                    <View>
                      <Text style={{ fontSize: fs.lg, fontWeight: '900', color: '#FFFFFF' }}>
                        {item.title}
                      </Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                        {item.destination} • {item.dateRange}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Footer Bar */}
                <View
                  style={{
                    padding: sp.md,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: colors.card,
                  }}
                >
                  {/* Avatars + Count */}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {item.participantAvatars.slice(0, 3).map((p, idx) => (
                      <View
                        key={p.id || idx}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          borderWidth: 2,
                          borderColor: colors.card,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.tealDark,
                          marginLeft: idx > 0 ? -6 : 0,
                          overflow: 'hidden',
                        }}
                      >
                        {p.avatarUrl ? (
                          <Image source={{ uri: p.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                          <Text style={{ fontSize: 8, fontWeight: '900', color: '#FFF' }}>{p.initials}</Text>
                        )}
                      </View>
                    ))}
                    <Text style={{ fontSize: fs.xs, fontWeight: '600', color: colors.inkSoft, marginLeft: sp.sm }}>
                      {item.participantsCount} member{item.participantsCount > 1 ? 's' : ''}
                    </Text>
                  </View>

                  {/* Like Counter */}
                  <TouchableOpacity
                    onPress={(e) => handleCardToggleLike(item.tripId, e)}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp.xs,
                      backgroundColor: item.isLikedByMe ? (isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2') : colors.subtleBg,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 100,
                    }}
                  >
                    <Heart size={icon.sm} color="#EF4444" fill={item.isLikedByMe ? '#EF4444' : 'none'} />
                    <Text style={{ fontSize: fs.xs, fontWeight: '800', color: item.isLikedByMe ? '#DC2626' : colors.ink }}>
                      {item.likesCount}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Smooth Slide-In Overlay (Slides in like Edit Profile from Cabinet) */}
      {selectedPost && (
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: colors.paper,
              zIndex: 300,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <TripPostDetailScreen
            post={selectedPost}
            onBack={handleCloseDetail}
            onLikeToggled={(tripId, isLiked, newLikesCount) => {
              setPosts((prev) =>
                prev.map((p) =>
                  p.tripId === tripId
                    ? { ...p, isLikedByMe: isLiked, likesCount: newLikesCount }
                    : p
                )
              );
            }}
          />
        </Animated.View>
      )}
    </Wrapper>
  );
};
