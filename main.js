// =============================================
// STATE
// =============================================
let map, pageFlip;
let isAdmin = false;
let isEditMode = false;
let vinePath = null;
let currentLocations = [];
let activeLocationId = null;
let activeEditId = null; // which data-edit-id is being edited

// =============================================
// DOM REFS
// =============================================
const navHome         = document.getElementById('nav-home');
const navGrowth       = document.getElementById('nav-live-growth');
const navAdmin        = document.getElementById('nav-admin');

const adminLoginModal = document.getElementById('admin-login-modal');
const loginSubmitBtn  = document.getElementById('login-submit-btn');
const loginCancelBtn  = document.getElementById('login-cancel-btn');
const adminPassInput  = document.getElementById('admin-password');

const adminSheet      = document.getElementById('admin-dashboard-sheet');
const closeAdminBtn   = document.getElementById('close-admin-dashboard-btn');
const adminMapLink    = document.getElementById('admin-map-link');
const adminFlower     = document.getElementById('admin-flower-type');
const adminPlantBtn   = document.getElementById('admin-extract-plant-btn');
const adminPlantErr   = document.getElementById('admin-plant-error');
const adminLocList    = document.getElementById('admin-locations-list');
const toggleEditBtn   = document.getElementById('toggle-edit-mode-btn');

const albumSheet      = document.getElementById('album-sheet');
const closeAlbumBtn   = document.getElementById('close-album-btn');
const albumFeed       = document.getElementById('album-feed');
const albumAdminCtrl  = document.getElementById('album-admin-controls');
const addMemBtn       = document.getElementById('add-memory-to-album-btn');

const addMemModal     = document.getElementById('add-memory-modal');
const saveMemBtn      = document.getElementById('save-memory-btn');
const cancelMemBtn    = document.getElementById('cancel-memory-btn');
const memPhoto        = document.getElementById('memory-photo');
const memDate         = document.getElementById('memory-date');
const memNote         = document.getElementById('memory-note');
const memFont         = document.getElementById('memory-font');
const memColor        = document.getElementById('memory-color');

const textEditModal   = document.getElementById('text-edit-modal');
const textEditInput   = document.getElementById('text-edit-input');
const textEditSave    = document.getElementById('text-edit-save-btn');
const textEditCancel  = document.getElementById('text-edit-cancel-btn');

const imageEditInput  = document.getElementById('image-edit-input');
const editBanner      = document.getElementById('edit-mode-banner');
const exitEditBtn     = document.getElementById('exit-edit-mode-btn');

const emojis = {
  red_rose:'🌹', white_rose:'🌼', pink_rose:'🌸', lily:'🪷',
  sunflower:'🌻', tulip:'🌷', cherry_blossom:'🌺', daisy:'🥀'
};

// =============================================
// INIT
// =============================================
function init() {
  createPetals();
  initFlipbook();
  initMap();
  loadBookContent();

  // Nav
  navHome.addEventListener('click', () => { closeAlbumSheet(); hideAdmin(); resetNav(); navHome.classList.add('active'); });
  navGrowth.addEventListener('click', () => { toggleVine(); resetNav(); navGrowth.classList.add('active'); });
  navAdmin.addEventListener('click', () => {
    resetNav(); navAdmin.classList.add('active');
    if (isAdmin) showAdmin();
    else adminLoginModal.classList.remove('hidden');
  });

  // Admin login
  loginSubmitBtn.addEventListener('click', handleLogin);
  loginCancelBtn.addEventListener('click', () => { adminLoginModal.classList.add('hidden'); resetNav(); navHome.classList.add('active'); });
  adminPassInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // Admin dashboard
  closeAdminBtn.addEventListener('click', hideAdmin);
  adminPlantBtn.addEventListener('click', handlePlant);
  toggleEditBtn.addEventListener('click', toggleEditMode);

  // Album sheet
  closeAlbumBtn.addEventListener('click', closeAlbumSheet);
  addMemBtn.addEventListener('click', () => addMemModal.classList.remove('hidden'));
  cancelMemBtn.addEventListener('click', () => addMemModal.classList.add('hidden'));
  saveMemBtn.addEventListener('click', saveMemory);

  // Text editor
  textEditSave.addEventListener('click', saveTextEdit);
  textEditCancel.addEventListener('click', () => { textEditModal.classList.add('hidden'); activeEditId = null; });

  // Image editor
  imageEditInput.addEventListener('change', handleImageUpload);

  // Edit mode exit banner
  exitEditBtn.addEventListener('click', toggleEditMode);
}

