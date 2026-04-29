import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================
// STATE
// =============================================
let scene, camera, renderer, controls, clock;
let flowers = [];          // { mesh, memoryId, data }
let hoveredFlower = null;
let isAdminUnlocked = false;
let memories = [];
let animFrame;
let musicPlaying = false;

const ADMIN_PASSWORD = 'bustan';

const FLOWER_TYPES = ['rose', 'tulip', 'sunflower', 'lily', 'daisy'];

// Time of day palette
const TIME_PALETTES = {
  night:   { sky: 0x050820, fog: 0x080d1a, ambient: 0x1a2040, sun: 0x2040a0, sunIntensity: 0.3, fogDensity: 0.018 },
  dawn:    { sky: 0x1a0a2e, fog: 0x3d1c3a, ambient: 0x7a4560, sun: 0xff8844, sunIntensity: 0.8, fogDensity: 0.014 },
  morning: { sky: 0x87ceeb, fog: 0xb0d8ef, ambient: 0xd4e8f5, sun: 0xfff5cc, sunIntensity: 1.4, fogDensity: 0.010 },
  noon:    { sky: 0x4dc8ff, fog: 0x9be0ff, ambient: 0xe8f4ff, sun: 0xffffff, sunIntensity: 1.8, fogDensity: 0.008 },
  evening: { sky: 0xff6633, fog: 0xff9966, ambient: 0xffb080, sun: 0xff4400, sunIntensity: 1.2, fogDensity: 0.012 },
  dusk:    { sky: 0x1a0536, fog: 0x3d1456, ambient: 0x5a2060, sun: 0xff2288, sunIntensity: 0.6, fogDensity: 0.016 },
};

function getTimePalette() {
  const h = new Date().getHours();
  if (h >= 22 || h < 5)  return TIME_PALETTES.night;
  if (h >= 5  && h < 7)  return TIME_PALETTES.dawn;
  if (h >= 7  && h < 10) return TIME_PALETTES.morning;
  if (h >= 10 && h < 16) return TIME_PALETTES.noon;
  if (h >= 16 && h < 19) return TIME_PALETTES.evening;
  return TIME_PALETTES.dusk;
}

function getTimeLabel() {
  const h = new Date().getHours();
  if (h >= 22 || h < 5)  return ['🌙', 'Night'];
  if (h >= 5  && h < 7)  return ['🌅', 'Dawn'];
  if (h >= 7  && h < 10) return ['🌤️', 'Morning'];
  if (h >= 10 && h < 16) return ['☀️', 'Daytime'];
  if (h >= 16 && h < 19) return ['🌇', 'Evening'];
  return ['🌆', 'Dusk'];
}

// =============================================
// THREE.JS SCENE SETUP
// =============================================
function initScene() {
  clock = new THREE.Clock();
  const canvas = document.getElementById('garden-canvas');
  const palette = getTimePalette();

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.FogExp2(palette.fog, palette.fogDensity);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 6, 18);
  camera.lookAt(0, 0, 0);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 5;
  controls.maxDistance = 40;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.target.set(0, 0, 0);
  controls.enablePan = false;

  // Lighting
  const ambientLight = new THREE.AmbientLight(palette.ambient, 0.8);
  ambientLight.name = 'ambient';
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(palette.sun, palette.sunIntensity);
  sunLight.name = 'sun';
  sunLight.position.set(10, 20, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 80;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  scene.add(sunLight);

  // Ground
  createGround(palette);

  // Ambient particles
  createParticles(palette);

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// =============================================
// GROUND
// =============================================
function createGround(palette) {
  // Main grass plane
  const grassGeo = new THREE.PlaneGeometry(80, 80, 60, 60);
  const positions = grassGeo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = Math.sin(x * 0.3) * 0.15 + Math.cos(z * 0.4) * 0.12 + (Math.random() - 0.5) * 0.08;
    positions.setY(i, y);
  }
  grassGeo.computeVertexNormals();

  const grassMat = new THREE.MeshLambertMaterial({ color: 0x2d6a2d });
  const ground = new THREE.Mesh(grassGeo, grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Path
  const pathGeo = new THREE.PlaneGeometry(2.5, 30);
  const pathMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.01, 5);
  scene.add(path);

  // Rocks
  for (let i = 0; i < 8; i++) {
    const r = Math.random() * 0.3 + 0.1;
    const rGeo = new THREE.DodecahedronGeometry(r, 0);
    const rMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const rock = new THREE.Mesh(rGeo, rMat);
    rock.position.set(
      (Math.random() - 0.5) * 18,
      r * 0.5,
      (Math.random() - 0.5) * 18
    );
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }
}

