// Keyboard + touch input, merged into one state object.
export function createInput({ onAction }) {
  const keys = new Set();
  const touch = { x: 0, y: 0, boost: false, brake: false, active: false };
  const state = { throttle: 0, steer: 0, boost: false, brake: false };

  const actionKeys = {
    Enter: 'open', KeyE: 'open', KeyM: 'map', KeyR: 'reset', Escape: 'escape',
  };
  const driveCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space']);

  const isTyping = (e) => /input|textarea|select/i.test(e.target?.tagName || '');
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    if (driveCodes.has(e.code)) {
      // don't hijack Space/Enter on focused buttons inside dialogs
      if (e.code === 'Space' && e.target?.closest?.('button, a')) return;
      keys.add(e.code);
      e.preventDefault();
    }
    if (actionKeys[e.code] && !e.repeat) {
      if (e.code === 'Enter' && e.target?.closest?.('button, a')) return;
      onAction(actionKeys[e.code], e);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  // ---- touch joystick ----
  const stick = document.querySelector('.stick');
  const knob = document.querySelector('.knob');
  let pid = null;
  const R = 52;
  const setKnob = (x, y) => {
    knob.style.transform = `translate(${x * R}px, ${y * R}px)`;
  };
  const move = (e) => {
    const b = stick.getBoundingClientRect();
    let x = (e.clientX - (b.left + b.width / 2)) / R;
    let y = (e.clientY - (b.top + b.height / 2)) / R;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    touch.x = x;
    touch.y = y;
    setKnob(x, y);
  };
  stick.addEventListener('pointerdown', (e) => {
    pid = e.pointerId;
    stick.setPointerCapture(pid);
    touch.active = true;
    move(e);
  });
  stick.addEventListener('pointermove', (e) => e.pointerId === pid && move(e));
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    touch.active = false;
    touch.x = touch.y = 0;
    setKnob(0, 0);
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  const hold = (id, prop) => {
    const el = document.getElementById(id);
    const on = (v) => (e) => {
      e.preventDefault();
      touch[prop] = v;
      el.classList.toggle('on', v);
    };
    el.addEventListener('pointerdown', on(true));
    el.addEventListener('pointerup', on(false));
    el.addEventListener('pointercancel', on(false));
    el.addEventListener('pointerleave', on(false));
  };
  hold('t-boost', 'boost');
  hold('t-brake', 'brake');

  function read() {
    const up = keys.has('KeyW') || keys.has('ArrowUp');
    const down = keys.has('KeyS') || keys.has('ArrowDown');
    const left = keys.has('KeyA') || keys.has('ArrowLeft');
    const right = keys.has('KeyD') || keys.has('ArrowRight');
    state.throttle = (up ? 1 : 0) - (down ? 1 : 0);
    state.steer = (left ? 1 : 0) - (right ? 1 : 0);
    state.boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.boost;
    state.brake = keys.has('Space') || touch.brake;
    // joystick gives a direction on screen; main.js turns it into steering
    state.stick = touch.active && Math.hypot(touch.x, touch.y) > 0.2 ? { x: touch.x, y: touch.y } : null;
    return state;
  }
  return { read };
}
