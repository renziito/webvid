import { readFileSync, existsSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

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

if (!existsSync(catalogFile)) fail("No existe experiencias.json.");
if (!existsSync(experiencesRoot) || !statSync(experiencesRoot).isDirectory()) {
  fail("No existe el directorio experiencias/.");
}

const catalog = readJson(catalogFile, "experiencias.json");
if (!catalog || typeof catalog !== "object" || Array.isArray(catalog) ||
    !Array.isArray(catalog.experiences)) {
  fail('La raíz debe ser un objeto con la propiedad "experiences" como array.');
}

const paths = new Set();
const titles = new Set();

for (const [index, item] of catalog.experiences.entries()) {
  const label = `experiences[${index}]`;
  if (!item || typeof item !== "object" || Array.isArray(item)) fail(`${label} debe ser un objeto.`);
  if (typeof item.title !== "string" || !item.title.trim()) fail(`${label}.title debe ser texto no vacío.`);
  if (typeof item.path !== "string" ||
      !/^\.\/experiencias\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(item.path)) {
    fail(`${label}.path debe tener el formato ./experiencias/<slug>/.`);
  }

  const normalizedPath = item.path.endsWith("/") ? item.path : `${item.path}/`;
  if (paths.has(normalizedPath)) fail(`Ruta duplicada: ${normalizedPath}`);
  paths.add(normalizedPath);

  for (const field of ["description", "category"]) {
    if (item[field] !== undefined && typeof item[field] !== "string") {
      fail(`${label}.${field} debe ser texto.`);
    }
  }
  if (item.accent !== undefined &&
      (typeof item.accent !== "string" || !/^#[0-9a-f]{3,8}$/i.test(item.accent))) {
    fail(`${label}.accent debe ser un color hexadecimal.`);
  }

  const slug = normalizedPath.slice("./experiencias/".length).replace(/\/$/, "");
  const directory = resolve(experiencesRoot, slug);
  if (!directory.startsWith(experiencesRoot + sep) || !existsSync(directory) ||
      !statSync(directory).isDirectory()) {
    fail(`No existe el directorio de la experiencia ${slug}.`);
  }

  const htmlFile = resolve(directory, "index.html");
  const metadataFile = resolve(directory, "metadata.json");
  if (!existsSync(htmlFile)) fail(`${slug} no contiene index.html.`);
  if (!existsSync(metadataFile)) fail(`${slug} no contiene metadata.json.`);

  const metadata = readJson(metadataFile, `${slug}/metadata.json`);
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    fail(`${slug}/metadata.json debe contener un objeto.`);
  }
  if (metadata.slug !== slug) fail(`${slug}/metadata.json debe declarar slug: "${slug}".`);
  if (metadata.title !== undefined && typeof metadata.title !== "string") {
    fail(`${slug}/metadata.json: title debe ser texto.`);
  }

  const titleKey = item.title.trim().toLocaleLowerCase("es");
  if (titles.has(titleKey)) console.warn(`[WebVid] AVISO: título repetido "${item.title}".`);
  titles.add(titleKey);
}

console.log(`[WebVid] Catálogo válido: ${catalog.experiences.length} experiencia(s).`);
