import test from "node:test";
import assert from "node:assert/strict";
import { SceneEngine } from "../engine/scene-engine.mjs";

const scenes = [
  { id: "SC-01", duration: 8, assets: ["assets/one.webp"] },
  { id: "SC-02", duration: 12, assets: ["assets/two.webp"] },
  { id: "SC-03", duration: 10 }
];

test("carga la primera escena y mantiene el estado", async () => {
  const prepared = [];
  const activated = [];
  const engine = new SceneEngine({
    scenes,
    prepareScene: async scene => prepared.push(scene.id),
    activateScene: async scene => activated.push(scene.id)
  });
  const result = await engine.start();
  assert.equal(result.scene.id, "SC-01");
  assert.deepEqual(prepared, ["SC-01"]);
  assert.deepEqual(activated, ["SC-01"]);
  assert.equal(engine.currentIndex, 0);
  assert.equal(engine.getSnapshot().status, "ready");
});

test("avanza y retrocede una escena por operación", async () => {
  const engine = new SceneEngine({ scenes });
  await engine.start();
  await engine.next();
  assert.equal(engine.currentScene.id, "SC-02");
  await engine.next();
  assert.equal(engine.currentScene.id, "SC-03");
  assert.equal(await engine.next(), false);
  await engine.previous();
  assert.equal(engine.currentScene.id, "SC-02");
});

test("rechaza índices inválidos e IDs duplicados", async () => {
  const engine = new SceneEngine({ scenes });
  await assert.rejects(engine.goTo(99), RangeError);
  assert.throws(() => engine.setScenes([{ id: "SC-01" }, { id: "SC-01" }]), /duplicado/);
});

test("emite eventos de cambio de escena", async () => {
  const engine = new SceneEngine({ scenes });
  const changes = [];
  engine.on("scenechange", event => changes.push(event.scene.id));
  await engine.start();
  await engine.next();
  assert.deepEqual(changes, ["SC-01", "SC-02"]);
});

test("una solicitud más reciente invalida una carga anterior", async () => {
  let releaseFirst;
  const engine = new SceneEngine({
    scenes,
    prepareScene: scene => scene.id === "SC-01"
      ? new Promise(resolve => { releaseFirst = resolve; })
      : Promise.resolve()
  });
  const first = engine.start(0);
  await Promise.resolve();
  const second = engine.goTo(1);
  await second;
  releaseFirst();
  assert.equal(await first, false);
  assert.equal(engine.currentScene.id, "SC-02");
});

test("no permite usar el motor después de destruirlo", async () => {
  const engine = new SceneEngine({ scenes });
  engine.destroy();
  await assert.rejects(engine.start(), /destruido/);
});
