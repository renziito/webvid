/**
 * WebVid Scene Engine
 * Administra secuencia, preparación, activación y estado de escenas.
 */
export class SceneEngine {
  constructor({ scenes = [], prepareScene = async () => {}, activateScene = async () => {}, onError = () => {} } = {}) {
    if (typeof prepareScene !== "function" || typeof activateScene !== "function" || typeof onError !== "function") {
      throw new TypeError("prepareScene, activateScene y onError deben ser funciones.");
    }
    this._scenes = [];
    this._index = -1;
    this._status = "idle";
    this._requestId = 0;
    this._listeners = new Map();
    this._prepareScene = prepareScene;
    this._activateScene = activateScene;
    this._onError = onError;
    this.setScenes(scenes);
  }

  setScenes(scenes) {
    this._assertAlive();
    if (!Array.isArray(scenes)) throw new TypeError("scenes debe ser un array.");
    const ids = new Set();
    const normalized = scenes.map((scene, index) => {
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) throw new TypeError(`La escena en posición ${index} no es válida.`);
      if (typeof scene.id !== "string" || !scene.id.trim()) throw new TypeError(`La escena en posición ${index} necesita un id estable.`);
      if (ids.has(scene.id)) throw new Error(`ID de escena duplicado: ${scene.id}`);
      ids.add(scene.id);
      if (scene.duration !== undefined && (!Number.isFinite(scene.duration) || scene.duration <= 0)) {
        throw new RangeError(`Duración inválida en la escena ${scene.id}.`);
      }
      if (scene.assets !== undefined && !Array.isArray(scene.assets)) throw new TypeError(`assets debe ser un array en la escena ${scene.id}.`);
      return Object.freeze({ ...scene, assets: Object.freeze([...(scene.assets || [])]) });
    });
    this._requestId += 1;
    this._scenes = Object.freeze(normalized);
    this._index = -1;
    this._status = "idle";
    this._emit("statechange", this.getSnapshot());
    return this.getSnapshot();
  }

  get scenes() { this._assertAlive(); return this._scenes; }
  get currentScene() { return this._index >= 0 ? this._scenes[this._index] ?? null : null; }
  get currentIndex() { return this._index; }
  getSnapshot() {
    return Object.freeze({ status: this._status, index: this._index, total: this._scenes.length, currentScene: this.currentScene });
  }

  on(eventName, listener) {
    this._assertAlive();
    if (typeof listener !== "function") throw new TypeError("El listener debe ser una función.");
    if (!this._listeners.has(eventName)) this._listeners.set(eventName, new Set());
    this._listeners.get(eventName).add(listener);
    return () => this.off(eventName, listener);
  }
  off(eventName, listener) { this._listeners.get(eventName)?.delete(listener); }

  async start(index = 0) {
    this._assertAlive();
    if (!this._scenes.length) throw new Error("No hay escenas para iniciar.");
    return this.goTo(index, { direction: "initial" });
  }
  async next() {
    this._assertAlive();
    if (this._index < 0) return this.start(0);
    if (this._index >= this._scenes.length - 1) return false;
    return this.goTo(this._index + 1, { direction: "forward" });
  }
  async previous() {
    this._assertAlive();
    if (this._index <= 0) return false;
    return this.goTo(this._index - 1, { direction: "backward" });
  }

  async goTo(index, { direction = "direct" } = {}) {
    this._assertAlive();
    if (!Number.isInteger(index) || index < 0 || index >= this._scenes.length) throw new RangeError(`Índice de escena fuera de rango: ${index}`);
    const requestId = ++this._requestId;
    const previousScene = this.currentScene;
    const nextScene = this._scenes[index];
    this._setStatus("loading");
    try {
      await this._prepareScene(nextScene, { index, total: this._scenes.length, previousScene, direction, requestId });
      if (requestId !== this._requestId || this._status === "destroyed") return false;
      const activated = await this._activateScene(nextScene, { index, previousScene, direction, requestId });
      if (requestId !== this._requestId || this._status === "destroyed") return false;
      if (activated === false) {
        this._setStatus(previousScene ? "ready" : "idle");
        return false;
      }
      this._index = index;
      this._setStatus("ready");
      const detail = Object.freeze({ scene: nextScene, previousScene, index, total: this._scenes.length, direction });
      this._emit("scenechange", detail);
      return detail;
    } catch (error) {
      if (requestId === this._requestId && this._status !== "destroyed") {
        this._setStatus(previousScene ? "ready" : "error");
        try { this._onError(error, { scene: nextScene, index }); } catch {}
        this._emit("error", { error, scene: nextScene, index });
      }
      throw error;
    }
  }

  destroy() {
    if (this._status === "destroyed") return;
    this._requestId += 1;
    this._index = -1;
    this._status = "destroyed";
    this._emit("statechange", this.getSnapshot());
    this._listeners.clear();
  }
  _setStatus(status) { this._status = status; this._emit("statechange", this.getSnapshot()); }
  _emit(eventName, detail) { for (const listener of this._listeners.get(eventName) || []) listener(detail); }
  _assertAlive() { if (this._status === "destroyed") throw new Error("SceneEngine ya fue destruido."); }
}
