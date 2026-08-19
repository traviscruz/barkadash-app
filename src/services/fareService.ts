// Fare estimation: Google Routes API for real distance/duration AND real
// multi-leg transit itineraries, + Gemini/Groq (raced for speed) for
// per-ride fare estimates. Results are cached in memory for 10 minutes.
import { PlacePrediction } from './googlePlaces';
import { requestJsonRace, StructuredAiSource } from './aiStructuredService';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export type TransportType = 'walk' | 'public' | 'taxi' | 'ridehail' | 'motorbike' | 'car';

export interface JourneyLeg {
  id: string;
  type: TransportType;
  mode: string;
  vehicle?: string;
  agency?: string;
  lineColor?: string;
  from: string;
  to: string;
  distanceKm: number | null;
  durationMin: number | null;
  estimatedFare: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  notes?: string;
}

export type JourneyTag = 'Cheapest' | 'Fastest' | 'Recommended';

export interface JourneyOption {
  id: string;
  name: string;
  tag?: JourneyTag;
  totalFare: number | null;
  rangeLow: number | null;
  rangeHigh: number | null;
  totalEtaMinutes: number | null;
  totalDistanceKm: number | null;
  legs: JourneyLeg[];
}

export interface RouteInfo {
  distanceKm: number | null;
  durationMin: number | null;
}

export interface FareResult {
  origin: string;
  destination: string;
  distanceKm: number | null;
  durationMin: number | null;
  currency: string;
  journeys: JourneyOption[];
  source: StructuredAiSource | null;
  hasTransitRoute: boolean;
}

export type FareStage = 'routing' | 'estimating';

/**
 * Query the Google Routes API (v2) for the driving distance and duration
 * between two places. Passes place IDs straight to the API (no extra
 * coordinate lookup needed). Uses TRAFFIC_AWARE since we only need a
 * reference figure for the header.
 */
export async function getRouteDistance(
  origin: PlacePrediction,
  destination: PlacePrediction
): Promise<RouteInfo> {
  if (!API_KEY) {
    console.warn('getRouteDistance: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set');
    return { distanceKm: null, durationMin: null };
  }

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { placeId: origin.placeId },
        destination: { placeId: destination.placeId },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('getRouteDistance HTTP error:', res.status, errText.slice(0, 300));
      return { distanceKm: null, durationMin: null };
    }

    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) return { distanceKm: null, durationMin: null };

    const meters = route.distanceMeters ? Number(route.distanceMeters) : null;
    const durationSec = typeof route.duration === 'string'
      ? parseFloat(route.duration.replace(/[^0-9.]/g, ''))
      : route.duration;

    return {
      distanceKm: meters ? meters / 1000 : null,
      durationMin: durationSec ? Math.round(durationSec / 60) : null,
    };
  } catch (err: any) {
    console.warn('getRouteDistance exception:', err?.message);
    return { distanceKm: null, durationMin: null };
  }
}

export interface TransitStep {
  travelMode: 'WALK' | 'TRANSIT';
  distanceMeters: number | null;
  durationSec: number | null;
  departureStop?: string;
  arrivalStop?: string;
  vehicle?: string;
  lineName?: string;
  agency?: string;
  lineColor?: string;
}

export interface TransitRoute {
  id: string;
  totalDistanceKm: number | null;
  totalDurationMin: number | null;
  steps: TransitStep[];
}

const TRANSIT_FIELDS = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.duration',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.transitDetails.stopDetails.departureStop.name',
  'routes.legs.steps.transitDetails.stopDetails.arrivalStop.name',
  'routes.legs.steps.transitDetails.transitLine.name',
  'routes.legs.steps.transitDetails.transitLine.color',
  'routes.legs.steps.transitDetails.transitLine.vehicle.name',
  'routes.legs.steps.transitDetails.transitLine.vehicle.type',
  'routes.legs.steps.transitDetails.transitLine.agencies.name',
].join(',');

/**
 * Query the Google Routes API in TRANSIT mode to get real multi-leg itineraries
 * (actual vehicle lines, agencies, and stop names). Returns up to 2 alternatives.
 */
