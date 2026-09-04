"use strict";

// Saved API Composite and composite-boundary behavior.

function apiCompositeStoredNodeSupported(
    node
  ) {
    if (
      node?.kind !== "operator" ||
      node.operatorId ===
        "container.apiComposite"
    ) {
      return false;
    }
    const definition =
      OPERATOR_DEFINITIONS[
        node.operatorId
      ];
    const contract =
      node.apiContract ||
      definition?.preservedApiContract;
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
    nodes
  ) {
    return (Array.isArray(nodes) ? nodes : [])
      .some(
        apiCompositeVerifiedCatalogNode
      );
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

const SAVED_API_COMPOSITE_LEGACY_FINGERPRINT =
    Symbol(
      "saved-api-composite-legacy-fingerprint"
    );

let savedApiCompositeDatabasePromise = null;

let savedApiCompositeLoadPromise = null;

const savedApiCompositeTemplates = new Map();

const savedApiCompositeOperations = new Set();

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

function savedApiCompositeNameKey(value) {
    return window.RMLCrypto.normalizeName(
      value
    );
  }

function savedApiCompositeNodeNameKeys(
    node,
    composite
  ) {
    return new Set(
      [
        node?.parameters?.title,
        node?.label,
        composite?.title
      ]
        .map(savedApiCompositeNameKey)
        .filter(Boolean)
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

function savedApiCompositeFingerprintHash(
    value
  ) {
    return window.RMLCrypto.fingerprint(
      "rml-api-composite-v1",
      value
    );
  }

function savedApiCompositeCanonicalGraphView(
    source
  ) {
    const graphView = source || {};
    const nodeIdMap = new Map(
      (graphView.nodes || []).map(
        (node, index) => [
          String(node?.id || ""),
          `node-${index}`
        ]
      )
    );
    const connectionIdMap = new Map();
    const pointIdMaps = new Map();
    for (const [index, connection] of
      (graphView.connections || []).entries()) {
      const connectionId = String(
        connection?.id || ""
      );
      connectionIdMap.set(
        connectionId,
        `connection-${index}`
      );
      pointIdMaps.set(
        connectionId,
        new Map(
          (connection?.points || []).map(
            (point, pointIndex) => [
              String(point?.id || ""),
              `point-${index}-${pointIndex}`
            ]
          )
        )
      );
    }
    const canonicalBranchReference =
      branch => {
        if (!branch) return null;
        const sourceConnectionId = String(
          branch.connectionId || ""
        );
        return {
          connectionId:
            connectionIdMap.get(
              sourceConnectionId
            ) || sourceConnectionId,
          pointId:
            pointIdMaps
              .get(sourceConnectionId)
              ?.get(
                String(branch.pointId || "")
              ) || String(branch.pointId || "")
        };
      };
    return {
      nodes: (graphView.nodes || []).map(
        (node, index) => ({
          ...nodeGraphClone(node),
          id: `node-${index}`
        })
      ),
      connections:
        (graphView.connections || []).map(
          (connection, index) => ({
            ...nodeGraphClone(connection),
            id: `connection-${index}`,
            fromNode:
              nodeIdMap.get(
                String(
                  connection?.fromNode || ""
                )
              ) || String(
                connection?.fromNode || ""
              ),
            toNode:
              nodeIdMap.get(
                String(
                  connection?.toNode || ""
                )
              ) || String(
                connection?.toNode || ""
              ),
            points:
              (connection?.points || []).map(
                (point, pointIndex) => ({
                  ...nodeGraphClone(point),
                  id:
                    `point-${index}-${pointIndex}`
                })
              ),
            branchFrom:
              canonicalBranchReference(
                connection?.branchFrom
              )
          })
        ),
      identities: {
        nodeIdMap,
        connectionIdMap,
        pointIdMaps
      }
    };
  }

function savedApiCompositeFingerprint(
    name,
    sourceComposite,
    portLayoutFallback = "standard"
  ) {
    const composite = sourceComposite || {};
    const canonical =
      savedApiCompositeCanonicalGraphView(
        composite
      );
    const {
      nodeIdMap,
      connectionIdMap,
      pointIdMaps
    } = canonical.identities;
    const customCSharpFiles = {};
    for (const [ownerId, customGraph] of
      Object.entries(
        composite.customCSharpFiles || {}
      )) {
      const canonicalOwnerId =
        nodeIdMap.get(String(ownerId)) ||
        String(ownerId);
      const canonicalCustomGraph =
        savedApiCompositeCanonicalGraphView(
          customGraph
        );
      const customNodeIds =
        canonicalCustomGraph.identities
          .nodeIdMap;
      delete canonicalCustomGraph.identities;
      const customContent = nodeGraphClone(
        customGraph || {}
      );
      for (const key of [
        "viewport",
        "selectedNodeId",
        "selectedNodeIds",
        "selectedConnectionId",
        "selectedWirePoint",
        "nextSequence",
        "catalogFingerprint",
        "catalogEngineVersion",
        "catalogSource",
        "catalogDefinitionRevision",
        "contentFingerprint"
      ]) {
        delete customContent[key];
      }
      customContent.outputNodeId =
        customNodeIds.get(
          String(
            customGraph?.outputNodeId || ""
          )
        ) || "";
      customContent.rootSyntaxNodeId =
        customNodeIds.get(
          String(
            customGraph?.rootSyntaxNodeId ||
            ""
          )
        ) || "";
      customContent.directSourceNodeId =
        customNodeIds.get(
          String(
            customGraph?.directSourceNodeId ||
            ""
          )
        ) || "";
      customContent.nodes =
        canonicalCustomGraph.nodes;
      customContent.connections =
        canonicalCustomGraph.connections;
      customCSharpFiles[canonicalOwnerId] =
        customContent;
    }
    const branchRouting = {};
    for (const [connectionId, branch] of
      Object.entries(
        composite.branchRouting || {}
      )) {
      const sourceParentId = String(
        branch?.connectionId || ""
      );
      branchRouting[
        connectionIdMap.get(connectionId) ||
        connectionId
      ] = {
        connectionId:
          connectionIdMap.get(
            sourceParentId
          ) || sourceParentId,
        pointId:
          pointIdMaps
            .get(sourceParentId)
            ?.get(
              String(branch?.pointId || "")
            ) || String(branch?.pointId || "")
      };
    }
    const value = {
      name: savedApiCompositeNameKey(name),
      portLayout:
        composite.portLayout === "mirrored" ||
        composite.portLayout === "standard"
          ? composite.portLayout
          : portLayoutFallback === "mirrored"
            ? "mirrored"
            : "standard",
      boundaryPorts:
        apiCompositeBoundaryRecords(
          composite.boundaryPorts
        ).map(boundary => ({
          ...nodeGraphClone(boundary),
          internalNodeId:
            nodeIdMap.get(
              String(
                boundary.internalNodeId || ""
              )
            ) || String(
              boundary.internalNodeId || ""
            )
        })),
      branchRouting,
      customCSharpFiles,
      nodes: canonical.nodes,
      connections:
        canonical.connections
    };
    return savedApiCompositeFingerprintHash(
      JSON.stringify(
        savedApiCompositeCanonicalValue(value)
      )
    );
  }

function savedApiCompositeContentKey(
    record
  ) {
    return String(
      record?.contentFingerprint ||
      savedApiCompositeFingerprint(
        record?.name || "",
        record?.composite || {},
        "standard"
      )
    );
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

function sanitizeSavedApiCompositeRecord(
    raw,
    {
      preserveId = true,
      fallbackName = "Saved API Composite"
    } = {}
  ) {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      throw new TypeError(
        "A saved API Composite must be a JSON object."
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
        "The saved API Composite has no complete internal node graph."
      );
    }
    if (
      source.nodes.length < 2 ||
      source.nodes.length >
        SAVED_API_COMPOSITE_MAX_NODES
    ) {
      throw new Error(
        `A saved API Composite must contain between 2 and ${SAVED_API_COMPOSITE_MAX_NODES.toLocaleString("de-DE")} compatible internal nodes.`
      );
    }
    if (
      source.connections.length >
        SAVED_API_COMPOSITE_MAX_CONNECTIONS
    ) {
      throw new Error(
        `A saved API Composite cannot contain more than ${SAVED_API_COMPOSITE_MAX_CONNECTIONS.toLocaleString("de-DE")} connections.`
      );
    }

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
        customCSharpFiles: nodeGraphClone(
          source.customCSharpFiles || {}
        ),
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
        "The saved API Composite was rejected because its internal ownership or boundary mapping is invalid."
      );
    }
    const boundaries =
      apiCompositeBoundaryRecords(
        composite.boundaryPorts
      );
    if (
      composite.nodes.length !==
        source.nodes.length ||
      composite.connections.length !==
        source.connections.length ||
      boundaries.length !==
        sourceBoundaries.length ||
      Object.keys(
        composite.customCSharpFiles || {}
      ).length !==
        Object.keys(
          source.customCSharpFiles || {}
        ).length
    ) {
      throw new Error(
        "The saved API Composite contains invalid, duplicate or unsupported nodes, connections or boundary ports. Nothing was imported."
      );
    }
    for (const node of composite.nodes) {
      if (!apiCompositeStoredNodeSupported(node)) {
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
    const contentFingerprint =
      savedApiCompositeFingerprint(
        title,
        result.composite,
        "standard"
      );
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
              "The Saved API Composite database could not be opened."
            )
          );
        request.onblocked = () =>
          reject(
            new Error(
              "The Saved API Composite database is blocked by another Builder tab."
            )
          );
      }).catch(error => {
        console.warn(
          "Saved API Composite persistence is unavailable.",
          error
        );
        return null;
      });
    return savedApiCompositeDatabasePromise;
  }

