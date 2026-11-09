const VERSION = "v5";
const SHELL_CACHE = "webvid-shell-" + VERSION;
const RUNTIME_CACHE = "webvid-runtime-" + VERSION;
const MAX_RUNTIME_ENTRIES = 120;
const MAX_RUNTIME_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CACHEABLE_RESOURCE_BYTES = 80 * 1024 * 1024;
const APP_SCOPE = new URL(self.registration.scope);
const APP_ROOT = APP_SCOPE.pathname.endsWith("/") ? APP_SCOPE.pathname : APP_SCOPE.pathname + "/";
const MEDIABUNNY_URL = "https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/+esm";

const APP_SHELL = [
  new URL("./", APP_SCOPE).href,
  new URL("index.html", APP_SCOPE).href,
  new URL("manifest.webmanifest", APP_SCOPE).href,
  new URL("icon.svg", APP_SCOPE).href,
  new URL("icon-maskable.svg", APP_SCOPE).href,
  new URL("experiencias.json", APP_SCOPE).href,
  new URL("studio/index.html", APP_SCOPE).href,
  new URL("studio/studio.css", APP_SCOPE).href,
  new URL("studio/studio.mjs", APP_SCOPE).href,
  new URL("studio/audio-analyzer.mjs", APP_SCOPE).href,
  new URL("studio/exporter.mjs", APP_SCOPE).href,
  new URL("studio/render.html", APP_SCOPE).href,
  new URL("studio/render.css", APP_SCOPE).href,
  new URL("studio/render.mjs", APP_SCOPE).href
];

function isInScope(url) {
  return url.origin === APP_SCOPE.origin && url.pathname.startsWith(APP_ROOT);
}

function normalizedRequest(request) {
  const url = new URL(request.url);
  if (url.pathname === APP_ROOT || url.pathname === APP_ROOT + "index.html" ||
      url.pathname === APP_ROOT + "experiencias.json") {
    url.search = "";
    url.hash = "";
  }
  return new Request(url.href, {
    method: "GET",
    credentials: "same-origin",
    headers: request.headers,
    mode: "same-origin",
    redirect: "follow"
  });
}

async function boundedCacheResponse(response) {
  if (!response || response.status !== 200 || response.type === "opaque") return null;
  const declaredLength = Number(response.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_CACHEABLE_RESOURCE_BYTES) return null;
  if (!response.body) return new Response(null, { status: response.status, headers: response.headers });

  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_CACHEABLE_RESOURCE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw error;
  }
  const headers = new Headers(response.headers);
  headers.set("Content-Length", String(size));
  return new Response(new Blob(chunks), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function putWithTimestamp(cache, request, response) {
  const bounded = await boundedCacheResponse(response.clone());
  if (!bounded) return false;
  const headers = new Headers(bounded.headers);
  headers.set("X-WebVid-Cached-At", String(Date.now()));
  await cache.put(request, new Response(bounded.body, {
    status: bounded.status,
    statusText: bounded.statusText,
    headers
  }));
  return true;
}

async function trimRuntimeCache(cache) {
  const requests = await cache.keys();
  const now = Date.now();
  const entries = [];
  for (const request of requests) {
    const response = await cache.match(request);
    const cachedAt = Number(response?.headers.get("X-WebVid-Cached-At") || 0);
    if (!cachedAt || now - cachedAt > MAX_RUNTIME_AGE_MS) {
      await cache.delete(request);
    } else {
      entries.push({ request, cachedAt });
    }
  }
  entries.sort((a, b) => b.cachedAt - a.cachedAt);
  for (const entry of entries.slice(MAX_RUNTIME_ENTRIES)) await cache.delete(entry.request);
}

async function cacheRuntimeResponse(request, response) {
  const cache = await caches.open(RUNTIME_CACHE);
  await putWithTimestamp(cache, request, response);
  await trimRuntimeCache(cache);
}

async function networkFirst(request, cacheName, fallbackUrl = null) {
  const key = normalizedRequest(request);
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      if (cacheName === RUNTIME_CACHE) await cacheRuntimeResponse(key, response.clone());
      else await cache.put(key, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(key);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    return new Response("Esta experiencia no está disponible sin conexión. Conéctate a internet y vuelve a intentarlo.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(SHELL_CACHE)
    .then(async cache => {
      await cache.addAll(APP_SHELL);
      try {
        await cache.add(new Request(MEDIABUNNY_URL, { mode: "cors" }));
      } catch {
        // Studio can still load; MP4 export will fetch this dependency when online.
      }
      await self.skipWaiting();
    }));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("webvid-shell-") || key.startsWith("webvid-runtime-"))
      .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "WEBVID_PRECACHE_EXPERIENCE") {
    event.waitUntil((async () => {
      const urls = Array.isArray(data.urls) ? data.urls.slice(0, 200) : [];
      const cache = await caches.open(RUNTIME_CACHE);
      const results = [];
      for (const value of urls) {
        try {
          const url = new URL(value, APP_SCOPE);
          if (!isInScope(url)) {
            results.push({ url: String(value), ok: false, reason: "outside-app-scope" });
            continue;
          }
          const request = new Request(url.href, { credentials: "same-origin" });
          const response = await fetch(request);
          if (!response.ok) throw new Error("HTTP " + response.status);
          const stored = await putWithTimestamp(cache, request, response);
          if (!stored) throw new Error("resource-not-cacheable-or-over-80mb");
          results.push({ url: url.href, ok: true });
        } catch (error) {
          results.push({ url: String(value), ok: false, reason: error.message });
        }
      }
      await trimRuntimeCache(cache);
      event.ports?.[0]?.postMessage({
        type: "WEBVID_PRECACHE_RESULT",
        ok: results.every(item => item.ok),
        results
      });
    })());
  }
  if (data.type === "WEBVID_CLEAR_RUNTIME_CACHE") {
    event.waitUntil(caches.delete(RUNTIME_CACHE));
  }
});

