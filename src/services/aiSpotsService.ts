// AI Suggested Spots ("Navi's suggestions") for the Spots tab.
// Smart category filters are derived from the destination; real spots come
// from the Google Places API, curated + described by the AI (Gemini), then
// cached per (trip, category) in Supabase so the AI is only re-queried when
// the user taps refresh.
import { supabase } from '../utils/supabase';
import { searchPlacesNear, NearbyPlace } from './googlePlaces';

export interface AiSpot {
  id: string;
  tripId: string;
  category: string;
  name: string;
  address: string;
  placeId: string;
  rating: number | null;
  userRatingsTotal: number | null;
  priceLevel: number | null;
  photoReference: string;
  description: string;
  matchScore: number;
  sortOrder: number;
  isFeatured: boolean;
}

export interface AiSpotCategory {
  key: string;
  label: string;
}

export const AI_SPOT_CATEGORIES: AiSpotCategory[] = [
  { key: 'DINING', label: 'Dining' },
  { key: 'CAFES', label: 'Cafes' },
  { key: 'SUNSET', label: 'Sunset' },
  { key: 'BEACH', label: 'Beach' },
  { key: 'NATURE', label: 'Nature' },
  { key: 'ADVENTURE', label: 'Adventure' },
  { key: 'HIDDEN', label: 'Hidden' },
  { key: 'NIGHTLIFE', label: 'Nightlife' },
  { key: 'CULTURE', label: 'Culture' },
  { key: 'SHOPPING', label: 'Shopping' },
  { key: 'STAYS', label: 'Stays' },
];

const CATEGORY_QUERY: Record<string, string> = {
  DINING: 'best restaurants, eateries and food spots',
  CAFES: 'best cafes and coffee shops',
  SUNSET: 'best sunset viewing spots and viewpoints',
  BEACH: 'best beaches and shorelines',
  NATURE: 'nature spots, waterfalls, lagoons and natural attractions',
  ADVENTURE: 'adventure activities, tours, island hopping and sports',
  HIDDEN: 'hidden gems, off the beaten path and local secrets',
  NIGHTLIFE: 'best bars, clubs and nightlife',
  CULTURE: 'cultural, historical and heritage sites',
  SHOPPING: 'markets, malls and shopping spots',
  STAYS: 'best hotels, resorts and stays',
};

// ---------------------------------------------------------------------------
// Smart categories — decide which filters make sense for a destination so the
// user never sees irrelevant ones (e.g. "Sunset" for a landlocked city).
// ---------------------------------------------------------------------------

const ISLAND_HINTS = [
  'island', 'beach', 'coast', 'shore', 'lagoon', 'palawan', 'el nido',
  'boracay', 'siargao', 'coron', 'balesin', 'camiguin', 'cebu', 'siqiujor',
  'siqiujor', 'bohol', 'panglao', 'camotes', 'bantayan', 'malapascua',
  'sumilon', 'apulit', 'lindumapac', 'northern luzon',
];
const NATURE_HINTS = [
  'mountain', 'hill', 'sagada', 'banaue', 'benguet', 'baguio', 'rizal',
  'pampanga', 'batangas', 'waterfall', 'falls', 'lake', 'river', 'trek',
  'hike', 'sierra madre', 'majayjay', 'tanay', 'daranak',
];
const CITY_HINTS = [
  'manila', 'makati', 'taguig', 'quezon city', 'metro manila', 'bonifacio',
  'city center', 'downtown', 'bicol', 'naga', 'davao', 'cdb', 'cagayan de oro',
  'baguio', 'iloilo', 'cebu city',
];
const NIGHTLIFE_HINTS = [...CITY_HINTS, 'beach', 'island', 'boracay', 'siargao', 'poblacion', 'malate'];

const matchHints = (dest: string, hints: string[]): boolean => {
  const d = dest.toLowerCase();
  return hints.some((h) => d.includes(h));
};

/**
 * Return the ordered list of filter categories that make sense for a given
 * destination. Always includes DINING and STAYS; the rest are added based on
 * the destination's character (coastal, mountainous, urban, nightlife…).
 */
