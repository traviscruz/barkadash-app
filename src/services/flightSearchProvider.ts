/**
 * flightSearchProvider.ts
 * -----------------------
 * Provider layer that unifies Ignav (Tier 1) and FlightAPI.io (Tier 2/3)
 * into one normalized shape consumed by FlightTab.tsx.
 *
 * SEARCH PRIORITY
 * ───────────────
 * Tier 1: Ignav — prioritise PR (Philippine Airlines) and 5J (Cebu Pacific).
 *         Fetch booking-links for direct airline URLs.
 *         If results exist but no PR/5J flights, still show them (Tier 2 path).
 * Tier 3: If Ignav fails entirely → fall back to existing FlightAPI.io flow.
 *
 * The normalized FlightResult shape is displayed by the updated FlightTab UI.
 */

import {
  ignavSearchOneWay,
  ignavFetchBookingLinks,
  IgnavItinerary,
  IgnavBookingOption,
} from './ignavService';
import { searchFlights as flightApiSearch, FlightSearchParams } from './flightapiService';

// ─── Airline look-up table ───────────────────────────────────────────────────
// Maps IATA carrier code → official airline website (no Skyscanner, ever).

export const AIRLINE_WEBSITE: Record<string, string> = {
  '5J': 'https://www.cebupacificair.com',
  PR:  'https://www.philippineairlines.com',
  Z2:  'https://www.airasia.com',
  AK:  'https://www.airasia.com',
  QZ:  'https://www.airasia.com',
  D7:  'https://www.airasia.com',
  SG:  'https://www.spicejet.com',
  '6E': 'https://www.goindigo.in',
  SQ:  'https://www.singaporeair.com',
  CX:  'https://www.cathaypacific.com',
  EK:  'https://www.emirates.com',
  QR:  'https://www.qatarairways.com',
  MH:  'https://www.malaysiaairlines.com',
  TG:  'https://www.thaiairways.com',
  GA:  'https://www.garuda-indonesia.com',
  JL:  'https://www.jal.com',
  NH:  'https://www.ana.co.jp/en/us',
  KE:  'https://www.koreanair.com',
  OZ:  'https://www.flyasiana.com',
  CI:  'https://www.china-airlines.com',
  BR:  'https://www.evaair.com',
  CA:  'https://www.airchina.com',
  MU:  'https://en.ceair.com',
  UA:  'https://www.united.com',
  AA:  'https://www.aa.com',
  DL:  'https://www.delta.com',
  BA:  'https://www.britishairways.com',
  LH:  'https://www.lufthansa.com',
  AF:  'https://www.airfrance.com',
  KL:  'https://www.klm.com',
  FR:  'https://www.ryanair.com',
  U2:  'https://www.easyjet.com',
  W6:  'https://www.wizzair.com',
  QG:  'https://www.citilink.co.id',
  IN:  'https://www.nam-air.co.id',
  IW:  'https://www.wings-air.co.id',
  PQ:  'https://www.airphilippines.com',
  RP:  'https://www.flypalawan.com',
  DG:  'https://www.flydg.com',
  RH:  'https://www.royalaircharter.com.ph',
};

/** Get the fallback website URL for a carrier code. */
export function airlineWebsite(carrierCode: string): string {
  return AIRLINE_WEBSITE[carrierCode?.toUpperCase()] || '';
}

// ─── Priority airlines ────────────────────────────────────────────────────────

const PRIORITY_CARRIERS = new Set(['PR', '5J']);

export function isPriorityCarrier(code: string): boolean {
  return PRIORITY_CARRIERS.has(code?.toUpperCase());
}

// ─── Normalized result shape ──────────────────────────────────────────────────

export interface FlightResult {
  id: string;
  airline: string;
  airlineCode: string;
  logo: string;
  departTime: string;    // ISO datetime string
  arriveTime: string;    // ISO datetime string
  durationMinutes: number;
  stops: number;
  price: number;
  priceFormatted: string;
  currency: string;
  bookingUrl: string;
  bookingLabel: string;  // e.g. "Book on Cebu Pacific"
  provider: 'ignav' | 'flightapi';
  isPriority: boolean;   // true for PR / 5J
  noDirectBookingLink: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  PHP: '₱', USD: '$', EUR: '€', GBP: '£', SGD: 'S$',
  MYR: 'RM', IDR: 'Rp', THB: '฿', JPY: '¥', AUD: 'A$',
};

function formatMoney(amount: number, currency: string): string {
  const sym = CURRENCY_SYMBOLS[currency] || `${currency} `;
  return `${sym}${Math.round(amount).toLocaleString()}`;
}

