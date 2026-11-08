# WebVid — Reglas permanentes del proyecto

Estas reglas son la fuente de verdad para cualquier persona o asistente que diseñe, programe, revise o publique una experiencia WebVid.

## 1. Producto
WebVid produce experiencias visuales cinematográficas verticales que el usuario graba como vídeo y posteriormente sincroniza con una narración TTS en un editor externo.

Cada experiencia tiene dos entregables independientes:
1. **Experiencia web:** secuencia visual sin texto visible.
2. **Guion TTS:** archivo de texto independiente, en español por defecto, listo para copiar a un motor de texto a voz.

La web no reproduce ni incorpora el guion. La voz se genera y sincroniza fuera de WebVid.

## 2. Regla absoluta: cero texto visible en la experiencia
Dentro de la experiencia cinematográfica no se muestran títulos, encabezados, subtítulos, párrafos, leyendas, palabras, letras, números, fechas, créditos, botones, flechas, instrucciones, contadores, barras, indicadores, controles ni interfaces de reproductor.

La experiencia comunica mediante imágenes, composición, fotografía, ilustración, movimiento, luz, color y transiciones. Los metadatos de la biblioteca (título, descripción y categoría) son independientes y pueden mostrarse en la pantalla principal de WebVid; no deben filtrarse dentro de la experiencia.

Se permiten atributos técnicos no visibles como alt, aria-label y metadatos HTML por accesibilidad, SEO o mantenimiento, siempre que no se rendericen como texto en pantalla.

## 3. Guion TTS independiente
Cada experiencia produce tres entregables independientes: (1) web visual, (2) guion TTS en `guiones/<slug>.txt`, y (3) documento de desglose de escenas en `produccion/<slug>-escenas.md`. El guion se entrega también en la conversación para copiarlo fácilmente.

El texto debe:
- Estar en español salvo que el usuario solicite otro idioma.
- Ser natural al pronunciarse, con puntuación y pausas claras.
- Separar ideas en párrafos.
- No contener etiquetas de escena, instrucciones de cámara, notas de producción, emojis ni referencias que el TTS vaya a leer accidentalmente.
- No incluir encabezados técnicos dentro del texto narrado.
- Incluir duración y recuento estimados como metadatos separados del texto narrado.

El guion puede acompañar el ritmo de la película, pero no tiene que describir literalmente cada imagen ni coincidir palabra por palabra con los cambios de escena.

## 4. Formato y dirección cinematográfica
- Formato vertical 9:16, referencia de diseño 1080 × 1920.
- Mobile-first; prioridad de validación en Samsung S25.
- Ocupar toda el área disponible, respetando safe areas.
- Normalmente 5–8 escenas y alrededor de 60 segundos de recorrido visual, salvo que el concepto requiera otra duración.
- Introducción, desarrollo, clímax y cierre.
- Sensación de película, no de presentación de diapositivas.
- Cámara virtual, zoom, travelling, parallax, profundidad, transformaciones y movimiento coordinado.
- Identidad artística propia para cada tema; no repetir una plantilla superficial.
- Fotografía, ilustraciones y recursos con calidad suficiente para pantalla completa.
- Objetivo de 60 FPS en dispositivos compatibles.
- Optimizar imágenes (preferentemente WebP/AVIF), carga y memoria.
- Precargar la siguiente escena cuando sea viable.
- Respetar `prefers-reduced-motion` con una alternativa visual apropiada.

## 5. Navegación
- Una acción de gesto equivale a una escena.
- Swipe hacia arriba: avanzar una escena.
- Swipe hacia abajo: retroceder una escena.
- Un tap corto puede avanzar solo si no interfiere con swipe, controles del sistema o accesibilidad.
- Evitar saltos de varias escenas por un único gesto o trackpad.
- No usar temporizador automático.
- No mostrar controles ni indicadores de navegación.
- Gestionar viewport móvil, safe areas y eventos touch/pointer.
- El retroceso del sistema debe permitir volver a la biblioteca sin quedar atrapado.

