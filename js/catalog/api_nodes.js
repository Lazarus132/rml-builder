(() => {
  "use strict";

  const API_FACTORY_MODULE_ID =
    "1.25.00-canonical-type-reconciliation-startup-recovery";
  const FACTORY_VERSION = 41;
  const API_VERIFICATION_SCHEMA_VERSION = 4;
  const CATALOG_PROJECTION_INDEX_VERSION = 2;

  function apiText(key, fallback) {
    const translate = window.RMLI18n?.t;
    if (typeof translate !== "function") return fallback;
    const translated = String(
      translate.call(window.RMLI18n, key) ?? ""
    );
    return translated && translated !== key
      ? translated
      : fallback;
  }

  function apiFormat(
    key,
    fallback,
    values = {}
  ) {
    const template = apiText(key, fallback);
    return String(template).replace(
      /\{([A-Za-z0-9_]+)\}/g,
      (match, name) =>
        Object.prototype.hasOwnProperty.call(
          values,
          name
        )
          ? String(values[name] ?? "")
          : match
    );
  }

  const ADVANCED_GROUP = apiText(
    "api.catalog.group.advanced",
    "Advanced / Raw C#"
  );
  const UNAVAILABLE_GROUP = apiText(
    "api.catalog.group.unavailable",
    "Unavailable API"
  );
  const API_GROUPS = Object.freeze({
    types: apiText(
      "api.catalog.group.types",
      "API · Types & Enums"
    ),
    constructors: apiText(
      "api.catalog.group.constructors",
      "API · Constructors"
    ),
    methods: apiText(
      "api.catalog.group.methods",
      "API · Methods"
    ),
    hooks: apiText(
      "api.catalog.group.hooks",
      "API · Hooks"
    ),
    properties: apiText(
      "api.catalog.group.properties",
      "API · Properties"
    ),
    fields: apiText(
      "api.catalog.group.fields",
      "API · Fields"
    ),
    events: apiText(
      "api.catalog.group.events",
      "API · Events"
    )
  });
  const API_PORT_LABELS = Object.freeze({
    call: apiText("api.catalog.port.call", "Call"),
    called: apiText(
      "api.catalog.port.called",
      "Called"
    ),
    done: apiText("api.catalog.port.done", "Done"),
    exception: apiText(
      "api.catalog.port.exception",
      "Exception"
    ),
    instance: apiText(
      "api.catalog.port.instance",
      "Instance"
    ),
    result: apiText(
      "api.catalog.port.result",
      "Result"
    ),
    success: apiText(
      "api.catalog.port.success",
      "Success"
    ),
    target: apiText(
      "api.catalog.port.target",
      "Target"
    ),
    type: apiText("api.catalog.port.type", "Type"),
    value: apiText("api.catalog.port.value", "Value")
  });

  function catalogVisibleText(
      value,
      forbiddenValues = []
    ) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const forbidden = (Array.isArray(forbiddenValues)
      ? forbiddenValues
      : [forbiddenValues]
    )
      .map(candidate => String(candidate || "").trim())
      .filter(Boolean);
    if (
      forbidden.some(candidate =>
        text === candidate ||
        text.includes(candidate)
      ) ||
      /^(?:unavailable\.preserved\.|api\.)/.test(text) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ) {
      return "";
    }
    return text;
  }

  function catalogContractDisplayName(
      contract,
      fallback = apiText(
        "api.catalog.title.unavailable_api",
        "Unavailable API"
      )
    ) {
    const source =
      contract &&
      typeof contract === "object" &&
      !Array.isArray(contract)
        ? contract
        : {};
    const ownerType = catalogVisibleText(
      source.ownerType || source.catalogType
    );
    const memberName = catalogVisibleText(
      source.memberName ||
      source.catalogMember ||
      source.name
    );
    const qualifiedName = [
      ownerType,
      memberName
    ].filter(Boolean).join(".");
    const signature = catalogVisibleText(
      source.signature || source.apiSignature
    );
    return qualifiedName ||
      signature ||
      ownerType ||
      fallback;
  }

  function catalogDefinitionDisplayName(
      definition,
      operatorId = "",
      fallback = apiText(
        "api.catalog.display.api_node",
        "API node"
      )
    ) {
    const contract =
      definition?.apiVerification ||
      definition?.preservedApiContract ||
      definition ||
      null;
    for (const candidate of [
      definition?.title,
      catalogContractDisplayName(
        contract,
        ""
      ),
      definition?.apiSignature
    ]) {
      const readable = catalogVisibleText(
        candidate,
        [operatorId]
      );
      if (readable) return readable;
    }
    return fallback;
  }

  function catalogUnavailableTitle(
      isApi,
      displayName
  ) {
    const prefix = isApi
      ? apiText(
          "api.catalog.title.unavailable_api",
          "Unavailable API"
        )
      : apiText(
          "api.catalog.title.unavailable_operator",
          "Unavailable Operator"
        );
    const readable = catalogVisibleText(
      displayName
    );
    return !readable || readable === prefix
      ? prefix
      : apiFormat(
          isApi
            ? "api.catalog.title.unavailable_api_named"
            : "api.catalog.title.unavailable_operator_named",
          isApi
            ? "Unavailable API · {name}"
            : "Unavailable Operator · {name}",
          { name: readable }
        );
  }

  function catalogUnavailableTypeLabel(
      csType
    ) {
    const readable = catalogVisibleText(
      normalizedPortableCsType(csType)
    );
    return readable
      ? apiFormat(
          "api.catalog.type.unavailable_named",
          "Unavailable · {type}",
          { type: readable }
        )
      : apiText(
          "api.catalog.type.unavailable",
          "Unavailable API type"
        );
  }

  function catalogUnavailableDescription(
    isApi
  ) {
    return apiText(
      isApi
        ? "api.catalog.description.unavailable_api"
        : "api.catalog.description.unavailable_node",
      isApi
        ? "The original API contract is preserved, but the current Builder has no safely equivalent operator. The project remains editable; only export of this unresolved runtime path is blocked."
        : "The original node contract is preserved, but the current Builder has no safely equivalent operator. The project remains editable; only export of this unresolved runtime path is blocked."
    );
  }

  function catalogLanguageExactTypePresentation(
      csType,
      graphType = ""
    ) {
    const normalized =
      normalizedPortableCsType(csType);
    const generic = normalized.indexOf("<");
    const head = generic >= 0
      ? normalized.slice(0, generic)
      : normalized;
    const tail =
      head.split(/[.+]/).filter(Boolean).pop() ||
      apiText("api.catalog.port.type", "Type");
    const label = generic >= 0
      ? `${tail}${normalized.slice(generic)}`
      : tail;
    return Object.freeze({
      label,
      short: String(graphType).startsWith(
        "normalExact:"
      )
        ? "T"
        : "C#",
      color: "#91b9dd"
    });
  }

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
  let factoryRegistryLegacyIntegrityAudit = null;
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

  function rememberCatalogProjectionOperator(
    map,
    stableContractId,
    operatorId
  ) {
    const contractId = String(
      stableContractId || ""
    ).trim();
    const id = String(operatorId || "").trim();
    if (!contractId || !id) return;

    const current = map.get(contractId);
    if (!current) {
      map.set(contractId, id);
      return;
    }
    if (Array.isArray(current)) {
      if (!current.includes(id)) {
        current.push(id);
      }
      return;
    }
    if (current !== id) {
      map.set(contractId, [current, id]);
    }
  }

  function catalogProjectionMultiLookup(map) {
    for (const [key, value] of map) {
      if (
        Array.isArray(value) &&
        !Object.isFrozen(value)
      ) {
        map.set(key, Object.freeze([...value]));
      }
    }
    return Object.freeze({
      has(key) {
        return map.has(key);
      },
      get(key) {
        const value = map.get(key);
        if (!value) return undefined;
        return Array.isArray(value)
          ? value
          : Object.freeze([value]);
      }
    });
  }

  function catalogProjectionSetLookup(values) {
    const set = new Set(values || []);
    const entries = Object.freeze([...set]);
    return Object.freeze({
      size: set.size,
      values: entries,
      has(key) {
        return set.has(key);
      }
    });
  }

  function factoryIntegrityCooperativeYield() {
    if (
      globalThis.scheduler &&
      typeof globalThis.scheduler.yield ===
        "function"
    ) {
      return globalThis.scheduler.yield();
    }
    if (typeof MessageChannel === "function") {
      return new Promise(resolve => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          channel.port2.close();
          resolve();
        };
        channel.port2.postMessage(0);
      });
    }
    if (
      typeof document !== "undefined" &&
      document.visibilityState === "visible" &&
      typeof requestAnimationFrame === "function"
    ) {
      return new Promise(resolve => {
        requestAnimationFrame(() => resolve());
      });
    }
    return Promise.resolve();
  }

  function catalogProjectionIntegrityCertificate(
    baseIndex,
    registry,
    definitions,
    definitionRevision
  ) {
    const generatedOperatorIds =
      baseIndex?.generatedOperatorIds;
    const availableOperatorIds =
      baseIndex?.availableOperatorIds;
    const report = baseIndex?.report;
    if (
      !registry ||
      !definitions ||
      typeof definitions !== "object" ||
      Array.isArray(definitions) ||
      !generatedOperatorIds ||
      typeof generatedOperatorIds.has !==
        "function" ||
      !availableOperatorIds ||
      typeof availableOperatorIds.has !==
        "function" ||
      !Number.isInteger(
        Number(generatedOperatorIds.size)
      ) ||
      !report
    ) {
      return null;
    }
    return Object.freeze({
      version: 1,
      registry,
      definitions,
      catalog: baseIndex.catalog,
      report,
      catalogFingerprint: String(
        baseIndex.catalogFingerprint || ""
      ),
      engineVersion: String(
        baseIndex.engineVersion || ""
      ),
      projectionRevision: Math.max(
        0,
        Number(baseIndex.revision) || 0
      ),
      definitionRevision: Math.max(
        0,
        Number(definitionRevision) || 0
      ),
      totalGeneratedNodes:
        generatedOperatorIds.size,
      generatedOperatorIds,
      availableOperatorIds
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
      !String(
        contract?.catalogFingerprint || ""
      ).trim()
    ) {
      return false;
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
      "type",
      "enum"
    ].includes(kind)) {
      return true;
    }

    const memberName = String(
      definition.catalogMember || ""
    ).replace(/^@/, "");
    const identifiers = new Set();
    if (
      kind === "type" ||
      kind === "enum" ||
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
    definitionRevision,
    registry = null,
    definitions = null,
    customCSharpByIdentifier = null
  ) {
    const indexBase = {
      ...baseIndex,
      definitionRevision:
        Math.max(
          0,
          Number(definitionRevision) || 0
        ),
      customCSharpByIdentifier:
        customCSharpByIdentifier ||
        catalogProjectionCustomLookup(state)
    };
    const certificate =
      catalogProjectionIntegrityCertificate(
        indexBase,
        registry,
        definitions,
        definitionRevision
      );
    const index = Object.freeze({
      ...indexBase,
      integrityCertificate: certificate
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
      {
        ...current,
        availableOperatorIds:
          catalogProjectionSetLookup([
            ...(Array.isArray(
              current.availableOperatorIds
                ?.values
            )
              ? current.availableOperatorIds
                  .values
              : []),
            ...definitionEntries.map(
              ([operatorId]) => operatorId
            )
          ])
      },
      nextState,
      Number(
        window.__RMLNodeDefinitionRevision
      ) || 0,
      window.RMLModNodeRegistry || null,
      window.RMLModNodeRegistry
        ?.getNodeDefinitions?.() || null
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

    const nextIndex =
      completeCatalogProjectionIndex(
        {
          ...current,
          report: nextReport
        },
        state,
        Number(
          window.__RMLNodeDefinitionRevision
        ) || 0,
        window.RMLModNodeRegistry || null,
        window.RMLModNodeRegistry
          ?.getNodeDefinitions?.() || null,
        current.customCSharpByIdentifier
      );
    catalogProjectionCustomStateByIndex.set(
      nextIndex,
      state
    );
    window.RMLApiNodeFactoryReport =
      nextReport;
    if (
      factoryRegistryIntegrityCache
        ?.report === expectedReport
    ) {
      factoryRegistryIntegrityCache = {
        ...factoryRegistryIntegrityCache,
        report: nextReport
      };
    }
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
    if (kind === "hook-method") {
      if (id === "called") {
        return "output:called";
      }
      if (id === "instance") {
        return "output:instance";
      }
      const argument = /^argument(\d+)$/.exec(id);
      if (argument) {
        return `parameter:${Number(argument[1])}:output`;
      }
    }
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
    match = /^ownerGeneric(\d+)$/.exec(id);
    if (match) return `owner-generic:${Number(match[1])}:input`;
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
    const semantic = exactApiSemanticContractKey(contract);
    if (!semantic) return "";
    return `contract.${stableHash(JSON.stringify({
      version: 2,
      semantic
    }))}`;
  }

  function stableContractAliasValues(
    ...sources
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
    for (const source of sources) {
      append(source);
    }
    return result;
  }

  function stableContractAliasRecord(
    canonical,
    legacy,
    contract,
    additional = []
  ) {
    const fallback = stableContractId({
      ...(contract &&
      typeof contract === "object" &&
      !Array.isArray(contract)
        ? contract
        : {}),
      stableContractId: ""
    });
    const aliases = stableContractAliasValues(
      canonical,
      legacy,
      additional,
      fallback
    );
    return {
      primary: aliases[0] || "",
      legacy:
        String(legacy || "").trim() ||
        fallback ||
        aliases[0] ||
        "",
      aliases
    };
  }

  function readStableContractId(member) {
    return String(
      member?.readStableContractId ||
      member?.readContractId ||
      ""
    ).trim();
  }

  function writeStableContractId(member) {
    return String(
      member?.writeStableContractId ||
      member?.writeContractId ||
      ""
    ).trim();
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
          isIn:
            parameter?.isIn === true,
          isOut:
            parameter?.isOut === true,
          isOptional:
            parameter?.isOptional === true
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
      ),
      hookVisibility:
        kind === "hook-method"
          ? String(
              contract.hookVisibility || ""
            )
          : ""
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
      csType: normalizedPortableCsType(
        port?.csType || ""
      ),
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
      schemaVersion: Math.max(
        0,
        Number(contract?.schemaVersion) || 0
      ),
      semantic,
      signature: String(
        contract?.signature || ""
      ).trim(),
      runtimeBound:
        contract?.runtimeBound === true,
      directExecutable:
        contract?.directExecutable === true,
      parameters:
        (Array.isArray(contract?.parameters)
          ? contract.parameters
          : []).map((parameter, index) => ({
          position: Math.max(
            0,
            Number(parameter?.position) || index
          ),
          name: String(parameter?.name || ""),
          type: normalizedPortableCsType(
            parameter?.elementType ||
            parameter?.type
          ),
          isByRef:
            parameter?.isByRef === true,
          isIn:
            parameter?.isIn === true,
          isOut:
            parameter?.isOut === true,
          isOptional:
            parameter?.isOptional === true,
          hasDefaultValue:
            parameter?.hasDefaultValue === true,
          defaultValueCSharp: String(
            parameter?.defaultValueCSharp || ""
          )
        })),
      ownerGenericParameters:
        portableGenericParameterRows(
          contract,
          "ownerGenericParameters"
        ).map(portableGenericParameterContract),
      methodGenericParameters:
        portableGenericParameterRows(
          contract,
          "methodGenericParameters"
        ).map(portableGenericParameterContract),
      requiredAssemblyReferences:
        normalizedPortableAssemblyReferences(
          contract?.requiredAssemblyReferences
        ),
      baseAssemblyReferences:
        normalizedPortableAssemblyReferences(
          contract?.baseAssemblyReferences ||
          contract?.requiredAssemblyReferences
        ),
      enumValues:
        normalizedPortableEnumValues(
          contract?.enumValues
        ),
      enumUnderlyingType:
        normalizedPortableCsType(
          contract?.enumUnderlyingType || ""
        ),
      enumIsFlags:
        contract?.enumIsFlags === true,
      enumDefaultValue: String(
        contract?.enumDefaultValue || ""
      ),
      enumValue: String(
        contract?.enumValue || ""
      ),
      genericBindings:
        Object.fromEntries(
          Object.entries(
            contract?.genericBindings &&
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
              normalizedPortableCsType(
                value
              )
            ])
            .sort(([left], [right]) =>
              left.localeCompare(right)
            )
        ),
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

  function canonicalPortableCsType(value) {
    const aliases = new Map([
      ["bool", "System.Boolean"],
      ["byte", "System.Byte"],
      ["sbyte", "System.SByte"],
      ["short", "System.Int16"],
      ["ushort", "System.UInt16"],
      ["int", "System.Int32"],
      ["uint", "System.UInt32"],
      ["long", "System.Int64"],
      ["ulong", "System.UInt64"],
      ["nint", "System.IntPtr"],
      ["nuint", "System.UIntPtr"],
      ["char", "System.Char"],
      ["float", "System.Single"],
      ["double", "System.Double"],
      ["decimal", "System.Decimal"],
      ["string", "System.String"],
      ["object", "System.Object"],
      ["void", "System.Void"]
    ]);
    return normalizedPortableCsType(value)
      .replace(
        /(^|[^A-Za-z0-9_.@])(bool|byte|sbyte|short|ushort|int|uint|long|ulong|nint|nuint|char|float|double|decimal|string|object|void)(?=$|[^A-Za-z0-9_])/g,
        (_match, prefix, alias) =>
          `${prefix}${aliases.get(alias)}`
      )
      .replace(/\s+/g, "");
  }

  function exactPortableCsTypeIdentity(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    try {
      const identity =
        window.RMLCSharpContracts
          ?.canonicalTypeIdentity?.(
            text,
            { allowOpen: true }
          );
      if (identity) return identity;
    } catch {}

    const nullable = text.endsWith("?");
    const canonical =
      canonicalPortableCsType(text);
    return nullable
      ? `System.Nullable<${canonical}>`
      : canonical;
  }

  function portableCsTypesEqual(left, right) {
    return Boolean(
      exactPortableCsTypeIdentity(left) &&
      exactPortableCsTypeIdentity(left) ===
        exactPortableCsTypeIdentity(right)
    );
  }

  function normalizedPortableAssemblyReferences(value) {
    const references = new Map();
    for (const reference of
      Array.isArray(value) ? value : []) {
      const include = String(
        reference?.include || ""
      ).trim();
      if (
        !include ||
        !/^[A-Za-z0-9_.-]+$/.test(include) ||
        portableFrameworkAssembly(include)
      ) {
        continue;
      }
      const hintPath = String(
        reference?.hintPath || ""
      ).trim().replace(/\\/g, "/");
      const resonitePrefix =
        "$(ResonitePath)";
      const relativeHintPath =
        hintPath.startsWith(resonitePrefix)
          ? hintPath.slice(
              resonitePrefix.length
            )
          : "";
      if (
        hintPath &&
        (
          /[<>"';&|`\r\n]/.test(hintPath) ||
          !/^[A-Za-z0-9_.$()\/ +:-]+$/.test(
            hintPath
          ) ||
          !relativeHintPath ||
          relativeHintPath.startsWith("/") ||
          relativeHintPath.includes("$(") ||
          relativeHintPath.includes(":") ||
          relativeHintPath
            .split("/")
            .some(segment =>
              segment === ".." ||
              segment === "."
            )
        )
      ) {
        continue;
      }
      references.set(
        include.toLowerCase(),
        {
          include,
          hintPath,
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

  function portableFrameworkAssembly(value) {
    const name = String(value || "")
      .trim()
      .replace(/\.dll$/i, "");
    return Boolean(
      name === "mscorlib" ||
      name === "netstandard" ||
      name === "Microsoft.CSharp" ||
      name === "System" ||
      name.startsWith("System.")
    );
  }

  function portableExactEnumNumericText(value) {
    if (typeof value === "string") {
      const text = value.trim();
      return /^-?(?:0|[1-9][0-9]*)$/.test(text)
        ? text
        : "";
    }
    if (
      typeof value === "number" &&
      Number.isSafeInteger(value)
    ) {
      return String(value);
    }
    if (typeof value === "bigint") {
      return String(value);
    }
    return "";
  }

  function portableEnumCastExpression(
    enumType,
    underlyingType,
    value
  ) {
    const numeric =
      portableExactEnumNumericText(value);
    const underlying =
      canonicalPortableCsType(underlyingType);
    if (!numeric || ![
      "System.SByte", "System.Byte",
      "System.Int16", "System.UInt16",
      "System.Int32", "System.UInt32",
      "System.Int64", "System.UInt64"
    ].includes(underlying)) {
      return "";
    }
    let literal = numeric;
    if (underlying === "System.UInt32") {
      literal = `${numeric}U`;
    } else if (underlying === "System.Int64") {
      literal = numeric === "-9223372036854775808"
        ? "System.Int64.MinValue"
        : `${numeric}L`;
    } else if (underlying === "System.UInt64") {
      literal = `${numeric}UL`;
    }
    return `unchecked((${enumType})(${underlying})(${literal}))`;
  }

  function normalizedPortableEnumValues(value) {
    const values = new Map();
    for (const entry of
      Array.isArray(value) ? value : []) {
      const name = String(
        entry?.name || entry || ""
      ).trim();
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
          name
        )
      ) {
        continue;
      }
      const raw =
        entry &&
        typeof entry === "object" &&
        !Array.isArray(entry)
          ? entry.value ??
            entry.numericValue
          : null;
      values.set(name, {
        name,
        value: portableExactEnumNumericText(raw)
      });
    }
    return [...values.values()].sort(
      (left, right) =>
        left.name.localeCompare(right.name)
    );
  }

  function portableEnumValueNames(value) {
    return normalizedPortableEnumValues(value)
      .map(entry => entry.name);
  }

  function portableEnumMetadataIsSafe(
    contract
  ) {
    const sourceValues = Array.isArray(
      contract?.enumValues
    )
      ? contract.enumValues
      : [];
    const underlying = canonicalPortableCsType(
      contract?.enumUnderlyingType || ""
    );
    const ranges = new Map([
      ["System.SByte", [-128n, 127n]],
      ["System.Byte", [0n, 255n]],
      ["System.Int16", [-32768n, 32767n]],
      ["System.UInt16", [0n, 65535n]],
      ["System.Int32", [-2147483648n, 2147483647n]],
      ["System.UInt32", [0n, 4294967295n]],
      ["System.Int64", [-9223372036854775808n, 9223372036854775807n]],
      ["System.UInt64", [0n, 18446744073709551615n]]
    ]);
    const range = ranges.get(underlying);
    if (
      !range ||
      typeof contract?.enumIsFlags !==
        "boolean"
    ) {
      return false;
    }
    const values = normalizedPortableEnumValues(
      sourceValues
    );
    if (
      values.length === 0 ||
      values.length !== sourceValues.length
    ) {
      return false;
    }
    const numericValueCount = values.filter(
      entry => entry.value !== ""
    ).length;
    if (numericValueCount === 0) {
      return Number(contract?.schemaVersion) < 4;
    }
    if (numericValueCount !== values.length) {
      return false;
    }
    return values.every(entry => {
      if (!/^-?(?:0|[1-9][0-9]*)$/.test(
        entry.value
      )) {
        return false;
      }
      try {
        const numeric = BigInt(entry.value);
        return numeric >= range[0] &&
          numeric <= range[1];
      } catch {
        return false;
      }
    });
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
    const declared =
      normalizedPortableCsType(
        port?.csType
      );
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
      role === "output:instance"
    ) {
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
    if (
      direction === "input" &&
      role === "input:value" &&
      ["property-set", "field-set"].includes(
        String(contract?.kind || "")
      )
    ) {
      const parameters = Array.isArray(
        contract?.parameters
      ) ? contract.parameters : [];
      const parameter = parameters.at(-1);
      return normalizedPortableCsType(
        parameter?.elementType ||
        parameter?.type
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
    return declared;
  }

  function portableStoredPortCsType(
    contract,
    direction,
    port
  ) {
    return normalizedPortableCsType(
      port?.csType
    ) || portableContractPortCsType(
      contract,
      direction,
      port
    );
  }

  function portableGenericParameterRows(
    contract,
    key,
    fallback = []
  ) {
    const values = Array.isArray(
      contract?.[key]
    )
      ? contract[key]
      : fallback;
    return values
      .map((value, index) => ({
        ...(
          value &&
          typeof value === "object" &&
          !Array.isArray(value)
            ? value
            : {}
        ),
        name: String(
          value?.name || value || ""
        ).trim(),
        position: Math.max(
          0,
          Number(value?.position) || index
        )
      }))
      .filter(value => value.name)
      .sort((left, right) =>
        left.position - right.position
      );
  }

  function portableGenericParameterContract(
    value
  ) {
    return {
      name: String(value?.name || "").trim(),
      position: Math.max(
        0,
        Number(value?.position) || 0
      ),
      referenceTypeConstraint:
        value?.referenceTypeConstraint === true,
      valueTypeConstraint:
        value?.valueTypeConstraint === true,
      defaultConstructorConstraint:
        value?.defaultConstructorConstraint === true,
      unmanagedConstraint:
        value?.unmanagedConstraint === true,
      notNullConstraint:
        value?.notNullConstraint === true,
      variance: String(
        value?.variance || ""
      ).trim(),
      constraints: (
        Array.isArray(value?.constraints)
          ? value.constraints
          : []
      ).map(normalizedPortableCsType)
        .filter(Boolean)
        .sort()
    };
  }

  function portableContractSpecialization(
    requested,
    available = requested
  ) {
    if (
      exactApiSemanticContractKey(
        requested
      ) !==
      exactApiSemanticContractKey(
        available
      )
    ) {
      return null;
    }
    const ownerRows =
      portableGenericParameterRows(
        available,
        "ownerGenericParameters",
        genericTypeParameterNames(
          available?.ownerType
        )
      );
    const methodRows =
      portableGenericParameterRows(
        available,
        "methodGenericParameters"
      );
    const requestedOwnerRows =
      portableGenericParameterRows(
        requested,
        "ownerGenericParameters",
        genericTypeParameterNames(
          requested?.ownerType
        )
      );
    const requestedMethodRows =
      portableGenericParameterRows(
        requested,
        "methodGenericParameters"
      );
    if (
      JSON.stringify(
        requestedOwnerRows.map(
          portableGenericParameterContract
        )
      ) !== JSON.stringify(
        ownerRows.map(
          portableGenericParameterContract
        )
      ) ||
      JSON.stringify(
        requestedMethodRows.map(
          portableGenericParameterContract
        )
      ) !== JSON.stringify(
        methodRows.map(
          portableGenericParameterContract
        )
      )
    ) {
      return null;
    }
    const expectedMethodArity =
      Math.max(
        0,
        Number(available?.genericArity) || 0
      );
    if (
      methodRows.length !==
        expectedMethodArity
    ) {
      return null;
    }
    const bindings =
      requested?.genericBindings &&
      typeof requested.genericBindings ===
        "object" &&
      !Array.isArray(
        requested.genericBindings
      )
        ? requested.genericBindings
        : {};
    const rows = [
      ...ownerRows.map(value => ({
        ...value,
        prefix: "ownerGeneric"
      })),
      ...methodRows.map(value => ({
        ...value,
        prefix: "generic"
      }))
    ];
    if (
      Object.keys(bindings).length !==
        rows.length
    ) {
      return null;
    }

    const ownerSubstitutions = new Map();
    const methodSubstitutions = new Map();
    const normalizedBindings = {};
    for (const row of rows) {
      const key =
        `${row.prefix}${row.position}`;
      const selected =
        normalizedPortableCsType(
          bindings[key]
        );
      if (
        !selected ||
        !isSafeCSharpTypeExpression(
          selected
        ) ||
        isGenericParameterName(selected) ||
        isOpenTypeExpression(selected)
      ) {
        return null;
      }
      normalizedBindings[key] = selected;
      (
        row.prefix === "ownerGeneric"
          ? ownerSubstitutions
          : methodSubstitutions
      ).set(row.name, selected);
    }
    if (
      Object.keys(bindings).some(key =>
        !Object.prototype.hasOwnProperty.call(
          normalizedBindings,
          key
        )
      )
    ) {
      return null;
    }
    const substitutions = new Map([
      ...ownerSubstitutions,
      ...methodSubstitutions
    ]);
    const ownerType =
      substituteGenericTypeParameters(
        available?.ownerType ||
          "System.Object",
        available?.kind === "type"
          ? substitutions
          : ownerSubstitutions
      );
    const returnType =
      substituteGenericTypeParameters(
        available?.returnType ||
          "System.Void",
        substitutions
      );
    const parameters = (
      Array.isArray(available?.parameters)
        ? available.parameters
        : []
    ).map(parameter => {
      const result = { ...parameter };
      for (const key of [
        "type",
        "elementType"
      ]) {
        if (result[key]) {
          result[key] =
            substituteGenericTypeParameters(
              result[key],
              substitutions
            );
        }
      }
      return result;
    });
    const specializedContract = {
      ...available,
      ownerType,
      returnType,
      parameters
    };
    for (const [direction, key] of [
      ["input", "inputPorts"],
      ["output", "outputPorts"]
    ]) {
      const requestedPorts = Array.isArray(
        requested?.[key]
      )
        ? requested[key]
        : [];
      const availablePorts = new Map(
        (Array.isArray(available?.[key])
          ? available[key]
          : []).map(port => [
          String(port?.id || ""),
          port
        ])
      );
      if (
        requestedPorts.length !==
          availablePorts.size
      ) {
        return null;
      }
      for (const port of requestedPorts) {
        const id = String(port?.id || "");
        const basis =
          availablePorts.get(id);
        if (!basis) return null;
        const expectedCsType =
          portableContractPortCsType(
            specializedContract,
            direction,
            {
              ...basis,
              csType: ""
            }
          );
        const actualCsType =
          normalizedPortableCsType(
            port?.csType
          );
        if (
          expectedCsType &&
          !portableCsTypesEqual(
            actualCsType,
            expectedCsType
          )
        ) {
          return null;
        }
        if (
          !expectedCsType &&
          actualCsType
        ) {
          return null;
        }
      }
    }
    return Object.freeze({
      genericBindings:
        Object.freeze(normalizedBindings),
      ownerType,
      returnType,
      parameters: Object.freeze(parameters),
      ownerSubstitutions,
      methodSubstitutions,
      substitutions
    });
  }

  function portableContractSpecializationMatches(
    requested,
    available
  ) {
    return Boolean(
      portableContractSpecialization(
        requested,
        available
      )
    );
  }

  function portableParameterContractKey(
    contract
  ) {
    return JSON.stringify(
      (Array.isArray(contract?.parameters)
        ? contract.parameters
        : []).map((parameter, index) => ({
        position: Math.max(
          0,
          Number(parameter?.position) || index
        ),
        name: String(parameter?.name || ""),
        type: canonicalPortableCsType(
          parameter?.elementType ||
          parameter?.type
        ),
        isByRef:
          parameter?.isByRef === true,
        isIn:
          parameter?.isIn === true,
        isOut:
          parameter?.isOut === true,
        isOptional:
          parameter?.isOptional === true,
        hasDefaultValue:
          parameter?.hasDefaultValue === true,
        defaultValueCSharp: String(
          parameter?.defaultValueCSharp || ""
        )
      }))
    );
  }

  function portableBaseMetadataKey(contract) {
    return JSON.stringify({
      schemaVersion: Math.max(
        0,
        Number(contract?.schemaVersion) || 0
      ),
      semantic:
        exactApiSemanticContractKey(contract),
      parameters:
        portableParameterContractKey(
          contract
        ),
      ownerGenericParameters:
        portableGenericParameterRows(
          contract,
          "ownerGenericParameters",
          genericTypeParameterNames(
            contract?.ownerType
          )
        ).map(portableGenericParameterContract),
      methodGenericParameters:
        portableGenericParameterRows(
          contract,
          "methodGenericParameters"
        ).map(portableGenericParameterContract),
      requiredAssemblyReferences:
        normalizedPortableAssemblyReferences(
          contract?.baseAssemblyReferences ||
          contract?.requiredAssemblyReferences
        ),
      enumValues:
        normalizedPortableEnumValues(
          contract?.enumValues
        ),
      enumDefaultValue: String(
        contract?.enumDefaultValue || ""
      ),
      enumUnderlyingType:
        canonicalPortableCsType(
          contract?.enumUnderlyingType || ""
        ),
      enumIsFlags:
        contract?.enumIsFlags === true,
      ports: [
        ["input", "inputPorts"],
        ["output", "outputPorts"]
      ].map(([direction, key]) =>
        (Array.isArray(contract?.[key])
          ? contract[key]
          : []).map(port => ({
          id: String(port?.id || ""),
          optional:
            port?.optional === true,
          role: portablePortRole(
            contract?.kind,
            direction,
            port,
            contract?.parameters
          )
        }))
      )
    });
  }

  function portableBaseMetadataMatches(
    requested,
    available
  ) {
    if (
      String(requested?.kind || "") === "enum" ||
      String(available?.kind || "") === "enum"
    ) {
      if (
        String(requested?.kind || "") !== "enum" ||
        String(available?.kind || "") !== "enum"
      ) {
        return false;
      }
      const requestedCore = {
        ...requested,
        enumValues: [],
        enumDefaultValue: "",
        enumValue: ""
      };
      const availableCore = {
        ...available,
        enumValues: [],
        enumDefaultValue: "",
        enumValue: ""
      };
      if (
        !exactApiSemanticContractKey(requested) ||
        portableBaseMetadataKey(requestedCore) !==
          portableBaseMetadataKey(availableCore)
      ) {
        return false;
      }
      const requestedValues = new Map(
        normalizedPortableEnumValues(
          requested?.enumValues
        ).map(value => [value.name, value.value])
      );
      const availableValues = new Map(
        normalizedPortableEnumValues(
          available?.enumValues
        ).map(value => [value.name, value.value])
      );
      const selected = String(
        requested?.enumValue ||
        requested?.enumDefaultValue ||
        ""
      );
      if (!selected || !availableValues.has(selected)) {
        return false;
      }
      const requestedNumeric =
        requestedValues.get(selected) || "";
      const availableNumeric =
        availableValues.get(selected) || "";
      return !requestedNumeric ||
        !availableNumeric ||
        requestedNumeric === availableNumeric;
    }
    return Boolean(
      exactApiSemanticContractKey(requested) &&
      portableBaseMetadataKey(requested) ===
        portableBaseMetadataKey(available)
    );
  }

  function placeholderMatchesGeneratedContract(
    placeholder,
    generatedDefinition
  ) {
    if (
      (
        placeholder
          ?.unavailableApiContract !== true &&
        placeholder
          ?.portableApiExecutableContract !== true
      ) ||
      generatedDefinition
        ?.catalogGenerated !== true
    ) {
      return false;
    }
    const preserved =
      placeholder.preservedApiContract;
    const generated =
      generatedDefinition.apiVerification;
    return Boolean(
      portableBaseMetadataMatches(
        preserved,
        generated
      ) &&
      portableContractSpecializationMatches(
        preserved,
        generated
      )
    );
  }

  function normalizedRequiredApiPortCsType(
    value
  ) {
    return exactPortableCsTypeIdentity(
      value
    );
  }

  function resolvedRequiredApiDefinitionPorts(
    definition,
    requirement
  ) {
    if (!definition) return null;
    const genericBindings =
      requirement?.apiContract
        ?.genericBindings;
    const requiresSpecialization = Boolean(
      definition.compileTimeSpecializable ===
        true ||
      (
        genericBindings &&
        typeof genericBindings === "object" &&
        !Array.isArray(genericBindings) &&
        Object.keys(genericBindings).length > 0
      )
    );
    if (!requiresSpecialization) {
      return {
        inputs: Array.isArray(definition.inputs)
          ? definition.inputs
          : [],
        outputs: Array.isArray(definition.outputs)
          ? definition.outputs
          : []
      };
    }
    if (
      typeof definition.resolveDefinition !==
        "function"
    ) {
      return null;
    }
    try {
      const resolved =
        definition.resolveDefinition({
          operatorId: String(
            requirement?.operatorId || ""
          ),
          parameters:
            requirement?.nodeParameters &&
            typeof requirement.nodeParameters ===
              "object" &&
            !Array.isArray(
              requirement.nodeParameters
            )
              ? requirement.nodeParameters
              : {},
          apiContract:
            requirement?.apiContract || null
        });
      if (
        !resolved ||
        !Array.isArray(resolved.inputs) ||
        !Array.isArray(resolved.outputs)
      ) {
        return null;
      }
      return {
        inputs: resolved.inputs,
        outputs: resolved.outputs
      };
    } catch (_error) {
      return null;
    }
  }

  function requiredApiPortMismatches(
    definition,
    requirement,
    direction,
    actualPorts
  ) {
    const contractKey =
      direction === "input"
        ? "inputPorts"
        : "outputPorts";
    const referencedKey =
      direction === "input"
        ? "inputPorts"
        : "outputPorts";
    const expectedPorts = Array.isArray(
      requirement?.apiContract?.[contractKey]
    )
      ? requirement.apiContract[contractKey]
      : [];
    const referencedPorts = Array.isArray(
      requirement?.[referencedKey]
    )
      ? requirement[referencedKey]
      : [];
    const actualById = new Map(
      (Array.isArray(actualPorts)
        ? actualPorts
        : []).map(port => [
        String(port?.id || ""),
        port
      ])
    );
    const verificationById = new Map(
      (Array.isArray(
        definition?.apiVerification?.[contractKey]
      )
        ? definition.apiVerification[contractKey]
        : []).map(port => [
        String(port?.id || ""),
        port
      ])
    );
    const mismatches = new Set();

    for (const portId of referencedPorts) {
      const id = String(portId || "");
      if (id && !actualById.has(id)) {
        mismatches.add(id);
      }
    }
    for (const expected of expectedPorts) {
      const id = String(expected?.id || "");
      const actual = actualById.get(id);
      if (!id || !actual) {
        if (id) mismatches.add(id);
        continue;
      }
      const expectedType = String(
        expected?.type || ""
      );
      const expectedCsType =
        normalizedRequiredApiPortCsType(
          expected?.csType
        );
      const actualCsType =
        normalizedRequiredApiPortCsType(
          actual?.apiCsType ||
          actual?.csType ||
          verificationById.get(id)?.csType
        );
      if (
        expectedType &&
        String(actual?.type || "") !==
          expectedType &&
        !(
          expectedCsType &&
          actualCsType &&
          actualCsType === expectedCsType
        )
      ) {
        mismatches.add(id);
        continue;
      }
      const expectedTypeVar = String(
        expected?.typeVar || ""
      );
      if (
        expectedTypeVar &&
        String(actual?.typeVar || "") !==
          expectedTypeVar
      ) {
        mismatches.add(id);
        continue;
      }
      if (
        expectedCsType &&
        actualCsType !== expectedCsType
      ) {
        mismatches.add(id);
        continue;
      }
      if (
        typeof expected?.optional ===
          "boolean" &&
        (actual?.optional === true) !==
          expected.optional
      ) {
        mismatches.add(id);
      }
    }
    return [...mismatches];
  }

  function matchingFactoryIntegrityCertificate(
    catalog,
    report,
    registry,
    definitions,
    definitionRevision
  ) {
    const index =
      catalogProjectionIndexByReport.get(report) ||
      window.RMLApiCatalogProjectionIndex ||
      null;
    const certificate =
      index?.integrityCertificate;
    const expectedGenerated = Math.max(
      0,
      Number(report?.totalGeneratedNodes) || 0
    );
    if (
      Number(index?.version) !==
        CATALOG_PROJECTION_INDEX_VERSION ||
      index?.catalog !== catalog ||
      index?.report !== report ||
      String(index?.catalogFingerprint || "") !==
        String(catalog?.catalogFingerprint || "") ||
      String(index?.engineVersion || "") !==
        String(catalog?.engineVersion || "") ||
      Number(index?.revision) !==
        Number(report?.catalogProjectionRevision) ||
      Number(index?.definitionRevision) !==
        definitionRevision ||
      !certificate ||
      Number(certificate.version) !== 1 ||
      certificate.registry !== registry ||
      certificate.definitions !== definitions ||
      certificate.catalog !== catalog ||
      certificate.report !== report ||
      String(
        certificate.catalogFingerprint || ""
      ) !==
        String(catalog?.catalogFingerprint || "") ||
      String(certificate.engineVersion || "") !==
        String(catalog?.engineVersion || "") ||
      Number(certificate.projectionRevision) !==
        Number(report?.catalogProjectionRevision) ||
      Number(certificate.definitionRevision) !==
        definitionRevision ||
      Number(certificate.totalGeneratedNodes) !==
        expectedGenerated ||
      certificate.generatedOperatorIds !==
        index.generatedOperatorIds ||
      certificate.availableOperatorIds !==
        index.availableOperatorIds ||
      Number(
        certificate.generatedOperatorIds?.size
      ) !== expectedGenerated ||
      typeof certificate.generatedOperatorIds?.has !==
        "function" ||
      typeof certificate.availableOperatorIds?.has !==
        "function"
    ) {
      return null;
    }
    return certificate;
  }

  function scheduleLegacyFactoryIntegrityAudit({
    catalog,
    report,
    registry,
    definitions,
    definitionRevision,
    catalogFingerprint,
    engineVersion,
    metadataValid
  }) {
    if (
      factoryRegistryLegacyIntegrityAudit &&
      factoryRegistryLegacyIntegrityAudit.registry ===
        registry &&
      factoryRegistryLegacyIntegrityAudit.definitions ===
        definitions &&
      factoryRegistryLegacyIntegrityAudit.report ===
        report &&
      factoryRegistryLegacyIntegrityAudit.catalog ===
        catalog &&
      factoryRegistryLegacyIntegrityAudit.definitionRevision ===
        definitionRevision
    ) {
      return;
    }

    const audit = {
      registry,
      definitions,
      report,
      catalog,
      definitionRevision,
      publicationValid: metadataValid,
      generatedDefinitions: 0
    };
    factoryRegistryLegacyIntegrityAudit = audit;
    factoryRegistryIntegrityCache = {
      ...audit,
      catalogIdentity: apiCatalogIdentity(catalog)
    };

    const entries = (function* () {
      for (const id in definitions || {}) {
        if (
          Object.prototype.hasOwnProperty.call(
            definitions,
            id
          )
        ) {
          yield [id, definitions[id]];
        }
      }
    })();

    void (async () => {
      let complete = false;
      while (!complete) {
        if (
          window.RMLModNodeRegistry !== registry ||
          registry?.getNodeDefinitions?.() !==
            definitions ||
          (Number(
            window.__RMLNodeDefinitionRevision
          ) || 0) !== definitionRevision
        ) {
          return;
        }
        for (let index = 0; index < 512; index += 1) {
          const next = entries.next();
          if (next.done) {
            complete = true;
            break;
          }
          const [id, definition] = next.value;
          if (
            definition?.catalogGenerated !== true ||
            definition?.legacyCatalogAlias === true
          ) {
            continue;
          }
          audit.generatedDefinitions += 1;
          const contract = definition.apiVerification;
          if (
            definition.unavailableApiContract === true ||
            !contract ||
            typeof contract !== "object" ||
            Number(contract.schemaVersion) !==
              API_VERIFICATION_SCHEMA_VERSION ||
            String(contract.nodeId || "") !== id ||
            String(
              contract.catalogFingerprint || ""
            ) !== catalogFingerprint ||
            String(contract.engineVersion || "") !==
              engineVersion ||
            !String(
              contract.contractFingerprint || ""
            ).trim()
          ) {
            audit.publicationValid = false;
          }
        }
        if (!complete) {
          await factoryIntegrityCooperativeYield();
        }
      }
      if (
        audit.generatedDefinitions !==
          Number(report?.totalGeneratedNodes)
      ) {
        audit.publicationValid = false;
      }
      if (
        factoryRegistryLegacyIntegrityAudit === audit &&
        window.RMLModNodeRegistry === registry &&
        registry?.getNodeDefinitions?.() ===
          definitions &&
        (Number(
          window.__RMLNodeDefinitionRevision
        ) || 0) === definitionRevision
      ) {
        factoryRegistryIntegrityCache = {
          ...audit,
          catalogIdentity:
            apiCatalogIdentity(catalog)
        };
      }
    })().finally(() => {
      if (
        factoryRegistryLegacyIntegrityAudit === audit
      ) {
        factoryRegistryLegacyIntegrityAudit = null;
      }
    });
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

    const certificate =
      metadataValid
        ? matchingFactoryIntegrityCertificate(
            catalog,
            report,
            registry,
            definitions,
            definitionRevision
          )
        : null;
    let publicationValid = Boolean(certificate);
    let generatedDefinitions = certificate
      ? certificate.totalGeneratedNodes
      : 0;
    if (!certificate && cacheMatches) {
      publicationValid =
        factoryRegistryIntegrityCache
          .publicationValid;
      generatedDefinitions =
        factoryRegistryIntegrityCache
          .generatedDefinitions;
    } else if (!certificate) {
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
      if (metadataValid) {
        scheduleLegacyFactoryIntegrityAudit({
          catalog,
          report,
          registry,
          definitions,
          definitionRevision,
          catalogFingerprint,
          engineVersion,
          metadataValid
        });
      }
    } else {
      factoryRegistryIntegrityCache = {
        registry,
        definitions,
        report,
        catalog,
        catalogIdentity:
          apiCatalogIdentity(catalog),
        definitionRevision,
        publicationValid,
        generatedDefinitions,
        certificate
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
      const resolvedPorts =
        typeof requirement === "string"
          ? {
              inputs:
                Array.isArray(
                  definition?.inputs
                )
                  ? definition.inputs
                  : [],
              outputs:
                Array.isArray(
                  definition?.outputs
                )
                  ? definition.outputs
                  : []
            }
          : resolvedRequiredApiDefinitionPorts(
              definition,
              requirement
            );
      const incompatibleInputs =
        typeof requirement === "string" ||
        !resolvedPorts
          ? []
          : requiredApiPortMismatches(
              definition,
              requirement,
              "input",
              resolvedPorts.inputs
            );
      const incompatibleOutputs =
        typeof requirement === "string" ||
        !resolvedPorts
          ? []
          : requiredApiPortMismatches(
              definition,
              requirement,
              "output",
              resolvedPorts.outputs
            );
      if (
        (
          certificate &&
          !certificate.availableOperatorIds
            .has(operatorId)
        ) ||
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
        !resolvedPorts ||
        incompatibleInputs.length > 0 ||
        incompatibleOutputs.length > 0
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
      "admitting portable API contracts"
    );
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
    contract.schemaVersion = Math.max(
      0,
      Number(contract.schemaVersion) || 3
    );
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
      const preserved =
        existing.preservedApiContract;
      return (
        exactPortableContractKey(
          preserved
        ) === exactPortableContractKey(
          contract
        ) ||
        (
          portableBaseMetadataMatches(
            contract,
            preserved
          ) &&
          portableContractSpecializationMatches(
            contract,
            preserved
          )
        )
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
        portableBaseMetadataMatches(
          contract,
          available
        ) &&
        portableContractSpecializationMatches(
          contract,
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
              label: catalogUnavailableTypeLabel(
                port?.csType || port?.apiCsType
              ),
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
    const retainPortablePortMetadata = (
      ports,
      stored
    ) => {
      const byId = new Map(
        (Array.isArray(stored) ? stored : [])
          .map(port => [
            String(port?.id || ""),
            port
          ])
      );
      return ports.map(port => ({
        ...(byId.get(String(port.id)) || {}),
        id: port.id,
        type: port.type,
        optional: port.optional === true,
        role: port.semanticRole
      }));
    };
    contract.inputPorts =
      retainPortablePortMetadata(
        inputs,
        contract.inputPorts
      );
    contract.outputPorts =
      retainPortablePortMetadata(
        outputs,
        contract.outputPorts
      );
    const isApi = id.startsWith("api.");
    const displayName =
      catalogContractDisplayName(
        contract,
        isApi
          ? apiText(
              "api.catalog.title.unavailable_api",
              "Unavailable API"
            )
          : apiText(
              "api.catalog.title.unavailable_operator",
              "Unavailable Operator"
            )
      );
    registry.registerGroup?.(UNAVAILABLE_GROUP, { after: ADVANCED_GROUP });
    const registered = registry.registerNode(registrationId, {
      title: catalogUnavailableTitle(
        isApi,
        displayName
      ),
      group: UNAVAILABLE_GROUP,
      symbol: "API?",
      description:
        catalogUnavailableDescription(isApi),
      hiddenFromPalette: true,
      expertOnly: true,
      unavailableApiContract: true,
      preservedApiContract: contract,
      inputs,
      outputs,
      parameters: [],
      resolveDefinition(node) {
        const requested =
          node?.apiContract &&
          typeof node.apiContract ===
            "object" &&
          !Array.isArray(node.apiContract)
            ? node.apiContract
            : contract;
        return {
          inputs: makePorts(
            "input",
            requested.inputPorts,
            []
          ),
          outputs: makePorts(
            "output",
            requested.outputPorts,
            []
          )
        };
      },
      codegenCollect(api) {
        api.diagnostic?.(`${isApi ? "Unavailable API" : "Unavailable node"} contract '${displayName}' must be resolved before export.`);
      },
      codegenExpression(api) {
        api.diagnostic?.(`${isApi ? "Unavailable API" : "Unavailable node"} contract '${displayName}' must be resolved before export.`);
        return api.csDefault?.(api.type || "object") || "default!";
      },
      codegenAction(api) {
        api.diagnostic?.(`${isApi ? "Unavailable API" : "Unavailable node"} contract '${displayName}' must be resolved before export.`);
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

  function projectStoredContractMayExecute(
    _operatorId,
    contract
  ) {
    return String(
      contract?.kind || ""
    ) === "type";
  }

  function catalogOwnedProvisionalTypeInformation(
    _graphType,
    information
  ) {
    if (!information || information.catalogGenerated === true) {
      return false;
    }
    return Boolean(
      information.unavailableApiType === true ||
      information.portableApiType === true
    );
  }

  function languageOwnedExactTypeInformation(
    graphType,
    information
  ) {
    if (!information || information.catalogGenerated === true) {
      return false;
    }
    const id = String(graphType || "").trim();
    return Boolean(
      information.languageExactType === true ||
      information.normalExactType === true ||
      information.csharpExactType === true ||
      id.startsWith("normalExact:") ||
      id.startsWith("csharpExact:")
    );
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
    const portableTypeCompatibility =
      window.RMLGraphTypeImportMigrations
        ?.typeContractCompatibility;
    if (
      typeof canonicalSyntheticCollectorVerifier !==
      "function"
    ) {
      throw new Error(
        "The Runtime Graph cannot verify canonical synthetic collection contracts."
      );
    }
    if (
      typeof portableTypeCompatibility !==
      "function"
    ) {
      throw new Error(
        "The Runtime Graph cannot reconcile portable C# type contracts."
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
    const admittedTypeContracts =
      Array.isArray(admission?.typeContracts)
        ? admission.typeContracts
        : [];
    if (
      entries.length === 0 &&
      admittedTypeContracts.length === 0
    ) {
      throw new Error(
        "No portable API operator or type contracts were supplied for installation."
      );
    }

    const portableTypeContractsById =
      new Map();
    const portableTypeContractsByCsType =
      new Map();
    for (const value of
      admittedTypeContracts) {
      const graphType = String(
        value?.graphType || ""
      ).trim();
      const csType =
        normalizedPortableCsType(
          value?.csType
        );
      const hasExplicitTypeAuthority =
        Object.prototype.hasOwnProperty.call(
          value || {},
          "typeAuthority"
        );
      const requestedTypeAuthority = String(
        value?.typeAuthority || ""
      ).trim();
      const typeAuthority =
        requestedTypeAuthority ===
          "language-exact" ||
        (
          !hasExplicitTypeAuthority &&
          (
            graphType.startsWith("normalExact:") ||
            graphType.startsWith("csharpExact:")
          )
        )
          ? "language-exact"
          : "";
      if (
        !graphType ||
        !csType ||
        !isSafeCSharpTypeExpression(csType) ||
        isOpenTypeExpression(csType) ||
        (
          requestedTypeAuthority &&
          requestedTypeAuthority !==
            "language-exact"
        ) ||
        (
          typeAuthority === "language-exact" &&
          /^(?:api[.:]|apiEnum[.:])/i.test(
            graphType
          )
        )
      ) {
        throw new Error(
          "A portable graph type contract is incomplete or unsafe."
        );
      }
      const assignableToCsTypes = [
        ...new Set(
          (Array.isArray(
            value?.assignableToCsTypes
          )
            ? value.assignableToCsTypes
            : [])
            .map(normalizedPortableCsType)
            .filter(type =>
              type &&
              type !== csType &&
              isSafeCSharpTypeExpression(type) &&
              !isOpenTypeExpression(type)
            )
        )
      ].sort();
      const contract = Object.freeze({
        graphType,
        csType,
        typeAuthority,
        referenceType:
          value?.referenceType === true,
        valueType:
          value?.valueType === true,
        assignableToCsTypes:
          Object.freeze(
            assignableToCsTypes
          ),
        assemblyReferences:
          Object.freeze(
            normalizedPortableAssemblyReferences(
              value?.assemblyReferences
            )
          )
      });
      const previous =
        portableTypeContractsById.get(
          graphType
        );
      if (
        previous &&
        JSON.stringify(previous) !==
          JSON.stringify(contract)
      ) {
        throw new Error(
          `Portable C# type '${csType}' has conflicting contracts.`
        );
      }
      portableTypeContractsById.set(
        graphType,
        contract
      );
      const family =
        portableTypeContractsByCsType.get(
          csType
        ) || [];
      if (!family.includes(graphType)) {
        family.push(graphType);
      }
      portableTypeContractsByCsType.set(
        csType,
        family
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
          "A portable API contract is missing."
        );
      }
      const contract =
        structuredClone(value);
      const contractName =
        catalogContractDisplayName(
          contract,
          "Unnamed API contract"
        );
      if (
        !String(contract.ownerType || "").trim() ||
        !String(contract.kind || "").trim()
      ) {
        throw new Error(
          `Portable API contract '${contractName}' has no complete owner/kind identity.`
        );
      }
      contract.schemaVersion = Math.max(
        0,
        Number(contract.schemaVersion) || 3
      );
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
              `Portable API contract '${contractName}' contains an incomplete ${direction} port.`
            );
          }
          if (ids.has(id)) {
            throw new Error(
              `Portable API contract '${contractName}' contains duplicate ${direction} port '${id}'.`
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
              `Portable API contract '${contractName}' does not declare required ${direction} port '${requiredId || "<missing>"}'.`
            );
          }
        }
      }
      contract.requiredAssemblyReferences =
        normalizedPortableAssemblyReferences(
          contract.requiredAssemblyReferences
        );
      contract.baseAssemblyReferences =
        normalizedPortableAssemblyReferences(
          contract.baseAssemblyReferences ||
          contract.requiredAssemblyReferences
        );
      const enumMetadataSafe =
        contract.schemaVersion < 4 ||
        contract.kind !== "enum" ||
        portableEnumMetadataIsSafe(
          contract
        );
      contract.enumValues =
        normalizedPortableEnumValues(
          contract.enumValues
        );
      if (
        contract.schemaVersion >= 4 &&
        !portableContractSpecialization(
          contract,
          contract
        )
      ) {
        contract.portableSpecializationUnresolved = true;

        contract.portableSpecializationDiagnostic =
          `Portable API contract '${contractName}' has inconsistent generic bindings or specialized port types.`;
      }
      if (
        contract.schemaVersion >= 4 &&
        contract.kind === "enum" &&
        (
          !enumMetadataSafe ||
          !portableEnumValueNames(
            contract.enumValues
          ).includes(
            String(contract.enumDefaultValue || "")
          ) ||
          !portableEnumValueNames(
            contract.enumValues
          ).includes(
            String(contract.enumValue || "")
          )
        )
      ) {
        throw new Error(
          `Portable enum contract '${contractName}' has no exact declared value identity.`
        );
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

    const stagingTypeIds = new Set();
    const stagedTypeInformation = graphType =>
      stagedTypes.get(graphType) ||
      typeDefinitions[graphType] ||
      null;
    const canonicalGraphTypeId = graphType =>
      String(
        registry.canonicalType?.(
          graphType
        ) || graphType || ""
      );
    const uniqueGraphTypeForCsType = csType => {
      const normalized =
        normalizedPortableCsType(csType);
      if (
        portableCsTypesEqual(
          normalized,
          "System.Object"
        )
      ) {
        const objectInformation =
          stagedTypeInformation("object");
        if (
          !objectInformation ||
          !portableCsTypesEqual(
            objectInformation.csType,
            normalized
          )
        ) {
          throw new Error(
            "The Builder's root 'object' graph type does not represent System.Object."
          );
        }
        return "object";
      }
      const storedMatches = [
        ...new Set(
          portableTypeContractsByCsType.get(
            normalized
          ) || []
        )
      ];
      if (storedMatches.length === 1) {
        const exactGraphType =
          storedMatches[0];
        const information =
          stagedTypeInformation(
            exactGraphType
          );
        if (
          information &&
          !portableCsTypesEqual(
            information.csType,
            normalized
          )
        ) {
          throw new Error(
            `Portable C# type '${normalized}' represents a conflicting contract.`
          );
        }
        return exactGraphType;
      }
      const matches = new Set();
      for (const [id, information] of [
        ...Object.entries(typeDefinitions),
        ...stagedTypes
      ]) {
        if (
          portableCsTypesEqual(
            information?.csType,
            normalized
          )
        ) {
          matches.add(
            canonicalGraphTypeId(id)
          );
        }
      }
      for (const id of storedMatches) {
        matches.add(id);
      }
      if (matches.size > 1) {
        throw new Error(
          `Portable C# type '${normalized}' maps to multiple graph types.`
        );
      }
      return [...matches][0] ||
        graphTypeForCsType(normalized);
    };

    const stageType = (
      type,
      csType = "",
      suppliedTypeContract = null
    ) => {
      const typeContract =
        suppliedTypeContract ||
        portableTypeContractsById.get(type) ||
        null;
      const normalizedCsType =
        normalizedPortableCsType(csType) ||
        normalizedPortableCsType(
          typeContract?.csType
        );
      const readableType =
        catalogVisibleText(normalizedCsType) ||
        "portable type";
      if (
        typeContract &&
        (
          typeContract.graphType !== type ||
          !portableCsTypesEqual(
            typeContract.csType,
            normalizedCsType
          )
        )
      ) {
        throw new Error(
          `Portable C# type '${readableType}' does not match its stored contract.`
        );
      }
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
            `Portable C# type '${readableType}' represents conflicting contracts.`
          );
        }
        return;
      }
      const installedTypeInformation =
        typeDefinitions[type] || null;
      const installedProvisionalCsType =
        normalizedPortableCsType(
          installedTypeInformation?.csType
        );
      const replaceProvisionalType = Boolean(
        typeContract &&
        installedTypeInformation &&
        catalogOwnedProvisionalTypeInformation(
          type,
          installedTypeInformation
        ) &&
        (
          !installedProvisionalCsType ||
          portableCsTypesEqual(
            installedProvisionalCsType,
            "System.Object"
          ) ||
          portableCsTypesEqual(
            installedProvisionalCsType,
            normalizedCsType
          )
        )
      );
      const contractLanguageExactType =
        typeContract?.typeAuthority ===
          "language-exact";
      const projectLanguageExactType = Boolean(
        typeContract &&
        installedTypeInformation &&
        installedTypeInformation.catalogGenerated !==
          true &&
        (
          languageOwnedExactTypeInformation(
            type,
            installedTypeInformation
          ) ||
          contractLanguageExactType
        ) &&
        installedProvisionalCsType &&
        portableCsTypesEqual(
          installedProvisionalCsType,
          normalizedCsType
        )
      );
      if (projectLanguageExactType) {
        if (stagingTypeIds.has(type)) {
          throw new Error(
            `Portable C# type '${readableType}' has a cyclic inheritance contract.`
          );
        }
        stagingTypeIds.add(type);
        const assignableTo = new Set(
          Array.isArray(
            installedTypeInformation.assignableTo
          )
            ? installedTypeInformation.assignableTo
            : []
        );
        try {
          for (const baseCsType of
            typeContract.assignableToCsTypes) {
            const baseGraphType =
              uniqueGraphTypeForCsType(
                baseCsType
              );
            if (
              !typeDefinitions[baseGraphType] &&
              !stagedTypes.has(baseGraphType)
            ) {
              stageType(
                baseGraphType,
                baseCsType,
                portableTypeContractsById.get(
                  baseGraphType
                ) || null
              );
            }
            assignableTo.add(baseGraphType);
          }
          const assemblyReferences =
            normalizedPortableAssemblyReferences([
              ...normalizedPortableAssemblyReferences(
                installedTypeInformation
                  .assemblyReferences
              ),
              ...typeContract.assemblyReferences
            ]);
          const structuralConstraints =
            (Array.isArray(
              installedTypeInformation.constraints
            )
              ? installedTypeInformation.constraints
              : [])
              .filter(constraint =>
                !["reference", "value"].includes(
                  String(constraint || "")
                )
              );
          const adoptingCatalogProvisional =
            catalogOwnedProvisionalTypeInformation(
              type,
              installedTypeInformation
            );
          const languagePresentation =
            catalogLanguageExactTypePresentation(
              normalizedCsType,
              type
            );
          const projectedLanguageInformation = {
            ...installedTypeInformation,
            ...(adoptingCatalogProvisional
              ? languagePresentation
              : {}),
            csType: normalizedCsType,
            defaultCs:
              typeContract.referenceType === false
                ? `default(${normalizedCsType})`
                : "null!",
            referenceType:
              typeContract.referenceType,
            valueType:
              installedTypeInformation.valueType === true ||
              typeContract.valueType === true,
            languageExactType: true,
            assignableTo: [...assignableTo],
            constraints: [
              ...new Set([
                ...structuralConstraints,
                typeContract.referenceType === false
                  ? "value"
                  : "reference",
                "serializable"
              ])
            ],
            assembly:
              installedTypeInformation.assembly ||
              assemblyReferences[0]?.include ||
              "",
            assemblies: [
              ...new Set([
                ...(Array.isArray(
                  installedTypeInformation.assemblies
                )
                  ? installedTypeInformation.assemblies
                  : []),
                ...assemblyReferences.map(reference =>
                  reference.include
                )
              ].filter(Boolean))
            ],
            assemblyReferences
          };
          delete projectedLanguageInformation
            .catalogGenerated;
          delete projectedLanguageInformation
            .apiCatalogType;
          delete projectedLanguageInformation
            .unavailableApiType;
          delete projectedLanguageInformation
            .portableApiType;
          stagedTypes.set(
            type,
            projectedLanguageInformation
          );
        } finally {
          stagingTypeIds.delete(type);
        }
        return;
      }
      if (
        Object.prototype
          .hasOwnProperty.call(
            typeDefinitions,
            type
        ) &&
        !replaceProvisionalType
      ) {
        const existingCsType =
          normalizedPortableCsType(
            typeDefinitions[type]?.csType
          );
        if (
          normalizedCsType &&
          existingCsType &&
          !portableCsTypesEqual(
            normalizedCsType,
            existingCsType
          )
        ) {
          throw new Error(
            `Portable C# type '${readableType}' conflicts with the installed C# type '${existingCsType}'.`
          );
        }
        if (typeContract) {
          const information =
            typeDefinitions[type];
          const compatibility =
            portableTypeCompatibility(
              typeContract,
              information
            );
          const actualAssignable =
            (Array.isArray(
              information?.assignableTo
            )
              ? information.assignableTo
              : [])
              .filter(id =>
                String(id || "") !== type
              )
              .map(id =>
                canonicalPortableCsType(
                  typeDefinitions[id]
                    ?.csType || ""
                )
              )
              .filter(actual =>
                Boolean(actual) &&
                (
                  !normalizedCsType ||
                  !portableCsTypesEqual(
                    actual,
                    normalizedCsType
                  )
                )
              );
          if (
            !compatibility.compatible
          ) {
            throw new Error(
              `Portable C# type '${readableType}' conflicts with the installed inheritance contract.`
            );
          }
          const missingBases =
            typeContract.assignableToCsTypes
              .filter(base =>
                !actualAssignable.some(actual =>
                  portableCsTypesEqual(
                    actual,
                    base
                  )
                )
              );
          const installedAssemblyReferences =
            normalizedPortableAssemblyReferences(
              information
                ?.assemblyReferences
            );
          const mergedAssemblyReferences =
            normalizedPortableAssemblyReferences([
              ...installedAssemblyReferences,
              ...typeContract
                .assemblyReferences
            ]);
          const assemblyReferencesChanged =
            JSON.stringify(
              installedAssemblyReferences
            ) !== JSON.stringify(
              mergedAssemblyReferences
            );
          if (
            missingBases.length > 0 ||
            assemblyReferencesChanged
          ) {
            if (stagingTypeIds.has(type)) {
              throw new Error(
                `Portable C# type '${readableType}' has a cyclic inheritance contract.`
              );
            }
            stagingTypeIds.add(type);
            const assignableTo = new Set(
              Array.isArray(
                information?.assignableTo
              )
                ? information.assignableTo
                : []
            );
            try {
              for (const baseCsType of
                missingBases) {
                const baseGraphType =
                  uniqueGraphTypeForCsType(
                    baseCsType
                  );
                if (
                  !typeDefinitions[baseGraphType] &&
                  !stagedTypes.has(baseGraphType)
                ) {
                  stageType(
                    baseGraphType,
                    baseCsType,
                    portableTypeContractsById.get(
                      baseGraphType
                    ) || null
                  );
                }
                assignableTo.add(baseGraphType);
              }
              stagedTypes.set(type, {
                ...information,
                assignableTo:
                  [...assignableTo],
                assemblyReferences:
                  mergedAssemblyReferences
              });
            } finally {
              stagingTypeIds.delete(type);
            }
          }
        }
        return;
      }
      if (stagingTypeIds.has(type)) {
        throw new Error(
          `Portable C# type '${readableType}' has a cyclic inheritance contract.`
        );
      }
      stagingTypeIds.add(type);
      const assignableTo = new Set(["object"]);
      if (typeContract) {
        for (const baseCsType of
          typeContract.assignableToCsTypes) {
          const baseGraphType =
            uniqueGraphTypeForCsType(
              baseCsType
            );
          if (
            !typeDefinitions[baseGraphType] &&
            !stagedTypes.has(baseGraphType)
          ) {
            stageType(
              baseGraphType,
              baseCsType,
              portableTypeContractsById.get(
                baseGraphType
              ) || null
            );
          }
          assignableTo.add(baseGraphType);
        }
      }
      const elementCsType =
        portableEnumerableElementCsType(
          normalizedCsType
        );
      let elementGraphType = "";
      if (elementCsType) {
        elementGraphType =
          uniqueGraphTypeForCsType(
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
      const stagedAssemblyReferences =
        normalizedPortableAssemblyReferences(
          typeContract?.assemblyReferences || []
        );
      const languageExactGraphType =
        typeContract?.typeAuthority ===
          "language-exact";
      const languagePresentation =
        catalogLanguageExactTypePresentation(
          normalizedCsType,
          type
        );
      stagedTypes.set(type, {
        ...(languageExactGraphType
          ? languagePresentation
          : {
              label: catalogUnavailableTypeLabel(
                normalizedCsType
              ),
              short: "API?",
              color: "#ff6f91"
            }),
        csType:
          normalizedCsType || "object",
        defaultCs:
          typeContract?.referenceType ===
            false
            ? `default(${normalizedCsType})`
            : "null!",
        referenceType:
          typeContract
            ? typeContract.referenceType
            : true,
        valueType:
          typeContract
            ? typeContract.valueType
            : true,
        globalGenericCandidate: false,
        ...(languageExactGraphType
          ? {
              languageExactType: true,
              ...(String(type).startsWith("normalExact:")
                ? { normalExactType: true }
                : {}),
              ...(String(type).startsWith("csharpExact:")
                ? { csharpExactType: true }
                : {})
            }
          : { unavailableApiType: true }),
        assignableTo:
          [...assignableTo],
        constraints: [
          "value",
          ...(typeContract?.referenceType ===
            false
            ? []
            : ["reference"]),
          "serializable",
          ...(elementGraphType
            ? ["enumerable"]
            : [])
        ],
        assembly:
          stagedAssemblyReferences[0]?.include || "",
        assemblies:
          stagedAssemblyReferences.map(reference =>
            reference.include
          ),
        assemblyReferences:
          stagedAssemblyReferences,
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
      stagingTypeIds.delete(type);
    };

    for (const contract of
      portableTypeContractsById.values()) {
      stageType(
        contract.graphType,
        contract.csType,
        contract
      );
    }

    const portableHookTemplate =
      definitions["harmony.typedPatchEvent"] ||
      null;
    const portableHookVisibility = value => [
      "public",
      "private",
      "protected",
      "internal",
      "private-protected",
      "protected-internal"
    ].includes(String(value || ""));
    const portableHookContractIsExecutable = (
      operatorId,
      contract
    ) => {
      if (
        !portableHookTemplate ||
        typeof portableHookTemplate
          .codegenCollect !== "function" ||
        typeof portableHookTemplate
          .codegenExpression !== "function" ||
        !String(operatorId).startsWith(
          "api.hook."
        ) ||
        contract?.kind !== "hook-method" ||
        Number(contract?.genericArity) !== 0 ||
        !portableHookVisibility(
          contract?.hookVisibility
        ) ||
        !isSafeCSharpTypeExpression(
          contract?.ownerType
        ) ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
          String(contract?.memberName || "")
        ) ||
        !isSafeCSharpTypeExpression(
          contract?.returnType ||
          "System.Void"
        )
      ) {
        return false;
      }
      const parameters = Array.isArray(
        contract?.parameters
      ) ? contract.parameters : [];
      if (
        parameters.some(parameter =>
          parameter?.isByRef === true ||
          parameter?.isOut === true ||
          !isSafeCSharpTypeExpression(
            parameter?.type
          )
        )
      ) {
        return false;
      }
      const expectedOutputs = ["called"];
      if (contract?.isStatic !== true) {
        expectedOutputs.push("instance");
      }
      parameters.forEach((_parameter, index) =>
        expectedOutputs.push(
          `argument${index}`
        )
      );
      if (
        normalizedPortableCsType(
          contract?.returnType
        ) !== "System.Void" &&
        normalizedPortableCsType(
          contract?.returnType
        ) !== "void"
      ) {
        expectedOutputs.push("result");
      }
      const actualOutputs =
        (Array.isArray(contract?.outputPorts)
          ? contract.outputPorts
          : []).map(port =>
          String(port?.id || "")
        );
      return (
        expectedOutputs.length ===
          actualOutputs.length &&
        expectedOutputs.every(id =>
          actualOutputs.includes(id)
        )
      );
    };

    const portableDirectKinds = new Set([
      "method",
      "constructor",
      "property-get",
      "property-set",
      "field-get",
      "field-set",
      "type",
      "enum"
    ]);

    const portableDefaultExpressionIsSafe =
      value => {
        const text = String(value || "").trim();
        if (!text) return false;
        if (
          [
            "null",
            "default",
            "true",
            "false"
          ].includes(text)
        ) {
          return true;
        }
        if (
          /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?(?:[fFdDmMuUlL]{0,2})$/.test(
            text
          ) ||
          /^0[xX][0-9A-Fa-f]+(?:[uUlL]{0,2})$/.test(
            text
          ) ||
          /^"(?:[^"\\\r\n]|\\.)*"$/.test(
            text
          ) ||
          /^'(?:[^'\\\r\n]|\\.)'$/.test(
            text
          )
        ) {
          return true;
        }
        const defaultMatch =
          /^default\((.+)\)$/.exec(text);
        if (defaultMatch) {
          return isSafeCSharpTypeExpression(
            defaultMatch[1]
          );
        }
        return /^(?:@?[A-Za-z_][A-Za-z0-9_]*\.)+@?[A-Za-z_][A-Za-z0-9_]*$/.test(
          text
        );
      };

    const portableGenericRowsAreSafe =
      contract => {
        const rows = [
          ...portableGenericParameterRows(
            contract,
            "ownerGenericParameters",
            genericTypeParameterNames(
              contract?.ownerType
            )
          ).map(row => ({
            ...row,
            genericScope: "owner"
          })),
          ...portableGenericParameterRows(
            contract,
            "methodGenericParameters"
          ).map(row => ({
            ...row,
            genericScope: "method"
          }))
        ];
        const identities = new Set();
        for (const row of rows) {
          const name = String(row?.name || "");
          const position = Math.max(
            0,
            Number(row?.position) || 0
          );
          const identity =
            `${row.genericScope}|${name}|${position}`;
          if (
            !isCSharpIdentifier(name) ||
            identities.has(identity) ||
            (Array.isArray(row?.constraints)
              ? row.constraints
              : []).some(constraint =>
                !isSafeCSharpTypeExpression(
                  constraint
                )
              )
          ) {
            return false;
          }
          identities.add(identity);
        }
        return true;
      };

    const verifiedPortableDirectSpecialization = (
      contract,
      available = contract
    ) => {
      if (
        Number(contract?.schemaVersion) !== 4 ||
        !portableDirectKinds.has(
          String(contract?.kind || "")
        ) ||
        !portableBaseMetadataMatches(
          contract,
          available
        ) ||
        !portableGenericRowsAreSafe(contract)
      ) {
        return null;
      }
      const specialization =
        portableContractSpecialization(
          contract,
          available
        );
      if (
        !specialization ||
        !isSafeCSharpTypeExpression(
          specialization.ownerType
        ) ||
        isOpenTypeExpression(
          specialization.ownerType
        ) ||
        !isSafeCSharpTypeExpression(
          specialization.returnType ||
          "System.Void"
        ) ||
        isOpenTypeExpression(
          specialization.returnType ||
          "System.Void"
        )
      ) {
        return null;
      }
      const kind = String(contract.kind || "");
      if (
        !["type", "enum", "constructor"].includes(
          kind
        ) &&
        !isCSharpIdentifier(
          contract.memberName
        )
      ) {
        return null;
      }
      const parameters = Array.isArray(
        specialization.parameters
      ) ? specialization.parameters : [];
      for (
        let index = 0;
        index < parameters.length;
        index += 1
      ) {
        const parameter = parameters[index];
        const type = normalizedPortableCsType(
          parameter?.elementType ||
          parameter?.type
        );
        if (
          Math.max(
            0,
            Number(parameter?.position) || index
          ) !== index ||
          !isCSharpIdentifier(
            parameter?.name ||
            `argument${index}`
          ) ||
          !isSafeCSharpTypeExpression(type) ||
          isOpenTypeExpression(type) ||
          (
            parameter?.isOptional === true &&
            (
              parameter?.hasDefaultValue !== true ||
              !portableDefaultExpressionIsSafe(
                parameter?.defaultValueCSharp
              )
            )
          )
        ) {
          return null;
        }
      }
      if (kind === "enum") {
        const values =
          portableEnumValueNames(
            contract.enumValues
          );
        if (
          !portableEnumMetadataIsSafe(
            contract
          ) ||
          !values.includes(
            String(contract.enumDefaultValue || "")
          ) ||
          !values.includes(
            String(contract.enumValue || "")
          ) ||
          !isSafeCSharpTypeExpression(
            contract.enumUnderlyingType ||
            "System.Int32"
          )
        ) {
          return null;
        }
      }
      return Object.freeze({
        ...specialization,
        requiredAssemblyReferences:
          Object.freeze(
            normalizedPortableAssemblyReferences(
              contract.requiredAssemblyReferences
            ).map(reference =>
              Object.freeze(reference)
            )
          )
      });
    };

    const portableDirectSpecialization = (
      contract,
      available = contract
    ) => {
      const verified =
        verifiedPortableDirectSpecialization(
          contract,
          available
        );
      if (verified) return verified;
      const ownerType =
        normalizedPortableCsType(
          contract?.ownerType
        );
      const outputPorts = Array.isArray(
        contract?.outputPorts
      ) ? contract.outputPorts : [];
      if (
        Number(contract?.schemaVersion) !== 4 ||
        contract?.directExecutable !== true ||
        String(contract?.kind || "") !== "type" ||
        String(available?.kind || "") !== "type" ||
        exactApiSemanticContractKey(contract) !==
          exactApiSemanticContractKey(available) ||
        !isSafeCSharpTypeExpression(ownerType) ||
        isOpenTypeExpression(ownerType) ||
        (Array.isArray(contract?.parameters)
          ? contract.parameters.length
          : 0) !== 0 ||
        (Array.isArray(contract?.inputPorts)
          ? contract.inputPorts.length
          : 0) !== 0 ||
        outputPorts.length !== 1 ||
        String(outputPorts[0]?.id || "") !== "value" ||
        !portableCsTypesEqual(
          outputPorts[0]?.csType,
          "System.Type"
        )
      ) {
        return null;
      }
      return Object.freeze({
        genericBindings: Object.freeze({}),
        ownerType,
        returnType: "System.Type",
        parameters: Object.freeze([]),
        ownerSubstitutions: new Map(),
        methodSubstitutions: new Map(),
        substitutions: new Map(),
        requiredAssemblyReferences:
          Object.freeze(
            normalizedPortableAssemblyReferences(
              contract.requiredAssemblyReferences
            ).map(reference =>
              Object.freeze(reference)
            )
          )
      });
    };

    const portableOutputPortId = api =>
      String(
        api?.outputPortId ??
        api?.outputId ??
        api?.portId ??
        api?.output?.id ??
        api?.port?.id ??
        api?.connection?.fromPort ??
        ""
      );

    const portableOutputIsUsed = (api, id) => {
      if (
        typeof api?.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return false;
      }
      return typeof api?.isOutputConnected ===
        "function"
        ? api.isOutputConnected(id)
        : true;
    };

    const portableActionFields = api => {
      const token = api.token(api.node.id);
      return {
        result: `_apiResult${token}`,
        success: `_apiSuccess${token}`,
        exception: `_apiException${token}`,
        out(position) {
          return `_apiOut${Number(position)}${token}`;
        }
      };
    };

    const portableInputExpression = (
      api,
      id,
      csType
    ) =>
      `((${csType})(${api.input(id).code}))`;

    const portableCollectActionFields = (
      api,
      contract,
      specialization
    ) => {
      const fields = portableActionFields(api);
      if (portableOutputIsUsed(api, "success")) {
        api.addRuntimeField(
          `${api.node.id}.apiSuccess`,
          fields.success,
          "bool",
          "false"
        );
      }
      if (portableOutputIsUsed(api, "exception")) {
        api.addRuntimeField(
          `${api.node.id}.apiException`,
          fields.exception,
          "System.Exception?",
          "null"
        );
      }
      const kind = String(contract.kind || "");
      const returnType = kind === "constructor"
        ? specialization.ownerType
        : specialization.returnType;
      const isVoid = portableCsTypesEqual(
        returnType,
        "System.Void"
      );
      if (
        !isVoid &&
        portableOutputIsUsed(api, "result")
      ) {
        api.addRuntimeField(
          `${api.node.id}.apiResult`,
          fields.result,
          returnType,
          "default!"
        );
      }
      for (const parameter of
        specialization.parameters) {
        if (
          !(
            parameter?.isOut === true ||
            (
              parameter?.isByRef === true &&
              parameter?.isIn !== true
            )
          ) ||
          !portableOutputIsUsed(
            api,
            `out${parameter.position}`
          )
        ) {
          continue;
        }
        api.addRuntimeField(
          `${api.node.id}.apiOut.${parameter.position}`,
          fields.out(parameter.position),
          normalizedPortableCsType(
            parameter.elementType ||
            parameter.type
          ),
          "default!"
        );
      }
    };

    const portableWrapAction = (api, body) => {
      const fields = portableActionFields(api);
      const keepSuccess =
        portableOutputIsUsed(api, "success");
      const keepException =
        portableOutputIsUsed(api, "exception");
      const success = [
        keepSuccess
          ? `    ${fields.success} = true;`
          : "",
        keepException
          ? `    ${fields.exception} = null;`
          : ""
      ].filter(Boolean).join("\n");
      const failure = [
        keepSuccess
          ? `    ${fields.success} = false;`
          : "",
        keepException
          ? `    ${fields.exception} = exception;`
          : ""
      ].filter(Boolean).join("\n");
      return (
        `try\n{\n${String(body || "").trimEnd()}` +
        `${success ? `\n${success}` : ""}\n}\n` +
        "catch (System.Exception exception)\n{\n" +
        `${keepException ? failure : "    throw;"}\n}`
      );
    };

    const portableActionWithDone = (api, action) => {
      const done = api.emit("done");
      return `${String(action || "").trimEnd()}${
        done ? `\n${done}();` : ""
      }`;
    };

    const portableDirectArguments = (
      api,
      specialization
    ) => {
      const token = api.token(api.node.id);
      const fields = portableActionFields(api);
      const declarations = [];
      const argumentsList = [];
      const assignments = [];
      for (const parameter of
        specialization.parameters) {
        const position = Math.max(
          0,
          Number(parameter?.position) || 0
        );
        const csType = normalizedPortableCsType(
          parameter?.elementType ||
          parameter?.type
        );
        const local =
          `_apiArg${position}${token}`;
        const inputId = `arg${position}`;
        const input = parameter?.isOut === true
          ? null
          : api.input(inputId);
        if (parameter?.isOut === true) {
          declarations.push(
            `${csType} ${local};`
          );
          argumentsList.push(`out ${local}`);
        } else if (parameter?.isByRef === true) {
          declarations.push(
            `${csType} ${local} = ${
              portableInputExpression(
                api,
                inputId,
                csType
              )
            };`
          );
          argumentsList.push(
            `${parameter?.isIn === true ? "in" : "ref"} ${local}`
          );
        } else if (
          parameter?.isOptional === true &&
          input?.connected !== true
        ) {
          argumentsList.push(
            String(
              parameter.defaultValueCSharp
            ).trim()
          );
        } else {
          argumentsList.push(
            portableInputExpression(
              api,
              inputId,
              csType
            )
          );
        }
        if (
          (
            parameter?.isOut === true ||
            (
              parameter?.isByRef === true &&
              parameter?.isIn !== true
            )
          ) &&
          portableOutputIsUsed(
            api,
            `out${position}`
          )
        ) {
          assignments.push(
            `${fields.out(position)} = ${local};`
          );
        }
      }
      return {
        declarations,
        arguments: argumentsList,
        assignments
      };
    };

    const portableActionOutputExpression = api => {
      if (
        typeof api?.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return "default!";
      }
      const fields = portableActionFields(api);
      const output = portableOutputPortId(api);
      if (output === "success") {
        return fields.success;
      }
      if (output === "exception") {
        return fields.exception;
      }
      if (output === "result") {
        return fields.result;
      }
      const match = /^out(\d+)$/.exec(output);
      return match
        ? fields.out(Number(match[1]))
        : fields.result;
    };

    const createPortableDirectDefinition = (
      operatorId,
      contract,
      inputs,
      outputs,
      displayName
    ) => {
      const nodeContract = node => {
        const requested =
          node?.apiContract &&
          typeof node.apiContract === "object" &&
          !Array.isArray(node.apiContract)
            ? node.apiContract
            : contract;
        return {
          contract: requested,
          specialization:
            portableDirectSpecialization(
              requested,
              contract
            )
        };
      };
      const makeNodePorts = (
        requested,
        direction,
        key
      ) => (
        Array.isArray(requested?.[key])
          ? requested[key]
          : []
      ).map(port => registry.port(
        String(port?.id || ""),
        String(port?.label || port?.id || ""),
        String(port?.type || "object"),
        {
          optional:
            port?.optional === true,
          semanticRole:
            portablePortRole(
              requested.kind,
              direction,
              port,
              requested.parameters
            ),
          apiCsType:
            portableStoredPortCsType(
              requested,
              direction,
              port
            )
        }
      ));
      const genericParameters = [
        ...portableGenericParameterRows(
          contract,
          "ownerGenericParameters",
          genericTypeParameterNames(
            contract.ownerType
          )
        ).map(row => ({
          ...row,
          prefix: "ownerGeneric"
        })),
        ...portableGenericParameterRows(
          contract,
          "methodGenericParameters"
        ).map(row => ({
          ...row,
          prefix: "generic"
        }))
      ];
      const parameters = genericParameters.map(row => ({
        key:
          `api${row.prefix.charAt(0).toUpperCase()}${row.prefix.slice(1)}${row.position}`,
        label: apiFormat(
          "api.catalog.parameter.compile_time_type",
          "Compile-time type {name}",
          { name: row.name }
        ),
        kind: "text",
        default: "",
        affectsPorts: true,
        affectsNode: true,
        commitImmediately: true,
        monospace: true,
        spellcheck: false
      }));
      if (contract.kind === "enum") {
        const enumValueNames =
          portableEnumValueNames(
            contract.enumValues
          );
        parameters.push({
          key: "value",
          label: apiText(
            "api.catalog.parameter.value",
            "Value"
          ),
          kind: "select",
          options: enumValueNames.map(
            value => [value, value]
          ),
          default: contract.enumDefaultValue
        });
      }

      const definition = {
        title: apiFormat(
          "api.catalog.title.portable",
          "Portable API · {name}",
          { name: displayName }
        ),
        group:
          contract.kind === "enum" ||
          contract.kind === "type"
            ? API_GROUPS.types
            : contract.kind.startsWith("property")
              ? API_GROUPS.properties
              : contract.kind.startsWith("field")
                ? API_GROUPS.fields
                : contract.kind === "constructor"
                  ? API_GROUPS.constructors
                  : API_GROUPS.methods,
        symbol: "API",
        description: apiFormat(
          "api.catalog.description.portable",
          "Verified portable direct API contract for {name}.",
          { name: displayName }
        ),
        hiddenFromPalette: true,
        expertOnly: false,
        catalogGenerated: true,
        portableApiExecutableContract: true,
        preservedApiContract: contract,
        apiVerification: Object.freeze(
          structuredClone(contract)
        ),
        inputs,
        outputs,
        parameters,
        catalogType: contract.ownerType,
        catalogMember: contract.memberName,
        apiStableContractId:
          contract.stableContractId,
        apiMemberKind: contract.kind,
        apiSignature: contract.signature,
        apiParameters: contract.parameters,
        apiReturnType: contract.returnType,
        apiIsStatic:
          contract.isStatic === true,
        apiGenericArity:
          Math.max(
            0,
            Number(contract.genericArity) || 0
          ),
        apiOwnerGenericParameters:
          contract.ownerGenericParameters,
        apiMethodGenericParameters:
          contract.methodGenericParameters,
        apiEnumValues: contract.enumValues,
        apiEnumDefaultValue:
          contract.enumDefaultValue,
        apiEnumUnderlyingType:
          contract.enumUnderlyingType,
        apiEnumIsFlags:
          contract.enumIsFlags === true,
        requiredAssemblyReferences:
          contract.requiredAssemblyReferences,
        runtimeBound: false,
        apiThreadAffinity:
          String(
            contract.threadAffinity || "unknown"
          ),
        apiReloadSafety:
          normalizeReloadSafety(
            contract.reloadSafety
          ),
        apiReloadCleanupCapabilities:
          Array.isArray(
            contract.reloadCleanupCapabilities
          )
            ? contract.reloadCleanupCapabilities
            : [],
        apiReloadAutomaticCleanup:
          Array.isArray(
            contract.reloadAutomaticCleanup
          )
            ? contract.reloadAutomaticCleanup
            : [],
        apiGenericBindingParameters:
          genericParameters,
        resolveApiSpecialization(node) {
          const resolved = nodeContract(node);
          return resolved.specialization
            ? {
                ...resolved.specialization,
                genericBindings:
                  resolved.specialization
                    .genericBindings
              }
            : null;
        },
        resolveDefinition(node) {
          const resolved = nodeContract(node);
          if (!resolved.specialization) {
            return {};
          }
          return {
            inputs: makeNodePorts(
              resolved.contract,
              "input",
              "inputPorts"
            ),
            outputs: makeNodePorts(
              resolved.contract,
              "output",
              "outputPorts"
            ),
            apiResolvedSpecialization:
              resolved.specialization
          };
        },
        codegenCollect(api) {
          const resolved = nodeContract(api.node);
          if (!resolved.specialization) {
            api.diagnostic?.(
              `Portable API contract '${displayName}' is inconsistent with its saved specialization.`
            );
            return;
          }
          if ([
            "method",
            "constructor",
            "property-set",
            "field-set"
          ].includes(contract.kind)) {
            portableCollectActionFields(
              api,
              resolved.contract,
              resolved.specialization
            );
          }
        },
        codegenAction(api) {
          const resolved = nodeContract(api.node);
          const specialization =
            resolved.specialization;
          if (!specialization) {
            api.diagnostic?.(
              `Portable API contract '${displayName}' is inconsistent with its saved specialization.`
            );
            return "";
          }
          const kind = String(
            resolved.contract.kind || ""
          );
          const fields = portableActionFields(api);
          let body = "";
          if (
            kind === "method" ||
            kind === "constructor"
          ) {
            const argumentsResult =
              portableDirectArguments(
                api,
                specialization
              );
            const methodRows =
              portableGenericParameterRows(
                resolved.contract,
                "methodGenericParameters"
              );
            const genericSuffix =
              kind === "method" &&
              methodRows.length > 0
                ? `<${methodRows.map(row =>
                    specialization
                      .genericBindings[
                        `generic${row.position}`
                      ]
                  ).join(", ")}>`
                : "";
            const host = kind === "constructor"
              ? ""
              : resolved.contract.isStatic === true
                ? `${specialization.ownerType}.`
                : `((${specialization.ownerType})(${api.input("target").code})).`;
            const invocation = kind === "constructor"
              ? `new ${specialization.ownerType}(${argumentsResult.arguments.join(", ")})`
              : `${host}${escapeCSharpIdentifier(resolved.contract.memberName)}${genericSuffix}(${argumentsResult.arguments.join(", ")})`;
            const returnType = kind === "constructor"
              ? specialization.ownerType
              : specialization.returnType;
            const isVoid = portableCsTypesEqual(
              returnType,
              "System.Void"
            );
            const assignment = isVoid
              ? `${invocation};`
              : `${portableOutputIsUsed(api, "result") ? fields.result : "_"} = ${invocation};`;
            body = [
              ...argumentsResult.declarations,
              assignment,
              ...argumentsResult.assignments
            ].map(line => `    ${line}`).join("\n");
          } else if (kind === "property-set") {
            const parameters =
              specialization.parameters;
            const indexes = parameters.slice(0, -1);
            const valueParameter =
              parameters.at(-1);
            const host =
              resolved.contract.isStatic === true
                ? specialization.ownerType
                : `((${specialization.ownerType})(${api.input("target").code}))`;
            const indexValues = indexes.map(
              parameter =>
                portableInputExpression(
                  api,
                  `arg${parameter.position}`,
                  normalizedPortableCsType(
                    parameter.elementType ||
                    parameter.type
                  )
                )
            );
            const access = indexValues.length > 0
              ? `${host}[${indexValues.join(", ")}]`
              : `${host}.${escapeCSharpIdentifier(resolved.contract.memberName)}`;
            body = `    ${access} = ${portableInputExpression(
              api,
              "value",
              normalizedPortableCsType(
                valueParameter?.elementType ||
                valueParameter?.type
              )
            )};`;
          } else if (kind === "field-set") {
            const valueParameter =
              specialization.parameters.at(-1);
            const host =
              resolved.contract.isStatic === true
                ? specialization.ownerType
                : `((${specialization.ownerType})(${api.input("target").code}))`;
            body = `    ${host}.${escapeCSharpIdentifier(resolved.contract.memberName)} = ${portableInputExpression(
              api,
              "value",
              normalizedPortableCsType(
                valueParameter?.elementType ||
                valueParameter?.type
              )
            )};`;
          } else {
            return "";
          }
          return portableActionWithDone(
            api,
            portableWrapAction(api, body)
          );
        },
        codegenExpression(api) {
          const resolved = nodeContract(api.node);
          const specialization =
            resolved.specialization;
          if (!specialization) {
            api.diagnostic?.(
              `Portable API contract '${displayName}' is inconsistent with its saved specialization.`
            );
            return "default!";
          }
          const kind = String(
            resolved.contract.kind || ""
          );
          if (kind === "type") {
            return `typeof(${specialization.ownerType})`;
          }
          if (kind === "enum") {
            const selected = String(
              api.node?.parameters?.value ||
              resolved.contract.enumValue ||
              resolved.contract.enumDefaultValue ||
              ""
            );
            const enumEntry =
              normalizedPortableEnumValues(
                resolved.contract.enumValues
              ).find(value =>
                value.name === selected
              );
            const numericCast =
              portableEnumCastExpression(
                specialization.ownerType,
                resolved.contract.enumUnderlyingType,
                enumEntry?.value
              );
            return numericCast ||
              `${specialization.ownerType}.${escapeCSharpIdentifier(selected)}`;
          }
          if (
            kind === "method" ||
            kind === "constructor" ||
            kind === "property-set" ||
            kind === "field-set"
          ) {
            return portableActionOutputExpression(api);
          }
          const valueType =
            specialization.returnType;
          const access = host => {
            if (kind === "property-get") {
              const indexes =
                specialization.parameters.map(
                  parameter =>
                    portableInputExpression(
                      api,
                      `arg${parameter.position}`,
                      normalizedPortableCsType(
                        parameter.elementType ||
                        parameter.type
                      )
                    )
                );
              return indexes.length > 0
                ? `${host}[${indexes.join(", ")}]`
                : `${host}.${escapeCSharpIdentifier(resolved.contract.memberName)}`;
            }
            return `${host}.${escapeCSharpIdentifier(resolved.contract.memberName)}`;
          };
          if (resolved.contract.isStatic === true) {
            return access(
              specialization.ownerType
            );
          }
          const token = api.token(api.node.id);
          const target = api.input("target").code;
          return (
            `(((object?)(${target})) is ${specialization.ownerType} ` +
            `_apiTarget${token} ? ${access(`_apiTarget${token}`)} : ` +
            `default(${valueType})!)`
          );
        }
      };
      return definition;
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
      const contract = normalizedContract(
        operatorId,
        requested?.apiContract,
        requested
      );
      const alreadyStaged =
        stagedDefinitions.get(operatorId);
      if (alreadyStaged) {
        const stagedContract =
          alreadyStaged.preservedApiContract ||
          alreadyStaged.apiVerification;
        if (
          exactApiSemanticContractKey(
            stagedContract
          ) !==
          exactApiSemanticContractKey(
            contract
          ) ||
          !portableBaseMetadataMatches(
            contract,
            stagedContract
          ) ||
          !portableContractSpecializationMatches(
            contract,
            stagedContract
          )
        ) {
          throw new Error(
            `Portable API node '${catalogContractDisplayName(contract, "Unnamed API node")}' represents multiple incompatible semantic contracts.`
          );
        }
        for (const [direction, key] of [
          ["input", "inputPorts"],
          ["output", "outputPorts"]
        ]) {
          for (const port of contract[key]) {
            stageType(
              port.type,
              portableStoredPortCsType(
                contract,
                direction,
                port
              )
            );
          }
        }
        if (
          alreadyStaged
            .portableApiExecutableContract ===
              true
        ) {
          const references = new Map();
          for (const reference of [
            ...(Array.isArray(
              alreadyStaged
                .requiredAssemblyReferences
            )
              ? alreadyStaged
                  .requiredAssemblyReferences
              : []),
            ...contract
              .requiredAssemblyReferences
          ]) {
            references.set(
              String(
                reference.include
              ).toLowerCase(),
              reference
            );
          }
          alreadyStaged
            .requiredAssemblyReferences =
              [...references.values()];
        }
        continue;
      }
      const existing = definitions[operatorId];
      if (
        existing &&
        existing.unavailableApiContract !==
          true &&
        existing.portableApiHookContract !==
          true &&
        existing.portableApiExecutableContract !==
          true
      ) {
        throw new Error(
          `Portable API node '${catalogContractDisplayName(contract, "Unnamed API node")}' collides with a real or integrated registry definition.`
        );
      }
      const projectContractMayExecute =
        projectStoredContractMayExecute(
          operatorId,
          contract
        );
      const executablePortableHook =
        projectContractMayExecute &&
        portableHookContractIsExecutable(
          operatorId,
          contract
        );
      const executablePortableDirect =
        projectContractMayExecute
          ? portableDirectSpecialization(
              contract,
              contract
            )
          : null;
      const makePorts = (
        direction,
        key
      ) => contract[key].map(port => {
        const storedCsType =
          portableStoredPortCsType(
            contract,
            direction,
            port
          );

        stageType(
          port.type,
          ""
        );

        return registry.port(
          port.id,
          String(port.label || port.id),
          port.type,
          {
            optional:
              port.optional === true,

            unavailableApiPort: true,

            deadApiPort:
              contract.deadApiContract === true,

            semanticRole:
              port.role,

            apiCsType:
              storedCsType
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
      const isApi =
        operatorId.startsWith("api.");
      const displayName =
        catalogContractDisplayName(
          contract,
          isApi
            ? apiText(
                "api.catalog.title.unavailable_api",
                "Unavailable API"
              )
            : apiText(
                "api.catalog.title.unavailable_operator",
                "Unavailable Operator"
              )
        );
      let stagedDefinition;
      if (executablePortableHook) {
        const fixedMethod = Object.freeze({
          id: "",
          stableContractId: String(
            contract.stableContractId || ""
          ),
          name: String(contract.memberName),
          declaringType: String(
            contract.ownerType
          ),
          signature: String(
            contract.signature ||
            contract.memberName
          ),
          returnType: String(
            contract.returnType ||
            "System.Void"
          ),
          isStatic:
            contract.isStatic === true,
          visibility: String(
            contract.hookVisibility
          ),
          parameters: Object.freeze(
            contract.parameters.map(
              (parameter, index) =>
                Object.freeze({
                  ...parameter,
                  name:
                    parameter?.name ||
                    `argument${index}`,
                  elementType:
                    parameter?.elementType ||
                    parameter?.type
                })
            )
          ),
          attributes: Object.freeze([])
        });
        stagedDefinition = {
          ...portableHookTemplate,
          title: apiFormat(
            "api.catalog.title.hook",
            "Hook · {name}",
            { name: displayName }
          ),
          group: API_GROUPS.hooks,
          symbol: "H<T>",
          description:
            String(
              contract.signature ||
              apiFormat(
                "api.catalog.description.harmony_hook",
                "Typed Harmony hook for {name}.",
                { name: displayName }
              )
            ),
          hiddenFromPalette: true,
          expertOnly: false,
          inputs,
          outputs,
          parameters:
            (Array.isArray(
              portableHookTemplate.parameters
            )
              ? portableHookTemplate.parameters
              : []).filter(parameter =>
                parameter?.key !==
                  "hookContract"
              ).map(parameter => ({
                ...parameter
              })),
          catalogGenerated: true,
          portableApiHookContract: true,
          preservedApiContract:
            contract,
          apiVerification:
            Object.freeze(
              structuredClone(contract)
            ),
          catalogType:
            contract.ownerType,
          catalogMember:
            contract.memberName,
          apiStableContractId:
            contract.stableContractId,
          apiMemberKind: "hook-method",
          apiSignature:
            contract.signature,
          apiParameters:
            contract.parameters,
          apiReturnType:
            contract.returnType,
          apiIsStatic:
            contract.isStatic === true,
          apiGenericArity: 0,
          apiHookVisibility:
            contract.hookVisibility,
          apiHookMethod: fixedMethod,
          runtimeBound: false
        };
        delete stagedDefinition.resolveDefinition;
      } else if (executablePortableDirect) {
        stagedDefinition =
          createPortableDirectDefinition(
            operatorId,
            contract,
            inputs,
            outputs,
            displayName
          );
      } else {
        stagedDefinition = {
          title:
            catalogUnavailableTitle(
              isApi,
              displayName
            ),
          group: UNAVAILABLE_GROUP,
          symbol: "API?",
          description:
            catalogUnavailableDescription(isApi),
          hiddenFromPalette: true,
          expertOnly: true,
          unavailableApiContract: true,
          preservedApiContract:
            contract,
          inputs,
          outputs,
          parameters: [],
          resolveDefinition(node) {
            const nodeContract =
              node?.apiContract &&
              typeof node.apiContract ===
                "object" &&
              !Array.isArray(
                node.apiContract
              )
                ? node.apiContract
                : contract;
            const nodePorts = (
              direction,
              key
            ) => (
              Array.isArray(
                nodeContract?.[key]
              )
                ? nodeContract[key]
                : []
            ).map(port =>
              registry.port(
                String(port?.id || ""),
                String(
                  port?.label ||
                  port?.id ||
                  ""
                ),
                String(
                  port?.type || "object"
                ),
                {
                  optional:
                    port?.optional === true,
                  unavailableApiPort: true,
                  semanticRole:
                    portablePortRole(
                      nodeContract?.kind,
                      direction,
                      port,
                      nodeContract?.parameters
                    ),
                  apiCsType:
                    portableStoredPortCsType(
                      nodeContract,
                      direction,
                      port
                    )
                }
              )
            );
            return {
              inputs: nodePorts(
                "input",
                "inputPorts"
              ),
              outputs: nodePorts(
                "output",
                "outputPorts"
              )
            };
          },
          codegenCollect(api) {
            api.diagnostic?.(
              `${isApi ? "Unavailable API" : "Unavailable node"} contract '${displayName}' must be resolved before export.`
            );
          },
          codegenExpression(api) {
            api.diagnostic?.(
              `${isApi ? "Unavailable API" : "Unavailable node"} contract '${displayName}' must be resolved before export.`
            );
            return api.csDefault?.(
              api.type || "object"
            ) || "default!";
          },
          codegenAction(api) {
            api.diagnostic?.(
              `${isApi ? "Unavailable API" : "Unavailable node"} contract '${displayName}' must be resolved before export.`
            );
            return "";
          }
        };
      }
      stagedDefinitions.set(
        operatorId,
        stagedDefinition
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
          (
            definition.unavailableApiContract ===
              true ||
            definition.portableApiHookContract ===
              true ||
            definition.portableApiExecutableContract ===
              true
          ) &&
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
              `Portable API definition '${catalogContractDisplayName(stagedDefinitions.get(operatorId)?.preservedApiContract, "Unnamed API node")}' changed while the project import was pending.`
            );
          }
          if (
            current &&
            current.unavailableApiContract !==
              true &&
            current.portableApiHookContract !==
              true &&
            current.portableApiExecutableContract !==
              true
          ) {
            throw new Error(
              `Portable API definition '${catalogContractDisplayName(stagedDefinitions.get(operatorId)?.preservedApiContract, "Unnamed API node")}' is no longer available for a portable placeholder.`
            );
          }
        }
        for (const [type, information] of
          stagedTypes) {
          const baseline =
            ownedTypeBaselines.get(type);
          if (baseline?.present) {
            if (
              typeDefinitions[type] !==
                baseline.value
            ) {
              throw new Error(
                `Portable C# type '${catalogVisibleText(information?.csType) || "portable type"}' changed while the project import was pending.`
              );
            }
            typeDefinitions[type] =
              information;
            publishedTypes.set(
              type,
              information
            );
          } else if (!typeDefinitions[type]) {
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
        registry.registerGroup?.(
          API_GROUPS.hooks,
          { after: API_GROUPS.methods }
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
      "portable-contract-install",
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
    const signal = options?.signal || null;
    const assertNotCancelled = action => {
      if (!signal?.aborted) return;
      if (signal.reason instanceof Error) {
        throw signal.reason;
      }
      const error = new Error(
        `The catalog factory rebuild was cancelled before ${String(action || "completion")}.`
      );
      error.name = "AbortError";
      error.code =
        "RML_CATALOG_FACTORY_ABORTED";
      throw error;
    };
    assertNotCancelled("it started");
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
    let publicationNotificationStarted = false;
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
        const readableLabel =
          catalogVisibleText(
            information.label,
            [id]
          ) ||
          catalogVisibleText(
            information.csType
          ) ||
          "Unknown type";
        const readableShort =
          catalogVisibleText(
            information.short,
            [id]
          ) ||
          readableLabel
            .split(/[.<]/)
            .filter(Boolean)
            .pop()
            ?.slice(0, 4)
            .toUpperCase() ||
          "TYPE";
        stagedTypes[id] = {
          label: readableLabel,
          short: readableShort,
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
      assertNotCancelled(
        "publishing its staged definitions"
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
      assertNotCancelled(
        "committing its staged definitions"
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
      }
      stagedCatalogProjectionIndex =
        completeCatalogProjectionIndex(
          stagedCatalogProjectionIndex,
          stagedCatalogProjectionCustomState,
          stagedCatalogProjectionRevision,
          stagingRegistry,
          stagedDefinitions
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
        typeof stagedCatalogProjectionIndex
          .typeByName?.has !== "function"
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
          !catalogOwnedProvisionalTypeInformation(
            id,
            current
          )
        ) {
          throw new Error(
            `Live API type '${catalogVisibleText(stagedTypes[id]?.csType || stagedTypes[id]?.label, [id]) || "Unavailable API type"}' collides with a non-catalog graph type. The existing type was retained.`
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
            "function" ||
          typeof catalogPublication.notify !==
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

      stagedCatalogProjectionIndex =
        completeCatalogProjectionIndex(
          stagedCatalogProjectionIndex,
          stagedCatalogProjectionCustomState,
          Number(
            window.__RMLNodeDefinitionRevision
          ) || 0,
          registry,
          definitions
        );
      catalogProjectionIndexByReport.set(
        report,
        stagedCatalogProjectionIndex
      );
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
        typeof stagedCatalogProjectionIndex
          .typeByName?.has !== "function"
      ) {
        throw new Error(
          "The rebuilt API catalog factory failed to publish its prepared graph-codegen index."
        );
      }

      await yieldToBrowser();
      assertNotCancelled(
        "announcing its completed publication"
      );
      assertFactoryOperationLease(
        lease,
        "notifying the completed catalog publication"
      );
      assertNotCancelled(
        "notifying its completed publication"
      );
      if (
        catalogPublication &&
        catalogPublication.verify() !== true
      ) {
        throw new Error(
          "The rebuilt API catalog changed before its final publication notification."
        );
      }
      publicationNotificationStarted = true;
      completeFactoryReady(report);
      try {
        window.dispatchEvent(
          new CustomEvent(
            "rml-api-node-factory-ready",
            { detail: report }
          )
        );
      } catch (factoryEventError) {
        console.error(
          "The verified API factory event could not be delivered.",
          factoryEventError
        );
      }
      if (catalogPublication) {
        catalogPublication.notify();
      }
      return report;
    } catch (error) {
      if (publicationNotificationStarted) {
        throw error;
      }
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
          if (
            String(
              apiContract?.kind || ""
            ) === "type"
          ) {
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
        let settled = false;
          const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
          requestAnimationFrame(finish);
      } else {
        window.RMLScheduleTask(resolve);
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
      [API_GROUPS.types, {
        after: apiText(
          "api.catalog.group.values_anchor",
          "Values"
        )
      }],
      [API_GROUPS.constructors, { after: API_GROUPS.types }],
      [API_GROUPS.methods, { after: API_GROUPS.constructors }],
      [API_GROUPS.hooks, { after: API_GROUPS.methods }],
      [API_GROUPS.properties, { after: API_GROUPS.hooks }],
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
    const enumTypeNames = new Set(
      enumRows
        .map(row =>
          normalizeCsType(row?.fullName)
        )
        .filter(Boolean)
    );
    const demandRequiredOperatorIds =
      catalog.catalogDemandPartial === true &&
      Array.isArray(
        catalog.catalogDemandRequiredOperatorIds
      ) &&
      catalog.catalogDemandRequiredOperatorIds.length > 0
        ? new Set(
            catalog.catalogDemandRequiredOperatorIds
              .map(value =>
                String(value || "").trim()
              )
              .filter(Boolean)
          )
        : null;
    const demandCompleteOwnerNames =
      catalog.catalogDemandPartial === true &&
      Array.isArray(
        catalog.catalogDemandCompleteOwners
      )
        ? new Set(
            catalog.catalogDemandCompleteOwners
              .map(normalizeCsType)
              .filter(Boolean)
          )
        : new Set();
    const definitions = getNodeDefinitions();
    const typeByName = new Map();
    const genericTypeRowsByShape = new Map();
    const projectionTypeByName = new Map();
    const projectionGenericTypeByShape =
      new Map();
    const projectionEnumByName = new Map();
    const projectionAssemblyByName =
      new Map();
    const projectionOperatorsByStableContractId =
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

    function catalogTypesInExpression(csType) {
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

      const genericRow =
        genericTypeRowsByShape.get(
          genericTypeShape(normalized)
        );
      if (genericRow?.fullName) {
        names.add(
          normalizeCsType(genericRow.fullName)
        );
      }

      for (const candidate of matches) {
        if (typeByName.has(candidate)) {
          names.add(candidate);
        }
      }

      return [...names];
    }

    function catalogRowForType(csType) {
      const normalized = normalizeCsType(csType);
      return (
        typeByName.get(normalized) ||
        genericTypeRowsByShape.get(
          genericTypeShape(normalized)
        ) ||
        null
      );
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
        catalogTypesInExpression(csType)) {
        const information =
          typeByName.get(typeName);
        if (information) rows.push(information);
      }

      for (const information of rows) {
        const include = String(
          information.assembly || ""
        ).trim();

        if (
          !include ||
          portableFrameworkAssembly(include)
        ) continue;

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

    function publishDynamicGraphType(
      graphType,
      information
    ) {
      const liveRegistry =
        window.RMLModNodeRegistry;
      if (
        activeFactoryOperationLease ||
        !liveRegistry ||
        liveRegistry === registry ||
        typeof liveRegistry.registerType !==
          "function" ||
        typeof liveRegistry.getTypeInformation !==
          "function"
      ) {
        return;
      }
      const published = {
          ...information,
          assignableTo: Array.isArray(
            information?.assignableTo
          )
            ? [...information.assignableTo]
            : information?.assignableTo,
          constraints: Array.isArray(
            information?.constraints
          )
            ? [...information.constraints]
            : information?.constraints,
          assemblies: Array.isArray(
            information?.assemblies
          )
            ? [...information.assemblies]
            : information?.assemblies,
          assemblyReferences: Array.isArray(
            information?.assemblyReferences
          )
            ? information.assemblyReferences.map(
                value => ({ ...value })
              )
            : information?.assemblyReferences
        };
      const existing =
        liveRegistry.getTypeInformation(
          graphType
        );
      if (existing) {
        Object.assign(
          existing,
          published
        );
      } else {
        liveRegistry.registerType(
          graphType,
          published
        );
      }
    }

    function ensureDynamicGraphTypePublished(
      graphType
    ) {
      const information =
        getTypeInformation(graphType);
      if (information) {
        publishDynamicGraphType(
          graphType,
          information
        );
      }
      return information;
    }

    function provisionalApiTypeInformation(
      graphType,
      information
    ) {
      return catalogOwnedProvisionalTypeInformation(
        graphType,
        information
      );
    }

    function registerApiType(fullName, row = null) {
      const csType = normalizeCsType(fullName);
      if (!csType || csType === "System.Void" || csType === "void") {
        return null;
      }

      let replacementGraphType = "";
      let languageExactInformation = null;
      const known = graphTypeByCs.get(csType);
      const knownInformation = known
        ? getTypeInformation(known)
        : null;
      if (
        known &&
        knownInformation
      ) {
        if (
          provisionalApiTypeInformation(
            known,
            knownInformation
          )
        ) {
          replacementGraphType = known;
        } else if (
          languageOwnedExactTypeInformation(
            known,
            knownInformation
          )
        ) {
          replacementGraphType = known;
          languageExactInformation =
            knownInformation;
        } else {
          ensureDynamicGraphTypePublished(
            known
          );
          enrichGraphTypeAssemblies(
            known,
            csType,
            row || typeByName.get(csType) || null
          );
          return known;
        }
      }
      if (known && !knownInformation) {
        graphTypeByCs.delete(csType);
        graphTypeByNormalizedCs.delete(
          normalizeTypeForLookup(csType)
        );
      }

      const normalizedLookup =
        normalizeTypeForLookup(csType);
      const existing =
        graphTypeByNormalizedCs.get(
          normalizedLookup
        );
      if (
        !replacementGraphType &&
        existing &&
        getTypeInformation(existing)
      ) {
        const existingInformation =
          getTypeInformation(existing);
        if (
          provisionalApiTypeInformation(
            existing,
            existingInformation
          )
        ) {
          replacementGraphType = existing;
        } else if (
          languageOwnedExactTypeInformation(
            existing,
            existingInformation
          )
        ) {
          replacementGraphType = existing;
          languageExactInformation =
            existingInformation;
        } else {
          ensureDynamicGraphTypePublished(
            existing
          );
          enrichGraphTypeAssemblies(
            existing,
            csType,
            row || typeByName.get(csType) || null
          );
          return existing;
        }
      }
      if (
        !replacementGraphType &&
        existing &&
        !getTypeInformation(existing)
      ) {
        graphTypeByNormalizedCs.delete(
          normalizedLookup
        );
      }

      if (isOpenTypeExpression(csType)) {
        return "object";
      }

      const information =
        row || catalogRowForType(csType) || {};
      const enumType =
        information.kind === "enum" ||
        enumTypeNames.has(csType);
      const graphType =
        replacementGraphType ||
        (
          enumType
            ? `apiEnum:${csType}`
            : apiGraphTypeId(csType)
        );
      const referenceType =
        !enumType &&
        (
          information.kind === "class" ||
          information.kind === "interface" ||
          information.kind === "static-class" ||
          (
            !information.kind &&
            !looksLikeValueType(csType)
          )
        );
      const label =
        information.name ||
        shortTypeName(csType);
      const color = colorForString(csType);
      const enumerableElementCsType =
        enumerableElementCsTypeFor(
          csType,
          information
        );

      let graphTypeInformation = {
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
              enumType,

          assignableTo: referenceType
              ? ["object"]
              : [],

          constraints:
              enumType
                  ? ["value", "serializable", "enumOrString"]
                  : referenceType
                      ? ["reference", "serializable"]
                      : ["serializable"],

          catalogGenerated: true,
          apiCatalogType: csType,
          catalogStaticClass:
              information.kind === "static-class",
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
      };
      if (languageExactInformation) {
        graphTypeInformation = {
          ...languageExactInformation,
          ...graphTypeInformation,
          label:
            languageExactInformation.label ||
            graphTypeInformation.label,
          short:
            languageExactInformation.short ||
            graphTypeInformation.short,
          color:
            languageExactInformation.color ||
            graphTypeInformation.color,
          languageExactType: true
        };
        delete graphTypeInformation.catalogGenerated;
        delete graphTypeInformation.apiCatalogType;
        delete graphTypeInformation.unavailableApiType;
        delete graphTypeInformation.portableApiType;
      }
      registerType(
        graphType,
        graphTypeInformation
      );
      publishDynamicGraphType(
        graphType,
        graphTypeInformation
      );

      graphTypeByCs.set(csType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(csType),
        graphType
      );

      const assignable = new Set(
        Array.isArray(
          getTypeInformation(graphType)
            ?.assignableTo
        )
          ? getTypeInformation(graphType)
              .assignableTo
          : []
      );
      const inheritanceQueue = [];
      const enqueueCatalogSupertypes = (
        catalogRow,
        actualType
      ) => {
        if (!catalogRow) return;
        const substitutions =
          genericTypeSubstitutions(
            catalogRow.fullName,
            actualType
          );
        for (const candidate of [
          catalogRow.baseType,
          ...(Array.isArray(
            catalogRow.interfaces
          )
            ? catalogRow.interfaces
            : [])
        ]) {
          if (!candidate) continue;
          inheritanceQueue.push(
            substituteGenericTypeParameters(
              candidate,
              substitutions
            )
          );
        }
      };
      enqueueCatalogSupertypes(
        information,
        csType
      );
      const visitedSupertypes = new Set();
      while (inheritanceQueue.length > 0) {
        const candidate = normalizeCsType(
          inheritanceQueue.shift()
        );
        if (
          !candidate ||
          visitedSupertypes.has(candidate) ||
          isOpenTypeExpression(candidate)
        ) {
          continue;
        }
        visitedSupertypes.add(candidate);
        const candidateRow =
          catalogRowForType(candidate);
        const candidateGraphType =
          registerApiType(
            candidate,
            candidateRow
          );
        if (
          candidateGraphType &&
          candidateGraphType !== graphType
        ) {
          assignable.add(candidateGraphType);
        }
        enqueueCatalogSupertypes(
          candidateRow,
          candidate
        );
      }
      if (information.isComponent) {
        assignable.add("component");
      }
      if (information.isMaterial) {
        assignable.add("material");
      }
      if (information.isCommonMaterial) {
        assignable.add("commonMaterial");
      }
      if (information.isMeshProvider) {
        assignable.add("mesh");
      }
      if (information.isTextureProvider) {
        assignable.add("texture");
      }
      if (information.isAudioClipProvider) {
        assignable.add("audioClip");
      }
      if (information.isCollider) {
        assignable.add("collider");
      }
      if (referenceType) {
        assignable.add("object");
      }
      assignable.delete(graphType);
      const registeredInformation =
        getTypeInformation(graphType);
      if (registeredInformation) {
        registeredInformation.assignableTo =
          [...assignable];
      }

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

      ensureDynamicGraphTypePublished(
        graphType
      );

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

      assignable.delete(graphType);
      information.assignableTo = [...assignable];
    }

    let typeNodeCount = 0;
    let enumNodeCount = 0;
    let constructorNodeCount = 0;
    let methodNodeCount = 0;
    let hookMethodNodeCount = 0;
    let propertyNodeCount = 0;
    let fieldNodeCount = 0;
    let eventNodeCount = 0;
    let runtimeBoundMethodCount = 0;
    let skippedCount = 0;

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogMemberOwner(row)) {
        continue;
      }
      const csType = normalizeCsType(row.fullName);
      const typeGenericParameters =
        genericTypeParameterNames(csType);
      const openGeneric =
        isOpenTypeExpression(csType) &&
        typeGenericParameters.length > 0;
      const id = `api.type.${stableHash(csType)}`;
      if (
        demandRequiredOperatorIds &&
        !demandRequiredOperatorIds.has(id)
      ) {
        continue;
      }
      registerGeneratedNode(id, withReloadContract({
        title: apiFormat(
          row.kind === "enum"
            ? "api.catalog.title.enum_type"
            : "api.catalog.title.type",
          row.kind === "enum"
            ? "Enum type · {name}"
            : "Type · {name}",
          { name: displayTypeName(row) }
        ),
        group: groupForType(row, API_GROUPS.types),
        symbol: "TYPE",
        description: openGeneric
          ? apiFormat(
              "api.catalog.description.closed_type",
              "Constructs an exact closed System.Type for {type}.",
              { type: csType }
            )
          : apiFormat(
              "api.catalog.description.type_constant",
              "Exact System.Type constant for {type}.",
              { type: csType }
            ),
        inputs: openGeneric
          ? genericTypeInputPorts(
              typeGenericParameters,
              "generic"
            )
          : [],
        outputs: [port(
          "value",
          apiText("api.catalog.port.type", "Type"),
          "type"
        )],
        codegenExpression(api) {
          if (!openGeneric) {
            return `typeof(${csType})`;
          }
          return genericTypeTokenExpression(
            api,
            csType,
            typeGenericParameters,
            "generic"
          );
        },
        catalogGenerated: true,
        catalogType: csType,
        apiStableContractId:
          String(row.stableContractId || ""),
        apiStableContractIds:
          stableContractAliasValues(
            row.stableContractId,
            row.stableContractIds,
            row.contractId,
            row.contractIds
          ),
        apiMemberKind: "type",
        apiSignature: `typeof(${csType})`,
        apiParameters: [],
        apiReturnType: "System.Type",
        apiGenericArity:
          typeGenericParameters.length,
        apiTypeGenericParameters:
          ownerGenericParameters(
            csType,
            row
          ),
        compileTimeSpecializable:
          openGeneric,
        runtimeBound: openGeneric,
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
      if (!enumRow || !enumRow.fullName) {
        continue;
      }
      const values = Array.isArray(enumRow.values)
        ? enumRow.values.filter(value =>
            value &&
            String(value.name || "").trim()
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
      const enumUnderlyingType = normalizeCsType(
        enumRow.underlyingType || "System.Int32"
      );

      registerGeneratedNode(id, withReloadContract({
        title: apiFormat(
          "api.catalog.title.enum",
          "Enum · {name}",
          { name: shortTypeName(csType) }
        ),
        group: enumRow.isObsolete === true
          ? API_GROUPS.advanced
          : groupForType(
              { fullName: csType },
              API_GROUPS.types
            ),
        symbol: "ENUM",
        description: apiFormat(
          "api.catalog.description.enum_constant",
          "Typed constant for {type}.",
          { type: csType }
        ),
        parameters: [{
          key: "value",
          label: apiText(
            "api.catalog.parameter.value",
            "Value"
          ),
          kind: "select",
          options,
          default: defaultValue,
          help: enumRow.isFlags
            ? apiText(
                "api.catalog.enum.help.flags",
                "This is a [Flags] enum. This constant selects one declared value."
              )
            : apiText(
                "api.catalog.enum.help.select",
                "Select one declared enum value."
              )
        }],
        outputs: [port(
          "value",
          apiText("api.catalog.port.value", "Value"),
          graphType || "object"
        )],
        codegenExpression(api) {
          const selected = String(api.node.parameters?.value || defaultValue);
          const selectedRow = values.find(value =>
            String(value?.name || "") === selected
          );
          const numericCast = portableEnumCastExpression(
            csType,
            enumUnderlyingType,
            selectedRow?.value ??
              selectedRow?.numericValue
          );
          return numericCast ||
            `${csType}.${escapeCSharpIdentifier(selected)}`;
        },
        catalogGenerated: true,
        catalogType: csType,
        apiMemberKind: "enum",
        apiSignature: csType,
        apiParameters: [],
        apiReturnType: csType,
        apiEnumValues:
          values.map(value => ({
            name: String(value.name),
            value:
              value.value ??
              value.numericValue ??
              null
          })),
        apiEnumDefaultValue: defaultValue,
        apiEnumUnderlyingType: enumUnderlyingType,
        apiEnumIsFlags:
          enumRow.isFlags === true,
        apiSearchText: `${csType} ${enumUnderlyingType} ${enumRow.isFlags === true ? "flags" : "enum"} ${values.map(value => `${value.name} ${value.value ?? value.numericValue ?? ""}`).join(" ")}`
      }, enumRow,
      enumRow.valueReloadSafety,
      { member: enumRow }));
      enumNodeCount += 1;
    }

    const eventTemplateDefinition =
      definitions["lifecycle.subscribeEvent"];
    const eventTemplate = eventTemplateDefinition
      ? [
          "lifecycle.subscribeEvent",
          eventTemplateDefinition
        ]
      : null;
    const hookTemplate =
      definitions["harmony.typedPatchEvent"] ||
      null;

    for (const owner of typeRows) {
      if ((cooperativeWork += 1) % 12 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogMemberOwner(owner)) {
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

      const methods = catalogMembersForOwner(
        owner,
        "methods"
      );
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
        if (
          method.isHookable === true &&
          method.apiInheritedProjection !== true &&
          method.id
        ) {
          const hookDefinition =
            createHookMethodDefinition(
              owner,
              {
                ...method,
                stableContractId:
                  `contract.hook.method.${method.id}`
              },
              hookTemplate
            );
          const hookId = hookDefinition
            ? canonicalMemberNodeId(
                "api.hook.",
                hookDefinition
              )
            : "";
          if (
            hookId &&
            registerGeneratedNode(
              hookId,
              hookDefinition
            )
          ) {
            hookMethodNodeCount += 1;
          } else {
            skippedCount += 1;
          }
        }
      }

      const hookMethods = Array.isArray(
        owner.hookMethods
      ) ? owner.hookMethods : [];
      for (const method of hookMethods) {
        const definition =
          createHookMethodDefinition(
            owner,
            method,
            hookTemplate
          );
        const id = definition
          ? canonicalMemberNodeId(
              "api.hook.",
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
          hookMethodNodeCount += 1;
        } else {
          skippedCount += 1;
        }
      }

      const properties = catalogMembersForOwner(
        owner,
        "properties"
      );
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
            if (!property.apiInheritedProjection) {
              registerLegacyMember(
                prefix,
                legacyBase,
                index,
                properties.length,
                id
              );
            }
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
            if (!property.apiInheritedProjection) {
              registerLegacyMember(
                prefix,
                legacyBase,
                index,
                properties.length,
                id
              );
            }
          } else {
            skippedCount += 1;
          }
        }
      });

      const fields = catalogMembersForOwner(
        owner,
        "fields"
      );
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
          if (!field.apiInheritedProjection) {
            registerLegacyMember(
              getPrefix,
              legacyBase,
              index,
              fields.length,
              getId
            );
          }
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
            if (!field.apiInheritedProjection) {
              registerLegacyMember(
                setPrefix,
                legacyBase,
                index,
                fields.length,
                setId
              );
            }
          } else {
            skippedCount += 1;
          }
        }
      });

      const events = Array.isArray(owner.events)
        ? owner.events
        : [];
      for (const eventInfo of events) {
        if (
          ownerGenericParameters(
            normalizeCsType(owner.fullName)
          ).length > 0
        ) {
          skippedCount += 1;
          continue;
        }
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
              .filter(([, values]) => {
                if (values.length <= 1) {
                  return false;
                }
                const semanticKeys = new Set(
                  values.map(value =>
                    typeof value === "string"
                      ? ""
                      : exactApiSemanticContractKey(
                          value?.apiContract
                        )
                  )
                );
                return (
                  semanticKeys.has("") ||
                  semanticKeys.size > 1
                );
              })
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
          if (
            Number(
              requiredContract?.schemaVersion
            ) >= 4 &&
            (
              !portableBaseMetadataMatches(
                requiredContract,
                availableContract
              ) ||
              !portableContractSpecializationMatches(
                requiredContract,
                availableContract
              )
            )
          ) {
            return null;
          }
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
                oldRow.type !== replacement.type &&
                !portableCsTypesEqual(
                  oldRow.csType,
                  replacement.csType
                )
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
        const stableContractIdsByRequiredId =
          new Map();
        const requestedSemanticKeys =
          new Set();
        const requestedSemanticDiscriminators =
          new Set();
        const requestedStableContractIds =
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
          const stableIds =
            stableContractAliasValues(
              contract?.stableContractId,
              contract?.stableContractIds
            );
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
          stableContractIdsByRequiredId.set(
            id,
            stableIds
          );
          for (const stableId of stableIds) {
            requestedStableContractIds.add(
              stableId
            );
          }
          requestedSemanticKeys.add(key);
          requestedSemanticDiscriminators
            .add(discriminator);
        }

        const semanticCandidatesByKey =
          new Map(
            [...requestedSemanticKeys]
              .map(key => [key, []])
          );
        const stableCandidatesByContractId =
          new Map(
            [...requestedStableContractIds]
              .map(id => [id, []])
          );
        const projectionIndex =
          catalogProjectionIndexByReport.get(
            report
          ) ||
          window.RMLApiCatalogProjectionIndex ||
          null;
        const indexedStableOperators =
          projectionIndex
            ?.operatorIdsByStableContractId;
        if (
          typeof indexedStableOperators?.get ===
            "function"
        ) {
          for (const stableId of
            requestedStableContractIds) {
            const stableMatches =
              stableCandidatesByContractId.get(
                stableId
              );
            for (const candidateId of
              indexedStableOperators.get(
                stableId
              ) || []) {
              const normalizedId = String(
                candidateId || ""
              ).trim();
              if (
                normalizedId &&
                resolutionDefinitions[
                  normalizedId
                ] &&
                !stableMatches.includes(
                  normalizedId
                )
              ) {
                stableMatches.push(
                  normalizedId
                );
              }
            }
          }
        }
        const semanticFallbackRequired =
          [...semanticKeyById.keys()]
            .some(requiredId => {
              const stableIds =
                stableContractIdsByRequiredId
                  .get(requiredId) || [];
              return (
                stableIds.length === 0 ||
                !stableIds.some(stableId =>
                  (
                    stableCandidatesByContractId
                      .get(stableId) || []
                  ).length > 0
                )
              );
            });
        if (semanticFallbackRequired) {
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
              scannedDefinitions % 512 ===
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
            for (const stableId of
              stableContractAliasValues(
                definition?.apiStableContractId,
                definition?.apiStableContractIds,
                definition?.apiVerification
                  ?.stableContractId,
                definition?.apiVerification
                  ?.stableContractIds
              )) {
              const stableMatches =
                stableCandidatesByContractId
                  .get(stableId);
              if (stableMatches) {
                stableMatches.push(id);
              }
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
          const stableCandidates = [
            ...new Set(
              (
                stableContractIdsByRequiredId
                  .get(oldId) || []
              ).flatMap(stableId =>
                stableCandidatesByContractId
                  .get(stableId) || []
              )
            )
          ];
          const candidates = [
            ...new Set([
              ...exactCandidates,
              ...stableCandidates
            ])
          ];
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

          const ordinalDomainSize = Math.max(
            entry.groupSize,
            entry.currentIndex + 1
          );
          for (
            let historicalIndex = 0;
            historicalIndex < ordinalDomainSize;
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
                  `The compatible API alias '${catalogDefinitionDisplayName(definition, id)}' changed before publication.`
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
      hookMethodNodes: hookMethodNodeCount,
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
          ),
        operatorIdsByStableContractId:
          catalogProjectionMultiLookup(
            projectionOperatorsByStableContractId
          ),
        generatedOperatorIds:
          catalogProjectionSetLookup(
            generatedNodeIds
          ),
        availableOperatorIds:
          catalogProjectionSetLookup([
            ...generatedNodeIds,
            ...legacyAliasIds
          ])
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
          publishedDefinitionRevision,
          registry,
          definitions
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
        "type",
        "enum"
      ]);
      if (!supported.has(kind)) return definition;

      const owner = normalizeCsType(definition.catalogType || "");
      const member = escapeCSharpIdentifier(definition.catalogMember || "");
      const parameters = Array.isArray(definition.apiParameters)
        ? definition.apiParameters
        : [];
      if (
        (kind === "method" || kind === "constructor") &&
        parameters.some(parameter =>
          parameter?.isOut === true ||
          parameter?.isByRef === true
        )
      ) {
        return definition;
      }
      const genericArity = Math.max(0, Number(definition.apiGenericArity) || 0);
      const ownerGenericParameters =
        Array.isArray(
          definition.apiOwnerGenericParameters
        )
          ? definition.apiOwnerGenericParameters
          : [];
      const typeGenericParameters =
        Array.isArray(
          definition.apiTypeGenericParameters
        )
          ? definition.apiTypeGenericParameters
          : [];
      const input = (
        context,
        id,
        renderMode = ""
      ) => String(
        context.input(id, renderMode) || ""
      ).trim();
      const argument = (context, parameter) => {
        const position = Math.max(0, Number(parameter?.position) || 0);
        const value = input(context, `arg${position}`) ||
          String(parameter?.defaultValueCSharp || "default");
        if (parameter?.isOut === true) return `out ${value}`;
        if (parameter?.isByRef === true) return `${parameter?.isIn === true ? "in" : "ref"} ${value}`;
        return value;
      };
      const specializeOwner = context => {
        if (ownerGenericParameters.length === 0) {
          return owner;
        }
        const substitutions = new Map(
          ownerGenericParameters.map(
            (name, index) => [
              name,
              genericBindingType(
                context.node,
                "ownerGeneric",
                index
              ) ||
              input(
                context,
                `ownerGeneric${index}`,
                "type"
              ) || "object"
            ]
          )
        );
        return substituteGenericTypeParameters(
          owner,
          substitutions
        );
      };
      const host = context => definition.apiIsStatic === true
        ? String(context.node?.parameters?.customCSharpStaticTarget || specializeOwner(context))
        : input(context, "target");
      const genericSuffix = context => {
        if (genericArity === 0) return "";
        const types = Array.from({ length: genericArity }, (_, index) =>
          genericBindingType(
            context.node,
            "generic",
            index
          ) ||
          input(
            context,
            `generic${index}`,
            "type"
          ) || "object"
        );
        return `<${types.join(", ")}>`;
      };

      definition.customCSharpCatalogNode = true;
      definition.customCSharpOutputPort =
        kind === "method"
          ? (definition.outputs || []).some(port => port.id === "result") ? "result" : "done"
          : kind === "constructor" ? "result"
            : kind === "property-get" || kind === "field-get" || kind === "type" || kind === "enum" ? "value"
              : "done";
      definition.syntaxRender = context => {
        if (kind === "type") {
          const renderedType =
            typeGenericParameters.length > 0
              ? substituteGenericTypeParameters(
                  owner,
                  new Map(
                    typeGenericParameters.map(
                      (name, index) => [
                        name,
                        input(
                          context,
                          `generic${index}`,
                          "type"
                        ) || "object"
                      ]
                    )
                  )
                )
              : owner;
          return context.renderMode === "type"
            ? renderedType
            : `typeof(${renderedType})`;
        }
        if (kind === "enum") {
          const defaultValue = String(
            (definition.parameters || [])
              .find(parameter =>
                parameter?.key === "value"
              )?.default || "_"
          );
          const selected = String(
            context.node?.parameters?.value ||
            defaultValue
          );
          return `${owner}.${escapeCSharpIdentifier(selected)}`;
        }
        if (kind === "constructor") {
          const type = String(context.node?.parameters?.customCSharpTypeText || specializeOwner(context));
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

    function enrichDefinitionAssemblyReferences(
      definition
    ) {
      const dependencyReferences = [
        definition?.catalogType,
        definition?.apiReturnType,
        ...(Array.isArray(
          definition?.apiParameters
        )
          ? definition.apiParameters
              .flatMap(parameter => [
                parameter?.type,
                parameter?.elementType
              ])
          : [])
      ].flatMap(type => {
        const normalized =
          normalizeCsType(type || "");
        if (!normalized) return [];
        return assemblyReferencesForCsType(
          normalized,
          typeByName.get(normalized) || null
        );
      });
      const references = new Map();
      for (const reference of [
        ...(Array.isArray(
          definition?.requiredAssemblyReferences
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
          {
            include,
            hintPath: String(
              reference?.hintPath || ""
            ).trim(),
            private:
              reference?.private === true
          }
        );
      }
      definition.requiredAssemblyReferences =
        [...references.values()];
    }

    function registerGeneratedNode(id, definition) {
      if (!definition) {
        rejectedGeneratedNodeIds.add(id);
        return false;
      }

      installCompileTimePortSpecialization(definition);
      installCustomCSharpSyntaxContract(definition);
      enrichDefinitionAssemblyReferences(
        definition
      );

      const verification =
        createApiVerificationContract(
          id,
          definition
        );

      if (!verification.ok) {
        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${catalogDefinitionDisplayName(definition, id)}' was rejected: ${verification.errors.join("; ")}`
        );
        return false;
      }

      definition.scannerCatalogGenerated = true;
      definition.apiDefinitionSource =
        "scanner-catalog";

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
          for (const stableId of
            stableContractAliasValues(
              existingContract
                ?.stableContractId,
              existingContract
                ?.stableContractIds
            )) {
            rememberCatalogProjectionOperator(
              projectionOperatorsByStableContractId,
              stableId,
              id
            );
          }
          generatedNodeIds.add(id);
          return true;
        }

        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${catalogDefinitionDisplayName(definition, id)}' represents two different contracts or collides with a non-catalog graph node.`
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

      const registered =
        registerNode(id, definition);
      if (registered === false) {
        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${catalogDefinitionDisplayName(definition, id)}' was rejected by the central graph registry.`
        );
        return false;
      }
      for (const stableId of
        stableContractAliasValues(
          verification.contract
            ?.stableContractId,
          verification.contract
            ?.stableContractIds
        )) {
        rememberCatalogProjectionOperator(
          projectionOperatorsByStableContractId,
          stableId,
          id
        );
      }
      generatedNodeIds.add(id);
      return true;
    }

    function genericBindingParameterKey(
      prefix,
      position
    ) {
      const normalized = String(prefix || "generic");
      return `api${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}${Math.max(0, Number(position) || 0)}`;
    }

    function normalizedGenericParameterRows(
      values
    ) {
      return (Array.isArray(values) ? values : [])
        .map((value, index) => ({
          ...(
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
              ? value
              : {}
          ),
          name: String(
            value?.name || value || ""
          ).trim(),
          position: Math.max(
            0,
            Number(value?.position) || index
          )
        }))
        .filter(value => value.name);
    }

    function genericBindingType(
      node,
      prefix,
      position
    ) {
      const portId = `${prefix}${Math.max(0, Number(position) || 0)}`;
      const parameterKey =
        genericBindingParameterKey(
          prefix,
          position
        );
      const raw =
        node?.parameters?.[parameterKey] ??
        node?.apiContract?.genericBindings?.[portId] ??
        "";
      const text = String(raw || "").trim();
      if (!text) return "";
      const registered =
        getTypeInformation(text);
      const csType = normalizeCsType(
        registered?.csType || text
      );
      return (
        csType &&
        !isGenericParameterName(csType) &&
        !isOpenTypeExpression(csType) &&
        canDirectlyReferenceType(csType)
      )
        ? csType
        : "";
    }

    function genericBindingRowsForDefinition(
      definition
    ) {
      return [
        ...normalizedGenericParameterRows(
          definition?.apiOwnerGenericParameters
        ).map(value => ({
          ...value,
          prefix: "ownerGeneric"
        })),
        ...normalizedGenericParameterRows(
          definition?.apiMethodGenericParameters ||
          definition?.apiTypeGenericParameters
        ).map(value => ({
          ...value,
          prefix: "generic"
        }))
      ];
    }

    function genericBindingSatisfiesConstraints(
      row,
      selected,
      substitutions
    ) {
      const selectedGraph =
        graphTypeFor(selected);
      const selectedInformation =
        getTypeInformation(selectedGraph);
      const selectedRow =
        catalogRowForType(selected);
      const referenceType =
        selectedInformation
          ?.referenceType === true;
      if (
        row?.referenceTypeConstraint === true &&
        !referenceType
      ) {
        return false;
      }
      if (
        row?.valueTypeConstraint === true &&
        referenceType
      ) {
        return false;
      }
      if (
        row?.defaultConstructorConstraint === true &&
        referenceType &&
        selectedRow?.isAbstract === true
      ) {
        return false;
      }
      for (const template of
        Array.isArray(row?.constraints)
          ? row.constraints
          : []) {
        const constraint =
          substituteGenericTypeParameters(
            template,
            substitutions
          );
        if (
          !constraint ||
          isOpenTypeExpression(constraint) ||
          isGenericParameterName(constraint)
        ) {
          return false;
        }
        if (
          portableCsTypesEqual(
            selected,
            constraint
          )
        ) {
          continue;
        }
        const constraintGraph =
          graphTypeFor(constraint);
        if (
          !constraintGraph ||
          !Array.isArray(
            selectedInformation?.assignableTo
          ) ||
          !selectedInformation.assignableTo
            .includes(constraintGraph)
        ) {
          return false;
        }
      }
      return true;
    }

    function apiDefinitionSpecialization(
      definition,
      node
    ) {
      const rows =
        genericBindingRowsForDefinition(
          definition
        );
      if (rows.length === 0) {
        return null;
      }
      const ownerSubstitutions = new Map();
      const methodSubstitutions = new Map();
      const genericBindings = {};
      for (const row of rows) {
        const selected = genericBindingType(
          node,
          row.prefix,
          row.position
        );
        if (!selected) return null;
        genericBindings[
          `${row.prefix}${row.position}`
        ] = selected;
        (
          row.prefix === "ownerGeneric"
            ? ownerSubstitutions
            : methodSubstitutions
        ).set(row.name, selected);
      }
      const substitutions =
        mergeGenericSubstitutions(
          ownerSubstitutions,
          methodSubstitutions
        );
      for (const row of rows) {
        const selected = genericBindings[
          `${row.prefix}${row.position}`
        ];
        if (
          !genericBindingSatisfiesConstraints(
            row,
            selected,
            substitutions
          )
        ) {
          return null;
        }
      }
      const ownerType =
        substituteGenericTypeParameters(
          definition.catalogType || "System.Object",
          definition.apiMemberKind === "type"
            ? substitutions
            : ownerSubstitutions
        );
      const returnType =
        substituteGenericTypeParameters(
          definition.apiReturnType || "System.Void",
          substitutions
        );
      const parameters = (
        Array.isArray(definition.apiParameters)
          ? definition.apiParameters
          : []
      ).map(parameter =>
        substituteCatalogParameter(
          parameter,
          substitutions
        )
      );
      const references = new Map();
      for (const reference of [
        ...(Array.isArray(
          definition.requiredAssemblyReferences
        )
          ? definition.requiredAssemblyReferences
          : []),
        ...[
          ...Object.values(genericBindings),
          ownerType,
          returnType,
          ...parameters.flatMap(parameter => [
            parameter?.type,
            parameter?.elementType
          ])
        ].flatMap(type =>
          assemblyReferencesForCsType(
            normalizeCsType(type || ""),
            catalogRowForType(type || "")
          )
        )
      ]) {
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
            ).trim(),
            private:
              reference?.private === true
          }
        );
      }
      return Object.freeze({
        ownerType,
        returnType,
        parameters: Object.freeze(parameters),
        substitutions,
        ownerSubstitutions,
        methodSubstitutions,
        genericBindings: Object.freeze(
          genericBindings
        ),
        requiredAssemblyReferences:
          Object.freeze([
            ...references.values()
          ].map(reference =>
            Object.freeze(reference)
          ))
      });
    }

    function specializedApiPortCsType(
      definition,
      specialization,
      direction,
      specification
    ) {
      const id = String(
        specification?.id || ""
      );
      if (
        specification?.type === "impulse" ||
        ["success", "exception"].includes(id) ||
        /^ownerGeneric\d+$/.test(id) ||
        /^generic\d+$/.test(id)
      ) {
        return "";
      }
      if (
        direction === "input" &&
        id === "target"
      ) {
        return specialization.ownerType;
      }
      if (
        direction === "output" &&
        (
          id === "result" ||
          id === "value"
        )
      ) {
        return definition.apiMemberKind ===
          "constructor"
          ? specialization.ownerType
          : specialization.returnType;
      }
      const match = /^(?:arg|out)(\d+)$/.exec(id);
      if (match) {
        const position = Number(match[1]);
        const parameter =
          specialization.parameters.find(
            (value, index) =>
              Math.max(
                0,
                Number(value?.position) || index
              ) === position
          );
        return normalizeCsType(
          parameter?.elementType ||
          parameter?.type ||
          ""
        );
      }
      if (
        direction === "input" &&
        id === "value" &&
        ["property-set", "field-set"].includes(
          String(definition.apiMemberKind || "")
        )
      ) {
        const parameter =
          specialization.parameters.at(-1);
        return normalizeCsType(
          parameter?.elementType ||
          parameter?.type ||
          ""
        );
      }
      return String(
        specification?.apiCsType || ""
      );
    }

    function specializedApiPorts(
      definition,
      specialization,
      direction
    ) {
      const source =
        direction === "input"
          ? definition.inputs
          : definition.outputs;
      return (Array.isArray(source) ? source : [])
        .map(specification => {
          const csType =
            specializedApiPortCsType(
              definition,
              specialization,
              direction,
              specification
            );
          if (!csType) {
            return { ...specification };
          }
          const graphType = graphTypeFor(csType);
          return {
            ...specification,
            type: graphType ||
              specification.type ||
              "object",
            apiCsType: csType
          };
        });
    }

    function installCompileTimePortSpecialization(
      definition
    ) {
      if (
        definition?.compileTimeSpecializable !== true
      ) {
        return definition;
      }
      const rows =
        genericBindingRowsForDefinition(
          definition
        );
      if (rows.length === 0) {
        return definition;
      }

      const existingParameters =
        Array.isArray(definition.parameters)
          ? definition.parameters
          : [];
      const existingKeys = new Set(
        existingParameters.map(value =>
          String(value?.key || "")
        )
      );
      definition.parameters = [
        ...existingParameters,
        ...rows
          .filter(row =>
            !existingKeys.has(
              genericBindingParameterKey(
                row.prefix,
                row.position
              )
            )
          )
          .map(row => ({
            key: genericBindingParameterKey(
              row.prefix,
              row.position
            ),
            label: apiFormat(
              "api.catalog.parameter.compile_time_type",
              "Compile-time type {name}",
              { name: row.name }
            ),
            kind: "text",
            default: "",
            help: apiFormat(
              "api.catalog.parameter.compile_time_type_help",
              "Exact closed C# type for {name}. This makes generic result, argument, ref and out ports concrete and portable without reflection.",
              { name: row.name }
            ),
            affectsPorts: true,
            affectsNode: true,
            commitImmediately: true,
            monospace: true,
            spellcheck: false
          }))
      ];
      definition.inputs = (
        Array.isArray(definition.inputs)
          ? definition.inputs
          : []
      ).map(specification =>
        /^ownerGeneric\d+$/.test(
          String(specification?.id || "")
        ) ||
        /^generic\d+$/.test(
          String(specification?.id || "")
        )
          ? {
              ...specification,
              optional: true
            }
          : specification
      );
      definition.apiGenericBindingParameters =
        Object.freeze(
          rows.map(row => Object.freeze({
            prefix: row.prefix,
            name: row.name,
            position: row.position,
            portId:
              `${row.prefix}${row.position}`,
            parameterKey:
              genericBindingParameterKey(
                row.prefix,
                row.position
              )
          }))
        );
      definition.resolveApiSpecialization =
        node =>
          apiDefinitionSpecialization(
            definition,
            node
          );
      definition.resolveDefinition = node => {
        const specialization =
          apiDefinitionSpecialization(
            definition,
            node
          );
        if (!specialization) return {};
        return {
          inputs: specializedApiPorts(
            definition,
            specialization,
            "input"
          ),
          outputs: specializedApiPorts(
            definition,
            specialization,
            "output"
          ),
          apiResolvedSpecialization:
            specialization
        };
      };
      return definition;
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
      const semanticContract = {
        ownerType,
        kind,
        memberName: String(
          definition?.catalogMember || ""
        ),
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
        hookVisibility:
          kind === "hook-method"
            ? String(
                definition?.apiHookVisibility ||
                ""
              )
            : ""
      };
      const stableContractIds =
        stableContractAliasValues(
          definition?.apiStableContractId,
          definition?.apiStableContractIds,
          stableContractId(semanticContract)
        );

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
              `${direction} port '${portId || "<unnamed>"}' uses an unregistered graph type`
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
        ownerGenericParameters:
          Object.freeze(
            normalizedGenericParameterRows(
              definition?.apiOwnerGenericParameters
            ).map(value => Object.freeze(
              portableGenericParameterContract(
                value
              )
            ))
          ),
        methodGenericParameters:
          Object.freeze(
            normalizedGenericParameterRows(
              definition?.apiMethodGenericParameters ||
              definition?.apiTypeGenericParameters
            ).map(value => Object.freeze(
              portableGenericParameterContract(
                value
              )
            ))
          ),
        hookVisibility:
          kind === "hook-method"
            ? String(
                definition?.apiHookVisibility ||
                ""
              )
            : "",
        runtimeBound:
          definition?.runtimeBound === true,
        requiredAssemblyReferences:
          Object.freeze(
            normalizedPortableAssemblyReferences(
              definition
                ?.requiredAssemblyReferences
            ).map(reference =>
              Object.freeze(reference)
            )
          ),
        baseAssemblyReferences:
          Object.freeze(
            normalizedPortableAssemblyReferences(
              definition
                ?.requiredAssemblyReferences
            ).map(reference =>
              Object.freeze(reference)
            )
          ),
        enumValues:
          Object.freeze(
            normalizedPortableEnumValues(
              definition?.apiEnumValues
            )
          ),
        enumDefaultValue: String(
          definition?.apiEnumDefaultValue || ""
        ),
        enumUnderlyingType:
          catalogExactType(
            definition
              ?.apiEnumUnderlyingType || ""
          ),
        enumIsFlags:
          definition?.apiEnumIsFlags === true,
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
          stableContractIds[0] || "",
        stableContractIds:
          Object.freeze(
            [...stableContractIds]
          ),
        ...(kind === "event"
          ? {
              eventOperationStableContractIds:
                Object.freeze({
                  event:
                    stableContractIds[0] || "",
                  add: String(
                    definition
                      ?.apiEventAddStableContractId ||
                    ""
                  ).trim(),
                  remove: String(
                    definition
                      ?.apiEventRemoveStableContractId ||
                    ""
                  ).trim()
                })
            }
          : {}),
        inputPorts: Object.freeze(inputs.map(specification => ({
          id: String(specification?.id || ""),
          type: String(specification?.type || "object"),
          csType: String(
            specification?.apiCsType ||
            portableContractPortCsType(
              {
                kind,
                ownerType,
                returnType:
                  catalogExactType(
                    definition?.apiReturnType ||
                    "System.Void"
                  ),
                parameters
              },
              "input",
              specification
            ) ||
            ""
          ),
          typeVar: String(specification?.typeVar || ""),
          optional: specification?.optional === true,
          role: portablePortRole(kind, "input", specification, parameters)
        }))),
        outputPorts: Object.freeze(outputs.map(specification => ({
          id: String(specification?.id || ""),
          type: String(specification?.type || "object"),
          csType: String(
            specification?.apiCsType ||
            portableContractPortCsType(
              {
                kind,
                ownerType,
                returnType:
                  catalogExactType(
                    definition?.apiReturnType ||
                    "System.Void"
                  ),
                parameters
              },
              "output",
              specification
            ) ||
            ""
          ),
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
        name: String(
          parameter?.name ||
          `argument${Math.max(
            0,
            Number(parameter?.position) || 0
          )}`
        ),
        type: catalogExactType(
          parameter?.elementType ||
          parameter?.type ||
          "System.Object"
        ),
        isByRef:
          parameter?.isByRef === true ||
          parameter?.isOut === true,
        isIn:
          parameter?.isIn === true,
        isOut:
          parameter?.isOut === true,
        isOptional:
          parameter?.isOptional === true,
        hasDefaultValue:
          parameter?.hasDefaultValue === true,
        defaultValueCSharp: String(
          parameter?.defaultValueCSharp || ""
        )
      });
    }

    function substituteCatalogParameter(
      parameter,
      substitutions
    ) {
      if (!parameter || typeof parameter !== "object") {
        return parameter;
      }
      const result = { ...parameter };
      for (const key of [
        "type",
        "elementType"
      ]) {
        if (result[key]) {
          result[key] =
            substituteGenericTypeParameters(
              result[key],
              substitutions
            );
        }
      }
      return result;
    }

    function inheritedStableContractId(
      sourceStableContractId,
      contract
    ) {
      const semantic =
        exactApiSemanticContractKey(contract);
      if (!semantic) return "";
      return `contract.inherited.${stableHash(
        JSON.stringify({
          version: 1,
          sourceStableContractId: String(
            sourceStableContractId || ""
          ),
          semantic
        })
      )}`;
    }

    function projectInheritedCatalogMember(
      member,
      kind,
      substitutions,
      declaringType,
      projectedOwnerType
    ) {
      const effectiveSubstitutions =
        new Map(substitutions);
      if (kind === "methods") {
        for (const generic of
          Array.isArray(member.genericParameters)
            ? member.genericParameters
            : []) {
          effectiveSubstitutions.delete(
            String(generic?.name || "")
          );
        }
      }

      const projected = {
        ...member,
        signature: "",
        stableContractId: "",
        stableContractIds: [],
        contractId: "",
        readStableContractId: "",
        readStableContractIds: [],
        writeStableContractId: "",
        writeStableContractIds: [],
        readContractId: "",
        writeContractId: "",
        declaringType,
        apiInheritedProjection: true,
        inheritedFrom:
          normalizeCsType(
            member.declaringType ||
            declaringType
          )
      };
      if (member.returnType) {
        projected.returnType =
          substituteGenericTypeParameters(
            member.returnType,
            effectiveSubstitutions
          );
      }
      if (member.type) {
        projected.type =
          substituteGenericTypeParameters(
            member.type,
            effectiveSubstitutions
          );
      }
      if (Array.isArray(member.parameters)) {
        projected.parameters =
          member.parameters.map(parameter =>
            substituteCatalogParameter(
              parameter,
              effectiveSubstitutions
            )
          );
      }
      if (Array.isArray(member.indexParameters)) {
        projected.indexParameters =
          member.indexParameters.map(parameter =>
            substituteCatalogParameter(
              parameter,
              effectiveSubstitutions
            )
          );
      }
      if (
        kind === "methods" &&
        Array.isArray(member.genericParameters)
      ) {
        projected.genericParameters =
          member.genericParameters.map(
            (generic, index) => ({
              ...generic,
              name: String(
                generic?.name || `T${index}`
              ),
              position: Math.max(
                0,
                Number(generic?.position) || index
              ),
              constraints: (
                Array.isArray(
                  generic?.constraints
                )
                  ? generic.constraints
                  : []
              ).map(constraint =>
                substituteGenericTypeParameters(
                  constraint,
                  effectiveSubstitutions
                )
              )
            })
          );
      }

      const ownerType = normalizeCsType(
        projectedOwnerType || declaringType
      );
      const sourceOwnerType = normalizeCsType(
        member.declaringType ||
        declaringType
      );
      const genericArity = Array.isArray(
        projected.genericParameters
      )
        ? projected.genericParameters.length
        : 0;
      const identity = (
        memberKind,
        parameters,
        returnType
      ) => ({
        ownerType,
        kind: memberKind,
        memberName: String(
          projected.name || ""
        ),
        parameters,
        returnType,
        isStatic:
          projected.isStatic === true,
        genericArity
      });
      const sourceIdentity = (
        memberKind,
        parameters,
        returnType
      ) => ({
        ownerType: sourceOwnerType,
        kind: memberKind,
        memberName: String(
          member.name || ""
        ),
        parameters,
        returnType,
        isStatic:
          member.isStatic === true,
        genericArity:
          Array.isArray(
            member.genericParameters
          )
            ? member.genericParameters.length
            : 0
      });
      const inheritedAliases = (
        canonical,
        legacy,
        additional,
        sourceContract,
        projectedContract
      ) => {
        const source =
          stableContractAliasRecord(
            canonical,
            legacy,
            sourceContract,
            additional
          );
        const aliases =
          stableContractAliasValues(
            source.aliases.map(value =>
              inheritedStableContractId(
                value,
                projectedContract
              )
            )
          );
        return {
          primary:
            inheritedStableContractId(
              source.primary,
              projectedContract
            ),
          legacy:
            inheritedStableContractId(
              source.legacy,
              projectedContract
            ),
          aliases
        };
      };

      if (kind === "methods") {
        const projectedContract = identity(
          "method",
          projected.parameters || [],
          projected.returnType ||
            "System.Void"
        );
        const aliases = inheritedAliases(
          member.stableContractId,
          member.contractId,
          [
            member.stableContractIds,
            member.contractIds
          ],
          sourceIdentity(
            "method",
            member.parameters || [],
            member.returnType ||
              "System.Void"
          ),
          projectedContract
        );
        projected.stableContractId =
          aliases.primary;
        projected.contractId =
          aliases.legacy;
        projected.stableContractIds =
          aliases.aliases;
      } else if (kind === "properties") {
        const indexes =
          projected.indexParameters || [];
        const sourceIndexes =
          member.indexParameters || [];
        const projectedRead = identity(
          "property-get",
          indexes,
          projected.type ||
            "System.Object"
        );
        const readAliases = inheritedAliases(
          member.readStableContractId,
          member.readContractId,
          [
            member.readStableContractIds,
            member.readContractIds
          ],
          sourceIdentity(
            "property-get",
            sourceIndexes,
            member.type ||
              "System.Object"
          ),
          projectedRead
        );
        projected.readStableContractId =
          readAliases.primary;
        projected.readContractId =
          readAliases.legacy;
        projected.readStableContractIds =
          readAliases.aliases;
        const projectedWriteParameters = [
          ...indexes,
          {
            position: indexes.length,
            type:
              projected.type ||
              "System.Object",
            isByRef: false,
            isIn: false,
            isOut: false,
            isOptional: false
          }
        ];
        const sourceWriteParameters = [
          ...sourceIndexes,
          {
            position: sourceIndexes.length,
            type:
              member.type ||
              "System.Object",
            isByRef: false,
            isIn: false,
            isOut: false,
            isOptional: false
          }
        ];
        const writeAliases = inheritedAliases(
          member.writeStableContractId,
          member.writeContractId,
          [
            member.writeStableContractIds,
            member.writeContractIds
          ],
          sourceIdentity(
            "property-set",
            sourceWriteParameters,
            "System.Void"
          ),
          identity(
            "property-set",
            projectedWriteParameters,
            "System.Void"
          )
        );
        projected.writeStableContractId =
          writeAliases.primary;
        projected.writeContractId =
          writeAliases.legacy;
        projected.writeStableContractIds =
          writeAliases.aliases;
      } else if (kind === "fields") {
        const readAliases = inheritedAliases(
          member.readStableContractId,
          member.readContractId,
          [
            member.readStableContractIds,
            member.readContractIds
          ],
          sourceIdentity(
            "field-get",
            [],
            member.type ||
              "System.Object"
          ),
          identity(
            "field-get",
            [],
            projected.type ||
              "System.Object"
          )
        );
        projected.readStableContractId =
          readAliases.primary;
        projected.readContractId =
          readAliases.legacy;
        projected.readStableContractIds =
          readAliases.aliases;
        const projectedWriteParameters = [{
          position: 0,
          type:
            projected.type ||
            "System.Object",
          isByRef: false,
          isIn: false,
          isOut: false,
          isOptional: false
        }];
        const sourceWriteParameters = [{
          position: 0,
          type:
            member.type ||
            "System.Object",
          isByRef: false,
          isIn: false,
          isOut: false,
          isOptional: false
        }];
        const writeAliases = inheritedAliases(
          member.writeStableContractId,
          member.writeContractId,
          [
            member.writeStableContractIds,
            member.writeContractIds
          ],
          sourceIdentity(
            "field-set",
            sourceWriteParameters,
            "System.Void"
          ),
          identity(
            "field-set",
            projectedWriteParameters,
            "System.Void"
          )
        );
        projected.writeStableContractId =
          writeAliases.primary;
        projected.writeContractId =
          writeAliases.legacy;
        projected.writeStableContractIds =
          writeAliases.aliases;
      }
      return projected;
    }

    function inheritedCatalogMemberKey(
      member,
      kind
    ) {
      if (kind === "methods") {
        return JSON.stringify({
          name: String(member?.name || ""),
          isStatic: member?.isStatic === true,
          genericArity:
            Array.isArray(
              member?.genericParameters
            )
              ? member.genericParameters.length
              : 0,
          parameters:
            (Array.isArray(member?.parameters)
              ? member.parameters
              : []).map(parameter => ({
                type: normalizeCsType(
                  parameter?.elementType ||
                  parameter?.type ||
                  "System.Object"
                ),
                isByRef:
                  parameter?.isByRef === true ||
                  parameter?.isOut === true,
                isOut:
                  parameter?.isOut === true
              }))
        });
      }
      if (kind === "properties") {
        return JSON.stringify({
          name: String(member?.name || ""),
          isStatic: member?.isStatic === true,
          indexes:
            (Array.isArray(
              member?.indexParameters
            )
              ? member.indexParameters
              : []).map(parameter =>
                normalizeCsType(
                  parameter?.elementType ||
                  parameter?.type ||
                  "System.Object"
                )
              )
        });
      }
      return JSON.stringify({
        name: String(member?.name || ""),
        isStatic: member?.isStatic === true
      });
    }

    function catalogMembersForOwner(
      owner,
      kind
    ) {
      const declared = Array.isArray(owner?.[kind])
        ? owner[kind]
        : [];
      const ownerCs = normalizeCsType(
        owner?.fullName
      );
      const genericFamily = Boolean(
        owner?.isGeneric === true ||
        ownerCs.includes("<") ||
        [
          owner?.baseType,
          ...(Array.isArray(owner?.interfaces)
            ? owner.interfaces
            : [])
        ].some(type =>
          normalizeCsType(type).includes("<")
        )
      );
      const completeDemandOwner =
        demandCompleteOwnerNames.has(ownerCs);
      if (
        !genericFamily &&
        !completeDemandOwner
      ) {
        return declared;
      }

      const result = [...declared];
      const keys = new Set(
        declared.map(member =>
          inheritedCatalogMemberKey(
            member,
            kind
          )
        )
      );
      const queue = [owner?.baseType]
        .filter(Boolean)
        .map(normalizeCsType);
      const visited = new Set();

      while (queue.length > 0) {
        const actualType = normalizeCsType(
          queue.shift()
        );
        if (!actualType || visited.has(actualType)) {
          continue;
        }
        visited.add(actualType);
        const row = catalogRowForType(actualType);
        if (!row) continue;
        const substitutions =
          genericTypeSubstitutions(
            row.fullName,
            actualType
          );

        for (const member of
          Array.isArray(row[kind])
            ? row[kind]
            : []) {
          if (!member || typeof member !== "object") {
            continue;
          }
          const projected =
            projectInheritedCatalogMember(
              member,
              kind,
              substitutions,
              actualType,
              ownerCs
            );
          const key = inheritedCatalogMemberKey(
            projected,
            kind
          );
          if (keys.has(key)) continue;
          keys.add(key);
          result.push(projected);
        }

        for (const next of [row.baseType]) {
          if (!next) continue;
          queue.push(
            substituteGenericTypeParameters(
              next,
              substitutions
            )
          );
        }
      }

      return result;
    }

    function createConstructorDefinition(owner, constructor) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const ownerGenerics =
        ownerGenericParameters(ownerCs, owner);
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
        canDirectlyReferenceType(ownerCs) &&
        parameters.every(canDirectlyPassParameter);
      const inputs = [port("call", API_PORT_LABELS.call, "impulse")];
      inputs.push(
        ...genericTypeInputPorts(
          ownerGenerics,
          "ownerGeneric"
        )
      );
      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }
      const outParameters = parameters.filter(parameter =>
        parameter.isOut ||
        (
          parameter.isByRef &&
          parameter.isIn !== true
        )
      );
      const outputs = [
        port("done", API_PORT_LABELS.done, "impulse"),
        port("result", displayTypeName(owner), direct ? ownerGraph : "object")
      ];
      for (const parameter of outParameters) {
        outputs.push(port(
          `out${parameter.position}`,
          parameter.name || apiFormat(
            "api.catalog.port.argument_short",
            "Arg {index}",
            { index: parameter.position }
          ),
          direct
            ? graphTypeFor(parameter.elementType || parameter.type)
            : "object"
        ));
      }
      outputs.push(
        port("success", API_PORT_LABELS.success, "bool"),
        port("exception", API_PORT_LABELS.exception, "exception")
      );

      return withReloadContract({
        title: apiFormat(
          "api.catalog.title.constructor",
          "New · {type}",
          { type: displayTypeName(owner) }
        ),
        group: groupForType(owner, API_GROUPS.constructors),
        symbol: "new",
        description: constructor.signature || apiFormat(
          "api.catalog.description.constructor",
          "Constructs {type}.",
          { type: ownerCs }
        ),
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        apiStableContractId:
          String(constructor.stableContractId || ""),
        apiStableContractIds:
          stableContractAliasValues(
            constructor.stableContractId,
            constructor.stableContractIds,
            constructor.contractId,
            constructor.contractIds
          ),
        apiMemberKind: "constructor",
        apiSignature:
          constructor.signature ||
          `${ownerCs}(${parameters.map(apiParameterSignature).join(",")})`,
        apiParameters: parameters,
        apiReturnType: ownerCs,
        apiIsStatic: false,
        apiGenericArity: 0,
        apiOwnerGenericParameters:
          ownerGenerics,
        compileTimeSpecializable:
          ownerGenerics.length > 0,
        apiSearchText: `${ownerCs} ${constructor.signature || "constructor new"}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          const specialization =
            ownerSpecialization(
              api,
              ownerCs
            );
          const compileTimeDirect = Boolean(
            specialization &&
            !owner.isAbstract &&
            !owner.isInterface &&
            canDirectlyReferenceType(
              specialization.type
            ) &&
            parameters.every(parameter =>
              canDirectlyPassParameter(
                parameter,
                specialization.substitutions
              )
            )
          );
          collectActionFields(api, {
            resultCs: compileTimeDirect
              ? specialization.type
              : "object",
            resultGraph: direct ? ownerGraph : "object",
            outParameters,
            direct: compileTimeDirect,
            substitutions:
              specialization?.substitutions ||
              new Map()
          });
          if (!compileTimeDirect) {
            ensureApiReflectionRuntime(api);
            collectReflectiveSignatureFields(
              api,
              parameters
            );
          }
        },
        codegenAction(api) {
          const specialization =
            ownerSpecialization(
              api,
              ownerCs
            );
          const compileTimeDirect = Boolean(
            specialization &&
            !owner.isAbstract &&
            !owner.isInterface &&
            canDirectlyReferenceType(
              specialization.type
            ) &&
            parameters.every(parameter =>
              canDirectlyPassParameter(
                parameter,
                specialization.substitutions
              )
            )
          );
          const action = compileTimeDirect
            ? directConstructorAction(
                api,
                specialization.type,
                parameters,
                specialization.substitutions
              )
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
      const ownerGenerics =
        ownerGenericParameters(ownerCs, owner);
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
      const inputs = [port("call", API_PORT_LABELS.call, "impulse")];

      inputs.push(
        ...genericTypeInputPorts(
          ownerGenerics,
          "ownerGeneric"
        )
      );

      if (!method.isStatic) {
        inputs.push(port("target", API_PORT_LABELS.target, ownerGraph));
      }

      if (method.isGenericMethodDefinition) {
        inputs.push(
          ...genericTypeInputPorts(
            genericParameters,
            "generic"
          )
        );
      }

      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }

      const outParameters = parameters.filter(parameter =>
        parameter.isOut ||
        (
          parameter.isByRef &&
          parameter.isIn !== true
        )
      );
      const outputs = [port("done", API_PORT_LABELS.done, "impulse")];
      if (!isVoid) {
        outputs.push(port("result", API_PORT_LABELS.result, resultGraph || "object"));
      }
      for (const parameter of outParameters) {
        outputs.push(port(
          `out${parameter.position}`,
          parameter.name || apiFormat(
            "api.catalog.port.argument_short",
            "Arg {index}",
            { index: parameter.position }
          ),
          direct
            ? graphTypeFor(parameter.elementType || parameter.type)
            : "object"
        ));
      }
      outputs.push(
        port("success", API_PORT_LABELS.success, "bool"),
        port("exception", API_PORT_LABELS.exception, "exception")
      );

      const noisy = isNoisyType(owner) || !direct;
      const group = noisy ? ADVANCED_GROUP : API_GROUPS.methods;

      return withReloadContract({
        title: apiFormat(
          method.isStatic
            ? "api.catalog.title.static_method"
            : "api.catalog.title.method_call",
          method.isStatic
            ? "Static · {type}.{member}"
            : "Call · {type}.{member}",
          {
            type: displayTypeName(owner),
            member: method.name
          }
        ),
        group,
        symbol: "ƒ",
        description: method.signature || `${ownerCs}.${method.name}`,
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: method.name,
        apiInheritedProjection:
          method.apiInheritedProjection === true,
        apiInheritedFrom:
          String(method.inheritedFrom || ""),
        apiStableContractId:
          String(method.stableContractId || ""),
        apiStableContractIds:
          stableContractAliasValues(
            method.stableContractId,
            method.stableContractIds,
            method.contractId,
            method.contractIds
          ),
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
        apiMethodGenericParameters:
          genericParameters,
        apiOwnerGenericParameters:
          ownerGenerics,
        compileTimeSpecializable:
          ownerGenerics.length > 0 ||
          genericParameters.length > 0,
        apiSearchText: `${ownerCs} ${method.name} ${method.signature || ""}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          const specialization =
            methodSpecialization(
              api,
              ownerCs,
              method,
              parameters
            );
          const compileTimeDirect =
            Boolean(specialization);
          const specializedResultCs =
            specialization && !isVoid
              ? substituteGenericTypeParameters(
                  returnCs,
                  specialization.substitutions
                )
              : resultCs;
          collectActionFields(api, {
            resultCs: compileTimeDirect
              ? specializedResultCs
              : resultCs,
            resultGraph,
            isVoid,
            outParameters,
            direct: compileTimeDirect,
            substitutions:
              specialization?.substitutions ||
              new Map()
          });
          if (!compileTimeDirect) {
            ensureApiReflectionRuntime(api);
            collectReflectiveSignatureFields(
              api,
              parameters
            );
          }
        },
        codegenAction(api) {
          const specialization =
            methodSpecialization(
              api,
              ownerCs,
              method,
              parameters
            );
          const action = specialization
            ? directMethodAction(
                api,
                specialization.ownerType,
                method,
                parameters,
                isVoid,
                specialization
              )
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

    function createHookMethodDefinition(
      owner,
      method,
      template
    ) {
      if (
        !template ||
        !method ||
        !method.name ||
        method.isHookable === false
      ) {
        return null;
      }
      const ownerCs = normalizeCsType(
        owner.fullName ||
        method.declaringType
      );
      const parameters = Array.isArray(
        method.parameters
      ) ? method.parameters : [];
      const returnCs = normalizeCsType(
        method.returnType || "System.Void"
      );
      if (
        !ownerCs ||
        ownerGenericParameters(ownerCs).length > 0 ||
        parameters.some(parameter =>
          !isSupportedApiParameter(parameter) ||
          parameter?.isByRef === true ||
          parameter?.isOut === true
        ) ||
        !isSupportedApiReturnType(returnCs)
      ) {
        return null;
      }
      const stableHookContract = String(
        method.stableContractId ||
        (
          method.id
            ? `contract.hook.method.${method.id}`
            : ""
        )
      );
      if (!stableHookContract) return null;

      const visibility = String(
        method.visibility || "public"
      );
      const fixedMethod = Object.freeze({
        id: String(method.id || ""),
        stableContractId:
          stableHookContract,
        name: String(method.name),
        declaringType: ownerCs,
        signature: String(
          method.signature ||
          `${method.name}(${parameters.map(apiParameterSignature).join(",")}) : ${returnCs}`
        ),
        returnType: returnCs,
        returnTypeIsValueType:
          method.returnTypeIsValueType === true,
        isStatic:
          method.isStatic === true,
        visibility,
        parameters: Object.freeze(
          parameters.map(parameter =>
            Object.freeze({ ...parameter })
          )
        ),
        attributes: Object.freeze([
          ...(Array.isArray(method.attributes)
            ? method.attributes
            : [])
        ])
      });
      const outputs = [
        port(
          "called",
          API_PORT_LABELS.called,
          "impulse"
        )
      ];
      if (fixedMethod.isStatic !== true) {
        outputs.push(
          port(
            "instance",
            API_PORT_LABELS.instance,
            graphTypeFor(ownerCs)
          )
        );
      }
      fixedMethod.parameters.forEach(
        (parameter, index) => {
          outputs.push(
            port(
              `argument${index}`,
              parameter.name ||
                apiFormat(
                  "api.catalog.port.argument",
                  "Argument {index}",
                  { index: index + 1 }
                ),
              graphTypeFor(
                parameter.elementType ||
                parameter.type ||
                "System.Object"
              )
            )
          );
        }
      );
      if (
        returnCs !== "System.Void" &&
        returnCs !== "void"
      ) {
        outputs.push(
          port(
            "result",
            API_PORT_LABELS.result,
            graphTypeFor(returnCs)
          )
        );
      }

      const definition = {
        ...template,
        title: apiFormat(
          "api.catalog.title.hook",
          "Hook · {name}",
          {
            name:
              `${displayTypeName(owner)}.${fixedMethod.name}`
          }
        ),
        group: API_GROUPS.hooks,
        symbol: "H<T>",
        description:
          fixedMethod.signature,
        hiddenFromPalette: false,
        expertOnly: false,
        inputs: [],
        outputs,
        parameters:
          (Array.isArray(template.parameters)
            ? template.parameters
            : []).filter(parameter =>
              parameter?.key !==
                "hookContract"
            ).map(parameter => ({
              ...parameter
            })),
        catalogGenerated: true,
        customCSharpCatalogNode: false,
        catalogType: ownerCs,
        catalogMember:
          fixedMethod.name,
        apiStableContractId:
          stableHookContract,
        apiMemberKind: "hook-method",
        apiSignature:
          fixedMethod.signature,
        apiParameters:
          fixedMethod.parameters,
        apiReturnType: returnCs,
        apiIsStatic:
          fixedMethod.isStatic,
        apiGenericArity: 0,
        apiHookVisibility: visibility,
        apiHookMethod: fixedMethod,
        apiSearchText:
          `${ownerCs} ${fixedMethod.name} ${fixedMethod.signature} Harmony hook ${visibility}`,
        runtimeBound: false,
        apiThreadAffinity:
          normalizeThreadAffinity(
            method,
            owner
          ),
        apiReloadSafety:
          normalizeReloadSafety({
            level: "unsafe",
            confidence: "certain",
            operation: "runtime-patch",
            reasons: [
              "runtime-code-patching"
            ],
            requiredCleanup: [
              "process-restart"
            ],
            retainsCallerObjects: true
          })
      };
      delete definition.resolveDefinition;
      return definition;
    }

    function createPropertyGetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const ownerGenerics =
        ownerGenericParameters(ownerCs, owner);
      const valueCs = normalizeCsType(property.type || "System.Object");
      const valueGraph = ownerGenerics.length > 0
        ? "object"
        : graphTypeFor(valueCs);
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
      const inputs = genericTypeInputPorts(
        ownerGenerics,
        "ownerGeneric"
      );
      if (!property.isStatic) {
        inputs.push(port("target", API_PORT_LABELS.target, ownerGraph));
      }
      for (const parameter of indexes) {
        inputs.push(parameterPort(parameter));
      }

      return withReloadContract({
        title: apiFormat(
          "api.catalog.title.property_get",
          "Get · {type}.{member}",
          {
            type: displayTypeName(owner),
            member: property.name
          }
        ),
        group: groupForType(owner, API_GROUPS.properties),
        symbol: "get",
        description: apiFormat(
          "api.catalog.description.property_get",
          "Reads {type}.{member} ({valueType}).",
          {
            type: ownerCs,
            member: property.name,
            valueType: valueCs
          }
        ),
        inputs,
        outputs: [port("value", API_PORT_LABELS.value, valueGraph)],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: property.name,
        apiInheritedProjection:
          property.apiInheritedProjection === true,
        apiInheritedFrom:
          String(property.inheritedFrom || ""),
        apiStableContractId:
          readStableContractId(property),
        apiStableContractIds:
          stableContractAliasValues(
            property.readStableContractId,
            property.readStableContractIds,
            property.readContractId,
            property.readContractIds
          ),
        apiMemberKind: "property-get",
        apiSignature:
          `${ownerCs}.${property.name}[${indexes.map(apiParameterSignature).join(",")}] -> ${catalogExactType(property.type || valueCs)}`,
        apiParameters: indexes,
        apiReturnType:
          property.type || valueCs,
        apiIsStatic: property.isStatic === true,
        apiGenericArity: 0,
        apiOwnerGenericParameters:
          ownerGenerics,
        compileTimeSpecializable:
          ownerGenerics.length > 0,
        runtimeBound:
          ownerGenerics.length > 0,
        apiSearchText: `${ownerCs} ${property.name} property get read ${valueCs}`,
        codegenExpression(api) {
          const specialization =
            ownerSpecialization(
              api,
              ownerCs
            );
          if (!specialization) {
            return requiredCompileTimeOwnerExpression(
              ownerCs,
              property.name
            );
          }
          const specializedValueCs =
            substituteGenericTypeParameters(
              valueCs,
              specialization.substitutions
            );
          return propertyReadExpression(
            api,
            specialization.type,
            specializedValueCs,
            property,
            indexes,
            specialization.substitutions
          );
        }
      }, owner, property.readReloadSafety, {
        member: property
      });
    }

    function createPropertySetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const ownerGenerics =
        ownerGenericParameters(ownerCs, owner);
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
      const inputs = [port("call", API_PORT_LABELS.call, "impulse")];
      inputs.push(
        ...genericTypeInputPorts(
          ownerGenerics,
          "ownerGeneric"
        )
      );
      if (!property.isStatic) {
        inputs.push(port("target", API_PORT_LABELS.target, ownerGraph));
      }
      for (const parameter of indexes) {
        inputs.push(parameterPort(parameter));
      }
      inputs.push(port(
        "value",
        API_PORT_LABELS.value,
        ownerGenerics.length > 0
          ? "object"
          : graphTypeFor(valueCs)
      ));

      return withReloadContract({
        title: apiFormat(
          "api.catalog.title.property_set",
          "Set · {type}.{member}",
          {
            type: displayTypeName(owner),
            member: property.name
          }
        ),
        group: groupForType(owner, API_GROUPS.properties),
        symbol: "set",
        description: apiFormat(
          "api.catalog.description.property_set",
          "Writes {type}.{member} ({valueType}).",
          {
            type: ownerCs,
            member: property.name,
            valueType: valueCs
          }
        ),
        inputs,
        outputs: [
          port("done", API_PORT_LABELS.done, "impulse"),
          port("success", API_PORT_LABELS.success, "bool"),
          port("exception", API_PORT_LABELS.exception, "exception")
        ],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: property.name,
        apiInheritedProjection:
          property.apiInheritedProjection === true,
        apiInheritedFrom:
          String(property.inheritedFrom || ""),
        apiStableContractId:
          writeStableContractId(property),
        apiStableContractIds:
          stableContractAliasValues(
            property.writeStableContractId,
            property.writeStableContractIds,
            property.writeContractId,
            property.writeContractIds
          ),
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
        apiOwnerGenericParameters:
          ownerGenerics,
        compileTimeSpecializable:
          ownerGenerics.length > 0,
        runtimeBound:
          ownerGenerics.length > 0,
        apiSearchText: `${ownerCs} ${property.name} property set write ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const specialization =
            ownerSpecialization(
              api,
              ownerCs
            );
          if (!specialization) {
            return actionWithDoneImpulse(
              api,
              wrapApiAction(
                api,
                `    throw new System.InvalidOperationException("${escapeString(
                  compileTimeOwnerMessage(
                    ownerCs,
                    property.name
                  )
                )}");`
              )
            );
          }
          const access = propertyAccessExpression(
            api,
            specialization.type,
            property,
            indexes,
            specialization.substitutions
          );
          const value =
            specializedInputExpression(
              api,
              "value",
              valueCs,
              specialization.substitutions
            );
          const action = wrapApiAction(
            api,
            `    ${access} = ${value};`
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
      const ownerGenerics =
        ownerGenericParameters(ownerCs, owner);
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = genericTypeInputPorts(
        ownerGenerics,
        "ownerGeneric"
      );
      if (!field.isStatic) {
        inputs.push(port(
          "target",
          API_PORT_LABELS.target,
          ownerGraph
        ));
      }
      if (
        field.isPublic === false ||
        !isCSharpIdentifier(field.name) ||
        !isSupportedApiReturnType(valueCs)
      ) {
        return null;
      }

      return withReloadContract({
        title: apiFormat(
          "api.catalog.title.field_read",
          "Read · {type}.{member}",
          {
            type: displayTypeName(owner),
            member: field.name
          }
        ),
        group: groupForType(owner, API_GROUPS.fields),
        symbol: "fld",
        description: apiFormat(
          "api.catalog.description.field_read",
          "Reads field {type}.{member} ({valueType}).",
          {
            type: ownerCs,
            member: field.name,
            valueType: valueCs
          }
        ),
        inputs,
        outputs: [port(
          "value",
          API_PORT_LABELS.value,
          ownerGenerics.length > 0
            ? "object"
            : graphTypeFor(valueCs)
        )],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: field.name,
        apiInheritedProjection:
          field.apiInheritedProjection === true,
        apiInheritedFrom:
          String(field.inheritedFrom || ""),
        apiStableContractId:
          readStableContractId(field),
        apiStableContractIds:
          stableContractAliasValues(
            field.readStableContractId,
            field.readStableContractIds,
            field.readContractId,
            field.readContractIds
          ),
        apiMemberKind: "field-get",
        apiSignature:
          `${ownerCs}.${field.name} -> ${catalogExactType(field.type || valueCs)}`,
        apiParameters: [],
        apiReturnType:
          field.type || valueCs,
        apiIsStatic: field.isStatic === true,
        apiGenericArity: 0,
        apiOwnerGenericParameters:
          ownerGenerics,
        compileTimeSpecializable:
          ownerGenerics.length > 0,
        runtimeBound:
          ownerGenerics.length > 0,
        apiSearchText: `${ownerCs} ${field.name} field read get ${valueCs}`,
        codegenExpression(api) {
          const specialization =
            ownerSpecialization(
              api,
              ownerCs
            );
          if (!specialization) {
            return requiredCompileTimeOwnerExpression(
              ownerCs,
              field.name
            );
          }
          const specializedValueCs =
            substituteGenericTypeParameters(
              valueCs,
              specialization.substitutions
            );
          const access = host =>
            `${host}.${escapeCSharpIdentifier(field.name)}`;

          return field.isStatic
            ? access(specialization.type)
            : nullSafeInstanceReadExpression(
                api,
                specialization.type,
                specializedValueCs,
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
      const ownerGenerics =
        ownerGenericParameters(ownerCs, owner);
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = [port("call", API_PORT_LABELS.call, "impulse")];
      if (
        field.isPublic === false ||
        !isCSharpIdentifier(field.name) ||
        !isSupportedApiReturnType(valueCs)
      ) {
        return null;
      }
      inputs.push(
        ...genericTypeInputPorts(
          ownerGenerics,
          "ownerGeneric"
        )
      );
      if (!field.isStatic) {
        inputs.push(port("target", API_PORT_LABELS.target, ownerGraph));
      }
      inputs.push(port(
        "value",
        API_PORT_LABELS.value,
        ownerGenerics.length > 0
          ? "object"
          : graphTypeFor(valueCs)
      ));

      return withReloadContract({
        title: apiFormat(
          "api.catalog.title.field_write",
          "Write · {type}.{member}",
          {
            type: displayTypeName(owner),
            member: field.name
          }
        ),
        group: groupForType(owner, API_GROUPS.fields),
        symbol: "fld=",
        description: apiFormat(
          "api.catalog.description.field_write",
          "Writes field {type}.{member} ({valueType}).",
          {
            type: ownerCs,
            member: field.name,
            valueType: valueCs
          }
        ),
        inputs,
        outputs: [
          port("done", API_PORT_LABELS.done, "impulse"),
          port("success", API_PORT_LABELS.success, "bool"),
          port("exception", API_PORT_LABELS.exception, "exception")
        ],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: field.name,
        apiInheritedProjection:
          field.apiInheritedProjection === true,
        apiInheritedFrom:
          String(field.inheritedFrom || ""),
        apiStableContractId:
          writeStableContractId(field),
        apiStableContractIds:
          stableContractAliasValues(
            field.writeStableContractId,
            field.writeStableContractIds,
            field.writeContractId,
            field.writeContractIds
          ),
        apiMemberKind: "field-set",
        apiSignature:
          `${ownerCs}.${field.name} <- ${catalogExactType(field.type || valueCs)}`,
        apiParameters: [{ position: 0, type: field.type || valueCs }],
        apiReturnType: "System.Void",
        apiIsStatic: field.isStatic === true,
        apiGenericArity: 0,
        apiOwnerGenericParameters:
          ownerGenerics,
        compileTimeSpecializable:
          ownerGenerics.length > 0,
        runtimeBound:
          ownerGenerics.length > 0,
        apiSearchText: `${ownerCs} ${field.name} field write set ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const specialization =
            ownerSpecialization(
              api,
              ownerCs
            );
          if (!specialization) {
            return actionWithDoneImpulse(
              api,
              wrapApiAction(
                api,
                `    throw new System.InvalidOperationException("${escapeString(
                  compileTimeOwnerMessage(
                    ownerCs,
                    field.name
                  )
                )}");`
              )
            );
          }
          const host = field.isStatic
            ? specialization.type
            : `((${specialization.type})(${api.input("target").code}))`;
          const value =
            specializedInputExpression(
              api,
              "value",
              valueCs,
              specialization.substitutions
            );
          const action = wrapApiAction(
            api,
            `    ${host}.${escapeCSharpIdentifier(field.name)} = ${value};`
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
        title: apiFormat(
          "api.catalog.title.event",
          "On · {type}.{member}",
          {
            type: displayTypeName(owner),
            member: eventInfo.name
          }
        ),
        group: groupForType(owner, API_GROUPS.events),
        symbol: "evt",
        description: apiFormat(
          "api.catalog.description.event",
          "Typed catalog event wrapper for {type}.{member} ({handler}).",
          {
            type: ownerCs,
            member: eventInfo.name,
            handler:
              eventInfo.handlerType ||
              "delegate"
          }
        ),
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: eventInfo.name,
        apiStableContractId:
          String(eventInfo.stableContractId || ""),
        apiStableContractIds:
          stableContractAliasValues(
            eventInfo.stableContractId,
            eventInfo.stableContractIds,
            eventInfo.contractId,
            eventInfo.contractIds
          ),
        apiEventAddStableContractId:
          String(
            eventInfo.addStableContractId ||
            ""
          ),
        apiEventRemoveStableContractId:
          String(
            eventInfo.removeStableContractId ||
            ""
          ),
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

    function genericTypeInputPorts(
      genericParameters,
      prefix
    ) {
      return (genericParameters || []).map(
        (generic, index) => {
          const name = String(
            generic?.name || generic || `T${index}`
          );
          const position = Math.max(
            0,
            Number(generic?.position) || index
          );
          return port(
            `${prefix}${position}`,
            apiFormat(
              "api.catalog.port.type_argument",
              "Type {name}",
              { name }
            ),
            "type",
            {
              help: generic &&
                typeof generic === "object"
                ? genericConstraintHelp(generic)
                : apiFormat(
                    "api.catalog.generic.select_named",
                    "Select the concrete type argument for {name}.",
                    { name }
                  )
            }
          );
        }
      );
    }

    function compileTimeTypeFromExpression(
      value
    ) {
      let expression = String(value || "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .trim();
      while (
        expression.startsWith("(") &&
        expression.endsWith(")")
      ) {
        let depth = 0;
        let wrapsEntireExpression = true;
        for (
          let index = 0;
          index < expression.length;
          index += 1
        ) {
          if (expression[index] === "(") {
            depth += 1;
          } else if (expression[index] === ")") {
            depth -= 1;
            if (
              depth === 0 &&
              index < expression.length - 1
            ) {
              wrapsEntireExpression = false;
              break;
            }
          }
        }
        if (!wrapsEntireExpression || depth !== 0) {
          break;
        }
        expression = expression.slice(1, -1).trim();
      }

      const match = /^typeof\((.+)\)$/s.exec(
        expression
      );
      if (!match) return "";
      const type = normalizeCsType(match[1]);
      return canDirectlyReferenceType(type)
        ? type
        : "";
    }

    function resolveGenericSpecialization(
      api,
      templateType,
      genericParameters,
      prefix
    ) {
      const substitutions = new Map();
      const argumentsList = [];
      for (
        let index = 0;
        index < genericParameters.length;
        index += 1
      ) {
        const generic = genericParameters[index];
        const name = String(
          generic?.name || generic || ""
        ).trim();
        const position = Math.max(
          0,
          Number(generic?.position) || index
        );
        const explicit = genericBindingType(
          api.node,
          prefix,
          position
        );
        const input = api.input(
          `${prefix}${position}`
        );
        if (!explicit && input?.connected !== true) {
          return null;
        }
        const selected =
          explicit ||
          compileTimeTypeFromExpression(
            input.code
          );
        if (!name || !selected) {
          return null;
        }
        substitutions.set(name, selected);
        argumentsList.push(selected);
      }

      const specializedType =
        substituteGenericTypeParameters(
          templateType,
          substitutions
        );
      if (
        templateType &&
        !canDirectlyReferenceType(
          specializedType
        )
      ) {
        return null;
      }

      return {
        substitutions,
        arguments: argumentsList,
        type: specializedType
      };
    }

    function mergeGenericSubstitutions(
      ...sources
    ) {
      const result = new Map();
      for (const source of sources) {
        for (const [name, value] of
          source instanceof Map
            ? source
            : []) {
          result.set(name, value);
        }
      }
      return result;
    }

    function ownerGenericParameters(
      ownerCs,
      owner = null
    ) {
      const declared = new Map(
        (Array.isArray(owner?.genericParameters)
          ? owner.genericParameters
          : []).map((value, index) => [
          String(value?.name || ""),
          {
            ...value,
            position: Math.max(
              0,
              Number(value?.position) || index
            )
          }
        ])
      );
      return genericTypeParameterNames(
        ownerCs
      ).map((name, position) => ({
        ...(declared.get(name) || {}),
        name,
        position
      }));
    }

    function ownerSpecialization(api, ownerCs) {
      const genericParameters =
        ownerGenericParameters(ownerCs);
      if (genericParameters.length === 0) {
        return {
          substitutions: new Map(),
          arguments: [],
          type: ownerCs
        };
      }
      return resolveGenericSpecialization(
        api,
        ownerCs,
        genericParameters,
        "ownerGeneric"
      );
    }

    function genericTypeTokenExpression(
      api,
      templateType,
      genericParameters,
      prefix
    ) {
      const specialization =
        resolveGenericSpecialization(
          api,
          templateType,
          genericParameters,
          prefix
        );
      if (specialization) {
        return `typeof(${specialization.type})`;
      }

      const openType =
        openGenericDefinitionCsType(
          templateType
        );
      const argumentsList = genericParameters.map(
        (generic, index) => {
          const position = Math.max(
            0,
            Number(generic?.position) || index
          );
          return api.input(
            `${prefix}${position}`
          ).code;
        }
      );
      return (
        `typeof(${openType}).MakeGenericType(` +
        `new System.Type[] { ${argumentsList.join(", ")} })`
      );
    }

    function apiRuntimeOwnerTypeExpression(
      api,
      ownerCs
    ) {
      const genericParameters =
        ownerGenericParameters(ownerCs);
      if (genericParameters.length === 0) {
        return apiRuntimeTypeExpression(ownerCs);
      }
      return genericTypeTokenExpression(
        api,
        ownerCs,
        genericParameters,
        "ownerGeneric"
      );
    }

    function specializedInputExpression(
      api,
      inputId,
      templateType,
      substitutions
    ) {
      const input = api.input(inputId);
      const specializedType =
        substituteGenericTypeParameters(
          templateType,
          substitutions
        );
      return specializedType !==
        normalizeCsType(templateType)
        ? `((${specializedType})(${input.code}))`
        : input.code;
    }

    function parameterPort(parameter) {
      const csType = normalizeCsType(parameter.elementType || parameter.type || "System.Object");
      return port(
        `arg${Number(parameter.position || 0)}`,
        parameter.name || apiFormat(
          "api.catalog.port.argument_short",
          "Arg {index}",
          { index: Number(parameter.position || 0) }
        ),
        graphTypeFor(csType),
        {
          optional: parameter.isOptional === true,
          defaultCs: parameter.defaultValueCSharp || undefined,
          apiParameterType: csType,
          help: parameter.hasDefaultValue
            ? apiFormat(
                "api.catalog.parameter.default_help",
                "Default: {value}",
                {
                  value:
                    parameter.defaultValueCSharp ||
                    "default"
                }
              )
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
      if (
        known &&
        getTypeInformation(known)
      ) {
        return known;
      }
      if (known) {
        graphTypeByCs.delete(csType);
        graphTypeByNormalizedCs.delete(
          normalizeTypeForLookup(csType)
        );
      }
      if (isGenericParameterName(csType) || isOpenTypeExpression(csType)) {
        return "object";
      }
      return registerApiType(csType, typeByName.get(csType)) || "object";
    }

    function directConstructorAction(
      api,
      ownerCs,
      parameters,
      substitutions = new Map()
    ) {
      const fields = actionFieldNames(api);
      const argumentState = buildDirectArguments(
        api,
        parameters,
        substitutions
      );
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
          (
            parameter.isOut ||
            (
              parameter.isByRef &&
              parameter.isIn !== true
            )
          ) &&
          generatedApiOutputIsUsed(api, `out${parameter.position}`)
        )
        .map(parameter => `${fields.out(parameter.position)} = apiArguments[${parameter.position}]!;`)
        .join("\n    ");
      const resultTarget = generatedApiOutputIsUsed(api, "result")
        ? fields.result
        : "_";
      return wrapApiAction(
        api,
        `    System.Type apiType = ${apiRuntimeOwnerTypeExpression(api, ownerCs)};\n    object?[] apiArguments = new object?[] { ${args.join(", ")} };\n    System.Reflection.ConstructorInfo apiConstructor = ResolveApiCatalogConstructor(apiType, ${signature.parameterTypes}, ${signature.byRef}, ${signature.out}) ?? throw new System.MissingMethodException(apiType.FullName, ".ctor");\n    ${resultTarget} = apiConstructor.Invoke(apiArguments)!;\n${outAssignments ? `    ${outAssignments}\n` : ""}`
      );
    }

    function directMethodAction(
      api,
      ownerCs,
      method,
      parameters,
      isVoid,
      specialization = null
    ) {
      const fields = actionFieldNames(api);
      const substitutions =
        specialization?.substitutions ||
        new Map();
      const argumentState = buildDirectArguments(
        api,
        parameters,
        substitutions
      );
      const host = method.isStatic
        ? ownerCs
        : `((${ownerCs})(${api.input("target").code}))`;
      const genericArguments =
        specialization?.methodArguments || [];
      const genericSuffix =
        genericArguments.length > 0
          ? `<${genericArguments.join(", ")}>`
          : "";
      const operator =
        directOperatorDescriptor(
          method,
          parameters
        );
      let call;
      if (operator?.kind === "unary") {
        const expression =
          `${operator.token}(${argumentState.arguments[0]})`;
        call = operator.checked
          ? `checked(${expression})`
          : expression;
      } else if (operator?.kind === "binary") {
        const expression =
          `((${argumentState.arguments[0]}) ${operator.token} (${argumentState.arguments[1]}))`;
        call = operator.checked
          ? `checked(${expression})`
          : expression;
      } else if (
        operator?.kind === "conversion"
      ) {
        const returnType =
          substituteGenericTypeParameters(
            method.returnType ||
              "System.Object",
            substitutions
          );
        const expression =
          `((${returnType})(${argumentState.arguments[0]}))`;
        call = operator.checked
          ? `checked(${expression})`
          : expression;
      } else {
        call = `${host}.${escapeCSharpIdentifier(method.name)}${genericSuffix}(${argumentState.arguments.join(", ")})`;
      }
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
          (
            parameter.isOut ||
            (
              parameter.isByRef &&
              parameter.isIn !== true
            )
          ) &&
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
        `    System.Type apiDeclaringType = ${apiRuntimeOwnerTypeExpression(api, ownerCs)};\n    object? apiTarget = ${target};\n    object?[] apiArguments = new object?[] { ${supplied.join(", ")} };\n${genericArgumentDeclaration}    System.Reflection.MethodInfo apiMethod = ResolveApiCatalogMethod(apiDeclaringType, "${escapeString(normalizeCsType(method.declaringType || ownerCs))}", "${escapeString(method.name)}", ${signature.parameterTypes}, ${signature.byRef}, ${signature.out}, ${(method.genericParameters || []).length}, ${method.isStatic ? "true" : "false"}) ?? throw new System.MissingMethodException(apiDeclaringType.FullName, "${escapeString(method.name)}");\n${genericInputs.length > 0 ? "    apiMethod = apiMethod.MakeGenericMethod(apiGenericArguments);\n" : ""}    ${resultAssignment}\n${outAssignments ? `    ${outAssignments}\n` : ""}`
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

    function buildDirectArguments(
      api,
      parameters,
      substitutions = new Map()
    ) {
      const token = api.token(api.node.id);
      const declarations = [];
      const assignments = [];
      const argumentsList = [];
      const fields = actionFieldNames(api);
      const supplied = parameters.map(parameter =>
        parameter.isOut === true ||
        parameter.isOptional !== true ||
        api.input(
          `arg${Number(parameter.position || 0)}`
        ).connected === true
      );
      const lastSuppliedIndex =
        supplied.lastIndexOf(true);

      for (
        let parameterIndex = 0;
        parameterIndex < parameters.length;
        parameterIndex += 1
      ) {
        const parameter = parameters[parameterIndex];
        const position = Number(parameter.position || 0);
        const templateType = normalizeCsType(
          parameter.elementType ||
          parameter.type ||
          "System.Object"
        );
        const csType =
          substituteGenericTypeParameters(
            templateType,
            substitutions
          );
        const local = `_apiArg${position}${token}`;
        const inputId = `arg${position}`;
        const input = parameter.isOut
          ? null
          : api.input(inputId);
        if (
          parameter.isOptional === true &&
          input?.connected !== true
        ) {
          if (parameterIndex < lastSuppliedIndex) {
            const declaredDefault =
              substituteGenericTypeParameters(
                parameter.defaultValueCSharp ||
                  `default(${csType})`,
                substitutions
              );
            argumentsList.push(
              declaredDefault
            );
          }
          continue;
        }
        if (parameter.isOut) {
          declarations.push(`${csType} ${local};`);
          argumentsList.push(`out ${local}`);
          if (generatedApiOutputIsUsed(api, `out${position}`)) {
            assignments.push(`${fields.out(position)} = ${local};`);
          }
        } else if (parameter.isByRef) {
          const inputValue =
            specializedInputExpression(
              api,
              inputId,
              templateType,
              substitutions
            );
          declarations.push(`${csType} ${local} = ${inputValue};`);
          argumentsList.push(
            `${parameter.isIn === true ? "in" : "ref"} ${local}`
          );
          if (
            parameter.isIn !== true &&
            generatedApiOutputIsUsed(
              api,
              `out${position}`
            )
          ) {
            assignments.push(`${fields.out(position)} = ${local};`);
          }
        } else {
          argumentsList.push(
            specializedInputExpression(
              api,
              inputId,
              templateType,
              substitutions
            )
          );
        }
      }

      return {
        declarations: declarations.join("\n") + (declarations.length ? "\n" : ""),
        arguments: argumentsList,
        assignments: assignments.join("\n") + (assignments.length ? "\n" : "")
      };
    }

    function compileTimeOwnerMessage(
      ownerCs,
      memberName
    ) {
      return (
        `API member ${ownerCs}.${memberName} requires ` +
        "compile-time System.Type constants for all owner generic arguments."
      );
    }

    function requiredCompileTimeOwnerExpression(
      ownerCs,
      memberName
    ) {
      return (
        "(throw new System.InvalidOperationException(" +
        `"${escapeString(
          compileTimeOwnerMessage(
            ownerCs,
            memberName
          )
        )}"))`
      );
    }

    function propertyAccessExpression(
      api,
      ownerCs,
      property,
      indexes,
      substitutions = new Map()
    ) {
      const host = property.isStatic
        ? ownerCs
        : `((${ownerCs})(${api.input("target").code}))`;
      if (indexes.length > 0) {
        const indexValues = indexes.map(parameter =>
          specializedInputExpression(
            api,
            `arg${parameter.position}`,
            parameter.elementType ||
              parameter.type ||
              "System.Object",
            substitutions
          )
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

      return `(((object?)(${target})) is ${ownerCs} ${local} ? ${memberAccess(local)} : default(${valueCs})!)`;
    }

    function propertyReadExpression(
      api,
      ownerCs,
      valueCs,
      property,
      indexes,
      substitutions = new Map()
    ) {
      const access = host => {
        if (indexes.length > 0) {
          const indexValues = indexes.map(
            parameter =>
              specializedInputExpression(
                api,
                `arg${parameter.position}`,
                parameter.elementType ||
                  parameter.type ||
                  "System.Object",
                substitutions
              )
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
          ? substituteGenericTypeParameters(
              parameter.elementType ||
              parameter.type ||
              "System.Object",
              descriptor.substitutions ||
                new Map()
            )
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
      const catchClause =
        "catch (System.Exception exception)";
      const failureBody = keepException
        ? failureLines
        : "    throw;";

      return `try\n{\n${String(body || "").trimEnd()}${successLines ? `\n${successLines}` : ""}\n}\n${catchClause}\n{\n${failureBody}\n}`;
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

    function methodSpecialization(
      api,
      ownerCs,
      method,
      parameters
    ) {
      const owner = ownerSpecialization(
        api,
        ownerCs
      );
      if (!owner) return null;

      const methodGenerics = Array.isArray(
        method.genericParameters
      )
        ? method.genericParameters
        : [];
      const methodSpecialization =
        methodGenerics.length > 0
          ? resolveGenericSpecialization(
              api,
              "",
              methodGenerics,
              "generic"
            )
          : {
              substitutions: new Map(),
              arguments: []
            };
      if (!methodSpecialization) return null;

      const substitutions =
        mergeGenericSubstitutions(
          owner.substitutions,
          methodSpecialization.substitutions
        );
      if (
        !canDirectlyCallMethod(
          owner.type,
          method,
          parameters,
          substitutions
        )
      ) {
        return null;
      }

      return {
        ownerType: owner.type,
        ownerArguments: owner.arguments,
        methodArguments:
          methodSpecialization.arguments,
        substitutions
      };
    }

    function canDirectlyCallMethod(
      ownerCs,
      method,
      parameters,
      substitutions = new Map()
    ) {
      const returnType =
        substituteGenericTypeParameters(
          method.returnType ||
          "System.Void",
          substitutions
        );
      const genericParameters =
        Array.isArray(
          method.genericParameters
        )
          ? method.genericParameters
          : [];
      return (
        canDirectlyReferenceType(ownerCs) &&
        method.isPublic !== false &&
        (
          method.isSpecialName !== true ||
          method.isOperator === true
        ) &&
        (
          method.isOperator !== true ||
          canDirectlyEmitOperator(
            method,
            parameters
          )
        ) &&
        genericParameters.every(generic =>
          substitutions.has(
            String(generic?.name || "")
          )
        ) &&
        canDirectlyReferenceType(returnType) &&
        parameters.every(parameter =>
          canDirectlyPassParameter(
            parameter,
            substitutions
          )
        ) &&
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(method.name || ""))
      );
    }

    function directOperatorDescriptor(
      method,
      parameters
    ) {
      if (
        method?.isOperator !== true ||
        method?.isStatic !== true ||
        !Array.isArray(parameters) ||
        parameters.some(parameter =>
          parameter?.isByRef === true ||
          parameter?.isOut === true ||
          parameter?.isOptional === true
        )
      ) {
        return null;
      }

      const unary = new Map([
        ["op_UnaryPlus", "+"],
        ["op_UnaryNegation", "-"],
        ["op_LogicalNot", "!"],
        ["op_OnesComplement", "~"],
        ["op_Increment", "++"],
        ["op_Decrement", "--"]
      ]);
      const checkedUnary = new Map([
        ["op_CheckedUnaryNegation", "-"],
        ["op_CheckedIncrement", "++"],
        ["op_CheckedDecrement", "--"]
      ]);
      const binary = new Map([
        ["op_Addition", "+"],
        ["op_Subtraction", "-"],
        ["op_Multiply", "*"],
        ["op_Division", "/"],
        ["op_Modulus", "%"],
        ["op_BitwiseAnd", "&"],
        ["op_BitwiseOr", "|"],
        ["op_ExclusiveOr", "^"],
        ["op_LeftShift", "<<"],
        ["op_RightShift", ">>"],
        ["op_UnsignedRightShift", ">>>"],
        ["op_Equality", "=="],
        ["op_Inequality", "!="],
        ["op_GreaterThan", ">"],
        ["op_LessThan", "<"],
        ["op_GreaterThanOrEqual", ">="],
        ["op_LessThanOrEqual", "<="]
      ]);
      const checkedBinary = new Map([
        ["op_CheckedAddition", "+"],
        ["op_CheckedSubtraction", "-"],
        ["op_CheckedMultiply", "*"]
      ]);
      const name = String(method.name || "");
      if (
        parameters.length === 1 &&
        unary.has(name)
      ) {
        return {
          kind: "unary",
          token: unary.get(name),
          checked: false
        };
      }
      if (
        parameters.length === 1 &&
        checkedUnary.has(name)
      ) {
        return {
          kind: "unary",
          token: checkedUnary.get(name),
          checked: true
        };
      }
      if (
        parameters.length === 2 &&
        binary.has(name)
      ) {
        return {
          kind: "binary",
          token: binary.get(name),
          checked: false
        };
      }
      if (
        parameters.length === 2 &&
        checkedBinary.has(name)
      ) {
        return {
          kind: "binary",
          token: checkedBinary.get(name),
          checked: true
        };
      }
      if (
        parameters.length === 1 &&
        [
          "op_Implicit",
          "op_Explicit",
          "op_CheckedImplicit",
          "op_CheckedExplicit"
        ].includes(name)
      ) {
        return {
          kind: "conversion",
          checked:
            name.startsWith("op_Checked")
        };
      }
      return null;
    }

    function canDirectlyEmitOperator(
      method,
      parameters
    ) {
      return Boolean(
        directOperatorDescriptor(
          method,
          parameters
        )
      );
    }

    function canDirectlyPassParameter(
      parameter,
      substitutions = new Map()
    ) {
      const type =
        substituteGenericTypeParameters(
          parameter.elementType ||
          parameter.type ||
          "",
          substitutions
        );
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
          ? parameter?.isIn === true
            ? "in "
            : "ref "
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

    function isUsableCatalogMemberOwner(row) {
      if (
        !row ||
        row.isPublic === false ||
        row.isByRefLike === true ||
        !row.fullName ||
        row.isObsolete ||
        row.isLegacyNamed
      ) {
        return false;
      }

      const fullName = normalizeCsType(
        row.fullName
      );
      return Boolean(
        fullName &&
        fullName !== "System.Void" &&
        isSafeCSharpTypeExpression(fullName) &&
        !fullName.includes("<>") &&
        (
          !isOpenTypeExpression(fullName) ||
          genericTypeParameterNames(fullName)
            .length > 0
        )
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

  function genericTypeParameterNames(value) {
    const result = [];
    const seen = new Set();
    const visit = candidate => {
      const text = normalizeCsType(candidate);
      if (isGenericParameterName(text)) {
        if (!seen.has(text)) {
          seen.add(text);
          result.push(text);
        }
        return;
      }
      const array = text.match(
        /^(.*)\[(?:,*)\]$/
      );
      if (array) {
        visit(array[1]);
        return;
      }
      const parsed = firstGenericTypeParts(text);
      if (!parsed) return;
      for (const argument of parsed.arguments) {
        visit(argument);
      }
      if (parsed.suffix.includes("<")) {
        visit(`Nested${parsed.suffix}`);
      }
    };

    visit(value);

    return result;
  }

  function openGenericDefinitionCsType(value) {
    const text = normalizeCsType(value);
    let result = "";
    let cursor = 0;
    let replaced = false;

    while (cursor < text.length) {
      const open = text.indexOf("<", cursor);
      if (open < 0) {
        result += text.slice(cursor);
        break;
      }
      result += text.slice(cursor, open);
      let depth = 0;
      let close = -1;
      for (
        let index = open;
        index < text.length;
        index += 1
      ) {
        if (text[index] === "<") depth += 1;
        if (text[index] === ">") {
          depth -= 1;
          if (depth === 0) {
            close = index;
            break;
          }
        }
      }
      if (close < 0) return "";
      const argumentsList =
        splitTopLevelTypeArguments(
          text.slice(open + 1, close)
        );
      if (
        argumentsList.length > 0 &&
        argumentsList.every(
          isGenericParameterName
        )
      ) {
        result += `<${",".repeat(
          argumentsList.length - 1
        )}>`;
        replaced = true;
      } else {
        result += text.slice(open, close + 1);
      }
      cursor = close + 1;
    }

    return replaced ? result : "";
  }

  function genericTypeShape(value) {
    const text = normalizeCsType(value)
      .replace(/\s+/g, "");
    let result = "";
    let cursor = 0;
    let found = false;

    while (cursor < text.length) {
      const open = text.indexOf("<", cursor);
      if (open < 0) {
        result += text.slice(cursor);
        break;
      }
      result += text.slice(cursor, open);
      let depth = 0;
      let close = -1;
      for (
        let index = open;
        index < text.length;
        index += 1
      ) {
        if (text[index] === "<") depth += 1;
        if (text[index] === ">") {
          depth -= 1;
          if (depth === 0) {
            close = index;
            break;
          }
        }
      }
      if (close < 0) return "";
      const argumentsList =
        splitTopLevelTypeArguments(
          text.slice(open + 1, close)
        );
      result += `\`${argumentsList.length}`;
      found = true;
      cursor = close + 1;
    }

    return found ? result : "";
  }

  function genericTypeSubstitutions(
    templateType,
    actualType
  ) {
    const result = new Map();

    const visit = (templateValue, actualValue) => {
      const templateText =
        normalizeCsType(templateValue);
      const actualText =
        normalizeCsType(actualValue);
      if (isGenericParameterName(templateText)) {
        const existing = result.get(templateText);
        if (!existing || existing === actualText) {
          result.set(templateText, actualText);
        }
        return;
      }

      const templateArray = templateText.match(
        /^(.*)\[(?:,*)\]$/
      );
      const actualArray = actualText.match(
        /^(.*)\[(?:,*)\]$/
      );
      if (templateArray && actualArray) {
        visit(templateArray[1], actualArray[1]);
        return;
      }

      const template =
        firstGenericTypeParts(templateText);
      const actual =
        firstGenericTypeParts(actualText);
      if (
        !template ||
        !actual ||
        template.head.replace(/\s+/g, "") !==
          actual.head.replace(/\s+/g, "") ||
        template.arguments.length !==
          actual.arguments.length
      ) {
        return;
      }

      for (
        let index = 0;
        index < template.arguments.length;
        index += 1
      ) {
        visit(
          template.arguments[index],
          actual.arguments[index]
        );
      }

      if (
        template.suffix.includes("<") &&
        actual.suffix.includes("<")
      ) {
        visit(
          `Nested${template.suffix}`,
          `Nested${actual.suffix}`
        );
      }
    };

    if (
      genericTypeShape(templateType) ===
        genericTypeShape(actualType)
    ) {
      visit(templateType, actualType);
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
    const parsed = firstGenericTypeParts(text);
    if (!parsed) return false;
    return (
      parsed.arguments.some(argument =>
        isGenericParameterName(argument) ||
        isOpenTypeExpression(argument)
      ) ||
      (
        parsed.suffix.includes("<") &&
        isOpenTypeExpression(
          `Nested${parsed.suffix}`
        )
      )
    );
  }

  function isGenericParameterName(value) {
    return /^(?:[A-Z]|T[A-Za-z0-9_]*)$/.test(normalizeCsType(value));
  }

  function looksLikeValueType(value) {
    const text = normalizeCsType(value);
    return /^(?:System\.)?(?:Boolean|Byte|SByte|Int16|UInt16|Int32|UInt32|Int64|UInt64|Half|Single|Double|Decimal|Char|DateTime|DateTimeOffset|TimeSpan|Guid)$/.test(text) ||
      /^(?:Elements\.Core\.)?(?:(?:bool|byte|sbyte|short|ushort|int|uint|long|ulong|half|float|double)[234]|(?:float|double)(?:2x2|3x3|4x4)|(?:float|double)Q|color(?:32|X)?)$/.test(text);
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
      ? apiFormat(
          "api.catalog.generic.constraints",
          "Constraints: {constraints}",
          { constraints: parts.join(", ") }
        )
      : apiText(
          "api.catalog.generic.select",
          "Select the concrete generic type argument."
        );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
  boot();
})();
