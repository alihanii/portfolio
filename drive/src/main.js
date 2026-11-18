import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createPhysics, createVehicle, driveVehicle } from './physics.js';
import { buildCar } from './car.js';
import { createWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createUI, asset } from './ui.js';
import { setAnisotropy } from './textures.js';
import { RESUME } from './content.js';
import { ZONES, SPAWN, ISLAND_RADIUS } from './layout.js';

// ---------- language ----------
function initialLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'fa' || q === 'en') return q;
  try {
    const s = localStorage.getItem('drive-lang');
    if (s === 'fa' || s === 'en') return s;
  } catch {}
  return (navigator.language || '').startsWith('fa') ? 'fa' : 'fa';
}
let lang = initialLang();
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- renderer / scene ----------
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
setAnisotropy(renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
const SKY = new THREE.Color('#8ea7cf');
scene.background = SKY;
scene.fog = new THREE.Fog(SKY, 95, 230);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.5, 600);

scene.add(new THREE.HemisphereLight('#c6d8ff', '#6f7fb0', 1.25));
const sun = new THREE.DirectionalLight('#ffd6b8', 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -34;
sc.right = sc.top = 34;
sc.near = 1;
sc.far = 120;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---------- physics ----------
const { world } = createPhysics();
const vehicle = createVehicle(world, SPAWN);
const car = buildCar();
scene.add(car.group);
car.wheels.forEach((w) => scene.add(w));
const driveState = { steer: 0, speed: 0 };

// ---------- assets ----------
async function loadImages() {
  const out = {};
  const srcs = new Set(RESUME.en.projects.items.map((p) => p.image).filter(Boolean));
  await Promise.all([...srcs].map((src) => new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      out[src] = img;
      res();
    };
    img.onerror = res;
    img.src = asset(src);
  })));
  return out;
}
async function loadFonts() {
  const fonts = ['800 40px "Vazirmatn"', '400 20px "Vazirmatn"', '700 20px "Vazirmatn"', '800 40px "Bricolage Grotesque"', '400 20px "Inter"', '600 20px "Inter"', '700 20px "Inter"'];
  const timeout = new Promise((r) => setTimeout(r, 4000));
  await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f, 'aبc'))), timeout]);
}

const audio = createAudio();
let ui, gameWorld;
let started = false;
const visited = new Set();

function setLang(l, fromUser = false) {
  lang = l;
  try {
    localStorage.setItem('drive-lang', l);
  } catch {}
  try {
    const u = new URL(location.href);
    u.searchParams.set('lang', l);
    history.replaceState(null, '', u);
  } catch {}
  gameWorld?.setLang(l);
  ui?.applyText();
  if (fromUser && started) ui.unlock('polyglot');
}

// ---------- car helpers ----------
function placeCar(x, z, yaw) {
  const b = vehicle.chassisBody;
  b.position.set(x, 1.4, z);
  b.quaternion.setFromEuler(0, yaw, 0);
  b.velocity.setZero();
  b.angularVelocity.setZero();
  b.wakeUp();
}
function resetCar() {
  const p = vehicle.chassisBody.position;
  const v = new CANNON.Vec3();
  vehicle.chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, -1), v);
  const yaw = Math.atan2(-v.x, -v.z);
  if (Math.hypot(p.x, p.z) > ISLAND_RADIUS - 6 || p.y < -2) placeCar(SPAWN.x, SPAWN.z, SPAWN.yaw);
  else placeCar(p.x, p.z, yaw);
}
function teleport(zoneKey) {
  const z = ZONES[zoneKey];
  const d = Math.hypot(z.x, z.z) || 1;
  const k = Math.max(0, (d - z.r + 2) / d);
  const x = z.x * k, zz = z.z * k;
  placeCar(x, zz, Math.atan2(-(z.x - x), -(z.z - zz)));
  if (zoneKey === 'start') placeCar(SPAWN.x, SPAWN.z, SPAWN.yaw);
}

// ---------- input ----------
const input = createInput({
  onAction(a) {
    if (!started) {
      if (a === 'open' && !document.getElementById('start').disabled) start();
      return;
    }
    if (a === 'escape') {
      if (ui.anyOverlay()) ui.toggle('map', false), ui.toggle('menu', false);
      else ui.closePanel();
    }
    if (a === 'map') ui.toggle('map');
    if (a === 'reset') resetCar();
    if (a === 'open' && ui.prompted && !ui.anyOverlay()) ui.openPanel(ui.prompted);
  },
});

// ---------- camera ----------
const camOffset = new THREE.Vector3(7.5, 16, 15);
let zoom = isTouch && innerHeight > innerWidth ? 1.25 : 1;
const camTarget = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
let introBlend = 0; // 0 = cinematic orbit, 1 = follow
addEventListener('wheel', (e) => {
  if (e.target.closest('#panel, .overlay')) return;
  zoom = THREE.MathUtils.clamp(zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.6, 1.7);
}, { passive: true });

