/**
 * Bustan's Journal - Modern Editorial Version
 * Using Vanilla JS + GSAP for premium animations
 */

// =============================================
// STATE
// =============================================
let memories = [];
let isAdminUnlocked = false;
let musicPlaying = false;
let siteSettings = {};
let cropper = null;

const ADMIN_PASSWORD = 'bustan';
const FLOWER_MAP = {
  rose: '🌹', tulip: '🌷', sunflower: '🌻', lily: '🪷', daisy: '🌼'
};

// =============================================
// INIT
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  initUI();
  initAnimations();
  loadMemories();
});

function initUI() {
  // Admin triggers
  document.getElementById('admin-btn').addEventListener('click', () => {
    document.getElementById('admin-overlay').classList.remove('hidden');
  });
  
  document.getElementById('admin-close-btn').addEventListener('click', () => {
    document.getElementById('admin-overlay').classList.add('hidden');
  });

  // Close on background click
  document.getElementById('admin-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'admin-overlay') document.getElementById('admin-overlay').classList.add('hidden');
  });

  document.getElementById('cropper-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'cropper-overlay') {
      document.getElementById('cropper-overlay').classList.add('hidden');
      if (cropper) { cropper.destroy(); cropper = null; }
    }
  });

  // Admin login
  document.getElementById('admin-login-btn').addEventListener('click', loginAdmin);
  document.getElementById('admin-pass-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') loginAdmin();
  });

  // Photo upload preview (Multiple)
  const photoInput = document.getElementById('photo-input');
  const photoDrop  = document.getElementById('photo-drop-zone');
  const previewContainer = document.getElementById('photo-previews-container');

  photoDrop.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const files = Array.from(photoInput.files);
    previewContainer.innerHTML = '';
    if (files.length > 0) {
      document.getElementById('photo-placeholder').classList.add('hidden');
      files.forEach(file => {
        const url = URL.createObjectURL(file);
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '60px';
        img.style.height = '60px';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '4px';
        previewContainer.appendChild(img);
      });
    } else {
      document.getElementById('photo-placeholder').classList.remove('hidden');
    }
  });

  // Plant button
  document.getElementById('plant-btn').addEventListener('click', plantMemory);

  // Save settings button
  document.getElementById('save-settings-btn').addEventListener('click', saveSettings);

  // Hero photo update (Admin panel version)
  const heroDrop = document.getElementById('hero-drop-zone');
  const heroAdminInput = document.getElementById('hero-admin-input');
  
  heroDrop.addEventListener('click', () => heroAdminInput.click());
  heroAdminInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) openCropper(file);
  });

  // Cropper actions
  document.getElementById('cropper-confirm-btn').addEventListener('click', uploadCroppedBanner);
  document.getElementById('cropper-cancel-btn').addEventListener('click', () => {
    document.getElementById('cropper-overlay').classList.add('hidden');
    if (cropper) { cropper.destroy(); cropper = null; }
  });

  // Dragging logic for hero text
  initHeroDraggable();

  // Music toggle
  document.getElementById('music-toggle').addEventListener('click', toggleMusic);
}

// =============================================
// ANIMATIONS (GSAP)
// =============================================
function initAnimations() {
  gsap.registerPlugin(ScrollTrigger);

  // Hero Reveal
  const tl = gsap.timeline();
  tl.from('.hero-img', { scale: 1.2, duration: 2.5, ease: 'power2.out' })
    .from('.hero-arabic', { y: 60, opacity: 0, duration: 1.5, ease: 'power3.out' }, '-=1.8')
    .from('.hero-sub', { y: 30, opacity: 0, duration: 1.2, ease: 'power3.out' }, '-=1.0');

  // Generic fade-ups
  gsap.utils.toArray('[data-gsap="fade-up"]').forEach(el => {
    gsap.from(el, {
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none none'
      },
      y: 50,
      opacity: 0,
      duration: 1,
      ease: 'power2.out',
      delay: el.dataset.delay || 0
    });
  });
}

// =============================================
// SETTINGS (MINI CMS)
// =============================================
async function loadSettings() {
  try {
    const { data, error } = await window.supabaseDb.from('site_settings').select('*');
    if (error) throw error;
    
    data.forEach(s => {
      siteSettings[s.key] = s.value;
    });

    applySettings();
  } catch (err) {
    console.error('loadSettings:', err);
  }
}

