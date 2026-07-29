/**
 * Bitart Ambient — procedural soundscapes + thocky UI clicks
 * Web Audio API only (no external audio files).
 */
const AmbientAudio = (() => {
  let ctx = null;
  let master = null;
  let muteGain = null;
  let ambientNodes = [];
  let playing = false;
  let muted = false;
  let volume = 0.55;
  let currentScene = null;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = volume;
    muteGain = ctx.createGain();
    muteGain.gain.value = muted ? 0 : 1;
    master.connect(muteGain);
    muteGain.connect(ctx.destination);
    return ctx;
  }

  async function resume() {
    ensure();
    if (ctx.state === "suspended") await ctx.resume();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
  }

  function setMuted(m) {
    muted = m;
    if (muteGain && ctx) {
      muteGain.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
    }
  }

  function stopAmbient() {
    ambientNodes.forEach((n) => {
      try {
        if (n.stop) n.stop();
        if (n.disconnect) n.disconnect();
        if (n._interval) clearInterval(n._interval);
        if (n._raf) cancelAnimationFrame(n._raf);
      } catch (_) { /* ignore */ }
    });
    ambientNodes = [];
  }

  /** Soft noise buffer */
  function noiseBuffer(seconds = 2) {
    const len = ctx.sampleRate * seconds;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function makeNoise(type = "white") {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2);
    src.loop = true;
    // crude pink-ish via filter for non-white
    if (type === "brown" || type === "pink") {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = type === "brown" ? 400 : 1200;
      f.Q.value = 0.5;
      src.connect(f);
      return { source: src, out: f };
    }
    return { source: src, out: src };
  }

  function padTone(freq, type = "sine") {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g);
    o.start();
    return { osc: o, gain: g };
  }

  function buildFireplace() {
    const nodes = [];
    // crackle: filtered noise bursts
    const { source, out } = makeNoise("pink");
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    out.connect(bp);
    bp.connect(g);
    g.connect(master);
    source.start();
    nodes.push(source, bp, g);

    // rumble
    const rumble = makeNoise("brown");
    const rg = ctx.createGain();
    rg.gain.value = 0.08;
    rumble.out.connect(rg);
    rg.connect(master);
    rumble.source.start();
    nodes.push(rumble.source, rg);

    // occasional pops
    const popper = { _interval: null };
    popper._interval = setInterval(() => {
      if (!playing || ctx.state !== "running") return;
      if (Math.random() > 0.55) return;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = 120 + Math.random() * 280;
      const pg = ctx.createGain();
      const t = ctx.currentTime;
      pg.gain.setValueAtTime(0, t);
      pg.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.04, t + 0.01);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08 + Math.random() * 0.12);
      o.connect(pg);
      pg.connect(master);
      o.start(t);
      o.stop(t + 0.25);
    }, 400);
    nodes.push(popper);

    // warm pad
    const pad = padTone(65.4, "sine");
    pad.gain.gain.setTargetAtTime(0.025, ctx.currentTime, 1.5);
    pad.gain.connect(master);
    nodes.push(pad.osc, pad.gain);

    return nodes;
  }

  function buildRainforest() {
    const nodes = [];
    // waterfall hiss
    const n = makeNoise("white");
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2800;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.value = 0.07;
    n.out.connect(hp);
    hp.connect(lp);
    lp.connect(g);
    g.connect(master);
    n.source.start();
    nodes.push(n.source, lp, hp, g);

    // soft forest pad
    [174.6, 220, 261.6].forEach((f, i) => {
      const p = padTone(f, i % 2 ? "triangle" : "sine");
      p.gain.gain.setTargetAtTime(0.012, ctx.currentTime, 2);
      p.gain.connect(master);
      nodes.push(p.osc, p.gain);
    });

    // bird chirps
    const birds = { _interval: null };
    birds._interval = setInterval(() => {
      if (!playing || ctx.state !== "running") return;
      if (Math.random() > 0.35) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      const base = 1800 + Math.random() * 1600;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.08);
      o.frequency.exponentialRampToValueAtTime(base * 0.7, t + 0.18);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0, t);
      bg.gain.linearRampToValueAtTime(0.03, t + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(bg);
      bg.connect(master);
      o.start(t);
      o.stop(t + 0.3);
    }, 900);
    nodes.push(birds);

    return nodes;
  }

  function buildOcean() {
    const nodes = [];
    const n = makeNoise("pink");
    const bp = ctx.createBiquadFilter();
    bp.type = "lowpass";
    bp.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.value = 0.1;
    n.out.connect(bp);
    bp.connect(g);
    g.connect(master);
    n.source.start();
    nodes.push(n.source, bp, g);

    // wave swell LFO on gain
    const swell = { _raf: null };
    const start = ctx.currentTime;
    function tick() {
      if (!playing) return;
      const t = ctx.currentTime - start;
      g.gain.value = 0.06 + 0.05 * (0.5 + 0.5 * Math.sin(t * 0.35));
      swell._raf = requestAnimationFrame(tick);
    }
    swell._raf = requestAnimationFrame(tick);
    nodes.push(swell);

    // gentle drone
    const pad = padTone(98, "sine");
    pad.gain.gain.setTargetAtTime(0.02, ctx.currentTime, 2);
    pad.gain.connect(master);
    const pad2 = padTone(146.8, "triangle");
    pad2.gain.gain.setTargetAtTime(0.01, ctx.currentTime, 2);
    pad2.gain.connect(master);
    nodes.push(pad.osc, pad.gain, pad2.osc, pad2.gain);

    return nodes;
  }

  function buildRainy() {
    const nodes = [];
    // rain
    const n = makeNoise("white");
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const g = ctx.createGain();
    g.gain.value = 0.055;
    n.out.connect(hp);
    hp.connect(g);
    g.connect(master);
    n.source.start();
    nodes.push(n.source, hp, g);

    // soft drops
    const drops = { _interval: null };
    drops._interval = setInterval(() => {
      if (!playing || ctx.state !== "running") return;
      const count = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const t = ctx.currentTime + Math.random() * 0.15;
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = 800 + Math.random() * 2200;
        const dg = ctx.createGain();
        dg.gain.setValueAtTime(0, t);
        dg.gain.linearRampToValueAtTime(0.018, t + 0.005);
        dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
        o.connect(dg);
        dg.connect(master);
        o.start(t);
        o.stop(t + 0.08);
      }
    }, 180);
    nodes.push(drops);

    // lofi pad
    [130.8, 164.8, 196].forEach((f) => {
      const p = padTone(f, "triangle");
      p.gain.gain.setTargetAtTime(0.014, ctx.currentTime, 2);
      p.gain.connect(master);
      nodes.push(p.osc, p.gain);
    });

    return nodes;
  }

  function buildStars() {
    const nodes = [];
    // night air
    const n = makeNoise("brown");
    const g = ctx.createGain();
    g.gain.value = 0.04;
    n.out.connect(g);
    g.connect(master);
    n.source.start();
    nodes.push(n.source, g);

    // campfire crackle (lighter than fireplace)
    const crackle = makeNoise("pink");
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1100;
    bp.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.value = 0.07;
    crackle.out.connect(bp);
    bp.connect(cg);
    cg.connect(master);
    crackle.source.start();
    nodes.push(crackle.source, bp, cg);

    // ethereal pad
    [110, 164.8, 246.9].forEach((f, i) => {
      const p = padTone(f, i === 1 ? "sine" : "triangle");
      p.gain.gain.setTargetAtTime(0.016, ctx.currentTime, 3);
      p.gain.connect(master);
      nodes.push(p.osc, p.gain);
    });

    return nodes;
  }

  function buildSakura() {
    const nodes = [];
    // soft breeze
    const n = makeNoise("pink");
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.045;
    n.out.connect(lp);
    lp.connect(g);
    g.connect(master);
    n.source.start();
    nodes.push(n.source, lp, g);

    // gentle water
    const w = makeNoise("white");
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 600;
    bp.Q.value = 0.4;
    const wg = ctx.createGain();
    wg.gain.value = 0.03;
    w.out.connect(bp);
    bp.connect(wg);
    wg.connect(master);
    w.source.start();
    nodes.push(w.source, bp, wg);

    // pentatonic soft tones
    [261.6, 293.7, 329.6, 392, 440].forEach((f, i) => {
      const p = padTone(f / 2, "sine");
      p.gain.gain.setTargetAtTime(0.008 + (i % 2) * 0.004, ctx.currentTime, 2.5);
      p.gain.connect(master);
      nodes.push(p.osc, p.gain);
    });

    // occasional soft pluck
    const pluck = { _interval: null };
    pluck._interval = setInterval(() => {
      if (!playing || ctx.state !== "running") return;
      if (Math.random() > 0.4) return;
      const notes = [523.25, 587.33, 659.25, 783.99, 880];
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = notes[Math.floor(Math.random() * notes.length)];
      const pg = ctx.createGain();
      pg.gain.setValueAtTime(0, t);
      pg.gain.linearRampToValueAtTime(0.04, t + 0.01);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(pg);
      pg.connect(master);
      o.start(t);
      o.stop(t + 1.4);
    }, 2200);
    nodes.push(pluck);

    return nodes;
  }

  const builders = {
    fireplace: buildFireplace,
    rainforest: buildRainforest,
    ocean: buildOcean,
    rainy: buildRainy,
    stars: buildStars,
    sakura: buildSakura,
  };

  async function play(sceneId) {
    await resume();
    stopAmbient();
    currentScene = sceneId;
    playing = true;
    const build = builders[sceneId] || buildFireplace;
    ambientNodes = build();
  }

  function pause() {
    playing = false;
    stopAmbient();
  }

  function isPlaying() {
    return playing;
  }

  /** Thocky mechanical click */
  async function thock(kind = "key") {
    await resume();
    const t = ctx.currentTime;
    // body thud
    const o = ctx.createOscillator();
    o.type = "sine";
    const g = ctx.createGain();
    if (kind === "play") {
      o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(70, t + 0.06);
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    } else if (kind === "chip") {
      o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(140, t + 0.04);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    } else {
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    }
    o.connect(g);
    g.connect(master);

    // click noise
    const noise = ctx.createBufferSource();
    const nb = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    noise.buffer = nb;
    const ng = ctx.createGain();
    ng.gain.value = kind === "chip" ? 0.04 : 0.06;
    const nf = ctx.createBiquadFilter();
    nf.type = "highpass";
    nf.frequency.value = 2000;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(master);

    o.start(t);
    o.stop(t + 0.12);
    noise.start(t);
    noise.stop(t + 0.03);
  }

  return {
    resume,
    play,
    pause,
    setVolume,
    setMuted,
    isPlaying,
    thock,
    get muted() { return muted; },
    get volume() { return volume; },
  };
})();
