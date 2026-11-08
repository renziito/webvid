import test from "node:test";
import assert from "node:assert/strict";
import { VirtualCameraEngine } from "../engine/virtual-camera-engine.mjs";

test("interpola posición, escala y rotación", () => {
  const frames = [];
  const camera = new VirtualCameraEngine({
    render: (pose, transform) => frames.push({ pose, transform })
  });

  camera.setMotion({
    from: { x: -4, y: 2, scale: 1, rotation: 0 },
    to: { x: 4, y: -2, scale: 1.4, rotation: 2 },
    easing: "linear"
  });

  const pose = camera.renderAt(0.5);
  assert.deepEqual(pose, { x: 0, y: 0, scale: 1.2, rotation: 1 });
  assert.match(frames.at(-1).transform, /scale\(1\.2\)/);
});

test("limita el progreso al rango 0..1", () => {
  const camera = new VirtualCameraEngine();
  camera.setMotion({
    from: { scale: 1 },
    to: { scale: 2 },
    easing: "linear"
  });
  assert.equal(camera.renderAt(-1).scale, 1);
  assert.equal(camera.renderAt(2).scale, 2);
});

test("respeta reduced motion mostrando el encuadre final", () => {
  const camera = new VirtualCameraEngine({ reducedMotion: true });
  camera.setMotion({
    from: { x: -10, scale: 1 },
    to: { x: 10, scale: 1.5 },
    easing: "linear"
  });
  assert.deepEqual(camera.pose, { x: 10, y: 0, scale: 1.5, rotation: 0 });
  camera.setReducedMotion(false);
  assert.deepEqual(camera.pose, { x: -10, y: 0, scale: 1, rotation: 0 });
});

test("rechaza configuraciones inválidas", () => {
  const camera = new VirtualCameraEngine();
  assert.throws(() => camera.setMotion({ to: { scale: 0 } }), /mayor que cero/);
  assert.throws(() => camera.setMotion({ easing: "bounce" }), /easing/);
  assert.throws(() => camera.renderAt(Number.NaN), /finito/);
});

test("genera un transform CSS y permite reset", () => {
  const camera = new VirtualCameraEngine();
  camera.setMotion({
    from: { x: -5, scale: 1 },
    to: { x: 5, scale: 1.2 },
    easing: "linear"
  });
  camera.renderAt(1);
  assert.equal(
    camera.toCssTransform(),
    "translate3d(5%, 0%, 0) scale(1.2) rotate(0deg)"
  );
  camera.reset();
  assert.deepEqual(camera.pose, { x: 0, y: 0, scale: 1, rotation: 0 });
});

test("no permite operaciones después de destruirse", () => {
  const camera = new VirtualCameraEngine();
  camera.destroy();
  assert.throws(() => camera.renderAt(0), /destruido/);
});
