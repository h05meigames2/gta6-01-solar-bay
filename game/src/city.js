// SOLAR BAY city layout: a grid of road bands and blocks, with original landmarks.
// Roads run at fixed bands; every block holds 1-4 buildings, a park, or a landmark lot.
// The south edge is the marina beach; the east edge holds the pier.
import { BLOCK, CITY, ROAD } from './config.js';

export const GRID = 7; // 7x7 blocks
export const PITCH = BLOCK + ROAD; // distance between road starts
export const CITY_EDGE = GRID * PITCH + ROAD; // == CITY

const ROOF_COLORS = ['#b5673f', '#7d8aa0', '#a08a5f', '#5f7d6b', '#96655a', '#6b7fa0', '#8a6b8f', '#c08a4a'];
const WALL_COLORS = ['#8a4f30', '#5f6b7d', '#7d6b45', '#4a6153', '#74483f', '#525f78', '#6b526e', '#96683a'];

// Road band index i runs along x (vertical roads) and along y (horizontal roads).
export function roadCenter(i) {
  return ROAD / 2 + i * PITCH;
}
export function isOnRoad(x, y) {
  const mx = x % PITCH;
  const my = y % PITCH;
  return mx < ROAD || my < ROAD;
}
// Nearest point on a road centreline (used to snap traffic and spawns).
export function nearestRoadPoint(x, y) {
  const ix = Math.max(0, Math.min(GRID, Math.round((x - ROAD / 2) / PITCH)));
  const iy = Math.max(0, Math.min(GRID, Math.round((y - ROAD / 2) / PITCH)));
  const cx = roadCenter(ix);
  const cy = roadCenter(iy);
  // Pick the closer centreline: vertical road at cx or horizontal at cy.
  return Math.abs(x - cx) < Math.abs(y - cy) ? { x: cx, y } : { x, y: cy };
}

function blockRect(bx, by) {
  return { x: ROAD + bx * PITCH, y: ROAD + by * PITCH, w: BLOCK, h: BLOCK };
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  // Landmark lots (block coordinates): garage, depot, pier lot, hospital, marina.
  const landmarks = {
    garage: { bx: 1, by: 3, name: 'Mara\u2019s Garage' },
    depot: { bx: 5, by: 1, name: 'Old Depot' },
    hospital: { bx: 3, by: 5, name: 'Bay Clinic' },
    pier: { bx: 6, by: 6, name: 'Solar Pier' },
    marina: { bx: 0, by: 6, name: 'Marina Beach' },
  };
  const landmarkKey = new Set(Object.values(landmarks).map((l) => `${l.bx},${l.by}`));

  for (let by = 0; by < GRID; by += 1) {
    for (let bx = 0; bx < GRID; bx += 1) {
      const r = blockRect(bx, by);
      if (landmarkKey.has(`${bx},${by}`)) {
        if (bx === 0 && by === 6) parks.push({ ...r, kind: 'beach' });
        else parks.push({ ...r, kind: 'lot' });
        continue;
      }
      const roll = random.next();
      if (roll < 0.16) {
        parks.push({ ...r, kind: 'park' });
        for (let t = 0; t < 9; t += 1) {
          trees.push({ x: r.x + 30 + random.next() * (r.w - 60), y: r.y + 30 + random.next() * (r.h - 60) });
        }
        continue;
      }
      const count = random.int(1, 4);
      const pad = 26;
      const cols = count === 1 ? 1 : 2;
      const rows = count <= 2 ? 1 : 2;
      const cw = (r.w - pad * 2) / cols;
      const ch = (r.h - pad * 2) / rows;
      let made = 0;
      for (let row = 0; row < rows && made < count; row += 1) {
        for (let col = 0; col < cols && made < count; col += 1) {
          const w = cw * random.range(0.55, 0.82);
          const h = ch * random.range(0.55, 0.82);
          const x = r.x + pad + col * cw + (cw - w) / 2;
          const y = r.y + pad + row * ch + (ch - h) / 2;
          const tall = random.next() < 0.3;
          const ci = random.int(0, ROOF_COLORS.length - 1);
          buildings.push({
            x, y, w, h,
            height: tall ? random.int(26, 44) : random.int(10, 20),
            roof: ROOF_COLORS[ci],
            wall: WALL_COLORS[ci],
            windows: random.int(2, 5),
          });
          made += 1;
        }
      }
      // A couple of street trees on the block corners.
      for (let t = 0; t < 2; t += 1) {
        trees.push({ x: r.x + random.range(8, r.w - 8), y: r.y + random.range(8, r.h - 8) });
      }
    }
  }
  // Lamps along every road band, every ~260 units.
  for (let i = 0; i <= GRID; i += 1) {
    const c = roadCenter(i);
    for (let d = ROAD + 60; d < CITY_EDGE - 40; d += 260) {
      lamps.push({ x: c + ROAD / 2 - 6, y: d });
      lamps.push({ x: d, y: c + ROAD / 2 - 6 });
    }
  }
  // Landmark world positions (centres of their blocks).
  const at = (l) => {
    const r = blockRect(l.bx, l.by);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2, name: l.name };
  };
  return {
    buildings, trees, lamps, parks,
    garage: at(landmarks.garage),
    depot: at(landmarks.depot),
    hospital: at(landmarks.hospital),
    pier: at(landmarks.pier),
    marina: at(landmarks.marina),
    blockRect,
  };
}

// Circle vs building collision: push the circle out, return true when it hit.
export function collideBuildings(city, x, y, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx;
    const dy = y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      const d = Math.sqrt(d2) || 0.001;
      const push = radius - d;
      x += (dx / d) * push;
      y += (dy / d) * push;
    }
  }
  return { x, y, hit };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return true;
  }
  return false;
}

// A random point on a road, at least `margin` from the city edge.
export function randomRoadPoint(random, margin = 140) {
  const i = random.int(0, GRID);
  const j = random.int(0, GRID);
  const vertical = random.next() < 0.5;
  if (vertical) return { x: roadCenter(i), y: margin + random.next() * (CITY_EDGE - margin * 2), angle: random.next() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  return { x: margin + random.next() * (CITY_EDGE - margin * 2), y: roadCenter(j), angle: random.next() < 0.5 ? 0 : Math.PI };
}
