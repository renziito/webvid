const FRAME_TIMEOUT_MS = 12000;
const inlineImageCache = new Map();
const skippedExternalImages = new Set();
const TRANSPARENT_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export function resetRenderWarnings() {
  skippedExternalImages.clear();
}

export function getRenderWarnings() {
  return { skippedExternalImages: [...skippedExternalImages] };
}

function nextFrame(win) {
  return new Promise(resolve => win.requestAnimationFrame(() => win.requestAnimationFrame(resolve)));
}

function isExternalResourceUrl(rawValue) {
  try {
    const value = rawValue.replace(/^url\\((['"]?)(.*?)\\1\\)$/i, "$2").trim();
    const url = new URL(value, location.href);
    return /^https?:$/.test(url.protocol) && url.origin !== location.origin;
  } catch {
    return false;
  }
}

function sanitizeCssImageValue(property, value) {
  const imageProperties = new Set([
    "background-image",
    "mask-image",
    "-webkit-mask-image",
    "border-image-source",
    "list-style-image",
    "content"
  ]);
  if (!imageProperties.has(property) || !value || value === "none") return value;
  return value.replace(/url\\((?:"[^"]*"|'[^']*'|[^)]*)\\)/gi, token =>
    isExternalResourceUrl(token) ? "none" : token
  );
}

function copyComputedStyles(source, target, pseudoNodes = true) {
  const computed = getComputedStyle(source);
  let css = "";
  for (let i = 0; i < computed.length; i++) {
    const property = computed[i];
    const value = sanitizeCssImageValue(property, computed.getPropertyValue(property));
    css += property + ":" + value + ";";
  }
  target.setAttribute("style", css);

  if (pseudoNodes) {
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(source, pseudo);
      const content = style.getPropertyValue("content");
      if (!content || content === "none" || content === "normal") continue;
      const node = source.ownerDocument.createElement("span");
      node.setAttribute("data-webvid-pseudo", pseudo);
      let pseudoCss = "";
      for (let i = 0; i < style.length; i++) {
        const property = style[i];
        const value = sanitizeCssImageValue(property, style.getPropertyValue(property));
        pseudoCss += property + ":" + value + ";";
      }
      node.setAttribute("style", pseudoCss);
      if (content.startsWith('"') || content.startsWith("'")) {
        node.textContent = content.slice(1, -1);
      }
      if (pseudo === "::before") target.prepend(node);
      else target.append(node);
    }
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo preparar una imagen para el render."));
    reader.readAsDataURL(blob);
  });
}

function applyImageFallback(target, imageUrl) {
  target.setAttribute("src", TRANSPARENT_PIXEL);
  target.setAttribute("data-webvid-image-fallback", "cors");
  target.style.backgroundColor = "#17262c";
  target.style.backgroundImage = "linear-gradient(145deg, rgba(28,55,62,.96), rgba(7,15,20,.98))";
  target.style.backgroundSize = "cover";
  skippedExternalImages.add(imageUrl);
}

async function inlineImage(source, target) {
  const imageUrl = source.currentSrc || source.src;
  if (!imageUrl || imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    if (imageUrl) target.setAttribute("src", imageUrl);
    return;
  }
  target.removeAttribute("srcset");
  target.removeAttribute("sizes");
  try {
    let dataUrlPromise = inlineImageCache.get(imageUrl);
    if (!dataUrlPromise) {
      dataUrlPromise = (async () => {
        const response = await fetch(imageUrl, { mode: "cors", credentials: "omit", cache: "force-cache" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        return blobToDataUrl(await response.blob());
      })();
      inlineImageCache.set(imageUrl, dataUrlPromise);
      dataUrlPromise.catch(() => inlineImageCache.delete(imageUrl));
    }
    target.setAttribute("src", await dataUrlPromise);
  } catch {
    // Una imagen remota sin cabeceras CORS no puede copiarse a Canvas.
    // Se conserva su caja y se aplica un fondo neutro para que no bloquee todo el MP4.
    applyImageFallback(target, imageUrl);
  }
}

async function inlineCanvas(source, target) {
  if (source.localName === "canvas") {
    try {
      const image = source.ownerDocument.createElement("img");
      image.src = source.toDataURL("image/png");
      image.width = source.width;
      image.height = source.height;
      image.setAttribute("style", getComputedStyle(source).cssText || "");
      target.replaceWith(image);
    } catch {
      throw new Error("Una escena contiene un canvas protegido por CORS y no se puede exportar localmente.");
    }
  }
}

function isVisibleInDocument(element) {
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const style = getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") return false;
    current = current.parentElement;
  }
  return true;
}

async function cloneWithStyles(source, target) {
  if (source.nodeType === Node.TEXT_NODE) {
    target.textContent = source.textContent;
    return;
  }
  if (source.nodeType !== Node.ELEMENT_NODE) return;

  const sourceChildren = [...source.childNodes];
  const targetChildren = [...target.childNodes];
  copyComputedStyles(source, target);
  if (source.localName === "canvas") {
    await inlineCanvas(source, target);
    return;
  }
  if (source.localName === "input") target.setAttribute("value", source.value);
  if (source.localName === "textarea") target.textContent = source.value;
  if (source.localName === "select") target.setAttribute("data-value", source.value);

  if (source.localName === "img") {
    if (!isVisibleInDocument(source)) {
      target.removeAttribute("src");
      return;
    }
    if (!source.complete || !source.naturalWidth) {
      try {
        await Promise.race([
          source.decode(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Una imagen no terminó de cargar.")), FRAME_TIMEOUT_MS))
        ]);
      } catch {
        throw new Error("No se puede exportar: una imagen de la experiencia no está cargada.");
      }
    }
    await inlineImage(source, target);
  }

  for (let i = 0; i < sourceChildren.length; i++) {
    const child = sourceChildren[i];
    const clone = targetChildren[i];
    if (clone) await cloneWithStyles(child, clone);
  }
}

function loadSvgImage(svg) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error("El navegador no pudo rasterizar la escena. Prueba con Chrome actualizado."));
    }, FRAME_TIMEOUT_MS);
    image.onload = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo convertir la escena HTML a una imagen para el render directo."));
    };
    image.src = url;
  });
}

