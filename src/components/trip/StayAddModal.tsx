import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import { X, MapPin, Search, FileText, Link, Check, BedDouble, ImageIcon } from 'lucide-react-native';
import { SlideUpModal } from '../common/SlideUpModal';
import { ShimmerImage } from '../common/ShimmerImage';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { TripStay } from '../../types/trip';
import { TripService } from '../../services/tripService';
import {
  searchPlaces,
  getPlaceDetails,
  getPlacePhotoUrl,
  PlacePrediction,
  PlaceSelection,
  PlacePhoto,
  PlaceSearchError,
} from '../../services/googlePlaces';

// Cover Photo Picker (Google Places candidates) — same as the itinerary sheet
interface PhotoPickerRowProps {
  photos: PlacePhoto[];
  selectedRef?: string;
  onSelect: (ref: string) => void;
  accent: string;
  border: string;
  isDark: boolean;
}

const PhotoPickerRow: React.FC<PhotoPickerRowProps> = ({
  photos,
  selectedRef,
  onSelect,
  accent,
  border,
  isDark,
}) => {
  if (!photos || photos.length === 0) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: isDark ? '#9CA3AF' : '#64748B', marginBottom: 6, letterSpacing: 0.5 }}>
        COVER PHOTO
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 8 }}
      >
        {photos.map((ph) => {
          const selected = ph.reference === selectedRef;
          return (
            <TouchableOpacity
              key={ph.reference}
              onPress={() => onSelect(ph.reference)}
              activeOpacity={0.8}
            >
              <ShimmerImage
                source={{ uri: getPlacePhotoUrl(ph.reference, 400) }}
                style={{ width: 64, height: 64, borderRadius: 12 }}
                containerStyle={{
                  borderRadius: 12,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? accent : border,
                }}
              />
              {selected && (
                <View
                  style={{
                    position: 'absolute',
                    top: 3,
                    right: 3,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    backgroundColor: accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Check size={11} color="#FFFFFF" strokeWidth={3.5} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// Day slider row (animated sliding pill with spring bounce) — matches the
// day selector on the plan page. Used for both check-in and check-out nights.
interface DaySliderRowProps {
  label: string;
  dayCount: number;
  selectedDay: number;
  onSelect: (day: number) => void;
  accent: string;
  muted: string;
  border: string;
  ink: string;
  isDark: boolean;
  tripStartDate?: Date | null;
}

const DaySliderRow: React.FC<DaySliderRowProps> = ({
  label,
  dayCount,
  selectedDay,
  onSelect,
  accent,
  muted,
  border,
  ink,
  isDark,
  tripStartDate,
}) => {
  const anim = useRef(new Animated.Value(selectedDay - 1)).current;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: Math.max(0, selectedDay - 1),
      useNativeDriver: false,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [selectedDay, anim]);

  const dayOffsets = Array.from({ length: dayCount }, (_, i) => i);
  const pillStep = dayCount > 1 && barWidth > 0
    ? (barWidth - 4 * 2 - 6 * (dayCount - 1)) / dayCount
    : 0;
  const pillWidth = pillStep > 0 ? pillStep : 0;

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

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
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
        {pillWidth > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: pillWidth,
              backgroundColor: accent,
              borderRadius: 100,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.12,
              shadowRadius: 4,
              elevation: 2,
              transform: [{
                translateX: anim.interpolate({
                  inputRange: dayOffsets,
                  outputRange: dayOffsets.map((o) => (pillStep + 6) * o),
                }),
              }],
            }}
          />
        )}
        {dayOffsets.map((d) => {
          const dayNum = d + 1;
          const active = selectedDay === dayNum;
          const dateObj = getDayDate(dayNum);
          const monthStr = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][dateObj.getMonth()];
          return (
            <TouchableOpacity
              key={dayNum}
              onPress={() => onSelect(dayNum)}
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
                Day {dayNum}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '900', color: active ? '#FFFFFF' : ink, letterSpacing: 0.5 }}>
                {monthStr} {dateObj.getDate()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

interface StayAddModalProps {
  visible: boolean;
  mode: 'add' | 'edit';
  tripId: string;
  userId: string;
  dayCount?: number;
  tripStartDate?: Date | null;
  initialDay?: number;
  initialStay?: TripStay | null;
  onClose: () => void;
  onSaved: () => void;
}

export const StayAddModal: React.FC<StayAddModalProps> = ({
  visible,
  mode,
  tripId,
  userId,
  dayCount,
  tripStartDate,
  initialDay,
  initialStay,
  onClose,
  onSaved,
}) => {
  const { colors, isDark } = useTheme();
  const { sp } = useResponsive();

  const days = Math.max(1, dayCount || 1);

  const [entryType, setEntryType] = useState<'place' | 'manual'>('place');
  const [placeInput, setPlaceInput] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchError, setSearchError] = useState<PlaceSearchError>(null);

  const [title, setTitle] = useState('');
  const [startDay, setStartDay] = useState(Math.min(initialDay || 1, days));
  const [endDay, setEndDay] = useState(Math.min(initialDay || 1, days));
  const [link, setLink] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Slide-bounce animation for the Google vs manual segmented toggle
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const [toggleLayout, setToggleLayout] = useState<{ x: number; width: number }[]>([
    { x: 0, width: 0 },
    { x: 0, width: 0 },
  ]);

  useEffect(() => {
    Animated.spring(toggleAnim, {
      toValue: entryType === 'manual' ? 1 : 0,
      useNativeDriver: false,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [entryType, toggleAnim]);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      setPredictions([]);
      setSearchFailed(false);
      setSearchError(null);

      if (mode === 'edit' && initialStay) {
        setTitle(initialStay.title || '');
        setStartDay(Math.min(Math.max(initialStay.startDay, 1), days));
        setEndDay(Math.min(Math.max(initialStay.endDay, initialStay.startDay), days));
        setLink(initialStay.link || '');
        setNote(initialStay.note || '');
        setEntryType(initialStay.placeId ? 'place' : 'manual');
        setPlaceInput(initialStay.placeName || initialStay.title || '');
        setSelectedPlace(
          initialStay.placeId
            ? {
                placeId: initialStay.placeId,
                name: initialStay.placeName || initialStay.title,
                address: initialStay.placeAddress || '',
                photoReference: initialStay.photoReference,
              }
            : null
        );
        if (initialStay.placeId) {
          getPlaceDetails(initialStay.placeId).then((details) => {
            if (details?.photos?.length) {
              setSelectedPlace((prev) => (prev ? { ...prev, photos: details.photos } : prev));
            }
          });
        }
      } else {
        const from = Math.min(initialDay || 1, days);
        setTitle('');
        setStartDay(from);
        setEndDay(from);
        setLink('');
        setNote('');
        setEntryType('place');
        setPlaceInput('');
        setSelectedPlace(null);
      }
    }
  }, [visible, mode, initialStay, initialDay, days]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
    const photoRef = details?.photoReference || details?.photos?.[0]?.reference;
    const sel: PlaceSelection = details
      ? {
          placeId: details.placeId,
          name: details.name || pred.mainText,
          address: details.address || pred.secondaryText,
          photoReference: photoRef,
          photos: details.photos,
        }
      : { placeId: pred.placeId, name: pred.mainText, address: pred.secondaryText };
    setSelectedPlace(sel);
    setPlaceInput(sel.name);
    if (!title) setTitle(sel.name);
  };

  const canSave = title.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    const start = Math.max(1, startDay);
    const end = Math.max(start, endDay);

    const payload = {
      title: title.trim(),
      startDay: start,
      endDay: end,
      placeId: selectedPlace?.placeId,
      placeName: selectedPlace?.name,
      placeAddress: selectedPlace?.address,
      photoReference: selectedPlace?.photoReference,
      link: link.trim(),
      note: note.trim(),
    };

    let ok = false;
    if (mode === 'edit' && initialStay) {
      ok = await TripService.getInstance().updateTripStayDB(initialStay.id, payload);
    } else {
      ok = !!(await TripService.getInstance().addTripStayDB({
        ...payload,
        tripId,
        userId,
      }));
    }

    setSaving(false);
    if (ok) {
      onSaved();
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: isDark ? 'rgba(59,122,158,0.18)' : '#EBF5FB', alignItems: 'center', justifyContent: 'center' }}>
              <BedDouble size={18} color={accent} strokeWidth={2.2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 19, fontWeight: '900', color: colors.ink, letterSpacing: -0.4 }}>
                {mode === 'edit' ? 'Edit Stay' : 'Where You\'ll Stay'}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: muted, marginTop: 2 }}>
                Only you (the host) can set stays for the barkada
              </Text>
            </View>
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
          {/* Place vs manual toggle — animated sliding pill with spring bounce */}
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
              { key: 'place', label: 'Find on Google Maps' },
              { key: 'manual', label: 'Add Manually' },
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
                    if (opt.key === 'manual') {
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

          {/* Google Maps search — only when entry type is 'place' */}
          {entryType === 'place' && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, letterSpacing: 0.5 }}>
                SEARCH THE PLACE
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
                  placeholder="Search a hotel, resort, airbnb…"
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

              {searchFailed && predictions.length === 0 && placeInput.trim().length >= 2 && (
                <Text style={{ fontSize: 10, color: muted, marginTop: 6, fontWeight: '600' }}>
                  {searchError === 'no-key'
                    ? 'Set your Google Places API key (EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) to search places.'
                    : searchError === 'api-error'
                    ? 'Places search failed. Check your key / API.'
                    : 'No places found — try a different search.'}
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
                    style={{ maxHeight: 160 }}
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

              {selectedPlace?.photos && selectedPlace.photos.length > 0 && (
                <PhotoPickerRow
                  photos={selectedPlace.photos}
                  selectedRef={selectedPlace.photoReference}
                  onSelect={(ref) => setSelectedPlace((prev) => (prev ? { ...prev, photoReference: ref } : prev))}
                  accent={accent}
                  border={border}
                  isDark={isDark}
                />
              )}
            </>
          )}

          {/* Name — only when adding manually; Google mode uses the picked place */}
          {entryType === 'manual' && (
            <>
              <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
                PLACE NAME *
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
                <BedDouble size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, paddingVertical: 12, color: colors.ink, fontSize: 13 }}
                  placeholder="e.g. Spin Designer Hostel, Airbnb in Boracay"
                  placeholderTextColor={muted}
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              {/* Photo placeholder note for manual entries */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                  backgroundColor: isDark ? 'rgba(240,169,62,0.12)' : '#FEF6E7',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(240,169,62,0.35)' : 'rgba(240,169,62,0.45)',
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                }}
              >
                <ImageIcon size={13} color={colors.orangeAccent} strokeWidth={2.2} />
                <Text style={{ flex: 1, fontSize: 10.5, fontWeight: '700', color: colors.ink, lineHeight: 15 }}>
                  Photo upload coming soon. Pick the place on Google Maps above to auto-fill a cover photo.
                </Text>
              </View>
            </>
          )}

          {/* Nights to stay */}
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: muted, letterSpacing: 0.5 }}>
                NIGHTS TO STAY
              </Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: muted }}>
                (Night {startDay}{endDay > startDay ? ` – ${endDay}` : ''} of {days})
              </Text>
            </View>
            <DaySliderRow
              label="CHECK-IN NIGHT"
              dayCount={days}
              selectedDay={startDay}
              onSelect={(d) => {
                setStartDay(d);
                setEndDay((prev) => Math.max(prev, d));
              }}
              accent={colors.emerald}
              muted={muted}
              border={border}
              ink={colors.ink}
              isDark={isDark}
              tripStartDate={tripStartDate}
            />
            <DaySliderRow
              label="CHECK-OUT AFTER NIGHT"
              dayCount={days}
              selectedDay={endDay}
              onSelect={(d) => {
                setEndDay(d);
                setStartDay((prev) => Math.min(prev, d));
              }}
              accent={colors.orangeAccent}
              muted={muted}
              border={border}
              ink={colors.ink}
              isDark={isDark}
              tripStartDate={tripStartDate}
            />
          </View>

          {/* Link */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
            BOOKING LINK (OPTIONAL)
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
            <Link size={15} color={muted} strokeWidth={2} style={{ marginRight: 8 }} />
            <TextInput
              style={{ flex: 1, paddingVertical: 12, color: colors.ink, fontSize: 13 }}
              placeholder="e.g. airbnb.com/h/something"
              placeholderTextColor={muted}
              value={link}
              onChangeText={setLink}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
          </View>

          {/* Note */}
          <Text style={{ fontSize: 10, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 16, letterSpacing: 0.5 }}>
            NOTE TO THE BARKADA (OPTIONAL)
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
              placeholder="e.g. Free breakfast, bring your own towels"
              placeholderTextColor={muted}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={300}
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
                  {mode === 'edit' ? 'Save Changes' : 'Add Stay'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </SlideUpModal>
  );
};
