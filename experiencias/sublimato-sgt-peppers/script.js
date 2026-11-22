(() => {
  "use strict";

  const scenes = Array.from(document.querySelectorAll(".scene"));
  if (!scenes.length) return;

  let current = Math.max(0, scenes.findIndex(scene => scene.classList.contains("active")));
  let timerId = null;
  let transitionLocked = false;
  let touchStart = null;
  const TRANSITION_MS = 950;

  function pauseAllVideos() {
    scenes.forEach(scene => {
      const video = scene.querySelector("video");
      if (video) video.pause();
    });
  }

  function playCurrentVideo() {
    const video = scenes[current].querySelector("video");
    if (!video) return;
    try { video.currentTime = 0; } catch (_) {}
    const promise = video.play();
    if (promise && typeof promise.catch === "function") promise.catch(() => {});
  }

  function durationFor(scene) {
    const configured = Number(scene.dataset.duration);
    if (Number.isFinite(configured) && configured > 0) return configured;
    const visibleText = scene.querySelector(".copy")?.innerText || "";
    const words = visibleText.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(9000, 5000 + words * 360);
  }

  function scheduleNext() {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => moveTo(current + 1), durationFor(scenes[current]));
  }

  function moveTo(nextIndex) {
    if (transitionLocked || nextIndex < 0 || nextIndex >= scenes.length) return;
    transitionLocked = true;
    window.clearTimeout(timerId);

    scenes[current].classList.remove("active");
    current = nextIndex;
    scenes[current].classList.add("active");

    pauseAllVideos();
    playCurrentVideo();

    window.setTimeout(() => {
      transitionLocked = false;
      scheduleNext();
    }, TRANSITION_MS);
  }

  function onTouchStart(event) {
    const point = event.changedTouches[0];
    touchStart = { x: point.clientX, y: point.clientY };
  }

  function onTouchEnd(event) {
    if (!touchStart) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - touchStart.x;
    const dy = point.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dy) < 48 || Math.abs(dy) < Math.abs(dx)) return;
    moveTo(current + (dy < 0 ? 1 : -1));
  }

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "PageDown") moveTo(current + 1);
    if (event.key === "ArrowUp" || event.key === "PageUp") moveTo(current - 1);
  });

  pauseAllVideos();
  playCurrentVideo();
  scheduleNext();
})();