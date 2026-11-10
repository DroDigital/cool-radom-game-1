import * as THREE from 'three';
import { FRAME_X, FRAME_Y } from './config.js';

// Particles, shattering wall pieces and DOM popups.
const MAX = 1400;
const rnd = (a, b) => a + Math.random() * (b - a);

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.2, 'rgba(255,255,255,0.6)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createFX(scene, camera) {
  // One Points object, simulated on the CPU. Fading is done by dimming the colour (additive blending).
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const base = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);
  const maxLife = new Float32Array(MAX);
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', posAttr);
  geo.setAttribute('color', colAttr);
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      sizeAttenuation: true,
    })
  );
  points.frustumCulled = false;
  scene.add(points);
  let head = 0;
  const tmp = new THREE.Color();

  function emit(x, y, z, n, hex, speed, lifeT) {
    tmp.setHex(hex);
    for (let k = 0; k < n; k++) {
      const i = head;
      head = (head + 1) % MAX;
      const j = i * 3;
      pos[j] = x;
      pos[j + 1] = y;
      pos[j + 2] = z;
      const u = rnd(-1, 1);
      const a = rnd(0, Math.PI * 2);
      const r = Math.sqrt(1 - u * u);
      const s = speed * rnd(0.3, 1);
      vel[j] = r * Math.cos(a) * s;
      vel[j + 1] = r * Math.sin(a) * s;
      vel[j + 2] = u * s;
      life[i] = maxLife[i] = lifeT * rnd(0.6, 1.2);
      base[j] = tmp.r * 1.8;
      base[j + 1] = tmp.g * 1.8;
      base[j + 2] = tmp.b * 1.8;
    }
  }

  function trail(x, y, z, hex) {
    emit(x, y, z, 2, hex, 3, 0.45);
  }

  function explode(x, y, z, pal) {
    emit(x, y, z, 70, pal.a, 26, 0.9);
    emit(x, y, z, 50, pal.b, 18, 1.1);
    emit(x, y, z, 30, 0xffffff, 12, 0.6);
  }

  // Shards of a smashed wall: they spread over the whole panel and tumble past the ship.
  const shardGeo = new THREE.TetrahedronGeometry(0.9, 0);
  const shardMats = [
    new THREE.MeshBasicMaterial({ color: 0x00f0ff, toneMapped: false }),
    new THREE.MeshBasicMaterial({ color: 0xff2bd6, toneMapped: false }),
  ];
  const shards = [];
  for (let i = 0; i < 72; i++) {
    const m = new THREE.Mesh(shardGeo, shardMats[i % 2]);
    m.visible = false;
    scene.add(m);
    shards.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3(), life: 0 });
  }
  let sHead = 0;

  function shatter(cx, cy, cz) {
    for (let k = 0; k < 26; k++) {
      const s = shards[sHead];
      sHead = (sHead + 1) % shards.length;
      s.m.visible = true;
      s.m.position.set(cx + rnd(-FRAME_X * 0.85, FRAME_X * 0.85), cy + rnd(-FRAME_Y * 0.85, FRAME_Y * 0.85), cz + rnd(-0.6, 0.6));
      s.m.scale.setScalar(rnd(0.5, 1.3));
      s.v.set(rnd(-12, 12), rnd(-9, 9), rnd(-4, 10));
      s.w.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
      s.life = rnd(0.9, 1.5);
    }
  }

  function update(dt) {
    const drag = Math.exp(-dt * 2.4);
    for (let i = 0; i < MAX; i++) {
      const L = life[i];
      if (L <= 0) continue;
      const j = i * 3;
      const nl = L - dt;
      if (nl <= 0) {
        life[i] = 0;
        col[j] = col[j + 1] = col[j + 2] = 0;
        pos[j + 1] = -1e4;
        continue;
      }
      life[i] = nl;
      vel[j] *= drag;
      vel[j + 1] *= drag;
      vel[j + 2] *= drag;
      pos[j] += vel[j] * dt;
      pos[j + 1] += vel[j + 1] * dt;
      pos[j + 2] += vel[j + 2] * dt;
      const k = nl / maxLife[i];
      col[j] = base[j] * k;
      col[j + 1] = base[j + 1] * k;
      col[j + 2] = base[j + 2] * k;
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    for (const s of shards) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.m.visible = false;
        continue;
      }
      s.m.position.addScaledVector(s.v, dt);
      s.v.multiplyScalar(Math.exp(-dt * 1.2));
      s.m.rotation.x += s.w.x * dt;
      s.m.rotation.y += s.w.y * dt;
      s.m.rotation.z += s.w.z * dt;
    }
  }

  // ---------- DOM popups ----------
  const layer = document.getElementById('popups');
  const v = new THREE.Vector3();

  function popupAt(text, sx, sy, cls = '') {
    if (!layer || layer.childElementCount > 40) return;
    const d = document.createElement('div');
    d.className = 'pop ' + cls;
    d.textContent = text;
    d.style.left = sx + 'px';
    d.style.top = sy + 'px';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  }

  // Projects a world point to the screen and shows a popup there.
  function popup(text, x, y, z, cls = '') {
    v.set(x, y, z).project(camera);
    popupAt(text, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, cls);
  }

  function setPalette(p) {
    shardMats[0].color.set(p.a);
    shardMats[1].color.set(p.b);
  }

  return { emit, trail, explode, shatter, update, popup, popupAt, setPalette };
}
