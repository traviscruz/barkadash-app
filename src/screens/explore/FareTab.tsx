import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import {
  ArrowDownUp,
  Search,
  MapPin,
  Route,
  Sparkles,
  Footprints,
  BusFront,
  TrainFront,
  TramFront,
  CarFront,
  CarTaxiFront,
  Motorbike,
  Navigation2,
  Ship,
  Wallet,
  Zap,
  BadgeCheck,
  ChevronDown,
  CircleCheck,
  Info,
  Clock,
  Timer,
} from 'lucide-react-native';
import { useResponsive } from '../../utils/responsive';
import { useTheme } from '../../context/ThemeContext';
import { PlacePrediction } from '../../services/googlePlaces';
import {
  estimateFares,
  FareResult,
  FareStage,
  JourneyLeg,
  JourneyOption,
  JourneyTag,
} from '../../services/fareService';
import { PlaceAutocompleteInput } from './PlaceAutocompleteInput';

interface FareTabProps {
  accentColor: string;
  onScrollDirection?: (direction: 'up' | 'down') => void;
}

type IconType = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  IDR: 'Rp',
  MYR: 'RM',
  SGD: 'S$',
  THB: '฿',
  VND: '₫',
  AUD: 'A$',
  CAD: 'C$',
  AED: 'د.إ',
};

