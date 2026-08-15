// Gemini-powered Navi chat brain with function calling.
// Uses: Gemini (LLM) + Google Places (search_places) + OpenWeather (get_weather).
import { searchPlacesNear, NearbyPlace } from './googlePlaces';
import { getWeatherForPlace, WeatherInfo } from './weatherService';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;

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

const SEARCH_PLACES_DECL = {
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

const GET_WEATHER_DECL = {
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

const buildSystemPrompt = (trip?: TripContext): string => {
  const destination = trip?.destination?.trim();
  const lines: string[] = [
    'You are Navi, the friendly AI trip navigator built into Barkadash — a Filipino app where a barkada (friend group) plans group trips together.',
    'Speak warmly and conversationally, in a practical, easy-to-read style. You may mix in light Filipino expressions (Mabuhay, Kain tayo!, Tara!, Walang anuman!).',
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
  lines.push('5. Use the provided tools for real data: search_places for real spots, get_weather for current weather. If a tool errors or returns nothing, say so honestly and still be helpful.');
  lines.push('6. Keep answers concise and practical — barkada-sized.');
  lines.push(
    '7. FORMATTING: Use light markdown so the app can style your reply nicely. Use **bold** for place names, prices, and key numbers. Start each recommendation on its own line with a "- " bullet. When the user asks about the weather, always call get_weather and mention the temperature and conditions.'
  );
  lines.push(
    '8. Whenever you call search_places or get_weather, the app will automatically show rich cards (place photos, ratings, maps links / a weather widget) below your text. So keep your text reply SHORT — a brief intro or quick summary only — and do NOT repeat the full list of places or details that the cards already display.'
  );

  return lines.join('\n');
};

/**
 * Convert chat history into Gemini contents. Gemini requires alternating
 * roles starting with 'user', so leading AI messages are skipped and
 * consecutive same-role turns are merged.
 */
const buildContents = (messages: ChatMessageLike[]): any[] => {
  const contents: any[] = [];
  for (const m of messages) {
    const text = m.text.trim();
    if (!text) continue;
    const role = m.sender === 'ai' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (last && last.role === role) {
      last.parts[0].text += '\n\n' + text;
    } else {
      if (role === 'model' && contents.length === 0) continue;
      contents.push({ role, parts: [{ text }] });
    }
  }
  return contents;
};

const executeTool = async (name: string, args: any): Promise<any> => {
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

  return { error: 'unknown-tool', message: `Unknown tool: ${name}` };
};

const textReply = (text: string): NaviReply => ({ text, tools: [] });

/**
 * Generate a Navi reply (text + any tool data like weather / places) for the
 * conversation using Gemini + tools.
 */
export async function generateReply(messages: ChatMessageLike[], trip?: TripContext): Promise<NaviReply> {
  if (!GEMINI_KEY) {
    return textReply(
      "Hey! I'm Navi, your trip navigator — but I need a key to think. Add EXPO_PUBLIC_GEMINI_API_KEY to your .env.local and restart the app, then we can plan your barkada trip. 😊"
    );
  }

  const contents = buildContents(messages);
  if (contents.length === 0) {
    return textReply(
      "Mabuhay! I'm Navi, your barkada trip navigator. Ask me about spots, food, weather, or how to plan your trip."
    );
  }

  const body = {
    contents,
    systemInstruction: { parts: [{ text: buildSystemPrompt(trip) }] },
    tools: [{ functionDeclarations: [SEARCH_PLACES_DECL, GET_WEATHER_DECL] }],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  };

  try {
    let current = contents;
    const tools: ChatToolResult[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, contents: current }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('Gemini HTTP error:', res.status, errText.slice(0, 300));
        return textReply(
          'Hmm, Navi hit a snag reaching the AI (HTTP ' +
            res.status +
            '). Please check your EXPO_PUBLIC_GEMINI_API_KEY and try again.'
        );
      }

      const json = await res.json();
      const candidate = json?.candidates?.[0];
      const parts: any[] = candidate?.content?.parts || [];

      const functionCalls = parts.filter((p) => p?.functionCall);
      if (functionCalls.length > 0) {
        current = [...current, candidate.content];
        const responses = [];
        for (const fc of functionCalls) {
          const result = await executeTool(fc.functionCall.name, fc.functionCall.args);
          const name = fc.functionCall.name;
          if (name === 'get_weather' && result && !result.error) {
            tools.push({ type: 'weather', weather: result });
          } else if (name === 'search_places' && Array.isArray(result?.places)) {
            tools.push({ type: 'places', places: result.places });
          }
          responses.push({
            functionResponse: {
              name,
              id: fc.functionCall.id,
              response: result,
            },
          });
        }
        current = [...current, { role: 'user', parts: responses }];
        continue;
      }

      const text = parts
        .map((p) => p?.text?.trim())
        .filter((t) => t)
        .join('\n\n');
      if (text) return { text, tools };
    }

    return textReply(
      "Okay, I need a bit more detail to nail that down — tell me what you're after (food, activities, weather, budget) and I'll tailor ideas for your barkada."
    );
  } catch (err: any) {
    console.warn('Gemini request exception:', err?.message);
    return textReply(
      "Navi's connection to the AI seems to be down right now. Please try again in a moment — I'm ready to help plan your trip!"
    );
  }
}
