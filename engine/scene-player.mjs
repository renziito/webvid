import { SceneEngine } from "./scene-engine.mjs";
import { VirtualCameraEngine } from "./virtual-camera-engine.mjs";
import { GestureController } from "./gesture-controller.mjs";
import { TransitionEngine } from "./transition-engine.mjs";

/**
 * WebVid Scene Player
 *
 * Conecta SceneEngine, VirtualCameraEngine y GestureController.
 * Reproduce una sola escena a la vez. La cámara se mueve durante la escena,
 * pero el reproductor nunca avanza automáticamente.
 *
 * Scene schema:
 * {
 *   id: "SC-01",
 *   duration: 8, // seconds
 *   src: "./assets/scene-01.webp",
 *   alt: "Descripción accesible de la imagen",
 *   camera: { from: { scale: 1 }, to: { x: -3, scale: 1.12 }, easing: "ease-in-out" }
 * }
 */
export class ScenePlayer {
  constructor({
    root,
    scenes = [],
    gestures = true,
    swipeThreshold = 72,
    reducedMotion,
    onSceneChange = () => {},
    onError = () => {},
    imageFactory = () => new Image(),
    requestFrame = callback => requestAnimationFrame(callback),
    cancelFrame = id => cancelAnimationFrame(id),
    now = () => performance.now()
  } = {}) {
    if (!root || typeof root.appendChild !== "function" ||
        typeof root.ownerDocument?.createElement !== "function") {
      throw new TypeError("root debe ser un elemento DOM válido.");
    }
    if (typeof onSceneChange !== "function" || typeof onError !== "function") {
      throw new TypeError("onSceneChange y onError deben ser funciones.");
    }
    if (typeof imageFactory !== "function" || typeof requestFrame !== "function" ||
        typeof cancelFrame !== "function" || typeof now !== "function") {
      throw new TypeError("Las dependencias de imagen y animación deben ser funciones.");
    }

    this.root = root;
    this._document = root.ownerDocument;
    this._onSceneChange = onSceneChange;
    this._onError = onError;
    this._imageFactory = imageFactory;
    this._requestFrame = requestFrame;
    this._cancelFrame = cancelFrame;
    this._now = now;
    this._destroyed = false;
    this._frameId = null;
    this._sceneStartedAt = 0;
    this._activeDuration = 1;
    this._preloaded = new Map();
    this._unsubscribe = [];
    this._backNavigationInstalled = false;
    this._handlePopState = null;
    this._previousRootClass = root.className || "";

    const mediaQuery = typeof reducedMotion === "boolean"
      ? null
      : globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    this._reducedMotionQuery = mediaQuery || null;
    this._reducedMotion = typeof reducedMotion === "boolean"
      ? reducedMotion
      : Boolean(mediaQuery?.matches);

    root.classList?.add("webvid-player");
    root.setAttribute?.("aria-label", "Experiencia visual WebVid");
    root.setAttribute?.("aria-roledescription", "reproductor visual");

    this.image = this._createImageLayer();
    this._spareImage = this._createImageLayer();
    this._spareImage.style.opacity = "0";
    root.appendChild(this.image);
    root.appendChild(this._spareImage);

    this.transitions = new TransitionEngine({ reducedMotion: this._reducedMotion });

    this.camera = new VirtualCameraEngine({
      reducedMotion: this._reducedMotion,
      render: (_pose, transform) => {
        if (!this._destroyed) this.image.style.transform = transform;
      }
    });

    this.engine = new SceneEngine({
      scenes,
      prepareScene: scene => this._prepareScene(scene),
      activateScene: scene => this._activateScene(scene),
      onError: (error, detail) => this._reportError(error, detail)
    });

    this._unsubscribe.push(
      this.engine.on("scenechange", detail => {
        this._beginCameraTimeline(detail.scene);
        this._onSceneChange(detail);
        this._preloadNext(detail.index + 1);
      })
    );

    this._handleMotionChange = event => {
      this._reducedMotion = Boolean(event.matches);
      if (!this._destroyed) {
        this.camera.setReducedMotion(this._reducedMotion);
        this.transitions.setReducedMotion(this._reducedMotion);
      }
      if (this._reducedMotion) this._stopCameraTimeline();
      else if (this.engine.currentScene) this._beginCameraTimeline(this.engine.currentScene);
    };

    if (this._reducedMotionQuery?.addEventListener) {
      this._reducedMotionQuery.addEventListener("change", this._handleMotionChange);
    } else if (this._reducedMotionQuery?.addListener) {
      this._reducedMotionQuery.addListener(this._handleMotionChange);
    }

    this.gestures = gestures
      ? new GestureController({
          element: root,
          threshold: swipeThreshold,
          onNext: () => this.next(),
          onPrevious: () => this.previous()
        })
      : null;
  }

  get currentScene() {
    return this.engine.currentScene;
  }

  get currentIndex() {
    return this.engine.currentIndex;
  }

  get totalScenes() {
    return this.engine.scenes.length;
  }

  async start(index = 0) {
    this._assertAlive();
    this._installBackNavigation();
    return this.engine.start(index);
  }

  async next() {
    this._assertAlive();
    try {
      return await this.engine.next();
    } catch (error) {
      this._reportError(error, { action: "next" });
      return false;
    }
  }

  async previous() {
    this._assertAlive();
    try {
      return await this.engine.previous();
    } catch (error) {
      this._reportError(error, { action: "previous" });
      return false;
    }
  }

