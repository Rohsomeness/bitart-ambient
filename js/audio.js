/**
 * Bitart Ambient — procedural soundscapes + thocky UI clicks
 * Web Audio API only (no external audio files).
 */
const AmbientAudio = (() => {
  let ctx = null;
  let master = null;
  let muteGain = null;
  let uiGain = null; // button thocks — always audible, soft
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

    // Dedicated soft bus for UI clicks (bypasses ambience mute)
    uiGain = ctx.createGain();
    uiGain.gain.value = 0.85;
    uiGain.connect(ctx.destination);
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
        // custom schedulers use stop(); audio nodes may too
        if (typeof n.stop === "function") {
          try { n.stop(); } catch (_) { /* already stopped */ }
        }
        if (typeof n.disconnect === "function" && n.numberOfOutputs !== undefined) {
          try { n.disconnect(); } catch (_) { /* ignore */ }
        }
        if (n._interval != null) {
          clearInterval(n._interval);
          clearTimeout(n._interval);
        }
        if (n._timeout != null) clearTimeout(n._timeout);
        if (n._raf) cancelAnimationFrame(n._raf);
      } catch (_) { /* ignore */ }
    });
    ambientNodes = [];
  }

  /** Soft noise buffer (white / pink / brown) */
  function noiseBuffer(seconds = 2, color = "white") {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (color === "brown") {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    } else if (color === "pink") {
      // Voss-McCartney-ish pink (cheap multi-octave)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  function makeNoise(type = "white") {
    const src = ctx.createBufferSource();
    const color = type === "brown" || type === "pink" ? type : "white";
    src.buffer = noiseBuffer(2.5, color);
    src.loop = true;
    // extra gentle shaping for brown/pink beds
    if (type === "brown") {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 180;
      f.Q.value = 0.4;
      src.connect(f);
      return { source: src, out: f };
    }
    if (type === "pink") {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 1400;
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

  /** One-shot filtered noise burst (crackles / sizzle) */
  function fireNoiseBurst(opts) {
    const {
      duration = 0.05,
      peak = 0.2,
      attack = 0.002,
      highpass = 800,
      lowpass = 6000,
      band = null,
      bandQ = 1.2,
      color = "white",
    } = opts;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    // short non-looped buffer so each burst is unique
    src.buffer = noiseBuffer(Math.max(0.04, duration + 0.02), color);

    let node = src;
    if (highpass) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = highpass;
      hp.Q.value = 0.7;
      node.connect(hp);
      node = hp;
    }
    if (band) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = band;
      bp.Q.value = bandQ;
      node.connect(bp);
      node = bp;
    }
    if (lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = lowpass;
      lp.Q.value = 0.7;
      node.connect(lp);
      node = lp;
    }

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    node.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /**
   * Cozy fireplace: low breathing roar + soft hiss bed,
   * discrete crackles (sap), and deeper log pops — not continuous static.
   */
  function buildFireplace() {
    const nodes = [];

    // --- Deep roar / air feed (very low brown noise, slow swell) ---
    const roar = makeNoise("brown");
    const roarGain = ctx.createGain();
    roarGain.gain.value = 0.055;
    roar.out.connect(roarGain);
    roarGain.connect(master);
    roar.source.start();
    nodes.push(roar.source, roarGain);

    // LFO-ish swell so the fire "breathes" instead of hissing flat
    const swell = { _raf: null };
    const swellStart = performance.now();
    function swellTick() {
      if (!playing) return;
      const sec = (performance.now() - swellStart) / 1000;
      // slow irregular breathing: ~0.04–0.09
      const wave =
        0.062 +
        0.018 * Math.sin(sec * 0.55) +
        0.012 * Math.sin(sec * 1.17 + 1.3) +
        0.008 * Math.sin(sec * 0.23 + 0.7);
      roarGain.gain.setTargetAtTime(Math.max(0.02, wave), ctx.currentTime, 0.08);
      swell._raf = requestAnimationFrame(swellTick);
    }
    swell._raf = requestAnimationFrame(swellTick);
    nodes.push(swell);

    // --- Soft mid combustion bed (quiet — crackles carry the character) ---
    const bed = makeNoise("pink");
    const bedHp = ctx.createBiquadFilter();
    bedHp.type = "highpass";
    bedHp.frequency.value = 200;
    const bedLp = ctx.createBiquadFilter();
    bedLp.type = "lowpass";
    bedLp.frequency.value = 900;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.028;
    bed.out.connect(bedHp);
    bedHp.connect(bedLp);
    bedLp.connect(bedGain);
    bedGain.connect(master);
    bed.source.start();
    nodes.push(bed.source, bedHp, bedLp, bedGain);

    // gentle bed flicker
    const bedFlicker = { _raf: null };
    const bedStart = performance.now();
    function bedTick() {
      if (!playing) return;
      const sec = (performance.now() - bedStart) / 1000;
      const level =
        0.022 +
        0.01 * Math.sin(sec * 2.4) +
        0.006 * Math.sin(sec * 5.1 + 0.4);
      bedGain.gain.setTargetAtTime(Math.max(0.01, level), ctx.currentTime, 0.04);
      bedFlicker._raf = requestAnimationFrame(bedTick);
    }
    bedFlicker._raf = requestAnimationFrame(bedTick);
    nodes.push(bedFlicker);

    // --- Crackles: short bright noise snaps (sap / twigs) ---
    function scheduleCrackle() {
      if (!playing || ctx.state !== "running") return;
      const roll = Math.random();
      if (roll < 0.55) {
        // tiny tick
        fireNoiseBurst({
          duration: 0.018 + Math.random() * 0.025,
          peak: 0.08 + Math.random() * 0.1,
          attack: 0.001,
          highpass: 1800 + Math.random() * 2200,
          lowpass: 7000 + Math.random() * 4000,
          band: 2500 + Math.random() * 3000,
          bandQ: 0.9 + Math.random() * 1.2,
          color: "white",
        });
      } else if (roll < 0.88) {
        // classic mid crackle
        fireNoiseBurst({
          duration: 0.035 + Math.random() * 0.05,
          peak: 0.14 + Math.random() * 0.16,
          attack: 0.0015,
          highpass: 900 + Math.random() * 800,
          lowpass: 4500 + Math.random() * 2500,
          band: 1400 + Math.random() * 1800,
          bandQ: 1.0 + Math.random() * 0.8,
          color: "pink",
        });
      } else {
        // longer sizzle / spit
        fireNoiseBurst({
          duration: 0.08 + Math.random() * 0.12,
          peak: 0.1 + Math.random() * 0.12,
          attack: 0.003,
          highpass: 600,
          lowpass: 3500,
          band: 1200 + Math.random() * 900,
          bandQ: 0.7,
          color: "pink",
        });
        // sometimes a second echo-tick
        if (Math.random() < 0.45) {
          setTimeout(() => {
            if (!playing) return;
            fireNoiseBurst({
              duration: 0.02,
              peak: 0.06 + Math.random() * 0.06,
              attack: 0.001,
              highpass: 2000,
              lowpass: 8000,
              band: 3200,
              bandQ: 1.4,
              color: "white",
            });
          }, 30 + Math.random() * 60);
        }
      }
    }

    // --- Pops: deeper thump + short noise (log settling) ---
    function schedulePop() {
      if (!playing || ctx.state !== "running") return;
      const t = ctx.currentTime;
      const depth = 0.5 + Math.random() * 0.5; // how "thunky"

      // body thump (pitch drops quickly — wood knock)
      const o = ctx.createOscillator();
      o.type = "sine";
      const base = 70 + Math.random() * 90;
      o.frequency.setValueAtTime(base * (1.4 + Math.random() * 0.6), t);
      o.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.06 + Math.random() * 0.05);
      const og = ctx.createGain();
      const thumpPeak = (0.07 + Math.random() * 0.08) * depth;
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(thumpPeak, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + Math.random() * 0.08);
      o.connect(og);
      og.connect(master);
      o.start(t);
      o.stop(t + 0.25);

      // high snap on top of the thump
      fireNoiseBurst({
        duration: 0.025 + Math.random() * 0.03,
        peak: 0.12 + Math.random() * 0.14,
        attack: 0.001,
        highpass: 1200,
        lowpass: 5500,
        band: 2000 + Math.random() * 1500,
        bandQ: 1.5,
        color: "white",
      });

      // occasional ember cascade after a big pop
      if (Math.random() < 0.4) {
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          setTimeout(() => {
            if (!playing) return;
            fireNoiseBurst({
              duration: 0.015 + Math.random() * 0.02,
              peak: 0.05 + Math.random() * 0.07,
              attack: 0.001,
              highpass: 2200,
              lowpass: 9000,
              band: 3000 + Math.random() * 2500,
              bandQ: 1.2,
              color: "white",
            });
          }, 40 + i * (25 + Math.random() * 40));
        }
      }
    }

    // irregular timers (fires aren't metronomic)
    const crackler = { _timeout: null };
    function armCrackle() {
      if (!playing) return;
      scheduleCrackle();
      // denser when "active", sparser when calm — 90–340ms
      crackler._timeout = setTimeout(armCrackle, 90 + Math.random() * 250);
    }
    crackler._timeout = setTimeout(armCrackle, 200);
    nodes.push({
      stop() { clearTimeout(crackler._timeout); crackler._timeout = null; },
    });

    const popper = { _timeout: null };
    function armPop() {
      if (!playing) return;
      // pops are rarer than crackles
      if (Math.random() < 0.75) schedulePop();
      popper._timeout = setTimeout(armPop, 700 + Math.random() * 1700);
    }
    popper._timeout = setTimeout(armPop, 500 + Math.random() * 800);
    nodes.push({
      stop() { clearTimeout(popper._timeout); popper._timeout = null; },
    });

    // warm sub pad (cabin coziness, very quiet)
    const pad = padTone(55, "sine");
    pad.gain.gain.setTargetAtTime(0.018, ctx.currentTime, 1.5);
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

  /**
   * Creamy soft-thock UI click — layered like a squishy mechanical switch:
   * low body thump + warm mid "cream" + short soft plastic tip.
   * kind: "key" | "chip" | "play" | "scene"
   */
  async function thock(kind = "key") {
    await resume();
    if (!uiGain) return;
    const t = ctx.currentTime;
    // tiny random humanize so repeated presses don't sound identical
    const r = () => Math.random();
    const jitter = 0.92 + r() * 0.16;

    // Presets: [bodyHz, creamHz, bodyPeak, creamPeak, noisePeak, bodyDur, creamDur]
    const presets = {
      play:  { body: 95,  cream: 210, bodyPk: 0.22, creamPk: 0.10, noisePk: 0.045, bodyDur: 0.11, creamDur: 0.09, tip: 0.012 },
      scene: { body: 130, cream: 280, bodyPk: 0.14, creamPk: 0.09, noisePk: 0.04,  bodyDur: 0.08, creamDur: 0.07, tip: 0.01 },
      chip:  { body: 150, cream: 340, bodyPk: 0.11, creamPk: 0.08, noisePk: 0.035, bodyDur: 0.065, creamDur: 0.055, tip: 0.008 },
      key:   { body: 120, cream: 260, bodyPk: 0.16, creamPk: 0.09, noisePk: 0.04,  bodyDur: 0.085, creamDur: 0.07, tip: 0.01 },
    };
    const p = presets[kind] || presets.key;

    // Soft lowpass bus so nothing gets harsh
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    tone.Q.value = 0.6;
    const shelf = ctx.createBiquadFilter();
    shelf.type = "lowshelf";
    shelf.frequency.value = 180;
    shelf.gain.value = 3;
    tone.connect(shelf);
    shelf.connect(uiGain);

    // 1) Deep body thock (sine, quick pitch drop)
    const body = ctx.createOscillator();
    body.type = "sine";
    const bodyHz = p.body * jitter;
    body.frequency.setValueAtTime(bodyHz * 1.55, t);
    body.frequency.exponentialRampToValueAtTime(bodyHz * 0.55, t + p.bodyDur * 0.7);
    const bodyG = ctx.createGain();
    bodyG.gain.setValueAtTime(0.0001, t);
    bodyG.gain.exponentialRampToValueAtTime(p.bodyPk, t + 0.003);
    bodyG.gain.exponentialRampToValueAtTime(0.0001, t + p.bodyDur);
    body.connect(bodyG);
    bodyG.connect(tone);
    body.start(t);
    body.stop(t + p.bodyDur + 0.02);

    // 2) Creamy mid body (triangle, slightly delayed — the "squash")
    const cream = ctx.createOscillator();
    cream.type = "triangle";
    const creamHz = p.cream * jitter;
    cream.frequency.setValueAtTime(creamHz * 1.25, t + 0.002);
    cream.frequency.exponentialRampToValueAtTime(creamHz * 0.7, t + p.creamDur);
    const creamG = ctx.createGain();
    creamG.gain.setValueAtTime(0.0001, t);
    creamG.gain.exponentialRampToValueAtTime(p.creamPk, t + 0.006);
    creamG.gain.exponentialRampToValueAtTime(0.0001, t + p.creamDur);
    // soften triangle harmonics
    const creamLp = ctx.createBiquadFilter();
    creamLp.type = "lowpass";
    creamLp.frequency.value = 900;
    creamLp.Q.value = 0.5;
    cream.connect(creamLp);
    creamLp.connect(creamG);
    creamG.connect(tone);
    cream.start(t);
    cream.stop(t + p.creamDur + 0.02);

    // 3) Soft plastic tip — short filtered noise (not a harsh click)
    const nLen = Math.floor(ctx.sampleRate * 0.025);
    const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
    const nData = nBuf.getChannelData(0);
    for (let i = 0; i < nLen; i++) {
      const env = Math.pow(1 - i / nLen, 2.2);
      nData[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = nBuf;
    const nBp = ctx.createBiquadFilter();
    nBp.type = "bandpass";
    nBp.frequency.value = 1800 + r() * 600;
    nBp.Q.value = 0.9;
    const nLp = ctx.createBiquadFilter();
    nLp.type = "lowpass";
    nLp.frequency.value = 4200;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.0001, t);
    nG.gain.exponentialRampToValueAtTime(p.noisePk, t + 0.0015);
    nG.gain.exponentialRampToValueAtTime(0.0001, t + p.tip);
    noise.connect(nBp);
    nBp.connect(nLp);
    nLp.connect(nG);
    nG.connect(tone);
    noise.start(t);
    noise.stop(t + 0.03);

    // 4) Play button gets a little extra sub "thunk"
    if (kind === "play") {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(62 * jitter, t);
      sub.frequency.exponentialRampToValueAtTime(38, t + 0.1);
      const subG = ctx.createGain();
      subG.gain.setValueAtTime(0.0001, t);
      subG.gain.exponentialRampToValueAtTime(0.12, t + 0.004);
      subG.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      sub.connect(subG);
      subG.connect(tone);
      sub.start(t);
      sub.stop(t + 0.16);
    }
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
