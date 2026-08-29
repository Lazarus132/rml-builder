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
let customCSharpRuntimeReady = null;

async function ensureCustomCSharpRuntime(definitions, typeDefinitions) {
  if (customCSharpRuntimeReady) return customCSharpRuntimeReady;
  customCSharpRuntimeReady = (async () => {
    self.RMLResoniteApiCatalog = {
      schemaVersion: 1,
      catalogSource: "unavailable",
      engineVersion: "unknown",
      types: [],
      enums: [],
      assemblies: []
    };
    self.RMLFrooxComponentCatalog = self.RMLResoniteApiCatalog;
    importScripts("node_graph.js?v=301-consolidated-custom-contracts-v603f53");
    importScripts("visual_csharp.js?v=30-consolidated-custom-contracts-v603f53");
    const registry = self.RMLModNodeRegistry;
    if (!registry) throw new Error("The Custom C# worker registry is unavailable.");
    for (const [typeId, definition] of Object.entries(typeDefinitions || {})) {
      if (!registry.getTypeDefinitions?.()[typeId]) registry.registerType(typeId, definition);
    }
    for (const [operatorId, definition] of Object.entries(definitions || {})) {
      if (!registry.getNodeDefinition?.(operatorId)) registry.registerNode(operatorId, definition);
    }
  })();
  return customCSharpRuntimeReady;
}

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
        types: [],
        enums: [],
        assemblies: []
      };
    self.RMLFrooxComponentCatalog =
      self.RMLResoniteApiCatalog;

    importScripts(
      "node_graph.js?v=301-consolidated-custom-contracts-v603f53"
    );
    importScripts(
      "mod_nodes.js?v=54-consolidated-custom-contracts-v603f53"
    );
    importScripts(
      "visual_csharp.js?v=30-consolidated-custom-contracts-v603f53"
    );
    importScripts(
      "api_nodes.js?v=36-structural-catalog-contract-v603f43"
    );

    if (
      self.RMLApiNodeFactoryReady &&
      typeof self.RMLApiNodeFactoryReady.then ===
        "function"
    ) {
      await self.RMLApiNodeFactoryReady;
    }

    if (
      Array.isArray(self.RMLResoniteApiCatalog?.types) &&
      self.RMLResoniteApiCatalog.types.length > 0 &&
      self.RMLApiNodeFactoryReport?.verificationPassed !== true
    ) {
      const details = Array.isArray(self.RMLApiNodeFactoryReport?.verificationErrors)
        ? self.RMLApiNodeFactoryReport.verificationErrors.join("; ")
        : "the API factory did not produce a verified contract report";
      throw new Error(`Resonite API catalog verification failed: ${details}`);
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

  if (!["build", "buildCustomCSharp"].includes(request.operation)) {
    return;
  }

  void (async () => {
    try {
      if (request.operation === "buildCustomCSharp") {
        await ensureCustomCSharpRuntime(request.catalogDefinitions, request.catalogTypeDefinitions);
        const fragment = self.RMLVisualCSharp.createRoslynImportFragment(
          String(request.source || ""),
          request.parseResult,
          {
            ...(request.options || {}),
            catalogDefinitions: request.catalogDefinitions || {},
            catalogTypeDefinitions: request.catalogTypeDefinitions || {}
          }
        );
        self.postMessage({ id: request.id, ok: fragment?.ok === true, result: fragment });
        return;
      }
      await ensureRuntime(request.catalog);

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
