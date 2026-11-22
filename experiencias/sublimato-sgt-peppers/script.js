(() => {
  const scenes = [...document.querySelectorAll(".scene")];
  const durations = [8000, 9000, 9000, 9000, 9000, 8000];
  let current = 0;
  let timer = null;
  let touchStart = null;
  let transitionLock = false;

  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => show(current + 1), durations[current]);
  }

  function show(index) {
    if (index < 0 || index >= scenes.length || transitionLock) return;
    transitionLock = true;
    window.clearTimeout(timer);
    scenes[current].classList.remove("active");
    current = index;
    scenes[current].classList.add("active");

    scenes.forEach((scene, sceneIndex) => {
      const video = scene.querySelector("video");
      if (!video) return;
      if (sceneIndex === current) {
        try { video.currentTime = 0; } catch (_) {}
        const playPromise = video.play();
        if (playPromise && playPromise.catch) playPromise.catch(() => {});
      } else {
        video.pause();
      }
    });

    window.setTimeout(() => {
      transitionLock = false;
      schedule();
    }, 850);
  }

  function onTouchStart(event) {
    const point = event.changedTouches[0];
    touchStart = { x: point.clientX, y: point.clientY };
  }

  function onTouchEnd(event) {
    if (!touchStart) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - touchStart.x;
    const dy = point.y - touchStart.y;
    touchStart = null;
    if (Math.abs(dy) > 45 && Math.abs(dy) > Math.abs(dx)) show(current + (dy < 0 ? 1 : -1));
  }

  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  window.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "PageDown") show(current + 1);
    if (event.key === "ArrowUp" || event.key === "PageUp") show(current - 1);
  });

  schedule();
})();