import { analyzeAudio, decodeAudioFile, suggestSceneCues } from "./audio-analyzer.mjs";
import { downloadBlob, exportMp4 } from "./exporter.mjs";

const $ = selector => document.querySelector(selector);
const fileInput = $("#audioFile");
const experienceSelect = $("#experience");
const analyzeButton = $("#analyze");
const playButton = $("#playAudio");
const exportButton = $("#export");
const openRenderButton = $("#openRender");
const canvas = $("#waveform");
const canvasContext = canvas.getContext("2d");
const preview = $("#filmPreview");
const renderChannel = new BroadcastChannel("webvid-studio-render");
const EXPERIENCE_PATH = /^\.\/experiencias\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/;
const AUDIO_EXTENSIONS = /\.(wav|mp3|m4a|aac|ogg|oga|opus|webm|flac)$/i;

const state = {
  catalog: [],
  experience: null,
  metadata: null,
  sceneIds: [],
  file: null,
  audioBuffer: null,
  analysis: null,
  cues: [],
  audioUrl: null,
  audioElement: null,
  activeScene: 0,
  previewReady: false,
  renderWindow: null,
  stage: null,
  isExporting: false
};

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds || 0));
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}

function setStatus(message) {
  $("#analysisState").textContent = String(message).toUpperCase();
}

function setPreview(message) {
  $("#previewStatus").textContent = message;
}

function setExportStatus(message) {
  $("#exportStatus").textContent = message;
}

function safeSlug(value) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || "");
}

