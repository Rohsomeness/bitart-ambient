/**
 * Bitart Ambient — main app controller
 */
(function () {
  const SCENES = [
    { id: "fireplace", name: "Fireplace", file: "assets/scenes/fireplace.jpg" },
    { id: "rainforest", name: "Rainforest", file: "assets/scenes/rainforest.jpg" },
    { id: "ocean", name: "Ocean", file: "assets/scenes/ocean.jpg" },
    { id: "rainy", name: "Rainy Nite", file: "assets/scenes/rainy.jpg" },
    { id: "stars", name: "Starfield", file: "assets/scenes/stars.jpg" },
    { id: "sakura", name: "Sakura", file: "assets/scenes/sakura.jpg" },
    { id: "fireworks", name: "Fireworks", file: "assets/scenes/fireworks.jpg" },
    { id: "moonforest", name: "Moonforest", file: "assets/scenes/moonforest.jpg" },
    { id: "pets", name: "Nap Time", file: "assets/scenes/pets.jpg" },
    { id: "snowcabin", name: "Snow Cabin", file: "assets/scenes/snowcabin.jpg" },
    { id: "reef", name: "Coral Reef", file: "assets/scenes/reef.jpg" },
    { id: "aurora", name: "Aurora", file: "assets/scenes/aurora.jpg" },
    { id: "coffee", name: "Cafe", file: "assets/scenes/coffee.jpg" },
    { id: "train", name: "Train", file: "assets/scenes/train.jpg" },
    { id: "onsen", name: "Onsen", file: "assets/scenes/onsen.jpg" },
    { id: "lighthouse", name: "Lighthouse", file: "assets/scenes/lighthouse.jpg" },
    { id: "autumn", name: "Autumn", file: "assets/scenes/autumn.jpg" },
    { id: "desert", name: "Desert Nite", file: "assets/scenes/desert.jpg" },
    { id: "rooftop", name: "Rooftop", file: "assets/scenes/rooftop.jpg" },
    { id: "library", name: "Library", file: "assets/scenes/library.jpg" },
    { id: "meadow", name: "Meadow", file: "assets/scenes/meadow.jpg" },
  ];

  let index = 0;
  let playing = false;
  let fxOn = true;
  let playerHidden = false;

  // Fullscreen drag: last top-left position in px (null = default bottom-center)
  let savedPos = null;
  let dragging = false;
  let dragMoved = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let activePointerId = null;

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
  const playerHeader = $("#playerDrag");
  const sceneRail = document.querySelector(".scene-rail") || $("#sceneRail");
  let audioUnlocked = false;
  const sceneModal = $("#sceneModal");
  const sceneModalGrid = $("#sceneModalGrid");
  const sceneModalCount = $("#sceneModalCount");
  const btnSceneGrid = $("#btnSceneGrid");
  const btnSceneModalClose = $("#btnSceneModalClose");
  const sceneModalBackdrop = $("#sceneModalBackdrop");

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
        <img class="scene-thumb" src="${s.file}" alt="" loading="lazy" draggable="false" />
        <span class="scene-name">${s.name}</span>
      `;
      btn.addEventListener("click", () => {
        press(btn);
        AmbientAudio.thock("scene");
        selectScene(i);
      });
      sceneRail.appendChild(btn);
    });
    requestAnimationFrame(() => scrollActiveIntoView(false));
  }

  function buildModalGrid() {
    if (!sceneModalGrid) return;
    sceneModalGrid.innerHTML = "";
    if (sceneModalCount) sceneModalCount.textContent = String(SCENES.length);
    SCENES.forEach((s, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "scene-modal-item" + (i === index ? " active" : "");
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", i === index ? "true" : "false");
      btn.setAttribute("aria-label", s.name);
      btn.dataset.index = String(i);
      btn.innerHTML = `
        <img src="${s.file}" alt="" loading="lazy" draggable="false" />
        <span>${s.name}</span>
      `;
      btn.addEventListener("click", () => {
        AmbientAudio.thock("scene");
        selectScene(i);
        setSceneModalOpen(false);
      });
      sceneModalGrid.appendChild(btn);
    });
  }

  function updateModalGrid() {
    if (!sceneModalGrid) return;
    sceneModalGrid.querySelectorAll(".scene-modal-item").forEach((btn, i) => {
      const on = i === index;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function setSceneModalOpen(open) {
    if (!sceneModal) return;
    if (open) {
      updateModalGrid();
      sceneModal.hidden = false;
      sceneModal.setAttribute("aria-hidden", "false");
      document.body.classList.add("scene-modal-open");
      if (btnSceneModalClose) btnSceneModalClose.focus({ preventScroll: true });
    } else {
      sceneModal.hidden = true;
      sceneModal.setAttribute("aria-hidden", "true");
      document.body.classList.remove("scene-modal-open");
    }
  }

  function updateRail() {
    sceneRail.querySelectorAll(".scene-btn").forEach((btn, i) => {
      const on = i === index;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    updateModalGrid();
    scrollActiveIntoView(true);
  }

  function scrollActiveIntoView(smooth) {
    const btn = sceneRail.querySelector(".scene-btn.active");
    if (!btn) return;
    const railRect = sceneRail.getBoundingClientRect();
    const btnRect = btn.getBoundingClientRect();
    const delta =
      btnRect.left - railRect.left - railRect.width / 2 + btnRect.width / 2;
    sceneRail.scrollBy({
      left: delta,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  function scrollRail(dir) {
    const amount = Math.max(120, sceneRail.clientWidth * 0.7) * dir;
    sceneRail.scrollBy({ left: amount, behavior: "smooth" });
  }

  function selectScene(i) {
    index = (i + SCENES.length) % SCENES.length;
    const scene = SCENES[index];

    sceneArt.classList.add("switching");
    sceneArt.dataset.scene = scene.id;
    setTimeout(() => {
      sceneArt.src = scene.file;
      sceneArt.alt = scene.name + " bitart scene";
      sceneArt.classList.remove("switching");
    }, 280);

    lcdScene.textContent = scene.name.toUpperCase();
    document.body.dataset.scene = scene.id;
    updateRail();
    ParticleFX.setMode(scene.id);

    if (playing) {
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
      audioUnlocked = true;
      await AmbientAudio.resume();
      await AmbientAudio.play(SCENES[index].id);
      ParticleFX.start();
    } else {
      AmbientAudio.pause();
      ParticleFX.stop();
    }
  }

  /* ----- Hide / show ----- */
  function setPlayerHidden(hidden) {
    playerHidden = !!hidden;
    document.body.classList.toggle("player-collapsed", playerHidden);
    player.setAttribute("aria-hidden", playerHidden ? "true" : "false");
    btnShow.setAttribute("aria-hidden", playerHidden ? "false" : "true");
  }

  /* ----- Fullscreen position (direct styles — reliable) ----- */
  function isFullscreenUi() {
    return document.body.classList.contains("fullscreen");
  }

  function clearInlinePos() {
    player.style.left = "";
    player.style.top = "";
    player.style.right = "";
    player.style.bottom = "";
    player.style.transform = "";
  }

  function applySavedPos() {
    if (!isFullscreenUi()) {
      clearInlinePos();
      return;
    }
    if (!savedPos) {
      clearInlinePos();
      return;
    }
    const pos = clampPos(savedPos.x, savedPos.y);
    savedPos = pos;
    player.style.left = pos.x + "px";
    player.style.top = pos.y + "px";
    player.style.right = "auto";
    player.style.bottom = "auto";
    player.style.transform = "none";
  }

  function clampPos(x, y) {
    const w = player.offsetWidth || 320;
    const h = player.offsetHeight || 200;
    const pad = 8;
    const maxX = Math.max(pad, window.innerWidth - w - pad);
    const maxY = Math.max(pad, window.innerHeight - h - pad);
    return {
      x: Math.min(maxX, Math.max(pad, x)),
      y: Math.min(maxY, Math.max(pad, y)),
    };
  }

  function canStartDrag(target) {
    if (!isFullscreenUi() || playerHidden || !target) return false;
    // Never drag from interactive controls
    if (target.closest("button, input, a, label, .scene-rail, .controls, .sliders")) {
      return false;
    }
    // Drag from brand, LCD, or empty header area
    return !!(
      target.closest(".brand") ||
      target.closest(".lcd") ||
      target === playerHeader
    );
  }

  function onPointerDown(e) {
    if (!canStartDrag(e.target)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    const rect = player.getBoundingClientRect();
    dragging = true;
    dragMoved = false;
    activePointerId = e.pointerId;
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    player.classList.add("is-dragging");

    // Snap to explicit coords so first move doesn't jump
    savedPos = { x: rect.left, y: rect.top };
    applySavedPos();

    try {
      player.setPointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    const next = clampPos(e.clientX - dragOffsetX, e.clientY - dragOffsetY);
    if (!dragMoved) {
      const dx = next.x - savedPos.x;
      const dy = next.y - savedPos.y;
      if (dx * dx + dy * dy > 9) dragMoved = true;
    }
    savedPos = next;
    player.style.left = next.x + "px";
    player.style.top = next.y + "px";
    player.style.right = "auto";
    player.style.bottom = "auto";
    player.style.transform = "none";
  }

  function onPointerUp(e) {
    if (!dragging || (activePointerId != null && e.pointerId !== activePointerId)) return;
    dragging = false;
    activePointerId = null;
    player.classList.remove("is-dragging");
    try {
      player.releasePointerCapture(e.pointerId);
    } catch (_) { /* ignore */ }
  }

  // Attach drag to player (capture phase not needed; header children bubble)
  player.addEventListener("pointerdown", onPointerDown);
  player.addEventListener("pointermove", onPointerMove);
  player.addEventListener("pointerup", onPointerUp);
  player.addEventListener("pointercancel", onPointerUp);

  window.addEventListener("resize", () => {
    if (savedPos && isFullscreenUi()) applySavedPos();
  });

  function enterFullscreenUi() {
    document.body.classList.add("fullscreen");
    // next frame so layout is measured correctly
    requestAnimationFrame(applySavedPos);
  }

  function exitFullscreenUi() {
    document.body.classList.remove("fullscreen");
    player.classList.remove("is-dragging");
    dragging = false;
    clearInlinePos();
  }

  // --- Events ---
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

  const btnScenePrev = $("#btnScenePrev");
  const btnSceneNext = $("#btnSceneNext");
  if (btnScenePrev) {
    btnScenePrev.addEventListener("click", () => {
      press(btnScenePrev);
      AmbientAudio.thock("chip");
      scrollRail(-1);
    });
  }
  if (btnSceneNext) {
    btnSceneNext.addEventListener("click", () => {
      press(btnSceneNext);
      AmbientAudio.thock("chip");
      scrollRail(1);
    });
  }

  if (btnSceneGrid) {
    btnSceneGrid.addEventListener("click", () => {
      press(btnSceneGrid);
      AmbientAudio.thock("chip");
      setSceneModalOpen(true);
    });
  }
  if (btnSceneModalClose) {
    btnSceneModalClose.addEventListener("click", () => {
      AmbientAudio.thock("chip");
      setSceneModalOpen(false);
    });
  }
  if (sceneModalBackdrop) {
    sceneModalBackdrop.addEventListener("click", () => {
      AmbientAudio.thock("chip");
      setSceneModalOpen(false);
    });
  }

  // Horizontal wheel / trackpad on scene rail
  sceneRail.addEventListener(
    "wheel",
    (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        sceneRail.scrollLeft += e.deltaY;
      }
    },
    { passive: false }
  );

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
    e.preventDefault();
    e.stopPropagation();
    press(btnHide);
    AmbientAudio.thock("chip");
    setPlayerHidden(true);
  });

  // Also support pointerup in case click is swallowed on some devices
  btnHide.addEventListener("pointerup", (e) => {
    if (e.pointerType === "touch") {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  btnShow.addEventListener("click", (e) => {
    e.preventDefault();
    AmbientAudio.thock("chip");
    setPlayerHidden(false);
  });

  btnFs.addEventListener("click", async () => {
    press(btnFs);
    AmbientAudio.thock("chip");
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      if (!active) {
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
      // iOS / blocked Fullscreen API — CSS-only fullscreen
      if (isFullscreenUi()) exitFullscreenUi();
      else enterFullscreenUi();
    }
  });

  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) enterFullscreenUi();
    else exitFullscreenUi();
  });
  document.addEventListener("webkitfullscreenchange", () => {
    if (document.webkitFullscreenElement) enterFullscreenUi();
    else exitFullscreenUi();
  });

  window.addEventListener("keydown", (e) => {
    // Scene library open
    if (sceneModal && !sceneModal.hidden) {
      if (e.code === "Escape" || e.code === "KeyG") {
        e.preventDefault();
        AmbientAudio.thock("chip");
        setSceneModalOpen(false);
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
      case "KeyG":
        e.preventDefault();
        AmbientAudio.thock("chip");
        setSceneModalOpen(true);
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

  // Boot — scene visible but paused until user hits play
  ParticleFX.init($("#particles"));
  ParticleFX.setEnabled(true);
  buildRail();
  buildModalGrid();
  sceneArt.src = SCENES[0].file;
  sceneArt.alt = SCENES[0].name + " bitart scene";
  sceneArt.dataset.scene = SCENES[0].id;
  document.body.dataset.scene = SCENES[0].id;
  lcdScene.textContent = SCENES[0].name.toUpperCase();
  ParticleFX.setMode(SCENES[0].id);
  AmbientAudio.setVolume(Number(volSlider.value) / 100);
  setPlayerHidden(false);
  // Explicit paused state: no particles, no scene motion, no audio
  setPlaying(false);

  SCENES.slice(1).forEach((s) => {
    const img = new Image();
    img.src = s.file;
  });
})();
