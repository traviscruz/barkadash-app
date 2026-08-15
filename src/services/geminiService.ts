// Gemini-powered Navi chat brain with function calling (primary).
// Falls back to Groq automatically if Gemini fails, so the user never sees a Gemini error.
import { generateGroqReply } from './groqService';
import {
  ChatMessageLike,
  ChatToolResult,
  NaviReply,
  TripContext,
  SEARCH_PLACES_DECL,
  GET_WEATHER_DECL,
  buildSystemPrompt,
  executeTool,
  textReply,
} from './aiAssistantCommon';

export type {
  ChatToolResult,
  WeatherToolData,
  PlaceToolData,
} from './aiAssistantCommon';

const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`;

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

const runGemini = async (contents: any[], trip?: TripContext): Promise<NaviReply> => {
  if (!GEMINI_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GEMINI_API_KEY');
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
      throw new Error(`Gemini HTTP ${res.status}`);
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
};

/**
 * Generate a Navi reply (text + any tool data like weather / places) using
 * Gemini, falling back to Groq if Gemini is unavailable.
 */
export async function generateReply(messages: ChatMessageLike[], trip?: TripContext): Promise<NaviReply> {
  const contents = buildContents(messages);
  if (contents.length === 0) {
    return textReply(
      "Mabuhay! I'm Navi, your barkada trip navigator. Ask me about spots, food, weather, or how to plan your trip."
    );
  }

  try {
    return await runGemini(contents, trip);
  } catch (err: any) {
    console.warn('Gemini failed, falling back to Groq:', err?.message);
  }

  try {
    return await generateGroqReply(messages, trip);
  } catch (err: any) {
    console.warn('Groq fallback failed:', err?.message);
    return textReply(
      "Mabuhay! Navi's AI is unavailable right now — I couldn't reach my brain services. Please try again in a moment."
    );
  }
}
