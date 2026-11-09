import { analyzeAudio, decodeWav, suggestSceneCues } from "./audio-analyzer.mjs";

const $ = selector => document.querySelector(selector);
const fileInput = $("#audioFile");
const analyzeButton = $("#analyze");
const playButton = $("#playAudio");
const exportButton = $("#export");
const canvas = $("#waveform");
const context = canvas.getContext("2d");
const state = { file: null, audio: null, analysis: null, cues: [], audioUrl: null, audioElement: null, scenes: 6 };

function formatTime(seconds) {
  const value = Math.max(0, Math.floor(seconds));
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}

function setStatus(message) { $("#analysisState").textContent = message.toUpperCase(); }
function setPreview(message) { $("#previewStatus").textContent = message; }

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (!/\.wav$/i.test(file.name) && !["audio/wav", "audio/x-wav", "audio/wave"].includes(file.type)) {
    setStatus("FORMATO NO VÁLIDO");
    $("#fileName").textContent = "Selecciona un archivo WAV.";
    return;
  }
  state.file = file;
  state.analysis = null;
  state.audio = null;
  state.cues = [];
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);
  state.audioElement?.pause();
  state.audioElement = new Audio(state.audioUrl);
  state.audioElement.addEventListener("ended", () => { playButton.textContent = "Escuchar"; });
  $("#fileName").textContent = file.name;
  $("#audioMeta").textContent = (file.size / 1024 / 1024).toFixed(1) + " MB · WAV local";
  analyzeButton.disabled = false;
  playButton.disabled = false;
  exportButton.disabled = true;
  exportButton.textContent = "Revisión técnica pendiente";
  setStatus("AUDIO CARGADO");
  setPreview("Analiza la narración para generar los puntos de sincronización.");
  $("#waveEmpty").hidden = false;
  $("#waveEmpty").textContent = "Pulsa «Analizar narración» para calcular la forma de onda";
  drawWaveform([]);
  $("#sceneTimeline").replaceChildren();
});

analyzeButton.addEventListener("click", async () => {
  if (!state.file) return;
  analyzeButton.disabled = true;
  setStatus("ANALIZANDO");
  try {
    state.audio = await decodeWav(state.file);
    state.analysis = analyzeAudio(state.audio);
    state.scenes = await getSceneCount($("#experience").value);
    state.cues = suggestSceneCues(state.analysis, state.scenes);
    renderTimeline();
    drawWaveform(state.analysis.waveform);
    $("#durationLabel").textContent = formatTime(state.analysis.duration);
    $("#sceneCount").textContent = state.scenes + " escenas";
    $("#audioMeta").textContent = formatTime(state.analysis.duration) + " · " + state.analysis.sampleRate + " Hz · " + state.analysis.channels + " canal(es)";
    setStatus("ANÁLISIS COMPLETADO");
    setPreview("Sincronización propuesta. Ajusta los puntos de entrada y revisa la película.");
  } catch (error) {
    setStatus("ERROR DE ANÁLISIS");
    setPreview(error.message || "No se pudo analizar el WAV.");
  } finally {
    analyzeButton.disabled = false;
  }
});

playButton.addEventListener("click", async () => {
  if (!state.audioElement) return;
  if (state.audioElement.paused) {
    await state.audioElement.play();
    playButton.textContent = "Pausar";
  } else {
    state.audioElement.pause();
    playButton.textContent = "Escuchar";
  }
});
$("#experience").addEventListener("change", async () => {
  if (!state.analysis) return;
  state.scenes = await getSceneCount($("#experience").value);
  state.cues = suggestSceneCues(state.analysis, state.scenes);
  renderTimeline();
  $("#sceneCount").textContent = state.scenes + " escenas";
});

function renderTimeline() {
  const root = $("#sceneTimeline");
  root.replaceChildren();
  state.cues.forEach((cue, index) => {
    const row = document.createElement("label");
    row.className = "scene-row";
    const title = document.createElement("span");
    title.textContent = "SC-" + String(index + 1).padStart(2, "0");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = index === 0 ? 0 : state.cues[index - 1] + 0.25;
    slider.max = index === state.cues.length - 1 ? state.analysis.duration : state.cues[index + 1] - 0.25;
    slider.step = 0.01;
    slider.value = cue;
    slider.disabled = index === 0;
    const output = document.createElement("output");
    output.textContent = formatTime(cue);
    slider.addEventListener("input", () => {
      state.cues[index] = Number(slider.value);
      output.textContent = formatTime(state.cues[index]);
      drawWaveform(state.analysis.waveform);
    });
    row.append(title, slider, output);
    root.append(row);
  });
}

function drawWaveform(points) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width * devicePixelRatio));
  const height = Math.max(1, Math.floor(rect.height * devicePixelRatio));
  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  if (!points.length) return;
  const mid = height / 2;
  const step = width / points.length;
  context.fillStyle = "#c9a875";
  points.forEach((point, index) => {
    const bar = Math.max(1, point.peak * height * 0.88);
    context.fillRect(index * step, mid - bar / 2, Math.max(1, step * 0.72), bar);
  });
  context.strokeStyle = "#ffffff";
  context.globalAlpha = 0.8;
  state.cues.forEach(cue => {
    const x = cue / state.analysis.duration * width;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  });
  context.globalAlpha = 1;
  $("#waveEmpty").hidden = true;
}

async function getSceneCount(slug) {
  try {
    const response = await fetch("../experiencias/" + slug + "/metadata.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Metadata unavailable");
    const metadata = await response.json();
    return Number.isInteger(metadata.scenes) && metadata.scenes > 0 ? metadata.scenes : 6;
  } catch { return 6; }
}

window.addEventListener("resize", () => {
  if (state.analysis) drawWaveform(state.analysis.waveform);
});
window.addEventListener("pagehide", () => {
  state.audioElement?.pause();
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
});
