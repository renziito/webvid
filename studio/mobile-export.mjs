import { decodeAudioFile } from "./audio-analyzer.mjs";
import { renderDocumentFrame } from "./dom-renderer.mjs";

const MEDIABUNNY_URL = "https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/+esm";
const $ = selector => document.querySelector(selector);
let active = false;

async function loadMediaBunny() {
  return import(MEDIABUNNY_URL);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getRenderFrame() {
  let renderWindow;
  try {
    renderWindow = window.open("", "webvid-studio-render");
    if (!renderWindow || renderWindow.closed) return null;
    return renderWindow.document.querySelector("#experienceFrame");
  } catch {
    return null;
  }
}

function sceneAtTime(time, cues, duration) {
  let index = 0;
  for (let i = 1; i < cues.length; i++) {
    if (time >= cues[i]) index = i;
    else break;
  }
  const start = cues[index] || 0;
  const end = cues[index + 1] ?? duration;
  return {
    index,
    progress: end > start ? Math.max(0, Math.min(1, (time - start) / (end - start))) : 0
  };
}

async function renderMp4({ iframe, audioBuffer, cues, duration, onProgress }) {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") {
    throw new Error("Este navegador no ofrece WebCodecs. La exportación MP4 directa no está disponible.");
  }
  const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, Quality } = await loadMediaBunny();
  const width = 1080;
  const height = 1920;
  const fps = 30;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat(), target });
  const videoSource = new CanvasSource(canvas, {
    codec: "avc",
    quality: new Quality({ bitrate: 10_000_000 }),
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
    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;
      const scene = sceneAtTime(time, cues, duration);
      await renderDocumentFrame({
        iframe,
        canvas,
        sceneIndex: scene.index,
        progress: scene.progress
      });
      await videoSource.add(time, 1 / fps);
      if (frame % 3 === 0 || frame === totalFrames - 1) {
        onProgress((frame + 1) / totalFrames);
        await wait(0);
      }
    }

    videoSource.close();
    await output.finalize();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength < 1024) throw new Error("El archivo MP4 resultante está vacío.");
    return new Blob([buffer], { type: "video/mp4" });
  } catch (error) {
    try { await output.cancel(); } catch {}
    throw error;
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function handleExport(event) {
  if (active) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const file = $("#audioFile")?.files?.[0];
  const iframe = getRenderFrame();
  const sliders = [...document.querySelectorAll("#sceneTimeline input[type=range]")];
  if (!file || !sliders.length) {
    $("#exportStatus").textContent = "Importa y analiza el audio antes de exportar.";
    return;
  }
  if (!iframe?.contentDocument?.documentElement) {
    $("#exportStatus").textContent = "Abre el lienzo de render y espera a que cargue la experiencia antes de exportar.";
    return;
  }
  active = true;
  const button = $("#export");
  const status = $("#exportStatus");
  const progress = $("#exportProgress");
  button.disabled = true;
  progress.style.width = "0%";

  try {
    status.textContent = "Preparando audio y render directo del documento…";
    const audioBuffer = await decodeAudioFile(file);
    const cues = [0, ...sliders.slice(1).map(slider => Number(slider.value))];
    const duration = audioBuffer.duration;
    if (duration > 90 || duration * 10_000_000 / 8 > 90 * 1024 * 1024) {
      throw new Error("Esta versión limita el render en memoria a 90 segundos. Reduce la duración del audio antes de exportar.");
    }
    status.textContent = "Renderizando escenas directamente, sin captura de pantalla…";
    const slug = $("#experience")?.value || "webvid-video";
    const blob = await renderMp4({
      iframe,
      audioBuffer,
      cues,
      duration,
      onProgress: value => {
        progress.style.width = Math.round(value * 100) + "%";
        status.textContent = "Render directo · " + Math.round(value * 100) + "%";
      }
    });
    const filename = slug + "-" + new Date().toISOString().slice(0, 10) + ".mp4";
    download(blob, filename);
    status.textContent = "MP4 generado: " + filename + " · " + (blob.size / 1024 / 1024).toFixed(1) + " MB.";
    progress.style.width = "100%";
  } catch (error) {
    status.textContent = error.message || "No se pudo generar el MP4 directo.";
    progress.style.width = "0%";
  } finally {
    active = false;
    button.disabled = false;
  }
}

document.addEventListener("click", event => {
  if (event.target?.closest?.("#export")) handleExport(event);
}, true);

document.addEventListener("DOMContentLoaded", () => {
  const status = $("#exportStatus");
  if (status) status.textContent = "Exportación directa preparada. Abre el lienzo Render; no necesitas compartir la pantalla.";
});
