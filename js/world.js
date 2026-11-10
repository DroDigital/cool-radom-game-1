import * as THREE from 'three';
import { FRAME_X, FRAME_Y, RING_GAP, RING_COUNT, PALETTES } from './config.js';

// A gentle sway so the tunnel curves as you fly through it.
export function bendX(z) {
  return Math.sin(z * 0.011) * 9 + Math.sin(z * 0.0037 + 1.3) * 5;
}
export function bendY(z) {
  return Math.sin(z * 0.0083 + 0.7) * 4.5 + Math.sin(z * 0.021) * 0.9;
}

const rnd = (a, b) => a + Math.random() * (b - a);

function rectGeo(hx, hy) {
  return new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-hx, -hy, 0),
    new THREE.Vector3(hx, -hy, 0),
    new THREE.Vector3(hx, hy, 0),
    new THREE.Vector3(-hx, hy, 0),
  ]);
}

// Retro striped sun, drawn once to a canvas. Its blinds are cut out of the alpha channel.
function sunTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#fff6b0');
  grad.addColorStop(0.42, '#ffb020');
  grad.addColorStop(0.72, '#ff2bd6');
  grad.addColorStop(1, '#5a0bd6');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(256, 256, 252, 0, Math.PI * 2);
  g.fill();
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 7; i++) g.fillRect(0, 300 + i * i * 4 + i * 12, 512, 4 + i * 1.2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Everything that is "background": the neon frame tunnel, the bending rails, starfield and sun.
export function createWorld(scene) {
  const p0 = PALETTES[0];
  const ringA = new THREE.LineBasicMaterial({ color: p0.a, transparent: true, opacity: 0.85, toneMapped: false });
  const ringB = new THREE.LineBasicMaterial({ color: p0.b, transparent: true, opacity: 0.85, toneMapped: false });
  const railMat = new THREE.LineBasicMaterial({ color: p0.a, transparent: true, opacity: 0.35, toneMapped: false });

  // Neon frames: each is a group of two rectangles that is recycled as the ship flies forward.
  const outer = rectGeo(FRAME_X, FRAME_Y);
  const inner = rectGeo(FRAME_X - 0.6, FRAME_Y - 0.6);
  const rings = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const g = new THREE.Group();
    const m = i % 2 ? ringB : ringA;
    g.add(new THREE.LineLoop(outer, m), new THREE.LineLoop(inner, m));
    g.position.z = i * RING_GAP;
    scene.add(g);
    rings.push(g);
  }

  // Four rails that run the length of the tunnel and follow the bend.
  const RAIL_N = 80;
  const RAIL_STEP = 4;
  const rails = [
    [-FRAME_X, -FRAME_Y],
    [FRAME_X, -FRAME_Y],
    [FRAME_X, FRAME_Y],
    [-FRAME_X, FRAME_Y],
  ].map(([cx, cy]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIL_N * 3), 3));
    const line = new THREE.Line(geo, railMat);
    line.frustumCulled = false;
    scene.add(line);
    return { geo, cx, cy };
  });

  // Starfield, recycled ahead of the ship.
  const STAR_N = 900;
  const STAR_SPAN = 400;
  const starPos = new Float32Array(STAR_N * 3);
  const resetStar = (i, z) => {
    starPos[i * 3] = rnd(-140, 140);
    starPos[i * 3 + 1] = rnd(-80, 80);
    starPos[i * 3 + 2] = z;
  };
  for (let i = 0; i < STAR_N; i++) resetStar(i, rnd(-60, 340));
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false, fog: false })
  );
  stars.frustumCulled = false;
  scene.add(stars);

  // A sun that stays at a fixed angle to the camera, seen through the frames.
  const sun = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.MeshBasicMaterial({ map: sunTexture(), transparent: true, opacity: 0.9, fog: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide })
  );
  scene.add(sun);

  return {
    update(dt, sz, camPos) {
      for (const g of rings) {
        if (g.position.z < sz - 18) g.position.z += RING_COUNT * RING_GAP;
        g.position.x = bendX(g.position.z);
        g.position.y = bendY(g.position.z);
      }

      const z0 = Math.floor((sz - 24) / RAIL_STEP) * RAIL_STEP;
      for (const r of rails) {
        const a = r.geo.attributes.position.array;
        for (let k = 0; k < RAIL_N; k++) {
          const z = z0 + k * RAIL_STEP;
          a[k * 3] = bendX(z) + r.cx;
          a[k * 3 + 1] = bendY(z) + r.cy;
          a[k * 3 + 2] = z;
        }
        r.geo.attributes.position.needsUpdate = true;
      }

      for (let i = 0; i < STAR_N; i++) {
        if (starPos[i * 3 + 2] < sz - 60) resetStar(i, starPos[i * 3 + 2] + STAR_SPAN);
      }
      starGeo.attributes.position.needsUpdate = true;

      sun.position.set(camPos.x, camPos.y + 40, camPos.z + 430);
    },
    setPalette(p) {
      ringA.color.set(p.a);
      ringB.color.set(p.b);
      railMat.color.set(p.a);
    },
  };
}
