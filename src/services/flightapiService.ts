// flightapi.io flight search.
// Endpoints used:
//   GET /iata/<api_key>?name=<query>&type=airport   -> airport autocomplete (IATA codes)
//   GET /onewaytrip/<api_key>/<dep>/<arr>/<date>/<adults>/0/0/<cabin>/<currency> -> one-way itineraries
const API_KEY = process.env.EXPO_PUBLIC_FLIGHTAPI_KEY || '';
const BASE_URL = 'https://api.flightapi.io';

export interface FlightAirport {
  code: string; // IATA code, e.g. MNL
  name: string;
  city: string;
  country: string;
  title: string;
  subtitle: string;
}

export interface FlightItinerary {
  id: string;
  priceRaw: number;
  priceFormatted: string;
  currency: string;
  airline: string;
  airlineLogo?: string;
  flightNumber?: string;
  originCode: string;
  destinationCode: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  stopCount: number;
  deeplink?: string;
}

export interface FlightSearchParams {
  originCode: string;
  destinationCode: string;
  date: string; // YYYY-MM-DD
  adults?: number;
  currency?: string;
  cabinClass?: string;
  limit?: number;
}

export type FlightSearchError = 'no-key' | 'rate-limited' | 'forbidden' | 'api-error' | null;

const errorFromStatus = (status: number): FlightSearchError =>
  status === 429 ? 'rate-limited'
    : status === 403 || status === 401 ? 'forbidden'
    : 'api-error';

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱',
  USD: '$',
  EUR: '€',
  GBP: '£',
  SGD: 'S$',
  MYR: 'RM',
  IDR: 'Rp',
  THB: '฿',
  JPY: '¥',
  AUD: 'A$',
};

const formatMoney = (amount: number, currency: string): string => {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${sym}${amount.toFixed(2)}`;
};

/** Normalize places/carriers/agents which arrive as either an array or an object map. */
const toMap = (v: any): Map<string, any> => {
  const m = new Map<string, any>();
  if (Array.isArray(v)) {
    for (const x of v) {
      if (x?.id != null) m.set(String(x.id), x);
    }
  } else if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v)) m.set(k, val);
  }
  return m;
};

const codeOf = (place: any): string => {
  if (!place) return '';
  return String(
    place?.iata ||
      place?.code?.iata ||
      place?.code ||
      place?.iata_code ||
      place?.airport_code ||
      ''
  );
};

const carrierCodeOf = (carrier: any): string => {
  if (!carrier) return '';
  return String(carrier?.code || carrier?.iata || carrier?.iata_code || carrier?.icao || '');
};

// flightapi.io returns booking links as relative /transport_deeplink/... paths.
// Normalize to a real, openable https URL so Linking.openURL works.
const normalizeDeeplink = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/transport_deeplink/')) return `https://www.skyscanner.net${trimmed}`;
  return '';
};

/** Autocomplete airports by name/city using flightapi.io's IATA lookup. */
export async function searchAirports(query: string): Promise<{ airports: FlightAirport[]; error: FlightSearchError }> {
  if (!API_KEY) {
    console.warn('searchAirports: EXPO_PUBLIC_FLIGHTAPI_KEY is not set');
    return { airports: [], error: 'no-key' };
  }
  try {
    const url = `${BASE_URL}/iata/${encodeURIComponent(API_KEY)}?name=${encodeURIComponent(query)}&type=airport`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('searchAirports HTTP error:', res.status);
      return { airports: [], error: errorFromStatus(res.status) };
    }
    const json = await res.json();
    const raw = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    const airports: FlightAirport[] = raw
      .map((a: any) => {
        const code = codeOf(a);
        const name = a?.name || a?.airport_name || a?.city_name || '';
        const city = a?.city || a?.city_name || '';
        const country = a?.country || a?.country_name || '';
        const title = name || city || code;
        const subtitle = [city, country].filter(Boolean).join(', ');
        return { code, name, city, country, title, subtitle };
      })
      .filter((a: FlightAirport) => a.code && a.title)
      .slice(0, 8);
    return { airports, error: null };
  } catch (err: any) {
    console.warn('searchAirports exception:', err?.message);
    return { airports: [], error: 'api-error' };
  }
}

