const MAX_AUDIO_SECONDS = 60 * 60;

export async function decodeAudioFile(file, AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
  if (!(file instanceof Blob)) throw new TypeError("Selecciona un archivo de audio válido.");
  if (!AudioContextClass) throw new Error("Este navegador no ofrece Web Audio API.");
  if (file.size < 128) throw new Error("El archivo de audio está vacío o incompleto.");
  if (file.size > 250 * 1024 * 1024) throw new Error("El archivo supera el límite de 250 MB.");
  const buffer = await file.arrayBuffer();
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(buffer.slice(0));
    if (!decoded.numberOfChannels || !decoded.length || !decoded.sampleRate) {
      throw new Error("El archivo no contiene audio decodificable.");
    }
    if (decoded.duration > MAX_AUDIO_SECONDS) throw new Error("El audio supera el límite de 60 minutos.");
    return decoded;
  } catch (error) {
    if (error instanceof TypeError) throw error;
    throw new Error("No se pudo decodificar el audio. Prueba WAV, MP3, M4A, AAC, OGG o WebM.");
  } finally {
    await context.close().catch(() => {});
  }
}

export const decodeWav = decodeAudioFile;

export function analyzeAudio(audioBuffer, { buckets = 1200, silenceThreshold = 0.018, minGapSeconds = 0.22 } = {}) {
  if (!audioBuffer || !audioBuffer.numberOfChannels || !audioBuffer.length) {
    throw new TypeError("AudioBuffer no válido.");
  }
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
    let peak = 0;
    let sum = 0;
    const end = Math.min(length, start + bucketSize);
    for (let i = start; i < end; i++) {
      const value = Math.abs(mono[i]);
      peak = Math.max(peak, value);
      sum += value * value;
    }
    waveform.push({ peak, rms: Math.sqrt(sum / Math.max(1, end - start)) });
  }

  const frameSeconds = bucketSize / sampleRate;
  const gaps = [];
  let gapStart = null;
  for (let index = 0; index < waveform.length; index++) {
    const point = waveform[index];
    if (point.rms < silenceThreshold && gapStart === null) gapStart = index * frameSeconds;
    if (point.rms >= silenceThreshold && gapStart !== null) {
      const end = index * frameSeconds;
      if (end - gapStart >= minGapSeconds) {
        gaps.push({ start: gapStart, end, midpoint: (gapStart + end) / 2, duration: end - gapStart });
      }
      gapStart = null;
    }
  }
  if (gapStart !== null && audioBuffer.duration - gapStart >= minGapSeconds) {
    gaps.push({
      start: gapStart,
      end: audioBuffer.duration,
      midpoint: (gapStart + audioBuffer.duration) / 2,
      duration: audioBuffer.duration - gapStart
    });
  }

  return {
    duration: audioBuffer.duration,
    sampleRate,
    channels: channelCount,
    waveform,
    gaps,
    rms: Math.sqrt(waveform.reduce((sum, point) => sum + point.rms ** 2, 0) / Math.max(1, waveform.length))
  };
}

export function suggestSceneCues(analysis, sceneCount) {
  if (!analysis || !Number.isFinite(analysis.duration) || analysis.duration <= 0 ||
      !Number.isInteger(sceneCount) || sceneCount < 1) {
    throw new TypeError("Análisis y cantidad de escenas no válidos.");
  }
  const duration = analysis.duration;
  const cues = [0];
  const candidates = (analysis.gaps || []).filter(gap =>
    Number.isFinite(gap.midpoint) &&
    gap.midpoint > duration * 0.025 &&
    gap.midpoint < duration * 0.975
  );

  for (let scene = 1; scene < sceneCount; scene++) {
    const target = duration * scene / sceneCount;
    const window = duration / sceneCount * 0.45;
    const nearby = candidates
      .filter(gap => gap.midpoint >= target - window && gap.midpoint <= target + window)
      .sort((a, b) => Math.abs(a.midpoint - target) - Math.abs(b.midpoint - target));
    const minimum = cues[cues.length - 1] + Math.min(0.12, duration / sceneCount * 0.2);
    const maximum = duration - (sceneCount - scene) * Math.min(0.12, duration / sceneCount * 0.2);
    const proposed = nearby.length ? nearby[0].midpoint : target;
    cues.push(Math.max(minimum, Math.min(maximum, proposed)));
  }
  return cues;
}
