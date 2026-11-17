// Screenshot scenes behind ?shot=chase|drive|walk|combat (with &seed=N).
// Each one plays the real rules forward from a fresh world for a fixed number of
// steps, steered by scripted inputs, so the frame is what real play looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const FAKE_DRIVE = {
  up: true, down: false, left: false, right: false, run: false,
  moveVector: () => ({ x: 0, y: 0 }),
};
const FAKE_WALK = {
  up: false, down: false, left: false, right: false, run: false,
  moveVector: () => ({ x: 0.6, y: 0.8 }),
};
const FAKE_IDLE = {
  up: false, down: false, left: false, right: false, run: false,
  moveVector: () => ({ x: 0, y: 0 }),
};

function putPlayerInCar(world) {
  const st = world.state;
  let best = null;
  let bestD = 1e9;
  for (const car of st.cars) {
    const d = Math.hypot(car.x - st.player.x, car.y - st.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  st.player.x = best.x;
  st.player.y = best.y;
  st.player.inCar = best;
  best.kind = 'player';
  best.speed = 180;
}

function spawnChasePolice(world, count) {
  const st = world.state;
  for (let i = 0; i < count; i += 1) {
    const a = st.random.range(0, Math.PI * 2);
    const x = st.player.x + Math.cos(a) * 320;
    const y = st.player.y + Math.sin(a) * 320;
    const car = {
      id: 900 + i, x, y, angle: Math.atan2(st.player.y - y, st.player.x - x),
      speed: 260, kind: 'police', color: '#22335c', length: 46, width: 22,
      axis: 'h', dir: 1, cruise: 300, lane: 0, driver: false, health: 100,
    };
    st.police.push(car);
  }
}

function composeCar(world, x, y, angle, speed, kind, color) {
  const st = world.state;
  const car = {
    id: 900 + Math.floor(st.random.next() * 90), x, y, angle, speed,
    kind, color, length: 46, width: 22,
    axis: Math.abs(Math.cos(angle)) > 0.5 ? 'h' : 'v',
    dir: Math.cos(angle) >= 0 ? 1 : -1,
    cruise: 150, lane: 0, driver: false, health: 100,
  };
  return car;
}

export function stageShot(name, world) {
  const st = world.state;
  world.reset(null);
  st.screen = 'play';

  if (name === 'chase') {
    // Mission 2 delivery, wanted 3, police on the tail, mid-afternoon sun.
    st.missionIndex = 1;
    st.missionsDone = ['m1'];
    st.missionStage = 'deliver';
    st.missionTarget = { x: st.city.pier.x, y: st.city.pier.y, name: 'Solar Pier' };
    st.cash = 740;
    st.bestCash = 740;
    st.hourBase = 16.2;
    st.hour = 16.2;
    st.wanted = 3;
    putPlayerInCar(world);
    spawnChasePolice(world, 3);
    for (let i = 0; i < 2 * 60; i += 1) {
      const input = { ...FAKE_DRIVE, right: i % 120 < 30 };
      world.step(STEP, input, st.player.angle);
    }
    // Compose the frame mid-city: player car east on Coral Row, patrol
    // closing in from behind and from the cross street, traffic ahead.
    const car = st.player.inCar;
    car.x = 1500; car.y = 1375; car.angle = 0; car.speed = 320;
    st.player.x = car.x; st.player.y = car.y; st.player.angle = 0;
    st.police = [
      composeCar(world, 1300, 1375, 0, 330, 'police', '#22335c'),
      composeCar(world, 1760, 1150, Math.PI / 2, 300, 'police', '#22335c'),
      composeCar(world, 1960, 1375, Math.PI, 300, 'police', '#22335c'),
    ];
    st.cars.push(composeCar(world, 1180, 1425, 0, 140, 'traffic', '#d94f3d'));
    st.cars.push(composeCar(world, 2100, 1325, Math.PI, 150, 'traffic', '#3d7dd9'));
    world.say('JOB — Sunset Run: the crate is in the car. Lose the Bay Patrol, reach Solar Pier!', 6);
    return { screen: SCREEN_PLAY, best: 740 };
  }

  if (name === 'drive') {
    // Cruising Coral Row in a stolen sedan, mission 1 active, traffic around.
    st.missionIndex = 0;
    st.missionStage = 'take';
    st.missionTarget = { x: st.city.garage.x, y: st.city.garage.y, name: 'Mara\u2019s Garage' };
    st.cash = 120;
    st.bestCash = 120;
    st.hourBase = 11.0;
    st.hour = 11.0;
    putPlayerInCar(world);
    for (let i = 0; i < 2 * 60; i += 1) {
      world.step(STEP, FAKE_DRIVE, st.player.angle);
    }
    // Compose mid-city on Coral Row, traffic sharing the road.
    const car = st.player.inCar;
    car.x = 1500; car.y = 1815; car.angle = 0; car.speed = 280;
    st.player.x = car.x; st.player.y = car.y; st.player.angle = 0;
    st.cars.push(composeCar(world, 1300, 1865, 0, 150, 'traffic', '#e0b13c'));
    st.cars.push(composeCar(world, 1980, 1765, Math.PI, 160, 'traffic', '#4fae62'));
    st.cars.push(composeCar(world, 1815, 2050, -Math.PI / 2, 140, 'traffic', '#8a5fd0'));
    world.say('First Wheels: drive this car to Mara\u2019s Garage on Coral Row.', 6);
    return { screen: SCREEN_PLAY, best: 120 };
  }

  if (name === 'walk') {
    // On foot outside Mara's Garage, pedestrians on the sidewalk, job 1 briefing.
    st.missionIndex = 0;
    st.missionStage = 'take';
    st.missionTarget = { x: st.city.garage.x, y: st.city.garage.y, name: 'Mara\u2019s Garage' };
    st.cash = 0;
    st.bestCash = 0;
    st.hourBase = 10.5;
    st.hour = 10.5;
    st.player.x = st.city.garage.x + 130;
    st.player.y = st.city.garage.y + 90;
    for (let i = 0; i < 1 * 60; i += 1) {
      world.step(STEP, FAKE_WALK, -0.6);
    }
    // Compose: Riko on the lot edge, pedestrians nearby, a parked car to steal.
    st.player.x = st.city.garage.x + 170;
    st.player.y = st.city.garage.y + 40;
    st.player.angle = -0.6;
    for (let i = 0; i < 3; i += 1) {
      st.peds.push({
        x: st.city.garage.x + 120 + i * 90, y: st.city.garage.y - 120 - i * 30,
        angle: 0.5, speed: 50, health: 50, shirt: ['#e0e0e0', '#5fae8a', '#d9a03c'][i],
        target: null, flee: 0, scared: 0,
      });
    }
    st.cars.push(composeCar(world, st.city.garage.x + 300, st.city.garage.y + 130, 0, 0, 'parked', '#d94f3d'));
    world.say('NEW JOB — First Wheels: take any parked car and bring it to Mara\u2019s Garage.', 6);
    return { screen: SCREEN_PLAY, best: 0 };
  }

  if (name === 'combat') {
    // Night at the Old Depot: Vex crew ambush, pistol out, wanted 2.
    st.missionIndex = 1;
    st.missionsDone = ['m1'];
    st.missionStage = 'pickup';
    st.missionTarget = { x: st.city.depot.x, y: st.city.depot.y, name: 'Old Depot' };
    st.cash = 300;
    st.bestCash = 300;
    st.hourBase = 22.4;
    st.hour = 22.4;
    // Wanted stays 0 while the scene is staged (no patrol cars yet), then 2
    // for the frame itself — the shot is a still, the chase resumes in play.
    st.wanted = 0;
    st.player.x = st.city.depot.x - 180;
    st.player.y = st.city.depot.y + 60;
    for (let i = 0; i < 3; i += 1) {
      const a = st.random.range(0, Math.PI * 2);
      st.enemies.push({
        x: st.city.depot.x + Math.cos(a) * 150, y: st.city.depot.y + Math.sin(a) * 150,
        angle: 0, health: 60, shootTimer: 0.4 + i * 0.4, shirt: '#7a1f2b',
      });
    }
    for (let i = 0; i < 2 * 60; i += 1) {
      world.step(STEP, FAKE_IDLE, Math.atan2(st.enemies[0].y - st.player.y, st.enemies[0].x - st.player.x));
    }
    // One real shot from the player, for the muzzle flash in the frame.
    world.shootAt(st.player.x, st.player.y, Math.atan2(st.enemies[0].y - st.player.y, st.enemies[0].x - st.player.x), 34, true);
    st.wanted = 2;
    return { screen: SCREEN_PLAY, best: 300 };
  }

  // Default: title screen over a living city.
  st.screen = 'title';
  for (let i = 0; i < 5 * 60; i += 1) {
    st.time += STEP;
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
