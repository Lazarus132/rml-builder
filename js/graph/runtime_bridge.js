(() => {
  "use strict";

  const BRIDGE_VERSION = 3;
  const BRIDGE_PROTOCOL_VERSION = 1;
  const HEALTH_PATH = "/health";
  const SNAPSHOT_PATH = "/runtime/snapshot";
  const EVENTS_PATH = "/runtime/events";
  const PROBE_TIMEOUT_MS = 850;
  const SNAPSHOT_TIMEOUT_MS = 1600;

  function isLiveScannerCatalogSource(
    value
  ) {
    return (
      value === "scanner" ||
      value === "scanner-legacy"
    );
  }

  if (
    window.RMLRuntimeBridge?.version >=
    BRIDGE_VERSION
  ) {
    return;
  }

  const channels = new Map();
  let discoveredBaseUrl = "";
  let discoveryPromise = null;
  let discoveryEnabled =
    isLiveScannerCatalogSource(
      window.RMLResoniteApiCatalog
        ?.catalogSource
    ) ||
    isLiveScannerCatalogSource(
      window.RMLFrooxComponentCatalog
        ?.catalogSource
    );

  function safeLocalStorageValue(key) {
    try {
      return window.localStorage
        ?.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function configuredCatalogUrl() {
    const query =
      new URLSearchParams(
        window.location.search
      ).get("catalogUrl");

    return String(
      query ||
      safeLocalStorageValue(
        "rml-resonite-api-catalog-url"
      ) ||
      ""
    ).trim();
  }

  function normalizeBaseUrl(value) {
    const candidate =
      String(value || "").trim();

    if (!candidate) {
      return "";
    }

    try {
      const url =
        new URL(
          candidate,
          window.location.href
        );

      if (
        url.protocol !== "http:" &&
        url.protocol !== "https:"
      ) {
        return "";
      }

      return `${url.protocol}//${url.host}`;
    } catch {
      return "";
    }
  }

  function scannerBaseCandidates() {
    if (!discoveryEnabled) {
      return [];
    }

    const result = [];
    const seen = new Set();

    const add = value => {
      const base =
        normalizeBaseUrl(value);

      if (
        !base ||
        seen.has(base)
      ) {
        return;
      }

      seen.add(base);
      result.push(base);
    };

    add(
      window.RMLResoniteApiCatalog
        ?.catalogSourceUrl
    );
    add(
      window.RMLFrooxComponentCatalog
        ?.catalogSourceUrl
    );
    add(
      configuredCatalogUrl()
    );

    return result;
  }

  async function fetchJson(
    url,
    timeoutMs
  ) {
    const controller =
      new AbortController();
    const timeout =
      window.setTimeout(
        () => controller.abort(),
        timeoutMs
      );

    try {
      const response =
        await fetch(
          url,
          {
            cache: "no-store",
            mode: "cors",
            signal:
              controller.signal,
            headers: {
              Accept:
                "application/json"
            }
          }
        );

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}`
        );
      }

      const value =
        await response.json();

      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        throw new TypeError(
          "Runtime bridge response is not a JSON object."
        );
      }

      return value;
    } finally {
      window.clearTimeout(
        timeout
      );
    }
  }

  async function probeBaseUrl(baseUrl) {
    const health =
      await fetchJson(
        `${baseUrl}${HEALTH_PATH}`,
        PROBE_TIMEOUT_MS
      );

    if (
      health.ok !== true ||
      Number(
        health.runtimeBridgeVersion
      ) < BRIDGE_PROTOCOL_VERSION ||
      health.runtimeBridgeReady !==
        true
    ) {
      throw new Error(
        "Scanner does not expose the required runtime bridge."
      );
    }

    return baseUrl;
  }

  async function discoverScanner() {
    if (!discoveryEnabled) {
      return "";
    }

    if (discoveredBaseUrl) {
      try {
        return await probeBaseUrl(
          discoveredBaseUrl
        );
      } catch {
        discoveredBaseUrl = "";
      }
    }

    if (discoveryPromise) {
      return discoveryPromise;
    }

    discoveryPromise =
      Promise.all(
        scannerBaseCandidates()
          .map(async baseUrl => {
            try {
              return await probeBaseUrl(
                baseUrl
              );
            } catch {
              return "";
            }
          })
      )
        .then(results => {
          const found =
            results.find(Boolean) ||
            "";

          discoveredBaseUrl =
            found;

          if (!found) {
            discoveryEnabled = false;
          }

          return found;
        })
        .finally(() => {
          discoveryPromise = null;
        });

    return discoveryPromise;
  }

  function normalizeChannel(value) {
    return String(value || "")
      .trim()
      .slice(0, 240);
  }

  function createChannelState(channel) {
    return {
      channel,
      listeners: new Set(),
      values: new Map(),
      connected: false,
      active: false,
      scannerBaseUrl: "",
      sessionId: "",
      lastSeenUtc: "",
      eventSource: null,
      generation: 0,
      starting: false,
      disposed: false
    };
  }

  function stateFor(channel) {
    const normalized =
      normalizeChannel(
        channel
      );

    if (!normalized) {
      return null;
    }

    let state =
      channels.get(
        normalized
      );

    if (!state) {
      state =
        createChannelState(
          normalized
        );
      channels.set(
        normalized,
        state
      );
    }

    return state;
  }

  function publicState(state) {
    return Object.freeze({
      channel:
        state.channel,
      connected:
        state.connected,
      active:
        state.active,
      scannerBaseUrl:
        state.scannerBaseUrl,
      sessionId:
        state.sessionId,
      lastSeenUtc:
        state.lastSeenUtc,
      valueCount:
        state.values.size
    });
  }

  function notify(
    state,
    kind = "state",
    record = null
  ) {
    const detail =
      Object.freeze({
        kind,
        state:
          publicState(state),
        record
      });

    for (
      const listener of
      [...state.listeners]
    ) {
      try {
        listener(detail);
      } catch (error) {
        console.error(
          "RML runtime bridge listener failed.",
          error
        );
      }
    }

    window.dispatchEvent(
      new CustomEvent(
        "rml-runtime-bridge",
        {
          detail
        }
      )
    );
  }

  function setConnectionState(
    state,
    connected,
    baseUrl = state.scannerBaseUrl
  ) {
    const nextConnected =
      Boolean(connected);
    const nextBase =
      nextConnected
        ? String(baseUrl || "")
        : "";

    if (
      state.connected ===
        nextConnected &&
      state.scannerBaseUrl ===
        nextBase
    ) {
      return;
    }

    state.connected =
      nextConnected;
    state.scannerBaseUrl =
      nextBase;

    if (!nextConnected) {
      state.active = false;
    }

    notify(
      state,
      "connection"
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

  async function loadSnapshot(
    state,
    baseUrl,
    generation
  ) {
    const envelope =
      await fetchJson(
        `${baseUrl}${SNAPSHOT_PATH}?channel=${encodeURIComponent(state.channel)}`,
        SNAPSHOT_TIMEOUT_MS
      );

    if (
      state.disposed ||
      generation !==
        state.generation
    ) {
      return;
    }

    applyEnvelope(
      state,
      envelope
    );
    setConnectionState(
      state,
      true,
      baseUrl
    );
  }

  function closeEventSource(
    state
  ) {
    const source =
      state.eventSource;

    state.eventSource =
      null;

    try {
      source?.close();
    } catch {
    }
  }

  function markRuntimeUnavailable(
    state,
    generation
  ) {
    if (
      state.disposed ||
      generation !== state.generation
    ) {
      return;
    }

    const failedBase =
      state.scannerBaseUrl;

    closeEventSource(state);
    setConnectionState(state, false);

    if (
      failedBase &&
      failedBase === discoveredBaseUrl
    ) {
      discoveredBaseUrl = "";
    }

    discoveryEnabled = false;
  }

  function openEventStream(
    state,
    baseUrl,
    generation
  ) {
    if (
      typeof EventSource !==
        "function"
    ) {
      notify(
        state,
        "events-unavailable"
      );
      return false;
    }

    closeEventSource(
      state
    );

    const source =
      new EventSource(
        `${baseUrl}${EVENTS_PATH}?channel=${encodeURIComponent(state.channel)}`
      );

    state.eventSource =
      source;

    source.onopen =
      () => {
        if (
          state.disposed ||
          generation !==
            state.generation
        ) {
          source.close();
          return;
        }

        setConnectionState(
          state,
          true,
          baseUrl
        );
      };

    source.onmessage =
      event => {
        if (
          state.disposed ||
          generation !==
            state.generation
        ) {
          return;
        }

        try {
          applyEnvelope(
            state,
            JSON.parse(
              event.data
            )
          );
        } catch (error) {
          console.warn(
            "RML runtime bridge ignored an invalid SSE event.",
            error
          );
        }
      };

    source.onerror =
      () => {
        if (
          state.disposed ||
          generation !==
            state.generation
        ) {
          return;
        }

        markRuntimeUnavailable(
          state,
          generation
        );
      };

    return true;
  }

  async function startState(
    state
  ) {
    if (
      state.starting ||
      state.disposed ||
      state.listeners.size === 0
    ) {
      return;
    }

    state.starting = true;
    const generation =
      ++state.generation;

    try {
      const baseUrl =
        await discoverScanner();

      if (
        state.disposed ||
        generation !==
          state.generation
      ) {
        return;
      }

      if (!baseUrl) {
        setConnectionState(
          state,
          false
        );
        return;
      }

      state.scannerBaseUrl =
        baseUrl;

      try {
        await loadSnapshot(
          state,
          baseUrl,
          generation
        );
      } catch {
        if (
          generation !==
            state.generation
        ) {
          return;
        }

        markRuntimeUnavailable(
          state,
          generation
        );
        return;
      }

      setConnectionState(
        state,
        true,
        baseUrl
      );
      openEventStream(
        state,
        baseUrl,
        generation
      );
    } catch {
      if (
        generation ===
          state.generation
      ) {
        setConnectionState(
          state,
          false
        );
        discoveredBaseUrl = "";
      }
    } finally {
      if (
        generation ===
          state.generation
      ) {
        state.starting = false;
      }
    }
  }

  function disposeState(
    state
  ) {
    state.disposed = true;
    state.generation += 1;
    closeEventSource(
      state
    );
    state.connected = false;
    state.active = false;
    state.listeners.clear();
    channels.delete(
      state.channel
    );
  }

  function subscribe(
    channel,
    listener
  ) {
    if (
      typeof listener !==
        "function"
    ) {
      throw new TypeError(
        "Runtime bridge listener must be a function."
      );
    }

    const state =
      stateFor(channel);

    if (!state) {
      throw new TypeError(
        "Runtime bridge channel must be non-empty."
      );
    }

    state.disposed = false;
    state.listeners.add(
      listener
    );

    queueMicrotask(() => {
      if (
        state.listeners.has(
          listener
        )
      ) {
        listener(
          Object.freeze({
            kind: "state",
            state:
              publicState(state),
            record: null
          })
        );
      }
    });

    void startState(
      state
    );

    return () => {
      state.listeners.delete(
        listener
      );

      if (
        state.listeners.size === 0
      ) {
        disposeState(
          state
        );
      }
    };
  }

  function getState(channel) {
    const state =
      channels.get(
        normalizeChannel(channel)
      );

    return state
      ? publicState(state)
      : Object.freeze({
          channel:
            normalizeChannel(channel),
          connected: false,
          active: false,
          scannerBaseUrl: "",
          sessionId: "",
          lastSeenUtc: "",
          valueCount: 0
        });
  }

  function getValue(
    channel,
    monitorId
  ) {
    const state =
      channels.get(
        normalizeChannel(channel)
      );

    if (!state) {
      return null;
    }

    return state.values.get(
      String(
        monitorId || ""
      )
    ) || null;
  }

  function refresh(channel) {
    const state =
      stateFor(channel);

    if (!state) {
      return Promise.resolve(
        false
      );
    }

    closeEventSource(
      state
    );
    state.connected = false;
    state.active = false;
    discoveredBaseUrl = "";
    state.starting = false;

    return startState(state)
      .then(() => true)
      .catch(() => false);
  }

  document.addEventListener(
    "rml-catalog:loaded",
    event => {
      const sourceUrl =
        event.detail
          ?.catalogSourceUrl ||
        event.detail
          ?.endpoint ||
        "";

      const base =
        normalizeBaseUrl(
          sourceUrl
        );

      const liveScanner =
        isLiveScannerCatalogSource(
          event.detail?.catalogSource
        );

      if (base && liveScanner) {
        discoveryEnabled = true;
        discoveredBaseUrl =
          base;
      } else {
        return;
      }

      for (
        const state of
        channels.values()
      ) {
        if (
          state.listeners.size > 0 &&
          !state.connected
        ) {
          void startState(
            state
          );
        }
      }
    }
  );

  Object.defineProperty(
    window,
    "RMLRuntimeBridge",
    {
      value: Object.freeze({
        version:
          BRIDGE_VERSION,
        subscribe,
        getState,
        getValue,
        refresh,
        discoverScanner
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
