/**
 * WebVid Gesture Controller
 *
 * Reconoce un swipe vertical por Pointer Events y delega la navegación
 * al reproductor. Un gesto válido produce como máximo una acción.
 * El módulo no cambia de escena ni crea controles visibles.
 */
export class GestureController {
  constructor({
    element,
    onNext = () => {},
    onPrevious = () => {},
    threshold = 72,
    axisLockRatio = 1.2,
    preventScroll = true
  } = {}) {
    if (!element || typeof element.addEventListener !== "function" ||
        typeof element.removeEventListener !== "function") {
      throw new TypeError("element debe ser un elemento compatible con EventTarget.");
    }
    if (typeof onNext !== "function" || typeof onPrevious !== "function") {
      throw new TypeError("onNext y onPrevious deben ser funciones.");
    }
    if (!Number.isFinite(threshold) || threshold <= 0) {
      throw new RangeError("threshold debe ser un número mayor que cero.");
    }
    if (!Number.isFinite(axisLockRatio) || axisLockRatio < 1) {
      throw new RangeError("axisLockRatio debe ser un número igual o mayor que uno.");
    }

    this._element = element;
    this._onNext = onNext;
    this._onPrevious = onPrevious;
    this._threshold = threshold;
    this._axisLockRatio = axisLockRatio;
    this._preventScroll = Boolean(preventScroll);
    this._activePointers = new Set();
    this._gesture = null;
    this._destroyed = false;
    this._previousTouchAction = element.style?.touchAction;

    if (this._preventScroll && element.style) {
      element.style.touchAction = "none";
    }

    this._handlers = {
      pointerdown: event => this._onPointerDown(event),
      pointermove: event => this._onPointerMove(event),
      pointerup: event => this._onPointerUp(event),
      pointercancel: event => this._onPointerCancel(event),
      lostpointercapture: event => this._onPointerCancel(event)
    };

    for (const [type, handler] of Object.entries(this._handlers)) {
      element.addEventListener(type, handler, { passive: false });
    }
  }

  get active() {
    return !this._destroyed;
  }

  destroy() {
    if (this._destroyed) return;
    for (const [type, handler] of Object.entries(this._handlers)) {
      this._element.removeEventListener(type, handler);
    }
    if (this._preventScroll && this._element.style) {
      this._element.style.touchAction = this._previousTouchAction || "";
    }
    this._activePointers.clear();
    this._gesture = null;
    this._destroyed = true;
  }

  _onPointerDown(event) {
    if (this._destroyed ||
        (event.pointerType === "mouse" && event.button !== 0)) return;

    if (this._activePointers.size > 0) {
      this._activePointers.add(event.pointerId);
      this._gesture = null;
      return;
    }
    if (event.isPrimary === false) return;
    this._activePointers.add(event.pointerId);

    this._gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      consumed: false
    };
  }

  _onPointerMove(event) {
    const gesture = this._gesture;
    if (!gesture || gesture.pointerId !== event.pointerId ||
        this._activePointers.size !== 1) return;

    gesture.lastX = event.clientX;
    gesture.lastY = event.clientY;
    const deltaX = gesture.lastX - gesture.startX;
    const deltaY = gesture.lastY - gesture.startY;

    if (this._preventScroll && Math.abs(deltaY) > 8 &&
        Math.abs(deltaY) > Math.abs(deltaX)) {
      if (event.cancelable) event.preventDefault();
    }
  }

  _onPointerUp(event) {
    if (!this._activePointers.has(event.pointerId)) return;
    const gesture = this._gesture;
    const canRecognize = this._activePointers.size === 1 &&
      gesture && gesture.pointerId === event.pointerId;

    this._activePointers.delete(event.pointerId);
    this._gesture = null;

    if (!canRecognize || gesture.consumed) return;

    const endX = Number.isFinite(event.clientX) ? event.clientX : gesture.lastX;
    const endY = Number.isFinite(event.clientY) ? event.clientY : gesture.lastY;
    const deltaX = endX - gesture.startX;
    const deltaY = endY - gesture.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absY < this._threshold || absY <= absX * this._axisLockRatio) return;

    gesture.consumed = true;
    const detail = Object.freeze({
      pointerType: event.pointerType || "unknown",
      deltaX,
      deltaY,
      distance: absY
    });

    if (deltaY < 0) this._onNext(detail);
    else this._onPrevious(detail);
  }

  _onPointerCancel(event) {
    if (event.pointerId !== undefined) this._activePointers.delete(event.pointerId);
    else this._activePointers.clear();
    this._gesture = null;
  }
}
