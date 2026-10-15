-- ============================================================================
-- Barkadash Notification and Push Token Migration
-- Adapts Ani-grow push architecture to Barkadash's domain model.
-- ============================================================================

-- 1. Push Tokens Table (Supports multi-device FCM, APNs, and Expo Push Tokens)
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    fcm_token TEXT NOT NULL,
    device_type TEXT NOT NULL, -- 'android' | 'ios' | 'web'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, fcm_token)
);

-- Backward compatibility push_tokens table (single token per user)
CREATE TABLE IF NOT EXISTS public.push_tokens (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure Notifications Table has all standard category and action_url columns
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type TEXT NOT NULL DEFAULT 'system',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'system',
    action_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    itinerary_item_id UUID REFERENCES public.trip_itinerary_items(id) ON DELETE CASCADE,
    stay_id UUID REFERENCES public.trip_stays(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure category and action_url exist if table was already created
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'system';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

-- 3. Row Level Security Policies
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_push_tokens_policy" ON public.user_push_tokens;
CREATE POLICY "user_push_tokens_policy" ON public.user_push_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_tokens_policy" ON public.push_tokens;
CREATE POLICY "push_tokens_policy" ON public.push_tokens
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_user_policy" ON public.notifications;
CREATE POLICY "notifications_user_policy" ON public.notifications
    FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

GRANT ALL ON TABLE public.user_push_tokens TO authenticated;
GRANT ALL ON TABLE public.push_tokens TO authenticated;
GRANT ALL ON TABLE public.notifications TO authenticated;

-- 4. Enable Supabase Realtime for notifications and tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_push_tokens'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_push_tokens;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
