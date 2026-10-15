/**
 * ignavService.ts
 * ---------------
 * Thin wrapper around the Ignav Flight Prices API (https://ignav.com/docs).
 * Uses exact request/response field names from the official docs.
 *
 * One-way search request body fields:
 *   origin, destination, departure_date, adults, cabin_class, market
 *
 * Response itinerary fields:
 *   ignav_id, price.amount, price.currency, price.status,
 *   outbound[] (carrier_code, flight_number, departure_airport, arrival_airport,
 *               departure_at, arrival_at, duration_minutes, stops)
 *
 * Airport fields: code, name, city, country
 *
 * Booking-links request: { ignav_id }
 * Booking-links response items: url, provider_name, provider_type
 */

const IGNAV_BASE_URL = 'https://ignav.com';
const getApiKey = (): string => process.env.EXPO_PUBLIC_IGNAV_API_KEY || '';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IgnavAirport {
  code: string;
  name: string;
  city: string;
  country: string;
}

export interface IgnavSegment {
  carrier_code: string;
  flight_number: string;
  departure_airport: string;
  arrival_airport: string;
  departure_at: string;
  arrival_at: string;
  duration_minutes: number;
  stops: number;
}

export interface IgnavItinerary {
  ignav_id: string;
  price: {
    amount: number;
    currency: string;
    status: string;
  };
  outbound: IgnavSegment[];
}

export interface IgnavBookingOption {
  url: string;
  provider_name: string;
  provider_type: string;
  fare_name?: string;
  price?: { amount: number; currency: string };
}

// ─── Simple in-memory cache (10-minute TTL) ──────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const _fareCache = new Map<string, CacheEntry<IgnavItinerary[]>>();
const _bookingCache = new Map<string, CacheEntry<IgnavBookingOption[]>>();
const CACHE_TTL_MS = 4 * 60 * 1000; // 4 minutes to ensure ignav_id stays valid on Ignav servers

function fareCacheKey(origin: string, dest: string, date: string, adults: number): string {
  return `${origin}-${dest}-${date}-${adults}`;
}

function getFromFareCache(key: string): IgnavItinerary[] | null {
  const entry = _fareCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _fareCache.delete(key); return null; }
  return entry.data;
}

