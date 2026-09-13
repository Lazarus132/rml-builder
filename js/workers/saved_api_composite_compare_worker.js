"use strict";
// RML Builder workers: saved_api_composite_compare_worker.

function savedApiCompositeCompareWorkerMain(
  workerScope
) {
const self = workerScope;
const SAVED_API_COMPOSITE_COMPARE_WORKER_MODULE_ID =
  "1.20.31-universal-presentation-dev39-clean-stale-api-repair";
const SAVED_API_COMPOSITE_CANONICAL_SCHEMA_VERSION = 4;
const MESSAGE_TYPE = "rml-saved-api-composite-compare";
const RESULT_TYPE = `${MESSAGE_TYPE}-result`;

const GRAPH_CACHE_KEYS = new Set([
  "revision",
  "contentFingerprint",
  "fingerprintNameKey",
  "fingerprintPortLayout",
  "fingerprintNestedSignature"
]);
const GRAPH_PRESENTATION_KEYS = new Set([
  "viewport",
  "selectedNodeId",
  "selectedNodeIds",
  "selectedConnectionId",
  "selectedWirePoint"
]);
const CUSTOM_CSHARP_GRAPH_DERIVED_KEYS = new Set([
  "catalogFingerprint",
  "catalogEngineVersion",
  "catalogSource",
  "catalogDefinitionRevision",
  "coordinateSpaceVersion"
]);
const COMPOSITE_LINK_PARAMETER_KEYS = new Set([
  "savedApiCompositeId",
  "savedApiCompositeUpdatedAt",
  "apiCompositeFingerprint",


  "boundaryPorts",
  "memberCount"
]);
const ELEMENT_IDENTITY_LINK_KEYS = new Set([
  "templateId"
]);
const WORKER_LIMIT_OVERRIDES =
  self.RMLSavedApiCompositeCompareWorkerLimits &&
  typeof self.RMLSavedApiCompositeCompareWorkerLimits === "object"
    ? self.RMLSavedApiCompositeCompareWorkerLimits
    : {};
function positiveWorkerLimit(name, fallback) {
  const value = Number(WORKER_LIMIT_OVERRIDES[name]);
  return Number.isSafeInteger(value) && value > 0
    ? value
    : fallback;
}
const MAX_STREAM_TOKEN_STRING_LENGTH = 16 * 1024;
const STREAM_PAGE_ENCODING_VERSION = 1;
const STREAM_PAGE_BYTE_LENGTH = 64 * 1024;
const STREAM_PAGE_MAX_IN_FLIGHT = 4;
const STREAM_PAGE_TOKEN = Object.freeze({
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
const MAX_STREAMED_JSON_CHARACTERS = Math.max(
  512 * 1024 * 1024,
  positiveWorkerLimit(
    "maximumStreamedJsonCharacters",
    512 * 1024 * 1024
  )
);
const MAX_CANONICAL_BASELINE_CHARACTERS = Math.max(
  1024 * 1024 * 1024,
  positiveWorkerLimit(
    "maximumCanonicalBaselineCharacters",
    1024 * 1024 * 1024
  )
);
const SOFT_MAX_ACTIVE_STREAMED_SNAPSHOTS =
  positiveWorkerLimit(
    "softMaximumActiveStreams",
    1
  );
const STREAMED_SNAPSHOT_IDLE_TIMEOUT_MS = 60 * 1000;
const SOFT_RETAINED_BASELINE_CHARACTERS =
  positiveWorkerLimit(
    "softRetainedBaselineCharacters",
    256 * 1024 * 1024
  );
const SOFT_MAX_RETAINED_BASELINES =
  positiveWorkerLimit(
    "softMaximumRetainedBaselines",
    128
  );

const CUSTOM_CSHARP_GRAPH_NODE_REFERENCE_KEYS = new Set([
  "outputNodeId",
  "rootSyntaxNodeId",
  "directSourceNodeId"
]);

const baselineByIdentity = new Map();
const latestRevisionByIdentity = new Map();
const streamedSnapshots = new Map();
let activeProjectEpoch;
let retainedBaselineCharacters = 0;

function jsonObjectValueIsOmitted(value) {
  return value === undefined ||
    typeof value === "function" ||
    typeof value === "symbol";
}

function jsonArrayValue(value) {
  return jsonObjectValueIsOmitted(value) ||
    (typeof value === "number" && !Number.isFinite(value))
    ? null
    : value;
}

function jsonError(message, path) {
  return new TypeError(`${message} at ${path || "$"}.`);
}

function assertJsonScalar(value, path) {
  if (value === null) return value;
  switch (typeof value) {
    case "string":
    case "boolean":
      return value;
    case "number":
      if (!Number.isFinite(value)) return null;
      return Object.is(value, -0) ? 0 : value;
    case "undefined":
    case "function":
    case "symbol":


      return null;
    default:
      throw jsonError(
        `Unsupported ${typeof value} value in Composite JSON`,
        path
      );
  }
}

function mappedReference(scopes, kind, value) {
  const source = String(value);
  for (const scope of scopes) {
    const map = kind === "node"
      ? scope.nodeIds
      : kind === "connection"
        ? scope.connectionIds
        : scope.pointIds;
    const mapped = map.get(source);
    if (mapped !== undefined) return mapped;
  }
  return source;
}

function mappedPointReference(scopes, connectionId, pointId) {
  const sourceConnectionId = String(connectionId || "");
  const sourcePointId = String(pointId || "");
  for (const scope of scopes) {
    const connectionPoints =
      scope.pointIdsByConnection.get(sourceConnectionId);
    const mapped = connectionPoints?.get(sourcePointId);
    if (mapped !== undefined) return mapped;
  }
  return mappedReference(scopes, "point", sourcePointId);
}

function canonicalPropertyEntries(entries, path) {
  entries.sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  );
  for (let index = 1; index < entries.length; index += 1) {
    if (entries[index - 1][0] === entries[index][0]) {
      throw jsonError(
        `Canonical identity collision for '${entries[index][0]}'`,
        path
      );
    }
  }
  return Object.fromEntries(entries);
}

function canonicalGeneric(value, state, path, scopes) {
  if (value === null || typeof value !== "object") {
    return assertJsonScalar(value, path);
  }
  if (state.stack.has(value)) {
    throw jsonError("Composite JSON contains a cycle", path);
  }
  state.stack.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        item = jsonArrayValue(item);
        return canonicalGeneric(
          item,
          state,
          `${path}[${index}]`,
          scopes
        );
      });
    }
    const entries = [];
    for (const key of Object.keys(value)) {
      if (jsonObjectValueIsOmitted(value[key])) continue;
      entries.push([
        key,
        canonicalGeneric(
          value[key],
          state,
          `${path}.${key}`,
          scopes
        )
      ]);
    }
    return canonicalPropertyEntries(entries, path);
  } finally {
    state.stack.delete(value);
  }
}

