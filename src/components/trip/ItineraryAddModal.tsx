import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Animated,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X, MapPin, Search, Clock, FileText, Wallet, Check, Sparkles } from 'lucide-react-native';
import { SlideUpModal } from '../common/SlideUpModal';
import { ShimmerImage } from '../common/ShimmerImage';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { ItineraryItem, ItineraryTag } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { uploadTripPlacePhoto } from '../../services/storageService';
import { PlacePhotoPicker } from './PlacePhotoPicker';
import {
  searchPlaces,
  searchPlacesWithAi,
  getPlaceDetails,
  getPlacePhotoUrl,
  PlacePrediction,
  PlaceSelection,
  PlacePhoto,
  PlaceSearchError,
} from '../../services/googlePlaces';

const TAGS: { key: ItineraryTag; label: string; icon: 'transport' | 'activity' | 'food' | 'meetup' }[] = [
  { key: 'TRANSPORT', label: 'Transport', icon: 'transport' },
  { key: 'ACTIVITY', label: 'Activity', icon: 'activity' },
  { key: 'FOOD', label: 'Food', icon: 'food' },
  { key: 'MEETUP', label: 'Meet Up', icon: 'meetup' },
];



export interface ItineraryPlacePrefill {
  placeId?: string;
  name: string;
  address?: string;
  photoReference?: string;
  suggestedDay?: number;
  suggestedTime?: string;
}

export const parseTimeStr = (t?: string): Date | null => {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d;
};

interface ItineraryAddModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  tripId: string;
  dayNumber: number;
  userId: string;
  initialItem?: ItineraryItem | null;
  initialPlace?: ItineraryPlacePrefill | null;
  dayCount?: number;
  tripStartDate?: Date | null;
  onClose: () => void;
  onSaved: (savedDay: number) => void;
}

