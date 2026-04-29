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

  // Photo upload preview
  const photoInput = document.getElementById('photo-input');
  const photoDrop  = document.getElementById('photo-drop-zone');
  photoDrop.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      document.getElementById('photo-preview').src = url;
      document.getElementById('photo-preview').classList.remove('hidden');
      document.getElementById('photo-placeholder').classList.add('hidden');
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
  if (siteSettings.hero_image_url) document.getElementById('hero-img').src = siteSettings.hero_image_url;
  if (siteSettings.hero_arabic) document.getElementById('hero-arabic').textContent = siteSettings.hero_arabic;
  if (siteSettings.hero_english) document.getElementById('hero-english').textContent = siteSettings.hero_english;
  if (siteSettings.pacer_title) document.getElementById('pacer-title').textContent = siteSettings.pacer_title;
  if (siteSettings.pacer_text) document.getElementById('pacer-text').textContent = siteSettings.pacer_text;

  // New Editorial Texts
  if (siteSettings.nav_logo) document.getElementById('nav-logo').textContent = siteSettings.nav_logo;
  if (siteSettings.timeline_title) document.getElementById('timeline-title').textContent = siteSettings.timeline_title;
  if (siteSettings.timeline_subtitle) document.getElementById('timeline-subtitle').textContent = siteSettings.timeline_subtitle;
  if (siteSettings.counter_days_label) document.getElementById('counter-days-label').textContent = siteSettings.counter_days_label;
  if (siteSettings.counter_mems_label) document.getElementById('counter-mems-label').textContent = siteSettings.counter_mems_label;
  if (siteSettings.counter_eternal_label) document.getElementById('counter-eternal-label').textContent = siteSettings.counter_eternal_label;
  if (siteSettings.music_label) document.getElementById('music-label').textContent = siteSettings.music_label;
  if (siteSettings.pacer_label) document.getElementById('pacer-label').textContent = siteSettings.pacer_label;

  // Apply Hero Position
  const x = siteSettings.hero_pos_x || 0;
  const y = siteSettings.hero_pos_y || 0;
  document.querySelector('.hero-content').style.transform = `translate(${x}px, ${y}px)`;

  // Fill inputs in admin
  document.getElementById('edit-hero-arabic').value = siteSettings.hero_arabic || '';
  document.getElementById('edit-hero-english').value = siteSettings.hero_english || '';
  document.getElementById('edit-pacer-title').value = siteSettings.pacer_title || '';
  document.getElementById('edit-pacer-text').value = siteSettings.pacer_text || '';
  
  if (isAdminUnlocked) enableInlineEditing();
}