function applySettings() {
  const heroImg = document.getElementById('hero-img');
  const heroArabic = document.getElementById('hero-arabic');
  const heroEnglish = document.getElementById('hero-english');
  const pacerTitle = document.getElementById('pacer-title');
  const pacerText = document.getElementById('pacer-text');
  const navLogo = document.getElementById('nav-logo');
  const timelineTitle = document.getElementById('timeline-title');
  const timelineSubtitle = document.getElementById('timeline-subtitle');
  const daysLabel = document.getElementById('counter-days-label');
  const memsLabel = document.getElementById('counter-mems-label');
  const eternalLabel = document.getElementById('counter-eternal-label');
  const musicLabel = document.getElementById('music-label');
  const pacerLabel = document.getElementById('pacer-label');

  if (siteSettings.hero_image_url && heroImg) heroImg.src = siteSettings.hero_image_url;
  if (siteSettings.hero_arabic && heroArabic) heroArabic.textContent = siteSettings.hero_arabic;
  if (siteSettings.hero_english && heroEnglish) heroEnglish.textContent = siteSettings.hero_english;
  if (siteSettings.pacer_title && pacerTitle) pacerTitle.textContent = siteSettings.pacer_title;
  if (siteSettings.pacer_text && pacerText) pacerText.textContent = siteSettings.pacer_text;

  // New Editorial Texts
  if (siteSettings.nav_logo && navLogo) navLogo.textContent = siteSettings.nav_logo;
  if (siteSettings.timeline_title && timelineTitle) timelineTitle.textContent = siteSettings.timeline_title;
  if (siteSettings.timeline_subtitle && timelineSubtitle) timelineSubtitle.textContent = siteSettings.timeline_subtitle;
  if (siteSettings.counter_days_label && daysLabel) daysLabel.textContent = siteSettings.counter_days_label;
  if (siteSettings.counter_mems_label && memsLabel) memsLabel.textContent = siteSettings.counter_mems_label;
  if (siteSettings.counter_eternal_label && eternalLabel) eternalLabel.textContent = siteSettings.counter_eternal_label;
  if (siteSettings.music_label && musicLabel) musicLabel.textContent = siteSettings.music_label;
  if (siteSettings.pacer_label && pacerLabel) pacerLabel.textContent = siteSettings.pacer_label;

  // Apply YouTube Music
  if (siteSettings.youtube_link) {
    const videoId = extractYouTubeId(siteSettings.youtube_link);
    const musicPlayer = document.getElementById('bg-music-player');
    if (videoId && musicPlayer) {
      musicPlayer.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=0&loop=1&playlist=${videoId}&enablejsapi=1&mute=0`;
    }
  }

  // Apply Hero Position
  const x = siteSettings.hero_pos_x || 0;
  const y = siteSettings.hero_pos_y || 0;
  document.querySelector('.hero-content').style.transform = `translate(${x}px, ${y}px)`;

  // Fill inputs in admin
  const editHeroAr = document.getElementById('edit-hero-arabic');
  const editHeroEn = document.getElementById('edit-hero-english');
  const editPacerTi = document.getElementById('edit-pacer-title');
  const editPacerTe = document.getElementById('edit-pacer-text');
  const editYoutube = document.getElementById('edit-youtube-link');
  const editMusicLb = document.getElementById('edit-music-label');

  if (editHeroAr) editHeroAr.value = siteSettings.hero_arabic || '';
  if (editHeroEn) editHeroEn.value = siteSettings.hero_english || '';
  if (editPacerTi) editPacerTi.value = siteSettings.pacer_title || '';
  if (editPacerTe) editPacerTe.value = siteSettings.pacer_text || '';
  if (editYoutube) editYoutube.value = siteSettings.youtube_link || '';
  if (editMusicLb) editMusicLb.value = siteSettings.music_label || '';
  
  if (isAdminUnlocked) enableInlineEditing();
}

async function saveSettings() {
  const x = parseFloat(siteSettings.hero_pos_x) || 0;
  const y = parseFloat(siteSettings.hero_pos_y) || 0;

  const settings = [];
  const addSetting = (key, id, attr = 'textContent') => {
    const el = document.getElementById(id);
    if (el) settings.push({ key, value: el[attr] });
    else if (siteSettings[key]) settings.push({ key, value: siteSettings[key] });
  };

  addSetting('hero_arabic', 'hero-arabic');
  addSetting('hero_english', 'hero-english');
  addSetting('pacer_title', 'pacer-title');
  addSetting('pacer_text', 'pacer-text');
  addSetting('nav_logo', 'nav-logo');
  addSetting('timeline_title', 'timeline-title');
  addSetting('timeline_subtitle', 'timeline-subtitle');
  addSetting('counter_days_label', 'counter-days-label');
  addSetting('counter_mems_label', 'counter-mems-label');
  addSetting('counter_eternal_label', 'counter-eternal-label');
  addSetting('music_label', 'music-label');
  addSetting('pacer_label', 'pacer-label');
  
  settings.push({ key: 'youtube_link', value: document.getElementById('edit-youtube-link').value });
  settings.push({ key: 'music_label', value: document.getElementById('edit-music-label').value });
  settings.push({ key: 'hero_pos_x', value: x.toString() });
  settings.push({ key: 'hero_pos_y', value: y.toString() });

  // Update inputs in admin panel if they exist
  const editHeroAr = document.getElementById('edit-hero-arabic');
  const editHeroEn = document.getElementById('edit-hero-english');
  if (editHeroAr) editHeroAr.value = siteSettings.hero_arabic || '';
  if (editHeroEn) editHeroEn.value = siteSettings.hero_english || '';

  try {
    const { error } = await window.supabaseDb.from('site_settings').upsert(settings);
    if (error) throw error;
    
    // Immediate feedback if it was manual click
    const btn = document.getElementById('save-settings-btn');
    if (btn) {
      btn.textContent = 'Updated Successfully! ✅';
      setTimeout(() => {
        btn.textContent = 'Update Site Content';
        // Reload to apply YouTube change properly
        if (settings.find(s => s.key === 'youtube_link')) applySettings();
      }, 2000);
    }
  } catch (err) {
    console.error('Error auto-saving settings:', err);
  }
}

function enableInlineEditing() {
  const editables = [
    'hero-arabic', 'hero-english', 'pacer-title', 'pacer-text',
    'nav-logo', 'timeline-title', 'timeline-subtitle',
    'counter-days-label', 'counter-mems-label', 'counter-eternal-label', 'music-label', 'pacer-label'
  ];
  editables.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.contentEditable = "true";
      el.addEventListener('blur', saveSettings);
    }
  });
  document.getElementById('hero-click-area').classList.add('admin-editable');
  document.getElementById('hero-edit-hint').classList.remove('hidden');
  document.querySelector('.hero-content').classList.add('admin-draggable');
}

function initHeroDraggable() {
  const el = document.querySelector('.hero-content');
  let isDragging = false;
  let startX, startY, initialX, initialY;

  el.addEventListener('mousedown', (e) => {
    if (!isAdminUnlocked) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    // Get current transform
    const style = window.getComputedStyle(el);
    const matrix = new WebKitCSSMatrix(style.transform);
    initialX = matrix.m41;
    initialY = matrix.m42;
    
    el.style.transition = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const newX = initialX + dx;
    const newY = initialY + dy;
    el.style.transform = `translate(${newX}px, ${newY}px)`;
    siteSettings.hero_pos_x = newX;
    siteSettings.hero_pos_y = newY;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      el.style.transition = '';
      saveSettings();
    }
  });
}

function openCropper(file) {
  const url = URL.createObjectURL(file);
  const img = document.getElementById('cropper-image');
  img.src = url;
  
  document.getElementById('cropper-overlay').classList.remove('hidden');
  
  if (cropper) cropper.destroy();
  
  // Wait for image to load to init cropper
  img.onload = () => {
    cropper = new Cropper(img, {
      aspectRatio: 16 / 9,
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 1,
      responsive: true,
      restore: false,
      ready() {
        console.log('Cropper ready');
      }
    });
  };
}

async function uploadCroppedBanner() {
  if (!cropper) return;
  
  const btn = document.getElementById('cropper-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Cropping & Uploading... ⏳';

  // Get cropped canvas at high res
  const canvas = cropper.getCroppedCanvas({
    width: 1920,
    height: 1080,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });

  canvas.toBlob(async (blob) => {
    try {
      const fileName = `hero_cropped_${Date.now()}.jpg`;
      const { error: upErr } = await window.supabaseDb.storage.from('memories').upload(fileName, blob, {
        contentType: 'image/jpeg'
      });
      if (upErr) throw upErr;

      const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
      const photoUrl = urlData.publicUrl;

      const { error: dbErr } = await window.supabaseDb.from('site_settings').upsert([
        { key: 'hero_image_url', value: photoUrl }
      ]);
      if (dbErr) throw dbErr;

      document.getElementById('hero-img').src = photoUrl;
      document.getElementById('cropper-overlay').classList.add('hidden');
      alert('Banner updated perfectly! ✅');
      
      if (cropper) { cropper.destroy(); cropper = null; }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Apply & Upload Banner';
    }
  }, 'image/jpeg', 0.9);
}

async function updateHeroPhotoAdmin() {
  // Deprecated in favor of uploadCroppedBanner
}

// =============================================
// DATA HANDLING
// =============================================
async function loadMemories() {
  try {
    const { data, error } = await window.supabaseDb
      .from('memories')
      .select('*')
      .order('date', { ascending: true });

    if (error) throw error;
    memories = data || [];
    
    renderTimeline();
    renderQuickNotes();
    updateStats();
    if (isAdminUnlocked) renderAdminMemoryList();
  } catch (err) {
    console.error('loadMemories:', err);
  }
}

function renderTimeline() {
  const container = document.getElementById('timeline-container');
  container.innerHTML = '';

  // Filter for entries that have either the old 'photo' or the new 'photos' array
  const timelineMemories = memories.filter(m => (m.photos && m.photos.length > 0) || m.photo);

  timelineMemories.forEach((m, i) => {
    const card = document.createElement('article');
    card.className = 'memory-card';
    
    // Use the photos array if available, otherwise fall back to the single photo
    const displayPhotos = (m.photos && m.photos.length > 0) ? m.photos : [m.photo];
    
    const carouselHtml = displayPhotos.map(url => `
      <div class="carousel-slide">
        <img src="${url}" alt="Memory" class="card-img" loading="lazy" />
      </div>
    `).join('');

    const dotsHtml = displayPhotos.length > 1 ? `
      <div class="carousel-dots">
        ${displayPhotos.map((_, idx) => `<div class="dot ${idx === 0 ? 'active' : ''}"></div>`).join('')}
      </div>
      <button class="carousel-btn prev" aria-label="Previous">❮</button>
      <button class="carousel-btn next" aria-label="Next">❯</button>
    ` : '';

    card.innerHTML = `
      <div class="card-image-wrap">
        <div class="card-carousel" data-id="${m.id}">
          ${carouselHtml}
        </div>
        ${dotsHtml}
      </div>
      <div class="card-content">
        <div class="card-meta">
          <span class="card-flower-tag">${FLOWER_MAP[m.flower_type] || '🌸'} ${m.flower_type}</span>
          <span class="card-date">${formatDate(m.date)}</span>
          ${m.location ? `<span class="card-location">📍 ${m.location}</span>` : ''}
        </div>
        <h3 class="card-title" data-id="${m.id}" data-field="title">${m.title || (m.note ? m.note.split('\n')[0] : 'A Beautiful Moment')}</h3>
        <p class="card-note" data-id="${m.id}" data-field="note">${m.note || ''}</p>
        <div class="card-actions">
          <button class="like-btn ${m.is_favorite ? 'active' : ''}" data-id="${m.id}">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
        </div>
      </div>
    `;

    // Add "Like" listener
    card.querySelector('.like-btn').addEventListener('click', function() {
      toggleLike(m.id, this);
    });

    // Handle Carousel Dots and Buttons
    const carousel = card.querySelector('.card-carousel');
    const dots = card.querySelectorAll('.dot');
    const nextBtn = card.querySelector('.carousel-btn.next');
    const prevBtn = card.querySelector('.carousel-btn.prev');

    if (carousel && dots.length > 0) {
      carousel.addEventListener('scroll', () => {
        const index = Math.round(carousel.scrollLeft / carousel.offsetWidth);
        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === index);
        });
      });
      
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          carousel.scrollBy({ left: carousel.offsetWidth, behavior: 'smooth' });
        });
      }
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          carousel.scrollBy({ left: -carousel.offsetWidth, behavior: 'smooth' });
        });
      }
    }

    // Inline editing for timeline
    if (isAdminUnlocked) {
      const titleEl = card.querySelector('.card-title');
      const noteEl = card.querySelector('.card-note');
      
      [titleEl, noteEl].forEach(el => {
        el.contentEditable = "true";
        el.addEventListener('blur', async () => {
          const field = el.dataset.field;
          const newValue = el.textContent;
          try {
            const updateObj = {};
            updateObj[field] = newValue;
            const { error } = await window.supabaseDb.from('memories').update(updateObj).eq('id', m.id);
            if (error) throw error;
          } catch (err) {
            console.error('Error saving timeline edit:', err);
          }
        });
      });
    }

    container.appendChild(card);
    
    // Animation - Subtle and stable
    gsap.from(card, {
      scrollTrigger: { trigger: card, start: 'top 90%' },
      opacity: 0, y: 20, duration: 0.8, ease: 'power2.out'
    });
  });
}

function renderQuickNotes() {
  const container = document.getElementById('quick-notes-list');
  container.innerHTML = '';

  // Show a few random or recent memories as "quick notes"
  const notes = memories.slice(0, 6);
  notes.forEach(n => {
    const el = document.createElement('div');
    el.className = 'quick-note';
    el.innerHTML = `
      <p class="quick-note-text" data-id="${n.id}">${n.note || 'Thinking of you...'}</p>
      <p class="quick-note-date">${formatDate(n.date)}</p>
    `;

    const textEl = el.querySelector('.quick-note-text');
    if (isAdminUnlocked) {
      textEl.contentEditable = "true";
      textEl.addEventListener('blur', async () => {
        const newNote = textEl.textContent.replace(/^"|"$/g, ''); // Remove quotes if added
        try {
          const { error } = await window.supabaseDb.from('memories').update({ note: newNote }).eq('id', n.id);
          if (error) throw error;
        } catch (err) {
          console.error('Error saving quick note:', err);
        }
      });
    }

    container.appendChild(el);
  });
}

function updateStats() {
  if (!memories.length) return;
  
  // Memories count
  document.getElementById('memories-count').textContent = memories.length;

  // Days count (from first memory)
  const sorted = [...memories].sort((a, b) => new Date(a.date) - new Date(b.date));
  const first = new Date(sorted[0].date);
  const diff = Math.floor((new Date() - first) / (1000 * 60 * 60 * 24));
  document.getElementById('days-count').textContent = diff > 0 ? diff : 1;
}

// =============================================
// ACTIONS
// =============================================
async function toggleLike(id, btn) {
  const isCurrentlyLiked = btn.classList.contains('active');
  const newStatus = !isCurrentlyLiked;
  
  btn.classList.toggle('active');
  
  try {
    const { error } = await window.supabaseDb
      .from('memories')
      .update({ is_favorite: newStatus })
      .eq('id', id);
    if (error) throw error;
  } catch (err) {
    console.error('toggleLike:', err);
    btn.classList.toggle('active'); // revert on error
  }
}

async function loginAdmin() {
  const pw = document.getElementById('admin-pass-input').value;
  if (pw === ADMIN_PASSWORD) {
    isAdminUnlocked = true;
    document.getElementById('admin-login-form').classList.add('hidden');
    document.getElementById('admin-plant-form').classList.remove('hidden');
    renderAdminMemoryList();
    enableInlineEditing();
  } else {
    alert('Incorrect password.');
  }
}

async function plantMemory() {
  const files = Array.from(document.getElementById('photo-input').files);
  const note = document.getElementById('plant-note').value;
  const date = document.getElementById('plant-date').value || new Date().toISOString().split('T')[0];
  const loc  = document.getElementById('plant-location').value;
  const flower = document.getElementById('plant-flower').value;
  const title = note ? note.split('\n')[0].slice(0, 50) : 'A Beautiful Moment';

  const btn = document.getElementById('plant-btn');
  const btnTxt = document.getElementById('plant-btn-text');
  
  if (files.length === 0 && !note) { alert('Please add at least one photo or a note.'); return; }
  
  btn.disabled = true;
  btnTxt.textContent = 'Planting...';

  try {
    const uploadedUrls = [];
    
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
      const { error: upErr } = await window.supabaseDb.storage
        .from('memories')
        .upload(fileName, file);
      if (upErr) throw upErr;
      
      const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
      uploadedUrls.push(urlData.publicUrl);
    }

    const { error: insErr } = await window.supabaseDb.from('memories').insert([{
      photos: uploadedUrls,
      photo: uploadedUrls[0] || '', // Backwards compatibility
      note,
      title,
      date,
      location: loc,
      flower_type: flower
    }]);
    if (insErr) throw insErr;

    alert('Memory planted in the journal! 🌹');
    location.reload();
  } catch (err) {
    console.error('plantMemory:', err);
    alert('Error planting memory: ' + err.message);
  } finally {
    btn.disabled = false;
    btnTxt.textContent = 'Add to Journal';
  }
}

function extractYouTubeId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length == 11) ? match[2] : null;
}

function renderAdminMemoryList() {
  const container = document.getElementById('admin-memory-list');
  container.innerHTML = '';
  memories.forEach(m => {
    const row = document.createElement('div');
    row.className = 'admin-mem-row';
    row.style.flexDirection = 'column';
    row.style.alignItems = 'stretch';
    row.style.gap = '10px';
    row.innerHTML = `
      <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:8px; border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex; gap:15px; margin-bottom:10px;">
          <img src="${m.photo || ''}" style="width:60px; height:60px; object-fit:cover; border-radius:4px; border:1px solid var(--accent);" />
          <div style="flex:1;">
            <input type="text" class="edit-mem-title" value="${m.title || ''}" placeholder="Memory Title" style="width:100%; background:none; border:none; border-bottom:1px solid rgba(255,255,255,0.2); color:white; margin-bottom:5px;" />
            <div style="display:flex; gap:5px;">
              <input type="text" class="edit-mem-loc" value="${m.location || ''}" placeholder="Location" style="flex:1; font-size:0.7rem; background:none; border:none; color:var(--text-light);" />
              <input type="date" class="edit-mem-date" value="${m.date}" style="font-size:0.7rem; background:none; border:none; color:var(--text-light);" />
            </div>
          </div>
        </div>
        
        <textarea class="edit-mem-note" style="width:100%; height:60px; background:rgba(0,0,0,0.2); border:1px solid rgba(255,255,255,0.1); color:white; padding:8px; font-size:0.8rem; border-radius:4px; resize:none; margin-bottom:10px;">${m.note || ''}</textarea>
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <select class="edit-mem-flower" style="background:none; border:none; color:var(--gold); font-size:0.8rem; cursor:pointer;">
            <option value="rose" ${m.flower_type === 'rose' ? 'selected' : ''}>🌹 Rose</option>
            <option value="tulip" ${m.flower_type === 'tulip' ? 'selected' : ''}>🌷 Tulip</option>
            <option value="sunflower" ${m.flower_type === 'sunflower' ? 'selected' : ''}>🌻 Sunflower</option>
            <option value="lily" ${m.flower_type === 'lily' ? 'selected' : ''}>🪷 Lily</option>
            <option value="daisy" ${m.flower_type === 'daisy' ? 'selected' : ''}>🌼 Daisy</option>
          </select>
          <div style="display:flex; gap:10px;">
            <button class="save-mem-btn" style="background:var(--accent); color:white; border:none; padding:4px 12px; border-radius:4px; font-size:0.7rem; cursor:pointer; font-weight:600;">Save Changes</button>
            <button class="del-btn" onclick="deleteMemory('${m.id}')" style="background:rgba(255,0,0,0.2); color:#ff4d4d; border:none; padding:4px 12px; border-radius:4px; font-size:0.7rem; cursor:pointer;">Delete</button>
          </div>
        </div>
      </div>
    `;

    const saveBtn = row.querySelector('.save-mem-btn');
    
    saveBtn.addEventListener('click', async () => {
      const updates = {
        title: row.querySelector('.edit-mem-title').value,
        location: row.querySelector('.edit-mem-loc').value,
        date: row.querySelector('.edit-mem-date').value,
        note: row.querySelector('.edit-mem-note').value,
        flower_type: row.querySelector('.edit-mem-flower').value
      };

      saveBtn.textContent = 'Saving...';
      try {
        const { error } = await window.supabaseDb.from('memories').update(updates).eq('id', m.id);
        if (error) throw error;
        saveBtn.textContent = 'Saved! ✅';
        setTimeout(() => saveBtn.textContent = 'Save Changes', 2000);
      } catch (err) {
        alert('Error: ' + err.message);
        saveBtn.textContent = 'Save Changes';
      }
    });

    container.appendChild(row);
  });
}

window.deleteMemory = async (id) => {
  if (!confirm('Are you sure you want to delete this memory?')) return;
  try {
    const { error } = await window.supabaseDb.from('memories').delete().eq('id', id);
    if (error) throw error;
    location.reload();
  } catch (err) {
    console.error('deleteMemory:', err);
  }
};

// =============================================
// UTILS
// =============================================
function formatDate(dateStr) {
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateStr).toLocaleDateString('en-US', options);
}

function toggleMusic() {
  const iframe = document.getElementById('bg-music-player');
  const player = document.getElementById('music-player');
  const iconPlay  = document.getElementById('music-icon-play');
  const iconPause = document.getElementById('music-icon-pause');

  if (!iframe) return;

  musicPlaying = !musicPlaying;

  if (musicPlaying) {
    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    if (player) player.classList.add('music-playing');
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
  } else {
    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    if (player) player.classList.remove('music-playing');
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
  }
}