function savedApiCompositeTransaction(
    database,
    mode,
    operation
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
      try {
        result = operation(store);
      } catch (error) {
        transaction.abort();
        reject(error);
        return;
      }
      transaction.oncomplete = () =>
        resolve(result);
      transaction.onerror = () =>
        reject(
          transaction.error ||
          new Error(
            "The Saved API Composite transaction failed."
          )
        );
      transaction.onabort = () =>
        reject(
          transaction.error ||
          new Error(
            "The Saved API Composite transaction was cancelled."
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
                "An invalid Saved API Composite was ignored.",
                error
              );
            }
          }
          return [
            ...savedApiCompositeTemplates.values()
          ];
        })
        .catch(error => {
          console.warn(
            "Saved API Composites could not be restored.",
            error
          );
          return [];
        });
    return savedApiCompositeLoadPromise;
  }

async function persistSavedApiCompositeRecords(
    records
  ) {
    const normalized = records.map(record =>
      sanitizeSavedApiCompositeRecord(record)
    );
    const database =
      await savedApiCompositeDatabase();
    if (!database) {
      throw new Error(
        "Persistent browser storage is unavailable. Export the Composite JSON instead; no session-only save was created."
      );
    }
    await savedApiCompositeTransaction(
      database,
      "readwrite",
      store => {
        for (const record of normalized) {
          store.put(nodeGraphClone(record));
        }
      }
    );
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
  }

