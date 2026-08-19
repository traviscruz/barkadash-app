import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { Plane } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { searchAirports, FlightAirport, FlightSearchError } from '../../services/flightapiService';

interface AirportAutocompleteInputProps {
  label: string;
  placeholder: string;
  accentColor: string;
  value?: string;
  onSelect: (airport: FlightAirport) => void;
}

/** Skyscanner airport/city typeahead input with an inline suggestion dropdown. */
export const AirportAutocompleteInput: React.FC<AirportAutocompleteInputProps> = ({
  label,
  placeholder,
  accentColor,
  value = '',
  onSelect,
}) => {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  const [predictions, setPredictions] = useState<FlightAirport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<FlightSearchError>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChange = (t: string) => {
    setText(t);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (t.trim().length < 2) {
      setPredictions([]);
      setError(null);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchAirports(t);
      setPredictions(res.airports);
      setError(res.error);
      setLoading(false);
    }, 350);
  };

  const handleSelect = (a: FlightAirport) => {
    setText(a.title);
    setPredictions([]);
    Keyboard.dismiss();
    onSelect(a);
  };

  return (
    <View>
      <Text style={{ fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, color: colors.inkSoft, marginBottom: 6 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderWidth: 1.5,
          borderColor: colors.cardBorder,
          borderRadius: 16,
          paddingHorizontal: 14,
        }}
      >
        <Plane size={16} color={accentColor} strokeWidth={2.2} />
        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSoft}
          style={{ flex: 1, paddingVertical: 13, paddingHorizontal: 10, fontSize: 14, fontWeight: '700', color: colors.ink }}
        />
        {loading && <ActivityIndicator size="small" color={accentColor} />}
      </View>

      {predictions.length > 0 && (
        <View
          style={{
            marginTop: 6,
            backgroundColor: colors.card,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            overflow: 'hidden',
          }}
        >
          {predictions.map((p) => (
            <TouchableOpacity
              key={p.code}
              onPress={() => handleSelect(p)}
              activeOpacity={0.7}
              style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}
            >
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>{p.title}</Text>
              {p.subtitle ? (
                <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }} numberOfLines={1}>
                  {p.subtitle}
                </Text>
              ) : null}
              <View style={{ alignSelf: 'flex-start', marginTop: 5, backgroundColor: `${accentColor}1a`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9.5, fontWeight: '900', color: accentColor, letterSpacing: 0.5 }}>{p.code}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {error && !loading && text.trim().length >= 2 && predictions.length === 0 ? (
        <View style={{ marginTop: 6, backgroundColor: colors.lightRedBg, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.redAccent, lineHeight: 16 }}>
            {error === 'no-key'
              ? 'Add your flightapi.io key — set EXPO_PUBLIC_FLIGHTAPI_KEY in .env.local.'
              : error === 'rate-limited'
                ? 'flightapi.io rate limit reached — try again in a minute.'
                : error === 'forbidden'
                  ? 'flightapi.io rejected this key — check EXPO_PUBLIC_FLIGHTAPI_KEY in your dashboard.'
                  : 'Couldn\u2019t reach flightapi.io — check your connection and try again.'}
          </Text>
        </View>
      ) : null}
    </View>
  );
};