const formatMoney = (amount: number | null | undefined, currency: string): string => {
  if (amount == null) return '—';
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${sym}${Math.round(amount).toLocaleString()}`;
};

const formatRange = (low: number | null | undefined, high: number | null | undefined, currency: string): string => {
  if (low == null || high == null) return '';
  return `${formatMoney(low, currency)} – ${formatMoney(high, currency)}`;
};

/** Pick the best icon + color for a leg based on its mode / vehicle / agency. */
const visualFor = (leg: JourneyLeg): { icon: IconType; color: string } => {
  const t = `${leg.mode} ${leg.vehicle ?? ''} ${leg.agency ?? ''}`.toLowerCase();
  if (/walk|foot/.test(t)) return { icon: Footprints, color: '#8B9BB4' };
  if (/ferry|boat|ship|water/.test(t)) return { icon: Ship, color: '#0E9BB8' };
  if (/lrt|mrt|metro|monorail|subway|underground/.test(t)) return { icon: TramFront, color: '#E2604A' };
  if (/tram/.test(t)) return { icon: TramFront, color: '#E2604A' };
  if (/train|rail/.test(t)) return { icon: TrainFront, color: '#E2604A' };
  if (/jeep|uv|van|shuttle/.test(t)) return { icon: BusFront, color: '#3B7A9E' };
  if (/tricycle|padyak|habal|motorcycle|motorbike|angkas|grab.?bike/.test(t)) return { icon: Motorbike, color: '#8B5CF6' };
  if (/taxi/.test(t)) return { icon: CarTaxiFront, color: '#F0A93E' };
  if (/grab|uber|indrive|gojek|bolt|lyft|ride.?hail/.test(t)) return { icon: CarFront, color: '#4F86C6' };
  if (/car|private|drive/.test(t)) return { icon: Navigation2, color: '#2E9E5B' };
  if (/bus/.test(t)) return { icon: BusFront, color: '#3B7A9E' };
  switch (leg.type) {
    case 'walk': return { icon: Footprints, color: '#8B9BB4' };
    case 'public': return { icon: BusFront, color: '#3B7A9E' };
    case 'taxi': return { icon: CarTaxiFront, color: '#F0A93E' };
    case 'ridehail': return { icon: CarFront, color: '#4F86C6' };
    case 'motorbike': return { icon: Motorbike, color: '#8B5CF6' };
    case 'car': return { icon: Navigation2, color: '#2E9E5B' };
    default: return { icon: BusFront, color: '#3B7A9E' };
  }
};

const TAG_META: Record<JourneyTag, { icon: IconType; label: string }> = {
  Cheapest: { icon: Wallet, label: 'Cheapest' },
  Fastest: { icon: Zap, label: 'Fastest' },
  Recommended: { icon: BadgeCheck, label: 'Best value' },
};

const STAGES: { key: FareStage; label: string; icon: IconType }[] = [
  { key: 'routing', label: 'Mapping routes', icon: Route },
  { key: 'estimating', label: 'Pricing each ride', icon: Wallet },
];

const LOADING_TIPS = [
  'Waving down a virtual jeepney…',
  'Beep card at the ready…',
  'Negotiating tricycle fares…',
  'Asking the conductor nicely…',
  'Checking for Grab surge pricing…',
  'Counting coins for the LRT fare…',
];

interface FunLoadingCardProps {
  progress: FareStage;
  accentColor: string;
  colors: ReturnType<typeof useTheme>['colors'];
  slow: boolean;
}

const FunLoadingCard: React.FC<FunLoadingCardProps> = ({ progress, accentColor, colors, slow }) => {
  const bounce = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0.06)).current;
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(bounce, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bounce]);

  useEffect(() => {
    const target = progress === 'estimating' ? 0.9 : 0.45;
    Animated.spring(bar, { toValue: target, friction: 8, tension: 50, useNativeDriver: false }).start();
  }, [progress, bar]);

  useEffect(() => {
    const t = setInterval(() => setTipIndex((i) => (i + 1) % LOADING_TIPS.length), 2400);
    return () => clearInterval(t);
  }, []);

  const scale = bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.16, 1] });
  const rot = bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-10deg', '10deg', '-10deg'] });
  const lift = bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -7, 0] });
  const widthPct = bar.interpolate({ inputRange: [0, 1], outputRange: ['6%', '100%'] });
  const activeIndex = STAGES.findIndex((s) => s.key === progress);

  return (
    <View style={{ marginTop: 16, backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16 }}>
      <View style={{ alignItems: 'center' }}>
        <Animated.View style={{ transform: [{ scale }, { rotate: rot }, { translateY: lift }] }}>
          <View
            style={{
              width: 58,
              height: 58,
              borderRadius: 29,
              backgroundColor: `${accentColor}22`,
              borderWidth: 2,
              borderColor: accentColor,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Route size={28} color={accentColor} strokeWidth={2.2} />
          </View>
        </Animated.View>
        <Text style={{ marginTop: 10, fontSize: 15, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>
          Plotting your route…
        </Text>
        <Text style={{ marginTop: 2, fontSize: 11.5, fontWeight: '600', color: colors.inkSoft }}>{LOADING_TIPS[tipIndex]}</Text>
      </View>

      {/* Animated progress bar */}
      <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.paperDim, marginTop: 14, overflow: 'hidden' }}>
        <Animated.View style={{ height: 6, borderRadius: 3, backgroundColor: accentColor, width: widthPct }} />
      </View>

      {/* Stage rows */}
      <View style={{ marginTop: 12, gap: 4 }}>
        {STAGES.map((stage, i) => {
          const done = i < activeIndex;
          const active = i === activeIndex;
          const activeScale = active ? bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.18, 1] }) : 1;
          const activeY = active ? bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] }) : 0;
          return (
            <View key={stage.key} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
              <Animated.View style={{ transform: [{ scale: activeScale }, { translateY: activeY }] }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 9,
                    backgroundColor: done ? colors.lightGreenBg : active ? `${accentColor}22` : colors.paperDim,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {done ? (
                    <CircleCheck size={15} color={colors.good} strokeWidth={2.8} />
                  ) : (
                    <stage.icon size={14} color={active ? accentColor : colors.inkSoft} strokeWidth={2.3} />
                  )}
                </View>
              </Animated.View>
              <Text
                style={{
                  flex: 1,
                  marginLeft: 10,
                  fontSize: 12.5,
                  fontWeight: active ? '900' : '700',
                  color: active ? colors.ink : done ? colors.good : colors.inkSoft,
                  letterSpacing: -0.2,
                }}
              >
                {stage.label}
              </Text>
              {active && <Text style={{ fontSize: 11, fontWeight: '800', color: accentColor }}>working…</Text>}
            </View>
          );
        })}
      </View>

      {slow && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lightOrangeBg, borderRadius: 12, padding: 10, marginTop: 12 }}>
          <Timer size={14} color={colors.orangeAccent} strokeWidth={2.4} />
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: colors.orangeAccent, lineHeight: 15 }}>
            Routes are busy right now — usually worth the wait. Hang tight!
          </Text>
        </View>
      )}
    </View>
  );
};

interface JourneyCardProps {
  journey: JourneyOption;
  currency: string;
  accentColor: string;
  colors: ReturnType<typeof useTheme>['colors'];
  maxFare: number;
  expanded: boolean;
  onToggle: () => void;
}

const JourneyCard: React.FC<JourneyCardProps> = ({ journey, currency, accentColor, colors, maxFare, expanded, onToggle }) => {
  const { isDark } = useTheme();
  const rideCount = journey.legs.filter((l) => l.type !== 'walk').length;
  const transferCount = Math.max(0, rideCount - 1);
  const metaBits: string[] = [];
  if (rideCount > 0) metaBits.push(`${rideCount} ${rideCount === 1 ? 'ride' : 'rides'}`);
  if (journey.legs.length > 1) metaBits.push(`${transferCount} ${transferCount === 1 ? 'transfer' : 'transfers'}`);
  if (journey.totalEtaMinutes != null) metaBits.push(`~${journey.totalEtaMinutes} min`);
  if (journey.totalDistanceKm != null) metaBits.push(`${journey.totalDistanceKm.toFixed(1)} km`);

  const visuals = journey.legs.map(visualFor);
  const shown = journey.legs.slice(0, 4);
  const shownVisuals = visuals.slice(0, 4);
  const fareRatio = journey.totalFare != null && maxFare > 0 ? Math.max(0.08, journey.totalFare / maxFare) : 0;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: expanded ? accentColor : colors.cardBorder,
        borderWidth: 1.5,
        borderRadius: 20,
        overflow: 'hidden',
      }}
    >
      {journey.tag === 'Recommended' && (
        <View style={{ backgroundColor: accentColor, paddingVertical: 5, paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 9.5, fontWeight: '900', color: isDark ? '#121212' : '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.9, textAlign: 'center' }}>
            Best value pick
          </Text>
        </View>
      )}

      <TouchableOpacity onPress={onToggle} activeOpacity={0.85}>
        <View style={{ padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              {/* Route icon strip */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                {shownVisuals.map((v, i) => (
                  <View key={`${journey.id}-chip-${i}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {i > 0 && (
                      <View style={{ width: 12, height: 1.5, backgroundColor: colors.cardBorder, marginHorizontal: 3 }} />
                    )}
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 10,
                        backgroundColor: `${v.color}22`,
                        borderWidth: 1,
                        borderColor: `${v.color}44`,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <v.icon size={15} color={v.color} strokeWidth={2.3} />
                    </View>
                  </View>
                ))}
                {journey.legs.length > shown.length && (
                  <View style={{ marginLeft: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.inkSoft }}>
                      +{journey.legs.length - shown.length}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={{ fontSize: 14.5, fontWeight: '900', color: colors.ink, letterSpacing: -0.3, marginTop: 9 }} numberOfLines={1}>
                {journey.name}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }}>{metaBits.join(' · ')}</Text>
            </View>

            {/* Fare */}
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: accentColor, letterSpacing: -0.6 }}>
                {formatMoney(journey.totalFare, currency)}
              </Text>
              {journey.rangeLow != null && journey.rangeHigh != null && (
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft, marginTop: 1 }}>
                  {formatRange(journey.rangeLow, journey.rangeHigh, currency)}
                </Text>
              )}
              {fareRatio > 0 && (
                <View style={{ width: 58, height: 4, borderRadius: 2, backgroundColor: colors.cardBorder, marginTop: 5, overflow: 'hidden' }}>
                  <View style={{ width: fareRatio * 58, height: 4, borderRadius: 2, backgroundColor: accentColor }} />
                </View>
              )}
              <View style={{ marginTop: 5, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.inkSoft }}>
                  {expanded ? 'Hide' : 'Details'}
                </Text>
                <ChevronDown
                  size={13}
                  color={colors.inkSoft}
                  strokeWidth={2.4}
                  style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
                />
              </View>
            </View>
          </View>

          {/* Tags */}
          {journey.tag && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              <TagBadge tag={journey.tag} colors={colors} />
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded legs */}
      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.rule }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
            Ride-by-ride breakdown
          </Text>
          {journey.legs.map((leg, idx) => {
            const visual = visualFor(leg);
            const lineColor = leg.lineColor || `${visual.color}55`;
            const isLast = idx === journey.legs.length - 1;
            return (
              <View key={leg.id} style={{ flexDirection: 'row' }}>
                <View style={{ width: 34, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: `${visual.color}22`,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <visual.icon size={15} color={visual.color} strokeWidth={2.2} />
                  </View>
                  {!isLast && <View style={{ flex: 1, width: 2, backgroundColor: lineColor, marginVertical: 4 }} />}
                </View>
                <View style={{ flex: 1, marginLeft: 10, paddingRight: 14, paddingBottom: isLast ? 12 : 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ flex: 1, fontSize: 13.5, fontWeight: '900', color: colors.ink, letterSpacing: -0.2 }} numberOfLines={1}>
                      {leg.mode}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '900',
                        color: leg.estimatedFare === 0 ? colors.good : accentColor,
                        marginLeft: 8,
                        letterSpacing: -0.3,
                      }}
                    >
                      {leg.estimatedFare === 0 ? 'Free' : formatMoney(leg.estimatedFare, currency)}
                    </Text>
                  </View>
                  {(leg.from || leg.to) && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }} numberOfLines={1}>
                      {leg.from || 'Start'} → {leg.to || 'End'}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    {leg.durationMin != null && (
                      <>
                        <Clock size={10.5} color={colors.inkSoft} strokeWidth={2.3} />
                        <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>~{leg.durationMin} min</Text>
                      </>
                    )}
                    {leg.distanceKm != null && (
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>
                        {leg.durationMin != null ? ' · ' : ''}
                        {leg.distanceKm.toFixed(1)} km
                      </Text>
                    )}
                    {leg.vehicle && leg.vehicle.toLowerCase() !== leg.mode.toLowerCase() && (
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: colors.inkSoft }}>
                        {leg.durationMin != null || leg.distanceKm != null ? ' · ' : ''}
                        {leg.vehicle}
                      </Text>
                    )}
                  </View>
                  {leg.notes ? (
                    <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.inkSoft, marginTop: 3, lineHeight: 14 }}>{leg.notes}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

interface TagBadgeProps {
  tag: JourneyTag;
  colors: ReturnType<typeof useTheme>['colors'];
}

const TagBadge: React.FC<TagBadgeProps> = ({ tag, colors }) => {
  const meta = TAG_META[tag];
  const bg = tag === 'Cheapest' ? colors.lightGreenBg : tag === 'Fastest' ? colors.lightOrangeBg : colors.lightBlueBg;
  const text = tag === 'Cheapest' ? colors.good : tag === 'Fastest' ? colors.orangeAccent : colors.tealAccent;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 100, paddingHorizontal: 9, paddingVertical: 4 }}>
      <meta.icon size={11} color={text} strokeWidth={2.6} />
      <Text style={{ fontSize: 10, fontWeight: '900', color: text, textTransform: 'uppercase', letterSpacing: 0.4 }}>{meta.label}</Text>
    </View>
  );
};