function experienceBase(item) {
  const path = item.path.replace(/^\.\//, "").replace(/\/?$/, "/");
  return new URL("../" + path, location.href);
}

function studioExperienceUrl(item) {
  const url = experienceBase(item);
  url.searchParams.set("studio", "1");
  return url.href;
}

function updateExportAvailability(preserveStatus = false) {
  const captureAvailable = Boolean(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const codecsAvailable = typeof VideoEncoder !== "undefined" && typeof AudioEncoder !== "undefined";
  const ready = Boolean(
    state.experience &&
    state.audioBuffer &&
    state.analysis &&
    state.cues.length &&
    state.stage &&
    captureAvailable &&
    codecsAvailable &&
    !state.isExporting
  );
  exportButton.disabled = !ready;
  if (!preserveStatus) {
    if (!captureAvailable) {
      setExportStatus("Este navegador no permite capturar la pestaña. Abre WebVid Studio en un navegador compatible con captura de pantalla.");
    } else if (!codecsAvailable) {
      setExportStatus("Este navegador no ofrece WebCodecs. La exportación H.264/AAC MP4 no está disponible aquí.");
    } else if (!state.stage) {
      setExportStatus("Abre el lienzo de render. Después comparte esa pestaña cuando comience la exportación.");
    } else if (!state.audioBuffer) {
      setExportStatus("Importa una pista de audio para preparar el video.");
    } else if (!state.isExporting) {
      setExportStatus("Listo. Al generar, selecciona la pestaña «Render · WebVid Studio» en el selector del navegador.");
    }
  }
}

function sendSync(index, progress = 0) {
  if (!Number.isInteger(index) || index < 0 || index >= state.sceneIds.length) return;
  state.activeScene = index;
  const boundedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const message = {
    channel: "WEBVID_STUDIO_PREVIEW",
    type: "SET_SCENE",
    index
  };
  if (state.previewReady && preview.contentWindow) {
    preview.contentWindow.postMessage(message, location.origin);
    preview.contentWindow.postMessage({
      channel: "WEBVID_STUDIO_PREVIEW",
      type: "SEEK",
      progress: boundedProgress
    }, location.origin);
  }
  if (state.experience) {
    renderChannel.postMessage({
      type: "SYNC",
      slug: state.experience.slug,
      index,
      progress: boundedProgress
    });
  }
  document.querySelectorAll(".scene-row").forEach((row, rowIndex) => {
    row.classList.toggle("active", rowIndex === index);
  });
}

function syncAtTime(time) {
  if (!state.cues.length || !state.analysis) return;
  let index = 0;
  for (let i = 1; i < state.cues.length; i++) {
    if (time >= state.cues[i]) index = i;
    else break;
  }
  const start = state.cues[index] || 0;
  const end = state.cues[index + 1] ?? state.analysis.duration;
  const progress = end > start ? (time - start) / (end - start) : 0;
  sendSync(index, progress);
}

function setSceneIds(metadata, fallbackCount = 0) {
  if (Array.isArray(metadata?.scene_ids) && metadata.scene_ids.length) {
    state.sceneIds = metadata.scene_ids.map((id, index) => String(id || "SC-" + String(index + 1).padStart(2, "0")));
    return;
  }
  const count = Number(metadata?.scene_count || metadata?.scenes || fallbackCount || 1);
  state.sceneIds = Array.from({ length: Math.max(1, Math.min(100, count)) }, (_, index) =>
    "SC-" + String(index + 1).padStart(2, "0")
  );
}

function updateSceneIdsFromPreview() {
  if (!state.experience || !preview.contentDocument) return;
  const nodes = [...preview.contentDocument.querySelectorAll("[data-scene-id]")];
  if (nodes.length) {
    state.sceneIds = nodes.map((node, index) => node.dataset.sceneId || "SC-" + String(index + 1).padStart(2, "0"));
  } else {
    const count = preview.contentDocument.querySelectorAll(".scene").length;
    if (count) setSceneIds(state.metadata, count);
  }
  $("#sceneCount").textContent = state.sceneIds.length + " escenas";
  if (state.audioBuffer) rebuildAnalysis();
}

async function loadExperience(item) {
  state.experience = item;
  state.metadata = null;
  state.sceneIds = [];
  state.previewReady = false;
  state.stage = null;
  openRenderButton.disabled = true;
  exportButton.disabled = true;
  setPreview("Cargando " + item.title + "…");
  setStatus("CARGANDO EXPERIENCIA");
  $("#sceneTimeline").replaceChildren();
  $("#sceneCount").textContent = "— escenas";

  const metadataUrl = new URL("metadata.json", experienceBase(item));
  try {
    const response = await fetch(metadataUrl, { cache: "no-store" });
    if (response.ok) state.metadata = await response.json();
  } catch {
    state.metadata = null;
  }

  setSceneIds(state.metadata);
  preview.title = "Preview de " + item.title;
  preview.src = studioExperienceUrl(item);
  openRenderButton.disabled = false;
  renderChannel.postMessage({ type: "RESET", slug: item.slug });
  renderChannel.postMessage({ type: "EXPERIENCE_CHANGED", slug: item.slug });
  $("#sceneCount").textContent = state.sceneIds.length + " escenas";
  if (state.audioBuffer) rebuildAnalysis();
  updateExportAvailability();
}

async function loadCatalog() {
  try {
    const response = await fetch("../experiencias.json", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    const items = Array.isArray(data.experiences) ? data.experiences.filter(item =>
      item &&
      typeof item.title === "string" &&
      typeof item.path === "string" &&
      EXPERIENCE_PATH.test(item.path) &&
      safeSlug(item.path.replace(/\/$/, "").split("/").pop())
    ) : [];
    if (!items.length) throw new Error("El catálogo no contiene experiencias compatibles.");

    state.catalog = items.map(item => ({
      ...item,
      slug: item.path.replace(/\/$/, "").split("/").pop()
    }));

    experienceSelect.replaceChildren();
    for (const item of state.catalog) {
      const option = document.createElement("option");
      option.value = item.slug;
      option.textContent = item.title;
      experienceSelect.append(option);
    }
    experienceSelect.disabled = false;
    $("#catalogStatus").textContent = state.catalog.length + " experiencias encontradas en la biblioteca.";
    await loadExperience(state.catalog[0]);
  } catch (error) {
    experienceSelect.replaceChildren();
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No se pudo cargar el catálogo";
    experienceSelect.append(option);
    $("#catalogStatus").textContent = error.message || "No se pudo leer experiencias.json.";
    setPreview("Comprueba la conexión y vuelve a cargar Studio.");
  }
}

function resetAudioElement(file) {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  state.audioElement?.pause();
  state.audioElement = new Audio(state.audioUrl);
  state.audioElement.preload = "auto";
  state.audioElement.addEventListener("ended", () => {
    playButton.textContent = "Escuchar";
    sendSync(state.sceneIds.length ? state.sceneIds.length - 1 : 0, 1);
  });
  state.audioElement.addEventListener("timeupdate", () => syncAtTime(state.audioElement.currentTime));
  state.audioElement.addEventListener("seeked", () => syncAtTime(state.audioElement.currentTime));
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!(file.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name))) {
    setStatus("FORMATO NO VÁLIDO");
    $("#fileName").textContent = "Selecciona un archivo de audio compatible.";
    return;
  }
  if (file.size > 250 * 1024 * 1024) {
    setStatus("ARCHIVO DEMASIADO GRANDE");
    $("#fileName").textContent = "El límite de importación es 250 MB.";
    return;
  }

  state.file = file;
  state.audioBuffer = null;
  state.analysis = null;
  state.cues = [];
  resetAudioElement(file);
  $("#fileName").textContent = file.name;
  $("#audioMeta").textContent = (file.size / 1024 / 1024).toFixed(1) + " MB · audio local";
  analyzeButton.disabled = false;
  playButton.disabled = true;
  exportButton.disabled = true;
  playButton.textContent = "Escuchar";
  $("#waveEmpty").hidden = false;
  $("#waveEmpty").textContent = "Pulsa «Analizar audio» para calcular la forma de onda";
  $("#sceneTimeline").replaceChildren();
  drawWaveform([]);
  setStatus("AUDIO CARGADO");
  setPreview("Analiza la pista para proponer los puntos de sincronización.");
  setExportStatus("Analiza el audio y abre el lienzo de render para preparar el MP4.");
});

