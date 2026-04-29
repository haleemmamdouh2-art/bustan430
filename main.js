import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// =============================================
// STATE
// =============================================
let scene, camera, renderer, controls, clock, composer;
let flowers = [];
let isAdminUnlocked = false;
let memories = [];
let musicPlaying = false;

const ADMIN_PASSWORD = 'bustan';

const FLOWER_TYPES = ['rose', 'tulip', 'sunflower', 'lily', 'daisy'];

// Time of day palette
const TIME_PALETTES = {
  night:   { sky: 0x0a0f2e, fog: 0x0d1535, ambient: 0x4060a0, sun: 0x6080c0, sunIntensity: 0.8, fogDensity: 0.012 },
  dawn:    { sky: 0x2a0f3e, fog: 0x4d2c4a, ambient: 0x9a6080, sun: 0xff8844, sunIntensity: 1.0, fogDensity: 0.012 },
  morning: { sky: 0x87ceeb, fog: 0xb0d8ef, ambient: 0xd4e8f5, sun: 0xfff5cc, sunIntensity: 1.5, fogDensity: 0.009 },
  noon:    { sky: 0x4dc8ff, fog: 0x9be0ff, ambient: 0xe8f4ff, sun: 0xffffff, sunIntensity: 1.8, fogDensity: 0.007 },
  evening: { sky: 0xff6633, fog: 0xff9966, ambient: 0xffb080, sun: 0xff4400, sunIntensity: 1.3, fogDensity: 0.010 },
  dusk:    { sky: 0x2a0846, fog: 0x4d1e66, ambient: 0x8040a0, sun: 0xff2288, sunIntensity: 0.9, fogDensity: 0.014 },
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
  const h = new Date().getHours();
  const isNight = h >= 20 || h < 7;

  // Renderer — cinematic quality
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = isNight ? 0.9 : 1.3;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(palette.sky);
  scene.fog = new THREE.FogExp2(palette.fog, palette.fogDensity * 0.6); // lighter fog

  // Sky sphere with gradient
  createSkySphere(palette);

  // Camera — cinematic low angle looking INTO the garden
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.position.set(0, 2.2, 11);
  camera.lookAt(0, 1.5, -2);

  // Controls
  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2;
  controls.maxDistance = 22;
  controls.minPolarAngle = 0.1;          // can't look straight up
  controls.maxPolarAngle = Math.PI / 2.5; // can't look straight down
  controls.target.set(0, 1, -2);
  controls.enablePan = false;

  // ---- LIGHTING ----
  // Hemisphere (sky / ground colour)
  const hemi = new THREE.HemisphereLight(
    isNight ? 0x223366 : 0xc8e8ff,
    isNight ? 0x0a1a06 : 0x3a6b20,
    isNight ? 0.7 : 1.0
  );
  scene.add(hemi);

  // Main directional (sun / moon)
  const sun = new THREE.DirectionalLight(palette.sun, palette.sunIntensity);
  sun.position.set(isNight ? -8 : 12, isNight ? 20 : 18, isNight ? 10 : 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
  sun.shadow.camera.top  =  25; sun.shadow.camera.bottom = -25;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  // Warm pink/rose rim for drama (flowers / edges)
  const rim = new THREE.PointLight(isNight ? 0x4466ff : 0xff88aa, isNight ? 1.0 : 1.8, 35);
  rim.position.set(-10, 7, -8);
  scene.add(rim);

  // Soft fill from front
  const fill = new THREE.DirectionalLight(isNight ? 0x223355 : 0xfff0e0, isNight ? 0.3 : 0.5);
  fill.position.set(0, 5, 15);
  scene.add(fill);

  // Stars at night
  if (isNight) createStars();

  // World objects
  createGround();
  createTrees();
  createParticles();

  // ---- BLOOM POST-PROCESSING ----
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    isNight ? 0.6 : 0.3,  // strength
    0.5,                   // radius
    isNight ? 0.7 : 0.85  // threshold
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  });
}