// =============================================
// AMBIENT PARTICLES
// =============================================
function createParticles(palette) {
  const pGeo = new THREE.BufferGeometry();
  const count = 200;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 40;
    pos[i*3+1] = Math.random() * 10;
    pos[i*3+2] = (Math.random() - 0.5) * 40;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xffd700, size: 0.06, transparent: true, opacity: 0.55 });
  const points = new THREE.Points(pGeo, pMat);
  points.name = 'particles';
  scene.add(points);
}

// =============================================
// FLOWER BUILDING
// =============================================
function makeFlower(type) {
  const group = new THREE.Group();

  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 1.2, 7);
  const stemMat = new THREE.MeshLambertMaterial({ color: 0x2d5a1b });
  const stem = new THREE.Mesh(stemGeo, stemMat);
  stem.position.y = 0.6;
  stem.castShadow = true;
  group.add(stem);

  // Leaf
  const leafGeo = new THREE.SphereGeometry(0.18, 6, 4);
  leafGeo.scale(1, 0.25, 0.5);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3a7a20 });
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.set(0.18, 0.5, 0);
  leaf.rotation.z = 0.3;
  group.add(leaf);

  // Head (varies by type)
  const resolvedType = (type === 'random' || !type)
    ? FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)]
    : type;

  const head = buildFlowerHead(resolvedType);
  head.position.y = 1.25;
  head.castShadow = true;
  group.add(head);

  // Glow highlight
  const glowGeo = new THREE.SphereGeometry(0.3, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: head.children[0]?.material?.color || new THREE.Color(0xffaacc),
    transparent: true, opacity: 0.12
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.y = 1.25;
  group.add(glow);

  group.userData.baseY = group.position.y;
  group.userData.swayOffset = Math.random() * Math.PI * 2;
  return group;
}

function buildFlowerHead(type) {
  const head = new THREE.Group();

  const configs = {
    rose:      { color: 0xe8637a, petalCount: 12, centerColor: 0xcc2244 },
    tulip:     { color: 0xff6699, petalCount: 6,  centerColor: 0xcc0044 },
    sunflower: { color: 0xffcc00, petalCount: 16, centerColor: 0x6b3a00 },
    lily:      { color: 0xcc88ff, petalCount: 6,  centerColor: 0xffeecc },
    daisy:     { color: 0xffffff, petalCount: 14, centerColor: 0xffee00 },
  };
  const cfg = configs[type] || configs.daisy;

  // Center disk
  const diskGeo = new THREE.SphereGeometry(0.15, 10, 8);
  diskGeo.scale(1, 0.5, 1);
  const diskMat = new THREE.MeshLambertMaterial({ color: cfg.centerColor });
  head.add(new THREE.Mesh(diskGeo, diskMat));

  // Petals
  const petalMat = new THREE.MeshLambertMaterial({ color: cfg.color, side: THREE.DoubleSide });
  for (let i = 0; i < cfg.petalCount; i++) {
    const angle = (i / cfg.petalCount) * Math.PI * 2;
    const petalGeo = (type === 'tulip')
      ? new THREE.ConeGeometry(0.12, 0.35, 6)
      : new THREE.SphereGeometry(0.12, 6, 4);
    if (type !== 'tulip') petalGeo.scale(0.6, 0.3, 1);
    const petal = new THREE.Mesh(petalGeo, petalMat);
    const dist = type === 'tulip' ? 0.15 : 0.22;
    petal.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    petal.rotation.set(type === 'tulip' ? -0.4 : -Math.PI / 2.5, angle, 0);
    head.add(petal);
  }
  return head;
}

function placeFlower(memory) {
  const type = memory.flower_type || 'random';
  const flower = makeFlower(type);

  // Position based on id hash for determinism
  const seed = [...(memory.id || 'x')].reduce((a, c) => a + c.charCodeAt(0), 0);
  const angle = seed * 2.4;
  const radius = 3 + (seed % 11);
  flower.position.set(
    Math.cos(angle) * radius,
    0,
    Math.sin(angle) * radius
  );
  flower.scale.setScalar(0.85 + Math.random() * 0.3);
  flower.userData.memoryId = memory.id;
  flower.userData.memoryData = memory;

  scene.add(flower);
  flowers.push(flower);
}

