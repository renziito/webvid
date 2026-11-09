# WebVid Studio — editor del PWA

Estado: exportación directa en rama de desarrollo; pendiente de validación en navegador y Samsung S25.

## Objetivo

Studio lee el catálogo del PWA, carga la experiencia seleccionada y permite sincronizar una pista de audio local con las escenas. No importa ZIP ni HTML arbitrario.

## Flujo

1. Leer el catálogo PWA desde ../experiencias.json.
2. Cargar la experiencia y su metadata.json.
3. Obtener IDs de escena desde metadata o detectar las escenas del HTML.
4. Importar y decodificar audio localmente.
5. Calcular forma de onda y proponer puntos de entrada a partir de pausas.
6. Revisar y ajustar manualmente los cortes.
7. Sincronizar escena y progreso de animación con el reloj del audio.
8. Abrir el lienzo Render y generar MP4 mediante render directo del documento, sin getDisplayMedia ni captura de pestaña.

## Render directo

- Salida: 1080 × 1920, MP4 H.264 + AAC.
- Cadencia actual: 30 FPS para reducir carga de CPU, memoria y codificación en móviles. No se promete 60 FPS en dispositivos móviles.
- Motor de codificación/multiplexado: Mediabunny y WebCodecs.
- Cada frame se reconstruye desde el DOM de la escena activa mediante estilos computados y SVG foreignObject, y se rasteriza a un canvas que alimenta el codificador.
- El AudioBuffer local se agrega como pista AAC independiente.
- El proceso se ejecuta en el navegador; no se sube audio ni video a un servidor.
- El búfer final permanece en memoria y el límite de duración sigue siendo 90 segundos.

## Compatibilidad y límites conocidos

- Se requieren HTTPS, WebCodecs (VideoEncoder y AudioEncoder), soporte de H.264/AAC y SVG foreignObject.
- No se solicita permiso de captura de pantalla ni se necesita compartir una pestaña.
- SVG foreignObject tiene diferencias entre navegadores. Algunas experiencias con mapas, canvas protegidos por CORS, imágenes remotas sin permisos CORS, filtros o recursos externos pueden no rasterizarse correctamente.
- Las animaciones CSS se posicionan mediante SET_SCENE y SEEK. El resultado depende de que la experiencia implemente el adaptador WEBVID_STUDIO_PREVIEW.
- Las escenas con recursos de terceros deben terminar de cargar antes de exportar.
- 30 FPS es la cadencia del archivo; la velocidad de render no está garantizada y el procesamiento puede tardar más que la duración del audio.
- No se afirma compatibilidad validada con Samsung S25 hasta ejecutar una prueba real.

## Adaptador de escenas

Una experiencia debe admitir el canal WEBVID_STUDIO_PREVIEW cuando se ejecuta con ?studio=1. SET_SCENE selecciona una escena y SEEK posiciona sus animaciones. Las experiencias con mapas o canvas propios pueden requerir un adaptador de render específico.

## Privacidad

El audio se mantiene en memoria local y no se transmite a GitHub ni a un servidor. El MP4 se genera en el dispositivo.

## Validación pendiente

- Ejecutar una exportación real y comprobar que el MP4 abre en reproductores externos.
- Verificar duración, sincronización, dimensiones y ambas pistas.
- Probar Chrome Android y Samsung Internet en Samsung S25.
- Validar imágenes remotas, mapas Leaflet, canvas, pseudo-elementos, filtros y animaciones.
- Medir memoria y tiempo de exportación; estudiar salida progresiva a disco.