function buildGraphScope(graph, graphPath, path) {
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const connections = Array.isArray(graph.connections)
    ? graph.connections
    : [];
  const nodeIds = new Map();
  const nodesById = new Map();
  const connectionIds = new Map();
  const pointIds = new Map();
  const pointIdsByConnection = new Map();

  for (let index = 0; index < nodes.length; index += 1) {
    const id = String(nodes[index]?.id || "");
    if (id && nodeIds.has(id)) {
      throw jsonError(`Duplicate node identity '${id}'`, `${path}.nodes`);
    }
    if (id) {
      nodeIds.set(id, `${graphPath}/node:${index}`);
      nodesById.set(id, nodes[index]);
    }
  }
  for (let index = 0; index < connections.length; index += 1) {
    const connection = connections[index];
    const connectionId = String(connection?.id || "");
    if (connectionId && connectionIds.has(connectionId)) {
      throw jsonError(
        `Duplicate connection identity '${connectionId}'`,
        `${path}.connections`
      );
    }
    const canonicalConnectionId = `${graphPath}/connection:${index}`;
    if (connectionId) {
      connectionIds.set(connectionId, canonicalConnectionId);
    }
    const points = Array.isArray(connection?.points)
      ? connection.points
      : [];
    const connectionPointIds = new Map();
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const pointId = String(points[pointIndex]?.id || "");
      const canonicalPointId =
        `${canonicalConnectionId}/point:${pointIndex}`;
      if (pointId && connectionPointIds.has(pointId)) {
        throw jsonError(
          `Duplicate wire-point identity '${pointId}'`,
          `${path}.connections[${index}].points`
        );
      }
      if (pointId) {
        connectionPointIds.set(pointId, canonicalPointId);
        const previous = pointIds.get(pointId);
        if (previous !== undefined && previous !== canonicalPointId) {
          throw jsonError(
            `Ambiguous wire-point identity '${pointId}'`,
            `${path}.connections`
          );
        }
        pointIds.set(pointId, canonicalPointId);
      }
    }
    if (connectionId) {
      pointIdsByConnection.set(connectionId, connectionPointIds);
    }
  }
  return {
    graphPath,
    nodeIds,
    nodesById,
    connectionIds,
    pointIds,
    pointIdsByConnection
  };
}

function canonicalNode(node, index, state, path, scopes) {
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw jsonError("Graph node must be a JSON object", path);
  }
  const entries = [];
  const isCompositeOwner =
    node.operatorId === "container.apiComposite";
  for (const key of Object.keys(node)) {
    if (jsonObjectValueIsOmitted(node[key])) continue;
    if (key === "id") {
      entries.push([key, scopes[0].graphPath + `/node:${index}`]);
      continue;
    }
    if (key === "parameters") {
      const parameters = node.parameters;
      if (
        !parameters ||
        typeof parameters !== "object" ||
        Array.isArray(parameters)
      ) {
        entries.push([
          key,
          canonicalGeneric(parameters, state, `${path}.parameters`, scopes)
        ]);
        continue;
      }
      const parameterEntries = [];
      const defaultParameters =
        state.nodeParameterDefaultsByOperatorId.get(
          String(node.operatorId || "")
        ) || null;
      for (const parameterKey of Object.keys(parameters)) {
        if (
          isCompositeOwner &&
          COMPOSITE_LINK_PARAMETER_KEYS.has(parameterKey)
        ) {
          continue;
        }


        if (
          parameterKey === "portLayout" &&
          parameters[parameterKey] !== "mirrored"
        ) {
          continue;
        }
        const defaultValues = defaultParameters?.get(
          parameterKey
        );
        if (
          defaultValues instanceof Set &&
          defaultValues.has(
            Number(parameters[parameterKey])
          )
        ) {
          continue;
        }
        if (jsonObjectValueIsOmitted(parameters[parameterKey])) continue;
        parameterEntries.push([
          parameterKey,
          canonicalGeneric(
            parameters[parameterKey],
            state,
            `${path}.parameters.${parameterKey}`,
            scopes
          )
        ]);
      }
      entries.push([
        key,
        canonicalPropertyEntries(parameterEntries, `${path}.parameters`)
      ]);
      continue;
    }



    if (
      (key === "width" || key === "height") &&
      node[key] === null
    ) {
      continue;
    }
    entries.push([
      key,
      canonicalGeneric(node[key], state, `${path}.${key}`, scopes)
    ]);
  }
  return canonicalPropertyEntries(entries, path);
}

function canonicalConnection(connection, index, state, path, scopes) {
  if (!connection || typeof connection !== "object" || Array.isArray(connection)) {
    throw jsonError("Graph connection must be a JSON object", path);
  }
  const entries = [];
  const sourceConnectionId = String(connection.id || "");
  for (const key of Object.keys(connection)) {
    if (jsonObjectValueIsOmitted(connection[key])) continue;
    if (key === "id") {
      entries.push([
        key,
        scopes[0].graphPath + `/connection:${index}`
      ]);
      continue;
    }
    if (key === "points") {
      if (!Array.isArray(connection.points)) {
        entries.push([
          key,
          canonicalGeneric(
            connection.points,
            state,
            `${path}.points`,
            scopes
          )
        ]);
        continue;
      }
      entries.push([
        key,
        connection.points.map((point, pointIndex) => {
          if (!point || typeof point !== "object" || Array.isArray(point)) {
            throw jsonError(
              "Wire routing point must be a JSON object",
              `${path}.points[${pointIndex}]`
            );
          }
          const pointEntries = [];
          for (const pointKey of Object.keys(point)) {
            if (jsonObjectValueIsOmitted(point[pointKey])) continue;
            pointEntries.push([
              pointKey,
              pointKey === "id"
                ? `${scopes[0].graphPath}/connection:${index}/point:${pointIndex}`
                 : canonicalGeneric(
                     point[pointKey],
                     state,
                     `${path}.points[${pointIndex}].${pointKey}`,
                     scopes
                   )
            ]);
          }
          return canonicalPropertyEntries(
            pointEntries,
            `${path}.points[${pointIndex}]`
          );
        })
      ]);
      continue;
    }
    if (key === "branchFrom" && connection.branchFrom) {
      const branch = connection.branchFrom;
      const branchConnectionId = String(branch.connectionId || "");
      const branchEntries = [];
      for (const branchKey of Object.keys(branch)) {
        if (jsonObjectValueIsOmitted(branch[branchKey])) continue;
        let value;
        if (branchKey === "connectionId") {
          value = mappedReference(scopes, "connection", branch[branchKey]);
        } else if (branchKey === "pointId") {
          value = mappedPointReference(
            scopes,
            branchConnectionId,
            branch[branchKey]
          );
        } else {
          value = canonicalGeneric(
            branch[branchKey],
            state,
            `${path}.branchFrom.${branchKey}`,
            scopes
          );
        }
        branchEntries.push([branchKey, value]);
      }
      entries.push([
        key,
        canonicalPropertyEntries(branchEntries, `${path}.branchFrom`)
      ]);
      continue;
    }
    entries.push([
      key,
      key === "fromNode" || key === "toNode"
        ? mappedReference(scopes, "node", connection[key])
        : canonicalGeneric(
            connection[key],
            state,
            `${path}.${key}`,
            scopes
          )
    ]);
  }


  void sourceConnectionId;
  return canonicalPropertyEntries(entries, path);
}

