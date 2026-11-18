/**
 * Supabase Client & Storage Adapter for Birthday Celebrations
 * Features:
 * - Supabase REST API & Storage API integration with publishable API key & fallback
 * - Full schema contract harmonization (PostgreSQL UUIDs, snake_case columns)
 * - File / Blob / Base64 upload to Supabase Storage bucket 'celebration-assets'
 * - Transparent offline localStorage persistence & hydration fallback
 * - Exposes window.SupabaseCelebrationClient (and window.SupabaseClient alias)
 */

(function (window) {
  'use strict';

  const SUPABASE_CONFIG = {
    url: 'https://obnuhnxhriluesrigxjz.supabase.co',
    publishableKey: 'sb_publishable_M4OGbz-SJWwF3sQsJrONBw_SBBOPHY0',
    legacyAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibnVobnhocmlsdWVzcmlneGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NDk2MDcsImV4cCI6MjA4NTMyNTYwN30.5sLGPgATyerQEfnMQgDwuBgeGuPwQ_vMF1N2U82p3Yk',
    bucket: 'celebration-assets'
  };

  // Pre-seeded friends wishes board fallback
  const DEFAULT_WISHES = [
    {
      id: 'wish-1',
      celebration_id: null,
      wisher_name: 'Aarav Sharma',
      birth_date: '1998-11-20',
      message: 'Happy Birthday bhai! May this year bring you all the success, happiness, and crazy adventures! Stay blessed!',
      photo_url: 'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg',
      created_at: '2026-11-18T10:00:00Z',
    },
    {
      id: 'wish-2',
      celebration_id: null,
      wisher_name: 'Priya Patel',
      birth_date: '1999-04-15',
      message: 'Happiest birthday to the sweetest soul! Keep smiling and spreading positive vibes everywhere you go! 🎂✨',
      photo_url: 'assets/images/8893d690706f9c045b2c6e478c07636c.jpg',
      created_at: '2026-11-18T11:15:00Z',
    },
    {
      id: 'wish-3',
      celebration_id: null,
      wisher_name: 'Rohan Verma',
      birth_date: '1997-08-03',
      message: 'Happy Birthday man! Cake party when? Wishing you endless laughter, joy, and peace this year! 🎉',
      photo_url: 'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg',
      created_at: '2026-11-18T12:30:00Z',
    },
    {
      id: 'wish-4',
      celebration_id: null,
      wisher_name: 'Sneha Rao',
      birth_date: '2000-01-28',
      message: 'The world is truly brighter with you in it! Hope your birthday is as fabulous and special as you are! 💖',
      photo_url: 'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg',
      created_at: '2026-11-18T13:45:00Z',
    },
  ];

  class SupabaseCelebrationClient {
    constructor() {
      this.url = SUPABASE_CONFIG.url;
      this.key = SUPABASE_CONFIG.publishableKey;
      this.legacyKey = SUPABASE_CONFIG.legacyAnonKey;
      this.bucket = SUPABASE_CONFIG.bucket;
      this.storageKey = 'birthday_celebrations_db';
      this.wishesStorageKey = 'birthday_wishes_db';
      this._initLocalStorage();
    }

    _initLocalStorage() {
      if (typeof window === 'undefined' || !window.localStorage) return;
      try {
        if (!localStorage.getItem(this.wishesStorageKey)) {
          localStorage.setItem(this.wishesStorageKey, JSON.stringify(DEFAULT_WISHES));
        }
        if (!localStorage.getItem(this.storageKey)) {
          localStorage.setItem(this.storageKey, JSON.stringify({}));
        }
      } catch (e) {
        console.warn('localStorage initialization error:', e);
      }
    }

    _getHeaders(contentType = 'application/json', prefer = 'return=representation') {
      const headers = {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
      };
      if (contentType) {
        headers['Content-Type'] = contentType;
      }
      if (prefer) {
        headers['Prefer'] = prefer;
      }
      return headers;
    }

    /**
     * Validate RFC 4122 UUID v1-v5 string
     * @param {*} str
     * @returns {boolean}
     */
    _isUuid(str) {
      return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str.trim());
    }

    /**
     * Convert Data URL to binary Blob
     */
    _dataUrlToBlob(dataUrl) {
      const parts = dataUrl.split(';base64,');
      const contentType = (parts[0] && parts[0].split(':')[1]) || 'image/jpeg';
      const base64Data = parts[1] || '';

      const atobFn = typeof window !== 'undefined' && window.atob
        ? window.atob.bind(window)
        : (typeof globalThis !== 'undefined' && globalThis.atob
          ? globalThis.atob.bind(globalThis)
          : (typeof atob !== 'undefined' ? atob : null));

      let raw = '';
      if (atobFn) {
        raw = atobFn(base64Data);
      } else if (typeof Buffer !== 'undefined') {
        raw = Buffer.from(base64Data, 'base64').toString('binary');
      } else {
        throw new Error('Base64 decoder (atob) not available in this environment');
      }

      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    }

    /**
     * Generate URL-safe slug from person name
     */
    _slugify(name) {
      const clean = (name || 'birthday')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      return `${clean || 'celebration'}-${randomSuffix}`;
    }

    /**
     * Fetch a celebration by Slug or UUID
     * @param {string} slugOrId
     * @returns {Promise<Object|null>}
     */
    async getCelebration(slugOrId) {
      if (!slugOrId) return null;

      // 1. Check URL-encoded data parameter first (?data=<base64>)
      if (typeof window !== 'undefined' && window.location) {
        const urlParams = new URLSearchParams(window.location.search);
        const encodedData = urlParams.get('data');
        if (encodedData) {
          try {
            const decoded = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
            if (decoded && (decoded.slug === slugOrId || decoded.id === slugOrId)) {
              return decoded;
            }
          } catch (e) {
            console.warn('Failed to parse URL encoded celebration data:', e);
          }
        }
      }

      // 2. Query Supabase database
      try {
        const isUuid = this._isUuid(slugOrId);
        const queryFilter = isUuid
          ? `or=(slug.eq.${encodeURIComponent(slugOrId)},id.eq.${encodeURIComponent(slugOrId)})`
          : `slug=eq.${encodeURIComponent(slugOrId)}`;

        const resp = await fetch(
          `${this.url}/rest/v1/celebrations?${queryFilter}&select=*`,
          {
            method: 'GET',
            headers: this._getHeaders(),
            signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
          }
        );

        if (resp.ok) {
          const list = await resp.json();
          if (list && list.length > 0) {
            const celebration = list[0];
            // Normalize convenience fields for caller compatibility
            this._enrichCelebrationModel(celebration);
            // Cache locally for offline availability
            if (typeof localStorage !== 'undefined') {
              const localDb = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
              localDb[celebration.slug] = celebration;
              if (celebration.id) localDb[celebration.id] = celebration;
              localStorage.setItem(this.storageKey, JSON.stringify(localDb));
            }
            return celebration;
          }
        }
      } catch (e) {
        console.warn('Supabase query failed, checking offline storage:', e);
      }

      // 3. Fallback to localStorage
      if (typeof localStorage !== 'undefined') {
        const localDb = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        if (localDb[slugOrId]) {
          return localDb[slugOrId];
        }
      }

      return null;
    }

    /**
     * Save a custom celebration (Admin creator)
     * Maps user input to database schema and persists to Supabase
     * @param {Object} data
     * @returns {Promise<{success: boolean, record: Object, source: string}>}
     */
    async saveCelebration(data) {
      const slug = data.slug || this._slugify(data.person_name || data.name);
      const rawPasscode = data.passcode !== undefined ? String(data.passcode).trim() : '1204';
      const rawName = data.person_name !== undefined ? data.person_name : (data.name !== undefined ? data.name : 'Special Person');

      // Map incoming fields to database columns
      const dbPayload = {
        slug: slug,
        person_name: typeof rawName === 'string' ? rawName.trim() : String(rawName || ''),
        passcode: rawPasscode,
        song: data.song || 'haareya',
        cover_photo: data.cover_photo || (data.photos && data.photos[0]) || null,
        polaroid_1_photo: data.polaroid_1_photo || (data.photos && data.photos[1]) || null,
        polaroid_2_photo: data.polaroid_2_photo || (data.photos && data.photos[2]) || null,
        polaroid_3_photo: data.polaroid_3_photo || (data.photos && data.photos[3]) || null,
        polaroid_note: data.polaroid_note || data.polaroidNote || 'Happy Birthday ❤️',
        letter_text: data.letter_text || data.letter || '',
        letter_author: data.letter_author || data.sender || data.author || '',
        dedication_text: data.dedication_text || data.dedication || '',
        scrapbook_note_1: data.scrapbook_note_1 || data.sticky1 || '',
        scrapbook_note_2: data.scrapbook_note_2 || data.sticky2 || '',
        social_instagram: data.social_instagram || data.socials?.instagram || '',
        social_snapchat: data.social_snapchat || data.socials?.snapchat || '',
        social_gmail: data.social_gmail || data.socials?.gmail || '',
        social_whatsapp: data.social_whatsapp || data.socials?.whatsapp || '',
        social_spotify: data.social_spotify || data.socials?.spotify || '',
      };

      // 1. Try saving to Supabase table 'celebrations'
      try {
        const resp = await fetch(`${this.url}/rest/v1/celebrations`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(dbPayload),
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });

        if (resp.ok) {
          const resData = await resp.json();
          const savedRecord = resData && resData[0] ? resData[0] : dbPayload;
          this._enrichCelebrationModel(savedRecord);

          // Save in localStorage cache
          if (typeof localStorage !== 'undefined') {
            const localDb = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
            localDb[savedRecord.slug] = savedRecord;
            if (savedRecord.id) localDb[savedRecord.id] = savedRecord;
            localStorage.setItem(this.storageKey, JSON.stringify(localDb));
          }

          return { success: true, record: savedRecord, source: 'supabase' };
        } else {
          const errText = await resp.text();
          console.warn('Supabase save returned HTTP ' + resp.status + ':', errText);
          if (resp.status >= 400 && resp.status < 500) {
            return {
              success: false,
              error: `Supabase validation error (${resp.status}): ${errText}`,
              status: resp.status,
              source: 'supabase',
            };
          }
        }
      } catch (e) {
        console.warn('Supabase save failed, falling back to local storage:', e);
      }

      // 2. Offline fallback: store in localStorage
      const fallbackRecord = Object.assign({
        id: 'local_' + Date.now(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, dbPayload);
      this._enrichCelebrationModel(fallbackRecord);

      if (typeof localStorage !== 'undefined') {
        const localDb = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
        localDb[fallbackRecord.slug] = fallbackRecord;
        localDb[fallbackRecord.id] = fallbackRecord;
        localStorage.setItem(this.storageKey, JSON.stringify(localDb));
      }

      return { success: true, record: fallbackRecord, source: 'local' };
    }

    /**
     * Enrich celebration object with convenience aliases for backward/forward compatibility
     */
    _enrichCelebrationModel(c) {
      if (!c) return;
      c.name = c.person_name || c.name || '';
      c.letter = c.letter_text || c.letter || '';
      c.sender = c.letter_author || c.sender || '';
      c.dedication = c.dedication_text || c.dedication || '';
      c.polaroidNote = c.polaroid_note || c.polaroidNote || '';
      c.sticky1 = c.scrapbook_note_1 || c.sticky1 || '';
      c.sticky2 = c.scrapbook_note_2 || c.sticky2 || '';
      c.socials = {
        instagram: c.social_instagram || '',
        snapchat: c.social_snapchat || '',
        gmail: c.social_gmail || '',
        whatsapp: c.social_whatsapp || '',
        spotify: c.social_spotify || '',
      };
      c.photos = [
        c.cover_photo || '',
        c.polaroid_1_photo || '',
        c.polaroid_2_photo || '',
        c.polaroid_3_photo || '',
      ];
    }

    /**
     * Query wishes from Supabase community_wishes table
     * @param {string} [celebrationId]
     * @returns {Promise<Array>}
     */
    async getCommunityWishes(celebrationId) {
      // 1. Try Supabase
      try {
        let endpoint = `${this.url}/rest/v1/community_wishes?select=*&order=created_at.desc`;
        if (celebrationId && this._isUuid(celebrationId)) {
          endpoint += `&celebration_id=eq.${encodeURIComponent(celebrationId)}`;
        }

        const resp = await fetch(endpoint, {
          method: 'GET',
          headers: this._getHeaders(),
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(3500) : undefined,
        });

        if (resp.ok) {
          const list = await resp.json();
          if (Array.isArray(list) && list.length > 0) {
            // Enrich with UI compatibility aliases
            list.forEach(w => this._enrichWishModel(w));
            return list;
          }
        }
      } catch (e) {
        console.warn('Supabase wishes query failed, falling back to local:', e);
      }

      // 2. Fallback to localStorage or default seed wishes
      if (typeof localStorage !== 'undefined') {
        const localWishes = JSON.parse(localStorage.getItem(this.wishesStorageKey) || '[]');
        if (localWishes.length > 0) {
          localWishes.forEach(w => this._enrichWishModel(w));
          if (celebrationId) {
            const filtered = localWishes.filter(w => !w.celebration_id || w.celebration_id === celebrationId);
            return filtered.length > 0 ? filtered : localWishes;
          }
          return localWishes;
        }
      }

      return DEFAULT_WISHES;
    }

    /**
     * Alias for getCommunityWishes
     */
    async getWishes(celebrationId) {
      return this.getCommunityWishes(celebrationId);
    }

    /**
     * Submit a wish to public.community_wishes
     * @param {Object} wishData
     * @returns {Promise<{success: boolean, wish: Object, source: string}>}
     */
    async submitCommunityWish(wishData) {
      const rawCelId = wishData.celebration_id || wishData.celebrationId || null;
      const rawName = wishData.wisher_name !== undefined ? wishData.wisher_name : (wishData.name !== undefined ? wishData.name : 'Anonymous Friend');
      const rawMsg = wishData.message !== undefined ? wishData.message : (wishData.msg !== undefined ? wishData.msg : 'Happy Birthday! 🎉');

      const dbPayload = {
        celebration_id: this._isUuid(rawCelId) ? rawCelId : null,
        wisher_name: typeof rawName === 'string' ? rawName.trim() : String(rawName || ''),
        birth_date: wishData.birth_date || wishData.birthDate || wishData.bday || new Date().toISOString().split('T')[0],
        message: typeof rawMsg === 'string' ? rawMsg.trim() : String(rawMsg || ''),
        photo_url: wishData.photo_url || wishData.photo || null,
      };

      // 1. Try Supabase insert
      try {
        const resp = await fetch(`${this.url}/rest/v1/community_wishes`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(dbPayload),
          signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(4000) : undefined,
        });

        if (resp.ok) {
          const savedList = await resp.json();
          const savedWish = savedList && savedList[0] ? savedList[0] : dbPayload;
          this._enrichWishModel(savedWish);

          // Prepend to local storage cache
          if (typeof localStorage !== 'undefined') {
            const localWishes = JSON.parse(localStorage.getItem(this.wishesStorageKey) || '[]');
            localWishes.unshift(savedWish);
            localStorage.setItem(this.wishesStorageKey, JSON.stringify(localWishes));
          }

          return { success: true, wish: savedWish, source: 'supabase' };
        } else {
          const errText = await resp.text();
          console.warn('Supabase wish submit HTTP ' + resp.status + ':', errText);
          if (resp.status >= 400 && resp.status < 500) {
            return {
              success: false,
              error: `Supabase wish validation error (${resp.status}): ${errText}`,
              status: resp.status,
              source: 'supabase',
            };
          }
        }
      } catch (e) {
        console.warn('Supabase wish submit failed, falling back to local:', e);
      }

      // 2. Offline fallback
      const fallbackWish = Object.assign({
        id: 'local_wish_' + Date.now(),
        created_at: new Date().toISOString(),
      }, dbPayload);
      this._enrichWishModel(fallbackWish);

      if (typeof localStorage !== 'undefined') {
        const localWishes = JSON.parse(localStorage.getItem(this.wishesStorageKey) || '[]');
        localWishes.unshift(fallbackWish);
        localStorage.setItem(this.wishesStorageKey, JSON.stringify(localWishes));
      }

      return { success: true, wish: fallbackWish, source: 'local' };
    }

    /**
     * Aliases for submitCommunityWish
     */
    async submitWish(wishData) {
      return this.submitCommunityWish(wishData);
    }

    async addWish(wishData) {
      return this.submitCommunityWish(wishData);
    }

    _enrichWishModel(w) {
      if (!w) return;
      w.name = w.wisher_name || w.name || '';
      w.bday = w.birth_date || w.birthDate || w.bday || '';
      w.birthDate = w.birth_date || w.birthDate || '';
      w.photo = w.photo_url || w.photo || '';
      w.createdAt = w.created_at || w.createdAt || '';
    }

    /**
     * Upload asset / image binary to Supabase Storage bucket 'celebration-assets'
     * @param {File|Blob|string} fileOrDataUrl
     * @param {string} [folderOrPath='uploads']
     * @returns {Promise<{success: boolean, url: string, publicUrl: string, path: string}>}
     */
    async uploadAsset(fileOrDataUrl, folderOrPath = 'uploads') {
      let blob;
      let contentType = 'image/jpeg';
      let fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;

      if (typeof fileOrDataUrl === 'string') {
        if (fileOrDataUrl.startsWith('data:')) {
          blob = this._dataUrlToBlob(fileOrDataUrl);
          contentType = blob.type || 'image/jpeg';
          if (contentType.includes('png')) fileName = fileName.replace('.jpg', '.png');
          else if (contentType.includes('webp')) fileName = fileName.replace('.jpg', '.webp');
          else if (contentType.includes('gif')) fileName = fileName.replace('.jpg', '.gif');
        } else {
          // Already a URL
          return { success: true, url: fileOrDataUrl, publicUrl: fileOrDataUrl, path: fileOrDataUrl };
        }
      } else if (fileOrDataUrl instanceof Blob || (typeof File !== 'undefined' && fileOrDataUrl instanceof File)) {
        blob = fileOrDataUrl;
        contentType = fileOrDataUrl.type || 'image/jpeg';
        if (fileOrDataUrl.name) {
          fileName = `${Date.now()}_${fileOrDataUrl.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        } else {
          let ext = '.jpg';
          if (contentType.includes('png')) ext = '.png';
          else if (contentType.includes('webp')) ext = '.webp';
          else if (contentType.includes('gif')) ext = '.gif';
          fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
        }
      } else {
        throw new Error('Unsupported file object provided for uploadAsset');
      }

      // Determine object path in bucket
      let objectPath;
      if (folderOrPath.includes('/') && folderOrPath.includes('.')) {
        objectPath = folderOrPath.replace(/^\/+/, '');
      } else {
        const folder = folderOrPath.replace(/^\/+|\/+$/g, '') || 'uploads';
        objectPath = `${folder}/${fileName}`;
      }

      const uploadUrl = `${this.url}/storage/v1/object/${this.bucket}/${objectPath}`;
      const publicUrl = `${this.url}/storage/v1/object/public/${this.bucket}/${objectPath}`;

      const headers = {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      };

      const resp = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: blob,
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Failed to upload asset to Supabase Storage (${resp.status}): ${errorText}`);
      }

      return {
        success: true,
        url: publicUrl,
        publicUrl: publicUrl,
        path: objectPath,
      };
    }

    /**
     * Alias for uploadAsset
     */
    async uploadImage(file, path) {
      return this.uploadAsset(file, path || 'images');
    }

    /**
     * Generate shareable URL for celebration
     * @param {Object} celebration
     * @returns {string}
     */
    generateShareableUrl(celebration) {
      const slug = celebration.slug || celebration.id || 'default';
      let origin = '';
      let pathname = '';
      if (typeof window !== 'undefined' && window.location) {
        origin = window.location.origin;
        pathname = window.location.pathname.replace(/admin\.html.*$/, 'index.html');
        if (!pathname.endsWith('index.html') && !pathname.endsWith('/')) {
          pathname += '/';
        }
      }
      return `${origin}${pathname}?c=${encodeURIComponent(slug)}`;
    }
  }

  // Instantiate singleton
  const clientInstance = new SupabaseCelebrationClient();
  window.SupabaseCelebrationClient = clientInstance;
  window.SupabaseClient = clientInstance;

  // CommonJS / Module export support for test environments
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SupabaseCelebrationClient,
      clientInstance,
      SUPABASE_CONFIG,
    };
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
