import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Image,
  PanResponder,
  ScrollView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MapPin,
  Users,
  LocateFixed,
  Layers,
  Radio,
  Navigation,
  Battery as BatteryIcon,
  Clock,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Lock,
  CalendarClock,
  CalendarDays,
  Sparkles,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { TripService } from '../../services/tripService';
import { Trip } from '../../types/trip';
import { fetchWeather } from '../../services/weatherService';
import { supabase } from '../../utils/supabase';
import { isWithinTripDates, getTripDayInfo, parseTripDateRange } from '../../utils/tripDates';

interface MemberStatus {
  id: string;
  name: string;
  initial: string;
  avatarBg: string;
  statusText: string;
  address: string;
  distance: string;
  battery: number;
  speed: string;
  lastUpdated: string;
  isMe?: boolean;
  isOnline?: boolean;
  lat: number;
  lng: number;
}

interface PeerLocation {
  userId: string;
  name?: string;
  lat: number;
  lng: number;
  speed: number | null;
  battery: number;
  lastUpdated: string;
  isOnline: boolean;
  address?: string;
}

interface Participant {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  role: 'host' | 'co-host' | 'member';
  status: 'accepted' | 'pending';
}

interface BarkadaRadarScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
}

function calculateDistanceFormatted(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dMeters = R * c;
  if (dMeters < 10) return 'Here';
  if (dMeters < 1000) return `${Math.round(dMeters)}m away`;
  return `${(dMeters / 1000).toFixed(1)} km away`;
}

