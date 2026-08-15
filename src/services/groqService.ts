// Groq-powered fallback for the Navi chat brain (OpenAI-compatible API).
// Used when the primary Gemini brain fails, so the user never sees a Gemini error.
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

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const MODEL = process.env.EXPO_PUBLIC_GROQ_MODEL || 'llama-3.3-70b-versatile';

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const OPENAI_TOOLS = [SEARCH_PLACES_DECL, GET_WEATHER_DECL].map((decl) => ({
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
  if (!GROQ_KEY) {
    throw new Error('Missing EXPO_PUBLIC_GROQ_API_KEY');
  }

  let current = buildMessages(messages, trip);
  if (current.length === 1) {
    return textReply(
      "Mabuhay! I'm Navi, your barkada trip navigator. Ask me about spots, food, weather, or how to plan your trip."
    );
  }

  const tools: ChatToolResult[] = [];

  for (let i = 0; i < 4; i++) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: current,
        tools: OPENAI_TOOLS,
        temperature: 0.8,
        top_p: 0.95,
        max_tokens: 1024,
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
        const result = await executeTool(name, args);
        if (name === 'get_weather' && result && !result.error) {
          tools.push({ type: 'weather', weather: result });
        } else if (name === 'search_places' && Array.isArray(result?.places)) {
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

  return textReply(
    "Okay, I need a bit more detail to nail that down — tell me what you're after (food, activities, weather, budget) and I'll tailor ideas for your barkada."
  );
}
