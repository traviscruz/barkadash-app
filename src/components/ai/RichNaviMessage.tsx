import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, TextStyle, Linking, ActivityIndicator } from 'react-native';
import {
  MapPin,
  Star,
  ExternalLink,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  CloudSun,
  Wind,
  Droplets,
  ThermometerSun,
  Check,
  X,
} from 'lucide-react-native';
import { AiChatMessage } from '../../services/aiChatService';
import { ChatToolResult, WeatherToolData, PlaceToolData } from '../../services/geminiService';
import { getPlacePhotoUrl } from '../../services/googlePlaces';
import { ShimmerImage } from '../common/ShimmerImage';
import { ThemeColors } from '../../context/ThemeContext';

interface Props {
  message: AiChatMessage;
  colors: ThemeColors;
  isDark: boolean;
  onAcceptPlace?: (place: PlaceToolData) => Promise<boolean>;
}

const mapsLinkFor = (place: PlaceToolData): string => {
  const base = 'https://www.google.com/maps/search/?api=1';
  if (place.placeId) {
    return `${base}&query=${encodeURIComponent(place.name)}&query_place_id=${encodeURIComponent(place.placeId)}`;
  }
  const q = encodeURIComponent(`${place.name} ${place.address || ''}`.trim());
  return `${base}&query=${q}`;
};

const openMaps = (place: PlaceToolData) => {
  Linking.openURL(mapsLinkFor(place)).catch((err) => {
    console.warn('openMaps error:', err?.message);
  });
};

// ---- Inline markdown: **bold**, *bold*, ***bold*** ----
const renderInline = (text: string, base: TextStyle) => {
  const parts = text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('***') && p.endsWith('***') && p.length > 6) {
      return (
        <Text key={i} style={[base, { fontWeight: '800' }]}>
          {p.slice(3, -3)}
        </Text>
      );
    }
    if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
      return (
        <Text key={i} style={[base, { fontWeight: '800' }]}>
          {p.slice(2, -2)}
        </Text>
      );
    }
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) {
      return (
        <Text key={i} style={[base, { fontWeight: '800' }]}>
          {p.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={i} style={base}>{p}</Text>;
  });
};

// ---- Line-level markdown: headings, bullets, numbered lists ----
const renderMarkdown = (text: string, base: TextStyle) => {
  const nodes: React.ReactNode[] = [];
  const lines = text.split('\n');
  let blockCount = 0;

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) return;

    if (/^#{1,3}\s/.test(line)) {
      nodes.push(
        <Text key={idx} style={[base, { fontWeight: '900', marginTop: blockCount > 0 ? 14 : 0 }]}>
          {renderInline(line.replace(/^#{1,3}\s*/, ''), base)}
        </Text>
      );
      blockCount++;
      return;
    }

    let content = line;
    let prefix = '';
    if (/^[-*•]\s/.test(line)) {
      prefix = '•  ';
      content = line.replace(/^[-*•]\s*/, '');
    } else if (/^\d+[.)]\s/.test(line)) {
      const m = line.match(/^(\d+)[.)]\s*/);
      prefix = `${m![1]}.  `;
      content = line.replace(/^\d+[.)]\s*/, '');
    }

    const isList = !!prefix;
    nodes.push(
      <Text
        key={idx}
        style={[
          base,
          {
            marginLeft: isList ? 6 : 0,
            marginTop: !isList && blockCount > 0 ? 10 : isList ? 4 : 0,
          },
        ]}
      >
        {prefix ? <Text style={[base, { fontWeight: '800', opacity: 0.6 }]}>{prefix}</Text> : null}
        {renderInline(content, base)}
      </Text>
    );
    blockCount++;
  });
  return nodes;
};

const weatherIcon = (condition: string, color: string, size: number) => {
  const c = condition.toLowerCase();
  const props = { color, size, strokeWidth: 2 };
  if (c.includes('thunder')) return <CloudLightning {...props} />;
  if (c.includes('snow')) return <CloudSnow {...props} />;
  if (c.includes('rain') || c.includes('drizzle')) return <CloudRain {...props} />;
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return <CloudFog {...props} />;
  if (c.includes('cloud')) return <Cloud {...props} />;
  if (c.includes('clear') || c.includes('sun')) return <Sun {...props} />;
  return <CloudSun {...props} />;
};

const WeatherCard: React.FC<{ weather: WeatherToolData; colors: ThemeColors; isDark: boolean }> = ({
  weather,
  colors,
  isDark,
}) => {
  const accent = isDark ? '#60A5FA' : colors.sky;
  return (
    <View
      style={{
        backgroundColor: isDark ? 'rgba(96,165,250,0.14)' : colors.lightBlueBg,
        borderColor: isDark ? 'rgba(96,165,250,0.35)' : 'rgba(79,134,198,0.25)',
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        marginTop: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {weatherIcon(weather.condition, accent, 28)}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: colors.ink }}>
            {weather.location}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: isDark ? '#BFDBFE' : colors.skyDeep, textTransform: 'capitalize', marginTop: 2 }}>
            {weather.description}
          </Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.ink }}>
          {weather.tempC}°
        </Text>
      </View>
      <View
        style={{
          height: 1,
          backgroundColor: isDark ? 'rgba(96,165,250,0.2)' : 'rgba(79,134,198,0.18)',
        }}
      />
      <View style={{ flexDirection: 'row', gap: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <ThermometerSun size={12} color={accent} />
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>Feels {weather.feelsLikeC}°</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Droplets size={12} color={accent} />
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>{weather.humidity}%</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Wind size={12} color={accent} />
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>{weather.windMps} m/s</Text>
        </View>
      </View>
    </View>
  );
};

