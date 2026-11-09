const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const slug = params.get("experience") || "";
const stage = $("#stage");
const frame = $("#experienceFrame");
const loading = $("#loading");
const channel = new BroadcastChannel("webvid-studio-render");

let experience = null;
let currentScene = 0;
let currentProgress = 0;

function sendStageInfo() {
  const rect = stage.getBoundingClientRect();
  channel.postMessage({
    type: "STAGE_INFO",
    slug,
    stage: {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    }
  });
}

function syncFrame() {
  if (!frame.contentWindow) return;
  frame.contentWindow.postMessage({
    channel: "WEBVID_STUDIO_PREVIEW",
    type: "SET_SCENE",
    index: currentScene
  }, location.origin);
  frame.contentWindow.postMessage({
    channel: "WEBVID_STUDIO_PREVIEW",
    type: "SEEK",
    progress: currentProgress
  }, location.origin);
}

channel.addEventListener("message", event => {
  const data = event.data;
  if (!data || data.slug !== slug) return;
  if (data.type === "SYNC") {
    if (Number.isInteger(data.index)) currentScene = Math.max(0, data.index);
    if (Number.isFinite(data.progress)) currentProgress = Math.max(0, Math.min(1, data.progress));
    syncFrame();
  }
  if (data.type === "RESET") {
    currentScene = 0;
    currentProgress = 0;
    syncFrame();
  }
});

frame.addEventListener("load", () => {
  loading.hidden = true;
  syncFrame();
  sendStageInfo();
});

async function init() {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    loading.textContent = "Experiencia no válida";
    return;
  }
  try {
    const response = await fetch("../experiencias.json", { cache: "no-store" });
    if (!response.ok) throw new Error("No se pudo leer el catálogo.");
    const catalog = await response.json();
    experience = (catalog.experiences || []).find(item => {
      const path = String(item.path || "");
      return path.endsWith("/" + slug + "/") || path.endsWith("/" + slug);
    });
    if (!experience) throw new Error("La experiencia no está en el catálogo.");
    document.title = "Render · " + experience.title;
    const path = new URL("../" + experience.path.replace(/^\.\//, ""), location.href);
    path.searchParams.set("studio", "1");
    frame.src = path.href;
  } catch (error) {
    loading.textContent = error.message || "No se pudo cargar la experiencia.";
  }
}

new ResizeObserver(sendStageInfo).observe(stage);
window.addEventListener("resize", sendStageInfo);
init();