// =============================================
// SKY SPHERE
// =============================================
function createSkySphere(palette) {
  const skyGeo = new THREE.SphereGeometry(140, 24, 12);
  // Vertex colors for gradient
  const colors = [];
  const top = new THREE.Color(palette.sky);
  const horizon = new THREE.Color(palette.fog);
  const pos = skyGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.max(0, Math.min(1, (y + 80) / 160));
    const c = horizon.clone().lerp(top, t);
    colors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// =============================================
// STARS (for night)
// =============================================
function createStars() {
  const geo = new THREE.BufferGeometry();
  const count = 800;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 80 + Math.random() * 20;
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = Math.abs(r * Math.cos(phi)) + 5; // keep above horizon
    pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.85 });
  scene.add(new THREE.Points(geo, mat));
}

// =============================================
// GROUND — canvas texture for photorealistic grass
// =============================================
function makeGrassTexture() {
  const size = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  // Base gradient
  const grd = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size*0.7);
  grd.addColorStop(0,   '#4a9e42');
  grd.addColorStop(0.5, '#3a8a36');
  grd.addColorStop(1,   '#2d6e2a');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, size, size);
  // Blade noise
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const l = Math.random() * 8 + 2;
    const g = Math.floor(Math.random() * 60 + 100);
    ctx.strokeStyle = `rgba(${Math.floor(g*0.4)},${g},${Math.floor(g*0.3)},0.35)`;
    ctx.lineWidth = Math.random() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random()-0.5)*3, y - l);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(12, 12);
  return tex;
}

function createGround() {
  // MeshBasicMaterial — ALWAYS visible, no lighting dependency
  const tex = makeGrassTexture();
  const geo = new THREE.PlaneGeometry(120, 120, 40, 40);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, Math.sin(x*0.18)*0.18 + Math.cos(z*0.22)*0.14);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ map: tex });
  const ground = new THREE.Mesh(geo, mat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Stone path
  const pathMat = new THREE.MeshBasicMaterial({ color: 0xb8a888 });
  for (let i = -3; i <= 3; i++) {
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(1.5 + Math.random()*0.2, 0.07, 0.75 + Math.random()*0.15),
      pathMat
    );
    stone.position.set((Math.random()-0.5)*0.3, 0.04, i * 1.1 + 1);
    stone.rotation.y = (Math.random()-0.5)*0.2;
    scene.add(stone);
  }

  // Grass tufts — clusters of thin blades
  const bladeMat = new THREE.MeshBasicMaterial({ color: 0x3a7a2a, side: THREE.DoubleSide });
  const darkBlade = new THREE.MeshBasicMaterial({ color: 0x2a5a1a, side: THREE.DoubleSide });
  for (let t = 0; t < 200; t++) {
    const gx = (Math.random()-0.5) * 40;
    const gz = (Math.random()-0.5) * 40;
    // Skip path area
    if (Math.abs(gx) < 1.2 && gz > -1 && gz < 8) continue;
    const clusterGrp = new THREE.Group();
    const bladeCount = 4 + Math.floor(Math.random() * 4);
    for (let b = 0; b < bladeCount; b++) {
      const h = 0.18 + Math.random() * 0.22;
      const bladeGeo = new THREE.PlaneGeometry(0.06, h);
      const blade = new THREE.Mesh(bladeGeo, Math.random() > 0.4 ? bladeMat : darkBlade);
      blade.position.set((Math.random()-0.5)*0.2, h*0.5, (Math.random()-0.5)*0.2);
      blade.rotation.y = Math.random() * Math.PI;
      blade.rotation.z = (Math.random()-0.5) * 0.4;
      clusterGrp.add(blade);
    }
    clusterGrp.position.set(gx, 0.01, gz);
    scene.add(clusterGrp);
  }
}