function setFareCache(key: string, data: IgnavItinerary[]): void {
  _fareCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function getFromBookingCache(ignavId: string): IgnavBookingOption[] | null {
  const entry = _bookingCache.get(ignavId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _bookingCache.delete(ignavId); return null; }
  return entry.data;
}

function setBookingCache(ignavId: string, data: IgnavBookingOption[]): void {
  _bookingCache.set(ignavId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ignavHeaders(): Record<string, string> {
  return {
    'X-Api-Key': getApiKey(),
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** GET /api/airports?q=<query>&limit=10 */
export async function ignavSearchAirports(query: string): Promise<IgnavAirport[]> {
  if (!getApiKey()) return [];
  try {
    const url = `${IGNAV_BASE_URL}/api/airports?q=${encodeURIComponent(query)}&limit=10`;
    console.log('[Ignav] searchAirports ->', url);
    const res = await fetchWithTimeout(url, { headers: ignavHeaders() });
    if (!res.ok) { console.warn('[Ignav] searchAirports status', res.status); return []; }
    const json = await res.json();
    const raw: any[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
    return raw
      .map((a) => ({
        code: String(a.code || '').toUpperCase(),
        name: String(a.name || ''),
        city: String(a.city || ''),
        country: String(a.country || ''),
      }))
      .filter((a) => a.code && a.name);
  } catch (err: any) {
    console.warn('[Ignav] searchAirports error:', err?.message);
    return [];
  }
}

/**
 * POST /api/fares/one-way
 * Returns null on total failure (network, timeout, auth).
 * Returns [] if API succeeded but no itineraries found.
 */
export async function ignavSearchOneWay(params: {
  origin: string;
  destination: string;
  departure_date: string;
  adults?: number;
  cabin_class?: string;
  market?: string;
}): Promise<IgnavItinerary[] | null> {
  if (!getApiKey()) {
    console.warn('[Ignav] No API key — skipping Ignav provider.');
    return null;
  }

  const adults = params.adults ?? 1;
  const cacheKey = fareCacheKey(params.origin, params.destination, params.departure_date, adults);
  const cached = getFromFareCache(cacheKey);
  if (cached) {
    console.log('[Ignav] Cache HIT for', cacheKey, '— serving from cache');
    return cached;
  }

  const body = {
    origin: params.origin,
    destination: params.destination,
    departure_date: params.departure_date,
    adults,
    cabin_class: params.cabin_class ?? 'economy',
    market: params.market ?? 'PH',
  };

  try {
    const url = `${IGNAV_BASE_URL}/api/fares/one-way`;
    console.log('[Ignav] searchOneWay -> POST', url, JSON.stringify(body));
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers: ignavHeaders(), body: JSON.stringify(body) },
      10_000,
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('[Ignav] searchOneWay HTTP', res.status, errText);
      return null;
    }

    const json = await res.json();
    const raw: any[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.itineraries)
      ? json.itineraries
      : [];

    const itineraries: IgnavItinerary[] = raw
      .filter((it) => it?.ignav_id && it?.price?.amount != null)
      .map((it) => {
        let segmentsRaw: any[] = [];
        if (Array.isArray(it.outbound)) {
          segmentsRaw = it.outbound;
        } else if (it.outbound && typeof it.outbound === 'object') {
          segmentsRaw = Array.isArray(it.outbound.segments)
            ? it.outbound.segments
            : [];
        }

        const segments: IgnavSegment[] = segmentsRaw.map((seg: any) => ({
          carrier_code: String(
            seg.marketing_carrier_code || seg.carrier_code || seg.airline_code || ''
          ).toUpperCase(),
          flight_number: String(seg.flight_number || ''),
          departure_airport: String(
            seg.departure_airport || seg.origin || ''
          ).toUpperCase(),
          arrival_airport: String(
            seg.arrival_airport || seg.destination || ''
          ).toUpperCase(),
          departure_at: String(
            seg.departure_time_local || seg.departure_at || seg.departs_at || ''
          ),
          arrival_at: String(
            seg.arrival_time_local || seg.arrival_at || seg.arrives_at || ''
          ),
          duration_minutes: Number(seg.duration_minutes ?? 0),
          stops: Number(seg.stops ?? 0),
        }));

        return {
          ignav_id: String(it.ignav_id),
          price: {
            amount: Number(it.price.amount),
            currency: String(it.price.currency || 'PHP'),
            status: String(it.price.status || 'confirmed'),
          },
          outbound: segments,
        };
      });

    console.log('[Ignav] searchOneWay returned', itineraries.length, 'itineraries');
    setFareCache(cacheKey, itineraries);
    return itineraries;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Ignav] searchOneWay TIMED OUT (10 s)');
    } else {
      console.warn('[Ignav] searchOneWay error:', err?.message);
    }
    return null;
  }
}

/**
 * POST /api/fares/booking-links  { ignav_id }
 * Returns [] on any failure; caller falls back to airline site table.
 */
export async function ignavFetchBookingLinks(ignav_id: string): Promise<IgnavBookingOption[]> {
  if (!getApiKey() || !ignav_id) return [];

  const cached = getFromBookingCache(ignav_id);
  if (cached) {
    console.log('[Ignav] booking-links cache HIT for', ignav_id);
    return cached;
  }

  try {
    const url = `${IGNAV_BASE_URL}/api/fares/booking-links`;
    console.log('[Ignav] fetchBookingLinks -> POST', url, { ignav_id });
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', headers: ignavHeaders(), body: JSON.stringify({ ignav_id }) },
      10_000,
    );

    if (!res.ok) {
      console.warn('[Ignav] fetchBookingLinks HTTP', res.status);
      return [];
    }

    const json = await res.json();
    const rawOptions: any[] = Array.isArray(json?.booking_options)
      ? json.booking_options
      : Array.isArray(json)
      ? json
      : [];

    const options: IgnavBookingOption[] = [];
    for (const opt of rawOptions) {
      // In Ignav docs & live response: each booking option has an array of `links`
      if (Array.isArray(opt?.links)) {
        for (const link of opt.links) {
          if (link?.url) {
            options.push({
              url: String(link.url),
              provider_name: String(link.provider_name || ''),
              provider_type: String(link.provider_type || 'ota'),
              fare_name: link.fare_name ? String(link.fare_name) : undefined,
              price: link.price
                ? { amount: Number(link.price.amount), currency: String(link.price.currency) }
                : undefined,
            });
          }
        }
      } else if (opt?.url) {
        options.push({
          url: String(opt.url),
          provider_name: String(opt.provider_name || ''),
          provider_type: String(opt.provider_type || 'ota'),
          fare_name: opt.fare_name ? String(opt.fare_name) : undefined,
          price: opt.price
            ? { amount: Number(opt.price.amount), currency: String(opt.price.currency) }
            : undefined,
        });
      }
    }

    setBookingCache(ignav_id, options);
    return options;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      console.warn('[Ignav] fetchBookingLinks TIMED OUT (10 s)');
    } else {
      console.warn('[Ignav] fetchBookingLinks error:', err?.message);
    }
    return [];
  }
}