/** Search one-way flights and return normalized itineraries. */
export async function searchFlights(params: FlightSearchParams): Promise<{ flights: FlightItinerary[]; error: FlightSearchError }> {
  if (!API_KEY) {
    console.warn('searchFlights: EXPO_PUBLIC_FLIGHTAPI_KEY is not set');
    return { flights: [], error: 'no-key' };
  }
  try {
    const cabin = params.cabinClass || 'Economy';
    const currency = params.currency || 'PHP';
    const adults = params.adults ?? 1;
    const url = `${BASE_URL}/onewaytrip/${encodeURIComponent(API_KEY)}/${params.originCode}/${params.destinationCode}/${params.date}/${adults}/0/0/${encodeURIComponent(cabin)}/${currency}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn('searchFlights HTTP error:', res.status);
      // 410 = no flights for that date
      if (res.status === 410) return { flights: [], error: null };
      return { flights: [], error: errorFromStatus(res.status) };
    }
    const json = await res.json();
    const itineraries: any[] = Array.isArray(json?.itineraries) ? json.itineraries : [];
    const legs: any[] = Array.isArray(json?.legs) ? json.legs : [];
    const segments: any[] = Array.isArray(json?.segments) ? json.segments : [];
    const places = toMap(json?.places);
    const carriers = toMap(json?.carriers);
    const agents = toMap(json?.agents);

    const flights: FlightItinerary[] = itineraries
      .filter(
        (it: any) =>
          Array.isArray(it?.leg_ids) &&
          it.leg_ids.length > 0 &&
          Array.isArray(it?.pricing_options) &&
          it.pricing_options.length > 0
      )
      .slice(0, params.limit ?? 10)
      .map((it: any) => {
        const legId = it.leg_ids[0];
        const leg = legs.find((l: any) => l?.id === legId) || {};
        const po = it.pricing_options[0] || {};
        const item = po?.items?.[0] || {};
        const amount = po?.price?.amount ?? item?.price?.amount ?? 0;
        const originPlace = leg?.origin_place_id != null ? places.get(String(leg.origin_place_id)) : null;
        const destPlace = leg?.destination_place_id != null ? places.get(String(leg.destination_place_id)) : null;
        const carrierId = leg?.marketing_carrier_ids?.[0];
        const carrier = carrierId != null ? carriers.get(String(carrierId)) : null;
        const seg = segments.find((s: any) => Array.isArray(leg?.segment_ids) && leg.segment_ids.includes(s?.id));
        const flightNo = seg?.marketing_flight_number
          ? [carrierCodeOf(carrier), seg.marketing_flight_number].filter(Boolean).join(' ')
          : '';
        const deeplink = normalizeDeeplink(
          it?.deepLink || it?.deeplink || it?.booking_url || po?.url || item?.url || item?.deep_link || ''
        );
        return {
          id: it.id || String(Math.random()),
          priceRaw: amount,
          priceFormatted: formatMoney(amount, currency),
          currency,
          airline: carrier?.name || (seg?.marketing_carrier_id != null && (carriers.get(String(seg.marketing_carrier_id))?.name)) || 'Unknown airline',
          airlineLogo: carrier?.logo || carrier?.logoUrl || '',
          flightNumber: flightNo,
          originCode: codeOf(originPlace) || leg?.origin || '',
          destinationCode: codeOf(destPlace) || leg?.destination || '',
          departure: leg?.departure || '',
          arrival: leg?.arrival || '',
          durationMinutes: leg?.duration ?? 0,
          stopCount: leg?.stop_count ?? 0,
          deeplink,
        };
      });

    return { flights, error: null };
  } catch (err: any) {
    console.warn('searchFlights exception:', err?.message);
    return { flights: [], error: 'api-error' };
  }
}
