"use strict";

const GRAPH_CODEGEN_WORKER_MODULE_ID =
  "1.25.00-canonical-type-reconciliation-startup-recovery";

self.window = self;

const __rmlWorkerI18nState = { fallback: Object.create(null), hydrated: false, error: null };
function __rmlWorkerI18nLookup(value) {
  const raw = String(value ?? "");
  return __rmlWorkerI18nState.fallback[raw] ?? raw;
}
function __rmlWorkerI18nFormat(value, params = {}) {
  return String(__rmlWorkerI18nLookup(value)).replace(/\{([A-Za-z0-9_.-]+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match
  );
}
self.RMLI18n = Object.freeze({
  version: GRAPH_CODEGEN_WORKER_MODULE_ID,
  t: __rmlWorkerI18nLookup,
  format: __rmlWorkerI18nFormat,
  get language() { return "en"; },
  setLanguage: async () => "en",
  translate: () => {}
});
async function __rmlHydrateWorkerI18n() {
  if (__rmlWorkerI18nState.hydrated) return;
  try {
    const urls = [
      `../../assets/i18n/en.json?v=${encodeURIComponent(GRAPH_CODEGEN_WORKER_MODULE_ID)}`,
      `../../assets/i18n/templates/en.json?v=${encodeURIComponent(GRAPH_CODEGEN_WORKER_MODULE_ID)}`
    ];
    for (const url of urls) {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        if (url.includes("/templates/")) continue;
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      Object.assign(__rmlWorkerI18nState.fallback, await response.json());
    }
    __rmlWorkerI18nState.hydrated = true;
  } catch (error) {
    __rmlWorkerI18nState.error = String(error?.message || error);
    throw error;
  }
}

self.__rmlScheduledCallbackSequence = 0;
self.__rmlCancelledScheduledCallbacks =
  new Set();
const scheduleWorkerCallback = (
  callback,
  argument
) => {
  const handle =
    ++self.__rmlScheduledCallbackSequence;
  queueMicrotask(() => {
    if (
      self.__rmlCancelledScheduledCallbacks
        .delete(handle)
    ) {
      return;
    }
    callback(argument);
  });
  return handle;
};
self.requestAnimationFrame =
  self.requestAnimationFrame ||
  (callback =>
    scheduleWorkerCallback(
      callback,
      performance.now()
    ));
self.cancelAnimationFrame =
  self.cancelAnimationFrame ||
  (handle =>
    self.__rmlCancelledScheduledCallbacks
      .add(handle));
self.requestIdleCallback =
  self.requestIdleCallback ||
  (callback =>
    scheduleWorkerCallback(
      callback,
      {
        didTimeout: false,
        timeRemaining: () => 50
      }
    ));
self.cancelIdleCallback =
  self.cancelIdleCallback ||
  (handle =>
    self.__rmlCancelledScheduledCallbacks
      .add(handle));
self.matchMedia =
  self.matchMedia ||
  (() => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }));
self.getComputedStyle =
  self.getComputedStyle ||
  (() => ({
    getPropertyValue: () => "",
    transform: "none"
  }));
self.localStorage = {
  getItem() {
    return null;
  },
  setItem() {},
  removeItem() {}
};
self.CSS = self.CSS || {
  escape(value) {
    return String(value || "")
      .replace(/[^A-Za-z0-9_-]/g, "\\$&");
  }
};
self.CustomEvent =
  self.CustomEvent ||
  class CustomEvent extends Event {
    constructor(type, options = {}) {
      super(type, options);
      this.detail = options.detail;
    }
  };
self.MutationObserver =
  self.MutationObserver ||
  class MutationObserver {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
self.ResizeObserver =
  self.ResizeObserver ||
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
self.Element = self.Element || class Element {};
self.HTMLElement =
  self.HTMLElement || class HTMLElement extends self.Element {};

const emptyClassList = {
  add() {},
  remove() {},
  toggle() {
    return false;
  },
  contains() {
    return false;
  }
};
const emptyElement = {
  dataset: {},
  style: {
    setProperty() {},
    removeProperty() {}
  },
  classList: emptyClassList,
  appendChild() {},
  removeChild() {},
  replaceChildren() {},
  addEventListener() {},
  removeEventListener() {},
  setAttribute() {},
  removeAttribute() {},
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  }
};

self.document = {
  readyState: "loading",
  currentScript: null,
  documentElement: emptyElement,
  body: emptyElement,
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return true;
  },
  getElementById() {
    return null;
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
  createElement() {
    return {
      ...emptyElement,
      dataset: {},
      style: {
        setProperty() {},
        removeProperty() {}
      },
      classList: {
        ...emptyClassList
      }
    };
  }
};

let runtimeReady = null;
let runtimeProjectionKey = "";

const GRAPH_CODEGEN_STREAM_TOKEN = Object.freeze({
  null: 1,
  false: 2,
  true: 3,
  number: 4,
  string: 5,
  array: 6,
  object: 7,
  key: 8,
  end: 9,
  longString: 10,
  stringPart: 11,
  endString: 12,
  longKey: 13,
  keyPart: 14,
  endKey: 15
});
const GRAPH_CODEGEN_RESULT_MAX_TOKENS = 512;
const GRAPH_CODEGEN_RESULT_MAX_CHARACTERS =
  48 * 1024;
const GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS =
  16 * 1024;
const streamedBuildRequests = new Map();

function streamDecoder() {
  return {
    root: undefined,
    hasRoot: false,
    frames: [],
    longStringParts: null,
    longKeyParts: null
  };
}

function assignDecodedStreamValue(decoder, value) {
  const parent =
    decoder.frames[decoder.frames.length - 1];
  if (!parent) {
    if (decoder.hasRoot) {
      throw new Error(
        "Graph code-generation stream contains more than one root value."
      );
    }
    decoder.root = value;
    decoder.hasRoot = true;
    return;
  }
  if (parent.kind === "array") {
    parent.value.push(value);
    return;
  }
  if (typeof parent.key !== "string") {
    throw new Error(
      "Graph code-generation object value has no key."
    );
  }
  Object.defineProperty(
    parent.value,
    parent.key,
    {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    }
  );
  parent.key = null;
}

function decodeStreamTokens(decoder, tokens) {
  const values = Array.isArray(tokens)
    ? tokens
    : [];
  for (
    let index = 0;
    index + 1 < values.length;
    index += 2
  ) {
    const code = values[index];
    const value = values[index + 1];
    if (code === GRAPH_CODEGEN_STREAM_TOKEN.null) {
      assignDecodedStreamValue(decoder, null);
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.false ||
      code === GRAPH_CODEGEN_STREAM_TOKEN.true ||
      code === GRAPH_CODEGEN_STREAM_TOKEN.number ||
      code === GRAPH_CODEGEN_STREAM_TOKEN.string
    ) {
      assignDecodedStreamValue(decoder, value);
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.array ||
      code === GRAPH_CODEGEN_STREAM_TOKEN.object
    ) {
      const container =
        code === GRAPH_CODEGEN_STREAM_TOKEN.array
          ? []
          : {};
      assignDecodedStreamValue(decoder, container);
      decoder.frames.push({
        kind:
          code === GRAPH_CODEGEN_STREAM_TOKEN.array
            ? "array"
            : "object",
        value: container,
        key: null
      });
    } else if (code === GRAPH_CODEGEN_STREAM_TOKEN.key) {
      const frame =
        decoder.frames[decoder.frames.length - 1];
      if (frame?.kind !== "object") {
        throw new Error(
          "Graph code-generation key is outside an object."
        );
      }
      frame.key = String(value || "");
    } else if (code === GRAPH_CODEGEN_STREAM_TOKEN.end) {
      if (decoder.frames.length === 0) {
        throw new Error(
          "Graph code-generation stream closes no container."
        );
      }
      decoder.frames.pop();
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.longString
    ) {
      decoder.longStringParts = [];
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.stringPart
    ) {
      if (!decoder.longStringParts) {
        throw new Error(
          "Graph code-generation string part has no open string."
        );
      }
      decoder.longStringParts.push(String(value || ""));
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.endString
    ) {
      if (!decoder.longStringParts) {
        throw new Error(
          "Graph code-generation stream closes no string."
        );
      }
      assignDecodedStreamValue(
        decoder,
        decoder.longStringParts.join("")
      );
      decoder.longStringParts = null;
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.longKey
    ) {
      decoder.longKeyParts = [];
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.keyPart
    ) {
      if (!decoder.longKeyParts) {
        throw new Error(
          "Graph code-generation key part has no open key."
        );
      }
      decoder.longKeyParts.push(String(value || ""));
    } else if (
      code === GRAPH_CODEGEN_STREAM_TOKEN.endKey
    ) {
      const frame =
        decoder.frames[decoder.frames.length - 1];
      if (!decoder.longKeyParts || frame?.kind !== "object") {
        throw new Error(
          "Graph code-generation stream closes no object key."
        );
      }
      frame.key = decoder.longKeyParts.join("");
      decoder.longKeyParts = null;
    } else {
      throw new Error(
        `Unknown graph code-generation stream token '${code}'.`
      );
    }
  }
}

function finishStreamDecoder(decoder) {
  if (
    !decoder?.hasRoot ||
    decoder.frames.length > 0 ||
    decoder.longStringParts ||
    decoder.longKeyParts
  ) {
    throw new Error(
      "Graph code-generation stream ended before its root value was complete."
    );
  }
  return decoder.root;
}

