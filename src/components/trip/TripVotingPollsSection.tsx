import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useTheme } from '../../context/ThemeContext';
import { useUser } from '../../context/UserContext';
import { useResponsive } from '../../utils/responsive';
import { TripService } from '../../services/tripService';
import { supabase } from '../../utils/supabase';
import { DestinationPollOption } from '../../types/trip';
import { getPlacePhotoUrl, searchPlaces, getPlaceDetails, PlaceSelection, PlacePrediction, PlacePhoto, PlaceSearchError } from '../../services/googlePlaces';
import { ShimmerImage } from '../common/ShimmerImage';
import {
  MapPin,
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  ThumbsUp,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  User,
  Check,
  FileText,
  Clock,
  Lock,
  CalendarClock,
  Search,
} from 'lucide-react-native';

// ──────────────────────────────────────────────
// Inline Calendar Component
// ──────────────────────────────────────────────
interface InlineCalendarProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
  accent: string;
  ink: string;
  muted: string;
  paper: string;
  border: string;
  isDark: boolean;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY_LABELS = ['S','M','T','W','T','F','S'];

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const isBetween = (d: Date, s: Date, e: Date) => d > s && d < e;
const withAlpha = (hex: string, alpha: number) =>
  /^#[0-9A-Fa-f]{6}$/.test(hex) ? `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : hex;
const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const monthOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const InlineCalendar: React.FC<InlineCalendarProps> = ({
  startDate, endDate, onRangeChange, accent, ink, muted, paper, border, isDark,
}) => {
  const { colors } = useTheme();
  const [viewing, setViewing] = useState(() => monthOf(startDate || new Date()));
  const [pickYear, setPickYear] = useState(false);
  const [pickMonth, setPickMonth] = useState(false);

  const selectMonth = (m: number) => {
    setViewing(monthOf(new Date(viewing.getFullYear(), m, 1)));
    setPickMonth(false);
  };
  const selectYear = (y: number) => {
    setViewing(monthOf(new Date(y, viewing.getMonth(), 1)));
    setPickYear(false);
  };

  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const prevMonth = () => setViewing(v => monthOf(new Date(v.getFullYear(), v.getMonth() - 1, 1)));
  const nextMonth = () => setViewing(v => monthOf(new Date(v.getFullYear(), v.getMonth() + 1, 1)));

  const daysInMonth = new Date(viewing.getFullYear(), viewing.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = startOfMonth(viewing).getDay();

  const handleDayPress = (day: number) => {
    const pressed = new Date(viewing.getFullYear(), viewing.getMonth(), day);
    if (!startDate || (startDate && endDate)) {
      onRangeChange(pressed, null);
    } else {
      if (pressed < startDate) {
        onRangeChange(pressed, startDate);
      } else {
        onRangeChange(startDate, pressed);
      }
    }
  };

  const cellSize = Math.max(38, Math.round((Math.min(Dimensions.get('window').width, 420) - 40 - 28) / 7));
  const circleSize = cellSize - 6;
  const rangeFill = withAlpha(accent, isDark ? 0.28 : 0.16);
  const todayRing = withAlpha(accent, 0.6);
  const navBtnColor = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9';

  const years: number[] = [];
  for (let y = today.getFullYear() - 1; y <= today.getFullYear() + 9; y++) years.push(y);

  const isPastDay = (d: Date) => d < today;

  const cells: React.ReactElement[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push(<View key={`e${i}`} style={{ width: cellSize, height: cellSize }} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewing.getFullYear(), viewing.getMonth(), d);
    const isPast = isPastDay(date);
    const isStart = !!startDate && isSameDay(date, startDate);
    const isEnd = !!endDate && isSameDay(date, endDate);
    const selected = isStart || isEnd;
    const inRange = !!startDate && !!endDate && isBetween(date, startDate, endDate);
    const isToday = isSameDay(date, today);

    let textColor = ink;
    if (isPast) {
      textColor = withAlpha(muted, isDark ? 0.28 : 0.35);
    }
    if (selected) textColor = '#FFFFFF';
    if (inRange) textColor = isDark ? colors.tealDark : accent;

    cells.push(
      <TouchableOpacity
        key={d}
        disabled={isPast}
        onPress={() => handleDayPress(d)}
        activeOpacity={0.7}
        style={{
          width: cellSize,
          height: cellSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View
          style={[
            {
              width: circleSize,
              height: circleSize,
              borderRadius: circleSize / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected
                ? accent
                : inRange
                ? rangeFill
                : 'transparent',
              borderWidth: inRange ? 1.5 : 0,
              borderColor: inRange ? withAlpha(accent, isDark ? 0.5 : 0.35) : 'transparent',
            },
            isToday && !selected && !inRange && { borderWidth: 1.5, borderColor: todayRing },
          ]}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: selected || inRange || isToday ? '900' : '600',
              color: textColor,
            }}
          >
            {d}
          </Text>
          {isToday && (
            <Text
              style={{
                fontSize: 5.5,
                fontWeight: '900',
                color: textColor,
                letterSpacing: 0.4,
                marginTop: 1,
              }}
            >
              TODAY
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF' }}>
      {/* Month nav */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16 }}>
        <TouchableOpacity onPress={prevMonth} activeOpacity={0.7} hitSlop={8}
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: navBtnColor }}>
          <ChevronLeft size={17} color={muted} strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setPickYear(false); setPickMonth(v => !v); }} activeOpacity={0.6} hitSlop={6}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: ink, letterSpacing: -0.4 }}>{MONTHS[viewing.getMonth()]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setPickMonth(false); setPickYear(v => !v); }} activeOpacity={0.6} hitSlop={6}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: muted, letterSpacing: 1.2, marginTop: 1, textDecorationLine: 'underline' }}>{viewing.getFullYear()}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={nextMonth} activeOpacity={0.7} hitSlop={8}
          style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: navBtnColor }}>
          <ChevronRight size={17} color={muted} strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      {/* Quick nav + selection status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 }}>
        <TouchableOpacity onPress={() => setViewing(monthOf(today))} activeOpacity={0.7} hitSlop={6}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: muted }}>Today</Text>
        </TouchableOpacity>
        {startDate ? (
          <TouchableOpacity onPress={() => setViewing(monthOf(startDate))} activeOpacity={0.7} hitSlop={6}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: accent }}>
              {endDate ? `${fmtDay(startDate)} – ${fmtDay(endDate)}` : fmtDay(startDate)}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ fontSize: 11, fontWeight: '800', color: withAlpha(muted, 0.8) }}>Tap two dates</Text>
        )}
      </View>

      {pickMonth || pickYear ? (
        <View style={{ paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: muted, letterSpacing: 0.5 }}>
              {pickMonth ? 'SELECT MONTH' : 'SELECT YEAR'}
            </Text>
            <TouchableOpacity onPress={() => { setPickMonth(false); setPickYear(false); }} activeOpacity={0.7} hitSlop={8}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: accent }}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 }}>
            {(pickMonth
              ? MONTHS.map((m, i) => ({ label: m, value: i }))
              : years.map((y) => ({ label: String(y), value: y }))
            ).map((opt) => {
              const active = pickMonth ? opt.value === viewing.getMonth() : opt.value === viewing.getFullYear();
              return (
                <View key={opt.label} style={{ width: '25%', padding: 5 }}>
                  <TouchableOpacity
                    onPress={() => (pickMonth ? selectMonth(opt.value as number) : selectYear(opt.value as number))}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 9,
                      borderRadius: 10,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: active ? accent : (isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'),
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: active ? '900' : '700', color: active ? '#FFF' : ink }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <>
          {/* Weekday headers */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 14 }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={`${label}-${i}`} style={{ width: cellSize, alignItems: 'center' }}>
                <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.5, color: muted }}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, paddingTop: 6 }}>
            {cells}
          </View>
        </>
      )}

      {/* Selection footer */}
      {startDate && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: accent }} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: ink }} numberOfLines={1}>
              {endDate ? `${fmtDay(startDate)} – ${fmtDay(endDate)}` : `From ${fmtDay(startDate)} — tap end date`}
            </Text>
          </View>
          <TouchableOpacity onPress={() => onRangeChange(null, null)} activeOpacity={0.7} hitSlop={8}>
            <Text style={{ fontSize: 12, fontWeight: '900', color: muted }}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ──────────────────────────────────────────────
