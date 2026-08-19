import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { searchPlaces, PlacePrediction } from '../../services/googlePlaces';

interface PlaceAutocompleteInputProps {
  label: string;
  placeholder: string;
  accentColor: string;
  value?: string;
  onSelect: (place: PlacePrediction) => void;
}

/** Google Places typeahead input with an inline suggestion dropdown. */
export const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  label,
  placeholder,
  accentColor,
  value = '',
  onSelect,
}) => {
  const { colors } = useTheme();
  const [text, setText] = useState(value);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
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
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchPlaces(t);
      setPredictions(res.predictions);
      setLoading(false);
    }, 350);
  };

  const handleSelect = (place: PlacePrediction) => {
    const display = [place.mainText, place.secondaryText].filter(Boolean).join(', ');
    setText(display);
    setPredictions([]);
    Keyboard.dismiss();
    onSelect(place);
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
        <MapPin size={16} color={accentColor} strokeWidth={2.2} />
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
          {predictions.slice(0, 5).map((p) => {
            const display = [p.mainText, p.secondaryText].filter(Boolean).join(', ');
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