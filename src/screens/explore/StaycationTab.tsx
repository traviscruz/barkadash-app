import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Linking,
  RefreshControl,
} from 'react-native';
import { Search, Star, Hotel, MapPin, Sparkles } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { PlacePrediction } from '../../services/googlePlaces';
import { searchPlacesNear, getPlacePhotoUrl } from '../../services/googlePlaces';
import { searchStaycationAmadeus, StaycationListing, amadeusConfigured } from '../../services/amadeusService';
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput';

interface StaycationItem {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  pricePerNight: number | null;
  currency: string;
  distanceKm: number | null;
  priceLevel: number | null;
  photoReference?: string;
  placeId?: string;
}

type SearchSource = 'amadeus' | 'google' | null;

interface StaycationTabProps {
  accentColor: string;
  onScrollDirection?: (direction: 'up' | 'down') => void;
}

const PRICE_LEVELS = ['', '$', '$$', '$$$', '$$$$', '$$$$$'];

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
  MYR: 'RM',
  IDR: 'Rp',
  THB: '฿',
};

const formatMoney = (amount: number | null, currency: string): string => {
  if (amount == null) return '';
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${sym}${Math.round(amount).toLocaleString()}`;
};

const mapsUrl = (item: StaycationItem): string => {
  if (item.placeId) {
    return `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(item.placeId)}`;
  }
  const query = [item.name, item.address].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

export const StaycationTab: React.FC<StaycationTabProps> = ({ accentColor, onScrollDirection }) => {
  const { colors } = useTheme();
  const { sp, fs, icon, bottomNavOffset } = useResponsive();
  const lastOffsetY = useRef(0);

  const [location, setLocation] = useState<PlacePrediction | null>(null);
  const [items, setItems] = useState<StaycationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<SearchSource>(null);

  const handleSearch = async () => {
    if (!location) {
      setError('Pick a place to browse staycations first.');
      return;
    }
    const placeName = [location.mainText, location.secondaryText].filter(Boolean).join(', ');

    setLoading(true);
    setError('');
    setItems([]);
    setSource(null);

    let amadeus: StaycationListing[] | null = null;
    if (amadeusConfigured) {
      try {
        amadeus = await searchStaycationAmadeus(location.mainText);
      } catch (e: any) {
        console.warn('Amadeus staycation search failed:', e?.message);
        amadeus = null;
      }
    }

    if (amadeus && amadeus.length > 0) {
      setItems(
        amadeus.map((a) => ({
          id: a.id,
          name: a.name,
          address: a.address,
          rating: a.rating,
          pricePerNight: a.pricePerNight,
          currency: a.currency,
          distanceKm: a.distanceKm,
          priceLevel: null,
        }))
      );
      setSource('amadeus');
    } else {
      const [g1, g2] = await Promise.all([
        searchPlacesNear('staycation', placeName),
        searchPlacesNear('hotel', placeName),
      ]);
      const seen = new Set<string>();
      const merged: StaycationItem[] = [];
      for (const g of [g1, g2]) {
        for (const p of g.places) {
          if (!p.placeId || seen.has(p.placeId)) continue;
          seen.add(p.placeId);
          merged.push({
            id: p.placeId,
            name: p.name,
            address: p.address,
            rating: p.rating,
            pricePerNight: null,
            currency: '',
            distanceKm: null,
            priceLevel: p.priceLevel,
            photoReference: p.photoReference,
            placeId: p.placeId,
          });
        }
      }
      if (merged.length > 0) {
        setItems(merged);
        setSource('google');
      } else {
        setError('No staycation spots found there. Try a different place.');
      }
    }

    setLoading(false);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={handleSearch}
          tintColor={accentColor}
          colors={[accentColor]}
        />
      }
      onScroll={(e) => {
        const currentY = e.nativeEvent.contentOffset.y;
        const delta = currentY - lastOffsetY.current;
        lastOffsetY.current = currentY;
        if (currentY < 15) onScrollDirection?.('up');
        else if (delta > 2) onScrollDirection?.('down');
        else if (delta < -2) onScrollDirection?.('up');
      }}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: sp.lg, paddingBottom: bottomNavOffset + 24 }}
    >
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.inkSoft, marginBottom: sp.md, lineHeight: 18 }}>
        Browse staycations, hotels and Airbnb-style stays around any place for your next barkada getaway.
      </Text>

      <PlaceAutocompleteInput
        label="Where"
        placeholder="e.g. Batangas, Baguio, Siargao"
        accentColor={accentColor}
        value={location ? [location.mainText, location.secondaryText].filter(Boolean).join(', ') : ''}
        onSelect={setLocation}
      />

      <TouchableOpacity
        onPress={handleSearch}
        disabled={loading}
        activeOpacity={0.85}
        style={{
          marginTop: sp.lg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: accentColor,
          borderRadius: 18,
          paddingVertical: 15,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Search size={icon.md} color="#FFFFFF" strokeWidth={2.4} />
        )}
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: -0.2 }}>
          {loading ? 'Searching…' : 'Find staycations'}
        </Text>
      </TouchableOpacity>

      {error ? (
        <View style={{ marginTop: sp.lg, backgroundColor: colors.lightRedBg, borderRadius: 16, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.redAccent, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      {items.length > 0 && (
        <View style={{ marginTop: sp.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.sm }}>
            <Text style={{ fontSize: 13, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
              {items.length} {items.length === 1 ? 'stay' : 'stays'} found
            </Text>
            {source && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.lightGreenBg, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Sparkles size={10} color={colors.emerald} />
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.emerald, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {source}
                </Text>
              </View>
            )}
          </View>

          <View style={{ gap: sp.md }}>
            {items.map((item) => {
              const priceLabel = item.pricePerNight != null
                ? `${formatMoney(item.pricePerNight, item.currency)}/night`
                : item.priceLevel != null
                  ? PRICE_LEVELS[item.priceLevel] || ''
                  : '';
              const photoUri = item.photoReference ? getPlacePhotoUrl(item.photoReference, 600) : '';
              return (
                <View
                  key={item.id}
                  style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, overflow: 'hidden' }}
                >
                  {photoUri ? (
                    <ImageBackground source={{ uri: photoUri }} style={{ height: 150, width: '100%' }} imageStyle={{}}>
                      {priceLabel ? (
                        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: colors.card, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: colors.ink }}>{priceLabel}</Text>
                        </View>
                      ) : null}
                    </ImageBackground>
                  ) : (
                    <View style={{ height: 150, width: '100%', backgroundColor: colors.paperDim, alignItems: 'center', justifyContent: 'center' }}>
                      <Hotel size={30} color={colors.inkSoft} />
                      {priceLabel ? (
                        <View style={{ position: 'absolute', top: 10, right: 10, backgroundColor: colors.card, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 }}>
                          <Text style={{ fontSize: 11, fontWeight: '900', color: colors.ink }}>{priceLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                  )}

                  <View style={{ padding: 14 }}>
                    <Text style={{ fontSize: fs.md, fontWeight: '900', color: colors.ink, letterSpacing: -0.2 }} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 }}>
                      <MapPin size={12} color={colors.inkSoft} />
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft, flex: 1 }} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      {item.rating != null && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Star size={12} color="#F59E0B" fill="#F59E0B" />
                          <Text style={{ fontSize: 12, fontWeight: '800', color: colors.ink }}>{item.rating.toFixed(1)}</Text>
                        </View>
                      )}
                      {item.distanceKm != null && (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft }}>
                          {item.distanceKm < 1
                            ? `${Math.round(item.distanceKm * 1000)} m from centre`
                            : `${item.distanceKm.toFixed(1)} km from centre`}
                        </Text>
                      )}
                    </View>

                    <TouchableOpacity
                      onPress={() => Linking.openURL(mapsUrl(item)).catch(() => setError('Couldn\u2019t open Google Maps.'))}
                      activeOpacity={0.8}
                      style={{
                        marginTop: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        backgroundColor: `${accentColor}1a`,
                        borderRadius: 12,
                        paddingVertical: 9,
                      }}
                    >
                      <MapPin size={13} color={accentColor} strokeWidth={2.4} />
                      <Text style={{ fontSize: 12, fontWeight: '800', color: accentColor }}>Open in Google Maps</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
};