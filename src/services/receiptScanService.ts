import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../utils/supabase';

export interface ReceiptItem {
  name: string;
  quantity?: number;
  price?: number;
}

export interface ReceiptScanResult {
  merchantName?: string;
  total?: number;
  date?: string;
  tax?: number;
  category?: 'Food' | 'Stay' | 'Activities' | 'Groceries' | 'Transport' | 'General';
  items?: ReceiptItem[];
  note?: string;
  rawText?: string;
}

// Configured AI / Free OCR Keys
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_KEY_BACKUP = process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP || '';
const GEMINI_KEY_BACKUP2 = process.env.EXPO_PUBLIC_GEMINI_API_KEY_BACKUP2 || '';
const GEMINI_MODELS = [
  process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.5-flash',
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
];

const GROQ_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_VISION_MODELS = [
  'llama-3.2-11b-vision-preview',
  'llama-3.2-90b-vision-preview',
];

const MINDEE_KEY = process.env.EXPO_PUBLIC_MINDEE_API_KEY || '';
const OCR_SPACE_KEY = process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY || 'K88888888888957'; // OCR.Space free key fallback

const OCR_PROMPT = `You are an expert OCR receipt scanner for a group travel expense app called Barkadash.
Analyze this receipt image and extract the following details in JSON format:
{
  "merchantName": "Name of store/vendor/restaurant or null if unreadable",
  "total": 0.00 (the final grand total paid as a number, or null),
  "date": "YYYY-MM-DD or readable date string, or null",
  "tax": 0.00 (tax or service charge as a number, or null),
  "category": "Food" | "Stay" | "Activities" | "Groceries" | "Transport" | "General",
  "note": "A short 1-sentence description of what was bought (e.g., 'Coffee & breakfast' or 'Dinner with barkada' or 'Groceries & snacks' or 'Taxi ride') without any price or date numbers",
  "items": [
    {
      "name": "Item description",
      "quantity": 1,
      "price": 0.00
    }
  ]
}

Only return valid JSON without markdown fences or extra explanations.`;

/**
 * Infer Barkadash expense category based on merchant name or line items
 */
export const inferCategory = (
  merchant?: string,
  items?: ReceiptItem[]
): 'Food' | 'Stay' | 'Activities' | 'Groceries' | 'Transport' | 'General' => {
  const combined = `${merchant || ''} ${(items || []).map((i) => i.name).join(' ')}`.toLowerCase();

  if (
    /jollibee|mcdonald|kfc|starbucks|cafe|restaurant|bistro|diner|food|kitchen|grill|bakery|bar|coffee|pizza|burger|snack|tea|eats|chowking|mang inasal|inasal/i.test(
      combined
    )
  ) {
    return 'Food';
  }
  if (
    /supermarket|grocery|mart|puregold|sm hypermarket|savemore|robinsons supermarket|7-eleven|711|ministop|lawson|alfamart|convenience|market/i.test(
      combined
    )
  ) {
    return 'Groceries';
  }
  if (
    /grab|taxi|cab|uber|angkas|joyride|gas|petron|shell|caltex|toll|terminal|ferry|boat|van|tricycle|jeep|airline|flight|cebu pacific|airasia|transport/i.test(
      combined
    )
  ) {
    return 'Transport';
  }
  if (
    /hotel|resort|hostel|inn|lodge|airbnb|homestay|villa|stay|transient|pension|cottage/i.test(
      combined
    )
  ) {
    return 'Stay';
  }
  if (
    /tour|island|snorkeling|diving|kayak|zipline|ticket|entrance|museum|park|adventure|surf|activity/i.test(
      combined
    )
  ) {
    return 'Activities';
  }

  return 'General';
};

/**
 * Clean & normalize structured JSON receipt result
 */
