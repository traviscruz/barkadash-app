import { TextractClient, AnalyzeExpenseCommand } from 'npm:@aws-sdk/client-textract@3.859.0';

// Deploy: supabase functions deploy scan-receipt
// Secrets: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// IAM permission required: textract:AnalyzeExpense

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const numberValue = (value?: string) => {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { image_base64, mime_type = 'image/jpeg' } = await req.json();
    if (!image_base64) return json({ error: 'image_base64 is required' }, 400);
    if (!['image/jpeg', 'image/png'].includes(mime_type)) {
      return json({ error: 'Only JPEG and PNG images are supported' }, 400);
    }
    if (!Deno.env.get('AWS_ACCESS_KEY_ID') || !Deno.env.get('AWS_SECRET_ACCESS_KEY')) {
      return json({ error: 'AWS Textract is not configured' }, 503);
    }

    const client = new TextractClient({
      region: Deno.env.get('AWS_REGION') ?? 'ap-southeast-1',
      credentials: {
        accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });

    const response = await client.send(new AnalyzeExpenseCommand({
      Document: { Bytes: Uint8Array.from(atob(image_base64), (char) => char.charCodeAt(0)) },
    }));

    const document = response.ExpenseDocuments?.[0];
    const summary = document?.SummaryFields ?? [];
    const field = (...types: string[]) => summary.find((item) => types.includes(item.Type ?? ''))?.ValueDetection?.Text;
    const lineItems = (document?.LineItemGroups ?? [])
      .flatMap((group) => group.LineItems ?? [])
      .map((line) => {
        const fields = line.LineItemExpenseFields ?? [];
        const value = (...types: string[]) => fields.find((item) => types.includes(item.Type ?? ''))?.ValueDetection?.Text;
        return {
          name: value('ITEM', 'EXPENSE_ROW') ?? 'Receipt item',
          quantity: numberValue(value('QUANTITY')),
          price: numberValue(value('PRICE', 'EXPENSE_ROW')),
        };
      })
      .filter((item) => item.name || item.price);

    return json({
      receipt: {
        merchantName: field('VENDOR_NAME', 'VENDOR'),
        total: numberValue(field('TOTAL')),
        tax: numberValue(field('TAX')),
        date: field('INVOICE_RECEIPT_DATE', 'DATE'),
        items: lineItems,
      },
    });
  } catch (error) {
    console.error('scan-receipt error', error);
    return json({ error: 'Receipt scanning failed' }, 500);
  }
});
