import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, ArrowLeft, Globe, MapPin, Compass } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { useUser } from '../../context/UserContext';
import { TripRecapService } from '../../services/tripRecapService';
import { TripRecapPost } from '../../types/tripRecap';
import { formatCurrency } from '../../utils/formatters';
import { ShimmerImage } from '../../components/common/ShimmerImage';
import { TripPostDetailScreen } from '../feed/TripPostDetailScreen';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface MyLikesScreenProps {
  onBack: () => void;
  onSelectPost?: (post: TripRecapPost) => void;
}

export const MyLikesScreen: React.FC<MyLikesScreenProps> = ({ onBack, onSelectPost }) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs, bottomNavOffset } = useResponsive();

  const [likedPosts, setLikedPosts] = useState<TripRecapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPost, setSelectedPost] = useState<TripRecapPost | null>(null);

  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

  const loadMyLikes = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await TripRecapService.getInstance().fetchMyLikedTripsDB(profile.id);
      setLikedPosts(data);
    } catch (e) {
      console.warn('loadMyLikes error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadMyLikes();
  }, [loadMyLikes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMyLikes();
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

  const handleToggleLikeCard = async (tripId: string, e: any) => {
    e.stopPropagation();
    if (!profile?.id) return;

    // Optimistic UI update
    setLikedPosts((prev) => prev.filter((p) => p.tripId !== tripId));

    await TripRecapService.getInstance().toggleLikeTripPostDB(tripId, profile.id);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* Header Bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: sp.lg,
          paddingVertical: sp.sm,
          gap: 12,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.7}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.cardBorder,
          }}
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 }}>
            My Likes
          </Text>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }}>
            Your saved and liked barkada trip posts
          </Text>
        </View>
      </View>

      {/* Content List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.tealDark} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft, marginTop: 12 }}>
            Loading your liked trips...
          </Text>
        </View>
      ) : likedPosts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Heart size={36} color="#EF4444" fill="#EF4444" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, textAlign: 'center' }}>
            No Liked Trip Posts Yet
          </Text>
          <Text
            style={{
              fontSize: 12.5,
              fontWeight: '500',
              color: colors.inkSoft,
              textAlign: 'center',
              marginTop: 6,
              lineHeight: 18,
            }}
          >
            Explore public trip recaps in the Feed or Explore tab and tap the Like button to save your favorites here.
          </Text>
        </View>
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
          contentContainerStyle={{ paddingHorizontal: sp.lg, paddingTop: sp.sm, paddingBottom: bottomNavOffset + 20, gap: sp.lg }}
        >
          {likedPosts.map((post) => (
            <TouchableOpacity
              key={post.tripId}
              onPress={() => handleOpenDetail(post)}
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
              {/* Cover Photo */}
              <View style={{ height: 180, width: '100%', backgroundColor: colors.paperDim, position: 'relative' }}>
                {post.coverPhotoUrl ? (
                  <ShimmerImage source={{ uri: post.coverPhotoUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
                    <Compass size={36} color={colors.tealDark} />
                  </View>
                )}

                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    justifyContent: 'space-between',
                    padding: 14,
                  }}
                >
                  {/* Top Spend Tag */}
                  <View style={{ alignSelf: 'flex-end', backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 }}>
                    <Text style={{ color: colors.ink, fontSize: 11, fontWeight: '900' }}>
                      {formatCurrency(post.totalSpent)}
                    </Text>
                  </View>

                  {/* Title & Host */}
                  <View>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFF' }}>
                      {post.title}
                    </Text>
                    <Text style={{ fontSize: 11.5, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
                      {post.destination} • {post.dateRange}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Footer */}
              <View
                style={{
                  padding: 14,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: colors.card,
                }}
              >
                {/* Host Info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.tealDark, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {post.hostAvatar ? (
                      <Image source={{ uri: post.hostAvatar }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '800' }}>{post.hostInitials}</Text>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>
                    {post.hostName}
                  </Text>
                </View>

                {/* Heart Button */}
                <TouchableOpacity
                  onPress={(e) => handleToggleLikeCard(post.tripId, e)}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 100,
                  }}
                >
                  <Heart size={14} color="#EF4444" fill="#EF4444" />
                  <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#DC2626' }}>
                    {post.likesCount}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Smooth Slide-In Overlay */}
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
            onLikeToggled={(tripId, isLiked) => {
              if (!isLiked) {
                setLikedPosts((prev) => prev.filter((p) => p.tripId !== tripId));
              }
            }}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
};
