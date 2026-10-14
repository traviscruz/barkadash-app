import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, StyleSheet } from 'react-native';
import { MapPin, Search } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { searchPlaces, searchPlacesWithAi, PlacePrediction } from '../../services/googlePlaces';

interface PlaceAutocompleteInputProps {
  label: string;
  placeholder: string;
  accentColor: string;
  value?: string;
  onSelect: (place: PlacePrediction) => void;
}

/** TravelTime + smart venue typeahead input with an inline suggestion dropdown. */
export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  label,
  placeholder,
  accentColor,
  value = '',
  onSelect,
}) => {
  const { colors, isDark } = useTheme();
  const [text, setText] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setText(value);
  }, [value]);

  const handleAiLookup = async () => {
    if (!text.trim() || text.trim().length < 2) return;
    setAiLoading(true);
    Keyboard.dismiss();
    const res = await searchPlacesWithAi(text.trim());
    setAiLoading(false);
    if (res.predictions.length > 0) {
      setPredictions(res.predictions);
      setIsOpen(true);
    }
  };

  const handleChange = (t: string) => {
    setText(t);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (t.trim().length < 2) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(async () => {
      const res = await searchPlaces(t);
      setPredictions(res.predictions);
      setLoading(false);
      setIsOpen(true);
    }, 280);
  };

  const handleSelect = (place: PlacePrediction) => {
    setText(place.mainText);
    setPredictions([]);
    setIsOpen(false);
    Keyboard.dismiss();
    onSelect(place);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.card,
          borderWidth: 1.5,
          borderColor: isOpen ? accentColor : colors.cardBorder,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <MapPin size={16} color={accentColor} style={{ marginRight: 8 }} />
        <TextInput
          value={text}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSoft}
          style={{ flex: 1, fontSize: 14, color: colors.ink, padding: 0 }}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {loading && <ActivityIndicator size="small" color={accentColor} style={{ marginLeft: 6 }} />}
      </View>

      {text.trim().length >= 2 && (
        <TouchableOpacity
          onPress={handleAiLookup}
          disabled={aiLoading}
          activeOpacity={0.6}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 6,
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
          }}
        >
          {aiLoading ? (
            <>
              <ActivityIndicator size="small" color={accentColor} style={{ transform: [{ scale: 0.75 }] }} />
              <Text style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft }}>
                Searching exact location...
              </Text>
            </>
          ) : (
            <>
              <Search size={11} color={colors.inkSoft} strokeWidth={2} />
              <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '500', color: colors.inkSoft, flexShrink: 1 }}>
                Search exact spot: <Text style={{ fontWeight: '600', color: colors.ink }}>"{text.trim()}"</Text>
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {predictions.length > 0 && isOpen && (
        <View
          style={{
            marginTop: 6,
            backgroundColor: colors.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            overflow: 'hidden',
          }}
        >
          {predictions.slice(0, 5).map((p) => {
            return (
              <TouchableOpacity
                key={p.placeId}
                onPress={() => handleSelect(p)}
                activeOpacity={0.7}
                style={{ paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.rule }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.ink }}>{p.mainText}</Text>
                {p.secondaryText ? (
                  <Text style={{ fontSize: 11.5, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }}>{p.secondaryText}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};