/**
 * WebVid Transition Engine
 *
 * Ejecuta transiciones entre dos capas visuales usando Web Animations API.
 * No controla la secuencia ni el tiempo narrativo: ScenePlayer decide cuándo
 * cambiar y entrega la duración configurada para esa transición.
 */
export class TransitionEngine {
  constructor({ reducedMotion = false, animate } = {}) {
    this._reducedMotion = Boolean(reducedMotion);
    this._animate = typeof animate === "function"
      ? animate
      : (element, keyframes, options) => element.animate(keyframes, options);
    this._activeAnimations = [];
    this._generation = 0;
    this._destroyed = false;
  }

  setReducedMotion(enabled) {
    this._assertAlive();
    this._reducedMotion = Boolean(enabled);
    if (this._reducedMotion) this.cancel();
  }

  async play({
    from,
    to,
    type = "crossfade",
    duration = 650,
    easing = "ease-in-out",
    reducedMotion = this._reducedMotion
  } = {}) {
    this._assertAlive();
    if (!from || !to || typeof from.animate !== "function" ||
        typeof to.animate !== "function") {
      throw new TypeError("from y to deben ser elementos compatibles con Web Animations.");
    }
    if (!["cut", "crossfade", "fade-through-black", "zoom", "blur"].includes(type)) {
      throw new TypeError("Tipo de transición no soportado: " + type);
    }
    if (!Number.isFinite(duration) || duration < 0) {
      throw new RangeError("duration debe ser un número igual o mayor que cero.");
    }
    if (typeof easing !== "string" || !easing.trim()) {
      throw new TypeError("easing debe ser una cadena no vacía.");
    }

    this.cancel();
    const generation = ++this._generation;

    if (type === "cut" || reducedMotion || duration === 0) {
      this._setFinalState(from, to);
      return true;
    }

    const frames = this._keyframes(type);
    let animations;
    try {
      animations = [
        this._animate(from, frames.out, { duration, easing, fill: "both" }),
        this._animate(to, frames.in, { duration, easing, fill: "both" })
      ];
      this._activeAnimations = animations;
      await Promise.all(animations.map(animation => animation.finished));
    } catch (error) {
      if (generation !== this._generation || error?.name === "AbortError") return false;
      throw error;
    }

    if (generation !== this._generation || this._destroyed) return false;
    for (const animation of animations) animation.cancel();
    this._activeAnimations = [];
    this._setFinalState(from, to);
    return true;
  }

  cancel() {
    if (this._destroyed) return;
    this._generation += 1;
    for (const animation of this._activeAnimations) {
      try { animation.cancel(); } catch { /* animation already completed */ }
    }
    this._activeAnimations = [];
  }

  destroy() {
    if (this._destroyed) return;
    this.cancel();
    this._destroyed = true;
  }

  _keyframes(type) {
    if (type === "fade-through-black") {
      return {
        out: [{ opacity: 1 }, { opacity: 0, offset: 0.48 }, { opacity: 0 }],
        in: [{ opacity: 0 }, { opacity: 0, offset: 0.52 }, { opacity: 1 }]
      };
    }
    if (type === "zoom") {
      return {
        out: [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.08)" }],
        in: [{ opacity: 0, transform: "scale(1.08)" }, { opacity: 1, transform: "scale(1)" }]
      };
    }
    if (type === "blur") {
      return {
        out: [{ opacity: 1, filter: "blur(0px)" }, { opacity: 0, filter: "blur(14px)" }],
        in: [{ opacity: 0, filter: "blur(14px)" }, { opacity: 1, filter: "blur(0px)" }]
      };
    }
    return {
      out: [{ opacity: 1 }, { opacity: 0 }],
      in: [{ opacity: 0 }, { opacity: 1 }]
    };
  }

  _setFinalState(from, to) {
    from.style.opacity = "0";
    to.style.opacity = "1";
    from.style.filter = "";
    to.style.filter = "";
    from.style.transform = "";
    to.style.transform = "";
  }

  _assertAlive() {
    if (this._destroyed) throw new Error("TransitionEngine ya fue destruido.");
  }
}
