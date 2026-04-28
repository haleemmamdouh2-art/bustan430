// Global State
let map;
let pageFlip;
let isAdmin = false;
let vinePath = null;
let currentLocations = []; 
let activeLocationId = null;

// DOM Elements
const navHome = document.getElementById('nav-home');
const navLiveGrowth = document.getElementById('nav-live-growth');
const navAdmin = document.getElementById('nav-admin');

const adminLoginModal = document.getElementById('admin-login-modal');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginCancelBtn = document.getElementById('login-cancel-btn');
const adminPasswordInput = document.getElementById('admin-password');

const adminDashboardSheet = document.getElementById('admin-dashboard-sheet');
const closeAdminDashboardBtn = document.getElementById('close-admin-dashboard-btn');
const adminMapLinkInput = document.getElementById('admin-map-link');
const adminFlowerTypeSelect = document.getElementById('admin-flower-type');
const adminExtractPlantBtn = document.getElementById('admin-extract-plant-btn');
const adminPlantError = document.getElementById('admin-plant-error');
const adminLocationsList = document.getElementById('admin-locations-list');

const albumSheet = document.getElementById('album-sheet');
const closeAlbumBtn = document.getElementById('close-album-btn');
const albumFeed = document.getElementById('album-feed');
const albumAdminControls = document.getElementById('album-admin-controls');
const addMemoryToAlbumBtn = document.getElementById('add-memory-to-album-btn');

const addMemoryModal = document.getElementById('add-memory-modal');
const saveMemoryBtn = document.getElementById('save-memory-btn');
const cancelMemoryBtn = document.getElementById('cancel-memory-btn');
const memoryPhotoInput = document.getElementById('memory-photo');
const memoryDateInput = document.getElementById('memory-date');
const memoryNoteInput = document.getElementById('memory-note');
const memoryFontSelect = document.getElementById('memory-font');
const memoryColorSelect = document.getElementById('memory-color');

// Emojis for markers
const emojis = {
  red_rose: '🌹', white_rose: '🌼', pink_rose: '🌸', lily: '🪷',
  sunflower: '🌻', tulip: '🌷', cherry_blossom: '🌺', daisy: '🥀'
};

function init() {
  createRealisticPetals();
  
  // 1. Initialize Flipbook
  const bookEl = document.getElementById('book');
  if (window.St && window.St.PageFlip) {
    pageFlip = new window.St.PageFlip(bookEl, {
      width: 400, // Base width
      height: 600, // Base height
      size: 'stretch',
      minWidth: 300,
      maxWidth: 1000,
      minHeight: 400,
      maxHeight: 1000,
      maxShadowOpacity: 0.5,
      showCover: true,
      mobileScrollSupport: false,
      usePortrait: true // Forces 1 page on mobile, 2 on desktop
    });

    pageFlip.loadFromHTML(document.querySelectorAll('.page'));

    // Fix map rendering when flipping to the map page
    pageFlip.on('flip', (e) => {
      // If we flip to page 3 (index 3), invalidate the map size so it renders perfectly
      if (e.data === 3 && map) {
        setTimeout(() => map.invalidateSize(), 300);
      }
    });
  }

  // 2. Initialize Map
  initMapWithGeolocation();
  
  // Nav
  navHome.addEventListener('click', () => { 
    closeSheet(); 
    adminDashboardSheet.classList.add('fade-out');
    resetNav(); 
    navHome.classList.add('active'); 
  });
  navLiveGrowth.addEventListener('click', () => { toggleVinePath(); resetNav(); navLiveGrowth.classList.add('active'); });
  navAdmin.addEventListener('click', () => { 
    if (isAdmin) openAdminDashboard();
    else adminLoginModal.classList.remove('hidden'); 
    resetNav(); navAdmin.classList.add('active'); 
  });
  
  // Admin Login & Dashboard
  loginCancelBtn.addEventListener('click', () => adminLoginModal.classList.add('hidden'));
  loginSubmitBtn.addEventListener('click', handleLogin);
  closeAdminDashboardBtn.addEventListener('click', () => {
    adminDashboardSheet.classList.add('fade-out');
    resetNav();
    navHome.classList.add('active');
  });
  adminExtractPlantBtn.addEventListener('click', handleAdminPlant);

  // Sheet Controls
  closeAlbumBtn.addEventListener('click', closeSheet);
  
  // Memory Modal
  addMemoryToAlbumBtn.addEventListener('click', () => addMemoryModal.classList.remove('hidden'));
  cancelMemoryBtn.addEventListener('click', () => addMemoryModal.classList.add('hidden'));
  saveMemoryBtn.addEventListener('click', saveMemory);
}

// -------------------------
// MAP INITIALIZATION
// -------------------------
function resetNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
}

