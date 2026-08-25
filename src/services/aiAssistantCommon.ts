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

export const buildSystemPrompt = (trip?: TripContext): string => {
  const destination = trip?.destination?.trim();
  const lines: string[] = [
    'You are Navi, the friendly AI trip navigator built into Barkadash — a Filipino app where a barkada (friend group) plans group trips together.',
    'Speak warmly and conversationally, in a practical, easy-to-read style. You may mix in light Filipino expressions (Mabuhay, Kain tayo!, Tara!, Walang anuman!). Do NOT use any emojis in your response.',
  ];

  if (destination) {
    lines.push('');
    lines.push('ACTIVE TRIP CONTEXT (the group\u2019s locked-in trip):');
    if (trip?.title) lines.push(`- Trip title: ${trip.title}`);
    lines.push(`- Destination: ${destination}`);
    if (trip?.dateRange) lines.push(`- Dates: ${trip.dateRange}`);
    lines.push(`This is the ONLY place you should focus your recommendations on.`);
  }

  lines.push('');
  lines.push('BEHAVIOR RULES:');
  lines.push('1. Focus all suggestions on the active trip destination.');
  lines.push(
    '2. If the user asks about a place clearly outside the active trip destination (e.g. a cafe or restaurant in another city or country), you may briefly acknowledge it and give a short helpful answer, BUT you must clearly and politely remind them that this place is outside the active trip and that your suggestions are focused on the trip destination.'
  );
  lines.push(
    '3. If the user is rude, uses profanity or curse words, or messages disrespectfully, stay calm, kind, and professional. Gently set the boundary and steer back to helping: identify yourself as Navi, offer to help with the trip, and never mirror their tone.'
  );
  lines.push('4. You only SUGGEST ideas. Do NOT create, confirm, finalize, or book itineraries, votes, or reservations.');
  lines.push('5. Use the provided tools for real data: search_places for real spots, get_weather for current weather, and suggest_itinerary_items when the user wants an itinerary plan or scheduled day-level activity suggestions. If a tool errors or returns nothing, say so honestly and still be helpful.');
  lines.push('6. Keep answers concise and practical — barkada-sized.');
  lines.push(
    '7. FORMATTING: Use light markdown so the app can style your reply nicely. Use **bold** for place names, prices, and key numbers. Start each recommendation on its own line with a "- " bullet. When the user asks about the weather, always call get_weather and mention the temperature and conditions.'
  );
  lines.push(
    '8. Whenever you call search_places, get_weather, or suggest_itinerary_items, the app will automatically show rich cards (place photos, ratings, maps links / widgets) below your text. So keep your text reply SHORT — a brief intro or quick summary only — and do NOT repeat the full list of places or details that the cards already display.'
  );
  lines.push(
    '9. ITINERARY PLANS: When the user requests an itinerary (e.g. "suggest Day 1", "what should we do on day 2?"), you MUST call suggest_itinerary_items. Populate the items list with the recommended spots, assigning them a structured suggestedDay (e.g., 1) and suggestedTime (e.g., "8:00 AM", "10:30 AM", "12:00 PM", "3:00 PM", "6:30 PM"). This will render cards with "Accept" buttons that the user can press to add that item to their itinerary instantly at that exact time!'
  );
  lines.push(
    '10. DO NOT USE EMOJIS: Never output any emoji (like 😊, 🏝️, 🍽️, ⏰) in your text responses. Rely only on clean text and light markdown formatting. The app UI handles all icons.'
  );

  return lines.join('\n');
};

export const executeTool = async (name: string, args: any): Promise<any> => {
  if (name === 'search_places') {
    const result = await searchPlacesNear(
      typeof args?.query === 'string' ? args.query : '',
      typeof args?.location === 'string' ? args.location : undefined
    );
    if (result.error || result.places.length === 0) {
      return { error: result.error || 'no-results', message: 'No places found for that search.' };
    }
    return { places: result.places };
  }

  if (name === 'get_weather') {
    const result = await getWeatherForPlace(typeof args?.location === 'string' ? args.location : '');
    if (result.error || !result.weather) {
      return { error: result.error || 'not-found', message: 'Weather unavailable for that place.' };
    }
    return result.weather;
  }

  if (name === 'suggest_itinerary_items') {
    const items = Array.isArray(args?.items) ? args.items : [];
    const promises = items.map(async (item: any) => {
      const q = typeof item.query === 'string' ? item.query : item.placeName;
      const suggestedDay = typeof item.suggestedDay === 'number' ? item.suggestedDay : 1;
      const suggestedTime = typeof item.suggestedTime === 'string' ? item.suggestedTime : '';
      try {
        const result = await searchPlacesNear(q);
        if (!result.error && result.places.length > 0) {
          return {
            ...result.places[0],
            suggestedDay,
            suggestedTime,
          };
        }
      } catch (e) {
        console.warn('Google Places search error during itinerary suggestions:', e);
      }
      return {
        placeId: '',
        name: item.placeName,
        address: item.description || '',
        rating: null,
        userRatingsTotal: null,
        priceLevel: null,
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
