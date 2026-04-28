// Global State
let map;
let isAdmin = false;
let vinePath = null;
let currentLocations = []; // stores locations and their memories
let activeLocationId = null; // currently opened album
let tempLatLng = null; // when clicking map to add a location

// DOM Elements
const landingOverlay = document.getElementById('landing-overlay');
const enterGardenBtn = document.getElementById('enter-garden-btn');
const appContainer = document.getElementById('app');

const navHome = document.getElementById('nav-home');
const navLiveGrowth = document.getElementById('nav-live-growth');
const navAdmin = document.getElementById('nav-admin');

const adminLoginModal = document.getElementById('admin-login-modal');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginCancelBtn = document.getElementById('login-cancel-btn');
const adminPasswordInput = document.getElementById('admin-password');

const adminAddInfo = document.getElementById('admin-add-info');
const exitAdminBtn = document.getElementById('exit-admin-btn');

const albumSheet = document.getElementById('album-sheet');
const closeAlbumBtn = document.getElementById('close-album-btn');
const albumFeed = document.getElementById('album-feed');
const albumAdminControls = document.getElementById('album-admin-controls');
const addMemoryToAlbumBtn = document.getElementById('add-memory-to-album-btn');

const addLocationModal = document.getElementById('add-location-modal');
const saveLocationBtn = document.getElementById('save-location-btn');
const cancelLocationBtn = document.getElementById('cancel-location-btn');
const locationFlowerType = document.getElementById('location-flower-type');

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
  red_rose: '🌹',
  white_rose: '🌼',
  pink_rose: '🌸',
  lily: '🪷',
  sunflower: '🌻',
  tulip: '🌷',
  cherry_blossom: '🌺',
  daisy: '🥀'
};

function init() {
  createRealisticPetals();
  
  enterGardenBtn.addEventListener('click', enterGarden);
  
  // Nav
  navHome.addEventListener('click', () => { closeSheet(); resetNav(); navHome.classList.add('active'); });
  navLiveGrowth.addEventListener('click', () => { toggleVinePath(); resetNav(); navLiveGrowth.classList.add('active'); });
  navAdmin.addEventListener('click', () => { adminLoginModal.classList.remove('hidden'); resetNav(); navAdmin.classList.add('active'); });
  
  // Admin Login
  loginCancelBtn.addEventListener('click', () => adminLoginModal.classList.add('hidden'));
  loginSubmitBtn.addEventListener('click', handleLogin);
  exitAdminBtn.addEventListener('click', () => {
    isAdmin = false;
    adminAddInfo.classList.add('hidden');
    map.getContainer().style.cursor = '';
    closeSheet();
  });

  // Sheet Controls
  closeAlbumBtn.addEventListener('click', closeSheet);
  
  // Location Modal
  cancelLocationBtn.addEventListener('click', () => addLocationModal.classList.add('hidden'));
  saveLocationBtn.addEventListener('click', saveLocation);
  
  // Memory Modal
  addMemoryToAlbumBtn.addEventListener('click', () => addMemoryModal.classList.remove('hidden'));
  cancelMemoryBtn.addEventListener('click', () => addMemoryModal.classList.add('hidden'));
  saveMemoryBtn.addEventListener('click', saveMemory);
}

function resetNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
}

function enterGarden() {
  landingOverlay.classList.add('fade-out');
  setTimeout(() => {
    landingOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    initMapWithGeolocation();
  }, 1000);
}

function initMapWithGeolocation() {
  map = L.map('map', { zoomControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OSM', subdomains: 'abcd', maxZoom: 20
  }).addTo(map);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 14);
        loadLocations();
      },
      () => {
        map.setView([30.0444, 31.2357], 12); // Cairo Fallback
        loadLocations();
      }
    );
  } else {
    map.setView([30.0444, 31.2357], 12);
    loadLocations();
  }

  map.on('click', (e) => {
    if (isAdmin) {
      tempLatLng = e.latlng;
      addLocationModal.classList.remove('hidden');
    } else {
      closeSheet();
    }
  });
}

// -------------------------
// DATA LOADING & RENDERING
// -------------------------
async function loadLocations() {
  try {
    const { data, error } = await window.supabaseDb
      .from('locations')
      .select('*, memories(*)');
      
    if (error) throw error;
    if (data) {
      currentLocations = data;
      data.forEach(loc => drawMarker(loc));
    }
  } catch (err) {
    console.error("Failed to load locations:", err);
  }
}

function drawMarker(location) {
  const emoji = emojis[location.flower_type] || emojis.red_rose;
  const icon = L.divIcon({
    html: `<div style="font-size: 38px; text-shadow: 0 4px 10px rgba(0,0,0,0.6); text-align: center; line-height: 40px; width: 40px; height: 40px;">${emoji}</div>`,
    className: 'flower-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
  });
  
  const marker = L.marker([location.lat, location.lng], { icon }).addTo(map);
  
  marker.on('click', () => {
    openAlbumSheet(location);
  });
  
  location.marker = marker; // Keep reference
}

