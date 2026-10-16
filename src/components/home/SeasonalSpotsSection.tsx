import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Share,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import {
  getCurrentPhilippineSeason,
  getSpotsBySeason,
  getSeasonMeta,
  PHILIPPINE_SEASONS,
  PhilippineSeasonKey,
  SpotCategory,
  PhilippineSpot,
} from '../../services/seasonalSpotsService';
import {
  Sparkles,
  MapPin,
  Calendar,
  X,
  Compass,
  Share2,
  Utensils,
  Lightbulb,
  Check,
  ChevronRight,
  Wind,
  Sun,
  CloudRain,
  Mountain,
  Palmtree,
  Coffee,
  Landmark,
} from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SeasonalSpotsSectionProps {
  onPlanTrip?: (destinationName: string) => void;
  onNavigateToPlanner?: () => void;
}

const CATEGORIES: { key: SpotCategory; label: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }[] = [
  { key: 'all', label: 'All Spots', icon: Compass },
  { key: 'mountain', label: 'Mountains', icon: Mountain },
  { key: 'beach', label: 'Beaches', icon: Palmtree },
  { key: 'cozy', label: 'Cozy & Stays', icon: Coffee },
  { key: 'food', label: 'Food Trip', icon: Utensils },
  { key: 'heritage', label: 'Heritage', icon: Landmark },
];

const getCategoryIcon = (category: string, size = 14, color?: string) => {
  switch (category) {
    case 'mountain':
      return <Mountain size={size} color={color} strokeWidth={2.2} />;
    case 'beach':
      return <Palmtree size={size} color={color} strokeWidth={2.2} />;
    case 'cozy':
      return <Coffee size={size} color={color} strokeWidth={2.2} />;
    case 'food':
      return <Utensils size={size} color={color} strokeWidth={2.2} />;
    case 'heritage':
      return <Landmark size={size} color={color} strokeWidth={2.2} />;
    default:
      return <Compass size={size} color={color} strokeWidth={2.2} />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'mountain':
      return { color: '#059669', bg: 'rgba(5, 150, 105, 0.1)' };
    case 'beach':
      return { color: '#0284C7', bg: 'rgba(2, 132, 199, 0.1)' };
    case 'cozy':
      return { color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)' };
    case 'food':
      return { color: '#EA580C', bg: 'rgba(234, 88, 12, 0.1)' };
    case 'heritage':
      return { color: '#7C3AED', bg: 'rgba(124, 58, 237, 0.1)' };
    default:
      return { color: '#0171F8', bg: 'rgba(1, 113, 248, 0.1)' };
  }
};

const getRegionBadge = (region: string) => {
  switch (region) {
    case 'Luzon':
      return { label: 'Luzon', color: '#0171F8', bg: 'rgba(1, 113, 248, 0.1)' };
    case 'Visayas':
      return { label: 'Visayas', color: '#EA580C', bg: 'rgba(234, 88, 12, 0.1)' };
    case 'Mindanao':
      return { label: 'Mindanao', color: '#D97706', bg: 'rgba(217, 119, 6, 0.1)' };
    default:
      return { label: region, color: '#3A8E71', bg: 'rgba(58, 142, 113, 0.1)' };
  }
};

