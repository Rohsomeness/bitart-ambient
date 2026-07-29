/**
 * Bitart Ambient — main app controller
 */
(function () {
  const SCENES = [
    { id: "fireplace", name: "Fireplace", file: "assets/scenes/fireplace.jpg", emoji: "🔥" },
    { id: "rainforest", name: "Rainforest", file: "assets/scenes/rainforest.jpg", emoji: "🌿" },
    { id: "ocean", name: "Ocean", file: "assets/scenes/ocean.jpg", emoji: "🌊" },
    { id: "rainy", name: "Rainy Nite", file: "assets/scenes/rainy.jpg", emoji: "🌧️" },
    { id: "stars", name: "Starfield", file: "assets/scenes/stars.jpg", emoji: "✨" },
    { id: "sakura", name: "Sakura", file: "assets/scenes/sakura.jpg", emoji: "🌸" },
  ];

  let index = 0;
  let playing = false;
  let fxOn = true;
  let playerHidden = false;

  // Fullscreen drag state (stored as top-left pixel coords when user has moved it)
  let dragPos = null; // { x, y } | null = default bottom-center
  let dragging = false;
  let dragOffset = { x: 0, y: 0 };

  const $ = (sel) => document.querySelector(sel);
  const sceneArt = $("#sceneArt");
  const lcdScene = $("#lcdScene");
  const lcdStatus = $("#lcdStatus");
  const eq = $("#eq");
  const brandDot = document.querySelector(".brand-dot");
  const playBtn = $("#btnPlay");
  const playIcon = $("#playIcon");
  const volSlider = $("#volSlider");
  const volVal = $("#volVal");
  const btnMute = $("#btnMute");
  const btnFx = $("#btnFx");
  const btnFs = $("#btnFs");
  const btnHide = $("#btnHide");
  const btnShow = $("#btnShow");
  const player = $("#player");
  const playerDrag = $("#playerDrag");
  const gate = $("#gate");
  const sceneRail = document.querySelector(".scene-rail");

  function press(btn) {
    if (!btn) return;
    btn.classList.add("pressed");
    setTimeout(() => btn.classList.remove("pressed"), 120);
  }

  function buildRail() {
    sceneRail.innerHTML = "";
    SCENES.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scene-btn" + (i === index ? " active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", i === index ? "true" : "false");
      btn.setAttribute("aria-label", s.name);
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <img class="scene-thumb" src="${s.file}" alt="" loading="eager" draggable="false" />
        <span class="scene-name">${s.name}</span>
      `;
      btn.addEventListener("click", () => {
        press(btn);
        AmbientAudio.thock("scene");
        selectScene(i);
      });
      sceneRail.appendChild(btn);
    });
  }

  function updateRail() {
    sceneRail.querySelectorAll(".scene-btn").forEach((btn, i) => {
      const on = i === index;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function selectScene(i, { restartAudio = true } = {}) {
    index = (i + SCENES.length) % SCENES.length;
    const scene = SCENES[index];

    sceneArt.classList.add("switching");
    setTimeout(() => {
      sceneArt.src = scene.file;
      sceneArt.alt = scene.name + " bitart scene";
      sceneArt.classList.remove("switching");
    }, 280);

    lcdScene.textContent = scene.name.toUpperCase();
    updateRail();
    ParticleFX.setMode(scene.id);

    if (playing && restartAudio) {
      AmbientAudio.play(scene.id);
    }
  }

  async function setPlaying(on) {
    playing = on;
    document.body.classList.toggle("is-playing", on);
    playBtn.classList.toggle("is-playing", on);
    playIcon.textContent = on ? "❚❚" : "▶";
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    lcdStatus.textContent = on ? "PLAYING" : "PAUSED";
    lcdStatus.classList.toggle("playing", on);
    eq.classList.toggle("live", on);
    brandDot.classList.toggle("live", on);

    if (on) {
      await AmbientAudio.play(SCENES[index].id);
      ParticleFX.start();
    } else {
      AmbientAudio.pause();
    }
  }

  /* ----- Hide / show player ----- */
  function setPlayerHidden(hidden) {
    playerHidden = hidden;
    player.classList.toggle("is-hidden", hidden);
    player.setAttribute("aria-hidden", hidden ? "true" : "false");
    if (hidden) {
      btnShow.hidden = false;
    } else {
      btnShow.hidden = true;
    }
  }

  /* ----- Fullscreen player position ----- */
  function applyPlayerPos() {
    if (!document.body.classList.contains("fullscreen")) {
      player.style.removeProperty("--player-x");
      player.style.removeProperty("--player-y");
      player.style.removeProperty("--player-bottom");
      player.style.removeProperty("--player-transform");
      return;
    }
    if (dragPos) {
      player.style.setProperty("--player-x", dragPos.x + "px");
      player.style.setProperty("--player-y", dragPos.y + "px");
      player.style.setProperty("--player-bottom", "auto");
      player.style.setProperty("--player-transform", "none");
    } else {
      player.style.removeProperty("--player-x");
      player.style.removeProperty("--player-y");
      player.style.removeProperty("--player-bottom");
      player.style.removeProperty("--player-transform");
    }
  }

  function clampPos(x, y) {
    const rect = player.getBoundingClientRect();
    const w = rect.width || 320;
    const h = rect.height || 200;
    const pad = 8;
    const maxX = Math.max(pad, window.innerWidth - w - pad);
    const maxY = Math.max(pad, window.innerHeight - h - pad);
    return {
      x: Math.min(maxX, Math.max(pad, x)),
      y: Math.min(maxY, Math.max(pad, y)),
    };
  }

  function isDragHandleTarget(target) {
    if (!target || !playerDrag.contains(target)) return false;
    // Don't start drag from the hide button
    if (target.closest("#btnHide")) return false;
    return true;
  }

  function onDragStart(e) {
    if (!document.body.classList.contains("fullscreen")) return;
    if (playerHidden) return;
    if (!isDragHandleTarget(e.target)) return;

    // Only primary button / touch
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const rect = player.getBoundingClientRect();
    dragging = true;
    player.classList.add("is-dragging");
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;

    // Switch to explicit coords immediately so there's no jump
    dragPos = { x: rect.left, y: rect.top };
    applyPlayerPos();

    try {
      playerDrag.setPointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!dragging) return;
    dragPos = clampPos(e.clientX - dragOffset.x, e.clientY - dragOffset.y);
    applyPlayerPos();
  }

  function onDragEnd(e) {
    if (!dragging) return;
    dragging = false;
    player.classList.remove("is-dragging");
    try {
      playerDrag.releasePointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }
  }

  playerDrag.addEventListener("pointerdown", onDragStart);
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
  window.addEventListener("pointercancel", onDragEnd);

  window.addEventListener("resize", () => {
    if (dragPos && document.body.classList.contains("fullscreen")) {
      dragPos = clampPos(dragPos.x, dragPos.y);
      applyPlayerPos();
    }
  });

  function enterFullscreenUi() {
    document.body.classList.add("fullscreen");
    applyPlayerPos();
  }

  function exitFullscreenUi() {
    document.body.classList.remove("fullscreen");
    // Keep dragPos so re-entering fullscreen restores last spot
    applyPlayerPos();
  }

  // --- Events ---
  $("#btnEnter").addEventListener("click", async () => {
    press($("#btnEnter"));
    await AmbientAudio.resume();
    AmbientAudio.thock("play");
    gate.classList.add("hidden");
    await setPlaying(true);
  });

  playBtn.addEventListener("click", async () => {
    press(playBtn);
    AmbientAudio.thock("play");
    await setPlaying(!playing);
  });

  $("#btnPrev").addEventListener("click", () => {
    press($("#btnPrev"));
    AmbientAudio.thock("key");
    selectScene(index - 1);
  });

  $("#btnNext").addEventListener("click", () => {
    press($("#btnNext"));
    AmbientAudio.thock("key");
    selectScene(index + 1);
  });

  // Volume + soft stepped thocks while dragging
  let lastVolThock = 0;
  volSlider.addEventListener("input", () => {
    const v = Number(volSlider.value);
    volVal.textContent = String(v);
    AmbientAudio.setVolume(v / 100);
    if (v > 0 && AmbientAudio.muted) {
      AmbientAudio.setMuted(false);
      btnMute.setAttribute("aria-pressed", "false");
      btnMute.textContent = "🔊";
    }
    const now = performance.now();
    if (now - lastVolThock > 55) {
      lastVolThock = now;
      AmbientAudio.thock("chip");
    }
  });

  btnMute.addEventListener("click", () => {
    press(btnMute);
    AmbientAudio.thock("chip");
    const next = !AmbientAudio.muted;
    AmbientAudio.setMuted(next);
    btnMute.setAttribute("aria-pressed", String(next));
    btnMute.textContent = next ? "🔇" : "🔊";
  });

  btnFx.addEventListener("click", () => {
    press(btnFx);
    AmbientAudio.thock("chip");
    fxOn = !fxOn;
    btnFx.setAttribute("aria-pressed", String(fxOn));
    ParticleFX.setEnabled(fxOn);
  });

  btnHide.addEventListener("click", (e) => {
    e.stopPropagation();
    press(btnHide);
    AmbientAudio.thock("chip");
    setPlayerHidden(true);
  });

  btnShow.addEventListener("click", () => {
    AmbientAudio.thock("chip");
    setPlayerHidden(false);
  });

  btnFs.addEventListener("click", async () => {
    press(btnFs);
    AmbientAudio.thock("chip");
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const el = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        enterFullscreenUi();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        exitFullscreenUi();
      }
    } catch (_) {
      // iOS may not support Fullscreen API — fake it with CSS
      if (document.body.classList.contains("fullscreen")) {
        exitFullscreenUi();
      } else {
        enterFullscreenUi();
      }
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      exitFullscreenUi();
    } else {
      enterFullscreenUi();
    }
  });

  // Keyboard
  window.addEventListener("keydown", (e) => {
    if (gate && !gate.classList.contains("hidden")) {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        $("#btnEnter").click();
      }
      return;
    }
    switch (e.code) {
      case "Space":
        e.preventDefault();
        playBtn.click();
        break;
      case "ArrowLeft":
        e.preventDefault();
        $("#btnPrev").click();
        break;
      case "ArrowRight":
        e.preventDefault();
        $("#btnNext").click();
        break;
      case "KeyF":
        btnFs.click();
        break;
      case "KeyM":
        btnMute.click();
        break;
      case "KeyH":
        e.preventDefault();
        AmbientAudio.thock("chip");
        setPlayerHidden(!playerHidden);
        break;
    }
  });

  // Swipe on stage for mobile scene change
  let touchX = null;
  const stage = $("#stage");
  stage.addEventListener("touchstart", (e) => {
    touchX = e.changedTouches[0].clientX;
  }, { passive: true });
  stage.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) < 50) return;
    AmbientAudio.thock("key");
    selectScene(index + (dx < 0 ? 1 : -1));
  }, { passive: true });

  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) return;
    if (playing) await AmbientAudio.resume();
  });

  // Boot
  ParticleFX.init($("#particles"));
  ParticleFX.setEnabled(true);
  buildRail();
  sceneArt.src = SCENES[0].file;
  sceneArt.alt = SCENES[0].name + " bitart scene";
  lcdScene.textContent = SCENES[0].name.toUpperCase();
  ParticleFX.setMode(SCENES[0].id);
  ParticleFX.start();
  AmbientAudio.setVolume(Number(volSlider.value) / 100);
  setPlayerHidden(false);

  SCENES.slice(1).forEach((s) => {
    const img = new Image();
    img.src = s.file;
  });
})();