// Top-Level Reusable Helper Components
// ──────────────────────────────────────────────
interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  paper: string;
  border: string;
  ink: string;
  muted: string;
  isDark: boolean;
  fs: any;
  scale: number;
}

const SheetModal: React.FC<SheetModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  paper,
  border,
  ink,
  muted,
  isDark,
  fs,
  scale,
}) => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <KeyboardAvoidingView
      behavior="padding"
      style={S.backdrop}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Pressable
        style={[S.sheet, { backgroundColor: paper, borderColor: border, maxWidth: 420 }]}
        onPress={() => {}}
      >
        <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1', marginBottom: 12 }} />
        <View style={S.sheetHead}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink, letterSpacing: -0.3 }}>{title}</Text>
            {!!subtitle && <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }}>{subtitle}</Text>}
          </View>
          <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
            <X size={Math.round(18 * scale)} color={muted} />
          </TouchableOpacity>
        </View>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          style={{ maxHeight: Math.min(Dimensions.get('window').height * 0.55, 430) }}
        >
          {children}
        </ScrollView>
        {footer && (
          <>
            <View style={{ height: 1, backgroundColor: border, marginTop: 16 }} />
            <View style={{ paddingTop: 14 }}>{footer}</View>
          </>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  </Modal>
);

const LabelText = ({ children, muted, fs }: { children: string; muted: string; fs: any }) => (
  <Text style={{ fontSize: fs.xs, fontWeight: '800', color: muted, marginBottom: 6, marginTop: 10, letterSpacing: 0.5 }}>{children}</Text>
);

const FieldWrap = ({ icon, children, border, isDark }: { icon?: React.ReactNode; children: React.ReactNode; border: string; isDark: boolean }) => (
  <View style={[S.fieldWrap, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderColor: border }]}>
    {icon}
    {children}
  </View>
);

// ──────────────────────────────────────────────
// Google Places Autocomplete Input
// ──────────────────────────────────────────────
interface PlaceAutocompleteInputProps {
  value: string;
  onChangeText: (t: string) => void;
  onSelect: (place: PlaceSelection) => void;
  selectedAddress?: string;
  placeholder: string;
  accent: string;
  ink: string;
  muted: string;
  border: string;
  isDark: boolean;
  fs: any;
  autoFocus?: boolean;
}

