import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline, Line, Circle as SvgCircle } from 'react-native-svg';
import {
  MapPin,
  Users,
  LocateFixed,
  Layers,
  Radio,
  Navigation,
  Battery as BatteryIcon,
  BatteryCharging,
  Clock,
  Menu,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  CalendarClock,
  CalendarDays,
  Sparkles,
  Wifi,
  WifiOff,
  ExternalLink,
  Compass,
  Route,
  Utensils,
  Coffee,
  BedDouble,
  Palmtree,
  Mountain,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { TripService } from '../../services/tripService';
import { NotificationService } from '../../services/notificationService';
import { Trip, ItineraryItem } from '../../types/trip';
import { fetchWeather } from '../../services/weatherService';
import { supabase } from '../../utils/supabase';
import { getTodayTripDay, sortItineraryChronological } from '../../utils/tripDates';
import { getPlaceDetails, searchPlaces } from '../../services/googlePlaces';

export interface MemberStatus {
  id: string;
  name: string;
  initial: string;
  avatarBg: string;
  avatarUrl?: string;
  statusText: string;
  address: string;
  distance: string;
  battery: number;
  isCharging?: boolean;
  speed: string;
  speedKmh: number;
  isMoving: boolean;
  lastUpdated: string;
  lastUpdatedMs: number;
  isMe?: boolean;
  isOnline?: boolean;
  hasLocation: boolean;
  lat?: number;
  lng?: number;
}

export interface PeerLocation {
  userId: string;
  name?: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading?: number | null;
  battery: number;
  isCharging?: boolean;
  lastUpdated: string;
  lastUpdatedMs: number;
  isOnline: boolean;
  address?: string;
}

export interface Participant {
  id: string;
  name: string;
  handle: string;
  initials: string;
  avatarBg: string;
  avatarUrl?: string;
  role: 'host' | 'co-host' | 'member';
  status: 'accepted' | 'pending';
}

export interface ItineraryWaypoint {
  id: string;
  orderNumber: number; // 1, 2, 3...
  time: string;
  title: string;
  category: string;
  tag?: string;
  location: string;
  placeName?: string;
  placeAddress?: string;
  placeId?: string;
  lat: number;
  lng: number;
  isCompleted?: boolean;
  photoReference?: string;
  distanceFromUser?: string;
}

interface BarkadaRadarScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
  onNavigateToTab?: (tabIndex: number) => void;
}

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDistanceFormatted(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const dMeters = calculateDistanceMeters(lat1, lon1, lat2, lon2);
  if (dMeters < 15) return 'Here';
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

const formatSpeedText = (speedMps: number | null | undefined): { text: string; kmh: number; isMoving: boolean } => {
  if (speedMps == null || speedMps < 0.3) {
    return { text: 'Stationary', kmh: 0, isMoving: false };
  }
  const kmh = speedMps * 3.6;
  if (kmh < 1.0) {
    return { text: 'Stationary', kmh: Math.round(kmh), isMoving: false };
  }
  if (kmh >= 18) {
    return { text: `Driving • ${Math.round(kmh)} km/h`, kmh: Math.round(kmh), isMoving: true };
  }
  if (kmh >= 4) {
    return { text: `Moving • ${Math.round(kmh)} km/h`, kmh: Math.round(kmh), isMoving: true };
  }
  return { text: `Walking • ${Math.round(kmh)} km/h`, kmh: Math.round(kmh), isMoving: true };
};

const buildMembers = (
  participantsList: Participant[],
  myLat: number | null,
  myLng: number | null,
  mySpeed: number | null | undefined,
  myBatteryPercent: number,
  myIsCharging: boolean,
  myAddressText: string,
  meId: string,
  peers: Record<string, PeerLocation>,
  isDeviceOnline: boolean
): MemberStatus[] => {
  const now = Date.now();
  return participantsList.map((p, i) => {
    const isMe = p.id === meId || (meId ? p.id === meId : i === 0);
    const peer = peers[p.id];

    if (isMe) {
      const speedMeta = formatSpeedText(mySpeed);
      const hasLocation = myLat != null && myLng != null;

      let statusText = 'Live Location';
      if (!isDeviceOnline) {
        statusText = 'Offline (GPS Active)';
      } else if (speedMeta.isMoving) {
        statusText = speedMeta.text;
      }

      return {
        id: p.id,
        name: `${p.name} (you)`,
        initial: p.initials || p.name.charAt(0).toUpperCase(),
        avatarBg: p.avatarBg,
        avatarUrl: p.avatarUrl,
        statusText,
        address: myAddressText || (hasLocation ? 'Current Location' : 'Acquiring GPS...'),
        distance: 'Here',
        battery: myBatteryPercent,
        isCharging: myIsCharging,
        speed: speedMeta.text,
        speedKmh: speedMeta.kmh,
        isMoving: speedMeta.isMoving,
        lastUpdated: 'Just now',
        lastUpdatedMs: now,
        isMe: true,
        isOnline: isDeviceOnline,
        hasLocation,
        lat: myLat ?? undefined,
        lng: myLng ?? undefined,
      };
    }

    // Peers
    const hasLocation = !!(peer && typeof peer.lat === 'number' && typeof peer.lng === 'number');
    const peerBattery = peer?.battery ?? 100;
    const speedMeta = formatSpeedText(peer?.speed);

    // Online if peer reported active presence OR last update received within 2.5 minutes
    const lastSeenMs = peer?.lastUpdatedMs || (peer?.lastUpdated ? new Date(peer.lastUpdated).getTime() : 0);
    const minutesAgo = lastSeenMs > 0 ? Math.floor((now - lastSeenMs) / 60000) : null;
    const isPeerOnline = peer?.isOnline === true || (lastSeenMs > 0 && now - lastSeenMs < 150000);

    let lastUpdatedLabel = 'Not shared';
    if (minutesAgo != null) {
      if (minutesAgo < 1) lastUpdatedLabel = 'Just now';
      else if (minutesAgo < 60) lastUpdatedLabel = `${minutesAgo}m ago`;
      else lastUpdatedLabel = `${Math.floor(minutesAgo / 60)}h ago`;
    }

    let statusText = 'Trip Member';
    if (!hasLocation) {
      statusText = 'Location not shared yet';
    } else if (isPeerOnline) {
      statusText = speedMeta.isMoving ? speedMeta.text : 'Live Location';
    } else {
      statusText = `Offline • ${lastUpdatedLabel}`;
    }

    const distance =
      hasLocation && myLat != null && myLng != null
        ? calculateDistanceFormatted(myLat, myLng, peer.lat, peer.lng)
        : '--';

    return {
      id: p.id,
      name: p.name,
      initial: p.initials || p.name.charAt(0).toUpperCase(),
      avatarBg: p.avatarBg,
      avatarUrl: p.avatarUrl,
      statusText,
      address: peer?.address || (hasLocation ? 'Trip Member Location' : 'No GPS coordinates shared'),
      distance,
      battery: peerBattery,
      isCharging: peer?.isCharging ?? false,
      speed: speedMeta.text,
      speedKmh: speedMeta.kmh,
      isMoving: speedMeta.isMoving,
      lastUpdated: lastUpdatedLabel,
      lastUpdatedMs: lastSeenMs,
      isMe: false,
      isOnline: isPeerOnline,
      hasLocation,
      lat: peer?.lat,
      lng: peer?.lng,
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
  isCharging: false,
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
    const heading = location.coords.heading ?? null;

    // Persist real background location locally
    AsyncStorage.setItem(
      '@radar_last_my_loc',
      JSON.stringify({ lat, lng, speed, heading, timestamp: Date.now() })
    ).catch(() => {});

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
          heading,
          battery: backgroundTrackingState.battery,
          isCharging: backgroundTrackingState.isCharging,
          address: backgroundTrackingState.address,
          lastUpdated: new Date().toISOString(),
          lastUpdatedMs: Date.now(),
        },
      });
    } catch (err) {
      console.warn('[Background Location Task] broadcast error:', err);
    }
  }
});

