// SOLAR BAY boot and main loop: title, play, paused, busted; fixed-step updates,
// mouse aim, shooting, and the ?shot= screenshot mode (paints twice, sets __shotReady).
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './rng.js';
import { createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_MISSION, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { unlockAudio } from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

// Debug/test handle: the shoot harness reads live state through this.
window.__solarbay = world;

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let best = save?.bestCash ?? 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    unlockAudio();
    world.reset(save);
    screen = SCREEN_PLAY;
    world.state.screen = 'play';
    announce('Playing Solar Bay. First job: steal a car for Mara Sol.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_BUSTED) {
        screen = SCREEN_PLAY;
        world.state.screen = 'play';
        announce('Back on the street.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        world.state.screen = 'play';
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        world.state.screen = 'paused';
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        world.state.screen = 'play';
      }
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_ENTER_CAR) world.tryEnterCar();
      if (actions & ACTION_PUNCH) world.punch();
      if (actions & ACTION_MISSION) {
        const m = world.currentMission();
        if (m) world.say(`JOB — ${m.name} ($${m.pay}): ${m.brief}`, 7);
        else world.say('All jobs done. Free roam — the Bay is yours.', 5);
      }
    }
  }

  function aimAngle() {
    const p = world.state.player;
    const cam = renderer.cam;
    const view = renderer.view;
    const px = p.x - cam.x + view.w / 2;
    const py = p.y - cam.y + view.h / 2;
    const m = input.mouse;
    return Math.atan2(m.y - py, m.x - px);
  }

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const p = world.state.player;
    // On foot the player faces the mouse; in a car the car faces its heading.
    if (!p.inCar) p.angle = aimAngle();
    world.step(STEP, input, aimAngle());
    // Hold mouse to fire the pistol on foot.
    if (input.mouse.down && !p.inCar && p.shootTimer <= 0) {
      world.shootAt(p.x, p.y, aimAngle(), 34, true);
      p.shootTimer = 0.28;
    }
    if (world.state.screen === 'busted') {
      screen = SCREEN_BUSTED;
      best = Math.max(best, world.state.cash);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // Title screen: keep the city alive behind the menu (marker bobbing).
      if (screen === SCREEN_TITLE) world.state.time += 0.016;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.state.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solar Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