export async function getTransitRoutes(
  origin: PlacePrediction,
  destination: PlacePrediction
): Promise<TransitRoute[]> {
  if (!API_KEY) return [];
  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': TRANSIT_FIELDS,
      },
      body: JSON.stringify({
        origin: { placeId: origin.placeId },
        destination: { placeId: destination.placeId },
        travelMode: 'TRANSIT',
        computeAlternativeRoutes: true,
        transitPreferences: { routingPreference: 'FEWER_TRANSFERS' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('getTransitRoutes HTTP error:', res.status, errText.slice(0, 300));
      return [];
    }

    const json = await res.json();
    const routes: any[] = Array.isArray(json?.routes) ? json.routes.slice(0, 2) : [];
    if (routes.length === 0) return [];

    return routes
      .map((r, ri) => {
        const legs: any[] = Array.isArray(r?.legs) ? r.legs : [];
        const steps: TransitStep[] = [];
        for (const leg of legs) {
          for (const s of Array.isArray(leg?.steps) ? leg.steps : []) {
            const td = s?.transitDetails;
            const line = td?.transitLine;
            const durationSec = typeof s?.duration === 'string'
              ? parseFloat(s.duration.replace(/[^0-9.]/g, ''))
              : s?.duration;
            steps.push({
              travelMode: s?.travelMode === 'TRANSIT' ? 'TRANSIT' : 'WALK',
              distanceMeters: s?.distanceMeters ? Number(s.distanceMeters) : null,
              durationSec: durationSec ? Math.round(durationSec) : null,
              departureStop: td?.stopDetails?.departureStop?.name,
              arrivalStop: td?.stopDetails?.arrivalStop?.name,
              vehicle: line?.vehicle?.name || line?.vehicle?.type || undefined,
              lineName: line?.name,
              agency: line?.agencies?.[0]?.name,
              lineColor: line?.color,
            });
          }
        }
        if (steps.length === 0) return null;
        const totalSec = typeof r?.duration === 'string'
          ? parseFloat(r.duration.replace(/[^0-9.]/g, ''))
          : r?.duration;
        return {
          id: `transit-${ri}`,
          totalDistanceKm: r?.distanceMeters ? Number(r.distanceMeters) / 1000 : null,
          totalDurationMin: totalSec ? Math.round(totalSec / 60) : null,
          steps,
        };
      })
      .filter((r): r is TransitRoute => r !== null);
  } catch (err: any) {
    console.warn('getTransitRoutes exception:', err?.message);
    return [];
  }
}

const isNum = (n: any): n is number => typeof n === 'number' && isFinite(n);
const clampNum = (n: any, def: number | null = null): number | null => (isNum(n) ? Math.round(n * 10) / 10 : def);
const intNum = (n: any, def: number | null = null): number | null => (isNum(n) ? Math.max(0, Math.round(n)) : def);

/** Turn the real transit itineraries into a compact prompt-friendly summary. */
function buildTransitSummary(routes: TransitRoute[]): string {
  if (routes.length === 0) return '';
  return routes
    .map((r, i) => {
      const lines = r.steps.map((s) => {
        if (s.travelMode === 'TRANSIT') {
          const line = [s.lineName, s.vehicle].filter(Boolean).join(' ');
          const agency = s.agency ? ` (${s.agency})` : '';
          const stops = [s.departureStop, s.arrivalStop].filter(Boolean).join(' → ');
          const dist = s.distanceMeters != null ? `${(s.distanceMeters / 1000).toFixed(1)} km` : '?';
          const dur = s.durationSec != null ? `${Math.round(s.durationSec / 60)} min` : '?';
          return `    Ride "${line}"${agency} ${stops} ~${dist} ~${dur}`;
        }
        const dist = s.distanceMeters != null ? `${Math.round(s.distanceMeters)} m` : '?';
        const dur = s.durationSec != null ? `${Math.round(s.durationSec / 60)} min` : '?';
        return `    Walk ~${dist} ~${dur}`;
      }).join('\n');
      return `REAL ROUTE ${i + 1}:\n${lines}`;
    })
    .join('\n\n');
}

