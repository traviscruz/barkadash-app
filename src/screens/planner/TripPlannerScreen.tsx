import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
  Animated,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
  Easing,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { AppColors } from '../../utils/colors';
import { MapPin, Compass, Utensils, Menu, Plus, KeyRound, ChevronDown, ChevronUp, Vote, Share2, Users, Sparkles, CheckCircle2, Pencil, Lock, ThumbsUp, ThumbsDown, Trash2, UsersRound, Navigation, RefreshCw, BedDouble, Link as LinkIcon, MessageCircle, Send, CalendarDays, RotateCcw, AlertTriangle, Flag, X, Check, Settings } from 'lucide-react-native';
import { isWithinTripDates, getTripDayInfo, getTodayTripDay, sortItineraryChronological, parseTripDateRange, tripDayCount as calcTripDayCount } from '../../utils/tripDates';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { ShimmerImage } from '../../components/common/ShimmerImage';
import { TripService } from '../../services/tripService';
import { supabase } from '../../utils/supabase';
import { HostJoinTripModal } from '../../components/trip/HostJoinTripModal';
import { NoTripWelcome } from '../../components/home/NoTripWelcome';
import { TripDetailsModal } from '../../components/trip/TripDetailsModal';
import { TripSelectorModal } from '../../components/trip/TripSelectorModal';
import { PendingTripInvite } from '../../components/trip/TripInvitationModal';
import { TripVotingPollsSection } from '../../components/trip/TripVotingPollsSection';
import { EditTourModal } from '../../components/trip/EditTourModal';
import { ItineraryAddModal, ItineraryPlacePrefill } from '../../components/trip/ItineraryAddModal';
import { StayAddModal } from '../../components/trip/StayAddModal';
import { getPlacePhotoUrl, getPlaceDetails, searchPlaces } from '../../services/googlePlaces';
import { Trip, ItineraryItem, TripStay } from '../../types/trip';
import { fetchAiSpots, ensureAiSpots, generateAiSpots, getSmartCategories, AiSpot, AiSpotCategory } from '../../services/aiSpotsService';

import { useUser } from '../../context/UserContext';

const { width } = Dimensions.get('window');

const bigLagoonImg = require('../../../assets/images/biglagoon.jpg');
const nacpanImg = require('../../../assets/images/nacpan.jpg');
const sagadaImg = require('../../../assets/images/sagada.jpeg');
const naviMascot = require('../../../assets/mascot/ai_mascot.webp');

interface TripPlannerScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
  pendingInvite?: PendingTripInvite | null;
  onViewInvitation?: () => void;
}

interface SpotCardProps {
  spot: AiSpot;
  isPicked: boolean;
  isDark: boolean;
  teal: string;
  width: number;
  imgHeight: number;
  titleSize: number;
  gap: number;
  borderLight: string;
  textDark: string;
  subtleDark: string;
  onPress: (spot: AiSpot) => void;
}

/**
 * Self-contained spot card with its own zoom animation: the image springs
 * to 1.12 when picked and springs back out to 1 when deselected, so switching
 * cards always feels seamless (old one zooms out while the new one zooms in).
 */
const SpotCard: React.FC<SpotCardProps> = ({ spot, isPicked, isDark, teal, width, imgHeight, titleSize, gap, borderLight, textDark, subtleDark, onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: isPicked ? 1.12 : 1,
      useNativeDriver: true,
      stiffness: 170,
      damping: 24,
      mass: 1,
    }).start();
  }, [isPicked, scale]);

  return (
    <TouchableOpacity onPress={() => onPress(spot)} activeOpacity={0.85} style={{ width }}>
      <View style={{ padding: 3, borderRadius: 19, backgroundColor: isPicked ? teal : 'transparent', marginBottom: gap }}>
        <View style={{ height: imgHeight, backgroundColor: borderLight, borderRadius: 16, overflow: 'hidden' }}>
          {spot.photoReference ? (
            <Animated.View style={{ width: '100%', height: '100%', transform: [{ scale }] }}>
              <ShimmerImage source={{ uri: getPlacePhotoUrl(spot.photoReference, 400) }} style={{ width: '100%', height: '100%' }} borderRadius={16} />
            </Animated.View>
          ) : (
            <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EFF3EA' }}>
              <Compass size={22} color={teal} />
            </View>
          )}
        </View>
      </View>
      <Text numberOfLines={1} style={{ fontSize: titleSize, fontWeight: '900', color: isPicked ? teal : textDark, letterSpacing: 0 }}>{spot.name}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontSize: 10, fontWeight: '700', marginTop: 2 }}>
        {spot.rating ? <Text style={{ color: '#F59E0B' }}>{spot.rating.toFixed(1)}★</Text> : <Text style={{ color: subtleDark }}>Top pick</Text>}
        {'  ·  '}
        <Text style={{ color: AppColors.emerald }}>{spot.matchScore}% match</Text>
      </Text>
      <Text numberOfLines={3} style={{ fontSize: 9.5, fontWeight: '500', color: subtleDark, marginTop: 3, lineHeight: 12 }}>
        {spot.description}
      </Text>
    </TouchableOpacity>
  );
};

