# WebVid Studio — editor del PWA

Estado: implementación en rama de desarrollo. No se publica automáticamente desde ramas feature.

## Objetivo

Studio es un editor audiovisual independiente del catálogo de experiencias. No importa ZIP ni HTML local: lee experiencias.json y carga la experiencia seleccionada desde el propio PWA/GitHub Pages. El usuario importa únicamente el audio.

## Flujo de trabajo

1. Leer el catálogo PWA desde ../experiencias.json.
2. Cargar la experiencia y su metadata.json dentro del preview.
3. Obtener los IDs de escena del metadata; si no existen, detectar las escenas del HTML.
4. Importar WAV, MP3, M4A, AAC, OGG, FLAC o WebM que el navegador pueda decodificar.
5. Decodificar localmente con Web Audio API, calcular forma de onda y proponer puntos de entrada a partir de pausas.
6. Revisar y ajustar cada punto de entrada en el timeline.
7. Sincronizar la escena y el progreso de sus animaciones con el reloj del audio.
8. Abrir el lienzo de render 9:16, compartir esa pestaña en el selector de captura y generar MP4 local.

## Render y exportación

- Lienzo de salida: 1080 × 1920.
- Cadencia objetivo: 60 FPS.
- Contenedor: MP4.
- Códecs: H.264/AVC y AAC.
- Motor de codificación/multiplexado: Mediabunny, cargado desde jsDelivr y precargado por el Service Worker cuando hay conexión.
- El audio se agrega desde el AudioBuffer decodificado; no se graba desde el micrófono ni desde el audio del sistema.
- La imagen se captura desde la pestaña Render elegida por el usuario, se recorta al lienzo vertical y se codifica desde un canvas.
- El render usa un búfer en memoria y limita esta primera versión a 90 segundos para reducir el riesgo de agotamiento de memoria.

## Adaptador de escenas

Una experiencia debe admitir el canal WEBVID_STUDIO_PREVIEW en su script cuando se ejecuta con ?studio=1. Los mensajes SET_SCENE y SEEK permiten seleccionar una escena y posicionar sus animaciones. El editor mantiene un fallback para experiencias cuyo HTML expone .scene o data-scene-id.

Inside the Algorithm ya implementa el control de escena del preview. Lima bajo la lluvia ahora desactiva sus gestos durante Studio y acepta los mismos mensajes. Las animaciones o mapas externos de cada experiencia pueden imponer límites adicionales a la captura determinista.

## Compatibilidad y límites conocidos

- Se requieren HTTPS, getDisplayMedia, VideoEncoder y AudioEncoder.
- Al exportar, el usuario debe compartir la pestaña Render, no el monitor completo.
- La disponibilidad de captura de pestaña y H.264/AAC depende del navegador y del dispositivo. La presencia de la interfaz no garantiza soporte en todos los móviles.
- La captura de pantalla en tiempo real y la codificación a 60 FPS son objetivos; no se garantiza que todos los equipos mantengan 60 fotogramas únicos por segundo.
- La librería Mediabunny se precarga en caché cuando es posible; la primera instalación necesita conexión para obtener el módulo de codificación.
- Las referencias externas de una experiencia (imágenes, mapas, tipografías) deben estar cargadas antes de exportar. La disponibilidad de terceros puede afectar el render.
- No se afirma compatibilidad validada con Samsung S25 hasta ejecutar una prueba real en ese dispositivo.

## Privacidad

El audio importado se mantiene en memoria local y no se transmite a GitHub ni a un servidor. La captura de pantalla se utiliza únicamente para el render solicitado por el usuario.

## Validación pendiente antes de producción

- Ejecutar la exportación real y comprobar que el MP4 se abre en reproductores externos.
- Verificar duración, sincronización, dimensiones, 60 FPS de salida y presencia de ambas pistas.
- Probar el flujo en Chrome desktop, Samsung Internet y Chrome en Samsung S25.
- Revisar escenas con mapas, imágenes remotas y animaciones CSS complejas.
- Evaluar memoria para duraciones superiores a 90 segundos y migrar a salida progresiva a disco.
