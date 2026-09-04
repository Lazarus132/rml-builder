(() => {
  "use strict";

  if (window.RMLScriptLoader?.version >= 13) {
    return;
  }

  const currentScriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const baseUrl = new URL(".", currentScriptUrl);
  const fileStates = new Map();
  const bundleStates = new Map();
  const prefetchedFiles = new Set();
  let runtimeViewPreparationPromise = null;
  let runtimeViewOpenAfterLoadPromise = null;
  let runtimeViewLoadingNoticePromise = null;

  const bundles = Object.freeze({
    compiler: Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([
        Object.freeze({
          url: "../compiler/csharp14_roslyn.js?v=10-physical-modules-v748",
          ready: () =>
            typeof window.RMLCSharp14Roslyn?.validate === "function"
        }),
        Object.freeze({
          url: "../compiler/compile.js?v=6-physical-modules-v748",
          ready: () =>
            typeof window.RMLCompile?.validate === "function"
        }),
        Object.freeze({
          url: "../compiler/compiler_reference_discovery.js?v=3-physical-modules-v748",
          ready: () =>
            typeof window.RMLCompilerReferenceDiscovery?.scanDirectory ===
              "function"
        })
      ])
    }),
    "node-registry": Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([
        Object.freeze({
          url: "../catalog/catalog_loader.js?v=188-custom-csharp-exact-fallback-v764",
          ready: () =>
            typeof window.RMLBaseModNodesReady?.then === "function" ||
            typeof window.RMLModNodesReady?.then === "function"
        }),
        Object.freeze({
          url: "../graph/node_graph_registry.js?v=1-physical-modules-v748",
          ready: () =>
            typeof window.RMLModNodeRegistry?.getNodeDefinitions ===
              "function"
        })
      ]),
      settle: async () => {
        await Promise.resolve(
          window.RMLBaseModNodesReady ||
          window.RMLModNodesReady
        );
        if (
          typeof window.RMLModNodeRegistry?.getNodeDefinitions !==
          "function"
        ) {
          throw new Error(
            "The Runtime Graph node library loaded without its registry."
          );
        }
      }
    }),
    "node-library": Object.freeze({
      dependencies: Object.freeze([
        "node-registry"
      ]),
      files: Object.freeze([])
    }),
    "graph-codegen": Object.freeze({
      dependencies: Object.freeze([
        "node-registry"
      ]),
      files: Object.freeze([
        Object.freeze({
          url: "../graph/node_graph_codegen.js?v=1-physical-modules-v748",
          ready: () =>
            typeof window.RMLTypedNodeGraphGenerator?.build ===
              "function"
        })
      ])
    }),
    "runtime-core": Object.freeze({
      dependencies: Object.freeze([
        "compiler",
        "graph-codegen"
      ]),
      files: Object.freeze([
        Object.freeze({
          url: "../graph/runtime_bridge.js?v=5-physical-modules-v748",
          ready: () =>
            typeof window.RMLRuntimeBridge?.subscribe === "function"
        }),
        Object.freeze({
          url: "../graph/node_graph_composites.js?v=4-gzip-import-recovery-v757"
        }),
        Object.freeze({
          url: "../graph/node_graph_custom_csharp.js?v=8-custom-csharp-render-barrier-v766"
        }),
        Object.freeze({
          url: "../graph/node_graph_guided.js?v=1-physical-modules-v748"
        }),
        Object.freeze({
          url: "../graph/node_graph_view.js?v=9-custom-csharp-render-barrier-v766"
        }),
        Object.freeze({
          url: "../graph/node_graph_bootstrap.js?v=1-physical-modules-v748",
          ready: () =>
            typeof window.RMLDynamicGraphHost?.isReady === "function"
        })
      ]),
      settle: async () => {
        await waitFor(
          () => window.RMLDynamicGraphHost?.isReady?.() === true,
          "The Runtime Graph host did not connect to the restored project."
        );
      }
    }),
    "runtime-view": Object.freeze({
      dependencies: Object.freeze([
        "runtime-core"
      ]),
      files: Object.freeze([
        Object.freeze({
          url: "../graph/graph_gpu_renderer.js?v=21-wire-artifact-guard-v766",
          ready: () =>
            typeof window.RMLGraphHybridRenderer?.create === "function"
        })
      ]),
      settle: async () => {
        await Promise.race([
          Promise.resolve(
            window.RMLGraphHybridRenderer?.ready
          ),
          new Promise(resolve =>
            window.setTimeout(
              () => resolve(false),
              2500
            )
          )
        ]);
      }
    })
  });

  function waitFor(
    predicate,
    failureMessage,
    timeout = 120000
  ) {
    const started = performance.now();
    return new Promise((resolve, reject) => {
      const inspect = () => {
        let ready = false;
        try {
          ready = predicate() === true;
        } catch {}
        if (ready) {
          resolve(true);
          return;
        }
        if (performance.now() - started >= timeout) {
          reject(new Error(failureMessage));
          return;
        }
        window.setTimeout(inspect, 16);
      };
      inspect();
    });
  }

  function fileState(url) {
    const absolute = new URL(url, baseUrl).href;
    if (!fileStates.has(absolute)) {
      fileStates.set(absolute, {
        url: absolute,
        status: "idle",
        promise: null,
        element: null,
        error: null
      });
    }
    return fileStates.get(absolute);
  }

  function loadFile(file) {
    if (file.ready?.() === true) {
      return Promise.resolve(true);
    }

    const state = fileState(file.url);
    if (state.status === "loaded") {
      return Promise.resolve(true);
    }
    if (state.promise) {
      return state.promise;
    }

    state.status = "loading";
    state.error = null;
    state.promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      state.element = script;
      script.src = state.url;
      script.async = false;
      script.dataset.rmlLazyScript = file.url;
      script.addEventListener(
        "load",
        () => {
          if (file.ready && file.ready() !== true) {
            reject(
              new Error(
                `${file.url} loaded without exposing its public contract.`
              )
            );
            return;
          }
          resolve(true);
        },
        { once: true }
      );
      script.addEventListener(
        "error",
        () => reject(
          new Error(`Could not load ${file.url}.`)
        ),
        { once: true }
      );
      (document.body || document.head).appendChild(script);
    })
      .then(value => {
        state.status = "loaded";
        state.error = null;
        return value;
      })
      .catch(error => {
        state.status = "failed";
        state.error = error;
        state.promise = null;
        state.element?.remove();
        state.element = null;
        throw error;
      });

    return state.promise;
  }

  function prefetchFile(file) {
    if (file.ready?.() === true) {
      return;
    }

    const absolute = new URL(file.url, baseUrl).href;
    if (prefetchedFiles.has(absolute)) {
      return;
    }
    prefetchedFiles.add(absolute);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "script";
    link.href = absolute;
    link.fetchPriority = "low";
    link.dataset.rmlLazyScriptPrefetch = file.url;
    link.addEventListener(
      "error",
      () => {
        prefetchedFiles.delete(absolute);
        link.remove();
      },
      { once: true }
    );
    document.head.appendChild(link);
  }

  function prefetchBundle(name, visited = new Set()) {
    if (visited.has(name)) {
      return;
    }
    visited.add(name);

    const definition = bundles[name];
    if (!definition) {
      return;
    }
    definition.dependencies.forEach(
      dependency => prefetchBundle(dependency, visited)
    );
    definition.files.forEach(prefetchFile);
  }

  function afterRuntimeLoadingPaint() {
    return new Promise(resolve => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(true);
      };
      const fallback = window.setTimeout(
        finish,
        80
      );
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          window.clearTimeout(fallback);
          finish();
        });
      });
    });
  }

  function bundleState(name) {
    if (!bundleStates.has(name)) {
      bundleStates.set(name, {
        status: "idle",
        promise: null,
        error: null
      });
    }
    return bundleStates.get(name);
  }

  function ensure(name) {
    const definition = bundles[name];
    if (!definition) {
      return Promise.reject(
        new Error(`Unknown deferred JavaScript bundle: ${name}`)
      );
    }

    const state = bundleState(name);
    if (state.status === "loaded") {
      return Promise.resolve(true);
    }
    if (state.promise) {
      return state.promise;
    }

    state.status = "loading";
    state.error = null;
    state.promise = (async () => {
      await Promise.all(
        definition.dependencies.map(ensure)
      );
      // Dynamic classic scripts with async=false execute in insertion order,
      // while their downloads may proceed together. That preserves the
      // shared lexical module contract without serial network round trips.
      await Promise.all(
        definition.files.map(loadFile)
      );
      await definition.settle?.();
      return true;
    })()
      .then(value => {
        state.status = "loaded";
        state.error = null;
        window.dispatchEvent(
          new CustomEvent(
            "rml-script-bundle-ready",
            { detail: Object.freeze({ name }) }
          )
        );
        return value;
      })
      .catch(error => {
        state.status = "failed";
        state.error = error;
        state.promise = null;
        throw error;
      });

    return state.promise;
  }

  function status(name) {
    const state = bundleState(name);
    return Object.freeze({
      status: state.status,
      error: state.error
    });
  }

  function runtimeButton() {
    return document.getElementById("pack-into-node");
  }

  function runtimeGraphState() {
    return window.RMLBuilderBridge
      ?.getExtensionStateReference?.("typedNodeGraph") ||
      null;
  }

  function updateRuntimeButton() {
    const button = runtimeButton();
    if (!button || button.dataset.rmlGraphActionBound === "true") {
      return;
    }

    const bridge = window.RMLBuilderBridge;
    const graph = runtimeGraphState();
    const loading =
      runtimeViewPreparationPromise !== null ||
      runtimeViewOpenAfterLoadPromise !== null ||
      status("node-registry").status === "loading" ||
      status("graph-codegen").status === "loading" ||
      status("runtime-core").status === "loading" ||
      status("runtime-view").status === "loading";
    const failed =
      status("node-registry").status === "failed" ||
      status("graph-codegen").status === "failed" ||
      status("runtime-core").status === "failed" ||
      status("runtime-view").status === "failed";
    const sourceNodes =
      bridge?.getStateSnapshot?.()?.nodes || [];
    const available = Boolean(
      bridge &&
      (sourceNodes.length > 0 || graph?.active === true)
    );

    const unavailableReason =
      "Add at least one Configuration Outline item before packing or opening the Runtime Graph.";
    const sharedAvailability =
      window.RMLAlwaysClickableButtons?.set;
    if (typeof sharedAvailability === "function") {
      sharedAvailability(
        button,
        available,
        unavailableReason
      );
    } else {
      // Keep the native click channel alive while assets are warming.
      // Disabling on pointerdown would suppress click on mobile.
      button.disabled = !available;
    }
    button.setAttribute(
      "aria-disabled",
      String(!available)
    );
    if (loading) {
      button.setAttribute("aria-busy", "true");
    } else {
      button.removeAttribute("aria-busy");
    }
    button.dataset.runtimeReadiness = failed
      ? "failed"
      : loading
        ? "loading"
        : "ready";
    const visualState = loading
      ? "loading"
      : failed
        ? "failed-loader"
        : graph?.active === true
          ? "graph-open"
          : "graph-pack";
    if (
      button.dataset.rmlRuntimeButtonVisual !==
        visualState
    ) {
      button.dataset.rmlRuntimeButtonVisual =
        visualState;
      button.innerHTML = loading
        ? '<span class="brand-mark rml-pack-brand-mark rml-runtime-graph-loader rml-runtime-graph-spinner" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">Loading Runtime Graph…</span>'
        : '<span class="brand-mark rml-pack-brand-mark" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">' +
          (failed
            ? "Retry Runtime Graph"
            : graph?.active === true
              ? "Open Runtime Graph"
              : "Pack into Node") +
          "</span>";
    }
    button.dataset.help = failed
      ? "Retry loading the local Runtime Graph modules."
      : loading
        ? "The Runtime Graph modules are being prepared locally."
        : graph?.active === true
          ? "Open the preserved Typed Runtime Graph."
          : available
            ? "Open the automatically synchronized Typed Runtime Graph."
            : unavailableReason;
  }

  async function prepareRuntimeView() {
    await (
      window.RMLStyleLoader?.ensure?.("runtime-graph") ||
      Promise.resolve(true)
    );
    await ensure("runtime-view");
  }

  function startRuntimeViewPreparation() {
    if (
      status("runtime-view").status ===
        "loaded"
    ) {
      return Promise.resolve(true);
    }
    if (runtimeViewPreparationPromise) {
      return runtimeViewPreparationPromise;
    }

    const preparation = (async () => {
      await afterRuntimeLoadingPaint();
      await prepareRuntimeView();
      return true;
    })();
    runtimeViewPreparationPromise = preparation;
    updateRuntimeButton();
    void preparation.then(
      () => {
        if (
          runtimeViewPreparationPromise ===
            preparation
        ) {
          runtimeViewPreparationPromise = null;
        }
        updateRuntimeButton();
      },
      () => {
        if (
          runtimeViewPreparationPromise ===
            preparation
        ) {
          runtimeViewPreparationPromise = null;
        }
        updateRuntimeButton();
      }
    );
    return preparation;
  }

  async function prefetchRuntimeView() {
    window.RMLStyleLoader?.prefetch?.(
      "runtime-graph"
    );
    prefetchBundle("runtime-view");
    return true;
  }

  function reportRuntimeViewStillLoading() {
    const message =
      "The Runtime Graph is still being prepared locally. It will open automatically when loading finishes.";
    const notice =
      window.RMLBuilderDialog?.notice;
    if (
      typeof notice !== "function" ||
      runtimeViewLoadingNoticePromise
    ) {
      return;
    }
    runtimeViewLoadingNoticePromise =
      Promise.resolve(
        notice({
          tone: "info",
          kicker: "Runtime Graph",
          title: "Runtime Graph is still loading",
          message,
          confirmLabel: "OK"
        })
      )
        .catch(() => {})
        .finally(() => {
          runtimeViewLoadingNoticePromise = null;
        });
  }

  function installRuntimeButton() {
    const button = runtimeButton();
    if (!button || button.dataset.rmlLazyScriptBound === "true") {
      return;
    }
    button.dataset.rmlLazyScriptBound = "true";

    const prefetch = () => {
      void prefetchRuntimeView()
        .catch(() => {})
        .finally(updateRuntimeButton);
    };
    button.addEventListener("pointerenter", prefetch, {
      passive: true,
      once: true
    });
    button.addEventListener("focus", prefetch, { once: true });
    button.addEventListener(
      "pointerdown",
      () => {
        if (
          button.getAttribute(
            "aria-disabled"
          ) === "true"
        ) {
          return;
        }
        void startRuntimeViewPreparation()
          .catch(() => {});
      },
      {
        passive: true,
        once: true
      }
    );
    button.addEventListener("click", event => {
      if (
        button.dataset.rmlGraphActionBound === "true" &&
        status("runtime-view").status === "loaded"
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      button.setAttribute("aria-disabled", "true");
      if (runtimeViewOpenAfterLoadPromise) {
        reportRuntimeViewStillLoading();
        updateRuntimeButton();
        return;
      }
      const continuation =
        startRuntimeViewPreparation();
      runtimeViewOpenAfterLoadPromise = continuation;
      updateRuntimeButton();
      reportRuntimeViewStillLoading();
      void continuation
        .then(() => {
          if (
            runtimeViewOpenAfterLoadPromise !==
              continuation
          ) {
            return;
          }
          runtimeViewOpenAfterLoadPromise = null;
          updateRuntimeButton();
          button.click();
        })
        .catch(error => {
          if (
            runtimeViewOpenAfterLoadPromise ===
              continuation
          ) {
            runtimeViewOpenAfterLoadPromise = null;
          }
          console.error(
            "Runtime Graph modules could not be prepared.",
            error
          );
          updateRuntimeButton();
        });
    });
    updateRuntimeButton();
  }

  function prepareRestoredRuntimeGraph() {
    const graph = runtimeGraphState();
    if (graph?.active !== true) {
      updateRuntimeButton();
      return;
    }
    const page =
      window.RMLBuilderBridge?.getActivePage?.() ||
      graph.lastOpenPage ||
      "configuration-outline";
    const preparation = page === "runtime-graph"
      ? prepareRuntimeView()
      : ensure("graph-codegen");
    void preparation
      .catch(error => {
        console.error(
          "The restored Runtime Graph modules could not be loaded.",
          error
        );
      })
      .finally(updateRuntimeButton);
    updateRuntimeButton();
  }

  Object.defineProperty(window, "RMLScriptLoader", {
    value: Object.freeze({
      version: 13,
      ensure,
      ensureMany(names) {
        return Promise.all(
          [...new Set(names)].map(ensure)
        );
      },
      warm(name) {
        return ensure(name);
      },
      isLoaded(name) {
        return bundleState(name).status === "loaded";
      },
      status,
      bundles: Object.freeze(Object.keys(bundles))
    }),
    writable: false,
    enumerable: true,
    configurable: true
  });

  document.addEventListener(
    "rml-builder:bridge-ready",
    prepareRestoredRuntimeGraph
  );
  document.addEventListener(
    "rml-builder:extension-state-changed",
    prepareRestoredRuntimeGraph
  );
  document.addEventListener(
    "rml-builder:rendered",
    updateRuntimeButton
  );
  window.addEventListener(
    "rml-script-bundle-ready",
    updateRuntimeButton
  );

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      installRuntimeButton,
      { once: true }
    );
  } else {
    installRuntimeButton();
  }
})();
