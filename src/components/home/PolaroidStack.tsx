import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { DestinationPollOption } from '../../types/trip';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { HandwrittenText } from '../common/HandwrittenText';
import { Vote, RotateCw, Layers } from 'lucide-react-native';

interface PolaroidStackProps {
  polls: DestinationPollOption[];
  onVotePress?: (poll: DestinationPollOption) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const PolaroidStack: React.FC<PolaroidStackProps> = ({ polls, onVotePress }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const { fs, isTablet } = useResponsive();
  const { colors, isDark } = useTheme();

  const anim = useRef(new Animated.Value(0)).current;

  if (!polls || polls.length === 0) return null;

  const stackSize = polls.length;

  const handleNextCard = () => {
    if (isAnimating || stackSize <= 1) return;
    setIsAnimating(true);
    anim.setValue(0);

    Animated.timing(anim, {
      toValue: 1,
      duration: 480,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setActiveIndex((prev) => (prev + 1) % stackSize);
        anim.setValue(0);
        setIsAnimating(false);
      }
    });
  };

  const photoHeight = isTablet ? 240 : 190;

  // ── FRONT CARD: Sweeps out smoothly, rotates in 3D, and tucks into the back ──
  const frontTranslateX = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, SCREEN_WIDTH * 0.4, 0],
  });

  const frontTranslateY = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [0, -12, 22],
  });

  const frontRotateY = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: ['0deg', '-35deg', '0deg'],
  });

  const frontRotateZ = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: ['-1.5deg', '8deg', '-4.5deg'],
  });

  const frontScale = anim.interpolate({
    inputRange: [0, 0.45, 1],
    outputRange: [1, 1.02, 0.9],
  });

  // ── SECOND CARD: Rises to become top card ─────────────────
  const middleTranslateY = anim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [12, 4, 0],
  });

  const middleScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.0],
  });

  const middleRotateZ = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['3.5deg', '-1.5deg'],
  });

  // ── BACK CARD: Moves up to middle slot ──────────────────────────────
  const backTranslateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [22, 12],
  });

  const backScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 0.95],
  });

  const backRotateZ = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-4.5deg', '3.5deg'],
  });

  // Render cards from back to front
  const sortedPolls = polls
    .map((poll, originalIdx) => {
      const pos = (originalIdx - activeIndex + stackSize) % stackSize;
      return { poll, originalIdx, pos };
    })
    .sort((a, b) => b.pos - a.pos);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={[styles.badgePill, { backgroundColor: colors.lightGreenBg }]}>
          <Layers size={14} color={colors.tealDark} />
          <Text style={[styles.badgeText, { color: colors.tealDark }]}>
            POLAROID STACK ({activeIndex + 1}/{stackSize})
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handleNextCard}
          style={styles.shuffleBtn}
        >
          <RotateCw size={12} color="#B45309" />
          <Text style={styles.shuffleText}>Tap to Shuffle</Text>
        </TouchableOpacity>
      </View>

      {/* Stack */}
      <View style={[styles.stackWrapper, { height: photoHeight + 140 }]}>
        {sortedPolls.map(({ poll, originalIdx, pos }) => {
          const isFront = pos === 0;
          const isSecond = pos === 1;
          const isLast = pos === stackSize - 1;

          let transform: any[] = [];
          let zIndex = 10;
          let opacity: any = 1;

          if (isFront) {
            transform = [
              { perspective: 1000 },
              { translateX: frontTranslateX },
              { translateY: frontTranslateY },
              { scale: frontScale },
              { rotateY: frontRotateY },
              { rotate: frontRotateZ },
            ];
            zIndex = isAnimating ? 25 : 30;
          } else if (isSecond) {
            transform = [
              { perspective: 1000 },
              { translateX: 0 },
              { translateY: middleTranslateY },
              { scale: middleScale },
              { rotateY: '0deg' },
              { rotate: middleRotateZ },
            ];
            zIndex = isAnimating ? 28 : 20;
          } else if (isLast && stackSize >= 3) {
            transform = [
              { perspective: 1000 },
              { translateX: 0 },
              { translateY: backTranslateY },
              { scale: backScale },
              { rotateY: '0deg' },
              { rotate: backRotateZ },
            ];
            zIndex = 10;
            opacity = 0.88;
          } else {
            transform = [
              { perspective: 1000 },
              { translateX: 0 },
              { translateY: 22 + pos * 4 },
              { scale: 0.88 },
              { rotateY: '0deg' },
              { rotate: pos % 2 === 0 ? '-3deg' : '4.5deg' },
            ];
            zIndex = Math.max(1, 10 - pos);
            opacity = 0.7;
          }

          return (
            <Animated.View
              key={poll.id || originalIdx}
              style={[
                styles.polaroidCard,
                {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex,
                  opacity,
                  transform,
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={isFront ? handleNextCard : undefined}
                disabled={!isFront || isAnimating}
              >
                {/* Washi tape */}
                <View
                  style={[
                    styles.washiTape,
                    originalIdx % 2 === 0 ? styles.tapeLeft : styles.tapeRight,
                  ]}
                />

                {/* Photo */}
                <View style={[styles.photoBox, { height: photoHeight, backgroundColor: colors.paperDim }]}>
                  <Image
                    source={poll.imagePath}
                    style={styles.photoImage}
                    resizeMode="cover"
                  />
                  <View style={styles.photoOverlayHeader}>
                    {poll.votes >= 3 && (
                      <View style={styles.leadingBadge}>
                        <Text style={styles.leadingBadgeText}>LEADING</Text>
                      </View>
                    )}
                    <View style={styles.votesBadge}>
                      <Text style={styles.votesBadgeText}>{poll.votes} Votes</Text>
                    </View>
                  </View>
                </View>

                {/* Caption */}
                <View style={styles.polaroidCaptionArea}>
                  <View style={styles.captionHeader}>
                    <Text style={[styles.destinationTitle, { color: colors.ink }]} numberOfLines={1}>
                      {poll.title}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => onVotePress && onVotePress(poll)}
                      style={[styles.voteBtn, { backgroundColor: colors.tealDark }]}
                    >
                      <Vote size={14} color="#FFFFFF" />
                      <Text style={styles.voteBtnText}>Vote</Text>
                    </TouchableOpacity>
                  </View>
                  {poll.leaderComment ? (
                    <HandwrittenText
                      style={{ fontSize: fs.xs, color: isDark ? colors.emerald : '#1B4D3E', marginTop: 4 }}
                    >
                      {poll.leaderComment}
                    </HandwrittenText>
                  ) : null}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E4F0EA',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1F4E67',
    letterSpacing: 0.8,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
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
  stackWrapper: {
    position: 'relative',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  polaroidCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: '#EAE4D7',
    shadowColor: '#1A1D2D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  washiTape: {
    position: 'absolute',
    top: -10,
    zIndex: 40,
    width: 68,
    height: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.75)',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tapeLeft: {
    left: 24,
    transform: [{ rotate: '-4deg' }],
  },
  tapeRight: {
    right: 24,
    transform: [{ rotate: '5deg' }],
  },
  photoBox: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F3ECE1',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlayHeader: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadingBadge: {
    backgroundColor: '#F5A65B',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  leadingBadgeText: {
    color: '#1A1D2D',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  votesBadge: {
    backgroundColor: 'rgba(15, 42, 60, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  votesBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  polaroidCaptionArea: {
    paddingTop: 10,
    paddingHorizontal: 2,
  },
  captionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  destinationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1A1D2D',
    flex: 1,
    marginRight: 8,
  },
  voteBtn: {
    backgroundColor: '#1F4E67',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  voteBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
