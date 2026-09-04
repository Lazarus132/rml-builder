(() => {
  "use strict";

  if (
    typeof window.RMLTypedNodeGraphGenerator?.build === "function" &&
    (
      typeof document === "undefined" ||
      typeof window.RMLDynamicGraphHost?.isReady === "function"
    )
  ) {
    return;
  }

  const workerFiles = [
    "node_graph_registry.js?v=1-physical-modules-v748",
    "node_graph_codegen.js?v=1-physical-modules-v748"
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
      "../../styles/features/styles.runtime-graph.css?v=4-max-graph-performance-v755",
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
    ...(
      window.RMLClassStyles
        ? []
        : [
            "../loaders/style_loader.js?v=5-runtime-prefetch-v763"
          ]
    ),
    "node_graph_registry.js?v=1-physical-modules-v748",
    "node_graph_codegen.js?v=1-physical-modules-v748",
    "runtime_bridge.js?v=5-physical-modules-v748",
    "node_graph_composites.js?v=4-gzip-import-recovery-v757",
    "node_graph_custom_csharp.js?v=8-custom-csharp-render-barrier-v766",
    "node_graph_guided.js?v=1-physical-modules-v748",
    "node_graph_view.js?v=9-custom-csharp-render-barrier-v766",
    "node_graph_bootstrap.js?v=1-physical-modules-v748"
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
