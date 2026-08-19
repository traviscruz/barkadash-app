import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../utils/responsive';
import { Trip } from '../../types/trip';
import { TripService } from '../../services/tripService';
import { parseTripDateRange } from '../../utils/tripDates';
import { ChevronLeft, ChevronRight, CalendarDays, MapPin, X, Maximize2 } from 'lucide-react-native';

const TRIP_PALETTE = ['#F0A93E', '#2A8563', '#1F4E67', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#D97706'];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const tripColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TRIP_PALETTE[h % TRIP_PALETTE.length];
};

const shortDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const shortRange = (range?: string) => {
  const r = parseTripDateRange(range);
  if (!r) return '';
  if (sameDay(r.start, r.end)) return shortDate(r.start);
  return `${shortDate(r.start)} – ${shortDate(r.end)}`;
};

const monthName = (d: Date) => d.toLocaleDateString('en-US', { month: 'long' });

const weekdayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });

interface TripCalendarCardProps {
  currentUserId?: string;
}

export const TripCalendarCard: React.FC<TripCalendarCardProps> = ({ currentUserId }) => {
  const { colors, isDark } = useTheme();
  const { sp, fs, isTablet } = useResponsive();

  const [trips, setTrips] = useState<Trip[]>(() => TripService.getInstance().getTrips());
  const [activeTripId, setActiveTripId] = useState<string>(() => TripService.getInstance().getActiveTrip()?.id || '');
  const [loading, setLoading] = useState(true);
  const [viewMonth, setViewMonth] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [modalVisible, setModalVisible] = useState(false);

  const monthAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const translateAnim = useRef(new Animated.Value(36)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const pillAnims = useRef<Record<string, Animated.Value>>({}).current;
  const reveal = useRef(new Animated.Value(0)).current;

  const today = new Date();

  const dateTrips = useMemo(() => {
    const map = new Map<string, Trip[]>();
    for (const t of trips) {
      const range = parseTripDateRange(t.dateRange);
      if (!range) continue;
      let cur = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate());
      const end = new Date(range.end.getFullYear(), range.end.getMonth(), range.end.getDate());
      while (cur.getTime() <= end.getTime()) {
        const k = keyOf(cur);
        const arr = map.get(k) || [];
        arr.push(t);
        map.set(k, arr);
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }
    }
    return map;
  }, [trips]);

  const noDateTrips = useMemo(() => trips.filter((t) => !parseTripDateRange(t.dateRange)), [trips]);
  const selectedTrips = selectedDay ? dateTrips.get(keyOf(selectedDay)) || [] : [];
  const hasDated = trips.some((t) => !!parseTripDateRange(t.dateRange));

  const getPillAnim = (id: string) => {
    if (!pillAnims[id]) pillAnims[id] = new Animated.Value(0);
    return pillAnims[id];
  };

  const goToMonth = useCallback(
    (dir: number) => {
      const target = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + dir, 1);
      Animated.timing(monthAnim, {
        toValue: -dir * 26,
        duration: 120,
        useNativeDriver: true,
      }).start(() => {
        setViewMonth(target);
        monthAnim.setValue(dir * 26);
        Animated.spring(monthAnim, {
          toValue: 0,
          bounciness: 9,
          speed: 16,
          useNativeDriver: true,
        }).start();
      });
    },
    [viewMonth, monthAnim]
  );

  const goToYear = useCallback(
    (dir: number) => {
      const target = new Date(viewMonth.getFullYear() + dir, viewMonth.getMonth(), 1);
      Animated.timing(monthAnim, {
        toValue: -dir * 40,
        duration: 140,
        useNativeDriver: true,
      }).start(() => {
        setViewMonth(target);
        monthAnim.setValue(dir * 40);
        Animated.spring(monthAnim, {
          toValue: 0,
          bounciness: 9,
          speed: 16,
          useNativeDriver: true,
        }).start();
      });
    },
    [viewMonth, monthAnim]
  );

  const openModal = useCallback(() => {
    setModalVisible(true);
    scaleAnim.setValue(0.9);
    translateAnim.setValue(36);
    overlayAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, bounciness: 16, speed: 11, useNativeDriver: true }),
      Animated.spring(translateAnim, { toValue: 0, bounciness: 13, speed: 13, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    const targets = [...selectedTrips, ...noDateTrips].map((t) => getPillAnim(t.id));
    targets.forEach((a) => a.setValue(0));
    Animated.stagger(
      45,
      targets.map((a) => Animated.spring(a, { toValue: 1, bounciness: 12, speed: 14, useNativeDriver: true }))
    ).start();
  }, [scaleAnim, translateAnim, overlayAnim, selectedTrips, noDateTrips, pillAnims]);

  const closeModal = useCallback(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.93, bounciness: 10, speed: 18, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => setModalVisible(false));
  }, [scaleAnim, overlayAnim]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    TripService.getInstance()
      .fetchUserTripsDB(currentUserId)
      .then(() => {
        if (cancelled) return;
        const svc = TripService.getInstance();
        setTrips(svc.getTrips());
        setActiveTripId(svc.getActiveTrip()?.id || '');
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  useEffect(() => {
    const service = TripService.getInstance();
    const unsub = service.subscribe(() => {
      const active = service.getActiveTrip();
      setActiveTripId(active?.id || '');
      setTrips(service.getTrips());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!loading) {
      reveal.setValue(0);
      Animated.spring(reveal, {
        toValue: 1,
        bounciness: 9,
        speed: 14,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, reveal]);

  const revealStyle = {
    opacity: reveal,
    transform: [
      { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
      { scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };

  const switchTrip = (trip: Trip) => {
    TripService.getInstance().setActiveTripId(trip.id);
    setActiveTripId(trip.id);
    const range = parseTripDateRange(trip.dateRange);
    if (range) {
      setViewMonth(new Date(range.start.getFullYear(), range.start.getMonth(), 1));
      setSelectedDay(range.start);
    }
  };

  const firstWeekday = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];

  const miniCell = Math.max(20, Math.min(24, sp.lg * 1.4));
  const modalCell = Math.max(36, Math.min(46, sp.lg * 2.5));
  const leftW = isTablet ? 120 : Math.max(84, Math.min(98, sp.lg * 5.7));
  const bigDateSize = Math.max(32, Math.min(44, sp.lg * 2.5));

  const renderGrid = (cell: number) => (
    <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', transform: [{ translateX: monthAnim }] }}>
      {cells.map((day, idx) =>
        day ? (
          <DayCell
            key={`${idx}-${day.getDate()}`}
            day={day}
            size={cell}
            trips={dateTrips.get(keyOf(day)) || []}
            colorFor={tripColor}
            dotSize={Math.max(3, cell / 6)}
            isToday={sameDay(day, today)}
            isSelected={!!selectedDay && sameDay(day, selectedDay)}
            hasActiveTrip={dateTrips.get(keyOf(day))?.some((t) => t.id === activeTripId) ?? false}
            onPress={() => setSelectedDay(day)}
          />
        ) : (
          <View key={`e-${idx}`} style={[styles.dayCell, { height: cell + 7 }]} />
        )
      )}
    </Animated.View>
  );

  const renderWeekdays = (cell: number) => (
    <View style={styles.weekRow}>
      {WEEKDAYS.map((w, i) => (
        <Text key={`${w}-${i}`} style={[styles.weekday, { color: i === 0 || i === 6 ? colors.orangeAccent : colors.inkSoft, fontSize: Math.max(8, cell / 4) }]}>
          {w}
        </Text>
      ))}
    </View>
  );

  return (
    <>
      {/* Inline widget */}
      <View style={[styles.widget, { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: isTablet ? 20 : 16 }]}>
        {/* Left: month / weekday / date (right-aligned) */}
        <TouchableOpacity activeOpacity={0.85} onPress={openModal} style={[styles.dateCol, { width: leftW }]}>
          <Text style={[styles.monthText, { color: colors.inkSoft }]}>{monthName(selectedDay).toUpperCase()}</Text>
          <Text
            style={[
              styles.weekdayText,
              { color: sameDay(selectedDay, today) ? '#EF4444' : colors.inkSoft },
            ]}
          >
            {weekdayName(selectedDay).toUpperCase()}
          </Text>
          <Text style={[styles.bigDate, { fontSize: bigDateSize, color: colors.ink }]}>
            {selectedDay.getDate()}
          </Text>
        </TouchableOpacity>

        {/* Right: mini calendar */}
        <View style={styles.calCol}>
          <View style={styles.monthNavRow}>
            <View style={styles.navCluster}>
              <Text style={[styles.monthLabel, { color: colors.ink, fontSize: fs.sm }]}>
                {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <View style={styles.navGroup}>
                <TouchableOpacity onPress={() => goToMonth(-1)} hitSlop={8} style={[styles.navBtn, { backgroundColor: colors.subtleBg }]}>
                  <ChevronLeft size={13} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goToMonth(1)} hitSlop={8} style={[styles.navBtn, { backgroundColor: colors.subtleBg }]}>
                  <ChevronRight size={13} color={colors.ink} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {loading ? (
            <CalLoading label="Syncing your barkada trips" />
          ) : trips.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.inkSoft }]}>No trips yet</Text>
          ) : (
            <Animated.View style={revealStyle}>
              {renderWeekdays(miniCell)}
              {renderGrid(miniCell)}
            </Animated.View>
          )}

          <View style={styles.calFooter}>
            <TouchableOpacity onPress={openModal} hitSlop={8} style={[styles.expandBtn, { backgroundColor: colors.subtleBg }]}>
              <Maximize2 size={11} color={colors.tealDark} strokeWidth={2.6} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Full calendar modal */}
      <Modal transparent visible={modalVisible} animationType="none" onRequestClose={closeModal} statusBarTranslucent>
        <Animated.View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.62)', opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closeModal} />
          <Animated.View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.cardBorder,
                transform: [{ scale: scaleAnim }, { translateY: translateAnim }],
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: isDark ? 'rgba(56,189,248,0.16)' : '#EBF5FB' }]}>
                  <CalendarDays size={16} color={colors.tealDark} strokeWidth={2.5} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.ink }]}>Trip Calendar</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.inkSoft }]}>
                    {trips.length} trip{trips.length === 1 ? '' : 's'} · tap a trip to switch
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={closeModal} hitSlop={8} style={[styles.closeBtn, { backgroundColor: colors.subtleBg }]}>
                <X size={16} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={[styles.modalNavRow, { backgroundColor: colors.subtleBg }]}>
              <Animated.Text style={[styles.modalMonth, { color: colors.ink, transform: [{ translateX: monthAnim }] }]}>
                {viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Animated.Text>
              <View style={styles.navGroup}>
                <TouchableOpacity onPress={() => goToMonth(-1)} style={styles.modalNavBtn}>
                  <ChevronLeft size={17} color={colors.ink} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goToMonth(1)} style={styles.modalNavBtn}>
                  <ChevronRight size={17} color={colors.ink} />
                </TouchableOpacity>
              </View>
              <View style={styles.navGroup}>
                <TouchableOpacity onPress={() => goToYear(-1)} style={styles.modalNavBtn}>
                  <ChevronLeft size={15} color={colors.inkSoft} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => goToYear(1)} style={styles.modalNavBtn}>
                  <ChevronRight size={15} color={colors.inkSoft} />
                </TouchableOpacity>
              </View>
            </View>

            {loading ? (
              <CalLoading label="Loading your trips" compact />
            ) : trips.length === 0 ? (
              <Text style={[styles.modalEmpty, { color: colors.inkSoft }]}>
                No trips yet — host or join one from the Trip Planner.
              </Text>
            ) : (
              <Animated.View style={revealStyle}>
                {hasDated && (
                  <>
                    {renderWeekdays(modalCell)}
                    {renderGrid(modalCell)}
                  </>
                )}

                <View style={[styles.modalPills, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : '#F0ECE3' }]}>
                  {selectedTrips.map((trip) => (
                    <TripPill
                      key={trip.id}
                      trip={trip}
                      color={tripColor(trip.id)}
                      isActive={trip.id === activeTripId}
                      anim={getPillAnim(trip.id)}
                      onPress={() => switchTrip(trip)}
                    />
                  ))}
                  {noDateTrips.map((trip) => (
                    <TripPill
                      key={trip.id}
                      trip={trip}
                      color={tripColor(trip.id)}
                      isActive={trip.id === activeTripId}
                      anim={getPillAnim(trip.id)}
                      onPress={() => switchTrip(trip)}
                    />
                  ))}
                  {selectedTrips.length === 0 && noDateTrips.length === 0 && (
                    <Text style={[styles.modalPillHint, { color: colors.inkSoft }]}>
                      No trips on this day — tap another date.
                    </Text>
                  )}
                </View>
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
};

