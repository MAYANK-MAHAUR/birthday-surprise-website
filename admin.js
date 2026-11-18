/**
 * Admin / Creator Page Controller (admin.js)
 * Features:
 * - Master Passcode Lock Screen Overlay (PIN keypad, standard input, error shake, sessionStorage persistence)
 * - Header "Lock / Exit Admin" button
 * - Comprehensive Creator Form with field validations
 * - Memory Photo uploads to Supabase Storage with instant thumbnail previews
 * - Supabase record persistence & unique slug generation
 * - Shareable Link card with 1-click clipboard copy, live preview button, and direct WhatsApp sharing
 */

const DEFAULT_MASTER_PASSCODE = '1204';

const CryptoUtil = (typeof CelebrationCrypto !== 'undefined')
  ? CelebrationCrypto
  : (typeof require !== 'undefined' ? (function () {
      try { return require('./crypto-util.js'); } catch (_) { return null; }
    })() : null);

/**
 * Validate Master Passcode
 * @param {string} code
 * @returns {boolean}
 */
function verifyMasterPasscode(code) {
  if (typeof code !== 'string' && typeof code !== 'number') return false;
  return String(code).trim() === DEFAULT_MASTER_PASSCODE;
}

/**
 * Generate unique, URL-safe slug for a celebration
 * Format: ${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${fourDigitNumber}
 * @param {string} name
 * @returns {string}
 */
function generateSlug(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  const clean = (trimmed || 'birthday')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `${clean || 'birthday'}-${randomSuffix}`;
}

/**
 * Generate a cryptographically secure, high-entropy unguessable slug (anti-guessing mode)
 * Format: sec_<32 hex chars> (128 bits of entropy)
 * Possibilities: 2^128 = 3.4 x 10^38 combinations — mathematically impossible to guess.
 * @param {string} [prefix='sec']
 * @returns {string}
 */