export async function renderDocumentFrame({ iframe, canvas, sceneIndex, progress }) {
  const doc = iframe?.contentDocument;
  const win = iframe?.contentWindow;
  if (!doc?.documentElement || !win) throw new Error("El lienzo Render no está listo o la experiencia no permite acceso local.");

  win.postMessage({
    channel: "WEBVID_STUDIO_PREVIEW",
    type: "SET_SCENE",
    index: sceneIndex
  }, location.origin);
  win.postMessage({
    channel: "WEBVID_STUDIO_PREVIEW",
    type: "SEEK",
    progress: Math.max(0, Math.min(1, progress))
  }, location.origin);

  await nextFrame(win);
  if (doc.fonts?.ready) await Promise.race([
    doc.fonts.ready,
    new Promise(resolve => setTimeout(resolve, 2500))
  ]);

  const clone = doc.documentElement.cloneNode(true);
  await cloneWithStyles(doc.documentElement, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");

  const sourceWidth = Math.max(1, win.innerWidth);
  const sourceHeight = Math.max(1, win.innerHeight);
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xhtml="http://www.w3.org/1999/xhtml" width="' +
    canvas.width + '" height="' + canvas.height + '" viewBox="0 0 ' + sourceWidth + " " + sourceHeight +
    '"><foreignObject width="100%" height="100%">' + serialized + "</foreignObject></svg>";

  const image = await loadSvgImage(svg);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("No se pudo crear el canvas de exportación.");
  context.fillStyle = "#050509";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
}