function parseReceiptJson(text: string): ReceiptScanResult | null {
  if (!text) return null;
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    const category = parsed.category || inferCategory(parsed.merchantName, parsed.items);

    let shortNote = parsed.note;
    if (!shortNote && Array.isArray(parsed.items) && parsed.items.length > 0) {
      shortNote = parsed.items
        .map((i: any) => i.name)
        .filter(Boolean)
        .slice(0, 4)
        .join(', ');
    }

    return {
      merchantName: parsed.merchantName || undefined,
      total: typeof parsed.total === 'number' && !isNaN(parsed.total) ? parsed.total : undefined,
      date: parsed.date || undefined,
      tax: typeof parsed.tax === 'number' && !isNaN(parsed.tax) ? parsed.tax : undefined,
      category,
      note: shortNote || undefined,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((it: any) => ({
            name: String(it.name || ''),
            quantity: typeof it.quantity === 'number' ? it.quantity : undefined,
            price: typeof it.price === 'number' ? it.price : undefined,
          }))
        : undefined,
    };
  } catch (e) {
    console.warn('parseReceiptJson failed:', e);
    return null;
  }
}

/**
 * Tier 1: Supabase Edge Function (scan-receipt)
 */
async function scanWithSupabaseEdge(imageBase64: string): Promise<ReceiptScanResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('scan-receipt', {
      body: {
        image_base64: imageBase64,
        mime_type: 'image/jpeg',
      },
    });

    if (!error && data?.receipt) {
      const res = data.receipt as ReceiptScanResult;
      if (!res.category) {
        res.category = inferCategory(res.merchantName, res.items);
      }
      return res;
    }
  } catch (err: any) {
    console.warn('Supabase edge scan-receipt unavailable:', err?.message);
  }
  return null;
}

/**
 * Tier 2: OCR.Space Free REST API (Free 25,000 requests/month)
 */
async function scanWithOcrSpace(imageBase64: string): Promise<ReceiptScanResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY || OCR_SPACE_KEY;
  if (!apiKey) return null;

  try {
    const formData = new FormData();
    formData.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
    formData.append('language', 'eng');
    formData.append('isTable', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      console.warn(`OCR.Space HTTP error: ${response.status}`);
      return null;
    }

    const json = await response.json();
    if (json.IsErroredOnProcessing) {
      console.warn('OCR.Space processing error:', json.ErrorMessage);
      return null;
    }

    const parsedText = json?.ParsedResults?.[0]?.ParsedText || '';
    if (!parsedText || parsedText.trim().length === 0) return null;

    // Fast AI structuring of the OCR text if Groq/Gemini key exists
    const structured = await structureOcrText(parsedText);
    if (structured) return structured;

    // Heuristic Regex Fallback for pure OCR text
    const lines = parsedText.split('\n').map((l: string) => l.trim()).filter(Boolean);
    const merchant = lines.length > 0 ? lines[0].slice(0, 40) : undefined;

    const totalMatch = parsedText.match(/(?:total|amount due|grand total|balance due|net amount|php|p\s*|₱)\s*[:=]?\s*([\d,]+\.\d{2})/i)
      || parsedText.match(/([\d,]+\.\d{2})\s*(?:total|php|paid)/i);
    const dateMatch = parsedText.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})|(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
    const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : undefined;

    return {
      merchantName: merchant,
      total,
      date: dateMatch ? dateMatch[0] : undefined,
      category: inferCategory(parsedText),
      rawText: parsedText.slice(0, 300),
    };
  } catch (err: any) {
    console.warn('OCR Space failed:', err?.message);
    return null;
  }
}

/**
 * Helper to structure OCR parsed text using Groq or Gemini
 */