// =============================================
// TREES — realistic layered cones with PBR
// =============================================
function createTrees() {
  const positions = [
    [-9,0,-4],[9,0,-3],[-6,0,-9],[10,0,-8],[-13,0,1],
    [12,0,2],[-8,0,7],[10,0,6],[1,0,-13],[-5,0,-11],[6,0,-10],
    [-15,0,-6],[14,0,-5],[-11,0,10],[13,0,9]
  ];
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2c0a, roughness: 0.95, metalness: 0 });
  const leafColors = [0x2d6b22, 0x367a28, 0x245c1c, 0x3a8030, 0x1e5018];

  positions.forEach(([x,,z]) => {
    const grp = new THREE.Group();
    const h = 4.5 + Math.random() * 3.5;

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.22, h * 0.38, 8),
      trunkMat
    );
    trunk.position.y = h * 0.19;
    trunk.castShadow = true;
    grp.add(trunk);

    // 4 foliage layers — each slightly offset and rotated
    for (let j = 0; j < 4; j++) {
      const lc = leafColors[Math.floor(Math.random() * leafColors.length)];
      const leafMat = new THREE.MeshStandardMaterial({
        color: lc, roughness: 0.88, metalness: 0,
        emissive: new THREE.Color(lc).multiplyScalar(0.08)
      });
      const radius = 1.6 - j * 0.28;
      const coneH  = h * 0.42;
      const cone   = new THREE.Mesh(new THREE.ConeGeometry(radius, coneH, 9), leafMat);
      cone.position.y = h * 0.35 + j * (h * 0.18);
      cone.rotation.y = j * 0.7;
      cone.castShadow = true;
      grp.add(cone);
    }

    grp.position.set(x, 0, z);
    grp.scale.setScalar(0.85 + Math.random() * 0.35);
    grp.rotation.y = Math.random() * Math.PI * 2;
    scene.add(grp);
  });
}


// =============================================
// PARTICLES — just a few dim fireflies near ground
// =============================================
function createParticles() {
  const geo = new THREE.BufferGeometry();
  const count = 50;  // way fewer
  const pos = new Float32Array(count * 3);
  const isNight = new Date().getHours() >= 20 || new Date().getHours() < 7;
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-0.5) * 28;
    pos[i*3+1] = 0.1 + Math.random() * 1.8; // stay close to ground
    pos[i*3+2] = (Math.random()-0.5) * 28;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: isNight ? 0x88ffcc : 0xffee88,
    size: 0.07,
    transparent: true,
    opacity: 0.35,  // much dimmer
    sizeAttenuation: true
  });
  const pts = new THREE.Points(geo, mat);
  pts.name = 'particles';
  scene.add(pts);
}



// =============================================
// FLOWER HEAD — canvas sprite so it looks REAL
// =============================================
function makeFlowerSprite(type) {
  const configs = {
    rose:      { petalColor: '#e8526a', centerColor: '#7a1030', petalCount: 12, petalLen: 0.42 },
    tulip:     { petalColor: '#ff6090', centerColor: '#cc0040', petalCount: 6,  petalLen: 0.55 },
    sunflower: { petalColor: '#ffcc00', centerColor: '#5a3000', petalCount: 16, petalLen: 0.38 },
    lily:      { petalColor: '#cc88ff', centerColor: '#ffe8aa', petalCount: 6,  petalLen: 0.50 },
    daisy:     { petalColor: '#f0f0f0', centerColor: '#ffee00', petalCount: 14, petalLen: 0.36 },
  };
  const cfg = configs[type] || configs.daisy;

  const size = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const pr = size * 0.18; // petal distance from center
  const pl = size * cfg.petalLen; // petal length

  // Draw petals
  for (let i = 0; i < cfg.petalCount; i++) {
    const a = (i / cfg.petalCount) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    const grad = ctx.createRadialGradient(0, -pr, 0, 0, -pr - pl*0.5, pl*0.6);
    grad.addColorStop(0, cfg.petalColor);
    grad.addColorStop(1, cfg.petalColor + '44');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, -(pr + pl*0.5), size*0.072, pl*0.5, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // Center
  const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size*0.14);
  cGrad.addColorStop(0, '#ffffff88');
  cGrad.addColorStop(0.3, cfg.centerColor);
  cGrad.addColorStop(1, cfg.centerColor + 'aa');
  ctx.fillStyle = cGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, size*0.13, 0, Math.PI*2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cv);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.1, 1.1, 1);
  return sprite;
}

