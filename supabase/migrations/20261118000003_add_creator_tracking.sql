-- Add creator tracking columns to celebrations and create creator_activity_logs table
ALTER TABLE public.celebrations ADD COLUMN IF NOT EXISTS creator_ip text;
ALTER TABLE public.celebrations ADD COLUMN IF NOT EXISTS creator_user_agent text;
ALTER TABLE public.celebrations ADD COLUMN IF NOT EXISTS creator_metadata jsonb DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.creator_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  celebration_slug text,
  creator_ip text,
  creator_user_agent text,
  device_info jsonb DEFAULT '{}'::jsonb,
  recipient_name text,
  sender_name text,
  passcode text,
  song text,
  photo_count int DEFAULT 0,
  photos_list jsonb DEFAULT '[]'::jsonb,
  full_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.creator_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'creator_activity_logs' AND policyname = 'Allow public insert on creator_activity_logs'
  ) THEN
    CREATE POLICY "Allow public insert on creator_activity_logs"
      ON public.creator_activity_logs FOR INSERT TO anon, authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'creator_activity_logs' AND policyname = 'Allow public select on creator_activity_logs'
  ) THEN
    CREATE POLICY "Allow public select on creator_activity_logs"
      ON public.creator_activity_logs FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END $$;
