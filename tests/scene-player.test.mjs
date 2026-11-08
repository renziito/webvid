import test from "node:test";
import assert from "node:assert/strict";
import { ScenePlayer } from "../engine/scene-player.mjs";

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
}
class FakeImage {
  constructor() {
    this.style = {};
    this.complete = false;
    this.naturalWidth = 0;
    this.onload = null;
    this.onerror = null;
  }
  set src(value) {
    this._src = value;
    this.complete = true;
    this.naturalWidth = 1200;
    queueMicrotask(() => this.onload?.());
  }
  get src() { return this._src; }
  setAttribute() {}
  animate() { return { finished: Promise.resolve(), cancel() {} }; }
  remove() { this.removed = true; }
}
class FakeRoot {
  constructor() {
    this.ownerDocument = { createElement: () => new FakeImage() };
    this.style = {};
    this.className = "";
    this.classList = new FakeClassList();
    this.attributes = {};
    this.listeners = new Map();
    this.children = [];
  }
  appendChild(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
}
const scenes = [
  { id: "SC-01", duration: 2, src: "./assets/one.webp", alt: "Primera imagen", camera: { from: { scale: 1 }, to: { x: -3, scale: 1.1 }, easing: "linear" } },
  { id: "SC-02", duration: 3, src: "./assets/two.webp" }
];

test("conecta motores, inicia escena y expone imagen visual", async () => {
  const root = new FakeRoot();
  const changes = [];
  const player = new ScenePlayer({
    root, scenes, gestures: false, reducedMotion: true,
    onSceneChange: detail => changes.push(detail.scene.id),
    imageFactory: () => new FakeImage()
  });
  await player.start();
  assert.equal(player.currentScene.id, "SC-01");
  assert.equal(player.currentIndex, 0);
  assert.equal(player.image.src, "./assets/one.webp");
  assert.equal(root.children.includes(player.image), true);
  assert.deepEqual(changes, ["SC-01"]);
  assert.equal(player.camera.pose.scale, 1.1);
  const layers = [...root.children];
  player.destroy();
  assert.equal(layers.every(layer => layer.removed), true);
});

test("next y previous cambian exactamente una escena", async () => {
  const root = new FakeRoot();
  const player = new ScenePlayer({ root, scenes, gestures: false, reducedMotion: true, imageFactory: () => new FakeImage() });
  await player.start();
  await player.next();
  assert.equal(player.currentScene.id, "SC-02");
  await player.previous();
  assert.equal(player.currentScene.id, "SC-01");
  player.destroy();
});

test("no avanza automáticamente al completar la duración de cámara", async () => {
  const root = new FakeRoot();
  const frames = [];
  const player = new ScenePlayer({
    root, scenes, gestures: false, reducedMotion: false,
    imageFactory: () => new FakeImage(),
    now: () => 0,
    requestFrame: callback => { frames.push(callback); return frames.length; },
    cancelFrame: () => {}
  });
  await player.start();
  frames[0](3000);
  assert.equal(player.currentIndex, 0);
  assert.equal(frames.length, 1);
  player.destroy();
});

test("ignora navegación fuera de los límites y destruye los módulos", async () => {
  const root = new FakeRoot();
  const player = new ScenePlayer({ root, scenes, gestures: false, reducedMotion: true, imageFactory: () => new FakeImage() });
  assert.equal(await player.previous(), false);
  await player.start(1);
  assert.equal(await player.next(), false);
  player.destroy();
  await assert.rejects(player.next(), /destruido/);
});

test("utiliza dos capas visuales y cambia la capa activa tras la transición", async () => {
  const root = new FakeRoot();
  const player = new ScenePlayer({ root, scenes, gestures: false, reducedMotion: true, imageFactory: () => new FakeImage() });
  await player.start();
  const firstLayer = player.image;
  await player.next();
  assert.equal(root.children.length, 2);
  assert.notEqual(player.image, firstLayer);
  assert.equal(player.image.src, "./assets/two.webp");
  assert.equal(player.image.style.opacity, "1");
  assert.equal(player._spareImage.style.opacity, "0");
  player.destroy();
});
