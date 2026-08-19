// Amadeus hotel search (optional). Used by the Explore "Staycation" tab to
// find real hotel / stay options. If the Amadeus key isn't configured or the
// request fails, callers gracefully fall back to Google Places instead.
const AMADEUS_KEY = process.env.EXPO_PUBLIC_AMADEUS_API_KEY || '';
const AMADEUS_SECRET = process.env.EXPO_PUBLIC_AMADEUS_API_SECRET || '';
const BASE = 'https://test.api.amadeus.com';

export interface StaycationListing {
  id: string;
  name: string;
  address: string;
  rating: number | null;
  pricePerNight: number | null;
  currency: string;
  distanceKm: number | null;
}

export const amadeusConfigured = Boolean(AMADEUS_KEY && AMADEUS_SECRET);

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!AMADEUS_KEY || !AMADEUS_SECRET) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) return cachedToken.value;

  try {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: AMADEUS_KEY,
      client_secret: AMADEUS_SECRET,
    });
    const res = await fetch(`${BASE}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) {
      console.warn('Amadeus token error:', res.status);
      return null;
    }
    const json = await res.json();
    const token = json?.access_token;
    const expiresIn = Number(json?.expires_in || 1800) * 1000;
    if (token) cachedToken = { value: token, expiresAt: Date.now() + expiresIn };
    return token || null;
  } catch (err: any) {
    console.warn('Amadeus token exception:', err?.message);
    return null;
  }
}

async function searchCityCode(token: string, keyword: string): Promise<{ code: string; name: string } | null> {
  try {
    const params = new URLSearchParams({ keyword, max: '1' });
    const res = await fetch(`${BASE}/v1/reference-data/locations/cities?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const city = json?.data?.[0];
    if (!city?.iataCode) return null;
    return { code: city.iataCode, name: city.name || keyword };
  } catch (err: any) {
    console.warn('Amadeus city search exception:', err?.message);
    return null;
  }
}

async function searchHotels(token: string, cityCode: string): Promise<any[]> {
  try {
    const params = new URLSearchParams({ cityCode });
    const res = await fetch(`${BASE}/v1/reference-data/locations/hotels/by-city?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data) ? json.data.slice(0, 10) : [];
  } catch (err: any) {
    console.warn('Amadeus hotel search exception:', err?.message);
    return [];
  }
}

async function getOffers(token: string, hotelIds: string[]): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (hotelIds.length === 0) return map;
  try {
    const now = new Date();
    const plus = (days: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };
    const params = new URLSearchParams({
      hotelIds: hotelIds.join(','),
      checkInDate: plus(1),
      checkOutDate: plus(2),
      adults: '1',
      currency: 'USD',
    });
    const res = await fetch(`${BASE}/v1/shopping/hotel-offers?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return map;
    const json = await res.json();
    for (const offer of Array.isArray(json?.data) ? json.data : []) {
      const id = offer?.hotel?.hotelId;
      if (!id) continue;
      const price = offer?.offers?.[0]?.price?.total;
      map.set(id, { price: Number(price), currency: offer?.offers?.[0]?.price?.currency || 'USD' });
    }
    return map;
  } catch (err: any) {
    console.warn('Amadeus offers exception:', err?.message);
    return map;
  }
}

/**
 * Search staycation / hotel options for a place using Amadeus. Returns null
 * when Amadeus isn't configured or the whole flow fails, so the caller can
 * fall back to Google Places.
 */
export async function searchStaycationAmadeus(location: string): Promise<StaycationListing[] | null> {
  if (!amadeusConfigured) return null;

  const token = await getToken();
  if (!token) return null;

  const city = await searchCityCode(token, location);
  if (!city) return null;

  const hotels = await searchHotels(token, city.code);
  if (hotels.length === 0) return null;

  const offers = await getOffers(token, hotels.map((h) => h.hotelId));

  return hotels
    .filter((h) => h?.hotelId && h?.name)
    .map((h) => ({
      id: h.hotelId,
      name: h.name,
      address: h?.address?.lines?.join(', ') || city.name,
      rating: h?.rating ? Number(h.rating) : null,
      pricePerNight: offers.get(h.hotelId)?.price ?? null,
      currency: offers.get(h.hotelId)?.currency || 'USD',
      distanceKm: h?.distance?.value ? Number(h.distance.value) : null,
    }));
}