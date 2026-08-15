// Barkadash — send-push Edge Function
// Receives a notification insert from the DB trigger and forwards it to the
// recipient's device via the Expo Push Service.
//
// Deploy (public, no JWT needed since pg_net calls it server-side):
//   supabase functions deploy send-push --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { notification_id, user_id, title, message, type, trip_id, itinerary_item_id } = body;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ ok: false, reason: 'missing user_id or title' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenRow } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!tokenRow?.token) {
      return new Response(JSON.stringify({ ok: false, reason: 'no push token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          to: tokenRow.token,
          title,
          body: message || '',
          sound: 'default',
          data: {
            notificationId: notification_id,
            type: type || 'system',
            tripId: trip_id || null,
            itineraryItemId: itinerary_item_id || null,
            screen: 'notifications',
          },
        },
      ]),
    });

    const pushResult = await pushResponse.json();

    return new Response(JSON.stringify({ ok: true, result: pushResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
