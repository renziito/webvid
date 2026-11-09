const FRAME_TIMEOUT_MS = 12000;

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve));
}

function copyComputedStyles(source, target, pseudoNodes = true) {
  const computed = getComputedStyle(source);
  let css = "";
  for (let i = 0; i < computed.length; i++) {
    const property = computed[i];
    css += property + ":" + computed.getPropertyValue(property) + ";";
  }
  target.setAttribute("style", css);

  if (pseudoNodes) {
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(source, pseudo);
      const content = style.getPropertyValue("content");
      if (!content || content === "none" || content === "normal" || content === '""') continue;
      const node = source.ownerDocument.createElement("span");
      node.setAttribute("data-webvid-pseudo", pseudo);
      let pseudoCss = "";
      for (let i = 0; i < style.length; i++) {
        const property = style[i];
        pseudoCss += property + ":" + style.getPropertyValue(property) + ";";
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
    target.setAttribute("src", source.currentSrc || source.src);
    target.setAttribute("crossorigin", "anonymous");
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

  await nextFrame();
  await nextFrame();
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
