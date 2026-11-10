import * as THREE from 'three';
import { bendX, bendY } from './world.js';
import { FRAME_X, FRAME_Y, SHIP_R, SPAWN_AHEAD, DIFF_DISTANCE } from './config.js';

// Obstacles, orbs and collision rules. Patterns are generated ahead of the ship.
// Events (orb, crystal, near, smash, crash) are pushed to track.events for main.js to score.

const WALL_D = 1.1;   // wall thickness
const NEAR = 0.9;     // margin past the ship's radius that still counts as a near miss
const XS = [-10, -5, 0, 5, 10];
const YS = [-5.5, -2.5, 0, 2.5, 5.5];

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const hole = (cx, cy, narrow = false) => ({ cx, cy, hw: narrow ? 2.3 : 3.5, hh: narrow ? 2.5 : 3.2 });

export function createTrack(scene, mats) {
  const orbGeo = new THREE.SphereGeometry(0.42, 14, 10);
  const crystalGeo = new THREE.OctahedronGeometry(0.9, 0);
  const pools = { orb: [], crystal: [] };
  const orbs = [];
  const walls = [];
  let nextZ = 0;
  let baseZ = 0;
  let warm = true;

  // ---------- orbs ----------
  function makeOrb(kind) {
    const g = new THREE.Group();
    const isCrystal = kind === 'crystal';
    const core = new THREE.Mesh(isCrystal ? crystalGeo : orbGeo, isCrystal ? mats.gold : mats.orbCore);
    const glow = new THREE.Sprite(isCrystal ? mats.goldGlow : mats.orbGlow);
    glow.scale.setScalar(isCrystal ? 6.5 : 3.6);
    g.add(core, glow);
    scene.add(g);
    return { g, core, kind, x: 0, y: 0, z: 0, ph: 0 };
  }

  function orbAt(kind, lx, ly, z) {
    const x = bendX(z) + lx;
    const y = bendY(z) + ly;
    const o = pools[kind].pop() || makeOrb(kind);
    o.x = x;
    o.y = y;
    o.z = z;
    o.ph = Math.random() * 6;
    o.g.position.set(x, y, z);
    o.g.visible = true;
    orbs.push(o);
  }

  function releaseOrb(i) {
    const o = orbs[i];
    o.g.visible = false;
    pools[o.kind].push(o);
    orbs.splice(i, 1);
  }

  // ---------- walls ----------
  function spawnWall(z, holes) {
    const shape = new THREE.Shape();
    shape.moveTo(-FRAME_X, -FRAME_Y);
    shape.lineTo(FRAME_X, -FRAME_Y);
    shape.lineTo(FRAME_X, FRAME_Y);
    shape.lineTo(-FRAME_X, FRAME_Y);
    shape.closePath();
    for (const h of holes) {
      const p = new THREE.Path();
      p.moveTo(h.cx - h.hw, h.cy - h.hh);
      p.lineTo(h.cx + h.hw, h.cy - h.hh);
      p.lineTo(h.cx + h.hw, h.cy + h.hh);
      p.lineTo(h.cx - h.hw, h.cy + h.hh);
      p.closePath();
      shape.holes.push(p);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL_D, bevelEnabled: false });
    const edgeGeo = new THREE.EdgesGeometry(geo);
    const g = new THREE.Group();
    const panel = new THREE.Mesh(geo, mats.wall);
    const edges = new THREE.LineSegments(edgeGeo, mats.edge);
    panel.position.z = -WALL_D / 2;
    edges.position.z = -WALL_D / 2;
    g.add(panel, edges);
    g.position.set(bendX(z), bendY(z), z);
    scene.add(g);
    walls.push({ g, geo, edgeGeo, holes, z, checked: false });
  }

  function removeWall(i) {
    const w = walls[i];
    scene.remove(w.g);
    w.geo.dispose();
    w.edgeGeo.dispose();
    walls.splice(i, 1);
  }

  // ---------- patterns: each one lays out a section and returns the next free distance ----------
  function orbLine(z) {
    const lx = rnd(-11, 11);
    const ly = rnd(-5, 5);
    for (let k = 0; k < 9; k++) orbAt('orb', lx, ly, z + 4 + k * 3);
    return z + 34;
  }

  function orbZigzag(z) {
    const ly = rnd(-3, 3);
    for (let k = 0; k < 8; k++) orbAt('orb', k % 2 ? 4.5 : -4.5, ly, z + 4 + k * 9);
    return z + 80;
  }

  function orbRing(z) {
    const cx = rnd(-7, 7);
    const cy = rnd(-1.5, 1.5);
    const R = 4.6;
    const n = 12;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      orbAt('orb', cx + Math.cos(a) * R, cy + Math.sin(a) * R, z + 8);
    }
    return z + 24;
  }

  function singleWall(z) {
    spawnWall(z + 6, [hole(pick(XS), pick(YS))]);
    return z + 30;
  }

  function doubleWall(z) {
    spawnWall(z + 6, [hole(-9, pick(YS)), hole(9, pick(YS))]);
    return z + 30;
  }

  function guidedWall(z) {
    const cx = pick(XS);
    const cy = pick(YS);
    spawnWall(z + 14, [hole(cx, cy)]);
    for (let k = 0; k < 4; k++) orbAt('orb', cx, cy, z + 2 + k * 3);
    return z + 32;
  }

  function narrowWall(z) {
    const cx = pick(XS);
    const cy = pick(YS);
    spawnWall(z + 14, [hole(cx, cy, true)]);
    for (let k = 0; k < 3; k++) orbAt('orb', cx, cy, z + 2 + k * 3.5);
    return z + 32;
  }

  function slalom(z) {
    const s = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 3; i++) {
      spawnWall(z + 10 + i * 16, [hole((i % 2 ? -8.5 : 8.5) * s, pick(YS))]);
    }
    return z + 66;
  }

  function crystalLine(z) {
    orbAt('crystal', rnd(-9, 9), rnd(-3, 3), z + 12);
    return z + 28;
  }

  const patterns = [
    { w: 4, min: 0, fn: orbLine },
    { w: 3, min: 0, fn: orbZigzag },
    { w: 3, min: 0, fn: singleWall },
    { w: 2, min: 0.08, fn: orbRing },
    { w: 2, min: 0.12, fn: doubleWall },
    { w: 2, min: 0.2, fn: guidedWall },
    { w: 2, min: 0.3, fn: slalom },
    { w: 2, min: 0.4, fn: narrowWall },
    { w: 1, min: 0.05, fn: crystalLine },
  ];

  function pickPattern(diff) {
    let total = 0;
    for (const p of patterns) if (p.min <= diff) total += p.w;
    let r = Math.random() * total;
    for (const p of patterns) {
      if (p.min > diff) continue;
      r -= p.w;
      if (r <= 0) return p.fn;
    }
    return orbLine;
  }

  function fill(sz) {
    const limit = sz + SPAWN_AHEAD;
    while (nextZ < limit) {
      const diff = Math.min(1, Math.max(0, (nextZ - baseZ) / DIFF_DISTANCE));
      const pattern = warm ? orbLine : pickPattern(diff); // every run opens with a safe orb line
      warm = false;
      nextZ = pattern(nextZ);
    }
  }

  // ---------- per-frame simulation ----------
  const track = {
    events: [],

    reset(sz) {
      for (let i = orbs.length - 1; i >= 0; i--) releaseOrb(i);
      for (let i = walls.length - 1; i >= 0; i--) removeWall(i);
      track.events.length = 0;
      baseZ = sz;
      nextZ = sz + 70;
      warm = true;
    },

    // wx / wy: ship position in world space. od: overdrive is active.
    update(dt, sz, wx, wy, od) {
      fill(sz);

      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        if (o.z < sz - 12) {
          releaseOrb(i);
          continue;
        }
        if (od) {
          // Overdrive magnet: orbs close to the ship drift toward it.
          const mx = wx - o.x;
          const my = wy - o.y;
          if (mx * mx + my * my < 49 && Math.abs(sz - o.z) < 8) {
            o.x += mx * Math.min(1, dt * 8);
            o.y += my * Math.min(1, dt * 8);
          }
        }
        o.ph += dt * 3;
        o.core.rotation.y += dt * 1.8;
        o.core.rotation.x += dt * 0.9;
        o.g.position.set(o.x, o.y + Math.sin(o.ph) * 0.22, o.z);

        const dx = wx - o.x;
        const dy = wy - o.y;
        const dz = sz - o.z;
        if (dx * dx + dy * dy + dz * dz < 4) {
          track.events.push({ type: o.kind, x: o.x, y: o.y, z: o.z });
          releaseOrb(i);
        }
      }

      for (let i = walls.length - 1; i >= 0; i--) {
        const w = walls[i];
        if (w.z < sz - 16) {
          removeWall(i);
          continue;
        }
        if (w.checked || sz < w.z - WALL_D * 0.5) continue;
        w.checked = true;

        // Test the ship against every hole in this wall, in wall-local space.
        const cx = w.g.position.x;
        const cy = w.g.position.y;
        const lx = wx - cx;
        const ly = wy - cy;
        let best = -Infinity;
        for (const h of w.holes) {
          const m = Math.min(h.hw - Math.abs(lx - h.cx), h.hh - Math.abs(ly - h.cy)) - SHIP_R;
          if (m > best) best = m;
        }

        if (best >= 0) {
          if (best < NEAR) track.events.push({ type: 'near', x: wx, y: wy, z: w.z });
        } else if (od) {
          track.events.push({ type: 'smash', x: cx, y: cy, z: w.z });
          removeWall(i);
        } else {
          track.events.push({ type: 'crash', x: wx, y: wy, z: sz });
        }
      }
    },
  };
  track.walls = walls;
  track.orbs = orbs;
  track.reset(0);
  return track;
}