// =============================================
// FLIPBOOK
// =============================================
function initFlipbook() {
  const bookEl = document.getElementById('book');
  if (!window.St || !window.St.PageFlip) return;

  pageFlip = new window.St.PageFlip(bookEl, {
    width: 380, height: 580, size: 'stretch',
    minWidth: 280, maxWidth: 900,
    minHeight: 380, maxHeight: 900,
    maxShadowOpacity: 0.5,
    showCover: true,
    mobileScrollSupport: false,
    usePortrait: true,
    autoSize: true,
    flippingTime: 700
  });

  pageFlip.loadFromHTML(document.querySelectorAll('.page'));

  pageFlip.on('flip', e => {
    // Page 3 is the map page (0-indexed = 3)
    if (e.data === 3 && map) {
      setTimeout(() => map.invalidateSize(), 400);
    }
  });
}

// =============================================
// MAP
// =============================================
function initMap() {
  map = L.map('map', {
    zoomControl: false,
    dragging: !L.Browser.mobile,
    tap: !L.Browser.mobile
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM contributors', subdomains: 'abcd', maxZoom: 20
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      p => { map.setView([p.coords.latitude, p.coords.longitude], 14); loadLocations(); },
      () => { map.setView([30.0444, 31.2357], 12); loadLocations(); }
    );
  } else {
    map.setView([30.0444, 31.2357], 12);
    loadLocations();
  }

  map.on('click', closeAlbumSheet);
}

// =============================================
// LOCATIONS & MARKERS
// =============================================
async function loadLocations() {
  try {
    const { data, error } = await window.supabaseDb.from('locations').select('*, memories(*)');
    if (error) throw error;
    if (data) {
      currentLocations.forEach(l => { if (l.marker) map.removeLayer(l.marker); });
      currentLocations = data;
      currentLocations.forEach(drawMarker);
      if (isAdmin && adminSheet && !adminSheet.classList.contains('fade-out')) renderAdminPanel();
    }
  } catch (e) { console.error('loadLocations:', e); }
}

function drawMarker(loc) {
  const emoji = emojis[loc.flower_type] || '🌸';
  const icon = L.divIcon({
    html: `<div style="font-size:26px;line-height:26px;width:26px;height:26px;text-align:center;filter:drop-shadow(0 3px 5px rgba(0,0,0,0.5));">${emoji}</div>`,
    className: 'flower-icon', iconSize: [26, 26], iconAnchor: [13, 13]
  });
  const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
  marker.on('click', () => openAlbumSheet(loc));
  loc.marker = marker;
}

function openAlbumSheet(loc) {
  activeLocationId = loc.id;
  albumFeed.innerHTML = '';
  isAdmin ? albumAdminCtrl.classList.remove('hidden') : albumAdminCtrl.classList.add('hidden');

  if (loc.memories?.length > 0) {
    const sorted = [...loc.memories].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(mem => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.style.backgroundColor = mem.bg_color || '#fff';
      const fontMap = { 'Playfair Display': 'font-playfair', 'Caveat': 'font-caveat', 'Dancing Script': 'font-dancing' };
      const fc = fontMap[mem.font] || '';
      card.innerHTML = `
        <img src="${mem.photo}" alt="Memory" loading="lazy" />
        <div class="memory-date ${fc}">${new Date(mem.date).toLocaleDateString()}</div>
        ${mem.note ? `<div class="memory-note ${fc}">${mem.note}</div>` : ''}
      `;
      albumFeed.appendChild(card);
    });
  } else {
    albumFeed.innerHTML = `<p style="text-align:center;color:#888;margin-top:2rem;">A seed was planted here. 🌱</p>`;
  }

  albumSheet.classList.remove('hidden');
  void albumSheet.offsetWidth;
  albumSheet.classList.add('open');
}

function closeAlbumSheet() {
  albumSheet.classList.remove('open');
  setTimeout(() => albumSheet.classList.add('hidden'), 400);
  activeLocationId = null;
}

// =============================================
// VINE / PATH
// =============================================
function toggleVine() {
  if (vinePath) { map.removeLayer(vinePath); vinePath = null; return; }
  const pts = [];
  currentLocations.forEach(loc => {
    (loc.memories || []).forEach(m => pts.push({ lat: loc.lat, lng: loc.lng, d: new Date(m.date) }));
  });
  pts.sort((a, b) => a.d - b.d);
  const latlngs = pts.map(p => [p.lat, p.lng]);
  if (latlngs.length < 2) return;

  vinePath = L.polyline(latlngs, { color: '#ff69b4', weight: 3, opacity: 0.85, dashArray: '10,10' }).addTo(map);
  const path = vinePath._path;
  const len = path.getTotalLength();
  path.style.transition = 'none';
  path.style.strokeDasharray = `${len} ${len}`;
  path.style.strokeDashoffset = len;
  path.getBoundingClientRect();
  path.style.transition = 'stroke-dashoffset 3s ease-in-out';
  path.style.strokeDashoffset = 0;
}

// =============================================
// ADMIN
// =============================================
function resetNav() { document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); }