export const BarkadaRadarScreen: React.FC<BarkadaRadarScreenProps> = ({
  onOpenCabinet,
  onNavigateToTab,
}) => {
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
  const [selectedWaypointId, setSelectedWaypointId] = useState<string>('');
  const [activeBottomTab, setActiveBottomTab] = useState<'squad' | 'itinerary'>('squad');
  const [locationStatus, setLocationStatus] = useState<string>('Acquiring GPS...');
  const [isCardCollapsed, setIsCardCollapsed] = useState<boolean>(false);
  const [isDeviceOnline, setIsDeviceOnline] = useState<boolean>(true);

  // Today's Itinerary Waypoints State
  const [todayWaypoints, setTodayWaypoints] = useState<ItineraryWaypoint[]>([]);
  const [loadingItinerary, setLoadingItinerary] = useState<boolean>(false);
  const [todayDayNumber, setTodayDayNumber] = useState<number>(1);

  // Animated Collapsible Progress
  const animatedProgress = useRef(new Animated.Value(1)).current;

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

  // Continuous Float Zoom & Smooth Map Panning Transitions
  const [zoom, setZoom] = useState<number>(14.5);
  const zoomRef = useRef<number>(14.5);
  zoomRef.current = zoom;

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 14.5995,
    lng: 120.9842,
  });

  const centerLatAnim = useRef(new Animated.Value(center.lat)).current;
  const centerLngAnim = useRef(new Animated.Value(center.lng)).current;
  const zoomAnim = useRef(new Animated.Value(zoom)).current;

  // Pulse animation for Life360 live radar dot
  const radarPulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(radarPulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(radarPulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [radarPulseAnim]);

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
  }, [centerLatAnim, centerLngAnim, zoomAnim]);

  const animateMapTo = useCallback((targetLat: number, targetLng: number, targetZoom?: number) => {
    centerLatAnim.stopAnimation();
    centerLngAnim.stopAnimation();
    zoomAnim.stopAnimation();

    const animations = [
      Animated.timing(centerLatAnim, {
        toValue: targetLat,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(centerLngAnim, {
        toValue: targetLng,
        duration: 750,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ];

    if (targetZoom !== undefined) {
      zoomAnim.setValue(zoomRef.current);
      animations.push(
        Animated.timing(zoomAnim, {
          toValue: targetZoom,
          duration: 750,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        })
      );
    }

    Animated.parallel(animations).start();
  }, [centerLatAnim, centerLngAnim, zoomAnim]);

  const { profile } = useUser();
  const currentUserId = profile?.id || '';
  const myDisplayName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || profile?.username || 'Me';

  const [members, setMembers] = useState<MemberStatus[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(() => TripService.getInstance().getActiveTrip());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number; speed: number | null; heading?: number | null } | null>(null);
  const myLocRef = useRef<{ lat: number; lng: number; speed: number | null; heading?: number | null } | null>(null);
  const [myBattery, setMyBattery] = useState<number>(100);
  const [myIsCharging, setMyIsCharging] = useState<boolean>(false);
  const [myAddress, setMyAddress] = useState<string>('Acquiring GPS...');
  const [peerLocations, setPeerLocations] = useState<Record<string, PeerLocation>>({});
  const didInitCenter = useRef(false);
  const didFetchWeather = useRef(false);
  const lastGeocodeTime = useRef(0);

  // Initialize cached last known location from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem('@radar_last_my_loc').then((stored) => {
      if (stored && !myLocRef.current) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
            const loc = { lat: parsed.lat, lng: parsed.lng, speed: parsed.speed ?? null, heading: parsed.heading ?? null };
            setMyLoc(loc);
            myLocRef.current = loc;
            if (!didInitCenter.current) {
              didInitCenter.current = true;
              setCenter({ lat: loc.lat, lng: loc.lng });
              centerLatAnim.setValue(loc.lat);
              centerLngAnim.setValue(loc.lng);
            }
          }
        } catch {}
      }
    });
  }, [centerLatAnim, centerLngAnim]);

  // Sync background tracking state
  useEffect(() => {
    if (activeTrip?.id && currentUserId) {
      backgroundTrackingState.tripId = activeTrip.id;
      backgroundTrackingState.userId = currentUserId;
      backgroundTrackingState.userName = myDisplayName;
      backgroundTrackingState.battery = myBattery;
      backgroundTrackingState.isCharging = myIsCharging;
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
  }, [activeTrip?.id, currentUserId, myDisplayName, myBattery, myIsCharging, myAddress]);

  // Load cached peer locations for this trip from AsyncStorage
  useEffect(() => {
    if (!activeTrip?.id) return;
    const cacheKey = `@radar_peers_${activeTrip.id}`;
    AsyncStorage.getItem(cacheKey).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === 'object') {
            setPeerLocations((prev) => ({ ...parsed, ...prev }));
          }
        } catch {}
      }
    });
  }, [activeTrip?.id]);

  // 1. Real Device Battery & Charging State Monitoring
  useEffect(() => {
    let batteryLevelSub: Battery.Subscription | null = null;
    let batteryStateSub: Battery.Subscription | null = null;

    const checkBattery = async () => {
      try {
        const [level, state] = await Promise.all([
          Battery.getBatteryLevelAsync(),
          Battery.getBatteryStateAsync(),
        ]);
        if (level >= 0) setMyBattery(Math.round(level * 100));
        setMyIsCharging(state === Battery.BatteryState.CHARGING);
      } catch (e) {
        console.log('Battery fetch note:', e);
      }
    };
    checkBattery();

    try {
      batteryLevelSub = Battery.addBatteryLevelListener((evt) => {
        if (evt.batteryLevel >= 0) {
          setMyBattery(Math.round(evt.batteryLevel * 100));
        }
      });
      batteryStateSub = Battery.addBatteryStateListener((evt) => {
        setMyIsCharging(evt.batteryState === Battery.BatteryState.CHARGING);
      });
    } catch (e) {
      console.log('Battery listener note:', e);
    }

    return () => {
      batteryLevelSub?.remove();
      batteryStateSub?.remove();
    };
  }, []);

  // 2. Real Hardware GPS Tracking (Runs online AND offline)
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let isMounted = true;

    async function startWatching() {
      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          if (isMounted) {
            setLocationStatus('GPS Access Denied');
            setLoadingLocation(false);
          }
          return;
        }

        // Active high-precision live location watch (1m / 1s triggers live movement)
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 1,
            timeInterval: 1000,
          },
          (loc) => {
            if (!isMounted) return;
            const next = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              speed: loc.coords.speed ?? null,
              heading: loc.coords.heading ?? null,
            };
            myLocRef.current = next;
            setMyLoc(next);

            // Cache local real coordinates
            AsyncStorage.setItem(
              '@radar_last_my_loc',
              JSON.stringify({ ...next, timestamp: Date.now() })
            ).catch(() => {});

            if (!didInitCenter.current) {
              didInitCenter.current = true;
              setCenter({ lat: next.lat, lng: next.lng });
              centerLatAnim.setValue(next.lat);
              centerLngAnim.setValue(next.lng);
            }

            const speedMeta = formatSpeedText(next.speed);
            setLocationStatus(speedMeta.isMoving ? speedMeta.text : 'Live GPS Active');
            setLoadingLocation(false);
          }
        );

        // Background tracking if supported
        try {
          const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
          if (fgStatus === 'granted' && bgStatus === 'granted') {
            await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
              accuracy: Location.Accuracy.BestForNavigation,
              timeInterval: 4000,
              distanceInterval: 4,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: 'Barkadash Radar',
                notificationBody: 'Sharing live location with your squad.',
                notificationColor: '#0171F8',
              },
            });
          }
        } catch {}
      } catch (err) {
        console.log('Location watch error:', err);
        if (isMounted) {
          setLocationStatus('GPS Ready');
          setLoadingLocation(false);
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
  }, [centerLatAnim, centerLngAnim]);

  // 3. Reverse Geocode locality (throttled to once every 15s)
  useEffect(() => {
    if (!myLoc) return;
    const now = Date.now();
    if (now - lastGeocodeTime.current < 15000) return;
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

  // 4. Supabase Realtime Live Broadcast & Peer Presence (Auto-syncs online/offline)
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
        setPeerLocations((prev) => {
          const next = {
            ...prev,
            [payload.userId]: {
              userId: payload.userId,
              name: payload.name,
              lat: payload.lat,
              lng: payload.lng,
              speed: payload.speed ?? null,
              heading: payload.heading ?? null,
              battery: payload.battery ?? 100,
              isCharging: payload.isCharging ?? false,
              lastUpdated: payload.lastUpdated || new Date().toISOString(),
              lastUpdatedMs: payload.lastUpdatedMs || Date.now(),
              isOnline: true,
              address: payload.address,
            },
          };
          // Persist real peer updates to cache
          AsyncStorage.setItem(`@radar_peers_${tripId}`, JSON.stringify(next)).catch(() => {});
          return next;
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const onlineUserIds = new Set(Object.keys(state));

        setPeerLocations((prev) => {
          const next = { ...prev };
          // For each user in presence, update their state with their tracked payload
          Object.entries(state).forEach(([uid, presenceItems]: [string, any]) => {
            if (uid === currentUserId) return;
            const presencePayload = presenceItems?.[0] || {};
            const existing = next[uid];
            next[uid] = {
              userId: uid,
              name: presencePayload.name || existing?.name,
              lat: presencePayload.lat ?? existing?.lat,
              lng: presencePayload.lng ?? existing?.lng,
              speed: presencePayload.speed ?? existing?.speed ?? null,
              battery: presencePayload.battery ?? existing?.battery ?? 100,
              isCharging: presencePayload.isCharging ?? existing?.isCharging ?? false,
              address: presencePayload.address || existing?.address,
              lastUpdated: presencePayload.lastUpdated || existing?.lastUpdated || new Date().toISOString(),
              lastUpdatedMs: Date.now(),
              isOnline: true,
            };
          });

          // Mark anyone not in presence as offline
          Object.keys(next).forEach((id) => {
            if (!onlineUserIds.has(id)) {
              next[id] = {
                ...next[id],
                isOnline: false,
              };
            }
          });

          AsyncStorage.setItem(`@radar_peers_${tripId}`, JSON.stringify(next)).catch(() => {});
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (!key || key === currentUserId) return;
        setPeerLocations((prev) => {
          if (!prev[key]) return prev;
          const next = {
            ...prev,
            [key]: {
              ...prev[key],
              isOnline: false,
              lastUpdatedMs: Date.now(),
            },
          };
          AsyncStorage.setItem(`@radar_peers_${tripId}`, JSON.stringify(next)).catch(() => {});
          return next;
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsDeviceOnline(true);
          const currentPos = myLocRef.current;
          await channel.track({
            userId: currentUserId,
            name: myDisplayName,
            lat: currentPos?.lat,
            lng: currentPos?.lng,
            speed: currentPos?.speed,
            battery: myBattery,
            isCharging: myIsCharging,
            address: myAddress,
            lastUpdated: new Date().toISOString(),
            lastUpdatedMs: Date.now(),
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setIsDeviceOnline(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTrip?.id, currentUserId, myDisplayName, myBattery, myIsCharging, myAddress]);

  // 5. Broadcast Local GPS & Battery to Peers whenever moved
  useEffect(() => {
    if (!activeTrip?.id || !myLoc || !currentUserId || !isDeviceOnline) return;
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
          heading: myLoc.heading,
          battery: myBattery,
          isCharging: myIsCharging,
          address: myAddress,
          lastUpdated: new Date().toISOString(),
          lastUpdatedMs: Date.now(),
        },
      })
      .catch(() => {});
  }, [myLoc, myBattery, myIsCharging, myAddress, activeTrip?.id, currentUserId, myDisplayName, isDeviceOnline]);

  // Load trips & participants
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

      const hasMe = tripList.some((p) => p.id === currentUserId);
      const combined = hasMe ? tripList : [meParticipant, ...tripList];

      setParticipants(combined);
    };

    loadParticipants();

    return () => {
      cancelled = true;
    };
  }, [activeTrip?.id, currentUserId, myDisplayName, profile?.username]);

  // Weather check once first GPS fix arrives
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

  // Rebuild the member pin list without ANY mock coordinates
  useEffect(() => {
    setMembers(
      buildMembers(
        participants,
        myLoc?.lat ?? null,
        myLoc?.lng ?? null,
        myLoc?.speed,
        myBattery,
        myIsCharging,
        myAddress,
        currentUserId || 'me-local-id',
        peerLocations,
        isDeviceOnline
      )
    );
  }, [participants, myLoc, myBattery, myIsCharging, myAddress, currentUserId, peerLocations, isDeviceOnline]);

  // 6. LOAD TODAY'S ITINERARY WAYPOINTS & REAL COORDINATES (FOR THIS DAY ONLY)
  useEffect(() => {
    let isCancelled = false;
    const tripId = activeTrip?.id;
    if (!tripId) {
      setTodayWaypoints([]);
      return;
    }
    const currentTripId: string = tripId;

    const todayDay = getTodayTripDay(activeTrip.dateRange);
    setTodayDayNumber(todayDay);
    setLoadingItinerary(true);

    async function loadDayItinerary() {
      try {
        const rawItems: ItineraryItem[] = await TripService.getInstance().fetchTripItineraryDB(currentTripId, todayDay);
        if (isCancelled) return;

        const sorted = sortItineraryChronological(rawItems || []);
        const waypoints: ItineraryWaypoint[] = [];

        for (let i = 0; i < sorted.length; i++) {
          const item = sorted[i];
          const orderNumber = i + 1;
          const cacheKey = `@radar_itinerary_coords_${item.id}`;

          let lat: number | null = null;
          let lng: number | null = null;

          // 1. Check cached geocode in AsyncStorage
          try {
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
                lat = parsed.lat;
                lng = parsed.lng;
              }
            }
          } catch {}

          // 2. Check place details cache if placeId exists
          if (lat == null && item.placeId) {
            try {
              const details = await getPlaceDetails(item.placeId);
              if (details && typeof details.latitude === 'number' && typeof details.longitude === 'number') {
                lat = details.latitude;
                lng = details.longitude;
              }
            } catch {}
          }

          // 3. Geocode with Expo Location and fallback to searchPlaces if still null
          if (lat == null) {
            const queryCandidates = [
              item.placeAddress,
              item.location ? `${item.location}, ${activeTrip?.destination || ''}` : '',
              item.placeName ? `${item.placeName}, ${activeTrip?.destination || ''}` : '',
              item.location,
              item.title ? `${item.title}, ${activeTrip?.destination || ''}` : '',
              item.title,
            ].filter((q) => q && q.trim().length > 2) as string[];

            for (const q of queryCandidates) {
              if (lat != null && lng != null) break;
              try {
                const results = await Location.geocodeAsync(q.trim());
                if (results && results.length > 0) {
                  lat = results[0].latitude;
                  lng = results[0].longitude;
                  break;
                }
              } catch {}

              try {
                const placeRes = await searchPlaces(q.trim());
                if (placeRes.predictions && placeRes.predictions.length > 0) {
                  const topDetails = await getPlaceDetails(placeRes.predictions[0].placeId);
                  if (topDetails && typeof topDetails.latitude === 'number' && typeof topDetails.longitude === 'number') {
                    lat = topDetails.latitude;
                    lng = topDetails.longitude;
                    break;
                  }
                }
              } catch {}
            }
          }

          // 4. Destination fallback if still null so all stops in today's itinerary reflect on radar
          if (lat == null && activeTrip?.destination) {
            const destCacheKey = `@radar_dest_coords_${activeTrip.id}`;
            let destLat: number | null = null;
            let destLng: number | null = null;
            try {
              const cachedDest = await AsyncStorage.getItem(destCacheKey);
              if (cachedDest) {
                const p = JSON.parse(cachedDest);
                destLat = p.lat;
                destLng = p.lng;
              }
            } catch {}

            if (destLat == null) {
              try {
                const dResults = await Location.geocodeAsync(activeTrip.destination);
                if (dResults && dResults.length > 0) {
                  destLat = dResults[0].latitude;
                  destLng = dResults[0].longitude;
                  AsyncStorage.setItem(destCacheKey, JSON.stringify({ lat: destLat, lng: destLng })).catch(() => {});
                }
              } catch {}
            }

            if (destLat != null && destLng != null) {
              const angle = (orderNumber - 1) * (Math.PI / 3);
              const radius = 0.0035 * orderNumber;
              lat = destLat + radius * Math.cos(angle);
              lng = destLng + radius * Math.sin(angle);
            }
          }

          // Real location string from itinerary item (reflecting TripPlannerScreen)
          const resolvedLocation = item.location || item.placeAddress || item.placeName || '';

          // If we resolved coordinates, save to cache and add to waypoints
          if (lat != null && lng != null) {
            AsyncStorage.setItem(cacheKey, JSON.stringify({ lat, lng })).catch(() => {});

            let distStr = '';
            if (myLocRef.current) {
              distStr = calculateDistanceFormatted(myLocRef.current.lat, myLocRef.current.lng, lat, lng);
            }

            waypoints.push({
              id: item.id,
              orderNumber,
              time: item.time || '',
              title: item.title,
              category: item.category || item.tag || 'ACTIVITY',
              tag: item.tag,
              location: resolvedLocation,
              placeName: item.placeName,
              placeAddress: item.placeAddress,
              placeId: item.placeId,
              lat,
              lng,
              isCompleted: item.isCompleted,
              photoReference: item.photoReference,
              distanceFromUser: distStr,
            });
          }
        }

        if (!isCancelled) {
          setTodayWaypoints(waypoints);
          setLoadingItinerary(false);
        }
      } catch (err) {
        console.warn('Error loading radar itinerary:', err);
        if (!isCancelled) {
          setLoadingItinerary(false);
        }
      }
    }

    loadDayItinerary();

    // Realtime: Listen to itinerary additions, edits, and deletions from TripPlanner
    const channel = supabase
      .channel(`radar-itinerary-sync:${currentTripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_itinerary_items', filter: `trip_id=eq.${currentTripId}` },
        () => {
          loadDayItinerary();
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeTrip?.id, activeTrip?.dateRange, activeTrip?.destination, myLoc]);

  // Default selection
  useEffect(() => {
    if (members.length === 0) {
      setSelectedMemberId('');
      return;
    }
    const me = members.find((m) => m.isMe) || members[0];
    setSelectedMemberId((prev) => (members.some((m) => m.id === prev) ? prev : me.id));
  }, [members]);

  const currentMember = members.find((m) => m.id === selectedMemberId) || members[0];
  const currentWaypoint = todayWaypoints.find((w) => w.id === selectedWaypointId) || todayWaypoints[0];

  // Map Controls & Gestures
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
    setActiveBottomTab('squad');
    if (m.hasLocation && typeof m.lat === 'number' && typeof m.lng === 'number') {
      animateMapTo(m.lat, m.lng, 15.5);
    } else {
      Alert.alert(
        m.name,
        `${m.name} has joined the trip but has not shared their GPS location yet.`
      );
    }
  };

  const [pingingMemberId, setPingingMemberId] = useState<string | null>(null);

  const handlePingMember = async (m: MemberStatus) => {
    if (!profile?.id) return;
    if (m.isMe) return;

    setPingingMemberId(m.id);
    try {
      await NotificationService.createRadarPingNotification(
        profile.id,
        myDisplayName,
        m.id,
        activeTrip?.id
      );
      Alert.alert('Ping Sent! 📡', `Location ping sent to ${m.name}. They will receive an instant notification.`);
    } catch {
      Alert.alert('Ping Error', 'Unable to send ping. Please try again.');
    } finally {
      setPingingMemberId(null);
    }
  };

  const handleSelectWaypoint = (wp: ItineraryWaypoint) => {
    setSelectedWaypointId(wp.id);
    setActiveBottomTab('itinerary');
    animateMapTo(wp.lat, wp.lng, 16);
  };

  const handleLocateMe = () => {
    if (myLoc) {
      animateMapTo(myLoc.lat, myLoc.lng, 15.5);
    } else {
      Alert.alert('GPS Locating', 'Acquiring satellite fix on your device...');
    }
  };

  const handleFocusItinerary = () => {
    if (todayWaypoints.length === 0) {
      Alert.alert('No Itinerary Stops', `No stops scheduled for Day ${todayDayNumber} yet.`);
      return;
    }
    setActiveBottomTab('itinerary');
    if (todayWaypoints.length === 1) {
      animateMapTo(todayWaypoints[0].lat, todayWaypoints[0].lng, 15.5);
    } else {
      // Find bounding center of waypoints
      let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
      todayWaypoints.forEach((w) => {
        if (w.lat < minLat) minLat = w.lat;
        if (w.lat > maxLat) maxLat = w.lat;
        if (w.lng < minLng) minLng = w.lng;
        if (w.lng > maxLng) maxLng = w.lng;
      });
      const avgLat = (minLat + maxLat) / 2;
      const avgLng = (minLng + maxLng) / 2;
      animateMapTo(avgLat, avgLng, 14);
    }
  };

  const handleToggleStyle = () => {
    const styles: ('auto' | 'hybrid' | 'dark' | 'light')[] = ['auto', 'hybrid', 'dark', 'light'];
    const nextStyle = styles[(styles.indexOf(mapStyleOverride) + 1) % styles.length];
    setMapStyleOverride(nextStyle);
  };

  const handleOpenDirections = (wp: ItineraryWaypoint) => {
    const queryName = wp.placeName || wp.title;
    const dest = wp.placeId
      ? `https://www.google.com/maps/dir/?api=1&destination_place_id=${encodeURIComponent(wp.placeId)}&destination=${encodeURIComponent(queryName)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${queryName} ${wp.placeAddress || wp.location || ''}`.trim())}`;
    Linking.openURL(dest).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${wp.lat},${wp.lng}`).catch(() => {
        Alert.alert('Directions', 'Unable to open maps application.');
      });
    });
  };

  const isDarkModeMap =
    mapStyleOverride === 'dark' || (mapStyleOverride === 'auto' && isDark);

  // Tile Math
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
      let url = `https://${sub}.tile.openstreetmap.org/${baseZoom}/${tx}/${ty}.png`;
      if (mapStyleOverride === 'hybrid') {
        url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${baseZoom}/${ty}/${tx}`;
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

  // Calculate route polyline points connecting today's waypoints
  const polylinePoints = todayWaypoints
    .map((wp) => {
      const pt = latLngToPixel(wp.lat, wp.lng, baseZoom);
      const px = (pt.x - centerPixel.x) * tileScale + viewWidth / 2;
      const py = (pt.y - centerPixel.y) * tileScale + viewHeight / 2;
      return `${px},${py}`;
    })
    .join(' ');

  const bigAvatarSize = isTablet ? 54 : 48;
  const memberAvatarSize = isTablet ? 48 : 42;

  const glassCardStyle = {
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.94)' : 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(255, 255, 255, 0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 12,
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: isDarkModeMap ? '#0D1527' : colors.paper }}
      edges={['top']}
    >
      <StatusBar barStyle={colors.statusBar} backgroundColor={isDarkModeMap ? '#0D1527' : colors.paper} />

      {/* MAP CANVAS */}
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

        {/* Midnight Blue Tint Overlay in Dark Mode */}
        {isDarkModeMap && (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: 'rgba(15, 23, 42, 0.32)' },
            ]}
          />
        )}

        {/* ITINERARY ROUTE POLYLINE (FOR THIS DAY ONLY) */}
        {todayWaypoints.length >= 2 && (
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
          >
            {/* Background Outer Glow Polyline */}
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={isDark ? 'rgba(234, 88, 12, 0.35)' : 'rgba(234, 88, 12, 0.25)'}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Core Crisp Route Line */}
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke="#EA580C"
              strokeWidth="3.5"
              strokeDasharray="6, 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        )}

        {/* ITINERARY NUMBERED WAYPOINT PINS (FOR THIS DAY ONLY) */}
        {todayWaypoints.map((wp) => {
          const pinPixel = latLngToPixel(wp.lat, wp.lng, baseZoom);
          const isSelected = wp.id === selectedWaypointId;
          const pinSize = isSelected ? 36 : 30;

          const pinLeft = (pinPixel.x - centerPixel.x) * tileScale + viewWidth / 2 - pinSize / 2;
          const pinTop = (pinPixel.y - centerPixel.y) * tileScale + viewHeight / 2 - pinSize / 2;

          return (
            <TouchableOpacity
              key={`waypoint-${wp.id}`}
              activeOpacity={0.9}
              onPress={() => handleSelectWaypoint(wp)}
              style={{
                position: 'absolute',
                left: pinLeft,
                top: pinTop,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isSelected ? 65 : 35,
              }}
            >
              {/* Numbered Waypoint Marker Badge */}
              <View
                style={{
                  width: pinSize,
                  height: pinSize,
                  borderRadius: pinSize / 2,
                  backgroundColor: '#EA580C',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isSelected ? 3.5 : 2.5,
                  borderColor: isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.95)',
                  shadowColor: '#EA580C',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.45,
                  shadowRadius: 10,
                  elevation: 9,
                }}
              >
                <Text
                  style={{
                    color: '#FFFFFF',
                    fontWeight: '900',
                    fontSize: isSelected ? 15 : 13,
                  }}
                >
                  {wp.orderNumber}
                </Text>
              </View>

              {/* Waypoint Title & Order Label */}
              <View
                style={{
                  backgroundColor: isDarkModeMap
                    ? 'rgba(15, 23, 42, 0.95)'
                    : 'rgba(255, 255, 255, 0.95)',
                  paddingHorizontal: 7,
                  paddingVertical: 2.5,
                  borderRadius: 8,
                  marginTop: 3,
                  borderWidth: 1,
                  borderColor: isSelected ? '#EA580C' : 'rgba(0, 0, 0, 0.15)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 4,
                  elevation: 5,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '900',
                    color: '#EA580C',
                  }}
                >
                  #{wp.orderNumber}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 9,
                    fontWeight: '800',
                    color: isDarkModeMap ? '#F8FAFC' : '#0F172A',
                    maxWidth: 110,
                  }}
                >
                  {wp.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* REAL MEMBER AVATAR PINS (No Mock Offsets) */}
        {members.map((m) => {
          if (!m.hasLocation || m.lat == null || m.lng == null) {
            return null; // Do NOT render fake pins for members without GPS fix
          }

          const pinPixel = latLngToPixel(m.lat, m.lng, baseZoom);
          const isSelected = m.id === selectedMemberId;
          const pinSize = isSelected ? 48 : 42;

          const pinLeft = (pinPixel.x - centerPixel.x) * tileScale + viewWidth / 2 - pinSize / 2;
          const pinTop = (pinPixel.y - centerPixel.y) * tileScale + viewHeight / 2 - pinSize / 2;

          return (
            <TouchableOpacity
              key={`member-${m.id}`}
              activeOpacity={0.9}
              onPress={() => handleSelectMember(m)}
              style={{
                position: 'absolute',
                left: pinLeft,
                top: pinTop,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isSelected ? 70 : 40,
              }}
            >
              {/* Life360 Live Satellite Pulse Ring for Me */}
              {m.isMe && (
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    width: pinSize * 2.2,
                    height: pinSize * 2.2,
                    borderRadius: pinSize * 1.1,
                    backgroundColor: 'rgba(1, 113, 248, 0.22)',
                    transform: [
                      {
                        scale: radarPulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.75, 1.35],
                        }),
                      },
                    ],
                    opacity: radarPulseAnim.interpolate({
                      inputRange: [0, 0.8, 1],
                      outputRange: [0.6, 0.2, 0],
                    }),
                  }}
                />
              )}

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
                  borderColor: isSelected ? '#0171F8' : (m.isOnline ? '#FFFFFF' : '#94A3B8'),
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
                    backgroundColor: m.battery <= 20 ? '#EF4444' : '#3A8E71',
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  {m.isCharging && <BatteryCharging size={7} color="#FFFFFF" strokeWidth={3} />}
                  <Text style={{ color: '#FFFFFF', fontSize: 7.5, fontWeight: '900' }}>
                    {m.battery}%
                  </Text>
                </View>

                {/* Online / Offline Status Dot */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    left: -2,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: m.isOnline ? '#10B981' : '#94A3B8',
                    borderWidth: 1.5,
                    borderColor: '#FFFFFF',
                  }}
                />
              </View>

              {/* Name & Speed Banner Pill */}
              <View
                style={{
                  backgroundColor: isDarkModeMap
                    ? 'rgba(15, 23, 42, 0.95)'
                    : 'rgba(255, 255, 255, 0.95)',
                  paddingHorizontal: 7,
                  paddingVertical: 2.5,
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
                  alignItems: 'center',
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
                {m.isMoving && (
                  <Text style={{ fontSize: 7.5, fontWeight: '800', color: '#0171F8' }}>
                    {m.speedKmh} km/h
                  </Text>
                )}
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
                backgroundColor: isDeviceOnline ? '#3A8E71' : '#F59E0B',
              }}
            />
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 }}>
              RADAR
            </Text>
            <View
              style={{
                backgroundColor: isDeviceOnline ? 'rgba(58,142,113,0.15)' : 'rgba(245,158,11,0.15)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {isDeviceOnline ? (
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#3A8E71', letterSpacing: 0.5 }}>
                  LIVE
                </Text>
              ) : (
                <Text style={{ fontSize: 8.5, fontWeight: '900', color: '#D97706', letterSpacing: 0.5 }}>
                  OFFLINE
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Weather / Day Badge */}
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
                  : 'Day ' + todayDayNumber}
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
          onPress={handleFocusItinerary}
          style={[
            glassCardStyle,
            {
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: todayWaypoints.length > 0 ? (isDark ? 'rgba(234, 88, 12, 0.2)' : '#FFEDD5') : undefined,
              borderColor: todayWaypoints.length > 0 ? '#EA580C' : undefined,
            },
          ]}
        >
          <Route size={20} color={todayWaypoints.length > 0 ? '#EA580C' : colors.ink} />
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

      {/* CUBIC EASE ANIMATED BOTTOM SQUAD & ITINERARY PANEL SHEET */}
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
          {/* Card Collapse Drag Handle */}
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

          {/* Section Mode Toggle (Squad vs Today's Itinerary) */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              borderRadius: 14,
              padding: 3,
              marginBottom: sp.sm,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveBottomTab('squad')}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: activeBottomTab === 'squad' ? '#0171F8' : 'transparent',
              }}
            >
              <Users size={13} color={activeBottomTab === 'squad' ? '#FFFFFF' : colors.inkSoft} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  color: activeBottomTab === 'squad' ? '#FFFFFF' : colors.inkSoft,
                }}
              >
                Squad ({members.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setActiveBottomTab('itinerary')}
              style={{
                flex: 1,
                paddingVertical: 7,
                borderRadius: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                backgroundColor: activeBottomTab === 'itinerary' ? '#EA580C' : 'transparent',
              }}
            >
              <Route size={13} color={activeBottomTab === 'itinerary' ? '#FFFFFF' : colors.inkSoft} strokeWidth={2.4} />
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  color: activeBottomTab === 'itinerary' ? '#FFFFFF' : colors.inkSoft,
                }}
              >
                Day {todayDayNumber} Stops ({todayWaypoints.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* HEADER DETAIL BAR (Dynamic depending on active tab) */}
          {activeBottomTab === 'squad' ? (
            /* Squad Member Detail Header */
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
                    {currentMember?.isOnline && (
                      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#10B981' }} />
                    )}
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: sp.sm }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MapPin size={12} color="#0171F8" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: fs.xs, color: colors.ink, fontWeight: '600' }}>
                        {currentMember?.statusText || 'Trip Member'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: fs.xs, color: colors.inkSoft }}>
                      • {currentMember?.distance || 'Here'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Ping Member Button */}
              {currentMember && !currentMember.isMe && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  disabled={pingingMemberId === currentMember.id}
                  onPress={() => handlePingMember(currentMember)}
                  style={{
                    backgroundColor: '#0171F8',
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 100,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    marginRight: 4,
                  }}
                >
                  <Radio size={12} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                    {pingingMemberId === currentMember.id ? 'Pinging…' : 'Ping'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Battery & Last Updated */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {currentMember?.isCharging ? (
                      <BatteryCharging size={14} color="#3A8E71" />
                    ) : (
                      <BatteryIcon size={13} color={currentMember?.battery <= 20 ? '#EF4444' : '#3A8E71'} />
                    )}
                    <Text style={{ fontSize: 11, fontWeight: '700', color: currentMember?.battery <= 20 ? '#EF4444' : '#3A8E71' }}>
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
          ) : (
            /* Today's Waypoint Detail Header */
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
              {currentWaypoint ? (
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
                      backgroundColor: '#EA580C',
                      borderWidth: 2,
                      borderColor: '#FFFFFF',
                      shadowColor: '#EA580C',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.25,
                      shadowRadius: 6,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: isCardCollapsed ? 14 : fs.md }}>
                      #{currentWaypoint.orderNumber}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: fs.md, fontWeight: '800', color: colors.ink }}>
                      {currentWaypoint.title}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: sp.sm }}>
                      {currentWaypoint.time ? (
                        <Text style={{ fontSize: fs.xs, color: '#EA580C', fontWeight: '700' }}>
                          {currentWaypoint.time}
                        </Text>
                      ) : null}
                      <Text numberOfLines={1} style={{ fontSize: fs.xs, color: colors.inkSoft, flex: 1 }}>
                        {currentWaypoint.location || 'Scheduled Stop'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={{ flex: 1, paddingVertical: 4, paddingRight: 8, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: fs.sm, fontWeight: '800', color: colors.ink }}>
                    No Stops for Day {todayDayNumber}
                  </Text>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: fs.xs, color: colors.inkSoft, marginTop: 2 }}>
                    Add spots in Trip Planner to track stops here.
                  </Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.xs }}>
                {currentWaypoint && (
                  <TouchableOpacity
                    onPress={() => handleOpenDirections(currentWaypoint)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: 'rgba(234, 88, 12, 0.12)',
                      paddingHorizontal: 10,
                      paddingVertical: 7,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <ExternalLink size={12} color="#EA580C" strokeWidth={2.5} />
                    <Text style={{ color: '#EA580C', fontSize: 11, fontWeight: '800' }}>Directions</Text>
                  </TouchableOpacity>
                )}

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
          )}

          {/* Smooth Collapsible Drawer Body */}
          <Animated.View
            style={{
              maxHeight: animatedProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, isTablet ? 420 : 380],
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
            {activeBottomTab === 'squad' ? (
              /* Squad Member Horizontal Carousel */
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
                        {!m.hasLocation && (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: -2,
                              right: -2,
                              backgroundColor: '#64748B',
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              borderWidth: 1.5,
                              borderColor: '#FFFFFF',
                            }}
                          />
                        )}
                      </View>

                      <Text
                        style={{
                          fontSize: 10,
                          marginTop: 4,
                          fontWeight: isSelected ? '800' : '500',
                          color: isSelected ? '#0171F8' : colors.inkSoft,
                        }}
                      >
                        {m.name.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : todayWaypoints.length > 0 ? (
              /* Today's Itinerary Stops Horizontal Carousel */
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10, paddingVertical: 2, paddingHorizontal: 2 }}
              >
                {todayWaypoints.map((wp) => {
                  const isSelected = selectedWaypointId === wp.id;
                  return (
                    <TouchableOpacity
                      key={wp.id}
                      activeOpacity={0.85}
                      onPress={() => handleSelectWaypoint(wp)}
                      style={{
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(234, 88, 12, 0.25)' : '#FFEDD5')
                          : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#F8FAFC'),
                        borderWidth: 1.5,
                        borderColor: isSelected ? '#EA580C' : colors.cardBorder,
                        borderRadius: 14,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        minWidth: 130,
                        maxWidth: 175,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <View
                          style={{
                            backgroundColor: '#EA580C',
                            paddingHorizontal: 6,
                            paddingVertical: 1.5,
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFFFFF' }}>
                            Stop #{wp.orderNumber}
                          </Text>
                        </View>
                        {wp.time ? (
                          <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>
                            {wp.time}
                          </Text>
                        ) : null}
                      </View>

                      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '800', color: colors.ink }}>
                        {wp.title}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 9, color: colors.inkSoft, marginTop: 2 }}>
                        {wp.location || wp.distanceFromUser || 'Waypoint'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : (
              /* Responsive Empty State (never touches or stretches to edge screen) */
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  borderRadius: 14,
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginHorizontal: 4,
                  borderWidth: 1,
                  borderColor: colors.cardBorder,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  justifyContent: 'center',
                  alignSelf: 'stretch',
                }}
              >
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: colors.ink,
                    textAlign: 'center',
                    paddingHorizontal: 8,
                  }}
                >
                  No stops scheduled for Day {todayDayNumber} yet
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    fontSize: 10.5,
                    fontWeight: '500',
                    color: colors.inkSoft,
                    textAlign: 'center',
                    marginTop: 4,
                    paddingHorizontal: 8,
                    lineHeight: 15,
                  }}
                >
                  Add itinerary spots in Trip Planner to track stops here on the map.
                </Text>
              </View>
            )}

            {/* Bottom Actions Row — Responsive & Uncompressed */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.cardBorder,
                gap: 8,
                minHeight: 44,
              }}
            >
              {/* Left Info: Squad count & status with flex: 1 and minWidth: 0 */}
              <View
                style={{
                  flex: 1,
                  minWidth: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginRight: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, flexShrink: 0 }}>
                  <Users size={12} color="#3A8E71" strokeWidth={2.4} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>
                    {members.filter((m) => m.hasLocation).length}/{members.length}
                  </Text>
                </View>

                <Text style={{ fontSize: 10, color: colors.inkSoft, flexShrink: 0 }}>•</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3.5, flex: 1, minWidth: 0 }}>
                  <Navigation size={12} color="#0171F8" strokeWidth={2.4} style={{ flexShrink: 0 }} />
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={{ fontSize: 10.5, fontWeight: '700', color: colors.ink, flex: 1 }}
                  >
                    {locationStatus}
                  </Text>
                </View>
              </View>

              {/* Right Actions: flexShrink: 0 so Planner and Ping buttons are NEVER compressed or cropped */}
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                {activeBottomTab === 'itinerary' && onNavigateToTab && (
                  <TouchableOpacity
                    onPress={() => onNavigateToTab(1)}
                    activeOpacity={0.8}
                    style={{
                      backgroundColor: 'rgba(234, 88, 12, 0.12)',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4.5,
                      flexShrink: 0,
                      minHeight: 34,
                    }}
                  >
                    <CalendarDays size={13} color="#EA580C" strokeWidth={2.4} />
                    <Text style={{ color: '#EA580C', fontSize: 11.5, fontWeight: '800' }}>Planner</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => {
                    if (isDeviceOnline) {
                      Alert.alert('Ping Broadcast', 'Location ping sent to your squad!');
                    } else {
                      Alert.alert('Offline Mode', 'Your live location is active locally. It will broadcast to peers once internet is reconnected.');
                    }
                  }}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: 'rgba(1, 113, 248, 0.12)',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4.5,
                    flexShrink: 0,
                    minHeight: 34,
                  }}
                >
                  <Radio size={13} color="#0171F8" strokeWidth={2.4} />
                  <Text style={{ color: '#0171F8', fontSize: 11.5, fontWeight: '800' }}>Ping</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};
