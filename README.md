# WebVid Studio

WebVid crea experiencias cinematográficas verticales, exclusivamente visuales. La narración TTS y la documentación de producción se mantienen separadas de los archivos públicos de cada experiencia.

## Entregables por experiencia

1. **Experiencia web:** película visual 9:16, sin texto visible, audio ni controles.
2. **Guion TTS:** narración independiente, en español por defecto.
3. **Documento de escenas:** desglose visual y técnico sincronizado con el guion.

Una experiencia solo se incorpora a la biblioteca pública después de la aprobación explícita: **«Apruebo y publica esta experiencia»**.

## Estructura pública

```
webvid/
├── .github/workflows/pages.yml
├── engine/
│   └── scene-engine.mjs
├── experiencias/
│   └── <slug>/
│       ├── index.html
│       ├── styles.css
│       ├── script.js
│       ├── metadata.json
│       └── assets/
├── scripts/
│   └── validate-catalog.mjs
├── tests/
│   ├── scene-engine.test.mjs
│   └── validate-catalog.test.mjs
├── experiencias.json
├── index.html
├── manifest.webmanifest
├── sw.js
├── icon.svg
└── icon-maskable.svg
```

Cada experiencia publicada debe incluir `index.html`, `styles.css`, `script.js`, `metadata.json` y `assets/`. El catálogo `experiencias.json` requiere `title`, `description`, `category` y `path`; las rutas deben seguir `./experiencias/<slug>/`.

## Scene Engine

El módulo `engine/scene-engine.mjs` administra la secuencia de escenas, su preparación y activación, y el estado de la escena actual. Cada escena utiliza un ID estable como `SC-01`. Los gestos, la cámara virtual y las transiciones visuales se implementarán en módulos posteriores.

API inicial:
- `start(index)`: inicia una escena.
- `goTo(index)`: prepara y activa una escena concreta.
- `next()` / `previous()`: avanza o retrocede una escena.
- `on("scenechange", callback)`: escucha cambios de escena.
- `getSnapshot()`: devuelve el estado actual.
- `destroy()`: libera el motor.

## PWA y funcionamiento offline

- La biblioteca y el app shell se guardan en caché para abrir WebVid sin conexión después de una primera visita correcta.
- Las páginas y recursos de experiencias visitadas se guardan en una caché runtime con límite de 120 recursos, antigüedad máxima de 30 días y un límite declarado de 80 MB por recurso. Los vídeos precargados completos admiten solicitudes HTTP Range desde la copia local.
- El Service Worker elimina versiones antiguas de sus cachés al activarse.
- El futuro reproductor puede solicitar la precarga de recursos de una experiencia mediante el mensaje `WEBVID_PRECACHE_EXPERIENCE`, enviando una lista de URLs locales dentro del ámbito `/webvid/`.
- Una experiencia que nunca se haya visitado ni precargado no puede garantizarse disponible offline.

## Validación y despliegue

Cada push a `main` ejecuta GitHub Actions. El workflow comprueba la sintaxis JavaScript, ejecuta pruebas automáticas, valida campos y estructura del catálogo, comprueba referencias locales en HTML/CSS/JavaScript y ensambla el sitio en `dist/`. Si una comprobación falla, el despliegue se detiene.

Las GitHub Actions se fijan mediante SHA completo y comentario de versión para evitar que una etiqueta mutable cambie silenciosamente.

Los guiones y documentos de producción no deben guardarse en este repositorio público. Excluirlos del artefacto de Pages no los vuelve privados si se comprometen en GitHub.

## Desarrollo local

Para probar la PWA debe servirse desde un origen HTTP(S); abrir `index.html` directamente como archivo no habilita Service Workers.

El workflow valida el catálogo y el motor. Las pruebas de instalación real, caché offline, gestos y rendimiento móvil deben completarse en un navegador Android, idealmente en Samsung S25.

## Sitio

https://renziito.github.io/webvid/
