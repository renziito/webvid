const MEDIABUNNY_URL = "https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/+esm";

let mediaBunnyPromise;

async function loadMediaBunny() {
  if (!mediaBunnyPromise) {
    mediaBunnyPromise = import(MEDIABUNNY_URL).catch(error => {
      mediaBunnyPromise = null;
      throw new Error("No se pudo cargar el motor MP4. Conéctate a internet y vuelve a intentarlo. " + error.message);
    });
  }
  return mediaBunnyPromise;
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

export async function exportMp4({
  stream,
  stage,
  audioBuffer,
  duration,
  width = 1080,
  height = 1920,
  fps = 60,
  onProgress = () => {}
}) {
  if (!stream || !audioBuffer || !stage) throw new TypeError("Faltan el vídeo capturado, el audio o el área de render.");
  if (!Number.isFinite(duration) || duration <= 0) throw new TypeError("La duración del proyecto no es válida.");
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
    throw new Error("Este navegador no ofrece WebCodecs para codificar MP4.");
  }

  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality } = await loadMediaBunny();
  const track = stream.getVideoTracks()[0];
  if (!track || track.readyState !== "live") throw new Error("No se recibió una captura de pantalla activa.");

  const settings = track.getSettings ? track.getSettings() : {};
  if (settings.displaySurface && settings.displaySurface !== "browser") {
    throw new Error("En el selector de pantalla, comparte la pestaña del lienzo Render de WebVid, no todo el monitor.");
  }

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth || !video.videoHeight) {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("La captura no entregó dimensiones de vídeo.")), 8000);
      video.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }

  const scaleX = video.videoWidth / stage.viewportWidth;
  const scaleY = video.videoHeight / stage.viewportHeight;
  const crop = {
    x: Math.round(stage.x * scaleX),
    y: Math.round(stage.y * scaleY),
    width: Math.round(stage.width * scaleX),
    height: Math.round(stage.height * scaleY)
  };
  if (crop.width < 2 || crop.height < 2 ||
      crop.x < 0 || crop.y < 0 ||
      crop.x + crop.width > video.videoWidth + 2 ||
      crop.y + crop.height > video.videoHeight + 2) {
    video.pause();
    video.srcObject = null;
    throw new Error("No se pudo localizar el lienzo dentro de la pestaña compartida. Comparte únicamente la pestaña Render.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo crear el lienzo de exportación.");

  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat(),
    target
  });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    quality: new Quality({ bitrate: 14_000_000 }),
    transform: { frameRate: fps }
  });
  const audioSource = new AudioBufferSource({
    codec: "aac",
    quality: new Quality({ bitrate: 192_000 }),
    transform: { numberOfChannels: 2, sampleRate: 48_000 }
  });

  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);
  await output.start();

  try {
    await audioSource.add(audioBuffer);
    audioSource.close();

    const totalFrames = Math.ceil(duration * fps);
    let frameIndex = 0;
    let startedAt = 0;

    while (frameIndex < totalFrames) {
      await nextFrame();
      if (!startedAt) startedAt = performance.now();
      const elapsed = (performance.now() - startedAt) / 1000;
      const dueFrame = Math.min(totalFrames, Math.max(frameIndex + 1, Math.floor(elapsed * fps) + 1));

      context.fillStyle = "#000000";
      context.fillRect(0, 0, width, height);
      context.drawImage(
        video,
        crop.x, crop.y, crop.width, crop.height,
        0, 0, width, height
      );

      while (frameIndex < dueFrame) {
        await videoSource.add(frameIndex / fps, 1 / fps);
        frameIndex++;
      }
      onProgress(frameIndex / totalFrames);
    }

    videoSource.close();
    await output.finalize();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength < 1024) throw new Error("El archivo MP4 resultante está vacío.");
    return new Blob([buffer], { type: "video/mp4" });
  } catch (error) {
    try { await output.cancel(); } catch {}
    throw error;
  } finally {
    video.pause();
    video.srcObject = null;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
