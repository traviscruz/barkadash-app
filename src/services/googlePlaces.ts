/**
 * Place & Geocoding Service powered by TravelTime API (https://traveltime.com/).
 * - Autocomplete & Search: TravelTime Geocoding API (/v4/geocoding/search)
 * - Reverse Geocoding: TravelTime Reverse Geocoding API (/v4/geocoding/reverse)
 */

import { requestJson } from './aiStructuredService';

const TRAVELTIME_API_KEY = process.env.EXPO_PUBLIC_TRAVELTIME_API_KEY || 'b9ed88a4831fc4a051cd76351e00ce49';
const TRAVELTIME_APP_ID = process.env.EXPO_PUBLIC_TRAVELTIME_APP_ID || '803438e6';
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
  isAiResolved?: boolean;
  category?: string;
  mapsUrl?: string;
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
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type PlaceSearchError = 'no-key' | 'api-error' | null;

export interface PlaceSearchResult {
  predictions: PlacePrediction[];
  error: PlaceSearchError;
}

export interface NearbyPlace {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  photoReference?: string;
  suggestedDay?: number;
  suggestedTime?: string;
}

export interface NearbyPlacesResult {
  places: NearbyPlace[];
  error: PlaceSearchError;
}

interface CachedPlaceData {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  photos: PlacePhoto[];
  mapsUrl?: string;
  engineSource?: 'traveltime' | 'photon' | 'ai' | 'google';
}

const placeDetailsCache = new Map<string, CachedPlaceData>();
const aiQueryCache = new Map<string, PlacePrediction[]>();
const searchQueryCache = new Map<string, PlacePrediction[]>();

const TRAVEL_PHOTOS_BY_TAG: Record<string, string[]> = {
  beach: [],
  island: [],
  hotel: [],
  food: [],
  cafe: [],
  city: [],
  nature: [],
  general: [],
};

function generateTravelPhotosForPlace(_name: string, _address: string, _explicitCategory?: string): PlacePhoto[] {
  return [];
}

const AI_PLACE_SYSTEM_PROMPT = `You are an elite global place search assistant for a travel app.
Given a search query for any destination, city, region, small shop, cafe, restaurant, resort, beach, hotel, or landmark:
Identify real-world places, local businesses, or establishments anywhere in the world (e.g. Japan, France, South Korea, Philippines, USA, etc.).
Return ONLY strict JSON with this exact structure:
{
  "places": [
    {
      "name": "Exact Venue / Landmark / City Name",
      "area": "City / District / Prefecture / Province, Country",
      "fullAddress": "Specific Address or Area, City, Country",
      "category": "attraction",
      "latitude": 35.6762,
      "longitude": 139.6503,
      "mapsUrl": "https://maps.google.com/?q=Exact+Name+Location"
    }
  ]
}
Rules:
- Provide 1 to 4 best matching real places or destinations.
- Accurately determine the real country, city, and coordinates worldwide.
- For local spots or regional businesses, accurately pinpoint their area and country.
- STRICT GEOGRAPHIC SCOPE: If a location, city, island, or region is specified (e.g. "El Nido, Palawan", "Tokyo, Japan", "Siargao"), EVERY place returned MUST be physically located in that exact specified destination and its home country. NEVER return places with similar names from other cities, provinces, or countries (e.g. never return places in Manila or Spain for El Nido).
- "category" must be one of: "city", "attraction", "nature", "beach", "hotel", "restaurant", "cafe".
- Ensure latitude and longitude are accurate numbers for the real location.`;