export const ItineraryAddModal: React.FC<ItineraryAddModalProps> = ({
  visible,
  mode,
  tripId,
  dayNumber,
  userId,
  initialItem,
  initialPlace,
  dayCount,
  tripStartDate,
  onClose,
  onSaved,
}) => {
  const { colors, isDark } = useTheme();
  const { fs, sp } = useResponsive();

  const [entryType, setEntryType] = useState<'place' | 'text'>('place');
  const [placeInput, setPlaceInput] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchError, setSearchError] = useState<PlaceSearchError>(null);

  const handleAiLookup = async () => {
    if (!placeInput.trim()) return;
    setAiSearching(true);
    setSearchFailed(false);
    const res = await searchPlacesWithAi(placeInput.trim());
    setPredictions(res.predictions);
    setAiSearching(false);
    setSearchFailed(res.predictions.length === 0);
  };

  const [title, setTitle] = useState('');
  const [timeDate, setTimeDate] = useState<Date | null>(null);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  const [tag, setTag] = useState<ItineraryTag>('ACTIVITY');
  const [note, setNote] = useState('');
  const [estCost, setEstCost] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState(dayNumber);
  const [timeError, setTimeError] = useState('');
  const [customPhoto, setCustomPhoto] = useState<string>('');

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Slide-bounce animation for the Place vs Free-text segmented toggle
  const toggleAnim = useRef(new Animated.Value(entryType === 'text' ? 1 : 0)).current;
  const [toggleLayout, setToggleLayout] = useState<{ x: number; width: number }[]>([{ x: 0, width: 0 }, { x: 0, width: 0 }]);

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: entryType === 'text' ? 1 : 0,
      useNativeDriver: false,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [entryType, toggleAnim]);

  // Slide-bounce animation for the WHICH DAY? selector
  const dayAnim = useRef(new Animated.Value(selectedDay - 1)).current;
  const [dayBarWidth, setDayBarWidth] = useState(0);

  useEffect(() => {
    Animated.spring(dayAnim, {
      toValue: Math.max(0, selectedDay - 1),
      useNativeDriver: false,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [selectedDay, dayAnim]);

  const dayOffsets = Array.from({ length: dayCount || 1 }, (_, i) => i);
  const dayPillStep = dayCount && dayCount > 1 && dayBarWidth > 0
    ? (dayBarWidth - 4 * 2 - 6 * (dayCount - 1)) / dayCount
    : 0;
  const dayPillWidth = dayPillStep > 0 ? dayPillStep : 0;

  const getDayDate = (day: number): Date => {
    if (tripStartDate) {
      const d = new Date(tripStartDate);
      d.setDate(d.getDate() + (day - 1));
      return d;
    }
    const d = new Date();
    d.setDate(d.getDate() + (day - 1));
    return d;
  };

  useEffect(() => {
    if (visible) {
      setSelectedDay(dayNumber);
      setTimeError('');
      if (mode === 'edit' && initialItem) {
        setTitle(initialItem.title || '');
        setTimeDate(parseTimeStr(initialItem.time));
        setTag(initialItem.tag || 'ACTIVITY');
        setNote(initialItem.note || '');
        setEstCost(initialItem.estCost || '');
        setEntryType(initialItem.placeId ? 'place' : 'text');
        setPlaceInput(initialItem.placeName || initialItem.title || '');
        setCustomPhoto(initialItem.photoReference || '');
        setSelectedPlace(
          initialItem.placeId
            ? {
              placeId: initialItem.placeId,
              name: initialItem.placeName || initialItem.title,
              address: initialItem.placeAddress || '',
              photoReference: initialItem.photoReference,
            }
            : null
        );
        // Lazily fetch the place's photos so the cover picker works in edit mode too
        if (initialItem.placeId) {
          getPlaceDetails(initialItem.placeId).then((details) => {
            if (details?.photos?.length) {
              setSelectedPlace((prev) => (prev ? { ...prev, photos: details.photos } : prev));
            }
          });
        }
      } else {
        setTitle(initialPlace?.name || '');
        if (initialPlace?.suggestedTime) {
          setTimeDate(parseTimeStr(initialPlace.suggestedTime));
        } else {
          setTimeDate(null);
        }
        if (initialPlace?.suggestedDay) {
          setSelectedDay(initialPlace.suggestedDay);
        } else {
          setSelectedDay(dayNumber);
        }
        setTag('ACTIVITY');
        setNote('');
        setEstCost('');
        setEntryType('place');
        setPlaceInput(initialPlace?.name || '');
        setCustomPhoto(initialPlace?.photoReference || '');
        setSelectedPlace(
          initialPlace?.placeId
            ? {
              placeId: initialPlace.placeId,
              name: initialPlace.name,
              address: initialPlace.address || '',
              photoReference: initialPlace.photoReference,
            }
            : null
        );
        // Lazily fetch the place's photos so the cover picker works on prefill too
        if (initialPlace?.placeId) {
          getPlaceDetails(initialPlace.placeId).then((details) => {
            if (details?.photos?.length) {
              setSelectedPlace((prev) => (prev ? { ...prev, photos: details.photos } : prev));
            }
          });
        }
      }
      setPredictions([]);
      setSearchFailed(false);
      setSearchError(null);
    }
  }, [visible, mode, initialItem, initialPlace, dayNumber]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // "8:00 AM" -> minutes since midnight, for conflict checking.
  const timeToMinutes = (t?: string): number | null => {
    const d = parseTimeStr(t);
    return d ? d.getHours() * 60 + d.getMinutes() : null;
  };

  // Reject a save when another item on the same day has the exact same time or
  // lands within 5 minutes of the requested one.
  const findTimeConflict = async (
    day: number,
    date: Date,
    excludeId?: string
  ): Promise<string | null> => {
    const items = await TripService.getInstance().fetchTripItineraryDB(tripId, day);
    const newMin = date.getHours() * 60 + date.getMinutes();
    for (const it of items) {
      if (excludeId && it.id === excludeId) continue;
      const existingMin = timeToMinutes(it.time);
      if (existingMin === null) continue;
      const gap = Math.abs(existingMin - newMin);
      if (gap === 0) {
        return `There's already a spot on Day ${day} at ${fmtTime(date)}. Pick a different time.`;
      }
      if (gap < 5) {
        return `"${it.title}" is scheduled for ${it.time} — spots on the same day need at least 5 minutes between them.`;
      }
    }
    return null;
  };

  const handlePlaceChange = (t: string) => {
    setPlaceInput(t);
    if (t.trim() !== (selectedPlace?.name || '')) setSelectedPlace(null);
    setSearchFailed(false);
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (t.trim().length < 2) {
      setPredictions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchPlaces(t.trim());
      setPredictions(res.predictions);
      setSearching(false);
      setSearchFailed(res.predictions.length === 0);
      setSearchError(res.error);
    }, 350);
  };

  const handleSelectPlace = async (pred: PlacePrediction) => {
    setPredictions([]);
    const details = await getPlaceDetails(pred.placeId);
    const sel: PlaceSelection = details
      ? {
        placeId: details.placeId,
        name: details.name || pred.mainText,
        address: details.address || pred.secondaryText,
        photoReference: details.photoReference,
        photos: details.photos,
      }
      : { placeId: pred.placeId, name: pred.mainText, address: pred.secondaryText };
    setSelectedPlace(sel);
    if (sel.photoReference) {
      setCustomPhoto(sel.photoReference);
    }
    setPlaceInput(sel.name);
    setTitle(sel.name);
  };

  const onAndroidTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowAndroidPicker(false);
    if (event.type === 'set' && date) {
      setTimeDate(date);
      setTimeError('');
    }
  };

  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setTimeError('');

    if (timeDate) {
      const conflict = await findTimeConflict(
        selectedDay,
        timeDate,
        mode === 'edit' && initialItem ? initialItem.id : undefined
      );
      if (conflict) {
        setTimeError(conflict);
        setSaving(false);
        return;
      }
    }

    let finalPhoto = customPhoto;
    if (customPhoto && !customPhoto.startsWith('http://') && !customPhoto.startsWith('https://') && !customPhoto.startsWith('AUac')) {
      finalPhoto = await uploadTripPlacePhoto(customPhoto, tripId, userId);
    }

    const payload = {
      title: title.trim(),
      time: timeDate ? fmtTime(timeDate) : '',
      tag,
      location: selectedPlace?.address || undefined,
      estCost: estCost.trim(),
      note: note.trim(),
      placeId: selectedPlace?.placeId,
      placeName: selectedPlace?.name,
      placeAddress: selectedPlace?.address,
      photoReference: finalPhoto || undefined,
    };

    let ok = false;
    if (mode === 'edit' && initialItem) {
      ok = await TripService.getInstance().updateItineraryItemDB(initialItem.id, payload, userId);
    } else {
      ok = !!(await TripService.getInstance().addItineraryItemDB({
        ...payload,
        tripId,
        dayNumber: selectedDay,
        userId,
      }));
    }

    setSaving(false);
    if (ok) {
      onSaved(selectedDay);
      onClose();
    }
  };

  const accent = colors.tealDark;
  const muted = colors.inkSoft;
  const border = colors.cardBorder;

  return (
    <SlideUpModal visible={visible} onClose={onClose} backdropOpacity={0.45}>
      <View
        style={{
          backgroundColor: colors.paper,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: Dimensions.get('window').height * 0.84,
          padding: 20,
          paddingBottom: sp.lg + 24,
          borderTopWidth: 1,
          borderColor: border,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <View>
            <Text style={{ fontSize: 19, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 }}>
              {mode === 'edit' ? 'Edit Itinerary Spot' : 'Add to Itinerary'}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: muted, marginTop: 2 }}>
              Day {selectedDay} · {entryType === 'text' ? 'add a note, free time, or rest' : selectedPlace?.name || 'pick a spot for your barkada'}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }} hitSlop={10}>
            <X size={22} color={colors.ink} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          nestedScrollEnabled
          style={{ marginTop: 6 }}
        >
          {/* Day selector — shown when the modal is opened with a day count (AI accept flow) */}
          {!!dayCount && dayCount > 1 && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, letterSpacing: 0.5 }}>
                WHICH DAY?
              </Text>
              <View
                onLayout={(e) => setDayBarWidth(e.nativeEvent.layout.width)}
                style={{
                  flexDirection: 'row',
                  gap: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                  borderRadius: 100,
                  borderWidth: 1,
                  borderColor: border,
                  padding: 4,
                  marginBottom: 4,
                  position: 'relative',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 6,
                  elevation: 1,
                }}
              >
                {dayPillWidth > 0 && (
                  <Animated.View
                    style={{
                      position: 'absolute',
                      top: 4,
                      bottom: 4,
                      left: 4,
                      width: dayPillWidth,
                      backgroundColor: accent,
                      borderRadius: 100,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.12,
                      shadowRadius: 4,
                      elevation: 2,
                      transform: [{
                        translateX: dayAnim.interpolate({
                          inputRange: dayOffsets,
                          outputRange: dayOffsets.map((o) => (dayPillStep + 6) * o),
                        }),
                      }],
                    }}
                  />
                )}
                {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => {
                  const active = selectedDay === d;
                  const dateObj = getDayDate(d);
                  const monthStr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dateObj.getMonth()];
                  return (
                    <TouchableOpacity
                      key={d}
                      onPress={() => {
                        setSelectedDay(d);
                        setTimeError('');
                      }}
                      activeOpacity={0.85}
                      style={{
                        flex: 1,
                        paddingVertical: 9,
                        borderRadius: 100,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 8, fontWeight: '800', color: active ? 'rgba(255,255,255,0.85)' : muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Day {d}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: active ? '#FFFFFF' : colors.ink, letterSpacing: 0.5 }}>
                        {monthStr} {dateObj.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Place vs free-text toggle — slide-bounce pill like the day switcher */}
          <View
            style={{
              flexDirection: 'row',
              gap: 6,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              borderRadius: 100,
              borderWidth: 1,
              borderColor: border,
              padding: 4,
              marginBottom: 14,
              position: 'relative',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            {toggleLayout[0].width > 0 && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 4,
                  bottom: 4,
                  left: toggleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [toggleLayout[0].x, toggleLayout[1].x],
                  }),
                  width: toggleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [toggleLayout[0].width, toggleLayout[1].width],
                  }),
                  backgroundColor: accent,
                  borderRadius: 100,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              />
            )}
            {([
              { key: 'place', label: 'A Place / Spot' },
              { key: 'text', label: 'Free Time / Note' },
            ] as const).map((opt, idx) => {
              const active = entryType === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  onLayout={(e) => {
                    const { x, width } = e.nativeEvent.layout;
                    setToggleLayout((prev) => {
                      if (prev[idx] && prev[idx].x === x && prev[idx].width === width) return prev;
                      const next = [...prev] as { x: number; width: number }[];
                      next[idx] = { x, width };
                      return next;
                    });
                  }}
                  onPress={() => {
                    setEntryType(opt.key);
                    if (opt.key === 'text') {
                      setSelectedPlace(null);
                      setPlaceInput('');
                      setPredictions([]);
                    }
                  }}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    paddingVertical: 9,
                    borderRadius: 100,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'transparent',
                  }}
                >
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: active ? '#FFFFFF' : colors.ink }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Place search — only when adding an actual place/spot */}
          {entryType === 'place' && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, letterSpacing: 0.5 }}>
                WHERE SHOULD WE GO?
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: border,
                  paddingHorizontal: 12,
                }}
              >
                <Search size={16} color={accent} strokeWidth={2} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 12, color: colors.ink, fontSize: 13 }}
                  placeholder="Search a place, e.g. Shibuya, Big Lagoon, Eiffel Tower..."
                  placeholderTextColor={muted}
                  value={placeInput}
                  onChangeText={handlePlaceChange}
                  autoCorrect={false}
                  autoCapitalize="words"
                />
                {searching ? (
                  <ActivityIndicator size="small" color={accent} />
                ) : !!placeInput ? (
                  <TouchableOpacity onPress={() => handlePlaceChange('')} hitSlop={8}>
                    <X size={14} color={muted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {placeInput.trim().length >= 2 && (
                <TouchableOpacity
                  onPress={handleAiLookup}
                  disabled={aiSearching}
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
                  {aiSearching ? (
                    <>
                      <ActivityIndicator size="small" color={accent} style={{ transform: [{ scale: 0.75 }] }} />
                      <Text style={{ fontSize: 11, fontWeight: '500', color: muted }}>
                        Searching exact location...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Search size={11} color={muted} strokeWidth={2} />
                      <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '500', color: muted, flexShrink: 1 }}>
                        Search exact spot: <Text style={{ fontWeight: '600', color: colors.ink }}>"{placeInput.trim()}"</Text>
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {searchFailed && predictions.length === 0 && placeInput.trim().length >= 2 && !aiSearching && (
                <Text style={{ fontSize: 10.5, color: muted, marginTop: 5, fontWeight: '500', textAlign: 'center' }}>
                  No direct matches. Tap above to search exact spot.
                </Text>
              )}

              {predictions.length > 0 && (
                <View
                  style={{
                    marginTop: 8,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: border,
                    overflow: 'hidden',
                    backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  }}
                >
                  <ScrollView
                    style={{ maxHeight: 170 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {predictions.map((p, i) => (
                      <TouchableOpacity
                        key={p.placeId}
                        onPress={() => handleSelectPlace(p)}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderBottomWidth: i < predictions.length - 1 ? 1 : 0,
                          borderBottomColor: border,
                        }}
                      >
                        <MapPin size={15} color={accent} strokeWidth={2.2} />
                        <View style={{ flex: 1 }}>
                          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                            {p.mainText}
                          </Text>
                          {!!p.secondaryText && (
                            <Text numberOfLines={1} style={{ fontSize: 10, color: muted, marginTop: 1 }}>
                              {p.secondaryText}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {selectedPlace && predictions.length === 0 && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                    backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : '#EAFBF4',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(16,185,129,0.35)' : 'rgba(16,185,129,0.45)',
                    borderRadius: 12,
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                >
                  <Check size={13} color="#10B981" strokeWidth={3} />
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.ink }} numberOfLines={2}>
                    {selectedPlace.name}
                    {selectedPlace.address ? ` — ${selectedPlace.address}` : ''}
                  </Text>
                </View>
              )}

            </>
          )}

          {/* Cover Photo Picker (Google Places candidates, Upload Image, or Image Link) */}
          <PlacePhotoPicker
            googlePhotos={entryType === 'place' ? selectedPlace?.photos : undefined}
            selectedPhoto={customPhoto}
            onSelectPhoto={(refOrUrl) => {
              setCustomPhoto(refOrUrl);
              setSelectedPlace((prev) => (prev ? { ...prev, photoReference: refOrUrl } : prev));
            }}
            onClearPhoto={() => {
              setCustomPhoto('');
              setSelectedPlace((prev) => (prev ? { ...prev, photoReference: undefined } : prev));
            }}
            accent={accent}
            border={border}
            ink={colors.ink}
            muted={muted}
            paper={colors.paper}
            isDark={isDark}
            fs={fs}
          />

          {/* Tag selector */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
            WHAT KIND OF STOP?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TAGS.map((t) => {
              const selected = tag === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  onPress={() => setTag(t.key)}
                  activeOpacity={0.8}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 100,
                    backgroundColor: selected ? accent : isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                    borderWidth: 1,
                    borderColor: selected ? accent : border,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: selected ? '#FFFFFF' : colors.ink,
                    }}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Title */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
            {entryType === 'text' ? 'WHAT IS IT?' : 'TITLE / ACTIVITY NAME'}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 12,
            }}
          >
            {entryType === 'text' ? (
              <FileText size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
            ) : (
              <MapPin size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
            )}
            <TextInput
              style={{ flex: 1, paddingVertical: 12, color: colors.ink, fontSize: 13 }}
              placeholder={entryType === 'text' ? 'e.g. Free time, Rest, Picnic by the beach' : 'e.g. Big Lagoon Kayaking'}
              placeholderTextColor={muted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Time */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
            TIME (OPTIONAL)
          </Text>
          {Platform.OS === 'android' ? (
            <>
              <TouchableOpacity
                onPress={() => setShowAndroidPicker(true)}
                activeOpacity={0.8}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: timeDate ? accent : border,
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                }}
              >
                <Clock size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
                <Text style={{ flex: 1, color: timeDate ? colors.ink : muted, fontSize: 13, fontWeight: timeDate ? '700' : '500' }}>
                  {timeDate ? fmtTime(timeDate) : 'Pick a time'}
                </Text>
              </TouchableOpacity>
              {showAndroidPicker && (
                <DateTimePicker
                  value={timeDate || new Date()}
                  mode="time"
                  is24Hour={false}
                  onChange={onAndroidTimeChange}
                />
              )}
            </>
          ) : (
            <View
              style={{
                borderWidth: 1,
                borderColor: timeDate ? accent : border,
                borderRadius: 14,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              }}
            >
              <DateTimePicker
                value={timeDate || new Date()}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={(_event, date) => { if (date) { setTimeDate(date); setTimeError(''); } }}
                style={{ height: 120, alignSelf: 'stretch' }}
              />
            </View>
          )}

          <Text style={{ fontSize: 9.5, fontWeight: '600', color: muted, marginTop: 6 }}>
            Spots on the same day need at least 5 minutes between them.
          </Text>
          {!!timeError && (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 6,
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FCE8E6',
                borderRadius: 10,
                paddingHorizontal: 10,
                paddingVertical: 8,
              }}
            >
              <Text style={{ flex: 1, fontSize: 10.5, fontWeight: '700', color: '#EF4444', lineHeight: 15 }}>
                {timeError}
              </Text>
            </View>
          )}

          {/* Note + est cost */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
            NOTES & BUDGET (OPTIONAL)
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 12,
            }}
          >
            <FileText size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, paddingVertical: 12, color: colors.ink, fontSize: 13 }}
              placeholder="Bring dry bag & sunscreen"
              placeholderTextColor={muted}
              value={note}
              onChangeText={setNote}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
              borderRadius: 14,
              borderWidth: 1,
              borderColor: border,
              paddingHorizontal: 12,
              marginTop: 10,
            }}
          >
            <Wallet size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, paddingVertical: 12, color: colors.ink, fontSize: 13 }}
              placeholder="Estimated cost, e.g. ₱820"
              placeholderTextColor={muted}
              value={estCost}
              onChangeText={setEstCost}
            />
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                flex: 1,
                paddingVertical: 13,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: border,
              }}
            >
              <Text style={{ color: muted, fontSize: 13, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={{
                flex: 2,
                paddingVertical: 13,
                borderRadius: 100,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accent,
                opacity: canSave ? 1 : 0.5,
              }}
            >
              {saving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={{ color: '#FFF', fontSize: 13, fontWeight: '800' }}>
                  {mode === 'edit' ? 'Save Changes' : 'Add to Itinerary'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
