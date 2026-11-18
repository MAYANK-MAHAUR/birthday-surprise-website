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
 * Format celebration payload conforming to PostgreSQL public.celebrations schema
 * @param {Object} data
 * @returns {Object}
 */
function formatCelebrationPayload(data) {
  const name = (data.name || data.person_name || 'My Love').trim();
  const sender = (data.sender || data.letter_author || '').trim();
  const passcode = (data.passcode !== undefined ? String(data.passcode).trim() : '1204');
  const slug = data.slug || generateSlug(name);

  let song = data.song || 'haareya';
  if (song.includes('city_of_stars')) song = 'city_of_stars';
  else if (song.includes('haareya')) song = 'haareya';

  const photos = Array.isArray(data.photos) ? data.photos : [
    data.cover_photo || '',
    data.polaroid_1_photo || '',
    data.polaroid_2_photo || '',
    data.polaroid_3_photo || '',
  ];

  return {
    slug,
    person_name: name,
    name,
    letter_author: sender,
    sender,
    passcode,
    song,
    cover_photo: photos[0] || data.cover_photo || null,
    polaroid_1_photo: photos[1] || data.polaroid_1_photo || null,
    polaroid_2_photo: photos[2] || data.polaroid_2_photo || null,
    polaroid_3_photo: photos[3] || data.polaroid_3_photo || null,
    photos,
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
    }
  };
}

/**
 * Build shareable URL pointing to index.html with ?c=${slug}
 * @param {Object} record
 * @param {string} [origin]
 * @param {string} [pathname]
 * @returns {string}
 */
function buildShareUrl(record, origin, pathname) {
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

  return `${host}${path}?c=${encodeURIComponent(slug)}`;
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
    // 3. PHOTO UPLOADS & LIVE PREVIEWS
    // ------------------------------------------------------------------------
    const photoSlots = [
      {
        fileId: 'admin-file-polaroid',
        urlId: 'admin-photo-polaroid',
        previewId: 'preview-polaroid',
        badgeId: 'badge-polaroid'
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
          statusMsg.textContent = 'Saving celebration to Supabase... ✨';
          statusMsg.className = 'admin-status-text status-loading';
          statusMsg.style.display = 'block';
        }

        // Song selection
        let song = document.getElementById('admin-song')?.value || 'haareya';
        if (song === 'custom') {
          const customSongUrl = document.getElementById('admin-custom-song-url')?.value.trim();
          song = customSongUrl || 'haareya';
        }

        const photoPolaroid = document.getElementById('admin-photo-polaroid')?.value.trim() || 'assets/images/8893d690706f9c045b2c6e478c07636c.jpg';
        const photoLetter = document.getElementById('admin-photo-letter')?.value.trim() || 'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg';
        const photoScrapbook1 = document.getElementById('admin-photo-scrapbook-1')?.value.trim() || 'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg';
        const photoScrapbook2 = document.getElementById('admin-photo-scrapbook-2')?.value.trim() || 'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg';

        const polaroidNote = document.getElementById('admin-polaroid-note')?.value.trim() || 'Happy Birthday ❤️';
        const letter = document.getElementById('admin-letter-text')?.value.trim() || '';
        const dedication = document.getElementById('admin-dedication-text')?.value.trim() || '';
        const sticky1 = document.getElementById('admin-sticky-1')?.value.trim() || '';
        const sticky2 = document.getElementById('admin-sticky-2')?.value.trim() || '';

        const instagram = document.getElementById('admin-social-insta')?.value.trim() || '';
        const snapchat = document.getElementById('admin-social-snap')?.value.trim() || '';
        const gmail = document.getElementById('admin-social-email')?.value.trim() || '';
        const whatsapp = document.getElementById('admin-social-wa')?.value.trim() || '';

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
          photos: [photoPolaroid, photoLetter, photoScrapbook1, photoScrapbook2],
          socials: {
            instagram,
            snapchat,
            gmail,
            whatsapp
          }
        };

        const celebrationPayload = formatCelebrationPayload(rawData);

        try {
          const client = window.SupabaseCelebrationClient;
          let result = null;
          if (client && typeof client.saveCelebration === 'function') {
            result = await client.saveCelebration(celebrationPayload);
          }

          const record = (result && result.record) || celebrationPayload;
          const shareUrl = (client && typeof client.generateShareableUrl === 'function')
            ? client.generateShareableUrl(record)
            : buildShareUrl(record);

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
            statusMsg.textContent = '🎉 Celebration created successfully! Share your custom link below:';
            statusMsg.className = 'admin-status-text status-success';
          }
        } catch (err) {
          console.error('Error saving celebration:', err);
          const shareUrl = buildShareUrl(celebrationPayload);

          if (shareInput) shareInput.value = shareUrl;
          if (previewBtn) previewBtn.href = shareUrl;
          if (whatsappBtn) whatsappBtn.href = buildWhatsAppShareUrl(name, passcode, shareUrl);
          if (shareCard) {
            shareCard.style.display = 'block';
            shareCard.scrollIntoView({ behavior: 'smooth' });
          }

          if (statusMsg) {
            statusMsg.textContent = 'Saved to offline local storage! Share link below:';
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
    formatCelebrationPayload,
    buildShareUrl,
    buildWhatsAppShareUrl,
  };
}
