(() => {
  "use strict";
  const scenes = Array.from(document.querySelectorAll(".scene"));
  if (!scenes.length) return;
  let current = Math.max(0, scenes.findIndex(scene => scene.classList.contains("active")));
  let timerId = 0;
  let transitionLocked = false;
  let touchStart = null;
  const TRANSITION_MS = 900;
  function pauseAllVideos() {
    scenes.forEach(scene => {
      const video = scene.querySelector("video");
      if (video) { video.pause(); video.currentTime = 0; }
    });
  }
  function playCurrentVideo() {
    const video = scenes[current].querySelector("video");
    if (!video) return;
    const play = video.play();
    if (play && typeof play.catch === "function") play.catch(() => {});
  }
  function durationFor(scene) {
    const fixed = Number(scene.dataset.duration);
    const text = scene.querySelector(".copy")?.innerText || "";
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const readingTime = 6500 + words * 430;
    return Math.max(Number.isFinite(fixed) && fixed > 0 ? fixed : 0, readingTime, 14000);
  }
  function scheduleNext() {
    window.clearTimeout(timerId);
    if (current === scenes.length - 1) return;
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
    window.setTimeout(() => { transitionLocked = false; scheduleNext(); }, TRANSITION_MS);
  }
  function onTouchStart(event) {
    const p = event.changedTouches[0];
    touchStart = { x: p.clientX, y: p.clientY };
  }
  function onTouchEnd(event) {
    if (!touchStart) return;
    const p = event.changedTouches[0];
    const dx = p.clientX - touchStart.x, dy = p.clientY - touchStart.y;
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