function resultStreamCursor(value) {
  const progressItems = new WeakSet();
  let progressTotal = 0;
  for (const item of [
    ...(Array.isArray(value?.nodes)
      ? value.nodes
      : []),
    ...(Array.isArray(value?.connections)
      ? value.connections
      : [])
  ]) {
    if (
      item &&
      typeof item === "object" &&
      !progressItems.has(item)
    ) {
      progressItems.add(item);
      progressTotal += 1;
    }
  }
  return {
    ancestors: new WeakSet(),
    frames: [],
    pending: true,
    pendingValue: value,
    pendingLongKeyValue: undefined,
    code: 0,
    value: undefined,
    progressItems,
    progressSeen: new WeakSet(),
    progressCompleted: 0,
    progressTotal: Math.max(1, progressTotal)
  };
}

function nextResultStreamToken(cursor) {
  const emit = (code, value = undefined) => {
    cursor.code = code;
    cursor.value = value;
    return true;
  };
  while (cursor.pending || cursor.frames.length > 0) {
    if (cursor.pending) {
      const value = cursor.pendingValue;
      cursor.pending = false;
      cursor.pendingValue = undefined;
      if (
        value &&
        typeof value === "object" &&
        cursor.progressItems.has(value) &&
        !cursor.progressSeen.has(value)
      ) {
        cursor.progressSeen.add(value);
        cursor.progressCompleted += 1;
      }
      if (Array.isArray(value)) {
        if (cursor.ancestors.has(value)) {
          throw new TypeError(
            "Graph code-generation result contains a cyclic array."
          );
        }
        cursor.ancestors.add(value);
        cursor.frames.push({
          kind: "array",
          value,
          index: 0
        });
        return emit(GRAPH_CODEGEN_STREAM_TOKEN.array);
      }
      if (value && typeof value === "object") {
        if (cursor.ancestors.has(value)) {
          throw new TypeError(
            "Graph code-generation result contains a cyclic object."
          );
        }
        cursor.ancestors.add(value);
        cursor.frames.push({
          kind: "object",
          value,
          keys: Object.keys(value),
          index: 0,
          longKey: null,
          keyOffset: 0
        });
        return emit(GRAPH_CODEGEN_STREAM_TOKEN.object);
      }
      if (
        typeof value === "string" &&
        value.length >
          GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS
      ) {
        cursor.frames.push({
          kind: "string",
          value,
          offset: 0
        });
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.longString
        );
      }
      if (
        value === null ||
        value === undefined ||
        (
          typeof value === "number" &&
          !Number.isFinite(value)
        )
      ) {
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.null,
          null
        );
      }
      if (value === true || value === false) {
        return emit(
          value
            ? GRAPH_CODEGEN_STREAM_TOKEN.true
            : GRAPH_CODEGEN_STREAM_TOKEN.false,
          value
        );
      }
      if (typeof value === "number") {
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.number,
          value
        );
      }
      if (typeof value === "string") {
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.string,
          value
        );
      }
      throw new TypeError(
        "Graph code-generation result contains an unsupported scalar value."
      );
    }

    const frame =
      cursor.frames[cursor.frames.length - 1];
    if (frame.kind === "array") {
      if (frame.index >= frame.value.length) {
        cursor.frames.pop();
        cursor.ancestors.delete(frame.value);
        return emit(GRAPH_CODEGEN_STREAM_TOKEN.end);
      }
      const item = frame.value[frame.index++];
      if (
        item === undefined ||
        typeof item === "function" ||
        typeof item === "symbol" ||
        (
          typeof item === "number" &&
          !Number.isFinite(item)
        )
      ) {
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.null,
          null
        );
      }
      cursor.pending = true;
      cursor.pendingValue = item;
      continue;
    }
    if (frame.kind === "string") {
      if (frame.offset < frame.value.length) {
        const part = frame.value.slice(
          frame.offset,
          frame.offset +
            GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS
        );
        frame.offset +=
          GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS;
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.stringPart,
          part
        );
      }
      cursor.frames.pop();
      return emit(
        GRAPH_CODEGEN_STREAM_TOKEN.endString
      );
    }
    if (frame.longKey !== null) {
      if (frame.keyOffset < frame.longKey.length) {
        const part = frame.longKey.slice(
          frame.keyOffset,
          frame.keyOffset +
            GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS
        );
        frame.keyOffset +=
          GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS;
        return emit(
          GRAPH_CODEGEN_STREAM_TOKEN.keyPart,
          part
        );
      }
      frame.longKey = null;
      frame.keyOffset = 0;
      cursor.pending = true;
      cursor.pendingValue =
        cursor.pendingLongKeyValue;
      cursor.pendingLongKeyValue = undefined;
      return emit(GRAPH_CODEGEN_STREAM_TOKEN.endKey);
    }

    let key = null;
    let item;
    while (frame.index < frame.keys.length) {
      key = frame.keys[frame.index++];
      item = frame.value[key];
      if (
        item !== undefined &&
        typeof item !== "function" &&
        typeof item !== "symbol"
      ) {
        break;
      }
      key = null;
    }
    if (key === null) {
      cursor.frames.pop();
      cursor.ancestors.delete(frame.value);
      return emit(GRAPH_CODEGEN_STREAM_TOKEN.end);
    }
    if (
      key.length >
        GRAPH_CODEGEN_RESULT_STRING_PART_CHARACTERS
    ) {
      frame.longKey = key;
      frame.keyOffset = 0;
      cursor.pendingLongKeyValue = item;
      return emit(GRAPH_CODEGEN_STREAM_TOKEN.longKey);
    }
    cursor.pending = true;
    cursor.pendingValue = item;
    return emit(GRAPH_CODEGEN_STREAM_TOKEN.key, key);
  }
  return false;
}

function postStreamedBuildResult(
  id,
  result,
  onProgress = null
) {
  const cursor = resultStreamCursor(result);
  self.postMessage({
    id,
    operation: "resultStart",
    workCompleted: 0,
    workTotal: cursor.progressTotal
  });
  onProgress?.({
    completed: 0,
    total: cursor.progressTotal
  });
  let complete = false;
  while (!complete) {
    const tokens = [];
    let tokenCount = 0;
    let characters = 0;
    while (
      tokenCount < GRAPH_CODEGEN_RESULT_MAX_TOKENS &&
      characters <
        GRAPH_CODEGEN_RESULT_MAX_CHARACTERS
    ) {
      if (!nextResultStreamToken(cursor)) {
        complete = true;
        break;
      }
      tokens.push(cursor.code, cursor.value);
      tokenCount += 1;
      if (typeof cursor.value === "string") {
        characters += cursor.value.length;
      }
    }
    if (tokens.length > 0) {
      self.postMessage({
        id,
        operation: "resultChunk",
        tokens,
        workCompleted:
          cursor.progressCompleted,
        workTotal: cursor.progressTotal
      });
      onProgress?.({
        completed:
          cursor.progressCompleted,
        total: cursor.progressTotal
      });
    }
  }
  cursor.progressCompleted =
    cursor.progressTotal;
  onProgress?.({
    completed: cursor.progressTotal,
    total: cursor.progressTotal
  });
  self.postMessage({
    id,
    operation: "resultEnd",
    workCompleted: cursor.progressTotal,
    workTotal: cursor.progressTotal
  });
}

async function ensureRuntime(
  catalog,
  projectionKey = ""
) {
  const hasCatalog = Boolean(
    catalog &&
    typeof catalog === "object" &&
    !Array.isArray(catalog) &&
    (
      (
        Array.isArray(catalog.types) &&
        catalog.types.length > 0
      ) ||
      (
        Array.isArray(catalog.enums) &&
        catalog.enums.length > 0
      )
    )
  );
  const requestedProjectionKey = String(
    projectionKey ||
    (
      hasCatalog
        ? [
            catalog.catalogFingerprint ||
              catalog.assemblyFingerprint ||
              catalog.engineVersion ||
              "catalog",
            catalog.types?.length || 0,
            catalog.enums?.length || 0
          ].join("|")
        : "offline"
    )
  );

  if (!runtimeReady) {
    runtimeReady = (async () => {
    await __rmlHydrateWorkerI18n();
    if (hasCatalog) {
      self.RMLResoniteApiCatalog =
        catalog;
      self.RMLFrooxComponentCatalog =
        catalog;
    } else {

      delete self.RMLResoniteApiCatalog;
      delete self.RMLFrooxComponentCatalog;
    }

    importScripts(
      "../core/csharp_contracts.js?v=1.25.00-canonical-type-reconciliation-startup-recovery"
    );
    importScripts(
      "../graph/node_graph_registry.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&portable-types=1&i18n-rev=1"
    );
    importScripts(
      "../graph/node_graph_type_migration.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&type-contract=4"
    );
    importScripts(
      "../catalog/mod_nodes.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&null-fallback=3&portable-types=1&i18n-rev=1"
    );
    importScripts(
      "../catalog/csharp_nodes.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&i18n-rev=1"
    );
    importScripts(
      "../catalog/universal_performance_nodes.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&i18n-rev=1"
    );
    importScripts(
      "../compiler/visual_csharp.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&i18n-rev=2"
    );
    importScripts(
      "../catalog/api_nodes.js?v=1.25.04-export-folder-events&factory=49&schema=4&portable-types=1&specializations=2&inherited-demand=1&i18n-rev=1&stable-contract-index=1&integrity-certificate=1"
    );

    if (
      hasCatalog &&
      self.RMLApiNodeFactoryReady &&
      typeof self.RMLApiNodeFactoryReady.then ===
        "function"
    ) {
      await self.RMLApiNodeFactoryReady;
    }

    const factoryController =
      self.RMLApiNodeFactoryController;
    if (
      !factoryController ||
      typeof factoryController.rebuild !==
        "function"
    ) {
      throw new Error(
        "The graph-codegen worker API factory does not expose the required rebuild capability."
      );
    }

    importScripts(
      "../graph/node_graph_codegen.js?v=1.25.00-canonical-type-reconciliation-startup-recovery&portable-types=1&specializations=1&outline-optional=1&type-identity=2&language-type-adapter=7"
    );

    if (
      !self.RMLTypedNodeGraphGenerator ||
      typeof self.RMLTypedNodeGraphGenerator.build !==
        "function"
    ) {
      throw new Error(
        "The graph-codegen worker did not expose a usable typed graph generator."
      );
    }
      runtimeProjectionKey =
        requestedProjectionKey;
    })();

    return runtimeReady;
  }

  await runtimeReady;
  if (
    !hasCatalog ||
    runtimeProjectionKey === requestedProjectionKey
  ) {
    return runtimeReady;
  }

  self.RMLResoniteApiCatalog = catalog;
  self.RMLFrooxComponentCatalog = catalog;
  const controller =
    self.RMLApiNodeFactoryController;
  if (typeof controller?.rebuild !== "function") {
    throw new Error(
      "The graph-codegen worker cannot rebuild its projected API factory."
    );
  }
  await controller.rebuild(catalog, {
    source: "graph-codegen-projection"
  });
  const report = self.RMLApiNodeFactoryReport;
  if (
    report?.verificationPassed !== true ||
    String(report?.catalogFingerprint || "") !==
      String(catalog?.catalogFingerprint || "")
  ) {
    throw new Error(
      "The graph-codegen worker could not verify its projected API factory."
    );
  }
  runtimeProjectionKey = requestedProjectionKey;

  return runtimeReady;
}

