// AI structured JSON helper. Calls Gemini (Primary -> Backup 1 -> Backup 2)
// and falls back to Groq only if all Gemini backends fail.
const getGeminiKey = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const getGeminiBackup = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP || '';
const getGeminiBackup2 = () => process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP2 || '';
const getGeminiModel = () => process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';

const getGroqKey = () => process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const getGroqModels = () => {
  const custom = process.env.EXPO_PUBLIC_GROQ_MODEL;
  const list = ['qwen/qwen3.8-27b', 'qwen/qwen3.6-27b'];
  if (custom && !list.includes(custom) && !custom.includes('compound')) {
    return [custom, ...list];
  }
  return list;
};

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

const maskKey = (k: string) => {
  if (!k) return '(none)';
  if (k.length <= 8) return '***';
  return `${k.slice(0, 6)}...${k.slice(-4)}`;
};

async function runGeminiJson(apiKey: string, system: string, user: string, maxTokens = 1500): Promise<any> {
  if (!apiKey) throw new Error('Missing Gemini API Key');
  const model = getGeminiModel();
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const t0 = Date.now();
  const safeTokens = Math.max(maxTokens, 1500);
  
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
        maxOutputTokens: safeTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  const elapsed = Date.now() - t0;

  if (!res.ok) {
    const errText = await res.text();
    console.warn(`   ⚠️ [Gemini HTTP ${res.status}] (${elapsed}ms):`, errText.slice(0, 200));
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 100)}`);
  }

  const json = await res.json();
  const text = (json?.candidates?.[0]?.content?.parts || [])
    .map((p: any) => p?.text?.trim())
    .filter((t: string) => t)
    .join('\n\n');
  const parsed = extractJson(text);
  if (!parsed) {
    console.warn(`   ⚠️ [Gemini Response] Parse failed, raw output:`, text.slice(0, 250));
    return null;
  }
  console.log(`   ✨ [Gemini Response] Status: 200 OK (${elapsed}ms) - Successfully parsed JSON`);
  return parsed;
}

async function runGroqJson(system: string, user: string, maxTokens = 2048): Promise<any> {
  const groqKey = getGroqKey();
  if (!groqKey) throw new Error('Missing EXPO_PUBLIC_GROQ_API_KEY');
  const safeTokens = Math.max(1024, Math.min(maxTokens, 4096));
  const models = getGroqModels();
  let lastError: any = null;

  for (const model of models) {
    const t0 = Date.now();
    try {
      console.log(`   ⚡ [Groq Request] Model: ${model} (Key: ${maskKey(groqKey)})...`);
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${system}\nOutput valid JSON only.` },
            { role: 'user', content: user },
          ],
          temperature: 0.3,
          max_tokens: safeTokens,
          response_format: { type: 'json_object' },
        }),
      });

      const elapsed = Date.now() - t0;

      if (res.status === 404) {
        console.warn(`   ⚠️ [Groq Model ${model}] 404 Not Found, skipping to next model`);
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`   ⚠️ [Groq HTTP ${res.status}] Model ${model} (${elapsed}ms):`, errText.slice(0, 200));
        throw new Error(`Groq HTTP ${res.status}`);
      }

      const json = await res.json();
      const content = json?.choices?.[0]?.message?.content?.trim();
      const parsed = extractJson(content);
      if (parsed) {
        console.log(`   ✨ [Groq Response] 200 OK via ${model} (${elapsed}ms)`);
        return parsed;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`   ⚠️ [Groq Model ${model} Error]:`, err?.message);
    }
  }

  throw lastError || new Error('Groq JSON failed on all models');
}

export type StructuredAiSource = 'gemini' | 'groq';

export interface StructuredAiResult<T = any> {
  data: T;
  source: StructuredAiSource;
}

/**
 * Sequential Cascade:
 * 1. Primary Gemini API Key
 * 2. Backup Gemini API Key
 * 3. Backup 2 Gemini API Key
 * 4. Groq API Key (if all Gemini failed)
 */
export async function requestJson<T = any>(
  system: string,
  user: string,
  opts?: { maxTokens?: number }
): Promise<StructuredAiResult<T> | null> {
  const maxTokens = opts?.maxTokens ?? 1024;
  const primaryKey = getGeminiKey();
  const backupKey = getGeminiBackup();
  const backup2Key = getGeminiBackup2();
  const groqKey = getGroqKey();
  const model = getGeminiModel();

  console.log(`\n🚀 [AI Pipeline] Starting structured request...`);

  // 1. Primary Gemini API Key
  if (primaryKey) {
    try {
      console.log(`🟢 [AI Pipeline 1/4] Trying Primary Gemini Key (${maskKey(primaryKey)}, Model: ${model})...`);
      const data = await runGeminiJson(primaryKey, system, user, maxTokens);
      if (data) {
        console.log(`✅ [AI Pipeline] Successfully resolved via Primary Gemini API!`);
        return { data, source: 'gemini' };
      }
    } catch (err: any) {
      console.warn(`❌ [AI Pipeline 1/4] Primary Gemini failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [AI Pipeline 1/4] Primary Gemini key is empty (EXPO_PUBLIC_GEMINI_API_KEY not set)`);
  }

  // 2. Backup 1 Gemini API Key
  if (backupKey) {
    try {
      console.log(`🟡 [AI Pipeline 2/4] Trying Backup 1 Gemini Key (${maskKey(backupKey)}, Model: ${model})...`);
      const data = await runGeminiJson(backupKey, system, user, maxTokens);
      if (data) {
        console.log(`✅ [AI Pipeline] Successfully resolved via Backup 1 Gemini API!`);
        return { data, source: 'gemini' };
      }
    } catch (err: any) {
      console.warn(`❌ [AI Pipeline 2/4] Backup 1 Gemini failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [AI Pipeline 2/4] Backup 1 Gemini key is empty (EXPO_PUBLIC_GEMINI_API_KEY_BACKUP not set)`);
  }

  // 3. Backup 2 Gemini API Key
  if (backup2Key) {
    try {
      console.log(`🟡 [AI Pipeline 3/4] Trying Backup 2 Gemini Key (${maskKey(backup2Key)}, Model: ${model})...`);
      const data = await runGeminiJson(backup2Key, system, user, maxTokens);
      if (data) {
        console.log(`✅ [AI Pipeline] Successfully resolved via Backup 2 Gemini API!`);
        return { data, source: 'gemini' };
      }
    } catch (err: any) {
      console.warn(`❌ [AI Pipeline 3/4] Backup 2 Gemini failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [AI Pipeline 3/4] Backup 2 Gemini key is empty (EXPO_PUBLIC_GEMINI_API_KEY_BACKUP2 not set)`);
  }

  // 4. Groq API (Fallback if all Gemini attempts fail)
  if (groqKey) {
    try {
      console.log(`🟠 [AI Pipeline 4/4] All Gemini attempts failed. Falling back to Groq API (${maskKey(groqKey)})...`);
      const data = await runGroqJson(system, user, maxTokens);
      if (data) {
        console.log(`✅ [AI Pipeline] Successfully resolved via Groq Fallback!`);
        return { data, source: 'groq' };
      }
    } catch (err: any) {
      console.warn(`❌ [AI Pipeline 4/4] Groq fallback failed:`, err?.message);
    }
  } else {
    console.log(`⚪ [AI Pipeline 4/4] Groq key is empty (EXPO_PUBLIC_GROQ_API_KEY not set)`);
  }

  console.warn(`❌ [AI Pipeline] All AI backends failed or no valid keys configured.\n`);
  return null;
}

/** Legacy alias for backwards compatibility */
export const requestJsonRace = requestJson;