function handleLogin() {
  if (adminPassInput.value === 'bustan') {
    isAdmin = true;
    adminLoginModal.classList.add('hidden');
    adminPassInput.value = '';
    showAdmin();
  } else {
    adminPassInput.style.borderColor = '#ff6b6b';
    setTimeout(() => adminPassInput.style.borderColor = '', 1000);
  }
}

function showAdmin() { adminSheet.classList.remove('fade-out'); renderAdminPanel(); }
function hideAdmin() { adminSheet.classList.add('fade-out'); resetNav(); navHome.classList.add('active'); }

function renderAdminPanel() {
  adminLocList.innerHTML = '';
  if (!currentLocations.length) {
    adminLocList.innerHTML = '<p style="color:#666;font-size:0.9rem;">No flowers planted yet.</p>';
    return;
  }
  currentLocations.forEach(loc => {
    const emoji = emojis[loc.flower_type] || '🌸';
    const el = document.createElement('div');
    el.className = 'admin-loc-item';
    let html = `<div class="admin-loc-header"><strong>${emoji} ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</strong><button class="danger-btn" onclick="deleteLocation('${loc.id}')">Delete</button></div>`;
    if (loc.memories?.length) {
      html += `<div class="admin-mem-list">`;
      loc.memories.forEach(m => {
        html += `<div class="admin-mem-item"><span>${new Date(m.date).toLocaleDateString()}</span><button class="danger-btn" onclick="deleteMemory('${m.id}')">Del</button></div>`;
      });
      html += `</div>`;
    } else {
      html += `<div style="color:#666;font-size:0.8rem;margin-top:6px;">Empty folder</div>`;
    }
    el.innerHTML = html;
    adminLocList.appendChild(el);
  });
}

window.deleteLocation = async (id) => {
  if (!confirm('Delete this flower and all its memories?')) return;
  try { await window.supabaseDb.from('locations').delete().eq('id', id); await loadLocations(); }
  catch (e) { alert('Error: ' + e.message); }
};

window.deleteMemory = async (id) => {
  if (!confirm('Delete this memory?')) return;
  try { await window.supabaseDb.from('memories').delete().eq('id', id); await loadLocations(); }
  catch (e) { alert('Error: ' + e.message); }
};

async function handlePlant() {
  const input = adminMapLink.value.trim();
  adminPlantErr.style.display = 'none';
  let lat, lng;

  const dec = input.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  const url = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const dms = input.match(/(\d+)°(\d+)'([\d.]+)"([NS])[,\s]+(\d+)°(\d+)'([\d.]+)"([EW])/i);

  if (dec) { lat = +dec[1]; lng = +dec[2]; }
  else if (url) { lat = +url[1]; lng = +url[2]; }
  else if (dms) {
    lat = +dms[1] + +dms[2]/60 + +dms[3]/3600;
    if (dms[4].toUpperCase() === 'S') lat = -lat;
    lng = +dms[5] + +dms[6]/60 + +dms[7]/3600;
    if (dms[8].toUpperCase() === 'W') lng = -lng;
  } else {
    adminPlantErr.textContent = 'Could not read coordinates. Try: 30.044, 31.235';
    adminPlantErr.style.display = 'block';
    return;
  }

  adminPlantBtn.textContent = 'Planting... 🌱';
  adminPlantBtn.disabled = true;
  try {
    const { error } = await window.supabaseDb.from('locations').insert([{ lat, lng, flower_type: adminFlower.value }]);
    if (error) throw error;
    adminMapLink.value = '';
    await loadLocations();
    map.setView([lat, lng], 15);
  } catch (e) { alert('Failed: ' + e.message); }
  finally { adminPlantBtn.textContent = 'Extract & Plant'; adminPlantBtn.disabled = false; }
}

// =============================================
// MEMORY UPLOAD (for map spots)
// =============================================
async function saveMemory() {
  const file = memPhoto.files[0];
  if (!file) { alert('Please choose a photo.'); return; }
  saveMemBtn.textContent = 'Saving...'; saveMemBtn.disabled = true;

  try {
    const fileName = `${Date.now()}-${file.name}`;
    const { error: upErr } = await window.supabaseDb.storage.from('memories').upload(fileName, file);
    if (upErr) throw upErr;
    const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);

    const { error: dbErr } = await window.supabaseDb.from('memories').insert([{
      location_id: activeLocationId,
      photo: urlData.publicUrl,
      date: memDate.value || new Date().toISOString(),
      note: memNote.value,
      font: memFont.value,
      bg_color: memColor.value
    }]);
    if (dbErr) throw dbErr;

    addMemModal.classList.add('hidden');
    memPhoto.value = ''; memNote.value = '';
    await loadLocations();
    const loc = currentLocations.find(l => l.id === activeLocationId);
    if (loc) openAlbumSheet(loc);
  } catch (e) { alert('Save failed: ' + e.message); }
  finally { saveMemBtn.textContent = 'Save'; saveMemBtn.disabled = false; }
}

