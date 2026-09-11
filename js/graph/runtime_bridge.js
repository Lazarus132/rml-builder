(() => {
  "use strict";
  // Runtime Graph live-runtime bridge.

  const BRIDGE_VERSION = 6;
  const BRIDGE_PROTOCOL_VERSION = 1;
  const PROBE_TIMEOUT_MS = 3000;
  const STREAM_OPEN_TIMEOUT_MS = 5000;
  const SNAPSHOT_TIMEOUT_MS = 5000;
  const PRESENCE_CHANNEL = "__rml_builder_scanner_connection__";
  if (window.RMLRuntimeBridge?.version >= BRIDGE_VERSION) return;

  const channels = new Map();
  let epoch = 0;
  let mode = "cached";
  let phase = "cached";
  let scannerBaseUrl = "";
  let health = null;
  let lastError = "";
  let controller = null;
  let presenceSource = null;
  let presenceTimer = null;
  let settlePresence = null;
  let connectPromise = null;

  function safeLocalStorageValue(key) {
    try { return window.localStorage?.getItem(key) || ""; }
    catch { return ""; }
  }

  function normalizeBaseUrl(value) {
    try {
      if (!String(value || "").trim()) return "";
      const url = new URL(String(value).trim(), window.location.href);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
      return url.origin;
    } catch { return ""; }
  }

  function scannerBaseCandidates() {
    const configured = new URLSearchParams(window.location.search).get("catalogUrl") ||
      safeLocalStorageValue("rml-resonite-api-catalog-url");
    const preferred = configured ? normalizeBaseUrl(configured)
      : normalizeBaseUrl(safeLocalStorageValue("rml-resonite-api-last-scanner-url")) ||
        normalizeBaseUrl(window.RMLResoniteApiCatalog?.catalogSourceUrl) ||
        normalizeBaseUrl(window.RMLFrooxComponentCatalog?.catalogSourceUrl) ||
        "http://127.0.0.1:42719";
    if (!preferred) return [];
    const candidates = new Set([preferred]);
    const url = new URL(preferred);


    const first = 42719;
    const last = 42729;
    const port = Number(url.port);
    if (port >= first && port <= last) {
      for (let candidate = first; candidate <= last; candidate += 1) {
        url.port = String(candidate);
        candidates.add(url.origin);
      }
    }
    return [...candidates];
  }

  function getConnectionState() {
    return Object.freeze({ mode, phase, connected: mode === "live", scannerBaseUrl,
      health, lastError, generation: epoch, retrying: false });
  }


  function renderStatus() {
    const element = document.getElementById("api-catalog-state");
    if (!element) return;
    const catalog = window.RMLResoniteApiCatalog || window.RMLFrooxComponentCatalog;
    const version = String(catalog?.engineVersion || "");
    const prefix = version ? `Resonite API ${version}` : "Resonite API";
    const checking = mode === "checking";
    const live = mode === "live";
    element.textContent = `${prefix} · ${checking ? "checking…" : live ? "Live" : "Cached"}`;
    element.dataset.source = checking ? "updating" : live ? "scanner" : "cache";
    element.setAttribute("aria-pressed", String(live));
    element.setAttribute("aria-busy", String(checking));
    const action = checking ? "Click to cancel the connection attempt."
      : live ? "Click to disconnect and use Cached mode."
      : "Click to find the scanner once and connect. Each candidate port is checked at most once; no automatic retries.";
    const report = window.RMLApiNodeFactoryReport;
    let statistics = "";
    if (catalog && report && String(report.engineVersion || "") === version &&
        Number.isFinite(Number(report.totalGeneratedNodes))) {
      const types = Array.isArray(catalog.types) ? catalog.types : [];
      const count = value => Math.max(0, Number(value) || 0).toLocaleString("de-DE");
      statistics = `${count(types.filter(type => type?.isAttachableComponent === true).length)} attachable components · ${count(types.length)} API types · ${count(report.totalGeneratedNodes)} generated nodes`;
    }
    element.title = [statistics, action, lastError].filter(Boolean).join(" · ");
    element.setAttribute("aria-label", `${element.textContent}. ${element.title}`);
  }

  function publishConnection() {
    renderStatus();
    window.dispatchEvent(new CustomEvent("rml-scanner-connection", {
      detail: getConnectionState()
    }));
  }

  function normalizeChannel(value) {
    return String(value || "").trim().slice(0, 240);
  }

  function createChannelState(channel) {
    return { channel, listeners: new Set(), values: new Map(), connected: false,
      active: false, scannerBaseUrl: "", sessionId: "", lastSeenUtc: "",
      eventSource: null, generation: 0, streamTimer: null, requestController: null,
      refreshPromise: null, phase: mode === "checking" ? phase : "cached",
      lastError, disposed: false };
  }

  function publicState(state) {
    return Object.freeze({ channel: state.channel,
      connected: mode === "live" && state.connected,
      active: mode === "live" && state.connected && state.active,
      scannerBaseUrl: state.scannerBaseUrl, sessionId: state.sessionId,
      lastSeenUtc: state.lastSeenUtc, valueCount: state.values.size,
      phase: state.phase, lastError: state.lastError, retrying: false });
  }

  function notify(state, kind = "state", record = null) {
    const detail = Object.freeze({ kind, state: publicState(state), record });
    for (const listener of [...state.listeners]) {
      try { listener(detail); }
      catch (error) { console.error("RML runtime bridge listener failed.", error); }
    }
    window.dispatchEvent(new CustomEvent("rml-runtime-bridge", { detail }));
  }

  function clearStreamTimer(state) {
    if (state.streamTimer !== null) window.clearTimeout(state.streamTimer);
    state.streamTimer = null;
  }

  function closeSource(source) {
    if (!source) return;
    source.onopen = source.onmessage = source.onerror = null;
    source.close();
  }

  function stopChannel(state) {
    state.generation += 1;
    clearStreamTimer(state);
    const source = state.eventSource;
    state.eventSource = null;
    closeSource(source);
    state.requestController?.abort();
    state.requestController = null;
    state.refreshPromise = null;
    state.connected = false;
    state.active = false;
    state.scannerBaseUrl = "";
    state.phase = "cached";
    state.lastError = lastError;
  }

  function disconnect(reason = "") {
    ++epoch;
    mode = "cached";
    phase = "cached";
    lastError = String(reason?.message || reason || "");
    scannerBaseUrl = "";
    health = null;
    controller?.abort();
    controller = null;
    if (presenceTimer !== null) window.clearTimeout(presenceTimer);
    presenceTimer = null;
    const oldPresence = presenceSource;
    presenceSource = null;
    closeSource(oldPresence);
    const settle = settlePresence;
    settlePresence = null;
    settle?.(false);
    connectPromise = null;

    const affected = [...channels.values()];
    for (const state of affected) stopChannel(state);
    publishConnection();
    for (const state of affected) if (!state.disposed) notify(state, "connection");
    return false;
  }

  function isCurrent(token) {
    return token === epoch && mode !== "cached" && !controller?.signal.aborted;
  }

  async function fetchJson(url, timeoutMs, signal) {
    const request = new AbortController();
    let timedOut = false;
    const abort = () => request.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    const timer = window.setTimeout(() => { timedOut = true; request.abort(); }, timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", mode: "cors",
        credentials: "omit", redirect: "error", signal: request.signal,
        headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Scanner request failed: ${response.status} ${response.statusText}`);
      const value = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Scanner response is not a JSON object.");
      }
      return value;
    } catch (error) {
      if (timedOut) throw new Error("Scanner request timed out. Click Cached to try again.");
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
      window.clearTimeout(timer);
    }
  }

  function channelIsCurrent(state, source, token, generation) {
    return isCurrent(token) && mode === "live" && !state.disposed &&
      state.eventSource === source && state.generation === generation;
  }

  function openChannel(state) {
    if (mode !== "live" || state.disposed || !state.listeners.size || state.eventSource) return;
    const token = epoch;
    const generation = ++state.generation;
    state.phase = "connecting";
    state.lastError = "";
    state.scannerBaseUrl = scannerBaseUrl;
    let source;
    try {
      source = new EventSource(`${scannerBaseUrl}/runtime/events?channel=${encodeURIComponent(state.channel)}`);
    } catch (error) { disconnect(error); return; }
    state.eventSource = source;
    source.onopen = () => {
      if (!channelIsCurrent(state, source, token, generation)) return;
      clearStreamTimer(state);
      state.connected = true;
      state.phase = "connected";
      notify(state, "connection");
    };
    source.onmessage = event => {
      if (!channelIsCurrent(state, source, token, generation)) return;
      try {
        const envelope = JSON.parse(event.data);
        if (!validEnvelope(envelope, state.channel) ||
            (envelope.kind === "snapshot" && !Array.isArray(envelope.values))) {
          throw new Error("Scanner returned an invalid live event.");
        }
        applyEnvelope(state, envelope);
      } catch (error) { disconnect(error); }
    };
    source.onerror = () => {
      if (!channelIsCurrent(state, source, token, generation)) return;

      disconnect("Scanner stream interrupted. Click Cached to reconnect.");
    };
    state.streamTimer = window.setTimeout(() => {
      if (channelIsCurrent(state, source, token, generation) && !state.connected) {
        disconnect("Scanner stream did not open. Click Cached to reconnect.");
      }
    }, STREAM_OPEN_TIMEOUT_MS);
    notify(state, "connection");
  }

  function openPresence(baseUrl, token) {
    return new Promise(resolve => {
      if (!isCurrent(token)) { resolve(false); return; }
      settlePresence = resolve;
      const source = new EventSource(`${baseUrl}/runtime/events?channel=${encodeURIComponent(PRESENCE_CHANNEL)}`);
      presenceSource = source;
      const current = () => isCurrent(token) && presenceSource === source;
      source.onopen = () => {
        if (!current()) return;
        if (presenceTimer !== null) window.clearTimeout(presenceTimer);
        presenceTimer = null;
        mode = "live";
        phase = "connected";
        const settle = settlePresence;
        settlePresence = null;
        publishConnection();
        for (const state of [...channels.values()]) {
          if (!current()) break;
          openChannel(state);
        }
        settle?.(current());
      };
      source.onmessage = event => {
        if (!current()) return;
        try {
          const envelope = JSON.parse(event.data);
          if (!validEnvelope(envelope, PRESENCE_CHANNEL) ||
              (envelope.kind === "snapshot" && !Array.isArray(envelope.values))) {
            throw new Error("Scanner returned an invalid connection event.");
          }
        } catch (error) { disconnect(error); }
      };
      source.onerror = () => {
        if (current()) disconnect("Scanner stream interrupted. Click Cached to reconnect.");
      };
      presenceTimer = window.setTimeout(() => {
        if (current() && mode !== "live") disconnect("Scanner stream did not open. Click Cached to reconnect.");
      }, STREAM_OPEN_TIMEOUT_MS);
    });
  }

  function connect() {
    if (connectPromise) return connectPromise;
    if (mode === "live") return Promise.resolve(true);
    const token = ++epoch;
    controller = new AbortController();
    mode = "checking";
    phase = "checking";
    lastError = "";
    health = null;
    const candidates = scannerBaseCandidates();
    const sessionSignal = controller.signal;
    for (const state of channels.values()) { state.phase = "checking"; state.lastError = ""; }

    const pending = Promise.resolve().then(async () => {
      if (!isCurrent(token)) return false;
      try {
        if (!candidates.length) throw new Error("The configured scanner URL is not a valid HTTP(S) endpoint.");
        if (typeof EventSource !== "function") throw new Error("This browser does not provide EventSource.");
        let base = "";
        let result = null;
        let probeError = "";
        for (const candidate of candidates) {
          if (!isCurrent(token)) return false;
          try {
            const response = await fetchJson(`${candidate}/health`, PROBE_TIMEOUT_MS, sessionSignal);
            if (!isCurrent(token)) return false;
            if (response.ok !== true || response.runtimeBridgeReady !== true ||
                Number(response.runtimeBridgeVersion) !== BRIDGE_PROTOCOL_VERSION) {
              throw new Error("Scanner does not expose the required runtime bridge protocol.");
            }
            base = candidate;
            result = response;
            break;
          } catch (error) {
            if (!isCurrent(token)) return false;
            probeError = `${candidate}: ${error?.message || String(error)}`;
          }
        }
        if (!base) throw new Error(`No compatible scanner found after checking ${candidates.length} endpoint(s). ${probeError}`);
        health = Object.freeze({ ...result });
        scannerBaseUrl = base;
        phase = "connecting";
        try { window.localStorage?.setItem("rml-resonite-api-last-scanner-url", `${base}/resonite_api_catalog.json`); } catch {}
        publishConnection();
        if (!isCurrent(token)) return false;
        return await openPresence(base, token);
      } catch (error) {
        if (isCurrent(token)) disconnect(error?.message || "Scanner health check failed.");
        return false;
      } finally {
        if (token === epoch) connectPromise = null;
      }
    });
    connectPromise = pending;
    publishConnection();
    for (const state of [...channels.values()]) if (!state.disposed) notify(state, "connection");
    return pending;
  }

  function normalizeRecord(
    value
  ) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }

    const monitorId =
      String(
        value.monitorId || ""
      ).trim();

    if (!monitorId) {
      return null;
    }

    return Object.freeze({
      monitorId,
      label:
        String(
          value.label || monitorId
        ),
      graphType:
        String(
          value.graphType || ""
        ),
      runtimeType:
        String(
          value.runtimeType || ""
        ),
      valueKind:
        String(
          value.valueKind || ""
        ),
      display:
        String(
          value.display ?? ""
        ),
      value:
        value.value,
      isNull:
        value.isNull === true,
      sequence:
        Number(
          value.sequence
        ) || 0,
      updatedAtUtc:
        String(
          value.updatedAtUtc || ""
        )
    });
  }

  function applySnapshot(
    state,
    envelope
  ) {
    const sessionId =
      String(
        envelope.sessionId || ""
      );

    if (
      state.sessionId &&
      sessionId &&
      state.sessionId !== sessionId
    ) {
      state.values.clear();
    }

    state.sessionId =
      sessionId;
    state.values.clear();

    for (
      const raw of
      Array.isArray(
        envelope.values
      )
        ? envelope.values
        : []
    ) {
      const record =
        normalizeRecord(raw);

      if (record) {
        state.values.set(
          record.monitorId,
          record
        );
      }
    }

    state.active =
      envelope.active === true;
    state.lastSeenUtc =
      String(
        envelope.lastSeenUtc || ""
      );
    notify(
      state,
      "snapshot"
    );
  }

  function applyDisplay(
    state,
    envelope
  ) {
    const sessionId =
      String(
        envelope.sessionId || ""
      );

    if (
      envelope.reset === true ||
      (
        state.sessionId &&
        sessionId &&
        state.sessionId !==
          sessionId
      )
    ) {
      state.values.clear();
    }

    state.sessionId =
      sessionId ||
      state.sessionId;

    const record =
      normalizeRecord(
        envelope.value
      );

    if (record) {
      state.values.set(
        record.monitorId,
        record
      );
    }

    state.active = true;
    state.lastSeenUtc =
      String(
        envelope.lastSeenUtc ||
        record?.updatedAtUtc ||
        new Date()
          .toISOString()
      );
    notify(
      state,
      "display",
      record
    );
  }

  function applyEnvelope(
    state,
    envelope
  ) {
    if (
      !envelope ||
      typeof envelope !==
        "object" ||
      Array.isArray(envelope)
    ) {
      return;
    }

    const envelopeChannel =
      String(
        envelope.channel || ""
      );

    if (
      envelopeChannel &&
      envelopeChannel !==
        state.channel
    ) {
      return;
    }

    switch (
      String(
        envelope.kind || ""
      )
    ) {
      case "snapshot":
        applySnapshot(
          state,
          envelope
        );
        break;

      case "display":
        applyDisplay(
          state,
          envelope
        );
        break;

      default:
        break;
    }
  }

  function validEnvelope(envelope, channel, kind = null) {
    return envelope && typeof envelope === "object" && !Array.isArray(envelope) &&
      Number(envelope.bridgeVersion) === BRIDGE_PROTOCOL_VERSION &&
      envelope.channel === channel &&
      (kind ? envelope.kind === kind : ["snapshot", "display"].includes(envelope.kind));
  }


  function subscribe(channel, listener) {
    if (typeof listener !== "function") throw new TypeError("Runtime bridge listener must be a function.");
    const key = normalizeChannel(channel);
    if (!key || key === PRESENCE_CHANNEL) throw new TypeError("Runtime bridge channel must be a non-empty project channel.");
    let state = channels.get(key);
    if (!state) { state = createChannelState(key); channels.set(key, state); }
    state.listeners.add(listener);
    queueMicrotask(() => {
      if (!state.disposed && state.listeners.has(listener)) {
        listener(Object.freeze({ kind: "state", state: publicState(state), record: null }));
      }
    });

    if (mode === "live") queueMicrotask(() => openChannel(state));
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      state.listeners.delete(listener);
      if (!state.listeners.size) {
        state.disposed = true;
        stopChannel(state);
        if (channels.get(key) === state) channels.delete(key);
      }
    };
  }

  function getState(channel) {
    const key = normalizeChannel(channel);
    return publicState(channels.get(key) || createChannelState(key));
  }

  function getValue(channel, monitorId) {
    const state = channels.get(normalizeChannel(channel));

    if (mode !== "live" || !state?.connected || !state.active) return null;
    return state.values.get(String(monitorId || "")) || null;
  }

  function refresh(channel) {
    const state = channels.get(normalizeChannel(channel));
    if (mode !== "live" || !state?.connected || state.disposed || !state.listeners.size) return Promise.resolve(false);
    if (state.refreshPromise) return state.refreshPromise;
    const token = epoch;
    const generation = state.generation;
    const source = state.eventSource;
    const request = new AbortController();
    state.requestController = request;
    const pending = Promise.resolve().then(async () => {
      try {
        if (!channelIsCurrent(state, source, token, generation)) return false;
        const value = await fetchJson(`${scannerBaseUrl}/runtime/snapshot?channel=${encodeURIComponent(state.channel)}`,
          SNAPSHOT_TIMEOUT_MS, request.signal);
        if (!channelIsCurrent(state, source, token, generation)) return false;
        if (!validEnvelope(value, state.channel, "snapshot") || !Array.isArray(value.values)) {
          throw new Error("Scanner returned an invalid runtime snapshot.");
        }
        applyEnvelope(state, value);
        return channelIsCurrent(state, source, token, generation);
      } catch (error) {
        if (channelIsCurrent(state, source, token, generation)) disconnect(error);
        return false;
      } finally {
        if (state.requestController === request) { state.requestController = null; state.refreshPromise = null; }
      }
    });
    state.refreshPromise = pending;
    return pending;
  }

  function toggle() {
    return mode === "cached" ? connect() : Promise.resolve(disconnect());
  }

  document.addEventListener("rml-catalog:loaded", renderStatus);


  window.addEventListener("offline", () => { if (mode !== "cached") disconnect("The browser is offline. Click Cached to reconnect."); });
  window.addEventListener("pagehide", () => { if (mode !== "cached") disconnect(); });

  Object.defineProperty(window, "RMLRuntimeBridge", {
    value: Object.freeze({ version: BRIDGE_VERSION, subscribe, getState, getValue, refresh,
      connect, disconnect, toggle, renderStatus, getConnectionState,
      getSessionSignal: () => controller?.signal || null,
      discoverScanner: () => Promise.resolve(mode === "live" ? scannerBaseUrl : "") }),
    writable: false, enumerable: true, configurable: true
  });
  renderStatus();
})();
