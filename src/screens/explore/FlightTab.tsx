import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  RefreshControl,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ArrowUpDown, Search, CalendarDays, Clock, ArrowRight, Sparkles, ExternalLink } from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { FlightAirport, searchFlights, FlightItinerary } from '../../services/flightapiService';
import { AirportAutocompleteInput } from './AirportAutocompleteInput';

interface FlightTabProps {
  accentColor: string;
  onScrollDirection?: (direction: 'up' | 'down') => void;
}

const toISODate = (d: Date): string => d.toISOString().slice(0, 10);

const formatTime = (iso: string): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  let h = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
};

const formatDuration = (minutes: number): string => {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

export const FlightTab: React.FC<FlightTabProps> = ({ accentColor, onScrollDirection }) => {
  const { colors, isDark } = useTheme();
  const { sp, icon, bottomNavOffset } = useResponsive();
  const lastOffsetY = useRef(0);

  const [from, setFrom] = useState<FlightAirport | null>(null);
  const [to, setTo] = useState<FlightAirport | null>(null);
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  });
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flights, setFlights] = useState<FlightItinerary[]>([]);
  const [error, setError] = useState('');

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
  };

  const onAndroidDateChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShowAndroidPicker(false);
    if (event.type === 'set' && selected) setDate(selected);
  };

  const handleSearch = async () => {
    if (!from || !to) {
      setError('Pick both an origin and a destination airport first.');
      return;
    }
    setLoading(true);
    setError('');
    setFlights([]);
    const res = await searchFlights({
      originCode: from.code,
      destinationCode: to.code,
      date: toISODate(date),
      adults: 1,
      currency: 'PHP',
      limit: 10,
    });
    setLoading(false);

    if (res.error === 'no-key') {
      setError('flightapi.io key is missing — add your EXPO_PUBLIC_FLIGHTAPI_KEY in .env.local.');
      return;
    }
    if (res.error === 'rate-limited') {
      setError('flightapi.io rate limit reached — wait a minute and try again.');
      return;
    }
    if (res.error === 'forbidden') {
      setError('flightapi.io rejected this key — check EXPO_PUBLIC_FLIGHTAPI_KEY in your dashboard.');
      return;
    }
    if (res.error || res.flights.length === 0) {
      setError('No flights found for that route and date. Try another date or a different route.');
      return;
    }
    setFlights(res.flights);
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
        Compare one-way flight prices between any two airports or cities.
      </Text>

      <View style={{ gap: sp.md }}>
        <AirportAutocompleteInput
          label="From"
          placeholder="e.g. Manila"
          accentColor={accentColor}
          value={from ? from.title : ''}
          onSelect={setFrom}
        />

        <View style={{ alignItems: 'center', marginVertical: -2 }}>
          <TouchableOpacity
            onPress={handleSwap}
            activeOpacity={0.8}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1.5,
              borderColor: accentColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowUpDown size={18} color={accentColor} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <AirportAutocompleteInput
          label="To"
          placeholder="e.g. Cebu"
          accentColor={accentColor}
          value={to ? to.title : ''}
          onSelect={setTo}
        />

        {/* Date picker */}
        <View>
          <Text style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, marginBottom: 6 }}>
            Depart date
          </Text>
          {Platform.OS === 'android' ? (
            showAndroidPicker ? (
              <DateTimePicker value={date} mode="date" minimumDate={new Date()} onChange={onAndroidDateChange} />
            ) : (
              <TouchableOpacity
                onPress={() => setShowAndroidPicker(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: colors.card,
                  borderWidth: 1.5,
                  borderColor: colors.cardBorder,
                  borderRadius: 16,
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                }}
              >
                <CalendarDays size={16} color={accentColor} strokeWidth={2.2} />
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <View style={{ backgroundColor: colors.card, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <DateTimePicker
                value={date}
                mode="date"
                minimumDate={new Date()}
                display="spinner"
                onChange={(_e, d) => { if (d) setDate(d); }}
                style={{ width: 320, height: 140 }}
              />
            </View>
          )}
        </View>
      </View>

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
          {loading ? 'Searching…' : 'Search flights'}
        </Text>
      </TouchableOpacity>

      {error ? (
        <View style={{ marginTop: sp.lg, backgroundColor: colors.lightRedBg, borderRadius: 16, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.redAccent, textAlign: 'center' }}>{error}</Text>
        </View>
      ) : null}

      {flights.length > 0 && (
        <View style={{ marginTop: sp.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sp.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
                {flights.length} {flights.length === 1 ? 'flight' : 'flights'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }} numberOfLines={1}>
                {from?.title} → {to?.title}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.lightBlueBg, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Sparkles size={10} color={colors.tealAccent} />
              <Text style={{ fontSize: 9, fontWeight: '800', color: colors.tealAccent, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                flightapi.io
              </Text>
            </View>
          </View>

          <View style={{ gap: sp.md }}>
            {flights.map((f) => (
              <View
                key={f.id}
                style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {f.airlineLogo ? (
                      <Image source={{ uri: f.airlineLogo }} style={{ width: 30, height: 30, borderRadius: 8 }} resizeMode="contain" />
                    ) : (
                      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: `${accentColor}22`, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: accentColor }}>
                          {(f.airline[0] || '?').toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.ink }} numberOfLines={1}>
                        {f.airline}
                      </Text>
                      {f.flightNumber ? (
                        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.inkSoft, marginTop: 1 }}>
                          {f.flightNumber}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <Text style={{ fontSize: 17, fontWeight: '900', color: accentColor, letterSpacing: -0.4 }}>
                    {f.priceFormatted}
                  </Text>
                </View>

                <View style={{ height: 1, backgroundColor: colors.rule, marginVertical: 14 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 21, fontWeight: '900', color: colors.ink, letterSpacing: -0.8 }}>
                      {formatTime(f.departure)}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.inkSoft, marginTop: 2, letterSpacing: 1 }}>
                      {f.originCode}
                    </Text>
                  </View>

                  <View style={{ flex: 1.2, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} color={colors.inkSoft} />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>
                        {formatDuration(f.durationMinutes)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, width: '100%' }}>
                      <View style={{ flex: 1, height: 1.5, backgroundColor: colors.cardBorder }} />
                      <ArrowRight size={14} color={accentColor} strokeWidth={2.4} />
                      <View style={{ flex: 1, height: 1.5, backgroundColor: colors.cardBorder }} />
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.inkSoft, marginTop: 4, letterSpacing: 0.3 }}>
                      {f.stopCount === 0 ? 'NON-STOP' : `${f.stopCount} ${f.stopCount === 1 ? 'STOP' : 'STOPS'}`}
                    </Text>
                  </View>

                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 21, fontWeight: '900', color: colors.ink, letterSpacing: -0.8 }}>
                      {formatTime(f.arrival)}
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: colors.inkSoft, marginTop: 2, letterSpacing: 1 }}>
                      {f.destinationCode}
                    </Text>
                  </View>
                </View>

                {f.deeplink ? (
                  <TouchableOpacity
                    onPress={() => f.deeplink && Linking.openURL(f.deeplink).catch(() => setError('Couldn\u2019t open the booking link.'))}
                    activeOpacity={0.85}
                    style={{
                      marginTop: 16,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: accentColor,
                      borderRadius: 14,
                      paddingVertical: 12,
                    }}
                  >
                    <ExternalLink size={14} color={isDark ? colors.paper : '#FFFFFF'} strokeWidth={2.4} />
                    <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? colors.paper : '#FFFFFF', letterSpacing: -0.2 }}>
                      Open booking
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </View>

          <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.inkSoft, textAlign: 'center', marginTop: sp.md, lineHeight: 15 }}>
            Live prices via flightapi.io — fares change often, confirm before booking.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};