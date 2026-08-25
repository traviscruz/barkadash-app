// AI structured JSON helper. Calls Gemini first (JSON mode) and falls back to
// Groq (JSON mode) if Gemini is unavailable, so callers always get structured
// data instead of a raw chat string.
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_KEY_BACKUP = process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP || '';
const GEMINI_KEY_BACKUP2 = process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP2 || '';
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';
const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
// Groq rotates/retires models — try the configured one first, then known-good
// current models so a stale EXPO_PUBLIC_GROQ_MODEL never breaks the fallback.
const GROQ_MODELS = [
  process.env.EXPO_PUBLIC_GROQ_MODEL || 'groq/compound',
  'groq/compound',
  'groq/compound-mini',
  'openai/gpt-oss-120b',
  'qwen/qwen3.6-27b',
];

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

/** Strip markdown fences and pull the first balanced {...} block out of text. */
export function extractJson<T = any>(text: string): T | null {
  if (!text) return null;
  let cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    console.warn('extractJson parse failed:', e);
    return null;
  }
}

async function runGeminiJson(apiKey: string, system: string, user: string, maxTokens = 2048): Promise<any> {
  if (!apiKey) throw new Error('Missing Gemini API Key');
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: `${system}\n\n${user}` }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn('Gemini JSON HTTP error:', res.status, errText.slice(0, 300));
    throw new Error(`Gemini HTTP ${res.status}`);
  }

  const json = await res.json();
  const text = (json?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text?.trim())
    .filter((t: string) => t)
    .join('\n\n');
  return extractJson(text);
}

async function runGroqJson(system: string, user: string, maxTokens = 2048): Promise<any> {
  if (!GROQ_KEY) throw new Error('Missing EXPO_PUBLIC_GROQ_API_KEY');
  let lastError: any = null;

  for (const model of GROQ_MODELS) {
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          temperature: 0.4,
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        }),
      });

      if (res.status === 404) continue;

      if (!res.ok) {
        const errText = await res.text();
        console.warn('Groq JSON HTTP error:', res.status, errText.slice(0, 300));
        throw new Error(`Groq HTTP ${res.status}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content?.trim();
      const parsed = extractJson(content);
      if (parsed) return parsed;
    } catch (err: any) {
      lastError = err;
      console.warn(`Groq JSON model ${model} failed:`, err?.message);
    }
  }

  throw lastError || new Error('Groq JSON failed');
}

export type StructuredAiSource = 'gemini' | 'groq';

export interface StructuredAiResult<T = any> {
  data: T;
  source: StructuredAiSource;
}

/**
 * Ask the AI for structured JSON: Gemini first, Groq on failure.
 * Returns null when both backends fail or the output isn't valid JSON.
 */
export async function requestJson<T = any>(
  system: string,
  user: string
): Promise<StructuredAiResult<T> | null> {
  if (GEMINI_KEY) {
    try {
      const data = await runGeminiJson(GEMINI_KEY, system, user);
      if (data) return { data, source: 'gemini' };
    } catch (err: any) {
      console.warn('Primary Gemini JSON failed, falling back to backup Gemini:', err?.message);
    }
  }

  if (GEMINI_KEY_BACKUP) {
    try {
      const data = await runGeminiJson(GEMINI_KEY_BACKUP, system, user);
      if (data) return { data, source: 'gemini' };
    } catch (err: any) {
      console.warn('Backup Gemini JSON failed, falling back to second backup:', err?.message);
    }
  }

  if (GEMINI_KEY_BACKUP2) {
    try {
      const data = await runGeminiJson(GEMINI_KEY_BACKUP2, system, user);
      if (data) return { data, source: 'gemini' };
    } catch (err: any) {
      console.warn('Second Backup Gemini JSON failed, falling back to Groq:', err?.message);
    }
  }

  try {
    const data = await runGroqJson(system, user);
    if (data) return { data, source: 'groq' };
  } catch (err: any) {
    console.warn('Groq JSON fallback failed:', err?.message);
  }

  return null;
}

/**
 * Fast path for latency-sensitive callers: run Gemini and Groq concurrently and
 * resolve with whichever returns valid JSON first. Falls back to sequential
 * (Gemini → Groq) semantics when only one backend is configured.
 */
export async function requestJsonRace<T = any>(
  system: string,
  user: string,
  opts?: { maxTokens?: number }
): Promise<StructuredAiResult<T> | null> {
  const maxTokens = opts?.maxTokens ?? 2048;

  if (!GEMINI_KEY && !GEMINI_KEY_BACKUP && !GROQ_KEY) return null;

  const run = async (fn: () => Promise<any>, source: StructuredAiSource): Promise<StructuredAiResult<T> | null> => {
    try {
      const data = await fn();
      if (data) return { data, source };
    } catch (err: any) {
      console.warn(`${source} JSON race failed:`, err?.message);
    }
    return null;
  };

  const promises: Promise<StructuredAiResult<T> | null>[] = [];

  if (GEMINI_KEY) {
    promises.push(run(() => runGeminiJson(GEMINI_KEY, system, user, maxTokens), 'gemini'));
  }
  if (GEMINI_KEY_BACKUP) {
    promises.push(run(() => runGeminiJson(GEMINI_KEY_BACKUP, system, user, maxTokens), 'gemini'));
  }
  if (GEMINI_KEY_BACKUP2) {
    promises.push(run(() => runGeminiJson(GEMINI_KEY_BACKUP2, system, user, maxTokens), 'gemini'));
  }
  if (GROQ_KEY) {
    promises.push(run(() => runGroqJson(system, user, maxTokens), 'groq'));
  }

  if (promises.length === 1) {
    return promises[0];
  }

  return new Promise((resolve) => {
    let settled = false;
    let remaining = promises.length;

    const settle = (res: StructuredAiResult<T> | null) => {
      if (settled) return;
      if (res) {
        settled = true;
        resolve(res);
        return;
      }
      remaining -= 1;
      if (remaining === 0) resolve(null);
    };

    for (const p of promises) {
      p.then(settle, () => settle(null));
    }
  });
}