function parseByteRange(value, size) {
  const match = /^bytes=([0-9]*)-([0-9]*)$/.exec(value || "");
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      start < 0 || start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

async function handleRangeRequest(request) {
  const url = new URL(request.url);
  const fullRequest = new Request(url.href, { credentials: "same-origin" });
  const runtime = await caches.open(RUNTIME_CACHE);
  const cached = await runtime.match(fullRequest);
  if (!cached) {
    try { return await fetch(request); }
    catch {
      return new Response("Vídeo no disponible sin conexión. Descarga la experiencia mientras tengas conexión.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
  }

  const buffer = await cached.arrayBuffer();
  const size = buffer.byteLength;
  const range = parseByteRange(request.headers.get("Range"), size);
  if (!range) {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": "bytes */" + size, "Accept-Ranges": "bytes" }
    });
  }
  const { start, end } = range;
  const headers = new Headers(cached.headers);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Range", "bytes " + start + "-" + end + "/" + size);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: "Partial Content",
    headers
  });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.href === MEDIABUNNY_URL) {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && response.type !== "opaque") await cache.put(request, response.clone());
        return response;
      } catch {
        return new Response("El motor MP4 no está disponible sin conexión.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }
    })());
    return;
  }

  if (!isInScope(url)) return;
  if (request.headers.has("Range")) {
    event.respondWith(handleRangeRequest(request));
    return;
  }

  const isNavigation = request.mode === "navigate";
  const isCatalog = url.pathname === APP_ROOT + "experiencias.json";
  const isShellDocument = url.pathname === APP_ROOT || url.pathname === APP_ROOT + "index.html";
  if (isNavigation || isCatalog || isShellDocument) {
    const cacheName = isShellDocument || isCatalog ? SHELL_CACHE : RUNTIME_CACHE;
    const fallback = isNavigation && url.pathname === APP_ROOT ? new URL("./", APP_SCOPE).href : null;
    event.respondWith(networkFirst(request, cacheName, fallback));
    return;
  }

  const key = normalizedRequest(request);
  event.respondWith((async () => {
    const runtime = await caches.open(RUNTIME_CACHE);
    const shell = await caches.open(SHELL_CACHE);
    const cached = await runtime.match(key) || await shell.match(key);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cacheRuntimeResponse(key, response.clone());
      return response;
    } catch {
      return new Response("Recurso no disponible sin conexión.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
      });
    }
  })());
});
