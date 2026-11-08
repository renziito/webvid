import test from "node:test";
import assert from "node:assert/strict";
import { TransitionEngine } from "../engine/transition-engine.mjs";

class FakeAnimation {
  constructor() {
    this.cancelled = false;
    this.finished = Promise.resolve();
  }
  cancel() { this.cancelled = true; }
}
function layer() {
  return { style: {}, animate() { return new FakeAnimation(); } };
}

test("crossfade anima ambas capas y deja visible la nueva", async () => {
  const from = layer();
  const to = layer();
  const calls = [];
  const engine = new TransitionEngine({
    animate: (element, frames, options) => {
      calls.push({ element, frames, options });
      return new FakeAnimation();
    }
  });
  assert.equal(await engine.play({ from, to, type: "crossfade", duration: 500 }), true);
  assert.equal(calls.length, 2);
  assert.equal(from.style.opacity, "0");
  assert.equal(to.style.opacity, "1");
  assert.equal(calls[0].options.duration, 500);
});

test("admite fade through black, zoom y blur", async () => {
  for (const type of ["fade-through-black", "zoom", "blur"]) {
    const from = layer();
    const to = layer();
    const engine = new TransitionEngine();
    assert.equal(await engine.play({ from, to, type }), true);
    assert.equal(to.style.opacity, "1");
  }
});

test("cut y reduced motion evitan animación", async () => {
  let calls = 0;
  const animate = () => { calls++; return new FakeAnimation(); };
  const from = layer();
  const to = layer();
  const engine = new TransitionEngine({ animate });
  await engine.play({ from, to, type: "cut" });
  await engine.play({ from, to, reducedMotion: true });
  assert.equal(calls, 0);
  assert.equal(to.style.opacity, "1");
});

test("rechaza tipos y duraciones inválidas", async () => {
  const engine = new TransitionEngine();
  await assert.rejects(engine.play({ from: layer(), to: layer(), type: "wipe" }), /no soportado/);
  await assert.rejects(engine.play({ from: layer(), to: layer(), duration: -1 }), /duration/);
});

test("cancela animaciones anteriores cuando comienza una transición nueva", async () => {
  const pending = [];
  const engine = new TransitionEngine({
    animate: () => {
      let rejectFinished;
      const animation = {
        cancelled: false,
        finished: new Promise((_resolve, reject) => { rejectFinished = reject; }),
        cancel() {
          this.cancelled = true;
          const error = new Error("cancelled");
          error.name = "AbortError";
          rejectFinished(error);
        }
      };
      pending.push(animation);
      return animation;
    }
  });
  const from = layer();
  const to = layer();
  const first = engine.play({ from, to });
  await Promise.resolve();
  engine.cancel();
  assert.equal(await first, false);
  assert.equal(pending.every(animation => animation.cancelled), true);
});

test("no permite operar después de destruirse", async () => {
  const engine = new TransitionEngine();
  engine.destroy();
  assert.throws(() => engine.setReducedMotion(true), /destruido/);
});
