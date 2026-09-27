(() => {
  "use strict";

  const BRIDGE_VERSION = 14;
  const BRIDGE_PROTOCOL_VERSION = 1;
  const STREAM_OPEN_TIMEOUT_MS = 5000;
  const SNAPSHOT_TIMEOUT_MS = 5000;
  const PROJECT_RESERVED_IDENTIFIERS = new Set(["Class", "Namespace", "Event",
    "String", "Int", "Float", "Double", "Bool", "Object", "Default", "New",
    "Static", "Public", "Private", "Internal", "Void"]);
  if (window.RMLRuntimeBridge?.version >= BRIDGE_VERSION) return;

  const channels = new Map();
  let activeStreamState = null;
  let activeBindingContractState = null;
  let channelRequestSequence = 0;
  let epoch = 0;
  let mode = "cached";
  let phase = "cached";
  let scannerBaseUrl = "";
  let health = null;
  let lastError = "";
  let controller = null;

  function getConnectionState() {
    return Object.freeze({ mode, phase, connected: mode === "live", scannerBaseUrl,
      health, lastError, generation: epoch, retrying: false });
  }

  function renderStatus() {
    const element = document.getElementById("api-catalog-state");
    if (!element) return;
    element.dataset.bridgeMode = mode;
    element.dataset.bridgePhase = phase;
    element.dataset.bridgeError = lastError;
    element.dataset.scannerBaseUrl = scannerBaseUrl;
  }

  function publishConnection() {
    renderStatus();
    publishLiveReadiness();
    window.dispatchEvent(new CustomEvent("rml-scanner-connection", {
      detail: getConnectionState()
    }));
  }

  function normalizeChannel(value) {
    return String(value || "").trim().slice(0, 240);
  }

  function projectIdentifier(value, fallback) {
    const words = String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .split(/[^A-Za-z0-9_]+/)
      .filter(Boolean);
    let result = words
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join("") || fallback;
    if (/^[0-9]/.test(result)) result = `Value${result}`;
    return PROJECT_RESERVED_IDENTIFIERS.has(result) ? `${result}Value` : result;
  }

  function projectChannel(namespaceName, className) {
    const namespaceValue = String(namespaceName || "")
      .split(".")
      .map(part => projectIdentifier(part, "Namespace"))
      .join(".") || "YourModNamespace";
    return `${namespaceValue}.${projectIdentifier(className, "YourMod")}`;
  }

  function createChannelState(channel) {
    return { channel, listeners: new Set(), values: new Map(), connected: false,
      active: false, scannerBaseUrl: "", sessionId: "", lastSeenUtc: "",
      eventSource: null, generation: 0, streamTimer: null, requestController: null,
      refreshPromise: null, phase: mode === "checking" ? phase : "cached",
      lastError, disposed: false, requestOrder: 0, failedEpoch: -1,
      expectedBindings: new Map(), bindingContractRevision: 0,
      snapshotReceived: false, contractRegistered: false };
  }

  function liveReadinessForState(state) {
    const bindings = state
      ? [...state.expectedBindings.values()]
      : [];
    const bound = bindings.filter(binding =>
      binding.bound === true
    );
    const received = state?.snapshotReceived === true
      ? bound.filter(binding =>
          state.values.has(binding.monitorId)
        )
      : [];
    const unbound = bindings
      .filter(binding => binding.bound !== true)
      .map(binding => binding.monitorId);
    const missing = bound
      .filter(binding =>
        !state?.values.has(binding.monitorId)
      )
      .map(binding => binding.monitorId);
    const unexpected = state?.snapshotReceived === true
      ? [...state.values.keys()].filter(
          monitorId =>
            !state.expectedBindings.has(
              monitorId
            )
        )
      : [];
    const contractRegistered = Boolean(
      state &&
      state.contractRegistered === true &&
      state === activeBindingContractState
    );
    const selected = Boolean(
      contractRegistered &&
      (
        bindings.length === 0 ||
        state === activeStreamState
      )
    );
    const ready = Boolean(
      mode === "live" &&
      selected &&
      (
        bindings.length === 0 ||
        (
          state.connected === true &&
          state.snapshotReceived === true &&
          String(state.sessionId || "").trim() &&
          bound.length === bindings.length &&
          unexpected.length === 0
        )
      )
    );
    let reason = "ready";
    if (!contractRegistered) reason = "contract-unregistered";
    else if (mode !== "live") reason = "scanner-cached";
    else if (!selected) reason = "channel-not-selected";
    else if (bindings.length > 0) {
      if (!state.connected) reason = state.phase || "channel-disconnected";
      else if (!state.snapshotReceived) reason = "snapshot-pending";
      else if (!String(state.sessionId || "").trim()) reason = "session-missing";
      else if (unbound.length > 0) reason = "graph-bindings-incomplete";
      else if (unexpected.length > 0) reason = "unexpected-runtime-values";
    }
    return Object.freeze({
      ready,
      reason,
      channel: String(state?.channel || ""),
      scannerMode: mode,
      scannerBaseUrl,
      contractRegistered,
      selected,
      connected: state?.connected === true,
      active: state?.active === true,
      snapshotReceived:
        state?.snapshotReceived === true,
      sessionId: String(state?.sessionId || ""),
      expectedCount: bindings.length,
      boundCount: bound.length,
      receivedCount: received.length,
      missingCount: missing.length,
      unboundCount: unbound.length,
      unexpectedCount: unexpected.length,
      missingMonitorIds: Object.freeze(
        missing.slice(0, 64)
      ),
      unboundMonitorIds: Object.freeze(
        unbound.slice(0, 64)
      ),
      unexpectedMonitorIds: Object.freeze(
        unexpected.slice(0, 64)
      ),
      truncated:
        missing.length > 64 ||
        unbound.length > 64 ||
        unexpected.length > 64,
      contractRevision:
        Number(state?.bindingContractRevision) || 0
    });
  }

  function getLiveReadiness(channel = "") {
    const key = normalizeChannel(channel);
    const state = key
      ? channels.get(key) || null
      : activeBindingContractState;
    return liveReadinessForState(state);
  }

  function publishLiveReadiness(
    state = activeBindingContractState
  ) {
    const readiness = liveReadinessForState(
      state === activeBindingContractState
        ? state
        : activeBindingContractState
    );
    const diagnostic = {
      ...readiness,
      missingMonitorIds:
        [...readiness.missingMonitorIds],
      unboundMonitorIds:
        [...readiness.unboundMonitorIds],
      unexpectedMonitorIds:
        [...readiness.unexpectedMonitorIds]
    };
    const root = document.documentElement;
    if (root?.dataset) {
      root.dataset.rmlRuntimeLiveReadiness =
        JSON.stringify(diagnostic);
      root.dataset.rmlRuntimeExpectedBindings =
        String(readiness.expectedCount);
      root.dataset.rmlRuntimeBoundBindings =
        String(readiness.boundCount);
      root.dataset.rmlRuntimeReceivingBindings =
        String(readiness.receivedCount);
      root.dataset.rmlRuntimeUnexpectedBindings =
        String(readiness.unexpectedCount);
      root.dataset.rmlRuntimeSnapshotReceived =
        String(readiness.snapshotReceived);
      root.dataset.rmlRuntimeContractRegistered =
        String(readiness.contractRegistered);
    }
    const element = document.getElementById(
      "api-catalog-state"
    );
    if (element?.dataset) {
      element.dataset.runtimeReady =
        String(readiness.ready);
      element.dataset.runtimeReadinessReason =
        readiness.reason;
      element.dataset.runtimeChannel =
        readiness.channel;
      element.dataset.runtimeExpectedBindings =
        String(readiness.expectedCount);
      element.dataset.runtimeBoundBindings =
        String(readiness.boundCount);
      element.dataset.runtimeReceivingBindings =
        String(readiness.receivedCount);
      element.dataset.runtimeUnexpectedBindings =
        String(readiness.unexpectedCount);
      element.dataset.runtimeSnapshotReceived =
        String(readiness.snapshotReceived);
      element.dataset.runtimeContractRegistered =
        String(readiness.contractRegistered);
    }
    window.dispatchEvent(new CustomEvent(
      "rml-runtime-readiness",
      { detail: readiness }
    ));
    return readiness;
  }

  function publicState(state) {
    const readiness = liveReadinessForState(state);
    return Object.freeze({ channel: state.channel,
      connected: mode === "live" && state.connected,
      active: mode === "live" && state.connected && state.active,
      scannerBaseUrl: state.scannerBaseUrl, sessionId: state.sessionId,
      lastSeenUtc: state.lastSeenUtc, valueCount: state.values.size,
      phase: state.phase, lastError: state.lastError, retrying: false,
      snapshotReceived: state.snapshotReceived === true,
      liveReady: readiness.ready,
      expectedBindingCount: readiness.expectedCount,
      boundBindingCount: readiness.boundCount,
      receivingBindingCount: readiness.receivedCount });
  }

  function notify(state, kind = "state", record = null) {
    const detail = Object.freeze({ kind, state: publicState(state), record });
    for (const listener of [...state.listeners]) {
      try { listener(detail); }
      catch (error) { console.error("RML runtime bridge listener failed.", error); }
    }
    window.dispatchEvent(new CustomEvent("rml-runtime-bridge", { detail }));
    publishLiveReadiness(state);
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
    state.snapshotReceived = false;
    state.values.clear();
    state.sessionId = "";
    state.lastSeenUtc = "";
    state.scannerBaseUrl = "";
    state.phase = "cached";
    state.lastError = lastError;
  }

  function failChannel(state, reason) {
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
    state.snapshotReceived = false;
    state.values.clear();
    state.sessionId = "";
    state.lastSeenUtc = "";
    state.scannerBaseUrl = scannerBaseUrl;
    state.phase = "unavailable";
    state.lastError = String(
      reason?.message || reason || ""
    );
    state.failedEpoch = epoch;
    if (!state.disposed) {
      notify(state, "connection");
    }
  }

  function reconcileActiveStream(preferredState = null) {
    const next = preferredState && !preferredState.disposed && preferredState.listeners.size
      ? preferredState
      : [...channels.values()]
          .filter(state => !state.disposed && state.listeners.size)
          .sort((left, right) => right.requestOrder - left.requestOrder)[0] || null;
    if (activeStreamState === next) {
      if (next && mode === "live") openChannel(next);
      return;
    }
    const previous = activeStreamState;
    activeStreamState = next;
    if (previous) {
      stopChannel(previous);
      if (!previous.disposed) notify(previous, "connection");
    }
    if (next && mode === "live") openChannel(next);
  }

  function disconnect(reason = "", options = {}) {
    const silent = options?.silent === true;
    ++epoch;
    mode = "cached";
    phase = "cached";
    lastError = String(reason?.message || reason || "");
    scannerBaseUrl = "";
    health = null;
    controller?.abort();
    controller = null;

    const affected = [...channels.values()];
    for (const state of affected) stopChannel(state);
    if (!silent) {
      publishConnection();
    } else {
      const element = document.getElementById("api-catalog-state");
      if (element) {
        element.dataset.bridgeMode = mode;
        element.dataset.bridgePhase = phase;
        element.dataset.bridgeError = lastError;
        element.dataset.scannerBaseUrl = scannerBaseUrl;
      }
    }
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
      state === activeStreamState &&
      state.eventSource === source && state.generation === generation;
  }

  function openChannel(state) {
    if (mode !== "live" || state !== activeStreamState || state.disposed ||
        !state.listeners.size || state.eventSource || state.failedEpoch === epoch) return;
    const token = epoch;
    const generation = ++state.generation;
    state.snapshotReceived = false;
    state.values.clear();
    state.sessionId = "";
    state.lastSeenUtc = "";
    state.phase = "connecting";
    state.lastError = "";
    state.scannerBaseUrl = scannerBaseUrl;
    let source;
    try {
      source = new EventSource(`${scannerBaseUrl}/runtime/events?channel=${encodeURIComponent(state.channel)}`);
    } catch (error) { failChannel(state, error); return; }
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
      } catch (error) { failChannel(state, error); }
    };
    source.onerror = () => {
      if (!channelIsCurrent(state, source, token, generation)) return;
      failChannel(state, "Runtime value stream interrupted.");
    };
    state.streamTimer = window.setTimeout(() => {
      if (channelIsCurrent(state, source, token, generation) && !state.connected) {
        failChannel(state, "Runtime value stream did not open.");
      }
    }, STREAM_OPEN_TIMEOUT_MS);
    notify(state, "connection");
  }

  function adoptScannerSession(session) {
    const port = Number(session?.port);
    const selectedHealth = session?.health;
    const expectedBase = `http://127.0.0.1:${port}`;
    if (
      !Number.isInteger(port) ||
      port < 42719 ||
      port > 42725 ||
      session?.scannerBaseUrl !== expectedBase ||
      selectedHealth?.ok !== true
    ) {
      console.error(
        "[RML BUILDER INTERNAL FAILURE] The runtime bridge received an invalid health-selected scanner session.",
        session
      );
      return false;
    }
    if (
      selectedHealth.runtimeBridgeReady !== true ||
      Number(
        selectedHealth.runtimeBridgeVersion
      ) !== BRIDGE_PROTOCOL_VERSION
    ) {
      disconnect(
        "The selected scanner exposes a catalog but no compatible Live runtime bridge.",
        { silent: true }
      );
      return false;
    }
    ++epoch;
    controller?.abort();
    controller = new AbortController();
    scannerBaseUrl = expectedBase;
    health = Object.freeze({ ...selectedHealth });
    mode = "live";
    phase = "connected";
    lastError = "";
    for (const state of channels.values()) stopChannel(state);
    publishConnection();
    reconcileActiveStream();
    return true;
  }

  function connect(options = {}) {
    if (mode === "live") return Promise.resolve(true);
    const selected =
      options?.session ||
      window.RMLScannerHealthSession;
    if (!selected) {
      disconnect(
        "Use the Resonite API button or import a project before opening a Live runtime stream."
      );
      return Promise.resolve(false);
    }
    return Promise.resolve(
      adoptScannerSession(selected)
    );
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
    state.snapshotReceived = true;
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
    const establishesBaseline = Boolean(
      sessionId &&
      (
        envelope.reset === true ||
        (
          state.sessionId &&
          state.sessionId !== sessionId
        )
      )
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
      state.snapshotReceived = false;
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

    if (establishesBaseline) {
      state.snapshotReceived = true;
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

  function normalizedExpectedBinding(value) {
    const monitorId = String(
      value?.monitorId || value?.nodeId || ""
    ).trim();
    if (!monitorId) return null;
    return Object.freeze({
      monitorId,
      nodeId: String(
        value?.nodeId || monitorId
      ).trim(),
      inputPort: String(
        value?.inputPort || ""
      ).trim(),
      sourceNodeId: String(
        value?.sourceNodeId || ""
      ).trim(),
      sourcePort: String(
        value?.sourcePort || ""
      ).trim(),
      bound: value?.bound === true
    });
  }

  function setExpectedBindings(channel, values) {
    const key = normalizeChannel(channel);
    if (!key) {
      throw new TypeError(
        "Runtime binding channel must be a non-empty project channel."
      );
    }
    let state = channels.get(key);
    if (!state || state.disposed) {
      state = createChannelState(key);
      channels.set(key, state);
    }
    state.contractRegistered = true;
    activeBindingContractState = state;
    const next = new Map();
    for (const value of
      Array.isArray(values) ? values : []) {
      const binding = normalizedExpectedBinding(
        value
      );
      if (binding) {
        next.set(binding.monitorId, binding);
      }
    }
    const previousSignature = JSON.stringify(
      [...state.expectedBindings.values()]
    );
    const nextSignature = JSON.stringify(
      [...next.values()]
    );
    if (previousSignature === nextSignature) {
      publishLiveReadiness(state);
      return getLiveReadiness(key);
    }
    state.expectedBindings = next;
    state.bindingContractRevision += 1;
    state.values.clear();
    state.snapshotReceived = false;
    state.sessionId = "";
    state.lastSeenUtc = "";
    notify(state, "bindings");
    if (
      mode === "live" &&
      state === activeStreamState &&
      state.connected === true &&
      state.listeners.size > 0
    ) {
      queueMicrotask(() => {
        void refresh(key);
      });
    }
    return getLiveReadiness(key);
  }

  function clearExpectedBindings(channel) {
    const key = normalizeChannel(channel);
    const state = channels.get(key);
    if (!state) {
      publishLiveReadiness();
      return getLiveReadiness(key);
    }
    state.expectedBindings.clear();
    state.contractRegistered = false;
    if (activeBindingContractState === state) {
      activeBindingContractState = null;
    }
    state.bindingContractRevision += 1;
    notify(state, "bindings");
    if (!state.listeners.size) {
      state.disposed = true;
      if (channels.get(key) === state) {
        channels.delete(key);
      }
    }
    return getLiveReadiness(key);
  }

  function subscribe(channel, listener) {
    if (typeof listener !== "function") throw new TypeError("Runtime bridge listener must be a function.");
    const key = normalizeChannel(channel);
    if (!key) throw new TypeError("Runtime bridge channel must be a non-empty project channel.");
    let state = channels.get(key);
    if (!state) { state = createChannelState(key); channels.set(key, state); }
    const firstListener = state.listeners.size === 0;
    state.listeners.add(listener);
    if (firstListener) {
      state.requestOrder = ++channelRequestSequence;
      reconcileActiveStream(state);
    }
    queueMicrotask(() => {
      if (!state.disposed && state.listeners.has(listener)) {
        listener(Object.freeze({ kind: "state", state: publicState(state), record: null }));
      }
    });

    if (mode === "live" && state === activeStreamState) queueMicrotask(() => openChannel(state));
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      state.listeners.delete(listener);
      if (!state.listeners.size) {
        stopChannel(state);
        if (activeStreamState === state) {
          activeStreamState = null;
          reconcileActiveStream();
        }
        if (state.contractRegistered) {
          state.disposed = false;
          publishLiveReadiness(state);
        } else {
          state.disposed = true;
          if (channels.get(key) === state) {
            channels.delete(key);
          }
        }
      }
    };
  }

  function getState(channel) {
    const key = normalizeChannel(channel);
    return publicState(channels.get(key) || createChannelState(key));
  }

  function getValue(channel, monitorId) {
    const state = channels.get(normalizeChannel(channel));
    const key = String(monitorId || "");

    if (
      !state ||
      mode !== "live" ||
      state.connected !== true ||
      (
        state.contractRegistered === true &&
        !state.expectedBindings.has(key)
      )
    ) {
      return null;
    }
    return state.values.get(key) || null;
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
        if (channelIsCurrent(state, source, token, generation)) failChannel(state, error);
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

  function refreshHealth(options = {}) {
    return Promise.resolve(
      mode === "live" &&
      Boolean(health)
    );
  }

  document.addEventListener("rml-catalog:loaded", renderStatus);
  document.addEventListener(
    "rml-scanner:selected",
    event => {
      adoptScannerSession(event?.detail);
    }
  );
  document.addEventListener(
    "rml-scanner:unavailable",
    () => disconnect("", { silent: true })
  );

  window.addEventListener("offline", () => { if (mode !== "cached") disconnect("The browser is offline. Click Cached to reconnect."); });
  window.addEventListener("pagehide", () => { if (mode !== "cached") disconnect(); });

  function debugSnapshot(channel) {
    const state = channels.get(normalizeChannel(channel));
    return state ? [...state.values.values()].map(record => ({ ...record })) : [];
  }

  Object.defineProperty(window, "RMLRuntimeBridge", {
    value: Object.freeze({ version: BRIDGE_VERSION, subscribe, getState, getValue, refresh, refreshHealth, debugSnapshot,
      setExpectedBindings, clearExpectedBindings, getLiveReadiness,
      connect, disconnect, toggle, adoptScannerSession, renderStatus, getConnectionState, projectChannel,
      getSessionSignal: () => controller?.signal || null,
      discoverScanner: () => Promise.resolve(mode === "live" ? scannerBaseUrl : "") }),
    writable: false, enumerable: true, configurable: true
  });
  if (window.RMLScannerHealthSession) {
    adoptScannerSession(
      window.RMLScannerHealthSession
    );
  }
  renderStatus();
  publishLiveReadiness();
})();