// =============================================
// RAYCASTING — CLICK/TAP FLOWERS
// =============================================
const raycaster = new THREE.Raycaster();
const pointer   = new THREE.Vector2();

function onPointerDown(e) {
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const y = e.touches ? e.touches[0].clientY : e.clientY;
  pointer.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);

  raycaster.setFromCamera(pointer, camera);
  const allMeshes = [];
  flowers.forEach(f => f.traverse(c => { if (c.isMesh) allMeshes.push(c); }));
  const hits = raycaster.intersectObjects(allMeshes, false);

  if (hits.length) {
    let obj = hits[0].object;
    while (obj.parent && !obj.userData.memoryId) obj = obj.parent;
    if (obj.userData.memoryId) openMemoryCard(obj.userData.memoryData);
  }
}

// =============================================
// MEMORY CARD
// =============================================
function openMemoryCard(data) {
  document.getElementById('memory-overlay').classList.remove('hidden');
  document.getElementById('memory-overlay').classList.add('active');
  document.getElementById('memory-photo-img').src = data.photo;
  document.getElementById('memory-date-text').textContent =
    new Date(data.date).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('memory-note-text').textContent = data.note || '';
}

function closeMemoryCard() {
  const ov = document.getElementById('memory-overlay');
  ov.classList.remove('active');
  setTimeout(() => ov.classList.add('hidden'), 500);
}

// =============================================
// LOAD MEMORIES FROM SUPABASE
// =============================================
async function loadMemories() {
  try {
    const { data, error } = await window.supabaseDb.from('memories').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    memories = data || [];
    flowers.forEach(f => scene.remove(f));
    flowers = [];
    memories.forEach(placeFlower);
    document.getElementById('flower-count').textContent = memories.length;
  } catch (e) { console.error('loadMemories:', e); }
}

// =============================================
// ADMIN — PLANT MEMORY
// =============================================
async function plantMemory() {
  const file   = document.getElementById('photo-input').files[0];
  const note   = document.getElementById('plant-note').value.trim();
  const date   = document.getElementById('plant-date').value || new Date().toISOString().slice(0, 10);
  const ftype  = document.getElementById('plant-flower').value;
  const btn    = document.getElementById('plant-btn');
  const btnTxt = document.getElementById('plant-btn-text');

  if (!file) { alert('Please select a photo first.'); return; }
  btn.disabled = true; btnTxt.textContent = 'Planting... 🌱';

  try {
    const ext = file.name.split('.').pop();
    const fileName = `mem_${Date.now()}.${ext}`;
    const { error: upErr } = await window.supabaseDb.storage.from('memories').upload(fileName, file, { upsert: true });
    if (upErr) throw upErr;

    const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);

    const resolved = (ftype === 'random') ? FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)] : ftype;
    const { error: dbErr } = await window.supabaseDb.from('memories').insert([{
      photo: urlData.publicUrl,
      date,
      note,
      flower_type: resolved,
      // location_id required by schema — use null or a placeholder UUID
      location_id: null
    }]);
    if (dbErr) throw dbErr;

    // Reset form
    document.getElementById('photo-input').value = '';
    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('photo-placeholder').classList.remove('hidden');
    document.getElementById('plant-note').value = '';

    await loadMemories();
    renderAdminMemoryList();
    alert('Memory planted! 🌸');
  } catch (e) { alert('Error: ' + e.message); }
  finally { btn.disabled = false; btnTxt.textContent = 'Plant this Memory 🌱'; }
}

async function deleteMemory(id) {
  if (!confirm('Remove this memory?')) return;
  try {
    await window.supabaseDb.from('memories').delete().eq('id', id);
    await loadMemories();
    renderAdminMemoryList();
  } catch (e) { alert('Error: ' + e.message); }
}

function renderAdminMemoryList() {
  const list = document.getElementById('admin-memory-list');
  list.innerHTML = '';
  if (!memories.length) {
    list.innerHTML = '<p style="color:rgba(255,255,255,0.3);font-size:0.8rem;">No memories yet.</p>';
    return;
  }
  memories.forEach(m => {
    const row = document.createElement('div');
    row.className = 'admin-mem-row';
    row.innerHTML = `<span>${new Date(m.date).toLocaleDateString()} — ${m.note?.slice(0,30) || 'No note'}</span><button class="del-btn" data-id="${m.id}">Delete</button>`;
    row.querySelector('.del-btn').addEventListener('click', () => deleteMemory(m.id));
    list.appendChild(row);
  });
}

