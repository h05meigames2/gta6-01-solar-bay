// SOLAR BAY world: player, traffic, pedestrians, police, missions, combat, wanted.
// Everything here is original fiction: Riko Vale, Mara Sol, the Vex crew, Bay Patrol.
import {
  BLOCK, CAR_ACCEL, CAR_REVERSE, CAR_TOP_SPEED, CAR_TURN, CITY, MISSIONS,
  PISTOL_COOLDOWN, PISTOL_DAMAGE, PISTOL_RANGE, PLAYER_RUN, PLAYER_WALK,
  POLICE_MAX, PUNCH_DAMAGE, PUNCH_RANGE, ROAD, SAVE_KEY, STEP,
  WANTED_DECAY_SECONDS, WANTED_MAX,
} from './config.js';
import { buildCity, CITY_EDGE, collideBuildings, isOnRoad, nearestRoadPoint, pointInBuilding, randomRoadPoint, roadCenter } from './city.js';
import { createRandom } from './rng.js';
import { setEngine, setSiren, sfx } from './audio.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e0b13c', '#4fae62', '#8a5fd0', '#d9d9d9', '#3a3f4a', '#e07a2e'];
const PED_SHIRTS = ['#e0e0e0', '#5fae8a', '#d9a03c', '#7a9ad9', '#c96a7a', '#8a7ad9'];
const TAXI_COLOR = '#f2c230';

let carId = 1;

function makeCar(random, x, y, angle, kind, color) {
  return {
    id: carId += 1, x, y, angle, speed: 0, kind,
    color: color ?? random.pick(CAR_COLORS),
    length: 46, width: 22,
    axis: Math.abs(Math.cos(angle)) > 0.5 ? 'h' : 'v',
    dir: Math.cos(angle) >= 0 ? 1 : -1,
    cruise: random.range(110, 170),
    lane: random.next() < 0.5 ? -24 : 24,
    driver: kind === 'traffic',
    health: 100,
  };
}

function makePed(random, x, y) {
  return {
    x, y, angle: random.range(0, Math.PI * 2),
    speed: random.range(38, 68), health: 50,
    shirt: random.pick(PED_SHIRTS),
    target: null, flee: 0, scared: 0,
  };
}