/** Build typed journeys from the AI's raw JSON and derive sensible totals/tags. */
function normalizeJourneys(raw: any): JourneyOption[] {
  const rawJourneys: any[] = Array.isArray(raw?.journeys) ? raw.journeys : [];
  const journeys: JourneyOption[] = rawJourneys
    .map((j, ji) => {
      const rawLegs: any[] = Array.isArray(j?.legs) ? j.legs : [];
      const legs: JourneyLeg[] = rawLegs
        .map((l, li) => ({
          id: `j${ji}-l${li}`,
          type: (l?.type || 'public') as TransportType,
          mode: typeof l?.mode === 'string' && l.mode ? l.mode : 'Ride',
          vehicle: typeof l?.vehicle === 'string' ? l.vehicle : undefined,
          agency: typeof l?.agency === 'string' ? l.agency : undefined,
          lineColor: typeof l?.line_color === 'string' ? l.line_color : typeof l?.lineColor === 'string' ? l.lineColor : undefined,
          from: typeof l?.from === 'string' ? l.from : '',
          to: typeof l?.to === 'string' ? l.to : '',
          distanceKm: clampNum(l?.distance_km ?? l?.distanceKm),
          durationMin: intNum(l?.duration_min ?? l?.durationMin),
          estimatedFare: intNum(l?.estimated_fare ?? l?.estimatedFare),
          rangeLow: intNum(l?.range_low ?? l?.rangeLow),
          rangeHigh: intNum(l?.range_high ?? l?.rangeHigh),
          notes: typeof l?.notes === 'string' ? l.notes : undefined,
        }))
        .filter((l) => l.mode);
      if (legs.length === 0) return null;

      const hasFare = legs.some((l) => l.estimatedFare != null);
      const hasEta = legs.some((l) => l.durationMin != null);
      const hasDist = legs.some((l) => l.distanceKm != null);

      return {
        id: `journey-${ji}`,
        name: typeof j?.name === 'string' && j.name ? j.name : `${legs.length} rides`,
        totalFare: hasFare ? legs.reduce((acc, l) => acc + (l.estimatedFare ?? 0), 0) : null,
        rangeLow: hasFare ? legs.reduce((acc, l) => acc + (l.rangeLow ?? l.estimatedFare ?? 0), 0) : null,
        rangeHigh: hasFare ? legs.reduce((acc, l) => acc + (l.rangeHigh ?? l.estimatedFare ?? 0), 0) : null,
        totalEtaMinutes: hasEta ? legs.reduce((acc, l) => acc + (l.durationMin ?? 0), 0) : null,
        totalDistanceKm: hasDist ? legs.reduce((acc, l) => acc + (l.distanceKm ?? 0), 0) : null,
        legs,
      };
    })
    .filter((j): j is JourneyOption => j !== null);

  if (journeys.length === 0) return journeys;

  const priced = journeys.filter((j) => j.totalFare != null);
  const timed = journeys.filter((j) => j.totalEtaMinutes != null);
  const cheapest = priced.length ? priced.reduce((a, b) => ((b.totalFare as number) < (a.totalFare as number) ? b : a)) : null;
  const fastest = timed.length ? timed.reduce((a, b) => ((b.totalEtaMinutes as number) < (a.totalEtaMinutes as number) ? b : a)) : null;

  for (const j of journeys) {
    const isCheap = cheapest ? j.id === cheapest.id : false;
    const isFast = fastest ? j.id === fastest.id : false;
    if (isCheap && isFast) j.tag = 'Recommended';
    else if (isCheap) j.tag = 'Cheapest';
    else if (isFast) j.tag = 'Fastest';
    else if (j.tag === 'Recommended') j.tag = 'Recommended';
    else j.tag = undefined;
  }

  return journeys.sort((a, b) => {
    if (a.totalFare == null && b.totalFare == null) return 0;
    if (a.totalFare == null) return 1;
    if (b.totalFare == null) return -1;
    return (a.totalFare as number) - (b.totalFare as number);
  });
}

