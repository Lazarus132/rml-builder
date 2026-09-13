(() => {
  "use strict";
  // Runtime Graph entrypoint and module loader.

  const NODE_GRAPH_RELEASE_ID =
    "1.20.31-universal-presentation-dev39-clean-stale-api-repair";

  if (
    window.RMLTypedNodeGraphGenerator?.moduleId ===
      NODE_GRAPH_RELEASE_ID &&
    typeof window.RMLTypedNodeGraphGenerator?.build === "function" &&
    (
      typeof document === "undefined" ||
      (
        window.RMLDynamicGraphHost?.moduleId ===
          NODE_GRAPH_RELEASE_ID &&
        window.RMLDynamicGraphHost?.version >= 73 &&
        typeof window.RMLDynamicGraphHost?.isReady === "function"
      )
    )
  ) {
    return;
  }

  const workerFiles = [
    "../core/code_templates.js?v=794-shared-loader-runtime",
    "../core/guidance.js?v=793",
    "node_graph_registry.js?v=1-physical-modules-v748",
    "node_graph_codegen.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair"
  ];

  if (
    typeof importScripts === "function"
  ) {
    importScripts(...workerFiles);
    return;
  }

  const loader = window.RMLScriptLoader;
  if (typeof loader?.ensure === "function") {
    const ready = (
      window.RMLStyleLoader
        ?.ensure?.("runtime-graph") ||
      Promise.resolve(true)
    ).then(() => loader.ensure("runtime-core"));
    Object.defineProperty(window, "RMLLegacyNodeGraphReady", {
      value: ready,
      writable: false,
      enumerable: true,
      configurable: true
    });
    return;
  }

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const styleReady = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'link[data-rml-style-bundle="runtime-graph"], ' +
      'style[data-rml-style-bundle="runtime-graph"]'
    );
    if (existing) {
      if (
        existing.tagName === "STYLE" ||
        existing.sheet
      ) {
        resolve(true);
        return;
      }
      existing.addEventListener("load", resolve, {
        once: true
      });
      existing.addEventListener(
        "error",
        () => reject(
          new Error("Could not load Runtime Graph styles.")
        ),
        { once: true }
      );
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(
      "../../styles/features/styles.runtime-graph.css?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
      scriptUrl
    ).href;
    link.dataset.rmlStyleBundle = "runtime-graph";
    link.addEventListener("load", resolve, { once: true });
    link.addEventListener(
      "error",
      () => reject(
        new Error("Could not load Runtime Graph styles.")
      ),
      { once: true }
    );
    document.head.appendChild(link);
  });
  const files = [
    ...(window.RMLCodeTemplates ? [] : ["../core/code_templates.js?v=794-shared-loader-runtime"]),
    ...(window.RMLGuidance ? [] : ["../core/guidance.js?v=793"]),
    ...(
      window.RMLClassStyles
        ? []
        : [
            "../loaders/style_loader.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair"
          ]
    ),
    "node_graph_registry.js?v=1-physical-modules-v748",
    "node_graph_codegen.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
    "runtime_bridge.js?v=797-manual-port-discovery",
    "../workers/saved_api_composite_compare_worker.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
    "node_graph_composites.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
    "node_graph_custom_csharp.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
    "node_graph_guided.js?v=1-physical-modules-v748",
    "node_graph_view.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
    "graph_gpu_renderer.js?v=806-universal-graph-presentation",
    "node_graph_bootstrap.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair"
  ];

  const ready = files.reduce(
    (previous, file) => previous.then(() =>
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL(file, scriptUrl).href;
        script.async = false;
        script.addEventListener("load", resolve, { once: true });
        script.addEventListener(
          "error",
          () => reject(new Error(`Could not load ${file}.`)),
          { once: true }
        );
        (document.body || document.head).appendChild(script);
      })
    ),
    styleReady
  );

  Object.defineProperty(window, "RMLLegacyNodeGraphReady", {
    value: ready,
    writable: false,
    enumerable: true,
    configurable: true
  });
})();
