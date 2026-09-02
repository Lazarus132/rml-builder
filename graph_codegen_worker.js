"use strict";

self.window = self;
self.__rmlScheduledCallbackSequence = 0;
self.__rmlCancelledScheduledCallbacks =
  new Set();
const scheduleWorkerCallback = (
  callback,
  argument
) => {
  const handle =
    ++self.__rmlScheduledCallbackSequence;
  queueMicrotask(() => {
    if (
      self.__rmlCancelledScheduledCallbacks
        .delete(handle)
    ) {
      return;
    }
    callback(argument);
  });
  return handle;
};
self.requestAnimationFrame =
  self.requestAnimationFrame ||
  (callback =>
    scheduleWorkerCallback(
      callback,
      performance.now()
    ));
self.cancelAnimationFrame =
  self.cancelAnimationFrame ||
  (handle =>
    self.__rmlCancelledScheduledCallbacks
      .add(handle));
self.requestIdleCallback =
  self.requestIdleCallback ||
  (callback =>
    scheduleWorkerCallback(
      callback,
      {
        didTimeout: false,
        timeRemaining: () => 50
      }
    ));
self.cancelIdleCallback =
  self.cancelIdleCallback ||
  (handle =>
    self.__rmlCancelledScheduledCallbacks
      .add(handle));
self.matchMedia =
  self.matchMedia ||
  (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }));
self.getComputedStyle =
  self.getComputedStyle ||
  (() => ({
    getPropertyValue: () => "",
    transform: "none"
  }));
self.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};
self.CSS = self.CSS || {
  escape(value) {
    return String(value || "")
      .replace(/[^A-Za-z0-9_-]/g, "\\$&");
  }
};
self.CustomEvent =
  self.CustomEvent ||
  class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
self.MutationObserver =
  self.MutationObserver ||
  class MutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
self.ResizeObserver =
  self.ResizeObserver ||
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
self.Element = self.Element || class Element {};
self.HTMLElement =
  self.HTMLElement || class HTMLElement extends self.Element {};

const emptyClassList = {
  add() {},
  remove() {},
  toggle() {
    return false;
  },
  contains() {
    return false;
  }
};
const emptyElement = {
  dataset: {},
  style: {
    setProperty() {},
    removeProperty() {}
  },
  classList: emptyClassList,
  appendChild() {},
  removeChild() {},
  replaceChildren() {},
  addEventListener() {},
  removeEventListener() {},
  setAttribute() {},
  removeAttribute() {},
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  }
};

self.document = {
  readyState: "loading",
  currentScript: null,
  documentElement: emptyElement,
  body: emptyElement,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return true;
  },
  getElementById() {
    return null;
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return {
      ...emptyElement,
      dataset: {},
      style: {
        setProperty() {},
        removeProperty() {}
      },
      classList: {
        ...emptyClassList
      }
    };
  }
};

let runtimeReady = null;

async function ensureRuntime(catalog) {
  if (runtimeReady) {
    return runtimeReady;
  }

  runtimeReady = (async () => {
    self.RMLResoniteApiCatalog =
      catalog || {
        schemaVersion: 4,
        catalogSource: "unavailable",
        engineVersion: "unknown",
        components: [],
        materials: [],
        commonMaterials: [],
        meshes: [],
        slotAttachOverloads: [],
        types: [],
        enums: [],
        assemblies: []
      };
    self.RMLFrooxComponentCatalog =
      self.RMLResoniteApiCatalog;

    importScripts(
      "node_graph.js?v=387-guidance-comments-global-v723"
    );
    importScripts(
      "mod_nodes.js?v=68-guidance-comments-global-v723"
    );
    importScripts(
      "visual_csharp.js?v=78-guidance-comments-global-v723"
    );
    importScripts(
      "api_nodes.js?v=64-guidance-comments-global-v723"
    );

    if (
      self.RMLApiNodeFactoryReady &&
      typeof self.RMLApiNodeFactoryReady.then ===
        "function"
    ) {
      await self.RMLApiNodeFactoryReady;
    }

    if (
      !self.RMLTypedNodeGraphGenerator ||
      typeof self.RMLTypedNodeGraphGenerator.build !==
        "function"
    ) {
      throw new Error(
        "Typed graph code generator was not initialized in the worker."
      );
    }
  })();

  return runtimeReady;
}

self.addEventListener("message", event => {
  const request = event.data || {};

  if (![
    "build",
    "buildCustomCSharp"
  ].includes(request.operation)) {
    return;
  }

  void (async () => {
    try {
      self.postMessage({
        id: request.id,
        progress: true,
        message:
          "Worker: loading Custom C# node modules…"
      });
      await ensureRuntime(request.catalog);

      if (request.operation === "buildCustomCSharp") {
        self.postMessage({
          id: request.id,
          progress: true,
          message:
            "Worker: building optimized syntax graph…"
        });
        const visualCSharp = self.RMLVisualCSharp;
        const fragment = visualCSharp?.createRoslynImportFragment?.(
          String(request.source || ""),
          request.parseResult,
          request.options || {}
        );
        self.postMessage({
          id: request.id,
          progress: true,
          message:
            "Worker: finalizing optimized syntax graph…"
        });
        self.postMessage({
          id: request.id,
          ok: fragment?.ok === true,
          result: fragment,
          error: fragment?.ok === true
            ? null
            : { name: "CustomCSharpBuildError", message: fragment?.diagnostics?.[0] || "The Custom C# graph could not be built." }
        });
        return;
      }

      const result =
        self.RMLTypedNodeGraphGenerator.build({
          state: request.state || {},
          entries: Array.isArray(request.entries)
            ? request.entries
            : []
        });

      self.postMessage({
        id: request.id,
        ok: true,
        result
      });
    } catch (error) {
      self.postMessage({
        id: request.id,
        ok: false,
        error: {
          name:
            error instanceof Error
              ? error.name
              : "Error",
          message:
            error instanceof Error
              ? error.message
              : String(error),
          stack:
            error instanceof Error
              ? error.stack || ""
              : ""
        }
      });
    }
  })();
});
