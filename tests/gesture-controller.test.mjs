import test from "node:test";
import assert from "node:assert/strict";
import { GestureController } from "../engine/gesture-controller.mjs";

class FakeElement {
  constructor() {
    this.style = { touchAction: "pan-y" };
    this.listeners = new Map();
  }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  dispatch(type, values = {}) {
    const event = {
      type,
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      cancelable: true,
      prevented: false,
      preventDefault() { this.prevented = true; },
      ...values
    };
    for (const handler of this.listeners.get(type) || []) handler(event);
    return event;
  }
}

function swipe(element, startY, endY, extra = {}) {
  element.dispatch("pointerdown", { clientY: startY, ...extra });
  return element.dispatch("pointerup", { clientY: endY, ...extra });
}

test("swipe hacia arriba solicita avanzar exactamente una escena", () => {
  const element = new FakeElement();
  const calls = [];
  new GestureController({
    element,
    onNext: detail => calls.push(["next", detail.deltaY]),
    onPrevious: () => calls.push(["previous"])
  });
  swipe(element, 180, 80);
  assert.deepEqual(calls, [["next", -100]]);
});

test("swipe hacia abajo solicita retroceder exactamente una escena", () => {
  const element = new FakeElement();
  const calls = [];
  new GestureController({
    element,
    onNext: () => calls.push("next"),
    onPrevious: () => calls.push("previous")
  });
  swipe(element, 80, 180);
  assert.deepEqual(calls, ["previous"]);
});

test("ignora movimientos cortos y gestos predominantemente horizontales", () => {
  const element = new FakeElement();
  let calls = 0;
  new GestureController({ element, onNext: () => calls++, onPrevious: () => calls++ });
  swipe(element, 100, 150);
  element.dispatch("pointerdown", { clientX: 100, clientY: 100 });
  element.dispatch("pointerup", { clientX: 190, clientY: 130 });
  assert.equal(calls, 0);
});

test("no dispara acciones para mouse secundario o puntero no primario", () => {
  const element = new FakeElement();
  let calls = 0;
  new GestureController({ element, onNext: () => calls++, onPrevious: () => calls++ });
  swipe(element, 180, 60, { pointerType: "mouse", button: 2 });
  swipe(element, 180, 60, { isPrimary: false, pointerId: 2 });
  assert.equal(calls, 0);
});

test("ignora gestos multitáctiles y cancela pointercancel", () => {
  const element = new FakeElement();
  let calls = 0;
  new GestureController({ element, onNext: () => calls++, onPrevious: () => calls++ });
  element.dispatch("pointerdown", { pointerId: 1, clientY: 180 });
  element.dispatch("pointerdown", { pointerId: 2, clientY: 180, isPrimary: false });
  element.dispatch("pointerup", { pointerId: 1, clientY: 60 });
  element.dispatch("pointerup", { pointerId: 2, clientY: 60, isPrimary: false });
  element.dispatch("pointerdown", { pointerId: 3, clientY: 180 });
  element.dispatch("pointercancel", { pointerId: 3 });
  element.dispatch("pointerup", { pointerId: 3, clientY: 60 });
  assert.equal(calls, 0);
});

test("previene scroll vertical solo cuando el gesto empieza a ser vertical", () => {
  const element = new FakeElement();
  new GestureController({ element });
  element.dispatch("pointerdown", { clientY: 100 });
  const move = element.dispatch("pointermove", { clientY: 125, clientX: 102 });
  assert.equal(move.prevented, true);
});

test("restaura touch-action y elimina listeners al destruirse", () => {
  const element = new FakeElement();
  const controller = new GestureController({ element });
  assert.equal(element.style.touchAction, "none");
  controller.destroy();
  assert.equal(element.style.touchAction, "pan-y");
  assert.equal(element.listeners.get("pointerdown").size, 0);
  assert.equal(controller.active, false);
});

test("valida opciones de configuración", () => {
  const element = new FakeElement();
  assert.throws(() => new GestureController({ element, threshold: 0 }), /threshold/);
  assert.throws(() => new GestureController({ element, axisLockRatio: 0.5 }), /axisLockRatio/);
  assert.throws(() => new GestureController({ element: {} }), /EventTarget/);
});