const PlaceCard: React.FC<{
  place: PlaceToolData;
  colors: ThemeColors;
  isDark: boolean;
  onAccept?: () => Promise<boolean>;
}> = ({ place, colors, isDark, onAccept }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'accepted' | 'declined'>('idle');
  const photoUri =
    place.photoReference && !imgFailed ? getPlacePhotoUrl(place.photoReference, 800) : '';

  const handleAccept = async () => {
    if (!onAccept || state === 'busy') return;
    setState('busy');
    const ok = await onAccept();
    setState(ok ? 'accepted' : 'idle');
  };

  const dimmed = state === 'declined';

  return (
    <View
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.cardBorder,
        backgroundColor: colors.card,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <TouchableOpacity
        onPress={() => openMaps(place)}
        activeOpacity={0.85}
      >
        {/* Photo block — poll-style full-width cover */}
        <View style={{ height: 104, backgroundColor: isDark ? '#10283A' : '#1B3A4D' }}>
          {photoUri ? (
            <ShimmerImage
              containerStyle={{ ...StyleSheet.absoluteFillObject }}
              source={{ uri: photoUri }}
              resizeMode="cover"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={34} color={isDark ? 'rgba(96,165,250,0.4)' : 'rgba(255,255,255,0.55)'} strokeWidth={1.6} />
            </View>
          )}
        </View>

        {/* Body */}
        <View style={{ padding: 12, gap: 5 }}>
          <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '800', color: colors.ink }}>
            {place.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {place.rating != null && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Star size={12} color={colors.sun} fill={colors.sun} />
                <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.ink }}>
                  {place.rating}
                </Text>
              </View>
            )}
            {place.priceLevel != null && place.priceLevel > 0 && (
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.tealAccent }}>
                {'₱'.repeat(Math.min(place.priceLevel, 4))}
              </Text>
            )}
          </View>
          {!!place.address && (
            <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '600', color: colors.inkSoft }}>
              {place.address}
            </Text>
          )}
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}
            pointerEvents="none"
          >
            <MapPin size={12} color={colors.tealAccent} strokeWidth={2.2} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.tealAccent }}>
              View on Google Maps
            </Text>
            <ExternalLink size={10} color={colors.tealAccent} />
          </View>
        </View>
      </TouchableOpacity>

      {/* Accept / Decline actions */}
      {state === 'accepted' ? (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: 12,
            paddingVertical: 9,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
            backgroundColor: isDark ? 'rgba(16,185,129,0.2)' : '#E6F4EA',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(16,185,129,0.4)' : 'rgba(16,185,129,0.45)',
          }}
        >
          <Check size={14} color="#10B981" strokeWidth={3} />
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#10B981' }}>
            Added to Itinerary
          </Text>
        </View>
      ) : state === 'declined' ? (
        <View
          style={{
            marginHorizontal: 12,
            marginBottom: 12,
            paddingVertical: 9,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
          }}
        >
          <X size={14} color={colors.inkSoft} strokeWidth={2.6} />
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.inkSoft }}>
            Declined
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
          <TouchableOpacity
            onPress={handleAccept}
            disabled={state === 'busy'}
            activeOpacity={0.85}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.tealDark,
              opacity: state === 'busy' ? 0.6 : 1,
            }}
          >
            {state === 'busy' ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' }}>
                Accept
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setState('declined')}
            disabled={state === 'busy'}
            activeOpacity={0.8}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 100,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: colors.cardBorder,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
            }}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: colors.inkSoft }}>
              Decline
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const RichNaviMessage: React.FC<Props> = ({ message, colors, isDark, onAcceptPlace }) => {
  const textStyle: TextStyle = {
    fontSize: 13.5,
    fontWeight: '500',
    lineHeight: 22,
    color: colors.ink,
  };

  return (
    <View style={{ width: '100%' }}>
      {renderMarkdown(message.text, textStyle)}

      {message.tools?.map((tool: ChatToolResult, i) =>
        tool.type === 'weather' ? (
          <WeatherCard key={`w${i}`} weather={tool.weather} colors={colors} isDark={isDark} />
        ) : tool.type === 'places' ? (
          <View key={`p${i}`} style={{ marginTop: 16, gap: 20 }}>
            {tool.places.map((p, j) => (
              <PlaceCard
                key={`${i}-${j}`}
                place={p}
                colors={colors}
                isDark={isDark}
                onAccept={onAcceptPlace ? () => onAcceptPlace(p) : undefined}
              />
            ))}
          </View>
        ) : null
      )}
    </View>
  );
};