function openAlbumSheet(location) {
  activeLocationId = location.id;
  albumFeed.innerHTML = '';
  
  if (isAdmin) {
    albumAdminControls.classList.remove('hidden');
  } else {
    albumAdminControls.classList.add('hidden');
  }

  if (location.memories && location.memories.length > 0) {
    // Sort by date oldest first
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
        <div class="memory-header">
          <div class="memory-date ${fontClass}">${new Date(mem.date).toLocaleDateString()}</div>
        </div>
        ${mem.note ? `<div class="memory-note ${fontClass}">${mem.note}</div>` : ''}
      `;
      albumFeed.appendChild(card);
    });
  } else {
    albumFeed.innerHTML = `<p style="text-align:center; color: #888; margin-top:2rem;">A seed was planted here. Waiting to bloom.</p>`;
  }
  
  albumSheet.classList.add('open');
}

function closeSheet() {
  albumSheet.classList.remove('open');
  activeLocationId = null;
}

// -------------------------
// SAVING FLOW
// -------------------------
async function saveLocation() {
  saveLocationBtn.innerText = "Planting...";
  saveLocationBtn.disabled = true;
  
  const type = locationFlowerType.value;
  const newLoc = { lat: tempLatLng.lat, lng: tempLatLng.lng, flower_type: type };
  
  try {
    const { data, error } = await window.supabaseDb.from('locations').insert([newLoc]).select();
    if (error) throw error;
    
    const savedLoc = { ...data[0], memories: [] };
    currentLocations.push(savedLoc);
    drawMarker(savedLoc);
    
    addLocationModal.classList.add('hidden');
    // Instantly open the album to prompt adding a photo
    openAlbumSheet(savedLoc);
  } catch (err) {
    alert("Failed to plant flower: " + err.message);
  } finally {
    saveLocationBtn.innerText = "Plant";
    saveLocationBtn.disabled = false;
  }
}

async function saveMemory() {
  const file = memoryPhotoInput.files[0];
  if (!file) {
    alert("Please upload a photo to make this memory bloom.");
    return;
  }
  
  saveMemoryBtn.innerText = "Saving...";
  saveMemoryBtn.disabled = true;

  try {
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await window.supabaseDb.storage.from('memories').upload(fileName, file);
    if (uploadError) throw uploadError;
    
    const { data: publicUrlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
    const photoUrl = publicUrlData.publicUrl;

    const newMemory = {
      location_id: activeLocationId,
      photo: photoUrl,
      date: memoryDateInput.value || new Date().toISOString(),
      note: memoryNoteInput.value,
      font: memoryFontSelect.value,
      bg_color: memoryColorSelect.value
    };

    const { data, error: dbError } = await window.supabaseDb.from('memories').insert([newMemory]).select();
    if (dbError) throw dbError;

    // Update local state
    const loc = currentLocations.find(l => l.id === activeLocationId);
    if (loc) {
      loc.memories.push(data[0]);
    }
    
    // Refresh Sheet
    addMemoryModal.classList.add('hidden');
    memoryPhotoInput.value = '';
    memoryNoteInput.value = '';
    openAlbumSheet(loc);

  } catch (err) {
    alert("Failed to save memory: " + err.message);
  } finally {
    saveMemoryBtn.innerText = "Save";
    saveMemoryBtn.disabled = false;
  }
}

function handleLogin() {
  if (adminPasswordInput.value === "bustan") { 
    isAdmin = true;
    adminLoginModal.classList.add('hidden');
    adminAddInfo.classList.remove('hidden');
    map.getContainer().style.cursor = 'crosshair';
    if(activeLocationId) {
      // Refresh sheet to show Add Memory button
      const loc = currentLocations.find(l => l.id === activeLocationId);
      openAlbumSheet(loc);
    }
  } else {
    alert("Incorrect password");
  }
}

function toggleVinePath() {
  if (vinePath) { map.removeLayer(vinePath); vinePath = null; return; }
  
  // Collect all memories and sort by date to draw chronological path
  let allMemories = [];
  currentLocations.forEach(loc => {
    loc.memories.forEach(m => {
      allMemories.push({ lat: loc.lat, lng: loc.lng, date: new Date(m.date) });
    });
  });
  
  allMemories.sort((a, b) => a.date - b.date);
  const latlngs = allMemories.map(m => [m.lat, m.lng]);
  
  if (latlngs.length < 2) return;

  vinePath = L.polyline(latlngs, { color: 'var(--gold)', weight: 3, opacity: 0.8, dashArray: '10, 10', lineCap: 'round' }).addTo(map);
  const path = vinePath._path;
  const length = path.getTotalLength();
  path.style.transition = 'none';
  path.style.strokeDasharray = length + ' ' + length;
  path.style.strokeDashoffset = length;
  path.getBoundingClientRect();
  path.style.transition = 'stroke-dashoffset 3s ease-in-out';
  path.style.strokeDashoffset = '0';
}

function createRealisticPetals() {
  const container = document.getElementById('petal-container');
  // Lower count for elegance
  for (let i = 0; i < 15; i++) {
    const petal = document.createElement('div');
    petal.classList.add('petal');
    petal.style.width = `${Math.random() * 12 + 8}px`;
    petal.style.height = petal.style.width;
    petal.style.left = `${Math.random() * 100}vw`;
    petal.style.animationDuration = `${Math.random() * 10 + 15}s`; // Slower fall (15-25s)
    petal.style.animationDelay = `${Math.random() * 15}s`;
    container.appendChild(petal);
  }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
