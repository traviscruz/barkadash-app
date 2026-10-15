// Shared AI assistant pieces used by both the Gemini and Groq chat brains.
import { searchPlacesNear, NearbyPlace } from './googlePlaces';
import { getWeatherForPlace, WeatherInfo } from './weatherService';

export interface TripContext {
  title?: string;
  destination?: string;
  dateRange?: string;
}

export interface ChatMessageLike {
  sender: 'user' | 'ai';
  text: string;
}

export type ChatToolResult =
  | { type: 'weather'; weather: WeatherToolData }
  | { type: 'places'; places: PlaceToolData[] };

export type WeatherToolData = WeatherInfo;
export type PlaceToolData = NearbyPlace;

export interface NaviReply {
  text: string;
  tools: ChatToolResult[];
}

export const SEARCH_PLACES_DECL = {
  name: 'search_places',
  description:
    'Search Google Places for real, up-to-date spots (restaurants, cafes, hotels, activities, attractions) around a location. Use this whenever the user asks for recommendations or places to eat/stay/visit.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'What to look for, e.g. "seafood restaurant", "island hopping tour", "beachfront cafe", "hotel".',
      },
      location: {
        type: 'string',
        description: 'The city or area to search in, e.g. "El Nido, Palawan".',
      },
    },
    required: ['query'],
  },
};

export const GET_WEATHER_DECL = {
  name: 'get_weather',
  description:
    'Get the current weather (temperature, conditions, humidity, wind) for a place. Use this when the user asks about weather, rain, temperature, or what to pack.',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'The city or place to get weather for, e.g. "El Nido".',
      },
    },
    required: ['location'],
  },
};

export const SUGGEST_ITINERARY_DECL = {
  name: 'suggest_itinerary_items',
  description:
    'Suggest a structured itinerary for specific days of a trip. Use this whenever the user asks "suggest day 1", "what should we do on day 2", or wants a scheduled day plan. This returns individual spot suggestion cards with scheduled times.',
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'The list of scheduled activities for the itinerary.',
        items: {
          type: 'object',
          properties: {
            placeName: {
              type: 'string',
              description: 'The name of the place, spot, or activity (e.g. "Lila Cafe", "Cebu Taoist Temple").',
            },
            suggestedTime: {
              type: 'string',
              description: 'The suggested time in format "H:MM AM/PM", e.g. "8:00 AM", "10:30 AM", "1:00 PM".',
            },
            suggestedDay: {
              type: 'number',
              description: 'The day number of the trip (e.g. 1, 2, 3).',
            },
            description: {
              type: 'string',
              description: 'Brief description of what to do (e.g. "Hearty local breakfast").',
            },
            query: {
              type: 'string',
              description: 'A search query to locate this spot on Google Maps (e.g. "Lila Cafe El Nido").',
            },
          },
          required: ['placeName', 'suggestedTime', 'suggestedDay', 'query'],
        },
      },
    },
    required: ['items'],
  },
};

export const getCountryForDestination = (dest?: string): string => {
  if (!dest) return 'Philippines';
  const d = dest.toLowerCase();
  if (d.includes('japan') || d.includes('tokyo') || d.includes('osaka') || d.includes('kyoto') || d.includes('hokkaido')) return 'Japan';
  if (d.includes('korea') || d.includes('seoul') || d.includes('busan') || d.includes('jeju')) return 'South Korea';
  if (d.includes('indonesia') || d.includes('bali') || d.includes('jakarta')) return 'Indonesia';
  if (d.includes('thailand') || d.includes('bangkok') || d.includes('phuket') || d.includes('chiang mai')) return 'Thailand';
  if (d.includes('vietnam') || d.includes('danang') || d.includes('hanoi') || d.includes('ho chi minh')) return 'Vietnam';
  if (d.includes('singapore')) return 'Singapore';
  if (d.includes('taiwan') || d.includes('taipei')) return 'Taiwan';
  if (d.includes('france') || d.includes('paris')) return 'France';
  if (d.includes('italy') || d.includes('rome')) return 'Italy';
  if (d.includes('spain') || d.includes('barcelona') || d.includes('madrid')) return 'Spain';
  if (d.includes('usa') || d.includes('united states') || d.includes('new york') || d.includes('california') || d.includes('hawaii')) return 'United States';
  return 'Philippines';
};