function canonicalRegistry(
  registry,
  kind,
  state,
  path,
  scopes
) {
  if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
    return canonicalGeneric(registry, state, path, scopes);
  }
  const entries = [];
  for (const sourceOwnerId of Object.keys(registry)) {
    if (jsonObjectValueIsOmitted(registry[sourceOwnerId])) continue;
    const ownerNode = scopes[0].nodesById.get(sourceOwnerId);
    const expectedOperatorId = kind === "api"
      ? "container.apiComposite"
      : "csharp.file";
    if (!ownerNode || ownerNode.operatorId !== expectedOperatorId) {
      throw jsonError(
        `${kind === "api" ? "Nested API Composite" : "Custom C# graph"} registry owner '${sourceOwnerId}' does not match a local '${expectedOperatorId}' node`,
        path
      );
    }
    const ownerId = mappedReference(scopes, "node", sourceOwnerId);
    const childPath = `${scopes[0].graphPath}/${kind}@${ownerId}`;
    const authoritativeSource =
      kind === "custom-csharp"
        ? ownerNode?.parameters?.source
        : undefined;
    entries.push([
      ownerId,
      canonicalGraph(
        registry[sourceOwnerId],
        state,
        `${path}.${sourceOwnerId}`,
        childPath,
        scopes,
        kind,
        { authoritativeSource }
      )
    ]);
  }
  return canonicalPropertyEntries(entries, path);
}

function canonicalBranchRouting(value, state, path, scopes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return canonicalGeneric(value, state, path, scopes);
  }
  const entries = [];
  for (const sourceConnectionId of Object.keys(value)) {
    const branch = value[sourceConnectionId];
    if (jsonObjectValueIsOmitted(branch)) continue;
    const connectionId = mappedReference(
      scopes,
      "connection",
      sourceConnectionId
    );
    if (!branch || typeof branch !== "object" || Array.isArray(branch)) {
      entries.push([
        connectionId,
        canonicalGeneric(branch, state, `${path}.${sourceConnectionId}`, scopes)
      ]);
      continue;
    }
    const parentConnectionId = String(branch.connectionId || "");
    const branchEntries = [];
    for (const key of Object.keys(branch)) {
      if (jsonObjectValueIsOmitted(branch[key])) continue;
      branchEntries.push([
        key,
        key === "connectionId"
          ? mappedReference(scopes, "connection", branch[key])
          : key === "pointId"
            ? mappedPointReference(scopes, parentConnectionId, branch[key])
            : canonicalGeneric(
                branch[key],
                state,
                `${path}.${sourceConnectionId}.${key}`,
                scopes
              )
      ]);
    }
    entries.push([
      connectionId,
      canonicalPropertyEntries(branchEntries, `${path}.${sourceConnectionId}`)
    ]);
  }
  return canonicalPropertyEntries(entries, path);
}

function canonicalElementIdentity(value, state, path, scopes) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return canonicalGeneric(value, state, path, scopes);
  }
  const entries = [];
  for (const key of Object.keys(value)) {
    if (ELEMENT_IDENTITY_LINK_KEYS.has(key)) continue;
    const mapValue = value[key];
    if (jsonObjectValueIsOmitted(mapValue)) continue;
    if (
      (key === "nodes" || key === "connections") &&
      mapValue &&
      typeof mapValue === "object" &&
      !Array.isArray(mapValue)
    ) {
      const kind = key === "nodes" ? "node" : "connection";
      const mapEntries = Object.keys(mapValue)
        .filter(sourceId =>
          !jsonObjectValueIsOmitted(
            mapValue[sourceId]
          )
        )
        .map(sourceId => [
          mappedReference(scopes, kind, sourceId),
          canonicalGeneric(
            mapValue[sourceId],
            state,
            `${path}.${key}.${sourceId}`,
            [],
            ""
          )
        ]);
      entries.push([
        key,
        canonicalPropertyEntries(mapEntries, `${path}.${key}`)
      ]);
      continue;
    }
    if (
      key === "points" &&
      mapValue &&
      typeof mapValue === "object" &&
      !Array.isArray(mapValue)
    ) {
      const pointEntries = [];
      for (const sourceConnectionId of Object.keys(mapValue)) {
        const pointMap = mapValue[sourceConnectionId];
        if (jsonObjectValueIsOmitted(pointMap)) continue;
        const mappedConnectionId = mappedReference(
          scopes,
          "connection",
          sourceConnectionId
        );
        if (!pointMap || typeof pointMap !== "object" || Array.isArray(pointMap)) {
          pointEntries.push([
            mappedConnectionId,
            canonicalGeneric(
              pointMap,
              state,
              `${path}.points.${sourceConnectionId}`,
              []
            )
          ]);
          continue;
        }
        const mappedPoints = Object.keys(pointMap)
          .filter(sourcePointId =>
            !jsonObjectValueIsOmitted(
              pointMap[sourcePointId]
            )
          )
          .map(sourcePointId => [
            mappedPointReference(scopes, sourceConnectionId, sourcePointId),
            canonicalGeneric(
              pointMap[sourcePointId],
              state,
              `${path}.points.${sourceConnectionId}.${sourcePointId}`,
              [],
              ""
            )
          ]);
        pointEntries.push([
          mappedConnectionId,
          canonicalPropertyEntries(
            mappedPoints,
            `${path}.points.${sourceConnectionId}`
          )
        ]);
      }
      entries.push([
        key,
        canonicalPropertyEntries(pointEntries, `${path}.points`)
      ]);
      continue;
    }
    entries.push([
      key,
      canonicalGeneric(mapValue, state, `${path}.${key}`, scopes)
    ]);
  }
  return canonicalPropertyEntries(entries, path);
}

function canonicalBoundaryPorts(value, state, path, scopes) {
  if (!Array.isArray(value)) {
    return canonicalGeneric(value, state, path, scopes);
  }
  return value.map((boundary, index) => {
    const boundaryPath = `${path}[${index}]`;
    if (!boundary || typeof boundary !== "object" || Array.isArray(boundary)) {
      return canonicalGeneric(boundary, state, boundaryPath, scopes);
    }
    const entries = [];
    for (const key of Object.keys(boundary)) {
      if (jsonObjectValueIsOmitted(boundary[key])) continue;
      entries.push([
        key,
        key === "internalNodeId"
          ? mappedReference(scopes, "node", boundary[key])
          : canonicalGeneric(
              boundary[key],
              state,
              `${boundaryPath}.${key}`,
              scopes
            )
      ]);
    }
    return canonicalPropertyEntries(entries, boundaryPath);
  });
}