/** Airline IATA → display name lookup (best-effort). */
const AIRLINE_NAMES: Record<string, string> = {
  '5J': 'Cebu Pacific',
  PR:  'Philippine Airlines',
  Z2:  'AirAsia Philippines',
  AK:  'AirAsia',
  SQ:  'Singapore Airlines',
  CX:  'Cathay Pacific',
  EK:  'Emirates',
  QR:  'Qatar Airways',
  MH:  'Malaysia Airlines',
  TG:  'Thai Airways',
  GA:  'Garuda Indonesia',
  JL:  'Japan Airlines',
  NH:  'ANA',
  KE:  'Korean Air',
  OZ:  'Asiana Airlines',
  CI:  'China Airlines',
  BR:  'EVA Air',
  CX2: 'Cathay Pacific',
  LH:  'Lufthansa',
  BA:  'British Airways',
  AF:  'Air France',
  KL:  'KLM',
};

function airlineName(code: string): string {
  return AIRLINE_NAMES[code?.toUpperCase()] || code || 'Unknown Airline';
}

function airlineLogo(code: string): string {
  if (!code) return '';
  // Duffel CDN hosts public airline logos indexed by IATA code
  return `https://assets.duffel.com/img/airlines/for-light-background/full-color-logo/${code.toUpperCase()}.png`;
}

function bookingLabel(airlineName: string): string {
  return `Book on ${airlineName}`;
}

// ─── Tier 1: Ignav → normalize ───────────────────────────────────────────────

async function normalizeIgnavResults(
  itineraries: IgnavItinerary[],
): Promise<FlightResult[]> {
  const results: FlightResult[] = [];

  for (const it of itineraries) {
    const firstSeg = it.outbound[0];
    const lastSeg = it.outbound[it.outbound.length - 1] ?? firstSeg;
    if (!firstSeg) continue;

    const code = firstSeg.carrier_code?.toUpperCase() ?? '';
    const name = airlineName(code);
    const priority = isPriorityCarrier(code);

    const fallbackUrl = airlineWebsite(code);
    const totalDuration = it.outbound.reduce((acc, seg) => acc + (seg.duration_minutes ?? 0), 0);
    const totalStops = it.outbound.reduce((acc, seg) => acc + (seg.stops ?? 0), 0) + Math.max(0, it.outbound.length - 1);

    results.push({
      id: it.ignav_id,
      airline: name,
      airlineCode: code,
      logo: airlineLogo(code),
      departTime: firstSeg.departure_at,
      arriveTime: lastSeg.arrival_at,
      durationMinutes: totalDuration,
      stops: totalStops,
      price: it.price.amount,
      priceFormatted: formatMoney(it.price.amount, it.price.currency),
      currency: it.price.currency,
      bookingUrl: fallbackUrl,
      bookingLabel: bookingLabel(name),
      provider: 'ignav',
      isPriority: priority,
      noDirectBookingLink: !fallbackUrl,
    });
  }

  // Sort: priority airlines first (PR, 5J), then by price ascending
  results.sort((a, b) => {
    if (a.isPriority && !b.isPriority) return -1;
    if (!a.isPriority && b.isPriority) return 1;
    return a.price - b.price;
  });

  // Background prefetch direct booking links for top 3 results without blocking UI
  results.slice(0, 3).forEach((r) => {
    ignavFetchBookingLinks(r.id).then((opts) => {
      const direct = opts.find((o) => o.provider_type === 'airline')?.url || opts[0]?.url;
      if (direct && !/skyscanner/i.test(direct)) {
        r.bookingUrl = direct;
      }
    }).catch(() => {});
  });

  return results;
}

/**
 * Resolves the most accurate direct booking URL for a flight on click.
 * For Ignav flights, queries the live booking-links endpoint for the exact airline deep-link.
 * Falls back to the airline official site lookup table.
 * Never redirects to Skyscanner.
 */
export async function resolveBookingUrl(flight: FlightResult): Promise<string> {
  if (flight.provider === 'ignav' && flight.id) {
    try {
      const bookingOptions: IgnavBookingOption[] = await ignavFetchBookingLinks(flight.id);
      if (bookingOptions.length > 0) {
        const airlineLink = bookingOptions.find((o) => o.provider_type === 'airline');
        const url = airlineLink?.url ?? bookingOptions[0]?.url;
        if (url && !/skyscanner/i.test(url)) {
          flight.bookingUrl = url;
          return url;
        }
      }
    } catch (err: any) {
      console.warn('[Provider] Error resolving booking link:', err?.message);
    }
  }

  if (flight.bookingUrl && !/skyscanner/i.test(flight.bookingUrl)) {
    return flight.bookingUrl;
  }

  const fallback = airlineWebsite(flight.airlineCode);
  flight.bookingUrl = fallback;
  return fallback;
}

// ─── Tier 3: FlightAPI.io → normalize ────────────────────────────────────────

