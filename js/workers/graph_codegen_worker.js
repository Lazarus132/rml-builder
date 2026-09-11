"use strict";
// RML Builder workers: graph_codegen_worker.

const GRAPH_CODEGEN_WORKER_MODULE_ID =
  "1.20.31-universal-presentation-dev27";
const GRAPH_CODEGEN_WORKER_FACTORY_VERSION =
  38;

self.window = self;
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
  return {
    ancestors: new WeakSet(),
    frames: [],
    pending: true,
    pendingValue: value,
    pendingLongKeyValue: undefined,
    code: 0,
    value: undefined
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

function postStreamedBuildResult(id, result) {
  const cursor = resultStreamCursor(result);
  self.postMessage({
    id,
    operation: "resultStart"
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
        tokens
      });
    }
  }
  self.postMessage({
    id,
    operation: "resultEnd"
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
      "../graph/node_graph_registry.js?v=1-physical-modules-v748"
    );
    importScripts(
      "../catalog/mod_nodes.js?v=794-shared-loader-runtime"
    );
    importScripts(
      "../compiler/visual_csharp.js?v=83-empty-custom-csharp-ignored"
    );
    importScripts(
      "../catalog/api_nodes.js?v=1.20.31-universal-presentation-dev27"
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
    const factoryReport =
      self.RMLApiNodeFactoryReport;
    const activeFactoryVersion = Number(
      self.__RMLApiNodeFactoryVersion
    );
    if (
      factoryController?.moduleId !==
        GRAPH_CODEGEN_WORKER_MODULE_ID ||
      Number(
        factoryController?.factoryVersion
      ) !==
        GRAPH_CODEGEN_WORKER_FACTORY_VERSION ||
      (
        hasCatalog &&
        (
          activeFactoryVersion !==
            GRAPH_CODEGEN_WORKER_FACTORY_VERSION ||
          factoryReport?.moduleId !==
            GRAPH_CODEGEN_WORKER_MODULE_ID ||
          Number(factoryReport?.factoryVersion) !==
            GRAPH_CODEGEN_WORKER_FACTORY_VERSION
        )
      )
    ) {
      throw new Error(
        `Runtime module version mismatch in graph-codegen worker: API factory v${activeFactoryVersion || 0} cannot be used with ${GRAPH_CODEGEN_WORKER_MODULE_ID} (factory v${GRAPH_CODEGEN_WORKER_FACTORY_VERSION} required). Reload the Builder without cached files.`
      );
    }

    importScripts(
      "../graph/node_graph_codegen.js?v=1.20.31-universal-presentation-dev27"
    );

    if (
      !self.RMLTypedNodeGraphGenerator ||
      self.RMLTypedNodeGraphGenerator
        .moduleId !==
        GRAPH_CODEGEN_WORKER_MODULE_ID ||
      typeof self.RMLTypedNodeGraphGenerator.build !==
        "function"
    ) {
      throw new Error(
        `Runtime module version mismatch in graph-codegen worker: the typed graph generator is not the ${GRAPH_CODEGEN_WORKER_MODULE_ID} module. Reload the Builder without cached files.`
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
    Number(self.__RMLApiNodeFactoryVersion) !==
      GRAPH_CODEGEN_WORKER_FACTORY_VERSION ||
    report?.moduleId !==
      GRAPH_CODEGEN_WORKER_MODULE_ID ||
    Number(report?.factoryVersion) !==
      GRAPH_CODEGEN_WORKER_FACTORY_VERSION ||
    report?.verificationPassed !== true
  ) {
    throw new Error(
      "The graph-codegen worker could not verify its projected API factory."
    );
  }
  runtimeProjectionKey = requestedProjectionKey;

  return runtimeReady;
}

function streamedProjectionKey(support) {
  const catalog = support?.catalog;
  const requirements = Array.isArray(
    support?.requirements
  )
    ? support.requirements
    : [];
  return [
    catalog?.catalogFingerprint ||
      catalog?.assemblyFingerprint ||
      "offline",
    ...requirements.map(requirement => {
      const contract = requirement?.apiContract || {};
      return [
        requirement?.operatorId || "",
        contract.contractFingerprint || "",
        contract.stableContractId || "",
        contract.kind || "",
        contract.ownerType || "",
        contract.memberName || "",
        contract.signature || ""
      ].join("\u0000");
    }).sort()
  ].join("\u0001");
}

function portableNormalizeCsType(value) {
  return String(value || "")
    .trim()
    .replace(/^global::/, "")
    .replace(/\s+/g, " ");
}

function portableContractMatchesDefinition(
  contract,
  definition
) {
  const available = definition?.apiVerification;
  if (
    !available ||
    definition?.catalogGenerated !== true ||
    definition?.unavailableApiContract === true
  ) {
    return false;
  }
  const expectedFingerprint = String(
    contract?.contractFingerprint || ""
  );
  const availableFingerprint = String(
    available.contractFingerprint || ""
  );
  if (expectedFingerprint && availableFingerprint) {
    return expectedFingerprint === availableFingerprint;
  }
  const expectedKind = String(contract?.kind || "");
  const expectedMemberName = String(
    contract?.memberName || ""
  );
  const memberNameMayBeEmpty =
    expectedKind === "type" ||
    expectedKind === "enum";
  const expectedOwnerType = portableNormalizeCsType(
    contract?.ownerType
  );
  return Boolean(
    expectedKind &&
    expectedKind ===
      String(available.kind || "") &&
    expectedOwnerType &&
    expectedOwnerType === portableNormalizeCsType(
      available.ownerType
    ) &&
    (memberNameMayBeEmpty || expectedMemberName) &&
    expectedMemberName ===
      String(available.memberName || "") &&
    String(contract?.signature || "") &&
    String(contract?.signature || "") ===
      String(available.signature || "")
  );
}

function installStreamedApiRequirements(support) {
  const requirements = Array.isArray(
    support?.requirements
  )
    ? support.requirements
    : [];
  if (requirements.length === 0) return;
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
  for (const requirement of requirements) {
    const operatorId = String(
      requirement?.operatorId || ""
    );
    const contract =
      requirement?.apiContract || {};
    const requiresUnavailable =
      !hasCatalog ||
      requirement?.availability ===
        "unavailable";
    if (requiresUnavailable) {
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
    let definition = definitions[operatorId];
    if (!portableContractMatchesDefinition(
      contract,
      definition
    )) {
      const canonicalId = String(
        contract.canonicalOperatorId ||
        contract.nodeId ||
        ""
      );
      definition =
        definitions[canonicalId] ||
        generated.find(candidate =>
          portableContractMatchesDefinition(
            contract,
            candidate
          )
        );
      if (
        definition &&
        portableContractMatchesDefinition(
          contract,
          definition
        )
      ) {
        definitions[operatorId] = definition;
      }
    }
    if (!portableContractMatchesDefinition(
      contract,
      definitions[operatorId]
    )) {
      throw new Error(
        `The projected catalog did not reproduce verified operator '${operatorId}' exactly.`
      );
    }
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

  const typeNames = Array.isArray(
    support?.catalogTypeNames
  )
    ? support.catalogTypeNames
    : [];
  if (typeNames.length === 0) {
    return definitions;
  }
  const verified =
    (Array.isArray(support?.requirements)
      ? support.requirements
      : [])
      .map(requirement =>
        requirement?.apiContract
      )
      .find(contract =>
        contract?.catalogSource === "scanner" &&
        String(
          contract?.catalogFingerprint || ""
        ).trim()
      );
  if (!verified) {
    return definitions;
  }




  for (let index = 0; index < typeNames.length; index += 1) {
    const typeName = String(
      typeNames[index] || ""
    ).trim();
    if (!typeName) continue;
    definitions[
      `__rml_custom_csharp_type_index_${index}`
    ] = {
      catalogGenerated: true,
      customCSharpCatalogNode: true,
      catalogType: typeName,
      catalogMember: "",
      apiMemberKind: "type-index",
      apiReturnType: "",
      apiParameters: [],
      apiVerification: {
        catalogSource: "scanner",
        catalogFingerprint:
          verified.catalogFingerprint
      }
    };
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
  self.postMessage({
    id: request.id,
    progress: true,
    message:
      "Worker: loading Custom C# node modules…"
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
    installStreamedApiRequirements(support);
  }

  if (request.operation === "analyze") {
    self.postMessage({
      id: request.id,
      progress: true,
      message:
        "Worker: validating Runtime Graph connections…"
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
    self.postMessage({
      id: request.id,
      progress: true,
      message:
        "Worker: building optimized syntax graph…"
    });
    const visualCSharp = self.RMLVisualCSharp;
    const customOptions = support
      ? {
          ...(request.options || {}),
          catalogDefinitions:
            customCSharpCatalogDefinitions(
              support
            )
        }
      : request.options || {};
    const fragment = visualCSharp?.createRoslynImportFragment?.(
      String(request.source || ""),
      request.parseResult,
      customOptions
    );
    self.postMessage({
      id: request.id,
      progress: true,
      message:
        "Worker: finalizing optimized syntax graph…"
    });
    if (streamResult) {
      postStreamedBuildResult(
        request.id,
        fragment
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
      "../core/code_templates.js?v=794-shared-loader-runtime"
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
      importScripts("../core/guidance.js?v=793");
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
          : ""
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
