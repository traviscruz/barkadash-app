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
  SUGGEST_ITINERARY_DECL,
  buildSystemPrompt,
  executeTool,
  textReply,
} from './aiAssistantCommon';

export type {
  ChatToolResult,
  WeatherToolData,
  PlaceToolData,
} from './aiAssistantCommon';

const getGeminiKey = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const getGeminiBackup = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP || '';
const getGeminiBackup2 = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP2 || '';
const getGeminiModel = () => process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';

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

const runGemini = async (contents: any[], key: string, trip?: TripContext): Promise<NaviReply> => {
  if (!key) {
    throw new Error('Missing Gemini API Key');
  }

  const body = {
    contents,
    systemInstruction: { parts: [{ text: buildSystemPrompt(trip) }] },
    tools: [{ functionDeclarations: [SEARCH_PLACES_DECL, GET_WEATHER_DECL, SUGGEST_ITINERARY_DECL] }],
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  };

  const model = getGeminiModel();
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  let current = contents;
  const tools: ChatToolResult[] = [];
  for (let i = 0; i < 4; i++) {
    const res = await fetch(apiUrl, {
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
        } else if (name === 'suggest_itinerary_items' && Array.isArray(result?.places)) {
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

const maskKey = (k: string) => {
  if (!k) return '(none)';
  if (k.length <= 8) return '***';
  return `${k.slice(0, 6)}...${k.slice(-4)}`;
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

  const primaryKey = getGeminiKey();
  const backupKey = getGeminiBackup();
  const backup2Key = getGeminiBackup2();
  const model = getGeminiModel();

  console.log(`\n💬 [Navi Chat AI] Generating reply for ${messages.length} messages...`);

  // 1. Primary Gemini
  if (primaryKey) {
    try {
      console.log(`🟢 [Navi Chat 1/4] Trying Primary Gemini (${maskKey(primaryKey)}, Model: ${model})...`);
      const reply = await runGemini(contents, primaryKey, trip);
      console.log(`✅ [Navi Chat] Resolved via Primary Gemini!`);
      return reply;
    } catch (err: any) {
      console.warn(`❌ [Navi Chat 1/4] Primary Gemini failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [Navi Chat 1/4] Primary Gemini key is empty (EXPO_PUBLIC_GEMINI_API_KEY not set)`);
  }

  // 2. Backup 1 Gemini
  if (backupKey) {
    try {
      console.log(`🟡 [Navi Chat 2/4] Trying Backup 1 Gemini (${maskKey(backupKey)}, Model: ${model})...`);
      const reply = await runGemini(contents, backupKey, trip);
      console.log(`✅ [Navi Chat] Resolved via Backup 1 Gemini!`);
      return reply;
    } catch (err: any) {
      console.warn(`❌ [Navi Chat 2/4] Backup 1 Gemini failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [Navi Chat 2/4] Backup 1 Gemini key is empty (EXPO_PUBLIC_GEMINI_API_KEY_BACKUP not set)`);
  }

  // 3. Backup 2 Gemini
  if (backup2Key) {
    try {
      console.log(`🟡 [Navi Chat 3/4] Trying Backup 2 Gemini (${maskKey(backup2Key)}, Model: ${model})...`);
      const reply = await runGemini(contents, backup2Key, trip);
      console.log(`✅ [Navi Chat] Resolved via Backup 2 Gemini!`);
      return reply;
    } catch (err: any) {
      console.warn(`❌ [Navi Chat 3/4] Backup 2 Gemini failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [Navi Chat 3/4] Backup 2 Gemini key is empty (EXPO_PUBLIC_GEMINI_API_KEY_BACKUP2 not set)`);
  }

  // 4. Groq Fallback
  try {
    console.log(`🟠 [Navi Chat 4/4] All Gemini attempts failed. Falling back to Groq...`);
    const reply = await generateGroqReply(messages, trip);
    console.log(`✅ [Navi Chat] Resolved via Groq fallback!`);
    return reply;
  } catch (err: any) {
    console.warn(`❌ [Navi Chat 4/4] Groq fallback failed:`, err?.message);
    return textReply(
      "Mabuhay! Navi's AI is unavailable right now — I couldn't reach my brain services. Please try again in a moment."
    );
  }
}
