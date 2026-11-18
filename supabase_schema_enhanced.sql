-- ==============================================================================
-- BIRTHDAY SURPRISE SCRAPBOOK - ENHANCED SUPABASE SCHEMA & RLS POLICIES
-- Target Supabase Project: obnuhnxhriluesrigxjz (PostgreSQL 17.6.1)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE: public.celebrations
-- Stores custom personalized birthday celebrations created via Admin page
CREATE TABLE IF NOT EXISTS public.celebrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    person_name TEXT NOT NULL,
    passcode TEXT NOT NULL DEFAULT '1204',
    song TEXT NOT NULL DEFAULT 'haareya',
    cover_photo TEXT,
    polaroid_1_photo TEXT,
    polaroid_2_photo TEXT,
    polaroid_3_photo TEXT,
    polaroid_note TEXT DEFAULT 'Happy Birthday ❤️',
    letter_text TEXT,
    letter_author TEXT,
    dedication_text TEXT,
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

-- Performance Indexes for celebrations
CREATE INDEX IF NOT EXISTS idx_celebrations_slug ON public.celebrations (slug);
CREATE INDEX IF NOT EXISTS idx_celebrations_created_at ON public.celebrations (created_at DESC);

-- 3. TABLE: public.community_wishes
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

-- Performance Indexes for community_wishes
CREATE INDEX IF NOT EXISTS idx_community_wishes_celebration_id ON public.community_wishes (celebration_id);
CREATE INDEX IF NOT EXISTS idx_community_wishes_created_at ON public.community_wishes (created_at DESC);

-- 4. STORAGE BUCKET: celebration-assets
-- Ensure celebration-assets bucket exists with 5MB limit and image MIME restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'celebration-assets',
    'celebration-assets',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.celebrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_wishes ENABLE ROW LEVEL SECURITY;

-- Explicit Grants to anon & authenticated roles for Data API access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT ON public.celebrations TO anon, authenticated;
GRANT SELECT, INSERT ON public.community_wishes TO anon, authenticated;

-- Revoke UPDATE & DELETE from anon & authenticated to enforce default deny
REVOKE UPDATE, DELETE ON public.celebrations FROM anon, authenticated;
REVOKE UPDATE, DELETE ON public.community_wishes FROM anon, authenticated;

-- Policies for public.celebrations
DROP POLICY IF EXISTS "Public can view celebrations" ON public.celebrations;
CREATE POLICY "Public can view celebrations"
ON public.celebrations
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can create celebrations" ON public.celebrations;
CREATE POLICY "Public can create celebrations"
ON public.celebrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
    char_length(person_name) > 0 AND char_length(person_name) <= 100
    AND char_length(passcode) >= 4 AND char_length(passcode) <= 12
);

-- Policies for public.community_wishes
DROP POLICY IF EXISTS "Public can view community wishes" ON public.community_wishes;
CREATE POLICY "Public can view community wishes"
ON public.community_wishes
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can submit community wishes" ON public.community_wishes;
CREATE POLICY "Public can submit community wishes"
ON public.community_wishes
FOR INSERT
TO anon, authenticated
WITH CHECK (
    char_length(wisher_name) > 0 AND char_length(wisher_name) <= 100
    AND char_length(message) > 0 AND char_length(message) <= 2000
);

-- Policies for storage.objects
DROP POLICY IF EXISTS "Public read access to celebration assets" ON storage.objects;
CREATE POLICY "Public read access to celebration assets"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'celebration-assets');

DROP POLICY IF EXISTS "Public upload access to celebration assets" ON storage.objects;
CREATE POLICY "Public upload access to celebration assets"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'celebration-assets');

-- 6. DEFAULT SEED DATA
-- Default celebration for base website presentation
INSERT INTO public.celebrations (
    slug,
    person_name,
    passcode,
    song,
    cover_photo,
    polaroid_1_photo,
    polaroid_2_photo,
    polaroid_3_photo,
    polaroid_note,
    letter_text,
    letter_author,
    dedication_text,
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
    'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg',
    'Happy Birthday ❤️',
    'Happy Birthday to the most special person in my universe! You bring so much sunshine, laughter, and calm into my world every single day. Seeing your smile makes everything better. I hope this year brings you all the dreams you have been wishing for!',
    'With all my love ❤️',
    'To the one who makes every ordinary day feel like magic ✨',
    'The world is a little brighter because you are in it.',
    'You have a way of making ordinary moments feel truly magical.',
    'https://instagram.com',
    'https://snapchat.com',
    'mailto:birthday@special.com',
    'https://wa.me/',
    'https://spotify.com'
)
ON CONFLICT (slug) DO UPDATE SET
    person_name = EXCLUDED.person_name,
    passcode = EXCLUDED.passcode,
    song = EXCLUDED.song,
    cover_photo = EXCLUDED.cover_photo,
    polaroid_1_photo = EXCLUDED.polaroid_1_photo,
    polaroid_2_photo = EXCLUDED.polaroid_2_photo,
    polaroid_3_photo = EXCLUDED.polaroid_3_photo,
    polaroid_note = EXCLUDED.polaroid_note,
    letter_text = EXCLUDED.letter_text,
    letter_author = EXCLUDED.letter_author,
    dedication_text = EXCLUDED.dedication_text,
    scrapbook_note_1 = EXCLUDED.scrapbook_note_1,
    scrapbook_note_2 = EXCLUDED.scrapbook_note_2,
    social_instagram = EXCLUDED.social_instagram,
    social_snapchat = EXCLUDED.social_snapchat,
    social_gmail = EXCLUDED.social_gmail,
    social_whatsapp = EXCLUDED.social_whatsapp,
    social_spotify = EXCLUDED.social_spotify,
    updated_at = now();

-- Seed Default Community Wishes
INSERT INTO public.community_wishes (celebration_id, wisher_name, birth_date, message, photo_url)
SELECT
    id,
    'Aarav Sharma',
    '1998-11-20',
    'Happy Birthday bhai! May this year bring you all the success, happiness, and crazy adventures! Stay blessed!',
    'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg'
FROM public.celebrations WHERE slug = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO public.community_wishes (celebration_id, wisher_name, birth_date, message, photo_url)
SELECT
    id,
    'Priya Patel',
    '1999-04-15',
    'Happiest birthday to the sweetest soul! Keep smiling and spreading positive vibes everywhere you go! 🎂✨',
    'assets/images/8893d690706f9c045b2c6e478c07636c.jpg'
FROM public.celebrations WHERE slug = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO public.community_wishes (celebration_id, wisher_name, birth_date, message, photo_url)
SELECT
    id,
    'Rohan Verma',
    '1997-08-03',
    'Happy Birthday man! Cake party when? Wishing you endless laughter, joy, and peace this year! 🎉',
    'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg'
FROM public.celebrations WHERE slug = 'default'
ON CONFLICT DO NOTHING;

INSERT INTO public.community_wishes (celebration_id, wisher_name, birth_date, message, photo_url)
SELECT
    id,
    'Sneha Rao',
    '2000-01-28',
    'The world is truly brighter with you in it! Hope your birthday is as fabulous and special as you are! 💖',
    'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg'
FROM public.celebrations WHERE slug = 'default'
ON CONFLICT DO NOTHING;
