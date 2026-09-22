"use strict";

const SAVED_API_COMPOSITE_NESTING_LIMIT =
    typeof API_COMPOSITE_MAX_NESTING_DEPTH ===
      "number"
      ? API_COMPOSITE_MAX_NESTING_DEPTH
      : 32;

function apiCompositeStoredNodeSupported(
    node,
    ownedGraphs = {}
  ) {
    if (
      node?.kind !== "operator"
    ) {
      return false;
    }
    if (
      node.operatorId ===
        "container.apiComposite"
    ) {
      return apiCompositeOwnedContainerAllowed(
        node,
        ownedGraphs
      );
    }
    const definition =
      OPERATOR_DEFINITIONS[
        node.operatorId
      ];
    const verifiedContract =
      definition?.catalogGenerated ===
        true &&
      definition.apiVerification &&
      typeof definition.apiVerification ===
        "object" &&
      !Array.isArray(
        definition.apiVerification
      )
        ? definition.apiVerification
        : null;
    const contract = [
      verifiedContract,
      node.apiContract,
      definition?.preservedApiContract
    ].find(candidate =>
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      String(
        candidate.ownerType || ""
      ).trim() &&
      String(candidate.kind || "")
        .trim()
    ) || null;
    if (
      definition?.catalogGenerated === true ||
      definition?.unavailableApiContract === true ||
      contract
    ) {
      return Boolean(
        String(
          contract?.ownerType || ""
        ).trim() &&
        String(contract?.kind || "")
          .trim()
      );
    }
    return apiCompositeInternalDefinitionAllowed(
      definition
    );
  }

function apiCompositeVerifiedCatalogNode(
    node
  ) {
    const definition =
      OPERATOR_DEFINITIONS[
        node?.operatorId
      ];
    return Boolean(
      node?.kind === "operator" &&
      definition?.catalogGenerated === true &&
      definition?.unavailableApiContract !==
        true &&
      portableApiContractForNode(node)
    );
  }

function apiCompositeHasVerifiedCatalogNode(
    nodes,
    apiCompositeGraphs = {},
    visited = new Set(),
    depth = 0
  ) {
    if (
      depth >
        SAVED_API_COMPOSITE_NESTING_LIMIT
    ) {
      return false;
    }
    const list = Array.isArray(nodes)
      ? nodes
      : [];
    if (
      list.some(
        apiCompositeVerifiedCatalogNode
      )
    ) {
      return true;
    }
    const registry =
      apiCompositeGraphs &&
      typeof apiCompositeGraphs ===
        "object" &&
      !Array.isArray(apiCompositeGraphs)
        ? apiCompositeGraphs
        : {};
    for (const node of list) {
      if (
        node?.operatorId !==
          "container.apiComposite"
      ) {
        continue;
      }
      const composite = registry[node.id];
      if (
        !composite ||
        visited.has(composite)
      ) {
        continue;
      }
      visited.add(composite);
      if (
        apiCompositeHasVerifiedCatalogNode(
          composite.nodes,
          composite.apiCompositeGraphs,
          visited,
          depth + 1
        )
      ) {
        return true;
      }
    }
    return false;
  }

const SAVED_API_COMPOSITE_EXPORT_SCHEMA =
    "rml-builder.saved-api-composites";

const SAVED_API_COMPOSITE_SCHEMA_VERSION = 1;

const SAVED_API_COMPOSITE_DATABASE_NAME =
    "rml-builder-saved-api-composites";

const SAVED_API_COMPOSITE_STORE_NAME =
    "templates";

const SAVED_API_COMPOSITE_PALETTE_PREFIX =
    "saved-api-composite:";

const SAVED_API_COMPOSITE_MAX_IMPORT_COUNT =
    128;

const SAVED_API_COMPOSITE_MAX_NODES =
    20000;

const SAVED_API_COMPOSITE_MAX_CONNECTIONS =
    50000;

const SAVED_API_COMPOSITE_ELEMENT_IDENTITY_VERSION =
    1;

function savedApiCompositeIdentityText(
    value,
    fallback = ""
  ) {
    const text = String(value || "").trim();
    return (text || String(fallback || "").trim())
      .slice(0, 360);
  }

function savedApiCompositeUniqueIdentity(
    value,
    fallback,
    used
  ) {
    const fallbackText =
      savedApiCompositeIdentityText(
        fallback,
        "element"
      );
    let stable =
      savedApiCompositeIdentityText(
        value,
        fallbackText
      );
    if (!used.has(stable)) {
      used.add(stable);
      return stable;
    }
    let sequence = used.size + 1;
    do {
      const suffix = `#${sequence}`;
      stable =
        `${fallbackText.slice(
          0,
          360 - suffix.length
        )}${suffix}`;
      sequence += 1;
    } while (used.has(stable));
    used.add(stable);
    return stable;
  }

function savedApiCompositeElementIdentity(
    source,
    composite,
    templateId = ""
  ) {
    const candidate =
      source &&
      typeof source === "object" &&
      !Array.isArray(source)
        ? source
        : {};
    const result = {
      ...nodeGraphClone(candidate),
      version:
        SAVED_API_COMPOSITE_ELEMENT_IDENTITY_VERSION,
      templateId: savedApiCompositeIdentityText(
        candidate.templateId,
        templateId
      ).slice(0, 180),
      nodes: {},
      connections: {},
      points: {},
      boundaries: {}
    };
    const usedNodes = new Set();
    const usedConnections = new Set();
    const usedPoints = new Set();
    const usedBoundaries = new Set();
    for (const node of
      Array.isArray(composite?.nodes)
        ? composite.nodes
        : []) {
      const id = String(node?.id || "");
      if (!id) continue;
      const stable =
        savedApiCompositeUniqueIdentity(
          candidate.nodes?.[id],
          `node:${id}`,
          usedNodes
        );
      result.nodes[id] = stable;
    }
    for (const connection of
      Array.isArray(composite?.connections)
        ? composite.connections
        : []) {
      const id = String(
        connection?.id || ""
      );
      if (!id) continue;
      const stable =
        savedApiCompositeUniqueIdentity(
          candidate.connections?.[id],
          `connection:${id}`,
          usedConnections
        );
      result.connections[id] = stable;
      const points = {};
      for (const point of
        Array.isArray(connection?.points)
          ? connection.points
          : []) {
        const pointId = String(
          point?.id || ""
        );
        if (!pointId) continue;
        const stablePoint =
          savedApiCompositeUniqueIdentity(
            candidate.points?.[id]?.[
              pointId
            ],
            `point:${stable}:${pointId}`,
            usedPoints
          );
        points[pointId] = stablePoint;
      }
      result.points[id] = points;
    }
    for (const boundary of
      apiCompositeBoundaryRecords(
        composite?.boundaryPorts
      )) {
      const key =
        `${boundary.direction}\u0000${boundary.id}`;
      const stable =
        savedApiCompositeUniqueIdentity(
          candidate.boundaries?.[key],
          `boundary:${boundary.direction}:${boundary.id}`,
          usedBoundaries
        );
      result.boundaries[key] = stable;
    }
    return result;
  }

function savedApiCompositeApplyElementIdentity(
    composite,
    templateId = "",
    source = composite
  ) {
    if (
      !composite ||
      typeof composite !== "object" ||
      Array.isArray(composite)
    ) {
      return composite;
    }
    composite.elementIdentity =
      savedApiCompositeElementIdentity(
        source?.elementIdentity ||
          composite.elementIdentity,
        composite,
        templateId
      );
    for (const [ownerId, nested] of
      Object.entries(
        composite.apiCompositeGraphs || {}
      )) {
      savedApiCompositeApplyElementIdentity(
        nested,
        nested?.elementIdentity?.templateId ||
          source?.apiCompositeGraphs?.[
            ownerId
          ]?.elementIdentity?.templateId ||
          templateId,
        source?.apiCompositeGraphs?.[
          ownerId
        ] || nested
      );
    }
    return composite;
  }

function savedApiCompositeGraphStats(
    source
  ) {
    const visited = new WeakSet();
    const nodeIds = new Set();
    const connectionIds = new Set();
    const stats = {
      nodes: 0,
      connections: 0,
      composites: 0,
      boundaries: 0,
      customFiles: 0,
      customNodes: 0,
      customConnections: 0,
      maximumDepth: 0
    };
    const append = (
      candidate,
      depth,
      path
    ) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        !Array.isArray(candidate.nodes) ||
        !Array.isArray(candidate.connections)
      ) {
        throw new Error(
          `${path} has no complete internal node graph.`
        );
      }
      if (
        depth >
          SAVED_API_COMPOSITE_NESTING_LIMIT
      ) {
        throw new Error(
          `API Composite nesting exceeds the safe depth limit of ${SAVED_API_COMPOSITE_NESTING_LIMIT}.`
        );
      }
      if (visited.has(candidate)) {
        throw new Error(
          `API Composite nesting contains a cycle at ${path}.`
        );
      }
      visited.add(candidate);
      for (const node of candidate.nodes) {
        const nodeId = String(
          node?.id || ""
        );
        if (!nodeId || nodeIds.has(nodeId)) {
          throw new Error(
            `${path} contains duplicate node identity '${nodeId || "<unnamed>"}'.`
          );
        }
        nodeIds.add(nodeId);
      }
      for (const connection of
        candidate.connections) {
        const connectionId = String(
          connection?.id || ""
        );
        if (
          !connectionId ||
          connectionIds.has(connectionId)
        ) {
          throw new Error(
            `${path} contains duplicate connection identity '${connectionId || "<unnamed>"}'.`
          );
        }
        connectionIds.add(connectionId);
      }
      stats.nodes += candidate.nodes.length;
      stats.connections +=
        candidate.connections.length;
      stats.boundaries +=
        Array.isArray(
          candidate.boundaryPorts
        )
          ? candidate.boundaryPorts.length
          : 0;
      stats.maximumDepth = Math.max(
        stats.maximumDepth,
        depth
      );
      if (
        stats.nodes + stats.customNodes >
          SAVED_API_COMPOSITE_MAX_NODES ||
        stats.connections +
            stats.customConnections >
          SAVED_API_COMPOSITE_MAX_CONNECTIONS
      ) {
        throw new Error(
          `A saved API Composite may contain at most ${SAVED_API_COMPOSITE_MAX_NODES.toLocaleString(window.RMLI18n?.language || undefined)} nodes and ${SAVED_API_COMPOSITE_MAX_CONNECTIONS.toLocaleString(window.RMLI18n?.language || undefined)} connections across all nested levels.`
        );
      }
      const registry =
        candidate.apiCompositeGraphs &&
        typeof candidate.apiCompositeGraphs ===
          "object" &&
        !Array.isArray(
          candidate.apiCompositeGraphs
        )
          ? candidate.apiCompositeGraphs
          : {};
      if (
        candidate.customCSharpFiles != null &&
        (
          typeof candidate.customCSharpFiles !==
            "object" ||
          Array.isArray(
            candidate.customCSharpFiles
          )
        )
      ) {
        throw new Error(
          `${path} has an invalid Custom C# graph registry.`
        );
      }
      const customRegistry =
        candidate.customCSharpFiles || {};
      const customOwners = new Set(
        candidate.nodes
          .filter(node =>
            node?.operatorId ===
              "csharp.file"
          )
          .map(node => String(node.id || ""))
      );
      for (const [ownerId, customGraph] of
        Object.entries(customRegistry)) {
        if (!customOwners.has(ownerId)) {
          throw new Error(
            `${path} contains an orphaned Custom C# graph '${ownerId || "<unnamed>"}'.`
          );
        }
        if (
          !customGraph ||
          typeof customGraph !== "object" ||
          Array.isArray(customGraph) ||
          !Array.isArray(customGraph.nodes) ||
          !Array.isArray(
            customGraph.connections
          ) ||
          visited.has(customGraph)
        ) {
          throw new Error(
            `${path} contains an invalid or recursive Custom C# graph '${ownerId || "<unnamed>"}'.`
          );
        }
        visited.add(customGraph);
        const customNodeIds = new Set();
        for (const node of customGraph.nodes) {
          const nodeId = String(
            node?.id || ""
          );
          if (
            !nodeId ||
            customNodeIds.has(nodeId)
          ) {
            throw new Error(
              `${path} contains duplicate Custom C# node identity '${nodeId || "<unnamed>"}'.`
            );
          }
          customNodeIds.add(nodeId);
        }
        const customConnectionIds = new Set();
        for (const connection of
          customGraph.connections) {
          const connectionId = String(
            connection?.id || ""
          );
          if (
            !connectionId ||
            customConnectionIds.has(
              connectionId
            )
          ) {
            throw new Error(
              `${path} contains duplicate Custom C# connection identity '${connectionId || "<unnamed>"}'.`
            );
          }
          customConnectionIds.add(
            connectionId
          );
        }
        stats.customFiles += 1;
        stats.customNodes +=
          customGraph.nodes.length;
        stats.customConnections +=
          customGraph.connections.length;
      }
      if (
        stats.nodes + stats.customNodes >
          SAVED_API_COMPOSITE_MAX_NODES ||
        stats.connections +
            stats.customConnections >
          SAVED_API_COMPOSITE_MAX_CONNECTIONS
      ) {
        throw new Error(
          `A saved API Composite may contain at most ${SAVED_API_COMPOSITE_MAX_NODES.toLocaleString(window.RMLI18n?.language || undefined)} nodes and ${SAVED_API_COMPOSITE_MAX_CONNECTIONS.toLocaleString(window.RMLI18n?.language || undefined)} connections across all nested levels.`
        );
      }
      const owners = new Map(
        candidate.nodes
          .filter(node =>
            node?.operatorId ===
              "container.apiComposite"
          )
          .map(node => [
            String(node.id || ""),
            node
          ])
      );
      for (const ownerId of
        Object.keys(registry)) {
        if (!owners.has(ownerId)) {
          throw new Error(
            `${path} contains an orphaned nested API Composite '${ownerId || "<unnamed>"}'.`
          );
        }
      }
      for (const [ownerId, owner] of
        owners) {
        const nested = registry[ownerId];
        if (!nested) {
          throw new Error(
            `${path} contains API Composite node '${ownerId || "<unnamed>"}' without an owned graph.`
          );
        }
        stats.composites += 1;
        append(
          nested,
          depth + 1,
          `${path}/${String(
            owner.label ||
            owner.parameters?.title ||
            ownerId
          )}`
        );
      }
    };
    append(source, 0, "Saved API Composite");
    return stats;
  }

const SAVED_API_COMPOSITE_LEGACY_FINGERPRINT =
    Symbol(
      "saved-api-composite-legacy-fingerprint"
    );

let savedApiCompositeDatabasePromise = null;

let savedApiCompositeLoadPromise = null;

  let savedApiCompositePaletteRevision = 0;

  function markSavedApiCompositePaletteStateChanged() {
    savedApiCompositePaletteRevision =
      savedApiCompositePaletteRevision >=
      Number.MAX_SAFE_INTEGER
        ? 1
        : savedApiCompositePaletteRevision + 1;
    return savedApiCompositePaletteRevision;
  }

  function savedApiCompositePaletteStateRevision() {
    return savedApiCompositePaletteRevision;
  }

  class SavedApiCompositeRevisionMap extends Map {
    set(key, value) {
      super.set(key, value);
      savedApiCompositeCompareRecordChanged?.(
        key,
        value
      );
      markSavedApiCompositePaletteStateChanged();
      return this;
    }

    delete(key) {
      const deleted = super.delete(key);
      if (deleted) {
        savedApiCompositeCompareRecordChanged?.(
          key
        );
        markSavedApiCompositePaletteStateChanged();
      }
      return deleted;
    }

    clear() {
      if (this.size === 0) return;
      super.clear();
      savedApiCompositeCompareRecordsCleared?.();
      markSavedApiCompositePaletteStateChanged();
    }
  }

  const savedApiCompositeTemplates =
    new SavedApiCompositeRevisionMap();

  const savedApiCompositeOperations =
    new Set();
let savedApiCompositeMutationTail =
  Promise.resolve();

  const savedApiCompositeCompatibilityIssues =
    new Map();

let savedApiCompositeReconciliationPromise =
    null;

let savedApiCompositeReconciliationRequestedKey =
    "";

let savedApiCompositeReconciliationCompletedKey =
    "";

const savedApiCompositeSearchTextCache =
    new WeakMap();

  const SAVED_API_COMPOSITE_COMPARE_MESSAGE_TYPE =
    "rml-saved-api-composite-compare";

  const SAVED_API_COMPOSITE_COMPARE_RESULT_TYPE =
    `${SAVED_API_COMPOSITE_COMPARE_MESSAGE_TYPE}-result`;

  const SAVED_API_COMPOSITE_COMPARE_MODULE_ID =
    "1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll";

  const SAVED_API_COMPOSITE_COMPARE_CANONICAL_SCHEMA_VERSION =
    4;

  const SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS =
    1024;

  const SAVED_API_COMPOSITE_COMPARE_PAGE_ENCODING_VERSION =
    1;

  const SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH =
    64 * 1024;

  const SAVED_API_COMPOSITE_COMPARE_MAX_IN_FLIGHT_PAGES =
    4;

  const SAVED_API_COMPOSITE_COMPARE_SENDER_SLICE_MS =
    0.25;

  const SAVED_API_COMPOSITE_COMPARE_IDLE_RESERVE_MS =
    1.5;

  const SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN =
    Object.freeze({
      object: 1,
      array: 2,
      end: 3,
      key: 4,
      keyString: 5,
      keyPart: 6,
      endKey: 7,
      scalarNull: 8,
      scalarFalse: 9,
      scalarTrue: 10,
      scalarNumber: 11,
      scalarString: 12,
      string: 13,
      stringPart: 14,
      endString: 15
    });

  const savedApiCompositeCompareBaselineStates =
    new Map();

  const savedApiCompositeCompareCandidateStates =
    new Map();

  const savedApiCompositeCompareNodeParameterDefaultsByDefinition =
    new WeakMap();

  const SAVED_API_COMPOSITE_ACCEPTED_MUTATION_PENDING_STATE =
    Object.freeze({
      status: "pending",
      equivalent: null,
      acceptedMutationPending: true
    });

  const savedApiCompositeCompareRevisionByDocument =
    new WeakMap();

  const savedApiCompositeCompareRevisionByOwnerPath =
    new Map();

  const savedApiCompositeComparePendingRequests =
    new Map();

  let savedApiCompositeCompareWorker = null;

  let savedApiCompositeCompareWorkerObjectUrl = "";

  let savedApiCompositeCompareWorkerEpoch = null;

  let savedApiCompositeCompareWorkerActivation = null;

  let savedApiCompositeCompareRequestSequence = 0;

  let savedApiCompositeCompareProtocolRevision = 0;

  let savedApiCompositeCompareDocumentRevisionSequence = 0;

  let savedApiCompositeCompareRefreshFrame = 0;

  let savedApiCompositeCompareUnavailableWarningShown =
    false;

  let savedApiCompositeCompareStreamTail =
    Promise.resolve();

  let savedApiCompositeCompareStreamQueueGeneration =
    0;

  let savedApiCompositeCompareAcceptedMutationGeneration =
    0;

  let savedApiCompositeCompareCommittedMutationGeneration =
    0;

  function savedApiCompositeCompareProjectEpoch() {
    return typeof builderProjectEpoch === "undefined"
      ? 0
      : builderProjectEpoch;
  }

  function synchronizeSavedApiCompositeCompareProjectEpoch() {
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    if (
      savedApiCompositeCompareWorker &&
      !Object.is(
        savedApiCompositeCompareWorkerEpoch,
        projectEpoch
      )
    ) {
      resetSavedApiCompositeCompareClient(
        new Error(
          window.RMLI18n.t("ui.literal.593a60856a7f")
        )
      );
    }
    return projectEpoch;
  }

  function nextSavedApiCompositeCompareProtocolRevision() {
    savedApiCompositeCompareProtocolRevision =
      savedApiCompositeCompareProtocolRevision >=
        Number.MAX_SAFE_INTEGER
        ? 1
        : savedApiCompositeCompareProtocolRevision + 1;
    return savedApiCompositeCompareProtocolRevision;
  }

  function nextSavedApiCompositeCompareRequestId(
    label = "request"
  ) {
    savedApiCompositeCompareRequestSequence =
      savedApiCompositeCompareRequestSequence >=
        Number.MAX_SAFE_INTEGER
        ? 1
        : savedApiCompositeCompareRequestSequence + 1;
    return `saved-api-composite-${label}-${savedApiCompositeCompareRequestSequence}`;
  }

  function savedApiCompositeCompareRejectPending(
    reason
  ) {
    for (const pending of
      savedApiCompositeComparePendingRequests.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(reason);
    }
    savedApiCompositeComparePendingRequests.clear();
  }

  function resetSavedApiCompositeCompareClient(
    reason = new Error(
      window.RMLI18n.t("ui.literal.5aae891891cb")
    )
  ) {
    savedApiCompositeCompareStreamQueueGeneration =
      savedApiCompositeCompareStreamQueueGeneration >=
        Number.MAX_SAFE_INTEGER
        ? 1
        : savedApiCompositeCompareStreamQueueGeneration + 1;
    if (savedApiCompositeCompareRefreshFrame) {
      window.cancelAnimationFrame?.(
        savedApiCompositeCompareRefreshFrame
      );
      savedApiCompositeCompareRefreshFrame = 0;
    }
    savedApiCompositeCompareRejectPending(reason);
    savedApiCompositeCompareWorker?.terminate();
    if (
      savedApiCompositeCompareWorkerObjectUrl &&
      typeof URL?.revokeObjectURL === "function"
    ) {
      URL.revokeObjectURL(
        savedApiCompositeCompareWorkerObjectUrl
      );
    }
    savedApiCompositeCompareWorker = null;
    savedApiCompositeCompareWorkerObjectUrl = "";
    savedApiCompositeCompareWorkerEpoch = null;
    savedApiCompositeCompareWorkerActivation = null;
    savedApiCompositeCompareBaselineStates.clear();
    savedApiCompositeCompareCandidateStates.clear();
    savedApiCompositeCompareRevisionByOwnerPath.clear();
    savedApiCompositeCompareAcceptedMutationGeneration =
      0;
    savedApiCompositeCompareCommittedMutationGeneration =
      0;
  }

  function savedApiCompositeComparePostToWorker(
    worker,
    request,
    transfer = []
  ) {
    return new Promise((resolve, reject) => {
      const requestId = request.requestId;
      const timer = window.setTimeout(() => {
        const pending =
          savedApiCompositeComparePendingRequests.get(
            requestId
          );
        if (!pending) return;
        savedApiCompositeComparePendingRequests.delete(
          requestId
        );
        reject(
          new Error(
            window.RMLI18n.t("ui.literal.c9bb1007cf70")
          )
        );
      }, 90 * 1000);
      savedApiCompositeComparePendingRequests.set(
        requestId,
        { resolve, reject, timer }
      );
      try {
        worker.postMessage(request, transfer);
      } catch (error) {
        window.clearTimeout(timer);
        savedApiCompositeComparePendingRequests.delete(
          requestId
        );
        reject(error);
      }
    });
  }

  async function ensureSavedApiCompositeCompareWorker() {
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    if (
      savedApiCompositeCompareWorker &&
      Object.is(
        savedApiCompositeCompareWorkerEpoch,
        projectEpoch
      ) &&
      savedApiCompositeCompareWorkerActivation
    ) {
      await savedApiCompositeCompareWorkerActivation;
      return savedApiCompositeCompareWorker;
    }
    if (savedApiCompositeCompareWorker) {
      resetSavedApiCompositeCompareClient(
        new Error(
          window.RMLI18n.t("ui.literal.593a60856a7f")
        )
      );
    }
    if (typeof Worker !== "function") {
      throw new Error(
        window.RMLI18n.t("ui.literal.f3ee372dcf9c")
      );
    }
    const workerUrl = new URL(
      "js/workers/saved_api_composite_compare_worker.js?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll&canonical-schema=4",
      document.baseURI
    );
    const workerOptions = {
      name: "rml-saved-api-composite-compare"
    };
    let worker = null;
    if (window.location?.protocol === "file:") {
      const bootstrap =
        window.RMLSavedApiCompositeCompareWorkerBootstrap;
      if (
        bootstrap?.moduleId !==
          SAVED_API_COMPOSITE_COMPARE_MODULE_ID ||
        bootstrap?.canonicalSchemaVersion !==
          SAVED_API_COMPOSITE_COMPARE_CANONICAL_SCHEMA_VERSION ||
        typeof bootstrap?.source !== "string" ||
        !bootstrap.source
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.73bff61900d1")
        );
      }
      const objectUrl = URL.createObjectURL(
        new Blob([bootstrap.source], {
          type: "text/javascript"
        })
      );
      try {
        worker = new Worker(
          objectUrl,
          workerOptions
        );
        savedApiCompositeCompareWorkerObjectUrl =
          objectUrl;
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        throw error;
      }
    } else {
      worker = new Worker(
        workerUrl,
        workerOptions
      );
    }
    savedApiCompositeCompareWorker = worker;
    savedApiCompositeCompareWorkerEpoch =
      projectEpoch;
    worker.addEventListener("message", event => {
      const result = event.data;
      if (
        result?.type !==
          SAVED_API_COMPOSITE_COMPARE_RESULT_TYPE ||
        result.moduleId !==
          SAVED_API_COMPOSITE_COMPARE_MODULE_ID
      ) {
        return;
      }
      const pending =
        savedApiCompositeComparePendingRequests.get(
          result.requestId
        );
      if (!pending) return;
      if (
        result.canonicalSchemaVersion !==
          SAVED_API_COMPOSITE_COMPARE_CANONICAL_SCHEMA_VERSION
      ) {
        const error = new Error(
          window.RMLI18n.t("ui.literal.1c85a77d3bbb")
        );
        window.clearTimeout(pending.timer);
        savedApiCompositeComparePendingRequests.delete(
          result.requestId
        );
        pending.reject(error);
        if (savedApiCompositeCompareWorker === worker) {
          resetSavedApiCompositeCompareClient(error);
        }
        return;
      }
      window.clearTimeout(pending.timer);
      savedApiCompositeComparePendingRequests.delete(
        result.requestId
      );
      pending.resolve(result);
    });
    worker.addEventListener("error", event => {
      const error = new Error(
        event.message ||
        window.RMLI18n.t("ui.literal.d889754379c2")
      );
      if (savedApiCompositeCompareWorker === worker) {
        resetSavedApiCompositeCompareClient(error);
      }
      if (!savedApiCompositeCompareUnavailableWarningShown) {
        savedApiCompositeCompareUnavailableWarningShown =
          true;
        console.warn(
          window.RMLI18n.t("ui.literal.23241731e161"),
          error
        );
      }
    });
    const activationRequest = {
      type:
        SAVED_API_COMPOSITE_COMPARE_MESSAGE_TYPE,
      operation: "activate-project-epoch",
      requestId:
        nextSavedApiCompositeCompareRequestId(
          "activate"
        ),
      projectEpoch,
      compositeIdentity:
        "saved-api-composite-controller",
      revision:
        nextSavedApiCompositeCompareProtocolRevision()
    };
    savedApiCompositeCompareWorkerActivation =
      savedApiCompositeComparePostToWorker(
        worker,
        activationRequest
      ).then(result => {
        if (!result?.ok || result.stale) {
          throw new Error(
            result?.error ||
            result?.reason ||
            window.RMLI18n.t("ui.literal.e9043a72bd52")
          );
        }
        return true;
      }).catch(error => {
        if (savedApiCompositeCompareWorker === worker) {
          resetSavedApiCompositeCompareClient(error);
        }
        throw error;
      });
    await savedApiCompositeCompareWorkerActivation;
    if (
      savedApiCompositeCompareWorker === worker &&
      savedApiCompositeCompareWorkerObjectUrl
    ) {
      URL.revokeObjectURL(
        savedApiCompositeCompareWorkerObjectUrl
      );
      savedApiCompositeCompareWorkerObjectUrl = "";
    }
    return worker;
  }

  function savedApiCompositeCompareEnvelope({
    operation,
    projectEpoch,
    compositeIdentity,
    baselineIdentity,
    revision,
    snapshotId,
    targetOperation,
    tokens,
    pageBuffer,
    pageUsedBytes,
    pageTokenCount,
    pageSequence,
    pageEncodingVersion,
    sourceBaselineIdentity,
    normalizationPolicy
  }) {
    return {
      type:
        SAVED_API_COMPOSITE_COMPARE_MESSAGE_TYPE,
      operation,
      requestId:
        nextSavedApiCompositeCompareRequestId(
          operation
        ),
      projectEpoch,
      compositeIdentity,
      baselineIdentity,
      revision,
      ...(snapshotId ? { snapshotId } : {}),
      ...(targetOperation
        ? { targetOperation }
        : {}),
      ...(sourceBaselineIdentity
        ? { sourceBaselineIdentity }
        : {}),
      ...(normalizationPolicy
        ? { normalizationPolicy }
        : {}),
      ...(tokens ? { tokens } : {}),
      ...(pageBuffer
        ? {
            pageBuffer,
            pageUsedBytes,
            pageTokenCount,
            pageSequence,
            pageEncodingVersion
          }
        : {})
    };
  }

  function savedApiCompositeCompareYield() {
    return new Promise(resolve => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "hidden" &&
        typeof window.requestAnimationFrame ===
          "function" &&
        typeof window.requestIdleCallback ===
          "function"
      ) {

        const waitForFrameBudget = () =>
          window.requestAnimationFrame(() => {
            window.requestIdleCallback(deadline => {

              if (
                !deadline.didTimeout &&
                deadline.timeRemaining() >= Math.max(
                  2,
                  SAVED_API_COMPOSITE_COMPARE_IDLE_RESERVE_MS +
                    SAVED_API_COMPOSITE_COMPARE_SENDER_SLICE_MS +
                    0.5
                )
              ) {
                resolve(deadline);
                return;
              }
              waitForFrameBudget();
            }, { timeout: 250 });
          });
        waitForFrameBudget();
        return;
      }
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "hidden" &&
        typeof window.requestAnimationFrame ===
          "function"
      ) {
        window.requestAnimationFrame(() => {

          window.setTimeout(
            () => resolve(null),
            0
          );
        });
        return;
      }
      window.setTimeout(
        () => resolve(null),
        0
      );
    });
  }

  function savedApiCompositeCompareTokenCursor(
    value
  ) {
    return {
      ancestors: new WeakSet(),
      frames: [],
      recycledFrames: [],
      nodeParameterDefaultsByOperatorId:
        new Map(),
      scannedOperatorIds: new Set(),
      hasPendingValue: true,
      pendingValue: value,
      pendingLongKeyValue: undefined,
      code: 0,
      value: undefined
    };
  }

  function savedApiCompositeCompareAcquireCursorFrame(
    cursor,
    kind,
    value
  ) {
    const frame =
      cursor.recycledFrames.pop() || {};
    frame.kind = kind;
    frame.value = value;
    frame.index = 0;
    frame.keys = null;
    frame.keyParts = null;
    frame.keyOffset = 0;
    frame.offset = 0;
    return frame;
  }

  function savedApiCompositeCompareReleaseCursorFrame(
    cursor,
    frame
  ) {
    frame.kind = "";
    frame.value = null;
    frame.index = 0;
    frame.keys = null;
    frame.keyParts = null;
    frame.keyOffset = 0;
    frame.offset = 0;
    cursor.recycledFrames.push(frame);
  }

  function savedApiCompositeCompareRegisterNodePolicy(
    cursor,
    value
  ) {
    const operatorId = String(
      value?.operatorId || ""
    );
    if (
      !operatorId ||
      cursor.scannedOperatorIds.has(operatorId)
    ) {
      return;
    }
    cursor.scannedOperatorIds.add(operatorId);
    const definition =
      typeof OPERATOR_DEFINITIONS === "object" &&
      OPERATOR_DEFINITIONS
        ? OPERATOR_DEFINITIONS[operatorId]
        : null;
    if (
      !definition ||
      typeof definition !== "object"
    ) {
      return;
    }
    const cachedDefaults =
      savedApiCompositeCompareNodeParameterDefaultsByDefinition.get(
        definition
      );
    if (cachedDefaults) {
      if (cachedDefaults.size > 0) {
        cursor.nodeParameterDefaultsByOperatorId.set(
          operatorId,
          cachedDefaults
        );
      }
      return;
    }
    const defaults = new Map();
    const appendDefault = (key, rawValue) => {
      const normalizedKey = String(key || "");
      const value = Number(rawValue);
      if (!normalizedKey || !Number.isFinite(value)) {
        return;
      }
      let values = defaults.get(normalizedKey);
      if (!values) {
        values = new Set();
        defaults.set(normalizedKey, values);
      }
      values.add(value);
    };
    for (const specification of
      Array.isArray(definition.parameters)
        ? definition.parameters
        : []) {
      if (
        specification?.kind !== "number" ||
        typeof specification.key !== "string"
      ) {
        continue;
      }
      appendDefault(
        specification.key,
        specification.default ?? 0
      );
    }
    for (const [parameterKey, descriptor] of [
      [
        "variadicInputCount",
        definition.variadicInputs
      ],
      [
        "variadicOutputCount",
        definition.variadicOutputs
      ]
    ]) {
      if (!descriptor) continue;
      appendDefault(
        parameterKey,
        Math.max(
          2,
          Number(descriptor.defaultCount) ||
            Number(descriptor.minimum) ||
            2
        )
      );
    }
    savedApiCompositeCompareNodeParameterDefaultsByDefinition.set(
      definition,
      defaults
    );
    if (defaults.size > 0) {
      cursor.nodeParameterDefaultsByOperatorId.set(
        operatorId,
        defaults
      );
    }
  }

  function savedApiCompositeCompareNormalizationPolicy(
    cursor
  ) {
    const operatorEntries = [
      ...cursor.nodeParameterDefaultsByOperatorId
        .entries()
    ]
      .sort(([left], [right]) =>
        left.localeCompare(right)
      )
      .map(([operatorId, defaults]) => [
        operatorId,
        [...defaults.entries()]
          .sort(([left], [right]) =>
            left.localeCompare(right)
          )
          .map(([parameterKey, values]) => [
            parameterKey,
            [...values].sort(
              (left, right) => left - right
            )
          ])
      ]);
    return {
      schemaVersion: 1,
      nodeParameterDefaults: operatorEntries
    };
  }

  function savedApiCompositeCompareEmitCursorToken(
    cursor,
    code,
    value = undefined
  ) {
    cursor.code = code;
    cursor.value = value;
    return true;
  }

  function savedApiCompositeCompareNextCursorToken(
    cursor
  ) {
    while (
      cursor.hasPendingValue ||
      cursor.frames.length > 0
    ) {
      if (cursor.hasPendingValue) {
        const value = cursor.pendingValue;
        cursor.pendingValue = undefined;
        cursor.hasPendingValue = false;
        if (Array.isArray(value)) {
          if (cursor.ancestors.has(value)) {
            throw new TypeError(
              window.RMLI18n.t("ui.literal.b988fca5e3d6")
            );
          }
          cursor.ancestors.add(value);
          cursor.frames.push(
            savedApiCompositeCompareAcquireCursorFrame(
              cursor,
              "array",
              value
            )
          );
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.array
          );
        }
        if (value && typeof value === "object") {
          if (cursor.ancestors.has(value)) {
            throw new TypeError(
              window.RMLI18n.t("ui.literal.0bd35deb1077")
            );
          }
          if (
            typeof value.operatorId === "string" &&
            value.operatorId
          ) {
            savedApiCompositeCompareRegisterNodePolicy(
              cursor,
              value
            );
          }
          cursor.ancestors.add(value);
          const frame =
            savedApiCompositeCompareAcquireCursorFrame(
              cursor,
              "object",
              value
            );
          frame.keys = Object.keys(value);
          cursor.frames.push(frame);
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.object
          );
        }
        if (
          typeof value === "string" &&
          value.length >
            SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS
        ) {
          cursor.frames.push(
            savedApiCompositeCompareAcquireCursorFrame(
              cursor,
              "string",
              value
            )
          );
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.string
          );
        }
        if (
          value === null ||
          (
            typeof value === "number" &&
            !Number.isFinite(value)
          )
        ) {
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNull,
            null
          );
        }
        if (value === false || value === true) {
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            value
              ? SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarTrue
              : SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarFalse,
            value
          );
        }
        if (typeof value === "number") {
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNumber,
            value
          );
        }
        if (typeof value === "string") {
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarString,
            value
          );
        }
        throw new TypeError(
          window.RMLI18n.t("ui.literal.037b8d76e529")
        );
      }
      const frame =
        cursor.frames[cursor.frames.length - 1];
      if (frame.kind === "array") {
        if (frame.index >= frame.value.length) {
          cursor.frames.pop();
          cursor.ancestors.delete(frame.value);
          savedApiCompositeCompareReleaseCursorFrame(
            cursor,
            frame
          );
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.end
          );
        }
        const item = frame.value[frame.index];
        frame.index += 1;
        if (
          item === undefined ||
          typeof item === "function" ||
          typeof item === "symbol" ||
          (
            typeof item === "number" &&
            !Number.isFinite(item)
          )
        ) {
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNull,
            null
          );
        }
        cursor.pendingValue = item;
        cursor.hasPendingValue = true;
        continue;
      }
      if (frame.kind === "string") {
        if (frame.offset < frame.value.length) {
          const part = frame.value.slice(
            frame.offset,
            frame.offset +
              SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS
          );
          frame.offset +=
            SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS;
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.stringPart,
            part
          );
        }
        cursor.frames.pop();
        savedApiCompositeCompareReleaseCursorFrame(
          cursor,
          frame
        );
        return savedApiCompositeCompareEmitCursorToken(
          cursor,
          SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.endString
        );
      }
      if (frame.keyParts) {
        if (frame.keyOffset < frame.keyParts.length) {
          const part = frame.keyParts.slice(
            frame.keyOffset,
            frame.keyOffset +
              SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS
          );
          frame.keyOffset +=
            SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS;
          return savedApiCompositeCompareEmitCursorToken(
            cursor,
            SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.keyPart,
            part
          );
        }
        frame.keyParts = null;
        frame.keyOffset = 0;
        cursor.pendingValue =
          cursor.pendingLongKeyValue;
        cursor.hasPendingValue = true;
        cursor.pendingLongKeyValue = undefined;
        return savedApiCompositeCompareEmitCursorToken(
          cursor,
          SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.endKey
        );
      }
      let key = null;
      let item;
      while (frame.index < frame.keys.length) {
        key = frame.keys[frame.index];
        frame.index += 1;
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
        savedApiCompositeCompareReleaseCursorFrame(
          cursor,
          frame
        );
        return savedApiCompositeCompareEmitCursorToken(
          cursor,
          SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.end
        );
      }
      if (
        key.length >
          SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS
      ) {
        cursor.pendingLongKeyValue = item;
        frame.keyParts = key;
        frame.keyOffset = 0;
        return savedApiCompositeCompareEmitCursorToken(
          cursor,
          SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.keyString
        );
      }
      cursor.pendingValue = item;
      cursor.hasPendingValue = true;
      return savedApiCompositeCompareEmitCursorToken(
        cursor,
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.key,
        key
      );
    }
    cursor.code = 0;
    cursor.value = undefined;
    return false;
  }

  function savedApiCompositeComparePageTokenName(
    code
  ) {
    switch (code) {
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.object:
        return "object";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.array:
        return "array";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.end:
        return "end";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.key:
        return "key";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.keyString:
        return "key-string";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.keyPart:
        return "key-part";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.endKey:
        return "end-key";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNull:
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarFalse:
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarTrue:
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNumber:
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarString:
        return "scalar";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.string:
        return "string";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.stringPart:
        return "string-part";
      case SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.endString:
        return "end-string";
      default:
        return `code-${String(code)}`;
    }
  }

  function savedApiCompositeCompareEncodedTokenBytes(
    code,
    value
  ) {
    if (
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNumber
    ) {
      return 9;
    }
    if (
      code === SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.key ||
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.keyPart ||
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarString ||
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.stringPart
    ) {
      return 5 + value.length * 2;
    }
    return 1;
  }

  function savedApiCompositeCompareWritePageString(
    view,
    offset,
    value
  ) {
    view.setUint32(offset, value.length, true);
    offset += 4;
    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {

      view.setUint16(
        offset,
        value.charCodeAt(index),
        true
      );
      offset += 2;
    }
    return offset;
  }

  function savedApiCompositeCompareWritePageToken(
    view,
    offset,
    code,
    value
  ) {
    view.setUint8(offset, code);
    offset += 1;
    if (
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarNumber
    ) {
      view.setFloat64(offset, value, true);
      return offset + 8;
    }
    if (
      code === SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.key ||
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.keyPart ||
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.scalarString ||
      code ===
        SAVED_API_COMPOSITE_COMPARE_PAGE_TOKEN.stringPart
    ) {
      return savedApiCompositeCompareWritePageString(
        view,
        offset,
        value
      );
    }
    return offset;
  }

  function savedApiCompositeCompareCreatePage(
    buffer
  ) {
    if (
      !buffer ||
      buffer.byteLength !==
        SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH
    ) {
      throw new TypeError(
        window.RMLI18n.t("ui.literal.449b6c47fa77")
      );
    }
    return {
      buffer,
      view: new DataView(buffer),
      usedBytes: 0,
      tokenCount: 0
    };
  }

  async function streamSavedApiCompositeComparisonUnlocked({
    value,
    targetOperation,
    compositeIdentity,
    baselineIdentity,
    revision =
      nextSavedApiCompositeCompareProtocolRevision(),
    isCurrent = () => true
  }) {
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    const worker =
      await ensureSavedApiCompositeCompareWorker();
    if (
      worker !== savedApiCompositeCompareWorker ||
      !Object.is(
        projectEpoch,
        savedApiCompositeCompareProjectEpoch()
      ) ||
      !isCurrent()
    ) {
      return null;
    }
    const snapshotId =
      `${compositeIdentity.slice(0, 80)}-${revision}-${nextSavedApiCompositeCompareRequestId("snapshot")}`;
    const send = (
      operation,
      extra = {},
      transfer = []
    ) => savedApiCompositeComparePostToWorker(
      worker,
      savedApiCompositeCompareEnvelope({
        operation,
        projectEpoch,
        compositeIdentity,
        baselineIdentity,
        revision,
        snapshotId,
        ...extra
      }),
      transfer
    );
    const cancel = () => {
      if (
        worker ===
          savedApiCompositeCompareWorker &&
        Object.is(
          projectEpoch,
          savedApiCompositeCompareProjectEpoch()
        )
      ) {
        void send("cancel-snapshot").catch(
          () => undefined
        );
      }
    };
    let begun = null;
    while (true) {
      begun = await send("begin-snapshot", {
        targetOperation
      });
      if (!begun?.backpressure) break;
      await savedApiCompositeCompareYield();
      if (
        worker !== savedApiCompositeCompareWorker ||
        !Object.is(
          projectEpoch,
          savedApiCompositeCompareProjectEpoch()
        ) ||
        !isCurrent()
      ) {
        return null;
      }
    }
    if (
      !begun?.ok ||
      begun.stale ||
      !isCurrent()
    ) {
      cancel();
      return begun || null;
    }
    const tokenCursor =
      savedApiCompositeCompareTokenCursor(value);
    const availablePageBuffers = Array.from(
      {
        length:
          SAVED_API_COMPOSITE_COMPARE_MAX_IN_FLIGHT_PAGES
      },
      () => new ArrayBuffer(
        SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH
      )
    );
    const inFlight = new Set();
    const appendFailures = [];
    let iteratorDone = false;
    let tokenPending = false;
    let currentPage = null;
    let pageSequence = 0;
    let maximumSenderSliceMs = 0;
    let maximumSenderSliceTokens = 0;
    let maximumSenderSliceLastTokenType = "";
    let maximumSenderSliceLastTokenCharacters = 0;
    let maximumSenderSlicePageSequence = 0;
    let maximumPostMessageCallMs = 0;
    let maximumInFlightPages = 0;
    let transferredBytes = 0;
    let transferredTokens = 0;
    let maximumWorkerPageDurationMs = 0;
    let totalWorkerPageDurationMs = 0;
    const transportStartedAt = performance.now();
    const dispatchPage = page => {
      const sequence = pageSequence;
      pageSequence += 1;
      const pageBuffer = page.buffer;
      const postStartedAt = performance.now();
      const appendRequest = send(
        "append-snapshot-page",
        {
          pageBuffer,
          pageUsedBytes: page.usedBytes,
          pageTokenCount: page.tokenCount,
          pageSequence: sequence,
          pageEncodingVersion:
            SAVED_API_COMPOSITE_COMPARE_PAGE_ENCODING_VERSION
        },
        [pageBuffer]
      );
      maximumPostMessageCallMs = Math.max(
        maximumPostMessageCallMs,
        performance.now() - postStartedAt
      );
      transferredBytes += page.usedBytes;
      transferredTokens += page.tokenCount;
      let tracked;
      tracked = appendRequest.then(result => {
        const workerPageDurationMs =
          Number.isFinite(result?.durationMs)
            ? Math.max(0, result.durationMs)
            : 0;
        maximumWorkerPageDurationMs = Math.max(
          maximumWorkerPageDurationMs,
          workerPageDurationMs
        );
        totalWorkerPageDurationMs +=
          workerPageDurationMs;
        const returnedBuffer = result?.pageBuffer;
        if (
          returnedBuffer &&
          returnedBuffer.byteLength ===
            SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH
        ) {
          availablePageBuffers.push(
            returnedBuffer
          );
        } else {
          appendFailures.push({
            reason:
              "transfer-page-credit-not-returned"
          });
        }
        if (!result?.ok || result.stale) {
          appendFailures.push(result);
        }
      }).catch(error => {
        appendFailures.push({ error });
      }).finally(() => {
        inFlight.delete(tracked);
      });
      inFlight.add(tracked);
      maximumInFlightPages = Math.max(
        maximumInFlightPages,
        inFlight.size
      );
    };
    try {
      while (!iteratorDone) {
        const idleDeadline =
          await savedApiCompositeCompareYield();
        if (
          worker !==
            savedApiCompositeCompareWorker ||
          !Object.is(
            projectEpoch,
            savedApiCompositeCompareProjectEpoch()
          ) ||
          !isCurrent()
        ) {
          cancel();
          return null;
        }
        if (appendFailures.length > 0) {
          break;
        }
        if (
          !currentPage &&
          availablePageBuffers.length === 0
        ) {
          await Promise.race(inFlight);
          continue;
        }
        const sliceStarted = performance.now();
        let sliceTokens = 0;
        let lastTokenCode = 0;
        let lastTokenCharacters = 0;
        while (!iteratorDone) {
          if (!currentPage) {
            const buffer =
              availablePageBuffers.pop();
            if (!buffer) break;
            currentPage =
              savedApiCompositeCompareCreatePage(
                buffer
              );
          }
          const hasToken = tokenPending
            ? true
            : savedApiCompositeCompareNextCursorToken(
                tokenCursor
              );
          tokenPending = false;
          if (!hasToken) {
            iteratorDone = true;
            if (currentPage.tokenCount > 0) {
              dispatchPage(currentPage);
            }
            currentPage = null;
            break;
          }
          const encodedBytes =
            savedApiCompositeCompareEncodedTokenBytes(
              tokenCursor.code,
              tokenCursor.value
            );
          lastTokenCode = tokenCursor.code;
          lastTokenCharacters =
            typeof tokenCursor.value === "string"
              ? tokenCursor.value.length
              : 0;
          if (
            encodedBytes >
              SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH
          ) {
            throw new RangeError(
              window.RMLI18n.t("ui.literal.81b1af0c9868")
            );
          }
          if (
            currentPage.usedBytes + encodedBytes >
              SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH
          ) {
            tokenPending = true;
            dispatchPage(currentPage);
            currentPage = null;
            if (
              availablePageBuffers.length === 0
            ) {
              break;
            }
            continue;
          }
          currentPage.usedBytes =
            savedApiCompositeCompareWritePageToken(
              currentPage.view,
              currentPage.usedBytes,
              tokenCursor.code,
              tokenCursor.value
            );
          currentPage.tokenCount += 1;
          sliceTokens += 1;
          if (
            currentPage.usedBytes ===
              SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH
          ) {
            dispatchPage(currentPage);
            currentPage = null;
          }

          if (
            (
              (sliceTokens & 7) === 0 ||
              lastTokenCharacters >=
                SAVED_API_COMPOSITE_COMPARE_STRING_PART_CHARACTERS ||
              !currentPage
            ) &&
            (
              performance.now() - sliceStarted >=
                SAVED_API_COMPOSITE_COMPARE_SENDER_SLICE_MS ||
              (
                idleDeadline &&
                idleDeadline.timeRemaining() <=
                  SAVED_API_COMPOSITE_COMPARE_IDLE_RESERVE_MS
              )
            )
          ) {
            break;
          }
          if (
            !currentPage &&
            availablePageBuffers.length === 0
          ) {
            break;
          }
        }
        const senderSliceMs =
          performance.now() - sliceStarted;
        if (senderSliceMs > maximumSenderSliceMs) {
          maximumSenderSliceMs = senderSliceMs;
          maximumSenderSliceTokens = sliceTokens;
          maximumSenderSliceLastTokenType =
            savedApiCompositeComparePageTokenName(
              lastTokenCode
            );
          maximumSenderSliceLastTokenCharacters =
            lastTokenCharacters;
          maximumSenderSlicePageSequence =
            pageSequence;
        }
        if (
          !iteratorDone &&
          !currentPage &&
          availablePageBuffers.length === 0 &&
          inFlight.size > 0
        ) {
          await Promise.race(inFlight);
        }
      }
      await Promise.all(inFlight);
      if (appendFailures.length > 0) {
        const failure = appendFailures[0];
        throw failure?.error instanceof Error
          ? failure.error
          : new Error(
              failure?.error ||
              failure?.reason ||
              window.RMLI18n.t("ui.literal.c2eaf1674947")
            );
      }
      if (
        worker !==
          savedApiCompositeCompareWorker ||
        !Object.is(
          projectEpoch,
          savedApiCompositeCompareProjectEpoch()
        ) ||
        !isCurrent()
      ) {
        cancel();
        return null;
      }
      const result = await send(
        "finish-snapshot",
        {
          normalizationPolicy:
            savedApiCompositeCompareNormalizationPolicy(
              tokenCursor
            )
        }
      );
      if (
        !isCurrent() ||
        !Object.is(
          projectEpoch,
          savedApiCompositeCompareProjectEpoch()
        )
      ) {
        return null;
      }
      return {
        ...result,
        clientTransport: {
          kind: "transferable-pages",
          pageEncodingVersion:
            SAVED_API_COMPOSITE_COMPARE_PAGE_ENCODING_VERSION,
          pageByteLength:
            SAVED_API_COMPOSITE_COMPARE_PAGE_BYTE_LENGTH,
          pageCount: pageSequence,
          maximumInFlightPages,
          transferredBytes,
          transferredTokens,
          maximumSenderSliceMs,
          maximumSenderSliceTokens,
          maximumSenderSliceLastTokenType,
          maximumSenderSliceLastTokenCharacters,
          maximumSenderSlicePageSequence,
          maximumPostMessageCallMs,
          maximumWorkerPageDurationMs,
          totalWorkerPageDurationMs,
          finishWorkerDurationMs:
            Number.isFinite(result?.durationMs)
              ? Math.max(0, result.durationMs)
              : 0,
          elapsedMs:
            performance.now() - transportStartedAt
        }
      };
    } catch (error) {
      cancel();
      throw error;
    }
  }

  async function streamSavedApiCompositeComparison(
    options
  ) {

    const queueGeneration =
      savedApiCompositeCompareStreamQueueGeneration;
    const queuedProjectEpoch =
      savedApiCompositeCompareProjectEpoch();
    const previous =
      savedApiCompositeCompareStreamTail;
    let release;
    savedApiCompositeCompareStreamTail =
      new Promise(resolve => {
        release = resolve;
      });
    await previous;
    try {
      if (
        queueGeneration !==
          savedApiCompositeCompareStreamQueueGeneration ||
        !Object.is(
          queuedProjectEpoch,
          savedApiCompositeCompareProjectEpoch()
        ) ||
        !(
          typeof options?.isCurrent === "function"
            ? options.isCurrent()
            : true
        )
      ) {
        return null;
      }
      return await streamSavedApiCompositeComparisonUnlocked(
        options
      );
    } finally {
      release();
    }
  }

  async function dropSavedApiCompositeCompareBaseline(
    baselineIdentity,
    compositeIdentity =
      `baseline-drop:${baselineIdentity}`
  ) {
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    const worker =
      await ensureSavedApiCompositeCompareWorker();
    const result =
      await savedApiCompositeComparePostToWorker(
        worker,
        savedApiCompositeCompareEnvelope({
          operation: "drop-baseline",
          projectEpoch,
          compositeIdentity,
          baselineIdentity,
          revision:
            nextSavedApiCompositeCompareProtocolRevision()
        })
      );
    return Boolean(
      result?.ok && !result.stale
    );
  }

  async function promoteSavedApiCompositeCompareBaseline(
    sourceBaselineIdentity,
    record
  ) {
    const recordId = String(record?.id || "");
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    const worker =
      await ensureSavedApiCompositeCompareWorker();
    const result =
      await savedApiCompositeComparePostToWorker(
        worker,
        savedApiCompositeCompareEnvelope({
          operation: "promote-baseline",
          projectEpoch,
          compositeIdentity:
            `saved-record:${recordId}`,
          baselineIdentity: recordId,
          sourceBaselineIdentity,
          revision:
            nextSavedApiCompositeCompareProtocolRevision()
        })
      );
    if (!result?.ok || result.stale) {
      throw new Error(
        result?.error ||
        result?.reason ||
        window.RMLI18n.t("ui.literal.0009fc73c324")
      );
    }
    const state = {
      record,
      recordId,
      projectEpoch,
      status: "installed",
      fingerprint: String(
        result.fingerprint || ""
      ),
      promise: null
    };
    savedApiCompositeCompareBaselineStates.set(
      recordId,
      state
    );
    return state;
  }

  async function savedApiCompositeRecordsExactlyEquivalent(
    leftRecord,
    rightRecord,
    label = "record-compare"
  ) {
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    const operationIdentity =
      `saved-record-exact:${String(label).slice(0, 48)}:${nextSavedApiCompositeCompareRequestId("record")}`;
    const baselineIdentity =
      `${operationIdentity}:baseline`;
    let active = true;
    const isCurrent = () =>
      active &&
      Object.is(
        projectEpoch,
        savedApiCompositeCompareProjectEpoch()
      );
    const install = () =>
      streamSavedApiCompositeComparison({
        value: leftRecord?.composite || {},
        targetOperation: "install-baseline",
        compositeIdentity:
          `${operationIdentity}:install`,
        baselineIdentity,
        revision:
          nextSavedApiCompositeCompareProtocolRevision(),
        isCurrent
      });
    try {
      let installed = await install();
      if (
        !installed?.ok ||
        installed.stale
      ) {
        throw new Error(
          installed?.error ||
          installed?.reason ||
          window.RMLI18n.t("ui.literal.bedec8fdf729")
        );
      }
      let result =
        await streamSavedApiCompositeComparison({
          value: rightRecord?.composite || {},
          targetOperation: "compare",
          compositeIdentity:
            `${operationIdentity}:candidate`,
          baselineIdentity,
          revision:
            nextSavedApiCompositeCompareProtocolRevision(),
          isCurrent
        });
      if (
        result &&
        !result.ok &&
        !result.stale &&
        result.reason ===
          "baseline-not-installed"
      ) {

        installed = await install();
        if (
          !installed?.ok ||
          installed.stale
        ) {
          throw new Error(
            installed?.error ||
            installed?.reason ||
            window.RMLI18n.t("ui.literal.f5fb6395643a")
          );
        }
        result =
          await streamSavedApiCompositeComparison({
            value:
              rightRecord?.composite || {},
            targetOperation: "compare",
            compositeIdentity:
              `${operationIdentity}:candidate-retry`,
            baselineIdentity,
            revision:
              nextSavedApiCompositeCompareProtocolRevision(),
            isCurrent
          });
      }
      if (!result?.ok || result.stale) {
        throw new Error(
          result?.error ||
          result?.reason ||
          window.RMLI18n.t("ui.literal.3fbe819e6d80")
        );
      }
      return result.equivalent === true;
    } finally {
      active = false;
      try {
        await dropSavedApiCompositeCompareBaseline(
          baselineIdentity,
          `${operationIdentity}:cleanup`
        );
      } catch {

      }
    }
  }

  async function savedApiCompositeRecordWithWorkerFingerprint(
    record,
    label = "record"
  ) {
    const projectEpoch =
      savedApiCompositeCompareProjectEpoch();
    const operationIdentity =
      `saved-record-fingerprint:${String(label).slice(0, 48)}:${nextSavedApiCompositeCompareRequestId("fingerprint")}`;
    const result =
      await streamSavedApiCompositeComparison({
        value: record?.composite || {},
        targetOperation: "fingerprint",
        compositeIdentity:
          operationIdentity,
        baselineIdentity:
          operationIdentity,
        revision:
          nextSavedApiCompositeCompareProtocolRevision(),
        isCurrent: () => Object.is(
          projectEpoch,
          savedApiCompositeCompareProjectEpoch()
        )
      });
    if (
      !result?.ok ||
      result.stale ||
      !String(result.fingerprint || "")
    ) {
      throw new Error(
        result?.error ||
        result?.reason ||
        window.RMLI18n.t("ui.literal.80485de2f3f8")
      );
    }
    const fingerprint = String(
      result.fingerprint
    );
    const next = {
      ...record,
      contentFingerprint: fingerprint,
      composite: {
        ...(record?.composite || {}),
        contentFingerprint: fingerprint
      }
    };
    if (
      record?.[
        SAVED_API_COMPOSITE_LEGACY_FINGERPRINT
      ] === true
    ) {
      Object.defineProperty(
        next,
        SAVED_API_COMPOSITE_LEGACY_FINGERPRINT,
        {
          value: true,
          enumerable: false,
          configurable: false
        }
      );
    }
    return next;
  }

  function savedApiCompositeCompareRecordChanged(
    recordId,
    record = null
  ) {
    const normalizedId = String(
      recordId || record?.id || ""
    );
    if (!normalizedId) return;
    savedApiCompositeCompareBaselineStates.delete(
      normalizedId
    );
    for (const [identity, state] of
      savedApiCompositeCompareCandidateStates) {
      if (state.recordId === normalizedId) {
        savedApiCompositeCompareCandidateStates.delete(
          identity
        );
      }
    }
  }

  function savedApiCompositeCompareRecordsCleared() {
    savedApiCompositeCompareBaselineStates.clear();
    savedApiCompositeCompareCandidateStates.clear();
  }

  function savedApiCompositeCompareOwnerPathKey(
    ownerPath
  ) {
    return (Array.isArray(ownerPath)
      ? ownerPath
      : [])
      .map(value =>
        encodeURIComponent(String(value || ""))
      )
      .join("/");
  }

  function savedApiCompositeCompareDocumentRevision(
    composite,
    ownerPath = null
  ) {
    const objectRevision =
      composite && typeof composite === "object"
        ? savedApiCompositeCompareRevisionByDocument.get(
            composite
          ) || 0
        : 0;
    const pathKey =
      savedApiCompositeCompareOwnerPathKey(
        ownerPath
      );
    const pathRevision = pathKey
      ? savedApiCompositeCompareRevisionByOwnerPath.get(
          pathKey
        ) || 0
      : 0;
    return Math.max(
      objectRevision,
      pathRevision
    );
  }

  function savedApiCompositeCompareCandidateIdentity(
    record,
    context
  ) {
    return `${String(record?.id || "")}\u0000${(
      Array.isArray(context?.path)
        ? context.path
        : [context?.owner?.id || ""]
    ).map(value =>
      encodeURIComponent(String(value || ""))
    ).join("/")}`;
  }

  function savedApiCompositeCompareCandidateSnapshot(
    context
  ) {
    const composite = context?.composite || {};
    return composite;
  }

  function savedApiCompositeCompareCandidateDescriptor(
    context
  ) {
    const composite = context?.composite || {};
    const owner = context?.owner || {};
    return `${savedApiCompositeCurrentName(
      owner,
      composite
    )}\u0000${
      owner.parameters?.portLayout === "mirrored"
        ? "mirrored"
        : "standard"
    }`;
  }

  async function ensureSavedApiCompositeCompareBaseline(
    record
  ) {
    const recordId = String(record?.id || "");
    const projectEpoch =
      synchronizeSavedApiCompositeCompareProjectEpoch();
    const previous =
      savedApiCompositeCompareBaselineStates.get(
        recordId
      );
    if (
      previous?.record === record &&
      Object.is(previous.projectEpoch, projectEpoch)
    ) {
      if (previous.status === "installed") {
        return previous;
      }
      if (
        previous.status === "pending" &&
        previous.promise
      ) {
        return previous.promise;
      }
    }
    const state = {
      record,
      recordId,
      projectEpoch,
      status: "pending",
      fingerprint: "",
      promise: null
    };
    savedApiCompositeCompareBaselineStates.set(
      recordId,
      state
    );
    const revision =
      nextSavedApiCompositeCompareProtocolRevision();
    const isCurrent = () =>
      savedApiCompositeCompareBaselineStates.get(
        recordId
      ) === state &&
      savedApiCompositeTemplates.get(recordId) ===
        record &&
      Object.is(
        projectEpoch,
        savedApiCompositeCompareProjectEpoch()
      );
    state.promise =
      streamSavedApiCompositeComparison({
        value: record.composite,
        targetOperation: "install-baseline",
        compositeIdentity:
          `saved-record:${recordId}`,
        baselineIdentity: recordId,
        revision,
        isCurrent
      }).then(result => {
        if (!isCurrent()) return null;
        if (!result?.ok || result.stale) {
          throw new Error(
            result?.error ||
            result?.reason ||
            window.RMLI18n.t("ui.literal.84db672cbdf8")
          );
        }
        state.status = "installed";
        state.fingerprint = String(
          result.fingerprint || ""
        );
        state.promise = null;
        return state;
      }).catch(error => {
        if (isCurrent()) {
          state.status = "error";
          state.error = error;
          state.failedAt = Date.now();
          state.promise = null;
        }
        throw error;
      });
    return state.promise;
  }

  function scheduleSavedApiCompositeCompareUiRefresh() {
    if (
      savedApiCompositeCompareRefreshFrame ||
      typeof document === "undefined"
    ) {
      return;
    }
    const refresh = () => {
      savedApiCompositeCompareRefreshFrame = 0;
      if (
        typeof dom !== "undefined" &&
        typeof refreshVisibleSavedApiCompositeUpdateActions ===
          "function"
      ) {
        refreshVisibleSavedApiCompositeUpdateActions();
      }
      if (
        typeof dom !== "undefined" &&
        typeof refreshVisibleApiCompositeInspectorSaveActions ===
          "function"
      ) {
        refreshVisibleApiCompositeInspectorSaveActions();
      }
    };
    if (
      typeof window.requestAnimationFrame ===
        "function"
    ) {
      savedApiCompositeCompareRefreshFrame =
        window.requestAnimationFrame(refresh);
    } else {
      window.RMLScheduleTask(refresh);
    }
  }

  function ensureSavedApiCompositeInstanceComparison(
    record,
    context
  ) {
    if (
      savedApiCompositeCompareAcceptedMutationGeneration !==
        savedApiCompositeCompareCommittedMutationGeneration
    ) {
      return SAVED_API_COMPOSITE_ACCEPTED_MUTATION_PENDING_STATE;
    }
    const recordId = String(record?.id || "");
    const projectEpoch =
      synchronizeSavedApiCompositeCompareProjectEpoch();
    const composite = context?.composite;
    const identity =
      savedApiCompositeCompareCandidateIdentity(
        record,
        context
      );
    const dataRevision =
      savedApiCompositeCompareDocumentRevision(
        composite,
        context?.path
      );
    const candidateDescriptor =
      savedApiCompositeCompareCandidateDescriptor(
        context
      );
    const acceptGeneration =
      savedApiCompositeCompareAcceptedMutationGeneration;
    const previous =
      savedApiCompositeCompareCandidateStates.get(
        identity
      );
    if (
      previous?.record === record &&
      previous.composite === composite &&
      previous.dataRevision === dataRevision &&
      previous.candidateDescriptor ===
        candidateDescriptor &&
      Object.is(previous.projectEpoch, projectEpoch) &&
      (
        previous.status !== "pending" ||
        previous.acceptGeneration ===
          acceptGeneration
      ) &&
      (
        previous.status !== "error" ||
        Date.now() -
          Number(previous.failedAt || 0) <
          5000
      )
    ) {
      return previous;
    }
    const state = {
      identity,
      record,
      recordId,
      composite,
      owner: context?.owner || null,
      path: Array.isArray(context?.path)
        ? [...context.path]
        : [],
      projectEpoch,
      dataRevision,
      candidateDescriptor,
      acceptGeneration,
      status: "pending",
      equivalent: null,
      candidateFingerprint: "",
      baselineFingerprint: "",
      failedAt: 0
    };
    savedApiCompositeCompareCandidateStates.set(
      identity,
      state
    );
    const isCurrent = () =>
      savedApiCompositeCompareCandidateStates.get(
        identity
      ) === state &&
      savedApiCompositeTemplates.get(recordId) ===
        record &&
      savedApiCompositeCompareDocumentRevision(
        composite,
        context?.path
      ) === dataRevision &&
      savedApiCompositeCompareCandidateDescriptor(
        context
      ) === candidateDescriptor &&
      savedApiCompositeCompareAcceptedMutationGeneration ===
        acceptGeneration &&
      savedApiCompositeCompareCommittedMutationGeneration ===
        acceptGeneration &&
      Object.is(
        projectEpoch,
        savedApiCompositeCompareProjectEpoch()
      );
    const run = async () => {
      await ensureSavedApiCompositeCompareBaseline(
        record
      );
      if (!isCurrent()) return;
      let result =
        await streamSavedApiCompositeComparison({
          value:
            savedApiCompositeCompareCandidateSnapshot(
              context
            ),
          targetOperation: "compare",
          compositeIdentity: identity,
          baselineIdentity: recordId,
          revision:
            nextSavedApiCompositeCompareProtocolRevision(),
          isCurrent
        });
      if (
        isCurrent() &&
        result &&
        !result.ok &&
        !result.stale &&
        result.reason === "baseline-not-installed"
      ) {
        savedApiCompositeCompareBaselineStates.delete(
          recordId
        );
        await ensureSavedApiCompositeCompareBaseline(
          record
        );
        if (!isCurrent()) return;
        result =
          await streamSavedApiCompositeComparison({
            value:
              savedApiCompositeCompareCandidateSnapshot(
                context
              ),
            targetOperation: "compare",
            compositeIdentity: identity,
            baselineIdentity: recordId,
            revision:
              nextSavedApiCompositeCompareProtocolRevision(),
            isCurrent
          });
      }
      if (!isCurrent() || !result) return;
      if (!result.ok || result.stale) {
        throw new Error(
          result.error ||
          result.reason ||
          window.RMLI18n.t("ui.literal.dcd3c8d9c7b0")
        );
      }
      state.status = result.equivalent
        ? "equal"
        : "different";
      state.equivalent =
        result.equivalent === true;
      state.candidateFingerprint = String(
        result.candidateFingerprint || ""
      );
      state.baselineFingerprint = String(
        result.baselineFingerprint || ""
      );
      scheduleSavedApiCompositeCompareUiRefresh();
    };
    void run().catch(error => {
      if (!isCurrent()) return;
      state.status = "error";
      state.error = error;
      state.failedAt = Date.now();
      scheduleSavedApiCompositeCompareUiRefresh();
      if (!savedApiCompositeCompareUnavailableWarningShown) {
        savedApiCompositeCompareUnavailableWarningShown =
          true;
        console.warn(
          window.RMLI18n.t("ui.literal.b57f9671dd89"),
          error
        );
      }
    });
    return state;
  }

  function savedApiCompositeInstanceComparisonStatus(
    record,
    context
  ) {
    if (
      savedApiCompositeCompareAcceptedMutationGeneration !==
        savedApiCompositeCompareCommittedMutationGeneration
    ) {
      return "pending";
    }
    return ensureSavedApiCompositeInstanceComparison(
      record,
      context
    ).status;
  }

  function beginSavedApiCompositeCompareMutation({
    nodes = null,
    document: documentValue = null,
    ownerPath = null,
    mutationClass = "content"
  } = {}) {

    if (
      String(mutationClass || "")
        .trim()
        .toLowerCase() === "view"
    ) {
      return savedApiCompositeCompareAcceptedMutationGeneration;
    }
    void nodes;
    void documentValue;
    void ownerPath;
    savedApiCompositeCompareAcceptedMutationGeneration =
      savedApiCompositeCompareAcceptedMutationGeneration >=
        Number.MAX_SAFE_INTEGER
        ? 1
        : savedApiCompositeCompareAcceptedMutationGeneration + 1;
    scheduleSavedApiCompositeCompareUiRefresh();
    return savedApiCompositeCompareAcceptedMutationGeneration;
  }

  function rejectSavedApiCompositeCompareMutation({
    generation = null
  } = {}) {
    const rejectedGeneration = Math.trunc(
      Number(generation) || 0
    );
    if (
      rejectedGeneration <= 0 ||
      rejectedGeneration !==
        savedApiCompositeCompareAcceptedMutationGeneration
    ) {
      return false;
    }

    savedApiCompositeCompareCommittedMutationGeneration =
      savedApiCompositeCompareAcceptedMutationGeneration;
    savedApiCompositeCompareCandidateStates.clear();
    scheduleSavedApiCompositeCompareUiRefresh();
    return true;
  }

  function markSavedApiCompositeCompareMutation({
    nodes = null,
    document: documentValue = null,
    ownerPath = null,
    mutationClass = "content"
  } = {}) {

    if (
      String(mutationClass || "")
        .trim()
        .toLowerCase() === "view"
    ) {
      return 0;
    }
    const releasedAcceptedMutation =
      savedApiCompositeCompareCommittedMutationGeneration !==
        savedApiCompositeCompareAcceptedMutationGeneration;

    savedApiCompositeCompareCommittedMutationGeneration =
      savedApiCompositeCompareAcceptedMutationGeneration;
    const affected = new Map();
    const addAffected = (
      composite,
      affectedOwnerPath
    ) => {
      const normalizedPath =
        (Array.isArray(affectedOwnerPath)
          ? affectedOwnerPath
          : []).map(value =>
          String(value || "")
        );
      const pathKey =
        savedApiCompositeCompareOwnerPathKey(
          normalizedPath
        );
      if (!pathKey) return;
      affected.set(pathKey, {
        composite:
          composite &&
          typeof composite === "object"
            ? composite
            : null,
        ownerPath: normalizedPath
      });
    };
    const addOpenCompositeChain = () => {
      if (
        typeof openApiCompositeOwnerContexts !==
          "function"
      ) {
        return;
      }
      for (const context of
        openApiCompositeOwnerContexts()) {
        if (context?.composite) {
          addAffected(
            context.composite,
            context.ownerPath || context.path
          );
        }
      }
    };
    if (
      nodes &&
      typeof graph !== "undefined" &&
      nodes === graph?.nodes
    ) {
      addOpenCompositeChain();
    }
    if (documentValue) {
      if (
        typeof savedApiCompositeInstanceContexts ===
          "function"
      ) {
        const contexts =
          savedApiCompositeInstanceContexts();
        for (const context of contexts) {
          const path = Array.isArray(context.path)
            ? context.path
            : [];
          if (
            context.composite === documentValue ||
            context.composite?.nodes === nodes
          ) {
            for (const ancestor of contexts) {
              if (
                ancestor.path.length <= path.length &&
                ancestor.path.every(
                  (value, index) =>
                    value === path[index]
                )
              ) {
                addAffected(
                  ancestor.composite,
                  ancestor.path
                );
              }
            }
          }
        }
      }
    }
    const normalizedOwnerPath =
      (Array.isArray(ownerPath)
        ? ownerPath
        : []).map(value =>
        String(value || "")
      ).filter(Boolean);
    if (normalizedOwnerPath.length > 0) {
      const contexts =
        typeof savedApiCompositeInstanceContexts ===
          "function"
          ? savedApiCompositeInstanceContexts()
          : [];
      for (
        let length = 1;
        length <= normalizedOwnerPath.length;
        length += 1
      ) {
        const ancestorPath =
          normalizedOwnerPath.slice(0, length);
        const context = contexts.find(candidate =>
          candidate.path.length === length &&
          candidate.path.every(
            (value, index) =>
              value === ancestorPath[index]
          )
        );
        addAffected(
          context?.composite ||
            (length === normalizedOwnerPath.length
              ? documentValue
              : null),
          ancestorPath
        );
      }
    }
    if (affected.size === 0) {
      if (releasedAcceptedMutation) {
        scheduleSavedApiCompositeCompareUiRefresh();
      }
      return 0;
    }
    savedApiCompositeCompareDocumentRevisionSequence =
      savedApiCompositeCompareDocumentRevisionSequence >=
        Number.MAX_SAFE_INTEGER
        ? 1
        : savedApiCompositeCompareDocumentRevisionSequence + 1;
    for (const [pathKey, entry] of affected) {
      if (entry.composite) {
        savedApiCompositeCompareRevisionByDocument.set(
          entry.composite,
          savedApiCompositeCompareDocumentRevisionSequence
        );
      }
      savedApiCompositeCompareRevisionByOwnerPath.set(
        pathKey,
        savedApiCompositeCompareDocumentRevisionSequence
      );
    }
    scheduleSavedApiCompositeCompareUiRefresh();
    return affected.size;
  }

  Object.defineProperty(
    window,
    "RMLSavedApiCompositeDirtyTracker",
    {
      value: Object.freeze({
        moduleId:
          SAVED_API_COMPOSITE_COMPARE_MODULE_ID,
        canonicalSchemaVersion:
          SAVED_API_COMPOSITE_COMPARE_CANONICAL_SCHEMA_VERSION,
        beginMutation:
          beginSavedApiCompositeCompareMutation,
        rejectMutation:
          rejectSavedApiCompositeCompareMutation,
        markMutation:
          markSavedApiCompositeCompareMutation,
        recordChanged:
          savedApiCompositeCompareRecordChanged,
        reset:
          resetSavedApiCompositeCompareClient,
        streamSnapshot:
          streamSavedApiCompositeComparison,
        candidateStatus:
          savedApiCompositeInstanceComparisonStatus
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

function markCommittedGraphMutation({
    nodes = typeof graph === "undefined"
      ? null
      : graph?.nodes,
    document: committedDocument = null,
    ownerPath = null,
    mutationClass = "topology"
  } = {}) {

    const normalizedMutationClass =
      [
        "view",
        "geometry",
        "parameter",
        "topology",
        "boundary"
      ].includes(mutationClass)
        ? mutationClass
        : "topology";
    const normalizedOwnerPath =
      Array.isArray(ownerPath)
        ? ownerPath.map(value =>
            String(value || "")
          ).filter(Boolean)
        : typeof apiCompositeEditor !==
              "undefined" &&
            apiCompositeEditor
          ? apiCompositeEditorOwnerPath(
              apiCompositeEditor
            )
          : [];
    const affected =
      normalizedMutationClass === "view"
        ? 0
        : window.RMLSavedApiCompositeDirtyTracker
          ?.markMutation?.({
            nodes: Array.isArray(nodes)
              ? nodes
              : null,
            document:
              committedDocument &&
              typeof committedDocument === "object"
                ? committedDocument
                : null,
            ownerPath:
              normalizedOwnerPath,
            mutationClass:
              normalizedMutationClass
          }) || 0;
    acknowledgeApiCompositeGraphDocumentCommit({
      nodes,
      ownerPath: normalizedOwnerPath,
      mutationClass:
        normalizedMutationClass
    });
    if (
      typeof acknowledgeCustomCSharpGraphDocumentCommit ===
        "function"
    ) {
      acknowledgeCustomCSharpGraphDocumentCommit({
        nodes,
        document: committedDocument,
        ownerPath: normalizedOwnerPath,
        mutationClass:
          normalizedMutationClass
      });
    }
    return affected;
  }

function acknowledgeApiCompositeGraphDocumentCommit({
    nodes = null,
    ownerPath = [],
    mutationClass = "topology"
  } = {}) {
    if (
      !apiCompositeEditor ||
      typeof apiCompositeEditorChain !==
        "function"
    ) {
      return false;
    }
    const committedPath =
      (Array.isArray(ownerPath)
        ? ownerPath
        : []).map(value =>
        String(value || "")
      ).filter(Boolean);
    if (committedPath.length === 0) {
      return false;
    }
    let acknowledged = false;
    for (const editor of
      apiCompositeEditorChain(
        apiCompositeEditor
      )) {
      const editorPath =
        apiCompositeEditorOwnerPath(
          editor
        );
      const ownsCommittedPath =
        editorPath.length <=
          committedPath.length &&
        editorPath.every(
          (value, index) =>
            value === committedPath[index]
        );
      if (!ownsCommittedPath) continue;
      if (mutationClass !== "view") {
        const revision = Number(
          editor.contentMutationRevision
        );
        if (Number.isFinite(revision)) {
          editor.contentMutationRevisionAtOpen =
            revision;
          acknowledged = true;
        }
      }
      if (
        editor === apiCompositeEditor &&
        !customCSharpEditor &&
        nodes === graph?.nodes &&
        editorPath.length ===
          committedPath.length
      ) {
        editor.openViewState =
          apiCompositeEditorViewState(
            graph
          );
        acknowledged = true;
      }
    }
    return acknowledged;
  }

  const savedApiCompositePreSanitizeOmissions =
    new WeakMap();

  function savedApiCompositePaintOpportunity() {
    return new Promise(resolve => {
      const finish = () =>
        window.RMLScheduleTask(resolve);
      if (
        typeof document === "undefined" ||
        document.hidden ||
        typeof requestProjectAnimationFrame !==
          "function"
      ) {
        finish();
        return;
      }
      requestProjectAnimationFrame(() => {
        requestProjectAnimationFrame(finish);
      });
    });
  }

  function yieldSavedApiCompositeTask() {
    return new Promise(resolve =>
      window.RMLScheduleTask(resolve)
    );
  }

function savedApiCompositeSourceGraph(
    value
  ) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }
    if (
      value.composite &&
      typeof value.composite === "object" &&
      !Array.isArray(value.composite)
    ) {
      return value.composite;
    }
    if (
      value.content &&
      typeof value.content === "object" &&
      !Array.isArray(value.content)
    ) {
      return value.content;
    }
    return value;
  }

function savedApiCompositeIncompleteApiIdentity(
    node
  ) {
    if (node?.kind !== "operator") {
      return false;
    }
    const operatorId = String(
      node.operatorId || ""
    );
    const definition =
      OPERATOR_DEFINITIONS[operatorId];
    const verifiedContract =
      definition?.catalogGenerated ===
        true &&
      definition.apiVerification &&
      typeof definition.apiVerification ===
        "object" &&
      !Array.isArray(
        definition.apiVerification
      )
        ? definition.apiVerification
        : null;
    const storedContract = [
      verifiedContract,
      node.apiContract,
      definition?.preservedApiContract
    ].find(candidate =>
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      String(
        candidate.ownerType || ""
      ).trim() &&
      String(candidate.kind || "")
        .trim()
    ) || null;
    const apiShaped = Boolean(
      operatorId.startsWith("api.") ||
      node.apiContract ||
      definition?.catalogGenerated === true ||
      definition?.unavailableApiContract ===
        true ||
      definition?.customCSharpCatalogNode ===
        true
    );
    if (!apiShaped) {
      return false;
    }
    return !(
      String(
        storedContract?.ownerType || ""
      ).trim() &&
      String(storedContract?.kind || "")
        .trim()
    );
  }

function savedApiCompositePreSanitizeRemovalPlans(
    graphDocument
  ) {
    const plans = [];
    const visited = new WeakSet();
    const append = (
      candidate,
      path = "runtime-root"
    ) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        visited.has(candidate) ||
        !Array.isArray(candidate.nodes) ||
        !Array.isArray(
          candidate.connections
        )
      ) {
        return;
      }
      visited.add(candidate);
      for (const node of candidate.nodes) {
        if (
          !savedApiCompositeIncompleteApiIdentity(
            node
          )
        ) {
          continue;
        }
        plans.push({
          path,
          nodeId: String(node.id || ""),
          removeNode: true
        });
      }
      const customFiles =
        candidate.customCSharpFiles &&
        typeof candidate.customCSharpFiles ===
          "object" &&
        !Array.isArray(
          candidate.customCSharpFiles
        )
          ? candidate.customCSharpFiles
          : {};
      for (const [ownerId, customGraph] of
        Object.entries(customFiles)) {
        append(
          customGraph,
          `${path}/custom-csharp:${String(ownerId || "<unnamed>")}`
        );
      }
      const composites =
        candidate.apiCompositeGraphs &&
        typeof candidate.apiCompositeGraphs ===
          "object" &&
        !Array.isArray(
          candidate.apiCompositeGraphs
        )
          ? candidate.apiCompositeGraphs
          : {};
      for (const [ownerId, composite] of
        Object.entries(composites)) {
        append(
          composite,
          `${path}/api-composite:${String(ownerId || "<unnamed>")}`
        );
      }
    };
    append(graphDocument);
    return plans;
  }

function savedApiCompositeOmissionDetails(
    values
  ) {
    const result = new Map();
    for (const raw of
      Array.isArray(values) ? values : []) {
      const path = String(
        raw?.path || "runtime-root"
      );
      const nodeId = String(
        raw?.nodeId || ""
      );
      if (!nodeId) continue;
      const key = `${path}\u0000${nodeId}`;
      const existing = result.get(key);
      const disconnected = new Map();
      for (const value of [
        ...(existing
          ?.disconnectedConnectionIds || []),
        ...(Array.isArray(
          raw?.disconnectedConnectionIds
        )
          ? raw.disconnectedConnectionIds
          : [])
      ]) {
        const connectionPath = String(
          typeof value === "string"
            ? path
            : value?.path || path
        );
        const connectionId = String(
          typeof value === "string"
            ? value
            : value?.connectionId || ""
        );
        if (!connectionId) continue;
        disconnected.set(
          `${connectionPath}\u0000${connectionId}`,
          {
            path: connectionPath,
            connectionId
          }
        );
      }
      result.set(key, {
        path,
        nodeId,
        nodeName: String(
          existing?.nodeName ||
          raw?.nodeName ||
          raw?.label ||
          nodeId ||
          raw?.operatorId ||
          "Unavailable API node"
        ),
        operatorId: String(
          existing?.operatorId ||
          raw?.operatorId ||
          ""
        ),
        disconnectedConnectionIds: [
          ...disconnected.values()
        ]
      });
    }
    return [...result.values()];
  }

function sanitizeSavedApiCompositeImportRecord(
    raw,
    options
  ) {
    const sourceGraph =
      savedApiCompositeSourceGraph(raw);
    const plans =
      savedApiCompositePreSanitizeRemovalPlans(
        sourceGraph
      );
    if (plans.length === 0) {
      return sanitizeSavedApiCompositeRecord(
        raw,
        options
      );
    }

    savedApiCompositeGraphStats(sourceGraph);
    const recoveredSource =
      nodeGraphClone(raw);
    const recoveredGraph =
      savedApiCompositeSourceGraph(
        recoveredSource
      );
    const apply =
      window.RMLDynamicGraphHost
        ?.applyCatalogMigrationsPreservingGeometry;
    if (typeof apply !== "function") {
      throw new Error(
        window.RMLI18n.t("ui.literal.8a41ecb818e2")
      );
    }
    let transaction = null;
    try {
      transaction = apply(
        recoveredGraph,
        {},
        {},
        plans
      );
      const record =
        sanitizeSavedApiCompositeRecord(
          recoveredSource,
          options
        );
      transaction.assertGeometry();
      const omissions =
        savedApiCompositeOmissionDetails(
          transaction.removedNodeDetails
        );
      transaction.commit();
      if (omissions.length > 0) {
        savedApiCompositePreSanitizeOmissions.set(
          record,
          Object.freeze(
            nodeGraphClone(omissions)
          )
        );
      }
      return record;
    } catch (error) {
      transaction?.rollback?.();
      throw error;
    }
  }

function apiCompositeCatalogAvailable() {
    const catalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    const report =
      window.RMLApiNodeFactoryReport ||
      null;
    return Boolean(
      catalogFactoryIdentityMatches(
        catalog,
        report
      )
    );
  }

function savedApiCompositeIdentifier() {
    const random =
      globalThis.crypto?.randomUUID?.();
    return `saved-api-composite-${
      random ||
      `${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 12)}`
    }`;
  }

function savedApiCompositeCanonicalValue(
    value
  ) {
    if (Array.isArray(value)) {
      return value.map(item =>
        savedApiCompositeCanonicalValue(
          item
        )
      );
    }
    if (
      value &&
      typeof value === "object"
    ) {
      return Object.fromEntries(
        Object.keys(value)
          .sort()
          .map(key => [
            key,
            savedApiCompositeCanonicalValue(
              value[key]
            )
          ])
      );
    }
    return value;
  }

const SAVED_API_COMPOSITE_NAVIGATION_FINGERPRINT_IGNORED_KEYS = new Set([
  "viewport",
  "selectedNodeId",
  "selectedNodeIds",
  "selectedConnectionId",
  "selectedWirePoint",
  "nextSequence",
  "revision",
  "contentFingerprint",
  "fingerprintNameKey",
  "fingerprintPortLayout",
  "fingerprintNestedSignature",
  "catalogFingerprint",
  "catalogEngineVersion",
  "catalogSource",
  "catalogDefinitionRevision",
  "coordinateSpaceVersion",
  "savedApiCompositeUpdatedAt"
]);

function savedApiCompositeNavigationFingerprintValue(value) {
  if (Array.isArray(value)) {
    return value.map(item =>
      savedApiCompositeNavigationFingerprintValue(item)
    );
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (SAVED_API_COMPOSITE_NAVIGATION_FINGERPRINT_IGNORED_KEYS.has(key)) {
        continue;
      }
      const item = value[key];
      if (item === undefined || typeof item === "function" || typeof item === "symbol") {
        continue;
      }
      result[key] = savedApiCompositeNavigationFingerprintValue(item);
    }
    return result;
  }
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function savedApiCompositeNavigationFingerprint(value) {
  return JSON.stringify(
    savedApiCompositeNavigationFingerprintValue(value || {})
  );
}

function apiCompositeEditorCurrentContentFingerprint(
  editor = apiCompositeEditor,
  view = graph
) {
  const documentValue = apiCompositeEditorDocument(editor) || {};
  const viewValue = view && Array.isArray(view.nodes) && Array.isArray(view.connections)
    ? graphViewFrom(view)
    : {};
  return savedApiCompositeNavigationFingerprint({
    ...documentValue,
    ...viewValue
  });
}

function savedApiCompositeNameKey(value) {
    return window.RMLCrypto.normalizeName(
      value
    );
  }

function savedApiCompositeCurrentName(
    node,
    composite
  ) {
    for (const candidate of [
      node?.label,
      node?.parameters?.title,
      composite?.title
    ]) {
      const name = String(
        candidate || ""
      ).trim().slice(0, 120);
      if (name) return name;
    }
    return "Saved API Composite";
  }

function savedApiCompositeNodeNameKeys(
    node,
    composite
  ) {
    const nameKey =
      savedApiCompositeNameKey(
        savedApiCompositeCurrentName(
          node,
          composite
        )
      );
    return new Set(
      nameKey ? [nameKey] : []
    );
  }

function savedApiCompositeNodeMatchesName(
    node,
    composite,
    name
  ) {
    const nameKey =
      savedApiCompositeNameKey(name);
    return Boolean(
      nameKey &&
      savedApiCompositeNodeNameKeys(
        node,
        composite
      ).has(nameKey)
    );
  }

function openApiCompositeOwnerContext(
    editor =
      typeof apiCompositeEditor !==
        "undefined"
        ? apiCompositeEditor
        : null
  ) {
    if (
      !editor ||
      typeof graph === "undefined" ||
      !graph
    ) {
      return null;
    }
    const ownerId = String(
      editor.containerNodeId ||
      ""
    );
    const ownerPath =
      apiCompositeEditorOwnerPath(
        editor
      );
    const parentDocument =
      apiCompositeParentDocumentForOwnerPath(
        ownerPath
      );
    const resolvedParentDocument =
      ownerPath.length === 1
        ? {
            ...outermostApiCompositeEditor()
              ?.mainView,
            apiCompositeGraphs:
              graph.apiCompositeGraphs || {},
            customCSharpFiles:
              graph.customCSharpFiles || {},
            branchRouting:
              graph.branchRouting || {}
          }
        : parentDocument;
    const owner =
      editor.mainView?.nodes
        ?.find(node =>
          String(node?.id || "") === ownerId
        ) || null;
    const composite =
      apiCompositeEditorDocument(
        editor
      );
    return owner && composite
      ? {
          ownerId,
          ownerPath,
          owner,
          composite,
          ownerGraph:
            resolvedParentDocument || graph,
          ownerDocument:
            resolvedParentDocument || graph,
          editor
        }
      : null;
  }

function openApiCompositeOwnerContexts() {
    if (
      typeof apiCompositeEditor ===
        "undefined" ||
      !apiCompositeEditor
    ) {
      return [];
    }
    return apiCompositeEditorChain(
      apiCompositeEditor
    ).map(editor =>
      openApiCompositeOwnerContext(editor)
    ).filter(Boolean);
  }

function openApiCompositeOwnerContextForPath(
    ownerPath
  ) {
    const requested = Array.isArray(ownerPath)
      ? ownerPath.map(value =>
          String(value || "")
        )
      : [];
    if (requested.length === 0) {
      return null;
    }
    return openApiCompositeOwnerContexts()
      .find(context =>
        context.ownerPath.length ===
          requested.length &&
        context.ownerPath.every(
          (value, index) =>
            value === requested[index]
        )
      ) || null;
  }

function openApiCompositeOwnerContextForRecord(
    record
  ) {
    if (!record) return null;
    const recordId = String(record.id || "").trim();
    if (!recordId) return null;
    return openApiCompositeOwnerContexts()
      .find(context =>
        String(
          context.owner?.parameters
            ?.savedApiCompositeId || ""
        ).trim() === recordId
      ) || null;
  }

function apiCompositeEditorContentUnchangedSinceOpen(
    editor = apiCompositeEditor
  ) {
    const localRevision = Number(
      editor?.contentMutationRevision
    );
    const localBaseline = Number(
      editor?.contentMutationRevisionAtOpen
    );
    if (
      !editor ||
      (
        !Number.isFinite(localRevision) ||
        !Number.isFinite(localBaseline)
      ) &&
      (
        typeof graphContentMutationSequence !==
          "number" ||
        !Number.isFinite(
          editor.contentMutationSequenceAtOpen
        )
      )
    ) {
      return false;
    }

    return Number.isFinite(localRevision) &&
      Number.isFinite(localBaseline)
        ? localRevision === localBaseline
        : editor.contentMutationSequenceAtOpen ===
            graphContentMutationSequence;
  }

function apiCompositeEditorViewState(
    view = graph,
    editor = apiCompositeEditor
  ) {
    return {
      document:
        apiCompositeEditorDocument(
          editor
        ),
      nodes: view?.nodes,
      connections: view?.connections,
      viewport: {
        x: view?.viewport?.x,
        y: view?.viewport?.y,
        scale: view?.viewport?.scale
      },
      selectedNodeId:
        view?.selectedNodeId || null,
      selectedNodeIds:
        Array.isArray(view?.selectedNodeIds)
          ? [...view.selectedNodeIds]
          : [],
      selectedConnectionId:
        view?.selectedConnectionId || null,
      selectedWirePoint:
        view?.selectedWirePoint
          ? {
              connectionId:
                view.selectedWirePoint
                  .connectionId,
              pointId:
                view.selectedWirePoint
                  .pointId
            }
          : null,
      nextSequence: view?.nextSequence
    };
  }

function apiCompositeEditorViewUnchangedSinceOpen(
    editor = apiCompositeEditor,
    view = graph
  ) {
    const expected = editor?.openViewState;
    const actual =
      apiCompositeEditorViewState(
        view,
        editor
      );
    return Boolean(
      expected &&
      actual.document === expected.document &&
      actual.nodes === expected.nodes &&
      actual.connections ===
        expected.connections &&
      actual.viewport.x ===
        expected.viewport.x &&
      actual.viewport.y ===
        expected.viewport.y &&
      actual.viewport.scale ===
        expected.viewport.scale &&
      actual.selectedNodeId ===
        expected.selectedNodeId &&
      actual.selectedNodeIds.length ===
        expected.selectedNodeIds.length &&
      actual.selectedNodeIds.every(
        (value, index) =>
          value ===
            expected.selectedNodeIds[index]
      ) &&
      actual.selectedConnectionId ===
        expected.selectedConnectionId &&
      actual.selectedWirePoint?.connectionId ===
        expected.selectedWirePoint?.connectionId &&
      actual.selectedWirePoint?.pointId ===
        expected.selectedWirePoint?.pointId &&
      actual.nextSequence ===
        expected.nextSequence
    );
  }

function apiCompositeEditorCompleteStateUnchangedSinceOpen(
    editor = apiCompositeEditor,
    view = graph
  ) {
    return Boolean(
      apiCompositeEditorContentUnchangedSinceOpen(
        editor
      ) &&
      apiCompositeEditorViewUnchangedSinceOpen(
        editor,
        view
      )
    );
  }

function activeApiCompositeGraphDocument() {
    if (!apiCompositeEditor) {
      return graph;
    }
    return (
      openApiCompositeOwnerContext()
        ?.composite || null
    );
  }

function apiCompositeCustomCSharpOwnerIds(
    source
  ) {
    const result = new Set();
    const visited = new WeakSet();
    const append = candidate => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        visited.has(candidate)
      ) {
        return;
      }
      visited.add(candidate);
      for (const ownerId of Object.keys(
        candidate.customCSharpFiles || {}
      )) {
        result.add(ownerId);
      }
      for (const nested of Object.values(
        candidate.apiCompositeGraphs || {}
      )) {
        append(nested);
      }
    };
    append(source);
    return result;
  }

function currentOpenApiCompositeMatchesRecord(
    record
  ) {
    return Boolean(
      openApiCompositeOwnerContextForRecord(
        record
      )
    );
  }

function savedApiCompositeNestedLibraryIds(
    source
  ) {
    const result = new Set();
    const visited = new WeakSet();
    const append = (candidate, depth) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        visited.has(candidate) ||
        depth >
          SAVED_API_COMPOSITE_NESTING_LIMIT
      ) {
        return;
      }
      visited.add(candidate);
      for (const node of
        Array.isArray(candidate.nodes)
          ? candidate.nodes
          : []) {
        if (
          node?.operatorId !==
            "container.apiComposite"
        ) {
          continue;
        }
        const savedId = String(
          node.parameters
            ?.savedApiCompositeId || ""
        );
        if (savedId) result.add(savedId);
        append(
          candidate.apiCompositeGraphs?.[
            node.id
          ],
          depth + 1
        );
      }
    };
    append(source, 0);
    return result;
  }

function savedApiCompositeInsertionIssue(
    record
  ) {
    const context =
      openApiCompositeOwnerContext();
    if (!context || !record) {
      return "";
    }
    if (
      currentOpenApiCompositeMatchesRecord(
        record
      )
    ) {
      return window.RMLI18n.t("ui.literal.9d8f49fa8a90");
    }
    const ancestorIds = new Set();
    const target =
      resolveSavedApiCompositeSaveTarget(
        context.owner,
        context.composite
      );
    if (target.record?.id) {
      ancestorIds.add(target.record.id);
    }
    const nestedIds =
      savedApiCompositeNestedLibraryIds(
        record.composite
      );
    for (const ancestorId of
      ancestorIds) {
      if (nestedIds.has(ancestorId)) {
        return window.RMLI18n.t("ui.literal.68c23a924e2e");
      }
    }
    return "";
  }

function resolveSavedApiCompositeSaveTarget(
    node,
    composite = null
  ) {
    const ownedComposite =
      composite ||
      graph?.apiCompositeGraphs?.[
        node?.id
      ] ||
      null;
    const name =
      savedApiCompositeCurrentName(
        node,
        ownedComposite
      );
    const nameKey =
      savedApiCompositeNameKey(name);
    const matches = [
      ...savedApiCompositeTemplates.values()
    ].filter(record =>
      savedApiCompositeNameKey(
        record?.name
      ) === nameKey
    );
    const linkedId = String(
      node?.parameters?.savedApiCompositeId || ""
    ).trim();
    const linkedRecord = linkedId
      ? savedApiCompositeTemplates.get(
          linkedId
        ) || null
      : null;
    const foreignNameMatches = linkedId
      ? matches.filter(record =>
          record.id !== linkedId
        )
      : [];
    const ambiguous = Boolean(
      matches.length > 1 ||
      foreignNameMatches.length > 0
    );
    const record = ambiguous
      ? null
      : linkedRecord;
    const mode = ambiguous
      ? "ambiguous"
      : record
        ? "update"
        : "save";
    const issue = mode === "ambiguous"
      ? linkedId && foreignNameMatches.length > 0
        ? `This Composite is linked to saved identity '${linkedId}', but its normalized name '${name}' belongs to a different Saved API Composite. Rename it or resolve the library collision before saving; no saved identity was changed.`
        : `Several Saved API Composites use the normalized name '${name}'. Rename this Composite or remove the duplicate library entries before updating it.`
      : "";
    return {
      mode,
      name,
      nameKey,
      record,
      matches,
      linkedId,
      linkedRecord,
      issue
    };
  }

function savedApiCompositeInstallCommittedSnapshot(
    target,
    source,
    ownerPath = []
  ) {
    if (
      !target ||
      typeof target !== "object" ||
      Array.isArray(target) ||
      !source ||
      typeof source !== "object" ||
      Array.isArray(source)
    ) {
      return null;
    }
    const installed = nodeGraphClone(source);
    const requestedPath =
      (Array.isArray(ownerPath)
        ? ownerPath
        : []).map(value =>
        String(value || "").trim()
      ).filter(Boolean);
    const frames =
      typeof apiCompositeEditorChain ===
        "function"
        ? apiCompositeEditorChain(
            apiCompositeEditor,
            { outermostFirst: true }
          )
        : [];
    const pathsEqual = (left, right) =>
      left.length === right.length &&
      left.every(
        (value, index) =>
          value === right[index]
      );
    const targetFrameIndex =
      requestedPath.length > 0
        ? frames.findIndex(frame =>
            pathsEqual(
              apiCompositeEditorOwnerPath(
                frame
              ),
              requestedPath
            )
          )
        : -1;
    if (
      requestedPath.length > 0 &&
      targetFrameIndex < 0
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.4ebfdec9c242")
      );
    }

    let installedActiveComposite = installed;
    if (targetFrameIndex >= 0) {
      for (
        let index = targetFrameIndex + 1;
        index < frames.length;
        index += 1
      ) {
        const ownerId = String(
          frames[index]?.containerNodeId || ""
        );
        const ownerExists = Boolean(
          installedActiveComposite?.nodes
            ?.some(node =>
              String(node?.id || "") ===
                ownerId
            )
        );
        const child =
          installedActiveComposite
            ?.apiCompositeGraphs?.[
              ownerId
            ];
        if (!ownerExists || !child) {
          throw new Error(
            window.RMLI18n.t("ui.literal.0129b88af82a")
          );
        }
        installedActiveComposite = child;
      }
      if (
        typeof customCSharpEditor !==
          "undefined" &&
        customCSharpEditor
      ) {
        const fileNodeId = String(
          customCSharpEditor.fileNodeId || ""
        );
        const ownerExists = Boolean(
          installedActiveComposite?.nodes
            ?.some(node =>
              String(node?.id || "") ===
                fileNodeId
            )
        );
        const customGraph =
          installedActiveComposite
            ?.customCSharpFiles?.[
              fileNodeId
            ];
        if (!ownerExists || !customGraph) {
          throw new Error(
            window.RMLI18n.t("ui.literal.6e2d99b9c9c4")
          );
        }
      }
    }

    for (const key of Object.keys(target)) {
      delete target[key];
    }
    Object.assign(target, installed);
    if (targetFrameIndex < 0) {
      return target;
    }

    const rootView =
      frames[0]?.mainView ||
      (typeof customCSharpEditor !==
        "undefined"
        ? customCSharpEditor?.mainView
        : null) ||
      graphViewFrom(graph);
    let parentEditor = null;
    for (
      let index = 0;
      index < frames.length;
      index += 1
    ) {
      const frame = frames[index];
      frame.parentEditor = parentEditor;
      frame.parent = null;
      parentEditor = frame;
      if (index < targetFrameIndex) {
        continue;
      }
      const framePath =
        apiCompositeEditorOwnerPath(frame);
      const parentDocument =
        index === 0
          ? rootView
          : apiCompositeEditorDocument(
              frames[index - 1]
            );
      const composite =
        index === targetFrameIndex
          ? target
          : apiCompositeEditorDocument(
              frame
            );
      const ownerId = String(
        frame.containerNodeId || ""
      );
      const owner =
        parentDocument?.nodes?.find(node =>
          String(node?.id || "") ===
            ownerId
        ) || null;
      frame.ownerPath = Object.freeze([
        ...framePath
      ]);
      frame.mainView = graphViewFrom(
        parentDocument
      );
      frame.title =
        savedApiCompositeCurrentName(
          owner,
          composite
        );
      frame.initialNodeIds = new Set(
        (composite?.nodes || []).map(node =>
          node.id
        )
      );
      const revision = Number(
        frame.contentMutationRevision
      );
      if (Number.isFinite(revision)) {
        frame.contentMutationRevisionAtOpen =
          revision;
      }
      if (
        typeof graphContentMutationSequence ===
          "number"
      ) {
        frame.contentMutationSequenceAtOpen =
          graphContentMutationSequence;
      }
      frame.openViewState =
        apiCompositeEditorViewState(
          composite,
          frame
        );
    }
    apiCompositeEditor = parentEditor;
    const activeComposite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (
      typeof customCSharpEditor !==
        "undefined" &&
      customCSharpEditor
    ) {
      const fileNodeId = String(
        customCSharpEditor.fileNodeId || ""
      );
      const customGraph =
        activeComposite
          ?.customCSharpFiles?.[
            fileNodeId
          ];
      customCSharpEditor.mainView =
        graphViewFrom(activeComposite);
      applyGraphView(
        graphViewFrom(customGraph)
      );
      if (
        typeof acknowledgeCustomCSharpGraphDocumentCommit ===
          "function"
      ) {
        acknowledgeCustomCSharpGraphDocumentCommit({
          nodes: graph.nodes,
          ownerPath:
            customCSharpEditor.openOwnerPath
        });
      }
      if (
        typeof rememberCustomCSharpReopenIdentity ===
          "function"
      ) {
        rememberCustomCSharpReopenIdentity();
      }
    } else {
      applyGraphView(
        graphViewFrom(activeComposite)
      );
    }
    return target;
  }

function currentApiCompositeCatalogIdentity() {
    const report =
      window.RMLApiNodeFactoryReport ||
      null;
    return {
      fingerprint: String(
        report?.catalogFingerprint || ""
      ),
      engineVersion: String(
        report?.engineVersion || ""
      )
    };
  }

function savedApiCompositeBoundaryNormalizationIsValid(
    sourceDocument,
    sanitizedDocument
  ) {
    const sourceVisited = new WeakSet();
    const sanitizedVisited = new WeakSet();
    const sameBoundaryIdentity = (
      first,
      second
    ) =>
      first?.direction === second?.direction &&
      first?.id === second?.id &&
      first?.internalNodeId ===
        second?.internalNodeId &&
      first?.internalPortId ===
        second?.internalPortId;
    const sameBoundaryIdentityList = (
      first,
      second
    ) =>
      first.length === second.length &&
      first.every(
        (boundary, index) =>
          sameBoundaryIdentity(
            boundary,
            second[index]
          )
      );
    const canonicalBoundaries = value => {
      const raw = Array.isArray(value)
        ? value
        : [];
      const records =
        apiCompositeBoundaryRecords(raw);
      return {
        raw,
        records,
        valid: records.length === raw.length
      };
    };
    const documentRegistry = documentValue =>
      documentValue.apiCompositeGraphs &&
      typeof documentValue
        .apiCompositeGraphs === "object" &&
      !Array.isArray(
        documentValue.apiCompositeGraphs
      )
        ? documentValue.apiCompositeGraphs
        : {};
    const documentNodesById = documentValue =>
      new Map(
        (
          Array.isArray(documentValue.nodes)
            ? documentValue.nodes
            : []
        ).map(node => [String(node?.id || ""), node])
      );

    const compareDocument = (
      sourceValue,
      sanitizedValue
    ) => {
      if (
        !sourceValue ||
        typeof sourceValue !== "object" ||
        Array.isArray(sourceValue) ||
        !sanitizedValue ||
        typeof sanitizedValue !== "object" ||
        Array.isArray(sanitizedValue) ||
        sourceVisited.has(sourceValue) ||
        sanitizedVisited.has(sanitizedValue)
      ) {
        return null;
      }
      sourceVisited.add(sourceValue);
      sanitizedVisited.add(sanitizedValue);

      const sourceBoundaryState =
        canonicalBoundaries(
          sourceValue.boundaryPorts
        );
      const sanitizedBoundaryState =
        canonicalBoundaries(
          sanitizedValue.boundaryPorts
        );
      if (
        !sourceBoundaryState.valid ||
        !sanitizedBoundaryState.valid
      ) {
        return null;
      }

      const sourceRegistry =
        documentRegistry(sourceValue);
      const sanitizedRegistry =
        documentRegistry(sanitizedValue);
      const sourceOwnerIds =
        Object.keys(sourceRegistry).sort();
      const sanitizedOwnerIds =
        Object.keys(sanitizedRegistry).sort();
      if (
        sourceOwnerIds.length !==
          sanitizedOwnerIds.length ||
        sourceOwnerIds.some(
          (ownerId, index) =>
            ownerId !==
              sanitizedOwnerIds[index]
        )
      ) {
        return null;
      }

      const sourceNodes =
        documentNodesById(sourceValue);
      const sanitizedNodes =
        documentNodesById(sanitizedValue);
      const childResults = new Map();
      for (const ownerId of sourceOwnerIds) {
        const sourceOwner =
          sourceNodes.get(ownerId);
        const sanitizedOwner =
          sanitizedNodes.get(ownerId);
        if (
          sourceOwner?.operatorId !==
            "container.apiComposite" ||
          sanitizedOwner?.operatorId !==
            "container.apiComposite"
        ) {
          return null;
        }
        const childResult = compareDocument(
          sourceRegistry[ownerId],
          sanitizedRegistry[ownerId]
        );
        if (!childResult) {
          return null;
        }

        const sourceOwnerBoundaryState =
          canonicalBoundaries(
            sourceOwner.parameters
              ?.boundaryPorts
          );
        const sanitizedOwnerBoundaryState =
          canonicalBoundaries(
            sanitizedOwner.parameters
              ?.boundaryPorts
          );
        if (
          !sourceOwnerBoundaryState.valid ||
          !sanitizedOwnerBoundaryState.valid ||
          !sameBoundaryIdentityList(
            sourceOwnerBoundaryState.records,
            childResult.sourceBoundaries
          ) ||
          JSON.stringify(
            sanitizedOwnerBoundaryState.records
          ) !==
            JSON.stringify(
              childResult.sanitizedBoundaries
            )
        ) {
          return null;
        }
        childResults.set(ownerId, childResult);
      }

      const expectedBoundaryCandidates = [
        ...sourceBoundaryState.records
      ];
      const expectedBoundaryEndpoints =
        new Set(
          expectedBoundaryCandidates.map(
            apiCompositeBoundaryEndpointKey
          )
        );
      for (const sanitizedOwner of
        Array.isArray(sanitizedValue.nodes)
          ? sanitizedValue.nodes
          : []) {
        if (
          sanitizedOwner?.operatorId !==
            "container.apiComposite"
        ) {
          continue;
        }
        const childResult =
          childResults.get(
            String(sanitizedOwner.id || "")
          );
        if (!childResult) {
          return null;
        }
        for (const childBoundary of
          childResult.sanitizedBoundaries) {
          const endpoint = {
            direction:
              childBoundary.direction,
            internalNodeId:
              sanitizedOwner.id,
            internalPortId:
              childBoundary.id
          };
          const endpointKey =
            apiCompositeBoundaryEndpointKey(
              endpoint
            );
          if (
            expectedBoundaryEndpoints.has(
              endpointKey
            ) ||
            apiCompositePortHasInternalWireInDocument(
              sanitizedValue,
              endpoint
            )
          ) {
            continue;
          }
          expectedBoundaryCandidates.push(
            forwardedApiCompositeBoundary(
              sanitizedOwner,
              childBoundary,
              expectedBoundaryCandidates
            )
          );
          expectedBoundaryEndpoints.add(
            endpointKey
          );
        }
      }

      const expectedBoundaries = [];
      for (const boundary of
        sourceBoundaryState.records) {
        if (
          !apiCompositeBoundaryPortSpecification(
            sourceValue,
            boundary
          )
        ) {
          return null;
        }
        let removedByChildContract = false;
        const sourceEndpointNode =
          sourceNodes.get(
            boundary.internalNodeId
          );
        if (
          sourceEndpointNode?.operatorId ===
            "container.apiComposite"
        ) {
          const childResult =
            childResults.get(
              boundary.internalNodeId
            );
          if (!childResult) {
            return null;
          }
          const childSourceBoundary =
            childResult.sourceBoundaries.find(
              candidate =>
                candidate.direction ===
                  boundary.direction &&
                candidate.id ===
                  boundary.internalPortId
            );
          if (!childSourceBoundary) {
            return null;
          }
          removedByChildContract =
            !childResult.sanitizedBoundaries.some(
              candidate =>
                candidate.direction ===
                  boundary.direction &&
                candidate.id ===
                  boundary.internalPortId
            );
        }
        const removedByInternalWire =
          apiCompositePortHasInternalWireInDocument(
            sourceValue,
            boundary
          );
        if (
          !removedByInternalWire &&
          !removedByChildContract
        ) {
          expectedBoundaries.push(boundary);
        }
      }

      for (
        let index =
          sourceBoundaryState.records.length;
        index <
          expectedBoundaryCandidates.length;
        index += 1
      ) {
        const boundary =
          expectedBoundaryCandidates[index];
        if (
          !apiCompositeBoundaryPortSpecification(
            sanitizedValue,
            boundary
          ) ||
          apiCompositePortHasInternalWireInDocument(
            sanitizedValue,
            boundary
          )
        ) {
          return null;
        }
        expectedBoundaries.push(boundary);
      }

      if (
        !sameBoundaryIdentityList(
          expectedBoundaries,
          sanitizedBoundaryState.records
        )
      ) {
        return null;
      }
      return {
        sourceBoundaries:
          sourceBoundaryState.records,
        sanitizedBoundaries:
          sanitizedBoundaryState.records
      };
    };

    return Boolean(
      compareDocument(
        sourceDocument,
        sanitizedDocument
      )
    );
  }

  const SAVED_API_COMPOSITE_RECORD_NORMALIZED_KEYS =
    new Set([
      "schemaVersion",
      "id",
      "name",
      "description",
      "createdAt",
      "updatedAt",
      "compatibilityIssueFingerprint",
      "compatibilityIssueEngineVersion",
      "compatibilityIssueReason",
      "compatibilityIssueCheckedAt",
      "resolvedCatalogFingerprint",
      "resolvedEngineVersion",
      "sourceCatalogFingerprint",
      "sourceEngineVersion",
      "contentFingerprint",
      "composite",
      "content"
    ]);

  const SAVED_API_COMPOSITE_GRAPH_NORMALIZED_KEYS =
    new Set([
      "version",
      "title",
      "portLayout",
      "contentFingerprint",
      "fingerprintNameKey",
      "fingerprintPortLayout",
      "fingerprintNestedSignature",
      "createdCatalogFingerprint",
      "createdEngineVersion",
      "boundaryPorts",
      "branchRouting",
      "customCSharpFiles",
      "apiCompositeGraphs",
      "elementIdentity",
      "nodes",
      "connections",
      "viewport",
      "selectedNodeId",
      "selectedNodeIds",
      "selectedConnectionId",
      "selectedWirePoint",
      "nextSequence"
    ]);

  const SAVED_API_COMPOSITE_CUSTOM_GRAPH_NORMALIZED_KEYS =
    new Set([
      ...SAVED_API_COMPOSITE_GRAPH_NORMALIZED_KEYS,
      "fileName",
      "projectId",
      "parser",
      "languageVersion",
      "optimizerVersion",
      "catalogFingerprint",
      "catalogEngineVersion",
      "catalogSource",
      "catalogDefinitionRevision",
      "importedSource",
      "sourceEditedInInspector",
      "coordinateSpaceVersion",
      "sourceHash",
      "outputNodeId",
      "rootSyntaxNodeId",
      "directSourceNodeId"
    ]);

  const SAVED_API_COMPOSITE_NODE_NORMALIZED_KEYS =
    new Set([
      "id",
      "kind",
      "operatorId",
      "apiContract",
      "x",
      "y",
      "width",
      "height",
      "label",
      "parameters"
    ]);

  const SAVED_API_COMPOSITE_CONNECTION_NORMALIZED_KEYS =
    new Set([
      "id",
      "fromNode",
      "fromPort",
      "toNode",
      "toPort",
      "points",
      "branchFrom"
    ]);

  const SAVED_API_COMPOSITE_POINT_NORMALIZED_KEYS =
    new Set(["id", "x", "y"]);

  const SAVED_API_COMPOSITE_BOUNDARY_NORMALIZED_KEYS =
    new Set([
      "id",
      "direction",
      "label",
      "type",
      "typeVar",
      "constraint",
      "autoExposed",
      "internalNodeId",
      "internalPortId"
    ]);

  const SAVED_API_COMPOSITE_REFERENCE_NORMALIZED_KEYS =
    new Set(["connectionId", "pointId"]);

  const SAVED_API_COMPOSITE_VIEWPORT_NORMALIZED_KEYS =
    new Set(["x", "y", "scale"]);

  const SAVED_API_COMPOSITE_ELEMENT_IDENTITY_NORMALIZED_KEYS =
    new Set([
      "version",
      "templateId",
      "nodes",
      "connections",
      "points",
      "boundaries"
    ]);

  function savedApiCompositeJsonProjection(
    value,
    path = "$metadata",
    ancestors = new WeakSet()
  ) {
    if (value === null) return null;
    if (
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      return value;
    }
    if (typeof value === "number") {
      return Number.isFinite(value)
        ? Object.is(value, -0)
          ? 0
          : value
        : null;
    }
    if (
      value === undefined ||
      typeof value === "function" ||
      typeof value === "symbol"
    ) {
      return undefined;
    }
    if (typeof value === "bigint") {
      throw new TypeError(
        `Saved Composite metadata contains a BigInt at ${path}; it is not JSON serializable.`
      );
    }
    if (typeof value !== "object") {
      throw new TypeError(
        `Saved Composite metadata contains an unsupported value at ${path}.`
      );
    }
    if (ancestors.has(value)) {
      throw new TypeError(
        `Saved Composite metadata contains a cycle at ${path}.`
      );
    }
    ancestors.add(value);
    try {
      if (Array.isArray(value)) {
        const result = [];
        for (
          let index = 0;
          index < value.length;
          index += 1
        ) {
          const projected =
            savedApiCompositeJsonProjection(
              value[index],
              `${path}[${index}]`,
              ancestors
            );
          result.push(
            projected === undefined
              ? null
              : projected
          );
        }
        return result;
      }
      const result = {};
      for (const key of Object.keys(value)) {
        const projected =
          savedApiCompositeJsonProjection(
            value[key],
            `${path}.${key}`,
            ancestors
          );
        if (projected === undefined) continue;
        Object.defineProperty(result, key, {
          value: projected,
          writable: true,
          enumerable: true,
          configurable: true
        });
      }
      return result;
    } finally {
      ancestors.delete(value);
    }
  }

  function savedApiCompositeRestoreOpaqueFields(
    source,
    target,
    normalizedKeys,
    path
  ) {
    if (
      !source ||
      typeof source !== "object" ||
      Array.isArray(source) ||
      !target ||
      typeof target !== "object" ||
      Array.isArray(target)
    ) {
      return target;
    }
    for (const key of Object.keys(source)) {
      if (normalizedKeys.has(key)) continue;
      const projected =
        savedApiCompositeJsonProjection(
          source[key],
          `${path}.${key}`
        );
      if (projected === undefined) continue;
      Object.defineProperty(target, key, {
        value: projected,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
    return target;
  }

  function savedApiCompositeRestoreGraphMetadata(
    source,
    target,
    {
      customGraph = false,
      path = "$composite"
    } = {}
  ) {
    if (!source || !target) return target;
    savedApiCompositeRestoreOpaqueFields(
      source,
      target,
      customGraph
        ? SAVED_API_COMPOSITE_CUSTOM_GRAPH_NORMALIZED_KEYS
        : SAVED_API_COMPOSITE_GRAPH_NORMALIZED_KEYS,
      path
    );

    const targetNodes = new Map(
      (target.nodes || []).map(node => [
        String(node?.id || ""),
        node
      ])
    );
    for (const sourceNode of source.nodes || []) {
      const targetNode = targetNodes.get(
        String(sourceNode?.id || "")
      );
      savedApiCompositeRestoreOpaqueFields(
        sourceNode,
        targetNode,
        SAVED_API_COMPOSITE_NODE_NORMALIZED_KEYS,
        `${path}.nodes.${String(sourceNode?.id || "")}`
      );
    }

    const targetConnections = new Map(
      (target.connections || []).map(connection => [
        String(connection?.id || ""),
        connection
      ])
    );
    for (const sourceConnection of
      source.connections || []) {
      const connectionId = String(
        sourceConnection?.id || ""
      );
      const targetConnection =
        targetConnections.get(connectionId);
      savedApiCompositeRestoreOpaqueFields(
        sourceConnection,
        targetConnection,
        SAVED_API_COMPOSITE_CONNECTION_NORMALIZED_KEYS,
        `${path}.connections.${connectionId}`
      );
      if (
        sourceConnection?.branchFrom &&
        targetConnection?.branchFrom
      ) {
        savedApiCompositeRestoreOpaqueFields(
          sourceConnection.branchFrom,
          targetConnection.branchFrom,
          SAVED_API_COMPOSITE_REFERENCE_NORMALIZED_KEYS,
          `${path}.connections.${connectionId}.branchFrom`
        );
      }
      const targetPoints = new Map(
        (targetConnection?.points || []).map(point => [
          String(point?.id || ""),
          point
        ])
      );
      for (const sourcePoint of
        sourceConnection?.points || []) {
        const pointId = String(
          sourcePoint?.id || ""
        );
        savedApiCompositeRestoreOpaqueFields(
          sourcePoint,
          targetPoints.get(pointId),
          SAVED_API_COMPOSITE_POINT_NORMALIZED_KEYS,
          `${path}.connections.${connectionId}.points.${pointId}`
        );
      }
    }

    const targetBoundaries = new Map(
      (target.boundaryPorts || []).map(boundary => [
        `${String(boundary?.direction || "")}\u0000${String(boundary?.id || "")}`,
        boundary
      ])
    );
    for (const sourceBoundary of
      source.boundaryPorts || []) {
      const boundaryKey =
        `${String(sourceBoundary?.direction || "")}\u0000${String(sourceBoundary?.id || "")}`;
      savedApiCompositeRestoreOpaqueFields(
        sourceBoundary,
        targetBoundaries.get(boundaryKey),
        SAVED_API_COMPOSITE_BOUNDARY_NORMALIZED_KEYS,
        `${path}.boundaryPorts.${boundaryKey}`
      );
    }

    for (const [connectionId, sourceBranch] of
      Object.entries(source.branchRouting || {})) {
      savedApiCompositeRestoreOpaqueFields(
        sourceBranch,
        target.branchRouting?.[connectionId],
        SAVED_API_COMPOSITE_REFERENCE_NORMALIZED_KEYS,
        `${path}.branchRouting.${connectionId}`
      );
    }
    savedApiCompositeRestoreOpaqueFields(
      source.viewport,
      target.viewport,
      SAVED_API_COMPOSITE_VIEWPORT_NORMALIZED_KEYS,
      `${path}.viewport`
    );
    savedApiCompositeRestoreOpaqueFields(
      source.selectedWirePoint,
      target.selectedWirePoint,
      SAVED_API_COMPOSITE_REFERENCE_NORMALIZED_KEYS,
      `${path}.selectedWirePoint`
    );
    savedApiCompositeRestoreOpaqueFields(
      source.elementIdentity,
      target.elementIdentity,
      SAVED_API_COMPOSITE_ELEMENT_IDENTITY_NORMALIZED_KEYS,
      `${path}.elementIdentity`
    );

    for (const [ownerId, sourceCustom] of
      Object.entries(source.customCSharpFiles || {})) {
      const targetCustom =
        target.customCSharpFiles?.[ownerId];
      if (!targetCustom) continue;
      savedApiCompositeRestoreGraphMetadata(
        sourceCustom,
        targetCustom,
        {
          customGraph: true,
          path:
            `${path}.customCSharpFiles.${ownerId}`
        }
      );
    }
    for (const [ownerId, sourceNested] of
      Object.entries(source.apiCompositeGraphs || {})) {
      const targetNested =
        target.apiCompositeGraphs?.[ownerId];
      if (!targetNested) continue;
      savedApiCompositeRestoreGraphMetadata(
        sourceNested,
        targetNested,
        {
          customGraph: false,
          path:
            `${path}.apiCompositeGraphs.${ownerId}`
        }
      );
    }
    return target;
  }

  function sanitizeSavedApiCompositeRecord(
    raw,
    {
      preserveId = true,
      fallbackName = "Saved API Composite",
      deferContentFingerprint = false
    } = {}
  ) {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      throw new TypeError(
        window.RMLI18n.t("ui.literal.0b6644f6504e")
      );
    }
    const source =
      raw.composite &&
      typeof raw.composite === "object" &&
      !Array.isArray(raw.composite)
        ? raw.composite
        : raw.content &&
            typeof raw.content === "object" &&
            !Array.isArray(raw.content)
          ? raw.content
          : raw;
    if (
      !Array.isArray(source.nodes) ||
      !Array.isArray(source.connections)
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.58c729541306")
      );
    }
    if (
      source.nodes.length < 2 ||
      source.nodes.length >
        SAVED_API_COMPOSITE_MAX_NODES
    ) {
      throw new Error(
        `A saved API Composite must contain between 2 and ${SAVED_API_COMPOSITE_MAX_NODES.toLocaleString(window.RMLI18n?.language || undefined)} compatible internal nodes.`
      );
    }
    if (
      source.connections.length >
        SAVED_API_COMPOSITE_MAX_CONNECTIONS
    ) {
      throw new Error(
        `A saved API Composite cannot contain more than ${SAVED_API_COMPOSITE_MAX_CONNECTIONS.toLocaleString(window.RMLI18n?.language || undefined)} connections.`
      );
    }
    const sourceStats =
      savedApiCompositeGraphStats(source);

    const ownerId =
      "saved-api-composite-owner";
    const sourceBoundaries =
      Array.isArray(source.boundaryPorts)
        ? source.boundaryPorts
        : [];
    const title = String(
      raw.name ||
      source.title ||
      fallbackName
    ).trim().slice(0, 120) ||
      fallbackName;
    const portLayout =
      source.portLayout === "mirrored" ||
      source.portLayout === "standard"
        ? source.portLayout
        : "";
    const owner = {
      id: ownerId,
      kind: "operator",
      operatorId:
        "container.apiComposite",
      x: 0,
      y: 0,
      width: null,
      height: null,
      label: title,
      parameters: {
        title,
        memberCount:
          source.nodes.length,
        boundaryPorts:
          nodeGraphClone(sourceBoundaries),
        portLayout:
          portLayout || "standard"
      }
    };
    const sanitizedRoot =
      sanitizeGraphState({
        version: GRAPH_SCHEMA_VERSION,
        active: true,
        apiCompositeGraphs: {
          [ownerId]: {
            ...nodeGraphClone(source),
            title,
            boundaryPorts:
              nodeGraphClone(sourceBoundaries)
          }
        },
        customCSharpFiles: {},
        nodes: [owner],
        connections: [],
        viewport: {
          x: 0,
          y: 0,
          scale: 1
        },
        selectedNodeId: ownerId,
        selectedNodeIds: [ownerId],
        selectedConnectionId: null,
        selectedWirePoint: null,
        nextSequence: 2
      });
    const composite =
      sanitizedRoot.apiCompositeGraphs?.[
        ownerId
      ];
    if (!composite) {
      throw new Error(
        window.RMLI18n.t("ui.literal.321a0d82c70d")
      );
    }
    const boundaries =
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      );
    const boundaryNormalizationIsValid =
      savedApiCompositeBoundaryNormalizationIsValid(
        source,
        composite
      );
    const sanitizedStats =
      savedApiCompositeGraphStats(
        composite
      );
    if (
      composite.nodes.length !==
        source.nodes.length ||
      composite.connections.length !==
        source.connections.length ||
      !boundaryNormalizationIsValid ||
      Object.keys(
        composite.customCSharpFiles || {}
      ).length !==
        Object.keys(
          source.customCSharpFiles || {}
        ).length ||
      sanitizedStats.nodes !==
        sourceStats.nodes ||
      sanitizedStats.connections !==
        sourceStats.connections ||
      sanitizedStats.composites !==
        sourceStats.composites ||
      sanitizedStats.customFiles !==
        sourceStats.customFiles ||
      sanitizedStats.customNodes !==
        sourceStats.customNodes ||
      sanitizedStats.customConnections !==
        sourceStats.customConnections
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.1a6adf14ea68")
      );
    }
    for (const node of composite.nodes) {
      if (
        !apiCompositeStoredNodeSupported(
          node,
          composite.apiCompositeGraphs
        )
      ) {
        throw new Error(
          `Saved API Composite '${title}' contains a node that is neither a portable catalog API nor a supported fixed logic/value/flow node.`
        );
      }
    }
    expandApiCompositeGraphDocument(
      sanitizedRoot
    );

    const now = new Date().toISOString();
    const id =
      preserveId &&
      String(raw.id || "").trim()
        ? String(raw.id).trim().slice(0, 180)
        : savedApiCompositeIdentifier();
    savedApiCompositeApplyElementIdentity(
      composite,
      id,
      source
    );
    composite.elementIdentity.templateId = id;
    const result = {
      schemaVersion:
        SAVED_API_COMPOSITE_SCHEMA_VERSION,
      id,
      name: title,
      description: String(
        raw.description || ""
      ).slice(0, 1000),
      createdAt: String(
        raw.createdAt || now
      ).slice(0, 80),
      updatedAt: String(
        raw.updatedAt || now
      ).slice(0, 80),
      compatibilityIssueFingerprint:
        String(
          raw.compatibilityIssueFingerprint ||
          ""
        ).slice(0, 256),
      compatibilityIssueEngineVersion:
        String(
          raw.compatibilityIssueEngineVersion ||
          ""
        ).slice(0, 160),
      compatibilityIssueReason:
        String(
          raw.compatibilityIssueReason || ""
        ).slice(0, 1000),
      compatibilityIssueCheckedAt:
        String(
          raw.compatibilityIssueCheckedAt || ""
        ).slice(0, 80),
      resolvedCatalogFingerprint: String(
        raw.resolvedCatalogFingerprint ||
        raw.sourceCatalogFingerprint ||
        composite.createdCatalogFingerprint ||
        ""
      ).slice(0, 256),
      resolvedEngineVersion: String(
        raw.resolvedEngineVersion ||
        raw.sourceEngineVersion ||
        composite.createdEngineVersion ||
        ""
      ).slice(0, 160),
      composite: {
        version: 1,
        title,
        ...(portLayout
          ? { portLayout }
          : {}),
        createdCatalogFingerprint: String(
          composite.createdCatalogFingerprint ||
          ""
        ).slice(0, 256),
        createdEngineVersion: String(
          composite.createdEngineVersion ||
          ""
        ).slice(0, 160),
        boundaryPorts: nodeGraphClone(boundaries),
        branchRouting: nodeGraphClone(
          composite.branchRouting || {}
        ),
        customCSharpFiles: nodeGraphClone(
          composite.customCSharpFiles || {}
        ),
        apiCompositeGraphs: nodeGraphClone(
          composite.apiCompositeGraphs || {}
        ),
        elementIdentity: nodeGraphClone(
          composite.elementIdentity
        ),
        nodes: composite.nodes.map(node =>
          nodeGraphClone(node)
        ),
        connections:
          composite.connections.map(
            connection =>
              nodeGraphClone(connection)
          ),
        viewport: nodeGraphClone(
          composite.viewport || {
            x: 56,
            y: 54,
            scale: 0.9
          }
        ),
        selectedNodeId:
          composite.selectedNodeId || null,
        selectedNodeIds:
          Array.isArray(
            composite.selectedNodeIds
          )
            ? [...composite.selectedNodeIds]
            : [],
        selectedConnectionId:
          composite.selectedConnectionId ||
          null,
        selectedWirePoint:
          composite.selectedWirePoint
            ? nodeGraphClone(
                composite.selectedWirePoint
              )
            : null,
        nextSequence: Math.max(
          1,
          Math.trunc(
            finiteNumber(
              composite.nextSequence,
              composite.nodes.length +
                composite.connections.length +
                1
            )
          )
        )
      }
    };
    savedApiCompositeRestoreGraphMetadata(
      source,
      result.composite
    );
    if (source !== raw) {
      savedApiCompositeRestoreOpaqueFields(
        raw,
        result,
        SAVED_API_COMPOSITE_RECORD_NORMALIZED_KEYS,
        "$record"
      );
    }
    const suppliedContentFingerprint =
      String(
        raw.contentFingerprint || ""
      ).slice(0, 256);
    const contentFingerprint =
      deferContentFingerprint
        ? ""
        : suppliedContentFingerprint;
    result.contentFingerprint =
      contentFingerprint;
    result.composite.contentFingerprint =
      contentFingerprint;
    return result;
  }

function savedApiCompositeDatabase() {
    if (savedApiCompositeDatabasePromise) {
      return savedApiCompositeDatabasePromise;
    }
    const indexedDatabase =
      window.indexedDB;
    if (!indexedDatabase) {
      savedApiCompositeDatabasePromise =
        Promise.resolve(null);
      return savedApiCompositeDatabasePromise;
    }
    savedApiCompositeDatabasePromise =
      new Promise((resolve, reject) => {
        const request =
          indexedDatabase.open(
            SAVED_API_COMPOSITE_DATABASE_NAME,
            1
          );
        request.onupgradeneeded = () => {
          const database = request.result;
          if (
            !database.objectStoreNames
              .contains(
                SAVED_API_COMPOSITE_STORE_NAME
              )
          ) {
            database.createObjectStore(
              SAVED_API_COMPOSITE_STORE_NAME,
              { keyPath: "id" }
            );
          }
        };
        request.onsuccess = () =>
          resolve(request.result);
        request.onerror = () =>
          reject(
            request.error ||
            new Error(
              window.RMLI18n.t("ui.literal.a7e09633a237")
            )
          );
        request.onblocked = () =>
          reject(
            new Error(
              window.RMLI18n.t("ui.literal.a5b6434cc576")
            )
          );
      }).catch(error => {
        console.warn(
          window.RMLI18n.t("ui.literal.08ee595ae263"),
          error
        );
        return null;
      });
    return savedApiCompositeDatabasePromise;
  }

function queueSavedApiCompositeMutation(
    operation
  ) {
    const run = () => operation();
    const queued =
      savedApiCompositeMutationTail.then(
        run,
        run
      );
    savedApiCompositeMutationTail =
      queued.then(
        () => undefined,
        () => undefined
      );
    return queued;
  }

function savedApiCompositeTransaction(
    database,
    mode,
    operation,
    {
      beforeCommit = null,
      commitGuardKey = ""
    } = {}
  ) {
    return new Promise((resolve, reject) => {
      const transaction =
        database.transaction(
          SAVED_API_COMPOSITE_STORE_NAME,
          mode
        );
      const store = transaction.objectStore(
        SAVED_API_COMPOSITE_STORE_NAME
      );
      let result;
      let commitGuardError = null;
      try {
        result = operation(store);
        if (
          typeof beforeCommit ===
            "function"
        ) {
          const guardRequest = store.get(
            String(commitGuardKey ||
              "__rml_saved_composite_commit_guard__")
          );
          guardRequest.onsuccess = () => {
            try {
              const guardResult =
                beforeCommit();
              if (
                guardResult &&
                typeof guardResult.then ===
                  "function"
              ) {
                throw new TypeError(
                  window.RMLI18n.t("ui.literal.4c32e1c6e020")
                );
              }
              transaction.commit?.();
            } catch (error) {
              commitGuardError = error;
              transaction.abort();
            }
          };
          guardRequest.onerror = () => {
            commitGuardError =
              guardRequest.error ||
              new Error(
                window.RMLI18n.t("ui.literal.362bedc850f0")
              );
            transaction.abort();
          };
        }
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }
      transaction.oncomplete = () =>
        resolve(result);
      transaction.onerror = () =>
        reject(
          commitGuardError ||
          transaction.error ||
          new Error(
            window.RMLI18n.t("ui.literal.4435713ef58d")
          )
        );
      transaction.onabort = () =>
        reject(
          commitGuardError ||
          transaction.error ||
          new Error(
            window.RMLI18n.t("ui.literal.e34431d5ac62")
          )
        );
    });
  }

function loadSavedApiCompositeLibrary() {
    if (savedApiCompositeLoadPromise) {
      return savedApiCompositeLoadPromise;
    }
    savedApiCompositeLoadPromise =
      savedApiCompositeDatabase()
        .then(database => {
          if (!database) {
            return [];
          }
          return new Promise(
            (resolve, reject) => {
              const transaction =
                database.transaction(
                  SAVED_API_COMPOSITE_STORE_NAME,
                  "readonly"
                );
              const request = transaction
                .objectStore(
                  SAVED_API_COMPOSITE_STORE_NAME
                )
                .getAll();
              request.onsuccess = () =>
                resolve(
                  Array.isArray(request.result)
                    ? request.result
                    : []
                );
              request.onerror = () =>
                reject(request.error);
            }
          );
        })
        .then(records => {
          savedApiCompositeTemplates.clear();
          savedApiCompositeCompatibilityIssues.clear();
          for (const raw of records) {
            try {
              const record =
                sanitizeSavedApiCompositeRecord(
                  raw
                );
              savedApiCompositeTemplates.set(
                record.id,
                record
              );
              if (
                record.compatibilityIssueReason
              ) {
                savedApiCompositeCompatibilityIssues.set(
                  record.id,
                  record.compatibilityIssueReason
                );
              }
            } catch (error) {
              console.warn(
                window.RMLI18n.t("ui.literal.e7911424927f"),
                error
              );
            }
          }

          return true;
        })
        .catch(error => {
          console.warn(
            window.RMLI18n.t("ui.literal.1f41fd93f1a0"),
            error
          );
          return false;
        });
    return savedApiCompositeLoadPromise;
  }

function assertSavedApiCompositePersistenceBatch(
    records,
    deletionIds = []
  ) {
    const identities = new Map();
    const names = new Map();
    records.forEach((record, index) => {
      const position = index + 1;
      const identity = String(
        record?.id || ""
      );
      const name = String(
        record?.name || ""
      );
      const nameKey =
        savedApiCompositeNameKey(name);
      if (identities.has(identity)) {
        throw new Error(
          `Saved API Composite storage batch is ambiguous: updates ${identities.get(identity)} and ${position} share template identity '${identity}'. Nothing was written.`
        );
      }
      identities.set(identity, position);

      if (names.has(nameKey)) {
        throw new Error(
          `Saved API Composite storage batch is ambiguous: updates ${names.get(nameKey)} and ${position} share the normalized name '${name}'. Nothing was written.`
        );
      }
      names.set(nameKey, position);
    });

    for (const deletionId of deletionIds) {
      if (identities.has(deletionId)) {
        throw new Error(
          `Saved API Composite storage batch cannot update and delete template identity '${deletionId}' in the same transaction. Nothing was written.`
        );
      }
    }
    return records;
  }

async function persistSavedApiCompositeRecords(
    records,
    {
      recordsAreSanitized = false,
      fingerprintsAreWorkerVerified = false,
      expectedCatalogBatchEpoch = "",
      catalogEpochPhase =
        "while the reconstructed Saved Composite storage transaction was pending"
    } = {}
  ) {
    let normalized = recordsAreSanitized
      ? [...records]
      : records.map(record =>
          sanitizeSavedApiCompositeRecord(
            record
          )
        );

    assertSavedApiCompositePersistenceBatch(
      normalized
    );
    if (!fingerprintsAreWorkerVerified) {
      const fingerprinted = [];
      for (const record of normalized) {
        fingerprinted.push(
          await savedApiCompositeRecordWithWorkerFingerprint(
            record,
            `persist:${record?.id || "record"}`
          )
        );
      }
      normalized = fingerprinted;
    }
    assertSavedApiCompositePersistenceBatch(
      normalized
    );
    return queueSavedApiCompositeMutation(
      async () => {
        const database =
          await savedApiCompositeDatabase();
        if (!database) {
          throw new Error(
            window.RMLI18n.t("ui.literal.6e5351d5c3e5")
          );
        }
        const stabilityLease =
          expectedCatalogBatchEpoch
            ? await acquireSavedApiCompositeCatalogStabilityLease(
                expectedCatalogBatchEpoch,
                "after waiting for the Saved Composite storage queue"
              )
            : null;
        try {
          await savedApiCompositeTransaction(
            database,
            "readwrite",
            store => {
              for (const record of normalized) {

                store.put(record);
              }
            },
            {
              beforeCommit:
                expectedCatalogBatchEpoch
                  ? () =>
                      assertSavedApiCompositeCatalogBatchEpoch(
                        expectedCatalogBatchEpoch,
                        catalogEpochPhase
                      )
                  : null,
              commitGuardKey:
                normalized[0]?.id || ""
            }
          );
          if (expectedCatalogBatchEpoch) {
            assertSavedApiCompositeCatalogBatchEpoch(
              expectedCatalogBatchEpoch,
              "while the reconstructed Saved Composite storage transaction was completing"
            );
          }
          for (const record of normalized) {
            savedApiCompositeTemplates.set(
              record.id,
              record
            );
            if (record.compatibilityIssueReason) {
              savedApiCompositeCompatibilityIssues.set(
                record.id,
                record.compatibilityIssueReason
              );
            } else {
              savedApiCompositeCompatibilityIssues.delete(
                record.id
              );
            }
          }
          return normalized;
        } finally {
          stabilityLease?.release();
        }
      }
    );
  }

async function applySavedApiCompositeReconciliation(
    updates,
    deletionIds,
    {
      recordsAreSanitized = false,
      fingerprintsAreWorkerVerified = false,
      beforeCommit = null,
      expectedCatalogBatchEpoch = "",
      catalogEpochPhase =
        "while the Saved Composite storage transaction was pending"
    } = {}
  ) {
    let normalizedUpdates =
      recordsAreSanitized
        ? [...updates]
        : updates.map(record =>
            sanitizeSavedApiCompositeRecord(
              record
            )
          );
    const normalizedDeletionIds = [
      ...new Set(
        deletionIds.map(value =>
          String(value || "")
        ).filter(Boolean)
      )
    ];

    assertSavedApiCompositePersistenceBatch(
      normalizedUpdates,
      normalizedDeletionIds
    );
    if (!fingerprintsAreWorkerVerified) {
      const fingerprinted = [];
      for (const record of normalizedUpdates) {
        fingerprinted.push(
          await savedApiCompositeRecordWithWorkerFingerprint(
            record,
            `reconcile:${record?.id || "record"}`
          )
        );
      }
      normalizedUpdates = fingerprinted;
    }
    assertSavedApiCompositePersistenceBatch(
      normalizedUpdates,
      normalizedDeletionIds
    );
    if (
      normalizedUpdates.length === 0 &&
      normalizedDeletionIds.length === 0
    ) {
      return {
        updates: [],
        deletionIds: []
      };
    }
    return queueSavedApiCompositeMutation(
      async () => {
        const database =
          await savedApiCompositeDatabase();
        if (!database) {
          throw new Error(
            window.RMLI18n.t("ui.literal.f712763b9b61")
          );
        }
        const stabilityLease =
          expectedCatalogBatchEpoch
            ? await acquireSavedApiCompositeCatalogStabilityLease(
                expectedCatalogBatchEpoch,
                "after waiting for the Saved Composite storage queue"
              )
            : null;
        try {
          const guardedBeforeCommit =
            (
              expectedCatalogBatchEpoch ||
              typeof beforeCommit ===
                "function"
            )
              ? () => {
                  if (
                    expectedCatalogBatchEpoch
                  ) {
                    assertSavedApiCompositeCatalogBatchEpoch(
                      expectedCatalogBatchEpoch,
                      catalogEpochPhase
                    );
                  }
                  return beforeCommit?.();
                }
              : null;
          await savedApiCompositeTransaction(
            database,
            "readwrite",
            store => {
              for (const record of
                normalizedUpdates) {
                store.put(record);
              }
              for (const id of
                normalizedDeletionIds) {
                store.delete(id);
              }
            },
            {
              beforeCommit:
                guardedBeforeCommit,
              commitGuardKey:
                normalizedUpdates[0]?.id ||
                normalizedDeletionIds[0] ||
                ""
            }
          );
          if (expectedCatalogBatchEpoch) {
            assertSavedApiCompositeCatalogBatchEpoch(
              expectedCatalogBatchEpoch,
              "while the Saved Composite storage transaction was completing"
            );
          }
          for (const record of
            normalizedUpdates) {
            savedApiCompositeTemplates.set(
              record.id,
              record
            );
            if (record.compatibilityIssueReason) {
              savedApiCompositeCompatibilityIssues.set(
                record.id,
                record.compatibilityIssueReason
              );
            } else {
              savedApiCompositeCompatibilityIssues.delete(
                record.id
              );
            }
          }
          for (const id of
            normalizedDeletionIds) {
            savedApiCompositeTemplates.delete(id);
            savedApiCompositeCompatibilityIssues.delete(
              id
            );
          }
          return {
            updates: normalizedUpdates,
            deletionIds:
              normalizedDeletionIds
          };
        } finally {
          stabilityLease?.release();
        }
      }
    );
  }

async function deleteSavedApiCompositeRecord(
    templateId
  ) {
    const id = String(
      templateId || ""
    );
    return queueSavedApiCompositeMutation(
      async () => {
        const database =
          await savedApiCompositeDatabase();
        if (!database) {
          throw new Error(
            window.RMLI18n.t("ui.literal.eeaf26e3a267")
          );
        }
        await savedApiCompositeTransaction(
          database,
          "readwrite",
          store => store.delete(id)
        );
        savedApiCompositeTemplates.delete(id);
        savedApiCompositeCompatibilityIssues.delete(
          id
        );
        return true;
      }
    );
  }

function savedApiCompositeMatchesCurrentCatalog(
    record,
    {
      allowFingerprintShortcut = true
    } = {}
  ) {
    if (!apiCompositeCatalogAvailable()) {
      return false;
    }
    const identity =
      currentApiCompositeCatalogIdentity();
    if (!identity.fingerprint) {
      return false;
    }
    if (
      allowFingerprintShortcut &&
      record.resolvedCatalogFingerprint ===
        identity.fingerprint &&
      record.resolvedEngineVersion ===
        identity.engineVersion
    ) {
      return true;
    }
    return graphOperatorNodesIncludingCustomCSharp(
      record.composite
    ).every(node => {
      const definition =
        OPERATOR_DEFINITIONS[
          node.operatorId
        ];
      if (
        definition?.catalogGenerated !== true &&
        definition?.unavailableApiContract !== true &&
        !node.apiContract
      ) {
        return Boolean(
          definition?.apiCompositeContainer ===
            true ||
          apiCompositeInternalDefinitionAllowed(
            definition
          ) ||
          definition?.customCSharpSyntaxNode ===
            true ||
          definition?.customCSharpSubgraphOnly ===
            true ||
          definition?.customCSharpCatalogNode ===
            true
        );
      }
      const currentContract =
        portableApiContract(definition);
      return Boolean(
        definition?.catalogGenerated ===
          true &&
        currentContract &&
        savedApiContractSemanticKey(
          node.apiContract
        ) ===
          savedApiContractSemanticKey(
            currentContract
          )
      );
    });
  }

function repairSavedApiCompositeMissingPortTopology(
    composite,
    visited = new Set()
  ) {
    if (
      !composite ||
      typeof composite !== "object" ||
      Array.isArray(composite) ||
      visited.has(composite)
    ) {
      return Object.freeze({
        disconnectedConnections: 0,
        removedBoundaries: 0
      });
    }
    visited.add(composite);

    let disconnectedConnections = 0;
    let removedBoundaries = 0;

    for (const [ownerNodeId, nested] of
      Object.entries(
        composite.apiCompositeGraphs || {}
      )) {
      const nestedRepair =
        repairSavedApiCompositeMissingPortTopology(
          nested,
          visited
        );
      disconnectedConnections +=
        Number(
          nestedRepair?.disconnectedConnections
        ) || 0;
      removedBoundaries +=
        Number(
          nestedRepair?.removedBoundaries
        ) || 0;

      const owner =
        (Array.isArray(composite.nodes)
          ? composite.nodes
          : []
        ).find(node =>
          String(node?.id || "") ===
          String(ownerNodeId || "")
        );
      if (owner) {
        owner.parameters =
          owner.parameters &&
          typeof owner.parameters === "object" &&
          !Array.isArray(owner.parameters)
            ? owner.parameters
            : {};
        owner.parameters.boundaryPorts =
          nodeGraphClone(
            apiCompositeBoundaryRecords(
              nested?.boundaryPorts
            )
          );
      }
    }

    const previousGraph = graph;
    try {
      graph = composite;

      const connections = Array.isArray(
        composite.connections
      )
        ? composite.connections
        : [];
      const invalidConnectionIds = new Set();

      for (const connection of connections) {
        const source = findPortSpec(
          connection?.fromNode,
          connection?.fromPort,
          "output"
        );
        const target = findPortSpec(
          connection?.toNode,
          connection?.toPort,
          "input"
        );
        if (!source || !target) {
          invalidConnectionIds.add(
            String(connection?.id || "")
          );
        }
      }

      let changed = true;
      while (changed) {
        changed = false;
        for (const connection of connections) {
          const connectionId = String(
            connection?.id || ""
          );
          if (
            !connectionId ||
            invalidConnectionIds.has(connectionId)
          ) {
            continue;
          }
          const branch =
            connection?.branchFrom ||
            composite.branchRouting?.[
              connectionId
            ] ||
            null;
          const parentConnectionId = String(
            branch?.connectionId || ""
          );
          if (
            parentConnectionId &&
            invalidConnectionIds.has(
              parentConnectionId
            )
          ) {
            invalidConnectionIds.add(
              connectionId
            );
            changed = true;
          }
        }
      }

      if (invalidConnectionIds.size > 0) {
        const before = connections.length;
        composite.connections =
          connections.filter(connection =>
            !invalidConnectionIds.has(
              String(connection?.id || "")
            )
          );
        disconnectedConnections +=
          before - composite.connections.length;

        const branchRouting =
          composite.branchRouting &&
          typeof composite.branchRouting ===
            "object" &&
          !Array.isArray(
            composite.branchRouting
          )
            ? composite.branchRouting
            : {};
        for (const [connectionId, branch] of
          Object.entries(branchRouting)) {
          if (
            invalidConnectionIds.has(
              String(connectionId)
            ) ||
            invalidConnectionIds.has(
              String(
                branch?.connectionId || ""
              )
            )
          ) {
            delete branchRouting[connectionId];
          }
        }
        composite.branchRouting = branchRouting;

        if (
          invalidConnectionIds.has(
            String(
              composite.selectedConnectionId ||
              ""
            )
          )
        ) {
          composite.selectedConnectionId = null;
          composite.selectedWirePoint = null;
        }
      }

      const boundaries =
        apiCompositeBoundaryRecords(
          composite.boundaryPorts
        );
      const validBoundaries =
        boundaries.filter(boundary =>
          Boolean(
            findPortSpec(
              boundary.internalNodeId,
              boundary.internalPortId,
              boundary.direction
            )
          )
        );
      if (
        validBoundaries.length !==
        boundaries.length
      ) {
        removedBoundaries +=
          boundaries.length -
          validBoundaries.length;
        composite.boundaryPorts =
          validBoundaries;
      }
    } finally {
      graph = previousGraph;
    }

    return Object.freeze({
      disconnectedConnections,
      removedBoundaries
    });
  }

function savedApiCompositeValidationGraph(
    record
  ) {
    const ownerId = makeId(
      "saved-composite-validation"
    );
    const composite = nodeGraphClone(
      record.composite
    );
    composite.title = record.name;
    const boundaries =
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      );
    return {
      ownerId,
      graph: {
        version: GRAPH_SCHEMA_VERSION,
        active: true,
        showAdvancedNodes: false,
        apiCompositeGraphs: {
          [ownerId]: composite
        },
        customCSharpFiles: {},
        nodes: [{
          id: ownerId,
          kind: "operator",
          operatorId:
            "container.apiComposite",
          x: 0,
          y: 0,
          width: null,
          height: null,
          label: record.name,
          parameters: {
            title: record.name,
            memberCount:
              composite.nodes.length,
            boundaryPorts:
              nodeGraphClone(boundaries),
            portLayout:
              composite.portLayout ===
                "mirrored"
                ? "mirrored"
                : "standard"
          }
        }],
        connections: [],
        viewport: {
          x: 0,
          y: 0,
          scale: 1
        },
        selectedNodeId: ownerId,
        selectedNodeIds: [ownerId],
        selectedConnectionId: null,
        selectedWirePoint: null,
        nextSequence: 2
      }
    };
  }

async function resolveSavedApiCompositeForCurrentCatalog(
    sourceRecord,
    {
      persistResolved = false,
      allowFingerprintShortcut = true,
      includeResolutionDetails = false,
      sourceRecordIsSanitized = false,
      expectedCatalogBatchEpoch = ""
    } = {}
  ) {
    const preSanitizeOmissions =
      savedApiCompositeOmissionDetails(
        sourceRecord &&
        typeof sourceRecord === "object"
          ? savedApiCompositePreSanitizeOmissions.get(
              sourceRecord
            )
          : []
      );
    const record =
      sourceRecordIsSanitized
        ? sourceRecord
        : sanitizeSavedApiCompositeRecord(
            sourceRecord
          );
    let identity =
      currentApiCompositeCatalogIdentity();
    let resolved = record;
    let changed = false;
    let resolutionDetails =
      Object.freeze({
        catalogResolutionEpochToken:
          String(
            window
              .RMLSavedApiCompositeResolver
              ?.catalogEpochToken?.() ||
            ""
          ),
        catalogResolutionBatchEpochToken:
          String(
            expectedCatalogBatchEpoch ||
            window
              .RMLSavedApiCompositeResolver
              ?.catalogBatchEpochToken?.() ||
            window
              .RMLSavedApiCompositeResolver
              ?.catalogEpochToken?.() ||
            ""
          ),
        compatibilityMode: false,
        unresolvedNodeCount: 0,
        removedUnavailableApiNodes:
          Object.freeze(
            nodeGraphClone(
              preSanitizeOmissions
            )
          )
      });
    if (
      !savedApiCompositeMatchesCurrentCatalog(
        record,
        { allowFingerprintShortcut }
      )
    ) {
      const resolverApi =
        window.RMLSavedApiCompositeResolver;
      const detailedResolver =
        resolverApi?.resolveGraphDetailed;
      const resolver =
        resolverApi?.resolveGraph;
      if (
        typeof detailedResolver !==
          "function" &&
        typeof resolver !== "function"
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.9b2b7364ac5c")
        );
      }
      const validation =
        savedApiCompositeValidationGraph(
          record
        );
      const detailedResult =
        typeof detailedResolver ===
          "function"
          ? await detailedResolver(
              validation.graph,
              {
                name: record.name
              }
            )
          : {
              graph:
                await resolver(
                  validation.graph,
                  {
                    name: record.name
                  }
                ),
              resolution: null
            };
      const resolvedGraph =
        detailedResult?.graph;
      const reportedResolution =
        detailedResult?.resolution;
      identity =
        currentApiCompositeCatalogIdentity();
      resolutionDetails =
        Object.freeze({
          catalogResolutionEpochToken:
            String(
              reportedResolution
                ?.catalogResolutionEpochToken ||
              resolverApi
                ?.catalogEpochToken?.() ||
              ""
            ),
          catalogResolutionBatchEpochToken:
            String(
              reportedResolution
                ?.catalogResolutionBatchEpochToken ||
              resolverApi
                ?.catalogBatchEpochToken?.() ||
              reportedResolution
                ?.catalogResolutionEpochToken ||
              resolverApi
                ?.catalogEpochToken?.() ||
              ""
            ),
          compatibilityMode:
            reportedResolution
              ?.compatibilityMode === true,
          unresolvedNodeCount:
            Math.max(
              0,
              Number(
                reportedResolution
                  ?.unresolvedNodeCount
              ) || 0
            ),
          removedUnavailableApiNodes:
            Object.freeze(
              nodeGraphClone(
                savedApiCompositeOmissionDetails([
                  ...preSanitizeOmissions,
                  ...(Array.isArray(
                    reportedResolution
                      ?.removedUnavailableApiNodes
                  )
                    ? reportedResolution
                        .removedUnavailableApiNodes
                    : [])
                ])
              )
            )
        });
      const resolvedComposite =
        resolvedGraph
          ?.apiCompositeGraphs?.[
            validation.ownerId
          ];
      if (!resolvedComposite) {
        throw new Error(
          window.RMLI18n.t("ui.literal.48a173112115")
        );
      }
      resolved =
        sanitizeSavedApiCompositeRecord({
          ...record,
          updatedAt:
            new Date().toISOString(),
          resolvedCatalogFingerprint:
            identity.fingerprint,
          resolvedEngineVersion:
            identity.engineVersion,
          composite: {
            ...resolvedComposite,
            title: record.name,
            createdCatalogFingerprint:
              record.composite
                .createdCatalogFingerprint,
            createdEngineVersion:
              record.composite
                .createdEngineVersion
          }
        });
      changed = true;
    } else if (
      record.resolvedCatalogFingerprint !==
        identity.fingerprint ||
      record.resolvedEngineVersion !==
        identity.engineVersion
    ) {
      resolved = {
        ...record,
        resolvedCatalogFingerprint:
          identity.fingerprint,
        resolvedEngineVersion:
          identity.engineVersion
      };
      changed = true;
    }
    if (
      resolved.compatibilityIssueFingerprint ||
      resolved.compatibilityIssueEngineVersion ||
      resolved.compatibilityIssueReason ||
      resolved.compatibilityIssueCheckedAt
    ) {
      resolved =
        sanitizeSavedApiCompositeRecord({
          ...resolved,
          compatibilityIssueFingerprint:
            "",
          compatibilityIssueEngineVersion:
            "",
          compatibilityIssueReason: "",
          compatibilityIssueCheckedAt:
            ""
        });
      changed = true;
    }
    if (persistResolved && changed) {
      const [stored] =
        await persistSavedApiCompositeRecords([
          resolved
        ], {
          recordsAreSanitized: true,
          expectedCatalogBatchEpoch:
            String(
              expectedCatalogBatchEpoch ||
              resolutionDetails
                .catalogResolutionBatchEpochToken ||
              ""
            ),
          catalogEpochPhase:
            "while the reconstructed Saved Composite storage transaction was pending"
        });
      resolved = stored;
    }
    return includeResolutionDetails
      ? Object.freeze({
          record: resolved,
          resolution:
            resolutionDetails
        })
      : resolved;
  }

function savedApiCompositeSearchText(
    record
  ) {
    const cached =
      savedApiCompositeSearchTextCache.get(
        record
      );
    if (cached) {
      return cached;
    }
    const identities = new Set();
    for (const node of
      record.composite.nodes) {
      const operatorId = String(
        node.operatorId || ""
      );
      const label = String(
        node.label || ""
      );
      if (operatorId) {
        identities.add(operatorId);
      }
      if (label) {
        identities.add(label);
      }
      if (identities.size >= 800) {
        break;
      }
    }
    const value =
      `${record.name} ${record.description || ""} ${[...identities].join(" ")}`
        .toLowerCase();
    savedApiCompositeSearchTextCache.set(
      record,
      value
    );
    return value;
  }

function applyApiCompositeBoundaries(
    boundaries
  ) {
    if (!apiCompositeEditor) return;
    const ownerId = String(
      apiCompositeEditor.containerNodeId ||
      ""
    );
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (composite) {
      composite.boundaryPorts =
        nodeGraphClone(boundaries);
      composite.elementIdentity =
        savedApiCompositeElementIdentity(
          composite.elementIdentity,
          composite,
          composite.elementIdentity
            ?.templateId || ""
        );
    }
    const owner =
      apiCompositeEditor.mainView.nodes
        .find(node => node.id === ownerId);
    if (owner) {
      owner.parameters =
        owner.parameters &&
        typeof owner.parameters === "object"
          ? owner.parameters
          : {};
      owner.parameters.boundaryPorts =
        nodeGraphClone(boundaries);
    }
    graphNodeDefinitionCache = new WeakMap();
    graphNodeGeometryCache.clear();
    graphSocketElementCache.clear();
    graphSvgWirePathCache.clear();
    graphSvgWirePointCache.clear();
    currentAnalysis = null;
    window.RMLResetGraphBoundaryTopologyCaches?.();
  }

function captureDisconnectedApiCompositePortCandidates(
    connections
  ) {
    if (
      !apiCompositeEditor ||
      customCSharpEditor ||
      !Array.isArray(connections)
    ) {
      return [];
    }
    const candidates = [];
    const endpointKeys = new Set();
    for (const connection of connections) {
      for (const endpoint of [
        {
          direction: "output",
          internalNodeId:
            connection?.fromNode,
          internalPortId:
            connection?.fromPort
        },
        {
          direction: "input",
          internalNodeId:
            connection?.toNode,
          internalPortId:
            connection?.toPort
        }
      ]) {
        const endpointKey =
          apiCompositeBoundaryEndpointKey(
            endpoint
          );
        if (
          !endpoint.internalNodeId ||
          !endpoint.internalPortId ||
          endpointKeys.has(endpointKey)
        ) {
          continue;
        }
        const descriptor =
          apiCompositePortDescriptor(
            endpoint.internalNodeId,
            endpoint.internalPortId,
            endpoint.direction,
            ""
          );
        if (!descriptor) continue;
        descriptor.autoExposed = true;
        candidates.push(descriptor);
        endpointKeys.add(endpointKey);
      }
    }
    return candidates;
  }

function retainDisconnectedApiCompositePorts(
    candidates
  ) {
    if (
      !apiCompositeEditor ||
      customCSharpEditor ||
      !Array.isArray(candidates) ||
      candidates.length === 0
    ) {
      return 0;
    }
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (!composite) return 0;
    const boundaries =
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      );
    const endpointKeys = new Set(
      boundaries.map(
        apiCompositeBoundaryEndpointKey
      )
    );
    const connectedEndpointKeys = new Set();
    for (const connection of graph.connections) {
      connectedEndpointKeys.add(
        `output\u0000${connection.fromNode}\u0000${connection.fromPort}`
      );
      connectedEndpointKeys.add(
        `input\u0000${connection.toNode}\u0000${connection.toPort}`
      );
    }
    let added = 0;
    for (const candidate of candidates) {
      const endpointKey =
        apiCompositeBoundaryEndpointKey(
          candidate
        );
      if (
        endpointKeys.has(endpointKey) ||
        connectedEndpointKeys.has(endpointKey) ||
        !findPortSpec(
          candidate.internalNodeId,
          candidate.internalPortId,
          candidate.direction
        )
      ) {
        continue;
      }
      boundaries.push({
        ...candidate,
        id: nextApiCompositeBoundaryId(
          candidate.direction,
          boundaries
        ),
        autoExposed: true
      });
      endpointKeys.add(endpointKey);
      added += 1;
    }
    if (added === 0) return 0;
    applyApiCompositeBoundaries(boundaries);
    apiCompositeEditor.boundaryUpdate = {
      added:
        (Number(
          apiCompositeEditor.boundaryUpdate
            ?.added
        ) || 0) + added,
      removed:
        Number(
          apiCompositeEditor.boundaryUpdate
            ?.removed
        ) || 0
    };
    return added;
  }

function apiCompositeRootDocumentForMutation() {
    if (!graph) return null;
    if (!apiCompositeEditor) return graph;
    const rootEditor =
      outermostApiCompositeEditor();
    if (!rootEditor) return graph;
    return {
      ...rootEditor.mainView,
      apiCompositeGraphs:
        graph.apiCompositeGraphs || {},
      customCSharpFiles:
        graph.customCSharpFiles || {},
      branchRouting:
        graph.branchRouting ||
        rootEditor.mainView
          ?.branchRouting ||
        {}
    };
  }

function commitApiCompositeRootDocumentMutation(
    rootDocument
  ) {
    if (!apiCompositeEditor || !rootDocument) {
      return;
    }
    const rootView =
      outermostApiCompositeEditor()
        ?.mainView;
    if (!rootView) return;
    rootView.connections =
      rootDocument.connections;
    rootView.selectedConnectionId =
      rootDocument.selectedConnectionId ||
      null;
    rootView.selectedWirePoint =
      rootDocument.selectedWirePoint ||
      null;
    rootView.branchRouting =
      rootDocument.branchRouting || {};
    graph.branchRouting =
      rootView.branchRouting;
  }

function exposeApiCompositeNodePorts(
    nodeId
  ) {
    if (!apiCompositeEditor) {
      return false;
    }
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (!composite) return false;
    const result =
      synchronizeApiCompositeBoundaries(
        composite.boundaryPorts,
        [nodeId]
      );
    applyApiCompositeBoundaries(
      result.boundaries
    );
    const rootDocument =
      apiCompositeRootDocumentForMutation();
    const nodeBoundaries =
      result.boundaries.filter(boundary =>
        boundary.internalNodeId === nodeId
      );
    const propagation =
      propagateApiCompositeBoundariesOutward(
        rootDocument,
        composite,
        nodeBoundaries
      );
    const reconciliation =
      reconcileApiCompositeBoundaryTree(
        rootDocument
      );
    commitApiCompositeRootDocumentMutation(
      rootDocument
    );
    apiCompositeEditor.boundaryUpdate = {
      added:
        (Number(
          apiCompositeEditor.boundaryUpdate
            ?.added
        ) || 0) + result.added,
      removed:
        (Number(
          apiCompositeEditor.boundaryUpdate
            ?.removed
        ) || 0) + result.removed
    };
    const changed =
      result.added > 0 ||
      result.removed > 0 ||
      propagation.addedBoundaries > 0 ||
      reconciliation.removedBoundaries > 0 ||
      reconciliation.disconnectedWires > 0;
    if (changed) {
      renderGraphNodesAndWires();
      renderGraphInspector({
        force: true
      });
      scheduleAcceptedGraphPersistenceAfterPaint({
        refreshGeneratedOutput: true,
        refreshCompositeActions: true,
        mutationClass: "boundary"
      });
    }
    showGraphMessage(
      changed
        ? `${result.added.toLocaleString(window.RMLI18n?.language || undefined)} open port${result.added === 1 ? " was" : "s were"} exposed and forwarded through every open Composite level.${propagation.stoppedAtInternalWire > 0 ? ` Forwarding stopped at ${propagation.stoppedAtInternalWire.toLocaleString(window.RMLI18n?.language || undefined)} internally connected level${propagation.stoppedAtInternalWire === 1 ? "" : "s"}.` : ""}`
        : window.RMLI18n.t("ui.literal.e87751cd22ae"),
      changed
        ? "success"
        : ""
    );
    return changed;
  }

function apiCompositeNodeSupportsVerifiedPortEditing(
    nodeId
  ) {
    if (!apiCompositeEditor) {
      return false;
    }
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (!composite) return false;
    const node = findGraphNode(nodeId);
    const definition = node
      ? nodeDefinition(node)
      : null;
    return Boolean(
      node &&
      definition &&
      (
        Array.isArray(definition.inputs) ||
        Array.isArray(definition.outputs) ||
        apiCompositeStoredNodeSupported(
          node,
          composite.apiCompositeGraphs ||
            {}
        )
      )
    );
  }

function apiCompositeNodeHasUnusedExposedPorts(
    nodeId
  ) {
    if (
      !apiCompositeNodeSupportsVerifiedPortEditing(
        nodeId
      )
    ) {
      return false;
    }
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (!composite) return false;
    const rootDocument =
      apiCompositeRootDocumentForMutation();
    return (
      apiCompositeUnusedBoundaryChainPlan(
        rootDocument,
        composite,
        nodeId,
        {
          sourceOwnerPath:
            apiCompositeEditorOwnerPath(
              apiCompositeEditor
            )
        }
      ).sourceBoundaries.length > 0
    );
  }

function hideUnusedApiCompositeNodePorts(
    nodeId
  ) {
    if (
      !apiCompositeNodeSupportsVerifiedPortEditing(
        nodeId
      )
    ) {
      return false;
    }
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    if (!composite) return false;
    const rootDocument =
      apiCompositeRootDocumentForMutation();
    const result =
      hideUnusedApiCompositeBoundaryChains(
        rootDocument,
        composite,
        nodeId,
        {
          sourceOwnerPath:
            apiCompositeEditorOwnerPath(
              apiCompositeEditor
            )
        }
      );
    if (result.aborted) {
      showGraphMessage(
        `${result.reason} No port or wire was changed.`,
        "error"
      );
      return false;
    }
    const removed =
      result.removedSourceBoundaries;
    if (removed === 0) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.d5124e4bac20"),
        ""
      );
      return false;
    }
    commitApiCompositeRootDocumentMutation(
      rootDocument
    );
    apiCompositeEditor.boundaryUpdate = {
      added:
        Number(
          apiCompositeEditor.boundaryUpdate
            ?.added
        ) || 0,
      removed:
        (Number(
          apiCompositeEditor.boundaryUpdate
            ?.removed
        ) || 0) + removed
    };
    renderGraphNodesAndWires();
    renderGraphInspector({
      force: true
    });
    scheduleAcceptedGraphPersistenceAfterPaint({
      refreshGeneratedOutput: true,
      refreshCompositeActions: true,
      mutationClass: "boundary"
    });
    showGraphMessage(
      `${removed.toLocaleString(window.RMLI18n?.language || undefined)} unused exposed port${removed === 1 ? " was" : "s were"} hidden through the complete unused Composite chain. No wire, branch, route or node geometry was changed. The port definitions remain available for Expose unconnected ports.`,
      "success"
    );
    return true;
  }

function apiCompositeNodeHasExposablePorts(
    nodeId
  ) {
    if (!apiCompositeEditor) {
      return false;
    }
    const composite =
      apiCompositeEditorDocument(
        apiCompositeEditor
      );
    const node = findGraphNode(nodeId);
    const definition = node
      ? nodeDefinition(node)
      : null;
    if (
      !composite ||
      !node ||
      !(
        definition ||
        apiCompositeOwnedContainerAllowed(
          node,
          composite.apiCompositeGraphs
        )
      )
    ) {
      return false;
    }
    const exposedEndpoints = new Set(
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      ).map(
        apiCompositeBoundaryEndpointKey
      )
    );
    for (const direction of [
      "input",
      "output"
    ]) {
      const ports =
        direction === "input"
          ? definition.inputs || []
          : definition.outputs || [];
      for (const specification of ports) {
        const endpoint = {
          direction,
          internalNodeId: node.id,
          internalPortId:
            specification.id
        };
        if (
          !exposedEndpoints.has(
            apiCompositeBoundaryEndpointKey(
              endpoint
            )
          ) &&
          !apiCompositePortHasInternalWireInDocument(
            composite,
            endpoint
          )
        ) {
          return true;
        }
      }
    }
    return false;
  }

function openApiCompositeGraph(
    containerNodeId
  ) {
    if (
      !graph ||
      customCSharpEditor
    ) {
      return false;
    }
    const normalizedOwnerId = String(
      containerNodeId || ""
    ).trim();
    if (!normalizedOwnerId) return false;

    const parentEditor =
      apiCompositeEditor || null;
    const parentPath =
      apiCompositeEditorOwnerPath(
        parentEditor
      );
    const parentFrames =
      apiCompositeEditorChain(
        parentEditor,
        { outermostFirst: true }
      );
    if (
      Math.max(
        parentPath.length,
        parentFrames.length
      ) >=
        SAVED_API_COMPOSITE_NESTING_LIMIT
    ) {
      showGraphMessage(
        `API Composite nesting cannot exceed the safe depth limit of ${SAVED_API_COMPOSITE_NESTING_LIMIT}.`,
        "error"
      );
      return false;
    }
    if (
      parentPath.includes(
        normalizedOwnerId
      )
    ) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.2c7f9560e424"),
        "error"
      );
      return false;
    }

    if (
      typeof flushActiveGraphDocumentPersistenceBeforeTransition ===
        "function"
    ) {
      flushActiveGraphDocumentPersistenceBeforeTransition();
    }

    const owner = findGraphNode(
      normalizedOwnerId
    );
    const definition = owner
      ? nodeDefinition(owner)
      : null;
    let composite =
      apiCompositeVisibleOwnedGraph(
        normalizedOwnerId
      );
    if (
      definition?.apiCompositeContainer !==
        true ||
      !composite
    ) {
      return false;
    }

    const visibleParentDocument =
      apiCompositeVisibleDocument();
    const ancestorDocuments = new Set(
      parentFrames.map(frame =>
        apiCompositeEditorDocument(frame)
      ).filter(Boolean)
    );
    if (
      composite === visibleParentDocument ||
      ancestorDocuments.has(composite)
    ) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.39d6de4d3c9a"),
        "error"
      );
      return false;
    }

    if (parentEditor) {
      composite =
        apiCompositeVisibleOwnedGraph(
          normalizedOwnerId
        );
      if (!composite) {
        showGraphMessage(
          window.RMLI18n.t("ui.literal.34a988beceae"),
          "error"
        );
        return false;
      }
    }

    const previousPresentation =
      parentEditor
        ? null
        : closeEmbeddedEditorForGraphReplacement();

    if (
      typeof rememberCurrentGraphAnalysis ===
        "function"
    ) {
      rememberCurrentGraphAnalysis();
    }

    apiCompositeEditor = {
      containerNodeId:
        normalizedOwnerId,
      title:
        savedApiCompositeCurrentName(
          owner,
          composite
        ),
      initialNodeIds: new Set(
        composite.nodes.map(node =>
          node.id
        )
      ),
      boundaryUpdate: {
        added: 0,
        removed: 0
      },
      contentMutationSequenceAtOpen:
        typeof graphContentMutationSequence ===
          "number"
          ? graphContentMutationSequence
          : 0,
      contentMutationRevision: 0,
      contentMutationRevisionAtOpen: 0,
      navigationContentFingerprintAtOpen:
        savedApiCompositeNavigationFingerprint(composite),
      navigationPendingFingerprint: null,
      previousPresentation,
      mainView: graphViewFrom(graph),
      parentEditor,
      ownerPath: Object.freeze([
        ...parentPath,
        normalizedOwnerId
      ])
    };
    const workSession =
      beginGraphTransitionWork({
        kicker: window.RMLI18n.t("ui.text.e4f5f8cbde11"),
        title: window.RMLI18n.format("composite.transition.opening", { title: apiCompositeEditor.title }),
        message:
          window.RMLI18n.t("ui.auto.272bb75e8a3c"),
        detail:
          window.RMLI18n.t("ui.literal.b2a2896acdca"),
        progress: 28
      });
    try {
      window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__ =
        (Number(window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__) || 0) + 1;
      try {
        applyGraphView(
          graphViewFrom(composite)
        );
      } finally {
        window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__ = Math.max(
          0,
          (Number(window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__) || 1) - 1
        );
      }
      apiCompositeEditor.openViewState =
        apiCompositeEditorViewState(graph);
      resetGraphRenderCaches();
      if (
        typeof restoreCurrentGraphAnalysis ===
          "function"
      ) {
        restoreCurrentGraphAnalysis();
      }
      activateGraphMode();
    } catch (error) {
      finishGraphTransitionWork(workSession);
      throw error;
    }
    showGraphMessage(
      window.RMLI18n.format("composite.transition.opened", { title: apiCompositeEditor.title }),
      "success"
    );
    return true;
  }

function closeApiCompositeGraph({
    restorePreviousPresentation = true,
    commit = true,
    announce = true
  } = {}) {
    if (!apiCompositeEditor || !graph) {
      return false;
    }
    const closingEditor =
      apiCompositeEditor;
    closeEmbeddedEditorForGraphReplacement();
    if (
      typeof flushActiveGraphDocumentPersistenceBeforeTransition ===
        "function"
    ) {
      flushActiveGraphDocumentPersistenceBeforeTransition();
    }
    const activeComposite =
      apiCompositeEditorDocument(
        closingEditor
      );
    if (!activeComposite) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.ddbdfcc0f41e"),
        "error"
      );
      return false;
    }
    const emptyComposite =
      graph.nodes.length === 0;
    const missingVerifiedCatalogNode =
      !apiCompositeHasVerifiedCatalogNode(
        graph.nodes,
        activeComposite.apiCompositeGraphs
      );
    const title = closingEditor.title;
    const previousPresentation =
      closingEditor.previousPresentation ||
      null;
    if (
      typeof rememberCurrentGraphAnalysis ===
        "function"
    ) {
      rememberCurrentGraphAnalysis();
    }
    const baselineFingerprint = String(
      closingEditor.navigationContentFingerprintAtOpen ||
      savedApiCompositeNavigationFingerprint(activeComposite)
    );
    const candidateFingerprint =
      apiCompositeEditorCurrentContentFingerprint(
        closingEditor,
        graph
      );
    closingEditor.navigationPendingFingerprint =
      candidateFingerprint;
    const contentUnchanged =
      candidateFingerprint === baselineFingerprint;
    const completeStateUnchanged =
      contentUnchanged;
    const captured =
      contentUnchanged
        ? activeComposite
        : captureApiCompositeEditorView();
    if (!captured) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.99443d68dca6"),
        "error"
      );
      return false;
    }
    const closingOwnerPath =
      apiCompositeEditorOwnerPath(
        closingEditor
      );
    if (!completeStateUnchanged) {

      markCommittedGraphMutation({
        nodes: captured.nodes,
        document: captured,
        ownerPath: closingOwnerPath,
        mutationClass: contentUnchanged
          ? "view"
          : "topology"
      });
    }
    const boundaryUpdate = {
      ...(closingEditor.boundaryUpdate || {
        added: 0,
        removed: 0
      })
    };
    const mainView =
      closingEditor.mainView;
    const parentEditor =
      closingEditor.parentEditor ||
      closingEditor.parent ||
      null;
    const workSession = commit
      ? beginGraphTransitionWork({
          kicker: parentEditor
            ? window.RMLI18n.t("composite.transition.kicker.api_composite")
            : window.RMLI18n.t("composite.transition.kicker.runtime_graph"),
          title: parentEditor
            ? window.RMLI18n.t("ui.literal.260f7944081f")
            : window.RMLI18n.t("ui.literal.cbc56b0ebb34"),
          message:
            window.RMLI18n.t("ui.auto.231ce12e3eab"),
          detail:
            window.RMLI18n.t("ui.literal.0cb37c0440e1"),
          progress: 34
        })
      : 0;
    apiCompositeEditor = parentEditor;
    try {
      window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__ =
        (Number(window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__) || 0) + 1;
      try {
        applyGraphView(mainView);
      } finally {
        window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__ = Math.max(
          0,
          (Number(window.__RML_API_COMPOSITE_NAVIGATION_DEPTH__) || 1) - 1
        );
      }
    } catch (error) {
      finishGraphTransitionWork(workSession);
      throw error;
    }
    if (commit) {
      graphNodeDefinitionCache =
        new WeakMap();
      resetGraphRenderCaches();
      const boundaryChanged =
        boundaryUpdate.added > 0 ||
        boundaryUpdate.removed > 0;
      if (boundaryChanged) {
        if (
          typeof invalidateGraphViewAnalysis ===
            "function"
        ) {
          invalidateGraphViewAnalysis(
            graph.nodes
          );
        }
      } else if (
        typeof restoreCurrentGraphAnalysis ===
          "function"
      ) {
        restoreCurrentGraphAnalysis();
      }
      try {
        activateGraphMode();
      } catch (error) {
        finishGraphTransitionWork(workSession);
        throw error;
      }
      if (!completeStateUnchanged) {
        scheduleGraphPersistenceAfterPaint({
          refreshGeneratedOutput:
            boundaryChanged ||
            !contentUnchanged,
          refreshCompositeActions: true,

          mutationClass: "view",
          acceptedMutation:
            currentAcceptedGraphDocumentMutation(
              "view"
            )
        });
      }
    }
    if (announce) {
      const message =
        missingVerifiedCatalogNode
          ? emptyComposite
            ? `Returned from ${title} to its parent graph level. The empty Composite remains editable, but it cannot be saved or exported until it contains a verified catalog API node again.`
            : `Returned from ${title} to its parent graph level. The Composite draft and its owned graphs were preserved, but it cannot be saved or exported until it contains a verified catalog API node.`
          : `Returned from ${title} to its parent graph level.${boundaryUpdate.added > 0 ? ` ${boundaryUpdate.added.toLocaleString(window.RMLI18n?.language || undefined)} new outer port${boundaryUpdate.added === 1 ? " was" : "s were"} exposed.` : ""}${boundaryUpdate.removed > 0 ? ` ${boundaryUpdate.removed.toLocaleString(window.RMLI18n?.language || undefined)} outward contract port${boundaryUpdate.removed === 1 ? " was" : "s were"} removed by the current internal connection topology.` : ""}`;
      showGraphMessage(
        message,
        missingVerifiedCatalogNode
          ? "warning"
          : "success"
      );
    }
    if (
      restorePreviousPresentation &&
      !parentEditor
    ) {
      restorePreviousEmbeddedEditor(
        previousPresentation
      );
    }
    return true;
  }

function apiCompositeExtensionPlan(
    sourceGraph,
    selectedNodeIds
  ) {
    const source =
      sourceGraph &&
      typeof sourceGraph === "object"
        ? sourceGraph
        : null;
    const requestedIds = [
      ...new Set(
        (Array.isArray(selectedNodeIds)
          ? selectedNodeIds
          : [])
          .map(value =>
            String(value || "")
          )
          .filter(Boolean)
      )
    ];
    const nodesById = new Map(
      (Array.isArray(source?.nodes)
        ? source.nodes
        : []).map(node => [
          String(node?.id || ""),
          node
        ])
    );
    const selectedNodes = requestedIds
      .map(id => nodesById.get(id))
      .filter(Boolean);
    const containers = selectedNodes
      .filter(node =>
        node?.kind === "operator" &&
        node.operatorId ===
          "container.apiComposite"
      );
    const primaryContainer =
      containers.find(node =>
        node.id === source?.selectedNodeId
      ) ||
      (containers.length === 1
        ? containers[0]
        : null);
    const peerNodes = selectedNodes
      .filter(node =>
        node !== primaryContainer
      );
    const reject = reason => ({
      valid: false,
      reason,
      selectedNodeIds: requestedIds,
      selectedNodes,
      container: primaryContainer,
      composite: null,
      peerNodes: []
    });

    if (!source || selectedNodes.length !== requestedIds.length) {
      return reject(
        window.RMLI18n.t("ui.literal.78952e9980be")
      );
    }
    if (!primaryContainer) {
      return reject(
        containers.length > 1
          ? window.RMLI18n.t("ui.literal.029e0b8dabaa")
          : window.RMLI18n.t("ui.literal.129e8f23d1ea")
      );
    }
    if (peerNodes.length === 0) {
      return reject(
        window.RMLI18n.t("ui.literal.34ad07ce3b16")
      );
    }

    const container = primaryContainer;
    const composite =
      source.apiCompositeGraphs &&
      typeof source.apiCompositeGraphs ===
        "object" &&
      !Array.isArray(
        source.apiCompositeGraphs
      )
        ? source.apiCompositeGraphs[
            container.id
          ]
        : null;
    if (
      !composite ||
      !Array.isArray(composite.nodes) ||
      !Array.isArray(
        composite.connections
      )
    ) {
      return reject(
        window.RMLI18n.t("ui.literal.22d73a0315de")
      );
    }

    const invalidNestedPeer = peerNodes.find(
      node =>
        node?.operatorId ===
          "container.apiComposite" &&
        !apiCompositeOwnedContainerAllowed(
          node,
          source.apiCompositeGraphs
        )
    );
    if (invalidNestedPeer) {
      return reject(
        window.RMLI18n.t("ui.literal.2c951f520f93")
      );
    }

    const combinedNodes = [
      ...composite.nodes,
      ...peerNodes
    ];

    return {
      valid: true,
      reason: "",
      selectedNodeIds: requestedIds,
      selectedNodes,
      container,
      composite,
      peerNodes,
      combinedNodes
    };
  }

function buildApiCompositeExtensionCandidate(
    sourceGraph,
    plan,
    selectionAnalysis = null
  ) {
    if (
      !sourceGraph ||
      !Array.isArray(sourceGraph.nodes) ||
      !Array.isArray(
        sourceGraph.connections
      ) ||
      !plan?.valid ||
      !plan.container ||
      !plan.composite ||
      !Array.isArray(plan.peerNodes)
    ) {
      throw new TypeError(
        window.RMLI18n.t("ui.literal.98d381119256")
      );
    }

    const containerId = String(
      plan.container.id || ""
    );
    const sourceContainer =
      sourceGraph.nodes.find(node =>
        node?.id === containerId
      );
    const sourceComposite =
      sourceGraph.apiCompositeGraphs?.[
        containerId
      ];
    if (
      !containerId ||
      sourceContainer?.operatorId !==
        "container.apiComposite" ||
      !sourceComposite ||
      sourceComposite !== plan.composite
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.15a82b6c9cee")
      );
    }

    const peerIds = new Set(
      plan.peerNodes.map(node =>
        String(node.id || "")
      )
    );
    if (
      peerIds.size !== plan.peerNodes.length ||
      peerIds.has(containerId)
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.a09713a31bb9")
      );
    }

    const peerCompositeIds = new Set(
      plan.peerNodes
        .filter(node =>
          node?.operatorId ===
            "container.apiComposite"
        )
        .map(node => String(node.id || ""))
    );
    const internalOwnedGraphs =
      nodeGraphClone(
        sourceComposite.apiCompositeGraphs ||
          {}
      );
    for (const peerId of peerCompositeIds) {
      const owned =
        sourceGraph.apiCompositeGraphs?.[
          peerId
        ];
      if (!owned) {
        throw new Error(
          `The nested API Composite '${peerId}' has no complete owned graph.`
        );
      }
      internalOwnedGraphs[peerId] =
        nodeGraphClone(owned);
    }

    const internalNodes = [
      ...sourceComposite.nodes.map(node =>
        nodeGraphClone(node)
      ),
      ...plan.peerNodes.map(node =>
        nodeGraphClone(node)
      )
    ];
    const internalNodeById = new Map();
    for (const node of internalNodes) {
      const nodeId = String(node?.id || "");
      if (
        !nodeId ||
        nodeId === containerId ||
        internalNodeById.has(nodeId) ||
        (
          node?.operatorId ===
            "container.apiComposite" &&
          !apiCompositeOwnedContainerAllowed(
            node,
            internalOwnedGraphs
          )
        )
      ) {
        throw new Error(
          `The extended API Composite would contain an invalid or duplicate node identity '${nodeId || "<unnamed>"}'.`
        );
      }
      internalNodeById.set(nodeId, node);
    }
    const memberIds = new Set(
      internalNodeById.keys()
    );

    const rawBoundaries = Array.isArray(
      sourceComposite.boundaryPorts
    )
      ? sourceComposite.boundaryPorts
      : Array.isArray(
          sourceContainer.parameters
            ?.boundaryPorts
        )
        ? sourceContainer.parameters
            .boundaryPorts
        : [];
    let boundaries =
      apiCompositeBoundaryRecords(
        rawBoundaries
      ).map(boundary =>
        nodeGraphClone(boundary)
      );
    if (boundaries.length !== rawBoundaries.length) {
      throw new Error(
        window.RMLI18n.t("ui.literal.763e3cf75ff6")
      );
    }

    const boundaryByEndpoint = new Map();
    const inputBoundaryById = new Map();
    const outputBoundaryById = new Map();
    for (const boundary of boundaries) {
      const node = internalNodeById.get(
        boundary.internalNodeId
      );
      const definition = node
        ? nodeDefinition(node)
        : null;
      const ports =
        boundary.direction === "input"
          ? definition?.inputs || []
          : definition?.outputs || [];
      if (
        !node ||
        !ports.some(port =>
          port.id ===
            boundary.internalPortId
        )
      ) {
        throw new Error(
          `The existing API Composite boundary '${boundary.id}' no longer resolves to an internal port.`
        );
      }
      boundaryByEndpoint.set(
        apiCompositeBoundaryEndpointKey(
          boundary
        ),
        boundary
      );
      (
        boundary.direction === "input"
          ? inputBoundaryById
          : outputBoundaryById
      ).set(boundary.id, boundary);
    }

    const bindings =
      selectionAnalysis?.bindings ||
      new Map();
    let addedBoundaries = 0;
    const boundaryFor = (
      nodeId,
      portId,
      direction
    ) => {
      const endpoint = {
        direction,
        internalNodeId: nodeId,
        internalPortId: portId
      };
      const endpointKey =
        apiCompositeBoundaryEndpointKey(
          endpoint
        );
      const existing =
        boundaryByEndpoint.get(
          endpointKey
        );
      if (existing) return existing;

      const node = internalNodeById.get(
        nodeId
      );
      const definition = node
        ? nodeDefinition(node)
        : null;
      const ports = direction === "input"
        ? definition?.inputs || []
        : definition?.outputs || [];
      const specification = ports.find(
        port => port.id === portId
      );
      if (!node || !specification) {
        throw new Error(
          `Cannot expose missing ${direction} port '${nodeId}.${portId}'.`
        );
      }
      const concreteType =
        resolvePortType(
          {
            node,
            definition,
            spec: specification,
            direction
          },
          bindings
        ) || specification.type || "";
      const boundary = {
        id: nextApiCompositeBoundaryId(
          direction,
          boundaries
        ),
        direction,
        label:
          `${node.label || definition?.title || node.operatorId} · ${specification.label || portId}`
            .slice(0, 160),
        type: String(
          concreteType || ""
        ),
        typeVar:
          concreteType
            ? ""
            : String(
                specification.typeVar ||
                ""
              ),
        constraint: String(
          specification.constraint ||
          "value"
        ),
        autoExposed: true,
        internalNodeId: nodeId,
        internalPortId: portId
      };
      boundaries.push(boundary);
      boundaryByEndpoint.set(
        endpointKey,
        boundary
      );
      addedBoundaries += 1;
      return boundary;
    };

    const materializedConnections =
      sourceComposite.connections.map(
        connection =>
          nodeGraphClone(connection)
      );
    for (const sourceConnection of
      sourceGraph.connections) {
      const connection =
        nodeGraphClone(sourceConnection);
      if (
        connection.fromNode ===
          containerId
      ) {
        const boundary =
          outputBoundaryById.get(
            connection.fromPort
          );
        if (!boundary) {
          throw new Error(
            `API Composite output '${connection.fromPort}' is unavailable.`
          );
        }
        connection.fromNode =
          boundary.internalNodeId;
        connection.fromPort =
          boundary.internalPortId;
      }
      if (
        connection.toNode ===
          containerId
      ) {
        const boundary =
          inputBoundaryById.get(
            connection.toPort
          );
        if (!boundary) {
          throw new Error(
            `API Composite input '${connection.toPort}' is unavailable.`
          );
        }
        connection.toNode =
          boundary.internalNodeId;
        connection.toPort =
          boundary.internalPortId;
      }
      materializedConnections.push(
        connection
      );
    }

    const materializedById = new Map();
    for (const connection of
      materializedConnections) {
      const connectionId = String(
        connection?.id || ""
      );
      if (
        !connectionId ||
        materializedById.has(
          connectionId
        )
      ) {
        throw new Error(
          `The extended API Composite would contain a duplicate connection identity '${connectionId || "<unnamed>"}'.`
        );
      }
      materializedById.set(
        connectionId,
        connection
      );
    }
    for (const [connectionId, branch] of
      Object.entries(
        sourceComposite.branchRouting ||
        {}
      )) {
      const connection =
        materializedById.get(connectionId);
      const parent = materializedById.get(
        String(
          branch?.connectionId || ""
        )
      );
      const pointId = String(
        branch?.pointId || ""
      );
      if (
        !connection ||
        !parent ||
        !pointId ||
        !(
          Array.isArray(parent.points) &&
          parent.points.some(point =>
            String(point?.id || "") ===
              pointId
          )
        )
      ) {
        throw new Error(
          `The API Composite branch route '${connectionId}' is invalid.`
        );
      }
      connection.branchFrom = {
        connectionId: parent.id,
        pointId
      };
    }

    const connectionTouchesMembers =
      new Map(
        materializedConnections.map(
          connection => [
            connection.id,
            memberIds.has(
              connection.fromNode
            ) ||
              memberIds.has(
                connection.toNode
              )
          ]
        )
      );
    const branchRouting = {};
    for (const connection of
      materializedConnections) {
      const branch =
        connection.branchFrom;
      if (
        branch &&
        (
          connectionTouchesMembers.get(
            connection.id
          ) ||
          connectionTouchesMembers.get(
            branch.connectionId
          )
        )
      ) {
        branchRouting[connection.id] =
          nodeGraphClone(branch);
      }
    }

    const internalConnections = [];
    const externalConnections = [];
    for (const sourceConnection of
      materializedConnections) {
      const connection =
        nodeGraphClone(sourceConnection);
      const sourceInside =
        memberIds.has(
          connection.fromNode
        );
      const targetInside =
        memberIds.has(
          connection.toNode
        );
      if (sourceInside && targetInside) {
        internalConnections.push(
          connection
        );
        continue;
      }
      if (sourceInside) {
        const boundary = boundaryFor(
          connection.fromNode,
          connection.fromPort,
          "output"
        );
        connection.fromNode =
          containerId;
        connection.fromPort =
          boundary.id;
      }
      if (targetInside) {
        const boundary = boundaryFor(
          connection.toNode,
          connection.toPort,
          "input"
        );
        connection.toNode =
          containerId;
        connection.toPort =
          boundary.id;
      }
      externalConnections.push(
        connection
      );
    }

    const internallyWiredEndpoints =
      new Set();
    for (const connection of
      internalConnections) {
      internallyWiredEndpoints.add(
        apiCompositeBoundaryEndpointKey({
          direction: "output",
          internalNodeId:
            connection.fromNode,
          internalPortId:
            connection.fromPort
        })
      );
      internallyWiredEndpoints.add(
        apiCompositeBoundaryEndpointKey({
          direction: "input",
          internalNodeId:
            connection.toNode,
          internalPortId:
            connection.toPort
        })
      );
    }
    const boundaryCountBeforeCleanup =
      boundaries.length;
    boundaries = boundaries.filter(
      boundary =>
        !(
          internallyWiredEndpoints.has(
            apiCompositeBoundaryEndpointKey(
              boundary
            )
          )
        )
    );
    const removedBoundaries =
      boundaryCountBeforeCleanup -
      boundaries.length;

    normalizeConnectionRouting(
      internalConnections
    );
    apiCompositeRemoveInvalidOwnerConnections(
      {
        connections: externalConnections,
        branchRouting,
        selectedConnectionId: null,
        selectedWirePoint: null
      },
      containerId,
      boundaries
    );
    const existingConnectionIds = new Set([
      ...internalConnections.map(
        connection => connection.id
      ),
      ...externalConnections.map(
        connection => connection.id
      )
    ]);
    for (const connectionId of
      Object.keys(branchRouting)) {
      const branch = branchRouting[
        connectionId
      ];
      const parent = materializedById.get(
        branch.connectionId
      );
      if (
        !existingConnectionIds.has(
          connectionId
        ) ||
        !existingConnectionIds.has(
          branch.connectionId
        ) ||
        !parent?.points?.some(point =>
          point.id === branch.pointId
        )
      ) {
        delete branchRouting[
          connectionId
        ];
      }
    }

    const customCSharpSources =
      mergeCustomCSharpFileRegistry(
        mergeCustomCSharpFileRegistry(
          {},
          sourceComposite.customCSharpFiles
        ),
        sourceGraph.customCSharpFiles
      );
    const internalCustomCSharpFiles =
      customCSharpFilesForNodes(
        internalNodes,
        customCSharpSources
      );
    const candidateCustomCSharpFiles =
      mergeCustomCSharpFileRegistry(
        mergeCustomCSharpFileRegistry(
          {},
          sourceGraph.customCSharpFiles
        ),
        internalCustomCSharpFiles
      );

    const container =
      nodeGraphClone(sourceContainer);
    container.parameters = {
      ...(
        container.parameters &&
        typeof container.parameters ===
          "object"
          ? container.parameters
          : {}
      ),
      memberCount: internalNodes.length,
      boundaryPorts:
        nodeGraphClone(boundaries)
    };
    const title =
      savedApiCompositeCurrentName(
        container,
        sourceComposite
      );
    const portLayout =
      container.parameters?.portLayout ===
        "mirrored"
        ? "mirrored"
        : "standard";
    const previousSelectedWirePoint =
      sourceComposite.selectedWirePoint;
    const selectedWireConnection =
      previousSelectedWirePoint &&
      typeof previousSelectedWirePoint ===
        "object"
        ? internalConnections.find(
            connection =>
              connection.id ===
                previousSelectedWirePoint
                  .connectionId
          )
        : null;
    const selectedWirePoint =
      selectedWireConnection?.points?.some(
        point =>
          point.id ===
            previousSelectedWirePoint
              .pointId
      )
        ? nodeGraphClone(
            previousSelectedWirePoint
          )
        : null;
    const composite = {
      ...nodeGraphClone(sourceComposite),
      title,
      boundaryPorts:
        nodeGraphClone(boundaries),
      branchRouting,
      customCSharpFiles:
        internalCustomCSharpFiles,
      apiCompositeGraphs:
        internalOwnedGraphs,
      nodes: internalNodes,
      connections:
        internalConnections,
      selectedNodeId:
        sourceComposite.selectedNodeId ||
        internalNodes[0]?.id || null,
      selectedNodeIds:
        Array.isArray(
          sourceComposite.selectedNodeIds
        )
          ? sourceComposite.selectedNodeIds
              .filter(id =>
                memberIds.has(id)
              )
          : [],
      selectedConnectionId:
        internalConnections.some(
          connection =>
            connection.id ===
              sourceComposite.selectedConnectionId
        )
          ? sourceComposite.selectedConnectionId
          : null,
      selectedWirePoint,
      nextSequence: Math.max(
        1,
        Number(
          sourceComposite.nextSequence
        ) || 1,
        Number(sourceGraph.nextSequence) ||
          1
      )
    };
    savedApiCompositeApplyElementIdentity(
      composite,
      sourceComposite.elementIdentity
        ?.templateId || ""
    );
    const oldFingerprint = String(
      sourceComposite.contentFingerprint ||
      sourceContainer.parameters
        ?.apiCompositeFingerprint ||
      ""
    );

    const newFingerprint = "";
    composite.contentFingerprint =
      newFingerprint;
    composite.fingerprintNameKey =
      savedApiCompositeNameKey(title);
    composite.fingerprintPortLayout =
      portLayout;
    container.parameters.apiCompositeFingerprint =
      newFingerprint;

    const candidateNodes =
      sourceGraph.nodes
        .filter(node =>
          !peerIds.has(node.id)
        )
        .map(node =>
          node.id === containerId
            ? container
            : nodeGraphClone(node)
        );
    const candidateComposites = {
      ...(sourceGraph.apiCompositeGraphs ||
        {})
    };
    for (const peerId of peerCompositeIds) {
      delete candidateComposites[peerId];
    }
    candidateComposites[containerId] =
      composite;
    const candidate = {
      ...sourceGraph,
      apiCompositeGraphs:
        candidateComposites,
      customCSharpFiles:
        candidateCustomCSharpFiles,
      nodes: candidateNodes,
      connections:
        externalConnections,
      selectedNodeId: containerId,
      selectedNodeIds: [containerId],
      selectedConnectionId: null,
      selectedWirePoint: null
    };

    return {
      candidate,
      container,
      composite,
      oldFingerprint,
      newFingerprint,

      changed: true,
      addedNodeCount:
        plan.peerNodes.length,
      addedBoundaryCount:
        addedBoundaries,
      removedBoundaryCount:
        removedBoundaries
    };
  }

function createApiCompositeFromSelection() {
    if (
      !graph ||
      customCSharpEditor
    ) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.8b99badf9d8c"),
        "error"
      );
      return false;
    }
    if (apiCompositeEditor) {
      captureApiCompositeEditorView();
    }
    const activeDocument =
      apiCompositeEditor
        ? activeApiCompositeGraphDocument()
        : graph;
    const workingGraph =
      apiCompositeEditor
        ? {
            ...activeDocument,
            ...graphViewFrom(graph),
            apiCompositeGraphs:
              activeDocument
                .apiCompositeGraphs || {},
            customCSharpFiles:
              activeDocument
                .customCSharpFiles || {}
          }
        : graph;
    const commitWorkingCandidate =
      candidate => {

        const liveNodes = graph.nodes;
        const liveConnections =
          graph.connections;
        resetGraphRenderCaches();
        if (candidate.nodes !== liveNodes) {
          liveNodes.length =
            candidate.nodes.length;
          for (
            let index = 0;
            index < candidate.nodes.length;
            index += 1
          ) {
            liveNodes[index] =
              candidate.nodes[index];
          }
        }
        if (
          candidate.connections !==
            liveConnections
        ) {
          liveConnections.length =
            candidate.connections.length;
          for (
            let index = 0;
            index <
              candidate.connections.length;
            index += 1
          ) {
            liveConnections[index] =
              candidate.connections[index];
          }
        }
        const candidateView = {
          ...graphViewFrom(candidate),
          nodes: liveNodes,
          connections: liveConnections
        };
        if (apiCompositeEditor) {
          activeDocument.apiCompositeGraphs =
            candidate.apiCompositeGraphs;
          activeDocument.customCSharpFiles =
            candidate.customCSharpFiles;
          activeDocument.nodes = liveNodes;
          activeDocument.connections =
            liveConnections;
          applyGraphView(candidateView);
        } else {
          graph.apiCompositeGraphs =
            candidate.apiCompositeGraphs;
          graph.customCSharpFiles =
            candidate.customCSharpFiles;
          applyGraphView(candidateView);
        }
      };

    const selectedIds = new Set(
      Array.isArray(
        workingGraph.selectedNodeIds
      )
        ? workingGraph.selectedNodeIds
        : workingGraph.selectedNodeId
          ? [workingGraph.selectedNodeId]
          : []
    );
    const selectedNodes = workingGraph.nodes
      .filter(node =>
        selectedIds.has(node.id)
      );
    if (selectedNodes.length < 2) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.fc41f39b3356"),
        "error"
      );
      return false;
    }

    const selectedCompositeNodes =
      selectedNodes.filter(node =>
        node?.kind === "operator" &&
        node.operatorId ===
          "container.apiComposite"
      );
    if (selectedCompositeNodes.length > 0) {
      const extensionPlan =
        apiCompositeExtensionPlan(
          workingGraph,
          [...selectedIds]
        );
      if (!extensionPlan.valid) {
        showGraphMessage(
          extensionPlan.reason,
          "error"
        );
        return false;
      }

      const selectionAnalysis =
        currentAnalysis ||
        analyzeConnections(
          workingGraph.connections
        );
      if (!selectionAnalysis.valid) {
        showGraphMessage(
          selectionAnalysis.reason ||
          window.RMLI18n.t("ui.literal.cdc2d3d60f60"),
          "error"
        );
        return false;
      }

      let transaction;
      try {
        transaction =
          buildApiCompositeExtensionCandidate(
            workingGraph,
            extensionPlan,
            selectionAnalysis
          );
        const expanded =
          expandApiCompositeGraphDocument(
            transaction.candidate
          );
        const previousGraph = graph;
        let analysis;
        try {
          graph = expanded;
          graphNodeDefinitionCache =
            new WeakMap();
          analysis = analyzeConnections(
            expanded.connections
          );
        } finally {
          graph = previousGraph;
          graphNodeDefinitionCache =
            new WeakMap();
        }
        if (!analysis?.valid) {
          throw new Error(
            analysis?.reason ||
            window.RMLI18n.t("ui.literal.674056a9f1d3")
          );
        }
        if (!transaction.changed) {
          throw new Error(
            window.RMLI18n.t("ui.literal.821bf1e79662")
          );
        }
      } catch (error) {
        showGraphMessage(
          error instanceof Error
            ? error.message
            : String(error),
          "error"
        );
        return false;
      }

      commitWorkingCandidate(
        transaction.candidate
      );
      graphNodeDefinitionCache =
        new WeakMap();
      currentAnalysis = null;
      pruneConnections();
      renderGraphNodesAndWires();
      renderGraphInspector();
      scheduleGraphPaletteRender();
      scheduleAcceptedGraphPersistenceAfterPaint({
        refreshGeneratedOutput: true,
        refreshCompositeActions: true,
        mutationClass: "topology"
      });

      const targetName =
        savedApiCompositeCurrentName(
          transaction.container,
          transaction.composite
        );
      const saveTarget =
        resolveSavedApiCompositeSaveTarget(
          transaction.container,
          transaction.composite
        );
      const savedUpdateAvailable = Boolean(
        saveTarget.mode === "update" &&
        matchingSavedApiCompositeInstances(
          saveTarget.record,
          [transaction.container.id],
          { staleOnly: true }
        ).length > 0
      );
      showGraphMessage(
        `${transaction.addedNodeCount.toLocaleString(window.RMLI18n?.language || undefined)} node${transaction.addedNodeCount === 1 ? "" : "s"} added to '${targetName}'. The existing Composite identity and outer connections were preserved.${savedUpdateAvailable ? ` ${window.RMLI18n.t("ui.literal.82044ba6c457")}` : ""}`,
        "success"
      );
      return true;
    }

    const selectionAnalysis =
      currentAnalysis ||
      analyzeConnections(
        workingGraph.connections
      );
    if (!selectionAnalysis.valid) {
      showGraphMessage(
        selectionAnalysis.reason ||
        window.RMLI18n.t("ui.literal.c27c91e48fa0"),
        "error"
      );
      return false;
    }
    currentAnalysis = selectionAnalysis;

    const containerId =
      makeId("api-composite");
    const boundaryByEndpoint = new Map();
    const boundaries = [];
    let inputIndex = 0;
    let outputIndex = 0;
    const boundaryFor = (
      nodeId,
      portId,
      direction
    ) => {
      const key =
        `${direction}\u0000${nodeId}\u0000${portId}`;
      if (boundaryByEndpoint.has(key)) {
        return boundaryByEndpoint.get(key);
      }
      const proxyId = direction === "input"
        ? `input-${++inputIndex}`
        : `output-${++outputIndex}`;
      const boundary =
        apiCompositePortDescriptor(
          nodeId,
          portId,
          direction,
          proxyId
        );
      if (!boundary) {
        throw new Error(
          `Cannot expose missing ${direction} port '${nodeId}.${portId}'.`
        );
      }
      boundaries.push(boundary);
      boundaryByEndpoint.set(key, boundary);
      return boundary;
    };

    const internalConnections = [];
    const externalConnections = [];
    const branchRouting = {};
    try {
      for (const sourceConnection of
        workingGraph.connections) {
        const connection =
          nodeGraphClone(sourceConnection);
        const sourceInside =
          selectedIds.has(
            connection.fromNode
          );
        const targetInside =
          selectedIds.has(
            connection.toNode
          );
        if (
          (sourceInside || targetInside) &&
          connection.branchFrom
        ) {
          branchRouting[connection.id] =
            nodeGraphClone(connection.branchFrom);
        }
        if (sourceInside && targetInside) {
          internalConnections.push(
            connection
          );
          continue;
        }
        if (sourceInside) {
          const boundary = boundaryFor(
            connection.fromNode,
            connection.fromPort,
            "output"
          );
          connection.fromNode =
            containerId;
          connection.fromPort =
            boundary.id;
        }
        if (targetInside) {
          const boundary = boundaryFor(
            connection.toNode,
            connection.toPort,
            "input"
          );
          connection.toNode =
            containerId;
          connection.toPort =
            boundary.id;
        }
        externalConnections.push(
          connection
        );
      }
    } catch (error) {
      showGraphMessage(
        error instanceof Error
          ? error.message
          : String(error),
        "error"
      );
      return false;
    }

    const internalConnectionIds = new Set(
      internalConnections.map(
        connection => connection.id
      )
    );
    const externalConnectionIds = new Set(
      externalConnections.map(
        connection => connection.id
      )
    );
    for (const connection of
      internalConnections) {
      if (
        connection.branchFrom &&
        !internalConnectionIds.has(
          connection.branchFrom
            .connectionId
        )
      ) {
        connection.branchFrom = null;
      }
    }
    for (const connection of
      externalConnections) {
      if (
        connection.branchFrom &&
        !externalConnectionIds.has(
          connection.branchFrom
            .connectionId
        )
      ) {
        connection.branchFrom = null;
      }
    }

    const minimumX = Math.min(
      ...selectedNodes.map(node => node.x)
    );
    const minimumY = Math.min(
      ...selectedNodes.map(node => node.y)
    );
    const title = `API Composite · ${selectedNodes.length.toLocaleString(window.RMLI18n?.language || undefined)} Nodes`;
    const containerNode = {
      id: containerId,
      kind: "operator",
      operatorId:
        "container.apiComposite",
      x: minimumX,
      y: minimumY,
      width: null,
      height: null,
      label: title,
      parameters: {
        title,
        memberCount:
          selectedNodes.length,
        boundaryPorts:
          nodeGraphClone(boundaries),
        portLayout: "standard"
      }
    };
    const composite = {
      version: 1,
      title,
      createdCatalogFingerprint: String(
        window.RMLApiNodeFactoryReport
          ?.catalogFingerprint || ""
      ),
      createdEngineVersion: String(
        window.RMLApiNodeFactoryReport
          ?.engineVersion || ""
      ),
      boundaryPorts:
        nodeGraphClone(boundaries),
      branchRouting,
      customCSharpFiles:
        customCSharpFilesForNodes(
          selectedNodes,
          workingGraph.customCSharpFiles
        ),
      apiCompositeGraphs:
        Object.fromEntries(
          selectedNodes
            .filter(node =>
              node.operatorId ===
                "container.apiComposite"
            )
            .map(node => [
              node.id,
              nodeGraphClone(
                workingGraph
                  .apiCompositeGraphs[
                    node.id
                  ]
              )
            ])
        ),
      nodes: selectedNodes.map(node =>
        nodeGraphClone(node)
      ),
      connections:
        internalConnections,
      viewport: {
        x: 56,
        y: 54,
        scale: 0.9
      },
      selectedNodeId:
        selectedNodes[0]?.id || null,
      selectedNodeIds:
        selectedNodes.map(node => node.id),
      selectedConnectionId: null,
      selectedWirePoint: null,
      nextSequence: Math.max(
        1,
        workingGraph.nextSequence
      )
    };
    savedApiCompositeApplyElementIdentity(
      composite
    );
    const remainingComposites = {
      ...(workingGraph.apiCompositeGraphs ||
        {})
    };
    for (const node of selectedNodes) {
      if (
        node.operatorId ===
          "container.apiComposite"
      ) {
        delete remainingComposites[node.id];
      }
    }
    remainingComposites[containerId] =
      composite;
    const candidate = {
      ...workingGraph,
      apiCompositeGraphs:
        remainingComposites,
      nodes: [
        ...workingGraph.nodes.filter(node =>
          !selectedIds.has(node.id)
        ),
        containerNode
      ],
      connections:
        externalConnections,
      selectedNodeId: containerId,
      selectedNodeIds: [containerId],
      selectedConnectionId: null,
      selectedWirePoint: null
    };

    try {
      const expanded =
        expandApiCompositeGraphDocument(
          candidate
        );
      const previousGraph = graph;
      let analysis;
      try {
        graph = expanded;
        analysis = analyzeConnections(
          expanded.connections
        );
      } finally {
        graph = previousGraph;
      }
      if (!analysis.valid) {
        throw new Error(
          analysis.reason ||
          window.RMLI18n.t("ui.literal.f222d35b71cc")
        );
      }
    } catch (error) {
      showGraphMessage(
        error instanceof Error
          ? error.message
          : String(error),
        "error"
      );
      return false;
    }

    commitWorkingCandidate(candidate);
    graphNodeDefinitionCache =
      new WeakMap();
    currentAnalysis = null;
    pruneConnections();
    renderGraphNodesAndWires();
    renderGraphInspector();
    scheduleGraphPaletteRender();
    scheduleAcceptedGraphPersistenceAfterPaint({
      refreshGeneratedOutput: true,
      refreshCompositeActions: true,
      mutationClass: "topology"
    });
    showGraphMessage(
      `${selectedNodes.length.toLocaleString(window.RMLI18n?.language || undefined)} nodes combined. Existing connections crossing the new Composite boundary were preserved; explicitly exposed ports remain available and no other unconnected ports were exposed automatically.`,
      "success"
    );
    return true;
  }

function unpackApiCompositeNode(
    containerNodeId
  ) {
    if (
      !graph ||
      customCSharpEditor ||
      apiCompositeEditor
    ) {
      return false;
    }
    const composite =
      graph.apiCompositeGraphs?.[
        containerNodeId
      ];
    const owner =
      findGraphNode(containerNodeId);
    if (!composite || !owner) {
      return false;
    }
    const minimumInternalX = Math.min(
      ...composite.nodes.map(node => node.x)
    );
    const minimumInternalY = Math.min(
      ...composite.nodes.map(node => node.y)
    );
    const unpackDeltaX =
      owner.x - minimumInternalX;
    const unpackDeltaY =
      owner.y - minimumInternalY;
    const boundaries =
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      );
    const inputById = new Map(
      boundaries
        .filter(boundary =>
          boundary.direction === "input"
        )
        .map(boundary => [
          boundary.id,
          boundary
        ])
    );
    const outputById = new Map(
      boundaries
        .filter(boundary =>
          boundary.direction === "output"
        )
        .map(boundary => [
          boundary.id,
          boundary
        ])
    );
    const connections = graph.connections
      .map(sourceConnection => {
        const connection =
          nodeGraphClone(sourceConnection);
        if (
          connection.fromNode ===
            containerNodeId
        ) {
          const boundary =
            outputById.get(
              connection.fromPort
            );
          if (!boundary) {
            throw new Error(
              `API Composite output '${connection.fromPort}' is unavailable.`
            );
          }
          connection.fromNode =
            boundary.internalNodeId;
          connection.fromPort =
            boundary.internalPortId;
        }
        if (
          connection.toNode ===
            containerNodeId
        ) {
          const boundary =
            inputById.get(
              connection.toPort
            );
          if (!boundary) {
            throw new Error(
              `API Composite input '${connection.toPort}' is unavailable.`
            );
          }
          connection.toNode =
            boundary.internalNodeId;
          connection.toPort =
            boundary.internalPortId;
        }
        return connection;
      });
    connections.push(
      ...composite.connections.map(
        connection => {
          const unpackedConnection =
            nodeGraphClone(connection);
          for (const point of
            unpackedConnection.points || []) {
            point.x += unpackDeltaX;
            point.y += unpackDeltaY;
          }
          return unpackedConnection;
        }
      )
    );
    const branchRouting =
      composite.branchRouting || {};
    for (const connection of connections) {
      if (
        Object.hasOwn(
          branchRouting,
          connection.id
        )
      ) {
        connection.branchFrom = nodeGraphClone(
          branchRouting[connection.id]
        );
      }
    }
    normalizeConnectionRouting(
      connections
    );
    const unpackedNodes = [
      ...graph.nodes.filter(node =>
        node.id !== containerNodeId
      ),
      ...composite.nodes.map(node => {
        const unpackedNode =
          nodeGraphClone(node);
        unpackedNode.x += unpackDeltaX;
        unpackedNode.y += unpackDeltaY;
        return unpackedNode;
      })
    ];
    const unpackedComposites = {
      ...(graph.apiCompositeGraphs || {})
    };
    graph.customCSharpFiles =
      mergeCustomCSharpFileRegistry(
        mergeCustomCSharpFileRegistry(
          {},
          composite.customCSharpFiles
        ),
        graph.customCSharpFiles
      );
    delete unpackedComposites[
      containerNodeId
    ];
    Object.assign(
      unpackedComposites,
      nodeGraphClone(
        composite.apiCompositeGraphs || {}
      )
    );
    const previousGraph = graph;
    let analysis;
    try {
      graph = {
        ...previousGraph,
        nodes: unpackedNodes,
        connections,
        apiCompositeGraphs:
          unpackedComposites
      };
      analysis = analyzeConnections(
        connections
      );
    } finally {
      graph = previousGraph;
    }
    if (!analysis?.valid) {
      throw new Error(
        analysis?.reason ||
        window.RMLI18n.t("ui.literal.76ed26784929")
      );
    }

    const liveNodes = graph.nodes;
    const liveConnections =
      graph.connections;
    resetGraphRenderCaches();
    liveNodes.length =
      unpackedNodes.length;
    for (
      let index = 0;
      index < unpackedNodes.length;
      index += 1
    ) {
      liveNodes[index] =
        unpackedNodes[index];
    }
    liveConnections.length =
      connections.length;
    for (
      let index = 0;
      index < connections.length;
      index += 1
    ) {
      liveConnections[index] =
        connections[index];
    }
    graph.apiCompositeGraphs =
      unpackedComposites;
    graph.selectedNodeIds =
      composite.nodes.map(node =>
        node.id
      );
    graph.selectedNodeId =
      graph.selectedNodeIds[0] || null;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    graphNodeDefinitionCache =
      new WeakMap();
    currentAnalysis = null;
    pruneConnections();
    renderGraphNodesAndWires();
    renderGraphInspector();
    scheduleAcceptedGraphPersistenceAfterPaint({
      refreshGeneratedOutput: true,
      refreshCompositeActions: true,
      mutationClass: "topology"
    });
    showGraphMessage(
      `API Composite unpacked. ${composite.nodes.length.toLocaleString(window.RMLI18n?.language || undefined)} node positions and all stored wire routes were restored.`,
      "success"
    );
    return true;
  }

function savedApiCompositeRequestedOpenContext(
    containerNodeId,
    ownerPath = null
  ) {
    const normalizedOwnerId = String(
      containerNodeId || ""
    );
    const byPath =
      openApiCompositeOwnerContextForPath(
        ownerPath
      );
    if (
      byPath?.ownerId ===
        normalizedOwnerId
    ) {
      return byPath;
    }
    const active =
      openApiCompositeOwnerContext();
    return active?.ownerId ===
      normalizedOwnerId
      ? active
      : null;
  }

function captureChangedOpenCompositeEditors({
    synchronizeBoundaries = true
  } = {}) {
    const customUnchanged = Boolean(
      customCSharpEditor &&
      typeof customCSharpEditorCompleteStateUnchangedSinceOpen ===
        "function" &&
      customCSharpEditorCompleteStateUnchangedSinceOpen(
        customCSharpEditor
      )
    );
    if (
      customCSharpEditor &&
      !customUnchanged
    ) {
      captureCustomCSharpEditorView();
    }
    const apiUnchanged = Boolean(
      customUnchanged ||
      (
        apiCompositeEditor &&
        apiCompositeEditorCompleteStateUnchangedSinceOpen(
          apiCompositeEditor,
          graph
        )
      )
    );
    if (
      apiCompositeEditor &&
      !apiUnchanged
    ) {
      captureApiCompositeEditorView(
        synchronizeBoundaries
          ? undefined
          : {
              synchronizeBoundaries: false
            }
      );
    }
    return {
      customUnchanged,
      apiUnchanged
    };
  }

function savedApiCompositeRecordFromNode(
    containerNodeId,
    {
      templateId = "",
      createdAt = "",
      ownerPath = null,
      openContext: suppliedOpenContext = null
    } = {}
  ) {
    let openContext =
      suppliedOpenContext ||
      savedApiCompositeRequestedOpenContext(
        containerNodeId,
        ownerPath
      );
    if (
      openContext?.ownerId ===
        containerNodeId &&
      openContext.editor ===
        apiCompositeEditor
    ) {
      captureChangedOpenCompositeEditors();
      openContext =
        savedApiCompositeRequestedOpenContext(
          containerNodeId,
          ownerPath ||
            openContext.ownerPath
        );
    }
    const owner =
      openContext?.ownerId ===
        containerNodeId
        ? openContext.owner
        : findGraphNode(containerNodeId);
    const composite =
      openContext?.ownerId ===
        containerNodeId
        ? openContext.composite
        : apiCompositeVisibleOwnedGraph(
            containerNodeId
          );
    if (
      !owner ||
      owner.operatorId !==
        "container.apiComposite" ||
      !composite
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.d9b16d91eaf8")
      );
    }
    const compositeForRecord = {
      ...nodeGraphClone(composite),
      customCSharpFiles:
        customCSharpFilesForNodes(
          composite.nodes,
          composite.customCSharpFiles
        )
    };
    const identity =
      currentApiCompositeCatalogIdentity();
    const name =
      savedApiCompositeCurrentName(
        owner,
        composite
      );
    return sanitizeSavedApiCompositeRecord({
      id:
        templateId ||
        savedApiCompositeIdentifier(),
      name,
      createdAt:
        createdAt ||
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
      resolvedCatalogFingerprint:
        identity.fingerprint,
      resolvedEngineVersion:
        identity.engineVersion,
      composite: {
        ...compositeForRecord,
        title: name,
        portLayout:
          owner.parameters?.portLayout ===
            "mirrored"
            ? "mirrored"
            : "standard",
        createdCatalogFingerprint:
          templateId
            ? String(
                compositeForRecord
                  .createdCatalogFingerprint ||
                ""
              )
            : identity.fingerprint,
        createdEngineVersion:
          templateId
            ? String(
                compositeForRecord
                  .createdEngineVersion ||
                ""
              )
            : identity.engineVersion
      }
    }, {
      deferContentFingerprint: true
    });
  }

async function saveApiCompositeNode(
    containerNodeId,
    {
      asNew = false,
      ownerPath = null,
      expectedSavedId = ""
    } = {}
  ) {
    if (!apiCompositeCatalogAvailable()) {
      throw new Error(
        window.RMLI18n.t("ui.literal.feaba2cf1b66")
      );
    }
    await loadSavedApiCompositeLibrary();
    const saveOperationKey =
      "composite-inspector-save";
    if (savedApiCompositeLibraryBusy()) {
      throw new Error(
        window.RMLI18n.t("ui.literal.e25f5ee949a2")
      );
    }
    if (
      Array.isArray(ownerPath) &&
      ownerPath.length > 0
    ) {
      captureChangedOpenCompositeEditors({
        synchronizeBoundaries: false
      });
    }
    const openContext =
      savedApiCompositeRequestedOpenContext(
        containerNodeId,
        ownerPath
      );
    if (
      Array.isArray(ownerPath) &&
      ownerPath.length > 0 &&
      !openContext
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.aad9f2824150")
      );
    }
    const requestedOwnerPath =
      openContext?.ownerPath ||
      (Array.isArray(ownerPath)
        ? [...ownerPath]
        : null);
    const currentTargetOpenContext = () =>
      savedApiCompositeRequestedOpenContext(
        containerNodeId,
        requestedOwnerPath
      );
    const owner =
      openContext?.ownerId ===
        containerNodeId
        ? openContext.owner
        : findGraphNode(containerNodeId);
    if (!owner) {
      throw new Error(
        window.RMLI18n.t("ui.literal.42bc4d9827df")
      );
    }
    const composite =
      openContext?.ownerId ===
        containerNodeId
        ? openContext.composite
        : apiCompositeVisibleOwnedGraph(
            containerNodeId
          );
    const target =
      resolveSavedApiCompositeSaveTarget(
        owner,
        composite
      );
    const expectedRecordId = String(
      expectedSavedId || ""
    );
    if (
      expectedRecordId &&
      (
        target.mode !== "update" ||
        String(target.record?.id || "") !==
          expectedRecordId
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.cae31487d3c7")
      );
    }
    if (target.mode === "ambiguous") {
      throw new Error(
        target.issue ||
        `The Saved API Composite identity for '${target.name}' is ambiguous.`
      );
    }
    if (
      asNew &&
      target.mode !== "save"
    ) {
      throw new Error(
        `A Saved API Composite named '${target.name}' already exists. Choose a new name before saving a new Composite.`
      );
    }
    const existing =
      target.mode === "update"
        ? target.record
        : null;
    savedApiCompositeOperations.add(
      saveOperationKey
    );
    refreshVisibleApiCompositeInspectorSaveActions();
    showGraphMessage(
      existing
        ? `Preparing Saved API Composite '${target.name}' for update…`
        : `Preparing Saved API Composite '${target.name}'…`
    );
    await savedApiCompositePaintOpportunity();
    let stagedRecordBaselineIdentity = "";
    try {
    const preRecordContext =
      currentTargetOpenContext();
    if (
      preRecordContext?.ownerId ===
        containerNodeId &&
      preRecordContext.editor !==
        apiCompositeEditor &&
      customCSharpEditor
    ) {
      captureChangedOpenCompositeEditors();
    }
    const record =
      savedApiCompositeRecordFromNode(
        containerNodeId,
        {
          templateId:
            existing?.id || "",
          createdAt:
            existing?.createdAt || "",
          ownerPath:
            requestedOwnerPath,
          openContext:
            currentTargetOpenContext()
        }
      );
    const submittedContext =
      currentTargetOpenContext();
    const submittedOwner =
      submittedContext?.ownerId ===
        containerNodeId
        ? submittedContext.owner
        : findGraphNode(containerNodeId);
    const submittedComposite =
      submittedContext?.ownerId ===
        containerNodeId
        ? submittedContext.composite
        : apiCompositeVisibleOwnedGraph(
            containerNodeId
          );
    if (
      !submittedOwner ||
      !submittedComposite
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.42bc4d9827df")
      );
    }
    const submittedProjectEpoch =
      typeof builderProjectEpoch ===
        "undefined"
        ? null
        : builderProjectEpoch;
    const submittedDocumentRevision =
      savedApiCompositeCompareDocumentRevision(
        submittedComposite,
        submittedContext?.ownerPath ||
          requestedOwnerPath
      );
    const submittedGraphMutationSequence =
      typeof graphContentMutationSequence ===
        "undefined"
        ? null
        : graphContentMutationSequence;
    const submissionIsCurrent = () => {
      const current = currentTargetOpenContext();
      const currentOwner =
        current?.ownerId === containerNodeId
          ? current.owner
          : findGraphNode(containerNodeId);
      const currentComposite =
        current?.ownerId === containerNodeId
          ? current.composite
          : apiCompositeVisibleOwnedGraph(
              containerNodeId
            );
      return Boolean(
        currentOwner === submittedOwner &&
        currentComposite === submittedComposite &&
        savedApiCompositeCompareDocumentRevision(
          submittedComposite,
          current?.ownerPath ||
            requestedOwnerPath
        ) === submittedDocumentRevision &&
        (
          submittedGraphMutationSequence === null ||
          typeof graphContentMutationSequence ===
            "undefined" ||
          graphContentMutationSequence ===
            submittedGraphMutationSequence
        ) &&
        Object.is(
          submittedProjectEpoch,
          typeof builderProjectEpoch ===
            "undefined"
            ? null
            : builderProjectEpoch
        )
      );
    };
    stagedRecordBaselineIdentity =
      `staged-record:${record.id}:${nextSavedApiCompositeCompareRequestId("record")}`;
    const stagedRecordBaseline =
      await streamSavedApiCompositeComparison({
        value: record.composite,
        targetOperation: "install-baseline",
        compositeIdentity:
          `staged-record-controller:${record.id}`,
        baselineIdentity:
          stagedRecordBaselineIdentity,
        revision:
          nextSavedApiCompositeCompareProtocolRevision(),
        isCurrent: submissionIsCurrent
      });
    if (
      !stagedRecordBaseline?.ok ||
      stagedRecordBaseline.stale ||
      !stagedRecordBaseline.fingerprint ||
      !submissionIsCurrent()
    ) {
      throw new Error(
        stagedRecordBaseline?.error ||
        stagedRecordBaseline?.reason ||
        window.RMLI18n.t("ui.literal.81f4535fde4f")
      );
    }
    record.contentFingerprint = String(
      stagedRecordBaseline.fingerprint
    );
    record.composite.contentFingerprint =
      record.contentFingerprint;
    let stored;
    [stored] =
      await persistSavedApiCompositeRecords([
        record
      ], {
        recordsAreSanitized: true,
        fingerprintsAreWorkerVerified: true
      });
    try {
      await promoteSavedApiCompositeCompareBaseline(
        stagedRecordBaselineIdentity,
        stored
      );
      stagedRecordBaselineIdentity = "";
    } catch (error) {

      savedApiCompositeCompareRecordChanged(
        stored.id,
        stored
      );
      console.warn(
        window.RMLI18n.t("ui.literal.7d12cba04518"),
        error
      );
    }
    const postAwaitProjectEpoch =
      typeof builderProjectEpoch ===
        "undefined"
        ? null
        : builderProjectEpoch;
    const postAwaitContext =
      currentTargetOpenContext();
    const postAwaitOwner =
      postAwaitContext?.ownerId ===
        containerNodeId
        ? postAwaitContext.owner
        : findGraphNode(containerNodeId);
    const postAwaitSaveContextMatches =
      postAwaitOwner === submittedOwner &&
      postAwaitProjectEpoch ===
        submittedProjectEpoch;
    if (
      postAwaitSaveContextMatches &&
      postAwaitContext?.owner ===
        submittedOwner &&
      typeof apiCompositeEditor !==
        "undefined" &&
      apiCompositeEditor
        ?.containerNodeId ===
        containerNodeId
    ) {
      captureChangedOpenCompositeEditors();
    }
    const liveContext =
      currentTargetOpenContext();
    const liveOwner =
      liveContext?.ownerId ===
        containerNodeId
        ? liveContext.owner
        : findGraphNode(containerNodeId);
    let ownedComposite =
      liveContext?.ownerId ===
        containerNodeId
        ? liveContext.composite
        : apiCompositeVisibleOwnedGraph(
            containerNodeId
          );
    let installedStoredSnapshot = false;
    let installedLiveMetadata = false;
    const liveProjectEpoch =
      typeof builderProjectEpoch ===
        "undefined"
        ? null
        : builderProjectEpoch;
    const liveSaveContextStillCurrent =
      Boolean(
        liveOwner &&
        ownedComposite &&
        liveOwner === submittedOwner &&
        liveProjectEpoch ===
          submittedProjectEpoch
      );
    const storedSnapshotStillCurrent =
      Boolean(
        liveSaveContextStillCurrent &&
        submissionIsCurrent()
      );
    if (liveOwner && ownedComposite) {
      const liveParameters =
        liveOwner.parameters &&
        typeof liveOwner.parameters ===
          "object"
          ? liveOwner.parameters
          : {};
      if (liveSaveContextStillCurrent) {
        liveOwner.parameters =
          liveParameters;
      }
      const liveName =
        savedApiCompositeCurrentName(
          liveOwner,
          ownedComposite
        );
      const liveNameMatches =
        savedApiCompositeNameKey(
          liveName
        ) ===
        savedApiCompositeNameKey(
          stored.name
        );
      const livePortLayout =
        liveParameters
          .portLayout === "mirrored"
          ? "mirrored"
          : "standard";
      if (
        storedSnapshotStillCurrent
      ) {
        const installedSnapshot =
          savedApiCompositeInstallCommittedSnapshot(
            ownedComposite,
            stored.composite,
            liveContext?.ownerPath || []
          );
        const installedComposite =
          installedSnapshot;
        installedStoredSnapshot = true;
        liveOwner.parameters.boundaryPorts =
          nodeGraphClone(
            installedComposite
              .boundaryPorts || []
          );
        liveOwner.parameters.memberCount =
          Array.isArray(
            installedComposite.nodes
          )
            ? installedComposite.nodes.length
            : 0;
      }
      if (liveSaveContextStillCurrent) {
        if (liveNameMatches) {
          installedLiveMetadata =
            liveOwner.parameters.title !==
              liveName ||
            ownedComposite.title !==
              liveName ||
            liveOwner.parameters
              .savedApiCompositeId !==
              stored.id ||
            liveOwner.parameters
              .savedApiCompositeUpdatedAt !==
              stored.updatedAt;
          liveOwner.parameters.title =
            liveName;
          ownedComposite.title =
            liveName;
          liveOwner.parameters
            .savedApiCompositeId =
            stored.id;
          liveOwner.parameters
            .savedApiCompositeUpdatedAt =
            stored.updatedAt;
        }
        if (storedSnapshotStillCurrent) {
          liveOwner.parameters
            .apiCompositeFingerprint =
            stored.contentFingerprint;
          ownedComposite.contentFingerprint =
            stored.contentFingerprint;
          ownedComposite.fingerprintNameKey =
            savedApiCompositeNameKey(
              liveName
            );
          ownedComposite
            .fingerprintPortLayout =
            livePortLayout;
        }
      }
    }
    if (
      liveSaveContextStillCurrent &&
      installedStoredSnapshot
    ) {
      if (
        typeof graphNodeDefinitionCache !==
          "undefined"
      ) {
        graphNodeDefinitionCache =
          new WeakMap();
      }
      if (
        typeof currentAnalysis !==
          "undefined"
      ) {
        currentAnalysis = null;
      }
      if (
        typeof resetGraphRenderCaches ===
        "function"
      ) {
        resetGraphRenderCaches();
      }
    }
    if (
      liveSaveContextStillCurrent &&
      (
        installedStoredSnapshot ||
        installedLiveMetadata
      )
    ) {
      scheduleAcceptedGraphPersistenceAfterPaint({
        refreshGeneratedOutput: true,
        refreshCompositeActions: true,
        mutationClass: "view",
        analysisChanged: false,
        contentChanged: false,
        documentChanged: true
      });
    }
    if (
      liveSaveContextStillCurrent &&
      installedStoredSnapshot
    ) {
      if (
        typeof renderGraphNodesAndWires ===
        "function"
      ) {
        renderGraphNodesAndWires();
      }
    }
    scheduleGraphPaletteRender();
    renderGraphInspector();
    showGraphMessage(
      `${existing
        ? `Saved API Composite '${stored.name}' updated.`
        : `Saved API Composite '${stored.name}' added to the node library.`}${
        storedSnapshotStillCurrent
          ? ""
          : ` The placed Composite changed while '${stored.name}' was being saved. Those later changes were preserved and remain unsaved.`
      }`,
      storedSnapshotStillCurrent
        ? "success"
        : "warning"
    );
    return stored;
    } finally {
      const temporaryBaselines = [
        stagedRecordBaselineIdentity
      ].filter(Boolean);
      if (temporaryBaselines.length > 0) {
        await Promise.allSettled(
          temporaryBaselines.map(
            baselineIdentity =>
              dropSavedApiCompositeCompareBaseline(
                baselineIdentity,
                `save-cleanup:${containerNodeId}`
              )
          )
        );
      }
      savedApiCompositeOperations.delete(
        saveOperationKey
      );
      refreshVisibleApiCompositeInspectorSaveActions();
      scheduleGraphPaletteRender();
    }
  }

function assertSavedApiCompositeExportUniqueness(
    records
  ) {
    const identities = new Map();
    const names = new Map();
    records.forEach((record, index) => {
      const position = index + 1;
      const identity = String(
        record?.id || ""
      );
      const name = String(
        record?.name || ""
      );
      const nameKey =
        savedApiCompositeNameKey(name);
      if (identities.has(identity)) {
        throw new Error(
          `Saved API Composite export is ambiguous: entries ${identities.get(identity)} and ${position} share template identity '${identity}'. Nothing was exported.`
        );
      }
      identities.set(identity, position);

      if (names.has(nameKey)) {
        throw new Error(
          `Saved API Composite export is ambiguous: entries ${names.get(nameKey)} and ${position} share the normalized name '${name}'. Rename one Composite before exporting. Nothing was exported.`
        );
      }
      names.set(nameKey, position);
    });
    return records;
  }

function savedApiCompositeExportPayload(
    records
  ) {
    const normalized = records.map(record =>
      sanitizeSavedApiCompositeRecord(record)
    );
    assertSavedApiCompositeExportUniqueness(
      normalized
    );
    const identity =
      currentApiCompositeCatalogIdentity();
    return {
      schema:
        SAVED_API_COMPOSITE_EXPORT_SCHEMA,
      schemaVersion:
        SAVED_API_COMPOSITE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      catalogFingerprint:
        identity.fingerprint,
      engineVersion:
        identity.engineVersion,
      composites: normalized.map(record =>
        nodeGraphClone(record)
      )
    };
  }

function savedApiCompositeFileStem(value) {
    return String(
      value || "Saved-API-Composite"
    )
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) ||
      "Saved-API-Composite";
  }

async function downloadSavedApiCompositeRecords(
    records,
    filename
  ) {
    const payload =
      savedApiCompositeExportPayload(
        records
      );
    const codec =
      window.RMLJsonFileCodec;
    if (
      typeof codec?.compress !==
        "function"
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.56aed8becc07")
      );
    }
    const compressed =
      await codec.compress(payload);
    const download =
      window.RMLFileDownload?.blob;
    if (typeof download !== "function") {
      throw new Error(
        window.RMLI18n.t("ui.literal.3fb1caafc6fa")
      );
    }
    download(
      compressed.blob,
      filename
    );
    return compressed;
  }

function savedApiCompositeRecordsFromJson(
    payload
  ) {
    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload) ||
      payload.schema !==
        SAVED_API_COMPOSITE_EXPORT_SCHEMA ||
      Number(payload.schemaVersion) !==
        SAVED_API_COMPOSITE_SCHEMA_VERSION
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.7eacbeb82a99")
      );
    }
    const sources =
      Array.isArray(payload.composites)
        ? payload.composites
        : payload.composite
          ? [payload.composite]
          : [];
    if (
      sources.length === 0 ||
      sources.length >
        SAVED_API_COMPOSITE_MAX_IMPORT_COUNT
    ) {
      throw new Error(
        `A Saved API Composite JSON must contain between 1 and ${SAVED_API_COMPOSITE_MAX_IMPORT_COUNT.toLocaleString(window.RMLI18n?.language || undefined)} templates.`
      );
    }
    let totalNodes = 0;
    let totalConnections = 0;
    const importedIds = new Set();
    const records = sources.map(source => {
      const fingerprintWasMissing =
        !String(
          source?.contentFingerprint ||
          source?.composite
            ?.contentFingerprint ||
          ""
        ).trim();
      let record =
        sanitizeSavedApiCompositeImportRecord(
          source,
          { preserveId: true }
        );
      const importedComposite =
        nodeGraphClone(record.composite);
      const importRepair =
        repairSavedApiCompositeMissingPortTopology(
          importedComposite
        );
      if (
        importRepair.disconnectedConnections > 0 ||
        importRepair.removedBoundaries > 0
      ) {
        record =
          sanitizeSavedApiCompositeRecord({
            ...record,
            composite: {
              ...importedComposite,
              title: record.name
            }
          });
      }
      if (fingerprintWasMissing) {
        Object.defineProperty(
          record,
          SAVED_API_COMPOSITE_LEGACY_FINGERPRINT,
          {
            value: true,
            enumerable: false,
            configurable: false
          }
        );
      }
      if (importedIds.has(record.id)) {
        throw new Error(
          `Saved API Composite JSON contains duplicate template identity '${record.id}'. Nothing was imported.`
        );
      }
      importedIds.add(record.id);
      totalNodes +=
        record.composite.nodes.length;
      totalConnections +=
        record.composite.connections.length;
      return record;
    });
    if (
      totalNodes >
        SAVED_API_COMPOSITE_MAX_NODES ||
      totalConnections >
        SAVED_API_COMPOSITE_MAX_CONNECTIONS
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.6fe95aa604ac")
      );
    }
    return records;
  }

async function confirmSavedApiCompositeUpdate(
    existing,
    incoming,
    {
      source = "import",
      matchedByName = false,
      legacyFingerprint = false,
      duplicateCount = 0
    } = {}
  ) {
    const confirm =
      window.RMLBuilderDialog?.confirm;
    if (typeof confirm !== "function") {
      return false;
    }
    return Boolean(
      await confirm({
        tone: "warning",
        kicker:
          source === "catalog"
            ? window.RMLI18n.t("composite.dialog.kicker.catalog_update")
            : legacyFingerprint
              ? window.RMLI18n.t("composite.dialog.kicker.legacy_fingerprint")
            : matchedByName
              ? window.RMLI18n.t("composite.dialog.kicker.exact_name")
            : window.RMLI18n.t("composite.dialog.kicker.saved_update"),
        title:
          window.RMLI18n.format("composite.dialog.update_title", { name: existing.name }),
        message:
          source === "catalog"
            ? window.RMLI18n.t("ui.literal.d48c301fc938")
            : legacyFingerprint
              ? window.RMLI18n.t("ui.literal.17834fc169af")
            : matchedByName
              ? window.RMLI18n.t("ui.literal.53a401cc672c")
            : window.RMLI18n.t("ui.literal.b74ddf09775f"),
        details:
          `Existing: ${existing.composite.nodes.length.toLocaleString(window.RMLI18n?.language || undefined)} nodes and ${existing.composite.connections.length.toLocaleString(window.RMLI18n?.language || undefined)} connections. Imported: ${incoming.composite.nodes.length.toLocaleString(window.RMLI18n?.language || undefined)} nodes and ${incoming.composite.connections.length.toLocaleString(window.RMLI18n?.language || undefined)} connections.${matchedByName ? ` Existing identity: ${existing.id}. Imported identity: ${incoming.id}.` : ""}${legacyFingerprint ? ` Generated fingerprint: ${incoming.contentFingerprint}.` : ""}${duplicateCount > 0 ? ` ${duplicateCount.toLocaleString(window.RMLI18n?.language || undefined)} duplicate Saved Composite entr${duplicateCount === 1 ? "y" : "ies"} with this exact normalized name will be consolidated into the retained identity.` : ""} After the library update, matching placed graph instances are offered for replacement separately.`,
        confirmLabel:
          window.RMLI18n.t("ui.literal.fdc53a8e7d75"),
        cancelLabel:
          source === "catalog"
            ? window.RMLI18n.t("composite.dialog.cancel.keep_unavailable")
            : window.RMLI18n.t("composite.dialog.cancel.discard_imported")
      })
    );
  }

function savedApiCompositeCatalogKey() {
    if (!apiCompositeCatalogAvailable()) {
      return "";
    }
    const identity =
      currentApiCompositeCatalogIdentity();
    return identity.fingerprint
      ? `${identity.fingerprint}\u0000${identity.engineVersion}`
      : "";
  }

function savedApiCompositeIssueRecord(
    record,
    identity,
    reason
  ) {
    return sanitizeSavedApiCompositeRecord({
      ...record,
      compatibilityIssueFingerprint:
        identity.fingerprint,
      compatibilityIssueEngineVersion:
        identity.engineVersion,
      compatibilityIssueReason:
        String(
          reason ||
          window.RMLI18n.t("ui.literal.a50b095ee926")
        ).slice(0, 1000),
      compatibilityIssueCheckedAt:
        new Date().toISOString()
    });
  }

function savedApiCompositeResolutionCancelled(
    error
  ) {
    return Boolean(
      error?.code ===
        "RML_PROJECT_IMPORT_CANCELLED" ||
      error?.cancelSource
    );
  }

async function confirmIncompatibleSavedApiCompositeDeletion(
    record,
    error
  ) {
    const confirm =
      window.RMLBuilderDialog?.confirm;
    if (typeof confirm !== "function") {
      return false;
    }
    const reason = String(
      error instanceof Error
        ? error.message
        : error
    ).trim();
    return Boolean(
      await confirm({
        tone: "danger",
        kicker:
          window.RMLI18n.t("ui.auto.2ad1119c6d30"),
        title:
          window.RMLI18n.format("composite.dialog.delete_title", { name: record.name }),
        message:
          window.RMLI18n.t("ui.auto.b229a7d5f8d7"),
        details:
          reason.slice(0, 800),
        confirmLabel:
          window.RMLI18n.t("js.presentation.6b5be4a55679"),
        cancelLabel:
          window.RMLI18n.t("ui.literal.77ceb57d024e")
      })
    );
  }

async function reconcileSavedApiCompositeLibraryForCatalog(
    catalogKey
  ) {
    await loadSavedApiCompositeLibrary();
    if (
      !catalogKey ||
      catalogKey !==
        savedApiCompositeCatalogKey()
    ) {
      return {
        stale: true,
        catalogKey
      };
    }
    const identity =
      currentApiCompositeCatalogIdentity();
    const updates = [];
    const deletionIds = [];
    const summary = {
      verified: 0,
      refreshed: 0,
      updated: 0,
      unavailable: 0,
      deleted: 0
    };
    const records = [
      ...savedApiCompositeTemplates.values()
    ];
    for (const existing of records) {
      if (
        catalogKey !==
          savedApiCompositeCatalogKey()
      ) {
        return {
          stale: true,
          catalogKey
        };
      }
      if (
        existing.compatibilityIssueFingerprint ===
          identity.fingerprint &&
        existing.compatibilityIssueEngineVersion ===
          identity.engineVersion &&
        existing.compatibilityIssueReason
      ) {
        savedApiCompositeCompatibilityIssues.set(
          existing.id,
          existing.compatibilityIssueReason
        );
        summary.unavailable += 1;
        continue;
      }
      if (
        existing.resolvedCatalogFingerprint ===
          identity.fingerprint &&
        existing.resolvedEngineVersion ===
          identity.engineVersion
      ) {
        savedApiCompositeCompatibilityIssues.delete(
          existing.id
        );
        summary.verified += 1;
        continue;
      }
      try {
        const resolved =
          await resolveSavedApiCompositeForCurrentCatalog(
            existing,
            {
              persistResolved: false,
              allowFingerprintShortcut:
                false,
              sourceRecordIsSanitized:
                true
            }
          );
        const contentChanged =
          !(await savedApiCompositeRecordsExactlyEquivalent(
            existing,
            resolved,
            `catalog:${existing.id}`
          ));
        if (
          contentChanged &&
          !(await confirmSavedApiCompositeUpdate(
            existing,
            resolved,
            { source: "catalog" }
          ))
        ) {
          const issue =
            savedApiCompositeIssueRecord(
              existing,
              identity,
              window.RMLI18n.t("ui.literal.285db977e0b5")
            );
          updates.push(issue);
          savedApiCompositeCompatibilityIssues.set(
            existing.id,
            issue.compatibilityIssueReason
          );
          summary.unavailable += 1;
          continue;
        }
        const compatible =
          sanitizeSavedApiCompositeRecord({
            ...resolved,
            id: existing.id,
            createdAt:
              existing.createdAt,
            updatedAt: contentChanged
              ? new Date().toISOString()
              : existing.updatedAt,
            compatibilityIssueFingerprint:
              "",
            compatibilityIssueEngineVersion:
              "",
            compatibilityIssueReason: "",
            compatibilityIssueCheckedAt:
              ""
          });
        updates.push(compatible);
        savedApiCompositeCompatibilityIssues.delete(
          existing.id
        );
        if (contentChanged) {
          summary.updated += 1;
        } else {
          summary.refreshed += 1;
        }
      } catch (error) {
        const cancelled =
          savedApiCompositeResolutionCancelled(
            error
          );
        const shouldDelete =
          !cancelled &&
          await confirmIncompatibleSavedApiCompositeDeletion(
            existing,
            error
          );
        if (shouldDelete) {
          deletionIds.push(existing.id);
          savedApiCompositeCompatibilityIssues.delete(
            existing.id
          );
          summary.deleted += 1;
          continue;
        }
        const issue =
          savedApiCompositeIssueRecord(
            existing,
            identity,
            cancelled
              ? "Catalog replacement was cancelled. Click the saved Composite to retry, or delete it with its × button."
              : error
        );
        updates.push(issue);
        savedApiCompositeCompatibilityIssues.set(
          existing.id,
          issue.compatibilityIssueReason
        );
        summary.unavailable += 1;
      }
    }
    if (
      catalogKey !==
        savedApiCompositeCatalogKey()
    ) {
      return {
        stale: true,
        catalogKey
      };
    }
    await applySavedApiCompositeReconciliation(
      updates,
      deletionIds,
      {
        recordsAreSanitized: true
      }
    );
    scheduleGraphPaletteRender();
    if (graph?.active) {
      renderGraphInspector();
    }
    if (
      graph?.active &&
      runtimeGraphViewActive &&
      (
        summary.updated > 0 ||
        summary.unavailable > 0 ||
        summary.deleted > 0
      )
    ) {
      showGraphMessage(
        `Saved API Composites checked individually: ${summary.verified.toLocaleString(window.RMLI18n?.language || undefined)} unchanged, ${summary.refreshed.toLocaleString(window.RMLI18n?.language || undefined)} catalog-refreshed, ${summary.updated.toLocaleString(window.RMLI18n?.language || undefined)} updated, ${summary.unavailable.toLocaleString(window.RMLI18n?.language || undefined)} unavailable and ${summary.deleted.toLocaleString(window.RMLI18n?.language || undefined)} deleted.`,
        summary.unavailable > 0
          ? "error"
          : "success"
      );
    }
    return {
      stale: false,
      catalogKey,
      ...summary
    };
  }

function scheduleSavedApiCompositeCatalogReconciliation() {
    const catalogKey =
      savedApiCompositeCatalogKey();
    if (!catalogKey) {
      return Promise.resolve(null);
    }
    if (
      !savedApiCompositeReconciliationPromise &&
      savedApiCompositeReconciliationCompletedKey ===
        catalogKey
    ) {
      return Promise.resolve(null);
    }
    savedApiCompositeReconciliationRequestedKey =
      catalogKey;
    if (
      savedApiCompositeLibraryBusy() ||
      openGraphCatalogReconciliationPromise
    ) {
      return Promise.resolve(null);
    }
    if (
      savedApiCompositeReconciliationPromise
    ) {
      return savedApiCompositeReconciliationPromise;
    }
    savedApiCompositeOperations.add(
      "catalog-reconciliation"
    );
    savedApiCompositeReconciliationPromise =
      (async () => {
        let result = null;
        while (
          savedApiCompositeReconciliationRequestedKey &&
          savedApiCompositeReconciliationRequestedKey !==
            savedApiCompositeReconciliationCompletedKey
        ) {
          const requestedKey =
            savedApiCompositeReconciliationRequestedKey;
          savedApiCompositeReconciliationRequestedKey =
            "";
          result =
            await reconcileSavedApiCompositeLibraryForCatalog(
              requestedKey
            );
          if (
            result?.stale !== true &&
            requestedKey ===
              savedApiCompositeCatalogKey()
          ) {
            savedApiCompositeReconciliationCompletedKey =
              requestedKey;
          } else {
            const currentKey =
              savedApiCompositeCatalogKey();
            if (
              currentKey &&
              currentKey !==
                savedApiCompositeReconciliationCompletedKey
            ) {
              savedApiCompositeReconciliationRequestedKey =
                currentKey;
            }
          }
        }
        return result;
      })()
        .catch(error => {
          savedApiCompositeCompatibilityIssues.clear();
          for (const record of
            savedApiCompositeTemplates.values()) {
            if (
              record.compatibilityIssueReason
            ) {
              savedApiCompositeCompatibilityIssues.set(
                record.id,
                record.compatibilityIssueReason
              );
            }
          }
          console.warn(
            window.RMLI18n.t("ui.literal.1125f1b509d3"),
            error
          );
          return null;
        })
        .finally(() => {
          savedApiCompositeOperations.delete(
            "catalog-reconciliation"
          );
          savedApiCompositeReconciliationPromise =
            null;
          scheduleGraphPaletteRender();
          if (
            savedApiCompositeReconciliationRequestedKey &&
            savedApiCompositeReconciliationRequestedKey !==
              savedApiCompositeReconciliationCompletedKey
          ) {
            queueMicrotask(() => {
              void scheduleSavedApiCompositeCatalogReconciliation();
            });
          }
        });
    return savedApiCompositeReconciliationPromise;
  }

async function importSavedApiCompositePayload(
    payload
  ) {
    if (
      savedApiCompositeOperations.has(
        "import"
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.b306ecc753a3")
      );
    }
    if (openGraphCatalogReconciliationPromise) {
      await openGraphCatalogReconciliationPromise;
    }
    if (savedApiCompositeReconciliationPromise) {
      await savedApiCompositeReconciliationPromise;
    }
    if (savedApiCompositeLibraryBusy()) {
      throw new Error(
        window.RMLI18n.t("ui.literal.73fbb7524247")
      );
    }
    savedApiCompositeOperations.add(
      "import"
    );
    scheduleGraphPaletteRender();
    try {
      await loadSavedApiCompositeLibrary();
      const records =
        savedApiCompositeRecordsFromJson(
          payload
        );
      payload = null;
      const resolved = [];
      const resolutionOmissions = [];
      const resolutionPreservations = [];
      let batchCatalogEpoch = "";
      for (
        let recordIndex = 0;
        recordIndex < records.length;
        recordIndex += 1
      ) {
        const record = records[recordIndex];
        const outcome =
          await resolveSavedApiCompositeForCurrentCatalog(
            record,
            {
              allowFingerprintShortcut:
                false,
              includeResolutionDetails:
                true,
              sourceRecordIsSanitized:
                true
            }
          );
        const resolvedRecord =
          outcome.record;
        const resolution =
          outcome.resolution || {};
        const resolutionEpoch =
          String(
            resolution
              .catalogResolutionBatchEpochToken ||
            resolution
              .catalogResolutionEpochToken ||
            ""
          );
        if (!batchCatalogEpoch) {
          batchCatalogEpoch =
            resolutionEpoch;
        } else if (
          resolutionEpoch &&
          resolutionEpoch !==
            batchCatalogEpoch
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.92e7cfd426db")
          );
        }
        for (const omitted of
          Array.isArray(
            resolution
              .removedUnavailableApiNodes
          )
            ? resolution
                .removedUnavailableApiNodes
            : []) {
          resolutionOmissions.push({
            compositeId:
              String(record.id || ""),
            compositeName:
              String(
                record.name ||
                "Saved API Composite"
              ),
            nodeId:
              String(omitted?.nodeId || ""),
            nodeName:
              String(
                omitted?.nodeName ||
                omitted?.nodeId ||
                omitted?.operatorId ||
                "Unavailable API node"
              ),
            operatorId:
              String(
                omitted?.operatorId ||
                ""
              ),
            path:
              String(
                omitted?.path ||
                "runtime-root"
              ),
            disconnectedConnectionIds:
              nodeGraphClone(
                Array.isArray(
                  omitted
                    ?.disconnectedConnectionIds
                )
                  ? omitted
                      .disconnectedConnectionIds
                  : []
              )
          });
        }
        if (
          resolution.compatibilityMode ===
            true &&
          Number(
            resolution
              .unresolvedNodeCount
          ) > 0
        ) {
          resolutionPreservations.push({
            compositeId:
              String(record.id || ""),
            compositeName:
              String(
                record.name ||
                "Saved API Composite"
              ),
            nodeCount:
              Math.max(
                0,
                Number(
                  resolution
                    .unresolvedNodeCount
                ) || 0
              )
          });
        }
        if (
          record[
            SAVED_API_COMPOSITE_LEGACY_FINGERPRINT
          ] === true
        ) {
          Object.defineProperty(
            resolvedRecord,
            SAVED_API_COMPOSITE_LEGACY_FINGERPRINT,
            {
              value: true,
              enumerable: false,
              configurable: false
            }
          );
        }
        resolved.push(resolvedRecord);
        records[recordIndex] = null;
      }
      const knownById = new Map(
        savedApiCompositeTemplates
      );
      const pending = [];
      const deletionIds = new Set();
      const instanceUpdatePlans = [];
      const summary = {
        added: 0,
        updated: 0,
        unchanged: 0,
        discarded: 0,
        graphOnly: 0,
        duplicatesConsolidated: 0,
        omittedApiNodes:
          resolutionOmissions.length,
        omittedApiNodeDetails:
          Object.freeze(
            resolutionOmissions.map(
              omission =>
                Object.freeze({
                  ...omission,
                  disconnectedConnectionIds:
                    Object.freeze(
                      omission
                        .disconnectedConnectionIds
                        .map(value =>
                          Object.freeze({
                            path: String(
                              typeof value === "string"
                                ? omission.path
                                : value?.path ||
                                    omission.path
                            ),
                            connectionId:
                              String(
                                typeof value === "string"
                                  ? value
                                  : value
                                      ?.connectionId ||
                                    ""
                              )
                          })
                        )
                        .filter(value =>
                          Boolean(
                            value.connectionId
                          )
                        )
                    )
                })
            )
          ),
        offlinePreservedApiNodes:
          resolutionPreservations.reduce(
            (total, value) =>
              total + value.nodeCount,
            0
          ),
        offlinePreservationDetails:
          Object.freeze(
            resolutionPreservations.map(
              value =>
                Object.freeze({
                  ...value
                })
            )
          )
      };
      for (const incoming of resolved) {
        const legacyFingerprint =
          incoming[
            SAVED_API_COMPOSITE_LEGACY_FINGERPRINT
          ] === true;
        const graphMatches =
          savedApiCompositeInstancesByName(
            incoming.name
          );
        const graphInstanceIds =
          graphMatches.map(node =>
            node.id
          );
        const nameKey =
          savedApiCompositeNameKey(
            incoming.name
          );
        const nameMatches = [
          ...knownById.values()
        ].filter(record =>
          savedApiCompositeNameKey(
            record.name
          ) === nameKey
        );
        const existingById =
          knownById.get(incoming.id) ||
          null;
        const linkedIds = new Set(
          graphMatches
            .map(node =>
              String(
                node.parameters
                  ?.savedApiCompositeId ||
                ""
              )
            )
            .filter(Boolean)
        );
        let existing =
          existingById ||
          nameMatches.find(record =>
            linkedIds.has(record.id)
          ) ||
          [...nameMatches].sort(
            (left, right) =>
              String(left.createdAt || "")
                .localeCompare(
                  String(
                    right.createdAt || ""
                  )
                ) ||
              String(left.id).localeCompare(
                String(right.id)
              )
          )[0] ||
          null;
        let matchedByName = Boolean(
          existing &&
          existing.id !== incoming.id
        );
        const duplicateMatches =
          existing
            ? nameMatches.filter(
                record =>
                  record.id !== existing.id
              )
            : [];
        if (!existing) {

          pending.push(incoming);
          knownById.set(
            incoming.id,
            incoming
          );
          summary.added += 1;
          if (graphInstanceIds.length > 0) {
            instanceUpdatePlans.push({
              record: incoming,
              instanceIds:
                graphInstanceIds,
              linkToSaved: true
            });
          }
          continue;
        }

        const exactContentMatch =
          await savedApiCompositeRecordsExactlyEquivalent(
            existing,
            incoming,
            `import:${existing.id}`
          );
        if (
          exactContentMatch &&
          duplicateMatches.length === 0
        ) {
          summary.unchanged += 1;
          if (graphInstanceIds.length > 0) {
            instanceUpdatePlans.push({
              record: existing,
              instanceIds:
                graphInstanceIds,
              linkToSaved: true
            });
          }
          continue;
        }
        const confirmed =
          await confirmSavedApiCompositeUpdate(
            existing,
            incoming,
            {
              matchedByName,
              legacyFingerprint,
              duplicateCount:
                duplicateMatches.length
            }
          );
        if (!confirmed) {
          summary.discarded += 1;
          continue;
        }

        const updated =
          sanitizeSavedApiCompositeRecord({
            ...incoming,
            id: existing.id,
            createdAt:
              existing.createdAt,
            updatedAt:
              new Date().toISOString()
          });
        if (legacyFingerprint) {
          Object.defineProperty(
            updated,
            SAVED_API_COMPOSITE_LEGACY_FINGERPRINT,
            {
              value: true,
              enumerable: false,
              configurable: false
            }
          );
        }
        pending.push(updated);
        for (const duplicate of
          duplicateMatches) {
          if (!deletionIds.has(duplicate.id)) {
            deletionIds.add(duplicate.id);
            summary.duplicatesConsolidated +=
              1;
          }
          knownById.delete(duplicate.id);
        }
        knownById.set(updated.id, updated);
        summary.updated += 1;
        if (graphInstanceIds.length > 0) {
          instanceUpdatePlans.push({
            record: updated,
            instanceIds:
              graphInstanceIds,
            linkToSaved: true
          });
        }
      }
      const committed =
        pending.length > 0 ||
        deletionIds.size > 0
          ? await (async () => {
              return applySavedApiCompositeReconciliation(
                pending,
                [...deletionIds],
                {
                  recordsAreSanitized: true,
                  expectedCatalogBatchEpoch:
                    batchCatalogEpoch,
                  catalogEpochPhase:
                    "while the Saved Composite storage transaction was pending"
                }
              );
            })()
          : {
              updates: [],
              deletionIds: []
            };
      const stored = committed.updates;
      summary.instancesReplaced = 0;
      summary.instanceUpdatesDeclined = 0;
      summary.instanceUpdatesSkippedOpen = 0;
      summary.instanceUpdateErrors = 0;
      summary.disconnectedWires = 0;
      summary.omittedApiConnections =
        new Set(
          resolutionOmissions.flatMap(
            omission =>
              omission
                .disconnectedConnectionIds
                .map(value =>
                  `${String(value?.path || omission.path)}\u0000${String(typeof value === "string" ? value : value?.connectionId || "")}`
                )
                .filter(value =>
                  !value.endsWith("\u0000")
                )
          )
        ).size;
      const uniqueInstanceUpdatePlans = [
        ...new Map(
          instanceUpdatePlans.map(plan => [
            `${plan.record.id}\u0000${plan.linkToSaved ? "saved" : "graph-only"}`,
            plan
          ])
        ).values()
      ];
      summary.instancesLinkedByName = 0;
      for (const plan of
        uniqueInstanceUpdatePlans) {
        const record = plan.record;
        try {
          assertSavedApiCompositeCatalogBatchEpoch(
            batchCatalogEpoch,
            "before placed Saved Composite instances could be checked"
          );
          if (
            matchingSavedApiCompositeInstances(
              record,
              plan.instanceIds,
              { staleOnly: true }
            ).length === 0
          ) {
            continue;
          }
          const replacement =
            await applySavedApiCompositeVersion(
              record,
              {
                source: "import",
                instanceIds:
                  plan.instanceIds,
                linkToSaved:
                  plan.linkToSaved,
                expectedCatalogBatchEpoch:
                  batchCatalogEpoch
              }
            );
          summary.instancesReplaced +=
            replacement.replaced || 0;
          summary.instanceUpdatesSkippedOpen +=
            replacement.skippedOpen || 0;
          summary.disconnectedWires +=
            replacement.disconnectedWires || 0;
          summary.instancesLinkedByName +=
            replacement.linkedByName || 0;
          if (replacement.cancelled) {
            summary.instanceUpdatesDeclined +=
              1;
          }
        } catch (error) {
          summary.instanceUpdateErrors += 1;
          showGraphMessage(
            error instanceof Error
              ? error.message
              : String(error),
            "error"
          );
        }
      }
      Object.defineProperty(
        stored,
        "summary",
        {
          value: Object.freeze({
            ...summary
          }),
          writable: false,
          enumerable: false,
          configurable: false
        }
      );
      showGraphMessage(
        `Saved API Composite import completed: ${summary.added.toLocaleString(window.RMLI18n?.language || undefined)} new, ${summary.updated.toLocaleString(window.RMLI18n?.language || undefined)} updated, ${summary.unchanged.toLocaleString(window.RMLI18n?.language || undefined)} unchanged and ${summary.discarded.toLocaleString(window.RMLI18n?.language || undefined)} discarded.${summary.omittedApiNodes > 0 ? ` ${summary.omittedApiNodes.toLocaleString(window.RMLI18n?.language || undefined)} unavailable API node${summary.omittedApiNodes === 1 ? " was" : "s were"} omitted together with ${summary.omittedApiConnections.toLocaleString(window.RMLI18n?.language || undefined)} dependent connection${summary.omittedApiConnections === 1 ? "" : "s"}; the remaining graph was imported.` : ""}${summary.offlinePreservedApiNodes > 0 ? ` ${summary.offlinePreservedApiNodes.toLocaleString(window.RMLI18n?.language || undefined)} API node${summary.offlinePreservedApiNodes === 1 ? " was" : "s were"} retained from complete stored portable contracts pending a verified catalog.` : ""}${summary.duplicatesConsolidated > 0 ? ` ${summary.duplicatesConsolidated.toLocaleString(window.RMLI18n?.language || undefined)} duplicate Saved Composite entr${summary.duplicatesConsolidated === 1 ? "y was" : "ies were"} consolidated.` : ""}${summary.instancesReplaced > 0 ? ` ${summary.instancesReplaced.toLocaleString(window.RMLI18n?.language || undefined)} placed instance${summary.instancesReplaced === 1 ? " was" : "s were"} replaced.${summary.instancesLinkedByName > 0 ? ` ${summary.instancesLinkedByName.toLocaleString(window.RMLI18n?.language || undefined)} matched by exact normalized name and received the imported fingerprint.` : ""}` : ""}${summary.instanceUpdatesDeclined > 0 ? ` ${summary.instanceUpdatesDeclined.toLocaleString(window.RMLI18n?.language || undefined)} optional graph replacement${summary.instanceUpdatesDeclined === 1 ? " was" : "s were"} declined; the Library import remains stored.` : ""}${summary.disconnectedWires > 0 ? ` ${summary.disconnectedWires.toLocaleString(window.RMLI18n?.language || undefined)} obsolete outer wire${summary.disconnectedWires === 1 ? " was" : "s were"} removed after the confirmed replacement and must be reconnected where still needed.` : ""}${summary.instanceUpdateErrors > 0 ? ` ${summary.instanceUpdateErrors.toLocaleString(window.RMLI18n?.language || undefined)} graph replacement${summary.instanceUpdateErrors === 1 ? " failed" : "s failed"} without changing those instances; the Library import remains stored.` : ""}`,
        summary.instanceUpdateErrors > 0 ||
        summary.omittedApiNodes > 0 ||
        summary.offlinePreservedApiNodes >
          0
          ? "warning"
          : "success"
      );
      return stored;
    } finally {
      savedApiCompositeOperations.delete(
        "import"
      );
      scheduleGraphPaletteRender();
      void scheduleSavedApiCompositeCatalogReconciliation();
    }
  }

function currentSavedApiCompositeCatalogBatchEpoch() {
    return String(
      window
        .RMLSavedApiCompositeResolver
        ?.catalogBatchEpochToken?.() ||
      window
        .RMLSavedApiCompositeResolver
        ?.catalogEpochToken?.() ||
      ""
    );
  }

function savedApiCompositeCatalogEpochChangedError(
    phase
  ) {
    const error = new Error(
      `The API catalog changed ${String(phase || "during the Saved Composite operation")}. The stale operation was cancelled; retry it against the current catalog.`
    );
    error.code =
      "RML_SAVED_API_COMPOSITE_CATALOG_EPOCH_CHANGED";
    return error;
  }

function assertSavedApiCompositeCatalogBatchEpoch(
    expectedEpoch,
    phase
  ) {
    const expected = String(
      expectedEpoch || ""
    );
    const current =
      currentSavedApiCompositeCatalogBatchEpoch();
    if (
      !expected ||
      !current ||
      current !== expected
    ) {
      throw savedApiCompositeCatalogEpochChangedError(
        phase
      );
    }
    return current;
  }

async function acquireSavedApiCompositeCatalogStabilityLease(
    expectedEpoch,
    phase
  ) {
    assertSavedApiCompositeCatalogBatchEpoch(
      expectedEpoch,
      phase
    );
    const acquire =
      window.RMLApiNodeFactoryController
        ?.acquireCatalogResolutionStabilityLease;
    if (typeof acquire !== "function") {
      throw new Error(
        window.RMLI18n.t("ui.literal.32691f8f7700")
      );
    }
    const lease = await acquire();
    try {
      if (
        !lease ||
        typeof lease.release !==
          "function"
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.84b47289968c")
        );
      }
      assertSavedApiCompositeCatalogBatchEpoch(
        expectedEpoch,
        phase
      );
      return lease;
    } catch (error) {
      try {
        lease?.release?.();
      } catch {

      }
      throw error;
    }
  }

function graphIdentitySetsForSavedComposite() {
    const nodeIds = new Set();
    const connectionIds = new Set();
    const visited = new Set();
    const append = candidate => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        visited.has(candidate)
      ) {
        return;
      }
      visited.add(candidate);
      for (const node of
        Array.isArray(candidate.nodes)
          ? candidate.nodes
          : []) {
        nodeIds.add(String(node.id || ""));
      }
      for (const connection of
        Array.isArray(candidate.connections)
          ? candidate.connections
          : []) {
        connectionIds.add(
          String(connection.id || "")
        );
      }
      for (const nested of
        Object.values(
          candidate.apiCompositeGraphs || {}
        )) {
        append(nested);
      }
      for (const nested of
        Object.values(
          candidate.customCSharpFiles || {}
        )) {
        append(nested);
      }
    };
    append(graph);
    for (const frame of
      apiCompositeEditorChain(
        apiCompositeEditor
      )) {
      append(frame.mainView);
    }
    append(customCSharpEditor?.mainView);
    return { nodeIds, connectionIds };
  }

function uniqueSavedCompositeGraphId(
    prefix,
    used
  ) {
    let id;
    do {
      id = makeId(prefix);
    } while (used.has(id));
    used.add(id);
    return id;
  }

function remapSavedCompositePointReference(
    source,
    connectionIdMap,
    pointIdMaps
  ) {
    const copy = nodeGraphClone(source || {});
    const sourceConnectionId =
      source?.connectionId;
    copy.connectionId =
      connectionIdMap.get(
        sourceConnectionId
      ) || "";
    copy.pointId =
      pointIdMaps
        .get(sourceConnectionId)
        ?.get(source?.pointId) || "";
    return copy;
  }

function remapSavedCompositeElementIdentity(
    source,
    normalized,
    nodes,
    connections,
    boundaries,
    nodeIdMap,
    connectionIdMap,
    pointIdMaps
  ) {
    const result =
      source &&
      typeof source === "object" &&
      !Array.isArray(source)
        ? nodeGraphClone(source)
        : {};
    result.version =
      SAVED_API_COMPOSITE_ELEMENT_IDENTITY_VERSION;
    result.templateId = normalized.templateId;
    result.nodes = Object.fromEntries(
      nodes.map(node => [
        nodeIdMap.get(node.id),
        normalized.nodes[node.id]
      ])
    );
    result.connections = Object.fromEntries(
      connections.map(connection => [
        connectionIdMap.get(connection.id),
        normalized.connections[
          connection.id
        ]
      ])
    );
    result.points = Object.fromEntries(
      connections.map(connection => [
        connectionIdMap.get(connection.id),
        Object.fromEntries(
          (connection.points || []).map(point => [
            pointIdMaps
              .get(connection.id)
              ?.get(point.id),
            normalized.points?.[
              connection.id
            ]?.[point.id] ||
              `point:${normalized.connections[connection.id]}:${point.id}`
          ])
        )
      ])
    );
    result.boundaries = Object.fromEntries(
      boundaries.map(boundary => {
        const key =
          `${boundary.direction}\u0000${boundary.id}`;
        return [
          key,
          normalized.boundaries[key]
        ];
      })
    );
    return result;
  }

function remapSavedCompositeCustomCSharpGraph(
    source,
    identities,
    losslessClone = null
  ) {
    const sourceGraph = source || {};
    const customGraph =
      losslessClone &&
      typeof losslessClone === "object" &&
      !Array.isArray(losslessClone)
        ? losslessClone
        : nodeGraphClone(sourceGraph);
    const nodeIdMap = new Map();
    for (const node of
      Array.isArray(customGraph.nodes)
        ? customGraph.nodes
        : []) {
      nodeIdMap.set(
        node.id,
        uniqueSavedCompositeGraphId(
          "custom-csharp-node",
          identities.nodeIds
        )
      );
    }
    const connectionIdMap = new Map();
    const pointIdMaps = new Map();
    for (const connection of
      Array.isArray(customGraph.connections)
        ? customGraph.connections
        : []) {
      connectionIdMap.set(
        connection.id,
        uniqueSavedCompositeGraphId(
          "custom-csharp-connection",
          identities.connectionIds
        )
      );
      const pointMap = new Map();
      for (const point of
        connection.points || []) {
        pointMap.set(
          point.id,
          makeId("custom-csharp-point")
        );
      }
      pointIdMaps.set(
        connection.id,
        pointMap
      );
    }
    customGraph.nodes =
      (customGraph.nodes || []).map(node => {
        node.id = nodeIdMap.get(node.id);
        return node;
      });
    customGraph.connections =
      (customGraph.connections || []).map(
        (connection, index) => {
          const sourceConnection =
            sourceGraph.connections?.[index] ||
            connection;
          connection.id = connectionIdMap.get(
            sourceConnection.id
          );
          connection.fromNode = nodeIdMap.get(
            sourceConnection.fromNode
          );
          connection.toNode = nodeIdMap.get(
            sourceConnection.toNode
          );
          connection.points =
            (connection.points || []).map(
              (point, pointIndex) => {
                const sourcePoint =
                  sourceConnection.points?.[
                    pointIndex
                  ] || point;
                point.id = pointIdMaps
                  .get(sourceConnection.id)
                  ?.get(sourcePoint.id);
                return point;
              }
            );
          connection.branchFrom =
            sourceConnection.branchFrom
              ? remapSavedCompositePointReference(
                  sourceConnection.branchFrom,
                  connectionIdMap,
                  pointIdMaps
                )
              : null;
          return connection;
        }
      );
    const branchRouting = {};
    for (const [connectionId, branch] of
      Object.entries(
        sourceGraph.branchRouting || {}
      )) {
      const remappedConnectionId =
        connectionIdMap.get(connectionId);
      const remappedBranch =
        remapSavedCompositePointReference(
          branch,
          connectionIdMap,
          pointIdMaps
        );
      if (
        remappedConnectionId &&
        remappedBranch.connectionId &&
        remappedBranch.pointId
      ) {
        branchRouting[remappedConnectionId] =
          remappedBranch;
      }
    }
    if (
      Object.hasOwn(
        sourceGraph,
        "branchRouting"
      )
    ) {
      customGraph.branchRouting =
        branchRouting;
    }
    customGraph.outputNodeId =
      nodeIdMap.get(
        customGraph.outputNodeId
      ) || "";
    customGraph.rootSyntaxNodeId =
      nodeIdMap.get(
        customGraph.rootSyntaxNodeId
      ) || "";
    customGraph.directSourceNodeId =
      nodeIdMap.get(
        customGraph.directSourceNodeId
      ) || "";
    customGraph.selectedNodeId =
      nodeIdMap.get(
        customGraph.selectedNodeId
      ) || null;
    customGraph.selectedNodeIds =
      (customGraph.selectedNodeIds || [])
        .map(id => nodeIdMap.get(id))
        .filter(Boolean);
    customGraph.selectedConnectionId =
      connectionIdMap.get(
        customGraph.selectedConnectionId
      ) || null;
    const selectedWirePoint =
      sourceGraph.selectedWirePoint;
    customGraph.selectedWirePoint =
      selectedWirePoint &&
      connectionIdMap.has(
        selectedWirePoint.connectionId
      )
        ? remapSavedCompositePointReference(
            selectedWirePoint,
            connectionIdMap,
            pointIdMaps
          )
        : null;
    if (
      sourceGraph.elementIdentity &&
      typeof sourceGraph.elementIdentity ===
        "object" &&
      !Array.isArray(
        sourceGraph.elementIdentity
      )
    ) {
      const normalizedIdentity =
        savedApiCompositeElementIdentity(
          sourceGraph.elementIdentity,
          sourceGraph,
          sourceGraph.elementIdentity
            ?.templateId || ""
        );
      customGraph.elementIdentity =
        remapSavedCompositeElementIdentity(
          sourceGraph.elementIdentity,
          normalizedIdentity,
          sourceGraph.nodes || [],
          sourceGraph.connections || [],
          [],
          nodeIdMap,
          connectionIdMap,
          pointIdMaps
        );
    }
    customGraph.nextSequence = Math.max(
      1,
      Math.trunc(
        finiteNumber(
          customGraph.nextSequence,
          customGraph.nodes.length +
            customGraph.connections.length +
            1
        )
      )
    );
    return customGraph;
  }

function remapSavedApiCompositeGraph(
    sourceComposite,
    identities,
    depth = 0,
    stack = new WeakSet(),
    trace = null,
    losslessClone = null
  ) {
    if (
      !sourceComposite ||
      typeof sourceComposite !== "object" ||
      Array.isArray(sourceComposite) ||
      !Array.isArray(sourceComposite.nodes) ||
      !Array.isArray(
        sourceComposite.connections
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.516946844d48")
      );
    }
    if (
      depth >
        SAVED_API_COMPOSITE_NESTING_LIMIT
    ) {
      throw new Error(
        `API Composite nesting exceeds the safe depth limit of ${SAVED_API_COMPOSITE_NESTING_LIMIT}.`
      );
    }
    if (stack.has(sourceComposite)) {
      throw new Error(
        window.RMLI18n.t("ui.literal.d605497b08f5")
      );
    }
    stack.add(sourceComposite);
    try {
    const composite =
      losslessClone &&
      typeof losslessClone === "object" &&
      !Array.isArray(losslessClone)
        ? losslessClone
        : nodeGraphClone(sourceComposite);
    const losslessCustomCSharpFiles =
      composite.customCSharpFiles &&
      typeof composite.customCSharpFiles ===
        "object" &&
      !Array.isArray(
        composite.customCSharpFiles
      )
        ? composite.customCSharpFiles
        : {};
    const losslessApiCompositeGraphs =
      composite.apiCompositeGraphs &&
      typeof composite.apiCompositeGraphs ===
        "object" &&
      !Array.isArray(
        composite.apiCompositeGraphs
      )
        ? composite.apiCompositeGraphs
        : {};
    const remapTrace =
      trace && typeof trace === "object"
        ? trace
        : {};
    remapTrace.nodes = new Map();
    remapTrace.connections = new Map();
    remapTrace.points = new Map();
    remapTrace.boundaries = new Map();
    remapTrace.nested = new Map();
    const sourceElementIdentity =
      savedApiCompositeElementIdentity(
        sourceComposite.elementIdentity,
        sourceComposite,
        sourceComposite.elementIdentity
          ?.templateId || ""
      );
    const nodeIdMap = new Map();
    for (const node of
      sourceComposite.nodes) {
      nodeIdMap.set(
        node.id,
        uniqueSavedCompositeGraphId(
          "graph-node",
          identities.nodeIds
        )
      );
      remapTrace.nodes.set(
        node.id,
        nodeIdMap.get(node.id)
      );
    }
    const connectionIdMap = new Map();
    const pointIdMaps = new Map();
    for (const connection of
      sourceComposite.connections) {
      connectionIdMap.set(
        connection.id,
        uniqueSavedCompositeGraphId(
          "connection",
          identities.connectionIds
        )
      );
      remapTrace.connections.set(
        connection.id,
        connectionIdMap.get(
          connection.id
        )
      );
      const pointMap = new Map();
      for (const point of
        connection.points || []) {
        pointMap.set(
          point.id,
          makeId("wire-point")
        );
      }
      pointIdMaps.set(
        connection.id,
        pointMap
      );
      remapTrace.points.set(
        connection.id,
        pointMap
      );
    }
    const nodes =
      composite.nodes.map((node, index) => {
        const sourceNode =
          sourceComposite.nodes[index];
        node.id = nodeIdMap.get(
          sourceNode.id
        );
        return node;
      });
    const connections =
      composite.connections.map(
        (copy, index) => {
          const source =
            sourceComposite.connections[
              index
            ];
          copy.id = connectionIdMap.get(
            source.id
          );
          copy.fromNode = nodeIdMap.get(
            source.fromNode
          );
          copy.toNode = nodeIdMap.get(
            source.toNode
          );
          copy.points =
            (copy.points || []).map(
              (point, pointIndex) => {
                const sourcePoint =
                  source.points?.[
                    pointIndex
                  ] || point;
                point.id = pointIdMaps
                  .get(source.id)
                  .get(sourcePoint.id);
                return point;
              }
            );
          if (source.branchFrom) {
            copy.branchFrom =
              remapSavedCompositePointReference(
                source.branchFrom,
                connectionIdMap,
                pointIdMaps
              );
          }
          return copy;
        }
      );
    const sourceBoundaryQueues = new Map();
    for (const sourceBoundary of
      Array.isArray(
        sourceComposite.boundaryPorts
      )
        ? sourceComposite.boundaryPorts
        : []) {
      const normalized =
        apiCompositeBoundaryRecords([
          sourceBoundary
        ])[0];
      if (!normalized) continue;
      const key = JSON.stringify([
        normalized.direction,
        normalized.id,
        normalized.internalNodeId,
        normalized.internalPortId
      ]);
      let queue = sourceBoundaryQueues.get(key);
      if (!queue) {
        queue = [];
        sourceBoundaryQueues.set(key, queue);
      }
      queue.push(sourceBoundary);
    }
    const boundaries =
      apiCompositeBoundaryRecords(
        sourceComposite.boundaryPorts
      ).map(boundary => {
        const key = JSON.stringify([
          boundary.direction,
          boundary.id,
          boundary.internalNodeId,
          boundary.internalPortId
        ]);
        const sourceBoundary =
          sourceBoundaryQueues.get(key)
            ?.shift();
        const copy = nodeGraphClone(
          sourceBoundary || boundary
        );
        Object.assign(copy, boundary);
        copy.internalNodeId =
          nodeIdMap.get(
            boundary.internalNodeId
          );
        return copy;
      });
    for (const boundary of boundaries) {
      remapTrace.boundaries.set(
        `${boundary.direction}\u0000${boundary.id}`,
        boundary.id
      );
    }
    const branchRouting = {};
    for (const [connectionId, branch] of
      Object.entries(
        sourceComposite.branchRouting || {}
      )) {
      const remappedConnectionId =
        connectionIdMap.get(connectionId);
      const parentConnectionId =
        connectionIdMap.get(
          branch?.connectionId
        );
      const pointId = pointIdMaps
        .get(branch?.connectionId)
        ?.get(branch?.pointId);
      if (
        remappedConnectionId &&
        parentConnectionId &&
        pointId
      ) {
        branchRouting[
          remappedConnectionId
        ] = {
          ...nodeGraphClone(branch),
          connectionId:
            parentConnectionId,
          pointId
        };
      }
    }
    const customCSharpFiles = {};
    for (const [ownerId, customGraph] of
      Object.entries(
        sourceComposite
          .customCSharpFiles || {}
      )) {
      const remappedOwnerId =
        nodeIdMap.get(ownerId);
      if (!remappedOwnerId) {
        continue;
      }
      customCSharpFiles[remappedOwnerId] =
        remapSavedCompositeCustomCSharpGraph(
          customGraph,
          identities,
          losslessCustomCSharpFiles[
            ownerId
          ]
        );
    }
    const apiCompositeGraphs = {};
    const sourceNested =
      sourceComposite.apiCompositeGraphs &&
      typeof sourceComposite.apiCompositeGraphs ===
        "object" &&
      !Array.isArray(
        sourceComposite.apiCompositeGraphs
      )
        ? sourceComposite.apiCompositeGraphs
        : {};
    for (const [ownerId, nested] of
      Object.entries(sourceNested)) {
      const remappedOwnerId =
        nodeIdMap.get(ownerId);
      const sourceOwner =
        sourceComposite.nodes.find(
          node =>
            String(node?.id || "") ===
              String(ownerId) &&
            node?.operatorId ===
              "container.apiComposite"
        );
      const remappedOwner = nodes.find(
        node => node.id === remappedOwnerId
      );
      if (
        !remappedOwnerId ||
        !sourceOwner ||
        !remappedOwner
      ) {
        throw new Error(
          `Nested API Composite '${ownerId || "<unnamed>"}' has no matching owner node.`
        );
      }
      const remappedNested =
        remapSavedApiCompositeGraph(
          nested,
          identities,
          depth + 1,
          stack,
          (() => {
            const nestedTrace = {};
            remapTrace.nested.set(
              ownerId,
              nestedTrace
            );
            return nestedTrace;
          })(),
          losslessApiCompositeGraphs[
            ownerId
          ]
        );
      apiCompositeGraphs[
        remappedOwnerId
      ] = remappedNested;
      remappedOwner.parameters =
        remappedOwner.parameters &&
        typeof remappedOwner.parameters ===
          "object"
          ? remappedOwner.parameters
          : {};
      remappedOwner.parameters.boundaryPorts =
        nodeGraphClone(
          remappedNested.boundaryPorts
        );
      remappedOwner.parameters.memberCount =
        remappedNested.nodes.length;
      remappedOwner.parameters.title =
        savedApiCompositeCurrentName(
          sourceOwner,
          nested
        );
    }
    composite.version = 1;
    composite.title = String(
      sourceComposite.title ||
      "API Composite"
    );
    composite.contentFingerprint = String(
      sourceComposite.contentFingerprint || ""
    );
    composite.fingerprintNameKey = String(
      sourceComposite.fingerprintNameKey || ""
    );
    composite.fingerprintPortLayout =
      sourceComposite.portLayout ===
        "mirrored"
        ? "mirrored"
        : "standard";
    composite.createdCatalogFingerprint =
      String(
        sourceComposite
          .createdCatalogFingerprint || ""
      );
    composite.createdEngineVersion = String(
      sourceComposite.createdEngineVersion || ""
    );
    composite.portLayout =
      sourceComposite.portLayout === "mirrored"
        ? "mirrored"
        : "standard";
    composite.boundaryPorts = boundaries;
    composite.branchRouting = branchRouting;
    composite.customCSharpFiles =
      customCSharpFiles;
    composite.apiCompositeGraphs =
      apiCompositeGraphs;
    composite.elementIdentity =
      remapSavedCompositeElementIdentity(
        sourceComposite.elementIdentity,
        sourceElementIdentity,
        sourceComposite.nodes,
        sourceComposite.connections,
        boundaries,
        nodeIdMap,
        connectionIdMap,
        pointIdMaps
      );
    composite.nodes = nodes;
    composite.connections = connections;
    if (!sourceComposite.viewport) {
      composite.viewport = {
        x: 56,
        y: 54,
        scale: 0.9
      };
    }
    composite.selectedNodeId =
      nodeIdMap.get(
        sourceComposite.selectedNodeId
      ) || nodes[0]?.id || null;
    composite.selectedNodeIds =
      (sourceComposite.selectedNodeIds || [])
        .map(id => nodeIdMap.get(id))
        .filter(Boolean);
    composite.selectedConnectionId =
      connectionIdMap.get(
        sourceComposite.selectedConnectionId
      ) || null;
    composite.selectedWirePoint = null;
    composite.nextSequence = Math.max(
      1,
      Math.trunc(
        finiteNumber(
          sourceComposite.nextSequence,
          nodes.length +
            connections.length + 1
        )
      )
    );
    const selectedPoint =
      sourceComposite.selectedWirePoint;
    if (selectedPoint) {
      const selectedConnectionId =
        connectionIdMap.get(
          selectedPoint.connectionId
        );
      const selectedPointId =
        pointIdMaps
          .get(selectedPoint.connectionId)
          ?.get(selectedPoint.pointId);
      if (
        selectedConnectionId &&
        selectedPointId
      ) {
        composite.selectedWirePoint =
          remapSavedCompositePointReference(
            selectedPoint,
            connectionIdMap,
            pointIdMaps
          );
      }
    }
    return composite;
    } finally {
      stack.delete(sourceComposite);
    }
  }

function remapSavedApiCompositeInstance(
    record,
    containerId,
    x,
    y,
    {
      exactPosition = false
    } = {}
  ) {
    const identities =
      graphIdentitySetsForSavedComposite();
    identities.nodeIds.add(containerId);
    const trace = {};
    const composite =
      remapSavedApiCompositeGraph(
        record.composite,
        identities,
        0,
        new WeakSet(),
        trace
      );
    savedApiCompositeApplyElementIdentity(
      composite,
      record.id
    );
    composite.title = record.name;
    composite.contentFingerprint =
      record.contentFingerprint;
    composite.fingerprintNameKey =
      savedApiCompositeNameKey(
        record.name
      );
    composite.fingerprintPortLayout =
      record.composite.portLayout ===
        "mirrored"
        ? "mirrored"
        : "standard";
    const position = exactPosition
      ? exactGraphNodePosition(x, y)
      : findOpenNodePosition(
          x,
          y,
          320,
          190
        );
    const container = {
      id: containerId,
      kind: "operator",
      operatorId:
        "container.apiComposite",
      x: position.x,
      y: position.y,
      width: null,
      height: null,
      label: record.name,
      parameters: {
        title: record.name,
        memberCount:
          composite.nodes.length,
        boundaryPorts:
          nodeGraphClone(
            composite.boundaryPorts
          ),
        portLayout:
          record.composite.portLayout ===
            "mirrored"
            ? "mirrored"
            : "standard",
        savedApiCompositeId:
          record.id,
        savedApiCompositeUpdatedAt:
          record.updatedAt,
        apiCompositeFingerprint:
          record.contentFingerprint
      }
    };
    return {
      container,
      composite,
      trace
    };
  }

function savedApiCompositeBoundaryTypeCompatible(
    previous,
    replacement
  ) {
    if (
      previous?.direction !==
        replacement?.direction
    ) {
      return false;
    }
    const previousType = String(
      previous?.type || ""
    );
    const replacementType = String(
      replacement?.type || ""
    );
    if (
      previousType &&
      replacementType
    ) {
      const activeCustomEditor =
        customCSharpEditor;
      try {
        customCSharpEditor = null;
        return previous.direction === "input"
          ? connectionTypesCompatible(
              previousType,
              replacementType
            )
          : connectionTypesCompatible(
              replacementType,
              previousType
            );
      } finally {
        customCSharpEditor =
          activeCustomEditor;
      }
    }
    return (
      String(previous?.typeVar || "") ===
        String(replacement?.typeVar || "") &&
      String(
        previous?.constraint || "value"
      ) ===
        String(
          replacement?.constraint ||
          "value"
        )
    );
  }

function savedApiCompositeBoundaryLabelKey(
    boundary
  ) {
    return [
      String(boundary?.direction || ""),
      String(boundary?.label || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLocaleLowerCase(),
      String(boundary?.type || ""),
      String(boundary?.typeVar || ""),
      String(
        boundary?.constraint || "value"
      )
    ].join("\u0000");
  }

function mapSavedApiCompositeBoundaries(
    previousBoundaries,
    replacementBoundaries,
    {
      allowTypeOnly = true,
      previousElementIdentity = null,
      replacementElementIdentity = null
    } = {}
  ) {
    const previous =
      apiCompositeBoundaryRecords(
        previousBoundaries
      );
    const replacement =
      apiCompositeBoundaryRecords(
        replacementBoundaries
      );
    const result = new Map();
    const usedReplacementIds = new Set();
    const previousStableBoundaries =
      previousElementIdentity
        ?.boundaries || {};
    const replacementStableBoundaries =
      replacementElementIdentity
        ?.boundaries || {};
    const assign = (
      previousBoundary,
      replacementBoundary
    ) => {
      if (
        !previousBoundary ||
        !replacementBoundary ||
        usedReplacementIds.has(
          replacementBoundary.id
        ) ||
        !savedApiCompositeBoundaryTypeCompatible(
          previousBoundary,
          replacementBoundary
        )
      ) {
        return false;
      }
      result.set(
        `${previousBoundary.direction}\u0000${previousBoundary.id}`,
        replacementBoundary.id
      );
      usedReplacementIds.add(
        replacementBoundary.id
      );
      return true;
    };

    for (const previousBoundary of previous) {
      const previousKey =
        `${previousBoundary.direction}\u0000${previousBoundary.id}`;
      const stable = String(
        previousStableBoundaries[
          previousKey
        ] || ""
      );
      if (!stable) continue;
      const matches = replacement.filter(
        candidate =>
          !usedReplacementIds.has(
            candidate.id
          ) &&
          String(
            replacementStableBoundaries[
              `${candidate.direction}\u0000${candidate.id}`
            ] || ""
          ) === stable
      );
      if (matches.length === 1) {
        assign(
          previousBoundary,
          matches[0]
        );
      }
    }

    for (const previousBoundary of previous) {
      const key =
        `${previousBoundary.direction}\u0000${previousBoundary.id}`;
      if (result.has(key)) continue;
      assign(
        previousBoundary,
        replacement.find(candidate =>
          candidate.direction ===
            previousBoundary.direction &&
          candidate.id ===
            previousBoundary.id
        )
      );
    }

    for (const previousBoundary of previous) {
      const key =
        `${previousBoundary.direction}\u0000${previousBoundary.id}`;
      if (result.has(key)) continue;
      const previousStable = String(
        previousStableBoundaries[key] || ""
      );
      const labelKey =
        savedApiCompositeBoundaryLabelKey(
          previousBoundary
        );
      const matches = replacement.filter(
        candidate => {
          const candidateStable = String(
            replacementStableBoundaries[
              `${candidate.direction}\u0000${candidate.id}`
            ] || ""
          );
          return (
            !usedReplacementIds.has(
              candidate.id
            ) &&
            (
              !previousStable ||
              !candidateStable ||
              previousStable ===
                candidateStable
            ) &&
            savedApiCompositeBoundaryLabelKey(
              candidate
            ) === labelKey &&
            savedApiCompositeBoundaryTypeCompatible(
              previousBoundary,
              candidate
            )
          );
        }
      );
      if (matches.length === 1) {
        assign(
          previousBoundary,
          matches[0]
        );
      }
    }

    if (allowTypeOnly) {
      for (const previousBoundary of previous) {
        const key =
          `${previousBoundary.direction}\u0000${previousBoundary.id}`;
        if (result.has(key)) continue;
        const compatible = replacement.filter(
          candidate =>
            !usedReplacementIds.has(
              candidate.id
            ) &&
            savedApiCompositeBoundaryTypeCompatible(
              previousBoundary,
              candidate
            )
        );
        if (compatible.length === 1) {
          assign(
            previousBoundary,
            compatible[0]
          );
        }
      }
    }
    return result;
  }

function savedApiCompositeContextMatchesRecord(
    record,
    context,
    allowedIds = null
  ) {
    const node = context?.owner;
    const composite = context?.composite;
    if (
      node?.operatorId !==
        "container.apiComposite" ||
      !composite ||
      (allowedIds &&
        !allowedIds.has(node.id))
    ) {
      return false;
    }
    const linkedId = String(
      node.parameters
        ?.savedApiCompositeId || ""
    ).trim();
    const recordId = String(
      record?.id || ""
    ).trim();
    return Boolean(
      linkedId &&
      recordId &&
      linkedId === recordId
    );
  }

function matchingSavedApiCompositeInstances(
    record,
    instanceIds = null,
    {
      staleOnly = false,
      contexts = null
    } = {}
  ) {
    const allowedIds =
      Array.isArray(instanceIds)
        ? new Set(
            instanceIds.map(value =>
              String(value || "")
            )
          )
        : null;
    const availableContexts =
      Array.isArray(contexts)
        ? contexts
        : savedApiCompositeInstanceContexts();
    return availableContexts
      .filter(context => {
        const node = context.owner;
        if (
          !savedApiCompositeContextMatchesRecord(
            record,
            context,
            allowedIds
          )
        ) {
          return false;
        }
        if (!staleOnly) return true;

        return (
          savedApiCompositeInstanceComparisonStatus(
            record,
            context
          ) === "different"
        );
      })
      .map(context => context.owner);
  }

function savedApiCompositeInstanceContexts() {
    const rootView =
      rootRuntimeGraphView();
    const result = [];
    const stack = new WeakSet();
    const append = (
      documentValue,
      nodes,
      connections,
      path,
      depth
    ) => {
      if (
        !documentValue ||
        typeof documentValue !== "object" ||
        Array.isArray(documentValue) ||
        stack.has(documentValue) ||
        depth >
          SAVED_API_COMPOSITE_NESTING_LIMIT
      ) {
        return;
      }
      stack.add(documentValue);
      try {
        const registry =
          documentValue.apiCompositeGraphs &&
          typeof documentValue
            .apiCompositeGraphs === "object" &&
          !Array.isArray(
            documentValue.apiCompositeGraphs
          )
            ? documentValue.apiCompositeGraphs
            : {};
        for (const owner of
          Array.isArray(nodes) ? nodes : []) {
          if (
            owner?.operatorId !==
              "container.apiComposite"
          ) {
            continue;
          }
          const ownerId = String(
            owner.id || ""
          );
          const composite =
            registry[ownerId];
          if (
            !ownerId ||
            !composite ||
            typeof composite !== "object" ||
            Array.isArray(composite)
          ) {
            continue;
          }
          const context = {
            owner,
            composite,
            ownerDocument:
              documentValue,
            ownerNodes:
              Array.isArray(nodes)
                ? nodes
                : [],
            ownerConnections:
              Array.isArray(connections)
                ? connections
                : [],
            path: [...path, ownerId],
            depth
          };
          result.push(context);
          append(
            composite,
            composite.nodes,
            composite.connections,
            context.path,
            depth + 1
          );
        }
      } finally {
        stack.delete(documentValue);
      }
    };
    append(
      {
        apiCompositeGraphs:
          graph.apiCompositeGraphs
      },
      rootView.nodes,
      rootView.connections,
      [],
      0
    );
    return result;
  }

function savedApiCompositeInstanceContext(
    owner,
    contexts = null
  ) {
    const available =
      Array.isArray(contexts)
        ? contexts
        : savedApiCompositeInstanceContexts();
    return available.find(context =>
      context.owner === owner ||
      String(context.owner?.id || "") ===
        String(owner?.id || owner || "")
    ) || null;
  }

function savedApiCompositeInstancesByName(
    name,
    instanceIds = null
  ) {
    const allowedIds =
      Array.isArray(instanceIds)
        ? new Set(
            instanceIds.map(value =>
              String(value || "")
            )
          )
        : null;
    return savedApiCompositeInstanceContexts()
      .filter(context => {
        const node = context.owner;
        if (
          node?.operatorId !==
            "container.apiComposite" ||
          (allowedIds &&
            !allowedIds.has(node.id))
        ) {
          return false;
        }
        const composite = context.composite;
        return Boolean(
          composite &&
          savedApiCompositeNodeMatchesName(
            node,
            composite,
            name
          )
        );
      })
      .map(context => context.owner);
  }

function savedApiCompositeReplacementNodeSignature(
    node
  ) {
    const parameters = nodeGraphClone(
      node?.parameters || {}
    );
    for (const key of [
      "savedApiCompositeId",
      "savedApiCompositeUpdatedAt",
      "apiCompositeFingerprint",
      "boundaryPorts",
      "memberCount"
    ]) {
      delete parameters[key];
    }
    return JSON.stringify(
      savedApiCompositeCanonicalValue({
        kind: String(node?.kind || ""),
        operatorId: String(
          node?.operatorId || ""
        ),
        apiContract:
          node?.apiContract || null,
        label: String(node?.label || ""),
        parameters
      })
    );
  }

function mapSavedApiCompositeReplacementNodes(
    previousComposite,
    sourceComposite
  ) {
    const previousNodes =
      previousComposite.nodes || [];
    const sourceNodes =
      sourceComposite.nodes || [];
    const previousIdentity =
      savedApiCompositeElementIdentity(
        previousComposite.elementIdentity,
        previousComposite
      );
    const sourceIdentity =
      savedApiCompositeElementIdentity(
        sourceComposite.elementIdentity,
        sourceComposite
      );
    const result = new Map();
    const usedSourceIds = new Set();
    const sourceByStable = new Map();
    for (const sourceNode of sourceNodes) {
      const stable =
        sourceIdentity.nodes[
          sourceNode.id
        ];
      if (!sourceByStable.has(stable)) {
        sourceByStable.set(stable, []);
      }
      sourceByStable.get(stable).push(
        sourceNode
      );
    }
    const compatible = (
      left,
      right,
      {
        allowNestedContentChange = false
      } = {}
    ) => {
      if (
        !left ||
        !right ||
        left.kind !== right.kind ||
        left.operatorId !== right.operatorId
      ) {
        return false;
      }
      if (
        left.operatorId !==
          "container.apiComposite"
      ) {
        return true;
      }
      const previousNested =
        previousComposite
          .apiCompositeGraphs?.[left.id];
      const sourceNested =
        sourceComposite
          .apiCompositeGraphs?.[right.id];
      if (!previousNested || !sourceNested) {
        return false;
      }
      if (allowNestedContentChange) {

        return true;
      }

      return false;
    };
    const assign = (
      previousNode,
      sourceNode,
      options = {}
    ) => {
      if (
        !compatible(
          previousNode,
          sourceNode,
          options
        ) ||
        result.has(previousNode.id) ||
        usedSourceIds.has(sourceNode.id)
      ) {
        return false;
      }
      result.set(
        previousNode.id,
        sourceNode.id
      );
      usedSourceIds.add(sourceNode.id);
      return true;
    };

    for (const previousNode of previousNodes) {
      const candidates =
        sourceByStable.get(
          previousIdentity.nodes[
            previousNode.id
          ]
        ) || [];
      if (candidates.length === 1) {
        assign(
          previousNode,
          candidates[0],
          {
            allowNestedContentChange: true
          }
        );
      }
    }
    const sourceById = new Map(
      sourceNodes.map(node => [
        node.id,
        node
      ])
    );
    for (const previousNode of previousNodes) {
      if (result.has(previousNode.id)) {
        continue;
      }
      assign(
        previousNode,
        sourceById.get(previousNode.id),
        {
          allowNestedContentChange: true
        }
      );
    }

    const prefixLength = Math.min(
      previousNodes.length,
      sourceNodes.length
    );
    for (let index = 0;
      index < prefixLength;
      index += 1) {
      const previousNode =
        previousNodes[index];
      const sourceNode = sourceNodes[index];
      if (
        result.has(previousNode.id) ||
        usedSourceIds.has(sourceNode.id) ||
        savedApiCompositeReplacementNodeSignature(
          previousNode
        ) !==
          savedApiCompositeReplacementNodeSignature(
            sourceNode
          )
      ) {
        continue;
      }
      assign(previousNode, sourceNode);
    }

    const remainingPreviousBySignature =
      new Map();
    const remainingSourceBySignature =
      new Map();
    for (const previousNode of previousNodes) {
      if (result.has(previousNode.id)) {
        continue;
      }
      const signature =
        savedApiCompositeReplacementNodeSignature(
          previousNode
        );
      if (!remainingPreviousBySignature.has(
        signature
      )) {
        remainingPreviousBySignature.set(
          signature,
          []
        );
      }
      remainingPreviousBySignature.get(
        signature
      ).push(previousNode);
    }
    for (const sourceNode of sourceNodes) {
      if (usedSourceIds.has(sourceNode.id)) {
        continue;
      }
      const signature =
        savedApiCompositeReplacementNodeSignature(
          sourceNode
        );
      if (!remainingSourceBySignature.has(
        signature
      )) {
        remainingSourceBySignature.set(
          signature,
          []
        );
      }
      remainingSourceBySignature.get(
        signature
      ).push(sourceNode);
    }
    for (const [signature, previousMatches] of
      remainingPreviousBySignature) {
      const sourceMatches =
        remainingSourceBySignature.get(
          signature
        ) || [];
      if (
        previousMatches.length === 1 &&
        sourceMatches.length === 1
      ) {
        assign(
          previousMatches[0],
          sourceMatches[0]
        );
      } else if (
        previousMatches.length > 0 &&
        sourceMatches.length > 0
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.2eefee047eb2")
        );
      }
    }
    const unmatchedPreviousNested =
      previousNodes.filter(node =>
        node?.operatorId ===
          "container.apiComposite" &&
        !result.has(node.id)
      );
    const unmatchedSourceNested =
      sourceNodes.filter(node =>
        node?.operatorId ===
          "container.apiComposite" &&
        !usedSourceIds.has(node.id)
      );
    if (
      unmatchedPreviousNested.length > 0 &&
      unmatchedSourceNested.length > 0
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.f83d1d1c290b")
      );
    }
    return {
      previousToSource: result,
      previousIdentity,
      sourceIdentity
    };
  }

function savedApiCompositeConnectionEndpointKey(
    connection,
    nodeMap = null
  ) {
    const fromNode = nodeMap
      ? nodeMap.get(connection.fromNode)
      : connection.fromNode;
    const toNode = nodeMap
      ? nodeMap.get(connection.toNode)
      : connection.toNode;
    if (!fromNode || !toNode) return "";
    return [
      fromNode,
      connection.fromPort,
      toNode,
      connection.toPort
    ].join("\u0000");
  }

function mapSavedApiCompositeReplacementConnections(
    previousComposite,
    sourceComposite,
    previousToSource
  ) {
    const previousIdentity =
      savedApiCompositeElementIdentity(
        previousComposite.elementIdentity,
        previousComposite
      );
    const sourceIdentity =
      savedApiCompositeElementIdentity(
        sourceComposite.elementIdentity,
        sourceComposite
      );
    const sourceByStable = new Map();
    const sourceByKey = new Map();
    for (const connection of
      sourceComposite.connections || []) {
      const stable =
        sourceIdentity.connections[
          connection.id
        ];
      if (!sourceByStable.has(stable)) {
        sourceByStable.set(stable, []);
      }
      sourceByStable.get(stable).push(
        connection
      );
      const key =
        savedApiCompositeConnectionEndpointKey(
          connection
        );
      if (!sourceByKey.has(key)) {
        sourceByKey.set(key, []);
      }
      sourceByKey.get(key).push(connection);
    }
    const result = new Map();
    const used = new Set();
    const assign = (
      previous,
      source,
      { allowEndpointChange = false } = {}
    ) => {
      if (!previous || !source || used.has(source.id)) {
        return false;
      }
      const key =
        savedApiCompositeConnectionEndpointKey(
          previous,
          previousToSource
        );
      if (
        !key ||
        (!allowEndpointChange &&
          key !==
          savedApiCompositeConnectionEndpointKey(
            source
          ))
      ) {
        return false;
      }
      result.set(previous.id, source.id);
      used.add(source.id);
      return true;
    };
    for (const previous of
      previousComposite.connections || []) {
      const candidates =
        sourceByStable.get(
          previousIdentity.connections[
            previous.id
          ]
        ) || [];
      if (candidates.length === 1) {
        const source = candidates[0];
        const previousStable =
          savedApiCompositeIdentityText(
            previousComposite.elementIdentity
              ?.connections?.[previous.id]
          );
        const sourceStable =
          savedApiCompositeIdentityText(
            sourceComposite.elementIdentity
              ?.connections?.[source.id]
          );
        const explicitStableMatch = Boolean(
          previousStable &&
          sourceStable &&
          previousStable === sourceStable
        );
        assign(previous, source, {
          allowEndpointChange:
            explicitStableMatch &&
            previousToSource.has(
              previous.fromNode
            ) &&
            previousToSource.has(
              previous.toNode
            )
        });
      }
    }
    for (const previous of
      previousComposite.connections || []) {
      if (result.has(previous.id)) continue;
      const key =
        savedApiCompositeConnectionEndpointKey(
          previous,
          previousToSource
        );
      const candidates =
        sourceByKey.get(key) || [];
      const available = candidates.filter(
        connection => !used.has(connection.id)
      );
      if (available.length === 1) {
        assign(previous, available[0]);
      } else if (available.length > 1) {
        throw new Error(
          window.RMLI18n.t("ui.literal.20a120ad23b6")
        );
      }
    }
    return {
      previousToSourceConnection: result,
      previousIdentity,
      sourceIdentity
    };
  }

function savedApiCompositeReplacementImpact(
    record,
    instances
  ) {
    const plan =
      buildSavedApiCompositeReplacementCandidate(
        record,
        instances,
        {
          requireExact: true,
          allowTopologyDisconnects: true,
          invalidateCaches: false
        }
      );
    return {
      connectedWires:
        plan.preservedWires,
      preservedWires:
        plan.preservedWires,
      promotedNodes:
        plan.promotedNodes,
      promotedComposites:
        plan.promotedComposites,
      disconnectedWires:
        plan.disconnectedWires
    };
  }

function savedApiCompositeRequiredBoundaryKeys(
    root
  ) {
    const required = new Set();
    const queue = [];
    const compositesByOwnerId = new Map();
    const appendRequired = (
      ownerId,
      direction,
      boundaryId
    ) => {
      const normalizedOwnerId = String(
        ownerId || ""
      );
      const normalizedBoundaryId = String(
        boundaryId || ""
      );
      if (
        !normalizedOwnerId ||
        !normalizedBoundaryId
      ) {
        return;
      }
      const key =
        `${normalizedOwnerId}\u0000${direction}\u0000${normalizedBoundaryId}`;
      if (required.has(key)) return;
      required.add(key);
      queue.push({
        ownerId: normalizedOwnerId,
        direction,
        boundaryId:
          normalizedBoundaryId
      });
    };
    const visit = (
      documentValue,
      depth = 0,
      stack = new WeakSet()
    ) => {
      if (
        !documentValue ||
        typeof documentValue !== "object" ||
        Array.isArray(documentValue) ||
        stack.has(documentValue) ||
        depth >
          SAVED_API_COMPOSITE_NESTING_LIMIT
      ) {
        return;
      }
      stack.add(documentValue);
      try {
        const registry =
          documentValue.apiCompositeGraphs &&
          typeof documentValue
            .apiCompositeGraphs === "object" &&
          !Array.isArray(
            documentValue.apiCompositeGraphs
          )
            ? documentValue.apiCompositeGraphs
            : {};
        const owners = new Map();
        for (const owner of
          Array.isArray(documentValue.nodes)
            ? documentValue.nodes
            : []) {
          if (
            owner?.operatorId !==
              "container.apiComposite"
          ) {
            continue;
          }
          const ownerId = String(
            owner.id || ""
          );
          const composite = registry[ownerId];
          if (!ownerId || !composite) {
            continue;
          }
          owners.set(ownerId, owner);
          compositesByOwnerId.set(
            ownerId,
            composite
          );
        }
        for (const connection of
          Array.isArray(
            documentValue.connections
          )
            ? documentValue.connections
            : []) {
          if (owners.has(connection.fromNode)) {
            appendRequired(
              connection.fromNode,
              "output",
              connection.fromPort
            );
          }
          if (owners.has(connection.toNode)) {
            appendRequired(
              connection.toNode,
              "input",
              connection.toPort
            );
          }
        }
        for (const ownerId of owners.keys()) {
          visit(
            registry[ownerId],
            depth + 1,
            stack
          );
        }
      } finally {
        stack.delete(documentValue);
      }
    };
    visit(root);
    let queueIndex = 0;
    while (queueIndex < queue.length) {
      const current = queue[queueIndex];
      queueIndex += 1;
      const composite =
        compositesByOwnerId.get(
          current.ownerId
        );
      const boundary =
        apiCompositeBoundaryRecords(
          composite?.boundaryPorts
        ).find(candidate =>
          candidate.direction ===
            current.direction &&
          candidate.id ===
            current.boundaryId
        );
      if (!boundary) continue;
      const nestedOwner =
        composite.nodes?.find(node =>
          node?.operatorId ===
            "container.apiComposite" &&
          String(node.id || "") ===
            boundary.internalNodeId
        );
      if (!nestedOwner) continue;
      appendRequired(
        nestedOwner.id,
        boundary.direction,
        boundary.internalPortId
      );
    }
    return required;
  }

function savedApiCompositeRequiredBoundaryKey(
    ownerId,
    direction,
    boundaryId
  ) {
    return `${String(ownerId || "")}\u0000${direction}\u0000${String(boundaryId || "")}`;
  }

function pruneSavedApiCompositeDanglingAncestorBoundaries(
    documentValue,
    ancestorOwnerIds,
    requiredBoundaryKeys,
    documentOwnerId = "",
    depth = 0,
    stack = new WeakSet()
  ) {
    if (
      !documentValue ||
      typeof documentValue !== "object" ||
      Array.isArray(documentValue) ||
      stack.has(documentValue) ||
      depth >
        SAVED_API_COMPOSITE_NESTING_LIMIT
    ) {
      return 0;
    }
    stack.add(documentValue);
    let removed = 0;
    try {
      const registry =
        documentValue.apiCompositeGraphs &&
        typeof documentValue
          .apiCompositeGraphs === "object" &&
        !Array.isArray(
          documentValue.apiCompositeGraphs
        )
          ? documentValue.apiCompositeGraphs
          : {};
      const nestedOwners = new Map(
        (Array.isArray(documentValue.nodes)
          ? documentValue.nodes
          : [])
          .filter(node =>
            node?.operatorId ===
              "container.apiComposite" &&
            registry[node.id]
          )
          .map(node => [
            String(node.id || ""),
            node
          ])
      );
      for (const ownerId of
        nestedOwners.keys()) {
        removed +=
          pruneSavedApiCompositeDanglingAncestorBoundaries(
            registry[ownerId],
            ancestorOwnerIds,
            requiredBoundaryKeys,
            ownerId,
            depth + 1,
            stack
          );
      }
      if (
        ancestorOwnerIds.has(
          documentOwnerId
        ) &&
        Array.isArray(
          documentValue.boundaryPorts
        )
      ) {
        const before =
          apiCompositeBoundaryRecords(
            documentValue.boundaryPorts
          );
        documentValue.boundaryPorts =
          before.filter(boundary => {
            if (
              !nestedOwners.has(
                boundary.internalNodeId
              )
            ) {
              return true;
            }
            const nested =
              registry[
                boundary.internalNodeId
              ];
            const nestedBoundaryExists =
              apiCompositeBoundaryRecords(
                nested?.boundaryPorts
              ).some(candidate =>
                candidate.direction ===
                  boundary.direction &&
                candidate.id ===
                  boundary.internalPortId
              );
            if (nestedBoundaryExists) {
              return true;
            }
            if (
              requiredBoundaryKeys.has(
                savedApiCompositeRequiredBoundaryKey(
                  documentOwnerId,
                  boundary.direction,
                  boundary.id
                )
              )
            ) {
              throw new Error(
                `Exact Library replacement would remove connected Composite ${boundary.direction} port '${boundary.label || boundary.id}'. The confirmed topology-removal mode is required before its outward wires can be removed. Nothing was replaced.`
              );
            }
            removed += 1;
            return false;
          });
        if (
          documentValue.boundaryPorts
            .length !== before.length
        ) {
          documentValue.elementIdentity =
            savedApiCompositeElementIdentity(
              documentValue.elementIdentity,
              documentValue,
              documentValue.elementIdentity
                ?.templateId || ""
            );
        }
      }
      return removed;
    } finally {
      stack.delete(documentValue);
    }
  }

function savedApiCompositeCandidateLevel(
    root,
    path
  ) {
    if (!root || !Array.isArray(path) || path.length === 0) {
      return null;
    }
    let documentValue = root;
    for (
      let index = 0;
      index < path.length - 1;
      index += 1
    ) {
      documentValue =
        documentValue
          ?.apiCompositeGraphs?.[
            path[index]
          ];
      if (!documentValue) return null;
    }
    const ownerId = path.at(-1);
    return {
      documentValue,
      ownerId,
      nodes:
        Array.isArray(documentValue.nodes)
          ? documentValue.nodes
          : [],
      connections:
        Array.isArray(
          documentValue.connections
        )
          ? documentValue.connections
          : [],
      registry:
        documentValue.apiCompositeGraphs &&
        typeof documentValue
          .apiCompositeGraphs === "object" &&
        !Array.isArray(
          documentValue.apiCompositeGraphs
        )
          ? documentValue.apiCompositeGraphs
          : null
    };
  }

function independentSavedApiCompositeInstances(
    instances
  ) {
    const contexts =
      savedApiCompositeInstanceContexts();
    const requested = new Set(
      (Array.isArray(instances)
        ? instances
        : [])
        .map(owner =>
          String(owner?.id || owner || "")
        )
        .filter(Boolean)
    );
    const selected = contexts
      .filter(context =>
        requested.has(
          String(
            context.owner?.id || ""
          )
        )
      )
      .sort((left, right) =>
        left.depth - right.depth
      );
    const retained = [];
    for (const context of selected) {
      if (
        retained.some(ancestor =>
          ancestor.path.length <
            context.path.length &&
          ancestor.path.every(
            (ownerId, index) =>
              context.path[index] ===
                ownerId
          )
        )
      ) {
        continue;
      }
      retained.push(context);
    }
    return retained.map(
      context => context.owner
    );
  }

function savedApiCompositeReplacementBoundaryIndex(
    composite
  ) {
    const boundaries =
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      );
    composite.boundaryPorts = boundaries;
    return {
      composite,
      boundaries,
      byEndpoint: new Map(
        boundaries.map(boundary => [
          apiCompositeBoundaryEndpointKey(
            boundary
          ),
          boundary
        ])
      ),
      usedIds: new Set(
        boundaries.map(boundary =>
          boundary.id
        )
      ),
      next: {
        input: 1,
        output: 1
      }
    };
  }

function synchronizeSavedApiCompositeCandidateOwners(
    documentValue,
    depth = 0,
    stack = new WeakSet()
  ) {
    if (
      !documentValue ||
      typeof documentValue !== "object" ||
      Array.isArray(documentValue) ||
      stack.has(documentValue) ||
      depth >
        SAVED_API_COMPOSITE_NESTING_LIMIT
    ) {
      return;
    }
    stack.add(documentValue);
    try {
      const registry =
        documentValue.apiCompositeGraphs &&
        typeof documentValue
          .apiCompositeGraphs === "object" &&
        !Array.isArray(
          documentValue.apiCompositeGraphs
        )
          ? documentValue.apiCompositeGraphs
          : {};
      for (const owner of
        Array.isArray(documentValue.nodes)
          ? documentValue.nodes
          : []) {
        if (
          owner?.operatorId !==
            "container.apiComposite"
        ) {
          continue;
        }
        const composite = registry[owner.id];
        if (!composite) continue;
        synchronizeSavedApiCompositeCandidateOwners(
          composite,
          depth + 1,
          stack
        );
        owner.parameters =
          owner.parameters &&
          typeof owner.parameters === "object"
            ? owner.parameters
            : {};
        owner.parameters.boundaryPorts =
          nodeGraphClone(
            apiCompositeBoundaryRecords(
              composite.boundaryPorts
            )
          );
        owner.parameters.memberCount =
          Array.isArray(composite.nodes)
            ? composite.nodes.length
            : 0;
        composite.elementIdentity =
          savedApiCompositeElementIdentity(
            composite.elementIdentity,
            composite,
            composite.elementIdentity
              ?.templateId ||
              owner.parameters
                .savedApiCompositeId ||
              ""
          );
        const name =
          savedApiCompositeCurrentName(
            owner,
            composite
          );
        const portLayout =
          owner.parameters.portLayout ===
            "mirrored"
            ? "mirrored"
            : "standard";
        const fingerprint = String(
          composite.contentFingerprint ||
          owner.parameters
            .apiCompositeFingerprint ||
          ""
        );
        composite.contentFingerprint =
          fingerprint;
        composite.fingerprintNameKey =
          savedApiCompositeNameKey(name);
        composite.fingerprintPortLayout =
          portLayout;
        owner.parameters.apiCompositeFingerprint =
          fingerprint;
      }
    } finally {
      stack.delete(documentValue);
    }
  }

function buildSavedApiCompositeReplacementCandidate(
    record,
    instances,
    {
      linkToSaved = true,
      requireExact = false,
      allowTopologyDisconnects = false,
      invalidateCaches = true
    } = {}
  ) {
    const rootView = rootRuntimeGraphView();
    const liveContexts =
      savedApiCompositeInstanceContexts();
    const replacements =
      independentSavedApiCompositeInstances(
        instances
      );
    const candidateRoot = {
      ...graph,
      apiCompositeGraphs:
        nodeGraphClone(
          graph.apiCompositeGraphs || {}
        ),
      customCSharpFiles:
        nodeGraphClone(
          graph.customCSharpFiles || {}
        ),
      ...nodeGraphClone(
        graphViewFrom(rootView)
      ),
      branchRouting: nodeGraphClone(
        rootView?.branchRouting ||
          graph.branchRouting ||
          {}
      )
    };
    const preservedConnectionPoints =
      new Map();
    const preservedBranchConnectionIds =
      new Set();
    const requiredBoundaryKeys =
      savedApiCompositeRequiredBoundaryKeys(
        candidateRoot
      );
    const exactAncestorOwnerIds =
      new Set();
    const disconnectedConnectionIds =
      new Set();
    let promotedNodes = 0;
    let promotedComposites = 0;

    for (const sourceOwner of replacements) {
      const sourceContext =
        savedApiCompositeInstanceContext(
          sourceOwner,
          liveContexts
        );
      const level =
        savedApiCompositeCandidateLevel(
          candidateRoot,
          sourceContext?.path
        );
      const ownerIndex =
        level?.nodes.findIndex(node =>
          node.id === sourceOwner.id
        ) ?? -1;
      const previousComposite =
        level?.registry?.[sourceOwner.id];
      if (
        !sourceContext ||
        !level ||
        !level.registry ||
        ownerIndex < 0 ||
        !previousComposite
      ) {
        throw new Error(
          `Placed Composite '${sourceOwner.label || sourceOwner.id}' no longer has a complete owned graph. Nothing was replaced.`
        );
      }

      const nodeMapping =
        mapSavedApiCompositeReplacementNodes(
          previousComposite,
          record.composite
        );
      const replacement =
        remapSavedApiCompositeInstance(
          record,
          sourceOwner.id,
          sourceOwner.x,
          sourceOwner.y
        );
      replacement.container.x = sourceOwner.x;
      replacement.container.y = sourceOwner.y;
      replacement.container.width =
        sourceOwner.width ?? null;
      replacement.container.height =
        sourceOwner.height ?? null;
      const effectivePortLayout =
        Object.hasOwn(
          record.composite,
          "portLayout"
        )
          ? record.composite.portLayout ===
              "mirrored"
            ? "mirrored"
            : "standard"
          : sourceOwner.parameters
                ?.portLayout === "mirrored"
            ? "mirrored"
            : "standard";
      const effectiveFingerprint = String(
        record.contentFingerprint ||
        record.composite
          .contentFingerprint ||
        ""
      );
      replacement.container.parameters.portLayout =
        effectivePortLayout;
      replacement.composite.portLayout =
        effectivePortLayout;
      replacement.container.parameters.apiCompositeFingerprint =
        effectiveFingerprint;
      if (!linkToSaved) {
        delete replacement.container
          .parameters.savedApiCompositeId;
        delete replacement.container
          .parameters.savedApiCompositeUpdatedAt;
      }
      replacement.composite.contentFingerprint =
        effectiveFingerprint;
      replacement.composite.fingerprintNameKey =
        savedApiCompositeNameKey(
          record.name
        );
      replacement.composite.fingerprintPortLayout =
        effectivePortLayout;

      const previousToNew = new Map();
      for (const [previousId, sourceId] of
        nodeMapping.previousToSource) {
        const newId =
          replacement.trace.nodes.get(
            sourceId
          );
        if (!newId) {
          throw new Error(
            window.RMLI18n.t("ui.literal.570711e5d8f7")
          );
        }
        previousToNew.set(previousId, newId);
      }
      const promotedIds = new Set(
        previousComposite.nodes
          .map(node => node.id)
          .filter(id =>
            !previousToNew.has(id)
          )
      );
      const promoted =
        previousComposite.nodes
          .filter(node =>
            promotedIds.has(node.id)
          )
          .map(node => nodeGraphClone(node));
      promotedNodes += promoted.length;
      promotedComposites += promoted.filter(
        node =>
          node.operatorId ===
            "container.apiComposite"
      ).length;

      const connectionMapping =
        mapSavedApiCompositeReplacementConnections(
          previousComposite,
          record.composite,
          nodeMapping.previousToSource
        );
      const previousConnectionToNew =
        new Map();
      for (const [previousId, sourceId] of
        connectionMapping
          .previousToSourceConnection) {
        const newId =
          replacement.trace.connections.get(
            sourceId
          );
        if (newId) {
          previousConnectionToNew.set(
            previousId,
            newId
          );
        }
      }

      const oldBoundaries =
        apiCompositeBoundaryRecords(
          previousComposite.boundaryPorts ||
          sourceOwner.parameters
            ?.boundaryPorts
        );
      const oldBoundaryByKey = new Map(
        oldBoundaries.map(boundary => [
          `${boundary.direction}\u0000${boundary.id}`,
          boundary
        ])
      );
      const replacementNodeById = new Map(
        replacement.composite.nodes.map(
          node => [node.id, node]
        )
      );
      const replacementBoundaryIndex =
        savedApiCompositeReplacementBoundaryIndex(
          replacement.composite
        );
      const replacementBoundaryById =
        new Map(
          replacementBoundaryIndex
            .boundaries.map(boundary => [
              `${boundary.direction}\u0000${boundary.id}`,
              boundary
            ])
        );
      const boundaryMapping =
        mapSavedApiCompositeBoundaries(
          oldBoundaries,
          replacementBoundaryIndex
            .boundaries,
          {
            allowTypeOnly:
              !requireExact,
            previousElementIdentity:
              previousComposite
                .elementIdentity,
            replacementElementIdentity:
              replacement.composite
                .elementIdentity
          }
        );
      const endpointFor = (
        direction,
        previousNodeId,
        portId,
        preferredBoundary = null
      ) => {
        if (promotedIds.has(previousNodeId)) {
          return {
            nodeId: previousNodeId,
            portId,
            promoted: true,
            boundary: null
          };
        }
        const newNodeId =
          previousToNew.get(previousNodeId);
        const newNode =
          replacementNodeById.get(newNodeId);
        if (!newNode) {
          throw new Error(
            `A connected node '${previousNodeId}' cannot be mapped losslessly. Nothing was replaced.`
          );
        }
        const endpointKey =
          `${direction}\u0000${newNode.id}\u0000${portId}`;
        const boundary =
          replacementBoundaryIndex
            .byEndpoint.get(endpointKey);
        if (
          !boundary &&
          requireExact &&
          !allowTopologyDisconnects
        ) {
          throw new Error(
            `Exact Library replacement would remove connected Composite ${direction} port '${preferredBoundary?.label || preferredBoundary?.id || portId}'. The confirmed topology-removal mode is required before its outward wires can be removed. Nothing was replaced.`
          );
        }
        if (!boundary) return null;
        return {
          nodeId: sourceOwner.id,
          portId: boundary.id,
          promoted: false,
          boundary
        };
      };
      const endpointForOldBoundary = (
        direction,
        boundaryId
      ) => {
        const boundaryKey =
          `${direction}\u0000${boundaryId}`;
        const mappedBoundaryId =
          boundaryMapping.get(
            boundaryKey
          );
        const mappedBoundary =
          mappedBoundaryId
            ? replacementBoundaryById.get(
                `${direction}\u0000${mappedBoundaryId}`
              )
            : null;
        if (mappedBoundary) {
          return {
            nodeId: sourceOwner.id,
            portId: mappedBoundary.id,
            promoted: false,
            boundary: mappedBoundary
          };
        }
        const boundary =
          oldBoundaryByKey.get(
            boundaryKey
          );
        if (!boundary) {
          if (allowTopologyDisconnects) {
            return null;
          }
          throw new Error(
            `API Composite ${direction} '${boundaryId}' is unavailable. Nothing was replaced.`
          );
        }
        if (allowTopologyDisconnects) {
          return null;
        }
        throw new Error(
          `Exact Library replacement cannot preserve connected Composite ${direction} port '${boundary.label || boundary.id}' because the new real contract does not contain it. Nothing was replaced.`
        );
      };

      const parentEndpointMappings =
        new Map();
      const invalidParentConnectionIds = [];
      for (const source of
        level.connections) {
        let fromEndpoint = null;
        let toEndpoint = null;
        if (
          source.fromNode ===
            sourceOwner.id
        ) {
          fromEndpoint =
            endpointForOldBoundary(
              "output",
              source.fromPort
            );
          if (!fromEndpoint) {
            invalidParentConnectionIds.push(
              source.id
            );
          }
        }
        if (
          source.toNode ===
            sourceOwner.id
        ) {
          toEndpoint =
            endpointForOldBoundary(
              "input",
              source.toPort
            );
          if (!toEndpoint) {
            invalidParentConnectionIds.push(
              source.id
            );
          }
        }
        parentEndpointMappings.set(
          source.id,
          { fromEndpoint, toEndpoint }
        );
      }
      if (
        invalidParentConnectionIds.length >
          0 &&
        !allowTopologyDisconnects
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.aa80c3463abc")
        );
      }
      const removedParentConnections =
        invalidParentConnectionIds.length > 0
          ? apiCompositeRemoveConnectionsFromDocument(
              level.documentValue,
              invalidParentConnectionIds
            )
          : new Set();
      for (const connectionId of
        removedParentConnections) {
        disconnectedConnectionIds.add(
          connectionId
        );
        preservedConnectionPoints.delete(
          connectionId
        );
        preservedBranchConnectionIds.delete(
          connectionId
        );
      }

      const parentConnections =
        level.connections.map(source => {
          const connection =
            nodeGraphClone(source);
          const endpoints =
            parentEndpointMappings.get(
              source.id
            ) || {};
          if (endpoints.fromEndpoint) {
            connection.fromNode =
              endpoints.fromEndpoint.nodeId;
            connection.fromPort =
              endpoints.fromEndpoint.portId;
          }
          if (endpoints.toEndpoint) {
            connection.toNode =
              endpoints.toEndpoint.nodeId;
            connection.toPort =
              endpoints.toEndpoint.portId;
          }
          preservedConnectionPoints.set(
            connection.id,
            JSON.stringify(
              connection.points || []
            )
          );
          return connection;
        });

      const pendingParentConnections = [];
      const pendingLocalInsideConnections = [];
      const invalidLocalConnectionIds = [];
      const restoredParentConnectionIds =
        new Set();
      for (const source of
        previousComposite.connections || []) {
        const sourcePromoted =
          promotedIds.has(source.fromNode);
        const targetPromoted =
          promotedIds.has(source.toNode);
        if (sourcePromoted || targetPromoted) {
          const connection =
            nodeGraphClone(source);
          const fromEndpoint = endpointFor(
            "output",
            source.fromNode,
            source.fromPort
          );
          const toEndpoint = endpointFor(
            "input",
            source.toNode,
            source.toPort
          );
          if (!fromEndpoint || !toEndpoint) {
            invalidLocalConnectionIds.push(
              source.id
            );
            continue;
          }
          connection.fromNode =
            fromEndpoint.nodeId;
          connection.fromPort =
            fromEndpoint.portId;
          connection.toNode =
            toEndpoint.nodeId;
          connection.toPort =
            toEndpoint.portId;
          pendingParentConnections.push(
            connection
          );
          continue;
        }
        if (
          previousConnectionToNew.has(
            source.id
          )
        ) {
          continue;
        }
        const connection =
          nodeGraphClone(source);
        connection.fromNode =
          previousToNew.get(
            source.fromNode
          );
        connection.toNode =
          previousToNew.get(
            source.toNode
          );
        if (
          !connection.fromNode ||
          !connection.toNode
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.37245a89ad20")
          );
        }
        pendingLocalInsideConnections.push(
          connection
        );
      }
      if (
        invalidLocalConnectionIds.length >
          0 &&
        !allowTopologyDisconnects
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.bd68d3d90ff4")
        );
      }
      if (
        invalidLocalConnectionIds.some(
          connectionId =>
            previousConnectionToNew.has(
              connectionId
            )
        )
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.ac54a46d5d08")
        );
      }
      const removedLocalConnections =
        invalidLocalConnectionIds.length > 0
          ? apiCompositeExpandedConnectionRemovalIds(
              previousComposite.connections,
              invalidLocalConnectionIds,
              previousComposite.branchRouting
            )
          : new Set();
      for (const connectionId of
        removedLocalConnections) {
        preservedConnectionPoints.delete(
          connectionId
        );
        preservedBranchConnectionIds.delete(
          connectionId
        );
        const replacementId =
          previousConnectionToNew.get(
            connectionId
          );
        if (replacementId) {
          if (
            !replacement.composite.connections
              .some(connection =>
                connection.id === replacementId
              )
          ) {
            throw new Error(
              `Mapped Saved Composite connection '${connectionId}' is unavailable after remapping. Nothing was replaced.`
            );
          }
          continue;
        }
        disconnectedConnectionIds.add(
          connectionId
        );
      }
      for (const connection of
        pendingParentConnections) {
        if (
          removedLocalConnections.has(
            connection.id
          )
        ) {
          continue;
        }
        parentConnections.push(connection);
        restoredParentConnectionIds.add(
          connection.id
        );
        preservedConnectionPoints.set(
          connection.id,
          JSON.stringify(
            connection.points || []
          )
        );
      }
      const localInsideConnections =
        pendingLocalInsideConnections.filter(
          connection =>
            !removedLocalConnections.has(
              connection.id
            )
        );
      for (const connection of
        localInsideConnections) {
        preservedConnectionPoints.set(
          connection.id,
          JSON.stringify(
            connection.points || []
          )
        );
      }
      replacement.composite.connections.push(
        ...localInsideConnections
      );

      const allOldConnections = new Map([
        ...level.connections,
        ...(previousComposite.connections || [])
      ].map(connection => [
        connection.id,
        connection
      ]));
      const allNewConnections = new Map([
        ...parentConnections,
        ...replacement.composite.connections
      ].map(connection => [
        connection.id,
        connection
      ]));
      const parentConnectionIds = new Set(
        parentConnections.map(
          connection => connection.id
        )
      );
      const connectionAfter = oldId =>
        allNewConnections.has(oldId)
          ? oldId
          : previousConnectionToNew.get(
              oldId
            ) || "";
      const oldRouting = {
        ...(previousComposite.branchRouting ||
          {})
      };
      for (const connection of
        allOldConnections.values()) {
        if (connection.branchFrom) {
          oldRouting[connection.id] =
            nodeGraphClone(
              connection.branchFrom
            );
        }
      }
      const replacementRouting = {
        ...(replacement.composite
          .branchRouting || {})
      };
      for (const [oldChildId, branch] of
        Object.entries(oldRouting)) {
        if (
          !preservedConnectionPoints.has(
            oldChildId
          )
        ) {
          continue;
        }
        const childId =
          connectionAfter(oldChildId);
        const parentId =
          connectionAfter(
            branch?.connectionId
          );
        const oldParent =
          allOldConnections.get(
            branch?.connectionId
          );
        const newParent =
          allNewConnections.get(parentId);
        if (!childId || !parentId || !newParent) {
          if (
            preservedConnectionPoints.has(
              oldChildId
            )
          ) {
            throw new Error(
              `Branch route '${oldChildId}' cannot be mapped losslessly. Nothing was replaced.`
            );
          }
          continue;
        }
        if (
          parentConnectionIds.has(childId) &&
          parentConnectionIds.has(parentId)
        ) {
          const childConnection =
            allNewConnections.get(childId);
          if (
            !(newParent.points || []).some(
              point =>
                point.id === branch.pointId
            )
          ) {
            throw new Error(
              `Branch point '${oldChildId}' cannot be restored in its parent graph. Nothing was replaced.`
            );
          }
          childConnection.branchFrom = {
            connectionId: parentId,
            pointId: branch.pointId
          };
          delete replacementRouting[childId];
          preservedBranchConnectionIds.add(
            childId
          );
          continue;
        }
        let pointId = String(
          branch?.pointId || ""
        );
        if (
          parentId !== branch.connectionId ||
          !(newParent.points || []).some(
            point => point.id === pointId
          )
        ) {
          const oldPointIndex =
            (oldParent?.points || [])
              .findIndex(point =>
                point.id === pointId
              );
          const indexedPoint =
            oldPointIndex >= 0
              ? newParent.points?.[
                  oldPointIndex
                ]
              : null;
          if (indexedPoint) {
            pointId = indexedPoint.id;
          } else {
            const oldPoint =
              oldParent?.points?.find(
                point =>
                  point.id ===
                    branch.pointId
              );
            if (!oldPoint) {
              if (
                preservedConnectionPoints.has(
                  oldChildId
                )
              ) {
                throw new Error(
                  `Branch point '${oldChildId}' cannot be mapped losslessly. Nothing was replaced.`
                );
              }
              continue;
            }
            const clonedPoint = {
              ...nodeGraphClone(oldPoint),
              id: makeId("wire-point")
            };
            newParent.points = [
              ...(newParent.points || []),
              clonedPoint
            ];
            pointId = clonedPoint.id;
          }
        }
        replacementRouting[childId] = {
          connectionId: parentId,
          pointId
        };
        preservedBranchConnectionIds.add(
          childId
        );
      }
      replacement.composite.branchRouting =
        replacementRouting;

      if (
        Array.isArray(
          level.documentValue.boundaryPorts
        )
      ) {
        level.documentValue.boundaryPorts =
          apiCompositeBoundaryRecords(
            level.documentValue
              .boundaryPorts
          ).map(boundary => {
            if (
              boundary.internalNodeId !==
                sourceOwner.id
            ) {
              return boundary;
            }
            const oldBoundary =
              oldBoundaryByKey.get(
                `${boundary.direction}\u0000${boundary.internalPortId}`
              );
            if (!oldBoundary) {
              if (!allowTopologyDisconnects) {
                throw new Error(
                  `Composite ${boundary.direction} port '${boundary.label || boundary.id}' points to a missing child port. Confirm the replacement warning before its outward chain is disconnected. Nothing was replaced.`
                );
              }
              return null;
            }
            const endpoint =
              endpointForOldBoundary(
                boundary.direction,
                boundary.internalPortId
              );
            if (!endpoint) {
              if (!allowTopologyDisconnects) {
                throw new Error(
                  `Exact Library replacement removes Composite ${boundary.direction} port '${boundary.label || boundary.id}'. Confirm the replacement warning before its outward chain is disconnected. Nothing was replaced.`
                );
              }
              return null;
            }
            return {
              ...boundary,
              internalNodeId:
                endpoint.nodeId,
              internalPortId:
                endpoint.portId,
              type:
                endpoint.boundary?.type ||
                boundary.type || "",
              typeVar:
                endpoint.boundary?.typeVar ||
                boundary.typeVar || "",
              constraint:
                endpoint.boundary
                  ?.constraint ||
                boundary.constraint ||
                "value"
            };
          }).filter(Boolean);
      }

      const parentNodes =
        level.nodes.filter(node =>
          node.id !== sourceOwner.id
        );
      parentNodes.splice(
        Math.min(
          ownerIndex,
          parentNodes.length
        ),
        0,
        replacement.container,
        ...promoted
      );
      level.nodes.splice(
        0,
        level.nodes.length,
        ...parentNodes
      );
      level.documentValue.connections =
        parentConnections;
      if (level.connections !==
        level.documentValue.connections) {
        level.connections.splice(
          0,
          level.connections.length,
          ...parentConnections
        );
      }
      if (sourceContext.depth > 0) {
        const parentIdentity =
          nodeGraphClone(
            level.documentValue
              .elementIdentity || {}
          );
        parentIdentity.nodes =
          parentIdentity.nodes &&
          typeof parentIdentity.nodes ===
            "object"
            ? parentIdentity.nodes
            : {};
        parentIdentity.connections =
          parentIdentity.connections &&
          typeof parentIdentity
            .connections === "object"
            ? parentIdentity.connections
            : {};
        parentIdentity.points =
          parentIdentity.points &&
          typeof parentIdentity.points ===
            "object"
            ? parentIdentity.points
            : {};
        for (const node of promoted) {
          parentIdentity.nodes[node.id] =
            nodeMapping.previousIdentity
              .nodes[node.id] ||
            `node:${node.id}`;
        }
        for (const connectionId of
          restoredParentConnectionIds) {
          parentIdentity.connections[
            connectionId
          ] =
            connectionMapping
              .previousIdentity
              .connections[
                connectionId
              ] ||
            `connection:${connectionId}`;
          parentIdentity.points[
            connectionId
          ] = nodeGraphClone(
            connectionMapping
              .previousIdentity
              .points?.[
                connectionId
              ] || {}
          );
        }
        level.documentValue.elementIdentity =
          savedApiCompositeElementIdentity(
            parentIdentity,
            level.documentValue,
            parentIdentity.templateId || ""
          );
      }
      for (const node of promoted) {
        if (
          node.operatorId ===
            "container.apiComposite"
        ) {
          const nested =
            previousComposite
              .apiCompositeGraphs?.[
                node.id
              ];
          if (!nested) {
            throw new Error(
              `Promoted nested Composite '${node.id}' lost its owned graph. Nothing was replaced.`
            );
          }
          level.registry[node.id] =
            nodeGraphClone(nested);
        }
      }
      level.documentValue.customCSharpFiles =
        level.documentValue
          .customCSharpFiles &&
        typeof level.documentValue
          .customCSharpFiles === "object"
          ? level.documentValue
              .customCSharpFiles
          : {};
      for (const node of promoted) {
        if (
          node.operatorId === "csharp.file" &&
          previousComposite
            .customCSharpFiles?.[node.id]
        ) {
          level.documentValue
            .customCSharpFiles[node.id] =
            nodeGraphClone(
              previousComposite
                .customCSharpFiles[node.id]
            );
        }
      }
      savedApiCompositeApplyElementIdentity(
        replacement.composite,
        record.id
      );
      replacement.container.parameters.boundaryPorts =
        nodeGraphClone(
          replacement.composite
            .boundaryPorts
        );
      replacement.container.parameters.memberCount =
        replacement.composite.nodes.length;
      level.registry[sourceOwner.id] =
        replacement.composite;
      for (const ownerId of
        sourceContext.path.slice(0, -1)) {
        exactAncestorOwnerIds.add(
          ownerId
        );
      }

      if (sourceContext.depth === 0) {
        for (const ownerId of
          apiCompositeCustomCSharpOwnerIds(
            previousComposite
          )) {
          if (!promotedIds.has(ownerId)) {
            delete candidateRoot
              .customCSharpFiles[ownerId];
          }
        }
        mergeCustomCSharpFileRegistry(
          candidateRoot.customCSharpFiles,
          replacement.composite
            .customCSharpFiles
        );
      }
    }

    if (
      requireExact &&
      !allowTopologyDisconnects
    ) {
      pruneSavedApiCompositeDanglingAncestorBoundaries(
        candidateRoot,
        exactAncestorOwnerIds,
        requiredBoundaryKeys
      );
    }
    const reconciliation =
      reconcileApiCompositeBoundaryTree(
        candidateRoot,
        { invalidateCaches }
      );
    if (
      reconciliation.disconnectedWires !==
        reconciliation
          .disconnectedConnectionIds.length
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.37da6b62404a")
      );
    }
    if (
      reconciliation.disconnectedWires > 0 &&
      !allowTopologyDisconnects
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.ee153a98a209")
      );
    }
    for (const connectionId of
      reconciliation
        .disconnectedConnectionIds) {
      disconnectedConnectionIds.add(
        connectionId
      );
      preservedConnectionPoints.delete(
        connectionId
      );
      preservedBranchConnectionIds.delete(
        connectionId
      );
    }
    synchronizeSavedApiCompositeCandidateOwners(
      candidateRoot
    );
    const expanded =
      expandApiCompositeGraphDocument(
        candidateRoot
      );
    const expandedById = new Map(
      expanded.connections.map(
        connection => [
          connection.id,
          connection
        ]
      )
    );
    for (const connectionId of
      disconnectedConnectionIds) {
      if (expandedById.has(connectionId)) {
        throw new Error(
          `Wire '${connectionId}' was approved for removal but remains in the replacement candidate. Nothing was replaced.`
        );
      }
    }
    for (const [connectionId, points] of
      preservedConnectionPoints) {
      const connection =
        expandedById.get(connectionId);
      if (
        !connection ||
        JSON.stringify(
          connection.points || []
        ) !== points
      ) {
        throw new Error(
          `Wire '${connectionId}' could not be preserved exactly. Nothing was replaced.`
        );
      }
    }
    for (const connectionId of
      preservedBranchConnectionIds) {
      if (!expandedById.get(connectionId)?.branchFrom) {
        throw new Error(
          `Branch route '${connectionId}' could not be preserved. Nothing was replaced.`
        );
      }
    }
    const previousGraph = graph;
    const previousCustomCSharpEditor =
      customCSharpEditor;
    const previousDefinitionCache =
      graphNodeDefinitionCache;
    let analysis;
    try {
      graph = expanded;
      customCSharpEditor = null;
      graphNodeDefinitionCache =
        new WeakMap();
      analysis = analyzeConnections(
        expanded.connections
      );
    } finally {
      graph = previousGraph;
      customCSharpEditor =
        previousCustomCSharpEditor;
      graphNodeDefinitionCache =
        previousDefinitionCache;
    }
    if (!analysis?.valid) {
      throw new Error(
        analysis?.reason ||
        window.RMLI18n.t("ui.literal.f1446f417832")
      );
    }
    return {
      candidateRoot,
      replacements,
      promotedNodes,
      promotedComposites,
      preservedWires:
        preservedConnectionPoints.size,
      disconnectedWires:
        disconnectedConnectionIds.size
    };
  }

function replaceSavedApiCompositeInstances(
    record,
    instances,
    {
      linkToSaved = true,
      allowTopologyDisconnects = false,
      expectedImpact = null
    } = {}
  ) {
    const liveOpenFrames =
      apiCompositeEditorChain(
        apiCompositeEditor,
        { outermostFirst: true }
      );
    const openCompositeOwnerIds = new Set(
      liveOpenFrames.map(frame =>
        String(
          frame.containerNodeId || ""
        )
      ).filter(Boolean)
    );
    if (
      (Array.isArray(instances)
        ? instances
        : []).some(owner =>
          openCompositeOwnerIds.has(
            String(
              owner?.id || owner || ""
            )
          )
        )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.a705fad0cd8f")
      );
    }
    const liveGraph = graph;
    const liveApiCompositeEditor =
      apiCompositeEditor;
    const liveCustomCSharpEditor =
      customCSharpEditor;
    const liveDefinitionCache =
      graphNodeDefinitionCache;
    const liveAnalysis = currentAnalysis;
    let plan;
    try {
      graph = nodeGraphClone(liveGraph);
      let clonedParentEditor = null;
      for (const frame of
        liveOpenFrames) {
        clonedParentEditor = {
          ...frame,
          mainView: nodeGraphClone(
            frame.mainView
          ),
          initialNodeIds: new Set(
            frame.initialNodeIds || []
          ),
          boundaryUpdate: {
            ...(frame.boundaryUpdate || {
              added: 0,
              removed: 0
            })
          },
          parentEditor:
            clonedParentEditor,
          parent: null,
          ownerPath: Object.freeze([
            ...apiCompositeEditorOwnerPath(
              frame
            )
          ])
        };
      }
      apiCompositeEditor =
        clonedParentEditor;
      customCSharpEditor =
        liveCustomCSharpEditor
          ? {
              ...liveCustomCSharpEditor,
              mainView: nodeGraphClone(
                liveCustomCSharpEditor
                  .mainView
              )
            }
          : null;
      graphNodeDefinitionCache =
        new WeakMap();
      currentAnalysis = null;
      captureCustomCSharpEditorView({
        synchronizeSource: false
      });
      captureApiCompositeEditorView({
        synchronizeBoundaries: false
      });
      plan =
        buildSavedApiCompositeReplacementCandidate(
          record,
          instances,
          {
            linkToSaved,
            requireExact: true,
            allowTopologyDisconnects
          }
        );
    } finally {
      graph = liveGraph;
      apiCompositeEditor =
        liveApiCompositeEditor;
      customCSharpEditor =
        liveCustomCSharpEditor;
      graphNodeDefinitionCache =
        liveDefinitionCache;
      currentAnalysis = liveAnalysis;
    }
    if (expectedImpact) {
      const expected = {
        preservedWires: Number(
          expectedImpact.preservedWires || 0
        ),
        promotedNodes: Number(
          expectedImpact.promotedNodes || 0
        ),
        promotedComposites: Number(
          expectedImpact.promotedComposites || 0
        ),
        disconnectedWires: Number(
          expectedImpact.disconnectedWires || 0
        )
      };
      const actual = {
        preservedWires:
          plan.preservedWires,
        promotedNodes:
          plan.promotedNodes,
        promotedComposites:
          plan.promotedComposites,
        disconnectedWires:
          plan.disconnectedWires
      };
      if (
        JSON.stringify(actual) !==
          JSON.stringify(expected)
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.97a717345b26")
        );
      }
    }
    const candidateRoot =
      plan.candidateRoot;
    const activeOwnerPath =
      apiCompositeEditorOwnerPath(
        liveApiCompositeEditor
      );
    const activeComposite =
      activeOwnerPath.length > 0
        ? apiCompositeDocumentAtOwnerPath(
            candidateRoot,
            activeOwnerPath
          )
        : null;
    if (
      activeOwnerPath.length > 0 &&
      !activeComposite
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.b0ee3b8a74fd")
      );
    }
    const restoredFrameStates =
      liveOpenFrames.map(frame => {
        const ownerPath =
          apiCompositeEditorOwnerPath(
            frame
          );
        const parentDocument =
          apiCompositeDocumentAtOwnerPath(
            candidateRoot,
            ownerPath.slice(0, -1)
          );
        const composite =
          apiCompositeDocumentAtOwnerPath(
            candidateRoot,
            ownerPath
          );
        const ownerId = String(
          ownerPath.at(-1) || ""
        );
        const owner =
          parentDocument?.nodes?.find(
            node => node?.id === ownerId
          );
        if (!owner || !composite) {
          throw new Error(
            window.RMLI18n.t("ui.literal.180754856e8a")
          );
        }
        return {
          frame,
          ownerPath,
          parentDocument,
          composite,
          owner
        };
      });
    graph.apiCompositeGraphs =
      candidateRoot.apiCompositeGraphs;
    graph.customCSharpFiles =
      candidateRoot.customCSharpFiles;
    commitRootRuntimeGraphView(
      candidateRoot
    );
    const committedRootView =
      outermostApiCompositeEditor()
        ?.mainView ||
      customCSharpEditor?.mainView ||
      graph;
    committedRootView.branchRouting =
      nodeGraphClone(
        candidateRoot.branchRouting || {}
      );
    if (liveOpenFrames.length > 0) {
      let restoredParentEditor = null;
      for (const {
        frame,
        ownerPath,
        parentDocument,
        composite,
        owner
      } of restoredFrameStates) {
        frame.parentEditor =
          restoredParentEditor;
        frame.parent = null;
        frame.ownerPath = Object.freeze([
          ...ownerPath
        ]);
        frame.mainView = graphViewFrom(
          parentDocument
        );
        frame.title =
          savedApiCompositeCurrentName(
            owner,
            composite
          );
        frame.initialNodeIds = new Set(
          (composite.nodes || []).map(
            node => node.id
          )
        );
        restoredParentEditor = frame;
      }
      apiCompositeEditor =
        restoredParentEditor;
      if (customCSharpEditor) {
        const fileNodeId = String(
          customCSharpEditor.fileNodeId ||
          ""
        );
        const customGraph =
          activeComposite
            ?.customCSharpFiles?.[
              fileNodeId
            ];
        const customOwnerExists = Boolean(
          activeComposite?.nodes?.some(
            node => node?.id === fileNodeId
          )
        );
        customCSharpEditor.mainView =
          graphViewFrom(activeComposite);
        if (
          customOwnerExists &&
          customGraph
        ) {
          applyGraphView(
            graphViewFrom(customGraph)
          );
        } else {
          customCSharpEditor = null;
          applyGraphView(
            graphViewFrom(activeComposite)
          );
        }
      } else {
        applyGraphView(
          graphViewFrom(activeComposite)
        );
      }
    }
    currentAnalysis = null;
    resetGraphRenderCaches();
    renderGraphNodesAndWires();
    renderGraphInspector();
    scheduleAcceptedGraphPersistenceAfterPaint({
      refreshGeneratedOutput: true,
      refreshCompositeActions: true,
      mutationClass: "topology"
    });
    return {
      replaced:
        plan.replacements.length,
      promotedNodes:
        plan.promotedNodes,
      promotedComposites:
        plan.promotedComposites,
      preservedWires:
        plan.preservedWires,
      disconnectedWires:
        plan.disconnectedWires
    };
  }

function savedApiCompositeRecordMutationKey(
    record
  ) {
    return Object.freeze({
      record,
      libraryRevision:
        savedApiCompositePaletteStateRevision()
    });
  }

function savedApiCompositeReplacementTargetToken(
    owner,
    contexts = null
  ) {
    const context =
      savedApiCompositeInstanceContext(
        owner,
        contexts
      );
    if (!context) return "";
    const ownerId = String(
      context.owner.id || ""
    );
    const path = (context.path || [])
      .map(value =>
        encodeURIComponent(
          String(value || "")
        )
      )
      .join("/");
    return `${ownerId}\u0000${path}\u0000${savedApiCompositeCompareCandidateDescriptor(
      context
    )}\u0000${savedApiCompositeCompareDocumentRevision(
      context.composite,
      context.path
    )}`;
  }

async function applySavedApiCompositeVersion(
    record,
    {
      instanceIds = null,
      source = "library",
      linkToSaved = true,
      expectedCatalogBatchEpoch = ""
    } = {}
  ) {
    const replacementCatalogBatchEpoch =
      String(
        expectedCatalogBatchEpoch ||
        currentSavedApiCompositeCatalogBatchEpoch()
      );
    assertSavedApiCompositeCatalogBatchEpoch(
      replacementCatalogBatchEpoch,
      "before placed Saved Composite instances could be checked"
    );
    showGraphMessage(
      `Preparing replacement check for Saved API Composite '${record.name}'…`
    );
    await savedApiCompositePaintOpportunity();
    const matching =
      matchingSavedApiCompositeInstances(
        record,
        instanceIds,
        {
          staleOnly: true
        }
      );
    const openOwnerIds = new Set(
      apiCompositeEditorChain(
        apiCompositeEditor
      ).map(frame =>
        String(
          frame.containerNodeId || ""
        )
      ).filter(Boolean)
    );
    const eligible = matching.filter(
      owner =>
        !openOwnerIds.has(owner.id)
    );
    const replaceable =
      independentSavedApiCompositeInstances(
        eligible
      );
    const skippedOpen =
      matching.filter(owner =>
        openOwnerIds.has(owner.id)
      ).length;
    if (skippedOpen > 0) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.98e302ff3b4a"),
        "warning"
      );
      return {
        replaced: 0,
        skippedOpen,
        disconnectedWires: 0,
        linkedByName: 0,
        cancelled: false
      };
    }
    const instanceContexts =
      savedApiCompositeInstanceContexts();
    const linkedByName =
      replaceable.filter(owner =>
        String(
          owner.parameters
            ?.savedApiCompositeId || ""
        ) !== record.id
      ).length;
    const legacyFingerprint =
      record[
        SAVED_API_COMPOSITE_LEGACY_FINGERPRINT
      ] === true;
    const requiresFingerprintMigration =
      legacyFingerprint ||
      replaceable.some(owner => {
        const composite =
          savedApiCompositeInstanceContext(
            owner,
            instanceContexts
          )?.composite;
        return !String(
          composite?.contentFingerprint ||
          owner.parameters
            ?.apiCompositeFingerprint ||
          ""
        );
      });
    if (replaceable.length === 0) {
      showGraphMessage(
        skippedOpen > 0
          ? window.RMLI18n.t("ui.literal.a21b7af087a2")
          : window.RMLI18n.t("ui.literal.50d96f5a907f"),
        skippedOpen > 0
          ? "warning"
          : ""
      );
      return {
        replaced: 0,
        skippedOpen,
        disconnectedWires: 0,
        linkedByName: 0,
        cancelled: false
      };
    }
    const impact =
      savedApiCompositeReplacementImpact(
        record,
        replaceable
      );
    const projectEpoch =
      builderProjectEpoch;
    const bridgeProjectEpoch =
      bridge?.getProjectEpoch?.() ?? null;
    const recordMutationKey =
      savedApiCompositeRecordMutationKey(
        record
      );
    const graphMutationRevision =
      typeof graphContentMutationSequence ===
        "number"
        ? graphContentMutationSequence
        : 0;
    const targetIds = replaceable
      .map(owner => String(owner.id || ""))
      .sort();
    const targetTokens = new Map(
      replaceable.map(owner => [
        String(owner.id || ""),
        savedApiCompositeReplacementTargetToken(
          owner,
          instanceContexts
        )
      ])
    );
    const confirm =
      window.RMLBuilderDialog?.confirm;
    if (typeof confirm !== "function") {
      throw new Error(
        window.RMLI18n.t("ui.literal.dbcb506567a4")
      );
    }
    const confirmed = Boolean(
      await confirm({
        tone:
          impact.disconnectedWires > 0
            ? "danger"
            : "primary",
        kicker:
          source === "import"
            ? window.RMLI18n.t("composite.replace_instances.kicker.import")
            : window.RMLI18n.t("composite.replace_instances.kicker.saved"),
        title:
          source === "import"
            ? window.RMLI18n.format(
                replaceable.length === 1
                  ? "composite.replace_instances.title.current.one"
                  : "composite.replace_instances.title.current.other",
                { count: replaceable.length.toLocaleString(window.RMLI18n?.language || undefined) }
              )
            : window.RMLI18n.format(
                replaceable.length === 1
                  ? "composite.replace_instances.title.one"
                  : "composite.replace_instances.title.other",
                { count: replaceable.length.toLocaleString(window.RMLI18n?.language || undefined) }
              ),
        message:
          `${source === "import" ? `${window.RMLI18n.t("ui.literal.17dd714abbc9")} ` : ""}${
            linkedByName > 0
              ? requiresFingerprintMigration
                ? window.RMLI18n.t("ui.literal.3d6261df928f")
                : window.RMLI18n.t("ui.literal.d2898d6f979d")
              : window.RMLI18n.t("ui.literal.0b635071d16f")
          }`,
        details:
          `${impact.preservedWires.toLocaleString(window.RMLI18n?.language || undefined)} wire${impact.preservedWires === 1 ? " is" : "s are"} preserved with their IDs and route points. ${impact.disconnectedWires > 0 ? `Warning: continuing removes ${impact.disconnectedWires.toLocaleString(window.RMLI18n?.language || undefined)} outer wire${impact.disconnectedWires === 1 ? "" : "s"}, including branch descendants, because the real Composite port is missing or is now connected internally. The affected node connections must be created again where still needed.` : "No outer wire needs to be removed."} ${impact.promotedNodes.toLocaleString(window.RMLI18n?.language || undefined)} member node${impact.promotedNodes === 1 ? " is" : "s are"} restored to the immediate parent graph${impact.promotedComposites > 0 ? `, including ${impact.promotedComposites.toLocaleString(window.RMLI18n?.language || undefined)} nested Composite${impact.promotedComposites === 1 ? "" : "s"}` : ""}.${skippedOpen > 0 ? ` ${skippedOpen.toLocaleString(window.RMLI18n?.language || undefined)} currently open instance is skipped until you leave it through the Runtime Graph breadcrumb.` : ""}`,
        confirmLabel:
          source === "import"
            ? "Replace in Current Graph"
            : impact.disconnectedWires > 0
            ? `Replace & Disconnect ${impact.disconnectedWires.toLocaleString(window.RMLI18n?.language || undefined)} Wire${impact.disconnectedWires === 1 ? "" : "s"}`
            : replaceable.length === 1
              ? "Replace Instance"
              : "Replace Instances",
        cancelLabel:
          window.RMLI18n.t("ui.literal.950736fb351a")
      })
    );
    if (!confirmed) {
      return {
        replaced: 0,
        skippedOpen,
        disconnectedWires: 0,
        linkedByName: 0,
        cancelled: true
      };
    }
    showGraphMessage(
      `Applying Saved API Composite '${record.name}' to the confirmed graph instances…`
    );
    await savedApiCompositePaintOpportunity();
    const stabilityLease =
      await acquireSavedApiCompositeCatalogStabilityLease(
        replacementCatalogBatchEpoch,
        "while placed-instance replacement confirmation was open"
      );
    let result;
    try {
      const currentRecord =
        linkToSaved
          ? savedApiCompositeTemplates.get(
              record.id
            )
          : record;
    if (
      builderProjectEpoch !== projectEpoch ||
      (
        bridgeProjectEpoch !== null &&
        bridge?.getProjectEpoch?.() !==
          bridgeProjectEpoch
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.9d5798bb6c1c")
      );
    }
    if (
      !currentRecord ||
      currentRecord !==
        recordMutationKey.record ||
      savedApiCompositePaletteStateRevision() !==
        recordMutationKey.libraryRevision
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.7e1c138bdce2")
      );
    }
    if (
      (typeof graphContentMutationSequence ===
        "number"
        ? graphContentMutationSequence
        : 0) !== graphMutationRevision
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.e36436cb05a2")
      );
    }
    const currentMatching =
      matchingSavedApiCompositeInstances(
        currentRecord,
        instanceIds,
        { staleOnly: true }
      );
    const currentOpenOwnerIds = new Set(
      apiCompositeEditorChain(
        apiCompositeEditor
      ).map(frame =>
        String(
          frame.containerNodeId || ""
        )
      ).filter(Boolean)
    );
    if (
      currentMatching.some(owner =>
        currentOpenOwnerIds.has(
          owner.id
        )
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.aa028ed4a0c0")
      );
    }
    const currentReplaceable =
      independentSavedApiCompositeInstances(
        currentMatching
      );
    const currentTargetIds =
      currentReplaceable
        .map(owner => String(owner.id || ""))
        .sort();
    if (
      JSON.stringify(currentTargetIds) !==
        JSON.stringify(targetIds)
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.b1423398edd7")
      );
    }
    const currentContexts =
      savedApiCompositeInstanceContexts();
    for (const owner of
      currentReplaceable) {
      const ownerId = String(
        owner.id || ""
      );
      if (
        savedApiCompositeReplacementTargetToken(
          owner,
          currentContexts
        ) !== targetTokens.get(ownerId)
      ) {
        throw new Error(
          `Placed Composite '${owner.label || ownerId}' changed while replacement confirmation was open. Nothing was replaced.`
        );
      }
    }
      result =
        replaceSavedApiCompositeInstances(
          currentRecord,
          currentReplaceable,
          {
            linkToSaved,
            allowTopologyDisconnects: true,
            expectedImpact: impact
          }
        );
    } finally {
      stabilityLease.release();
    }
    await bridge?.flushPersistence?.();
    scheduleGraphPaletteRender();
    showGraphMessage(
      `${result.replaced.toLocaleString(window.RMLI18n?.language || undefined)} placed Composite instance${result.replaced === 1 ? " was" : "s were"} replaced.${linkedByName > 0 ? linkToSaved ? ` ${linkedByName.toLocaleString(window.RMLI18n?.language || undefined)} unlinked or stale-linked instance${linkedByName === 1 ? " was" : "s were"} matched by exact normalized name and linked to this Saved Composite fingerprint.` : ` ${linkedByName.toLocaleString(window.RMLI18n?.language || undefined)} graph-only instance${linkedByName === 1 ? " was" : "s were"} matched by exact normalized name and remained independent from the Saved Composite library.` : ""} ${result.preservedWires.toLocaleString(window.RMLI18n?.language || undefined)} wire${result.preservedWires === 1 ? " was" : "s were"} preserved.${result.disconnectedWires > 0 ? ` ${result.disconnectedWires.toLocaleString(window.RMLI18n?.language || undefined)} obsolete outer wire${result.disconnectedWires === 1 ? " was" : "s were"} removed with its port chain.` : ""}${result.promotedNodes > 0 ? ` ${result.promotedNodes.toLocaleString(window.RMLI18n?.language || undefined)} locally added member node${result.promotedNodes === 1 ? " was" : "s were"} restored to the parent graph.` : ""}`,
      "success"
    );
    return {
      ...result,
      skippedOpen,
      linkedByName,
      cancelled: false
    };
  }

async function instantiateSavedApiCompositeAt(
    templateId,
    x,
    y,
    {
      fitAfter = false,
      paletteDrop = false
    } = {}
  ) {
    const id = String(templateId || "");
    if (customCSharpEditor) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.0b71da39ac68"),
        "error"
      );
      return null;
    }
    if (!apiCompositeCatalogAvailable()) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.ca0541899f1b"),
        "error"
      );
      return null;
    }
    if (savedApiCompositeLibraryBusy()) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.2ab86910a0a7"),
        "error"
      );
      return null;
    }
    if (
      savedApiCompositeOperations.has(id)
    ) {
      return null;
    }
    const source =
      savedApiCompositeTemplates.get(id);
    if (!source) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.7cb576f13e20"),
        "error"
      );
      return null;
    }
    const insertionIssue =
      savedApiCompositeInsertionIssue(
        source
      );
    if (insertionIssue) {
      showGraphMessage(
        insertionIssue,
        "error"
      );
      return null;
    }
    const instantiationCatalogBatchEpoch =
      currentSavedApiCompositeCatalogBatchEpoch();
    assertSavedApiCompositeCatalogBatchEpoch(
      instantiationCatalogBatchEpoch,
      "before the Saved Composite could be prepared for placement"
    );
    const targetGraph = graph;
    const targetContext =
      openApiCompositeOwnerContext();
    const targetComposite =
      targetContext?.composite || null;
    const targetOwnerId =
      targetContext?.ownerId || "";
    savedApiCompositeOperations.add(id);
    scheduleGraphPaletteRender();
    showGraphMessage(
      `Preparing Saved API Composite '${source.name}'…`
    );
    await savedApiCompositePaintOpportunity();
    try {
      const resolved =
        await resolveSavedApiCompositeForCurrentCatalog(
          source,
          {
            persistResolved: true,
            sourceRecordIsSanitized: true,
            includeResolutionDetails: true,
            expectedCatalogBatchEpoch:
              instantiationCatalogBatchEpoch
          }
        );
      const record = resolved.record;
      window.RMLDynamicGraphHost
        ?.reconcileInsertedCompositeCatalogState?.(
          record.composite
        );
      if (
        String(
          resolved.resolution
            ?.catalogResolutionBatchEpochToken ||
          ""
        ) !== instantiationCatalogBatchEpoch
      ) {
        throw savedApiCompositeCatalogEpochChangedError(
          "while the Saved Composite was being resolved for placement"
        );
      }
      const stabilityLease =
        await acquireSavedApiCompositeCatalogStabilityLease(
          instantiationCatalogBatchEpoch,
          "while the Saved Composite was being prepared for placement"
        );
      try {
      const liveTargetContext =
        openApiCompositeOwnerContext();
      if (
        graph !== targetGraph ||
        (
          targetComposite
            ? liveTargetContext?.ownerId !==
                targetOwnerId ||
              liveTargetContext?.composite !==
                targetComposite
            : Boolean(liveTargetContext)
        )
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.cf4fa71b80d7")
        );
      }
      const liveInsertionIssue =
        savedApiCompositeInsertionIssue(
          record
        );
      if (liveInsertionIssue) {
        throw new Error(
          liveInsertionIssue
        );
      }
      const containerId =
        uniqueSavedCompositeGraphId(
          "api-composite",
          graphIdentitySetsForSavedComposite()
            .nodeIds
        );
      const instance =
        remapSavedApiCompositeInstance(
          record,
          containerId,
          x,
          y,
          {
            exactPosition:
              paletteDrop === true
          }
        );
      const validationGraph = {
        version: GRAPH_SCHEMA_VERSION,
        active: true,
        apiCompositeGraphs: {
          [containerId]:
            instance.composite
        },
        customCSharpFiles: nodeGraphClone(
          instance.composite
            .customCSharpFiles || {}
        ),
        nodes: [instance.container],
        connections: [],
        viewport: {
          x: 0,
          y: 0,
          scale: 1
        },
        selectedNodeId: containerId,
        selectedNodeIds: [containerId],
        selectedConnectionId: null,
        selectedWirePoint: null,
        nextSequence: 2
      };
      const expanded =
        expandApiCompositeGraphDocument(
          validationGraph
        );
      const previousGraph = graph;
      let analysis;
      try {
        graph = expanded;

        const expandedConnections =
          Array.isArray(expanded.connections)
            ? expanded.connections
            : [];
        const skippedConnectionIds = new Set();

        for (const connection of expandedConnections) {
          const sourceExists = !!findPortSpec(
            connection?.fromNode,
            connection?.fromPort,
            "output"
          );
          const targetExists = !!findPortSpec(
            connection?.toNode,
            connection?.toPort,
            "input"
          );
          if (!sourceExists || !targetExists) {
            if (connection?.id) {
              skippedConnectionIds.add(
                String(connection.id)
              );
            }
          }
        }

        let addedSkippedBranch = true;
        while (addedSkippedBranch) {
          addedSkippedBranch = false;
          for (const connection of expandedConnections) {
            const id = String(connection?.id || "");
            if (id && skippedConnectionIds.has(id)) {
              continue;
            }
            const parentConnectionId = String(
              connection?.branch?.parentConnectionId || ""
            );
            if (
              parentConnectionId &&
              skippedConnectionIds.has(parentConnectionId)
            ) {
              if (id) skippedConnectionIds.add(id);
              addedSkippedBranch = true;
            }
          }
        }

        const liveValidationConnections =
          expandedConnections.filter(connection =>
            !skippedConnectionIds.has(
              String(connection?.id || "")
            )
          );

        analysis = analyzeConnections(
          liveValidationConnections
        );
      } finally {
        graph = previousGraph;
      }
      if (!analysis?.valid) {
        throw new Error(
          analysis?.reason ||
          window.RMLI18n.t("ui.literal.abd9c87c9cc4")
        );
      }

      const previousNodeCount =
        graph.nodes.length;
      const previousSelectedNodeIds =
        new Set([
          ...(graph.selectedNodeIds || []),
          graph.selectedNodeId
        ].filter(Boolean));
      const targetDocument =
        targetComposite || graph;
      targetDocument.apiCompositeGraphs = {
        ...(targetDocument.apiCompositeGraphs || {}),
        [containerId]: instance.composite
      };
      graph.nodes.push(instance.container);
      window.RMLDynamicGraphHost
        ?.reconcileInsertedCompositeCatalogState?.(
          targetDocument
        );
      markGraphNodeViewportSpatialStructureMutation(
        graph.nodes,
        true
      );
      const insertedStats =
        savedApiCompositeGraphStats(
          instance.composite
        );
      graph.nextSequence +=
        insertedStats.nodes +
        insertedStats.connections + 1;
      graph.selectedNodeId = containerId;
      graph.selectedNodeIds = [containerId];
      graph.selectedConnectionId = null;
      clearSelectedWirePoint();
      if (paletteDrop) {
        commitPaletteDroppedGraphNode(
          instance.container,
          previousNodeCount,
          previousSelectedNodeIds
        );
      } else {
        currentAnalysis = null;
        graphNodeDefinitionCache =
          new WeakMap();
        resetGraphRenderCaches();
        renderGraphNodesAndWires();
        renderGraphInspector();
        scheduleGraphPaletteRender();
        scheduleAcceptedGraphPersistenceAfterPaint({
          refreshGeneratedOutput: true,
          refreshCompositeActions: true,
          mutationClass: "topology"
        });
        if (fitAfter) {
          requestProjectAnimationFrame(
            centerGraph
          );
        }
      }
      showGraphMessage(
        targetComposite
          ? `Saved API Composite '${record.name}' inserted as an independent nested Composite with new node and wire identities.`
          : `Saved API Composite '${record.name}' inserted with new node and wire identities.`,
        "success"
      );
      return instance.container;
      } finally {
        stabilityLease.release();
      }
    } catch (error) {
      showGraphMessage(
        error instanceof Error
          ? error.message
          : String(error),
        "error"
      );
      return null;
    } finally {
      savedApiCompositeOperations.delete(id);
      scheduleGraphPaletteRender();
      void scheduleSavedApiCompositeCatalogReconciliation();
    }
  }

  async function unlinkSavedApiCompositeLibraryReferences(
    source,
    templateId,
    initialName = ""
  ) {
    const id = String(templateId || "");
    const affectedNameKeys = new Set();
    const initialNameKey =
      savedApiCompositeNameKey(initialName);
    if (initialNameKey) {
      affectedNameKeys.add(initialNameKey);
    }
    let unlinkedInstances = 0;
    const visited = new WeakSet();
    const pending = [source];
    let pendingIndex = 0;
    let workSinceYield = 0;
    while (pendingIndex < pending.length) {
      const candidate = pending[pendingIndex];
      pendingIndex += 1;
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        visited.has(candidate) ||
        !Array.isArray(candidate.nodes)
      ) {
        continue;
      }
      visited.add(candidate);
      const compositeGraphs =
        candidate.apiCompositeGraphs &&
        typeof candidate.apiCompositeGraphs ===
          "object" &&
        !Array.isArray(
          candidate.apiCompositeGraphs
        )
          ? candidate.apiCompositeGraphs
          : {};
      for (const node of candidate.nodes) {
        workSinceYield += 1;
        if (
          node?.operatorId !==
            "container.apiComposite" ||
          node.parameters
            ?.savedApiCompositeId !== id
        ) {
          if (workSinceYield >= 1024) {
            workSinceYield = 0;
            await yieldSavedApiCompositeTask();
          }
          continue;
        }
        const nameKey =
          savedApiCompositeNameKey(
            savedApiCompositeCurrentName(
              node,
              compositeGraphs[node.id] || null
            )
          );
        if (nameKey) {
          affectedNameKeys.add(nameKey);
        }
        delete node.parameters
          .savedApiCompositeId;
        delete node.parameters
          .savedApiCompositeUpdatedAt;
        unlinkedInstances += 1;
        if (workSinceYield >= 1024) {
          workSinceYield = 0;
          await yieldSavedApiCompositeTask();
        }
      }
      const customCSharpFiles =
        candidate.customCSharpFiles &&
        typeof candidate.customCSharpFiles ===
          "object" &&
        !Array.isArray(
          candidate.customCSharpFiles
        )
          ? candidate.customCSharpFiles
          : {};
      for (const key in customCSharpFiles) {
        if (
          Object.prototype.hasOwnProperty.call(
            customCSharpFiles,
            key
          )
        ) {
          pending.push(customCSharpFiles[key]);
        }
      }
      for (const key in compositeGraphs) {
        if (
          Object.prototype.hasOwnProperty.call(
            compositeGraphs,
            key
          )
        ) {
          pending.push(compositeGraphs[key]);
        }
      }
      workSinceYield += 1;
      if (workSinceYield >= 1024) {
        workSinceYield = 0;
        await yieldSavedApiCompositeTask();
      }
    }
    return {
      affectedNameKeys,
      unlinkedInstances
    };
  }

  function markSavedApiCompositePaletteDeleting(
    templateId
  ) {
    const restorers = [];
    for (const row of
      savedApiCompositePaletteRowsFor(
        templateId
      )) {
      const previousDeleting =
        row.dataset?.savedApiCompositeDeleting;
      if (row.dataset) {
        row.dataset.savedApiCompositeDeleting =
          "true";
      }
      row.setAttribute?.("aria-busy", "true");
      const controls = Array.from(
        row.querySelectorAll?.("button") || []
      );
      const controlStates = controls.map(
        control => ({
          control,
          disabled: control.disabled,
          ariaDisabled:
            control.getAttribute?.(
              "aria-disabled"
            )
        })
      );
      for (const control of controls) {
        control.disabled = true;
        control.setAttribute?.(
          "aria-disabled",
          "true"
        );
      }
      const marker = row.querySelector?.(
        ".rml-saved-api-composite-item small"
      );
      const previousMarker =
        marker?.textContent;
      if (marker) marker.textContent = "…";
      restorers.push(() => {
        if (row.dataset) {
          if (previousDeleting == null) {
            delete row.dataset
              .savedApiCompositeDeleting;
          } else {
            row.dataset
              .savedApiCompositeDeleting =
              previousDeleting;
          }
        }
        row.removeAttribute?.("aria-busy");
        for (const state of controlStates) {
          state.control.disabled =
            state.disabled;
          if (state.ariaDisabled == null) {
            state.control.removeAttribute?.(
              "aria-disabled"
            );
          } else {
            state.control.setAttribute?.(
              "aria-disabled",
              state.ariaDisabled
            );
          }
        }
        if (marker) {
          marker.textContent =
            previousMarker || "";
        }
      });
    }
    return () => {
      for (const restore of restorers) {
        restore();
      }
    };
  }

  async function removeSavedApiComposite(
    templateId
  ) {
    const id = String(templateId || "");
    const record =
      savedApiCompositeTemplates.get(id);
    if (!record) {
      return false;
    }
    if (savedApiCompositeLibraryBusy()) {
      showGraphMessage(
        window.RMLI18n.t("ui.literal.dd3f75d70d59"),
        "warning"
      );
      return false;
    }
    const confirmDelete =
      window.RMLBuilderDialog?.confirm;
    if (
      typeof confirmDelete !== "function" ||
      !await confirmDelete({
        tone: "danger",
        kicker:
          window.RMLI18n.t("composite.delete_saved.kicker"),
        title:
          window.RMLI18n.format(
            "composite.delete_saved.title",
            { name: record.name }
          ),
        message:
          window.RMLI18n.t("composite.delete_saved.message"),
        details:
          window.RMLI18n.t("composite.delete_saved.details"),
        confirmLabel:
          window.RMLI18n.t("composite.delete_saved.confirm"),
        cancelLabel:
          window.RMLI18n.t("composite.delete_saved.cancel")
      })
    ) {
      return false;
    }
    const operationKey =
      "saved-composite-delete";
    savedApiCompositeOperations.add(
      operationKey
    );
    let restoreDeletingState = () => {};
    let progressMarkerError = null;
    try {
      try {
        restoreDeletingState =
          markSavedApiCompositePaletteDeleting(
            id
          );
      } catch (error) {
        progressMarkerError = error;
      }
      await savedApiCompositePaintOpportunity();
      try {
        await deleteSavedApiCompositeRecord(id);
      } catch (error) {
        restoreDeletingState();
        showGraphMessage(
          error instanceof Error
            ? error.message
            : String(error),
          "error"
        );
        return false;
      }

      let uiRefreshError =
        progressMarkerError;
      try {
        removeSavedApiCompositePaletteItem(id);
      } catch (error) {
        uiRefreshError = error;
      }
      await savedApiCompositePaintOpportunity();

      let affectedNameKeys = new Set([
        savedApiCompositeNameKey(record.name)
      ]);
      let unlinkedInstances = 0;
      let linkCleanupError = null;
      try {
        const savedLinkDocument = {
          nodes:
            rootRuntimeGraphView().nodes,
          connections: [],
          customCSharpFiles:
            graph.customCSharpFiles,
          apiCompositeGraphs:
            graph.apiCompositeGraphs
        };
        const unlinkResult =
          await unlinkSavedApiCompositeLibraryReferences(
            savedLinkDocument,
            id,
            record.name
          );
        affectedNameKeys =
          unlinkResult.affectedNameKeys;
        unlinkedInstances =
          unlinkResult.unlinkedInstances;
        if (unlinkedInstances > 0) {
          scheduleAcceptedGraphPersistenceAfterPaint({
            refreshGeneratedOutput: false,
            refreshCompositeActions: false,
            mutationClass: "view",
            analysisChanged: false,
            contentChanged: false,
            documentChanged: true
          });
        }
      } catch (error) {
        linkCleanupError = error;
        console.warn(
          window.RMLI18n.t("ui.literal.1cda7d5cd824"),
          error
        );
      }

      savedApiCompositeOperations.delete(
        operationKey
      );
      try {
        if (uiRefreshError) {
          throw uiRefreshError;
        }
        refreshSavedApiCompositePaletteNamePeers(
          affectedNameKeys
        );
        refreshVisibleApiCompositeInspectorSaveActions();
        if (
          typeof acknowledgeGraphPaletteTargetedMutation ===
            "function"
        ) {
          acknowledgeGraphPaletteTargetedMutation();
        }
      } catch (error) {
        uiRefreshError = error;
        console.warn(
          window.RMLI18n.t("ui.literal.51d061ebf5ce"),
          error
        );
        try {
          scheduleGraphPaletteRender();
          refreshVisibleApiCompositeInspectorSaveActions();
        } catch (fallbackError) {
          console.error(
            window.RMLI18n.t("ui.literal.c6a5cc8b1102"),
            fallbackError
          );
        }
      }
      const postCommitError =
        linkCleanupError || uiRefreshError;
      showGraphMessage(
        postCommitError
          ? `Saved API Composite '${record.name}' was deleted, but its remaining graph-link or interface cleanup could not be completed. The graph instances themselves remain complete.`
          : `Saved API Composite '${record.name}' deleted. Existing graph instances were not changed.`,
        postCommitError ? "warning" : "success"
      );
      return true;
    } finally {
      savedApiCompositeOperations.delete(
        operationKey
      );
    }
  }

function savedApiCompositePaletteRowsFor(
    templateId
  ) {
    if (!dom.paletteContent) {
      return [];
    }
    const id = String(templateId || "");
    return [
      ...dom.paletteContent.querySelectorAll(
        ".rml-saved-api-composite-row"
      )
    ].filter(row =>
      String(
        row.dataset
          ?.savedApiCompositeRowFor ||
        row.querySelector(
          "[data-saved-api-composite-id]"
        )?.dataset
          ?.savedApiCompositeId ||
        ""
      ) === id
    );
  }

function removeSavedApiCompositePaletteItem(
    templateId
  ) {
    const groups = new Set();
    const scrollContainers = new Set();
    const rows =
      savedApiCompositePaletteRowsFor(
        templateId
      );
    for (const row of rows) {
      const group = row.closest(
        ".rml-saved-api-composite-group"
      );
      if (group) {
        groups.add(group);
        if (group.parentElement) {
          scrollContainers.add(
            group.parentElement
          );
        }
      }
      row.remove();
    }
    for (const group of groups) {
      const count =
        group.querySelectorAll(
          ".rml-saved-api-composite-row"
        ).length;
      if (count === 0) {
        group.remove();
        continue;
      }
      const countLabel =
        group.querySelector("summary b");
      if (countLabel) {
        countLabel.textContent =
          count.toLocaleString(window.RMLI18n?.language || undefined);
      }
    }
    const query = String(
      dom.paletteContent.querySelector(
        ".rml-graph-palette-search input"
      )?.value || ""
    ).trim();
    if (query.length >= 2) {
      for (const scroll of scrollContainers) {
        if (
          scroll.querySelector(
            ".rml-graph-palette-group, .rml-graph-palette-status"
          )
        ) {
          continue;
        }
        const message =
          document.createElement("div");
        message.className =
          "rml-graph-palette-status";
        message.textContent =
          window.RMLI18n.t("{{i18n:js.presentation.5d9081058da3}}");
        scroll.appendChild(message);
      }
    }
    return rows.length;
  }

function refreshSavedApiCompositePaletteNamePeers(
    nameKeys
  ) {
    if (
      !dom.paletteContent ||
      !(nameKeys instanceof Set) ||
      nameKeys.size === 0
    ) {
      return 0;
    }
    let refreshed = 0;
    for (const actions of [
      ...dom.paletteContent.querySelectorAll(
        "[data-saved-api-composite-actions-for]"
      )
    ]) {
      const record =
        savedApiCompositeTemplates.get(
          String(
            actions.dataset
              ?.savedApiCompositeActionsFor ||
            ""
          )
        );
      if (
        !record ||
        !nameKeys.has(
          savedApiCompositeNameKey(
            record.name
          )
        )
      ) {
        continue;
      }
      const row = actions.closest(
        ".rml-saved-api-composite-row"
      );
      if (!row) continue;
      row.replaceWith(
        createSavedApiCompositePaletteItem(
          record
        )
      );
      refreshed += 1;
    }
    return refreshed;
  }

function synchronizeApiCompositeInspectorSaveAction(
    actions,
    node
  ) {
    let saveAction = actions.querySelector(
      "[data-saved-api-composite-inspector-save]"
    );
    const composite =
      apiCompositeVisibleOwnedGraph(
        node.id
      );
    const target =
      resolveSavedApiCompositeSaveTarget(
        node,
        composite
      );
    const shouldShow = Boolean(
      target.mode !== "update" ||
      matchingSavedApiCompositeInstances(
        target.record,
        [node.id],
        { staleOnly: true }
      ).length > 0
    );
    if (!shouldShow) {
      saveAction?.remove();
      return;
    }
    const label =
      target.mode === "save"
        ? window.RMLI18n.t("js.presentation.a988dcb7fe09")
        : window.RMLI18n.t("js.presentation.fb91e24fa52d");
    if (!saveAction) {
      saveAction = inspectorButton(
        label,
        () =>
          saveApiCompositeNode(
            node.id
          ).catch(error =>
            showGraphMessage(
              error instanceof Error
                ? error.message
                : String(error),
              "error"
            )
          ),
        target.mode !== "save"
          ? "primary"
          : "",
        target.mode === "save" ? "save-composite" : "update-composite"
      );
      saveAction.dataset
        .savedApiCompositeInspectorSave =
        "true";
      const followingAction =
        actions.querySelector(
          "[data-saved-api-composite-save-new], [data-saved-api-composite-delete]"
        );
      if (followingAction) {
        actions.insertBefore(
          saveAction,
          followingAction
        );
      } else {
        actions.appendChild(saveAction);
      }
    } else {
      setInspectorButtonContent(
        saveAction,
        label,
        target.mode === "save" ? "save-composite" : "update-composite"
      );
    }
    saveAction.classList.toggle(
      "primary",
      target.mode !== "save"
    );
    saveAction.dataset
      .savedApiCompositeSaveMode =
      target.mode;
    if (target.record) {
      saveAction.dataset
        .savedApiCompositeTargetId =
        target.record.id;
    } else {
      delete saveAction.dataset
        .savedApiCompositeTargetId;
    }
    const unavailableReason =
      target.mode === "ambiguous"
        ? target.issue ||
          `The Saved API Composite identity for '${target.name}' is ambiguous.`
        : !apiCompositeCatalogAvailable()
          ? window.RMLI18n.t("ui.literal.ca0541899f1b")
          : savedApiCompositeLibraryBusy()
            ? window.RMLI18n.t("ui.literal.e25f5ee949a2")
            : "";
    setGraphButtonAvailability(
      saveAction,
      !unavailableReason,
      unavailableReason
    );
  }

async function removeSavedApiCompositeForNode(
    containerNodeId
  ) {
    const node =
      findGraphNode(containerNodeId);
    const composite =
      apiCompositeVisibleOwnedGraph(
        containerNodeId
      );
    const target = node
      ? resolveSavedApiCompositeSaveTarget(
          node,
          composite
        )
      : null;
    const linkedId = String(
      node?.parameters
        ?.savedApiCompositeId || ""
    );
    if (
      target?.mode !== "update" ||
      linkedId !== target.record.id
    ) {
      showGraphMessage(
        target?.mode === "ambiguous"
          ? target.issue ||
            `The Saved API Composite identity for '${target.name}' is ambiguous. Delete the intended entry from the Node Library.`
          : window.RMLI18n.t("ui.literal.969132895c98"),
        "error"
      );
      return false;
    }
    return removeSavedApiComposite(
      target.record.id
    );
  }

function synchronizeApiCompositeInspectorDeleteAction(
    actions,
    node
  ) {
    let deleteAction =
      actions.querySelector(
        "[data-saved-api-composite-delete]"
      );
    const composite =
      apiCompositeVisibleOwnedGraph(
        node.id
      );
    const target =
      resolveSavedApiCompositeSaveTarget(
        node,
        composite
      );
    const linkedId = String(
      node.parameters
        ?.savedApiCompositeId || ""
    );
    if (
      target.mode !== "update" ||
      linkedId !== target.record.id
    ) {
      deleteAction?.remove();
      return;
    }
    if (!deleteAction) {
      deleteAction = inspectorButton(
        window.RMLI18n.t("{{i18n:js.presentation.6b5be4a55679}}"),
        () =>
          removeSavedApiCompositeForNode(
            node.id
          ),
        "secondary",
        "delete-saved-composite"
      );
      deleteAction.dataset
        .savedApiCompositeDelete =
        "true";
      actions.appendChild(deleteAction);
    } else {
      setInspectorButtonContent(
        deleteAction,
        window.RMLI18n.t("js.presentation.6b5be4a55679"),
        "delete-saved-composite"
      );
    }
    deleteAction.dataset
      .savedApiCompositeTargetId =
      target.record.id;
    setGraphButtonAvailability(
      deleteAction,
      !savedApiCompositeLibraryBusy(),
      window.RMLI18n.t("ui.literal.e25f5ee949a2")
    );
  }

function synchronizeApiCompositeInspectorLibraryActions(
    actions,
    node
  ) {
    actions.querySelector(
      "[data-saved-api-composite-save-new]"
    )?.remove();
    synchronizeApiCompositeInspectorSaveAction(
      actions,
      node
    );
    synchronizeApiCompositeInspectorDeleteAction(
      actions,
      node
    );
  }

function refreshVisibleApiCompositeInspectorSaveActions() {
    if (!dom.inspectorContent) {
      return;
    }
    for (const actions of
      dom.inspectorContent.querySelectorAll(
        "[data-saved-api-composite-node-actions-for]"
      )) {
      const node = findGraphNode(
        String(
          actions.dataset
            .savedApiCompositeNodeActionsFor ||
          ""
        )
      );
      if (!node) {
        continue;
      }
      synchronizeApiCompositeInspectorLibraryActions(
        actions,
        node
      );
    }
  }

function refreshVisibleSavedApiCompositeUpdateActions() {
    if (!dom.paletteContent) {
      return;
    }
    const contexts =
      savedApiCompositeInstanceContexts();
    for (const actions of
      dom.paletteContent.querySelectorAll(
        "[data-saved-api-composite-actions-for]"
      )) {
      const record =
        savedApiCompositeTemplates.get(
          String(
            actions.dataset
              .savedApiCompositeActionsFor ||
            ""
          )
        );
      if (record) {
        synchronizeSavedApiCompositeUpdateAction(
          actions,
          record,
          contexts
        );
      }
    }
  }

  function refreshVisibleSavedApiCompositePaletteRows(
    rows,
    instanceContexts
  ) {
    if (!dom.paletteContent) return 0;
    const contexts =
      Array.isArray(instanceContexts)
        ? instanceContexts
        : savedApiCompositeInstanceContexts();
    const visibleRows = rows == null
      ? [
          ...dom.paletteContent.querySelectorAll(
            ".rml-saved-api-composite-row[data-saved-api-composite-row-for]"
          )
        ]
      : Array.from(rows);
    let refreshed = 0;
    for (const row of visibleRows) {
      const record =
        savedApiCompositeTemplates.get(
          String(
            row.dataset
              .savedApiCompositeRowFor ||
            ""
          )
        );
      if (!record) continue;
      const button = row.querySelector(
        ".rml-saved-api-composite-item"
      );
      const actions = row.querySelector(
        "[data-saved-api-composite-actions-for]"
      );
      const marker = button?.querySelector(
        "small"
      );
      if (!button || !actions || !marker) {
        row.replaceWith(
          createSavedApiCompositePaletteItem(
            record,
            contexts
          )
        );
        refreshed += 1;
        continue;
      }
      const compatibilityIssue =
        savedApiCompositeCompatibilityIssues.get(
          record.id
        ) || "";
      const libraryBusy =
        savedApiCompositeLibraryBusy();
      const currentOpen =
        currentOpenApiCompositeMatchesRecord(
          record
        );
      const insertionIssue =
        savedApiCompositeInsertionIssue(
          record
        );
      const available =
        apiCompositeCatalogAvailable() &&
        !libraryBusy &&
        !insertionIssue &&
        !savedApiCompositeOperations.has(
          record.id
        );
      button.classList.toggle(
        "compatibility-unavailable",
        Boolean(compatibilityIssue)
      );
      button.classList.toggle(
        "current-open",
        currentOpen
      );
      button.classList.toggle(
        "nested-cycle-unavailable",
        !currentOpen && Boolean(insertionIssue)
      );
      if (currentOpen) {
        row.dataset.currentOpenComposite =
          "true";
      } else {
        delete row.dataset
          .currentOpenComposite;
      }
      setGraphButtonAvailability(
        button,
        available,
        insertionIssue ||
        (!apiCompositeCatalogAvailable()
          ? window.RMLI18n.t("ui.literal.ca0541899f1b")
          : window.RMLI18n.t("ui.literal.09a0c2770ee7"))
      );
      if (!compatibilityIssue && !currentOpen && available) {
        marker.innerHTML = `<svg class="rml-inline-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-add"></use></svg>`;
      } else {
        marker.textContent = compatibilityIssue ? "!" : currentOpen ? window.RMLI18n.t("composite.library.status_open") : "·";
      }
      button.title = compatibilityIssue
        ? window.RMLI18n.format("composite.library.compatibility_retry", { issue: compatibilityIssue })
        : insertionIssue
          ? insertionIssue
          : !apiCompositeCatalogAvailable()
            ? window.RMLI18n.t("ui.literal.ca0541899f1b")
            : libraryBusy
              ? window.RMLI18n.t("ui.literal.2134dd966343")
              : window.RMLI18n.format(record.composite.nodes.length === 1 ? "composite.library.description.one" : "composite.library.description.other", { count: record.composite.nodes.length.toLocaleString(window.RMLI18n?.language || undefined) });
      synchronizeSavedApiCompositeUpdateAction(
        actions,
        record,
        contexts
      );
      refreshed += 1;
    }
    return refreshed;
  }

function savedApiCompositeLibraryBusy() {
    return savedApiCompositeOperations.size > 0;
  }

function savedApiCompositeUpdateActionState(
    record,
    contexts = null
  ) {
    const availableContexts =
      Array.isArray(contexts)
        ? contexts
        : savedApiCompositeInstanceContexts();
    const openContext =
      openApiCompositeOwnerContextForRecord(
        record
      );
    const staleInstances =
      matchingSavedApiCompositeInstances(
        record,
        null,
        {
          staleOnly: true,
          contexts: availableContexts
        }
      );
    const openContentChanged = Boolean(
      openContext &&
      !apiCompositeEditorContentUnchangedSinceOpen(
        openContext.editor
      )
    );
    const openCanonicalChanged = Boolean(
      openContext &&
      staleInstances.some(owner =>
        owner.id === openContext.ownerId
      )
    );
    const updatesOpenComposite = false;
    const matchingInstances =
      openContext
        ? staleInstances.filter(owner =>
            owner.id !== openContext.ownerId
          )
        : staleInstances;
    const comparisonPending =
      availableContexts.some(context => {
        if (
          !savedApiCompositeContextMatchesRecord(
            record,
            context
          )
        ) {
          return false;
        }
        return (
          savedApiCompositeInstanceComparisonStatus(
            record,
            context
          ) === "pending"
        );
      });
    return {
      matchingInstances,
      openContext,
      comparisonPending,
      updatesOpenComposite
    };
  }

async function runSavedApiCompositeUpdateAction(
    actions,
    expectedDirection = ""
  ) {
    if (savedApiCompositeLibraryBusy()) {
      throw new Error(
        window.RMLI18n.t("ui.literal.869cbf76be6d")
      );
    }
    const recordId = String(
      actions?.dataset
        ?.savedApiCompositeActionsFor ||
      ""
    );
    const record =
      savedApiCompositeTemplates.get(
        recordId
      );
    if (!record) {
      throw new Error(
        window.RMLI18n.t("ui.literal.7cb576f13e20")
      );
    }
    const state =
      savedApiCompositeUpdateActionState(
        record
      );
    if (state.comparisonPending) {
      synchronizeSavedApiCompositeUpdateAction(
        actions,
        record
      );
      throw new Error(
        window.RMLI18n.t("ui.literal.8065933d0a59")
      );
    }
    const direction =
      state.updatesOpenComposite &&
      state.openContext
        ? "graph-to-library"
        : "library-to-graph";
    if (
      expectedDirection &&
      expectedDirection !== direction
    ) {
      synchronizeSavedApiCompositeUpdateAction(
        actions,
        record
      );
      throw new Error(
        window.RMLI18n.t("ui.literal.b3215d0e6483")
      );
    }
    if (
      direction === "graph-to-library"
    ) {
      return saveApiCompositeNode(
        state.openContext.ownerId,
        {
          ownerPath:
            state.openContext.ownerPath,
          expectedSavedId: record.id
        }
      );
    }
    return applySavedApiCompositeVersion(
      record,
      { source: "library" }
    );
  }

function synchronizeSavedApiCompositeUpdateAction(
    actions,
    record,
    contexts = null
  ) {
    const {
      matchingInstances,
      updatesOpenComposite
    } = savedApiCompositeUpdateActionState(
      record,
      contexts
    );
    let updateGraphButton =
      actions.querySelector(
        "[data-saved-api-composite-graph-update]"
      );
    if (matchingInstances.length === 0) {
      updateGraphButton?.remove();
      return;
    }
    if (!updateGraphButton) {
      updateGraphButton =
        document.createElement("button");
      updateGraphButton.type = "button";
      updateGraphButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-update"></use></svg>`;
      updateGraphButton.dataset
        .savedApiCompositeGraphUpdate =
        "true";
      const stopUpdatePointer = event => {
        event.stopPropagation();
        event.stopImmediatePropagation();
      };
      updateGraphButton.addEventListener(
        "pointerdown",
        stopUpdatePointer
      );
      updateGraphButton.addEventListener(
        "pointerup",
        stopUpdatePointer
      );
      updateGraphButton.addEventListener(
        "click",
        async event => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (
            updateGraphButton.dataset
              .savedApiCompositeUpdatePending ===
                "true"
          ) {
            return;
          }
          updateGraphButton.dataset
            .savedApiCompositeUpdatePending =
            "true";
          updateGraphButton.disabled = true;
          try {
            await runSavedApiCompositeUpdateAction(
              actions,
              updateGraphButton.dataset
                .savedApiCompositeUpdateDirection ||
                ""
            );
          } catch (error) {
            showGraphMessage(
              error instanceof Error
                ? error.message
                : String(error),
              "error"
            );
          } finally {
            delete updateGraphButton.dataset
              .savedApiCompositeUpdatePending;
            const currentRecord =
              savedApiCompositeTemplates.get(
                String(record?.id || "")
              );
            if (
              currentRecord &&
              updateGraphButton.isConnected
            ) {
              synchronizeSavedApiCompositeUpdateAction(
                actions,
                currentRecord
              );
            }
          }
        }
      );
      actions.prepend(updateGraphButton);
    }
    updateGraphButton.dataset
      .savedApiCompositeUpdateDirection =
      updatesOpenComposite
        ? "graph-to-library"
        : "library-to-graph";
    updateGraphButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-update"></use></svg>`;
    updateGraphButton.setAttribute(
      "aria-label",
      updatesOpenComposite
        ? window.RMLI18n.format("composite.actions.update_from_open_graph", { name: record.name })
        : window.RMLI18n.format("composite.actions.replace_instances", { name: record.name })
    );
    setGraphButtonAvailability(
      updateGraphButton,
      apiCompositeCatalogAvailable() &&
        !savedApiCompositeLibraryBusy(),
      !apiCompositeCatalogAvailable()
        ? window.RMLI18n.t("ui.literal.ca0541899f1b")
        : window.RMLI18n.t("ui.literal.e25f5ee949a2")
    );
    updateGraphButton.title =
      updatesOpenComposite
        ? window.RMLI18n.format("composite.actions.update_saved_title", { name: record.name })
        : window.RMLI18n.format(matchingInstances.length === 1 ? "composite.actions.update_instances_title.one" : "composite.actions.update_instances_title.other", { count: matchingInstances.length.toLocaleString(window.RMLI18n?.language || undefined), name: record.name });
  }

function createSavedApiCompositePaletteItem(
    record,
    contexts = null
  ) {
    const operatorId =
      `${SAVED_API_COMPOSITE_PALETTE_PREFIX}${record.id}`;
    const definition = {
      title: record.name,
      symbol: "API",
      iconTone: "gold",
      description:
        window.RMLI18n.format(record.composite.nodes.length === 1 ? "composite.library.description.one" : "composite.library.description.other", { count: record.composite.nodes.length.toLocaleString(window.RMLI18n?.language || undefined) })
    };
    const row =
      document.createElement("div");
    row.className =
      "rml-saved-api-composite-row";
    row.dataset.savedApiCompositeRowFor =
      record.id;
    const button =
      document.createElement("button");
    const compatibilityIssue =
      savedApiCompositeCompatibilityIssues.get(
        record.id
      ) || "";
    const libraryBusy =
      savedApiCompositeLibraryBusy();
    const currentOpen =
      currentOpenApiCompositeMatchesRecord(
        record
      );
    const insertionIssue =
      savedApiCompositeInsertionIssue(
        record
      );
    button.className =
      "rml-graph-palette-item rml-saved-api-composite-item";
    if (compatibilityIssue) {
      button.classList.add(
        "compatibility-unavailable"
      );
    }
    if (currentOpen) {
      button.classList.add(
        "current-open"
      );
      row.dataset.currentOpenComposite =
        "true";
    } else if (insertionIssue) {
      button.classList.add(
        "nested-cycle-unavailable"
      );
    }
    button.type = "button";
    button.dataset.savedApiCompositeId =
      record.id;
    const savedCompositeAvailable =
      apiCompositeCatalogAvailable() &&
      !libraryBusy &&
      !insertionIssue &&
      !savedApiCompositeOperations.has(
        record.id
      );
    setGraphButtonAvailability(
      button,
      savedCompositeAvailable,
      insertionIssue ||
      (!apiCompositeCatalogAvailable()
        ? window.RMLI18n.t("ui.literal.ca0541899f1b")
        : window.RMLI18n.t("ui.literal.09a0c2770ee7"))
    );

    const icon =
      nodePaletteIconDescriptor(
        OPERATOR_DEFINITIONS[
          "container.apiComposite"
        ]
      );
    const symbol =
      document.createElement("span");
    symbol.textContent = icon.symbol;
    symbol.dataset.iconTone = icon.tone;
    symbol.dataset.rmlNodeIconColor =
      icon.color;
    const title =
      document.createElement("strong");
    title.textContent = record.name;
    const add =
      document.createElement("small");
    if (!compatibilityIssue && !currentOpen && savedCompositeAvailable) {
      add.innerHTML = `<svg class="rml-inline-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-add"></use></svg>`;
    } else {
      add.textContent = compatibilityIssue ? "!" : currentOpen ? window.RMLI18n.t("composite.library.status_open") : "·";
    }
    button.append(symbol, title, add);
    button.title = compatibilityIssue
      ? window.RMLI18n.format("composite.library.compatibility_retry", { issue: compatibilityIssue })
      : insertionIssue
        ? insertionIssue
      : !apiCompositeCatalogAvailable()
        ? window.RMLI18n.t("ui.literal.ca0541899f1b")
        : libraryBusy
          ? window.RMLI18n.t("ui.literal.2134dd966343")
          : definition.description;

    button.addEventListener(
      "click",
      event => {
        const suppressed = Boolean(
          paletteClickSuppression &&
          paletteClickSuppression
            .operatorId === operatorId
        );
        if (
          button.getAttribute(
            "aria-disabled"
          ) === "true" ||
          consumedPalettePointerSources.has(
            button
          ) ||
          suppressed ||
          performance.now() <
            paletteDragSuppressClickUntil
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        addPaletteNodeAtCenter(
          operatorId,
          false
        );
      }
    );
    button.addEventListener(
      "pointerdown",
      event =>
        beginPalettePointerDrag(
          event,
          operatorId,
          false,
          definition
        )
    );

    const actions =
      document.createElement("div");
    actions.className =
      "rml-saved-api-composite-actions";
    actions.dataset
      .savedApiCompositeActionsFor =
      record.id;
    const exportButton =
      document.createElement("button");
    exportButton.type = "button";
    exportButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-download"></use></svg>`;
    exportButton.title =
      window.RMLI18n.format("composite.actions.export_title", { name: record.name });
    exportButton.addEventListener(
      "pointerdown",
      event => event.stopPropagation()
    );
    exportButton.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        if (exportButton.disabled) {
          return;
        }
        exportButton.disabled = true;
        void downloadSavedApiCompositeRecords(
          [record],
          `${savedApiCompositeFileStem(
            record.name
          )}.rmlapicomposite.json.gz`
        ).then(
          compressed => {
            const reduction =
              compressed.jsonBytes > 0
                ? Math.max(
                    0,
                    Math.round(
                      (1 -
                        compressed.compressedBytes /
                          compressed.jsonBytes) *
                        100
                    )
                  )
                : 0;
            showGraphMessage(
              window.RMLI18n.format("composite.actions.export_success", { name: record.name, reduction: reduction > 0 ? window.RMLI18n.format("composite.actions.export_reduction", { percent: reduction }) : "" }),
              "success"
            );
          },
          error => {
            console.error(
              window.RMLI18n.t("ui.literal.b40a1d2117e4"),
              error
            );
            showGraphMessage(
              error instanceof Error
                ? error.message
                : window.RMLI18n.t("ui.auto.f75cb98f9853"),
              "error"
            );
          }
        ).finally(() => {
          exportButton.disabled = false;
        });
      }
    );
    const deleteButton =
      document.createElement("button");
    deleteButton.type = "button";
    deleteButton.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-close"></use></svg>`;
    deleteButton.title =
      window.RMLI18n.format("composite.actions.delete_title", { name: record.name });
    deleteButton.addEventListener(
      "pointerdown",
      event => event.stopPropagation()
    );
    deleteButton.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        void removeSavedApiComposite(
          record.id
        );
      }
    );
    actions.append(
      exportButton,
      deleteButton
    );
    synchronizeSavedApiCompositeUpdateAction(
      actions,
      record,
      contexts
    );

    const menuTrigger = document.createElement("button");
    menuTrigger.type = "button";
    menuTrigger.className = "rml-saved-api-composite-menu-trigger";
    menuTrigger.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="assets/rml-icons.svg?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll#icon-more"></use></svg>`;
    menuTrigger.setAttribute("aria-haspopup", "menu");
    menuTrigger.setAttribute("aria-expanded", "false");
    menuTrigger.setAttribute(
      "aria-label",
      window.RMLI18n.format("composite.actions.menu_aria", { name: record.name })
    );
    menuTrigger.title = window.RMLI18n.format("composite.actions.menu_title", { name: record.name });

    actions.setAttribute("role", "menu");
    actions.hidden = true;
    for (const actionButton of actions.querySelectorAll("button")) {
      actionButton.setAttribute("role", "menuitem");
    }

    const closeActions = ({ restoreFocus = false } = {}) => {
      if (actions.hidden) return;
      actions.hidden = true;
      row.classList.remove("actions-open");
      menuTrigger.setAttribute("aria-expanded", "false");
      if (restoreFocus && menuTrigger.isConnected) {
        menuTrigger.focus({ preventScroll: true });
      }
    };
    const openActions = () => {
      for (const openRow of document.querySelectorAll(
        ".rml-saved-api-composite-row.actions-open"
      )) {
        if (openRow === row) continue;
        openRow.querySelector(
          ".rml-saved-api-composite-actions"
        )?.setAttribute("hidden", "");
        openRow.classList.remove("actions-open");
        openRow.querySelector(
          ".rml-saved-api-composite-menu-trigger"
        )?.setAttribute("aria-expanded", "false");
      }
      actions.hidden = false;
      row.classList.add("actions-open");
      menuTrigger.setAttribute("aria-expanded", "true");
    };
    const toggleActions = () => {
      if (actions.hidden) openActions();
      else closeActions();
    };

    menuTrigger.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });
    menuTrigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggleActions();
    });
    row.addEventListener("contextmenu", event => {
      if (event.target.closest(".rml-saved-api-composite-actions")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      openActions();
      menuTrigger.focus({ preventScroll: true });
    });
    row.addEventListener("keydown", event => {
      if (event.key === "Escape" && !actions.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeActions({ restoreFocus: true });
      }
    });
    actions.addEventListener("click", event => {
      if (event.target.closest("button")) {
        queueMicrotask(() => closeActions());
      }
    });
    const armOutsideClose = () => {
      if (actions.hidden || !row.isConnected) return;
      document.addEventListener(
        "pointerdown",
        event => {
          if (actions.hidden || !row.isConnected) return;
          if (row.contains(event.target)) {
            queueMicrotask(armOutsideClose);
            return;
          }
          closeActions();
        },
        { capture: true, once: true }
      );
    };
    menuTrigger.addEventListener("click", () => {
      if (!actions.hidden) queueMicrotask(armOutsideClose);
    });
    row.addEventListener("contextmenu", () => {
      if (!actions.hidden) queueMicrotask(armOutsideClose);
    });

    row.append(button, menuTrigger, actions);
    return row;
  }

Object.defineProperty(
  window,
  "RMLNodeGraphCompositesModuleId",
  {
    value:
      "1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll",
    writable: false,
    enumerable: true,
    configurable: true
  }
);
