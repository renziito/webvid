# Instrucciones para asistentes de IA — WebVid

Antes de proponer, diseñar o modificar una experiencia, lee `WEBVID_RULES.md` y `PRODUCTION_WORKFLOW.md`.

Reglas no negociables:
1. La experiencia web es exclusivamente visual: cero texto visible, cero audio, cero subtítulos y cero controles.
2. El guion TTS es un entregable separado en español por defecto. No incrustarlo en HTML, JavaScript, imágenes ni interfaz.
3. Sigue todas las fases del flujo de producción. No programes la experiencia final antes de presentar concepto, storyboard y guion para revisión.
4. Nunca publiques un borrador ni modifiques el catálogo de producción antes de recibir aprobación explícita: “Apruebo y publica esta experiencia”.
5. Las experiencias aprobadas viven en `experiencias/<slug>/`; el catálogo es `experiencias.json`.
6. Los guiones se guardan fuera del sitio publicado, en `guiones/<slug>.txt`, solo si el usuario acepta que el repositorio público permite verlos. Si deben ser privados, entrégalos fuera del repo o usa un repo privado.
7. La publicación se hace en `main` únicamente después de la aprobación. Verifica el deployment antes de afirmar que está publicado.
8. Prioriza Samsung S25, vertical 9:16, objetivo de 60 FPS, gestos de una escena por acción y diseño cinematográfico sin plantilla repetitiva.
9. Usa rutas relativas para que las experiencias funcionen bajo GitHub Pages en `/webvid/`.
10. Al revisar o reemplazar código, devuelve documentos completos, no fragmentos incompletos.

No asumas que un archivo guardado en GitHub equivale a una experiencia publicada. No afirmes que un preview, commit o deployment existe sin verificarlo.