async function saveSettings() {
  const x = parseFloat(siteSettings.hero_pos_x) || 0;
  const y = parseFloat(siteSettings.hero_pos_y) || 0;

  const settings = [
    { key: 'hero_arabic', value: document.getElementById('hero-arabic').textContent },
    { key: 'hero_english', value: document.getElementById('hero-english').textContent },
    { key: 'pacer_title', value: document.getElementById('pacer-title').textContent },
    { key: 'pacer_text', value: document.getElementById('pacer-text').textContent },
    { key: 'nav_logo', value: document.getElementById('nav-logo').textContent },
    { key: 'timeline_title', value: document.getElementById('timeline-title').textContent },
    { key: 'timeline_subtitle', value: document.getElementById('timeline-subtitle').textContent },
    { key: 'counter_days_label', value: document.getElementById('counter-days-label').textContent },
    { key: 'counter_mems_label', value: document.getElementById('counter-mems-label').textContent },
    { key: 'counter_eternal_label', value: document.getElementById('counter-eternal-label').textContent },
    { key: 'music_label', value: document.getElementById('music-label').textContent },
    { key: 'pacer_label', value: document.getElementById('pacer-label').textContent },
    { key: 'hero_pos_x', value: x.toString() },
    { key: 'hero_pos_y', value: y.toString() }
  ];
  
  // Also sync admin form
  document.getElementById('edit-hero-arabic').value = settings[0].value;
  document.getElementById('edit-hero-english').value = settings[1].value;
  document.getElementById('edit-pacer-title').value = settings[2].value;
  document.getElementById('edit-pacer-text').value = settings[3].value;

  try {
    const { error } = await window.supabaseDb.from('site_settings').upsert(settings);
    if (error) throw error;
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
      .order('date', { ascending: false });

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

  // Only render entries that HAVE a photo for the timeline
  const timelineMemories = memories.filter(m => m.photo);

  timelineMemories.forEach((m, i) => {
    const card = document.createElement('article');
    card.className = 'memory-card';
    card.innerHTML = `
      <div class="card-image-wrap">
        <img src="${m.photo}" alt="Memory" class="card-img" loading="lazy" />
      </div>
      <div class="card-content">
        <div class="card-meta">
          <span class="card-flower-tag">${FLOWER_MAP[m.flower_type] || '🌸'} ${m.flower_type}</span>
          <span class="card-date">${formatDate(m.date)}</span>
          ${m.location ? `<span class="card-location">📍 ${m.location}</span>` : ''}
        </div>
        <h3 class="card-title" data-id="${m.id}" data-field="title">${m.note ? m.note.split('\n')[0].slice(0, 50) : 'A Beautiful Moment'}</h3>
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

    // Inline editing for timeline
    if (isAdminUnlocked) {
      const titleEl = card.querySelector('.card-title');
      const noteEl = card.querySelector('.card-note');
      
      [titleEl, noteEl].forEach(el => {
        el.contentEditable = "true";
        el.addEventListener('blur', async () => {
          // For now we save both to 'note' or if we had a 'title' field... 
          // Since we only have 'note', let's just save the note field.
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

    // Animation for this card
    gsap.from(card.querySelector('.card-image-wrap'), {
      scrollTrigger: {
        trigger: card,
        start: 'top 80%',
      },
      scale: 0.9,
      opacity: 0,
      duration: 1.5,
      ease: 'power2.out'
    });
    
    gsap.from(card.querySelector('.card-content'), {
      scrollTrigger: {
        trigger: card,
        start: 'top 80%',
      },
      x: i % 2 === 0 ? 50 : -50,
      opacity: 0,
      duration: 1.2,
      ease: 'power2.out',
      delay: 0.3
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
  const file = document.getElementById('photo-input').files[0];
  const note = document.getElementById('plant-note').value;
  const date = document.getElementById('plant-date').value || new Date().toISOString().split('T')[0];
  const loc  = document.getElementById('plant-location').value;
  const flower = document.getElementById('plant-flower').value;
  
  const btn = document.getElementById('plant-btn');
  const btnTxt = document.getElementById('plant-btn-text');
  
  if (!note && !file) { alert('Please add a photo or a note.'); return; }
  
  btn.disabled = true;
  btnTxt.textContent = 'Planting...';

  try {
    let photoUrl = '';
    if (file) {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}.${ext}`;
      const { error: upErr } = await window.supabaseDb.storage
        .from('memories')
        .upload(fileName, file);
      if (upErr) throw upErr;
      
      const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
      photoUrl = urlData.publicUrl;
    }

    const { error: insErr } = await window.supabaseDb.from('memories').insert([{
      photo: photoUrl,
      note,
      date,
      location: loc,
      flower_type: flower
    }]);
    if (insErr) throw insErr;

    alert('Memory planted in the journal! 🌹');
    location.reload(); // Simplest way to refresh everything
  } catch (err) {
    console.error('plantMemory:', err);
    alert('Error planting memory: ' + err.message);
  } finally {
    btn.disabled = false;
    btnTxt.textContent = 'Add to Journal';
  }
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
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span style="font-weight:600;">${m.date}</span>
        <div style="display:flex; gap:10px;">
          <button class="save-mem-btn" data-id="${m.id}" style="color:var(--accent); background:none; border:none; cursor:pointer;">Save</button>
          <button class="del-btn" onclick="deleteMemory('${m.id}')">Delete</button>
        </div>
      </div>
      <textarea class="edit-mem-note" style="background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.1); color:white; padding:5px; font-size:0.8rem;">${m.note || ''}</textarea>
    `;

    const saveBtn = row.querySelector('.save-mem-btn');
    const textarea = row.querySelector('.edit-mem-note');
    
    saveBtn.addEventListener('click', async () => {
      const newNote = textarea.value;
      saveBtn.textContent = '...';
      try {
        const { error } = await window.supabaseDb.from('memories').update({ note: newNote }).eq('id', m.id);
        if (error) throw error;
        saveBtn.textContent = '✅';
        setTimeout(() => saveBtn.textContent = 'Save', 2000);
      } catch (err) {
        alert('Error: ' + err.message);
        saveBtn.textContent = 'Save';
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
  const iframe = document.getElementById('yt-player');
  const player = document.getElementById('music-player');
  const iconPlay  = document.getElementById('music-icon-play');
  const iconPause = document.getElementById('music-icon-pause');

  musicPlaying = !musicPlaying;

  if (musicPlaying) {
    iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    player.classList.add('music-playing');
    iconPlay.classList.add('hidden');
    iconPause.classList.remove('hidden');
  } else {
    iframe.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    player.classList.remove('music-playing');
    iconPlay.classList.remove('hidden');
    iconPause.classList.add('hidden');
  }
}
