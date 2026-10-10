(() => {
  "use strict";

  const SCRIPT_LOADER_MODULE_ID =
    "1.25.00-canonical-type-reconciliation-startup-recovery";

  if (
    window.RMLScriptLoader?.version >= 48 &&
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
  let restoredRuntimeGraphPreparationKey = "";
  let restoredRuntimeGraphPreparationPromise = null;
  const GRAPH_SEARCH_SHORTCUT_CAPTURE_VERSION = 18;
  const provisionalGraphShortcutKeys = new Set();
  let scannerStatusControlInstalled = false;

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
    "builder-work": Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([
        Object.freeze({
          url: "../ui/builder_replacement_dialog.js?v=1.25.00-canonical-type-reconciliation-startup-recovery",
          ready: () =>
            window.RMLBuilderReplacementDialog
              ?.moduleId === SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../ui/builder_work_controller.js?v=1.25.00-canonical-type-reconciliation-startup-recovery",
          ready: () =>
            window.RMLBuilderWorkController
              ?.moduleId === SCRIPT_LOADER_MODULE_ID
        })
      ])
    }),
    "scanner-connection": Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([Object.freeze({
        url: "../graph/runtime_bridge.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&status-runtime=4",
        ready: () => window.RMLRuntimeBridge?.version >= 14 &&
          typeof window.RMLRuntimeBridge?.connect === "function"
      })])
    }),
    "code-templates": Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([Object.freeze({
        url: "../core/code_templates.js?v=797-readable-visual-functions-node-index&outline-optional=1",
        ready: () => window.RMLCodeTemplates?.version === 797
      })])
    }),
    guidance: Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([Object.freeze({
        url: "../core/guidance.js?v=793&outline-optional=1",
        ready: () => window.RMLGuidance?.version === 793
      })])
    }),
    compiler: Object.freeze({
      dependencies: Object.freeze([]),
      files: Object.freeze([
        Object.freeze({
          url: "../compiler/csharp14_roslyn.js?v=15-reference-transaction",
          ready: () =>
            typeof window.RMLCSharp14Roslyn?.validate === "function"
        }),
        Object.freeze({
          url: "../compiler/compile.js?v=9-exact-reference-content",
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
          url: "../catalog/catalog_loader.js?v=1.25.04-export-folder-events&status-catalog=7&portable-types=1&specializations=2&inherited-demand=1&readiness-rev=2&i18n-rev=2&catalog-authority=14&integrity-certificate=1&demand-reuse=1",
          ready: () =>
            window.RMLCatalogImportGate?.moduleId ===
              SCRIPT_LOADER_MODULE_ID &&
            Number(
              window.RMLCatalogImportGate
                ?.loaderVersion
            ) === 95 &&
            Number(
              window.RMLCatalogImportGate
                ?.requiredApiFactoryVersion
            ) === 41 &&
            typeof window.RMLModNodesReady?.then === "function"
        }),
        Object.freeze({
          url: "../graph/node_graph_registry.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&portable-types=1&i18n-rev=1",
          ready: () =>
            typeof window.RMLModNodeRegistry?.getNodeDefinitions ===
              "function"
        })
      ]),
      settle: async () => {
        await Promise.resolve(
          window.RMLModNodesReady
        );
        if (
          typeof window.RMLModNodeRegistry?.getNodeDefinitions !==
          "function"
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.571bafc47d87")
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
          url: "../graph/node_graph_type_migration.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&type-migration=4&portable-types=2",
          ready: () =>
            window.RMLGraphTypeImportMigrations
              ?.version === 1
        }),
        Object.freeze({
          url: "../graph/node_graph_codegen.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&portable-types=1&specializations=1&outline-optional=1&type-identity=2&language-type-adapter=7",
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
          url: "../workers/saved_api_composite_compare_worker.js?v=1.25.00-canonical-type-reconciliation-startup-recovery",
          ready: () =>
            window.RMLSavedApiCompositeCompareWorkerBootstrap
              ?.moduleId === SCRIPT_LOADER_MODULE_ID &&
            typeof window
              .RMLSavedApiCompositeCompareWorkerBootstrap
              ?.source === "string"
        }),
        Object.freeze({
          url: "../graph/node_graph_composites.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&i18n-rev=2",
          ready: () =>
            window.RMLNodeGraphCompositesModuleId ===
              SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../graph/node_graph_custom_csharp.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&worker-null-fallback=3&portable-types=1&specializations=1&i18n-rev=2&factory=43",
          ready: () =>
            window.RMLNodeGraphCustomCSharpModuleId ===
              SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../graph/node_graph_guided.js?v=1-physical-modules-v748"
        }),
        Object.freeze({
          url: "../graph/node_graph_view.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&status-readiness=5&schema=4&type-migration=1&portable-types=1&specializations=1&readiness-rev=4&i18n-rev=2&outline-optional=1",
          ready: () =>
            window.RMLNodeGraphViewModuleId ===
              SCRIPT_LOADER_MODULE_ID
        }),
        Object.freeze({
          url: "../graph/node_graph_bootstrap.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&type-migration=1&portable-types=1&specializations=1&readiness-rev=2",
          ready: () =>
            window.RMLDynamicGraphHost?.moduleId ===
              SCRIPT_LOADER_MODULE_ID &&
            window.RMLDynamicGraphHost?.version >= 74 &&
            typeof window.RMLDynamicGraphHost?.isReady === "function"
        })
      ]),
      settle: async () => {
        if (
          window.RMLDynamicGraphHost?.moduleId !== SCRIPT_LOADER_MODULE_ID ||
          typeof window.RMLDynamicGraphHost?.isReady !== "function"
        ) {
          throw new Error(window.RMLI18n.t("ui.literal.0d5beb2090e5"));
        }
        const hostReady =
          window.RMLDynamicGraphHost
            .whenHostReady?.();
        if (
          !hostReady ||
          typeof hostReady.then !== "function"
        ) {
          throw new Error(
            "The Runtime Graph host did not expose an awaitable readiness contract."
          );
        }
        await hostReady;
        if (
          window.RMLDynamicGraphHost.isReady() !==
          true
        ) {
          throw new Error(
            "The Runtime Graph host completed initialization without a usable project model."
          );
        }
      }
    }),
    "runtime-view": Object.freeze({
      dependencies: Object.freeze([
        "runtime-core"
      ]),
      files: Object.freeze([
        Object.freeze({
          url: "../graph/graph_gpu_renderer.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&readiness-rev=2",
          ready: () =>
            typeof window.RMLGraphHybridRenderer?.create === "function"
        })
      ]),
      settle: async () => {
        await Promise.resolve(window.RMLGraphHybridRenderer?.ready);
      }
    })
  });

  function publicContractDiagnostic(file) {
    const path = String(file?.url || "").split("?")[0];
    const typed = (exportName, expected, actual) => Object.freeze({
      exportName,
      expected: Object.freeze(expected),
      actual: Object.freeze(actual)
    });

    if (path.endsWith("/graph/runtime_bridge.js")) {
      return typed(
        "RMLRuntimeBridge",
        { minimumVersion: 14, connectType: "function" },
        {
          version: window.RMLRuntimeBridge?.version ?? null,
          connectType: typeof window.RMLRuntimeBridge?.connect
        }
      );
    }
    if (path.endsWith("/core/code_templates.js")) {
      return typed(
        "RMLCodeTemplates",
        { version: 797 },
        { version: window.RMLCodeTemplates?.version ?? null }
      );
    }
    if (path.endsWith("/core/guidance.js")) {
      return typed(
        "RMLGuidance",
        { version: 793 },
        { version: window.RMLGuidance?.version ?? null }
      );
    }
    if (path.endsWith("/compiler/csharp14_roslyn.js")) {
      return typed(
        "RMLCSharp14Roslyn",
        { validateType: "function" },
        { validateType: typeof window.RMLCSharp14Roslyn?.validate }
      );
    }
    if (path.endsWith("/compiler/compile.js")) {
      return typed(
        "RMLCompile",
        { validateType: "function" },
        { validateType: typeof window.RMLCompile?.validate }
      );
    }
    if (path.endsWith("/compiler/compiler_reference_discovery.js")) {
      return typed(
        "RMLCompilerReferenceDiscovery",
        { scanDirectoryType: "function" },
        {
          scanDirectoryType:
            typeof window.RMLCompilerReferenceDiscovery?.scanDirectory
        }
      );
    }
    if (path.endsWith("/catalog/catalog_loader.js")) {
      return typed(
        "RMLCatalogImportGate",
        {
          loaderModuleId: SCRIPT_LOADER_MODULE_ID,
          loaderVersion: 95,
          requiredApiFactoryVersion: 41
        },
        {
          loaderModuleId:
            window.RMLCatalogImportGate?.moduleId ?? null,
          loaderVersion:
            window.RMLCatalogImportGate?.loaderVersion ?? null,
          requiredApiFactoryVersion:
            window.RMLCatalogImportGate?.requiredApiFactoryVersion ?? null
        }
      );
    }
    if (path.endsWith("/graph/node_graph_registry.js")) {
      return typed(
        "RMLModNodeRegistry",
        { getNodeDefinitionsType: "function" },
        {
          getNodeDefinitionsType:
            typeof window.RMLModNodeRegistry?.getNodeDefinitions
        }
      );
    }
    if (path.endsWith("/graph/node_graph_codegen.js")) {
      return typed(
        "RMLTypedNodeGraphGenerator",
        {
          loaderModuleId: SCRIPT_LOADER_MODULE_ID,
          buildType: "function"
        },
        {
          loaderModuleId:
            window.RMLTypedNodeGraphGenerator?.moduleId ?? null,
          buildType:
            typeof window.RMLTypedNodeGraphGenerator?.build
        }
      );
    }
    if (path.endsWith("/workers/saved_api_composite_compare_worker.js")) {
      return typed(
        "RMLSavedApiCompositeCompareWorkerBootstrap",
        {
          loaderModuleId: SCRIPT_LOADER_MODULE_ID,
          sourceType: "string"
        },
        {
          loaderModuleId:
            window.RMLSavedApiCompositeCompareWorkerBootstrap?.moduleId ?? null,
          sourceType:
            typeof window.RMLSavedApiCompositeCompareWorkerBootstrap?.source
        }
      );
    }
    if (path.endsWith("/graph/node_graph_composites.js")) {
      return typed(
        "RMLNodeGraphCompositesModuleId",
        { loaderModuleId: SCRIPT_LOADER_MODULE_ID },
        {
          loaderModuleId:
            window.RMLNodeGraphCompositesModuleId ?? null
        }
      );
    }
    if (path.endsWith("/graph/node_graph_custom_csharp.js")) {
      return typed(
        "RMLNodeGraphCustomCSharpModuleId",
        { loaderModuleId: SCRIPT_LOADER_MODULE_ID },
        {
          loaderModuleId:
            window.RMLNodeGraphCustomCSharpModuleId ?? null
        }
      );
    }
    if (path.endsWith("/graph/node_graph_view.js")) {
      return typed(
        "RMLNodeGraphViewModuleId",
        { loaderModuleId: SCRIPT_LOADER_MODULE_ID },
        {
          loaderModuleId:
            window.RMLNodeGraphViewModuleId ?? null
        }
      );
    }
    if (path.endsWith("/graph/node_graph_type_migration.js")) {
      return typed(
        "RMLGraphTypeImportMigrations",
        { version: 1 },
        {
          version:
            window.RMLGraphTypeImportMigrations
              ?.version ?? null
        }
      );
    }
    if (path.endsWith("/graph/node_graph_bootstrap.js")) {
      return typed(
        "RMLDynamicGraphHost",
        {
          loaderModuleId: SCRIPT_LOADER_MODULE_ID,
          minimumVersion: 74,
          isReadyType: "function"
        },
        {
          loaderModuleId:
            window.RMLDynamicGraphHost?.moduleId ?? null,
          version: window.RMLDynamicGraphHost?.version ?? null,
          isReadyType:
            typeof window.RMLDynamicGraphHost?.isReady
        }
      );
    }
    if (path.endsWith("/graph/graph_gpu_renderer.js")) {
      return typed(
        "RMLGraphHybridRenderer",
        { createType: "function" },
        { createType: typeof window.RMLGraphHybridRenderer?.create }
      );
    }
    return typed("unknown", {}, {});
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
    const loadRequest = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      state.element = script;
      script.src = state.url;
      script.async = false;
      script.dataset.rmlLazyScript = file.url;
      const cleanup = () => {
        script.removeEventListener("load", onLoad);
        script.removeEventListener("error", onError);
      };
      const settle = (error = null) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) {
          script.remove();
          reject(error);
        } else {
          resolve(true);
        }
      };
      const onLoad = () => {
        if (file.ready && file.ready() !== true) {
          const contract = publicContractDiagnostic(file);
          const failure = new Error(
            `${file.url} loaded without exposing its public contract. ` +
            `Expected ${JSON.stringify(contract.expected)}, ` +
            `received ${JSON.stringify(contract.actual)}.`
          );
          Object.defineProperty(failure, "details", {
            value: Object.freeze({
              code: "RML_LAZY_PUBLIC_CONTRACT_MISMATCH",
              url: state.url,
              loaderModuleId: SCRIPT_LOADER_MODULE_ID,
              exportName: contract.exportName,
              expected: contract.expected,
              actual: contract.actual
            }),
            enumerable: true,
            configurable: false,
            writable: false
          });
          console.error(
            "[RML BUILDER INTERNAL FAILURE] A lazy module loaded but its public contract is incompatible.",
            failure.details
          );
          settle(failure);
          return;
        }
        settle();
      };
      const onError = () => settle(
        new Error(`Could not load ${file.url}.`)
      );
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      (document.body || document.head).appendChild(script);
    });
    state.promise = loadRequest
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
    const available = Boolean(bridge);

    const unavailableReason =
      window.RMLI18n.t("ui.literal.f37b3c4570a4");
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
          ? window.RMLI18n.t("ui.literal.8011c1538e18")
          : window.RMLI18n.t("ui.text.5d3e2ebd8107")) +
        "</span>";
    }
    button.dataset.help = failed
      ? window.RMLI18n.t("ui.literal.01b346413f2c")
      : loading
        ? window.RMLI18n.t("ui.literal.47f2e34d68e8")
        : graph?.active === true
          ? window.RMLI18n.t("ui.literal.c96b62f3fa0e")
          : available
            ? window.RMLI18n.t("ui.literal.0af0a758e5bc")
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
          kicker: window.RMLI18n.t("index.aria_label.755f023e2cc7"),
          title: window.RMLI18n.t("ui.auto.83c44ddd5594"),
          message:
            window.RMLI18n.t("ui.auto.f65c0868f555"),
          detail:
            window.RMLI18n.t("ui.literal.48b127d6c93e"),
          progress: 12,
        }) || 0;
      const continuation = (async () => {
        await startRuntimeViewPreparation();
        const host =
          window.RMLDynamicGraphHost;
        const openPresentation =
          host?.openPresentation;
        if (typeof openPresentation !== "function") {
          throw new Error(
            window.RMLI18n.t("ui.literal.0c66da4e82bd")
          );
        }
        builderWork?.update?.(
          workSession,
          {
            detail:
              window.RMLI18n.t("ui.literal.628eb28fa3d8"),
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
            window.RMLI18n.t("ui.literal.95de08822e96"),
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
    const bridge = window.RMLBuilderBridge;
    if (!bridge) {
      updateRuntimeButton();
      return Promise.resolve(false);
    }
    const graph = runtimeGraphState();
    if (graph?.active !== true) {
      updateRuntimeButton();
      return Promise.resolve(true);
    }
    const page =
      bridge.getActivePage?.() ||
      graph.lastOpenPage ||
      "configuration-outline";
    const preparationKey = JSON.stringify([
      Number(bridge.getProjectEpoch?.()) || 0,
      page,
      graph.active === true
    ]);
    if (
      restoredRuntimeGraphPreparationPromise &&
      restoredRuntimeGraphPreparationKey ===
        preparationKey
    ) {
      return restoredRuntimeGraphPreparationPromise;
    }

    const preparation = Promise.resolve(
      page === "runtime-graph"
        ? startRuntimeViewPreparation()
        : ensure("graph-codegen")
    ).then(() => true);
    restoredRuntimeGraphPreparationKey =
      preparationKey;
    const guardedPreparation =
      preparation.catch(error => {
        if (
          restoredRuntimeGraphPreparationPromise ===
            guardedPreparation &&
          restoredRuntimeGraphPreparationKey ===
            preparationKey
        ) {
          restoredRuntimeGraphPreparationPromise =
            null;
          restoredRuntimeGraphPreparationKey = "";
        }
        throw error;
      });
    restoredRuntimeGraphPreparationPromise =
      guardedPreparation;
    void guardedPreparation
      .catch(error => {
        console.error(
          window.RMLI18n.t("ui.literal.afef0dfe87f0"),
          error
        );
      })
      .finally(updateRuntimeButton);
    updateRuntimeButton();
    return guardedPreparation;
  }

  Object.defineProperty(window, "RMLScriptLoader", {
    value: Object.freeze({
      version: 48,
      moduleId: SCRIPT_LOADER_MODULE_ID,
      ensure,
      prepareRestoredRuntimeGraph,
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
    "rml-builder:ready",
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
    const prepareStatus = status => {
      if (!status) return null;
      status.dataset.manualScannerBound =
        "script-loader-v2";
      status.tabIndex = 0;
      status.setAttribute("role", "button");
      return status;
    };
    const statusFromEvent = event => {
      const current = document.getElementById(
        "api-catalog-state"
      );
      const target = event?.target;
      const matched = typeof target?.closest === "function"
        ? target.closest("#api-catalog-state")
        : target?.id === "api-catalog-state"
          ? target
          : null;
      return matched === current
        ? prepareStatus(current)
        : null;
    };

    prepareStatus(
      document.getElementById("api-catalog-state")
    );
    if (scannerStatusControlInstalled) return;
    scannerStatusControlInstalled = true;

    let loadIntent = 0;
    let loading = false;
    const statusRepresentsVerifiedLive = status => {
      const connection =
        window.RMLRuntimeBridge
          ?.getConnectionState?.();
      return Boolean(
        status?.dataset?.source === "scanner" &&
        status.getAttribute("aria-pressed") === "true" &&
        window.RMLApiNodeFactoryReport
          ?.liveCatalogVerified === true &&
        connection?.mode === "live"
      );
    };
    const run = async status => {
      if (loading) {
        return;
      }
      const intent = ++loadIntent;
      const liveRecheck =
        statusRepresentsVerifiedLive(status);
      loading = true;
      status.dataset.source = "updating";
      status.textContent = window.RMLI18n.t("{{i18n:js.presentation.be775996d3f7}}");
      status.setAttribute("aria-busy", "true");
      status.title = window.RMLI18n.t("ui.auto.ef5bac1920fc");
      status.setAttribute("aria-label", `${status.textContent}. ${status.title}`);
      const builderWork =
        window.RMLBuilderWork;
      const workSession =
        liveRecheck
          ? 0
          : builderWork?.begin?.({
              kicker:
                window.RMLI18n.t("ui.literal.924e20a624e5"),
              title:
                window.RMLI18n.t("ui.auto.4fbd685b87a4"),
              message:
                window.RMLI18n.t("ui.auto.ef5bac1920fc"),
              detail:
                window.RMLI18n.t("ui.auto.112240abb0c0"),
              progress: 1
            }) || 0;
      try {
        await Promise.all([
          window.RMLScriptLoader.ensure(
            "scanner-connection"
          ),
          window.RMLScriptLoader.ensure(
            "node-registry"
          )
        ]);
        if (!loading || intent !== loadIntent) return;
        builderWork?.update?.(
          workSession,
          {
            progress: 8,
            detail:
              window.RMLI18n.t("ui.auto.112240abb0c0")
          }
        );
        await window.RMLCatalogImportGate
          ?.synchronizeLive?.({
            showWork:
              !liveRecheck &&
              workSession === 0,
            showWorkOnCatalogChange:
              liveRecheck,
            forceRetry: true,
            trigger: "button"
          });
      } catch (error) {
        console.error(
          "[RML BUILDER INTERNAL FAILURE] The explicit scanner button operation failed.",
          error
        );
        if (intent !== loadIntent) return;
        status.dataset.source = window.RMLResoniteApiCatalog ||
          window.RMLFrooxComponentCatalog
          ? "cache"
          : "unavailable";
        status.setAttribute("aria-busy", "false");
      } finally {
        if (intent === loadIntent) {
          loading = false;
          prepareStatus(
            document.getElementById(
              "api-catalog-state"
            )
          )?.setAttribute("aria-busy", "false");
          window.RMLCatalogImportGate
            ?.refreshStatus?.();
          if (workSession) {
            builderWork?.finish?.(
              workSession
            );
          }
        }
      }
    };

    document.addEventListener("click", event => {
      const status = statusFromEvent(event);
      if (!status) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      void run(status);
    }, true);
    document.addEventListener("keydown", event => {
      const status = statusFromEvent(event);
      if (!status) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!event.repeat) void run(status);
      }
    }, true);

    Object.defineProperty(
      window,
      "RMLScannerStatusControl",
      {
        value: Object.freeze({
          version: 2,
          moduleId: SCRIPT_LOADER_MODULE_ID,
          owner: "script-loader",
          refresh() {
            return Boolean(
              prepareStatus(
                document.getElementById(
                  "api-catalog-state"
                )
              )
            );
          }
        }),
        writable: false,
        enumerable: true,
        configurable: true
      }
    );
  }
  installScannerStatusControl();
})();
