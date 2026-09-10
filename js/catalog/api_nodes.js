(() => {
  "use strict";

  const API_FACTORY_MODULE_ID =
    "1.20.31-universal-presentation-dev23";
  const FACTORY_VERSION = 38;
  const API_VERIFICATION_SCHEMA_VERSION = 3;
  const CATALOG_PROJECTION_INDEX_VERSION = 1;
  const ADVANCED_GROUP = "Advanced / Raw C#";
  const UNAVAILABLE_GROUP = "Unavailable API";
  const API_GROUPS = Object.freeze({
    types: "API · Types & Enums",
    constructors: "API · Constructors",
    methods: "API · Methods",
    properties: "API · Properties",
    fields: "API · Fields",
    events: "API · Events"
  });

  let prerequisiteWaitInstalled = false;
  let factoryBuildPromise = null;
  let factoryOperationPromise =
    Promise.resolve();
  let factoryOperationEpoch = 0;
  let activeFactoryOperationLease = null;
  let compatibleLegacyAliasRevision = 0;
  const portableAdmissionRecords =
    new WeakMap();
  let legacyOperatorResolver = null;
  let activeReloadSafetyContractCompatible = false;
  let factoryReadySettled = false;
  let factoryRegistryIntegrityCache = null;
  let resolveFactoryReady;
  const catalogProjectionIndexByReport =
    new WeakMap();
  const catalogProjectionCustomStateByIndex =
    new WeakMap();

  const factoryReady =
    new Promise(resolve => {
      resolveFactoryReady = resolve;
    });

  Object.defineProperty(
    window,
    "RMLApiNodeFactoryReady",
    {
      value: factoryReady,
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  function completeFactoryReady(report) {
    if (!factoryReadySettled) {
      factoryReadySettled = true;
      resolveFactoryReady?.(report || null);
    }

    return report || null;
  }

  function queueFactoryOperation(
    operation,
    kind = "factory-operation"
  ) {
    const run = async () => {
      const lease = Object.freeze({
        epoch:
          factoryOperationEpoch + 1,
        kind: String(kind ||
          "factory-operation"),
        token: Object.freeze({})
      });
      factoryOperationEpoch =
        lease.epoch;
      activeFactoryOperationLease =
        lease;
      try {
        return await operation(lease);
      } finally {
        if (
          activeFactoryOperationLease ===
            lease
        ) {
          activeFactoryOperationLease =
            null;
        }
      }
    };
    const queued =
      factoryOperationPromise.then(
        run,
        run
      );
    factoryOperationPromise =
      queued.catch(() => null);
    return queued;
  }

  function assertFactoryOperationLease(
    lease,
    action
  ) {
    if (
      !lease ||
      activeFactoryOperationLease !== lease
    ) {
      throw new Error(
        `The API node factory lease expired before ${String(action || "the registry operation")}.`
      );
    }
  }

  function acquireFactoryOperationLease(
    kind,
    createValue
  ) {
    let resolveAcquired;
    let rejectAcquired;
    let acquiredSettled = false;
    const acquired = new Promise(
      (resolve, reject) => {
        resolveAcquired = resolve;
        rejectAcquired = reject;
      }
    );

    const queued = queueFactoryOperation(
      async lease => {
        let releaseLease;
        let released = false;
        const releasedPromise =
          new Promise(resolve => {
            releaseLease = () => {
              if (released) return false;
              released = true;
              resolve();
              return true;
            };
          });
        try {
          const value = createValue(
            lease,
            releaseLease
          );
          acquiredSettled = true;
          resolveAcquired(value);
          await releasedPromise;
        } catch (error) {
          if (!acquiredSettled) {
            acquiredSettled = true;
            rejectAcquired(error);
          }
          releaseLease?.();
          throw error;
        }
      },
      kind
    );
    queued.catch(() => null);
    return acquired;
  }

  function apiCatalogIdentity(catalog) {
    return [
      String(
        catalog?.catalogFingerprint ||
        catalog?.assemblyFingerprint ||
        ""
      ),
      String(
        catalog?.engineVersion ||
        ""
      )
    ].join("|");
  }

  // Graph-codegen deliberately uses a slightly less opinionated type
  // normalizer than the graph registry: a nullable suffix is meaningful to
  // catalog projection even though the registry usually resolves it to the
  // underlying graph type. Keep this identity local to the index so moving
  // projection preparation off the interaction path does not change which
  // catalog rows are selected.
  function catalogProjectionTypeName(value) {
    return String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, " ");
  }

  function catalogProjectionGenericShape(value) {
    const text =
      catalogProjectionTypeName(value);
    const open = text.indexOf("<");
    if (open < 0) return "";
    let depth = 0;
    let close = -1;
    let argumentsCount = 1;
    for (
      let index = open;
      index < text.length;
      index += 1
    ) {
      const character = text[index];
      if (character === "<") {
        depth += 1;
      } else if (character === ">") {
        depth -= 1;
        if (depth === 0) {
          close = index;
          break;
        }
      } else if (
        character === "," &&
        depth === 1
      ) {
        argumentsCount += 1;
      }
    }
    if (close < 0) return "";
    return [
      text.slice(0, open)
        .replace(/\s+/g, ""),
      text.slice(close + 1)
        .replace(/\s+/g, ""),
      argumentsCount
    ].join("|");
  }

  function rememberCatalogProjectionRow(
    map,
    name,
    row,
    index
  ) {
    if (!name) return;
    const current = map.get(name);
    if (current) {
      if (!current.occurrences) {
        current.occurrences = [
          Object.freeze({
            row: current.row,
            index: current.index
          })
        ];
      }
      current.row = row;
      current.index = index;
      current.occurrences.push(
        Object.freeze({ row, index })
      );
      return;
    }
    map.set(name, {
      row,
      index,
      occurrences: null
    });
  }

  function catalogProjectionLookup(map) {
    return Object.freeze({
      has(key) {
        return map.has(key);
      },
      get(key) {
        return map.get(key);
      }
    });
  }

  function customCSharpCatalogShortType(value) {
    let type = String(value || "")
      .replace(/global::/g, "")
      .trim();
    while (type.endsWith("?")) {
      type = type.slice(0, -1).trim();
    }
    return type
      .replace(/<.*>$/, "")
      .split(".")
      .at(-1);
  }

  function createCatalogProjectionCustomState(
    source = null
  ) {
    return {
      byIdentifier:
        new Map(
          source
            ? [...source.byIdentifier]
                .map(([identifier, candidates]) => [
                  identifier,
                  [...candidates]
                ])
            : []
        ),
      indexer:
        source ? [...source.indexer] : [],
      catalogTypeNames:
        new Set(
          source
            ? source.catalogTypeNames
            : []
        ),
      nextOrder:
        source
          ? Math.max(
              0,
              Number(source.nextOrder) || 0
            )
          : 0
    };
  }

  function appendCatalogProjectionCustomDefinition(
    state,
    operatorId,
    definition
  ) {
    const contract =
      definition?.apiVerification;
    if (
      definition?.catalogGenerated !== true ||
      definition?.customCSharpCatalogNode !== true ||
      contract?.catalogSource !== "scanner" ||
      !String(
        contract?.catalogFingerprint || ""
      ).trim()
    ) {
      return false;
    }

    for (const type of [
      definition.catalogType,
      definition.apiReturnType,
      ...(Array.isArray(
        definition.apiParameters
      )
        ? definition.apiParameters
            .flatMap(parameter => [
              parameter?.type,
              parameter?.elementType
            ])
        : [])
    ]) {
      const value = String(type || "").trim();
      if (value) {
        state.catalogTypeNames.add(value);
      }
    }

    const kind = String(
      definition.apiMemberKind || ""
    );
    if (![
      "method",
      "constructor",
      "property-get",
      "property-set",
      "field-get",
      "field-set",
      "type"
    ].includes(kind)) {
      return true;
    }

    const memberName = String(
      definition.catalogMember || ""
    ).replace(/^@/, "");
    const identifiers = new Set();
    if (
      kind === "type" ||
      kind === "constructor"
    ) {
      const ownerName =
        customCSharpCatalogShortType(
          definition.catalogType
        );
      if (ownerName) {
        identifiers.add(ownerName);
      }
    }
    if (memberName) {
      identifiers.add(memberName);
    }

    const requirement = Object.freeze({
      operatorId,
      apiContract:
        definition.apiVerification,
      availability: "verified",
      inputPorts:
        Object.freeze(
          (Array.isArray(definition.inputs)
            ? definition.inputs
            : [])
            .map(port =>
              String(port?.id || "")
            )
            .filter(Boolean)
        ),
      outputPorts:
        Object.freeze(
          (Array.isArray(definition.outputs)
            ? definition.outputs
            : [])
            .map(port =>
              String(port?.id || "")
            )
            .filter(Boolean)
        )
    });
    const candidate = Object.freeze({
      order: state.nextOrder,
      operatorId,
      requirement
    });
    state.nextOrder += 1;

    for (const identifier of identifiers) {
      const candidates =
        state.byIdentifier.get(identifier) || [];
      candidates.push(candidate);
      state.byIdentifier.set(
        identifier,
        candidates
      );
    }
    if (memberName === "Item") {
      state.indexer.push(candidate);
    }
    return true;
  }

  function catalogProjectionCustomLookup(state) {
    const byIdentifier = new Map(
      [...state.byIdentifier]
        .map(([identifier, candidates]) => [
          identifier,
          Object.freeze([...candidates])
        ])
    );
    const indexer = Object.freeze([
      ...state.indexer
    ]);

    return Object.freeze({
      has(identifier) {
        return byIdentifier.has(identifier);
      },
      get(identifier) {
        return byIdentifier.get(identifier);
      },
      indexer,
      select(identifiers, hasIndexer = false) {
        const selected = new Map();
        for (const identifier of identifiers || []) {
          for (const candidate of
            byIdentifier.get(identifier) || []) {
            selected.set(
              candidate.operatorId,
              candidate
            );
          }
        }
        if (hasIndexer) {
          for (const candidate of indexer) {
            selected.set(
              candidate.operatorId,
              candidate
            );
          }
        }
        return Object.freeze(
          [...selected.values()]
            .sort((left, right) =>
              left.order - right.order
            )
            .map(candidate =>
              candidate.requirement
            )
        );
      }
    });
  }

  function completeCatalogProjectionIndex(
    baseIndex,
    state,
    definitionRevision
  ) {
    const index = Object.freeze({
      ...baseIndex,
      definitionRevision:
        Math.max(
          0,
          Number(definitionRevision) || 0
        ),
      customCSharpByIdentifier:
        catalogProjectionCustomLookup(state),
      catalogTypeNames:
        Object.freeze([
          ...state.catalogTypeNames
        ])
    });
    catalogProjectionCustomStateByIndex.set(
      index,
      state
    );
    return index;
  }

  function refreshPublishedCatalogProjectionIndex(
    definitionEntries = []
  ) {
    const current =
      window.RMLApiCatalogProjectionIndex;
    const state =
      catalogProjectionCustomStateByIndex.get(
        current
      );
    const catalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    const report =
      window.RMLApiNodeFactoryReport || null;
    if (
      !current ||
      !state ||
      current.catalog !== catalog ||
      current.report !== report ||
      String(current.catalogFingerprint || "") !==
        String(
          report?.catalogFingerprint || ""
        ) ||
      Number(current.revision) !==
        Number(
          report?.catalogProjectionRevision
        )
    ) {
      return false;
    }

    const nextState =
      createCatalogProjectionCustomState(state);
    for (const [operatorId, definition] of
      definitionEntries) {
      appendCatalogProjectionCustomDefinition(
        nextState,
        operatorId,
        definition
      );
    }
    const next = completeCatalogProjectionIndex(
      current,
      nextState,
      Number(
        window.__RMLNodeDefinitionRevision
      ) || 0
    );
    publishCatalogProjectionIndex(next);
    catalogProjectionIndexByReport.set(
      report,
      next
    );
    return true;
  }

  function replacePublishedFactoryReport(
    expectedReport,
    nextReport
  ) {
    if (
      !expectedReport ||
      !nextReport ||
      typeof expectedReport !== "object" ||
      typeof nextReport !== "object" ||
      window.RMLApiNodeFactoryReport !==
        expectedReport
    ) {
      return false;
    }
    if (expectedReport === nextReport) {
      return true;
    }

    const current =
      window.RMLApiCatalogProjectionIndex;
    const state =
      catalogProjectionCustomStateByIndex.get(
        current
      );
    const catalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    if (
      !current ||
      !state ||
      current.catalog !== catalog ||
      current.report !== expectedReport ||
      nextReport.verificationPassed !== true ||
      String(
        nextReport.catalogFingerprint || ""
      ) !==
        String(
          current.catalogFingerprint || ""
        ) ||
      String(nextReport.engineVersion || "") !==
        String(current.engineVersion || "") ||
      Number(
        nextReport.catalogProjectionRevision
      ) !== Number(current.revision)
    ) {
      return false;
    }

    const nextIndex = Object.freeze({
      ...current,
      report: nextReport
    });
    catalogProjectionCustomStateByIndex.set(
      nextIndex,
      state
    );
    window.RMLApiNodeFactoryReport =
      nextReport;
    publishCatalogProjectionIndex(nextIndex);
    catalogProjectionIndexByReport.set(
      nextReport,
      nextIndex
    );
    return true;
  }

  function publishCatalogProjectionIndex(index) {
    Object.defineProperty(
      window,
      "RMLApiCatalogProjectionIndex",
      {
        value: index,
        writable: false,
        enumerable: false,
        configurable: true
      }
    );
  }

  function portablePortRole(kind, direction, port, parameters = []) {
    const explicit = String(port?.role || port?.roleKey || "").trim();
    if (explicit) return explicit;
    const id = String(port?.id || "").trim();
    const fixed = new Set([
      "call", "done", "success", "exception", "target", "result", "value"
    ]);
    if (fixed.has(id)) return `${direction}:${id}`;
    let match = /^arg(\d+)$/.exec(id);
    if (match) return `parameter:${Number(match[1])}:input`;
    match = /^out(\d+)$/.exec(id);
    if (match) return `parameter:${Number(match[1])}:output`;
    match = /^generic(\d+)$/.exec(id);
    if (match) return `generic:${Number(match[1])}:input`;
    const parameter = parameters.find(value =>
      String(value?.name || "") === id
    );
    if (parameter) {
      return `parameter:${Math.max(0, Number(parameter.position) || 0)}:${direction}`;
    }
    return `${String(kind || "api")}:${direction}:${id}`;
  }

  function stableContractId(contract) {
    if (!contract || typeof contract !== "object") return "";
    const supplied = String(contract.stableContractId || "").trim();
    if (supplied) return supplied;
    const ownerType = String(contract.ownerType || "")
      .replace(/^global::/, "")
      .replace(/\s+/g, "")
      .replace(/&$/, "");
    const kind = String(contract.kind || "").trim();
    if (!ownerType || !kind) return "";
    return `contract.${stableHash(JSON.stringify({
      version: 1,
      ownerType,
      kind,
      memberName: String(contract.memberName || ""),
      isStatic: contract.isStatic === true,
      genericArity: Math.max(0, Number(contract.genericArity) || 0)
    }))}`;
  }

  function normalizeReloadSafety(value) {
    const source =
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
        ? value
        : {};
    const requestedLevel = String(
      source.level || "unknown"
    ).toLowerCase();
    const level = [
      "safe",
      "conditional",
      "unsafe",
      "unknown"
    ].includes(requestedLevel)
      ? requestedLevel
      : "unknown";

    return Object.freeze({
      ruleVersion: Math.max(
        0,
        Number(source.ruleVersion) || 0
      ),
      level,
      confidence: String(
        source.confidence || "unknown"
      ),
      operation: String(
        source.operation || ""
      ).trim(),
      classificationBasis: String(
        source.classificationBasis || ""
      ).trim(),
      requiresExecutionProof:
        source.requiresExecutionProof === true,
      requiresUseSiteResolution:
        source.requiresUseSiteResolution === true,
      useSiteInputs: Object.freeze(
        [...new Set(
          (Array.isArray(source.useSiteInputs)
            ? source.useSiteInputs
            : [])
            .map(input =>
              String(input || "").trim()
            )
            .filter(Boolean)
        )].sort()
      ),
      reasons: Object.freeze(
        [...new Set(
          (Array.isArray(source.reasons)
            ? source.reasons
            : [])
            .map(reason =>
              String(reason || "").trim()
            )
            .filter(Boolean)
        )].sort()
      ),
      requiredCleanup: Object.freeze(
        [...new Set(
          (Array.isArray(source.requiredCleanup)
            ? source.requiredCleanup
            : [])
            .map(requirement =>
              String(requirement || "").trim()
            )
            .filter(Boolean)
        )].sort()
      ),
      retainsCallerObjects:
        source.retainsCallerObjects === true
          ? true
          : source.retainsCallerObjects === false
            ? false
            : null
    });
  }

  function normalizeThreadAffinity(
    member,
    owner
  ) {
    const requested = String(
      member?.threadAffinity ||
      owner?.threadAffinity ||
      "unknown"
    ).toLowerCase();

    return [
      "any",
      "world",
      "render",
      "main",
      "unknown"
    ].includes(requested)
      ? requested
      : "unknown";
  }

  function withReloadContract(
    definition,
    owner,
    safety,
    options = {}
  ) {
    const effectiveSafety =
      activeReloadSafetyContractCompatible
        ? safety
        : {
            level: "unknown",
            confidence: "unknown",
            reasons: [
              "reload-safety-contract-incompatible"
            ]
          };

    return {
      ...definition,
      apiThreadAffinity:
        normalizeThreadAffinity(
          options.member,
          owner
        ),
      apiReloadSafety:
        normalizeReloadSafety(effectiveSafety),
      apiReloadCleanupCapabilities:
        Object.freeze(
          [...new Set(
            (Array.isArray(
              options.cleanupCapabilities
            )
              ? options.cleanupCapabilities
              : [])
              .map(value =>
                String(value || "").trim()
              )
              .filter(Boolean)
          )].sort()
        ),
      apiReloadAutomaticCleanup:
        Object.freeze(
          [...new Set(
            (Array.isArray(
              options.automaticCleanup
            )
              ? options.automaticCleanup
              : [])
              .map(value =>
                String(value || "").trim()
              )
              .filter(Boolean)
          )].sort()
        )
    };
  }

  function exactApiSemanticContractKey(contract) {
    if (
      !contract ||
      typeof contract !== "object" ||
      Array.isArray(contract)
    ) {
      return "";
    }

    const normalizeType = value =>
      String(value || "System.Object")
        .replace(/^global::/, "")
        .replace(/\s+/g, "")
        .replace(/&$/, "");
    const ownerType = normalizeType(
      contract.ownerType
    );
    const kind = String(
      contract.kind || ""
    ).trim();
    if (!ownerType || !kind) {
      return "";
    }

    return JSON.stringify({
      kind,
      ownerType,
      memberName: String(
        contract.memberName || ""
      ),
      parameters:
        (Array.isArray(contract.parameters)
          ? contract.parameters
          : []).map((parameter, index) => ({
          position: Math.max(
            0,
            Number(parameter?.position) || index
          ),
          type: normalizeType(
            parameter?.elementType ||
            parameter?.type
          ),
          isByRef:
            parameter?.isByRef === true,
          isOut:
            parameter?.isOut === true
        })),
      returnType: normalizeType(
        contract.returnType ||
        "System.Void"
      ),
      isStatic:
        contract.isStatic === true,
      genericArity: Math.max(
        0,
        Number(contract.genericArity) || 0
      )
    });
  }

  function exactPortableContractKey(
    contract
  ) {
    const semantic =
      exactApiSemanticContractKey(
        contract
      );
    if (!semantic) return "";
    const normalizePorts = (
      direction,
      key
    ) => (
      Array.isArray(contract?.[key])
        ? contract[key]
        : []
    ).map(port => ({
      id: String(port?.id || "").trim(),
      type: String(
        port?.type || ""
      ).trim(),
      typeVar: String(
        port?.typeVar || ""
      ).trim(),
      generic:
        port?.generic === true,
      optional:
        port?.optional === true,
      role: portablePortRole(
        contract?.kind,
        direction,
        port,
        contract?.parameters
      )
    }));

    return JSON.stringify({
      semantic,
      signature: String(
        contract?.signature || ""
      ).trim(),
      runtimeBound:
        contract?.runtimeBound === true,
      inputPorts: normalizePorts(
        "input",
        "inputPorts"
      ),
      outputPorts: normalizePorts(
        "output",
        "outputPorts"
      )
    });
  }

  function normalizedPortableCsType(
    value
  ) {
    return String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, " ")
      .replace(/\?$/, "");
  }

  function portableGenericTypeParts(
    value
  ) {
    const text =
      normalizedPortableCsType(value);
    const start = text.indexOf("<");
    if (start <= 0) return null;
    let depth = 0;
    let end = -1;
    for (
      let index = start;
      index < text.length;
      index += 1
    ) {
      if (text[index] === "<") {
        depth += 1;
      } else if (text[index] === ">") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end < 0) return null;
    const argumentsList = [];
    let argumentStart = start + 1;
    depth = 0;
    for (
      let index = argumentStart;
      index < end;
      index += 1
    ) {
      if (text[index] === "<") {
        depth += 1;
      } else if (text[index] === ">") {
        depth -= 1;
      } else if (
        text[index] === "," &&
        depth === 0
      ) {
        argumentsList.push(
          normalizedPortableCsType(
            text.slice(
              argumentStart,
              index
            )
          )
        );
        argumentStart = index + 1;
      }
    }
    argumentsList.push(
      normalizedPortableCsType(
        text.slice(argumentStart, end)
      )
    );
    return {
      head: normalizedPortableCsType(
        text.slice(0, start)
      ),
      arguments: argumentsList,
      suffix: text.slice(end + 1)
    };
  }

  function portableEnumerableElementCsType(
    value
  ) {
    const text =
      normalizedPortableCsType(value);
    if (
      !text ||
      text === "string" ||
      text === "System.String"
    ) {
      return "";
    }
    const array = text.match(
      /^(.*)\[(?:,*)\]$/
    );
    if (array) {
      return normalizedPortableCsType(
        array[1]
      );
    }
    if (
      text ===
        "System.Collections.IEnumerable"
    ) {
      return "System.Object";
    }
    const parsed =
      portableGenericTypeParts(text);
    if (!parsed) return "";
    const head = parsed.head
      .replace(/\s+/g, "");
    const suffix = parsed.suffix
      .replace(/\s+/g, "");
    const oneElementCollections =
      new Set([
        "System.Collections.Generic.IEnumerable",
        "System.Collections.Generic.ICollection",
        "System.Collections.Generic.IList",
        "System.Collections.Generic.IReadOnlyCollection",
        "System.Collections.Generic.IReadOnlyList",
        "System.Collections.Generic.ISet",
        "System.Collections.Generic.List",
        "System.Collections.Generic.HashSet",
        "System.Collections.Generic.Queue",
        "System.Collections.Generic.Stack",
        "System.Collections.Generic.LinkedList",
        "System.Collections.ObjectModel.Collection",
        "System.Collections.ObjectModel.ReadOnlyCollection",
        "System.Collections.ObjectModel.ObservableCollection",
        "System.Collections.Concurrent.ConcurrentBag",
        "System.Collections.Concurrent.ConcurrentQueue",
        "System.Collections.Concurrent.ConcurrentStack",
        "System.Collections.Immutable.ImmutableArray",
        "System.Collections.Immutable.ImmutableList",
        "System.Collections.Immutable.ImmutableHashSet"
      ]);
    if (
      !suffix &&
      parsed.arguments.length === 1 &&
      oneElementCollections.has(head)
    ) {
      return parsed.arguments[0];
    }
    if (
      head === "System.Linq.IGrouping" &&
      parsed.arguments.length === 2
    ) {
      return parsed.arguments[1];
    }
    const dictionaryHeads = new Set([
      "System.Collections.Generic.Dictionary",
      "System.Collections.Generic.IDictionary",
      "System.Collections.Generic.IReadOnlyDictionary",
      "System.Collections.Concurrent.ConcurrentDictionary",
      "System.Collections.Immutable.ImmutableDictionary"
    ]);
    if (
      dictionaryHeads.has(head) &&
      parsed.arguments.length === 2
    ) {
      if (suffix.endsWith(".ValueCollection")) {
        return parsed.arguments[1];
      }
      if (suffix.endsWith(".KeyCollection")) {
        return parsed.arguments[0];
      }
      if (!suffix) {
        return (
          "System.Collections.Generic.KeyValuePair<" +
          `${parsed.arguments[0]}, ${parsed.arguments[1]}>`
        );
      }
    }
    return "";
  }

  function portableContractPortCsType(
    contract,
    direction,
    port
  ) {
    const role = portablePortRole(
      contract?.kind,
      direction,
      port,
      contract?.parameters
    );
    if (role === "input:target") {
      return normalizedPortableCsType(
        contract?.ownerType
      );
    }
    if (
      direction === "output" &&
      (
        role === "output:value" ||
        role === "output:result"
      )
    ) {
      if (contract?.kind === "type") {
        return "System.Type";
      }
      if (contract?.kind === "constructor") {
        return normalizedPortableCsType(
          contract?.ownerType
        );
      }
      return normalizedPortableCsType(
        contract?.returnType
      );
    }
    const match =
      /^parameter:(\d+):/.exec(role);
    if (match) {
      const position = Number(match[1]);
      const parameter = (
        Array.isArray(contract?.parameters)
          ? contract.parameters
          : []
      ).find((value, index) =>
        Math.max(
          0,
          Number(value?.position) || index
        ) === position
      );
      return normalizedPortableCsType(
        parameter?.elementType ||
        parameter?.type
      );
    }
    return "";
  }

  function placeholderMatchesGeneratedContract(
    placeholder,
    generatedDefinition
  ) {
    if (
      placeholder
        ?.unavailableApiContract !== true ||
      generatedDefinition
        ?.catalogGenerated !== true
    ) {
      return false;
    }
    const preservedKey =
      exactPortableContractKey(
        placeholder
          .preservedApiContract
      );
    const generatedKey =
      exactPortableContractKey(
        generatedDefinition
          .apiVerification
      );
    return Boolean(
      preservedKey &&
      generatedKey &&
      preservedKey === generatedKey
    );
  }

  function factoryRegistryIntegrity(
    catalog,
    report,
    requiredNodes = []
  ) {
    const registry =
      window.RMLModNodeRegistry;
    const definitions =
      registry?.getNodeDefinitions?.();
    const catalogFingerprint = String(
      catalog?.catalogFingerprint || ""
    );
    const engineVersion = String(
      catalog?.engineVersion || ""
    );
    const definitionRevision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    const metadataValid = Boolean(
      registry &&
      definitions &&
      typeof definitions === "object" &&
      !Array.isArray(definitions) &&
      catalogFingerprint &&
      report &&
      report.verificationPassed === true &&
      report.moduleId ===
        API_FACTORY_MODULE_ID &&
      Number(report.factoryVersion) ===
        FACTORY_VERSION &&
      Number(
        report.verificationSchemaVersion
      ) ===
        API_VERIFICATION_SCHEMA_VERSION &&
      String(
        report.catalogFingerprint || ""
      ) === catalogFingerprint &&
      String(report.engineVersion || "") ===
        engineVersion &&
      Number(report.totalGeneratedNodes) > 0
    );
    const cacheMatches = Boolean(
      factoryRegistryIntegrityCache &&
      factoryRegistryIntegrityCache.registry ===
        registry &&
      factoryRegistryIntegrityCache.definitions ===
        definitions &&
      factoryRegistryIntegrityCache.report ===
        report &&
      factoryRegistryIntegrityCache.catalog ===
        catalog &&
      factoryRegistryIntegrityCache.catalogIdentity ===
        apiCatalogIdentity(catalog) &&
      factoryRegistryIntegrityCache.definitionRevision ===
        definitionRevision
    );

    let publicationValid = false;
    let generatedDefinitions = 0;
    if (cacheMatches) {
      publicationValid =
        factoryRegistryIntegrityCache
          .publicationValid;
      generatedDefinitions =
        factoryRegistryIntegrityCache
          .generatedDefinitions;
    } else {
      publicationValid = metadataValid;
      if (metadataValid) {
        for (const id in definitions) {
          if (!Object.prototype.hasOwnProperty.call(
            definitions,
            id
          )) {
            continue;
          }
          const definition = definitions[id];
          if (
            definition?.catalogGenerated !==
              true ||
            definition?.legacyCatalogAlias ===
              true
          ) {
            continue;
          }
          generatedDefinitions += 1;
          const contract =
            definition.apiVerification;
          if (
            definition.unavailableApiContract ===
              true ||
            !contract ||
            typeof contract !== "object" ||
            Number(contract.schemaVersion) !==
              API_VERIFICATION_SCHEMA_VERSION ||
            String(contract.nodeId || "") !==
              id ||
            String(
              contract.catalogFingerprint || ""
            ) !== catalogFingerprint ||
            String(
              contract.engineVersion || ""
            ) !== engineVersion ||
            !String(
              contract.contractFingerprint || ""
            ).trim()
          ) {
            publicationValid = false;
          }
        }
        if (
          generatedDefinitions !==
            Number(
              report.totalGeneratedNodes
            )
        ) {
          publicationValid = false;
        }
      }
      factoryRegistryIntegrityCache = {
        registry,
        definitions,
        report,
        catalog,
        catalogIdentity:
          apiCatalogIdentity(catalog),
        definitionRevision,
        publicationValid,
        generatedDefinitions
      };
    }

    const missingRequired = [];
    for (const requirement of
      Array.isArray(requiredNodes)
        ? requiredNodes
        : []) {
      const operatorId = String(
        typeof requirement === "string"
          ? requirement
          : requirement?.operatorId || ""
      ).trim();
      if (!operatorId) continue;
      const definition =
        definitions?.[operatorId];
      const contract =
        definition?.apiVerification;
      const inputIds = new Set(
        (Array.isArray(definition?.inputs)
          ? definition.inputs
          : []).map(port =>
          String(port?.id || "")
        )
      );
      const outputIds = new Set(
        (Array.isArray(definition?.outputs)
          ? definition.outputs
          : []).map(port =>
          String(port?.id || "")
        )
      );
      const requiredInputs =
        typeof requirement === "string"
          ? []
          : Array.isArray(
                requirement?.inputPorts
              )
            ? requirement.inputPorts
            : [];
      const requiredOutputs =
        typeof requirement === "string"
          ? []
          : Array.isArray(
                requirement?.outputPorts
              )
            ? requirement.outputPorts
            : [];
      if (
        definition?.catalogGenerated !==
          true ||
        definition.unavailableApiContract ===
          true ||
        !contract ||
        typeof contract !== "object" ||
        Number(contract.schemaVersion) !==
          API_VERIFICATION_SCHEMA_VERSION ||
        String(contract.nodeId || "") !==
          operatorId ||
        String(
          contract.catalogFingerprint || ""
        ) !== catalogFingerprint ||
        String(contract.engineVersion || "") !==
          engineVersion ||
        !String(
          contract.contractFingerprint || ""
        ).trim() ||
        !requiredInputs.every(id =>
          inputIds.has(String(id || ""))
        ) ||
        !requiredOutputs.every(id =>
          outputIds.has(String(id || ""))
        )
      ) {
        missingRequired.push(operatorId);
      }
    }

    return Object.freeze({
      valid:
        publicationValid &&
        missingRequired.length === 0,
      publicationValid,
      generatedDefinitions,
      expectedGeneratedDefinitions:
        Math.max(
          0,
          Number(
            report?.totalGeneratedNodes
          ) || 0
        ),
      missingRequired: Object.freeze([
        ...new Set(missingRequired)
      ])
    });
  }

  function objectIdentityEntries(
    value
  ) {
    return new Map(
      Object.entries(value || {})
    );
  }

  function identityEntriesMatch(
    value,
    snapshot
  ) {
    const entries =
      Object.entries(value || {});
    if (
      !(snapshot instanceof Map) ||
      entries.length !== snapshot.size
    ) {
      return false;
    }
    return entries.every(
      ([key, entry]) =>
        snapshot.has(key) &&
        snapshot.get(key) === entry
    );
  }

  function captureFactoryEnvironment(
    registry
  ) {
    const definitions =
      registry?.getNodeDefinitions?.();
    const typeDefinitions =
      registry?.getTypeDefinitions?.();
    const valueTypes =
      registry?.getValueTypes?.();
    if (
      !definitions ||
      !typeDefinitions ||
      !Array.isArray(valueTypes)
    ) {
      throw new Error(
        "The graph registry cannot provide a complete atomic factory snapshot."
      );
    }
    return {
      registry,
      definitions,
      typeDefinitions,
      valueTypes,
      definitionEntries:
        objectIdentityEntries(
          definitions
        ),
      typeEntries:
        objectIdentityEntries(
          typeDefinitions
        ),
      valueTypeEntries:
        [...valueTypes],
      definitionRevision:
        Number(
          window
            .__RMLNodeDefinitionRevision
        ) || 0,
      apiCatalog:
        window
          .RMLResoniteApiCatalog ||
        null,
      componentCatalog:
        window
          .RMLFrooxComponentCatalog ||
        null,
      factoryReport:
        window
          .RMLApiNodeFactoryReport ||
        null,
      factoryVersion:
        Number(
          window
            .__RMLApiNodeFactoryVersion
        ) || 0,
      catalogProjectionIndex:
        window
          .RMLApiCatalogProjectionIndex ||
        null,
      catalogProjectionIndexDescriptor:
        Object.getOwnPropertyDescriptor(
          window,
          "RMLApiCatalogProjectionIndex"
        )
    };
  }

  function assertFactoryEnvironmentUnchanged(
    snapshot,
    lease,
    action,
    {
      allowSyntheticTypeAdditions = false
    } = {}
  ) {
    const label = String(
      action || "publishing API nodes"
    );
    assertFactoryOperationLease(
      lease,
      label
    );
    const registry =
      window.RMLModNodeRegistry;
    if (
      registry !== snapshot.registry ||
      registry
        ?.getNodeDefinitions?.() !==
          snapshot.definitions ||
      registry
        ?.getTypeDefinitions?.() !==
          snapshot.typeDefinitions ||
      registry
        ?.getValueTypes?.() !==
          snapshot.valueTypes
    ) {
      throw new Error(
        `The graph registry instance changed before ${label}.`
      );
    }
    const typeEntriesUnchanged =
      identityEntriesMatch(
        snapshot.typeDefinitions,
        snapshot.typeEntries
      ) ||
      (
        allowSyntheticTypeAdditions &&
        Object.entries(
          snapshot.typeDefinitions
        ).every(([id, information]) =>
          snapshot.typeEntries.has(id)
            ? snapshot.typeEntries.get(id) ===
                information
            : information
                ?.syntheticCollectionType ===
                  true &&
              information
                ?.catalogGenerated !== true &&
              information
                ?.unavailableApiType !== true
        ) &&
        [...snapshot.typeEntries]
          .every(([id, information]) =>
            snapshot.typeDefinitions[id] ===
              information
          )
      );
    if (
      !identityEntriesMatch(
        snapshot.definitions,
        snapshot.definitionEntries
      ) ||
      !typeEntriesUnchanged ||
      snapshot.valueTypes.length !==
        snapshot
          .valueTypeEntries.length ||
      snapshot.valueTypes.some(
        (value, index) =>
          value !==
          snapshot
            .valueTypeEntries[index]
      ) ||
      (Number(
        window
          .__RMLNodeDefinitionRevision
      ) || 0) !==
        snapshot.definitionRevision
    ) {
      throw new Error(
        `The graph registry changed before ${label}.`
      );
    }
    if (
      (window
        .RMLResoniteApiCatalog ||
        null) !== snapshot.apiCatalog ||
      (window
        .RMLFrooxComponentCatalog ||
        null) !==
          snapshot.componentCatalog ||
      (window
        .RMLApiNodeFactoryReport ||
        null) !==
          snapshot.factoryReport ||
      (Number(
        window
          .__RMLApiNodeFactoryVersion
      ) || 0) !==
        snapshot.factoryVersion ||
      (window
        .RMLApiCatalogProjectionIndex ||
        null) !==
          snapshot.catalogProjectionIndex
    ) {
      throw new Error(
        `The active catalog or API factory changed before ${label}.`
      );
    }
  }

  function createUnavailableOperatorAdmissionToken(
    planKey
  ) {
    const key = String(planKey || "");
    if (!key) {
      throw new Error(
        "The portable API admission plan has no identity."
      );
    }
    if (activeFactoryOperationLease) {
      throw new Error(
        "The API node factory is changing. Retry the portable project admission after it settles."
      );
    }
    const environment =
      captureFactoryEnvironment(
        window.RMLModNodeRegistry
      );
    if (
      environment.apiCatalog ||
      environment.componentCatalog ||
      environment.factoryReport
        ?.verificationPassed === true
    ) {
      throw new Error(
        "A catalog or verified API node factory became available before portable offline admission."
      );
    }
    const token = Object.freeze({
      epoch: factoryOperationEpoch,
      planKey: key,
      nonce: Object.freeze({})
    });
    portableAdmissionRecords.set(
      token,
      {
        epoch: factoryOperationEpoch,
        planKey: key,
        environment
      }
    );
    return token;
  }

  function consumeUnavailableOperatorAdmission(
    token,
    planKey,
    lease
  ) {
    const record =
      token &&
      typeof token === "object"
        ? portableAdmissionRecords.get(
            token
          )
        : null;
    portableAdmissionRecords.delete(
      token
    );
    if (
      !record ||
      record.planKey !==
        String(planKey || "") ||
      record.epoch + 1 !==
        lease.epoch
    ) {
      throw new Error(
        "The portable API admission token is stale. Retry the project import."
      );
    }
    assertFactoryEnvironmentUnchanged(
      record.environment,
      lease,
      "admitting portable offline API contracts"
    );
    if (
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      window.RMLApiNodeFactoryReport
        ?.verificationPassed === true
    ) {
      throw new Error(
        "A catalog or verified API node factory became available during portable offline admission. Retry the project import."
      );
    }
  }

  function registerUnavailableApiOperator(operatorId, apiContract, required = {}) {
    const id = String(operatorId || "").trim();
    const registry = window.RMLModNodeRegistry;
    if (!id || !registry) return "";

    const hasApiContract =
      apiContract &&
      typeof apiContract === "object" &&
      !Array.isArray(apiContract);
    const contract = hasApiContract
      ? structuredClone(apiContract)
      : {};
    contract.schemaVersion = 3;
    contract.stableContractId = stableContractId(contract);
    for (const [direction, key] of [["input", "inputPorts"], ["output", "outputPorts"]]) {
      contract[key] = (Array.isArray(contract[key]) ? contract[key] : []).map(port => ({
        ...port,
        role: portablePortRole(contract.kind, direction, port, contract.parameters)
      }));
    }
    const referencedInputs = Array.isArray(required.inputPorts)
      ? required.inputPorts.map(String)
      : [];
    const referencedOutputs = Array.isArray(required.outputPorts)
      ? required.outputPorts.map(String)
      : [];
    const existing = registry.getNodeDefinition?.(id);
    if (
      existing?.unavailableApiContract ===
        true
    ) {
      return exactPortableContractKey(
        existing.preservedApiContract
      ) === exactPortableContractKey(
        contract
      )
        ? id
        : "";
    }
    if (existing && !hasApiContract) return id;
    if (existing?.catalogGenerated === true && existing.apiVerification) {
      const available = existing.apiVerification;
      const sameExactContract =
        Boolean(
          exactApiSemanticContractKey(
            contract
          )
        ) &&
        exactApiSemanticContractKey(
          contract
        ) ===
          exactApiSemanticContractKey(
            available
          );
      const existingInputIds = new Set((existing.inputs || []).map(port => String(port?.id || "")));
      const existingOutputIds = new Set((existing.outputs || []).map(port => String(port?.id || "")));
      if (
        sameExactContract &&
        exactPortableContractKey(
          contract
        ) ===
          exactPortableContractKey(
            available
          ) &&
        referencedInputs.every(portId => existingInputIds.has(portId)) &&
        referencedOutputs.every(portId => existingOutputIds.has(portId))
      ) {
        return id;
      }
    }

    if (activeFactoryOperationLease) {
      return "";
    }

    let registrationId = id;
    if (existing) {
      const collisionIdentity = JSON.stringify({
        id,
        stableContractId: contract.stableContractId,
        inputPorts: referencedInputs,
        outputPorts: referencedOutputs
      });
      registrationId =
        `unavailable.preserved.${stableHash(collisionIdentity)}`;
      const preserved =
        registry.getNodeDefinition?.(
          registrationId
        );
      if (preserved?.unavailableApiContract === true) {
        return registrationId;
      }
      if (preserved) {
        registrationId +=
          `.${stableHash(collisionIdentity + "|collision")}`;
      }
    }
    const makePorts = (direction, declared, referenced) => {
      const rows = Array.isArray(declared) ? declared : [];
      const byId = new Map(rows.map(port => [String(port?.id || ""), port]));
      for (const portId of Array.isArray(referenced) ? referenced : []) {
        if (!byId.has(String(portId))) {
          const inferredType = ["call", "done", "true", "false", "reset"].includes(String(portId))
            ? "impulse"
            : String(portId) === "success"
              ? "bool"
              : String(portId) === "exception"
                ? "exception"
                : "object";
          byId.set(String(portId), { id: String(portId), type: inferredType });
        }
      }
      return [...byId.values()].filter(port => String(port?.id || "")).map(port => {
        const requestedType = String(port?.type || "object");
        let type = requestedType;
        if (!registry.getTypeInformation?.(type)) {
          if (type && type !== "T" && !port?.typeVar) {
            registry.registerType?.(type, {
              label: `Unavailable · ${type}`,
              short: "API?",
              color: "#ff6f91",
              csType: "object",
              defaultCs: "null!",
              referenceType: true,
              valueType: true,
              globalGenericCandidate: false,
              unavailableApiType: true,
              assignableTo: ["object"],
              constraints: ["value", "reference"]
            });
          } else {
            type = "object";
          }
        }
        return registry.port(String(port.id), String(port.label || port.id), type, {
          optional: port.optional === true,
          unavailableApiPort: true,
          semanticRole: portablePortRole(contract.kind, direction, port, contract.parameters)
        });
      });
    };
    const inputs = makePorts("input", contract.inputPorts, referencedInputs);
    const outputs = makePorts("output", contract.outputPorts, referencedOutputs);
    contract.inputPorts = inputs.map(port => ({
      id: port.id,
      type: port.type,
      optional: port.optional === true,
      role: port.semanticRole
    }));
    contract.outputPorts = outputs.map(port => ({
      id: port.id,
      type: port.type,
      optional: port.optional === true,
      role: port.semanticRole
    }));
    const displayName = [contract.ownerType, contract.memberName].filter(Boolean).join(".") || id;
    const isApi = id.startsWith("api.");
    registry.registerGroup?.(UNAVAILABLE_GROUP, { after: ADVANCED_GROUP });
    const registered = registry.registerNode(registrationId, {
      title: `${isApi ? "Unavailable API" : "Unavailable Operator"} · ${displayName}`,
      group: UNAVAILABLE_GROUP,
      symbol: "API?",
      description: `The original ${isApi ? "API contract" : "node contract"} is preserved, but the current Builder has no safely equivalent operator. The project remains editable; only export of this unresolved runtime path is blocked.`,
      hiddenFromPalette: true,
      expertOnly: true,
      unavailableApiContract: true,
      preservedApiContract: contract,
      inputs,
      outputs,
      parameters: [],
      codegenCollect(api) {
        api.diagnostic?.(`Unavailable API contract '${displayName}' (${id}) must be resolved before export.`);
      },
      codegenExpression(api) {
        api.diagnostic?.(`Unavailable API contract '${displayName}' (${id}) must be resolved before export.`);
        return api.csDefault?.(api.type || "object") || "default!";
      },
      codegenAction(api) {
        api.diagnostic?.(`Unavailable API contract '${displayName}' (${id}) must be resolved before export.`);
        return "";
      }
    });
    if (registered !== false) {
      window.__RMLNodeDefinitionRevision =
        (Number(
          window
            .__RMLNodeDefinitionRevision
        ) || 0) + 1;
      refreshPublishedCatalogProjectionIndex();
    }
    return registered === false
      ? ""
      : registrationId;
  }

  function stageUnavailableOperatorTransaction(
    requestedEntries,
    lease,
    releaseLease,
    admission
  ) {
    assertFactoryOperationLease(
      lease,
      "staging portable API contracts"
    );
    consumeUnavailableOperatorAdmission(
      admission?.token,
      admission?.planKey,
      lease
    );
    const registry =
      window.RMLModNodeRegistry;
    if (
      !registry ||
      typeof registry.getNodeDefinitions !==
        "function" ||
      typeof registry.getTypeDefinitions !==
        "function" ||
      typeof registry.registerType !==
        "function" ||
      typeof registry.port !== "function"
    ) {
      throw new Error(
        "The graph registry cannot stage portable API contracts."
      );
    }

    const stagedEnvironment =
      captureFactoryEnvironment(
        registry
      );
    const canonicalSyntheticCollectorVerifier =
      window.RMLTypedNodeGraphGenerator
        ?.isCanonicalSyntheticCollectorType;
    if (
      typeof canonicalSyntheticCollectorVerifier !==
        "function"
    ) {
      throw new Error(
        "The Runtime Graph cannot verify canonical synthetic collection contracts."
      );
    }

    const definitions =
      registry.getNodeDefinitions();
    const typeDefinitions =
      registry.getTypeDefinitions();
    const entries = Array.isArray(
      requestedEntries
    )
      ? requestedEntries
      : [];
    if (entries.length === 0) {
      throw new Error(
        "No portable API contracts were supplied for installation."
      );
    }

    const stagedDefinitions = new Map();
    const stagedTypes = new Map();
    const previousDefinitions = new Map();
    const ownedTypeBaselines = new Map();
    const publishedTypes = new Map();

    const normalizedContract = (
      operatorId,
      value,
      required
    ) => {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        throw new Error(
          `Portable API contract '${operatorId}' is missing.`
        );
      }
      const contract =
        structuredClone(value);
      if (
        !String(contract.ownerType || "").trim() ||
        !String(contract.kind || "").trim()
      ) {
        throw new Error(
          `Portable API contract '${operatorId}' has no complete owner/kind identity.`
        );
      }
      contract.schemaVersion = 3;
      contract.stableContractId =
        stableContractId(contract);
      for (const [direction, key] of [
        ["input", "inputPorts"],
        ["output", "outputPorts"]
      ]) {
        const rows = Array.isArray(
          contract[key]
        )
          ? contract[key]
          : [];
        const ids = new Set();
        contract[key] = rows.map(port => {
          const id = String(
            port?.id || ""
          ).trim();
          const type = String(
            port?.type || ""
          ).trim();
          if (!id || !type) {
            throw new Error(
              `Portable API contract '${operatorId}' contains an incomplete ${direction} port.`
            );
          }
          if (ids.has(id)) {
            throw new Error(
              `Portable API contract '${operatorId}' contains duplicate ${direction} port '${id}'.`
            );
          }
          ids.add(id);
          return {
            ...port,
            id,
            type,
            role: portablePortRole(
              contract.kind,
              direction,
              port,
              contract.parameters
            )
          };
        });
        const requiredIds =
          Array.isArray(
            required?.[
              direction === "input"
                ? "inputPorts"
                : "outputPorts"
            ]
          )
            ? required[
                direction === "input"
                  ? "inputPorts"
                  : "outputPorts"
              ]
            : [];
        for (const requiredIdValue of
          requiredIds) {
          const requiredId = String(
            requiredIdValue || ""
          ).trim();
          if (!requiredId || !ids.has(requiredId)) {
            throw new Error(
              `Portable API contract '${operatorId}' does not declare required ${direction} port '${requiredId || "<missing>"}'.`
            );
          }
        }
      }
      return contract;
    };

    const graphTypeForCsType = csType => {
      const normalized =
        normalizedPortableCsType(
          csType
        );
      if (!normalized) return "";
      for (const [id, information] of [
        ...Object.entries(
          typeDefinitions
        ),
        ...stagedTypes
      ]) {
        if (
          normalizedPortableCsType(
            information?.csType
          ).replace(/\s+/g, "") ===
            normalized.replace(/\s+/g, "")
        ) {
          return id;
        }
      }
      const head = normalized
        .slice(
          0,
          normalized.indexOf("<") >= 0
            ? normalized.indexOf("<")
            : normalized.length
        );
      const label =
        head.split(".").pop() ||
        "type";
      const slug = label
        .replace(
          /([a-z0-9])([A-Z])/g,
          "$1-$2"
        )
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .slice(0, 42) || "type";
      return `api.${slug}.${stableHash(normalized)}`;
    };

    const stageType = (
      type,
      csType = ""
    ) => {
      const normalizedCsType =
        normalizedPortableCsType(csType);
      const alreadyStaged =
        stagedTypes.get(type);
      if (alreadyStaged) {
        const existingCsType =
          normalizedPortableCsType(
            alreadyStaged.csType
          );
        if (
          normalizedCsType &&
          existingCsType &&
          existingCsType !== "object" &&
          normalizedCsType
            .replace(/\s+/g, "") !==
            existingCsType
              .replace(/\s+/g, "")
        ) {
          throw new Error(
            `Portable graph type '${type}' represents conflicting C# contracts.`
          );
        }
        return;
      }
      if (
        Object.prototype
          .hasOwnProperty.call(
            typeDefinitions,
            type
        )
      ) {
        return;
      }
      const elementCsType =
        portableEnumerableElementCsType(
          normalizedCsType
        );
      let elementGraphType = "";
      if (elementCsType) {
        elementGraphType =
          graphTypeForCsType(
            elementCsType
          );
        if (
          elementGraphType &&
          !Object.prototype
            .hasOwnProperty.call(
              typeDefinitions,
              elementGraphType
            ) &&
          !stagedTypes.has(
            elementGraphType
          )
        ) {
          stageType(
            elementGraphType,
            elementCsType
          );
        }
      }
      stagedTypes.set(type, {
        label: `Unavailable · ${type}`,
        short: "API?",
        color: "#ff6f91",
        csType:
          normalizedCsType || "object",
        defaultCs: "null!",
        referenceType: true,
        valueType: true,
        globalGenericCandidate: false,
        unavailableApiType: true,
        assignableTo: ["object"],
        constraints: [
          "value",
          "reference",
          ...(elementGraphType
            ? [
                "enumerable",
                "serializable"
              ]
            : [])
        ],
        ...(elementGraphType
          ? {
              collectionType: true,
              enumerableElementType:
                elementGraphType,
              enumerableElementCsType:
                elementCsType
            }
          : {})
      });
    };

    for (const requested of entries) {
      const operatorId = String(
        requested?.operatorId || ""
      ).trim();
      if (!operatorId) {
        throw new Error(
          "A portable API contract has no operator id."
        );
      }
      if (stagedDefinitions.has(operatorId)) {
        throw new Error(
          `Portable API operator '${operatorId}' occurs more than once in the installation plan.`
        );
      }
      const existing = definitions[operatorId];
      if (
        existing &&
        existing.unavailableApiContract !==
          true
      ) {
        throw new Error(
          `Portable API operator '${operatorId}' collides with a real or integrated registry definition.`
        );
      }
      const contract = normalizedContract(
        operatorId,
        requested?.apiContract,
        requested
      );
      const makePorts = (
        direction,
        key
      ) => contract[key].map(port => {
        stageType(
          port.type,
          portableContractPortCsType(
            contract,
            direction,
            port
          )
        );
        return registry.port(
          port.id,
          String(port.label || port.id),
          port.type,
          {
            optional:
              port.optional === true,
            unavailableApiPort: true,
            semanticRole:
              port.role
          }
        );
      });
      const inputs = makePorts(
        "input",
        "inputPorts"
      );
      const outputs = makePorts(
        "output",
        "outputPorts"
      );
      const displayName = [
        contract.ownerType,
        contract.memberName
      ].filter(Boolean).join(".") ||
        operatorId;
      const isApi =
        operatorId.startsWith("api.");
      stagedDefinitions.set(
        operatorId,
        {
          title:
            `${isApi ? "Unavailable API" : "Unavailable Operator"} · ${displayName}`,
          group: UNAVAILABLE_GROUP,
          symbol: "API?",
          description:
            `The original ${isApi ? "API contract" : "node contract"} is preserved, but the current Builder has no safely equivalent operator. The project remains editable; only export of this unresolved runtime path is blocked.`,
          hiddenFromPalette: true,
          expertOnly: true,
          unavailableApiContract: true,
          preservedApiContract:
            contract,
          inputs,
          outputs,
          parameters: [],
          codegenCollect(api) {
            api.diagnostic?.(
              `Unavailable API contract '${displayName}' (${operatorId}) must be resolved before export.`
            );
          },
          codegenExpression(api) {
            api.diagnostic?.(
              `Unavailable API contract '${displayName}' (${operatorId}) must be resolved before export.`
            );
            return api.csDefault?.(
              api.type || "object"
            ) || "default!";
          },
          codegenAction(api) {
            api.diagnostic?.(
              `Unavailable API contract '${displayName}' (${operatorId}) must be resolved before export.`
            );
            return "";
          }
        }
      );
      previousDefinitions.set(
        operatorId,
        {
          present:
            Object.prototype
              .hasOwnProperty.call(
                definitions,
                operatorId
              ),
          value: existing
        }
      );
    }

    for (const type of stagedTypes.keys()) {
      ownedTypeBaselines.set(type, {
        present:
          stagedEnvironment.typeEntries
            .has(type),
        value:
          stagedEnvironment.typeEntries
            .get(type)
      });
    }

    let committed = false;
    let rolledBack = false;
    let completed = false;
    let committedEnvironment = null;

    const isExactSyntheticCollector = (
      type,
      information
    ) =>
      canonicalSyntheticCollectorVerifier(
        type,
        information
      ) === true;

    const isSameSyntheticCollectorLineage = (
      type,
      previous,
      current
    ) =>
      Boolean(
        previous &&
        previous.syntheticCollectionType ===
          true &&
        previous.collectorCollection === true &&
        String(
          previous.enumerableElementType ||
          ""
        ).trim() ===
          String(
            current
              ?.enumerableElementType ||
            ""
          ).trim() &&
        type ===
          `collectList:${String(
            previous.enumerableElementType ||
            ""
          ).trim()}`
      );

    const adoptSyntheticCollectorTypeDeltas =
      () => {
        if (!committedEnvironment) {
          return;
        }
        const expectedEntries =
          committedEnvironment.typeEntries;
        for (const [type, current] of
          Object.entries(typeDefinitions)) {
          const present =
            expectedEntries.has(type);
          const previous =
            expectedEntries.get(type);
          if (present && previous === current) {
            continue;
          }
          if (publishedTypes.has(type)) {
            continue;
          }
          if (
            !isExactSyntheticCollector(
              type,
              current
            ) ||
            (
              present &&
              !isSameSyntheticCollectorLineage(
                type,
                previous,
                current
              )
            )
          ) {
            continue;
          }
          if (!ownedTypeBaselines.has(type)) {
            ownedTypeBaselines.set(type, {
              present:
                stagedEnvironment.typeEntries
                  .has(type),
              value:
                stagedEnvironment.typeEntries
                  .get(type)
            });
          }
          publishedTypes.set(type, current);
          expectedEntries.set(type, current);
        }
      };

    const rollback = () => {
      if (rolledBack || completed) {
        return false;
      }
      assertFactoryOperationLease(
        lease,
        "rolling back portable API contracts"
      );
      adoptSyntheticCollectorTypeDeltas();
      let changed = false;
      for (const [operatorId, previous] of
        previousDefinitions) {
        const staged =
          stagedDefinitions.get(operatorId);
        if (
          definitions[operatorId] !== staged
        ) {
          continue;
        }
        if (previous.present) {
          definitions[operatorId] =
            previous.value;
        } else {
          delete definitions[operatorId];
        }
        changed = true;
      }
      for (const [type, previous] of
        ownedTypeBaselines) {
        if (
          !publishedTypes.has(type) ||
          typeDefinitions[type] !==
            publishedTypes.get(type)
        ) {
          continue;
        }
        if (previous.present) {
          typeDefinitions[type] =
            previous.value;
        } else {
          delete typeDefinitions[type];
        }
        changed = true;
      }
      if (changed) {
        window.__RMLNodeDefinitionRevision =
          (Number(
            window.__RMLNodeDefinitionRevision
          ) || 0) + 1;
        refreshPublishedCatalogProjectionIndex();
      }
      rolledBack = true;
      releaseLease();
      return committed;
    };
    const verify = () => {
      if (
        !committed ||
        rolledBack ||
        completed ||
        !committedEnvironment
      ) {
        return false;
      }
      adoptSyntheticCollectorTypeDeltas();
      assertFactoryEnvironmentUnchanged(
        committedEnvironment,
        lease,
        "verifying portable API contracts"
      );
      return [...stagedDefinitions]
        .every(([operatorId, definition]) =>
          definitions[operatorId] ===
            definition &&
          definition.unavailableApiContract ===
            true &&
          exactPortableContractKey(
            definition
              .preservedApiContract
          ) ===
            exactPortableContractKey(
              stagedDefinitions
                .get(operatorId)
                .preservedApiContract
            )
        );
    };
    const commit = () => {
      if (rolledBack) {
        throw new Error(
          "The portable API contract installation was already rolled back."
        );
      }
      if (committed) {
        return verify();
      }
      try {
        assertFactoryEnvironmentUnchanged(
          stagedEnvironment,
          lease,
          "committing portable API contracts"
        );
        for (const [operatorId, previous] of
          previousDefinitions) {
          const current =
            definitions[operatorId];
          if (
            current !== previous.value ||
            Boolean(current) !==
              previous.present
          ) {
            throw new Error(
              `Registry definition '${operatorId}' changed while the project import was pending.`
            );
          }
          if (
            current &&
            current.unavailableApiContract !==
              true
          ) {
            throw new Error(
              `Registry definition '${operatorId}' is no longer available for a portable placeholder.`
            );
          }
        }
        for (const [type, information] of
          stagedTypes) {
          if (!typeDefinitions[type]) {
            registry.registerType(
              type,
              information
            );
            publishedTypes.set(
              type,
              typeDefinitions[type]
            );
          }
        }
        registry.registerGroup?.(
          UNAVAILABLE_GROUP,
          { after: ADVANCED_GROUP }
        );
        for (const [operatorId, definition] of
          stagedDefinitions) {
          definitions[operatorId] =
            definition;
        }
        window.__RMLNodeDefinitionRevision =
          (Number(
            window.__RMLNodeDefinitionRevision
          ) || 0) + 1;
        refreshPublishedCatalogProjectionIndex();
        committed = true;
        committedEnvironment =
          captureFactoryEnvironment(
            registry
          );
        if (!verify()) {
          throw new Error(
            "The portable API definitions were not published as one exact registry plan."
          );
        }
        return true;
      } catch (error) {
        rollback();
        throw error;
      }
    };

    const complete = () => {
      if (
        completed ||
        rolledBack ||
        !verify()
      ) {
        return false;
      }
      completed = true;
      releaseLease();
      return true;
    };

    return Object.freeze({
      epoch: lease.epoch,
      operatorIds: Object.freeze(
        [...stagedDefinitions.keys()]
      ),
      commit,
      verify,
      complete,
      rollback
    });
  }

  function createUnavailableOperatorTransaction(
    requestedEntries,
    admission = {}
  ) {
    return acquireFactoryOperationLease(
      "portable-offline-install",
      (lease, releaseLease) =>
        stageUnavailableOperatorTransaction(
          requestedEntries,
          lease,
          releaseLease,
          admission
        )
    );
  }

  function acquireCatalogResolutionStabilityLease() {
    return acquireFactoryOperationLease(
      "saved-composite-resolution-commit",
      (lease, releaseLease) => {
        let released = false;
        return Object.freeze({
          release() {
            if (released) return false;
            let leaseError = null;
            try {
              assertFactoryOperationLease(
                lease,
                "releasing the Saved Composite catalog stability lease"
              );
            } catch (error) {
              leaseError = error;
            }
            released = true;
            const result = releaseLease();
            if (leaseError) {
              throw leaseError;
            }
            return result;
          }
        });
      }
    );
  }

  async function rebuildFactoryForCatalog(
    catalog,
    lease,
    options = {}
  ) {
    assertFactoryOperationLease(
      lease,
      "starting a catalog factory rebuild"
    );
    const registry =
      window.RMLModNodeRegistry;

    if (
      !catalog ||
      typeof catalog !== "object" ||
      !registry ||
      typeof registry.getNodeDefinitions !==
        "function"
    ) {
      throw new Error(
        "The live API node factory cannot be rebuilt because its catalog or registry is unavailable."
      );
    }

    const initialEnvironment =
      captureFactoryEnvironment(
        registry
      );
    const stagedCatalogProjectionRevision =
      initialEnvironment.definitionRevision +
      1;
    const createCatalogPublication =
      typeof options
        ?.createCatalogPublication ===
          "function"
        ? options
            .createCatalogPublication
        : null;
    if (
      initialEnvironment.apiCatalog &&
      apiCatalogIdentity(
        initialEnvironment.apiCatalog
      ) !== apiCatalogIdentity(catalog) &&
      !createCatalogPublication
    ) {
      throw new Error(
        "The requested API catalog is no longer the active catalog."
      );
    }

    const definitions = registry.getNodeDefinitions();
    const typeDefinitions = registry.getTypeDefinitions?.() || {};
    const valueTypes = registry.getValueTypes?.() || [];
    const stagedDefinitions = Object.fromEntries(
      Object.entries(definitions).filter(([, definition]) =>
        definition?.catalogGenerated !== true &&
        definition?.unavailableApiContract !== true
      )
    );
    const stagedTypes = structuredClone(
      Object.fromEntries(
        Object.entries(typeDefinitions).filter(
          ([, information]) =>
            information?.catalogGenerated !== true &&
            !String(
              information?.apiCatalogType || ""
            ).trim()
        )
      )
    );
    const stagedValueTypes = valueTypes.filter(
      type =>
        Object.prototype.hasOwnProperty.call(
          stagedTypes,
          type
        )
    );
    const stagedGroups = [];
    const previousReport = window.RMLApiNodeFactoryReport || null;
    const previousFactoryVersion = Number(window.__RMLApiNodeFactoryVersion) || 0;
    const previousLegacyOperatorResolver = legacyOperatorResolver;
    let catalogPublication = null;
    let registryMutationStarted = false;
    const stagingRegistry = {
      ...registry,
      registerGroup(name, options) {
        stagedGroups.push([name, options]);
      },
      registerNode(id, definition) {
        if (stagedDefinitions[id]) return false;
        stagedDefinitions[id] = definition;
        return true;
      },
      registerType(type, information = {}) {
        const id = String(type || "").trim();
        if (!id) throw new TypeError("Graph type id must be a non-empty string.");
        const assemblyReferences = Array.isArray(information.assemblyReferences)
          ? information.assemblyReferences.filter(reference =>
              reference && typeof reference === "object" && String(reference.include || "").trim()
            ).map(reference => ({
              include: String(reference.include || "").trim(),
              hintPath: String(reference.hintPath || "").trim(),
              private: reference.private === true
            }))
          : [];
        const assemblies = [...new Set([
          ...(Array.isArray(information.assemblies) ? information.assemblies : []),
          information.assembly
        ].map(value => String(value || "").trim()).filter(Boolean))];
        stagedTypes[id] = {
          label: information.label || id,
          short: information.short || id.slice(0, 4).toUpperCase(),
          color: information.color || "#9da8b4",
          ...information,
          assemblies,
          assemblyReferences
        };
        if (information.valueType === true &&
            information.globalGenericCandidate !== false &&
            !stagedValueTypes.includes(id)) {
          stagedValueTypes.push(id);
        }
      },
      getNodeDefinitions: () => stagedDefinitions,
      getTypeDefinitions: () => stagedTypes,
      getTypeInformation(type) {
        const id =
          typeof type === "string" && type.startsWith("enum:")
            ? "enum"
            : type || "generic";
        return stagedTypes[id] || null;
      },
      getValueTypes: () => stagedValueTypes
    };

    try {
      const report = await buildFactory(
        stagingRegistry,
        catalog,
        false,
        stagedCatalogProjectionRevision
      );
      let stagedCatalogProjectionIndex =
        catalogProjectionIndexByReport.get(
          report
        );
      const stagedLegacyOperatorResolver = legacyOperatorResolver;
      legacyOperatorResolver = previousLegacyOperatorResolver;

      if (
        !report ||
        report.verificationPassed !== true ||
        apiCatalogIdentity(report) !==
          apiCatalogIdentity(catalog) ||
        !stagedCatalogProjectionIndex ||
        stagedCatalogProjectionIndex.catalog !==
          catalog ||
        stagedCatalogProjectionIndex.report !==
          report ||
        Number(
          stagedCatalogProjectionIndex.revision
        ) !==
          stagedCatalogProjectionRevision
      ) {
        const details = Array.isArray(report?.verificationErrors)
          ? report.verificationErrors.slice(0, 12).join(" | ")
          : "";
        throw new Error(
          `The live API node factory did not produce a complete verified contract for the current catalog.${details ? ` ${details}` : ""}`
        );
      }

      assertFactoryEnvironmentUnchanged(
        initialEnvironment,
        lease,
        "committing the rebuilt catalog factory"
      );

      const generatedDefinitions =
        Object.entries(
          stagedDefinitions
        ).filter(([, definition]) =>
          definition
            ?.catalogGenerated === true
        );
      const stagedCatalogProjectionCustomState =
        createCatalogProjectionCustomState();
      for (const [id, definition] of
        generatedDefinitions) {
        appendCatalogProjectionCustomDefinition(
          stagedCatalogProjectionCustomState,
          id,
          definition
        );
        const current =
          definitions[id];
        if (
          current
            ?.unavailableApiContract ===
              true &&
          !placeholderMatchesGeneratedContract(
            current,
            definition
          )
        ) {
          throw new Error(
            `Live API node '${id}' does not exactly match the preserved portable contract. The unavailable placeholder was retained.`
          );
        }
      }
      stagedCatalogProjectionIndex =
        completeCatalogProjectionIndex(
          stagedCatalogProjectionIndex,
          stagedCatalogProjectionCustomState,
          stagedCatalogProjectionRevision
        );
      catalogProjectionIndexByReport.set(
        report,
        stagedCatalogProjectionIndex
      );
      if (
        Number(
          stagedCatalogProjectionIndex
            .definitionRevision
        ) !== stagedCatalogProjectionRevision ||
        typeof stagedCatalogProjectionIndex
          .customCSharpByIdentifier?.get !==
            "function" ||
        !Array.isArray(
          stagedCatalogProjectionIndex
            .catalogTypeNames
        )
      ) {
        throw new Error(
          "The live API node factory did not prepare a complete definition-scoped Custom C# catalog index."
        );
      }

      const generatedTypes =
        Object.entries(
          stagedTypes
        ).filter(([, information]) =>
          information
            ?.catalogGenerated === true
        );
      const updatedIntegratedTypes =
        Object.entries(stagedTypes)
          .filter(([id, information]) =>
            information
              ?.catalogGenerated !== true &&
            Object.prototype
              .hasOwnProperty.call(
                typeDefinitions,
                id
              ) &&
            JSON.stringify(information) !==
              JSON.stringify(
                typeDefinitions[id]
              )
          );
      for (const [id] of generatedTypes) {
        const current =
          typeDefinitions[id];
        if (
          current &&
          current.catalogGenerated !==
            true &&
          current.unavailableApiType !==
            true
        ) {
          throw new Error(
            `Live API type '${id}' collides with a non-catalog graph type. The existing type was retained.`
          );
        }
      }

      for (const [name, options] of
        stagedGroups) {
        registry.registerGroup(
          name,
          options
        );
      }

      if (createCatalogPublication) {
        catalogPublication =
          createCatalogPublication(
            catalog
          );
        if (
          !catalogPublication ||
          typeof catalogPublication.commit !==
            "function" ||
          typeof catalogPublication.verify !==
            "function" ||
          typeof catalogPublication.rollback !==
            "function"
        ) {
          throw new Error(
            "The catalog publication transaction is incomplete."
          );
        }
        if (
          catalogPublication.commit() !==
            true ||
          catalogPublication.verify() !==
            true
        ) {
          throw new Error(
            "The catalog could not be published inside the factory lease."
          );
        }
      }

      registryMutationStarted = true;
      for (const id of Object.keys(definitions)) {
        if (
          definitions[id]
            ?.catalogGenerated === true
        ) {
          delete definitions[id];
        }
      }
      for (const [id, definition] of
        generatedDefinitions) {
        definitions[id] = definition;
      }

      const previousGeneratedTypeIds =
        new Set(
          Object.entries(typeDefinitions)
            .filter(([, information]) =>
              information
                ?.catalogGenerated ===
                  true
            )
            .map(([id]) => id)
        );
      for (const id of
        previousGeneratedTypeIds) {
        delete typeDefinitions[id];
      }
      for (const [id, information] of
        updatedIntegratedTypes) {
        typeDefinitions[id] =
          information;
      }
      for (const [id, information] of
        generatedTypes) {
        typeDefinitions[id] =
          information;
      }
      const nextGeneratedValueTypes =
        new Set(
          stagedValueTypes.filter(id =>
            stagedTypes[id]
              ?.catalogGenerated === true
          )
        );
      const retainedValueTypes =
        valueTypes.filter(id =>
          !previousGeneratedTypeIds.has(id)
        );
      valueTypes.splice(
        0,
        valueTypes.length,
        ...new Set([
          ...retainedValueTypes,
          ...nextGeneratedValueTypes
        ])
      );
      legacyOperatorResolver = stagedLegacyOperatorResolver;
      window.__RMLApiNodeFactoryVersion = FACTORY_VERSION;
      window.RMLApiNodeFactoryReport = report;
      window.__RMLNodeDefinitionRevision =
        (Number(window.__RMLNodeDefinitionRevision) || 0) + 1;

      assertFactoryOperationLease(
        lease,
        "verifying the rebuilt catalog factory"
      );
      if (
        (window
          .RMLResoniteApiCatalog ||
          null) !==
            (catalogPublication
              ? catalog
              : initialEnvironment
                  .apiCatalog) ||
        (window
          .RMLFrooxComponentCatalog ||
          null) !==
            (catalogPublication
              ? catalog
              : initialEnvironment
                  .componentCatalog) ||
        (
          catalogPublication &&
          catalogPublication.verify() !==
            true
        ) ||
        generatedDefinitions.some(
          ([id, definition]) =>
            definitions[id] !==
              definition
        ) ||
        generatedTypes.some(
          ([id, information]) =>
            typeDefinitions[id] !==
              information
        ) ||
        updatedIntegratedTypes.some(
          ([id, information]) =>
            typeDefinitions[id] !==
              information
        ) ||
        (Number(
          window
            .__RMLNodeDefinitionRevision
        ) || 0) !==
          Number(
            report.catalogProjectionRevision
          ) ||
        window.RMLApiNodeFactoryReport !==
          report
      ) {
        throw new Error(
          "The rebuilt API catalog factory failed its atomic publication verification."
        );
      }

      // No callback or yield occurs between the verified registry/catalog
      // commit and this final publication. Consumers therefore see either
      // the preceding complete index or this complete matching index, never
      // one belonging to a factory transaction that has not verified.
      publishCatalogProjectionIndex(
        stagedCatalogProjectionIndex
      );
      if (
        window.RMLApiCatalogProjectionIndex !==
          stagedCatalogProjectionIndex ||
        stagedCatalogProjectionIndex.report !==
          report ||
        Number(
          stagedCatalogProjectionIndex.revision
        ) !==
          Number(
            report.catalogProjectionRevision
          ) ||
        Number(
          stagedCatalogProjectionIndex
            .definitionRevision
        ) !==
          (Number(
            window.__RMLNodeDefinitionRevision
          ) || 0) ||
        typeof stagedCatalogProjectionIndex
          .customCSharpByIdentifier?.select !==
            "function" ||
        !Object.isFrozen(
          stagedCatalogProjectionIndex
            .catalogTypeNames
        )
      ) {
        throw new Error(
          "The rebuilt API catalog factory failed to publish its prepared graph-codegen index."
        );
      }

      window.dispatchEvent(
        new CustomEvent(
          "rml-api-node-factory-ready",
          { detail: report }
        )
      );
      try {
        catalogPublication?.notify?.();
      } catch (catalogEventError) {
        console.error(
          "The verified catalog event could not be delivered.",
          catalogEventError
        );
      }

      completeFactoryReady(report);
      return report;
    } catch (error) {
      if (registryMutationStarted) {
        for (const id of
          Object.keys(definitions)) {
          delete definitions[id];
        }
        for (const [id, definition] of
          initialEnvironment
            .definitionEntries) {
          definitions[id] = definition;
        }
        for (const id of
          Object.keys(typeDefinitions)) {
          delete typeDefinitions[id];
        }
        for (const [id, information] of
          initialEnvironment.typeEntries) {
          typeDefinitions[id] =
            information;
        }
        valueTypes.splice(
          0,
          valueTypes.length,
          ...initialEnvironment
            .valueTypeEntries
        );
        window.__RMLNodeDefinitionRevision =
          initialEnvironment
            .definitionRevision;
      }
      try {
        catalogPublication?.rollback?.();
      } catch (rollbackError) {
        console.error(
          "The failed catalog publication could not be rolled back.",
          rollbackError
        );
      }
      window.__RMLApiNodeFactoryVersion = previousFactoryVersion;
      window.RMLApiNodeFactoryReport = previousReport;
      if (
        initialEnvironment
          .catalogProjectionIndexDescriptor
      ) {
        Object.defineProperty(
          window,
          "RMLApiCatalogProjectionIndex",
          initialEnvironment
            .catalogProjectionIndexDescriptor
        );
      } else {
        delete window
          .RMLApiCatalogProjectionIndex;
      }
      legacyOperatorResolver = previousLegacyOperatorResolver;

      throw error;
    }
  }

  Object.defineProperty(
    window,
    "RMLApiNodeFactoryController",
    {
      value: Object.freeze({
        version: 9,
        moduleId:
          API_FACTORY_MODULE_ID,
        factoryVersion:
          FACTORY_VERSION,
        compatibleLegacyAliasRevision() {
          return compatibleLegacyAliasRevision;
        },
        replacePublishedFactoryReport(
          expectedReport,
          nextReport
        ) {
          return replacePublishedFactoryReport(
            expectedReport,
            nextReport
          );
        },
        verifyRegistryPublication(
          catalog,
          report =
            window.RMLApiNodeFactoryReport,
          requiredNodes = []
        ) {
          return factoryRegistryIntegrity(
            catalog,
            report,
            requiredNodes
          );
        },
        rebuild(catalog, options = {}) {
          factoryBuildPromise =
            queueFactoryOperation(
              lease =>
                rebuildFactoryForCatalog(
                  catalog,
                  lease,
                  options
                ),
              "catalog-rebuild"
            );

          return factoryBuildPromise;
        },
        resolveRequiredOperators(
          requiredNodes,
          catalog
        ) {
          return queueFactoryOperation(
            async () => {
              const report =
                window.RMLApiNodeFactoryReport;
              const resolver =
                legacyOperatorResolver;

              if (
                !resolver ||
                !report ||
                report.verificationPassed !==
                  true ||
                apiCatalogIdentity(report) !==
                  apiCatalogIdentity(catalog)
              ) {
                return Object.freeze({
                  attempted: false,
                  resolved: 0,
                  unresolved:
                    Array.isArray(
                      requiredNodes
                    )
                      ? requiredNodes.length
                      : 0
                });
              }

              return resolver(
                requiredNodes,
                catalog,
                window.RMLModNodeRegistry
              );
            },
            "legacy-operator-resolution"
          );
        },
        ensureUnavailableOperator(operatorId, apiContract, required) {
          if (activeFactoryOperationLease) {
            return "";
          }
          return registerUnavailableApiOperator(operatorId, apiContract, required);
        },
        acquireCatalogResolutionStabilityLease,
        createUnavailableOperatorAdmissionToken(planKey) {
          return createUnavailableOperatorAdmissionToken(planKey);
        },
        createUnavailableOperatorTransaction(entries, admission) {
          return createUnavailableOperatorTransaction(entries, admission);
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  let lastCooperativeYieldAt = 0;

  function yieldToBrowser() {
    const now =
      typeof window.performance?.now ===
        "function"
        ? window.performance.now()
        : Date.now();

    if (
      lastCooperativeYieldAt > 0 &&
      now - lastCooperativeYieldAt < 16
    ) {
      return Promise.resolve();
    }

    lastCooperativeYieldAt = now;
    if (
      window.scheduler &&
      typeof window.scheduler.yield ===
        "function"
    ) {
      return window.scheduler.yield();
    }

    return new Promise(resolve => {
      if (
        typeof requestAnimationFrame ===
        "function"
      ) {
        requestAnimationFrame(() =>
          resolve()
        );
      } else {
        window.setTimeout(resolve, 0);
      }
    });
  }

  function boot() {
    if (factoryBuildPromise) {
      return factoryBuildPromise;
    }

    const existingReport =
      window.RMLApiNodeFactoryReport;
    const existingCatalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog;
    if (
      Number(
        window.__RMLApiNodeFactoryVersion
      ) === FACTORY_VERSION &&
      Number(
        existingReport?.factoryVersion
      ) === FACTORY_VERSION &&
      existingReport?.moduleId ===
        API_FACTORY_MODULE_ID &&
      factoryRegistryIntegrity(
        existingCatalog,
        existingReport
      ).publicationValid
    ) {
      completeFactoryReady(
        existingReport
      );
      return factoryReady;
    }

    const registry = window.RMLModNodeRegistry;
    const catalog = existingCatalog;

    if (
      !registry ||
      !catalog ||
      typeof registry.registerNode !== "function" ||
      typeof registry.getNodeDefinitions !== "function"
    ) {
      if (!prerequisiteWaitInstalled) {
        prerequisiteWaitInstalled = true;
        Promise.all([
          Promise.resolve(
            window.RMLNodeRegistryReady
          ),
          Promise.resolve(
            window.RMLCatalogReady
          )
        ])
          .then(() => {
            prerequisiteWaitInstalled =
              false;
            if (
              window.RMLModNodeRegistry &&
              (
                window.RMLResoniteApiCatalog ||
                window.RMLFrooxComponentCatalog
              )
            ) {
              boot();
            }
          })
          .catch(error => {
            console.error(
              "RML API Node Factory prerequisites failed.",
              error
            );
            completeFactoryReady(null);
          });
      }
      return factoryReady;
    }

    // Initial boot and later rebuilds use the same staged publication path.
    // That keeps live catalogs, preserved placeholders and type definitions
    // behind one epoch/lease instead of exposing a partially built registry.
    factoryBuildPromise =
      queueFactoryOperation(
        lease =>
          rebuildFactoryForCatalog(
            catalog,
            lease
          ),
        "initial-catalog-build"
      )
        .then(completeFactoryReady)
        .catch(error => {
          console.error(
            "RML API Node Factory failed.",
            error
          );
          completeFactoryReady(null);
          return null;
        });

    return factoryBuildPromise;
  }

  async function buildFactory(
    registry,
    catalog,
    publish = true,
    projectionRevision =
      (Number(
        window
          .__RMLNodeDefinitionRevision
      ) || 0) + 1
  ) {
    activeReloadSafetyContractCompatible =
      catalog?.reloadSafetyCompatible === true;

    const {
      port,
      registerType,
      registerGroup,
      registerNode,
      getNodeDefinitions,
      getTypeDefinitions,
      getTypeInformation
    } = registry;

    for (const [name, options] of [
      [API_GROUPS.types, { after: "Values" }],
      [API_GROUPS.constructors, { after: API_GROUPS.types }],
      [API_GROUPS.methods, { after: API_GROUPS.constructors }],
      [API_GROUPS.properties, { after: API_GROUPS.methods }],
      [API_GROUPS.fields, { after: API_GROUPS.properties }],
      [API_GROUPS.events, { after: API_GROUPS.fields }]
    ]) {
      registerGroup(name, options);
    }

    const typeRows = Array.isArray(catalog.types)
      ? catalog.types.filter(Boolean)
      : [];
    const enumRows = Array.isArray(catalog.enums)
      ? catalog.enums.filter(Boolean)
      : [];
    const definitions = getNodeDefinitions();
    const typeByName = new Map();
    const genericTypeRowsByShape = new Map();
    const projectionTypeByName = new Map();
    const projectionGenericTypeByShape =
      new Map();
    const projectionEnumByName = new Map();
    const projectionAssemblyByName =
      new Map();
    const graphTypeByCs = new Map();
    const graphTypeByNormalizedCs = new Map();
    const generatedNodeIds = new Set();
    const legacyAliasIds = new Set();
    const legacyAliasEntries = [];
    const legacyAliasPrefixes = new Set();
    const rejectedGeneratedNodeIds = new Set();
    const verificationErrors = [];
    const catalogSchemaVersion =
      Number(catalog.schemaVersion || 0);
    const engineVersion = String(
      catalog.engineVersion || "unknown"
    );
    const catalogSource = String(
      catalog.catalogSource ||
      window.RMLApiCatalogInfo?.source ||
      window.RMLApiCatalogSource ||
      "unknown"
    );
    const catalogFingerprint = String(
      catalog.catalogFingerprint ||
      catalog.assemblyFingerprint ||
      stableHash(JSON.stringify({
        schemaVersion: catalogSchemaVersion,
        engineVersion,
        assemblies: catalog.assemblies || [],
        types: catalog.types || [],
        enums: catalog.enums || []
      }))
    );
    const catalogProjectionRevision =
      Math.max(
        1,
        Number(projectionRevision) || 0
      );
    const assemblyByName = new Map();
    const assemblyRows =
      Array.isArray(catalog.assemblies)
        ? catalog.assemblies
        : [];
    for (
      let index = 0;
      index < assemblyRows.length;
      index += 1
    ) {
      const assembly = assemblyRows[index];
      if (!assembly) continue;
      const projectionName = String(
        assembly.name || ""
      );
      rememberCatalogProjectionRow(
        projectionAssemblyByName,
        projectionName,
        assembly,
        index
      );
      const name = projectionName.trim();
      if (name) {
        assemblyByName.set(name, assembly);
      }
    }

    for (
      let index = 0;
      index < typeRows.length;
      index += 1
    ) {
      const row = typeRows[index];
      const name = normalizeCsType(row.fullName);
      if (name) {
        typeByName.set(name, row);

        const shape = genericTypeShape(name);
        if (shape && !genericTypeRowsByShape.has(shape)) {
          genericTypeRowsByShape.set(shape, row);
        }
      }
      const projectionName =
        catalogProjectionTypeName(
          row.fullName
        );
      if (projectionName) {
        rememberCatalogProjectionRow(
          projectionTypeByName,
          projectionName,
          row,
          index
        );
        const projectionShape =
          catalogProjectionGenericShape(
            projectionName
          );
        if (
          projectionShape &&
          !projectionGenericTypeByShape
            .has(projectionShape)
        ) {
          projectionGenericTypeByShape.set(
            projectionShape,
            Object.freeze({ row, index })
          );
        }
      }
    }

    function catalogExactType(value) {
      let text = String(value || "")
        .trim()
        .replace(/^global::/, "")
        .replace(/\s+/g, " ");

      if (!text.endsWith("?")) {
        return text;
      }

      const underlying = text.slice(0, -1);
      const row = typeByName.get(
        normalizeCsType(underlying)
      );
      const valueType = Boolean(
        row?.kind === "struct" ||
        row?.kind === "enum" ||
        row?.isValueType === true ||
        looksLikeValueType(underlying)
      );

      return valueType
        ? `System.Nullable<${underlying}>`
        : underlying;
    }

    function catalogTypeNamesInExpression(csType) {
      const normalized =
        normalizeCsType(csType)
          .replace(/global::/g, "");
      const names = new Set();
      const matches = normalized.match(
        /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g
      ) || [];

      if (typeByName.has(normalized)) {
        names.add(normalized);
      }

      for (const candidate of matches) {
        if (typeByName.has(candidate)) {
          names.add(candidate);
        }
      }

      return [...names];
    }

    function assemblyReferencesForCsType(
      csType,
      row = null
    ) {
      const references = new Map();
      const rows = [];

      if (row && typeof row === "object") {
        rows.push(row);
      }

      for (const typeName of
        catalogTypeNamesInExpression(csType)) {
        const information =
          typeByName.get(typeName);
        if (information) rows.push(information);
      }

      for (const information of rows) {
        const include = String(
          information.assembly || ""
        ).trim();

        if (!include) continue;

        const assembly =
          assemblyByName.get(include);
        const location = String(
          assembly?.location || ""
        )
          .trim()
          .replace(/\\/g, "/")
          .replace(/^\.\//, "");

        references.set(
          include.toLowerCase(),
          {
            include,
            hintPath: location
              ? `$(ResonitePath)${location}`
              : `$(ResonitePath)${include}.dll`,
            private: false
          }
        );
      }

      return [...references.values()];
    }

    function enrichGraphTypeAssemblies(
      graphType,
      csType,
      row = null
    ) {
      const information =
        getTypeInformation(graphType);

      if (!information) return;

      const references =
        assemblyReferencesForCsType(
          csType,
          row
        );
      const assemblies = [...new Set([
        ...(Array.isArray(information.assemblies)
          ? information.assemblies
          : []),
        ...references.map(reference =>
          reference.include
        )
      ])];
      const mergedReferences = new Map();

      for (const reference of [
        ...(Array.isArray(information.assemblyReferences)
          ? information.assemblyReferences
          : []),
        ...references
      ]) {
        const include = String(
          reference?.include || ""
        ).trim();
        if (!include) continue;
        mergedReferences.set(
          include.toLowerCase(),
          reference
        );
      }

      information.assemblies = assemblies;
      information.assemblyReferences =
        [...mergedReferences.values()];
      information.assembly =
        String(row?.assembly || "").trim() ||
        information.assembly ||
        assemblies[0] ||
        "";
    }

    const knownGraphTypes = new Map(Object.entries({
      "System.Boolean": "bool",
      "bool": "bool",
      "System.String": "string",
      "string": "string",
      "System.Uri": "Uri",
      "System.Int32": "int",
      "int": "int",
      "System.Single": "float",
      "float": "float",
      "System.Double": "double",
      "double": "double",
      "System.Byte[]": "byteArray",
      "byte[]": "byteArray",
      "System.String[]": "stringArray",
      "string[]": "stringArray",
      "System.Object[]": "objectArray",
      "object[]": "objectArray",
      "System.Object": "object",
      "object": "object",
      "System.Type": "type",
      "System.Reflection.MemberInfo": "memberInfo",
      "System.Reflection.MethodBase": "methodBase",
      "System.Reflection.MethodInfo": "methodInfo",
      "System.Reflection.FieldInfo": "fieldInfo",
      "System.Reflection.PropertyInfo": "propertyInfo",
      "System.Exception": "exception",
      "System.Threading.Tasks.Task": "task",
      "System.Threading.CancellationToken": "cancellationToken",
      "System.Action": "action",
      "System.Net.WebSockets.ClientWebSocket": "webSocket",
      "System.Text.Json.Nodes.JsonNode": "json",
      "Elements.Core.int2": "int2",
      "Elements.Core.int3": "int3",
      "Elements.Core.int4": "int4",
      "Elements.Core.float2": "float2",
      "Elements.Core.float3": "float3",
      "Elements.Core.float4": "float4",
      "Elements.Core.double2": "double2",
      "Elements.Core.double3": "double3",
      "Elements.Core.double4": "double4",
      "Elements.Core.floatQ": "floatQ",
      "Elements.Core.colorX": "colorX",
      "FrooxEngine.Engine": "engine",
      "FrooxEngine.World": "world",
      "FrooxEngine.User": "user",
      "FrooxEngine.Slot": "slot",
      "FrooxEngine.Component": "component",
      "FrooxEngine.UIX.UIBuilder": "uiBuilder",
      "FrooxEngine.Primitive": "primitive",
      "FrooxEngine.BlendMode": "blendMode",
      "Renderite.Shared.TextureWrapMode": "textureWrapMode",
      "FrooxEngine.IAssetProvider": "asset",
      "FrooxEngine.IAssetProvider<FrooxEngine.ITexture2D>": "texture",
      "FrooxEngine.IAssetProvider<FrooxEngine.Material>": "material",
      "FrooxEngine.ICommonMaterial": "commonMaterial",
      "FrooxEngine.PBS_Material": "pbsMaterial",
      "FrooxEngine.PBS_Metallic": "pbsMetallic",
      "FrooxEngine.PBS_Specular": "pbsSpecular",
      "FrooxEngine.UnlitMaterial": "unlitMaterial",
      "FrooxEngine.IAssetProvider<FrooxEngine.Mesh>": "mesh",
      "FrooxEngine.IAssetProvider<FrooxEngine.AudioClip>": "audioClip",
      "FrooxEngine.MeshRenderer": "meshRenderer",
      "FrooxEngine.Collider": "collider",
      "FrooxEngine.MeshCollider": "meshCollider",
      "FrooxEngine.BoxCollider": "boxCollider",
      "FrooxEngine.SphereCollider": "sphereCollider",
      "FrooxEngine.CylinderCollider": "cylinderCollider",
      "FrooxEngine.QuadMesh": "quadMesh",
      "FrooxEngine.BoxMesh": "boxMesh",
      "FrooxEngine.SphereMesh": "sphereMesh",
      "FrooxEngine.CylinderMesh": "cylinderMesh",
      "FrooxEngine.ArrowMesh": "arrowMesh",
      "FrooxEngine.StaticTexture2D": "staticTexture2D",
      "FrooxEngine.StaticCubemap": "staticCubemap",
      "FrooxEngine.SpriteProvider": "spriteProvider",
      "FrooxEngine.StaticMesh": "staticMesh",
      "FrooxEngine.StaticAudioClip": "staticAudioClip",
      "FrooxEngine.StaticFont": "staticFont",
      "FrooxEngine.Skybox": "skybox",
      "FrooxEngine.Grabbable": "grabbable",
      "FrooxEngine.AudioOutput": "audioOutput",
      "FrooxEngine.DynamicVariableSpace": "dynamicVariableSpace",
      "FrooxEngine.RadiantDash": "radiantDash"
    }));

    for (const [csType, graphType] of knownGraphTypes) {
      const normalizedCsType = normalizeCsType(csType);
      graphTypeByCs.set(normalizedCsType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(normalizedCsType),
        graphType
      );
    }

    for (const [graphType, information] of Object.entries(
      typeof getTypeDefinitions === "function"
        ? getTypeDefinitions()
        : {}
    )) {
      const csType = normalizeCsType(
        information?.csType || ""
      );
      if (!csType || graphTypeByCs.has(csType)) {
        continue;
      }
      graphTypeByCs.set(csType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(csType),
        graphType
      );
    }

    function enumerableElementCsTypeFor(
      fullName,
      row = null,
      visited = new Set()
    ) {
      const csType = normalizeCsType(fullName);

      if (
        !csType ||
        csType === "System.String" ||
        csType === "string"
      ) {
        return null;
      }

      const direct =
        directEnumerableElementCsType(csType);

      if (direct) {
        return normalizeCsType(direct);
      }

      const shape = genericTypeShape(csType);
      const information =
        row?.fullName
          ? row
          : typeByName.get(csType) ||
            genericTypeRowsByShape.get(shape) ||
            null;

      if (!information) {
        return null;
      }

      const visitKey =
        `${csType}|${normalizeCsType(information.fullName)}`;

      if (visited.has(visitKey)) {
        return null;
      }

      visited.add(visitKey);

      const substitutions =
        genericTypeSubstitutions(
          information.fullName,
          csType
        );

      for (const interfaceName of
        Array.isArray(information.interfaces)
          ? information.interfaces
          : []) {
        const closedInterface =
          substituteGenericTypeParameters(
            interfaceName,
            substitutions
          );
        const element =
          directEnumerableElementCsType(
            closedInterface
          ) ||
          enumerableElementCsTypeFor(
            closedInterface,
            null,
            visited
          );

        if (element) {
          return normalizeCsType(element);
        }
      }

      return null;
    }

    function registerApiType(fullName, row = null) {
      const csType = normalizeCsType(fullName);
      if (!csType || csType === "System.Void" || csType === "void") {
        return null;
      }

      const known = graphTypeByCs.get(csType);
      if (known) {
        enrichGraphTypeAssemblies(
          known,
          csType,
          row || typeByName.get(csType) || null
        );
        return known;
      }

      const normalizedLookup =
        normalizeTypeForLookup(csType);
      const existing =
        graphTypeByNormalizedCs.get(
          normalizedLookup
        );
      if (existing) {
        enrichGraphTypeAssemblies(
          existing,
          csType,
          row || typeByName.get(csType) || null
        );
        return existing;
      }

      if (isOpenTypeExpression(csType)) {
        return "object";
      }

      const graphType = apiGraphTypeId(csType);
      const information = row || typeByName.get(csType) || {};
      const referenceType =
        information.kind === "class" ||
        information.kind === "interface" ||
        information.kind === "static-class" ||
        (!information.kind && !looksLikeValueType(csType));
      const label =
        information.name ||
        shortTypeName(csType);
      const color = colorForString(csType);
      const enumerableElementCsType =
        enumerableElementCsTypeFor(
          csType,
          information
        );

      registerType(graphType, {
          label,
          short: shortBadge(label),
          color,
          csType,
          defaultCs: referenceType
              ? "null!"
              : `default(${csType})`,
          referenceType,
          valueType: true,
          globalGenericCandidate: false,

          enumType:
              information.kind === "enum",

          assignableTo: referenceType
              ? ["object"]
              : [],

          constraints:
              information.kind === "enum"
                  ? ["value", "serializable", "enumOrString"]
                  : referenceType
                      ? ["reference", "serializable"]
                      : ["serializable"],

          catalogGenerated: true,
          apiCatalogType: csType,
          assembly:
              String(information.assembly || "").trim(),
          assemblies:
              assemblyReferencesForCsType(
                csType,
                information
              ).map(reference =>
                reference.include
              ),
          assemblyReferences:
              assemblyReferencesForCsType(
                csType,
                information
              )
      });

      graphTypeByCs.set(csType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(csType),
        graphType
      );

      if (
        enumerableElementCsType &&
        !isGenericParameterName(
          enumerableElementCsType
        ) &&
        !isOpenTypeExpression(
          enumerableElementCsType
        )
      ) {
        const elementGraphType =
          normalizeTypeForLookup(
            enumerableElementCsType
          ) ===
          normalizeTypeForLookup(csType)
            ? graphType
            : registerApiType(
                enumerableElementCsType,
                typeByName.get(
                  normalizeCsType(
                    enumerableElementCsType
                  )
                ) || null
              ) || "object";
        const registeredInformation =
          getTypeInformation(graphType);

        if (registeredInformation) {
          registeredInformation
            .enumerableElementType =
              elementGraphType;
          registeredInformation
            .enumerableElementCsType =
              enumerableElementCsType;
          registeredInformation
            .collectionType = true;
          registeredInformation.constraints =
            [...new Set([
              ...(registeredInformation.constraints || []),
              "enumerable"
            ])];
        }
      }

      return graphType;
    }

    let cooperativeWork = 0;

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(row)) {
        continue;
      }
      registerApiType(row.fullName, row);
    }

    for (
      let enumIndex = 0;
      enumIndex < enumRows.length;
      enumIndex += 1
    ) {
      const row = enumRows[enumIndex];
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      const projectionName =
        catalogProjectionTypeName(
          row?.fullName
        );
      if (projectionName) {
        rememberCatalogProjectionRow(
          projectionEnumByName,
          projectionName,
          row,
          enumIndex
        );
      }
      if (!row || row.isObsolete || !row.fullName) {
        continue;
      }
      registerApiType(row.fullName, {
        fullName: row.fullName,
        name: shortTypeName(row.fullName),
        kind: "enum"
      });
    }

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 80 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(row)) {
        continue;
      }

      const graphType = graphTypeByCs.get(normalizeCsType(row.fullName));
      const information = graphType && getTypeInformation(graphType);
      if (!graphType || !information) {
        continue;
      }

      const assignable = new Set(information.assignableTo || []);
      const queue = [row.baseType, ...(Array.isArray(row.interfaces) ? row.interfaces : [])]
        .filter(Boolean)
        .map(normalizeCsType);
      const visited = new Set();

      while (queue.length > 0) {
        const candidate = queue.shift();
        if (!candidate || visited.has(candidate)) {
          continue;
        }
        visited.add(candidate);

        const targetGraphType = registerApiType(candidate, typeByName.get(candidate));
        if (targetGraphType && targetGraphType !== graphType) {
          assignable.add(targetGraphType);
        }

        const targetRow = typeByName.get(candidate);
        if (targetRow) {
          if (targetRow.baseType) {
            queue.push(normalizeCsType(targetRow.baseType));
          }
          for (const implemented of targetRow.interfaces || []) {
            queue.push(normalizeCsType(implemented));
          }
        }
      }

      if (row.isComponent) assignable.add("component");
      if (row.isMaterial) assignable.add("material");
      if (row.isCommonMaterial) assignable.add("commonMaterial");
      if (row.isMeshProvider) assignable.add("mesh");
      if (row.isTextureProvider) assignable.add("texture");
      if (row.isAudioClipProvider) assignable.add("audioClip");
      if (row.isCollider) assignable.add("collider");
      if (information.referenceType) assignable.add("object");

      information.assignableTo = [...assignable];
    }

    let typeNodeCount = 0;
    let enumNodeCount = 0;
    let constructorNodeCount = 0;
    let methodNodeCount = 0;
    let propertyNodeCount = 0;
    let fieldNodeCount = 0;
    let eventNodeCount = 0;
    let runtimeBoundMethodCount = 0;
    let skippedCount = 0;

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(row)) {
        continue;
      }
      const csType = normalizeCsType(row.fullName);
      const id = `api.type.${stableHash(csType)}`;
      registerGeneratedNode(id, withReloadContract({
        title: `Type · ${displayTypeName(row)}`,
        group: groupForType(row, API_GROUPS.types),
        symbol: "TYPE",
        description: `Exact System.Type constant for ${csType}.`,
        outputs: [port("value", "Type", "type")],
        codegenExpression() {
          return `typeof(${csType})`;
        },
        catalogGenerated: true,
        catalogType: csType,
        apiStableContractId:
          String(row.stableContractId || ""),
        apiMemberKind: "type",
        apiSignature: `typeof(${csType})`,
        apiParameters: [],
        apiReturnType: "System.Type",
        apiSearchText: `${csType} type typeof`
      }, row,
      row.typeTokenReloadSafety ||
      row.reloadSafety,
      { member: row }));
      typeNodeCount += 1;
    }

    for (const enumRow of enumRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!enumRow || enumRow.isObsolete || !enumRow.fullName) {
        continue;
      }
      const values = Array.isArray(enumRow.values)
        ? enumRow.values.filter(value =>
            value &&
            value.name &&
            isCSharpIdentifier(value.name)
          )
        : [];
      if (values.length === 0) {
        skippedCount += 1;
        continue;
      }

      const csType = normalizeCsType(enumRow.fullName);
      const graphType = registerApiType(csType, {
        fullName: csType,
        name: shortTypeName(csType),
        kind: "enum"
      });
      const id = `api.enum.${stableHash(csType)}`;
      const options = values.map(value => [value.name, value.name]);
      const defaultValue = values[0].name;

      registerGeneratedNode(id, withReloadContract({
        title: `Enum · ${shortTypeName(csType)}`,
        group: groupForType(
          { fullName: csType },
          API_GROUPS.types
        ),
        symbol: "ENUM",
        description: `Typed constant for ${csType}.`,
        parameters: [{
          key: "value",
          label: "Value",
          kind: "select",
          options,
          default: defaultValue,
          help: enumRow.isFlags
            ? "This is a [Flags] enum. This constant selects one declared value."
            : "Select one declared enum value."
        }],
        outputs: [port("value", "Value", graphType || "object")],
        codegenExpression(api) {
          const selected = String(api.node.parameters?.value || defaultValue);
          return `${csType}.${escapeCSharpIdentifier(selected)}`;
        },
        catalogGenerated: true,
        catalogType: csType,
        apiMemberKind: "enum",
        apiSignature: csType,
        apiParameters: [],
        apiReturnType: csType,
        apiSearchText: `${csType} ${values.map(value => value.name).join(" ")}`
      }, enumRow,
      enumRow.valueReloadSafety,
      { member: enumRow }));
      enumNodeCount += 1;
    }

    const eventTemplate = findDefinitionByTitle(
      definitions,
      title => /subscribe\b.*\bevent/i.test(title)
    );

    for (const owner of typeRows) {
      if ((cooperativeWork += 1) % 12 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(owner)) {
        continue;
      }

      const constructors = Array.isArray(owner.constructors)
        ? owner.constructors
        : [];
      constructors.forEach((constructor, index) => {
        if (!constructor || !Array.isArray(constructor.parameters)) {
          skippedCount += 1;
          return;
        }
        const definition =
          createConstructorDefinition(
            owner,
            constructor
          );
        if (!definition) {
          skippedCount += 1;
          return;
        }
        const prefix = "api.ctor.";
        const legacyBase =
          `${owner.fullName}|${constructor.signature}`;
        const id = canonicalMemberNodeId(
          prefix,
          definition
        );
        if (registerGeneratedNode(id, definition)) {
          constructorNodeCount += 1;
          registerLegacyMember(
            prefix,
            legacyBase,
            index,
            constructors.length,
            id
          );
        }
      });

      const methods = Array.isArray(owner.methods)
        ? owner.methods
        : [];
      for (const method of methods) {
        if (!method || method.isObsolete || !method.name) {
          skippedCount += 1;
          continue;
        }
        const definition = createMethodDefinition(owner, method);
        if (!definition) {
          skippedCount += 1;
          continue;
        }
        const id = canonicalMemberNodeId(
          "api.method.",
          definition
        );
        if (definition.runtimeBound) {
          runtimeBoundMethodCount += 1;
        }
        if (registerGeneratedNode(id, definition)) {
          methodNodeCount += 1;
        }
      }

      const properties = Array.isArray(owner.properties)
        ? owner.properties
        : [];
      properties.forEach((property, index) => {
        if (!property || property.isObsolete || !property.name) {
          skippedCount += 1;
          return;
        }
        const legacyBase =
          `${owner.fullName}|${property.name}|${property.type}`;
        if (property.canRead) {
          const prefix =
            "api.property.get.";
          const definition =
            createPropertyGetDefinition(
              owner,
              property
            );
          const id = definition
            ? canonicalMemberNodeId(
                prefix,
                definition
              )
            : "";
          if (
            id &&
            registerGeneratedNode(
              id,
              definition
            )
          ) {
            propertyNodeCount += 1;
            registerLegacyMember(
              prefix,
              legacyBase,
              index,
              properties.length,
              id
            );
          } else {
            skippedCount += 1;
          }
        }
        if (property.canWrite) {
          const prefix =
            "api.property.set.";
          const definition =
            createPropertySetDefinition(
              owner,
              property
            );
          const id = definition
            ? canonicalMemberNodeId(
                prefix,
                definition
              )
            : "";
          if (
            id &&
            registerGeneratedNode(
              id,
              definition
            )
          ) {
            propertyNodeCount += 1;
            registerLegacyMember(
              prefix,
              legacyBase,
              index,
              properties.length,
              id
            );
          } else {
            skippedCount += 1;
          }
        }
      });

      const fields = Array.isArray(owner.fields)
        ? owner.fields
        : [];
      fields.forEach((field, index) => {
        if (!field || field.isObsolete || !field.name) {
          skippedCount += 1;
          return;
        }
        const legacyBase =
          `${owner.fullName}|${field.name}|${field.type}`;
        const getPrefix = "api.field.get.";
        const getDefinition =
          createFieldGetDefinition(
            owner,
            field
          );
        const getId = getDefinition
          ? canonicalMemberNodeId(
              getPrefix,
              getDefinition
            )
          : "";
        if (
          getId &&
          registerGeneratedNode(
            getId,
            getDefinition
          )
        ) {
          fieldNodeCount += 1;
          registerLegacyMember(
            getPrefix,
            legacyBase,
            index,
            fields.length,
            getId
          );
        } else {
          skippedCount += 1;
        }

        if (!field.isReadOnly && !field.isConst) {
          const setPrefix =
            "api.field.set.";
          const setDefinition =
            createFieldSetDefinition(
              owner,
              field
            );
          const setId = setDefinition
            ? canonicalMemberNodeId(
                setPrefix,
                setDefinition
              )
            : "";
          if (
            setId &&
            registerGeneratedNode(
              setId,
              setDefinition
            )
          ) {
            fieldNodeCount += 1;
            registerLegacyMember(
              setPrefix,
              legacyBase,
              index,
              fields.length,
              setId
            );
          } else {
            skippedCount += 1;
          }
        }
      });

      const events = Array.isArray(owner.events)
        ? owner.events
        : [];
      for (const eventInfo of events) {
        if (!eventInfo || eventInfo.isObsolete || !eventInfo.name) {
          skippedCount += 1;
          continue;
        }
        const eventDefinition = createEventDefinition(owner, eventInfo, eventTemplate);
        if (!eventDefinition) {
          skippedCount += 1;
          continue;
        }
        registerGeneratedNode(
          `api.event.${stableHash(`${owner.fullName}|${eventInfo.name}|${eventInfo.handlerType}`)}`,
          eventDefinition
        );
        eventNodeCount += 1;
      }
    }

    legacyOperatorResolver =
      async (
        requiredNodes,
        _catalog,
        resolutionRegistry = registry
      ) => {
        const resolutionDefinitions =
          typeof resolutionRegistry
            ?.getNodeDefinitions ===
              "function"
            ? resolutionRegistry
                .getNodeDefinitions()
            : definitions;
        const resolutionRegisterNode =
          typeof resolutionRegistry
            ?.registerNode === "function"
            ? resolutionRegistry
                .registerNode
                .bind(resolutionRegistry)
            : registerNode;
        const definitionRevisionBeforeResolution =
          Number(
            window.__RMLNodeDefinitionRevision
          ) || 0;
        const stagedResolutionAliases =
          Object.create(null);
        const stagedResolutionDefinitions =
          new Proxy(stagedResolutionAliases, {
            get(target, property) {
              return Object.prototype
                .hasOwnProperty.call(
                  target,
                  property
                )
                ? target[property]
                : resolutionDefinitions[
                    property
                  ];
            }
          });
        const stageResolutionAlias =
          (id, definition) => {
            if (
              resolutionDefinitions[id] ||
              stagedResolutionAliases[id]
            ) {
              return false;
            }
            stagedResolutionAliases[id] =
              definition;
            return true;
          };
        const resolvedProjectionDefinitions = [];
        const registerResolutionLegacyAlias =
          (id, entry) => {
            const existed = Boolean(
              stagedResolutionDefinitions[id]
            );
            const registered =
              registerLegacyAlias(
                id,
                entry,
                stagedResolutionDefinitions,
                stageResolutionAlias
              );
            if (
              registered &&
              !existed &&
              stagedResolutionDefinitions[id]
            ) {
              resolvedProjectionDefinitions.push([
                id,
                stagedResolutionDefinitions[id]
              ]);
            }
            return registered;
          };
        const requirements =
          (Array.isArray(requiredNodes)
            ? requiredNodes
            : [])
            .filter(value => {
              const id = String(
                typeof value === "string"
                  ? value
                  : value?.operatorId || ""
              ).trim();
              const contract =
                typeof value === "string"
                  ? null
                  : value?.apiContract;
              return id.startsWith("api.") ||
                Boolean(
                  String(contract?.ownerType || "").trim() &&
                  String(contract?.kind || "").trim()
                );
            });
        const requiredIds = new Set(
          requirements
            .map(value =>
              String(
                typeof value === "string"
                  ? value
                  : value?.operatorId || ""
              ).trim()
            )
            .filter(Boolean)
        );
        const requirementFamiliesById =
          new Map();
        for (const requirement of
          requirements) {
          const id = String(
            typeof requirement === "string"
              ? requirement
              : requirement?.operatorId || ""
          ).trim();
          if (!id) continue;
          const values =
            requirementFamiliesById.get(id) ||
            [];
          values.push(requirement);
          requirementFamiliesById.set(
            id,
            values
          );
        }
        const conflictingFamilyIds =
          new Set(
            [...requirementFamiliesById]
              .filter(([, values]) =>
                values.length > 1
              )
              .map(([id]) => id)
          );
        const requested =
          requirements.length;
        let resolved = 0;
        let attempts = 0;
        const migrations = {};
        const portMigrations = {};
        const unresolvedDetails = {};

        const semanticContractKey =
          exactApiSemanticContractKey;
        const portRows = (contract, direction) => {
          const key = direction === "input" ? "inputPorts" : "outputPorts";
          return (Array.isArray(contract?.[key]) ? contract[key] : []).map(port => ({
            ...port,
            id: String(port?.id || ""),
            type: String(port?.type || "object"),
            role: portablePortRole(contract?.kind, direction, port, contract?.parameters)
          }));
        };
        const requiredPortMigration = (requiredContract, availableContract, inputIds, outputIds) => {
          const result = { input: {}, output: {} };
          for (const [direction, requiredIds] of [["input", inputIds], ["output", outputIds]]) {
            const oldRows = portRows(requiredContract, direction);
            const newRows = portRows(availableContract, direction);
            const newByRole = new Map();
            for (const row of newRows) {
              if (!newByRole.has(row.role)) newByRole.set(row.role, []);
              newByRole.get(row.role).push(row);
            }
            for (const oldId of requiredIds) {
              const oldRow = oldRows.find(row => row.id === oldId) || {
                id: oldId,
                type: "object",
                role: portablePortRole(requiredContract?.kind, direction, { id: oldId }, requiredContract?.parameters)
              };
              const matches = newByRole.get(oldRow.role) || [];
              if (matches.length !== 1) return null;
              const replacement = matches[0];
              if (
                oldRow.type && replacement.type &&
                oldRow.type !== "object" && replacement.type !== "object" &&
                oldRow.type !== replacement.type
              ) {
                return null;
              }
              result[direction][oldId] = replacement.id;
            }
          }
          return result;
        };
        const normalizedLegacyName = value =>
          String(value || "")
            .trim()
            .replace(
              /^api\s*[·:|-]\s*/i,
              ""
            )
            .replace(
              /^(?:get|set|new|construct)\s*[·:|-]\s*/i,
              ""
            )
            .replace(/\s+/g, "")
            .toLocaleLowerCase();
        const requirementById =
          new Map(
            requirements.map(requirement => [
              String(
                typeof requirement === "string"
                  ? requirement
                  : requirement?.operatorId || ""
              ).trim(),
              requirement
            ])
          );
        const normalizedSemanticType = value =>
          String(value || "")
            .replace(/^global::/, "")
            .replace(/\s+/g, "")
            .replace(/&$/, "");
        const semanticContractDiscriminator =
          value => {
            if (
              !value ||
              typeof value !== "object" ||
              Array.isArray(value)
            ) {
              return "";
            }
            const kind = String(
              value.kind ||
              value.apiMemberKind ||
              ""
            ).trim();
            const ownerType =
              normalizedSemanticType(
                value.ownerType ||
                value.catalogType ||
                ""
              );
            if (!kind || !ownerType) {
              return "";
            }
            return JSON.stringify({
              kind,
              ownerType,
              memberName: String(
                value.memberName ??
                value.catalogMember ??
                ""
              ),
              isStatic:
                value.isStatic === true ||
                value.apiIsStatic === true,
              genericArity: Math.max(
                0,
                Number(
                  value.genericArity ??
                  value.apiGenericArity
                ) || 0
              )
            });
          };
        const semanticKeyById =
          new Map();
        const requestedSemanticKeys =
          new Set();
        const requestedSemanticDiscriminators =
          new Set();

        for (const requirement of
          requirements) {
          const id = String(
            typeof requirement === "string"
              ? requirement
              : requirement?.operatorId || ""
          ).trim();
          if (
            !id ||
            conflictingFamilyIds.has(id) ||
            typeof requirement === "string"
          ) {
            continue;
          }
          const contract =
            requirement?.apiContract;
          const key =
            semanticContractKey(contract);
          const discriminator =
            semanticContractDiscriminator(
              contract
            );
          if (!key || !discriminator) {
            continue;
          }
          semanticKeyById.set(id, key);
          requestedSemanticKeys.add(key);
          requestedSemanticDiscriminators
            .add(discriminator);
        }

        const semanticCandidatesByKey =
          new Map(
            [...requestedSemanticKeys]
              .map(key => [key, []])
          );
        if (
          requestedSemanticKeys.size > 0
        ) {
          let scannedDefinitions = 0;
          for (const id in
            resolutionDefinitions) {
            if (
              !Object.prototype
                .hasOwnProperty.call(
                  resolutionDefinitions,
                  id
                )
            ) {
              continue;
            }
            scannedDefinitions += 1;
            if (
              scannedDefinitions % 4096 ===
                0
            ) {
              await yieldToBrowser();
            }
            const definition =
              resolutionDefinitions[id];
            if (
              definition?.catalogGenerated !==
                true ||
              definition?.legacyCatalogAlias ===
                true ||
              !requestedSemanticDiscriminators
                .has(
                  semanticContractDiscriminator(
                    definition
                  )
                )
            ) {
              continue;
            }

            const key = semanticContractKey(
              definition.apiVerification
            );
            const matches =
              semanticCandidatesByKey.get(
                key
              );
            if (matches) {
              matches.push(id);
            }
          }
        }

        const entryNames = entry => {
          const definition =
            resolutionDefinitions[
              entry.canonicalId
            ];
          const owner = shortTypeName(
            definition?.catalogType || ""
          );
          const member = String(
            definition?.catalogMember || ""
          ).trim();
          return new Set(
            [
              definition?.title,
              owner && member
                ? `${owner}.${member}`
                : ""
            ]
              .map(normalizedLegacyName)
              .filter(Boolean)
          );
        };
        const legacyPrefixes = [
          ...legacyAliasPrefixes
        ].sort((left, right) =>
          right.length - left.length
        );
        const hintedLegacyEntriesById =
          new Map();
        const requestedLegacyHintsByPrefix =
          new Map();

        for (const oldId of requiredIds) {
          const matches = new Set();
          hintedLegacyEntriesById.set(
            oldId,
            matches
          );
          if (
            conflictingFamilyIds.has(oldId)
          ) {
            continue;
          }
          const requirement =
            requirementById.get(oldId);
          const labels =
            typeof requirement === "string"
              ? []
              : Array.isArray(
                    requirement?.nodeLabels
                  )
                ? requirement.nodeLabels
                : [];
          const hints = new Set(
            labels
              .map(normalizedLegacyName)
              .filter(Boolean)
          );
          const prefix =
            legacyPrefixes.find(value =>
              oldId.startsWith(value)
            ) || "";
          if (!prefix || hints.size === 0) {
            continue;
          }
          if (
            !requestedLegacyHintsByPrefix
              .has(prefix)
          ) {
            requestedLegacyHintsByPrefix.set(
              prefix,
              new Map()
            );
          }
          const names =
            requestedLegacyHintsByPrefix
              .get(prefix);
          for (const hint of hints) {
            if (!names.has(hint)) {
              names.set(hint, new Set());
            }
            names.get(hint).add(oldId);
          }
        }

        if (
          requestedLegacyHintsByPrefix.size >
            0
        ) {
          let scannedLegacyEntries = 0;
          for (const entry of
            legacyAliasEntries) {
            scannedLegacyEntries += 1;
            if (
              scannedLegacyEntries % 4096 ===
                0
            ) {
              await yieldToBrowser();
            }
            const requestedNames =
              requestedLegacyHintsByPrefix
                .get(entry.prefix);
            if (!requestedNames) {
              continue;
            }
            for (const name of
              entryNames(entry)) {
              const requestedIds =
                requestedNames.get(name);
              if (!requestedIds) {
                continue;
              }
              for (const oldId of
                requestedIds) {
                hintedLegacyEntriesById
                  .get(oldId)
                  ?.add(entry);
              }
            }
          }
        }

        const exactReferencedPortsExist =
          (oldId, entry) => {
            const requirement =
              requirementById.get(oldId);
            const definition =
              resolutionDefinitions[
                entry.canonicalId
              ];
            if (!definition) {
              return false;
            }
            const inputs = new Set(
              (Array.isArray(
                definition.inputs
              )
                ? definition.inputs
                : []).map(port =>
                  String(port?.id || "")
                )
            );
            const outputs = new Set(
              (Array.isArray(
                definition.outputs
              )
                ? definition.outputs
                : []).map(port =>
                  String(port?.id || "")
                )
            );
            return (
              (Array.isArray(
                requirement?.inputPorts
              )
                ? requirement.inputPorts
                : []
              ).every(portId =>
                inputs.has(String(portId))
              ) &&
              (Array.isArray(
                requirement?.outputPorts
              )
                ? requirement.outputPorts
                : []
              ).every(portId =>
                outputs.has(String(portId))
              )
            );
          };

        for (const requirement of
          requirements) {
          const oldId = String(
            typeof requirement === "string"
              ? requirement
              : requirement?.operatorId || ""
          ).trim();

          if (!requiredIds.has(oldId)) {
            continue;
          }
          if (
            conflictingFamilyIds.has(oldId)
          ) {
            unresolvedDetails[oldId] =
              "the stored operator ID is used by multiple portable contract or parameter families; each instance family requires an explicit node-scoped resolution";
            continue;
          }

          const key =
            semanticKeyById.get(oldId) ||
            "";
          const requiredContract =
            typeof requirement === "string"
              ? null
              : requirement?.apiContract;
          const exactCandidates = key
            ? semanticCandidatesByKey
                .get(key) || []
            : [];
          const candidates =
            exactCandidates;
          const inputPorts = new Set(
            Array.isArray(requirement?.inputPorts)
              ? requirement.inputPorts.map(String)
              : []
          );
          const outputPorts = new Set(
            Array.isArray(requirement?.outputPorts)
              ? requirement.outputPorts.map(String)
              : []
          );
          const compatible = candidates.map(
            candidateId => {
              const candidate =
                resolutionDefinitions[
                  candidateId
                ];
              const portMigration = requiredPortMigration(
                requiredContract,
                candidate?.apiVerification,
                [...inputPorts],
                [...outputPorts]
              );
              return portMigration ? { candidateId, portMigration } : null;
            }
          ).filter(Boolean);

          if (
            compatible.length === 1 &&
            (
              Boolean(
                resolutionDefinitions[
                  oldId
                ]
              ) ||
              registerResolutionLegacyAlias(
                oldId,
                {
                  canonicalId: compatible[0].candidateId
                }
              )
            )
          ) {
            requiredIds.delete(oldId);
            resolved += 1;
            migrations[oldId] =
              compatible[0].candidateId;
            portMigrations[oldId] =
              compatible[0].portMigration;
          } else if (candidates.length > 0) {
            unresolvedDetails[oldId] =
              compatible.length > 1
                ? `exact semantic contract is ambiguous (${compatible.length} candidates)`
                : "exact semantic contract exists but its referenced port contract changed";
          } else if (key) {
            unresolvedDetails[oldId] =
              "no exactly identical API contract exists in the current catalog; explicit replacement selection is required";
          }
        }

        const scannedUntil = new Map();
        const scanStages = [
          256,
          512,
          1024,
          2048
        ];

        for (const scanStage of
          scanStages) {
          if (requiredIds.size === 0) {
            break;
          }

          const candidateEntries = [
            ...new Set(
              [...requiredIds].flatMap(id =>
                [
                  ...(hintedLegacyEntriesById
                    .get(id) || [])
                ]
              )
            )
          ];

          for (const entry of
            candidateEntries) {
            if (requiredIds.size === 0) {
              break;
            }

            const relevantIds =
              [...requiredIds].filter(id =>
                !conflictingFamilyIds.has(id) &&
                (
                  hintedLegacyEntriesById
                    .get(id)
                )?.has(entry) === true
              );
            if (relevantIds.length === 0) {
              continue;
            }

            const start =
              scannedUntil.get(entry) ||
              0;
            const limit = Math.min(
              2048,
              Math.max(
                scanStage,
                entry.groupSize + 128,
                entry.currentIndex + 1
              )
            );

            for (
              let historicalIndex = start;
              historicalIndex < limit;
              historicalIndex += 1
            ) {
              const legacyId =
                `${entry.prefix}${stableHash(`${entry.legacyBase}|${historicalIndex}`)}`;
              attempts += 1;

              if (
                relevantIds.includes(legacyId) &&
                exactReferencedPortsExist(
                  legacyId,
                  entry
                ) &&
                registerResolutionLegacyAlias(
                  legacyId,
                  entry
                )
              ) {
                requiredIds.delete(
                  legacyId
                );
                resolved += 1;
                migrations[legacyId] =
                  stagedResolutionDefinitions[
                    legacyId
                  ]
                    ?.canonicalOperatorId ||
                  legacyId;
                if (
                  relevantIds.every(id =>
                    !requiredIds.has(id)
                  )
                ) {
                  break;
                }
              }

              if (attempts % 4096 === 0) {
                await yieldToBrowser();
              }
            }

            scannedUntil.set(
              entry,
              limit
            );
          }

          if (requiredIds.size > 0) {
            await yieldToBrowser();
          }
        }

        for (const oldId of requiredIds) {
          if (!unresolvedDetails[oldId]) {
            unresolvedDetails[oldId] =
              (
                hintedLegacyEntriesById
                  .get(oldId)
              )?.size > 0
                ? "the exact legacy name was found, but its historical hash identity or referenced port contract did not match"
                : "no portable API contract or exact stored API node name is available; manual catalog replacement is required";
          }
        }

        if (resolved > 0) {
          const committedAliases = [];
          try {
            for (const [id, definition] of
              resolvedProjectionDefinitions) {
              if (
                resolutionDefinitions[id] ||
                resolutionRegisterNode(
                  id,
                  definition
                ) === false
              ) {
                throw new Error(
                  `The compatible API alias '${id}' changed before publication.`
                );
              }
              committedAliases.push([
                id,
                definition
              ]);
            }
            window.__RMLNodeDefinitionRevision =
              (Number(
                window.__RMLNodeDefinitionRevision
              ) || 0) + 1;
            if (
              !refreshPublishedCatalogProjectionIndex(
                resolvedProjectionDefinitions
              )
            ) {
              throw new Error(
                "The compatible API alias could not be published with its definition-scoped catalog index."
              );
            }
          } catch (error) {
            for (const [id, definition] of
              committedAliases) {
              if (
                resolutionDefinitions[id] ===
                  definition
              ) {
                delete resolutionDefinitions[id];
              }
            }
            for (const [id] of
              resolvedProjectionDefinitions) {
              legacyAliasIds.delete(id);
            }
            window.__RMLNodeDefinitionRevision =
              definitionRevisionBeforeResolution;
            throw error;
          }
          compatibleLegacyAliasRevision += 1;
          window.dispatchEvent(
            new CustomEvent(
              "rml-api-node-factory-ready",
              {
                detail:
                  window.RMLApiNodeFactoryReport ||
                  null
              }
            )
          );
        }

        return Object.freeze({
          attempted: requested > 0,
          requested,
          resolved,
          unresolved: requiredIds.size,
          attempts,
          migrations:
            Object.freeze({
              ...migrations
            }),
          portMigrations:
            Object.freeze(structuredClone(portMigrations)),
          unresolvedDetails:
            Object.freeze({
              ...unresolvedDetails
            })
        });
      };

    const generatedTypeCount =
      Object.values(
        getTypeDefinitions()
      ).filter(information =>
        information?.catalogGenerated ===
          true
      ).length;
    if (generatedTypeCount === 0) {
      verificationErrors.push(
        "The catalog factory generated no API graph types."
      );
    }
    if (generatedNodeIds.size === 0) {
      verificationErrors.push(
        "The catalog factory generated no API node definitions."
      );
    }

    const report = Object.freeze({
      moduleId:
        API_FACTORY_MODULE_ID,
      factoryVersion: FACTORY_VERSION,
      verificationSchemaVersion:
        API_VERIFICATION_SCHEMA_VERSION,
      catalogSchemaVersion,
      engineVersion,
      catalogSource,
      catalogFingerprint,
      catalogProjectionRevision,
      liveCatalogVerified:
        catalogSource === "scanner" &&
        engineVersion !== "unknown" &&
        catalogSchemaVersion > 0 &&
        Boolean(catalogFingerprint),
      verificationPassed:
        verificationErrors.length === 0,
      verificationErrors:
        Object.freeze([...verificationErrors]),
      generatedTypes:
        generatedTypeCount,
      rejectedGeneratedNodes:
        rejectedGeneratedNodeIds.size,
      registeredTypes: graphTypeByCs.size,
      typeNodes: typeNodeCount,
      enumNodes: enumNodeCount,
      constructorNodes: constructorNodeCount,
      methodNodes: methodNodeCount,
      runtimeBoundMethods: runtimeBoundMethodCount,
      propertyNodes: propertyNodeCount,
      fieldNodes: fieldNodeCount,
      eventNodes: eventNodeCount,
      legacyAliases:
        legacyAliasIds.size,
      legacyAliasCandidates:
        legacyAliasEntries.length,
      skippedMembers: skippedCount,
      totalGeneratedNodes: generatedNodeIds.size
    });
    const catalogProjectionIndex =
      Object.freeze({
        version:
          CATALOG_PROJECTION_INDEX_VERSION,
        catalog,
        report,
        catalogFingerprint,
        engineVersion,
        revision:
          catalogProjectionRevision,
        typeByName:
          catalogProjectionLookup(
            projectionTypeByName
          ),
        enumByName:
          catalogProjectionLookup(
            projectionEnumByName
          ),
        genericTypeByShape:
          catalogProjectionLookup(
            projectionGenericTypeByShape
          ),
        assemblyByName:
          catalogProjectionLookup(
            projectionAssemblyByName
          )
      });
    catalogProjectionIndexByReport.set(
      report,
      catalogProjectionIndex
    );

    if (publish) {
      const publishedDefinitionRevision =
        (Number(
          window.__RMLNodeDefinitionRevision
        ) || 0) + 1;
      const publishedCustomState =
        createCatalogProjectionCustomState();
      for (const operatorId of
        generatedNodeIds) {
        appendCatalogProjectionCustomDefinition(
          publishedCustomState,
          operatorId,
          definitions[operatorId]
        );
      }
      const publishedCatalogProjectionIndex =
        completeCatalogProjectionIndex(
          catalogProjectionIndex,
          publishedCustomState,
          publishedDefinitionRevision
        );
      catalogProjectionIndexByReport.set(
        report,
        publishedCatalogProjectionIndex
      );
      window.RMLApiNodeFactoryReport = report;
      window.__RMLNodeDefinitionRevision =
        publishedDefinitionRevision;
      publishCatalogProjectionIndex(
        publishedCatalogProjectionIndex
      );
      window.dispatchEvent(
        new CustomEvent("rml-api-node-factory-ready", { detail: report })
      );
      const workerContext =
        typeof WorkerGlobalScope !==
          "undefined" &&
        globalThis instanceof
          WorkerGlobalScope;
      console.info(
        workerContext
          ? "RML API Node Factory ready (graph-codegen worker)."
          : "RML API Node Factory ready (main thread).",
        report
      );
    }

    return report;

    function canonicalMemberNodeId(
      prefix,
      definition
    ) {
      const identity = {
        kind: String(
          definition?.apiMemberKind ||
          ""
        ),
        ownerType: normalizeCsType(
          definition?.catalogType || ""
        ),
        memberName: String(
          definition?.catalogMember || ""
        ),
        parameters:
          (Array.isArray(
            definition?.apiParameters
          )
            ? definition.apiParameters
            : [])
            .map((parameter, index) => ({
              position: Math.max(
                0,
                Number(
                  parameter?.position
                ) || index
              ),
              type: catalogExactType(
                parameter?.elementType ||
                parameter?.type ||
                "System.Object"
              ),
              isByRef:
                parameter?.isByRef === true ||
                parameter?.isOut === true,
              isOut:
                parameter?.isOut === true
            })),
        returnType: catalogExactType(
          definition?.apiReturnType ||
          "System.Void"
        ),
        isStatic:
          definition?.apiIsStatic === true,
        genericArity: Math.max(
          0,
          Number(
            definition?.apiGenericArity
          ) || 0
        )
      };

      return `${prefix}${stableHash(
        JSON.stringify(identity)
      )}`;
    }

    function registerLegacyMember(
      prefix,
      legacyBase,
      currentIndex,
      groupSize,
      canonicalId
    ) {
      const entry = Object.freeze({
        prefix,
        legacyBase,
        currentIndex: Math.max(
          0,
          Number(currentIndex) || 0
        ),
        groupSize: Math.max(
          0,
          Number(groupSize) || 0
        ),
        canonicalId
      });
      legacyAliasEntries.push(entry);
      legacyAliasPrefixes.add(prefix);
      return true;
    }

    function registerLegacyAlias(
      id,
      entry,
      targetDefinitions = definitions,
      targetRegisterNode = registerNode
    ) {
      const existing =
        targetDefinitions[id];
      if (existing) {
        return (
          id === entry.canonicalId ||
          existing.canonicalOperatorId ===
            entry.canonicalId
        );
      }

      const canonical =
        targetDefinitions[
          entry.canonicalId
        ];
      if (!canonical) {
        return false;
      }

      const aliasDefinition = {
        ...canonical,
        hiddenFromPalette: true,
        legacyCatalogAlias: true,
        canonicalOperatorId:
          entry.canonicalId
      };
      const verification =
        createApiVerificationContract(
          id,
          aliasDefinition
        );

      if (!verification.ok) {
        return false;
      }

      aliasDefinition.apiVerification =
        Object.freeze(
          verification.contract
        );

      const registered =
        targetRegisterNode(
          id,
          aliasDefinition
        );
      if (registered === false) {
        return false;
      }

      legacyAliasIds.add(id);
      return true;
    }

    function installCustomCSharpSyntaxContract(definition) {
      const kind = String(definition?.apiMemberKind || "");
      const supported = new Set([
        "method",
        "constructor",
        "property-get",
        "property-set",
        "field-get",
        "field-set",
        "type"
      ]);
      if (!supported.has(kind)) return definition;

      const owner = normalizeCsType(definition.catalogType || "");
      const member = escapeCSharpIdentifier(definition.catalogMember || "");
      const parameters = Array.isArray(definition.apiParameters)
        ? definition.apiParameters
        : [];
      const genericArity = Math.max(0, Number(definition.apiGenericArity) || 0);
      const input = (context, id) => String(context.input(id) || "").trim();
      const argument = (context, parameter) => {
        const position = Math.max(0, Number(parameter?.position) || 0);
        const value = input(context, `arg${position}`) ||
          String(parameter?.defaultValueCSharp || "default");
        if (parameter?.isOut === true) return `out ${value}`;
        if (parameter?.isByRef === true) return `${parameter?.isIn === true ? "in" : "ref"} ${value}`;
        return value;
      };
      const host = context => definition.apiIsStatic === true
        ? String(context.node?.parameters?.customCSharpStaticTarget || owner)
        : input(context, "target");
      const genericSuffix = context => {
        if (genericArity === 0) return "";
        const types = Array.from({ length: genericArity }, (_, index) =>
          input(context, `generic${index}`) || "object"
        );
        return `<${types.join(", ")}>`;
      };

      definition.customCSharpCatalogNode = true;
      definition.customCSharpOutputPort =
        kind === "method"
          ? (definition.outputs || []).some(port => port.id === "result") ? "result" : "done"
          : kind === "constructor" ? "result"
            : kind === "property-get" || kind === "field-get" || kind === "type" ? "value"
              : "done";
      definition.syntaxRender = context => {
        if (kind === "type") return `typeof(${owner})`;
        if (kind === "constructor") {
          const type = String(context.node?.parameters?.customCSharpTypeText || owner);
          return `new ${type}(${parameters.filter(parameter => parameter?.isOut !== true).map(parameter => argument(context, parameter)).join(", ")})`;
        }
        if (kind === "method") {
          const receiver = host(context);
          const callTarget = receiver ? `${receiver}.${member}` : member;
          return `${callTarget}${genericSuffix(context)}(${parameters.map(parameter => argument(context, parameter)).join(", ")})`;
        }
        if (kind === "property-get") {
          const receiver = host(context);
          if (parameters.length > 0) {
            return `${receiver}[${parameters.map(parameter => argument(context, parameter)).join(", ")}]`;
          }
          return `${receiver}.${member}`;
        }
        if (kind === "field-get") return `${host(context)}.${member}`;
        if (kind === "property-set") {
          const receiver = host(context);
          const indexes = parameters.slice(0, -1);
          const access = indexes.length > 0
            ? `${receiver}[${indexes.map(parameter => argument(context, parameter)).join(", ")}]`
            : `${receiver}.${member}`;
          return `${access} = ${input(context, "value") || "default"}`;
        }
        if (kind === "field-set") {
          return `${host(context)}.${member} = ${input(context, "value") || "default"}`;
        }
        return "";
      };
      return definition;
    }

    function registerGeneratedNode(id, definition) {
      if (!definition) {
        rejectedGeneratedNodeIds.add(id);
        return false;
      }

      installCustomCSharpSyntaxContract(definition);

      const verification =
        createApiVerificationContract(
          id,
          definition
        );

      if (!verification.ok) {
        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${id}' was rejected: ${verification.errors.join("; ")}`
        );
        return false;
      }

      const existing = definitions[id];
      if (generatedNodeIds.has(id) || existing) {
        const existingContract =
          existing?.catalogGenerated === true
            ? existing.apiVerification
            : null;
        const identical = Boolean(
          existingContract &&
          existingContract.contractFingerprint ===
            verification.contract.contractFingerprint
        );

        if (identical) {
          generatedNodeIds.add(id);
          return true;
        }

        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node id '${id}' represents two different contracts or collides with a non-catalog graph node.`
        );
        return false;
      }

      definition.apiVerification =
        Object.freeze(
          verification.contract
        );

      if (
        isHarmonyCatalogType(
          definition?.catalogType
        )
      ) {
        definition.group = ADVANCED_GROUP;
        definition.harmonyApiNode = true;
        definition.description =
          `${String(
            definition.description ||
            "Low-level Harmony API node."
          )} This scanner-generated node executes as a low-level runtime call in the main mod project. It does not create or deploy an early rml_libs patch assembly automatically.`;
      }

      const dependencyReferences =
        assemblyReferencesForCsType(
          definition?.catalogType || "",
          typeByName.get(
            normalizeCsType(
              definition?.catalogType || ""
            )
          ) || null
        );

      if (dependencyReferences.length > 0) {
        const references = new Map();
        for (const reference of [
          ...(Array.isArray(
            definition.requiredAssemblyReferences
          )
            ? definition.requiredAssemblyReferences
            : []),
          ...dependencyReferences
        ]) {
          const include = String(
            reference?.include || ""
          ).trim();
          if (!include) continue;
          references.set(
            include.toLowerCase(),
            reference
          );
        }
        definition.requiredAssemblyReferences =
          [...references.values()];
      }

      const registered =
        registerNode(id, definition);
      if (registered === false) {
        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${id}' was rejected by the central graph registry.`
        );
        return false;
      }
      generatedNodeIds.add(id);
      return true;
    }

    function createApiVerificationContract(
      id,
      definition
    ) {
      const errors = [];
      const ownerType = normalizeCsType(
        definition?.catalogType || ""
      );
      const kind = String(
        definition?.apiMemberKind || ""
      ).trim();
      const signature = String(
        definition?.apiSignature || ""
      ).trim();
      const parameters = Object.freeze(
        Array.isArray(
          definition?.apiParameters
        )
          ? definition.apiParameters.map(
              apiParameterContract
            )
          : []
      );
      const inputs = Array.isArray(
        definition?.inputs
      ) ? definition.inputs : [];
      const outputs = Array.isArray(
        definition?.outputs
      ) ? definition.outputs : [];

      if (!definition?.catalogGenerated) {
        errors.push(
          "catalogGenerated is not true"
        );
      }
      if (!ownerType) {
        errors.push("catalog owner type is empty");
      }
      if (!kind) {
        errors.push("API member kind is empty");
      }
      if (!signature) {
        errors.push("API signature is empty");
      }
      for (
        let index = 0;
        index < parameters.length;
        index += 1
      ) {
        if (parameters[index].position !== index) {
          errors.push(
            `parameter positions are not contiguous at index ${index}`
          );
          break;
        }
      }
      if (
        typeof definition?.codegenExpression !== "function" &&
        typeof definition?.codegenAction !== "function" &&
        typeof definition?.codegenCollect !== "function"
      ) {
        errors.push(
          "no C# code-generation handler is present"
        );
      }
      if (
        inputs.some(port =>
          port?.type === "impulse"
        ) &&
        typeof definition?.codegenAction !== "function"
      ) {
        errors.push(
          "impulse input has no codegenAction handler"
        );
      }
      if (
        outputs.some(port =>
          port?.type !== "impulse"
        ) &&
        typeof definition?.codegenExpression !== "function"
      ) {
        errors.push(
          "value output has no codegenExpression handler"
        );
      }
      if (
        outputs.some(port =>
          port?.type === "impulse"
        ) &&
        typeof definition?.codegenAction !== "function" &&
        typeof definition?.codegenCollect !== "function"
      ) {
        errors.push(
          "impulse output has no action or collection handler"
        );
      }

      for (const [direction, ports] of [
        ["input", inputs],
        ["output", outputs]
      ]) {
        const ids = new Set();
        for (const specification of ports) {
          const portId = String(
            specification?.id || ""
          ).trim();
          const portType = String(
            specification?.type ||
            specification?.typeVar ||
            ""
          ).trim();
          if (!portId || !portType) {
            errors.push(
              `${direction} port has no id or type`
            );
          } else if (ids.has(portId)) {
            errors.push(
              `duplicate ${direction} port '${portId}'`
            );
          }
          if (
            specification?.type &&
            !getTypeInformation(
              specification.type
            )
          ) {
            errors.push(
              `${direction} port '${portId || "<unnamed>"}' uses unregistered graph type '${specification.type}'`
            );
          }
          ids.add(portId);
        }
      }

      const core = {
        schemaVersion:
          API_VERIFICATION_SCHEMA_VERSION,
        factoryVersion: FACTORY_VERSION,
        catalogSchemaVersion,
        engineVersion,
        catalogSource,
        catalogFingerprint,
        nodeId: String(id),
        kind,
        ownerType,
        memberName: String(
          definition?.catalogMember || ""
        ),
        signature,
        parameters,
        returnType: catalogExactType(
          definition?.apiReturnType ||
          "System.Void"
        ),
        isStatic:
          definition?.apiIsStatic === true,
        genericArity: Math.max(
          0,
          Number(
            definition?.apiGenericArity
          ) || 0
        ),
        runtimeBound:
          definition?.runtimeBound === true,
        threadAffinity:
          String(
            definition?.apiThreadAffinity ||
            "unknown"
          ),
        reloadSafety:
          normalizeReloadSafety(
            definition?.apiReloadSafety
          ),
        reloadCleanupCapabilities:
          Object.freeze(
            [...new Set(
              (Array.isArray(
                definition?.apiReloadCleanupCapabilities
              )
                ? definition.apiReloadCleanupCapabilities
                : [])
                .map(value =>
                  String(value || "").trim()
                )
                .filter(Boolean)
            )].sort()
          ),
        reloadAutomaticCleanup:
          Object.freeze(
            [...new Set(
              (Array.isArray(
                definition?.apiReloadAutomaticCleanup
              )
                ? definition.apiReloadAutomaticCleanup
                : [])
                .map(value =>
                  String(value || "").trim()
                )
                .filter(Boolean)
            )].sort()
          ),
        stableContractId:
          String(
            definition?.apiStableContractId ||
            stableContractId({
              ownerType,
              kind,
              memberName: String(definition?.catalogMember || ""),
              isStatic: definition?.apiIsStatic === true,
              genericArity: Math.max(0, Number(definition?.apiGenericArity) || 0)
            })
          ),
        inputPorts: Object.freeze(inputs.map(specification => ({
          id: String(specification?.id || ""),
          type: String(specification?.type || "object"),
          typeVar: String(specification?.typeVar || ""),
          optional: specification?.optional === true,
          role: portablePortRole(kind, "input", specification, parameters)
        }))),
        outputPorts: Object.freeze(outputs.map(specification => ({
          id: String(specification?.id || ""),
          type: String(specification?.type || "object"),
          typeVar: String(specification?.typeVar || ""),
          optional: specification?.optional === true,
          role: portablePortRole(kind, "output", specification, parameters)
        })))
      };

      return {
        ok: errors.length === 0,
        errors,
        contract: {
          ...core,
          contractFingerprint:
            stableHash(
              JSON.stringify(core)
            )
        }
      };
    }

    function apiParameterContract(
      parameter
    ) {
      return Object.freeze({
        position: Math.max(
          0,
          Number(parameter?.position) || 0
        ),
        type: catalogExactType(
          parameter?.elementType ||
          parameter?.type ||
          "System.Object"
        ),
        isByRef:
          parameter?.isByRef === true ||
          parameter?.isOut === true,
        isOut:
          parameter?.isOut === true,
        isOptional:
          parameter?.isOptional === true
      });
    }

    function createConstructorDefinition(owner, constructor) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const parameters = constructor.parameters || [];
      if (
        owner.isAbstract === true ||
        owner.isInterface === true ||
        constructor.isPublic === false ||
        parameters.some(parameter =>
          !isSupportedApiParameter(parameter)
        )
      ) {
        return null;
      }
      const direct =
        !owner.isAbstract &&
        !owner.isInterface &&
        !owner.isGeneric &&
        canDirectlyReferenceType(ownerCs) &&
        !parameters.some(parameter =>
          parameter.isOptional === true
        ) &&
        parameters.every(canDirectlyPassParameter);
      const inputs = [port("call", "Call", "impulse")];
      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }
      const outParameters = parameters.filter(parameter =>
        parameter.isOut || parameter.isByRef
      );
      const outputs = [
        port("done", "Done", "impulse"),
        port("result", displayTypeName(owner), direct ? ownerGraph : "object")
      ];
      for (const parameter of outParameters) {
        outputs.push(port(
          `out${parameter.position}`,
          parameter.name || `Arg ${parameter.position}`,
          direct
            ? graphTypeFor(parameter.elementType || parameter.type)
            : "object"
        ));
      }
      outputs.push(
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      );

      return withReloadContract({
        title: `New · ${displayTypeName(owner)}`,
        group: groupForType(owner, API_GROUPS.constructors),
        symbol: "new",
        description: constructor.signature || `Constructs ${ownerCs}.`,
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        apiStableContractId:
          String(constructor.stableContractId || ""),
        apiMemberKind: "constructor",
        apiSignature:
          constructor.signature ||
          `${ownerCs}(${parameters.map(apiParameterSignature).join(",")})`,
        apiParameters: parameters,
        apiReturnType: ownerCs,
        apiIsStatic: false,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${constructor.signature || "constructor new"}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          collectActionFields(api, {
            resultCs: direct ? ownerCs : "object",
            resultGraph: direct ? ownerGraph : "object",
            outParameters,
            direct
          });
          if (!direct) {
            ensureApiReflectionRuntime(api);
            collectReflectiveSignatureFields(
              api,
              parameters
            );
          }
        },
        codegenAction(api) {
          const action = direct
            ? directConstructorAction(api, ownerCs, parameters)
            : reflectiveConstructorAction(api, ownerCs, parameters);
          return actionWithDoneImpulse(api, action);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, {
            resultGraph: direct ? ownerGraph : "object",
            resultCs: direct ? ownerCs : "object",
            outParameters,
            direct
          });
        }
      }, owner, constructor.reloadSafety, {
        member: constructor
      });
    }

    function createMethodDefinition(owner, method) {
      const ownerCs = normalizeCsType(owner.fullName || method.declaringType);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const parameters = Array.isArray(method.parameters)
        ? method.parameters
        : [];
      const genericParameters = Array.isArray(
        method.genericParameters
      )
        ? method.genericParameters
        : [];
      if (
        method.isPublic === false ||
        (
          method.isStatic === true &&
          method.isAbstract === true
        ) ||
        (
          method.isGenericMethodDefinition === true
        ) !== (genericParameters.length > 0) ||
        genericParameters.some(
          (parameter, index) =>
            Number(parameter?.position) !== index ||
            !String(parameter?.name || "").trim()
        ) ||
        parameters.some(parameter =>
          !isSupportedApiParameter(parameter)
        ) ||
        !isSupportedApiReturnType(
          method.returnType || "System.Void"
        )
      ) {
        return null;
      }
      const returnCs = normalizeCsType(method.returnType || "System.Void");
      const isVoid = returnCs === "System.Void" || returnCs === "void";
      const direct = canDirectlyCallMethod(ownerCs, method, parameters);
      const resultCs = direct && !isVoid ? returnCs : "object";
      const resultGraph = !isVoid
        ? (direct ? graphTypeFor(returnCs) : "object")
        : null;
      const inputs = [port("call", "Call", "impulse")];

      if (!method.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }

      if (!direct && method.isGenericMethodDefinition) {
        for (const generic of genericParameters) {
          inputs.push(port(
            `generic${generic.position}`,
            `Type ${generic.name}`,
            "type",
            {
              help: genericConstraintHelp(generic)
            }
          ));
        }
      }

      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }

      const outParameters = parameters.filter(parameter =>
        parameter.isOut || parameter.isByRef
      );
      const outputs = [port("done", "Done", "impulse")];
      if (!isVoid) {
        outputs.push(port("result", "Result", resultGraph || "object"));
      }
      for (const parameter of outParameters) {
        outputs.push(port(
          `out${parameter.position}`,
          parameter.name || `Arg ${parameter.position}`,
          direct
            ? graphTypeFor(parameter.elementType || parameter.type)
            : "object"
        ));
      }
      outputs.push(
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      );

      const noisy = isNoisyType(owner) || !direct;
      const group = noisy ? ADVANCED_GROUP : API_GROUPS.methods;
      const titlePrefix = method.isStatic ? "Static" : "Call";

      return withReloadContract({
        title: `${titlePrefix} · ${displayTypeName(owner)}.${method.name}`,
        group,
        symbol: "ƒ",
        description: method.signature || `${ownerCs}.${method.name}`,
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: method.name,
        apiStableContractId:
          String(method.stableContractId || ""),
        apiMemberKind: "method",
        apiSignature:
          method.signature ||
          `${ownerCs}.${method.name}(${parameters.map(apiParameterSignature).join(",")})`,
        apiParameters: parameters,
        apiReturnType:
          method.returnType || returnCs,
        apiIsStatic: method.isStatic === true,
        apiGenericArity:
          genericParameters.length,
        apiSearchText: `${ownerCs} ${method.name} ${method.signature || ""}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          collectActionFields(api, {
            resultCs,
            resultGraph,
            isVoid,
            outParameters,
            direct
          });
          if (!direct) {
            ensureApiReflectionRuntime(api);
            collectReflectiveSignatureFields(
              api,
              parameters
            );
          }
        },
        codegenAction(api) {
          const action = direct
            ? directMethodAction(api, ownerCs, method, parameters, isVoid)
            : reflectiveMethodAction(api, ownerCs, method, parameters, isVoid);
          return actionWithDoneImpulse(api, action);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, {
            resultCs,
            resultGraph,
            isVoid,
            outParameters,
            direct
          });
        }
      }, owner, method.reloadSafety, {
        member: method
      });
    }

    function createPropertyGetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(property.type || "System.Object");
      const valueGraph = graphTypeFor(valueCs);
      const indexes = property.indexParameters || [];
      if (
        property.getterIsPublic === false ||
        property.isPublic === false ||
        !isCSharpIdentifier(property.name) ||
        !isSupportedApiReturnType(valueCs) ||
        indexes.some(parameter =>
          !isSupportedApiParameter(parameter)
        ) ||
        (indexes.length > 0 &&
          property.name !== "Item" &&
          property.isIndexer !== true)
      ) {
        return null;
      }
      const inputs = [];
      if (!property.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }
      for (const parameter of indexes) {
        inputs.push(parameterPort(parameter));
      }

      return withReloadContract({
        title: `Get · ${displayTypeName(owner)}.${property.name}`,
        group: groupForType(owner, API_GROUPS.properties),
        symbol: "get",
        description: `Reads ${ownerCs}.${property.name} (${valueCs}).`,
        inputs,
        outputs: [port("value", "Value", valueGraph)],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: property.name,
        apiStableContractId:
          String(property.readContractId || ""),
        apiMemberKind: "property-get",
        apiSignature:
          `${ownerCs}.${property.name}[${indexes.map(apiParameterSignature).join(",")}] -> ${catalogExactType(property.type || valueCs)}`,
        apiParameters: indexes,
        apiReturnType:
          property.type || valueCs,
        apiIsStatic: property.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${property.name} property get read ${valueCs}`,
        codegenExpression(api) {
          return propertyReadExpression(
            api,
            ownerCs,
            valueCs,
            property,
            indexes
          );
        }
      }, owner, property.readReloadSafety, {
        member: property
      });
    }

    function createPropertySetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(property.type || "System.Object");
      const indexes = property.indexParameters || [];
      if (
        property.setterIsPublic === false ||
        property.isPublic === false ||
        !isCSharpIdentifier(property.name) ||
        !isSupportedApiReturnType(valueCs) ||
        indexes.some(parameter =>
          !isSupportedApiParameter(parameter)
        ) ||
        (indexes.length > 0 &&
          property.name !== "Item" &&
          property.isIndexer !== true)
      ) {
        return null;
      }
      const inputs = [port("call", "Call", "impulse")];
      if (!property.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }
      for (const parameter of indexes) {
        inputs.push(parameterPort(parameter));
      }
      inputs.push(port("value", "Value", graphTypeFor(valueCs)));

      return withReloadContract({
        title: `Set · ${displayTypeName(owner)}.${property.name}`,
        group: groupForType(owner, API_GROUPS.properties),
        symbol: "set",
        description: `Writes ${ownerCs}.${property.name} (${valueCs}).`,
        inputs,
        outputs: [
          port("done", "Done", "impulse"),
          port("success", "Success", "bool"),
          port("exception", "Exception", "exception")
        ],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: property.name,
        apiStableContractId:
          String(property.writeContractId || ""),
        apiMemberKind: "property-set",
        apiSignature:
          `${ownerCs}.${property.name}[${indexes.map(apiParameterSignature).join(",")}] <- ${catalogExactType(property.type || valueCs)}`,
        apiParameters: [
          ...indexes,
          {
            position: indexes.length,
            type: property.type || valueCs
          }
        ],
        apiReturnType: "System.Void",
        apiIsStatic: property.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${property.name} property set write ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const access = propertyAccessExpression(api, ownerCs, property, indexes);
          const action = wrapApiAction(
            api,
            `    ${access} = ${api.input("value").code};`
          );
          return actionWithDoneImpulse(api, action);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, { isVoid: true, outParameters: [] });
        }
      }, owner, property.writeReloadSafety, {
        member: property
      });
    }

    function createFieldGetDefinition(owner, field) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = field.isStatic
        ? []
        : [port("target", "Target", ownerGraph)];
      if (
        field.isPublic === false ||
        !isCSharpIdentifier(field.name) ||
        !isSupportedApiReturnType(valueCs)
      ) {
        return null;
      }

      return withReloadContract({
        title: `Read · ${displayTypeName(owner)}.${field.name}`,
        group: groupForType(owner, API_GROUPS.fields),
        symbol: "fld",
        description: `Reads field ${ownerCs}.${field.name} (${valueCs}).`,
        inputs,
        outputs: [port("value", "Value", graphTypeFor(valueCs))],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: field.name,
        apiStableContractId:
          String(field.readContractId || ""),
        apiMemberKind: "field-get",
        apiSignature:
          `${ownerCs}.${field.name} -> ${catalogExactType(field.type || valueCs)}`,
        apiParameters: [],
        apiReturnType:
          field.type || valueCs,
        apiIsStatic: field.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${field.name} field read get ${valueCs}`,
        codegenExpression(api) {
          const access = host =>
            `${host}.${escapeCSharpIdentifier(field.name)}`;

          return field.isStatic
            ? access(ownerCs)
            : nullSafeInstanceReadExpression(
                api,
                ownerCs,
                valueCs,
                access
              );
        }
      }, owner, field.readReloadSafety, {
        member: field
      });
    }

    function createFieldSetDefinition(owner, field) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = [port("call", "Call", "impulse")];
      if (
        field.isPublic === false ||
        !isCSharpIdentifier(field.name) ||
        !isSupportedApiReturnType(valueCs)
      ) {
        return null;
      }
      if (!field.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }
      inputs.push(port("value", "Value", graphTypeFor(valueCs)));

      return withReloadContract({
        title: `Write · ${displayTypeName(owner)}.${field.name}`,
        group: groupForType(owner, API_GROUPS.fields),
        symbol: "fld=",
        description: `Writes field ${ownerCs}.${field.name} (${valueCs}).`,
        inputs,
        outputs: [
          port("done", "Done", "impulse"),
          port("success", "Success", "bool"),
          port("exception", "Exception", "exception")
        ],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: field.name,
        apiStableContractId:
          String(field.writeContractId || ""),
        apiMemberKind: "field-set",
        apiSignature:
          `${ownerCs}.${field.name} <- ${catalogExactType(field.type || valueCs)}`,
        apiParameters: [{ position: 0, type: field.type || valueCs }],
        apiReturnType: "System.Void",
        apiIsStatic: field.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${field.name} field write set ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const host = field.isStatic
            ? ownerCs
            : `((${ownerCs})(${api.input("target").code}))`;
          const action = wrapApiAction(
            api,
            `    ${host}.${escapeCSharpIdentifier(field.name)} = ${api.input("value").code};`
          );
          return actionWithDoneImpulse(api, action);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, { isVoid: true, outParameters: [] });
        }
      }, owner, field.writeReloadSafety, {
        member: field
      });
    }

    function createEventDefinition(owner, eventInfo, templateEntry) {
      if (!templateEntry) {
        return null;
      }

      const [templateId, template] = templateEntry;
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const definition = withReloadContract({
        ...template,
        title: `On · ${displayTypeName(owner)}.${eventInfo.name}`,
        group: groupForType(owner, API_GROUPS.events),
        symbol: "evt",
        description: `Typed catalog event wrapper for ${ownerCs}.${eventInfo.name} (${eventInfo.handlerType || "delegate"}).`,
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: eventInfo.name,
        apiStableContractId:
          String(eventInfo.stableContractId || ""),
        apiMemberKind: "event",
        apiSignature:
          `${ownerCs}.${eventInfo.name}:${normalizeCsType(eventInfo.handlerType || "System.Delegate")}`,
        apiParameters: [],
        apiReturnType:
          normalizeCsType(eventInfo.handlerType || "System.Delegate"),
        apiIsStatic: eventInfo.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${eventInfo.name} event ${eventInfo.handlerType || ""}`,
        apiTemplate: templateId
      }, owner, eventInfo.reloadSafety, {
        member: eventInfo,
        cleanupCapabilities: [
          "event-unsubscribe"
        ],
        automaticCleanup: [
          "event-unsubscribe"
        ]
      });

      definition.inputs = (template.inputs || []).map(input => {
        const key = String(input.id || "").toLowerCase();
        if (/target|instance|source|owner/.test(key)) {
          return { ...input, type: eventInfo.isStatic ? "type" : ownerGraph };
        }
        if (/event.*name|name.*event/.test(key) && input.type === "string") {
          return {
            ...input,
            defaultCs: `"${escapeString(eventInfo.name)}"`,
            defaultValue: eventInfo.name
          };
        }
        return { ...input };
      });
      definition.outputs = (template.outputs || []).map(output => ({ ...output }));
      definition.parameters = (template.parameters || []).map(specification => {
        const key = String(specification.key || "").toLowerCase();
        if (key.includes("event")) {
          return {
            ...specification,
            default: eventInfo.name,
            hidden: true
          };
        }
        if (key.includes("type")) {
          return {
            ...specification,
            default: ownerCs,
            hidden: true
          };
        }
        return { ...specification };
      });

      return definition;
    }

    function parameterPort(parameter) {
      const csType = normalizeCsType(parameter.elementType || parameter.type || "System.Object");
      return port(
        `arg${Number(parameter.position || 0)}`,
        parameter.name || `Arg ${Number(parameter.position || 0)}`,
        graphTypeFor(csType),
        {
          optional: parameter.isOptional === true,
          defaultCs: parameter.defaultValueCSharp || undefined,
          apiParameterType: csType,
          help: parameter.hasDefaultValue
            ? `Default: ${parameter.defaultValueCSharp || "default"}`
            : ""
        }
      );
    }

    function actionWithDoneImpulse(api, action) {
      const done = api.emit("done");
      return `${String(action || "").trimEnd()}${
        done
          ? `\n${done}();`
          : ""
      }`;
    }

    function graphTypeFor(typeName) {
      const csType = normalizeCsType(typeName);
      if (!csType || csType === "System.Void" || csType === "void") {
        return "object";
      }
      const known = graphTypeByCs.get(csType);
      if (known) return known;
      if (isGenericParameterName(csType) || isOpenTypeExpression(csType)) {
        return "object";
      }
      return registerApiType(csType, typeByName.get(csType)) || "object";
    }

    function directConstructorAction(api, ownerCs, parameters) {
      const fields = actionFieldNames(api);
      const argumentState = buildDirectArguments(api, parameters);
      const resultTarget = generatedApiOutputIsUsed(api, "result")
        ? fields.result
        : "_";
      return wrapApiAction(
        api,
        `${indent(argumentState.declarations, 4)}    ${resultTarget} = new ${ownerCs}(${argumentState.arguments.join(", ")});\n${indent(argumentState.assignments, 4)}`
      );
    }

    function reflectiveConstructorAction(api, ownerCs, parameters) {
      const fields = actionFieldNames(api);
      const signature =
        reflectiveSignatureFieldNames(
          parameters
        );
      const args = parameters
        .map(parameter => {
          if (parameter.isOut) {
            return "null";
          }
          const input =
            api.input(`arg${parameter.position}`);
          return (
            parameter.isOptional === true &&
            input.connected !== true
          )
            ? "System.Type.Missing"
            : input.code;
        });
      const outAssignments = parameters
        .filter(parameter =>
          (parameter.isOut || parameter.isByRef) &&
          generatedApiOutputIsUsed(api, `out${parameter.position}`)
        )
        .map(parameter => `${fields.out(parameter.position)} = apiArguments[${parameter.position}]!;`)
        .join("\n    ");
      const resultTarget = generatedApiOutputIsUsed(api, "result")
        ? fields.result
        : "_";
      return wrapApiAction(
        api,
        `    System.Type apiType = ${apiRuntimeTypeExpression(ownerCs)};\n    object?[] apiArguments = new object?[] { ${args.join(", ")} };\n    System.Reflection.ConstructorInfo apiConstructor = ResolveApiCatalogConstructor(apiType, ${signature.parameterTypes}, ${signature.byRef}, ${signature.out}) ?? throw new System.MissingMethodException(apiType.FullName, ".ctor");\n    ${resultTarget} = apiConstructor.Invoke(apiArguments)!;\n${outAssignments ? `    ${outAssignments}\n` : ""}`
      );
    }

    function directMethodAction(api, ownerCs, method, parameters, isVoid) {
      const fields = actionFieldNames(api);
      const argumentState = buildDirectArguments(api, parameters);
      const host = method.isStatic
        ? ownerCs
        : `((${ownerCs})(${api.input("target").code}))`;
      const call = `${host}.${escapeCSharpIdentifier(method.name)}(${argumentState.arguments.join(", ")})`;
      const invocation = isVoid
        ? `${call};`
        : `${generatedApiOutputIsUsed(api, "result") ? fields.result : "_"} = ${call};`;
      return wrapApiAction(
        api,
        `${indent(argumentState.declarations, 4)}    ${invocation}\n${indent(argumentState.assignments, 4)}`
      );
    }

    function reflectiveMethodAction(api, ownerCs, method, parameters, isVoid) {
      const fields = actionFieldNames(api);
      const signature =
        reflectiveSignatureFieldNames(
          parameters
        );
      const supplied = [];
      for (const parameter of parameters) {
        if (parameter.isOut) {
          supplied.push("null");
          continue;
        }
        const input =
          api.input(`arg${parameter.position}`);
        supplied.push(
          parameter.isOptional === true &&
          input.connected !== true
            ? "System.Type.Missing"
            : input.code
        );
      }
      const genericInputs = (method.genericParameters || [])
        .map(generic => api.input(`generic${generic.position}`).code);
      const target = method.isStatic
        ? "null"
        : api.input("target").code;
      const outAssignments = parameters
        .filter(parameter =>
          (parameter.isOut || parameter.isByRef) &&
          generatedApiOutputIsUsed(api, `out${parameter.position}`)
        )
        .map(parameter => `${fields.out(parameter.position)} = apiArguments[${parameter.position}]!;`)
        .join("\n    ");
      const resultAssignment = isVoid
        ? "_ = apiMethod.Invoke(apiTarget, apiArguments);"
        : `${generatedApiOutputIsUsed(api, "result") ? fields.result : "_"} = apiMethod.Invoke(apiTarget, apiArguments)!;`;
      const genericArgumentDeclaration =
        genericInputs.length > 0
          ? `    System.Type[] apiGenericArguments = new System.Type[] { ${genericInputs.join(", ")} };\n`
          : "";

      return wrapApiAction(
        api,
        `    System.Type apiDeclaringType = ${apiRuntimeTypeExpression(ownerCs)};\n    object? apiTarget = ${target};\n    object?[] apiArguments = new object?[] { ${supplied.join(", ")} };\n${genericArgumentDeclaration}    System.Reflection.MethodInfo apiMethod = ResolveApiCatalogMethod(apiDeclaringType, "${escapeString(normalizeCsType(method.declaringType || ownerCs))}", "${escapeString(method.name)}", ${signature.parameterTypes}, ${signature.byRef}, ${signature.out}, ${(method.genericParameters || []).length}, ${method.isStatic ? "true" : "false"}) ?? throw new System.MissingMethodException(apiDeclaringType.FullName, "${escapeString(method.name)}");\n${genericInputs.length > 0 ? "    apiMethod = apiMethod.MakeGenericMethod(apiGenericArguments);\n" : ""}    ${resultAssignment}\n${outAssignments ? `    ${outAssignments}\n` : ""}`
      );
    }

    function apiRuntimeTypeExpression(csType) {
      return canDirectlyReferenceType(csType)
        ? `typeof(${csType})`
        : `ResolveApiCatalogType("${escapeString(csType)}") ?? throw new System.TypeLoadException("${escapeString(csType)}")`;
    }

    function reflectiveSignatureIdentity(
      parameters
    ) {
      return JSON.stringify({
        parameterTypes:
          apiParameterTypeValues(parameters),
        byRef:
          apiParameterBoolValues(
            parameters,
            "isByRef"
          ),
        out:
          apiParameterBoolValues(
            parameters,
            "isOut"
          )
      });
    }

    function reflectiveSignatureFieldNames(
      parameters
    ) {
      const token = stableHash(
        reflectiveSignatureIdentity(
          parameters
        )
      );
      return {
        parameterTypes:
          `_apiParameterTypes${token}`,
        byRef:
          `_apiParameterByRef${token}`,
        out:
          `_apiParameterOut${token}`
      };
    }

    function apiParameterTypeValues(parameters) {
      return (parameters || []).map(parameter =>
        `"${escapeString(catalogExactType(parameter.elementType || parameter.type || "System.Object"))}"`
      );
    }

    function apiParameterBoolValues(
      parameters,
      property
    ) {
      return (parameters || []).map(parameter =>
        parameter?.[property] === true ||
        (
          property === "isByRef" &&
          parameter?.isOut === true
        )
          ? "true"
          : "false"
      );
    }

    function apiStaticArrayInitializer(
      csType,
      values
    ) {
      return values.length > 0
        ? `new ${csType}[] { ${values.join(", ")} }`
        : `System.Array.Empty<${csType}>()`;
    }

    function collectReflectiveSignatureFields(
      api,
      parameters
    ) {
      const names =
        reflectiveSignatureFieldNames(
          parameters
        );
      const identity =
        reflectiveSignatureIdentity(
          parameters
        );
      const parameterTypes =
        apiParameterTypeValues(parameters);
      const byRef = apiParameterBoolValues(
        parameters,
        "isByRef"
      );
      const out = apiParameterBoolValues(
        parameters,
        "isOut"
      );

      api.addField(
        `api.signature.${identity}.types`,
        `private static readonly string[] ${names.parameterTypes} = ${apiStaticArrayInitializer("string", parameterTypes)};`
      );
      api.addField(
        `api.signature.${identity}.byRef`,
        `private static readonly bool[] ${names.byRef} = ${apiStaticArrayInitializer("bool", byRef)};`
      );
      api.addField(
        `api.signature.${identity}.out`,
        `private static readonly bool[] ${names.out} = ${apiStaticArrayInitializer("bool", out)};`
      );
    }

    function buildDirectArguments(api, parameters) {
      const token = api.token(api.node.id);
      const declarations = [];
      const assignments = [];
      const argumentsList = [];
      const fields = actionFieldNames(api);

      for (const parameter of parameters) {
        const position = Number(parameter.position || 0);
        const csType = normalizeCsType(parameter.elementType || parameter.type || "System.Object");
        const local = `_apiArg${position}${token}`;
        if (parameter.isOut) {
          declarations.push(`${csType} ${local};`);
          argumentsList.push(`out ${local}`);
          if (generatedApiOutputIsUsed(api, `out${position}`)) {
            assignments.push(`${fields.out(position)} = ${local};`);
          }
        } else if (parameter.isByRef) {
          declarations.push(`${csType} ${local} = ${api.input(`arg${position}`).code};`);
          argumentsList.push(`ref ${local}`);
          if (generatedApiOutputIsUsed(api, `out${position}`)) {
            assignments.push(`${fields.out(position)} = ${local};`);
          }
        } else {
          argumentsList.push(api.input(`arg${position}`).code);
        }
      }

      return {
        declarations: declarations.join("\n") + (declarations.length ? "\n" : ""),
        arguments: argumentsList,
        assignments: assignments.join("\n") + (assignments.length ? "\n" : "")
      };
    }

    function propertyAccessExpression(api, ownerCs, property, indexes) {
      const host = property.isStatic
        ? ownerCs
        : `((${ownerCs})(${api.input("target").code}))`;
      if (indexes.length > 0) {
        const indexValues = indexes.map(parameter =>
          api.input(`arg${parameter.position}`).code
        );
        return `${host}[${indexValues.join(", ")}]`;
      }
      return `${host}.${escapeCSharpIdentifier(property.name)}`;
    }

    function nullSafeInstanceReadExpression(
      api,
      ownerCs,
      valueCs,
      memberAccess
    ) {
      const target =
        api.input("target").code;
      const local =
        `_apiTarget${api.token(api.node.id)}`;

      return `((${target}) switch { ${ownerCs} ${local} => ${memberAccess(local)}, _ => default(${valueCs})! })`;
    }

    function propertyReadExpression(
      api,
      ownerCs,
      valueCs,
      property,
      indexes
    ) {
      const access = host => {
        if (indexes.length > 0) {
          const indexValues = indexes.map(
            parameter =>
              api.input(
                `arg${parameter.position}`
              ).code
          );
          return `${host}[${indexValues.join(", ")}]`;
        }

        return `${host}.${escapeCSharpIdentifier(property.name)}`;
      };

      return property.isStatic
        ? access(ownerCs)
        : nullSafeInstanceReadExpression(
            api,
            ownerCs,
            valueCs,
            access
          );
    }

    function collectActionFields(api, descriptor) {
      const fields = actionFieldNames(api);
      if (generatedApiOutputIsUsed(api, "success")) {
        api.addRuntimeField(
          `${api.node.id}.apiSuccess`,
          fields.success,
          "bool",
          "false"
        );
      }
      if (generatedApiOutputIsUsed(api, "exception")) {
        api.addRuntimeField(
          `${api.node.id}.apiException`,
          fields.exception,
          "System.Exception?",
          "null"
        );
      }

      if (!descriptor.isVoid && generatedApiOutputIsUsed(api, "result")) {
        api.addRuntimeField(
          `${api.node.id}.apiResult`,
          fields.result,
          descriptor.resultCs || "object",
          "default!"
        );
      }

      for (const parameter of descriptor.outParameters || []) {
        if (!generatedApiOutputIsUsed(api, `out${parameter.position}`)) {
          continue;
        }
        const csType = descriptor.direct
          ? normalizeCsType(parameter.elementType || parameter.type || "System.Object")
          : "object";
        api.addRuntimeField(
          `${api.node.id}.apiOut.${parameter.position}`,
          fields.out(parameter.position),
          csType,
          "default!"
        );
      }
    }

    function generatedApiOutputIsUsed(api, outputId) {
      if (
        typeof api?.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return false;
      }
      return typeof api?.isOutputConnected ===
        "function"
        ? api.isOutputConnected(outputId)
        : true;
    }

    function wrapApiAction(api, body) {
      const fields = actionFieldNames(api);
      const keepSuccess = generatedApiOutputIsUsed(api, "success");
      const keepException = generatedApiOutputIsUsed(api, "exception");
      const successLines = [
        keepSuccess ? `    ${fields.success} = true;` : "",
        keepException ? `    ${fields.exception} = null;` : ""
      ].filter(Boolean).join("\n");
      const failureLines = [
        keepSuccess ? `    ${fields.success} = false;` : "",
        keepException ? `    ${fields.exception} = exception;` : ""
      ].filter(Boolean).join("\n");
      const catchClause = keepException
        ? "catch (System.Exception exception)"
        : "catch (System.Exception)";

      return `try\n{\n${String(body || "").trimEnd()}${successLines ? `\n${successLines}` : ""}\n}\n${catchClause}\n{${failureLines ? `\n${failureLines}\n` : "\n"}}`;
    }

    function actionOutputExpression(api, descriptor) {
      if (
        typeof api?.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return "default!";
      }
      const fields = actionFieldNames(api);
      const output = outputPortId(api);
      if (output === "success") return fields.success;
      if (output === "exception") return fields.exception;
      if (output === "result" && !descriptor.isVoid) return fields.result;
      const outMatch = /^out(\d+)$/.exec(output);
      if (outMatch) return fields.out(Number(outMatch[1]));
      if (!descriptor.isVoid) return fields.result;
      return "default!";
    }

    function actionFieldNames(api) {
      const token = api.token(api.node.id);
      return {
        result: `_apiResult${token}`,
        success: `_apiSuccess${token}`,
        exception: `_apiException${token}`,
        out(position) {
          return `_apiOut${Number(position)}${token}`;
        }
      };
    }

    function outputPortId(api) {
      return String(
        api.outputPortId ??
        api.outputId ??
        api.portId ??
        api.output?.id ??
        api.port?.id ??
        api.connection?.fromPort ??
        ""
      );
    }

    function ensureApiReflectionRuntime(api) {
      api.addUsing("System.Linq");
      api.addUsing("System.Reflection");
      api.addMember("api.catalog.runtime", globalThis.RMLCodeTemplates.text("api", "API_catalog_reflection_helpers", []));
    }

    function canDirectlyCallMethod(ownerCs, method, parameters) {
      return (
        canDirectlyReferenceType(ownerCs) &&
        method.isPublic !== false &&
        method.isSpecialName !== true &&
        !method.isGenericMethodDefinition &&
        !parameters.some(parameter =>
          parameter.isOptional === true
        ) &&
        canDirectlyReferenceType(method.returnType || "System.Void") &&
        parameters.every(canDirectlyPassParameter) &&
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(method.name || ""))
      );
    }

    function canDirectlyPassParameter(parameter) {
      const type = normalizeCsType(parameter.elementType || parameter.type || "");
      return canDirectlyReferenceType(type);
    }

    function apiParameterSignature(parameter) {
      const type = catalogExactType(
        parameter?.elementType ||
        parameter?.type ||
        "System.Object"
      );
      const modifier = parameter?.isOut
        ? "out "
        : parameter?.isByRef
          ? "ref "
          : "";
      return `${modifier}${type}`;
    }

    function isSupportedApiParameter(parameter) {
      if (!parameter || typeof parameter !== "object") {
        return false;
      }
      if (
        parameter.isPointer === true ||
        parameter.isFunctionPointer === true ||
        parameter.isByRefLike === true
      ) {
        return false;
      }
      return isSupportedApiReturnType(
        parameter.elementType ||
        parameter.type ||
        ""
      );
    }

    function isSupportedApiReturnType(typeName) {
      const type = normalizeCsType(typeName);
      if (!type) return false;
      if (
        !isSafeCSharpTypeExpression(type) ||
        type.includes("*") ||
        type.includes("delegate*") ||
        type.endsWith("&") ||
        type === "System.TypedReference" ||
        type === "System.ArgIterator" ||
        type === "System.RuntimeArgumentHandle"
      ) {
        return false;
      }
      const row = typeByName.get(type);
      return row?.isByRefLike !== true;
    }

    function canDirectlyReferenceType(typeName) {
      const type = normalizeCsType(typeName);
      return Boolean(
        type &&
        isSafeCSharpTypeExpression(type) &&
        !type.includes("*") &&
        !type.endsWith("&") &&
        !isOpenTypeExpression(type) &&
        !isGenericParameterName(type)
      );
    }

    function findDefinitionByTitle(allDefinitions, predicate) {
      for (const entry of Object.entries(allDefinitions)) {
        if (predicate(String(entry[1]?.title || ""))) {
          return entry;
        }
      }
      return null;
    }

    function groupForType(row, normalGroup) {
      return (
        isNoisyType(row) ||
        isHarmonyCatalogType(
          row?.fullName || row
        )
      )
        ? ADVANCED_GROUP
        : normalGroup;
    }

    function isHarmonyCatalogType(value) {
      const fullName = normalizeCsType(
        value?.fullName || value
      );

      return (
        fullName === "HarmonyLib" ||
        fullName.startsWith(
          "HarmonyLib."
        )
      );
    }

    function isNoisyType(row) {
      return Boolean(
        row?.isObsolete ||
        row?.isLegacyNamed ||
        row?.isDebugNamed ||
        row?.isEditorNamed ||
        row?.isToolNamed ||
        row?.isGizmoNamed
      );
    }

    function isUsableCatalogType(row) {
      if (
        !row ||
        row.isPublic === false ||
        row.isByRefLike === true ||
        !row.fullName
      ) return false;
      if (row.isObsolete || row.isLegacyNamed) return false;
      const fullName = normalizeCsType(row.fullName);
      return Boolean(
        fullName &&
        fullName !== "System.Void" &&
        isSafeCSharpTypeExpression(fullName) &&
        !fullName.includes("<>") &&
        !isOpenTypeExpression(fullName)
      );
    }

    function displayTypeName(row) {
      return row?.name || shortTypeName(row?.fullName || "Type");
    }
  }

  function splitTopLevelTypeArguments(value) {
    const text = String(value || "");
    const result = [];
    let start = 0;
    let depth = 0;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (character === "<" || character === "[" || character === "(") {
        depth += 1;
      } else if (character === ">" || character === "]" || character === ")") {
        depth = Math.max(0, depth - 1);
      } else if (character === "," && depth === 0) {
        result.push(text.slice(start, index).trim());
        start = index + 1;
      }
    }

    const tail = text.slice(start).trim();
    if (tail) result.push(tail);
    return result;
  }

  function firstGenericTypeParts(value) {
    const text = normalizeCsType(value);
    const open = text.indexOf("<");

    if (open < 0) {
      return null;
    }

    let depth = 0;
    let close = -1;

    for (let index = open; index < text.length; index += 1) {
      if (text[index] === "<") {
        depth += 1;
      } else if (text[index] === ">") {
        depth -= 1;
        if (depth === 0) {
          close = index;
          break;
        }
      }
    }

    if (close < 0) {
      return null;
    }

    return {
      head: text.slice(0, open).trim(),
      arguments: splitTopLevelTypeArguments(
        text.slice(open + 1, close)
      ),
      suffix: text.slice(close + 1).trim()
    };
  }

  function genericTypeShape(value) {
    const parsed = firstGenericTypeParts(value);
    if (!parsed) return "";

    return (
      `${parsed.head.replace(/\s+/g, "")}` +
      `${parsed.suffix.replace(/\s+/g, "")}` +
      `|${parsed.arguments.length}`
    );
  }

  function genericTypeSubstitutions(
    templateType,
    actualType
  ) {
    const template =
      firstGenericTypeParts(templateType);
    const actual =
      firstGenericTypeParts(actualType);
    const result = new Map();

    if (
      !template ||
      !actual ||
      genericTypeShape(templateType) !==
        genericTypeShape(actualType) ||
      template.arguments.length !==
        actual.arguments.length
    ) {
      return result;
    }

    for (
      let index = 0;
      index < template.arguments.length;
      index += 1
    ) {
      const parameter =
        normalizeCsType(
          template.arguments[index]
        );

      if (isGenericParameterName(parameter)) {
        result.set(
          parameter,
          normalizeCsType(
            actual.arguments[index]
          )
        );
      }
    }

    return result;
  }

  function substituteGenericTypeParameters(
    value,
    substitutions
  ) {
    let result = normalizeCsType(value);

    for (const [parameter, replacement] of
      substitutions instanceof Map
        ? substitutions
        : []) {
      result = result.replace(
        new RegExp(
          `(^|[^A-Za-z0-9_])${parameter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^A-Za-z0-9_])`,
          "g"
        ),
        (_match, prefix) =>
          `${prefix}${replacement}`
      );
    }

    return result;
  }

  function directEnumerableElementCsType(value) {
    const text = normalizeCsType(value);

    if (
      !text ||
      text === "System.String" ||
      text === "string"
    ) {
      return null;
    }

    const array = text.match(
      /^(.*)\[(?:,*)\]$/
    );

    if (array) {
      return normalizeCsType(array[1]);
    }

    if (text === "System.Collections.IEnumerable") {
      return "System.Object";
    }

    const parsed = firstGenericTypeParts(text);
    if (!parsed) return null;

    const head = parsed.head.replace(/\s+/g, "");
    const suffix = parsed.suffix.replace(/\s+/g, "");
    const argumentsList = parsed.arguments;
    const oneElementCollections = new Set([
      "System.Collections.Generic.IEnumerable",
      "System.Collections.Generic.ICollection",
      "System.Collections.Generic.IList",
      "System.Collections.Generic.IReadOnlyCollection",
      "System.Collections.Generic.IReadOnlyList",
      "System.Collections.Generic.ISet",
      "System.Collections.Generic.List",
      "System.Collections.Generic.HashSet",
      "System.Collections.Generic.Queue",
      "System.Collections.Generic.Stack",
      "System.Collections.Generic.LinkedList",
      "System.Collections.ObjectModel.Collection",
      "System.Collections.ObjectModel.ReadOnlyCollection",
      "System.Collections.ObjectModel.ObservableCollection",
      "System.Collections.Concurrent.ConcurrentBag",
      "System.Collections.Concurrent.ConcurrentQueue",
      "System.Collections.Concurrent.ConcurrentStack",
      "System.Collections.Immutable.ImmutableArray",
      "System.Collections.Immutable.ImmutableList",
      "System.Collections.Immutable.ImmutableHashSet"
    ]);

    if (
      !suffix &&
      argumentsList.length === 1 &&
      oneElementCollections.has(head)
    ) {
      return argumentsList[0];
    }

    if (
      head === "System.Linq.IGrouping" &&
      argumentsList.length === 2
    ) {
      return argumentsList[1];
    }

    const dictionaryHeads = new Set([
      "System.Collections.Generic.Dictionary",
      "System.Collections.Generic.IDictionary",
      "System.Collections.Generic.IReadOnlyDictionary",
      "System.Collections.Concurrent.ConcurrentDictionary",
      "System.Collections.Immutable.ImmutableDictionary"
    ]);

    if (
      dictionaryHeads.has(head) &&
      argumentsList.length === 2
    ) {
      if (suffix.endsWith(".ValueCollection")) {
        return argumentsList[1];
      }

      if (suffix.endsWith(".KeyCollection")) {
        return argumentsList[0];
      }

      if (!suffix) {
        return (
          "System.Collections.Generic.KeyValuePair<" +
          `${argumentsList[0]}, ${argumentsList[1]}>`
        );
      }
    }

    return null;
  }

  function normalizeCsType(value) {
    let text = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, " ");
    if (text.endsWith("?")) {
      text = text.slice(0, -1);
    }
    return text;
  }

  function normalizeTypeForLookup(value) {
    return normalizeCsType(value)
      .replace(/\s+/g, "")
      .replace(/System\.Nullable<(.+)>$/, "$1");
  }

  function isSafeCSharpTypeExpression(value) {
    let text = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, "");

    if (!text || /[+`();{}=]/.test(text)) {
      return false;
    }

    if (text.endsWith("?")) {
      return isSafeCSharpTypeExpression(
        text.slice(0, -1)
      );
    }

    const array = text.match(
      /^(.*)\[(?:,*)\]$/
    );
    if (array) {
      return isSafeCSharpTypeExpression(
        array[1]
      );
    }

    const parsed =
      firstGenericTypeParts(text);
    if (parsed) {
      return (
        (
          !parsed.suffix ||
          (
            parsed.suffix.startsWith(".") &&
            isSafeCSharpTypeExpression(
              `Nested${parsed.suffix}`
            )
          )
        ) &&
        isSafeCSharpTypeExpression(
          parsed.head
        ) &&
        parsed.arguments.length > 0 &&
        parsed.arguments.every(
          isSafeCSharpTypeExpression
        )
      );
    }

    const segments = text.split(".");
    return (
      segments.every(segment =>
        /^@?[A-Za-z_][A-Za-z0-9_]*$/.test(segment)
      ) &&
      segments.every(segment =>
        segment.startsWith("@") ||
        !CSHARP_KEYWORDS.has(segment) ||
        (
          segments.length === 1 &&
          CSHARP_TYPE_ALIASES.has(segment)
        )
      )
    );
  }

  function isOpenTypeExpression(value) {
    const text = normalizeCsType(value);
    if (!text) return true;
    if (/`\d+/.test(text)) return true;
    const genericBody = text.match(/<(.+)>/g);
    if (!genericBody) return false;
    return /(?:^|[<, ])(?:T|T[A-Z][A-Za-z0-9_]*)(?:[>, ]|$)/.test(text);
  }

  function isGenericParameterName(value) {
    return /^(?:T|T[A-Z][A-Za-z0-9_]*)$/.test(normalizeCsType(value));
  }

  function looksLikeValueType(value) {
    const text = normalizeCsType(value);
    return /^(?:System\.)?(?:Boolean|Byte|SByte|Int16|UInt16|Int32|UInt32|Int64|UInt64|Single|Double|Decimal|Char|DateTime|TimeSpan|Guid)$/.test(text) ||
      /(?:^|\.)(?:int|float|double|byte|sbyte|short|ushort|uint|long|ulong)[234]$/.test(text);
  }

  function apiGraphTypeId(csType) {
    return `api.${slug(shortTypeName(csType))}.${stableHash(csType)}`;
  }

  function shortTypeName(value) {
    const text = normalizeCsType(value);
    const generic = text.lastIndexOf("<");
    const head = generic >= 0 ? text.slice(0, generic) : text;
    const name = head.split(".").pop() || head || "Type";
    return generic >= 0
      ? `${name}${text.slice(generic)}`
      : name;
  }

  function slug(value) {
    const result = String(value || "type")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 42);
    return result || "type";
  }

  function stableHash(value) {
    const text = String(value || "");
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193) >>> 0;
      second ^= code + index;
      second = Math.imul(second, 0x85ebca6b) >>> 0;
    }
    return first.toString(16).padStart(8, "0") +
      second.toString(16).padStart(8, "0");
  }

  function colorForString(value) {
    const hash = parseInt(stableHash(value).slice(0, 8), 16) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 62% 64%)`;
  }

  function shortBadge(value) {
    const letters = String(value || "API")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .map(word => word[0] || "")
      .join("")
      .toUpperCase();
    return (letters || String(value || "API").slice(0, 4).toUpperCase()).slice(0, 7);
  }

  const CSHARP_KEYWORDS = new Set([
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
    "char", "checked", "class", "const", "continue", "decimal", "default",
    "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
    "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
    "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
    "namespace", "new", "null", "object", "operator", "out", "override",
    "params", "private", "protected", "public", "readonly", "ref", "return",
    "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string",
    "struct", "switch", "this", "throw", "true", "try", "typeof", "uint",
    "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void",
    "volatile", "while"
  ]);

  const CSHARP_TYPE_ALIASES = new Set([
    "bool", "byte", "sbyte", "short", "ushort",
    "int", "uint", "long", "ulong", "nint", "nuint",
    "char", "float", "double", "decimal", "string",
    "object", "void"
  ]);

  function escapeCSharpIdentifier(value) {
    const text = String(value || "_");
    return CSHARP_KEYWORDS.has(text)
      ? `@${text}`
      : text;
  }

  function isCSharpIdentifier(value) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(
      String(value || "")
    );
  }

  function escapeString(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/"/g, '\\"');
  }

  function indent(value, spaces) {
    const text = String(value || "");
    if (!text) return "";
    const prefix = " ".repeat(spaces);
    return text
      .split("\n")
      .filter((line, index, lines) => !(index === lines.length - 1 && line === ""))
      .map(line => `${prefix}${line}\n`)
      .join("");
  }

  function genericConstraintHelp(generic) {
    const parts = [];
    if (generic.referenceTypeConstraint) parts.push("class");
    if (generic.valueTypeConstraint) parts.push("struct");
    for (const constraint of generic.constraints || []) parts.push(constraint);
    if (generic.defaultConstructorConstraint) parts.push("new()");
    return parts.length > 0
      ? `Constraints: ${parts.join(", ")}`
      : "Select the concrete generic type argument.";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
  boot();
})();