// =============================================
// VISUAL EDITOR — EDIT MODE
// =============================================
function toggleEditMode() {
  isEditMode = !isEditMode;
  document.body.classList.toggle('edit-mode', isEditMode);
  editBanner.classList.toggle('hidden', !isEditMode);
  toggleEditBtn.textContent = isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode';

  if (isEditMode) {
    // close admin panel so book is visible
    hideAdmin();
    attachEditListeners();
  } else {
    removeEditListeners();
  }
}

function attachEditListeners() {
  document.querySelectorAll('.editable-img').forEach(el => {
    el.addEventListener('click', onImageClick);
  });
  document.querySelectorAll('.editable-text').forEach(el => {
    el.addEventListener('click', onTextClick);
  });
}

function removeEditListeners() {
  document.querySelectorAll('.editable-img').forEach(el => el.removeEventListener('click', onImageClick));
  document.querySelectorAll('.editable-text').forEach(el => el.removeEventListener('click', onTextClick));
}

function onImageClick(e) {
  if (!isEditMode) return;
  activeEditId = e.currentTarget.dataset.editId;
  imageEditInput.click();
}

function onTextClick(e) {
  if (!isEditMode) return;
  activeEditId = e.currentTarget.dataset.editId;
  textEditInput.value = e.currentTarget.innerText;
  textEditModal.classList.remove('hidden');
}

// =============================================
// VISUAL EDITOR — IMAGE UPLOAD
// =============================================
async function handleImageUpload() {
  const file = imageEditInput.files[0];
  if (!file || !activeEditId) return;

  const btn = document.querySelector(`[data-edit-id="${activeEditId}"]`);
  if (btn) btn.style.opacity = '0.4';

  try {
    const fileName = `book/${activeEditId}-${Date.now()}.${file.name.split('.').pop()}`;
    const { error: upErr } = await window.supabaseDb.storage.from('memories').upload(fileName, file, { upsert: true });
    if (upErr) throw upErr;

    const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
    const publicUrl = urlData.publicUrl;

    // Update in DB
    await upsertBookContent(activeEditId, 'image', publicUrl);

    // Update on page
    const imgEl = document.querySelector(`img[data-edit-id="${activeEditId}"]`);
    if (imgEl) imgEl.src = publicUrl;
  } catch (e) { alert('Upload failed: ' + e.message); }
  finally {
    if (btn) btn.style.opacity = '1';
    imageEditInput.value = '';
    activeEditId = null;
  }
}

// =============================================
// VISUAL EDITOR — TEXT SAVE
// =============================================
async function saveTextEdit() {
  if (!activeEditId) return;
  const newText = textEditInput.value.trim();
  if (!newText) return;

  textEditSave.textContent = 'Saving...'; textEditSave.disabled = true;

  try {
    await upsertBookContent(activeEditId, 'text', newText);
    const el = document.querySelector(`[data-edit-id="${activeEditId}"]`);
    if (el) el.innerText = newText;
    textEditModal.classList.add('hidden');
    activeEditId = null;
  } catch (e) { alert('Save failed: ' + e.message); }
  finally { textEditSave.textContent = 'Save'; textEditSave.disabled = false; }
}

// =============================================
// SUPABASE: BOOK CONTENT
// =============================================
async function upsertBookContent(elementId, contentType, contentValue) {
  const { error } = await window.supabaseDb.from('book_content').upsert({
    element_id: elementId,
    content_type: contentType,
    content_value: contentValue,
    updated_at: new Date().toISOString()
  }, { onConflict: 'element_id' });
  if (error) throw error;
}

async function loadBookContent() {
  try {
    const { data, error } = await window.supabaseDb.from('book_content').select('*');
    if (error) throw error;
    if (!data) return;

    data.forEach(row => {
      if (row.content_type === 'image') {
        const el = document.querySelector(`img[data-edit-id="${row.element_id}"]`);
        if (el) el.src = row.content_value;
      } else if (row.content_type === 'text') {
        const el = document.querySelector(`[data-edit-id="${row.element_id}"]`);
        if (el) el.innerText = row.content_value;
      }
    });
  } catch (e) { console.error('loadBookContent:', e); }
}

// =============================================
// PETALS
// =============================================
function createPetals() {
  const c = document.getElementById('petal-container');
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.classList.add('petal');
    const size = Math.random() * 10 + 8;
    p.style.cssText = `width:${size}px; height:${size}px; left:${Math.random()*100}vw; animation-duration:${Math.random()*12+15}s,${Math.random()*3+2}s; animation-delay:${Math.random()*15}s,0s; opacity:0;`;
    c.appendChild(p);
  }
}

// =============================================
// BOOT
// =============================================
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