export function getSmartCategories(destination?: string): AiSpotCategory[] {
  const dest = destination || '';
  const categories: AiSpotCategory[] = [{ key: 'DINING', label: 'Dining' }];

  const isCoastal = matchHints(dest, ISLAND_HINTS);
  const isNature = matchHints(dest, NATURE_HINTS) || isCoastal;
  const isUrban = matchHints(dest, CITY_HINTS);
  const hasNightlife = matchHints(dest, NIGHTLIFE_HINTS);

  if (isCoastal) {
    categories.push({ key: 'BEACH', label: 'Beach' });
    categories.push({ key: 'ADVENTURE', label: 'Adventure' });
  }
  if (isNature) {
    categories.push({ key: 'NATURE', label: 'Nature' });
  }
  if (isCoastal || isNature) {
    categories.push({ key: 'SUNSET', label: 'Sunset' });
  }
  if (isNature || isCoastal) {
    categories.push({ key: 'HIDDEN', label: 'Hidden' });
  }
  if (hasNightlife) {
    categories.push({ key: 'NIGHTLIFE', label: 'Nightlife' });
  }
  if (isUrban) {
    categories.push({ key: 'CULTURE', label: 'Culture' });
    categories.push({ key: 'SHOPPING', label: 'Shopping' });
  }
  categories.push({ key: 'CAFES', label: 'Cafes' });
  categories.push({ key: 'STAYS', label: 'Stays' });

  const seen = new Set<string>();
  return categories.filter((c) => {
    if (seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Database persistence
// ---------------------------------------------------------------------------

const mapRow = (row: any): AiSpot => ({
  id: row.id,
  tripId: row.trip_id,
  category: row.category,
  name: row.name || '',
  address: row.address || '',
  placeId: row.place_id || '',
  rating: row.rating ?? null,
  userRatingsTotal: row.user_ratings_total ?? null,
  priceLevel: row.price_level ?? null,
  photoReference: row.photo_reference || '',
  description: row.description || '',
  matchScore: row.match_score ?? 0,
  sortOrder: row.sort_order ?? 0,
  isFeatured: !!row.is_featured,
});

/** Load the cached AI spots for a trip + category (empty array when none). */
export async function fetchAiSpots(tripId: string, category?: string): Promise<AiSpot[]> {
  try {
    let query = supabase
      .from('trip_ai_spots')
      .select('*')
      .eq('trip_id', tripId)
      .order('sort_order', { ascending: true });
    if (category) query = query.eq('category', category);
    const { data, error } = await query;
    if (error) {
      console.warn('fetchAiSpots error:', error.message);
      return [];
    }
    return (data || []).map(mapRow);
  } catch (err: any) {
    console.warn('fetchAiSpots exception:', err?.message);
    return [];
  }
}

/** Replace the cached AI spots for a trip + category with fresh ones. */
export async function saveAiSpots(tripId: string, category: string, spots: AiSpot[]): Promise<boolean> {
  try {
    const { error: delErr } = await supabase
      .from('trip_ai_spots')
      .delete()
      .eq('trip_id', tripId)
      .eq('category', category);
    if (delErr) console.warn('saveAiSpots delete error:', delErr.message);

    if (spots.length === 0) return true;
    const rows = spots.map((s, i) => ({
      trip_id: tripId,
      category,
      name: s.name,
      address: s.address || null,
      place_id: s.placeId || null,
      rating: s.rating,
      user_ratings_total: s.userRatingsTotal,
      price_level: s.priceLevel,
      photo_reference: s.photoReference || null,
      description: s.description || null,
      match_score: s.matchScore ?? 0,
      sort_order: i,
      is_featured: s.isFeatured,
    }));
    const { error } = await supabase.from('trip_ai_spots').insert(rows);
    if (error) {
      console.warn('saveAiSpots insert error:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('saveAiSpots exception:', err?.message);
    return false;
  }
}

// ---------------------------------------------------------------------------
// AI generation (Gemini) + Google Places
// ---------------------------------------------------------------------------

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

const geminiJson = async (system: string, prompt: string): Promise<any> => {
  if (!GEMINI_KEY) throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.warn('geminiJson HTTP error:', res.status, errText.slice(0, 300));
    throw new Error(`Gemini HTTP ${res.status}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p?.text)
    .filter(Boolean)
    .join('')
    ?.trim();
  if (!text) throw new Error('Gemini empty response');
  try {
    return JSON.parse(text);
  } catch {
    // Strip code fences if the model wrapped the JSON in markdown.
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  }
};

const CURATE_SYSTEM = `You are Navi, a friendly Filipino trip navigator for a barkada (friend group) planning a trip.
You pick real Google Places spots, give each a short, lively description written for a group trip, and a match score (0-100)
for how well it fits a barkada. Keep descriptions to one or two punchy sentences. Never invent facts — only use the provided data.`;

/**
 * Generate fresh AI spots for a trip + category using Gemini to pick smart
 * search queries, Google Places for the real spots, then Gemini to describe
 * + score them. Returns the spots (persisted to Supabase via saveAiSpots).
 */
export async function generateAiSpots(
  tripId: string,
  destination: string,
  category: string
): Promise<{ spots: AiSpot[]; error: string | null }> {
  const categoryDesc = AI_SPOT_CATEGORIES.find((c) => c.key === category);
  const baseQuery = CATEGORY_QUERY[category] || 'best places';
  const label = categoryDesc?.label || category;

  try {
    // 1) Let Gemini propose 4 varied Google Places text-search queries for this
    //    category at the destination (e.g. "seafood restaurant", "sunset bar").
    let queries: string[] = [];
    try {
      const q = await geminiJson(
        'You propose Google Places text-search queries for finding spots. Reply with strict JSON: {"queries":["...","...","..."]} with 4 queries.',
        `Trip destination: ${destination}. Category: ${label} (${baseQuery}).\nPropose 4 specific, varied Google Places text-search queries that would surface the best real spots for this category here. They should be specific (e.g. "seafood restaurant", "sunset beach bar"), not generic.`
      );
      if (Array.isArray(q?.queries)) {
        queries = q.queries.slice(0, 4).map((s: string) => String(s).trim()).filter(Boolean);
      }
    } catch (err: any) {
      console.warn('generateAiSpots queries failed:', err?.message);
    }
    if (queries.length === 0) {
      queries = [baseQuery, `${label} ${destination}`];
    }

    // 2) Search Google Places for each query, dedupe, keep the strongest 8.
    const byId = new Map<string, NearbyPlace>();
    for (const query of queries) {
      const result = await searchPlacesNear(query, destination);
      for (const p of result.places) {
        if (!p.placeId || !p.name) continue;
        if (!byId.has(p.placeId)) byId.set(p.placeId, p);
      }
    }
    const candidates = [...byId.values()].sort(
      (a, b) =>
        (b.userRatingsTotal || 0) - (a.userRatingsTotal || 0) ||
        (b.rating || 0) - (a.rating || 0)
    ).slice(0, 8);

    if (candidates.length === 0) {
      return { spots: [], error: 'no-results' };
    }

    // 3) Let Gemini describe + score each candidate and pick the featured one.
    let scored: { placeId: string; description: string; matchScore: number; featured: boolean }[] = [];
    try {
      const payload = candidates.map((p, i) => ({
        i,
        name: p.name,
        address: p.address,
        rating: p.rating,
        reviews: p.userRatingsTotal,
        priceLevel: p.priceLevel,
      }));
      const s = await geminiJson(
        CURATE_SYSTEM,
        `Trip destination: ${destination}. Category: ${label}.\nHere are real Google Places candidates:\n${JSON.stringify(payload)}\n\nReply with strict JSON:\n{"spots":[{"i":0,"description":"...","matchScore":92,"featured":false}, ...]}\n- "description" is a 1-2 sentence lively blurb for a barkada group.\n- "matchScore" 0-100.\n- Set "featured":true on exactly ONE best overall pick.\n- Use the "i" field to reference candidates; include every candidate.`
      );
      if (Array.isArray(s?.spots)) {
        scored = s.spots
          .filter((x: any) => x && typeof x.i === 'number')
          .map((x: any) => ({
            placeId: candidates[x.i]?.placeId || '',
            description: String(x.description || '').trim(),
            matchScore: Math.min(100, Math.max(0, Math.round(Number(x.matchScore) || 0))),
            featured: !!x.featured,
          }))
          .filter((x: any) => x.placeId);
      }
    } catch (err: any) {
      console.warn('generateAiSpots scoring failed:', err?.message);
    }

    // 4) Assemble spots in candidate order.
    const scoredById = new Map(scored.map((x) => [x.placeId, x]));
    const hasFeatured = scored.some((x) => x.featured);
    const spots: AiSpot[] = candidates.map((p, i) => {
      const score = scoredById.get(p.placeId);
      const matchScore = score?.matchScore ?? Math.round(Math.min(96, (p.rating || 0) * 18 + 8));
      return {
        id: '',
        tripId,
        category,
        name: p.name,
        address: p.address,
        placeId: p.placeId,
        rating: p.rating,
        userRatingsTotal: p.userRatingsTotal,
        priceLevel: p.priceLevel,
        photoReference: p.photoReference || '',
        description: score?.description || (p.rating ? `Rated ${p.rating}/5 by ${p.userRatingsTotal || 'many'} travelers.` : 'A solid pick for your barkada.'),
        matchScore,
        sortOrder: i,
        isFeatured: i === 0 && !hasFeatured,
      };
    });
    if (hasFeatured) {
      const feat = scored.find((x) => x.featured);
      spots.forEach((s) => {
        s.isFeatured = s.placeId === feat?.placeId;
      });
    }

    await saveAiSpots(tripId, category, spots);
    return { spots, error: null };
  } catch (err: any) {
    console.warn('generateAiSpots exception:', err?.message);
    return { spots: [], error: err?.message || 'api-error' };
  }
}

/**
 * Ensure spots exist for a trip + category: return cached DB spots if present,
 * otherwise generate (and cache) them. Used on first open so we only hit the
 * AI when needed.
 */
export async function ensureAiSpots(
  tripId: string,
  destination: string,
  category: string
): Promise<{ spots: AiSpot[]; error: string | null; generated: boolean }> {
  const cached = await fetchAiSpots(tripId, category);
  if (cached.length > 0) return { spots: cached, error: null, generated: false };

  const result = await generateAiSpots(tripId, destination, category);
  return { ...result, generated: true };
}
