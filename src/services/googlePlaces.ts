const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlacePhoto {
  reference: string;
  width: number;
  height: number;
}

export interface PlaceSelection {
  placeId: string;
  name: string;
  address: string;
  photoReference?: string;
  photos?: PlacePhoto[];
}

/**
 * Rank photos: prefer large, landscape shots (these read best as covers).
 */
const rankPhoto = (p: PlacePhoto): number => {
  const area = (p.width || 1) * (p.height || 1);
  const landscape = (p.width || 0) >= (p.height || 0) ? 1.4 : 0.7;
  return area * landscape;
};

const pickBestPhoto = (photos: PlacePhoto[]): PlacePhoto | undefined =>
  [...photos]
    .filter((p) => p.width >= 200 && p.height >= 150)
    .sort((a, b) => rankPhoto(b) - rankPhoto(a))[0] || photos[0];

export type PlaceSearchError = 'no-key' | 'api-error' | null;

export interface PlaceSearchResult {
  predictions: PlacePrediction[];
  error: PlaceSearchError;
}

/**
 * Typeahead search against the Google Places (legacy) Autocomplete API.
 * Returns a lightweight list of predictions plus a reason when nothing
 * comes back so callers can tell a missing key, a rejected API request,
 * and a genuinely empty result apart. The key must be exposed in the app
 * via EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.
 */
export async function searchPlaces(input: string): Promise<PlaceSearchResult> {
  if (!API_KEY) {
    console.warn('searchPlaces: EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set');
    return { predictions: [], error: 'no-key' };
  }
  try {
    const params = new URLSearchParams({
      input,
      key: API_KEY,
      language: 'en',
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
    const json = await res.json();
    if (json.status !== 'OK' || !Array.isArray(json.predictions)) {
      console.warn('searchPlaces error:', json.status, json.error_message || '');
      return { predictions: [], error: 'api-error' };
    }
    const predictions = json.predictions
      .map((p: any) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || p.description || '',
        secondaryText: p.structured_formatting?.secondary_text || '',
      }))
      .filter((p: PlacePrediction) => p.mainText);
    return { predictions, error: null };
  } catch (err: any) {
    console.warn('searchPlaces exception:', err?.message);
    return { predictions: [], error: 'api-error' };
  }
}

/**
 * Fetch full details (display name, formatted address, first photo) for a
 * chosen place so we can store metadata + a real cover photo reference.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceSelection | null> {
  if (!API_KEY) return null;
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'place_id,name,formatted_address,photos',
      key: API_KEY,
    });
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
    const json = await res.json();
    if (json.status !== 'OK' || !json.result) {
      console.warn('getPlaceDetails error:', json.status, json.error_message || '');
      return null;
    }
    const r = json.result;
    const photos: PlacePhoto[] = (r.photos || []).map((ph: any) => ({
      reference: ph.photo_reference,
      width: ph.width || 0,
      height: ph.height || 0,
    }));
    const best = pickBestPhoto(photos);
    return {
      placeId: r.place_id || placeId,
      name: r.name || '',
      address: r.formatted_address || '',
      photoReference: best?.reference,
      photos,
    };
  } catch (err: any) {
    console.warn('getPlaceDetails exception:', err?.message);
    return null;
  }
}

/**
 * Build a Google Place Photo URL from a stored photo reference.
 * The API key rides along in the query string (client-side key).
 */
export function getPlacePhotoUrl(photoReference: string, maxWidth = 1200): string {
  if (!API_KEY || !photoReference) return '';
  const params = new URLSearchParams({
    maxwidth: String(maxWidth),
    photo_reference: photoReference,
    key: API_KEY,
  });
  return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
}
