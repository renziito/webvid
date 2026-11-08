# WebVid Studio

WebVid es una plataforma mobile-first para experiencias cinematográficas verticales, exclusivamente visuales. El usuario graba cada experiencia desde su teléfono, genera la narración por separado con texto a voz y combina ambos elementos en un editor externo.

## Documentación obligatoria
- [Reglas permanentes del proyecto](WEBVID_RULES.md)
- [Flujo de producción y aprobación](PRODUCTION_WORKFLOW.md)
- [Instrucciones para asistentes de IA](.github/copilot-instructions.md)
- [Plantilla de desglose de escenas](SCENE_BREAKDOWN_TEMPLATE.md)
- [Instrucciones para el Proyecto ChatGPT](CHATGPT_PROJECT_INSTRUCTIONS.md)

## Modelo de producción
Cada experiencia tiene dos entregables independientes:
1. Una web visual 9:16 **sin texto visible, sin audio, sin subtítulos y sin controles**.
2. Un guion TTS independiente, en español por defecto.
3. Un documento de escenas que relaciona cada fragmento del guion con imágenes, propósito narrativo y especificaciones visuales.

Ningún borrador se publica en la biblioteca antes de la aprobación explícita del usuario: **“Apruebo y publica esta experiencia”**.

## Estructura
```
webvid/
├── index.html
├── manifest.webmanifest
├── sw.js
├── icon.svg
├── experiencias.json
├── experiencias/<slug>/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── metadata.json
│   └── assets/
├── guiones/<slug>.txt
├── produccion/<slug>-escenas.md
├── SCENE_BREAKDOWN_TEMPLATE.md
├── CHATGPT_PROJECT_INSTRUCTIONS.md
├── WEBVID_RULES.md
├── PRODUCTION_WORKFLOW.md
└── .github/
    ├── copilot-instructions.md
    └── workflows/pages.yml
```

## Publicación y privacidad
GitHub Pages publica únicamente la PWA, el catálogo y las experiencias aprobadas. El workflow construye el directorio `dist/` y excluye guiones y documentación del sitio.

**Este repositorio es público.** Los archivos de `guiones/` no se despliegan en el sitio web, pero siguen siendo visibles para cualquiera que navegue el repositorio GitHub. No guardar guiones confidenciales aquí. Para mantenerlos privados, entregarlos fuera del repositorio o usar un repositorio privado.

## Sitio
https://renziito.github.io/webvid/

Solo las experiencias aprobadas deben incorporarse a `experiencias.json` y a la rama de producción `main`. Sigue siempre el [flujo de producción](PRODUCTION_WORKFLOW.md).