export const TripPlannerScreen: React.FC<TripPlannerScreenProps> = ({ onScrollDirection, onOpenCabinet, pendingInvite, onViewInvitation }) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { sp, fs, icon, isTablet, insets, width, bottomNavOffset } = useResponsive();
  const [activeSubTab, setActiveSubTab] = useState<'Itinerary' | 'Spots'>('Itinerary');
  const [selectedDay, setSelectedDay] = useState(() => {
    const initTrip = TripService.getInstance().getActiveTrip();
    return getTodayTripDay(initTrip?.dateRange);
  });
  const [selectedCategory, setSelectedCategory] = useState('DINING');
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [aiSpots, setAiSpots] = useState<AiSpot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [spotsError, setSpotsError] = useState('');
  const [selectedSpot, setSelectedSpot] = useState<AiSpot | null>(null);
  const [addingSpot, setAddingSpot] = useState<AiSpot | null>(null);
  const lastOffsetY = useRef(0);
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Trip State & Host/Join / Details Modal State
  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => TripService.getInstance().getActiveTrip());
  const [allTrips, setAllTrips] = useState<Trip[]>(() => TripService.getInstance().getTrips());
  const [loading, setLoading] = useState(true);
  const [hostJoinModalVisible, setHostJoinModalVisible] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'choice' | 'host' | 'join'>('choice');
  const [showTripSelector, setShowTripSelector] = useState(false);
  const [tripDetailsVisible, setTripDetailsVisible] = useState(false);
  const [editTourVisible, setEditTourVisible] = useState(false);

  // Complete Trip & Undo State
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showUndoModal, setShowUndoModal] = useState(false);
  const [loadingUndo, setLoadingUndo] = useState(false);

  const isHost = !!profile?.id && activeTrip?.hostId === profile.id;
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const service = TripService.getInstance();
      await service.fetchUserTripsDB(profile?.id);
      const active = service.getActiveTrip();
      setActiveTrip(active);
      setAllTrips(service.getTrips());
      if (active?.id) {
        await Promise.all([
          loadItinerary(active.id, selectedDay, true),
          loadStays(active.id, true),
        ]);
      }
    } catch (e) {
      console.warn('Planner refresh error:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const isLocked = activeTrip?.planningStage === 'READY' || activeTrip?.planningStage === 'ITINERARY_BUILDING';
  const withinDates = activeTrip ? isWithinTripDates(activeTrip.dateRange) : false;
  const dayInfo = activeTrip ? getTripDayInfo(activeTrip.dateRange) : null;
  const isTripEnded = activeTrip ? TripService.getInstance().isTripEnded(activeTrip) : false;
  const isTripCompleted = isTripEnded;

  const confirmCompleteTrip = async () => {
    if (!activeTrip || !profile?.id) return;
    setLoadingComplete(true);
    try {
      const res = await TripService.getInstance().completeTripDB(activeTrip.id, profile.id);
      if (res.success) {
        setShowCompleteModal(false);
        setActiveTrip(TripService.getInstance().getActiveTrip());
      }
    } finally {
      setLoadingComplete(false);
    }
  };

  const confirmUndoCompleteTrip = async () => {
    if (!activeTrip || !profile?.id) return;
    setLoadingUndo(true);
    try {
      const res = await TripService.getInstance().reopenTripDB(activeTrip.id, profile.id);
      if (res.success) {
        setShowUndoModal(false);
        setActiveTrip(TripService.getInstance().getActiveTrip());
      }
    } finally {
      setLoadingUndo(false);
    }
  };

  useEffect(() => {
    const service = TripService.getInstance();
    let unsubscribeRealtime = () => {};

    setLoading(true);
    service.fetchUserTripsDB(profile?.id)
      .then(() => {
        setActiveTrip(service.getActiveTrip());
        setAllTrips(service.getTrips());
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (profile?.id) {
      unsubscribeRealtime = service.subscribeRealtime(profile.id);
    }

    const unsubscribe = service.subscribe(() => {
      setActiveTrip(service.getActiveTrip());
      setAllTrips(service.getTrips());
    });

    return () => {
      unsubscribe();
      unsubscribeRealtime();
    };
  }, [profile?.id]);

  useEffect(() => {
    if (activeTrip?.dateRange) {
      const todayDay = getTodayTripDay(activeTrip.dateRange);
      setSelectedDay(todayDay);
    }
  }, [activeTrip?.id, activeTrip?.dateRange]);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: selectedDay - 1,
      useNativeDriver: true,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [selectedDay, slideAnim]);

  // When the tour just got locked, everyone lands on the itinerary page once.
  // Do NOT re-force on every tab change — members can switch freely after.
  const wasLockedRef = useRef(false);
  useEffect(() => {
    if (isLocked && !wasLockedRef.current) {
      setActiveSubTab('Itinerary');
      wasLockedRef.current = true;
    }
    if (!isLocked) {
      wasLockedRef.current = false;
    }
  }, [isLocked]);

  const handleEditTourSave = async (deadline: string) => {
    if (isTripEnded) return { success: false, message: 'Trip has ended.' };
    const res = await TripService.getInstance().reactivateTripVotingDB(activeTrip?.id || '', deadline, profile?.id);
    if (res.success) {
      setEditTourVisible(false);
    }
    return res;
  };

  // DB-backed shared itinerary
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryModalVisible, setItineraryModalVisible] = useState(false);
  const [itineraryModalMode, setItineraryModalMode] = useState<'add' | 'edit'>('add');
  const [editingItem, setEditingItem] = useState<ItineraryItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<ItineraryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  // Guards against stale DB refetches overwriting the newest reaction state:
  // only the most recent fetch may update the list. Also serializes reaction
  // writes per item so rapid like<->dislike taps can't double-insert.
  const itineraryLoadSeq = useRef(0);
  const pendingReactionOps = useRef<Record<string, Promise<unknown>>>({});

  const loadItinerary = useCallback(async (tripId: string, day: number, silent?: boolean) => {
    if (!tripId) return;
    const seq = ++itineraryLoadSeq.current;
    if (!silent) setItineraryLoading(true);
    const items = await TripService.getInstance().fetchTripItineraryDB(tripId, day);
    if (seq !== itineraryLoadSeq.current) return; // stale response — drop it
    setItineraryItems(sortItineraryChronological(items));
    setItineraryLoading(false);
  }, []);

  useEffect(() => {
    loadItinerary(activeTrip?.id || '', selectedDay);
  }, [activeTrip?.id, selectedDay, loadItinerary]);

  // Realtime: keep the itinerary in sync without any manual refresh — items
  // added/edited/deleted or liked/disliked by anyone show up instantly.
  useEffect(() => {
    const tripId = activeTrip?.id;
    if (!tripId) return;
    const channel = supabase
      .channel(`itinerary-realtime:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_itinerary_items', filter: `trip_id=eq.${tripId}` },
        () => loadItinerary(tripId, selectedDay, true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_itinerary_reactions' },
        () => loadItinerary(tripId, selectedDay, true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTrip?.id, selectedDay, loadItinerary]);

  const openAddItinerary = () => {
    if (isTripEnded) return;
    setItineraryModalMode('add');
    setEditingItem(null);
    setAddingSpot(null);
    setItineraryModalVisible(true);
  };

  const openAddSpotToItinerary = (spot: AiSpot) => {
    if (isTripEnded) return;
    setItineraryModalMode('add');
    setEditingItem(null);
    setAddingSpot(spot);
    setItineraryModalVisible(true);
  };

  const openEditItinerary = (item: ItineraryItem) => {
    if (isTripEnded) return;
    setItineraryModalMode('edit');
    setEditingItem(item);
    setItineraryModalVisible(true);
  };

  const handleDeleteItinerary = async (item: ItineraryItem) => {
    if (isTripEnded || !item) return;
    setDeletingItem(true);
    const ok = await TripService.getInstance().deleteItineraryItemDB(item.id);
    setDeletingItem(false);
    setItemToDelete(null);
    if (ok) loadItinerary(activeTrip?.id || '', selectedDay);
  };

  const meInitials =
    profile?.firstName && profile?.lastName
      ? `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase()
      : 'U';

  // ---- Where You'll Stay (host-picked accommodations) ----
  const [stays, setStays] = useState<TripStay[]>([]);
  const [staysLoading, setStaysLoading] = useState(false);
  const [staysCollapsed, setStaysCollapsed] = useState(false);
  const [stayModalVisible, setStayModalVisible] = useState(false);
  const [stayModalMode, setStayModalMode] = useState<'add' | 'edit'>('add');
  const [editingStay, setEditingStay] = useState<TripStay | null>(null);
  const [stayToDelete, setStayToDelete] = useState<TripStay | null>(null);
  const [deletingStay, setDeletingStay] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentSending, setCommentSending] = useState(false);
  const stayLoadSeq = useRef(0);
  const pendingStayReactionOps = useRef<Record<string, Promise<unknown>>>({});

  const loadStays = useCallback(async (tripId: string, silent?: boolean) => {
    if (!tripId) return;
    const seq = ++stayLoadSeq.current;
    if (!silent) setStaysLoading(true);
    const fetched = await TripService.getInstance().fetchTripStaysDB(tripId);
    if (seq !== stayLoadSeq.current) return; // stale response — drop it
    setStays(fetched);
    if (fetched && fetched.length > 0) {
      setStaysCollapsed(true);
    }
    setStaysLoading(false);

    // Auto-resolve missing photo references from Google Places API
    fetched.forEach(async (stay) => {
      if (!stay.photoReference && (stay.placeId || stay.title)) {
        try {
          let photoRef: string | undefined;
          if (stay.placeId) {
            const details = await getPlaceDetails(stay.placeId);
            photoRef = details?.photoReference || details?.photos?.[0]?.reference;
          } else {
            const query = `${stay.title} ${stay.placeAddress || activeTrip?.destination || ''}`.trim();
            const res = await searchPlaces(query);
            if (res.predictions.length > 0) {
              const details = await getPlaceDetails(res.predictions[0].placeId);
              photoRef = details?.photoReference || details?.photos?.[0]?.reference;
            }
          }
          if (photoRef) {
            setStays((prev) =>
              prev.map((s) => (s.id === stay.id ? { ...s, photoReference: photoRef } : s))
            );
            if (isHost) {
              TripService.getInstance().updateTripStayDB(stay.id, { photoReference: photoRef }).catch(() => {});
            }
          }
        } catch (e) {
          // ignore lookup failure
        }
      }
    });
  }, [activeTrip?.destination, isHost]);

  useEffect(() => {
    loadStays(activeTrip?.id || '');
  }, [activeTrip?.id, loadStays]);

  // Realtime: keeps stays, reactions, and comments in sync live.
  useEffect(() => {
    const tripId = activeTrip?.id;
    if (!tripId) return;
    const channel = supabase
      .channel(`stays-realtime:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stays', filter: `trip_id=eq.${tripId}` },
        () => loadStays(tripId, true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stay_reactions' },
        () => loadStays(tripId, true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stay_comments' },
        () => loadStays(tripId, true)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTrip?.id, loadStays]);

  const openAddStay = () => {
    if (isTripEnded) return;
    setStayModalMode('add');
    setEditingStay(null);
    setStayModalVisible(true);
  };

  const openEditStay = (stay: TripStay) => {
    if (isTripEnded) return;
    setStayModalMode('edit');
    setEditingStay(stay);
    setStayModalVisible(true);
  };

  const handleDeleteStay = async (stay: TripStay) => {
    if (isTripEnded || !stay) return;
    setDeletingStay(true);
    const ok = await TripService.getInstance().deleteTripStayDB(stay.id);
    setDeletingStay(false);
    setStayToDelete(null);
    if (ok) loadStays(activeTrip?.id || '');
  };

  const openStayLink = (stay: TripStay) => {
    if (!stay.link) return;
    const url = /^https?:\/\//i.test(stay.link) ? stay.link : `https://${stay.link}`;
    Linking.openURL(url).catch((err) => {
      console.warn('openStayLink error:', err?.message);
    });
  };

  const handleReactStay = (stay: TripStay, reaction: 'like' | 'dislike') => {
    if (isTripEnded || !profile?.id) return;
    const tripId = activeTrip?.id || '';
    // Optimistic update — same as itinerary reactions.
    setStays((prev) =>
      prev.map((s) => {
        if (s.id !== stay.id) return s;
        const current = s.myReaction;
        const finalReaction = current === reaction ? null : reaction;
        const reactions = (s.reactions || []).filter((r) => r.userId !== profile.id);
        let myReaction: 'like' | 'dislike' | null = null;
        if (finalReaction) {
          reactions.push({
            id: `opt:${s.id}:${finalReaction}`,
            stayId: s.id,
            userId: profile.id,
            reaction: finalReaction,
            userInitials: meInitials,
          });
          myReaction = finalReaction;
        }
        return {
          ...s,
          reactions,
          myReaction,
          likeCount: reactions.filter((r) => r.reaction === 'like').length,
          dislikeCount: reactions.filter((r) => r.reaction === 'dislike').length,
        };
      })
    );

    const prev = (pendingStayReactionOps.current[stay.id] || Promise.resolve()).catch(() => {});
    const op = prev.then(() =>
      TripService.getInstance().toggleTripStayReactionDB(stay.id, tripId, profile.id, reaction)
    );
    pendingStayReactionOps.current[stay.id] = op;
    op.finally(() => {
      if (pendingStayReactionOps.current[stay.id] === op) {
        delete pendingStayReactionOps.current[stay.id];
      }
    });
  };

  const handleSendStayComment = async (stayId: string) => {
    if (isTripEnded) return;
    const text = (commentDrafts[stayId] || '').trim();
    if (!text || commentSending) return;
    setCommentSending(true);
    const ok = await TripService.getInstance().addTripStayCommentDB(
      stayId,
      activeTrip?.id || '',
      profile?.id || '',
      text
    );
    setCommentSending(false);
    if (ok) {
      setCommentDrafts((prev) => ({ ...prev, [stayId]: '' }));
      loadStays(activeTrip?.id || '', true);
    }
  };

  const handleDeleteStayComment = async (stayId: string, commentId: string) => {
    if (isTripEnded) return;
    const ok = await TripService.getInstance().deleteTripStayCommentDB(commentId);
    if (ok) loadStays(activeTrip?.id || '', true);
  };

  const stayDateLabel = (stay: TripStay) => {
    const start = getDayDate(stay.startDay - 1);
    const end = getDayDate(stay.endDay - 1);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return stay.endDay > stay.startDay
      ? `${fmt(start)} – ${fmt(end)}`
      : `Night of ${fmt(start)}`;
  };

  // Open Google Maps directions to a stay (uses its stored place_id when available)
  const openStayDirections = (stay: TripStay) => {
    const queryName = stay.placeName || stay.title;
    const dest = stay.placeId
      ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(stay.placeId)}&destination=${encodeURIComponent(queryName)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${queryName} ${stay.placeAddress || ''}`.trim())}`;
    Linking.openURL(dest).catch((err) => {
      console.warn('openStayDirections error:', err?.message);
    });
  };

  // Open Google Maps directions to an itinerary place. Prefer the stored
  // place_id (deep link) so maps opens the exact spot; fall back to a text query.
  const openDirections = (item: ItineraryItem) => {
    const queryName = item.placeName || item.title;
    const dest = item.placeId
      ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(item.placeId)}&destination=${encodeURIComponent(queryName)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${queryName} ${item.placeAddress || item.location || ''}`.trim())}`;
    Linking.openURL(dest).catch((err) => {
      console.warn('openDirections error:', err?.message);
    });
  };

  const handleReact = (item: ItineraryItem, reaction: 'like' | 'dislike') => {
    if (isTripEnded || !profile?.id) return;
    const tripId = activeTrip?.id || '';
    // Optimistic update — the tapped reaction is the single source of truth
    // for the UI: whatever you just clicked becomes your vote, instantly.
    setItineraryItems((prev) =>
      prev.map((i) => {
        if (i.id !== item.id) return i;
        const current = i.myReaction;
        // Unselect when tapping the same reaction again; otherwise switch.
        const finalReaction = current === reaction ? null : reaction;
        const reactions = (i.reactions || []).filter((r) => r.userId !== profile.id);
        let myReaction: 'like' | 'dislike' | null = null;
        if (finalReaction) {
          reactions.push({
            id: `opt:${i.id}:${finalReaction}`,
            itemId: i.id,
            userId: profile.id,
            reaction: finalReaction,
            userInitials: meInitials,
          });
          myReaction = finalReaction;
        }
        return {
          ...i,
          reactions,
          myReaction,
          likeCount: reactions.filter((r) => r.reaction === 'like').length,
          dislikeCount: reactions.filter((r) => r.reaction === 'dislike').length,
        };
      })
    );

    // Serialize DB writes per item so concurrent toggles can't both read "no
    // existing row" and insert duplicates. Each tap's write runs after the
    // previous one for the same item finishes.
    const prev = (pendingReactionOps.current[item.id] || Promise.resolve()).catch(() => {});
    const op = prev.then(() =>
      TripService.getInstance().toggleItineraryReactionDB(item.id, tripId, profile.id, reaction)
    );
    pendingReactionOps.current[item.id] = op;
    op.finally(() => {
      if (pendingReactionOps.current[item.id] === op) {
        delete pendingReactionOps.current[item.id];
      }
    });
  };

  const tripDates = parseTripDateRange(activeTrip?.dateRange);
  const hasTripDates = !!tripDates;
  const tripDayCount = calcTripDayCount(activeTrip?.dateRange);
  const smartCategories = getSmartCategories(activeTrip?.destination);
  const destination = activeTrip?.destination || '';

  // Load AI spots for the selected category when the Spots tab opens / the
  // category changes. Hits the DB cache first; generates fresh only when empty.
  const loadAiSpots = useCallback(
    async (forceRefresh = false) => {
      if (!activeTrip?.id || !destination) return;
      setSpotsLoading(true);
      setSpotsError('');
      try {
        let spots: AiSpot[] = [];
        if (forceRefresh) {
          const result = await generateAiSpots(activeTrip.id, destination, selectedCategory);
          spots = result.spots;
          if (result.error) setSpotsError('Could not refresh suggestions. Try again in a moment.');
        } else {
          const result = await ensureAiSpots(activeTrip.id, destination, selectedCategory);
          spots = result.spots;
          if (result.error) setSpotsError('Could not load suggestions. Try again in a moment.');
        }
        setAiSpots(spots);
        // Prefetch all spot photos so tapping a card swaps the Navi suggestion
        // image instantly with no shimmer/loading delay.
        spots.forEach((s) => {
          if (s.photoReference) {
            Image.prefetch(getPlacePhotoUrl(s.photoReference, 900)).catch(() => {});
            Image.prefetch(getPlacePhotoUrl(s.photoReference, 400)).catch(() => {});
          }
        });
        const featured = spots.find((s) => s.isFeatured) || spots[0] || null;
        setSelectedSpot((prev) => {
          if (prev && spots.some((s) => s.placeId === prev.placeId)) return prev;
          return featured;
        });
      } catch (err: any) {
        console.warn('loadAiSpots exception:', err?.message);
        setSpotsError('Could not load suggestions right now.');
        setAiSpots([]);
        setSelectedSpot(null);
      } finally {
        setSpotsLoading(false);
      }
    },
    [activeTrip?.id, destination, selectedCategory]
  );

  // When the Spots tab becomes active (or the category changes), fetch the cache.
  // Clear the previous category's spots first so we never flash stale data.
  useEffect(() => {
    if (activeSubTab === 'Spots' && activeTrip?.id && destination) {
      setAiSpots([]);
      setSelectedSpot(null);
      loadAiSpots(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, selectedCategory, activeTrip?.id]);

  const openSpotDetails = (spot: AiSpot) => setSelectedSpot(spot);

  // Fast, smooth zoom for the selected spot card's image. The previous card
  // zooms back out to 1, the newly selected card zooms in to 1.12.
  const dayOffsets = Array.from({ length: tripDayCount }, (_, i) => i);
  const pillWidth = (width - (sp.lg * 2) - 12) / tripDayCount;

  const getDayDate = (offset: number): Date => {
    if (tripDates) {
      return new Date(tripDates.start.getTime() + offset * 86400000);
    }
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d;
  };

  const toggleItemCompletion = async (item: ItineraryItem) => {
    if (isTripEnded) return;
    const isCurrentlyDone = completedItems[item.id] !== undefined ? completedItems[item.id] : !!item.isCompleted;
    const nextVal = !isCurrentlyDone;
    setCompletedItems(prev => ({ ...prev, [item.id]: nextVal }));
    setItineraryItems(prev => prev.map(i => i.id === item.id ? { ...i, isCompleted: nextVal } : i));
    await TripService.getInstance().toggleItineraryCompletedDB(item.id, nextVal);
  };

  const imgHeight = isTablet ? 240 : 180;
  const spotCardWidth = isTablet ? 200 : 160;
  const spotImgHeight = isTablet ? 140 : 120;
  const itineraryImgHeight = isTablet ? 190 : 150;

  // App-aligned Colors
  const COLORS = {
    bgDark: colors.card,
    bgLight: colors.paper,
    accent: colors.sun,
    textDark: colors.ink,
    textLight: '#FFFFFF',
    borderDark: colors.tealDark,
    borderLight: colors.cardBorder,
    subtleDark: colors.inkSoft,
    subtleLight: 'rgba(255,255,255,0.6)',
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bgLight }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* HEADER - Editorial but App-Themed */}
      <View style={{ paddingHorizontal: sp.lg, paddingTop: sp.sm, paddingBottom: sp.md, backgroundColor: COLORS.bgLight }}>
        
        {/* App Logo, Hamburger & Primary Trip Selector Dropdown */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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

          {/* Top Bar Right: Trip Dropdown & Settings Button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Clean Trip Dropdown Picker Button */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowTripSelector(true)}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 100,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                maxWidth: isTablet ? 280 : 160,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.tealDark, flexShrink: 1 }} numberOfLines={1}>
                {activeTrip?.title || 'Barkada Trip'}
              </Text>
              <ChevronDown size={14} color={colors.tealDark} strokeWidth={2.5} />
            </TouchableOpacity>

            {/* Trip Settings Hub Button */}
            {activeTrip && (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setTripDetailsVisible(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.card,
                  borderColor: colors.cardBorder,
                  borderWidth: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <Settings size={16} color={colors.ink} strokeWidth={2.2} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Page Title */}
        <View style={{ marginBottom: sp.sm }}>
          <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: colors.ink, letterSpacing: -0.5 }}>
            Trip Planner
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 2 }}>
            Organize your barkada's next getaway
          </Text>
        </View>
      </View>

      {/* MAIN CONTENT BODY */}
      <View style={{ flex: 1, backgroundColor: COLORS.bgLight }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color={colors.tealDark} />
            <Text style={{ fontSize: 13, fontWeight: '600', color: colors.inkSoft }}>Rounding up your barkada…</Text>
          </View>
        ) : !activeTrip ? (
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
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: sp.lg, paddingBottom: bottomNavOffset + 40 }}
          >
            <NoTripWelcome
              firstName={profile?.firstName}
              onHostPress={() => {
                setModalInitialMode('host');
                setHostJoinModalVisible(true);
              }}
              onJoinPress={() => {
                setModalInitialMode('join');
                setHostJoinModalVisible(true);
              }}
            />
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
          contentContainerStyle={{ paddingHorizontal: sp.lg, paddingTop: sp.md, paddingBottom: bottomNavOffset + 40 }}
        >
          {/* ACTIVE TRIP HERO BANNER */}
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 20,
              padding: 16,
              borderColor: colors.cardBorder,
              borderWidth: 1,
              marginBottom: isLocked ? sp.sm : sp.md,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 10,
              elevation: 2,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.tealDark, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 }}>
                  {activeTrip?.title || 'Barkada Trip'}
                </Text>
                <Text style={{ fontSize: fs.xxl, fontWeight: '900', color: COLORS.textDark, letterSpacing: -0.5 }}>
                  {activeTrip?.destination || 'Planning Stage'}
                </Text>
                <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.subtleDark, marginTop: 2 }}>
                  {activeTrip?.dateRange || 'Dates TBD'}
                </Text>
              </View>

              {/* Today Date Badge */}
              <View style={{ alignItems: 'center' }}>
                <View style={{
                  width: 36,
                  backgroundColor: colors.paper,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  overflow: 'hidden',
                  alignItems: 'center',
                }}>
                  <View style={{ width: '100%', backgroundColor: '#FF3B30', paddingVertical: 2, alignItems: 'center' }}>
                    <Text style={{ fontSize: 7, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' }}>
                      {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][new Date().getMonth()]}
                    </Text>
                  </View>
                  <View style={{ paddingVertical: 2, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: COLORS.textDark }}>
                      {new Date().getDate()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center', paddingBottom: 3 }}>
                    <Text style={{ fontSize: 5.5, fontWeight: '900', color: COLORS.subtleDark, letterSpacing: 0.4 }}>
                      TODAY
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={{ marginBottom: isLocked ? 0 : sp.lg }}>
            {!isLocked && (
              <>
                {/* TRIP VOTING POLLS SECTION */}
                <TripVotingPollsSection
                  tripId={activeTrip?.id || 'default_trip'}
                  isTripEnded={isTripEnded}
                  onPollsUpdated={() => setActiveTrip(TripService.getInstance().getActiveTrip())}
                />
              </>
            )}

            {isLocked && (
              <>
                {/* SECTION DIVIDER - fancy */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: sp.md }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder, opacity: 0.7 }} />
                  <View style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(59,122,158,0.35)' : 'rgba(59,122,158,0.25)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <MapPin size={15} color={colors.tealDark} strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.cardBorder, opacity: 0.7 }} />
                </View>

                {/* Tab Switcher - Typographic with rounded active pill style */}
                <View style={{ flexDirection: 'row', gap: sp.sm }}>
                  {(['Itinerary', 'Spots'] as const).map((tab) => {
                    const isSelected = activeSubTab === tab;
                    const label = tab === 'Spots' ? 'Suggested Spots' : tab;
                    return (
                      <TouchableOpacity
                        key={tab}
                        onPress={() => setActiveSubTab(tab)}
                        style={{
                          paddingVertical: sp.sm,
                          paddingHorizontal: sp.md,
                          borderRadius: 100,
                          backgroundColor: isSelected ? colors.tealDark : 'transparent',
                          borderWidth: 1,
                          borderColor: isSelected ? colors.tealDark : colors.cardBorder,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: isSelected ? '#FFFFFF' : COLORS.subtleDark,
                          }}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Pending Invitation Banner */}
          {pendingInvite && (
            <View
              style={{
                backgroundColor: colors.lightOrangeBg,
                borderColor: colors.orangeAccent,
                borderWidth: 1,
                borderRadius: 20,
                padding: 16,
                marginBottom: sp.lg,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Sparkles size={18} color={colors.orangeAccent} />
                <Text style={{ fontSize: 13, fontWeight: '900', color: colors.orangeAccent }}>
                  PENDING TRIP INVITATION
                </Text>
              </View>

              <Text style={{ fontSize: 14, fontWeight: '800', color: colors.ink, marginBottom: 4 }}>
                {pendingInvite.hostName} invited you to "{pendingInvite.tripTitle}"
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginBottom: 12 }}>
                {[
                  pendingInvite.destination ? `Destination: ${pendingInvite.destination}` : null,
                  pendingInvite.dateRange ? `Dates: ${pendingInvite.dateRange}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ') || 'Place & dates — voting soon'}
              </Text>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onViewInvitation}
                style={{
                  backgroundColor: colors.tealDark,
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 6,
                }}
              >
                <CheckCircle2 size={16} color="#FFF" />
                <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '900' }}>
                  View Invitation Details & Accept
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!isTripEnded && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#EAFBF4',
                borderColor: isDark ? 'rgba(16,185,129,0.35)' : '#EAFBF4',
                borderWidth: 1,
                borderRadius: 18,
                padding: 14,
                marginTop: sp.lg,
                marginBottom: sp.lg,
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#10B981',
                }}
              >
                <CheckCircle2 size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: colors.ink }}>
                  Place & dates locked in!
                </Text>
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft, marginTop: 2, lineHeight: 16 }}>
                  Your barkada's set on {activeTrip?.destination} ({activeTrip?.dateRange}). Now you can plan your itinerary.
                </Text>
              </View>
            </View>
          )}

          {/* ================= WHERE YOU'LL STAY ================= */}
          <View style={{ marginTop: sp.lg, marginBottom: sp.lg }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.md, gap: 8 }}>
              {/* Left Title, Count & Collapse Toggle */}
              <TouchableOpacity
                onPress={isLocked && stays.length > 0 ? () => setStaysCollapsed((prev) => !prev) : undefined}
                activeOpacity={isLocked && stays.length > 0 ? 0.75 : 1}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}
              >
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BedDouble size={16} color={colors.tealDark} strokeWidth={2.4} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '900', color: COLORS.textDark }}>
                  {isTripEnded ? 'Where You Stayed' : "Where You'll Stay"}
                </Text>
                {isLocked && stays.length > 0 && (
                  <View style={{ backgroundColor: isDark ? 'rgba(59,122,158,0.25)' : '#E0F2FE', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, flexShrink: 0 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.tealDark }}>
                      {stays.length}
                    </Text>
                  </View>
                )}
                {isLocked && stays.length > 0 && (
                  <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', flexShrink: 0 }}>
                    {staysCollapsed ? (
                      <ChevronDown size={14} color={colors.inkSoft} strokeWidth={2.5} />
                    ) : (
                      <ChevronUp size={14} color={colors.inkSoft} strokeWidth={2.5} />
                    )}
                  </View>
                )}
              </TouchableOpacity>

              {/* Right Action: Add Stay */}
              {isHost && isLocked && !isTripEnded && (
                <TouchableOpacity
                  onPress={openAddStay}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 11,
                    paddingVertical: 6,
                    borderRadius: 100,
                    backgroundColor: colors.tealDark,
                    flexShrink: 0,
                  }}
                >
                  <Plus size={13} color="#FFFFFF" strokeWidth={2.6} />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>Add Stay</Text>
                </TouchableOpacity>
              )}
            </View>

            {!isLocked && !isTripEnded ? (
              /* Locked hint — stays unlock once place & dates are locked in */
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9', borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 16, padding: 14 }}>
                <Lock size={16} color={COLORS.subtleDark} strokeWidth={2.2} />
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: COLORS.subtleDark, lineHeight: 16 }}>
                  Stays open once your place & dates are locked in — then the host can pick where everyone sleeps.
                </Text>
              </View>
            ) : staysLoading && stays.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                <ActivityIndicator color={colors.tealDark} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.subtleDark }}>Loading stays…</Text>
              </View>
            ) : stays.length === 0 ? (
              <TouchableOpacity
                onPress={isHost && !isTripEnded ? openAddStay : undefined}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.tealDark,
                  borderRadius: 16, padding: 16,
                  backgroundColor: isDark ? 'rgba(59,122,158,0.08)' : '#EBF5FB',
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : 'rgba(59,122,158,0.14)', alignItems: 'center', justifyContent: 'center' }}>
                  <BedDouble size={17} color={colors.tealDark} strokeWidth={2.2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.tealDark }}>
                    {isTripEnded ? 'No stays added' : (isHost ? 'Pick where the barkada stays' : 'No stays yet')}
                  </Text>
                  <Text style={{ fontSize: 10.5, fontWeight: '600', color: COLORS.subtleDark, marginTop: 2, lineHeight: 14 }}>
                    {isTripEnded ? 'Stays are locked for completed trips.' : (isHost ? 'Tap to add a hotel, resort, or airbnb.' : "The host hasn't picked a place to stay yet.")}
                  </Text>
                </View>
              </TouchableOpacity>
            ) : staysCollapsed ? (
              /* Collapsed Summary Card */
              <TouchableOpacity
                onPress={() => setStaysCollapsed(false)}
                activeOpacity={0.85}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: colors.card,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  padding: 14,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 1,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#EBF5FB', alignItems: 'center', justifyContent: 'center' }}>
                    <BedDouble size={16} color={colors.tealDark} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
                      {stays.length} {stays.length === 1 ? 'Stay' : 'Stays'} Selected
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, marginTop: 1 }}>
                      {stays.map((s) => s.title).join(' · ')}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: colors.tealDark }}>Show</Text>
                  <ChevronDown size={15} color={colors.tealDark} strokeWidth={2.4} />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ gap: sp.md }}>
                {stays.map((stay) => {
                  const isMine = stay.createdBy === profile?.id;
                  const likers = (stay.reactions || []).filter((r) => r.reaction === 'like');
                  const dislikers = (stay.reactions || []).filter((r) => r.reaction === 'dislike');
                  const stayComments = stay.comments || [];
                  return (
                    <View key={stay.id} style={{ backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.cardBorder, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
                      {/* Cover / placeholder */}
                      <View>
                        {stay.photoReference ? (
                          <ShimmerImage source={{ uri: getPlacePhotoUrl(stay.photoReference, 900) }} style={{ width: '100%', height: isTablet ? 180 : 150 }} />
                        ) : (
                          <View style={{ width: '100%', height: isTablet ? 180 : 150, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EFF3EA' }}>
                            <BedDouble size={36} color={colors.tealDark} strokeWidth={1.8} />
                          </View>
                        )}

                        {/* Nights badge (top-left) */}
                        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }}>
                          <CalendarDays size={11} color="#FFFFFF" strokeWidth={2.4} />
                          <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 }}>
                            {stay.endDay > stay.startDay ? `NIGHTS ${stay.startDay}–${stay.endDay}` : `NIGHT ${stay.startDay}`}
                          </Text>
                        </View>

                        {/* Edit / Delete — host only (top-right) */}
                        {isMine && isHost && !isTripEnded && (
                          <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6, zIndex: 3 }}>
                            <TouchableOpacity onPress={() => openEditStay(stay)} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)' }}>
                              <Pencil size={12} color={colors.tealDark} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setStayToDelete(stay)} hitSlop={8} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.95)' }}>
                              <Trash2 size={12} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <View style={{ padding: 14 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <Text style={{ flex: 1, fontSize: fs.md, fontWeight: '800', color: COLORS.textDark }}>
                            {stay.title}
                          </Text>
                        </View>
                        {!!stay.placeAddress && (
                          <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: '700', color: COLORS.subtleDark, letterSpacing: 0.2, marginTop: 2 }}>
                            {stay.placeAddress}
                          </Text>
                        )}

                        {/* Dates to stay */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                          <CalendarDays size={11} color={colors.tealDark} strokeWidth={2.4} />
                          <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.tealDark }}>
                            {stayDateLabel(stay)}
                          </Text>
                        </View>

                        {/* Link + directions */}
                        {(!!stay.link || stay.placeId) && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                            {!!stay.link && (
                              <TouchableOpacity onPress={() => openStayLink(stay)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: colors.tealDark, backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB' }}>
                                <LinkIcon size={11} color={colors.tealDark} strokeWidth={2.4} />
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.tealDark }}>Booking Link</Text>
                              </TouchableOpacity>
                            )}
                            {(stay.placeId || stay.placeAddress) && (
                              <TouchableOpacity onPress={() => openStayDirections(stay)} activeOpacity={0.85} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: colors.tealDark, backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB' }}>
                                <Navigation size={11} color={colors.tealDark} strokeWidth={2.4} />
                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.tealDark }}>Directions</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        )}

                        {!!stay.note && (
                          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 6, marginTop: 8 }}>
                            <Text style={{ fontSize: 10, fontWeight: '600', color: AppColors.sky }}>+ {stay.note}</Text>
                          </View>
                        )}

                        {/* Reactions */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleReactStay(stay, 'like')}
                            disabled={isTripEnded}
                            activeOpacity={0.8}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: stay.myReaction === 'like' ? (isDark ? 'rgba(16,185,129,0.2)' : '#E6F4EA') : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'), borderWidth: 1, borderColor: stay.myReaction === 'like' ? '#10B981' : 'transparent', opacity: isTripEnded ? 0.75 : 1 }}
                          >
                            <ThumbsUp size={12} color={stay.myReaction === 'like' ? '#10B981' : COLORS.subtleDark} fill={stay.myReaction === 'like' ? '#10B981' : 'transparent'} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: stay.myReaction === 'like' ? '#10B981' : COLORS.subtleDark }}>
                              {stay.likeCount || 0}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleReactStay(stay, 'dislike')}
                            disabled={isTripEnded}
                            activeOpacity={0.8}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, backgroundColor: stay.myReaction === 'dislike' ? (isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6') : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'), borderWidth: 1, borderColor: stay.myReaction === 'dislike' ? '#EF4444' : 'transparent', opacity: isTripEnded ? 0.75 : 1 }}
                          >
                            <ThumbsDown size={12} color={stay.myReaction === 'dislike' ? '#EF4444' : COLORS.subtleDark} fill={stay.myReaction === 'dislike' ? '#EF4444' : 'transparent'} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: stay.myReaction === 'dislike' ? '#EF4444' : COLORS.subtleDark }}>
                              {stay.dislikeCount || 0}
                            </Text>
                          </TouchableOpacity>

                          {(likers.length > 0 || dislikers.length > 0) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 4 }}>
                              {likers.slice(0, 3).map((r) => (
                                <View key={r.id} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900' }}>{r.userInitials}</Text>
                                </View>
                              ))}
                              {dislikers.slice(0, 2).map((r) => (
                                <View key={r.id} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}>
                                  <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900' }}>{r.userInitials}</Text>
                                </View>
                              ))}
                              <Text numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '600', color: COLORS.subtleDark, flexShrink: 1 }}>
                                {likers.length + dislikers.length > 4 ? `+${likers.length + dislikers.length - 4}` : ''}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Comments */}
                        <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 10 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                            <MessageCircle size={12} color={COLORS.subtleDark} />
                            <Text style={{ fontSize: 10, fontWeight: '800', color: COLORS.subtleDark, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              Comments ({stay.commentCount || 0})
                            </Text>
                          </View>

                          {stayComments.map((c) => (
                            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: '#FFF', fontSize: 8, fontWeight: '900' }}>{c.userInitials}</Text>
                              </View>
                              <View style={{ flex: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.ink }}>
                                    {c.userId === profile?.id ? 'You' : `${c.userFirstName || ''} ${c.userLastName || ''}`.trim() || 'Barkada'}
                                  </Text>
                                  {c.userId === profile?.id && !isTripEnded && (
                                    <TouchableOpacity onPress={() => handleDeleteStayComment(stay.id, c.id)} hitSlop={8}>
                                      <Trash2 size={11} color={COLORS.subtleDark} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.ink, marginTop: 1, lineHeight: 15 }}>
                                  {c.comment}
                                </Text>
                              </View>
                            </View>
                          ))}

                          {/* Comment input */}
                          {!isTripEnded ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderRadius: 100, borderWidth: 1, borderColor: colors.cardBorder, paddingLeft: 12, paddingRight: 4 }}>
                                <TextInput
                                  style={{ flex: 1, paddingVertical: 8, color: colors.ink, fontSize: 11 }}
                                  placeholder="Add a comment…"
                                  placeholderTextColor={COLORS.subtleDark}
                                  value={commentDrafts[stay.id] || ''}
                                  onChangeText={(t) => setCommentDrafts((prev) => ({ ...prev, [stay.id]: t }))}
                                  onSubmitEditing={() => handleSendStayComment(stay.id)}
                                  returnKeyType="send"
                                  blurOnSubmit={false}
                                />
                                <TouchableOpacity
                                  onPress={() => handleSendStayComment(stay.id)}
                                  disabled={!(commentDrafts[stay.id] || '').trim() || commentSending}
                                  style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: (commentDrafts[stay.id] || '').trim() ? colors.tealDark : 'transparent' }}
                                >
                                  <Send size={13} color={(commentDrafts[stay.id] || '').trim() ? '#FFFFFF' : COLORS.subtleDark} />
                                </TouchableOpacity>
                              </View>
                            </View>
                          ) : (
                            <View style={{ paddingVertical: 6, alignItems: 'center' }}>
                              <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.inkSoft }}>
                                Comments closed (Trip Ended)
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* ================= ITINERARY ================= */}
          {activeSubTab === 'Itinerary' && (
            <View>
              {/* Premium Segmented Day Selector */}
              <View style={{ 
                flexDirection: 'row', 
                backgroundColor: colors.card, 
                padding: 6, 
                borderRadius: 100, 
                borderWidth: 1, 
                borderColor: colors.cardBorder, 
                marginBottom: sp.xl,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.04,
                shadowRadius: 12,
                elevation: 2,
                position: 'relative',
              }}>
                <Animated.View style={{
                  position: 'absolute',
                  top: 6,
                  bottom: 6,
                  left: 6,
                  width: pillWidth,
                  backgroundColor: colors.tealDark,
                  borderRadius: 100,
                  transform: [{
                    translateX: slideAnim.interpolate({
                      inputRange: dayOffsets,
                      outputRange: dayOffsets.map((o) => pillWidth * o),
                    })
                  }]
                }} />
                {dayOffsets.map((offset) => {
                  const dayNum = offset + 1;
                  const isSelected = selectedDay === dayNum;
                  const dateObj = getDayDate(offset);
                  const monthStr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dateObj.getMonth()];
                  const dateStr = `${monthStr} ${dateObj.getDate()}`;

                  return (
                    <TouchableOpacity
                      key={dayNum}
                      onPress={() => setSelectedDay(dayNum)}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 100,
                        backgroundColor: 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 9, fontWeight: '800', color: isSelected ? 'rgba(255,255,255,0.85)' : COLORS.subtleDark, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {dayNum === 1 ? (hasTripDates ? 'DAY 1' : 'TODAY') : `DAY ${dayNum}`}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: isSelected ? '#FFFFFF' : COLORS.textDark, letterSpacing: 0.5 }}>
                        {dateStr}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Day Summary */}
              <View style={{ marginBottom: sp.xl, paddingLeft: 12, borderLeftWidth: 4, borderLeftColor: AppColors.emerald }}>
                <Text style={{ fontSize: fs.lg, fontWeight: '900', color: COLORS.textDark }}>
                  {activeTrip?.destination || 'Island Hopping + Lagoons'}
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.subtleDark, marginTop: 4, letterSpacing: 0.5 }}>
                  {hasTripDates && tripDates
                    ? `Day ${selectedDay} · ${getDayDate(selectedDay - 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                    : `${itineraryItems.length} ${itineraryItems.length === 1 ? 'stop' : 'stops'} planned`}
                </Text>
              </View>

              {/* Add-to-Itinerary CTA */}
              {!isTripEnded && (
                <TouchableOpacity
                  onPress={openAddItinerary}
                  activeOpacity={0.85}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: colors.tealDark,
                    borderRadius: 16,
                    paddingVertical: 14,
                    marginBottom: sp.xl,
                    backgroundColor: isDark ? 'rgba(59,122,158,0.08)' : '#EBF5FB',
                  }}
                >
                  <Plus size={17} color={colors.tealDark} strokeWidth={2.5} />
                  <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.tealDark }}>
                    Add a Spot for Day {selectedDay}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Timeline */}
              {itineraryLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                  <ActivityIndicator color={colors.tealDark} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.subtleDark }}>
                    Loading the plan…
                  </Text>
                </View>
              ) : itineraryItems.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20, gap: 6 }}>
                  <MapPin size={26} color={COLORS.subtleDark} strokeWidth={1.6} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: COLORS.textDark }}>
                    Nothing planned for Day {selectedDay} yet
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: COLORS.subtleDark, textAlign: 'center', lineHeight: 16 }}>
                    {isTripEnded
                      ? 'No stops were recorded for this day.'
                      : 'Tap "Add a Spot" above to drop the first stop — everyone in the trip can add and react to it.'}
                  </Text>
                </View>
              ) : (
              <View style={{ gap: sp.lg }}>
                {itineraryItems.map((item, idx) => {
                  const isCompleted = completedItems[item.id] !== undefined ? completedItems[item.id] : !!item.isCompleted;
                  const isMine = item.createdBy === profile?.id;
                  const tagIcon = item.tag === 'TRANSPORT' ? <MapPin size={10} color={colors.orangeAccent} style={{ marginRight: 4 }} />
                    : item.tag === 'FOOD' ? <Utensils size={10} color={colors.orangeAccent} style={{ marginRight: 4 }} />
                    : item.tag === 'MEETUP' ? <Users size={10} color={colors.orangeAccent} style={{ marginRight: 4 }} />
                    : <Compass size={10} color={colors.orangeAccent} style={{ marginRight: 4 }} />;
                  const likers = (item.reactions || []).filter((r) => r.reaction === 'like');
                  const dislikers = (item.reactions || []).filter((r) => r.reaction === 'dislike');

                  return (
                    <View key={item.id} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      {/* Time Column — always a single line, never wraps */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={isTripEnded ? undefined : () => toggleItemCompletion(item)}
                        style={{ width: 74, alignItems: 'flex-start', paddingTop: 4 }}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                          allowFontScaling={false}
                          style={{
                            fontSize: fs.md,
                            fontWeight: '900',
                            color: isCompleted ? COLORS.subtleDark : COLORS.textDark,
                            textDecorationLine: isCompleted ? 'line-through' : 'none',
                          }}
                        >
                          {item.time || '--:--'}
                        </Text>
                      </TouchableOpacity>

                      {/* Timeline Line & Node */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={isTripEnded ? undefined : () => toggleItemCompletion(item)}
                        style={{ width: 24, alignItems: 'center' }}
                      >
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: isCompleted ? COLORS.subtleDark : colors.tealDark,
                            marginTop: 8,
                          }}
                        />
                        {idx < itineraryItems.length - 1 && (
                          <View
                            style={{
                              width: 2,
                              flex: 1,
                              backgroundColor: COLORS.borderLight,
                              marginVertical: 4,
                            }}
                          />
                        )}
                      </TouchableOpacity>

                      {/* Content Card */}
                      <View style={{ flex: 1, paddingBottom: sp.xl, opacity: isCompleted ? 0.45 : 1 }}>
                        <TouchableOpacity
                          activeOpacity={0.88}
                          onPress={isTripEnded ? undefined : () => toggleItemCompletion(item)}
                        >
                          {!!item.photoReference ? (
                            <View style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 10 }}>
                              <ShimmerImage
                                source={{ uri: getPlacePhotoUrl(item.photoReference, 900) }}
                                style={{ width: '100%', height: itineraryImgHeight }}
                                borderRadius={14}
                              />

                              {/* Badges overlaid on the image (bottom-left) */}
                              <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 2 }}>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: 'rgba(0,0,0,0.55)',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 6,
                                  }}
                                >
                                  {tagIcon}
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 }}>
                                    {item.tag || item.category}
                                  </Text>
                                </View>
                              </View>

                              {/* Edit / Delete always on top of the image (top-right) */}
                              {isMine && !isTripEnded && (
                                <View style={{ position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6, zIndex: 3 }}>
                                  <TouchableOpacity
                                    onPress={() => openEditItinerary(item)}
                                    hitSlop={8}
                                    style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.95)' }}
                                  >
                                    <Pencil size={12} color={colors.tealDark} />
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={() => setItemToDelete(item)}
                                    hitSlop={8}
                                    style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.95)' }}
                                  >
                                    <Trash2 size={12} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              )}

                              {/* Get Directions — bottom-right over the image */}
                              {(item.placeId || item.placeAddress || item.placeName) && (
                                <TouchableOpacity
                                  onPress={() => openDirections(item)}
                                  activeOpacity={0.85}
                                  style={{
                                    position: 'absolute',
                                    right: 8,
                                    bottom: 8,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    backgroundColor: 'rgba(0,0,0,0.62)',
                                    paddingHorizontal: 11,
                                    paddingVertical: 6,
                                    borderRadius: 100,
                                    zIndex: 2,
                                  }}
                                >
                                  <Navigation size={12} color="#FFFFFF" strokeWidth={2.4} />
                                  <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#FFFFFF' }}>
                                    Get Directions
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.lightOrangeBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                {tagIcon}
                                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.orangeAccent, letterSpacing: 1 }}>
                                  {item.tag || item.category}
                                </Text>
                              </View>

                              {isMine && !isTripEnded && (
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                  <TouchableOpacity onPress={() => openEditItinerary(item)} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }}>
                                    <Pencil size={11} color={colors.tealDark} />
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => setItemToDelete(item)} hitSlop={8} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FCE8E6' }}>
                                    <Trash2 size={11} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          )}

                          <View style={{ marginBottom: 4 }}>
                            <Text
                              style={{
                                fontSize: fs.md,
                                fontWeight: '800',
                                color: isCompleted ? COLORS.subtleDark : COLORS.textDark,
                                textDecorationLine: isCompleted ? 'line-through' : 'none',
                              }}
                            >
                              {item.title}
                            </Text>
                          </View>

                          {(!!item.location || !!item.estCost) && (
                            <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.subtleDark, letterSpacing: 0.2, marginBottom: 8, textDecorationLine: isCompleted ? 'line-through' : 'none' }}>
                              {item.location}
                              {item.estCost ? `${item.location ? ' — ' : ''}${item.estCost}` : ''}
                            </Text>
                          )}

                          {!!item.note && (
                            <View style={{ borderTopWidth: 1, borderTopColor: COLORS.borderLight, paddingTop: 6, marginBottom: 8 }}>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: isCompleted ? COLORS.subtleDark : AppColors.sky, textDecorationLine: isCompleted ? 'line-through' : 'none' }}>
                                + {item.note}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Get Directions — only for real places/spots (inline when there's no image) */}
                        {!item.photoReference && (item.placeId || item.placeAddress || item.placeName) && (
                          <TouchableOpacity
                            onPress={() => openDirections(item)}
                            activeOpacity={0.8}
                            style={{
                              alignSelf: 'flex-start',
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 5,
                              paddingHorizontal: 11,
                              paddingVertical: 6,
                              borderRadius: 100,
                              borderWidth: 1,
                              borderColor: colors.tealDark,
                              backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB',
                              marginBottom: 8,
                            }}
                          >
                            <Navigation size={12} color={colors.tealDark} strokeWidth={2.4} />
                            <Text style={{ fontSize: 10.5, fontWeight: '800', color: colors.tealDark }}>
                              Get Directions
                            </Text>
                          </TouchableOpacity>
                        )}

                          {/* Reactions */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 }}>
                            <TouchableOpacity
                              onPress={() => handleReact(item, 'like')}
                              disabled={isTripEnded}
                              activeOpacity={0.8}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 100,
                                backgroundColor: item.myReaction === 'like'
                                  ? (isDark ? 'rgba(16,185,129,0.2)' : '#E6F4EA')
                                  : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
                                borderWidth: 1,
                                borderColor: item.myReaction === 'like' ? '#10B981' : 'transparent',
                                opacity: isTripEnded ? 0.75 : 1,
                              }}
                            >
                              <ThumbsUp size={12} color={item.myReaction === 'like' ? '#10B981' : COLORS.subtleDark} fill={item.myReaction === 'like' ? '#10B981' : 'transparent'} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: item.myReaction === 'like' ? '#10B981' : COLORS.subtleDark }}>
                                {item.likeCount || 0}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => handleReact(item, 'dislike')}
                              disabled={isTripEnded}
                              activeOpacity={0.8}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 5,
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 100,
                                backgroundColor: item.myReaction === 'dislike'
                                  ? (isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6')
                                  : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
                                borderWidth: 1,
                                borderColor: item.myReaction === 'dislike' ? '#EF4444' : 'transparent',
                                opacity: isTripEnded ? 0.75 : 1,
                              }}
                            >
                              <ThumbsDown size={12} color={item.myReaction === 'dislike' ? '#EF4444' : COLORS.subtleDark} fill={item.myReaction === 'dislike' ? '#EF4444' : 'transparent'} />
                              <Text style={{ fontSize: 11, fontWeight: '800', color: item.myReaction === 'dislike' ? '#EF4444' : COLORS.subtleDark }}>
                                {item.dislikeCount || 0}
                              </Text>
                            </TouchableOpacity>

                            {(likers.length > 0 || dislikers.length > 0) && (
                              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap', gap: 4 }}>
                                {likers.slice(0, 3).map((r) => (
                                  <View key={r.id} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900' }}>{r.userInitials}</Text>
                                  </View>
                                ))}
                                {dislikers.slice(0, 2).map((r) => (
                                  <View key={r.id} style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#FFF', fontSize: 7, fontWeight: '900' }}>{r.userInitials}</Text>
                                  </View>
                                ))}
                                <Text numberOfLines={1} style={{ fontSize: 8.5, fontWeight: '600', color: COLORS.subtleDark, flexShrink: 1 }}>
                                  {likers.length + dislikers.length > 4 ? `+${likers.length + dislikers.length - 4}` : ''}
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Meta: who added / last edited */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
                            <UsersRound size={10} color={COLORS.subtleDark} />
                            <Text numberOfLines={1} style={{ fontSize: 9, fontWeight: '600', color: COLORS.subtleDark, flex: 1 }}>
                              {isMine ? 'Added by you' : `Added by ${item.createdByName || 'a barkada'}`}
                              {item.updatedByName && ` · edited by ${item.updatedByName}`}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ================= SPOTS ================= */}
          {activeSubTab === 'Spots' && (
            <View>
              {/* Soft Category Links — smart filters chosen from the destination */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sp.xl }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ paddingRight: sp.sm }}>
                  <View style={{ flexDirection: 'row', gap: sp.lg, alignItems: 'baseline' }}>
                    {smartCategories.map((cat) => {
                      const isSelected = selectedCategory === cat.key;
                      return (
                        <TouchableOpacity key={cat.key} onPress={() => setSelectedCategory(cat.key)} activeOpacity={0.7}>
                          <Text
                            style={{
                              fontSize: 22,
                              fontWeight: '900',
                              color: isSelected ? COLORS.textDark : (isDark ? '#4B5563' : '#D1C9B9'),
                              textDecorationLine: isSelected ? 'underline' : 'none',
                            }}
                          >
                            {cat.label.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
                <TouchableOpacity
                  onPress={() => loadAiSpots(true)}
                  disabled={spotsLoading}
                  activeOpacity={0.7}
                  style={{
                    marginLeft: sp.sm,
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: colors.cardBorder,
                  }}
                >
                  {spotsLoading ? (
                    <ActivityIndicator size={12} color={colors.tealDark} />
                  ) : (
                    <RefreshCw size={15} color={colors.tealDark} strokeWidth={2.4} />
                  )}
                </TouchableOpacity>
              </View>

              {/* Spots Carousel — real AI + Google Places picks, tappable */}
              {spotsLoading && aiSpots.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: sp.xl, marginBottom: sp.xl }}>
                  <ActivityIndicator color={colors.tealDark} size="small" />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.subtleDark, marginTop: sp.sm }}>
                    Navi is finding {smartCategories.find((c) => c.key === selectedCategory)?.label.toLowerCase() || 'spots'}…
                  </Text>
                </View>
              ) : aiSpots.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: sp.xxl, marginHorizontal: -sp.lg }} contentContainerStyle={{ paddingHorizontal: sp.lg }}>
                  <View style={{ flexDirection: 'row', gap: sp.md }}>
                    {aiSpots.map((spot) => (
                      <SpotCard
                        key={spot.placeId}
                        spot={spot}
                        isPicked={selectedSpot?.placeId === spot.placeId}
                        isDark={isDark}
                        teal={colors.tealDark}
                        width={spotCardWidth}
                        imgHeight={spotImgHeight}
                        titleSize={fs.sm}
                        gap={sp.sm}
                        borderLight={COLORS.borderLight}
                        textDark={COLORS.textDark}
                        subtleDark={COLORS.subtleDark}
                        onPress={(s) => setSelectedSpot(s)}
                      />
                    ))}
                  </View>
                </ScrollView>
              ) : (
                !spotsLoading && (
                  <View style={{ marginBottom: sp.xxl, padding: sp.lg, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9', borderRadius: 16 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.subtleDark, textAlign: 'center' }}>
                      {spotsError || 'No suggestions yet for this category.'}
                    </Text>
                  </View>
                )
              )}

              {/* Navi's Suggestion — details of the selected spot, with Add to Itinerary */}
              <View style={{ backgroundColor: colors.card, borderRadius: 20, padding: sp.md, borderWidth: 1, borderColor: colors.cardBorder }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sp.md }}>
                  <Image source={naviMascot} style={{ width: 30, height: 30, borderRadius: 15 }} />
                  <Text style={{ fontSize: 11, fontWeight: '900', letterSpacing: 1, color: COLORS.textDark, textTransform: 'uppercase', marginLeft: 8 }}>
                    Navi's Suggestion
                  </Text>
                </View>

                {selectedSpot ? (
                  <>
                    <View style={{ height: imgHeight, marginBottom: sp.md, borderRadius: 16, overflow: 'hidden' }}>
                      {selectedSpot.photoReference ? (
                        <ShimmerImage source={{ uri: getPlacePhotoUrl(selectedSpot.photoReference, 900) }} style={{ width: '100%', height: '100%' }} borderRadius={16} />
                      ) : (
                        <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EFF3EA' }}>
                          <Compass size={32} color={colors.tealDark} />
                        </View>
                      )}
                    </View>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Text style={{ fontSize: fs.xl, fontWeight: '900', color: COLORS.textDark, flex: 1, marginRight: sp.sm }}>
                        {selectedSpot.name}
                      </Text>
                      <View style={{ backgroundColor: AppColors.lightGreenBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: AppColors.emerald, textTransform: 'uppercase' }}>
                          {selectedSpot.matchScore}% Match
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: sp.md }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, fontWeight: '800', color: COLORS.subtleDark, letterSpacing: 0, marginRight: sp.sm }}>
                        {selectedSpot.address}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#F59E0B' }}>
                        {selectedSpot.rating ? `${selectedSpot.rating.toFixed(1)}★` : ''}
                      </Text>
                    </View>

                    <Text style={{ fontSize: 12, fontWeight: '500', color: COLORS.textDark, lineHeight: 18, marginBottom: sp.lg }}>
                      {selectedSpot.description}
                    </Text>

                    <TouchableOpacity
                      onPress={isTripEnded ? undefined : () => openAddSpotToItinerary(selectedSpot)}
                      disabled={isTripEnded}
                      style={{
                        backgroundColor: isTripEnded ? (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0') : colors.tealDark,
                        paddingVertical: sp.md,
                        borderRadius: 14,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: isTripEnded ? colors.inkSoft : '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
                        {isTripEnded ? 'Trip Ended · Read-Only' : 'Add to Itinerary'}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.subtleDark, textAlign: 'center', paddingVertical: sp.xl }}>
                    Tap a spot above to see its details.
                  </Text>
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>

      {/* Host / Join Trip Modal */}
      <HostJoinTripModal
        visible={hostJoinModalVisible}
        initialMode={modalInitialMode}
        onClose={() => setHostJoinModalVisible(false)}
        onTripCreatedOrJoined={() => {
          const newlyActive = TripService.getInstance().getActiveTrip();
          setActiveTrip(newlyActive);
          setAllTrips(TripService.getInstance().getTrips());
          setTripDetailsVisible(true);
        }}
      />

      {/* Trip Selector Modal */}
      <TripSelectorModal
        visible={showTripSelector}
        activeTripId={activeTrip?.id || ''}
        trips={allTrips}
        currentUserId={profile?.id}
        onClose={() => setShowTripSelector(false)}
        onSelectTrip={(id) => {
          TripService.getInstance().setActiveTripId(id);
          setActiveTrip(TripService.getInstance().getActiveTrip());
        }}
        onOpenHostJoin={() => {
          setModalInitialMode('choice');
          setHostJoinModalVisible(true);
        }}
        onDeleteTrip={async (tripId) => {
          const ok = await TripService.getInstance().deleteTripDB(tripId, profile?.id);
          if (ok) {
            setActiveTrip(TripService.getInstance().getActiveTrip());
            setAllTrips(TripService.getInstance().getTrips());
          }
          return ok;
        }}
        onRenameTrip={async (tripId, newTitle) => {
          const ok = await TripService.getInstance().renameTripDB(tripId, newTitle, profile?.id);
          if (ok) {
            setActiveTrip(TripService.getInstance().getActiveTrip());
            setAllTrips(TripService.getInstance().getTrips());
          }
          return ok;
        }}
      />

      {/* Edit Tour (host-only) — reopen voting + new mandatory deadline */}
      <EditTourModal
        visible={editTourVisible}
        currentDeadline={activeTrip?.votingDeadline || null}
        onClose={() => setEditTourVisible(false)}
        onSave={handleEditTourSave}
      />

      {/* Add / Edit Itinerary Spot */}
      <ItineraryAddModal
        visible={itineraryModalVisible}
        mode={itineraryModalMode}
        tripId={activeTrip?.id || ''}
        dayNumber={selectedDay}
        userId={profile?.id || ''}
        initialItem={editingItem}
        initialPlace={
          addingSpot
            ? ({
                placeId: addingSpot.placeId || undefined,
                name: addingSpot.name,
                address: addingSpot.address || undefined,
                photoReference: addingSpot.photoReference || undefined,
              } as ItineraryPlacePrefill)
            : null
        }
        dayCount={tripDayCount}
        tripStartDate={tripDates ? tripDates.start : null}
        onClose={() => setItineraryModalVisible(false)}
        onSaved={(savedDay) => {
          setSelectedDay(savedDay);
          loadItinerary(activeTrip?.id || '', savedDay);
        }}
      />

      {/* Delete Itinerary Item Confirmation */}
      <Modal
        transparent
        visible={!!itemToDelete}
        animationType="fade"
        onRequestClose={() => setItemToDelete(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setItemToDelete(null)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
              Remove this spot?
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.subtleDark, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              "{itemToDelete?.title || 'This spot'}" will be permanently removed from the itinerary, along with its likes and dislikes. This cannot be undone.
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleDeleteItinerary(itemToDelete!)}
                disabled={deletingItem}
                style={{
                  backgroundColor: '#EF4444',
                  paddingVertical: 13,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {deletingItem ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                    Yes, Remove Spot
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setItemToDelete(null)}
                disabled={deletingItem}
                style={{
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  paddingVertical: 11,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: COLORS.subtleDark, fontSize: 13, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add / Edit Stay (host only) */}
      <StayAddModal
        visible={stayModalVisible}
        mode={stayModalMode}
        tripId={activeTrip?.id || ''}
        userId={profile?.id || ''}
        dayCount={tripDayCount}
        tripStartDate={tripDates ? tripDates.start : null}
        initialDay={selectedDay}
        initialStay={editingStay}
        onClose={() => setStayModalVisible(false)}
        onSaved={() => loadStays(activeTrip?.id || '')}
      />

      {/* Delete Stay Confirmation */}
      <Modal
        transparent
        visible={!!stayToDelete}
        animationType="fade"
        onRequestClose={() => setStayToDelete(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setStayToDelete(null)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: colors.cardBorder, padding: 24, alignItems: 'center', elevation: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center', marginBottom: 6 }}>
              Remove this stay?
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.subtleDark, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              "{stayToDelete?.title || 'This stay'}" will be permanently removed, along with its reactions and comments. This cannot be undone.
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleDeleteStay(stayToDelete!)}
                disabled={deletingStay}
                style={{
                  backgroundColor: '#EF4444',
                  paddingVertical: 13,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {deletingStay ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                    Yes, Remove Stay
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setStayToDelete(null)}
                disabled={deletingStay}
                style={{
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  paddingVertical: 11,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: COLORS.subtleDark, fontSize: 13, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Complete Trip / Early Finish Confirmation Modal */}
      <Modal
        transparent
        visible={showCompleteModal}
        animationType="fade"
        onRequestClose={() => setShowCompleteModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowCompleteModal(false)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header with Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: dayInfo?.isEarly
                    ? (isDark ? 'rgba(239,68,68,0.18)' : '#FEE2E2')
                    : (isDark ? 'rgba(16,185,129,0.18)' : '#DCFCE7'),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {dayInfo?.isEarly ? (
                  <AlertTriangle size={22} color="#EF4444" strokeWidth={2.4} />
                ) : (
                  <CheckCircle2 size={22} color="#10B981" strokeWidth={2.4} />
                )}
              </View>

              <TouchableOpacity
                onPress={() => setShowCompleteModal(false)}
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

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              {dayInfo?.isEarly ? 'End Trip Early?' : 'Complete This Trip?'}
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 14 }}>
              {dayInfo?.isEarly
                ? `You're currently on Day ${dayInfo.currentDay} of ${dayInfo.totalDays}. Ending early will finalize the trip for everyone.`
                : `Finalize "${activeTrip?.title}" and wrap up the itinerary for the barkada.`}
            </Text>

            {/* Checklist / Info Points */}
            <View
              style={{
                backgroundColor: colors.subtleBg,
                borderRadius: 14,
                padding: 12,
                marginBottom: 18,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Barkada members will be notified
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Trip recap and memories unlocked
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  You can reopen anytime during trip dates
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmCompleteTrip}
                disabled={loadingComplete}
                style={{
                  backgroundColor: dayInfo?.isEarly ? '#EF4444' : '#10B981',
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingComplete ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    {dayInfo?.isEarly ? 'Yes, End Trip Early' : 'Yes, Complete Trip'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowCompleteModal(false)}
                disabled={loadingComplete}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Keep Trip Active
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Undo Complete / Reopen Trip Modal */}
      <Modal
        transparent
        visible={showUndoModal}
        animationType="fade"
        onRequestClose={() => setShowUndoModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
          <Pressable style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onPress={() => setShowUndoModal(false)} />
          <View
            style={{
              width: '100%',
              maxWidth: 360,
              backgroundColor: colors.card,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: colors.cardBorder,
              padding: 22,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.2,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            {/* Header with Close */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: isDark ? 'rgba(59,122,158,0.2)' : '#E0F2FE',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <RotateCcw size={22} color={colors.tealDark} strokeWidth={2.4} />
              </View>

              <TouchableOpacity
                onPress={() => setShowUndoModal(false)}
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

            <Text style={{ fontSize: 17, fontWeight: '900', color: colors.ink, marginBottom: 4 }}>
              Reopen This Trip?
            </Text>
            <Text style={{ fontSize: 12.5, fontWeight: '500', color: colors.inkSoft, lineHeight: 18, marginBottom: 14 }}>
              Restore "{activeTrip?.title}" back to active status for all members.
            </Text>

            {/* Checklist / Info Points */}
            <View
              style={{
                backgroundColor: colors.subtleBg,
                borderRadius: 14,
                padding: 12,
                marginBottom: 18,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Live itinerary planning reactivated
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Members can vote and react to spots
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Check size={14} color={colors.tealDark} strokeWidth={2.6} />
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.ink, flex: 1 }}>
                  Trip countdown and radar restored
                </Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmUndoCompleteTrip}
                disabled={loadingUndo}
                style={{
                  backgroundColor: colors.tealDark,
                  paddingVertical: 13,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loadingUndo ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 13.5, fontWeight: '800' }}>
                    Yes, Reopen Trip
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setShowUndoModal(false)}
                disabled={loadingUndo}
                style={{
                  paddingVertical: 11,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.subtleBg,
                }}
              >
                <Text style={{ color: colors.inkSoft, fontSize: 12.5, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Trip Details & Settings Hub Modal */}
      <TripDetailsModal
        visible={tripDetailsVisible}
        trip={activeTrip}
        onClose={() => setTripDetailsVisible(false)}
        onTripUpdated={() => {
          setActiveTrip(TripService.getInstance().getActiveTrip());
          setAllTrips(TripService.getInstance().getTrips());
        }}
        onEditTour={() => {
          setTripDetailsVisible(false);
          setTimeout(() => {
            setEditTourVisible(true);
          }, 350);
        }}
      />
    </SafeAreaView>
  );
};
