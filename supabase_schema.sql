-- ==============================================================================
-- BIRTHDAY SURPRISE SCRAPBOOK - SUPABASE SCHEMA & RLS POLICIES
-- Following Supabase Postgres Best Practices & Security Guidelines
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE: celebrations
-- Stores personalized birthday websites created via Admin page
CREATE TABLE IF NOT EXISTS public.celebrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    person_name TEXT NOT NULL,
    passcode TEXT NOT NULL DEFAULT '1204',
    song TEXT NOT NULL DEFAULT 'haareya',
    cover_photo TEXT,
    polaroid_1_photo TEXT,
    polaroid_2_photo TEXT,
    letter_text TEXT,
    letter_author TEXT,
    scrapbook_note_1 TEXT,
    scrapbook_note_2 TEXT,
    social_instagram TEXT,
    social_snapchat TEXT,
    social_gmail TEXT,
    social_whatsapp TEXT,
    social_spotify TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on slug for fast lookup by URL query param
CREATE INDEX IF NOT EXISTS idx_celebrations_slug ON public.celebrations (slug);
CREATE INDEX IF NOT EXISTS idx_celebrations_created_at ON public.celebrations (created_at DESC);

-- 3. TABLE: community_wishes
-- Stores birthday wishes from friends, family, and community members
CREATE TABLE IF NOT EXISTS public.community_wishes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    celebration_id UUID REFERENCES public.celebrations(id) ON DELETE CASCADE,
    wisher_name TEXT NOT NULL,
    birth_date DATE NOT NULL,
    message TEXT NOT NULL,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_wishes_celebration_id ON public.community_wishes (celebration_id);
CREATE INDEX IF NOT EXISTS idx_community_wishes_created_at ON public.community_wishes (created_at DESC);

-- 4. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_wishes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public can view celebrations" ON public.celebrations;
DROP POLICY IF EXISTS "Public can create celebrations" ON public.celebrations;
DROP POLICY IF EXISTS "Public can view community wishes" ON public.community_wishes;
DROP POLICY IF EXISTS "Public can submit community wishes" ON public.community_wishes;

-- Celebrations Policies:
-- Allow anyone (public link viewers) to read celebration details
CREATE POLICY "Public can view celebrations"
ON public.celebrations
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anyone to create their own celebration via the Admin / Creator page
CREATE POLICY "Public can create celebrations"
ON public.celebrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
    char_length(person_name) > 0 AND char_length(person_name) <= 100
    AND char_length(passcode) >= 4 AND char_length(passcode) <= 12
);

-- Community Wishes Policies:
-- Anyone can view wishes for a celebration
CREATE POLICY "Public can view community wishes"
ON public.community_wishes
FOR SELECT
TO anon, authenticated
USING (true);

-- Anyone can submit a wish with validation checks
CREATE POLICY "Public can submit community wishes"
ON public.community_wishes
FOR INSERT
TO anon, authenticated
WITH CHECK (
    char_length(wisher_name) > 0 AND char_length(wisher_name) <= 100
    AND char_length(message) > 0 AND char_length(message) <= 2000
);

-- 5. SEED DATA (Default Celebration & Sample Wishes)
INSERT INTO public.celebrations (
    slug,
    person_name,
    passcode,
    song,
    cover_photo,
    polaroid_1_photo,
    polaroid_2_photo,
    letter_text,
    letter_author,
    scrapbook_note_1,
    scrapbook_note_2,
    social_instagram,
    social_snapchat,
    social_gmail,
    social_whatsapp,
    social_spotify
) VALUES (
    'default',
    'Birthday Boy',
    '1204',
    'haareya',
    'assets/images/8338b435081652f46c4089cbbcd1a45d.png',
    'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg',
    'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg',
    'Happy Birthday to the most special person in my universe! You bring so much sunshine, laughter, and calm into my world every single day. Seeing your smile makes everything better. I hope this year brings you all the dreams you have been wishing for!',
    'With all my love ❤️',
    'The world is a little brighter because you are in it.',
    'You have a way of making ordinary moments feel truly magical.',
    'https://instagram.com',
    'https://snapchat.com',
    'mailto:birthday@special.com',
    'https://wa.me/',
    'https://spotify.com'
) ON CONFLICT (slug) DO NOTHING;

-- Seed Sample Community Wishes
INSERT INTO public.community_wishes (celebration_id, wisher_name, birth_date, message, photo_url)
SELECT
    id,
    'Aarav Sharma',
    '2001-08-14',
    'Happy Birthday brother! Wishing you massive success, health, and endless happiness!',
    'assets/images/0099aefeea146e88918db1a9b45b5390.png'
FROM public.celebrations WHERE slug = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO public.community_wishes (celebration_id, wisher_name, birth_date, message, photo_url)
SELECT
    id,
    'Ananya Verma',
    '2003-11-25',
    'Happiest Birthday! Keep smiling and shining like you always do!',
    'assets/images/081442c0e030756fb44aac4f696c999f.png'
FROM public.celebrations WHERE slug = 'default'
ON CONFLICT DO NOTHING;