const PlaceAutocompleteInput: React.FC<PlaceAutocompleteInputProps> = ({
  value,
  onChangeText,
  onSelect,
  selectedAddress,
  placeholder,
  accent,
  ink,
  muted,
  border,
  isDark,
  fs,
  autoFocus = false,
}) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [searchError, setSearchError] = useState<PlaceSearchError>(null);
  const [moreScrollable, setMoreScrollable] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleChange = (t: string) => {
    onChangeText(t);
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

  const handleSelect = async (pred: PlacePrediction) => {
    setPredictions([]);
    const details = await getPlaceDetails(pred.placeId);
    if (details) {
      onSelect({
        placeId: details.placeId,
        name: details.name || pred.mainText,
        address: details.address || pred.secondaryText,
        photoReference: details.photoReference,
        photos: details.photos,
      });
    } else {
      onSelect({ placeId: pred.placeId, name: pred.mainText, address: pred.secondaryText });
    }
  };

  return (
    <>
      <FieldWrap border={border} isDark={isDark} icon={<Search size={16} color={accent} strokeWidth={2} />}>
        <TextInput
          style={[S.input, { color: ink, fontSize: fs.sm }]}
          placeholder={placeholder}
          placeholderTextColor={muted}
          value={value}
          onChangeText={handleChange}
          autoCorrect={false}
          autoCapitalize="words"
          autoFocus={autoFocus}
        />
        {searching ? (
          <ActivityIndicator size="small" color={accent} />
        ) : !!value ? (
          <TouchableOpacity onPress={() => handleChange('')} hitSlop={8}>
            <X size={14} color={muted} />
          </TouchableOpacity>
        ) : null}
      </FieldWrap>

      {searchFailed && predictions.length === 0 && value.trim().length >= 2 && (
        <Text style={{ fontSize: fs.xs, color: muted, marginTop: 6, fontWeight: '600' }}>
          {searchError === 'no-key'
            ? 'Set your Google Places API key (EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) to search places.'
            : searchError === 'api-error'
            ? 'Places search failed. Make sure the Google Places API is enabled and your key is valid.'
            : 'No places found — try a different search.'}
        </Text>
      )}

      {predictions.length > 0 && (
        <View style={{ marginTop: 8, borderRadius: 14, borderWidth: 1, borderColor: border, overflow: 'hidden', backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }}>
          <ScrollView
            style={{ maxHeight: 190 }}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            onContentSizeChange={(_w, h) => setMoreScrollable(h > 190)}
          >
            {predictions.map((p, i) => (
              <TouchableOpacity
                key={p.placeId}
                onPress={() => handleSelect(p)}
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
                  <Text numberOfLines={1} style={{ fontSize: fs.sm, fontWeight: '700', color: ink }}>{p.mainText}</Text>
                  {!!p.secondaryText && (
                    <Text numberOfLines={1} style={{ fontSize: fs.xs, color: muted, marginTop: 1 }}>{p.secondaryText}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {moreScrollable && (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 7, borderTopWidth: 1, borderTopColor: border, backgroundColor: isDark ? '#141414' : '#F8FAFC' }}>
              <ChevronDown size={13} color={muted} strokeWidth={2.4} />
              <Text style={{ fontSize: fs.xs, fontWeight: '700', color: muted }}>
                {predictions.length} results — swipe up for more
              </Text>
            </View>
          )}
        </View>
      )}

      {selectedAddress && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC', borderWidth: 1, borderColor: border }}>
          <Check size={14} color="#2A8563" strokeWidth={2.6} />
          <Text style={{ flex: 1, fontSize: fs.xs, color: muted, fontWeight: '600' }} numberOfLines={2}>{selectedAddress}</Text>
        </View>
      )}
    </>
  );
};

// ──────────────────────────────────────────────
// Cover Photo Picker (Google Places candidates)
// ──────────────────────────────────────────────
interface PhotoPickerRowProps {
  photos: PlacePhoto[];
  selectedRef?: string;
  onSelect: (ref: string) => void;
  accent: string;
  border: string;
  isDark: boolean;
  fs: any;
}

const PhotoPickerRow: React.FC<PhotoPickerRowProps> = ({
  photos,
  selectedRef,
  onSelect,
  accent,
  border,
  isDark,
  fs,
}) => {
  if (!photos || photos.length === 0) return null;
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={{ fontSize: fs.xs, fontWeight: '800', color: isDark ? '#9CA3AF' : '#64748B', marginBottom: 6, letterSpacing: 0.3 }}>
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
                  <Check size={11} color="#FFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

// ──────────────────────────────────────────────
// Voting Deadline Picker (Host only)
// ──────────────────────────────────────────────
interface DeadlineModalProps {
  visible: boolean;
  initial: Date | null;
  onClose: () => void;
  onSave: (date: Date | null) => void;
  paper: string;
  border: string;
  ink: string;
  muted: string;
  accent: string;
  isDark: boolean;
  fs: any;
}

const fmtDeadline = (d: Date | string) =>
  new Date(d).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const DeadlineModal: React.FC<DeadlineModalProps> = ({
  visible,
  initial,
  onClose,
  onSave,
  paper,
  border,
  ink,
  muted,
  accent,
  isDark,
  fs,
}) => {
  const [draft, setDraft] = useState<Date | null>(initial);
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setDraft(initial);
      setShowAndroidPicker(Platform.OS === 'android');
    }
  }, [visible, initial]);

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowAndroidPicker(false);
    if (event.type === 'set' && date) {
      setDraft(date);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.backdrop} onPress={onClose}>
        <Pressable style={[S.sheet, { backgroundColor: paper, borderColor: border, maxWidth: 400 }]} onPress={() => {}}>
          <View style={S.sheetHead}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink }}>Voting Deadline</Text>
              <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }}>
                {draft ? `Closing ${fmtDeadline(draft)}` : 'No deadline set'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
              <X size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {Platform.OS === 'android' ? (
            showAndroidPicker ? (
              <DateTimePicker
                value={draft || new Date()}
                mode="datetime"
                minimumDate={new Date()}
                onChange={onAndroidChange}
              />
            ) : (
              <TouchableOpacity
                onPress={() => setShowAndroidPicker(true)}
                activeOpacity={0.8}
                style={{
                  borderWidth: 1,
                  borderColor: border,
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                }}
              >
                <Text style={{ fontSize: fs.sm, fontWeight: '800', color: accent }}>
                  {draft ? `Edit: ${fmtDeadline(draft)}` : 'Pick date & time'}
                </Text>
              </TouchableOpacity>
            )
          ) : (
            <DateTimePicker
              value={draft || new Date()}
              mode="datetime"
              display="spinner"
              minimumDate={new Date()}
              onChange={(_event, date) => { if (date) setDraft(date); }}
              style={{ height: 190, alignSelf: 'stretch' }}
            />
          )}

          {/* Validation note */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(240,169,62,0.12)' : '#FEF6E7', borderWidth: 1, borderColor: withAlpha('#F0A93E', 0.35) }}>
            <Clock size={16} color={accent} strokeWidth={2} />
            <Text style={{ flex: 1, fontSize: fs.xs, color: muted, lineHeight: 16 }}>
              Set the deadline before your proposed trip dates so voting wraps up in time. Members can no longer vote after this time.
            </Text>
          </View>

          <View style={[S.actions, { marginTop: 18 }]}>
            <TouchableOpacity
              onPress={() => { setDraft(null); onSave(null); }}
              style={[pillStyle(muted), { backgroundColor: 'transparent', borderWidth: 1, borderColor: border }]}
            >
              <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { if (draft) onSave(draft); }}
              disabled={!draft}
              style={[pillStyle(accent), !draft && { opacity: 0.5 }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.sm }}>Save Deadline</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const pillStyle = (bg: string): any => ({
  paddingHorizontal: 16,
  paddingVertical: 9,
  borderRadius: 100,
  backgroundColor: bg,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
});

// ──────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────
interface TripVotingPollsSectionProps {
  tripId: string;
  onPollsUpdated?: () => void;
}

type PollTab = 'place' | 'date';

const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const fmtRange = (s: Date, e: Date) => `${fmtDate(s)} – ${fmtDate(e)}`;

export const TripVotingPollsSection: React.FC<TripVotingPollsSectionProps> = ({ tripId, onPollsUpdated }) => {
  const { colors, isDark } = useTheme();
  const { profile } = useUser();
  const { fs, scale } = useResponsive();

  const userId = profile?.id || 'guest_user';
  const userName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || profile?.username || 'You';

  const [activeTab, setActiveTab] = useState<PollTab>('place');
  const [segWidth, setSegWidth] = useState(0);
  const tabAnim = useRef(new Animated.Value(0)).current;
  const [polls, setPolls] = useState<DestinationPollOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [tripSettings, setTripSettings] = useState<{ hostId: string | null; votingDeadline: string | null }>({ hostId: null, votingDeadline: null });

  // Add place
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [placeInput, setPlaceInput] = useState('');
  const [placeNote, setPlaceNote] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(null);

  // Add date
  const [showAddDate, setShowAddDate] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);

  // Edit
  const [editPoll, setEditPoll] = useState<DestinationPollOption | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPlace, setEditPlace] = useState<PlaceSelection | null>(null);
  const [editStart, setEditStart] = useState<Date | null>(null);
  const [editEnd, setEditEnd] = useState<Date | null>(null);

  // Delete
  const [delPoll, setDelPoll] = useState<DestinationPollOption | null>(null);
  const [deletingPoll, setDeletingPoll] = useState(false);

  // Deadline
  const [deadlineVisible, setDeadlineVisible] = useState(false);

  const accent = colors.tealDark;
  const paper = colors.paper;
  const border = colors.cardBorder;
  const ink = colors.ink;
  const muted = colors.inkSoft;
  const surface = isDark ? 'rgba(255,255,255,0.04)' : colors.card;

  const votingDeadline = tripSettings?.votingDeadline || null;
  const deadlinePassed = votingDeadline ? new Date(votingDeadline).getTime() < Date.now() : false;

  const refresh = useCallback(async () => {
    const p = await TripService.getInstance().fetchTripPollsDB(tripId);
    setPolls(p);
    onPollsUpdated?.();
  }, [tripId, onPollsUpdated]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [pollsRes, settings, members] = await Promise.all([
        TripService.getInstance().fetchTripPollsDB(tripId),
        TripService.getInstance().fetchTripSettingsDB(tripId),
        TripService.getInstance().fetchTripParticipantsDB(tripId),
      ]);
      if (cancelled) return;
      const memberIds = members.map((m) => m.id);
      setIsMember(memberIds.includes(userId));
      setIsHost(!!settings.hostId && settings.hostId === userId);
      setTripSettings(settings);
      setPolls(pollsRes);
      setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [tripId, userId]);

  // Realtime: live-update polls as options & votes change (no reload needed)
  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`poll-realtime:${tripId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trip_poll_options',
          filter: `trip_id=eq.${tripId}`,
        },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_poll_votes' },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tripId, refresh]);

  const submitPlace = async () => {
    if (!placeInput.trim()) return;
    await TripService.getInstance().addTripPollOptionDB({
      tripId,
      title: placeInput.trim(),
      type: 'place',
      subtitle: placeNote.trim() || undefined,
      placeId: selectedPlace?.placeId,
      placeName: selectedPlace?.name,
      placeAddress: selectedPlace?.address,
      photoReference: selectedPlace?.photoReference,
      userId,
    });
    setShowAddPlace(false); setPlaceInput(''); setPlaceNote(''); setSelectedPlace(null);
    refresh();
  };

  const handlePlaceInputChange = (t: string) => {
    setPlaceInput(t);
    setSelectedPlace(null);
  };

  const handleEditTitleChange = (t: string) => {
    setEditTitle(t);
    setEditPlace(null);
  };

  const submitDate = async (s: Date, e: Date) => {
    await TripService.getInstance().addTripPollOptionDB({ tripId, title: fmtRange(s, e), type: 'date', userId });
    setShowAddDate(false); setRangeStart(null); setRangeEnd(null);
    refresh();
  };

  const openEdit = (p: DestinationPollOption) => {
    setEditPoll(p); setEditTitle(p.title); setEditNote(p.subtitle || '');
    setEditPlace(p.placeId ? {
      placeId: p.placeId,
      name: p.placeName || p.title,
      address: p.placeAddress || '',
      photoReference: p.photoReference,
    } : null);
    setEditStart(null); setEditEnd(null);
  };

  const saveEdit = async () => {
    if (!editPoll) return;
    const title = editPoll.type === 'date' && editStart && editEnd ? fmtRange(editStart, editEnd) : editTitle.trim();
    await TripService.getInstance().updateTripPollOptionDB({
      pollId: editPoll.id,
      tripId,
      newTitle: title,
      newSubtitle: editNote,
      placeId: editPoll.type === 'place' ? editPlace?.placeId : undefined,
      placeName: editPoll.type === 'place' ? editPlace?.name : undefined,
      placeAddress: editPoll.type === 'place' ? editPlace?.address : undefined,
      photoReference: editPoll.type === 'place' ? editPlace?.photoReference : undefined,
    });
    setEditPoll(null); refresh();
  };

  const onVote = async (poll: DestinationPollOption) => {
    // Optimistic update — reflect the vote instantly (place & date sections independent)
    setPolls(prev => prev.map(p => {
      if (p.type !== poll.type) return p;
      if (p.id === poll.id) {
        const hasVote = p.votedUserIds.includes(userId);
        return {
          ...p,
          votes: Math.max(0, p.votes + (hasVote ? -1 : 1)),
          votedUserIds: hasVote
            ? p.votedUserIds.filter(id => id !== userId)
            : [...p.votedUserIds, userId],
        };
      }
      // Same section, different option — move my vote away from the old pick
      if (p.votedUserIds.includes(userId)) {
        return {
          ...p,
          votes: Math.max(0, p.votes - 1),
          votedUserIds: p.votedUserIds.filter(id => id !== userId),
        };
      }
      return p;
    }));

    // Persist in the background, then reconcile with server truth
    const result = await TripService.getInstance().toggleVoteTripPollDB(poll.id, tripId, userId);
    if (result.length > 0) setPolls(result);
    onPollsUpdated?.();
  };

  const confirmDelete = async () => {
    if (!delPoll) return;
    setDeletingPoll(true);
    await TripService.getInstance().deleteTripPollOptionDB(delPoll.id, tripId);
    setDeletingPoll(false);
    setDelPoll(null); refresh();
  };

  const saveDeadline = async (date: Date | null) => {
    const iso = date ? date.toISOString() : null;
    await TripService.getInstance().setTripVotingDeadlineDB(tripId, iso);
    setTripSettings((s) => ({ ...s, votingDeadline: iso }));
    setDeadlineVisible(false);
    refresh();
  };

  const filtered = polls.filter(p => p.type === activeTab);
  const maxVotes = Math.max(...filtered.map(p => p.votes), 0);

  const placeCount = polls.filter(p => p.type === 'place').length;
  const dateCount = polls.filter(p => p.type === 'date').length;

  const switchTab = (tab: PollTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    Animated.spring(tabAnim, {
      toValue: tab === 'place' ? 0 : 1,
      useNativeDriver: true,
      bounciness: 8,
      speed: 16,
    }).start();
  };

  const pill = (bg: string, bd?: string) => ({
    paddingHorizontal: Math.round(16 * scale), paddingVertical: Math.round(9 * scale),
    borderRadius: 100, backgroundColor: bg, borderWidth: bd ? 1 : 0, borderColor: bd || 'transparent',
  });

  // Non-member (or logged out) gate — RLS blocks data, this explains why
  if (loading) {
    return (
      <View style={[S.outer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFD', borderColor: border, alignItems: 'center', padding: 28 }]}>
        <ActivityIndicator color={accent} />
        <Text style={{ fontSize: fs.xs, color: muted, marginTop: 10, fontWeight: '600' }}>Loading voting polls...</Text>
      </View>
    );
  }

  if (!isMember && userId !== 'guest_user') {
    return (
      <View style={[S.outer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFD', borderColor: border, padding: 18 }]}>
        <View style={[S.empty, { borderColor: border, backgroundColor: 'transparent' }]}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <Lock size={22} color={muted} strokeWidth={2} />
          </View>
          <Text style={{ fontSize: fs.base, fontWeight: '800', color: ink, textAlign: 'center' }}>Trip voting is for members only</Text>
          <Text style={{ fontSize: fs.xs, color: muted, textAlign: 'center', marginTop: 4, fontWeight: '500', maxWidth: 260 }}>
            Join this trip with the invite code to view and participate in voting polls.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[S.outer, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFD', borderColor: border }]}>
      {/* Header */}
      <View style={[S.header, { borderBottomColor: border }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink, letterSpacing: -0.4 }}>Barkada Voting Polls</Text>
          <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }}>Propose options & vote on your next trip details</Text>
        </View>
        <View style={{ backgroundColor: isDark ? 'rgba(31,78,103,0.3)' : colors.lightBlueBg, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 }}>
          <Text style={{ fontSize: Math.round(11 * scale), fontWeight: '900', color: accent }}>{filtered.length} {filtered.length === 1 ? 'option' : 'options'}</Text>
        </View>
      </View>

      {/* Voting Deadline Card — visible to all members, only the host can set/change it */}
      <View style={{ marginHorizontal: 14, marginTop: 12 }}>
        {isHost ? (
          <TouchableOpacity
            onPress={() => setDeadlineVisible(true)}
            activeOpacity={0.85}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isDark ? 'rgba(240,169,62,0.1)' : '#FEF6E7',
              borderWidth: 1,
              borderColor: withAlpha(colors.orangeAccent, 0.4),
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(240,169,62,0.2)' : colors.lightOrangeBg }}>
                <CalendarClock size={18} color={colors.orangeAccent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: ink, letterSpacing: 0.3 }}>VOTING DEADLINE</Text>
                <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2, fontWeight: '600' }}>
                  {votingDeadline
                    ? deadlinePassed
                      ? `Closed on ${fmtDeadline(votingDeadline)}`
                      : `Closes ${fmtDeadline(votingDeadline)}`
                    : 'No deadline set — tap to add one'}
                </Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: colors.orangeAccent }}>
              <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '900' }}>
                {votingDeadline ? 'Change' : 'Set'}
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : colors.lightBlueBg,
              borderWidth: 1,
              borderColor: withAlpha(accent, 0.25),
              borderRadius: 14,
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(56,189,248,0.15)' }}>
                <Clock size={18} color={accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: ink, letterSpacing: 0.3 }}>VOTING DEADLINE</Text>
                <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2, fontWeight: '600' }}>
                  {votingDeadline
                    ? deadlinePassed
                      ? `Voting closed on ${fmtDeadline(votingDeadline)}`
                      : `Voting closes ${fmtDeadline(votingDeadline)}`
                    : 'No deadline set yet'}
                </Text>
              </View>
            </View>
            {votingDeadline && deadlinePassed && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEE2E2' }}>
                <Text style={{ color: isDark ? '#FCA5A5' : '#B91C1C', fontSize: 10, fontWeight: '900' }}>CLOSED</Text>
              </View>
            )}
          </View>
        )}
        {!isHost && (
          <Text style={{ fontSize: 10, color: muted, marginTop: 6, paddingHorizontal: 2 }}>
            Only the trip host can change the voting deadline.
          </Text>
        )}
      </View>

      {/* Tab + Add */}
      <View style={{ marginHorizontal: 14, marginTop: 16, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {/* Segmented control with sliding active pill (like itinerary day selector) */}
        <View
          onLayout={(e) => setSegWidth(e.nativeEvent.layout.width)}
          style={{
            flex: 1,
            flexDirection: 'row',
            position: 'relative',
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EEF2F7',
            borderRadius: 100,
            padding: 4,
          }}
        >
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 4,
              bottom: 4,
              left: 4,
              width: segWidth > 0 ? (segWidth - 8) / 2 : 0,
              backgroundColor: paper,
              borderRadius: 100,
              elevation: 2,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowOffset: { width: 0, height: 1 },
              shadowRadius: 3,
              transform: [
                {
                  translateX: tabAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, segWidth > 0 ? (segWidth - 8) / 2 : 0],
                  }),
                },
              ],
            }}
          />
          {(['place', 'date'] as PollTab[]).map(tab => {
            const active = activeTab === tab;
            const count = tab === 'place' ? placeCount : dateCount;
            return (
              <TouchableOpacity
                key={tab}
                onPress={() => switchTab(tab)}
                activeOpacity={0.8}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 100 }}
              >
                {tab === 'place'
                  ? <MapPin size={Math.round(13 * scale)} color={active ? accent : muted} strokeWidth={2.2} />
                  : <CalendarDays size={Math.round(13 * scale)} color={active ? accent : muted} strokeWidth={2.2} />}
                <Text style={{ fontSize: Math.round(12.5 * scale), fontWeight: '900', color: active ? accent : muted }}>
                  {tab === 'place' ? 'Places' : 'Dates'}
                </Text>
                <View style={{
                  backgroundColor: active ? (isDark ? 'rgba(56,189,248,0.2)' : colors.lightBlueBg) : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  borderRadius: 10,
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: active ? accent : muted }}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Add option — round plus (ledger style) */}
        <TouchableOpacity
          onPress={() => activeTab === 'place' ? setShowAddPlace(true) : setShowAddDate(true)}
          disabled={deadlinePassed}
          activeOpacity={0.8}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: accent,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 4,
            opacity: deadlinePassed ? 0.45 : 1,
          }}
        >
          <Plus size={22} color="#FFF" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Cards */}
      <View style={{ paddingHorizontal: 14, paddingBottom: 16, gap: 12 }}>
        {filtered.length === 0 ? (
          <View style={[S.empty, { borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }]}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
              {activeTab === 'place'
                ? <MapPin size={Math.round(22 * scale)} color={accent} strokeWidth={2} />
                : <CalendarDays size={Math.round(22 * scale)} color={colors.orangeAccent} strokeWidth={2} />}
            </View>
            <Text style={{ fontSize: fs.base, fontWeight: '800', color: ink, textAlign: 'center' }}>
              {activeTab === 'place' ? 'No places proposed yet' : 'No date ranges proposed yet'}
            </Text>
            <Text style={{ fontSize: fs.xs, color: muted, textAlign: 'center', marginTop: 4, fontWeight: '500', maxWidth: 260 }}>
              {activeTab === 'place'
                ? 'Suggest a place for your barkada to vote on!'
                : 'Propose dates that work best for your schedule!'}
            </Text>
            {!deadlinePassed && (
              <TouchableOpacity
                onPress={() => activeTab === 'place' ? setShowAddPlace(true) : setShowAddDate(true)}
                style={[pill(accent), { marginTop: 14 }]}
              >
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.xs }}>
                  {activeTab === 'place' ? '+ Propose First Place' : '+ Propose Dates'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : filtered.map(poll => {
          const voted = poll.votedUserIds.includes(userId);
          const isOwn = poll.createdByUserId === userId;
          const isLeading = poll.votes > 0 && poll.votes === maxVotes;
          const isPlace = activeTab === 'place';
          const iconColor = isPlace ? accent : colors.orangeAccent;
          const blockBg = isPlace
            ? (isDark ? '#123548' : '#CBE4F1')
            : (isDark ? '#3A2E1A' : '#FBEDD3');
          const photoUri = isPlace && poll.photoReference ? getPlacePhotoUrl(poll.photoReference, 800) : '';

          return (
            <View
              key={poll.id}
              style={[
                S.card,
                {
                  backgroundColor: surface,
                  borderColor: voted ? accent : border,
                  borderWidth: voted ? 1.5 : 1,
                },
              ]}
            >
              {/* Photo block — real Google photo when available, else icon placeholder */}
              <View style={[S.photoBlock, { backgroundColor: photoUri ? (isDark ? '#10283A' : '#1B3A4D') : blockBg }]}>
                {!!photoUri && (
                  <ShimmerImage
                    containerStyle={{ ...StyleSheet.absoluteFillObject, borderRadius: 12 }}
                    source={{ uri: photoUri }}
                    resizeMode="cover"
                  />
                )}
                {isOwn && (
                  <View style={S.photoActions}>
                    <TouchableOpacity onPress={() => openEdit(poll)} activeOpacity={0.8}
                      style={[S.ghostBtn, { backgroundColor: isDark ? 'rgba(10,30,40,0.7)' : 'rgba(255,255,255,0.9)' }]}>
                      <Pencil size={12} color={isDark ? '#BFD7E4' : '#33516B'} strokeWidth={2.2} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDelPoll(poll)} activeOpacity={0.8}
                      style={[S.ghostBtn, { backgroundColor: isDark ? 'rgba(60,20,20,0.7)' : 'rgba(255,241,241,0.95)' }]}>
                      <Trash2 size={12} color="#EF4444" strokeWidth={2.2} />
                    </TouchableOpacity>
                  </View>
                )}
                {!photoUri && (
                  <View style={S.photoIcon}>
                    {isPlace
                      ? <MapPin size={38} color={withAlpha(iconColor, isDark ? 0.4 : 0.5)} strokeWidth={1.6} />
                      : <CalendarDays size={38} color={withAlpha(iconColor, isDark ? 0.4 : 0.5)} strokeWidth={1.6} />}
                  </View>
                )}
                <Text style={[S.photoTitle, {
                  color: isDark ? '#F2F7FA' : '#FFFFFF',
                  textShadowColor: isDark ? 'rgba(0,0,0,0.45)' : (photoUri ? 'rgba(0,0,0,0.55)' : 'rgba(20,60,80,0.3)'),
                }]} numberOfLines={2}>
                  {poll.title}
                </Text>
              </View>

              {/* Caption row — votes + vote button (mockup style) */}
              <View style={S.captionRow}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={{ fontSize: Math.round(11 * scale), fontWeight: '800', color: isLeading ? colors.orangeAccent : (voted ? accent : muted) }} numberOfLines={1}>
                    {poll.votes === 0
                      ? 'Be the first to vote'
                      : isLeading
                      ? `${poll.votes} ${poll.votes === 1 ? 'vote' : 'votes'} · leading`
                      : `${poll.votes} ${poll.votes === 1 ? 'vote' : 'votes'}`}
                  </Text>
                  <Text style={{ fontSize: Math.round(10 * scale), fontWeight: '600', color: withAlpha(muted, 0.85), marginTop: 2 }} numberOfLines={1}>
                    {isOwn ? 'Proposed by you' : `Proposed by ${poll.createdByName}`}
                    {!!poll.subtitle ? ` · ${poll.subtitle}` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onVote(poll)}
                  disabled={deadlinePassed}
                  activeOpacity={0.8}
                  style={[
                    S.voteBtn,
                    {
                      borderColor: voted ? accent : withAlpha(accent, 0.35),
                      backgroundColor: voted ? accent : (isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF'),
                    },
                    deadlinePassed && { opacity: 0.45 },
                  ]}
                >
                  {voted ? (
                    <Check size={11} color="#FFF" strokeWidth={3} />
                  ) : (
                    <ThumbsUp size={11} color={isDark ? '#9FC3D4' : '#1F4E67'} strokeWidth={2.2} />
                  )}
                  <Text style={{ fontSize: Math.round(10.5 * scale), fontWeight: '900', color: voted ? '#FFF' : (isDark ? '#BFD7E4' : '#1F4E67') }}>
                    {voted ? 'Voted' : 'Vote'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {/* Footer Info Tip */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 14, alignItems: 'center' }}>
        <Text style={{ fontSize: 11, color: muted, fontWeight: '600', textAlign: 'center' }}>
          One vote per section — pick your favorite place AND your favorite dates.
        </Text>
      </View>

      {/* Itinerary next-step note */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginHorizontal: 14,
        marginBottom: 18,
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: withAlpha(accent, isDark ? 0.4 : 0.25),
        backgroundColor: isDark ? 'rgba(56,189,248,0.1)' : 'rgba(235,245,251,0.85)',
      }}>
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <CalendarClock size={14} color="#FFF" strokeWidth={2.2} />
        </View>
        <Text style={{ flex: 1, fontSize: fs.xs, color: ink, fontWeight: '600', lineHeight: 17 }}>
          Once your barkada finalizes the destination and dates, everyone can start planning the{' '}
          <Text style={{ color: accent, fontWeight: '800' }}>itinerary</Text> next.
        </Text>
      </View>

      {/* ── Add Place Modal ── */}
      <SheetModal
        visible={showAddPlace}
        onClose={() => setShowAddPlace(false)}
        title="Propose a Destination"
        subtitle="Suggest a place for your barkada's next getaway"
        paper={paper}
        border={border}
        ink={ink}
        muted={muted}
        isDark={isDark}
        fs={fs}
        scale={scale}
        footer={
          <View style={S.actions}>
            <TouchableOpacity onPress={() => setShowAddPlace(false)} style={pill('transparent', border)}>
              <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={submitPlace}
              disabled={!placeInput.trim()}
              style={[pill(accent), !placeInput.trim() && { opacity: 0.5 }]}
            >
              <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.sm }}>Propose Destination</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <LabelText muted={muted} fs={fs}>WHERE SHOULD WE GO?</LabelText>
        <PlaceAutocompleteInput
          value={placeInput}
          onChangeText={handlePlaceInputChange}
          onSelect={(sel) => {
            setPlaceInput(sel.name);
            setSelectedPlace(sel);
          }}
          selectedAddress={selectedPlace?.address}
          placeholder="e.g. El Nido, Baguio, Boracay"
          accent={accent} ink={ink} muted={muted} border={border} isDark={isDark} fs={fs}
          autoFocus
        />
        {selectedPlace?.photos && selectedPlace.photos.length > 0 && (
          <PhotoPickerRow
            photos={selectedPlace.photos}
            selectedRef={selectedPlace.photoReference}
            onSelect={(ref) => setSelectedPlace((prev) => (prev ? { ...prev, photoReference: ref } : prev))}
            accent={accent} border={border} isDark={isDark} fs={fs}
          />
        )}

        <LabelText muted={muted} fs={fs}>WHY PROPOSE THIS? (OPTIONAL)</LabelText>
        <FieldWrap border={border} isDark={isDark} icon={<FileText size={16} color={muted} strokeWidth={1.8} />}>
          <TextInput
            style={[S.input, { color: ink, fontSize: fs.sm }]}
            placeholder="e.g. Great beaches, cheap seafood, budget accommodation"
            placeholderTextColor={muted}
            value={placeNote}
            onChangeText={setPlaceNote}
          />
          {!!placeNote && (
            <TouchableOpacity onPress={() => setPlaceNote('')} hitSlop={8}>
              <X size={14} color={muted} />
            </TouchableOpacity>
          )}
        </FieldWrap>

        {/* Proposer Info Badge */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            padding: 10,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
            borderWidth: 1,
            borderColor: border,
          }}
        >
          <View
            style={{
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={12} color="#FFF" />
          </View>
          <Text style={{ flex: 1, fontSize: fs.xs, color: muted, fontWeight: '600', lineHeight: 16 }}>
            Will be proposed as <Text style={{ color: ink, fontWeight: '800' }}>{userName}</Text> and receive your vote
          </Text>
        </View>
      </SheetModal>

      {/* ── Add Date Modal ── */}
      <Modal visible={showAddDate} transparent animationType="fade" onRequestClose={() => setShowAddDate(false)}>
        <Pressable style={S.backdrop} onPress={() => setShowAddDate(false)}>
          <Pressable style={[S.sheet, { backgroundColor: paper, borderColor: border, maxWidth: 420 }]} onPress={() => {}}>
            <View style={S.sheetHead}>
              <View>
                <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink }}>Pick Date Range</Text>
                <Text style={{ fontSize: fs.xs, color: muted, marginTop: 2 }}>
                  {rangeStart && rangeEnd ? fmtRange(rangeStart, rangeEnd)
                    : rangeStart ? `Start: ${fmtDate(rangeStart)} — now tap end date`
                    : 'Tap start date, then end date'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setShowAddDate(false); setRangeStart(null); setRangeEnd(null); }} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
                <X size={18} color={muted} />
              </TouchableOpacity>
            </View>

            <InlineCalendar
              startDate={rangeStart} endDate={rangeEnd}
              onRangeChange={(s, e) => {
                setRangeStart(s);
                setRangeEnd(e);
              }}
              accent={accent} ink={ink} muted={muted} paper={paper} border={border} isDark={isDark}
            />

            {/* Deadline-aware note */}
            {votingDeadline && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(240,169,62,0.12)' : '#FEF6E7', borderWidth: 1, borderColor: withAlpha(colors.orangeAccent, 0.35) }}>
                <Clock size={15} color={colors.orangeAccent} strokeWidth={2} />
                <Text style={{ flex: 1, fontSize: fs.xs, color: muted, lineHeight: 16 }}>
                  Voting closes on {fmtDeadline(votingDeadline)}. Make sure the dates you propose don't fall before the deadline.
                </Text>
              </View>
            )}

            {/* Confirm button */}
            <TouchableOpacity
              onPress={() => { if (rangeStart && rangeEnd) submitDate(rangeStart, rangeEnd); }}
              disabled={!rangeStart || !rangeEnd}
              activeOpacity={0.85}
              style={{
                marginTop: 18,
                paddingVertical: 13,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: rangeStart && rangeEnd ? accent : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
              }}
            >
              <Text style={{ color: rangeStart && rangeEnd ? '#FFF' : muted, fontSize: fs.sm, fontWeight: '900' }}>
                {rangeStart && rangeEnd ? 'Add Date to Poll' : 'Select start & end date'}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={!!editPoll} transparent animationType="fade" onRequestClose={() => setEditPoll(null)}>
        <KeyboardAvoidingView behavior="padding" style={S.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditPoll(null)} />
          <Pressable style={[S.sheet, { backgroundColor: paper, borderColor: border, maxWidth: 420 }]} onPress={() => {}}>
            <View style={S.sheetHead}>
              <Text style={{ fontSize: fs.md, fontWeight: '900', color: ink }}>Edit Option</Text>
              <TouchableOpacity onPress={() => setEditPoll(null)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
                <X size={18} color={muted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              style={{ maxHeight: Math.min(Dimensions.get('window').height * 0.6, 440) }}
            >
              {editPoll?.type === 'place' ? (
                <>
                  <LabelText muted={muted} fs={fs}>Place name</LabelText>
                  <PlaceAutocompleteInput
                    value={editTitle}
                    onChangeText={handleEditTitleChange}
                    onSelect={(sel) => {
                      setEditTitle(sel.name);
                      setEditPlace(sel);
                    }}
                    selectedAddress={editPlace?.address}
                    placeholder="Search for a destination"
                    accent={accent} ink={ink} muted={muted} border={border} isDark={isDark} fs={fs}
                  />
                  {editPlace?.photos && editPlace.photos.length > 0 && (
                    <PhotoPickerRow
                      photos={editPlace.photos}
                      selectedRef={editPlace.photoReference}
                      onSelect={(ref) => setEditPlace((prev) => (prev ? { ...prev, photoReference: ref } : prev))}
                      accent={accent} border={border} isDark={isDark} fs={fs}
                    />
                  )}
                </>
              ) : (
                <>
                  <Text style={{ fontSize: fs.xs, fontWeight: '700', color: muted, marginBottom: 6 }}>
                    {editStart && editEnd ? fmtRange(editStart, editEnd) : 'Tap to select new dates'}
                  </Text>
                  <InlineCalendar
                    startDate={editStart} endDate={editEnd}
                    onRangeChange={(s, e) => { setEditStart(s); setEditEnd(e); }}
                    accent={accent} ink={ink} muted={muted} paper={paper} border={border} isDark={isDark}
                  />
                  {votingDeadline && (
                    <Text style={{ fontSize: fs.xs, color: muted, marginTop: 8, fontWeight: '600' }}>
                      Note: Voting deadline is {fmtDeadline(votingDeadline)}. Keep proposed dates after it.
                    </Text>
                  )}
                </>
              )}

              <LabelText muted={muted} fs={fs}>Notes</LabelText>
              <FieldWrap border={border} isDark={isDark} icon={<FileText size={16} color={muted} strokeWidth={1.8} />}>
                <TextInput style={[S.input, { color: ink, fontSize: fs.sm }]} value={editNote} onChangeText={setEditNote}
                  placeholder="Short description..." placeholderTextColor={muted} />
              </FieldWrap>
            </ScrollView>

            <View style={S.actions}>
              <TouchableOpacity onPress={() => setEditPoll(null)} style={pill('transparent', border)}>
                <Text style={{ color: muted, fontWeight: '700', fontSize: fs.sm }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={pill(accent)}>
                <Text style={{ color: '#FFF', fontWeight: '800', fontSize: fs.sm }}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Delete Poll Option Confirmation Modal (matches kick-member style) ── */}
      <Modal
        transparent
        visible={!!delPoll}
        animationType="fade"
        onRequestClose={() => setDelPoll(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDelPoll(null)} />
          <View style={{ width: '100%', maxWidth: 340, backgroundColor: isDark ? colors.paper : '#FFFFFF', borderRadius: 28, borderWidth: 1, borderColor: border, padding: 24, alignItems: 'center', elevation: 12 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? 'rgba(239,68,68,0.2)' : '#FCE8E6', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={26} color="#EF4444" strokeWidth={2.2} />
            </View>

            <Text style={{ fontSize: 18, fontWeight: '900', color: ink, textAlign: 'center', marginBottom: 6 }}>
              Remove option?
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: muted, textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
              "{delPoll?.title}" will be permanently removed from the voting poll along with its votes. This cannot be undone.
            </Text>

            <View style={{ width: '100%', gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmDelete}
                disabled={deletingPoll}
                style={{
                  backgroundColor: '#EF4444',
                  paddingVertical: 13,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#EF4444',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                {deletingPoll ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={{ color: '#FFF', fontSize: 14, fontWeight: '800' }}>
                    Yes, Remove Option
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDelPoll(null)}
                disabled={deletingPoll}
                style={{
                  borderWidth: 1,
                  borderColor: border,
                  paddingVertical: 11,
                  borderRadius: 100,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: muted, fontSize: 13, fontWeight: '700' }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Voting Deadline Modal (host only) ── */}
      <DeadlineModal
        visible={deadlineVisible}
        initial={votingDeadline ? new Date(votingDeadline) : null}
        onClose={() => setDeadlineVisible(false)}
        onSave={saveDeadline}
        paper={paper}
        border={border}
        ink={ink}
        muted={muted}
        accent={accent}
        isDark={isDark}
        fs={fs}
      />
    </View>
  );
};

// ── Static Styles ──────────────────────────────
const S = StyleSheet.create({
  outer: { borderWidth: 1, overflow: 'hidden', borderRadius: 24, marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1 },
  card: { borderWidth: 1, borderRadius: 16, padding: 7, gap: 8, overflow: 'hidden' },
  photoBlock: { height: 92, borderRadius: 12, overflow: 'hidden', justifyContent: 'flex-end', padding: 10 },
  photoIcon: { position: 'absolute', left: 12, top: 12 },
  photoTitle: { fontSize: 13.5, fontWeight: '900', letterSpacing: -0.2, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  photoActions: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6, zIndex: 2 },
  ghostBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  captionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 2 },
  voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5 },
  empty: { alignItems: 'center', padding: 28, borderRadius: 20, borderWidth: 1.5, borderStyle: 'dashed' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 400, borderRadius: 24, borderWidth: 1, padding: 22, elevation: 16 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  fieldWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  input: { flex: 1, fontWeight: '600', padding: 0 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 20 },
});