function canonicalGraph(
  graph,
  state,
  path,
  graphPath,
  ancestorScopes = [],
  graphKind = "graph",
  graphContext = null
) {
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) {
    throw jsonError("Saved API Composite graph must be a JSON object", path);
  }
  if (state.stack.has(graph)) {
    throw jsonError("Composite graph nesting contains a cycle", path);
  }
  state.stack.add(graph);
  try {
    const scope = buildGraphScope(graph, graphPath, path);
    const scopes = [scope, ...ancestorScopes];
    const entries = [];
    for (const key of Object.keys(graph)) {




      if (
        GRAPH_CACHE_KEYS.has(key) ||
        GRAPH_PRESENTATION_KEYS.has(key) ||
        (
          graphKind === "custom-csharp" &&
          CUSTOM_CSHARP_GRAPH_DERIVED_KEYS.has(key)
        )
      ) {
        continue;
      }




      if (
        graphKind === "custom-csharp" &&
        key === "source" &&
        (
          graph[key] == null ||
          graph[key] === graphContext?.authoritativeSource
        )
      ) {
        continue;
      }
      if (jsonObjectValueIsOmitted(graph[key])) continue;
      let value;
      if (key === "nodes") {
        if (!Array.isArray(graph.nodes)) {
          throw jsonError("Graph nodes must be an array", `${path}.nodes`);
        }
        value = graph.nodes.map((node, index) =>
          canonicalNode(node, index, state, `${path}.nodes[${index}]`, scopes)
        );
      } else if (key === "connections") {
        if (!Array.isArray(graph.connections)) {
          throw jsonError(
            "Graph connections must be an array",
            `${path}.connections`
          );
        }
        value = graph.connections.map((connection, index) =>
          canonicalConnection(
            connection,
            index,
            state,
            `${path}.connections[${index}]`,
            scopes
          )
        );
      } else if (key === "apiCompositeGraphs") {
        value = canonicalRegistry(
          graph[key],
          "api",
          state,
          `${path}.${key}`,
          scopes
        );
      } else if (key === "customCSharpFiles") {
        value = canonicalRegistry(
          graph[key],
          "custom-csharp",
          state,
          `${path}.${key}`,
          scopes
        );
      } else if (key === "branchRouting") {
        value = canonicalBranchRouting(
          graph[key],
          state,
          `${path}.${key}`,
          scopes
        );
      } else if (key === "boundaryPorts") {
        value = canonicalBoundaryPorts(
          graph[key],
          state,
          `${path}.${key}`,
          scopes
        );
      } else if (key === "elementIdentity") {
        value = canonicalElementIdentity(
          graph[key],
          state,
          `${path}.${key}`,
          scopes
        );
      } else if (
        graphKind === "custom-csharp" &&
        CUSTOM_CSHARP_GRAPH_NODE_REFERENCE_KEYS.has(key)
      ) {
        value = mappedReference(scopes, "node", graph[key]);
      } else {
        value = canonicalGeneric(
          graph[key],
          state,
          `${path}.${key}`,
          scopes
        );
      }
      entries.push([key, value]);
    }
    state.stats.graphs += 1;
    state.stats.nodes += Array.isArray(graph.nodes) ? graph.nodes.length : 0;
    state.stats.connections += Array.isArray(graph.connections)
      ? graph.connections.length
      : 0;
    if (graph.customCSharpFiles && typeof graph.customCSharpFiles === "object") {
      state.stats.customCSharpGraphs += Object.keys(graph.customCSharpFiles).length;
    }
    if (graph.apiCompositeGraphs && typeof graph.apiCompositeGraphs === "object") {
      state.stats.nestedCompositeGraphs += Object.keys(graph.apiCompositeGraphs).length;
    }
    for (const connection of Array.isArray(graph.connections)
      ? graph.connections
      : []) {
      state.stats.routingPoints += Array.isArray(connection?.points)
        ? connection.points.length
        : 0;
    }
    return canonicalPropertyEntries(entries, path);
  } finally {
    state.stack.delete(graph);
  }
}

function stableHash128(value) {
  const text = `rml-saved-api-composite-json-v${SAVED_API_COMPOSITE_CANONICAL_SCHEMA_VERSION}\0${value}`;
  let a = 0x811c9dc5;
  let b = 0x9e3779b9;
  let c = 0x85ebca6b;
  let d = 0xc2b2ae35;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    a = Math.imul(a ^ code, 0x01000193);
    b = Math.imul(b ^ code, 0x27d4eb2d);
    c = Math.imul(c ^ code, 0x165667b1);
    d = Math.imul(d ^ code, 0x9e3779b1);
  }
  const hex = number => (number >>> 0).toString(16).padStart(8, "0");
  return `${hex(a)}${hex(b)}${hex(c)}${hex(d)}`;
}

function normalizationPolicyParameterDefaults(policy) {
  const result = new Map();
  if (
    !policy ||
    typeof policy !== "object" ||
    policy.schemaVersion !== 1 ||
    !Array.isArray(policy.nodeParameterDefaults)
  ) {
    return result;
  }
  for (const operatorEntry of policy.nodeParameterDefaults) {
    if (
      !Array.isArray(operatorEntry) ||
      operatorEntry.length !== 2 ||
      !String(operatorEntry[0] || "") ||
      !Array.isArray(operatorEntry[1])
    ) {
      continue;
    }
    const defaults = new Map();
    for (const parameterEntry of operatorEntry[1]) {
      if (
        !Array.isArray(parameterEntry) ||
        parameterEntry.length !== 2 ||
        !String(parameterEntry[0] || "")
      ) {
        continue;
      }
      const sourceValues = Array.isArray(parameterEntry[1])
        ? parameterEntry[1]
        : [parameterEntry[1]];
      const values = new Set();
      for (const sourceValue of sourceValues) {
        const number = Number(sourceValue);
        if (Number.isFinite(number)) {
          values.add(number);
        }
      }
      if (values.size > 0) {
        defaults.set(
          String(parameterEntry[0]),
          values
        );
      }
    }
    if (defaults.size > 0) {
      result.set(String(operatorEntry[0]), defaults);
    }
  }
  return result;
}

function canonicalComposite(composite, normalizationPolicy = null) {
  const state = {
    stack: new WeakSet(),
    nodeParameterDefaultsByOperatorId:
      normalizationPolicyParameterDefaults(
        normalizationPolicy
      ),
    stats: {
      graphs: 0,
      nestedCompositeGraphs: 0,
      customCSharpGraphs: 0,
      nodes: 0,
      connections: 0,
      routingPoints: 0
    }
  };
  const canonical = canonicalGraph(composite, state, "$", "$graph");
  const serialized = JSON.stringify(canonical);
  return {
    serialized,
    fingerprint:
      `rml-saved-api-composite-json-v${SAVED_API_COMPOSITE_CANONICAL_SCHEMA_VERSION}-${stableHash128(serialized)}`,
    serializedLength: serialized.length,
    stats: state.stats
  };
}

function streamedSnapshotKey(identity, snapshotId) {
  return `${identity}\0${snapshotId}`;
}

function createStreamedJsonBuilder() {
  return {
    root: undefined,
    rootSet: false,
    stack: [],
    stringParts: null,
    stringLength: 0,
    keyParts: null,
    keyLength: 0,
    tokenCount: 0,
    characterCount: 0
  };
}

