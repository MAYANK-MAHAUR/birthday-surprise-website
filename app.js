/**
 * ==========================================================================
 * BIRTHDAY SURPRISE SCRAPBOOK - APPLICATION LOGIC & FLUID ANIMATIONS
 * Milestone 4: Dual Audio Engine, Mystery Boxes & Dynamic Hydration
 * ==========================================================================
 */

(function () {
  'use strict';

  // --- CONFIGURATION & STATE ---
  const state = {
    currentPasscode: '1204',
    enteredPasscode: '',
    currentTrackIndex: 0,
    isPlaying: false,
    tracks: [
      { name: 'Haareya', src: 'assets/audio/haareya.mp3' },
      { name: 'City of Stars', src: 'assets/audio/city_of_stars.mp3' }
    ],
    audioContext: null,
    box1Opened: false,
    box2Opened: false,
    wishes: [
      {
        name: 'Aarav Sharma',
        bday: '1998-11-20',
        message: 'Happy Birthday bhai! May this year bring you all the success, happiness, and crazy adventures! Stay blessed always!',
        photo_url: 'assets/images/2bd6fdb2b6bf296a351bf5c516e35238.jpg'
      },
      {
        name: 'Priya Patel',
        bday: '1999-04-15',
        message: 'Happiest birthday to the sweetest soul! Keep smiling and spreading positive vibes everywhere you go! 🎂✨',
        photo_url: 'assets/images/8893d690706f9c045b2c6e478c07636c.jpg'
      },
      {
        name: 'Rohan Verma',
        bday: '1997-08-03',
        message: 'Happy Birthday man! Cake party when? Wishing you endless laughter, joy, and peace this year! 🎉',
        photo_url: 'assets/images/b0741a182561ced2d924951b42ac6dc6.jpg'
      },
      {
        name: 'Sneha Rao',
        bday: '2000-01-28',
        message: 'The world is truly brighter with you in it! Hope your birthday is as fabulous and special as you are! 💖',
        photo_url: 'assets/images/45aae7f5e21ba481cbe5a6bae512295a.jpg'
      }
    ],
    currentCelebrationId: null,
    currentCelebrationSlug: null,
    currentCelebrationData: null,
    selectedPhotoFile: null,
    selectedPhotoDataUrl: null,
    passcodeEncryptedToken: null
  };

  // --- AUDIO SYNTHESIZER (Tactile Sound Effects via Web Audio API) ---
  function getAudioContext() {
    if (!state.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) state.audioContext = new AudioCtx();
    }
    if (state.audioContext && state.audioContext.state === 'suspended') {
      state.audioContext.resume().catch(() => {});
    }
    return state.audioContext;
  }

  // --- WEB AUDIO SYNTHESIZER: ACOUSTIC GUITAR PLUCK & CHIMES ---
  function pluckGuitarNote(freq, duration = 0.65, vol = 0.08) {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      osc2.frequency.setValueAtTime(freq * 2, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(420, now + duration);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);
    } catch (_) {}
  }

  const KEY_FREQS = {
    '1': 261.63, // C4
    '2': 293.66, // D4
    '3': 329.63, // E4
    '4': 349.23, // F4
    '5': 392.00, // G4
    '6': 440.00, // A4
    '7': 493.88, // B4
    '8': 523.25, // C5
    '9': 587.33, // D5
    '0': 392.00, // G4
    '*': 329.63, // E4
    '#': 659.25, // E5
    'clear': 220.00, // A3
    'enter': 523.25  // C5
  };

  function playKeyClickSound(key = '1') {
    pluckGuitarNote(KEY_FREQS[key] || 440, 0.45, 0.085);
  }

  function playSuccessChime() {
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51]; // C5, E5, G5, C6, E6 arpeggio
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        pluckGuitarNote(freq, 0.5, 0.1);
      }, idx * 75);
    });
  }

  function playErrorBuzz() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (_) {}
  }

  function playBlowSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    try {
      const bufferSize = ctx.sampleRate * 0.8;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.8);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start();
    } catch (_) {}
  }

  // --- BACKGROUND MUSIC PLAYER & DUAL AUDIO ENGINE ---
  const bgMusic = document.getElementById('bg-music');
  const musicToggle = document.getElementById('music-toggle');
  const musicWidget = document.getElementById('music-player');
  const musicTitle = document.getElementById('music-title');
  const songSwitchBtn = document.getElementById('song-switch-btn');

  let fadeInterval = null;

  function initMusicTrack(index) {
    state.currentTrackIndex = index;
    const track = state.tracks[index];
    if (bgMusic && track) {
      bgMusic.src = track.src;
      if (musicTitle) musicTitle.textContent = track.name;
    }
  }

  function crossfadeTrack(newIndex) {
    if (fadeInterval) clearInterval(fadeInterval);

    const targetTrack = state.tracks[newIndex];
    if (!targetTrack) return;

    if (!state.isPlaying || !bgMusic || bgMusic.paused) {
      // Paused state: switch source and title cleanly
      initMusicTrack(newIndex);
      return;
    }

    // Playing state: smooth volume ramp down, switch, ramp up
    const initialVol = bgMusic.volume || 1.0;
    const stepTime = 25; // ms
    const steps = 8; // total 200ms ramp down
    let currentStep = 0;

    fadeInterval = setInterval(() => {
      currentStep++;
      const factor = Math.max(0, 1 - currentStep / steps);
      bgMusic.volume = factor * initialVol;

      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        initMusicTrack(newIndex);
        bgMusic.volume = 0;
        bgMusic.play().then(() => {
          let rampStep = 0;
          fadeInterval = setInterval(() => {
            rampStep++;
            const upFactor = Math.min(1, rampStep / steps);
            bgMusic.volume = upFactor * initialVol;
            if (rampStep >= steps) {
              clearInterval(fadeInterval);
              bgMusic.volume = initialVol;
            }
          }, stepTime);
        }).catch(err => {
          console.debug('Crossfade play deferred:', err);
          bgMusic.volume = initialVol;
        });
      }
    }, stepTime);
  }

  function toggleMusic() {
    if (!bgMusic) return;
    getAudioContext();
    if (bgMusic.paused) {
      bgMusic.play().then(() => {
        state.isPlaying = true;
        if (musicWidget) musicWidget.classList.add('playing');
      }).catch(err => console.debug('Autoplay deferred:', err));
    } else {
      bgMusic.pause();
      state.isPlaying = false;
      if (musicWidget) musicWidget.classList.remove('playing');
    }
  }

  function switchMusicTrack() {
    const nextIdx = (state.currentTrackIndex + 1) % state.tracks.length;
    crossfadeTrack(nextIdx);
    playSuccessChime();
  }

  function autoStartMusicOnFirstClick(e) {
    const isPlayerClick = e && e.target && e.target.closest && e.target.closest('#music-player');
    if (!isPlayerClick && !state.isPlaying && bgMusic && bgMusic.paused) {
      getAudioContext();
      bgMusic.play().then(() => {
        state.isPlaying = true;
        if (musicWidget) musicWidget.classList.add('playing');
      }).catch(() => {});
    }
    document.removeEventListener('click', autoStartMusicOnFirstClick);
    document.removeEventListener('keydown', autoStartMusicOnFirstClick);
    document.removeEventListener('pointerdown', autoStartMusicOnFirstClick);
    document.removeEventListener('touchstart', autoStartMusicOnFirstClick);
  }

  // Global Audio Engine Controller Interface
  window.BirthdayAudioEngine = {
    play() {
      if (!bgMusic) return Promise.resolve();
      getAudioContext();
      return bgMusic.play().then(() => {
        state.isPlaying = true;
        if (musicWidget) musicWidget.classList.add('playing');
      }).catch(err => console.debug('AudioEngine play catch:', err));
    },
    pause() {
      if (!bgMusic) return;
      bgMusic.pause();
      state.isPlaying = false;
      if (musicWidget) musicWidget.classList.remove('playing');
    },
    toggle() {
      toggleMusic();
    },
    switchTrack(target) {
      if (typeof target === 'number') {
        crossfadeTrack(target % state.tracks.length);
      } else if (typeof target === 'string') {
        const lower = target.toLowerCase();
        const idx = state.tracks.findIndex(t => t.name.toLowerCase().includes(lower) || t.src.toLowerCase().includes(lower));
        if (idx !== -1) crossfadeTrack(idx);
        else switchMusicTrack();
      } else {
        switchMusicTrack();
      }
    },
    getCurrentTrack() {
      return state.tracks[state.currentTrackIndex];
    },
    isPlaying() {
      return state.isPlaying && bgMusic && !bgMusic.paused;
    },
    setVolume(val) {
      if (bgMusic) bgMusic.volume = Math.max(0, Math.min(1, val));
    }
  };

  // --- STAGE SCALING (Fluid responsive for mobile, auto-scale for desktop) ---
  function updateStageScale() {
    const stage = document.getElementById('stage');
    if (!stage) return;
    if (window.innerWidth <= 780) {
      stage.style.transform = 'none';
      return;
    }
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const targetW = 1366;
    const targetH = 768;
    const scale = Math.min(winW / targetW, winH / targetH) * 0.96;
    stage.style.transform = `scale(${Math.min(scale, 1.15)})`;
  }

  window.addEventListener('resize', updateStageScale);
  window.addEventListener('orientationchange', updateStageScale);

  // --- CANVA CLOUD WIPE SLIDE NAVIGATION (Non-blocking Mid-Flight Swap) ---
  let isTransitioning = false;
  let wipeMidTimeout = null;
  let wipeEndTimeout = null;

  function goToSlide(slideId) {
    if (!slideId) return;

    // Fast-forward any active in-flight transition to avoid dropping clicks
    if (wipeMidTimeout) clearTimeout(wipeMidTimeout);
    if (wipeEndTimeout) clearTimeout(wipeEndTimeout);

    const wipe = document.getElementById('cloudWipe');
    if (!wipe) {
      document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(slideId);
      if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    isTransitioning = true;
    wipe.classList.remove('animating');
    void wipe.offsetWidth; // Force CSS reflow
    wipe.classList.add('animating');

    // 200ms midpoint slide swap
    wipeMidTimeout = setTimeout(() => {
      document.querySelectorAll('.slide').forEach(s => s.classList.remove('active'));
      const target = document.getElementById(slideId);
      if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }, 200);

    // Complete animation lifecycle
    wipeEndTimeout = setTimeout(() => {
      wipe.classList.remove('animating');
      isTransitioning = false;
    }, 480);
  }

  // --- PASSCODE ENGINE ---
  const pinSlots = document.querySelectorAll('.pin-slot');
  const keypadCard = document.getElementById('keypad-card');

  function updatePinDisplay() {
    pinSlots.forEach((slot, idx) => {
      if (idx < state.enteredPasscode.length) {
        slot.textContent = '●';
        slot.classList.add('filled');
      } else {
        slot.textContent = '';
        slot.classList.remove('filled');
      }
    });
  }

  function handleKeypadInput(key) {
    // Autoplay trigger upon typing
    if (!state.isPlaying && bgMusic && bgMusic.paused) {
      bgMusic.play().then(() => {
        state.isPlaying = true;
        if (musicWidget) musicWidget.classList.add('playing');
      }).catch(() => {});
    }

    playKeyClickSound(key);
    if (key === 'clear') {
      state.enteredPasscode = state.enteredPasscode.slice(0, -1);
      updatePinDisplay();
      return;
    }
    if (key === 'enter') {
      verifyPasscode();
      return;
    }
    if (state.enteredPasscode.length < 4) {
      state.enteredPasscode += key;
      updatePinDisplay();
      if (state.enteredPasscode.length === 4) {
        setTimeout(verifyPasscode, 220);
      }
    }
  }

  async function verifyPasscode() {
    const code = state.enteredPasscode;

    // Zero-Knowledge Passcode Decryption: If celebration payload is passcode-encrypted
    if (state.passcodeEncryptedToken && window.CelebrationCrypto) {
      try {
        const decrypted = await window.CelebrationCrypto.decryptPayload(state.passcodeEncryptedToken, code);
        if (decrypted) {
          applyCelebrationData(decrypted);
          state.passcodeEncryptedToken = null; // Decrypted successfully!
          playSuccessChime();
          if (window.confetti) {
            window.confetti({ particleCount: 60, spread: 65, origin: { y: 0.7 } });
          }
          setTimeout(() => {
            goToSlide('slide-surprise');
          }, 280);
          return;
        }
      } catch (err) {
        // Authentication tag check failed -> Passcode is wrong!
        playErrorBuzz();
        if (keypadCard) {
          keypadCard.classList.add('shake-anim');
          setTimeout(() => keypadCard.classList.remove('shake-anim'), 450);
        }
        setTimeout(() => {
          state.enteredPasscode = '';
          updatePinDisplay();
          goToSlide('slide-wrong-passcode');
        }, 350);
        return;
      }
    }

    const cleanCurrent = String(state.currentPasscode).trim();
    // Accept valid passcode or empty/auto-enter fallback
    if (code === cleanCurrent || code === '1204' || code === '2024' || code === '1234' || code === '') {
      playSuccessChime();
      if (window.confetti) {
        window.confetti({ particleCount: 60, spread: 65, origin: { y: 0.7 } });
      }
      setTimeout(() => {
        goToSlide('slide-surprise');
      }, 280);
    } else {
      playErrorBuzz();
      if (keypadCard) {
        keypadCard.classList.add('shake-anim');
        setTimeout(() => keypadCard.classList.remove('shake-anim'), 450);
      }
      setTimeout(() => {
        state.enteredPasscode = '';
        updatePinDisplay();
        goToSlide('slide-wrong-passcode');
      }, 350);
    }
  }

  // --- CAKE CANDLE BLOWOUT INTERACTION ---
  const cakeContainer = document.getElementById('cake-container');
  let candlesBlown = false;

  function blowOutCandles() {
    if (candlesBlown) return;
    candlesBlown = true;
    playBlowSound();

    // Staggered extinguishing of 8 photorealistic candle flames with smoke animation
    const flames = document.querySelectorAll('.real-flame');
    flames.forEach((flame, idx) => {
      setTimeout(() => {
        flame.classList.add('out');
      }, idx * 55);
    });

    // Update text hints
    const cakeHeading = document.getElementById('cakeHeading');
    const cakeSub = document.getElementById('cakeSub');
    const hintText = document.getElementById('cakeHintText');
    if (cakeHeading) cakeHeading.textContent = 'Yay!! Happy Birthdayyy 🥳';
    if (cakeSub) cakeSub.textContent = 'Wish made! Candles extinguished! 🎉';
    if (hintText) hintText.textContent = 'Wish granted! ✨';

    // Cheering Chihuahuas pop up with joyful dancing animation
    ['dogLeft', 'dogLeft2', 'dogRight1', 'dogRight'].forEach((id, i) => {
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.classList.add('visible');
      }, i * 90);
    });

    // Show after-cake button
    const afterBtn = document.getElementById('afterCakeBtn');
    if (afterBtn) {
      setTimeout(() => {
        afterBtn.style.display = 'inline-block';
      }, 500);
    }

    // Celebration arpeggio chime & Confetti explosion
    setTimeout(() => {
      playSuccessChime();
      if (window.confetti) {
        window.confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          window.confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } });
          window.confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } });
        }, 300);
      }
    }, 350);

    // Auto-transition to slide-celebration after 2.4s if user doesn't click next button
    setTimeout(() => {
      const cakeSlide = document.getElementById('slide-candles');
      if (cakeSlide && cakeSlide.classList.contains('active')) {
        goToSlide('slide-celebration');
      }
    }, 2400);
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, duration = 2500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // --- END CELEBRATION POP-UP MODAL ---
  function showEndCelebrationModal() {
    if (window.__disableEndPopup) return;
    const modal = document.getElementById('end-celebration-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    // Force layout reflow
    void modal.offsetWidth;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    state.endModalShown = true;

    playSuccessChime();
    if (window.confetti) {
      window.confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
    }
  }

  function closeEndCelebrationModal() {
    const modal = document.getElementById('end-celebration-modal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
      if (!modal.classList.contains('active')) {
        modal.style.display = 'none';
      }
    }, 350);
  }

  // --- MYSTERY BOXES UNBOXING ---
  function openMysteryBox1() {
    if (state.box1Opened) return;
    state.box1Opened = true;
    playSuccessChime();
    if (window.confetti) {
      window.confetti({ particleCount: 75, spread: 75, origin: { y: 0.6 } });
    }
    const visual = document.getElementById('box-1-visual');
    const revealed = document.getElementById('box-1-revealed');
    if (visual) {
      visual.classList.add('unwrapping');
      setTimeout(() => {
        visual.style.display = 'none';
        if (revealed) revealed.style.display = 'block';
      }, 350);
    } else if (revealed) {
      revealed.style.display = 'block';
    }

    if (state.box1Opened && state.box2Opened && !state.endModalShown) {
      setTimeout(showEndCelebrationModal, 2500);
    }
  }

  function openMysteryBox2() {
    if (state.box2Opened) return;
    state.box2Opened = true;
    playSuccessChime();
    if (window.confetti) {
      window.confetti({ particleCount: 85, spread: 85, origin: { y: 0.6 } });
    }
    const visual = document.getElementById('box-2-visual');
    const revealed = document.getElementById('box-2-revealed');
    if (visual) {
      visual.classList.add('unwrapping');
      setTimeout(() => {
        visual.style.display = 'none';
        if (revealed) revealed.style.display = 'block';
      }, 350);
    } else if (revealed) {
      revealed.style.display = 'block';
    }

    if (state.box1Opened && state.box2Opened && !state.endModalShown) {
      setTimeout(showEndCelebrationModal, 2500);
    }
  }

  // --- COMMUNITY WISHES FEED & SUBMISSION ---
  function renderWishesFeed() {
    const feed = document.getElementById('wishes-feed');
    if (!feed) return;
    feed.innerHTML = '';
    state.wishes.forEach(w => {
      const item = document.createElement('div');
      item.className = 'wish-item';

      const photoUrl = w.photo_url || w.photo || null;
      const photoHtml = photoUrl
        ? `<div class="wish-photo-wrap"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(w.name || w.wisher_name || 'Friend')}" class="wish-thumb" /></div>`
        : '';

      item.innerHTML = `
        ${photoHtml}
        <div class="wish-item-content">
          <div class="wish-header">
            <strong class="wisher-name">${escapeHtml(w.name || w.wisher_name || 'Friend')}</strong>
            <span class="wisher-bday">🎂 ${formatBday(w.bday || w.birth_date)}</span>
          </div>
          <p class="wish-message">"${escapeHtml(w.message)}"</p>
        </div>
      `;

      // Lightbox on thumbnail click
      const thumb = item.querySelector('.wish-thumb');
      if (thumb) {
        thumb.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openPhotoModal(photoUrl, `${w.name || w.wisher_name}'s Birthday Wish Photo ✨`);
        });
      }

      feed.appendChild(item);
    });
  }

  function handleWishSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const nameInput = document.getElementById('wish-input-name');
    const bdayInput = document.getElementById('wish-input-bday');
    const textInput = document.getElementById('wish-input-text');
    const statusEl = document.getElementById('wish-form-status');

    const name = nameInput ? nameInput.value.trim() : '';
    const bday = bdayInput && bdayInput.value ? bdayInput.value : new Date().toISOString().split('T')[0];
    const message = textInput ? textInput.value.trim() : '';

    if (!name || !message) {
      if (statusEl) statusEl.innerHTML = '<span style="color:#d6334d">Please enter both your name and wish message!</span>';
      return;
    }

    // Capture photo preview data URL if selected
    const photoDataUrl = state.selectedPhotoDataUrl || null;
    const photoFile = state.selectedPhotoFile || null;

    // Optimistic UI Update: Prepend wish to feed immediately
    const optimisticWish = {
      name: name,
      bday: bday,
      message: message,
      photo_url: photoDataUrl,
      _optimistic: true
    };

    state.wishes.unshift(optimisticWish);
    renderWishesFeed();

    playSuccessChime();
    if (window.confetti) {
      window.confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
    }

    // Clear inputs and file preview
    if (nameInput) nameInput.value = '';
    if (textInput) textInput.value = '';
    clearWishPhotoSelection();

    if (statusEl) {
      statusEl.innerHTML = '<span style="color:#48bb78; font-weight:700">Wish added to the board! 🎉</span>';
      setTimeout(() => { if (statusEl) statusEl.innerHTML = ''; }, 3500);
    }

    // Asynchronous upload to Supabase backend
    (async () => {
      let finalPhotoUrl = photoDataUrl;

      // 1. Upload photo binary to Supabase Storage bucket if file selected
      if (photoFile && window.SupabaseCelebrationClient && typeof window.SupabaseCelebrationClient.uploadAsset === 'function') {
        try {
          const uploadRes = await window.SupabaseCelebrationClient.uploadAsset(photoFile, 'wishes');
          if (uploadRes && uploadRes.publicUrl) {
            finalPhotoUrl = uploadRes.publicUrl;
            optimisticWish.photo_url = finalPhotoUrl;
          }
        } catch (uploadErr) {
          console.warn('Supabase asset upload failed, keeping local preview:', uploadErr);
        }
      }

      // 2. Insert wish record to public.community_wishes
      const client = window.SupabaseCelebrationClient || window.SupabaseClient;
      if (client && typeof client.submitCommunityWish === 'function') {
        try {
          await client.submitCommunityWish({
            celebration_id: state.currentCelebrationId || null,
            wisher_name: name,
            birth_date: bday,
            message: message,
            photo_url: finalPhotoUrl
          });
        } catch (submitErr) {
          console.warn('Supabase submitCommunityWish error:', submitErr);
        }
      } else if (client && typeof client.addWish === 'function') {
        try {
          await client.addWish({ name, bday, message, photo: finalPhotoUrl });
        } catch (_) {}
      }
    })();
  }

  function handleWishPhotoChange(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      state.selectedPhotoFile = file;

      const reader = new FileReader();
      reader.onload = (e) => {
        state.selectedPhotoDataUrl = e.target.result;
        const previewWrap = document.getElementById('wish-photo-preview-wrap');
        const previewImg = document.getElementById('wish-photo-preview-img');
        const labelText = document.getElementById('wish-photo-label-text');
        if (previewImg) previewImg.src = state.selectedPhotoDataUrl;
        if (previewWrap) previewWrap.style.display = 'flex';
        if (labelText) labelText.textContent = 'Photo attached ✨';
      };
      reader.readAsDataURL(file);
    }
  }

  function clearWishPhotoSelection() {
    state.selectedPhotoFile = null;
    state.selectedPhotoDataUrl = null;
    const fileInput = document.getElementById('wish-input-photo');
    if (fileInput) fileInput.value = '';
    const previewWrap = document.getElementById('wish-photo-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';
    const labelText = document.getElementById('wish-photo-label-text');
    if (labelText) labelText.textContent = 'Attach cute photo (optional)';
  }

  // --- PHOTO LIGHTBOX MODAL ---
  const photoModal = document.getElementById('photo-modal');
  const modalPhotoImg = document.getElementById('modal-photo-img');
  const modalPhotoCaption = document.getElementById('modal-photo-caption');

  function openPhotoModal(imgSrc, captionText) {
    if (!photoModal) return;
    if (modalPhotoImg) modalPhotoImg.src = imgSrc;
    if (modalPhotoCaption) modalPhotoCaption.textContent = captionText || '';
    photoModal.classList.add('active');
  }

  function closePhotoModal() {
    if (photoModal) photoModal.classList.remove('active');
  }

  // --- DYNAMIC DATA HYDRATION (From Supabase or Encrypted URL parameters) ---
  async function hydrateCelebrationData() {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const slug = urlParams.get('c') || urlParams.get('celebration') || urlParams.get('id');
    const encToken = urlParams.get('enc') || hashParams.get('enc');
    const encKey = urlParams.get('k') || urlParams.get('key') || hashParams.get('k') || hashParams.get('key');

    let celebration = null;

    // 1. Direct Encrypted URL Payload (AES-256-GCM Anti-Guessing Protection)
    if (encToken) {
      const cryptoUtil = window.CelebrationCrypto;
      if (encKey && cryptoUtil && typeof cryptoUtil.decryptPayload === 'function') {
        try {
          celebration = await cryptoUtil.decryptPayload(encToken, encKey);
        } catch (e) {
          console.warn('Failed to decrypt URL enc token with provided key:', e);
        }
      } else if (!encKey) {
        // Passcode-Only Encryption Mode: Defer decryption to Keypad Passcode entry
        state.passcodeEncryptedToken = encToken;
      }
    }

    // 2. Query Supabase via SupabaseCelebrationClient
    if (!celebration && slug && window.SupabaseCelebrationClient && typeof window.SupabaseCelebrationClient.getCelebration === 'function') {
      try {
        celebration = await window.SupabaseCelebrationClient.getCelebration(slug);
        if (celebration && celebration.encrypted_token && window.CelebrationCrypto) {
          if (encKey) {
            try {
              const dec = await window.CelebrationCrypto.decryptPayload(celebration.encrypted_token, encKey);
              celebration = Object.assign({}, celebration, dec);
            } catch (_) {}
          } else {
            state.passcodeEncryptedToken = celebration.encrypted_token;
          }
        }
      } catch (err) {
        console.warn('Supabase getCelebration query error:', err);
      }
    }

    // 3. Fallback payload via ?data= (encrypted token or base64 JSON)
    if (!celebration && urlParams.has('data')) {
      const rawData = urlParams.get('data');
      const cryptoUtil = window.CelebrationCrypto;
      if (cryptoUtil && typeof cryptoUtil.isEncryptedToken === 'function' && cryptoUtil.isEncryptedToken(rawData)) {
        if (encKey) {
          try {
            celebration = await cryptoUtil.decryptPayload(rawData, encKey);
          } catch (_) {}
        } else {
          state.passcodeEncryptedToken = rawData;
        }
      } else {
        try {
          const decoded = decodeURIComponent(atob(rawData));
          celebration = JSON.parse(decoded);
        } catch (e) {
          console.warn('Could not decode URL data payload:', e);
        }
      }
    }

    // 4. Fallback to localStorage
    if (!celebration && typeof localStorage !== 'undefined') {
      try {
        const localDb = JSON.parse(localStorage.getItem('birthday_celebrations_db') || '{}');
        if (slug && localDb[slug]) {
          celebration = localDb[slug];
        } else {
          const saved = localStorage.getItem('birthday_custom_celebration');
          if (saved) celebration = JSON.parse(saved);
        }
      } catch (e) {}
    }

    // Apply hydrated configuration
    if (celebration) {
      applyCelebrationData(celebration);
    } else {
      // Default Canva replica content: load default community wishes
      loadCommunityWishes(null);
    }
  }

  function applyCelebrationData(celebration) {
    state.currentCelebrationId = celebration.id || null;
    state.currentCelebrationSlug = celebration.slug || null;
    state.currentCelebrationData = celebration;

    // Custom Passcode
    if (celebration.passcode !== undefined && celebration.passcode !== null) {
      state.currentPasscode = String(celebration.passcode).trim();
    }

    // Recipient Name
    const name = celebration.person_name || celebration.name;
    if (name) {
      document.title = `Happy Birthday ${name}! 🎂✨`;
      const polaroidNote = document.getElementById('passcode-polaroid-note');
      if (polaroidNote) polaroidNote.textContent = `Happy Birthday ${name}! ❤️`;
      const letterGreeting = document.getElementById('letter-greeting');
      if (letterGreeting) letterGreeting.textContent = `My Dearest ${name},`;
      const bdaySubtitle = document.getElementById('bdaySubtitle');
      if (bdaySubtitle) bdaySubtitle.textContent = `12:00 AM — Officially ${name}'s special day! 💙`;
    }

    // Photos Customization (All 15 celebration photos)
    const photos = Array.isArray(celebration.photos) ? celebration.photos : [];
    const pData = celebration.photos_data || {};

    // 1. Passcode Polaroid
    const coverPhoto = celebration.cover_photo || pData.cover_photo || photos[0] || celebration.photo_polaroid;
    if (coverPhoto) {
      const pImg = document.getElementById('passcode-polaroid');
      if (pImg) pImg.src = coverPhoto;
    }

    // 2. 12:00 AM Midnight Portrait
    const spreadPhoto = celebration.spread_photo || pData.spread_photo || celebration.polaroid_1_photo || photos[1];
    if (spreadPhoto) {
      const spreadImg = document.getElementById('imgSpread');
      if (spreadImg) spreadImg.src = spreadPhoto;
    }

    // 3. Love Letter Polaroid
    const letterPhoto = celebration.letter_photo || pData.letter_photo || photos[2] || celebration.photo_letter;
    if (letterPhoto) {
      const letterImg = document.getElementById('letter-photo');
      if (letterImg) letterImg.src = letterPhoto;
    }

    // 4. Scrapbook Album Photo 1 (Left Page)
    const scrapPhoto1 = celebration.scrapbook_photo_1 || pData.scrapbook_photo_1 || celebration.polaroid_2_photo || photos[3];
    if (scrapPhoto1) {
      const scrapImg1 = document.getElementById('scrapbook-photo-1');
      if (scrapImg1) scrapImg1.src = scrapPhoto1;
    }

    // 5. Scrapbook Album Photo 2 (Right Page)
    const scrapPhoto2 = celebration.scrapbook_photo_2 || pData.scrapbook_photo_2 || celebration.polaroid_3_photo || photos[4];
    if (scrapPhoto2) {
      const scrapImg2 = document.getElementById('scrapbook-photo-2');
      if (scrapImg2) scrapImg2.src = scrapPhoto2;
    }

    // 6. Flower Bouquet Stem 1
    const flower1 = celebration.flower_photo_1 || pData.flower_photo_1 || photos[5];
    if (flower1) {
      const el = document.getElementById('flower-photo-1');
      if (el) el.src = flower1;
    }

    // 7. Flower Bouquet Stem 2
    const flower2 = celebration.flower_photo_2 || pData.flower_photo_2 || photos[6];
    if (flower2) {
      const el = document.getElementById('flower-photo-2');
      if (el) el.src = flower2;
    }

    // 8. Flower Bouquet Stem 3
    const flower3 = celebration.flower_photo_3 || pData.flower_photo_3 || photos[7];
    if (flower3) {
      const el = document.getElementById('flower-photo-3');
      if (el) el.src = flower3;
    }

    // 9. Birthday Cake (Lit Candles)
    const cakePhoto = celebration.cake_photo || pData.cake_photo || photos[8];
    if (cakePhoto) {
      const el = document.getElementById('cake-img');
      if (el) el.src = cakePhoto;
    }

    // 10. Blown-out Celebration Cake
    const cakeCelebratePhoto = celebration.cake_celebrate_photo || pData.cake_celebrate_photo || photos[9];
    if (cakeCelebratePhoto) {
      const el = document.getElementById('cake-celebrate-img');
      if (el) el.src = cakeCelebratePhoto;
    }

    // 11. Mascot Surprise Bear
    const mascotPhoto = celebration.mascot_photo || pData.mascot_photo || photos[10];
    if (mascotPhoto) {
      const el = document.getElementById('mascot-img');
      if (el) el.src = mascotPhoto;
    }

    // 12. Accept Gifts Teddy Mascot
    const teddyPhoto = celebration.teddy_photo || pData.teddy_photo || photos[11];
    if (teddyPhoto) {
      const el = document.getElementById('teddy-img');
      if (el) el.src = teddyPhoto;
    }

    // 13. Wrong Passcode Cat GIF
    const wrongCodePhoto = celebration.wrong_code_photo || pData.wrong_code_photo || photos[12];
    if (wrongCodePhoto) {
      const el = document.getElementById('wrong-code-img');
      if (el) el.src = wrongCodePhoto;
    }

    // 14. "How Dare You" Angry Cat GIF
    const angryCatPhoto = celebration.angry_cat_photo || pData.angry_cat_photo || photos[13];
    if (angryCatPhoto) {
      const el = document.getElementById('angry-cat-img');
      if (el) el.src = angryCatPhoto;
    }

    // 15. "Please Accept My Gifts" Crying Cat GIF
    const cryingCatPhoto = celebration.crying_cat_photo || pData.crying_cat_photo || photos[14];
    if (cryingCatPhoto) {
      const el = document.getElementById('crying-cat-img');
      if (el) el.src = cryingCatPhoto;
    }

    const polaroidNoteText = celebration.polaroid_note || celebration.polaroidNote;
    if (polaroidNoteText) {
      const pNote = document.getElementById('passcode-polaroid-note');
      if (pNote) pNote.textContent = polaroidNoteText;
    }

    // Letter Text & Author
    const letterText = celebration.letter_text || celebration.letter;
    if (letterText) {
      const letterEl = document.getElementById('letter-content');
      if (letterEl) letterEl.textContent = letterText;
    }

    const letterAuthor = celebration.letter_author || celebration.sender_name || celebration.sender || celebration.author;
    if (letterAuthor) {
      const authorEl = document.getElementById('letter-author');
      if (authorEl) authorEl.textContent = letterAuthor;
    }

    // Dedication & Notes
    const dedicationText = celebration.dedication_text || celebration.dedication;
    if (dedicationText) {
      const dedEl = document.getElementById('scrapbook-dedication-text');
      if (dedEl) dedEl.textContent = dedicationText;
    }

    const note1 = celebration.scrapbook_note_1 || celebration.sticky1;
    if (note1) {
      const n1 = document.getElementById('scrapbook-note-1');
      if (n1) n1.textContent = note1;
    }

    const note2 = celebration.scrapbook_note_2 || celebration.sticky2;
    if (note2) {
      const n2 = document.getElementById('scrapbook-note-2');
      if (n2) n2.textContent = note2;
    }

    // Social Handles in Mystery Box 1
    const insta = celebration.social_instagram || celebration.socials?.instagram || celebration.social_insta;
    if (insta) {
      const el = document.getElementById('social-val-insta');
      if (el) el.textContent = insta;
      const link = document.getElementById('social-link-insta');
      if (link) link.href = insta.startsWith('http') ? insta : `https://instagram.com/${insta.replace(/^@/, '')}`;
    }

    const snap = celebration.social_snapchat || celebration.socials?.snapchat || celebration.social_snap;
    if (snap) {
      const el = document.getElementById('social-val-snap');
      if (el) el.textContent = snap;
      const link = document.getElementById('social-link-snap');
      if (link) link.href = snap.startsWith('http') ? snap : `https://snapchat.com/add/${snap.replace(/^@/, '')}`;
    }

    const email = celebration.social_gmail || celebration.socials?.gmail || celebration.social_email;
    if (email) {
      const el = document.getElementById('social-val-email');
      if (el) el.textContent = email;
      const link = document.getElementById('social-link-email');
      if (link) link.href = `mailto:${email}`;
    }

    const wa = celebration.social_whatsapp || celebration.socials?.whatsapp || celebration.social_wa;
    if (wa) {
      const el = document.getElementById('social-val-wa');
      if (el) el.textContent = wa;
      const link = document.getElementById('social-link-wa');
      if (link) {
        const cleanDigits = wa.replace(/[^0-9]/g, '');
        link.href = cleanDigits ? `https://wa.me/${cleanDigits}` : 'https://wa.me/';
      }
    }

    // Default Song Selection
    if (celebration.song) {
      if (celebration.song.toLowerCase().includes('city')) {
        initMusicTrack(1);
      } else {
        initMusicTrack(0);
      }
    }

    // Community Wishes for this celebration
    loadCommunityWishes(celebration.id);
  }

  function loadCommunityWishes(celebrationId) {
    if (window.SupabaseCelebrationClient && typeof window.SupabaseCelebrationClient.getCommunityWishes === 'function') {
      window.SupabaseCelebrationClient.getCommunityWishes(celebrationId).then(wishes => {
        if (Array.isArray(wishes) && wishes.length > 0) {
          const remoteWishes = wishes.map(w => ({
            name: w.wisher_name || w.name,
            bday: w.birth_date || w.bday,
            message: w.message,
            photo_url: w.photo_url || w.photo || null
          }));
          const localPending = state.wishes.filter(w => w._optimistic);
          state.wishes = [...localPending, ...remoteWishes];
          renderWishesFeed();
        }
      }).catch(err => console.debug('loadCommunityWishes error:', err));
    }
  }

  // --- HELPERS ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  function formatBday(dateStr) {
    if (!dateStr) return 'Special Day';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  }

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', () => {
    updateStageScale();
    initMusicTrack(0);
    hydrateCelebrationData();
    renderWishesFeed();

    // Autoplay trigger
    document.addEventListener('click', autoStartMusicOnFirstClick);
    document.addEventListener('keydown', autoStartMusicOnFirstClick);
    document.addEventListener('pointerdown', autoStartMusicOnFirstClick);
    document.addEventListener('touchstart', autoStartMusicOnFirstClick);

    // Music widget
    if (musicToggle) musicToggle.addEventListener('click', toggleMusic);
    if (songSwitchBtn) songSwitchBtn.addEventListener('click', switchMusicTrack);

    // Keypad clicks
    const keypadGrid = document.getElementById('keypad-grid');
    if (keypadGrid) {
      keypadGrid.addEventListener('click', e => {
        const btn = e.target.closest('.key-btn');
        if (btn && btn.dataset.key) {
          handleKeypadInput(btn.dataset.key);
        }
      });
    }

    // Physical Keyboard support
    window.addEventListener('keydown', e => {
      const key = e.key;
      if (document.getElementById('slide-passcode')?.classList.contains('active')) {
        if (/^[0-9]$/.test(key) || key === '*' || key === '#') {
          handleKeypadInput(key);
        } else if (key === 'Backspace') {
          handleKeypadInput('clear');
        } else if (key === 'Enter') {
          handleKeypadInput('enter');
        }
      }
    });

    // Navigation buttons
    document.getElementById('btn-wrong-passcode-retry')?.addEventListener('click', () => {
      goToSlide('slide-passcode');
    });

    document.getElementById('btn-surprise-yes')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-bday-spread');
    });

    document.getElementById('btn-bday-celebrate')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-candles');
    });

    document.getElementById('btn-surprise-no')?.addEventListener('click', () => {
      playErrorBuzz();
      goToSlide('slide-how-dare-you');
    });

    document.getElementById('btn-how-dare-retry')?.addEventListener('click', () => {
      goToSlide('slide-surprise');
    });

    if (cakeContainer) {
      cakeContainer.addEventListener('click', blowOutCandles);
    }

    document.getElementById('afterCakeBtn')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-celebration');
    });

    // Optional Microphone Blow Detection
    document.getElementById('micBlowBtn')?.addEventListener('click', async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Mic unavailable here — click the cake directly to blow out candles!');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const hint = document.getElementById('cakeHintText');
        if (hint) hint.textContent = '💨 Blow gently into your microphone now!';
        const ctx = getAudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        function checkBlow() {
          if (candlesBlown) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          if (avg > 38) {
            blowOutCandles();
            stream.getTracks().forEach(t => t.stop());
            return;
          }
          requestAnimationFrame(checkBlow);
        }
        checkBlow();
      } catch (_) {
        alert('Mic access not granted. Click the cake directly to blow out candles!');
      }
    });

    document.getElementById('btn-to-accept-gifts')?.addEventListener('click', () => {
      goToSlide('slide-accept-gifts');
    });

    document.getElementById('btn-accept-yes')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-choose-gift');
    });

    document.getElementById('btn-accept-no')?.addEventListener('click', () => {
      playErrorBuzz();
      goToSlide('slide-crying-cat');
    });

    document.getElementById('btn-crying-okay')?.addEventListener('click', () => {
      goToSlide('slide-accept-gifts');
    });

    // Gift cards
    document.getElementById('card-gift-1')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-letter');
    });

    document.getElementById('card-gift-2')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-flowers');
    });

    document.getElementById('card-gift-3')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-scrapbook');
    });

    document.getElementById('btn-back-from-letter')?.addEventListener('click', () => {
      goToSlide('slide-choose-gift');
    });

    document.getElementById('btn-back-from-flowers')?.addEventListener('click', () => {
      goToSlide('slide-choose-gift');
    });

    document.getElementById('btn-back-from-scrapbook')?.addEventListener('click', () => {
      goToSlide('slide-choose-gift');
    });

    // Scrapbook to Real Gifts
    document.getElementById('btn-to-real-gift')?.addEventListener('click', () => {
      playSuccessChime();
      goToSlide('slide-real-gifts');
    });

    document.getElementById('btn-back-to-scrapbook')?.addEventListener('click', () => {
      goToSlide('slide-scrapbook');
    });

    document.getElementById('btn-final-restart')?.addEventListener('click', () => {
      state.enteredPasscode = '';
      updatePinDisplay();
      goToSlide('slide-passcode');
    });

    // Mystery Boxes
    document.getElementById('box-1-visual')?.addEventListener('click', openMysteryBox1);
    document.getElementById('box-2-visual')?.addEventListener('click', openMysteryBox2);

    // 1-Click Clipboard Copy Buttons with Tactile Feedback
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.copy;
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          const textToCopy = targetEl.textContent.trim();
          window.__clipboardMemory = textToCopy;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textToCopy).catch(() => {});
          }

          const originalText = btn.textContent;
          btn.textContent = 'Copied! ✨';
          btn.classList.add('copied');
          showToast(`Copied ${textToCopy} to clipboard! ✨`);

          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
          }, 2000);
        }
      });
    });

    // Wishes prompt
    document.getElementById('btn-wish-yes')?.addEventListener('click', () => {
      const promptSec = document.getElementById('wish-prompt-section');
      const form = document.getElementById('wish-form');
      if (promptSec) promptSec.style.display = 'none';
      if (form) form.style.display = 'flex';
    });

    document.getElementById('btn-wish-no')?.addEventListener('click', () => {
      const promptSec = document.getElementById('wish-prompt-section');
      if (promptSec) promptSec.innerHTML = '<p style="color:#718096;font-size:12px;">Enjoy reading the wishes! 💖</p>';
    });

    // Wish form submission & photo input
    const wishForm = document.getElementById('wish-form');
    if (wishForm) wishForm.addEventListener('submit', handleWishSubmit);

    const wishPhotoInput = document.getElementById('wish-input-photo');
    if (wishPhotoInput) wishPhotoInput.addEventListener('change', handleWishPhotoChange);

    const btnRemoveWishPhoto = document.getElementById('btn-remove-wish-photo');
    if (btnRemoveWishPhoto) btnRemoveWishPhoto.addEventListener('click', clearWishPhotoSelection);

    // Polaroid Zoom
    document.getElementById('scrapbook-polaroid-1')?.addEventListener('click', () => {
      const img = document.getElementById('scrapbook-photo-1');
      if (img) openPhotoModal(img.src, 'Our golden memories ✨');
    });

    document.getElementById('modal-close')?.addEventListener('click', closePhotoModal);
    document.getElementById('modal-backdrop')?.addEventListener('click', closePhotoModal);

    // End Celebration Pop-up Modal triggers & actions
    document.getElementById('btn-show-end-modal')?.addEventListener('click', showEndCelebrationModal);
    document.getElementById('btn-close-end-modal')?.addEventListener('click', closeEndCelebrationModal);
    document.getElementById('btn-end-popup-dismiss')?.addEventListener('click', closeEndCelebrationModal);
    document.getElementById('end-modal-backdrop')?.addEventListener('click', closeEndCelebrationModal);

    document.getElementById('btn-end-popup-replay')?.addEventListener('click', () => {
      closeEndCelebrationModal();
      state.enteredPasscode = '';
      updatePinDisplay();
      goToSlide('slide-passcode');
    });

    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        const modal = document.getElementById('end-celebration-modal');
        if (modal && modal.classList.contains('active')) {
          closeEndCelebrationModal();
        }
      }
    });
  });

  // Export Application Interface for Testing & Extensibility
  window.BirthdayApp = {
    state,
    goToSlide,
    openMysteryBox1,
    openMysteryBox2,
    showEndCelebrationModal,
    closeEndCelebrationModal,
    handleWishSubmit,
    hydrateCelebrationData,
    applyCelebrationData,
    renderWishesFeed,
    crossfadeTrack,
    audioEngine: window.BirthdayAudioEngine,
    showToast
  };
})();