function project(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(camera);
  return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- game state for achievements ----------
const stats = { air: 0, airRot: 0, drift: 0, upsideDown: 0, lastTrack: [null, null], knocked: { crate: 0, letter: 0, snowman: 0 } };
vehicle.chassisBody.addEventListener('collide', (e) => {
  const v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  if (v > 2.5) audio.bump(v);
});

function checkDynamics() {
  const up = new CANNON.Vec3();
  for (const d of gameWorld.dynamics) {
    if (d.toppled) continue;
    d.body.quaternion.vmult(new CANNON.Vec3(0, 1, 0), up);
    const moved = d.body.position.distanceTo(d.home);
    const down = d.kind === 'crate' ? moved > 1.2 || up.y < 0.85 : up.y < 0.55;
    if (down) {
      d.toppled = true;
      stats.knocked[d.kind]++;
      if (d.kind === 'letter') ui.unlock('toppled');
      if (d.kind === 'snowman') ui.unlock('snowman');
      if (d.kind === 'crate' && stats.knocked.crate >= 10) ui.unlock('crates');
    }
  }
}

// ---------- main loop ----------
const timer = new THREE.Timer();
timer.connect(document);
const tmpV = new CANNON.Vec3();
const fwd = new THREE.Vector3(), camFwd = new THREE.Vector3(), camRight = new THREE.Vector3();
let checkTimer = 0;
const zero = { throttle: 0, steer: 0, boost: false, brake: false };

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const t = timer.getElapsed();
  const body = vehicle.chassisBody;

  // input
  let inp = zero;
  if (started && !ui.anyOverlay()) {
    inp = { ...input.read() };
    if (inp.stick) {
      // joystick direction is a heading on screen
      camera.getWorldDirection(camFwd);
      camFwd.y = 0;
      camFwd.normalize();
      camRight.set(-camFwd.z, 0, camFwd.x);
      const dx = camRight.x * inp.stick.x - camFwd.x * inp.stick.y;
      const dz = camRight.z * inp.stick.x - camFwd.z * inp.stick.y;
      body.quaternion.vmult(new CANNON.Vec3(0, 0, -1), tmpV);
      const diff = Math.atan2(tmpV.z * dx - tmpV.x * dz, tmpV.x * dx + tmpV.z * dz);
      const mag = Math.min(1, Math.hypot(inp.stick.x, inp.stick.y));
      inp.throttle = Math.abs(diff) > 2.4 && driveState.speed < 2 ? -0.7 : mag;
      inp.steer = THREE.MathUtils.clamp(diff * 2.2, -1, 1) * (inp.throttle < 0 ? -1 : 1);
    }
  }
  driveVehicle(vehicle, inp, driveState);
  world.step(1 / 60, dt, 4);

  // sync car mesh
  car.group.position.copy(body.position);
  car.group.quaternion.copy(body.quaternion);
  vehicle.wheelInfos.forEach((w, i) => {
    vehicle.updateWheelTransform(i);
    car.wheels[i].position.copy(w.worldTransform.position);
    car.wheels[i].quaternion.copy(w.worldTransform.quaternion);
  });
  const braking = inp.brake || (inp.throttle < 0 && driveState.speed > 1);
  car.tail.emissiveIntensity = braking ? 4 : 1.2;
  car.brakeGlow.intensity = braking ? 6 : 0;

  // airtime / flips / drift / tracks
  const contacts = vehicle.wheelInfos.filter((w) => w.isInContact).length;
  const up = body.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
  if (started && contacts === 0 && body.position.y > 1.1) {
    stats.air += dt;
    stats.airRot += Math.hypot(body.angularVelocity.x, body.angularVelocity.z) * dt;
    if (stats.air > 1) ui.unlock('airtime');
  } else {
    if (contacts >= 2) {
      stats.air = 0;
      stats.airRot = 0;
    }
  }
  body.quaternion.vmult(new CANNON.Vec3(0, 0, -1), tmpV);
  const lateral = Math.abs(body.velocity.x * tmpV.z - body.velocity.z * tmpV.x);
  const drifting = contacts >= 3 && Math.abs(driveState.speed) > 6 && lateral > 3.5;
  stats.drift = drifting ? stats.drift + dt : Math.max(0, stats.drift - dt * 2);
  if (stats.drift > 3) ui.unlock('drifter');
  const yaw = Math.atan2(-tmpV.x, -tmpV.z);
  for (const i of [2, 3]) {
    const w = vehicle.wheelInfos[i];
    if (!w.isInContact) {
      stats.lastTrack[i - 2] = null;
      continue;
    }
    const hp = w.raycastResult.hitPointWorld;
    if (hp.y > 0.12) continue;
    const last = stats.lastTrack[i - 2];
    if (!last || Math.hypot(hp.x - last.x, hp.z - last.z) > 0.42) {
      gameWorld.addTrack(hp.x, hp.z, yaw);
      stats.lastTrack[i - 2] = { x: hp.x, z: hp.z };
    }
  }

  if (started && up.y < -0.5) ui.unlock('flip');
  // upside down → auto reset; fell off → respawn
  if (up.y < 0.25 && Math.abs(driveState.speed) < 2) stats.upsideDown += dt;
  else stats.upsideDown = 0;
  if (stats.upsideDown > 2.2) {
    resetCar();
    stats.upsideDown = 0;
  }
  if (body.position.y < -4) placeCar(SPAWN.x, SPAWN.z, SPAWN.yaw);

  // zones + interactions
  if (started) {
    for (const k in ZONES) {
      if (k === 'start') continue;
      if (Math.hypot(body.position.x - ZONES[k].x, body.position.z - ZONES[k].z) < ZONES[k].r && !visited.has(k)) {
        visited.add(k);
        if (visited.size === 5) ui.unlock('explorer');
      }
    }
    let near = null, nd = Infinity;
    for (const it of gameWorld.interactions) {
      const d = Math.hypot(it.x - body.position.x, it.z - body.position.z);
      if (d < it.r && d < nd) {
        nd = d;
        near = it;
      }
    }
    ui.setPrompt(near);
    const open = ui.panelOpen;
    if (open && open.x !== undefined && Math.hypot(open.x - body.position.x, open.z - body.position.z) > 22) ui.closePanel();
    checkTimer += dt;
    if (checkTimer > 0.25) {
      checkTimer = 0;
      checkDynamics();
    }
  }

  // camera
  const look = new THREE.Vector3(body.position.x, 0, body.position.z);
  look.x += THREE.MathUtils.clamp(body.velocity.x * 0.18, -4, 4);
  look.z += THREE.MathUtils.clamp(body.velocity.z * 0.18, -4, 4);
  camTarget.lerp(look, 1 - Math.exp(-5 * dt));
  const followPos = camTarget.clone().add(camOffset.clone().multiplyScalar(zoom));
  if (introBlend < 1) {
    const a = t * (reduceMotion ? 0 : 0.05) + 0.6;
    const orbitPos = new THREE.Vector3(Math.cos(a) * 95, 70, Math.sin(a) * 95);
    const k = introBlend * introBlend * (3 - 2 * introBlend);
    camera.position.lerpVectors(orbitPos, followPos, k);
    const lookAt = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 4), camTarget, k);
    camera.lookAt(lookAt);
    if (started) introBlend = Math.min(1, introBlend + dt / 2.2);
  } else {
    camera.position.copy(followPos);
    camera.lookAt(camTarget);
  }
  sun.position.copy(camTarget).add(new THREE.Vector3(-26, 42, 16));
  sun.target.position.copy(camTarget);

  gameWorld.update(t, dt, camTarget);
  audio.engine(driveState.speed, inp.throttle, inp.boost);

  if (started) {
    ui.updateMarkers(project, body.position, ui.prompted);
    document.getElementById('speed').textContent = Math.round(Math.abs(driveState.speed) * 3.6);
    if (!document.getElementById('map').hidden && Math.floor(t * 10) % 3 === 0) {
      ui.setCar({ x: body.position.x, z: body.position.z, yaw });
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function start() {
  if (started) return;
  started = true;
  document.body.classList.add('playing');
  audio.start();
  document.getElementById('intro').classList.add('gone');
  ui.unlock('ignition');
  setTimeout(() => document.getElementById('scene').focus?.(), 50);
}

// ---------- boot ----------
(async function boot() {
  ui = null;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  const [images] = await Promise.all([loadImages(), loadFonts()]);
  gameWorld = createWorld({ scene, world, images, lang });
  ui = createUI({
    getLang: () => lang,
    interactions: gameWorld.interactions,
    onTeleport: teleport,
    onReset: resetCar,
    onLang: () => setLang(lang === 'fa' ? 'en' : 'fa', true),
    audio,
  });
  ui.setTrees(gameWorld.treeSpots);
  ui.onOpen((it, opened) => {
    if (opened.size >= 3) ui.unlock('reader');
    if (it.panel.type === 'contact-used') ui.unlock('hire');
  });
  ui.applyText();
  const _setCar = ui.setCar;
  // keep map car fresh whenever it opens
  document.getElementById('btn-map').addEventListener('click', () => {
    const b = vehicle.chassisBody;
    const v = b.quaternion.vmult(new CANNON.Vec3(0, 0, -1));
    _setCar({ x: b.position.x, z: b.position.z, yaw: Math.atan2(-v.x, -v.z) });
  }, { capture: true });
  // settle physics before showing
  for (let i = 0; i < 90; i++) world.step(1 / 60);
  requestAnimationFrame(frame);
  const btn = document.getElementById('start');
  btn.disabled = false;
  ui.applyText();
  btn.addEventListener('click', start);
  btn.focus();
  if (new URLSearchParams(location.search).has('autostart')) start();
  if (new URLSearchParams(location.search).has('debug')) window.__drive = {
    teleport, placeCar, ui, vehicle,
    goto: (id) => {
      const it = gameWorld.interactions.find((x) => x.id === id);
      placeCar(it.x, it.z + 0.5, 0);
    },
  };
})();
