// World layout in metres. x = east, z = south. The car spawns facing north (-z).
export const ISLAND_RADIUS = 92;
export const SPAWN = { x: 0, z: 12, yaw: 0 };

export const ZONES = {
  start: { x: 0, z: 4, r: 16, color: '#ffb547' },
  about: { x: -40, z: -30, r: 14, color: '#ffb547' },
  experience: { x: 38, z: -36, r: 18, color: '#2bb3a3' },
  stack: { x: 44, z: 26, r: 15, color: '#ff7a59' },
  projects: { x: -44, z: 28, r: 16, color: '#9b8cff' },
  contact: { x: 0, z: 58, r: 14, color: '#5ec8ff' },
};

export const NAME_ROW = { x: 0, z: -8 };
export const RAMP = { x: 0, z: -40, yaw: 0 };
export const LOOP_RADIUS = 52;

// roads: list of polylines/curves for drawing and for keeping trees off them
export function roadPaths() {
  const z = ZONES;
  return [
    [[0, 30], [0, 0], [0, -60]], // north-south spine through the name and the ramp
    [[0, 0], [-20, -16], [z.about.x, z.about.z]],
    [[0, 0], [18, -18], [z.experience.x, z.experience.z]],
    [[0, 0], [22, 14], [z.stack.x, z.stack.z]],
    [[0, 0], [-22, 14], [z.projects.x, z.projects.z]],
    [[0, 0], [0, 30], [z.contact.x, z.contact.z]],
  ];
}

export function nearRoad(x, z, pad = 5) {
  for (const p of roadPaths()) {
    for (let i = 0; i < p.length - 1; i++) {
      if (distToSeg(x, z, p[i], p[i + 1]) < pad) return true;
    }
  }
  const d = Math.hypot(x, z);
  if (Math.abs(d - LOOP_RADIUS) < pad) return true;
  return false;
}

function distToSeg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - (a[0] + t * dx), z - (a[1] + t * dz));
}

export function inZone(x, z, pad = 0) {
  for (const k in ZONES) {
    const zn = ZONES[k];
    if (Math.hypot(x - zn.x, z - zn.z) < zn.r + pad) return true;
  }
  return false;
}

// deterministic noise for the coastline
export function coastRadius(angle) {
  return (
    ISLAND_RADIUS +
    Math.sin(angle * 3 + 0.4) * 4 +
    Math.sin(angle * 7 + 1.3) * 2.2 +
    Math.sin(angle * 13 + 2.1) * 1
  );
}

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