const CalLoading: React.FC<{ label: string; compact?: boolean }> = ({ label, compact }) => {
  const { colors } = useTheme();
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;
  const dots = [d1, d2, d3];
  const dotColors = [colors.tealDark, colors.orangeAccent, colors.emerald];

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.spring(v, { toValue: 1, bounciness: 18, speed: 20, useNativeDriver: true }),
          Animated.spring(v, { toValue: 0, bounciness: 18, speed: 20, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [d1, d2, d3]);

  const size = compact ? 15 : 9;

  return (
    <View style={[styles.calLoading, compact && styles.calLoadingCompact]}>
      <View style={styles.calLoadingDots}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.calLoadingDot,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: dotColors[i],
                transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -(size * 1.2)] }) }],
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.calLoadingText, { color: colors.inkSoft }]}>{label}</Text>
    </View>
  );
};

interface DayCellProps {
  day: Date;
  size: number;
  trips: Trip[];
  colorFor: (id: string) => string;
  dotSize: number;
  isToday: boolean;
  isSelected: boolean;
  hasActiveTrip: boolean;
  onPress: () => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, size, trips, colorFor, dotSize, isToday, isSelected, hasActiveTrip, onPress }) => {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.85, bounciness: 16, speed: 32, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, bounciness: 10, speed: 18, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  const dots = trips.slice(0, 3);
  const extra = trips.length - dots.length;

  return (
    <View style={styles.dayCell}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePress}
          style={[
            styles.dayCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: isToday ? 1.5 : 0,
              borderColor: isToday ? colors.tealDark : 'transparent',
              backgroundColor: isSelected
                ? colors.tealDark
                : hasActiveTrip
                ? isDark
                  ? 'rgba(56,189,248,0.14)'
                  : 'rgba(31,78,103,0.08)'
                : 'transparent',
            },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                fontSize: size >= 34 ? 14 : Math.max(10, Math.round(size / 2)),
                color: isSelected ? '#FFF' : isToday ? colors.tealDark : colors.ink,
                fontWeight: isSelected || isToday ? '900' : '600',
              },
            ]}
          >
            {day.getDate()}
          </Text>
        </TouchableOpacity>
      </Animated.View>
      <View style={[styles.dotRow, { height: dotSize + 1, gap: Math.max(2, dotSize / 3) }]}>
        {dots.map((t, i) => (
          <View key={t.id + i} style={[styles.tripDot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: colorFor(t.id) }]} />
        ))}
        {extra > 0 && <Text style={[styles.extraDots, { fontSize: Math.max(7, dotSize) }]}>+{extra}</Text>}
      </View>
    </View>
  );
};

