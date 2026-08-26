import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Award,
  Camera,
  MapPin,
  Users,
  Plus,
  MessageSquare,
  Lightbulb,
  ChevronRight,
  Star,
  CheckCircle2,
  Calendar,
  Compass,
  BedDouble,
  Lock,
  Circle,
  Clock,
  Edit2,
  Trash2,
  Layers,
  Utensils,
  Car,
  DollarSign,
  Receipt,
  Globe,
  Share2,
} from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { TripService } from '../../services/tripService';
import { ExpenseService } from '../../services/expenseService';
import { TripRecapService } from '../../services/tripRecapService';
import { Trip } from '../../types/trip';
import { TripRecapData, TripRecapMemory, RecapVisibility } from '../../types/tripRecap';
import { formatCurrency } from '../../utils/formatters';
import { isWithinTripDates, getTripDayInfo } from '../../utils/tripDates';
import { AddRecapMemoryModal } from '../../components/recap/AddRecapMemoryModal';
import { AllPlacesVisitedModal } from '../../components/recap/AllPlacesVisitedModal';
import { DeleteRecapMemoryModal } from '../../components/recap/DeleteRecapMemoryModal';
import { ReceiptPhotoCarousel } from '../../components/expenses/ReceiptPhotoCarousel';
import { TripSelectorModal } from '../../components/trip/TripSelectorModal';
import { PublishTripPostModal } from '../../components/recap/PublishTripPostModal';

interface TripRecapScreenProps {
  /** When true, skips the SafeArea + top padding so it can be embedded inside HomeScreen tabs. */
  embedded?: boolean;
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onNavigateToPlanner?: () => void;
}

