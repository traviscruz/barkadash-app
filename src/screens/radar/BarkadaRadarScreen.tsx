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
import {
  MapPin,
  Users,
  LocateFixed,
  Layers,
  Radio,
  Navigation,
  Battery,
  Clock,
  Menu,
  Share2,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { fetchWeather } from '../../services/weatherService';

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
  lat: number;
  lng: number;
}

interface BarkadaRadarScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
}

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  if (d < 0.1) return 'Here';
  return `${d.toFixed(1)} km away`;
}

function latLngToPixel(lat: number, lng: number, zoom: number) {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

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
  const [selectedMemberId, setSelectedMemberId] = useState<string>('m1');
  const [locationStatus, setLocationStatus] = useState<string>('Acquiring GPS...');
  const [isCardCollapsed, setIsCardCollapsed] = useState<boolean>(false);

  // Asymmetric Animation: Playful Spring Bounce on Open, Snappy Clean Ease on Close
  const animatedProgress = useRef(new Animated.Value(1)).current; // 1 = expanded, 0 = collapsed

  const toggleCardCollapsed = () => {
    const nextCollapsedState = !isCardCollapsed;
    setIsCardCollapsed(nextCollapsedState);

    if (nextCollapsedState) {
      // Snappy Clean Ease Down for Closing (No Weird Bounce Overshoot)
      Animated.timing(animatedProgress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.poly(3)),
        useNativeDriver: false,
      }).start();
    } else {
      // Perfect Elastic Bounce Pop for Opening
      Animated.spring(animatedProgress, {
        toValue: 1,
        bounciness: 15,
        speed: 10,
        useNativeDriver: false,
      }).start();
    }
  };

  // Continuous Float Zoom (Allows 60fps smooth Pinching without frame skips)
  const [zoom, setZoom] = useState<number>(14.0);
  const zoomRef = useRef<number>(14.0);
  zoomRef.current = zoom;

  const [center, setCenter] = useState<{ lat: number; lng: number }>({
    lat: 14.5995,
    lng: 120.9842,
  });

  const [members, setMembers] = useState<MemberStatus[]>([
    {
      id: 'm1',
      name: 'Travis (you)',
      initial: 'T',
      avatarBg: '#0171F8',
      statusText: 'Current Location',
      address: 'Near City Center Plaza',
      distance: '0.0 km',
      battery: 94,
      speed: 'Stationary',
      lastUpdated: 'Just now',
      isMe: true,
      lat: 14.5995,
      lng: 120.9842,
    },
    {
      id: 'm2',
      name: 'Steven',
      initial: 'S',
      avatarBg: '#EA4335',
      statusText: 'Coffee Hub',
      address: 'Main St & 5th Ave',
      distance: '0.8 km away',
      battery: 88,
      speed: 'Walking • 4 km/h',
      lastUpdated: '2m ago',
      lat: 14.6045,
      lng: 120.9892,
    },
    {
      id: 'm3',
      name: 'Harry',
      initial: 'H',
      avatarBg: '#FBBC05',
      statusText: 'City Square',
      address: 'Central Park West',
      distance: '1.4 km away',
      battery: 76,
      speed: 'Driving • 24 km/h',
      lastUpdated: '4m ago',
      lat: 14.5915,
      lng: 120.9932,
    },
    {
      id: 'm4',
      name: 'Ahiah',
      initial: 'A',
      avatarBg: '#34A853',
      statusText: 'Shopping District',
      address: 'Grand Promenade',
      distance: '2.1 km away',
      battery: 63,
      speed: 'Stationary',
      lastUpdated: '10m ago',
      lat: 14.6115,
      lng: 120.9742,
    },
    {
      id: 'm5',
      name: 'Ica',
      initial: 'I',
      avatarBg: '#A142F4',
      statusText: 'Waterfront Park',
      address: 'Baywalk Esplanade',
      distance: '0.5 km away',
      battery: 97,
      speed: 'Idle',
      lastUpdated: '1m ago',
      lat: 14.5955,
      lng: 120.9802,
    },
  ]);

  // Fetch Phone GPS Location
  useEffect(() => {
    let isMounted = true;

    async function fetchPhoneLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (isMounted) {
            setLocationStatus('GPS Access Denied');
            setLoadingLocation(false);
          }
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (location && location.coords && isMounted) {
          const lat = location.coords.latitude;
          const lng = location.coords.longitude;

          setCenter({ lat, lng });
          setLocationStatus('Live GPS Active');

          const weather = await fetchWeather(lat, lng);
          if (isMounted && weather) {
            setWeatherTemp(weather.tempC);
            setWeatherIsDay(weather.isDay);
          }

          const updatedMembers: MemberStatus[] = [
            {
              id: 'm1',
              name: 'Travis (you)',
              initial: 'T',
              avatarBg: '#0171F8',
              statusText: 'Your Phone Location',
              address: 'Current Device Location',
              distance: '0.0 km',
              battery: 94,
              speed: 'Stationary',
              lastUpdated: 'Just now',
              isMe: true,
              lat,
              lng,
            },
            {
              id: 'm2',
              name: 'Steven',
              initial: 'S',
              avatarBg: '#EA4335',
              statusText: 'Nearby Spot',
              address: '0.5 km North',
              distance: calculateDistanceKm(lat, lng, lat + 0.005, lng + 0.004),
              battery: 88,
              speed: 'Walking • 3 km/h',
              lastUpdated: '2m ago',
              lat: lat + 0.005,
              lng: lng + 0.004,
            },
            {
              id: 'm3',
              name: 'Harry',
              initial: 'H',
              avatarBg: '#FBBC05',
              statusText: 'Avenue Plaza',
              address: '0.9 km East',
              distance: calculateDistanceKm(lat, lng, lat - 0.007, lng + 0.006),
              battery: 76,
              speed: 'Driving • 18 km/h',
              lastUpdated: '4m ago',
              lat: lat - 0.007,
              lng: lng + 0.006,
            },
            {
              id: 'm4',
              name: 'Ahiah',
              initial: 'A',
              avatarBg: '#34A853',
              statusText: 'Food Market',
              address: '1.4 km West',
              distance: calculateDistanceKm(lat, lng, lat + 0.009, lng - 0.008),
              battery: 63,
              speed: 'Stationary',
              lastUpdated: '10m ago',
              lat: lat + 0.009,
              lng: lng - 0.008,
            },
            {
              id: 'm5',
              name: 'Ica',
              initial: 'I',
              avatarBg: '#A142F4',
              statusText: 'Central Gardens',
              address: '0.4 km South',
              distance: calculateDistanceKm(lat, lng, lat - 0.003, lng - 0.003),
              battery: 97,
              speed: 'Idle',
              lastUpdated: '1m ago',
              lat: lat - 0.003,
              lng: lng - 0.003,
            },
          ];

          setMembers(updatedMembers);
          setLoadingLocation(false);
        }
      } catch (err) {
        console.log('Location error:', err);
        if (isMounted) {
          setLocationStatus('GPS Ready');
          setLoadingLocation(false);
        }
      }
    }

    fetchPhoneLocation();

    return () => {
      isMounted = false;
    };
  }, []);

  const currentMember = members.find((m) => m.id === selectedMemberId) || members[0];

  // 60FPS Continuous Pinch Zooming & Dragging
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchZoom = useRef<number>(14.0);
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

          setCenter((prev) => ({
            lat: Math.max(-85, Math.min(85, prev.lat + deltaLat)),
            lng: ((prev.lng + deltaLng + 180) % 360) - 180,
          }));
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
    setCenter({ lat: m.lat, lng: m.lng });
  };

  const handleLocateMe = () => {
    const me = members.find((m) => m.isMe) || members[0];
    setSelectedMemberId(me.id);
    setCenter({ lat: me.lat, lng: me.lng });
    setZoom(15.0);
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

  const tiles = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      let url = `https://mt1.google.com/vt/lyrs=m&x=${tx}&y=${ty}&z=${baseZoom}&scale=2`;

      if (mapStyleOverride === 'hybrid') {
        url = `https://mt1.google.com/vt/lyrs=y&x=${tx}&y=${ty}&z=${baseZoom}&scale=2`;
      } else if (isDarkModeMap) {
        url = `https://a.basemaps.cartocdn.com/dark_all/${baseZoom}/${tx}/${ty}@2x.png`;
      } else if (Platform.OS === 'ios') {
        url = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${baseZoom}/${tx}/${ty}@2x.png`;
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
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: isSelected ? 16 : 14 }}>
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

      {/* ORIGINAL FLOATING HEADER */}
      <View
        style={{
          position: 'absolute',
          top: insets.top + sp.sm,
          left: sp.lg,
          right: sp.lg,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 50,
        }}
      >
        <View
          style={[
            glassCardStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 4,
              paddingRight: 12,
              paddingVertical: 4,
              borderRadius: 100,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onOpenCabinet}
            activeOpacity={0.7}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
            }}
          >
            <Menu size={20} color={colors.ink} strokeWidth={2.2} />
          </TouchableOpacity>

          <BarkadashLogo height={26} />

          <View
            style={{
              width: 1,
              height: 16,
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
              marginHorizontal: 2,
            }}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3A8E71' }} />
            <Text style={{ fontSize: fs.xs, fontWeight: '800', color: colors.ink, letterSpacing: -0.2 }}>
              RADAR
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(58,142,113,0.15)',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 6,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '900', color: '#3A8E71', letterSpacing: 0.5 }}>
                LIVE
              </Text>
            </View>
          </View>
        </View>

        {/* Weather / Day-Night Appearance Badge */}
        <View
          style={[
            glassCardStyle,
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 100,
            },
          ]}
        >
          {weatherIsDay ? <Sun size={14} color="#D97706" /> : <Moon size={14} color="#60A5FA" />}
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>
            {loadingLocation ? 'Locating...' : weatherTemp == null ? '--' : `${weatherTemp}°C`}
          </Text>
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
                  backgroundColor: currentMember.avatarBg,
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
                  {currentMember.initial}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: fs.md, fontWeight: '800', color: colors.ink }}>
                    {currentMember.name}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: sp.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MapPin size={12} color="#0171F8" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: fs.xs, color: colors.ink, fontWeight: '600' }}>
                      {currentMember.statusText}
                    </Text>
                  </View>
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft }}>
                    • {currentMember.distance}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Quick Battery, Clock & Expand/Collapse Chevron */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp.sm }}>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Battery size={13} color="#3A8E71" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#3A8E71' }}>
                    {currentMember.battery}%
                  </Text>
                </View>
                {!isCardCollapsed && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Clock size={11} color={colors.inkSoft} />
                    <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '500' }}>
                      {currentMember.lastUpdated}
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
                        color: isSelected ? '#0171F8' : colors.inkSoft,
                      }}
                    >
                      {m.initial === 'T' ? 'Travis' : m.name.split(' ')[0]}
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
                    5 Squad
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
                  onPress={() => Alert.alert('Ping Sent', `Broadcasted location ping to squad.`)}
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

                <TouchableOpacity
                  onPress={() => Alert.alert('Radar Broadcast', 'Live location link generated.')}
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: '#1F4E67',
                    paddingHorizontal: sp.md,
                    paddingVertical: sp.xs + 2,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: sp.xs,
                    shadowColor: '#1F4E67',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.2,
                    shadowRadius: 4,
                  }}
                >
                  <Share2 size={13} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: fs.xs, fontWeight: '700' }}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
};
