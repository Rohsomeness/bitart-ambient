/**
 * Canvas particle overlays per scene — embers, rain, petals, fireflies, etc.
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
    // reseed if empty
    if (particles.length === 0 && enabled) seed(mode);
  }

  function setEnabled(on) {
    enabled = on;
    if (!on) {
      particles = [];
      if (ctx) ctx.clearRect(0, 0, w, h);
    } else {
      seed(mode);
    }
  }

  function setMode(id) {
    mode = id;
    seed(id);
  }

  function seed(id) {
    particles = [];
    if (!enabled || !w) return;
    const isMobile = w < 640;
    const countMap = {
      fireplace: isMobile ? 28 : 48,
      rainforest: isMobile ? 20 : 36,
      ocean: isMobile ? 16 : 28,
      rainy: isMobile ? 50 : 90,
      stars: isMobile ? 24 : 40,
      sakura: isMobile ? 30 : 50,
      fireworks: isMobile ? 36 : 64,
      moonforest: isMobile ? 22 : 38,
      pets: isMobile ? 12 : 20,
    };
    const n = countMap[id] || 30;
    for (let i = 0; i < n; i++) particles.push(spawn(id, true));
  }

  function spawn(id, randomY = false) {
    switch (id) {
      case "fireplace":
        return {
          x: w * (0.18 + Math.random() * 0.22),
          y: randomY ? h * (0.45 + Math.random() * 0.4) : h * 0.78,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.6 - Math.random() * 1.2,
          life: 0.4 + Math.random() * 0.6,
          age: randomY ? Math.random() : 0,
          size: 1.5 + Math.random() * 2.5,
          hue: 20 + Math.random() * 30,
        };
      case "rainforest":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -4,
          vx: 0.15 + Math.random() * 0.25,
          vy: 0.8 + Math.random() * 1.4,
          life: 1,
          age: 0,
          size: 1 + Math.random() * 1.5,
          kind: Math.random() > 0.7 ? "leaf" : "mist",
        };
      case "ocean":
        return {
          x: Math.random() * w,
          y: h * (0.55 + Math.random() * 0.2),
          vx: 0.3 + Math.random() * 0.5,
          vy: (Math.random() - 0.5) * 0.15,
          life: 1,
          age: Math.random(),
          size: 1 + Math.random() * 2,
          kind: "foam",
        };
      case "rainy":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -10,
          vx: -0.5 - Math.random() * 0.8,
          vy: 8 + Math.random() * 10,
          life: 1,
          age: 0,
          size: 8 + Math.random() * 14,
          kind: "drop",
        };
      case "stars":
        return {
          x: Math.random() * w,
          y: h * (0.55 + Math.random() * 0.4),
          vx: (Math.random() - 0.5) * 0.25,
          vy: -0.15 - Math.random() * 0.35,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1.5 + Math.random() * 2.5,
          kind: Math.random() > 0.55 ? "fly" : "spark",
        };
      case "fireworks": {
        // spark trails + burst fragments
        const kind = Math.random() > 0.55 ? "spark" : "trail";
        const hues = [330, 200, 40, 15, 280];
        return {
          x: w * (0.15 + Math.random() * 0.7),
          y: randomY ? h * (0.1 + Math.random() * 0.45) : h * 0.75,
          vx: (Math.random() - 0.5) * (kind === "spark" ? 2.2 : 0.4),
          vy: kind === "spark" ? (Math.random() - 0.7) * 1.8 : -1.5 - Math.random() * 1.5,
          life: kind === "spark" ? 0.5 + Math.random() * 0.5 : 0.7 + Math.random() * 0.4,
          age: 0,
          size: 1.5 + Math.random() * 2.5,
          hue: hues[Math.floor(Math.random() * hues.length)],
          kind,
        };
      }
      case "moonforest":
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : h * (0.5 + Math.random() * 0.4),
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.12 - Math.random() * 0.25,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 1.2 + Math.random() * 2.2,
          kind: Math.random() > 0.4 ? "fly" : "mist",
        };
      case "pets":
        return {
          x: w * (0.25 + Math.random() * 0.5),
          y: h * (0.35 + Math.random() * 0.4),
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.15 - Math.random() * 0.25,
          life: 0.6 + Math.random() * 0.5,
          age: Math.random() * Math.PI * 2,
          size: 2 + Math.random() * 3,
          kind: "zz",
        };
      case "sakura":
      default:
        return {
          x: Math.random() * w,
          y: randomY ? Math.random() * h : -8,
          vx: 0.2 + Math.random() * 0.5,
          vy: 0.35 + Math.random() * 0.7,
          life: 1,
          age: Math.random() * Math.PI * 2,
          size: 3 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.04,
          kind: "petal",
        };
    }
  }

  function update() {
    if (!enabled || !ctx) return;
    ctx.clearRect(0, 0, w, h);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += 0.016;

      switch (mode) {
        case "fireplace": {
          p.x += p.vx + Math.sin(p.age * 3) * 0.15;
          p.y += p.vy;
          p.life -= 0.006;
          const a = Math.max(0, p.life);
          ctx.globalAlpha = a;
          ctx.fillStyle = `hsl(${p.hue}, 90%, ${55 + a * 20}%)`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          if (p.life <= 0 || p.y < h * 0.2) particles[i] = spawn("fireplace");
          break;
        }
        case "rainforest": {
          p.x += p.vx;
          p.y += p.vy;
          if (p.kind === "leaf") {
            p.x += Math.sin(p.age * 2) * 0.4;
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = `hsl(${100 + Math.sin(p.age) * 20}, 60%, 45%)`;
            ctx.fillRect(p.x, p.y, p.size * 2, p.size);
          } else {
            ctx.globalAlpha = 0.12;
            ctx.fillStyle = "#e8fff8";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            ctx.fill();
          }
          if (p.y > h + 10 || p.x > w + 10) particles[i] = spawn("rainforest");
          break;
        }
        case "ocean": {
          p.x += p.vx;
          p.y += Math.sin(p.age * 2 + p.x * 0.01) * 0.2;
          ctx.globalAlpha = 0.25 + 0.2 * Math.sin(p.age * 3);
          ctx.fillStyle = "#fff8f0";
          ctx.fillRect(p.x, p.y, p.size * 3, p.size);
          if (p.x > w + 10) particles[i] = spawn("ocean");
          break;
        }
        case "rainy": {
          p.x += p.vx;
          p.y += p.vy;
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = "rgba(180, 210, 255, 0.7)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.2, p.y + p.size);
          ctx.stroke();
          if (p.y > h) {
            // splash
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = "rgba(200, 220, 255, 0.5)";
            ctx.fillRect(p.x - 2, h - 4, 4, 2);
            particles[i] = spawn("rainy");
          }
          break;
        }
        case "stars": {
          p.x += p.vx + Math.sin(p.age) * 0.1;
          p.y += p.vy;
          const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(p.age * 4));
          ctx.globalAlpha = tw;
          if (p.kind === "fly") {
            ctx.fillStyle = "#e8ff8a";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = tw * 0.3;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.fillStyle = `hsl(${25 + Math.random() * 10}, 100%, 60%)`;
            ctx.fillRect(p.x, p.y, p.size, p.size);
          }
          if (p.y < h * 0.3 || p.x < 0 || p.x > w) particles[i] = spawn("stars");
          break;
        }
        case "sakura": {
          p.x += p.vx + Math.sin(p.age * 1.5) * 0.5;
          p.y += p.vy;
          p.rot += p.spin;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = `hsl(${340 + Math.sin(p.age) * 8}, 70%, ${78 + Math.sin(p.age * 2) * 8}%)`;
          // petal diamond
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          if (p.y > h + 10 || p.x > w + 20) particles[i] = spawn("sakura");
          break;
        }
        case "fireworks": {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.02; // gravity
          p.life -= p.kind === "spark" ? 0.012 : 0.008;
          const a = Math.max(0, p.life);
          ctx.globalAlpha = a;
          ctx.fillStyle = `hsl(${p.hue}, 85%, ${55 + a * 25}%)`;
          ctx.fillRect(p.x, p.y, p.size, p.size);
          if (p.kind === "spark" && a > 0.3) {
            ctx.globalAlpha = a * 0.35;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (p.life <= 0 || p.y > h + 10) particles[i] = spawn("fireworks");
          break;
        }
        case "moonforest": {
          p.x += p.vx + Math.sin(p.age * 1.2) * 0.12;
          p.y += p.vy;
          const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.age * 3.5));
          if (p.kind === "fly") {
            ctx.globalAlpha = tw;
            ctx.fillStyle = "#f0e6a0";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = tw * 0.25;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 2.8, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.globalAlpha = 0.08 + 0.06 * Math.sin(p.age);
            ctx.fillStyle = "#d8d0f0";
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
            ctx.fill();
          }
          if (p.y < -10 || p.x < -10 || p.x > w + 10) particles[i] = spawn("moonforest");
          break;
        }
        case "pets": {
          p.x += p.vx + Math.sin(p.age) * 0.08;
          p.y += p.vy;
          p.life -= 0.004;
          const a = Math.max(0, p.life);
          ctx.globalAlpha = a * 0.7;
          ctx.fillStyle = `hsla(280, 40%, 75%, ${a})`;
          // floating Zzz
          ctx.font = `${10 + p.size}px VT323, monospace`;
          ctx.fillText("z", p.x, p.y);
          if (p.life <= 0 || p.y < h * 0.15) particles[i] = spawn("pets");
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  function loop() {
    if (!running) return;
    update();
    raf = requestAnimationFrame(loop);
  }

  function start() {
    if (running) return;
    running = true;
    resize();
    seed(mode);
    loop();
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    if (ctx) ctx.clearRect(0, 0, w, h);
  }

  return { init, start, stop, setMode, setEnabled, resize };
})();