async function structureOcrText(parsedText: string): Promise<ReceiptScanResult | null> {
  // 1. Try Groq first
  if (GROQ_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'user',
              content: `You are a receipt text parser. Given this OCR text from a receipt, extract details in JSON format:
{
  "merchantName": "Store/vendor name or null",
  "total": 0.00 (grand total amount as number or null),
  "date": "YYYY-MM-DD or null",
  "tax": 0.00 (or null),
  "category": "Food" | "Stay" | "Activities" | "Groceries" | "Transport" | "General",
  "note": "Short 1-sentence note of items bought",
  "items": [{"name": "Item", "quantity": 1, "price": 0.00}]
}

OCR Text:
"""
${parsedText.slice(0, 3000)}
"""

Return only valid JSON.`,
            },
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const aiJson = await response.json();
        const parsed = parseReceiptJson(aiJson?.choices?.[0]?.message?.content?.trim() || '');
        if (parsed && (parsed.total || parsed.merchantName)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Groq OCR text structuring failed, trying Gemini:', err);
    }
  }

  // 2. Try Gemini (Primary then Backup)
  const geminiKeys = [GEMINI_KEY, GEMINI_KEY_BACKUP, GEMINI_KEY_BACKUP2].filter(Boolean);
  const geminiModel = process.env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-3.6-flash';
  for (const key of geminiKeys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `You are a receipt text parser. Given this OCR text from a receipt, extract details in JSON format:
{
  "merchantName": "Store/vendor name or null",
  "total": 0.00 (grand total amount as number or null),
  "date": "YYYY-MM-DD or null",
  "tax": 0.00 (or null),
  "category": "Food" | "Stay" | "Activities" | "Groceries" | "Transport" | "General",
  "note": "Short 1-sentence note of items bought",
  "items": [{"name": "Item", "quantity": 1, "price": 0.00}]
}

OCR Text:
"""
${parsedText.slice(0, 3000)}
"""

Return only valid JSON.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.ok) {
        const json = await response.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const parsed = parseReceiptJson(text);
        if (parsed && (parsed.total || parsed.merchantName)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn(`Gemini OCR text structuring failed with key ending in ...${key.slice(-5)}:`, err);
    }
  }

  return null;
}

/**
 * Tier 3: Google Gemini Multimodal Vision API
 */
async function scanWithGeminiVision(apiKey: string, imageBase64: string, mimeType = 'image/jpeg'): Promise<ReceiptScanResult | null> {
  if (!apiKey) return null;

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: OCR_PROMPT },
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        console.warn(`Gemini Vision model ${model} HTTP ${response.status}`);
        continue;
      }

      const json = await response.json();
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      const parsed = parseReceiptJson(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn(`Gemini Vision model ${model} exception:`, err?.message);
    }
  }
  return null;
}

/**
 * Tier 4: Groq Vision Multimodal API (Llama 3.2 Vision)
 */
async function scanWithGroqVision(imageBase64: string, mimeType = 'image/jpeg'): Promise<ReceiptScanResult | null> {
  if (!GROQ_KEY) return null;

  for (const model of GROQ_VISION_MODELS) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: OCR_PROMPT },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 1024,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        console.warn(`Groq Vision model ${model} HTTP ${response.status}`);
        continue;
      }

      const json = await response.json();
      const text = json?.choices?.[0]?.message?.content?.trim() || '';
      const parsed = parseReceiptJson(text);
      if (parsed) return parsed;
    } catch (err: any) {
      console.warn(`Groq Vision model ${model} exception:`, err?.message);
    }
  }
  return null;
}

/**
 * Tier 5: Mindee Financial Receipt API (Free 250 receipts/month)
 */
async function scanWithMindee(imageBase64: string): Promise<ReceiptScanResult | null> {
  if (!MINDEE_KEY) return null;
  try {
    const formData = new FormData();
    formData.append('document', `data:image/jpeg;base64,${imageBase64}`);

    const response = await fetch('https://api.mindee.net/v1/products/mindee/expense_receipts/v5/predict', {
      method: 'POST',
      headers: {
        Authorization: `Token ${MINDEE_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) return null;
    const json = await response.json();
    const doc = json?.document?.inference?.prediction;
    if (!doc) return null;

    const merchant = doc.supplier_name?.value;
    const total = doc.total_amount?.value;
    const date = doc.date?.value;
    const tax = doc.total_tax?.value;
    const category = doc.category?.value;
    const items = (doc.line_items || []).map((li: any) => ({
      name: li.description || '',
      quantity: typeof li.quantity === 'number' ? li.quantity : undefined,
      price: typeof li.total_amount === 'number' ? li.total_amount : undefined,
    }));

    return {
      merchantName: merchant || undefined,
      total: typeof total === 'number' ? total : undefined,
      date: date || undefined,
      tax: typeof tax === 'number' ? tax : undefined,
      category: category ? inferCategory(merchant || category, items) : inferCategory(merchant, items),
      items: items.length > 0 ? items : undefined,
    };
  } catch (err: any) {
    console.warn('Mindee OCR failed:', err?.message);
    return null;
  }
}