export async function searchWithAiAssistant(query: string, location?: string, bypassCache = false): Promise<PlacePrediction[]> {
  const cleanLoc = (location || '').trim();
  const clean = `${query} ${cleanLoc}`.trim().toLowerCase();
  if (clean.length < 2) return [];
  if (!bypassCache && aiQueryCache.has(clean)) return aiQueryCache.get(clean) || [];

  try {
    const userPrompt = cleanLoc
      ? `Provide JSON for query: "${query}" strictly located in "${cleanLoc}". Every place MUST be physically situated in "${cleanLoc}" and nowhere else.`
      : `Provide JSON for query: "${query}"`;
    const res = await requestJson<{ places: Array<any> }>(
      AI_PLACE_SYSTEM_PROMPT,
      userPrompt,
      { maxTokens: 400 }
    );

    const items = res?.data?.places;
    if (!Array.isArray(items) || items.length === 0) {
      aiQueryCache.set(clean, []);
      return [];
    }

    const predictions: PlacePrediction[] = items.map((p: any, idx: number) => {
      const name = typeof p?.name === 'string' ? p.name.trim() : query;
      const area = typeof p?.area === 'string' ? p.area.trim() : (typeof p?.country === 'string' ? p.country.trim() : '');
      const address = typeof p?.fullAddress === 'string' ? p.fullAddress.trim() : (area ? `${name}, ${area}` : name);
      const lat = typeof p?.latitude === 'number' ? p.latitude : 0;
      const lng = typeof p?.longitude === 'number' ? p.longitude : 0;
      const category = typeof p?.category === 'string' ? p.category : 'general';
      const mapsUrl = typeof p?.mapsUrl === 'string' ? p.mapsUrl : `https://maps.google.com/?q=${encodeURIComponent(name + ' ' + (area || ''))}`;
      const placeId = `ai_${idx}_${encodeURIComponent(name.toLowerCase().replace(/\s+/g, '_'))}`;

      placeDetailsCache.set(placeId, {
        placeId,
        name,
        address,
        lat,
        lng,
        mapsUrl,
        photos: generateTravelPhotosForPlace(name, address, category),
        engineSource: 'ai',
      });

      return {
        placeId,
        mainText: name,
        secondaryText: area,
        isAiResolved: true,
        category,
        mapsUrl,
      };
    });

    aiQueryCache.set(clean, predictions);
    return predictions;
  } catch {
    // Fail quietly without crashing or spamming console
    aiQueryCache.set(clean, []);
    return [];
  }
}

/**
 * On-Demand Explicit AI Look Up function triggered by the user's "Look up with AI" button.
 */
export async function searchPlacesWithAi(
  query: string,
  locationOrBypass?: string | boolean,
  bypassCache = false
): Promise<PlaceSearchResult> {
  const clean = query?.trim();
  if (!clean || clean.length < 2) return { predictions: [], error: null };

  const location = typeof locationOrBypass === 'string' ? locationOrBypass.trim() : undefined;
  const bypass = typeof locationOrBypass === 'boolean' ? locationOrBypass : bypassCache;

  const cacheKey = `${clean} ${location || ''}`.trim().toLowerCase();
  if (!bypass && aiQueryCache.has(cacheKey)) {
    const cached = aiQueryCache.get(cacheKey) || [];
    if (cached.length > 0) {
      console.log(`\n✨ [Exact Location Lookup] Query: "${clean}" (⚡ Cache Hit - 0 AI requests used)`);
      return { predictions: cached, error: null };
    }
  }
  console.log(`\n✨ [Exact Location Lookup] Query: "${clean}" Location: "${location || 'any'}"`);
  const predictions = await searchWithAiAssistant(clean, location, bypass);
  if (predictions.length > 0) {
    console.log(`   ✨ [Exact Location Result] Found ${predictions.length} matching places (Top: "${predictions[0].mainText}")`);
    return { predictions, error: null };
  }
  return { predictions: [], error: null };
}

/**
 * Combined Fast Typeahead Search (TravelTime -> Photon -> AI fallback).
 */
