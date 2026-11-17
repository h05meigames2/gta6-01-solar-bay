// Keyboard + mouse input: held keys as a set, edge-triggered actions, mouse aim.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MISSION = 32;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function keyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'Enter') actions |= ACTION_CONFIRM;
    if (e.code === 'KeyP' || e.code === 'Escape') actions |= ACTION_PAUSE;
    if (e.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    if (e.code === 'KeyF') actions |= ACTION_PUNCH;
    if (e.code === 'KeyM') actions |= ACTION_MISSION;
    if (e.code === 'Space') actions |= ACTION_PUNCH;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  }
  function keyUp(e) {
    keys.delete(e.code);
  }
  function mouseMove(e) {
    const r = canvas.getBoundingClientRect();
    mouseX = e.clientX - r.left;
    mouseY = e.clientY - r.top;
  }
  function mouseDownFn(e) {
    mouseMove(e);
    mouseDown = true;
    if (e.button === 0) actions |= ACTION_SHOOT;
  }
  function mouseUpFn() {
    mouseDown = false;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDownFn);
  window.addEventListener('mouseup', mouseUpFn);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    // Movement vector in world space, normalised, from WASD/arrows.
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    get up() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    get down() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    get left() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    get right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    get run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
  };
}