function initMapWithGeolocation() {
  // Disable dragging on mobile so users don't accidentally turn the page while panning
  map = L.map('map', { 
    zoomControl: false,
    dragging: !L.Browser.mobile,
    tap: !L.Browser.mobile
  });
  
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM', subdomains: 'abcd', maxZoom: 20
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => { map.setView([pos.coords.latitude, pos.coords.longitude], 14); loadLocations(); },
      () => { map.setView([30.0444, 31.2357], 12); loadLocations(); }
    );
  } else {
    map.setView([30.0444, 31.2357], 12);
    loadLocations();
  }

  map.on('click', closeSheet);
}

// -------------------------
// DATA LOADING & RENDERING
// -------------------------
async function loadLocations() {
  try {
    const { data, error } = await window.supabaseDb.from('locations').select('*, memories(*)');
    if (error) throw error;
    if (data) {
      currentLocations.forEach(loc => { if(loc.marker) map.removeLayer(loc.marker); });
      currentLocations = data;
      currentLocations.forEach(loc => drawMarker(loc));
      if (isAdmin && !adminDashboardSheet.classList.contains('fade-out')) renderAdminDashboard();
    }
  } catch (err) {
    console.error("Failed to load locations:", err);
  }
}

function drawMarker(location) {
  const emoji = emojis[location.flower_type] || emojis.red_rose;
  const icon = L.divIcon({
    html: `<div style="font-size: 26px; text-shadow: 0 4px 6px rgba(0,0,0,0.6); text-align: center; line-height: 26px; width: 26px; height: 26px;">${emoji}</div>`,
    className: 'flower-icon', iconSize: [26, 26], iconAnchor: [13, 13]
  });
  
  const marker = L.marker([location.lat, location.lng], { icon }).addTo(map);
  marker.on('click', () => openAlbumSheet(location));
  location.marker = marker;
}

