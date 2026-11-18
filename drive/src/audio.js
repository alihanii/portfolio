// Synthesised engine + bump sounds (no audio files).
export function createAudio() {
  let ctx = null, master, engineGain, osc1, osc2, filter, noiseBuf;
  let enabled = true;
  try {
    enabled = localStorage.getItem('drive-sound') !== 'off';
  } catch {}

  function start() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.5 : 0;
    master.connect(ctx.destination);
    filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.Q.value = 2;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0.0;
    osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    osc1.connect(filter);
    osc2.connect(g2).connect(filter);
    filter.connect(engineGain).connect(master);
    osc1.start();
    osc2.start();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  }

  function engine(speed, throttle, boost) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const s = Math.min(Math.abs(speed) / 30, 1);
    const gear = (s * 4) % 1; // fake gear changes
    const f = 42 + s * 70 + gear * 38 + (boost ? 20 : 0);
    osc1.frequency.setTargetAtTime(f, t, 0.06);
    osc2.frequency.setTargetAtTime(f * 0.5, t, 0.06);
    filter.frequency.setTargetAtTime(380 + s * 900 + Math.abs(throttle) * 400, t, 0.08);
    engineGain.gain.setTargetAtTime(0.06 + Math.abs(throttle) * 0.07 + s * 0.05, t, 0.1);
  }

  function bump(strength) {
    if (!ctx || !enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + strength * 80;
    const g = ctx.createGain();
    g.gain.value = Math.min(0.9, strength * 0.09);
    src.connect(f).connect(g).connect(master);
    src.start();
  }

  function chime() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime;
    [660, 880, 1320].forEach((fr, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = fr;
      g.gain.setValueAtTime(0, t + i * 0.08);
      g.gain.linearRampToValueAtTime(0.12, t + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.5);
      o.connect(g).connect(master);
      o.start(t + i * 0.08);
      o.stop(t + i * 0.08 + 0.6);
    });
  }

  function setEnabled(v) {
    enabled = v;
    try {
      localStorage.setItem('drive-sound', v ? 'on' : 'off');
    } catch {}
    if (master) master.gain.setTargetAtTime(v ? 0.5 : 0, ctx.currentTime, 0.05);
  }
  return { start, engine, bump, chime, setEnabled, get enabled() { return enabled; } };
}
