import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../scripts/validate-catalog.mjs", import.meta.url));

function fixture({ description = "Descripción", missingAsset = false, body = "", css = "body { color: white; }", scriptSource = "console.log('demo');" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "webvid-validator-"));
  const experience = join(root, "experiencias", "demo");
  mkdirSync(join(experience, "assets"), { recursive: true });
  writeFileSync(join(root, "experiencias.json"), JSON.stringify({
    experiences: [{ title: "Demo", description, category: "Historia", path: "./experiencias/demo/" }]
  }));
  writeFileSync(join(experience, "index.html"),
    '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><link rel="stylesheet" href="styles.css"></head><body>' + body + '<script src="script.js"></script></body></html>');
  writeFileSync(join(experience, "styles.css"),
    missingAsset ? "body { background: url('assets/missing.webp'); }" : css);
  writeFileSync(join(experience, "script.js"), scriptSource);
  writeFileSync(join(experience, "metadata.json"), JSON.stringify({ slug: "demo", title: "Demo" }));
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });
}

test("acepta un catálogo vacío", () => {
  const root = mkdtempSync(join(tmpdir(), "webvid-empty-"));
  try {
    mkdirSync(join(root, "experiencias"));
    writeFileSync(join(root, "experiencias.json"), JSON.stringify({ experiences: [] }));
    assert.equal(run(root).status, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("acepta una experiencia con estructura mínima", () => {
  const root = fixture();
  try {
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza campos obligatorios vacíos", () => {
  const root = fixture({ description: "" });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /description/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza recursos locales inexistentes", () => {
  const root = fixture({ missingAsset: true });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /missing\.webp/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza texto visible y controles en la película", () => {
  for (const body of ["<h1>Hola</h1>", "<button>Play</button>", "<audio src='voice.mp3'></audio>"]) {
    const root = fixture({ body });
    try {
      const result = run(root);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /texto visible|prohibidos/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("permite importar el motor compartido desde engine", () => {
  const root = fixture({ scriptSource: "import { ScenePlayer } from '../../engine/scene-player.mjs';" });
  try {
    mkdirSync(join(root, "engine"), { recursive: true });
    writeFileSync(join(root, "engine", "scene-player.mjs"), "export class ScenePlayer {}");
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rechaza recursos absolutos incompatibles con GitHub Pages", () => {
  const root = fixture({ css: "body { background: url('/assets/hero.webp'); }" });
  try {
    const result = run(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /fuera de la experiencia/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