function openAlbumSheet(location) {
  activeLocationId = location.id;
  albumFeed.innerHTML = '';
  
  if (isAdmin) albumAdminControls.classList.remove('hidden');
  else albumAdminControls.classList.add('hidden');

  if (location.memories && location.memories.length > 0) {
    const sorted = [...location.memories].sort((a,b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(mem => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      card.style.backgroundColor = mem.bg_color;
      let fontClass = 'font-outfit';
      if (mem.font === 'Playfair Display') fontClass = 'font-playfair';
      if (mem.font === 'Caveat') fontClass = 'font-caveat';
      if (mem.font === 'Dancing Script') fontClass = 'font-dancing';
      card.innerHTML = `
        <img src="${mem.photo}" alt="Memory" loading="lazy" />
        <div class="memory-header"><div class="memory-date ${fontClass}">${new Date(mem.date).toLocaleDateString()}</div></div>
        ${mem.note ? `<div class="memory-note ${fontClass}">${mem.note}</div>` : ''}
      `;
      albumFeed.appendChild(card);
    });
  } else {
    albumFeed.innerHTML = `<p style="text-align:center; color: #888; margin-top:2rem;">A seed was planted here.</p>`;
  }
  
  albumSheet.classList.remove('hidden');
  void albumSheet.offsetWidth;
  albumSheet.classList.add('open');
}

function closeSheet() {
  albumSheet.classList.remove('open');
  setTimeout(() => albumSheet.classList.add('hidden'), 400);
  activeLocationId = null;
}

// -------------------------
// ADMIN DASHBOARD
// -------------------------
function handleLogin() {
  if (adminPasswordInput.value === "bustan") { 
    isAdmin = true; adminLoginModal.classList.add('hidden'); openAdminDashboard();
  } else { alert("Incorrect password"); }
}

function openAdminDashboard() { adminDashboardSheet.classList.remove('fade-out'); renderAdminDashboard(); }

function renderAdminDashboard() {
  adminLocationsList.innerHTML = '';
  if (currentLocations.length === 0) { adminLocationsList.innerHTML = `<p style="color:#888;">No flowers planted yet.</p>`; return; }
  
  currentLocations.forEach(loc => {
    const item = document.createElement('div');
    item.className = 'admin-loc-item';
    const flowerEmoji = emojis[loc.flower_type] || '🌸';
    let html = `
      <div class="admin-loc-header">
        <strong>${flowerEmoji} ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</strong>
        <button class="danger-btn" onclick="deleteLocation('${loc.id}')">Delete Folder</button>
      </div>`;
    
    if (loc.memories && loc.memories.length > 0) {
      html += `<div class="admin-mem-list">`;
      loc.memories.forEach(mem => {
        html += `<div class="admin-mem-item"><span>Photo from ${new Date(mem.date).toLocaleDateString()}</span><button class="danger-btn" onclick="deleteMemory('${mem.id}', '${loc.id}')">Del</button></div>`;
      });
      html += `</div>`;
    } else { html += `<div style="color:#888; font-size:0.8rem; margin-top:0.5rem;">Empty folder</div>`; }
    item.innerHTML = html; adminLocationsList.appendChild(item);
  });
}

window.deleteLocation = async function(id) {
  if(!confirm("Are you sure?")) return;
  try { await window.supabaseDb.from('locations').delete().eq('id', id); await loadLocations(); } 
  catch (e) { alert("Error deleting location."); }
}

window.deleteMemory = async function(memId, locId) {
  if(!confirm("Delete this memory?")) return;
  try { await window.supabaseDb.from('memories').delete().eq('id', memId); await loadLocations(); } 
  catch (e) { alert("Error deleting memory."); }
}

async function handleAdminPlant() {
  const input = adminMapLinkInput.value.trim();
  adminPlantError.style.display = 'none';
  let lat, lng;
  const rawCoordMatch = input.match(/^(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)$/);
  const urlCoordMatch = input.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  const dmsMatch = input.match(/(\d+)°(\d+)'([\d.]+)"([NS])[\s,]+(\d+)°(\d+)'([\d.]+)"([EW])/i);

  if (rawCoordMatch) { lat = parseFloat(rawCoordMatch[1]); lng = parseFloat(rawCoordMatch[2]); } 
  else if (urlCoordMatch) { lat = parseFloat(urlCoordMatch[1]); lng = parseFloat(urlCoordMatch[2]); } 
  else if (dmsMatch) {
    lat = parseInt(dmsMatch[1]) + parseInt(dmsMatch[2])/60 + parseFloat(dmsMatch[3])/3600;
    if (dmsMatch[4].toUpperCase() === 'S') lat = -lat;
    lng = parseInt(dmsMatch[5]) + parseInt(dmsMatch[6])/60 + parseFloat(dmsMatch[7])/3600;
    if (dmsMatch[8].toUpperCase() === 'W') lng = -lng;
  } else {
    adminPlantError.innerText = "Could not parse coordinates. Ensure it is a Decimal (30.044, 31.235) or DMS format.";
    adminPlantError.style.display = 'block'; return;
  }
  
  adminExtractPlantBtn.innerText = "Planting..."; adminExtractPlantBtn.disabled = true;
  const type = adminFlowerTypeSelect.value;
  try {
    const { error } = await window.supabaseDb.from('locations').insert([{ lat, lng, flower_type: type }]).select();
    if (error) throw error;
    adminMapLinkInput.value = ''; await loadLocations(); map.setView([lat, lng], 14);
  } catch (err) { alert("Failed to plant flower: " + err.message); } 
  finally { adminExtractPlantBtn.innerText = "Extract & Plant"; adminExtractPlantBtn.disabled = false; }
}

// -------------------------
// MEMORY UPLOADING
// -------------------------
async function saveMemory() {
  const file = memoryPhotoInput.files[0];
  if (!file) { alert("Please upload a photo."); return; }
  saveMemoryBtn.innerText = "Saving..."; saveMemoryBtn.disabled = true;

  try {
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await window.supabaseDb.storage.from('memories').upload(fileName, file);
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
    
    const newMemory = {
      location_id: activeLocationId, photo: publicUrlData.publicUrl,
      date: memoryDateInput.value || new Date().toISOString(),
      note: memoryNoteInput.value, font: memoryFontSelect.value, bg_color: memoryColorSelect.value
    };

    const { error: dbError } = await window.supabaseDb.from('memories').insert([newMemory]).select();
    if (dbError) throw dbError;

    addMemoryModal.classList.add('hidden');
    memoryPhotoInput.value = ''; memoryNoteInput.value = '';
    await loadLocations();
    const loc = currentLocations.find(l => l.id === activeLocationId);
    openAlbumSheet(loc);
  } catch (err) { alert("Failed to save memory: " + err.message); } 
  finally { saveMemoryBtn.innerText = "Save"; saveMemoryBtn.disabled = false; }
}

function toggleVinePath() {
  if (vinePath) { map.removeLayer(vinePath); vinePath = null; return; }
  let allMemories = [];
  currentLocations.forEach(loc => {
    loc.memories.forEach(m => allMemories.push({ lat: loc.lat, lng: loc.lng, date: new Date(m.date) }));
  });
  allMemories.sort((a, b) => a.date - b.date);
  const latlngs = allMemories.map(m => [m.lat, m.lng]);
  if (latlngs.length < 2) return;

  vinePath = L.polyline(latlngs, { color: 'var(--gold)', weight: 3, opacity: 0.8, dashArray: '10, 10', lineCap: 'round' }).addTo(map);
  const path = vinePath._path;
  const length = path.getTotalLength();
  path.style.transition = 'none'; path.style.strokeDasharray = length + ' ' + length; path.style.strokeDashoffset = length;
  path.getBoundingClientRect();
  path.style.transition = 'stroke-dashoffset 3s ease-in-out'; path.style.strokeDashoffset = '0';
}

function createRealisticPetals() {
  const container = document.getElementById('petal-container');
  for (let i = 0; i < 15; i++) {
    const petal = document.createElement('div');
    petal.classList.add('petal');
    petal.style.width = `${Math.random() * 12 + 8}px`; petal.style.height = petal.style.width;
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.animationDuration = `${Math.random() * 10 + 15}s`; petal.style.animationDelay = `${Math.random() * 15}s`;
    container.appendChild(petal);
  }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
