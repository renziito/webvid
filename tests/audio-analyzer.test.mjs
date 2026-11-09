import test from "node:test";
import assert from "node:assert/strict";
import { analyzeAudio, suggestSceneCues } from "../studio/audio-analyzer.mjs";

function makeBuffer(samples, sampleRate = 100) {
  return {
    numberOfChannels: 1,
    length: samples.length,
    sampleRate,
    duration: samples.length / sampleRate,
    getChannelData() { return Float32Array.from(samples); }
  };
}

test("analyzeAudio returns duration, RMS waveform and silence intervals", () => {
  const samples = [
    ...Array(100).fill(0.4),
    ...Array(80).fill(0.001),
    ...Array(120).fill(0.3)
  ];
  const result = analyzeAudio(makeBuffer(samples), { buckets: 30, silenceThreshold: 0.02, minGapSeconds: 0.3 });
  assert.equal(result.duration, 3);
  assert.equal(result.sampleRate, 100);
  assert.equal(result.channels, 1);
  assert.ok(result.waveform.length > 0);
  assert.ok(result.waveform.some(point => point.peak > 0.2));
  assert.ok(result.gaps.some(gap => gap.duration >= 0.3));
});

test("suggestSceneCues returns ordered scene boundaries beginning at zero", () => {
  const analysis = {
    duration: 60,
    gaps: [
      { midpoint: 9.8, duration: 0.4 },
      { midpoint: 20.2, duration: 0.5 },
      { midpoint: 30.1, duration: 0.3 },
      { midpoint: 39.7, duration: 0.4 },
      { midpoint: 50.2, duration: 0.6 }
    ]
  };
  const cues = suggestSceneCues(analysis, 6);
  assert.equal(cues.length, 6);
  assert.equal(cues[0], 0);
  for (let i = 1; i < cues.length; i++) assert.ok(cues[i] > cues[i - 1]);
  assert.ok(cues.every(cue => cue < analysis.duration));
});

test("suggestSceneCues rejects invalid scene counts", () => {
  assert.throws(() => suggestSceneCues({ duration: 10, gaps: [] }, 0), TypeError);
});