function rebuildAnalysis() {
  if (!state.audioBuffer || !state.analysis || !state.sceneIds.length) return;
  state.cues = suggestSceneCues(state.analysis, state.sceneIds.length);
  renderTimeline();
  drawWaveform(state.analysis.waveform);
  $("#durationLabel").textContent = formatTime(state.analysis.duration);
  $("#sceneCount").textContent = state.sceneIds.length + " escenas";
  if (state.audioElement) state.audioElement.currentTime = 0;
  sendSync(0, 0);
  updateExportAvailability();
}

analyzeButton.addEventListener("click", async () => {
  if (!state.file || !state.sceneIds.length) return;
  analyzeButton.disabled = true;
  setStatus("ANALIZANDO AUDIO");
  try {
    state.audioBuffer = await decodeAudioFile(state.file);
    state.analysis = analyzeAudio(state.audioBuffer);
    rebuildAnalysis();
    $("#audioMeta").textContent =
      formatTime(state.analysis.duration) + " · " +
      state.analysis.sampleRate + " Hz · " +
      state.analysis.channels + " canal(es)";
    playButton.disabled = false;
    setStatus("ANÁLISIS COMPLETADO");
    setPreview("Sincronización propuesta para " + state.sceneIds.length + " escenas. Reproduce y ajusta los cortes.");
  } catch (error) {
    state.audioBuffer = null;
    state.analysis = null;
    setStatus("ERROR DE ANÁLISIS");
    setPreview(error.message || "No se pudo analizar el audio.");
  } finally {
    analyzeButton.disabled = false;
    updateExportAvailability();
  }
});

playButton.addEventListener("click", async () => {
  if (!state.audioElement || !state.analysis) return;
  try {
    if (state.audioElement.paused) {
      await state.audioElement.play();
      playButton.textContent = "Pausar";
    } else {
      state.audioElement.pause();
      playButton.textContent = "Escuchar";
    }
  } catch (error) {
    setPreview("No se pudo reproducir el audio: " + error.message);
  }
});

experienceSelect.addEventListener("change", async () => {
  const item = state.catalog.find(entry => entry.slug === experienceSelect.value);
  if (item) await loadExperience(item);
});

preview.addEventListener("load", () => {
  state.previewReady = true;
  updateSceneIdsFromPreview();
  sendSync(0, 0);
  setPreview("Preview real conectado: " + (state.experience?.title || "experiencia") + ".");
});

function renderTimeline() {
  const root = $("#sceneTimeline");
  root.replaceChildren();

  state.cues.forEach((cue, index) => {
    const row = document.createElement("div");
    row.className = "scene-row";

    const title = document.createElement("button");
    title.type = "button";
    title.className = "scene-select";
    title.textContent = state.sceneIds[index];
    title.addEventListener("click", () => {
      sendSync(index, 0);
      if (state.audioElement) {
        state.audioElement.currentTime = cue;
        if (state.audioElement.paused) syncAtTime(cue);
      }
    });

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = index === 0 ? 0 : state.cues[index - 1] + 0.2;
    slider.max = index === state.cues.length - 1
      ? Math.max(0.2, state.analysis.duration - 0.2)
      : state.cues[index + 1] - 0.2;
    slider.step = 0.01;
    slider.value = cue;
    slider.disabled = index === 0 || Number(slider.max) <= Number(slider.min);

    const output = document.createElement("output");
    output.textContent = formatTime(cue);

    slider.addEventListener("input", () => {
      state.cues[index] = Number(slider.value);
      output.textContent = formatTime(state.cues[index]);
      drawWaveform(state.analysis.waveform);
      if (state.audioElement && state.audioElement.paused) {
        state.audioElement.currentTime = state.cues[index];
      }
      syncAtTime(state.audioElement?.currentTime ?? state.cues[index]);
    });

    row.append(title, slider, output);
    root.append(row);
  });
  sendSync(state.activeScene, 0);
}