function isScannerMemberRequirement(requirement) {
  return Boolean(
    String(
      requirement?.operatorId || ""
    ).startsWith("api.") &&
    String(
      requirement?.apiContract?.kind || ""
    ) !== "type"
  );
}

function streamedProjectionKey(support) {
  const catalog = support?.catalog;
  const requirements = Array.isArray(
    support?.requirements
  )
    ? support.requirements.filter(
        isScannerMemberRequirement
      )
    : [];
  return [
    support?.contractSnapshot?.fingerprint ||
      catalog?.catalogFingerprint ||
      catalog?.assemblyFingerprint ||
      "offline",
    ...requirements.map(requirement => {
      const contract = requirement?.apiContract || {};
      return [
        requirement?.operatorId || "",
        String(
          requirement?.availability || ""
        ),
        portableContractSemanticKey(
          contract
        ),
        JSON.stringify(
          portableCanonicalValue(
            requirement?.nodeParameters || {}
          )
        )
      ].join("\u0000");
    }).sort(),
    JSON.stringify(
      portableCanonicalValue(
        (Array.isArray(
          support?.portableTypeContracts
        )
          ? support.portableTypeContracts
          : [])
          .map(contract =>
            portableCanonicalValue(contract)
          )
          .sort((left, right) =>
            JSON.stringify(left).localeCompare(
              JSON.stringify(right)
            )
          )
      )
    )
  ].join("\u0001");
}

function portableNormalizeCsType(value) {
  return String(value || "")
    .trim()
    .replace(/^global::/, "")
    .replace(/\s+/g, " ");
}

function portableContractType(value) {
  const aliases = {
    bool: "System.Boolean",
    byte: "System.Byte",
    sbyte: "System.SByte",
    short: "System.Int16",
    ushort: "System.UInt16",
    int: "System.Int32",
    uint: "System.UInt32",
    long: "System.Int64",
    ulong: "System.UInt64",
    nint: "System.IntPtr",
    nuint: "System.UIntPtr",
    half: "System.Half",
    char: "System.Char",
    float: "System.Single",
    double: "System.Double",
    decimal: "System.Decimal",
    string: "System.String",
    object: "System.Object",
    void: "System.Void"
  };
  const source = String(value || "").trim();
  if (!source) return "";
  return source
    .replace(/global::/g, "")
    .replace(/\s+/g, "")
    .replace(/&$/, "")
    .replace(
      /(^|[^A-Za-z0-9_.@])(bool|byte|sbyte|short|ushort|int|uint|long|ulong|nint|nuint|half|char|float|double|decimal|string|object|void)(?=$|[^A-Za-z0-9_])/g,
      (_match, prefix, alias) =>
        `${prefix}${aliases[alias]}`
    )
    .replace(/\?(?=$|[>,\]\[])/g, "");
}

function portableCsTypeIdentity(value) {
  const type = portableContractType(value);
  if (!type) return "";
  try {
    const identity =
      self.RMLCSharpContracts
        ?.canonicalTypeIdentity?.(
          type,
          { allowOpen: true }
        );
    if (identity) return String(identity);
  } catch {}
  return type;
}

function portablePortCsTypeIdentity(
  port,
  definitions
) {
  const explicit = portableCsTypeIdentity(
    port?.apiCsType || port?.csType || ""
  );
  if (explicit) return explicit;
  const graphType = String(
    port?.type || ""
  ).trim();
  return portableCsTypeIdentity(
    definitions?.[graphType]?.csType || ""
  );
}

function portableCanonicalValue(value) {
  if (Array.isArray(value)) {
    return value.map(portableCanonicalValue);
  }
  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) =>
          left.localeCompare(right)
        )
        .map(key => [
          key,
          portableCanonicalValue(value[key])
        ])
    );
  }
  return value ?? null;
}

function portableAssemblyReferences(value) {
  const references = new Map();
  for (const reference of
    Array.isArray(value) ? value : []) {
    const include = String(
      reference?.include || ""
    ).trim();
    if (!include) continue;
    references.set(
      include.toLowerCase(),
      {
        include,
        hintPath: String(
          reference?.hintPath || ""
        ).trim().replace(/\\/g, "/"),
        private:
          reference?.private === true
      }
    );
  }
  return [...references.values()].sort(
    (left, right) =>
      left.include.localeCompare(
        right.include
      )
  );
}

function portableGenericRows(value) {
  return (Array.isArray(value) ? value : [])
    .map((row, index) => ({
      name: String(row?.name || row || ""),
      position: Math.max(
        0,
        Number(row?.position) || index
      ),
      referenceTypeConstraint:
        row?.referenceTypeConstraint === true,
      valueTypeConstraint:
        row?.valueTypeConstraint === true,
      defaultConstructorConstraint:
        row?.defaultConstructorConstraint === true,
      unmanagedConstraint:
        row?.unmanagedConstraint === true,
      notNullConstraint:
        row?.notNullConstraint === true,
      variance: String(
        row?.variance || "none"
      ),
      constraints:
        (Array.isArray(row?.constraints)
          ? row.constraints
          : [])
          .map(portableContractType)
          .sort()
    }))
    .filter(row => row.name)
    .sort((left, right) =>
      left.position - right.position
    );
}

function portableExactEnumNumericText(value) {
  if (
    typeof value === "string" &&
    /^[+-]?\d+$/.test(value.trim())
  ) {
    return value.trim().replace(/^\+/, "");
  }
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return "";
}

function portableEnumValues(value) {
  return (Array.isArray(value) ? value : [])
    .map(entry => {
      const raw =
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry)
          ? entry.value ?? entry.numericValue
          : null;
      return {
        name: String(
          entry?.name || entry || ""
        ),
        value:
          portableExactEnumNumericText(raw)
      };
    })
    .filter(entry => entry.name)
    .sort((left, right) =>
      left.name.localeCompare(right.name)
    );
}

function portableEnumContractsMatch(
  expected,
  available,
  selectedValue = ""
) {
  if (
    String(expected?.kind || "") !== "enum" ||
    String(available?.kind || "") !== "enum"
  ) {
    return null;
  }
  const core = contract =>
    portableContractSemanticKey({
      ...contract,
      enumValues: [],
      enumDefaultValue: "",
      enumValue: ""
    });
  const expectedCore = core(expected);
  const availableCore = core(available);
  if (
    !expectedCore ||
    !availableCore ||
    expectedCore !== availableCore
  ) {
    return false;
  }
  const selected = String(
    selectedValue ||
    expected?.enumValue ||
    expected?.enumDefaultValue ||
    ""
  );
  if (!selected) return false;
  const requested = portableEnumValues(
    expected?.enumValues
  ).find(entry => entry.name === selected);
  const installed = portableEnumValues(
    available?.enumValues
  ).find(entry => entry.name === selected);
  if (!installed) return false;
  return !(
    requested?.value &&
    installed.value &&
    requested.value !== installed.value
  );
}

function portableContractPortRole(
  contract,
  direction,
  port
) {
  const explicit = String(
    port?.role || port?.roleKey || ""
  ).trim();
  if (explicit) return explicit;
  const id = String(port?.id || "").trim();
  const fixed = new Set([
    "call", "done", "success", "exception",
    "target", "result", "value"
  ]);
  if (fixed.has(id)) return `${direction}:${id}`;
  let match = /^arg(\d+)$/.exec(id);
  if (match) {
    return `parameter:${Number(match[1])}:input`;
  }
  match = /^out(\d+)$/.exec(id);
  if (match) {
    return `parameter:${Number(match[1])}:output`;
  }
  match = /^generic(\d+)$/.exec(id);
  if (match) {
    return `generic:${Number(match[1])}:input`;
  }
  const parameter = (
    Array.isArray(contract?.parameters)
      ? contract.parameters
      : []
  ).find(value =>
    String(value?.name || "") === id
  );
  if (parameter) {
    return `parameter:${Math.max(
      0,
      Number(parameter.position) || 0
    )}:${direction}`;
  }
  return `${String(
    contract?.kind || "api"
  )}:${direction}:${id}`;
}