function attachStreamedJsonValue(builder, value) {
  if (builder.stack.length === 0) {
    if (builder.rootSet) {
      throw new TypeError("A streamed Composite snapshot has more than one root value.");
    }
    builder.root = value;
    builder.rootSet = true;
    return;
  }
  const frame = builder.stack.at(-1);
  if (frame.kind === "array") {
    frame.value.push(value);
    return;
  }
  if (frame.pendingKey === null) {
    throw new TypeError("A streamed object value has no preceding property key.");
  }
  Object.defineProperty(frame.value, frame.pendingKey, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
  frame.pendingKey = null;
}

function appendDecodedStreamedJsonToken(
  builder,
  type,
  tokenValue
) {
  builder.tokenCount += 1;
  if (type === "object" || type === "array") {
    if (builder.stringParts || builder.keyParts) {
      throw new TypeError("A streamed container cannot begin inside a string or object key.");
    }
    const value = type === "array" ? [] : Object.create(null);
    attachStreamedJsonValue(builder, value);
    builder.stack.push({
      kind: type,
      value,
      pendingKey: null
    });
    return;
  }
  if (type === "end") {
    if (builder.stringParts || builder.keyParts || builder.stack.length === 0) {
      throw new TypeError("A streamed container terminator is unmatched.");
    }
    const frame = builder.stack.at(-1);
    if (frame.kind === "object" && frame.pendingKey !== null) {
      throw new TypeError("A streamed object property has no value.");
    }
    builder.stack.pop();
    return;
  }
  if (type === "key") {
    if (
      builder.stringParts ||
      builder.keyParts ||
      builder.stack.length === 0 ||
      builder.stack.at(-1).kind !== "object" ||
      builder.stack.at(-1).pendingKey !== null ||
      typeof tokenValue !== "string"
    ) {
      throw new TypeError("A streamed object property key is out of sequence.");
    }
    if (tokenValue.length > MAX_STREAM_TOKEN_STRING_LENGTH) {
      throw new RangeError("A streamed object property key is too large.");
    }
    builder.characterCount += tokenValue.length;
    builder.stack.at(-1).pendingKey = tokenValue;
    return;
  }
  if (type === "key-string") {
    if (
      builder.stringParts ||
      builder.keyParts ||
      builder.stack.length === 0 ||
      builder.stack.at(-1).kind !== "object" ||
      builder.stack.at(-1).pendingKey !== null
    ) {
      throw new TypeError("A streamed object-key string is out of sequence.");
    }
    builder.keyParts = [];
    builder.keyLength = 0;
    return;
  }
  if (type === "key-part") {
    if (!builder.keyParts || typeof tokenValue !== "string") {
      throw new TypeError("A streamed object-key part is out of sequence.");
    }
    if (tokenValue.length > MAX_STREAM_TOKEN_STRING_LENGTH) {
      throw new RangeError("A streamed object-key part exceeds its bounded size.");
    }
    builder.keyParts.push(tokenValue);
    builder.keyLength += tokenValue.length;
    builder.characterCount += tokenValue.length;
    return;
  }
  if (type === "end-key") {
    if (!builder.keyParts) {
      throw new TypeError("A streamed object-key terminator is unmatched.");
    }
    const key = builder.keyParts.join("");
    builder.keyParts = null;
    builder.keyLength = 0;
    builder.stack.at(-1).pendingKey = key;
    return;
  }
  if (type === "scalar") {
    if (builder.stringParts || builder.keyParts) {
      throw new TypeError("A streamed scalar cannot occur inside a string or object key.");
    }
    if (typeof tokenValue === "string") {
      if (tokenValue.length > MAX_STREAM_TOKEN_STRING_LENGTH) {
        throw new RangeError("A streamed scalar string must be sent in bounded parts.");
      }
      builder.characterCount += tokenValue.length;
    }
    attachStreamedJsonValue(
      builder,
      assertJsonScalar(tokenValue, "$stream")
    );
    return;
  }
  if (type === "string") {
    if (builder.stringParts || builder.keyParts) {
      throw new TypeError("A streamed string cannot be nested.");
    }
    builder.stringParts = [];
    builder.stringLength = 0;
    return;
  }
  if (type === "string-part") {
    if (!builder.stringParts || typeof tokenValue !== "string") {
      throw new TypeError("A streamed string part is out of sequence.");
    }
    if (tokenValue.length > MAX_STREAM_TOKEN_STRING_LENGTH) {
      throw new RangeError("A streamed string part exceeds its bounded size.");
    }
    builder.stringParts.push(tokenValue);
    builder.stringLength += tokenValue.length;
    builder.characterCount += tokenValue.length;
    return;
  }
  if (type === "end-string") {
    if (!builder.stringParts) {
      throw new TypeError("A streamed string terminator is unmatched.");
    }
    const value = builder.stringParts.join("");
    builder.stringParts = null;
    builder.stringLength = 0;
    attachStreamedJsonValue(builder, value);
    return;
  }
  throw new TypeError(`Unsupported streamed Composite token '${type}'.`);
}

function streamedPageString(view, cursor, usedBytes) {
  if (cursor + 4 > usedBytes) {
    throw new TypeError("A streamed Composite page contains a truncated string length.");
  }
  const length = view.getUint32(cursor, true);
  cursor += 4;
  const byteLength = length * 2;
  if (
    !Number.isSafeInteger(byteLength) ||
    cursor + byteLength > usedBytes
  ) {
    throw new TypeError("A streamed Composite page contains a truncated UTF-16 string.");
  }
  if (length > MAX_STREAM_TOKEN_STRING_LENGTH) {
    throw new RangeError("A streamed Composite page string exceeds its bounded token size.");
  }
  const parts = [];
  for (let offset = 0; offset < length;) {
    const count = Math.min(4096, length - offset);
    const codes = new Array(count);
    for (let index = 0; index < count; index += 1) {
      codes[index] = view.getUint16(
        cursor + (offset + index) * 2,
        true
      );
    }
    parts.push(String.fromCharCode(...codes));
    offset += count;
  }
  return {
    value: parts.join(""),
    cursor: cursor + byteLength
  };
}

function appendStreamedJsonPage(
  builder,
  pageBuffer,
  usedBytes,
  expectedTokenCount
) {
  if (
    !pageBuffer ||
    Object.prototype.toString.call(pageBuffer) !== "[object ArrayBuffer]" ||
    pageBuffer.byteLength !== STREAM_PAGE_BYTE_LENGTH
  ) {
    throw new TypeError(
      `A streamed Composite page must own exactly ${STREAM_PAGE_BYTE_LENGTH} transferable bytes.`
    );
  }
  if (
    !Number.isSafeInteger(usedBytes) ||
    usedBytes <= 0 ||
    usedBytes > pageBuffer.byteLength
  ) {
    throw new RangeError("A streamed Composite page used-byte count is invalid.");
  }
  if (
    !Number.isSafeInteger(expectedTokenCount) ||
    expectedTokenCount <= 0 ||
    expectedTokenCount > usedBytes
  ) {
    throw new RangeError("A streamed Composite page token count is invalid.");
  }
  const view = new DataView(pageBuffer);
  let cursor = 0;
  let decodedTokenCount = 0;
  const append = (type, value = undefined) => {
    appendDecodedStreamedJsonToken(
      builder,
      type,
      value
    );
    decodedTokenCount += 1;
  };
  while (cursor < usedBytes) {
    const code = view.getUint8(cursor);
    cursor += 1;
    if (code === STREAM_PAGE_TOKEN.object) {
      append("object");
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.array) {
      append("array");
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.end) {
      append("end");
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.keyString) {
      append("key-string");
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.endKey) {
      append("end-key");
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.scalarNull) {
      append("scalar", null);
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.scalarFalse) {
      append("scalar", false);
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.scalarTrue) {
      append("scalar", true);
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.scalarNumber) {
      if (cursor + 8 > usedBytes) {
        throw new TypeError("A streamed Composite page contains a truncated number.");
      }
      append("scalar", view.getFloat64(cursor, true));
      cursor += 8;
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.string) {
      append("string");
      continue;
    }
    if (code === STREAM_PAGE_TOKEN.endString) {
      append("end-string");
      continue;
    }
    if (
      code === STREAM_PAGE_TOKEN.key ||
      code === STREAM_PAGE_TOKEN.keyPart ||
      code === STREAM_PAGE_TOKEN.scalarString ||
      code === STREAM_PAGE_TOKEN.stringPart
    ) {
      const decoded = streamedPageString(
        view,
        cursor,
        usedBytes
      );
      cursor = decoded.cursor;
      append(
        code === STREAM_PAGE_TOKEN.key
          ? "key"
          : code === STREAM_PAGE_TOKEN.keyPart
            ? "key-part"
            : code === STREAM_PAGE_TOKEN.stringPart
              ? "string-part"
              : "scalar",
        decoded.value
      );
      continue;
    }
    throw new TypeError(
      `Unsupported streamed Composite page token '${code}'.`
    );
  }
  if (decodedTokenCount !== expectedTokenCount) {
    throw new TypeError(
      "A streamed Composite page token count does not match its envelope."
    );
  }
  if (builder.characterCount > MAX_STREAMED_JSON_CHARACTERS) {
    throw new RangeError("The streamed Composite snapshot exceeds its JSON safety limit.");
  }
  return decodedTokenCount;
}

function finishStreamedJsonBuilder(builder) {
  if (
    !builder.rootSet ||
    builder.stack.length !== 0 ||
    builder.stringParts ||
    builder.keyParts
  ) {
    throw new TypeError("The streamed Composite snapshot is incomplete.");
  }
  return builder.root;
}

function discardStreamedSnapshot(streamKey) {
  const snapshot = streamedSnapshots.get(streamKey);
  if (!snapshot) return false;
  if (snapshot.idleTimer !== null) {
    clearTimeout(snapshot.idleTimer);
  }
  streamedSnapshots.delete(streamKey);
  return true;
}

function armStreamedSnapshotTimeout(streamKey, snapshot) {
  if (snapshot.idleTimer !== null) {
    clearTimeout(snapshot.idleTimer);
  }
  snapshot.idleTimer = setTimeout(() => {
    if (streamedSnapshots.get(streamKey) === snapshot) {
      streamedSnapshots.delete(streamKey);
    }
  }, STREAMED_SNAPSHOT_IDLE_TIMEOUT_MS);
}

function clearStreamedSnapshots() {
  for (const streamKey of [...streamedSnapshots.keys()]) {
    discardStreamedSnapshot(streamKey);
  }
}

function installRetainedBaseline(key, baseline) {
  if (baseline.serializedLength > MAX_CANONICAL_BASELINE_CHARACTERS) {
    throw new RangeError("The canonical Saved Composite baseline exceeds its memory safety limit.");
  }
  const previous = baselineByIdentity.get(key);
  if (previous) {
    retainedBaselineCharacters -= previous.serializedLength;
    baselineByIdentity.delete(key);
  }
  let evictedBaselines = 0;
  while (
    baselineByIdentity.size >=
      SOFT_MAX_RETAINED_BASELINES ||
    (
      baselineByIdentity.size > 0 &&
      retainedBaselineCharacters +
        baseline.serializedLength >
        SOFT_RETAINED_BASELINE_CHARACTERS
    )
  ) {
    const oldestKey = baselineByIdentity.keys().next().value;
    if (oldestKey === undefined) break;
    const oldest = baselineByIdentity.get(oldestKey);
    retainedBaselineCharacters -= oldest.serializedLength;
    baselineByIdentity.delete(oldestKey);
    evictedBaselines += 1;
  }
  baselineByIdentity.set(key, baseline);
  retainedBaselineCharacters += baseline.serializedLength;
  return evictedBaselines;
}

function retainedBaseline(key) {
  const baseline = baselineByIdentity.get(key);
  if (!baseline) return null;

  baselineByIdentity.delete(key);
  baselineByIdentity.set(key, baseline);
  return baseline;
}

function dropRetainedBaseline(key) {
  const baseline = baselineByIdentity.get(key);
  if (!baseline) return false;
  retainedBaselineCharacters -= baseline.serializedLength;
  baselineByIdentity.delete(key);
  return true;
}

function identityKey(projectEpoch, compositeIdentity) {
  return `${typeof projectEpoch}:${String(projectEpoch)}\0${compositeIdentity}`;
}

function resultEnvelope(request, body) {
  return {
    type: RESULT_TYPE,
    moduleId: SAVED_API_COMPOSITE_COMPARE_WORKER_MODULE_ID,
    canonicalSchemaVersion: SAVED_API_COMPOSITE_CANONICAL_SCHEMA_VERSION,
    requestId: request?.requestId ?? null,
    projectEpoch: request?.projectEpoch ?? null,
    compositeIdentity: String(request?.compositeIdentity || ""),
    baselineIdentity: String(
      request?.baselineIdentity ||
      request?.compositeIdentity ||
      ""
    ),
    revision: request?.revision ?? null,
    ...body
  };
}

function staleResult(request, reason) {
  return resultEnvelope(request, {
    ok: false,
    stale: true,
    reason
  });
}

function validateEnvelope(request) {
  if (!request || typeof request !== "object") {
    throw new TypeError("Worker request must be an object.");
  }
  if (request.type !== MESSAGE_TYPE) {
    throw new TypeError(`Unsupported worker message type '${String(request.type)}'.`);
  }
  if (request.requestId === undefined || request.requestId === null) {
    throw new TypeError("Worker requestId is required.");
  }
  if (request.projectEpoch === undefined || request.projectEpoch === null) {
    throw new TypeError("Worker projectEpoch is required.");
  }
  if (!String(request.compositeIdentity || "").trim()) {
    throw new TypeError("Worker compositeIdentity is required.");
  }
  if (!Number.isSafeInteger(request.revision) || request.revision < 0) {
    throw new TypeError("Worker revision must be a non-negative safe integer.");
  }
}

function activateProjectEpoch(request) {
  activeProjectEpoch = request.projectEpoch;
  baselineByIdentity.clear();
  retainedBaselineCharacters = 0;
  latestRevisionByIdentity.clear();
  clearStreamedSnapshots();
  return resultEnvelope(request, {
    ok: true,
    stale: false,
    activated: true
  });
}

function executeCompositeOperation(
  request,
  operation,
  composite,
  baselineKey,
  startedAt,
  transport = "direct"
) {
  if (operation === "install-baseline") {
    const canonical = canonicalComposite(
      composite,
      request.normalizationPolicy
    );
    const baseline = {
      revision: request.revision,
      serialized: canonical.serialized,
      fingerprint: canonical.fingerprint,
      serializedLength: canonical.serializedLength,
      stats: canonical.stats
    };
    const evictedBaselines = installRetainedBaseline(
      baselineKey,
      baseline
    );
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      installed: true,
      evictedBaselines,
      retainedBaselineCharacters,
      transport,
      fingerprint: canonical.fingerprint,
      serializedLength: canonical.serializedLength,
      stats: canonical.stats,
      durationMs: performance.now() - startedAt
    });
  }

  if (operation === "fingerprint") {
    const canonical = canonicalComposite(
      composite,
      request.normalizationPolicy
    );
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      transport,
      fingerprint: canonical.fingerprint,
      serializedLength: canonical.serializedLength,
      stats: canonical.stats,
      durationMs: performance.now() - startedAt
    });
  }

  if (operation === "compare") {
    const baseline = retainedBaseline(baselineKey);
    if (!baseline) {
      return resultEnvelope(request, {
        ok: false,
        stale: false,
        reason: "baseline-not-installed",
        transport,
        durationMs: performance.now() - startedAt
      });
    }
    const candidate = canonicalComposite(
      composite,
      request.normalizationPolicy
    );
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      transport,


      equivalent: baseline.serialized === candidate.serialized,
      baselineRevision: baseline.revision,
      baselineFingerprint: baseline.fingerprint,
      candidateFingerprint: candidate.fingerprint,
      baselineSerializedLength: baseline.serializedLength,
      candidateSerializedLength: candidate.serializedLength,
      stats: candidate.stats,
      durationMs: performance.now() - startedAt
    });
  }
  throw new TypeError(
    `Unsupported streamed Composite target operation '${String(operation)}'.`
  );
}

