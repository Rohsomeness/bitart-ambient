/**
 * Canvas particle overlays + scene dynamics
 * Fireworks explode in radial bursts; each scene has living motion.
 */
const ParticleFX = (() => {
  let canvas, ctx;
  let w = 0, h = 0;
  let particles = [];
  let mode = "fireplace";
  let enabled = true;
  let raf = null;
  let running = false;
  let dpr = 1;
  let t0 = 0;
  let burstTimer = 0;
  let lastTs = 0;

  const HUES_FW = [330, 200, 40, 15, 280, 120, 55];

  function init(el) {
    canvas = el;
    ctx = canvas.getContext("2d", { alpha: true });
    resize();
    window.addEventListener("resize", resize, { passive: true });
  }

  function resize() {
    if (!canvas || !canvas.parentElement) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (particles.length === 0 && enabled) seed(mode);
  }

  function setEnabled(on) {
    enabled = on;
    if (!on) {
      particles = [];
      if (ctx) ctx.clearRect(0, 0, w, h);
    } else seed(mode);
  }

  function setMode(id) {
    mode = id;
    // desert tumbleweeds: wait a beat; fireworks: soon
    burstTimer = id === "desert" ? 1.2 + Math.random() * 2 : 0;
    seed(id);
  }

  function countFor(id) {
    const m = w < 640;
    const map = {
      fireplace: m ? 55 : 90,
      rainforest: m ? 30 : 50,
      ocean: m ? 40 : 70,
      rainy: m ? 70 : 120,
      stars: m ? 35 : 55,
      sakura: m ? 40 : 65,
      fireworks: m ? 8 : 12, // base; explosions add more
      moonforest: m ? 30 : 50,
      pets: m ? 14 : 22,
      snowcabin: m ? 50 : 85,
      reef: m ? 35 : 55,
      aurora: m ? 20 : 35,
      coffee: m ? 22 : 36,
      train: m ? 18 : 30,
      onsen: m ? 30 : 48,
      lighthouse: m ? 28 : 45,
      autumn: m ? 40 : 65,
      desert: m ? 30 : 48,
      rooftop: m ? 16 : 28,
      library: m ? 18 : 30,
      meadow: m ? 28 : 45,
      neon: m ? 35 : 55,
      couple: m ? 14 : 22,
      bamboo: m ? 25 : 40,
      attic: m ? 40 : 70,
      mountain: m ? 20 : 35,
      records: m ? 18 : 30,
      greenhouse: m ? 22 : 36,
      booknook: m ? 40 : 70,
      lavender: m ? 24 : 40,
    };
    return map[id] || 30;
  }

  function seed(id) {
    particles = [];
    if (!enabled || !w) return;
    const n = countFor(id);
    for (let i = 0; i < n; i++) particles.push(spawn(id, true));
  }

  function spawnFireworkBurst(cx, cy) {
    const hue = HUES_FW[Math.floor(Math.random() * HUES_FW.length)];
    const n = (w < 640 ? 28 : 48) + Math.floor(Math.random() * 20);
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.2;
      const speed = 1.2 + Math.random() * 3.5;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * speed,
        vy: Math.sin(ang) * speed,
        life: 0.7 + Math.random() * 0.5,
        age: 0,
        size: 1.5 + Math.random() * 2.5,
        hue: hue + (Math.random() - 0.5) * 30,
        kind: "burst",
        g: 0.04 + Math.random() * 0.03,
      });
    }
    // secondary flash sparkles
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 10,
        y: cy + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 0.25,
        age: 0,
        size: 3 + Math.random() * 4,
        hue,
        kind: "flash",
        g: 0,
      });
    }
  }

  function spawnRocket() {
    const x = w * (0.15 + Math.random() * 0.7);
    particles.push({
      x,
      y: h * 0.92,
      vx: (Math.random() - 0.5) * 0.4,
      vy: -4.5 - Math.random() * 2.5,
      life: 1,
      age: 0,
      size: 2,
      hue: HUES_FW[Math.floor(Math.random() * HUES_FW.length)],
      kind: "rocket",
      targetY: h * (0.12 + Math.random() * 0.35),
      g: 0.06,
    });
  }

  function spawn(id, randomY = false) {
    switch (id) {
      case "fireplace":
        return {
          x: w * (0.12 + Math.random() * 0.32),
          y: randomY ? h * (0.4 + Math.random() * 0.45) : h * 0.82,
          vx: (Math.random() - 0.5) * 0.55,
          vy: -0.8 - Math.random() * 1.6,
          life: 0.5 + Math.random() * 0.55,
          age: Math.random(),
          size: 1.5 + Math.random() * 3,
          hue: 15 + Math.random() * 35,
          kind: "ember",
        };
      case "rainforest":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -6,
          vx: 0.2 + Math.random() * 0.35,
          vy: 0.9 + Math.random() * 1.6,
          life: 1,
          age: 0,
          size: 1 + Math.random() * 2,
          kind: Math.random() > 0.65 ? "leaf" : "mist",
        };
      case "ocean":
        return {
          x: Math.random() * w,
          y: h * (0.52 + Math.random() * 0.28),
          vx: 0.5 + Math.random() * 1.2,
          vy: 0,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 4,
          kind: Math.random() > 0.5 ? "wave" : "foam",
          phase: Math.random() * Math.PI * 2,
        };
      case "rainy":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -12,
          vx: -0.6 - Math.random() * 1,
          vy: 9 + Math.random() * 12,
          life: 1,
          age: 0,
          size: 10 + Math.random() * 16,
          kind: "drop",
        };
      case "stars":
        return {
          x: Math.random() * w,
          y: h * (0.45 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.2 - Math.random() * 0.4,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1.5 + Math.random() * 2.5,
          kind: Math.random() > 0.5 ? "fly" : "spark",
        };
      case "sakura":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -8,
          vx: 0.25 + Math.random() * 0.55,
          vy: 0.4 + Math.random() * 0.8,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.05,
          kind: "petal",
        };
      case "fireworks":
        // idle sparkles; rockets/bursts spawned on timer
        return {
          x: Math.random() * w,
          y: Math.random() * h * 0.55,
          vx: 0,
          vy: 0,
          life: 0.4 + Math.random() * 0.6,
          age: Math.random() * 10,
          size: 1 + Math.random() * 1.5,
          hue: 50,
          kind: "star",
        };
      case "moonforest":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : h * (0.45 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * 0.25,
          vy: -0.15 - Math.random() * 0.3,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1.2 + Math.random() * 2.4,
          kind: Math.random() > 0.35 ? "fly" : "mist",
        };
      case "pets":
        return {
          x: w * (0.3 + Math.random() * 0.4),
          y: h * (0.4 + Math.random() * 0.35),
          vx: (Math.random() - 0.5) * 0.12,
          vy: -0.2 - Math.random() * 0.25,
          life: 0.7 + Math.random() * 0.5,
          age: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 3,
          kind: "zz",
        };
      case "snowcabin":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -6,
          vx: -0.15 - Math.random() * 0.25,
          vy: 0.5 + Math.random() * 1.1,
          life: 1,
          age: 0,
          size: 1.5 + Math.random() * 2.5,
          kind: "snow",
        };
      case "reef":
        return {
          x: Math.random() * w,
          y: randomY ? h * (0.2 + Math.random() * 0.7) : h * 0.9,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.4 - Math.random() * 0.8,
          life: 0.8 + Math.random() * 0.5,
          age: 0,
          size: 2 + Math.random() * 4,
          kind: Math.random() > 0.3 ? "bubble" : "fish",
          hue: Math.random() * 360,
        };
      case "aurora":
        return {
          x: Math.random() * w,
          y: h * (0.05 + Math.random() * 0.4),
          vx: 0.15 + Math.random() * 0.35,
          vy: (Math.random() - 0.5) * 0.1,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 20 + Math.random() * 40,
          kind: "curtain",
          hue: Math.random() > 0.5 ? 130 : 280,
        };
      case "coffee":
        return {
          x: w * (0.15 + Math.random() * 0.55),
          y: h * (0.45 + Math.random() * 0.25),
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.35 - Math.random() * 0.4,
          life: 0.6 + Math.random() * 0.5,
          age: 0,
          size: 2 + Math.random() * 3,
          kind: Math.random() > 0.4 ? "steam" : "rainout",
        };
      case "train":
        return {
          x: randomY ? Math.random() * w : w + 10,
          y: h * (0.35 + Math.random() * 0.4),
          vx: -2.5 - Math.random() * 3.5,
          vy: 0,
          life: 1,
          age: 0,
          size: 3 + Math.random() * 8,
          kind: "blur",
        };
      case "onsen":
        return {
          x: w * (0.2 + Math.random() * 0.55),
          y: h * (0.45 + Math.random() * 0.35),
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.4 - Math.random() * 0.6,
          life: 0.7 + Math.random() * 0.5,
          age: 0,
          size: 4 + Math.random() * 10,
          kind: Math.random() > 0.35 ? "steam" : "bubble",
        };
      case "lighthouse":
        return {
          x: Math.random() * w,
          y: h * (0.55 + Math.random() * 0.35),
          vx: 0.4 + Math.random() * 0.8,
          vy: (Math.random() - 0.5) * 0.2,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 3,
          kind: Math.random() > 0.5 ? "foam" : "sparkle",
        };
      case "autumn":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -8,
          vx: 0.3 + Math.random() * 0.7,
          vy: 0.5 + Math.random() * 1,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.06,
          hue: 15 + Math.random() * 40,
          kind: "leaf",
        };
      case "desert": {
        // mostly stars; tumbleweeds spawned on timer too
        if (Math.random() > 0.82) {
          return {
            x: -30 - Math.random() * 40,
            y: h * (0.62 + Math.random() * 0.22),
            vx: 1.2 + Math.random() * 1.8,
            vy: 0,
            life: 1,
            age: Math.random() * Math.PI * 2,
            size: 10 + Math.random() * 14,
            rot: Math.random() * Math.PI * 2,
            spin: 0.08 + Math.random() * 0.12,
            kind: "tumbleweed",
            bounce: Math.random() * Math.PI * 2,
          };
        }
        return {
          x: Math.random() * w,
          y: Math.random() * h * 0.55,
          vx: 0,
          vy: 0,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1 + Math.random() * 2,
          kind: "twinkle",
        };
      }
      case "rooftop":
        return {
          x: Math.random() * w,
          y: h * (0.55 + Math.random() * 0.2),
          vx: 0.1 + Math.random() * 0.25,
          vy: -0.05,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 2,
          kind: "glow",
        };
      case "library":
        return {
          x: w * (0.55 + Math.random() * 0.35),
          y: randomY ? Math.random() * h : -6,
          vx: -0.2 - Math.random() * 0.3,
          vy: 1.2 + Math.random() * 2,
          life: 1,
          age: 0,
          size: 6 + Math.random() * 10,
          kind: "rain",
        };
      case "meadow":
        return {
          x: Math.random() * w,
          y: h * (0.25 + Math.random() * 0.5),
          vx: 0.4 + Math.random() * 0.8,
          vy: Math.sin(Math.random() * 6) * 0.3,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 3 + Math.random() * 4,
          kind: "butterfly",
          hue: Math.random() * 360,
        };
      case "neon":
        return {
          x: Math.random() * w,
          y: Math.random() * h * 0.7,
          vx: (Math.random() - 0.5) * 0.15,
          vy: 0,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1.5 + Math.random() * 3,
          kind: Math.random() > 0.55 ? "neon" : "streak",
          hue: [300, 190, 320, 170][Math.floor(Math.random() * 4)],
        };
      case "couple":
        return {
          x: w * (0.3 + Math.random() * 0.4),
          y: h * (0.35 + Math.random() * 0.35),
          vx: (Math.random() - 0.5) * 0.1,
          vy: -0.18 - Math.random() * 0.2,
          life: 0.7 + Math.random() * 0.5,
          age: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 3,
          kind: "zz",
        };
      case "bamboo":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : h + 4,
          vx: 0.1 + Math.random() * 0.2,
          vy: -0.3 - Math.random() * 0.4,
          life: 1,
          age: 0,
          size: 2 + Math.random() * 4,
          kind: Math.random() > 0.4 ? "mist" : "leaf",
        };
      case "attic":
      case "booknook":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -8,
          vx: -0.25 - Math.random() * 0.35,
          vy: 1.4 + Math.random() * 2.2,
          life: 1,
          age: 0,
          size: 8 + Math.random() * 12,
          kind: "rain",
        };
      case "mountain":
        return {
          x: Math.random() * w,
          y: h * (0.35 + Math.random() * 0.35),
          vx: 0.15 + Math.random() * 0.25,
          vy: (Math.random() - 0.5) * 0.08,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 18 + Math.random() * 30,
          kind: "mist",
        };
      case "records":
      case "greenhouse":
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.12,
          vy: -0.08 - Math.random() * 0.15,
          life: 0.8 + Math.random() * 0.5,
          age: Math.random() * Math.PI * 2,
          size: 1.5 + Math.random() * 2,
          kind: "mote",
        };
      case "lavender":
        return {
          x: Math.random() * w,
          y: h * (0.35 + Math.random() * 0.45),
          vx: 0.2 + Math.random() * 0.4,
          vy: -0.1 - Math.random() * 0.2,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1.5 + Math.random() * 2.5,
          kind: "pollen",
          hue: 270 + Math.random() * 40,
        };
      default:
        return spawn("stars", randomY);
    }
  }

  function drawOverlays(sec) {
    // Scene-specific ambient motion overlays (living scene feel)
    if (mode === "fireplace") {
      const flicker = 0.12 + 0.08 * Math.sin(sec * 11) + 0.05 * Math.sin(sec * 23.7);
      const gx = w * 0.28;
      const gy = h * 0.72;
      const grd = ctx.createRadialGradient(gx, gy, 10, gx, gy, w * 0.35);
      grd.addColorStop(0, `rgba(255, 140, 40, ${flicker})`);
      grd.addColorStop(0.4, `rgba(255, 80, 20, ${flicker * 0.35})`);
      grd.addColorStop(1, "rgba(255, 60, 0, 0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
    }

    if (mode === "ocean" || mode === "lighthouse") {
      // moving wave sheen bands
      for (let i = 0; i < 4; i++) {
        const y =
          h * (0.55 + i * 0.08) +
          Math.sin(sec * (0.8 + i * 0.15) + i) * 6;
        ctx.globalAlpha = 0.06 + 0.04 * Math.sin(sec + i);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, y, w, 3 + (i % 2));
      }
      ctx.globalAlpha = 1;
    }

    if (mode === "pets") {
      // breathing glow over nap area
      const breath = 0.5 + 0.5 * Math.sin(sec * 1.4);
      const cx = w * 0.52;
      const cy = h * 0.58;
      const r = w * (0.12 + breath * 0.025);
      const grd = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      grd.addColorStop(0, `rgba(255, 220, 200, ${0.08 + breath * 0.06})`);
      grd.addColorStop(1, "rgba(255, 200, 180, 0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.3, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (mode === "fireworks") {
      // soft sky flash residual
      // (bursts handle the rest)
    }

    if (mode === "aurora") {
      ctx.globalAlpha = 0.08 + 0.05 * Math.sin(sec * 0.7);
      const grd = ctx.createLinearGradient(0, 0, w, h * 0.5);
      grd.addColorStop(0, "rgba(80, 255, 140, 0)");
      grd.addColorStop(0.4, "rgba(80, 255, 160, 0.5)");
      grd.addColorStop(0.7, "rgba(160, 80, 255, 0.4)");
      grd.addColorStop(1, "rgba(80, 255, 140, 0)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h * 0.55);
      ctx.globalAlpha = 1;
    }

    if (mode === "lighthouse") {
      // rotating light beam
      const ang = sec * 0.45;
      ctx.save();
      ctx.translate(w * 0.42, h * 0.28);
      ctx.rotate(ang);
      const beam = ctx.createLinearGradient(0, 0, w * 0.7, 0);
      beam.addColorStop(0, "rgba(255, 230, 120, 0.22)");
      beam.addColorStop(0.5, "rgba(255, 220, 100, 0.08)");
      beam.addColorStop(1, "rgba(255, 220, 100, 0)");
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(w * 0.75, -h * 0.12);
      ctx.lineTo(w * 0.75, h * 0.12);
      ctx.lineTo(0, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    if (mode === "onsen") {
      // heat shimmer bands
      for (let i = 0; i < 3; i++) {
        const y = h * (0.5 + i * 0.08) + Math.sin(sec * 1.5 + i) * 4;
        ctx.globalAlpha = 0.05;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(w * 0.2, y, w * 0.55, 2);
      }
      ctx.globalAlpha = 1;
    }

    if (mode === "reef") {
      // caustic light flicker
      ctx.globalAlpha = 0.06 + 0.04 * Math.sin(sec * 2.2);
      const g = ctx.createRadialGradient(
        w * (0.3 + 0.1 * Math.sin(sec)), h * 0.2, 10,
        w * 0.5, h * 0.5, w * 0.6
      );
      g.addColorStop(0, "rgba(200, 255, 255, 0.8)");
      g.addColorStop(1, "rgba(200, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  function update(dt) {
    if (!enabled || !ctx) return;
    const sec = (performance.now() - t0) / 1000;
    ctx.clearRect(0, 0, w, h);

    drawOverlays(sec);

    // Fireworks: launch rockets and explode
    if (mode === "fireworks") {
      burstTimer -= dt;
      if (burstTimer <= 0) {
        spawnRocket();
        if (Math.random() < 0.45) spawnRocket();
        burstTimer = 0.7 + Math.random() * 1.4;
      }
    }

    // Desert: occasional tumbleweed roll-through
    if (mode === "desert") {
      burstTimer -= dt;
      if (burstTimer <= 0) {
        particles.push({
          x: -40 - Math.random() * 30,
          y: h * (0.6 + Math.random() * 0.25),
          vx: 1.4 + Math.random() * 2.2,
          vy: 0,
          life: 1,
          age: 0,
          size: 12 + Math.random() * 16,
          rot: Math.random() * Math.PI * 2,
          spin: 0.1 + Math.random() * 0.14,
          kind: "tumbleweed",
          bounce: Math.random() * Math.PI * 2,
        });
        // sometimes a second smaller one
        if (Math.random() < 0.35) {
          particles.push({
            x: -60 - Math.random() * 40,
            y: h * (0.65 + Math.random() * 0.18),
            vx: 1.0 + Math.random() * 1.4,
            vy: 0,
            life: 1,
            age: 0,
            size: 8 + Math.random() * 10,
            rot: Math.random() * Math.PI * 2,
            spin: 0.12 + Math.random() * 0.1,
            kind: "tumbleweed",
            bounce: Math.random() * Math.PI * 2,
          });
        }
        burstTimer = 2.8 + Math.random() * 5.5;
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;

      // --- mode-specific integration ---
      if (mode === "fireworks") {
        if (p.kind === "rocket") {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.04;
          // trail
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = `hsl(${p.hue}, 90%, 70%)`;
          ctx.fillRect(p.x, p.y, 2, 3);
          ctx.globalAlpha = 0.25;
          ctx.fillRect(p.x - 1, p.y + 4, 4, 8);
          if (p.y <= p.targetY || p.vy >= -0.2) {
            spawnFireworkBurst(p.x, p.y);
            particles.splice(i, 1);
          }
          continue;
        }
        if (p.kind === "burst" || p.kind === "flash") {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.g || 0.04;
          p.vx *= 0.99;
          p.life -= dt * (p.kind === "flash" ? 3 : 0.7);
          const a = Math.max(0, p.life);
          ctx.globalAlpha = a;
          ctx.fillStyle = `hsl(${p.hue}, 90%, ${50 + a * 30}%)`;
          const s = p.kind === "flash" ? p.size * a : p.size;
          ctx.fillRect(p.x, p.y, s, s);
          if (p.kind === "burst" && a > 0.4) {
            ctx.globalAlpha = a * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, s * 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
          if (p.life <= 0) particles.splice(i, 1);
          continue;
        }
        // twinkle stars
        ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(p.age * 4));
        ctx.fillStyle = "#fff8d0";
        ctx.fillRect(p.x, p.y, p.size, p.size);
        continue;
      }

      if (mode === "fireplace") {
        p.x += p.vx + Math.sin(p.age * 4) * 0.25;
        p.y += p.vy;
        p.life -= 0.008;
        const a = Math.max(0, p.life);
        ctx.globalAlpha = a;
        ctx.fillStyle = `hsl(${p.hue}, 95%, ${50 + a * 30}%)`;
        ctx.fillRect(p.x, p.y, p.size, p.size * (1 + (1 - a)));
        if (p.life <= 0 || p.y < h * 0.15) particles[i] = spawn("fireplace");
        continue;
      }

      if (mode === "ocean") {
        p.phase += dt * (p.kind === "wave" ? 1.6 : 2.2);
        p.x += p.vx * (0.6 + 0.4 * Math.sin(p.phase));
        // in-out tide motion
        const tide = Math.sin(sec * 0.55 + p.age) * 10;
        p.y = h * (0.58 + (p.kind === "wave" ? 0.08 : 0.15)) + tide + Math.sin(p.phase) * 3;
        ctx.globalAlpha = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(p.phase));
        ctx.fillStyle = "#f5f8ff";
        ctx.fillRect(p.x, p.y, p.size * (p.kind === "wave" ? 6 : 3), p.size * 0.6);
        if (p.x > w + 20) {
          p.x = -20;
          p.y = h * (0.55 + Math.random() * 0.25);
        }
        continue;
      }

      if (mode === "pets") {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.0035;
        const a = Math.max(0, p.life);
        // breathe-synced Z rise
        const breath = 0.5 + 0.5 * Math.sin(sec * 1.4);
        ctx.globalAlpha = a * (0.5 + breath * 0.5);
        ctx.fillStyle = `hsla(280, 35%, 80%, ${a})`;
        ctx.font = `${11 + p.size}px VT323, monospace`;
        ctx.fillText("z", p.x, p.y);
        if (p.life <= 0 || p.y < h * 0.2) particles[i] = spawn("pets");
        continue;
      }

      if (mode === "rainforest") {
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === "leaf") {
          p.x += Math.sin(p.age * 3) * 0.5;
          ctx.globalAlpha = 0.55;
          ctx.fillStyle = `hsl(${95 + Math.sin(p.age) * 25}, 55%, 42%)`;
          ctx.fillRect(p.x, p.y, p.size * 2.5, p.size);
        } else {
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = "#e8fff8";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p.y > h + 12) particles[i] = spawn("rainforest");
        continue;
      }

      if (mode === "rainy" || mode === "library") {
        p.x += p.vx;
        p.y += p.vy;
        ctx.globalAlpha = mode === "library" ? 0.25 : 0.4;
        ctx.strokeStyle = "rgba(170, 200, 255, 0.75)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + p.size * 0.6);
        ctx.stroke();
        if (p.y > h) particles[i] = spawn(mode);
        continue;
      }

      if (mode === "stars" || mode === "moonforest") {
        p.x += p.vx + Math.sin(p.age * 1.5) * 0.12;
        p.y += p.vy;
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.age * 4));
        if (p.kind === "fly" || p.kind === "spark") {
          ctx.globalAlpha = tw;
          ctx.fillStyle = mode === "moonforest" ? "#f0e8a8" : "#e8ff8a";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = tw * 0.28;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 0.08 + 0.06 * Math.sin(p.age);
          ctx.fillStyle = "#d8d0f0";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p.y < -10 || p.x < -10 || p.x > w + 10) particles[i] = spawn(mode);
        continue;
      }

      if (mode === "sakura" || mode === "autumn") {
        p.x += p.vx + Math.sin(p.age * 1.6) * 0.55;
        p.y += p.vy;
        p.rot = (p.rot || 0) + (p.spin || 0.03);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.8;
        if (mode === "sakura") {
          ctx.fillStyle = `hsl(${340 + Math.sin(p.age) * 8}, 70%, 78%)`;
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `hsl(${p.hue || 30}, 75%, 55%)`;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.55);
        }
        ctx.restore();
        if (p.y > h + 12) particles[i] = spawn(mode);
        continue;
      }

      if (mode === "snowcabin") {
        p.x += p.vx + Math.sin(p.age * 2) * 0.2;
        p.y += p.vy;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        if (p.y > h + 8) particles[i] = spawn("snowcabin");
        continue;
      }

      if (mode === "reef") {
        p.x += p.vx + Math.sin(p.age * 2) * 0.3;
        p.y += p.vy;
        if (p.kind === "bubble") {
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = "rgba(220, 250, 255, 0.8)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = `hsl(${p.hue}, 70%, 60%)`;
          ctx.fillRect(p.x, p.y, p.size * 1.8, p.size * 0.7);
        }
        if (p.y < -10 || p.life < 0) particles[i] = spawn("reef");
        p.life -= 0.002;
        continue;
      }

      if (mode === "aurora") {
        p.x += p.vx;
        if (p.x > w + 40) p.x = -40;
        ctx.globalAlpha = 0.08 + 0.06 * Math.sin(p.age * 1.5 + sec);
        ctx.fillStyle = `hsla(${p.hue}, 80%, 60%, 1)`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + Math.sin(sec + p.age) * 8, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (mode === "coffee" || mode === "onsen") {
        p.x += p.vx + Math.sin(p.age * 2) * 0.2;
        p.y += p.vy;
        p.life -= 0.005;
        const a = Math.max(0, p.life);
        if (p.kind === "steam" || p.kind === "bubble") {
          ctx.globalAlpha = a * 0.35;
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = "rgba(160, 190, 255, 0.6)";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 2, p.y + 10);
          ctx.stroke();
        }
        if (p.life <= 0 || p.y < h * 0.15) particles[i] = spawn(mode);
        continue;
      }

      if (mode === "train") {
        p.x += p.vx;
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = `hsla(${30 + Math.random() * 20}, 40%, 50%, 0.5)`;
        ctx.fillRect(p.x, p.y, p.size * 3, p.size);
        if (p.x < -40) particles[i] = spawn("train");
        continue;
      }

      if (mode === "lighthouse") {
        p.x += p.vx;
        p.y += Math.sin(p.age * 2) * 0.3;
        if (p.kind === "foam") {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = "#eef6ff";
          ctx.fillRect(p.x, p.y, p.size * 4, 2);
        } else {
          ctx.globalAlpha = 0.4 + 0.4 * Math.sin(p.age * 5);
          ctx.fillStyle = "#ffe9a0";
          ctx.fillRect(p.x, p.y, 2, 2);
        }
        if (p.x > w + 20) particles[i] = spawn("lighthouse");
        continue;
      }

      if (mode === "desert") {
        if (p.kind === "tumbleweed") {
          p.x += p.vx;
          p.bounce = (p.bounce || 0) + dt * 6;
          p.rot = (p.rot || 0) + (p.spin || 0.1);
          // bounce hop along the sand
          const hop = Math.abs(Math.sin(p.bounce)) * (4 + p.size * 0.15);
          const drawY = p.y - hop;
          ctx.save();
          ctx.translate(p.x, drawY);
          ctx.rotate(p.rot);
          ctx.globalAlpha = 0.75;
          // rough tumbleweed body
          ctx.strokeStyle = "#8a6a3a";
          ctx.fillStyle = "rgba(120, 90, 45, 0.55)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // spiky bits
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const r0 = p.size * 0.25;
            const r1 = p.size * (0.45 + (k % 2) * 0.12);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
            ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
            ctx.stroke();
          }
          // soft ground shadow
          ctx.restore();
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + 2, p.size * 0.4, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          if (p.x > w + 50) particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(p.age * 3 + sec));
        ctx.fillStyle = "#fff6c8";
        ctx.fillRect(p.x, p.y, p.size, p.size);
        continue;
      }

      if (mode === "rooftop") {
        p.x += p.vx * 0.2;
        ctx.globalAlpha = 0.35 + 0.4 * Math.sin(p.age * 2 + sec);
        ctx.fillStyle = "#ffe8a0";
        ctx.beginPath();
        ctx.arc(p.x, h * 0.62 + Math.sin(p.age) * 2, p.size, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (mode === "meadow") {
        p.x += p.vx;
        p.y += Math.sin(p.age * 3) * 0.8;
        if (p.x > w + 20) p.x = -20;
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = `hsl(${p.hue}, 70%, 65%)`;
        // simple butterfly as two ellipses
        ctx.beginPath();
        ctx.ellipse(p.x - p.size * 0.4, p.y, p.size * 0.5, p.size * 0.3, -0.4, 0, Math.PI * 2);
        ctx.ellipse(p.x + p.size * 0.4, p.y, p.size * 0.5, p.size * 0.3, 0.4, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (mode === "neon") {
        p.age += dt;
        if (p.kind === "streak") {
          p.x += 1.5 + Math.random();
          if (p.x > w + 20) p.x = -20;
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = `hsl(${p.hue}, 100%, 60%)`;
          ctx.fillRect(p.x, h * 0.78 + Math.sin(p.age) * 4, p.size * 4, 2);
        } else {
          ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(p.age * 3));
          ctx.fillStyle = `hsl(${p.hue}, 100%, 65%)`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        continue;
      }

      if (mode === "couple") {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.0035;
        const a = Math.max(0, p.life);
        const breath = 0.5 + 0.5 * Math.sin(sec * 1.35);
        ctx.globalAlpha = a * (0.5 + breath * 0.5);
        ctx.fillStyle = `hsla(340, 45%, 80%, ${a})`;
        ctx.font = `${11 + p.size}px VT323, monospace`;
        ctx.fillText("♥", p.x, p.y);
        if (p.life <= 0 || p.y < h * 0.18) particles[i] = spawn("couple");
        continue;
      }

      if (mode === "bamboo") {
        p.x += p.vx + Math.sin(p.age * 2) * 0.2;
        p.y += p.vy;
        if (p.kind === "leaf") {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = "#6dbf6a";
          ctx.fillRect(p.x, p.y, p.size * 1.5, p.size * 0.5);
        } else {
          ctx.globalAlpha = 0.1;
          ctx.fillStyle = "#e8fff0";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p.y < -20) particles[i] = spawn("bamboo");
        continue;
      }

      if (mode === "attic" || mode === "booknook") {
        p.x += p.vx;
        p.y += p.vy;
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = "rgba(170, 200, 255, 0.7)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx, p.y + p.size * 0.5);
        ctx.stroke();
        if (p.y > h) particles[i] = spawn(mode);
        continue;
      }

      if (mode === "mountain") {
        p.x += p.vx;
        if (p.x > w + 40) p.x = -40;
        ctx.globalAlpha = 0.07 + 0.05 * Math.sin(p.age + sec);
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      if (mode === "records" || mode === "greenhouse") {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.003;
        const a = Math.max(0, p.life);
        ctx.globalAlpha = a * 0.45;
        ctx.fillStyle = mode === "greenhouse" ? "#d8ffd0" : "#ffe8b0";
        ctx.fillRect(p.x, p.y, p.size, p.size);
        if (p.life <= 0 || p.y < 0) particles[i] = spawn(mode);
        continue;
      }

      if (mode === "lavender") {
        p.x += p.vx + Math.sin(p.age * 2) * 0.2;
        p.y += p.vy;
        if (p.x > w + 10) p.x = -10;
        ctx.globalAlpha = 0.4 + 0.4 * Math.sin(p.age * 3);
        ctx.fillStyle = `hsl(${p.hue}, 60%, 70%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
    }

    // Cap particle count (fireworks can pile up)
    if (particles.length > 400) {
      particles.splice(0, particles.length - 400);
    }

    ctx.globalAlpha = 1;
  }

  function loop(ts) {
    if (!running) return;
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    t0 = performance.now();
    lastTs = 0;
    resize();
    seed(mode);
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (ctx) ctx.clearRect(0, 0, w, h);
  }

  return { init, start, stop, setMode, setEnabled, resize };
})();
