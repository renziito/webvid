import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

const catalogPath = resolve("experiencias.json");
const experiencesRoot = resolve("experiencias");

function fail(message) {
  console.error(`[WebVid] Error de catálogo: ${message}`);
  process.exit(1);
}

let catalog;
try {
  catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
} catch (error) {
  fail(`experiencias.json no contiene JSON válido. ${error.message}`);
}

if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
  fail('La raíz debe ser un objeto JSON.');
}

if (!Array.isArray(catalog.experiences)) {
  fail('La propiedad "experiences" debe ser un array.');
}

const seenPaths = new Set();
const seenTitles = new Set();

for (const [index, item] of catalog.experiences.entries()) {
  const label = `experiences[${index}]`;

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    fail(`${label} debe ser un objeto.`);
  }

  if (typeof item.title !== "string" || !item.title.trim()) {
    fail(`${label}.title debe ser un texto no vacío.`);
  }

  if (typeof item.path !== "string" || !item.path.trim()) {
    fail(`${label}.path debe ser un texto no vacío.`);
  }

  if (!/^\.\/experiencias\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(item.path)) {
    fail(`${label}.path debe apuntar a ./experiencias/<slug>/ usando minúsculas, números y guiones.`);
  }

  const normalizedPath = item.path.endsWith("/") ? item.path : `${item.path}/`;
  if (seenPaths.has(normalizedPath)) {
    fail(`La ruta ${normalizedPath} está duplicada.`);
  }
  seenPaths.add(normalizedPath);

  if (item.description !== undefined && typeof item.description !== "string") {
    fail(`${label}.description debe ser texto cuando está presente.`);
  }

  if (item.category !== undefined && typeof item.category !== "string") {
    fail(`${label}.category debe ser texto cuando está presente.`);
  }

  if (item.accent !== undefined &&
      (typeof item.accent !== "string" || !/^#[0-9a-f]{3,8}$/i.test(item.accent))) {
    fail(`${label}.accent debe ser un color hexadecimal válido.`);
  }

  const experienceDirectory = resolve(experiencesRoot, normalizedPath.slice("./experiencias/".length));
  if (!experienceDirectory.startsWith(experiencesRoot + sep) || !existsSync(experienceDirectory)) {
    fail(`No existe el directorio de ${normalizedPath}.`);
  }

  if (!statSync(experienceDirectory).isDirectory()) {
    fail(`${normalizedPath} no es un directorio.`);
  }

  for (const requiredFile of ["index.html", "metadata.json"]) {
    if (!existsSync(resolve(experienceDirectory, requiredFile))) {
      fail(`${normalizedPath} no contiene ${requiredFile}.`);
    }
  }

  const metadataPath = resolve(experienceDirectory, "metadata.json");
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  } catch (error) {
    fail(`${normalizedPath}metadata.json no contiene JSON válido. ${error.message}`);
  }

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    fail(`${normalizedPath}metadata.json debe contener un objeto JSON.`);
  }

  if (metadata.slug !== undefined && metadata.slug !== normalizedPath.split("/").filter(Boolean).at(-1)) {
    fail(`${normalizedPath}metadata.json declara un slug diferente al de su ruta.`);
  }

  const titleKey = item.title.trim().toLocaleLowerCase("es");
  if (seenTitles.has(titleKey)) {
    console.warn(`[WebVid] Aviso: título repetido "${item.title}".`);
  }
  seenTitles.add(titleKey);
}

console.log(`[WebVid] Catálogo válido: ${catalog.experiences.length} experiencia(s).`);