  async goTo(index) {
    this._assertAlive();
    try {
      return await this.engine.goTo(index);
    } catch (error) {
      this._reportError(error, { action: "goTo", index });
      return false;
    }
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    this._stopCameraTimeline();
    if (this._handlePopState && globalThis.window?.removeEventListener) {
      globalThis.window.removeEventListener("popstate", this._handlePopState);
    }
    this.gestures?.destroy();
    for (const unsubscribe of this._unsubscribe) unsubscribe();
    this._unsubscribe = [];

    if (this._reducedMotionQuery?.removeEventListener) {
      this._reducedMotionQuery.removeEventListener("change", this._handleMotionChange);
    } else if (this._reducedMotionQuery?.removeListener) {
      this._reducedMotionQuery.removeListener(this._handleMotionChange);
    }

    this.engine.destroy();
    this.camera.destroy();
    this.transitions.destroy();
    this.image.remove?.();
    this._spareImage.remove?.();
    this.root.className = this._previousRootClass;
    this.root.removeAttribute?.("aria-label");
    this.root.removeAttribute?.("aria-roledescription");
    this._preloaded.clear();
  }

  async _prepareScene(scene) {
    const src = this._sourceFor(scene);
    const existing = this._preloaded.get(src);
    if (existing) return existing;

    const preload = this._imageFactory();
    const promise = new Promise((resolve, reject) => {
      if (preload.complete && preload.naturalWidth > 0) {
        resolve(preload);
        return;
      }
      preload.onload = async () => {
        try {
          if (typeof preload.decode === "function") await preload.decode();
          resolve(preload);
        } catch (error) {
          reject(error);
        }
      };
      preload.onerror = () => reject(new Error("No se pudo cargar el recurso visual: " + src));
      preload.src = src;
    });

    this._preloaded.set(src, promise);
    try {
      await promise;
      return preload;
    } catch (error) {
      this._preloaded.delete(src);
      throw error;
    }
  }

  async _activateScene(scene) {
    const src = this._sourceFor(scene);
    const hasCurrentScene = Boolean(this.engine.currentScene);

    if (!hasCurrentScene) {
      this.image.src = src;
      this.image.alt = typeof scene.alt === "string" ? scene.alt : "";
    } else {
      this._spareImage.src = src;
      this._spareImage.alt = typeof scene.alt === "string" ? scene.alt : "";
      const transition = scene.transition && typeof scene.transition === "object"
        ? scene.transition
        : {};
      const completed = await this.transitions.play({
        from: this.image,
        to: this._spareImage,
        type: transition.type || "crossfade",
        duration: transition.duration ?? 650,
        easing: transition.easing || "ease-in-out"
      });
      if (!completed || this._destroyed) return false;

      const previousImage = this.image;
      this.image = this._spareImage;
      this._spareImage = previousImage;
    }

    this.image.style.transformOrigin = "center center";
    this.image.style.willChange = this._reducedMotion ? "auto" : "transform";

    const motion = scene.camera && typeof scene.camera === "object"
      ? scene.camera
      : { from: {}, to: {} };
    this.camera.setMotion(motion);
    return true;
  }

  _installBackNavigation() {
    if (this._backNavigationInstalled || !globalThis.history?.pushState ||
        !globalThis.location || !globalThis.window?.addEventListener) return;
    const libraryUrl = new URL("../", import.meta.url);
    this._handlePopState = () => {
      if (globalThis.location.pathname !== libraryUrl.pathname) {
        globalThis.location.replace(libraryUrl.href);
      }
    };
    globalThis.window.addEventListener("popstate", this._handlePopState);
    globalThis.history.pushState(
      { ...(globalThis.history.state || {}), webvidExperience: true },
      "",
      globalThis.location.href
    );
    this._backNavigationInstalled = true;
  }

  _createImageLayer() {
    const image = this._document.createElement("img");
    image.className = "webvid-player__image";
    image.alt = "";
    image.draggable = false;
    image.decoding = "async";
    image.fetchPriority = "high";
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  _sourceFor(scene) {
    const src = typeof scene.src === "string"
      ? scene.src
      : scene.image?.src;
    if (typeof src !== "string" || !src.trim()) {
      throw new TypeError("La escena " + scene.id + " necesita src o image.src.");
    }
    return src;
  }

  _preloadNext(index) {
    const scene = this.engine.scenes[index];
    if (!scene) return;
    this._prepareScene(scene).catch(error => this._reportError(error, {
      scene, action: "preload"
    }));
  }

  _beginCameraTimeline(scene) {
    this._stopCameraTimeline();
    this._sceneStartedAt = this._now();
    this._activeDuration = Number.isFinite(scene.duration) && scene.duration > 0
      ? scene.duration * 1000
      : 8000;

    if (this._reducedMotion) {
      this.camera.renderAt(1);
      return;
    }

    const tick = timestamp => {
      if (this._destroyed) return;
      const elapsed = Math.max(0, (Number.isFinite(timestamp) ? timestamp : this._now()) - this._sceneStartedAt);
      const progress = Math.min(1, elapsed / this._activeDuration);
      this.camera.renderAt(progress);

      // La cámara se detiene al terminar el movimiento; la escena no avanza sola.
      if (progress < 1) this._frameId = this._requestFrame(tick);
      else this._frameId = null;
    };

    this._frameId = this._requestFrame(tick);
  }

  _stopCameraTimeline() {
    if (this._frameId !== null) {
      this._cancelFrame(this._frameId);
      this._frameId = null;
    }
  }

  _reportError(error, detail = {}) {
    try {
      this._onError(error, detail);
    } catch {
      // Los callbacks de observación no deben romper el estado interno del reproductor.
    }
  }

  _assertAlive() {
    if (this._destroyed) throw new Error("ScenePlayer ya fue destruido.");
  }
}
