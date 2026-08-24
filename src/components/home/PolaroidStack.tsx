import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { DestinationPollOption } from '../../types/trip';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { HandwrittenText } from '../common/HandwrittenText';
import { ShimmerImage } from '../common/ShimmerImage';
import { RotateCw, ThumbsUp } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PolaroidStackProps {
  polls: DestinationPollOption[];
  isLocked?: boolean;
}

const CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.88);
const SPACING = Math.round(CARD_WIDTH * 0.84); // Overlap so next card sits tucked a little behind the spotlighted card
const SIDE_PADDING = Math.round((SCREEN_WIDTH - CARD_WIDTH) / 2);

export const PolaroidStack: React.FC<PolaroidStackProps> = ({ polls, isLocked }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { fs, isTablet } = useResponsive();
  const { colors, isDark } = useTheme();

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  if (!polls || polls.length === 0) return null;
  const total = polls.length;

  const photoHeight = isTablet ? 225 : 180;
  const cardHeight = photoHeight + 76;

  const handleShuffle = () => {
    if (total <= 1) return;
    const nextIdx = (activeIndex + 1) % total;
    setActiveIndex(nextIdx);
    scrollRef.current?.scrollTo({
      x: nextIdx * SPACING,
      animated: true,
    });
  };

  const onMomentumScrollEnd = useCallback(
    (e: any) => {
      const offsetX = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offsetX / SPACING);
      setActiveIndex(Math.max(0, Math.min(idx, total - 1)));
    },
    [total]
  );

  return (
    <View style={styles.container}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        {isLocked ? (
          <View style={{ flex: 1 }} />
        ) : (
          <View style={[styles.badge, { backgroundColor: colors.lightGreenBg }]}>
            <Text style={[styles.badgeText, { color: colors.tealDark }]}>
              TOP DESTINATION
            </Text>
          </View>
        )}
        {!isLocked && total > 1 && (
          <TouchableOpacity
            onPress={handleShuffle}
            activeOpacity={0.75}
            style={styles.shuffleBtn}
          >
            <RotateCw size={12} color="#B45309" />
            <Text style={styles.shuffleText}>
              Tap to Shuffle ({activeIndex + 1}/{total})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Fan Stack Stage with Native 120fps Scroll Interpolation & Unclipped Drop Shadows */}
      <View style={styles.stage}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled={false}
          snapToInterval={SPACING}
          snapToAlignment="center"
          decelerationRate="fast"
          bounces={true}
          overScrollMode="always"
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={{ overflow: 'visible' }}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          onMomentumScrollEnd={onMomentumScrollEnd}
          contentContainerStyle={{
            paddingHorizontal: SIDE_PADDING,
            paddingTop: 10,
            paddingBottom: 32, // Ample space for smooth shadow fade without bottom cut-off
            alignItems: 'center',
          }}
        >
          {polls.map((poll, index) => {
            const inputRange = [
              (index - 1) * SPACING,
              index * SPACING,
              (index + 1) * SPACING,
            ];

            // Subtle natural fan tilt
            const rotate = scrollX.interpolate({
              inputRange,
              outputRange: ['-8deg', '0deg', '8deg'],
            });

            // Smooth scale: 0.91 when tucked behind -> 1.0 when active in spotlight
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.91, 1.0, 0.91],
            });

            // Dynamic vertical tuck depth
            const translateY = scrollX.interpolate({
              inputRange,
              outputRange: [8, 0, 8],
            });

            // Gentle fade for distant items
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.78, 1.0, 0.78],
              extrapolate: 'clamp',
            });

            const voteCount =
              typeof poll.votes === 'number'
                ? poll.votes
                : poll.votedUserIds?.length ?? 0;

            return (
              <Animated.View
                key={poll.id || `card-${index}`}
                style={[
                  styles.cardWrapper,
                  {
                    width: CARD_WIDTH,
                    transform: [{ translateY }, { rotate }, { scale }],
                    opacity,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.96}
                  onPress={
                    index === activeIndex
                      ? handleShuffle
                      : () => {
                          setActiveIndex(index);
                          scrollRef.current?.scrollTo({
                            x: index * SPACING,
                            animated: true,
                          });
                        }
                  }
                  style={[
                    styles.cardInner,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.cardBorder,
                      shadowColor: isDark ? '#000000' : '#0F172A',
                    },
                  ]}
                >
                  {/* Photo Container */}
                  <View
                    style={[
                      styles.photoBox,
                      { height: photoHeight, backgroundColor: colors.paperDim },
                    ]}
                  >
                    <ShimmerImage
                      source={poll.imagePath}
                      style={styles.photoImg}
                      resizeMode="cover"
                      borderRadius={18}
                    />

                    {/* Vote Badge */}
                    {voteCount > 0 && (
                      <View style={styles.voteBadge}>
                        <ThumbsUp size={10} color="#FFFFFF" strokeWidth={2.4} />
                        <Text style={styles.voteBadgeText}>{voteCount}</Text>
                      </View>
                    )}
                  </View>

                  {/* Caption */}
                  <View style={styles.caption}>
                    <Text
                      style={[styles.title, { color: colors.ink }]}
                      numberOfLines={1}
                    >
                      {poll.title}
                    </Text>
                    {poll.leaderComment ? (
                      <HandwrittenText
                        style={{
                          fontSize: fs.xs,
                          color: isDark ? colors.emerald : '#1B4D3E',
                          marginTop: 2,
                        }}
                      >
                        {poll.leaderComment}
                      </HandwrittenText>
                    ) : poll.subtitle || poll.placeAddress ? (
                      <Text
                        style={{ fontSize: 11, color: colors.inkSoft, marginTop: 2 }}
                        numberOfLines={1}
                      >
                        {poll.subtitle || poll.placeAddress}
                      </Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    overflow: 'visible',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  shuffleText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  stage: {
    width: SCREEN_WIDTH,
    marginLeft: -16, // align flush with home screen edge padding
    justifyContent: 'center',
    overflow: 'visible',
  },
  cardWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    overflow: 'visible',
  },
  cardInner: {
    width: '100%',
    borderRadius: 24,
    padding: 10,
    paddingBottom: 14,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 8,
  },
  photoBox: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  voteBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.58)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 100,
  },
  voteBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  caption: {
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});