export const SeasonalSpotsSection: React.FC<SeasonalSpotsSectionProps> = ({
  onPlanTrip,
  onNavigateToPlanner,
}) => {
  const { colors, isDark } = useTheme();
  const { sp, fs } = useResponsive();

  // Smart detect today's season dynamically
  const todaySeason = useMemo(() => getCurrentPhilippineSeason(new Date()), []);
  const todayDateFormatted = useMemo(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }, []);

  const [selectedSeasonKey, setSelectedSeasonKey] = useState<PhilippineSeasonKey>(todaySeason.key);
  const [selectedCategory, setSelectedCategory] = useState<SpotCategory>('all');
  const [selectedSpot, setSelectedSpot] = useState<PhilippineSpot | null>(null);

  const activeSeasonMeta = useMemo(() => getSeasonMeta(selectedSeasonKey), [selectedSeasonKey]);
  const spots = useMemo(
    () => getSpotsBySeason(selectedSeasonKey, selectedCategory),
    [selectedSeasonKey, selectedCategory]
  );

  const isDetectedToday = selectedSeasonKey === todaySeason.key;

  const renderSeasonIcon = (iconName: string, size = 14, color?: string) => {
    const iconColor = color || activeSeasonMeta.accentColor;
    switch (iconName) {
      case 'sparkles':
        return <Sparkles size={size} color={iconColor} strokeWidth={2.2} />;
      case 'wind':
        return <Wind size={size} color={iconColor} strokeWidth={2.2} />;
      case 'sun':
        return <Sun size={size} color={iconColor} strokeWidth={2.2} />;
      case 'cloud-rain':
        return <CloudRain size={size} color={iconColor} strokeWidth={2.2} />;
      default:
        return <Sparkles size={size} color={iconColor} strokeWidth={2.2} />;
    }
  };

  const handleShareSpot = async (spot: PhilippineSpot) => {
    try {
      const message = `Let's plan a barkada trip to ${spot.name} (${spot.province})!\n\n` +
        `Season vibe: ${spot.tagline}\n` +
        `Why now: ${spot.whyNow}\n\n` +
        `Must-try bites: ${spot.mustTryBites.join(', ')}\n\n` +
        `Planned with Barkadash`;
      await Share.share({ message });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const cardWidth = Math.min(290, SCREEN_WIDTH * 0.76);

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <View style={[styles.sparkleIconBox, { backgroundColor: activeSeasonMeta.accentBg }]}>
              {renderSeasonIcon(activeSeasonMeta.iconName, 12, activeSeasonMeta.accentColor)}
            </View>
            <Text style={[styles.sectionSubtitle, { color: activeSeasonMeta.accentColor }]}>
              PHILIPPINES SEASONAL SPOTS
            </Text>
          </View>
          <Text style={[styles.sectionTitle, { color: colors.ink }]} numberOfLines={1}>
            Where to Go Right Now
          </Text>
        </View>

        {/* Live Detected Date Badge */}
        <View
          style={[
            styles.liveDateBadge,
            {
              backgroundColor: isDark ? colors.card : '#FFFDF7',
              borderColor: isDetectedToday ? activeSeasonMeta.accentColor : colors.cardBorder,
            },
          ]}
        >
          <Calendar size={12} color={activeSeasonMeta.accentColor} />
          <Text style={[styles.liveDateText, { color: colors.ink }]}>
            {todayDateFormatted}
          </Text>
          {isDetectedToday && (
            <View style={[styles.todayDot, { backgroundColor: activeSeasonMeta.accentColor }]} />
          )}
        </View>
      </View>

      {/* Season Selector Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.seasonTabsScroll}
      >
        {PHILIPPINE_SEASONS.map((season) => {
          const isSelected = season.key === selectedSeasonKey;
          const isThisToday = season.key === todaySeason.key;

          return (
            <TouchableOpacity
              key={season.key}
              onPress={() => setSelectedSeasonKey(season.key)}
              activeOpacity={0.8}
              style={[
                styles.seasonPill,
                {
                  backgroundColor: isSelected
                    ? season.accentColor
                    : isDark
                    ? colors.card
                    : colors.subtleBg,
                  borderColor: isSelected
                    ? season.accentColor
                    : isThisToday
                    ? season.accentColor
                    : colors.cardBorder,
                },
              ]}
            >
              {renderSeasonIcon(
                season.iconName,
                13,
                isSelected ? '#FFFFFF' : season.accentColor
              )}
              <Text
                style={[
                  styles.seasonPillText,
                  { color: isSelected ? '#FFFFFF' : colors.ink },
                ]}
              >
                {season.shortName}
              </Text>

              {isThisToday && (
                <View
                  style={[
                    styles.todayMiniBadge,
                    {
                      backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : season.accentBg,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.todayMiniText,
                      { color: isSelected ? '#FFFFFF' : season.accentColor },
                    ]}
                  >
                    Today
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Season Vibe Card */}
      <View
        style={[
          styles.seasonVibeCard,
          {
            backgroundColor: isDark ? colors.card : activeSeasonMeta.accentBg,
            borderColor: isDark ? colors.cardBorder : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <View style={styles.seasonVibeHeader}>
          <View style={styles.seasonVibeTitleRow}>
            <View style={[styles.seasonVibeIconCircle, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' }]}>
              {renderSeasonIcon(activeSeasonMeta.iconName, 18, activeSeasonMeta.accentColor)}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.seasonVibeName, { color: colors.ink }]}>
                {activeSeasonMeta.name} ({activeSeasonMeta.monthsLabel})
              </Text>
              <Text style={[styles.seasonVibeTagline, { color: activeSeasonMeta.accentColor }]}>
                {activeSeasonMeta.tagline}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.seasonVibeDesc, { color: colors.inkSoft }]}>
          {activeSeasonMeta.description}
        </Text>

        <View style={[styles.seasonWhyRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)' }]}>
          <Sparkles size={14} color={activeSeasonMeta.accentColor} style={{ marginTop: 2 }} />
          <Text style={[styles.seasonWhyText, { color: colors.ink }]}>
            <Text style={{ fontWeight: '800', color: activeSeasonMeta.accentColor }}>Best right now: </Text>
            {activeSeasonMeta.whyVisitNowSummary}
          </Text>
        </View>
      </View>

      {/* Category Pills Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isCatSelected = selectedCategory === cat.key;
          const IconComp = cat.icon;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.8}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: isCatSelected
                    ? colors.tealDark
                    : isDark
                    ? colors.card
                    : colors.card,
                  borderColor: isCatSelected ? colors.tealDark : colors.cardBorder,
                },
              ]}
            >
              <IconComp
                size={13}
                color={isCatSelected ? '#FFFFFF' : colors.inkSoft}
                strokeWidth={2.2}
              />
              <Text
                style={[
                  styles.categoryText,
                  { color: isCatSelected ? '#FFFFFF' : colors.inkSoft },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Horizontal Carousel of Recommended Spots */}
      {spots.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <Compass size={28} color={colors.inkSoft} strokeWidth={1.8} style={{ marginBottom: 6 }} />
          <Text style={[styles.emptyText, { color: colors.inkSoft }]}>
            No spots found in this category for {activeSeasonMeta.shortName}. Try switching categories.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.spotsScroll}
          decelerationRate="fast"
          snapToInterval={cardWidth + 14}
        >
          {spots.map((spot) => {
            const catStyle = getCategoryColor(spot.category);
            const regionBadge = getRegionBadge(spot.region);

            return (
              <TouchableOpacity
                key={spot.id}
                activeOpacity={0.92}
                onPress={() => setSelectedSpot(spot)}
                style={[
                  styles.spotCard,
                  {
                    width: cardWidth,
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
              >
                {/* Header Banner (No Image) */}
                <View
                  style={[
                    styles.cardHeaderBanner,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : catStyle.bg,
                      borderBottomColor: colors.cardBorder,
                    },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={[
                          styles.catIconCircle,
                          { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF' },
                        ]}
                      >
                        {getCategoryIcon(spot.category, 14, catStyle.color)}
                      </View>
                      <View
                        style={[
                          styles.regionPill,
                          { backgroundColor: regionBadge.bg },
                        ]}
                      >
                        <Text style={[styles.regionPillText, { color: regionBadge.color }]}>
                          {regionBadge.label}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.vibePill,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                          borderColor: isDark ? colors.cardBorder : 'rgba(0,0,0,0.06)',
                        },
                      ]}
                    >
                      <Sparkles size={10} color={activeSeasonMeta.accentColor} />
                      <Text
                        style={[styles.vibePillText, { color: colors.ink }]}
                        numberOfLines={1}
                      >
                        {spot.vibeTag}
                      </Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 10 }}>
                    <View style={styles.locationHeaderRow}>
                      <MapPin size={12} color={colors.tealDark} style={{ flexShrink: 0 }} />
                      <Text style={[styles.provinceText, { color: colors.tealDark }]} numberOfLines={1}>
                        {spot.province}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.inkSoft }}>•</Text>
                      <Calendar size={11} color={colors.inkSoft} style={{ flexShrink: 0 }} />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>
                        {spot.bestMonths}
                      </Text>
                    </View>

                    <Text style={[styles.spotNameText, { color: colors.ink }]} numberOfLines={1}>
                      {spot.name}
                    </Text>

                    <Text style={[styles.spotTaglineText, { color: colors.inkSoft }]} numberOfLines={2}>
                      {spot.tagline}
                    </Text>
                  </View>
                </View>

                {/* Card Body */}
                <View style={styles.cardBody}>
                  {/* Why Now Highlight snippet */}
                  <View
                    style={[
                      styles.cardWhyNowBox,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : activeSeasonMeta.accentBg,
                        borderColor: isDark ? colors.cardBorder : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.cardWhyNowText, { color: colors.ink }]} numberOfLines={2}>
                      <Text style={{ fontWeight: '800', color: activeSeasonMeta.accentColor }}>Why now: </Text>
                      {spot.whyNow}
                    </Text>
                  </View>

                  {/* Highlights preview */}
                  <View style={styles.highlightsPreviewRow}>
                    {spot.highlights.slice(0, 2).map((item, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.highlightTag,
                          {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                            borderColor: colors.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[styles.highlightTagText, { color: colors.inkSoft }]}
                        >
                          • {item}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Action Row */}
                  <View style={styles.cardFooter}>
                    <Text style={[styles.viewDetailsText, { color: colors.tealDark }]}>
                      View Ideas & Bites
                    </Text>
                    <ChevronRight size={14} color={colors.tealDark} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Spot Detail Modal */}
      {selectedSpot && (
        <Modal
          visible={!!selectedSpot}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedSpot(null)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.paper, borderColor: colors.cardBorder },
              ]}
            >
              {/* Modal Header Banner (No Image) */}
              <View
                style={[
                  styles.modalHeaderBanner,
                  {
                    backgroundColor: isDark ? colors.card : '#F8FAFC',
                    borderBottomColor: colors.cardBorder,
                  },
                ]}
              >
                {/* Top Row: Category icon, Region badge, and Close Button */}
                <View style={styles.modalHeaderTopRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <View
                      style={[
                        styles.catIconCircle,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF',
                          borderColor: colors.cardBorder,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      {getCategoryIcon(selectedSpot.category, 16, getCategoryColor(selectedSpot.category).color)}
                    </View>
                    <View
                      style={[
                        styles.regionPill,
                        { backgroundColor: getRegionBadge(selectedSpot.region).bg },
                      ]}
                    >
                      <Text style={[styles.regionPillText, { color: getRegionBadge(selectedSpot.region).color }]}>
                        {getRegionBadge(selectedSpot.region).label}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.vibePill,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#FFFFFF',
                          borderColor: colors.cardBorder,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Sparkles size={10} color={activeSeasonMeta.accentColor} />
                      <Text style={[styles.vibePillText, { color: colors.ink }]} numberOfLines={1}>
                        {selectedSpot.vibeTag}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => setSelectedSpot(null)}
                    style={[
                      styles.modalCloseBtnClean,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <X size={17} color={colors.ink} strokeWidth={2.4} />
                  </TouchableOpacity>
                </View>

                {/* Spot Name & Tagline */}
                <View style={{ marginTop: 12 }}>
                  <View style={styles.locationHeaderRow}>
                    <MapPin size={13} color={colors.tealDark} style={{ flexShrink: 0 }} />
                    <Text style={[styles.provinceText, { color: colors.tealDark }]} numberOfLines={1}>
                      {selectedSpot.province} · {selectedSpot.region}
                    </Text>
                  </View>
                  <Text style={[styles.modalSpotName, { color: colors.ink }]}>
                    {selectedSpot.name}
                  </Text>
                  <Text style={[styles.modalTagline, { color: colors.inkSoft }]}>
                    {selectedSpot.tagline}
                  </Text>
                </View>
              </View>

              {/* Modal Body Scroll */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollBody}
              >
                {/* Meta pills row (NO degrees, NO peso sign) */}
                <View style={styles.modalMetaRow}>
                  <View style={[styles.modalMetaPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Calendar size={13} color={activeSeasonMeta.accentColor} />
                    <Text style={[styles.modalMetaPillText, { color: colors.ink }]}>
                      Best Months: {selectedSpot.bestMonths}
                    </Text>
                  </View>

                  <View style={[styles.modalMetaPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Compass size={13} color={colors.tealDark} />
                    <Text style={[styles.modalMetaPillText, { color: colors.ink }]}>
                      {selectedSpot.region} Region
                    </Text>
                  </View>

                  <View style={[styles.modalMetaPill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                    <Sparkles size={13} color="#D97706" />
                    <Text style={[styles.modalMetaPillText, { color: colors.ink }]}>
                      {selectedSpot.vibeTag}
                    </Text>
                  </View>
                </View>

                {/* Seasonal Reason Box */}
                <View
                  style={[
                    styles.modalSectionCard,
                    {
                      backgroundColor: isDark ? colors.card : activeSeasonMeta.accentBg,
                      borderColor: isDark ? colors.cardBorder : 'rgba(0,0,0,0.06)',
                    },
                  ]}
                >
                  <View style={styles.modalSectionHeaderRow}>
                    {renderSeasonIcon(activeSeasonMeta.iconName, 15, activeSeasonMeta.accentColor)}
                    <Text style={[styles.modalSectionTitle, { color: activeSeasonMeta.accentColor }]}>
                      Why It's Perfect Right Now ({activeSeasonMeta.shortName})
                    </Text>
                  </View>
                  <Text style={[styles.modalSectionParagraph, { color: colors.ink }]}>
                    {selectedSpot.whyNowDetails}
                  </Text>
                </View>

                {/* Must-Do Barkada Activities */}
                <View
                  style={[
                    styles.modalSectionCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.modalSectionHeaderRow}>
                    <Compass size={15} color={colors.tealDark} />
                    <Text style={[styles.modalSectionTitle, { color: colors.tealDark }]}>
                      Must-Do Barkada Activities
                    </Text>
                  </View>

                  <View style={{ gap: 8, marginTop: 4 }}>
                    {selectedSpot.highlights.map((item, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <View style={[styles.bulletNumberCircle, { backgroundColor: colors.tealDark }]}>
                          <Text style={styles.bulletNumberText}>{idx + 1}</Text>
                        </View>
                        <Text style={[styles.bulletItemText, { color: colors.ink }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Must-Try Bites */}
                <View
                  style={[
                    styles.modalSectionCard,
                    { backgroundColor: colors.card, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={styles.modalSectionHeaderRow}>
                    <Utensils size={15} color="#EA580C" />
                    <Text style={[styles.modalSectionTitle, { color: '#EA580C' }]}>
                      Must-Try Local Food & Bites
                    </Text>
                  </View>

                  <View style={{ gap: 8, marginTop: 4 }}>
                    {selectedSpot.mustTryBites.map((food, idx) => (
                      <View key={idx} style={styles.bulletRow}>
                        <View style={[styles.bulletFoodCircle, { backgroundColor: '#FFEDD5' }]}>
                          <Check size={11} color="#EA580C" strokeWidth={3} />
                        </View>
                        <Text style={[styles.bulletItemText, { color: colors.ink }]}>{food}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Barkada Tip */}
                <View
                  style={[
                    styles.modalTipCard,
                    { backgroundColor: isDark ? colors.card : '#F8FAFC', borderColor: colors.cardBorder },
                  ]}
                >
                  <Lightbulb size={16} color="#D97706" style={{ marginTop: 2, flexShrink: 0 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalTipTitle, { color: '#D97706' }]}>Barkada Travel Tip</Text>
                    <Text style={[styles.modalTipText, { color: colors.inkSoft }]}>
                      {selectedSpot.travelTip}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActionButtonsRow}>
                  {/* Share button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleShareSpot(selectedSpot)}
                    style={[
                      styles.modalShareBtn,
                      { backgroundColor: colors.card, borderColor: colors.cardBorder },
                    ]}
                  >
                    <Share2 size={17} color={colors.ink} />
                    <Text style={[styles.modalShareBtnText, { color: colors.ink }]}>
                      Share Idea
                    </Text>
                  </TouchableOpacity>

                  {/* Plan Trip button */}
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      const spotName = selectedSpot.name;
                      setSelectedSpot(null);
                      if (onPlanTrip) {
                        onPlanTrip(spotName);
                      } else if (onNavigateToPlanner) {
                        onNavigateToPlanner();
                      }
                    }}
                    style={[styles.modalPlanBtn, { backgroundColor: colors.tealDark }]}
                  >
                    <Compass size={17} color="#FFFFFF" />
                    <Text
                      style={styles.modalPlanBtnText}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      Plan Trip Here
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sparkleIconBox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionSubtitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  liveDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 100,
    borderWidth: 1,
  },
  liveDateText: {
    fontSize: 11,
    fontWeight: '800',
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  seasonTabsScroll: {
    gap: 8,
    paddingBottom: 10,
  },
  seasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    gap: 6,
  },
  seasonPillText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  todayMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  todayMiniText: {
    fontSize: 9.5,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  seasonVibeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  seasonVibeHeader: {
    marginBottom: 6,
  },
  seasonVibeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  seasonVibeIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seasonVibeName: {
    fontSize: 14,
    fontWeight: '900',
  },
  seasonVibeTagline: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  seasonVibeDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  seasonWhyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  seasonWhyText: {
    fontSize: 12,
    lineHeight: 16.5,
    flex: 1,
    fontWeight: '500',
  },
  categoryScroll: {
    gap: 6,
    paddingBottom: 12,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    gap: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  spotsScroll: {
    gap: 14,
    paddingRight: 10,
    paddingBottom: 4,
  },
  spotCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeaderBanner: {
    padding: 13,
    borderBottomWidth: 1,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  catIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  regionPillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  vibePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 100,
    borderWidth: 1,
  },
  vibePillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  cardBody: {
    padding: 13,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  provinceText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  spotNameText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  spotTaglineText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 8,
  },
  cardWhyNowBox: {
    padding: 8,
    borderRadius: 9,
    marginBottom: 8,
  },
  cardWhyNowText: {
    fontSize: 11.5,
    lineHeight: 15.5,
  },
  highlightsPreviewRow: {
    gap: 4,
    marginBottom: 10,
  },
  highlightTag: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlightTagText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '800',
  },
  emptyBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: SCREEN_HEIGHT * 0.88,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
  },
  modalHeaderBanner: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalCloseBtnClean: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSpotName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 26,
    marginTop: 2,
  },
  modalTagline: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 18,
  },
  modalScrollBody: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  modalMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  modalMetaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    gap: 5,
  },
  modalMetaPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  modalSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  modalSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    flexShrink: 1,
  },
  modalSectionParagraph: {
    fontSize: 13,
    lineHeight: 18.5,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  bulletNumberText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '900',
  },
  bulletFoodCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  bulletItemText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: '600',
  },
  modalTipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalTipTitle: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 2,
  },
  modalTipText: {
    fontSize: 12,
    lineHeight: 17,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    flexShrink: 0,
  },
  modalShareBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  modalPlanBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  modalPlanBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
