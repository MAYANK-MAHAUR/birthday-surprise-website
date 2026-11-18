-- Add photos_data JSONB column to celebrations for complete photo customization
ALTER TABLE public.celebrations ADD COLUMN IF NOT EXISTS photos_data jsonb DEFAULT '{}'::jsonb;
