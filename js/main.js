import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as C from './config.js';
import { createWorld, bendX, bendY } from './world.js';
import { createTrack } from './track.js';
import { createShip } from './player.js';
import { createFX, glowTexture } from './fx.js';
import { initAudio, setMuted, isMuted, setOverdrive, sfx } from './audio.js';

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);
const dom = {
  score: $('score'), mult: $('mult'), streak: $('streak'), best: $('best'),
  zone: $('zone'), speed: $('speed'), meter: $('meter'), meterFill: $('meter-fill'),
  title: $('title'), over: $('over'), overScore: $('over-score'), overBest: $('over-best'),
  overNew: $('over-new'), flash: $('flash'), sound: $('sound'),
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const setText = (node, s) => { if (node.textContent !== s) node.textContent = s; };
function loadBest() {
  try { return Number(localStorage.getItem('neonDriftBest')) || 0; } catch (_) { return 0; }
}
function saveBest(v) {
  try { localStorage.setItem('neonDriftBest', String(v)); } catch (_) { /* private mode: keep it in memory only */ }
}

// ---------- renderer, scene, camera, post-processing ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
$('stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pal0 = C.PALETTES[0];
scene.background = new THREE.Color(pal0.bg);
scene.fog = new THREE.FogExp2(pal0.fog, 0.0068);

const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.1, 700);
const cam = { x: 0, y: 3 }; // smoothed camera position (shake is added on top)

scene.add(new THREE.HemisphereLight(0xb8a2ff, 0x1a0630, 1.1));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
keyLight.position.set(3, 12, -8);
scene.add(keyLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.75, 0.5, 0.15);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------- shared materials and game parts ----------
const glowTex = glowTexture();
const mats = {
  edge: new THREE.LineBasicMaterial({ color: pal0.a, toneMapped: false }),
  wall: new THREE.MeshStandardMaterial({ color: 0x1c0d36, roughness: 0.4, metalness: 0.25, emissive: 0x2e0f5c, emissiveIntensity: 1 }),
  orbCore: new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  orbGlow: new THREE.SpriteMaterial({ map: glowTex, color: pal0.b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  gold: new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }),
  goldGlow: new THREE.SpriteMaterial({ map: glowTex, color: 0xffb000, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
};
const world = createWorld(scene);
const track = createTrack(scene, mats);
const fx = createFX(scene, camera);
const ship = createShip(scene, glowTex);

// ---------- game state ----------
// mode: title -> play -> dying -> over -> play ...
const S = {
  mode: 'title',
  t: 0, z: 0, zStart: 0,
  sx: 0, sy: 0, tx: 0, ty: 0,
  speed: C.SPEED_BASE,
  score: 0, best: loadBest(),
  meter: 0, od: 0, streak: 0, streakT: 0,
  dyingT: 0, overT: 0, shake: 0,
  stats: { orb: 0, crystal: 0, near: 0, smash: 0, crash: 0 }, // event counters (handy for debugging)
};
const keys = { l: false, r: false, u: false, d: false };
let curPal = -1;
let flashA = 0;
let flashColor = '#ffffff';

function applyPalette(i) {
  curPal = i;
  const p = C.PALETTES[i];
  mats.edge.color.set(p.a);
  mats.orbGlow.color.set(p.b);
  scene.fog.color.set(p.fog);
  scene.background.set(p.bg);
  world.setPalette(p);
  fx.setPalette(p);
  ship.setTheme(p);
}

function flash(color, a) {
  flashColor = color;
  flashA = Math.max(flashA, a);
}

// Score multiplier: streak builds it up, overdrive doubles it.
function mult() {
  return Math.min(8, 1 + Math.floor(S.streak / 5)) * (S.od > 0 ? 2 : 1);
}

function charge(v) {
  if (S.od > 0) return;
  const before = S.meter;
  S.meter = Math.min(C.METER_MAX, S.meter + v);
  if (before < C.METER_MAX && S.meter >= C.METER_MAX) {
    sfx.ready();
    fx.popupAt('OVERDRIVE READY', window.innerWidth / 2, window.innerHeight * 0.62, 'gold');
  }
}

function tryOverdrive() {
  if (S.mode !== 'play' || S.od > 0 || S.meter < C.METER_MAX) return;
  S.od = C.OD_TIME;
  setOverdrive(true);
  sfx.overdrive();
  S.shake = Math.max(S.shake, 0.3);
  flash('#ffe066', 0.35);
  fx.popupAt('OVERDRIVE!', window.innerWidth / 2, window.innerHeight * 0.4, 'big');
}

function addScore(pts, x, y, z, text, cls = '') {
  S.score += pts;
  fx.popup(text || '+' + Math.round(pts), x, y, z, cls);
}

function handleEvent(e) {
  S.stats[e.type] = (S.stats[e.type] || 0) + 1;
  const m = mult();
  const pal = C.PALETTES[curPal];
  if (e.type === 'orb' || e.type === 'crystal') {
    const crystal = e.type === 'crystal';
    const gain = crystal ? 3 : 1;
    const before = S.streak;
    S.streak += gain;
    S.streakT = C.STREAK_TIMEOUT;
    charge(crystal ? C.METER_GAIN.crystal : C.METER_GAIN.orb);
    if (crystal) {
      addScore(300 * m, e.x, e.y, e.z, '+CHARGE', 'gold');
      fx.emit(e.x, e.y, e.z, 40, 0xffd23f, 16, 0.8);
      sfx.crystal();
    } else {
      addScore(50 * m, e.x, e.y, e.z);
      fx.emit(e.x, e.y, e.z, 10, pal.b, 6, 0.4);
      sfx.pickup(S.streak);
    }
    if (Math.floor(S.streak / 10) > Math.floor(before / 10)) {
      fx.popupAt('STREAK ' + S.streak, window.innerWidth / 2, window.innerHeight * 0.3, 'streak');
    }
  } else if (e.type === 'near') {
    charge(C.METER_GAIN.near);
    addScore(75 * m, e.x, e.y, e.z, 'CLOSE!', 'near');
    sfx.near();
  } else if (e.type === 'smash') {
    addScore(200 * m, e.x, e.y, e.z, 'SMASH!', 'smash');
    fx.shatter(e.x, e.y, e.z);
    sfx.smash();
    S.shake = Math.max(S.shake, 0.45);
    flash('#ffffff', 0.25);
  } else if (e.type === 'crash') {
    crash(e);
  }
}

function crash(e) {
  S.mode = 'dying';
  S.dyingT = 0;
  S.streak = 0;
  S.streakT = 0;
  S.od = 0;
  setOverdrive(false);
  sfx.crash();
  fx.explode(e.x, e.y, e.z, C.PALETTES[curPal]);
  ship.root.visible = false;
  S.shake = 1;
  flash('#ff2d55', 0.6);
}

function gameOver() {
  S.mode = 'over';
  S.overT = 0;
  const score = Math.floor(S.score);
  const isBest = score > S.best;
  if (isBest) {
    S.best = score;
    saveBest(score);
  }
  setText(dom.overScore, score.toLocaleString());
  setText(dom.overBest, S.best.toLocaleString());
  dom.overNew.hidden = !isBest;
  dom.over.classList.add('show');
}

function startGame() {
  initAudio();
  dom.title.classList.remove('show');
  dom.over.classList.remove('show');
  document.body.classList.remove('title');
  S.mode = 'play';
  S.zStart = S.z;
  S.score = 0;
  S.meter = 0;
  S.od = 0;
  S.streak = 0;
  S.streakT = 0;
  S.tx = S.sx = 0;
  S.ty = S.sy = 0;
  S.speed = C.SPEED_BASE;
  setOverdrive(false);
  track.reset(S.z);
  ship.root.visible = true;
}

function canStart() {
  return S.mode === 'title' || (S.mode === 'over' && S.overT > 0.6);
}

// Pointer / touch position steers the ship: screen maps onto the corridor.
// World +x is screen-LEFT here (the camera looks down +z), so the x mapping is negated.
function toLane(e) {
  S.tx = -clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1) * C.LANE_X;
  S.ty = clamp(1 - (e.clientY / window.innerHeight) * 2, -1, 1) * C.LANE_Y;
}

// ---------- per-frame update ----------
function update(rdt) {
  S.t += rdt;
  const dying = S.mode === 'dying';
  const dt = dying ? rdt * 0.35 : rdt; // slow motion after a crash
  if (dying) {
    S.dyingT += rdt;
    if (S.dyingT > 1.15) gameOver();
  }
  if (S.mode === 'over') S.overT += rdt;

  // Speed and travel
  const run = S.z - S.zStart;
  let goal;
  if (S.mode === 'play') goal = Math.min(C.SPEED_MAX, C.SPEED_BASE + run * C.SPEED_RAMP) * (S.od > 0 ? 1.35 : 1);
  else if (S.mode === 'title') goal = 24;
  else if (S.mode === 'dying') goal = 0;
  else goal = 4;
  S.speed += (goal - S.speed) * (1 - Math.exp(-rdt * 2.5));
  S.z += S.speed * dt;

  // Ship lateral control
  if (S.mode === 'play') {
    const kx = (keys.l ? 1 : 0) - (keys.r ? 1 : 0); // left arrow -> world +x (screen left)
    const ky = (keys.u ? 1 : 0) - (keys.d ? 1 : 0);
    if (kx) S.tx = clamp(S.tx + kx * 24 * rdt, -C.LANE_X, C.LANE_X);
    if (ky) S.ty = clamp(S.ty + ky * 18 * rdt, -C.LANE_Y, C.LANE_Y);
  } else if (S.mode === 'title') {
    S.tx = Math.sin(S.t * 0.6) * 5;
    S.ty = Math.sin(S.t * 0.9) * 2.2;
  }
  const ease = 1 - Math.exp(-rdt * 11);
  const px = S.sx;
  const py = S.sy;
  S.sx += (S.tx - S.sx) * ease;
  S.sy += (S.ty - S.sy) * ease;
  const inv = 1 / Math.max(rdt, 1e-3);
  const vx = (S.sx - px) * inv;
  const vy = (S.sy - py) * inv;

  // Streak, overdrive and distance score
  if (S.mode === 'play') {
    if (S.streakT > 0) {
      S.streakT -= rdt;
      if (S.streakT <= 0) S.streak = 0;
    }
    if (S.od > 0) {
      S.od -= rdt;
      if (S.od <= 0) {
        S.od = 0;
        S.meter = 0;
        setOverdrive(false);
      } else {
        S.meter = C.METER_MAX * (S.od / C.OD_TIME);
      }
    }
    S.score += S.speed * dt * 0.1 * mult();
  }

  // World simulation and collisions
  const wx = bendX(S.z) + S.sx;
  const wy = bendY(S.z) + S.sy;
  track.update(dt, S.z, wx, wy, S.mode === 'play' && S.od > 0);
  if (S.mode === 'play') {
    for (const e of track.events) {
      if (S.mode !== 'play') break;
      handleEvent(e);
    }
  }
  track.events.length = 0;

  // Colour zones
  const zoneIdx = Math.floor(Math.max(0, run) / C.ZONE_LENGTH);
  const palIdx = zoneIdx % C.PALETTES.length;
  if (palIdx !== curPal) {
    applyPalette(palIdx);
    if (S.mode === 'play' && zoneIdx > 0) {
      fx.popupAt(`ZONE ${zoneIdx + 1} · ${C.PALETTES[palIdx].name}`, window.innerWidth / 2, window.innerHeight * 0.22, 'zone');
      sfx.zone();
    }
  }

  // Camera: follows the ship from behind, leans into lateral movement, widens with speed
  const aspect = window.innerWidth / window.innerHeight;
  const portrait = aspect < 1; // phones: less width to show, so follow closer and sit farther back
  const ck = 1 - Math.exp(-rdt * 9);
  cam.x += (bendX(S.z) + S.sx * (portrait ? 0.85 : 0.45) - cam.x) * ck;
  cam.y += (bendY(S.z) + S.sy * 0.45 + 2.6 - cam.y) * ck;
  S.shake *= Math.exp(-rdt * 3.2);
  const shakeX = S.shake > 0.01 ? rnd(-1, 1) * S.shake * 0.7 : 0;
  const shakeY = S.shake > 0.01 ? rnd(-1, 1) * S.shake * 0.5 : 0;
  camera.position.set(cam.x + shakeX, cam.y + shakeY, S.z - (portrait ? 13 : 10.5));
  const lookZ = S.z + 26;
  camera.lookAt(bendX(lookZ) + S.sx * 0.2, bendY(lookZ) + S.sy * 0.2 + 0.4, lookZ);
  const fovGoal = (aspect < 1 ? 80 : 66) + (S.od > 0 ? 9 : 0) + clamp((S.speed - C.SPEED_BASE) * 0.12, 0, 8);
  camera.fov += (fovGoal - camera.fov) * (1 - Math.exp(-rdt * 4));
  camera.updateProjectionMatrix();

  // Ship visuals
  const od = S.od > 0;
  ship.root.scale.setScalar(1.45 + (od ? 0.1 + 0.04 * Math.sin(S.t * 30) : 0));
  ship.root.position.set(wx, wy + Math.sin(S.t * 3.1) * 0.1, S.z);
  ship.root.rotation.set(clamp(vy * 0.012, -0.35, 0.35), 0, clamp(-vx * 0.02, -0.55, 0.55));
  ship.edgeMat.color.set(od ? 0xffe066 : C.PALETTES[curPal].a);
  if (S.mode === 'play' || S.mode === 'title') {
    const p = C.PALETTES[curPal];
    fx.trail(wx + rnd(-0.35, 0.35), wy + rnd(-0.05, 0.2), S.z - 1.8, od ? 0xffe066 : p.a);
    if (od) fx.trail(wx + rnd(-0.6, 0.6), wy, S.z - 1.2, p.b);
  }
  fx.update(rdt);
  world.update(rdt, S.z, camera.position);

  // HUD
  setText(dom.score, Math.floor(S.score).toLocaleString());
  setText(dom.mult, 'x' + mult());
  setText(dom.streak, S.streak > 1 ? 'STREAK ' + S.streak : '');
  setText(dom.speed, Math.round(S.speed * 3.6) + ' KM/H');
  setText(dom.zone, `ZONE ${zoneIdx + 1} · ${C.PALETTES[palIdx].name}`);
  setText(dom.best, Math.max(S.best, Math.floor(S.score)).toLocaleString());
  dom.meterFill.style.width = S.meter.toFixed(1) + '%';
  dom.meter.classList.toggle('ready', S.mode === 'play' && !od && S.meter >= C.METER_MAX);
  dom.meter.classList.toggle('active', od);
  if (flashA > 0.003) {
    dom.flash.style.background = flashColor;
    dom.flash.style.opacity = flashA.toFixed(3);
    flashA *= Math.exp(-rdt * 5);
  } else if (dom.flash.style.opacity !== '0') {
    dom.flash.style.opacity = '0';
  }

  composer.render();
}

let last = performance.now();
function frame(now) {
  const rdt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(rdt);
  requestAnimationFrame(frame);
}

// ---------- input ----------
window.addEventListener('pointerdown', (e) => {
  if (e.target.closest && e.target.closest('#sound')) return;
  if (canStart()) {
    startGame();
    return;
  }
  if (S.mode === 'play') {
    tryOverdrive();
    toLane(e);
  }
});

window.addEventListener('pointermove', (e) => {
  if (S.mode === 'play') toLane(e);
});

const KEY = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd' };
window.addEventListener('keydown', (e) => {
  const k = KEY[e.code];
  if (k) {
    keys[k] = true;
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyM') {
    toggleSound();
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    if (e.repeat) return;
    if (canStart()) startGame();
    else tryOverdrive();
  }
});
window.addEventListener('keyup', (e) => {
  const k = KEY[e.code];
  if (k) keys[k] = false;
});
window.addEventListener('blur', () => {
  keys.l = keys.r = keys.u = keys.d = false;
});

function toggleSound() {
  initAudio();
  const m = !isMuted();
  setMuted(m);
  dom.sound.textContent = m ? 'SOUND OFF' : 'SOUND ON';
}
dom.sound.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSound();
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---------- boot ----------
applyPalette(0);
document.body.classList.add('title');
setText(dom.best, S.best.toLocaleString());
requestAnimationFrame((t) => {
  last = t;
  requestAnimationFrame(frame);
});

// Handy handle for debugging from the console.
window.neonDrift = { S, keys, startGame, tryOverdrive, track, bendX, bendY, camera, ship };
