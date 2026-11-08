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
├── experiencias/
│   └── <slug>/
│       ├── index.html
│       ├── styles.css
│       ├── script.js
│       ├── metadata.json
│       └── assets/
├── scripts/
│   └── validate-catalog.mjs
├── experiencias.json
├── index.html
├── manifest.webmanifest
├── sw.js
├── icon.svg
└── icon-maskable.svg
```

Cada experiencia publicada debe tener `index.html` y `metadata.json`. El catálogo `experiencias.json` referencia las experiencias mediante rutas locales `./experiencias/<slug>/`.

## PWA y funcionamiento offline

- La biblioteca y el app shell se guardan en caché para abrir WebVid sin conexión después de una primera visita correcta.
- Las páginas y recursos de experiencias visitadas se guardan en una caché runtime con límite de 120 recursos y antigüedad máxima de 30 días.
- El Service Worker elimina versiones antiguas de sus cachés al activarse.
- El futuro reproductor puede solicitar la precarga de recursos de una experiencia mediante el mensaje `WEBVID_PRECACHE_EXPERIENCE`, enviando una lista de URLs locales dentro del ámbito `/webvid/`.
- Una experiencia que nunca se haya visitado ni precargado no puede garantizarse disponible offline.

## Validación y despliegue

Cada push a `main` ejecuta GitHub Actions. Antes de ensamblar el sitio se valida el JSON del catálogo, las rutas y la estructura mínima de cada experiencia. El artefacto público se construye en `dist/` e incluye únicamente la PWA, el catálogo y la carpeta `experiencias/`.

Los guiones y documentos de producción no deben guardarse en este repositorio público. Excluirlos del artefacto de Pages no los vuelve privados si se comprometen en GitHub.

## Desarrollo local

Para probar la PWA debe servirse desde un origen HTTP(S); abrir `index.html` directamente como archivo no habilita Service Workers.

El workflow valida el catálogo y el ensamblado del sitio. Las pruebas de instalación real, caché offline y rendimiento móvil deben completarse en un navegador Android, idealmente en Samsung S25.

## Sitio

https://renziito.github.io/webvid/