interface TripPillProps {
  trip: Trip;
  color: string;
  isActive: boolean;
  anim: Animated.Value;
  onPress: () => void;
}

const TripPill: React.FC<TripPillProps> = ({ trip, color, isActive, anim, onPress }) => {
  const { colors, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isActive) {
      Animated.spring(scale, { toValue: 1.06, bounciness: 14, speed: 20, useNativeDriver: true }).start();
    }
  }, [isActive, scale]);

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 0.94, bounciness: 12, speed: 26, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, bounciness: 12, speed: 16, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          { scale },
        ],
      }}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        style={[
          styles.pill,
          {
            borderColor: isActive ? colors.tealDark : colors.cardBorder,
            backgroundColor: isActive ? (isDark ? 'rgba(56,189,248,0.14)' : '#EBF5FB') : colors.subtleBg,
          },
        ]}
      >
        <View style={[styles.pillDot, { backgroundColor: color }]} />
        <Text style={[styles.pillTitle, { color: colors.ink }]} numberOfLines={1}>
          {trip.title}
        </Text>
        <Text style={[styles.pillDates, { color: colors.inkSoft }]} numberOfLines={1}>
          {shortRange(trip.dateRange) || 'Dates TBD'}
        </Text>
        {isActive ? (
          <View style={[styles.pillActive, { backgroundColor: colors.tealDark }]} />
        ) : (
          <MapPin size={9} color={colors.inkSoft} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  widget: {
    flexDirection: 'row',
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  dateCol: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingVertical: 8,
  },
  monthText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  weekdayText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  bigDate: {
    fontWeight: '400',
    letterSpacing: -1.5,
    lineHeight: 44,
    marginTop: 0,
  },
  calLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  calLoadingCompact: {
    paddingVertical: 32,
  },
  calLoadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 22,
  },
  calLoadingDot: {
    opacity: 0.9,
  },
  calLoadingText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  calCol: {
    flex: 1,
    paddingLeft: 8,
    paddingTop: 6,
    paddingRight: 8,
    paddingBottom: 4,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 2,
  },
  navCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  navBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: '800',
  },
  calFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
    marginRight: 2,
    marginBottom: 2,
  },
  emptyText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    paddingVertical: 1,
  },
  dayCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 11,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  tripDot: {},
  extraDots: {
    fontWeight: '800',
    color: '#6E738A',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  modalNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMonth: {
    fontSize: 14,
    fontWeight: '800',
  },
  modalEmpty: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 40,
    lineHeight: 20,
  },
  modalPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  modalPillHint: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '100%',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 100,
    borderWidth: 1.5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  pillTitle: {
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 130,
  },
  pillDates: {
    fontSize: 9,
    fontWeight: '600',
  },
  pillActive: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});