// =============================================
// MUSIC PLAYER
// =============================================
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

// =============================================
// HUD TIME BADGE
// =============================================
function updateTimeBadge() {
  const [icon, label] = getTimeLabel();
  document.getElementById('time-icon').textContent = icon;
  document.getElementById('time-label').textContent = label;
}

// =============================================
// LANDING PARTICLES
// =============================================
function createLandingParticles() {
  const c = document.getElementById('landing-particles');
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.classList.add('particle');
    const size = Math.random() * 3 + 1;
    p.style.cssText = `
      width:${size}px; height:${size}px;
      left:${Math.random()*100}%;
      bottom:-10px;
      animation-duration:${8 + Math.random()*10}s;
      animation-delay:${Math.random()*10}s;
      opacity:0;
    `;
    c.appendChild(p);
  }
}

// =============================================
// ANIMATION LOOP
// =============================================
function animate() {
  animFrame = requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Sway flowers
  flowers.forEach(f => {
    const offset = f.userData.swayOffset || 0;
    f.rotation.z = Math.sin(elapsed * 0.8 + offset) * 0.04;
    f.rotation.x = Math.cos(elapsed * 0.6 + offset) * 0.025;
  });

  // Drift particles
  const pts = scene.getObjectByName('particles');
  if (pts) pts.rotation.y = elapsed * 0.02;

  controls.update();
  renderer.render(scene, camera);
}

// =============================================
// ENTER GARDEN
// =============================================
async function enterGarden() {
  const landing = document.getElementById('landing');
  const loading = document.getElementById('loading-screen');
  const hud     = document.getElementById('hud');

  // Show loading
  landing.classList.remove('active');
  landing.classList.add('hidden');
  loading.classList.remove('hidden');
  loading.classList.add('active');

  // Init 3D
  initScene();
  animate();

  // Load data
  await loadMemories();

  // Hide loading, show HUD
  setTimeout(() => {
    loading.classList.remove('active');
    setTimeout(() => {
      loading.classList.add('hidden');
      hud.classList.remove('hidden');
      updateTimeBadge();
      // Fade hint out after 4s
      setTimeout(() => {
        const hint = document.getElementById('hint-text');
        hint.style.transition = 'opacity 1s';
        hint.style.opacity = '0';
      }, 4000);
    }, 600);
  }, 1200);

  // Click/tap
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
}

// =============================================
// INIT
// =============================================
function init() {
  createLandingParticles();

  // Enter button
  document.getElementById('enter-btn').addEventListener('click', enterGarden);

  // Memory card close
  document.getElementById('memory-close-btn').addEventListener('click', closeMemoryCard);
  document.getElementById('memory-backdrop').addEventListener('click', closeMemoryCard);

  // Admin open/close
  document.getElementById('admin-btn').addEventListener('click', () => {
    document.getElementById('admin-overlay').classList.remove('hidden');
    document.getElementById('admin-overlay').classList.add('active');
  });
  document.getElementById('admin-close-btn').addEventListener('click', () => {
    const ov = document.getElementById('admin-overlay');
    ov.classList.remove('active');
    setTimeout(() => ov.classList.add('hidden'), 400);
  });

  // Admin login
  document.getElementById('admin-login-btn').addEventListener('click', () => {
    const pw = document.getElementById('admin-pass-input').value;
    if (pw === ADMIN_PASSWORD) {
      isAdminUnlocked = true;
      document.getElementById('admin-login-form').classList.add('hidden');
      document.getElementById('admin-plant-form').classList.remove('hidden');
      renderAdminMemoryList();
    } else {
      document.getElementById('admin-err').classList.remove('hidden');
    }
  });
  document.getElementById('admin-pass-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
  });

  // Photo upload
  const zone = document.getElementById('photo-drop-zone');
  const photoInput = document.getElementById('photo-input');
  zone.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const prev = document.getElementById('photo-preview');
    prev.src = url;
    prev.classList.remove('hidden');
    document.getElementById('photo-placeholder').classList.add('hidden');
  });

  // Plant button
  document.getElementById('plant-btn').addEventListener('click', plantMemory);

  // Music
  document.getElementById('music-toggle').addEventListener('click', toggleMusic);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