export const buildSystemPrompt = (trip?: TripContext): string => {
  const destination = trip?.destination?.trim();
  const country = destination ? getCountryForDestination(destination) : 'Philippines';

  const lines: string[] = [
    'You are Navi, the friendly AI trip navigator built into Barkadash — a Filipino app where a barkada (friend group) plans group trips together.',
    'Speak warmly and conversationally, in a practical, easy-to-read style. You may mix in light Filipino expressions (Mabuhay, Kain tayo!, Tara!, Walang anuman!). Do NOT use any emojis in your response.',
    '',
    '== MANDATORY REPLY RULE ==',
    'After calling ANY tool (search_places, get_weather, suggest_itinerary_items) you MUST ALWAYS write a friendly, helpful text reply to the user. NEVER end your turn after a tool call without a text message — the user is waiting for your answer!',
    'If a tool returns no results, acknowledge it honestly and still give useful, knowledgeable advice.',
    '',
    '== HOW TO ANSWER ==',
    '- General questions (e.g. "how much is island hopping?", "what is the best time to visit?", "what to pack?"): Answer directly from your knowledge. No tool call needed.',
    '- Recommendation requests (e.g. "suggest restaurants", "best beaches", "where to stay"): Call search_places, then write a brief intro text.',
    '- Itinerary requests (e.g. "suggest Day 1", "make an itinerary", "what do we do on day 2"): Call suggest_itinerary_items with all spots for that day, then write a helpful summary.',
    '- Weather questions: Call get_weather, then summarize conditions in your reply.',
    '- Budget / transport / tips questions: Answer directly with practical info.',
  ];

  if (destination) {
    lines.push('');
    lines.push('== ACTIVE TRIP — STRICT GEOGRAPHIC LOCK ==');
    if (trip?.title) lines.push(`Trip: ${trip.title}`);
    lines.push(`Destination: ${destination}, ${country}`);
    if (trip?.dateRange) lines.push(`Dates: ${trip.dateRange}`);
    lines.push('');
    lines.push('== GEOGRAPHIC RULES — ZERO TOLERANCE ==');
    lines.push(`RULE 1 — LOCATION LOCK: Every single place you mention (restaurant, cafe, hotel, beach, activity, attraction) MUST physically exist inside "${destination}, ${country}". No exceptions.`);
    lines.push(`RULE 2 — NO OUTSIDE PLACES EVER: NEVER suggest places in other cities, provinces, islands, or countries. If the trip is in El Nido, NEVER mention Manila, Cebu, Siargao, Boracay, or any foreign country. If the trip is in Baguio, NEVER mention Metro Manila or Cebu. This rule applies even if the user does not specify — always default to the locked destination.`);
    lines.push(`RULE 3 — SEARCH_PLACES TOOL: Always set location="${destination}, ${country}" and include "${destination}" in the query field.`);
    lines.push(`RULE 4 — SUGGEST_ITINERARY_ITEMS TOOL: Always include "${destination}" in every item's query field (e.g. query: "Nacpan Beach, ${destination}").`);
    lines.push(`RULE 5 — REDIRECT: If the user asks about a place outside ${destination}, politely redirect: "Our trip is set for ${destination} — I am keeping all my recommendations inside ${destination}! Want ideas here instead?"`);
  } else {
    lines.push('');
    lines.push('== NO DESTINATION SET YET ==');
    lines.push('If the user mentions a specific destination (e.g. "planning a trip to Boracay"), focus 100% of your suggestions on that destination and country. Never mix in places from other locations.');
  }

  lines.push('');
  lines.push('== FORMATTING RULES ==');
  lines.push('1. You only SUGGEST ideas. Do NOT create, confirm, finalize, or book itineraries, votes, or reservations.');
  lines.push('2. Keep answers concise and practical — barkada-sized.');
  lines.push('3. Use **bold** for place names, prices, and key numbers. Start each recommendation on its own line with a "- " bullet.');
  lines.push('4. After a tool call, the app renders rich cards automatically. Keep your text reply SHORT — a brief intro or quick summary only. Do NOT repeat all the place details the cards already show.');
  lines.push('5. NEVER use emojis (😊 🏝️ 🍽️ ⏰ etc.). Use clean text and light markdown only. The app UI handles icons.');

  return lines.join('\n');
};

export const executeTool = async (name: string, args: any, trip?: TripContext): Promise<any> => {
  const activeDest = trip?.destination?.trim();

  if (name === 'search_places') {
    const explicitLoc = typeof args?.location === 'string' ? args.location.trim() : '';
    const resolvedLoc = activeDest || explicitLoc;
    const query = typeof args?.query === 'string' ? args.query.trim() : '';

    const result = await searchPlacesNear(query, resolvedLoc);
    if (result.error || result.places.length === 0) {
      return { error: result.error || 'no-results', message: `No places found in ${resolvedLoc || 'that area'}.` };
    }
    return { places: result.places };
  }

  if (name === 'get_weather') {
    const loc = typeof args?.location === 'string' && args.location.trim() ? args.location.trim() : activeDest;
    const result = await getWeatherForPlace(loc || '');
    if (result.error || !result.weather) {
      return { error: result.error || 'not-found', message: 'Weather unavailable for that place.' };
    }
    return result.weather;
  }

  if (name === 'suggest_itinerary_items') {
    const items = Array.isArray(args?.items) ? args.items : [];
    const promises = items.map(async (item: any) => {
      const rawQuery = typeof item.query === 'string' && item.query.trim() ? item.query.trim() : (item.placeName || '');
      // Always append destination so place search is geographically scoped
      const baseQuery =
        activeDest && !rawQuery.toLowerCase().includes(activeDest.toLowerCase())
          ? `${rawQuery} ${activeDest}`
          : rawQuery;
      const suggestedDay = typeof item.suggestedDay === 'number' ? item.suggestedDay : 1;
      const suggestedTime = typeof item.suggestedTime === 'string' ? item.suggestedTime : '';

      try {
        const result = await searchPlacesNear(baseQuery, activeDest);
        if (!result.error && result.places.length > 0) {
          return {
            ...result.places[0],
            // Override name with what the AI suggested, not necessarily the geocoder result
            name: result.places[0].name || item.placeName,
            suggestedDay,
            suggestedTime,
          };
        }
      } catch (e) {
        console.warn('Places search error during itinerary suggestions:', e);
      }

      // Fallback: return the AI-suggested name with destination in address
      return {
        placeId: '',
        name: item.placeName,
        address: activeDest ? `${item.placeName}, ${activeDest}` : (item.description || item.placeName || ''),
        rating: 4.8,
        userRatingsTotal: 120,
        priceLevel: 2,
        suggestedDay,
        suggestedTime,
      };
    });
    const placesList = await Promise.all(promises);
    return { places: placesList };
  }

  return { error: 'unknown-tool', message: `Unknown tool: ${name}` };
};

export const textReply = (text: string): NaviReply => ({ text, tools: [] });
