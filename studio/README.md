# WebVid Studio V1.1 — desarrollo

Estado: implementación inicial en rama de desarrollo. No publicar ni fusionar sin aprobación explícita.

## Objetivo

Editor local para sincronizar una narración WAV con las escenas de una experiencia WebVid. La revisión precede siempre a la exportación.

## Módulos

- `index.html`: interfaz de Studio.
- `studio.css`: interfaz responsive mobile-first.
- `studio.mjs`: estado de proyecto, importación, sincronización y controles.
- `audio-analyzer.mjs`: decodificación WAV, forma de onda, RMS y detección inicial de silencios.

## Privacidad

El WAV se lee mediante File API, se decodifica con Web Audio API y se procesa en memoria local. No hay solicitudes de red que transmitan el audio ni persistencia del archivo.

## Algoritmo de sincronización inicial

1. Decodificar los canales y calcular una señal mono para análisis.
2. Calcular RMS y pico por bloques.
3. Detectar intervalos de baja energía.
4. Proponer un punto de corte cercano al centro de cada intervalo y a la división temporal ideal.
5. Permitir ajustar cada punto de entrada con controles manuales.

La detección de silencios no equivale a reconocimiento semántico de frases. La sincronización debe revisarse visualmente y escuchando la narración.

## Pendiente antes de exportar

- Renderizador determinista que pueda solicitar una escena en un instante concreto.
- Composición audiovisual sincronizada por timestamps.
- Codificación H.264/AAC y multiplexado MP4 local.
- Pruebas reales de soporte WebCodecs, memoria y rendimiento en Samsung Internet/Chrome para Samsung S25.
- Preview fiel a la composición final y aprobación explícita antes de exportar.

El botón de exportación permanece deshabilitado hasta implementar y validar esos componentes. No se debe sustituir silenciosamente MP4 por WebM.