function normalizeFlightApiResults(
  itineraries: Awaited<ReturnType<typeof flightApiSearch>>['flights'],
): FlightResult[] {
  return itineraries.map((f) => {
    const code = (f.flightNumber?.split(' ')[0] ?? '').toUpperCase();
    const name = f.airline || airlineName(code) || 'Unknown Airline';

    // NEVER use Skyscanner — resolve from look-up table or drop the link
    let bookingUrl = f.deeplink ?? '';
    const isSkyscanner = /skyscanner/i.test(bookingUrl);
    if (isSkyscanner || !bookingUrl) {
      bookingUrl = airlineWebsite(code);
    }

    return {
      id: f.id,
      airline: name,
      airlineCode: code,
      logo: f.airlineLogo ?? airlineLogo(code),
      departTime: f.departure,
      arriveTime: f.arrival,
      durationMinutes: f.durationMinutes,
      stops: f.stopCount,
      price: f.priceRaw,
      priceFormatted: f.priceFormatted,
      currency: f.currency,
      bookingUrl,
      bookingLabel: bookingLabel(name),
      provider: 'flightapi',
      isPriority: isPriorityCarrier(code),
      noDirectBookingLink: !bookingUrl,
    };
  });
}

// ─── Public search function ───────────────────────────────────────────────────

export interface UnifiedSearchParams {
  originCode: string;
  destinationCode: string;
  date: string;         // YYYY-MM-DD
  adults?: number;
  currency?: string;
  limit?: number;
}

export interface UnifiedSearchResult {
  results: FlightResult[];
  tier: 1 | 2 | 3;
  noPriorityFlights: boolean;  // true when Ignav returned results but no PR/5J
  error: string | null;
}

/**
 * Main provider entry-point called by FlightTab.
 *
 * Tier 1 — Ignav has PR or 5J results  → return them + other airlines sorted below
 * Tier 2 — Ignav has results but no PR/5J → return all Ignav results + note
 * Tier 3 — Ignav fails entirely          → fall back to FlightAPI.io unchanged
 */
export async function searchFlightsUnified(
  params: UnifiedSearchParams,
): Promise<UnifiedSearchResult> {
  // ── Tier 1 / 2: Try Ignav ──────────────────────────────────────────────────
  console.log('[Provider] Starting flight search for', params.originCode, '->', params.destinationCode, params.date);
  console.log('[Provider] Tier 1: Trying Ignav...');

  const ignavRaw = await ignavSearchOneWay({
    origin: params.originCode,
    destination: params.destinationCode,
    departure_date: params.date,
    adults: params.adults ?? 1,
    market: 'PH',
  });

  if (ignavRaw !== null) {
    if (ignavRaw.length > 0) {
      console.log('[Provider] Ignav returned', ignavRaw.length, 'itinerary/ies — normalizing...');
      const results = await normalizeIgnavResults(ignavRaw.slice(0, params.limit ?? 10));

      const hasPriority = results.some((r) => r.isPriority);
      const tier = hasPriority ? 1 : 2;

      if (hasPriority) {
        console.log('[Provider] TIER 1 served — Ignav with PR/5J results');
      } else {
        console.log('[Provider] TIER 2 served — Ignav results (no PR/5J on this route/date)');
      }

      return {
        results,
        tier,
        noPriorityFlights: !hasPriority,
        error: null,
      };
    }

    // Ignav responded but returned zero results
    console.log('[Provider] Ignav returned 0 results — falling through to Tier 3');
  } else {
    console.log('[Provider] Ignav FAILED (null) — falling through to Tier 3');
  }

  // ── Tier 3: FlightAPI.io fallback ─────────────────────────────────────────
  console.log('[Provider] Tier 3: Trying FlightAPI.io...');

  const flightApiParams: FlightSearchParams = {
    originCode: params.originCode,
    destinationCode: params.destinationCode,
    date: params.date,
    adults: params.adults ?? 1,
    currency: params.currency ?? 'PHP',
    limit: params.limit ?? 10,
  };

  const flightApiRes = await flightApiSearch(flightApiParams);

  if (flightApiRes.error === 'no-key') {
    console.warn('[Provider] TIER 3 — FlightAPI.io: no key');
    return { results: [], tier: 3, noPriorityFlights: false, error: 'no-key' };
  }
  if (flightApiRes.error === 'rate-limited') {
    console.warn('[Provider] TIER 3 — FlightAPI.io: rate limited');
    return { results: [], tier: 3, noPriorityFlights: false, error: 'rate-limited' };
  }
  if (flightApiRes.error === 'forbidden') {
    console.warn('[Provider] TIER 3 — FlightAPI.io: forbidden');
    return { results: [], tier: 3, noPriorityFlights: false, error: 'forbidden' };
  }
  if (flightApiRes.error || flightApiRes.flights.length === 0) {
    console.warn('[Provider] TIER 3 — FlightAPI.io: no results');
    return { results: [], tier: 3, noPriorityFlights: false, error: 'no-results' };
  }

  console.log('[Provider] TIER 3 served — FlightAPI.io with', flightApiRes.flights.length, 'flights');
  const results = normalizeFlightApiResults(flightApiRes.flights);
  return { results, tier: 3, noPriorityFlights: false, error: null };
}