function makeFlower(type) {
  const group = new THREE.Group();

  const resolvedType = (type === 'random' || !type)
    ? FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)] : type;

  // Stem
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x2d6b1a });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.4, 6), stemMat);
  stem.position.y = 0.7;
  group.add(stem);

  // Leaf — flat plane angled off stem
  const leafMat = new THREE.MeshBasicMaterial({ color: 0x3a8020, side: THREE.DoubleSide });
  const leafGeo = new THREE.PlaneGeometry(0.35, 0.18);
  const leaf = new THREE.Mesh(leafGeo, leafMat);
  leaf.position.set(0.22, 0.55, 0);
  leaf.rotation.set(0.2, 0, 0.5);
  group.add(leaf);

  // Flower head — canvas sprite
  const sprite = makeFlowerSprite(resolvedType);
  sprite.position.y = 1.45;
  group.add(sprite);

  group.userData.swayOffset = Math.random() * Math.PI * 2;
  group.userData.flowerType = resolvedType;
  return group;
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
    if (error) {
      // Schema not migrated yet — garden still shows, just empty
      console.warn('DB schema needs migration. Run: ALTER TABLE public.memories DROP COLUMN IF EXISTS location_id;');
      document.getElementById('flower-count').textContent = '0';
      return;
    }
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
    if (upErr) throw new Error('Upload failed: ' + upErr.message);

    const { data: urlData } = window.supabaseDb.storage.from('memories').getPublicUrl(fileName);
    const resolved = (ftype === 'random') ? FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)] : ftype;

    const { error: dbErr } = await window.supabaseDb.from('memories').insert([{
      photo: urlData.publicUrl,
      date,
      note,
      flower_type: resolved
    }]);

    if (dbErr) {
      // Most likely cause: old schema still has location_id NOT NULL
      if (dbErr.message && dbErr.message.includes('location_id')) {
        btnTxt.textContent = '⚠️ Run SQL migration first!';
        setTimeout(() => { btnTxt.textContent = 'Plant this Memory 🌱'; btn.disabled = false; }, 3000);
        showAdminError('Your database needs a migration. Go to Supabase → SQL Editor and run:\n\nALTER TABLE public.memories DROP COLUMN IF EXISTS location_id;');
        return;
      }
      throw new Error(dbErr.message);
    }

    // Reset form
    document.getElementById('photo-input').value = '';
    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('photo-placeholder').classList.remove('hidden');
    document.getElementById('plant-note').value = '';

    await loadMemories();
    renderAdminMemoryList();
    btnTxt.textContent = 'Planted! 🌸';
    setTimeout(() => { btnTxt.textContent = 'Plant this Memory 🌱'; }, 2000);
  } catch (e) { 
    showAdminError('Error: ' + e.message);
  } finally { 
    btn.disabled = false;
  }
}

function showAdminError(msg) {
  let errEl = document.getElementById('admin-plant-err');
  if (!errEl) {
    errEl = document.createElement('div');
    errEl.id = 'admin-plant-err';
    errEl.style.cssText = 'background:rgba(255,80,80,0.15);border:1px solid #ff6b6b;border-radius:10px;padding:0.8rem;color:#ff9999;font-size:0.8rem;white-space:pre-wrap;margin-top:0.5rem;line-height:1.5;';
    document.getElementById('admin-plant-form').appendChild(errEl);
  }
  errEl.textContent = msg;
  errEl.style.display = 'block';
  setTimeout(() => { errEl.style.display = 'none'; }, 12000);
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
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Sway flowers
  flowers.forEach(f => {
    const offset = f.userData.swayOffset || 0;
    f.rotation.z = Math.sin(elapsed * 0.8 + offset) * 0.05;
    f.rotation.x = Math.cos(elapsed * 0.5 + offset) * 0.03;
  });

  // Float particles gently upward and drift
  const pts = scene.getObjectByName('particles');
  if (pts) {
    pts.rotation.y = elapsed * 0.015;
    const posArr = pts.geometry.attributes.position.array;
    for (let i = 1; i < posArr.length; i += 3) {
      posArr[i] += 0.003;
      if (posArr[i] > 7) posArr[i] = 0.2;
    }
    pts.geometry.attributes.position.needsUpdate = true;
  }

  controls.update();
  // Use composer for bloom; fallback to renderer if composer not ready
  if (composer) composer.render();
  else renderer.render(scene, camera);
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