function latLngToPixel(lat: number, lng: number, zoom: number) {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

// Proximity scatter for real trip members who haven't broadcasted a live GPS coordinate yet
const CLOSE_PROXIMITY_OFFSETS = [
  { lat: 0.00015, lng: 0.00018 },
  { lat: -0.00018, lng: 0.00015 },
  { lat: 0.00010, lng: -0.00020 },
  { lat: -0.00020, lng: -0.00016 },
  { lat: 0.00025, lng: 0.00006 },
  { lat: -0.00012, lng: 0.00026 },
];

const formatSpeed = (speedMps: number | null | undefined): string => {
  if (speedMps == null) return 'Stationary';
  const kmh = speedMps * 3.6;
  if (kmh < 0.5) return 'Stationary';
  return `Moving • ${Math.round(kmh)} km/h`;
};

const buildMembers = (
  participantsList: Participant[],
  myLat: number,
  myLng: number,
  mySpeed: number | null | undefined,
  myBatteryPercent: number,
  myAddressText: string,
  meId: string,
  peers: Record<string, PeerLocation>
): MemberStatus[] => {
  return participantsList.map((p, i) => {
    const isMe = p.id === meId || (meId ? p.id === meId : i === 0);
    const peer = peers[p.id];

    let lat = myLat;
    let lng = myLng;
    let battery = isMe ? myBatteryPercent : (peer?.battery ?? 100);
    let speed = isMe ? formatSpeed(mySpeed) : (peer?.speed != null ? formatSpeed(peer.speed) : 'Stationary');
    let isOnline = isMe ? true : (peer?.isOnline ?? false);
    let statusText = isMe ? 'Live Location (You)' : (isOnline ? 'Live Location' : 'Trip Member');
    let address = isMe ? (myAddressText || 'Current Location') : (peer?.address || myAddressText || 'Trip Member');
    let lastUpdated = isMe ? 'Just now' : (peer?.lastUpdated ? 'Live' : 'Joined');

    if (isMe) {
      lat = myLat;
      lng = myLng;
    } else if (peer && peer.lat && peer.lng) {
      lat = peer.lat;
      lng = peer.lng;
    } else {
      const off = CLOSE_PROXIMITY_OFFSETS[i % CLOSE_PROXIMITY_OFFSETS.length];
      lat = myLat + off.lat;
      lng = myLng + off.lng;
    }

    const distance = isMe ? 'Here' : calculateDistanceFormatted(myLat, myLng, lat, lng);

    return {
      id: p.id,
      name: isMe ? `${p.name} (you)` : p.name,
      initial: p.initials || p.name.charAt(0).toUpperCase(),
      avatarBg: p.avatarBg,
      statusText,
      address,
      distance,
      battery,
      speed,
      lastUpdated,
      isMe,
      isOnline,
      lat,
      lng,
    };
  });
};

const LOCATION_TASK_NAME = 'background-location-task';

// Module-level background state cache for tracking
const backgroundTrackingState = {
  tripId: '',
  userId: '',
  userName: '',
  battery: 100,
  address: '',
};

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[Background Location Task] error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (!location) return;

    let tripId = backgroundTrackingState.tripId;
    let userId = backgroundTrackingState.userId;
    let userName = backgroundTrackingState.userName;

    if (!tripId || !userId) {
      try {
        const stored = await AsyncStorage.getItem('barkadash_radar_bg_state');
        if (stored) {
          const parsed = JSON.parse(stored);
          tripId = parsed.tripId || '';
          userId = parsed.userId || '';
          userName = parsed.userName || '';
        }
      } catch (e) {
        console.warn('Error reading bg state from async storage:', e);
      }
    }

    if (!tripId || !userId) {
      return;
    }

    const lat = location.coords.latitude;
    const lng = location.coords.longitude;
    const speed = location.coords.speed ?? null;

    try {
      const channelName = `radar:trip:${tripId}`;
      const channel = supabase.channel(channelName);
      await channel.send({
        type: 'broadcast',
        event: 'location_update',
        payload: {
          userId,
          name: userName,
          lat,
          lng,
          speed,
          battery: backgroundTrackingState.battery,
          address: backgroundTrackingState.address,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.warn('[Background Location Task] broadcast error:', err);
    }
  }
});

export const BarkadaRadarScreen: React.FC<BarkadaRadarScreenProps> = ({ onOpenCabinet }) => {
  const { colors, isDark } = useTheme();
  const { sp, fs, insets, isTablet } = useResponsive();
  const screenDimensions = Dimensions.get('window');
  const viewWidth = screenDimensions.width;
  const viewHeight = screenDimensions.height;

  const [loadingLocation, setLoadingLocation] = useState<boolean>(true);
  const [weatherTemp, setWeatherTemp] = useState<number | null>(null);
  const [weatherIsDay, setWeatherIsDay] = useState(true);
  const [mapStyleOverride, setMapStyleOverride] = useState<'auto' | 'hybrid' | 'dark' | 'light'>('auto');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<string>('Acquiring GPS...');
  const [isCardCollapsed, setIsCardCollapsed] = useState<boolean>(false);

  // Asymmetric Animation: Playful Spring Bounce on Open, Snappy Clean Ease on Close
  const animatedProgress = useRef(new Animated.Value(1)).current; // 1 = expanded, 0 = collapsed

  const toggleCardCollapsed = () => {
    const nextCollapsedState = !isCardCollapsed;
    setIsCardCollapsed(nextCollapsedState);

    if (nextCollapsedState) {
      Animated.timing(animatedProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.spring(animatedProgress, {
        toValue: 1,
        bounciness: 15,
        speed: 10,
        useNativeDriver: false,
      }).start();
    }
  };

  // Continuous Float Zoom (Allows 60fps smooth Pinching without frame skips)
  const [zoom, setZoom] = useState<number>(14.5);
  const zoomRef = useRef<number>(14.5);
  zoomRef.current = zoom;

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 14.5995,
    lng: 120.9842,
  });

  // Animated values for smooth 60fps map panning transitions
  const centerLatAnim = useRef(new Animated.Value(center.lat)).current;
  const centerLngAnim = useRef(new Animated.Value(center.lng)).current;
  const zoomAnim = useRef(new Animated.Value(zoom)).current;

  // Listeners to update the map rendering states on animation ticks
  useEffect(() => {
    const latId = centerLatAnim.addListener(({ value }) => {
      setCenter((prev) => (prev.lat === value ? prev : { ...prev, lat: value }));
    });
    const lngId = centerLngAnim.addListener(({ value }) => {
      setCenter((prev) => (prev.lng === value ? prev : { ...prev, lng: value }));
    });
    const zoomId = zoomAnim.addListener(({ value }) => {
      setZoom(value);
    });

    return () => {
      centerLatAnim.removeListener(latId);
      centerLngAnim.removeListener(lngId);
      zoomAnim.removeListener(zoomId);
    };
  }, []);

  const animateMapTo = (targetLat: number, targetLng: number, targetZoom?: number) => {
    centerLatAnim.stopAnimation();
    centerLngAnim.stopAnimation();
    zoomAnim.stopAnimation();

    const animations = [
      Animated.timing(centerLatAnim, {
        toValue: targetLat,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(centerLngAnim, {
        toValue: targetLng,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ];

    if (targetZoom !== undefined) {
      zoomAnim.setValue(zoom);
      animations.push(
        Animated.timing(zoomAnim, {
          toValue: targetZoom,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      );
    }

    Animated.parallel(animations).start();
  };

  const { profile } = useUser();
  const currentUserId = profile?.id || '';
  const myDisplayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.username || 'Me';

  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number; speed: number | null } | null>(null);
  const myLocRef = useRef<{ lat: number; lng: number; speed: number | null } | null>(null);
  const [myBattery, setMyBattery] = useState<number>(100);
  const [myAddress, setMyAddress] = useState<string>('Current Location');
  const [peerLocations, setPeerLocations] = useState<Record<string, PeerLocation>>({});
  const didInitCenter = useRef(false);
  const didFetchWeather = useRef(false);
  const lastGeocodeTime = useRef(0);

  // Sync background tracking details when active trip or profile changes
  useEffect(() => {
    if (activeTrip?.id && currentUserId) {
      backgroundTrackingState.tripId = activeTrip.id;
      backgroundTrackingState.userId = currentUserId;
      backgroundTrackingState.userName = myDisplayName;
      backgroundTrackingState.battery = myBattery;
      backgroundTrackingState.address = myAddress;

      AsyncStorage.setItem(
        'barkadash_radar_bg_state',
        JSON.stringify({
          tripId: activeTrip.id,
          userId: currentUserId,
          userName: myDisplayName,
        })
      ).catch(() => {});
    }
  }, [activeTrip?.id, currentUserId, myDisplayName, myBattery, myAddress]);

  // 1. Real Device Battery Monitoring
  useEffect(() => {
    let batterySub: Battery.Subscription | null = null;
    const fetchBattery = async () => {
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level >= 0) {
          setMyBattery(Math.round(level * 100));
        }
      } catch (e) {
        console.log('Battery fetch note:', e);
      }
    };
    fetchBattery();
    try {
      batterySub = Battery.addBatteryLevelListener((evt) => {
        if (evt.batteryLevel >= 0) {
          setMyBattery(Math.round(evt.batteryLevel * 100));
        }
      });
    } catch (e) {
      console.log('Battery listener note:', e);
    }
    return () => {
      batterySub?.remove();
    };
  }, []);

  // 2. Continuous Live GPS Tracking
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let isMounted = true;

    async function startWatching() {
      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          if (isMounted) {
            setLocationStatus('GPS (Default Position)');
            setLoadingLocation(false);
            const fallbackLoc = { lat: 14.5995, lng: 120.9842, speed: null };
            myLocRef.current = fallbackLoc;
            setMyLoc(fallbackLoc);
            if (!didInitCenter.current) {
              didInitCenter.current = true;
              setCenter(fallbackLoc);
            }
          }
          return;
        }

        // Active foreground position watch (1s / 1m real-time live updates)
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 },
          (loc) => {
            if (!isMounted) return;
            const next = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              speed: loc.coords.speed ?? null,
            };
            myLocRef.current = next;
            setMyLoc(next);
            if (!didInitCenter.current) {
              didInitCenter.current = true;
              setCenter({ lat: next.lat, lng: next.lng });
              centerLatAnim.setValue(next.lat);
              centerLngAnim.setValue(next.lng);
            }
            setLocationStatus('Live GPS Active');
            setLoadingLocation(false);
          }
        );

        // Request background updates if supported
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (fgStatus === 'granted' && bgStatus === 'granted') {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 5000,
              distanceInterval: 5,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "Barkadash Radar",
                notificationBody: "Barkadash is sharing your live location with your squad.",
                notificationColor: "#0171F8"
              }
            });
          }
        } catch (bgError) {
          // Expo Go background warning
        }

      } catch (err) {
        console.log('Location error:', err);
        if (isMounted) {
          setLocationStatus('GPS Ready');
          setLoadingLocation(false);
          const fallbackLoc = { lat: 14.5995, lng: 120.9842, speed: null };
          myLocRef.current = fallbackLoc;
          setMyLoc(fallbackLoc);
        }
      }
    }

    startWatching();

    return () => {
      isMounted = false;
      if (sub) sub.remove();
      Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME)
        .then((started) => {
          if (started) {
            Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => {});
          }
        })
        .catch(() => {});
    };
  }, []);

  // 3. Reverse Geocode locality (throttled to once every 20s)
  useEffect(() => {
    if (!myLoc) return;
    const now = Date.now();
    if (now - lastGeocodeTime.current < 20000) return;
    lastGeocodeTime.current = now;

    Location.reverseGeocodeAsync({ latitude: myLoc.lat, longitude: myLoc.lng })
      .then((results) => {
        if (results && results.length > 0) {
          const item = results[0];
          const parts = [item.name, item.street, item.district || item.city, item.region].filter(Boolean);
          if (parts.length > 0) {
            setMyAddress(parts.slice(0, 2).join(', '));
          }
        }
      })
      .catch(() => {});
  }, [myLoc]);

  // 4. Supabase Realtime Live Broadcast & Peer Location Sync
  useEffect(() => {
    if (!activeTrip?.id || !currentUserId) return;

    const tripId = activeTrip.id;
    const channelName = `radar:trip:${tripId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: currentUserId },
      },
    });

    channel
      .on('broadcast', { event: 'location_update' }, ({ payload }) => {
        if (!payload || !payload.userId || payload.userId === currentUserId) return;
        setPeerLocations((prev) => ({
          ...prev,
          [payload.userId]: {
            userId: payload.userId,
            name: payload.name,
            lat: payload.lat,
            lng: payload.lng,
            speed: payload.speed ?? null,
            battery: payload.battery ?? 100,
            lastUpdated: payload.lastUpdated || new Date().toISOString(),
            isOnline: true,
            address: payload.address,
          },
        }));
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUserIds = new Set(Object.keys(state));
        setPeerLocations((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((id) => {
            next[id] = {
              ...next[id],
              isOnline: onlineUserIds.has(id),
            };
          });
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (!key) return;
        setPeerLocations((prev) => {
          if (!prev[key]) return prev;
          return {
            ...prev,
            [key]: {
              ...prev[key],
              isOnline: false,
              lastUpdated: 'Just now',
            },
          };
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUserId,
            name: myDisplayName,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTrip?.id, currentUserId, myDisplayName]);

  // 5. Broadcast Local GPS & Real Battery to Trip Peers
  useEffect(() => {
    if (!activeTrip?.id || !myLoc || !currentUserId) return;
    const channelName = `radar:trip:${activeTrip.id}`;
    const channel = supabase.channel(channelName);

    channel
      .send({
        type: 'broadcast',
        event: 'location_update',
        payload: {
          userId: currentUserId,
          name: myDisplayName,
          lat: myLoc.lat,
          lng: myLoc.lng,
          speed: myLoc.speed,
          battery: myBattery,
          address: myAddress,
          lastUpdated: new Date().toISOString(),
        },
      })
      .catch(() => {});
  }, [myLoc, myBattery, myAddress, activeTrip?.id, currentUserId, myDisplayName]);

  // Load trips if not already loaded, then subscribe for active-trip changes
  useEffect(() => {
    const svc = TripService.getInstance();
    const refresh = () => setActiveTrip(svc.getActiveTrip());
    refresh();
    if (currentUserId && svc.getTrips().length === 0) {
      svc.fetchUserTripsDB(currentUserId).then(() => setActiveTrip(svc.getActiveTrip()));
    }
    const unsub = svc.subscribe(refresh);
    return unsub;
  }, [currentUserId]);

  // Fetch joined members for the active trip (real members only)
  useEffect(() => {
    let cancelled = false;

    const loadParticipants = async () => {
      let tripList: Participant[] = [];
      if (activeTrip?.id) {
        try {
          const list = await TripService.getInstance().fetchTripParticipantsDB(activeTrip.id);
          tripList = list.filter((p) => p.status === 'accepted');
        } catch (e) {
          console.warn('Error fetching participants:', e);
        }
      }

      if (cancelled) return;

      const meParticipant: Participant = {
        id: currentUserId || 'me-local-id',
        name: myDisplayName || 'Me',
        handle: `@${profile?.username || 'me'}`,
        initials: (myDisplayName || 'ME').slice(0, 2).toUpperCase(),
        avatarBg: '#0171F8',
        role: 'host',
        status: 'accepted',
      };

      const hasMe = tripList.some((p) => p.id === currentUserId || (currentUserId && p.id === currentUserId));
      const combined = hasMe ? tripList : [meParticipant, ...tripList];

      setParticipants(combined);
    };

    loadParticipants();

    return () => {
      cancelled = true;
    };
  }, [activeTrip?.id, currentUserId, myDisplayName, profile?.username]);

  // Weather once the first GPS fix arrives
  useEffect(() => {
    if (!myLoc || didFetchWeather.current) return;
    didFetchWeather.current = true;
    fetchWeather(myLoc.lat, myLoc.lng).then((w) => {
      if (w) {
        setWeatherTemp(w.tempC);
        setWeatherIsDay(w.isDay);
      }
    });
  }, [myLoc]);

  // Rebuild the member pins from joined members + live positions + real battery in the same detected location
  useEffect(() => {
    const activeLat = myLoc?.lat ?? center.lat;
    const activeLng = myLoc?.lng ?? center.lng;

    setMembers(
      buildMembers(
        participants,
        activeLat,
        activeLng,
        myLoc?.speed,
        myBattery,
        myAddress,
        currentUserId || 'me-local-id',
        peerLocations
      )
    );
  }, [participants, myLoc, center.lat, center.lng, myBattery, myAddress, currentUserId, peerLocations]);

  // Keep a valid selected member (defaults to me)
  useEffect(() => {
    if (members.length === 0) {
      setSelectedMemberId('');
      return;
    }
    const me = members.find((m) => m.isMe) || members[0];
    setSelectedMemberId((prev) => (members.some((m) => m.id === prev) ? prev : me.id));
  }, [members]);

  const currentMember = members.find((m) => m.id === selectedMemberId) || members[0];

  // 60FPS Continuous Pinch Zooming & Dragging
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchZoom = useRef<number>(14.5);
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          initialPinchDist.current = Math.hypot(dx, dy);
          initialPinchZoom.current = zoomRef.current;
        } else {
          initialPinchDist.current = null;
        }
        if (touches && touches.length >= 1) {
          lastTouchPos.current = { x: touches[0].pageX, y: touches[0].pageY };
        }
      },
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          // Continuous Pinch Zooming
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const currentDist = Math.hypot(dx, dy);

          if (!initialPinchDist.current) {
            initialPinchDist.current = currentDist;
            initialPinchZoom.current = zoomRef.current;
          } else if (initialPinchDist.current > 0) {
            const ratio = currentDist / initialPinchDist.current;
            const nextZoom = Math.min(18, Math.max(3, initialPinchZoom.current + Math.log2(ratio)));
            setZoom(nextZoom);
            zoomRef.current = nextZoom;
            zoomAnim.setValue(nextZoom);
          }
        } else if (touches && touches.length === 1 && lastTouchPos.current) {
          // Smooth Drag Panning
          initialPinchDist.current = null;
          const dx = touches[0].pageX - lastTouchPos.current.x;
          const dy = touches[0].pageY - lastTouchPos.current.y;
          lastTouchPos.current = { x: touches[0].pageX, y: touches[0].pageY };

          const z = zoomRef.current;
          const scale = 256 * Math.pow(2, z);
          const deltaLng = (-dx / scale) * 360;
          const deltaLat = (dy / scale) * 180;

          setCenter((prev) => {
            const nextLat = Math.max(-85, Math.min(85, prev.lat + deltaLat));
            const nextLng = ((prev.lng + deltaLng + 180) % 360) - 180;

            // Sync animated values during manual dragging
            centerLatAnim.setValue(nextLat);
            centerLngAnim.setValue(nextLng);

            return { lat: nextLat, lng: nextLng };
          });
        }
      },
      onPanResponderRelease: () => {
        initialPinchDist.current = null;
        lastTouchPos.current = null;
      },
    })
  ).current;

  const handleSelectMember = (m: MemberStatus) => {
    setSelectedMemberId(m.id);
    animateMapTo(m.lat, m.lng);
  };

  const handleLocateMe = () => {
    const me = members.find((m) => m.isMe) || members[0];
    if (me) {
      setSelectedMemberId(me.id);
      animateMapTo(me.lat, me.lng, 15.5);
    } else if (myLoc) {
      animateMapTo(myLoc.lat, myLoc.lng, 15.5);
    }
  };

  const handleToggleStyle = () => {
    const styles: ('auto' | 'hybrid' | 'dark' | 'light')[] = ['auto', 'hybrid', 'dark', 'light'];
    const nextStyle = styles[(styles.indexOf(mapStyleOverride) + 1) % styles.length];
    setMapStyleOverride(nextStyle);
  };

  // Determine Effective Map Appearance based on System/App Appearance or User Override
  const isDarkModeMap =
    mapStyleOverride === 'dark' || (mapStyleOverride === 'auto' && isDark);

  // Continuous Sub-Pixel Scale Math for Zero Frame Skipping
  const baseZoom = Math.floor(zoom);
  const tileScale = Math.pow(2, zoom - baseZoom);

  const centerPixel = latLngToPixel(center.lat, center.lng, baseZoom);
  const minXPixel = centerPixel.x - viewWidth / (2 * tileScale) - 256;
  const maxXPixel = centerPixel.x + viewWidth / (2 * tileScale) + 256;
  const minYPixel = centerPixel.y - viewHeight / (2 * tileScale) - 256;
  const maxYPixel = centerPixel.y + viewHeight / (2 * tileScale) + 256;

  const minTileX = Math.floor(minXPixel / 256);
  const maxTileX = Math.floor(maxXPixel / 256);
  const minTileY = Math.floor(minYPixel / 256);
  const maxTileY = Math.floor(maxYPixel / 256);

  const subdomains = ['a', 'b', 'c'];
  const tiles = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const sub = subdomains[Math.abs(tx + ty) % subdomains.length];
      
      // 100% Free Public OpenStreetMap & Esri tiles (No API key, No Paid billing)
      let url = `https://${sub}.tile.openstreetmap.org/${baseZoom}/${tx}/${ty}.png`;

      if (mapStyleOverride === 'hybrid') {
        // Public Esri World Imagery Satellite
        url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${baseZoom}/${ty}/${tx}`;
      } else {
        url = `https://${sub}.tile.openstreetmap.org/${baseZoom}/${tx}/${ty}.png`;
      }

      tiles.push({
        key: `${isDarkModeMap ? 'dark' : 'light'}-${mapStyleOverride}-${baseZoom}-${tx}-${ty}`,
        url,
        left: (tx * 256 - centerPixel.x) * tileScale + viewWidth / 2,
        top: (ty * 256 - centerPixel.y) * tileScale + viewHeight / 2,
        width: 256 * tileScale,
        height: 256 * tileScale,
      });
    }
  }

  const bigAvatarSize = isTablet ? 54 : 48;
  const memberAvatarSize = isTablet ? 48 : 42;

  const glassCardStyle = {
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 12,
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDarkModeMap ? '#0D1527' : colors.paper }}
      edges={['top']}
    >
      <StatusBar barStyle={colors.statusBar} backgroundColor={isDarkModeMap ? '#0D1527' : colors.paper} />

      {/* MIDNIGHT NAVY BLUE SYSTEM-AWARE MAP CANVAS */}
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: isDarkModeMap ? '#0D1527' : '#FAF8F5' },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Render Map Tiles */}
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={{
              position: 'absolute',
              width: tile.width,
              height: tile.height,
              left: tile.left,
              top: tile.top,
            }}
            resizeMode="cover"
          />
        ))}

        {/* Midnight Blue Tint Overlay for Dark Mode */}
        {isDarkModeMap && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: 'rgba(15, 23, 42, 0.32)',
              },
            ]}
          />
        )}

        {/* Render Member Avatar Pin Markers */}
        {members.map((m) => {
          const pinPixel = latLngToPixel(m.lat, m.lng, baseZoom);
          const isSelected = m.id === selectedMemberId;
          const pinSize = isSelected ? 46 : 40;

          const pinLeft = (pinPixel.x - centerPixel.x) * tileScale + viewWidth / 2 - pinSize / 2;
          const pinTop = (pinPixel.y - centerPixel.y) * tileScale + viewHeight / 2 - pinSize / 2;

          return (
            <TouchableOpacity
              key={m.id}
              activeOpacity={0.9}
              onPress={() => handleSelectMember(m)}
              style={{
                position: 'absolute',
                left: pinLeft,
                top: pinTop,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isSelected ? 50 : 20,
              }}
            >
              {/* Avatar Circle Pin */}
              <View
                style={{
                  width: pinSize,
                  height: pinSize,
                  borderRadius: pinSize / 2,
                  backgroundColor: m.avatarBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isSelected ? 3.5 : 2.5,
                  borderColor: isSelected ? '#0171F8' : '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  elevation: 8,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    fontSize: isSelected ? 16 : 14,
                  }}
                >
                  {m.initial}
                </Text>

                {/* Battery Badge on Pin */}
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#3A8E71',
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                  }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: '900' }}>
                    {m.battery}%
                  </Text>
                </View>
              </View>

              {/* Name Pill Badge with High-Contrast Dark/Light Mode Colors */}
              <View
                style={{
                  backgroundColor: isDarkModeMap
                    ? 'rgba(15, 23, 42, 0.95)'
                    : 'rgba(255, 255, 255, 0.95)',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 10,
                  marginTop: 4,
                  borderWidth: 1,
                  borderColor: isSelected
                    ? '#0171F8'
                    : isDarkModeMap
                    ? 'rgba(255, 255, 255, 0.22)'
                    : 'rgba(0, 0, 0, 0.12)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color: isSelected
                      ? '#38BDF8'
                      : isDarkModeMap
                      ? '#F8FAFC'
                      : '#0F172A',
                  }}
                >
                  {m.name.split(' ')[0]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FLOATING HEADER */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + sp.sm,
          left: sp.md,
          right: sp.md,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: sp.sm,
          zIndex: 50,
        }}
      >
        <View
          style={[
            glassCardStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingLeft: 4,
              paddingRight: 10,
              paddingVertical: 4,
              borderRadius: 100,
              flexShrink: 1,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onOpenCabinet}
            activeOpacity={0.7}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}
          >
            <Menu size={18} color={colors.ink} strokeWidth={2.2} />
          </TouchableOpacity>

          <BarkadashLogo height={24} />

          <View
            style={{
              width: 1,
              height: 14,
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
              marginHorizontal: 1,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: '#3A8E71',
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 }}>
              RADAR
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(58,142,113,0.15)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 8.5,
                  fontWeight: '900',
                  color: '#3A8E71',
                  letterSpacing: 0.5,
                }}
              >
                LIVE
              </Text>
            </View>
          </View>
        </View>

        {/* Weather / Event Info Badge */}
        <View
          style={[
            glassCardStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: 100,
              flexShrink: 0,
            },
          ]}
        >
          {weatherTemp != null ? (
            <>
              {weatherIsDay ? <Sun size={13} color="#D97706" /> : <Moon size={13} color="#60A5FA" />}
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>
                {loadingLocation ? 'Locating...' : `${weatherTemp}°C`}
              </Text>
            </>
          ) : (
            <>
              <CalendarClock size={13} color={colors.orangeAccent} strokeWidth={2.2} />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: colors.ink, maxWidth: 95 }}>
                {activeTrip?.destination && activeTrip.destination !== 'Voting in Progress'
                  ? activeTrip.destination.split(',')[0]
                  : 'Barkada Squad'}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* FLOATING QUICK MAP CONTROLS */}
      <View
        style={{
          position: 'absolute',
          right: sp.md,
          top: insets.top + (isTablet ? 76 : 68),
          gap: sp.xs,
          zIndex: 40,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleLocateMe}
          style={[
            glassCardStyle,
            {
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <LocateFixed size={20} color="#0171F8" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleToggleStyle}
          style={[
            glassCardStyle,
            {
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Layers size={20} color={isDarkModeMap ? '#60A5FA' : colors.ink} />
        </TouchableOpacity>
      </View>

      {/* CUBIC EASE ANIMATED BOTTOM SQUAD PANEL SHEET */}
      {members.length > 0 && (
        <View
          style={{
            marginTop: 'auto',
            paddingHorizontal: sp.md,
            paddingBottom: insets.bottom > 0 ? insets.bottom + 68 : 84,
            zIndex: 50,
          }}
        >
          <View
            style={[
              glassCardStyle,
              {
                borderRadius: 28,
                paddingHorizontal: sp.lg,
                paddingTop: sp.xs,
                paddingBottom: isCardCollapsed ? sp.md : sp.lg,
              },
            ]}
          >
            {/* Card Collapse Drag Handle Pill */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={toggleCardCollapsed}
              style={{ alignItems: 'center', paddingVertical: 6 }}
            >
              <View
                style={{
                  width: 38,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.25)',
                }}
              />
            </TouchableOpacity>

            {/* Member Detail Header Bar */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: isCardCollapsed ? 0 : sp.sm,
                borderBottomWidth: isCardCollapsed ? 0 : 1,
                borderBottomColor: colors.cardBorder,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={toggleCardCollapsed}
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
              >
                <View
                  style={{
                    width: isCardCollapsed ? 38 : bigAvatarSize,
                    height: isCardCollapsed ? 38 : bigAvatarSize,
                    borderRadius: (isCardCollapsed ? 38 : bigAvatarSize) / 2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: sp.md,
                    borderWidth: 2,
                    borderColor: '#FFFFFF',
                    backgroundColor: currentMember?.avatarBg || '#0171F8',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 6,
                  }}
                >
                  <Text
                    style={{
                      color: '#FFFFFF',
                      fontWeight: '900',
                      fontSize: isCardCollapsed ? 14 : fs.md,
                    }}
                  >
                    {currentMember?.initial || 'U'}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: fs.md, fontWeight: '800', color: colors.ink }}>
                      {currentMember?.name || 'Squad Member'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: sp.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MapPin size={12} color="#0171F8" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: fs.xs, color: colors.ink, fontWeight: '600' }}>
                        {currentMember?.statusText || 'Live Location'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: fs.xs, color: colors.inkSoft }}>
                      • {currentMember?.distance || 'Here'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Quick Battery, Clock & Expand/Collapse Chevron */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <BatteryIcon size={13} color="#3A8E71" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#3A8E71' }}>
                      {`${currentMember?.battery ?? 100}%`}
                    </Text>
                  </View>
                  {!isCardCollapsed && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Clock size={11} color={colors.inkSoft} />
                      <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '500' }}>
                        {currentMember?.lastUpdated || 'Just now'}
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={toggleCardCollapsed}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 4,
                  }}
                >
                  {isCardCollapsed ? (
                    <ChevronUp size={18} color={colors.ink} />
                  ) : (
                    <ChevronDown size={18} color={colors.ink} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Smooth Cubic Ease Slide Collapsible Container */}
            <Animated.View
              style={{
                maxHeight: animatedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 220],
                }),
                opacity: animatedProgress.interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0, 0.7, 1],
                }),
                transform: [
                  {
                    scaleY: animatedProgress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.82, 1.05, 1.0],
                    }),
                  },
                ],
                overflow: 'hidden',
                gap: sp.md,
                marginTop: animatedProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, sp.md],
                }),
              }}
            >
              {/* Member Selector Row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingVertical: 2 }}
              >
                {members.map((m) => {
                  const isSelected = selectedMemberId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      activeOpacity={0.8}
                      onPress={() => handleSelectMember(m)}
                      style={{ alignItems: 'center' }}
                    >
                      <View
                        style={{
                          width: memberAvatarSize,
                          height: memberAvatarSize,
                          borderRadius: memberAvatarSize / 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: m.avatarBg,
                          borderWidth: isSelected ? 3 : 1,
                          borderColor: isSelected ? '#0171F8' : 'rgba(255, 255, 255, 0.8)',
                          shadowColor: isSelected ? '#0171F8' : 'transparent',
                          shadowOffset: { width: 0, height: 4 },
                          shadowOpacity: 0.25,
                          shadowRadius: 8,
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.sm }}>
                          {m.initial}
                        </Text>
                      </View>

                      <Text
                        style={{
                          fontSize: 10,
                          marginTop: 4,
                          fontWeight: isSelected ? '800' : '500',
                          color: isSelected
                            ? '#0171F8'
                            : colors.inkSoft,
                        }}
                      >
                        {m.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Bottom Actions Bar */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: sp.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.cardBorder,
                }}
              >
                <View style={{ flexDirection: 'row', gap: sp.md, alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Users size={13} color="#3A8E71" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>
                      {members.length} {members.length === 1 ? 'Member' : 'Squad'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Navigation size={13} color="#0171F8" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>
                      {locationStatus}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: sp.xs }}>
                  <TouchableOpacity
                    onPress={() => Alert.alert('Ping Broadcast', `Location ping sent to your squad!`)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: 'rgba(1, 113, 248, 0.12)',
                      paddingHorizontal: sp.md,
                      paddingVertical: sp.xs + 2,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sp.xs,
                    }}
                  >
                    <Radio size={13} color="#0171F8" />
                    <Text style={{ color: '#0171F8', fontSize: fs.xs, fontWeight: '800' }}>Ping</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};