function drawWaveform(points) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * (window.devicePixelRatio || 1)));
  const height = Math.max(1, Math.floor(rect.height * (window.devicePixelRatio || 1)));
  canvas.width = width;
  canvas.height = height;
  canvasContext.clearRect(0, 0, width, height);
  if (!points.length) return;

  const mid = height / 2;
  const step = width / points.length;
  canvasContext.fillStyle = "#c9a875";
  points.forEach((point, index) => {
    const bar = Math.max(1, point.peak * height * 0.88);
    canvasContext.fillRect(index * step, mid - bar / 2, Math.max(1, step * 0.72), bar);
  });

  if (state.analysis) {
    canvasContext.strokeStyle = "#ffffff";
    canvasContext.globalAlpha = 0.8;
    state.cues.forEach(cue => {
      const x = cue / state.analysis.duration * width;
      canvasContext.beginPath();
      canvasContext.moveTo(x, 0);
      canvasContext.lineTo(x, height);
      canvasContext.stroke();
    });
    canvasContext.globalAlpha = 1;
  }
  $("#waveEmpty").hidden = true;
}

openRenderButton.addEventListener("click", () => {
  if (!state.experience) return;
  const url = new URL("./render.html", location.href);
  url.searchParams.set("experience", state.experience.slug);
  state.stage = null;
  try {
    if (state.renderWindow && !state.renderWindow.closed) {
      state.renderWindow.location.href = url.href;
      state.renderWindow.focus();
    } else {
      state.renderWindow = window.open(url.href, "webvid-studio-render");
    }
    if (!state.renderWindow) {
      setExportStatus("El navegador bloqueó la nueva pestaña. Permite ventanas emergentes para WebVid y vuelve a intentarlo.");
      return;
    }
    setPreview("Lienzo de render abierto. Esperando que comunique su área de captura…");
    setExportStatus("En el lienzo que se abrió, deja cargar la experiencia. Regresa aquí cuando esté listo.");
    updateExportAvailability();
  } catch (error) {
    setExportStatus("No se pudo abrir el lienzo: " + error.message);
  }
});

renderChannel.addEventListener("message", event => {
  const data = event.data;
  if (!data || !state.experience || data.slug !== state.experience.slug) return;
  if (data.type === "STAGE_INFO" && data.stage) {
    state.stage = data.stage;
    setPreview("Lienzo de render conectado: " + state.experience.title + ".");
    updateExportAvailability();
  }
});

exportButton.addEventListener("click", async () => {
  if (!state.audioBuffer || !state.analysis || !state.stage || state.isExporting) return;
  if (!navigator.mediaDevices?.getDisplayMedia) {
    setExportStatus("La captura de pestaña no está disponible en este navegador.");
    return;
  }

  state.isExporting = true;
  exportButton.disabled = true;
  $("#exportProgress").style.width = "0%";
  setExportStatus("Selecciona la pestaña «Render · WebVid Studio» en el selector de captura.");
  renderChannel.postMessage({
    type: "SYNC",
    slug: state.experience.slug,
    index: 0,
    progress: 0
  });

  let stream = null;
  try {
    const duration = state.analysis.duration;
    const estimatedBytes = duration * 8_000_000 / 8;
    if (duration > 90 || estimatedBytes > 90 * 1024 * 1024) {
      throw new Error("Esta versión limita el render en memoria a 90 segundos. Reduce la duración del audio antes de exportar.");
    }
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 60, max: 60 } },
      audio: false
    });

    setExportStatus("Renderizando 1080 × 1920 a 60 FPS. Mantén abierta la pestaña Render.");
    const blob = await exportMp4({
      stream,
      stage: state.stage,
      audioBuffer: state.audioBuffer,
      duration,
      width: 1080,
      height: 1920,
      fps: 60,
      onProgress: progress => {
        syncAtTime(progress * duration);
        $("#exportProgress").style.width = Math.round(progress * 100) + "%";
        setExportStatus("Renderizando y sincronizando escenas… " + Math.round(progress * 100) + "%");
      }
    });

    const filename = (state.experience.slug || "webvid-video") + "-" + new Date().toISOString().slice(0, 10) + ".mp4";
    downloadBlob(blob, filename);
    setExportStatus("MP4 generado: " + filename + " · " + (blob.size / 1024 / 1024).toFixed(1) + " MB.");
    $("#exportProgress").style.width = "100%";
  } catch (error) {
    setExportStatus(error.message || "No se pudo generar el MP4.");
    $("#exportProgress").style.width = "0%";
  } finally {
    if (stream) stream.getTracks().forEach(track => track.stop());
    state.isExporting = false;
    updateExportAvailability(true);
  }
});

window.addEventListener("resize", () => {
  if (state.analysis) drawWaveform(state.analysis.waveform);
});
window.addEventListener("pagehide", () => {
  state.audioElement?.pause();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  renderChannel.close();
});

loadCatalog();