function portableContractSemanticKey(contract) {
  if (
    !contract ||
    typeof contract !== "object" ||
    Array.isArray(contract)
  ) {
    return "";
  }
  const kind = String(
    contract.kind || ""
  ).trim();
  const ownerType = portableContractType(
    contract.ownerType
  );
  if (!kind || !ownerType) return "";
  const stableContractId = String(
    contract.stableContractId || ""
  );
  const parameters = (
    Array.isArray(contract.parameters)
      ? contract.parameters
      : []
  ).map((parameter, index) => ({
    position: Math.max(
      0,
      Number(parameter?.position) || index
    ),
    type: portableContractType(
      parameter?.elementType ||
      parameter?.type
    ),
    isByRef:
      parameter?.isByRef === true ||
      parameter?.isOut === true,
    isIn: parameter?.isIn === true,
    isOut: parameter?.isOut === true,
    isOptional:
      parameter?.isOptional === true,
    hasDefaultValue:
      parameter?.hasDefaultValue === true,
    defaultValueCSharp: String(
      parameter?.defaultValueCSharp || ""
    ),
    name: String(parameter?.name || "")
  }));
  const ports = (direction, key) => (
    Array.isArray(contract[key])
      ? contract[key]
      : []
  ).map(port => ({
    id: String(port?.id || "").trim(),
    role: portableContractPortRole(
      contract,
      direction,
      port
    ),
    type: String(port?.type || "").trim(),
    csType: portableContractType(
      port?.csType || ""
    ),
    typeVar: String(
      port?.typeVar || ""
    ).trim(),
    generic: port?.generic === true,
    optional: port?.optional === true
  })).sort((left, right) =>
    left.id.localeCompare(right.id) ||
    left.role.localeCompare(right.role)
  );
  return JSON.stringify({
    schemaVersion: Math.max(
      0,
      Number(contract.schemaVersion) || 0
    ),
    kind,
    ownerType,
    memberName: String(
      contract.memberName || ""
    ),
    parameters,
    returnType: portableContractType(
      contract.returnType || "System.Void"
    ),
    isStatic: contract.isStatic === true,
    genericArity: Math.max(
      0,
      Number(contract.genericArity) || 0
    ),
    runtimeBound:
      contract.runtimeBound === true,
    directExecutable:
      contract.directExecutable === true,
    signature: String(
      contract.signature || ""
    ).trim(),
    executionOrigin:
      stableContractId.startsWith(
        "contract.inherited."
      )
        ? stableContractId
        : "",
    stableContractId: String(
      contract.stableContractId || ""
    ),
    hookVisibility:
      kind === "hook-method"
        ? String(
            contract.hookVisibility || ""
          )
        : "",
    ownerGenericParameters:
      portableGenericRows(
        contract.ownerGenericParameters
      ),
    methodGenericParameters:
      portableGenericRows(
        contract.methodGenericParameters
      ),
    genericBindings:
      Object.fromEntries(
        Object.entries(
          contract.genericBindings &&
          typeof contract.genericBindings ===
            "object" &&
          !Array.isArray(
            contract.genericBindings
          )
            ? contract.genericBindings
            : {}
        )
          .map(([key, value]) => [
            String(key),
            portableContractType(value)
          ])
          .sort(([left], [right]) =>
            left.localeCompare(right)
          )
      ),
    requiredAssemblyReferences:
      portableAssemblyReferences(
        contract.requiredAssemblyReferences
      ),
    baseAssemblyReferences:
      portableAssemblyReferences(
        contract.baseAssemblyReferences ||
        contract.requiredAssemblyReferences
      ),
    enumValues: portableEnumValues(
      contract.enumValues
    ),
    enumDefaultValue: String(
      contract.enumDefaultValue || ""
    ),
    enumValue: String(
      contract.enumValue || ""
    ),
    enumUnderlyingType:
      portableContractType(
        contract.enumUnderlyingType || ""
      ),
    enumIsFlags:
      contract.enumIsFlags === true,
    threadAffinity: String(
      contract.threadAffinity || "unknown"
    ),
    reloadSafety:
      portableCanonicalValue(
        contract.reloadSafety || null
      ),
    reloadCleanupCapabilities:
      [...new Set(
        (Array.isArray(
          contract.reloadCleanupCapabilities
        )
          ? contract.reloadCleanupCapabilities
          : [])
          .map(String)
      )].sort(),
    reloadAutomaticCleanup:
      [...new Set(
        (Array.isArray(
          contract.reloadAutomaticCleanup
        )
          ? contract.reloadAutomaticCleanup
          : [])
          .map(String)
      )].sort(),
    inputPorts: ports("input", "inputPorts"),
    outputPorts:
      ports("output", "outputPorts")
  });
}

function portableExecutableContractKey(
  contract
) {
  if (
    !contract ||
    typeof contract !== "object" ||
    Array.isArray(contract)
  ) {
    return "";
  }
  const kind = String(
    contract.kind || ""
  ).trim();
  const ownerType = portableContractType(
    contract.ownerType
  );
  if (!kind || !ownerType) return "";
  const parameters = (
    Array.isArray(contract.parameters)
      ? contract.parameters
      : []
  ).map((parameter, index) => ({
    position: Math.max(
      0,
      Number(parameter?.position) || index
    ),
    name: String(parameter?.name || ""),
    type: portableContractType(
      parameter?.elementType ||
      parameter?.type
    ),
    isByRef:
      parameter?.isByRef === true ||
      parameter?.isOut === true,
    isIn: parameter?.isIn === true,
    isOut: parameter?.isOut === true,
    isOptional:
      parameter?.isOptional === true,
    hasDefaultValue:
      parameter?.hasDefaultValue === true,
    defaultValueCSharp: String(
      parameter?.defaultValueCSharp || ""
    )
  }));
  const ports = (direction, key) => (
    Array.isArray(contract[key])
      ? contract[key]
      : []
  ).map(port => ({
    id: String(port?.id || "").trim(),
    type: String(port?.type || "").trim(),
    csType: portableContractType(
      port?.csType || ""
    ),
    typeVar: String(
      port?.typeVar || ""
    ).trim(),
    generic: port?.generic === true,
    optional: port?.optional === true,
    role: portableContractPortRole(
      contract,
      direction,
      port
    )
  }));
  return JSON.stringify({
    schemaVersion: Math.max(
      0,
      Number(contract.schemaVersion) || 0
    ),
    kind,
    ownerType,
    memberName: String(
      contract.memberName || ""
    ),
    signature: String(
      contract.signature || ""
    ).trim(),
    parameters,
    returnType: portableContractType(
      contract.returnType || "System.Void"
    ),
    isStatic: contract.isStatic === true,
    genericArity: Math.max(
      0,
      Number(contract.genericArity) || 0
    ),
    hookVisibility:
      kind === "hook-method"
        ? String(
            contract.hookVisibility || ""
          )
        : "",
    runtimeBound:
      contract.runtimeBound === true,
    directExecutable:
      contract.directExecutable === true,
    ownerGenericParameters:
      portableGenericRows(
        contract.ownerGenericParameters
      ),
    methodGenericParameters:
      portableGenericRows(
        contract.methodGenericParameters
      ),
    genericBindings:
      Object.fromEntries(
        Object.entries(
          contract.genericBindings &&
          typeof contract.genericBindings ===
            "object" &&
          !Array.isArray(
            contract.genericBindings
          )
            ? contract.genericBindings
            : {}
        )
          .map(([key, value]) => [
            String(key),
            portableContractType(value)
          ])
          .sort(([left], [right]) =>
            left.localeCompare(right)
          )
      ),
    requiredAssemblyReferences:
      portableAssemblyReferences(
        contract.requiredAssemblyReferences
      ),
    baseAssemblyReferences:
      portableAssemblyReferences(
        contract.baseAssemblyReferences ||
        contract.requiredAssemblyReferences
      ),
    enumValues: portableEnumValues(
      contract.enumValues
    ),
    enumDefaultValue: String(
      contract.enumDefaultValue || ""
    ),
    enumValue: String(
      contract.enumValue || ""
    ),
    enumUnderlyingType:
      portableContractType(
        contract.enumUnderlyingType || ""
      ),
    enumIsFlags:
      contract.enumIsFlags === true,
    inputPorts: ports(
      "input",
      "inputPorts"
    ),
    outputPorts: ports(
      "output",
      "outputPorts"
    )
  });
}

