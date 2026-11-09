const MIN_WAV_BYTES = 44;
const MAX_AUDIO_SECONDS = 60 * 60;

export async function decodeWav(file, AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!(file instanceof Blob)) throw new TypeError("Selecciona un archivo WAV válido.");
  if (!AudioContextClass) throw new Error("Este navegador no ofrece Web Audio API.");
  if (file.size < MIN_WAV_BYTES) throw new Error("El archivo WAV está incompleto o no es válido.");
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const riff = readAscii(view, 0, 4);
  const wave = readAscii(view, 8, 4);
  if (riff !== "RIFF" || wave !== "WAVE") throw new Error("El archivo no tiene una cabecera WAV RIFF válida.");
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(buffer.slice(0));
    if (!decoded.numberOfChannels || !decoded.length || !decoded.sampleRate) throw new Error("El WAV no contiene audio decodificable.");
    if (decoded.duration > MAX_AUDIO_SECONDS) throw new Error("La narración supera el límite de 60 minutos.");
    return decoded;
  } finally {
    await context.close().catch(() => {});
  }
}

export function analyzeAudio(audioBuffer, { buckets = 1200, silenceThreshold = 0.018, minGapSeconds = 0.22 } = {}) {
  if (!audioBuffer || !audioBuffer.numberOfChannels || !audioBuffer.length) throw new TypeError("AudioBuffer no válido.");
  const channelCount = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channelCount; channel++) {
    const data = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) mono[i] += data[i] / channelCount;
  }
  const bucketSize = Math.max(1, Math.ceil(length / buckets));
  const waveform = [];
  for (let start = 0; start < length; start += bucketSize) {
    let peak = 0, sum = 0;
    const end = Math.min(length, start + bucketSize);
    for (let i = start; i < end; i++) {
      const value = Math.abs(mono[i]);
      peak = Math.max(peak, value);
      sum += value * value;
    }
    waveform.push({ peak, rms: Math.sqrt(sum / Math.max(1, end - start)) });
  }
  const frameSeconds = bucketSize / sampleRate;
  const silence = waveform.map((point, index) => ({ time: index * frameSeconds, silent: point.rms < silenceThreshold }));
  const gaps = [];
  let gapStart = null;
  for (const point of silence) {
    if (point.silent && gapStart === null) gapStart = point.time;
    if (!point.silent && gapStart !== null) {
      const end = point.time;
      if (end - gapStart >= minGapSeconds) gaps.push({ start: gapStart, end, midpoint: (gapStart + end) / 2, duration: end - gapStart });
      gapStart = null;
    }
  }
  if (gapStart !== null && audioBuffer.duration - gapStart >= minGapSeconds) {
    gaps.push({ start: gapStart, end: audioBuffer.duration, midpoint: (gapStart + audioBuffer.duration) / 2, duration: audioBuffer.duration - gapStart });
  }
  return {
    duration: audioBuffer.duration,
    sampleRate,
    channels: channelCount,
    waveform,
    gaps,
    rms: Math.sqrt(waveform.reduce((sum, point) => sum + point.rms ** 2, 0) / waveform.length)
  };
}

export function suggestSceneCues(analysis, sceneCount) {
  if (!analysis || !Number.isInteger(sceneCount) || sceneCount < 1) throw new TypeError("Análisis y cantidad de escenas no válidos.");
  const duration = analysis.duration;
  const cues = [0];
  const candidates = analysis.gaps.filter(gap => gap.midpoint > duration * 0.04 && gap.midpoint < duration * 0.96);
  for (let scene = 1; scene < sceneCount; scene++) {
    const target = duration * scene / sceneCount;
    const window = duration / sceneCount * 0.42;
    const nearby = candidates.filter(gap => gap.midpoint >= target - window && gap.midpoint <= target + window);
    const best = nearby.sort((a, b) => Math.abs(a.midpoint - target) - Math.abs(b.midpoint - target))[0];
    const proposed = best ? best.midpoint : target;
    const lower = cues[cues.length - 1] + Math.min(0.5, duration / sceneCount * 0.25);
    cues.push(Math.max(lower, Math.min(duration - 0.25, proposed)));
  }
  return cues;
}

function readAscii(view, offset, length) {
  let result = "";
  for (let i = 0; i < length; i++) result += String.fromCharCode(view.getUint8(offset + i));
  return result;
}
