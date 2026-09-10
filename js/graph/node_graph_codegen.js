"use strict";

// Headless Runtime Graph validation and C# generation.

const EXTENSION_NAME = "typedNodeGraph";
const GRAPH_SCHEMA_VERSION = 33;
const GRAPH_STAGE_WIDTH = 5200;
const GRAPH_STAGE_HEIGHT = 3400;
const GRAPH_MIN_ZOOM = 0.005;
const GRAPH_MAX_ZOOM = 1.65;
const LEGACY_GRAPH_COORDINATE_LIMIT = 100000;
const GRAPH_COORDINATE_LIMIT = 250000000;
const CUSTOM_CSHARP_COORDINATE_SPACE_VERSION = 2;
const API_COMPOSITE_MAX_NESTING_DEPTH = 32;
const GRAPH_NODE_MIN_WIDTH = 120;
const GRAPH_NODE_MIN_HEIGHT = 96;
const GRAPH_NODE_MAX_WIDTH =
    GRAPH_STAGE_WIDTH - 120;

const GRAPH_NODE_MAX_HEIGHT =
    GRAPH_STAGE_HEIGHT - 120;

const GRAPH_INCREMENTAL_PRUNE_CONNECTION_LIMIT = 800;

function runtimeBehaviorIncludesStartup(
    reaction
  ) {
    return (
      reaction === "startup" ||
      reaction === "startup-saved"
    );
  }

function runtimeBehaviorIncludesSaved(
    reaction
  ) {
    return (
      reaction === "saved" ||
      reaction === "startup-saved"
    );
  }

function runtimeBehaviorEmitsImpulse(
    reaction
  ) {
    return (
      runtimeBehaviorIncludesStartup(
        reaction
      ) ||
      runtimeBehaviorIncludesSaved(
        reaction
      )
    );
  }

function customCSharpFilesForNodes(
    nodes,
    sourceFiles
  ) {
    const ownerIds = new Set(
      (Array.isArray(nodes) ? nodes : [])
        .filter(node =>
          node?.kind === "operator" &&
          node.operatorId === "csharp.file"
        )
        .map(node => String(node.id || ""))
        .filter(Boolean)
    );
    const source =
      sourceFiles &&
      typeof sourceFiles === "object" &&
      !Array.isArray(sourceFiles)
        ? sourceFiles
        : {};
    const result = {};
    for (const ownerId of ownerIds) {
      if (
        source[ownerId] &&
        typeof source[ownerId] === "object" &&
        !Array.isArray(source[ownerId])
      ) {
        result[ownerId] =
          cloneCustomCSharpFileGraph(
            ownerId,
            source[ownerId]
          );
      }
    }
    return result;
  }

function mergeCustomCSharpFileRegistry(
    target,
    source
  ) {
    const result =
      target &&
      typeof target === "object" &&
      !Array.isArray(target)
        ? target
        : {};
    if (
      !source ||
      typeof source !== "object" ||
      Array.isArray(source)
    ) {
      return result;
    }
    for (const [ownerId, customGraph] of
      Object.entries(source)) {
      if (
        customGraph &&
        typeof customGraph === "object" &&
        !Array.isArray(customGraph)
      ) {
        result[ownerId] =
          cloneCustomCSharpFileGraph(
            ownerId,
            customGraph
          );
      }
    }
    return result;
  }

function apiCompositeInternalDefinitionAllowed(
    definition
  ) {
    if (!definition) return false;
    if (
      definition.catalogGenerated === true ||
      definition.unavailableApiContract === true
    ) {
      return true;
    }
    if (
      definition.apiCompositeContainer === true ||
      definition.customCSharpSyntaxNode === true ||
      definition.customCSharpSubgraphOnly === true ||
      definition.customCSharpCatalogNode === true
    ) {
      return false;
    }
    if (
      definition.apiCompositeCustomCSharp ===
        true
    ) {
      return true;
    }
    if (
      definition.customCSharpNode === true
    ) {
      return false;
    }
    const group = String(
      definition.group || ""
    );
    return Boolean(
      group &&
      ![
        "Lifecycle",
        "Packed Configuration",
        "Project"
      ].includes(group)
    );
  }

function apiCompositeOwnedContainerAllowed(
    node,
    ownedGraphs
  ) {
    if (
      node?.kind !== "operator" ||
      node.operatorId !==
        "container.apiComposite"
    ) {
      return false;
    }
    const registry =
      ownedGraphs &&
      typeof ownedGraphs === "object" &&
      !Array.isArray(ownedGraphs)
        ? ownedGraphs
        : {};
    const owned = registry[node.id];
    return Boolean(
      owned &&
      typeof owned === "object" &&
      !Array.isArray(owned) &&
      Array.isArray(owned.nodes) &&
      Array.isArray(owned.connections)
    );
  }

let bridge = null;

let graph = null;

let customCSharpEditor = null;

let apiCompositeEditor = null;

let apiCompositeRootOperation = false;

let customCSharpRootOperation = false;

let currentAnalysis = null;

const GRAPH_ANALYSIS_CACHE_LIMIT = 4;

const GRAPH_ANALYSIS_CERTIFICATE_SCHEMA_VERSION = 1;

const graphAnalysisCache = new Map();

const graphAnalysisIdentityTokens = new WeakMap();

const trustedGraphAnalysisCertificates = new WeakSet();

let lastGraphAnalysisRecord = null;

let pendingGraphAnalysisCertificate = null;

let graphAnalysisCoreRunCount = 0;

let graphAnalysisAsyncRequestSequence = 0;

let lastPersistedGraphReference = null;

let graphCodegenRevision = 1;

let activeInteraction = null;

let graphStructuralPaintFrame = 0;

let graphStructuralCommitFrame = 0;

let graphNodeVirtualizationSignature = "";

let graphNodeVirtualizationAnchor = null;

let graphGpuOverviewMode = false;

const graphNodeGeometryCache = new Map();

const graphForcedNodeIds = new Set();

const graphSocketElementCache = new Map();

const graphSvgWirePathCache = new Map();

const graphSvgWirePointCache = new Map();

let graphNodeDefinitionCache = new WeakMap();

let graphNodeLookupCache = new Map();

let graphConnectionLookupCache = new Map();

let graphIncidentConnectionLookupCache = new Map();

let graphNodeLookupSource = null;

let graphConnectionLookupSource = null;

let graphNodeLookupLength = -1;

let graphConnectionLookupLength = -1;

function resetGraphRenderCaches({
    capturePresentation = true
  } = {}) {
    if (capturePresentation) {
      window.RMLCaptureGraphPresentationBeforeCacheReset?.();
    }
    if (graphStructuralPaintFrame) {
      cancelAnimationFrame(
        graphStructuralPaintFrame
      );
      graphStructuralPaintFrame = 0;
    }
    if (graphStructuralCommitFrame) {
      cancelAnimationFrame(
        graphStructuralCommitFrame
      );
      graphStructuralCommitFrame = 0;
    }
    currentAnalysis = null;
    graphNodeGeometryCache.clear();
    graphForcedNodeIds.clear();
    graphSocketElementCache.clear();
    graphSvgWirePathCache.clear();
    graphSvgWirePointCache.clear();
    graphNodeVirtualizationSignature = "";
    graphNodeVirtualizationAnchor = null;
    graphGpuOverviewMode = false;
    graphNodeDefinitionCache = new WeakMap();
    graphNodeLookupCache.clear();
    graphConnectionLookupCache.clear();
    graphIncidentConnectionLookupCache.clear();
    graphNodeLookupSource = null;
    graphConnectionLookupSource = null;
    graphNodeLookupLength = -1;
    graphConnectionLookupLength = -1;
    window.RMLResetGraphBoundaryTopologyCaches?.();
  }

function nodeGraphClone(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }

    return JSON.parse(
      JSON.stringify(value)
    );
  }

const customCSharpReopenCloneCapability = {};

function cloneCustomCSharpFileGraph(
    ownerId,
    customGraph
  ) {
    const cloned = nodeGraphClone(customGraph);
    try {
      if (
        typeof transportCustomCSharpReopenIdentity ===
          "function"
      ) {
        transportCustomCSharpReopenIdentity(
          ownerId,
          customGraph,
          cloned,
          customCSharpReopenCloneCapability
        );
      }
    } catch {
      // Clone transport is an optional, ephemeral optimization. A missing or
      // stale certificate must never prevent the durable graph clone.
    }
    return cloned;
  }

function nodeGraphClamp(
    value,
    minimum,
    maximum
  ) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }

function finiteNumber(
    value,
    fallback = 0
  ) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number
      : fallback;
  }

function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

function typeInfo(type) {
    return (
      TYPE_INFO[typeBase(type)] ||
      TYPE_INFO.generic
    );
  }

const COLLECT_LIST_TYPE_PREFIX =
    "collectList:";

function isCollectListType(type) {
    return (
      typeof type === "string" &&
      type.startsWith(
        COLLECT_LIST_TYPE_PREFIX
      )
    );
  }

function collectListTypeId(
    elementType
  ) {
    const normalized = String(
      elementType || ""
    ).trim();

    return normalized
      ? `${COLLECT_LIST_TYPE_PREFIX}${normalized}`
      : null;
  }

function exactGraphTypeInformationMatch(
    left,
    right
  ) {
    if (Object.is(left, right)) {
      return true;
    }
    if (
      Array.isArray(left) ||
      Array.isArray(right)
    ) {
      return Boolean(
        Array.isArray(left) &&
        Array.isArray(right) &&
        left.length === right.length &&
        left.every((value, index) =>
          exactGraphTypeInformationMatch(
            value,
            right[index]
          )
        )
      );
    }
    if (
      !left ||
      !right ||
      typeof left !== "object" ||
      typeof right !== "object"
    ) {
      return false;
    }
    const leftKeys =
      Object.keys(left).sort();
    const rightKeys =
      Object.keys(right).sort();
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every(
        (key, index) =>
          key === rightKeys[index] &&
          exactGraphTypeInformationMatch(
            left[key],
            right[key]
          )
      )
    );
  }

function canonicalCollectListTypeInformation(
    elementType
  ) {
    const normalized = String(
      elementType || ""
    ).trim();

    if (
      !normalized ||
      normalized === "impulse" ||
      normalized === "generic" ||
      normalized === "auto"
    ) {
      return null;
    }

    const id =
      collectListTypeId(
        normalized
      );
    const elementInformation =
      TYPE_INFO[typeBase(normalized)] ||
      TYPE_INFO.generic;
    const elementCsType =
      graphCsType(normalized);
    const assemblyReferences =
      graphTypeAssemblyReferences(
        normalized
      );
    const information = {
      label:
        `List<${typeLabel(normalized)}>`,
      short:
        `${elementInformation.short || "T"}[]`,
      color:
        elementInformation.color ||
        "#9da8b4",
      csType:
        `System.Collections.Generic.List<${elementCsType}>`,
      defaultCs:
        `new System.Collections.Generic.List<${elementCsType}>()`,
      referenceType: true,
      valueType: true,
      globalGenericCandidate: false,
      collectionType: true,
      collectorCollection: true,
      syntheticCollectionType: true,
      enumerableElementType:
        normalized,
      enumerableElementCsType:
        elementCsType,
      assignableTo: ["object"],
      constraints: [
        "reference",
        "serializable",
        "enumerable",
        "collectableCollection"
      ],
      assembly:
        elementInformation.assembly ||
        assemblyReferences[0]?.include ||
        "",
      assemblies:
        assemblyReferences.map(
          reference =>
            reference.include
        ),
      assemblyReferences
    };
    const normalizedAssemblyReferences =
      information.assemblyReferences
        .filter(reference =>
          reference &&
          typeof reference === "object" &&
          String(
            reference.include || ""
          ).trim()
        )
        .map(reference => ({
          include: String(
            reference.include || ""
          ).trim(),
          hintPath: String(
            reference.hintPath || ""
          ).trim(),
          private: reference.private === true
        }));
    const assemblies = [...new Set([
      ...information.assemblies,
      information.assembly
    ]
      .map(value =>
        String(value || "").trim()
      )
      .filter(Boolean))];

    return {
      label: information.label || id,
      short:
        information.short ||
        id.slice(0, 4).toUpperCase(),
      color:
        information.color || "#9da8b4",
      ...information,
      assemblies,
      assemblyReferences:
        normalizedAssemblyReferences
    };
  }

function isCanonicalSyntheticCollectorType(
    type,
    information
  ) {
    if (
      typeof type !== "string" ||
      type !== type.trim()
    ) {
      return false;
    }
    const id = type;
    if (!isCollectListType(id)) {
      return false;
    }
    const elementType =
      id.slice(
        COLLECT_LIST_TYPE_PREFIX.length
      );
    const expected =
      canonicalCollectListTypeInformation(
        elementType
      );
    return Boolean(
      expected &&
      String(
        information
          ?.enumerableElementType ||
        ""
      ).trim() === elementType &&
      exactGraphTypeInformationMatch(
        information,
        expected
      )
    );
  }

function ensureCollectListType(
    elementType
  ) {
    const normalized = String(
      elementType || ""
    ).trim();
    const id =
      collectListTypeId(
        normalized
      );
    const expected =
      canonicalCollectListTypeInformation(
        normalized
      );
    if (!id || !expected) {
      return null;
    }
    const existing =
      TYPE_INFO[id];

    if (existing) {
      const replaceableSyntheticCollector =
        existing.syntheticCollectionType ===
          true &&
        existing.collectorCollection ===
          true &&
        String(
          existing
            .enumerableElementType ||
          ""
        ).trim() === normalized;

      if (
        replaceableSyntheticCollector &&
        exactGraphTypeInformationMatch(
          existing,
          expected
        )
      ) {
        return id;
      }

      if (!replaceableSyntheticCollector) {
        throw new Error(
          `Graph type '${id}' already exists with a conflicting collection contract.`
        );
      }
    }

    registerGraphType(id, expected);

    return id;
  }

function typeLabel(type) {
    if (!type) {
      return "Unbound generic";
    }

    if (type.startsWith("enum:")) {
      return `Enum<${type.slice(5)}>`;
    }

    return typeInfo(type).label;
  }

const SCALAR_NUMERIC_TYPES = Object.freeze([
    "int",
    "float",
    "double"
  ]);

const NUMERIC_TYPE_RANK = Object.freeze({
    int: 0,
    float: 1,
    double: 2
  });

const GRAPH_INT32_MIN = -2147483648;

const GRAPH_INT32_MAX = 2147483647;

const GRAPH_FLOAT32_MAX = 3.4028234663852886e38;

function nodeGraphIsScalarNumericType(type) {
    return Object.hasOwn(
      NUMERIC_TYPE_RANK,
      type
    );
  }

function scalarNumericRank(type) {
    return nodeGraphIsScalarNumericType(type)
      ? NUMERIC_TYPE_RANK[type]
      : -1;
  }

function scalarNumericTypeAtRank(rank) {
    return SCALAR_NUMERIC_TYPES[
      nodeGraphClamp(
        Math.trunc(rank),
        0,
        SCALAR_NUMERIC_TYPES.length - 1
      )
    ];
  }

function canImplicitlyConvertScalarNumber(
    fromType,
    toType
  ) {
    return (
      nodeGraphIsScalarNumericType(fromType) &&
      nodeGraphIsScalarNumericType(toType) &&
      scalarNumericRank(fromType) <=
        scalarNumericRank(toType)
    );
  }

function promotedScalarNumericType(types) {
    const numeric = types.filter(
      nodeGraphIsScalarNumericType
    );

    if (numeric.length === 0) {
      return null;
    }

    return scalarNumericTypeAtRank(
      Math.max(
        ...numeric.map(
          scalarNumericRank
        )
      )
    );
  }

function definitionAllowsAutoType(
    definition
  ) {
    return Boolean(
      definition?.configurableTypeVar &&
      definition.allowAutoType !== false
    );
  }

function graphNumberText(value) {
    let text = String(value ?? "")
      .trim()
      .replace(/[fFdD]$/, "");

    if (
      /^[+-]?\d+,\d+(?:[eE][+-]?\d+)?$/.test(
        text
      )
    ) {
      text = text.replace(",", ".");
    }

    return text;
  }

function validateNumericValue(
    rawValue,
    type,
    options = {}
  ) {
    const coerce =
      options.coerce === true;
    const text =
      graphNumberText(rawValue);
    const pattern =
      /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

    if (!text || !pattern.test(text)) {
      return {
        valid: false,
        value: "0",
        number: 0,
        reason:
          "Enter one finite decimal number."
      };
    }

    let number = Number(text);

    if (!Number.isFinite(number)) {
      return {
        valid: false,
        value: "0",
        number: 0,
        reason:
          "The number must be finite."
      };
    }

    if (type === "int") {
      if (coerce) {
        number = nodeGraphClamp(
          Math.trunc(number),
          GRAPH_INT32_MIN,
          GRAPH_INT32_MAX
        );
      }

      if (
        !Number.isInteger(number) ||
        number < GRAPH_INT32_MIN ||
        number > GRAPH_INT32_MAX
      ) {
        return {
          valid: false,
          value: String(
            nodeGraphClamp(
              Math.trunc(number || 0),
              GRAPH_INT32_MIN,
              GRAPH_INT32_MAX
            )
          ),
          number,
          reason:
            "Integer values cannot contain decimal places and must fit in System.Int32."
        };
      }
    } else if (type === "float") {
      if (Math.abs(number) > GRAPH_FLOAT32_MAX) {
        return {
          valid: false,
          value: "0",
          number,
          reason:
            "The value is outside the System.Single range."
        };
      }
    } else if (type !== "double") {
      return {
        valid: false,
        value: "0",
        number,
        reason:
          `${typeLabel(type)} is not a scalar number type.`
      };
    }

    if (Object.is(number, -0)) {
      number = 0;
    }

    return {
      valid: true,
      value: String(number),
      number,
      reason: ""
    };
  }

function numericVectorInfo(type) {
    const match = String(type || "").match(
      /^(int|float|double)([234])$/
    );

    return match
      ? {
          scalarType: match[1],
          componentCount:
            Number(match[2])
        }
      : null;
  }

const AUTO_VECTOR_OPERATOR_IDS =
    Object.freeze([
      "vector.compose",
      "vector.decompose"
    ]);

function isAutoVectorOperator(
    node
  ) {
    return Boolean(
      node?.kind === "operator" &&
      AUTO_VECTOR_OPERATOR_IDS.includes(
        node.operatorId
      ) &&
      node.parameters?.valueType ===
        "auto"
    );
  }

function effectiveAutoVectorType(
    node
  ) {
    const configured =
      node?.parameters?.valueType;

    if (numericVectorInfo(configured)) {
      return configured;
    }

    const inferred =
      node?.parameters?.autoVectorType;

    if (numericVectorInfo(inferred)) {
      return inferred;
    }

    const definition =
      OPERATOR_DEFINITIONS[
        node?.operatorId
      ];
    const fallback =
      definition?.autoFallbackType ||
      fallbackTypeForDefinition(
        definition || {}
      );

    return numericVectorInfo(fallback)
      ? fallback
      : "float3";
  }

function vectorComponentIndex(
    portId
  ) {
    return ["x", "y", "z", "w"]
      .indexOf(
        String(portId || "")
          .toLowerCase()
      );
  }

function validateNumericVectorValue(
    rawValue,
    type,
    options = {}
  ) {
    const information =
      numericVectorInfo(type);

    if (!information) {
      return {
        valid: false,
        value: "0, 0",
        components: [],
        reason:
          `${typeLabel(type)} is not a supported numeric vector.`
      };
    }

    const rawComponents = String(rawValue ?? "")
      .split(",")
      .map(part => part.trim());

    if (
      rawComponents.length > information.componentCount &&
      options.coerce !== true
    ) {
      return {
        valid: false,
        value: String(rawValue ?? ""),
        components: [],
        reason:
          `${typeLabel(type)} accepts at most ${information.componentCount} components.`
      };
    }

    const components = rawComponents.slice(
      0,
      information.componentCount
    );

    while (components.length < information.componentCount) {
      components.push("0");
    }

    const normalized = [];

    for (const component of components) {
      const result = validateNumericValue(
        component || "0",
        information.scalarType,
        options
      );

      if (!result.valid) {
        return {
          valid: false,
          value: String(rawValue ?? ""),
          components: [],
          reason:
            `${typeLabel(type)}: ${result.reason}`
        };
      }

      normalized.push(result.value);
    }

    return {
      valid: true,
      value: normalized.join(", "),
      components: normalized,
      reason: ""
    };
  }

function fallbackTypeForDefinition(definition) {
    const allowed =
      definition?.configurableTypes ||
      VALUE_TYPES;
    const fallback =
      definition?.autoFallbackType ||
      (definition?.defaultType &&
       definition.defaultType !== "auto"
        ? definition.defaultType
        : allowed[0]);

    return allowed.includes(fallback)
      ? fallback
      : allowed[0] || "float";
  }

function normalizeGraphColorProfile(
    profile
  ) {
    return String(profile || "")
      .toLowerCase() === "srgb"
      ? "srgb"
      : "linear";
  }

function graphEditorFloatLiteral(
    value
  ) {
    const number =
      Number.isFinite(Number(value))
        ? Number(value)
        : 0;
    const text = String(number);

    return /[.eE]/.test(text)
      ? `${text}f`
      : `${text}.0f`;
  }

function graphColorXExpressionFromChannels(
    channels,
    profile = "linear",
    strength = 1
  ) {
    const safeStrength = nodeGraphClamp(
      Number(strength) || 1,
      1,
      10
    );
    const values =
      Array.isArray(channels)
        ? channels
        : [1, 1, 1, 1];
    const red =
      finiteNumber(values[0], 1) *
      safeStrength;
    const green =
      finiteNumber(values[1], 1) *
      safeStrength;
    const blue =
      finiteNumber(values[2], 1) *
      safeStrength;
    const alpha = nodeGraphClamp(
      finiteNumber(values[3], 1),
      0,
      1
    );
    const colorProfile =
      normalizeGraphColorProfile(profile) ===
        "srgb"
        ? "ColorProfile.sRGB"
        : "ColorProfile.Linear";

    return (
      "new colorX(new color(" +
      [red, green, blue, alpha]
        .map(graphEditorFloatLiteral)
        .join(", ") +
      `), ${colorProfile})`
    );
  }

function normalizeColorConstantParameters(
    parameters
  ) {
    if (!parameters) {
      return parameters;
    }

    let value = String(
      parameters.value ||
        "colorX.White"
    ).trim();
    const hasProfile =
      typeof parameters.colorProfile ===
        "string";
    const profileMatch =
      value.match(
        /ColorProfile\.(sRGB|Linear)/
      );
    let profile = hasProfile
      ? normalizeGraphColorProfile(
          parameters.colorProfile
        )
      : profileMatch?.[1] === "sRGB"
        ? "srgb"
        : "linear";
    const hasStrength =
      Number.isFinite(
        Number(
          parameters.colorStrength
        )
      );
    let strength = hasStrength
      ? nodeGraphClamp(
          Number(
            parameters.colorStrength
          ),
          1,
          10
        )
      : 1;

    if (/^#[0-9a-fA-F]{6,8}$/.test(value)) {
      const channels =
        previewColorChannels(value);

      if (!hasProfile) {
        profile = "srgb";
      }

      value =
        graphColorXExpressionFromChannels(
          channels,
          profile,
          strength
        );
    } else if (!hasStrength) {
      const channels =
        previewColorChannels(value);
      strength = nodeGraphClamp(
        Math.max(
          1,
          Math.abs(
            finiteNumber(channels[0], 0)
          ),
          Math.abs(
            finiteNumber(channels[1], 0)
          ),
          Math.abs(
            finiteNumber(channels[2], 0)
          )
        ),
        1,
        10
      );
    }

    parameters.value =
      value || "colorX.White";
    parameters.colorProfile =
      profile;
    parameters.colorStrength =
      strength;

    return parameters;
  }

function normalizeNodeParametersObject(
    parameters,
    definition,
    operatorId = "",
    coerce = true
  ) {
    if (
      !parameters ||
      typeof parameters !== "object" ||
      !definition
    ) {
      return parameters;
    }

    if (definition.configurableTypeVar) {
      const allowed =
        definition.configurableTypes ||
        VALUE_TYPES;
      const candidate = parameters.valueType;

      if (
        candidate === "auto" &&
        definitionAllowsAutoType(definition)
      ) {
        parameters.valueType = "auto";
      } else if (!allowed.includes(candidate)) {
        parameters.valueType =
          definition.defaultType === "auto" &&
          definitionAllowsAutoType(definition)
            ? "auto"
            : fallbackTypeForDefinition(definition);
      }
    }

    if (definition.parameterKind === "number") {
      const configured = parameters.valueType;
      const numericType = nodeGraphIsScalarNumericType(configured)
        ? configured
        : fallbackTypeForDefinition(definition);
      const result = validateNumericValue(
        parameters.value ?? "0",
        numericType,
        {
          coerce:
            coerce && configured !== "auto"
        }
      );

      parameters.value = result.valid
        ? result.value
        : validateNumericValue(
            parameters.value ?? "0",
            "double",
            { coerce: true }
          ).value;
    }

    if (operatorId === "constant.vector") {
      const configured = parameters.valueType;
      const vectorType = numericVectorInfo(configured)
        ? configured
        : fallbackTypeForDefinition(definition);
      const result = validateNumericVectorValue(
        parameters.components || "0, 0, 0",
        vectorType,
        {
          coerce:
            coerce && configured !== "auto"
        }
      );

      if (result.valid) {
        parameters.components = result.value;
      }
    }

    if (operatorId === "constant.color") {
      normalizeColorConstantParameters(
        parameters
      );
    }

    if (
      AUTO_VECTOR_OPERATOR_IDS.includes(
        operatorId
      )
    ) {
      if (parameters.valueType === "auto") {
        const fallback =
          definition.autoFallbackType ||
          fallbackTypeForDefinition(
            definition
          );

        parameters.autoVectorType =
          numericVectorInfo(
            parameters.autoVectorType
          )
            ? parameters.autoVectorType
            : numericVectorInfo(fallback)
              ? fallback
              : "float3";
      } else {
        delete parameters.autoVectorType;
      }
    }

    for (
      const specification of
      Array.isArray(definition.parameters)
        ? definition.parameters
        : []
    ) {
      if (
        !specification ||
        specification.kind !== "number" ||
        typeof specification.key !== "string"
      ) {
        continue;
      }

      const numericType =
        specification.integer === true ||
        specification.numericType === "int"
          ? "int"
          : specification.numericType === "float"
            ? "float"
            : "double";
      const result = validateNumericValue(
        parameters[specification.key] ??
          specification.default ?? 0,
        numericType,
        { coerce }
      );
      let number = result.number;

      if (Number.isFinite(Number(specification.min))) {
        number = Math.max(number, Number(specification.min));
      }
      if (Number.isFinite(Number(specification.max))) {
        number = Math.min(number, Number(specification.max));
      }
      if (numericType === "int") {
        number = Math.trunc(number);
      }

      parameters[specification.key] =
        specification.storeAsNumber === true
          ? number
          : String(number);
    }

    return parameters;
  }

function nodeAllowsConcreteType(
    node,
    definition,
    type
  ) {
    if (node?.operatorId === "constant.number") {
      return validateNumericValue(
        node.parameters?.value ?? "0",
        type,
        { coerce: false }
      ).valid;
    }

    if (node?.operatorId === "constant.vector") {
      return validateNumericVectorValue(
        node.parameters?.components || "0, 0, 0",
        type,
        { coerce: false }
      ).valid;
    }

    return true;
  }

function typeMatchesConstraint(
    type,
    constraint
  ) {
    if (!type) {
      return false;
    }

    const base = typeBase(type);
    const information =
      TYPE_INFO[base] || {};

    if (
      Array.isArray(
        information.constraints
      ) &&
      information.constraints.includes(
        constraint
      )
    ) {
      return true;
    }

    if (constraint === "enumOrString") {
        return (
            base === "string" ||
            base === "enum" ||
            String(type).startsWith("apiEnum:") ||
            information.enumType === true
        );
    }

    if (
      constraint === "value" ||
      constraint === "anyValue" ||
      constraint === "serializable"
    ) {
      return type !== "impulse";
    }

    if (constraint === "enumerable") {
      return Boolean(
        information.enumerableElementType
      );
    }

    if (constraint === "reference") {
      return Boolean(
        information.referenceType ||
        [
          "string",
          "Uri",
          "object"
        ].includes(base)
      );
    }

    if (
      constraint ===
        "reflectionMember"
    ) {
      return [
        "memberInfo",
        "methodInfo",
        "methodBase",
        "fieldInfo",
        "propertyInfo"
      ].includes(base);
    }

    if (
      constraint === "scalar" ||
      constraint === "ordered"
    ) {
      return [
        "int",
        "float",
        "double"
      ].includes(type);
    }

    if (constraint === "arithmetic") {
      return /^(?:int|float|double)(?:[234])?$/.test(
        type
      );
    }

    if (constraint === "interpolatable") {
      return [
        "float",
        "double",
        "float2",
        "float3",
        "float4",
        "double2",
        "double3",
        "double4",
        "colorX"
      ].includes(type);
    }

    return false;
  }

function connectionTypesCompatible(
    fromType,
    toType
  ) {
    if (customCSharpEditor) {
      return true;
    }
    if (!fromType || !toType) {
      return false;
    }

    if (fromType === toType) {
      return true;
    }

    if (
      canImplicitlyConvertScalarNumber(
        fromType,
        toType
      )
    ) {
      return true;
    }

    const fromBase = typeBase(fromType);
    const toBase = typeBase(toType);
    const fromInformation = TYPE_INFO[fromBase] || {};
    const toInformation = TYPE_INFO[toBase] || {};

    if (
      toBase === "object" &&
      fromType !== "impulse"
    ) {
      return true;
    }

    if (
      toInformation.acceptsAnyValue === true &&
      fromType !== "impulse"
    ) {
      return true;
    }

    if (
      Array.isArray(fromInformation.assignableTo) &&
      (
        fromInformation.assignableTo.includes(toType) ||
        fromInformation.assignableTo.includes(toBase)
      )
    ) {
      return true;
    }

    if (
      Array.isArray(toInformation.acceptsTypes) &&
      (
        toInformation.acceptsTypes.includes(fromType) ||
        toInformation.acceptsTypes.includes(fromBase)
      )
    ) {
      return true;
    }

    const fromCsType = String(
      fromInformation.csType || ""
    )
      .replace(/global::/g, "")
      .trim();
    const toCsType = String(
      toInformation.csType || ""
    )
      .replace(/global::/g, "")
      .trim();

    if (
      fromCsType &&
      toCsType &&
      fromCsType === toCsType
    ) {
      return true;
    }

    if (
      fromInformation.collectorCollection ===
        true
    ) {
      if (
        [
          "System.Collections.IEnumerable",
          "System.Collections.ICollection",
          "System.Collections.IList"
        ].includes(toCsType)
      ) {
        return true;
      }

      const genericCollectionInterface =
        toCsType.match(
          /^(?:System\.Collections\.Generic\.)?(IEnumerable|ICollection|IList|IReadOnlyCollection|IReadOnlyList)</
        );

      if (genericCollectionInterface) {
        const interfaceName =
          genericCollectionInterface[1];
        const fromElementType =
          enumerableElementType(
            fromType
          );
        const toElementType =
          enumerableElementType(
            toType
          );
        const covariant = [
          "IEnumerable",
          "IReadOnlyCollection",
          "IReadOnlyList"
        ].includes(interfaceName);

        if (
          fromElementType &&
          toElementType &&
          (
            covariant
              ? connectionTypesCompatible(
                  fromElementType,
                  toElementType
                )
              : fromElementType ===
                  toElementType
          )
        ) {
          return true;
        }
      }
    }

    return false;
  }

function enumerableElementType(type) {
    const information =
      TYPE_INFO[typeBase(type)] || {};
    const elementType =
      information.enumerableElementType;

    return typeof elementType === "string" &&
      elementType
        ? elementType
        : null;
  }

function genericCollectionRelationCompatible(
    relation,
    collectionType,
    itemType
  ) {
    const elementType =
      enumerableElementType(
        collectionType
      );

    if (!elementType || !itemType) {
      return false;
    }

    return relation?.exact === true
      ? elementType === itemType
      : connectionTypesCompatible(
          elementType,
          itemType
        );
  }

function defaultGraphState() {
    return {
      version: GRAPH_SCHEMA_VERSION,
      revision: 0,
      active: false,
      lastOpenPage: "configuration-outline",
      sourceSignature: "",
      showAdvancedNodes: false,
      configSnapshot: null,
      apiCompatibility: {
        schemaVersion: 1,
        history: []
      },
      integratedNodeCompatibility: null,
      customCSharpFiles: {},
      apiCompositeGraphs: {},
      nodes: [],
      connections: [],
      viewport: {
        x: 56,
        y: 54,
        scale: 0.9
      },
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
      selectedWirePoint: null,
      nextSequence: 1
    };
  }

function graphViewFrom(source) {
    return {
      nodes: Array.isArray(source?.nodes) ? source.nodes : [],
      connections: Array.isArray(source?.connections) ? source.connections : [],
      viewport: source?.viewport && typeof source.viewport === "object"
        ? source.viewport
        : { x: 56, y: 54, scale: 0.9 },
      selectedNodeId: source?.selectedNodeId || null,
      selectedNodeIds:
        Array.isArray(source?.selectedNodeIds)
          ? source.selectedNodeIds
          : source?.selectedNodeId
            ? [source.selectedNodeId]
            : [],
      selectedConnectionId: source?.selectedConnectionId || null,
      selectedWirePoint: source?.selectedWirePoint || null,
      nextSequence: Math.max(1, Math.trunc(finiteNumber(source?.nextSequence, 1)))
    };
  }

function applyGraphView(view) {
    if (!graph || !view) return;
    graph.nodes = view.nodes;
    graph.connections = view.connections;
    graph.viewport = view.viewport;
    graph.selectedNodeId = view.selectedNodeId;
    graph.selectedNodeIds =
      Array.isArray(view.selectedNodeIds)
        ? view.selectedNodeIds
        : view.selectedNodeId
          ? [view.selectedNodeId]
          : [];
    graph.selectedConnectionId = view.selectedConnectionId;
    graph.selectedWirePoint = view.selectedWirePoint;
    graph.nextSequence = view.nextSequence;
  }

function apiCompositeEditorChain(
    editor = apiCompositeEditor,
    {
      outermostFirst = false
    } = {}
  ) {
    const result = [];
    const visited = new Set();
    let current = editor || null;
    const limit = Math.max(
      1,
      Number(
        API_COMPOSITE_MAX_NESTING_DEPTH
      ) || 32
    ) + 1;
    while (
      current &&
      !visited.has(current) &&
      result.length < limit
    ) {
      visited.add(current);
      result.push(current);
      current =
        current.parentEditor ||
        current.parent ||
        null;
    }
    return outermostFirst
      ? result.reverse()
      : result;
  }

function apiCompositeEditorOwnerPath(
    editor = apiCompositeEditor
  ) {
    if (!editor) return [];
    const rawStored = Array.isArray(
      editor.ownerPath
    )
      ? editor.ownerPath
      : [];
    const stored = rawStored.map(value =>
      String(value || "").trim()
    );
    if (
      stored.some(value => !value) ||
      stored.length >
        API_COMPOSITE_MAX_NESTING_DEPTH
    ) {
      return [];
    }
    if (stored.length > 0) {
      return stored;
    }
    return apiCompositeEditorChain(
      editor,
      { outermostFirst: true }
    )
      .map(frame =>
        String(
          frame.containerNodeId || ""
        ).trim()
      )
      .filter(Boolean);
  }

function apiCompositeDocumentForOwnerPath(
    ownerPath
  ) {
    if (!graph) return null;
    const path = Array.isArray(ownerPath)
      ? ownerPath
      : [];
    if (
      path.length >
        API_COMPOSITE_MAX_NESTING_DEPTH
    ) {
      return null;
    }
    let documentValue = graph;
    const visitedDocuments = new WeakSet();
    visitedDocuments.add(documentValue);
    for (const rawOwnerId of path) {
      const ownerId = String(
        rawOwnerId || ""
      ).trim();
      const next =
        ownerId &&
        documentValue
          ?.apiCompositeGraphs?.[ownerId];
      if (
        !next ||
        typeof next !== "object" ||
        Array.isArray(next) ||
        visitedDocuments.has(next)
      ) {
        return null;
      }
      visitedDocuments.add(next);
      documentValue = next;
    }
    return documentValue;
  }

function apiCompositeParentDocumentForOwnerPath(
    ownerPath
  ) {
    const path = Array.isArray(ownerPath)
      ? ownerPath
      : [];
    if (path.length === 0) return null;
    return apiCompositeDocumentForOwnerPath(
      path.slice(0, -1)
    );
  }

function apiCompositeEditorDocument(
    editor = apiCompositeEditor
  ) {
    const ownerPath =
      apiCompositeEditorOwnerPath(editor);
    if (!editor || ownerPath.length === 0) {
      return null;
    }
    return apiCompositeDocumentForOwnerPath(
      ownerPath
    );
  }

function apiCompositeEditorCommitDocument(
    editor,
    composite
  ) {
    if (!editor || !composite || !graph) {
      return null;
    }
    const ownerPath =
      apiCompositeEditorOwnerPath(editor);
    const ownerId = String(
      ownerPath.at(-1) || ""
    );
    const parentDocument =
      apiCompositeParentDocumentForOwnerPath(
        ownerPath
      );
    if (
      !ownerId ||
      !parentDocument ||
      !parentDocument.apiCompositeGraphs ||
      typeof parentDocument
        .apiCompositeGraphs !== "object" ||
      Array.isArray(
        parentDocument.apiCompositeGraphs
      )
    ) {
      return null;
    }
    parentDocument.apiCompositeGraphs[
      ownerId
    ] = composite;
    return composite;
  }

function apiCompositeVisibleDocument() {
    return apiCompositeEditor
      ? apiCompositeEditorDocument()
      : graph;
  }

function activeGraphCustomCSharpFileRegistry({
    create = false
  } = {}) {
    // While a Custom C# graph is visible, `graph` is that graph's working
    // view; its registry belongs to the document containing the csharp.file
    // owner.  Using the visible canvas here made the Root case read/create a
    // registry on the Custom C# graph itself, while nested API Composite cases
    // happened to work through apiCompositeVisibleDocument().  The editor
    // already carries the exact owner-document identity, so use it for every
    // caller (capture, reopen certificates, Optimize/Open state and codegen).
    const customOwnerDocument =
      typeof customCSharpEditor !==
          "undefined" &&
        customCSharpEditor
        ? customCSharpEditor
            .openOwnerDocument || null
        : null;
    const documentValue =
      customOwnerDocument ||
      apiCompositeVisibleDocument();
    const existing =
      documentValue?.customCSharpFiles;
    if (
      existing &&
      typeof existing === "object" &&
      !Array.isArray(existing)
    ) {
      return existing;
    }
    if (!create || !documentValue) {
      return {};
    }
    documentValue.customCSharpFiles = {};
    return documentValue.customCSharpFiles;
  }

function apiCompositeVisibleOwnedGraph(
    ownerId
  ) {
    const documentValue =
      apiCompositeVisibleDocument();
    return documentValue
      ?.apiCompositeGraphs?.[
        String(ownerId || "")
      ] || null;
  }

function outermostApiCompositeEditor() {
    return apiCompositeEditorChain(
      apiCompositeEditor,
      { outermostFirst: true }
    )[0] || null;
  }

function captureCustomCSharpEditorView(
    options = {}
  ) {
    if (!customCSharpEditor || !graph) return null;
    const fileNodeId = String(
      customCSharpEditor.fileNodeId || ""
    );
    const compositeDocument = apiCompositeEditor
      ? apiCompositeEditorDocument(
          apiCompositeEditor
        )
      : null;
    const compositeOwner =
      compositeDocument?.nodes?.find(node =>
        node?.operatorId === "csharp.file" &&
        String(node.id || "") === fileNodeId
      ) || null;
    const ownerDocument = compositeOwner
      ? compositeDocument
      : null;
    const ownerRegistry =
      ownerDocument
        ? (
            ownerDocument.customCSharpFiles &&
            typeof ownerDocument
              .customCSharpFiles === "object" &&
            !Array.isArray(
              ownerDocument.customCSharpFiles
            )
              ? ownerDocument
                  .customCSharpFiles
              : null
          )
        : activeGraphCustomCSharpFileRegistry();
    const openPreparation =
      customCSharpEditor.openPreparation ||
      null;
    const preparedBase =
      openPreparation?.preparedGraph &&
      typeof restoreCustomCSharpOpenPreparation ===
        "function" &&
      restoreCustomCSharpOpenPreparation(
        openPreparation
      )
        ? openPreparation.preparedGraph
        : null;
    const existing =
      preparedBase ||
      ownerRegistry?.[fileNodeId] ||
      {};
    const commitCaptured = captured => {
      if (ownerDocument) {
        ownerDocument.customCSharpFiles =
          ownerDocument.customCSharpFiles &&
          typeof ownerDocument
            .customCSharpFiles === "object" &&
          !Array.isArray(
            ownerDocument.customCSharpFiles
          )
            ? ownerDocument.customCSharpFiles
            : {};
        ownerDocument.customCSharpFiles[
          fileNodeId
        ] = captured;
      } else {
        const rootRegistry =
          activeGraphCustomCSharpFileRegistry({
            create: true
          });
        rootRegistry[fileNodeId] =
          captured;
      }
      customCSharpEditor.openPreparation =
        null;
      customCSharpEditor.openStoredGraph =
        captured;
      customCSharpEditor.openOwnerSource =
        String(
          customCSharpEditor.openOwner
            ?.parameters?.source || ""
        );
      customCSharpEditor.openNodes =
        graph.nodes;
      customCSharpEditor.openConnections =
        graph.connections;
      customCSharpEditor.openContentRevision =
        typeof graphViewContentRevision ===
          "function"
          ? graphViewContentRevision(
              graph.nodes
            )
          : null;
      if (
        typeof customCSharpOpenPreparationViewState ===
          "function"
      ) {
        customCSharpEditor.openViewState =
          customCSharpOpenPreparationViewState();
      }
      return captured;
    };
    if (
      options.synchronizeSource === false
    ) {
      const captured = {
        ...existing,
        ...graphViewFrom(graph)
      };
      return commitCaptured(captured);
    }
    const captured = {
      ...existing,
      ...graphViewFrom(graph)
    };
    const rendered =
      existing.sourceEditedInInspector === true
        ? null
        : window.RMLVisualCSharp?.renderCustomCSharpGraph?.(captured);
    if (rendered && typeof rendered.source === "string") {
      captured.sourceEditedInInspector = false;
      captured.sourceHash =
        window.RMLVisualCSharp?.sourceHash?.(
          rendered.source
        ) || hashText(rendered.source);
      const visibleOwner =
        customCSharpEditor.mainView.nodes.find(
          node =>
            String(node?.id || "") === fileNodeId
        );

      const exactOwnerDocument =
        customCSharpEditor.openOwnerDocument ||
        ownerDocument;

      const owners = new Set([
        customCSharpEditor.openOwner,
        visibleOwner,
        compositeOwner
      ]);

      if (
        typeof customCSharpEditorNodeLocations ===
          "function"
      ) {
        for (const location of
          customCSharpEditorNodeLocations(fileNodeId)) {
          if (
            location.node ===
              customCSharpEditor.openOwner ||
            location.document === exactOwnerDocument
          ) {
            owners.add(location.node);
          }
        }
      }

      for (const owner of owners) {
        if (!owner) continue;

        owner.parameters =
          owner.parameters &&
          typeof owner.parameters === "object"
            ? owner.parameters
            : {};

        owner.parameters.source = rendered.source;
      }

      if (
        typeof synchronizeCustomCSharpInspectorValue ===
          "function"
      ) {
        synchronizeCustomCSharpInspectorValue(
          fileNodeId,
          "source",
          rendered.source
        );
      }
    }
    return commitCaptured(captured);
  }

function apiCompositeBoundaryRecords(
    value
  ) {
    const usedIds = new Set();
    const usedEndpoints = new Set();
    const result = [];

    for (const raw of
      Array.isArray(value) ? value : []) {
      const direction =
        raw?.direction === "output"
          ? "output"
          : raw?.direction === "input"
            ? "input"
            : "";
      const id = String(raw?.id || "")
        .trim()
        .slice(0, 160);
      const internalNodeId = String(
        raw?.internalNodeId || ""
      ).trim();
      const internalPortId = String(
        raw?.internalPortId || ""
      ).trim();
      const endpointKey =
        `${direction}\u0000${internalNodeId}\u0000${internalPortId}`;

      if (
        !direction ||
        !id ||
        !internalNodeId ||
        !internalPortId ||
        usedIds.has(id) ||
        usedEndpoints.has(endpointKey)
      ) {
        continue;
      }

      usedIds.add(id);
      usedEndpoints.add(endpointKey);
      result.push({
        id,
        direction,
        label: String(
          raw?.label || internalPortId
        ).slice(0, 160),
        type: String(raw?.type || "")
          .trim()
          .slice(0, 320),
        typeVar: String(
          raw?.typeVar || ""
        ).trim().slice(0, 120),
        constraint: String(
          raw?.constraint || "value"
        ).trim().slice(0, 120),
        autoExposed:
          raw?.autoExposed === true,
        internalNodeId,
        internalPortId
      });
    }

    return result;
  }

function sanitizeApiCompositeElementIdentity(
    value,
    {
      templateIdFallback = "",
      nodes = [],
      connections = [],
      boundaries = []
    } = {}
  ) {
    const source =
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
        ? value
        : {};
    const sourceNodes =
      source.nodes &&
      typeof source.nodes === "object" &&
      !Array.isArray(source.nodes)
        ? source.nodes
        : {};
    const sourceConnections =
      source.connections &&
      typeof source.connections === "object" &&
      !Array.isArray(source.connections)
        ? source.connections
        : {};
    const sourcePoints =
      source.points &&
      typeof source.points === "object" &&
      !Array.isArray(source.points)
        ? source.points
        : {};
    const sourceBoundaries =
      source.boundaries &&
      typeof source.boundaries === "object" &&
      !Array.isArray(source.boundaries)
        ? source.boundaries
        : {};
    const stableValue = value =>
      typeof value === "string"
        ? value.trim().slice(0, 360)
        : "";
    const uniqueValue = (
      requested,
      fallback,
      used
    ) => {
      let candidate =
        stableValue(requested) ||
        stableValue(fallback) ||
        "element";
      const base = candidate;
      let suffix = 2;
      while (used.has(candidate)) {
        const suffixText = `#${suffix}`;
        candidate =
          `${base.slice(0, Math.max(0, 360 - suffixText.length))}${suffixText}`;
        suffix += 1;
      }
      used.add(candidate);
      return candidate;
    };
    const result = {
      version: 1,
      templateId:
        stableValue(source.templateId)
          .slice(0, 180) ||
        stableValue(templateIdFallback)
          .slice(0, 180),
      nodes: {},
      connections: {},
      points: {},
      boundaries: {}
    };

    const usedNodes = new Set();
    for (const node of
      Array.isArray(nodes) ? nodes : []) {
      const nodeId = String(node?.id || "");
      if (!nodeId) continue;
      result.nodes[nodeId] = uniqueValue(
        sourceNodes[nodeId],
        `node:${nodeId}`,
        usedNodes
      );
    }

    const usedConnections = new Set();
    const usedPoints = new Set();
    for (const connection of
      Array.isArray(connections)
        ? connections
        : []) {
      const connectionId = String(
        connection?.id || ""
      );
      if (!connectionId) continue;
      const connectionStableId =
        uniqueValue(
          sourceConnections[connectionId],
          `connection:${connectionId}`,
          usedConnections
        );
      result.connections[connectionId] =
        connectionStableId;
      const pointSource =
        sourcePoints[connectionId] &&
        typeof sourcePoints[connectionId] ===
          "object" &&
        !Array.isArray(
          sourcePoints[connectionId]
        )
          ? sourcePoints[connectionId]
          : {};
      const pointMap = {};
      for (const point of
        Array.isArray(connection?.points)
          ? connection.points
          : []) {
        const pointId = String(
          point?.id || ""
        );
        if (!pointId) continue;
        pointMap[pointId] = uniqueValue(
          pointSource[pointId],
          `point:${connectionStableId}:${pointId}`,
          usedPoints
        );
      }
      result.points[connectionId] =
        pointMap;
    }

    const usedBoundaries = new Set();
    for (const boundary of
      apiCompositeBoundaryRecords(
        boundaries
      )) {
      const boundaryKey =
        `${boundary.direction}\u0000${boundary.id}`;
      result.boundaries[boundaryKey] =
        uniqueValue(
          sourceBoundaries[boundaryKey],
          `boundary:${boundary.direction}:${boundary.id}`,
          usedBoundaries
        );
    }
    return result;
  }

function apiCompositeBoundaryEndpointKey(
    boundary
  ) {
    return `${String(boundary?.direction || "")}\u0000${String(boundary?.internalNodeId || "")}\u0000${String(boundary?.internalPortId || "")}`;
  }

function apiCompositePortHasInternalWire(
    boundary
  ) {
    return apiCompositePortHasInternalWireInDocument(
      graph,
      boundary
    );
  }

function apiCompositePortHasInternalWireInDocument(
    documentValue,
    boundary
  ) {
    return (
      Array.isArray(documentValue?.connections)
        ? documentValue.connections
        : []
    ).some(connection =>
      boundary.direction === "input"
        ? connection.toNode ===
            boundary.internalNodeId &&
          connection.toPort ===
            boundary.internalPortId
        : connection.fromNode ===
            boundary.internalNodeId &&
          connection.fromPort ===
          boundary.internalPortId
    );
  }

function nextApiCompositeBoundaryId(
    direction,
    boundaries
  ) {
    const prefix =
      direction === "input"
        ? "input"
        : "output";
    const used = new Set(
      boundaries.map(boundary =>
        String(boundary.id || "")
      )
    );
    let index = 1;
    while (used.has(`${prefix}-${index}`)) {
      index += 1;
    }
    return `${prefix}-${index}`;
  }

function forwardedApiCompositeBoundary(
    owner,
    boundary,
    boundaries
  ) {
    return {
      id: nextApiCompositeBoundaryId(
        boundary.direction,
        boundaries
      ),
      direction: boundary.direction,
      label: `${String(
        owner?.label ||
        owner?.parameters?.title ||
        "API Composite"
      )} · ${String(
        boundary.label || boundary.id
      )}`.slice(0, 160),
      type: String(
        boundary.type || ""
      ).slice(0, 320),
      typeVar: String(
        boundary.typeVar || ""
      ).slice(0, 120),
      constraint: String(
        boundary.constraint || "value"
      ).slice(0, 120),
      autoExposed: true,
      internalNodeId: String(
        owner?.id || ""
      ),
      internalPortId: boundary.id
    };
  }

function apiCompositeBoundaryPortSpecification(
    documentValue,
    boundary
  ) {
    const node = (
      Array.isArray(documentValue?.nodes)
        ? documentValue.nodes
        : []
    ).find(candidate =>
      String(candidate?.id || "") ===
        String(boundary?.internalNodeId || "")
    );
    if (!node) return null;

    if (
      node.operatorId ===
        "container.apiComposite"
    ) {
      const nestedBoundary =
        apiCompositeBoundaryRecords(
          node.parameters?.boundaryPorts
        ).find(candidate =>
          candidate.direction ===
            boundary.direction &&
          candidate.id ===
            boundary.internalPortId
        );
      return nestedBoundary
        ? {
            id: nestedBoundary.id,
            label: nestedBoundary.label,
            type: nestedBoundary.type,
            typeVar:
              nestedBoundary.typeVar,
            constraint:
              nestedBoundary.constraint
          }
        : null;
    }

    const definition = nodeDefinition(node);
    const definitionSpecifications =
      boundary.direction === "output"
        ? definition?.outputs || []
        : definition?.inputs || [];
    const currentSpecification =
      definitionSpecifications.find(
        specification =>
          specification.id ===
            boundary.internalPortId
      );
    if (currentSpecification) {
      return currentSpecification;
    }

    // A real current definition is authoritative. Its missing port means the
    // contract no longer publishes that endpoint; an older portable contract
    // on the node must never resurrect it as a ghost Composite boundary.
    // The stored fallback is only for a definition that is genuinely absent
    // or for the deliberately registered offline/unavailable placeholder.
    if (
      definition &&
      definition.unavailableApiContract !==
        true
    ) {
      return null;
    }

    // A locally restored project can be opened before its catalog-generated
    // definitions have been rebuilt. The portable contract saved on the node
    // is authoritative enough to preserve the existing Composite boundary
    // until the normal, confirmed catalog-replacement flow can run. Without
    // this fallback, sanitizing an offline graph would destructively remove a
    // valid exposed boundary simply because the live registry is not ready.
    const storedContract =
      node.apiContract &&
      typeof node.apiContract === "object" &&
      !Array.isArray(node.apiContract)
        ? node.apiContract
        : definition?.preservedApiContract;
    const storedPortValues =
      boundary.direction === "output"
        ? storedContract?.outputPorts
        : storedContract?.inputPorts;
    const storedSpecifications =
      Array.isArray(storedPortValues)
        ? storedPortValues
        : [];
    return storedSpecifications.find(
      specification =>
        String(specification?.id || "") ===
          String(
            boundary.internalPortId || ""
          )
    ) || null;
  }

function apiCompositeExpandedConnectionRemovalIds(
    connections,
    connectionIds,
    branchRouting = null
  ) {
    const list = Array.isArray(connections)
      ? connections
      : [];
    const removed = new Set(
      Array.isArray(connectionIds) ||
      connectionIds instanceof Set
        ? connectionIds
        : [connectionIds]
    );
    removed.delete("");
    removed.delete(null);
    removed.delete(undefined);

    const childrenByConnectionId = new Map();
    const availableConnectionIds = new Set(
      list.map(connection =>
        String(connection?.id || "")
      )
    );
    for (const connection of list) {
      const parentId =
        connection?.branchFrom?.connectionId;
      if (!parentId) continue;
      const children =
        childrenByConnectionId.get(parentId) ||
        [];
      children.push(connection.id);
      childrenByConnectionId.set(
        parentId,
        children
      );
    }
    if (
      branchRouting &&
      typeof branchRouting === "object" &&
      !Array.isArray(branchRouting)
    ) {
      for (const [childId, branch] of
        Object.entries(branchRouting)) {
        const parentId = String(
          branch?.connectionId || ""
        );
        if (
          !parentId ||
          !childId ||
          !availableConnectionIds.has(
            childId
          )
        ) {
          continue;
        }
        const children =
          childrenByConnectionId.get(
            parentId
          ) || [];
        if (!children.includes(childId)) {
          children.push(childId);
        }
        childrenByConnectionId.set(
          parentId,
          children
        );
      }
    }

    const queue = [...removed];
    for (
      let index = 0;
      index < queue.length;
      index += 1
    ) {
      for (const childId of
        childrenByConnectionId.get(
          queue[index]
        ) || []) {
        if (removed.has(childId)) continue;
        removed.add(childId);
        queue.push(childId);
      }
    }
    return removed;
  }

function apiCompositeRemoveConnectionsFromDocument(
    documentValue,
    connectionIds
  ) {
    const connections =
      Array.isArray(documentValue?.connections)
        ? documentValue.connections
        : [];
    const removed =
      apiCompositeExpandedConnectionRemovalIds(
        connections,
        connectionIds,
        documentValue?.branchRouting
      );
    if (removed.size === 0) return removed;

    const retained = connections.filter(
      connection =>
        !removed.has(connection.id)
    );
    connections.splice(
      0,
      connections.length,
      ...retained
    );
    normalizeConnectionRouting(connections);

    if (
      removed.has(
        documentValue.selectedConnectionId
      )
    ) {
      documentValue.selectedConnectionId =
        null;
    }
    if (
      removed.has(
        documentValue.selectedWirePoint
          ?.connectionId
      )
    ) {
      documentValue.selectedWirePoint = null;
    }

    const availableById = new Map(
      connections.map(connection => [
        connection.id,
        connection
      ])
    );
    if (
      documentValue.branchRouting &&
      typeof documentValue.branchRouting ===
        "object" &&
      !Array.isArray(
        documentValue.branchRouting
      )
    ) {
      for (const [connectionId, branch] of
        Object.entries(
          documentValue.branchRouting
        )) {
        const parent = availableById.get(
          branch?.connectionId
        );
        if (
          !availableById.has(connectionId) ||
          !parent ||
          !(parent.points || []).some(point =>
            point.id === branch?.pointId
          )
        ) {
          delete documentValue.branchRouting[
            connectionId
          ];
        }
      }
    }
    return removed;
  }

function apiCompositeRemoveInvalidOwnerConnections(
    parentDocument,
    ownerId,
    boundaries
  ) {
    const inputs = new Set();
    const outputs = new Set();
    for (const boundary of
      apiCompositeBoundaryRecords(boundaries)) {
      (
        boundary.direction === "output"
          ? outputs
          : inputs
      ).add(boundary.id);
    }
    const invalidIds = (
      Array.isArray(parentDocument?.connections)
        ? parentDocument.connections
        : []
    ).filter(connection =>
      (
        connection.fromNode === ownerId &&
        !outputs.has(connection.fromPort)
      ) ||
      (
        connection.toNode === ownerId &&
        !inputs.has(connection.toPort)
      )
    ).map(connection => connection.id);
    return apiCompositeRemoveConnectionsFromDocument(
      parentDocument,
      invalidIds
    );
  }

function apiCompositeBoundaryListsEqual(
    first,
    second
  ) {
    return JSON.stringify(
      apiCompositeBoundaryRecords(first)
    ) === JSON.stringify(
      apiCompositeBoundaryRecords(second)
    );
  }

function reconcileApiCompositeBoundaryTree(
    rootDocument,
    options = {}
  ) {
    const invalidateCaches =
      options.invalidateCaches !== false;
    const statistics = {
      addedBoundaries: 0,
      removedBoundaries: 0,
      disconnectedWires: 0,
      disconnectedConnectionIds: [],
      synchronizedOwners: 0
    };
    const disconnectedConnectionIds =
      new Set();
    if (
      !rootDocument ||
      typeof rootDocument !== "object" ||
      Array.isArray(rootDocument)
    ) {
      return statistics;
    }

    const requestedChangedOwnerPath =
      Array.isArray(
        options.changedOwnerPath
      )
        ? options.changedOwnerPath.map(value =>
            String(value || "").trim()
          )
        : null;
    const targetedPath =
      requestedChangedOwnerPath &&
      requestedChangedOwnerPath.every(Boolean) &&
      requestedChangedOwnerPath.length <=
        API_COMPOSITE_MAX_NESTING_DEPTH &&
      apiCompositeHierarchyContextAtOwnerPath(
        rootDocument,
        requestedChangedOwnerPath
      )
        ? requestedChangedOwnerPath
        : null;

    const stack = new WeakSet();
    const visit = (
      documentValue,
      depth,
      isRoot,
      pathIndex = 0
    ) => {
      if (
        depth >
          API_COMPOSITE_MAX_NESTING_DEPTH
      ) {
        throw new Error(
          `API Composite nesting exceeds the safe depth limit of ${API_COMPOSITE_MAX_NESTING_DEPTH}.`
        );
      }
      if (stack.has(documentValue)) {
        throw new Error(
          "API Composite nesting contains a cycle."
        );
      }
      stack.add(documentValue);
      try {
        const nodes =
          Array.isArray(documentValue.nodes)
            ? documentValue.nodes
            : [];
        const registry =
          documentValue.apiCompositeGraphs &&
          typeof documentValue
            .apiCompositeGraphs === "object" &&
          !Array.isArray(
            documentValue.apiCompositeGraphs
          )
            ? documentValue.apiCompositeGraphs
            : {};
        const candidateBoundaries = isRoot
          ? []
          : apiCompositeBoundaryRecords(
              documentValue.boundaryPorts
            );
        const candidateBoundaryEndpoints =
          new Set(
            candidateBoundaries.map(
              apiCompositeBoundaryEndpointKey
            )
          );

        const ownerNodes = targetedPath
          ? pathIndex < targetedPath.length
            ? nodes.filter(node =>
                node?.operatorId ===
                  "container.apiComposite" &&
                String(node.id || "") ===
                  targetedPath[pathIndex]
              )
            : []
          : nodes;

        for (const owner of ownerNodes) {
          if (
            owner?.operatorId !==
              "container.apiComposite"
          ) {
            continue;
          }
          const child = registry[owner.id];
          if (
            !child ||
            typeof child !== "object" ||
            Array.isArray(child)
          ) {
            owner.parameters =
              owner.parameters &&
              typeof owner.parameters ===
                "object" &&
              !Array.isArray(owner.parameters)
                ? owner.parameters
                : {};
            if (
              !Array.isArray(
                owner.parameters.boundaryPorts
              ) ||
              apiCompositeBoundaryRecords(
                owner.parameters.boundaryPorts
              ).length > 0 ||
              Number(
                owner.parameters.memberCount || 0
              ) !== 0
            ) {
              statistics.synchronizedOwners +=
                1;
            }
            owner.parameters.boundaryPorts = [];
            owner.parameters.memberCount = 0;
            const removed =
              apiCompositeRemoveInvalidOwnerConnections(
                documentValue,
                owner.id,
                []
              );
            statistics.disconnectedWires +=
              removed.size;
            for (const connectionId of removed) {
              disconnectedConnectionIds.add(
                connectionId
              );
            }
            continue;
          }
          const visitChild = Boolean(
            !targetedPath ||
            (
              pathIndex < targetedPath.length &&
              String(owner.id || "") ===
                targetedPath[pathIndex]
            )
          );
          if (visitChild) {
            visit(
              child,
              depth + 1,
              false,
              pathIndex + 1
            );
          }

          const childBoundaries =
            apiCompositeBoundaryRecords(
              child.boundaryPorts
            );
          if (visitChild) {
            child.boundaryPorts =
              childBoundaries;
          }
          owner.parameters =
            owner.parameters &&
            typeof owner.parameters ===
              "object" &&
            !Array.isArray(owner.parameters)
              ? owner.parameters
              : {};
          if (
            !apiCompositeBoundaryListsEqual(
              owner.parameters.boundaryPorts,
              childBoundaries
            )
          ) {
            statistics.synchronizedOwners += 1;
          }
          owner.parameters.boundaryPorts =
            nodeGraphClone(childBoundaries);
          owner.parameters.memberCount =
            Array.isArray(child.nodes)
              ? child.nodes.length
              : 0;

          // Every real child contract remains published through every
          // unconnected ancestor. This also repairs partially stored chains
          // and restores the outer contract after an internal wire is
          // removed; user wires are deliberately never recreated.
          if (!isRoot) {
            for (const childBoundary of
              childBoundaries) {
              const endpoint = {
                direction:
                  childBoundary.direction,
                internalNodeId: owner.id,
                internalPortId:
                  childBoundary.id
              };
              const endpointKey =
                apiCompositeBoundaryEndpointKey(
                  endpoint
                );
              if (
                candidateBoundaryEndpoints.has(
                  endpointKey
                ) ||
                apiCompositePortHasInternalWireInDocument(
                  documentValue,
                  endpoint
                )
              ) {
                continue;
              }
              const forwarded =
                forwardedApiCompositeBoundary(
                  owner,
                  childBoundary,
                  candidateBoundaries
                );
              candidateBoundaries.push(
                forwarded
              );
              candidateBoundaryEndpoints.add(
                endpointKey
              );
              statistics.addedBoundaries += 1;
            }
          }

          const removed =
            apiCompositeRemoveInvalidOwnerConnections(
              documentValue,
              owner.id,
              childBoundaries
            );
          statistics.disconnectedWires +=
            removed.size;
          for (const connectionId of removed) {
            disconnectedConnectionIds.add(
              connectionId
            );
          }
        }

        if (!isRoot) {
          const sourceBoundaries =
            candidateBoundaries;
          const boundaries = [];
          for (const boundary of
            sourceBoundaries) {
            const specification =
              apiCompositeBoundaryPortSpecification(
                documentValue,
                boundary
              );
            if (
              !specification ||
              apiCompositePortHasInternalWireInDocument(
                documentValue,
                boundary
              )
            ) {
              statistics.removedBoundaries +=
                1;
              continue;
            }
            boundaries.push({
              ...boundary,
              label: String(
                boundary.label ||
                specification.label ||
                boundary.internalPortId
              ).slice(0, 160),
              type: String(
                specification.type ||
                boundary.type ||
                ""
              ).slice(0, 320),
              typeVar:
                specification.type
                  ? ""
                  : String(
                      specification.typeVar ||
                      boundary.typeVar ||
                      ""
                    ).slice(0, 120),
              constraint: String(
                specification.constraint ||
                boundary.constraint ||
                "value"
              ).slice(0, 120)
            });
          }
          documentValue.boundaryPorts =
            boundaries;
          documentValue.elementIdentity =
            sanitizeApiCompositeElementIdentity(
              documentValue.elementIdentity,
              {
                templateIdFallback:
                  documentValue.elementIdentity
                    ?.templateId || "",
                nodes,
                connections:
                  documentValue.connections,
                boundaries
              }
            );
        }

        normalizeConnectionRouting(
          Array.isArray(documentValue.connections)
            ? documentValue.connections
            : []
        );
      } finally {
        stack.delete(documentValue);
      }
    };

    visit(rootDocument, 0, true, 0);
    statistics.disconnectedConnectionIds =
      [...disconnectedConnectionIds];
    if (
      invalidateCaches &&
      (
        statistics.addedBoundaries > 0 ||
        statistics.removedBoundaries > 0 ||
        statistics.disconnectedWires > 0 ||
        statistics.synchronizedOwners > 0
      )
    ) {
      graphNodeDefinitionCache = new WeakMap();
      graphNodeGeometryCache.clear();
      graphSocketElementCache.clear();
      graphSvgWirePathCache.clear();
      graphSvgWirePointCache.clear();
      currentAnalysis = null;
      window.RMLResetGraphBoundaryTopologyCaches?.();
    }
    return statistics;
  }

function apiCompositeHierarchyContexts(
    rootDocument
  ) {
    const contexts = new WeakMap();
    const stack = new WeakSet();
    const rootContext = {
      document: rootDocument,
      owner: null,
      parentDocument: null,
      parentContext: null,
      depth: 0
    };
    const visit = context => {
      if (
        !context.document ||
        typeof context.document !== "object" ||
        Array.isArray(context.document) ||
        stack.has(context.document) ||
        context.depth >
          API_COMPOSITE_MAX_NESTING_DEPTH
      ) {
        return;
      }
      stack.add(context.document);
      contexts.set(
        context.document,
        context
      );
      const registry =
        context.document.apiCompositeGraphs &&
        typeof context.document
          .apiCompositeGraphs === "object" &&
        !Array.isArray(
          context.document.apiCompositeGraphs
        )
          ? context.document.apiCompositeGraphs
          : {};
      for (const owner of
        Array.isArray(context.document.nodes)
          ? context.document.nodes
          : []) {
        if (
          owner?.operatorId !==
            "container.apiComposite"
        ) {
          continue;
        }
        const child = registry[owner.id];
        if (!child || stack.has(child)) {
          continue;
        }
        visit({
          document: child,
          owner,
          parentDocument: context.document,
          parentContext: context,
          depth: context.depth + 1
        });
      }
      stack.delete(context.document);
    };
    visit(rootContext);
    return contexts;
  }

function apiCompositeHierarchyContextAtOwnerPath(
    rootDocument,
    ownerPath
  ) {
    if (
      !rootDocument ||
      typeof rootDocument !== "object" ||
      Array.isArray(rootDocument)
    ) {
      return null;
    }
    const path = Array.isArray(ownerPath)
      ? ownerPath.map(value =>
          String(value || "").trim()
        )
      : [];
    if (
      path.some(value => !value) ||
      path.length >
        API_COMPOSITE_MAX_NESTING_DEPTH
    ) {
      return null;
    }
    let context = {
      document: rootDocument,
      owner: null,
      parentDocument: null,
      parentContext: null,
      depth: 0
    };
    const visited = new WeakSet();
    visited.add(rootDocument);
    for (const ownerId of path) {
      const owner = (
        Array.isArray(
          context.document.nodes
        )
          ? context.document.nodes
          : []
      ).find(node =>
        String(node?.id || "") ===
          ownerId &&
        node?.operatorId ===
          "container.apiComposite"
      );
      const child =
        context.document
          .apiCompositeGraphs?.[
            ownerId
          ];
      if (
        !owner ||
        !child ||
        typeof child !== "object" ||
        Array.isArray(child) ||
        visited.has(child)
      ) {
        return null;
      }
      visited.add(child);
      context = {
        document: child,
        owner,
        parentDocument:
          context.document,
        parentContext: context,
        depth: context.depth + 1
      };
    }
    return context;
  }

function apiCompositeContextOwnerPath(
    context
  ) {
    const result = [];
    let current = context;
    while (current?.owner) {
      const ownerId = String(
        current.owner.id || ""
      );
      if (!ownerId) return [];
      result.push(ownerId);
      current = current.parentContext;
    }
    return result.reverse();
  }

function apiCompositeDocumentAtOwnerPath(
    rootDocument,
    ownerPath
  ) {
    let current = rootDocument;
    for (const ownerId of
      Array.isArray(ownerPath)
        ? ownerPath
        : []) {
      current =
        current?.apiCompositeGraphs?.[
          ownerId
        ] || null;
      if (!current) return null;
    }
    return current;
  }

function apiCompositeBoundaryIdentityKey(
    boundary
  ) {
    return `${String(
      boundary?.direction || ""
    )}\u0000${String(boundary?.id || "")}`;
  }

function apiCompositeUnusedBoundaryChainPlan(
    rootDocument,
    sourceComposite,
    internalNodeId,
    options = {}
  ) {
    const result = {
      sourceBoundaries: [],
      removals: [],
      blockedAtInternalWire: 0,
      blockedAtOuterWire: 0,
      sourceOwnerPath: []
    };
    const requestedOwnerPath =
      Array.isArray(
        options.sourceOwnerPath
      )
        ? options.sourceOwnerPath
        : null;
    const sourceContext =
      requestedOwnerPath
        ? apiCompositeHierarchyContextAtOwnerPath(
            rootDocument,
            requestedOwnerPath
          )
        : apiCompositeHierarchyContexts(
            rootDocument
          ).get(sourceComposite);
    if (!sourceContext?.owner) {
      return result;
    }
    if (
      sourceContext.document !==
        sourceComposite
    ) {
      return result;
    }
    result.sourceOwnerPath =
      apiCompositeContextOwnerPath(
        sourceContext
      );
    const nodeId = String(
      internalNodeId || ""
    );
    const removalKeysByDocument =
      new Map();
    const appendRemoval = (
      documentValue,
      boundary
    ) => {
      let keys =
        removalKeysByDocument.get(
          documentValue
        );
      if (!keys) {
        keys = new Set();
        removalKeysByDocument.set(
          documentValue,
          keys
        );
      }
      keys.add(
        apiCompositeBoundaryIdentityKey(
          boundary
        )
      );
    };

    for (const sourceBoundary of
      apiCompositeBoundaryRecords(
        sourceComposite.boundaryPorts
      )) {
      if (
        sourceBoundary.internalNodeId !==
          nodeId
      ) {
        continue;
      }
      if (
        apiCompositePortHasInternalWireInDocument(
          sourceComposite,
          sourceBoundary
        )
      ) {
        result.blockedAtInternalWire += 1;
        continue;
      }

      const chain = [{
        document: sourceComposite,
        boundary: sourceBoundary
      }];
      let inwardDocument =
        sourceComposite;
      let inwardBoundary =
        sourceBoundary;
      const inwardDocuments =
        new WeakSet();
      inwardDocuments.add(
        inwardDocument
      );
      let inwardBlocked = false;
      for (
        let depth = 0;
        depth <
          API_COMPOSITE_MAX_NESTING_DEPTH;
        depth += 1
      ) {
        const inwardOwner = (
          Array.isArray(
            inwardDocument.nodes
          )
            ? inwardDocument.nodes
            : []
        ).find(node =>
          String(node?.id || "") ===
            String(
              inwardBoundary
                .internalNodeId || ""
            ) &&
          node?.operatorId ===
            "container.apiComposite"
        );
        if (!inwardOwner) break;
        const childDocument =
          inwardDocument
            .apiCompositeGraphs?.[
              inwardOwner.id
            ];
        if (
          !childDocument ||
          typeof childDocument !== "object" ||
          Array.isArray(childDocument) ||
          inwardDocuments.has(
            childDocument
          )
        ) {
          inwardBlocked = true;
          break;
        }
        const childBoundary =
          apiCompositeBoundaryRecords(
            childDocument.boundaryPorts
          ).find(candidate =>
            candidate.direction ===
              inwardBoundary.direction &&
            candidate.id ===
              inwardBoundary.internalPortId
          );
        if (!childBoundary) break;
        if (
          apiCompositePortHasInternalWireInDocument(
            childDocument,
            childBoundary
          )
        ) {
          result.blockedAtInternalWire += 1;
          inwardBlocked = true;
          break;
        }
        chain.push({
          document: childDocument,
          boundary: childBoundary
        });
        inwardDocuments.add(
          childDocument
        );
        inwardDocument = childDocument;
        inwardBoundary = childBoundary;
      }
      if (inwardBlocked) continue;

      let context = sourceContext;
      let boundary = sourceBoundary;
      let blocked = false;
      while (context?.owner) {
        const parentDocument =
          context.parentDocument;
        if (!parentDocument) break;
        const ownerEndpoint = {
          direction: boundary.direction,
          internalNodeId:
            context.owner.id,
          internalPortId: boundary.id
        };
        if (
          apiCompositePortHasInternalWireInDocument(
            parentDocument,
            ownerEndpoint
          )
        ) {
          result.blockedAtOuterWire += 1;
          blocked = true;
          break;
        }

        const parentContext =
          context.parentContext;
        if (!parentContext?.owner) break;
        const endpointKey =
          apiCompositeBoundaryEndpointKey(
            ownerEndpoint
          );
        const parentBoundary =
          apiCompositeBoundaryRecords(
            parentDocument.boundaryPorts
          ).find(candidate =>
            apiCompositeBoundaryEndpointKey(
              candidate
            ) === endpointKey
          );
        if (!parentBoundary) break;
        chain.push({
          document: parentDocument,
          boundary: parentBoundary
        });
        boundary = parentBoundary;
        context = parentContext;
      }
      if (blocked) continue;

      result.sourceBoundaries.push(
        sourceBoundary
      );
      for (const item of chain) {
        appendRemoval(
          item.document,
          item.boundary
        );
      }
    }

    result.removals = [
      ...removalKeysByDocument.entries()
    ].map(([documentValue, keys]) => ({
      document: documentValue,
      keys
    }));
    return result;
  }

function applyApiCompositeBoundaryRemovalPlan(
    plan
  ) {
    let removedBoundaries = 0;
    for (const item of
      Array.isArray(plan?.removals)
        ? plan.removals
        : []) {
      const before =
        apiCompositeBoundaryRecords(
          item.document?.boundaryPorts
        );
      const after = before.filter(boundary =>
        !item.keys.has(
          apiCompositeBoundaryIdentityKey(
            boundary
          )
        )
      );
      removedBoundaries +=
        before.length - after.length;
      item.document.boundaryPorts = after;
    }
    return removedBoundaries;
  }

function apiCompositeImmutableTopologySnapshot(
    rootDocument
  ) {
    const result = [];
    const visited = new WeakSet();
    const visit = (documentValue, path) => {
      if (
        !documentValue ||
        typeof documentValue !== "object" ||
        Array.isArray(documentValue) ||
        visited.has(documentValue)
      ) {
        return;
      }
      visited.add(documentValue);
      result.push({
        path,
        connections: nodeGraphClone(
          Array.isArray(
            documentValue.connections
          )
            ? documentValue.connections
            : []
        ),
        branchRouting: nodeGraphClone(
          documentValue.branchRouting &&
          typeof documentValue.branchRouting ===
            "object" &&
          !Array.isArray(
            documentValue.branchRouting
          )
            ? documentValue.branchRouting
            : {}
        ),
        geometry: (
          Array.isArray(documentValue.nodes)
            ? documentValue.nodes
            : []
        ).map(node => ({
          id: String(node?.id || ""),
          x: node?.x,
          y: node?.y,
          width: node?.width,
          height: node?.height
        }))
      });
      const registry =
        documentValue.apiCompositeGraphs &&
        typeof documentValue
          .apiCompositeGraphs === "object" &&
        !Array.isArray(
          documentValue.apiCompositeGraphs
        )
          ? documentValue.apiCompositeGraphs
          : {};
      for (const ownerId of
        Object.keys(registry).sort()) {
        visit(
          registry[ownerId],
          `${path}/${ownerId}`
        );
      }
    };
    visit(rootDocument, "root");
    return JSON.stringify(result);
  }

function apiCompositeBoundaryContractSnapshot(
    rootDocument
  ) {
    const result = [];
    const visited = new WeakSet();
    const visit = (documentValue, path) => {
      if (
        !documentValue ||
        typeof documentValue !== "object" ||
        Array.isArray(documentValue) ||
        visited.has(documentValue)
      ) {
        return;
      }
      visited.add(documentValue);
      result.push({
        path,
        boundaries:
          apiCompositeBoundaryRecords(
            documentValue.boundaryPorts
          )
      });
      const registry =
        documentValue.apiCompositeGraphs &&
        typeof documentValue
          .apiCompositeGraphs === "object" &&
        !Array.isArray(
          documentValue.apiCompositeGraphs
        )
          ? documentValue.apiCompositeGraphs
          : {};
      for (const ownerId of
        Object.keys(registry).sort()) {
        visit(
          registry[ownerId],
          `${path}/${ownerId}`
        );
      }
    };
    visit(rootDocument, "root");
    return JSON.stringify(result);
  }

function restoreApiCompositeBoundaryMutationState(
    targetRoot,
    sourceRoot
  ) {
    const replaceArray = (
      target,
      key,
      source
    ) => {
      const replacement = nodeGraphClone(
        Array.isArray(source?.[key])
          ? source[key]
          : []
      );
      if (Array.isArray(target?.[key])) {
        target[key].splice(
          0,
          target[key].length,
          ...replacement
        );
      } else if (target) {
        target[key] = replacement;
      }
    };
    const visit = (target, source) => {
      if (!target || !source) return;
      replaceArray(
        target,
        "connections",
        source
      );
      replaceArray(
        target,
        "boundaryPorts",
        source
      );
      target.branchRouting = nodeGraphClone(
        source.branchRouting || {}
      );
      target.elementIdentity = nodeGraphClone(
        source.elementIdentity || {}
      );
      target.selectedConnectionId =
        source.selectedConnectionId || null;
      target.selectedWirePoint = nodeGraphClone(
        source.selectedWirePoint || null
      );

      const sourceNodes = new Map(
        (
          Array.isArray(source.nodes)
            ? source.nodes
            : []
        ).map(node => [
          String(node?.id || ""),
          node
        ])
      );
      for (const targetNode of
        Array.isArray(target.nodes)
          ? target.nodes
          : []) {
        if (
          targetNode?.operatorId !==
            "container.apiComposite"
        ) {
          continue;
        }
        const sourceNode = sourceNodes.get(
          String(targetNode.id || "")
        );
        if (sourceNode) {
          targetNode.parameters =
            nodeGraphClone(
              sourceNode.parameters || {}
            );
        }
      }

      const targetRegistry =
        target.apiCompositeGraphs || {};
      const sourceRegistry =
        source.apiCompositeGraphs || {};
      for (const ownerId of
        Object.keys(sourceRegistry)) {
        if (targetRegistry[ownerId]) {
          visit(
            targetRegistry[ownerId],
            sourceRegistry[ownerId]
          );
        }
      }
    };
    visit(targetRoot, sourceRoot);
    graphNodeDefinitionCache = new WeakMap();
    graphNodeGeometryCache.clear();
    graphSocketElementCache.clear();
    graphSvgWirePathCache.clear();
    graphSvgWirePointCache.clear();
    currentAnalysis = null;
    window.RMLResetGraphBoundaryTopologyCaches?.();
  }

function hideUnusedApiCompositeBoundaryChains(
    rootDocument,
    sourceComposite,
    internalNodeId,
    options = {}
  ) {
    const result = {
      removedSourceBoundaries: 0,
      removedBoundaries: 0,
      blockedAtInternalWire: 0,
      blockedAtOuterWire: 0,
      aborted: false,
      reason: "",
      reconciliation: null
    };
    const plan =
      apiCompositeUnusedBoundaryChainPlan(
        rootDocument,
        sourceComposite,
        internalNodeId,
        options
      );
    result.blockedAtInternalWire =
      plan.blockedAtInternalWire;
    result.blockedAtOuterWire =
      plan.blockedAtOuterWire;
    result.removedSourceBoundaries =
      plan.sourceBoundaries.length;
    if (
      result.removedSourceBoundaries === 0
    ) {
      return result;
    }

    const topologyBefore =
      apiCompositeImmutableTopologySnapshot(
        rootDocument
      );
    const previewRoot =
      nodeGraphClone(rootDocument);
    const previewSource =
      apiCompositeDocumentAtOwnerPath(
        previewRoot,
        plan.sourceOwnerPath
      );
    const previewPlan =
      apiCompositeUnusedBoundaryChainPlan(
        previewRoot,
        previewSource,
        internalNodeId,
        {
          sourceOwnerPath:
            plan.sourceOwnerPath
        }
      );
    applyApiCompositeBoundaryRemovalPlan(
      previewPlan
    );
    const previewExpectedBoundaries =
      apiCompositeBoundaryContractSnapshot(
        previewRoot
      );
    const previewReconciliation =
      reconcileApiCompositeBoundaryTree(
        previewRoot,
        { invalidateCaches: false }
      );
    if (
      previewReconciliation
        .disconnectedWires > 0 ||
      apiCompositeBoundaryContractSnapshot(
        previewRoot
      ) !== previewExpectedBoundaries ||
      apiCompositeImmutableTopologySnapshot(
        previewRoot
      ) !== topologyBefore
    ) {
      result.aborted = true;
      result.reason =
        "Hiding these ports would change an existing wire, branch, route or node geometry.";
      result.removedSourceBoundaries = 0;
      return result;
    }

    const rollbackSnapshot =
      nodeGraphClone(rootDocument);
    result.removedBoundaries =
      applyApiCompositeBoundaryRemovalPlan(
        plan
      );
    const expectedBoundaries =
      apiCompositeBoundaryContractSnapshot(
        rootDocument
      );
    result.reconciliation =
      reconcileApiCompositeBoundaryTree(
        rootDocument
      );
    if (
      result.reconciliation
        .disconnectedWires > 0 ||
      apiCompositeBoundaryContractSnapshot(
        rootDocument
      ) !== expectedBoundaries ||
      apiCompositeImmutableTopologySnapshot(
        rootDocument
      ) !== topologyBefore
    ) {
      restoreApiCompositeBoundaryMutationState(
        rootDocument,
        rollbackSnapshot
      );
      result.aborted = true;
      result.reason =
        "The port update was rolled back because reconciliation changed an existing wire, branch, route or node geometry.";
      result.removedSourceBoundaries = 0;
      result.removedBoundaries = 0;
      result.reconciliation = null;
    }
    return result;
  }

function propagateApiCompositeBoundariesOutward(
    rootDocument,
    sourceComposite,
    sourceBoundaries
  ) {
    const result = {
      addedBoundaries: 0,
      stoppedAtInternalWire: 0
    };
    const contexts =
      apiCompositeHierarchyContexts(
        rootDocument
      );
    const sourceContext =
      contexts.get(sourceComposite);
    if (!sourceContext) return result;

    for (const sourceBoundary of
      apiCompositeBoundaryRecords(
        sourceBoundaries
      )) {
      let context = sourceContext;
      let boundary = sourceBoundary;
      while (context?.owner) {
        const owner = context.owner;
        owner.parameters =
          owner.parameters &&
          typeof owner.parameters ===
            "object" &&
          !Array.isArray(owner.parameters)
            ? owner.parameters
            : {};
        owner.parameters.boundaryPorts =
          nodeGraphClone(
            apiCompositeBoundaryRecords(
              context.document
                .boundaryPorts
            )
          );
        owner.parameters.memberCount =
          Array.isArray(
            context.document.nodes
          )
            ? context.document.nodes.length
            : 0;

        const parentContext =
          context.parentContext;
        if (!parentContext?.owner) break;
        const parentDocument =
          context.parentDocument;
        const endpoint = {
          direction: boundary.direction,
          internalNodeId: owner.id,
          internalPortId: boundary.id
        };
        if (
          apiCompositePortHasInternalWireInDocument(
            parentDocument,
            endpoint
          )
        ) {
          result.stoppedAtInternalWire += 1;
          break;
        }

        const parentBoundaries =
          apiCompositeBoundaryRecords(
            parentDocument.boundaryPorts
          );
        const endpointKey =
          apiCompositeBoundaryEndpointKey(
            endpoint
          );
        let parentBoundary =
          parentBoundaries.find(candidate =>
            apiCompositeBoundaryEndpointKey(
              candidate
            ) === endpointKey
          );
        if (!parentBoundary) {
          parentBoundary =
            forwardedApiCompositeBoundary(
              owner,
              boundary,
              parentBoundaries
            );
          parentBoundaries.push(
            parentBoundary
          );
          parentDocument.boundaryPorts =
            parentBoundaries;
          result.addedBoundaries += 1;
        }
        boundary = parentBoundary;
        context = parentContext;
      }
    }

    if (result.addedBoundaries > 0) {
      graphNodeDefinitionCache = new WeakMap();
      graphNodeGeometryCache.clear();
      graphSocketElementCache.clear();
      currentAnalysis = null;
      window.RMLResetGraphBoundaryTopologyCaches?.();
    }
    return result;
  }

function synchronizeApiCompositeBoundaries(
    sourceBoundaries,
    nodeIdsToExpose = []
  ) {
    let removed = 0;
    const boundaries =
      apiCompositeBoundaryRecords(
        sourceBoundaries
      ).filter(boundary => {
        if (
          apiCompositePortHasInternalWire(
            boundary
          )
        ) {
          removed += 1;
          return false;
        }
        return true;
      });
    const endpointKeys = new Set(
      boundaries.map(
        apiCompositeBoundaryEndpointKey
      )
    );
    let added = 0;
    const activeOwnedGraphs =
      apiCompositeEditor
        ? apiCompositeEditorDocument()
            ?.apiCompositeGraphs || {}
        : {};
    for (const nodeId of
      new Set(nodeIdsToExpose)) {
      const node = findGraphNode(nodeId);
      const definition = node
        ? nodeDefinition(node)
        : null;
      if (
        !node ||
        !(
          apiCompositeInternalDefinitionAllowed(
            definition
          ) ||
          apiCompositeOwnedContainerAllowed(
            node,
            activeOwnedGraphs
          )
        )
      ) {
        continue;
      }
      for (const direction of [
        "input",
        "output"
      ]) {
        const ports =
          direction === "input"
            ? definition.inputs || []
            : definition.outputs || [];
        for (const specification of ports) {
          const endpointKey =
            `${direction}\u0000${node.id}\u0000${String(specification.id || "")}`;
          if (
            endpointKeys.has(endpointKey) ||
            apiCompositePortHasInternalWire({
              direction,
              internalNodeId: node.id,
              internalPortId:
                specification.id
            })
          ) {
            continue;
          }
          const boundary =
            apiCompositePortDescriptor(
              node.id,
              specification.id,
              direction,
              nextApiCompositeBoundaryId(
                direction,
                boundaries
              )
            );
          if (!boundary) continue;
          boundary.autoExposed = true;
          boundaries.push(boundary);
          endpointKeys.add(endpointKey);
          added += 1;
        }
      }
    }
    return {
      boundaries,
      added,
      removed
    };
  }

function captureApiCompositeEditorView(
    options = {}
  ) {
    if (!apiCompositeEditor || !graph) {
      return null;
    }
    const ownerId =
      apiCompositeEditor.containerNodeId;
    const existing =
      apiCompositeEditorDocument(
        apiCompositeEditor
      ) || {};
    if (customCSharpEditor) {
      const compositeView =
        customCSharpEditor.mainView;
      const captured = {
        ...existing,
        customCSharpFiles:
          customCSharpFilesForNodes(
            compositeView.nodes,
            existing.customCSharpFiles
          ),
        ...graphViewFrom(compositeView)
      };
      captured.elementIdentity =
        sanitizeApiCompositeElementIdentity(
          existing.elementIdentity,
          {
            templateIdFallback:
              existing.elementIdentity
                ?.templateId || "",
            nodes: captured.nodes,
            connections:
              captured.connections,
            boundaries:
              apiCompositeBoundaryRecords(
                captured.boundaryPorts
              )
          }
        );
      return apiCompositeEditorCommitDocument(
        apiCompositeEditor,
        captured
      );
    }
    if (
      options.synchronizeBoundaries ===
        false
    ) {
      const captured = {
        ...existing,
        ...graphViewFrom(graph)
      };
      // This is the trusted no-content-change capture path. Preserve an
      // existing identity payload byte-for-byte via the spread above, and do
      // not materialize a multi-megabyte identity map on legacy documents
      // merely because the user navigated away and back. The mutating/default
      // path below still sanitizes and creates the required identity map.
      return apiCompositeEditorCommitDocument(
        apiCompositeEditor,
        captured
      );
    }
    const internalNodeIds = new Set(
      graph.nodes.map(node => node.id)
    );
    const internalDefinitions = new Map(
      graph.nodes.map(node => [
        node.id,
        nodeDefinition(node)
      ])
    );
    const resolvedBoundaries =
      apiCompositeBoundaryRecords(
        existing.boundaryPorts
      ).map(boundary => {
        const definition =
          internalDefinitions.get(
            boundary.internalNodeId
          );
        const ports =
          boundary.direction === "input"
            ? definition?.inputs || []
            : definition?.outputs || [];
        const specification =
          ports.find(portValue =>
            portValue.id ===
              boundary.internalPortId
          );
        if (
          !internalNodeIds.has(
            boundary.internalNodeId
          ) ||
          !specification
        ) {
          return null;
        }
        const reference = findPortSpec(
          boundary.internalNodeId,
          boundary.internalPortId,
          boundary.direction
        );
        const resolved = reference
          ? resolvePortType(
              reference,
              currentAnalysis?.bindings ||
                new Map()
            )
          : "";
        return {
          ...boundary,
          type: String(
            resolved ||
            specification.type ||
            boundary.type ||
            ""
          ),
          typeVar:
            resolved || specification.type
              ? ""
              : String(
                  specification.typeVar ||
                  boundary.typeVar ||
                  ""
                ),
          constraint: String(
            specification.constraint ||
            boundary.constraint ||
            "value"
          )
        };
      }).filter(Boolean);
    const boundaryUpdate =
      synchronizeApiCompositeBoundaries(
        resolvedBoundaries
      );
    const boundaries =
      boundaryUpdate.boundaries;
    apiCompositeEditor.boundaryUpdate = {
      added:
        (Number(
          apiCompositeEditor.boundaryUpdate
            ?.added
        ) || 0) + boundaryUpdate.added,
      removed:
        (Number(
          apiCompositeEditor.boundaryUpdate
            ?.removed
        ) || 0) + boundaryUpdate.removed
    };
    apiCompositeRemoveInvalidOwnerConnections(
      apiCompositeEditor.mainView,
      ownerId,
      boundaries
    );
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
      owner.parameters.memberCount =
        graph.nodes.length;
    }
    const availableConnections = [
      ...apiCompositeEditor.mainView
        .connections,
      ...graph.connections
    ];
    const connectionById = new Map(
      availableConnections.map(
        connection => [
          connection.id,
          connection
        ]
      )
    );
    const branchRouting = {};
    for (const [connectionId, branch] of
      Object.entries(
        existing.branchRouting || {}
      )) {
      const parent = connectionById.get(
        branch?.connectionId
      );
      if (
        connectionById.has(connectionId) &&
        parent &&
        (parent.points || []).some(point =>
          point.id === branch.pointId
        )
      ) {
        branchRouting[connectionId] =
          nodeGraphClone(branch);
      }
    }
    const captured = {
      ...existing,
      version: 1,
      boundaryPorts: boundaries,
      branchRouting,
      customCSharpFiles:
        customCSharpFilesForNodes(
          graph.nodes,
          existing.customCSharpFiles
        ),
      ...graphViewFrom(graph)
    };
    captured.elementIdentity =
      sanitizeApiCompositeElementIdentity(
        existing.elementIdentity,
        {
          templateIdFallback:
            existing.elementIdentity
              ?.templateId || "",
          nodes: captured.nodes,
          connections:
            captured.connections,
          boundaries
        }
      );
    return apiCompositeEditorCommitDocument(
      apiCompositeEditor,
      captured
    );
  }

function apiCompositePortDescriptor(
    nodeId,
    portId,
    direction,
    proxyId
  ) {
    const reference = findPortSpec(
      nodeId,
      portId,
      direction
    );
    if (!reference) {
      return null;
    }
    const bindings =
      currentAnalysis?.bindings ||
      analyzeConnections(
        graph.connections
      ).bindings;
    const concreteType =
      resolvePortType(
        reference,
        bindings || new Map()
      ) || reference.spec.type || "";
    const nodeTitle =
      reference.node.label ||
      reference.definition?.title ||
      reference.node.operatorId;

    return {
      id: proxyId,
      direction,
      label:
        `${nodeTitle} · ${reference.spec.label || portId}`
          .slice(0, 160),
      type: String(concreteType || ""),
      typeVar:
        concreteType
          ? ""
          : String(
              reference.spec.typeVar || ""
            ),
      constraint: String(
        reference.spec.constraint ||
        "value"
      ),
      internalNodeId: nodeId,
      internalPortId: portId
    };
  }

function expandApiCompositeGraphDocument(
    source
  ) {
    if (
      !source ||
      !Array.isArray(source.nodes) ||
      !Array.isArray(source.connections)
    ) {
      throw new TypeError(
        "An API Composite expansion requires a complete graph document."
      );
    }

    const expansionStack = new WeakSet();
    const ownedNodeIds = new Set();
    const ownedConnectionIds = new Set();
    const expandView = (
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
          `${path} has no complete internal graph.`
        );
      }
      if (
        depth >
          API_COMPOSITE_MAX_NESTING_DEPTH
      ) {
        throw new Error(
          `API Composite nesting exceeds the safe depth limit of ${API_COMPOSITE_MAX_NESTING_DEPTH}.`
        );
      }
      if (expansionStack.has(candidate)) {
        throw new Error(
          `API Composite nesting contains a cycle at ${path}.`
        );
      }
      expansionStack.add(candidate);
      try {
        for (const node of candidate.nodes) {
          const nodeId = String(
            node?.id || ""
          );
          if (
            !nodeId ||
            ownedNodeIds.has(nodeId)
          ) {
            throw new Error(
              `API Composite hierarchy contains duplicate node identity '${nodeId || "<unnamed>"}'.`
            );
          }
          ownedNodeIds.add(nodeId);
        }
        for (const connection of
          candidate.connections) {
          const connectionId = String(
            connection?.id || ""
          );
          if (
            !connectionId ||
            ownedConnectionIds.has(
              connectionId
            )
          ) {
            throw new Error(
              `API Composite hierarchy contains duplicate connection identity '${connectionId || "<unnamed>"}'.`
            );
          }
          ownedConnectionIds.add(
            connectionId
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
        const containerNodes =
          candidate.nodes.filter(node =>
            node?.operatorId ===
              "container.apiComposite"
          );
        const containerIds = new Set(
          containerNodes.map(node =>
            String(node.id || "")
          )
        );
        for (const ownerId of
          Object.keys(composites)) {
          if (!containerIds.has(ownerId)) {
            throw new Error(
              `${path} contains an orphaned API Composite graph '${ownerId || "<unnamed>"}'.`
            );
          }
        }
        const nodes = candidate.nodes
          .filter(node =>
            !containerIds.has(
              String(node?.id || "")
            )
          )
          .map(node => nodeGraphClone(node));
        const connections =
          candidate.connections.map(
            connection =>
              nodeGraphClone(connection)
          );
        const directConnectionCount =
          connections.length;
        const branchRouting = nodeGraphClone(
          candidate.branchRouting || {}
        );
        const customCSharpFiles =
          mergeCustomCSharpFileRegistry(
            {},
            candidate.customCSharpFiles
          );
        const boundaryByContainer =
          new Map();

        for (const container of
          containerNodes) {
          const containerId = String(
            container.id || ""
          );
          const composite =
            composites[containerId];
          if (!containerId || !composite) {
            throw new Error(
              `API Composite '${containerId || "<unnamed>"}' has no complete owned graph.`
            );
          }
          const expandedChild = expandView(
            composite,
            depth + 1,
            `${path}/${String(
              container.label ||
              container.parameters?.title ||
              containerId
            )}`
          );
          const boundaries =
            apiCompositeBoundaryRecords(
              expandedChild.boundaryPorts
            );
          boundaryByContainer.set(
            containerId,
            new Map(
              boundaries.map(boundary => [
                `${boundary.direction}\u0000${boundary.id}`,
                boundary
              ])
            )
          );
          nodes.push(
            ...expandedChild.nodes
          );
          connections.push(
            ...expandedChild.connections
          );
          Object.assign(
            branchRouting,
            expandedChild.branchRouting
          );
          mergeCustomCSharpFileRegistry(
            customCSharpFiles,
            expandedChild.customCSharpFiles
          );
        }

        for (
          let connectionIndex = 0;
          connectionIndex <
            directConnectionCount;
          connectionIndex += 1
        ) {
          const connection =
            connections[connectionIndex];
          if (
            containerIds.has(
              String(connection.fromNode || "")
            )
          ) {
            const boundary =
              boundaryByContainer
                .get(
                  String(connection.fromNode)
                )
                ?.get(
                  `output\u0000${connection.fromPort}`
                );
            if (!boundary) {
              throw new Error(
                `API Composite '${connection.fromNode}' is missing output proxy '${connection.fromPort}'.`
              );
            }
            connection.fromNode =
              boundary.internalNodeId;
            connection.fromPort =
              boundary.internalPortId;
          }
          if (
            containerIds.has(
              String(connection.toNode || "")
            )
          ) {
            const boundary =
              boundaryByContainer
                .get(
                  String(connection.toNode)
                )
                ?.get(
                  `input\u0000${connection.toPort}`
                );
            if (!boundary) {
              throw new Error(
                `API Composite '${connection.toNode}' is missing input proxy '${connection.toPort}'.`
              );
            }
            connection.toNode =
              boundary.internalNodeId;
            connection.toPort =
              boundary.internalPortId;
          }
        }

        const boundaryPorts =
          apiCompositeBoundaryRecords(
            candidate.boundaryPorts
          ).map(boundary => {
            if (
              !containerIds.has(
                String(
                  boundary.internalNodeId ||
                  ""
                )
              )
            ) {
              return boundary;
            }
            const nestedBoundary =
              boundaryByContainer
                .get(
                  String(
                    boundary.internalNodeId
                  )
                )
                ?.get(
                  `${boundary.direction}\u0000${boundary.internalPortId}`
                );
            if (!nestedBoundary) {
              throw new Error(
                `Nested API Composite '${boundary.internalNodeId}' is missing ${boundary.direction} proxy '${boundary.internalPortId}'.`
              );
            }
            return {
              ...boundary,
              internalNodeId:
                nestedBoundary.internalNodeId,
              internalPortId:
                nestedBoundary.internalPortId,
              type:
                nestedBoundary.type ||
                boundary.type || "",
              typeVar:
                nestedBoundary.typeVar ||
                boundary.typeVar || "",
              constraint:
                nestedBoundary.constraint ||
                boundary.constraint ||
                "value"
            };
          });

        return {
          nodes,
          connections,
          boundaryPorts,
          branchRouting,
          customCSharpFiles
        };
      } finally {
        expansionStack.delete(candidate);
      }
    };

    const expanded = expandView(
      source,
      0,
      "Runtime Graph"
    );
    const usedNodeIds = new Set();
    for (const node of expanded.nodes) {
      const nodeId = String(node?.id || "");
      if (!nodeId || usedNodeIds.has(nodeId)) {
        throw new Error(
          `Expanded API Composite graph contains duplicate node identity '${nodeId || "<unnamed>"}'.`
        );
      }
      usedNodeIds.add(nodeId);
    }
    const usedConnectionIds = new Set();
    for (const connection of
      expanded.connections) {
      const connectionId = String(
        connection?.id || ""
      );
      if (
        !connectionId ||
        usedConnectionIds.has(
          connectionId
        )
      ) {
        throw new Error(
          `Expanded API Composite graph contains duplicate connection identity '${connectionId || "<unnamed>"}'.`
        );
      }
      usedConnectionIds.add(
        connectionId
      );
      if (
        Object.hasOwn(
          expanded.branchRouting,
          connectionId
        )
      ) {
        connection.branchFrom = nodeGraphClone(
          expanded.branchRouting[
            connectionId
          ]
        );
      }
    }
    normalizeConnectionRouting(
      expanded.connections
    );

    return {
      ...source,
      apiCompositeGraphs: {},
      customCSharpFiles:
        expanded.customCSharpFiles,
      nodes: expanded.nodes,
      connections:
        expanded.connections,
      boundaryPorts:
        expanded.boundaryPorts,
      selectedNodeId: null,
      selectedNodeIds: [],
      selectedConnectionId: null,
      selectedWirePoint: null
    };
  }

function withRuntimeRootGraph(callback) {
    if (
      (!customCSharpEditor &&
        !apiCompositeEditor) ||
      customCSharpRootOperation
    ) {
      return callback();
    }
    const savedCustomEditor =
      customCSharpEditor || null;
    const savedPresentationAnalysis =
      currentAnalysis;
    const savedApiFrames =
      apiCompositeEditorChain(
        apiCompositeEditor,
        { outermostFirst: true }
      );
    const savedCustomViewUnchanged = Boolean(
      savedCustomEditor &&
      typeof customCSharpEditorCompleteStateUnchangedSinceOpen ===
        "function" &&
      customCSharpEditorCompleteStateUnchangedSinceOpen(
        savedCustomEditor
      )
    );
    if (savedCustomEditor) {
      if (!savedCustomViewUnchanged) {
        captureCustomCSharpEditorView();
      }
      applyGraphView(
        savedCustomEditor.mainView
      );
      currentAnalysis = null;
      customCSharpEditor = null;
    }
    if (savedApiFrames.length > 0) {
      const savedApiViewUnchanged =
        savedCustomViewUnchanged ||
        Boolean(
          typeof apiCompositeEditorCompleteStateUnchangedSinceOpen ===
            "function" &&
          apiCompositeEditorCompleteStateUnchangedSinceOpen(
            apiCompositeEditor,
            graph
          )
        );
      if (!savedApiViewUnchanged) {
        captureApiCompositeEditorView();
      }
      const rootFrame =
        savedApiFrames[0];
      applyGraphView(
        rootFrame.mainView
      );
      currentAnalysis = null;
      apiCompositeEditor = null;
    }
    customCSharpRootOperation = true;
    try {
      return callback();
    } finally {
      let restoredParent = null;
      for (const frame of savedApiFrames) {
        const composite =
          apiCompositeEditorDocument(frame);
        if (!composite) break;
        frame.parentEditor =
          restoredParent;
        frame.mainView =
          graphViewFrom(graph);
        apiCompositeEditor = frame;
        applyGraphView(
          graphViewFrom(composite)
        );
        currentAnalysis = null;
        restoredParent = frame;
      }
      apiCompositeEditor = restoredParent;
      if (savedCustomEditor) {
        const activeCustomRegistry =
          activeGraphCustomCSharpFileRegistry();
        const fileGraph =
          savedCustomViewUnchanged &&
          savedCustomEditor.openPreparation
            ?.preparedGraph
            ? savedCustomEditor.openPreparation
                .preparedGraph
            : activeCustomRegistry[
                savedCustomEditor.fileNodeId
              ];
        const ownerExists =
          graph.nodes.some(node =>
            node?.id ===
              savedCustomEditor.fileNodeId
          );
        if (
          ownerExists &&
          fileGraph &&
          typeof fileGraph === "object"
        ) {
          savedCustomEditor.mainView =
            graphViewFrom(graph);
          customCSharpEditor =
            savedCustomEditor;
          applyGraphView(
            graphViewFrom(fileGraph)
          );
          currentAnalysis = null;
        } else {
          customCSharpEditor = null;
        }
      }
      // Root/codegen graph swaps are synchronous computation only. Restore the
      // visible level's certified analysis and leave its DOM, geometry and GPU
      // presentation untouched.
      currentAnalysis =
        savedPresentationAnalysis;
      customCSharpRootOperation = false;
    }
  }

function withExpandedApiCompositeGraph(
    callback
  ) {
    const composites =
      graph?.apiCompositeGraphs &&
      typeof graph.apiCompositeGraphs ===
        "object" &&
      !Array.isArray(
        graph.apiCompositeGraphs
      )
        ? graph.apiCompositeGraphs
        : {};
    if (
      apiCompositeRootOperation ||
      Object.keys(composites).length ===
        0
    ) {
      return callback();
    }

    const originalView =
      graphViewFrom(graph);
    const originalAnalysis =
      currentAnalysis;
    const expanded =
      expandApiCompositeGraphDocument(
        graph
      );
    apiCompositeRootOperation = true;
    applyGraphView(
      graphViewFrom(expanded)
    );
    currentAnalysis = null;
    try {
      return callback();
    } finally {
      applyGraphView(originalView);
      currentAnalysis = originalAnalysis;
      apiCompositeRootOperation = false;
    }
  }

function sanitizeWirePoints(
    rawPoints,
    connectionId
  ) {
    const points = [];
    const usedIds = new Set();

    for (
      const [index, source] of
      (Array.isArray(rawPoints)
        ? rawPoints
        : []).entries()
    ) {
      if (
        !source ||
        typeof source !== "object" ||
        Array.isArray(source)
      ) {
        continue;
      }

      let id =
        typeof source.id === "string" &&
        source.id.trim()
          ? source.id.trim()
          : `${connectionId}-point-${index + 1}`;

      while (usedIds.has(id)) {
        id = `${id}-${usedIds.size + 1}`;
      }

      usedIds.add(id);
      points.push({
        id,
        x: nodeGraphClamp(
          finiteNumber(source.x, 0),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        ),
        y: nodeGraphClamp(
          finiteNumber(source.y, 0),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        )
      });
    }

    return points;
  }

function sanitizeBranchReference(source) {
    const branch = source?.branchFrom;

    if (
      !branch ||
      typeof branch !== "object" ||
      Array.isArray(branch) ||
      typeof branch.connectionId !== "string" ||
      typeof branch.pointId !== "string"
    ) {
      return null;
    }

    return {
      connectionId:
        branch.connectionId,
      pointId:
        branch.pointId
    };
  }

function wirePointById(
    connection,
    pointId
  ) {
    return (
      Array.isArray(connection?.points)
        ? connection.points
        : []
    ).find(point =>
      point.id === pointId
    ) || null;
  }

function selectedWirePointReference() {
    const selection =
      graph?.selectedWirePoint;

    if (
      !selection ||
      typeof selection.connectionId !==
        "string" ||
      typeof selection.pointId !==
        "string"
    ) {
      return null;
    }

    const connection =
      graphConnectionById(
        selection.connectionId
      );
    const point =
      wirePointById(
        connection,
        selection.pointId
      );

    return connection && point
      ? { connection, point }
      : null;
  }

function normalizeSelectedWirePoint() {
    if (!graph?.selectedWirePoint) {
      return;
    }

    const selected =
      selectedWirePointReference();

    if (!selected) {
      graph.selectedWirePoint = null;
      return;
    }

    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId =
      selected.connection.id;
  }

function branchReferenceCreatesCycle(
    connection,
    connectionsById
  ) {
    const visited = new Set([
      connection.id
    ]);
    let current = connection;

    while (current?.branchFrom) {
      const parent = connectionsById.get(
        current.branchFrom.connectionId
      );

      if (!parent) {
        return false;
      }

      if (visited.has(parent.id)) {
        return true;
      }

      visited.add(parent.id);
      current = parent;
    }

    return false;
  }

function graphRoutingObjectHasJsonKeys(
    source,
    expectedKeys
  ) {
    if (
      !source ||
      typeof source !== "object" ||
      Array.isArray(source)
    ) {
      return false;
    }

    const persistedKeys =
      Object.keys(source).filter(key => {
        const valueType =
          typeof source[key];
        return (
          valueType !== "undefined" &&
          valueType !== "function" &&
          valueType !== "symbol"
        );
      });
    return (
      persistedKeys.length ===
        expectedKeys.length &&
      expectedKeys.every(key =>
        Object.hasOwn(source, key)
      )
    );
  }

function graphRoutingPointsEqual(
    sourcePoints,
    normalizedPoints
  ) {
    return (
      Array.isArray(sourcePoints) &&
      sourcePoints.length ===
        normalizedPoints.length &&
      normalizedPoints.every(
        (normalizedPoint, index) => {
          const sourcePoint =
            sourcePoints[index];
          return (
            graphRoutingObjectHasJsonKeys(
              sourcePoint,
              ["id", "x", "y"]
            ) &&
            sourcePoint.id ===
              normalizedPoint.id &&
            sourcePoint.x ===
              normalizedPoint.x &&
            sourcePoint.y ===
              normalizedPoint.y
          );
        }
      )
    );
  }

function graphRoutingBranchEqual(
    sourceBranch,
    normalizedBranch
  ) {
    if (normalizedBranch === null) {
      return sourceBranch === null;
    }

    return (
      graphRoutingObjectHasJsonKeys(
        sourceBranch,
        ["connectionId", "pointId"]
      ) &&
      sourceBranch.connectionId ===
        normalizedBranch.connectionId &&
      sourceBranch.pointId ===
        normalizedBranch.pointId
    );
  }

function normalizeConnectionRouting(
    connections,
    mutation = null
  ) {
    const list = Array.isArray(connections)
      ? connections
      : [];
    const connectionsById = new Map(
      list.map(connection => [
        connection.id,
        connection
      ])
    );

    for (const connection of list) {
      const sourcePoints =
        connection.points;
      const normalizedPoints =
        sanitizeWirePoints(
          sourcePoints,
          connection.id
        );
      if (
        mutation &&
        !graphRoutingPointsEqual(
          sourcePoints,
          normalizedPoints
        )
      ) {
        mutation.routingChanged = true;
      }
      connection.points = normalizedPoints;

      const sourceBranch =
        connection.branchFrom;
      const branch =
        sanitizeBranchReference(
          connection
        );

      if (!branch) {
        if (
          mutation &&
          !(
            Object.hasOwn(
              connection,
              "branchFrom"
            ) &&
            sourceBranch === null
          )
        ) {
          mutation.routingChanged = true;
        }
        connection.branchFrom = null;
        continue;
      }

      const parent =
        connectionsById.get(
          branch.connectionId
        );
      const point =
        wirePointById(
          parent,
          branch.pointId
        );
      const sameSemanticSource =
        parent &&
        parent.fromNode ===
          connection.fromNode &&
        parent.fromPort ===
          connection.fromPort;

      const normalizedBranch =
        parent &&
        parent.id !== connection.id &&
        point &&
        sameSemanticSource
          ? branch
          : null;
      if (
        mutation &&
        !graphRoutingBranchEqual(
          sourceBranch,
          normalizedBranch
        )
      ) {
        mutation.routingChanged = true;
      }
      connection.branchFrom =
        normalizedBranch;
    }

    for (const connection of list) {
      if (
        connection.branchFrom &&
        branchReferenceCreatesCycle(
          connection,
          connectionsById
        )
      ) {
        if (mutation) {
          mutation.routingChanged = true;
        }
        connection.branchFrom = null;
      }
    }

    return list;
  }

function sanitizeGraphState(
    raw,
    options = {}
  ) {
    const result = defaultGraphState();

    const apiCompositeDepth = Math.max(
      0,
      Math.trunc(
        finiteNumber(
          options.apiCompositeDepth,
          0
        )
      )
    );
    if (
      apiCompositeDepth >
        API_COMPOSITE_MAX_NESTING_DEPTH
    ) {
      return result;
    }

    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      return result;
    }

    result.active =
      raw.active === true;


    

    
    result.lastOpenPage =
      raw.lastOpenPage === "runtime-graph"
        ? "runtime-graph"
        : "configuration-outline";

    result.revision = Math.max(
      0,
      Math.trunc(
        finiteNumber(raw.revision, 0)
      )
    );

    result.sourceSignature =
      typeof raw.sourceSignature === "string"
        ? raw.sourceSignature
        : "";

    result.showAdvancedNodes =
      raw.showAdvancedNodes === true;

    const rawCompatibility =
      raw.apiCompatibility &&
      typeof raw.apiCompatibility === "object" &&
      !Array.isArray(raw.apiCompatibility)
        ? raw.apiCompatibility
        : {};
    result.apiCompatibility = {
      schemaVersion: 1,
      history: (Array.isArray(rawCompatibility.history) ? rawCompatibility.history : [])
        .slice(-32)
        .filter(entry => entry && typeof entry === "object" && !Array.isArray(entry))
        .map(entry => nodeGraphClone(entry))
    };
    const rawIntegratedCompatibility =
      raw.integratedNodeCompatibility &&
      typeof raw.integratedNodeCompatibility ===
        "object" &&
      !Array.isArray(
        raw.integratedNodeCompatibility
      )
        ? raw.integratedNodeCompatibility
        : null;
    result.integratedNodeCompatibility =
      rawIntegratedCompatibility
        ? {
            schemaVersion: Math.max(
              0,
              Math.trunc(
                finiteNumber(
                  rawIntegratedCompatibility
                    .schemaVersion,
                  0
                )
              )
            ),
            algorithm: String(
              rawIntegratedCompatibility
                .algorithm || ""
            ).slice(0, 160),
            fingerprint: String(
              rawIntegratedCompatibility
                .fingerprint || ""
            ).slice(0, 160),
            definitionCount: Math.max(
              0,
              Math.trunc(
                finiteNumber(
                  rawIntegratedCompatibility
                    .definitionCount,
                  0
                )
              )
            )
          }
        : null;

    if (
      raw.configSnapshot &&
      typeof raw.configSnapshot === "object" &&
      !Array.isArray(raw.configSnapshot) &&
      Array.isArray(raw.configSnapshot.nodes)
    ) {
      result.configSnapshot = {
        metadata:
          raw.configSnapshot.metadata &&
          typeof raw.configSnapshot.metadata === "object"
            ? nodeGraphClone(raw.configSnapshot.metadata)
            : {},
        nodes:
          nodeGraphClone(raw.configSnapshot.nodes)
      };
    }

    const rawNodes =
      Array.isArray(raw.nodes)
        ? raw.nodes
        : [];

    const usedNodeIds = new Set();
    const migratedRuntimeFamilyPorts = new Map();

    const migrateRuntimeFamilyOperator = (nodeId, operatorId, parameters) => {
      if (operatorId === "csharp.action") {
        parameters.mode = "action";
        parameters.actionCode = String(parameters.code || "");
        delete parameters.code;
        return "csharp.file";
      }
      if (operatorId === "csharp.expression") {
        parameters.mode = "expression";
        parameters.expressionCode = String(parameters.code || "");
        delete parameters.code;
        return "csharp.file";
      }
      if (operatorId === "csharp.runtimeMember" || operatorId === "csharp.mainMember") {
        parameters.mode = operatorId === "csharp.runtimeMember"
          ? "runtimeMember"
          : "mainMember";
        parameters.memberCode = String(parameters.code || parameters.memberCode || "");
        delete parameters.code;
        return "csharp.file";
      }
      if (operatorId === "csharp.additionalSource") {
        parameters.mode = "file";
        parameters.source = String(parameters.content || parameters.source || "");
        parameters.projectId = parameters.projectId || "main";
        parameters.fileName = parameters.fileName || "AdditionalSource.cs";
        parameters.nullable = parameters.nullable || "inherit";
        parameters.autoGeneratedHeader = false;
        parameters.legacyTemplateSource = true;
        delete parameters.content;
        return "csharp.file";
      }
      if (["csharp.assemblyReference", "csharp.packageReference", "csharp.frameworkReference"].includes(operatorId)) {
        parameters.referenceKind = operatorId === "csharp.packageReference"
          ? "package"
          : operatorId === "csharp.frameworkReference"
            ? "framework"
            : "assembly";
        parameters.projectId = parameters.projectId || "main";
        if (operatorId === "csharp.assemblyReference" && parameters.private === undefined) {
          parameters.private = parameters.copyLocal === true;
        }
        delete parameters.copyLocal;
        return "csharp.reference";
      }
      const migration = {
        "math.add": ["math.operation", "add"],
        "math.subtract": ["math.operation", "subtract"],
        "math.multiply": ["math.operation", "multiply"],
        "math.divide": ["math.operation", "divide"],
        "math.modulo": ["math.operation", "modulo"],
        "math.power": ["math.operation", "power"],
        "math.minimum": ["math.operation", "minimum"],
        "math.maximum": ["math.operation", "maximum"],
        "math.negate": ["math.unaryOperation", "negate"],
        "math.absolute": ["math.unaryOperation", "absolute"],
        "math.squareRoot": ["math.unaryOperation", "squareRoot"],
        "math.round": ["math.unaryOperation", "round"],
        "math.floor": ["math.unaryOperation", "floor"],
        "math.ceiling": ["math.unaryOperation", "ceiling"],
        "logic.and": ["logic.booleanOperation", "and"],
        "logic.or": ["logic.booleanOperation", "or"],
        "logic.not": ["logic.booleanOperation", "not"],
        "logic.equal": ["logic.compare", "equal"],
        "logic.greater": ["logic.compare", "greater"],
        "logic.less": ["logic.compare", "less"],
        "text.contains": ["text.matchOperation", "contains"],
        "text.startsWith": ["text.matchOperation", "startsWith"],
        "text.endsWith": ["text.matchOperation", "endsWith"],
        "text.replace": ["text.transformOperation", "replace"],
        "normal.isNull": ["normal.nullCheck", "isNull"],
        "normal.isNotNull": ["normal.nullCheck", "isNotNull"],
        "file.fileExists": ["file.pathExists", "file"],
        "file.directoryExists": ["file.pathExists", "directory"],
        "file.readText": ["file.readOperation", "text"],
        "file.readBytes": ["file.readOperation", "bytes"],
        "file.writeText": ["file.writeOperation", "overwrite"],
        "file.appendText": ["file.writeOperation", "append"],
        "file.writeBytes": ["file.writeOperation", "bytes"],
        "file.copy": ["file.transfer", "copy"],
        "file.move": ["file.transfer", "move"],
        "file.createDirectory": ["file.pathMutation", "createDirectory"],
        "file.delete": ["file.pathMutation", "delete"],
        "json.createObject": ["json.createContainer", "object"],
        "json.createArray": ["json.createContainer", "array"],
        "task.whenAll": ["task.waitMany", "all"],
        "task.whenAny": ["task.waitMany", "any"],
        "collection.addItem": ["collection.mutateItem", "add"],
        "collection.insertItem": ["collection.mutateItem", "insert"],
        "collection.removeItem": ["collection.mutateItem", "remove"],
        "collection.removeAt": ["collection.mutateItem", "removeAt"],
        "collection.clearList": ["collection.mutateItem", "clear"],
        "dictionary.setValue": ["dictionary.mutate", "set"],
        "dictionary.removeKey": ["dictionary.mutate", "remove"],
        "json.setProperty": ["json.mutate", "setProperty"],
        "json.removeProperty": ["json.mutate", "removeProperty"],
        "json.addArrayItem": ["json.mutate", "addArrayItem"],
        "normal.tryParseNumber": ["normal.tryParse", "number"],
        "normal.tryParseBoolean": ["normal.tryParse", "boolean"],
        "text.concat": ["text.combineOperation", "concat"],
        "text.format": ["text.combineOperation", "format"],
        "text.join": ["text.combineOperation", "join"],
        "cast.doubleToFloat": ["cast.operation", "doubleToFloat"],
        "cast.floatToInt": ["cast.operation", "floatToInt"],
        "cast.toString": ["cast.operation", "toString"],
        "network.tcpSend": ["network.socketSend", "tcp"],
        "network.udpSend": ["network.socketSend", "udp"],
        "flow.whileLoop": ["flow.loop", "while"],
        "flow.doWhileLoop": ["flow.loop", "doWhile"],
        "flow.break": ["flow.loopControl", "break"],
        "flow.continue": ["flow.loopControl", "continue"],
        "lifecycle.processExit": ["lifecycle.shutdownEvent", "processExit"],
        "lifecycle.modUnload": ["lifecycle.shutdownEvent", "modUnload"],
        "configuration.setVisibility": ["configuration.visibilityOperation", "item"],
        "configuration.setLabelVisibility": ["configuration.visibilityOperation", "label"],
        "harmony.patchArgument": ["harmony.readPatchValue", "argument"],
        "harmony.patchResult": ["harmony.readPatchValue", "result"],
        "harmony.setArgument": ["harmony.writePatchValue", "argument"],
        "harmony.setResult": ["harmony.writePatchValue", "result"],
        "lifecycle.worldStart": ["lifecycle.harmonyEvent", "worldStart"],
        "lifecycle.worldDestroy": ["lifecycle.harmonyEvent", "worldDestroy"],
        "lifecycle.userJoin": ["lifecycle.harmonyEvent", "userJoin"],
        "lifecycle.userLeave": ["lifecycle.harmonyEvent", "userLeave"],
        "lifecycle.componentAttach": ["lifecycle.harmonyEvent", "componentAttach"],
        "lifecycle.componentDestroy": ["lifecycle.harmonyEvent", "componentDestroy"],
        "lifecycle.engineUpdate": ["lifecycle.harmonyEvent", "engineUpdate"]
      }[operatorId];
      if (migration) {
        parameters.operation = migration[1];
        if (operatorId === "math.power") {
          migratedRuntimeFamilyPorts.set(nodeId, { input: { value: "a", exponent: "b" } });
        }
        if (operatorId.startsWith("lifecycle.") && migration[0] === "lifecycle.harmonyEvent") {
          parameters.targetTypeOverride = String(parameters.targetType || "");
          parameters.targetMethodOverride = String(parameters.targetMethod || "");
          delete parameters.targetType;
          delete parameters.targetMethod;
        }
        return migration[0];
      }
      if (operatorId === "text.trim") {
        parameters.operation = { start: "trimStart", end: "trimEnd" }[parameters.mode] || "trim";
        delete parameters.mode;
        return "text.transformOperation";
      }
      if (operatorId === "text.changeCase") {
        parameters.operation = parameters.mode === "lower" ? "lower" : "upper";
        delete parameters.mode;
        return "text.transformOperation";
      }
      return operatorId;
    };

    for (const source of rawNodes) {
      if (
        !source ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        typeof source.id !== "string" ||
        usedNodeIds.has(source.id)
      ) {
        continue;
      }

      const kind =
        source.kind === "configuration"
          ? "configuration"
          : "operator";
      const parameters =
        source.parameters &&
        typeof source.parameters === "object" &&
        !Array.isArray(source.parameters)
          ? nodeGraphClone(source.parameters)
          : {};
      let operatorId =
        kind === "operator"
          ? source.operatorId
          : undefined;

      if (kind === "operator") {
        operatorId = migrateRuntimeFamilyOperator(source.id, operatorId, parameters);
      }

      usedNodeIds.add(source.id);

      const definition =
        kind === "operator"
          ? OPERATOR_DEFINITIONS[
              operatorId
            ]
          : null;

      if (
        definition?.configurableTypeVar
      ) {
        const allowed =
          definition.configurableTypes ||
          VALUE_TYPES;
        const candidate = parameters.valueType;

        if (
          candidate === "auto" &&
          definitionAllowsAutoType(definition)
        ) {
          parameters.valueType = "auto";
        } else if (!allowed.includes(candidate)) {
          parameters.valueType =
            definition.defaultType === "auto" &&
            definitionAllowsAutoType(definition)
              ? "auto"
              : fallbackTypeForDefinition(definition);
        }
      }

      normalizePortLayoutParameter(
        parameters,
        definition,
        kind === "configuration" ||
          Object.hasOwn(
            parameters,
            "portLayout"
          )
      );

      normalizeNodeParametersObject(
        parameters,
        definition,
        operatorId || "",
        true
      );

      result.nodes.push({
        id: source.id,
        kind,
        operatorId:
          kind === "operator"
            ? operatorId
            : undefined,
        apiContract:
          kind === "operator" &&
          source.apiContract &&
          typeof source.apiContract === "object" &&
          !Array.isArray(source.apiContract)
            ? nodeGraphClone(source.apiContract)
            : undefined,
        x: nodeGraphClamp(
          finiteNumber(source.x, 120),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        ),
        y: nodeGraphClamp(
          finiteNumber(source.y, 100),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        ),
        width:
          Number.isFinite(Number(source.width)) &&
          Number(source.width) > 0
            ? nodeGraphClamp(
                Number(source.width),
                GRAPH_NODE_MIN_WIDTH,
                GRAPH_NODE_MAX_WIDTH
              )
            : null,
        height:
          Number.isFinite(Number(source.height)) &&
          Number(source.height) > 0
            ? nodeGraphClamp(
                Number(source.height),
                GRAPH_NODE_MIN_HEIGHT,
                GRAPH_NODE_MAX_HEIGHT
              )
            : null,
        label:
          typeof source.label === "string"
            ? source.label.slice(0, 120)
            : "",
        parameters
      });
    }

    const rawConnections =
      Array.isArray(raw.connections)
        ? raw.connections
        : [];

    const usedConnectionIds = new Set();

    for (const source of rawConnections) {
      if (
        !source ||
        typeof source !== "object" ||
        typeof source.id !== "string" ||
        usedConnectionIds.has(source.id) ||
        !usedNodeIds.has(source.fromNode) ||
        !usedNodeIds.has(source.toNode) ||
        typeof source.fromPort !== "string" ||
        typeof source.toPort !== "string"
      ) {
        continue;
      }

      usedConnectionIds.add(source.id);
      const sourcePortMigration = migratedRuntimeFamilyPorts.get(source.fromNode)?.output || {};
      const targetPortMigration = migratedRuntimeFamilyPorts.get(source.toNode)?.input || {};
      result.connections.push({
        id: source.id,
        fromNode: source.fromNode,
        fromPort: sourcePortMigration[source.fromPort] || source.fromPort,
        toNode: source.toNode,
        toPort: targetPortMigration[source.toPort] || source.toPort,
        points:
          sanitizeWirePoints(
            source.points,
            source.id
          ),
        branchFrom:
          sanitizeBranchReference(
            source
          )
      });
    }

    for (const node of result.nodes) {
      if (node.kind !== "operator") continue;
      const definition = OPERATOR_DEFINITIONS[node.operatorId];

      const inferLegacyVariadicCount = (direction, descriptor) => {
        if (!descriptor) return;
        const key = direction === "input"
          ? "variadicInputCount"
          : "variadicOutputCount";
        if (Number.isFinite(Number(node.parameters?.[key]))) {
          return;
        }

        let required = Number(descriptor.defaultCount) ||
          Number(descriptor.minimum) || 2;
        const legacyIds = Array.isArray(descriptor.ids)
          ? descriptor.ids.map(value => String(value || ""))
          : [];

        for (const connection of result.connections) {
          const applies = direction === "input"
            ? connection.toNode === node.id
            : connection.fromNode === node.id;
          if (!applies) continue;

          const portId = String(
            direction === "input"
              ? connection.toPort
              : connection.fromPort
          );
          const legacyIndex = legacyIds.indexOf(portId);
          if (legacyIndex >= 0) {
            required = Math.max(required, legacyIndex + 1);
            continue;
          }

          if (direction === "input") {
            if (/^[a-z]$/.test(portId)) {
              required = Math.max(required, portId.charCodeAt(0) - 96);
              continue;
            }
            const match = /^input(\d+)$/.exec(portId);
            if (match) required = Math.max(required, Number(match[1]));
          } else {
            const prefix = String(descriptor.idPrefix || "output");
            const match = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`).exec(portId);
            if (match) required = Math.max(required, Number(match[1]));
          }
        }

        node.parameters[key] = nodeGraphClamp(
          required,
          Math.max(2, Number(descriptor.minimum) || 2),
          Math.max(2, Number(descriptor.maximum) || 64)
        );
      };

      inferLegacyVariadicCount("input", definition?.variadicInputs);
      inferLegacyVariadicCount("output", definition?.variadicOutputs);
    }

    normalizeConnectionRouting(
      result.connections
    );

    const availableConnectionIds =
      new Set(
        result.connections.map(
          connection =>
            connection.id
        )
      );

    const view =
      raw.viewport &&
      typeof raw.viewport === "object"
        ? raw.viewport
        : {};

    result.viewport = {
      x: finiteNumber(view.x, 56),
      y: finiteNumber(view.y, 54),
      scale: nodeGraphClamp(
        finiteNumber(view.scale, 0.9),
        GRAPH_MIN_ZOOM,
        GRAPH_MAX_ZOOM
      )
    };

    result.selectedNodeId =
      usedNodeIds.has(raw.selectedNodeId)
        ? raw.selectedNodeId
        : null;

    result.selectedNodeIds = [
      ...new Set(
        (Array.isArray(raw.selectedNodeIds)
          ? raw.selectedNodeIds
          : result.selectedNodeId
            ? [result.selectedNodeId]
            : [])
          .map(value => String(value || ""))
          .filter(value => usedNodeIds.has(value))
      )
    ];
    if (
      result.selectedNodeId &&
      !result.selectedNodeIds.includes(
        result.selectedNodeId
      )
    ) {
      result.selectedNodeIds.push(
        result.selectedNodeId
      );
    }

    result.selectedConnectionId =
      availableConnectionIds.has(
        raw.selectedConnectionId
      )
        ? raw.selectedConnectionId
        : null;

    const selectedWirePoint =
      raw.selectedWirePoint;

    if (
      selectedWirePoint &&
      typeof selectedWirePoint ===
        "object" &&
      !Array.isArray(
        selectedWirePoint
      ) &&
      typeof selectedWirePoint
        .connectionId === "string" &&
      typeof selectedWirePoint
        .pointId === "string"
    ) {
      const selectedConnection =
        result.connections.find(
          connection =>
            connection.id ===
              selectedWirePoint
                .connectionId
        );
      const selectedPoint =
        wirePointById(
          selectedConnection,
          selectedWirePoint.pointId
        );

      if (selectedConnection && selectedPoint) {
        result.selectedWirePoint = {
          connectionId:
            selectedConnection.id,
          pointId: selectedPoint.id
        };
        result.selectedNodeId = null;
        result.selectedConnectionId =
          selectedConnection.id;
      }
    }

    result.nextSequence = Math.max(
      1,
      Math.trunc(
        finiteNumber(
          raw.nextSequence,
          result.nodes.length + 1
        )
      )
    );

    const rawCustomCSharpFiles =
      mergeCustomCSharpFileRegistry(
        {},
        raw.customCSharpFiles
      );
    const customFileOwners = new Map(
      result.nodes
        .filter(node =>
          node.kind === "operator" &&
          node.operatorId === "csharp.file"
        )
        .map(node => [node.id, node])
    );
    const customFileOwnerIds = new Set(
      customFileOwners.keys()
    );

    for (const [ownerId, source] of Object.entries(rawCustomCSharpFiles)) {
      if (
        !customFileOwnerIds.has(ownerId) ||
        !source ||
        typeof source !== "object" ||
        Array.isArray(source)
      ) {
        continue;
      }
      const owner =
        customFileOwners.get(ownerId) ||
        null;
      const legacyDirectSource = Array.isArray(source.nodes)
        ? source.nodes.find(node => node?.operatorId === "csharp.directSource")
        : null;
      if (
        owner &&
        legacyDirectSource &&
        !String(owner.parameters?.source || "")
      ) {
        owner.parameters = owner.parameters && typeof owner.parameters === "object"
          ? owner.parameters
          : {};
        owner.parameters.source = String(legacyDirectSource.parameters?.source || "");
      }
      const customCSharpNodes =
        Array.isArray(source.nodes)
          ? source.nodes.map(node =>
              node?.operatorId ===
                "csharp.using"
                ? {
                    ...node,
                    operatorId:
                      "csharp.usingDirective"
                  }
                : node
            )
          : [];
      const sanitizedView = sanitizeGraphState({
        nodes: customCSharpNodes,
        connections: source.connections,
        viewport: source.viewport,
        selectedNodeId: source.selectedNodeId,
        selectedNodeIds: source.selectedNodeIds,
        selectedConnectionId: source.selectedConnectionId,
        selectedWirePoint: source.selectedWirePoint,
        nextSequence: source.nextSequence
      }, {
        apiCompositeDepth
      });
      sanitizedView.nodes = sanitizedView.nodes.filter(node => {
        if (node.operatorId === "csharp.directSource") return false;
        const definition = OPERATOR_DEFINITIONS[node.operatorId];
        const storedContract =
          node.apiContract &&
          typeof node.apiContract === "object" &&
          !Array.isArray(node.apiContract)
            ? node.apiContract
            : definition?.preservedApiContract;
        const preservedCatalogNode =
          Boolean(
            String(
              storedContract?.ownerType || ""
            ).trim() &&
            String(
              storedContract?.kind || ""
            ).trim()
          ) &&
          (
            !definition ||
            definition
              .unavailableApiContract ===
                true
          );
        return Boolean(
          definition?.customCSharpSyntaxNode === true ||
          definition?.customCSharpSubgraphOnly === true ||
          definition?.customCSharpCatalogNode === true ||
          preservedCatalogNode
        );
      });
      const allowedInternalIds = new Set(sanitizedView.nodes.map(node => node.id));
      sanitizedView.connections = sanitizedView.connections.filter(connection =>
        allowedInternalIds.has(connection.fromNode) &&
        allowedInternalIds.has(connection.toNode)
      );
      sanitizedView.selectedNodeIds =
        sanitizedView.selectedNodeIds.filter(
          nodeId =>
            allowedInternalIds.has(nodeId)
        );
      if (!allowedInternalIds.has(sanitizedView.selectedNodeId)) {
        sanitizedView.selectedNodeId = null;
      }
      const allowedInternalConnectionIds = new Set(
        sanitizedView.connections.map(connection => connection.id)
      );
      if (!allowedInternalConnectionIds.has(sanitizedView.selectedConnectionId)) {
        sanitizedView.selectedConnectionId = null;
        sanitizedView.selectedWirePoint = null;
      }
      const internalIds = new Set(sanitizedView.nodes.map(node => node.id));
      const importedSource =
        source.importedSource === true;
      const sourceEditedInInspector =
        source.sourceEditedInInspector === true;
      const coordinateSpaceVersion =
        Math.max(
          0,
          Math.trunc(
            finiteNumber(
              source.coordinateSpaceVersion,
              0
            )
          )
        );
      const legacyImportedLayoutSaturated =
        importedSource &&
        coordinateSpaceVersion <
          CUSTOM_CSHARP_COORDINATE_SPACE_VERSION &&
        sanitizedView.nodes.some(node =>
          Math.abs(node.x) ===
            LEGACY_GRAPH_COORDINATE_LIMIT ||
          Math.abs(node.y) ===
            LEGACY_GRAPH_COORDINATE_LIMIT
        );
      result.customCSharpFiles[ownerId] = {
        version: 1,
        fileName: String(source.fileName || "VisualProgram.cs").slice(0, 260),
        projectId: String(source.projectId || "main").slice(0, 160),
        parser: String(source.parser || "Visual C#").slice(0, 120),
        languageVersion: String(source.languageVersion || "14.0").slice(0, 32),
        optimizerVersion: Math.max(0, Math.trunc(finiteNumber(source.optimizerVersion, 0))),
        catalogFingerprint:
          String(source.catalogFingerprint || "").slice(0, 256),
        catalogEngineVersion:
          String(source.catalogEngineVersion || "").slice(0, 160),
        catalogSource:
          String(source.catalogSource || "").slice(0, 120),
        catalogDefinitionRevision:
          Math.max(
            0,
            Math.trunc(
              finiteNumber(
                source.catalogDefinitionRevision,
                0
              )
            )
          ),
        importedSource,
        sourceEditedInInspector,
        coordinateSpaceVersion:
          CUSTOM_CSHARP_COORDINATE_SPACE_VERSION,
        sourceHash: legacyImportedLayoutSaturated
          ? ""
          : String(source.sourceHash || "").slice(0, 160),
        outputNodeId: internalIds.has(source.outputNodeId) ? source.outputNodeId : "",
        rootSyntaxNodeId: internalIds.has(source.rootSyntaxNodeId) ? source.rootSyntaxNodeId : "",
        directSourceNodeId: internalIds.has(source.directSourceNodeId) ? source.directSourceNodeId : "",
        ...graphViewFrom(sanitizedView)
      };
    }


    

    const migratedSyntaxIds = new Set();
    for (const owner of result.nodes.filter(node =>
      node.kind === "operator" &&
      node.operatorId === "csharp.file" &&
      !result.customCSharpFiles[node.id]
    )) {
      const rootConnection = result.connections.find(connection =>
        connection.toNode === owner.id &&
        connection.toPort === "content"
      );
      const rootNode = result.nodes.find(node => node.id === rootConnection?.fromNode);
      if (
        !rootConnection ||
        OPERATOR_DEFINITIONS[rootNode?.operatorId]?.customCSharpSyntaxNode !== true
      ) {
        if (rootConnection) owner.parameters.legacyInlineContent = true;
        continue;
      }

      const localSyntaxIds = new Set();
      const pending = [rootNode.id];
      while (pending.length > 0) {
        const nodeId = pending.pop();
        if (localSyntaxIds.has(nodeId)) continue;
        const syntaxNode = result.nodes.find(node => node.id === nodeId);
        if (OPERATOR_DEFINITIONS[syntaxNode?.operatorId]?.customCSharpSyntaxNode !== true) continue;
        localSyntaxIds.add(nodeId);
        for (const connection of result.connections) {
          if (connection.toNode === nodeId) pending.push(connection.fromNode);
        }
      }

      const hasRuntimeDependency = result.connections.some(connection =>
        localSyntaxIds.has(connection.toNode) &&
        !localSyntaxIds.has(connection.fromNode)
      );
      if (hasRuntimeDependency) {
        owner.parameters.legacyInlineContent = true;
        continue;
      }

      const internalNodes = result.nodes
        .filter(node => localSyntaxIds.has(node.id))
        .map(node => nodeGraphClone(node));
      internalNodes.push({
        ...nodeGraphClone(owner),
        operatorId: "csharp.customFileOutput",
        label: `Output · ${String(owner.parameters?.fileName || "Custom C# File")}`,
        parameters: {}
      });
      const internalConnections = result.connections
        .filter(connection =>
          (localSyntaxIds.has(connection.fromNode) && localSyntaxIds.has(connection.toNode)) ||
          connection.id === rootConnection.id
        )
        .map(connection => nodeGraphClone(connection));
      result.customCSharpFiles[owner.id] = {
        version: 1,
        fileName: String(owner.parameters?.fileName || "VisualProgram.cs"),
        projectId: String(owner.parameters?.projectId || "main"),
        parser: "Migrated visual C# graph",
        languageVersion: "14.0",
        importedSource: false,
        sourceEditedInInspector: false,
        coordinateSpaceVersion:
          CUSTOM_CSHARP_COORDINATE_SPACE_VERSION,
        sourceHash: "",
        outputNodeId: owner.id,
        rootSyntaxNodeId: rootNode.id,
        nodes: internalNodes,
        connections: internalConnections,
        viewport: { x: 56, y: 54, scale: 0.45 },
        selectedNodeId: owner.id,
        selectedConnectionId: null,
        selectedWirePoint: null,
        nextSequence: internalNodes.length + internalConnections.length + 1
      };
      for (const nodeId of localSyntaxIds) migratedSyntaxIds.add(nodeId);
    }

    if (migratedSyntaxIds.size > 0) {
      result.nodes = result.nodes.filter(node => !migratedSyntaxIds.has(node.id));
      result.connections = result.connections.filter(connection =>
        !migratedSyntaxIds.has(connection.fromNode) &&
        !migratedSyntaxIds.has(connection.toNode)
      );
      result.selectedNodeId = result.nodes.some(node => node.id === result.selectedNodeId)
        ? result.selectedNodeId
        : null;
      result.selectedConnectionId = result.connections.some(connection => connection.id === result.selectedConnectionId)
        ? result.selectedConnectionId
        : null;
      result.selectedWirePoint = null;
    }

    const rawApiCompositeGraphs =
      raw.apiCompositeGraphs &&
      typeof raw.apiCompositeGraphs ===
        "object" &&
      !Array.isArray(raw.apiCompositeGraphs)
        ? raw.apiCompositeGraphs
        : {};
    const compositeOwners = new Map(
      result.nodes
        .filter(node =>
          node.kind === "operator" &&
          node.operatorId ===
            "container.apiComposite"
        )
        .map(node => [node.id, node])
    );

    for (const [ownerId, source] of
      Object.entries(
        rawApiCompositeGraphs
      )) {
      const owner =
        compositeOwners.get(ownerId);
      if (
        !owner ||
        !source ||
        typeof source !== "object" ||
        Array.isArray(source)
      ) {
        continue;
      }
      const sanitizedView =
        sanitizeGraphState({
          nodes: source.nodes,
          connections:
            source.connections,
          viewport: source.viewport,
          selectedNodeId:
            source.selectedNodeId,
          selectedNodeIds:
            source.selectedNodeIds,
          selectedConnectionId:
            source.selectedConnectionId,
          selectedWirePoint:
            source.selectedWirePoint,
          nextSequence:
            source.nextSequence,
          customCSharpFiles:
            mergeCustomCSharpFileRegistry(
              mergeCustomCSharpFileRegistry(
                {},
                rawCustomCSharpFiles
              ),
              source.customCSharpFiles
            ),
          apiCompositeGraphs:
            source.apiCompositeGraphs
        }, {
          apiCompositeDepth:
            apiCompositeDepth + 1
        });
      sanitizedView.nodes =
        sanitizedView.nodes.filter(node => {
          if (
            node.operatorId ===
              "container.apiComposite"
          ) {
            return Boolean(
              sanitizedView
                .apiCompositeGraphs?.[
                  node.id
                ]
            );
          }
          const definition =
            OPERATOR_DEFINITIONS[
              node.operatorId
            ];
          const contract =
            node.apiContract ||
            definition?.preservedApiContract;
          return Boolean(
            node.kind === "operator" &&
            (
              apiCompositeInternalDefinitionAllowed(
                definition
              ) ||
              (
                String(
                  contract?.ownerType || ""
                ).trim() &&
                String(
                  contract?.kind || ""
                ).trim()
              )
            )
          );
        });
      const internalNodeIds = new Set(
        sanitizedView.nodes.map(node =>
          node.id
        )
      );
      sanitizedView.connections =
        sanitizedView.connections.filter(
          connection =>
            internalNodeIds.has(
              connection.fromNode
            ) &&
            internalNodeIds.has(
              connection.toNode
            )
        );
      const boundaries =
        apiCompositeBoundaryRecords(
          source.boundaryPorts ||
          owner.parameters
            ?.boundaryPorts
        ).filter(boundary =>
          internalNodeIds.has(
            boundary.internalNodeId
          )
        );
      const branchRouting = {};
      for (const [connectionId, branch] of
        Object.entries(
          source.branchRouting || {}
        )) {
        if (
          branch &&
          typeof branch === "object" &&
          !Array.isArray(branch) &&
          String(
            branch.connectionId || ""
          ) &&
          String(branch.pointId || "")
        ) {
          branchRouting[
            String(connectionId)
          ] = {
            connectionId: String(
              branch.connectionId
            ),
            pointId: String(
              branch.pointId
            )
          };
        }
      }
      owner.parameters =
        owner.parameters &&
        typeof owner.parameters === "object"
          ? owner.parameters
          : {};
      owner.parameters.title = String(
        source.title ||
        owner.parameters.title ||
        owner.label ||
        "API Composite"
      ).slice(0, 120);
      owner.parameters.memberCount =
        sanitizedView.nodes.length;
      owner.parameters.boundaryPorts =
        nodeGraphClone(boundaries);
      normalizePortLayoutParameter(
        owner.parameters,
        OPERATOR_DEFINITIONS[
          "container.apiComposite"
        ],
        true
      );
      result.apiCompositeGraphs[
        ownerId
      ] = {
        version: 1,
        title:
          owner.parameters.title,
        portLayout:
          source.portLayout === "mirrored" ||
          source.portLayout === "standard"
            ? source.portLayout
            : owner.parameters
                .portLayout === "mirrored"
              ? "mirrored"
              : "standard",
        contentFingerprint:
          String(
            source.contentFingerprint ||
            owner.parameters
              ?.apiCompositeFingerprint ||
            ""
          ).slice(0, 96),
        fingerprintNameKey:
          String(
            source.fingerprintNameKey ||
            ""
          ).slice(0, 160),
        fingerprintPortLayout:
          source.fingerprintPortLayout ===
            "mirrored"
            ? "mirrored"
            : source.fingerprintPortLayout ===
                "standard"
              ? "standard"
              : "",
        fingerprintNestedSignature:
          String(
            source.fingerprintNestedSignature ||
            ""
          ).slice(0, 96),
        createdCatalogFingerprint:
          String(
            source.createdCatalogFingerprint ||
            ""
          ).slice(0, 256),
        createdEngineVersion:
          String(
            source.createdEngineVersion ||
            ""
          ).slice(0, 160),
        elementIdentity:
          sanitizeApiCompositeElementIdentity(
            source.elementIdentity,
            {
              templateIdFallback:
                owner.parameters
                  ?.savedApiCompositeId ||
                "",
              nodes:
                sanitizedView.nodes,
              connections:
                sanitizedView.connections,
              boundaries
            }
          ),
        boundaryPorts: boundaries,
        branchRouting,
        customCSharpFiles:
          nodeGraphClone(
            sanitizedView
              .customCSharpFiles || {}
          ),
        apiCompositeGraphs:
          nodeGraphClone(
            sanitizedView
              .apiCompositeGraphs || {}
          ),
        ...graphViewFrom(sanitizedView)
      };
    }

    const validCustomCSharpOwnerIds =
      new Set(
        result.nodes
          .filter(node =>
            node.kind === "operator" &&
            node.operatorId ===
              "csharp.file"
          )
          .map(node => node.id)
      );
    for (const composite of Object.values(
      result.apiCompositeGraphs
    )) {
      for (const node of
        composite.nodes || []) {
        if (
          node.kind === "operator" &&
          node.operatorId ===
            "csharp.file"
        ) {
          validCustomCSharpOwnerIds.add(
            node.id
          );
        }
      }
    }
    for (const ownerId of Object.keys(
      result.customCSharpFiles
    )) {
      if (
        !validCustomCSharpOwnerIds.has(
          ownerId
        )
      ) {
        delete result.customCSharpFiles[
          ownerId
        ];
      }
    }

    if (apiCompositeDepth === 0) {
      reconcileApiCompositeBoundaryTree(
        result
      );
    }
    return result;
  }

function hashText(value) {
    let hash = 2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(
        hash,
        16777619
      );
    }

    return (
      hash >>> 0
    )
      .toString(16)
      .padStart(8, "0");
  }

function snapshotFromBuilder() {
    const state =
      bridge.getStateSnapshot();

    return {
      metadata:
        nodeGraphClone(state.metadata || {}),
      nodes:
        nodeGraphClone(state.nodes || [])
    };
  }

function flattenConfiguration(
    nodes,
    path = []
  ) {
    const entries = [];

    for (const node of nodes || []) {
      entries.push({
        node,
        path
      });

      if (node.kind === "controller") {
        for (const option of node.options || []) {
          entries.push(
            ...flattenConfiguration(
              option.children || [],
              [
                ...path,
                option.name || "Section"
              ]
            )
          );
        }
      } else if (node.kind === "layoutRow") {
        entries.push(
          ...flattenConfiguration(
            node.children || [],
            path
          )
        );
      }
    }

    return entries;
  }

function configurationValueType(node) {
    if (
      node?.kind === "setting" &&
      node.valueType === "button"
    ) {
      return "impulse";
    }

    if (
      node?.kind === "setting" &&
      node.valueType === "runtimeDisplay"
    ) {
      return "rmlDisplaySlot";
    }

    if (node.kind === "controller") {
      return `enum:${
        node.enumName ||
        "SettingsPage"
      }`;
    }

    if (node.valueType === "enum") {
      return `enum:${
        node.enumName ||
        "SettingOption"
      }`;
    }

    return node.valueType || "string";
  }

function configurationDefinition() {
    const snapshot =
      graph.configSnapshot ||
      snapshotFromBuilder();

    const metadata =
      snapshot.metadata || {};

    const outputs = [];

    for (
      const entry of
      flattenConfiguration(
        snapshot.nodes || []
      )
    ) {
      const node = entry.node;
      if (node.kind === "layoutRow") {
        continue;
      }
      const path =
        entry.path.length > 0
          ? entry.path.join(" / ")
          : "Always visible";

      outputs.push(
        port(
          `config-${node.id}`,
          node.fieldName ||
            node.keyName ||
            "Setting",
          configurationValueType(node),
          {
            reaction:
              node.valueType === "button"
                ? undefined
                : node.valueType === "runtimeDisplay"
                ? "stored"
                : RUNTIME_BEHAVIORS[
                    node.reaction
                  ]
                    ? node.reaction
                    : "stored",
            detail:
              node.valueType === "button"
                ? `${path} · RML menu button · direct Impulse on every press · ${
                    node.buttonLabel ||
                    node.keyName ||
                    "Run"
                  }`
                : node.valueType === "runtimeDisplay"
                ? `${path} · RML menu display binding · ${
                    node.keyName ||
                    "runtime display"
                  }`
                : node.dynamicSettingKind === "choice"
                  ? `${path} · Dynamic Choice selected value · ${
                      node.keyName ||
                      "dynamic choice"
                    } · connect this string output to any compatible runtime logic`
                  : `${path} · ${
                      node.keyName ||
                      "configuration key"
                    }`,
            sourceNodeId:
              node.id
          }
        )
      );
    }

    return {
      title:
        `Start · ${
          metadata.modName ||
          "Packed Configuration"
        }`,
      group: "Packed Configuration",
      symbol: "§",
      description:
        "Each configuration item is exposed exactly once. Values stay typed and reactive; Startup/Saved sockets can trigger impulses, while Button items are direct Impulse outputs that fire once per RML menu press.",
      inputs: [],
      outputs,
      width: 280
    };
  }

function configurationMenuDefinition() {
    const registered =
      OPERATOR_DEFINITIONS[
        "configuration.menuInstance"
      ] || {};
    const snapshot =
      graph.configSnapshot ||
      snapshotFromBuilder();
    const outputs = [
      ...(Array.isArray(
        registered.outputs
      )
        ? registered.outputs.filter(
            output =>
              output?.id === "menu"
          )
        : [])
    ];

    flattenConfiguration(
      snapshot.nodes || []
    ).forEach((entry, index) => {
      const node = entry.node;
      const path =
        entry.path.length > 0
          ? entry.path.join(" / ")
          : "Always visible";

      outputs.push(
        port(
          `item-${node.id}`,
          node.kind === "layoutRow"
            ? node.label || "Inline Row"
            : node.fieldName ||
            node.keyName ||
            `Item ${index + 1}`,
          "rmlConfigurationMenuItem",
          {
            detail:
              `${path} · Runtime menu item · ${
              node.kind === "layoutRow"
                ? `${node.label || "Inline Row"} · layout group`
                : node.keyName ||
                node.fieldName ||
                node.id
              }`,
            sourceNodeId: node.id,
            sourceKeyName:
              node.keyName || "",
            defaultOrder: index,
            readOnly:
              node.kind === "layoutRow" ||
              node.valueType ===
                "runtimeDisplay" ||
              node.valueType ===
                "button"
          }
        )
      );
    });

    return {
      ...registered,
      title:
        registered.title ||
        "Configuration Menu Instance",
      group:
        registered.group ||
        "Configuration Menu",
      inputs: [],
      outputs,
      width: Math.max(
        300,
        Number(registered.width) || 0
      )
    };
  }

function isConfigurationReactionConnection(
    fromRef,
    toRef
  ) {
    return Boolean(
      fromRef?.direction === "output" &&
      fromRef.node?.kind ===
        "configuration" &&
      (
        fromRef.spec?.type ===
          "impulse" ||
        runtimeBehaviorEmitsImpulse(
          fromRef.spec?.reaction
        )
      ) &&
      toRef?.direction === "input" &&
      toRef.spec?.type === "impulse"
    );
  }

function resolveNodeDefinition(node) {
    if (node.kind === "configuration") {
      return configurationDefinition();
    }

    if (
      node.operatorId ===
        "configuration.menuInstance"
    ) {
      return configurationMenuDefinition();
    }

    const definition =
      OPERATOR_DEFINITIONS[
        node.operatorId
      ];

    if (
      node.operatorId ===
        "constant.typedDefault"
    ) {
      const valueType =
        String(
          node.parameters?.valueType ||
          "object"
        );

      return {
        ...definition,
        title:
          `Default · ${typeLabel(valueType)}`,
        description:
          `Exact ${typeLabel(valueType)} fallback value. Replace it with a real source whenever runtime data is required.`,
        outputs: [
          port(
            "value",
            "Value",
            valueType,
            {
              detail:
                `Exact default(${graphCsType(valueType)})`
            }
          )
        ]
      };
    }

    if (
      typeof definition?.resolveDefinition ===
        "function"
    ) {
      try {
        const resolved =
          definition.resolveDefinition(
            node
          );

        if (
          resolved &&
          typeof resolved === "object" &&
          !Array.isArray(resolved)
        ) {
          return expandVariadicDefinition(node, {
            ...definition,
            ...resolved
          });
        }
      } catch (error) {
        console.error(
          `Dynamic node definition failed for ${node.operatorId}.`,
          error
        );
      }
    }

    return expandVariadicDefinition(node, definition);
  }

function nodeDefinition(node) {
    if (!node || typeof node !== "object") {
      return resolveNodeDefinition(node || {});
    }
    const cached = graphNodeDefinitionCache.get(node);
    if (cached !== undefined) {
      return cached;
    }
    const definition = resolveNodeDefinition(node);
    graphNodeDefinitionCache.set(node, definition);
    return definition;
  }

function variadicCount(node, direction, descriptor) {
    const key = direction === "input"
      ? "variadicInputCount"
      : "variadicOutputCount";
    const minimum = Math.max(2, Number(descriptor?.minimum) || 2);
    const maximum = Math.max(minimum, Number(descriptor?.maximum) || 64);
    const fallback = Math.max(minimum, Number(descriptor?.defaultCount) || minimum);
    return nodeGraphClamp(
      Math.trunc(Number(node?.parameters?.[key]) || fallback),
      minimum,
      maximum
    );
  }

function variadicPortLabel(index) {
    return index < 26
      ? String.fromCharCode(65 + index)
      : `Input ${index + 1}`;
  }

function variadicPortId(index) {
    return index < 26
      ? String.fromCharCode(97 + index)
      : `input${index + 1}`;
  }

function expandVariadicDefinition(node, definition) {
    if (!definition || node?.kind !== "operator") {
      return definition;
    }

    let inputs = definition.inputs || [];
    let outputs = definition.outputs || [];

    const inputDescriptor = definition.variadicInputs;
    if (inputDescriptor) {
      const count = variadicCount(node, "input", inputDescriptor);
      const template = inputDescriptor.template || inputs[0] || port("a", "A", "object");
      const preserved = Number(inputDescriptor.preserved || 0);
      const fixed = inputs.slice(0, preserved);
      const repeated = [];
      for (let index = 0; index < count; index += 1) {
        const id = inputDescriptor.idPrefix
          ? `${inputDescriptor.idPrefix}${index + 1}`
          : variadicPortId(index);
        const label = inputDescriptor.labelMode === "number"
          ? `${inputDescriptor.label || "Input"} ${index + 1}`
          : variadicPortLabel(index);
        repeated.push({
          ...template,
          id,
          label
        });
      }
      inputs = [...fixed, ...repeated];
    }

    const outputDescriptor = definition.variadicOutputs;
    if (outputDescriptor) {
      const count = variadicCount(node, "output", outputDescriptor);
      const template = outputDescriptor.template || outputs[0] || port("out1", "Output 1", "impulse");
      const preserved = Number(outputDescriptor.preserved || 0);
      const fixed = outputs.slice(0, preserved);
      const repeated = [];
      const configuredIds = Array.isArray(outputDescriptor.ids)
        ? outputDescriptor.ids
        : [];
      const configuredLabels = Array.isArray(outputDescriptor.labels)
        ? outputDescriptor.labels
        : [];
      for (let index = 0; index < count; index += 1) {
        repeated.push({
          ...template,
          id: configuredIds[index] ||
            `${outputDescriptor.idPrefix || "output"}${index + 1}`,
          label: configuredLabels[index] ||
            `${outputDescriptor.label || "Output"} ${index + 1}`
        });
      }
      outputs = [...fixed, ...repeated];
    }

    return {
      ...definition,
      inputs,
      outputs
    };
  }

function variadicInputIds(node) {
    const definition = nodeDefinition(node);
    return (definition?.inputs || []).map(spec => spec.id);
  }

function variadicReduceCode(node, input, helperName, csType) {
    const ids = variadicInputIds(node);
    if (ids.length === 0) {
      return graphCsDefault("float");
    }
    let code = input(ids[0]).code;
    for (let index = 1; index < ids.length; index += 1) {
      code = `${helperName}<${csType}>(${code}, ${input(ids[index]).code})`;
    }
    return code;
  }

function definitionHasSockets(
    definition
  ) {
    return Boolean(
      (definition?.inputs?.length || 0) > 0 ||
      (definition?.outputs?.length || 0) > 0
    );
  }

function normalizePortLayoutParameter(
    parameters,
    definition,
    forceSupported = false
  ) {
    if (
      !parameters ||
      typeof parameters !== "object"
    ) {
      return parameters;
    }

    if (
      forceSupported ||
      definitionHasSockets(definition)
    ) {
      parameters.portLayout =
        parameters.portLayout === "mirrored"
          ? "mirrored"
          : "standard";
    } else {
      delete parameters.portLayout;
    }

    return parameters;
  }

function findGraphNode(nodeId) {
    if (
      graphNodeLookupSource !== graph.nodes ||
      graphNodeLookupLength !== graph.nodes.length
    ) {
      graphNodeLookupSource = graph.nodes;
      graphNodeLookupLength = graph.nodes.length;
      graphNodeLookupCache = new Map(
        graph.nodes.map(node => [node.id, node])
      );
    }
    return graphNodeLookupCache.get(nodeId) || null;
  }

function findPortSpec(
    nodeId,
    portId,
    direction
  ) {
    const node =
      findGraphNode(nodeId);

    if (!node) {
      return null;
    }

    const definition =
      nodeDefinition(node);

    const list =
      direction === "input"
        ? definition?.inputs || []
        : definition?.outputs || [];

    const spec =
      list.find(
        candidate =>
          candidate.id === portId
      );

    return spec
      ? {
          node,
          definition,
          spec,
          direction
        }
      : null;
  }

function genericVariableKey(
    nodeId,
    typeVar
  ) {
    return `${nodeId}\u0000${typeVar}`;
  }

function graphConcreteTypes() {
    const result = new Set();
    const collectorElementTypes =
      new Set();

    const addType = type => {
      if (
        !type ||
        type === "generic" ||
        type === "auto" ||
        type === "impulse" ||
        result.has(type)
      ) {
        return;
      }

      result.add(type);

      if (!isCollectListType(type)) {
        collectorElementTypes.add(type);
      }

      const elementType =
        TYPE_INFO[typeBase(type)]
          ?.enumerableElementType;

      if (
        typeof elementType === "string" &&
        elementType &&
        elementType !== type
      ) {
        addType(elementType);
      }
    };

    for (const type of VALUE_TYPES) {
      addType(type);
    }

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);

      for (const spec of [
        ...(definition?.inputs || []),
        ...(definition?.outputs || [])
      ]) {
        addType(spec.type);
      }
    }

    for (const elementType of
      collectorElementTypes) {
      const collectionType =
        ensureCollectListType(
          elementType
        );

      if (collectionType) {
        result.add(collectionType);
      }
    }

    return [...result];
  }

function genericVariableDefault(variable) {
    const constraints = variable.specs.map(
      spec => spec.constraint || "value"
    );

    if (
      constraints.some(constraint =>
        [
          "scalar",
          "ordered",
          "arithmetic",
          "interpolatable"
        ].includes(constraint)
      )
    ) {
      return "float";
    }

    if (variable.domain.has("object")) {
      return "object";
    }

    return variable.domain.has("string")
      ? "string"
      : [...variable.domain][0] || null;
  }

function numericPreferenceFromConstant(variable) {
    if (variable.node.operatorId === "constant.number") {
      const parsed = validateNumericValue(
        variable.node.parameters?.value ?? "0",
        "double",
        { coerce: false }
      );

      if (!parsed.valid) {
        return [];
      }

      return Number.isInteger(parsed.number) &&
        parsed.number >= GRAPH_INT32_MIN &&
        parsed.number <= GRAPH_INT32_MAX
          ? ["int", "float", "double"]
          : ["float", "double"];
    }

    if (variable.node.operatorId === "constant.vector") {
      const raw = String(
        variable.node.parameters?.components || "0, 0, 0"
      );
      const componentCount = nodeGraphClamp(
        raw.split(",").length,
        2,
        4
      );
      const allIntegers = raw
        .split(",")
        .map(part => part.trim())
        .every(part =>
          validateNumericValue(
            part || "0",
            "int",
            { coerce: false }
          ).valid
        );
      const families = allIntegers
        ? ["int", "float", "double"]
        : ["float", "double"];

      return families.map(
        family => `${family}${componentCount}`
      );
    }

    return [];
  }

function typeSortValue(type) {
    const scalarRank = scalarNumericRank(type);
    if (scalarRank >= 0) {
      return scalarRank;
    }

    const vector = numericVectorInfo(type);
    if (vector) {
      return 10 +
        vector.componentCount * 3 +
        scalarNumericRank(vector.scalarType);
    }

    const preferred = [
      "bool",
      "string",
      "Uri",
      "colorX",
      "object"
    ];
    const index = preferred.indexOf(type);
    return index >= 0
      ? 100 + index
      : 1000;
  }

function variableCandidateOrder(variable) {
    const ordered = [];
    const add = value => {
      if (
        value &&
        variable.domain.has(value) &&
        !ordered.includes(value)
      ) {
        ordered.push(value);
      }
    };

    add(variable.explicitType);

    const incomingPromotion = promotedScalarNumericType(
      variable.incomingFixed
    );
    add(incomingPromotion);
    for (const type of variable.incomingFixed) {
      add(type);
    }

    const outgoingNumeric = variable.outgoingFixed.filter(
      nodeGraphIsScalarNumericType
    );
    if (outgoingNumeric.length > 0) {
      add(
        scalarNumericTypeAtRank(
          Math.min(
            ...outgoingNumeric.map(scalarNumericRank)
          )
        )
      );
    }
    for (const type of variable.outgoingFixed) {
      add(type);
    }

    const hasFixedEvidence =
      variable.incomingFixed.length > 0 ||
      variable.outgoingFixed.length > 0;

    if (!hasFixedEvidence) {
      add(variable.fallbackType);
    }

    for (const type of numericPreferenceFromConstant(variable)) {
      add(type);
    }

    add(variable.fallbackType);
    add(genericVariableDefault(variable));

    for (
      const type of [...variable.domain].sort(
        (left, right) =>
          typeSortValue(left) - typeSortValue(right) ||
          typeLabel(left).localeCompare(typeLabel(right))
      )
    ) {
      add(type);
    }

    return ordered;
  }

function graphAnalysisPortContract(spec) {
    return [
      String(spec?.id || ""),
      String(spec?.label || ""),
      String(spec?.type || ""),
      String(spec?.typeVar || ""),
      String(spec?.constraint || ""),
      String(spec?.reaction || "")
    ];
  }

function graphAnalysisDefinitionContract(
    definition
  ) {
    return [
      String(definition?.title || ""),
      String(
        definition?.configurableTypeVar || ""
      ),
      Array.isArray(
        definition?.configurableTypes
      )
        ? definition.configurableTypes.map(type =>
            String(type || "")
          )
        : [],
      String(definition?.autoFallbackType || ""),
      String(definition?.defaultType || ""),
      (definition?.inputs || []).map(
        graphAnalysisPortContract
      ),
      (definition?.outputs || []).map(
        graphAnalysisPortContract
      ),
      (Array.isArray(definition?.genericRelations)
        ? definition.genericRelations
        : []
      ).map(relation => [
        String(relation?.kind || ""),
        String(
          relation?.collectionTypeVar || ""
        ),
        String(
          relation?.elementTypeVar || ""
        ),
        relation?.exact === true
      ])
    ];
  }

function graphAnalysisTypeContract(type) {
    const information =
      TYPE_INFO[type] || {};
    return [
      type,
      String(information.label || ""),
      Array.isArray(information.constraints)
        ? information.constraints.map(value =>
            String(value || "")
          )
        : [],
      information.referenceType === true,
      information.enumType === true,
      information.acceptsAnyValue === true,
      Array.isArray(information.assignableTo)
        ? information.assignableTo.map(value =>
            String(value || "")
          )
        : [],
      Array.isArray(information.acceptsTypes)
        ? information.acceptsTypes.map(value =>
            String(value || "")
          )
        : [],
      String(information.csType || ""),
      information.collectorCollection === true,
      String(
        information.enumerableElementType || ""
      )
    ];
  }

function createGraphAnalysisFingerprint() {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    let third = 0x85ebca6b;
    let fourth = 0xc2b2ae35;

    const mix = rawValue => {
      const value = Number(rawValue) >>> 0;
      first = Math.imul(
        first ^ value,
        0x01000193
      );
      second = Math.imul(
        second ^ ((value + 0x9e3779b9) >>> 0),
        0x85ebca6b
      );
      third = Math.imul(
        (third + value) >>> 0,
        0xc2b2ae35
      );
      third ^= third >>> 13;
      fourth ^= (
        value +
        0x9e3779b9 +
        (fourth << 6) +
        (fourth >>> 2)
      ) >>> 0;
      fourth = Math.imul(
        fourth,
        0x27d4eb2f
      );
    };

    const addText = value => {
      const text = String(value);
      mix(6);
      mix(text.length);
      let left = 0x811c9dc5;
      let right = 0x9e3779b9;
      for (
        let index = 0;
        index < text.length;
        index += 1
      ) {
        const code = text.charCodeAt(index);
        left = Math.imul(
          left ^ code,
          0x01000193
        );
        right = Math.imul(
          right ^ ((code + index) >>> 0),
          0x85ebca6b
        );
      }
      mix(left);
      mix(right);
    };

    const add = value => {
      if (Array.isArray(value)) {
        mix(1);
        mix(value.length);
        for (const item of value) {
          add(item);
        }
        mix(0xffffffff);
        return;
      }
      if (value === null) {
        mix(2);
        return;
      }
      switch (typeof value) {
        case "boolean":
          mix(value ? 3 : 4);
          return;
        case "number":
          mix(5);
          add(String(value));
          return;
        case "string":
          addText(value);
          return;
        case "undefined":
          mix(7);
          return;
        default:
          mix(8);
          add(String(value));
      }
    };

    const avalanche = value => {
      let result = value >>> 0;
      result ^= result >>> 16;
      result = Math.imul(result, 0x85ebca6b);
      result ^= result >>> 13;
      result = Math.imul(result, 0xc2b2ae35);
      result ^= result >>> 16;
      return result >>> 0;
    };

    return {
      add,
      addText,
      digest() {
        return [first, second, third, fourth]
          .map(value =>
            avalanche(value)
              .toString(16)
              .padStart(8, "0")
          )
          .join("");
      }
    };
  }

function observableGraphAnalysisMutationEpoch() {
    try {
      return typeof graphAnalysisMutationSequence ===
        "number"
        ? graphAnalysisMutationSequence
        : null;
    } catch {
      return null;
    }
  }

function graphAnalysisSemanticToken(
    connections,
    sourceGraph = graph,
    { refresh = false } = {}
  ) {
    if (
      !sourceGraph ||
      !Array.isArray(sourceGraph.nodes) ||
      !Array.isArray(connections)
    ) {
      return "";
    }

    const mutationEpoch =
      observableGraphAnalysisMutationEpoch();
    const definitionEpoch = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    const factoryEpoch = Number(
      window.__RMLApiNodeFactoryVersion
    ) || 0;
    const catalogFingerprint = String(
      window.RMLApiNodeFactoryReport
        ?.catalogFingerprint || ""
    );
    const catalogId = hashText(
      catalogFingerprint
    );
    const valueTypeCount =
      VALUE_TYPES.length;
    const typeInformationCount =
      Object.keys(TYPE_INFO).length;
    const identityCached =
      graphAnalysisIdentityTokens.get(
        connections
      );
    if (
      !refresh &&
      mutationEpoch !== null &&
      identityCached?.sourceGraph === sourceGraph &&
      identityCached.nodes === sourceGraph.nodes &&
      identityCached.mutationEpoch === mutationEpoch &&
      identityCached.definitionEpoch === definitionEpoch &&
      identityCached.factoryEpoch === factoryEpoch &&
      identityCached.catalogId === catalogId &&
      identityCached.valueTypeCount ===
        valueTypeCount &&
      identityCached.typeInformationCount ===
        typeInformationCount &&
      identityCached.nodeCount ===
        sourceGraph.nodes.length &&
      identityCached.connectionCount ===
        connections.length
    ) {
      return identityCached.token;
    }

    // Materialize canonical collector types before taking the registry
    // snapshot. This is also done by analysis and keeps the first and later
    // tokens identical.
    graphConcreteTypes();

    const fingerprint =
      createGraphAnalysisFingerprint();
    const staticDefinitionIndexes =
      new WeakMap();
    const staticDefinitionFingerprints = [];
    fingerprint.addText(JSON.stringify([
        GRAPH_SCHEMA_VERSION,
        Boolean(customCSharpEditor),
        definitionEpoch,
        factoryEpoch,
        catalogFingerprint,
        VALUE_TYPES.map(type => String(type || "")),
        Object.keys(TYPE_INFO)
          .sort()
          .map(graphAnalysisTypeContract)
      ]));

    let nodeChunk = [];
    const nodeIndexById = new Map();
    for (
      let nodeIndex = 0;
      nodeIndex < sourceGraph.nodes.length;
      nodeIndex += 1
    ) {
      const node = sourceGraph.nodes[nodeIndex];
      nodeIndexById.set(node?.id, nodeIndex);
      const definition = nodeDefinition(node);
      const registeredDefinition =
        node?.kind === "operator"
          ? OPERATOR_DEFINITIONS[
              node.operatorId
            ]
          : null;
      const staticDefinition = Boolean(
        registeredDefinition &&
        node.operatorId !==
          "constant.typedDefault" &&
        node.operatorId !==
          "configuration.menuInstance" &&
        typeof registeredDefinition
          .resolveDefinition !== "function" &&
        !registeredDefinition.variadicInputs &&
        !registeredDefinition.variadicOutputs
      );
      let staticDefinitionIndex =
        staticDefinition
          ? staticDefinitionIndexes.get(
              registeredDefinition
            )
          : null;
      let definitionIdentity = null;
      if (
        staticDefinition &&
        staticDefinitionIndex !== undefined &&
        staticDefinitionIndex !== null
      ) {
        definitionIdentity = [
          "static",
          staticDefinitionIndex
        ];
      } else {
        const contractFingerprint =
          createGraphAnalysisFingerprint();
        contractFingerprint.addText(
          JSON.stringify(
            graphAnalysisDefinitionContract(
              definition
            )
          )
        );
        const definitionFingerprint =
          contractFingerprint.digest();
        if (staticDefinition) {
          staticDefinitionIndex =
            staticDefinitionFingerprints.length;
          staticDefinitionIndexes.set(
            registeredDefinition,
            staticDefinitionIndex
          );
          staticDefinitionFingerprints.push([
            String(node.operatorId || ""),
            definitionFingerprint
          ]);
          definitionIdentity = [
            "static",
            staticDefinitionIndex
          ];
        } else {
          definitionIdentity = [
            "dynamic",
            definitionFingerprint
          ];
        }
      }
      if (!definitionIdentity) {
        definitionIdentity = [
          "missing",
          ""
        ];
      }
      nodeChunk.push([
        String(node?.id || ""),
        String(node?.kind || ""),
        String(node?.operatorId || ""),
        definitionIdentity,
        String(
          node?.parameters?.valueType || ""
        ),
        String(node?.parameters?.value ?? ""),
        String(
          node?.parameters?.components ?? ""
        ),
        String(
          node?.parameters?.autoVectorType || ""
        )
      ]);
      if (nodeChunk.length >= 128) {
        fingerprint.addText(
          JSON.stringify(nodeChunk)
        );
        nodeChunk = [];
      }
    }
    if (nodeChunk.length > 0) {
      fingerprint.addText(
        JSON.stringify(nodeChunk)
      );
    }
    fingerprint.addText(
      JSON.stringify(
        staticDefinitionFingerprints
      )
    );

    let connectionChunk = [];
    for (const connection of connections) {
      const fromIndex = nodeIndexById.get(
        connection?.fromNode
      );
      const toIndex = nodeIndexById.get(
        connection?.toNode
      );
      connectionChunk.push([
        String(connection?.id || ""),
        fromIndex === undefined
          ? ["missing", String(connection?.fromNode || "")]
          : fromIndex,
        String(connection?.fromPort || ""),
        toIndex === undefined
          ? ["missing", String(connection?.toNode || "")]
          : toIndex,
        String(connection?.toPort || "")
      ]);
      if (connectionChunk.length >= 128) {
        fingerprint.addText(
          JSON.stringify(connectionChunk)
        );
        connectionChunk = [];
      }
    }
    if (connectionChunk.length > 0) {
      fingerprint.addText(
        JSON.stringify(connectionChunk)
      );
    }

    const token = [
      "ga3",
      sourceGraph.nodes.length,
      connections.length,
      VALUE_TYPES.length,
      typeInformationCount,
      definitionEpoch,
      factoryEpoch,
      catalogId,
      fingerprint.digest()
    ].join(":");
    if (mutationEpoch !== null) {
      graphAnalysisIdentityTokens.set(
        connections,
        {
          sourceGraph,
          nodes: sourceGraph.nodes,
          mutationEpoch,
          definitionEpoch,
          factoryEpoch,
          catalogId,
          valueTypeCount,
          typeInformationCount,
          nodeCount:
            sourceGraph.nodes.length,
          connectionCount:
            connections.length,
          token
        }
      );
    }
    return token;
  }

function cloneGraphAnalysis(analysis) {
    return {
      valid: analysis?.valid === true,
      reason: String(analysis?.reason || ""),
      bindings: new Map(
        [...(analysis?.bindings || new Map())]
          .map(([nodeId, bindings]) => [
            nodeId,
            { ...(bindings || {}) }
          ])
      )
    };
  }

function cachedGraphAnalysis(token) {
    if (!token || !graphAnalysisCache.has(token)) {
      return null;
    }
    const cached = graphAnalysisCache.get(token);
    graphAnalysisCache.delete(token);
    graphAnalysisCache.set(token, cached);
    return cloneGraphAnalysis(cached);
  }

function cacheGraphAnalysis(token, analysis) {
    if (!token || !analysis) {
      return;
    }
    graphAnalysisCache.delete(token);
    graphAnalysisCache.set(
      token,
      cloneGraphAnalysis(analysis)
    );
    while (
      graphAnalysisCache.size >
        GRAPH_ANALYSIS_CACHE_LIMIT
    ) {
      graphAnalysisCache.delete(
        graphAnalysisCache.keys().next().value
      );
    }
  }

function graphAnalysisCatalogId() {
    return hashText(
      String(
        window.RMLApiNodeFactoryReport
          ?.catalogFingerprint || ""
      )
    );
  }

function createGraphAnalysisCertificate(
    connections,
    analysis
  ) {
    if (
      analysis?.valid !== true ||
      !(analysis.bindings instanceof Map) ||
      graph?.connections !== connections
    ) {
      return null;
    }
    const token =
      lastGraphAnalysisRecord?.sourceGraph === graph &&
      lastGraphAnalysisRecord?.nodes === graph.nodes &&
      lastGraphAnalysisRecord?.connections === connections
        ? lastGraphAnalysisRecord.token
        : graphAnalysisSemanticToken(
            connections,
            graph,
            { refresh: true }
          );
    const bindings = [...analysis.bindings]
      .filter(([, values]) =>
        values &&
        Object.keys(values).length > 0
      )
      .map(([nodeId, values]) =>
        Object.freeze([
          String(nodeId || ""),
          Object.freeze({ ...values })
        ])
      );
    const certificate = Object.freeze({
      schemaVersion:
        GRAPH_ANALYSIS_CERTIFICATE_SCHEMA_VERSION,
      moduleId:
        "1.20.31-universal-presentation-dev23",
      semanticToken: token,
      nodeCount: graph.nodes.length,
      connectionCount: connections.length,
      definitionEpoch:
        Number(
          window.__RMLNodeDefinitionRevision
        ) || 0,
      factoryEpoch:
        Number(
          window.__RMLApiNodeFactoryVersion
        ) || 0,
      catalogId: graphAnalysisCatalogId(),
      valid: true,
      bindings: Object.freeze(bindings),
      autoVectorUpdates: Object.freeze([])
    });
    trustedGraphAnalysisCertificates.add(
      certificate
    );
    return certificate;
  }

function graphAnalysisCertificateEnvelopeValid(
    certificate
  ) {
    return Boolean(
      certificate &&
      typeof certificate === "object" &&
      !Array.isArray(certificate) &&
      Number(certificate.schemaVersion) ===
        GRAPH_ANALYSIS_CERTIFICATE_SCHEMA_VERSION &&
      certificate.moduleId ===
        "1.20.31-universal-presentation-dev23" &&
      certificate.valid === true &&
      typeof certificate.semanticToken ===
        "string" &&
      certificate.semanticToken.startsWith(
        "ga3:"
      ) &&
      Array.isArray(certificate.bindings) &&
      Array.isArray(
        certificate.autoVectorUpdates
      )
    );
  }

function acceptGraphAnalysisCertificate(
    certificate,
    { transferred = false } = {}
  ) {
    if (
      !graphAnalysisCertificateEnvelopeValid(
        certificate
      ) ||
      (
        !transferred &&
        !trustedGraphAnalysisCertificates.has(
          certificate
        )
      )
    ) {
      return false;
    }
    pendingGraphAnalysisCertificate =
      certificate;
    return true;
  }

function graphAnalysisFromCertificate(
    certificate,
    connections,
    semanticToken
  ) {
    if (
      !graphAnalysisCertificateEnvelopeValid(
        certificate
      ) ||
      !graph ||
      graph.connections !== connections ||
      certificate.semanticToken !==
        semanticToken ||
      Number(certificate.nodeCount) !==
        graph.nodes.length ||
      Number(certificate.connectionCount) !==
        connections.length ||
      Number(certificate.definitionEpoch) !==
        (
          Number(
            window.__RMLNodeDefinitionRevision
          ) || 0
        ) ||
      Number(certificate.factoryEpoch) !==
        (
          Number(
            window.__RMLApiNodeFactoryVersion
          ) || 0
        ) ||
      certificate.catalogId !==
        graphAnalysisCatalogId()
    ) {
      return null;
    }

    const concreteTypes = new Set(
      graphConcreteTypes()
    );
    const bindings = new Map(
      graph.nodes.map(node => [node.id, {}])
    );
    const seenNodeIds = new Set();
    for (const row of certificate.bindings) {
      if (
        !Array.isArray(row) ||
        row.length !== 2 ||
        typeof row[0] !== "string" ||
        !row[1] ||
        typeof row[1] !== "object" ||
        Array.isArray(row[1]) ||
        seenNodeIds.has(row[0]) ||
        !bindings.has(row[0])
      ) {
        return null;
      }
      const node = findGraphNode(row[0]);
      const definition = nodeDefinition(node);
      const values = {};
      for (const [typeVar, type] of
        Object.entries(row[1])) {
        const specs = [
          ...(definition?.inputs || []),
          ...(definition?.outputs || [])
        ].filter(spec =>
          spec?.typeVar === typeVar
        );
        if (
          specs.length === 0 ||
          typeof type !== "string" ||
          !concreteTypes.has(type) ||
          (
            definition?.configurableTypeVar ===
              typeVar &&
            Array.isArray(
              definition.configurableTypes
            ) &&
            !definition.configurableTypes.includes(
              type
            )
          ) ||
          !specs.every(spec =>
            typeMatchesConstraint(
              type,
              spec.constraint || "value"
            )
          ) ||
          !nodeAllowsConcreteType(
            node,
            definition,
            type
          )
        ) {
          return null;
        }
        values[typeVar] = type;
      }
      seenNodeIds.add(row[0]);
      bindings.set(row[0], values);
    }

    for (const node of graph.nodes) {
      const definition = nodeDefinition(node);
      const typeVariables = new Set(
        [
          ...(definition?.inputs || []),
          ...(definition?.outputs || [])
        ]
          .map(spec =>
            String(spec?.typeVar || "")
          )
          .filter(Boolean)
      );
      const nodeBindings =
        bindings.get(node.id) || {};
      if (
        [...typeVariables].some(typeVar =>
          typeof nodeBindings[typeVar] !==
            "string"
        )
      ) {
        return null;
      }
    }

    return {
      valid: true,
      reason: "",
      bindings
    };
  }

function analyzeConnectionsCore(
    connections,
    options = {}
  ) {
    graphAnalysisCoreRunCount += 1;
    const concreteTypes = graphConcreteTypes();
    const compatibilityBySourceType = new Map();
    const typesCompatible = (
      fromType,
      toType
    ) => {
      let byTargetType =
        compatibilityBySourceType.get(
          fromType
        );
      if (!byTargetType) {
        byTargetType = new Map();
        compatibilityBySourceType.set(
          fromType,
          byTargetType
        );
      }
      if (byTargetType.has(toType)) {
        return byTargetType.get(toType);
      }
      const compatible =
        connectionTypesCompatible(
          fromType,
          toType
        );
      byTargetType.set(
        toType,
        compatible
      );
      return compatible;
    };
    const variables = new Map();
    const domainTemplates = new Map();
    const allowedTypeListIds = new WeakMap();
    let nextAllowedTypeListId = 1;
    const allowedTypeListId = values => {
      if (
        values &&
        typeof values === "object"
      ) {
        let id = allowedTypeListIds.get(values);
        if (!id) {
          id = nextAllowedTypeListId;
          nextAllowedTypeListId += 1;
          allowedTypeListIds.set(values, id);
        }
        return id;
      }
      return String(values || "");
    };

    for (const node of graph.nodes) {
      const definition = nodeDefinition(node);
      const grouped = new Map();

      for (const spec of [
        ...(definition?.inputs || []),
        ...(definition?.outputs || [])
      ]) {
        if (!spec.typeVar) {
          continue;
        }
        const list = grouped.get(spec.typeVar) || [];
        list.push(spec);
        grouped.set(spec.typeVar, list);
      }

      for (const [typeVar, specs] of grouped) {
        const key = genericVariableKey(node.id, typeVar);
        const configurable =
          definition?.configurableTypeVar === typeVar;
        const allowed = configurable
          ? definition.configurableTypes || VALUE_TYPES
          : concreteTypes;
        const configured = configurable
          ? node.parameters?.valueType
          : null;
        const explicitType =
          configured &&
          configured !== "auto" &&
          allowed.includes(configured)
            ? configured
            : null;
        const domainKey = [
          allowedTypeListId(allowed),
          explicitType || "",
          specs
            .map(spec =>
              String(
                spec.constraint || "value"
              )
            )
            .join("\u0001"),
          node.operatorId === "constant.number"
            ? `constant.number:${String(
                node.parameters?.value ?? ""
              )}`
            : node.operatorId === "constant.vector"
              ? `constant.vector:${String(
                  node.parameters?.components ?? ""
                )}`
              : ""
        ].join("\u0000");
        let domainValues =
          domainTemplates.get(domainKey);
        if (!domainValues) {
          domainValues = (
            explicitType ? [explicitType] : allowed
          ).filter(
              type =>
                type &&
                type !== "generic" &&
                type !== "auto" &&
                specs.every(spec =>
                  typeMatchesConstraint(
                    type,
                    spec.constraint || "value"
                  )
                ) &&
                nodeAllowsConcreteType(
                  node,
                  definition,
                  type
                )
            );
          domainTemplates.set(
            domainKey,
            domainValues
          );
        }
        const domain = new Set(domainValues);

        if (domain.size === 0) {
          return {
            valid: false,
            reason:
              node.operatorId === "constant.number"
                ? `Number Constant value ${String(node.parameters?.value ?? "")} is not valid for the selected numeric type.`
                : node.operatorId === "constant.vector"
                  ? "Vector Constant components are not valid for the selected vector type."
                  : `${definition?.title || "Node"} has no valid concrete type for generic ${typeVar}.`,
            bindings: new Map()
          };
        }

        variables.set(key, {
          key,
          node,
          definition,
          typeVar,
          specs,
          domain,
          explicitType,
          fallbackType:
            configurable
              ? fallbackTypeForDefinition(definition)
              : null,
          incomingFixed: [],
          outgoingFixed: []
        });
      }
    }

    const genericRelations = [];

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);

      for (const descriptor of
        Array.isArray(
          definition?.genericRelations
        )
          ? definition.genericRelations
          : []) {
        if (
          descriptor?.kind !==
            "enumerableElement"
        ) {
          continue;
        }

        const collectionTypeVar =
          String(
            descriptor.collectionTypeVar ||
            ""
          );
        const elementTypeVar =
          String(
            descriptor.elementTypeVar ||
            ""
          );
        const collectionKey =
          genericVariableKey(
            node.id,
            collectionTypeVar
          );
        const elementKey =
          genericVariableKey(
            node.id,
            elementTypeVar
          );
        const collectionVariable =
          variables.get(collectionKey);
        const elementVariable =
          variables.get(elementKey);

        if (
          !collectionVariable ||
          !elementVariable
        ) {
          return {
            valid: false,
            reason:
              `${definition?.title || "Node"} contains an invalid enumerable generic relation.`,
            bindings: new Map()
          };
        }

        genericRelations.push({
          node,
          definition,
          exact:
            descriptor.exact === true,
          collection: {
            key: collectionKey,
            variable: collectionVariable
          },
          element: {
            key: elementKey,
            variable: elementVariable
          }
        });
      }
    }

    const termFor = portRef => {
      if (portRef.spec.type) {
        return {
          fixed: true,
          type: portRef.spec.type,
          portRef
        };
      }

      if (portRef.spec.typeVar) {
        const key = genericVariableKey(
          portRef.node.id,
          portRef.spec.typeVar
        );
        return {
          fixed: false,
          key,
          variable: variables.get(key),
          portRef
        };
      }

      return null;
    };

    const edges = [];

    for (const connection of connections) {
      const fromRef = findPortSpec(
        connection.fromNode,
        connection.fromPort,
        "output"
      );
      const toRef = findPortSpec(
        connection.toNode,
        connection.toPort,
        "input"
      );

      if (!fromRef || !toRef) {
        const missing = [];
        const sourceNode =
          findGraphNode(
            connection.fromNode
          );
        const targetNode =
          findGraphNode(
            connection.toNode
          );

        if (!fromRef) {
          missing.push(
            sourceNode
              ? `source port '${connection.fromPort}' on node '${sourceNode.operatorId || sourceNode.label || sourceNode.id}'`
              : `source node '${connection.fromNode}'`
          );
        }

        if (!toRef) {
          missing.push(
            targetNode
              ? `target port '${connection.toPort}' on node '${targetNode.operatorId || targetNode.label || targetNode.id}'`
              : `target node '${connection.toNode}'`
          );
        }

        return {
          valid: false,
          reason:
            `Connection '${connection.id || "unnamed"}' references a missing ${missing.join(" and ")}: '${connection.fromNode}.${connection.fromPort}' → '${connection.toNode}.${connection.toPort}'.`,
          bindings: new Map()
        };
      }

      const targetIsImpulse =
        toRef.spec?.type ===
          "impulse";
      const sourceIsConfiguration =
        fromRef.node?.kind ===
          "configuration";
      const reactiveConfigurationEdge =
        isConfigurationReactionConnection(
          fromRef,
          toRef
        );

      if (
        sourceIsConfiguration &&
        targetIsImpulse &&
        !reactiveConfigurationEdge
      ) {
        return {
          valid: false,
          reason:
            `${fromRef.definition.title} · ${fromRef.spec.label} is Stored only and cannot trigger an impulse. Select Startup, Saved or Startup + Saved in the Configuration Outline.`,
          bindings: new Map()
        };
      }

      const from =
        reactiveConfigurationEdge
          ? {
              fixed: true,
              type: "impulse",
              portRef: fromRef
            }
          : termFor(fromRef);
      const to = termFor(toRef);
      if (!from || !to) {
        return {
          valid: false,
          reason:
            "A connection references an unresolved port type.",
          bindings: new Map()
        };
      }

      const edge = {
        connection,
        from,
        to,
        reactiveConfigurationEdge
      };
      edges.push(edge);

      if (!from.fixed && to.fixed) {
        from.variable?.outgoingFixed.push(to.type);
      }
      if (from.fixed && !to.fixed) {
        to.variable?.incomingFixed.push(from.type);
      }
    }

    const valuesFor = term =>
      term.fixed
        ? [term.type]
        : [...term.variable.domain];

    let changed = true;
    let pass = 0;

    while (changed && pass < 256) {
      changed = false;
      pass += 1;

      for (const edge of edges) {
        const fromValues = valuesFor(edge.from);
        const toValues = valuesFor(edge.to);

        if (
          !fromValues.some(fromType =>
            toValues.some(toType =>
              typesCompatible(fromType, toType)
            )
          )
        ) {
          return {
            valid: false,
            reason:
              `No safe type can connect ${edge.from.portRef.definition.title} · ${edge.from.portRef.spec.label} to ${edge.to.portRef.definition.title} · ${edge.to.portRef.spec.label}. Narrowing conversions require an explicit conversion node.`,
            bindings: new Map()
          };
        }

        if (!edge.from.fixed) {
          for (const type of fromValues) {
            if (
              !toValues.some(toType =>
                typesCompatible(type, toType)
              )
            ) {
              edge.from.variable.domain.delete(type);
              changed = true;
            }
          }
        }

        if (!edge.to.fixed) {
          const latestFromValues = valuesFor(edge.from);
          for (const type of toValues) {
            if (
              !latestFromValues.some(fromType =>
                typesCompatible(fromType, type)
              )
            ) {
              edge.to.variable.domain.delete(type);
              changed = true;
            }
          }
        }

        if (
          (!edge.from.fixed && edge.from.variable.domain.size === 0) ||
          (!edge.to.fixed && edge.to.variable.domain.size === 0)
        ) {
          return {
            valid: false,
            reason:
              `The connection between ${edge.from.portRef.definition.title} and ${edge.to.portRef.definition.title} leaves no valid concrete type.`,
            bindings: new Map()
          };
        }
      }

      for (const relation of genericRelations) {
        const collectionValues =
          [...relation.collection.variable.domain];
        const itemValues =
          [...relation.element.variable.domain];

        for (const collectionType of collectionValues) {
          if (
            !itemValues.some(itemType =>
              genericCollectionRelationCompatible(
                relation,
                collectionType,
                itemType
              )
            )
          ) {
            relation.collection.variable
              .domain.delete(collectionType);
            changed = true;
          }
        }

        const remainingCollections =
          [...relation.collection.variable.domain];

        for (const itemType of itemValues) {
          if (
            !remainingCollections.some(
              collectionType =>
                genericCollectionRelationCompatible(
                  relation,
                  collectionType,
                  itemType
                )
            )
          ) {
            relation.element.variable
              .domain.delete(itemType);
            changed = true;
          }
        }

        if (
          relation.collection.variable
            .domain.size === 0 ||
          relation.element.variable
            .domain.size === 0
        ) {
          return {
            valid: false,
            reason:
              `${relation.definition?.title || "For Each"} cannot infer a compatible collection item type.`,
            bindings: new Map()
          };
        }
      }
    }

    const edgesByVariable = new Map();
    for (const key of variables.keys()) {
      edgesByVariable.set(key, []);
    }
    for (const edge of edges) {
      if (!edge.from.fixed) {
        edgesByVariable.get(edge.from.key)?.push(edge);
      }
      if (!edge.to.fixed) {
        edgesByVariable.get(edge.to.key)?.push(edge);
      }
    }

    const relationsByVariable =
      new Map(
        [...variables.keys()].map(
          key => [key, []]
        )
      );

    for (const relation of genericRelations) {
      relationsByVariable
        .get(relation.collection.key)
        ?.push(relation);
      relationsByVariable
        .get(relation.element.key)
        ?.push(relation);
    }

    const assignments = new Map();
    const candidateOrders = new Map(
      [...variables].map(([key, variable]) => [
        key,
        variableCandidateOrder(variable)
      ])
    );
    let solveSteps = 0;

    const termAssignedType = (
      term,
      candidateKey = null,
      candidateType = null
    ) => {
      if (term.fixed) {
        return term.type;
      }
      if (term.key === candidateKey) {
        return candidateType;
      }
      return assignments.get(term.key) || null;
    };

    const candidateFitsAssignedEdges = (key, candidate) => {
      for (const edge of edgesByVariable.get(key) || []) {
        const fromType = termAssignedType(
          edge.from,
          key,
          candidate
        );
        const toType = termAssignedType(
          edge.to,
          key,
          candidate
        );

        if (
          fromType &&
          toType &&
          !typesCompatible(fromType, toType)
        ) {
          return false;
        }
      }
      return true;
    };

    const candidateFitsAssignedRelations =
      (key, candidate) => {
        for (const relation of
          relationsByVariable.get(key) || []) {
          const collectionType =
            relation.collection.key === key
              ? candidate
              : assignments.get(
                  relation.collection.key
                );
          const itemType =
            relation.element.key === key
              ? candidate
              : assignments.get(
                  relation.element.key
                );

          if (
            collectionType &&
            itemType &&
            !genericCollectionRelationCompatible(
              relation,
              collectionType,
              itemType
            )
          ) {
            return false;
          }
        }

        return true;
      };

    const candidateFitsAssignedConstraints =
      (key, candidate) =>
        candidateFitsAssignedEdges(
          key,
          candidate
        ) &&
        candidateFitsAssignedRelations(
          key,
          candidate
        );

    const everyUnassignedNeighborHasCandidate = key => {
      for (const edge of edgesByVariable.get(key) || []) {
        const other =
          !edge.from.fixed && edge.from.key !== key
            ? edge.from
            : !edge.to.fixed && edge.to.key !== key
              ? edge.to
              : null;

        if (!other || assignments.has(other.key)) {
          continue;
        }

        const possible = candidateOrders.get(other.key)?.some(
          candidate =>
            candidateFitsAssignedConstraints(other.key, candidate)
        );

        if (!possible) {
          return false;
        }
      }

      for (const relation of
        relationsByVariable.get(key) || []) {
        const other =
          relation.collection.key === key
            ? relation.element
            : relation.collection;

        if (assignments.has(other.key)) {
          continue;
        }

        const possible =
          candidateOrders.get(other.key)?.some(
            candidate =>
              candidateFitsAssignedConstraints(
                other.key,
                candidate
              )
          );

        if (!possible) {
          return false;
        }
      }

      return true;
    };

    const connectedVariableKeys = [...variables.keys()].filter(
      key =>
        (edgesByVariable.get(key) || []).length > 0 ||
        (relationsByVariable.get(key) || []).length > 0
    );

    const constraintComponents = (() => {
      if (
        options?.decompose === false ||
        connectedVariableKeys.length < 2
      ) {
        return connectedVariableKeys.length > 0
          ? [connectedVariableKeys]
          : [];
      }

      const parents = new Map(
        connectedVariableKeys.map(key => [key, key])
      );
      const ranks = new Map(
        connectedVariableKeys.map(key => [key, 0])
      );
      const findRoot = key => {
        let root = key;
        while (parents.get(root) !== root) {
          root = parents.get(root);
        }
        let current = key;
        while (parents.get(current) !== current) {
          const next = parents.get(current);
          parents.set(current, root);
          current = next;
        }
        return root;
      };
      const union = (left, right) => {
        if (!parents.has(left) || !parents.has(right)) {
          return;
        }
        let leftRoot = findRoot(left);
        let rightRoot = findRoot(right);
        if (leftRoot === rightRoot) {
          return;
        }
        const leftRank = ranks.get(leftRoot) || 0;
        const rightRank = ranks.get(rightRoot) || 0;
        if (leftRank < rightRank) {
          [leftRoot, rightRoot] = [rightRoot, leftRoot];
        }
        parents.set(rightRoot, leftRoot);
        if (leftRank === rightRank) {
          ranks.set(leftRoot, leftRank + 1);
        }
      };

      for (const edge of edges) {
        if (!edge.from.fixed && !edge.to.fixed) {
          union(edge.from.key, edge.to.key);
        }
      }
      for (const relation of genericRelations) {
        union(
          relation.collection.key,
          relation.element.key
        );
      }

      const componentsByRoot = new Map();
      for (const key of connectedVariableKeys) {
        const root = findRoot(key);
        const component =
          componentsByRoot.get(root) || [];
        component.push(key);
        componentsByRoot.set(root, component);
      }
      return [...componentsByRoot.values()];
    })();

    const solve = componentKeys => {
      solveSteps += 1;
      if (solveSteps > 200000) {
        return false;
      }

      const remaining = componentKeys.filter(
        key => !assignments.has(key)
      );
      if (remaining.length === 0) {
        return true;
      }

      let selectedKey = null;
      let selectedCandidates = null;

      for (const key of remaining) {
        const preferred = [];
        const addPreferred = type => {
          if (type && !preferred.includes(type)) {
            preferred.push(type);
          }
        };
        const assignedIncoming = [];
        const assignedOutgoing = [];

        for (const relation of
          relationsByVariable.get(key) || []) {
          if (relation.element.key === key) {
            const assignedCollection =
              assignments.get(
                relation.collection.key
              );

            if (assignedCollection) {
              addPreferred(
                enumerableElementType(
                  assignedCollection
                )
              );
              continue;
            }

            const possibleElementTypes =
              new Set(
                [...relation.collection.variable.domain]
                  .map(enumerableElementType)
                  .filter(Boolean)
              );

            if (possibleElementTypes.size === 1) {
              addPreferred(
                [...possibleElementTypes][0]
              );
            }

            continue;
          }

          if (
            relation.collection.key === key &&
            relation.exact === true
          ) {
            const assignedElement =
              assignments.get(
                relation.element.key
              );

            if (assignedElement) {
              addPreferred(
                ensureCollectListType(
                  assignedElement
                )
              );
              continue;
            }

            const possibleItems =
              [...relation.element.variable.domain];

            if (possibleItems.length === 1) {
              addPreferred(
                ensureCollectListType(
                  possibleItems[0]
                )
              );
            }
          }
        }

        for (const edge of edgesByVariable.get(key) || []) {
          if (!edge.to.fixed && edge.to.key === key) {
            const sourceType = edge.from.fixed
              ? edge.from.type
              : assignments.get(edge.from.key);
            if (sourceType) assignedIncoming.push(sourceType);
          }
          if (!edge.from.fixed && edge.from.key === key) {
            const targetType = edge.to.fixed
              ? edge.to.type
              : assignments.get(edge.to.key);
            if (targetType) assignedOutgoing.push(targetType);
          }
        }

        addPreferred(
          promotedScalarNumericType(assignedIncoming)
        );
        for (const type of assignedIncoming) addPreferred(type);

        const outgoingNumeric = assignedOutgoing.filter(
          nodeGraphIsScalarNumericType
        );
        if (outgoingNumeric.length > 0) {
          addPreferred(
            scalarNumericTypeAtRank(
              Math.min(...outgoingNumeric.map(scalarNumericRank))
            )
          );
        }
        for (const type of assignedOutgoing) addPreferred(type);

        const candidates = [
          ...preferred,
          ...(candidateOrders.get(key) || [])
        ]
          .filter(
            (candidate, index, array) =>
              array.indexOf(candidate) === index
          )
          .filter(candidate =>
            candidateFitsAssignedConstraints(key, candidate)
          );

        if (candidates.length === 0) {
          return false;
        }

        if (
          !selectedCandidates ||
          candidates.length < selectedCandidates.length
        ) {
          selectedKey = key;
          selectedCandidates = candidates;
        }
      }

      for (const candidate of selectedCandidates || []) {
        assignments.set(selectedKey, candidate);
        if (
          everyUnassignedNeighborHasCandidate(selectedKey) &&
          solve(componentKeys)
        ) {
          return true;
        }
        assignments.delete(selectedKey);
      }

      return false;
    };

    for (const componentKeys of constraintComponents) {
      if (!solve(componentKeys)) {
        return {
          valid: false,
          reason:
            "No safe concrete type assignment satisfies all connected generic ports. Add an explicit conversion or select a concrete node type.",
          bindings: new Map()
        };
      }
    }

    for (const [key, variable] of variables) {
      if (!assignments.has(key)) {
        const fallback = variableCandidateOrder(variable)[0];
        if (fallback) assignments.set(key, fallback);
      }
    }

    const bindings = new Map(
      graph.nodes.map(node => [node.id, {}])
    );
    for (const [key, variable] of variables) {
      bindings.get(variable.node.id)[variable.typeVar] =
        assignments.get(key) || null;
    }

    for (const edge of edges) {
      const fromType = edge.from.fixed
        ? edge.from.type
        : assignments.get(edge.from.key);
      const toType = edge.to.fixed
        ? edge.to.type
        : assignments.get(edge.to.key);

      if (!typesCompatible(fromType, toType)) {
        return {
          valid: false,
          reason:
            `${typeLabel(fromType)} cannot safely connect to ${typeLabel(toType)}.`,
          bindings
        };
      }
    }

    for (const relation of genericRelations) {
      const collectionType =
        assignments.get(
          relation.collection.key
        );
      const itemType =
        assignments.get(
          relation.element.key
        );

      if (
        !genericCollectionRelationCompatible(
          relation,
          collectionType,
          itemType
        )
      ) {
        return {
          valid: false,
          reason:
            `${relation.definition?.title || "For Each"} could not bind its collection to a compatible item type.`,
          bindings
        };
      }
    }

    return {
        valid: true,
        reason: "",
        bindings
    };
  }

function analyzeConnections(
    connections,
    options = {}
  ) {
    if (
      options?.cache === false ||
      options?.decompose === false
    ) {
      return analyzeConnectionsCore(
        connections,
        options
      );
    }

    const token =
      graphAnalysisSemanticToken(
        connections
      );
    const certified =
      graphAnalysisFromCertificate(
        pendingGraphAnalysisCertificate,
        connections,
        token
      );
    if (certified) {
      pendingGraphAnalysisCertificate = null;
      cacheGraphAnalysis(token, certified);
      lastGraphAnalysisRecord = {
        sourceGraph: graph,
        nodes: graph?.nodes,
        connections,
        token,
        analysis: certified
      };
      return cloneGraphAnalysis(certified);
    }
    const cached =
      cachedGraphAnalysis(token);
    if (cached) {
      lastGraphAnalysisRecord = {
        sourceGraph: graph,
        nodes: graph?.nodes,
        connections,
        token,
        analysis: cached
      };
      return cached;
    }

    const analysis =
      analyzeConnectionsCore(
        connections,
        options
      );
    cacheGraphAnalysis(token, analysis);
    lastGraphAnalysisRecord = {
      sourceGraph: graph,
      nodes: graph?.nodes,
      connections,
      token,
      analysis
    };
    return analysis;
  }

function resolvePortType(
    portRef,
    bindings
  ) {
    if (!portRef) {
      return null;
    }
    if (portRef.spec.type) {
      return portRef.spec.type;
    }
    if (portRef.spec.typeVar) {
      return (
        bindings.get(portRef.node.id)?.[
          portRef.spec.typeVar
        ] || null
      );
    }
    return null;
  }

function concretePortTypeForAnalysis(
    nodeId,
    portId,
    direction,
    analysis
  ) {
    const reference =
      findPortSpec(
        nodeId,
        portId,
        direction
      );

    if (!reference) {
      return null;
    }

    const bound =
      reference.spec.type ||
      analysis?.bindings
        ?.get(reference.node.id)?.[
          reference.spec.typeVar
        ] ||
      null;

    if (bound) {
      return bound;
    }

    if (
      reference.spec.typeVar &&
      reference.definition
        ?.configurableTypeVar ===
          reference.spec.typeVar
    ) {
      const configured =
        reference.node.parameters
          ?.valueType;

      if (
        configured &&
        configured !== "auto"
      ) {
        return configured;
      }

      if (
        isAutoVectorOperator(
          reference.node
        )
      ) {
        return effectiveAutoVectorType(
          reference.node
        );
      }

      const fallback =
        reference.definition
          .autoFallbackType ||
        fallbackTypeForDefinition(
          reference.definition
        );

      return fallback || null;
    }

    return null;
  }

function inferAutoVectorType(
    node,
    connections,
    analysis = null
  ) {
    if (!isAutoVectorOperator(node)) {
      return null;
    }

    const currentType =
      effectiveAutoVectorType(node);
    const current =
      numericVectorInfo(currentType) ||
      numericVectorInfo("float3");
    const exactVectorTypes = [];
    const scalarInputTypes = [];
    const scalarOutputTypes = [];
    let minimumDimension =
      current.componentCount;

    for (const connection of connections) {
      if (node.operatorId === "vector.compose") {
        if (
          connection.fromNode === node.id &&
          connection.fromPort === "value"
        ) {
          const type =
            concretePortTypeForAnalysis(
              connection.toNode,
              connection.toPort,
              "input",
              analysis
            );

          if (numericVectorInfo(type)) {
            exactVectorTypes.push(type);
          }
        }

        if (connection.toNode === node.id) {
          const index =
            vectorComponentIndex(
              connection.toPort
            );

          if (index >= 0) {
            minimumDimension = Math.max(
              minimumDimension,
              index + 1,
              2
            );

            const type =
              concretePortTypeForAnalysis(
                connection.fromNode,
                connection.fromPort,
                "output",
                analysis
              );

            if (nodeGraphIsScalarNumericType(type)) {
              scalarInputTypes.push(type);
            }
          }
        }
      } else if (
        node.operatorId ===
          "vector.decompose"
      ) {
        if (
          connection.toNode === node.id &&
          connection.toPort === "value"
        ) {
          const type =
            concretePortTypeForAnalysis(
              connection.fromNode,
              connection.fromPort,
              "output",
              analysis
            );

          if (numericVectorInfo(type)) {
            exactVectorTypes.push(type);
          }
        }

        if (connection.fromNode === node.id) {
          const index =
            vectorComponentIndex(
              connection.fromPort
            );

          if (index >= 0) {
            minimumDimension = Math.max(
              minimumDimension,
              index + 1,
              2
            );

            const type =
              concretePortTypeForAnalysis(
                connection.toNode,
                connection.toPort,
                "input",
                analysis
              );

            if (nodeGraphIsScalarNumericType(type)) {
              scalarOutputTypes.push(type);
            }
          }
        }
      }
    }

    const uniqueExact = [
      ...new Set(exactVectorTypes)
    ];

    if (uniqueExact.length === 1) {
      return uniqueExact[0];
    }

    if (uniqueExact.length > 1) {
      return currentType;
    }

    let scalarType =
      current.scalarType;

    if (
      node.operatorId ===
        "vector.compose" &&
      scalarInputTypes.length > 0
    ) {
      scalarType =
        promotedScalarNumericType(
          scalarInputTypes
        ) || scalarType;
    } else if (
      node.operatorId ===
        "vector.decompose" &&
      scalarOutputTypes.length > 0
    ) {
      scalarType =
        scalarNumericTypeAtRank(
          Math.min(
            ...scalarOutputTypes.map(
              scalarNumericRank
            )
          )
        );
    }

    return `${scalarType}${nodeGraphClamp(
      minimumDimension,
      2,
      4
    )}`;
  }

function analyzeWithAutoVectors(
    connections,
    seedAnalysis = null
  ) {
    const automaticNodes =
      graph.nodes.filter(
        isAutoVectorOperator
      );
    const snapshots =
      new Map(
        automaticNodes.map(node => [
          node.id,
          {
            hadValue:
              Object.hasOwn(
                node.parameters,
                "autoVectorType"
              ),
            value:
              node.parameters
                .autoVectorType
          }
        ])
      );
    let analysis =
      seedAnalysis?.valid
        ? seedAnalysis
        : null;

    try {
      for (
        let pass = 0;
        pass < 8;
        pass += 1
      ) {
        let changed = false;

        for (const node of automaticNodes) {
          const inferred =
            inferAutoVectorType(
              node,
              connections,
              analysis
            );

          if (
            inferred &&
            inferred !==
              node.parameters
                .autoVectorType
          ) {
            node.parameters
              .autoVectorType =
              inferred;
            changed = true;
          }
        }

        analysis =
          analyzeConnections(
            connections
          );

        if (!changed) {
          break;
        }
      }

      const updates =
        new Map(
          automaticNodes.map(node => [
            node.id,
            effectiveAutoVectorType(node)
          ])
        );

      return {
        analysis:
          analysis ||
          analyzeConnections(
            connections
          ),
        updates
      };
    } finally {
      for (const node of automaticNodes) {
        const snapshot =
          snapshots.get(node.id);

        if (snapshot?.hadValue) {
          node.parameters
            .autoVectorType =
            snapshot.value;
        } else {
          delete node.parameters
            .autoVectorType;
        }
      }
    }
  }

function applyAutoVectorUpdates(
    updates
  ) {
    if (!(updates instanceof Map)) {
      return;
    }

    for (const [nodeId, type] of updates) {
      const node =
        findGraphNode(nodeId);

      if (
        isAutoVectorOperator(node) &&
        numericVectorInfo(type)
      ) {
        node.parameters.autoVectorType =
          type;
      }
    }
  }

function synchronizeAutoVectorTypes(
    connections,
    seedAnalysis = null
  ) {
    const result =
      analyzeWithAutoVectors(
        connections,
        seedAnalysis
      );

    applyAutoVectorUpdates(
      result.updates
    );

    return result.analysis;
  }

function graphAnalysisAbortError(
    message = "Graph analysis was aborted."
  ) {
    if (typeof DOMException === "function") {
      return new DOMException(
        message,
        "AbortError"
      );
    }
    const error = new Error(message);
    error.name = "AbortError";
    return error;
  }

function reportGraphAnalysisProgress(
    callback,
    progress
  ) {
    if (typeof callback !== "function") {
      return;
    }
    try {
      callback(progress);
    } catch (error) {
      console.error(
        "Runtime Graph analysis progress callback failed.",
        error
      );
    }
  }

function yieldGraphAnalysisTask(signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(graphAnalysisAbortError());
        return;
      }
      let settled = false;
      const finish = callback => {
        if (settled) {
          return;
        }
        settled = true;
        signal?.removeEventListener?.(
          "abort",
          abort
        );
        callback();
      };
      const abort = () => {
        clearTimeout(handle);
        finish(() =>
          reject(graphAnalysisAbortError())
        );
      };
      const handle = setTimeout(
        () => finish(resolve),
        0
      );
      signal?.addEventListener?.(
        "abort",
        abort,
        { once: true }
      );
    });
  }

async function analyzeGraphConnectionsAsync(
    connections,
    {
      signal = null,
      onProgress = null
    } = {}
  ) {
    const requestedGraph = graph;
    const requestedNodes = graph?.nodes;
    const requestedConnections = connections;
    const requestSequence =
      ++graphAnalysisAsyncRequestSequence;
    const requestedMutationEpoch =
      observableGraphAnalysisMutationEpoch();

    if (
      !requestedGraph ||
      requestedGraph.connections !==
        requestedConnections ||
      !Array.isArray(requestedNodes) ||
      !Array.isArray(requestedConnections)
    ) {
      throw graphAnalysisAbortError(
        "The requested graph is no longer active."
      );
    }

    const semanticToken =
      graphAnalysisSemanticToken(
        requestedConnections,
        requestedGraph,
        { refresh: true }
      );
    reportGraphAnalysisProgress(
      onProgress,
      {
        phase: "queued",
        completed: 0,
        total: 1
      }
    );
    await yieldGraphAnalysisTask(signal);

    const assertCurrent = (
      { verifySemanticToken = true } = {}
    ) => {
      if (
        signal?.aborted ||
        requestSequence !==
          graphAnalysisAsyncRequestSequence ||
        graph !== requestedGraph ||
        graph?.nodes !== requestedNodes ||
        graph?.connections !==
          requestedConnections ||
        (
          requestedMutationEpoch !== null &&
          observableGraphAnalysisMutationEpoch() !==
            requestedMutationEpoch
        ) ||
        (
          verifySemanticToken &&
          requestedMutationEpoch === null &&
          graphAnalysisSemanticToken(
            requestedConnections,
            requestedGraph,
            { refresh: true }
          ) !== semanticToken
        )
      ) {
        throw graphAnalysisAbortError(
          "The graph topology changed during analysis."
        );
      }
    };

    assertCurrent();
    reportGraphAnalysisProgress(
      onProgress,
      {
        phase: "analyzing",
        completed: 0,
        total: 1
      }
    );
    // The callback is user code and can synchronously mutate the active
    // graph or start a newer request. Re-check before entering the otherwise
    // uninterrupted solver section.
    assertCurrent();
    const result = analyzeWithAutoVectors(
      requestedConnections,
      null
    );
    // Analysis is synchronous after the yielded task, so no application
    // mutation can interleave before this identity/abort commit guard.
    assertCurrent({
      verifySemanticToken: false
    });

    applyAutoVectorUpdates(result.updates);
    currentAnalysis = result.analysis;
    reportGraphAnalysisProgress(
      onProgress,
      {
        phase: "complete",
        completed: 1,
        total: 1
      }
    );
    return currentAnalysis;
  }

function pathExists(
    adjacency,
    start,
    target,
    visited = new Set()
  ) {
    if (start === target) {
      return true;
    }

    if (visited.has(start)) {
      return false;
    }

    visited.add(start);

    for (
      const next of
      adjacency.get(start) || []
    ) {
      if (
        pathExists(
          adjacency,
          next,
          target,
          visited
        )
      ) {
        return true;
      }
    }

    return false;
  }

function impulseEndpointKey(
    direction,
    nodeId,
    portId
  ) {
    return `${direction}:${nodeId}:${portId}`;
  }

function isImpulseControlConnection(
    connection
  ) {
    const source = findPortSpec(
      connection.fromNode,
      connection.fromPort,
      "output"
    );
    const target = findPortSpec(
      connection.toNode,
      connection.toPort,
      "input"
    );

    if (!source || !target) {
      return false;
    }

    if (target.spec?.type !== "impulse") {
      return false;
    }

    return (
      source.spec?.type === "impulse" ||
      isConfigurationReactionConnection(
        source,
        target
      )
    );
  }

function impulseOutputsForInput(
    node,
    inputPortId
  ) {
    const definition =
      nodeDefinition(node);
    const outputs =
      Array.isArray(definition?.outputs)
        ? definition.outputs.filter(
            spec => spec?.type === "impulse"
          )
        : [];
    const routes =
      definition?.impulseRoutes;

    if (
      routes &&
      typeof routes === "object" &&
      !Array.isArray(routes) &&
      Object.hasOwn(
        routes,
        inputPortId
      )
    ) {
      const routed = new Set(
        Array.isArray(routes[inputPortId])
          ? routes[inputPortId]
              .map(value =>
                String(value || "").trim()
              )
              .filter(Boolean)
          : []
      );

      return outputs
        .filter(spec =>
          routed.has(spec.id)
        )
        .map(spec => spec.id);
    }

    return outputs.map(spec => spec.id);
  }

function wouldCreateImpulseCycle(
    connections,
    candidate
  ) {
    const adjacency = new Map();
    const addEdge = (from, to) => {
      const list = adjacency.get(from) || [];
      list.push(to);
      adjacency.set(from, list);
    };

    for (const node of graph?.nodes || []) {
      if (node.kind !== "operator") {
        continue;
      }

      const definition =
        nodeDefinition(node);
      const inputs =
        Array.isArray(definition?.inputs)
          ? definition.inputs.filter(
              spec => spec?.type === "impulse"
            )
          : [];

      for (const input of inputs) {
        for (const outputPortId of
          impulseOutputsForInput(
            node,
            input.id
          )) {
          addEdge(
            impulseEndpointKey(
              "in",
              node.id,
              input.id
            ),
            impulseEndpointKey(
              "out",
              node.id,
              outputPortId
            )
          );
        }
      }
    }

    for (const connection of [
      ...connections,
      candidate
    ]) {
      if (
        !isImpulseControlConnection(
          connection
        )
      ) {
        continue;
      }

      addEdge(
        impulseEndpointKey(
          "out",
          connection.fromNode,
          connection.fromPort
        ),
        impulseEndpointKey(
          "in",
          connection.toNode,
          connection.toPort
        )
      );
    }

    return pathExists(
      adjacency,
      impulseEndpointKey(
        "in",
        candidate.toNode,
        candidate.toPort
      ),
      impulseEndpointKey(
        "out",
        candidate.fromNode,
        candidate.fromPort
      )
    );
  }

function wouldCreateValueCycle(
    connections,
    candidate
  ) {
    const adjacency = new Map();

    for (const connection of [
      ...connections,
      candidate
    ]) {
      if (
        isImpulseControlConnection(
          connection
        )
      ) {
        continue;
      }

      const sourceNode =
        findGraphNode(
          connection.fromNode
        );

      if (
        sourceNode?.kind === "operator" &&
        (
          sourceNode.operatorId ===
            "resonite.store" ||
          sourceNode.operatorId ===
            "resonite.executionStore"
        ) &&
        connection.fromPort === "current"
      ) {
        continue;
      }

      const list =
        adjacency.get(
          connection.fromNode
        ) || [];
      list.push(
        connection.toNode
      );
      adjacency.set(
        connection.fromNode,
        list
      );
    }

    return pathExists(
      adjacency,
      candidate.toNode,
      candidate.fromNode
    );
  }

function wouldCreateCycle(
    connections,
    candidate
  ) {
    if (
      candidate.fromNode ===
      candidate.toNode
    ) {
      return true;
    }

    return isImpulseControlConnection(
      candidate
    )
      ? wouldCreateImpulseCycle(
          connections,
          candidate
        )
      : wouldCreateValueCycle(
          connections,
          candidate
        );
  }

function normalizedEndpoints(
    first,
    second
  ) {
    if (
      first.direction === "output" &&
      second.direction === "input"
    ) {
      return {
        from: first,
        to: second
      };
    }

    if (
      first.direction === "input" &&
      second.direction === "output"
    ) {
      return {
        from: second,
        to: first
      };
    }

    return null;
  }

function connectionProposal(
    first,
    second,
    baseConnections = graph.connections
  ) {
    const endpoints =
      normalizedEndpoints(
        first,
        second
      );

    if (!endpoints) {
      return {
        valid: false,
        reason:
          "Connect an output socket to an input socket."
      };
    }

    if (
      endpoints.from.nodeId ===
      endpoints.to.nodeId
    ) {
      return {
        valid: false,
        reason:
          "A node cannot connect directly to itself."
      };
    }

    const candidate = {
      id: makeId("wire"),
      fromNode:
        endpoints.from.nodeId,
      fromPort:
        endpoints.from.portId,
      toNode:
        endpoints.to.nodeId,
      toPort:
        endpoints.to.portId
    };

    const replacedInputConnection =
      baseConnections.find(
        connection =>
          connection.toNode ===
            candidate.toNode &&
          connection.toPort ===
            candidate.toPort
      ) || null;
    const withoutCurrentInput =
      baseConnections.filter(
        connection =>
          !(
            connection.toNode ===
              candidate.toNode &&
            connection.toPort ===
              candidate.toPort
          )
      );

    if (
      wouldCreateCycle(
        withoutCurrentInput,
        candidate
      )
    ) {
      return {
        valid: false,
        reason:
          "This wire would create a dependency cycle."
      };
    }

    const nextConnections = [
      ...withoutCurrentInput,
      candidate
    ];

    if (customCSharpEditor) {
      return {
        valid: true,
        reason: "",
        candidate,
        nextConnections,
        analysis: null,
        autoVectorUpdates: new Map(),
        incremental: true
      };
    }

    const sourcePort = findPortSpec(
      candidate.fromNode,
      candidate.fromPort,
      "output"
    );
    const targetPort = findPortSpec(
      candidate.toNode,
      candidate.toPort,
      "input"
    );
    const genericSensitivePort = port =>
      Boolean(
        port?.spec?.typeVar ||
        port?.definition
          ?.configurableTypeVar ||
        (
          Array.isArray(
            port?.definition
              ?.genericRelations
          ) &&
          port.definition
            .genericRelations.length > 0
        ) ||
        isAutoVectorOperator(
          port?.node
        )
      );
    const connectionTouchesGeneric =
      connection =>
        Boolean(
          connection &&
          (
            genericSensitivePort(
              findPortSpec(
                connection.fromNode,
                connection.fromPort,
                "output"
              )
            ) ||
            genericSensitivePort(
              findPortSpec(
                connection.toNode,
                connection.toPort,
                "input"
              )
            )
          )
        );
    const bindings =
      currentAnalysis?.bindings;
    const sourceType =
      resolvePortType(
        sourcePort,
        bindings || new Map()
      ) ||
      fallbackConcreteTypeForPort(
        sourcePort
      );
    const targetType =
      resolvePortType(
        targetPort,
        bindings || new Map()
      ) ||
      fallbackConcreteTypeForPort(
        targetPort
      );
    const fixedTypeFastPath = Boolean(
      currentAnalysis &&
      currentAnalysis.valid !== false &&
      bindings &&
      typeof bindings.get === "function" &&
      sourcePort &&
      targetPort &&
      sourceType &&
      targetType &&
      !genericSensitivePort(sourcePort) &&
      !genericSensitivePort(targetPort) &&
      !connectionTouchesGeneric(
        replacedInputConnection
      )
    );

    if (fixedTypeFastPath) {
      const compatible =
        isConfigurationReactionConnection(
          sourcePort,
          targetPort
        ) ||
        connectionTypesCompatible(
          sourceType,
          targetType
        );
      return {
        valid: compatible,
        reason: compatible
          ? ""
          : `Cannot connect ${typeLabel(sourceType)} to ${typeLabel(targetType)}.`,
        candidate,
        nextConnections,
        analysis: currentAnalysis,
        autoVectorUpdates:
          new Map(),
        incremental: true
      };
    }

    const inferred =
      analyzeWithAutoVectors(
        nextConnections,
        currentAnalysis
      );
    const analysis =
      inferred.analysis;

    return {
      valid: analysis.valid,
      reason: analysis.reason,
      candidate,
      nextConnections,
      analysis,
      autoVectorUpdates:
        inferred.updates
    };
  }

function hasMissingOperatorDefinitions() {
    return graph.nodes.some(
      node =>
        node.kind === "operator" &&
        (
          typeof node.operatorId !== "string" ||
          !Object.hasOwn(
            OPERATOR_DEFINITIONS,
            node.operatorId
          )
        )
    );
  }

function graphAutoVectorTypeSnapshot() {
    return new Map(
      (Array.isArray(graph?.nodes)
        ? graph.nodes
        : [])
        .filter(isAutoVectorOperator)
        .map(node => [
          node,
          {
            present: Object.hasOwn(
              node.parameters,
              "autoVectorType"
            ),
            value:
              node.parameters.autoVectorType
          }
        ])
    );
  }

function graphPruneMutationResult({
    connectionCountBefore = 0,
    routingChanged = false,
    autoVectorTypesBefore = new Map()
  } = {}) {
    const connectionsChanged =
      graph.connections.length !==
        connectionCountBefore;
    const autoVectorTypeChanged =
      [...autoVectorTypesBefore].some(
        ([node, before]) =>
          before.present !==
            Object.hasOwn(
              node.parameters,
              "autoVectorType"
            ) ||
          before.value !==
            node.parameters.autoVectorType
      );
    return Object.freeze({
      documentChanged:
        connectionsChanged ||
        routingChanged ||
        autoVectorTypeChanged,
      connectionsChanged,
      routingChanged,
      autoVectorTypeChanged
    });
  }

function pruneConnections(
    {
      preserveStoredConnections = false
    } = {}
  ) {
    const connectionCountBefore =
      graph.connections.length;
    const mutation = {
      routingChanged: false
    };
    const mutationResultWithoutAutoVectors = () =>
      graphPruneMutationResult({
        connectionCountBefore,
        routingChanged:
          mutation.routingChanged
      });
    if (customCSharpEditor) {
      const retainedConnections =
        graph.connections.filter(connection => {
        const fromNode = findGraphNode(connection.fromNode);
        const toNode = findGraphNode(connection.toNode);
        return Boolean(fromNode && toNode && nodeDefinition(fromNode) && nodeDefinition(toNode));
      });
      if (
        retainedConnections.length !==
        graph.connections.length
      ) {
        graph.connections = retainedConnections;
      }
      normalizeConnectionRouting(
        graph.connections,
        mutation
      );
      currentAnalysis = null;
      return mutationResultWithoutAutoVectors();
    }
    if (hasMissingOperatorDefinitions()) {
      if (preserveStoredConnections) {
        const missingOperatorIds = [
          ...new Set(
            graph.nodes
              .filter(node =>
                node.kind === "operator" &&
                !Object.hasOwn(
                  OPERATOR_DEFINITIONS,
                  String(node.operatorId || "")
                )
              )
              .map(node =>
                String(
                  node.operatorId ||
                  "<missing-id>"
                )
              )
          )
        ];
        throw new Error(
          `The imported Runtime Graph cannot be validated because operator definitions are unavailable: ${missingOperatorIds.slice(0, 8).join(", ") || "unknown"}. No stored wire was removed. The JSON was not loaded.`
        );
      }
      return mutationResultWithoutAutoVectors();
    }

    const autoVectorTypesBefore =
      graphAutoVectorTypeSnapshot();
    const mutationResult = () =>
      graphPruneMutationResult({
        connectionCountBefore,
        routingChanged:
          mutation.routingChanged,
        autoVectorTypesBefore
      });

    if (graph.connections.length === 0) {
      currentAnalysis =
        synchronizeAutoVectorTypes(
          graph.connections,
          currentAnalysis
        );

      return mutationResult();
    }

    const wholeGraph =
        analyzeWithAutoVectors(
            graph.connections,
            currentAnalysis
        );

    if (wholeGraph.analysis.valid) {
        if (
            Array.isArray(wholeGraph.updates) &&
            wholeGraph.updates.length > 0
        ) {
            for (const update of wholeGraph.updates) {
                if (
                    update?.node &&
                    update.type
                ) {
                    update.node.parameters.autoVectorType =
                        update.type;
                }
            }
        }

        currentAnalysis =
            synchronizeAutoVectorTypes(
                graph.connections,
                wholeGraph.analysis
            );

        normalizeConnectionRouting(
            graph.connections,
            mutation
        );

        if (
            graph.selectedConnectionId &&
            !graph.connections.some(
                connection =>
                    connection.id ===
                    graph.selectedConnectionId
            )
        ) {
            graph.selectedConnectionId = null;
        }

        normalizeSelectedWirePoint();

        return mutationResult();
    }

    if (preserveStoredConnections) {
      throw new Error(
        `The imported Runtime Graph connection contract is invalid: ${String(wholeGraph.analysis.reason || "type inference could not validate every stored wire")}. No stored wire was removed. The JSON was not loaded.`
      );
    }

    if (
      graph.connections.length >
        GRAPH_INCREMENTAL_PRUNE_CONNECTION_LIMIT
    ) {
      currentAnalysis =
        wholeGraph.analysis;
      normalizeConnectionRouting(
        graph.connections,
        mutation
      );

      if (
        graph.selectedConnectionId &&
        !graph.connections.some(
          connection =>
            connection.id ===
              graph.selectedConnectionId
        )
      ) {
        graph.selectedConnectionId = null;
      }

      normalizeSelectedWirePoint();
      return mutationResult();
    }

    const accepted = [];

    for (const connection of graph.connections) {
      const proposal =
        connectionProposal(
          {
            nodeId:
              connection.fromNode,
            portId:
              connection.fromPort,
            direction: "output"
          },
          {
            nodeId:
              connection.toNode,
            portId:
              connection.toPort,
            direction: "input"
          },
          accepted
        );

      if (proposal.valid) {
        accepted.splice(
          0,
          accepted.length,
          ...proposal.nextConnections.map(
            candidate =>
              candidate.id ===
                proposal.candidate.id
                ? { ...connection }
                : candidate
          )
        );
      }
    }

    graph.connections = accepted;
    normalizeConnectionRouting(
      graph.connections,
      mutation
    );
    currentAnalysis =
      synchronizeAutoVectorTypes(
        graph.connections,
        currentAnalysis
      );

    if (
      graph.selectedConnectionId &&
      !graph.connections.some(
        connection =>
          connection.id ===
          graph.selectedConnectionId
      )
    ) {
      graph.selectedConnectionId = null;
    }

    normalizeSelectedWirePoint();
    return mutationResult();
  }

function previewNumber(value) {
    const number = Number(
      String(value ?? "")
        .trim()
        .replace(/[fFdD]$/, "")
    );

    return Number.isFinite(number)
      ? number
      : 0;
  }

function previewColorChannels(value) {
    const text =
      String(value || "")
        .trim();
    const named = {
      White: [1, 1, 1, 1],
      Black: [0, 0, 0, 1],
      Red: [1, 0, 0, 1],
      Green: [0, 1, 0, 1],
      Blue: [0, 0, 1, 1],
      Yellow: [1, 1, 0, 1],
      Cyan: [0, 1, 1, 1],
      Magenta: [1, 0, 1, 1],
      Gray: [0.5, 0.5, 0.5, 1],
      Clear: [0, 0, 0, 0]
    };
    const namedMatch =
      text.match(
        /^colorX\.([A-Za-z_][A-Za-z0-9_]*)$/
      );

    if (
      namedMatch &&
      named[namedMatch[1]]
    ) {
      return [
        ...named[namedMatch[1]]
      ];
    }

    if (/^#[0-9a-fA-F]{6,8}$/.test(text)) {
      const raw = text.slice(1);

      return [
        Number.parseInt(raw.slice(0, 2), 16) / 255,
        Number.parseInt(raw.slice(2, 4), 16) / 255,
        Number.parseInt(raw.slice(4, 6), 16) / 255,
        raw.length === 8
          ? Number.parseInt(raw.slice(6, 8), 16) / 255
          : 1
      ];
    }

    const numbers =
      text.match(
        /[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/g
      );

    if (
      numbers &&
      numbers.length >= 3
    ) {
      return [
        previewNumber(numbers[0]),
        previewNumber(numbers[1]),
        previewNumber(numbers[2]),
        numbers.length >= 4
          ? previewNumber(numbers[3])
          : 1
      ];
    }

    return [0, 0, 0, 1];
  }

let typedGraphCodegenCacheKey = "";

let typedGraphCodegenCache = null;

function graphCsEscapeString(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\0/g, "\\0")
      .replace(/"/g, '\\"');
  }

function graphCsIdentifier(
    value,
    fallback = "Value"
  ) {
    const words =
      String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[^A-Za-z0-9_]+/)
        .filter(Boolean);
    let result = words
      .map(word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
      )
      .join("") || fallback;

    if (/^[0-9]/.test(result)) {
      result = `Value${result}`;
    }

    const reserved = new Set([
      "Class",
      "Namespace",
      "Event",
      "String",
      "Int",
      "Float",
      "Double",
      "Bool",
      "Object",
      "Default",
      "New",
      "Static",
      "Public",
      "Private",
      "Internal",
      "Void"
    ]);

    return reserved.has(result)
      ? `${result}Value`
      : result;
  }

function graphCsNamespace(value) {
    return String(value || "")
      .split(".")
      .map(part =>
        graphCsIdentifier(
          part,
          "Namespace"
        )
      )
      .join(".") ||
      "YourModNamespace";
  }

function graphTypeAssemblyReferences(type) {
    const information =
      TYPE_INFO[typeBase(type)] || {};
    const references = new Map();

    const add = reference => {
      if (!reference || typeof reference !== "object") {
        return;
      }

      const include = String(
        reference.include || ""
      ).trim();

      if (!include) {
        return;
      }

      references.set(
        include.toLowerCase(),
        {
          include,
          hintPath: String(
            reference.hintPath || ""
          ).trim(),
          private: reference.private === true
        }
      );
    };

    for (const reference of
      Array.isArray(information.assemblyReferences)
        ? information.assemblyReferences
        : []) {
      add(reference);
    }

    for (const assembly of [
      ...(Array.isArray(information.assemblies)
        ? information.assemblies
        : []),
      information.assembly
    ]) {
      const include = String(assembly || "").trim();

      if (
        !include ||
        include === "FrooxEngine" ||
        include === "ResoniteModLoader" ||
        include === "mscorlib" ||
        include === "netstandard" ||
        include === "System" ||
        include.startsWith("System.") ||
        include.startsWith("Microsoft.")
      ) {
        continue;
      }

      add({
        include,
        hintPath: `$(ResonitePath)${include}.dll`,
        private: false
      });
    }

    return [...references.values()];
  }

function graphCsType(type) {
    if (
      typeof type === "string" &&
      type.startsWith("enum:")
    ) {
      return graphCsIdentifier(
        type.slice(5),
        "SettingOption"
      );
    }

    const information =
      TYPE_INFO[typeBase(type)] || {};

    if (
      typeof information.csType ===
        "string" &&
      information.csType.trim()
    ) {
      return information.csType.trim();
    }

    return type || "object";
  }

function graphCsDefault(type) {
    const information =
      TYPE_INFO[typeBase(type)] || {};

    if (
      typeof information.defaultCs ===
        "string" &&
      information.defaultCs.trim()
    ) {
      return information.defaultCs.trim();
    }

    switch (type) {
      case "bool":
        return "false";
      case "int":
        return "0";
      case "float":
        return "0f";
      case "double":
        return "0d";
      case "string":
        return "string.Empty";
      case "Uri":
        return "new Uri(\"about:blank\")";
      default:
        return `default(${graphCsType(type)})`;
    }
  }

const GRAPH_CS_PRIMITIVE_DEFAULTS = new Map([
      ["bool", new Set(["false"])],
      ["System.Boolean", new Set(["false"])],
      ["byte", new Set(["0"])],
      ["System.Byte", new Set(["0"])],
      ["sbyte", new Set(["0"])],
      ["System.SByte", new Set(["0"])],
      ["short", new Set(["0"])],
      ["System.Int16", new Set(["0"])],
      ["ushort", new Set(["0"])],
      ["System.UInt16", new Set(["0"])],
      ["int", new Set(["0"])],
      ["System.Int32", new Set(["0"])],
      ["uint", new Set(["0", "0u", "0U"])],
      ["System.UInt32", new Set(["0", "0u", "0U"])],
      ["long", new Set(["0", "0l", "0L"])],
      ["System.Int64", new Set(["0", "0l", "0L"])],
      ["ulong", new Set(["0", "0ul", "0UL", "0Ul", "0uL"])],
      ["System.UInt64", new Set(["0", "0ul", "0UL", "0Ul", "0uL"])],
      ["nint", new Set(["0"])],
      ["System.IntPtr", new Set(["0", "default(System.IntPtr)"])],
      ["nuint", new Set(["0"])],
      ["System.UIntPtr", new Set(["0", "default(System.UIntPtr)"])],
      ["float", new Set(["0", "0f", "0F", "0.0f", "0.0F"])],
      ["System.Single", new Set(["0", "0f", "0F", "0.0f", "0.0F"])],
      ["double", new Set(["0", "0d", "0D", "0.0d", "0.0D"])],
      ["System.Double", new Set(["0", "0d", "0D", "0.0d", "0.0D"])],
      ["decimal", new Set(["0", "0m", "0M", "0.0m", "0.0M"])],
      ["System.Decimal", new Set(["0", "0m", "0M", "0.0m", "0.0M"])],
      ["char", new Set(["'\\0'", "'\\u0000'"])],
      ["System.Char", new Set(["'\\0'", "'\\u0000'"])]
  ]);

const GRAPH_CS_KNOWN_VALUE_TYPES = new Set([
    "bool",
    "int",
    "float",
    "double",
    "int2",
    "int3",
    "int4",
    "float2",
    "float3",
    "float4",
    "double2",
    "double3",
    "double4",
    "colorX"
  ]);

function graphCsDefaultInitializerIsRedundant(
    type,
    csType,
    defaultCode
  ) {
    const normalizedType = String(
      csType || graphCsType(type)
    )
      .replace(/\s+/g, "")
      .replace(/^global::/, "");
    const normalizedDefault = String(
      defaultCode || ""
    )
      .replace(/\s+/g, "")
      .replace(/^global::/, "");
    const primitiveDefaults =
      GRAPH_CS_PRIMITIVE_DEFAULTS.get(
        normalizedType
      );

    if (
      primitiveDefaults?.has(
        normalizedDefault
      ) ||
      (
        primitiveDefaults &&
        [
          "default",
          "default!",
          `default(${normalizedType})`
        ].includes(normalizedDefault)
      )
    ) {
      return true;
    }

    if (
      normalizedType.endsWith("?") &&
      [
        "null",
        "null!",
        "default",
        "default!",
        `default(${normalizedType})`
      ].includes(normalizedDefault)
    ) {
      return true;
    }

    const baseType = typeBase(type);
    const information =
      TYPE_INFO[baseType] || {};
    const isKnownValueType =
      String(type || "").startsWith("enum:") ||
      GRAPH_CS_KNOWN_VALUE_TYPES.has(baseType) ||
      information.referenceType === false;
    return (
      isKnownValueType &&
      (
        normalizedDefault === "default" ||
        normalizedDefault === "default!" ||
        normalizedDefault ===
          `default(${normalizedType})`
      )
    );
  }

function graphCsStaticFieldDeclaration(
    type,
    csType,
    fieldName,
    defaultCode,
    indent = ""
  ) {
    const initializer =
      graphCsDefaultInitializerIsRedundant(
        type,
        csType,
        defaultCode
      )
        ? ""
        : ` = ${defaultCode}`;

    return `${indent}private static ${csType} ${fieldName}${initializer};`;
  }

function graphCsNumberLiteral(
    value,
    type
  ) {
    const number =
      previewNumber(value);

    if (type === "int") {
      return String(
        Math.trunc(number)
      );
    }

    const text =
      Number.isFinite(number)
        ? String(number)
        : "0";

    if (type === "double") {
      return /[.eE]/.test(text)
        ? `${text}d`
        : `${text}.0d`;
    }

    return /[.eE]/.test(text)
      ? `${text}f`
      : `${text}.0f`;
  }

function graphCsColorLiteral(
    value,
    profile = "linear",
    strength = 1
  ) {
    const text =
      String(value || "")
        .trim();
    const normalizedProfile =
      normalizeGraphColorProfile(
        profile
      );
    const safeStrength = nodeGraphClamp(
      Number(strength) || 1,
      1,
      10
    );

    if (!text) {
      return "colorX.White";
    }

    if (/^#[0-9a-fA-F]{6,8}$/.test(text)) {
      return graphColorXExpressionFromChannels(
        previewColorChannels(text),
        normalizedProfile === "linear" &&
          !profile
          ? "srgb"
          : normalizedProfile,
        safeStrength
      );
    }

    if (
      /^colorX\.[A-Za-z_][A-Za-z0-9_]*$/.test(
        text
      )
    ) {
      if (
        safeStrength <= 1.000001 &&
        normalizedProfile === "linear"
      ) {
        return text;
      }

      return graphColorXExpressionFromChannels(
        previewColorChannels(text),
        normalizedProfile,
        safeStrength
      );
    }

    if (
      /^(?:new\s+colorX|\(\s*colorX\s*\)\s*new\s+color)\b/.test(
        text
      )
    ) {
      return text;
    }

    return text;
  }

function graphCsMethodToken(
    nodeId,
    portId = ""
  ) {
    const nodeToken =
      `N${hashText(String(nodeId))}`;
    const portToken =
      graphCsIdentifier(
        portId,
        "Port"
      );

    return portId
      ? `${nodeToken}_${portToken}`
      : nodeToken;
  }

function synchronizeGraphForCodegen(
    request = {}
  ) {
    if (activeInteraction) {
      return;
    }

    const requestedGraph =
      request.state?.extensions?.[
        EXTENSION_NAME
      ];
    const incoming =
      requestedGraph &&
      typeof requestedGraph === "object"
        ? requestedGraph
        : bridge
            ?.getExtensionStateReference
            ?.(EXTENSION_NAME) ||
          bridge?.getExtensionState?.(
            EXTENSION_NAME
          );

    if (
      !incoming ||
      typeof incoming !== "object"
    ) {
      return;
    }

    const acceptedAnalysisCertificate =
      acceptGraphAnalysisCertificate(
        request.analysisCertificate,
        {
          transferred:
            request.trustedAnalysisTransfer === true
        }
      );

    if (
      incoming === graph ||
      incoming ===
        lastPersistedGraphReference
    ) {
      return;
    }

    graph = sanitizeGraphState(incoming);
    resetGraphRenderCaches();
    lastPersistedGraphReference =
      incoming;
    graphCodegenRevision += 1;
    typedGraphCodegenCacheKey = "";
    typedGraphCodegenCache = null;
    if (acceptedAnalysisCertificate) {
      // The certificate is checked against the exact active semantic token
      // by the first analysis call. Defer pruning so an expanded composite
      // certificate can be consumed after expansion instead of validating
      // both the container view and its generated runtime graph.
      normalizeConnectionRouting(
        graph.connections
      );
    } else {
      pruneConnections();
    }
  }

function sanitizeGeneratedCSharp(source) {
    const input = String(source || "");
    let result = "";
    let index = 0;
    let state = "code";
    let rawQuoteCount = 0;

    const blank = character =>
      character === "\r" || character === "\n"
        ? character
        : " ";

    const blankRange = (start, end) => {
      for (let cursor = start; cursor < end; cursor += 1) {
        result += blank(input[cursor]);
      }
    };

    while (index < input.length) {
      const character = input[index];
      const next = input[index + 1] || "";

      if (state === "line-comment") {
        result += blank(character);
        index += 1;
        if (character === "\r" || character === "\n") {
          state = "code";
        }
        continue;
      }

      if (state === "block-comment") {
        if (character === "*" && next === "/") {
          blankRange(index, index + 2);
          index += 2;
          state = "code";
        } else {
          result += blank(character);
          index += 1;
        }
        continue;
      }

      if (state === "character") {
        result += blank(character);
        index += 1;
        if (character === "\\" && index < input.length) {
          result += blank(input[index]);
          index += 1;
        } else if (character === "'") {
          state = "code";
        }
        continue;
      }

      if (state === "string") {
        result += blank(character);
        index += 1;
        if (character === "\\" && index < input.length) {
          result += blank(input[index]);
          index += 1;
        } else if (character === '"') {
          state = "code";
        }
        continue;
      }

      if (state === "verbatim-string") {
        if (character === '"' && next === '"') {
          blankRange(index, index + 2);
          index += 2;
        } else {
          result += blank(character);
          index += 1;
          if (character === '"') {
            state = "code";
          }
        }
        continue;
      }

      if (state === "raw-string") {
        if (character === '"') {
          let quotes = 1;
          while (input[index + quotes] === '"') {
            quotes += 1;
          }
          blankRange(index, index + quotes);
          index += quotes;
          if (quotes >= rawQuoteCount) {
            state = "code";
            rawQuoteCount = 0;
          }
        } else {
          result += blank(character);
          index += 1;
        }
        continue;
      }

      if (character === "/" && next === "/") {
        blankRange(index, index + 2);
        index += 2;
        state = "line-comment";
        continue;
      }

      if (character === "/" && next === "*") {
        blankRange(index, index + 2);
        index += 2;
        state = "block-comment";
        continue;
      }

      if (character === "'") {
        result += " ";
        index += 1;
        state = "character";
        continue;
      }

      if (character === '"') {
        let quotes = 1;
        while (input[index + quotes] === '"') {
          quotes += 1;
        }

        if (quotes >= 3) {
          blankRange(index, index + quotes);
          index += quotes;
          rawQuoteCount = quotes;
          state = "raw-string";
          continue;
        }

        result += " ";
        index += 1;
        state =
          input[index - 2] === "@" ||
          (
            input[index - 2] === "$" &&
            input[index - 3] === "@"
          )
            ? "verbatim-string"
            : "string";
        continue;
      }

      result += character;
      index += 1;
    }

    return result;
  }

function unresolvedGeneratedMethodCalls(
    source
  ) {
    const sanitized =
      sanitizeGeneratedCSharp(source);
    const declarations = new Set();
    const declaredTypes = new Set();

    for (const match of sanitized.matchAll(
      /\b(?:public|private|protected|internal)\s+(?:static\s+)?(?:async\s+)?(?:[\w?.<>[\],]+\s+)+(?<name>[A-Za-z_]\w*)\s*(?:<[^>{};()]+>)?\s*\(/g
    )) {
      declarations.add(match.groups.name);
    }

    for (const match of sanitized.matchAll(
      /\b(?:class|struct|record)\s+(?<name>[A-Za-z_]\w*)/g
    )) {
      declaredTypes.add(match.groups.name);
    }

    const knownExternal = new Set([
      "ReferenceEquals"
    ]);
    const missing = new Set();

    for (const match of sanitized.matchAll(
      /\b(?<name>[A-Za-z_]\w*)\s*(?:<[^>{};()]+>)?\s*\(/g
    )) {
      const name = match.groups.name;
      const before = sanitized.slice(
        Math.max(0, match.index - 32),
        match.index
      );

      if (
        !/^[A-Z]/.test(name) ||
        /\.\s*$/.test(before) ||
        /\bnew\s*$/.test(before) ||
        declarations.has(name) ||
        declaredTypes.has(name) ||
        knownExternal.has(name)
      ) {
        continue;
      }

      missing.add(name);
    }

    return [...missing].sort();
  }

function duplicateGeneratedMembers(source) {
    const seen = new Set();
    const duplicates = new Set();
    const pattern =
      /^ {4}(?:public|private|protected|internal)\s+(?:static\s+)?(?:readonly\s+|volatile\s+|partial\s+|sealed\s+|async\s+)*(?!class\b|struct\b|record\b|event\b)(?:[\w?.<>[\],]+\s+)+(?<name>[A-Za-z_]\w*)\s*(?<tail>\([^)]*\)|(?:=|;|=>))/gm;

    for (const match of
      String(source || "").matchAll(pattern)) {
      const name = match.groups.name;
      const tail = match.groups.tail;
      let signature = `F:${name}`;

      if (tail.startsWith("(")) {
        const parameters = tail
          .slice(1, -1)
          .split(",")
          .map(value => value
            .trim()
            .replace(/\s*=.*$/, "")
            .replace(/\s+[A-Za-z_]\w*$/, "")
            .replace(
              /\b(?:ref|out|in|params|this)\s+/g,
              ""
            ))
          .join(",");
        signature =
          `M:${name}(${parameters})`;
      }

      if (seen.has(signature)) {
        duplicates.add(signature);
      }
      seen.add(signature);
    }

    return [...duplicates].sort();
  }

function generatedPrivateFieldLivenessProblems(
    source,
    additionalSources = []
  ) {
    const sanitized =
      sanitizeGeneratedCSharp(source);
    const externalSanitized =
      (Array.isArray(additionalSources)
        ? additionalSources
        : [])
        .map(value =>
          sanitizeGeneratedCSharp(value)
        )
        .join("\n");
    const referencePattern =
      /\b_[A-Za-z_]\w*N[0-9a-f]{8}\b/gi;
    const referencesByName = new Map();
    for (const reference of
      sanitized.matchAll(referencePattern)) {
      const references =
        referencesByName.get(
          reference[0]
        ) || [];
      references.push(reference);
      referencesByName.set(
        reference[0],
        references
      );
    }
    const externalNames = new Set(
      [...externalSanitized.matchAll(
        referencePattern
      )].map(reference => reference[0])
    );
    const declarations = [];
    const pattern =
      /^ {4}private\s+static\s+(?:(?:readonly|volatile)\s+)*(?<type>[^\n;{}=]+?)\s+(?<name>_[A-Za-z_]\w*N[0-9a-f]{8})(?<initializer>\s*=\s*[^;\n]+)?\s*;$/gim;

    for (const match of
      sanitized.matchAll(pattern)) {
      declarations.push({
        start: match.index,
        end:
          match.index + match[0].length,
        name: match.groups.name,
        initialized:
          Boolean(match.groups.initializer)
      });
    }

    const problems = [];

    for (const declaration of
      declarations) {
      if (externalNames.has(
        declaration.name
      )) {
        continue;
      }
      const occurrences =
        (referencesByName.get(
          declaration.name
        ) || []).filter(match =>
          match.index < declaration.start ||
          match.index >= declaration.end
        );

      if (occurrences.length === 0) {
        problems.push(
          `${declaration.name} (${declaration.initialized ? "initialized but never read" : "never used"})`
        );
        continue;
      }

      let hasRead = false;
      let hasWrite =
        declaration.initialized;

      for (const occurrence of
        occurrences) {
        const before = sanitized.slice(
          Math.max(
            0,
            occurrence.index - 16
          ),
          occurrence.index
        );
        const after = sanitized.slice(
          occurrence.index +
            occurrence[0].length,
          occurrence.index +
            occurrence[0].length +
            16
        );
        const simpleAssignment =
          /^\s*=(?!=|>)/.test(after);
        const readWriteOperation =
          /^\s*(?:\+\+|--|(?:\+|-|\*|\/|%|&|\||\^|<<|>>|\?\?)=)/.test(
            after
          ) ||
          /(?:\+\+|--|\bref\s+|\bout\s+)$/.test(
            before
          );

        if (simpleAssignment) {
          hasWrite = true;
        } else if (readWriteOperation) {
          hasRead = true;
          hasWrite = true;
        } else {
          hasRead = true;
        }
      }

      if (!hasRead) {
        problems.push(
          `${declaration.name} (written but never read)`
        );
      } else if (!hasWrite) {
        problems.push(
          `${declaration.name} (read but never assigned)`
        );
      }
    }

    return problems.sort();
  }

function generatedSourceDiagnostics(
    source,
    fileName,
    options = {}
  ) {
    const errors = [];
    if (!String(source || "").trim()) {
      return [
        `Internal code-generation error: ${fileName} is empty.`
      ];
    }
    const sanitized =
      sanitizeGeneratedCSharp(source);
    const pairs = [
      ["{", "}"],
      ["(", ")"],
      ["[", "]"]
    ];

    for (const [open, close] of pairs) {
      let depth = 0;
      for (const character of sanitized) {
        if (character === open) depth += 1;
        if (character === close) depth -= 1;
        if (depth < 0) break;
      }
      if (depth !== 0) {
        errors.push(
          `Internal code-generation error: unbalanced '${open}${close}' delimiters in ${fileName}.`
        );
      }
    }

    if (options.checkUnresolved !== false) {
      const unresolved =
        unresolvedGeneratedMethodCalls(source);
      if (unresolved.length > 0) {
        errors.push(
          `Internal code-generation error: unresolved generated method call(s) in ${fileName}: ${unresolved.join(", ")}.`
        );
      }
    }

    const duplicates =
      duplicateGeneratedMembers(source);
    if (duplicates.length > 0) {
      errors.push(
        `Internal code-generation error: duplicate generated member(s) in ${fileName}: ${duplicates.join(", ")}.`
      );
    }

    if (
      options.checkGeneratedFieldLiveness !==
      false
    ) {
      const fieldProblems =
        generatedPrivateFieldLivenessProblems(
          source,
          options.additionalSources
        );
      if (fieldProblems.length > 0) {
        errors.push(
          `Internal code-generation error: dead or invalid generated field(s) in ${fileName}: ${fieldProblems.join(", ")}.`
        );
      }
    }

    return errors;
  }

function compactSingleUseQueuedImpulseWrappers(
    source,
    impulseOutputs,
    usedQueuedMethods,
    usedEntryMethods
  ) {
    let optimized = String(source || "");

    for (const item of impulseOutputs) {
      if (
        !usedQueuedMethods.has(
          item.queuedMethod
        ) ||
        usedEntryMethods.has(
          item.entryMethod
        )
      ) {
        continue;
      }

      const wrapper =
`    private static void ${item.queuedMethod}() =>
        EnqueueGraphImpulse(${item.method});`;
      const tokenPattern =
        new RegExp(
          `\\b${item.queuedMethod}\\b`,
          "g"
        );
      const references =
        optimized.match(tokenPattern) || [];

      if (
        references.length !== 2 ||
        !optimized.includes(wrapper)
      ) {
        continue;
      }

      const directCallPattern =
        new RegExp(
          `^([ \\t]*)${item.queuedMethod}\\(\\);[ \\t]*$`,
          "gm"
        );
      const directCalls =
        optimized.match(directCallPattern) || [];

      if (directCalls.length !== 1) {
        continue;
      }

      optimized = optimized.replace(
        directCallPattern,
        `$1EnqueueGraphImpulse(${item.method});`
      );
      optimized = optimized.replace(
        `${wrapper}\n\n`,
        ""
      );
    }

    return optimized;
  }

function removeUnreachableGeneratedImpulseMethods(
    source,
    additionalSources = []
  ) {
    const generated = String(source || "")
      .replaceAll("\r\n", "\n");
    const methodPattern =
      /^    private static void ((?:Enter|QueueEmit|Inline|Emit)N[A-Za-z0-9_]+)\(\)/gm;
    const methods = [];
    let match;

    while (
      (match = methodPattern.exec(generated))
    ) {
      const start = match.index;
      const lineEnd =
        generated.indexOf("\n", start);
      const signature = generated.slice(
        start,
        lineEnd < 0
          ? generated.length
          : lineEnd
      );
      let end;

      if (signature.includes("=>")) {
        const semicolon =
          generated.indexOf(
            ";",
            lineEnd
          );
        end =
          semicolon < 0
            ? -1
            : semicolon + 1;
      } else {
        const closingBracePattern =
          /^    }$/gm;
        closingBracePattern.lastIndex =
          lineEnd + 1;
        const closingBrace =
          closingBracePattern.exec(
            generated
          );
        end = closingBrace
          ? closingBrace.index +
            closingBrace[0].length
          : -1;
      }

      if (end <= start) {
        continue;
      }

      methods.push({
        name: match[1],
        start,
        end,
        code: generated.slice(
          start,
          end
        )
      });
    }

    if (methods.length === 0) {
      return generated;
    }

    const methodByName =
      new Map(
        methods.map(method => [
          method.name,
          method
        ])
      );
    let rootSource = generated;

    for (const method of
      [...methods].sort(
        (left, right) =>
          right.start - left.start
      )) {
      rootSource =
        rootSource.slice(
          0,
          method.start
        ) +
        rootSource.slice(method.end);
    }

    rootSource += `\n${additionalSources
      .map(value => String(value || ""))
      .join("\n")}`;

    const referencedMethods = value =>
      new Set(
        (
          String(value || "").match(
            /\b(?:Enter|QueueEmit|Inline|Emit)N[A-Za-z0-9_]+\b/g
          ) || []
        ).filter(name =>
          methodByName.has(name)
        )
      );
    const roots =
      referencedMethods(rootSource);
    const dependencies =
      new Map(
        methods.map(method => [
          method.name,
          new Set(
            [...referencedMethods(
              method.code
            )].filter(
              name =>
                name !== method.name
            )
          )
        ])
      );
    const reachable = new Set();
    const pending = [...roots];

    while (pending.length > 0) {
      const name = pending.pop();

      if (reachable.has(name)) {
        continue;
      }

      reachable.add(name);
      for (const dependency of
        dependencies.get(name) || []) {
        if (!reachable.has(dependency)) {
          pending.push(dependency);
        }
      }
    }

    let optimized = generated;
    const unreachable = methods
      .filter(method =>
        !reachable.has(method.name)
      )
      .sort(
        (left, right) =>
          right.start - left.start
      );

    for (const method of unreachable) {
      let end = method.end;

      if (
        optimized.slice(
          end,
          end + 2
        ) === "\n\n"
      ) {
        end += 2;
      }

      optimized =
        optimized.slice(
          0,
          method.start
        ) +
        optimized.slice(end);
    }

    return optimized;
  }

function removeUnreferencedGeneratedFields(
    source,
    additionalSources = []
  ) {
    let optimized = String(source || "")
      .replaceAll("\r\n", "\n");
    const declarationPattern =
      /^    private static (?!readonly\b)([^\n;{}=]+?)\s+(_[A-Za-z_][A-Za-z0-9_]*N[0-9a-f]{8})(\s*=\s*[^;\n]+)?\s*;$/gim;
    const declarations = [
      ...optimized.matchAll(
        declarationPattern
      )
    ];
    const sanitized =
      sanitizeGeneratedCSharp(optimized);
    const referencePattern =
      /\b_[A-Za-z_]\w*N[0-9a-f]{8}\b/gi;
    const referencesByName = new Map();
    for (const reference of
      sanitized.matchAll(referencePattern)) {
      const references =
        referencesByName.get(
          reference[0]
        ) || [];
      references.push(reference);
      referencesByName.set(
        reference[0],
        references
      );
    }
    const externalNames = new Set(
      (Array.isArray(additionalSources)
        ? additionalSources
        : [])
        .flatMap(value => [
          ...sanitizeGeneratedCSharp(value)
            .matchAll(referencePattern)
        ])
        .map(reference => reference[0])
    );
    const transformations = [];

    for (const declaration of
      declarations) {
      const csType =
        String(declaration[1] || "")
          .trim();
      const name = declaration[2];
      const hasInitializer =
        Boolean(declaration[3]);
      const escaped = name.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
      if (externalNames.has(name)) {
        continue;
      }
      const references =
        referencesByName.get(name) || [];
      const remainingReferences =
        references.filter(reference =>
          reference.index <
            declaration.index ||
          reference.index >=
            declaration.index +
              declaration[0].length
        );
      const uses =
        remainingReferences.map(
          reference => {
            const before = sanitized.slice(
              Math.max(
                0,
                reference.index - 64
              ),
              reference.index
            );
            const after = sanitized.slice(
              reference.index +
                reference[0].length,
              reference.index +
                reference[0].length +
                16
            );
            const simpleWrite =
              /^\s*=(?!=|>)/.test(after);
            const readWrite =
              /^\s*(?:\+\+|--|(?:\+|-|\*|\/|%|&|\||\^|<<|>>|\?\?)=)/.test(
                after
              ) ||
              (
                /(?:\+\+|--|\bref\s+|\bout\s+)$/.test(
                  before
                ) &&
                !/(?:Interlocked|Volatile)\.Read\(\s*ref\s*$/i.test(
                  before
                )
              );
            return {
              simpleWrite,
              assigns:
                simpleWrite || readWrite
            };
          }
        );
      const replaceReads =
        uses.length > 0 &&
        !hasInitializer &&
        !uses.some(use => use.assigns);
      const initializer =
        String(declaration[3] || "")
          .replace(/^\s*=\s*/, "")
          .trim();
      const removableInitializer =
        !hasInitializer ||
        /^(?:null!?|default!?|default\([^)]*\)!?|true|false|[-+]?\d+(?:\.\d+)?[a-z]*|string\.Empty|Array\.Empty<[^>]+>\(\))$/i.test(
          initializer
        );
      const replaceWrites =
        uses.length > 0 &&
        removableInitializer &&
        uses.every(
          use => use.simpleWrite
        );

      if (
        uses.length === 0 ||
        replaceReads ||
        replaceWrites
      ) {
        transformations.push({
          name,
          escaped,
          replacement: replaceReads
            ? `default(${csType})`
            : "",
          replaceReads,
          replaceWrites,
          start: declaration.index,
          end:
            declaration.index +
            declaration[0].length
        });
      }
    }

    for (const declaration of
      transformations.sort(
        (left, right) =>
          right.start - left.start
      )) {
      let end = declaration.end;
      if (
        optimized.slice(end, end + 2) ===
        "\n\n"
      ) {
        end += 2;
      }
      optimized =
        optimized.slice(
          0,
          declaration.start
        ) +
        optimized.slice(end);
    }

    for (const transformation of
      transformations.filter(
        item => item.replaceReads
      )) {
      optimized = optimized.replace(
        new RegExp(
          `(?:System\\.Threading\\.)?Interlocked\\.Read\\(ref\\s+${transformation.escaped}\\)`,
          "g"
        ),
        transformation.replacement
      );
      optimized = optimized.replace(
        new RegExp(
          `\\b${transformation.escaped}\\b`,
          "g"
        ),
        transformation.replacement
      );
    }

    for (const transformation of
      transformations.filter(
        item => item.replaceWrites
      )) {
      optimized = optimized.replace(
        new RegExp(
          `\\b${transformation.escaped}\\b(?=\\s*=(?!=|>))`,
          "g"
        ),
        "_"
      );
    }

    return optimized;
  }

const RELOAD_USE_SITE_INPUTS =
    new Set([
      "actual-argument-type",
      "cleanup-path",
      "closed-generic-arguments",
      "constructed-delegate-lifetime",
      "constructed-object-lifetime",
      "handler-origin",
      "receiver-lifetime",
      "receiver-runtime-type",
      "result-lifetime",
      "runtime-implementation",
      "static-operation",
      "static-storage",
      "subscription-lifetime",
      "target-origin",
      "value-origin"
    ]);

const RELOAD_INTRINSIC_VALUE_TYPES =
    new Set([
      "impulse",
      "bool",
      "string",
      "Uri",
      "int",
      "float",
      "double",
      "int2",
      "int3",
      "int4",
      "float2",
      "float3",
      "float4",
      "double2",
      "double3",
      "double4",
      "colorX"
    ]);

function normalizedReloadStringList(
    values
  ) {
    return [...new Set(
      (Array.isArray(values) ? values : [])
        .map(value =>
          String(value || "").trim()
        )
        .filter(Boolean)
    )].sort();
  }

function reloadGraphTypeMayCarryModContext(
    type,
    typeDefinitions = TYPE_INFO
  ) {
    const normalized = String(
      type || ""
    ).trim();
    const base = typeBase(normalized);
    const information =
      typeDefinitions?.[base] || {};

    if (
      normalized.startsWith("enum:") ||
      base === "enum" ||
      RELOAD_INTRINSIC_VALUE_TYPES.has(
        base
      ) ||
      information.referenceType === false
    ) {
      return false;
    }

    return true;
  }

function reloadDangerousBuilderOrigin(
    node,
    definition,
    outputType
  ) {
    const operatorId = String(
      node?.operatorId || ""
    );
    const base = typeBase(outputType);

    if (
      operatorId === "constant.nullObject" ||
      operatorId === "task.completedTask"
    ) {
      return false;
    }

    if (
      /^(?:csharp\.|harmony\.|reflection\.)/.test(
        operatorId
      ) ||
      /^language\.(?:lambdaAction|method|callMethod)/.test(
        operatorId
      ) ||
      operatorId === "flow.typedCallback" ||
      definition?.customCSharpNode === true ||
      definition?.customCSharpSyntaxNode === true ||
      definition?.apiCompositeCustomCSharp === true
    ) {
      return true;
    }

    return [
      "action",
      "delegate",
      "exception",
      "fieldInfo",
      "methodInfo",
      "propertyInfo",
      "task"
    ].includes(base) ||
      /^normalDelegate:/.test(base);
  }

function reloadGraphUsage(
    options = {}
  ) {
    const nodes = Array.isArray(
      options.nodes
    )
      ? options.nodes
      : [];
    const connections = Array.isArray(
      options.connections
    )
      ? options.connections
      : [];
    const nodeById =
      options.nodeById ||
      new Map(
        nodes.map(node => [
          String(node?.id || ""),
          node
        ])
      );
    const definitionForNode =
      typeof options.definitionForNode ===
        "function"
        ? options.definitionForNode
        : node =>
            options.definitions?.[
              node?.operatorId
            ] || null;
    const resolvedType =
      typeof options.resolvedType ===
        "function"
        ? options.resolvedType
        : (_node, port) =>
            port?.type || null;
    const outgoing = new Map();
    const incoming =
      options.incoming ||
      new Map(
        connections.map(connection => [
          `${connection.toNode}:${connection.toPort}`,
          connection
        ])
      );

    for (const connection of connections) {
      const list =
        outgoing.get(
          String(connection.fromNode || "")
        ) || [];
      list.push(connection);
      outgoing.set(
        String(connection.fromNode || ""),
        list
      );
    }

    const executed = new Set();
    const pending = [];
    for (const node of nodes) {
      const definition =
        definitionForNode(node);
      const impulseInputs =
        (definition?.inputs || [])
          .filter(port =>
            resolvedType(node, port) ===
              "impulse"
          );
      const impulseOutputs =
        (definition?.outputs || [])
          .filter(port =>
            resolvedType(node, port) ===
              "impulse"
          );
      const isEventSubscription =
        definition?.apiMemberKind ===
          "event" ||
        node?.operatorId ===
          "lifecycle.subscribeEvent";

      if (
        isEventSubscription ||
        (
          impulseOutputs.length > 0 &&
          impulseInputs.length === 0
        )
      ) {
        pending.push(String(node.id));
      }
    }

    while (pending.length > 0) {
      const nodeId = pending.pop();
      if (executed.has(nodeId)) {
        continue;
      }
      executed.add(nodeId);
      const node = nodeById.get(nodeId);
      const definition =
        definitionForNode(node);
      for (const connection of
        outgoing.get(nodeId) || []) {
        const output =
          definition?.outputs?.find(
            port =>
              String(port?.id || "") ===
              String(
                connection.fromPort || ""
              )
          );
        if (
          resolvedType(node, output) ===
            "impulse"
        ) {
          pending.push(
            String(connection.toNode || "")
          );
        }
      }
    }

    const dataUsed = new Set();
    const dataPending = [...executed];
    while (dataPending.length > 0) {
      const nodeId = dataPending.pop();
      const node = nodeById.get(nodeId);
      const definition =
        definitionForNode(node);
      for (const port of
        definition?.inputs || []) {
        if (
          resolvedType(node, port) ===
            "impulse"
        ) {
          continue;
        }
        const connection =
          incoming.get(
            `${nodeId}:${String(port?.id || "")}`
          );
        const sourceId = String(
          connection?.fromNode || ""
        );
        if (
          sourceId &&
          !dataUsed.has(sourceId)
        ) {
          dataUsed.add(sourceId);
          dataPending.push(sourceId);
        }
      }
    }

    return Object.freeze({
      executed,
      dataUsed
    });
  }

function reloadCatalogNodeIsUsed(
    node,
    definition,
    usage,
    resolvedType = (_node, port) =>
      port?.type || null
  ) {
    const nodeId = String(node?.id || "");
    if (
      definition?.apiMemberKind === "event"
    ) {
      return true;
    }
    const hasImpulseInput =
      (definition?.inputs || []).some(
        port =>
          resolvedType(node, port) ===
          "impulse"
      );

    return hasImpulseInput
      ? usage?.executed?.has(nodeId) === true
      : usage?.dataUsed?.has(nodeId) === true ||
          usage?.executed?.has(nodeId) === true;
  }

function reloadUseSiteContext(
    options = {}
  ) {
    const nodes = Array.isArray(
      options.nodes
    )
      ? options.nodes
      : [];
    const connections = Array.isArray(
      options.connections
    )
      ? options.connections
      : [];

    return {
      nodes,
      connections,
      nodeById:
        options.nodeById ||
        new Map(
          nodes.map(node => [
            String(node?.id || ""),
            node
          ])
        ),
      incoming:
        options.incoming ||
        new Map(
          connections.map(connection => [
            `${connection.toNode}:${connection.toPort}`,
            connection
          ])
        ),
      connectedOutputs:
        options.connectedOutputs ||
        new Set(
          connections.map(connection =>
            `${connection.fromNode}:${connection.fromPort}`
          )
        ),
      definitionForNode:
        typeof options.definitionForNode ===
          "function"
          ? options.definitionForNode
          : node =>
              options.definitions?.[
                node?.operatorId
              ] || null,
      resolvedType:
        typeof options.resolvedType ===
          "function"
          ? options.resolvedType
          : (_node, port) =>
              port?.type || null,
      typeDefinitions:
        options.typeDefinitions ||
        TYPE_INFO,
      usage:
        options.usage || null,
      originCache:
        options.originCache || new Map(),
      originStack:
        options.originStack || new Set(),
      resolutionCache:
        options.resolutionCache ||
        new Map(),
      resolutionStack:
        options.resolutionStack ||
        new Set()
    };
  }

function reloadInputOrigin(
    node,
    inputId,
    context
  ) {
    const connection =
      context.incoming.get(
        `${node.id}:${inputId}`
      );

    if (!connection) {
      return {
        state: "safe",
        detail:
          `${inputId}:default-or-null`
      };
    }

    const sourceNode =
      context.nodeById.get(
        String(connection.fromNode || "")
      );
    const sourceDefinition =
      context.definitionForNode(sourceNode);
    const output =
      sourceDefinition?.outputs?.find(
        port =>
          String(port?.id || "") ===
          String(connection.fromPort || "")
      );
    const outputType =
      context.resolvedType(
        sourceNode,
        output
      );
    const key =
      `${connection.fromNode}:${connection.fromPort}`;

    if (
      !reloadGraphTypeMayCarryModContext(
        outputType,
        context.typeDefinitions
      )
    ) {
      return {
        state: "safe",
        detail: `${key}:value-type`
      };
    }

    if (context.originCache.has(key)) {
      return context.originCache.get(key);
    }
    if (
      !sourceNode ||
      !sourceDefinition ||
      context.originStack.has(key)
    ) {
      return {
        state: "unknown",
        detail: `${key}:unresolved-origin`
      };
    }

    context.originStack.add(key);
    let result;
    const memberKind = String(
      sourceDefinition.apiMemberKind || ""
    );
    const sourceHasImpulseInput =
      (sourceDefinition.inputs || []).some(
        port =>
          context.resolvedType(
            sourceNode,
            port
          ) === "impulse"
      );

    if (
      sourceHasImpulseInput &&
      context.usage &&
      !context.usage.executed.has(
        String(sourceNode.id || "")
      )
    ) {
      result = {
        state: "safe",
        detail:
          `${key}:unexecuted-default-result`
      };
    } else if (
      sourceDefinition.catalogGenerated ===
        true &&
      ["type", "enum"].includes(
        memberKind
      )
    ) {
      result = {
        state: "safe",
        detail: `${key}:catalog-${memberKind}`
      };
    } else if (
      reloadDangerousBuilderOrigin(
        sourceNode,
        sourceDefinition,
        outputType
      )
    ) {
      result = {
        state: "unsafe",
        detail:
          `${key}:mod-context-producing-node`
      };
    } else if (
      sourceDefinition.catalogGenerated ===
        true
    ) {
      const sourceSafety =
        sourceDefinition.apiReloadSafety ||
        sourceDefinition.apiVerification
          ?.reloadSafety ||
        {};
      const sourceLevel = String(
        sourceSafety.level || "unknown"
      ).toLowerCase();

      if (sourceLevel === "safe") {
        result = {
          state: "safe",
          detail: `${key}:scanner-safe-source`
        };
      } else if (
        sourceLevel === "conditional"
      ) {
        const resolution =
          resolveCatalogReloadUseSite(
            sourceNode,
            sourceDefinition,
            sourceSafety,
            context
          );
        result = resolution.resolved
          ? {
              state: "safe",
              detail:
                `${key}:resolved-catalog-source`
            }
          : {
              state: "unsafe",
              detail:
                `${key}:unsafe-catalog-source`
            };
      } else {
        result = {
          state: "unsafe",
          detail:
            `${key}:scanner-${sourceLevel}`
        };
      }
    } else {
      const dataInputs =
        (Array.isArray(
          sourceDefinition.inputs
        )
          ? sourceDefinition.inputs
          : [])
          .filter(port =>
            context.resolvedType(
              sourceNode,
              port
            ) !== "impulse"
          );
      const inputOrigins = dataInputs.map(
        port =>
          reloadInputOrigin(
            sourceNode,
            port.id,
            context
          )
      );
      const unsafe = inputOrigins.find(
        origin => origin.state === "unsafe"
      );
      const unknown = inputOrigins.find(
        origin => origin.state === "unknown"
      );
      const trustedRoot =
        /^(?:constant\.|configuration\.|lifecycle\.|resonite\.)/.test(
          String(
            sourceNode.operatorId || ""
          )
        );

      if (unsafe) {
        result = unsafe;
      } else if (unknown) {
        result = unknown;
      } else if (
        dataInputs.length > 0 ||
        trustedRoot
      ) {
        result = {
          state: "safe",
          detail:
            `${key}:safe-builder-dataflow`
        };
      } else {
        result = {
          state: "unknown",
          detail:
            `${key}:unproven-builder-origin`
        };
      }
    }

    context.originStack.delete(key);
    context.originCache.set(key, result);
    return result;
  }

function resolveCatalogReloadUseSite(
    node,
    definition,
    safety,
    suppliedContext = {}
  ) {
    const context =
      suppliedContext.nodeById
        ? suppliedContext
        : reloadUseSiteContext(
            suppliedContext
          );
    const cacheKey = String(
      node?.id || ""
    );

    if (
      cacheKey &&
      context.resolutionCache.has(
        cacheKey
      )
    ) {
      return context.resolutionCache.get(
        cacheKey
      );
    }
    if (
      cacheKey &&
      context.resolutionStack.has(
        cacheKey
      )
    ) {
      return Object.freeze({
        resolved: false,
        resolution:
          "unresolved-use-site",
        missingCleanup:
          normalizedReloadStringList(
            safety?.requiredCleanup
          ),
        unresolvedUseSiteInputs: [
          "cyclic-use-site-proof"
        ],
        unsafeOrigins: [],
        evidence: []
      });
    }

    const requiredCleanup =
      normalizedReloadStringList(
        safety?.requiredCleanup
      );
    const automaticCleanup =
      new Set(
        normalizedReloadStringList(
          definition
            ?.apiReloadAutomaticCleanup ||
          definition?.apiVerification
            ?.reloadAutomaticCleanup
        )
      );
    const missingCleanup =
      requiredCleanup.filter(
        requirement =>
          !automaticCleanup.has(
            requirement
          )
      );
    const useSiteInputs =
      normalizedReloadStringList(
        safety?.useSiteInputs
      );
    const unresolvedUseSiteInputs =
      useSiteInputs.filter(input =>
        !RELOAD_USE_SITE_INPUTS.has(input)
      );
    const unsafeOrigins = [];
    const evidence = [];
    const fail = input => {
      if (
        input &&
        !unresolvedUseSiteInputs.includes(
          input
        )
      ) {
        unresolvedUseSiteInputs.push(input);
      }
    };
    const inspectInput = (
      inputId,
      proofInput
    ) => {
      const origin = reloadInputOrigin(
        node,
        inputId,
        context
      );
      evidence.push(origin.detail);
      if (origin.state !== "safe") {
        unsafeOrigins.push(origin.detail);
        fail(proofInput);
      }
    };
    const operation = String(
      safety?.operation || ""
    ).trim().toLowerCase();
    const classificationBasis = String(
      safety?.classificationBasis || ""
    ).trim().toLowerCase();
    const inputs = Array.isArray(
      definition?.inputs
    )
      ? definition.inputs
      : [];
    const inputIds = new Set(
      inputs.map(port =>
        String(port?.id || "")
      )
    );
    const allAutomaticCleanup =
      missingCleanup.length === 0 &&
      requiredCleanup.length > 0;

    if (
      safety?.requiresUseSiteResolution !==
        true
    ) {
      fail("requires-use-site-resolution");
    }
    if (
      ![
        "construct",
        "invoke",
        "subscribe",
        "write"
      ].includes(operation)
    ) {
      fail("operation");
    }
    if (
      classificationBasis !==
        "use-site-dependent"
    ) {
      fail("classification-basis");
    }
    if (
      safety?.requiresExecutionProof === true
    ) {
      fail("runtime-execution-proof");
    }
    context.resolutionStack.add(cacheKey);

    if (
      operation === "subscribe" ||
      useSiteInputs.includes(
        "handler-origin"
      ) ||
      useSiteInputs.includes(
        "subscription-lifetime"
      )
    ) {
      if (allAutomaticCleanup) {
        evidence.push(
          "automatic-cleanup:" +
          requiredCleanup.join(",")
        );
      } else {
        fail("subscription-lifetime");
      }
    } else {
      if (
        useSiteInputs.includes(
          "value-origin"
        )
      ) {
        if (inputIds.has("value")) {
          inspectInput(
            "value",
            "value-origin"
          );
        } else {
          fail("value-origin");
        }
      }

      if (
        useSiteInputs.includes(
          "actual-argument-type"
        )
      ) {
        const argumentInputs = inputs
          .filter(port =>
            /^arg\d+$/.test(
              String(port?.id || "")
            ) ||
            Boolean(port?.apiParameterType)
          );
        for (const port of argumentInputs) {
          inspectInput(
            port.id,
            "actual-argument-type"
          );
        }
      }

      if (
        useSiteInputs.includes(
          "closed-generic-arguments"
        )
      ) {
        const genericInputs = inputs
          .filter(port =>
            /^generic\d+$/.test(
              String(port?.id || "")
            )
          );
        if (
          genericInputs.length === 0 &&
          Number(
            definition?.apiGenericArity || 0
          ) > 0
        ) {
          fail("closed-generic-arguments");
        }
        for (const port of genericInputs) {
          inspectInput(
            port.id,
            "closed-generic-arguments"
          );
        }
      }

      if (
        useSiteInputs.includes(
          "receiver-lifetime"
        ) ||
        useSiteInputs.includes(
          "receiver-runtime-type"
        ) ||
        useSiteInputs.includes(
          "runtime-implementation"
        )
      ) {
        if (
          definition?.apiIsStatic !== true &&
          inputIds.has("target")
        ) {
          inspectInput(
            "target",
            useSiteInputs.includes(
              "runtime-implementation"
            )
              ? "runtime-implementation"
              : useSiteInputs.includes(
                    "receiver-runtime-type"
                  )
                ? "receiver-runtime-type"
              : "receiver-lifetime"
          );
        } else if (
          definition?.apiIsStatic !== true
        ) {
          fail(
            useSiteInputs.includes(
              "runtime-implementation"
            )
              ? "runtime-implementation"
              : useSiteInputs.includes(
                    "receiver-runtime-type"
                  )
                ? "receiver-runtime-type"
              : "receiver-lifetime"
          );
        }
      }

      if (
        useSiteInputs.includes(
          "target-origin"
        )
      ) {
        const targetArgument =
          inputs.find(port =>
            /target/i.test(
              String(port?.label || "")
            ) ||
            /target/i.test(
              String(port?.id || "")
            )
          ) ||
          inputs.find(port =>
            String(port?.id || "") ===
            "arg0"
          );
        if (targetArgument) {
          inspectInput(
            targetArgument.id,
            "target-origin"
          );
        } else {
          fail("target-origin");
        }
      }
      if (
        useSiteInputs.includes(
          "constructed-delegate-lifetime"
        )
      ) {
        if (
          !useSiteInputs.includes(
            "target-origin"
          )
        ) {
          fail(
            "constructed-delegate-lifetime"
          );
        }
        const retainedDelegate =
          (definition?.outputs || [])
            .some(port =>
              ![
                "done",
                "success",
                "exception"
              ].includes(
                String(port?.id || "")
              ) &&
              context.connectedOutputs.has(
                `${node.id}:${port.id}`
              )
            );
        if (
          retainedDelegate &&
          !allAutomaticCleanup
        ) {
          fail(
            "constructed-delegate-lifetime"
          );
        } else if (!retainedDelegate) {
          evidence.push(
            "constructed-delegate-not-retained-by-graph"
          );
        }
      }

      if (
        useSiteInputs.includes(
          "constructed-object-lifetime"
        ) &&
        normalizedReloadStringList(
          safety?.reasons
        ).includes(
          "background-lifetime-construction"
        ) &&
        !allAutomaticCleanup
      ) {
        fail(
          "constructed-object-lifetime"
        );
      }

      if (
        useSiteInputs.includes(
          "result-lifetime"
        )
      ) {
        const liveResults =
          (Array.isArray(
            definition?.outputs
          )
            ? definition.outputs
            : [])
            .filter(port =>
              ![
                "done",
                "success",
                "exception"
              ].includes(
                String(port?.id || "")
              ) &&
              reloadGraphTypeMayCarryModContext(
                context.resolvedType(
                  node,
                  port
                ),
                context.typeDefinitions
              ) &&
              context.connectedOutputs.has(
                `${node.id}:${port.id}`
              )
            );
        if (liveResults.length > 0) {
          fail("result-lifetime");
        } else {
          evidence.push(
            "result-not-retained-by-graph"
          );
        }
      }

      const materialProofInputs =
        useSiteInputs.filter(input =>
          ![
            "cleanup-path",
            "static-operation",
            "static-storage"
          ].includes(input)
        );
      if (
        materialProofInputs.length === 0 &&
        !allAutomaticCleanup
      ) {
        fail("cleanup-path");
      }
    }

    if (
      unresolvedUseSiteInputs.length > 0 &&
      allAutomaticCleanup
    ) {
      const cleanupResolvable =
        unresolvedUseSiteInputs.every(
          input => [
            "cleanup-path",
            "handler-origin",
            "subscription-lifetime"
          ].includes(input)
        );
      if (cleanupResolvable) {
        unresolvedUseSiteInputs.splice(
          0,
          unresolvedUseSiteInputs.length
        );
      }
    }

    context.resolutionStack.delete(cacheKey);
    const resolved =
      unresolvedUseSiteInputs.length === 0;
    const result = Object.freeze({
      resolved,
      resolution: resolved
        ? allAutomaticCleanup
          ? "automatic-cleanup"
          : "safe-use-site"
        : "unresolved-use-site",
      missingCleanup:
        resolved ? [] : missingCleanup,
      unresolvedUseSiteInputs:
        normalizedReloadStringList(
          unresolvedUseSiteInputs
        ),
      unsafeOrigins:
        normalizedReloadStringList(
          unsafeOrigins
        ),
      evidence:
        normalizedReloadStringList(
          evidence
        )
    });

    if (cacheKey) {
      context.resolutionCache.set(
        cacheKey,
        result
      );
    }
    return result;
  }

function buildTypedNodeGraphCSharpContribution(
    request = {}
  ) {
    if (
      (customCSharpEditor ||
        apiCompositeEditor) &&
      !customCSharpRootOperation
    ) {
      return withRuntimeRootGraph(() =>
        buildTypedNodeGraphCSharpContribution(request)
      );
    }
    synchronizeGraphForCodegen(
      request
    );

    if (
      !apiCompositeRootOperation &&
      Object.keys(
        graph?.apiCompositeGraphs || {}
      ).length > 0
    ) {
      return withExpandedApiCompositeGraph(
        () =>
          buildTypedNodeGraphCSharpContribution(
            request
          )
      );
    }

    if (
      !graph?.configSnapshot
    ) {
      pendingGraphAnalysisCertificate = null;
      return {
        active: false,
        diagnostics: [],
        warnings: [],
        files: [],
        projects: [],
        applyStatements: {},
        requirements: {
          usesElements: false,
          usesRenderiteShared: false
        }
      };
    }

    const stateSnapshot =
      request.state ||
      bridge?.getStateSnapshot?.() ||
      {};
    const metadata =
      stateSnapshot.metadata ||
      graph.configSnapshot.metadata ||
      {};
    const includeGuideComments =
      metadata.includeGuide === true;
    if (includeGuideComments && !window.RMLGuidance?.ready(["runtime"])) {
      throw new Error("Runtime guidance must be loaded before synchronous graph generation.");
    }
    const generatedGuidance = (key, ...values) =>
      includeGuideComments
        ? window.RMLGuidance.text("runtime", key, ...values)
        : "";
    const guidanceWarnings = new Set();
    const cacheKey =
      JSON.stringify({
        metadata,
        graphCodegenRevision,
        graphNodeCount:
          graph.nodes.length,
        graphConnectionCount:
          graph.connections.length,
        nodeDefinitionRevision:
          Number(
            window.__RMLNodeDefinitionRevision
          ) || 0,
        apiFactoryVersion:
          Number(
            window.__RMLApiNodeFactoryVersion
          ) || 0,
        apiCatalogFingerprint:
          String(
            window.RMLApiNodeFactoryReport
              ?.catalogFingerprint || ""
          ),
        apiCatalogSource:
          String(
            window.RMLApiNodeFactoryReport
              ?.catalogSource || ""
          ),
        apiFactoryVerificationPassed:
          window.RMLApiNodeFactoryReport
            ?.verificationPassed === true
      });

    if (
      typedGraphCodegenCache &&
      typedGraphCodegenCacheKey ===
        cacheKey
    ) {
      pendingGraphAnalysisCertificate = null;
      return typedGraphCodegenCache;
    }

    const diagnostics = [];
    const warnings = [];
    const reloadSafetyIssues = [];
    const reloadSafetyIssueKeys =
      new Set();
    const analysis =
      analyzeConnections(
        graph.connections
      );
    pendingGraphAnalysisCertificate = null;
    const nodeById =
      new Map(
        graph.nodes.map(
          node => [node.id, node]
        )
      );
    const incoming =
      new Map(
        graph.connections.map(
          connection => [
            `${connection.toNode}:${connection.toPort}`,
            connection
          ]
        )
      );
    const connectedOutputs =
      new Set(
        graph.connections.map(
          connection =>
            `${connection.fromNode}:${connection.fromPort}`
        )
      );
    const resolvedType = (
      node,
      spec
    ) =>
      spec?.type ||
      analysis.bindings
        .get(node?.id)?.[
          spec?.typeVar
        ] ||
      null;
    const reloadUsage =
      reloadGraphUsage({
        nodes: graph.nodes,
        connections: graph.connections,
        nodeById,
        incoming,
        definitionForNode: nodeDefinition,
        resolvedType
      });
    const codegenActionIsReachable =
      nodeId =>
        reloadUsage.executed.has(
          String(nodeId || "")
        );
    const reloadResolutionContext =
      reloadUseSiteContext({
        nodes: graph.nodes,
        connections: graph.connections,
        nodeById,
        incoming,
        connectedOutputs,
        definitionForNode: nodeDefinition,
        resolvedType,
        typeDefinitions: TYPE_INFO,
        usage: reloadUsage
      });

    const addReloadSafetyIssue = issue => {
      const normalized = {
        nodeId: String(
          issue?.nodeId || ""
        ),
        nodeLabel: String(
          issue?.nodeLabel ||
          issue?.nodeId ||
          "<unnamed>"
        ),
        operatorId: String(
          issue?.operatorId || ""
        ),
        ownerType: String(
          issue?.ownerType || ""
        ),
        memberName: String(
          issue?.memberName || ""
        ),
        level: [
          "conditional",
          "unsafe",
          "unknown"
        ].includes(
          String(
            issue?.level || "unknown"
          ).toLowerCase()
        )
          ? String(issue.level).toLowerCase()
          : "unknown",
        operation: String(
          issue?.operation || ""
        ),
        classificationBasis: String(
          issue?.classificationBasis || ""
        ),
        requiresUseSiteResolution:
          issue?.requiresUseSiteResolution ===
          true,
        threadAffinity: String(
          issue?.threadAffinity ||
          "unknown"
        ),
        reasons: [...new Set(
          (Array.isArray(issue?.reasons)
            ? issue.reasons
            : [])
            .map(value =>
              String(value || "").trim()
            )
            .filter(Boolean)
        )].sort(),
        requiredCleanup: [...new Set(
          (Array.isArray(
            issue?.requiredCleanup
          )
            ? issue.requiredCleanup
            : [])
            .map(value =>
              String(value || "").trim()
            )
            .filter(Boolean)
        )].sort(),
        missingCleanup: [...new Set(
          (Array.isArray(
            issue?.missingCleanup
          )
            ? issue.missingCleanup
            : [])
            .map(value =>
              String(value || "").trim()
            )
            .filter(Boolean)
        )].sort(),
        useSiteInputs:
          normalizedReloadStringList(
            issue?.useSiteInputs
          ),
        unresolvedUseSiteInputs:
          normalizedReloadStringList(
            issue?.unresolvedUseSiteInputs
          ),
        unsafeOrigins:
          normalizedReloadStringList(
            issue?.unsafeOrigins
          ),
        useSiteEvidence:
          normalizedReloadStringList(
            issue?.useSiteEvidence
          ),
        resolution: String(
          issue?.resolution || ""
        )
      };
      const key = JSON.stringify(
        normalized
      );
      if (reloadSafetyIssueKeys.has(key)) {
        return;
      }
      reloadSafetyIssueKeys.add(key);
      reloadSafetyIssues.push(normalized);

      const contractName =
        [
          normalized.ownerType,
          normalized.memberName
        ]
          .filter(Boolean)
          .join(".") ||
        normalized.operatorId;
      const reasonText =
        normalized.reasons.length > 0
          ? normalized.reasons.join(", ")
          : "unknown scanner result";
      const cleanupText =
        normalized.missingCleanup.length > 0
          ? `; missing cleanup: ${normalized.missingCleanup.join(", ")}`
          : "";
      const useSiteText =
        normalized.unresolvedUseSiteInputs
          .length > 0
          ? `; unresolved use-site: ${normalized.unresolvedUseSiteInputs.join(", ")}`
          : "";
      const originText =
        normalized.unsafeOrigins.length > 0
          ? `; unsafe origin: ${normalized.unsafeOrigins.join(", ")}`
          : "";

      warnings.push(
        `Live reload disabled by node '${normalized.nodeLabel}' (${contractName}, ${normalized.level}, thread ${normalized.threadAffinity}): ${reasonText}${cleanupText}${useSiteText}${originText}. The mod remains buildable and runs normally.`
      );
    };

    for (const node of graph.nodes) {
      const definition = nodeDefinition(node);
      if (
        node?.kind !== "configuration" &&
        node?.operatorId !==
          "configuration.menuInstance" &&
        !definition
      ) {
        diagnostics.push(
          `Node '${node?.label || node?.id || "<unnamed>"}' uses unavailable operator '${node?.operatorId || "<missing>"}'. It cannot be exported until that verified node definition is available.`
        );
      } else if (definition?.unavailableApiContract === true) {
        const preserved = definition.preservedApiContract || node.apiContract || {};
        diagnostics.push(
          `Node '${node?.label || node?.id || "<unnamed>"}' preserves unavailable API '${[preserved.ownerType, preserved.memberName].filter(Boolean).join(".") || node?.operatorId}'. The graph remains editable, but this unresolved runtime path cannot be exported.`
        );
      }

      if (
        definition?.catalogGenerated === true &&
        reloadCatalogNodeIsUsed(
          node,
          definition,
          reloadUsage,
          resolvedType
        )
      ) {
        const verification =
          definition.apiVerification ||
          {};
        const safety =
          definition.apiReloadSafety ||
          verification.reloadSafety ||
          {};
        const level = String(
          safety.level || "unknown"
        ).toLowerCase();
        const requiredCleanup =
          Array.isArray(
            safety.requiredCleanup
          )
            ? safety.requiredCleanup
                .map(String)
            : [];
        const useSiteResolution =
          level === "conditional"
            ? resolveCatalogReloadUseSite(
                node,
                definition,
                safety,
                reloadResolutionContext
              )
            : {
                resolved: false,
                resolution:
                  level === "safe"
                    ? "scanner-safe"
                    : "scanner-blocked",
                missingCleanup:
                  requiredCleanup,
                unresolvedUseSiteInputs:
                  normalizedReloadStringList(
                    safety.useSiteInputs
                  ),
                unsafeOrigins: []
              };
        const conditionalResolved =
          level === "conditional" &&
          useSiteResolution.resolved ===
            true;

        if (
          level !== "safe" &&
          !conditionalResolved
        ) {
          addReloadSafetyIssue({
            nodeId: node?.id,
            nodeLabel:
              node?.label ||
              definition.title,
            operatorId: node?.operatorId,
            ownerType:
              verification.ownerType ||
              definition.catalogType,
            memberName:
              verification.memberName ||
              definition.catalogMember,
            level:
              [
                "conditional",
                "unsafe",
                "unknown"
              ].includes(level)
                ? level
                : "unknown",
            threadAffinity:
              definition
                .apiThreadAffinity ||
              verification.threadAffinity,
            operation: safety.operation,
            classificationBasis:
              safety.classificationBasis,
            requiresUseSiteResolution:
              safety.requiresUseSiteResolution,
            useSiteInputs:
              safety.useSiteInputs,
            reasons:
              safety.reasons?.length
                ? safety.reasons
                : [
                    "scanner-reload-metadata-missing"
                  ],
            requiredCleanup,
            missingCleanup:
              useSiteResolution
                .missingCleanup,
            unresolvedUseSiteInputs:
              useSiteResolution
                .unresolvedUseSiteInputs,
            unsafeOrigins:
              useSiteResolution
                .unsafeOrigins,
            useSiteEvidence:
              useSiteResolution.evidence,
            resolution:
              useSiteResolution.resolution
          });
        }
      }
    }
    const extensionUsingLines =
      new Set();
    const extensionFields =
      new Map();
    const extensionMembers =
      new Map();
    const extensionInitializeStatements =
      [];
    const extensionEngineInitStatements =
      [];
    const extensionRuntimeDrainStatements =
      [];
    const extensionFiles = [];
    const extensionProjects = [];
    const extensionReferences =
      new Map();
    const extensionPackageReferences =
      new Map();
    const extensionFrameworkReferences =
      new Set();
    const extensionRuntimeHelpers =
      new Set();
    const extensionRequirements = {
      usesElements: false,
      usesRenderiteShared: false,
      allowUnsafeBlocks: false,
      useWindowsForms: false,
      usesRuntimeConfigurationMenu: false,
      usesModUnloadLifecycle: false,
      usesHarmony: false,
      runtimeReloadUnsafe:
        reloadSafetyIssues.length > 0
    };

    const addNamedBlock = (
      collection,
      key,
      code
    ) => {
      const normalized =
        String(code || "").trim();

      if (!normalized) {
        return;
      }

      collection.set(
        String(key || normalized),
        normalized
      );
    };

    const addStatement = (
      collection,
      code
    ) => {
      const normalized =
        String(code || "").trim();

      if (
        normalized &&
        !collection.includes(normalized)
      ) {
        collection.push(normalized);
      }
    };

    if (!analysis.valid) {
      diagnostics.push(
        analysis.reason ||
          "The graph contains an invalid typed connection."
      );
    }

    const className =
      graphCsIdentifier(
        metadata.className,
        "YourMod"
      );
    const graphClassName =
      `${className}NodeGraph`;
    const namespaceName =
      graphCsNamespace(
        metadata.namespaceName
      );
    const fileName =
      `${className}.NodeGraph.cs`;
    const configurationEntries =
      flattenConfiguration(
        graph.configSnapshot.nodes || []
      );

    

    
    const configurationValueEntries =
      configurationEntries.filter(entry => {
        const node = entry?.node;

        return Boolean(
          node &&
          (
            node.kind === "setting" ||
            node.kind === "controller"
          ) &&
          ![
            "runtimeDisplay",
            "button"
          ].includes(node.valueType)
        );
      });
    const usedConfigurationRuntimeFields =
      new Set();
    const allocateConfigurationRuntimeField =
      node => {
        const baseField =
          graphCsIdentifier(
            node.fieldName ||
              node.keyName,
            "Setting"
          );
        let candidate = baseField;

        if (
          usedConfigurationRuntimeFields.has(
            candidate
          )
        ) {
          const stableSuffix =
            graphCsMethodToken(node.id);
          candidate =
            `${baseField}_${stableSuffix}`;
          let disambiguator = 2;

          while (
            usedConfigurationRuntimeFields.has(
              candidate
            )
          ) {
            candidate =
              `${baseField}_${stableSuffix}_${disambiguator}`;
            disambiguator += 1;
          }
        }

        usedConfigurationRuntimeFields.add(
          candidate
        );
        return candidate;
      };
    const configurationFields =
      configurationValueEntries
        .map(entry => {
        const node = entry.node;
        const type =
          configurationValueType(node);
        const field =
          allocateConfigurationRuntimeField(
            node
          );
        const dynamicChoiceSourceId =
          node.dynamicSettingKind === "choice"
            ? String(
                node._rmlEditableCollectionSourceNodeId ||
                ""
              )
            : "";

        return {
          node,
          type,
          csType:
            graphCsType(type),
          field,
          backing:
            `_config${field}`,
          configuredBacking:
            dynamicChoiceSourceId
              ? `_configured${field}`
              : "",
          dynamicChoiceSourceId,
          dynamicChoicePreferredDefault:
            String(node.defaultValue || ""),
          dynamicChoiceAllowEmpty:
            node.dynamicAllowEmpty === true,
          setter:
            `Set${field}`,
          getter:
            `Get${field}`,
          reactor:
            `React${field}`,
          portId:
            `config-${node.id}`,
          reaction:
            RUNTIME_BEHAVIORS[
              node.reaction
            ]
              ? node.reaction
              : "stored"
        };
      });
    const configurationFieldById =
      new Map(
        configurationFields.map(
          item => [
            item.node.id,
            item
          ]
        )
      );
    const expressionCache =
      new Map();
    const expressionStack =
      new Set();

    const inputExpression = (
      node,
      inputId
    ) => {
      const definition =
        nodeDefinition(node);
      const inputSpec =
        definition?.inputs?.find(
          spec => spec.id === inputId
        );
      const type =
        resolvedType(
          node,
          inputSpec
        );
      const connection =
        incoming.get(
          `${node.id}:${inputId}`
        );

      if (!connection) {
        const explicitDefault =
          typeof inputSpec?.defaultCs === "string" &&
          inputSpec.defaultCs.trim()
            ? inputSpec.defaultCs.trim()
            : null;

        return {
          type,
          code:
            explicitDefault ||
            graphCsDefault(type),
          connected: false,
          connection: null
        };
      }

      return {
        ...outputExpression(
          connection.fromNode,
          connection.fromPort
        ),
        connected: true,
        connection
      };
    };

    const storeFieldName = node =>
      `_store${graphCsMethodToken(node.id)}`;

    let impulseMethodByPort =
      new Map();
    let inlineImpulseMethodByPort =
      new Map();
    let entryMethodByPort =
      new Map();
    const usedEntryMethods =
      new Set();
    const usedQueuedMethods =
      new Set();
    const usedInlineMethods =
      new Set();

    const requestQueuedMethod = (
      nodeId,
      portId
    ) => {
      const method =
        impulseMethodByPort.get(
          `${nodeId}:${portId}`
        ) || "";

      if (method) {
        usedQueuedMethods.add(method);
      }

      return method;
    };

    const requestInlineMethod = (
      nodeId,
      portId
    ) => {
      const method =
        inlineImpulseMethodByPort.get(
          `${nodeId}:${portId}`
        ) || "";

      if (method) {
        usedInlineMethods.add(method);
      }

      return method;
    };

    const requestEntryMethod = (
      nodeId,
      portId
    ) => {
      const method =
        entryMethodByPort.get(
          `${nodeId}:${portId}`
        ) || "";

      if (method) {
        usedEntryMethods.add(method);
        requestQueuedMethod(
          nodeId,
          portId
        );
      }

      return method;
    };

    const registerReference =
      reference => {
        if (
          !reference ||
          typeof reference !== "object"
        ) {
          return;
        }

        const include = String(
          reference.include || ""
        ).trim();

        if (!include) {
          return;
        }

        const hintPath = String(
          reference.hintPath || ""
        ).trim();
        const isHarmonyReference =
          include.toLowerCase() ===
            "0harmony" ||
          /(?:^|[\\/])0harmony\.dll$/i.test(
            hintPath
          );

        if (isHarmonyReference) {
          extensionRequirements.usesHarmony =
            true;
          extensionRequirements.runtimeReloadUnsafe =
            true;
        }

        extensionReferences.set(
          include.toLowerCase(),
          {
            include,
            hintPath,
            private:
              reference.private === true
          }
        );
      };

    const registerPackageReference =
      packageReference => {
        if (
          !packageReference ||
          typeof packageReference !==
            "object"
        ) {
          return;
        }

        const include = String(
          packageReference.include || ""
        ).trim();
        const version = String(
          packageReference.version || ""
        ).trim();

        if (!include || !version) {
          return;
        }

        extensionPackageReferences.set(
          include.toLowerCase(),
          {
            include,
            version,
            privateAssets:
              String(
                packageReference.privateAssets ||
                  ""
              ).trim(),
            includeAssets:
              String(
                packageReference.includeAssets ||
                  ""
              ).trim()
          }
        );
      };

    const makeExtensionApi = (
      node,
      definition,
      extra = {}
    ) => ({
      node,
      definition,
      graph,
      metadata,
      stateSnapshot,
      className,
      graphClassName,
      namespaceName,
      analysis,
      resolvedType,
      input: inputId =>
        inputExpression(
          node,
          inputId
        ),
      isInputConnected(inputId) {
        return incoming.has(
          `${node.id}:${inputId}`
        );
      },
      isOutputConnected(outputId) {
        return connectedOutputs.has(
          `${node.id}:${outputId}`
        );
      },
      isActionReachable(
        nodeId = node?.id
      ) {
        return codegenActionIsReachable(
          nodeId
        );
      },
      inputConnection(inputId) {
        return incoming.get(
          `${node.id}:${inputId}`
        ) || null;
      },
      output: (
        nodeId,
        portId
      ) =>
        outputExpression(
          nodeId,
          portId
        ),
      emitMethod: (
        nodeId,
        portId
      ) =>
        requestQueuedMethod(
          nodeId,
          portId
        ),
      inlineMethod: (
        nodeId,
        portId
      ) =>
        requestInlineMethod(
          nodeId,
          portId
        ),
      entryMethod: (
        nodeId,
        portId
      ) =>
        requestEntryMethod(
          nodeId,
          portId
        ),
      token: graphCsMethodToken,
      identifier: graphCsIdentifier,
      escapeString:
        graphCsEscapeString,
      csType: graphCsType,
      csDefault: graphCsDefault,
      numberLiteral:
        graphCsNumberLiteral,
      colorLiteral:
        graphCsColorLiteral,
      addUsing(value) {
        const normalized =
          String(value || "").trim();
        if (normalized) {
          extensionUsingLines.add(
            normalized
          );
        }
      },
      addField(key, code) {
        addNamedBlock(
          extensionFields,
          key,
          code
        );
      },
      addRuntimeField(
        key,
        fieldName,
        csType,
        defaultCode
      ) {
        const runtimeKey =
          graphCsEscapeString(
            `${node?.id || "graph"}:${key}`
          );
        addNamedBlock(
          extensionFields,
          key,
`private static ${csType} ${fieldName}
{
    get => ReadGraphRuntimeValue<${csType}>("${runtimeKey}", ${defaultCode});
    set => WriteGraphRuntimeValue("${runtimeKey}", value);
}`
        );
      },
      addPersistentRuntimeField(
        key,
        fieldName,
        csType,
        defaultCode,
        graphType = ""
      ) {
        addNamedBlock(
          extensionFields,
          key,
          graphCsStaticFieldDeclaration(
            graphType,
            csType,
            fieldName,
            defaultCode
          )
        );
      },
      addMember(key, code) {
        addNamedBlock(
          extensionMembers,
          key,
          code
        );
      },
      addInitialize(code) {
        addStatement(
          extensionInitializeStatements,
          code
        );
      },
      addEngineInit(code) {
        addStatement(
          extensionEngineInitStatements,
          code
        );
      },
      addRuntimeDrain(code) {
        addStatement(
          extensionRuntimeDrainStatements,
          code
        );
      },
      addFile(file) {
        if (
          file &&
          typeof file.name === "string" &&
          file.name.trim() &&
          typeof file.content ===
            "string"
        ) {
          extensionFiles.push({
            name: file.name.trim(),
            content: file.content,
            type:
              file.type ||
              "text/plain;charset=utf-8",
            skipHeuristicDiagnostics:
              file.skipHeuristicDiagnostics === true
          });
        }
      },
      addProject(project) {
        if (
          !project ||
          typeof project !== "object" ||
          Array.isArray(project)
        ) {
          return;
        }

        const id = String(
          project.id ||
          project.name ||
          ""
        ).trim();
        const name = String(
          project.name ||
          project.assemblyName ||
          id
        ).trim();
        const files = Array.isArray(
          project.files
        )
          ? project.files
              .filter(file =>
                file &&
                typeof file.name === "string" &&
                file.name.trim() &&
                typeof file.content === "string"
              )
              .map(file => ({
                name: file.name.trim(),
                content: file.content,
                type:
                  file.type ||
                  "text/plain;charset=utf-8"
              }))
          : [];

        if (!id || !name || files.length === 0) {
          diagnostics.push(
            "A generated auxiliary project requires an id, name and at least one source file."
          );
          return;
        }

        extensionProjects.push({
          ...project,
          id,
          name,
          assemblyName: String(
            project.assemblyName || name
          ).trim(),
          rootNamespace: String(
            project.rootNamespace ||
            namespaceName
          ).trim(),
          folder: String(
            project.folder || name
          ).trim(),
          deployDirectory: String(
            project.deployDirectory ||
            "rml_libs"
          ).trim(),
          files,
          requirements:
            project.requirements &&
            typeof project.requirements === "object" &&
            !Array.isArray(project.requirements)
              ? project.requirements
              : {}
        });
      },
      addReference:
        registerReference,
      addPackageReference:
        registerPackageReference,
      addFrameworkReference(value) {
        const normalized =
          String(value || "").trim();
        if (normalized) {
          extensionFrameworkReferences.add(
            normalized
          );
        }
      },
      requireRuntimeHelper(value) {
        const normalized =
          String(value || "").trim();

        if (
          !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
            normalized
          )
        ) {
          throw new TypeError(
            "A runtime helper dependency must be a valid C# identifier."
          );
        }

        extensionRuntimeHelpers.add(
          normalized
        );
      },
      require(name, value = true) {
        if (
          Object.hasOwn(
            extensionRequirements,
            name
          )
        ) {
          extensionRequirements[name] =
            extensionRequirements[name] ||
            Boolean(value);

          if (
            name ===
              "runtimeReloadUnsafe" &&
            Boolean(value)
          ) {
            addReloadSafetyIssue({
              nodeId: node?.id,
              nodeLabel:
                node?.label ||
                definition?.title,
              operatorId:
                node?.operatorId,
              ownerType:
                definition?.catalogType,
              memberName:
                definition?.catalogMember,
              level: "unsafe",
              threadAffinity:
                definition
                  ?.apiThreadAffinity ||
                "unknown",
              reasons: [
                "builder-node-explicitly-reload-unsafe"
              ],
              requiredCleanup: [],
              missingCleanup: []
            });
          }
        }
      },
      diagnostic(message) {
        const normalized =
          String(message || "").trim();
        if (
          normalized &&
          !diagnostics.includes(normalized)
        ) {
          diagnostics.push(normalized);
        }
      },
      warning(message) {
        const normalized =
          String(message || "").trim();
        if (
          normalized &&
          !warnings.includes(normalized)
        ) {
          warnings.push(normalized);
        }
      },
      guidance(message) {
        const normalized =
          String(message || "").trim();
        if (!normalized) {
          return;
        }
        guidanceWarnings.add(normalized);
        if (!warnings.includes(normalized)) {
          warnings.push(normalized);
        }
      },
      guidanceComment(value) {
        return includeGuideComments ? String(value || "") : "";
      },
      includeGuideComments,
      ...extra
    });

    const outputExpression = (
      nodeId,
      portId
    ) => {
      const key = `${nodeId}:${portId}`;

      if (expressionCache.has(key)) {
        return expressionCache.get(key);
      }

      if (expressionStack.has(key)) {
        const cycle = {
          type: null,
          code: "default(object)"
        };
        diagnostics.push(
          `Expression cycle detected at ${key}.`
        );
        return cycle;
      }

      expressionStack.add(key);

      const node =
        nodeById.get(nodeId);
      const definition =
        node
          ? nodeDefinition(node)
          : null;
      const outputSpec =
        definition?.outputs?.find(
          spec => spec.id === portId
        );
      const type =
        node && outputSpec
          ? resolvedType(
              node,
              outputSpec
            )
          : null;
      const csType =
        graphCsType(type);
      let code =
        graphCsDefault(type);

      if (
        !node ||
        !definition ||
        !outputSpec
      ) {
        diagnostics.push(
          `A generated expression references missing output ${key}.`
        );
      } else if (
        node.kind ===
        "configuration"
      ) {
        if (type !== "impulse") {
          const field =
            configurationFieldById.get(
              outputSpec.sourceNodeId
            );

          code = field
            ? `${field.getter}()`
            : graphCsDefault(type);
        }
      } else {
        const input = id =>
          inputExpression(
            node,
            id
          );

        switch (node.operatorId) {
          case "constant.number":
            code = graphCsNumberLiteral(
              node.parameters?.value,
              type
            );
            break;

          case "constant.bool":
            code = node.parameters?.value
              ? "true"
              : "false";
            break;

          case "constant.string":
            code =
              `"${graphCsEscapeString(
                node.parameters?.value
              )}"`;
            break;

          case "constant.color":
            code = graphCsColorLiteral(
              node.parameters?.value,
              node.parameters?.colorProfile,
              node.parameters?.colorStrength
            );
            break;

          case "constant.typedDefault":
            code = graphCsDefault(type);
            break;

          case "math.add":
            code = variadicReduceCode(node, input, "GraphAdd", csType);
            break;

          case "math.subtract":
            code =
              `GraphSubtract<${csType}>(${input("a").code}, ${input("b").code})`;
            break;

          case "math.multiply":
            code = variadicReduceCode(node, input, "GraphMultiply", csType);
            break;

          case "math.divide":
            code =
              `GraphDivide<${csType}>(${input("a").code}, ${input("b").code})`;
            break;

          case "math.minimum":
            code = variadicReduceCode(node, input, "GraphMinimum", csType);
            break;

          case "math.maximum":
            code = variadicReduceCode(node, input, "GraphMaximum", csType);
            break;

          case "math.clamp":
            code =
              `GraphClamp<${csType}>(${input("value").code}, ${input("min").code}, ${input("max").code})`;
            break;

          case "math.negate":
            code =
              `GraphNegate<${csType}>(${input("value").code})`;
            break;

          case "math.absolute":
            code =
              `GraphAbsolute<${csType}>(${input("value").code})`;
            break;

          case "math.lerp":
            code =
              `GraphLerp<${csType}>(${input("a").code}, ${input("b").code}, ${input("t").code})`;
            break;

          case "logic.and": {
            const ids = variadicInputIds(node);
            code = `(${ids.map(id => input(id).code).join(" && ")})`;
            break;
          }

          case "logic.or": {
            const ids = variadicInputIds(node);
            code = `(${ids.map(id => input(id).code).join(" || ")})`;
            break;
          }

          case "logic.not":
            code =
              `(!${input("value").code})`;
            break;

          case "logic.equal": {
            const valueType =
              graphCsType(
                input("a").type ||
                input("b").type
              );
            code =
              `EqualityComparer<${valueType}>.Default.Equals(${input("a").code}, ${input("b").code})`;
            break;
          }

          case "logic.greater": {
            const valueType =
              graphCsType(
                input("a").type ||
                input("b").type
              );
            code =
              `(Comparer<${valueType}>.Default.Compare(${input("a").code}, ${input("b").code}) > 0)`;
            break;
          }

          case "logic.less": {
            const valueType =
              graphCsType(
                input("a").type ||
                input("b").type
              );
            code =
              `(Comparer<${valueType}>.Default.Compare(${input("a").code}, ${input("b").code}) < 0)`;
            break;
          }

          case "logic.select":
            code =
              `(${input("condition").code} ? ${input("true").code} : ${input("false").code})`;
            break;

          case "cast.doubleToFloat":
            code =
              `((float)${input("value").code})`;
            break;

          case "cast.floatToInt":
            code =
              `((int)${input("value").code})`;
            break;

          case "cast.toString":
            code =
              `FormatValue(${input("value").code})`;
            break;

          case "resonite.valueRelay":
          case "resonite.displayValue":
            code = input("value").code;
            break;

          case "resonite.store":
            code = storeFieldName(node);
            break;

          case "resonite.executionStore":
            code =
              `ReadGraphExecutionValue<${csType}>("execution-store:${graphCsEscapeString(node.id)}", ${graphCsDefault(type)})`;
            break;

          case "resonite.packColorX":
            code =
              `(colorX)new color(${input("r").code}, ${input("g").code}, ${input("b").code}, ${input("a").code})`;
            break;

          case "resonite.unpackColorX":
            code =
              `ReadFloatComponent(${input("value").code}, "${portId}")`;
            break;

          default: {
            const generator =
              definition.codegenExpression;

            if (
              typeof generator ===
              "function"
            ) {
              try {
                const generated =
                  generator(
                    makeExtensionApi(
                      node,
                      definition,
                      {
                        portId,
                        type,
                        resolvedCsType: csType,
                        input
                      }
                    )
                  );

                if (
                  typeof generated ===
                  "string"
                ) {
                  code = generated;
                } else if (
                  generated &&
                  typeof generated.code ===
                    "string"
                ) {
                  code = generated.code;
                }
              } catch (error) {
                diagnostics.push(
                  `${definition.title}: C# expression generation failed: ${
                    error instanceof Error
                      ? error.message
                      : String(error)
                  }`
                );
              }
            } else {
              code = graphCsDefault(type);
            }
            break;
          }
        }
      }

      const result = {
        type,
        code
      };
      expressionStack.delete(key);
      expressionCache.set(key, result);
      return result;
    };

    const storeNodes =
      graph.nodes.filter(
        node =>
          node.kind === "operator" &&
          node.operatorId ===
            "resonite.store"
      );
    const storeFields =
      storeNodes.map(node => {
        const definition =
          nodeDefinition(node);
        const currentSpec =
          definition.outputs.find(
            spec =>
              spec.id === "current"
          );
        const type =
          resolvedType(
            node,
            currentSpec
          ) ||
          node.parameters?.valueType ||
          "float";

        return {
          node,
          type,
          csType: graphCsType(type),
          field: storeFieldName(node)
        };
      });

    const impulseOutputs = [];

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);

      for (
        const spec of
        definition?.outputs || []
      ) {
        const concreteType =
          resolvedType(node, spec);
        const reactiveConfiguration =
          node.kind ===
            "configuration" &&
          runtimeBehaviorEmitsImpulse(
            spec.reaction
          );
        const reactiveConfigurationConnected =
          reactiveConfiguration &&
          graph.connections.some(
            connection => {
              if (
                connection.fromNode !==
                  node.id ||
                connection.fromPort !==
                  spec.id
              ) {
                return false;
              }

              return isConfigurationReactionConnection(
                {
                  node,
                  definition,
                  spec,
                  direction: "output"
                },
                findPortSpec(
                  connection.toNode,
                  connection.toPort,
                  "input"
                )
              );
            }
          );
        const impulseConnected =
          concreteType === "impulse" &&
          graph.connections.some(
            connection =>
              connection.fromNode === node.id &&
              connection.fromPort === spec.id
          );

        if (
          impulseConnected ||
          reactiveConfigurationConnected
        ) {
          impulseOutputs.push({
            node,
            spec,
            reactiveConfiguration,
            method:
              `Emit${graphCsMethodToken(
                node.id,
                spec.id
              )}`,
            inlineMethod:
              `Inline${graphCsMethodToken(
                node.id,
                spec.id
              )}`,
            queuedMethod:
              `QueueEmit${graphCsMethodToken(
                node.id,
                spec.id
              )}`,
            entryMethod:
              `Enter${graphCsMethodToken(
                node.id,
                spec.id
              )}`
          });
        }
      }
    }

    impulseMethodByPort =
      new Map(
        impulseOutputs.map(
          item => [
            `${item.node.id}:${item.spec.id}`,
            item.queuedMethod
          ]
        )
      );

    inlineImpulseMethodByPort =
      new Map(
        impulseOutputs.map(
          item => [
            `${item.node.id}:${item.spec.id}`,
            item.inlineMethod
          ]
        )
      );

    entryMethodByPort =
      new Map(
        impulseOutputs.map(
          item => [
            `${item.node.id}:${item.spec.id}`,
            item.entryMethod
          ]
        )
      );

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);
      const collector =
        definition?.codegenCollect;

      if (
        typeof collector !==
        "function"
      ) {
        continue;
      }

      try {
        collector(
          makeExtensionApi(
            node,
            definition
          )
        );
      } catch (error) {
        diagnostics.push(
          `${definition.title}: C# runtime collection failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );
      }
    }

    for (const plugin of GRAPH_CODEGEN_PLUGINS) {
      if (
        typeof plugin.collect !==
        "function"
      ) {
        continue;
      }

      try {
        plugin.collect(
          makeExtensionApi(
            null,
            null,
            {
              nodes: graph.nodes,
              definitions:
                OPERATOR_DEFINITIONS,
              nodeById,
              incoming
            }
          )
        );
      } catch (error) {
        diagnostics.push(
          `Mod-node plugin C# generation failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );
      }
    }

    const csharpBraceDelta = (
      line,
      lexicalState
    ) => {
      let delta = 0;
      let index = 0;

      while (index < line.length) {
        const current = line[index];
        const next = line[index + 1] || "";

        if (lexicalState.blockComment) {
          if (current === "*" && next === "/") {
            lexicalState.blockComment = false;
            index += 2;
          } else {
            index += 1;
          }
          continue;
        }

        if (lexicalState.stringMode === "normal") {
          if (current === "\\") {
            index += 2;
            continue;
          }
          if (current === '"') {
            lexicalState.stringMode = "";
          }
          index += 1;
          continue;
        }

        if (lexicalState.stringMode === "verbatim") {
          if (current === '"' && next === '"') {
            index += 2;
            continue;
          }
          if (current === '"') {
            lexicalState.stringMode = "";
          }
          index += 1;
          continue;
        }

        if (lexicalState.stringMode === "char") {
          if (current === "\\") {
            index += 2;
            continue;
          }
          if (current === "'") {
            lexicalState.stringMode = "";
          }
          index += 1;
          continue;
        }

        if (current === "/" && next === "/") {
          break;
        }

        if (current === "/" && next === "*") {
          lexicalState.blockComment = true;
          index += 2;
          continue;
        }

        if (
          current === "@" &&
          next === '"'
        ) {
          lexicalState.stringMode = "verbatim";
          index += 2;
          continue;
        }

        if (
          current === "$" &&
          next === "@" &&
          line[index + 2] === '"'
        ) {
          lexicalState.stringMode = "verbatim";
          index += 3;
          continue;
        }

        if (
          current === "@" &&
          next === "$" &&
          line[index + 2] === '"'
        ) {
          lexicalState.stringMode = "verbatim";
          index += 3;
          continue;
        }

        if (
          current === "$" &&
          next === '"'
        ) {
          lexicalState.stringMode = "normal";
          index += 2;
          continue;
        }

        if (current === '"') {
          lexicalState.stringMode = "normal";
          index += 1;
          continue;
        }

        if (current === "'") {
          lexicalState.stringMode = "char";
          index += 1;
          continue;
        }

        if (current === "{") {
          delta += 1;
        } else if (current === "}") {
          delta -= 1;
        }

        index += 1;
      }

      return delta;
    };

    const replaceEmitPlaceholders = (
      code,
      placeholderMethods
    ) => {
      let result = String(code || "");

      for (const [placeholder, method] of
        placeholderMethods) {
        result = result
          .split(placeholder)
          .join(method);
      }

      return result;
    };

    const splitFanOutTargetAction = (
      generatedCode,
      placeholderMethods
    ) => {
      const source = String(
        generatedCode || ""
      );

      if (
        !source ||
        placeholderMethods.size === 0
      ) {
        return {
          immediate: source,
          deferred: []
        };
      }

      const lines = source.split("\n");
      const immediateLines = [];
      const deferred = [];
      const lexicalState = {
        blockComment: false,
        stringMode: ""
      };
      let braceDepth = 0;
      let unsafeNestedEmit = false;

      for (const line of lines) {
        const trimmed = line.trim();
        let topLevelEmit = null;

        if (braceDepth === 0) {
          for (const [placeholder, method] of
            placeholderMethods) {
            if (trimmed === `${placeholder}();`) {
              topLevelEmit = method;
              break;
            }
          }
        }

        if (topLevelEmit) {
          deferred.push(`${topLevelEmit}();`);
        } else {
          const resolvedLine =
            replaceEmitPlaceholders(
              line,
              placeholderMethods
            );

          immediateLines.push(
            resolvedLine
          );

          for (const placeholder of
            placeholderMethods.keys()) {
            if (line.includes(placeholder)) {
              unsafeNestedEmit = true;
              break;
            }
          }
        }

        braceDepth += csharpBraceDelta(
          line,
          lexicalState
        );
      }

      if (unsafeNestedEmit) {
        return {
          immediate: "",
          deferred: [
            replaceEmitPlaceholders(
              source,
              placeholderMethods
            )
          ]
        };
      }

      return {
        immediate:
          immediateLines
            .join("\n")
            .replace(/^\s+|\s+$/g, ""),
        deferred
      };
    };

    const targetAction = (
      connection,
      deferFanOutContinuations = false,
      inlineContinuations = false
    ) => {
      const targetNode =
        nodeById.get(
          connection.toNode
        );

      if (
        !targetNode ||
        targetNode.kind !== "operator"
      ) {
        return {
          immediate: "",
          deferred: []
        };
      }

      const placeholderMethods =
        new Map();
      let placeholderSequence = 0;

      const emit = portId => {
        const method =
          inlineContinuations
            ? requestInlineMethod(
                targetNode.id,
                portId
              )
            : requestQueuedMethod(
                targetNode.id,
                portId
              );

        if (
          !method ||
          !deferFanOutContinuations
        ) {
          return method || "";
        }

        const placeholder =
          `__RmlFanOutEmit${
            graphCsMethodToken(
              targetNode.id,
              portId
            )
          }${placeholderSequence++}`;

        placeholderMethods.set(
          placeholder,
          method
        );

        return placeholder;
      };

      let generatedAction = "";

      switch (targetNode.operatorId) {
        case "resonite.impulseRelay": {
          const next = emit("out");
          generatedAction = next
            ? `${next}();`
            : "";
          break;
        }

        case "resonite.store": {
          const field =
            storeFieldName(targetNode);
          const value =
            inputExpression(
              targetNode,
              "value"
            ).code;
          const written =
            emit("written");

          generatedAction = `${field} = ${value};${written
            ? `\n        ${written}();`
            : ""}`;
          break;
        }

        case "resonite.executionStore": {
          const value =
            inputExpression(
              targetNode,
              "value"
            ).code;
          const written =
            emit("written");
          const key =
            `execution-store:${targetNode.id}`;

          generatedAction = `WriteGraphExecutionValue("${graphCsEscapeString(key)}", ${value});${written
            ? `\n        ${written}();`
            : ""}`;
          break;
        }

        default: {
          const definition =
            nodeDefinition(targetNode);
          const generator =
            definition?.codegenAction;

          if (
            typeof generator !==
            "function"
          ) {
            break;
          }

          try {
            const generated =
              generator(
                makeExtensionApi(
                  targetNode,
                  definition,
                  {
                    connection,
                    emit,
                    input: inputId =>
                      inputExpression(
                        targetNode,
                        inputId
                      )
                  }
                )
              );

            generatedAction =
              typeof generated ===
              "string"
              ? generated
              : generated?.code || "";
          } catch (error) {
            diagnostics.push(
              `${definition.title}: C# action generation failed: ${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`
            );
            generatedAction = "";
          }
          break;
        }
      }

      if (!deferFanOutContinuations) {
        return {
          immediate:
            generatedAction,
          deferred: []
        };
      }

      return splitFanOutTargetAction(
        generatedAction,
        placeholderMethods
      );
    };

    const impulseMethodEntries =
      impulseOutputs.map(item => {
        const sourceRef = {
          node: item.node,
          definition:
            nodeDefinition(
              item.node
            ),
          spec: item.spec,
          direction: "output"
        };
        const connections =
          graph.connections
            .filter(
              connection =>
                connection.fromNode ===
                  item.node.id &&
                connection.fromPort ===
                  item.spec.id
            )
            .filter(connection => {
              if (
                !item.reactiveConfiguration
              ) {
                return true;
              }

              const targetRef =
                findPortSpec(
                  connection.toNode,
                  connection.toPort,
                  "input"
                );

              return isConfigurationReactionConnection(
                sourceRef,
                targetRef
              );
            });
        const fanOut =
          connections.length > 1;
        const actionPlans =
          connections.map(connection =>
            targetAction(
              connection,
              fanOut
            )
          );
        const actions = fanOut
          ? [
              ...actionPlans
                .map(plan =>
                  plan.immediate
                )
                .filter(Boolean),
              ...actionPlans
                .flatMap(plan =>
                  plan.deferred
                )
                .filter(Boolean)
            ]
          : actionPlans
              .map(plan =>
                plan.immediate
              )
              .filter(Boolean);

        const failureSource =
          graphCsEscapeString(
            `Impulse ${item.node.operatorId}:${item.spec.id}`
          );

        return {
          item,
          code: globalThis.RMLCodeTemplates.text("runtime", "source_014", [item.method,
actions.length > 0
  ? actions
      .map(action =>
        action
          .split("\n")
          .map(line => `            ${line}`)
          .join("\n")
      )
      .join("\n")
  : generatedGuidance(
      "noImpulseTargetsIndented"
    ),
failureSource])
        };
      });

    const inlineImpulseMethodEntries =
      impulseOutputs.map(item => {
        const sourceRef = {
          node: item.node,
          definition:
            nodeDefinition(item.node),
          spec: item.spec,
          direction: "output"
        };
        const connections =
          graph.connections
            .filter(connection =>
              connection.fromNode === item.node.id &&
              connection.fromPort === item.spec.id
            )
            .filter(connection => {
              if (!item.reactiveConfiguration) {
                return true;
              }
              return isConfigurationReactionConnection(
                sourceRef,
                findPortSpec(
                  connection.toNode,
                  connection.toPort,
                  "input"
                )
              );
            });
        const actions = connections
          .map(connection =>
            targetAction(
              connection,
              false,
              true
            ).immediate
          )
          .filter(Boolean);

        return {
          item,
          code: `    private static void ${item.inlineMethod}()
    {
${actions.length > 0
  ? actions
      .map(action =>
        action
          .split("\n")
          .map(line => `        ${line}`)
          .join("\n")
      )
      .join("\n")
  : generatedGuidance(
      "noImpulseTargets"
    )}
    }`
        };
      });

    const configurationNode =
      graph.nodes.find(
        node =>
          node.kind ===
          "configuration"
      ) || null;
    const configurationButtons =
      configurationEntries.filter(
        entry =>
          entry?.node?.kind ===
            "setting" &&
          entry.node.valueType ===
            "button"
      );
    const configurationButtonCases =
      configurationNode
        ? configurationButtons
            .map(entry => {
              const method =
                requestEntryMethod(
                  configurationNode.id,
                  `config-${entry.node.id}`
                );

              return method
                ? `            case "${graphCsEscapeString(entry.node.id)}":
                DispatchGraphToWorld(() =>
                {
                    ${method}();
                    RefreshDisplays();
                });
                return true;`
                : "";
            })
            .filter(Boolean)
        : [];
    const configurationButtonTriggerCode =
globalThis.RMLCodeTemplates.text("runtime", "source_015", [generatedGuidance("outlineButtonSummary"),
configurationButtonCases.length > 0
  ? configurationButtonCases.join("\n")
  : generatedGuidance(
      "noOutlineButtons"
    )]);
    const startupEmitters = [];

    if (configurationNode) {
      for (const item of configurationFields) {
        if (
          !runtimeBehaviorIncludesStartup(
            item.reaction
          )
        ) {
          continue;
        }

        const method =
          requestEntryMethod(
            configurationNode.id,
            item.portId
          );

        if (method) {
          startupEmitters.push(
            `${method}();`
          );
        }
      }
    }

    for (const node of graph.nodes) {
      if (
        node.kind !== "operator"
      ) {
        continue;
      }

      if (
        node.operatorId ===
        "resonite.onStart"
      ) {
        const method =
          requestEntryMethod(
            node.id,
            "impulse"
          );
        if (method) {
          startupEmitters.push(
            `${method}();`
          );
        }
      }
    }

    const displayNodes =
      graph.nodes.filter(
        node =>
          node.kind === "operator" &&
          nodeDefinition(node)
            ?.displaysValue === true
      );
    const guardedRuntimeStatement = (
      sourceName,
      statement
    ) =>
`        try
        {
            ${statement}
        }
        catch (Exception exception)
        {
            ReportGraphRuntimeFailure(
                "${graphCsEscapeString(sourceName)}",
                exception);
        }`;
    const displayStatements =
      displayNodes.map((node, index) => {
        const connection =
          incoming.get(
            `${node.id}:value`
          );
        const label =
          node.label ||
          `Display Value ${index + 1}`;

        const monitorId =
          graphCsEscapeString(
            node.id
          );

        if (!connection) {
          return guardedRuntimeStatement(
            `Display ${node.id}`,
            `PublishDisplay("${monitorId}", "${graphCsEscapeString(label)}", "unknown", "<not connected>");`
          );
        }

        const expression =
          outputExpression(
            connection.fromNode,
            connection.fromPort
          );
        const graphType =
          graphCsEscapeString(
            expression.type ||
            "object"
          );

        return guardedRuntimeStatement(
          `Display ${node.id}`,
          `PublishDisplay("${monitorId}", "${graphCsEscapeString(label)}", "${graphType}", ${expression.code});`
        );
      });

    const impulseDisplayNodes =
      graph.nodes.filter(
        node =>
          node.kind === "operator" &&
          nodeDefinition(node)
            ?.displaysImpulse === true
      );

    for (
      let index = 0;
      index <
        impulseDisplayNodes.length;
      index += 1
    ) {
      const node =
        impulseDisplayNodes[index];
      const token =
        graphCsMethodToken(
          node.id
        );
      const label =
        node.label ||
        `Display Impulse ${index + 1}`;

      displayStatements.push(
        guardedRuntimeStatement(
          `Impulse display ${node.id}`,
          `PublishDisplay("${graphCsEscapeString(node.id)}", "${graphCsEscapeString(label)}", "impulse", System.Threading.Interlocked.Read(ref _impulseCount${token}));`
        )
      );
    }

    const editableCollectionNodes =
      graph.nodes.filter(
        node =>
          node?.kind === "operator" &&
          node?.operatorId ===
            "collection.collectToList" &&
          (
            node?.parameters?.markAsEditable === true ||
            node?.parameters?.markAsEditable === "true" ||
            node?.parameters?.markAsEditable === 1
          )
      );

    const editableCollectionNodeIds =
      new Set(
        editableCollectionNodes.map(node =>
          String(node.id || "")
        )
      );

    const directDynamicChoiceFields =
      configurationFields.filter(item =>
        item.dynamicChoiceSourceId &&
        editableCollectionNodeIds.has(
          item.dynamicChoiceSourceId
        )
      );

    const directDynamicChoiceFieldIds =
      new Set(
        directDynamicChoiceFields.map(item =>
          String(item.node.id || "")
        )
      );

    const dynamicCollectionCases =
      editableCollectionNodes.map(node => {
        const token =
          graphCsMethodToken(node.id);
        const field =
          `_collectedItems${token}`;

        return `            case "${graphCsEscapeString(node.id)}":
                lock (${field})
                {
                    return ${field}
                        .Select(item => FormatValue(item))
                        .Where(value =>
                            !string.IsNullOrWhiteSpace(value) &&
                            !string.Equals(
                                value,
                                "Runtime value unavailable",
                                StringComparison.Ordinal))
                        .ToArray();
                }`;
      });

    const dynamicCollectionPublishStatements =
      editableCollectionNodes.map(
        node => {
          const token =
            graphCsMethodToken(node.id);
          const field =
            `_collectedItems${token}`;
          const label =
            String(
              node?.parameters?.editableLabel ||
              node?.label ||
              "Dynamic Choice"
            );

          return `        PublishDynamicCollectionSource("${graphCsEscapeString(node.id)}", "${graphCsEscapeString(label)}", ${field});`;
        }
      );

    const dynamicChoiceFieldsBySource =
      new Map();

    for (const item of
      directDynamicChoiceFields) {
      const sourceId =
        item.dynamicChoiceSourceId;

      if (!dynamicChoiceFieldsBySource.has(
        sourceId
      )) {
        dynamicChoiceFieldsBySource.set(
          sourceId,
          []
        );
      }

      dynamicChoiceFieldsBySource
        .get(sourceId)
        .push(item);
    }

    const dynamicChoiceRefreshCases =
      [...dynamicChoiceFieldsBySource]
        .map(([sourceId, items]) => {
          const updates = items
            .map(item => {
              const token =
                graphCsMethodToken(
                  item.node.id
                );
              const configuredLocal =
                `_configuredValue${token}`;
              const resolvedLocal =
                `_resolvedValue${token}`;
              const changedLocal =
                `_selectionChanged${token}`;
              const reactionEmitter =
                configurationNode
                  ? impulseMethodByPort.get(
                      `${configurationNode.id}:${item.portId}`
                    )
                  : "";
              const emitChangedReaction =
                reactionEmitter
                  ? `

                    if (emitReactions && ${changedLocal})
                    {
                        ${item.reactor}();
                    }`
                  : "";

              return `                {
                    string ${configuredLocal};

                    lock (_configurationStateLock)
                    {
                        ${configuredLocal} = ${item.configuredBacking};
                    }

                    string ${resolvedLocal} =
                        ResolveDynamicChoiceValue(
                            ${configuredLocal},
                            "${graphCsEscapeString(item.dynamicChoicePreferredDefault)}",
                            GetDynamicCollectionItemsBySourceId(
                                "${graphCsEscapeString(sourceId)}"),
                            ${item.dynamicChoiceAllowEmpty ? "true" : "false"});

                    bool ${changedLocal};

                    lock (_configurationStateLock)
                    {
                        ${changedLocal} =
                            !EqualityComparer<string>.Default.Equals(
                                ${item.backing},
                                ${resolvedLocal});
                        ${item.backing} = ${resolvedLocal};
                    }${emitChangedReaction}
                }`;
            })
            .join("\n");

          return `            case "${graphCsEscapeString(sourceId)}":
${updates}
                break;`;
        });

    const dynamicChoiceRuntimeSupportCode =
      directDynamicChoiceFields.length > 0
        ? globalThis.RMLCodeTemplates.text("runtime", "source_016", [dynamicChoiceRefreshCases.join("\n")])
        : "";

    const runtimeMonitorNodes = [
      ...displayNodes,
      ...impulseDisplayNodes
    ];
    const runtimeBridgeChannel =
      `${namespaceName}.${className}`;

    const applyStatements = {};
    const syncStatements = {};
    const reactionStatements = {};

    for (
      const item of
      configurationFields
    ) {
      const syncStatement =
        `${graphClassName}.${item.setter}(value);`;

      applyStatements[item.node.id] =
        syncStatement;
      syncStatements[item.node.id] =
        syncStatement;

      const reactionEmitter =
        configurationNode
          ? impulseMethodByPort.get(
              `${configurationNode.id}:${item.portId}`
            )
          : "";

      if (reactionEmitter) {
        reactionStatements[
          item.node.id
        ] =
          `${graphClassName}.${item.reactor}();`;
      }
    }

    const requiredAssemblyReferences =
      new Map();

    const collectAssemblyReference = reference => {
      if (!reference || typeof reference !== "object") {
        return;
      }

      const include = String(
        reference.include || ""
      ).trim();

      if (!include) {
        return;
      }

      if (
        include === "FrooxEngine" ||
        include === "ResoniteModLoader" ||
        include === "mscorlib" ||
        include === "netstandard" ||
        include === "System" ||
        include.startsWith("System.") ||
        include.startsWith("Microsoft.")
      ) {
        return;
      }

      const key = include.toLowerCase();
      const existing =
        requiredAssemblyReferences.get(key);
      const candidate = {
        include,
        hintPath: String(
          reference.hintPath || ""
        ).trim(),
        private: reference.private === true
      };

      if (
        !existing ||
        (!existing.hintPath && candidate.hintPath)
      ) {
        requiredAssemblyReferences.set(
          key,
          candidate
        );
      }
    };

    const collectGraphTypeAssemblies = type => {
      for (const reference of
        graphTypeAssemblyReferences(type)) {
        collectAssemblyReference(reference);
      }
    };

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);

      for (const spec of [
        ...(definition?.inputs || []),
        ...(definition?.outputs || [])
      ]) {
        collectGraphTypeAssemblies(
          resolvedType(node, spec)
        );
      }

      for (const reference of
        Array.isArray(definition?.requiredAssemblyReferences)
          ? definition.requiredAssemblyReferences
          : []) {
        collectAssemblyReference(reference);
      }
    }

    for (const item of configurationFields) {
      collectGraphTypeAssemblies(item.type);
    }

    for (const reference of
      requiredAssemblyReferences.values()) {
      registerReference(reference);
    }

    const hasAssemblyReference = name =>
      requiredAssemblyReferences.has(
        String(name || "")
          .trim()
          .toLowerCase()
      );

    const usesElements =
      hasAssemblyReference("Elements.Core") ||
      extensionRequirements.usesElements ===
        true;
    const usesColorX =
      graph.nodes.some(node => {
        const definition =
          nodeDefinition(node);

        return [
          ...(definition?.inputs || []),
          ...(definition?.outputs || [])
        ].some(spec =>
          resolvedType(node, spec) ===
          "colorX"
        );
      }) ||
      configurationFields.some(
        item =>
          item.type === "colorX"
      ) ||
      hasAssemblyReference("Renderite.Shared") ||
      extensionRequirements.usesRenderiteShared ===
        true;

    const usingSet = new Set([
      "using System;",
      "using System.Collections.Generic;",
      "using System.Globalization;",
      "using System.Linq;",
      "using System.Reflection;",
      "using System.Threading;",
      "using System.Threading.Tasks;"
    ]);

    if (usesElements) {
      usingSet.add(
        "using Elements.Core;"
      );
    }

    if (usesColorX) {
      usingSet.add(
        "using Renderite.Shared;"
      );
    }

    for (const usingLine of extensionUsingLines) {
      const normalized =
        usingLine.startsWith("using ")
          ? usingLine
          : `using ${usingLine};`;
      usingSet.add(
        normalized.endsWith(";")
          ? normalized
          : `${normalized};`
      );
    }

    const usingLines =
      [...usingSet]
        .sort((left, right) => {
          const key = value => {
            const namespaceName = value
              .replace(/^using\s+/, "")
              .replace(/;$/, "");
            return namespaceName === "System"
              ? "0:"
              : namespaceName.startsWith("System.")
                ? `0:${namespaceName}`
                : `1:${namespaceName}`;
          };
          const leftKey = key(left);
          const rightKey = key(right);
          return leftKey === rightKey
            ? 0
            : leftKey < rightKey
              ? -1
              : 1;
        })
        .join("\n");
    const configFieldsCode =
      configurationFields
        .map(item => {
          const fields = [
            graphCsStaticFieldDeclaration(
              item.type,
              item.csType,
              item.backing,
              graphCsDefault(item.type),
              "    "
            )
          ];

          if (
            directDynamicChoiceFieldIds.has(
              String(item.node.id || "")
            )
          ) {
            fields.push(
              graphCsStaticFieldDeclaration(
                item.type,
                item.csType,
                item.configuredBacking,
                graphCsDefault(item.type),
                "    "
              )
            );
          }

          return fields.join("\n");
        })
        .join("\n");
    const setterCode =
      configurationFields
        .map(item => {
          const directDynamicChoice =
            directDynamicChoiceFieldIds.has(
              String(item.node.id || "")
            );

          const assignedValue =
            item.type === "string"
              ? "value ?? string.Empty"
              : "value";
          const assignment =
            directDynamicChoice
              ? `${item.configuredBacking} = ${assignedValue};`
              : `${item.backing} = ${assignedValue};`;

          const refresh =
            directDynamicChoice
              ? `\n\n        RefreshDynamicChoiceSelectionsForSource(\n            "${graphCsEscapeString(item.dynamicChoiceSourceId)}",\n            emitReactions: false);`
              : "";

          return globalThis.RMLCodeTemplates.text("runtime", "source_017", [item.setter,
item.csType,
assignment,
refresh,
item.csType,
item.getter,
item.backing]);
        })
        .join("\n\n");
    const reactionCode =
      configurationFields
        .filter(item =>
          Boolean(
            reactionStatements[
              item.node.id
            ]
          )
        )
        .map(item => {
          const emitter =
            requestEntryMethod(
              configurationNode.id,
              item.portId
            );

          return `    public static void ${item.reactor}()
    {
        DispatchGraphToWorld(() =>
        {
            ${emitter}();
            RefreshDisplays();
        });
    }`;
        })
        .join("\n\n");
    const storeFieldsCode =
      storeFields
        .map(item =>
          graphCsStaticFieldDeclaration(
            item.type,
            item.csType,
            item.field,
            graphCsDefault(item.type),
            "    "
          )
        )
        .join("\n");
    const extensionFieldsCode =
      [...extensionFields.values()]
        .map(code =>
          code
            .split("\n")
            .map(line =>
              line.length > 0
                ? `    ${line}`
                : ""
            )
            .join("\n")
        )
        .join("\n\n");
    const extensionMembersCode =
      [...extensionMembers.values()]
        .map(code =>
          code
            .split("\n")
            .map(line =>
              line.length > 0
                ? `    ${line}`
                : ""
            )
            .join("\n")
        )
        .join("\n\n");
    const formatExtensionStatements =
      (statements, sourceName) =>
        statements
          .map((statement, index) =>
            guardedRuntimeStatement(
              `${sourceName} ${index + 1}`,
              statement
            )
          )
          .join("\n");
    const reloadWarningSummary = issue => {
      const contractName = [
        issue.ownerType,
        issue.memberName
      ]
        .filter(Boolean)
        .join(".") ||
        issue.operatorId;
      const reasons =
        issue.reasons.length > 0
          ? issue.reasons.join(", ")
          : "unknown scanner result";
      const cleanup =
        issue.missingCleanup.length > 0
          ? `; missing cleanup: ${issue.missingCleanup.join(", ")}`
          : "";
      const useSite =
        issue.unresolvedUseSiteInputs
          .length > 0
          ? `; unresolved use-site: ${issue.unresolvedUseSiteInputs.join(", ")}`
          : "";
      return `${contractName} (${issue.level}, thread ${issue.threadAffinity}): ${reasons}${cleanup}${useSite}.`;
    };
    const reloadWarningGroups = new Map();
    for (const issue of reloadSafetyIssues) {
      const groupKey =
        reloadWarningSummary(issue);
      const group =
        reloadWarningGroups.get(groupKey) || {
          count: 0,
          summary: groupKey
        };
      group.count += 1;
      reloadWarningGroups.set(
        groupKey,
        group
      );
    }
    const nonReloadWarnings = warnings.filter(
      warning => {
        const normalized =
          String(warning).trim();
        return !normalized.startsWith(
          "Live reload disabled by node "
        ) &&
          (
            includeGuideComments ||
            !guidanceWarnings.has(normalized)
          );
      }
    );
    const sourceWarnings = [
      ...(reloadSafetyIssues.length > 0
        ? [
            `Live reload is disabled for ${reloadSafetyIssues.length} node(s). Full per-node diagnostics remain in the generated project metadata.`,
            ...[...reloadWarningGroups.values()]
              .sort((left, right) =>
                right.count - left.count
              )
              .map(({ count, summary }) =>
                `${count}x ${summary}`
              )
          ]
        : []),
      ...nonReloadWarnings
    ];
    const warningsComment =
      sourceWarnings.length > 0
        ? `\n/*\n${sourceWarnings
            .map(warning =>
              ` * ${String(warning).replaceAll("*/", "* /")}`
            )
            .join("\n")}\n */\n`
        : "\n";

    const guideComment =
      includeGuideComments
      ? generatedGuidance("header")
      : "";

    const queuedImpulseMethods =
      impulseOutputs
        .filter(item =>
          usedQueuedMethods.has(
            item.queuedMethod
          )
        )
        .map(item =>
`    private static void ${item.queuedMethod}() =>
        EnqueueGraphImpulse(${item.method});`
        )
        .join("\n\n");
    const inlineImpulseMethods =
      inlineImpulseMethodEntries
        .filter(({ item }) =>
          usedInlineMethods.has(
            item.inlineMethod
          )
        )
        .map(({ code }) => code)
        .join("\n\n");
    const impulseMethods =
      impulseMethodEntries
        .filter(({ item }) =>
          usedQueuedMethods.has(
            item.queuedMethod
          )
        )
        .map(({ code }) => code)
        .join("\n\n");

    const entryImpulseMethods =
      impulseOutputs
        .filter(item =>
          usedEntryMethods.has(
            item.entryMethod
          )
        )
        .map(item =>
`    private static void ${item.entryMethod}() =>
        BeginGraphEntry(${item.queuedMethod});`
        )
        .join("\n\n");

    let source = globalThis.RMLCodeTemplates.text("runtime", "Runtime_graph_main_class_template", [guideComment,
usingLines,
namespaceName,
warningsComment,
generatedGuidance("classSummary"),
graphClassName,
graphClassName,
graphCsEscapeString(runtimeBridgeChannel),
generatedGuidance("displayValuesSummary"),
generatedGuidance("displayEventSummary"),
generatedGuidance("monitorEventSummary"),
configFieldsCode || generatedGuidance(
  "noConfiguration"
),
storeFieldsCode ? `\n${storeFieldsCode}` : "",
extensionFieldsCode ? `\n\n${extensionFieldsCode}` : "",
extensionInitializeStatements.length > 0
  ? `\n${formatExtensionStatements(
      extensionInitializeStatements,
      "Initialize extension"
    )}`
  : "",
extensionRuntimeDrainStatements.length > 0
  ? `\n${formatExtensionStatements(
      extensionRuntimeDrainStatements,
      "Runtime drain extension"
    )}`
  : "",
setterCode || generatedGuidance(
  "noSetters"
),
reactionCode ? `

${reactionCode}` : "",
configurationButtonTriggerCode,
startupEmitters.length > 0
  ? "        BeginStartupWhenWorldReady();"
  : generatedGuidance(
      "noStartupPaths"
    ),
extensionEngineInitStatements.length > 0
  ? `\n${formatExtensionStatements(
      extensionEngineInitStatements,
      "Engine initialization extension"
    )}`
  : "",
runtimeMonitorNodes.length > 0
  ? `
        StartRuntimeDisplayPump();`
  : "",
generatedGuidance("worldDispatch"),
generatedGuidance("executionKernel"),
startupEmitters.length > 0 ? globalThis.RMLCodeTemplates.text("runtime", "source_018", [startupEmitters
  .map(call => `        ${call}`)
  .join("\n")]) : "",
[
  ...displayStatements,
  ...dynamicCollectionPublishStatements
].length > 0
  ? [
      ...displayStatements,
      ...dynamicCollectionPublishStatements
    ].join("\n")
  : generatedGuidance(
      "noDisplaySources"
    ),
dynamicCollectionCases.length > 0
  ? dynamicCollectionCases.join("\n")
  : '            default:\n                return Array.Empty<string>();',
dynamicCollectionCases.length > 0
  ? `\n            default:\n                return Array.Empty<string>();`
  : "",
dynamicChoiceRuntimeSupportCode,
directDynamicChoiceFields.length > 0
  ? `        RefreshDynamicChoiceSelectionsForSource(
            sourceNodeId,
            emitReactions: true);

`
  : "",
entryImpulseMethods ? `${entryImpulseMethods}\n\n` : "",
queuedImpulseMethods ? `${queuedImpulseMethods}\n\n` : "",
inlineImpulseMethods ? `${inlineImpulseMethods}\n\n` : "",
impulseMethods || generatedGuidance(
  "noImpulseOutputs"
),
extensionMembersCode ? `\n\n${extensionMembersCode}` : ""]);
    source =
      compactSingleUseQueuedImpulseWrappers(
        source,
        impulseOutputs,
        usedQueuedMethods,
        usedEntryMethods
      );
    source =
      removeUnreachableGeneratedImpulseMethods(
        source,
        extensionFiles.map(
          file => file?.content || ""
        )
      );
    source =
      removeUnreferencedGeneratedFields(
        source,
        extensionFiles.map(
          file => file?.content || ""
        )
      );

    for (const helper of
      extensionRuntimeHelpers) {
      const escaped =
        helper.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
      const declaration =
        new RegExp(
          `\\b(?:public|private|protected|internal)\\s+` +
          `(?:static\\s+)?(?:async\\s+)?` +
          `[A-Za-z_][A-Za-z0-9_.,?<>\\[\\]]*\\s+` +
          `${escaped}\\s*(?:<[^>{};()]+>)?\\s*\\(`
        );

      if (!declaration.test(source)) {
        diagnostics.push(
          `Internal code-generation error: required runtime helper '${helper}' is not declared in ${fileName}.`
        );
      }
    }

    diagnostics.push(
      ...generatedSourceDiagnostics(
        source,
        fileName,
        {
          additionalSources:
            extensionFiles.map(
              file => file?.content || ""
            )
        }
      )
    );
    for (const file of extensionFiles) {
      if (
        String(file?.name || "")
          .toLowerCase()
          .endsWith(".cs")
      ) {
        if (file.skipHeuristicDiagnostics !== true) {
          diagnostics.push(
            ...generatedSourceDiagnostics(
              file.content,
              file.name,
              {
                checkUnresolved: false,
                checkGeneratedFieldLiveness:
                  false
              }
            )
          );
        }
      }
    }

    const result = {
      active: true,
      className:
        graphClassName,
      verification: {
        schemaVersion:
          API_EXPORT_VERIFICATION_SCHEMA_VERSION,
        catalogFingerprint:
          String(
            window.RMLApiNodeFactoryReport
              ?.catalogFingerprint || ""
          ),
        engineVersion:
          String(
            window.RMLApiNodeFactoryReport
              ?.engineVersion || ""
          ),
        catalogSource:
          String(
            window.RMLApiNodeFactoryReport
              ?.catalogSource || ""
          )
      },
      diagnostics,
      warnings,
      files: (() => {
        const files = [
          {
            name: fileName,
            content: source,
            type:
              "text/plain;charset=utf-8"
          },
          ...extensionFiles
        ];
        const usedNames = new Set();

        return files.filter(file => {
          const name =
            String(file.name || "")
              .trim();
          const key =
            name.toLowerCase();

          if (
            !name ||
            usedNames.has(key)
          ) {
            if (name) {
              diagnostics.push(
                `Generated source file '${name}' occurs more than once.`
              );
            }
            return false;
          }

          usedNames.add(key);
          file.name = name;
          return true;
        });
      })(),
      projects: (() => {
        const usedIds = new Set();
        const usedNames = new Set();

        return extensionProjects.filter(project => {
          const id = String(project.id || "")
            .trim()
            .toLowerCase();
          const name = String(
            project.name ||
            project.assemblyName ||
            ""
          )
            .trim()
            .toLowerCase();

          if (
            !id ||
            !name ||
            usedIds.has(id) ||
            usedNames.has(name)
          ) {
            diagnostics.push(
              `Generated auxiliary project '${project.name || project.id || "<unnamed>"}' occurs more than once.`
            );
            return false;
          }

          usedIds.add(id);
          usedNames.add(name);
          return true;
        });
      })(),
      applyStatements,
      syncStatements,
      reactionStatements,
      initializeStatement:
        `${graphClassName}.Initialize(message => Msg(message));${
          extensionRequirements
            .usesRuntimeConfigurationMenu
            ? `\n${graphClassName}.BindRuntimeConfigurationMenu(SetRuntimeConfigurationMenuValue, SaveRuntimeConfigurationDrafts);`
            : ""
        }`,
      onEngineInitializedStatement:
        `${graphClassName}.OnEngineInit();`,
      onConfigurationSynchronizedStatement:
        `${graphClassName}.OnConfigurationSynchronized();`,
      requirements: {
        usesElements,
        usesRenderiteShared:
          usesColorX,
        allowUnsafeBlocks:
          extensionRequirements.allowUnsafeBlocks,
        useWindowsForms:
          extensionRequirements.useWindowsForms,
        usesRuntimeConfigurationMenu:
          extensionRequirements
            .usesRuntimeConfigurationMenu,
        usesModUnloadLifecycle:
          extensionRequirements
            .usesModUnloadLifecycle,
        usesHarmony:
          extensionRequirements
            .usesHarmony,
        runtimeReloadUnsafe:
          extensionRequirements
            .runtimeReloadUnsafe,
        reloadSafetyContractVersion:
          Math.max(
            0,
            Number(
              window.RMLResoniteApiCatalog
                ?.reloadSafetyContractVersion
            ) || 0
          ),
        reloadSafetyReaderVersion: 1,
        reloadSafetyIssues:
          reloadSafetyIssues.map(issue => ({
            ...issue,
            reasons: [...issue.reasons],
            requiredCleanup:
              [...issue.requiredCleanup],
            missingCleanup:
              [...issue.missingCleanup],
            useSiteInputs:
              [...issue.useSiteInputs],
            unresolvedUseSiteInputs:
              [...issue.unresolvedUseSiteInputs],
            unsafeOrigins:
              [...issue.unsafeOrigins],
            useSiteEvidence:
              [...issue.useSiteEvidence]
          })),
        references:
          [...extensionReferences.values()],
        packageReferences:
          [...extensionPackageReferences.values()],
        frameworkReferences:
          [...extensionFrameworkReferences]
      }
    };

    diagnostics.splice(
      0,
      diagnostics.length,
      ...new Set(
        diagnostics
          .map(message =>
            String(message || "").trim()
          )
          .filter(Boolean)
      )
    );
    warnings.splice(
      0,
      warnings.length,
      ...new Set(
        warnings
          .map(message =>
            String(message || "").trim()
          )
          .filter(Boolean)
      )
    );

    typedGraphCodegenCacheKey =
      cacheKey;
    typedGraphCodegenCache =
      result;

    return result;
  }

function validateTypedNodeGraphDocument(
    request = {}
  ) {
    const requestedGraph =
      request.state?.extensions?.[
        EXTENSION_NAME
      ];

    if (
      !requestedGraph ||
      typeof requestedGraph !== "object" ||
      Array.isArray(requestedGraph)
    ) {
      return Object.freeze({
        valid: true,
        diagnostics: Object.freeze([]),
        analysisCertificate: null
      });
    }

    const rawNodes =
      Array.isArray(requestedGraph.nodes)
        ? requestedGraph.nodes
        : [];
    const rawConnections =
      Array.isArray(
        requestedGraph.connections
      )
        ? requestedGraph.connections
        : [];
    const candidate =
      sanitizeGraphState(
        requestedGraph
      );
    const diagnostics = [];
    let analysisCertificate = null;
    const legacyCSharpMigration =
      finiteNumber(requestedGraph.version, 0) < 23 &&
      Object.keys(candidate.customCSharpFiles || {}).length >
        Object.keys(requestedGraph.customCSharpFiles || {}).length;

    if (
      !legacyCSharpMigration &&
      candidate.nodes.length !==
        rawNodes.length
    ) {
      diagnostics.push(
        `The stored graph contains ${rawNodes.length - candidate.nodes.length} invalid or duplicate node record(s).`
      );
    }

    if (
      !legacyCSharpMigration &&
      candidate.connections.length !==
        rawConnections.length
    ) {
      diagnostics.push(
        `The stored graph contains ${rawConnections.length - candidate.connections.length} invalid, duplicate or orphaned connection record(s).`
      );
    }

    for (const node of candidate.nodes) {
      if (
        node.kind === "operator" &&
        !OPERATOR_DEFINITIONS[
          node.operatorId
        ]
      ) {
        diagnostics.push(
          `Node '${node.label || node.id || "<unnamed>"}' uses unavailable operator '${node.operatorId || "<missing>"}'.`
        );
      }
    }

    if (diagnostics.length === 0) {
      const previousGraph = graph;

      try {
        const expanded =
          expandApiCompositeGraphDocument(
            candidate
          );
        graph = expanded;
        const analysis =
          analyzeConnections(
            expanded.connections
          );

        if (!analysis.valid) {
          diagnostics.push(
            analysis.reason ||
              "The graph contains an invalid typed connection."
          );
        } else {
          analysisCertificate =
            createGraphAnalysisCertificate(
              expanded.connections,
              analysis
            );
        }
      } catch (error) {
        diagnostics.push(
          error instanceof Error
            ? error.message
            : String(error)
        );
      } finally {
        graph = previousGraph;
      }
    }

    const uniqueDiagnostics =
      Object.freeze(
        [...new Set(
          diagnostics
            .map(value =>
              String(value || "").trim()
            )
            .filter(Boolean)
        )]
      );

    return Object.freeze({
      valid:
        uniqueDiagnostics.length === 0,
      diagnostics:
        uniqueDiagnostics,
      analysisCertificate:
        uniqueDiagnostics.length === 0
          ? analysisCertificate
          : null
    });
  }

function fallbackConcreteTypeForPort(
    portRef
  ) {
    if (portRef?.spec?.type) {
      return portRef.spec.type;
    }

    const configured =
      portRef?.node?.parameters?.valueType;

    if (
      configured &&
      configured !== "auto"
    ) {
      return configured;
    }

    switch (
      portRef?.spec?.constraint ||
      "value"
    ) {
      case "scalar":
      case "ordered":
      case "arithmetic":
      case "interpolatable":
        return "float";

      case "reference":
      case "value":
      case "anyValue":
      case "serializable":
      default:
        return "object";
    }
  }

function ensureGraphConnectionLookups() {
    const connections = graph.connections;
    if (
      graphConnectionLookupSource === connections &&
      graphConnectionLookupLength === connections.length
    ) {
      return;
    }
    const canAdoptAppendedTail = Boolean(
      graphConnectionLookupSource === connections &&
      graphConnectionLookupLength >= 0 &&
      graphConnectionLookupLength < connections.length &&
      graphConnectionLookupCache.size ===
        graphConnectionLookupLength
    );
    if (canAdoptAppendedTail) {
      const tailStart =
        graphConnectionLookupLength;
      const tailIds = new Set();
      let validTail = true;
      for (
        let index = tailStart;
        index < connections.length;
        index += 1
      ) {
        const connection = connections[index];
        if (
          !connection?.id ||
          tailIds.has(connection.id) ||
          graphConnectionLookupCache.has(
            connection.id
          )
        ) {
          validTail = false;
          break;
        }
        tailIds.add(connection.id);
      }
      if (validTail) {
        for (
          let index = tailStart;
          index < connections.length;
          index += 1
        ) {
          const connection = connections[index];
          graphConnectionLookupCache.set(
            connection.id,
            connection
          );
          for (const nodeId of [
            connection.fromNode,
            connection.toNode
          ]) {
            let ids =
              graphIncidentConnectionLookupCache.get(
                nodeId
              );
            if (!ids) {
              ids = new Set();
              graphIncidentConnectionLookupCache.set(
                nodeId,
                ids
              );
            }
            ids.add(connection.id);
          }
        }
        graphConnectionLookupLength =
          connections.length;
        return;
      }
    }
    graphConnectionLookupSource = connections;
    graphConnectionLookupLength = connections.length;
    graphConnectionLookupCache = new Map(
      connections.map(connection => [
        connection.id,
        connection
      ])
    );
    graphIncidentConnectionLookupCache = new Map();
    for (const connection of connections) {
      for (const nodeId of [
        connection.fromNode,
        connection.toNode
      ]) {
        let ids =
          graphIncidentConnectionLookupCache.get(
            nodeId
          );
        if (!ids) {
          ids = new Set();
          graphIncidentConnectionLookupCache.set(
            nodeId,
            ids
          );
        }
        ids.add(connection.id);
      }
    }
  }

function graphConnectionById(
    connectionId
  ) {
    ensureGraphConnectionLookups();
    return graphConnectionLookupCache.get(connectionId) || null;
  }

Object.defineProperty(
    window,
    "RMLAnalyzeGraphConnectionsAsync",
    {
      value:
        analyzeGraphConnectionsAsync,
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

Object.defineProperty(
    window,
    "RMLTypedNodeGraphGenerator",
    {
      value: Object.freeze({
        moduleId:
          "1.20.31-universal-presentation-dev23",
        build:
          buildTypedNodeGraphCSharpContribution,
        validateDocument:
          validateTypedNodeGraphDocument,
        acceptAnalysisCertificate(
          certificate
        ) {
          return acceptGraphAnalysisCertificate(
            certificate
          );
        },
        acceptTransferredAnalysisCertificate(
          certificate
        ) {
          // Callers must source this only from a live validation result or a
          // graph-codegen worker response, never from project/file fields.
          return acceptGraphAnalysisCertificate(
            certificate,
            { transferred: true }
          );
        },
        reconcileCompositeBoundaries:
          reconcileApiCompositeBoundaryTree,
        propagateCompositeBoundaries:
          propagateApiCompositeBoundariesOutward,
        isCanonicalSyntheticCollectorType,
        verifyGeneratedSource(
          source,
          fileName = "Generated.cs",
          options = {}
        ) {
          return generatedSourceDiagnostics(
            source,
            fileName,
            options
          );
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