export async function searchPlaces(input: string): Promise<PlaceSearchResult> {
  const query = input?.trim();
  if (!query || query.length < 2) {
    return { predictions: [], error: null };
  }

  const cacheKey = query.toLowerCase();
  if (searchQueryCache.has(cacheKey)) {
    const cached = searchQueryCache.get(cacheKey) || [];
    console.log(`\n📍 [Location Search] Query: "${query}" (⚡ Cache Hit - 0 API requests used)`);
    return { predictions: cached, error: null };
  }

  console.log(`\n📍 [Location Search] Query: "${query}"`);

  // 1. Google Places if active
  if (GOOGLE_API_KEY) {
    try {
      const params = new URLSearchParams({
        input: query,
        key: GOOGLE_API_KEY,
        language: 'en',
      });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'OK' && Array.isArray(json.predictions) && json.predictions.length > 0) {
        const predictions = json.predictions
          .map((p: any) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text || p.description || '',
            secondaryText: p.structured_formatting?.secondary_text || '',
          }))
          .filter((p: PlacePrediction) => p.mainText);
        if (predictions.length > 0) {
          console.log(`   🟢 [Engine: Google Places] Found ${predictions.length} places (e.g. "${predictions[0].mainText}")`);
          searchQueryCache.set(cacheKey, predictions);
          return { predictions, error: null };
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Fast Global TravelTime Search
  let ttResults: PlacePrediction[] = [];
  if (TRAVELTIME_API_KEY && TRAVELTIME_APP_ID) {
    try {
      // Query TravelTime globally without restricting to country
      const url = `https://api.traveltimeapp.com/v4/geocoding/search?query=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: {
          'X-Application-Id': TRAVELTIME_APP_ID,
          'X-Api-Key': TRAVELTIME_API_KEY,
          'Accept-Language': 'en-US',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const features = data?.features || [];
        ttResults = features.map((f: any, idx: number) => {
          const props = f.properties || {};
          const rawLabel = props.label || props.name || query;
          const parts = rawLabel.split(',').map((p: string) => p.trim()).filter(Boolean);
          const mainText = parts[0] || props.name || query;
          const secondaryText = parts.length > 1 ? parts.slice(1).join(', ') : (props.country || '');
          const placeId = props.id ? String(props.id) : `tt_${idx}_${encodeURIComponent(mainText)}`;
          const lng = typeof f.geometry?.coordinates?.[0] === 'number' ? f.geometry.coordinates[0] : 0;
          const lat = typeof f.geometry?.coordinates?.[1] === 'number' ? f.geometry.coordinates[1] : 0;

          placeDetailsCache.set(placeId, {
            placeId,
            name: mainText,
            address: rawLabel,
            lat,
            lng,
            mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(rawLabel)}`,
            photos: generateTravelPhotosForPlace(mainText, rawLabel),
            engineSource: 'traveltime',
          });

          return { placeId, mainText, secondaryText };
        });
      }
    } catch {
      // Ignore
    }
  }

  // 3. Fast Global Photon / OSM Geocoder (POIs, venues, landmarks, districts worldwide)
  let photonResults: PlacePrediction[] = [];
  // Run Photon if TravelTime returned fewer than 4 results to enrich suggestions, or as primary fallback
  if (ttResults.length < 4) {
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en`);
      if (res.ok) {
        const data = await res.json();
        const features = data?.features || [];
        if (features.length > 0) {
          photonResults = features.map((f: any, idx: number) => {
            const props = f.properties || {};
            const placeId = `photon_${props.osm_id || idx}`;
            const mainText = props.name || props.street || query;
            const secondaryParts = [props.city || props.district, props.state, props.country].filter(Boolean);
            const secondaryText = secondaryParts.join(', ') || props.country || '';
            const lng = typeof f.geometry?.coordinates?.[0] === 'number' ? f.geometry.coordinates[0] : 0;
            const lat = typeof f.geometry?.coordinates?.[1] === 'number' ? f.geometry.coordinates[1] : 0;

            placeDetailsCache.set(placeId, {
              placeId,
              name: mainText,
              address: secondaryText ? `${mainText}, ${secondaryText}` : mainText,
              lat,
              lng,
              mapsUrl: `https://maps.google.com/?q=${encodeURIComponent(mainText + ' ' + secondaryText)}`,
              photos: generateTravelPhotosForPlace(mainText, secondaryText),
              engineSource: 'photon',
            });

            return { placeId, mainText, secondaryText };
          });
        }
      }
    } catch {
      // Ignore
    }
  }

  // Combine and deduplicate predictions
  const combined: PlacePrediction[] = [];
  const seenKeys = new Set<string>();

  const addPrediction = (p: PlacePrediction) => {
    const key = `${p.mainText.toLowerCase()}__${(p.secondaryText || '').toLowerCase().slice(0, 15)}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      combined.push(p);
    }
  };

  ttResults.forEach(addPrediction);
  photonResults.forEach(addPrediction);

  if (combined.length > 0) {
    const results = combined.slice(0, 8);
    console.log(`   🌍 [Global Location Search] Found ${results.length} locations (Top: "${results[0].mainText} - ${results[0].secondaryText}")`);
    searchQueryCache.set(cacheKey, results);
    return { predictions: results, error: null };
  }

  console.log(`   ⚪ [Location Search] No direct match for "${query}"`);
  searchQueryCache.set(cacheKey, []);
  return { predictions: [], error: null };
}

/**
 * Fetch full details (display name, formatted address, cover photos) for a chosen place.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceSelection | null> {
  if (!placeId) return null;

  const cached = placeDetailsCache.get(placeId);
  if (cached) {
    const srcTag = cached.engineSource === 'ai'
      ? '✨ AI Smart Finder'
      : cached.engineSource === 'traveltime'
      ? '🟣 TravelTime API'
      : cached.engineSource === 'photon'
      ? '🔵 Photon/OSM'
      : '🟢 Google Places';
    console.log(`📌 [Place Picked via ${srcTag}] "${cached.name}" (${cached.lat.toFixed(4)}, ${cached.lng.toFixed(4)}) - ${cached.address}`);
    return {
      placeId: cached.placeId,
      name: cached.name,
      address: cached.address,
      photoReference: cached.photos[0]?.reference,
      photos: cached.photos,
      latitude: cached.lat,
      longitude: cached.lng,
      mapsUrl: cached.mapsUrl,
    };
  }

  if (GOOGLE_API_KEY && !placeId.startsWith('tt_') && !placeId.startsWith('photon_')) {
    try {
      const params = new URLSearchParams({
        place_id: placeId,
        fields: 'place_id,name,formatted_address,geometry,photos',
        key: GOOGLE_API_KEY,
      });
      const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
      const json = await res.json();
      if (json.status === 'OK' && json.result) {
        const r = json.result;
        const photos: PlacePhoto[] = (r.photos || []).map((ph: any) => ({
          reference: ph.photo_reference,
          width: ph.width || 0,
          height: ph.height || 0,
        }));
        return {
          placeId: r.place_id || placeId,
          name: r.name || '',
          address: r.formatted_address || '',
          photoReference: photos[0]?.reference,
          photos: photos.length > 0 ? photos : generateTravelPhotosForPlace(r.name || '', r.formatted_address || ''),
          latitude: r.geometry?.location?.lat,
          longitude: r.geometry?.location?.lng,
        };
      }
    } catch {
      // Fallback
    }
  }

  return {
    placeId,
    name: 'Selected Location',
    address: '',
    photos: [],
  };
}

/**
 * Resolve Place ID to lat/lng coordinates.
 */
export async function getPlaceLatLng(placeId: string): Promise<LatLng | null> {
  if (!placeId) return null;
  const cached = placeDetailsCache.get(placeId);
  if (cached) {
    return { latitude: cached.lat, longitude: cached.lng };
  }
  const details = await getPlaceDetails(placeId);
  if (details && details.latitude && details.longitude) {
    return { latitude: details.latitude, longitude: details.longitude };
  }
  return null;
}

/**
 * Check if a destination is located in the Philippines
 */
export function isPhilippineDestination(location?: string): boolean {
  if (!location) return true;
  const l = location.toLowerCase();
  const foreign = [
    'japan', 'tokyo', 'osaka', 'kyoto', 'korea', 'seoul', 'busan',
    'indonesia', 'bali', 'thailand', 'bangkok', 'phuket', 'vietnam',
    'singapore', 'taiwan', 'france', 'paris', 'italy', 'rome',
    'spain', 'barcelona', 'madrid', 'usa', 'united states', 'california',
    'hawaii', 'new york', 'australia', 'sydney', 'canada'
  ];
  return !foreign.some((f) => l.includes(f));
}

/**
 * Returns all acceptable region-level keywords that confirm a result belongs
 * to the given Philippine destination (destination name + province + region + country).
 * A geocoder result MUST contain at least one of these.
 */
function getPhilippineLocationAliases(dest: string): string[] {
  const d = dest.toLowerCase();
  // Each entry: [destination keyword, ...accepted aliases in geocoder output]
  const map: Array<[string, string[]]> = [
    ['el nido',   ['el nido', 'palawan', 'mimaropa', 'philippines']],
    ['palawan',   ['palawan', 'mimaropa', 'philippines']],
    ['boracay',   ['boracay', 'malay', 'aklan', 'western visayas', 'philippines']],
    ['siargao',   ['siargao', 'surigao del norte', 'caraga', 'philippines']],
    ['baguio',    ['baguio', 'benguet', 'cordillera', 'philippines']],
    ['cebu',      ['cebu', 'central visayas', 'philippines']],
    ['davao',     ['davao', 'davao del sur', 'philippines']],
    ['iloilo',    ['iloilo', 'western visayas', 'philippines']],
    ['manila',    ['manila', 'metro manila', 'ncr', 'national capital', 'philippines']],
    ['quezon',    ['quezon', 'metro manila', 'ncr', 'philippines']],
    ['batangas',  ['batangas', 'calabarzon', 'philippines']],
    ['tagaytay',  ['tagaytay', 'cavite', 'calabarzon', 'philippines']],
    ['camiguin',  ['camiguin', 'northern mindanao', 'philippines']],
    ['dumaguete', ['dumaguete', 'negros oriental', 'central visayas', 'philippines']],
    ['coron',     ['coron', 'palawan', 'mimaropa', 'philippines']],
    ['puerto princesa', ['puerto princesa', 'palawan', 'mimaropa', 'philippines']],
  ];
  for (const [key, aliases] of map) {
    if (d.includes(key)) return aliases;
  }
  // Generic PH fallback — just require "Philippines" appears somewhere
  return ['philippines'];
}

/**
 * Filter places so they STRICTLY belong to the requested destination.
 *
 * Strategy:
 *  1. POSITIVE CHECK — the geocoder result's address/secondaryText must contain
 *     at least one of the destination's known region aliases (e.g. "boracay",
 *     "aklan", "western visayas", "philippines"). Generic results like
 *     "Beach Area, Kerala, India" fail immediately because they contain none.
 *  2. NEGATIVE CHECK — even if step 1 passes, reject any result that explicitly
 *     mentions a foreign country or a different Philippine city.
 */
export function isPlaceMatchingDestination(
  place: { name?: string; address?: string; secondaryText?: string },
  location?: string
): boolean {
  if (!location || !location.trim()) return true;

  const secondary = (place.secondaryText || '').toLowerCase();
  const addr = (place.address || '').toLowerCase();
  const combined = `${secondary} ${addr}`;

  if (isPhilippineDestination(location)) {
    // POSITIVE CHECK: result must mention the destination or one of its regional aliases
    const aliases = getPhilippineLocationAliases(location);
    const passesPositive = aliases.some((alias) => combined.includes(alias));
    if (!passesPositive) return false;

    // NEGATIVE CHECK: hard-reject known foreign countries
    const foreignKeywords = [
      'spain', 'españa', 'united states', 'usa', 'mexico', 'china',
      'thailand', 'egypt', 'united arab emirates', 'uae', 'brazil', 'greece',
      'czechia', 'poland', 'india', 'myanmar', 'france', 'italy', 'indonesia',
      'vietnam', 'japan', 'korea', 'germany', 'united kingdom', 'uk', 'australia',
      'canada', 'singapore', 'taiwan', 'sierra leone', 'colombia', 'nepal',
      'croatia', 'georgia', 'florida', 'california', 'new york', 'illinois',
      'texas', 'ohio'
    ];
    if (foreignKeywords.some((fk) => combined.includes(fk))) return false;

    // NEGATIVE CHECK: reject results belonging to other Philippine islands/cities
    const loc = location.toLowerCase();
    if (loc.includes('el nido') || loc.includes('palawan')) {
      const exclude = ['manila', 'quezon city', 'makati', 'taguig', 'cebu', 'davao', 'baguio', 'boracay', 'siargao', 'iloilo'];
      if (exclude.some((m) => combined.includes(m))) return false;
    } else if (loc.includes('siargao')) {
      const exclude = ['manila', 'quezon city', 'cebu', 'palawan', 'el nido', 'boracay', 'baguio', 'davao'];
      if (exclude.some((m) => combined.includes(m))) return false;
    } else if (loc.includes('boracay')) {
      const exclude = ['manila', 'quezon city', 'makati', 'cebu', 'palawan', 'el nido', 'siargao', 'baguio', 'davao'];
      if (exclude.some((m) => combined.includes(m))) return false;
    } else if (loc.includes('baguio')) {
      const exclude = ['manila', 'quezon city', 'cebu', 'palawan', 'el nido', 'siargao', 'boracay', 'davao'];
      if (exclude.some((m) => combined.includes(m))) return false;
    } else if (loc.includes('cebu')) {
      const exclude = ['manila', 'quezon city', 'palawan', 'el nido', 'siargao', 'boracay', 'baguio', 'davao'];
      if (exclude.some((m) => combined.includes(m))) return false;
    }
  } else {
    // International destination: must positively match country or city name
    const words = location.toLowerCase().split(',').map((w) => w.trim()).filter(Boolean);
    const hasMatch = words.some((w) => w.length > 2 && combined.includes(w));
    if (!hasMatch) return false;
  }

  return true;
}

/**
 * Find spots (restaurants, hotels, attractions, activities) strictly around a place.
 */
export async function searchPlacesNear(query: string, location?: string): Promise<NearbyPlacesResult> {
  const cleanLoc = (location || '').trim();
  const fullQuery = cleanLoc && !query.toLowerCase().includes(cleanLoc.toLowerCase())
    ? `${query} ${cleanLoc}`
    : query;

  console.log(`\n🔍 [searchPlacesNear] Query: "${query}", Location: "${cleanLoc}" -> Full: "${fullQuery}"`);
  const res = await searchPlaces(fullQuery);

  // Filter results strictly matching the destination and country
  let validPredictions = (res.predictions || []).filter((p) => {
    const cached = placeDetailsCache.get(p.placeId);
    return isPlaceMatchingDestination(
      {
        name: p.mainText,
        secondaryText: p.secondaryText,
        address: cached?.address || '',
      },
      cleanLoc
    );
  });

  // If TravelTime / Photon had 0 results matching the strict destination, fall back to AI Place Assistant
  if (validPredictions.length === 0 && cleanLoc) {
    console.log(`   ⚡ [searchPlacesNear] No strict location matches from geocoders for "${cleanLoc}". Falling back to AI Place Finder.`);
    const aiPredictions = await searchWithAiAssistant(query, cleanLoc, true);
    validPredictions = aiPredictions.filter((p) => {
      const cached = placeDetailsCache.get(p.placeId);
      return isPlaceMatchingDestination(
        {
          name: p.mainText,
          secondaryText: p.secondaryText,
          address: cached?.address || '',
        },
        cleanLoc
      );
    });
  }

  const places: NearbyPlace[] = validPredictions.slice(0, 5).map((p, idx) => {
    const cached = placeDetailsCache.get(p.placeId);
    return {
      placeId: p.placeId,
      name: p.mainText,
      address: p.secondaryText || cached?.address || (cleanLoc ? `${p.mainText}, ${cleanLoc}` : ''),
      rating: Math.round((4.6 + (idx % 3) * 0.1) * 10) / 10,
      userRatingsTotal: 150 + idx * 30,
      priceLevel: (idx % 3) + 1,
      photoReference: cached?.photos?.[0]?.reference || '',
    };
  });

  return { places, error: null };
}

/**
 * Build a Place Photo URL from a stored photo reference or travel image.
 */
export function getPlacePhotoUrl(photoReference?: string, maxWidth = 1200): string {
  if (!photoReference) {
    return '';
  }
  if (photoReference.startsWith('http://') || photoReference.startsWith('https://')) {
    return photoReference;
  }
  if (GOOGLE_API_KEY) {
    const params = new URLSearchParams({
      maxwidth: String(maxWidth),
      photo_reference: photoReference,
      key: GOOGLE_API_KEY,
    });
    return `https://maps.googleapis.com/maps/api/place/photo?${params.toString()}`;
  }
  return '';
}

