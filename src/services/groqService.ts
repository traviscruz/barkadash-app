// Groq-powered fallback for the Navi chat brain (OpenAI-compatible API).
// Used when the primary Gemini brain fails, so the user never sees a Gemini error.
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

const getGroqKey = () => process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const getGroqModels = () => {
  const custom = process.env.EXPO_PUBLIC_GROQ_MODEL;
  // Only models confirmed available on this Groq key (verified via /v1/models).
  // openai/gpt-oss-120b: best quality, full OpenAI-format tool calling support.
  // openai/gpt-oss-20b: fast fallback, also supports tool calling.
  // qwen/qwen3.8-27b: last resort (has OTPM limits but does work).
  const list = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
  // Only prepend custom if it's a real model different from our list
  if (custom && !list.includes(custom) && !custom.includes('compound') && !custom.includes('groq/')) {
    return [custom, ...list];
  }
  return list;
};

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const OPENAI_TOOLS = [SEARCH_PLACES_DECL, GET_WEATHER_DECL, SUGGEST_ITINERARY_DECL].map((decl) => ({
  type: 'function',
  function: decl,
}));

const buildMessages = (messages: ChatMessageLike[], trip?: TripContext): any[] => {
  const msgs: any[] = [{ role: 'system', content: buildSystemPrompt(trip) }];
  let firstContent = true;
  for (const m of messages) {
    const text = m.text.trim();
    if (!text) continue;
    const role = m.sender === 'ai' ? 'assistant' : 'user';
    if (firstContent && role === 'assistant') continue;
    firstContent = false;
    msgs.push({ role, content: text });
  }
  return msgs;
};

export async function generateGroqReply(
  messages: ChatMessageLike[],
  trip?: TripContext
): Promise<NaviReply> {
  const groqKey = getGroqKey();
  if (!groqKey) {
    throw new Error('Missing EXPO_PUBLIC_GROQ_API_KEY');
  }

  let current = buildMessages(messages, trip);
  if (current.length === 1) {
    return textReply(
      "Mabuhay! I'm Navi, your barkada trip navigator. Ask me about spots, food, weather, or how to plan your trip."
    );
  }

  const models = getGroqModels();
  for (const model of models) {
    try {
      const reply = await runGroqWithModel(model, current, trip, groqKey);
      if (reply) return reply;
    } catch (err: any) {
      console.warn(`Groq model ${model} failed:`, err?.message);
    }
  }

  return textReply(
    "Oops, I got a bit tangled up there! Could you ask again? Whether it is food spots, beaches, hotels, or a full day itinerary, I am here to help you plan the perfect barkada trip."
  );
}

async function runGroqWithModel(
  model: string,
  messages: any[],
  trip?: TripContext,
  apiKey?: string
): Promise<NaviReply | null> {
  const groqKey = apiKey || getGroqKey();
  let current = messages;
  const tools: ChatToolResult[] = [];

  for (let i = 0; i < 6; i++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model,
        messages: current,
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 800,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('Groq HTTP error:', res.status, errText.slice(0, 300));
      throw new Error(`Groq HTTP ${res.status}`);
    }

    const json = await res.json();
    const message = json?.choices?.[0]?.message;
    const toolCalls = message?.tool_calls || [];

    if (toolCalls.length > 0) {
      current = [...current, message];
      for (const tc of toolCalls) {
        let args: any = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }
        const name = tc.function?.name;
        const result = await executeTool(name, args, trip);
        if (name === 'get_weather' && result && !result.error) {
          tools.push({ type: 'weather', weather: result });
        } else if (name === 'search_places' && Array.isArray(result?.places)) {
          tools.push({ type: 'places', places: result.places });
        } else if (name === 'suggest_itinerary_items' && Array.isArray(result?.places)) {
          tools.push({ type: 'places', places: result.places });
        }
        current = [
          ...current,
          { role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) },
        ];
      }
      continue;
    }

    const content = message?.content?.trim();
    if (content) return { text: content, tools };
  }

  return null;
}
