/**
 * WebVid Virtual Camera Engine
 *
 * Calcula el encuadre virtual de una escena a partir de keyframes.
 * No crea timers ni depende de Node.js: el reproductor le entrega el progreso
 * normalizado (0..1) y aplica el resultado al elemento visual.
 */
export class VirtualCameraEngine {
  constructor({ render = () => {}, reducedMotion = false } = {}) {
    if (typeof render !== "function") {
      throw new TypeError("render debe ser una función.");
    }
    this._render = render;
    this._reducedMotion = Boolean(reducedMotion);
    this._motion = null;
    this._lastPose = Object.freeze({
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0
    });
    this._destroyed = false;
  }

  setMotion(motion = {}) {
    this._assertAlive();
    const from = this._normalizePose(motion.from || {});
    const to = this._normalizePose(motion.to || from);
    const easing = motion.easing || "ease-in-out";

    if (!["linear", "ease-in", "ease-out", "ease-in-out"].includes(easing)) {
      throw new TypeError(` easing no soportado: ${easing}`.trim());
    }

    this._motion = Object.freeze({ from, to, easing });
    return this.renderAt(0);
  }

  setReducedMotion(enabled) {
    this._assertAlive();
    this._reducedMotion = Boolean(enabled);
    return this.renderAt(this._reducedMotion ? 1 : 0);
  }

  renderAt(progress) {
    this._assertAlive();
    if (!Number.isFinite(progress)) {
      throw new TypeError("progress debe ser un número finito.");
    }

    const amount = Math.min(1, Math.max(0, progress));
    if (!this._motion) return this._apply(this._normalizePose({}));

    const effectiveProgress = this._reducedMotion ? 1 : amount;
    const eased = this._ease(effectiveProgress, this._motion.easing);
    const pose = this._interpolate(this._motion.from, this._motion.to, eased);
    return this._apply(pose);
  }

  reset() {
    this._assertAlive();
    this._motion = null;
    return this._apply(this._normalizePose({}));
  }

  get pose() {
    return this._lastPose;
  }

  toCssTransform(pose = this._lastPose) {
    return [
      `translate3d(${pose.x}%, ${pose.y}%, 0)`,
      `scale(${pose.scale})`,
      `rotate(${pose.rotation}deg)`
    ].join(" ");
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._motion = null;
  }

  _normalizePose(pose) {
    const normalized = {
      x: pose.x ?? 0,
      y: pose.y ?? 0,
      scale: pose.scale ?? 1,
      rotation: pose.rotation ?? 0
    };

    for (const [key, value] of Object.entries(normalized)) {
      if (!Number.isFinite(value)) {
        throw new TypeError(`El valor de cámara "${key}" debe ser finito.`);
      }
    }
    if (normalized.scale <= 0) {
      throw new RangeError("La escala de cámara debe ser mayor que cero.");
    }
    return Object.freeze(normalized);
  }

  _interpolate(from, to, progress) {
    return this._normalizePose({
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
      scale: from.scale + (to.scale - from.scale) * progress,
      rotation: from.rotation + (to.rotation - from.rotation) * progress
    });
  }

  _ease(progress, easing) {
    switch (easing) {
      case "linear":
        return progress;
      case "ease-in":
        return progress * progress;
      case "ease-out":
        return 1 - (1 - progress) ** 2;
      case "ease-in-out":
      default:
        return progress < 0.5
          ? 2 * progress * progress
          : 1 - ((-2 * progress + 2) ** 2) / 2;
    }
  }

  _apply(pose) {
    this._lastPose = Object.freeze({ ...pose });
    this._render(this._lastPose, this.toCssTransform(this._lastPose));
    return this._lastPose;
  }

  _assertAlive() {
    if (this._destroyed) {
      throw new Error("VirtualCameraEngine ya fue destruido.");
    }
  }
}
