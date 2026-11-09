# WebVid Studio — editor del PWA

Estado: exportación progresiva en rama de desarrollo; pendiente de validación en navegador y Samsung S25.

## Objetivo

Studio lee el catálogo del PWA, carga la experiencia seleccionada y permite sincronizar una pista de audio local con las escenas. No importa ZIP ni HTML arbitrario.

## Render directo y almacenamiento

- Salida: 1080 × 1920, MP4 H.264 + AAC a 30 FPS.
- No existe un tope temporal impuesto por la aplicación; la duración efectiva depende de memoria, almacenamiento y compatibilidad del navegador.
- Mediabunny StreamTarget escribe el MP4 progresivamente, en bloques, a almacenamiento local en lugar de acumular todo el vídeo en un ArrayBuffer.
- Prioridad: selector de guardado del navegador; OPFS (almacenamiento privado del origen) cuando esté disponible; BufferTarget en memoria como último recurso.
- En navegadores sin almacenamiento progresivo, exportaciones largas pueden consumir mucha memoria. No se garantiza duración ilimitada.
- El audio se decodifica a AudioBuffer y se codifica en bloques de cuatro segundos para mostrar progreso y reducir picos de trabajo del codificador; el AudioBuffer completo sigue ocupando memoria.
- Las imágenes remotas ya convertidas a data URL se reutilizan entre fotogramas para evitar descargarlas y convertirlas repetidamente.
- La exportación verifica que se hayan renderizado fotogramas y escrito datos MP4 suficientes; rechaza archivos vacíos o incompletos.
- El progreso muestra frames, escena, tiempo transcurrido y una estimación restante basada en la velocidad observada.
- La finalización y escritura de metadatos MP4 es una fase separada; su duración no puede predecirse con precisión.
- El almacenamiento progresivo reduce el crecimiento de RAM del archivo de salida, pero requiere espacio libre en el dispositivo.

## Compatibilidad y límites conocidos

- Se requieren HTTPS, WebCodecs (VideoEncoder y AudioEncoder), H.264/AAC y SVG foreignObject.
- No se solicita permiso de captura de pantalla ni se necesita compartir una pestaña.
- SVG foreignObject varía entre navegadores. Mapas, canvas protegidos por CORS, imágenes remotas, filtros y recursos externos pueden no rasterizarse correctamente.
- Las animaciones CSS se posicionan mediante SET_SCENE y SEEK. La experiencia debe implementar WEBVID_STUDIO_PREVIEW.
- 30 FPS es la cadencia del archivo; la velocidad de render no está garantizada.
- No se afirma compatibilidad validada con Samsung S25 hasta ejecutar una prueba real.

## Adaptador de escenas

Una experiencia debe admitir WEBVID_STUDIO_PREVIEW con ?studio=1. SET_SCENE selecciona una escena y SEEK posiciona sus animaciones. Mapas o canvas propios pueden requerir un adaptador específico.

## Privacidad

El audio se mantiene en memoria local y no se transmite a GitHub ni a un servidor. El MP4 se escribe en almacenamiento local o se descarga al dispositivo.

## Validación pendiente

- Exportaciones reales de 78 segundos y de más de 90 segundos, y reproducción del MP4 resultante.
- Duración, sincronización, dimensiones y pistas de audio/vídeo.
- Selector de guardado, OPFS y fallback de memoria.
- Chrome Android y Samsung Internet en Samsung S25.
- Imágenes remotas, mapas Leaflet, canvas, pseudo-elementos, filtros y animaciones.
- Memoria, tiempo y almacenamiento disponible.


### Imágenes externas y CORS en la exportación

- Las imágenes remotas que permiten CORS se incrustan como data URLs para que el render SVG/Canvas pueda leerlas.
- Si el servidor remoto bloquea CORS, la exportación ya no se cancela por esa imagen: se conserva su espacio visual y se usa un fondo neutro.
- El mensaje final informa cuántas imágenes externas fueron sustituidas. Para conservar la fotografía original, debe usarse un recurso con permisos CORS o un asset local con licencia adecuada.
- Las URLs externas en propiedades CSS de imagen se eliminan del clon de render para evitar contaminar el canvas.