const StatPill: React.FC<{ icon: IconType; label: string; value: string; color: string; colors: ReturnType<typeof useTheme>['colors'] }> = ({ icon: Icon, label, value, color, colors }) => (
  <View style={{ flex: 1, backgroundColor: colors.paperDim, borderRadius: 14, padding: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Icon size={11} color={color} strokeWidth={2.4} />
      <Text style={{ fontSize: 9, fontWeight: '800', color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
    </View>
    <Text style={{ fontSize: 14, fontWeight: '900', color: colors.ink, marginTop: 3, letterSpacing: -0.3 }}>{value}</Text>
  </View>
);

const SectionHeader: React.FC<{
  title: string;
  subtitle: string;
  count: number;
  icon: IconType;
  color: string;
  colors: ReturnType<typeof useTheme>['colors'];
}> = ({ title, subtitle, count, icon: Icon, color, colors }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
    <View style={{ flex: 1, marginRight: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '900', color: colors.ink, letterSpacing: -0.3 }}>{title}</Text>
        <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
          <Text style={{ fontSize: 11, fontWeight: '900', color }}>{count}</Text>
        </View>
      </View>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.inkSoft, marginTop: 1 }}>{subtitle}</Text>
    </View>
    <Icon size={19} color={color} strokeWidth={2.2} />
  </View>
);

export const FareTab: React.FC<FareTabProps> = ({ accentColor, onScrollDirection }) => {
  const { colors } = useTheme();
  const { sp, icon, bottomNavOffset } = useResponsive();
  const lastOffsetY = useRef(0);

  const [from, setFrom] = useState<PlacePrediction | null>(null);
  const [to, setTo] = useState<PlacePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FareResult | null>(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<FareStage>('routing');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [slow, setSlow] = useState(false);
  const loadingRef = useRef(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
    setError('');
  };

  const toggleJourney = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEstimate = async () => {
    if (!from || !to) {
      setError('Pick both a starting point and a destination first.');
      return;
    }
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError('');
    setResult(null);
    setProgress('routing');
    setExpanded(new Set());
    setSlow(false);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      if (loadingRef.current) setSlow(true);
    }, 18000);

    const res = await estimateFares(from, to, (stage) => setProgress(stage));
    loadingRef.current = false;
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    setLoading(false);
    if (!res || res.journeys.length === 0) {
      setError('Could not estimate fares right now. Please try again in a moment.');
      return;
    }
    setResult(res);
    setExpanded(
      new Set(
        res.journeys
          .filter((j) => j.tag === 'Recommended' || j.tag === 'Cheapest')
          .map((j) => j.id)
      )
    );
  };

  const cheapest = result && result.journeys.length
    ? [...result.journeys].sort((a, b) => (a.totalFare ?? Infinity) - (b.totalFare ?? Infinity))[0]
    : null;
  const fastest = result && result.journeys.length
    ? [...result.journeys].sort((a, b) => (a.totalEtaMinutes ?? Infinity) - (b.totalEtaMinutes ?? Infinity))[0]
    : null;
  const maxFare = result && result.journeys.length
    ? Math.max(...result.journeys.map((j) => j.totalFare ?? 0))
    : 0;

  const multiLeg = result ? result.journeys.filter((j) => j.legs.length > 1) : [];
  const direct = result ? result.journeys.filter((j) => j.legs.length === 1) : [];

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
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
        Compare full journeys — jeepney, bus, train, tricycle, Grab, taxi and more — between any two places. Multi-ride routes included, anywhere in the world.
      </Text>

      {/* From / To inputs */}
      <View style={{ gap: sp.md }}>
        <PlaceAutocompleteInput
          label="From"
          placeholder="e.g. Manila"
          accentColor={accentColor}
          value={from ? [from.mainText, from.secondaryText].filter(Boolean).join(', ') : ''}
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
            <ArrowDownUp size={18} color={accentColor} strokeWidth={2.4} />
          </TouchableOpacity>
        </View>

        <PlaceAutocompleteInput
          label="To"
          placeholder="e.g. BGC, Taguig"
          accentColor={accentColor}
          value={to ? [to.mainText, to.secondaryText].filter(Boolean).join(', ') : ''}
          onSelect={setTo}
        />
      </View>

      {/* Estimate button */}
      <TouchableOpacity
        onPress={handleEstimate}
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
          shadowColor: accentColor,
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 3,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Search size={icon.md} color="#FFFFFF" strokeWidth={2.4} />
        )}
        <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900', letterSpacing: -0.2 }}>
          {loading ? 'Working on it…' : 'Compare routes'}
        </Text>
      </TouchableOpacity>

      {/* Fun animated loading card */}
      {loading && <FunLoadingCard progress={progress} accentColor={accentColor} colors={colors} slow={slow} />}

      {error && !loading ? (
        <View style={{ marginTop: sp.lg, backgroundColor: colors.lightRedBg, borderRadius: 16, padding: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.redAccent, textAlign: 'center', lineHeight: 18 }}>{error}</Text>
        </View>
      ) : null}

      {/* Results */}
      {result && !loading ? (
        <View style={{ marginTop: sp.xl }}>
          {/* Route summary */}
          <View style={{ backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 20, padding: 16, marginBottom: sp.md }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: accentColor, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              {result.journeys.length} ways to go
            </Text>

            {/* Route band */}
            <View style={{ backgroundColor: `${accentColor}14`, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MapPin size={14} color={accentColor} strokeWidth={2.4} />
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.ink, marginLeft: 6, textAlign: 'left' }} numberOfLines={2}>
                  {result.origin}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6, marginVertical: 2 }}>
                <View style={{ width: 2, height: 6, backgroundColor: accentColor, borderRadius: 1, marginLeft: 6 }} />
                <View style={{ flex: 1, height: 2, borderStyle: 'dotted', borderTopWidth: 1.5, borderTopColor: accentColor, marginHorizontal: 8 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MapPin size={14} color={accentColor} strokeWidth={2.4} />
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: colors.ink, marginLeft: 6 }} numberOfLines={2}>
                  {result.destination}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: sp.sm, marginTop: 12 }}>
              <StatPill icon={Route} label="Distance" value={result.distanceKm != null ? `${result.distanceKm.toFixed(1)} km` : '—'} color={accentColor} colors={colors} />
              <StatPill icon={Navigation2} label="Drive time" value={result.durationMin != null ? `~${result.durationMin} min` : '—'} color={accentColor} colors={colors} />
              <StatPill icon={Wallet} label="Currency" value={result.currency} color={accentColor} colors={colors} />
            </View>

            {cheapest && fastest && (
              <View style={{ flexDirection: 'row', gap: sp.sm, marginTop: sp.sm }}>
                <View style={{ flex: 1, backgroundColor: colors.lightGreenBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.good, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cheapest</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: colors.ink, marginTop: 2, letterSpacing: -0.3 }}>
                    {formatMoney(cheapest.totalFare, result.currency)}
                    {cheapest.totalEtaMinutes != null ? ` · ~${cheapest.totalEtaMinutes} min` : ''}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: colors.lightOrangeBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: colors.orangeAccent, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fastest</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: colors.ink, marginTop: 2, letterSpacing: -0.3 }}>
                    {formatMoney(fastest.totalFare, result.currency)}
                    {fastest.totalEtaMinutes != null ? ` · ~${fastest.totalEtaMinutes} min` : ''}
                  </Text>
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
              {result.hasTransitRoute ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <CircleCheck size={11} color={colors.good} strokeWidth={2.6} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.good }}>Real transit routes found</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Info size={11} color={colors.orangeAccent} strokeWidth={2.4} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.orangeAccent }}>Local-knowledge estimates</Text>
                </View>
              )}
            </View>
          </View>

          {/* Multi-leg journeys */}
          {multiLeg.length > 0 && (
            <View style={{ marginTop: sp.md }}>
              <SectionHeader
                title="Combine rides"
                subtitle="Mix jeepney, bus, train, tricycle & walk"
                count={multiLeg.length}
                icon={BusFront}
                color={accentColor}
                colors={colors}
              />
              <View style={{ gap: sp.md }}>
                {multiLeg.map((j) => (
                  <JourneyCard
                    key={j.id}
                    journey={j}
                    currency={result.currency}
                    accentColor={accentColor}
                    colors={colors}
                    maxFare={maxFare}
                    expanded={expanded.has(j.id)}
                    onToggle={() => toggleJourney(j.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Direct options */}
          {direct.length > 0 && (
            <View style={{ marginTop: sp.xl }}>
              <SectionHeader
                title="Go direct"
                subtitle="Single rides — no transfers"
                count={direct.length}
                icon={CarFront}
                color={accentColor}
                colors={colors}
              />
              <View style={{ gap: sp.md }}>
                {direct.map((j) => (
                  <JourneyCard
                    key={j.id}
                    journey={j}
                    currency={result.currency}
                    accentColor={accentColor}
                    colors={colors}
                    maxFare={maxFare}
                    expanded={expanded.has(j.id)}
                    onToggle={() => toggleJourney(j.id)}
                  />
                ))}
              </View>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: sp.lg, paddingHorizontal: sp.sm }}>
            <Info size={12} color={colors.inkSoft} strokeWidth={2.2} style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 10.5, fontWeight: '600', color: colors.inkSoft, lineHeight: 15 }}>
              Estimates only — actual fares vary by traffic, surcharges, promotions and operator. Tap a route to see the full ride-by-ride breakdown.
            </Text>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};