export function createWorld(random) {
  const city = buildCity(random);
  const state = {
    random, city,
    time: 0, // seconds since game start
    hour: 10.5, // 10:30 in the morning
    hourBase: 10.5, // hour at time 0; the clock advances 1 game-hour per 20 s
    screen: 'title', // title | play | paused | over | busted
    cash: 0,
    bestCash: 0,
    wanted: 0,
    wantedTimer: 0,
    missionsDone: [],
    missionIndex: 0,
    missionStage: 'idle', // idle | take | deliver | pickup | survive
    missionTimer: 0,
    missionTarget: null,
    player: {
      x: city.garage.x + 120, y: city.garage.y + 60, angle: -Math.PI / 2,
      speed: 0, inCar: null, aim: 0, punchTimer: 0, shootTimer: 0, hurtTimer: 0,
      health: 100,
    },
    cars: [],
    peds: [],
    police: [], // police cars
    cops: [], // police on foot
    enemies: [],
    particles: [],
    pickups: [],
    feed: [],
    message: '',
    messageTimer: 0,
    bustedTimer: 0,
    stats: { carsStolen: 0, pedsHit: 0, missionsDone: 0 },
  };

  function say(text, seconds = 4) {
    state.message = text;
    state.messageTimer = seconds;
    state.feed.unshift({ text, t: state.time });
    if (state.feed.length > 5) state.feed.pop();
  }

  function addWanted(n, reason) {
    const before = state.wanted;
    state.wanted = Math.min(WANTED_MAX, state.wanted + n);
    state.wantedTimer = 0;
    if (state.wanted > before) {
      sfx.wanted();
      if (reason) say(`${reason} — Wanted +${state.wanted - before}`);
    }
  }

  function spawnParkedCars() {
    for (let i = 0; i < 16; i += 1) {
      const p = randomRoadPoint(random);
      const onRoad = isOnRoad(p.x, p.y);
      if (!onRoad) continue;
      const perp = p.angle + Math.PI / 2;
      const px = p.x + Math.cos(perp) * 34;
      const py = p.y + Math.sin(perp) * 34;
      if (pointInBuilding(city, px, py)) continue;
      state.cars.push(makeCar(random, px, py, p.angle, 'parked'));
    }
  }

  function spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const p = randomRoadPoint(random);
      const car = makeCar(random, p.x, p.y, p.angle, 'traffic');
      if (i === 0) car.color = TAXI_COLOR;
      car.speed = car.cruise;
      state.cars.push(car);
    }
  }

  function spawnPeds(count) {
    for (let i = 0; i < count; i += 1) {
      const p = randomRoadPoint(random);
      const perp = p.angle + Math.PI / 2;
      const px = p.x + Math.cos(perp) * (ROAD / 2 + 14);
      const py = p.y + Math.sin(perp) * (ROAD / 2 + 14);
      if (!pointInBuilding(city, px, py)) state.peds.push(makePed(random, px, py));
    }
  }

  function reset(save) {
    state.time = 0;
    state.hour = 10.5;
    state.hourBase = 10.5;
    state.cash = save?.cash ?? 0;
    state.bestCash = save?.bestCash ?? 0;
    state.player.health = 100;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.missionsDone = [...(save?.missionsDone ?? [])];
    state.missionIndex = state.missionsDone.length;
    state.missionStage = 'idle';
    state.missionTimer = 0;
    state.cars = [];
    state.peds = [];
    state.police = [];
    state.cops = [];
    state.enemies = [];
    state.particles = [];
    state.pickups = [];
    state.feed = [];
    state.player.x = city.garage.x + 120;
    state.player.y = city.garage.y + 60;
    state.player.angle = -Math.PI / 2;
    state.player.inCar = null;
    state.player.speed = 0;
    state.stats = { carsStolen: 0, pedsHit: 0, missionsDone: state.missionsDone.length };
    spawnParkedCars();
    spawnTraffic(14);
    spawnPeds(26);
    startMission();
  }

  function currentMission() {
    return MISSIONS[state.missionIndex] ?? null;
  }

  function startMission() {
    const m = currentMission();
    if (!m) {
      state.missionStage = 'idle';
      state.missionTarget = null;
      return;
    }
    if (m.id === 'm1') {
      state.missionStage = 'take';
      state.missionTarget = { x: city.garage.x, y: city.garage.y, name: 'Mara\u2019s Garage' };
      say(`NEW JOB — ${m.name}: ${m.brief}`, 7);
    } else if (m.id === 'm2') {
      state.missionStage = 'pickup';
      state.missionTarget = { x: city.depot.x, y: city.depot.y, name: 'Old Depot' };
      say(`NEW JOB — ${m.name}: ${m.brief}`, 7);
    } else if (m.id === 'm3') {
      state.missionStage = 'survive';
      state.missionTimer = 60;
      addWanted(3, 'The Bay Patrol is onto you');
      state.missionTarget = null;
      say(`NEW JOB — ${m.name}: ${m.brief}`, 7);
    }
    sfx.mission();
  }

  function completeMission() {
    const m = currentMission();
    if (!m) return;
    state.cash += m.pay;
    state.bestCash = Math.max(state.bestCash, state.cash);
    state.missionsDone.push(m.id);
    state.missionIndex += 1;
    state.stats.missionsDone += 1;
    sfx.cash();
    say(`JOB DONE — ${m.name}: +$${m.pay}`, 5);
    saveProgress();
    startMission();
  }

  function saveProgress() {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: state.cash, bestCash: state.bestCash, missionsDone: state.missionsDone,
      }));
    } catch {
      // Storage off: progress lasts this visit only.
    }
  }

  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  // ---- combat ----
  function shootAt(x, y, angle, damage, fromPlayer) {
    const endX = x + Math.cos(angle) * PISTOL_RANGE;
    const endY = y + Math.sin(angle) * PISTOL_RANGE;
    state.particles.push({ x, y, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.08, color: '#ffd94a', size: 3, kind: 'spark' });
    if (fromPlayer) {
      sfx.gunshot();
      addWanted(1, 'Shots fired');
    }
    // Hit the first thing along the ray: enemy, cop, or ped.
    let bestD = PISTOL_RANGE;
    let best = null;
    let bestKind = '';
    const test = (list, kind) => {
      for (const e of list) {
        const dx = e.x - x;
        const dy = e.y - y;
        const d = Math.hypot(dx, dy);
        if (d < 26 || d > bestD) continue;
        const dot = (dx * Math.cos(angle) + dy * Math.sin(angle)) / d;
        if (dot > 0.94) { bestD = d; best = e; bestKind = kind; }
      }
    };
    test(state.enemies, 'enemy');
    test(state.cops, 'cop');
    test(state.peds, 'ped');
    if (best) {
      best.health -= damage;
      state.particles.push({ x: best.x, y: best.y, vx: 0, vy: -30, life: 0.4, color: '#ff5a4a', size: 5, kind: 'blood' });
      if (bestKind === 'enemy' && best.health <= 0) {
        state.enemies = state.enemies.filter((e) => e !== best);
        state.cash += 40;
        state.pickups.push({ x: best.x, y: best.y, kind: 'cash', amount: 40 });
        say('Vex crew down. +$40');
      } else if (bestKind === 'cop' && best.health <= 0) {
        state.cops = state.cops.filter((e) => e !== best);
        addWanted(2, 'Officer down');
      } else if (bestKind === 'ped' && best.health <= 0) {
        state.peds = state.peds.filter((e) => e !== best);
        addWanted(1, 'Bystander hit');
      }
    }
    return { x: endX, y: endY };
  }

  function punch() {
    const p = state.player;
    if (p.punchTimer > 0 || p.inCar) return;
    p.punchTimer = 0.35;
    sfx.punch();
    const px = p.x + Math.cos(p.angle) * 30;
    const py = p.y + Math.sin(p.angle) * 30;
    const hit = (list, kind) => {
      for (const e of list) {
        if (Math.hypot(e.x - px, e.y - py) < PUNCH_RANGE) {
          e.health -= PUNCH_DAMAGE;
          if (kind === 'ped') addWanted(1, 'Assault');
          if (kind === 'enemy' && e.health <= 0) {
            state.enemies = state.enemies.filter((x) => x !== e);
            state.cash += 40;
            say('Vex crew down. +$40');
          }
          return true;
        }
      }
      return false;
    };
    hit(state.enemies, 'enemy') || hit(state.cops, 'cop') || hit(state.peds, 'ped');
  }

  function tryEnterCar() {
    const p = state.player;
    if (p.inCar) {
      // Get out.
      const car = p.inCar;
      const side = car.angle + Math.PI / 2;
      p.x = car.x + Math.cos(side) * 34;
      p.y = car.y + Math.sin(side) * 34;
      p.inCar = null;
      car.speed = 0;
      sfx.door();
      return;
    }
    let best = null;
    let bestD = 70;
    for (const car of state.cars) {
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    if (!best) return;
    p.inCar = best;
    best.kind = 'player';
    state.stats.carsStolen += 1;
    sfx.door();
    if (best.driver) {
      // The driver bails and runs.
      best.driver = false;
      const d = makePed(random, best.x + 30, best.y + 30);
      d.flee = 6;
      state.peds.push(d);
      addWanted(1, 'Carjacked!');
    } else {
      addWanted(1, 'Car stolen');
      say('Hot-wired. It\u2019s yours now.');
    }
  }

  // ---- police ----
  function spawnPoliceCar() {
    const p = state.player;
    const angle = random.range(0, Math.PI * 2);
    const dist = random.range(520, 780);
    let x = p.x + Math.cos(angle) * dist;
    let y = p.y + Math.sin(angle) * dist;
    x = Math.max(80, Math.min(CITY_EDGE - 80, x));
    y = Math.max(80, Math.min(CITY_EDGE - 80, y));
    const rp = nearestRoadPoint(x, y);
    const car = makeCar(random, rp.x, rp.y, 0, 'police', '#22335c');
    car.speed = 200;
    state.police.push(car);
  }

  function spawnCop(x, y) {
    const cop = makePed(random, x, y);
    cop.health = 100;
    cop.shirt = '#22335c';
    cop.speed = 150;
    state.cops.push(cop);
  }

  function bustPlayer() {
    const p = state.player;
    if (p.inCar) {
      p.inCar.kind = 'parked';
      p.inCar.speed = 0;
      p.inCar = null;
    }
    const lost = Math.min(state.cash, Math.max(50, Math.floor(state.cash * 0.15)));
    state.cash -= lost;
    state.wanted = 0;
    state.police = [];
    state.cops = [];
    state.enemies = [];
    p.x = city.hospital.x;
    p.y = city.hospital.y + 80;
    p.health = 100;
    state.screen = 'busted';
    state.bustedTimer = 3;
    sfx.busted();
    say(`BUSTED by the Bay Patrol. Fine: $${lost}.`, 5);
    saveProgress();
  }

  function wastePlayer() {
    const p = state.player;
    if (p.inCar) {
      p.inCar.kind = 'parked';
      p.inCar.speed = 0;
      p.inCar = null;
    }
    const lost = Math.min(state.cash, Math.max(50, Math.floor(state.cash * 0.2)));
    state.cash -= lost;
    state.wanted = Math.max(0, state.wanted - 1);
    state.police = [];
    state.cops = [];
    state.enemies = [];
    p.x = city.hospital.x;
    p.y = city.hospital.y + 80;
    p.health = 100;
    state.screen = 'busted';
    state.bustedTimer = 3;
    sfx.busted();
    say(`You flatlined. The clinic patched you up. Lost $${lost}.`, 5);
    saveProgress();
  }

  // ---- per-frame updates ----
  function updatePlayer(dt, input, aim) {
    const p = state.player;
    p.punchTimer = Math.max(0, p.punchTimer - dt);
    p.shootTimer = Math.max(0, p.shootTimer - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    if (p.inCar) {
      const car = p.inCar;
      const fwd = input.up ? 1 : input.down ? -1 : 0;
      const steer = input.left ? -1 : input.right ? 1 : 0;
      if (fwd > 0) car.speed = Math.min(CAR_TOP_SPEED, car.speed + CAR_ACCEL * dt);
      else if (fwd < 0) car.speed = Math.max(-CAR_REVERSE, car.speed - CAR_ACCEL * dt);
      else car.speed *= Math.max(0, 1 - 1.6 * dt);
      const dir = car.speed >= 0 ? 1 : -1;
      car.angle += steer * CAR_TURN * dt * dir * Math.min(1, Math.abs(car.speed) / 120);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const res = collideBuildings(city, nx, ny, 24);
      if (res.hit && Math.abs(car.speed) > 120) {
        sfx.crash();
        state.particles.push({ x: car.x, y: car.y, vx: 0, vy: 0, life: 0.5, color: '#ffb14a', size: 6, kind: 'smoke' });
        car.speed *= -0.25;
      } else if (res.hit) {
        car.speed *= 0.4;
      }
      car.x = Math.max(40, Math.min(CITY_EDGE - 40, res.x));
      car.y = Math.max(40, Math.min(CITY_EDGE - 40, res.y));
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      setEngine(Math.abs(car.speed) / CAR_TOP_SPEED, true);
      // Running over pedestrians in a car.
      for (const ped of [...state.peds]) {
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 26 && Math.abs(car.speed) > 60) {
          state.peds = state.peds.filter((q) => q !== ped);
          state.stats.pedsHit += 1;
          addWanted(1, 'Pedestrian hit');
          sfx.crash();
        }
      }
      return;
    }
    setEngine(0, false);
    const mv = input.moveVector();
    const speed = input.run ? PLAYER_RUN : PLAYER_WALK;
    let nx = p.x + mv.x * speed * dt;
    let ny = p.y + mv.y * speed * dt;
    // On foot the player faces the mouse aim; without aim, face the walk direction.
    if (aim !== undefined && aim !== null) p.angle = aim;
    else if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
    if (aim) p.aim = aim;
    const res = collideBuildings(city, nx, ny, 14);
    p.x = Math.max(24, Math.min(CITY_EDGE - 24, res.x));
    p.y = Math.max(24, Math.min(CITY_EDGE - 24, res.y));
    // Pick up cash/health.
    for (const pk of [...state.pickups]) {
      if (Math.hypot(pk.x - p.x, pk.y - p.y) < 26) {
        state.pickups = state.pickups.filter((q) => q !== pk);
        if (pk.kind === 'cash') { state.cash += pk.amount; sfx.cash(); }
        else if (pk.kind === 'health') { p.health = Math.min(100, p.health + 50); sfx.pickup(); say('Patched up. +50 health'); }
      }
    }
    if (p.health < 100 && state.wanted === 0) p.health = Math.min(100, p.health + 2 * dt);
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      if (car.kind === 'parked') continue;
      // Cruise along its road; turn at intersections sometimes.
      const speed = car.cruise;
      const atX = roadCenter(Math.round((car.x - ROAD / 2) / (BLOCK + ROAD)));
      const atY = roadCenter(Math.round((car.y - ROAD / 2) / (BLOCK + ROAD)));
      const nearIntersection = Math.abs(car.x - atX) < 34 && Math.abs(car.y - atY) < 34;
      if (nearIntersection && state.random.next() < 0.012) {
        const choices = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => Math.abs(a - car.angle) > 0.4);
        car.angle = state.random.pick(choices);
      }
      car.axis = Math.abs(Math.cos(car.angle)) > 0.5 ? 'h' : 'v';
      // Keep to the right-hand lane of the centreline.
      const centre = car.axis === 'h' ? atY : atX;
      const laneTarget = centre + (car.axis === 'h' ? (Math.cos(car.angle) > 0 ? 24 : -24) : (Math.sin(car.angle) > 0 ? -24 : 24));
      const drift = car.axis === 'h' ? laneTarget - car.y : laneTarget - car.x;
      car.x += Math.cos(car.angle) * speed * dt + (car.axis === 'v' ? drift * dt * 2 : 0);
      car.y += Math.sin(car.angle) * speed * dt + (car.axis === 'h' ? drift * dt * 2 : 0);
      // Wrap around the city edge: respawn on another road.
      if (car.x < 30 || car.x > CITY_EDGE - 30 || car.y < 30 || car.y > CITY_EDGE - 30) {
        const p = randomRoadPoint(state.random);
        car.x = p.x;
        car.y = p.y;
        car.angle = p.angle;
      }
      // Slow down for the car ahead.
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 26) {
          car.x -= Math.cos(car.angle) * speed * dt * 0.9;
          car.y -= Math.sin(car.angle) * speed * dt * 0.9;
        }
      }
    }
    // Keep traffic topped up.
    const moving = state.cars.filter((c) => c.kind === 'traffic').length;
    if (moving < 12) spawnTraffic(1);
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.flee > 0) ped.flee -= dt;
      const threatX = p.inCar ? p.inCar.x : p.x;
      const threatY = p.inCar ? p.inCar.y : p.y;
      const dThreat = Math.hypot(ped.x - threatX, ped.y - threatY);
      if (dThreat < 90 && (p.inCar || state.wanted > 0)) ped.flee = 2;
      if (ped.flee > 0) {
        ped.angle = Math.atan2(ped.y - threatY, ped.x - threatX);
        ped.x += Math.cos(ped.angle) * 150 * dt;
        ped.y += Math.sin(ped.angle) * 150 * dt;
      } else {
        if (!ped.target || Math.hypot(ped.target.x - ped.x, ped.target.y - ped.y) < 24) {
          const rp = randomRoadPoint(state.random);
          const perp = rp.angle + Math.PI / 2;
          ped.target = { x: rp.x + Math.cos(perp) * (ROAD / 2 + 14), y: rp.y + Math.sin(perp) * (ROAD / 2 + 14) };
        }
        ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      const res = collideBuildings(city, ped.x, ped.y, 10);
      ped.x = res.x;
      ped.y = res.y;
    }
    if (state.peds.length < 22) spawnPeds(1);
  }

  function updatePolice(dt) {
    const p = state.player;
    // Wanted decay: quiet for a while with no police near, and the heat cools off.
    if (state.wanted > 0) {
      state.wantedTimer += dt;
      const near = state.police.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 500);
      if (state.wantedTimer > WANTED_DECAY_SECONDS && !near) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        say(state.wanted === 0 ? 'The heat is off. You\u2019re clean.' : `Wanted down to ${state.wanted} star${state.wanted > 1 ? 's' : ''}.`);
      }
    }
    setSiren(state.wanted > 0);
    const wantCars = Math.min(state.wanted, 4);
    while (state.police.length < wantCars && state.police.length < POLICE_MAX) spawnPoliceCar();
    if (state.wanted === 0) {
      state.police = [];
      state.cops = [];
      return;
    }
    for (const car of state.police) {
      const dx = p.x - car.x;
      const dy = p.y - car.y;
      const dist = Math.hypot(dx, dy) || 1;
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const speed = dist > 300 ? 330 : 260;
      car.speed = speed;
      car.x += Math.cos(car.angle) * speed * dt;
      car.y += Math.sin(car.angle) * speed * dt;
      const res = collideBuildings(city, car.x, car.y, 24);
      car.x = res.x;
      car.y = res.y;
      // Ram the player's car.
      if (p.inCar) {
        const pc = p.inCar;
        if (Math.hypot(car.x - pc.x, car.y - pc.y) < 52) {
          pc.speed *= 0.7;
          p.health -= 14 * dt;
          if (state.random.next() < dt * 2) sfx.crash();
        }
      } else if (dist < 46) {
        // Cop gets out and chases on foot.
        if (state.cops.length < 3 && state.random.next() < dt * 1.5) {
          spawnCop(car.x + 30, car.y + 30);
        }
      }
    }
    // Foot cops chase and try to bust the player.
    for (const cop of state.cops) {
      cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
      const d = Math.hypot(p.x - cop.x, p.y - cop.y);
      if (d > 26) {
        cop.x += Math.cos(cop.angle) * cop.speed * dt;
        cop.y += Math.sin(cop.angle) * cop.speed * dt;
      } else if (!p.inCar) {
        state.bustedTimer += dt;
        if (state.bustedTimer > 1.2) bustPlayer();
      }
      const res = collideBuildings(city, cop.x, cop.y, 10);
      cop.x = res.x;
      cop.y = res.y;
    }
    if (state.cops.length > 0 && p.inCar) state.bustedTimer = 0;
    if (Math.hypot(p.x - (state.cops[0]?.x ?? 1e9), p.y - (state.cops[0]?.y ?? 1e9)) > 26) state.bustedTimer = Math.max(0, state.bustedTimer - dt);
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      e.shootTimer = Math.max(0, (e.shootTimer ?? 0) - dt);
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < 560) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (d > 200) {
          e.x += Math.cos(e.angle) * 90 * dt;
          e.y += Math.sin(e.angle) * 90 * dt;
        }
        if (e.shootTimer <= 0 && d < PISTOL_RANGE + 60) {
          e.shootTimer = 1.1 + state.random.next() * 0.8;
          const miss = state.random.range(-0.22, 0.22);
          sfx.gunshot();
          state.particles.push({ x: e.x, y: e.y, vx: Math.cos(e.angle + miss) * 900, vy: Math.sin(e.angle + miss) * 900, life: 0.08, color: '#ffd94a', size: 3, kind: 'spark' });
          if (Math.abs(miss) < 0.09 && d < PISTOL_RANGE) {
            p.health -= 9;
            p.hurtTimer = 0.4;
            sfx.hurt();
            if (p.health <= 0) wastePlayer();
          }
        }
      }
      const res = collideBuildings(city, e.x, e.y, 12);
      e.x = res.x;
      e.y = res.y;
    }
  }

  function updateMissions(dt) {
    const m = currentMission();
    if (!m) return;
    const p = state.player;
    const atTarget = (t, r) => t && Math.hypot(p.x - t.x, p.y - t.y) < r;
    if (m.id === 'm1' && state.missionStage === 'take') {
      if (p.inCar && atTarget(state.missionTarget, 110)) completeMission();
      else if (p.inCar) state.missionTarget = { x: city.garage.x, y: city.garage.y, name: 'Mara\u2019s Garage' };
    } else if (m.id === 'm2') {
      if (state.missionStage === 'pickup' && atTarget(state.missionTarget, 90)) {
        state.missionStage = 'deliver';
        state.missionTarget = { x: city.pier.x, y: city.pier.y, name: 'Solar Pier' };
        sfx.pickup();
        say('Crate secured. The Vex crew is coming — get to the pier!', 5);
        for (let i = 0; i < 3; i += 1) {
          const a = state.random.range(0, Math.PI * 2);
          state.enemies.push({
            x: city.depot.x + Math.cos(a) * 160, y: city.depot.y + Math.sin(a) * 160,
            angle: 0, health: 60, shootTimer: 1 + i * 0.5, shirt: '#7a1f2b',
          });
        }
      } else if (state.missionStage === 'deliver' && atTarget(state.missionTarget, 110)) {
        completeMission();
      }
    } else if (m.id === 'm3' && state.missionStage === 'survive') {
      if (state.wanted >= 2) state.missionTimer -= dt;
      if (state.wanted === 0) completeMission();
      else if (state.missionTimer <= 0) completeMission();
    }
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  function step(dt, input, aimAngle) {
    if (state.screen !== 'play') return;
    state.time += dt;
    state.hour = (state.hourBase + state.time / 20) % 24;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    updatePlayer(dt, input, aimAngle);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateEnemies(dt);
    updateMissions(dt);
    updateParticles(dt);
    if (state.player.health <= 0) wastePlayer();
    if (state.time > 0 && state.pickups.length === 0 && state.random.next() < dt * 0.02) {
      state.pickups.push({ x: city.hospital.x + 60, y: city.hospital.y - 40, kind: 'health', amount: 0 });
    }
  }

  return {
    state, city, reset, loadSave, saveProgress, currentMission, startMission,
    step, say, addWanted, tryEnterCar, punch, shootAt,
    isNight() { return state.hour >= 19.5 || state.hour < 6; },
  };
}

export { STEP };