function processRequest(request) {
  const startedAt = performance.now();
  validateEnvelope(request);
  if (request.operation === "activate-project-epoch") {
    return activateProjectEpoch(request);
  }
  if (activeProjectEpoch === undefined) {
    activeProjectEpoch = request.projectEpoch;
  }
  if (!Object.is(activeProjectEpoch, request.projectEpoch)) {
    return staleResult(request, "project-epoch-mismatch");
  }
  const key = identityKey(request.projectEpoch, request.compositeIdentity);
  const baselineIdentity = String(
    request.baselineIdentity || request.compositeIdentity
  ).trim();
  if (!baselineIdentity) {
    throw new TypeError("Worker baselineIdentity must be non-empty when supplied.");
  }
  const baselineKey = identityKey(request.projectEpoch, baselineIdentity);
  const latestRevision = latestRevisionByIdentity.get(key);
  if (latestRevision !== undefined && request.revision < latestRevision) {
    return staleResult(request, "superseded-revision");
  }
  if (latestRevision === undefined || request.revision > latestRevision) {
    for (const [snapshotKey, snapshot] of streamedSnapshots) {
      if (snapshot.identityKey === key && snapshot.revision < request.revision) {
        discardStreamedSnapshot(snapshotKey);
      }
    }
  }
  latestRevisionByIdentity.set(
    key,
    latestRevision === undefined
      ? request.revision
      : Math.max(latestRevision, request.revision)
  );

  const snapshotId = String(request.snapshotId || "").trim();
  const requireSnapshotId = () => {
    if (!snapshotId || snapshotId.length > 200) {
      throw new TypeError("A bounded streamed snapshotId is required.");
    }
    return streamedSnapshotKey(key, snapshotId);
  };

  if (request.operation === "begin-snapshot") {
    const streamKey = requireSnapshotId();
    if (!["install-baseline", "fingerprint", "compare"].includes(
      request.targetOperation
    )) {
      throw new TypeError(
        `Unsupported streamed Composite target operation '${String(request.targetOperation)}'.`
      );
    }



    for (const [activeKey, snapshot] of streamedSnapshots) {
      if (snapshot.identityKey === key) {
        discardStreamedSnapshot(activeKey);
      }
    }
    if (
      streamedSnapshots.size >=
        SOFT_MAX_ACTIVE_STREAMED_SNAPSHOTS
    ) {
      return resultEnvelope(request, {
        ok: false,
        stale: false,
        backpressure: true,
        reason: "stream-backpressure",
        retryAfterMs: 0,
        activeStreams: streamedSnapshots.size,
        durationMs: performance.now() - startedAt
      });
    }
    const snapshot = {
      identityKey: key,
      baselineKey,
      revision: request.revision,
      targetOperation: request.targetOperation,
      builder: createStreamedJsonBuilder(),
      nextPageSequence: 0,
      transport: null,
      idleTimer: null
    };
    streamedSnapshots.set(streamKey, snapshot);
    armStreamedSnapshotTimeout(streamKey, snapshot);
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      transport: "streamed",
      snapshotId,
      begun: true,
      durationMs: performance.now() - startedAt
    });
  }

  if (request.operation === "append-snapshot-page") {
    const streamKey = requireSnapshotId();
    const snapshot = streamedSnapshots.get(streamKey);
    if (
      !snapshot ||
      snapshot.revision !== request.revision ||
      snapshot.baselineKey !== baselineKey
    ) {
      return staleResult(request, "snapshot-not-active");
    }
    if (
      snapshot.transport &&
      snapshot.transport !== "transferable-pages"
    ) {
      discardStreamedSnapshot(streamKey);
      throw new TypeError(
        "A streamed Composite snapshot cannot mix transport encodings."
      );
    }
    if (
      request.pageEncodingVersion !==
        STREAM_PAGE_ENCODING_VERSION
    ) {
      discardStreamedSnapshot(streamKey);
      throw new TypeError(
        "A streamed Composite page uses an unsupported encoding version."
      );
    }
    if (
      !Number.isSafeInteger(request.pageSequence) ||
      request.pageSequence !== snapshot.nextPageSequence
    ) {
      discardStreamedSnapshot(streamKey);
      throw new TypeError(
        "A streamed Composite page arrived out of sequence."
      );
    }
    try {
      snapshot.transport = "transferable-pages";
      const acceptedTokens = appendStreamedJsonPage(
        snapshot.builder,
        request.pageBuffer,
        request.pageUsedBytes,
        request.pageTokenCount
      );
      snapshot.nextPageSequence += 1;
      armStreamedSnapshotTimeout(streamKey, snapshot);
      return resultEnvelope(request, {
        ok: true,
        stale: false,
        transport: "transferable-pages",
        snapshotId,
        pageEncodingVersion:
          STREAM_PAGE_ENCODING_VERSION,
        pageSequence: request.pageSequence,
        acceptedTokens,
        totalTokens: snapshot.builder.tokenCount,
        pageBuffer: request.pageBuffer,
        durationMs: performance.now() - startedAt
      });
    } catch (error) {
      discardStreamedSnapshot(streamKey);
      throw error;
    }
  }

  if (request.operation === "cancel-snapshot") {
    const streamKey = requireSnapshotId();
    const cancelled = discardStreamedSnapshot(streamKey);
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      transport: "streamed",
      snapshotId,
      cancelled,
      durationMs: performance.now() - startedAt
    });
  }

  if (request.operation === "finish-snapshot") {
    const streamKey = requireSnapshotId();
    const snapshot = streamedSnapshots.get(streamKey);
    if (
      !snapshot ||
      snapshot.revision !== request.revision ||
      snapshot.baselineKey !== baselineKey
    ) {
      return staleResult(request, "snapshot-not-active");
    }
    discardStreamedSnapshot(streamKey);
    const composite = finishStreamedJsonBuilder(snapshot.builder);
    return {
      ...executeCompositeOperation(
        request,
        snapshot.targetOperation,
        composite,
        baselineKey,
        startedAt,
        snapshot.transport || "streamed"
      ),
      snapshotId
    };
  }

  if (request.operation === "drop-baseline") {
    const dropped = dropRetainedBaseline(baselineKey);
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      dropped,
      durationMs: performance.now() - startedAt
    });
  }

  if (request.operation === "promote-baseline") {
    const sourceBaselineIdentity = String(
      request.sourceBaselineIdentity || ""
    ).trim();
    if (!sourceBaselineIdentity) {
      throw new TypeError(
        "Worker sourceBaselineIdentity is required when promoting a staged baseline."
      );
    }
    const sourceBaselineKey = identityKey(
      request.projectEpoch,
      sourceBaselineIdentity
    );
    const staged = retainedBaseline(
      sourceBaselineKey
    );
    if (!staged) {
      return resultEnvelope(request, {
        ok: false,
        stale: false,
        reason: "staged-baseline-not-installed"
      });
    }



    dropRetainedBaseline(sourceBaselineKey);
    const baseline = {
      ...staged,
      revision: request.revision
    };
    const evictedBaselines = installRetainedBaseline(
      baselineKey,
      baseline
    );
    return resultEnvelope(request, {
      ok: true,
      stale: false,
      promoted: true,
      installed: true,
      evictedBaselines,
      retainedBaselineCharacters,
      fingerprint: baseline.fingerprint,
      serializedLength: baseline.serializedLength,
      stats: baseline.stats,
      durationMs: performance.now() - startedAt
    });
  }

  if (["install-baseline", "fingerprint", "compare"].includes(request.operation)) {
    return executeCompositeOperation(
      request,
      request.operation,
      request.composite,
      baselineKey,
      startedAt
    );
  }

  throw new TypeError(
    `Unsupported Saved API Composite comparison operation '${String(request.operation)}'.`
  );
}

