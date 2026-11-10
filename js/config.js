// Tunable constants and colour palettes for Neon Drift.

export const SHIP_R = 0.9;          // ship hit radius, measured against wall holes
export const LANE_X = 13;           // how far the ship can drift left / right
export const LANE_Y = 6.5;          // ...and up / down
export const FRAME_X = 18;          // corridor half-width (also the wall size)
export const FRAME_Y = 10;          // corridor half-height
export const RING_GAP = 8;          // spacing of the neon frames along the tunnel
export const RING_COUNT = 40;
export const SPAWN_AHEAD = 230;     // obstacles are generated this far in front of the ship
export const DIFF_DISTANCE = 2600;  // distance at which difficulty reaches its maximum
export const SPEED_BASE = 46;       // units per second at the start of a run
export const SPEED_MAX = 96;
export const SPEED_RAMP = 0.012;    // extra speed gained per unit flown
export const OD_TIME = 5.5;         // overdrive length in seconds
export const METER_MAX = 100;
export const METER_GAIN = { orb: 5, crystal: 35, near: 9 };
export const STREAK_TIMEOUT = 2.2;  // streak resets if no orb is grabbed for this long
export const ZONE_LENGTH = 700;     // distance per colour zone

export const PALETTES = [
  { name: 'NEON CITY',    a: 0x00f0ff, b: 0xff2bd6, fog: 0x0a0218, bg: 0x04000e },
  { name: 'SUNSET STRIP', a: 0xff8a1f, b: 0xffe600, fog: 0x1a0612, bg: 0x0c0207 },
  { name: 'ACID GRID',    a: 0x7dff3a, b: 0x00ffc2, fog: 0x021209, bg: 0x010a06 },
  { name: 'NEBULA DRIVE', a: 0xa66bff, b: 0xff4fd8, fog: 0x0b0320, bg: 0x060212 },
];
