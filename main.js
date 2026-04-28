import { supabase } from './supabase.js';

// Configuration
// If the user hasn't provided a countdown date yet, we use a placeholder of 60 days from now.
const COUNTDOWN_TARGET = new Date();
COUNTDOWN_TARGET.setDate(COUNTDOWN_TARGET.getDate() + 60); 

let map;
let isAdmin = false;
let markers = [];
let vinePath = null;
let selectedLatLng = null;

// DOM Elements
const landingOverlay = document.getElementById('landing-overlay');
const enterGardenBtn = document.getElementById('enter-garden-btn');
const appContainer = document.getElementById('app');

const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLoginModal = document.getElementById('admin-login-modal');
const loginSubmitBtn = document.getElementById('login-submit-btn');
const loginCancelBtn = document.getElementById('login-cancel-btn');
const adminPasswordInput = document.getElementById('admin-password');

const adminAddInfo = document.getElementById('admin-add-info');
const exitAdminBtn = document.getElementById('exit-admin-btn');

const addMemoryModal = document.getElementById('add-memory-modal');
const saveMemoryBtn = document.getElementById('save-memory-btn');
const cancelMemoryBtn = document.getElementById('cancel-memory-btn');
const memoryPhotoInput = document.getElementById('memory-photo');
const memoryDateInput = document.getElementById('memory-date');
const memoryNoteInput = document.getElementById('memory-note');
const memoryFlowerType = document.getElementById('memory-flower-type');

const liveGrowthBtn = document.getElementById('live-growth-btn');

const pickupLineTrigger = document.getElementById('pickup-line-trigger');
const pickupLinePopup = document.getElementById('pickup-line-popup');
const closePickupLineBtn = document.getElementById('close-pickup-line');

const countdownTimer = document.getElementById('countdown-timer');