/**
 * Master multi-tier receipt scanning pipeline:
 * Tier 1: OCR.Space Free API (if EXPO_PUBLIC_OCR_SPACE_API_KEY is configured)
 * Tier 2: Google Gemini Multimodal Vision
 * Tier 3: Groq Llama-3.2-Vision
 * Tier 4: Mindee Financial Receipt API (if configured)
 * Tier 5: OCR.Space fallback
 * Tier 6: Graceful fallback
 */
export const scanReceiptImage = async (uri: string): Promise<ReceiptScanResult> => {
  let imageBase64 = '';
  try {
    imageBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (readErr) {
    console.warn('Could not read receipt image file as base64:', readErr);
    return {};
  }

  if (!imageBase64) return {};

  // 1. OCR.Space (if user configured EXPO_PUBLIC_OCR_SPACE_API_KEY)
  if (process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY) {
    const ocrSpaceResult = await scanWithOcrSpace(imageBase64);
    if (ocrSpaceResult && (ocrSpaceResult.total || ocrSpaceResult.merchantName || ocrSpaceResult.rawText)) {
      return ocrSpaceResult;
    }
  }

  // 2. Google Gemini Vision OCR (Primary then Backup)
  if (GEMINI_KEY) {
    const geminiResult = await scanWithGeminiVision(GEMINI_KEY, imageBase64, 'image/jpeg');
    if (geminiResult && (geminiResult.total || geminiResult.merchantName)) {
      return geminiResult;
    }
  }
  if (GEMINI_KEY_BACKUP) {
    const geminiResult = await scanWithGeminiVision(GEMINI_KEY_BACKUP, imageBase64, 'image/jpeg');
    if (geminiResult && (geminiResult.total || geminiResult.merchantName)) {
      return geminiResult;
    }
  }
  if (GEMINI_KEY_BACKUP2) {
    const geminiResult = await scanWithGeminiVision(GEMINI_KEY_BACKUP2, imageBase64, 'image/jpeg');
    if (geminiResult && (geminiResult.total || geminiResult.merchantName)) {
      return geminiResult;
    }
  }

  // 3. Groq Vision OCR (Llama 3.2 Vision)
  const groqResult = await scanWithGroqVision(imageBase64, 'image/jpeg');
  if (groqResult && (groqResult.total || groqResult.merchantName)) {
    return groqResult;
  }

  // 4. Mindee Receipt OCR (if configured)
  const mindeeResult = await scanWithMindee(imageBase64);
  if (mindeeResult && (mindeeResult.total || mindeeResult.merchantName)) {
    return mindeeResult;
  }

  // 5. OCR.Space standard fallback (free tier key)
  const ocrFallbackResult = await scanWithOcrSpace(imageBase64);
  if (ocrFallbackResult && (ocrFallbackResult.total || ocrFallbackResult.rawText)) {
    return ocrFallbackResult;
  }

  // 6. Safe Graceful fallback — returns empty result so user can type amount without app crashing
  return {
    category: 'Food',
    date: new Date().toISOString().split('T')[0],
  };
};