## 6. Arquitectura
Cada experiencia publicada vive en `experiencias/<slug>/`:
```
experiencias/<slug>/
  index.html
  styles.css
  script.js
  assets/
  metadata.json
```
El guion separado se mantiene en `guiones/<slug>.txt`. El mapa de escenas y continuidad se mantiene en `produccion/<slug>-escenas.md` y sigue la plantilla `SCENE_BREAKDOWN_TEMPLATE.md`.

El catálogo de la biblioteca está en `experiencias.json`. Solo contiene experiencias aprobadas y publicadas. Cada registro usa como mínimo `title`, `description`, `path`, `category` y opcionalmente `accent` (color hexadecimal). Los títulos y descripciones del catálogo son elementos de navegación, no texto dentro de la película.

## 7. Documento de escenas y mantenimiento
Cada experiencia debe tener un documento `produccion/<slug>-escenas.md` separado del guion TTS y de la web. Debe describir escena por escena: ID estable (SC-01, SC-02…), tiempo estimado, fragmento exacto del guion que acompaña, función narrativa, por qué está ahí, intención emocional, imagen principal, rutas de assets, origen/licencia, composición, iluminación, color, movimiento, transiciones, duración, relación con la narración y criterios de aceptación.

El documento permite pedir cambios precisos como “en la escena 3 cambia la imagen por…”. Los IDs de escena se mantienen estables. Registrar cambios, archivos afectados y estado. Si un cambio afecta escenas vecinas o la continuidad, señalarlo y actualizar el desglose. El documento es de producción y nunca se muestra en la experiencia web.

## 8. Privacidad y publicación de guiones
El sitio GitHub Pages debe contener solo los archivos necesarios para la PWA, el catálogo y las experiencias aprobadas. El workflow excluye `guiones/`, documentación, previews y archivos de trabajo del artefacto publicado.

**Importante:** el repositorio actual es público. Aunque `guiones/` se excluya del sitio GitHub Pages, los archivos comprometidos en el repositorio siguen siendo visibles desde GitHub. No guardar información privada o confidencial allí. Si un guion debe ser privado, entregarlo fuera del repositorio o usar un repositorio privado.

## 9. Estados y aprobación obligatoria
Estados:
1. Idea.
2. Investigación.
3. Concepto y storyboard.
4. Guion TTS.
5. Guion pendiente de aprobación.
6. Desarrollo visual.
7. Preview.
8. Cambios solicitados.
9. Aprobada.
10. Publicada.

No publicar ni agregar al catálogo por inferencia, entusiasmo o comentarios ambiguos. La autorización debe ser explícita, por ejemplo: **“Apruebo y publica esta experiencia”**.

Antes de esa autorización:
- No escribir archivos finales en la rama `main`.
- No actualizar `experiencias.json`.
- No desplegar la experiencia en la biblioteca pública.
- Mantener los archivos de preview fuera del artefacto de producción.

Si hay soporte para ramas, se puede trabajar en una rama temporal de preview. De lo contrario, entregar una vista previa local/adjunta o una previsualización aislada que no se despliegue en producción.

## 10. Calidad antes de publicar
Comprobar:
- No existe texto visible dentro de la experiencia.
- No incluye audio ni guion embebido.
- Las imágenes cargan y tienen resolución adecuada.
- Todos los recursos usan rutas relativas compatibles con GitHub Pages bajo `/webvid/`.
- Funciona en orientación vertical en Android.
- Swipe y retroceso funcionan correctamente.
- No hay controles, indicadores ni elementos de interfaz visibles.
- No hay errores de consola ni recursos rotos.
- El movimiento es fluido y no bloquea la navegación.
- Funciona al abrir directamente su URL y al entrar desde la biblioteca.
- El guion TTS es independiente y fue entregado al usuario.
- El documento de escenas está completo y coincide con la versión final.

Solo después de validar y recibir aprobación explícita se publica.

## 11. Idioma y comunicación
- Todo el contenido y la comunicación del proyecto en español por defecto.
- Fuentes y referencias se entregan por separado del guion.
- No inventar hechos, citas, fechas, material visual ni derechos de uso.
- Identificar recursos generados, de archivo o con licencia cuando sea relevante.