// SVG paths for flowers
const flowerIcons = {
  rose: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23e6b3b3" stroke="%23cc9999" stroke-width="1"><path d="M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"/><path d="M12 7v10M9 12a3 3 0 0 1 6 0"/></svg>`,
  lily: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23f4f4f4" stroke="%239fbba2" stroke-width="1"><path d="M12 22c4-4 8-8 8-12A8 8 0 0 0 4 10c0 4 4 8 8 12z"/></svg>`,
  sunflower: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23d4af37" stroke="%23b8962e" stroke-width="1"><circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1l2.1-2.1M17 7l2.1-2.1"/></svg>`
};

// Initialize App
function init() {
  createPetals();
  startCountdown();

  // Event Listeners
  enterGardenBtn.addEventListener('click', enterGarden);
  
  // Admin Login
  adminLoginBtn.addEventListener('click', () => adminLoginModal.classList.remove('hidden'));
  loginCancelBtn.addEventListener('click', () => adminLoginModal.classList.add('hidden'));
  loginSubmitBtn.addEventListener('click', handleLogin);
  
  // Admin Exit
  exitAdminBtn.addEventListener('click', () => {
    isAdmin = false;
    adminAddInfo.classList.add('hidden');
    map.getContainer().style.cursor = '';
  });

  // Memory Modal
  cancelMemoryBtn.addEventListener('click', () => {
    addMemoryModal.classList.add('hidden');
    selectedLatLng = null;
  });
  saveMemoryBtn.addEventListener('click', handleSaveMemory);

  // Easter Eggs
  liveGrowthBtn.addEventListener('click', toggleVinePath);
  pickupLineTrigger.addEventListener('click', () => pickupLinePopup.classList.remove('hidden'));
  closePickupLineBtn.addEventListener('click', () => pickupLinePopup.classList.add('hidden'));
}

function enterGarden() {
  landingOverlay.classList.add('fade-out');
  setTimeout(() => {
    landingOverlay.classList.add('hidden');
    appContainer.classList.remove('hidden');
    initMap();
    loadMemories(); // from supabase or mock
  }, 1000);
}

// Map Initialization
function initMap() {
  // Initialize map centered on a romantic coordinate or default
  map = L.map('map', {
    zoomControl: false // custom controls later if needed
  }).setView([30.0444, 31.2357], 12); // Default to Cairo since user mentioned Egypt

  // Use CartoDB Dark Matter for a moody, high-end look
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  // Handle map click for admin
  map.on('click', (e) => {
    if (isAdmin) {
      selectedLatLng = e.latlng;
      addMemoryModal.classList.remove('hidden');
    }
  });
}

// Load Memories
async function loadMemories() {
  // Try loading from Supabase
  try {
    const { data, error } = await supabase.from('memories').select('*');
    if (error) throw error;
    
    if (data && data.length > 0) {
      data.forEach(memory => addMarkerToMap(memory));
    }
  } catch (err) {
    console.log("Supabase not fully setup or empty. Using mock data.");
    // Mock Data if Supabase fails (e.g. RLS issues or not configured)
    const mockMemories = [
      { lat: 30.0444, lng: 31.2357, photo: 'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2', date: '2025-01-01', note: 'First day in Cairo', type: 'rose' },
      { lat: 30.0626, lng: 31.2497, photo: 'https://images.unsplash.com/photo-1522228115018-d838bcce5c3a', date: '2025-02-14', note: 'Valentine\'s Coffee', type: 'sunflower' }
    ];
    mockMemories.forEach(memory => addMarkerToMap(memory));
  }
}

// Add Marker
function addMarkerToMap(memory) {
  // Custom Icon
  const svgUrl = flowerIcons[memory.type] || flowerIcons.rose;
  
  // Growth Logic: The more markers in an area, we could scale them up. 
  // For now, standard size 40x40.
  const icon = L.icon({
    iconUrl: svgUrl,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
    className: 'flower-icon'
  });

  const marker = L.marker([memory.lat, memory.lng], { icon }).addTo(map);
  
  // Polaroid Popup
  const popupContent = \`
    <div class="polaroid">
      <img src="\${memory.photo}" alt="Memory" />
      <div class="polaroid-date">\${new Date(memory.date).toLocaleDateString()}</div>
      <div class="polaroid-note">\${memory.note}</div>
    </div>
  \`;
  
  marker.bindPopup(popupContent, { closeButton: false });
  
  // Store for Vine Path
  markers.push({
    marker,
    latlng: [memory.lat, memory.lng],
    date: new Date(memory.date)
  });
}

// Vine Path (Live Growth)
function toggleVinePath() {
  if (vinePath) {
    map.removeLayer(vinePath);
    vinePath = null;
    return;
  }

  // Sort by date
  markers.sort((a, b) => a.date - b.date);
  const latlngs = markers.map(m => m.latlng);

  vinePath = L.polyline(latlngs, {
    color: 'var(--gold)',
    weight: 3,
    opacity: 0.8,
    dashArray: '10, 10',
    lineCap: 'round',
    className: 'vine-path' // could add svg animations here
  }).addTo(map);

  // Animate drawing (basic CSS dashoffset trick)
  const path = vinePath._path;
  const length = path.getTotalLength();
  path.style.transition = path.style.WebkitTransition = 'none';
  path.style.strokeDasharray = length + ' ' + length;
  path.style.strokeDashoffset = length;
  path.getBoundingClientRect(); // trigger layout
  path.style.transition = path.style.WebkitTransition = 'stroke-dashoffset 3s ease-in-out';
  path.style.strokeDashoffset = '0';
}

// Admin Handling
function handleLogin() {
  const pwd = adminPasswordInput.value;
  // Simple check - in production use Supabase Auth
  if (pwd === "bustan") { 
    isAdmin = true;
    adminLoginModal.classList.add('hidden');
    adminAddInfo.classList.remove('hidden');
    map.getContainer().style.cursor = 'crosshair';
  } else {
    alert("Incorrect password");
  }
}

async function handleSaveMemory() {
  if (!selectedLatLng) return;

  saveMemoryBtn.innerText = "Planting...";
  saveMemoryBtn.disabled = true;

  const file = memoryPhotoInput.files[0];
  const date = memoryDateInput.value;
  const note = memoryNoteInput.value;
  const type = memoryFlowerType.value;

  try {
    let photoUrl = "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2"; // Fallback
    
    // Upload image to Supabase if provided
    if (file) {
      const fileName = \`\${Date.now()}-\${file.name}\`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('memories')
        .upload(fileName, file);
        
      if (uploadError) throw uploadError;
      
      const { data: publicUrlData } = supabase.storage
        .from('memories')
        .getPublicUrl(fileName);
        
      photoUrl = publicUrlData.publicUrl;
    }

    const newMemory = {
      lat: selectedLatLng.lat,
      lng: selectedLatLng.lng,
      photo: photoUrl,
      date: date || new Date().toISOString(),
      note: note,
      type: type
    };

    // Save to DB
    const { error: dbError } = await supabase.from('memories').insert([newMemory]);
    if (dbError) throw dbError;

    // Add to map visually
    addMarkerToMap(newMemory);

    // Reset Modal
    addMemoryModal.classList.add('hidden');
    memoryPhotoInput.value = '';
    memoryNoteInput.value = '';
    
  } catch (err) {
    console.error("Error saving memory:", err);
    alert("Failed to plant memory. " + err.message);
  } finally {
    saveMemoryBtn.innerText = "Plant";
    saveMemoryBtn.disabled = false;
  }
}

// Falling Petals Animation
function createPetals() {
  const container = document.getElementById('petal-container');
  const petalCount = 30;

  for (let i = 0; i < petalCount; i++) {
    const petal = document.createElement('div');
    petal.classList.add('petal');
    
    // Randomize
    const size = Math.random() * 15 + 10;
    const left = Math.random() * 100;
    const duration = Math.random() * 10 + 10; // 10-20s
    const delay = Math.random() * 10; // 0-10s
    
    petal.style.width = \`\${size}px\`;
    petal.style.height = \`\${size}px\`;
    petal.style.left = \`\${left}vw\`;
    petal.style.animationDuration = \`\${duration}s\`;
    petal.style.animationDelay = \`\${delay}s\`;
    
    container.appendChild(petal);
  }
}

// Countdown Timer
function startCountdown() {
  setInterval(() => {
    const now = new Date();
    const diff = COUNTDOWN_TARGET - now;
    
    if (diff <= 0) {
      countdownTimer.innerText = "You made it!";
      return;
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const mins = Math.floor((diff / 1000 / 60) % 60);
    const secs = Math.floor((diff / 1000) % 60);
    
    countdownTimer.innerText = \`\${days.toString().padStart(2, '0')}:\${hours.toString().padStart(2, '0')}:\${mins.toString().padStart(2, '0')}:\${secs.toString().padStart(2, '0')}\`;
  }, 1000);
}

// Run init
document.addEventListener('DOMContentLoaded', init);
