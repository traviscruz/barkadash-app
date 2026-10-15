// Fare estimation: Google Routes API for real distance/duration AND real
// multi-leg transit itineraries, + Gemini/Groq (raced for speed) for
// per-ride fare estimates. Results are cached in memory for 10 minutes.
import { PlacePrediction, getPlaceLatLng } from './googlePlaces';
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

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function buildWaypointPayload(p: PlacePrediction): Promise<{ payload: any; lat?: number; lng?: number }> {
  try {
    const coords = await getPlaceLatLng(p.placeId);
    if (coords && typeof coords.latitude === 'number' && typeof coords.longitude === 'number' && coords.latitude !== 0) {
      return {
        payload: {
          location: {
            latLng: {
              latitude: coords.latitude,
              longitude: coords.longitude,
            },
          },
        },
        lat: coords.latitude,
        lng: coords.longitude,
      };
    }
  } catch {}

  const isCustomId = p.placeId.startsWith('tt_') || p.placeId.startsWith('photon_') || p.placeId.startsWith('ai_');
  if (p.placeId && !isCustomId) {
    return { payload: { placeId: p.placeId } };
  }

  const address = [p.mainText, p.secondaryText].filter(Boolean).join(', ') || p.mainText;
  return { payload: { address } };
}

/**
 * Query the Google Routes API (v2) for the driving distance and duration
 * between two places. Uses coordinates or place IDs, with Haversine fallback.
 */