function processAndPostWorkerRequest(request) {
  const transferablePage =
    request.operation === "append-snapshot-page" &&
    request.pageBuffer &&
    Object.prototype.toString.call(request.pageBuffer) ===
      "[object ArrayBuffer]" &&
    request.pageBuffer.byteLength > 0
      ? request.pageBuffer
      : null;
  let result;
  try {
    result = processRequest(request);
  } catch (error) {
    result = resultEnvelope(request, {
      ok: false,
      stale: false,
      reason: "comparison-failed",
      error: error instanceof Error ? error.message : String(error)
    });
  }
  if (transferablePage) {
    if (result.pageBuffer !== transferablePage) {
      result = {
        ...result,
        pageBuffer: transferablePage
      };
    }
    self.postMessage(result, [transferablePage]);
    return;
  }
  self.postMessage(result);
}

function handleWorkerMessage(event) {
  const request = event?.data;
  if (request?.type !== MESSAGE_TYPE) return;
  processAndPostWorkerRequest(request);
}

self.addEventListener("message", handleWorkerMessage);



Object.defineProperty(self, "RMLSavedApiCompositeCompareWorker", {
  value: Object.freeze({
    moduleId: SAVED_API_COMPOSITE_COMPARE_WORKER_MODULE_ID,
    canonicalSchemaVersion: SAVED_API_COMPOSITE_CANONICAL_SCHEMA_VERSION,
    messageType: MESSAGE_TYPE,
    resultType: RESULT_TYPE,
    streamProtocol: Object.freeze({
      maxTokenStringLength: MAX_STREAM_TOKEN_STRING_LENGTH,
      pageEncodingVersion:
        STREAM_PAGE_ENCODING_VERSION,
      pageByteLength: STREAM_PAGE_BYTE_LENGTH,
      maxInFlightPages:
        STREAM_PAGE_MAX_IN_FLIGHT,
      maxActiveSnapshots:
        SOFT_MAX_ACTIVE_STREAMED_SNAPSHOTS,
      maximumSnapshotCharacters:
        MAX_STREAMED_JSON_CHARACTERS,
      maximumCanonicalBaselineCharacters:
        MAX_CANONICAL_BASELINE_CHARACTERS,
      softRetainedBaselineCharacters:
        SOFT_RETAINED_BASELINE_CHARACTERS,
      softMaximumRetainedBaselines:
        SOFT_MAX_RETAINED_BASELINES,
      idleTimeoutMs: STREAMED_SNAPSHOT_IDLE_TIMEOUT_MS,
      operations: Object.freeze([
        "begin-snapshot",
        "append-snapshot-page",
        "finish-snapshot",
        "cancel-snapshot"
      ]),
      tokenTypes: Object.freeze([
        "object",
        "array",
        "key",
        "key-string",
        "key-part",
        "end-key",
        "scalar",
        "string",
        "string-part",
        "end-string",
        "end"
      ])
    }),
    processRequest,
    canonicalize: canonicalComposite
  }),
  writable: false,
  configurable: true,
  enumerable: true
});
}

const savedApiCompositeCompareWorkerScope =
  typeof self !== "undefined"
    ? self
    : globalThis;
const savedApiCompositeCompareWorkerThread =
  typeof document === "undefined" &&
  typeof savedApiCompositeCompareWorkerScope
    ?.postMessage === "function" &&
  typeof savedApiCompositeCompareWorkerScope
    ?.addEventListener === "function";

if (savedApiCompositeCompareWorkerThread) {
  savedApiCompositeCompareWorkerMain(
    savedApiCompositeCompareWorkerScope
  );
} else if (
  savedApiCompositeCompareWorkerScope &&
  typeof savedApiCompositeCompareWorkerScope ===
    "object"
) {




  Object.defineProperty(
    savedApiCompositeCompareWorkerScope,
    "RMLSavedApiCompositeCompareWorkerBootstrap",
    {
      value: Object.freeze({
        moduleId:
          "1.20.31-universal-presentation-dev39-clean-stale-api-repair",
        canonicalSchemaVersion:
          4,
        source:
          `"use strict";\n(${savedApiCompositeCompareWorkerMain.toString()})(self);\n`
      }),
      writable: false,
      configurable: true,
      enumerable: true
    }
  );
}
