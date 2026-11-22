(() => {
  const scenes = [...document.querySelectorAll(".scene")];
  let current = 0;
  let startY = 0;
  let startX = 0;
  let locked = false;

  function show(index) {
    if (index < 0 || index >= scenes.length || locked) return;
    locked = true;
    scenes[current].classList.remove("active");
    current = index;
    scenes[current].classList.add("active");

    scenes.forEach((scene, sceneIndex) => {
      const video = scene.querySelector("video");
      if (!video) return;

      if (sceneIndex === current) {
        video.currentTime = 0;
        const playback = video.play();
        if (playback && playback.catch) playback.catch(() => {});
      } else {
        video.pause();
      }
    });

    window.setTimeout(() => { locked = false; }, 780);
  }

  function pointerDown(event) {
    const point = event.changedTouches ? event.changedTouches[0] : event;
    startY = point.clientY;
    startX = point.clientX;
  }

  function pointerUp(event) {
    const point = event.changedTouches ? event.changedTouches[0] : event;
    const deltaY = startY - point.clientY;
    const deltaX = startX - point.clientX;

    if (Math.abs(deltaY) > 45 && Math.abs(deltaY) > Math.abs(deltaX)) {
      show(deltaY > 0 ? current + 1 : current - 1);
    }
  }

  window.addEventListener("touchstart", pointerDown, { passive: true });
  window.addEventListener("touchend", pointerUp, { passive: true });
  window.addEventListener("mousedown", pointerDown);
  window.addEventListener("mouseup", pointerUp);
  window.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "PageDown") show(current + 1);
    if (event.key === "ArrowUp" || event.key === "PageUp") show(current - 1);
  });
})();
