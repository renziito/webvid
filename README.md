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
│   ├── scene-engine.mjs
│   ├── virtual-camera-engine.mjs
│   ├── gesture-controller.mjs
│   ├── scene-player.mjs
│   └── scene-player.css
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
│   ├── virtual-camera-engine.test.mjs
│   ├── gesture-controller.test.mjs
│   ├── scene-player.test.mjs
│   ├── transition-engine.test.mjs
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

El módulo `engine/scene-engine.mjs` administra la secuencia de escenas, su preparación y activación, y el estado de la escena actual. Cada escena utiliza un ID estable como `SC-01`.

## Virtual Camera Engine

El módulo `engine/virtual-camera-engine.mjs` calcula el encuadre de una escena mediante keyframes de posición, escala y rotación. Recibe un progreso normalizado entre 0 y 1 y devuelve un transform CSS. No administra el tiempo ni crea animaciones autónomas: el reproductor controlará el progreso para mantener sincronizados cámara y duración de escena.

Admite easing lineal, ease-in, ease-out y ease-in-out, además de respetar reduced motion mostrando directamente el encuadre final.

## Gesture Controller

El módulo `engine/gesture-controller.mjs` reconoce gestos verticales mediante Pointer Events: swipe hacia arriba solicita avanzar una escena y swipe hacia abajo solicita retroceder una. Un gesto válido produce una sola acción; movimientos cortos, horizontales, secundarios o multitáctiles se ignoran. El controlador no avanza automáticamente ni muestra controles. Al conectarlo, debe montarse únicamente sobre el contenedor del reproductor; mientras está activo aplica `touch-action: none` a ese contenedor y restaura el valor anterior al destruirse. El reproductor conserva la responsabilidad de llamar a `SceneEngine.next()` o `SceneEngine.previous()`.

## Scene Player

`engine/scene-player.mjs` integra los tres motores. Recibe un elemento raíz y una lista de escenas, crea una única imagen visual, precarga el recurso siguiente, conecta los swipes con la navegación y sincroniza el movimiento de cámara con la duración de la escena. El movimiento termina al completar su duración, pero la escena permanece activa hasta otro swipe o una llamada explícita a `next()`, `previous()` o `goTo()`.

Cada escena requiere un `id` estable y una ruta `src` (o `image.src`). Puede incluir `alt`, `duration` en segundos y `camera` con `from`, `to` y `easing`. La opción `gestures: false` desactiva los swipes. La preferencia `prefers-reduced-motion` se respeta automáticamente o puede fijarse con `reducedMotion`.

Para montar el reproductor en una experiencia, importa `ScenePlayer` desde `../../engine/scene-player.mjs`, carga `../../engine/scene-player.css` y proporciona un contenedor vacío de pantalla completa. El módulo no añade texto, botones, indicadores ni audio.

## Transition Engine

`engine/transition-engine.mjs` anima el cambio entre dos capas visuales mediante Web Animations API. Incluye `cut`, `crossfade`, `fade-through-black`, `zoom` y `blur`; acepta duración y easing por escena. El reproductor utiliza dos capas de imagen para que la transición no interrumpa la escena saliente. Con `prefers-reduced-motion`, las transiciones se convierten en cambios inmediatos. La configuración opcional de una escena es `transition: { type: "crossfade", duration: 650, easing: "ease-in-out" }`.

## PWA y funcionamiento offline

- La biblioteca y el app shell se guardan en caché para abrir WebVid sin conexión después de una primera visita correcta.
- Las páginas y recursos de experiencias visitadas se guardan en una caché runtime con límite de 120 recursos, antigüedad máxima de 30 días y un límite declarado de 80 MB por recurso. Los vídeos precargados completos admiten solicitudes HTTP Range desde la copia local.
- El Service Worker elimina versiones antiguas de sus cachés al activarse.
- El futuro reproductor puede solicitar la precarga de recursos de una experiencia mediante el mensaje `WEBVID_PRECACHE_EXPERIENCE`, enviando una lista de URLs locales dentro del ámbito `/webvid/`.
- Una experiencia que nunca se haya visitado ni precargado no puede garantizarse disponible offline.

## Validación y despliegue

Cada push a `main` ejecuta GitHub Actions. El workflow comprueba la sintaxis JavaScript, ejecuta pruebas automáticas, valida campos y estructura del catálogo, comprueba referencias locales en HTML/CSS/JavaScript y ensambla el sitio en `dist/`. Si una comprobación falla, el despliegue se detiene.

Node.js se utiliza únicamente en GitHub Actions para validar y probar el código. La experiencia publicada se ejecuta en el navegador con HTML, CSS y JavaScript nativo; no necesita un servidor Node.js.

Las GitHub Actions se fijan mediante SHA completo y comentario de versión para evitar que una etiqueta mutable cambie silenciosamente.

Los guiones y documentos de producción no deben guardarse en este repositorio público. Excluirlos del artefacto de Pages no los vuelve privados si se comprometen en GitHub.

## Desarrollo local

Para probar la PWA debe servirse desde un origen HTTP(S); abrir `index.html` directamente como archivo no habilita Service Workers.

El workflow valida el catálogo y los motores. Las pruebas de instalación real, caché offline, gestos y rendimiento móvil deben completarse en un navegador Android, idealmente en Samsung S25.

## Sitio

https://renziito.github.io/webvid/
