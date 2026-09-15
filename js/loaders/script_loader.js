(() => {
  "use strict";

  const SCRIPT_LOADER_MODULE_ID =
    "1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar";

  if (
    Object.hasOwn(
      window,
      "RMLBuilderBuildId"
    ) &&
    window.RMLBuilderBuildId !==
      SCRIPT_LOADER_MODULE_ID
  ) {
    throw new Error(
      `Builder module version mismatch: index.html published '${String(window.RMLBuilderBuildId || "missing")}', but script_loader.js is '${SCRIPT_LOADER_MODULE_ID}'. Reload the Builder without cached files.`
    );
  }

  if (
    window.RMLScriptLoader?.version >= 41 &&
    window.RMLScriptLoader?.moduleId ===
      SCRIPT_LOADER_MODULE_ID
  ) {
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
  const GRAPH_SEARCH_SHORTCUT_CAPTURE_VERSION = 18;
  const provisionalGraphShortcutKeys = new Set();

  function graphSearchShortcutDirection(event) {
    const key = String(event.key || "").toLowerCase();
    const code = String(event.code || "").toLowerCase();
    const legacy = Number(event.keyCode) || 0;
    const f3 = key === "f3" || code === "f3" || legacy === 114;
    const g = key === "g" || code === "keyg" || legacy === 71;
    if (
      f3 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      return event.shiftKey ? -1 : 1;
    }
    if (
      g &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey
    ) {
      return event.shiftKey ? -1 : 1;
    }
    return 0;
  }

  function provisionalGraphShortcutKey(event) {
    return String(
      event.code ||
      event.key ||
      event.keyCode ||
      ""
    ).toLowerCase();
  }

  function claimProvisionalGraphShortcut(event) {
    if (event.cancelable) {
      event.preventDefault();
    }
    try {
      event.returnValue = false;
    } catch {}
    event.stopImmediatePropagation();
  }

  function provisionalGraphShortcutContextOwned() {
    const graph = runtimeGraphState();
    const page =
      window.RMLBuilderBridge?.getActivePage?.() ||
      graph?.lastOpenPage ||
      "configuration-outline";
    const button = runtimeButton();
    return Boolean(
      runtimeViewPreparationPromise !== null ||
      runtimeViewOpenAfterLoadPromise !== null ||
      button?.getAttribute("aria-busy") === "true" ||
      (graph?.active === true && page === "runtime-graph")
    );
  }

  function handleProvisionalGraphShortcutKeyDown(event) {
    if (
      Number(window.RMLGraphSearchShortcutCaptureVersion) >=
        GRAPH_SEARCH_SHORTCUT_CAPTURE_VERSION ||
      event.defaultPrevented ||
      graphSearchShortcutDirection(event) === 0 ||
      !provisionalGraphShortcutContextOwned()
    ) {
      return;
    }
    claimProvisionalGraphShortcut(event);
    provisionalGraphShortcutKeys.add(
      provisionalGraphShortcutKey(event)
    );
  }

  function handleProvisionalGraphShortcutKeyUp(event) {
    const key = provisionalGraphShortcutKey(event);
    if (!provisionalGraphShortcutKeys.delete(key)) {
      return;
    }
    claimProvisionalGraphShortcut(event);
  }

  window.addEventListener(
    "keydown",
    handleProvisionalGraphShortcutKeyDown,
    { capture: true, passive: false }
  );
  window.addEventListener(
    "keyup",
    handleProvisionalGraphShortcutKeyUp,
    { capture: true, passive: false }
  );
  window.addEventListener(
    "blur",
    () => provisionalGraphShortcutKeys.clear()
  );

  const bundles = Object.freeze({
    "scanner-connection": Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([Object.freeze({
        url: "../graph/runtime_bridge.js?v=1000-live-loss-status",
        ready: () => window.RMLRuntimeBridge?.version >= 10 &&
          typeof window.RMLRuntimeBridge?.connect === "function"
      })])
    }),
    "code-templates": Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([Object.freeze({
        url: "../core/code_templates.js?v=794-shared-loader-runtime",
        ready: () => window.RMLCodeTemplates?.version === 794
      })])
    }),
    guidance: Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([Object.freeze({
        url: "../core/guidance.js?v=793",
        ready: () => window.RMLGuidance?.version === 793
      })])
    }),
    compiler: Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([
        Object.freeze({
          url: "../compiler/csharp14_roslyn.js?v=13-graph-module-coherence-v788",
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
          url: "../catalog/catalog_loader.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLCatalogImportGate?.moduleId ===
              SCRIPT_LOADER_MODULE_ID &&
            Number(
              window.RMLCatalogImportGate
                ?.loaderVersion
            ) === 84 &&
            Number(
              window.RMLCatalogImportGate
                ?.requiredApiFactoryVersion
            ) === 38 &&
            (
              typeof window.RMLBaseModNodesReady?.then === "function" ||
              typeof window.RMLModNodesReady?.then === "function"
            )
        }),
        Object.freeze({
          url: "../graph/node_graph_registry.js?v=1-physical-modules-v750-offline-core-types",
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
        "code-templates",
        "node-registry"
      ]),
      files: Object.freeze([
        Object.freeze({
          url: "../graph/node_graph_codegen.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLTypedNodeGraphGenerator?.moduleId ===
              SCRIPT_LOADER_MODULE_ID &&
            typeof window.RMLTypedNodeGraphGenerator?.build ===
              "function"
        })
      ])
    }),
    "runtime-core": Object.freeze({
      dependencies: Object.freeze([
        "scanner-connection",
        "compiler",
        "graph-codegen"
      ]),
      files: Object.freeze([
        Object.freeze({
          url: "../workers/saved_api_composite_compare_worker.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLSavedApiCompositeCompareWorkerBootstrap
              ?.moduleId === SCRIPT_LOADER_MODULE_ID &&
            typeof window
              .RMLSavedApiCompositeCompareWorkerBootstrap
              ?.source === "string"
        }),
        Object.freeze({
          url: "../graph/node_graph_composites.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLNodeGraphCompositesModuleId ===
              SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../graph/node_graph_custom_csharp.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLNodeGraphCustomCSharpModuleId ===
              SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../graph/node_graph_guided.js?v=1-physical-modules-v748"
        }),
        Object.freeze({
          url: "../graph/node_graph_view.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLNodeGraphViewModuleId ===
              SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../graph/node_graph_bootstrap.js?v=1.20.31-universal-presentation-dev109-hidden-configuration-node-scrollbar",
          ready: () =>
            window.RMLDynamicGraphHost?.moduleId ===
              SCRIPT_LOADER_MODULE_ID &&
            window.RMLDynamicGraphHost?.version >= 73 &&
            typeof window.RMLDynamicGraphHost?.isReady === "function"
        })
      ]),
      settle: async () => {
        await waitFor(
          () =>
            window.RMLDynamicGraphHost?.moduleId ===
              SCRIPT_LOADER_MODULE_ID &&
            window.RMLDynamicGraphHost?.isReady?.() === true,
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
          url: "../graph/graph_gpu_renderer.js?v=807-webgpu-texture-limits",
          ready: () =>
            typeof window.RMLGraphHybridRenderer?.create === "function"
        })
      ]),
      settle: async () => {
        await Promise.resolve(window.RMLGraphHybridRenderer?.ready);
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
    updateRuntimeButton();
    state.promise = (async () => {
      await Promise.all(
        definition.dependencies.map(ensure)
      );
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
    const runtimeViewRequested =
      runtimeViewPreparationPromise !== null ||
      runtimeViewOpenAfterLoadPromise !== null ||
      (
        bridge?.getActivePage?.() ||
        graph?.lastOpenPage ||
        "configuration-outline"
      ) === "runtime-graph";
    const loading =
      runtimeViewRequested &&
      (
        runtimeViewPreparationPromise !== null ||
        runtimeViewOpenAfterLoadPromise !== null ||
        status("node-registry").status === "loading" ||
        status("graph-codegen").status === "loading" ||
        status("runtime-core").status === "loading" ||
        status("runtime-view").status === "loading"
      );
    const failed =
      status("node-registry").status === "failed" ||
      status("graph-codegen").status === "failed" ||
      status("runtime-core").status === "failed" ||
      status("runtime-view").status === "failed";
    const liveSourceNodeCount = Number(
      bridge?.getConfigurationNodeCount?.()
    );
    const sourceNodeCount = Number.isFinite(
      liveSourceNodeCount
    )
      ? Math.max(0, liveSourceNodeCount)
      : Array.isArray(
          graph?.configSnapshot?.nodes
        )
        ? graph.configSnapshot.nodes.length
        : 0;
    const available = Boolean(
      bridge &&
      (sourceNodeCount > 0 || graph?.active === true)
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
    const visualState = failed
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
      button.innerHTML =
        '<span class="brand-mark rml-pack-brand-mark" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">' +
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

    const preparation = prepareRuntimeView();
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
    button.addEventListener("click", event => {
      if (
        button.dataset.rmlGraphActionBound === "true" &&
        status("runtime-view").status === "loaded"
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (runtimeGraphState()?.active === true) {
        window.RMLBuilderBridge?.setActivePage?.(
          "runtime-graph",
          {
            immediate: true,
            reason: "runtime-graph-open-request"
          }
        );
      }
      button.setAttribute("aria-disabled", "true");
      if (runtimeViewOpenAfterLoadPromise) {
        updateRuntimeButton();
        return;
      }
      const builderWork =
        window.RMLBuilderWork;
      const workSession =
        builderWork?.begin?.({
          kicker: "Runtime Graph",
          title: "Preparing Runtime Graph…",
          message:
            "The graph appears as soon as its complete interactive frame is ready.",
          detail:
            "Loading the local graph modules…",
          progress: 12,
          timeout: 120000
        }) || 0;
      const continuation = (async () => {
        await startRuntimeViewPreparation();
        const host =
          window.RMLDynamicGraphHost;
        const openPresentation =
          host?.openPresentation;
        if (typeof openPresentation !== "function") {
          throw new Error(
            "The Runtime Graph host loaded without its presentation handler."
          );
        }
        builderWork?.update?.(
          workSession,
          {
            detail:
              "Rendering nodes, ports and connections…",
            progress: 58
          }
        );
        const opened =
          await openPresentation();
        if (opened === false) {
          return false;
        }
        return await host.whenViewReady?.();
      })();
      runtimeViewOpenAfterLoadPromise = continuation;
      updateRuntimeButton();
      void continuation
        .catch(error => {
          console.error(
            "Runtime Graph modules could not be prepared.",
            error
          );
        })
        .finally(() => {
          if (
            runtimeViewOpenAfterLoadPromise ===
              continuation
          ) {
            runtimeViewOpenAfterLoadPromise = null;
          }
          button.disabled = false;
          button.setAttribute("aria-disabled", "false");
          button.removeAttribute("aria-busy");
          delete button.dataset.unavailableReason;
          builderWork?.finish?.(
            workSession
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
      version: 41,
      moduleId: SCRIPT_LOADER_MODULE_ID,
      ensure,
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
  function installScannerStatusControl() {
    const status = document.getElementById("api-catalog-state");
    if (!status || status.dataset.manualScannerBound === "true") return;
    status.dataset.manualScannerBound = "true";
    status.tabIndex = 0;
    status.setAttribute("role", "button");
    let loadIntent = 0;
    let loading = false;
    const run = async () => {
      if (loading) {
        ++loadIntent;
        loading = false;
        window.RMLRuntimeBridge?.disconnect?.();
        status.dataset.source = "cache";
        status.textContent = "Resonite API · Cached";
        status.setAttribute("aria-busy", "false");
        status.title = "Click to check the scanner once and connect. No automatic retries.";
        status.setAttribute("aria-label", `${status.textContent}. ${status.title}`);
        return;
      }
      if (window.RMLRuntimeBridge?.version >= 10) {
        await window.RMLRuntimeBridge.toggle();
        return;
      }
      const intent = ++loadIntent;
      loading = true;
      status.dataset.source = "updating";
      status.textContent = "Resonite API · checking…";
      status.setAttribute("aria-busy", "true");
      status.title = "Click to cancel the connection attempt.";
      status.setAttribute("aria-label", `${status.textContent}. ${status.title}`);
      try {
        await window.RMLScriptLoader.ensure("scanner-connection");
        if (!loading || intent !== loadIntent) return;
        loading = false;
        await window.RMLRuntimeBridge.connect();
      } catch (error) {
        if (intent !== loadIntent) return;
        loading = false;
        if (window.RMLRuntimeBridge) window.RMLRuntimeBridge.disconnect(error);
        else {
          status.dataset.source = "cache";
          status.textContent = "Resonite API · Cached";
          status.setAttribute("aria-busy", "false");
          status.title = `Connection module could not be loaded. Click to try again. ${error?.message || error}`;
          status.setAttribute("aria-label", `${status.textContent}. ${status.title}`);
        }
      }
    };
    status.addEventListener("click", () => { void run(); });
    status.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!event.repeat) void run();
      }
    });
  }
  installScannerStatusControl();
})();