export async function getRouteDistance(
  origin: PlacePrediction,
  destination: PlacePrediction
): Promise<RouteInfo> {
  const [origWp, destWp] = await Promise.all([
    buildWaypointPayload(origin),
    buildWaypointPayload(destination),
  ]);

  let fallbackDistance: number | null = null;
  let fallbackDuration: number | null = null;

  if (origWp.lat && origWp.lng && destWp.lat && destWp.lng) {
    const crowDist = calculateHaversineDistanceKm(origWp.lat, origWp.lng, destWp.lat, destWp.lng);
    // Typical urban/suburban road multiplier is ~1.30x – 1.35x crow flies distance
    fallbackDistance = Math.round(crowDist * 1.32 * 10) / 10;
    // Average traffic speed ~20 km/h in PH/Southeast Asia, minimum 4 min
    fallbackDuration = Math.round(Math.max(4, (fallbackDistance / 20) * 60));
  }

  if (!API_KEY) {
    return { distanceKm: fallbackDistance, durationMin: fallbackDuration };
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
        origin: origWp.payload,
        destination: destWp.payload,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('getRouteDistance HTTP error:', res.status, errText.slice(0, 300));
      return { distanceKm: fallbackDistance, durationMin: fallbackDuration };
    }

    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route) return { distanceKm: fallbackDistance, durationMin: fallbackDuration };

    const meters = route.distanceMeters ? Number(route.distanceMeters) : null;
    const durationSec = typeof route.duration === 'string'
      ? parseFloat(route.duration.replace(/[^0-9.]/g, ''))
      : route.duration;

    return {
      distanceKm: meters ? Math.round((meters / 1000) * 10) / 10 : fallbackDistance,
      durationMin: durationSec ? Math.round(durationSec / 60) : fallbackDuration,
    };
  } catch (err: any) {
    console.warn('getRouteDistance exception:', err?.message);
    return { distanceKm: fallbackDistance, durationMin: fallbackDuration };
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
    const [origWp, destWp] = await Promise.all([
      buildWaypointPayload(origin),
      buildWaypointPayload(destination),
    ]);

    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': TRANSIT_FIELDS,
      },
      body: JSON.stringify({
        origin: origWp.payload,
        destination: destWp.payload,
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
  'You are an expert transport fare calculator and route planner for "Barkadash", a travel app based in the Philippines and used worldwide.',
  'Given an origin, a destination, and distance/duration metrics, calculate realistic journeys and accurate transport fares.',
  '',
  'CRITICAL REALISTIC MULTI-TRANSPO & CONNECTING RIDES RULES:',
  '  1. NEVER assume a single direct public bus or single jeepney exists door-to-door between different towns, cities, or transit corridors.',
  '  2. In reality, commuters and travelers MUST transfer between connecting lines at real terminals, interchanges, or junctions.',
  '  3. For intercity/provincial trips (> 25 km, e.g. Manila to Batangas/Cavite/Laguna/Rizal/Baguio/Zambales, or Cebu City to Moalboal):',
  '     • MUST provide realistic multi-bus or bus-to-bus/jeepney connections.',
  '     • Example Multi-Bus Journey:',
  '       - Leg 1: Feeder ride (Tricycle, Modern Jeepney, or Walk) to the primary bus terminal (e.g. PITX, Buendia/Pasay Terminal, Cubao Bus Terminal, or South Bus Terminal).',
  '       - Leg 2: Main Express / Provincial Bus along highway/expressway to the regional interchange or central junction (e.g. DLTB, JAM, Victory Liner, Genesis, Ceres Liner to Tagaytay Olivarez, Turbina, or Batangas Grand Terminal).',
  '       - Leg 3: Second Connecting Local Bus (e.g. BSC, Kersteen, San Agustin, local mini-bus) or Jeepney from that junction to the destination municipality.',
  '       - Leg 4: Local Tricycle (special/shared) or short walk from the highway/drop-off to the exact doorstep/resort.',
  '     • Example Train + Provincial Bus Journey:',
  '       - Leg 1: MRT-3 / LRT-1 train to the bus terminal (e.g. Taft/EDSA, North Ave, or Gil Puyat).',
  '       - Leg 2: Provincial aircon bus to regional junction.',
  '       - Leg 3: Connecting local jeepney or tricycle to destination.',
  '  4. For cross-metro trips (> 12 km within Metro Manila, Cebu, Davao):',
  '     • Realistic Multi-Transit Journey: Feeder Jeepney/E-Jeep -> Rail (MRT/LRT) or EDSA Carousel Bus -> Connecting City Bus (e.g. BGC Bus, Alabang bus, Fairview bus) -> Last mile walk/tricycle.',
  '  5. For every public transit journey, name the real specific terminals, stations, and transfer points (e.g. "PITX", "Pasay Buendia DLTB Terminal", "Cubao Araneta Terminal", "Olivarez Plaza Rotunda", "Batangas Grand Terminal", "Turbina Calamba", "Ayala MRT/One Ayala Bus Bay", "Balintawak").',
  '',
  'OFFICIAL PHILIPPINE FARE BENCHMARKS (LTFRB 2024–2026 Rates):',
  '  • Traditional Jeepney: ₱13 base (first 4 km) + ₱1.80 per additional km.',
  '  • Modern Jeepney (E-Jeep / BEEP): ₱15 base (first 4 km) + ₱2.20 per additional km.',
  '  • City Public Bus: ₱15 base (first 5 km) + ₱2.65/km for aircon (₱13 base + ₱2.25/km ordinary).',
  '  • Provincial Aircon Bus: ₱2.00–₱2.50 per km (e.g. 40 km is ~₱95–₱110; 60 km is ~₱140–₱165; 100 km is ~₱230–₱270).',
  '  • Metro Rail (LRT-1, LRT-2, MRT-3): ₱15 base boarding fee + ₱1.21/km (ranges ₱15–₱35 total).',
  '  • UV Express / FX / Shared Vans: ₱15–₱20 base for first 2 km + ₱2.00–₱2.50/km.',
  '  • Tricycle: Local short trips: ₱15–₱25 shared; ₱50–₱90 special (solo / private ride). Rural/resort strips: ₱80–₱150.',
  '  • Motorcycle Taxi (Angkas, JoyRide, Move It): ₱50 base (first 2 km) + ₱10–₱15/km (only sensible for trips under ~35 km).',
  '  • Metered White Taxi: ₱45 flagdown + ₱13.50/km + ₱2/min waiting time.',
  '  • Ride-Hailing (GrabCar, inDrive): ₱45–₱50 flagdown + ₱18–₱22/km + surge/time (typical minimum ₱100–₱140).',
  '  • Private Car / Driving: Estimate actual fuel cost (~₱7–₱9/km) + highway tolls (e.g. SLEX, NLEX, Skyway, CALAX, CAVITEX if applicable).',
  '',
  'INTERNATIONAL FARE BENCHMARKS:',
  '  • If the trip is in another country (e.g. Japan, Singapore, Thailand, US, Europe), use that country\'s real currency and standard local transit/taxi tariffs (e.g. Bangkok BTS ฿17–฿62, Tokyo Metro ¥180–¥330, SG MRT S$1.50–S$2.80, Grab/taxi meter).',
  '',
  'Return ONLY a single JSON object — no markdown, no commentary — with this exact structure:',
  '{',
  '  "currency": "PHP",',
  '  "journeys": [',
  '    {',
  '      "name": "Connecting Buses via PITX & Olivarez Rotunda",',
  '      "tag": "Recommended",',
  '      "legs": [',
  '        {',
  '          "type": "public",',
  '          "mode": "Modern Jeepney",',
  '          "from": "Origin Neighborhood",',
  '          "to": "PITX Terminal (Gate 2)",',
  '          "distance_km": 6.0,',
  '          "duration_min": 25,',
  '          "estimated_fare": 20,',
  '          "range_low": 18,',
  '          "range_high": 22,',
  '          "notes": "Board modern jeepney bound for PITX"',
  '        },',
  '        {',
  '          "type": "public",',
  '          "mode": "Provincial Aircon Bus (DLTB / Kersteen)",',
  '          "from": "PITX Terminal",',
  '          "to": "Tagaytay Olivarez Plaza Rotunda",',
  '          "distance_km": 54.0,',
  '          "duration_min": 85,',
  '          "estimated_fare": 135,',
  '          "range_low": 125,',
  '          "range_high": 150,',
  '          "notes": "Board bus with signboard Tagaytay / Mendez via CAVITEX"',
  '        },',
  '        {',
  '          "type": "public",',
  '          "mode": "Connecting Local Bus (BSC / San Agustin)",',
  '          "from": "Olivarez Plaza Rotunda",',
  '          "to": "Nasugbu Town Proper",',
  '          "distance_km": 38.0,',
  '          "duration_min": 60,',
  '          "estimated_fare": 95,',
  '          "range_low": 85,',
  '          "range_high": 110,',
  '          "notes": "Transfer at rotunda; board connecting bus to Nasugbu"',
  '        },',
  '        {',
  '          "type": "public",',
  '          "mode": "Tricycle (Special)",',
  '          "from": "Nasugbu Bus Stop",',
  '          "to": "Final Destination / Resort",',
  '          "distance_km": 3.5,',
  '          "duration_min": 10,',
  '          "estimated_fare": 60,',
  '          "range_low": 50,',
  '          "range_high": 80,',
  '          "notes": "Agree on special tricycle fare before boarding"',
  '        }',
  '      ]',
  '    }',
  '  ]',
  '}',
  '',
  'Rules:',
  '- currency: use the real local currency code of the trip (PHP for the Philippines, USD, EUR, etc.).',
  '- Provide 4-6 realistic journeys:',
  '  • 2 to 3 multi-leg connecting public transit journeys. Include multi-bus transfers where appropriate (Feeder -> Express Trunk Bus -> Connecting Local Bus/Jeep -> Last mile).',
  '  • 1 direct Metered Taxi or Ride-Hailing (GrabCar).',
  '  • 1 Motorcycle Taxi (Angkas/JoyRide) if under 35 km, OR 1 UV Express / Van combo if provincial.',
  '  • 1 Private Car / Driving option (estimate realistic fuel + tolls).',
  '- NEVER output a single direct public bus for intercity or cross-corridor routes. Real public transit requires connecting legs.',
  '- Each leg must have realistic distance_km, duration_min, and LTFRB-compliant estimated_fare, range_low, and range_high.',
  '- Use 0 for free walking legs.',
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

  const tripDistance = route.distanceKm ?? 25;
  let connectionGuidance = '';
  if (tripDistance > 35) {
    connectionGuidance = [
      `TRIP DISTANCE: ~${tripDistance} km (Intercity / Provincial).`,
      `CRITICAL REQUIREMENT: Direct door-to-door public buses DO NOT exist for this trip.`,
      `You MUST create realistic multi-leg public transit journeys with connecting transfers:`,
      `  • Option 1 (Connecting Buses): Feeder ride -> Main Provincial Bus to regional junction/terminal -> Second Connecting Local Bus (or Jeepney/Van) to destination town -> Local tricycle to doorstep.`,
      `  • Option 2 (Train + Provincial Bus): LRT/MRT to bus terminal (e.g. PITX, Pasay Buendia, Cubao) -> Provincial Bus -> Connecting ride.`,
      `  • Option 3 (UV Express / Shared Van): Van to highway crossing -> Connecting bus or jeepney.`,
    ].join('\n');
  } else if (tripDistance > 12) {
    connectionGuidance = [
      `TRIP DISTANCE: ~${tripDistance} km (Cross-Metro Corridor).`,
      `CRITICAL REQUIREMENT: Direct public transit requires connecting legs between transit corridors:`,
      `  • Multi-Ride Option: Feeder Jeepney/E-Jeep -> Rail (MRT/LRT) or EDSA Carousel Bus -> Connecting City Bus (e.g. BGC Bus, Alabang bus) -> Last mile walk/trike.`,
    ].join('\n');
  } else {
    connectionGuidance = `TRIP DISTANCE: ~${tripDistance} km (Local Urban Route). Break public transit into realistic feeder + main ride + walk.`;
  }

  const user = [
    `Origin: ${originName}`,
    `Destination: ${destName}`,
    route.distanceKm ? `Direct driving distance: ${route.distanceKm} km` : '',
    route.durationMin ? `Direct driving time: ${route.durationMin} min` : '',
    connectionGuidance,
    hasTransit
      ? `Real transit itineraries from Google (build the public-transit journeys from these and keep their vehicles, line names, and stop names — only add fares and times):\n${transitSummary}`
      : '',
  ].filter(Boolean).join('\n\n');

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