function portableDefinitionContract(
  contract,
  definition,
  nodeParameters = {},
  scannerLocatorOnly = false
) {
  const base = definition?.apiVerification;
  if (
    !base ||
    typeof base !== "object" ||
    Array.isArray(base)
  ) {
    return null;
  }
  const requestedContract =
    contract &&
    typeof contract === "object" &&
    !Array.isArray(contract)
      ? structuredClone(contract)
      : null;
  if (
    scannerLocatorOnly === true &&
    requestedContract
  ) {
    delete requestedContract.genericBindings;
  }
  const node = {
    id: "worker-contract-check",
    kind: "operator",
    parameters:
      nodeParameters &&
      typeof nodeParameters === "object" &&
      !Array.isArray(nodeParameters)
        ? structuredClone(nodeParameters)
        : {},
    apiContract: requestedContract
  };
  let specialization = null;
  let resolved = definition;
  if (
    typeof definition
      .resolveApiSpecialization ===
        "function"
  ) {
    try {
      specialization =
        definition.resolveApiSpecialization(
          node
        );
    } catch {
      return null;
    }
  }
  if (
    typeof definition.resolveDefinition ===
      "function"
  ) {
    try {
      const value =
        definition.resolveDefinition(node);
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        resolved = {
          ...definition,
          ...value
        };
      }
    } catch {
      return null;
    }
  }
  const genericCount =
    portableGenericRows(
      base.ownerGenericParameters
    ).length +
    portableGenericRows(
      base.methodGenericParameters
    ).length;
  if (
    genericCount > 0 &&
    !specialization &&
    scannerLocatorOnly !== true
  ) {
    return null;
  }
  const result = structuredClone(base);
  const basePorts = direction => new Map(
    (Array.isArray(
      base[
        direction === "input"
          ? "inputPorts"
          : "outputPorts"
      ]
    )
      ? base[
          direction === "input"
            ? "inputPorts"
            : "outputPorts"
        ]
      : []).map(port => [
      String(port?.id || ""),
      port
    ])
  );
  const normalizePorts = (
    direction,
    values
  ) => {
    const bases = basePorts(direction);
    const requestedPorts = new Map(
      (Array.isArray(
        contract?.[
          direction === "input"
            ? "inputPorts"
            : "outputPorts"
        ]
      )
        ? contract[
            direction === "input"
              ? "inputPorts"
              : "outputPorts"
          ]
        : []).map(port => [
        String(port?.id || ""),
        port
      ])
    );
    const typeDefinitions =
      self.RMLModNodeRegistry
        ?.getTypeDefinitions?.() || {};
    return (Array.isArray(values) ? values : [])
      .map(port => {
        const id = String(port?.id || "");
        const basis = bases.get(id);
        const requestedPort =
          requestedPorts.get(id);
        const csType = portableContractType(
          port?.apiCsType ||
          port?.csType ||
          basis?.csType ||
          ""
        );
        const requestedType = String(
          requestedPort?.type || ""
        ).trim();
        const requestedTypeCs =
          portableContractType(
            typeDefinitions[requestedType]
              ?.csType || ""
          );
        const resolvedType =
          requestedType &&
          csType &&
          requestedTypeCs === csType
            ? requestedType
            : String(port?.type || "");
        return {
          ...basis,
          id,
          type: resolvedType,
          csType,
          typeVar: String(
            port?.typeVar ||
            basis?.typeVar ||
            ""
          ),
          generic:
            port?.generic === true ||
            basis?.generic === true,
          optional:
            port?.optional === true ||
            basis?.optional === true,
          role: portableContractPortRole(
            result,
            direction,
            basis || port
          )
        };
      });
  };
  result.inputPorts = normalizePorts(
    "input",
    resolved.inputs
  );
  result.outputPorts = normalizePorts(
    "output",
    resolved.outputs
  );
  const references = new Map();
  for (const reference of [
    ...(Array.isArray(
      base.baseAssemblyReferences
    )
      ? base.baseAssemblyReferences
      : Array.isArray(
          base.requiredAssemblyReferences
        )
        ? base.requiredAssemblyReferences
        : []),
    ...(Array.isArray(
      specialization
        ?.requiredAssemblyReferences
    )
      ? specialization
          .requiredAssemblyReferences
      : [])
  ]) {
    const include = String(
      reference?.include || ""
    ).trim();
    if (include) {
      references.set(
        include.toLowerCase(),
        reference
      );
    }
  }
  result.requiredAssemblyReferences =
    [...references.values()];
  if (specialization) {
    result.genericBindings =
      structuredClone(
        specialization.genericBindings || {}
      );
  }
  const directKinds = new Set([
    "method",
    "constructor",
    "property-get",
    "property-set",
    "field-get",
    "field-set",
    "type",
    "enum"
  ]);
  result.directExecutable =
    Number(result.schemaVersion) === 4 &&
    directKinds.has(
      String(result.kind || "")
    ) &&
    (
      genericCount === 0 ||
      Boolean(specialization)
    );
  if (result.kind === "enum") {
    result.enumValue = String(
      node.parameters?.value ||
      result.enumDefaultValue ||
      ""
    );
  }
  return result;
}

function portableVerifiedContractAdmissionKey(
  contract
) {
  if (
    !contract ||
    typeof contract !== "object" ||
    Array.isArray(contract)
  ) {
    return "";
  }
  const kind = String(
    contract.kind || ""
  ).trim();
  const ownerType = portableContractType(
    contract.ownerType
  );
  if (!kind || !ownerType) return "";
  const parameters = (
    Array.isArray(contract.parameters)
      ? contract.parameters
      : []
  ).map((parameter, index) => ({
    position: Math.max(
      0,
      Number(parameter?.position) || index
    ),
    name: String(parameter?.name || ""),
    type: portableContractType(
      parameter?.elementType ||
      parameter?.type
    ),
    isByRef:
      parameter?.isByRef === true ||
      parameter?.isOut === true,
    isIn: parameter?.isIn === true,
    isOut: parameter?.isOut === true
  }));
  const ports = (direction, key) => (
    Array.isArray(contract[key])
      ? contract[key]
      : []
  ).map(port => ({
    id: String(port?.id || "").trim(),
    role: portableContractPortRole(
      contract,
      direction,
      port
    ),
    type: String(port?.type || "").trim(),
    typeVar: String(
      port?.typeVar || ""
    ).trim(),
    generic: port?.generic === true,
    optional: port?.optional === true
  })).sort((left, right) =>
    left.id.localeCompare(right.id) ||
    left.role.localeCompare(right.role)
  );
  const genericArity = Math.max(
    0,
    Number(contract.genericArity) || 0
  );
  const hasGenericContract = Boolean(
    genericArity > 0 ||
    (
      Array.isArray(
        contract.ownerGenericParameters
      ) &&
      contract.ownerGenericParameters.length > 0
    ) ||
    (
      Array.isArray(
        contract.methodGenericParameters
      ) &&
      contract.methodGenericParameters.length > 0
    )
  );
  return JSON.stringify({
    kind,
    ownerType,
    memberName: String(
      contract.memberName || ""
    ),
    signature: String(
      contract.signature || ""
    ).trim(),
    parameters,
    returnType: portableContractType(
      contract.returnType || "System.Void"
    ),
    isStatic: contract.isStatic === true,
    genericArity,
    genericBindings:
      hasGenericContract
        ? Object.fromEntries(
            Object.entries(
              contract.genericBindings &&
              typeof contract.genericBindings ===
                "object" &&
              !Array.isArray(
                contract.genericBindings
              )
                ? contract.genericBindings
                : {}
            )
              .map(([key, value]) => [
                String(key),
                portableContractType(value)
              ])
              .sort(([left], [right]) =>
                left.localeCompare(right)
              )
          )
        : {},
    inputPorts: ports(
      "input",
      "inputPorts"
    ),
    outputPorts: ports(
      "output",
      "outputPorts"
    )
  });
}

function portableVerifiedMemberLocatorKey(
  contract
) {
  if (
    !contract ||
    typeof contract !== "object" ||
    Array.isArray(contract)
  ) {
    return "";
  }
  const kind = String(
    contract.kind || ""
  ).trim();
  const ownerType = portableContractType(
    contract.ownerType
  );
  if (!kind || !ownerType) return "";
  const parameters = (
    Array.isArray(contract.parameters)
      ? contract.parameters
      : []
  ).map((parameter, index) => ({
    position: Math.max(
      0,
      Number(parameter?.position) || index
    ),
    type: portableContractType(
      parameter?.elementType ||
      parameter?.type
    ),
    isByRef:
      parameter?.isByRef === true ||
      parameter?.isOut === true,
    isIn: parameter?.isIn === true,
    isOut: parameter?.isOut === true
  })).sort((left, right) =>
    left.position - right.position
  );
  return JSON.stringify({
    kind,
    ownerType,
    memberName: String(
      contract.memberName || ""
    ),
    parameters,
    returnType: portableContractType(
      contract.returnType || "System.Void"
    ),
    isStatic: contract.isStatic === true,
    genericArity: Math.max(
      0,
      Number(contract.genericArity) || 0
    ),
    ownerGenericParameters:
      portableGenericRows(
        contract.ownerGenericParameters
      ),
    methodGenericParameters:
      portableGenericRows(
        contract.methodGenericParameters
      )
  });
}

function portableVerifiedPortsMatch(
  contract,
  available
) {
  const definitions =
    self.RMLModNodeRegistry
      ?.getTypeDefinitions?.() || {};
  const portsMatch = (direction, key) => {
    const expectedPorts = Array.isArray(
      contract?.[key]
    )
      ? contract[key]
      : [];
    const availablePorts = Array.isArray(
      available?.[key]
    )
      ? available[key]
      : [];
    if (
      expectedPorts.length !==
      availablePorts.length
    ) {
      return false;
    }
    const availableByPort = new Map();
    for (const port of availablePorts) {
      const id = String(
        port?.id || ""
      ).trim();
      const role = portableContractPortRole(
        available,
        direction,
        port
      );
      const portKey = `${id}\u0000${role}`;
      if (
        !id ||
        !role ||
        availableByPort.has(portKey)
      ) {
        return false;
      }
      availableByPort.set(portKey, port);
    }
    const expectedKeys = new Set();
    return expectedPorts.every(expectedPort => {
      const id = String(
        expectedPort?.id || ""
      ).trim();
      const role = portableContractPortRole(
        contract,
        direction,
        expectedPort
      );
      const portKey = `${id}\u0000${role}`;
      if (
        !id ||
        !role ||
        expectedKeys.has(portKey)
      ) {
        return false;
      }
      expectedKeys.add(portKey);
      const installedPort =
        availableByPort.get(portKey);
      if (!installedPort) return false;
      const expectedIdentity =
        portablePortCsTypeIdentity(
          expectedPort,
          definitions
        );
      const installedIdentity =
        portablePortCsTypeIdentity(
          installedPort,
          definitions
        );
      return expectedIdentity ===
        installedIdentity;
    });
  };
  return Boolean(
    portsMatch("input", "inputPorts") &&
    portsMatch("output", "outputPorts")
  );
}