async function applySavedApiCompositeReconciliation(
    updates,
    deletionIds
  ) {
    const normalizedUpdates =
      updates.map(record =>
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
    if (
      normalizedUpdates.length === 0 &&
      normalizedDeletionIds.length === 0
    ) {
      return {
        updates: [],
        deletionIds: []
      };
    }
    const database =
      await savedApiCompositeDatabase();
    if (!database) {
      throw new Error(
        "Persistent browser storage is unavailable. Saved API Composite catalog reconciliation was not committed."
      );
    }
    await savedApiCompositeTransaction(
      database,
      "readwrite",
      store => {
        for (const record of
          normalizedUpdates) {
          store.put(nodeGraphClone(record));
        }
        for (const id of
          normalizedDeletionIds) {
          store.delete(id);
        }
      }
    );
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
  }

async function deleteSavedApiCompositeRecord(
    templateId
  ) {
    const id = String(
      templateId || ""
    );
    const database =
      await savedApiCompositeDatabase();
    if (!database) {
      throw new Error(
        "Persistent browser storage is unavailable."
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
        customCSharpFiles: nodeGraphClone(
          composite.customCSharpFiles || {}
        ),
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
      allowFingerprintShortcut = true
    } = {}
  ) {
    const record =
      sanitizeSavedApiCompositeRecord(
        sourceRecord
      );
    if (!apiCompositeCatalogAvailable()) {
      throw new Error(
        "A verified live or synchronized cached API catalog is required."
      );
    }
    const identity =
      currentApiCompositeCatalogIdentity();
    let resolved = record;
    let changed = false;
    if (
      !savedApiCompositeMatchesCurrentCatalog(
        record,
        { allowFingerprintShortcut }
      )
    ) {
      const resolver =
        window.RMLSavedApiCompositeResolver
          ?.resolveGraph;
      if (typeof resolver !== "function") {
        throw new Error(
          "The catalog replacement resolver for Saved API Composites is unavailable."
        );
      }
      const validation =
        savedApiCompositeValidationGraph(
          record
        );
      const resolvedGraph =
        await resolver(
          validation.graph,
          {
            name: record.name
          }
        );
      const resolvedComposite =
        resolvedGraph
          ?.apiCompositeGraphs?.[
            validation.ownerId
          ];
      if (!resolvedComposite) {
        throw new Error(
          "Catalog resolution returned no complete Saved API Composite."
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
              identity.fingerprint,
            createdEngineVersion:
              identity.engineVersion
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
          identity.engineVersion,
        composite: {
          ...record.composite,
          createdCatalogFingerprint:
            identity.fingerprint,
          createdEngineVersion:
            identity.engineVersion
        }
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
        ]);
      resolved = stored;
    }
    return resolved;
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
    const ownerId =
      apiCompositeEditor.containerNodeId;
    const composite =
      graph.apiCompositeGraphs?.[ownerId];
    if (composite) {
      composite.boundaryPorts =
        nodeGraphClone(boundaries);
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
  }

function exposeApiCompositeNodePorts(
    nodeId
  ) {
    if (!apiCompositeEditor) return false;
    const ownerId =
      apiCompositeEditor.containerNodeId;
    const composite =
      graph.apiCompositeGraphs?.[ownerId];
    if (!composite) return false;
    const result =
      synchronizeApiCompositeBoundaries(
        composite.boundaryPorts,
        [nodeId]
      );
    applyApiCompositeBoundaries(
      result.boundaries
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
    persistGraph(true);
    showGraphMessage(
      result.added > 0
        ? `${result.added.toLocaleString("de-DE")} unconnected port${result.added === 1 ? " was" : "s were"} exposed on the outer API Composite.`
        : "This node has no additional unconnected ports to expose.",
      result.added > 0
        ? "success"
        : ""
    );
    return result.added > 0;
  }

function apiCompositeNodeHasExposablePorts(
    nodeId
  ) {
    if (!apiCompositeEditor) return false;
    const ownerId =
      apiCompositeEditor.containerNodeId;
    const composite =
      graph.apiCompositeGraphs?.[ownerId];
    const node = findGraphNode(nodeId);
    const definition = node
      ? nodeDefinition(node)
      : null;
    if (
      !composite ||
      !node ||
      !apiCompositeInternalDefinitionAllowed(
        definition
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
          !apiCompositePortHasInternalWire(
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
      customCSharpEditor ||
      apiCompositeEditor ||
      !apiCompositeCatalogAvailable()
    ) {
      return false;
    }
    const owner =
      findGraphNode(containerNodeId);
    const definition = owner
      ? nodeDefinition(owner)
      : null;
    const composite =
      graph.apiCompositeGraphs?.[
        containerNodeId
      ];
    if (
      definition?.apiCompositeContainer !==
        true ||
      !composite
    ) {
      return false;
    }
    graph.customCSharpFiles =
      mergeCustomCSharpFileRegistry(
        mergeCustomCSharpFileRegistry(
          {},
          composite.customCSharpFiles
        ),
        graph.customCSharpFiles
      );
    const previousPresentation =
      closeEmbeddedEditorForGraphReplacement();

    apiCompositeEditor = {
      containerNodeId,
      title: String(
        owner.parameters?.title ||
        owner.label ||
        "API Composite"
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
      previousPresentation,
      mainView: graphViewFrom(graph)
    };
    applyGraphView(
      graphViewFrom(composite)
    );
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    activateGraphMode();
    requestProjectAnimationFrame(() => {
      centerGraph();
    });
    showGraphMessage(
      `Opened ${apiCompositeEditor.title}.`,
      "success"
    );
    return true;
  }

function closeApiCompositeGraph({
    restorePreviousPresentation = true
  } = {}) {
    if (!apiCompositeEditor || !graph) {
      return false;
    }
    const emptyComposite =
      graph.nodes.length === 0;
    if (
      !emptyComposite &&
      !apiCompositeHasVerifiedCatalogNode(
        graph.nodes
      )
    ) {
      showGraphMessage(
        "The internal API & Logic Graph must keep at least one verified catalog API node before it can be closed.",
        "error"
      );
      return false;
    }
    closeEmbeddedEditorForGraphReplacement();
    const title = apiCompositeEditor.title;
    const previousPresentation =
      apiCompositeEditor.previousPresentation ||
      null;
    captureApiCompositeEditorView();
    const boundaryUpdate = {
      ...(apiCompositeEditor.boundaryUpdate || {
        added: 0,
        removed: 0
      })
    };
    const mainView =
      apiCompositeEditor.mainView;
    apiCompositeEditor = null;
    applyGraphView(mainView);
    graphNodeDefinitionCache =
      new WeakMap();
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    activateGraphMode();
    showGraphMessage(
      emptyComposite
        ? `Returned from ${title} to the previous graph. The empty Composite remains editable, but it cannot be saved or exported until it contains a verified catalog API node again.`
        : `Returned from ${title} to the previous graph.${boundaryUpdate.added > 0 ? ` ${boundaryUpdate.added.toLocaleString("de-DE")} new outer port${boundaryUpdate.added === 1 ? " was" : "s were"} added automatically.` : ""}${boundaryUpdate.removed > 0 ? ` ${boundaryUpdate.removed.toLocaleString("de-DE")} unused automatic port${boundaryUpdate.removed === 1 ? " was" : "s were"} removed.` : ""}`,
      emptyComposite
        ? "warning"
        : "success"
    );
    if (restorePreviousPresentation) {
      restorePreviousEmbeddedEditor(
        previousPresentation
      );
    }
    return true;
  }

function createApiCompositeFromSelection() {
    if (
      !graph ||
      customCSharpEditor ||
      apiCompositeEditor
    ) {
      showGraphMessage(
        "API Composites can be created only in the main Runtime Graph.",
        "error"
      );
      return false;
    }
    if (!apiCompositeCatalogAvailable()) {
      showGraphMessage(
        "A verified live or cached API catalog is required before an API Composite can be created.",
        "error"
      );
      return false;
    }

    const selectedIds = new Set(
      Array.isArray(graph.selectedNodeIds)
        ? graph.selectedNodeIds
        : graph.selectedNodeId
          ? [graph.selectedNodeId]
          : []
    );
    const selectedNodes = graph.nodes
      .filter(node =>
        selectedIds.has(node.id)
      );
    if (selectedNodes.length < 2) {
      showGraphMessage(
        "Select at least two compatible nodes with Ctrl/Command-click; at least one must be a verified catalog API node.",
        "error"
      );
      return false;
    }
    const invalid = selectedNodes.find(node => {
      const definition = nodeDefinition(node);
      return !(
        node.kind === "operator" &&
        apiCompositeInternalDefinitionAllowed(
          definition
        ) &&
        definition?.unavailableApiContract !==
          true &&
        (
          definition?.catalogGenerated !==
            true ||
          portableApiContractForNode(node)
        )
      );
    });
    if (invalid) {
      showGraphMessage(
        "API Composites accept verified catalog API nodes and supported logic/value/flow nodes only.",
        "error"
      );
      return false;
    }
    if (
      !apiCompositeHasVerifiedCatalogNode(
        selectedNodes
      )
    ) {
      showGraphMessage(
        "An API Composite must contain at least one verified catalog API node.",
        "error"
      );
      return false;
    }
    const selectionAnalysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );
    if (!selectionAnalysis.valid) {
      showGraphMessage(
        selectionAnalysis.reason ||
        "The current Runtime Graph is not type-safe and cannot be combined.",
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
        graph.connections) {
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
    const title = `API Composite · ${selectedNodes.length.toLocaleString("de-DE")} Nodes`;
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
          graph.customCSharpFiles
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
        graph.nextSequence
      )
    };
    const candidate = {
      ...graph,
      apiCompositeGraphs: {
        ...(graph.apiCompositeGraphs || {}),
        [containerId]: composite
      },
      nodes: [
        ...graph.nodes.filter(node =>
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
          "The selected API and logic nodes do not form a type-safe composite."
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

    graph.apiCompositeGraphs =
      candidate.apiCompositeGraphs;
    applyGraphView(
      graphViewFrom(candidate)
    );
    graphNodeDefinitionCache =
      new WeakMap();
    currentAnalysis = null;
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    renderGraphPalette();
    showGraphMessage(
      `${selectedNodes.length.toLocaleString("de-DE")} API and logic nodes combined. Unconnected ports of newly added internal nodes are exposed automatically.`,
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
        connection => nodeGraphClone(connection)
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
      ...composite.nodes.map(node =>
        nodeGraphClone(node)
      )
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
        "The API Composite cannot be unpacked into a valid Runtime Graph. Nothing was changed."
      );
    }
    graph.nodes = unpackedNodes;
    graph.connections = connections;
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
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    showGraphMessage(
      `API Composite unpacked. ${composite.nodes.length.toLocaleString("de-DE")} node positions and all stored wire routes were restored.`,
      "success"
    );
    return true;
  }

function savedApiCompositeRecordFromNode(
    containerNodeId,
    {
      templateId = "",
      createdAt = ""
    } = {}
  ) {
    const owner =
      findGraphNode(containerNodeId);
    const composite =
      graph.apiCompositeGraphs?.[
        containerNodeId
      ];
    if (
      !owner ||
      owner.operatorId !==
        "container.apiComposite" ||
      !composite
    ) {
      throw new Error(
        "Select a complete API Composite before saving or exporting it."
      );
    }
    composite.customCSharpFiles =
      customCSharpFilesForNodes(
        composite.nodes,
        graph.customCSharpFiles
      );
    const identity =
      currentApiCompositeCatalogIdentity();
    const name = String(
      owner.label ||
      owner.parameters?.title ||
      composite.title ||
      "Saved API Composite"
    ).trim().slice(0, 120) ||
      "Saved API Composite";
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
        ...nodeGraphClone(composite),
        title: name,
        portLayout:
          owner.parameters?.portLayout ===
            "mirrored"
            ? "mirrored"
            : "standard",
        createdCatalogFingerprint:
          identity.fingerprint,
        createdEngineVersion:
          identity.engineVersion
      }
    });
  }

async function saveApiCompositeNode(
    containerNodeId,
    {
      asNew = false
    } = {}
  ) {
    if (!apiCompositeCatalogAvailable()) {
      throw new Error(
        "A verified live or synchronized cached API catalog is required before an API Composite can be saved."
      );
    }
    const owner =
      findGraphNode(containerNodeId);
    if (!owner) {
      throw new Error(
        "The selected API Composite no longer exists."
      );
    }
    const linkedId = String(
      owner.parameters
        ?.savedApiCompositeId || ""
    );
    const existing =
      !asNew && linkedId
        ? savedApiCompositeTemplates.get(
            linkedId
          )
        : null;
    const record =
      savedApiCompositeRecordFromNode(
        containerNodeId,
        {
          templateId:
            existing?.id || "",
          createdAt:
            existing?.createdAt || ""
        }
      );
    const [stored] =
      await persistSavedApiCompositeRecords([
        record
      ]);
    owner.parameters =
      owner.parameters &&
      typeof owner.parameters === "object"
        ? owner.parameters
        : {};
    owner.parameters.savedApiCompositeId =
      stored.id;
    owner.parameters.savedApiCompositeUpdatedAt =
      stored.updatedAt;
    owner.parameters.apiCompositeFingerprint =
      stored.contentFingerprint;
    const ownedComposite =
      graph.apiCompositeGraphs?.[
        containerNodeId
      ];
    if (ownedComposite) {
      ownedComposite.contentFingerprint =
        stored.contentFingerprint;
      ownedComposite.fingerprintNameKey =
        savedApiCompositeNameKey(
          stored.name
        );
      ownedComposite.fingerprintPortLayout =
        owner.parameters.portLayout ===
          "mirrored"
          ? "mirrored"
          : "standard";
    }
    persistGraph(true);
    renderGraphPalette();
    renderGraphInspector();
    showGraphMessage(
      existing
        ? `Saved API Composite '${stored.name}' updated.`
        : `Saved API Composite '${stored.name}' added to the node library.`,
      "success"
    );
    return stored;
  }

function savedApiCompositeExportPayload(
    records
  ) {
    const normalized = records.map(record =>
      sanitizeSavedApiCompositeRecord(record)
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
        "The compressed JSON file codec is unavailable."
      );
    }
    const compressed =
      await codec.compress(payload);
    const download =
      window.RMLFileDownload?.blob;
    if (typeof download !== "function") {
      throw new Error(
        "The safe file download handler is unavailable."
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
        "This file is not an RML Saved API Composite JSON document."
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
        `A Saved API Composite JSON must contain between 1 and ${SAVED_API_COMPOSITE_MAX_IMPORT_COUNT.toLocaleString("de-DE")} templates.`
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
      const record =
        sanitizeSavedApiCompositeRecord(
          source,
          { preserveId: true }
        );
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
        "The imported Saved API Composite collection exceeds the safe aggregate node or connection limit."
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
            ? "Saved API Composite catalog update"
            : legacyFingerprint
              ? "Legacy Composite fingerprint"
            : matchedByName
              ? "Exact Composite name matched"
            : "Saved API Composite update",
        title:
          `Update '${existing.name}'?`,
        message:
          source === "catalog"
            ? "The verified catalog requires a real content change in this individual Composite. Its saved library template is updated only after your confirmation. Other saved Composites are checked independently."
            : legacyFingerprint
              ? "This imported Composite has no stored content fingerprint. Its normalized name matches an existing Composite, so it must be offered once as an update. Accepting writes the generated fingerprint into the saved template and matching graph instances."
            : matchedByName
              ? "The imported Composite has a different persistent identity, but its normalized name exactly matches one existing Saved Composite. Update that existing template instead of creating a duplicate?"
            : "The imported Composite has the same persistent identity, but its saved content changed. The existing library template is updated only after your confirmation.",
        details:
          `Existing: ${existing.composite.nodes.length.toLocaleString("de-DE")} nodes and ${existing.composite.connections.length.toLocaleString("de-DE")} connections. Imported: ${incoming.composite.nodes.length.toLocaleString("de-DE")} nodes and ${incoming.composite.connections.length.toLocaleString("de-DE")} connections.${matchedByName ? ` Existing identity: ${existing.id}. Imported identity: ${incoming.id}.` : ""}${legacyFingerprint ? ` Generated fingerprint: ${incoming.contentFingerprint}.` : ""}${duplicateCount > 0 ? ` ${duplicateCount.toLocaleString("de-DE")} duplicate Saved Composite entr${duplicateCount === 1 ? "y" : "ies"} with this exact normalized name will be consolidated into the retained identity.` : ""} After the library update, matching placed graph instances are offered for replacement separately.`,
        confirmLabel:
          "Update Composite",
        cancelLabel:
          source === "catalog"
            ? "Keep Unavailable"
            : "Discard Imported Change"
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
          "The current catalog could not verify this Saved API Composite."
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
          "Incompatible Saved API Composite",
        title:
          `Delete '${record.name}'?`,
        message:
          "This individual Composite could not be made compatible with the current verified catalog. Deletion affects only the saved library template; existing graph instances remain unchanged.",
        details:
          reason.slice(0, 800),
        confirmLabel:
          "Delete Saved Composite",
        cancelLabel:
          "Keep Unavailable"
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
                false
            }
          );
        const contentChanged =
          savedApiCompositeContentKey(
            existing
          ) !==
          savedApiCompositeContentKey(
            resolved
          );
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
              "A compatible catalog replacement was found, but its library-template update was not confirmed."
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
      deletionIds
    );
    renderGraphPalette();
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
        `Saved API Composites checked individually: ${summary.verified.toLocaleString("de-DE")} unchanged, ${summary.refreshed.toLocaleString("de-DE")} catalog-refreshed, ${summary.updated.toLocaleString("de-DE")} updated, ${summary.unavailable.toLocaleString("de-DE")} unavailable and ${summary.deleted.toLocaleString("de-DE")} deleted.`,
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
      savedApiCompositeOperations.has(
        "import"
      ) ||
      savedApiCompositeOperations.has(
        "open-graph-catalog-reconciliation"
      ) ||
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
            "Saved API Composite catalog reconciliation failed without changing unrelated templates.",
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
          renderGraphPalette();
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
    if (!apiCompositeCatalogAvailable()) {
      throw new Error(
        "A verified live or synchronized cached API catalog is required before Saved API Composites can be imported."
      );
    }
    if (
      savedApiCompositeOperations.has(
        "import"
      )
    ) {
      throw new Error(
        "A Saved API Composite import is already in progress."
      );
    }
    if (openGraphCatalogReconciliationPromise) {
      await openGraphCatalogReconciliationPromise;
    }
    if (savedApiCompositeReconciliationPromise) {
      await savedApiCompositeReconciliationPromise;
    }
    if (
      savedApiCompositeOperations.has(
        "catalog-reconciliation"
      ) ||
      savedApiCompositeOperations.has(
        "open-graph-catalog-reconciliation"
      )
    ) {
      throw new Error(
        "Saved API Composites or placed Runtime Graph instances are currently being checked against the updated catalog. Retry the import after this catalog reconciliation has completed."
      );
    }
    savedApiCompositeOperations.add(
      "import"
    );
    renderGraphPalette();
    try {
      await loadSavedApiCompositeLibrary();
      const records =
        savedApiCompositeRecordsFromJson(
          payload
        );
      const resolved = [];
      for (const record of records) {
        const resolvedRecord =
          await resolveSavedApiCompositeForCurrentCatalog(
            record,
            {
              allowFingerprintShortcut:
                false
            }
          );
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
      }
      const knownById = new Map(
        savedApiCompositeTemplates
      );
      const knownByContent = new Map();
      for (const existing of
        savedApiCompositeTemplates.values()) {
        const contentKey =
          savedApiCompositeContentKey(
            existing
          );
        if (!knownByContent.has(contentKey)) {
          knownByContent.set(
            contentKey,
            existing
          );
        }
      }
      const pending = [];
      const deletionIds = new Set();
      const instanceUpdatePlans = [];
      const summary = {
        added: 0,
        updated: 0,
        unchanged: 0,
        discarded: 0,
        graphOnly: 0,
        duplicatesConsolidated: 0
      };
      for (const incoming of resolved) {
        const legacyFingerprint =
          incoming[
            SAVED_API_COMPOSITE_LEGACY_FINGERPRINT
          ] === true;
        const contentKey =
          savedApiCompositeContentKey(
            incoming
          );
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
          const contentMatch =
            knownByContent.get(
              contentKey
            ) || null;
          if (
            contentMatch &&
            !legacyFingerprint
          ) {
            summary.unchanged += 1;
            if (graphInstanceIds.length > 0) {
              instanceUpdatePlans.push({
                record: contentMatch,
                instanceIds:
                  graphInstanceIds,
                linkToSaved: true
              });
            }
            continue;
          }
        }
        if (!existing) {
          if (graphInstanceIds.length > 0) {
            summary.graphOnly += 1;
            instanceUpdatePlans.push({
              record: incoming,
              instanceIds:
                graphInstanceIds,
              linkToSaved: false
            });
            continue;
          }
          pending.push(incoming);
          knownById.set(
            incoming.id,
            incoming
          );
          knownByContent.set(
            contentKey,
            incoming
          );
          summary.added += 1;
          continue;
        }

        const existingContentKey =
          savedApiCompositeContentKey(
            existing
          );
        if (
          !legacyFingerprint &&
          existingContentKey ===
            contentKey &&
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
          const duplicateContentKey =
            savedApiCompositeContentKey(
              duplicate
            );
          if (
            knownByContent.get(
              duplicateContentKey
            )?.id === duplicate.id
          ) {
            knownByContent.delete(
              duplicateContentKey
            );
          }
        }
        knownById.set(updated.id, updated);
        if (
          knownByContent.get(
            existingContentKey
          )?.id === existing.id
        ) {
          knownByContent.delete(
            existingContentKey
          );
        }
        knownByContent.set(
          savedApiCompositeContentKey(
            updated
          ),
          updated
        );
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
          ? await applySavedApiCompositeReconciliation(
              pending,
              [...deletionIds]
            )
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
        if (
          matchingSavedApiCompositeInstances(
            record,
            plan.instanceIds,
            { staleOnly: true }
          ).length === 0
        ) {
          continue;
        }
        try {
          const replacement =
            await applySavedApiCompositeVersion(
              record,
              {
                source: "import",
                instanceIds:
                  plan.instanceIds,
                linkToSaved:
                  plan.linkToSaved
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
        `Saved API Composite import completed: ${summary.added.toLocaleString("de-DE")} new, ${summary.updated.toLocaleString("de-DE")} updated, ${summary.unchanged.toLocaleString("de-DE")} unchanged and ${summary.discarded.toLocaleString("de-DE")} discarded.${summary.graphOnly > 0 ? ` ${summary.graphOnly.toLocaleString("de-DE")} import${summary.graphOnly === 1 ? " was" : "s were"} graph-only and did not create a Saved Composite.` : ""}${summary.duplicatesConsolidated > 0 ? ` ${summary.duplicatesConsolidated.toLocaleString("de-DE")} duplicate Saved Composite entr${summary.duplicatesConsolidated === 1 ? "y was" : "ies were"} consolidated.` : ""}${summary.instancesReplaced > 0 ? ` ${summary.instancesReplaced.toLocaleString("de-DE")} placed instance${summary.instancesReplaced === 1 ? " was" : "s were"} replaced.${summary.instancesLinkedByName > 0 ? ` ${summary.instancesLinkedByName.toLocaleString("de-DE")} matched by exact normalized name and received the imported fingerprint.` : ""}` : ""}${summary.instanceUpdateErrors > 0 ? ` ${summary.instanceUpdateErrors.toLocaleString("de-DE")} graph replacement${summary.instanceUpdateErrors === 1 ? " failed" : "s failed"} without changing those instances.` : ""}`,
        summary.instanceUpdateErrors > 0
          ? "warning"
          : "success"
      );
      return stored;
    } finally {
      savedApiCompositeOperations.delete(
        "import"
      );
      renderGraphPalette();
      void scheduleSavedApiCompositeCatalogReconciliation();
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

function remapSavedCompositeCustomCSharpGraph(
    source,
    identities
  ) {
    const customGraph = nodeGraphClone(
      source || {}
    );
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
      (customGraph.nodes || []).map(
        node => ({
          ...node,
          id: nodeIdMap.get(node.id)
        })
      );
    customGraph.connections =
      (customGraph.connections || []).map(
        connection => ({
          ...connection,
          id: connectionIdMap.get(
            connection.id
          ),
          fromNode: nodeIdMap.get(
            connection.fromNode
          ),
          toNode: nodeIdMap.get(
            connection.toNode
          ),
          points: (connection.points || [])
            .map(point => ({
              ...point,
              id: pointIdMaps
                .get(connection.id)
                ?.get(point.id)
            })),
          branchFrom:
            connection.branchFrom
              ? {
                  connectionId:
                    connectionIdMap.get(
                      connection.branchFrom
                        .connectionId
                    ) || "",
                  pointId:
                    pointIdMaps
                      .get(
                        connection.branchFrom
                          .connectionId
                      )
                      ?.get(
                        connection.branchFrom
                          .pointId
                      ) || ""
                }
              : null
        })
      );
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
      customGraph.selectedWirePoint;
    customGraph.selectedWirePoint =
      selectedWirePoint &&
      connectionIdMap.has(
        selectedWirePoint.connectionId
      )
        ? {
            connectionId:
              connectionIdMap.get(
                selectedWirePoint.connectionId
              ),
            pointId:
              pointIdMaps
                .get(
                  selectedWirePoint.connectionId
                )
                ?.get(
                  selectedWirePoint.pointId
                ) || ""
          }
        : null;
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

function remapSavedApiCompositeInstance(
    record,
    containerId,
    x,
    y
  ) {
    const identities =
      graphIdentitySetsForSavedComposite();
    identities.nodeIds.add(containerId);
    const nodeIdMap = new Map();
    for (const node of
      record.composite.nodes) {
      nodeIdMap.set(
        node.id,
        uniqueSavedCompositeGraphId(
          "graph-node",
          identities.nodeIds
        )
      );
    }
    const connectionIdMap = new Map();
    const pointIdMaps = new Map();
    for (const connection of
      record.composite.connections) {
      connectionIdMap.set(
        connection.id,
        uniqueSavedCompositeGraphId(
          "connection",
          identities.connectionIds
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
    }
    const nodes =
      record.composite.nodes.map(node => ({
        ...nodeGraphClone(node),
        id: nodeIdMap.get(node.id)
      }));
    const connections =
      record.composite.connections.map(
        source => {
          const copy = nodeGraphClone(source);
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
            (source.points || []).map(
              point => ({
                ...nodeGraphClone(point),
                id: pointIdMaps
                  .get(source.id)
                  .get(point.id)
              })
            );
          if (source.branchFrom) {
            copy.branchFrom = {
              connectionId:
                connectionIdMap.get(
                  source.branchFrom
                    .connectionId
                ),
              pointId:
                pointIdMaps
                  .get(
                    source.branchFrom
                      .connectionId
                  )
                  ?.get(
                    source.branchFrom
                      .pointId
                  ) || ""
            };
          }
          return copy;
        }
      );
    const boundaries =
      apiCompositeBoundaryRecords(
        record.composite.boundaryPorts
      ).map(boundary => ({
        ...boundary,
        internalNodeId:
          nodeIdMap.get(
            boundary.internalNodeId
          )
      }));
    const branchRouting = {};
    for (const [connectionId, branch] of
      Object.entries(
        record.composite.branchRouting || {}
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
          connectionId:
            parentConnectionId,
          pointId
        };
      }
    }
    const customCSharpFiles = {};
    for (const [ownerId, customGraph] of
      Object.entries(
        record.composite
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
          identities
        );
    }
    const position = findOpenNodePosition(
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
        memberCount: nodes.length,
        boundaryPorts:
          nodeGraphClone(boundaries),
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
    const composite = {
      version: 1,
      title: record.name,
      contentFingerprint:
        record.contentFingerprint,
      fingerprintNameKey:
        savedApiCompositeNameKey(
          record.name
        ),
      fingerprintPortLayout:
        record.composite.portLayout ===
          "mirrored"
          ? "mirrored"
          : "standard",
      createdCatalogFingerprint:
        record.resolvedCatalogFingerprint,
      createdEngineVersion:
        record.resolvedEngineVersion,
      boundaryPorts: boundaries,
      branchRouting,
      customCSharpFiles,
      nodes,
      connections,
      viewport: nodeGraphClone(
        record.composite.viewport
      ),
      selectedNodeId:
        nodeIdMap.get(
          record.composite.selectedNodeId
        ) || nodes[0]?.id || null,
      selectedNodeIds:
        (record.composite.selectedNodeIds || [])
          .map(id => nodeIdMap.get(id))
          .filter(Boolean),
      selectedConnectionId:
        connectionIdMap.get(
          record.composite
            .selectedConnectionId
        ) || null,
      selectedWirePoint: null,
      nextSequence: Math.max(
        1,
        graph.nextSequence +
          nodes.length +
          connections.length + 1
      )
    };
    const selectedPoint =
      record.composite.selectedWirePoint;
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
        composite.selectedWirePoint = {
          connectionId:
            selectedConnectionId,
          pointId: selectedPointId
        };
      }
    }
    return { container, composite };
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
    replacementBoundaries
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
      const labelKey =
        savedApiCompositeBoundaryLabelKey(
          previousBoundary
        );
      const matches = replacement.filter(
        candidate =>
          !usedReplacementIds.has(
            candidate.id
          ) &&
          savedApiCompositeBoundaryLabelKey(
            candidate
          ) === labelKey &&
          savedApiCompositeBoundaryTypeCompatible(
            previousBoundary,
            candidate
          )
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
    return result;
  }

function matchingSavedApiCompositeInstances(
    record,
    instanceIds = null,
    {
      staleOnly = false
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
    return rootRuntimeGraphView().nodes
      .filter(node => {
        if (
          node?.operatorId !==
            "container.apiComposite" ||
          (allowedIds &&
            !allowedIds.has(node.id))
        ) {
          return false;
        }
        const linkedId = String(
          node.parameters
            ?.savedApiCompositeId || ""
        );
        const composite =
          graph.apiCompositeGraphs?.[
            node.id
          ];
        if (!composite) return false;
        const nodeName = String(
          node.parameters?.title ||
          node.label ||
          composite.title ||
          ""
        );
        const linkedById =
          linkedId === record.id;
        const linkedByName =
          !linkedById &&
          savedApiCompositeNodeMatchesName(
            node,
            composite,
            record.name
          );
        if (!linkedById && !linkedByName) {
          return false;
        }
        if (!staleOnly) return true;
        const currentFingerprintValue =
          String(
            composite.contentFingerprint ||
            node.parameters
              ?.apiCompositeFingerprint ||
            ""
          );
        if (
          record[
            SAVED_API_COMPOSITE_LEGACY_FINGERPRINT
          ] === true ||
          !currentFingerprintValue
        ) {
          return true;
        }
        const portLayout =
          node.parameters?.portLayout ===
            "mirrored"
            ? "mirrored"
            : "standard";
        const currentNameKey =
          savedApiCompositeNameKey(
            nodeName
          );
        const storedFingerprintIsCurrent =
          currentFingerprintValue &&
          composite.fingerprintNameKey ===
            currentNameKey &&
          composite.fingerprintPortLayout ===
            portLayout &&
          apiCompositeEditor
            ?.containerNodeId !== node.id;
        const currentFingerprint = String(
          storedFingerprintIsCurrent
            ? currentFingerprintValue
            : savedApiCompositeFingerprint(
                nodeName,
                composite,
                portLayout
              )
        );
        const incomingFingerprint =
          Object.hasOwn(
            record.composite,
            "portLayout"
          )
            ? String(
                record.contentFingerprint ||
                savedApiCompositeFingerprint(
                  record.name,
                  record.composite,
                  portLayout
                )
              )
            : savedApiCompositeFingerprint(
                record.name,
                record.composite,
                portLayout
              );
        return (
          currentFingerprint !==
          incomingFingerprint
        );
      });
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
    return rootRuntimeGraphView().nodes
      .filter(node => {
        if (
          node?.operatorId !==
            "container.apiComposite" ||
          (allowedIds &&
            !allowedIds.has(node.id))
        ) {
          return false;
        }
        const composite =
          graph.apiCompositeGraphs?.[
            node.id
          ];
        return Boolean(
          composite &&
          savedApiCompositeNodeMatchesName(
            node,
            composite,
            name
          )
        );
      });
  }

function savedApiCompositeReplacementImpact(
    record,
    instances
  ) {
    const rootView =
      rootRuntimeGraphView();
    const connectedWireIds = new Set();
    const disconnectedWireIds = new Set();
    for (const owner of instances) {
      const previousComposite =
        graph.apiCompositeGraphs?.[
          owner.id
        ];
      const boundaryMap =
        mapSavedApiCompositeBoundaries(
          previousComposite?.boundaryPorts ||
            owner.parameters
              ?.boundaryPorts,
          record.composite.boundaryPorts
        );
      for (const connection of
        rootView.connections) {
        let touchesOwner = false;
        let compatible = true;
        if (
          connection.fromNode === owner.id
        ) {
          touchesOwner = true;
          compatible =
            compatible &&
            boundaryMap.has(
              `output\u0000${connection.fromPort}`
            );
        }
        if (
          connection.toNode === owner.id
        ) {
          touchesOwner = true;
          compatible =
            compatible &&
            boundaryMap.has(
              `input\u0000${connection.toPort}`
            );
        }
        if (touchesOwner) {
          connectedWireIds.add(
            connection.id
          );
          if (!compatible) {
            disconnectedWireIds.add(
              connection.id
            );
          }
        }
      }
    }
    return {
      connectedWires:
        connectedWireIds.size,
      disconnectedWires:
        disconnectedWireIds.size
    };
  }

function replaceSavedApiCompositeInstances(
    record,
    instances,
    {
      linkToSaved = true
    } = {}
  ) {
    const rootView =
      rootRuntimeGraphView();
    const activeCompositeOwnerId =
      apiCompositeEditor
        ?.containerNodeId || "";
    const replacesActiveComposite =
      instances.some(owner =>
        owner.id === activeCompositeOwnerId
      );
    const candidateNodes =
      rootView.nodes.map(node =>
        nodeGraphClone(node)
      );
    let candidateConnections =
      rootView.connections.map(
        connection => nodeGraphClone(connection)
      );
    const candidateComposites = {
      ...(graph.apiCompositeGraphs || {})
    };
    const candidateCustomCSharpFiles =
      nodeGraphClone(
        graph.customCSharpFiles || {}
      );
    let disconnectedWires = 0;

    for (const sourceOwner of instances) {
      const ownerIndex =
        candidateNodes.findIndex(
          node => node.id === sourceOwner.id
        );
      const previousComposite =
        candidateComposites[
          sourceOwner.id
        ];
      if (
        ownerIndex < 0 ||
        !previousComposite
      ) {
        throw new Error(
          `Placed Composite '${sourceOwner.label || sourceOwner.id}' no longer has a complete owned graph. Nothing was replaced.`
        );
      }
      const boundaryMap =
        mapSavedApiCompositeBoundaries(
          previousComposite.boundaryPorts ||
            sourceOwner.parameters
              ?.boundaryPorts,
          record.composite.boundaryPorts
        );
      candidateConnections =
        candidateConnections.filter(
          connection => {
            if (
              connection.fromNode ===
                sourceOwner.id
            ) {
              const replacementPort =
                boundaryMap.get(
                  `output\u0000${connection.fromPort}`
                );
              if (!replacementPort) {
                disconnectedWires += 1;
                return false;
              }
              connection.fromPort =
                replacementPort;
            }
            if (
              connection.toNode ===
                sourceOwner.id
            ) {
              const replacementPort =
                boundaryMap.get(
                  `input\u0000${connection.toPort}`
                );
              if (!replacementPort) {
                disconnectedWires += 1;
                return false;
              }
              connection.toPort =
                replacementPort;
            }
            return true;
          }
        );

      const replacement =
        remapSavedApiCompositeInstance(
          record,
          sourceOwner.id,
          sourceOwner.x,
          sourceOwner.y
        );
      replacement.container.x =
        sourceOwner.x;
      replacement.container.y =
        sourceOwner.y;
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
      const effectiveFingerprint =
        savedApiCompositeFingerprint(
          record.name,
          record.composite,
          effectivePortLayout
        );
      replacement.container.parameters.portLayout =
        effectivePortLayout;
      replacement.container.parameters.apiCompositeFingerprint =
        effectiveFingerprint;
      if (!linkToSaved) {
        delete replacement.container
          .parameters
          .savedApiCompositeId;
        delete replacement.container
          .parameters
          .savedApiCompositeUpdatedAt;
      }
      replacement.composite.contentFingerprint =
        effectiveFingerprint;
      replacement.composite.fingerprintNameKey =
        savedApiCompositeNameKey(
          record.name
        );
      replacement.composite.fingerprintPortLayout =
        effectivePortLayout;
      candidateNodes[ownerIndex] =
        replacement.container;
      for (const ownerId of Object.keys(
        previousComposite
          .customCSharpFiles || {}
      )) {
        delete candidateCustomCSharpFiles[
          ownerId
        ];
      }
      mergeCustomCSharpFileRegistry(
        candidateCustomCSharpFiles,
        replacement.composite
          .customCSharpFiles
      );
      candidateComposites[
        sourceOwner.id
      ] = replacement.composite;
    }

    normalizeConnectionRouting(
      candidateConnections
    );
    const candidateRoot = {
      ...graph,
      apiCompositeGraphs:
        candidateComposites,
      customCSharpFiles:
        candidateCustomCSharpFiles,
      ...graphViewFrom({
        ...rootView,
        nodes: candidateNodes,
        connections:
          candidateConnections
      })
    };
    const expanded =
      expandApiCompositeGraphDocument(
        candidateRoot
      );
    const previousGraph = graph;
    const previousCustomCSharpEditor =
      customCSharpEditor;
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
        new WeakMap();
    }
    if (!analysis?.valid) {
      throw new Error(
        analysis?.reason ||
        "The Saved API Composite update would make the Runtime Graph invalid. Nothing was replaced."
      );
    }

    graph.apiCompositeGraphs =
      candidateComposites;
    graph.customCSharpFiles =
      candidateCustomCSharpFiles;
    commitRootRuntimeGraphView(
      candidateRoot
    );
    if (
      replacesActiveComposite &&
      apiCompositeEditor
    ) {
      const activeComposite =
        candidateComposites[
          activeCompositeOwnerId
        ];
      if (!activeComposite) {
        throw new Error(
          "The open API Composite replacement lost its owned graph. Nothing was replaced."
        );
      }
      apiCompositeEditor.title =
        record.name;
      apiCompositeEditor.initialNodeIds =
        new Set(
          activeComposite.nodes.map(
            node => node.id
          )
        );
      apiCompositeEditor.boundaryUpdate = {
        added: 0,
        removed: 0
      };
      applyGraphView(
        graphViewFrom(activeComposite)
      );
    }
    currentAnalysis = null;
    resetGraphRenderCaches();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    return {
      replaced: instances.length,
      disconnectedWires
    };
  }

async function applySavedApiCompositeVersion(
    record,
    {
      instanceIds = null,
      source = "library",
      linkToSaved = true
    } = {}
  ) {
    const matching =
      matchingSavedApiCompositeInstances(
        record,
        instanceIds,
        {
          staleOnly: true
        }
      );
    const activeOwnerId =
      apiCompositeEditor
        ?.containerNodeId || "";
    const replaceable = matching.filter(
      owner =>
        source === "import" ||
        owner.id !== activeOwnerId
    );
    const skippedOpen =
      matching.length -
      replaceable.length;
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
          graph.apiCompositeGraphs?.[
            owner.id
          ];
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
          ? "Return from the open Composite first, then update it from the matching Saved Composite in the Node Library."
          : "No matching placed Composite instance was found in the Runtime Graph.",
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
    const confirm =
      window.RMLBuilderDialog?.confirm;
    if (typeof confirm !== "function") {
      throw new Error(
        "The confirmation dialog is unavailable. No placed Composite was changed."
      );
    }
    const confirmed = Boolean(
      await confirm({
        tone:
          impact.disconnectedWires > 0
            ? "warning"
            : "primary",
        kicker:
          source === "import"
            ? "Matching Composite instances found"
            : "Update Node Graph from Saved Composite",
        title:
          `Replace ${replaceable.length.toLocaleString("de-DE")} placed instance${replaceable.length === 1 ? "" : "s"}?`,
        message:
          linkedByName > 0
            ? requiresFingerprintMigration
              ? "The normalized Composite name matches exactly, but the imported legacy file has no fingerprint. Replace it once and write the generated fingerprint while preserving container placement and every compatible external connection?"
              : "The normalized Composite name matches exactly and its content fingerprint changed. Replace the internal graph while preserving container placement and every compatible external connection?"
            : "Replace the internal graph of each matching instance while preserving its container position and every compatible external connection?",
        details:
          `${impact.connectedWires.toLocaleString("de-DE")} connected outer wire${impact.connectedWires === 1 ? " is" : "s are"} checked individually. ${impact.disconnectedWires > 0 ? `${impact.disconnectedWires.toLocaleString("de-DE")} wire${impact.disconnectedWires === 1 ? " uses" : "s use"} a removed or ambiguous port and will be disconnected.` : "All connected outer wires can be preserved."}${skippedOpen > 0 ? ` ${skippedOpen.toLocaleString("de-DE")} currently open instance is skipped until you return to the Runtime Graph.` : ""}`,
        confirmLabel:
          replaceable.length === 1
            ? "Replace Instance"
            : "Replace Instances",
        cancelLabel:
          "Keep Current Graph"
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
    const result =
      replaceSavedApiCompositeInstances(
        record,
        replaceable,
        { linkToSaved }
      );
    renderGraphPalette();
    showGraphMessage(
      `${result.replaced.toLocaleString("de-DE")} placed Composite instance${result.replaced === 1 ? " was" : "s were"} replaced.${linkedByName > 0 ? linkToSaved ? ` ${linkedByName.toLocaleString("de-DE")} unlinked or stale-linked instance${linkedByName === 1 ? " was" : "s were"} matched by exact normalized name and linked to this Saved Composite fingerprint.` : ` ${linkedByName.toLocaleString("de-DE")} graph-only instance${linkedByName === 1 ? " was" : "s were"} matched by exact normalized name and remained independent from the Saved Composite library.` : ""}${result.disconnectedWires > 0 ? ` ${result.disconnectedWires.toLocaleString("de-DE")} incompatible outer wire${result.disconnectedWires === 1 ? " was" : "s were"} disconnected.` : " All compatible outer wires and their routes were preserved."}`,
      result.disconnectedWires > 0
        ? "warning"
        : "success"
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
      fitAfter = false
    } = {}
  ) {
    const id = String(templateId || "");
    if (
      customCSharpEditor ||
      apiCompositeEditor
    ) {
      showGraphMessage(
        "Saved API Composites can be placed only in the main Runtime Graph.",
        "error"
      );
      return null;
    }
    if (!apiCompositeCatalogAvailable()) {
      showGraphMessage(
        "A verified live or synchronized cached API catalog is required.",
        "error"
      );
      return null;
    }
    if (
      savedApiCompositeOperations.has(
        "import"
      ) ||
      savedApiCompositeOperations.has(
        "catalog-reconciliation"
      ) ||
      savedApiCompositeOperations.has(
        "open-graph-catalog-reconciliation"
      )
    ) {
      showGraphMessage(
        "Saved API Composites are currently being updated or imported. Retry after that atomic operation has completed.",
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
        "The selected Saved API Composite no longer exists.",
        "error"
      );
      return null;
    }
    savedApiCompositeOperations.add(id);
    renderGraphPalette();
    try {
      const record =
        await resolveSavedApiCompositeForCurrentCatalog(
          source,
          { persistResolved: true }
        );
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
          y
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
        analysis = analyzeConnections(
          expanded.connections
        );
      } finally {
        graph = previousGraph;
      }
      if (!analysis?.valid) {
        throw new Error(
          analysis?.reason ||
          "The Saved API Composite does not expand to a type-safe graph. Nothing was inserted."
        );
      }

      graph.nodes.push(instance.container);
      graph.apiCompositeGraphs = {
        ...(graph.apiCompositeGraphs || {}),
        [containerId]: instance.composite
      };
      graph.customCSharpFiles =
        mergeCustomCSharpFileRegistry(
          graph.customCSharpFiles,
          instance.composite
            .customCSharpFiles
        );
      graph.nextSequence +=
        instance.composite.nodes.length +
        instance.composite.connections.length +
        1;
      graph.selectedNodeId = containerId;
      graph.selectedNodeIds = [containerId];
      graph.selectedConnectionId = null;
      clearSelectedWirePoint();
      currentAnalysis = null;
      graphNodeDefinitionCache =
        new WeakMap();
      resetGraphRenderCaches();
      persistGraph(true);
      renderGraphNodesAndWires();
      renderGraphInspector();
      renderGraphPalette();
      if (fitAfter) {
        requestProjectAnimationFrame(
          centerGraph
        );
      }
      showGraphMessage(
        `Saved API Composite '${record.name}' inserted with new node and wire identities.`,
        "success"
      );
      return instance.container;
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
      renderGraphPalette();
    }
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
    if (
      !window.confirm(
        `Delete Saved API Composite '${record.name}'? Existing graph instances remain complete and unchanged.`
      )
    ) {
      return false;
    }
    try {
      await deleteSavedApiCompositeRecord(id);
      for (const node of graph.nodes) {
        if (
          node.parameters
            ?.savedApiCompositeId === id
        ) {
          delete node.parameters
            .savedApiCompositeId;
          delete node.parameters
            .savedApiCompositeUpdatedAt;
        }
      }
      persistGraph(true);
      renderGraphPalette();
      renderGraphInspector();
      showGraphMessage(
        `Saved API Composite '${record.name}' deleted. Existing graph instances were not changed.`,
        "success"
      );
      return true;
    } catch (error) {
      showGraphMessage(
        error instanceof Error
          ? error.message
          : String(error),
        "error"
      );
      return false;
    }
  }

function synchronizeApiCompositeInspectorSaveAction(
    actions,
    node,
    linkedTemplate
  ) {
    let saveAction = actions.querySelector(
      "[data-saved-api-composite-inspector-save]"
    );
    const shouldShow = Boolean(
      !linkedTemplate ||
      matchingSavedApiCompositeInstances(
        linkedTemplate,
        [node.id],
        { staleOnly: true }
      ).length > 0
    );
    if (!shouldShow) {
      saveAction?.remove();
      return;
    }
    const label = linkedTemplate
      ? "Update"
      : "Save Composite";
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
        linkedTemplate
          ? "primary"
          : ""
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
        label
      );
    }
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
      const linkedTemplate =
        savedApiCompositeTemplates.get(
          String(
            node.parameters
              ?.savedApiCompositeId ||
            ""
          )
        );
      synchronizeApiCompositeInspectorSaveAction(
        actions,
        node,
        linkedTemplate
      );
    }
  }

function refreshVisibleSavedApiCompositeUpdateActions() {
    if (!dom.paletteContent) {
      return;
    }
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
          record
        );
      }
    }
  }

function savedApiCompositeLibraryBusy() {
    return (
      savedApiCompositeOperations.has(
        "import"
      ) ||
      savedApiCompositeOperations.has(
        "catalog-reconciliation"
      ) ||
      savedApiCompositeOperations.has(
        "open-graph-catalog-reconciliation"
      )
    );
  }

function synchronizeSavedApiCompositeUpdateAction(
    actions,
    record
  ) {
    const matchingInstances =
      matchingSavedApiCompositeInstances(
        record,
        null,
        { staleOnly: true }
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
      updateGraphButton.textContent = "↻";
      updateGraphButton.dataset
        .savedApiCompositeGraphUpdate =
        "true";
      updateGraphButton.addEventListener(
        "pointerdown",
        event => event.stopPropagation()
      );
      updateGraphButton.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          void applySavedApiCompositeVersion(
            record,
            { source: "library" }
          ).catch(error =>
            showGraphMessage(
              error instanceof Error
                ? error.message
                : String(error),
              "error"
            )
          );
        }
      );
      actions.prepend(updateGraphButton);
    }
    setGraphButtonAvailability(
      updateGraphButton,
      !savedApiCompositeLibraryBusy(),
      "Saved API Composites are currently being updated."
    );
    updateGraphButton.title =
      `Update ${matchingInstances.length.toLocaleString("de-DE")} differing placed Node Graph instance${matchingInstances.length === 1 ? "" : "s"} from '${record.name}'`;
  }

function createSavedApiCompositePaletteItem(
    record
  ) {
    const operatorId =
      `${SAVED_API_COMPOSITE_PALETTE_PREFIX}${record.id}`;
    const definition = {
      title: record.name,
      symbol: "API",
      iconTone: "gold",
      description:
        `${record.composite.nodes.length.toLocaleString("de-DE")} preserved API and logic nodes · click or drag to create a new independent instance.`
    };
    const row =
      document.createElement("div");
    row.className =
      "rml-saved-api-composite-row";
    const button =
      document.createElement("button");
    const compatibilityIssue =
      savedApiCompositeCompatibilityIssues.get(
        record.id
      ) || "";
    const libraryBusy =
      savedApiCompositeLibraryBusy();
    button.className =
      "rml-graph-palette-item rml-saved-api-composite-item";
    if (compatibilityIssue) {
      button.classList.add(
        "compatibility-unavailable"
      );
    }
    button.type = "button";
    button.dataset.savedApiCompositeId =
      record.id;
    const savedCompositeAvailable =
      apiCompositeCatalogAvailable() &&
      !libraryBusy &&
      !savedApiCompositeOperations.has(
        record.id
      );
    setGraphButtonAvailability(
      button,
      savedCompositeAvailable,
      !apiCompositeCatalogAvailable()
        ? "A verified live or synchronized cached API catalog is required."
        : "This Saved API Composite is currently being checked or instantiated atomically."
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
    add.textContent = compatibilityIssue
      ? "!"
      : !savedCompositeAvailable
        ? "·"
        : "＋";
    button.append(symbol, title, add);
    button.title = compatibilityIssue
      ? `${compatibilityIssue} Click to retry this Composite against the current catalog; use × to delete only its saved template.`
      : !apiCompositeCatalogAvailable()
        ? "A verified live or synchronized cached API catalog is required."
        : libraryBusy
          ? "Saved API Composites are being checked individually against the current catalog."
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
    exportButton.textContent = "⇩";
    exportButton.title =
      `Export '${record.name}' as compressed JSON`;
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
              `Saved API Composite '${record.name}' with GZIP compression${reduction > 0 ? ` (${reduction}% smaller)` : ""}.`,
              "success"
            );
          },
          error => {
            console.error(
              "Could not export the compressed Saved API Composite JSON.",
              error
            );
            showGraphMessage(
              error instanceof Error
                ? error.message
                : "The compressed API Composite could not be exported.",
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
    deleteButton.textContent = "×";
    deleteButton.title =
      `Delete '${record.name}' from Saved API Composites`;
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
      record
    );
    row.append(button, actions);
    return row;
  }
