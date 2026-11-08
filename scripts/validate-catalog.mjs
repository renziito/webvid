import {
  existsSync,
  readFileSync,
  statSync
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve, sep } from "node:path";

const root = process.cwd();
const catalogFile = resolve(root, "experiencias.json");
const experiencesRoot = resolve(root, "experiencias");

function fail(message) {
  console.error(`[WebVid] ERROR: ${message}`);
  process.exit(1);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail(`${label} no contiene JSON válido: ${error.message}`);
  }
}

function requireFile(path, label) {
  if (!existsSync(path) || !statSync(path).isFile()) {
    fail(`${label} no existe o no es un archivo.`);
  }
}

function requireDirectory(path, label) {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    fail(`${label} no existe o no es un directorio.`);
  }
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i.test(value);
}

function checkLocalReference(reference, sourceFile, experienceRoot, label) {
  const value = reference.trim();
  if (!value || isExternalReference(value)) return;

  let cleanPath;
  try {
    cleanPath = decodeURIComponent(value.split(/[?#]/, 1)[0]);
  } catch {
    fail(`${label}: URL local mal codificada "${reference}".`);
  }
  if (!cleanPath) return;

  const target = resolve(dirname(sourceFile), cleanPath);
  if (target !== experienceRoot && !target.startsWith(experienceRoot + sep)) {
    fail(`${label}: referencia fuera de la experiencia: "${reference}".`);
  }
  if (!existsSync(target)) {
    fail(`${label}: recurso local no encontrado "${reference}" (desde ${sourceFile.replace(root + sep, "")}).`);
  }
}

function checkHtmlReferences(html, htmlFile, experienceRoot, slug) {
  const attributePattern = /\b(?:src|href|poster)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(attributePattern)) {
    checkLocalReference(match[1], htmlFile, experienceRoot, `${slug}/index.html`);
  }

  const hasStylesheet = /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']styles\.css["'])[^>]*>/i.test(html);
  const hasScript = /<script\b(?=[^>]*\bsrc=["']script\.js["'])[^>]*>/i.test(html);
  if (!hasStylesheet) fail(`${slug}/index.html debe enlazar styles.css.`);
  if (!hasScript) fail(`${slug}/index.html debe cargar script.js.`);
}

function checkCssReferences(css, cssFile, experienceRoot, slug) {
  const pattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
  for (const match of css.matchAll(pattern)) {
    checkLocalReference(match[1], cssFile, experienceRoot, `${slug}/styles.css`);
  }
}

function checkJavaScriptReferences(source, jsFile, experienceRoot, slug) {
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\bimport\s*["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bnew\s+URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const reference = match[1];
      if (reference.startsWith("./") || reference.startsWith("../")) {
        checkLocalReference(reference, jsFile, experienceRoot, `${slug}/script.js`);
      }
    }
  }
}

if (!existsSync(catalogFile)) fail("No existe experiencias.json.");
requireDirectory(experiencesRoot, "El directorio experiencias/");

const catalog = readJson(catalogFile, "experiencias.json");
if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
    !Array.isArray(catalog.experiences)) {
  fail('La raíz debe ser un objeto con la propiedad "experiences" como array.');
}

const paths = new Set();
const titles = new Set();

for (const [index, item] of catalog.experiences.entries()) {
  const label = `experiences[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    fail(`${label} debe ser un objeto.`);
  }

  for (const field of ["title", "description", "category"]) {
    if (typeof item[field] !== "string" || !item[field].trim()) {
      fail(`${label}.${field} debe ser texto no vacío.`);
    }
  }

  if (typeof item.path !== "string" ||
      !/^\.\/experiencias\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(item.path)) {
    fail(`${label}.path debe tener el formato ./experiencias/<slug>/.`);
  }

  const normalizedPath = item.path.endsWith("/") ? item.path : `${item.path}/`;
  if (paths.has(normalizedPath)) fail(`Ruta duplicada: ${normalizedPath}`);
  paths.add(normalizedPath);

  if (item.accent !== undefined &&
      (typeof item.accent !== "string" || !/^#[0-9a-f]{3,8}$/i.test(item.accent))) {
    fail(`${label}.accent debe ser un color hexadecimal.`);
  }

  const slug = normalizedPath.slice("./experiencias/".length).replace(/\/$/, "");
  const directory = resolve(experiencesRoot, slug);
  if (!directory.startsWith(experiencesRoot + sep)) {
    fail(`Ruta insegura para la experiencia ${slug}.`);
  }
  requireDirectory(directory, `experiencias/${slug}/`);

  const htmlFile = resolve(directory, "index.html");
  const cssFile = resolve(directory, "styles.css");
  const jsFile = resolve(directory, "script.js");
  const metadataFile = resolve(directory, "metadata.json");
  const assetsDirectory = resolve(directory, "assets");

  requireFile(htmlFile, `${slug}/index.html`);
  requireFile(cssFile, `${slug}/styles.css`);
  requireFile(jsFile, `${slug}/script.js`);
  requireFile(metadataFile, `${slug}/metadata.json`);
  requireDirectory(assetsDirectory, `${slug}/assets/`);

  const html = readFileSync(htmlFile, "utf8");
  const css = readFileSync(cssFile, "utf8");
  const js = readFileSync(jsFile, "utf8");

  if (!/<!doctype\s+html/i.test(html) ||
      !/<html\b/i.test(html) ||
      !/<head\b/i.test(html) ||
      !/<body\b/i.test(html)) {
    fail(`${slug}/index.html no parece un documento HTML completo.`);
  }

  checkHtmlReferences(html, htmlFile, directory, slug);
  checkCssReferences(css, cssFile, directory, slug);
  checkJavaScriptReferences(js, jsFile, directory, slug);

  try {
    execFileSync(process.execPath, ["--check", jsFile], { stdio: "pipe" });
  } catch (error) {
    fail(`${slug}/script.js contiene errores de sintaxis JavaScript: ${error.stderr?.toString() || error.message}`);
  }

  const metadata = readJson(metadataFile, `${slug}/metadata.json`);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    fail(`${slug}/metadata.json debe contener un objeto.`);
  }
  if (metadata.slug !== slug) {
    fail(`${slug}/metadata.json debe declarar slug: "${slug}".`);
  }
  if (typeof metadata.title !== "string" || !metadata.title.trim()) {
    fail(`${slug}/metadata.json debe declarar un title no vacío.`);
  }

  const titleKey = item.title.trim().toLocaleLowerCase("es");
  if (titles.has(titleKey)) {
    console.warn(`[WebVid] AVISO: título repetido "${item.title}".`);
  }
  titles.add(titleKey);
}

console.log(`[WebVid] Catálogo válido: ${catalog.experiences.length} experiencia(s).`);
