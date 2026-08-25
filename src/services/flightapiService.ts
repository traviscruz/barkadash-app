const API_KEY = process.env.EXPO_PUBLIC_FLIGHTAPI_KEY || '';
const API_KEY_BACKUP = process.env.EXPO_PUBLIC_FLIGHTAPI_KEY_BACKUP || '';
const BASE_URL = 'https://api.flightapi.io';

const DUFFEL_API_KEY = process.env.EXPO_PUBLIC_DUFFEL_API_KEY || '';
const DUFFEL_BASE_URL = 'https://api.duffel.com';

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
  const parts = amount.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sym}${parts.join('.')}`;
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

const parseIsoDurationToMinutes = (dur: string): number => {
  if (!dur) return 0;
  const matches = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!matches) return 0;
  const hours = parseInt(matches[1] || '0', 10);
  const minutes = parseInt(matches[2] || '0', 10);
  return hours * 60 + minutes;
};

/** Autocomplete airports using Duffel API suggestions. */
async function searchAirportsDuffel(query: string): Promise<FlightAirport[]> {
  if (!DUFFEL_API_KEY) return [];
  try {
    const url = `${DUFFEL_BASE_URL}/places/suggestions?query=${encodeURIComponent(query)}`;
    console.log('[Duffel] searchAirports Request URL:', url);
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${DUFFEL_API_KEY}`,
        'Duffel-Version': 'v2',
        'Accept': 'application/json',
      }
    });
    console.log('[Duffel] searchAirports Response Status:', res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[Duffel] searchAirports Error Body:', errText);
      return [];
    }
        const json = await res.json();
    const raw = Array.isArray(json?.data) ? json.data : [];
    const seen = new Set<string>();
    return raw
      .filter((p: any) => p?.type === 'airport' || p?.type === 'city')
      .map((p: any) => {
        const code = String(p?.iata_code || '').toUpperCase();
        const name = String(p?.name || '');
        const city = String(p?.iata_city_code || p?.name || '');
        const country = String(p?.iata_country_code || '');
        const title = name || city || code;
        const subtitle = [city, country].filter(Boolean).join(', ');
        return { code, name, city, country, title, subtitle };
      })
      .filter((a: FlightAirport) => {
        if (!a.code || seen.has(a.code)) return false;
        seen.add(a.code);
        return !!a.title;
      });
  } catch (err: any) {
    console.warn('[Duffel] searchAirports Exception:', err?.message);
    return [];
  }
}

/** Search flights using Duffel API. */
async function searchFlightsDuffel(params: FlightSearchParams): Promise<FlightItinerary[]> {
  if (!DUFFEL_API_KEY) return [];
  try {
    const cabin = params.cabinClass?.toLowerCase().includes('business') ? 'business' 
                 : params.cabinClass?.toLowerCase().includes('first') ? 'first'
                 : params.cabinClass?.toLowerCase().includes('premium') ? 'premium_economy'
                 : 'economy';
    const adults = params.adults ?? 1;
    const url = `${DUFFEL_BASE_URL}/air/offer_requests?return_offers=true`;
    console.log('[Duffel] searchFlights Request URL:', url);
    
    const bodyPayload = {
      data: {
        slices: [
          {
            origin: params.originCode,
            destination: params.destinationCode,
            departure_date: params.date,
          }
        ],
        passengers: Array.from({ length: adults }, () => ({ type: 'adult' })),
        cabin_class: cabin,
      }
    };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DUFFEL_API_KEY}`,
        'Duffel-Version': 'v2',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload)
    });
    
    console.log('[Duffel] searchFlights Response Status:', res.status);
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[Duffel] searchFlights Error Body:', errText);
      return [];
    }
    
    const json = await res.json();
    const offers = Array.isArray(json?.data?.offers) ? json.data.offers : [];
    
    return offers
      .slice(0, params.limit ?? 10)
      .map((offer: any) => {
        const slice = offer.slices?.[0] || {};
        const segments = Array.isArray(slice.segments) ? slice.segments : [];
        const firstSegment = segments[0] || {};
        const lastSegment = segments[segments.length - 1] || {};
        const amount = parseFloat(offer.total_amount || '0');
        const currency = offer.total_currency || params.currency || 'PHP';
        const airline = offer.owner?.name || firstSegment.marketing_carrier?.name || 'Airline';
        const iataCode = offer.owner?.iata_code || firstSegment.marketing_carrier?.iata_code || '';
        const airlineLogo = iataCode ? `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${iataCode}.png` : '';
        const flightNo = firstSegment.marketing_carrier_flight_number
          ? [iataCode, firstSegment.marketing_carrier_flight_number].filter(Boolean).join(' ')
          : '';
        
        const originCode = firstSegment.origin?.iata_code || params.originCode;
        const destinationCode = lastSegment.destination?.iata_code || params.destinationCode;
        const departure = firstSegment.departing_at || `${params.date}T08:00:00`;
        const arrival = lastSegment.arriving_at || `${params.date}T10:15:00`;
        const durationMinutes = slice.duration ? parseIsoDurationToMinutes(slice.duration) : 135;
        const stopCount = segments.length > 1 ? segments.length - 1 : 0;
        
        const dateStr = params.date;
        const deeplink = `https://www.skyscanner.net/transport/flights/${originCode.toLowerCase()}/${destinationCode.toLowerCase()}/${dateStr}`;
        
        return {
          id: offer.id || String(Math.random()),
          priceRaw: amount,
          priceFormatted: formatMoney(amount, currency),
          currency,
          airline,
          airlineLogo,
          flightNumber: flightNo,
          originCode,
          destinationCode,
          departure,
          arrival,
          durationMinutes,
          stopCount,
          deeplink,
        };
      });
  } catch (err: any) {
    console.warn('[Duffel] searchFlights Exception:', err?.message);
    return [];
  }
}

