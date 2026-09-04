(() => {
  "use strict";

  const CLASS_STYLE_VERSION = 1;

  function installClassStyleRuntime() {
    if (
      window.RMLClassStyles?.version >=
        CLASS_STYLE_VERSION
    ) {
      return window.RMLClassStyles;
    }

    const pxAttributes = new Set(`
      data-rml-adaptive-card-height
      data-rml-adaptive-card-max-height
      data-rml-adaptive-card-max-width
      data-rml-adaptive-card-width
      data-rml-adaptive-text-min-height
      data-rml-bottom-padding
      data-rml-box-height
      data-rml-box-left
      data-rml-box-top
      data-rml-box-width
      data-rml-card-left
      data-rml-card-top
      data-rml-control-size
      data-rml-controls-left
      data-rml-controls-top
      data-rml-css-height
      data-rml-css-width
      data-rml-font-size
      data-rml-ghost-x
      data-rml-ghost-y
      data-rml-graph-edit-inspector-height
      data-rml-graph-edit-palette-height
      data-rml-graph-edit-viewport-height
      data-rml-graph-edit-viewport-left
      data-rml-graph-edit-viewport-top
      data-rml-graph-edit-viewport-width
      data-rml-header-gap
      data-rml-header-height
      data-rml-header-left
      data-rml-header-left-inset
      data-rml-header-right-inset
      data-rml-header-safe-top
      data-rml-header-width
      data-rml-min-width
      data-rml-mobile-viewport-height
      data-rml-modal-left
      data-rml-modal-top
      data-rml-mouse-x
      data-rml-mouse-y
      data-rml-node-height
      data-rml-node-width
      data-rml-node-x
      data-rml-node-y
      data-rml-overlay-left
      data-rml-overlay-top
      data-rml-popup-left
      data-rml-popup-max-width
      data-rml-popup-top
      data-rml-popup-width
      data-rml-preview-glow-size
      data-rml-result-glow-size
      data-rml-swatch-glow-size
      data-rml-thumb-height
      data-rml-thumb-offset
      data-rml-viewport-x
      data-rml-viewport-y
    `.trim().split(/\s+/));
    const millisecondAttributes = new Set(`
      data-rml-mouse-duration
      data-rml-move-duration
      data-rml-travel-duration
    `.trim().split(/\s+/));
    const lengthAttributes = new Set(`
      data-rml-box-radius
      data-rml-picker-canvas-height
      data-rml-picker-canvas-width
      data-rml-picker-left
      data-rml-placeholder-height
      data-rml-placeholder-left
      data-rml-placeholder-top
      data-rml-placeholder-width
      data-rml-visible-height
      data-rml-visible-width
      data-rml-visual-left
      data-rml-visual-top
    `.trim().split(/\s+/));
    const colorAttributes = new Set(`
      data-rml-alpha-color
      data-rml-node-icon-color
      data-rml-palette-color
      data-rml-port-color
      data-rml-preview-color
      data-rml-preview-glow
      data-rml-result-color
      data-rml-result-glow
      data-rml-setup-port-glow
      data-rml-swatch-alpha
      data-rml-swatch-glow
      data-rml-swatch-opaque
      data-rml-travel-color
      data-rml-type-color
      data-rml-wire-color
    `.trim().split(/\s+/));
    const numberAttributes = new Set(`
      data-hue
      data-rml-inline-width-percent
      data-rml-mobile-ui-scale
      data-rml-picker-scale
      data-rml-viewport-scale
      data-saturation
      data-value
    `.trim().split(/\s+/));
    const integerAttributes = new Set(`
      data-rml-key-index
      data-rml-overlay-z
      data-rml-runtime-display-column-count
    `.trim().split(/\s+/));
    const percentageAttributes = new Set(`
      data-rml-load-progress
      data-rml-progress
      data-rml-range-progress
    `.trim().split(/\s+/));
    const attributeNames = Object.freeze([
      ...pxAttributes,
      ...millisecondAttributes,
      ...lengthAttributes,
      ...colorAttributes,
      ...numberAttributes,
      ...integerAttributes,
      ...percentageAttributes
    ]);
    const observedAttributeNames =
      Object.freeze([
        ...attributeNames,
        "class"
      ]);
    const attributeSelector =
      attributeNames
        .map(name => `[${name}]`)
        .join(",");
    const generatedClassPrefix =
      "rml-class-style-";
    const documentStates = new WeakMap();
    const elementRecords = new WeakMap();
    let nextDocumentId = 0;

    function strictNumber(value) {
      const text = String(value ?? "").trim();
      if (
        !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i
          .test(text)
      ) {
        return null;
      }
      const number = Number(text);
      return Number.isFinite(number)
        ? String(number)
        : null;
    }

    function safeCssValue(
      element,
      value,
      property
    ) {
      const text = String(value ?? "").trim();
      if (
        !text ||
        /[;{}]/.test(text)
      ) {
        return null;
      }
      const css =
        element.ownerDocument
          ?.defaultView?.CSS ||
        window.CSS;
      if (
        typeof css?.supports === "function" &&
        !css.supports(property, text)
      ) {
        return null;
      }
      return text;
    }

    function formattedAttributeValue(
      element,
      name
    ) {
      const value = element.getAttribute(name);
      if (value === null) {
        return null;
      }
      if (pxAttributes.has(name)) {
        const number = strictNumber(value);
        return number === null
          ? safeCssValue(element, value, "width")
          : `${number}px`;
      }
      if (millisecondAttributes.has(name)) {
        const number = strictNumber(value);
        return number === null
          ? safeCssValue(
              element,
              value,
              "transition-duration"
            )
          : `${Math.max(0, Number(number))}ms`;
      }
      if (lengthAttributes.has(name)) {
        return safeCssValue(
          element,
          value,
          name === "data-rml-box-radius"
            ? "border-radius"
            : "width"
        );
      }
      if (colorAttributes.has(name)) {
        return safeCssValue(
          element,
          value,
          "color"
        );
      }
      if (percentageAttributes.has(name)) {
        const text = String(value).trim();
        const normalized = text.endsWith("%")
          ? strictNumber(text.slice(0, -1))
          : strictNumber(text);
        return normalized === null
          ? null
          : `${normalized}%`;
      }
      const number = strictNumber(value);
      if (number === null) {
        return null;
      }
      return integerAttributes.has(name)
        ? String(Math.trunc(Number(number)))
        : number;
    }

    function propertyName(attributeName) {
      return `--rml-attr-${
        attributeName.slice(5)
      }`;
    }

    function isElement(value) {
      return Boolean(
        value &&
        value.nodeType === 1 &&
        typeof value.hasAttribute ===
          "function" &&
        value.classList
      );
    }

    function createDocumentState(doc) {
      const style = doc.createElement("style");
      style.dataset.rmlClassStyleRules =
        String(CLASS_STYLE_VERSION);
      (
        doc.head ||
        doc.documentElement
      ).appendChild(style);
      const state = {
        id: ++nextDocumentId,
        style,
        sheet: style.sheet,
        nextRuleId: 0,
        availableRules: [],
        observer: null
      };
      documentStates.set(doc, state);

      const Observer =
        doc.defaultView?.MutationObserver ||
        window.MutationObserver;
      if (
        typeof Observer === "function" &&
        doc.documentElement
      ) {
        state.observer = new Observer(
          records => {
            const changedElements =
              new Set();
            for (const record of records) {
              if (record.type === "attributes") {
                changedElements.add(
                  record.target
                );
                continue;
              }
              for (const removed of
                record.removedNodes) {
                releaseTree(removed);
              }
              for (const added of
                record.addedNodes) {
                synchronizeTree(
                  added,
                  state
                );
              }
            }
            for (const element of
              changedElements) {
              synchronizeElement(
                element,
                state
              );
            }
          }
        );
        state.observer.observe(
          doc.documentElement,
          {
            attributes: true,
            attributeFilter:
              observedAttributeNames,
            childList: true,
            subtree: true
          }
        );
      }
      return state;
    }

    function stateForDocument(doc) {
      return documentStates.get(doc) ||
        createDocumentState(doc);
    }

    function allocateRule(state) {
      const reusable =
        state.availableRules.pop();
      if (reusable) {
        return reusable;
      }
      const className =
        `${generatedClassPrefix}${state.id}-${
          ++state.nextRuleId
        }`;
      const index =
        state.sheet.cssRules.length;
      state.sheet.insertRule(
        `.${className}{}`,
        index
      );
      return {
        className,
        rule: state.sheet.cssRules[index],
        state,
        signature: ""
      };
    }

    function releaseElement(element) {
      const record =
        elementRecords.get(element);
      if (!record) {
        for (const className of [
          ...element.classList
        ]) {
          if (
            className.startsWith(
              generatedClassPrefix
            )
          ) {
            element.classList.remove(
              className
            );
          }
        }
        return;
      }
      element.classList.remove(
        record.className
      );
      record.rule.style.cssText = "";
      record.signature = "";
      elementRecords.delete(element);
      record.state.availableRules.push(record);
    }

    function releaseTree(root) {
      if (!isElement(root)) {
        return;
      }
      releaseElement(root);
      for (const element of
        root.querySelectorAll("*")) {
        if (elementRecords.has(element)) {
          releaseElement(element);
        } else if (
          element.className &&
          String(element.className).includes(
            generatedClassPrefix
          )
        ) {
          releaseElement(element);
        }
      }
    }

    function synchronizeElement(
      element,
      suppliedState = null
    ) {
      if (!isElement(element)) {
        return false;
      }
      const declarations = [];
      for (const name of attributeNames) {
        if (!element.hasAttribute(name)) {
          continue;
        }
        const value =
          formattedAttributeValue(
            element,
            name
          );
        if (value !== null) {
          declarations.push([
            propertyName(name),
            value
          ]);
        }
      }

      if (declarations.length === 0) {
        releaseElement(element);
        return false;
      }

      const state = suppliedState ||
        stateForDocument(
          element.ownerDocument
        );
      let record =
        elementRecords.get(element);
      if (
        record &&
        record.state !== state
      ) {
        releaseElement(element);
        record = null;
      }
      if (!record) {
        releaseElement(element);
        record = allocateRule(state);
        elementRecords.set(
          element,
          record
        );
        element.classList.add(
          record.className
        );
      } else if (
        !element.classList.contains(
          record.className
        )
      ) {
        element.classList.add(
          record.className
        );
      }

      const signature = declarations
        .map(entry => entry.join("\u0000"))
        .join("\u0001");
      if (record.signature === signature) {
        return true;
      }
      record.rule.style.cssText = "";
      for (const [property, value] of
        declarations) {
        record.rule.style.setProperty(
          property,
          value
        );
      }
      record.signature = signature;
      return true;
    }

    function removeForeignClasses(element) {
      if (
        !isElement(element) ||
        elementRecords.has(element)
      ) {
        return;
      }
      for (const className of [
        ...element.classList
      ]) {
        if (
          className.startsWith(
            generatedClassPrefix
          )
        ) {
          element.classList.remove(
            className
          );
        }
      }
    }

    function synchronizeTree(
      root,
      suppliedState = null
    ) {
      if (!isElement(root)) {
        return 0;
      }
      const state = suppliedState ||
        stateForDocument(root.ownerDocument);
      let count = 0;
      removeForeignClasses(root);
      if (root.matches(attributeSelector)) {
        count += synchronizeElement(
          root,
          state
        ) ? 1 : 0;
      }
      for (const element of
        root.querySelectorAll(
          `${attributeSelector},[class*="${generatedClassPrefix}"]`
        )) {
        removeForeignClasses(element);
        if (
          element.matches(attributeSelector)
        ) {
          count += synchronizeElement(
            element,
            state
          ) ? 1 : 0;
        }
      }
      return count;
    }

    const api = Object.freeze({
      version: CLASS_STYLE_VERSION,
      attributes: attributeNames,
      sync: synchronizeElement,
      syncTree: synchronizeTree,
      observe(doc = document) {
        const state =
          stateForDocument(doc);
        if (doc.documentElement) {
          synchronizeTree(
            doc.documentElement,
            state
          );
        }
        return true;
      }
    });
    Object.defineProperty(
      window,
      "RMLClassStyles",
      {
        value: api,
        writable: false,
        enumerable: true,
        configurable: true
      }
    );
    api.observe(document);
    return api;
  }

  installClassStyleRuntime();

  const currentScriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const baseUrl = new URL(".", currentScriptUrl);
  const bundleFiles = Object.freeze({
    preview: "../../styles/features/styles.preview.css?v=4-max-graph-performance-v755",
    information: "../../styles/features/styles.information.css?v=2-max-graph-performance-v755",
    setup: "../../styles/features/styles.setup.css?v=4-max-graph-performance-v755",
    project: "../../styles/features/styles.project.css?v=4-max-graph-performance-v755",
    export: "../../styles/features/styles.export.css?v=2-max-graph-performance-v755",
    "runtime-graph": "../../styles/features/styles.runtime-graph.css?v=4-max-graph-performance-v755"
  });
  const bundleOrder = Object.freeze([
    "preview",
    "project",
    "export",
    "information",
    "runtime-graph",
    "setup"
  ]);
  const states = new Map();
  const prefetchedBundles = new Set();
  const pendingWorkerRequests = new Map();
  let worker = null;
  let nextRequestId = 1;

  function stateFor(name) {
    if (!states.has(name)) {
      states.set(name, {
        status: "idle",
        promise: null,
        element: null,
        error: null
      });
    }
    return states.get(name);
  }

  function bundleUrl(name) {
    const file = bundleFiles[name];
    if (!file) {
      throw new Error(`Unknown style bundle: ${name}`);
    }
    return new URL(file, baseUrl).href;
  }

  function prefetch(name) {
    const state = stateFor(name);
    if (
      state.status === "loading" ||
      state.status === "loaded"
    ) {
      return true;
    }

    const url = bundleUrl(name);
    if (prefetchedBundles.has(url)) {
      return true;
    }
    prefetchedBundles.add(url);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "style";
    link.href = url;
    link.fetchPriority = "low";
    link.dataset.rmlStylePrefetch = name;
    link.addEventListener(
      "error",
      () => {
        prefetchedBundles.delete(url);
        link.remove();
      },
      { once: true }
    );
    document.head.appendChild(link);
    return true;
  }

  function insertBundleElement(element, name) {
    const order = bundleOrder.indexOf(name);
    const candidates = document.head.querySelectorAll(
      "style[data-rml-style-bundle], link[data-rml-style-bundle]"
    );
    const next = [...candidates].find(candidate =>
      bundleOrder.indexOf(candidate.dataset.rmlStyleBundle) > order
    );
    document.head.insertBefore(element, next || null);
  }

  function installStyleText(name, url, text) {
    const existing = document.querySelector(
      `style[data-rml-style-bundle="${CSS.escape(name)}"], ` +
      `link[data-rml-style-bundle="${CSS.escape(name)}"]`
    );
    if (existing) return existing;

    const style = document.createElement("style");
    style.dataset.rmlStyleBundle = name;
    style.dataset.rmlStyleSource = url;
    style.textContent = `${text}\n/*# sourceURL=${url} */`;
    insertBundleElement(style, name);
    return style;
  }

  function loadWithStylesheetLink(name, url) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        `link[data-rml-style-bundle="${CSS.escape(name)}"]`
      );
      if (existing?.sheet) {
        resolve(existing);
        return;
      }

      const link = existing || document.createElement("link");
      link.rel = "stylesheet";
      link.href = url;
      link.dataset.rmlStyleBundle = name;
      link.addEventListener("load", () => resolve(link), { once: true });
      link.addEventListener(
        "error",
        () => {
          link.remove();
          reject(new Error(`${url} could not be loaded.`));
        },
        { once: true }
      );
      if (!existing) insertBundleElement(link, name);
    });
  }

  function rejectWorkerRequests(error) {
    for (const request of pendingWorkerRequests.values()) {
      window.clearTimeout(request.timeoutId);
      request.reject(error);
    }
    pendingWorkerRequests.clear();
  }

  function ensureWorker() {
    if (worker) return worker;
    if (typeof Worker !== "function" || window.location.protocol === "file:") {
      return null;
    }

    try {
      worker = new Worker(
        new URL(
          "../workers/style_loader_worker.js?v=2-max-graph-performance-v755",
          baseUrl
        ).href
      );
      worker.addEventListener("message", event => {
        const requestId = Number(event.data?.requestId) || 0;
        const request = pendingWorkerRequests.get(requestId);
        if (!request) return;
        pendingWorkerRequests.delete(requestId);
        window.clearTimeout(request.timeoutId);
        if (event.data?.ok === true) {
          request.resolve(String(event.data.text || ""));
        } else {
          request.reject(
            new Error(
              String(event.data?.message || "The stylesheet worker failed.")
            )
          );
        }
      });
      worker.addEventListener("error", event => {
        const error = new Error(
          event.message || "The stylesheet worker stopped unexpectedly."
        );
        rejectWorkerRequests(error);
        worker?.terminate();
        worker = null;
      });
      return worker;
    } catch {
      worker = null;
      return null;
    }
  }

  function fetchInWorker(url) {
    const activeWorker = ensureWorker();
    if (!activeWorker) {
      return Promise.reject(
        new Error("A stylesheet worker is not available in this context.")
      );
    }
    const requestId = nextRequestId;
    nextRequestId += 1;
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        pendingWorkerRequests.delete(requestId);
        reject(new Error(`${url} did not finish loading within 30 seconds.`));
      }, 30000);
      pendingWorkerRequests.set(requestId, {
        resolve,
        reject,
        timeoutId
      });
      activeWorker.postMessage({ requestId, url });
    });
  }

  function ensure(name) {
    const state = stateFor(name);
    if (state.status === "loaded") {
      return Promise.resolve(state.element);
    }
    if (state.promise) return state.promise;

    const url = bundleUrl(name);
    state.status = "loading";
    state.error = null;
    state.promise = fetchInWorker(url)
      .then(text => installStyleText(name, url, text))
      .catch(workerError =>
        loadWithStylesheetLink(name, url).catch(linkError => {
          throw new AggregateError(
            [workerError, linkError],
            `${name} styles could not be loaded.`
          );
        })
      )
      .then(element => {
        state.status = "loaded";
        state.element = element;
        state.promise = null;
        document.dispatchEvent(
          new CustomEvent("rml-style-bundle-ready", {
            detail: Object.freeze({ name, url })
          })
        );
        return element;
      })
      .catch(error => {
        state.status = "failed";
        state.error = error;
        state.promise = null;
        throw error;
      });
    return state.promise;
  }

  function ensureMany(names) {
    return Promise.all(
      [...new Set(names)].map(name => ensure(name))
    );
  }

  Object.defineProperty(window, "RMLStyleLoader", {
    value: Object.freeze({
      version: 5,
      ensure,
      ensureMany,
      prefetch,
      warm(name) {
        return ensure(name);
      },
      isLoaded(name) {
        return stateFor(name).status === "loaded";
      },
      status(name) {
        const state = stateFor(name);
        return Object.freeze({
          status: state.status,
          error: state.error
        });
      },
      bundles: Object.freeze(Object.keys(bundleFiles))
    }),
    writable: false,
    enumerable: true,
    configurable: true
  });
})();