const FARE_SYSTEM_PROMPT = [
  'You are a transport fare estimator for "Barkadash", a travel app used worldwide but based in the Philippines.',
  'Given an origin, a destination, and (when available) REAL multi-leg transit itineraries from Google Maps, list realistic journeys between them with estimated fares. Real passengers combine rides — e.g. jeepney + LRT, bus + tricycle, walk + train + jeep — so multi-leg journeys are expected, and the user should have options.',
  '',
  'Return ONLY a single JSON object — no markdown, no commentary — with this exact structure:',
  '{',
  '  "currency": "PHP",',
  '  "journeys": [',
  '    {',
  '      "name": "Jeepney + LRT Line 1",',
  '      "tag": "Cheapest",',
  '      "legs": [',
  '        {',
  '          "type": "public",',
  '          "mode": "Jeepney",',
  '          "from": "SM North EDSA",',
  '          "to": "Roosevelt Station",',
  '          "distance_km": 2.0,',
  '          "duration_min": 12,',
  '          "estimated_fare": 14,',
  '          "range_low": 13,',
  '          "range_high": 16,',
  '          "notes": "Flag down any jeepney headed to Roosevelt"',
  '        }',
  '      ]',
  '    }',
  '  ]',
  '}',
  '',
  'Rules:',
  '- currency: use the real local currency code of the trip (PHP for the Philippines, USD, EUR, INR, THB, IDR, MYR, SGD, AUD, GBP, JPY, VND, etc.). For cross-country trips use the destination country\'s currency.',
  '- Include 4-6 journeys covering different budgets and modes: 2-3 public-transit combos mixing first-mile (walk/tricycle/jeepney), a main ride (jeepney/bus/train/van), and last-mile (walk/tricycle/jeepney); plus a direct metered taxi, a direct ride-hailing ride (Grab/Uber/Gojek/Bolt/inDrive), a direct motorcycle taxi where common (Angkas/GoRide/GrabBike/Gojek), and a private car (fuel + tolls + parking) where sensible.',
  '- For every journey, list each ride/walk as a separate "leg" in order. The last leg must end at the destination.',
  '- "type" must be one of: "walk", "public", "taxi", "ridehail", "motorbike", "car".',
  '- When a REAL ROUTE is provided below, include a journey that follows it exactly: keep the same vehicles, line names, agency, and stop names — only add fares, estimated times, and first/last-mile walk legs. Also add cheaper alt-connector journeys (e.g. swap the walk for a tricycle/jeepney) so the user can choose.',
  '- estimated_fare / range_low / range_high are plain numbers in the main currency (e.g. 15 for ₱15). Use 0 for free legs like short walks. Range low/high should bracket the real-world fare spread.',
  '- Scale fares and travel times realistically to the distances given (drive distance is provided). Do not invent wildly wrong prices for the country.',
  '- distance_km and duration_min are plain numbers per leg; their sums should roughly match the total trip.',
  '- "tag": optional, at most two journeys — mark the cheapest overall "Cheapest" and the fastest overall "Fastest". Use "Recommended" only for a balanced public-transit route when it is also the best value.',
  '- notes: short, practical (beep card, flag down, agree on tricycle fare first, tolls, parking).',
  '- Numbers only. No currency symbols inside numbers, no formatting strings, no markdown.',
].join('\n');

/** Small in-memory cache so repeat lookups answer instantly. */
interface CacheEntry {
  at: number;
  result: FareResult;
}
const fareCache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;
const MAX_CACHE = 30;

/**
 * Estimate transport fares between two places. Pulls real driving distance AND
 * real transit itineraries from Google Routes, then prices each journey via AI
 * (Gemini and Groq raced — first valid answer wins) for speed. Works worldwide.
 */
export async function estimateFares(
  origin: PlacePrediction,
  destination: PlacePrediction,
  onProgress?: (stage: FareStage) => void
): Promise<FareResult | null> {
  const originName = [origin.mainText, origin.secondaryText].filter(Boolean).join(', ');
  const destName = [destination.mainText, destination.secondaryText].filter(Boolean).join(', ');

  const cacheKey = `${origin.placeId}|${destination.placeId}`;
  const cached = fareCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.result;

  let route: RouteInfo = { distanceKm: null, durationMin: null };
  let transitRoutes: TransitRoute[] = [];

  onProgress?.('routing');
  const [driving, transit] = await Promise.all([
    getRouteDistance(origin, destination),
    getTransitRoutes(origin, destination),
  ]);
  route = driving;
  transitRoutes = transit;

  onProgress?.('estimating');
  const hasTransit = transitRoutes.length > 0;
  const transitSummary = buildTransitSummary(transitRoutes);

  const user = [
    `Origin: ${originName}`,
    `Destination: ${destName}`,
    route.distanceKm ? `Direct driving distance: ${route.distanceKm} km` : '',
    route.durationMin ? `Direct driving time: ${route.durationMin} min` : '',
    hasTransit
      ? `Real transit itineraries from Google (build the public-transit journeys from these and keep their vehicles, line names, and stop names — only add fares and times):\n${transitSummary}`
      : '',
  ].filter(Boolean).join('\n');

  const result = await requestJsonRace(FARE_SYSTEM_PROMPT, user, { maxTokens: 4096 });
  if (!result) return null;

  const currency = typeof result.data?.currency === 'string' ? result.data.currency.toUpperCase() : 'PHP';
  const journeys = normalizeJourneys(result.data);
  if (journeys.length === 0) return null;

  const fareResult: FareResult = {
    origin: originName,
    destination: destName,
    distanceKm: clampNum(result.data?.distance_km ?? result.data?.distanceKm, route.distanceKm),
    durationMin: intNum(result.data?.duration_min ?? result.data?.durationMin, route.durationMin),
    currency,
    journeys,
    source: result.source,
    hasTransitRoute: hasTransit,
  };

  if (fareCache.size >= MAX_CACHE) {
    const oldest = fareCache.keys().next().value;
    if (oldest) fareCache.delete(oldest);
  }
  fareCache.set(cacheKey, { at: Date.now(), result: fareResult });
  return fareResult;
}
