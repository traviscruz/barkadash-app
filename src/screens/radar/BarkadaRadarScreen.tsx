import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  StyleSheet,
  Image,
  Dimensions,
  PanResponder,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Settings,
  Share2,
  MapPin,
  Users,
  LocateFixed,
  Layers,
  Radio,
  Navigation,
  Sun,
  Battery,
  Clock,
  Plus,
  Minus,
  Menu,
} from 'lucide-react-native';
import { BarkadashLogo } from '../../components/common/BarkadashLogo';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';

interface MemberStatus {
  id: string;
  name: string;
  initial: string;
  avatarBg: string;
  statusText: string;
  distance: string;
  battery: number;
  lastUpdated: string;
  isMe?: boolean;
  lat: number;
  lng: number;
}

function latLngToPixel(lat: number, lng: number, zoom: number) {
  const scale = 256 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;
  return { x, y };
}

interface BarkadaRadarScreenProps {
  onScrollDirection?: (direction: 'up' | 'down') => void;
  onOpenCabinet?: () => void;
}

export const BarkadaRadarScreen: React.FC<BarkadaRadarScreenProps> = ({ onScrollDirection, onOpenCabinet }) => {
  const { colors, isDark } = useTheme();
  const [selectedMemberId, setSelectedMemberId] = useState<string>('m1');
  const [mapTileStyle, setMapTileStyle] = useState<'voyager' | 'dark' | 'osm'>('voyager');
  const [zoom, setZoom] = useState<number>(12);
  const [center, setCenter] = useState<{ lat: number; lng: number }>({ lat: 11.21, lng: 119.39 });
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const initialPinchDist = useRef<number | null>(null);
  const lastPinchTime = useRef<number>(0);

  const { sp, fs, icon, insets, isTablet } = useResponsive();
  const screenDimensions = Dimensions.get('window');
  const viewWidth = screenDimensions.width;
  const viewHeight = screenDimensions.height;

  const members: MemberStatus[] = [
    {
      id: 'm1',
      name: 'Travis (you)',
      initial: 'T',
      avatarBg: '#0171F8',
      statusText: 'Nacpan Beach',
      distance: '0.0 km',
      battery: 94,
      lastUpdated: 'Just now',
      isMe: true,
      lat: 11.3195,
      lng: 119.4262,
    },
    {
      id: 'm2',
      name: 'Steven',
      initial: 'S',
      avatarBg: '#4F86C6',
      statusText: 'Town Harbor',
      distance: '1.2 km away',
      battery: 82,
      lastUpdated: '2m ago',
      lat: 11.1808,
      lng: 119.3900,
    },
    {
      id: 'm3',
      name: 'Harry',
      initial: 'H',
      avatarBg: '#3B7A9E',
      statusText: 'Las Cabañas Sunset',
      distance: '4.8 km away',
      battery: 76,
      lastUpdated: '5m ago',
      lat: 11.1472,
      lng: 119.3934,
    },
    {
      id: 'm4',
      name: 'Ahiah',
      initial: 'A',
      avatarBg: '#F0A93E',
      statusText: 'Big Lagoon Kayaks',
      distance: '7.3 km away',
      battery: 61,
      lastUpdated: '12m ago',
      lat: 11.1542,
      lng: 119.3214,
    },
    {
      id: 'm5',
      name: 'Ica',
      initial: 'I',
      avatarBg: '#3A8E71',
      statusText: 'Cadlao Resort',
      distance: '0.8 km away',
      battery: 98,
      lastUpdated: '1m ago',
      lat: 11.1870,
      lng: 119.3945,
    },
  ];

  const currentMember = members.find((m) => m.id === selectedMemberId) || members[0];

  // Pinch-to-zoom + Glitch-free Drag PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          const t0 = touches[0];
          const t1 = touches[1];
          initialPinchDist.current = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
        } else {
          initialPinchDist.current = null;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length >= 2) {
          // Pinch Zooming
          const t0 = touches[0];
          const t1 = touches[1];
          const currentDist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
          if (initialPinchDist.current && Date.now() - lastPinchTime.current > 180) {
            const ratio = currentDist / initialPinchDist.current;
            if (ratio > 1.15) {
              setZoom((z) => Math.min(16, z + 1));
              initialPinchDist.current = currentDist;
              lastPinchTime.current = Date.now();
            } else if (ratio < 0.85) {
              setZoom((z) => Math.max(10, z - 1));
              initialPinchDist.current = currentDist;
              lastPinchTime.current = Date.now();
            }
          }
        } else {
          // Drag Panning
          setPanOffset({ x: gestureState.dx, y: gestureState.dy });
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        initialPinchDist.current = null;
        if (Math.abs(gestureState.dx) > 1 || Math.abs(gestureState.dy) > 1) {
          const scale = 256 * Math.pow(2, zoom);
          const deltaLng = (-gestureState.dx / scale) * 360;
          const deltaLat = (gestureState.dy / scale) * 180;

          setCenter((prev) => ({
            lat: Math.max(-85, Math.min(85, prev.lat + deltaLat)),
            lng: prev.lng + deltaLng,
          }));
        }
        setPanOffset({ x: 0, y: 0 });
      },
    })
  ).current;

  const handleSelectMember = (m: MemberStatus) => {
    setSelectedMemberId(m.id);
    setCenter({ lat: m.lat, lng: m.lng });
    setPanOffset({ x: 0, y: 0 });
  };

  const handleShare = () => {
    Alert.alert('Radar Broadcast', 'Live location link generated for Barkada squad.');
  };

  const handlePingSquad = () => {
    Alert.alert('Ping Sent', `Broadcasted location ping to ${currentMember.name.split(' ')[0]}.`);
  };

  const bigAvatarSize = isTablet ? 52 : 46;
  const memberAvatarSize = isTablet ? 48 : 42;

  // Compute map tiles grid for current center, zoom, and pan offset
  const centerPixel = latLngToPixel(center.lat, center.lng, zoom);
  const effectiveCenterX = centerPixel.x - panOffset.x;
  const effectiveCenterY = centerPixel.y - panOffset.y;

  const minXPixel = effectiveCenterX - viewWidth / 2 - 256;
  const maxXPixel = effectiveCenterX + viewWidth / 2 + 256;
  const minYPixel = effectiveCenterY - viewHeight / 2 - 256;
  const maxYPixel = effectiveCenterY + viewHeight / 2 + 256;

  const minTileX = Math.floor(minXPixel / 256);
  const maxTileX = Math.floor(maxXPixel / 256);
  const minTileY = Math.floor(minYPixel / 256);
  const maxTileY = Math.floor(maxYPixel / 256);

  const tiles = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      let url = `https://a.basemaps.cartocdn.com/rastertiles/voyager/${zoom}/${tx}/${ty}.png`;
      if (mapTileStyle === 'dark' || (mapTileStyle === 'voyager' && isDark)) {
        url = `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${tx}/${ty}.png`;
      } else if (mapTileStyle === 'osm') {
        url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
      }
      tiles.push({
        key: `${mapTileStyle}-${zoom}-${tx}-${ty}`,
        url,
        left: tx * 256 - effectiveCenterX + viewWidth / 2,
        top: ty * 256 - effectiveCenterY + viewHeight / 2,
      });
    }
  }

  // Frosted Glass Card Style helper
  const glassContainerStyle = {
    backgroundColor: isDark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.82)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(255, 255, 255, 0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 28,
    elevation: 12,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top']}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.paper} />

      {/* REAL CROSS-PLATFORM INTERACTIVE TILE MAP BACKDROP */}
      <View style={StyleSheet.absoluteFillObject} {...panResponder.panHandlers}>
        {/* Render Map Tiles */}
        {tiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={{
              position: 'absolute',
              width: 256,
              height: 256,
              left: tile.left,
              top: tile.top,
            }}
            resizeMode="cover"
          />
        ))}

        {/* Render Member Pin Markers */}
        {members.map((m) => {
          const pinPixel = latLngToPixel(m.lat, m.lng, zoom);
          const pinLeft = pinPixel.x - effectiveCenterX + viewWidth / 2 - 20;
          const pinTop = pinPixel.y - effectiveCenterY + viewHeight / 2 - 20;
          const isSelected = m.id === selectedMemberId;

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
                zIndex: isSelected ? 30 : 20,
              }}
            >
              <View
                style={{
                  width: isSelected ? 44 : 38,
                  height: isSelected ? 44 : 38,
                  borderRadius: isSelected ? 22 : 19,
                  backgroundColor: m.avatarBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: isSelected ? 3 : 2,
                  borderColor: isSelected ? '#0171F8' : '#FFFFFF',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: isSelected ? 15 : 13 }}>
                  {m.initial}
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: colors.pillBg,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  marginTop: 4,
                  borderWidth: 1,
                  borderColor: colors.pillBorder,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.ink }}>
                  {m.name.split(' ')[0]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* TOP FLOATING APP BAR OVERLAY DIRECTLY ON MAP */}
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
        {/* Frosted Glass Oval with Hamburger + Logo + Radar Live */}
        <View
          style={[
            glassContainerStyle,
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

          <View style={{ width: 1, height: 16, backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', marginHorizontal: 2 }} />

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

        {/* Right Header Action: Weather Badge */}
        <View
          style={[
            glassContainerStyle,
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
          <Sun size={14} color="#D97706" />
          <Text style={{ fontSize: fs.xs, fontWeight: '700', color: colors.ink }}>29°C</Text>
        </View>
      </View>

      {/* FLOATING QUICK MAP CONTROLS (RIGHT SIDE) */}
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
          onPress={() => {
            const travis = members[0];
            setCenter({ lat: travis.lat, lng: travis.lng });
            setSelectedMemberId('m1');
            setZoom(13);
            setPanOffset({ x: 0, y: 0 });
          }}
          style={[
            glassContainerStyle,
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <LocateFixed size={18} color="#0171F8" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setZoom((prev) => Math.min(16, prev + 1))}
          style={[
            glassContainerStyle,
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Plus size={18} color={colors.ink} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setZoom((prev) => Math.max(10, prev - 1))}
          style={[
            glassContainerStyle,
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Minus size={18} color={colors.ink} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            const styles: ('voyager' | 'dark' | 'osm')[] = ['voyager', 'dark', 'osm'];
            const next = styles[(styles.indexOf(mapTileStyle) + 1) % styles.length];
            setMapTileStyle(next);
          }}
          style={[
            glassContainerStyle,
            {
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <Layers size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* BOTTOM RADAR PANEL SHEET (FROSTED GLASS CARD) */}
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
            glassContainerStyle,
            {
              borderRadius: 28,
              padding: sp.lg,
              gap: sp.md,
            },
          ]}
        >
          {/* Member Detail Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: sp.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.cardBorder,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View
                style={{
                  width: bigAvatarSize,
                  height: bigAvatarSize,
                  borderRadius: bigAvatarSize / 2,
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
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: fs.md }}>{currentMember.initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: fs.md, fontWeight: '800', color: colors.ink }}>{currentMember.name}</Text>
                  {currentMember.isMe && (
                    <View
                      style={{
                        backgroundColor: 'rgba(1, 113, 248, 0.12)',
                        paddingHorizontal: sp.sm,
                        paddingVertical: 2,
                        borderRadius: 6,
                        marginLeft: 6,
                      }}
                    >
                      <Text style={{ color: '#0171F8', fontSize: 9, fontWeight: '900' }}>YOU</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: sp.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MapPin size={13} color="#0171F8" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: fs.xs, color: colors.ink, fontWeight: '600' }}>
                      {currentMember.statusText}
                    </Text>
                  </View>
                  <Text style={{ fontSize: fs.xs, color: colors.inkSoft }}>• {currentMember.distance}</Text>
                </View>
              </View>
            </View>

            {/* Quick Status Stats */}
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Battery size={13} color="#3A8E71" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#3A8E71' }}>{currentMember.battery}%</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Clock size={11} color={colors.inkSoft} />
                <Text style={{ fontSize: 10, color: colors.inkSoft, fontWeight: '500' }}>{currentMember.lastUpdated}</Text>
              </View>
            </View>
          </View>

          {/* Member Selector Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2 }}>
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
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: fs.sm }}>{m.initial}</Text>
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
          </View>

          {/* Bottom Actions & Summary Bar */}
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
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>5 Squad</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Navigation size={13} color="#0171F8" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.ink }}>El Nido</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: sp.xs }}>
              <TouchableOpacity
                onPress={handlePingSquad}
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
                onPress={handleShare}
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
        </View>
      </View>
    </SafeAreaView>
  );
};
