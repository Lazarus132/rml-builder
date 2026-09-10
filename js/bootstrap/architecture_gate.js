(() => {
  "use strict";

  const MODULE_ID =
    "1.20.31-universal-presentation-dev23";
  const GATE_VERSION = 1;
  const DETECTION_TIMEOUT_MS = 5000;
  const HIGH_ENTROPY_HINTS = Object.freeze([
    "architecture",
    "bitness",
    "platform",
    "wow64"
  ]);
  const KNOWN_32_BIT_ARCHITECTURES =
    new Set(["x86", "arm"]);

  if (
    Object.hasOwn(
      window,
      "RMLBuilderBuildId"
    ) &&
    window.RMLBuilderBuildId !== MODULE_ID
  ) {
    throw new Error(
      `Builder module version mismatch: index.html published '${String(window.RMLBuilderBuildId || "missing")}', but architecture_gate.js is '${MODULE_ID}'. Reload the Builder without cached files.`
    );
  }

  if (
    window.RMLArchitectureGate?.version >=
      GATE_VERSION &&
    window.RMLArchitectureGate?.moduleId ===
      MODULE_ID
  ) {
    return;
  }

  const root = document.documentElement;
  let state = "probing";
  let bootstrapPromise = null;
  let proceedResolver = null;
  let builderStart = null;
  let builderStartPromise = null;
  let blockedElements = [];
  let previousActiveElement = null;

  function setRootState(value) {
    root.dataset.rmlArchitectureGate = value;
  }

  function normalizedHint(value) {
    return value
      .trim()
      .toLowerCase();
  }

  function ownStringHint(value, key) {
    return (
      Object.hasOwn(value, key) &&
      typeof value[key] === "string"
    )
      ? normalizedHint(value[key])
      : "";
  }

  async function detectNativeWindows32Bit(
    navigatorValue = window.navigator
  ) {
    const clientHints =
      navigatorValue?.userAgentData;
    if (
      !clientHints ||
      typeof clientHints.getHighEntropyValues !==
        "function"
    ) {
      return false;
    }

    let values;
    try {
      values =
        await clientHints.getHighEntropyValues(
          [...HIGH_ENTROPY_HINTS]
        );
    } catch {
      return false;
    }

    if (
      !values ||
      typeof values !== "object"
    ) {
      return false;
    }

    let platform;
    let architecture;
    let bitness;
    let wow64;
    try {
      platform = ownStringHint(
        values,
        "platform"
      );
      architecture = ownStringHint(
        values,
        "architecture"
      );
      bitness = ownStringHint(
        values,
        "bitness"
      );
      wow64 =
        Object.hasOwn(values, "wow64") &&
        typeof values.wow64 === "boolean"
          ? values.wow64
          : null;
    } catch {
      return false;
    }

    return (
      platform === "windows" &&
      bitness === "32" &&
      KNOWN_32_BIT_ARCHITECTURES.has(
        architecture
      ) &&
      wow64 === false
    );
  }

  function detectionWithTimeout() {
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(value === true);
      };
      const timeout = window.setTimeout(
        () => finish(false),
        DETECTION_TIMEOUT_MS
      );
      Promise.resolve(
        detectNativeWindows32Bit()
      ).then(
        finish,
        () => finish(false)
      );
    });
  }

  function overlay() {
    return document.getElementById(
      "rml-architecture-gate"
    );
  }

  function proceedButton() {
    return document.getElementById(
      "rml-architecture-gate-proceed"
    );
  }

  function isProceedButtonFullyVisible(
    button
  ) {
    if (
      typeof button?.getBoundingClientRect !==
        "function"
    ) {
      return true;
    }

    let buttonRect;
    let gateRect;
    try {
      buttonRect = button.getBoundingClientRect();
      gateRect = overlay()
        ?.getBoundingClientRect?.();
    } catch {
      return true;
    }

    const finiteRectangle = rectangle =>
      rectangle &&
      [
        rectangle.top,
        rectangle.right,
        rectangle.bottom,
        rectangle.left
      ].every(Number.isFinite);
    if (!finiteRectangle(buttonRect)) {
      return true;
    }

    const viewportWidth =
      Number.isFinite(window.innerWidth)
        ? window.innerWidth
        : root.clientWidth;
    const viewportHeight =
      Number.isFinite(window.innerHeight)
        ? window.innerHeight
        : root.clientHeight;
    let top = 0;
    let left = 0;
    let right = Number.isFinite(viewportWidth)
      ? viewportWidth
      : Infinity;
    let bottom = Number.isFinite(viewportHeight)
      ? viewportHeight
      : Infinity;
    if (finiteRectangle(gateRect)) {
      top = Math.max(top, gateRect.top);
      left = Math.max(left, gateRect.left);
      right = Math.min(right, gateRect.right);
      bottom = Math.min(bottom, gateRect.bottom);
    }

    return (
      buttonRect.top >= top &&
      buttonRect.left >= left &&
      buttonRect.right <= right &&
      buttonRect.bottom <= bottom
    );
  }

  function revealProceedButtonIfNeeded(
    button
  ) {
    if (
      isProceedButtonFullyVisible(button) ||
      typeof button?.scrollIntoView !==
        "function"
    ) {
      return;
    }
    try {
      button.scrollIntoView({
        block: "nearest",
        inline: "nearest"
      });
    } catch {
      try {
        button.scrollIntoView();
      } catch {}
    }
  }

  function focusProceedButton() {
    const button = proceedButton();
    if (!button) return;
    try {
      button.focus({ preventScroll: true });
    } catch {
      button.focus();
    }
    revealProceedButtonIfNeeded(button);
  }

  function keepFocusInsideOverlay(event) {
    if (
      state !== "blocked" ||
      overlay()?.contains(event.target)
    ) {
      return;
    }
    focusProceedButton();
  }

  function handleBlockedKeydown(event) {
    if (state !== "blocked") return;
    if (event.key === "Tab") {
      event.preventDefault();
      focusProceedButton();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      focusProceedButton();
    }
  }

  function blockBackgroundForAssistiveTech(
    gate
  ) {
    blockedElements = [
      ...(document.body?.children || [])
    ]
      .filter(element => element !== gate)
      .map(element => ({
        element,
        ariaHidden:
          element.getAttribute("aria-hidden"),
        inert: element.inert === true
      }));

    for (const record of blockedElements) {
      record.element.inert = true;
      record.element.setAttribute(
        "aria-hidden",
        "true"
      );
    }
  }

  function restoreBackgroundAccessibility() {
    for (const record of blockedElements) {
      record.element.inert = record.inert;
      if (record.ariaHidden === null) {
        record.element.removeAttribute(
          "aria-hidden"
        );
      } else {
        record.element.setAttribute(
          "aria-hidden",
          record.ariaHidden
        );
      }
    }
    blockedElements = [];
  }

  function activateOverlay() {
    const gate = overlay();
    const button = proceedButton();
    if (!gate || !button) {
      throw new Error(
        "The 32-bit architecture notice is missing from index.html. The Builder was not started."
      );
    }

    state = "blocked";
    setRootState("blocked");
    previousActiveElement =
      document.activeElement;
    gate.hidden = false;
    blockBackgroundForAssistiveTech(gate);
    document.addEventListener(
      "focusin",
      keepFocusInsideOverlay,
      true
    );
    document.addEventListener(
      "keydown",
      handleBlockedKeydown,
      true
    );
    button.addEventListener(
      "click",
      proceed,
      { once: true }
    );
    focusProceedButton();
  }

  function releaseOverlay() {
    const gate = overlay();
    if (gate) gate.hidden = true;
    document.removeEventListener(
      "focusin",
      keepFocusInsideOverlay,
      true
    );
    document.removeEventListener(
      "keydown",
      handleBlockedKeydown,
      true
    );
    restoreBackgroundAccessibility();
    if (
      previousActiveElement?.isConnected &&
      typeof previousActiveElement.focus ===
        "function"
    ) {
      previousActiveElement.focus();
    }
    previousActiveElement = null;
  }

  function proceed() {
    if (
      state !== "blocked" ||
      typeof proceedResolver !== "function"
    ) {
      return false;
    }
    const resolve = proceedResolver;
    proceedResolver = null;
    resolve();
    return true;
  }

  function waitForProceed() {
    return new Promise(resolve => {
      proceedResolver = resolve;
      activateOverlay();
    });
  }

  function loadBuilderScript(source) {
    return new Promise((resolve, reject) => {
      const script =
        document.createElement("script");
      script.async = false;
      script.src = source;
      script.dataset
        .rmlArchitectureBootstrap = "true";
      script.addEventListener(
        "load",
        () => resolve(script),
        { once: true }
      );
      script.addEventListener(
        "error",
        () => reject(
          new Error(
            `${source} could not be loaded after the architecture gate.`
          )
        ),
        { once: true }
      );
      document.body.appendChild(script);
    });
  }

  function registerBuilderStart(callback) {
    if (typeof callback !== "function") {
      throw new TypeError(
        "The architecture gate requires a callable Builder start function."
      );
    }
    if (
      builderStart &&
      builderStart !== callback
    ) {
      throw new Error(
        "The Builder start function was registered more than once."
      );
    }
    builderStart = callback;
    return true;
  }

  function startBuilderOnce() {
    if (builderStartPromise) {
      return builderStartPromise;
    }
    if (typeof builderStart !== "function") {
      return Promise.reject(
        new Error(
          "app.js did not register the Builder start function. The Builder was not initialized."
        )
      );
    }
    builderStartPromise =
      Promise.resolve().then(() =>
        builderStart()
      );
    return builderStartPromise;
  }

  function bootstrap(sources) {
    if (bootstrapPromise) {
      return bootstrapPromise;
    }

    const orderedSources = [
      ...(Array.isArray(sources)
        ? sources
        : [])
    ].map(value => String(value || ""))
      .filter(Boolean);

    bootstrapPromise = (async () => {
      const shouldBlock = await decision;
      if (shouldBlock) {
        await waitForProceed();
      }

      releaseOverlay();
      state = "starting";
      setRootState("starting");

      for (const source of orderedSources) {
        await loadBuilderScript(source);
      }

      state = "scripts-ready";
      setRootState("scripts-ready");
      await startBuilderOnce();

      state = "started";
      setRootState("started");
      return Object.freeze({
        started: true,
        blocked: shouldBlock,
        scriptCount: orderedSources.length
      });
    })().catch(error => {
      state = "error";
      setRootState("error");
      throw error;
    });

    return bootstrapPromise;
  }

  setRootState("pending");
  const decision = detectionWithTimeout()
    .then(shouldBlock => {
      if (!shouldBlock && state === "probing") {
        state = "clear";
        setRootState("clear");
      }
      return shouldBlock;
    });

  Object.defineProperty(
    window,
    "RMLArchitectureGate",
    {
      value: Object.freeze({
        version: GATE_VERSION,
        moduleId: MODULE_ID,
        hints: HIGH_ENTROPY_HINTS,
        decision,
        detect:
          detectNativeWindows32Bit,
        registerBuilderStart,
        bootstrap,
        proceed,
        getState() {
          return state;
        }
      }),
      writable: false,
      enumerable: true,
      configurable: false
    }
  );
})();