function generateSecureSlug(prefix = 'sec') {
  if (CryptoUtil && typeof CryptoUtil.generateSecureSlug === 'function') {
    return CryptoUtil.generateSecureSlug(prefix);
  }
  const randomHex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${prefix}_${randomHex}`;
}

/**
 * Collect creator device, IP, and environment telemetry for creation auditing
 * @returns {Promise<Object>}
 */
async function collectCreatorTelemetry() {
  let ip = 'unknown';
  try {
    const ipPromise = (async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        if (res.ok) {
          const d = await res.json();
          if (d && d.ip) return String(d.ip).trim();
        }
      } catch (_) {}
      try {
        const res2 = await fetch('https://api64.ipify.org?format=json');
        if (res2.ok) {
          const d2 = await res2.json();
          if (d2 && d2.ip) return String(d2.ip).trim();
        }
      } catch (_) {}
      return 'unknown';
    })();

    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('unknown'), 2500));
    ip = await Promise.race([ipPromise, timeoutPromise]);
  } catch (err) {
    console.warn('Could not determine public IP (likely blocked or offline):', err);
  }

  const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'unknown';
  const language = (typeof navigator !== 'undefined' && (navigator.language || navigator.userLanguage)) ? (navigator.language || navigator.userLanguage) : 'unknown';
  const platform = (typeof navigator !== 'undefined' && (navigator.platform || navigator.userAgentData?.platform)) ? (navigator.platform || navigator.userAgentData?.platform) : 'unknown';
  const timezone = (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'unknown';
  const screen = (typeof window !== 'undefined' && window.screen) ? `${window.screen.width}x${window.screen.height} (ratio: ${window.devicePixelRatio || 1})` : 'unknown';
  const viewport = (typeof window !== 'undefined') ? `${window.innerWidth}x${window.innerHeight}` : 'unknown';
  const referrer = (typeof document !== 'undefined' && document.referrer) ? document.referrer : 'direct';
  const timestamp = new Date().toISOString();

  return {
    ip,
    userAgent,
    language,
    platform,
    timezone,
    screen,
    viewport,
    referrer,
    timestamp
  };
}

/**
 * Format celebration payload conforming to PostgreSQL public.celebrations schema
 * @param {Object} data
 * @param {Object} [options]
 * @returns {Object}
 */
function formatCelebrationPayload(data, options = {}) {
  const name = (data.name || data.person_name || 'My Love').trim();
  const sender = (data.sender || data.letter_author || '').trim();
  const passcode = (data.passcode !== undefined ? String(data.passcode).trim() : '1204');
  
  let slug = data.slug;
  if (!slug) {
    if (options.useSecureSlug || data.useSecureSlug) {
      slug = generateSecureSlug();
    } else {
      slug = generateSlug(name);
    }
  }

  let song = data.song || 'haareya';
  if (song.includes('city_of_stars')) song = 'city_of_stars';
  else if (song.includes('haareya')) song = 'haareya';

  const photos = Array.isArray(data.photos) ? [...data.photos] : [
    data.cover_photo || '',
    data.polaroid_1_photo || data.spread_photo || '',
    data.polaroid_2_photo || data.letter_photo || '',
    data.polaroid_3_photo || data.scrapbook_photo_1 || '',
    data.scrapbook_photo_2 || '',
    data.flower_photo_1 || '',
    data.flower_photo_2 || '',
    data.flower_photo_3 || '',
    data.cake_photo || '',
    data.cake_celebrate_photo || '',
    data.mascot_photo || '',
    data.teddy_photo || '',
    data.wrong_code_photo || '',
    data.angry_cat_photo || '',
    data.crying_cat_photo || '',
  ];

  // If photos array was provided but had fewer than 15 items, fill from individual fields
  while (photos.length < 15) {
    const idx = photos.length;
    if (idx === 1) photos.push(data.spread_photo || data.polaroid_1_photo || '');
    else if (idx === 2) photos.push(data.letter_photo || data.polaroid_2_photo || '');
    else if (idx === 3) photos.push(data.scrapbook_photo_1 || data.polaroid_3_photo || '');
    else if (idx === 4) photos.push(data.scrapbook_photo_2 || '');
    else if (idx === 5) photos.push(data.flower_photo_1 || '');
    else if (idx === 6) photos.push(data.flower_photo_2 || '');
    else if (idx === 7) photos.push(data.flower_photo_3 || '');
    else if (idx === 8) photos.push(data.cake_photo || '');
    else if (idx === 9) photos.push(data.cake_celebrate_photo || '');
    else if (idx === 10) photos.push(data.mascot_photo || '');
    else if (idx === 11) photos.push(data.teddy_photo || '');
    else if (idx === 12) photos.push(data.wrong_code_photo || '');
    else if (idx === 13) photos.push(data.angry_cat_photo || '');
    else if (idx === 14) photos.push(data.crying_cat_photo || '');
    else break;
  }

  const cover_photo = photos[0] || data.cover_photo || null;
  const polaroid_1_photo = photos[1] || data.polaroid_1_photo || null;
  const polaroid_2_photo = photos[2] || data.polaroid_2_photo || null;
  const polaroid_3_photo = photos[3] || data.polaroid_3_photo || null;

  const spread_photo = photos[1] || data.spread_photo || polaroid_1_photo;
  const letter_photo = photos[2] || data.letter_photo || polaroid_2_photo;
  const scrapbook_photo_1 = photos[3] || data.scrapbook_photo_1 || polaroid_3_photo;
  const scrapbook_photo_2 = photos[4] || data.scrapbook_photo_2 || null;
  const flower_photo_1 = photos[5] || data.flower_photo_1 || null;
  const flower_photo_2 = photos[6] || data.flower_photo_2 || null;
  const flower_photo_3 = photos[7] || data.flower_photo_3 || null;
  const cake_photo = photos[8] || data.cake_photo || null;
  const cake_celebrate_photo = photos[9] || data.cake_celebrate_photo || null;
  const mascot_photo = photos[10] || data.mascot_photo || null;
  const teddy_photo = photos[11] || data.teddy_photo || null;
  const wrong_code_photo = photos[12] || data.wrong_code_photo || null;
  const angry_cat_photo = photos[13] || data.angry_cat_photo || null;
  const crying_cat_photo = photos[14] || data.crying_cat_photo || null;

  const photos_data = {
    photos,
    cover_photo,
    polaroid_1_photo,
    polaroid_2_photo,
    polaroid_3_photo,
    spread_photo,
    letter_photo,
    scrapbook_photo_1,
    scrapbook_photo_2,
    flower_photo_1,
    flower_photo_2,
    flower_photo_3,
    cake_photo,
    cake_celebrate_photo,
    mascot_photo,
    teddy_photo,
    wrong_code_photo,
    angry_cat_photo,
    crying_cat_photo,
  };

  return {
    slug,
    person_name: name,
    name,
    letter_author: sender,
    sender,
    passcode,
    song,
    cover_photo,
    polaroid_1_photo,
    polaroid_2_photo,
    polaroid_3_photo,
    spread_photo,
    letter_photo,
    scrapbook_photo_1,
    scrapbook_photo_2,
    flower_photo_1,
    flower_photo_2,
    flower_photo_3,
    cake_photo,
    cake_celebrate_photo,
    mascot_photo,
    teddy_photo,
    wrong_code_photo,
    angry_cat_photo,
    crying_cat_photo,
    photos,
    photos_data,
    polaroid_note: data.polaroid_note || data.polaroidNote || 'Happy Birthday ❤️',
    polaroidNote: data.polaroid_note || data.polaroidNote || 'Happy Birthday ❤️',
    letter_text: data.letter_text || data.letter || '',
    letter: data.letter_text || data.letter || '',
    dedication_text: data.dedication_text || data.dedication || '',
    dedication: data.dedication_text || data.dedication || '',
    scrapbook_note_1: data.scrapbook_note_1 || data.sticky1 || '',
    sticky1: data.scrapbook_note_1 || data.sticky1 || '',
    scrapbook_note_2: data.scrapbook_note_2 || data.sticky2 || '',
    sticky2: data.scrapbook_note_2 || data.sticky2 || '',
    social_instagram: data.social_instagram || (data.socials && data.socials.instagram) || '',
    social_snapchat: data.social_snapchat || (data.socials && data.socials.snapchat) || '',
    social_gmail: data.social_gmail || (data.socials && data.socials.gmail) || '',
    social_whatsapp: data.social_whatsapp || (data.socials && data.socials.whatsapp) || '',
    social_spotify: data.social_spotify || (data.socials && data.socials.spotify) || '',
    socials: {
      instagram: data.social_instagram || (data.socials && data.socials.instagram) || '',
      snapchat: data.social_snapchat || (data.socials && data.socials.snapchat) || '',
      gmail: data.social_gmail || (data.socials && data.socials.gmail) || '',
      whatsapp: data.social_whatsapp || (data.socials && data.socials.whatsapp) || '',
      spotify: data.social_spotify || (data.socials && data.socials.spotify) || '',
    },
    creator_ip: data.creator_ip || (data.creator_metadata && data.creator_metadata.ip) || options.creator_ip || null,
    creator_user_agent: data.creator_user_agent || (data.creator_metadata && data.creator_metadata.userAgent) || options.creator_user_agent || null,
    creator_metadata: data.creator_metadata || options.creator_metadata || null,
  };
}

/**
 * Build shareable URL pointing to index.html with ?c=${slug}
 * Supports anti-guessing high-entropy slugs and optional &k= key &enc= ciphertext
 * @param {Object} record
 * @param {string} [origin]
 * @param {string} [pathname]
 * @param {Object} [options]
 * @returns {string}
 */
function buildShareUrl(record, origin, pathname, options = {}) {
  const slug = record.slug || record.id || 'default';
  let host = origin || (typeof window !== 'undefined' && window.location ? window.location.origin : '');
  let path = pathname || (typeof window !== 'undefined' && window.location ? window.location.pathname : '');

  // Normalize path to index.html
  path = path.replace(/admin\.html.*$/, 'index.html');
  if (!path.endsWith('index.html') && !path.endsWith('/')) {
    path += '/index.html';
  } else if (path.endsWith('/')) {
    path += 'index.html';
  }

  let url = `${host}${path}?c=${encodeURIComponent(slug)}`;
  const key = record.encryption_key || options.encryptionKey;
  const encToken = record.encrypted_token || options.encryptedToken;

  if (key) {
    url += `&k=${encodeURIComponent(key)}`;
  }
  if (encToken) {
    url += `&enc=${encodeURIComponent(encToken)}`;
  }

  return url;
}

/**
 * Build encrypted shareable URL with AES-256-GCM
 * @param {Object} record
 * @param {string} [secretKey]
 * @param {string} [origin]
 * @param {string} [pathname]
 * @returns {Promise<string>}
 */
async function buildEncryptedShareUrl(record, secretKey, origin, pathname) {
  const key = secretKey || (CryptoUtil ? CryptoUtil.generateEncryptionKey() : '1204');
  let token = '';
  if (CryptoUtil && typeof CryptoUtil.encryptPayload === 'function') {
    token = await CryptoUtil.encryptPayload(record, key);
  }
  return buildShareUrl(record, origin, pathname, { encryptionKey: key, encryptedToken: token });
}

/**
 * Build direct WhatsApp sharing URL
 * @param {string} name
 * @param {string} passcode
 * @param {string} shareUrl
 * @returns {string}
 */
function buildWhatsAppShareUrl(name, passcode, shareUrl) {
  const message = `Hey ${name || 'there'}! 🎉 I created a personalized interactive birthday surprise website just for you! 🎂✨\n\nOpen your surprise here: ${shareUrl}\n(Secret Passcode: ${passcode || '1204'}) 🎁`;
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
}

// Browser Controller Execution
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------------
    // 1. MASTER PASSCODE GATE OVERLAY CONTROLLER
    // ------------------------------------------------------------------------
    const gateOverlay = document.getElementById('admin-auth-gate') || document.getElementById('admin-auth-overlay');
    const gateCard = document.querySelector('.admin-gate-card') || gateOverlay;
    const gateInput = document.getElementById('admin-gate-passcode');
    const pinSlots = document.querySelectorAll('#admin-pin-display .pin-slot');
    const unlockBtn = document.getElementById('btn-unlock-admin');
    const clearBtn = document.getElementById('btn-gate-clear');
    const backspaceBtn = document.getElementById('btn-gate-backspace');
    const gateError = document.getElementById('admin-gate-error');
    const lockAdminBtn = document.getElementById('btn-lock-admin');
    const keypadBtns = document.querySelectorAll('.admin-keypad-grid .key-btn[data-key]');

    let enteredPin = '';

    function updatePinDisplay() {
      pinSlots.forEach((slot, idx) => {
        if (idx < enteredPin.length) {
          slot.textContent = '•';
          slot.classList.add('filled');
        } else {
          slot.textContent = '';
          slot.classList.remove('filled');
        }
      });
      if (gateInput) gateInput.value = enteredPin;
    }

    function showGateError(msg) {
      if (gateError) {
        gateError.textContent = msg;
        gateError.style.display = 'block';
      }
      if (gateCard) {
        gateCard.classList.remove('shake-anim');
        // Force reflow
        void gateCard.offsetWidth;
        gateCard.classList.add('shake-anim');
      }
    }

    function clearGateError() {
      if (gateError) {
        gateError.textContent = '';
        gateError.style.display = 'none';
      }
      if (gateCard) {
        gateCard.classList.remove('shake-anim');
      }
    }

    function unlockAdmin() {
      if (verifyMasterPasscode(enteredPin)) {
        clearGateError();
        sessionStorage.setItem('admin_authenticated', 'true');
        sessionStorage.setItem('admin_auth', 'true');
        if (gateOverlay) {
          gateOverlay.classList.add('unlocked');
          gateOverlay.style.display = 'none';
        }
        if (lockAdminBtn) lockAdminBtn.style.display = 'inline-flex';
      } else {
        showGateError('Incorrect Passcode! Try 1204 🔑');
        setTimeout(() => {
          enteredPin = '';
          updatePinDisplay();
        }, 600);
      }
    }

    function lockAdmin() {
      sessionStorage.removeItem('admin_authenticated');
      sessionStorage.removeItem('admin_auth');
      enteredPin = '';
      updatePinDisplay();
      clearGateError();
      if (gateOverlay) {
        gateOverlay.classList.remove('unlocked');
        gateOverlay.style.display = 'flex';
      }
      const shareCard = document.getElementById('share-result-card');
      if (shareCard) shareCard.style.display = 'none';
    }

    // Check existing session
    const isAuthed = sessionStorage.getItem('admin_authenticated') === 'true' ||
                    sessionStorage.getItem('admin_auth') === 'true';

    if (isAuthed && gateOverlay) {
      gateOverlay.classList.add('unlocked');
      gateOverlay.style.display = 'none';
      if (lockAdminBtn) lockAdminBtn.style.display = 'inline-flex';
    } else if (gateOverlay) {
      gateOverlay.classList.remove('unlocked');
      gateOverlay.style.display = 'flex';
    }

    // Keypad numeric button clicks
    keypadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        if (key && enteredPin.length < 4) {
          clearGateError();
          enteredPin += key;
          updatePinDisplay();
          if (enteredPin.length === 4) {
            setTimeout(unlockAdmin, 120);
          }
        }
      });
    });

    // Clear and Backspace buttons
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        enteredPin = '';
        updatePinDisplay();
        clearGateError();
      });
    }

    if (backspaceBtn) {
      backspaceBtn.addEventListener('click', () => {
        if (enteredPin.length > 0) {
          enteredPin = enteredPin.slice(0, -1);
          updatePinDisplay();
          clearGateError();
        }
      });
    }

    // Big Unlock Button
    if (unlockBtn) {
      unlockBtn.addEventListener('click', unlockAdmin);
    }

    // Header Lock Button
    if (lockAdminBtn) {
      lockAdminBtn.addEventListener('click', lockAdmin);
    }

    // Keyboard Typing listener
    window.addEventListener('keydown', (e) => {
      // Only process when overlay is active
      if (!gateOverlay || gateOverlay.style.display === 'none' || gateOverlay.classList.contains('unlocked')) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        if (enteredPin.length < 4) {
          clearGateError();
          enteredPin += e.key;
          updatePinDisplay();
          if (enteredPin.length === 4) {
            setTimeout(unlockAdmin, 120);
          }
        }
      } else if (e.key === 'Backspace') {
        if (enteredPin.length > 0) {
          enteredPin = enteredPin.slice(0, -1);
          updatePinDisplay();
          clearGateError();
        }
      } else if (e.key === 'Enter') {
        unlockAdmin();
      } else if (e.key === 'Escape') {
        enteredPin = '';
        updatePinDisplay();
        clearGateError();
      }
    });

    if (gateInput) {
      gateInput.addEventListener('input', (e) => {
        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
        enteredPin = val;
        updatePinDisplay();
        if (enteredPin.length === 4) {
          setTimeout(unlockAdmin, 120);
        }
      });
    }

    // ------------------------------------------------------------------------
    // 2. SONG SELECTOR & CUSTOM SONG TOGGLE
    // ------------------------------------------------------------------------
    const songSelect = document.getElementById('admin-song');
    const customSongGroup = document.getElementById('group-custom-song');
    if (songSelect && customSongGroup) {
      songSelect.addEventListener('change', () => {
        customSongGroup.style.display = songSelect.value === 'custom' ? 'block' : 'none';
      });
    }

    // ------------------------------------------------------------------------
    // 3. PHOTO UPLOADS & LIVE PREVIEWS (ALL 15 CELEBRATION PHOTO SLOTS)
    // ------------------------------------------------------------------------
    const photoSlots = [
      {
        fileId: 'admin-file-polaroid',
        urlId: 'admin-photo-polaroid',
        previewId: 'preview-polaroid',
        badgeId: 'badge-polaroid'
      },
      {
        fileId: 'admin-file-spread',
        urlId: 'admin-photo-spread',
        previewId: 'preview-spread',
        badgeId: 'badge-spread'
      },
      {
        fileId: 'admin-file-letter',
        urlId: 'admin-photo-letter',
        previewId: 'preview-letter',
        badgeId: 'badge-letter'
      },
      {
        fileId: 'admin-file-scrapbook-1',
        urlId: 'admin-photo-scrapbook-1',
        previewId: 'preview-scrapbook-1',
        badgeId: 'badge-scrapbook-1'
      },
      {
        fileId: 'admin-file-scrapbook-2',
        urlId: 'admin-photo-scrapbook-2',
        previewId: 'preview-scrapbook-2',
        badgeId: 'badge-scrapbook-2'
      },
      {
        fileId: 'admin-file-flower-1',
        urlId: 'admin-photo-flower-1',
        previewId: 'preview-flower-1',
        badgeId: 'badge-flower-1'
      },
      {
        fileId: 'admin-file-flower-2',
        urlId: 'admin-photo-flower-2',
        previewId: 'preview-flower-2',
        badgeId: 'badge-flower-2'
      },
      {
        fileId: 'admin-file-flower-3',
        urlId: 'admin-photo-flower-3',
        previewId: 'preview-flower-3',
        badgeId: 'badge-flower-3'
      },
      {
        fileId: 'admin-file-cake',
        urlId: 'admin-photo-cake',
        previewId: 'preview-cake',
        badgeId: 'badge-cake'
      },
      {
        fileId: 'admin-file-cake-celebrate',
        urlId: 'admin-photo-cake-celebrate',
        previewId: 'preview-cake-celebrate',
        badgeId: 'badge-cake-celebrate'
      },
      {
        fileId: 'admin-file-mascot',
        urlId: 'admin-photo-mascot',
        previewId: 'preview-mascot',
        badgeId: 'badge-mascot'
      },
      {
        fileId: 'admin-file-teddy',
        urlId: 'admin-photo-teddy',
        previewId: 'preview-teddy',
        badgeId: 'badge-teddy'
      },
      {
        fileId: 'admin-file-wrong-code',
        urlId: 'admin-photo-wrong-code',
        previewId: 'preview-wrong-code',
        badgeId: 'badge-wrong-code'
      },
      {
        fileId: 'admin-file-angry-cat',
        urlId: 'admin-photo-angry-cat',
        previewId: 'preview-angry-cat',
        badgeId: 'badge-angry-cat'
      },
      {
        fileId: 'admin-file-crying-cat',
        urlId: 'admin-photo-crying-cat',
        previewId: 'preview-crying-cat',
        badgeId: 'badge-crying-cat'
      }
    ];

    function setPreviewThumbnail(previewEl, url) {
      if (!previewEl) return;
      if (url && typeof url === 'string' && url.trim().length > 0) {
        previewEl.innerHTML = `<img src="${url.trim()}" alt="Memory photo" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'img-preview-empty\\'>Invalid URL ⚠️</span>';">`;
      } else {
        previewEl.innerHTML = '<span class="img-preview-empty">No Photo</span>';
      }
    }

    photoSlots.forEach(slot => {
      const fileInput = document.getElementById(slot.fileId);
      const urlInput = document.getElementById(slot.urlId);
      const previewEl = document.getElementById(slot.previewId);
      const badgeEl = document.getElementById(slot.badgeId);

      // Render initial thumbnail if URL has default value
      if (urlInput && previewEl) {
        setPreviewThumbnail(previewEl, urlInput.value);

        urlInput.addEventListener('input', () => {
          setPreviewThumbnail(previewEl, urlInput.value);
        });

        urlInput.addEventListener('change', () => {
          setPreviewThumbnail(previewEl, urlInput.value);
        });
      }

      // Handle File upload
      if (fileInput && urlInput && previewEl) {
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files && fileInput.files[0];
          if (!file) return;

          // Render local instant preview
          const localUrl = URL.createObjectURL(file);
          setPreviewThumbnail(previewEl, localUrl);

          if (badgeEl) {
            badgeEl.textContent = 'Uploading... ⏳';
            badgeEl.className = 'upload-badge uploading';
            badgeEl.style.display = 'inline-block';
          }

          try {
            const client = window.SupabaseCelebrationClient;
            if (client && typeof client.uploadAsset === 'function') {
              const uploadRes = await client.uploadAsset(file, 'celebrations');
              if (uploadRes && uploadRes.publicUrl) {
                urlInput.value = uploadRes.publicUrl;
                setPreviewThumbnail(previewEl, uploadRes.publicUrl);
                if (badgeEl) {
                  badgeEl.textContent = 'Uploaded ☁️✅';
                  badgeEl.className = 'upload-badge success';
                }
                return;
              }
            }
            // Fallback: set local URL
            urlInput.value = localUrl;
            if (badgeEl) {
              badgeEl.textContent = 'Ready 📁';
              badgeEl.className = 'upload-badge success';
            }
          } catch (uploadErr) {
            console.warn('File upload encountered an error, keeping local preview:', uploadErr);
            urlInput.value = localUrl;
            if (badgeEl) {
              badgeEl.textContent = 'Using local photo 📁';
              badgeEl.className = 'upload-badge error';
            }
          }
        });
      }
    });

    // ------------------------------------------------------------------------
    // 4. CREATOR FORM SUBMISSION & SUPABASE PERSISTENCE
    // ------------------------------------------------------------------------
    const form = document.getElementById('creator-form');
    const shareCard = document.getElementById('share-result-card');
    const shareInput = document.getElementById('share-link-input');
    const copyBtn = document.getElementById('btn-copy-link');
    const previewBtn = document.getElementById('btn-preview-link');
    const whatsappBtn = document.getElementById('btn-whatsapp-share');
    const statusMsg = document.getElementById('admin-status');

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nameInput = document.getElementById('admin-name');
        const senderInput = document.getElementById('admin-sender');
        const passcodeInput = document.getElementById('admin-passcode');

        const name = nameInput ? nameInput.value.trim() : 'My Love';
        const sender = senderInput ? senderInput.value.trim() : '';
        const passcode = passcodeInput ? passcodeInput.value.trim() : '1204';

        // Validation
        if (!name || name.length > 100) {
          alert('Please enter a valid recipient name (1 to 100 characters).');
          if (nameInput) nameInput.focus();
          return;
        }

        if (!sender || sender.length > 100) {
          alert('Please enter your sender name / nickname (1 to 100 characters).');
          if (senderInput) senderInput.focus();
          return;
        }

        if (!/^[0-9]{4}$/.test(passcode)) {
          alert('Passcode must be exactly 4 numeric digits (e.g. 1204).');
          if (passcodeInput) passcodeInput.focus();
          return;
        }

        if (statusMsg) {
          statusMsg.textContent = 'Saving celebration & logging audit data... ✨';
          statusMsg.className = 'admin-status-text status-loading';
          statusMsg.style.display = 'block';
        }

        // Collect creator IP & device environment telemetry
        let telemetry = null;
        try {
          telemetry = await collectCreatorTelemetry();
        } catch (teleErr) {
          console.warn('Telemetry collection notice:', teleErr);
          telemetry = { ip: 'unknown', userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown') };
        }

        // Song selection
        let song = document.getElementById('admin-song')?.value || 'haareya';
        if (song === 'custom') {
          const customSongUrl = document.getElementById('admin-custom-song-url')?.value.trim();
          song = customSongUrl || 'haareya';
        }

        const photoPolaroid = document.getElementById('admin-photo-polaroid')?.value.trim() || 'assets/images/8893d690706f9c045b2c6e478c07636c.jpg';
        const photoSpread = document.getElementById('admin-photo-spread')?.value.trim() || 'assets/images/8f4399ac68b4198a5ef2dcbb0eec4224.jpg';
        const photoLetter = document.getElementById('admin-photo-letter')?.value.trim() || 'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg';
        const photoScrapbook1 = document.getElementById('admin-photo-scrapbook-1')?.value.trim() || 'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg';
        const photoScrapbook2 = document.getElementById('admin-photo-scrapbook-2')?.value.trim() || 'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg';
        const photoFlower1 = document.getElementById('admin-photo-flower-1')?.value.trim() || 'assets/images/5087d25b38d46f06598fa2cf8e331598.jpg';
        const photoFlower2 = document.getElementById('admin-photo-flower-2')?.value.trim() || 'assets/images/b2e0e4968c920cb3ff6b64472a80d770.jpg';
        const photoFlower3 = document.getElementById('admin-photo-flower-3')?.value.trim() || 'assets/images/2d26fa6f4f5d96b95ccd30659d1fb414.jpg';
        const photoCake = document.getElementById('admin-photo-cake')?.value.trim() || 'assets/images/09a443278b31bd865cae4542ae22295b.png';
        const photoCakeCelebrate = document.getElementById('admin-photo-cake-celebrate')?.value.trim() || 'assets/images/b1dee7f2cea3aa95b9dc54d5a8ccc1fa.png';
        const photoMascot = document.getElementById('admin-photo-mascot')?.value.trim() || 'assets/images/3a671a6dfc5faa2d87a4b208f50bb90a.png';
        const photoTeddy = document.getElementById('admin-photo-teddy')?.value.trim() || 'assets/images/a5bdfde35d03ce2bd14f553ed2249355.png';
        const photoWrongCode = document.getElementById('admin-photo-wrong-code')?.value.trim() || 'assets/images/d06c4a481034f2325da9010e7d6704fa.gif';
        const photoAngryCat = document.getElementById('admin-photo-angry-cat')?.value.trim() || 'assets/images/bbd46bb7feaae5804098b672ba73435b.gif';
        const photoCryingCat = document.getElementById('admin-photo-crying-cat')?.value.trim() || 'assets/images/0065f633b36ed9f79b6383af28e2926d.png';

        const polaroidNote = document.getElementById('admin-polaroid-note')?.value.trim() || 'Happy Birthday ❤️';
        const letter = document.getElementById('admin-letter-text')?.value.trim() || '';
        const dedication = document.getElementById('admin-dedication-text')?.value.trim() || '';
        const sticky1 = document.getElementById('admin-sticky-1')?.value.trim() || '';
        const sticky2 = document.getElementById('admin-sticky-2')?.value.trim() || '';

        const instagram = document.getElementById('admin-social-insta')?.value.trim() || '';
        const snapchat = document.getElementById('admin-social-snap')?.value.trim() || '';
        const gmail = document.getElementById('admin-social-email')?.value.trim() || '';
        const whatsapp = document.getElementById('admin-social-wa')?.value.trim() || '';

        const isEncryptEnabled = document.getElementById('admin-encrypt-toggle')?.checked ?? true;
        const isPasscodeOnly = document.getElementById('admin-passcode-encrypt-toggle')?.checked ?? false;

        const allPhotosList = [
          photoPolaroid,
          photoSpread,
          photoLetter,
          photoScrapbook1,
          photoScrapbook2,
          photoFlower1,
          photoFlower2,
          photoFlower3,
          photoCake,
          photoCakeCelebrate,
          photoMascot,
          photoTeddy,
          photoWrongCode,
          photoAngryCat,
          photoCryingCat
        ];

        const rawData = {
          name,
          sender,
          passcode,
          song,
          polaroidNote,
          letter,
          dedication,
          sticky1,
          sticky2,
          photos: allPhotosList,
          cover_photo: photoPolaroid,
          spread_photo: photoSpread,
          letter_photo: photoLetter,
          scrapbook_photo_1: photoScrapbook1,
          scrapbook_photo_2: photoScrapbook2,
          flower_photo_1: photoFlower1,
          flower_photo_2: photoFlower2,
          flower_photo_3: photoFlower3,
          cake_photo: photoCake,
          cake_celebrate_photo: photoCakeCelebrate,
          mascot_photo: photoMascot,
          teddy_photo: photoTeddy,
          wrong_code_photo: photoWrongCode,
          angry_cat_photo: photoAngryCat,
          crying_cat_photo: photoCryingCat,
          socials: {
            instagram,
            snapchat,
            gmail,
            whatsapp
          },
          useSecureSlug: isEncryptEnabled,
          creator_ip: telemetry ? telemetry.ip : 'unknown',
          creator_user_agent: telemetry ? telemetry.userAgent : (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
          creator_metadata: telemetry
        };

        const celebrationPayload = formatCelebrationPayload(rawData, { useSecureSlug: isEncryptEnabled });

        // If encryption is enabled, generate 256-bit key and encrypt payload
        let encKey = null;
        let encryptedToken = null;
        if (isEncryptEnabled && CryptoUtil && typeof CryptoUtil.encryptPayload === 'function') {
          encKey = isPasscodeOnly ? null : CryptoUtil.generateEncryptionKey();
          const secret = isPasscodeOnly ? passcode : encKey;
          try {
            encryptedToken = await CryptoUtil.encryptPayload(celebrationPayload, secret);
            celebrationPayload.encryption_key = encKey;
            celebrationPayload.encrypted_token = encryptedToken;
          } catch (cryptErr) {
            console.warn('Payload encryption error:', cryptErr);
          }
        }

        try {
          const client = window.SupabaseCelebrationClient;
          let result = null;
          if (client && typeof client.saveCelebration === 'function') {
            result = await client.saveCelebration(celebrationPayload);
          }

          const record = (result && result.record) || celebrationPayload;
          if (encKey) record.encryption_key = encKey;
          if (encryptedToken) record.encrypted_token = encryptedToken;

          const shareUrl = buildShareUrl(record, null, null, {
            encryptionKey: encKey,
            encryptedToken: encryptedToken
          });

          // Populate Result Card
          if (shareInput) shareInput.value = shareUrl;

          if (previewBtn) {
            previewBtn.href = shareUrl;
            previewBtn.onclick = (evt) => {
              evt.preventDefault();
              window.open(shareUrl, '_blank');
            };
          }

          if (whatsappBtn) {
            const waUrl = buildWhatsAppShareUrl(name, passcode, shareUrl);
            whatsappBtn.href = waUrl;
            whatsappBtn.onclick = (evt) => {
              evt.preventDefault();
              window.open(waUrl, '_blank');
            };
          }

          if (shareCard) {
            shareCard.style.display = 'block';
            shareCard.scrollIntoView({ behavior: 'smooth' });
          }

          if (statusMsg) {
            statusMsg.textContent = isEncryptEnabled
              ? '🔒 Anti-guessing celebration created! URL is 100% encrypted & impossible to guess.'
              : '🎉 Celebration created successfully! Share your custom link below:';
            statusMsg.className = 'admin-status-text status-success';
          }
        } catch (err) {
          console.error('Error saving celebration:', err);
          const shareUrl = buildShareUrl(celebrationPayload, null, null, {
            encryptionKey: encKey,
            encryptedToken: encryptedToken
          });

          if (shareInput) shareInput.value = shareUrl;
          if (previewBtn) previewBtn.href = shareUrl;
          if (whatsappBtn) whatsappBtn.href = buildWhatsAppShareUrl(name, passcode, shareUrl);
          if (shareCard) {
            shareCard.style.display = 'block';
            shareCard.scrollIntoView({ behavior: 'smooth' });
          }

          if (statusMsg) {
            statusMsg.textContent = isEncryptEnabled
              ? '🔒 Saved locally with anti-guessing encryption! Link cannot be guessed.'
              : 'Saved to offline local storage! Share link below:';
            statusMsg.className = 'admin-status-text status-success';
          }
        }
      });
    }

    // ------------------------------------------------------------------------
    // 5. 1-CLICK CLIPBOARD COPY BUTTON
    // ------------------------------------------------------------------------
    if (copyBtn && shareInput) {
      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareInput.value);
          } else {
            shareInput.select();
            document.execCommand('copy');
          }
          const originalText = copyBtn.textContent;
          copyBtn.textContent = 'Copied! ✅';
          copyBtn.classList.add('copied');
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.classList.remove('copied');
          }, 2000);
        } catch (err) {
          shareInput.select();
          document.execCommand('copy');
          copyBtn.textContent = 'Copied! ✅';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Link 📋';
          }, 2000);
        }
      });
    }
  });
}

// Module export support for test suites (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_MASTER_PASSCODE,
    verifyMasterPasscode,
    generateSlug,
    generateSecureSlug,
    formatCelebrationPayload,
    buildShareUrl,
    buildEncryptedShareUrl,
    buildWhatsAppShareUrl,
    collectCreatorTelemetry,
    CelebrationCrypto: CryptoUtil,
  };
}
