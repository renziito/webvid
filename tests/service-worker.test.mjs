import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

function createWorker({ cachedResponse = null, networkResponse = null } = {}) {
  const handlers = new Map();
  let cacheWrites = 0;
  const cache = {
    match: async () => cachedResponse?.clone() ?? undefined,
    put: async () => { cacheWrites++; },
    keys: async () => [],
    delete: async () => true,
    addAll: async () => {}
  };
  const cachesMock = {
    open: async () => cache,
    keys: async () => [],
    delete: async () => true,
    match: async () => undefined
  };
  const self = {
    registration: { scope: "https://example.test/webvid/" },
    addEventListener: (name, handler) => handlers.set(name, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} }
  };
  const source = readFileSync(fileURLToPath(new URL("../sw.js", import.meta.url)), "utf8");
  runInNewContext(source, {
    self,
    caches: cachesMock,
    fetch: async request => {
      if (networkResponse) return networkResponse.clone();
      throw new Error("offline");
    },
    URL, Request, Response, Headers, Blob, Date, Number, String, Math, Promise
  });
  return {
    get cacheWrites() { return cacheWrites; },
    async dispatchRange(range) {
      let responsePromise;
      const request = new Request("https://example.test/webvid/experiencias/demo/assets/film.mp4", {
        headers: { Range: range }
      });
      handlers.get("fetch")({
        request,
        respondWith: promise => { responsePromise = promise; }
      });
      return responsePromise;
    }
  };
}

test("sirve rangos desde caché con HTTP 206 y cabeceras correctas", async () => {
  const worker = createWorker({ cachedResponse: new Response(new Uint8Array([0,1,2,3,4,5]), {
    headers: { "Content-Type": "video/mp4" }
  }) });
  const response = await worker.dispatchRange("bytes=2-4");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 2-4/6");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [2,3,4]);
});

test("sirve rangos suffix y abiertos", async () => {
  const bytes = new Uint8Array([10,11,12,13,14,15]);
  const worker = createWorker({ cachedResponse: new Response(bytes) });
  const suffix = await worker.dispatchRange("bytes=-2");
  assert.deepEqual([...new Uint8Array(await suffix.arrayBuffer())], [14,15]);
  const open = await worker.dispatchRange("bytes=4-");
  assert.deepEqual([...new Uint8Array(await open.arrayBuffer())], [14,15]);
});

test("rechaza rangos inválidos con 416 y Content-Range", async () => {
  const worker = createWorker({ cachedResponse: new Response(new Uint8Array([1,2,3])) });
  const response = await worker.dispatchRange("bytes=8-9");
  assert.equal(response.status, 416);
  assert.equal(response.headers.get("Content-Range"), "bytes */3");
});

test("reenvía al servidor los rangos no almacenados", async () => {
  const networkResponse = new Response(new Uint8Array([7,8]), {
    status: 206,
    headers: { "Content-Range": "bytes 0-1/10" }
  });
  const worker = createWorker({ networkResponse });
  const response = await worker.dispatchRange("bytes=0-1");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 0-1/10");
});

test("no almacena recursos cuyo Content-Length supera el límite", async () => {
  const worker = createWorker({
    networkResponse: new Response(new Uint8Array([1,2,3]), {
      headers: { "Content-Length": String(80 * 1024 * 1024 + 1) }
    })
  });
  let responsePromise;
  const request = new Request("https://example.test/webvid/experiencias/demo/assets/oversized.webp");
  const handlers = new Map();
  const source = readFileSync(fileURLToPath(new URL("../sw.js", import.meta.url)), "utf8");
  const cache = {
    match: async () => undefined,
    put: async () => { worker._writes = (worker._writes || 0) + 1; },
    keys: async () => []
  };
  const cachesMock = { open: async () => cache, keys: async () => [], delete: async () => true, match: async () => undefined };
  const self = { registration: { scope: "https://example.test/webvid/" }, addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: async () => {}, clients: { claim: async () => {} } };
  runInNewContext(source, {
    self, caches: cachesMock, fetch: async () => new Response(new Uint8Array([1,2,3]), { headers: { "Content-Length": String(80 * 1024 * 1024 + 1) } }),
    URL, Request, Response, Headers, Blob, Date, Number, String, Math, Promise
  });
  handlers.get("fetch")({ request, respondWith: promise => { responsePromise = promise; } });
  const response = await responsePromise;
  assert.equal(response.status, 200);
  assert.equal(worker._writes || 0, 0);
});