function portableStableContractIds(
  contract
) {
  const result = [];
  const seen = new Set();
  const append = source => {
    if (Array.isArray(source)) {
      for (const value of source) {
        append(value);
      }
      return;
    }
    const value = String(source || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    result.push(value);
  };
  append(contract?.stableContractId);
  append(contract?.stableContractIds);
  return result;
}

function portableStableContractIdsIntersect(
  left,
  right
) {
  const expected = new Set(
    portableStableContractIds(left)
  );
  if (expected.size === 0) return false;
  return portableStableContractIds(right)
    .some(value => expected.has(value));
}

function portableVerifiedContractForDefinition(
  contract,
  definition,
  nodeParameters = {},
  exactOperator = false
) {
  if (
    definition?.catalogGenerated !== true ||
    definition?.unavailableApiContract === true ||
    definition?.scannerCatalogGenerated !== true
  ) {
    return null;
  }
  const available = portableDefinitionContract(
    contract,
    definition,
    nodeParameters,
    exactOperator === true
  );
  if (!available) {
    return null;
  }
  if (
    !portableVerifiedPortsMatch(
      contract,
      available
    )
  ) {
    return null;
  }
  if (exactOperator === true) {
    if (
      portableVerifiedMemberLocatorKey(
        contract
      ) !== portableVerifiedMemberLocatorKey(
        available
      )
    ) {
      return null;
    }
    return available;
  }
  if (
    portableVerifiedContractAdmissionKey(
      contract
    ) !== portableVerifiedContractAdmissionKey(
      available
    )
  ) {
    return null;
  }
  if (
    !portableStableContractIdsIntersect(
      contract,
      available
    )
  ) {
    return null;
  }
  return available;
}

function portableContractMatchesDefinition(
  contract,
  definition,
  nodeParameters = {}
) {
  if (
    definition?.catalogGenerated !== true ||
    definition?.unavailableApiContract === true ||
    definition?.scannerCatalogGenerated !==
      true
  ) {
    return false;
  }
  const expectedKey =
    portableContractSemanticKey(contract);
  const selectedValue =
    nodeParameters?.value;
  const storedEnumMatch =
    portableEnumContractsMatch(
      contract,
      definition.apiVerification,
      selectedValue
    );
  if (storedEnumMatch === true) return true;
  const storedKey =
    portableContractSemanticKey(
      definition.apiVerification
    );
  if (
    expectedKey &&
    expectedKey === storedKey
  ) {
    return true;
  }
  const availableContract =
    portableDefinitionContract(
      contract,
      definition,
      nodeParameters
    );
  const availableEnumMatch =
    portableEnumContractsMatch(
      contract,
      availableContract,
      selectedValue
    );
  if (availableEnumMatch !== null) {
    return availableEnumMatch;
  }
  const availableKey =
    portableContractSemanticKey(
      availableContract
    );
  if (
    expectedKey &&
    availableKey &&
    expectedKey === availableKey
  ) {
    return true;
  }
  const expectedExecutableKey =
    portableExecutableContractKey(
      contract
    );
  const availableExecutableKey =
    portableExecutableContractKey(
      availableContract
    );
  return Boolean(
    expectedExecutableKey &&
    availableExecutableKey &&
    expectedExecutableKey ===
      availableExecutableKey
  );
}

function portableWorkerAssemblyReferences(
  value
) {
  const references = portableAssemblyReferences(
    value
  );
  for (const reference of references) {
    const include = String(
      reference.include || ""
    );
    const hintPath = String(
      reference.hintPath || ""
    ).replace(/\\/g, "/");
    if (
      !/^[A-Za-z0-9_.-]+$/.test(include) ||
      (
        hintPath &&
        (
          /(?:^|\/)\.\.(?:\/|$)/.test(
            hintPath
          ) ||
          /[<>'";&|`\r\n]/.test(
            hintPath
          ) ||
          !hintPath.startsWith(
            "$(ResonitePath)"
          )
        )
      )
    ) {
      throw new Error(
        `Portable type assembly reference '${include || "<missing>"}' is unsafe.`
      );
    }
  }
  return references;
}

function installPortableTypeContracts(
  support
) {
  const rawContracts = Array.isArray(
    support?.portableTypeContracts
  )
    ? support.portableTypeContracts
    : [];
  if (rawContracts.length === 0) {
    return Object.freeze({ installed: 0 });
  }
  const migrations =
    self.RMLGraphTypeImportMigrations;
  const registry =
    self.RMLModNodeRegistry;
  if (
    migrations?.version !== 1 ||
    typeof migrations
      .normalizedTypeContracts !==
        "function" ||
    typeof migrations
      .typeContractCompatibility !==
        "function" ||
    !registry ||
    typeof registry.getTypeDefinitions !==
      "function" ||
    typeof registry.registerType !==
      "function"
  ) {
    return Object.freeze({
      installed: 0,
      deferred: true
    });
  }
  const normalized =
    migrations.normalizedTypeContracts(
      rawContracts
    );
  if (normalized.conflicts.length > 0) {
    throw new Error(normalized.conflicts[0]);
  }
  const contracts = normalized.contracts;
  const definitions =
    registry.getTypeDefinitions();
  const portableInstalledTypeIds =
    new Set();
  const normalize = value =>
    portableContractType(value);
  const contractByGraphType = new Map(
    contracts.map(contract => [
      String(contract.graphType),
      contract
    ])
  );
  const liveVerified =
    self.RMLApiNodeFactoryReport
      ?.verificationPassed === true;
  const evidence = new Map();
  for (const requirement of
    Array.isArray(support?.requirements)
      ? support.requirements
      : []) {
    for (const port of [
      ...(Array.isArray(
        requirement?.apiContract?.inputPorts
      )
        ? requirement.apiContract.inputPorts
        : []),
      ...(Array.isArray(
        requirement?.apiContract?.outputPorts
      )
        ? requirement.apiContract.outputPorts
        : [])
    ]) {
      const graphType = String(
        port?.type || ""
      ).trim();
      const csType = normalize(
        port?.csType || ""
      );
      if (!graphType || !csType) continue;
      const values = evidence.get(graphType) ||
        new Set();
      values.add(csType);
      evidence.set(graphType, values);
    }
  }
  for (const [graphType, values] of evidence) {
    if (values.size !== 1) {
      throw new Error(
        `Portable graph type '${graphType}' has conflicting port C# identities.`
      );
    }
    const [csType] = values;
    const stored = contractByGraphType.get(
      graphType
    );
    const live = definitions[graphType];
    const knownCsType = normalize(
      stored?.csType || live?.csType || ""
    );
    if (
      knownCsType &&
      knownCsType !== csType
    ) {
      throw new Error(
        `Portable graph type '${graphType}' conflicts with its port C# identity.`
      );
    }
  }
  let installed = 0;
  for (const contract of contracts) {
    const graphType = String(
      contract.graphType
    );
    const csType = normalize(contract.csType);
    const languageExactGraphType =
      contract.typeAuthority ===
        "language-exact";
    const existing = definitions[graphType];
    if (existing) {
      const compatibility =
        migrations.typeContractCompatibility(
          contract,
          existing
        );
      if (
        !compatibility.compatible
      ) {
        throw new Error(
          `Portable graph type '${graphType}' conflicts with the worker registry.`
        );
      }
      if (
        languageExactGraphType &&
        existing.languageExactType !== true &&
        existing.normalExactType !== true &&
        existing.csharpExactType !== true
      ) {
        throw new Error(
          `Portable language type '${graphType}' conflicts with the worker registry authority.`
        );
      }
      continue;
    }
    const references =
      portableWorkerAssemblyReferences(
        contract.assemblyReferences
      );
    registry.registerType(graphType, {
      label: languageExactGraphType
        ? csType.replace(/^System\./, "")
        : `Portable · ${graphType}`,
      short: languageExactGraphType
        ? "C#"
        : "API",
      color: languageExactGraphType
        ? "#91b9dd"
        : "#ffb86b",
      csType,
      defaultCs:
        contract.referenceType === true
          ? "null!"
          : `default(${csType})`,
      referenceType:
        contract.referenceType === true,
      valueType:
        contract.valueType === true,
      globalGenericCandidate: false,
      ...(languageExactGraphType
        ? {
            languageExactType: true,
            ...(graphType.startsWith("normalExact:")
              ? { normalExactType: true }
              : {}),
            ...(graphType.startsWith("csharpExact:")
              ? { csharpExactType: true }
              : {})
          }
        : { portableApiType: true }),
      assignableTo:
        structuredClone([]),
      constraints: structuredClone(
        contract.referenceType === true
          ? ["value", "reference", "serializable"]
          : ["value", "serializable"]
      ),
      assembly: references[0]?.include || "",
      assemblies: structuredClone(
        references.map(
          reference => reference.include
        )
      ),
      assemblyReferences:
        structuredClone(references)
    });
    portableInstalledTypeIds.add(
      graphType
    );
    installed += 1;
  }
  const idsByCsTypeIdentity = new Map();
  for (const [graphType, information] of
    Object.entries(definitions)) {
    const identity = portableCsTypeIdentity(
      information?.csType || ""
    );
    if (!identity) continue;
    const ids =
      idsByCsTypeIdentity.get(identity) || [];
    ids.push(graphType);
    idsByCsTypeIdentity.set(identity, ids);
  }
  const graphTypesForCsType = csType => {
    const normalizedCsType = normalize(csType);
    const identity =
      portableCsTypeIdentity(normalizedCsType);
    const candidates = [
      ...new Set(
        idsByCsTypeIdentity.get(identity) || []
      )
    ].filter(id => definitions[id]);
    if (candidates.length > 0) {
      return candidates;
    }
    throw new Error(
      `Portable C# type '${normalizedCsType}' does not identify a graph type in the worker registry.`
    );
  };
  const graphTypeIdentity = graphType =>
    portableCsTypeIdentity(
      definitions[String(graphType || "")]
        ?.csType || ""
    );
  for (const contract of contracts) {
    const graphType = String(
      contract.graphType
    );
    const information = definitions[graphType];
    const storedTargetIdentities = [
      ...new Set(
        (Array.isArray(
          contract.assignableToCsTypes
        )
          ? contract.assignableToCsTypes
          : [])
          .map(portableCsTypeIdentity)
          .filter(Boolean)
      )
    ];
    const storedTargets =
      (Array.isArray(
        contract.assignableToCsTypes
      )
        ? contract.assignableToCsTypes
        : []).flatMap(graphTypesForCsType);
    const actualTargets = new Set(
      Array.isArray(information?.assignableTo)
        ? information.assignableTo
        : []
    );
    const actualTargetIdentities = new Set(
      [...actualTargets]
        .map(graphTypeIdentity)
        .filter(Boolean)
    );
    if (
      liveVerified &&
      !portableInstalledTypeIds.has(
        graphType
      ) &&
      storedTargetIdentities.some(identity =>
        !actualTargetIdentities.has(identity)
      )
    ) {
      throw new Error(
        `Portable graph type '${graphType}' claims inheritance absent from the verified catalog.`
      );
    }
    if (
      !liveVerified ||
      portableInstalledTypeIds.has(
        graphType
      )
    ) {
      information.assignableTo =
        structuredClone([
          ...new Set([
            ...actualTargets,
            ...storedTargets
          ])
        ]);
    }
  }
  return Object.freeze({ installed });
}

async function installPortableOperatorTransaction(
  support,
  requirements
) {
  const definitions =
    self.RMLModNodeRegistry
      ?.getNodeDefinitions?.() || {};
  const entries = requirements.filter(
    requirement =>
      [
        "snapshot",
        "portable",
        "unavailable"
      ].includes(
        String(
          requirement?.availability || ""
        )
      ) &&
      !portableContractMatchesDefinition(
        requirement?.apiContract || {},
        definitions[
          String(
            requirement?.operatorId || ""
          )
        ],
        requirement?.nodeParameters || {}
      )
  );
  const typeContracts =
    Array.isArray(
      support?.portableTypeContracts
    )
      ? support.portableTypeContracts
      : [];
  if (
    entries.length === 0 &&
    typeContracts.length === 0
  ) {
    return false;
  }
  const controller =
    self.RMLApiNodeFactoryController;
  if (
    typeof controller
      ?.createUnavailableOperatorAdmissionToken !==
        "function" ||
    typeof controller
      ?.createUnavailableOperatorTransaction !==
        "function"
  ) {
    throw new Error(
      "The graph-codegen worker has no portable direct API transaction."
    );
  }
  const planKey =
    `worker:${streamedProjectionKey(support)}`;
  const token =
    controller
      .createUnavailableOperatorAdmissionToken(
        planKey
      );
  const transaction =
    await controller
      .createUnavailableOperatorTransaction(
        entries.map(requirement => ({
          operatorId: String(
            requirement.operatorId || ""
          ),
          apiContract:
            structuredClone(
              requirement.apiContract || {}
            ),
          nodeParameters:
            structuredClone(
              requirement.nodeParameters || {}
            ),
          inputPorts: [
            ...(Array.isArray(
              requirement.inputPorts
            )
              ? requirement.inputPorts
              : [])
          ],
          outputPorts: [
            ...(Array.isArray(
              requirement.outputPorts
            )
              ? requirement.outputPorts
              : [])
          ]
        })),
        {
          token,
          planKey,
          typeContracts:
            structuredClone(
              typeContracts
            )
        }
      );
  try {
    if (
      await Promise.resolve(
        transaction.commit?.()
      ) !== true ||
      await Promise.resolve(
        transaction.verify?.()
      ) !== true
    ) {
      throw new Error(
        "The graph-codegen worker could not stage its portable API contracts exactly."
      );
    }
    return transaction;
  } catch (error) {
    transaction.rollback?.();
    throw error;
  }
}

async function installStreamedApiRequirements(support) {
  const requirements = Array.isArray(
    support?.requirements
  )
    ? support.requirements.filter(
        isScannerMemberRequirement
      )
    : [];
  const typeContracts = Array.isArray(
    support?.portableTypeContracts
  )
    ? support.portableTypeContracts
    : [];
  const contractSnapshot =
    support?.contractSnapshot;
  const snapshotMode = Boolean(
    contractSnapshot?.schemaVersion === 1 &&
    contractSnapshot?.mode ===
      "verified-contract-snapshot" &&
    String(
      contractSnapshot?.fingerprint || ""
    ).trim()
  );
  if (
    contractSnapshot &&
    !snapshotMode
  ) {
    throw new Error(
      "The graph-codegen contract snapshot is invalid."
    );
  }
  if (
    snapshotMode &&
    support?.catalog
  ) {
    throw new Error(
      "A contract snapshot cannot request catalog projection."
    );
  }
  if (
    snapshotMode &&
    requirements.some(requirement =>
      ![
        "snapshot",
        "unavailable"
      ].includes(
        String(
          requirement?.availability || ""
        )
      )
    )
  ) {
    throw new Error(
      "The graph-codegen contract snapshot contains an unbound requirement."
    );
  }
  if (
    requirements.length === 0 &&
    typeContracts.length === 0
  ) {
    return;
  }
  const definitions =
    self.RMLModNodeRegistry
      ?.getNodeDefinitions?.();
  if (!definitions) {
    throw new Error(
      "The graph-codegen worker has no graph definition registry."
    );
  }
  const hasCatalog = Boolean(
    support?.catalog &&
    (
      (
        Array.isArray(support.catalog.types) &&
        support.catalog.types.length > 0
      ) ||
      (
        Array.isArray(support.catalog.enums) &&
        support.catalog.enums.length > 0
      )
    )
  );
  const controller =
    self.RMLApiNodeFactoryController;
  const generated = Object.values(definitions)
    .filter(definition =>
      definition?.catalogGenerated === true &&
      definition?.unavailableApiContract !== true
    );
  const portableTransaction =
    await installPortableOperatorTransaction(
      support,
      requirements
    );
  const pendingAliases = new Map();
  try {
    if (
      support?.catalog &&
      self.RMLApiNodeFactoryReport
        ?.verificationPassed === true
    ) {
      installPortableTypeContracts(support);
    }
    for (const requirement of requirements) {
    const operatorId = String(
      requirement?.operatorId || ""
    );
    const contract =
      requirement?.apiContract || {};
    const availability = String(
      requirement?.availability ||
      "pending"
    );
    const requiresUnavailable =
      availability === "unavailable";
    if (requiresUnavailable) {
      if (
        portableContractMatchesDefinition(
          contract,
          definitions[operatorId],
          requirement.nodeParameters
        )
      ) {
        continue;
      }
      const exactInstalled =
        definitions[operatorId];
      if (
        exactInstalled?.unavailableApiContract ===
          true &&
        portableContractSemanticKey(
          contract
        ) ===
          portableContractSemanticKey(
            exactInstalled
              .preservedApiContract
          )
      ) {
        continue;
      }
      const installed =
        controller?.ensureUnavailableOperator?.(
          operatorId,
          contract,
          requirement
        );
      if (!installed) {
        throw new Error(
          `The portable API contract '${operatorId || "<missing>"}' could not be installed in the code-generation worker's preservation registry.`
        );
      }
      continue;
    }
    if (
      availability === "snapshot" ||
      availability === "portable"
    ) {
      if (
        !portableContractMatchesDefinition(
          contract,
          definitions[operatorId],
          requirement.nodeParameters
        )
      ) {
        throw new Error(
          `The stored API contract '${operatorId || "<missing>"}' was not installed exactly in the code-generation worker.`
        );
      }
      continue;
    }
    if (
      availability !== "verified" ||
      !hasCatalog
    ) {
      throw new Error(
        `The verified catalog support for '${operatorId || "<missing>"}' is still pending.`
      );
    }
    let definition = definitions[operatorId];
    let verifiedContract =
      portableVerifiedContractForDefinition(
      contract,
      definition,
      requirement.nodeParameters,
      true
    );
    if (!verifiedContract) {
      const canonicalId = String(
        contract.canonicalOperatorId ||
        contract.nodeId ||
        ""
      );
      const candidates = [
        definitions[canonicalId],
        ...generated
      ];
      for (const candidate of candidates) {
        const candidateContract =
          portableVerifiedContractForDefinition(
            contract,
            candidate,
            requirement.nodeParameters
          );
        if (candidateContract) {
          definition = candidate;
          verifiedContract =
            candidateContract;
          break;
        }
      }
    }
    if (!verifiedContract) {
      const readableContract =
        String(contract.signature || "").trim() ||
        `${portableContractType(contract.returnType || "System.Void")} ${portableContractType(contract.ownerType || "<unknown-owner>")}${contract.memberName ? `.${String(contract.memberName)}` : ""}(${(Array.isArray(contract.parameters) ? contract.parameters : []).map(parameter => portableContractType(parameter?.elementType || parameter?.type || "?")).join(", ")})`;
      throw new Error(
        `The projected catalog did not reproduce the verified C# contract '${readableContract}' exactly.`
      );
    }
    requirement.apiContract =
      verifiedContract;
    requirement.inputPorts =
      (Array.isArray(
        verifiedContract.inputPorts
      )
        ? verifiedContract.inputPorts
        : []).map(port =>
        String(port?.id || "")
      ).filter(Boolean);
    requirement.outputPorts =
      (Array.isArray(
        verifiedContract.outputPorts
      )
        ? verifiedContract.outputPorts
        : []).map(port =>
        String(port?.id || "")
      ).filter(Boolean);
    if (
      definition !== definitions[operatorId]
    ) {
      pendingAliases.set(
        operatorId,
        {
          expected:
            definitions[operatorId],
          definition
        }
      );
    }
    }
    for (const [operatorId, alias] of
      pendingAliases) {
      if (
        definitions[operatorId] !==
          alias.expected
      ) {
        throw new Error(
          "A registry definition changed while its verified API alias was pending."
        );
      }
    }
    if (
      portableTransaction &&
      portableTransaction.complete?.() !==
        true
    ) {
      throw new Error(
        "The graph-codegen worker could not complete its verified portable API transaction."
      );
    }
    for (const [operatorId, alias] of
      pendingAliases) {
      definitions[operatorId] =
        alias.definition;
    }
  } catch (error) {
    portableTransaction?.rollback?.();
    throw error;
  }
}

function customCSharpCatalogDefinitions(support) {
  const registered =
    self.RMLModNodeRegistry
      ?.getNodeDefinitions?.() || {};
  const definitions = Object.create(null);
  for (const operatorId of Object.keys(registered)) {
    definitions[operatorId] =
      registered[operatorId];
  }
  return definitions;
}

async function executeWorkerRequest(
  request,
  {
    support = null,
    streamResult = false
  } = {}
) {
  const requestedProgressStart = Number(
    request.options?._rmlProgressStart
  );
  const requestedProgressEnd = Number(
    request.options?._rmlProgressEnd
  );
  const customProgressStart =
    Number.isFinite(requestedProgressStart)
      ? requestedProgressStart
      : 18;
  const customProgressEnd = Math.max(
    customProgressStart,
    Number.isFinite(requestedProgressEnd)
      ? requestedProgressEnd
      : 35
  );
  const publishCustomProgress = (
    phase,
    completed,
    total,
    message
  ) => {
    const normalizedTotal = Math.max(
      1,
      Number(total) || 0
    );
    const ratio = Math.max(
      0,
      Math.min(
        1,
        (Number(completed) || 0) /
          normalizedTotal
      )
    );
    const phaseRange =
      phase === "transfer"
        ? [0.9, 1]
        : phase === "layout"
          ? [0.68, 0.9]
          : [0, 0.68];
    const operationRatio =
      phaseRange[0] +
      (phaseRange[1] - phaseRange[0]) *
        ratio;
    self.postMessage({
      id: request.id,
      progress: true,
      graphProgress:
        customProgressStart +
        (
          customProgressEnd -
          customProgressStart
        ) * operationRatio,
      workPhase: String(phase || "build"),
      workCompleted: Math.max(
        0,
        Number(completed) || 0
      ),
      workTotal: normalizedTotal,
      message
    });
  };
  self.postMessage({
    id: request.id,
    progress: true,
    graphProgress:
      request.operation === "buildCustomCSharp"
        ? customProgressStart
        : 22,
    message:
      window.RMLI18n.t("ui.auto.36f701593e50")
  });
  const catalog = support
    ? support.catalog
    : request.catalog;
  await ensureRuntime(
    catalog,
    support
      ? streamedProjectionKey(support)
      : ""
  );
  if (support) {
    await installStreamedApiRequirements(
      support
    );
  }

  if (request.operation === "analyze") {
    self.postMessage({
      id: request.id,
      progress: true,
      message:
        window.RMLI18n.t("ui.auto.3a99773b7013")
    });
    const validation =
      self.RMLTypedNodeGraphGenerator
        .validateDocument({
          state: request.state || {}
        });
    self.postMessage({
      id: request.id,
      ok: validation?.valid === true,
      result: validation,
      error:
        validation?.valid === true
          ? null
          : {
              name: "GraphAnalysisError",
              message:
                validation?.diagnostics?.[0] ||
                "The Runtime Graph is invalid."
            }
    });
    return;
  }

  if (request.operation === "buildCustomCSharp") {
    publishCustomProgress(
      "syntax",
      0,
      1,
      window.RMLI18n.t("ui.auto.82a8e160d9b2")
    );
    const visualCSharp = self.RMLVisualCSharp;
    const customOptions = {
      ...(request.options || {}),
      ...(
        support
          ? {
              catalogDefinitions:
                customCSharpCatalogDefinitions(
                  support
                )
            }
          : {}
      ),
      onProgress(detail = {}) {
        publishCustomProgress(
          detail.phase,
          detail.completed,
          detail.total,
          detail.phase === "layout"
            ? window.RMLI18n.t("ui.auto.82f6127f8e01")
            : window.RMLI18n.t("ui.auto.82a8e160d9b2")
        );
      }
    };
    const fragment = visualCSharp?.createRoslynImportFragment?.(
      String(request.source || ""),
      request.parseResult,
      customOptions
    );
    publishCustomProgress(
      "layout",
      1,
      1,
      window.RMLI18n.t("ui.auto.82f6127f8e01")
    );
    if (streamResult) {
      postStreamedBuildResult(
        request.id,
        fragment,
        detail =>
          publishCustomProgress(
            "transfer",
            detail.completed,
            detail.total,
            window.RMLI18n.t("ui.auto.82f6127f8e01")
          )
      );
    } else {
      self.postMessage({
        id: request.id,
        ok: fragment?.ok === true,
        result: fragment,
        error: fragment?.ok === true
          ? null
          : {
              name: "CustomCSharpBuildError",
              message:
                fragment?.diagnostics?.[0] ||
                "The Custom C# graph could not be built."
            }
      });
    }
    return;
  }

  if (!self.RMLCodeTemplates) {
    importScripts(
      "../core/code_templates.js?v=797-readable-visual-functions-node-index&outline-optional=1"
    );
  }
  for (const pack of request.templates || []) {
    self.RMLCodeTemplates.install(
      pack.package,
      pack
    );
  }
  await self.RMLCodeTemplates.ensure([
    "runtime",
    "nodes",
    "api"
  ]);

  const metadata = request.state?.metadata ||
    request.state?.extensions?.typedNodeGraph
      ?.configSnapshot?.metadata || {};
  if (metadata.includeGuide === true) {
    if (!self.RMLGuidance) {
      importScripts("../core/guidance.js?v=793&outline-optional=1");
    }
    if (request.guidance) {
      self.RMLGuidance.install(
        "runtime",
        request.guidance
      );
    }
    await self.RMLGuidance.ensure(["runtime"]);
  }
  const result =
    self.RMLTypedNodeGraphGenerator.build({
      state: request.state || {},
      entries: Array.isArray(request.entries)
        ? request.entries
        : [],
      analysisCertificate:
        request.analysisCertificate || null,
      trustedAnalysisTransfer: true
    });

  if (streamResult) {
    postStreamedBuildResult(request.id, result);
  } else {
    self.postMessage({
      id: request.id,
      ok: true,
      result
    });
  }
}

function postWorkerRequestError(id, error) {
  self.postMessage({
    id,
    ok: false,
    error: {
      name:
        error instanceof Error
          ? error.name
          : "Error",
      message:
        error instanceof Error
          ? error.message
          : String(error),
      stack:
        error instanceof Error
          ? error.stack || ""
          : "",
    }
  });
}

self.addEventListener("message", event => {
  const request = event.data || {};
  const operation = String(
    request.operation || ""
  );

  if (operation === "streamCancel") {
    streamedBuildRequests.delete(request.id);
    return;
  }
  if (operation === "streamStart") {
    let record =
      streamedBuildRequests.get(request.id);
    if (!record) {
      record = {
        decoders: new Map(),
        values: new Map()
      };
      streamedBuildRequests.set(
        request.id,
        record
      );
    }
    record.decoders.set(
      String(request.channel || ""),
      streamDecoder()
    );
    return;
  }
  if (operation === "streamChunk") {
    try {
      const record =
        streamedBuildRequests.get(request.id);
      const decoder = record?.decoders.get(
        String(request.channel || "")
      );
      if (!decoder) {
        throw new Error(
          "Graph code-generation stream chunk has no open channel."
        );
      }
      decodeStreamTokens(
        decoder,
        request.tokens
      );
    } catch (error) {
      streamedBuildRequests.delete(request.id);
      postWorkerRequestError(request.id, error);
    }
    return;
  }
  if (operation === "streamEnd") {
    try {
      const record =
        streamedBuildRequests.get(request.id);
      const channel = String(
        request.channel || ""
      );
      const decoder = record?.decoders.get(channel);
      if (!record || !decoder) {
        throw new Error(
          "Graph code-generation stream ended without an open channel."
        );
      }
      record.values.set(
        channel,
        finishStreamDecoder(decoder)
      );
      record.decoders.delete(channel);
    } catch (error) {
      streamedBuildRequests.delete(request.id);
      postWorkerRequestError(request.id, error);
    }
    return;
  }
  if (operation === "buildStreamCommit") {
    const record =
      streamedBuildRequests.get(request.id);
    streamedBuildRequests.delete(request.id);
    void (async () => {
      try {
        const payload = record?.values.get("payload");
        const support = record?.values.get("support");
        if (!payload || !support) {
          throw new Error(
            "The streamed graph code-generation request is incomplete."
          );
        }
        await executeWorkerRequest(
          {
            id: request.id,
            operation: "build",
            ...payload
          },
          {
            support,
            streamResult: true
          }
        );
      } catch (error) {
        postWorkerRequestError(request.id, error);
      }
    })();
    return;
  }
  if (operation === "customCSharpStreamCommit") {
    const record =
      streamedBuildRequests.get(request.id);
    streamedBuildRequests.delete(request.id);
    void (async () => {
      try {
        const payload =
          record?.values.get("payload");
        const support =
          record?.values.get("support");
        if (!payload || !support) {
          throw new Error(
            "The streamed Custom C# request is incomplete."
          );
        }
        await executeWorkerRequest(
          {
            id: request.id,
            operation: "buildCustomCSharp",
            ...payload
          },
          {
            support,
            streamResult: true
          }
        );
      } catch (error) {
        postWorkerRequestError(
          request.id,
          error
        );
      }
    })();
    return;
  }

  if (![
    "analyze",
    "build",
    "buildCustomCSharp"
  ].includes(operation)) {
    return;
  }
  void executeWorkerRequest(request)
    .catch(error =>
      postWorkerRequestError(request.id, error)
    );
});
