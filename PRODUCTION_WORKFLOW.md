# WebVid — Flujo de producción y publicación

Este procedimiento es obligatorio desde la idea hasta la publicación.

## Fase 1 — Brief
Definir tema, objetivo, audiencia, tono, idioma, duración deseada, restricciones de derechos y si requiere investigación factual. Entregable: brief y enfoque propuesto.

## Fase 2 — Investigación y concepto
Para temas factuales, contrastar fuentes, fechas, nombres y citas; separar hechos documentados de interpretación. Preparar fuentes aparte del guion.

Diseñar el arco dramático (introducción, desarrollo, clímax y cierre), normalmente 5–8 escenas, la idea visual de cada escena, dirección de arte, paleta, iluminación, composición, movimientos de cámara y ritmo.

Entregable: concepto y storyboard descriptivo.

## Fase 3 — Guion TTS
Crear el guion completo como texto independiente: lenguaje natural y locutable, puntuación y pausas, párrafos por cambio de idea, sin rótulos de escena ni notas visuales, sin instrucciones que el TTS pueda pronunciar. Duración y palabras estimadas van fuera del texto narrado.

Entregar el texto en la conversación y, cuando corresponda, como `guiones/<slug>.txt`. El repositorio actual es público; avisar que los guiones comprometidos allí serán visibles desde GitHub aunque no se publiquen en Pages.

**Puerta 1:** no comenzar la construcción final hasta que el usuario apruebe concepto y guion, o indique expresamente que se puede continuar con ambos pendientes.

## Fase 4 — Desarrollo visual
Crear:
- `experiencias/<slug>/index.html`
- `experiencias/<slug>/styles.css`
- `experiencias/<slug>/script.js`
- `experiencias/<slug>/assets/*`
- `experiencias/<slug>/metadata.json`

Cero texto visible, audio, voz, subtítulos o guion embebido. Sin controles visibles. Vertical 9:16, mobile-first, navegación de una escena por gesto y recursos con rutas relativas.

## Fase 5 — Preview
La preview no aparece en la biblioteca ni en el despliegue de producción. Preferir una vista previa aislada/local. Alternativamente, usar una rama temporal y despliegue separado si está configurado. Nunca usar `main` ni modificar el catálogo de producción para mostrar un borrador.

Presentar mecanismo de preview, guion separado, lista breve de escenas y limitaciones conocidas.

## Fase 6 — Revisión
El usuario puede solicitar cambios de imágenes, ritmo, escenas, movimiento, transiciones, color, composición o rendimiento. Corregir y entregar nueva preview.

**Puerta 2:** la frase recomendada es “Apruebo y publica esta experiencia”. Comentarios ambiguos no cuentan como autorización.

## Fase 7 — Publicación
Solo después de aprobación explícita:
1. Verificar recursos completos.
2. Crear/actualizar `experiencias/<slug>/` en `main`.
3. Añadir el registro en `experiencias.json`.
4. Confirmar que GitHub Actions termine correctamente.
5. Verificar URL pública y aparición en la biblioteca.
6. Entregar el guion TTS independientemente.
7. Informar URL y estado real.

No anunciar publicación hasta verificar archivos, catálogo y deployment.

## Fase 8 — Grabación y montaje
El usuario abre la experiencia desde la PWA, graba pantalla en Samsung, genera voz con su software TTS usando el guion separado e importa ambos en su editor para sincronizarlos. WebVid no genera el vídeo final ni incorpora reproductor de audio.

## Checklist
- [ ] Concepto y storyboard aprobados.
- [ ] Guion TTS aprobado y separado.
- [ ] Experiencia sin texto visible.
- [ ] Sin audio ni subtítulos.
- [ ] Formato vertical 9:16 comprobado.
- [ ] Una escena por gesto.
- [ ] Sin controles visibles.
- [ ] Recursos optimizados y rutas válidas.
- [ ] Preview revisada.
- [ ] Aprobación explícita recibida.
- [ ] Archivos publicados en carpeta correcta.
- [ ] Catálogo actualizado solo después de aprobar.
- [ ] GitHub Pages desplegado y URL comprobada.
- [ ] Guion entregado por separado.