export const TripRecapScreen: React.FC<TripRecapScreenProps> = ({
  embedded,
  onScrollDirection,
  onNavigateToPlanner,
}) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs, bottomNavOffset } = useResponsive();
  const { width: windowWidth } = useWindowDimensions();

  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => TripService.getInstance().getActiveTrip());
  const [allTrips, setAllTrips] = useState<Trip[]>(() => TripService.getInstance().getTrips());
  const [recapData, setRecapData] = useState<TripRecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Day filter for in-page Places Visited with animated spring bounce
  const [selectedDayFilterIndex, setSelectedDayFilterIndex] = useState(0); // 0 = ALL, 1 = Day 1...
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Modals & Sheets
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editingMemory, setEditingMemory] = useState<TripRecapMemory | null>(null);
  const [memoryToDelete, setMemoryToDelete] = useState<TripRecapMemory | null>(null);
  const [deletingMemory, setDeletingMemory] = useState(false);
  const [allPlacesModalVisible, setAllPlacesModalVisible] = useState(false);
  const [tripSelectorVisible, setTripSelectorVisible] = useState(false);
  const [publishModalVisible, setPublishModalVisible] = useState(false);
  const [carouselPhotos, setCarouselPhotos] = useState<string[]>([]);
  const [carouselInitialIndex, setCarouselInitialIndex] = useState(0);

  const lastOffsetY = useRef(0);

  const loadRecap = useCallback(async (tripId?: string, silent = false) => {
    const targetId = tripId || activeTrip?.id;
    if (!targetId) {
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setRecapData(null);
      setSelectedDayFilterIndex(0);
    }
    try {
      const data = await TripRecapService.getInstance().fetchTripRecap(targetId);
      setRecapData(data);
    } catch (e) {
      console.warn('loadRecap error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTrip?.id]);

  useEffect(() => {
    const service = TripService.getInstance();
    const unsubTrip = service.subscribe(() => {
      const current = service.getActiveTrip();
      setActiveTrip(current);
      setAllTrips(service.getTrips());
    });
    const unsubExp = ExpenseService.getInstance().subscribe(() => {
      if (activeTrip?.id) {
        loadRecap(activeTrip.id, true);
      }
    });
    return () => {
      unsubTrip();
      unsubExp();
    };
  }, [activeTrip?.id, loadRecap]);

  useEffect(() => {
    if (activeTrip?.id) {
      loadRecap(activeTrip.id);
    } else {
      setLoading(false);
    }
  }, [activeTrip?.id, loadRecap]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedDayFilterIndex,
      useNativeDriver: true,
      bounciness: 7,
      speed: 13,
    }).start();
  }, [selectedDayFilterIndex, slideAnim]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (profile?.id) {
        await TripService.getInstance().fetchUserTripsDB(profile.id);
      }
      await loadRecap(activeTrip?.id, true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMemoryAdded = (newMemory: TripRecapMemory) => {
    setRecapData((prev) => {
      if (!prev) return prev;
      const memPhotos = newMemory.photos || (newMemory.photoUrl ? [newMemory.photoUrl] : []);
      const updatedPhotos = [...memPhotos, ...prev.photos];
      const updatedMemories = [newMemory, ...prev.memories];
      const updatedNotes =
        newMemory.type === 'note' || newMemory.type === 'highlight'
          ? [newMemory, ...prev.notes]
          : prev.notes;
      const updatedTips = newMemory.type === 'tip' ? [newMemory, ...prev.tips] : prev.tips;
      return {
        ...prev,
        memories: updatedMemories,
        photos: updatedPhotos,
        notes: updatedNotes,
        tips: updatedTips,
      };
    });
  };

  const handleMemoryUpdated = (updatedMemory: TripRecapMemory) => {
    setRecapData((prev) => {
      if (!prev) return prev;
      const updatedMemories = prev.memories.map((m) =>
        m.id === updatedMemory.id ? updatedMemory : m
      );
      const updatedNotes = prev.notes.map((m) =>
        m.id === updatedMemory.id ? updatedMemory : m
      );
      const updatedTips = prev.tips.map((m) =>
        m.id === updatedMemory.id ? updatedMemory : m
      );
      return {
        ...prev,
        memories: updatedMemories,
        notes: updatedNotes,
        tips: updatedTips,
      };
    });
  };

  const confirmDeleteMemory = async () => {
    if (!memoryToDelete || !activeTrip?.id) return;
    setDeletingMemory(true);
    try {
      const memPhotos = memoryToDelete.photos || (memoryToDelete.photoUrl ? [memoryToDelete.photoUrl] : []);
      if (memPhotos.length > 0) {
        await TripRecapService.getInstance().deleteStoragePhotos(memPhotos);
      }
      await TripRecapService.getInstance().deleteMemory(
        memoryToDelete.id,
        activeTrip.id,
        profile?.id || 'me'
      );
      setRecapData((prev) => {
        if (!prev) return prev;
        const filteredMem = prev.memories.filter((m) => m.id !== memoryToDelete.id);
        const filteredPhotos = prev.photos.filter((p) => !memPhotos.includes(p));
        return {
          ...prev,
          memories: filteredMem,
          photos: filteredPhotos,
          notes: prev.notes.filter((m) => m.id !== memoryToDelete.id),
          tips: prev.tips.filter((m) => m.id !== memoryToDelete.id),
        };
      });
      setMemoryToDelete(null);
    } catch (e) {
      console.warn('confirmDeleteMemory error:', e);
    } finally {
      setDeletingMemory(false);
    }
  };

  const openPhotoViewer = (photos: string[], index = 0) => {
    setCarouselPhotos(photos);
    setCarouselInitialIndex(index);
  };

  const currentUserId = profile?.id || 'me';
  const isHost = !!activeTrip?.hostId && activeTrip.hostId === profile?.id;
  const currentUserName = profile?.firstName
    ? `${profile.firstName} ${profile.lastName || ''}`.trim()
    : profile?.username || 'Barkada Member';
  const currentUserInitials =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()
      : 'U';

  const Wrapper: any = embedded ? View : SafeAreaView;

  // Render Loading State
  if (loading && !refreshing) {
    return (
      <Wrapper style={{ flex: 1, backgroundColor: colors.paper, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.tealDark} />
        <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '700', marginTop: 12 }}>
          Loading Trip Recap...
        </Text>
      </Wrapper>
    );
  }

  // Render No Trip Selected State
  if (!activeTrip) {
    return (
      <Wrapper style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Compass size={32} color={colors.tealDark} />
          </View>
          <Text style={{ fontSize: fs.lg, fontWeight: '900', color: colors.ink, textAlign: 'center' }}>
            No Active Trip Selected
          </Text>
          <Text style={{ fontSize: fs.xs, color: colors.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
            Choose a trip from your planner or host a new one to unlock memories, photos, and post-trip recaps!
          </Text>
          <TouchableOpacity
            onPress={() => setTripSelectorVisible(true)}
            activeOpacity={0.85}
            style={{
              marginTop: 20,
              backgroundColor: colors.tealDark,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 100,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: fs.sm, fontWeight: '800' }}>Select a Trip</Text>
          </TouchableOpacity>
        </View>

        <TripSelectorModal
          visible={tripSelectorVisible}
          activeTripId=""
          trips={allTrips}
          currentUserId={profile?.id}
          onClose={() => setTripSelectorVisible(false)}
          onSelectTrip={(id) => {
            setRecapData(null);
            setLoading(true);
            TripService.getInstance().setActiveTripId(id);
            setTripSelectorVisible(false);
          }}
          onOpenHostJoin={() => setTripSelectorVisible(false)}
        />
      </Wrapper>
    );
  }

  const hasMatchingRecap = recapData && activeTrip?.id && recapData.tripId === activeTrip.id;
  const dayInfo = activeTrip?.dateRange ? getTripDayInfo(activeTrip.dateRange) : null;
  const isCompleted = activeTrip.status === 'Completed' || (hasMatchingRecap && Boolean(recapData?.isCompleted));
  const isHappeningNow = Boolean(isWithinTripDates(activeTrip.dateRange)) || (hasMatchingRecap && Boolean(recapData?.isHappeningNow));
  const isAfterTrip = Boolean(dayInfo?.isEnded) || (hasMatchingRecap && Boolean(recapData?.isAfterTrip));
  const isUnlocked = isCompleted || isHappeningNow || isAfterTrip;

  // Itinerary items & strikethrough completed counts
  const placesVisited = hasMatchingRecap ? (recapData?.placesVisited || []) : [];
  const completedSpotsCount = placesVisited.filter((p) => p.isCompleted).length;
  const totalSpotsCount = placesVisited.length;

  // Distinct days for segmented pill bouncing filter
  const distinctDays = Array.from(new Set(placesVisited.map((p) => p.dayNumber || 1))).sort((a, b) => a - b);
  const filterTabs = ['ALL', ...distinctDays.map((d) => `DAY ${d}`)];
  const selectedDayFilter = selectedDayFilterIndex === 0 ? 'all' : distinctDays[selectedDayFilterIndex - 1];

  const displayedPlaces = placesVisited.filter((p) =>
    selectedDayFilter === 'all' ? true : p.dayNumber === selectedDayFilter
  );

  // Collect all photos from recapData and individual memories
  const allReelPhotos = Array.from(
    new Set([
      ...(hasMatchingRecap ? (recapData?.photos || []) : []),
      ...(hasMatchingRecap ? (recapData?.memories?.flatMap((m) => m.photos || (m.photoUrl ? [m.photoUrl] : [])) || []) : []),
    ])
  );

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

  const dayPillWidth = (windowWidth - sp.lg * 2 - 10) / Math.min(Math.max(filterTabs.length, 1), 5);

  return (
    <Wrapper style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
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
        contentContainerStyle={{
          paddingHorizontal: sp.lg,
          paddingBottom: bottomNavOffset + 30,
        }}
      >
        {/* ================= HEADER: TRIP SELECTOR BAR ================= */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => setTripSelectorVisible(true)}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 100,
              maxWidth: '76%',
            }}
          >
            <Compass size={15} color={colors.tealDark} />
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.ink }} numberOfLines={1}>
              {activeTrip.title}
            </Text>
            <ChevronRight size={14} color={colors.inkSoft} />
          </TouchableOpacity>

          {isUnlocked && (
            <TouchableOpacity
              onPress={() => {
                setEditingMemory(null);
                setAddModalVisible(true);
              }}
              activeOpacity={0.85}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.tealDark,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 100,
                shadowColor: colors.tealDark,
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 5,
                elevation: 3,
              }}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.8} />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#FFFFFF' }}>Share Story</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ================= BOARDING PASS TRIP CARD (NAVY / TICKET NOTCHES) ================= */}
        <View
          style={{
            backgroundColor: '#0F2A3C',
            borderRadius: 24,
            paddingHorizontal: 20,
            paddingVertical: 20,
            marginBottom: 12,
            position: 'relative',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.12)',
            shadowColor: '#0F2A3C',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.22,
            shadowRadius: 14,
            elevation: 7,
          }}
        >
          {/* Decorative Boarding Pass Notches */}
          <View style={[styles.notchLeft, { backgroundColor: colors.paper }]} />
          <View style={[styles.notchRight, { backgroundColor: colors.paper }]} />

          {/* Top Banner Header: TRIP RECAP & STATUS */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.8 }}>
                TRIP RECAP
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: isCompleted || isHappeningNow || isAfterTrip ? 'rgba(16,185,129,0.22)' : 'rgba(245,158,11,0.22)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 100,
              }}
            >
              {isCompleted ? (
                <Award size={12} color="#34D399" />
              ) : isHappeningNow ? (
                <Compass size={12} color="#34D399" />
              ) : (
                <Calendar size={12} color="#FBBF24" />
              )}
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '900',
                  color: isCompleted || isHappeningNow || isAfterTrip ? '#34D399' : '#FBBF24',
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {isCompleted
                  ? 'Completed'
                  : isHappeningNow
                  ? 'Happening Now'
                  : isAfterTrip
                  ? 'Concluded'
                  : 'Upcoming'}
              </Text>
            </View>
          </View>

          {/* Destination Title & Date */}
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 }}>
            {activeTrip.title}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <MapPin size={13} color="#38BDF8" strokeWidth={2.4} />
            <Text style={{ fontSize: fs.xs, fontWeight: '800', color: '#38BDF8' }}>
              {activeTrip.destination}
            </Text>
            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginHorizontal: 2 }}>·</Text>
            <Calendar size={12} color="rgba(255,255,255,0.6)" />
            <Text style={{ fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>
              {activeTrip.dateRange}
            </Text>
          </View>

          {/* Ticket Dashed Divider Line */}
          <View style={{ marginVertical: 16 }}>
            <View style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' }} />
          </View>

          {/* Minimalist Bottom Stats & Barkada Avatars */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Simple Minimalist Counters */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#FFFFFF' }}>
                  {recapData?.totalDays || 1}
                </Text>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                  Days
                </Text>
              </View>

              <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />

              <View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#34D399' }}>
                  {completedSpotsCount}/{totalSpotsCount}
                </Text>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                  Visited
                </Text>
              </View>

              <View style={{ width: 1, height: 22, backgroundColor: 'rgba(255,255,255,0.15)' }} />

              <View>
                <Text style={{ fontSize: 15, fontWeight: '900', color: '#C084FC' }}>
                  {allReelPhotos.length}
                </Text>
                <Text style={{ fontSize: 9.5, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
                  Photos
                </Text>
              </View>
            </View>

            {/* Overlapping Barkada Avatars */}
            {recapData?.participants && recapData.participants.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {recapData.participants.slice(0, 4).map((p, i) => (
                  <View
                    key={p.id || i}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: colors.tealDark,
                      borderWidth: 2,
                      borderColor: '#0F2A3C',
                      marginLeft: i === 0 ? 0 : -8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {p.avatarUrl ? (
                      <Image source={{ uri: p.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                    ) : (
                      <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF' }}>
                        {p.initials}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* ================= HOST SHARE / POST TRIP TO FEED CARD ================= */}
        {isUnlocked && activeTrip.hostId === profile?.id && (
          <TouchableOpacity
            onPress={() => setPublishModalVisible(true)}
            activeOpacity={0.85}
            style={{
              marginTop: 0,
              marginBottom: 14,
              backgroundColor: isDark ? 'rgba(59,122,158,0.16)' : '#E0F2FE',
              borderColor: isDark ? 'rgba(59,122,158,0.35)' : '#BAE6FD',
              borderWidth: 1,
              borderRadius: 20,
              padding: 14,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: colors.tealDark,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Share2 size={20} color="#FFFFFF" strokeWidth={2.4} />
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '900', color: colors.ink }}>
                    Post Trip to Feed
                  </Text>
                  <View
                    style={{
                      backgroundColor: recapData?.visibility === 'public' ? '#10B981' : recapData?.visibility === 'friends' ? colors.tealDark : colors.inkSoft,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 100,
                    }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF', textTransform: 'uppercase' }}>
                      {recapData?.visibility === 'public' ? 'Public' : recapData?.visibility === 'friends' ? 'Friends Only' : 'Private'}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 2 }}>
                  {recapData?.visibility === 'public'
                    ? 'Published in Explore Feed! Tap to edit post or visibility.'
                    : recapData?.visibility === 'friends'
                    ? 'Shared to Following Feed with friends! Tap to edit.'
                    : 'Set visibility to Public or Friends to post on feed.'}
                </Text>
              </View>
            </View>

            <ChevronRight size={18} color={colors.inkSoft} />
          </TouchableOpacity>
        )}

        {/* ================= LOCKED / UPCOMING GUARD STATE ================= */}
        {!isUnlocked ? (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 24,
              alignItems: 'center',
              marginTop: 0,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Lock size={26} color={colors.inkSoft} strokeWidth={2.2} />
            </View>
            <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink, textAlign: 'center' }}>
              Recap Unlocks During or After Trip
            </Text>
            <Text style={{ fontSize: fs.xs, color: colors.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 18, paddingHorizontal: 10 }}>
              Once your barkada heads out or marks {activeTrip.title} as completed in the planner, you can upload photos, post inside notes, and review your itinerary!
            </Text>

            <TouchableOpacity
              onPress={onNavigateToPlanner}
              activeOpacity={0.85}
              style={{
                marginTop: 18,
                backgroundColor: colors.tealDark,
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: 100,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: fs.xs, fontWeight: '800' }}>
                Open Trip Planner
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ================= UNLOCKED RECAP CONTENT ================= */
          <>
            {/* ================= PHOTO SCRAPBOOK REEL ================= */}
            <View style={{ marginBottom: sp.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Camera size={16} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>
                    Trip Photo Reel
                  </Text>
                  {allReelPhotos.length > 0 && (
                    <View style={{ backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.tealDark }}>
                        {allReelPhotos.length}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setEditingMemory(null);
                    setAddModalVisible(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={14} color={colors.tealDark} strokeWidth={2.6} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>Add Photos</Text>
                </TouchableOpacity>
              </View>

              {allReelPhotos.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {allReelPhotos.map((photoUri, i) => (
                      <TouchableOpacity
                        key={i}
                        activeOpacity={0.85}
                        onPress={() => openPhotoViewer(allReelPhotos, i)}
                        style={{
                          width: 140,
                          height: 185,
                          borderRadius: 22,
                          overflow: 'hidden',
                          backgroundColor: colors.card,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                        }}
                      >
                        <Image source={{ uri: photoUri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setEditingMemory(null);
                    setAddModalVisible(true);
                  }}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: colors.cardBorder,
                    borderRadius: 22,
                    paddingVertical: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Camera size={26} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>
                    No photos added yet
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.inkSoft }}>
                    Tap to upload group photos and memories from the trip!
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ================= ITINERARY PLACES VISITED + DAY PILL BOUNCE ================= */}
            <View style={{ marginBottom: sp.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MapPin size={16} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>
                    Places Visited
                  </Text>
                </View>
                {totalSpotsCount > 0 && (
                  <TouchableOpacity
                    onPress={() => setAllPlacesModalVisible(true)}
                    activeOpacity={0.8}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>
                      See all ({totalSpotsCount})
                    </Text>
                    <ChevronRight size={14} color={colors.tealDark} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Animated Segmented Day Filter with Spring Bounce */}
              {filterTabs.length > 1 && (
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: colors.card,
                    padding: 5,
                    borderRadius: 100,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    marginBottom: 12,
                    position: 'relative',
                  }}
                >
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 5,
                      bottom: 5,
                      left: 5,
                      width: dayPillWidth,
                      backgroundColor: colors.tealDark,
                      borderRadius: 100,
                      transform: [
                        {
                          translateX: slideAnim.interpolate({
                            inputRange: filterTabs.map((_, i) => i),
                            outputRange: filterTabs.map((_, i) => dayPillWidth * i),
                          }),
                        },
                      ],
                    }}
                  />

                  {filterTabs.map((tabLabel, idx) => {
                    const isSelected = selectedDayFilterIndex === idx;
                    return (
                      <TouchableOpacity
                        key={tabLabel}
                        onPress={() => setSelectedDayFilterIndex(idx)}
                        activeOpacity={0.8}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
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

              {displayedPlaces.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {displayedPlaces.slice(0, 5).map((item, idx) => {
                    const isStrikethrough = !!item.isCompleted;
                    const catTheme = getCategoryTheme(item.category);
                    const IconComp = catTheme.icon;

                    return (
                      <View
                        key={item.id || idx}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          backgroundColor: colors.card,
                          padding: 14,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: isStrikethrough
                            ? (isDark ? 'rgba(5,150,105,0.25)' : '#A7F3D0')
                            : colors.cardBorder,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: isStrikethrough
                                ? (isDark ? '#064E3B' : '#D1FAE5')
                                : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isStrikethrough ? (
                              <CheckCircle2 size={18} color="#059669" strokeWidth={2.4} />
                            ) : (
                              <Circle size={16} color={colors.inkSoft} strokeWidth={2.2} />
                            )}
                          </View>

                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: fs.sm,
                                fontWeight: isStrikethrough ? '700' : '900',
                                color: isStrikethrough ? colors.inkSoft : colors.ink,
                                textDecorationLine: isStrikethrough ? 'line-through' : 'none',
                              }}
                              numberOfLines={1}
                            >
                              {item.title}
                            </Text>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
                              Day {item.dayNumber} {item.time ? `· ${item.time}` : ''}
                            </Text>
                            {item.location ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                <MapPin size={11} color={colors.inkSoft} />
                                <Text style={{ fontSize: 11, color: colors.inkSoft, flex: 1 }} numberOfLines={1}>
                                  {item.location}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                          {isStrikethrough ? (
                            <View
                              style={{
                                backgroundColor: isDark ? '#064E3B' : '#D1FAE5',
                                paddingHorizontal: 8,
                                paddingVertical: 3,
                                borderRadius: 100,
                              }}
                            >
                              <Text style={{ fontSize: 10, fontWeight: '900', color: '#059669' }}>
                                Visited
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
                              <IconComp size={10} color={catTheme.color} />
                              <Text style={{ fontSize: 10, fontWeight: '800', color: catTheme.color }}>
                                {catTheme.label}
                              </Text>
                            </View>
                          )}
                          {item.estCost ? (
                            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft, marginTop: 3 }}>
                              {item.estCost}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  })}

                  {/* See All Button */}
                  {placesVisited.length > 5 && (
                    <TouchableOpacity
                      onPress={() => setAllPlacesModalVisible(true)}
                      activeOpacity={0.85}
                      style={{
                        backgroundColor: isDark ? 'rgba(59,122,158,0.12)' : '#EBF5FB',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(59,122,158,0.25)' : '#BAE6FD',
                        borderRadius: 16,
                        paddingVertical: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexDirection: 'row',
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>
                        View All {placesVisited.length} Itinerary Spots
                      </Text>
                      <ChevronRight size={14} color={colors.tealDark} />
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card,
                    padding: 16,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600' }}>
                    No itinerary spots found for this day.
                  </Text>
                </View>
              )}
            </View>

            {/* ================= WHERE YOU STAYED ================= */}
            <View style={{ marginBottom: sp.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <BedDouble size={16} color={colors.tealDark} />
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>
                  Where You Stayed
                </Text>
                {recapData?.stays && recapData.stays.length > 0 && (
                  <View style={{ backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.tealDark }}>
                      {recapData.stays.length}
                    </Text>
                  </View>
                )}
              </View>

              {recapData?.stays && recapData.stays.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {recapData.stays.map((stay) => (
                    <View
                      key={stay.id}
                      style={{
                        backgroundColor: colors.card,
                        padding: 16,
                        borderRadius: 22,
                        borderWidth: 1,
                        borderColor: colors.cardBorder,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 21,
                            backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <BedDouble size={20} color={colors.tealDark} />
                        </View>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                            {stay.title}
                          </Text>
                          {stay.placeAddress && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                              <MapPin size={11} color={colors.inkSoft} />
                              <Text style={{ fontSize: 11, color: colors.inkSoft }} numberOfLines={1}>
                                {stay.placeAddress}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {stay.estCost && (
                        <View
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6',
                            paddingHorizontal: 9,
                            paddingVertical: 4,
                            borderRadius: 100,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.tealDark }}>
                            {stay.estCost}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: colors.card,
                    padding: 16,
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft, fontWeight: '600' }}>
                    No accommodations added in the planner yet.
                  </Text>
                </View>
              )}
            </View>

            {/* ================= BARKADA STORIES & MEMORIES STREAM ================= */}
            <View style={{ marginBottom: sp.lg }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={16} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink }}>
                    Barkada Stories & Tips
                  </Text>
                  {recapData?.memories && recapData.memories.length > 0 && (
                    <View style={{ backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.tealDark }}>
                        {recapData.memories.length}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setEditingMemory(null);
                    setAddModalVisible(true);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={14} color={colors.tealDark} strokeWidth={2.6} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark }}>Add Story</Text>
                </TouchableOpacity>
              </View>

              {recapData?.memories && recapData.memories.length > 0 ? (
                <View style={{ gap: 14 }}>
                  {recapData.memories.map((mem) => {
                    const isTip = mem.type === 'tip';
                    const isReview = mem.type === 'place_review';
                    const isAuthor = mem.userId === currentUserId || isHost;
                    const memPhotos = mem.photos && mem.photos.length > 0
                      ? mem.photos
                      : mem.photoUrl
                      ? [mem.photoUrl]
                      : [];

                    return (
                      <View
                        key={mem.id}
                        style={{
                          backgroundColor: colors.card,
                          borderRadius: 24,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          padding: 18,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 3 },
                          shadowOpacity: 0.04,
                          shadowRadius: 8,
                          elevation: 2,
                        }}
                      >
                        {/* Author Header + Actions */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 17,
                                backgroundColor: colors.tealDark,
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {mem.userAvatar ? (
                                <Image source={{ uri: mem.userAvatar }} style={{ width: '100%', height: '100%' }} />
                              ) : (
                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>
                                  {mem.userInitials}
                                </Text>
                              )}
                            </View>
                            <View>
                              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                                {mem.userName}
                              </Text>
                              <Text style={{ fontSize: 10, color: colors.inkSoft, marginTop: 1 }}>
                                {new Date(mem.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                              </Text>
                            </View>
                          </View>

                          {/* Type Pill & Author Controls */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: isTip
                                  ? (isDark ? '#78350F' : '#FEF3C7')
                                  : isReview
                                  ? (isDark ? '#1E1B4B' : '#EDE9FE')
                                  : (isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6'),
                                paddingHorizontal: 10,
                                paddingVertical: 4,
                                borderRadius: 100,
                              }}
                            >
                              {isTip ? (
                                <Lightbulb size={11} color="#D97706" strokeWidth={2.4} />
                              ) : isReview ? (
                                <Star size={11} color="#8B5CF6" fill="#8B5CF6" />
                              ) : (
                                <Compass size={11} color={colors.tealDark} />
                              )}
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: '900',
                                  color: isTip ? '#D97706' : isReview ? '#8B5CF6' : colors.inkSoft,
                                  textTransform: 'uppercase',
                                  letterSpacing: 0.4,
                                }}
                              >
                                {isTip ? 'Travel Tip' : isReview ? 'Review' : 'Story'}
                              </Text>
                            </View>

                            {/* Author Controls */}
                            {isAuthor && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 2 }}>
                                <TouchableOpacity
                                  onPress={() => {
                                    setEditingMemory(mem);
                                    setAddModalVisible(true);
                                  }}
                                  style={{ padding: 4 }}
                                >
                                  <Edit2 size={14} color={colors.inkSoft} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => setMemoryToDelete(mem)}
                                  style={{ padding: 4 }}
                                >
                                  <Trash2 size={14} color={colors.redAccent || '#EF4444'} />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Story Title */}
                        {mem.title && (
                          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
                            {mem.title}
                          </Text>
                        )}

                        {/* Tagged Location */}
                        {mem.placeName && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                            <MapPin size={12} color={colors.tealDark} strokeWidth={2.2} />
                            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.tealDark }}>
                              {mem.placeName}
                            </Text>
                          </View>
                        )}

                        {/* Rating if review */}
                        {isReview && mem.rating && (
                          <View style={{ flexDirection: 'row', gap: 3, marginBottom: 8 }}>
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                size={14}
                                color={s <= mem.rating! ? '#F59E0B' : '#D1D5DB'}
                                fill={s <= mem.rating! ? '#F59E0B' : 'transparent'}
                              />
                            ))}
                          </View>
                        )}

                        {/* Content text */}
                        {mem.content && (
                          <Text style={{ fontSize: 13, color: colors.ink, lineHeight: 20, marginTop: 2 }}>
                            {mem.content}
                          </Text>
                        )}

                        {/* Attached Multi-Photo Carousel */}
                        {memPhotos.length > 0 && (
                          <View style={{ marginTop: 12 }}>
                            {memPhotos.length === 1 ? (
                              <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => openPhotoViewer(memPhotos, 0)}
                                style={{
                                  borderRadius: 20,
                                  overflow: 'hidden',
                                  borderWidth: 1,
                                  borderColor: colors.cardBorder,
                                }}
                              >
                                <Image source={{ uri: memPhotos[0] }} style={{ width: '100%', height: 190, resizeMode: 'cover' }} />
                              </TouchableOpacity>
                            ) : (
                              <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                  <View style={{ flexDirection: 'row', gap: 8 }}>
                                    {memPhotos.map((pUri, pIdx) => (
                                      <TouchableOpacity
                                        key={pIdx}
                                        activeOpacity={0.9}
                                        onPress={() => openPhotoViewer(memPhotos, pIdx)}
                                        style={{
                                          width: 145,
                                          height: 165,
                                          borderRadius: 18,
                                          overflow: 'hidden',
                                          borderWidth: 1,
                                          borderColor: colors.cardBorder,
                                          position: 'relative',
                                        }}
                                      >
                                        <Image source={{ uri: pUri }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </ScrollView>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 7 }}>
                                  <Layers size={11} color={colors.inkSoft} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>
                                    {memPhotos.length} photos in gallery (tap to view full screen)
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    setEditingMemory(null);
                    setAddModalVisible(true);
                  }}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: colors.cardBorder,
                    borderRadius: 22,
                    paddingVertical: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <MessageSquare size={24} color={colors.tealDark} />
                  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink }}>
                    No stories or tips shared yet
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.inkSoft }}>
                    Share unforgettable moments, hilarious inside jokes, or travel tips!
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ================= TOTAL EXPENSES CARD AT THE BOTTOM ================= */}
            <View
              style={{
                backgroundColor: colors.card,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.cardBorder,
                padding: 20,
                marginBottom: sp.lg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
                elevation: 2,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Receipt size={24} color="#059669" strokeWidth={2.2} />
                </View>

                <View>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Total Trip Expenses
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#059669', letterSpacing: -0.5, marginTop: 2 }}>
                    {formatCurrency(recapData?.totalSpent || 0)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 100,
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '900', color: '#059669' }}>
                  Group Ledger
                </Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ================= MODALS ================= */}

      {/* Add / Edit Recap Memory / Multi-Photo / Tip Modal */}
      <AddRecapMemoryModal
        visible={addModalVisible}
        onClose={() => {
          setAddModalVisible(false);
          setEditingMemory(null);
        }}
        tripId={activeTrip.id}
        tripTitle={activeTrip.title}
        userId={currentUserId}
        userName={currentUserName}
        userAvatar={profile?.avatarUrl || undefined}
        userInitials={currentUserInitials}
        placesVisited={recapData?.placesVisited.map((p) => ({ id: p.id, title: p.title })) || []}
        initialMemory={editingMemory}
        onMemoryAdded={handleMemoryAdded}
        onMemoryUpdated={handleMemoryUpdated}
      />

      {/* All Places Visited Modal */}
      <AllPlacesVisitedModal
        visible={allPlacesModalVisible}
        onClose={() => setAllPlacesModalVisible(false)}
        tripTitle={activeTrip.title}
        places={placesVisited}
      />

      {/* Trip Switcher Modal */}
      <TripSelectorModal
        visible={tripSelectorVisible}
        activeTripId={activeTrip.id}
        trips={allTrips}
        currentUserId={profile?.id}
        onClose={() => setTripSelectorVisible(false)}
        onSelectTrip={(id) => {
          TripService.getInstance().setActiveTripId(id);
          setTripSelectorVisible(false);
        }}
        onOpenHostJoin={() => setTripSelectorVisible(false)}
      />

      {/* Delete Memory Confirmation Modal (Identical to TripSelectorModal) */}
      <DeleteRecapMemoryModal
        visible={!!memoryToDelete}
        title={memoryToDelete?.title}
        itemType={memoryToDelete?.type}
        loading={deletingMemory}
        onClose={() => setMemoryToDelete(null)}
        onConfirm={confirmDeleteMemory}
      />

      {/* Host Publish Trip Post Modal */}
      {activeTrip && (
        <PublishTripPostModal
          visible={publishModalVisible}
          tripId={activeTrip.id}
          tripTitle={activeTrip.title}
          currentVisibility={recapData?.visibility || (recapData?.isPublic ? 'public' : 'private')}
          currentNotes={recapData?.summaryNote}
          currentCoverPhoto={recapData?.coverPhotoUrl}
          availablePhotos={allReelPhotos}
          onClose={() => setPublishModalVisible(false)}
          onSave={async (visibility, notes, coverPhotoUrl) => {
            if (!profile?.id) return;
            const ok = await TripRecapService.getInstance().publishTripPostDB(
              activeTrip.id,
              profile.id,
              visibility,
              notes,
              coverPhotoUrl
            );
            if (ok) {
              setRecapData((prev) =>
                prev
                  ? {
                      ...prev,
                      visibility,
                      isPublic: visibility === 'public',
                      summaryNote: notes,
                      coverPhotoUrl,
                    }
                  : prev
              );
            }
          }}
          onUnpublish={async () => {
            if (!profile?.id) return;
            const ok = await TripRecapService.getInstance().unpublishTripPostDB(
              activeTrip.id,
              profile.id
            );
            if (ok) {
              setRecapData((prev) =>
                prev
                  ? {
                      ...prev,
                      visibility: 'private',
                      isPublic: false,
                    }
                  : prev
              );
            }
          }}
        />
      )}

      {/* Full Photo Carousel Viewer */}
      {carouselPhotos.length > 0 && (
        <ReceiptPhotoCarousel
          photos={carouselPhotos}
          initialIndex={carouselInitialIndex}
          visible={carouselPhotos.length > 0}
          onClose={() => setCarouselPhotos([])}
        />
      )}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  notchLeft: {
    position: 'absolute',
    left: -12,
    top: '60%',
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
  },
  notchRight: {
    position: 'absolute',
    right: -12,
    top: '60%',
    width: 24,
    height: 24,
    borderRadius: 12,
    zIndex: 2,
  },
});