async function fetchAirportsFromFlightApi(query: string, apiKey: string): Promise<FlightAirport[] | null> {
  try {
    const url = `${BASE_URL}/iata/${encodeURIComponent(apiKey)}?name=${encodeURIComponent(query)}&type=airport`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const raw = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
      const seen = new Set<string>();
      return raw
        .map((a: any) => {
          const code = codeOf(a);
          const name = a?.name || a?.airport_name || a?.city_name || '';
          const city = a?.city || a?.city_name || '';
          const country = a?.country || a?.country_name || '';
          const title = name || city || code;
          const subtitle = [city, country].filter(Boolean).join(', ');
          return { code, name, city, country, title, subtitle };
        })
        .filter((a: FlightAirport) => {
          if (!a.code || seen.has(a.code)) return false;
          seen.add(a.code);
          return !!a.title;
        })
        .slice(0, 8);
    }
  } catch (err: any) {
    console.warn('[FlightAPI] fetchAirportsFromFlightApi exception:', err?.message);
  }
  return null;
}

interface FlightApiFetchResult {
  flights: FlightItinerary[];
  success: boolean;
  noFlightsFound: boolean;
}

async function fetchFlightsFromFlightApi(params: FlightSearchParams, apiKey: string): Promise<FlightApiFetchResult> {
  try {
    const cabin = params.cabinClass || 'Economy';
    const currency = params.currency || 'PHP';
    const adults = params.adults ?? 1;
    const url = `${BASE_URL}/onewaytrip/${encodeURIComponent(apiKey)}/${params.originCode}/${params.destinationCode}/${params.date}/${adults}/0/0/${encodeURIComponent(cabin)}/${currency}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      const itineraries: any[] = Array.isArray(json?.itineraries) ? json.itineraries : [];
      const legs: any[] = Array.isArray(json?.legs) ? json.legs : [];
      const segments: any[] = Array.isArray(json?.segments) ? json.segments : [];
      const places = toMap(json?.places);
      const carriers = toMap(json?.carriers);

      const flights = itineraries
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
      return { flights, success: true, noFlightsFound: false };
    } else {
      console.warn('[FlightAPI] fetchFlightsFromFlightApi returned status:', res.status);
      if (res.status === 410) {
        return { flights: [], success: true, noFlightsFound: true };
      }
    }
  } catch (err: any) {
    console.warn('[FlightAPI] fetchFlightsFromFlightApi exception:', err?.message);
  }
  return { flights: [], success: false, noFlightsFound: false };
}

/** Autocomplete airports by name/city using flightapi.io's IATA lookup with backup key and Duffel fallback. */
export async function searchAirports(query: string): Promise<{ airports: FlightAirport[]; error: FlightSearchError }> {
  // 1. Try FlightAPI Key 1
  if (API_KEY) {
    console.log('[FlightAPI] searchAirports trying Primary Key...');
    const airports = await fetchAirportsFromFlightApi(query, API_KEY);
    if (airports && airports.length > 0) {
      return { airports, error: null };
    }
  }

  // 2. Try FlightAPI Key 2 (Backup)
  if (API_KEY_BACKUP) {
    console.log('[FlightAPI] searchAirports trying Backup Key...');
    const airports = await fetchAirportsFromFlightApi(query, API_KEY_BACKUP);
    if (airports && airports.length > 0) {
      return { airports, error: null };
    }
  }

  // 3. Fall back to Duffel
  if (DUFFEL_API_KEY) {
    console.log('[FlightAPI] Falling back to Duffel for searchAirports...');
    const airports = await searchAirportsDuffel(query);
    if (airports.length > 0) {
      return { airports, error: null };
    }
  }

  return { airports: [], error: (API_KEY || API_KEY_BACKUP) ? 'forbidden' : 'no-key' };
}

/** Search one-way flights and return normalized itineraries with backup key and Duffel fallback. */
export async function searchFlights(params: FlightSearchParams): Promise<{ flights: FlightItinerary[]; error: FlightSearchError }> {
  // 1. Try FlightAPI Key 1
  if (API_KEY) {
    console.log('[FlightAPI] searchFlights trying Primary Key...');
    const res = await fetchFlightsFromFlightApi(params, API_KEY);
    if (res.success) {
      return { flights: res.flights, error: null };
    }
  }

  // 2. Try FlightAPI Key 2 (Backup)
  if (API_KEY_BACKUP) {
    console.log('[FlightAPI] searchFlights trying Backup Key...');
    const res = await fetchFlightsFromFlightApi(params, API_KEY_BACKUP);
    if (res.success) {
      return { flights: res.flights, error: null };
    }
  }

  // 3. Fall back to Duffel
  if (DUFFEL_API_KEY) {
    console.log('[FlightAPI] Falling back to Duffel for searchFlights...');
    const flights = await searchFlightsDuffel(params);
    if (flights.length > 0) {
      return { flights, error: null };
    }
  }

  return { flights: [], error: (API_KEY || API_KEY_BACKUP) ? 'forbidden' : 'no-key' };
}
