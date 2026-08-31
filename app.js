"use strict";

const STORAGE_KEY = "rml-configuration-builder-standalone-v1";
const PREVIEW_STORAGE_KEY = "rml-preview-values-v2";
const RML_VISUAL_TOUR_TEST =
  new URLSearchParams(window.location.search).has("rmlTourTest") ||
  window.location.hash.includes("rmlTourTest");
const RML_VISUAL_TOUR_STORAGE_KEY =
  new URLSearchParams(window.location.search).get("rmlTourStorageKey") || "";
const ACTIVE_STORAGE_KEY = RML_VISUAL_TOUR_TEST
  ? (
      /^rml-configuration-builder-visual-test-[a-z0-9._-]+$/i.test(
        RML_VISUAL_TOUR_STORAGE_KEY
      )
        ? RML_VISUAL_TOUR_STORAGE_KEY
        : "rml-configuration-builder-visual-test-default"
    )
  : STORAGE_KEY;
const ACTIVE_PREVIEW_STORAGE_KEY = RML_VISUAL_TOUR_TEST
  ? `${ACTIVE_STORAGE_KEY}-preview`
  : PREVIEW_STORAGE_KEY;
const ACTIVE_PAGE_STORAGE_KEY =
  `${ACTIVE_STORAGE_KEY}-active-page-v1`;
const PROJECT_FORMAT = "rml-configuration-builder-project";
const PROJECT_FORMAT_VERSION = 1;
const SAVED_API_COMPOSITE_IMPORT_SCHEMA =
  "rml-builder.saved-api-composites";
const SAVED_API_COMPOSITE_IMPORT_MAX_BYTES =
  32 * 1024 * 1024;
const PROJECT_FILE_MAX_BYTES = 512 * 1024 * 1024;
const PROJECT_TREE_MAX_DEPTH = 32;
const PROJECT_TREE_MAX_ITEMS = 1000000;
const PROJECT_LOCAL_STORAGE_MAX_BYTES =
  2 * 1024 * 1024;
const PROJECT_DRAFT_DATABASE_NAME =
  "rml-builder-project-drafts";
const PROJECT_DRAFT_DATABASE_VERSION = 1;
const PROJECT_DRAFT_STORE_NAME = "drafts";
const EXAMPLE_PROJECT_FILE_NAME = "Load Example.json";
const ROOT_CONTAINER = "root";
const LAYOUT_ROW_KIND = "layoutRow";
const RML_BUILDER_BUILD_ID =
  "catalog-reconciled-saved-composites-20260830-v647";
const BUILDER_REPLACEMENT_RENDER_LIMIT =
  200;

function removeLegacyHelpHashFromAddress() {
  if (!/^#(?:info-|shortcut-)/i.test(window.location.hash)) {
    return;
  }

  window.history.replaceState(
    window.history.state,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

removeLegacyHelpHashFromAddress();

function exposeRmlBuilderBuildId() {
  document.documentElement.dataset
    .rmlBuilderBuild = RML_BUILDER_BUILD_ID;
  Object.defineProperty(
    window,
    "RMLBuilderBuildId",
    {
      value: RML_BUILDER_BUILD_ID,
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
}

exposeRmlBuilderBuildId();
console.info(
  `[RML Builder] ${RML_BUILDER_BUILD_ID}`
);
const DEFAULT_LAYOUT_ROW_DESCRIPTION =
  "Places its direct Configuration Outline items next to each other.";
const OUTLINE_CONTAINER_LANE_SELECTOR =
  ".option-lane[data-container], " +
  ".layout-row-lane[data-container]";
const DRAG_SCROLL_VISIBILITY_PADDING = 8;
const DRAG_SCROLL_MAX_SPEED = 22;
const DRAG_SCROLL_VISIBILITY_MAX_SPEED = 48;
const VECTOR_COMPONENT_NAMES = ["X", "Y", "Z", "W"];
const DRAG_SCROLL_EDGE_SIZE = 110;
const DRAG_SCROLL_MIN_SPEED = 3;
const PALETTE_GROUP_NAMES = [
  "Core",
  "Numbers",
  "Vectors",
  "Visual",
  "Structure"
];

const COLORX_NAMED_PREVIEWS = {
  White: { channels: [1, 1, 1, 1], label: "White" },
  Black: { channels: [0, 0, 0, 1], label: "Black" },
  Red: { channels: [1, 0, 0, 1], label: "Red" },
  Green: { channels: [0, 1, 0, 1], label: "Green" },
  Blue: { channels: [0, 0, 1, 1], label: "Blue" },
  Yellow: { channels: [1, 1, 0, 1], label: "Yellow" },
  Cyan: { channels: [0, 1, 1, 1], label: "Cyan" },
  Magenta: { channels: [1, 0, 1, 1], label: "Magenta" },
  Gray: { channels: [0.5, 0.5, 0.5, 1], label: "Gray" },
  Clear: { channels: [0, 0, 0, 0], label: "Clear" }
};

const TYPE_DEFINITIONS = [
  { type: "bool", label: "Boolean", group: "Core", badge: "BOOL" },
  { type: "string", label: "Text", group: "Core", badge: "TXT" },
  { type: "button", label: "Button (Impulse)", group: "Core", badge: "BTN" },
  { type: "runtimeDisplay", label: "Display Value (RML Menu)", group: "Core", badge: "LIVE" },
  { type: "Uri", label: "URL / URI", group: "Core", badge: "URI" },
  { type: "enum", label: "Normal enum", group: "Core", badge: "ENUM" },
  { type: "int", label: "Integer", group: "Numbers", badge: "INT" },
  { type: "float", label: "Float", group: "Numbers", badge: "F32" },
  { type: "double", label: "Double", group: "Numbers", badge: "F64" },
  { type: "int2", label: "Integer 2", group: "Vectors", badge: "I2" },
  { type: "int3", label: "Integer 3", group: "Vectors", badge: "I3" },
  { type: "int4", label: "Integer 4", group: "Vectors", badge: "I4" },
  { type: "float2", label: "Float 2", group: "Vectors", badge: "F2" },
  { type: "float3", label: "Float 3", group: "Vectors", badge: "F3" },
  { type: "float4", label: "Float 4", group: "Vectors", badge: "F4" },
  { type: "double2", label: "Double 2", group: "Vectors", badge: "D2" },
  { type: "double3", label: "Double 3", group: "Vectors", badge: "D3" },
  { type: "double4", label: "Double 4", group: "Vectors", badge: "D4" },
  { type: "colorX", label: "HDR color", group: "Visual", badge: "CLR" }
];

const OUTLINE_TYPE_DESCRIPTIONS = Object.freeze({
  bool:
    "Boolean setting rendered as a checkbox in the RML menu.",
  string:
    "Editable text setting rendered as a text field.",
  button:
    "Menu button that emits one Impulse from the packed Start node.",
  runtimeDisplay:
    "RML menu row for live values connected from Runtime Graph display nodes.",
  Uri:
    "URI setting with an editable value and copy action.",
  enum:
    "Fixed-choice setting rendered with previous and next selection controls.",
  int:
    "32-bit whole-number setting with optional range validation and slider.",
  float:
    "32-bit decimal setting with optional range validation and slider.",
  double:
    "64-bit high-precision decimal setting with optional range validation and slider.",
  int2:
    "Two-component whole-number vector setting.",
  int3:
    "Three-component whole-number vector setting.",
  int4:
    "Four-component whole-number vector setting.",
  float2:
    "Two-component 32-bit decimal vector setting.",
  float3:
    "Three-component 32-bit decimal vector setting.",
  float4:
    "Four-component 32-bit decimal vector setting.",
  double2:
    "Two-component high-precision decimal vector setting.",
  double3:
    "Three-component high-precision decimal vector setting.",
  double4:
    "Four-component high-precision decimal vector setting.",
  colorX:
    "HDR-capable colorX setting with profile, strength and Full Color Picker support."
});

const OUTLINE_STRUCTURE_REFERENCE = Object.freeze([
  {
    type: "controller",
    label: "Section enum",
    badge: "§",
    description:
      "Creates selectable configuration pages whose child items are shown only for the active section."
  },
  {
    type: "layoutRow",
    label: "Inline row",
    badge: "⇄",
    description:
      "Groups direct Outline children into one horizontal or vertical runtime menu layout."
  }
]);

function outlineTypeDescription(type) {
  return OUTLINE_TYPE_DESCRIPTIONS[type] ||
    "Typed Configuration Outline setting.";
}

function outlinePaletteHelp(item) {
  return `${outlineTypeDescription(item.type)} Click to add it to the active Outline container, or drag it to an exact position.`;
}

const DEFAULT_METADATA = {
  namespaceName: "YourModNamespace",
  className: "YourMod",
  modName: "Your Mod",
  author: "Your Name",
  version: "1.0.0",
  description: "A Resonite mod generated with the RML Configuration Builder.",
  includeGuide: true
};

const EXPORT_PLATFORM_PRESETS = {
  windows:
    "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Resonite\\",
  linux:
    "$(HOME)/.local/share/Steam/steamapps/common/Resonite/",
  "linux-flatpak":
    "$(HOME)/.var/app/com.valvesoftware.Steam/.local/share/Steam/steamapps/common/Resonite/",
  macos:
    "$(HOME)/Library/Application Support/Steam/steamapps/common/Resonite/"
};

const DEFAULT_EXPORT_OPTIONS = {
  platform: "windows",
  resonitePath: EXPORT_PLATFORM_PRESETS.windows,
  includeCs: true,
  includeCsproj: true
};

const state = {
  projectId: createFreshProjectId(),
  metadata: { ...DEFAULT_METADATA },
  exportOptions: { ...DEFAULT_EXPORT_OPTIONS },
  nodes: [],
  extensions: {},
  activePage: "configuration-outline",
  selectedId: null,
  activeContainerId: ROOT_CONTAINER,
  collapsedPaletteGroups: [],
  dragOverContainer: null,
  dragInsertContainer: null,
  dragInsertIndex: null
};

const elements = {};
let projectApplicationEpoch = 1;

let dragScrollActive = false;
let dragPointerY = null;
let dragScrollFrame = null;
let dragScrollLastTimestamp = 0;
let dragScrollOriginX = 0;
let dragScrollOriginY = 0;
let settingsPreviewDraft = null;
let settingsPreviewRuntimeMenu = null;
let settingsPreviewPulseCounts = {};
let settingsPreviewColorSession = null;
let settingsPreviewStatusTimer = null;
let activeDraggedNodeId = null;
let activeDraggedOptionId = null;
let activeDraggedOptionControllerId = null;
let dragFeedbackPlaceholder = null;
let optionDragFeedbackPlaceholder = null;
let lockedOptionTargetCard = null;
let lockedOptionTargetHost = null;
let lockedOptionTargetRectangle = null;
let optionWheelTargetHost = null;
let optionWheelTargetControllerId = null;
let optionWheelLastStepTime = 0;
let optionWheelDelta = 0;
let optionWheelManualIndex = null;
let optionWheelManualHost = null;
let optionContainerWheelTargetHost = null;
let optionContainerWheelTargetContainerId = null;
let optionContainerWheelDelta = 0;
let optionContainerWheelManualIndex = null;
let optionContainerWheelManualHost = null;
let optionPointerDragActive = false;
let optionPointerId = null;
let optionPointerX = 0;
let optionPointerY = 0;
let optionPointerGhost = null;
let optionPointerSourceLane = null;
let optionPointerPendingLane = null;
let optionPointerPendingId = null;
let optionPointerPendingStartX = 0;
let optionPointerPendingStartY = 0;
let nodePointerDragActive = false;
let nodePointerId = null;
let nodePointerX = 0;
let nodePointerY = 0;
let nodePointerGhost = null;
let nodePointerSourceCard = null;
let nodePointerPendingCard = null;
let nodePointerPendingId = null;
let nodePointerPendingStartX = 0;
let nodePointerPendingStartY = 0;
let palettePointerDragActive = false;
let palettePointerId = null;
let palettePointerX = 0;
let palettePointerY = 0;
let palettePointerGhost = null;
let palettePointerSourceButton = null;
let palettePointerPayload = null;
let palettePointerPendingButton = null;
let palettePointerPendingPayload = null;
let palettePointerPendingId = null;
let palettePointerPendingStartX = 0;
let palettePointerPendingStartY = 0;
let nodeWheelTargetHost = null;
let nodeWheelTargetContainerId = null;
let nodeWheelDelta = 0;
let nodeWheelManualIndex = null;
let nodeWheelManualHost = null;
let optionPointerVisualFrame = 0;
let optionPointerQueuedX = 0;
let optionPointerQueuedY = 0;
let nodePointerVisualFrame = 0;
let nodePointerQueuedX = 0;
let nodePointerQueuedY = 0;
let palettePointerVisualFrame = 0;
let palettePointerQueuedX = 0;
let palettePointerQueuedY = 0;
let palettePointerTransactionSequence = 0;
let palettePointerLastResult = Object.freeze({
  sequence: 0,
  pointerId: null,
  committed: false,
  inserted: false,
  payloadKind: "",
  payloadValue: "",
  containerId: "",
  insertionIndex: null,
  createdNodeId: ""
});
let suppressNodeClickId = null;
let suppressNodeClickUntil = 0;
let suppressPaletteClickButton = null;
let suppressPaletteClickUntil = 0;
let rootCanvasInteractionController = null;

let typedNodeGraphModulesState = "pending";
let typedNodeGraphModulesError = null;
let typedNodeGraphModulesTrackingStarted = false;

let generatedOutlineArtifactKey = "";
let generatedGraphArtifactKey = "";
let exportCopyArtifactKey = "";
function currentTypedRuntimeGraphIsLarge() {
  const graph =
    state?.extensions?.typedNodeGraph;

  return Boolean(
    graph?.active &&
    (
      (Array.isArray(graph.nodes)
        ? graph.nodes.length
        : 0) > 1000 ||
      (Array.isArray(graph.connections)
        ? graph.connections.length
        : 0) > 2000
    )
  );
}

function requestGeneratedOutputUpdate() {
  if (
    currentTypedRuntimeGraphIsLarge() &&
    elements.generatedCode
  ) {
    elements.generatedCode.textContent =
      "// Generating the large runtime graph…\n";
  }
  if (
    currentTypedRuntimeGraphIsLarge() &&
    elements.codeSummary
  ) {
    elements.codeSummary.textContent =
      "Large runtime graph loaded · generated files are being refreshed";
  }

  
  
  
  updateGeneratedOutput();
}

function scheduleTypedNodeGraphOutputRefresh() {
  requestAnimationFrame(() => {
    if (elements.generatedCode) {
      updateGeneratedOutput();
    }
  });
}

function beginTypedNodeGraphModulesTracking() {
  if (typedNodeGraphModulesTrackingStarted) {
    return;
  }

  typedNodeGraphModulesTrackingStarted = true;

  const baseReady =
    window.RMLBaseModNodesReady ||
    window.RMLModNodesReady;

  if (
    !baseReady ||
    typeof baseReady.then !== "function"
  ) {
    typedNodeGraphModulesState =
      window.RMLTypedNodeGraphGenerator &&
      typeof window.RMLTypedNodeGraphGenerator.build === "function"
        ? "ready"
        : "failed";

    if (typedNodeGraphModulesState === "failed") {
      typedNodeGraphModulesError =
        new Error(
          "The typed node graph loader did not expose RMLModNodesReady."
        );
    }

    scheduleTypedNodeGraphOutputRefresh();
    return;
  }

  const ready = Promise.resolve(
    baseReady
  ).then(() => {
    const requiresCatalogFactory =
      projectRequiredCatalogNodes({
        extensions: state.extensions
      }).length > 0;
    return requiresCatalogFactory
      ? window.RMLModNodesReady
      : true;
  });

  Promise.resolve(ready)
    .then(() => {
      typedNodeGraphModulesState = "ready";
      typedNodeGraphModulesError = null;
      scheduleTypedNodeGraphOutputRefresh();
    })
    .catch(error => {
      typedNodeGraphModulesState = "failed";
      typedNodeGraphModulesError =
        error instanceof Error
          ? error
          : new Error(String(error));
      scheduleTypedNodeGraphOutputRefresh();
    });
}

function scheduleOptionPointerTargetUpdate(
  clientX,
  clientY
) {
  optionPointerQueuedX = clientX;
  optionPointerQueuedY = clientY;

  if (optionPointerVisualFrame) {
    return;
  }

  optionPointerVisualFrame =
    requestAnimationFrame(() => {
      optionPointerVisualFrame = 0;

      updateOptionPointerTarget(
        optionPointerQueuedX,
        optionPointerQueuedY
      );
    });
}

function scheduleNodePointerTargetUpdate(
  clientX,
  clientY
) {
  nodePointerQueuedX = clientX;
  nodePointerQueuedY = clientY;

  if (nodePointerVisualFrame) {
    return;
  }

  nodePointerVisualFrame =
    requestAnimationFrame(() => {
      nodePointerVisualFrame = 0;

      updateNodePointerTarget(
        nodePointerQueuedX,
        nodePointerQueuedY
      );
    });
}

function schedulePalettePointerTargetUpdate(
  clientX,
  clientY
) {
  palettePointerQueuedX = clientX;
  palettePointerQueuedY = clientY;

  if (palettePointerVisualFrame) {
    return;
  }

  palettePointerVisualFrame =
    requestAnimationFrame(() => {
      palettePointerVisualFrame = 0;

      updatePalettePointerTarget(
        palettePointerQueuedX,
        palettePointerQueuedY
      );
    });
}

const MOBILE_DIALOG_MAX_WIDTH = 780;
let adaptiveDialogFrame = 0;

const COLOR_PICKER_ADAPTIVE_QUERY =
  window.matchMedia(
    "(max-width: 980px), (max-height: 720px)"
  );

const APP_SCRIPT_BASE_URL =
  document.currentScript?.src ||
  window.location.href;

let projectIoWorker = null;
let projectIoRequestSequence = 1;
const projectIoPendingRequests = new Map();

function projectIoWorkerInstance() {
  if (projectIoWorker) {
    return projectIoWorker;
  }

  if (typeof Worker !== "function") {
    return null;
  }

  try {
    const worker = new Worker(
      new URL(
        "project_io_worker.js?v=9-complete-visual-csharp-v600f1",
        APP_SCRIPT_BASE_URL
      ),
      {
        name: "rml-project-io"
      }
    );

    worker.addEventListener(
      "message",
      event => {
        const response = event.data || {};
        const pending =
          projectIoPendingRequests.get(
            response.id
          );

        if (!pending) {
          return;
        }

        projectIoPendingRequests.delete(
          response.id
        );

        if (response.ok === true) {
          pending.resolve(response);
        } else {
          const error = new Error(
            response.error?.message ||
            "Project I/O worker failed."
          );
          error.name =
            response.error?.name ||
            "Error";
          pending.reject(error);
        }
      }
    );

    worker.addEventListener(
      "error",
      event => {
        const error = new Error(
          event.message ||
          "Project I/O worker failed."
        );

        for (const pending of
          projectIoPendingRequests.values()) {
          pending.reject(error);
        }

        projectIoPendingRequests.clear();
        worker.terminate();
        projectIoWorker = null;
      }
    );

    projectIoWorker = worker;
    return projectIoWorker;
  } catch (error) {
    console.warn(
      "Project I/O worker is unavailable; using the compatible main-thread fallback.",
      error
    );
    return null;
  }
}

function projectIoRequest(
  operation,
  payload
) {
  const worker =
    projectIoWorkerInstance();

  if (!worker) {
    return new Promise(
      (resolve, reject) => {
        queueMicrotask(() => {
          try {
            if (operation === "parse") {
              const text =
                String(payload.text ?? "");
              const value = JSON.parse(text);
              resolve({
                ok: true,
                value,
                fingerprint:
                  projectIdentityFingerprint(
                    projectIdFromSource(value)
                  )
              });
              return;
            }

            if (operation === "parseFile") {
              if (
                !payload.file ||
                typeof payload.file.text !== "function"
              ) {
                throw new TypeError(
                  "The project file is not a readable Blob."
                );
              }

              void payload.file.text()
                .then(text => {
                  try {
                    const value =
                      JSON.parse(text);
                    resolve({
                      ok: true,
                      value,
                      fingerprint:
                        projectIdentityFingerprint(
                          projectIdFromSource(value)
                        )
                    });
                  } catch (error) {
                    reject(error);
                  }
                }, reject);
              return;
            }

            if (operation === "stringify") {
              resolve({
                ok: true,
                text: JSON.stringify(
                  payload.value,
                  null,
                  Number(payload.space) || 0
                )
              });
              return;
            }

            throw new Error(
              `Unsupported project I/O operation '${operation}'.`
            );
          } catch (error) {
            reject(error);
          }
        });
      }
    );
  }

  const id =
    projectIoRequestSequence++;

  return new Promise(
    (resolve, reject) => {
      projectIoPendingRequests.set(
        id,
        { resolve, reject }
      );
      worker.postMessage({
        id,
        operation,
        ...payload
      });
    }
  );
}

function formatProjectByteLimit(value) {
  const mebibytes =
    Number(value) /
    (1024 * 1024);

  return `${mebibytes.toLocaleString("de-DE", {
    maximumFractionDigits: 0
  })} MiB`;
}

const LARGE_GRAPH_BACKGROUND_CODEGEN_NODE_THRESHOLD =
  1000;
const LARGE_GRAPH_BACKGROUND_CODEGEN_CONNECTION_THRESHOLD =
  2000;
let graphCodegenWorker = null;
let graphCodegenWorkerCatalogKey = "";
let graphCodegenWorkerNeedsCatalog = false;
let graphCodegenWorkerSequence = 1;
let graphCodegenWorkerRunning = false;
let graphCodegenWorkerQueuedBuild = null;
let graphCodegenWorkerActiveBuild = null;
let graphCodegenWorkerCachedKey = "";
let graphCodegenWorkerCachedResult = null;
let graphCodegenWorkerLastError = null;
let graphCodegenProjectEpoch = 1;
let graphCodegenFingerprintSource = null;
let graphCodegenFingerprintRevision = -1;
let graphCodegenFingerprintNodeCount = -1;
let graphCodegenFingerprintConnectionCount = -1;
let graphCodegenFingerprintValue = "";

function largeGraphUsesBackgroundCodegen(
  extensionState
) {
  const views =
    projectRuntimeGraphViews(
      extensionState
    );
  const nodeCount = views.reduce(
    (total, view) =>
      total +
      (Array.isArray(view.graph.nodes)
        ? view.graph.nodes.length
        : 0),
    0
  );
  const connectionCount = views.reduce(
    (total, view) =>
      total +
      (Array.isArray(
        view.graph.connections
      )
        ? view.graph.connections.length
        : 0),
    0
  );
  return Boolean(
    extensionState &&
    (
      nodeCount >
        LARGE_GRAPH_BACKGROUND_CODEGEN_NODE_THRESHOLD ||
      connectionCount >
        LARGE_GRAPH_BACKGROUND_CODEGEN_CONNECTION_THRESHOLD
    )
  );
}

function graphCodegenCatalogKey(catalog) {
  return [
    catalog?.catalogFingerprint ||
      catalog?.assemblyFingerprint ||
      catalog?.engineVersion ||
      "unknown",
    catalog?.catalogSource || "unknown"
  ].join("|");
}

function largeGraphCodegenContentFingerprint(
  extensionState
) {
  const revision =
    Number(extensionState?.revision) || 0;
  const views =
    projectRuntimeGraphViews(
      extensionState
    );
  const nodes = views.flatMap(view =>
    Array.isArray(view.graph.nodes)
      ? view.graph.nodes
      : []
  );
  const connections = views.flatMap(view =>
    Array.isArray(view.graph.connections)
      ? view.graph.connections
      : []
  );

  if (
    graphCodegenFingerprintSource ===
      extensionState &&
    graphCodegenFingerprintRevision ===
      revision &&
    graphCodegenFingerprintNodeCount ===
      nodes.length &&
    graphCodegenFingerprintConnectionCount ===
      connections.length
  ) {
    return graphCodegenFingerprintValue;
  }

  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let position = 0;

  const append = value => {
    const text = String(value ?? "");

    for (
      let index = 0;
      index < text.length;
      index += 1
    ) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(
        first,
        0x01000193
      ) >>> 0;
      second ^= code + position;
      second = Math.imul(
        second,
        0x85ebca6b
      ) >>> 0;
      position += 1;
    }

    first ^= 0xff;
    first = Math.imul(
      first,
      0x01000193
    ) >>> 0;
    second ^= position + 0x9e37;
    second = Math.imul(
      second,
      0x85ebca6b
    ) >>> 0;
  };

  append(extensionState?.sourceSignature);
  append(
    JSON.stringify(
      extensionState?.configSnapshot ||
        null
    )
  );

  for (const node of nodes) {
    append(node?.id);
    append(node?.kind);
    append(node?.operatorId);
    append(node?.label);
    append(
      JSON.stringify(
        node?.apiContract || null
      )
    );
    append(
      JSON.stringify(
        node?.parameters || {}
      )
    );
  }

  for (const view of views) {
    append(view.path);
    const composite = view.graph;
    append(
      JSON.stringify(
        composite?.boundaryPorts || []
      )
    );
    append(
      JSON.stringify(
        composite?.branchRouting || {}
      )
    );
  }

  for (const connection of connections) {
    append(connection?.id);
    append(connection?.fromNode);
    append(connection?.fromPort);
    append(connection?.toNode);
    append(connection?.toPort);
  }

  graphCodegenFingerprintSource =
    extensionState;
  graphCodegenFingerprintRevision =
    revision;
  graphCodegenFingerprintNodeCount =
    nodes.length;
  graphCodegenFingerprintConnectionCount =
    connections.length;
  graphCodegenFingerprintValue =
    first.toString(16).padStart(8, "0") +
    second.toString(16).padStart(8, "0");

  return graphCodegenFingerprintValue;
}

function largeGraphCodegenKey(
  extensionState
) {
  const metadata = state.metadata || {};
  const catalog =
    window.RMLResoniteApiCatalog ||
    window.RMLFrooxComponentCatalog ||
    null;

  const views =
    projectRuntimeGraphViews(
      extensionState
    );
  const totalNodes = views.reduce(
    (total, view) =>
      total +
      (view.graph.nodes?.length || 0),
    0
  );
  const totalConnections = views.reduce(
    (total, view) =>
      total +
      (view.graph.connections?.length ||
        0),
    0
  );

  return JSON.stringify({
    revision:
      Number(extensionState?.revision) || 0,
    nodes:
      totalNodes,
    connections:
      totalConnections,
    content:
      largeGraphCodegenContentFingerprint(
        extensionState
      ),
    namespaceName:
      metadata.namespaceName || "",
    className:
      metadata.className || "",
    version:
      metadata.version || "",
    catalog:
      graphCodegenCatalogKey(catalog),
    definitions:
      Number(
        window.__RMLNodeDefinitionRevision
      ) || 0,
    apiFactory:
      Number(
        window.__RMLApiNodeFactoryVersion
      ) || 0
  });
}

function terminateGraphCodegenWorker() {
  graphCodegenWorker?.terminate?.();
  graphCodegenWorker = null;
  graphCodegenWorkerCatalogKey = "";
  graphCodegenWorkerNeedsCatalog = false;
}

function announceGraphCodegenSettlement(
  detail = {}
) {
  const {
    projectEpoch =
      projectApplicationEpoch,
    codegenProjectEpoch =
      graphCodegenProjectEpoch,
    ...settlement
  } = detail;
  document.dispatchEvent(
    new CustomEvent(
      "rml-builder:graph-codegen-settled",
      {
        detail: {
          projectEpoch:
            Number(projectEpoch) || 0,
          codegenProjectEpoch:
            Number(codegenProjectEpoch) || 0,
          ...settlement
        }
      }
    )
  );
}

function resetGraphCodegenForProjectReplacement() {
  graphCodegenProjectEpoch += 1;
  terminateGraphCodegenWorker();
  graphCodegenWorkerRunning = false;
  graphCodegenWorkerQueuedBuild = null;
  graphCodegenWorkerActiveBuild = null;
  graphCodegenWorkerCachedKey = "";
  graphCodegenWorkerCachedResult = null;
  graphCodegenWorkerLastError = null;
  graphCodegenFingerprintSource = null;
  graphCodegenFingerprintRevision = -1;
  graphCodegenFingerprintNodeCount = -1;
  graphCodegenFingerprintConnectionCount = -1;
  graphCodegenFingerprintValue = "";
}

function ensureGraphCodegenWorker(catalog) {
  const catalogKey =
    graphCodegenCatalogKey(catalog);

  if (
    graphCodegenWorker &&
    graphCodegenWorkerCatalogKey ===
      catalogKey
  ) {
    return graphCodegenWorker;
  }

  terminateGraphCodegenWorker();

  if (typeof Worker !== "function") {
    throw new Error(
      "Background graph code generation requires Web Worker support."
    );
  }

  const worker = new Worker(
    new URL(
      "graph_codegen_worker.js?v=60-catalog-reconciled-saved-composites-v647",
      APP_SCRIPT_BASE_URL
    ),
    {
      name: "rml-graph-codegen"
    }
  );
  const workerProjectEpoch =
    graphCodegenProjectEpoch;
  const workerApplicationEpoch =
    projectApplicationEpoch;

  worker.addEventListener(
    "message",
    event => {
      const response = event.data || {};
      const active =
        graphCodegenWorkerActiveBuild;

      if (
        !active ||
        response.id !== active.id ||
        active.projectEpoch !==
          graphCodegenProjectEpoch
      ) {
        return;
      }

      if (response.progress === true) {
        return;
      }

      graphCodegenWorkerActiveBuild = null;

      if (response.ok === true) {
        graphCodegenWorkerCachedKey =
          active.key;
        graphCodegenWorkerCachedResult =
          response.result;
        graphCodegenWorkerLastError = null;
      } else {
        graphCodegenWorkerLastError =
          new Error(
            response.error?.message ||
            "Background graph code generation failed."
          );
      }

      graphCodegenWorkerRunning = false;

      announceGraphCodegenSettlement({
        projectEpoch:
          active.applicationProjectEpoch,
        codegenProjectEpoch:
          active.projectEpoch,
        key: active.key,
        ok: response.ok === true
      });

      queueMicrotask(() => {
        try {
          updateGeneratedOutput();
        } catch (error) {
          console.error(
            "Generated output refresh after background graph code generation failed.",
            error
          );
        }
      });

      void pumpGraphCodegenWorkerQueue();
    }
  );

  worker.addEventListener(
    "error",
    event => {
      if (
        worker !==
          graphCodegenWorker ||
        workerProjectEpoch !==
          graphCodegenProjectEpoch ||
        workerApplicationEpoch !==
          projectApplicationEpoch
      ) {
        return;
      }
      graphCodegenWorkerLastError =
        new Error(
          event.message ||
          "Background graph code generation worker failed."
        );
      graphCodegenWorkerActiveBuild = null;
      graphCodegenWorkerRunning = false;
      terminateGraphCodegenWorker();
      announceGraphCodegenSettlement({
        projectEpoch:
          workerApplicationEpoch,
        codegenProjectEpoch:
          workerProjectEpoch,
        ok: false,
        error:
          graphCodegenWorkerLastError.message
      });
      void pumpGraphCodegenWorkerQueue();
    }
  );

  graphCodegenWorker = worker;
  graphCodegenWorkerCatalogKey =
    catalogKey;
  graphCodegenWorkerNeedsCatalog = true;
  return worker;
}

async function pumpGraphCodegenWorkerQueue() {
  if (
    graphCodegenWorkerRunning ||
    !graphCodegenWorkerQueuedBuild
  ) {
    return;
  }

  const build =
    graphCodegenWorkerQueuedBuild;
  graphCodegenWorkerQueuedBuild = null;
  graphCodegenWorkerRunning = true;
  graphCodegenWorkerActiveBuild =
    build;

  try {
    const worker =
      ensureGraphCodegenWorker(
        build.catalog
      );

    const catalog =
      graphCodegenWorkerNeedsCatalog
        ? build.catalog
        : null;
    graphCodegenWorkerNeedsCatalog = false;

    worker.postMessage({
      id: build.id,
      operation: "build",
      catalog,
      state: build.state,
      entries: build.entries
    });
  } catch (error) {
    graphCodegenWorkerLastError =
      error instanceof Error
        ? error
        : new Error(String(error));
    graphCodegenWorkerActiveBuild = null;
    graphCodegenWorkerRunning = false;
    announceGraphCodegenSettlement({
      projectEpoch:
        build.applicationProjectEpoch,
      codegenProjectEpoch:
        build.projectEpoch,
      key: build.key,
      ok: false,
      error:
        graphCodegenWorkerLastError.message
    });
  }
}

function requestLargeGraphCodegen(
  extensionState,
  key
) {
  if (
    graphCodegenWorkerActiveBuild?.key ===
      key ||
    graphCodegenWorkerQueuedBuild?.key ===
      key
  ) {
    return;
  }

  const catalog =
    window.RMLResoniteApiCatalog ||
    window.RMLFrooxComponentCatalog ||
    null;

  graphCodegenWorkerQueuedBuild = {
    id: graphCodegenWorkerSequence++,
    key,
    projectEpoch:
      graphCodegenProjectEpoch,
    applicationProjectEpoch:
      projectApplicationEpoch,
    catalog,
    state:
      builderCodegenStateSnapshot(),
    entries:
      currentFlattenedNodes()
  };
  graphCodegenWorkerLastError = null;
  void pumpGraphCodegenWorkerQueue();
}

function pendingLargeGraphContribution() {
  const rawErrorMessage = String(
    graphCodegenWorkerLastError?.message ||
    ""
  )
    .trim()
    .replace(/[.!?]+$/, "");
  const baseErrorMessage =
    "Background graph code generation failed";
  const message = graphCodegenWorkerLastError
    ? rawErrorMessage &&
      rawErrorMessage !== baseErrorMessage
      ? `${baseErrorMessage}: ${rawErrorMessage}.`
      : `${baseErrorMessage}.`
    : "Large graph code generation is running in a background worker. Export becomes available automatically when it finishes.";

  return {
    active: true,
    pending: !graphCodegenWorkerLastError,
    diagnostics: [message],
    warnings: [],
    files: [],
    projects: [],
    applyStatements: {},
    syncStatements: {},
    reactionStatements: {},
    initializeStatement: "",
    onEngineInitializedStatement: "",
    onConfigurationSynchronizedStatement: "",
    requirements: {
      usesElements: false,
      usesRenderiteShared: false
    }
  };
}

let colorPickerAdaptiveFitLoadPromise = null;
let informationTemplateLoadPromise = null;
let informationBuiltInRegistryReady = false;
let informationBuiltInRegistryWaitPromise = null;
let setupAssistantLoadPromise = null;
const SETUP_ASSISTANT_STORAGE_KEY = "rml-builder-setup-tour-v1-complete";
const ACTIVE_SETUP_ASSISTANT_STORAGE_KEY = RML_VISUAL_TOUR_TEST
  ? `${ACTIVE_STORAGE_KEY}-tour-complete`
  : SETUP_ASSISTANT_STORAGE_KEY;

function ensureColorPickerAdaptiveFitLoaded() {
  if (
    !COLOR_PICKER_ADAPTIVE_QUERY.matches ||
    window.fitSettingsPreviewColorPicker
  ) {
    return Promise.resolve(false);
  }

  if (colorPickerAdaptiveFitLoadPromise) {
    return colorPickerAdaptiveFitLoadPromise;
  }

  colorPickerAdaptiveFitLoadPromise =
    new Promise((resolve, reject) => {
      const existingScript =
        document.querySelector(
          'script[data-rml-colorpicker-adaptive-fit]'
        );

      if (existingScript) {
        existingScript.addEventListener(
          "load",
          () => resolve(true),
          { once: true }
        );
        existingScript.addEventListener(
          "error",
          () => reject(
            new Error(
              "colorpicker_adaptive_fit.js could not be loaded."
            )
          ),
          { once: true }
        );
        return;
      }

      const script =
        document.createElement("script");

      script.src =
        new URL(
          "colorpicker_adaptive_fit.js",
          APP_SCRIPT_BASE_URL
        ).href;

      script.async = true;
      script.dataset
        .rmlColorpickerAdaptiveFit =
        "true";

      script.addEventListener(
        "load",
        () => {
          window
            .fitSettingsPreviewColorPicker
            ?.();

          resolve(true);
        },
        { once: true }
      );

      script.addEventListener(
        "error",
        () => {
          colorPickerAdaptiveFitLoadPromise =
            null;

          reject(
            new Error(
              "colorpicker_adaptive_fit.js could not be loaded."
            )
          );
        },
        { once: true }
      );

      document.head.appendChild(
        script
      );
    });

  colorPickerAdaptiveFitLoadPromise.catch(
    error => {
      console.warn(
        "Adaptive color picker fit was not loaded.",
        error
      );
    }
  );

  return colorPickerAdaptiveFitLoadPromise;
}

function handleColorPickerAdaptiveViewportChange() {
  if (
    COLOR_PICKER_ADAPTIVE_QUERY.matches
  ) {
    ensureColorPickerAdaptiveFitLoaded();
  }
}

if (
  typeof COLOR_PICKER_ADAPTIVE_QUERY
    .addEventListener === "function"
) {
  COLOR_PICKER_ADAPTIVE_QUERY.addEventListener(
    "change",
    handleColorPickerAdaptiveViewportChange
  );
} else {
  COLOR_PICKER_ADAPTIVE_QUERY.addListener(
    handleColorPickerAdaptiveViewportChange
  );
}

function visibleViewportSize() {
  const viewport =
    window.visualViewport;

  return {
    width:
      Math.max(
        1,
        viewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth
      ),
    height:
      Math.max(
        1,
        viewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight
      )
  };
}

function isMobileDialogViewport() {
  return (
    visibleViewportSize().width <=
    MOBILE_DIALOG_MAX_WIDTH
  );
}

function utilityDialogContentSize(
  dialog
) {
  if (!dialog) {
    return {
      width: 0,
      height: 0
    };
  }

  const header =
    dialog.querySelector(
      ".export-dialog-header"
    );
  const body =
    dialog.querySelector(
      ".export-dialog-body, .project-dialog-body"
    );
  const actions =
    dialog.querySelector(
      ".export-dialog-actions"
    );

  const height =
    (header?.scrollHeight || 0) +
    (body?.scrollHeight || 0) +
    (actions?.scrollHeight || 0) +
    2;

  const width =
    Math.max(
      header?.scrollWidth || 0,
      body?.scrollWidth || 0,
      actions?.scrollWidth || 0
    );

  return {
    width,
    height
  };
}

function updateAdaptiveUtilityDialog(
  dialog
) {
  if (!dialog) {
    return;
  }

  const viewport =
    visibleViewportSize();
  const content =
    utilityDialogContentSize(
      dialog
    );
  const fullHeightNeeded =
    Boolean(
      dialog.open &&
      isMobileDialogViewport() &&
      content.height >=
        Math.max(
          1,
          viewport.height - 16
        )
    );

  dialog.classList.toggle(
    "mobile-full-modal",
    fullHeightNeeded
  );
}

function scheduleAdaptiveUtilityDialogs() {
  cancelAnimationFrame(
    adaptiveDialogFrame
  );

  adaptiveDialogFrame =
    requestAnimationFrame(() => {
      updateAdaptiveUtilityDialog(
        elements.projectDialog
      );
      updateAdaptiveUtilityDialog(
        elements.exportDialog
      );
    });
}

function focusDialogShell(
  dialog
) {
  if (
    !dialog ||
    !dialog.open
  ) {
    return;
  }

  const active =
    document.activeElement;

  if (
    active instanceof HTMLElement &&
    dialog.contains(active)
  ) {
    active.blur();
  }

  try {
    dialog.focus({
      preventScroll: true
    });
  } catch {
    dialog.focus();
  }
}

function stabilizeDialogFocus(
  dialog
) {
  focusDialogShell(dialog);

  requestAnimationFrame(() => {
    focusDialogShell(dialog);

    requestAnimationFrame(() => {
      focusDialogShell(dialog);
    });
  });
}

function movePreviewFocusAwayFromCloseButton() {
  if (
    !isMobileDialogViewport()
  ) {
    return;
  }

  stabilizeDialogFocus(
    elements.settingsPreviewDialog
  );
}

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function toPascalCase(value, fallback = "Setting") {
  const words = String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  const result = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");
  const safe = result || fallback;
  return /^[0-9]/.test(safe) ? `Value${safe}` : safe;
}

function toSnakeCase(value, fallback = "setting") {
  const result = String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return result || fallback;
}

function toCamelCase(value) {
  const pascal = toPascalCase(value, "value");
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function escapeCSharp(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0")
    .replace(/"/g, '\\"');
}

function csharpSingleLineCommentText(value) {
  return String(value || "")
    .replace(/[\r\n\u0085\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function generatedBaseName() {
  return toPascalCase(
    state.metadata.className,
    "YourMod"
  );
}

function projectFileBaseName() {
  let name =
    String(
      state.metadata.modName ||
        ""
    )
      .trim()
      .replace(
        /[<>:"/\\|?*\u0000-\u001F]/g,
        "_"
      )
      .slice(0, 120)
      .replace(/[. ]+$/g, "");

  if (
    /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(
      name
    )
  ) {
    name += "_";
  }

  return name ||
    generatedBaseName();
}

function normalizedResonitePath(value) {
  const compact = String(value || "")
    .replace(/\r\n|\r|\n/g, "")
    .trim();
  const path =
    compact ||
    DEFAULT_EXPORT_OPTIONS.resonitePath;

  if (/[\\/]$/.test(path)) {
    return path;
  }

  return path.includes("\\")
    ? `${path}\\`
    : `${path}/`;
}

function inferExportPlatform(path) {
  const normalized =
    normalizedResonitePath(path);

  for (
    const [
      platform,
      presetPath
    ] of Object.entries(
      EXPORT_PLATFORM_PRESETS
    )
  ) {
    if (
      normalized ===
      normalizedResonitePath(
        presetPath
      )
    ) {
      return platform;
    }
  }

  return "custom";
}

function clamp(value, minimum, maximum) {
  return Math.min(
    maximum,
    Math.max(
      minimum,
      value
    )
  );
}


function normalizeColorProfile(profile) {
  return String(profile || "").toLowerCase() === "srgb"
    ? "srgb"
    : "linear";
}

function srgbChannelToLinear(value) {
  const channel = Math.max(0, Number(value) || 0);

  return channel <= 0.04045
    ? channel / 12.92
    : Math.pow(
        (channel + 0.055) / 1.055,
        2.4
      );
}

function linearChannelToSrgb(value) {
  const channel = Math.max(0, Number(value) || 0);

  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 *
        Math.pow(channel, 1 / 2.4) -
        0.055;
}

function convertColorProfileChannels(
  red,
  green,
  blue,
  sourceProfile,
  targetProfile
) {
  const source =
    normalizeColorProfile(sourceProfile);
  const target =
    normalizeColorProfile(targetProfile);

  if (source === target) {
    return {
      red,
      green,
      blue
    };
  }

  const converter =
    source === "srgb"
      ? srgbChannelToLinear
      : linearChannelToSrgb;

  return {
    red: converter(red),
    green: converter(green),
    blue: converter(blue)
  };
}

function colorProfileExpression(profile) {
  return normalizeColorProfile(profile) === "srgb"
    ? "ColorProfile.sRGB"
    : "ColorProfile.Linear";
}

function buildColorXExpression(
  red,
  green,
  blue,
  alpha,
  strength = 1,
  profile = "linear"
) {
  const safeStrength =
    clamp(Number(strength) || 1, 1, 10);

  return (
    "new colorX(" +
    "new color(" +
    `${previewColorLiteral(red * safeStrength)}, ` +
    `${previewColorLiteral(green * safeStrength)}, ` +
    `${previewColorLiteral(blue * safeStrength)}, ` +
    `${previewColorLiteral(alpha)}` +
    "), " +
    `${colorProfileExpression(profile)}` +
    ")"
  );
}

function colorVisualCss(
  red,
  green,
  blue,
  alpha,
  profile = "linear"
) {
  const display =
    normalizeColorProfile(profile) === "linear"
      ? convertColorProfileChannels(
          red,
          green,
          blue,
          "linear",
          "srgb"
        )
      : { red, green, blue };

  return (
    `rgba(${Math.round(clamp(display.red, 0, 1) * 255)}, ` +
    `${Math.round(clamp(display.green, 0, 1) * 255)}, ` +
    `${Math.round(clamp(display.blue, 0, 1) * 255)}, ` +
    `${clamp(alpha, 0, 1)})`
  );
}

function numericInputValue(value) {
  return String(value)
    .trim()
    .replace(/[fFdD]$/, "");
}

function vectorComponentValues(
  value,
  count
) {
  const parts =
    String(value)
      .split(",")
      .map(part =>
        numericInputValue(part)
      );

  while (parts.length < count) {
    parts.push("0");
  }

  return parts
    .slice(0, count)
    .map(part =>
      part || "0"
    );
}

function colorByteToHex(value) {
  return clamp(
    Math.round(value),
    0,
    255
  )
    .toString(16)
    .padStart(2, "0");
}

function colorChannelsToPreview(
  channels,
  label,
  profile = "linear",
  explicitStrength = null
) {
  const [rawRed, rawGreen, rawBlue, rawAlpha] =
    channels;
  const strength =
    clamp(
      Number.isFinite(Number(explicitStrength))
        ? Number(explicitStrength)
        : Math.max(
            1,
            Math.abs(rawRed),
            Math.abs(rawGreen),
            Math.abs(rawBlue)
          ),
      1,
      10
    );
  const red =
    clamp(rawRed / strength, 0, 1);
  const green =
    clamp(rawGreen / strength, 0, 1);
  const blue =
    clamp(rawBlue / strength, 0, 1);
  const alpha =
    clamp(rawAlpha, 0, 1);
  const normalizedProfile =
    normalizeColorProfile(profile);
  const display =
    normalizedProfile === "linear"
      ? convertColorProfileChannels(
          red,
          green,
          blue,
          "linear",
          "srgb"
        )
      : { red, green, blue };
  const hex =
    colorBytesToHex(
      display.red * 255,
      display.green * 255,
      display.blue * 255
    );
  const luminance =
    0.2126 * display.red +
    0.7152 * display.green +
    0.0722 * display.blue;

  return {
    channels: [
      rawRed,
      rawGreen,
      rawBlue,
      rawAlpha
    ],
    baseChannels: [
      red,
      green,
      blue,
      alpha
    ],
    profile:
      normalizedProfile,
    strength,
    hex,
    cssColor:
      colorVisualCss(
        red,
        green,
        blue,
        alpha,
        normalizedProfile
      ),
    textColor:
      luminance > 0.62 &&
      alpha > 0.55
        ? "#17131d"
        : "#ffffff",
    label,
    custom: false
  };
}

function colorXPreview(
  expression,
  storedStrength = null,
  storedProfile = null
) {
  const value =
    String(expression)
      .trim();

  const named =
    value.match(
      /^colorX\.([A-Za-z_][A-Za-z0-9_]*)$/
    );

  if (
    named &&
    COLORX_NAMED_PREVIEWS[named[1]]
  ) {
    const preview =
      COLORX_NAMED_PREVIEWS[named[1]];

    return colorChannelsToPreview(
      preview.channels,
      preview.label,
      storedProfile || "linear",
      storedStrength
    );
  }

  const parsedHex =
    parseHexColor(value);

  if (parsedHex) {
    return colorChannelsToPreview(
      [
        parsedHex.red / 255,
        parsedHex.green / 255,
        parsedHex.blue / 255,
        parsedHex.alpha === null
          ? 1
          : parsedHex.alpha / 255
      ],
      "Custom hex color",
      storedProfile || "srgb",
      storedStrength
    );
  }

  const number =
    "([+-]?(?:(?:\\d+(?:\\.\\d*)?)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?)[fFdD]?";
  const explicit =
    value.match(
      new RegExp(
        `^new\\s+colorX\\s*\\(\\s*new\\s+color\\s*\\(\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}(?:\\s*,\\s*${number})?\\s*\\)\\s*,\\s*ColorProfile\\.(sRGB|Linear)\\s*\\)$`
      )
    );

  if (explicit) {
    const channels = [
      Number(explicit[1]),
      Number(explicit[2]),
      Number(explicit[3]),
      explicit[4] === undefined
        ? 1
        : Number(explicit[4])
    ];
    const profile =
      explicit[5] === "sRGB"
        ? "srgb"
        : "linear";

    if (
      channels.every(
        Number.isFinite
      )
    ) {
      return colorChannelsToPreview(
        channels,
        "Custom colorX",
        storedProfile || profile,
        storedStrength
      );
    }
  }

  const constructor =
    value.match(
      new RegExp(
        `^(?:new\\s+colorX|\\(\\s*colorX\\s*\\)\\s*new\\s+color)\\s*\\(\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}(?:\\s*,\\s*${number})?\\s*\\)$`
      )
    );

  if (constructor) {
    const channels = [
      Number(constructor[1]),
      Number(constructor[2]),
      Number(constructor[3]),
      constructor[4] === undefined
        ? 1
        : Number(constructor[4])
    ];

    if (
      channels.every(
        Number.isFinite
      )
    ) {
      return colorChannelsToPreview(
        channels,
        "Custom colorX",
        storedProfile || "linear",
        storedStrength
      );
    }
  }

  return {
    channels: null,
    baseChannels: [0.5, 0.5, 0.5, 1],
    profile:
      normalizeColorProfile(
        storedProfile || "linear"
      ),
    strength:
      clamp(
        Number(storedStrength) || 1,
        1,
        10
      ),
    hex: "#7F7F7F",
    cssColor:
      "rgba(127, 127, 127, 1)",
    textColor:
      "#ffffff",
    label:
      "Custom C# expression",
    custom: true
  };
}

function portableColorXExpression(
  expression
) {
  const value =
    String(expression)
      .trim();
  const number =
    "([+-]?(?:(?:\\d+(?:\\.\\d*)?)|(?:\\.\\d+))(?:[eE][+-]?\\d+)?)[fFdD]?";
  const constructor =
    value.match(
      new RegExp(
        `^new\\s+colorX\\s*\\(\\s*${number}\\s*,\\s*${number}\\s*,\\s*${number}(?:\\s*,\\s*${number})?\\s*\\)$`
      )
    );

  if (!constructor) {
    return value ||
      "colorX.White";
  }

  const floatLiteral =
    channel =>
      `${String(channel)
        .replace(/[fFdD]$/, "")}f`;

  return (
    "(colorX)new color(" +
    `${floatLiteral(constructor[1])}, ` +
    `${floatLiteral(constructor[2])}, ` +
    `${floatLiteral(constructor[3])}, ` +
    `${floatLiteral(
      constructor[4] === undefined
        ? "1"
        : constructor[4]
    )})`
  );
}

function colorBytesToHex(
  red,
  green,
  blue
) {
  return (
    `#${colorByteToHex(red)}` +
    `${colorByteToHex(green)}` +
    `${colorByteToHex(blue)}`
  );
}

function parseHexColor(
  value
) {
  let normalized =
    String(value)
      .trim()
      .replace(/^#/, "");

  if (
    normalized.length === 3 ||
    normalized.length === 4
  ) {
    normalized =
      normalized
        .split("")
        .map(character =>
          character + character
        )
        .join("");
  }

  if (
    !/^[0-9a-fA-F]+$/.test(
      normalized
    ) ||
    ![6, 8].includes(
      normalized.length
    )
  ) {
    return null;
  }

  return {
    red: Number.parseInt(
      normalized.slice(0, 2),
      16
    ),
    green: Number.parseInt(
      normalized.slice(2, 4),
      16
    ),
    blue: Number.parseInt(
      normalized.slice(4, 6),
      16
    ),
    alpha:
      normalized.length === 8
        ? Number.parseInt(
            normalized.slice(6, 8),
            16
          )
        : null
  };
}

function rgbToHsv(
  red,
  green,
  blue
) {
  const normalizedRed =
    clamp(red / 255, 0, 1);
  const normalizedGreen =
    clamp(green / 255, 0, 1);
  const normalizedBlue =
    clamp(blue / 255, 0, 1);
  const maximum =
    Math.max(
      normalizedRed,
      normalizedGreen,
      normalizedBlue
    );
  const minimum =
    Math.min(
      normalizedRed,
      normalizedGreen,
      normalizedBlue
    );
  const delta =
    maximum - minimum;
  let hue = 0;

  if (delta > 0) {
    if (maximum === normalizedRed) {
      hue =
        60 *
        (((normalizedGreen - normalizedBlue) /
          delta) %
          6);
    } else if (maximum === normalizedGreen) {
      hue =
        60 *
        ((normalizedBlue - normalizedRed) /
          delta +
          2);
    } else {
      hue =
        60 *
        ((normalizedRed - normalizedGreen) /
          delta +
          4);
    }
  }

  if (hue < 0) {
    hue += 360;
  }

  return {
    hue,
    saturation:
      maximum === 0
        ? 0
        : delta / maximum,
    value: maximum
  };
}

function hsvToRgb(
  hue,
  saturation,
  value
) {
  const normalizedHue =
    ((Number(hue) % 360) + 360) %
    360;
  const normalizedSaturation =
    clamp(
      Number(saturation),
      0,
      1
    );
  const normalizedValue =
    clamp(
      Number(value),
      0,
      1
    );
  const chroma =
    normalizedValue *
    normalizedSaturation;
  const hueSection =
    normalizedHue / 60;
  const secondary =
    chroma *
    (1 -
      Math.abs(
        hueSection % 2 - 1
      ));
  const offset =
    normalizedValue - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection < 1) {
    red = chroma;
    green = secondary;
  } else if (hueSection < 2) {
    red = secondary;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = secondary;
  } else if (hueSection < 4) {
    green = secondary;
    blue = chroma;
  } else if (hueSection < 5) {
    red = secondary;
    blue = chroma;
  } else {
    red = chroma;
    blue = secondary;
  }

  return {
    red:
      Math.round(
        (red + offset) * 255
      ),
    green:
      Math.round(
        (green + offset) * 255
      ),
    blue:
      Math.round(
        (blue + offset) * 255
      )
  };
}

function defaultForType(type) {
  switch (type) {
    case "bool":
      return "true";
    case "string":
      return "Example";
    case "button":
      return "";
    case "Uri":
      return "https://example.com";
    case "int":
    case "float":
    case "double":
      return "0";
    case "int2":
    case "float2":
    case "double2":
      return "0, 0";
    case "int3":
    case "float3":
    case "double3":
      return "0, 0, 0";
    case "int4":
    case "float4":
    case "double4":
      return "0, 0, 0, 0";
    case "colorX":
      return "colorX.White";
    case "enum":
      return "Medium";
    default:
      return "";
  }
}

function friendlyTypeName(type) {
  return TYPE_DEFINITIONS.find(item => item.type === type)?.label || type;
}

function flattenNodes(nodes, conditions = [], path = []) {
  const entries = [];
  for (const node of nodes) {
    entries.push({ node, conditions, path });
    if (node.kind === "controller") {
      for (const option of node.options) {
        entries.push(
          ...flattenNodes(
            option.children,
            [...conditions, { controller: node, option }],
            [...path, option.name]
          )
        );
      }
    } else if (node.kind === LAYOUT_ROW_KIND) {
      entries.push(
        ...flattenNodes(
          node.children || [],
          conditions,
          path
        )
      );
    }
  }
  return entries;
}

let flattenedNodesCacheSource = null;
let flattenedNodesCache = [];

function currentFlattenedNodes() {
  if (flattenedNodesCacheSource !== state.nodes) {
    flattenedNodesCacheSource = state.nodes;
    flattenedNodesCache = flattenNodes(state.nodes);
  }

  return flattenedNodesCache;
}

function findDirectInlineRowContext(
  nodeId,
  nodes = state.nodes
) {
  for (const candidate of
    Array.isArray(nodes) ? nodes : []) {
    if (candidate?.kind === LAYOUT_ROW_KIND) {
      const children =
        Array.isArray(candidate.children)
          ? candidate.children
          : [];
      const index = children.findIndex(
        child =>
          String(child?.id || "") ===
          String(nodeId || "")
      );

      if (index >= 0) {
        return {
          row: candidate,
          children,
          index
        };
      }

      const nested =
        findDirectInlineRowContext(
          nodeId,
          children
        );
      if (nested) return nested;
    }

    if (candidate?.kind === "controller") {
      for (const option of
        Array.isArray(candidate.options)
          ? candidate.options
          : []) {
        const nested =
          findDirectInlineRowContext(
            nodeId,
            option.children
          );
        if (nested) return nested;
      }
    }
  }

  return null;
}

function effectiveInlineRowWidthPercent(
  node,
  context =
    findDirectInlineRowContext(node?.id)
) {
  const explicit =
    Number(node?.layoutWidthPercent);

  if (
    Number.isFinite(explicit) &&
    explicit > 0
  ) {
    return clamp(explicit, 1, 100);
  }

  return context?.children?.length > 0
    ? 100 / context.children.length
    : 100;
}

function inlineRowWidthText(value) {
  return Number(value)
    .toFixed(2)
    .replace(/\.00$/, "")
    .replace(/(\.\d)0$/, "$1");
}

function createSettingsPreviewRuntimeMenu() {
  return {
    visibility: {},
    order: {},
    horizontal: {},
    width: {},
    labelVisibility: {}
  };
}

function settingsPreviewRuntimeOverride(
  property,
  nodeId
) {
  const values =
    settingsPreviewRuntimeMenu?.[
      property
    ];
  const key = String(nodeId || "");

  if (
    !values ||
    !Object.prototype.hasOwnProperty.call(
      values,
      key
    )
  ) {
    return undefined;
  }

  return values[key];
}

function settingsPreviewNodeVisible(node) {
  const override =
    settingsPreviewRuntimeOverride(
      "visibility",
      node?.id
    );

  if (override !== undefined) {
    return override === true;
  }

  if (node?.dynamicSettingKind) {
    return node.dynamicInternal !== true;
  }

  return node?.hidden !== true;
}

function settingsPreviewNodeHorizontal(node) {
  const override =
    settingsPreviewRuntimeOverride(
      "horizontal",
      node?.id
    );

  return override === undefined
    ? node?.horizontal !== false
    : override === true;
}

function settingsPreviewNodeLabelVisible(node) {
  const override =
    settingsPreviewRuntimeOverride(
      "labelVisibility",
      node?.id
    );

  return override === undefined
    ? node?.hideLabel !== true
    : override === true;
}

function settingsPreviewOrderedNodes(nodes) {
  const source =
    Array.isArray(nodes)
      ? nodes
      : [];
  const defaultOrders =
    new Map(
      typeof flattenNodes ===
        "function" &&
      typeof state !== "undefined"
        ? flattenNodes(
            state?.nodes || []
          ).map((entry, index) => [
            String(
              entry?.node?.id || ""
            ),
            index
          ])
        : []
    );

  return source
    .map((node, index) => ({
      node,
      index,
      defaultOrder:
        defaultOrders.get(
          String(node?.id || "")
        ) ?? index,
      order:
        settingsPreviewRuntimeOverride(
          "order",
          node?.id
        )
    }))
    .sort((left, right) => {
      const leftOrder =
        Number(left.order);
      const rightOrder =
        Number(right.order);
      const leftHasOrder =
        left.order !== undefined &&
        Number.isFinite(leftOrder);
      const rightHasOrder =
        right.order !== undefined &&
        Number.isFinite(rightOrder);

      if (leftHasOrder || rightHasOrder) {
        const leftValue = leftHasOrder
          ? leftOrder
          : left.defaultOrder;
        const rightValue = rightHasOrder
          ? rightOrder
          : right.defaultOrder;

        if (leftValue !== rightValue) {
          return leftValue - rightValue;
        }
      }

      return left.index - right.index;
    })
    .map(entry => entry.node);
}

function settingsPreviewInlineRowWidthPercent(
  node,
  context =
    findDirectInlineRowContext(node?.id)
) {
  const override = Number(
    settingsPreviewRuntimeOverride(
      "width",
      node?.id
    )
  );

  if (Number.isFinite(override)) {
    return clamp(override, 1, 100);
  }

  return effectiveInlineRowWidthPercent(
    node,
    context
  );
}

function applyInlineRowPreviewLayout(
  node,
  element,
  context =
    findDirectInlineRowContext(node?.id)
) {
  if (
    !(element instanceof HTMLElement) ||
    !context
  ) {
    return element;
  }

  element.classList.add(
    "rml-preview-layout-cell"
  );
  element.style.setProperty(
    "--rml-inline-width-percent",
    inlineRowWidthText(
      settingsPreviewInlineRowWidthPercent(
        node,
        context
      )
    )
  );
  element.dataset.previewNodeId =
    String(node?.id || "");
  return element;
}

function appendInlineRowInspectorControls(
  host,
  node,
  onChanged
) {
  const context =
    findDirectInlineRowContext(node?.id);

  if (
    !(host instanceof HTMLElement) ||
    !node ||
    !context ||
    host.querySelector(
      "[data-inline-row-item-properties]"
    )
  ) {
    return false;
  }

  const fieldset =
    document.createElement("fieldset");
  fieldset.dataset
    .inlineRowItemProperties = "true";

  const legend =
    document.createElement("legend");
  legend.textContent =
    `Inline Row · ${context.row.label || "Layout"}`;
  fieldset.appendChild(legend);

  const widthLabel =
    document.createElement("label");
  widthLabel.append(
    document.createTextNode(
      "Width in this row (%)"
    )
  );

  const width =
    document.createElement("input");
  width.type = "number";
  width.min = "1";
  width.max = "100";
  width.step = "0.1";
  width.value = inlineRowWidthText(
    effectiveInlineRowWidthPercent(
      node,
      context
    )
  );
  width.addEventListener(
    "change",
    () => {
      const next = clamp(
        Number(width.value) ||
          effectiveInlineRowWidthPercent(
            node,
            context
          ),
        1,
        100
      );
      node.layoutWidthPercent = next;
      width.value =
        inlineRowWidthText(next);
      onChanged?.();
    }
  );
  widthLabel.appendChild(width);
  fieldset.appendChild(widthLabel);

  const toggle =
    document.createElement("label");
  toggle.className = "toggle-row";
  const toggleText =
    document.createElement("span");
  const strong =
    document.createElement("strong");
  strong.textContent = "Hide label";
  const small =
    document.createElement("small");
  small.textContent =
    "Uses the complete cell width for the editor or button.";
  toggleText.append(strong, small);

  const hide =
    document.createElement("input");
  hide.type = "checkbox";
  hide.checked = node.hideLabel === true;
  hide.addEventListener(
    "change",
    () => {
      node.hideLabel = hide.checked;
      onChanged?.();
    }
  );
  toggle.append(toggleText, hide);
  fieldset.appendChild(toggle);

  const total = context.children.reduce(
    (sum, child) =>
      sum +
      effectiveInlineRowWidthPercent(
        child,
        context
      ),
    0
  );
  const note =
    document.createElement("small");
  note.className =
    "inline-row-width-note";
  note.textContent =
    `Current row total: ${inlineRowWidthText(total)}%. ` +
    "Use a total of 100% for exact proportions.";
  fieldset.appendChild(note);

  host.appendChild(fieldset);
  return true;
}

window.RMLInlineRowLayout =
  Object.freeze({
    findContext:
      findDirectInlineRowContext,
    effectiveWidthPercent:
      settingsPreviewInlineRowWidthPercent,
    isPreviewVisible:
      settingsPreviewNodeVisible,
    isPreviewLabelVisible:
      settingsPreviewNodeLabelVisible,
    isPreviewHorizontal:
      settingsPreviewNodeHorizontal,
    orderedPreviewNodes:
      settingsPreviewOrderedNodes,
    applyPreviewLayout:
      applyInlineRowPreviewLayout,
    appendInspectorControls:
      appendInlineRowInspectorControls
  });


function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "controller") {
      for (const option of node.options) {
        const found = findNode(option.children, id);
        if (found) return found;
      }
    } else if (node.kind === LAYOUT_ROW_KIND) {
      const found = findNode(node.children || [], id);
      if (found) return found;
    }
  }
  return null;
}

function findNodeContainerId(
  nodes,
  nodeId,
  currentContainerId = ROOT_CONTAINER
) {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return currentContainerId;
    }

    if (node.kind === LAYOUT_ROW_KIND) {
      const containerId = findNodeContainerId(
        node.children || [],
        nodeId,
        node.id
      );

      if (containerId !== null) {
        return containerId;
      }

      continue;
    }

    if (node.kind !== "controller") continue;

    for (const option of node.options) {
      const containerId = findNodeContainerId(
        option.children,
        nodeId,
        option.id
      );

      if (containerId !== null) {
        return containerId;
      }
    }
  }

  return null;
}

function updateNode(nodes, id, updater) {
  return nodes.map(node => {
    if (node.id === id) return updater(node);
    if (node.kind === LAYOUT_ROW_KIND) {
      return {
        ...node,
        children: updateNode(
          node.children || [],
          id,
          updater
        )
      };
    }
    if (node.kind !== "controller") return node;
    return {
      ...node,
      options: node.options.map(option => ({
        ...option,
        children: updateNode(option.children, id, updater)
      }))
    };
  });
}

function removeNode(nodes, id) {
  let removed = null;
  const next = [];
  for (const node of nodes) {
    if (node.id === id) {
      removed = node;
      continue;
    }
    if (node.kind === "controller") {
      const options = node.options.map(option => {
        const result = removeNode(option.children, id);
        if (result.removed && !removed) removed = result.removed;
        return { ...option, children: result.nodes };
      });
      next.push({ ...node, options });
    } else if (node.kind === LAYOUT_ROW_KIND) {
      const result = removeNode(
        node.children || [],
        id
      );
      if (result.removed && !removed) removed = result.removed;
      next.push({
        ...node,
        children: result.nodes
      });
    } else {
      next.push(node);
    }
  }
  return { nodes: next, removed };
}

function insertIntoContainerAt(
  nodes,
  containerId,
  nodeToInsert,
  requestedIndex = Number.POSITIVE_INFINITY
) {
  if (
    nodeToInsert?.kind === LAYOUT_ROW_KIND &&
    findNode(nodes, containerId)?.kind === LAYOUT_ROW_KIND
  ) {
    return {
      nodes,
      inserted: false
    };
  }

  const insertAt = list => {
    const index = clamp(
      Number.isFinite(requestedIndex)
        ? Math.trunc(requestedIndex)
        : list.length,
      0,
      list.length
    );

    return [
      ...list.slice(0, index),
      nodeToInsert,
      ...list.slice(index)
    ];
  };

  if (containerId === ROOT_CONTAINER) {
    return {
      nodes: insertAt(nodes),
      inserted: true
    };
  }

  let inserted = false;
  const next = nodes.map(node => {
    if (node.kind === LAYOUT_ROW_KIND) {
      if (node.id === containerId) {
        inserted = true;
        return {
          ...node,
          children: insertAt(
            node.children || []
          )
        };
      }

      const nested = insertIntoContainerAt(
        node.children || [],
        containerId,
        nodeToInsert,
        requestedIndex
      );

      if (nested.inserted) inserted = true;

      return {
        ...node,
        children: nested.nodes
      };
    }

    if (node.kind !== "controller") return node;

    return {
      ...node,
      options: node.options.map(option => {
        if (option.id === containerId) {
          inserted = true;
          return {
            ...option,
            children: insertAt(option.children)
          };
        }

        const nested = insertIntoContainerAt(
          option.children,
          containerId,
          nodeToInsert,
          requestedIndex
        );

        if (nested.inserted) inserted = true;

        return {
          ...option,
          children: nested.nodes
        };
      })
    };
  });

  return { nodes: next, inserted };
}

function insertIntoContainer(nodes, containerId, nodeToInsert) {
  return insertIntoContainerAt(
    nodes,
    containerId,
    nodeToInsert,
    Number.POSITIVE_INFINITY
  );
}

function containerChildren(nodes, containerId) {
  if (containerId === ROOT_CONTAINER) {
    return nodes;
  }

  for (const node of nodes) {
    if (node.kind === LAYOUT_ROW_KIND) {
      if (node.id === containerId) {
        return node.children || [];
      }

      const nested = containerChildren(
        node.children || [],
        containerId
      );

      if (nested) return nested;
      continue;
    }

    if (node.kind !== "controller") continue;

    for (const option of node.options) {
      if (option.id === containerId) {
        return option.children;
      }

      const nested = containerChildren(
        option.children,
        containerId
      );

      if (nested) return nested;
    }
  }

  return null;
}

function moveNodeOneStep(nodeId, direction) {
  const containerId =
    findNodeContainerId(
      state.nodes,
      nodeId
    );

  if (containerId === null) {
    return;
  }

  const children =
    containerChildren(
      state.nodes,
      containerId
    );

  if (!children) return;

  const currentIndex =
    children.findIndex(
      node => node.id === nodeId
    );
  const targetIndex =
    currentIndex + direction;

  if (
    currentIndex < 0 ||
    targetIndex < 0 ||
    targetIndex >= children.length
  ) {
    return;
  }

  const removal =
    removeNode(
      state.nodes,
      nodeId
    );

  if (!removal.removed) return;

  const insertion =
    insertIntoContainerAt(
      removal.nodes,
      containerId,
      removal.removed,
      targetIndex
    );

  state.nodes = insertion.inserted
    ? insertion.nodes
    : state.nodes;
  state.selectedId = nodeId;
  state.activeContainerId =
    containerId;
  renderAll();
}

function findControllerOption(
  nodes,
  optionId
) {
  for (const node of nodes) {
    if (node.kind === LAYOUT_ROW_KIND) {
      const nested =
        findControllerOption(
          node.children || [],
          optionId
        );

      if (nested) return nested;
      continue;
    }

    if (node.kind !== "controller") {
      continue;
    }

    const optionIndex =
      node.options.findIndex(
        option => option.id === optionId
      );

    if (optionIndex >= 0) {
      return {
        controller: node,
        option: node.options[optionIndex],
        optionIndex
      };
    }

    for (const option of node.options) {
      const nested =
        findControllerOption(
          option.children,
          optionId
        );

      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function updateControllerOptions(
  nodes,
  controllerId,
  updater
) {
  return updateNode(
    nodes,
    controllerId,
    controller => {
      if (controller.kind !== "controller") {
        return controller;
      }

      const options = updater(
        controller.options
      );
      const defaultOption =
        options.some(
          option =>
            option.name ===
            controller.defaultOption
        )
          ? controller.defaultOption
          : options[0]?.name || "";

      return {
        ...controller,
        options,
        defaultOption
      };
    }
  );
}

function moveControllerOptionOneStep(
  controllerId,
  optionId,
  direction
) {
  const found =
    findControllerOption(
      state.nodes,
      optionId
    );

  if (
    !found ||
    found.controller.id !== controllerId
  ) {
    return;
  }

  const targetIndex =
    found.optionIndex + direction;

  if (
    targetIndex < 0 ||
    targetIndex >=
      found.controller.options.length
  ) {
    return;
  }

  state.nodes =
    updateControllerOptions(
      state.nodes,
      controllerId,
      options => {
        const next = [...options];
        const [moving] =
          next.splice(
            found.optionIndex,
            1
          );
        next.splice(
          targetIndex,
          0,
          moving
        );
        return next;
      }
    );

  state.activeContainerId = optionId;
  state.selectedId = controllerId;
  renderAll();
}

function uniqueOptionName(
  options,
  preferred
) {
  const used =
    new Set(
      options.map(option =>
        toPascalCase(
          option.name,
          "Section"
        )
      )
    );
  let candidate =
    preferred || "Section";
  let index = 2;

  while (
    used.has(
      toPascalCase(
        candidate,
        "Section"
      )
    )
  ) {
    candidate = `Section${index}`;
    index += 1;
  }

  return candidate;
}

function controllerFromDetachedOption(
  option,
  sourceController
) {
  const controller =
    makeController();
  const fallbackName =
    uniqueOptionName(
      [option],
      "Section2"
    );

  return {
    ...controller,
    description:
      `Selects the visible ${option.name} settings section.`,
    defaultOption: option.name,
    options: [
      option,
      {
        id: createId("option"),
        name: fallbackName,
        children: []
      }
    ],
    reaction:
      sourceController?.reaction ||
      "stored"
  };
}

function detachControllerOption(
  controllerId,
  optionId
) {
  let detached = null;

  const processList =
    nodes => {
      const result = [];

      for (const node of nodes) {
        if (node.kind === LAYOUT_ROW_KIND) {
          result.push({
            ...node,
            children: processList(
              node.children || []
            )
          });
          continue;
        }

        if (
          node.kind !==
          "controller"
        ) {
          result.push(node);
          continue;
        }

        if (
          node.id ===
          controllerId
        ) {
          const option =
            node.options.find(
              current =>
                current.id ===
                optionId
            );

          if (!option) {
            result.push(node);
            continue;
          }

          detached = {
            option,
            sourceController:
              node
          };

          const remainingOptions =
            node.options.filter(
              current =>
                current.id !==
                optionId
            );

          if (
            remainingOptions.length >=
            2
          ) {
            const defaultOption =
              remainingOptions.some(
                current =>
                  current.name ===
                  node.defaultOption
              )
                ? node.defaultOption
                : remainingOptions[0]
                    .name;

            result.push({
              ...node,
              options:
                remainingOptions,
              defaultOption
            });

            continue;
          }

          if (
            remainingOptions.length ===
            1
          ) {
            const remainingChildren =
              processList(
                remainingOptions[0]
                  .children
              );

            result.push(
              ...remainingChildren
            );
          }

          continue;
        }

        result.push({
          ...node,
          options:
            node.options.map(
              option => ({
                ...option,
                children:
                  processList(
                    option.children
                  )
              })
            )
        });
      }

      return result;
    };

  state.nodes =
    processList(
      state.nodes
    );

  return detached;
}

function reorderControllerOption(
  controllerId,
  optionId,
  requestedIndex
) {
  const found =
    findControllerOption(
      state.nodes,
      optionId
    );

  if (
    !found ||
    found.controller.id !== controllerId
  ) {
    return false;
  }

  let targetIndex = clamp(
    Math.trunc(requestedIndex),
    0,
    found.controller.options.length
  );

  if (found.optionIndex < targetIndex) {
    targetIndex -= 1;
  }

  state.nodes =
    updateControllerOptions(
      state.nodes,
      controllerId,
      options => {
        const next = [...options];
        const [moving] =
          next.splice(
            found.optionIndex,
            1
          );
        next.splice(
          targetIndex,
          0,
          moving
        );
        return next;
      }
    );

  state.activeContainerId = optionId;
  state.selectedId = controllerId;
  return true;
}

function nodeContainsContainer(node, containerId) {
  if (node.kind === LAYOUT_ROW_KIND) {
    if (node.id === containerId) return true;
    return (node.children || []).some(child =>
      nodeContainsContainer(child, containerId)
    );
  }
  if (node.kind !== "controller") return false;
  for (const option of node.options) {
    if (option.id === containerId) return true;
    if (
      option.children.some(child =>
        nodeContainsContainer(child, containerId)
      )
    ) {
      return true;
    }
  }
  return false;
}

function findContainerName(nodes, containerId) {
  if (containerId === ROOT_CONTAINER) return "Root";
  for (const node of nodes) {
    if (node.kind === LAYOUT_ROW_KIND) {
      if (node.id === containerId) {
        return `${node.label || "Inline row"} / items`;
      }
      const nested = findContainerName(
        node.children || [],
        containerId
      );
      if (nested !== "Unknown section") return nested;
      continue;
    }
    if (node.kind !== "controller") continue;
    for (const option of node.options) {
      if (option.id === containerId) {
        return `${node.fieldName} / ${option.name}`;
      }
      const nested = findContainerName(option.children, containerId);
      if (nested !== "Unknown section") return nested;
    }
  }
  return "Unknown section";
}

function makeSetting(type) {
  const count = currentFlattenedNodes().filter(
    entry => entry.node.kind === "setting" && entry.node.valueType === type
  ).length;
  const base =
    type === "enum"
      ? "Quality"
      : type === "button"
        ? "ActionButton"
      : type === "Uri"
        ? "ResourceUri"
        : toPascalCase(type, "Setting");
  const fieldName = count === 0 ? base : `${base}${count + 1}`;
  return {
    id: createId("setting"),
    kind: "setting",
    valueType: type,
    fieldName,
    keyName: toSnakeCase(fieldName),
    description: `${friendlyTypeName(type)} configuration setting.`,
    defaultValue: defaultForType(type),
    buttonLabel: type === "button" ? "Run" : undefined,
    layoutWidthPercent: undefined,
    hideLabel: false,
    hidden: false,
    validatorMode: "none",
    customValidator: "",
    useSlider: false,
    minimum: "0",
    maximum: "100",
    enumName: type === "enum" ? `${fieldName}Option` : "",
    enumOptions: type === "enum" ? ["Low", "Medium", "High"] : [],
    colorProfile: type === "colorX" ? "linear" : undefined,
    colorStrength: type === "colorX" ? 1 : undefined,
    reaction: "stored"
  };
}

function makeController() {
  const count = currentFlattenedNodes().filter(
    entry => entry.node.kind === "controller"
  ).length;
  const suffix = count === 0 ? "" : `${count + 1}`;
  return {
    id: createId("controller"),
    kind: "controller",
    fieldName: `ActivePage${suffix}`,
    keyName: count === 0 ? "00_active_page" : `active_page_${count + 1}`,
    description: "Selects the visible settings section.",
    layoutWidthPercent: undefined,
    hideLabel: false,
    enumName: `SettingsPage${suffix}`,
    defaultOption: "General",
    reaction: "stored",
    options: [
      { id: createId("option"), name: "General", children: [] },
      { id: createId("option"), name: "Advanced", children: [] }
    ]
  };
}

function makeLayoutRow() {
  const count = currentFlattenedNodes().filter(
    entry => entry.node.kind === LAYOUT_ROW_KIND
  ).length;
  const suffix = count === 0 ? "" : ` ${count + 1}`;

  return {
    id: createId("layout-row"),
    kind: LAYOUT_ROW_KIND,
    label: `Inline Row${suffix}`,
    description:
      "Places its direct Configuration Outline items next to each other.",
    hidden: false,
    horizontal: true,
    children: []
  };
}

function componentCount(type) {
  if (type.endsWith("2")) return 2;
  if (type.endsWith("3")) return 3;
  if (type.endsWith("4")) return 4;
  return 1;
}

function isScalarNumericType(type) {
  return ["int", "float", "double"].includes(type);
}

function isVectorType(type) {
  return /^(int|float|double)[234]$/.test(type);
}

function numericComponentType(type) {
  if (type.startsWith("int")) return "int";
  if (type.startsWith("float")) return "float";
  if (type.startsWith("double")) return "double";
  return null;
}

function supportsSlider(setting) {
  return (
    setting.kind === "setting" &&
    isScalarNumericType(setting.valueType)
  );
}

function usesSlider(setting) {
  return (
    supportsSlider(setting) &&
    (setting.useSlider ||
      setting.validatorMode === "range")
  );
}

function allowedValidatorModes(type) {
  const modes = ["none", "custom"];
  if (type === "float" || type === "double") {
    modes.push("finite");
  }
  if (isScalarNumericType(type)) {
    modes.push("range");
  }
  if (type === "Uri") {
    modes.push("absolute-uri", "http-uri");
  }
  return modes;
}

function isLegacyLayoutRowNode(node) {
  return Boolean(
    node &&
    node.kind === "setting" &&
    node.valueType === LAYOUT_ROW_KIND
  );
}

function normalizeLayoutRowNode(
  node,
  children = null
) {
  const legacy =
    isLegacyLayoutRowNode(node);

  const rawLabel =
    String(
      node?.label ||
      (legacy ? node?.fieldName : "") ||
      "Inline Row"
    ).trim();

  const label =
    !rawLabel ||
    /^layout[\s_-]*row$/i.test(
      rawLabel
    )
      ? "Inline Row"
      : rawLabel;

  const description =
    legacy
      ? DEFAULT_LAYOUT_ROW_DESCRIPTION
      : String(
          node?.description ||
          DEFAULT_LAYOUT_ROW_DESCRIPTION
        ).trim() ||
        DEFAULT_LAYOUT_ROW_DESCRIPTION;

  const source =
    legacy
      ? { id: node.id }
      : { ...node };

  return {
    ...source,
    id: node.id,
    kind: LAYOUT_ROW_KIND,
    label,
    description,
    hidden:
      node?.hidden === true,
    horizontal:
      node.horizontal !== false,
    children:
      Array.isArray(children)
        ? children
        : Array.isArray(node.children)
          ? node.children
          : []
  };
}

function normalizeNodes(nodes) {
  return nodes.map(node => {
    if (node.kind === "controller") {
      return {
        ...node,
        options: node.options.map(option => ({
          ...option,
          children: normalizeNodes(option.children)
        }))
      };
    }

    if (
      node.kind === LAYOUT_ROW_KIND ||
      isLegacyLayoutRowNode(node)
    ) {
      return normalizeLayoutRowNode(
        node,
        normalizeNodes(
          Array.isArray(node.children)
            ? node.children
            : []
        )
      );
    }

    const validatorMode =
      allowedValidatorModes(
        node.valueType
      ).includes(node.validatorMode)
        ? node.validatorMode
        : "none";

    const normalized = {
      ...node,
      layoutWidthPercent:
        Number.isFinite(
          Number(node.layoutWidthPercent)
        ) &&
        Number(node.layoutWidthPercent) > 0
          ? clamp(
              Number(
                node.layoutWidthPercent
              ),
              1,
              100
            )
          : undefined,
      hideLabel:
        node.hideLabel === true,
      defaultValue:
        node.valueType === "colorX"
          ? portableColorXExpression(
              node.defaultValue
            )
          : node.defaultValue,
      useSlider:
        supportsSlider(node) &&
        (validatorMode === "range" ||
          Boolean(node.useSlider)),
      validatorMode
    };

    if (normalized.valueType === "button") {
      normalized.defaultValue = "";
      normalized.buttonLabel =
        String(
          normalized.buttonLabel ||
          "Run"
        ).trim() || "Run";
      normalized.validatorMode = "none";
      normalized.useSlider = false;
      normalized.reaction = "stored";
    }

    return normalized;
  });
}

function isIntegerLiteral(value) {
  return /^[+-]?\d+$/.test(String(value).trim());
}

function isFloatLiteral(value) {
  return /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?[fF]?$/.test(
    String(value).trim()
  );
}

function isDoubleLiteral(value) {
  return /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?[dD]?$/.test(
    String(value).trim()
  );
}

function isValidNumericLiteral(value, type) {
  if (type === "int") return isIntegerLiteral(value);
  if (type === "float") return isFloatLiteral(value);
  if (type === "double") return isDoubleLiteral(value);
  return false;
}

function numericLiteralNumber(value) {
  return Number(
    String(value)
      .trim()
      .replace(/[fFdD]$/, "")
  );
}

function typedNumber(value, type) {
  const normalized = String(value).trim() || "0";
  if (type.startsWith("float") && !/[fF]$/.test(normalized)) {
    return `${normalized}f`;
  }
  if (type.startsWith("double") && !/[dD]$/.test(normalized)) {
    return `${normalized}d`;
  }
  return normalized.replace(/[fFdD]$/, "");
}

function sliderNumber(value) {
  const normalized = String(value).trim().replace(/[fFdD]$/, "") || "0";
  return `${normalized}f`;
}

function enumValueExpression(
  enumName,
  enumFallback,
  options,
  selectedValue,
  optionFallback
) {
  const normalizedSelected = toPascalCase(
    selectedValue,
    optionFallback
  );
  const optionIndex = Math.max(
    (options || []).findIndex(option =>
      toPascalCase(
        typeof option === "string"
          ? option
          : option?.name,
        optionFallback
      ) === normalizedSelected
    ),
    0
  );
  return `(${toPascalCase(enumName, enumFallback)})${optionIndex}`;
}

function defaultExpression(setting) {
  const value = setting.defaultValue.trim();
  switch (setting.valueType) {
    case "bool":
      return value.toLowerCase() === "false" ? "false" : "true";
    case "string":
      return `"${escapeCSharp(value)}"`;
    case "button":
      return "string.Empty";
    case "Uri":
      return `new Uri(\n${" ".repeat(20)}"${escapeCSharp(
        value
      )}",\n${" ".repeat(20)}UriKind.RelativeOrAbsolute)`;
    case "int":
    case "float":
    case "double":
      return typedNumber(value, setting.valueType);
    case "int2":
    case "int3":
    case "int4":
    case "float2":
    case "float3":
    case "float4":
    case "double2":
    case "double3":
    case "double4": {
      const parts = value.split(",").map(part => part.trim());
      const count = componentCount(setting.valueType);
      while (parts.length < count) parts.push("0");
      const values = parts
        .slice(0, count)
        .map(part => typedNumber(part, setting.valueType));
      return `new ${setting.valueType}(\n${values
        .map(part => `${" ".repeat(20)}${part}`)
        .join(",\n")})`;
    }
    case "colorX":
      return portableColorXExpression(
        value
      );
    case "enum": {
      const fallback = setting.enumOptions[0] || "Value";
      return enumValueExpression(
        setting.enumName,
        "SettingOption",
        setting.enumOptions,
        value,
        fallback
      );
    }
    default:
      return "default";
  }
}

function validatorExpression(setting) {
  switch (setting.validatorMode) {
    case "none":
      return "null";
    case "finite": {
      const type = setting.valueType === "double" ? "double" : "float";
      return `value =>\n${" ".repeat(20)}!${type}.IsNaN(value) &&\n${" ".repeat(
        20
      )}!${type}.IsInfinity(value)`;
    }
    case "range": {
      const minimum = typedNumber(setting.minimum, setting.valueType);
      const maximum = typedNumber(setting.maximum, setting.valueType);
      const finite =
        setting.valueType === "float" || setting.valueType === "double"
          ? `!${setting.valueType}.IsNaN(value) &&\n${" ".repeat(
              20
            )}!${setting.valueType}.IsInfinity(value) &&\n${" ".repeat(20)}`
          : "";
      return `value =>\n${" ".repeat(
        20
      )}${finite}value >= ${minimum} &&\n${" ".repeat(
        20
      )}value <= ${maximum}`;
    }
    case "absolute-uri":
      return `value =>\n${" ".repeat(20)}value != null &&\n${" ".repeat(
        20
      )}value.IsAbsoluteUri`;
    case "http-uri":
      return `value =>\n${" ".repeat(20)}value != null &&\n${" ".repeat(
        20
      )}value.IsAbsoluteUri &&\n${" ".repeat(
        20
      )}(value.Scheme == Uri.UriSchemeHttp ||\n${" ".repeat(
        21
      )}value.Scheme == Uri.UriSchemeHttps)`;
    case "custom":
      return setting.customValidator.trim() || "null";
    default:
      return "null";
  }
}

function hasOptionalArguments(setting) {
  const useSlider =
    usesSlider(setting);

  return (
    setting.valueType === "button" ||
    setting.hidden ||
    setting.validatorMode !== "none" ||
    useSlider
  );
}

function settingDeclaration(setting, path) {
  const type =
    setting.valueType === "enum"
      ? toPascalCase(setting.enumName, "SettingOption")
      : setting.valueType === "button"
        ? "string"
      : setting.valueType;
  const field = toPascalCase(setting.fieldName, "Setting");
  const args = [
    `"${escapeCSharp(setting.keyName)}"`,
    `"${escapeCSharp(setting.description)}"`,
    `() => ${defaultExpression(setting)}`
  ];
  if (hasOptionalArguments(setting)) {
    const useSlider =
      usesSlider(setting);

    args.push(
      setting.valueType === "button" ||
      setting.hidden
        ? "true"
        : "false"
    );
    args.push(validatorExpression(setting));
    args.push(
      useSlider
        ? sliderNumber(setting.minimum)
        : "null"
    );
    args.push(
      useSlider
        ? sliderNumber(setting.maximum)
        : "null"
    );
  }
  const pathComment =
    path.length > 0
      ? `    // ${csharpSingleLineCommentText(
          path.join(" / ")
        )}\n`
      : "    // Always visible\n";
  return `${pathComment}    [AutoRegisterConfigKey]
    public static readonly ModConfigurationKey<${type}>
        ${field} =
            new(
                ${args.join(",\n                ")});
`;
}

function controllerDeclaration(controller, path) {
  const field = toPascalCase(controller.fieldName, "ActivePage");
  const enumName = toPascalCase(controller.enumName, "SettingsPage");
  const defaultOption = enumValueExpression(
    controller.enumName,
    "SettingsPage",
    controller.options,
    controller.defaultOption,
    controller.options[0]?.name || "General"
  );
  const pathComment =
    path.length > 0
      ? `    // Nested navigation: ${csharpSingleLineCommentText(
          path.join(" / ")
        )}\n`
      : "    // Top-level navigation\n";
  return `${pathComment}    [AutoRegisterConfigKey]
    public static readonly ModConfigurationKey<${enumName}>
        ${field} =
            new(
                "${escapeCSharp(controller.keyName)}",
                "${escapeCSharp(controller.description)}",
                () => ${defaultOption});
`;
}

function enumDeclarations(entries) {
  const declarations = [];
  for (const entry of entries) {
    if (entry.node.kind === "controller") {
      const enumName = toPascalCase(entry.node.enumName, "SettingsPage");
      const options = entry.node.options
        .map(option => `    ${toPascalCase(option.name, "Page")}`)
        .join(",\n");
      declarations.push(`public enum ${enumName}\n{\n${options}\n}`);
    } else if (entry.node.valueType === "enum") {
      const enumName = toPascalCase(entry.node.enumName, "SettingOption");
      const options = entry.node.enumOptions
        .map(option => `    ${toPascalCase(option, "Value")}`)
        .join(",\n");
      declarations.push(`public enum ${enumName}\n{\n${options}\n}`);
    }
  }
  return declarations.join("\n\n");
}

function conditionExpression(conditions) {
  if (conditions.length === 0) return "true";
  return conditions
    .map(({ controller, option }) => {
      const local = toCamelCase(controller.fieldName);
      const optionValue = enumValueExpression(
        controller.enumName,
        "SettingsPage",
        controller.options,
        option.name,
        controller.options[0]?.name || "Page"
      );
      return `${local} ==\n                ${optionValue}`;
    })
    .join(" &&\n            ");
}

function reactionIncludesStartup(reaction) {
  return reaction === "startup" || reaction === "startup-saved";
}

function reactionIncludesSaved(reaction) {
  return reaction === "saved" || reaction === "startup-saved";
}

function getTypedNodeGraphContribution() {
  const extensionState =
    isPlainObject(state.extensions)
      ? state.extensions.typedNodeGraph
      : null;

  const hasPackedRuntimeGraph =
    Boolean(
      extensionState &&
      extensionState.configSnapshot &&
      typeof extensionState.configSnapshot === "object" &&
      Array.isArray(extensionState.configSnapshot.nodes)
    );

  
  
  
  if (!hasPackedRuntimeGraph) {
    return null;
  }

  if (typedNodeGraphModulesState === "pending") {
    return null;
  }

  if (typedNodeGraphModulesState === "failed") {
    return {
      active: true,
      diagnostics: [
        `The typed node graph modules could not be initialized: ${
          typedNodeGraphModulesError?.message ||
          "Unknown loader error."
        }`
      ],
      warnings: [],
      files: [],
      applyStatements: {},
      syncStatements: {},
      reactionStatements: {},
      initializeStatement: "",
      onEngineInitializedStatement: "",
      onConfigurationSynchronizedStatement: "",
      requirements: {
        usesElements: false,
        usesRenderiteShared: false
      }
    };
  }

  if (
    largeGraphUsesBackgroundCodegen(
      extensionState
    )
  ) {
    const key =
      largeGraphCodegenKey(
        extensionState
      );

    if (
      graphCodegenWorkerCachedResult &&
      graphCodegenWorkerCachedKey === key
    ) {
      return graphCodegenWorkerCachedResult;
    }

    requestLargeGraphCodegen(
      extensionState,
      key
    );
    return pendingLargeGraphContribution();
  }

  const generator =
    window.RMLTypedNodeGraphGenerator;

  if (
    !generator ||
    typeof generator.build !==
      "function"
  ) {
    return {
      active: true,
      diagnostics: [
        "The typed node graph generator is not loaded. Ensure node_graph.js is loaded after app.js."
      ],
      warnings: [],
      files: [],
      applyStatements: {},
      syncStatements: {},
      reactionStatements: {},
      initializeStatement: "",
      onEngineInitializedStatement: "",
      onConfigurationSynchronizedStatement: "",
      requirements: {
        usesElements: false,
        usesRenderiteShared: false
      }
    };
  }

  try {
    const contribution =
      generator.build({
        state:
          builderCodegenStateSnapshot(),
        entries:
          clone(
            currentFlattenedNodes()
          )
      });

    if (
      !contribution ||
      contribution.active !== true
    ) {
      return {
        active: true,
        diagnostics: [
          "The typed node graph is active, but no C# runtime contribution was generated."
        ],
        warnings: [],
        files: [],
        applyStatements: {},
        syncStatements: {},
        reactionStatements: {},
        initializeStatement: "",
        onEngineInitializedStatement: "",
        onConfigurationSynchronizedStatement: "",
        requirements: {
          usesElements: false,
          usesRenderiteShared: false
        }
      };
    }

    return contribution;
  } catch (error) {
    console.error(
      "Typed node graph C# generation failed.",
      error
    );

    return {
      active: true,
      diagnostics: [
        `Typed node graph C# generation failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      ],
      warnings: [],
      files: [],
      applyStatements: {},
      syncStatements: {},
      reactionStatements: {},
      initializeStatement: "",
      onEngineInitializedStatement: "",
      onConfigurationSynchronizedStatement: "",
      requirements: {
        usesElements: false,
        usesRenderiteShared: false
      }
    };
  }
}

function getAdditionalGeneratedSourceFiles() {
  const contribution =
    getTypedNodeGraphContribution();

  if (
    !contribution?.active ||
    !Array.isArray(
      contribution.files
    )
  ) {
    return [];
  }

  return contribution.files
    .filter(
      file =>
        file &&
        typeof file.name === "string" &&
        file.name.trim() &&
        typeof file.content === "string"
    )
    .map(file => ({
      name: file.name,
      content: file.content,
      type:
        file.type ||
        "text/plain;charset=utf-8"
    }));
}

function getAdditionalGeneratedProjects() {
  const contribution =
    getTypedNodeGraphContribution();

  if (
    !contribution?.active ||
    !Array.isArray(
      contribution.projects
    )
  ) {
    return [];
  }

  return contribution.projects
    .filter(project =>
      project &&
      typeof project === "object" &&
      !Array.isArray(project) &&
      String(
        project.name ||
        project.assemblyName ||
        ""
      ).trim() &&
      Array.isArray(project.files) &&
      project.files.length > 0
    )
    .map(project => clone(project));
}

function indentGeneratedStatement(
  statement,
  spaces
) {
  const prefix = " ".repeat(spaces);

  return String(statement || "")
    .split("\n")
    .filter(
      (line, index, lines) =>
        line.length > 0 ||
        (
          index > 0 &&
          index < lines.length - 1
        )
    )
    .map(line =>
      line.length > 0
        ? `${prefix}${line}`
        : ""
    )
    .join("\n");
}

function generateCode() {
  const metadata = state.metadata;
  const outlineEntries = currentFlattenedNodes();
  const entries = outlineEntries.filter(
    entry =>
      entry.node.kind === "setting" ||
      entry.node.kind === "controller"
  );
  const layoutRows = outlineEntries.filter(
    entry =>
      entry.node.kind === LAYOUT_ROW_KIND
  );
  const outlineOrderById = new Map(
    outlineEntries.map((entry, index) => [
      entry.node.id,
      index
    ])
  );
  const graphContribution =
    getTypedNodeGraphContribution();
  const graphRuntimeActive =
    Boolean(
      graphContribution?.active
    );
  const usesRuntimeConfigurationMenu =
    graphContribution?.requirements
      ?.usesRuntimeConfigurationMenu ===
    true;
  const usesModUnloadLifecycle =
    graphContribution?.requirements
      ?.usesModUnloadLifecycle ===
    true;
  const controllers = entries.filter(
    entry =>
      entry.node.kind ===
      "controller"
  );
  const settings = entries.filter(
    entry =>
      entry.node.kind ===
      "setting"
  );
  const usesElements = settings.some(
    entry =>
      [
        "colorX",
        "int2",
        "int3",
        "int4",
        "float2",
        "float3",
        "float4",
        "double2",
        "double3",
        "double4"
      ].includes(
        entry.node.valueType
      )
  );
  const usesColorX =
    settings.some(
      entry =>
        entry.node.valueType ===
        "colorX"
    );
  const usesCustomColorProfile =
    settings.some(
      entry =>
        entry.node.valueType ===
          "colorX" &&
        /\bColorProfile\b/.test(
          entry.node.defaultValue
        )
    );
  const className = toPascalCase(
    metadata.className,
    "YourMod"
  );
  const namespaceName =
    metadata.namespaceName
      .split(".")
      .map(part =>
        toPascalCase(
          part,
          "Namespace"
        )
      )
      .join(".") ||
    "YourModNamespace";
  const hasControllers =
    controllers.length > 0;

  const runtimeCapableEntries =
    entries.filter(
      entry =>
        ![
          "runtimeDisplay",
          "button"
        ].includes(
          entry?.node?.valueType
        )
    );

  const runtimeEntries =
    graphRuntimeActive
      ? runtimeCapableEntries
      : runtimeCapableEntries.filter(
          entry =>
            entry.node.reaction !==
            "stored"
        );
  const savedEntries =
    runtimeEntries.filter(
      entry =>
        reactionIncludesSaved(
          entry.node.reaction
        )
    );
  const startupEntries =
    runtimeEntries.filter(
      entry =>
        reactionIncludesStartup(
          entry.node.reaction
        )
    );
  const observedEntries =
    graphRuntimeActive
      ? runtimeEntries
      : savedEntries;

  const graphFileName =
    graphContribution?.files?.[0]
      ?.name ||
    `${className}.NodeGraph.cs`;

  const guide = metadata.includeGuide
    ? `// RML configuration template version: 1.7

/*
 * Generated by the RML Configuration Builder.
 *
 * [AutoRegisterConfigKey] is an existing standard RML feature. The builder
 * only generates its correct usage; it does not replace or redefine it.
 *
 * Numeric scalar settings use a slider when a maximum is provided.
 * Settings implement IModConfigurationOrderProvider, so the custom RML view
 * renders them in the exact top-to-bottom order defined in the builder.
 * Navigation enums only control RML visibility unless a runtime reaction was
 * explicitly enabled for them in the builder.
 * Whether navigation selections are persisted immediately or with Save
 * Settings is controlled globally by the user's RML Launcher preference.
 * Picker-created colors use an explicit color-to-colorX conversion and avoid
 * the ColorProfile-dependent colorX constructor.
${usesColorX
    ? ` * colorX settings add using Renderite.Shared and the generated .csproj
 * adds the matching Renderite.Shared.dll reference automatically.
`
    : ""}${usesCustomColorProfile
    ? ` * A custom ColorProfile expression additionally requires Renderite.Shared.dll.
 * The builder's generated .csproj adds that assembly reference automatically.
`
    : ""}${graphRuntimeActive
    ? ` * Typed node-graph runtime logic is generated separately in
 * ${graphFileName}. Every configuration value is synchronized for runtime
 * reads, while each Configuration Outline Runtime behavior exclusively
 * controls whether its typed socket emits at startup and/or after saved
 * changes. No manual replacement is required.
`
    : ` * Generated Apply... methods cache the latest runtime values in
 * Current... properties and deliberately retain the original TODO line.
 * Replace only that TODO line with mod-specific logic when no packed graph is
 * used.
`} */

`
    : "";

  const usingLines = [
    "using System;",
    usesRuntimeConfigurationMenu
      ? "using System.Globalization;"
      : "",
    usesElements
      ? "using Elements.Core;"
      : "",
    usesColorX
      ? "using Renderite.Shared;"
      : "",
    "using ResoniteModLoader;"
  ]
    .filter(Boolean)
    .join("\n");
  const enums =
    enumDeclarations(entries);
  const declarations = entries
    .map(entry =>
      entry.node.kind ===
      "controller"
        ? controllerDeclaration(
            entry.node,
            entry.path
          )
        : settingDeclaration(
            entry.node,
            entry.path
          )
    )
    .join("\n");
  const implementedInterfaces = [
    "IModConfigurationOrderProvider",
    ...(hasControllers ||
      usesRuntimeConfigurationMenu
      ? [
          "IModConfigurationVisibilityProvider"
        ]
      : []),
    ...(usesRuntimeConfigurationMenu
      ? [
          "IModConfigurationRuntimeMenuProvider"
        ]
      : []),
    ...(layoutRows.length > 0
      ? [
          "IModConfigurationLayoutProvider"
        ]
      : []),
    ...(usesModUnloadLifecycle
      ? ["IRuntimeReloadableMod"]
      : [])
  ];
  const interfaceSuffix =
    implementedInterfaces.length > 0
      ? `,\n      ${implementedInterfaces.join(
          ",\n      "
        )}`
      : "";

  const runtimeUnloadLifecycleBlock =
    usesModUnloadLifecycle
      ? `
    public bool CanUnload(
        out string reason)
    {
        reason = string.Empty;
        return true;
    }

    public System.Threading.Tasks.ValueTask StartAsync(
        System.Threading.CancellationToken cancellationToken)
    {
        _ = cancellationToken;
        return System.Threading.Tasks.ValueTask.CompletedTask;
    }

    public System.Threading.Tasks.ValueTask StopAsync(
        System.Threading.CancellationToken cancellationToken)
    {
        _ = cancellationToken;
${observedEntries.length > 0
    ? `        if (_configuration is not null)
        {
            _configuration.OnThisConfigurationChanged -=
                OnConfigurationChanged;
        }

`
    : ""}        ${graphContribution.className}.Shutdown();
        return System.Threading.Tasks.ValueTask.CompletedTask;
    }
`
      : "";

  const runtimeValueDeclarations =
    runtimeEntries
      .map(entry => {
        const node = entry.node;
        const field = toPascalCase(
          node.fieldName,
          "Setting"
        );
        const type =
          node.kind === "controller"
            ? toPascalCase(
                node.enumName,
                "SettingsPage"
              )
            : node.valueType === "enum"
              ? toPascalCase(
                  node.enumName,
                  "SettingOption"
                )
              : node.valueType;

        return `    private static ${type} _runtime${field} = default!;

    public static ${type} Current${field} =>
        _runtime${field};`;
      })
      .join("\n\n");

  const runtimeMenuValueBranches =
    usesRuntimeConfigurationMenu
      ? entries
          .filter(entry =>
            ![
              "runtimeDisplay",
              "button"
            ].includes(
              entry?.node?.valueType
            )
          )
          .map(entry => {
            const field = toPascalCase(
              entry.node.fieldName,
              "Setting"
            );

            return `        if (string.Equals(
                itemId,
                "${escapeCSharp(
                  entry.node.id
                )}",
                StringComparison.Ordinal))
        {
            return SetRuntimeConfigurationValue(
                ${field},
                value,
                save);
        }`;
          })
          .join("\n\n")
      : "";

  const runtimeMenuValueSupport =
    usesRuntimeConfigurationMenu
      ? `
    private static Func<bool>?
        _runtimeConfigurationDraftSaveHandler;

    private static bool SaveRuntimeConfigurationDrafts()
    {
        Func<bool>? handler =
            _runtimeConfigurationDraftSaveHandler;

        return handler?.Invoke() == true;
    }

    private static bool SetRuntimeConfigurationMenuValue(
        string itemId,
        object? value,
        bool save)
    {
${runtimeMenuValueBranches}

        return false;
    }

    private static bool SetRuntimeConfigurationValue(
        ModConfigurationKey key,
        object? value,
        bool save)
    {
        try
        {
            Type targetType =
                key.ValueType();

            object? convertedValue =
                ConvertRuntimeConfigurationValue(
                    value,
                    targetType);

            _configuration.Set(
                key,
                convertedValue!);

            if (save)
            {
                _configuration.Save();
            }

            return true;
        }
        catch (Exception exception)
        {
            Msg(
                "Runtime Configuration Menu could not set '" +
                key.Name +
                "': " +
                exception.Message);

            return false;
        }
    }

    private static object? ConvertRuntimeConfigurationValue(
        object? value,
        Type targetType)
    {
        Type effectiveType =
            Nullable.GetUnderlyingType(
                targetType) ??
            targetType;

        if (value is null)
        {
            return effectiveType.IsValueType
                ? Activator.CreateInstance(
                    effectiveType)
                : null;
        }

        if (effectiveType.IsInstanceOfType(
                value))
        {
            return value;
        }

        if (effectiveType.IsEnum)
        {
            return value is string enumText
                ? Enum.Parse(
                    effectiveType,
                    enumText,
                    ignoreCase: true)
                : Enum.ToObject(
                    effectiveType,
                    value);
        }

        if (effectiveType == typeof(Uri))
        {
            return new Uri(
                Convert.ToString(
                    value,
                    CultureInfo.InvariantCulture) ??
                string.Empty,
                UriKind.RelativeOrAbsolute);
        }

        if (effectiveType == typeof(string))
        {
            return Convert.ToString(
                       value,
                       CultureInfo.InvariantCulture) ??
                   string.Empty;
        }

        return Convert.ChangeType(
            value,
            effectiveType,
            CultureInfo.InvariantCulture);
    }
`
      : "";

  let runtimeBlock;

  if (
    graphRuntimeActive ||
    runtimeEntries.length > 0
  ) {
    const startupSynchronizationCalls =
      (
        graphRuntimeActive
          ? runtimeEntries
          : startupEntries
      )
        .map(entry => {
          const field = toPascalCase(
            entry.node.fieldName,
            "Setting"
          );

          return `        Apply${field}();`;
        })
        .join("\n");

    const configurationSynchronizationCalls =
      graphRuntimeActive
        ? runtimeEntries
            .map(entry => {
              const field = toPascalCase(
                entry.node.fieldName,
                "Setting"
              );

              return `        Apply${field}();`;
            })
            .join("\n")
        : "";

    const graphSynchronizedStatement =
      graphRuntimeActive
        ? String(
            graphContribution
              ?.onConfigurationSynchronizedStatement ||
            ""
          ).trim()
        : "";

    const changedBranches =
      observedEntries
        .map(entry => {
          const node = entry.node;
          const field = toPascalCase(
            node.fieldName,
            "Setting"
          );
          const reactsAfterSave =
            graphRuntimeActive &&
            reactionIncludesSaved(
              node.reaction
            );
          const reactionStatement =
            reactsAfterSave
              ? graphContribution
                  ?.reactionStatements?.[
                    node.id
                  ]
              : "";
          const applyCall =
            `Apply${field}();`;
          const reactionCall =
            typeof reactionStatement ===
                "string" &&
              reactionStatement.trim()
              ? `\n${indentGeneratedStatement(
                  reactionStatement.trim(),
                  12
                )}`
              : "";
          const synchronizedCall =
            graphRuntimeActive &&
            graphSynchronizedStatement
              ? `\n${indentGeneratedStatement(
                  graphSynchronizedStatement,
                  12
                )}`
              : "";

          return `        if (ReferenceEquals(
                configurationEvent.Key,
                ${field}) ||
            string.Equals(
                configurationEvent.Key?.Name,
                ${field}.Name,
                StringComparison.Ordinal))
        {
            ${applyCall}${reactionCall}${synchronizedCall}
            return;
        }`;
        })
        .join("\n\n");

    const applyMethods =
      runtimeEntries
        .map(entry => {
          const node = entry.node;
          const field = toPascalCase(
            node.fieldName,
            "Setting"
          );
          const type =
            node.kind === "controller"
              ? toPascalCase(
                  node.enumName,
                  "SettingsPage"
                )
              : node.valueType === "enum"
                ? toPascalCase(
                    node.enumName,
                    "SettingOption"
                  )
                : node.valueType;
          const statements = [
            `_runtime${field} = value;`
          ];

          if (graphRuntimeActive) {
            const syncStatement =
              graphContribution
                ?.syncStatements?.[
                  node.id
                ] ||
              graphContribution
                ?.applyStatements?.[
                  node.id
                ];

            if (
              typeof syncStatement ===
                "string" &&
              syncStatement.trim()
            ) {
              statements.push(
                syncStatement.trim()
              );
            }
          } else {
            statements.push(
              `_ = value; // TODO: Replace only this line with mod-specific logic.`
            );
          }

          return `    private static void Apply${field}()
    {
        ${type} value =
            _configuration.GetValue(
                ${field});

${statements
  .map(statement =>
    indentGeneratedStatement(
      statement,
      8
    )
  )
  .join("\n")}
    }`;
        })
        .join("\n\n");

    const graphInitializeStatement =
      graphRuntimeActive
        ? String(
            graphContribution
              ?.initializeStatement ||
            ""
          ).trim()
        : "";
    const graphEngineInitializedStatement =
      graphRuntimeActive
        ? String(
            graphContribution
              ?.onEngineInitializedStatement ||
            ""
          ).trim()
        : "";

    runtimeBlock = `${runtimeValueDeclarations}

    private static ModConfiguration _configuration = null!;

    public override void OnEngineInit()
    {
        _configuration =
            GetConfiguration();
${graphInitializeStatement
    ? `\n${indentGeneratedStatement(
        graphInitializeStatement,
        8
      )}\n`
    : ""}${observedEntries.length > 0
    ? `
        _configuration.OnThisConfigurationChanged +=
            OnConfigurationChanged;
`
    : ""}
${startupSynchronizationCalls ||
  (graphRuntimeActive
    ? "        // No configuration values require synchronization."
    : "        // No startup value read was requested.")}${graphEngineInitializedStatement
    ? `\n\n${indentGeneratedStatement(
        graphEngineInitializedStatement,
        8
      )}`
    : ""}
    }

${observedEntries.length > 0
    ? `    private static void OnConfigurationChanged(
        ConfigurationChangedEvent configurationEvent)
    {
${configurationSynchronizationCalls ||
  "        // No graph configuration values require synchronization."}

${changedBranches}
    }

`
    : ""}${applyMethods}${runtimeMenuValueSupport}
`;
  } else {
    runtimeBlock = `    public override void OnEngineInit()
    {
        /*
         * No automatic runtime reactions were selected.
         * Read configuration values whenever the mod requires them.
         */
    }
`;
  }

  const orderBranches = entries
    .map(
      entry => {
        const field = toPascalCase(
          entry.node.fieldName,
          "Setting"
        );

        const runtimeOrder =
          usesRuntimeConfigurationMenu
            ? `
            if (${graphContribution.className}.TryGetRuntimeConfigurationMenuOrder(
                    "${escapeCSharp(
                      entry.node.id
                    )}",
                    out int runtimeOrder))
            {
                return runtimeOrder;
            }
`
            : "";

        return `        if (ReferenceEquals(
                key,
                ${field}))
        {
${runtimeOrder}
            return ${outlineOrderById.get(entry.node.id) ?? Number.MAX_SAFE_INTEGER};
        }`;
      }
    )
    .join("\n\n");

  const orderBlock = `
    public int GetConfigurationKeyOrder(
        ModConfigurationKey key)
    {
${orderBranches}

        return int.MaxValue;
    }
`;

  let visibilityBlock = "";
  if (
    hasControllers ||
    usesRuntimeConfigurationMenu
  ) {
    const controllerValues = controllers
      .map(entry => {
        const controller = entry.node;
        const enumName = toPascalCase(
          controller.enumName,
          "SettingsPage"
        );
        const field = toPascalCase(
          controller.fieldName,
          "ActivePage"
        );
        const local = toCamelCase(
          controller.fieldName
        );
        const fallback = enumValueExpression(
          controller.enumName,
          "SettingsPage",
          controller.options,
          controller.defaultOption,
          controller.options[0]
            ?.name ||
            "General"
        );
        return `        ${enumName} ${local} =
            getCurrentValue(
                ${field})
            is ${enumName} current${field}
                ? current${field}
                : ${fallback};`;
      })
      .join("\n\n");
    const keyBranches = entries
      .map(entry => {
        const field = toPascalCase(
          entry.node.fieldName,
          "Setting"
        );
        const expression =
          conditionExpression(
            entry.conditions
          );
        const runtimeVisibility =
          usesRuntimeConfigurationMenu
            ? `
            if (${graphContribution.className}.TryGetRuntimeConfigurationMenuVisibility(
                    "${escapeCSharp(
                      entry.node.id
                    )}",
                    out bool runtimeVisible))
            {
                return runtimeVisible;
            }
`
            : "";

        return `        if (ReferenceEquals(
                key,
                ${field}))
        {
${runtimeVisibility}
            return
                ${expression};
        }`;
      })
      .join("\n\n");
    const controllerChecks =
      controllers
        .map(
          entry =>
            `ReferenceEquals(\n                key,\n                ${toPascalCase(
              entry.node.fieldName,
              "ActivePage"
            )})`
        )
        .join(" ||\n            ") ||
      "false";
    visibilityBlock = `
    public bool IsConfigurationKeyVisible(
        ModConfiguration configuration,
        ModConfigurationKey key,
        Func<ModConfigurationKey, object?>
            getCurrentValue)
    {
${controllerValues}

${keyBranches}

        return false;
    }

    public bool IsConfigurationVisibilityController(
        ModConfigurationKey key)
    {
        return
            ${controllerChecks};
    }
`;
  }

  const runtimeMenuProviderBlock =
    usesRuntimeConfigurationMenu
      ? (() => {
          const keyVisibilityBranches =
            entries
              .map(entry => {
                const field = toPascalCase(
                  entry.node.fieldName,
                  "Setting"
                );

                return `        if (ReferenceEquals(
                key,
                ${field}) ||
            string.Equals(
                key?.Name,
                ${field}.Name,
                StringComparison.Ordinal))
        {
            return ${graphContribution.className}.TryGetRuntimeConfigurationMenuVisibility(
                "${escapeCSharp(
                  entry.node.id
                )}",
                out visible);
        }`;
              })
              .join("\n\n");

          return `
    public void SetRuntimeConfigurationDraftSaveHandler(
        Func<bool>? handler)
    {
        _runtimeConfigurationDraftSaveHandler =
            handler;
    }

    public long RuntimeConfigurationMenuRevision =>
        ${graphContribution.className}.RuntimeConfigurationMenuRevision;

    public long RuntimeConfigurationValueRevision =>
        ${graphContribution.className}.RuntimeConfigurationValueRevision;

    public bool TryGetRuntimeConfigurationKeyVisibility(
        ModConfigurationKey key,
        out bool visible)
    {
${keyVisibilityBranches}

        visible = false;
        return false;
    }

    public bool TryGetRuntimeConfigurationItemVisibility(
        string itemId,
        out bool visible) =>
            ${graphContribution.className}.TryGetRuntimeConfigurationMenuVisibility(
                itemId,
                out visible);

    public bool TryGetRuntimeConfigurationItemOrder(
        string itemId,
        out int order) =>
            ${graphContribution.className}.TryGetRuntimeConfigurationMenuOrder(
                itemId,
                out order);

    public bool TryGetRuntimeConfigurationItemWidthPercent(
        string itemId,
        out float widthPercent) =>
            ${graphContribution.className}.TryGetRuntimeConfigurationMenuWidthPercent(
                itemId,
                out widthPercent);

    public bool TryGetRuntimeConfigurationItemLabelVisibility(
        string itemId,
        out bool visible) =>
            ${graphContribution.className}.TryGetRuntimeConfigurationMenuLabelVisibility(
                itemId,
                out visible);
`;
        })()
      : "";

  const layoutProviderBlock =
    layoutRows.length > 0
      ? (() => {
          const layoutItems =
            layoutRows.flatMap(entry => {
              const row = entry.node;
              const stored =
                Array.isArray(
                  row.layoutItemMetadata
                )
                  ? row.layoutItemMetadata
                  : (row.children || []).map(
                      child => ({
                        id: child?.id,
                        widthPercent:
                          effectiveInlineRowWidthPercent(
                            child,
                            {
                              row,
                              children:
                                row.children || [],
                              index: 0
                            }
                          ),
                        hideLabel:
                          child?.hideLabel === true
                      })
                    );

              return stored
                .filter(item =>
                  String(item?.id || "")
                )
                .map(item => ({
                  id: String(item.id),
                  widthPercent: clamp(
                    Number(item.widthPercent) ||
                      100,
                    1,
                    100
                  ),
                  hideLabel:
                    item.hideLabel === true
                }));
            });

          const groups = layoutRows
            .map(entry => {
              const row = entry.node;
              const itemIds = (
                Array.isArray(row.layoutItemIds)
                  ? row.layoutItemIds
                  : (row.children || [])
                      .filter(child =>
                        child?.kind === "setting" ||
                        child?.kind === "controller"
                      )
                      .map(child => child.id)
              )
                .map(itemId =>
                  `"${escapeCSharp(itemId)}"`
                )
                .join(", ");
              const horizontal =
                row.horizontal === false
                  ? "false"
                  : "true";
              const effectiveHorizontal =
                usesRuntimeConfigurationMenu
                  ? `GetRuntimeConfigurationLayoutOrDefault(
                    "${escapeCSharp(row.id)}",
                    ${horizontal})`
                  : horizontal;

              return `            new ModConfigurationLayoutGroup(
                "${escapeCSharp(row.id)}",
                "${escapeCSharp(row.label || "Inline Row")}",
                ${outlineOrderById.get(row.id) ?? 0},
                ${effectiveHorizontal},
                new string[] { ${itemIds} })`;
            })
            .join(",\n");

          const groupVisibilityBranches =
            layoutRows
              .map(entry => {
                const row = entry.node;

                return `        if (string.Equals(
                groupId,
                "${escapeCSharp(row.id)}",
                StringComparison.Ordinal))
        {
            visible = ${row.hidden === true ? "false" : "true"};
            return true;
        }`;
              })
              .join("\n\n");

          const keyItemBranches = entries
            .map(entry => {
              const field = toPascalCase(
                entry.node.fieldName,
                "Setting"
              );

              return `        if (ReferenceEquals(
                key,
                ${field}) ||
            string.Equals(
                key?.Name,
                ${field}.Name,
                StringComparison.Ordinal))
        {
            itemId = "${escapeCSharp(entry.node.id)}";
            return true;
        }`;
            })
            .join("\n\n");

          const widthBranches =
            layoutItems
              .map(item => {
                const width =
                  Number(item.widthPercent)
                    .toFixed(3)
                    .replace(/\.?0+$/, "");

                return `        if (string.Equals(
                itemId,
                "${escapeCSharp(item.id)}",
                StringComparison.Ordinal))
        {
            widthPercent = ${width}f;
            return true;
        }`;
              })
              .join("\n\n");

          const labelBranches =
            layoutItems
              .map(item =>
                `        if (string.Equals(
                itemId,
                "${escapeCSharp(item.id)}",
                StringComparison.Ordinal))
        {
            visible = ${item.hideLabel ? "false" : "true"};
            return true;
        }`
              )
              .join("\n\n");

          const runtimeLayoutHelper =
            usesRuntimeConfigurationMenu
              ? `
    private static bool GetRuntimeConfigurationLayoutOrDefault(
        string itemId,
        bool fallback) =>
            ${graphContribution.className}.TryGetRuntimeConfigurationMenuHorizontalLayout(
                itemId,
                out bool horizontal)
                ? horizontal
                : fallback;
`
              : "";

          return `
    public System.Collections.Generic.IReadOnlyList<ModConfigurationLayoutGroup>
        GetConfigurationLayoutGroups() =>
        new ModConfigurationLayoutGroup[]
        {
${groups}
        };

    public bool TryGetConfigurationLayoutItemId(
        ModConfigurationKey key,
        out string itemId)
    {
${keyItemBranches}

        itemId = string.Empty;
        return false;
    }

    public bool TryGetConfigurationLayoutGroupVisibility(
        string groupId,
        out bool visible)
    {
${groupVisibilityBranches}

        visible = true;
        return false;
    }

    public bool TryGetConfigurationLayoutItemWidthPercent(
        string itemId,
        out float widthPercent)
    {
${widthBranches}

        widthPercent = 0f;
        return false;
    }

    public bool TryGetConfigurationLayoutItemLabelVisibility(
        string itemId,
        out bool visible)
    {
${labelBranches}

        visible = true;
        return false;
    }
${runtimeLayoutHelper}`;
        })()
      : "";

  return `${guide}${usingLines}

namespace ${namespaceName};

${enums ? `${enums}\n\n` : ""}/// <summary>
/// ${csharpSingleLineCommentText(
  metadata.description
)}
/// </summary>
public sealed partial class ${className}
    : ResoniteMod${interfaceSuffix}
{
    public override string Name =>
        "${escapeCSharp(
          metadata.modName
        )}";

    public override string Author =>
        "${escapeCSharp(
          metadata.author
        )}";

    public override string Version =>
        "${escapeCSharp(
          metadata.version
        )}";

${declarations}
${runtimeBlock}${runtimeUnloadLifecycleBlock}${orderBlock}${visibilityBlock}${runtimeMenuProviderBlock}${layoutProviderBlock}}
`;
}

function generateProjectFile() {
  const settings = currentFlattenedNodes()
    .filter(entry => entry.node.kind === "setting");
  const graphContribution =
    getTypedNodeGraphContribution();
  const graphRequirements =
    graphContribution?.requirements || {};
  const usesElements =
    settings.some(entry =>
      [
        "colorX",
        "int2",
        "int3",
        "int4",
        "float2",
        "float3",
        "float4",
        "double2",
        "double3",
        "double4"
      ].includes(entry.node.valueType)
    ) ||
    graphRequirements.usesElements === true;
  const usesRenderiteShared =
    settings.some(
      entry => entry.node.valueType === "colorX"
    ) ||
    graphRequirements.usesRenderiteShared === true;
  const className = generatedBaseName();
  const namespaceName =
    state.metadata.namespaceName
      .split(".")
      .map(part => toPascalCase(part, "Namespace"))
      .join(".") ||
    "YourModNamespace";
  const resonitePath = escapeXml(
    normalizedResonitePath(
      state.exportOptions.resonitePath
    )
  );

  const referenceMap = new Map();

  const addReference = reference => {
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

    referenceMap.set(
      include.toLowerCase(),
      {
        include,
        hintPath:
          String(
            reference.hintPath || ""
          ).trim(),
        private:
          reference.private === true
      }
    );
  };

  if (usesElements) {
    addReference({
      include: "Elements.Core",
      hintPath:
        "$(ResonitePath)Elements.Core.dll"
    });
  }

  if (usesRenderiteShared) {
    addReference({
      include: "Renderite.Shared",
      hintPath:
        "$(ResonitePath)Renderite.Shared.dll"
    });
  }

  for (
    const reference of
    Array.isArray(
      graphRequirements.references
    )
      ? graphRequirements.references
      : []
  ) {
    addReference(reference);
  }

  const optionalReferences =
    [...referenceMap.values()]
      .map(reference => {
        const include =
          escapeXml(reference.include);
        const hintPath =
          escapeXml(reference.hintPath);
        const privateValue =
          reference.private
            ? "True"
            : "False";

        if (!hintPath) {
          return `    <Reference Include="${include}" />`;
        }

        return `    <Reference Include="${include}">
      <HintPath>${hintPath}</HintPath>
      <Private>${privateValue}</Private>
    </Reference>`;
      })
      .join("\n\n");

  const packageMap = new Map();

  for (
    const packageReference of
    Array.isArray(
      graphRequirements.packageReferences
    )
      ? graphRequirements.packageReferences
      : []
  ) {
    if (
      !packageReference ||
      typeof packageReference !== "object"
    ) {
      continue;
    }

    const include = String(
      packageReference.include || ""
    ).trim();
    const version = String(
      packageReference.version || ""
    ).trim();

    if (!include || !version) {
      continue;
    }

    packageMap.set(
      include.toLowerCase(),
      {
        include,
        version,
        privateAssets:
          String(
            packageReference.privateAssets || ""
          ).trim(),
        includeAssets:
          String(
            packageReference.includeAssets || ""
          ).trim()
      }
    );
  }

  const packageReferences =
    [...packageMap.values()]
      .map(packageReference => {
        const attributes = [
          `Include="${escapeXml(
            packageReference.include
          )}"`,
          `Version="${escapeXml(
            packageReference.version
          )}"`
        ];

        if (packageReference.privateAssets) {
          attributes.push(
            `PrivateAssets="${escapeXml(
              packageReference.privateAssets
            )}"`
          );
        }

        if (packageReference.includeAssets) {
          attributes.push(
            `IncludeAssets="${escapeXml(
              packageReference.includeAssets
            )}"`
          );
        }

        return `    <PackageReference ${attributes.join(
          " "
        )} />`;
      })
      .join("\n");

  const frameworkReferences =
    (Array.isArray(
      graphRequirements.frameworkReferences
    )
      ? graphRequirements.frameworkReferences
      : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .map(
        value =>
          `    <FrameworkReference Include="${escapeXml(
            value
          )}" />`
      )
      .join("\n");

  const allowUnsafeBlocks =
    graphRequirements.allowUnsafeBlocks === true;
  const useWindowsForms =
    graphRequirements.useWindowsForms === true;
  const targetFramework =
    useWindowsForms
      ? "net10.0-windows"
      : "net10.0";

  return `<Project Sdk="Microsoft.NET.Sdk">
  <!--
    Current Resonite and RML 4.2/5.x use net10.0.
    Older targets require matching older Resonite and RML assemblies.
  -->
  <PropertyGroup>
    <TargetFramework>${targetFramework}</TargetFramework>
    <LangVersion>14.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>${allowUnsafeBlocks
      ? "\n    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>"
      : ""}${useWindowsForms
      ? "\n    <UseWindowsForms>true</UseWindowsForms>\n    <EnableWindowsTargeting>true</EnableWindowsTargeting>"
      : ""}

    <AssemblyName>${escapeXml(className)}</AssemblyName>
    <RootNamespace>${escapeXml(namespaceName)}</RootNamespace>

    <ResonitePath Condition="'$(ResonitePath)' == ''">${resonitePath}</ResonitePath>
    <ResonitePath>$([MSBuild]::NormalizeDirectory('$(ResonitePath)'))</ResonitePath>
    <DeployToResonite Condition="'$(DeployToResonite)' == ''">true</DeployToResonite>
  </PropertyGroup>

  <ItemGroup>
    <Reference Include="ResoniteModLoader">
      <HintPath>$(ResonitePath)Libraries/ResoniteModLoader.dll</HintPath>
      <Private>False</Private>
    </Reference>

    <Reference Include="FrooxEngine">
      <HintPath>$(ResonitePath)FrooxEngine.dll</HintPath>
      <Private>False</Private>
    </Reference>${optionalReferences
      ? `\n\n${optionalReferences}`
      : ""}
  </ItemGroup>${packageReferences
    ? `\n\n  <ItemGroup>\n${packageReferences}\n  </ItemGroup>`
    : ""}${frameworkReferences
    ? `\n\n  <ItemGroup>\n${frameworkReferences}\n  </ItemGroup>`
    : ""}

  <Target
    Name="DeployRmlMod"
    AfterTargets="Build"
    Condition="'$(DeployToResonite)' == 'true'">
    <MakeDir Directories="$(ResonitePath)rml_mods" />
    <MakeDir Directories="$(ResonitePath)rml_libs" />
    <Copy
      SourceFiles="$(TargetPath)"
      DestinationFolder="$(ResonitePath)rml_mods"
      SkipUnchangedFiles="true" />
    <Copy
      SourceFiles="@(ReferenceCopyLocalPaths)"
      DestinationFolder="$(ResonitePath)rml_libs"
      SkipUnchangedFiles="true" />
  </Target>
</Project>
`;
}

function generateAuxiliaryProjectFile(
  project
) {
  const requirements =
    isPlainObject(project?.requirements)
      ? project.requirements
      : {};
  const assemblyName = String(
    project?.assemblyName ||
    project?.name ||
    `${generatedBaseName()}.Library`
  ).trim();
  const rootNamespace = String(
    project?.rootNamespace ||
    state.metadata.namespaceName ||
    "GeneratedLibrary"
  ).trim();
  const deployDirectory = String(
    project?.deployDirectory ||
    "rml_libs"
  )
    .replace(/[\\/]+/g, "")
    .trim() ||
    "rml_libs";
  const resonitePath = escapeXml(
    normalizedResonitePath(
      state.exportOptions.resonitePath
    )
  );
  const referenceMap = new Map();

  const addReference = reference => {
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

    referenceMap.set(
      include.toLowerCase(),
      {
        include,
        hintPath: String(
          reference.hintPath || ""
        ).trim(),
        private:
          reference.private === true
      }
    );
  };

  addReference({
    include: "ResoniteModLoader",
    hintPath:
      "$(ResonitePath)Libraries/ResoniteModLoader.dll",
    private: false
  });
  addReference({
    include: "FrooxEngine",
    hintPath:
      "$(ResonitePath)FrooxEngine.dll",
    private: false
  });

  if (requirements.usesElements === true) {
    addReference({
      include: "Elements.Core",
      hintPath:
        "$(ResonitePath)Elements.Core.dll",
      private: false
    });
  }

  if (
    requirements.usesRenderiteShared ===
    true
  ) {
    addReference({
      include: "Renderite.Shared",
      hintPath:
        "$(ResonitePath)Renderite.Shared.dll",
      private: false
    });
  }

  for (
    const reference of
    Array.isArray(requirements.references)
      ? requirements.references
      : []
  ) {
    addReference(reference);
  }

  const references =
    [...referenceMap.values()]
      .map(reference => {
        const include = escapeXml(
          reference.include
        );
        const hintPath = escapeXml(
          reference.hintPath
        );
        const privateValue =
          reference.private
            ? "True"
            : "False";

        return hintPath
          ? `    <Reference Include="${include}">
      <HintPath>${hintPath}</HintPath>
      <Private>${privateValue}</Private>
    </Reference>`
          : `    <Reference Include="${include}" />`;
      })
      .join("\n\n");

  const packageReferences =
    (Array.isArray(
      requirements.packageReferences
    )
      ? requirements.packageReferences
      : [])
      .filter(packageReference =>
        packageReference &&
        String(
          packageReference.include || ""
        ).trim() &&
        String(
          packageReference.version || ""
        ).trim()
      )
      .map(packageReference => {
        const attributes = [
          `Include="${escapeXml(
            packageReference.include
          )}"`,
          `Version="${escapeXml(
            packageReference.version
          )}"`
        ];

        if (packageReference.privateAssets) {
          attributes.push(
            `PrivateAssets="${escapeXml(
              packageReference.privateAssets
            )}"`
          );
        }

        if (packageReference.includeAssets) {
          attributes.push(
            `IncludeAssets="${escapeXml(
              packageReference.includeAssets
            )}"`
          );
        }

        return `    <PackageReference ${attributes.join(
          " "
        )} />`;
      })
      .join("\n");

  const frameworkReferences =
    (Array.isArray(
      requirements.frameworkReferences
    )
      ? requirements.frameworkReferences
      : [])
      .map(value => String(value || "").trim())
      .filter(Boolean)
      .map(value =>
        `    <FrameworkReference Include="${escapeXml(
          value
        )}" />`
      )
      .join("\n");

  const useWindowsForms =
    requirements.useWindowsForms === true;
  const targetFramework =
    useWindowsForms
      ? "net10.0-windows"
      : "net10.0";

  return `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>${targetFramework}</TargetFramework>
    <LangVersion>14.0</LangVersion>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <CopyLocalLockFileAssemblies>true</CopyLocalLockFileAssemblies>${requirements.allowUnsafeBlocks === true
      ? "\n    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>"
      : ""}${useWindowsForms
      ? "\n    <UseWindowsForms>true</UseWindowsForms>\n    <EnableWindowsTargeting>true</EnableWindowsTargeting>"
      : ""}

    <AssemblyName>${escapeXml(
      assemblyName
    )}</AssemblyName>
    <RootNamespace>${escapeXml(
      rootNamespace
    )}</RootNamespace>

    <ResonitePath Condition="'$(ResonitePath)' == ''">${resonitePath}</ResonitePath>
    <ResonitePath>$([MSBuild]::NormalizeDirectory('$(ResonitePath)'))</ResonitePath>
    <DeployToResonite Condition="'$(DeployToResonite)' == ''">true</DeployToResonite>
  </PropertyGroup>

  <ItemGroup>
${references}
  </ItemGroup>${packageReferences
    ? `\n\n  <ItemGroup>\n${packageReferences}\n  </ItemGroup>`
    : ""}${frameworkReferences
    ? `\n\n  <ItemGroup>\n${frameworkReferences}\n  </ItemGroup>`
    : ""}

  <Target
    Name="DeployRmlLibrary"
    AfterTargets="Build"
    Condition="'$(DeployToResonite)' == 'true'">
    <MakeDir Directories="$(ResonitePath)${escapeXml(
      deployDirectory
    )}" />
    <MakeDir Directories="$(ResonitePath)rml_libs" />
    <Copy
      SourceFiles="$(TargetPath)"
      DestinationFolder="$(ResonitePath)${escapeXml(
        deployDirectory
      )}"
      SkipUnchangedFiles="true" />
    <Copy
      SourceFiles="@(ReferenceCopyLocalPaths)"
      DestinationFolder="$(ResonitePath)rml_libs"
      SkipUnchangedFiles="true" />
  </Target>
</Project>
`;
}

function getDiagnostics() {
  const entries = currentFlattenedNodes();
  const errors = [];
  const fieldNames = new Map();
  const keyNames = new Map();
  const enumNames = new Map();
  if (!state.metadata.modName.trim()) errors.push("Mod name is required.");
  if (!state.metadata.author.trim()) errors.push("Author is required.");
  for (const entry of entries) {
    const node = entry.node;
    if (node.kind === LAYOUT_ROW_KIND) {
      if ((node.children || []).length < 2) {
        errors.push(
          `${node.label || "Inline Row"}: add at least two items to display side by side.`
        );
      }
      if (
        (node.children || []).some(
          child => child?.kind === LAYOUT_ROW_KIND
        )
      ) {
        errors.push(
          `${node.label || "Inline Row"}: nested inline rows are not supported.`
        );
      }
      continue;
    }
    const field = toPascalCase(node.fieldName, "Setting");
    fieldNames.set(field, (fieldNames.get(field) || 0) + 1);
    keyNames.set(node.keyName, (keyNames.get(node.keyName) || 0) + 1);
    if (!node.keyName.trim()) {
      errors.push(`${field}: configuration key is empty.`);
    }
    if (node.kind === "controller") {
      const enumName = toPascalCase(node.enumName, "SettingsPage");
      enumNames.set(enumName, (enumNames.get(enumName) || 0) + 1);
      if (node.options.length < 2) {
        errors.push(`${field}: a section enum needs at least two options.`);
      }
      if (
        !node.options.some(
          option =>
            toPascalCase(option.name) ===
            toPascalCase(node.defaultOption)
        )
      ) {
        errors.push(`${field}: select an existing default section.`);
      }
      const optionNames = new Set();
      for (const option of node.options) {
        const safeName = toPascalCase(option.name, "Page");
        if (optionNames.has(safeName)) {
          errors.push(`${field}: duplicate section name ${safeName}.`);
        }
        optionNames.add(safeName);
      }
    } else {
      const componentType =
        numericComponentType(
          node.valueType
        );

      if (
        isScalarNumericType(
          node.valueType
        ) &&
        !isValidNumericLiteral(
          node.defaultValue,
          node.valueType
        )
      ) {
        errors.push(
          `${field}: default value is not a valid ${node.valueType} literal.`
        );
      }

      if (isVectorType(node.valueType)) {
        const components =
          node.defaultValue
            .split(",")
            .map(value => value.trim());
        const expected =
          componentCount(
            node.valueType
          );

        if (
          components.length !== expected ||
          components.some(
            value =>
              !isValidNumericLiteral(
                value,
                componentType
              )
          )
        ) {
          errors.push(
            `${field}: ${node.valueType} requires exactly ${expected} valid ${componentType} values.`
          );
        }
      }

      if (
        node.valueType === "bool" &&
        !["true", "false"].includes(
          node.defaultValue
            .trim()
            .toLowerCase()
        )
      ) {
        errors.push(
          `${field}: bool must be true or false.`
        );
      }

      if (node.valueType === "enum") {
        const enumName = toPascalCase(node.enumName, "SettingOption");
        enumNames.set(enumName, (enumNames.get(enumName) || 0) + 1);
        if (node.enumOptions.length < 1) {
          errors.push(`${field}: enum needs at least one option.`);
        }
        if (
          !node.enumOptions.some(
            option =>
              toPascalCase(option) ===
              toPascalCase(
                node.defaultValue
              )
          )
        ) {
          errors.push(
            `${field}: select an existing enum default value.`
          );
        }
      }

      const usesRange =
        (supportsSlider(node) &&
          node.useSlider) ||
        node.validatorMode === "range";

      if (
        usesRange &&
        (!isValidNumericLiteral(
          node.minimum,
          node.valueType
        ) ||
          !isValidNumericLiteral(
            node.maximum,
            node.valueType
          ))
      ) {
        errors.push(
          `${field}: minimum and maximum must be valid ${node.valueType} values.`
        );
      } else if (
        usesRange &&
        numericLiteralNumber(
          node.minimum
        ) >=
          numericLiteralNumber(
            node.maximum
          )
      ) {
        errors.push(`${field}: maximum must exceed its minimum.`);
      }
      if (
        node.validatorMode === "custom" &&
        !node.customValidator.trim()
      ) {
        errors.push(`${field}: custom validator is empty.`);
      }
    }
  }
  for (const [field, count] of fieldNames) {
    if (count > 1) errors.push(`Duplicate C# field name: ${field}.`);
  }
  for (const [key, count] of keyNames) {
    if (count > 1) errors.push(`Duplicate configuration key: ${key}.`);
  }
  for (const [enumName, count] of enumNames) {
    if (count > 1) errors.push(`Duplicate enum type name: ${enumName}.`);
  }

  const graphContribution =
    getTypedNodeGraphContribution();

  for (
    const diagnostic of
    graphContribution?.diagnostics || []
  ) {
    errors.push(
      `Node graph: ${diagnostic}`
    );
  }

  const sourceVerifier =
    window.RMLTypedNodeGraphGenerator
      ?.verifyGeneratedSource;
  if (
    typeof sourceVerifier === "function" &&
    graphContribution?.pending !== true
  ) {
    const mainFileName =
      `${generatedBaseName()}.cs`;
    for (const diagnostic of
      sourceVerifier(
        generateCode(),
        mainFileName,
        { checkUnresolved: false }
      )) {
      errors.push(
        `Generated source: ${diagnostic}`
      );
    }
  }

  return errors;
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function projectString(
  value,
  fallback = ""
) {
  return typeof value === "string"
    ? value
    : fallback;
}

function normalizeBuilderPage(value) {
  return value === "runtime-graph"
    ? "runtime-graph"
    : "configuration-outline";
}

function canonicalProjectFingerprintValue(
  value,
  path = []
) {
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      canonicalProjectFingerprintValue(
        entry,
        [...path, String(index)]
      )
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const result = {};
    for (const key of
      Object.keys(value).sort()) {
      const rootSavedAt =
        path.length === 0 &&
        key === "savedAt";
      const workspacePage =
        path.length === 1 &&
        path[0] === "workspace" &&
        key === "activePage";
      const legacyGraphPage =
        path.length === 2 &&
        path[0] === "extensions" &&
        path[1] === "typedNodeGraph" &&
        key === "lastOpenPage";

      if (
        rootSavedAt ||
        workspacePage ||
        legacyGraphPage
      ) {
        continue;
      }

      result[key] =
        canonicalProjectFingerprintValue(
          value[key],
          [...path, key]
        );
    }
    return result;
  }

  return value;
}

function projectContentFingerprint(value) {
  const text = JSON.stringify(
    canonicalProjectFingerprintValue(
      value
    )
  );
  let first = 2166136261;
  let second = 2246822507;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 3266489909);
  }

  return `project-v1-${text.length.toString(36)}-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeProjectId(value) {
  const candidate =
    typeof value === "string"
      ? value.trim()
      : "";
  return /^[a-z0-9][a-z0-9._:-]{7,159}$/i
    .test(candidate)
      ? candidate
      : "";
}

function createFreshProjectId() {
  const randomUuid =
    globalThis.crypto?.randomUUID?.();
  if (randomUuid) {
    return `rml-${randomUuid}`;
  }

  return `rml-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

function projectIdFromSource(source) {
  const explicit = normalizeProjectId(
    source?.projectId
  );
  if (explicit) {
    return explicit;
  }

  
  
  
  
  return `legacy-${projectContentFingerprint(source)}`;
}

function projectIdentityFingerprint(
  projectId
) {
  const text = normalizeProjectId(
    projectId
  );
  let first = 2166136261;
  let second = 2246822507;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 3266489909);
  }

  return `identity-v1-${text.length.toString(36)}-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

const pageStateTrace = [];
let pageStateTraceSequence = 0;

function recordPageState(
  stage,
  detail = {}
) {
  const entry = Object.freeze({
    sequence: ++pageStateTraceSequence,
    stage: String(stage || "unknown"),
    activePage:
      normalizeBuilderPage(
        state.activePage
      ),
    graphLastOpenPage:
      state.extensions?.typedNodeGraph
        ?.lastOpenPage || null,
    graphActive:
      state.extensions?.typedNodeGraph
        ?.active === true,
    visiblePage:
      document.body?.classList?.contains(
        "rml-node-graph-mode"
      )
        ? "runtime-graph"
        : "configuration-outline",
    detail: clone(detail || {})
  });

  pageStateTrace.push(entry);
  if (pageStateTrace.length > 512) {
    pageStateTrace.shift();
  }
  console.debug(
    "[RML Page State]",
    entry
  );
  return entry;
}

function readPageStateStore() {
  try {
    const raw = localStorage.getItem(
      ACTIVE_PAGE_STORAGE_KEY
    );
    const parsed = raw
      ? JSON.parse(raw)
      : null;

    if (
      parsed &&
      parsed.version === 2 &&
      isPlainObject(parsed.jsonPages)
    ) {
      return {
        version: 2,
        activePage:
          normalizeBuilderPage(
            parsed.activePage
          ),
        jsonPages: {
          ...parsed.jsonPages
        }
      };
    }
  } catch {
  }

  return {
    version: 2,
    activePage:
      "configuration-outline",
    jsonPages: {}
  };
}

function writePageStateStore(
  store,
  stage,
  detail = {}
) {
  try {
    localStorage.setItem(
      ACTIVE_PAGE_STORAGE_KEY,
      JSON.stringify(store)
    );
    recordPageState(stage, detail);
    return true;
  } catch (error) {
    recordPageState(
      `${stage}-failed`,
      {
        ...detail,
        message:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
    return false;
  }
}

function writePageStateMarker(
  page = state.activePage,
  reason = "state-update"
) {
  const normalized =
    normalizeBuilderPage(page);
  const store = readPageStateStore();
  store.activePage = normalized;
  return writePageStateStore(
    store,
    "marker.write-active",
    { page: normalized, reason }
  );
}

function readPageStateMarker() {
  const page = normalizeBuilderPage(
    readPageStateStore().activePage
  );
  recordPageState(
    "marker.read-active",
    { page }
  );
  return page;
}

function rememberJsonPage(
  fingerprint,
  page,
  reason = "json-save"
) {
  const key = String(fingerprint || "");
  if (!key) {
    return false;
  }

  const store = readPageStateStore();
  const normalized =
    normalizeBuilderPage(page);
  store.activePage = normalized;
  store.jsonPages[key] = {
    page: normalized,
    usedAt: Date.now()
  };

  const entries = Object.entries(
    store.jsonPages
  );
  if (entries.length > 128) {
    entries
      .sort(
        (left, right) =>
          Number(right[1]?.usedAt || 0) -
          Number(left[1]?.usedAt || 0)
      )
      .slice(128)
      .forEach(([oldKey]) => {
        delete store.jsonPages[oldKey];
      });
  }

  return writePageStateStore(
    store,
    "marker.write-json",
    {
      fingerprint: key,
      page: normalized,
      reason
    }
  );
}

function retainOnlyJsonPage(
  fingerprint,
  page,
  reason = "project-replacement"
) {
  const key = String(
    fingerprint || ""
  );
  const normalized =
    normalizeBuilderPage(page);
  const store = readPageStateStore();

  store.activePage = normalized;
  store.jsonPages = key
    ? {
        [key]: {
          page: normalized,
          usedAt: Date.now()
        }
      }
    : {};

  return writePageStateStore(
    store,
    "marker.retain-current-json",
    {
      fingerprint: key,
      page: normalized,
      reason
    }
  );
}

function pageForJsonFingerprint(
  fingerprint
) {
  const key = String(fingerprint || "");
  const entry = key
    ? readPageStateStore()
        .jsonPages[key]
    : null;
  const page =
    entry &&
    (
      entry.page === "runtime-graph" ||
      entry.page === "configuration-outline"
    )
      ? entry.page
      : null;

  recordPageState(
    "marker.read-json",
    {
      fingerprint: key,
      matched: Boolean(page),
      page
    }
  );
  return page;
}

function visibleBuilderPage() {
  const hostPage =
    window.RMLDynamicGraphHost
      ?.getPresentationState?.()
      ?.page;

  if (
    hostPage === "runtime-graph" ||
    hostPage === "configuration-outline"
  ) {
    return hostPage;
  }

  return document.body?.classList?.contains(
    "rml-node-graph-mode"
  )
    ? "runtime-graph"
    : "configuration-outline";
}

function setBuilderActivePage(
  page,
  {
    persistImmediately = false,
    reason = "page-change",
    writeMarker = true
  } = {}
) {
  const normalized =
    normalizeBuilderPage(page);
  const changed =
    state.activePage !== normalized;
  state.activePage = normalized;

  if (writeMarker) {
    const projectFingerprint =
      projectIdentityFingerprint(
        state.projectId
      );
    if (projectFingerprint) {
      rememberJsonPage(
        projectFingerprint,
        normalized,
        reason
      );
    } else {
      writePageStateMarker(
        normalized,
        reason
      );
    }
  }

  recordPageState(
    "workspace.page-set",
    {
      page: normalized,
      changed,
      reason,
      persistImmediately
    }
  );

  if (changed) {
    persist(persistImmediately);
  }

  return normalized;
}

function captureVisibleBuilderPage(
  reason,
  persistImmediately = true
) {
  return setBuilderActivePage(
    visibleBuilderPage(),
    {
      persistImmediately,
      reason
    }
  );
}

Object.defineProperty(
  window,
  "RMLPageStateDiagnostics",
  {
    value: Object.freeze({
      record: recordPageState,
      getSnapshot() {
        return Object.freeze(
          pageStateTrace.map(entry =>
            Object.freeze({ ...entry })
          )
        );
      },
      getCurrent() {
        return Object.freeze({
          workspacePage:
            normalizeBuilderPage(
              state.activePage
            ),
          graphPage:
            state.extensions
              ?.typedNodeGraph
              ?.lastOpenPage || null,
          visiblePage:
            visibleBuilderPage()
        });
      },
      clear() {
        pageStateTrace.length = 0;
        return true;
      }
    }),
    writable: false,
    enumerable: true,
    configurable: true
  }
);

function createProjectDocument(
  includeSavedAt = false,
  detached = true,
  {
    includePresentationState = true
  } = {}
) {
  const snapshot = value =>
    detached
      ? clone(value)
      : value;

  const projectDocument = {
    format: PROJECT_FORMAT,
    formatVersion:
      PROJECT_FORMAT_VERSION,
    projectId: state.projectId,
    ...(includeSavedAt
      ? {
          savedAt:
            new Date().toISOString()
        }
      : {}),
    metadata: snapshot(
      state.metadata
    ),
    exportOptions: snapshot(
      state.exportOptions
    ),
    nodes: snapshot(
      state.nodes
    ),
    extensions: snapshot(
      isPlainObject(state.extensions)
        ? state.extensions
        : {}
    ),
    workspace: {
      activePage:
        normalizeBuilderPage(
          state.activePage
        ),
      selectedId:
        state.selectedId,
      activeContainerId:
        state.activeContainerId,
      collapsedPaletteGroups:
        [...state.collapsedPaletteGroups]
    }
  };

  if (!includePresentationState) {
    delete projectDocument.workspace
      .activePage;

    const graph =
      projectDocument.extensions
        ?.typedNodeGraph;
    if (
      graph &&
      typeof graph === "object" &&
      !Array.isArray(graph)
    ) {
      const portableGraph = {
        ...graph
      };
      delete portableGraph.lastOpenPage;
      projectDocument.extensions = {
        ...projectDocument.extensions,
        typedNodeGraph:
          portableGraph
      };
    }
  }

  return projectDocument;
}

function sanitizeProjectNodes(
  nodes
) {
  if (!Array.isArray(nodes)) {
    throw new Error(
      "The project does not contain a valid nodes array."
    );
  }

  const knownTypes =
    new Set(
      TYPE_DEFINITIONS.map(
        definition =>
          definition.type
      )
    );
  const knownReactions =
    new Set([
      "stored",
      "startup",
      "saved",
      "startup-saved"
    ]);
  const usedIds =
    new Set();
  let itemCount = 0;

  const takeId = (
    value,
    label
  ) => {
    if (
      typeof value !== "string" ||
      value.length === 0
    ) {
      throw new Error(
        `${label} has no valid identifier.`
      );
    }

    if (usedIds.has(value)) {
      throw new Error(
        `The identifier '${value}' occurs more than once.`
      );
    }

    usedIds.add(value);
    return value;
  };

  const sanitizeList = (
    list,
    depth
  ) => {
    if (
      depth >
      PROJECT_TREE_MAX_DEPTH
    ) {
      throw new Error(
        `The project exceeds the maximum section depth of ${PROJECT_TREE_MAX_DEPTH}.`
      );
    }

    return list.map(
      (sourceNode, index) => {
        itemCount += 1;

        if (
          itemCount >
          PROJECT_TREE_MAX_ITEMS
        ) {
          throw new Error(
            `The project contains more than ${PROJECT_TREE_MAX_ITEMS} items.`
          );
        }

        if (!isPlainObject(sourceNode)) {
          throw new Error(
            `Item ${index + 1} is not a valid project item.`
          );
        }

        const id =
          takeId(
            sourceNode.id,
            `Item ${index + 1}`
          );

        if (
          sourceNode.kind ===
            LAYOUT_ROW_KIND ||
          isLegacyLayoutRowNode(
            sourceNode
          )
        ) {
          const children =
            Array.isArray(
              sourceNode.children
            )
              ? sourceNode.children
              : [];

          if (
            children.some(
              child =>
                child?.kind ===
                  LAYOUT_ROW_KIND ||
                isLegacyLayoutRowNode(
                  child
                )
            )
          ) {
            throw new Error(
              `Inline row '${id}' cannot directly contain another inline row.`
            );
          }

          return {
            ...normalizeLayoutRowNode(
              {
                ...sourceNode,
                id
              },
              sanitizeList(
                children,
                depth + 1
              )
            ),
            layoutItemIds: undefined,
          };
        }

        if (
          sourceNode.kind ===
          "controller"
        ) {
          if (
            !Array.isArray(
              sourceNode.options
            ) ||
            sourceNode.options.length <
              1
          ) {
            throw new Error(
              `Section '${projectString(
                sourceNode.fieldName,
                id
              )}' has no valid options.`
            );
          }

          const options =
            sourceNode.options.map(
              (
                sourceOption,
                optionIndex
              ) => {
                if (
                  !isPlainObject(
                    sourceOption
                  )
                ) {
                  throw new Error(
                    `Option ${optionIndex + 1} in section '${id}' is invalid.`
                  );
                }

                const optionId =
                  takeId(
                    sourceOption.id,
                    `Option ${optionIndex + 1} in section '${id}'`
                  );
                const children =
                  Array.isArray(
                    sourceOption.children
                  )
                    ? sourceOption.children
                    : [];

                return {
                  ...sourceOption,
                  id: optionId,
                  name: projectString(
                    sourceOption.name,
                    `Option${optionIndex + 1}`
                  ),
                  children:
                    sanitizeList(
                      children,
                      depth + 1
                    )
                };
              }
            );
          const defaultOption =
            projectString(
              sourceNode.defaultOption,
              options[0].name
            );

          return {
            ...sourceNode,
            id,
            kind: "controller",
            fieldName:
              projectString(
                sourceNode.fieldName,
                "ActivePage"
              ),
            keyName:
              projectString(
                sourceNode.keyName,
                "00_active_page"
              ),
            description:
              projectString(
                sourceNode.description,
                "Selects the visible settings section."
              ),
            layoutWidthPercent:
              Number.isFinite(
                Number(
                  sourceNode.layoutWidthPercent
                )
              ) &&
              Number(
                sourceNode.layoutWidthPercent
              ) > 0
                ? clamp(
                    Number(
                      sourceNode.layoutWidthPercent
                    ),
                    1,
                    100
                  )
                : undefined,
            hideLabel:
              sourceNode.hideLabel === true,
            enumName:
              projectString(
                sourceNode.enumName,
                "SettingsPage"
              ),
            defaultOption,
            reaction:
              knownReactions.has(
                sourceNode.reaction
              )
                ? sourceNode.reaction
                : "stored",
            options
          };
        }

        if (
          sourceNode.kind !==
          "setting"
        ) {
          throw new Error(
            `Item '${id}' has the unsupported kind '${projectString(
              sourceNode.kind,
              "unknown"
            )}'.`
          );
        }

        if (
          !knownTypes.has(
            sourceNode.valueType
          )
        ) {
          throw new Error(
            `Setting '${id}' uses the unsupported type '${projectString(
              sourceNode.valueType,
              "unknown"
            )}'.`
          );
        }

        const valueType =
          sourceNode.valueType;
        const enumOptions =
          Array.isArray(
            sourceNode.enumOptions
          )
            ? sourceNode.enumOptions
                .filter(
                  option =>
                    typeof option ===
                    "string"
                )
            : [];

        return {
          ...sourceNode,
          id,
          kind: "setting",
          valueType,
          fieldName:
            projectString(
              sourceNode.fieldName,
              toPascalCase(
                valueType,
                "Setting"
              )
            ),
          keyName:
            projectString(
              sourceNode.keyName,
              toSnakeCase(
                sourceNode.fieldName ||
                  valueType
              )
            ),
          description:
            projectString(
              sourceNode.description,
              `${friendlyTypeName(
                valueType
              )} configuration setting.`
            ),
          defaultValue:
            projectString(
              sourceNode.defaultValue,
              defaultForType(
                valueType
              )
            ),
          hidden:
            typeof sourceNode.hidden ===
            "boolean"
              ? sourceNode.hidden
              : false,
          layoutWidthPercent:
            Number.isFinite(
              Number(
                sourceNode.layoutWidthPercent
              )
            ) &&
            Number(
              sourceNode.layoutWidthPercent
            ) > 0
              ? clamp(
                  Number(
                    sourceNode.layoutWidthPercent
                  ),
                  1,
                  100
                )
              : undefined,
          hideLabel:
            sourceNode.hideLabel === true,
          validatorMode:
            projectString(
              sourceNode.validatorMode,
              "none"
            ),
          customValidator:
            projectString(
              sourceNode.customValidator
            ),
          useSlider:
            typeof sourceNode.useSlider ===
            "boolean"
              ? sourceNode.useSlider
              : false,
          minimum:
            projectString(
              sourceNode.minimum,
              "0"
            ),
          maximum:
            projectString(
              sourceNode.maximum,
              "100"
            ),
          enumName:
            projectString(
              sourceNode.enumName
            ),
          enumOptions,
          buttonLabel:
            valueType === "button"
              ? projectString(
                  sourceNode.buttonLabel,
                  "Run"
                )
              : undefined,
          colorProfile:
            valueType === "colorX"
              ? normalizeColorProfile(
                  sourceNode.colorProfile
                )
              : undefined,
          colorStrength:
            valueType === "colorX"
              ? clamp(
                  Number(
                    sourceNode.colorStrength
                  ) || 1,
                  1,
                  10
                )
              : undefined,
          reaction:
            knownReactions.has(
              sourceNode.reaction
            )
              ? sourceNode.reaction
              : "stored"
        };
      }
    );
  };

  return normalizeNodes(
    sanitizeList(
      nodes,
      0
    )
  );
}

function packedConfigurationSnapshotHash(
  metadata,
  nodes
) {
  const value = JSON.stringify({
    metadata: metadata || {},
    nodes: nodes || []
  });
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

function mergePackedConfigurationNodes(
  outlineNodes,
  snapshotNodes
) {
  const merged = clone(
    Array.isArray(outlineNodes)
      ? outlineNodes
      : []
  );
  const nodeById = new Map();
  const optionById = new Map();
  const identityById = new Map();
  const addedNodeIds = [];

  const registerNode = node => {
    if (!node || typeof node !== "object") {
      return;
    }

    const existingIdentity =
      identityById.get(node.id);
    if (
      existingIdentity &&
      existingIdentity.type !== "node"
    ) {
      throw new Error(
        `Packed configuration ID '${node.id}' is used by both a node and a section option.`
      );
    }

    identityById.set(
      node.id,
      { type: "node", value: node }
    );
    nodeById.set(node.id, node);

    if (node.kind === "controller") {
      for (const option of
        Array.isArray(node.options)
          ? node.options
          : []) {
        const optionIdentity =
          identityById.get(option.id);
        if (
          optionIdentity &&
          optionIdentity.type !== "option"
        ) {
          throw new Error(
            `Packed configuration ID '${option.id}' is used by both a section option and a node.`
          );
        }
        identityById.set(
          option.id,
          { type: "option", value: option }
        );
        optionById.set(option.id, option);
        for (const child of
          Array.isArray(option.children)
            ? option.children
            : []) {
          registerNode(child);
        }
      }
    } else if (node.kind === LAYOUT_ROW_KIND) {
      for (const child of
        Array.isArray(node.children)
          ? node.children
          : []) {
        registerNode(child);
      }
    }
  };

  const recordAddedTree = node => {
    if (!node || typeof node !== "object") {
      return;
    }

    addedNodeIds.push(node.id);

    if (node.kind === "controller") {
      for (const option of node.options || []) {
        for (const child of option.children || []) {
          recordAddedTree(child);
        }
      }
    } else if (node.kind === LAYOUT_ROW_KIND) {
      for (const child of node.children || []) {
        recordAddedTree(child);
      }
    }
  };

  const insertionIndex = (
    target,
    fallback,
    fallbackIndex
  ) => {
    for (
      let index = fallbackIndex + 1;
      index < fallback.length;
      index += 1
    ) {
      const nextIndex =
        target.findIndex(
          item =>
            item?.id ===
              fallback[index]?.id
        );

      if (nextIndex >= 0) {
        return nextIndex;
      }
    }

    for (
      let index = fallbackIndex - 1;
      index >= 0;
      index -= 1
    ) {
      const previousIndex =
        target.findIndex(
          item =>
            item?.id ===
              fallback[index]?.id
        );

      if (previousIndex >= 0) {
        return previousIndex + 1;
      }
    }

    return target.length;
  };

  const mergeLists = (
    target,
    fallback
  ) => {
    for (
      let index = 0;
      index < fallback.length;
      index += 1
    ) {
      const fallbackNode =
        fallback[index];
      let current =
        nodeById.get(
          fallbackNode.id
        );

      if (!current) {
        if (
          identityById.has(
            fallbackNode.id
          )
        ) {
          throw new Error(
            `Packed configuration ID '${fallbackNode.id}' changes between a node and a section option.`
          );
        }
        current = clone(fallbackNode);
        target.splice(
          insertionIndex(
            target,
            fallback,
            index
          ),
          0,
          current
        );
        recordAddedTree(current);
        registerNode(current);
        continue;
      }

      if (
        current.kind !==
          fallbackNode.kind
      ) {
        throw new Error(
          `Packed configuration node '${fallbackNode.id}' changes kind from '${current.kind}' to '${fallbackNode.kind}'.`
        );
      }

      if (
        current.kind === "controller" &&
        fallbackNode.kind === "controller"
      ) {
        const currentOptions =
          Array.isArray(current.options)
            ? current.options
            : (current.options = []);
        const fallbackOptions =
          Array.isArray(fallbackNode.options)
            ? fallbackNode.options
            : [];

        for (
          let optionIndex = 0;
          optionIndex < fallbackOptions.length;
          optionIndex += 1
        ) {
          const fallbackOption =
            fallbackOptions[optionIndex];
          let currentOption =
            optionById.get(
              fallbackOption.id
            );

          if (!currentOption) {
            if (
              identityById.has(
                fallbackOption.id
              )
            ) {
              throw new Error(
                `Packed configuration ID '${fallbackOption.id}' changes between a section option and a node.`
              );
            }
            currentOption =
              clone(fallbackOption);
            currentOptions.splice(
              insertionIndex(
                currentOptions,
                fallbackOptions,
                optionIndex
              ),
              0,
              currentOption
            );
            optionById.set(
              currentOption.id,
              currentOption
            );
            identityById.set(
              currentOption.id,
              {
                type: "option",
                value: currentOption
              }
            );
            for (const child of
              currentOption.children || []) {
              recordAddedTree(child);
              registerNode(child);
            }
            continue;
          }

          const currentChildren =
            Array.isArray(
              currentOption.children
            )
              ? currentOption.children
              : (currentOption.children = []);
          mergeLists(
            currentChildren,
            Array.isArray(
              fallbackOption.children
            )
              ? fallbackOption.children
              : []
          );
        }
      } else if (
        current.kind === LAYOUT_ROW_KIND &&
        fallbackNode.kind ===
          LAYOUT_ROW_KIND
      ) {
        const currentChildren =
          Array.isArray(current.children)
            ? current.children
            : (current.children = []);
        mergeLists(
          currentChildren,
          Array.isArray(
            fallbackNode.children
          )
            ? fallbackNode.children
            : []
        );
      }
    }
  };

  for (const node of merged) {
    registerNode(node);
  }

  mergeLists(
    merged,
    Array.isArray(snapshotNodes)
      ? snapshotNodes
      : []
  );

  return {
    nodes: normalizeNodes(merged),
    addedNodeIds
  };
}

function packedConfigurationItemIds(
  nodes,
  result = new Set()
) {
  for (const node of
    Array.isArray(nodes) ? nodes : []) {
    if (node.kind !== LAYOUT_ROW_KIND) {
      result.add(node.id);
    }

    if (node.kind === "controller") {
      for (const option of node.options || []) {
        packedConfigurationItemIds(
          option.children,
          result
        );
      }
    } else if (node.kind === LAYOUT_ROW_KIND) {
      packedConfigurationItemIds(
        node.children,
        result
      );
    }
  }

  return result;
}

function reconcilePackedGraphConfiguration(
  project
) {
  const graph =
    project?.extensions?.typedNodeGraph;
  const snapshot =
    graph?.configSnapshot;

  if (
    !graph ||
    !snapshot ||
    !Array.isArray(snapshot.nodes)
  ) {
    return project;
  }

  const sanitizedSnapshotNodes =
    sanitizeProjectNodes(
      snapshot.nodes
    );
  const outlineIdsBefore =
    packedConfigurationItemIds(
      project.nodes
    );
  const snapshotIdsBefore =
    packedConfigurationItemIds(
      sanitizedSnapshotNodes
    );
  const restoredFromSnapshot =
    [...snapshotIdsBefore].filter(
      id =>
        !outlineIdsBefore.has(id)
    );
  const preservedFromOutline =
    [...outlineIdsBefore].filter(
      id =>
        !snapshotIdsBefore.has(id)
    );
  const merged =
    mergePackedConfigurationNodes(
      graph.active === true
        ? sanitizedSnapshotNodes
        : project.nodes,
      graph.active === true
        ? project.nodes
        : sanitizedSnapshotNodes
    );

  project.nodes = merged.nodes;
  graph.configSnapshot = {
    metadata: clone(
      project.metadata
    ),
    nodes: clone(project.nodes)
  };
  graph.sourceSignature =
    packedConfigurationSnapshotHash(
      graph.configSnapshot.metadata,
      graph.configSnapshot.nodes
    );

  const configurationNodeIds =
    new Set(
      (Array.isArray(graph.nodes)
        ? graph.nodes
        : [])
        .filter(
          node =>
            node?.kind ===
              "configuration"
        )
        .map(node => node.id)
    );
  const itemIds =
    packedConfigurationItemIds(
      graph.configSnapshot.nodes
    );
  const invalidConnections =
    (Array.isArray(graph.connections)
      ? graph.connections
      : [])
      .filter(connection =>
        configurationNodeIds.has(
          connection?.fromNode
        ) &&
        String(
          connection?.fromPort || ""
        ).startsWith("config-") &&
        !itemIds.has(
          String(connection.fromPort)
            .slice("config-".length)
        )
      );

  if (invalidConnections.length > 0) {
    const connection =
      invalidConnections[0];
    throw new Error(
      `Packed Runtime Graph connection '${connection.id || "unnamed"}' references configuration port '${connection.fromPort}' which exists neither in the Configuration Outline nor in the packed snapshot.`
    );
  }

  if (
    restoredFromSnapshot.length > 0 ||
    preservedFromOutline.length > 0
  ) {
    console.info(
      "Reconciled the packed configuration snapshot with the project outline without dropping either side's unique items.",
      {
        restoredFromSnapshot,
        preservedFromOutline,
        activePackedSnapshotAuthoritative:
          graph.active === true
      }
    );
  }

  
  
  
  
  
  if (
    Array.isArray(graph.nodes) &&
    graph.nodes.some(node =>
      node?.kind === "configuration"
    ) &&
    Array.isArray(graph.connections)
  ) {
    graph.active = true;
  }

  return project;
}

function assertProjectDocumentEnvelope(
  source
) {
  if (!isPlainObject(source)) {
    throw new Error(
      "The selected file does not contain a builder project."
    );
  }

  if (
    source.format !== undefined &&
    source.format !== PROJECT_FORMAT
  ) {
    throw new Error(
      "The selected JSON file belongs to a different application."
    );
  }

  if (
    source.format === PROJECT_FORMAT &&
    source.formatVersion !==
      PROJECT_FORMAT_VERSION
  ) {
    throw new Error(
      `Project format version '${source.formatVersion}' is not supported.`
    );
  }
}

function projectModalJsonDocumentKind(
  source
) {
  return (
    isPlainObject(source) &&
    source.schema ===
      SAVED_API_COMPOSITE_IMPORT_SCHEMA
  )
    ? "saved-api-composites"
    : "project";
}

function parseProjectDocument(
  source
) {
  assertProjectDocumentEnvelope(
    source
  );

  const metadataSource =
    isPlainObject(
      source.metadata
    )
      ? source.metadata
      : {};
  const exportSource =
    isPlainObject(
      source.exportOptions
    )
      ? source.exportOptions
      : {};
  const workspaceSource =
    isPlainObject(
      source.workspace
    )
      ? source.workspace
      : {};
  const extensionsSource =
    isPlainObject(
      source.extensions
    )
      ? source.extensions
      : {};
  const resonitePath =
    projectString(
      exportSource.resonitePath,
      DEFAULT_EXPORT_OPTIONS.resonitePath
    );
  const platform =
    projectString(
      exportSource.platform,
      inferExportPlatform(
        resonitePath
      )
    );

  const project = {
    projectId:
      projectIdFromSource(source),
    metadata: {
      namespaceName:
        projectString(
          metadataSource.namespaceName,
          DEFAULT_METADATA.namespaceName
        ),
      className:
        projectString(
          metadataSource.className,
          DEFAULT_METADATA.className
        ),
      modName:
        projectString(
          metadataSource.modName,
          DEFAULT_METADATA.modName
        ),
      author:
        projectString(
          metadataSource.author,
          DEFAULT_METADATA.author
        ),
      version:
        projectString(
          metadataSource.version,
          DEFAULT_METADATA.version
        ),
      description:
        projectString(
          metadataSource.description,
          DEFAULT_METADATA.description
        ),
      includeGuide:
        typeof metadataSource.includeGuide ===
        "boolean"
          ? metadataSource.includeGuide
          : DEFAULT_METADATA.includeGuide
    },
    exportOptions: {
      platform:
        Object.hasOwn(
          EXPORT_PLATFORM_PRESETS,
          platform
        ) ||
        platform === "custom"
          ? platform
          : inferExportPlatform(
              resonitePath
            ),
      resonitePath,
      includeCs:
        typeof exportSource.includeCs ===
        "boolean"
          ? exportSource.includeCs
          : DEFAULT_EXPORT_OPTIONS.includeCs,
      includeCsproj:
        typeof exportSource.includeCsproj ===
        "boolean"
          ? exportSource.includeCsproj
          : DEFAULT_EXPORT_OPTIONS.includeCsproj
    },
    nodes:
      sanitizeProjectNodes(
        source.nodes
      ),
    extensions:
      extensionsSource,
    workspace: {
      activePage:
        normalizeBuilderPage(
          Object.hasOwn(
            workspaceSource,
            "activePage"
          )
            ? workspaceSource.activePage
            : extensionsSource
                ?.typedNodeGraph
                ?.lastOpenPage
        ),
      selectedId:
        projectString(
          workspaceSource.selectedId,
          ""
        ) || null,
      activeContainerId:
        projectString(
          workspaceSource.activeContainerId,
          ROOT_CONTAINER
        ),
      collapsedPaletteGroups:
        Array.isArray(
          workspaceSource.collapsedPaletteGroups
        )
          ? workspaceSource.collapsedPaletteGroups
              .filter(
                group =>
                  PALETTE_GROUP_NAMES.includes(
                    group
                  )
              )
          : []
    }
  };

  return reconcilePackedGraphConfiguration(
    project
  );
}

function applyProjectDocument(
  project,
  {
    restoredPage = null,
    reason = "project-apply"
  } = {}
) {
  const projectEpoch =
    ++projectApplicationEpoch;
  recordPageState(
    "project.apply-before",
    {
      reason,
      projectPage:
        project?.workspace?.activePage ||
        null,
      restoredPage
    }
  );
  document.dispatchEvent(
    new CustomEvent(
      "rml-builder:project-replacement",
      {
        detail: {
          projectEpoch,
          reason,
          projectId:
            String(project?.projectId || ""),
          nodes:
            project?.extensions
              ?.typedNodeGraph
              ?.nodes?.length || 0,
          connections:
            project?.extensions
              ?.typedNodeGraph
              ?.connections?.length || 0
        }
      }
    )
  );
  resetGraphCodegenForProjectReplacement();

  state.metadata =
    project.metadata;
  state.projectId =
    project.projectId;
  state.exportOptions =
    project.exportOptions;
  state.nodes =
    project.nodes;
  state.extensions =
    isPlainObject(project.extensions)
      ? project.extensions
      : {};
  state.activePage =
    normalizeBuilderPage(
      restoredPage ||
      project.workspace.activePage
    );
  state.selectedId =
    project.workspace.selectedId &&
    findNode(
      state.nodes,
      project.workspace.selectedId
    )
      ? project.workspace.selectedId
      : null;
  state.activeContainerId =
    project.workspace.activeContainerId ===
      ROOT_CONTAINER ||
    findContainerName(
      state.nodes,
      project.workspace.activeContainerId
    ) !== "Unknown section"
      ? project.workspace.activeContainerId
      : ROOT_CONTAINER;
  state.collapsedPaletteGroups =
    [...new Set(
      project.workspace.collapsedPaletteGroups ||
        []
    )];
  writePageStateMarker(
    state.activePage,
    reason
  );
  recordPageState(
    "project.apply-after",
    { reason, projectEpoch }
  );
  window.RMLDynamicGraphHost
    ?.synchronizeProjectState?.(
      projectEpoch
    );
  return projectEpoch;
}

let projectDraftPersistIdleHandle = 0;
let projectDraftPersistSchedule = 0;
let projectDraftPersistRevision = 0;
let pendingProjectDraftWrite = null;
let projectDraftWriteRunning = false;
let projectDraftFlushPromise =
  Promise.resolve();

function openProjectDraftDatabase() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(
        new Error(
          "IndexedDB is unavailable."
        )
      );
      return;
    }

    const request =
      window.indexedDB.open(
        PROJECT_DRAFT_DATABASE_NAME,
        PROJECT_DRAFT_DATABASE_VERSION
      );

    request.onupgradeneeded = () => {
      const database = request.result;

      if (
        !database.objectStoreNames.contains(
          PROJECT_DRAFT_STORE_NAME
        )
      ) {
        database.createObjectStore(
          PROJECT_DRAFT_STORE_NAME,
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
          "Project draft database could not be opened."
        )
      );
    request.onblocked = () =>
      reject(
        new Error(
          "Project draft database upgrade is blocked."
        )
      );
  });
}

async function writeProjectDraftRecord(
  project,
  revision
) {
  let database;

  try {
    database =
      await openProjectDraftDatabase();

    await new Promise((resolve, reject) => {
      const transaction =
        database.transaction(
          PROJECT_DRAFT_STORE_NAME,
          "readwrite"
        );

      transaction
        .objectStore(
          PROJECT_DRAFT_STORE_NAME
        )
        .put({
          id: ACTIVE_STORAGE_KEY,
          revision,
          savedAtUtc:
            new Date().toISOString(),
          project
        });

      transaction.oncomplete = () =>
        resolve(true);
      transaction.onerror = () =>
        reject(
          transaction.error ||
          new Error(
            "Project draft could not be written."
          )
        );
      transaction.onabort = () =>
        reject(
          transaction.error ||
          new Error(
            "Project draft write was aborted."
          )
        );
    });
  } finally {
    database?.close?.();
  }
}

async function readProjectDraftRecord() {
  let database;

  try {
    database =
      await openProjectDraftDatabase();

    return await new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            PROJECT_DRAFT_STORE_NAME,
            "readonly"
          );
        const request =
          transaction
            .objectStore(
              PROJECT_DRAFT_STORE_NAME
            )
            .get(ACTIVE_STORAGE_KEY);

        request.onsuccess = () =>
          resolve(
            isPlainObject(
              request.result?.project
            )
              ? request.result
              : null
          );
        request.onerror = () =>
          reject(
            request.error ||
            new Error(
              "Project draft could not be read."
            )
          );
      }
    );
  } catch (error) {
    console.debug(
      "No IndexedDB project draft is available.",
      error
    );
    return null;
  } finally {
    database?.close?.();
  }
}

function graphNodeCountInProject(project) {
  const nodes =
    project?.extensions
      ?.typedNodeGraph
      ?.nodes;

  return Array.isArray(nodes)
    ? nodes.length
    : 0;
}

async function updateLegacyLocalDraft(
  project
) {
  const graphNodeCount =
    graphNodeCountInProject(project);

  if (graphNodeCount > 2000) {
    try {
      localStorage.removeItem(
        ACTIVE_STORAGE_KEY
      );
    } catch {
    }
    return;
  }

  try {
    const response =
      await projectIoRequest(
        "stringify",
        {
          value: project,
          space: 0
        }
      );
    const text = String(
      response.text || ""
    );

    if (
      new TextEncoder().encode(text)
        .byteLength <=
      PROJECT_LOCAL_STORAGE_MAX_BYTES
    ) {
      localStorage.setItem(
        ACTIVE_STORAGE_KEY,
        text
      );
    } else {
      localStorage.removeItem(
        ACTIVE_STORAGE_KEY
      );
    }
  } catch (error) {
    console.debug(
      "The compatibility localStorage draft was skipped.",
      error
    );
  }
}

function flushProjectDraftWrites() {
  if (projectDraftWriteRunning) {
    return projectDraftFlushPromise;
  }

  projectDraftWriteRunning = true;
  projectDraftFlushPromise =
    (async () => {
      try {
        while (pendingProjectDraftWrite) {
          const current =
            pendingProjectDraftWrite;
          pendingProjectDraftWrite = null;

          try {
            await writeProjectDraftRecord(
              current.project,
              current.revision
            );

            if (
              current.revision ===
              projectDraftPersistRevision
            ) {
              await updateLegacyLocalDraft(
                current.project
              );
            }
          } catch (error) {
            console.warn(
              "Could not save the IndexedDB builder draft.",
              error
            );
          }
        }
      } finally {
        projectDraftWriteRunning = false;
      }
    })();

  return projectDraftFlushPromise;
}

async function persistProjectDraftImmediately() {
  if (
    projectDraftPersistIdleHandle &&
    typeof cancelIdleCallback ===
      "function"
  ) {
    cancelIdleCallback(
      projectDraftPersistIdleHandle
    );
    projectDraftPersistIdleHandle = 0;
  }

  projectDraftPersistSchedule += 1;
  projectDraftPersistRevision += 1;
  const revision =
    projectDraftPersistRevision;

  pendingProjectDraftWrite = {
    revision,
    project:
      createProjectDocument(
        false,
        false
      )
  };

  await flushProjectDraftWrites();
}

async function commitSuccessfulProjectStorage(
  previousProjectId,
  reason = "project-replacement"
) {
  const previousFingerprint =
    projectIdentityFingerprint(
      previousProjectId
    );
  const currentFingerprint =
    projectIdentityFingerprint(
      state.projectId
    );

  await persistProjectDraftImmediately();

  if (
    previousFingerprint ===
    currentFingerprint
  ) {
    return false;
  }

  try {
    localStorage.removeItem(
      ACTIVE_PREVIEW_STORAGE_KEY
    );
  } catch {
  }

  settingsPreviewDraft = null;
  settingsPreviewRuntimeMenu = null;
  settingsPreviewPulseCounts = {};

  retainOnlyJsonPage(
    currentFingerprint,
    state.activePage,
    reason
  );
  return true;
}

function persist(immediate = false) {
  projectDraftPersistRevision += 1;
  const revision =
    projectDraftPersistRevision;
  const schedule =
    ++projectDraftPersistSchedule;
  if (
    projectDraftPersistIdleHandle &&
    typeof cancelIdleCallback ===
      "function"
  ) {
    cancelIdleCallback(
      projectDraftPersistIdleHandle
    );
    projectDraftPersistIdleHandle = 0;
  }
  const enqueue = () => {
    projectDraftPersistIdleHandle = 0;

    if (
      schedule !==
        projectDraftPersistSchedule ||
      revision !==
        projectDraftPersistRevision
    ) {
      return;
    }

    pendingProjectDraftWrite = {
      revision,
      project:
        createProjectDocument(
          false,
          false
        )
    };
    void flushProjectDraftWrites();
  };

  if (immediate) {
    enqueue();
  } else if (
    typeof requestIdleCallback ===
      "function"
  ) {
    projectDraftPersistIdleHandle =
      requestIdleCallback(
        enqueue,
        { timeout: 1500 }
      );
  } else {
    queueMicrotask(() => {
      if (
        schedule ===
          projectDraftPersistSchedule
      ) {
        enqueue();
      }
    });
  }
}

window.addEventListener(
  "pagehide",
  () => persist(true),
  { capture: true }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.visibilityState === "hidden") {
      persist(true);
    }
  }
);

function resetProjectState() {
  state.projectId =
    createFreshProjectId();
  state.metadata = { ...DEFAULT_METADATA };
  state.exportOptions = {
    ...DEFAULT_EXPORT_OPTIONS
  };
  state.extensions = {};
  state.activePage =
    "configuration-outline";
  state.nodes = [];
  state.selectedId = null;
  state.activeContainerId = ROOT_CONTAINER;
  state.collapsedPaletteGroups = [];
  writePageStateMarker(
    state.activePage,
    "project-reset"
  );
}

function exampleProjectUrl() {
  return new URL(
    EXAMPLE_PROJECT_FILE_NAME,
    APP_SCRIPT_BASE_URL
  );
}

function invalidProjectJsonSyntaxError(
  displayName,
  cause
) {
  const detail = String(
    cause?.message || ""
  ).trim();
  return irreparableProjectJsonError(
    `${String(displayName || "The selected file")} contains invalid JSON syntax. Operator replacement cannot repair malformed JSON.`,
    detail
      ? [detail.slice(0, 320)]
      : []
  );
}

async function parseProjectJsonText(
  sourceText,
  displayName = "JSON project"
) {
  const text = String(sourceText ?? "");

  const definitelyWithinLimit =
    text.length <=
    Math.floor(
      PROJECT_FILE_MAX_BYTES / 3
    );
  const exceedsLimit =
    text.length > PROJECT_FILE_MAX_BYTES ||
    (
      !definitelyWithinLimit &&
      new TextEncoder().encode(text)
        .byteLength >
        PROJECT_FILE_MAX_BYTES
    );

  if (exceedsLimit) {
    throw new Error(
      `${displayName} is larger than the ${formatProjectByteLimit(PROJECT_FILE_MAX_BYTES)} project limit.`
    );
  }

  try {
    const response =
      await projectIoRequest(
        "parse",
        { text }
      );
    const project =
      parseProjectDocument(
        response.value
      );
    Object.defineProperty(
      project,
      "__rmlJsonFingerprint",
      {
        value:
          projectIdentityFingerprint(
            project.projectId
          ),
        writable: false,
        enumerable: false,
        configurable: true
      }
    );
    return project;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error?.name === "SyntaxError"
    ) {
      throw invalidProjectJsonSyntaxError(
        displayName,
        error
      );
    }

    throw error;
  }
}

async function parseProjectJsonFile(
  file,
  displayName = "JSON project"
) {
  try {
    const source =
      await readProjectJsonFileSource(
        file,
        displayName
      );
    const project =
      parseProjectDocument(
        source
      );
    Object.defineProperty(
      project,
      "__rmlJsonFingerprint",
      {
        value:
          projectIdentityFingerprint(
            project.projectId
          ),
        writable: false,
        enumerable: false,
        configurable: true
      }
    );
    return project;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error?.name === "SyntaxError"
    ) {
      throw invalidProjectJsonSyntaxError(
        displayName,
        error
      );
    }

    throw error;
  }
}

async function readJsonFileSource(
  file,
  displayName = "JSON document"
) {
  try {
    const response =
      await projectIoRequest(
        "parseFile",
        { file }
      );
    return response.value;
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error?.name === "SyntaxError"
    ) {
      throw invalidProjectJsonSyntaxError(
        displayName,
        error
      );
    }

    throw error;
  }
}

async function readProjectJsonFileSource(
  file,
  displayName = "JSON project"
) {
  const source =
    await readJsonFileSource(
      file,
      displayName
    );
  assertProjectDocumentEnvelope(source);
  return source;
}

async function readExampleProjectDocument() {
  const url = exampleProjectUrl();

  if (url.protocol === "file:") {
    throw new Error(
      "The browser blocks adjacent JSON files in file:// mode. Start the builder with 'Start Builder.cmd' so Load Example.json can be read locally from 127.0.0.1."
    );
  }

  const response = await fetch(
    url.href,
    {
      cache: "no-store",
      credentials: "same-origin"
    }
  );

  if (!response.ok) {
    throw new Error(
      `${EXAMPLE_PROJECT_FILE_NAME} could not be loaded (HTTP ${response.status}).`
    );
  }

  return await parseProjectJsonText(
    await response.text(),
    EXAMPLE_PROJECT_FILE_NAME
  );
}

function applyLoadedProject(
  project,
  {
    render = true,
    reason = "explicit-project-load",
    useJsonPageAssociation = true
  } = {}
) {
  const fingerprint =
    project?.__rmlJsonFingerprint ||
    "";
  const restoredPage =
    useJsonPageAssociation
      ? (
          pageForJsonFingerprint(
            fingerprint
          ) ||
          "configuration-outline"
        )
      : normalizeBuilderPage(
          project?.workspace
            ?.activePage
        );

  recordPageState(
    "json.apply-page-resolution",
    {
      fingerprint,
      matched:
        useJsonPageAssociation &&
        restoredPage !==
          "configuration-outline",
      restoredPage,
      reason
    }
  );
  const projectEpoch =
    applyProjectDocument(
      project,
      {
        restoredPage,
        reason
      }
    );

  if (!render) {
    return projectEpoch;
  }

  renderMetadata();
  renderPalette();
  renderAll();
  return projectEpoch;
}

let initialExampleProjectLoadError = null;

async function restore() {
  const indexedDraft =
    await readProjectDraftRecord();

  if (indexedDraft?.project) {
    try {
      const project =
        parseProjectDocument(
          indexedDraft.project
        );
      const restoredPage =
        readPageStateMarker(project);
      applyProjectDocument(
        project,
        {
          restoredPage,
          reason:
            "startup-indexeddb-restore"
        }
      );
      if (RML_VISUAL_TOUR_TEST && state.extensions) {
        delete state.extensions.typedNodeGraph;
      }
      return;
    } catch (error) {
      console.warn(
        "Could not restore the IndexedDB builder draft.",
        error
      );
    }
  }

  const saved =
    localStorage.getItem(ACTIVE_STORAGE_KEY);

  if (saved) {
    try {
      const project =
        await parseProjectJsonText(
          saved,
          "Local builder draft"
        );
      const restoredPage =
        readPageStateMarker(project);
      applyProjectDocument(
        project,
        {
          restoredPage,
          reason:
            "startup-localstorage-restore"
        }
      );
      if (RML_VISUAL_TOUR_TEST && state.extensions) {
        delete state.extensions.typedNodeGraph;
      }
      return;
    } catch (error) {
      console.warn(
        "Could not restore the local builder draft.",
        error
      );
    }
  }

  try {
    applyLoadedProject(
      await readExampleProjectDocument(),
      {
        render: false,
        reason:
          "startup-example-load"
      }
    );
    if (RML_VISUAL_TOUR_TEST && state.extensions) {
      delete state.extensions.typedNodeGraph;
    }
  } catch (error) {
    console.warn(
      "Could not load the external example project.",
      error
    );
    resetProjectState();
    initialExampleProjectLoadError =
      error instanceof Error
        ? error
        : new Error(
            `${EXAMPLE_PROJECT_FILE_NAME} could not be loaded.`
          );
  }
}

function optionMarkup(value, label, selectedValue) {
  return `<option value="${escapeHtml(value)}"${
    value === selectedValue ? " selected" : ""
  }>${escapeHtml(label)}</option>`;
}

function fieldMarkup(label, value, dataField, extra = "") {
  return `<label>
    ${escapeHtml(label)}
    <input value="${escapeHtml(value)}" data-field="${escapeHtml(
      dataField
    )}" ${extra}>
  </label>`;
}

function renderMetadata() {
  const mappings = {
    "mod-name": "modName",
    author: "author",
    version: "version",
    "namespace-name": "namespaceName",
    "class-name": "className",
    "mod-description": "description"
  };
  for (const [id, property] of Object.entries(mappings)) {
    const element = document.getElementById(id);
    element.value = state.metadata[property];
    element.oninput = () => {
      state.metadata[property] = element.value;
      updateGeneratedOutput();
      persist();
    };
  }
  elements.includeGuide.checked = state.metadata.includeGuide;
  elements.includeGuide.onchange = () => {
    state.metadata.includeGuide = elements.includeGuide.checked;
    updateGeneratedOutput();
    persist();
  };
}

function editableRuntimeCollectionPaletteSources() {
  const graph =
    state?.extensions?.typedNodeGraph;

  if (
    !graph ||
    !Array.isArray(graph.nodes)
  ) {
    return [];
  }

  const materialized =
    new Set(
      currentFlattenedNodes()
        .filter(node =>
          node?._rmlEditableCollectionSourceNodeId
        )
        .map(node =>
          String(
            node._rmlEditableCollectionSourceNodeId
          )
        )
    );

  return graph.nodes
    .filter(node =>
      node?.kind === "operator" &&
      node?.operatorId ===
        "collection.collectToList" &&
      (
        node?.parameters?.markAsEditable === true ||
        node?.parameters?.markAsEditable === "true" ||
        node?.parameters?.markAsEditable === 1
      ) &&
      !materialized.has(String(node.id))
    )
    .map(node => ({
      id: String(node.id),
      label:
        String(
          node?.parameters?.editableLabel ||
          node?.label ||
          "Dynamic Choice"
        ).trim() ||
        "Dynamic Choice"
    }));
}

function renderPalette() {
  const groups =
    PALETTE_GROUP_NAMES.filter(
      group =>
        group !== "Structure"
    );
  const dynamicSources =
    editableRuntimeCollectionPaletteSources();

  elements.paletteContent.innerHTML = groups
    .map(group => {
      const definitions =
        TYPE_DEFINITIONS.filter(
          item =>
            item.group === group
        );

      const staticItems = definitions
        .map(
          item => `<button
            class="palette-item"
            type="button"
            draggable="true"
            data-palette="${escapeHtml(item.type)}"
            data-help-kicker="Outline node"
            data-help="${escapeHtml(outlinePaletteHelp(item))}">
            <span>${escapeHtml(item.badge)}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <b>＋</b>
          </button>`
        )
        .join("");

      const dynamicItems =
        group === "Core"
          ? dynamicSources
              .map(
                source => `<button
                  class="palette-item"
                  type="button"
                  draggable="true"
                  data-rml-editable-collection-palette="true"
                  data-rml-editable-collection-source="${escapeHtml(source.id)}"
                  data-help-kicker="Dynamic outline node"
                  data-help="Adds a Dynamic Choice whose options come from the marked runtime collection. Click to add it to the active Outline container, or drag it to an exact position.">
                  <span>DYN</span>
                  <strong>${escapeHtml(`DYN · ${source.label}`)}</strong>
                  <b>＋</b>
                </button>`
              )
              .join("")
          : "";

      const count =
        definitions.length +
        (group === "Core"
          ? dynamicSources.length
          : 0);

      const open =
        state.collapsedPaletteGroups.includes(
          group
        )
          ? ""
          : " open";

      return `<details
        class="palette-group"
        data-palette-group="${escapeHtml(
          group
        )}"${open}>
        <summary>
          <span>${escapeHtml(group)}</span>
          <b>${count}</b>
        </summary>
        <div class="palette-list">${staticItems}${dynamicItems}</div>
      </details>`;
    })
    .join("");

  document
    .querySelectorAll(
      "[data-palette-group]"
    )
    .forEach(groupElement => {
      const groupName =
        groupElement.dataset.paletteGroup;

      groupElement.open =
        !state.collapsedPaletteGroups.includes(
          groupName
        );

      groupElement.ontoggle = () => {
        const wasCollapsed =
          state.collapsedPaletteGroups.includes(
            groupName
          );
        const isCollapsed =
          !groupElement.open;

        if (
          wasCollapsed ===
          isCollapsed
        ) {
          return;
        }

        state.collapsedPaletteGroups =
          isCollapsed
            ? [
                ...state.collapsedPaletteGroups,
                groupName
              ]
            : state.collapsedPaletteGroups.filter(
                group =>
                  group !== groupName
              );
        persist();
      };
    });

  elements.paletteContent
    .querySelectorAll("[data-palette]")
    .forEach(button => {
      button.addEventListener("click", event => {
        if (
          consumePalettePointerClick(
            button,
            event
          )
        ) {
          return;
        }

        addPaletteItem(
          button.dataset.palette,
          state.activeContainerId
        );
      });

      const pointerBound =
        bindPalettePointerDrag(
          button,
          {
            paletteType:
              button.dataset.palette
          }
        );

      if (!pointerBound) {
        button.addEventListener(
          "dragstart",
          event => {
            beginDragScrolling(event);
            event.dataTransfer.setData(
              "application/x-rml-palette",
              button.dataset.palette
            );
            event.dataTransfer.effectAllowed =
              "copy";
          }
        );
        button.addEventListener(
          "dragend",
          finishDragInteraction
        );
      }
    });

  elements.paletteContent
    .querySelectorAll(
      "[data-rml-editable-collection-source]"
    )
    .forEach(button => {
      const sourceId =
        button.dataset
          .rmlEditableCollectionSource;

      button.addEventListener(
        "click",
        event => {
          if (
            consumePalettePointerClick(
              button,
              event
            )
          ) {
            return;
          }

          window.RMLDynamicSettingsBridge
            ?.createFromSource?.(
              sourceId,
              state.activeContainerId,
              null
            );
        }
      );

      const pointerBound =
        bindPalettePointerDrag(
          button,
          {
            dynamicSourceId:
              sourceId
          }
        );

      if (!pointerBound) {
        button.addEventListener(
          "dragstart",
          event => {
            beginDragScrolling(event);
            event.dataTransfer.setData(
              "application/x-rml-dynamic-editable",
              sourceId
            );
            event.dataTransfer.effectAllowed =
              "copy";
          }
        );

        button.addEventListener(
          "dragend",
          finishDragInteraction
        );
      }
    });
}

function addPaletteItem(type, containerId) {
  const node =
    type === "controller"
      ? makeController()
      : type === LAYOUT_ROW_KIND
        ? makeLayoutRow()
        : makeSetting(type);
  const result = insertIntoContainer(state.nodes, containerId, node);
  if (!result.inserted) {
    state.activeContainerId = ROOT_CONTAINER;
    state.nodes = [...state.nodes, node];
  } else {
    state.nodes = result.nodes;
  }
  state.selectedId = node.id;
  renderAll();
}

function selectedBadge(node) {
  if (node.kind === "controller") return "§";
  if (node.kind === LAYOUT_ROW_KIND) return "⇄";
  return (
    TYPE_DEFINITIONS.find(item => item.type === node.valueType)?.badge ||
    node.valueType
  );
}

function nodeCardsMarkup(
  nodes,
  containerId
) {
  return nodes
    .map(
      (node, index) =>
        nodeCardMarkup(
          node,
          containerId,
          index,
          nodes.length
        )
    )
    .join("");
}

function nodeCardMarkup(
  node,
  containerId,
  index,
  siblingCount
) {
  const selected = state.selectedId === node.id ? " selected" : "";
  const displayName =
    node.kind === LAYOUT_ROW_KIND
      ? node.label || "Inline Row"
      : node.fieldName;

  const nestedSectionEnum =
    node.kind === "controller" &&
    containerId !== ROOT_CONTAINER;

const previousOptionSymbol =
  nestedSectionEnum
    ? "▲"
    : "←";

const nextOptionSymbol =
  nestedSectionEnum
    ? "▼"
    : "→";

const previousOptionDirection =
  nestedSectionEnum
    ? "up"
    : "left";

const nextOptionDirection =
  nestedSectionEnum
    ? "down"
    : "right";

  const subtitle =
    node.kind === "controller"
      ? `${node.enumName} · section navigation`
      : node.kind === LAYOUT_ROW_KIND
        ? `${node.horizontal === false ? "vertical" : "horizontal"} layout · ${(node.children || []).length} item${(node.children || []).length === 1 ? "" : "s"}`
      : `${node.valueType} · ${node.keyName}`;
  let body = "";

  if (node.kind === "controller") {
    body = `<div
      class="controller-options"
      data-rml-scroll-layer="auto"
      data-rml-scroll-layer-key="outline-controller:${escapeHtml(node.id)}"
      data-scroll-label="${escapeHtml(node.fieldName)} · Section enum contents">
      ${node.options
        .map(
          (option, optionIndex) => `<section
            class="option-lane${
              state.activeContainerId === option.id
                ? " active-container"
                : ""
            }${
              state.dragOverContainer === option.id
                ? " drag-over"
                : ""
            }"
            draggable="false"
            data-container="${escapeHtml(option.id)}"
            data-rml-scroll-layer="auto"
            data-rml-scroll-layer-key="outline-section:${escapeHtml(option.id)}"
            data-scroll-label="${escapeHtml(option.name)} · Section level"
            data-option-id="${escapeHtml(option.id)}"
            data-controller-id="${escapeHtml(node.id)}"
            data-option-index="${optionIndex}">
            <header class="option-heading">
              <span>${escapeHtml(option.name)}</span>
              <div class="option-heading-actions">
                <div class="option-order-actions" aria-label="Change section order">
                  <button
                    class="move-option move-option-previous"
                    type="button"
                    draggable="false"
                    data-move-option="${escapeHtml(option.id)}"
                    data-option-controller="${escapeHtml(node.id)}"
                    data-option-direction="-1"
                    ${optionIndex <= 0 ? "disabled" : ""}
                    title="Move section ${previousOptionDirection}"
                    aria-label="Move ${escapeHtml(option.name)} ${previousOptionDirection}">${previousOptionSymbol}</button>

                  <button
                    class="move-option move-option-next"
                    type="button"
                    draggable="false"
                    data-move-option="${escapeHtml(option.id)}"
                    data-option-controller="${escapeHtml(node.id)}"
                    data-option-direction="1"
                    ${optionIndex >= node.options.length - 1 ? "disabled" : ""}
                    title="Move section ${nextOptionDirection}"
                    aria-label="Move ${escapeHtml(option.name)} ${nextOptionDirection}">${nextOptionSymbol}</button>
                </div>
                <small>${option.children.length} item${
                  option.children.length === 1 ? "" : "s"
                }</small>
              </div>
            </header>
            <div
              class="drop-zone"
              data-rml-scroll-layer="auto"
              data-rml-scroll-layer-key="outline-section-content:${escapeHtml(option.id)}"
              data-scroll-label="${escapeHtml(option.name)} · Section contents">
              ${
                option.children.length
                  ? nodeCardsMarkup(
                      option.children,
                      option.id
                    )
                  : `<div class="empty-drop"><span>＋</span>Drop or add controls here</div>`
              }
            </div>
          </section>`
        )
        .join("")}
    </div>`;
  } else if (node.kind === LAYOUT_ROW_KIND) {
    const children = node.children || [];
    body = `<section
      class="layout-row-lane${
        state.activeContainerId === node.id
          ? " active-container"
          : ""
      }${
        state.dragOverContainer === node.id
          ? " drag-over"
          : ""
      }"
      data-container="${escapeHtml(node.id)}"
      data-rml-scroll-layer="auto"
      data-rml-scroll-layer-key="outline-layout-row:${escapeHtml(node.id)}"
      data-scroll-label="${escapeHtml(node.label || "Inline Row")} · Horizontal contents">
      <div class="layout-row-heading">
        <span>${escapeHtml(node.label || "Inline Row")}</span>
        <small>${children.length} item${children.length === 1 ? "" : "s"}</small>
      </div>
      <div class="layout-row-drop-zone drop-zone">
        ${
          children.length
            ? nodeCardsMarkup(children, node.id)
            : `<div class="empty-drop"><span>＋</span>Drop settings here to place them side by side</div>`
        }
      </div>
    </section>`;
  }

   return `<article
    class="node-card ${escapeHtml(node.kind)}${selected}"
    draggable="false"
    data-node-id="${escapeHtml(node.id)}"
    data-parent-container="${escapeHtml(containerId)}"
    data-sibling-index="${index}">
    <div
      class="option-sibling-drop-zone option-sibling-drop-before"
      data-option-sibling-drop="before"
      aria-hidden="true"></div>
    <div class="node-head">
      <div class="node-icon">${escapeHtml(selectedBadge(node))}</div>
      <div class="node-copy">
        <strong>${escapeHtml(displayName)}</strong>
        <small>${escapeHtml(subtitle)}</small>
      </div>
      <div class="node-order-actions" aria-label="Change item order">
        <button
          class="move-node move-node-up"
          type="button"
          draggable="false"
          data-move-node="${escapeHtml(node.id)}"
          data-move-direction="-1"
          ${index <= 0 ? "disabled" : ""}
          title="Move one position up"
          aria-label="Move ${escapeHtml(displayName)} up">▲</button>
        <button
          class="move-node move-node-down"
          type="button"
          draggable="false"
          data-move-node="${escapeHtml(node.id)}"
          data-move-direction="1"
          ${index >= siblingCount - 1 ? "disabled" : ""}
          title="Move one position down"
          aria-label="Move ${escapeHtml(displayName)} down">▼</button>
      </div>
      <button
        class="delete-node"
        type="button"
        draggable="false"
        data-delete-node="${escapeHtml(node.id)}"
        title="Delete">×</button>
    </div>
    ${body}
    <div
      class="option-sibling-drop-zone option-sibling-drop-after"
      data-option-sibling-drop="after"
      aria-hidden="true"></div>
  </article>`;
}

function allowContainerDrop(container, event) {
  event.preventDefault();
  event.stopPropagation();
  state.dragOverContainer = container;
  event.dataTransfer.dropEffect = event.dataTransfer.types.includes(
    "application/x-rml-node"
  )
    ? "move"
    : "copy";
  document.querySelectorAll(".option-lane, .layout-row-lane, .builder-canvas").forEach(zone => {
    zone.classList.toggle(
      "drag-over",
      (zone.dataset.container || ROOT_CONTAINER) === container
    );
  });
}

function clearDragFeedback() {
  state.dragOverContainer = null;
  state.dragInsertContainer = null;
  state.dragInsertIndex = null;

  document
    .querySelectorAll(
      ".option-lane.drag-over, .layout-row-lane.drag-over, .builder-canvas.drag-over"
    )
    .forEach(zone =>
      zone.classList.remove("drag-over")
    );

  document
    .querySelectorAll(
      ".node-card.drag-insert-before, .node-card.drag-insert-after"
    )
    .forEach(card => {
      card.classList.remove(
        "drag-insert-before",
        "drag-insert-after"
      );
    });

  dragFeedbackPlaceholder?.remove();
  dragFeedbackPlaceholder = null;

  optionDragFeedbackPlaceholder?.remove();
  optionDragFeedbackPlaceholder = null;

  document
    .querySelectorAll(
      ".controller-options.option-drag-over"
    )
    .forEach(host =>
      host.classList.remove(
        "option-drag-over"
      )
    );

  document
    .querySelectorAll(
      ".option-sibling-drop-zone.option-sibling-drop-active"
    )
    .forEach(edge =>
      edge.classList.remove(
        "option-sibling-drop-active"
      )
    );

  unlockOptionDropTarget();

  optionWheelTargetHost = null;
  optionWheelTargetControllerId = null;
  optionWheelLastStepTime = 0;
  optionWheelManualIndex = null;
  optionWheelManualHost = null;

  optionContainerWheelTargetHost = null;
  optionContainerWheelTargetContainerId = null;
  optionContainerWheelDelta = 0;
  optionContainerWheelManualIndex = null;
  optionContainerWheelManualHost = null;
}

function beginDragScrolling(event) {

  if (!dragScrollActive) {
    const scrollElement =
      document.scrollingElement ||
      document.documentElement;

    dragScrollOriginX =
      scrollElement.scrollLeft;

    dragScrollOriginY =
      scrollElement.scrollTop;
  }

  dragScrollActive = true;
  dragScrollLastTimestamp = 0;

  dragPointerY =
    Number.isFinite(event?.clientY)
      ? event.clientY
      : null;

  requestDragPlaceholderVisibility();
}

function updateDragScrolling(event) {
  if (!dragScrollActive) {
    return;
  }

  dragPointerY = event.clientY;
  requestDragPlaceholderVisibility();
}

function activeDragInsertPlaceholder() {
  const placeholders = [
    optionDragFeedbackPlaceholder,
    dragFeedbackPlaceholder
  ];

  for (const placeholder of placeholders) {
    if (
      placeholder instanceof HTMLElement &&
      placeholder.isConnected
    ) {
      const rectangle =
        placeholder.getBoundingClientRect();

      if (
        rectangle.width > 0 &&
        rectangle.height > 0
      ) {
        return placeholder;
      }
    }
  }

  return null;
}

function dragViewportTop() {
  const viewportHeight =
    window.innerHeight ||
    document.documentElement.clientHeight;

  let visibleTop =
    DRAG_SCROLL_VISIBILITY_PADDING;

  document
    .querySelectorAll(
      "header, [role='banner'], .app-header, .top-header, .toolbar, .topbar"
    )
    .forEach(element => {
      if (!(element instanceof HTMLElement)) {
        return;
      }

      const style =
        getComputedStyle(element);

      if (
        style.position !== "fixed" &&
        style.position !== "sticky"
      ) {
        return;
      }

      const rectangle =
        element.getBoundingClientRect();

      if (
        rectangle.width <= 0 ||
        rectangle.height <= 0 ||
        rectangle.bottom <= 0 ||
        rectangle.top >= viewportHeight
      ) {
        return;
      }

      if (rectangle.top <= 1) {
        visibleTop =
          Math.max(
            visibleTop,
            rectangle.bottom +
              DRAG_SCROLL_VISIBILITY_PADDING
          );
      }
    });

  return visibleTop;
}

function dragManualInsertSelectionActive() {
  if (
    (
      nodePointerDragActive ||
      palettePointerDragActive
    ) &&
    nodeWheelManualHost &&
    nodeWheelManualHost.isConnected &&
    Number.isFinite(
      nodeWheelManualIndex
    )
  ) {
    return true;
  }

  if (!optionPointerDragActive) {
    return false;
  }

  return (
    optionWheelManualHost &&
    optionWheelManualHost.isConnected &&
    Number.isFinite(
      optionWheelManualIndex
    )
  ) || (
    optionContainerWheelManualHost &&
    optionContainerWheelManualHost.isConnected &&
    Number.isFinite(
      optionContainerWheelManualIndex
    )
  );
}

function dragPlaceholderVisibilityDelta() {
  const placeholder =
    activeDragInsertPlaceholder();

  if (!placeholder) {
    return 0;
  }

  const rectangle =
    placeholder.getBoundingClientRect();

  if (
    rectangle.width <= 0 ||
    rectangle.height <= 0
  ) {
    return 0;
  }

  const viewportHeight =
    window.innerHeight ||
    document.documentElement.clientHeight;

  const visibleTop =
    dragViewportTop();

  const visibleBottom =
    viewportHeight -
    DRAG_SCROLL_VISIBILITY_PADDING;

  const visibleHeight =
    Math.max(
      1,
      visibleBottom - visibleTop
    );

  if (rectangle.height <= visibleHeight) {
    if (rectangle.top < visibleTop) {
      return rectangle.top - visibleTop;
    }

    if (rectangle.bottom > visibleBottom) {
      return rectangle.bottom - visibleBottom;
    }

    return 0;
  }

  if (rectangle.bottom <= visibleTop) {
    return rectangle.bottom - visibleTop;
  }

  if (rectangle.top >= visibleBottom) {
    return rectangle.top - visibleBottom;
  }

  return 0;
}

function refreshPointerTargetAfterDragScroll() {

  if (dragManualInsertSelectionActive()) {
    return;
  }

  if (nodePointerDragActive) {
    scheduleNodePointerTargetUpdate(
      nodePointerX,
      nodePointerY
    );

    return;
  }

  if (palettePointerDragActive) {
    schedulePalettePointerTargetUpdate(
      palettePointerX,
      palettePointerY
    );

    return;
  }

  if (optionPointerDragActive) {
    scheduleOptionPointerTargetUpdate(
      optionPointerX,
      optionPointerY
    );
  }
}

function requestDragPlaceholderVisibility() {
  if (
    !dragScrollActive ||
    dragScrollFrame !== null
  ) {
    return;
  }

  dragScrollLastTimestamp = 0;
  dragScrollFrame =
    window.requestAnimationFrame(
      runDragScrolling
    );
}

function runDragScrolling(timestamp) {
  dragScrollFrame = null;

  if (
    !dragScrollActive ||
    !Number.isFinite(dragPointerY)
  ) {
    dragScrollLastTimestamp = 0;
    return;
  }

  if (
    optionPointerDragActive &&
    document.documentElement.classList.contains(
      "rml-setup-horizontal-option-gesture"
    )
  ) {
    dragScrollLastTimestamp = 0;
    return;
  }

  const manualSelection =
    dragManualInsertSelectionActive();

  const visibilityDelta =
    manualSelection
      ? dragPlaceholderVisibilityDelta()
      : 0;

  let scrollAmount = 0;
  let refreshTarget = false;

  if (Math.abs(visibilityDelta) > 0.5) {
    scrollAmount =
      Math.sign(visibilityDelta) *
      Math.min(
        DRAG_SCROLL_VISIBILITY_MAX_SPEED,
        Math.max(
          DRAG_SCROLL_MIN_SPEED,
          Math.abs(visibilityDelta) * 0.16
        )
      );
  } else if (manualSelection) {

    dragScrollLastTimestamp = 0;
    return;
  } else {
    const viewportHeight =
      window.innerHeight ||
      document.documentElement.clientHeight;

    const visibleTop =
      dragViewportTop();

    const visibleBottom =
      viewportHeight -
      DRAG_SCROLL_VISIBILITY_PADDING;

    const availableHeight =
      Math.max(
        1,
        visibleBottom - visibleTop
      );

    const edgeSize =
      Math.max(
        1,
        Math.min(
          DRAG_SCROLL_EDGE_SIZE,
          availableHeight * 0.35
        )
      );

    const topEdge =
      visibleTop + edgeSize;

    const bottomEdge =
      visibleBottom - edgeSize;

    let direction = 0;
    let intensity = 0;

    if (dragPointerY < topEdge) {
      direction = -1;
      intensity =
        clamp(
          (topEdge - dragPointerY) /
            edgeSize,
          0,
          1
        );
    } else if (
      dragPointerY > bottomEdge
    ) {
      direction = 1;
      intensity =
        clamp(
          (dragPointerY - bottomEdge) /
            edgeSize,
          0,
          1
        );
    }

    if (direction === 0) {
      dragScrollLastTimestamp = 0;
      return;
    }

    const elapsed =
      dragScrollLastTimestamp > 0
        ? clamp(
            timestamp -
              dragScrollLastTimestamp,
            8,
            34
          )
        : 16.6667;

    dragScrollLastTimestamp =
      timestamp;

    const frameScale =
      elapsed / 16.6667;

    const speed =
      (
        DRAG_SCROLL_MIN_SPEED +
        (
          DRAG_SCROLL_MAX_SPEED -
          DRAG_SCROLL_MIN_SPEED
        ) *
        intensity *
        intensity
      ) *
      frameScale;

    scrollAmount =
      direction * speed;

    refreshTarget = true;
  }

  const scrollElement =
    document.scrollingElement ||
    document.documentElement;

  const previousScrollTop =
    scrollElement.scrollTop;

  const maximumScrollTop =
    Math.max(
      0,
      scrollElement.scrollHeight -
        scrollElement.clientHeight
    );

  scrollElement.scrollTop =
    clamp(
      previousScrollTop +
        scrollAmount,
      0,
      maximumScrollTop
    );

  const actuallyScrolled =
    scrollElement.scrollTop !==
    previousScrollTop;

  if (actuallyScrolled && refreshTarget) {
    refreshPointerTargetAfterDragScroll();
  }

  if (!actuallyScrolled) {
    dragScrollLastTimestamp = 0;
    return;
  }

  dragScrollFrame =
    window.requestAnimationFrame(
      runDragScrolling
    );
}

function stopDragScrolling() {
  dragScrollActive = false;
  dragPointerY = null;
  dragScrollLastTimestamp = 0;

  if (dragScrollFrame !== null) {
    window.cancelAnimationFrame(
      dragScrollFrame
    );

    dragScrollFrame = null;
  }
}

function finishDragInteraction() {
  stopDragScrolling();
  clearDragFeedback();
  activeDraggedNodeId = null;
  activeDraggedOptionId = null;
  activeDraggedOptionControllerId = null;
}

function directNodeCards(host) {
  return Array.from(host?.children || [])
    .filter(
      child =>
        child instanceof HTMLElement &&
        child.classList.contains("node-card")
    );
}

function outlineDropTargetFromElement(
  element,
  canvas = elements.builderCanvas
) {
  if (
    !(element instanceof Element) ||
    !(canvas instanceof HTMLElement)
  ) {
    return null;
  }

  const lane =
    element.closest(
      OUTLINE_CONTAINER_LANE_SELECTOR
    );

  if (
    !(lane instanceof HTMLElement) ||
    !canvas.contains(lane)
  ) {
    return null;
  }

  const host =
    lane.querySelector(
      ":scope > .drop-zone"
    );

  const containerId =
    lane.dataset.container;

  if (
    !(host instanceof HTMLElement) ||
    !containerId
  ) {
    return null;
  }

  return {
    lane,
    host,
    containerId
  };
}

function horizontalLayoutHost(host) {
  return Boolean(
    host?.classList?.contains(
      "layout-row-drop-zone"
    )
  );
}

function nodeInsertionIndexAtPoint(
  host,
  cards,
  clientX,
  clientY
) {
  const horizontal =
    horizontalLayoutHost(host);

  for (const card of cards) {
    const rectangle =
      card.getBoundingClientRect();
    const pointer = horizontal
      ? clientX
      : clientY;
    const midpoint = horizontal
      ? rectangle.left +
        rectangle.width / 2
      : rectangle.top +
        rectangle.height / 2;

    if (pointer < midpoint) {
      return Number(
        card.dataset.siblingIndex
      ) || 0;
    }
  }

  return directNodeCards(host).length;
}

function dropHostForCard(card) {
  const parent = card.parentElement;

  if (
    parent?.classList.contains("drop-zone") ||
    parent?.classList.contains("builder-canvas")
  ) {
    return parent;
  }

  return null;
}

function ensureDragPlaceholder() {
  if (
    dragFeedbackPlaceholder &&
    dragFeedbackPlaceholder.isConnected
  ) {
    return dragFeedbackPlaceholder;
  }

  dragFeedbackPlaceholder =
    document.createElement("div");
  dragFeedbackPlaceholder.className =
    "drag-reorder-placeholder";
  dragFeedbackPlaceholder.setAttribute(
    "aria-hidden",
    "true"
  );

  return dragFeedbackPlaceholder;
}


function nodeInsertionGeometry(
  host,
  insertionIndex
) {
  const cards = directNodeCards(host);
  const hostRectangle = host.getBoundingClientRect();
  const ordered = [...cards].sort(
    (left, right) =>
      (Number(left.dataset.siblingIndex) || 0) -
      (Number(right.dataset.siblingIndex) || 0)
  );

  const index = clamp(
    Number.isFinite(insertionIndex)
      ? Math.trunc(insertionIndex)
      : ordered.length,
    0,
    ordered.length
  );

  const before = index > 0 ? ordered[index - 1] : null;
  const after = index < ordered.length ? ordered[index] : null;
  const beforeRectangle = before?.getBoundingClientRect() || null;
  const afterRectangle = after?.getBoundingClientRect() || null;

  if (horizontalLayoutHost(host)) {
    let left;
    if (beforeRectangle && afterRectangle) {
      left =
        (beforeRectangle.right +
          afterRectangle.left) / 2;
    } else if (afterRectangle) {
      left = afterRectangle.left - 4;
    } else if (beforeRectangle) {
      left = beforeRectangle.right + 4;
    } else {
      left = hostRectangle.left + 7;
    }

    return {
      horizontal: true,
      left: Math.max(
        0,
        left -
          hostRectangle.left +
          host.scrollLeft -
          host.clientLeft -
          2
      ),
      top: 7,
      width: 4,
      height: Math.max(
        24,
        host.clientHeight - 14
      )
    };
  }

  if (
    beforeRectangle &&
    afterRectangle &&
    afterRectangle.top < beforeRectangle.bottom - 2
  ) {
    return null;
  }

  let top;
  if (beforeRectangle && afterRectangle) {
    top = (beforeRectangle.bottom + afterRectangle.top) / 2;
  } else if (afterRectangle) {
    top = afterRectangle.top - 4;
  } else if (beforeRectangle) {
    top = beforeRectangle.bottom + 4;
  } else {
    top = hostRectangle.top + 7;
  }

  let left = hostRectangle.left + host.clientLeft + 7;
  let right = hostRectangle.right - host.clientLeft - 7;

  if (beforeRectangle && afterRectangle) {
    const overlapLeft = Math.max(
      beforeRectangle.left,
      afterRectangle.left
    );
    const overlapRight = Math.min(
      beforeRectangle.right,
      afterRectangle.right
    );

    if (overlapRight - overlapLeft >= 24) {
      left = overlapLeft;
      right = overlapRight;
    } else {
      const anchor =
        beforeRectangle.width <= afterRectangle.width
          ? beforeRectangle
          : afterRectangle;
      left = anchor.left;
      right = anchor.right;
    }
  } else {
    const anchor = afterRectangle || beforeRectangle;
    if (anchor) {
      left = anchor.left;
      right = anchor.right;
    }
  }

  const hostContentLeft =
    hostRectangle.left + host.clientLeft;

  return {
    horizontal: false,
    left: Math.max(
      0,
      left - hostContentLeft + host.scrollLeft
    ),
    top: Math.max(
      0,
      top -
        hostRectangle.top +
        host.scrollTop -
        host.clientTop -
        2
    ),
    width: Math.max(
      24,
      Math.min(
        host.clientWidth,
        right - left
      )
    ),
    height: 4
  };
}

function keepNodeInsertionLineClearOfControls(
  host,
  geometry
) {
  if (
    !(host instanceof HTMLElement) ||
    !geometry ||
    geometry.horizontal
  ) {
    return geometry;
  }

  const hostRectangle =
    host.getBoundingClientRect();
  const clientLeft =
    hostRectangle.left +
    host.clientLeft -
    host.scrollLeft +
    geometry.left;
  const clientTop =
    hostRectangle.top +
    host.clientTop -
    host.scrollTop +
    geometry.top;
  const centerY =
    clientTop + geometry.height / 2;
  let safeLeft = clientLeft;
  let safeRight =
    clientLeft + geometry.width;

  const crossesInterior = rectangle =>
    centerY > rectangle.top + 4 &&
    centerY < rectangle.bottom - 4 &&
    safeRight > rectangle.left + 4 &&
    safeLeft < rectangle.right - 4;

  if (
    directNodeCards(host)
      .filter(card =>
        !card.classList.contains("node-pointer-ghost")
      )
      .some(card =>
        crossesInterior(
          card.getBoundingClientRect()
        )
      )
  ) {
    return null;
  }

  const controls = [
    ...document.querySelectorAll(
      "button, input, select, textarea, [role='button']"
    )
  ].filter(control => {
    if (
      !(control instanceof HTMLElement) ||
      control.closest("#rml-setup-assistant") ||
      control.closest(".node-pointer-ghost") ||
      control.contains(host)
    ) {
      return false;
    }
    const style = getComputedStyle(control);
    const rectangle = control.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rectangle.width > 0 &&
      rectangle.height > 0 &&
      crossesInterior(rectangle)
    );
  });

  const originalCenterX =
    clientLeft + geometry.width / 2;
  for (const control of controls) {
    const rectangle =
      control.getBoundingClientRect();
    if (
      rectangle.left + rectangle.width / 2 >=
      originalCenterX
    ) {
      safeRight = Math.min(
        safeRight,
        rectangle.left - 6
      );
    } else {
      safeLeft = Math.max(
        safeLeft,
        rectangle.right + 6
      );
    }
  }

  if (safeRight - safeLeft < 24) {
    return null;
  }

  return {
    ...geometry,
    left:
      geometry.left +
      safeLeft -
      clientLeft,
    width:
      safeRight -
      safeLeft
  };
}

function positionNodeInsertPlaceholder(
  host,
  insertionIndex
) {
  if (!host) {
    return;
  }

  const placeholder = ensureDragPlaceholder();

  if (placeholder.parentElement !== host) {
    host.appendChild(placeholder);
  }

  const geometry =
    keepNodeInsertionLineClearOfControls(
      host,
      nodeInsertionGeometry(
        host,
        insertionIndex
      )
    );

  if (!geometry) {
    placeholder.hidden = true;
    return false;
  }

  placeholder.hidden = false;

  placeholder.classList.toggle(
    "horizontal-layout-placeholder",
    geometry.horizontal
  );

  placeholder.style.setProperty(
    "--node-placeholder-left",
    `${geometry.left}px`
  );
  placeholder.style.setProperty(
    "--node-placeholder-top",
    `${geometry.top}px`
  );
  placeholder.style.setProperty(
    "--node-placeholder-width",
    `${geometry.width}px`
  );
  placeholder.style.setProperty(
    "--node-placeholder-height",
    `${geometry.height}px`
  );

  requestDragPlaceholderVisibility();
  return true;
}

function directOptionLanes(host) {
  return Array.from(host?.children || [])
    .filter(
      child =>
        child instanceof HTMLElement &&
        child.classList.contains(
          "option-lane"
        )
    );
}

function ensureOptionDragPlaceholder() {
  if (
    optionDragFeedbackPlaceholder &&
    optionDragFeedbackPlaceholder.isConnected
  ) {
    return optionDragFeedbackPlaceholder;
  }

  optionDragFeedbackPlaceholder =
    document.createElement("div");
  optionDragFeedbackPlaceholder.className =
    "option-reorder-placeholder";
  optionDragFeedbackPlaceholder.setAttribute(
    "aria-hidden",
    "true"
  );

  return optionDragFeedbackPlaceholder;
}

function optionContainsController(
  option,
  controllerId
) {
  return Boolean(
    findNode(
      option.children,
      controllerId
    )
  );
}

function unlockOptionDropTarget() {
  if (!lockedOptionTargetCard) {
    lockedOptionTargetHost = null;
    lockedOptionTargetRectangle = null;
    return;
  }

  lockedOptionTargetCard.classList.remove(
    "option-drop-target-locked"
  );

  lockedOptionTargetCard.style.removeProperty(
    "--option-lock-width"
  );
  lockedOptionTargetCard.style.removeProperty(
    "--option-lock-height"
  );
  lockedOptionTargetCard.style.removeProperty(
    "--option-lock-translate-x"
  );
  lockedOptionTargetCard.style.removeProperty(
    "--option-lock-translate-y"
  );

  lockedOptionTargetCard =
    null;

  lockedOptionTargetHost =
    null;

  lockedOptionTargetRectangle =
    null;
}

function lockOptionDropTarget(
  host
) {
  const targetCard =
    host?.closest(
      ".node-card.controller"
    );

  if (!targetCard) {
    unlockOptionDropTarget();
    return null;
  }

  if (
    lockedOptionTargetCard ===
      targetCard &&
    lockedOptionTargetHost ===
      host &&
    lockedOptionTargetRectangle
  ) {
    return targetCard;
  }

  unlockOptionDropTarget();

  const rectangle =
    targetCard.getBoundingClientRect();

  lockedOptionTargetCard =
    targetCard;

  lockedOptionTargetHost =
    host;

  lockedOptionTargetRectangle = {
    left:
      rectangle.left,
    top:
      rectangle.top,
    width:
      rectangle.width,
    height:
      rectangle.height
  };

  targetCard.style.setProperty(
    "--option-lock-width",
    `${rectangle.width}px`
  );

  targetCard.style.setProperty(
    "--option-lock-height",
    `${rectangle.height}px`
  );

  targetCard.style.setProperty(
    "--option-lock-translate-x",
    "0px"
  );

  targetCard.style.setProperty(
    "--option-lock-translate-y",
    "0px"
  );

  targetCard.classList.add(
    "option-drop-target-locked"
  );

  return targetCard;
}

function stabilizeLockedOptionDropTarget() {
  if (
    !lockedOptionTargetCard ||
    !lockedOptionTargetRectangle
  ) {
    return;
  }

  lockedOptionTargetCard.style.setProperty(
    "--option-lock-translate-x",
    "0px"
  );

  lockedOptionTargetCard.style.setProperty(
    "--option-lock-translate-y",
    "0px"
  );

  const currentRectangle =
    lockedOptionTargetCard
      .getBoundingClientRect();

  const translateX =
    lockedOptionTargetRectangle.left -
    currentRectangle.left;

  const translateY =
    lockedOptionTargetRectangle.top -
    currentRectangle.top;

  lockedOptionTargetCard.style.setProperty(
    "--option-lock-translate-x",
    `${translateX}px`
  );

  lockedOptionTargetCard.style.setProperty(
    "--option-lock-translate-y",
    `${translateY}px`
  );
}

function positionOptionInsertPlaceholder(
  host,
  insertionIndex
) {
  if (!host) {
    return;
  }

  const placeholder =
    ensureOptionDragPlaceholder();

  if (
    placeholder.parentElement !==
    host
  ) {
    host.appendChild(
      placeholder
    );
  }

  const lanes =
    directOptionLanes(
      host
    );

  const hostRectangle =
    host.getBoundingClientRect();

  const nestedController =
    Boolean(
      host.closest(
        ".drop-zone"
      )
    );

  const referenceLane =
    lanes.find(
      lane =>
        (
          Number(
            lane.dataset.optionIndex
          ) || 0
        ) >= insertionIndex
    );

  const lastLane =
    lanes.at(-1) || null;

  if (nestedController) {
    const ordered =
      [...lanes].sort(
        (left, right) =>
          (Number(left.dataset.optionIndex) || 0) -
          (Number(right.dataset.optionIndex) || 0)
      );

    const index =
      clamp(
        Number.isFinite(insertionIndex)
          ? Math.trunc(insertionIndex)
          : ordered.length,
        0,
        ordered.length
      );

    const before =
      index > 0
        ? ordered[index - 1]
        : null;
    const after =
      index < ordered.length
        ? ordered[index]
        : null;

    const beforeRectangle =
      before?.getBoundingClientRect() || null;
    const afterRectangle =
      after?.getBoundingClientRect() || null;

    const top =
      beforeRectangle && afterRectangle
        ? (
            beforeRectangle.bottom +
            afterRectangle.top
          ) / 2
        : afterRectangle
          ? afterRectangle.top - 4
          : beforeRectangle
            ? beforeRectangle.bottom + 4
            : hostRectangle.top + 8;

    const anchor =
      afterRectangle || beforeRectangle;

    const left =
      anchor
        ? anchor.left -
          hostRectangle.left +
          host.scrollLeft -
          host.clientLeft
        : host.scrollLeft + 8;

    const width =
      anchor
        ? anchor.width
        : Math.max(
            24,
            host.clientWidth - 16
          );

    placeholder.style.setProperty(
      "--option-placeholder-left",
      `${Math.max(0, left)}px`
    );
    placeholder.style.setProperty(
      "--option-placeholder-top",
      `${Math.max(
        0,
        top -
          hostRectangle.top +
          host.scrollTop -
          host.clientTop -
          2
      )}px`
    );
    placeholder.style.setProperty(
      "--option-placeholder-width",
      `${Math.max(24, width)}px`
    );
    placeholder.style.setProperty(
      "--option-placeholder-height",
      "4px"
    );

    requestDragPlaceholderVisibility();
    return;
  }

  const ordered =
    [...lanes].sort(
      (left, right) =>
        (Number(left.dataset.optionIndex) || 0) -
        (Number(right.dataset.optionIndex) || 0)
    );

  const index =
    clamp(
      Number.isFinite(insertionIndex)
        ? Math.trunc(insertionIndex)
        : ordered.length,
      0,
      ordered.length
    );

  const before =
    index > 0
      ? ordered[index - 1]
      : null;
  const after =
    index < ordered.length
      ? ordered[index]
      : null;

  const beforeRectangle =
    before?.getBoundingClientRect() || null;
  const afterRectangle =
    after?.getBoundingClientRect() || null;

  const leftViewport =
    beforeRectangle && afterRectangle
      ? (
          beforeRectangle.right +
          afterRectangle.left
        ) / 2
      : afterRectangle
        ? afterRectangle.left - 4
        : beforeRectangle
          ? beforeRectangle.right + 4
          : hostRectangle.left + 8;

  const anchorRectangle =
    afterRectangle || beforeRectangle;

  const topViewport =
    beforeRectangle && afterRectangle
      ? Math.max(
          beforeRectangle.top,
          afterRectangle.top
        )
      : anchorRectangle
        ? anchorRectangle.top
        : hostRectangle.top + 8;

  const bottomViewport =
    beforeRectangle && afterRectangle
      ? Math.min(
          beforeRectangle.bottom,
          afterRectangle.bottom
        )
      : anchorRectangle
        ? anchorRectangle.bottom
        : hostRectangle.bottom - 8;

  const left =
    leftViewport -
    hostRectangle.left +
    host.scrollLeft -
    2;

  const top =
    topViewport -
    hostRectangle.top +
    host.scrollTop;

  const height =
    Math.max(
      24,
      bottomViewport -
      topViewport
    );

  placeholder.style.setProperty(
    "--option-placeholder-left",
    `${Math.max(0, left)}px`
  );
  placeholder.style.setProperty(
    "--option-placeholder-top",
    `${Math.max(0, top)}px`
  );
  placeholder.style.setProperty(
    "--option-placeholder-width",
    "4px"
  );
  placeholder.style.setProperty(
    "--option-placeholder-height",
    `${Math.max(12, height)}px`
  );

  requestDragPlaceholderVisibility();
}

function stepOptionInsertWithWheel(
  controllerId,
  host,
  direction
) {
  if (
    !activeDraggedOptionId ||
    !activeDraggedOptionControllerId ||
    !host ||
    direction === 0
  ) {
    return;
  }

  const lanes =
    directOptionLanes(
      host
    );

  const maximumIndex =
    lanes.length;

  const currentIndex =
    state.dragInsertContainer ===
      `controller:${controllerId}` &&
    Number.isFinite(
      state.dragInsertIndex
    )
      ? state.dragInsertIndex
      : 0;

  const nextIndex =
    clamp(
      currentIndex + direction,
      0,
      maximumIndex
    );

  if (nextIndex === currentIndex) {
    return;
  }

  state.dragInsertContainer =
    `controller:${controllerId}`;
  state.dragInsertIndex =
    nextIndex;

  optionWheelManualHost =
    host;
  optionWheelManualIndex =
    nextIndex;

  positionOptionInsertPlaceholder(
    host,
    nextIndex
  );
}

function setOptionInsertFeedback(
  controllerId,
  host,
  event
) {
  event.preventDefault();
  event.stopPropagation();

  if (
    !host ||
    !activeDraggedOptionId ||
    !activeDraggedOptionControllerId
  ) {
    return;
  }

  const source =
    findControllerOption(
      state.nodes,
      activeDraggedOptionId
    );

  if (
    !source ||
    source.controller.id !==
      activeDraggedOptionControllerId
  ) {
    return;
  }

  if (
    optionContainsController(
      source.option,
      controllerId
    )
  ) {
    event.dataTransfer.dropEffect =
      "none";

    return;
  }

  optionContainerWheelTargetHost = null;
  optionContainerWheelTargetContainerId = null;
  optionContainerWheelDelta = 0;
  optionContainerWheelManualIndex = null;
  optionContainerWheelManualHost = null;

  unlockOptionDropTarget();

  const placeholder =
    ensureOptionDragPlaceholder();

  const lanes =
    directOptionLanes(
      host
    );

  const sameController =
    activeDraggedOptionControllerId ===
    controllerId;

  const comparisonLanes =
    sameController
      ? lanes.filter(
          lane =>
            lane.dataset.optionId !==
            activeDraggedOptionId
        )
      : lanes;

  const nestedController =
    Boolean(
      host.closest(
        ".drop-zone"
      )
    );

  let insertionIndex =
    lanes.length;

  const manualWheelSelectionActive =
    optionWheelManualHost === host &&
    Number.isFinite(
      optionWheelManualIndex
    );

  if (manualWheelSelectionActive) {
    insertionIndex =
      clamp(
        optionWheelManualIndex,
        0,
        lanes.length
      );
  } else if (nestedController) {
    for (
      const lane of
      comparisonLanes
    ) {
      const rectangle =
        lane.getBoundingClientRect();

      if (
        event.clientY <
        rectangle.top +
          rectangle.height / 2
      ) {
        insertionIndex =
          Number(
            lane.dataset.optionIndex
          ) || 0;

        break;
      }
    }
  } else {

    const laneEntries =
      comparisonLanes.map(
        lane => {
          const rectangle =
            lane.getBoundingClientRect();

          return {
            lane,
            rectangle,
            index:
              Number(
                lane.dataset.optionIndex
              ) || 0,
            centerX:
              rectangle.left +
              rectangle.width / 2,
            centerY:
              rectangle.top +
              rectangle.height / 2
          };
        }
      );

    if (laneEntries.length > 0) {
      const rows = [];

      for (const entry of laneEntries) {
        let row =
          rows.find(
            current =>
              Math.abs(
                current.centerY -
                entry.centerY
              ) <= 12
          );

        if (!row) {
          row = {
            centerY:
              entry.centerY,
            entries: []
          };

          rows.push(row);
        }

        row.entries.push(entry);
        row.centerY =
          row.entries.reduce(
            (
              total,
              current
            ) =>
              total +
              current.centerY,
            0
          ) /
          row.entries.length;
      }

      rows.sort(
        (left, right) =>
          left.centerY -
          right.centerY
      );

      const row =
        rows.reduce(
          (
            closest,
            current
          ) =>
            Math.abs(
              current.centerY -
              event.clientY
            ) <
            Math.abs(
              closest.centerY -
              event.clientY
            )
              ? current
              : closest,
          rows[0]
        );

      row.entries.sort(
        (left, right) =>
          left.centerX -
          right.centerX
      );

      insertionIndex =
        row.entries[
          row.entries.length - 1
        ].index + 1;

      for (
        const entry of
        row.entries
      ) {
        if (
          event.clientX <
          entry.centerX
        ) {
          insertionIndex =
            entry.index;

          break;
        }
      }
    }
  }

  state.dragInsertContainer =
    `controller:${controllerId}`;

  state.dragInsertIndex =
    insertionIndex;

  document
    .querySelectorAll(
      ".controller-options.option-drag-over"
    )
    .forEach(currentHost => {
      if (currentHost !== host) {
        currentHost.classList.remove(
          "option-drag-over"
        );
      }
    });

  host.classList.add(
    "option-drag-over"
  );

  event.dataTransfer.dropEffect =
    "move";

  if (
    placeholder.parentElement !==
    host
  ) {
    host.appendChild(
      placeholder
    );
  }

  if (
    optionWheelTargetHost !== host ||
    optionWheelTargetControllerId !==
      controllerId
  ) {
    optionWheelManualIndex = null;
    optionWheelManualHost = null;
  }

  optionWheelTargetHost =
    host;
  optionWheelTargetControllerId =
    controllerId;

  positionOptionInsertPlaceholder(
    host,
    insertionIndex
  );
}

function handleOptionReorderDrop(
  targetControllerId,
  event
) {
  event.preventDefault();
  event.stopPropagation();

  const optionId =
    event.dataTransfer.getData(
      "application/x-rml-option"
    );

  const sourceControllerId =
    event.dataTransfer.getData(
      "application/x-rml-option-controller"
    );

  const insertionIndex =
    state.dragInsertContainer ===
      `controller:${targetControllerId}` &&
    Number.isFinite(
      state.dragInsertIndex
    )
      ? state.dragInsertIndex
      : Number.POSITIVE_INFINITY;

  finishDragInteraction();

  if (
    !optionId ||
    !sourceControllerId
  ) {
    renderAll();
    return;
  }

  if (
    sourceControllerId ===
    targetControllerId
  ) {
    if (
      reorderControllerOption(
        targetControllerId,
        optionId,
        insertionIndex
      )
    ) {
      renderAll();
      return;
    }

    renderAll();
    return;
  }

  const source =
    findControllerOption(
      state.nodes,
      optionId
    );

  if (
    !source ||
    source.controller.id !==
      sourceControllerId
  ) {
    renderAll();
    return;
  }

  if (
    optionContainsController(
      source.option,
      targetControllerId
    )
  ) {
    renderAll();
    return;
  }

  const targetBeforeDetach =
    findNode(
      state.nodes,
      targetControllerId
    );

  if (
    !targetBeforeDetach ||
    targetBeforeDetach.kind !==
      "controller"
  ) {
    renderAll();
    return;
  }

  const detached =
    detachControllerOption(
      sourceControllerId,
      optionId
    );

  if (!detached) {
    renderAll();
    return;
  }

  const targetAfterDetach =
    findNode(
      state.nodes,
      targetControllerId
    );

  if (
    !targetAfterDetach ||
    targetAfterDetach.kind !==
      "controller"
  ) {

    const fallbackController =
      controllerFromDetachedOption(
        detached.option,
        detached.sourceController
      );

    state.nodes = [
      ...state.nodes,
      fallbackController
    ];

    state.selectedId =
      fallbackController.id;

    state.activeContainerId =
      detached.option.id;

    renderAll();
    return;
  }

  const movedOption = {
    ...detached.option,

    name:
      uniqueOptionName(
        targetAfterDetach.options,
        detached.option.name
      )
  };

  state.nodes =
    updateControllerOptions(
      state.nodes,
      targetControllerId,
      options => {
        const index =
          clamp(
            Number.isFinite(
              insertionIndex
            )
              ? Math.trunc(
                  insertionIndex
                )
              : options.length,
            0,
            options.length
          );

        return [
          ...options.slice(
            0,
            index
          ),
          movedOption,
          ...options.slice(
            index
          )
        ];
      }
    );

  state.selectedId =
    targetControllerId;

  state.activeContainerId =
    movedOption.id;

  renderAll();
}

function leaveOptionInsertMode() {
  optionDragFeedbackPlaceholder?.remove();
  optionDragFeedbackPlaceholder = null;

  document
    .querySelectorAll(
      ".controller-options.option-drag-over"
    )
    .forEach(currentHost => {
      currentHost.classList.remove(
        "option-drag-over"
      );
    });

  unlockOptionDropTarget();

  optionWheelTargetHost = null;
  optionWheelTargetControllerId = null;
  optionWheelLastStepTime = 0;
  optionWheelManualIndex = null;
  optionWheelManualHost = null;

  if (
    typeof state.dragInsertContainer ===
      "string" &&
    state.dragInsertContainer.startsWith(
      "controller:"
    )
  ) {
    state.dragInsertContainer = null;
    state.dragInsertIndex = null;
  }
}

function setContainerInsertFeedback(
  containerId,
  host,
  event
) {
  event.preventDefault();
  event.stopPropagation();

  if (!host) {
    return;
  }

  leaveOptionInsertMode();

  const cards =
    directNodeCards(host);
  const comparisonCards =
    cards.filter(
      card =>
        card.dataset.nodeId !==
        activeDraggedNodeId
    );

  const insertionIndex =
    nodeInsertionIndexAtPoint(
      host,
      comparisonCards,
      event.clientX,
      event.clientY
    );

  const targetUnchanged =
    state.dragInsertContainer ===
      containerId &&
    state.dragInsertIndex ===
      insertionIndex;

  state.dragOverContainer =
    containerId;
  state.dragInsertContainer =
    containerId;
  state.dragInsertIndex =
    insertionIndex;

  document
    .querySelectorAll(
      ".option-lane, .layout-row-lane, .builder-canvas"
    )
    .forEach(zone => {
      zone.classList.toggle(
        "drag-over",
        (zone.dataset.container ||
          ROOT_CONTAINER) ===
          containerId
      );
    });

  event.dataTransfer.dropEffect =
    event.dataTransfer.types.includes(
      "application/x-rml-node"
    ) ||
    event.dataTransfer.types.includes(
      "application/x-rml-option"
    )
      ? "move"
      : "copy";

  if (
    targetUnchanged &&
    dragFeedbackPlaceholder?.isConnected &&
    dragFeedbackPlaceholder.hidden !== true &&
    dragFeedbackPlaceholder.parentElement ===
      host
  ) {
    return;
  }

  document
    .querySelectorAll(
      ".node-card.drag-insert-before, .node-card.drag-insert-after"
    )
    .forEach(card => {
      card.classList.remove(
        "drag-insert-before",
        "drag-insert-after"
      );
    });

  positionNodeInsertPlaceholder(
    host,
    insertionIndex
  );
}

function setIndexedDropFeedback(
  card,
  event
) {
  setContainerInsertFeedback(
    card.dataset.parentContainer ||
      ROOT_CONTAINER,
    dropHostForCard(card),
    event
  );
}

function handleDropAt(
  containerId,
  insertionIndex,
  event
) {
  event.preventDefault();
  event.stopPropagation();

  const paletteType =
    event.dataTransfer.getData(
      "application/x-rml-palette"
    );
  const dynamicEditableSourceId =
    event.dataTransfer.getData(
      "application/x-rml-dynamic-editable"
    );
  const nodeId =
    event.dataTransfer.getData(
      "application/x-rml-node"
    );
  const optionId =
    event.dataTransfer.getData(
      "application/x-rml-option"
    );
  const optionControllerId =
    event.dataTransfer.getData(
      "application/x-rml-option-controller"
    );

  finishDragInteraction();

  if (
    optionId &&
    optionControllerId
  ) {
    const detached =
      detachControllerOption(
        optionControllerId,
        optionId
      );

    if (!detached) {
      renderAll();
      return;
    }

    const controller =
      controllerFromDetachedOption(
        detached.option,
        detached.sourceController
      );
    const insertion =
      insertIntoContainerAt(
        state.nodes,
        containerId,
        controller,
        insertionIndex
      );

    state.nodes = insertion.inserted
      ? insertion.nodes
      : [...state.nodes, controller];
    state.selectedId = controller.id;
    state.activeContainerId =
      detached.option.id;
    renderAll();
    return;
  }

  if (
    dynamicEditableSourceId &&
    window.RMLDynamicSettingsBridge &&
    typeof window.RMLDynamicSettingsBridge
      .createFromSource === "function"
  ) {
    window.RMLDynamicSettingsBridge
      .createFromSource(
        dynamicEditableSourceId,
        containerId,
        insertionIndex
      );
    return;
  }

  if (paletteType) {
    const node =
      paletteType === "controller"
        ? makeController()
        : paletteType === LAYOUT_ROW_KIND
          ? makeLayoutRow()
          : makeSetting(paletteType);
    const insertion =
      insertIntoContainerAt(
        state.nodes,
        containerId,
        node,
        insertionIndex
      );

    state.nodes = insertion.inserted
      ? insertion.nodes
      : [...state.nodes, node];
    state.selectedId = node.id;
    state.activeContainerId =
      insertion.inserted
        ? containerId
        : ROOT_CONTAINER;
    renderAll();
    return;
  }

  if (!nodeId) {
    renderAll();
    return;
  }

  const movingNode =
    findNode(
      state.nodes,
      nodeId
    );

  if (
    !movingNode ||
    nodeContainsContainer(
      movingNode,
      containerId
    )
  ) {
    renderAll();
    return;
  }

  const sourceContainerId =
    findNodeContainerId(
      state.nodes,
      nodeId
    );
  const sourceChildren =
    sourceContainerId === null
      ? null
      : containerChildren(
          state.nodes,
          sourceContainerId
        );
  const sourceIndex =
    sourceChildren?.findIndex(
      node => node.id === nodeId
    ) ?? -1;
  let correctedIndex =
    insertionIndex;

  if (
    sourceContainerId === containerId &&
    sourceIndex >= 0 &&
    sourceIndex < correctedIndex
  ) {
    correctedIndex -= 1;
  }

  const removal =
    removeNode(
      state.nodes,
      nodeId
    );

  if (!removal.removed) {
    renderAll();
    return;
  }

  const insertion =
    insertIntoContainerAt(
      removal.nodes,
      containerId,
      removal.removed,
      correctedIndex
    );

  state.nodes = insertion.inserted
    ? insertion.nodes
    : [...removal.nodes, removal.removed];
  state.activeContainerId =
    insertion.inserted
      ? containerId
      : ROOT_CONTAINER;
  state.selectedId = nodeId;
  renderAll();
}

function handleDrop(containerId, event) {
  const children =
    containerChildren(
      state.nodes,
      containerId
    );
  const insertionIndex =
    state.dragInsertContainer ===
      containerId &&
    Number.isFinite(
      state.dragInsertIndex
    )
      ? state.dragInsertIndex
      : children?.length || 0;

  handleDropAt(
    containerId,
    insertionIndex,
    event
  );
}

function pointerOptionFeedbackEvent(
  clientX,
  clientY
) {
  return {
    clientX,
    clientY,

    preventDefault() {
    },

    stopPropagation() {
    },

    dataTransfer: {
      dropEffect: "move",

      types: {
        includes(type) {
          return (
            type ===
            "application/x-rml-option"
          );
        }
      }
    }
  };
}

function createOptionPointerGhost(
  lane
) {
  optionPointerGhost?.remove();

  const ghost =
    lane.cloneNode(true);

  ghost.classList.add(
    "option-pointer-ghost"
  );

  ghost.style.pointerEvents =
    "none";

  ghost.style.userSelect =
    "none";

  ghost.removeAttribute(
    "draggable"
  );

  ghost
    .querySelectorAll(
      "button"
    )
    .forEach(button => {
      button.disabled = true;
    });

  document.body.appendChild(
    ghost
  );

  optionPointerGhost =
    ghost;

  moveOptionPointerGhost(
    optionPointerX,
    optionPointerY
  );
}

function moveOptionPointerGhost(
  clientX,
  clientY
) {
  if (!optionPointerGhost) {
    return;
  }

  optionPointerGhost.style.transform =
    `translate3d(${clientX + 14}px, ` +
    `${clientY + 14}px, 0)`;
}

function clearOptionPointerGhost() {
  optionPointerGhost?.remove();
  optionPointerGhost = null;

  if (optionPointerSourceLane) {
    optionPointerSourceLane.classList.remove(
      "option-pointer-source"
    );

    const ownerCard =
      optionPointerSourceLane.closest(
        ".node-card"
      );

    if (
      ownerCard &&
      Object.hasOwn(
        ownerCard.dataset,
        "pointerDragPreviousDraggable"
      )
    ) {
      const previousValue =
        ownerCard.dataset
          .pointerDragPreviousDraggable;

      if (previousValue) {
        ownerCard.setAttribute(
          "draggable",
          previousValue
        );
      } else {
        ownerCard.removeAttribute(
          "draggable"
        );
      }

      delete ownerCard.dataset
        .pointerDragPreviousDraggable;
    }
  }

  optionPointerSourceLane = null;
}


function createNodePointerGhost(
  card
) {
  nodePointerGhost?.remove();

  const ghost =
    card.cloneNode(true);

  ghost.classList.add(
    "node-pointer-ghost"
  );

  ghost.style.pointerEvents =
    "none";

  ghost.style.userSelect =
    "none";

  ghost.removeAttribute(
    "draggable"
  );

  ghost
    .querySelectorAll(
      "button, input, select, textarea"
    )
    .forEach(control => {
      control.disabled = true;
    });

  document.body.appendChild(
    ghost
  );

  nodePointerGhost =
    ghost;

  moveNodePointerGhost(
    nodePointerX,
    nodePointerY
  );
}

function moveNodePointerGhost(
  clientX,
  clientY
) {
  if (!nodePointerGhost) {
    return;
  }

  nodePointerGhost.style.transform =
    `translate3d(${clientX + 14}px, ` +
    `${clientY + 14}px, 0)`;
}

function clearNodePointerGhost() {
  nodePointerGhost?.remove();
  nodePointerGhost = null;

  if (nodePointerSourceCard) {
    nodePointerSourceCard.classList.remove(
      "node-pointer-source"
    );

    if (
      Object.hasOwn(
        nodePointerSourceCard.dataset,
        "pointerDragPreviousDraggable"
      )
    ) {
      const previousValue =
        nodePointerSourceCard.dataset
          .pointerDragPreviousDraggable;

      if (previousValue) {
        nodePointerSourceCard.setAttribute(
          "draggable",
          previousValue
        );
      } else {
        nodePointerSourceCard.removeAttribute(
          "draggable"
        );
      }

      delete nodePointerSourceCard.dataset
        .pointerDragPreviousDraggable;
    }
  }

  nodePointerSourceCard = null;
}

function palettePointerDragSupported() {
  return (
    typeof window.PointerEvent ===
      "function" ||
    "PointerEvent" in window
  );
}

function normalizePalettePointerPayload(
  payload
) {
  const paletteType =
    String(
      payload?.paletteType ||
      ""
    ).trim();

  if (paletteType) {
    return {
      kind: "palette",
      value: paletteType
    };
  }

  const dynamicSourceId =
    String(
      payload?.dynamicSourceId ||
      ""
    ).trim();

  return dynamicSourceId
    ? {
        kind: "dynamic",
        value: dynamicSourceId
      }
    : null;
}

function consumePalettePointerClick(
  button,
  event = null
) {
  const suppressed =
    button ===
      suppressPaletteClickButton &&
    performance.now() <=
      suppressPaletteClickUntil;

  if (!suppressed) {
    return false;
  }

  suppressPaletteClickButton = null;
  suppressPaletteClickUntil = 0;

  event?.preventDefault?.();
  event?.stopImmediatePropagation?.();

  return true;
}

function clearPendingPalettePointerDrag() {
  palettePointerPendingButton = null;
  palettePointerPendingPayload = null;
  palettePointerPendingId = null;
}

function preparePalettePointerDrag(
  button,
  payload,
  event
) {
  if (
    event.button !== 0 ||
    event.isPrimary === false
  ) {
    return;
  }

  const normalized =
    normalizePalettePointerPayload(
      payload
    );

  if (!normalized) {
    return;
  }

  clearPendingNodePointerDrag();
  clearPendingOptionPointerDrag();
  clearPendingPalettePointerDrag();

  palettePointerPendingButton =
    button;
  palettePointerPendingPayload =
    normalized;
  palettePointerPendingId =
    event.pointerId;
  palettePointerPendingStartX =
    event.clientX;
  palettePointerPendingStartY =
    event.clientY;
}

function createPalettePointerGhost(
  button
) {
  palettePointerGhost?.remove();

  const ghost =
    button.cloneNode(true);

  ghost.classList.add(
    "node-pointer-ghost",
    "palette-pointer-ghost"
  );

  ghost.classList.remove(
    "palette-pointer-source"
  );

  ghost.style.pointerEvents =
    "none";
  ghost.style.userSelect =
    "none";
  ghost.removeAttribute(
    "draggable"
  );
  ghost.disabled = true;

  document.body.appendChild(
    ghost
  );

  palettePointerGhost =
    ghost;

  movePalettePointerGhost(
    palettePointerX,
    palettePointerY
  );
}

function movePalettePointerGhost(
  clientX,
  clientY
) {
  if (!palettePointerGhost) {
    return;
  }

  palettePointerGhost.style.transform =
    `translate3d(${clientX + 14}px, ` +
    `${clientY + 14}px, 0)`;
}

function clearPalettePointerGhost() {
  palettePointerGhost?.remove();
  palettePointerGhost = null;

  palettePointerSourceButton
    ?.classList.remove(
      "palette-pointer-source"
    );

  palettePointerSourceButton = null;
}

function startPalettePointerDrag(
  button,
  payload,
  event
) {
  const primaryMouseButtonHeld =
    event.pointerType !== "mouse" ||
    (event.buttons & 1) === 1;

  if (
    !primaryMouseButtonHeld ||
    event.isPrimary === false
  ) {
    clearPendingPalettePointerDrag();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  clearPendingNodePointerDrag();
  clearPendingOptionPointerDrag();
  clearPendingPalettePointerDrag();

  palettePointerDragActive = true;
  palettePointerId =
    event.pointerId;
  palettePointerX =
    event.clientX;
  palettePointerY =
    event.clientY;
  palettePointerSourceButton =
    button;
  palettePointerPayload =
    payload;

  activeDraggedNodeId = null;
  activeDraggedOptionId = null;
  activeDraggedOptionControllerId = null;

  button.classList.add(
    "palette-pointer-source"
  );

  try {
    button.setPointerCapture(
      event.pointerId
    );
  } catch {
    
  }

  createPalettePointerGhost(
    button
  );

  beginDragScrolling(
    event
  );

  updatePalettePointerTarget(
    event.clientX,
    event.clientY
  );
}

function bindPalettePointerDrag(
  button,
  payload
) {
  if (
    !(button instanceof HTMLElement) ||
    !palettePointerDragSupported() ||
    !normalizePalettePointerPayload(
      payload
    )
  ) {
    return false;
  }

  button.draggable = false;
  button.setAttribute(
    "draggable",
    "false"
  );

  if (
    button.dataset
      .rmlPalettePointerDragBound ===
      "true"
  ) {
    return true;
  }

  button.dataset
    .rmlPalettePointerDragBound =
    "true";

  button.addEventListener(
    "pointerdown",
    event => {
      preparePalettePointerDrag(
        button,
        payload,
        event
      );
    }
  );

  button.addEventListener(
    "dragstart",
    event => {
      event.preventDefault();
    }
  );

  return true;
}

function installPalettePointerDragBridge() {
  Object.defineProperty(
    window,
    "RMLPalettePointerDragBridge",
    {
      value: Object.freeze({
        bindDynamic(
          button,
          sourceId
        ) {
          return bindPalettePointerDrag(
            button,
            {
              dynamicSourceId:
                sourceId
            }
          );
        },

        consumeClick(
          button,
          event = null
        ) {
          return consumePalettePointerClick(
            button,
            event
          );
        },

        settleRelease(
          pointerId,
          clientX,
          clientY,
          afterSequence = 0,
          fallbackPayload = null
        ) {
          const completed =
            palettePointerLastResult;
          const completedAfterSequence =
            Number(completed?.sequence || 0) >
              Number(afterSequence || 0) &&
            completed?.pointerId === pointerId;

          if (completedAfterSequence) {
            return Object.freeze({
              accepted: true,
              path: "document-pointerup",
              result: completed
            });
          }

          if (
            !Number.isFinite(clientX) ||
            !Number.isFinite(clientY)
          ) {
            return Object.freeze({
              accepted: false,
              path: "unavailable",
              reason: "invalid-release-point",
              result: palettePointerLastResult
            });
          }

          const matchingActivePointer =
            palettePointerDragActive === true &&
            palettePointerId === pointerId;

          if (
            palettePointerDragActive === true &&
            !matchingActivePointer
          ) {
            return Object.freeze({
              accepted: false,
              path: "unavailable",
              reason: "different-palette-pointer-is-active",
              result: palettePointerLastResult
            });
          }

          if (!matchingActivePointer) {
            const normalizedFallback =
              normalizePalettePointerPayload(
                fallbackPayload
              );
            const target =
              nodeDropTargetAtPointer(
                clientX,
                clientY,
                null
              );

            if (!normalizedFallback || !target) {
              return Object.freeze({
                accepted: false,
                path: "unavailable",
                reason: "no-matching-active-pointer-or-valid-fallback",
                result: palettePointerLastResult
              });
            }

            const nodeIdsBefore = new Set(
              currentFlattenedNodes()
                .map(entry => String(entry?.node?.id || ""))
                .filter(Boolean)
            );
            clearPendingPalettePointerDrag();
            clearPalettePointerGhost();
            stopDragScrolling();
            clearDragFeedback();

            const inserted =
              insertPalettePointerPayload(
                normalizedFallback,
                target.containerId,
                target.insertionIndex
              );
            if (
              inserted &&
              normalizedFallback.kind !== "dynamic"
            ) {
              renderAll();
            }

            const createdNodeId =
              currentFlattenedNodes()
                .map(entry => String(entry?.node?.id || ""))
                .find(nodeId =>
                  nodeId &&
                  !nodeIdsBefore.has(nodeId)
                ) || "";
            palettePointerTransactionSequence += 1;
            palettePointerLastResult = Object.freeze({
              sequence: palettePointerTransactionSequence,
              pointerId,
              committed: inserted === true,
              inserted: inserted === true,
              payloadKind: normalizedFallback.kind,
              payloadValue: normalizedFallback.value,
              containerId: target.containerId,
              insertionIndex:
                Number.isFinite(target.insertionIndex)
                  ? target.insertionIndex
                  : null,
              createdNodeId,
              point: Object.freeze({
                x: clientX,
                y: clientY
              })
            });
            document.dispatchEvent(
              new CustomEvent(
                "rml-builder:palette-pointer-drop",
                { detail: palettePointerLastResult }
              )
            );

            return Object.freeze({
              accepted:
                inserted === true &&
                Boolean(createdNodeId),
              path: "product-direct-single-settlement",
              reason:
                inserted === true && createdNodeId
                  ? ""
                  : "production-direct-commit-did-not-complete",
              result: palettePointerLastResult
            });
          }

          updatePalettePointerTarget(
            clientX,
            clientY
          );

          if (
            typeof state.dragInsertContainer !==
              "string"
          ) {
            return Object.freeze({
              accepted: false,
              path: "active-pointer-without-target",
              reason: "no-live-outline-drop-target",
              result: palettePointerLastResult
            });
          }

          finishPalettePointerDrag(true);

          const result =
            palettePointerLastResult;
          const committed = Boolean(
            Number(result?.sequence || 0) >
              Number(afterSequence || 0) &&
            result?.pointerId === pointerId &&
            result?.committed === true &&
            result?.inserted === true
          );

          return Object.freeze({
            accepted: committed,
            path: "product-controller-settlement",
            reason: committed
              ? ""
              : "production-commit-did-not-complete",
            result
          });
        },

        getState() {
          const marker =
            document.querySelector(
              ".drag-reorder-placeholder"
            );
          const markerHost =
            marker?.parentElement || null;
          const markerRectangle =
            marker instanceof HTMLElement
              ? marker.getBoundingClientRect()
              : null;
          const markerStyle =
            marker instanceof HTMLElement
              ? getComputedStyle(marker)
              : null;
          const markerVisible = Boolean(
            markerRectangle &&
            marker.hidden !== true &&
            markerStyle?.display !== "none" &&
            markerStyle?.visibility !== "hidden" &&
            markerRectangle.width >= 2 &&
            markerRectangle.height >= 2
          );

          return Object.freeze({
            active: palettePointerDragActive,
            pointerId: palettePointerId,
            point: Object.freeze({
              x: palettePointerX,
              y: palettePointerY
            }),
            payload: palettePointerPayload
              ? Object.freeze({ ...palettePointerPayload })
              : null,
            sourceConnected:
              palettePointerSourceButton?.isConnected === true,
            targetContainerId:
              typeof state.dragInsertContainer === "string"
                ? state.dragInsertContainer
                : "",
            targetInsertionIndex:
              Number.isFinite(state.dragInsertIndex)
                ? state.dragInsertIndex
                : null,
            marker: Object.freeze({
              visible: markerVisible,
              hostId: markerHost?.id || "",
              hostClasses: markerHost?.className || "",
              insideBuilderCanvas: Boolean(
                markerHost &&
                elements.builderCanvas?.contains(markerHost)
              ),
              rectangle: markerRectangle
                ? Object.freeze({
                    left: markerRectangle.left,
                    top: markerRectangle.top,
                    right: markerRectangle.right,
                    bottom: markerRectangle.bottom,
                    width: markerRectangle.width,
                    height: markerRectangle.height
                  })
                : null
            }),
            lastResult: palettePointerLastResult
          });
        }
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );
}

function nodeDropTargetAtPointer(
  clientX,
  clientY,
  excludedNodeId = null
) {
  const canvas =
    elements.builderCanvas;

  if (
    !(canvas instanceof HTMLElement)
  ) {
    return null;
  }

  const canvasRectangle =
    canvas.getBoundingClientRect();

  if (
    !pointInsideRectangle(
      clientX,
      clientY,
      canvasRectangle
    )
  ) {
    return null;
  }

  const hitElements =
    document.elementsFromPoint(
      clientX,
      clientY
    );

  let host = null;
  let containerId = null;

  for (const element of hitElements) {
    if (!(element instanceof Element)) {
      continue;
    }

    if (
      element.closest(
        ".node-pointer-ghost, " +
        ".option-pointer-ghost, " +
        ".drag-reorder-placeholder, " +
        ".option-reorder-placeholder"
      )
    ) {
      continue;
    }

    const outlineTarget =
      outlineDropTargetFromElement(
        element,
        canvas
      );

    if (
      outlineTarget
    ) {
      host =
        outlineTarget.host;

      containerId =
        outlineTarget.containerId;

      break;
    }

    if (
      element === canvas ||
      canvas.contains(element)
    ) {
      host =
        canvas;

      containerId =
        ROOT_CONTAINER;

      break;
    }
  }

  if (
    !host ||
    !containerId
  ) {
    host =
      canvas;

    containerId =
      ROOT_CONTAINER;
  }

  const movingNode =
    excludedNodeId
      ? findNode(
          state.nodes,
          excludedNodeId
        )
      : null;

  if (
    movingNode &&
    containerId !== ROOT_CONTAINER &&
    nodeContainsContainer(
      movingNode,
      containerId
    )
  ) {
    host =
      canvas;

    containerId =
      ROOT_CONTAINER;
  }

  const cards =
    directNodeCards(
      host
    );

  const comparisonCards =
    cards.filter(
      card =>
        !excludedNodeId ||
        card.dataset.nodeId !==
          excludedNodeId
    );

  let insertionIndex =
    cards.length;

  const manualWheelSelectionActive =
    nodeWheelManualHost === host &&
    Number.isFinite(
      nodeWheelManualIndex
    );

  if (manualWheelSelectionActive) {
    insertionIndex =
      clamp(
        nodeWheelManualIndex,
        0,
        cards.length
      );
  } else {
    insertionIndex =
      nodeInsertionIndexAtPoint(
        host,
        comparisonCards,
        clientX,
        clientY
      );
  }

  return {
    host,
    containerId,
    insertionIndex,
    area:
      rectangleArea(
        host.getBoundingClientRect()
      )
  };
}

function setNodePointerTarget(
  containerId,
  host,
  insertionIndex,
  clientX,
  clientY
) {
  if (!host) {
    return;
  }

  clearPointerEdgeFeedback();

  if (
    nodeWheelTargetHost !== host ||
    nodeWheelTargetContainerId !==
      containerId
  ) {
    nodeWheelManualIndex = null;
    nodeWheelManualHost = null;
    nodeWheelDelta = 0;
  }

  nodeWheelTargetHost =
    host;

  nodeWheelTargetContainerId =
    containerId;

  setPointerContainerTarget(
    containerId,
    host,
    insertionIndex,
    pointerOptionFeedbackEvent(
      clientX,
      clientY
    )
  );
}

function updateNodePointerTarget(
  clientX,
  clientY
) {
  if (!nodePointerDragActive) {
    return;
  }

  nodePointerX =
    clientX;
  nodePointerY =
    clientY;

  moveNodePointerGhost(
    clientX,
    clientY
  );

  const target =
    nodeDropTargetAtPointer(
      clientX,
      clientY,
      activeDraggedNodeId
    );

  if (target) {
    setNodePointerTarget(
      target.containerId,
      target.host,
      target.insertionIndex,
      clientX,
      clientY
    );

    return;
  }

  clearPointerEdgeFeedback();

  dragFeedbackPlaceholder?.remove();
  dragFeedbackPlaceholder = null;

  document
    .querySelectorAll(
      ".option-lane.drag-over, .layout-row-lane.drag-over, .builder-canvas.drag-over"
    )
    .forEach(zone => {
      zone.classList.remove(
        "drag-over"
      );
    });

  state.dragOverContainer = null;
  state.dragInsertContainer = null;
  state.dragInsertIndex = null;

  nodeWheelTargetHost = null;
  nodeWheelTargetContainerId = null;
  nodeWheelManualHost = null;
  nodeWheelManualIndex = null;
  nodeWheelDelta = 0;
}

function updatePalettePointerTarget(
  clientX,
  clientY
) {
  if (!palettePointerDragActive) {
    return;
  }

  palettePointerX =
    clientX;
  palettePointerY =
    clientY;

  movePalettePointerGhost(
    clientX,
    clientY
  );

  const target =
    nodeDropTargetAtPointer(
      clientX,
      clientY,
      null
    );

  if (target) {
    setNodePointerTarget(
      target.containerId,
      target.host,
      target.insertionIndex,
      clientX,
      clientY
    );

    return;
  }

  clearPointerEdgeFeedback();

  dragFeedbackPlaceholder?.remove();
  dragFeedbackPlaceholder = null;

  document
    .querySelectorAll(
      ".option-lane.drag-over, .layout-row-lane.drag-over, .builder-canvas.drag-over"
    )
    .forEach(zone => {
      zone.classList.remove(
        "drag-over"
      );
    });

  state.dragOverContainer = null;
  state.dragInsertContainer = null;
  state.dragInsertIndex = null;

  nodeWheelTargetHost = null;
  nodeWheelTargetContainerId = null;
  nodeWheelManualHost = null;
  nodeWheelManualIndex = null;
  nodeWheelDelta = 0;
}

function insertPalettePointerPayload(
  payload,
  containerId,
  insertionIndex
) {
  if (
    !payload ||
    typeof containerId !==
      "string"
  ) {
    return false;
  }

  if (payload.kind === "dynamic") {
    const createFromSource =
      window.RMLDynamicSettingsBridge
        ?.createFromSource;

    if (
      typeof createFromSource !==
        "function"
    ) {
      return false;
    }

    createFromSource(
      payload.value,
      containerId,
      insertionIndex
    );

    return true;
  }

  if (payload.kind !== "palette") {
    return false;
  }

  const node =
    payload.value === "controller"
      ? makeController()
      : payload.value ===
          LAYOUT_ROW_KIND
        ? makeLayoutRow()
        : makeSetting(
            payload.value
          );

  const insertion =
    insertIntoContainerAt(
      state.nodes,
      containerId,
      node,
      insertionIndex
    );

  state.nodes =
    insertion.inserted
      ? insertion.nodes
      : [
          ...state.nodes,
          node
        ];

  state.selectedId =
    node.id;
  state.activeContainerId =
    insertion.inserted
      ? containerId
      : ROOT_CONTAINER;

  return true;
}

function finishPalettePointerDrag(
  commit
) {
  if (!palettePointerDragActive) {
    return;
  }

  const payload =
    palettePointerPayload;
  const sourceButton =
    palettePointerSourceButton;
  const completedPointerId =
    palettePointerId;
  const completedPoint = {
    x: palettePointerX,
    y: palettePointerY
  };
  const nodeIdsBefore =
    new Set(
      currentFlattenedNodes()
        .map(entry => String(entry?.node?.id || ""))
        .filter(Boolean)
    );
  const insertContainer =
    state.dragInsertContainer;
  const insertIndex =
    Number.isFinite(
      state.dragInsertIndex
    )
      ? state.dragInsertIndex
      : Number.POSITIVE_INFINITY;

  palettePointerDragActive = false;

  if (palettePointerVisualFrame) {
    cancelAnimationFrame(
      palettePointerVisualFrame
    );
    palettePointerVisualFrame = 0;
  }

  if (
    sourceButton &&
    palettePointerId !== null &&
    sourceButton.hasPointerCapture?.(
      palettePointerId
    )
  ) {
    sourceButton.releasePointerCapture(
      palettePointerId
    );
  }

  palettePointerId = null;

  clearPalettePointerGhost();
  clearPendingPalettePointerDrag();
  stopDragScrolling();
  clearDragFeedback();

  nodeWheelTargetHost = null;
  nodeWheelTargetContainerId = null;
  nodeWheelDelta = 0;
  nodeWheelManualHost = null;
  nodeWheelManualIndex = null;

  suppressPaletteClickButton =
    sourceButton;
  suppressPaletteClickUntil =
    performance.now() + 350;

  palettePointerPayload = null;

  const inserted =
    commit &&
    typeof insertContainer ===
      "string"
      ? insertPalettePointerPayload(
          payload,
          insertContainer,
          insertIndex
        )
      : false;

  if (
    inserted &&
    payload?.kind !== "dynamic"
  ) {
    renderAll();
  }

  const createdNodeId =
    currentFlattenedNodes()
      .map(entry => String(entry?.node?.id || ""))
      .find(nodeId =>
        nodeId &&
        !nodeIdsBefore.has(nodeId)
      ) || "";
  palettePointerTransactionSequence += 1;
  palettePointerLastResult = Object.freeze({
    sequence: palettePointerTransactionSequence,
    pointerId: completedPointerId,
    committed: commit === true,
    inserted: inserted === true,
    payloadKind: payload?.kind || "",
    payloadValue: payload?.value || "",
    containerId:
      typeof insertContainer === "string"
        ? insertContainer
        : "",
    insertionIndex:
      Number.isFinite(insertIndex)
        ? insertIndex
        : null,
    createdNodeId,
    point: Object.freeze(completedPoint)
  });

  document.dispatchEvent(
    new CustomEvent(
      "rml-builder:palette-pointer-drop",
      {
        detail: palettePointerLastResult
      }
    )
  );
}

function stepNodeInsertWithWheel(
  direction
) {
  if (
    !(
      (
        nodePointerDragActive &&
        activeDraggedNodeId
      ) ||
      (
        palettePointerDragActive &&
        palettePointerPayload
      )
    ) ||
    !nodeWheelTargetHost ||
    !nodeWheelTargetHost.isConnected ||
    !nodeWheelTargetContainerId ||
    direction === 0
  ) {
    return;
  }

  const host =
    nodeWheelTargetHost;

  const containerId =
    nodeWheelTargetContainerId;

  const cards =
    directNodeCards(
      host
    );

  const maximumIndex =
    cards.length;

  const currentIndex =
    nodeWheelManualHost === host &&
    Number.isFinite(
      nodeWheelManualIndex
    )
      ? nodeWheelManualIndex
      : (
          state.dragInsertContainer ===
            containerId &&
          Number.isFinite(
            state.dragInsertIndex
          )
            ? state.dragInsertIndex
            : 0
        );

  const nextIndex =
    clamp(
      currentIndex + direction,
      0,
      maximumIndex
    );

  if (
    nextIndex === currentIndex
  ) {
    return;
  }

  nodeWheelManualHost =
    host;

  nodeWheelManualIndex =
    nextIndex;

  state.dragOverContainer =
    containerId;

  state.dragInsertContainer =
    containerId;

  state.dragInsertIndex =
    nextIndex;

  positionNodeInsertPlaceholder(
    host,
    nextIndex
  );
}

function movePointerNodeToContainer(
  nodeId,
  containerId,
  insertionIndex
) {
  const movingNode =
    findNode(
      state.nodes,
      nodeId
    );

  if (
    !movingNode ||
    nodeContainsContainer(
      movingNode,
      containerId
    )
  ) {
    return false;
  }

  const sourceContainerId =
    findNodeContainerId(
      state.nodes,
      nodeId
    );

  const sourceChildren =
    sourceContainerId === null
      ? null
      : containerChildren(
          state.nodes,
          sourceContainerId
        );

  const sourceIndex =
    sourceChildren?.findIndex(
      node => node.id === nodeId
    ) ?? -1;

  let correctedIndex =
    insertionIndex;

  if (
    sourceContainerId === containerId &&
    sourceIndex >= 0 &&
    sourceIndex < correctedIndex
  ) {
    correctedIndex -= 1;
  }

  const removal =
    removeNode(
      state.nodes,
      nodeId
    );

  if (!removal.removed) {
    return false;
  }

  const insertion =
    insertIntoContainerAt(
      removal.nodes,
      containerId,
      removal.removed,
      correctedIndex
    );

  state.nodes =
    insertion.inserted
      ? insertion.nodes
      : [
          ...removal.nodes,
          removal.removed
        ];

  state.activeContainerId =
    insertion.inserted
      ? containerId
      : ROOT_CONTAINER;

  state.selectedId =
    nodeId;

  return true;
}

function finishNodePointerDrag(
  commit
) {
  if (!nodePointerDragActive) {
    return;
  }

  const nodeId =
    activeDraggedNodeId;

  const insertContainer =
    state.dragInsertContainer;

  const insertIndex =
    Number.isFinite(
      state.dragInsertIndex
    )
      ? state.dragInsertIndex
      : Number.POSITIVE_INFINITY;

  nodePointerDragActive = false;

  if (nodePointerVisualFrame) {
    cancelAnimationFrame(
      nodePointerVisualFrame
    );
    nodePointerVisualFrame = 0;
  }

  if (
    nodePointerSourceCard &&
    nodePointerId !== null &&
    nodePointerSourceCard
      .hasPointerCapture?.(
        nodePointerId
      )
  ) {
    nodePointerSourceCard
      .releasePointerCapture(
        nodePointerId
      );
  }

  nodePointerId = null;

  clearNodePointerGhost();

  if (
    commit &&
    nodeId &&
    typeof insertContainer ===
      "string"
  ) {
    movePointerNodeToContainer(
      nodeId,
      insertContainer,
      insertIndex
    );
  }

  stopDragScrolling();
  clearDragFeedback();

  nodeWheelTargetHost = null;
  nodeWheelTargetContainerId = null;
  nodeWheelDelta = 0;
  nodeWheelManualHost = null;
  nodeWheelManualIndex = null;

  suppressNodeClickId = nodeId;
  suppressNodeClickUntil =
    performance.now() + 350;

  activeDraggedNodeId = null;
  activeDraggedOptionId = null;
  activeDraggedOptionControllerId = null;

  renderAll();
}


function prepareNodePointerDrag(
  card,
  event
) {
  if (
    event.button !== 0 ||
    event.isPrimary === false ||
    event.target?.closest?.(
      "button, input, select, textarea"
    )
  ) {
    return;
  }

  card.dataset.pointerDragPreviousDraggable =
    card.getAttribute(
      "draggable"
    ) || "";

  card.setAttribute(
    "draggable",
    "false"
  );

  nodePointerPendingCard =
    card;
  nodePointerPendingId =
    event.pointerId;
  nodePointerPendingStartX =
    event.clientX;
  nodePointerPendingStartY =
    event.clientY;
}

function clearPendingNodePointerDrag() {
  if (
    nodePointerPendingCard &&
    Object.hasOwn(
      nodePointerPendingCard.dataset,
      "pointerDragPreviousDraggable"
    )
  ) {
    const previousValue =
      nodePointerPendingCard.dataset
        .pointerDragPreviousDraggable;

    if (previousValue) {
      nodePointerPendingCard.setAttribute(
        "draggable",
        previousValue
      );
    } else {
      nodePointerPendingCard.removeAttribute(
        "draggable"
      );
    }

    delete nodePointerPendingCard.dataset
      .pointerDragPreviousDraggable;
  }

  nodePointerPendingCard = null;
  nodePointerPendingId = null;
}

function startNodePointerDrag(
  card,
  event
) {
  const primaryMouseButtonHeld =
    event.pointerType !== "mouse" ||
    (event.buttons & 1) === 1;

  if (
    !primaryMouseButtonHeld ||
    event.isPrimary === false
  ) {
    clearPendingNodePointerDrag();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  nodePointerPendingCard = null;
  nodePointerPendingId = null;

  nodePointerDragActive = true;
  nodePointerId =
    event.pointerId;

  nodePointerX =
    event.clientX;
  nodePointerY =
    event.clientY;

  nodePointerSourceCard =
    card;

  activeDraggedNodeId =
    card.dataset.nodeId;

  activeDraggedOptionId = null;
  activeDraggedOptionControllerId = null;

  if (
    !Object.hasOwn(
      card.dataset,
      "pointerDragPreviousDraggable"
    )
  ) {
    card.dataset.pointerDragPreviousDraggable =
      card.getAttribute(
        "draggable"
      ) || "";
  }

  card.setAttribute(
    "draggable",
    "false"
  );

  card.classList.add(
    "node-pointer-source"
  );

  try {
    card.setPointerCapture(
      event.pointerId
    );
  } catch {
    
  }

  createNodePointerGhost(
    card
  );

  beginDragScrolling(
    event
  );

  updateNodePointerTarget(
    event.clientX,
    event.clientY
  );
}

function setOptionPointerSiblingFeedback(
  edge
) {
  leaveOptionInsertMode();

  document
    .querySelectorAll(
      ".option-sibling-drop-zone.option-sibling-drop-active"
    )
    .forEach(current => {
      current.classList.remove(
        "option-sibling-drop-active"
      );
    });

  edge.classList.add(
    "option-sibling-drop-active"
  );

  const card =
    edge.closest(
      "[data-node-id]"
    );

  if (!card) {
    return;
  }

  const siblingIndex =
    Number(
      card.dataset.siblingIndex
    ) || 0;

  const after =
    edge.dataset.optionSiblingDrop ===
    "after";

  state.dragInsertContainer =
    card.dataset.parentContainer ||
    ROOT_CONTAINER;

  state.dragInsertIndex =
    siblingIndex +
    (after ? 1 : 0);
}

function pointInsideRectangle(
  clientX,
  clientY,
  rectangle
) {
  return (
    clientX >= rectangle.left &&
    clientX <= rectangle.right &&
    clientY >= rectangle.top &&
    clientY <= rectangle.bottom
  );
}

function rectangleArea(
  rectangle
) {
  return Math.max(
    0,
    rectangle.width
  ) * Math.max(
    0,
    rectangle.height
  );
}

function distanceToRectangleEdge(
  clientX,
  clientY,
  rectangle
) {
  return Math.min(
    Math.abs(clientX - rectangle.left),
    Math.abs(clientX - rectangle.right),
    Math.abs(clientY - rectangle.top),
    Math.abs(clientY - rectangle.bottom)
  );
}

function clearPointerEdgeFeedback() {
  document
    .querySelectorAll(
      ".option-sibling-drop-zone.option-sibling-drop-active"
    )
    .forEach(edge => {
      edge.classList.remove(
        "option-sibling-drop-active"
      );
    });
}

function visibleOptionLanes() {
  return Array.from(
    document.querySelectorAll(
      ".option-lane[data-option-id][data-controller-id]"
    )
  ).filter(
    lane =>
      lane instanceof HTMLElement &&
      !lane.closest(
        ".option-pointer-ghost"
      )
  );
}

function visibleNodeCards() {
  return Array.from(
    document.querySelectorAll(
      ".node-card[data-node-id]"
    )
  ).filter(
    card =>
      card instanceof HTMLElement &&
      !card.closest(
        ".option-pointer-ghost"
      )
  );
}

function setPointerContainerTarget(
  containerId,
  host,
  insertionIndex,
  event
) {
  if (!host) {
    return;
  }

  leaveOptionInsertMode();
  clearPointerEdgeFeedback();

  if (optionPointerDragActive) {
    if (
      optionContainerWheelTargetHost !== host ||
      optionContainerWheelTargetContainerId !==
        containerId
    ) {
      optionContainerWheelDelta = 0;
      optionContainerWheelManualIndex = null;
      optionContainerWheelManualHost = null;
    }

    optionContainerWheelTargetHost =
      host;

    optionContainerWheelTargetContainerId =
      containerId;
  }

  state.dragOverContainer =
    containerId;
  state.dragInsertContainer =
    containerId;
  state.dragInsertIndex =
    insertionIndex;

  document
    .querySelectorAll(
      ".option-lane, .layout-row-lane, .builder-canvas"
    )
    .forEach(zone => {
      zone.classList.toggle(
        "drag-over",
        (zone.dataset.container || ROOT_CONTAINER) ===
          containerId
      );
    });

  positionNodeInsertPlaceholder(
    host,
    insertionIndex
  );

  event.dataTransfer.dropEffect =
    "move";
}

function setPointerOptionEdgeTarget(
  target,
  clientX,
  clientY
) {
  if (
    !target?.controllerId ||
    !target.host
  ) {
    return;
  }

  clearPointerEdgeFeedback();

  dragFeedbackPlaceholder?.remove();
  dragFeedbackPlaceholder = null;

  document
    .querySelectorAll(
      ".option-lane.drag-over, .layout-row-lane.drag-over, .builder-canvas.drag-over"
    )
    .forEach(zone => {
      zone.classList.remove(
        "drag-over"
      );
    });

  optionWheelManualHost =
    target.host;

  optionWheelManualIndex =
    target.insertionIndex;

  setOptionInsertFeedback(
    target.controllerId,
    target.host,
    pointerOptionFeedbackEvent(
      clientX,
      clientY
    )
  );
}

function optionContainsContainer(
  option,
  containerId
) {
  if (
    !option ||
    !containerId
  ) {
    return false;
  }

  if (
    option.id ===
    containerId
  ) {
    return true;
  }

  return option.children.some(
    child =>
      nodeContainsContainer(
        child,
        containerId
      )
  );
}

function optionPointerHitElements(
  clientX,
  clientY
) {
  const canvas =
    elements.builderCanvas;

  if (
    !(canvas instanceof HTMLElement)
  ) {
    return [];
  }

  const canvasRectangle =
    canvas.getBoundingClientRect();

  if (
    !pointInsideRectangle(
      clientX,
      clientY,
      canvasRectangle
    )
  ) {
    return [];
  }

  return document
    .elementsFromPoint(
      clientX,
      clientY
    )
    .filter(element => {
      if (!(element instanceof Element)) {
        return false;
      }

      if (
        element.closest(
          ".option-pointer-ghost, " +
          ".node-pointer-ghost, " +
          ".drag-reorder-placeholder, " +
          ".option-reorder-placeholder"
        )
      ) {
        return false;
      }

      return (
        element === canvas ||
        canvas.contains(element)
      );
    });
}

function optionControllerTargetAtPointer(
  clientX,
  clientY
) {
  const source =
    findControllerOption(
      state.nodes,
      activeDraggedOptionId
    );

  if (!source) {
    return null;
  }

  const hitElements =
    optionPointerHitElements(
      clientX,
      clientY
    );

  const checkedCards =
    new Set();

  for (const element of hitElements) {
    const controllerCard =
      element.closest(
        ".node-card.controller[data-node-id]"
      );

    if (
      !(controllerCard instanceof HTMLElement) ||
      checkedCards.has(controllerCard)
    ) {
      continue;
    }

    checkedCards.add(
      controllerCard
    );

    const controllerId =
      controllerCard.dataset.nodeId;

    const host =
      controllerCard.querySelector(
        ":scope > .controller-options"
      );

    if (
      !controllerId ||
      !(host instanceof HTMLElement) ||
      optionContainsController(
        source.option,
        controllerId
      )
    ) {
      continue;
    }

    return {
      host,
      controllerId,
      area:
        rectangleArea(
          controllerCard
            .getBoundingClientRect()
        )
    };
  }

  return null;
}

function optionContainerTargetAtPointer(
  clientX,
  clientY
) {
  const source =
    findControllerOption(
      state.nodes,
      activeDraggedOptionId
    );

  const canvas =
    elements.builderCanvas;

  if (
    !source ||
    !(canvas instanceof HTMLElement)
  ) {
    return null;
  }

  const hitElements =
    optionPointerHitElements(
      clientX,
      clientY
    );

  if (hitElements.length === 0) {
    return null;
  }

  let host = canvas;
  let containerId = ROOT_CONTAINER;

  for (const element of hitElements) {
    const outlineTarget =
      outlineDropTargetFromElement(
        element,
        canvas
      );

    if (
      outlineTarget
    ) {
      const candidateContainerId =
        outlineTarget.containerId;

      if (
        candidateContainerId &&
        !optionContainsContainer(
          source.option,
          candidateContainerId
        )
      ) {
        host =
          outlineTarget.host;
        containerId =
          candidateContainerId;
      }

      break;
    }

    if (
      element === canvas ||
      canvas.contains(element)
    ) {
      host = canvas;
      containerId = ROOT_CONTAINER;
      break;
    }
  }

  const cards =
    directNodeCards(host);

  let insertionIndex =
    cards.length;

  const manualWheelSelectionActive =
    optionContainerWheelManualHost === host &&
    Number.isFinite(
      optionContainerWheelManualIndex
    );

  if (manualWheelSelectionActive) {
    insertionIndex =
      clamp(
        optionContainerWheelManualIndex,
        0,
        cards.length
      );
  } else {
    insertionIndex =
      nodeInsertionIndexAtPoint(
        host,
        cards,
        clientX,
        clientY
      );
  }

  return {
    host,
    containerId,
    insertionIndex,
    area:
      rectangleArea(
        host.getBoundingClientRect()
      )
  };
}

function optionPointerTargetModeAtPoint(
  clientX,
  clientY
) {
  const hitElements =
    optionPointerHitElements(
      clientX,
      clientY
    );

  for (const element of hitElements) {
    const controllerCard =
      element.closest(
        ".node-card.controller[data-node-id]"
      );

    if (
      controllerCard instanceof HTMLElement
    ) {
      const outlineTarget =
        outlineDropTargetFromElement(
          element,
          elements.builderCanvas
        );

      if (
        outlineTarget
      ) {
        const dropZoneOwner =
          outlineTarget.host.closest(
            ".node-card.controller[data-node-id]"
          );

        if (
          dropZoneOwner ===
          controllerCard
        ) {
          return "container";
        }
      }

      return "controller";
    }

    if (
      outlineDropTargetFromElement(
        element,
        elements.builderCanvas
      )
    ) {
      return "container";
    }

    if (
      element === elements.builderCanvas ||
      elements.builderCanvas.contains(
        element
      )
    ) {
      return "container";
    }
  }

  return "auto";
}

function updateOptionPointerTarget(
  clientX,
  clientY
) {
  if (!optionPointerDragActive) {
    return;
  }

  optionPointerX =
    clientX;

  optionPointerY =
    clientY;

  moveOptionPointerGhost(
    clientX,
    clientY
  );

  const targetMode =
    optionPointerTargetModeAtPoint(
      clientX,
      clientY
    );

  const containerTarget =
    targetMode === "controller"
      ? null
      : optionContainerTargetAtPointer(
          clientX,
          clientY
        );

  const controllerTarget =
    targetMode === "container"
      ? null
      : optionControllerTargetAtPointer(
          clientX,
          clientY
        );

  if (containerTarget) {
    setPointerContainerTarget(
      containerTarget.containerId,
      containerTarget.host,
      containerTarget.insertionIndex,
      pointerOptionFeedbackEvent(
        clientX,
        clientY
      )
    );

    return;
  }

  if (controllerTarget) {
    clearPointerEdgeFeedback();

    dragFeedbackPlaceholder?.remove();
    dragFeedbackPlaceholder = null;

    document
      .querySelectorAll(
        ".option-lane.drag-over, .layout-row-lane.drag-over, .builder-canvas.drag-over"
      )
      .forEach(zone => {
        zone.classList.remove(
          "drag-over"
        );
      });

    setOptionInsertFeedback(
      controllerTarget.controllerId,
      controllerTarget.host,
      pointerOptionFeedbackEvent(
        clientX,
        clientY
      )
    );

    return;
  }

  if (targetMode === "auto") {
    const fallbackContainer =
      optionContainerTargetAtPointer(
        clientX,
        clientY
      );

    if (fallbackContainer) {
      setPointerContainerTarget(
        fallbackContainer.containerId,
        fallbackContainer.host,
        fallbackContainer.insertionIndex,
        pointerOptionFeedbackEvent(
          clientX,
          clientY
        )
      );

      return;
    }
  }

  leaveOptionInsertMode();
  clearPointerEdgeFeedback();

  dragFeedbackPlaceholder?.remove();
  dragFeedbackPlaceholder = null;

  document
    .querySelectorAll(
      ".option-lane.drag-over, .layout-row-lane.drag-over, .builder-canvas.drag-over"
    )
    .forEach(zone => {
      zone.classList.remove(
        "drag-over"
      );
    });

  state.dragOverContainer = null;
  state.dragInsertContainer = null;
  state.dragInsertIndex = null;

  optionContainerWheelTargetHost = null;
  optionContainerWheelTargetContainerId = null;
  optionContainerWheelDelta = 0;
  optionContainerWheelManualIndex = null;
  optionContainerWheelManualHost = null;
}

function stepOptionContainerInsertWithWheel(
  direction
) {
  if (
    !optionPointerDragActive ||
    !activeDraggedOptionId ||
    !activeDraggedOptionControllerId ||
    !optionContainerWheelTargetHost ||
    !optionContainerWheelTargetHost.isConnected ||
    !optionContainerWheelTargetContainerId ||
    direction === 0
  ) {
    return false;
  }

  const host =
    optionContainerWheelTargetHost;

  const containerId =
    optionContainerWheelTargetContainerId;

  const cards =
    directNodeCards(host);

  const maximumIndex =
    cards.length;

  const currentIndex =
    optionContainerWheelManualHost === host &&
    Number.isFinite(
      optionContainerWheelManualIndex
    )
      ? optionContainerWheelManualIndex
      : (
          state.dragInsertContainer ===
            containerId &&
          Number.isFinite(
            state.dragInsertIndex
          )
            ? state.dragInsertIndex
            : 0
        );

  const nextIndex =
    clamp(
      currentIndex + direction,
      0,
      maximumIndex
    );

  if (nextIndex === currentIndex) {
    return false;
  }

  optionContainerWheelManualHost =
    host;

  optionContainerWheelManualIndex =
    nextIndex;

  state.dragOverContainer =
    containerId;

  state.dragInsertContainer =
    containerId;

  state.dragInsertIndex =
    nextIndex;

  positionNodeInsertPlaceholder(
    host,
    nextIndex
  );

  return true;
}

function movePointerOptionToController(
  targetControllerId,
  insertionIndex
) {
  const optionId =
    activeDraggedOptionId;

  const sourceControllerId =
    activeDraggedOptionControllerId;

  if (
    !optionId ||
    !sourceControllerId
  ) {
    return;
  }

  if (
    sourceControllerId ===
    targetControllerId
  ) {
    reorderControllerOption(
      targetControllerId,
      optionId,
      insertionIndex
    );

    return;
  }

  const source =
    findControllerOption(
      state.nodes,
      optionId
    );

  if (
    !source ||
    source.controller.id !==
      sourceControllerId ||
    optionContainsController(
      source.option,
      targetControllerId
    )
  ) {
    return;
  }

  const targetBeforeDetach =
    findNode(
      state.nodes,
      targetControllerId
    );

  if (
    !targetBeforeDetach ||
    targetBeforeDetach.kind !==
      "controller"
  ) {
    return;
  }

  const detached =
    detachControllerOption(
      sourceControllerId,
      optionId
    );

  if (!detached) {
    return;
  }

  const targetAfterDetach =
    findNode(
      state.nodes,
      targetControllerId
    );

  if (
    !targetAfterDetach ||
    targetAfterDetach.kind !==
      "controller"
  ) {
    const fallbackController =
      controllerFromDetachedOption(
        detached.option,
        detached.sourceController
      );

    state.nodes = [
      ...state.nodes,
      fallbackController
    ];

    state.selectedId =
      fallbackController.id;

    state.activeContainerId =
      detached.option.id;

    return;
  }

  const movedOption = {
    ...detached.option,

    name:
      uniqueOptionName(
        targetAfterDetach.options,
        detached.option.name
      )
  };

  state.nodes =
    updateControllerOptions(
      state.nodes,
      targetControllerId,
      options => {
        const index =
          clamp(
            Number.isFinite(
              insertionIndex
            )
              ? Math.trunc(
                  insertionIndex
                )
              : options.length,
            0,
            options.length
          );

        return [
          ...options.slice(
            0,
            index
          ),
          movedOption,
          ...options.slice(
            index
          )
        ];
      }
    );

  state.selectedId =
    targetControllerId;

  state.activeContainerId =
    movedOption.id;
}

function movePointerOptionToContainer(
  containerId,
  insertionIndex
) {
  const optionId =
    activeDraggedOptionId;

  const sourceControllerId =
    activeDraggedOptionControllerId;

  if (
    !optionId ||
    !sourceControllerId
  ) {
    return;
  }

  const detached =
    detachControllerOption(
      sourceControllerId,
      optionId
    );

  if (!detached) {
    return;
  }

  const controller =
    controllerFromDetachedOption(
      detached.option,
      detached.sourceController
    );

  const insertion =
    insertIntoContainerAt(
      state.nodes,
      containerId,
      controller,
      insertionIndex
    );

  state.nodes =
    insertion.inserted
      ? insertion.nodes
      : [
          ...state.nodes,
          controller
        ];

  state.selectedId =
    controller.id;

  state.activeContainerId =
    detached.option.id;
}

function finishOptionPointerDrag(
  commit
) {
  if (!optionPointerDragActive) {
    return;
  }

  const insertContainer =
    state.dragInsertContainer;

  const insertIndex =
    Number.isFinite(
      state.dragInsertIndex
    )
      ? state.dragInsertIndex
      : Number.POSITIVE_INFINITY;

  optionPointerDragActive = false;

  if (optionPointerVisualFrame) {
    cancelAnimationFrame(
      optionPointerVisualFrame
    );
    optionPointerVisualFrame = 0;
  }

  if (
    optionPointerSourceLane &&
    optionPointerId !== null &&
    optionPointerSourceLane
      .hasPointerCapture?.(
        optionPointerId
      )
  ) {
    optionPointerSourceLane
      .releasePointerCapture(
        optionPointerId
      );
  }

  optionPointerId = null;

  clearOptionPointerGhost();

  if (
    commit &&
    typeof insertContainer ===
      "string"
  ) {
    if (
      insertContainer.startsWith(
        "controller:"
      )
    ) {
      movePointerOptionToController(
        insertContainer.slice(
          "controller:".length
        ),
        insertIndex
      );
    } else {
      movePointerOptionToContainer(
        insertContainer,
        insertIndex
      );
    }
  }

  stopDragScrolling();
  clearDragFeedback();

  activeDraggedNodeId = null;
  activeDraggedOptionId = null;
  activeDraggedOptionControllerId = null;

  optionContainerWheelTargetHost = null;
  optionContainerWheelTargetContainerId = null;
  optionContainerWheelDelta = 0;
  optionContainerWheelManualIndex = null;
  optionContainerWheelManualHost = null;

  renderAll();
}

function heldOptionWheelTargetIsAuthoritative() {
  if (
    !optionPointerDragActive ||
    !activeDraggedOptionId ||
    !activeDraggedOptionControllerId ||
    !(optionWheelManualHost instanceof HTMLElement) ||
    !optionWheelManualHost.isConnected ||
    optionWheelTargetHost !== optionWheelManualHost ||
    !optionWheelTargetControllerId ||
    !Number.isFinite(optionWheelManualIndex)
  ) {
    return false;
  }

  return (
    state.dragInsertContainer ===
      `controller:${optionWheelTargetControllerId}` &&
    Number.isFinite(state.dragInsertIndex) &&
    state.dragInsertIndex === optionWheelManualIndex
  );
}

function prepareOptionPointerDrag(
  lane,
  event
) {
  if (
    event.button !== 0 ||
    event.isPrimary === false ||
    event.target?.closest?.(
      "button, input, select, textarea"
    )
  ) {
    return;
  }

  clearPendingNodePointerDrag();

  optionPointerPendingLane =
    lane;

  optionPointerPendingId =
    event.pointerId;

  optionPointerPendingStartX =
    event.clientX;

  optionPointerPendingStartY =
    event.clientY;
}

function clearPendingOptionPointerDrag() {
  optionPointerPendingLane = null;
  optionPointerPendingId = null;
}

function startOptionPointerDrag(
  lane,
  event
) {
  if (
    event.isPrimary === false ||
    event.target?.closest?.(
      "button, input, select, textarea"
    )
  ) {
    clearPendingOptionPointerDrag();
    return;
  }

  const primaryMouseButtonHeld =
    event.pointerType !== "mouse" ||
    (event.buttons & 1) === 1;

  if (
    !primaryMouseButtonHeld ||
    event.isPrimary === false
  ) {
    clearPendingOptionPointerDrag();
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  clearPendingNodePointerDrag();
  clearPendingOptionPointerDrag();

  optionPointerDragActive = true;
  optionPointerId =
    event.pointerId;

  optionPointerX =
    event.clientX;

  optionPointerY =
    event.clientY;

  optionPointerSourceLane =
    lane;

  activeDraggedOptionId =
    lane.dataset.optionId;

  activeDraggedOptionControllerId =
    lane.dataset.controllerId;

  activeDraggedNodeId = null;

  const ownerCard =
    lane.closest(
      ".node-card"
    );

  if (ownerCard) {
    ownerCard.dataset.pointerDragPreviousDraggable =
      ownerCard.getAttribute(
        "draggable"
      ) || "";

    ownerCard.setAttribute(
      "draggable",
      "false"
    );
  }

  lane.classList.add(
    "option-pointer-source"
  );

  try {
    lane.setPointerCapture(
      event.pointerId
    );
  } catch {
    
  }

  createOptionPointerGhost(
    lane
  );

  beginDragScrolling(
    event
  );

  updateOptionPointerTarget(
    event.clientX,
    event.clientY
  );
}

function bindCanvasInteractions() {

  rootCanvasInteractionController?.abort();

  rootCanvasInteractionController =
    new AbortController();

  const rootCanvasSignal =
    rootCanvasInteractionController.signal;

  document
    .querySelectorAll(
      ".controller-options"
    )
    .forEach(host => {
      const controllerCard =
        host.closest(
          "[data-node-id]"
        );
      const controllerId =
        controllerCard?.dataset.nodeId;

      if (!controllerId) {
        return;
      }

      host.addEventListener(
        "dragover",
        event => {
          if (
            event.dataTransfer.types.includes(
              "application/x-rml-option"
            )
          ) {
            setOptionInsertFeedback(
              controllerId,
              host,
              event
            );
          }
        }
      );

      host.addEventListener(
        "drop",
        event => {
          if (
            event.dataTransfer.types.includes(
              "application/x-rml-option"
            )
          ) {
            handleOptionReorderDrop(
              controllerId,
              event
            );
          }
        }
      );
    });

  document
    .querySelectorAll(
      "[data-option-id]"
    )
    .forEach(lane => {
      lane.addEventListener(
        "pointerdown",
        event => {
          const nestedNodeCard =
            event.target.closest(
              ".node-card[data-node-id]"
            );

          if (
            nestedNodeCard &&
            nestedNodeCard !==
              lane.closest(
                ".node-card[data-node-id]"
              )
          ) {
            return;
          }

          prepareOptionPointerDrag(
            lane,
            event
          );
          if (
            optionPointerPendingLane === lane &&
            optionPointerPendingId === event.pointerId
          ) {
            event.stopImmediatePropagation();
          }
        }
      );
    });

  document.querySelectorAll("[data-node-id]").forEach(card => {
    card.addEventListener(
      "pointerdown",
      event => {

        const directCard =
          event.target.closest(
            ".node-card[data-node-id]"
          );

        if (directCard !== card) {
          return;
        }

        const directOptionLane =
          event.target.closest(
            ".option-lane[data-option-id]"
          );

        if (
          directOptionLane &&
          card.contains(directOptionLane)
        ) {
          return;
        }

        prepareNodePointerDrag(
          card,
          event
        );
      }
    );

    card
      .querySelectorAll(
        ":scope > [data-option-sibling-drop]"
      )
      .forEach(edge => {
        edge.addEventListener(
          "dragover",
          event => {
            if (
              !event.dataTransfer.types.includes(
                "application/x-rml-option"
              )
            ) {
              return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            leaveOptionInsertMode();

            document
              .querySelectorAll(
                ".option-sibling-drop-zone.option-sibling-drop-active"
              )
              .forEach(current =>
                current.classList.remove(
                  "option-sibling-drop-active"
                )
              );

            edge.classList.add(
              "option-sibling-drop-active"
            );

            event.dataTransfer.dropEffect =
              "move";
          }
        );

        edge.addEventListener(
          "dragleave",
          event => {
            if (
              !edge.contains(
                event.relatedTarget
              )
            ) {
              edge.classList.remove(
                "option-sibling-drop-active"
              );
            }
          }
        );

        edge.addEventListener(
          "drop",
          event => {
            if (
              !event.dataTransfer.types.includes(
                "application/x-rml-option"
              )
            ) {
              return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();

            const siblingIndex =
              Number(
                card.dataset.siblingIndex
              ) || 0;

            const after =
              edge.dataset.optionSiblingDrop ===
              "after";

            edge.classList.remove(
              "option-sibling-drop-active"
            );

            handleDropAt(
              card.dataset.parentContainer ||
                ROOT_CONTAINER,
              siblingIndex +
                (after ? 1 : 0),
              event
            );
          }
        );
      });

    card.addEventListener("click", event => {
      event.stopPropagation();
      const nodeId =
        card.dataset.nodeId;

      if (
        nodeId === suppressNodeClickId &&
        performance.now() <= suppressNodeClickUntil
      ) {
        event.preventDefault();
        suppressNodeClickId = null;
        suppressNodeClickUntil = 0;
        return;
      }

      state.selectedId =
        nodeId;

      state.activeContainerId =
        findNodeContainerId(
          state.nodes,
          nodeId
        ) ?? ROOT_CONTAINER;

      renderAll();
    });
    card.addEventListener("dragover", event => {
      if (
        event.dataTransfer.types.includes(
          "application/x-rml-option"
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setIndexedDropFeedback(
        card,
        event
      );
    });
    card.addEventListener("drop", event => {
      if (
        event.dataTransfer.types.includes(
          "application/x-rml-option"
        )
      ) {
        return;
      }

      handleDropAt(
        card.dataset.parentContainer || ROOT_CONTAINER,
        state.dragInsertIndex ?? (Number(card.dataset.siblingIndex) || 0),
        event
      );
    });
    card.addEventListener(
      "dragend",
      event => {
        if (event.target !== card) {
          return;
        }

        event.stopPropagation();
        finishDragInteraction();
      }
    );
  });
  document.querySelectorAll("[data-move-node]").forEach(button => {
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      moveNodeOneStep(
        button.dataset.moveNode,
        Number(button.dataset.moveDirection)
      );
    });
    button.addEventListener("pointerdown", event => {
      event.stopPropagation();
    });
  });

  document
    .querySelectorAll(
      "[data-move-option]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();
          moveControllerOptionOneStep(
            button.dataset.optionController,
            button.dataset.moveOption,
            Number(
              button.dataset.optionDirection
            )
          );
        }
      );
      button.addEventListener(
        "pointerdown",
        event => {
          event.stopPropagation();
        }
      );
    });

  document.querySelectorAll("[data-delete-node]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const id = button.dataset.deleteNode;
      const result = removeNode(state.nodes, id);
      state.nodes = result.nodes;
      if (state.selectedId === id) state.selectedId = null;
      if (
        result.removed &&
        nodeContainsContainer(result.removed, state.activeContainerId)
      ) {
        state.activeContainerId = ROOT_CONTAINER;
      }
      renderAll();
    });
  });
  document.querySelectorAll("[data-container]").forEach(zone => {
    const containerId = zone.dataset.container;
    zone.addEventListener("click", event => {
      event.stopPropagation();
      state.activeContainerId = containerId;
      renderCanvas();
    });
    zone.addEventListener(
      "dragover",
      event => {
        const optionDrag =
          event.dataTransfer.types.includes(
            "application/x-rml-option"
          );

        const targetControllerId =
          zone.dataset.controllerId;

        if (
          optionDrag &&
          targetControllerId
        ) {
          setOptionInsertFeedback(
            targetControllerId,
            zone.parentElement,
            event
          );

          return;
        }

        const ownDropZone =
          zone.querySelector(
            ":scope > .drop-zone"
          );

        setContainerInsertFeedback(
          containerId,
          ownDropZone,
          event
        );
      }
    );

    zone.addEventListener(
      "drop",
      event => {
        const optionDrag =
          event.dataTransfer.types.includes(
            "application/x-rml-option"
          );

        const targetControllerId =
          zone.dataset.controllerId;

        if (
          optionDrag &&
          targetControllerId
        ) {
          handleOptionReorderDrop(
            targetControllerId,
            event
          );

          return;
        }

        handleDrop(
          containerId,
          event
        );
      }
    );
    zone.addEventListener("dragleave", event => {
      if (!zone.contains(event.relatedTarget)) {
        zone.classList.remove("drag-over");

        if (
          state.dragOverContainer ===
          containerId
        ) {
          state.dragOverContainer = null;
        }
      }
    });
  });

  elements.builderCanvas.onclick = () => {
    state.activeContainerId = ROOT_CONTAINER;
    elements.activeContainerName.textContent = "Root";
  };
  const isDraggedSectionOption =
    event =>
      Array.from(
        event.dataTransfer?.types || []
      ).includes(
        "application/x-rml-option"
      );

  const dragHitTestElement =
    event => {
      const ignoredElements = [
        lockedOptionTargetCard,
        optionDragFeedbackPlaceholder,
        dragFeedbackPlaceholder
      ].filter(
        element =>
          element instanceof HTMLElement &&
          element.isConnected
      );

      const previousStyles =
        ignoredElements.map(
          element => ({
            element,
            value:
              element.style.getPropertyValue(
                "pointer-events"
              ),
            priority:
              element.style.getPropertyPriority(
                "pointer-events"
              )
          })
        );

      for (
        const element of
        ignoredElements
      ) {
        element.style.setProperty(
          "pointer-events",
          "none",
          "important"
        );
      }

      const target =
        document.elementFromPoint(
          event.clientX,
          event.clientY
        );

      for (
        const previous of
        previousStyles
      ) {
        if (previous.value) {
          previous.element.style.setProperty(
            "pointer-events",
            previous.value,
            previous.priority
          );
        } else {
          previous.element.style.removeProperty(
            "pointer-events"
          );
        }
      }

      return target;
    };

  const pointInsideBuilderCanvas =
    event => {
      const rectangle =
        elements.builderCanvas
          .getBoundingClientRect();

      return (
        event.clientX >= rectangle.left &&
        event.clientX <= rectangle.right &&
        event.clientY >= rectangle.top &&
        event.clientY <= rectangle.bottom
      );
    };

  const isRootOptionDropPoint =
    (
      target,
      event
    ) => {
      if (!(target instanceof Element)) {
        return pointInsideBuilderCanvas(
          event
        );
      }

      if (
        !elements.builderCanvas.contains(
          target
        )
      ) {
        return false;
      }

      if (
        target.closest(
          ".controller-options"
        )
      ) {
        return false;
      }

      const card =
        target.closest(
          ".node-card"
        );

      if (!card) {
        return true;
      }

      return (
        card.dataset.parentContainer ===
        ROOT_CONTAINER
      );
    };

  elements.builderCanvas.addEventListener(
    "dragover",
    event => {
      if (
        !isDraggedSectionOption(
          event
        )
      ) {
        return;
      }

      const logicalTarget =
        dragHitTestElement(
          event
        );

      if (
        !isRootOptionDropPoint(
          logicalTarget,
          event
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      leaveOptionInsertMode();

      setContainerInsertFeedback(
        ROOT_CONTAINER,
        elements.builderCanvas,
        event
      );

      event.dataTransfer.dropEffect =
        "move";
    },
    {
      capture: true,
      signal: rootCanvasSignal
    }
  );

  elements.builderCanvas.addEventListener(
    "drop",
    event => {
      if (
        !isDraggedSectionOption(
          event
        )
      ) {
        return;
      }

      const logicalTarget =
        dragHitTestElement(
          event
        );

      if (
        !isRootOptionDropPoint(
          logicalTarget,
          event
        )
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      leaveOptionInsertMode();

      handleDrop(
        ROOT_CONTAINER,
        event
      );
    },
    {
      capture: true,
      signal: rootCanvasSignal
    }
  );

  elements.builderCanvas.addEventListener(
    "dragover",
    event => {
      if (
        isDraggedSectionOption(
          event
        )
      ) {
        return;
      }

      const target =
        event.target;

      if (
        target instanceof Element &&
        target.closest(
          "[data-container]"
        )
      ) {
        return;
      }

      setContainerInsertFeedback(
        ROOT_CONTAINER,
        elements.builderCanvas,
        event
      );
    },
    {
      signal: rootCanvasSignal
    }
  );

  elements.builderCanvas.addEventListener(
    "drop",
    event => {
      if (
        isDraggedSectionOption(
          event
        )
      ) {
        return;
      }

      const target =
        event.target;

      if (
        target instanceof Element &&
        target.closest(
          "[data-container]"
        )
      ) {
        return;
      }

      handleDrop(
        ROOT_CONTAINER,
        event
      );
    },
    {
      signal: rootCanvasSignal
    }
  );
  elements.builderCanvas.ondragleave = event => {
    if (!elements.builderCanvas.contains(event.relatedTarget)) {
      clearDragFeedback();
    }
  };
}

function renderCanvas() {
  elements.itemCount.textContent = String(currentFlattenedNodes().length);
  elements.activeContainerName.textContent = findContainerName(
    state.nodes,
    state.activeContainerId
  );
  elements.builderCanvas.innerHTML =
    state.nodes.length
      ? nodeCardsMarkup(
          state.nodes,
          ROOT_CONTAINER
        )
      : "";
  bindCanvasInteractions();
}

function validatorChoices(node) {
  const choices = [{ value: "none", label: "No custom validation" }];
  if (node.valueType === "float" || node.valueType === "double") {
    choices.push({ value: "finite", label: "Reject NaN and Infinity" });
  }
  if (["int", "float", "double"].includes(node.valueType)) {
    choices.push({ value: "range", label: "Require numeric range" });
  }
  if (node.valueType === "Uri") {
    choices.push({ value: "absolute-uri", label: "Require absolute URI" });
    choices.push({ value: "http-uri", label: "Only HTTP / HTTPS" });
  }
  choices.push({ value: "custom", label: "Custom C# predicate" });
  return choices;
}

function reactionSelectMarkup(value) {
  return `<label>
    Runtime behavior
    <select data-field="reaction">
      ${optionMarkup(
        "stored",
        "Stored only — no generated mod reaction",
        value
      )}
      ${optionMarkup("startup", "Apply at mod startup", value)}
      ${optionMarkup("saved", "Apply after saved changes", value)}
      ${optionMarkup(
        "startup-saved",
        "Apply at startup and after saved changes",
        value
      )}
    </select>
  </label>`;
}

function numericFieldMarkup(
  label,
  value,
  dataField,
  numericType
) {
  const step =
    numericType === "int"
      ? "1"
      : "any";
  const inputMode =
    numericType === "int"
      ? "numeric"
      : "decimal";

  return `<label>
    ${escapeHtml(label)}
    <input
      type="number"
      step="${step}"
      inputmode="${inputMode}"
      value="${escapeHtml(
        numericInputValue(value)
      )}"
      data-field="${escapeHtml(
        dataField
      )}">
  </label>`;
}

function vectorComponentFieldMarkup(
  label,
  value,
  index,
  numericType
) {
  const step =
    numericType === "int"
      ? "1"
      : "any";
  const inputMode =
    numericType === "int"
      ? "numeric"
      : "decimal";

  return `<label class="vector-component">
    ${escapeHtml(label)}
    <input
      type="number"
      step="${step}"
      inputmode="${inputMode}"
      value="${escapeHtml(
        numericInputValue(value)
      )}"
      data-vector-index="${index}"
      aria-label="${escapeHtml(
        `${label} component`
      )}">
  </label>`;
}

function vectorDefaultValueMarkup(
  node
) {
  const componentType =
    numericComponentType(
      node.valueType
    );
  const count =
    componentCount(
      node.valueType
    );
  const values =
    vectorComponentValues(
      node.defaultValue,
      count
    );

  return `<fieldset class="vector-default-editor">
    <legend>Default value</legend>
    <div class="vector-fields vector-fields-${count}">
      ${values
        .map(
          (value, index) =>
            vectorComponentFieldMarkup(
              VECTOR_COMPONENT_NAMES[index],
              value,
              index,
              componentType
            )
        )
        .join("")}
    </div>
  </fieldset>`;
}

function colorXEditorMarkup(
  options = {}
) {
  const expression =
    String(
      options.expression ??
        "colorX.White"
    );
  const profile =
    normalizeColorProfile(
      options.profile
    );
  const strength =
    clamp(
      Number(options.strength) || 1,
      1,
      10
    );
  const preview =
    colorXPreview(
      expression,
      strength,
      profile
    );
  const channels =
    pickerByteChannels(
      preview
    );
  const alphaByte =
    channels.alpha;
  const alphaPercent =
    Math.round(
      alphaByte / 255 * 100
    );
  const hsv =
    rgbToHsv(
      channels.red,
      channels.green,
      channels.blue
    );
  const glowSize =
    strength <= 1.000001
      ? 0
      : 8 + (strength - 1) * 3.2;
  const editorClass =
    String(
      options.editorClass ||
        "color-default-editor"
    )
      .trim() ||
      "color-default-editor";
  const legend =
    String(
      options.legend ||
        "Color"
    );
  const expressionLabel =
    String(
      options.expressionLabel ||
        "C# colorX expression"
    );
  const expressionHelp =
    String(
      options.expressionHelp ||
        "The normalized base color, ColorProfile and HDR strength are stored separately by the builder and emitted together in the generated colorX."
    );
  const expressionField =
    typeof options.expressionField ===
      "string"
      ? options.expressionField.trim()
      : "";
  const expressionFieldAttribute =
    expressionField
      ? ` data-field="${escapeHtml(
          expressionField
        )}"`
      : "";

  return `<fieldset
    class="${escapeHtml(editorClass)}"
    data-color-x-editor>
    <legend>${escapeHtml(legend)}</legend>

    <div class="custom-color-profile-tabs" aria-label="Color profile">
      <button
        type="button"
        class="button secondary${
          profile === "srgb"
            ? " selected"
            : ""
        }"
        data-inspector-color-profile="srgb"${
          strength > 1
            ? " disabled"
            : ""
        }>sRGB</button>
      <button
        type="button"
        class="button secondary${
          profile === "linear"
            ? " selected"
            : ""
        }"
        data-inspector-color-profile="linear">Linear</button>
    </div>

    <div
      class="custom-color-picker-inline${
        preview.custom
          ? " custom-expression"
          : ""
      }"
      data-color-picker-inline
      data-color-preview
      data-color-profile="${profile}"
      data-color-strength="${strength}"
      role="group"
      aria-label="Color picker"
      style="
        --preview-color: ${escapeHtml(preview.cssColor)};
        --preview-text: ${escapeHtml(preview.textColor)};
        --preview-glow: ${escapeHtml(preview.cssColor)};
        --preview-glow-size: ${glowSize}px;
      ">
      <div class="custom-color-picker-body">
        <div
          class="custom-color-sv"
          data-color-sv
          role="slider"
          tabindex="0"
          aria-label="Saturation and brightness"
          aria-valuetext="Saturation ${Math.round(
            hsv.saturation * 100
          )}%, brightness ${Math.round(
            hsv.value * 100
          )}%"
          data-hue="${hsv.hue}"
          data-saturation="${hsv.saturation}"
          data-value="${hsv.value}"
          style="
            --picker-hue: ${hsv.hue};
            --picker-saturation: ${hsv.saturation * 100}%;
            --picker-value-position: ${(1 - hsv.value) * 100}%;
          ">
          <span class="custom-color-sv-marker" aria-hidden="true"></span>
        </div>

        <label class="custom-color-slider-control hue-control">
          <span class="custom-color-control-heading">
            <span>Hue</span>
            <output data-color-hue-output>${Math.round(hsv.hue)}°</output>
          </span>
          <input
            class="custom-color-slider custom-color-hue-slider"
            type="range"
            min="0"
            max="359"
            step="1"
            value="${Math.round(hsv.hue)}"
            data-color-hue
            aria-label="Hue">
        </label>

        <label class="custom-color-slider-control alpha-control">
          <span class="custom-color-control-heading">
            <span>Alpha</span>
            <output data-color-alpha-output>${alphaByte} · ${alphaPercent}%</output>
          </span>
          <input
            class="custom-color-slider custom-color-alpha-slider"
            type="range"
            min="0"
            max="255"
            step="1"
            value="${alphaByte}"
            data-color-alpha
            style="--alpha-color: ${escapeHtml(preview.hex)}"
            aria-label="Alpha">
        </label>

        <label class="custom-color-slider-control strength-control">
          <span class="custom-color-control-heading">
            <span>Strength</span>
            <output data-color-strength-output>${previewColorNumber(
              strength,
              2
            )}</output>
          </span>
          <input
            class="custom-color-slider custom-color-strength-slider"
            type="range"
            min="1"
            max="10"
            step="0.01"
            value="${strength}"
            data-color-strength
            aria-label="Strength">
        </label>

        <div class="custom-color-values custom-color-hsv-values">
          <label>H
            <input type="number" min="0" max="359" step="1"
              value="${Math.round(hsv.hue)}"
              data-color-hsv="hue">
          </label>
          <label>S
            <input type="number" min="0" max="100" step="1"
              value="${Math.round(hsv.saturation * 100)}"
              data-color-hsv="saturation">
          </label>
          <label>V
            <input type="number" min="0" max="100" step="1"
              value="${Math.round(hsv.value * 100)}"
              data-color-hsv="value">
          </label>
        </div>

        <div class="custom-color-values custom-color-rgb-values">
          <label>R
            <input type="number" min="0" max="255" step="1"
              value="${channels.red}"
              data-color-channel="red">
          </label>
          <label>G
            <input type="number" min="0" max="255" step="1"
              value="${channels.green}"
              data-color-channel="green">
          </label>
          <label>B
            <input type="number" min="0" max="255" step="1"
              value="${channels.blue}"
              data-color-channel="blue">
          </label>
          <label class="custom-color-hex-control">Hex
            <input
              type="text"
              value="${escapeHtml(preview.hex.toUpperCase())}"
              maxlength="9"
              spellcheck="false"
              autocomplete="off"
              data-color-hex>
          </label>
        </div>

        <p
          class="custom-color-picker-status"
          data-color-picker-status
          aria-live="polite">${
            preview.custom
              ? "Choosing a color replaces the current custom C# expression."
              : ""
          }</p>
      </div>

      <div class="custom-color-picker-actions">
        <div
          class="custom-color-result"
          data-color-result
          style="
            --result-color: ${escapeHtml(preview.cssColor)};
            --result-glow: ${escapeHtml(preview.cssColor)};
            --result-glow-size: ${glowSize}px;
          ">
          <span aria-hidden="true"></span>
          <strong data-color-result-value>${escapeHtml(
            preview.hex.toUpperCase()
          )} · ${profile === "srgb" ? "sRGB" : "Linear"} · ×${previewColorNumber(
            strength,
            2
          )}</strong>
        </div>
      </div>
    </div>

    <label>
      ${escapeHtml(expressionLabel)}
      <input
        value="${escapeHtml(expression)}"
        data-color-expression${expressionFieldAttribute}
        autocomplete="off">
      <small>${escapeHtml(expressionHelp)}</small>
    </label>
  </fieldset>`;
}

function colorDefaultValueMarkup(
  node
) {
  return colorXEditorMarkup({
    expression:
      node.defaultValue,
    profile:
      node.colorProfile,
    strength:
      node.colorStrength,
    legend:
      "Default color",
    expressionField:
      "defaultValue"
  });
}

function defaultValueMarkup(node) {
  if (node.valueType === "bool") {
    const normalized =
      node.defaultValue
        .trim()
        .toLowerCase() === "false"
        ? "false"
        : "true";

    return `<label>
      Default value
      <select data-field="defaultValue">
        ${optionMarkup(
          "true",
          "true",
          normalized
        )}
        ${optionMarkup(
          "false",
          "false",
          normalized
        )}
      </select>
    </label>`;
  }

  if (node.valueType === "enum") {
    return `<label>
      Default value
      <select data-field="defaultValue">
        ${node.enumOptions
          .map(option =>
            optionMarkup(
              option,
              option,
              node.defaultValue
            )
          )
          .join("")}
      </select>
    </label>`;
  }

  if (
    isScalarNumericType(
      node.valueType
    )
  ) {
    return numericFieldMarkup(
      "Default value",
      node.defaultValue,
      "defaultValue",
      node.valueType
    );
  }

  if (isVectorType(node.valueType)) {
    return vectorDefaultValueMarkup(
      node
    );
  }

  if (node.valueType === "colorX") {
    return colorDefaultValueMarkup(
      node
    );
  }

  return fieldMarkup(
    "Default value",
    node.defaultValue,
    "defaultValue"
  );
}

function settingInspectorMarkup(node) {
  if (node.valueType === "button") {
    return `<div class="inspector-form" data-inspector-id="${escapeHtml(
      node.id
    )}">
      <div class="selection-type">
        <span>BUTTON · IMPULSE</span>
        <button type="button" data-inspector-delete>Delete button</button>
      </div>
      ${fieldMarkup("C# field / impulse name", node.fieldName, "fieldName")}
      ${fieldMarkup("Menu label", node.keyName, "keyName")}
      ${fieldMarkup("Button text", node.buttonLabel || "Run", "buttonLabel")}
      <label>
        Description
        <textarea data-field="description">${escapeHtml(
          node.description
        )}</textarea>
      </label>
      <div class="toggle-row">
        <span>
          <strong>Internal / hidden</strong>
          <small>A runtime menu visibility impulse can expose it later.</small>
        </span>
        <input type="checkbox" data-field="hidden"${
          node.hidden ? " checked" : ""
        }>
      </div>
      <div class="inspector-note">
        After Pack into Node, this item appears on Start / Configuration as a
        direct Impulse output. Every click in the RML mod menu emits exactly
        one pulse. Preview clicks remain local and never call Resonite.
      </div>
    </div>`;
  }

  const scalarNumeric =
    isScalarNumericType(
      node.valueType
    );
  const enumFields =
    node.valueType === "enum"
      ? `<fieldset>
          <legend>Normal enum</legend>
          ${fieldMarkup("Enum type name", node.enumName, "enumName")}
          <label>
            Enum values
            <textarea data-field="enumOptions">${escapeHtml(
              node.enumOptions.join("\n")
            )}</textarea>
          </label>
        </fieldset>`
      : "";
  const showRangeFields =
    scalarNumeric &&
    usesSlider(node);
  const sliderRequiredByValidator =
    node.validatorMode === "range";
  const sliderFields = scalarNumeric
    ? `<div class="toggle-row">
        <span>
          <strong>Use slider</strong>
        </span>
        <input type="checkbox" data-field="useSlider"${
          usesSlider(node)
            ? " checked"
            : ""
        }${
          sliderRequiredByValidator
            ? " disabled"
            : ""
        }>
      </div>
      ${
        showRangeFields
          ? `<div class="split-fields">
              ${numericFieldMarkup(
                "Minimum",
                node.minimum,
                "minimum",
                node.valueType
              )}
              ${numericFieldMarkup(
                "Maximum",
                node.maximum,
                "maximum",
                node.valueType
              )}
            </div>`
          : ""
      }`
    : "";
  const validatorOptions = validatorChoices(node)
    .map(choice =>
      optionMarkup(choice.value, choice.label, node.validatorMode)
    )
    .join("");
  return `<div class="inspector-form" data-inspector-id="${escapeHtml(
    node.id
  )}">
    <div class="selection-type">
      <span>${escapeHtml(node.valueType)}</span>
      <button type="button" data-inspector-delete>Delete setting</button>
    </div>
    ${fieldMarkup("C# field name", node.fieldName, "fieldName")}
    ${fieldMarkup("Configuration key", node.keyName, "keyName")}
    <label>
      Description
      <textarea data-field="description">${escapeHtml(
        node.description
      )}</textarea>
    </label>
    ${defaultValueMarkup(node)}
    ${enumFields}
    <div class="toggle-row">
      <span>
        <strong>Internal / hidden</strong>
      </span>
      <input type="checkbox" data-field="hidden"${
        node.hidden ? " checked" : ""
      }>
    </div>
    ${sliderFields}
    <fieldset>
      <legend>Validity check</legend>
      <label>
        Validator
        <select data-field="validatorMode">${validatorOptions}</select>
      </label>
      ${
        node.validatorMode === "custom"
          ? `<label>
              C# predicate
              <textarea data-field="customValidator" placeholder="value => value != null">${escapeHtml(
                node.customValidator
              )}</textarea>
            </label>`
          : ""
      }
    </fieldset>
    ${reactionSelectMarkup(node.reaction)}
  </div>`;
}

function controllerInspectorMarkup(node) {
  const options = node.options
    .map(
      (option, index) => `<div class="option-editor">
        <input
          value="${escapeHtml(option.name)}"
          data-option-name="${escapeHtml(option.id)}"
          aria-label="Section ${index + 1}">
        <button
          class="remove-option"
          type="button"
          data-remove-option="${escapeHtml(option.id)}"
          ${node.options.length <= 2 ? "disabled" : ""}
          title="Remove section">×</button>
      </div>`
    )
    .join("");
  const defaults = node.options
    .map(option =>
      optionMarkup(option.name, option.name, node.defaultOption)
    )
    .join("");
  return `<div class="inspector-form" data-inspector-id="${escapeHtml(
    node.id
  )}">
    <div class="selection-type">
      <span>SECTION ENUM</span>
      <button type="button" data-inspector-delete>Delete controller</button>
    </div>
    ${fieldMarkup("C# field name", node.fieldName, "fieldName")}
    ${fieldMarkup("Configuration key", node.keyName, "keyName")}
    <label>
      Description
      <textarea data-field="description">${escapeHtml(
        node.description
      )}</textarea>
    </label>
    ${fieldMarkup("Enum type name", node.enumName, "enumName")}
    <fieldset>
      <legend>Sections / enum values</legend>
      ${options}
      <button class="add-option" type="button" data-add-option>
        ＋ Add section
      </button>
    </fieldset>
    <label>
      Default section
      <select data-field="defaultOption">${defaults}</select>
    </label>
    ${reactionSelectMarkup(node.reaction)}
  </div>`;
}

function layoutRowInspectorMarkup(node) {
  return `<div class="inspector-form" data-inspector-id="${escapeHtml(
    node.id
  )}">
    <div class="selection-type">
      <span>INLINE LAYOUT</span>
      <button type="button" data-inspector-delete>Delete row</button>
    </div>
    ${fieldMarkup("Outline label", node.label || "Inline Row", "label")}
    <label>
      Description
      <textarea data-field="description">${escapeHtml(
        node.description || ""
      )}</textarea>
    </label>
    <label>
      Default orientation
      <select data-field="horizontal">
        ${optionMarkup("true", "Horizontal — side by side", String(node.horizontal !== false))}
        ${optionMarkup("false", "Vertical — stacked", String(node.horizontal !== false))}
      </select>
    </label>
    <div class="toggle-row">
      <span>
        <strong>Internal / hidden</strong>
        <small>Hides the complete row by default. Runtime Set Configuration Visibility can expose it later.</small>
      </span>
      <input type="checkbox" data-field="hidden"${
        node.hidden === true
          ? " checked"
          : ""
      }>
    </div>
    <div class="inspector-note">
      Drag settings into this row in Configuration Outline. The packed graph exposes the row on Configuration Menu Instance; Set Configuration Layout can switch it at runtime.
    </div>
  </div>`;
}

function changeSelectedNode(field, value) {
  const id = state.selectedId;
  state.nodes = updateNode(state.nodes, id, node => {
    if (
      node.kind === LAYOUT_ROW_KIND &&
      field === "horizontal"
    ) {
      return {
        ...node,
        horizontal:
          value === true ||
          value === "true"
      };
    }

    if (
      node.kind === "setting" &&
      field === "validatorMode"
    ) {
      return {
        ...node,
        validatorMode: value,
        useSlider:
          value === "range"
            ? true
            : node.useSlider
      };
    }

    if (
      node.kind === "setting" &&
      field === "useSlider"
    ) {
      return {
        ...node,
        useSlider:
          node.validatorMode === "range"
            ? true
            : Boolean(value)
      };
    }

    if (field === "enumOptions" && node.kind === "setting") {
      return {
        ...node,
        enumOptions: value
          .split(/\r?\n/)
          .map(item => item.trim())
          .filter(Boolean)
      };
    }
    return { ...node, [field]: value };
  });
}

function pickerByteChannels(
  preview
) {
  const channels =
    preview.baseChannels ||
    preview.channels ||
    [0.5, 0.5, 0.5, 1];

  return {
    red: clamp(
      Math.round(channels[0] * 255),
      0,
      255
    ),
    green: clamp(
      Math.round(channels[1] * 255),
      0,
      255
    ),
    blue: clamp(
      Math.round(channels[2] * 255),
      0,
      255
    ),
    alpha: clamp(
      Math.round(channels[3] * 255),
      0,
      255
    )
  };
}

function updateCustomColorPicker(
  form,
  preview
) {
  const surface =
    form.querySelector(
      "[data-color-sv]"
    );
  const inlinePicker =
    form.querySelector(
      "[data-color-picker-inline]"
    );

  if (!surface || !inlinePicker) {
    return;
  }

  const channels =
    pickerByteChannels(
      preview
    );
  const derivedHsv =
    rgbToHsv(
      channels.red,
      channels.green,
      channels.blue
    );
  const retainedHue =
    Number(
      surface.dataset.hue
    );
  const hsv = {
    ...derivedHsv,
    hue:
      derivedHsv.saturation > 0 ||
      !Number.isFinite(retainedHue)
        ? derivedHsv.hue
        : retainedHue
  };
  const hex =
    colorBytesToHex(
      channels.red,
      channels.green,
      channels.blue
    ).toUpperCase();
  const profile =
    normalizeColorProfile(
      inlinePicker.dataset.colorProfile ||
      preview.profile
    );
  const strength =
    clamp(
      Number(
        inlinePicker.dataset.colorStrength
      ) || preview.strength || 1,
      1,
      10
    );
  const visualCss =
    colorVisualCss(
      channels.red / 255,
      channels.green / 255,
      channels.blue / 255,
      channels.alpha / 255,
      profile
    );
  const glowSize =
    strength <= 1.000001
      ? 0
      : 8 + (strength - 1) * 3.2;

  inlinePicker.dataset.colorProfile =
    profile;
  inlinePicker.dataset.colorStrength =
    String(strength);
  inlinePicker.style.setProperty(
    "--preview-color",
    visualCss
  );
  inlinePicker.style.setProperty(
    "--preview-glow",
    visualCss
  );
  inlinePicker.style.setProperty(
    "--preview-glow-size",
    `${glowSize}px`
  );

  surface.dataset.hue =
    String(hsv.hue);
  surface.dataset.saturation =
    String(hsv.saturation);
  surface.dataset.value =
    String(hsv.value);
  surface.style.setProperty(
    "--picker-hue",
    String(hsv.hue)
  );
  surface.style.setProperty(
    "--picker-saturation",
    `${hsv.saturation * 100}%`
  );
  surface.style.setProperty(
    "--picker-value-position",
    `${(1 - hsv.value) * 100}%`
  );

  const hueInput =
    form.querySelector(
      "[data-color-hue]"
    );
  const hueOutput =
    form.querySelector(
      "[data-color-hue-output]"
    );
  const alphaInput =
    form.querySelector(
      "[data-color-alpha]"
    );
  const alphaOutput =
    form.querySelector(
      "[data-color-alpha-output]"
    );
  const strengthInput =
    form.querySelector(
      "input[data-color-strength]"
    );
  const strengthOutput =
    form.querySelector(
      "[data-color-strength-output]"
    );
  const hexInput =
    form.querySelector(
      "[data-color-hex]"
    );
  const result =
    form.querySelector(
      "[data-color-result]"
    );
  const resultValue =
    form.querySelector(
      "[data-color-result-value]"
    );

  if (hueInput) {
    hueInput.value =
      String(Math.round(hsv.hue));
  }
  if (hueOutput) {
    hueOutput.textContent =
      `${Math.round(hsv.hue)}°`;
  }

  form
    .querySelectorAll(
      "[data-color-hsv]"
    )
    .forEach(input => {
      const component =
        input.dataset.colorHsv;
      input.value =
        String(
          component === "hue"
            ? Math.round(hsv.hue)
            : Math.round(
                hsv[component] * 100
              )
        );
    });

  if (alphaInput) {
    alphaInput.value =
      String(channels.alpha);
    alphaInput.style.setProperty(
      "--alpha-color",
      hex
    );
  }
  if (alphaOutput) {
    alphaOutput.textContent =
      `${channels.alpha} · ` +
      `${Math.round(channels.alpha / 255 * 100)}%`;
  }
  if (strengthInput) {
    strengthInput.value =
      String(strength);
  }
  if (strengthOutput) {
    strengthOutput.textContent =
      previewColorNumber(
        strength,
        2
      );
  }

  form
    .querySelectorAll(
      "[data-color-channel]"
    )
    .forEach(input => {
      input.value =
        String(
          channels[
            input.dataset.colorChannel
          ]
        );
    });

  if (hexInput) {
    hexInput.value = hex;
  }

  if (result) {
    result.style.setProperty(
      "--result-color",
      visualCss
    );
    result.style.setProperty(
      "--result-glow",
      visualCss
    );
    result.style.setProperty(
      "--result-glow-size",
      `${glowSize}px`
    );
  }

  if (resultValue) {
    resultValue.textContent =
      `${hex} · ` +
      `${profile === "srgb" ? "sRGB" : "Linear"} · ` +
      `×${previewColorNumber(strength, 2)}`;
  }

  form
    .querySelectorAll(
      "[data-inspector-color-profile]"
    )
    .forEach(button => {
      const buttonProfile =
        button.dataset.inspectorColorProfile;
      button.classList.toggle(
        "selected",
        buttonProfile === profile
      );
      button.disabled =
        buttonProfile === "srgb" &&
        strength > 1.000001;
    });
}

function updateColorPreview(
  form,
  expression
) {
  const previewElement =
    form.querySelector(
      "[data-color-preview]"
    );

  if (!previewElement) {
    return;
  }

  const profile =
    normalizeColorProfile(
      previewElement.dataset.colorProfile
    );
  const strength =
    clamp(
      Number(
        previewElement.dataset.colorStrength
      ) || 1,
      1,
      10
    );
  const preview =
    colorXPreview(
      expression,
      strength,
      profile
    );

  previewElement.classList.toggle(
    "custom-expression",
    preview.custom
  );

  updateCustomColorPicker(
    form,
    preview
  );
}

const CANVAS_VISIBLE_INSPECTOR_FIELDS =
  new Set([
    "fieldName",
    "keyName",
    "enumName"
  ]);

function updateInspectorOutput(
  changedField = null
) {
  if (
    changedField === null ||
    CANVAS_VISIBLE_INSPECTOR_FIELDS.has(
      changedField
    )
  ) {
    renderCanvas();
  }

  updateGeneratedOutput();
  persist();
}

function commitColorPickerExpression(
  form,
  expression
) {
  const expressionInput =
    form.querySelector(
      '[data-color-expression], [data-field="defaultValue"]'
    );

  if (!expressionInput) {
    return;
  }

  changeSelectedNode(
    "defaultValue",
    expression
  );
  expressionInput.value =
    expression;

  updateColorPreview(
    form,
    expression
  );
  updateInspectorOutput("defaultValue");
}

function bindCustomColorPickerInteractions(
  form,
  options = {}
) {
  const onCommit =
    typeof options.onCommit ===
      "function"
      ? options.onCommit
      : null;
  const inlinePicker =
    form.querySelector(
      "[data-color-picker-inline]"
    );
  const surface =
    form.querySelector(
      "[data-color-sv]"
    );

  if (
    !inlinePicker ||
    !surface
  ) {
    return;
  }

  const hueInput =
    form.querySelector(
      "[data-color-hue]"
    );
  const hueOutput =
    form.querySelector(
      "[data-color-hue-output]"
    );
  const alphaInput =
    form.querySelector(
      "[data-color-alpha]"
    );
  const strengthInput =
    form.querySelector(
      "input[data-color-strength]"
    );
  const hexInput =
    form.querySelector(
      "[data-color-hex]"
    );
  const hsvInputs =
    Array.from(
      form.querySelectorAll(
        "[data-color-hsv]"
      )
    );
  const channelInputs =
    Array.from(
      form.querySelectorAll(
        "[data-color-channel]"
      )
    );

  const currentProfile =
    () =>
      normalizeColorProfile(
        inlinePicker.dataset.colorProfile
      );

  const currentStrength =
    () =>
      clamp(
        Number(
          inlinePicker.dataset.colorStrength
        ) || 1,
        1,
        10
      );

  const currentAlpha =
    () =>
      alphaInput
        ? clamp(
            Math.round(
              Number(alphaInput.value)
            ),
            0,
            255
          ) / 255
        : 1;

  const currentBaseRgb =
    () => {
      const red =
        Number(
          form.querySelector(
            '[data-color-channel="red"]'
          )?.value
        );
      const green =
        Number(
          form.querySelector(
            '[data-color-channel="green"]'
          )?.value
        );
      const blue =
        Number(
          form.querySelector(
            '[data-color-channel="blue"]'
          )?.value
        );

      return {
        red:
          clamp(
            Number.isFinite(red)
              ? red / 255
              : 0,
            0,
            1
          ),
        green:
          clamp(
            Number.isFinite(green)
              ? green / 255
              : 0,
            0,
            1
          ),
        blue:
          clamp(
            Number.isFinite(blue)
              ? blue / 255
              : 0,
            0,
            1
          )
      };
    };

  const commitState = (
    red,
    green,
    blue,
    alpha = currentAlpha(),
    strength = currentStrength(),
    profile = currentProfile()
  ) => {
    const safeStrength =
      clamp(
        Number(strength) || 1,
        1,
        10
      );
    let safeProfile =
      normalizeColorProfile(profile);

    if (
      safeStrength > 1.000001 &&
      safeProfile === "srgb"
    ) {
      const converted =
        convertColorProfileChannels(
          red,
          green,
          blue,
          "srgb",
          "linear"
        );

      red = converted.red;
      green = converted.green;
      blue = converted.blue;
      safeProfile = "linear";
    }

    red = clamp(red, 0, 1);
    green = clamp(green, 0, 1);
    blue = clamp(blue, 0, 1);
    alpha = clamp(alpha, 0, 1);

    inlinePicker.dataset.colorProfile =
      safeProfile;
    inlinePicker.dataset.colorStrength =
      String(safeStrength);

    const expression =
      buildColorXExpression(
        red,
        green,
        blue,
        alpha,
        safeStrength,
        safeProfile
      );

    if (onCommit) {
      const expressionInput =
        form.querySelector(
          '[data-color-expression], [data-field="defaultValue"]'
        );

      if (expressionInput) {
        expressionInput.value =
          expression;
      }

      updateColorPreview(
        form,
        expression
      );

      onCommit({
        expression,
        profile: safeProfile,
        strength: safeStrength,
        source: "picker"
      });
      return;
    }

    changeSelectedNode(
      "colorProfile",
      safeProfile
    );
    changeSelectedNode(
      "colorStrength",
      safeStrength
    );

    commitColorPickerExpression(
      form,
      expression
    );
  };

  const applyRgb = (
    red,
    green,
    blue,
    alpha = currentAlpha()
  ) => {
    commitState(
      clamp(Number(red) / 255, 0, 1),
      clamp(Number(green) / 255, 0, 1),
      clamp(Number(blue) / 255, 0, 1),
      alpha
    );
  };

  const applyHsv = (
    hue,
    saturation,
    value
  ) => {
    const normalizedHue =
      ((Number(hue) % 360) + 360) % 360;
    const normalizedSaturation =
      clamp(
        Number(saturation),
        0,
        1
      );
    const normalizedValue =
      clamp(
        Number(value),
        0,
        1
      );
    const rgb =
      hsvToRgb(
        normalizedHue,
        normalizedSaturation,
        normalizedValue
      );

    surface.dataset.hue =
      String(normalizedHue);
    surface.dataset.saturation =
      String(normalizedSaturation);
    surface.dataset.value =
      String(normalizedValue);

    applyRgb(
      rgb.red,
      rgb.green,
      rgb.blue
    );
  };

  form
    .querySelectorAll(
      "[data-inspector-color-profile]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const targetProfile =
            normalizeColorProfile(
              button.dataset.inspectorColorProfile
            );
          const sourceProfile =
            currentProfile();

          if (
            targetProfile === "srgb" &&
            currentStrength() > 1.000001
          ) {
            return;
          }

          if (
            targetProfile === sourceProfile
          ) {
            return;
          }

          const base =
            currentBaseRgb();
          const converted =
            convertColorProfileChannels(
              base.red,
              base.green,
              base.blue,
              sourceProfile,
              targetProfile
            );

          commitState(
            converted.red,
            converted.green,
            converted.blue,
            currentAlpha(),
            currentStrength(),
            targetProfile
          );
        }
      );
    });

  strengthInput?.addEventListener(
    "input",
    () => {
      const strength =
        clamp(
          Number(strengthInput.value),
          1,
          10
        );
      const base =
        currentBaseRgb();

      commitState(
        base.red,
        base.green,
        base.blue,
        currentAlpha(),
        strength,
        currentProfile()
      );
    }
  );

  hueInput?.addEventListener(
    "input",
    () => {
      const hue =
        Number(hueInput.value);

      surface.dataset.hue =
        String(hue);

      if (hueOutput) {
        hueOutput.textContent =
          `${Math.round(hue)}°`;
      }

      applyHsv(
        hue,
        Number(
          surface.dataset.saturation
        ),
        Number(
          surface.dataset.value
        )
      );
    }
  );

  const applyHsvInputs = () => {
    const values = {};

    for (const input of hsvInputs) {
      const value =
        Number(input.value);
      const component =
        input.dataset.colorHsv;
      const maximum =
        component === "hue"
          ? 359
          : 100;

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > maximum
      ) {
        return;
      }

      values[component] = value;
    }

    applyHsv(
      values.hue,
      values.saturation / 100,
      values.value / 100
    );
  };

  hsvInputs.forEach(input => {
    input.addEventListener(
      "input",
      applyHsvInputs
    );
  });

  alphaInput?.addEventListener(
    "input",
    () => {
      const base =
        currentBaseRgb();

      commitState(
        base.red,
        base.green,
        base.blue,
        currentAlpha()
      );
    }
  );

  const applyChannelInputs = () => {
    const values = {};

    for (const input of channelInputs) {
      const value =
        Number(input.value);

      if (
        !Number.isFinite(value) ||
        value < 0 ||
        value > 255
      ) {
        return;
      }

      values[
        input.dataset.colorChannel
      ] = value;
    }

    applyRgb(
      values.red,
      values.green,
      values.blue
    );
  };

  channelInputs.forEach(input => {
    input.addEventListener(
      "input",
      applyChannelInputs
    );
  });

  const applyHexInput = () => {
    const parsed =
      parseHexColor(
        hexInput?.value || ""
      );

    if (!parsed) {
      return;
    }

    applyRgb(
      parsed.red,
      parsed.green,
      parsed.blue,
      parsed.alpha === null
        ? currentAlpha()
        : parsed.alpha / 255
    );
  };

  hexInput?.addEventListener(
    "input",
    applyHexInput
  );

  const setSurfaceValue = event => {
    const rectangle =
      surface.getBoundingClientRect();

    if (
      rectangle.width <= 0 ||
      rectangle.height <= 0
    ) {
      return;
    }

    applyHsv(
      Number(surface.dataset.hue),
      clamp(
        (event.clientX - rectangle.left) /
          rectangle.width,
        0,
        1
      ),
      1 -
        clamp(
          (event.clientY - rectangle.top) /
            rectangle.height,
          0,
          1
        )
    );
  };

  let activePointerId = null;

  surface.addEventListener(
    "pointerdown",
    event => {
      if (
        event.isPrimary === false ||
        (event.pointerType === "mouse" &&
          event.button !== 0)
      ) {
        return;
      }

      event.preventDefault();
      activePointerId =
        event.pointerId;
      surface.setPointerCapture?.(
        event.pointerId
      );
      setSurfaceValue(event);
    }
  );

  surface.addEventListener(
    "pointermove",
    event => {
      if (
        event.pointerId !==
        activePointerId
      ) {
        return;
      }

      event.preventDefault();
      setSurfaceValue(event);
    }
  );

  const finishPointer = event => {
    if (
      event.pointerId ===
      activePointerId
    ) {
      activePointerId = null;
    }
  };

  surface.addEventListener(
    "pointerup",
    finishPointer
  );
  surface.addEventListener(
    "pointercancel",
    finishPointer
  );
}

function bindInspectorInteractions() {
  const form = elements.inspectorContent.querySelector("[data-inspector-id]");
  if (!form) return;
  form.querySelectorAll("[data-field]").forEach(input => {
    const eventName =
      input.type === "checkbox" || input.tagName === "SELECT"
        ? "change"
        : "input";
    input.addEventListener(eventName, () => {
      const value = input.type === "checkbox" ? input.checked : input.value;
      changeSelectedNode(input.dataset.field, value);

      if (
        input.dataset.field ===
          "defaultValue" &&
        form.querySelector(
          "[data-color-picker-inline]"
        )
      ) {
        updateColorPreview(
          form,
          value
        );
      }

      if (
        input.dataset.field === "useSlider" ||
        input.dataset.field === "validatorMode"
      ) {
        renderAll();
      } else {
        updateInspectorOutput(
          input.dataset.field
        );
      }
    });

    if (
      input.dataset.field ===
      "enumOptions"
    ) {
      input.addEventListener(
        "change",
        renderAll
      );
    }
  });

  bindCustomColorPickerInteractions(
    form
  );

  const vectorInputs =
    Array.from(
      form.querySelectorAll(
        "[data-vector-index]"
      )
    ).sort(
      (left, right) =>
        Number(
          left.dataset.vectorIndex
        ) -
        Number(
          right.dataset.vectorIndex
        )
    );

  vectorInputs.forEach(input => {
    input.addEventListener(
      "input",
      () => {
        const defaultValue =
          vectorInputs
            .map(component =>
              component.value
            )
            .join(", ");

        changeSelectedNode(
          "defaultValue",
          defaultValue
        );

        updateInspectorOutput(
          "defaultValue"
        );
      }
    );
  });

  form.querySelector("[data-inspector-delete]")?.addEventListener(
    "click",
    () => {
      const result = removeNode(state.nodes, state.selectedId);
      state.nodes = result.nodes;
      state.selectedId = null;
      state.activeContainerId = ROOT_CONTAINER;
      renderAll();
    }
  );
  form.querySelector("[data-add-option]")?.addEventListener("click", () => {
    const node = findNode(state.nodes, state.selectedId);
    if (!node || node.kind !== "controller") return;
    let counter = node.options.length + 1;
    let name = `Section${counter}`;
    while (
      node.options.some(
        option => toPascalCase(option.name) === toPascalCase(name)
      )
    ) {
      counter += 1;
      name = `Section${counter}`;
    }
    state.nodes = updateNode(state.nodes, node.id, current => ({
      ...current,
      options: [
        ...current.options,
        { id: createId("option"), name, children: [] }
      ]
    }));
    renderAll();
  });
  form.querySelectorAll("[data-option-name]").forEach(input => {
    input.addEventListener("input", () => {
      const optionId = input.dataset.optionName;
      state.nodes = updateNode(state.nodes, state.selectedId, current => {
        if (current.kind !== "controller") return current;
        const previous = current.options.find(item => item.id === optionId);
        const nextName = input.value;
        return {
          ...current,
          defaultOption:
            previous && current.defaultOption === previous.name
              ? nextName
              : current.defaultOption,
          options: current.options.map(option =>
            option.id === optionId
              ? { ...option, name: nextName }
              : option
          )
        };
      });
      renderCanvas();
      updateGeneratedOutput();
      persist();
    });
    input.addEventListener("change", renderAll);
  });
  form.querySelectorAll("[data-remove-option]").forEach(button => {
    button.addEventListener("click", () => {
      const optionId = button.dataset.removeOption;
      state.nodes = updateNode(state.nodes, state.selectedId, current => {
        if (current.kind !== "controller" || current.options.length <= 2) {
          return current;
        }
        const nextOptions = current.options.filter(
          option => option.id !== optionId
        );
        return {
          ...current,
          options: nextOptions,
          defaultOption: nextOptions.some(
            option => option.name === current.defaultOption
          )
            ? current.defaultOption
            : nextOptions[0].name
        };
      });
      if (state.activeContainerId === optionId) {
        state.activeContainerId = ROOT_CONTAINER;
      }
      renderAll();
    });
  });
}

function renderInspector() {
  const node = state.selectedId
    ? findNode(state.nodes, state.selectedId)
    : null;
  if (!node) {
    elements.inspectorContent.innerHTML = `
      <div class="empty-inspector">
        <span>⌁</span>
        <h2>Select an outline item</h2>
        <p>Select a setting or Section enum in Configuration Outline to edit its properties here.</p>
      </div>`;
    return;
  }
  elements.inspectorContent.innerHTML =
    node.kind === "controller"
      ? controllerInspectorMarkup(node)
      : node.kind === LAYOUT_ROW_KIND
        ? layoutRowInspectorMarkup(node)
      : settingInspectorMarkup(node);
  bindInspectorInteractions();
  appendInlineRowInspectorControls(
    elements.inspectorContent
      .querySelector(
        "[data-inspector-id]"
      ),
    node,
    () => {
      persist();
      renderAll();
    }
  );
}

function preferredGraphArtifact(
  artifacts,
  graphFiles
) {
  const graphNames = new Set(
    graphFiles.map(file =>
      String(file.name || "")
        .replace(/\\/g, "/")
        .toLowerCase()
    )
  );

  return (
    artifacts.find(artifact =>
      artifact.kind === "source" &&
      [...graphNames].some(name =>
        artifact.relativePath
          .toLowerCase()
          .endsWith(`/${name}`) ||
        artifact.relativePath
          .toLowerCase() === name
      )
    ) ||
    artifacts.find(artifact =>
      artifact.kind === "source" &&
      /\.nodegraph\.cs$/i.test(
        artifact.relativePath
      )
    ) ||
    artifacts.find(artifact =>
      artifact.kind === "source"
    ) ||
    artifacts[0] ||
    null
  );
}

function preferredOutlineArtifact(
  artifacts
) {
  const mainSourceName =
    `${generatedBaseName()}.cs`.toLowerCase();

  return (
    artifacts.find(artifact =>
      artifact.kind === "source" &&
      artifact.projectId === "main-mod" &&
      artifact.fileName.toLowerCase() ===
        mainSourceName
    ) ||
    artifacts.find(artifact =>
      artifact.kind === "source" &&
      artifact.projectId === "main-mod"
    ) ||
    artifacts.find(artifact =>
      artifact.kind === "source"
    ) ||
    artifacts[0] ||
    null
  );
}

function ensureUniversalCustomSelect(select) {
  if (
    !(select instanceof HTMLSelectElement) ||
    select.dataset.rmlNativeSelect === "true" ||
    select._rmlGeneratedCustomSelect
  ) {
    return select?._rmlUniversalCustomSelect || null;
  }

  if (select._rmlUniversalCustomSelect) {
    return select._rmlUniversalCustomSelect;
  }

  const graphOwnedWrapper = select.parentElement;
  if (
    graphOwnedWrapper?.classList.contains(
      "rml-graph-searchable-select"
    ) &&
    !graphOwnedWrapper.classList.contains(
      "rml-universal-custom-select"
    ) &&
    graphOwnedWrapper.querySelector(
      ":scope > .rml-graph-searchable-trigger"
    )
  ) {
    select._rmlGeneratedCustomSelect = true;
    return null;
  }

  if (
    select.classList.contains(
      "rml-graph-searchable-native-select"
    )
  ) {
    select.classList.remove(
      "rml-graph-searchable-native-select"
    );
    select.removeAttribute("aria-hidden");
    select.removeAttribute("tabindex");
  }

  if (
    select.id === "generated-file-select" ||
    select.id === "graph-generated-file-select"
  ) {
    return null;
  }

  const wrapper = document.createElement("div");
  wrapper.className =
    "rml-graph-searchable-select rml-universal-custom-select";

  select.parentNode?.insertBefore(wrapper, select);
  wrapper.appendChild(select);

  select.classList.add("rml-graph-searchable-native-select");
  select.tabIndex = -1;
  select.setAttribute("aria-hidden", "true");

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className =
    "rml-graph-searchable-trigger rml-universal-select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const triggerText = document.createElement("span");
  triggerText.className = "rml-graph-searchable-trigger-text";
  trigger.appendChild(triggerText);
  wrapper.appendChild(trigger);

  const popup = document.createElement("div");
  popup.className =
    "rml-graph-searchable-popup rml-universal-select-popup";
  popup.hidden = true;

  const search = document.createElement("input");
  search.type = "search";
  search.className = "rml-graph-searchable-search";
  search.placeholder = "Search…";
  search.autocomplete = "off";
  search.spellcheck = false;
  search.setAttribute("aria-label", "Search options");

  const optionsHost = document.createElement("div");
  optionsHost.className = "rml-graph-searchable-options";
  optionsHost.setAttribute("role", "listbox");

  popup.append(search, optionsHost);

  let opened = false;
  let entries = [];
  let renderedButtons = [];
  let focusedIndex = -1;

  const readEntries = () => {
    entries = [...select.options].map(option => ({
      value: option.value,
      text: option.textContent || option.label || option.value,
      disabled: option.disabled,
      group: option.parentElement instanceof HTMLOptGroupElement
        ? option.parentElement.label
        : ""
    }));
    search.hidden = entries.length <= 8;
  };

  const selectedEntry = () => {
    const value = String(select.value ?? "");
    return entries.find(entry => entry.value === value) || entries[0] || null;
  };

  const updateTrigger = () => {
    readEntries();
    const entry = selectedEntry();
    const text = entry?.text || "Select…";
    triggerText.textContent = text;
    trigger.title = text;
    trigger.disabled = select.disabled || entries.length === 0;
  };

  const positionPopup = () => {
    if (!opened) return;

    const rect = trigger.getBoundingClientRect();
    const viewport = window.visualViewport;
    const viewportLeft = viewport?.offsetLeft || 0;
    const viewportTop = viewport?.offsetTop || 0;
    const viewportWidth = viewport?.width || window.innerWidth;
    const viewportHeight = viewport?.height || window.innerHeight;
    const margin = 8;
    const gap = 5;
    const desiredWidth = Math.max(rect.width, 180);
    const width = Math.min(
      desiredWidth,
      Math.max(160, viewportWidth - margin * 2)
    );

    const popupHost =
      popup.parentElement;
    const dialogHost =
      popupHost instanceof
        HTMLDialogElement
        ? popupHost
        : null;

    popup.style.position =
      dialogHost
        ? "absolute"
        : "fixed";

    popup.style.width = `${Math.round(width)}px`;
    popup.style.maxWidth =
      `${Math.max(160, viewportWidth - margin * 2)}px`;

    const viewportLeftPosition = Math.min(
      viewportLeft + viewportWidth - width - margin,
      Math.max(viewportLeft + margin, rect.left)
    );

    const measuredHeight = popup.getBoundingClientRect().height || 180;
    const below =
      viewportTop + viewportHeight - rect.bottom - margin - gap;
    const above = rect.top - viewportTop - margin - gap;

    const viewportTopPosition = measuredHeight > below && above > below
      ? rect.top - measuredHeight - gap
      : Math.min(
          viewportTop + viewportHeight - measuredHeight - margin,
          rect.bottom + gap
        );

    const clampedViewportTop =
      Math.max(
        viewportTop + margin,
        viewportTopPosition
      );

    if (dialogHost) {
      const hostRect =
        dialogHost.getBoundingClientRect();
      const hostPaddingLeft =
        hostRect.left +
        dialogHost.clientLeft;
      const hostPaddingTop =
        hostRect.top +
        dialogHost.clientTop;

      popup.style.left = `${Math.round(
        viewportLeftPosition -
        hostPaddingLeft +
        dialogHost.scrollLeft
      )}px`;

      popup.style.top = `${Math.round(
        clampedViewportTop -
        hostPaddingTop +
        dialogHost.scrollTop
      )}px`;
    } else {
      popup.style.left = `${Math.round(
        viewportLeftPosition
      )}px`;

      popup.style.top = `${Math.round(
        clampedViewportTop
      )}px`;
    }
  };

  const closePopup = (restoreFocus = false) => {
    if (!opened) return;

    opened = false;
    wrapper.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    popup.hidden = true;
    popup.remove();

    document.removeEventListener("pointerdown", onDocumentPointerDown, true);
    window.removeEventListener("resize", positionPopup);
    window.visualViewport?.removeEventListener("resize", positionPopup);
    window.visualViewport?.removeEventListener("scroll", closeOnRootScroll);
    document.removeEventListener("scroll", closeOnRootScroll, true);
    window.removeEventListener("scroll", closeOnRootScroll, true);

    if (restoreFocus) {
      trigger.focus({ preventScroll: true });
    }
  };

  const choose = value => {
    const next = String(value ?? "");
    const entry = entries.find(item => item.value === next);
    if (!entry || entry.disabled) return;

    const changed = select.value !== next;
    select.value = next;
    updateTrigger();
    closePopup(true);

    if (changed) {
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };

  const renderOptions = () => {
    const query = search.value.trim().toLowerCase();
    const selectedValue = String(select.value ?? "");

    optionsHost.replaceChildren();
    renderedButtons = [];
    focusedIndex = -1;
    let lastGroup = null;

    for (const entry of entries) {
      if (
        query &&
        !entry.text.toLowerCase().includes(query) &&
        !entry.value.toLowerCase().includes(query)
      ) {
        continue;
      }

      if (entry.group && entry.group !== lastGroup) {
        const heading = document.createElement("div");
        heading.className = "rml-universal-select-group";
        heading.textContent = entry.group;
        optionsHost.appendChild(heading);
        lastGroup = entry.group;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "rml-graph-searchable-option";
      button.textContent = entry.text;
      button.dataset.value = entry.value;
      button.disabled = entry.disabled;
      button.setAttribute("role", "option");
      button.setAttribute(
        "aria-selected",
        entry.value === selectedValue ? "true" : "false"
      );
      button.classList.toggle("selected", entry.value === selectedValue);
      button.addEventListener("click", () => choose(entry.value));
      optionsHost.appendChild(button);
      renderedButtons.push(button);
    }

    if (renderedButtons.length === 0) {
      const empty = document.createElement("div");
      empty.className = "rml-graph-searchable-empty";
      empty.textContent = "No matching options";
      optionsHost.appendChild(empty);
    }

    const selectedIndex = renderedButtons.findIndex(button =>
      button.dataset.value === selectedValue
    );
    focusedIndex = selectedIndex >= 0 ? selectedIndex : 0;
    renderedButtons[focusedIndex]?.focus({ preventScroll: true });
  };

  const closeOnRootScroll = event => {
    if (
      event?.target instanceof Node &&
      popup.contains(event.target)
    ) {
      return;
    }
    closePopup(false);
  };

  const openPopup = () => {
    if (opened || trigger.disabled) return;

    updateTrigger();
    opened = true;
    wrapper.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    popup.hidden = false;
    const popupHost =
      trigger.closest("dialog[open]") ||
      document.body;
    popupHost.appendChild(popup);
    search.value = "";
    renderOptions();
    positionPopup();

    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    window.addEventListener("resize", positionPopup);
    window.visualViewport?.addEventListener("resize", positionPopup);
    window.visualViewport?.addEventListener("scroll", closeOnRootScroll, { passive: true });
    document.addEventListener("scroll", closeOnRootScroll, { capture: true, passive: true });
    window.addEventListener("scroll", closeOnRootScroll, { capture: true, passive: true });

    if (!search.hidden) {
      search.focus({ preventScroll: true });
    }
  };

  function onDocumentPointerDown(event) {
    if (
      !wrapper.contains(event.target) &&
      !popup.contains(event.target)
    ) {
      closePopup(false);
    }
  }

  const moveFocus = delta => {
    if (!renderedButtons.length) return;
    focusedIndex = Math.max(
      0,
      Math.min(renderedButtons.length - 1, focusedIndex + delta)
    );
    renderedButtons[focusedIndex]?.focus({ preventScroll: true });
  };

  const popupKeyDown = event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closePopup(true);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusedIndex = 0;
      renderedButtons[0]?.focus({ preventScroll: true });
    } else if (event.key === "End") {
      event.preventDefault();
      focusedIndex = renderedButtons.length - 1;
      renderedButtons[focusedIndex]?.focus({ preventScroll: true });
    }
  };

  trigger.addEventListener("click", () => {
    opened ? closePopup(true) : openPopup();
  });
  trigger.addEventListener("keydown", event => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openPopup();
    }
  });
  search.addEventListener("input", renderOptions);
  search.addEventListener("keydown", popupKeyDown);
  optionsHost.addEventListener("keydown", popupKeyDown);
  select.addEventListener("change", updateTrigger);

  const optionObserver = new MutationObserver(updateTrigger);
  optionObserver.observe(select, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["disabled", "label", "value", "selected"]
  });

  const api = {
    wrapper,
    trigger,
    popup,
    refresh: updateTrigger,
    close: closePopup
  };

  select._rmlUniversalCustomSelect = api;
  updateTrigger();
  return api;
}

function installUniversalCustomSelects(root = document) {
  if (root instanceof HTMLSelectElement) {
    ensureUniversalCustomSelect(root);
    return;
  }

  root.querySelectorAll?.("select").forEach(
    ensureUniversalCustomSelect
  );
}

let universalCustomSelectObserver = null;

function startUniversalCustomSelectObserver() {
  installUniversalCustomSelects(document);

  if (universalCustomSelectObserver) return;

  universalCustomSelectObserver = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        installUniversalCustomSelects(node);
      }
    }
  });

  universalCustomSelectObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function generatedCodeForCurrentView() {
  const graphViewActive =
    Boolean(
      isPlainObject(state.extensions) &&
      isPlainObject(
        state.extensions.typedNodeGraph
      ) &&
      state.extensions.typedNodeGraph
        .active === true
    );

  const catalog =
    buildGeneratedArtifactCatalog(
      true,
      true
    );
  const artifacts = catalog.artifacts;
  const graphFiles =
    getAdditionalGeneratedSourceFiles();
  const currentKey = graphViewActive
    ? generatedGraphArtifactKey
    : generatedOutlineArtifactKey;

  let selected = artifacts.find(
    artifact =>
      artifact.key === currentKey
  );

  if (!selected) {
    selected = graphViewActive
      ? preferredGraphArtifact(
          artifacts,
          graphFiles
        )
      : preferredOutlineArtifact(
          artifacts
        );
  }

  if (graphViewActive) {
    generatedGraphArtifactKey =
      selected?.key || "";
  } else {
    generatedOutlineArtifactKey =
      selected?.key || "";
  }

  return {
    graphActive: graphViewActive,
    artifacts,
    selectedArtifact: selected,
    code:
      selected?.content ||
      "// No generated project file is available yet.\n"
  };
}

function ensureGeneratedArtifactCustomSelect(select) {
  if (!select) {
    return null;
  }

  if (select._rmlGeneratedCustomSelect) {
    return select._rmlGeneratedCustomSelect;
  }

  const wrapper =
    document.createElement("div");
  wrapper.className =
    "rml-graph-searchable-select rml-generated-file-custom-select";

  select.parentNode?.insertBefore(
    wrapper,
    select
  );
  wrapper.appendChild(select);

  select.classList.add(
    "rml-graph-searchable-native-select"
  );
  select.tabIndex = -1;
  select.setAttribute(
    "aria-hidden",
    "true"
  );

  const trigger =
    document.createElement("button");
  trigger.type = "button";
  trigger.className =
    "rml-graph-searchable-trigger rml-generated-file-trigger";
  trigger.setAttribute(
    "aria-haspopup",
    "listbox"
  );
  trigger.setAttribute(
    "aria-expanded",
    "false"
  );

  const triggerText =
    document.createElement("span");
  triggerText.className =
    "rml-graph-searchable-trigger-text";
  trigger.appendChild(triggerText);
  wrapper.appendChild(trigger);

  const popup =
    document.createElement("div");
  popup.className =
    "rml-graph-searchable-popup rml-generated-file-popup";
  popup.hidden = true;

  const search =
    document.createElement("input");
  search.type = "search";
  search.className =
    "rml-graph-searchable-search";
  search.placeholder = "Search generated file…";
  search.autocomplete = "off";
  search.spellcheck = false;
  search.setAttribute(
    "aria-label",
    "Search generated file"
  );

  const optionsHost =
    document.createElement("div");
  optionsHost.className =
    "rml-graph-searchable-options rml-generated-file-options";
  optionsHost.setAttribute(
    "role",
    "listbox"
  );

  popup.append(
    search,
    optionsHost
  );

  let opened = false;
  let entries = [];
  let renderedButtons = [];

  const selectedEntry = () => {
    const value = String(select.value || "");
    return (
      entries.find(entry =>
        entry.value === value
      ) ||
      entries[0] ||
      null
    );
  };

  const updateTrigger = () => {
    const entry = selectedEntry();
    const text =
      entry?.text ||
      "Select generated file…";

    triggerText.textContent = text;
    trigger.title = text;
    trigger.disabled =
      entries.length === 0;
  };

  const positionPopup = () => {
    if (!opened) {
      return;
    }

    const rectangle =
      trigger.getBoundingClientRect();
    const viewport =
      window.visualViewport;
    const viewportLeft =
      viewport?.offsetLeft || 0;
    const viewportTop =
      viewport?.offsetTop || 0;
    const viewportWidth =
      viewport?.width || window.innerWidth;
    const viewportHeight =
      viewport?.height || window.innerHeight;
    const margin = 8;
    const gap = 5;
    const desiredWidth =
      Math.max(
        rectangle.width,
        260
      );
    const width =
      Math.min(
        desiredWidth,
        Math.max(
          180,
          viewportWidth - margin * 2
        )
      );

    popup.style.width = `${Math.round(width)}px`;
    popup.style.maxWidth =
      `${Math.max(180, viewportWidth - margin * 2)}px`;

    const left = Math.min(
      viewportLeft + viewportWidth - width - margin,
      Math.max(
        viewportLeft + margin,
        rectangle.left
      )
    );

    popup.style.left =
      `${Math.round(left)}px`;
    popup.style.top =
      `${Math.round(rectangle.bottom + gap)}px`;

    const measuredHeight =
      popup.getBoundingClientRect().height;
    const below =
      viewportTop + viewportHeight -
      rectangle.bottom - margin - gap;
    const above =
      rectangle.top - viewportTop - margin - gap;

    const top =
      measuredHeight > below && above > below
        ? rectangle.top - measuredHeight - gap
        : Math.min(
            viewportTop + viewportHeight -
              measuredHeight - margin,
            rectangle.bottom + gap
          );

    popup.style.top =
      `${Math.round(
        Math.max(
          viewportTop + margin,
          top
        )
      )}px`;
  };

  const closePopup = (
    restoreFocus = false
  ) => {
    if (!opened) {
      return;
    }

    opened = false;
    wrapper.classList.remove("open");
    trigger.setAttribute(
      "aria-expanded",
      "false"
    );
    popup.hidden = true;
    popup.remove();

    document.removeEventListener(
      "pointerdown",
      onDocumentPointerDown,
      true
    );
    window.removeEventListener(
      "resize",
      positionPopup
    );
    window.visualViewport
      ?.removeEventListener(
        "resize",
        positionPopup
      );
    window.visualViewport
      ?.removeEventListener(
        "scroll",
        closeOnRootScroll
      );
    document.removeEventListener(
      "scroll",
      closeOnRootScroll,
      true
    );
    window.removeEventListener(
      "scroll",
      closeOnRootScroll,
      true
    );

    if (restoreFocus) {
      trigger.focus({
        preventScroll: true
      });
    }
  };

  const choose = value => {
    const nextValue =
      String(value ?? "");

    if (
      !entries.some(entry =>
        entry.value === nextValue
      )
    ) {
      return;
    }

    const changed =
      select.value !== nextValue;

    select.value = nextValue;
    updateTrigger();
    closePopup(true);

    if (changed) {
      select.dispatchEvent(
        new Event(
          "change",
          { bubbles: true }
        )
      );
    }
  };

  const renderOptions = () => {
    const query =
      search.value
        .trim()
        .toLowerCase();
    const selectedValue =
      String(select.value || "");

    optionsHost.replaceChildren();
    renderedButtons = [];

    let lastGroup = null;
    let matchCount = 0;

    for (const entry of entries) {
      if (
        query &&
        !`${entry.group} ${entry.text} ${entry.value}`
          .toLowerCase()
          .includes(query)
      ) {
        continue;
      }

      if (entry.group !== lastGroup) {
        const heading =
          document.createElement("div");
        heading.className =
          "rml-generated-file-group";
        heading.textContent = entry.group;
        optionsHost.appendChild(heading);
        lastGroup = entry.group;
      }

      const option =
        document.createElement("button");
      option.type = "button";
      option.className =
        "rml-graph-searchable-option rml-generated-file-option";
      option.textContent = entry.text;
      option.title = entry.text;
      option.dataset.value = entry.value;
      option.setAttribute(
        "role",
        "option"
      );

      const selected =
        entry.value === selectedValue;
      option.classList.toggle(
        "selected",
        selected
      );
      option.setAttribute(
        "aria-selected",
        selected ? "true" : "false"
      );

      option.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();
          choose(entry.value);
        }
      );

      optionsHost.appendChild(option);
      renderedButtons.push(option);
      matchCount += 1;
    }

    if (matchCount === 0) {
      const empty =
        document.createElement("div");
      empty.className =
        "rml-graph-searchable-empty";
      empty.textContent =
        "No matching generated files";
      optionsHost.appendChild(empty);
    }

    requestAnimationFrame(
      positionPopup
    );
  };

  const closeOnRootScroll = event => {
    if (
      event?.target instanceof Node &&
      popup.contains(event.target)
    ) {
      return;
    }
    closePopup(false);
  };

  const openPopup = () => {
    if (
      opened ||
      entries.length === 0
    ) {
      return;
    }

    opened = true;
    wrapper.classList.add("open");
    trigger.setAttribute(
      "aria-expanded",
      "true"
    );
    popup.hidden = false;
    document.body.appendChild(popup);
    search.value = "";
    renderOptions();
    positionPopup();

    document.addEventListener(
      "pointerdown",
      onDocumentPointerDown,
      true
    );
    window.addEventListener(
      "resize",
      positionPopup
    );
    window.visualViewport
      ?.addEventListener(
        "resize",
        positionPopup
      );
    window.visualViewport
      ?.addEventListener(
        "scroll",
        closeOnRootScroll,
        { passive: true }
      );
    document.addEventListener(
      "scroll",
      closeOnRootScroll,
      { capture: true, passive: true }
    );
    window.addEventListener(
      "scroll",
      closeOnRootScroll,
      { capture: true, passive: true }
    );

    requestAnimationFrame(() => {
      search.focus({
        preventScroll: true
      });
    });
  };

  function onDocumentPointerDown(event) {
    if (
      popup.contains(event.target) ||
      wrapper.contains(event.target)
    ) {
      return;
    }

    closePopup(false);
  }

  trigger.addEventListener(
    "click",
    event => {
      event.preventDefault();
      event.stopPropagation();

      if (opened) {
        closePopup(true);
      } else {
        openPopup();
      }
    }
  );

  search.addEventListener(
    "input",
    renderOptions
  );

  search.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup(true);
        return;
      }

      const active =
        document.activeElement;
      let index =
        renderedButtons.indexOf(active);

      if (event.key === "ArrowDown") {
        event.preventDefault();
        index = Math.min(
          renderedButtons.length - 1,
          index + 1
        );
        renderedButtons[index]
          ?.focus({ preventScroll: true });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        index = index < 0
          ? renderedButtons.length - 1
          : Math.max(0, index - 1);
        renderedButtons[index]
          ?.focus({ preventScroll: true });
      } else if (
        event.key === "Enter" &&
        renderedButtons.length > 0
      ) {
        event.preventDefault();
        const selected =
          renderedButtons.find(button =>
            button.classList.contains(
              "selected"
            )
          ) || renderedButtons[0];
        selected?.click();
      }
    }
  );

  popup.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopup(true);
      }
    }
  );

  const api = {
    sync() {
      entries = [];

      for (const child of select.children) {
        if (child instanceof HTMLOptGroupElement) {
          for (const option of child.children) {
            if (!(option instanceof HTMLOptionElement)) {
              continue;
            }

            entries.push({
              value: option.value,
              text: option.textContent || option.value,
              group: child.label || "Generated files"
            });
          }
        } else if (child instanceof HTMLOptionElement) {
          entries.push({
            value: child.value,
            text: child.textContent || child.value,
            group: "Generated files"
          });
        }
      }

      updateTrigger();

      if (opened) {
        renderOptions();
      }
    },
    close() {
      closePopup(false);
    }
  };

  select._rmlGeneratedCustomSelect = api;
  api.sync();
  return api;
}

function syncGeneratedArtifactCustomSelect(
  select
) {
  ensureGeneratedArtifactCustomSelect(
    select
  )?.sync();
}

function populateGeneratedArtifactSelect(
  select,
  artifacts,
  selectedKey
) {
  if (!select) {
    return;
  }

  const groups = new Map();

  for (const artifact of artifacts) {
    const groupLabel =
      artifact.projectLabel ||
      "Generated support files";

    if (!groups.has(groupLabel)) {
      groups.set(groupLabel, []);
    }

    groups.get(groupLabel).push(artifact);
  }

  const fragment =
    document.createDocumentFragment();

  for (const [groupLabel, files] of groups) {
    const group =
      document.createElement("optgroup");
    const deployment =
      files.find(file =>
        file.deployDirectory
      )?.deployDirectory;

    group.label = deployment
      ? `${groupLabel} → ${deployment}`
      : groupLabel;

    for (const artifact of files) {
      const option =
        document.createElement("option");

      option.value = artifact.key;
      option.textContent =
        `${artifact.relativePath} · ${artifact.kindLabel}`;
      option.selected =
        artifact.key === selectedKey;
      group.appendChild(option);
    }

    fragment.appendChild(group);
  }

  select.replaceChildren(fragment);

  if (
    selectedKey &&
    [...select.options].some(option =>
      option.value === selectedKey
    )
  ) {
    select.value = selectedKey;
  }

  syncGeneratedArtifactCustomSelect(
    select
  );
}

function updateGeneratedOutput() {
  const errors = getDiagnostics();
  const output =
    generatedCodeForCurrentView();
  const code = output.code;
  const selected =
    output.selectedArtifact;

  elements.generatedCode.textContent = code;

  if (elements.generatedCodeTitle) {
    elements.generatedCodeTitle.textContent =
      output.graphActive
        ? "Generated project files"
        : "Generated C#";
  }

  if (elements.generatedFileSwitcher) {
    elements.generatedFileSwitcher.hidden =
      output.artifacts.length === 0;
  }

  populateGeneratedArtifactSelect(
    elements.generatedFileSelect,
    output.artifacts,
    selected?.key || ""
  );

  if (output.graphActive) {
    elements.codeSummary.textContent =
      selected
        ? `${selected.relativePath} · ${selected.kindLabel} · ${code.split("\n").length} lines · ${output.artifacts.length} generated files`
        : "No generated project file is available yet.";
  } else {
    elements.codeSummary.textContent =
      selected
        ? `${selected.relativePath} · ${selected.kindLabel} · ${code.split("\n").length} lines · ${currentFlattenedNodes().length} outline item${currentFlattenedNodes().length === 1 ? "" : "s"}`
        : "No generated project file is available yet.";
  }

  if (elements.copyCodeBottom) {
    const path =
      selected?.relativePath ||
      `${generatedBaseName()}.cs`;

    elements.copyCodeBottom.setAttribute(
      "aria-label",
      `Copy ${path}`
    );
    elements.copyCodeBottom.dataset.help =
      `Copy ${path} to the clipboard.`;
  }

  elements.diagnostics.hidden =
    errors.length === 0;
  elements.diagnostics.innerHTML =
    errors.length
      ? `<strong>Fix these issues before copying:</strong><ul>${errors
          .map(error =>
            `<li>${escapeHtml(error)}</li>`
          )
          .join("")}</ul>`
      : "";

  [
    elements.copyCodeBottom,
    elements.downloadCode
  ].forEach(button => {
    if (button) {
      button.disabled =
        errors.length > 0;
    }
  });

  if (elements.exportDialog?.open) {
    updateExportDialog();
  }
}

function renderAll() {
  if (
    state.selectedId &&
    !findNode(state.nodes, state.selectedId)
  ) {
    state.selectedId = null;
  }
  if (
    state.activeContainerId !== ROOT_CONTAINER &&
    findContainerName(state.nodes, state.activeContainerId) ===
      "Unknown section"
  ) {
    state.activeContainerId = ROOT_CONTAINER;
  }
  renderCanvas();
  renderInspector();
  requestGeneratedOutputUpdate();
  persist();

  document.dispatchEvent(
    new CustomEvent(
      "rml-builder:rendered",
      {
        detail: {
          itemCount:
            currentFlattenedNodes().length,
          projectEpoch:
            projectApplicationEpoch,
          projectId:
            String(state.projectId || "")
        }
      }
    )
  );
}

function createSettingsPreviewDraft() {
  const draft = {
    values: {},
    controllers: {},
    colorStates: {}
  };

  const visit = nodes => {
    for (const node of nodes) {
      if (node.kind === LAYOUT_ROW_KIND) {
        visit(node.children || []);
        continue;
      }

      if (node.kind === "controller") {
        const selectedOption =
          node.options.find(
            option =>
              option.name ===
              node.defaultOption
          ) || node.options[0];

        draft.controllers[node.id] =
          selectedOption?.name || "";

        for (const option of node.options) {
          visit(option.children);
        }

        continue;
      }

      if (node.valueType === "bool") {
        draft.values[node.id] =
          String(node.defaultValue)
            .trim()
            .toLowerCase() !== "false";
      } else if (isVectorType(node.valueType)) {
        draft.values[node.id] =
          vectorComponentValues(
            node.defaultValue,
            componentCount(node.valueType)
          );
      } else {
        draft.values[node.id] =
          String(node.defaultValue ?? "");
      }

      if (node.valueType === "colorX") {
        draft.colorStates[node.id] =
          settingsPreviewColorStateFromExpression(
            node.defaultValue,
            {
              profile:
                normalizeColorProfile(
                  node.colorProfile
                ),
              strength:
                clamp(
                  Number(node.colorStrength) || 1,
                  1,
                  10
                )
            }
          );
      }
    }
  };

  visit(state.nodes);
  return draft;
}

function mergeSettingsPreviewDraft(
  savedDraft
) {
  const freshDraft =
    createSettingsPreviewDraft();

  if (
    !savedDraft ||
    typeof savedDraft !== "object"
  ) {
    return freshDraft;
  }

  return {
    values: {
      ...freshDraft.values,
      ...(
        savedDraft.values &&
        typeof savedDraft.values ===
          "object"
          ? savedDraft.values
          : {}
      )
    },

    controllers: {
      ...freshDraft.controllers,
      ...(
        savedDraft.controllers &&
        typeof savedDraft.controllers ===
          "object"
          ? savedDraft.controllers
          : {}
      )
    },

    colorStates: {
      ...freshDraft.colorStates,
      ...(
        savedDraft.colorStates &&
        typeof savedDraft.colorStates ===
          "object"
          ? savedDraft.colorStates
          : {}
      )
    }
  };
}

function settingsPreviewTitle(
  settingName = ""
) {
  const modName =
    String(state.metadata.modName || "")
      .trim() || "Unnamed Mod";
  const version =
    String(state.metadata.version || "")
      .trim()
      .replace(/^v\.?/i, "")
      .replace(/^\.+/, "");
  const title = version
    ? `${modName} v.${version}`
    : modName;

  return settingName
    ? `${title} -> ${settingName}`
    : title;
}

function settingsPreviewValue(node) {
  if (!settingsPreviewDraft) {
    return "";
  }

  if (node.kind === "controller") {
    const storedController =
      settingsPreviewDraft.controllers?.[
        node.id
      ];

    if (
      storedController !== undefined &&
      storedController !== null
    ) {
      return storedController;
    }

    const selectedOption =
      node.options.find(
        option =>
          option.name ===
          node.defaultOption
      ) || node.options[0];

    return selectedOption?.name || "";
  }

  const storedValue =
    settingsPreviewDraft.values?.[
      node.id
    ];

  if (
    storedValue !== undefined &&
    storedValue !== null
  ) {
    return storedValue;
  }

  if (node.valueType === "bool") {
    return String(
      node.defaultValue
    )
      .trim()
      .toLowerCase() !== "false";
  }

  if (isVectorType(node.valueType)) {
    return vectorComponentValues(
      node.defaultValue,
      componentCount(
        node.valueType
      )
    );
  }

  return String(
    node.defaultValue ?? ""
  );
}

function previewEnumEditorMarkup(
  node,
  options,
  value
) {
  const safeOptions =
    options.length > 0
      ? options
      : [""];
  const current =
    safeOptions.includes(value)
      ? value
      : safeOptions[0];

  return `<div class="rml-preview-enum" data-preview-enum="${escapeHtml(
    node.id
  )}">
    <button
      class="rml-preview-control rml-preview-enum-value"
      type="button"
      tabindex="-1"
      aria-label="Current value">
      ${escapeHtml(current)}
    </button>
    <button
      class="rml-preview-control rml-preview-enum-step"
      type="button"
      data-preview-enum-direction="-1"
      data-preview-node="${escapeHtml(node.id)}"
      aria-label="Previous value">◀</button>
    <button
      class="rml-preview-control rml-preview-enum-step"
      type="button"
      data-preview-enum-direction="1"
      data-preview-node="${escapeHtml(node.id)}"
      aria-label="Next value">▶</button>
  </div>`;
}

function previewNumericBounds(node) {
  const integer =
    node.valueType === "int";
  let minimum =
    Number(node.minimum);
  let maximum =
    Number(node.maximum);

  if (!Number.isFinite(minimum)) {
    minimum = 0;
  }

  if (!Number.isFinite(maximum)) {
    maximum = minimum + 100;
  }

  if (maximum <= minimum) {
    maximum = minimum + 1;
  }

  if (integer) {
    minimum = Math.trunc(minimum);
    maximum = Math.trunc(maximum);
  }

  return {
    minimum,
    maximum,
    step: integer
      ? 1
      : Math.max(
          (maximum - minimum) / 1000,
          0.000001
        )
  };
}

function previewSettingEditorMarkup(node) {
  const value =
    settingsPreviewValue(node);

  if (node.valueType === "button") {
    const pulseCount =
      Number(
        settingsPreviewPulseCounts?.[
          node.id
        ]
      ) || 0;

    return `<button
      class="rml-preview-control rml-preview-impulse-button"
      type="button"
      data-preview-action-button="${escapeHtml(node.id)}"
      data-preview-action-count="${pulseCount}">
      <span>${escapeHtml(node.buttonLabel || "Run")}</span>
      <output data-preview-action-count="${escapeHtml(node.id)}" aria-label="Local preview presses">${
        pulseCount > 0
          ? `Preview ${pulseCount}`
          : ""
      }</output>
    </button>`;
  }

  if (node.valueType === "bool") {
    return `<label class="rml-preview-checkbox">
      <input
        type="checkbox"
        data-preview-bool="${escapeHtml(node.id)}"${
          value ? " checked" : ""
        }>
      <span aria-hidden="true">✓</span>
    </label>`;
  }

  if (node.valueType === "enum") {
    return previewEnumEditorMarkup(
      node,
      node.enumOptions,
      value
    );
  }

  if (node.valueType === "Uri") {
    return `<div class="rml-preview-uri">
      <input
        class="rml-preview-text-field"
        type="text"
        value="${escapeHtml(value)}"
        data-preview-input="${escapeHtml(node.id)}"
        aria-label="${escapeHtml(node.keyName)}">
      <button
        class="rml-preview-control rml-preview-copy"
        type="button"
        data-preview-copy="${escapeHtml(node.id)}"
        aria-label="Copy URI">⧉</button>
    </div>`;
  }

  if (
    isScalarNumericType(node.valueType) &&
    usesSlider(node)
  ) {
    const bounds =
      previewNumericBounds(node);
    const numericValue =
      clamp(
        Number(value),
        bounds.minimum,
        bounds.maximum
      );
    const safeNumericValue =
      Number.isFinite(numericValue)
        ? numericValue
        : bounds.minimum;
    const progress =
      settingsPreviewRangeProgress(
        safeNumericValue,
        bounds.minimum,
        bounds.maximum
      );

    return `<div class="rml-preview-slider">
      <input
        type="range"
        min="${bounds.minimum}"
        max="${bounds.maximum}"
        step="${bounds.step}"
        value="${safeNumericValue}"
        data-preview-range="${escapeHtml(node.id)}"
        style="--rml-range-progress: ${progress}%"
        aria-label="${escapeHtml(node.keyName)}">
      <output data-preview-range-output="${escapeHtml(node.id)}">${escapeHtml(
        value
      )}</output>
    </div>`;
  }

  if (isVectorType(node.valueType)) {
    const values =
      Array.isArray(value)
        ? value
        : vectorComponentValues(
            value,
            componentCount(node.valueType)
          );
    const componentType =
      numericComponentType(node.valueType);

    return `<div class="rml-preview-vector rml-preview-vector-${values.length}">
      ${values
        .map(
          (component, index) => `<label>
            <span>${VECTOR_COMPONENT_NAMES[index]}</span>
            <input
              class="rml-preview-text-field"
              type="number"
              step="${componentType === "int" ? "1" : "any"}"
              value="${escapeHtml(component)}"
              data-preview-vector="${escapeHtml(node.id)}"
              data-preview-vector-index="${index}">
          </label>`
        )
        .join("")}
    </div>`;
  }

  if (node.valueType === "colorX") {
    const storedState =
      settingsPreviewDraft?.colorStates?.[
        node.id
      ];
    const colorState =
      storedState ||
      settingsPreviewColorStateFromExpression(
        value,
        {
          profile:
            normalizeColorProfile(
              node.colorProfile
            ),
          strength:
            clamp(
              Number(node.colorStrength) || 1,
              1,
              10
            )
        }
      );
    const preview =
      colorChannelsToPreview(
        [
          colorState.red *
            colorState.strength,
          colorState.green *
            colorState.strength,
          colorState.blue *
            colorState.strength,
          colorState.alpha
        ],
        "Preview color",
        colorState.profile,
        colorState.strength
      );
    const glowStrength =
      clamp(
        colorState.strength,
        1,
        10
      );
    const glowSize =
      glowStrength <= 1.000001
        ? 0
        : 8 + (glowStrength - 1) * 3.2;

    return `<button
      class="rml-preview-color-button"
      type="button"
      data-preview-color="${escapeHtml(node.id)}"
      style="
        --rml-preview-color: ${escapeHtml(preview.cssColor)};
        --rml-preview-glow: ${escapeHtml(preview.cssColor)};
        --rml-preview-glow-size: ${glowSize}px;
      "
      aria-label="Edit ${escapeHtml(node.keyName)} color">
      <span aria-hidden="true"></span>
    </button>`;
  }

  return `<input
    class="rml-preview-text-field"
    type="${isScalarNumericType(node.valueType) ? "number" : "text"}"
    step="${node.valueType === "int" ? "1" : "any"}"
    value="${escapeHtml(value)}"
    data-preview-input="${escapeHtml(node.id)}"
    aria-label="${escapeHtml(node.keyName)}">`;
}

function settingsPreviewNodesMarkup(nodes) {
  const rows = [];

  for (const node of
    settingsPreviewOrderedNodes(nodes)) {
    if (!settingsPreviewNodeVisible(node)) {
      continue;
    }

    if (node.kind === LAYOUT_ROW_KIND) {
      const children =
        settingsPreviewOrderedNodes(
          Array.isArray(node.children)
            ? node.children
            : []
        ).filter(
          settingsPreviewNodeVisible
        );
      const widthChildren =
        Array.isArray(
          node.previewLayoutChildren
        )
          ? node.previewLayoutChildren
          : children;
      const context = {
        row: node,
        children: widthChildren,
        index: 0
      };
      const childrenMarkup =
        children
          .map(child => {
            const content =
              settingsPreviewNodesMarkup(
                [child]
              );

            if (!content.trim()) {
              return "";
            }

            return `<div
              class="rml-preview-layout-cell"
              style="--rml-inline-width-percent: ${escapeHtml(
                inlineRowWidthText(
                  settingsPreviewInlineRowWidthPercent(
                    child,
                    context
                  )
                )
              )}"
              data-preview-node-id="${escapeHtml(child.id)}">
              ${content}
            </div>`;
          })
          .join("");

      rows.push(`<section
          class="rml-preview-layout-row${
            settingsPreviewNodeHorizontal(
              node
            )
              ? " horizontal"
              : " vertical"
          }"
          data-preview-layout-row="${escapeHtml(node.id)}"
          data-preview-node-id="${escapeHtml(node.id)}"
          data-rml-scroll-layer="auto"
          data-rml-scroll-layer-key="settings-preview-layout-row:${escapeHtml(node.id)}"
          data-scroll-label="${escapeHtml(node.label || "Inline Row")} · Layout group">
          ${childrenMarkup}
        </section>`);

      continue;
    }

    if (node.kind === "controller") {
      const value =
        settingsPreviewValue(node);
      const options =
        node.options.map(
          option => option.name
        );

      const labelVisible =
        settingsPreviewNodeLabelVisible(
          node
        );

      rows.push(`<div class="rml-preview-setting rml-preview-setting-enum${
        !labelVisible
          ? " label-hidden"
          : ""
      }"
        data-preview-node-id="${escapeHtml(node.id)}">
        ${
          !labelVisible
            ? ""
            : `<div class="rml-preview-label">${escapeHtml(node.keyName)}</div>`
        }
        <div class="rml-preview-editor">
          ${previewEnumEditorMarkup(node, options, value)}
        </div>
      </div>`);

      const selectedOption =
        node.options.find(
          option =>
            option.name === value
        ) || node.options[0];

      if (selectedOption) {
        rows.push(
          settingsPreviewNodesMarkup(
            selectedOption.children || []
          )
        );
      }

      continue;
    }

    if (node?.dynamicSettingKind) {
      continue;
    }

    if (
      node.kind !== "setting"
    ) {
      continue;
    }


    const labelVisible =
      settingsPreviewNodeLabelVisible(
        node
      );

    rows.push(`<div class="rml-preview-setting rml-preview-setting-${escapeHtml(
      node.valueType === "bool"
        ? "bool"
        : node.valueType === "button"
          ? "button"
        : node.valueType === "colorX"
          ? "color"
          : "value"
    )}${
      !labelVisible
        ? " label-hidden"
        : ""
    }"
      data-preview-node-id="${escapeHtml(node.id)}">
      ${
        !labelVisible
          ? ""
          : `<div class="rml-preview-label">${escapeHtml(node.keyName)}</div>`
      }
      <div class="rml-preview-editor">
        ${previewSettingEditorMarkup(node)}
      </div>
    </div>`);
  }

  return rows.join("");
}

function previewColorLiteral(value) {
  const numeric =
    Number.isFinite(Number(value))
      ? Number(value)
      : 0;
  const rounded =
    Math.abs(numeric) < 0.0000005
      ? 0
      : Number(numeric.toFixed(6));

  if (rounded === 0) {
    return "0f";
  }

  if (rounded === 1) {
    return "1f";
  }

  return `${rounded}f`;
}

function previewColorNumber(
  value,
  decimals = 2
) {
  const numeric =
    Number.isFinite(Number(value))
      ? Number(value)
      : 0;

  return numeric.toFixed(decimals);
}

function settingsPreviewColorHsv() {
  const session =
    settingsPreviewColorSession;

  if (!session) {
    return {
      hue: 0,
      saturation: 0,
      value: 0
    };
  }

  const derived =
    rgbToHsv(
      session.red * 255,
      session.green * 255,
      session.blue * 255
    );

  if (
    derived.saturation > 0.000001
  ) {
    session.hue =
      derived.hue;
  }

  return {
    ...derived,
    hue:
      Number.isFinite(
        session.hue
      )
        ? session.hue
        : derived.hue
  };
}

function settingsPreviewColorHex() {
  const session =
    settingsPreviewColorSession;

  if (!session) {
    return "#000000";
  }

  return colorBytesToHex(
    session.red * 255,
    session.green * 255,
    session.blue * 255
  ).toUpperCase();
}

function settingsPreviewColorCss(
  session = settingsPreviewColorSession
) {
  if (!session) {
    return "rgba(0, 0, 0, 1)";
  }

  return colorVisualCss(
    session.red,
    session.green,
    session.blue,
    session.alpha,
    session.profile
  );
}

function syncSettingsPreviewColorWorking() {
  const session =
    settingsPreviewColorSession;

  if (!session) {
    return;
  }

  session.working =
    buildColorXExpression(
      session.red,
      session.green,
      session.blue,
      session.alpha,
      session.strength,
      session.profile
    );
}

function settingsPreviewRangeProgress(
  value,
  minimum,
  maximum
) {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    maximum <= minimum
  ) {
    return 0;
  }

  return clamp(
    (value - minimum) /
      (maximum - minimum) *
      100,
    0,
    100
  );
}

function settingsPreviewColorChannelRowMarkup(
  label,
  component,
  value,
  minimum,
  maximum,
  step,
  decimals = 2
) {
  const progress =
    settingsPreviewRangeProgress(
      value,
      minimum,
      maximum
    );

  return `<label class="rml-preview-color-channel-row">
    <span>${escapeHtml(label)}</span>
    <input
      class="rml-preview-color-channel-range"
      type="range"
      min="${minimum}"
      max="${maximum}"
      step="${step}"
      value="${value}"
      data-preview-color-component-range="${escapeHtml(component)}"
      style="--rml-range-progress: ${progress}%"
      aria-label="${escapeHtml(label)}">
    <input
      class="rml-preview-color-channel-value"
      type="number"
      min="${minimum}"
      max="${maximum}"
      step="${step}"
      value="${previewColorNumber(value, decimals)}"
      data-preview-color-component-input="${escapeHtml(component)}"
      aria-label="${escapeHtml(`${label} value`)}">
  </label>`;
}

function settingsPreviewColorModeMarkup() {
  const session =
    settingsPreviewColorSession;

  if (!session) {
    return "";
  }

  const hsv =
    settingsPreviewColorHsv();
  const common = [
    settingsPreviewColorChannelRowMarkup(
      "Alpha",
      "alpha",
      session.alpha,
      0,
      1,
      0.01
    ),
    settingsPreviewColorChannelRowMarkup(
      "Strength",
      "strength",
      session.strength,
      1,
      10,
      0.01
    )
  ];

  if (session.mode === "hsv") {
    return [
      settingsPreviewColorChannelRowMarkup(
        "Hue",
        "hue",
        hsv.hue,
        0,
        359,
        1,
        0
      ),
      settingsPreviewColorChannelRowMarkup(
        "Saturation",
        "saturation",
        hsv.saturation,
        0,
        1,
        0.01
      ),
      settingsPreviewColorChannelRowMarkup(
        "Value",
        "value",
        hsv.value,
        0,
        1,
        0.01
      ),
      ...common
    ].join("");
  }

  if (session.mode === "hex") {
    return `<label class="rml-preview-color-channel-row rml-preview-color-hex-row">
      <span>Hex</span>
      <input
        class="rml-preview-color-hex-input"
        type="text"
        value="${escapeHtml(
          settingsPreviewColorHex()
        )}"
        maxlength="9"
        spellcheck="false"
        autocomplete="off"
        data-preview-color-hex>
    </label>${common.join("")}`;
  }

  return [
    settingsPreviewColorChannelRowMarkup(
      "Red",
      "red",
      session.red,
      0,
      1,
      0.01
    ),
    settingsPreviewColorChannelRowMarkup(
      "Green",
      "green",
      session.green,
      0,
      1,
      0.01
    ),
    settingsPreviewColorChannelRowMarkup(
      "Blue",
      "blue",
      session.blue,
      0,
      1,
      0.01
    ),
    ...common
  ].join("");
}

let settingsPreviewPaletteCache = null;

function settingsPreviewResonitePalette() {
  if (settingsPreviewPaletteCache) {
    return settingsPreviewPaletteCache;
  }

  const grayscale = [
    "#351600",
    "#1D1D1D",
    "#323438",
    "#5A5A5A",
    "#858585",
    "#B0B0B0",
    "#D8D8D8",
    "#F4F4F4"
  ];
  const hues = [
    0,
    30,
    58,
    120,
    180,
    215,
    270,
    320
  ];
  const levels = [
    [0.34, 1],
    [0.48, 1],
    [0.64, 1],
    [0.78, 1],
    [0.92, 1],
    [1, 1],
    [1, 0.86],
    [0.88, 0.72],
    [0.76, 0.60],
    [0.65, 0.49],
    [0.54, 0.38]
  ];
  const colors =
    [...grayscale];

  for (const [saturation, value] of levels) {
    for (const hue of hues) {
      const rgb =
        hsvToRgb(
          hue,
          saturation,
          value
        );

      colors.push(
        colorBytesToHex(
          rgb.red,
          rgb.green,
          rgb.blue
        ).toUpperCase()
      );
    }
  }

  settingsPreviewPaletteCache =
    Object.freeze(colors);

  return settingsPreviewPaletteCache;
}

function settingsPreviewColorPaletteMarkup() {
  const selected =
    settingsPreviewColorHex();

  return settingsPreviewResonitePalette()
    .map(
      color => `<button
        class="rml-preview-color-palette-swatch${
          color === selected
            ? " selected"
            : ""
        }"
        type="button"
        data-preview-color-swatch="${escapeHtml(color)}"
        style="--rml-palette-color: ${escapeHtml(color)}"
        aria-label="Select ${escapeHtml(color)} color"></button>`
    )
    .join("");
}

function settingsPreviewColorMarkup() {
  const session =
    settingsPreviewColorSession;

  if (!session) {
    return "";
  }

  const hsv =
    settingsPreviewColorHsv();
  const currentCss =
    settingsPreviewColorCss();
  const currentOpaqueCss =
    colorVisualCss(
      session.red,
      session.green,
      session.blue,
      1,
      session.profile
    );
  const originalCss =
    colorVisualCss(
      session.originalState.red,
      session.originalState.green,
      session.originalState.blue,
      session.originalState.alpha,
      session.originalState.profile
    );

  const originalOpaqueCss =
    colorVisualCss(
      session.originalState.red,
      session.originalState.green,
      session.originalState.blue,
      1,
      session.originalState.profile
    );

  const originalGlowStrength =
    clamp(
      session.originalState.strength,
      1,
      10
    );

  const originalGlowSize =
    originalGlowStrength <= 1.000001
      ? 0
      : 8 +
        (
          originalGlowStrength - 1
        ) * 3.2;
  const glowStrength =
    clamp(
      session.strength,
      1,
      10
    );
  const glowSize =
    glowStrength <= 1.000001
      ? 0
      : 8 + (glowStrength - 1) * 3.2;

  return `<div class="rml-preview-full-color" data-preview-color-page>
    <section class="rml-preview-resonite-color-left">
      <div class="rml-preview-color-surfaces">
        <div
          class="custom-color-sv rml-preview-resonite-sv"
          data-color-sv
          role="slider"
          tabindex="0"
          aria-label="Saturation and brightness"
          aria-valuetext="Saturation ${Math.round(
            hsv.saturation * 100
          )}%, brightness ${Math.round(
            hsv.value * 100
          )}%"
          data-hue="${hsv.hue}"
          data-saturation="${hsv.saturation}"
          data-value="${hsv.value}"
          style="--picker-hue: ${hsv.hue}; --picker-saturation: ${hsv.saturation * 100}%; --picker-value-position: ${(1 - hsv.value) * 100}%">
          <span class="custom-color-sv-marker" aria-hidden="true"></span>
        </div>

        <label class="rml-preview-vertical-hue" aria-label="Hue">
          <input
            type="range"
            min="0"
            max="359"
            step="1"
            value="${Math.round(hsv.hue)}"
            data-preview-color-hue
            style="--rml-range-progress: ${settingsPreviewRangeProgress(
              hsv.hue,
              0,
              359
            )}%">
        </label>

        <div
          class="rml-preview-color-preview-stack"
          aria-label="Original and current color preview">

          <div
            class="rml-preview-tall-color-swatch original"
            title="Original color"
            style="
              --rml-swatch-opaque: ${escapeHtml(originalOpaqueCss)};
              --rml-swatch-alpha: ${escapeHtml(originalCss)};
              --rml-swatch-glow: ${escapeHtml(originalOpaqueCss)};
              --rml-swatch-glow-size: ${originalGlowSize}px;
            ">
          </div>

          <div
            class="rml-preview-tall-color-swatch current"
            title="Current color"
            style="
              --rml-swatch-opaque: ${escapeHtml(currentOpaqueCss)};
              --rml-swatch-alpha: ${escapeHtml(currentCss)};
              --rml-swatch-glow: ${escapeHtml(currentOpaqueCss)};
              --rml-swatch-glow-size: ${glowSize}px;
            ">
          </div>
        </div>
      </div>

      <div class="rml-preview-color-profile-tabs" aria-label="Color profile">
        ${[
          ["srgb", "sRGB"],
          ["linear", "Linear"]
        ]
          .map(
            ([profile, label]) => `<button
              class="rml-preview-control${
                session.profile === profile
                  ? " selected"
                  : ""
              }"
              type="button"
              data-preview-color-profile="${profile}"${
                profile === "srgb" &&
                session.strength > 1.000001
                  ? " disabled"
                  : ""
              }>${label}</button>`
          )
          .join("")}
      </div>

      <div class="rml-preview-color-mode-tabs" aria-label="Color input mode">
        ${[
          ["rgb", "RGB"],
          ["hsv", "HSV"],
          ["hex", "Hex"]
        ]
          .map(
            ([mode, label]) => `<button
              class="rml-preview-control${
                session.mode === mode
                  ? " selected"
                  : ""
              }"
              type="button"
              data-preview-color-mode="${mode}">${label}</button>`
          )
          .join("")}
      </div>

      <div class="rml-preview-color-channel-editor">
        ${settingsPreviewColorModeMarkup()}
      </div>
    </section>

    <section
      class="rml-preview-color-palette"
      aria-label="Resonite color palette">
      ${settingsPreviewColorPaletteMarkup()}
    </section>
  </div>`;
}

function setSettingsPreviewStatus(
  message,
  tone = ""
) {
  clearTimeout(
    settingsPreviewStatusTimer
  );
  elements.settingsPreviewStatus.textContent =
    message;
  elements.settingsPreviewStatus.dataset.tone =
    tone;

  settingsPreviewStatusTimer =
    window.setTimeout(
      () => {
        elements.settingsPreviewStatus.textContent = "";
        elements.settingsPreviewStatus.dataset.tone = "";
      },
      2400
    );
}

function renderSettingsPreviewFooter() {
  if (settingsPreviewColorSession) {
    elements.settingsPreviewSavePanel.innerHTML = `<div class="rml-preview-color-footer-actions">
      <button
        class="rml-preview-control rml-preview-footer-button"
        type="button"
        data-preview-color-cancel>
        Cancel
      </button>
      <button
        class="rml-preview-control rml-preview-footer-button"
        type="button"
        data-preview-color-apply>
        Apply &amp; Back
      </button>
    </div>`;
  } else {
    elements.settingsPreviewSavePanel.innerHTML = `<button
      id="settings-preview-save"
      class="rml-preview-save"
      type="button">
      Save Settings
    </button>`;
  }
}

function renderSettingsPreview() {
  if (!settingsPreviewDraft) {
    return;
  }

  const colorNode =
    settingsPreviewColorSession
      ? findNode(
          state.nodes,
          settingsPreviewColorSession.nodeId
        )
      : null;
  const colorPageOpen =
    Boolean(
      settingsPreviewColorSession
    );

  elements.settingsPreviewDialog.classList.toggle(
    "rml-preview-color-open",
    colorPageOpen
  );
  elements.settingsPreviewTitle.textContent =
    settingsPreviewTitle(
      colorNode?.keyName || ""
    );

  if (colorPageOpen) {
    elements.settingsPreviewContent.innerHTML =
      settingsPreviewColorMarkup();
    bindSettingsPreviewColorInteractions();
  } else {
    const markup =
      settingsPreviewNodesMarkup(
        state.nodes
      );

    elements.settingsPreviewContent.innerHTML =
      markup || `<div class="rml-preview-empty">This mod has no visible configuration.</div>`;
  }

  renderSettingsPreviewFooter();
  window.fitSettingsPreviewColorPicker?.();
}

function changeSettingsPreviewEnum(
  nodeId,
  direction
) {
  const node =
    findNode(
      state.nodes,
      nodeId
    );

  if (!node || !settingsPreviewDraft) {
    return;
  }

  const options =
    node.kind === "controller"
      ? node.options.map(
          option => option.name
        )
      : node.enumOptions;

  if (options.length === 0) {
    return;
  }

  const currentValue =
    settingsPreviewValue(node);
  const currentIndex =
    Math.max(
      options.indexOf(currentValue),
      0
    );
  const nextIndex =
    (currentIndex +
      direction +
      options.length) %
    options.length;

  if (node.kind === "controller") {
    settingsPreviewDraft.controllers[node.id] =
      options[nextIndex];
  } else {
    settingsPreviewDraft.values[node.id] =
      options[nextIndex];
  }

  renderSettingsPreview();
  runSettingsPreviewRuntimePhase(
    "saved",
    node.id
  );
}

async function copySettingsPreviewUri(nodeId) {
  const value =
    settingsPreviewDraft?.values[nodeId] ?? "";

  try {
    if (
      navigator.clipboard &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(
        String(value)
      );
    } else {
      throw new Error("Clipboard API unavailable");
    }

    setSettingsPreviewStatus(
      "URI copied to the local clipboard.",
      "success"
    );
  } catch {
    setSettingsPreviewStatus(
      "Clipboard access is not available in this browser context.",
      "error"
    );
  }
}

function settingsPreviewColorStateFromExpression(
  expression,
  storedState = null
) {
  const profile =
    normalizeColorProfile(
      storedState?.profile
    );
  const requestedStrength =
    Number(storedState?.strength);
  const preview =
    colorXPreview(
      expression,
      Number.isFinite(requestedStrength)
        ? requestedStrength
        : null,
      profile
    );
  const channels =
    preview.channels ||
    [0.5, 0.5, 0.5, 1];
  const baseChannels =
    preview.baseChannels ||
    channels;
  const strength =
    clamp(
      Number.isFinite(requestedStrength)
        ? requestedStrength
        : preview.strength,
      1,
      10
    );
  const red =
    clamp(
      baseChannels[0],
      0,
      1
    );
  const green =
    clamp(
      baseChannels[1],
      0,
      1
    );
  const blue =
    clamp(
      baseChannels[2],
      0,
      1
    );
  const hsv =
    rgbToHsv(
      red * 255,
      green * 255,
      blue * 255
    );

  return {
    red,
    green,
    blue,
    alpha:
      clamp(
        baseChannels[3],
        0,
        1
      ),
    strength,
    profile:
      normalizeColorProfile(
        storedState?.profile ||
        preview.profile
      ),
    hue:
      Number.isFinite(
        storedState?.hue
      )
        ? storedState.hue
        : hsv.hue
  };
}

function openSettingsPreviewColor(nodeId) {
  const node =
    findNode(
      state.nodes,
      nodeId
    );

  if (
    !node ||
    node.kind !== "setting" ||
    node.valueType !== "colorX" ||
    !settingsPreviewDraft
  ) {
    return;
  }

  if (!settingsPreviewDraft.colorStates) {
    settingsPreviewDraft.colorStates = {};
  }

  const original =
    settingsPreviewDraft.values[nodeId];
  const savedState =
    settingsPreviewDraft.colorStates[
      nodeId
    ];
  const initial =
    settingsPreviewColorStateFromExpression(
      original,
      savedState || {
        profile:
          normalizeColorProfile(
            node.colorProfile
          ),
        strength:
          clamp(
            Number(node.colorStrength) || 1,
            1,
            10
          )
      }
    );

  settingsPreviewColorSession = {
    nodeId,
    original,
    working: original,
    mode: "rgb",
    ...initial,
    originalState: {
      ...initial
    }
  };

  syncSettingsPreviewColorWorking();
  renderSettingsPreview();
}

function closeSettingsPreviewColor(
  apply
) {
  const changedNodeId =
    apply
      ? settingsPreviewColorSession
          ?.nodeId || ""
      : "";

  if (
    apply &&
    settingsPreviewDraft &&
    settingsPreviewColorSession
  ) {
    if (!settingsPreviewDraft.colorStates) {
      settingsPreviewDraft.colorStates = {};
    }

    settingsPreviewDraft.values[
      settingsPreviewColorSession.nodeId
    ] =
      settingsPreviewColorSession.working;

    settingsPreviewDraft.colorStates[
      settingsPreviewColorSession.nodeId
    ] = {
      red:
        settingsPreviewColorSession.red,
      green:
        settingsPreviewColorSession.green,
      blue:
        settingsPreviewColorSession.blue,
      alpha:
        settingsPreviewColorSession.alpha,
      strength:
        settingsPreviewColorSession.strength,
      profile:
        settingsPreviewColorSession.profile,
      hue:
        settingsPreviewColorSession.hue
    };
  }

  settingsPreviewColorSession = null;
  renderSettingsPreview();

  if (changedNodeId) {
    runSettingsPreviewRuntimePhase(
      "saved",
      changedNodeId
    );
  }
}

function settingsPreviewColorComponentValue(
  component
) {
  const session =
    settingsPreviewColorSession;

  if (!session) {
    return 0;
  }

  const hsv =
    settingsPreviewColorHsv();

  switch (component) {
    case "red":
      return session.red;
    case "green":
      return session.green;
    case "blue":
      return session.blue;
    case "alpha":
      return session.alpha;
    case "strength":
      return session.strength;
    case "hue":
      return hsv.hue;
    case "saturation":
      return hsv.saturation;
    case "value":
      return hsv.value;
    default:
      return 0;
  }
}

function refreshSettingsPreviewColorVisuals() {
  const session =
    settingsPreviewColorSession;
  const root =
    elements.settingsPreviewContent;

  if (!session || !root) {
    return;
  }

  syncSettingsPreviewColorWorking();

  const hsv =
    settingsPreviewColorHsv();
  const hex =
    settingsPreviewColorHex();
  const cssColor =
    settingsPreviewColorCss();
  const surface =
    root.querySelector(
      "[data-color-sv]"
    );

  if (surface) {
    surface.dataset.hue =
      String(hsv.hue);
    surface.dataset.saturation =
      String(hsv.saturation);
    surface.dataset.value =
      String(hsv.value);
    surface.style.setProperty(
      "--picker-hue",
      String(hsv.hue)
    );
    surface.style.setProperty(
      "--picker-saturation",
      `${hsv.saturation * 100}%`
    );
    surface.style.setProperty(
      "--picker-value-position",
      `${(1 - hsv.value) * 100}%`
    );
    surface.setAttribute(
      "aria-valuetext",
      `Saturation ${Math.round(
        hsv.saturation * 100
      )}%, brightness ${Math.round(
        hsv.value * 100
      )}%`
    );
  }

  const hueInput =
    root.querySelector(
      "[data-preview-color-hue]"
    );

  if (hueInput) {
    hueInput.value =
      String(
        Math.round(hsv.hue)
      );
    hueInput.style.setProperty(
      "--rml-range-progress",
      `${settingsPreviewRangeProgress(
        hsv.hue,
        0,
        359
      )}%`
    );
  }

  const opaqueCss =
    colorVisualCss(
      session.red,
      session.green,
      session.blue,
      1,
      session.profile
    );

  const swatchGlowSize =
    session.strength <= 1.000001
      ? 0
      : 8 +
        (
          clamp(
            session.strength,
            1,
            10
          ) - 1
        ) * 3.2;

  const currentSwatch =
    root.querySelector(
      ".rml-preview-tall-color-swatch.current"
    );

  if (currentSwatch) {
    currentSwatch.style.setProperty(
      "--rml-swatch-opaque",
      opaqueCss
    );

    currentSwatch.style.setProperty(
      "--rml-swatch-alpha",
      cssColor
    );

    currentSwatch.style.setProperty(
      "--rml-swatch-glow",
      opaqueCss
    );

    currentSwatch.style.setProperty(
      "--rml-swatch-glow-size",
      `${swatchGlowSize}px`
    );
  }

  root
    .querySelectorAll(
      "[data-preview-color-profile]"
    )
    .forEach(button => {
      const buttonProfile =
        normalizeColorProfile(
          button.dataset.previewColorProfile
        );

      button.classList.toggle(
        "selected",
        buttonProfile === session.profile
      );
      button.disabled =
        buttonProfile === "srgb" &&
        session.strength > 1.000001;
    });

  root
    .querySelectorAll(
      "[data-preview-color-component-range]"
    )
    .forEach(input => {
      const component =
        input.dataset.previewColorComponentRange;
      const value =
        settingsPreviewColorComponentValue(
          component
        );
      const minimum =
        Number(input.min);
      const maximum =
        Number(input.max);

      input.value =
        String(value);
      input.style.setProperty(
        "--rml-range-progress",
        `${settingsPreviewRangeProgress(
          value,
          minimum,
          maximum
        )}%`
      );
    });

  root
    .querySelectorAll(
      "[data-preview-color-component-input]"
    )
    .forEach(input => {
      const component =
        input.dataset.previewColorComponentInput;
      const value =
        settingsPreviewColorComponentValue(
          component
        );

      input.value =
        previewColorNumber(
          value,
          component === "hue"
            ? 0
            : 2
        );
    });

  const hexInput =
    root.querySelector(
      "[data-preview-color-hex]"
    );

  if (hexInput) {
    hexInput.value =
      hex;
  }

  root
    .querySelectorAll(
      "[data-preview-color-swatch]"
    )
    .forEach(swatch => {
      swatch.classList.toggle(
        "selected",
        swatch.dataset.previewColorSwatch ===
          hex
      );
    });
}

function commitSettingsPreviewColor(
  changes
) {
  const session =
    settingsPreviewColorSession;

  if (!session || !changes) {
    return;
  }

  for (const component of [
    "red",
    "green",
    "blue",
    "alpha"
  ]) {
    if (
      Object.hasOwn(
        changes,
        component
      ) &&
      Number.isFinite(
        Number(
          changes[component]
        )
      )
    ) {
      session[component] =
        clamp(
          Number(
            changes[component]
          ),
          0,
          1
        );
    }
  }

  if (
    Object.hasOwn(
      changes,
      "strength"
    ) &&
    Number.isFinite(
      Number(
        changes.strength
      )
    )
  ) {
    const nextStrength =
      clamp(
        Number(changes.strength),
        1,
        10
      );

    if (
      nextStrength > 1.000001 &&
      session.profile === "srgb"
    ) {
      const converted =
        convertColorProfileChannels(
          session.red,
          session.green,
          session.blue,
          "srgb",
          "linear"
        );

      session.red =
        clamp(converted.red, 0, 1);
      session.green =
        clamp(converted.green, 0, 1);
      session.blue =
        clamp(converted.blue, 0, 1);
      session.profile =
        "linear";
    }

    session.strength =
      nextStrength;
  }

  if (
    Object.hasOwn(
      changes,
      "hue"
    ) &&
    Number.isFinite(
      Number(
        changes.hue
      )
    )
  ) {
    session.hue =
      ((Number(changes.hue) %
        360) +
        360) %
      360;
  }

  refreshSettingsPreviewColorVisuals();
}

function bindSettingsPreviewColorInteractions() {
  const root =
    elements.settingsPreviewContent;
  const surface =
    root.querySelector(
      "[data-color-sv]"
    );

  if (
    !surface ||
    !settingsPreviewColorSession
  ) {
    return;
  }

  const applyHsv = (
    hue,
    saturation,
    value
  ) => {
    const normalizedHue =
      ((Number(hue) % 360) +
        360) %
      360;
    const normalizedSaturation =
      clamp(
        Number(saturation),
        0,
        1
      );
    const normalizedValue =
      clamp(
        Number(value),
        0,
        1
      );
    const rgb =
      hsvToRgb(
        normalizedHue,
        normalizedSaturation,
        normalizedValue
      );

    commitSettingsPreviewColor({
      red:
        rgb.red / 255,
      green:
        rgb.green / 255,
      blue:
        rgb.blue / 255,
      hue: normalizedHue
    });
  };

  const applyComponent = (
    component,
    rawValue
  ) => {
    const value =
      Number(rawValue);

    if (!Number.isFinite(value)) {
      return;
    }

    const hsv =
      settingsPreviewColorHsv();

    switch (component) {
      case "hue":
        applyHsv(
          clamp(value, 0, 359),
          hsv.saturation,
          hsv.value
        );
        break;
      case "saturation":
        applyHsv(
          hsv.hue,
          clamp(value, 0, 1),
          hsv.value
        );
        break;
      case "value":
        applyHsv(
          hsv.hue,
          hsv.saturation,
          clamp(value, 0, 1)
        );
        break;
      case "red":
      case "green":
      case "blue":
      case "alpha":
        commitSettingsPreviewColor({
          [component]:
            clamp(value, 0, 1)
        });
        break;
      case "strength":
        commitSettingsPreviewColor({
          strength:
            clamp(value, 1, 10)
        });
        break;
      default:
        break;
    }
  };

  root
    .querySelectorAll(
      "[data-preview-color-component-range]"
    )
    .forEach(input => {
      input.addEventListener(
        "input",
        () => {
          applyComponent(
            input.dataset.previewColorComponentRange,
            input.value
          );
        }
      );
    });

  root
    .querySelectorAll(
      "[data-preview-color-component-input]"
    )
    .forEach(input => {
      input.addEventListener(
        "input",
        () => {
          applyComponent(
            input.dataset.previewColorComponentInput,
            input.value
          );
        }
      );
      input.addEventListener(
        "change",
        refreshSettingsPreviewColorVisuals
      );
    });

  root
    .querySelector(
      "[data-preview-color-hue]"
    )
    ?.addEventListener(
      "input",
      event => {
        const hsv =
          settingsPreviewColorHsv();

        applyHsv(
          event.currentTarget.value,
          hsv.saturation,
          hsv.value
        );
      }
    );

  root
    .querySelectorAll(
      "[data-preview-color-profile]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const session =
            settingsPreviewColorSession;
          const targetProfile =
            normalizeColorProfile(
              button.dataset.previewColorProfile
            );

          if (
            !session ||
            targetProfile ===
              session.profile ||
            (
              targetProfile === "srgb" &&
              session.strength > 1.000001
            )
          ) {
            return;
          }

          const converted =
            convertColorProfileChannels(
              session.red,
              session.green,
              session.blue,
              session.profile,
              targetProfile
            );

          session.red =
            clamp(converted.red, 0, 1);
          session.green =
            clamp(converted.green, 0, 1);
          session.blue =
            clamp(converted.blue, 0, 1);
          session.profile =
            targetProfile;

          syncSettingsPreviewColorWorking();
          renderSettingsPreview();
        }
      );
    });

  root
    .querySelectorAll(
      "[data-preview-color-mode]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          settingsPreviewColorSession.mode =
            button.dataset.previewColorMode;
          renderSettingsPreview();
        }
      );
    });

  root
    .querySelectorAll(
      "[data-preview-color-swatch]"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const parsed =
            parseHexColor(
              button.dataset.previewColorSwatch
            );

          if (!parsed) {
            return;
          }

          commitSettingsPreviewColor({
            red:
              parsed.red / 255,
            green:
              parsed.green / 255,
            blue:
              parsed.blue / 255
          });
        }
      );
    });

  root
    .querySelector(
      "[data-preview-color-hex]"
    )
    ?.addEventListener(
      "input",
      event => {
        const parsed =
          parseHexColor(
            event.currentTarget.value
          );

        if (!parsed) {
          return;
        }

        commitSettingsPreviewColor({
          red:
            parsed.red / 255,
          green:
            parsed.green / 255,
          blue:
            parsed.blue / 255,
          ...(parsed.alpha === null
            ? {}
            : {
                alpha:
                  parsed.alpha / 255
              })
        });
      }
    );

  const setSurfaceValue = event => {
    const rectangle =
      surface.getBoundingClientRect();

    if (
      rectangle.width <= 0 ||
      rectangle.height <= 0
    ) {
      return;
    }

    applyHsv(
      settingsPreviewColorHsv().hue,
      clamp(
        (event.clientX -
          rectangle.left) /
          rectangle.width,
        0,
        1
      ),
      1 -
        clamp(
          (event.clientY -
            rectangle.top) /
            rectangle.height,
          0,
          1
        )
    );
  };

  let activePointerId = null;

  surface.addEventListener(
    "pointerdown",
    event => {
      if (
        event.isPrimary === false ||
        (event.pointerType === "mouse" &&
          event.button !== 0)
      ) {
        return;
      }

      event.preventDefault();
      activePointerId =
        event.pointerId;
      surface.setPointerCapture?.(
        event.pointerId
      );
      setSurfaceValue(event);
    }
  );

  surface.addEventListener(
    "pointermove",
    event => {
      if (
        event.pointerId !==
        activePointerId
      ) {
        return;
      }

      event.preventDefault();
      setSurfaceValue(event);
    }
  );

  const finishPointer = event => {
    if (
      event.pointerId !==
      activePointerId
    ) {
      return;
    }

    if (
      surface.hasPointerCapture?.(
        event.pointerId
      )
    ) {
      surface.releasePointerCapture(
        event.pointerId
      );
    }

    activePointerId = null;
  };

  surface.addEventListener(
    "pointerup",
    finishPointer
  );
  surface.addEventListener(
    "pointercancel",
    finishPointer
  );

  surface.addEventListener(
    "keydown",
    event => {
      const hsv =
        settingsPreviewColorHsv();
      const step =
        event.shiftKey
          ? 0.05
          : 0.01;
      let saturation =
        hsv.saturation;
      let value =
        hsv.value;

      switch (event.key) {
        case "ArrowLeft":
          saturation -= step;
          break;
        case "ArrowRight":
          saturation += step;
          break;
        case "ArrowDown":
          value -= step;
          break;
        case "ArrowUp":
          value += step;
          break;
        default:
          return;
      }

      event.preventDefault();
      applyHsv(
        hsv.hue,
        clamp(
          saturation,
          0,
          1
        ),
        clamp(
          value,
          0,
          1
        )
      );
    }
  );
}

function settingsPreviewApplyRuntimeValue(
  itemId,
  value
) {
  const node = findNode(
    state.nodes,
    itemId
  );

  if (
    !node ||
    !settingsPreviewDraft ||
    node.kind === LAYOUT_ROW_KIND ||
    node.valueType === "runtimeDisplay" ||
    node.valueType === "button"
  ) {
    return false;
  }

  if (node.kind === "controller") {
    settingsPreviewDraft.controllers[
      node.id
    ] = String(value ?? "");
    return true;
  }

  if (node.valueType === "bool") {
    settingsPreviewDraft.values[node.id] =
      typeof value === "string"
        ? value.trim().toLowerCase() ===
          "true"
        : Boolean(value);
    return true;
  }

  if (node.valueType === "colorX") {
    const channels =
      Array.isArray(value)
        ? value
        : String(value ?? "")
            .split(",")
            .map(Number);

    settingsPreviewDraft.values[node.id] =
      channels.join(", ");
    settingsPreviewDraft.colorStates[
      node.id
    ] = {
      red: Number(channels[0]) || 0,
      green: Number(channels[1]) || 0,
      blue: Number(channels[2]) || 0,
      alpha:
        Number.isFinite(
          Number(channels[3])
        )
          ? Number(channels[3])
          : 1,
      profile: "linear",
      strength: 1,
      source: "runtime-preview"
    };
    return true;
  }

  settingsPreviewDraft.values[node.id] =
    Array.isArray(value)
      ? [...value]
      : value ?? "";
  return true;
}

function applySettingsPreviewRuntimeMenuAction(
  action,
  payload = {}
) {
  if (!settingsPreviewDraft) {
    return {
      applied: false,
      message:
        "Settings Preview is not open."
    };
  }

  settingsPreviewRuntimeMenu ||=
    createSettingsPreviewRuntimeMenu();

  const itemId = String(
    payload.itemId || ""
  );
  const setOverride = (
    property,
    value
  ) => {
    if (!itemId) return false;
    settingsPreviewRuntimeMenu[
      property
    ][itemId] = value;
    return true;
  };
  let applied = false;

  switch (action) {
    case "visibility":
      applied = setOverride(
        "visibility",
        payload.visible === true
      );
      break;

    case "order": {
      const order = Number(
        payload.order
      );
      applied =
        Number.isFinite(order) &&
        setOverride(
          "order",
          Math.trunc(order)
        );
      break;
    }

    case "value":
      applied =
        settingsPreviewApplyRuntimeValue(
          itemId,
          payload.value
        );
      break;

    case "saveSettings":
      try {
        localStorage.setItem(
          ACTIVE_PREVIEW_STORAGE_KEY,
          JSON.stringify(
            settingsPreviewDraft
          )
        );
        setSettingsPreviewStatus(
          "Preview saved locally by runtime graph.",
          "success"
        );
        applied = true;
      } catch {
        setSettingsPreviewStatus(
          "Saving the local Preview draft failed.",
          "error"
        );
        applied = false;
      }
      break;

    case "layout":
      applied = setOverride(
        "horizontal",
        payload.horizontal === true
      );
      break;

    case "width": {
      const width = Number(
        payload.width
      );
      applied =
        Number.isFinite(width) &&
        setOverride(
          "width",
          clamp(width, 1, 100)
        );
      break;
    }

    case "labelVisibility":
      applied = setOverride(
        "labelVisibility",
        payload.visible === true
      );
      break;

    case "resetItem":
      if (itemId) {
        for (const values of
          Object.values(
            settingsPreviewRuntimeMenu
          )) {
          delete values[itemId];
        }
        applied = true;
      }
      break;

    case "resetMenu":
      settingsPreviewRuntimeMenu =
        createSettingsPreviewRuntimeMenu();
      applied = true;
      break;
  }

  if (applied) {
    renderSettingsPreview();
  }

  return {
    applied,
    message: applied
      ? "Local Preview menu updated."
      : "The local Preview action had no valid target."
  };
}

function runSettingsPreviewRuntimePhase(
  phase,
  outlineNodeId = ""
) {
  if (!settingsPreviewDraft) {
    return null;
  }

  try {
    return (
      window.RMLDynamicGraphHost
        ?.previewConfigurationPhase?.(
          phase,
          outlineNodeId
        ) || null
    );
  } catch (error) {
    console.warn(
      `Local Configuration Preview ${phase} phase failed.`,
      error
    );
    return {
      started: false,
      error: true,
      message:
        error instanceof Error
          ? error.message
          : String(error)
    };
  }
}

function handleSettingsPreviewClick(event) {
  const actionButton =
    event.target.closest(
      "[data-preview-action-button]"
    );

  if (actionButton) {
    const nodeId =
      actionButton.dataset
        .previewActionButton;
    const nextCount =
      Number(
        settingsPreviewPulseCounts?.[
          nodeId
        ] || 0
      ) + 1;

    settingsPreviewPulseCounts[
      nodeId
    ] = nextCount;

    actionButton.dataset
      .previewActionCount =
        String(nextCount);

    const output =
      actionButton.querySelector(
        "[data-preview-action-count]"
      );

    if (output) {
      output.value =
        `Preview ${nextCount}`;
      output.textContent =
        `Preview ${nextCount}`;
    }

    actionButton.classList.remove(
      "is-preview-pulse"
    );
    void actionButton.offsetWidth;
    actionButton.classList.add(
      "is-preview-pulse"
    );

    const execution =
      window.RMLDynamicGraphHost
        ?.previewConfigurationImpulse?.(
          nodeId
        ) || null;

    const actionCount = Number(
      execution?.actionsApplied || 0
    );
    const skippedCount = Number(
      execution?.runtimeOnlySkipped || 0
    );
    const executionSummary =
      execution?.started
        ? actionCount > 0
          ? `${actionCount} local menu action${
              actionCount === 1
                ? ""
                : "s"
            } applied${
              skippedCount > 0
                ? `; ${skippedCount} runtime-only step${skippedCount === 1 ? "" : "s"} skipped`
                : ""
            }`
          : execution.message ||
            "no Preview-safe menu action reached"
        : execution?.message ||
          "no connected Preview graph path";

    setSettingsPreviewStatus(
      `Preview pulse ${nextCount}: ${executionSummary}. Nothing was sent to Resonite.`,
      execution?.error
        ? "error"
        : "success"
    );
    return;
  }

  const enumButton =
    event.target.closest(
      "[data-preview-enum-direction]"
    );

  if (enumButton) {
    changeSettingsPreviewEnum(
      enumButton.dataset.previewNode,
      Number(
        enumButton.dataset.previewEnumDirection
      )
    );
    return;
  }

  const copyButton =
    event.target.closest(
      "[data-preview-copy]"
    );

  if (copyButton) {
    copySettingsPreviewUri(
      copyButton.dataset.previewCopy
    );
    return;
  }

  const colorButton =
    event.target.closest(
      "[data-preview-color]"
    );

  if (colorButton) {
    colorButton.blur();

    openSettingsPreviewColor(
      colorButton.dataset.previewColor
    );

    return;
  }
}

function handleSettingsPreviewInput(event) {
  if (!settingsPreviewDraft) {
    return;
  }

  const target =
    event.target;

  if (target.matches("[data-preview-bool]")) {
    const nodeId =
      target.dataset.previewBool;
    settingsPreviewDraft.values[nodeId] =
      target.checked;
    runSettingsPreviewRuntimePhase(
      "saved",
      nodeId
    );
    return;
  }

  if (target.matches("[data-preview-input]")) {
    const nodeId =
      target.dataset.previewInput;
    settingsPreviewDraft.values[nodeId] =
      target.value;
    runSettingsPreviewRuntimePhase(
      "saved",
      nodeId
    );
    return;
  }

  if (target.matches("[data-preview-range]")) {
    const nodeId =
      target.dataset.previewRange;
    settingsPreviewDraft.values[nodeId] =
      target.value;
    const output =
      Array.from(
        elements.settingsPreviewContent.querySelectorAll(
          "[data-preview-range-output]"
        )
      ).find(
        candidate =>
          candidate.dataset.previewRangeOutput ===
          target.dataset.previewRange
      );

    if (output) {
      output.value = target.value;
      output.textContent = target.value;
    }

    target.style.setProperty(
      "--rml-range-progress",
      `${settingsPreviewRangeProgress(
        Number(target.value),
        Number(target.min),
        Number(target.max)
      )}%`
    );

    runSettingsPreviewRuntimePhase(
      "saved",
      nodeId
    );

    return;
  }

  if (target.matches("[data-preview-vector]")) {
    const nodeId =
      target.dataset.previewVector;
    const values =
      settingsPreviewDraft.values[nodeId];

    if (Array.isArray(values)) {
      values[
        Number(target.dataset.previewVectorIndex)
      ] = target.value;
    }

    runSettingsPreviewRuntimePhase(
      "saved",
      nodeId
    );
  }
}

function saveSettingsPreview() {
  runSettingsPreviewRuntimePhase(
    "saved"
  );

  try {
    localStorage.setItem(
      ACTIVE_PREVIEW_STORAGE_KEY,
      JSON.stringify(settingsPreviewDraft)
    );

    setSettingsPreviewStatus(
      "Preview saved (local only, Builder remains unchanged).",
      "success"
    );
  } catch {
    setSettingsPreviewStatus(
      "Saving failed.",
      "error"
    );
  }
}

function onSettingsPreviewTransitionFinished(
  dialog,
  callback
) {
  if (!dialog) {
    return;
  }

  let finished = false;

  const cleanup = () => {
    dialog.removeEventListener(
      "transitionend",
      handleTransitionFinished
    );
    dialog.removeEventListener(
      "transitioncancel",
      handleTransitionFinished
    );
  };

  const finish = () => {
    if (finished) {
      return;
    }

    finished = true;
    cleanup();
    callback();
  };

  const handleTransitionFinished =
    event => {
      if (
        event.target !== dialog ||
        event.propertyName !==
          "clip-path"
      ) {
        return;
      }

      finish();
    };

  dialog.addEventListener(
    "transitionend",
    handleTransitionFinished
  );
  dialog.addEventListener(
    "transitioncancel",
    handleTransitionFinished
  );

  return finish;
}

let settingsPreviewOpenSequence = 0;

async function openSettingsPreview() {
  const dialog =
    elements.settingsPreviewDialog;

  if (dialog.open) {
    return;
  }

  const sequence =
    ++settingsPreviewOpenSequence;

  dialog.classList.remove(
    "rml-overlay-closing",
    "rml-overlay-animating"
  );
  elements.settingsPreviewStatus.textContent =
    "Preparing preview…";
  elements.settingsPreviewContent.innerHTML = `
    <div class="rml-inline-dialog-loading">
      <div>
        <div class="builder-work-spinner" aria-hidden="true"></div>
        <p>Preparing the runtime preview…</p>
      </div>
    </div>`;

  dialog.showModal();
  dialog.classList.add(
    "rml-overlay-opened"
  );
  movePreviewFocusAwayFromCloseButton();

  await paintBuilderUi();

  if (
    sequence !==
      settingsPreviewOpenSequence ||
    !dialog.open
  ) {
    return;
  }

  try {
    let savedDraft = null;

    try {
      const saved =
        localStorage.getItem(
          ACTIVE_PREVIEW_STORAGE_KEY
        );

      if (saved) {
        savedDraft =
          JSON.parse(saved);
      }
    } catch (error) {
      console.warn(
        "Could not restore preview values.",
        error
      );
    }

    settingsPreviewDraft =
      mergeSettingsPreviewDraft(
        savedDraft
      );

    settingsPreviewRuntimeMenu =
      createSettingsPreviewRuntimeMenu();
    settingsPreviewPulseCounts = {};
    settingsPreviewColorSession = null;

    elements.settingsPreviewStatus.textContent =
      "";
    renderSettingsPreview();

    runSettingsPreviewRuntimePhase(
      "startup"
    );
    movePreviewFocusAwayFromCloseButton();
  } catch (error) {
    console.error(
      "Settings preview preparation failed.",
      error
    );
    elements.settingsPreviewContent.innerHTML =
      '<div class="rml-inline-dialog-loading">The preview could not be prepared. Close this dialog and review Diagnostics.</div>';
    elements.settingsPreviewStatus.textContent =
      "Preview preparation failed.";
  }
}

function closeSettingsPreview(
  dialog =
    elements.settingsPreviewDialog,
  returnValue = ""
) {
  settingsPreviewOpenSequence += 1;
  if (
    !dialog ||
    !dialog.open ||
    dialog.classList.contains(
      "rml-overlay-closing"
    )
  ) {
    return;
  }

  dialog.classList.add(
    "rml-overlay-animating"
  );

  void dialog.offsetWidth;

  onSettingsPreviewTransitionFinished(
    dialog,
    () => {
      settingsPreviewColorSession = null;
      settingsPreviewDraft = null;
      settingsPreviewRuntimeMenu = null;
      settingsPreviewPulseCounts = {};

      if (
        typeof dialog.close ===
        "function"
      ) {
        dialog.close(
          returnValue
        );
      } else {
        dialog.removeAttribute(
          "open"
        );
      }

      dialog.classList.remove(
        "rml-overlay-closing",
        "rml-overlay-opened",
        "rml-overlay-animating"
      );
    }
  );

  dialog.classList.remove(
    "rml-overlay-opened"
  );

  dialog.classList.add(
    "rml-overlay-closing"
  );
}

async function copyText(text, button) {
  const iconOnlyCopyButton =
    button?.classList.contains(
      "code-copy-button"
    );

  const originalText =
    iconOnlyCopyButton
      ? ""
      : button.textContent;

  const originalAriaLabel =
    button?.getAttribute(
      "aria-label"
    ) || "";

  if (iconOnlyCopyButton) {
    button.classList.remove(
      "is-copied",
      "copy-failed"
    );
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.appendChild(temporary);
      temporary.focus();
      temporary.select();
      if (!document.execCommand("copy")) {
        throw new Error("The browser rejected the clipboard operation.");
      }
      temporary.remove();
    }

    if (iconOnlyCopyButton) {
      void button.offsetWidth;
      button.classList.add("is-copied");
      button.setAttribute(
        "aria-label",
        "C# copied"
      );
    } else {
      button.textContent = "Copied";
    }
  } catch (error) {
    console.error(error);

    if (iconOnlyCopyButton) {
      button.classList.add("copy-failed");
      button.setAttribute(
        "aria-label",
        "Copy failed"
      );
    } else {
      button.textContent = "Copy failed";
    }
  }

  window.setTimeout(() => {
    if (iconOnlyCopyButton) {
      button.classList.remove(
        "is-copied",
        "copy-failed"
      );

      if (originalAriaLabel) {
        button.setAttribute(
          "aria-label",
          originalAriaLabel
        );
      } else {
        button.removeAttribute(
          "aria-label"
        );
      }
    } else {
      button.textContent = originalText;
    }
  }, 1400);
}

function copyGeneratedCode(button) {
  if (getDiagnostics().length > 0) {
    return Promise.resolve();
  }
  return copyText(
    generateCode(),
    button
  );
}

function copyGeneratedCodeForCurrentView(
  button
) {
  if (getDiagnostics().length > 0) {
    return Promise.resolve();
  }
  return copyText(
    generatedCodeForCurrentView().code,
    button
  );
}

function copyGeneratedProjectFile(button) {
  if (getDiagnostics().length > 0) {
    return Promise.resolve();
  }
  return copyText(
    generateProjectFile(),
    button
  );
}

function copyGeneratedNodeGraphCode(
  button
) {
  if (getDiagnostics().length > 0) {
    return Promise.resolve();
  }
  const files =
    getAdditionalGeneratedSourceFiles();

  if (files.length === 0) {
    return Promise.resolve();
  }

  const combined = files
    .map(
      file =>
        `// ============================================================\n` +
        `// FILE: ${file.name}\n` +
        `// ============================================================\n\n` +
        file.content.trimEnd()
    )
    .join("\n\n");

  return copyText(
    `${combined}\n`,
    button
  );
}

function downloadBlob(blob, filename) {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function setProjectFileStatus(
  message,
  tone = ""
) {
  elements.projectFileStatus.textContent =
    message;
  elements.projectFileStatus.classList.toggle(
    "success",
    tone === "success"
  );
  elements.projectFileStatus.classList.toggle(
    "error",
    tone === "error"
  );
}

let activeProjectLoadSession = 0;
let activeBuilderWorkSession = 0;
let builderWorkWatchdog = 0;
let activeBuilderReplacementPrompt = 0;

function nextBuilderVisualFrame() {
  if (
    document.visibilityState ===
      "hidden"
  ) {
    return yieldBuilderTask();
  }

  return new Promise(resolve =>
    window.requestAnimationFrame(
      () => resolve()
    )
  );
}

function yieldBuilderTask() {
  if (
    typeof globalThis.scheduler?.yield ===
      "function"
  ) {
    return globalThis.scheduler.yield();
  }

  if (typeof MessageChannel === "function") {
    return new Promise(resolve => {
      const channel =
        new MessageChannel();
      channel.port1.onmessage = () => {
        channel.port1.close();
        channel.port2.close();
        resolve();
      };
      channel.port2.postMessage(0);
    });
  }

  return Promise.resolve();
}

async function paintBuilderUi() {
  await nextBuilderVisualFrame();
  await nextBuilderVisualFrame();
  await yieldBuilderTask();
}

function setProjectLoadProgress(
  active,
  {
    progress = 0,
    stage = "Preparing project…"
  } = {}
) {
  const host =
    elements.projectLoadProgress;

  if (!host) {
    return;
  }

  host.hidden = !active;
  elements.projectDialog?.setAttribute(
    "aria-busy",
    active ? "true" : "false"
  );

  if (!active) {
    return;
  }

  const normalized = clamp(
    Number(progress) || 0,
    0,
    100
  );
  host.style.setProperty(
    "--rml-load-progress",
    `${normalized}%`
  );
  if (elements.projectLoadProgressStage) {
    elements.projectLoadProgressStage.textContent =
      stage;
  }
}

function cancelActiveProjectLoad() {
  activeProjectLoadSession += 1;
  setProjectLoadProgress(false);
}

function updateBuilderWork(
  session,
  {
    kicker,
    title,
    message,
    detail,
    progress
  } = {}
) {
  if (
    session !== activeBuilderWorkSession ||
    !elements.builderWorkOverlay
  ) {
    return false;
  }

  if (kicker !== undefined) {
    elements.builderWorkKicker.textContent =
      String(kicker);
  }
  if (title !== undefined) {
    elements.builderWorkTitle.textContent =
      String(title);
  }
  if (message !== undefined) {
    elements.builderWorkMessage.textContent =
      String(message);
  }
  if (detail !== undefined) {
    elements.builderWorkDetail.textContent =
      String(detail);
  }

  if (progress !== undefined) {
    const normalized = clamp(
      Number(progress) || 0,
      0,
      100
    );
    elements.builderWorkProgress.style.setProperty(
      "--rml-load-progress",
      `${normalized}%`
    );
    elements.builderWorkProgress.setAttribute(
      "aria-valuenow",
      String(Math.round(normalized))
    );
  }

  return true;
}

function resetBuilderReplacementUi() {
  activeBuilderReplacementPrompt += 1;

  if (elements.builderWorkReplacement) {
    elements.builderWorkReplacement.hidden =
      true;
  }
  if (elements.builderWorkReplacementSearch) {
    elements.builderWorkReplacementSearch.value =
      "";
    elements.builderWorkReplacementSearch.oninput =
      null;
    elements.builderWorkReplacementSearch.onsearch =
      null;
  }
  if (elements.builderWorkReplacementList) {
    elements.builderWorkReplacementList
      .replaceChildren();
    elements.builderWorkReplacementList.onclick =
      null;
    elements.builderWorkReplacementList.ondblclick =
      null;
    elements.builderWorkReplacementList.onkeydown =
      null;
  }
  if (elements.builderWorkReplacementQueue) {
    elements.builderWorkReplacementQueue
      .replaceChildren();
  }
  if (elements.builderWorkReplacementSummary) {
    elements.builderWorkReplacementSummary.textContent =
      "";
  }
  if (elements.builderWorkReplacementCancel) {
    elements.builderWorkReplacementCancel.onclick =
      null;
    elements.builderWorkReplacementCancel.onpointerdown =
      null;
    elements.builderWorkReplacementCancel.onkeydown =
      null;
    elements.builderWorkReplacementCancel.onblur =
      null;
  }
  if (elements.builderWorkReplacementConfirm) {
    elements.builderWorkReplacementConfirm.onclick =
      null;
    elements.builderWorkReplacementConfirm.disabled =
      false;
  }
  if (elements.builderWorkOverlay) {
    delete elements.builderWorkOverlay.dataset.mode;
    elements.builderWorkOverlay.setAttribute(
      "role",
      "status"
    );
    elements.builderWorkOverlay.setAttribute(
      "aria-live",
      "polite"
    );
    elements.builderWorkOverlay.setAttribute(
      "aria-atomic",
      "true"
    );
    elements.builderWorkOverlay.removeAttribute(
      "aria-modal"
    );
  }
}

async function requestBuilderReplacementChoice(
  workSession,
  {
    requirement,
    candidates,
    index = 0,
    total = 1,
    catalogResult = null,
    nodeLabels = [],
    replacementQueue = [],
    initialOperatorId = "",
    validationDiagnostics = []
  } = {}
) {
  if (
    workSession !==
      activeBuilderWorkSession ||
    !elements.builderWorkReplacement ||
    !elements.builderWorkReplacementSearch ||
    !elements.builderWorkReplacementList ||
    !elements.builderWorkReplacementConfirm ||
    !elements.builderWorkReplacementCancel
  ) {
    throw new Error(
      "The pre-import replacement dialog is unavailable. The JSON was not loaded."
    );
  }

  const values =
    Array.isArray(candidates)
      ? candidates.filter(candidate =>
          Boolean(
            String(
              candidate?.operatorId || ""
            ).trim()
          )
        )
      : [];

  if (values.length === 0) {
    throw new Error(
      `No verified compatible replacement is available for '${String(requirement?.operatorId || "<unknown>")}'. The JSON was not loaded.`
    );
  }

  window.clearTimeout(
    builderWorkWatchdog
  );
  builderWorkWatchdog = 0;

  const prompt =
    ++activeBuilderReplacementPrompt;
  const search =
    elements.builderWorkReplacementSearch;
  const list =
    elements.builderWorkReplacementList;
  const confirm =
    elements.builderWorkReplacementConfirm;
  const cancel =
    elements.builderWorkReplacementCancel;
  const summary =
    elements.builderWorkReplacementSummary;
  const queueHost =
    elements.builderWorkReplacementQueue;
  const operatorId = String(
    requirement?.operatorId ||
    "<unknown>"
  );
  const visibleLabels =
    [...new Set(
      (Array.isArray(nodeLabels)
        ? nodeLabels
        : [])
        .map(label =>
          String(label || "").trim()
        )
        .filter(Boolean)
    )];
  const nodeDescription =
    visibleLabels.length > 0
      ? visibleLabels.slice(0, 3).join(", ")
      : operatorId;
  const sourceDescription =
    catalogResult?.live === true
      ? "current Live catalog"
      : "cached fallback";
  const previousPlanDiagnostics =
    (Array.isArray(validationDiagnostics)
      ? validationDiagnostics
      : [])
      .map(value =>
        String(value || "").trim()
      )
      .filter(Boolean);

  updateBuilderWork(
    workSession,
    {
      kicker:
        `Replacement ${Math.min(index + 1, total)} of ${Math.max(1, total)}`,
      title:
        "Choose a replacement before import",
      message:
        previousPlanDiagnostics.length > 0
          ? `The previously selected replacement set is not type-safe. Review '${nodeDescription}' and explicitly confirm or change its replacement.`
          : `'${nodeDescription}' uses an unavailable API contract. Choose one compatible node from the ${sourceDescription}; the project is installed only after every replacement is confirmed.`,
      detail:
        previousPlanDiagnostics.length > 0
          ? `${previousPlanDiagnostics.slice(0, 3).join(" | ")}${previousPlanDiagnostics.length > 3 ? ` | and ${previousPlanDiagnostics.length - 3} more` : ""} No candidate is selected or changed automatically.`
          : `${values.length.toLocaleString("de-DE")} available replacement candidate${values.length === 1 ? "" : "s"} for ${operatorId}. The search is limited to this candidate set. No candidate is selected automatically. Node positions and complete stored wire routes remain unchanged.`,
      progress:
        50 +
        Math.round(
          4 *
          Math.min(index, total) /
          Math.max(1, total)
        )
    }
  );

  elements.builderWorkOverlay.dataset.mode =
    "replacement";
  elements.builderWorkOverlay.setAttribute(
    "role",
    "dialog"
  );
  elements.builderWorkOverlay.setAttribute(
    "aria-modal",
    "true"
  );
  elements.builderWorkOverlay.setAttribute(
    "aria-live",
    "off"
  );
  elements.builderWorkOverlay.setAttribute(
    "aria-atomic",
    "false"
  );
  elements.builderWorkReplacement.hidden =
    false;
  search.value = "";
  let selectedOperatorId =
    values.some(candidate =>
      candidate.operatorId ===
        String(initialOperatorId || "")
    )
      ? String(initialOperatorId)
      : "";
  let visibleCandidates = [];

  const renderReplacementQueue = () => {
    if (!queueHost) {
      return;
    }
    const fragment =
      document.createDocumentFragment();
    for (const entry of
      Array.isArray(replacementQueue)
        ? replacementQueue
        : []) {
      const status = String(
        entry?.status || "pending"
      );
      const row =
        document.createElement("div");
      row.className =
        "builder-work-replacement-queue-item";
      row.dataset.status = status;
      row.setAttribute("role", "listitem");

      const state =
        document.createElement("span");
      state.className =
        "builder-work-replacement-queue-state";
      state.textContent =
        status === "selected"
          ? "✓"
          : status === "current"
            ? "›"
            : status === "unavailable"
              ? "!"
              : "·";
      const name =
        document.createElement("span");
      name.className =
        "builder-work-replacement-queue-name";
      name.textContent = String(
        entry?.operatorId || "<unknown>"
      );
      const count =
        document.createElement("span");
      count.className =
        "builder-work-replacement-queue-count";
      const instances = Math.max(
        1,
        Number(entry?.instanceCount) || 0
      );
      count.textContent =
        `${instances.toLocaleString("de-DE")}×`;
      row.append(state, name, count);
      fragment.appendChild(row);
    }
    queueHost.replaceChildren(fragment);
    queueHost
      .querySelector(
        '[data-status="current"]'
      )
      ?.scrollIntoView({
        block: "nearest"
      });
  };

  const updateReplacementSummary = () => {
    if (!summary) {
      return;
    }
    const selected =
      values.find(candidate =>
        candidate.operatorId ===
          selectedOperatorId
      );
    const missingInputs =
      Array.isArray(
        selected?.unmappedRequiredInputs
      )
        ? selected.unmappedRequiredInputs
        : [];
    const matchCount =
      visibleCandidates.length;
    const base =
      `${matchCount.toLocaleString("de-DE")} visible candidate${matchCount === 1 ? "" : "s"} · source: ${sourceDescription}.`;
    if (!selected) {
      summary.textContent = base;
      return;
    }
    if (missingInputs.length > 0) {
      summary.textContent =
        `${base} The selected node adds ${missingInputs.length.toLocaleString("de-DE")} unconnected required input${missingInputs.length === 1 ? "" : "s"}: ${missingInputs.map(port => port.label || port.id).join(", ")}. Existing wires are preserved; configure these inputs after import.`;
      return;
    }
    summary.textContent =
      selected.matchMode === "strict"
        ? `${base} Exact stored port contract.`
        : `${base} Manual structural mapping; every existing connected port is mapped.`;
  };

  const selectCandidate = (
    operatorId,
    {
      focus = false,
      scroll = false
    } = {}
  ) => {
    const selected =
      visibleCandidates.find(candidate =>
        candidate.operatorId ===
          operatorId
      );
    selectedOperatorId =
      selected?.operatorId || "";

    for (const item of
      list.querySelectorAll(
        ".builder-work-replacement-item"
      )) {
      const active =
        item.dataset.operatorId ===
          selectedOperatorId;
      item.setAttribute(
        "aria-selected",
        String(active)
      );
      item.tabIndex = active
        ? 0
        : -1;

      if (active && focus) {
        item.focus({
          preventScroll: true
        });
      }
      if (active && scroll) {
        item.scrollIntoView({
          block: "nearest"
        });
      }
    }

    confirm.disabled =
      !selectedOperatorId;
    updateReplacementSummary();
  };

  const renderCandidates = () => {
    const query = String(
      search.value || ""
    ).trim().toLocaleLowerCase();
    const previous =
      selectedOperatorId;
    const matches = query
      ? values.filter(candidate =>
          `${candidate.title || ""} ${candidate.operatorId} ${candidate.group || ""} ${candidate.description || ""}`
            .toLocaleLowerCase()
            .includes(query)
        )
      : values;
    visibleCandidates = matches.slice(
      0,
      BUILDER_REPLACEMENT_RENDER_LIMIT
    );
    const fragment =
      document.createDocumentFragment();

    for (const candidate of
      visibleCandidates) {
      const item =
        document.createElement("button");
      item.type = "button";
      item.className =
        "builder-work-replacement-item";
      item.dataset.operatorId =
        candidate.operatorId;
      item.setAttribute(
        "role",
        "option"
      );
      item.setAttribute(
        "aria-selected",
        "false"
      );

      const symbol =
        document.createElement("span");
      symbol.className =
        "builder-work-replacement-symbol";
      const paletteIcon =
        candidate.paletteIcon &&
        typeof candidate.paletteIcon ===
          "object"
          ? candidate.paletteIcon
          : {
              symbol:
                candidate.symbol ||
                "API",
              color: "#8fdcff",
              tone: "standard"
            };
      symbol.textContent = String(
        paletteIcon.symbol ||
        candidate.symbol ||
        "API"
      );
      symbol.dataset.iconTone = String(
        paletteIcon.tone ||
        "standard"
      );
      symbol.style.setProperty(
        "--rml-node-icon-color",
        String(
          paletteIcon.color ||
          "#8fdcff"
        )
      );

      const copy =
        document.createElement("span");
      copy.className =
        "builder-work-replacement-copy";
      const title =
        document.createElement("strong");
      title.textContent =
        candidate.title ||
        candidate.operatorId;
      const group =
        document.createElement("small");
      group.textContent =
        `${candidate.group || "Resonite API"} · ${candidate.operatorId}`;
      const match =
        document.createElement("small");
      match.className =
        "builder-work-replacement-match";
      const missingInputs =
        Array.isArray(
          candidate.unmappedRequiredInputs
        )
          ? candidate
              .unmappedRequiredInputs
          : [];
      match.dataset.warning = String(
        missingInputs.length > 0
      );
      match.textContent =
        candidate.matchMode === "strict"
          ? "Exact port contract"
          : missingInputs.length > 0
            ? `Structural mapping · ${missingInputs.length} new input${missingInputs.length === 1 ? "" : "s"} to configure`
            : "Structural mapping · all connected ports mapped";
      copy.append(
        title,
        group,
        match
      );
      item.append(
        symbol,
        copy
      );
      item.title =
        `${candidate.title || candidate.operatorId}\n${candidate.group || "Resonite API"}\n${candidate.operatorId}\n${match.textContent}`;
      fragment.appendChild(item);
    }

    if (visibleCandidates.length === 0) {
      const empty =
        document.createElement("div");
      empty.className =
        "builder-work-replacement-empty";
      empty.textContent =
        "No compatible node matches this search.";
      fragment.appendChild(empty);
    }

    list.setAttribute(
      "aria-busy",
      "true"
    );
    list.replaceChildren(fragment);
    list.setAttribute(
      "aria-busy",
      "false"
    );
    if (
      previous &&
      visibleCandidates.some(candidate =>
        candidate.operatorId === previous
      )
    ) {
      selectedOperatorId = previous;
    } else {
      selectedOperatorId = "";
    }

    selectCandidate(
      selectedOperatorId
    );
    if (
      matches.length >
        visibleCandidates.length
    ) {
      summary.textContent =
        `${matches.length.toLocaleString("de-DE")} matches · showing the first ${visibleCandidates.length.toLocaleString("de-DE")}. Refine the search to reach later entries.`;
    } else {
      updateReplacementSummary();
    }
  };

  const choice = new Promise(
    (resolve, reject) => {
      let settled = false;
      let cancelPointerArmed = false;
      let cancelKeyboardArmed = false;
      const finish = (
        callback,
        value
      ) => {
        if (
          settled ||
          prompt !==
            activeBuilderReplacementPrompt
        ) {
          return;
        }
        settled = true;
        document.removeEventListener(
          "keydown",
          onKeyDown,
          true
        );
        resetBuilderReplacementUi();
        callback(value);
      };
      const accept = () => {
        const selected =
          values.find(candidate =>
            candidate.operatorId ===
              selectedOperatorId
          );
        if (selected) {
          finish(resolve, selected);
        }
      };
      const rejectImport = source => {
        const error = new Error(
          `Project import was cancelled by the ${source} before the required API replacement was confirmed. The JSON was not loaded.`
        );
        error.code =
          "RML_PROJECT_IMPORT_CANCELLED";
        error.cancelSource = source;
        finish(
          reject,
          error
        );
      };
      const onKeyDown = event => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopImmediatePropagation();
          rejectImport("Escape key");
        }
      };

      search.oninput =
        renderCandidates;
      search.onsearch =
        renderCandidates;
      list.onclick = event => {
        const item =
          event.target.closest(
            ".builder-work-replacement-item"
          );
        if (item) {
          selectCandidate(
            item.dataset.operatorId,
            { focus: true }
          );
        }
      };
      list.ondblclick = event => {
        if (
          event.target.closest(
            ".builder-work-replacement-item"
          )
        ) {
          accept();
        }
      };
      list.onkeydown = event => {
        if (
          ![
            "ArrowDown",
            "ArrowUp",
            "Home",
            "End"
          ].includes(event.key) ||
          visibleCandidates.length === 0
        ) {
          return;
        }
        event.preventDefault();
        const currentIndex =
          visibleCandidates.findIndex(
            candidate =>
              candidate.operatorId ===
                selectedOperatorId
          );
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? visibleCandidates.length - 1
              : event.key === "ArrowDown"
                ? currentIndex < 0
                  ? 0
                  : Math.min(
                      visibleCandidates.length - 1,
                      currentIndex + 1
                    )
                : currentIndex < 0
                  ? visibleCandidates.length - 1
                  : Math.max(
                      0,
                      currentIndex - 1
                    );
        selectCandidate(
          visibleCandidates[nextIndex]
            .operatorId,
          {
            focus: true,
            scroll: true
          }
        );
      };
      confirm.onclick = accept;
      cancel.onpointerdown = event => {
        cancelPointerArmed =
          event.isPrimary !== false &&
          Number(event.button) === 0;
      };
      cancel.onkeydown = event => {
        cancelKeyboardArmed =
          event.key === "Enter" ||
          event.key === " ";
      };
      cancel.onblur = () => {
        cancelPointerArmed = false;
        cancelKeyboardArmed = false;
      };
      cancel.onclick = event => {
        const explicitlyActivated =
          cancelPointerArmed ||
          cancelKeyboardArmed ||
          (
            event.isTrusted === true &&
            document.activeElement ===
              cancel
          );
        cancelPointerArmed = false;
        cancelKeyboardArmed = false;

        if (!explicitlyActivated) {
          updateBuilderWork(
            workSession,
            {
              detail:
                "An unconfirmed Cancel-button activation was ignored. Select a replacement, or activate Cancel import directly to stop loading."
            }
          );
          return;
        }

        rejectImport(
          "explicit Cancel import button"
        );
      };
      document.addEventListener(
        "keydown",
        onKeyDown,
        true
      );
    }
  );

  renderReplacementQueue();
  renderCandidates();
  await paintBuilderUi();
  search.focus({
    preventScroll: true
  });
  return choice;
}

function beginBuilderWork(options = {}) {
  activeBuilderWorkSession += 1;
  const session =
    activeBuilderWorkSession;

  window.clearTimeout(
    builderWorkWatchdog
  );

  resetBuilderReplacementUi();

  elements.builderWorkOverlay.hidden = false;
  document.body.classList.add(
    "rml-builder-work-active"
  );
  updateBuilderWork(session, options);

  const timeout = clamp(
    Number(options.timeout) || 30000,
    1000,
    120000
  );
  builderWorkWatchdog =
    window.setTimeout(() => {
      if (
        session ===
          activeBuilderWorkSession
      ) {
        updateBuilderWork(
          session,
          {
            title:
              "Still completing the operation…",
            message:
              "The loading screen remains visible until every required step has completed or the operation reports an error.",
            detail:
              "No work has been moved into an invisible background state."
          }
        );
      }
    }, timeout);
  return session;
}

function finishBuilderWork(session) {
  if (
    session !== activeBuilderWorkSession ||
    !elements.builderWorkOverlay
  ) {
    return false;
  }

  window.clearTimeout(
    builderWorkWatchdog
  );
  builderWorkWatchdog = 0;
  resetBuilderReplacementUi();
  elements.builderWorkOverlay.hidden = true;
  document.body.classList.remove(
    "rml-builder-work-active"
  );
  return true;
}

function beginStartupStatus(
  initialText =
    "Restoring local workspace…"
) {
  const label =
    elements.workspaceRestoreState;
  const container =
    label?.closest?.(".local-state") ||
    label?.parentElement ||
    null;
  let finished = false;

  const set = value => {
    if (!label || finished) {
      return false;
    }
    label.textContent = String(
      value ||
      "Restoring local workspace…"
    );
    if (container?.dataset) {
      container.dataset.state =
        "loading";
    }
    return true;
  };

  set(initialText);

  return Object.freeze({
    update(changes = {}) {
      return set(
        changes.title ||
        changes.message ||
        initialText
      );
    },
    finish() {
      if (finished) {
        return false;
      }
      finished = true;
      if (label) {
        label.textContent =
          "Draft saved locally";
      }
      if (container?.dataset) {
        container.dataset.state =
          "ready";
      }
      return true;
    },
    get visible() {
      return false;
    }
  });
}

function projectTypedRuntimeGraph(
  project
) {
  const graph =
    project?.extensions
      ?.typedNodeGraph;

  return graph &&
    typeof graph === "object" &&
    !Array.isArray(graph)
      ? graph
      : null;
}

function projectRuntimeGraphViews(
  graph
) {
  if (
    !graph ||
    typeof graph !== "object" ||
    Array.isArray(graph)
  ) {
    return [];
  }

  const views = [];
  const visited = new Set();
  const append = (
    candidate,
    ownerNodeId = "",
    path = "runtime-root"
  ) => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate) ||
      visited.has(candidate) ||
      !Array.isArray(candidate.nodes) ||
      !Array.isArray(candidate.connections)
    ) {
      return;
    }

    visited.add(candidate);
    views.push({
      ownerNodeId,
      path,
      graph: candidate
    });

    const customFiles =
      candidate.customCSharpFiles &&
      typeof candidate.customCSharpFiles === "object" &&
      !Array.isArray(
        candidate.customCSharpFiles
      )
        ? candidate.customCSharpFiles
        : {};

    for (const [nestedOwnerId, customGraph] of
      Object.entries(customFiles)) {
      append(
        customGraph,
        String(nestedOwnerId || ""),
        `${path}/custom-csharp:${String(nestedOwnerId || "<unnamed>")}`
      );
    }

    const apiComposites =
      candidate.apiCompositeGraphs &&
      typeof candidate.apiCompositeGraphs ===
        "object" &&
      !Array.isArray(
        candidate.apiCompositeGraphs
      )
        ? candidate.apiCompositeGraphs
        : {};
    for (const [nestedOwnerId, compositeGraph] of
      Object.entries(apiComposites)) {
      append(
        compositeGraph,
        String(nestedOwnerId || ""),
        `${path}/api-composite:${String(nestedOwnerId || "<unnamed>")}`
      );
    }
  };

  append(graph);

  return views;
}

function irreparableProjectJsonError(
  reason,
  diagnostics = []
) {
  const details = [
    ...new Set(
      (Array.isArray(diagnostics)
        ? diagnostics
        : [diagnostics])
        .map(value =>
          String(value || "").trim()
        )
        .filter(Boolean)
    )
  ];
  const suffix = details.length > 0
    ? ` ${details.slice(0, 12).join(" | ")}${details.length > 12 ? ` | and ${details.length - 12} more` : ""}`
    : "";
  const error = new Error(
    `Irreparable project JSON: ${String(reason || "the stored project structure is invalid.")}${suffix} Safe node replacement cannot reconstruct this project without losing or inventing graph behavior. The JSON was not loaded.`
  );
  error.code =
    "RML_IRREPARABLE_PROJECT_JSON";
  return error;
}

function validateProjectStructureForRepair(
  project
) {
  const started = performance.now();
  const issues = new Map();
  const addIssue = (
    category,
    detail
  ) => {
    if (!issues.has(category)) {
      issues.set(category, {
        count: 0,
        samples: []
      });
    }
    const issue = issues.get(category);
    issue.count += 1;
    if (
      issue.samples.length < 4 &&
      detail
    ) {
      issue.samples.push(
        String(detail)
      );
    }
  };
  const graph =
    projectTypedRuntimeGraph(project);

  if (!graph) {
    return Object.freeze({
      valid: true,
      diagnostics: Object.freeze([]),
      nodeCount: 0,
      connectionCount: 0,
      elapsedMilliseconds:
        performance.now() - started
    });
  }

  let nodeCount = 0;
  let connectionCount = 0;
  const visited = new Set();
  const inspectGraph = (
    candidate,
    path,
    depth
  ) => {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      Array.isArray(candidate)
    ) {
      addIssue(
        "invalid graph records",
        `${path}: graph object missing`
      );
      return;
    }
    if (visited.has(candidate)) {
      addIssue(
        "recursive graph records",
        path
      );
      return;
    }
    if (depth > PROJECT_TREE_MAX_DEPTH) {
      addIssue(
        "graph nesting overflow",
        path
      );
      return;
    }
    visited.add(candidate);

    if (!Array.isArray(candidate.nodes)) {
      addIssue(
        "invalid node collections",
        path
      );
      return;
    }
    if (!Array.isArray(candidate.connections)) {
      addIssue(
        "invalid connection collections",
        path
      );
      return;
    }

    const nodeIds = new Set();
    for (const node of candidate.nodes) {
      nodeCount += 1;
      if (
        !node ||
        typeof node !== "object" ||
        Array.isArray(node)
      ) {
        addIssue(
          "invalid node records",
          path
        );
        continue;
      }
      const id = String(
        node.id || ""
      ).trim();
      if (!id) {
        addIssue(
          "nodes without IDs",
          path
        );
      } else if (nodeIds.has(id)) {
        addIssue(
          "duplicate node IDs",
          `${path}:${id}`
        );
      } else {
        nodeIds.add(id);
      }
      if (
        node.kind !== "configuration" &&
        node.kind !== "operator"
      ) {
        addIssue(
          "invalid node kinds",
          `${path}:${id || "<unnamed>"}`
        );
      }
      if (
        node.kind === "operator" &&
        !String(
          node.operatorId || ""
        ).trim()
      ) {
        addIssue(
          "operators without identities",
          `${path}:${id || "<unnamed>"}`
        );
      }
      if (
        !Number.isFinite(Number(node.x)) ||
        !Number.isFinite(Number(node.y))
      ) {
        addIssue(
          "nodes without finite positions",
          `${path}:${id || "<unnamed>"}`
        );
      }
    }

    const connectionIds = new Set();
    const pointIdsByConnection =
      new Map();
    for (const connection of
      candidate.connections) {
      connectionCount += 1;
      if (
        !connection ||
        typeof connection !== "object" ||
        Array.isArray(connection)
      ) {
        addIssue(
          "invalid connection records",
          path
        );
        continue;
      }
      const id = String(
        connection.id || ""
      ).trim();
      const fromNode = String(
        connection.fromNode || ""
      ).trim();
      const toNode = String(
        connection.toNode || ""
      ).trim();
      const fromPort = String(
        connection.fromPort || ""
      ).trim();
      const toPort = String(
        connection.toPort || ""
      ).trim();
      if (!id) {
        addIssue(
          "connections without IDs",
          path
        );
      } else if (
        connectionIds.has(id)
      ) {
        addIssue(
          "duplicate connection IDs",
          `${path}:${id}`
        );
      } else {
        connectionIds.add(id);
      }
      if (
        !nodeIds.has(fromNode) ||
        !nodeIds.has(toNode)
      ) {
        addIssue(
          "orphaned connections",
          `${path}:${id || "<unnamed>"}`
        );
      }
      if (!fromPort || !toPort) {
        addIssue(
          "connections without ports",
          `${path}:${id || "<unnamed>"}`
        );
      }

      const points =
        connection.points == null
          ? []
          : connection.points;
      if (!Array.isArray(points)) {
        addIssue(
          "invalid wire-point collections",
          `${path}:${id || "<unnamed>"}`
        );
        continue;
      }
      const pointIds = new Set();
      pointIdsByConnection.set(id, pointIds);
      for (const point of points) {
        const pointId = String(
          point?.id || ""
        ).trim();
        if (
          !point ||
          typeof point !== "object" ||
          Array.isArray(point) ||
          !pointId ||
          !Number.isFinite(
            Number(point.x)
          ) ||
          !Number.isFinite(
            Number(point.y)
          )
        ) {
          addIssue(
            "invalid wire points",
            `${path}:${id || "<unnamed>"}`
          );
          continue;
        }
        if (pointIds.has(pointId)) {
          addIssue(
            "duplicate wire-point IDs",
            `${path}:${id}:${pointId}`
          );
        }
        pointIds.add(pointId);
      }
    }

    for (const connection of
      candidate.connections) {
      const branch =
        connection?.branchFrom;
      if (branch == null) {
        continue;
      }
      const connectionId = String(
        branch?.connectionId || ""
      ).trim();
      const pointId = String(
        branch?.pointId || ""
      ).trim();
      if (
        !connectionId ||
        !pointId ||
        !connectionIds.has(connectionId) ||
        !pointIdsByConnection
          .get(connectionId)
          ?.has(pointId)
      ) {
        addIssue(
          "broken wire branches",
          `${path}:${String(connection?.id || "<unnamed>")}`
        );
      }
    }

    const customFiles =
      candidate.customCSharpFiles;
    if (
      customFiles != null &&
      (
        typeof customFiles !== "object" ||
        Array.isArray(customFiles)
      )
    ) {
      addIssue(
        "invalid Custom C# graph collection",
        path
      );
      return;
    }
    for (const [ownerNodeId, customGraph] of
      Object.entries(customFiles || {})) {
      if (!nodeIds.has(ownerNodeId)) {
        addIssue(
          "orphaned Custom C# graphs",
          `${path}:${ownerNodeId}`
        );
      }
      inspectGraph(
        customGraph,
        `${path}/custom-csharp:${ownerNodeId || "<unnamed>"}`,
        depth + 1
      );
    }

    const apiComposites =
      candidate.apiCompositeGraphs;
    if (
      apiComposites != null &&
      (
        typeof apiComposites !==
          "object" ||
        Array.isArray(apiComposites)
      )
    ) {
      addIssue(
        "invalid API Composite graph collection",
        path
      );
      return;
    }
    for (const [ownerNodeId, compositeGraph] of
      Object.entries(
        apiComposites || {}
      )) {
      const owner = candidate.nodes.find(
        node => node?.id === ownerNodeId
      );
      if (
        !owner ||
        owner.operatorId !==
          "container.apiComposite"
      ) {
        addIssue(
          "orphaned API Composite graphs",
          `${path}:${ownerNodeId}`
        );
      }
      const boundaries =
        Array.isArray(
          compositeGraph?.boundaryPorts
        )
          ? compositeGraph.boundaryPorts
          : [];
      const ownerBoundaries =
        Array.isArray(
          owner?.parameters
            ?.boundaryPorts
        )
          ? owner.parameters.boundaryPorts
          : [];
      const boundaryIdentity = values =>
        values.map(boundary => [
          String(boundary?.id || ""),
          String(
            boundary?.direction || ""
          ),
          String(
            boundary?.internalNodeId ||
            ""
          ),
          String(
            boundary?.internalPortId ||
            ""
          )
        ]);
      if (
        JSON.stringify(
          boundaryIdentity(boundaries)
        ) !==
        JSON.stringify(
          boundaryIdentity(
            ownerBoundaries
          )
        )
      ) {
        addIssue(
          "divergent API Composite proxy contracts",
          `${path}:${ownerNodeId}`
        );
      }
      const internalNodeIds = new Set(
        Array.isArray(compositeGraph?.nodes)
          ? compositeGraph.nodes.map(node =>
              String(node?.id || "")
            )
          : []
      );
      const proxyIds = new Set();
      for (const boundary of boundaries) {
        const proxyId = String(
          boundary?.id || ""
        );
        if (
          !proxyId ||
          proxyIds.has(proxyId) ||
          ![
            "input",
            "output"
          ].includes(
            boundary?.direction
          ) ||
          !internalNodeIds.has(
            String(
              boundary?.internalNodeId ||
              ""
            )
          ) ||
          !String(
            boundary?.internalPortId ||
            ""
          )
        ) {
          addIssue(
            "invalid API Composite boundary ports",
            `${path}:${ownerNodeId}:${proxyId || "<unnamed>"}`
          );
        }
        proxyIds.add(proxyId);
      }
      const combinedConnections = [
        ...candidate.connections,
        ...(
          Array.isArray(
            compositeGraph?.connections
          )
            ? compositeGraph.connections
            : []
        )
      ];
      const combinedById = new Map(
        combinedConnections.map(
          connection => [
            String(
              connection?.id || ""
            ),
            connection
          ]
        )
      );
      for (const [connectionId, branch] of
        Object.entries(
          compositeGraph?.branchRouting ||
          {}
        )) {
        const parent = combinedById.get(
          String(
            branch?.connectionId || ""
          )
        );
        const pointId = String(
          branch?.pointId || ""
        );
        if (
          !combinedById.has(connectionId) ||
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
          addIssue(
            "invalid API Composite branch routing",
            `${path}:${ownerNodeId}:${connectionId}`
          );
        }
      }
      inspectGraph(
        compositeGraph,
        `${path}/api-composite:${ownerNodeId || "<unnamed>"}`,
        depth + 1
      );
    }
  };

  inspectGraph(
    graph,
    "runtime-root",
    0
  );

  const diagnostics = [...issues]
    .map(([category, issue]) =>
      `${issue.count.toLocaleString("de-DE")} ${category}${issue.samples.length > 0 ? ` (${issue.samples.join(", ")})` : ""}`
    );
  return Object.freeze({
    valid: diagnostics.length === 0,
    diagnostics:
      Object.freeze(diagnostics),
    nodeCount,
    connectionCount,
    elapsedMilliseconds:
      performance.now() - started
  });
}

function validateRuntimeGraphViewsFast(
  graph
) {
  const validator =
    window.RMLTypedNodeGraphGenerator
      ?.validateDocument;
  if (typeof validator !== "function") {
    return [
      "The Runtime Graph validator is unavailable."
    ];
  }

  const diagnostics = [];
  for (const view of
    projectRuntimeGraphViews(graph)) {
    const result = validator({
      state: {
        extensions: {
          typedNodeGraph:
            view.graph
        }
      }
    });
    for (const message of
      Array.isArray(result?.diagnostics)
        ? result.diagnostics
        : []) {
      diagnostics.push(
        `${view.path}: ${String(message)}`
      );
    }
  }
  return [...new Set(diagnostics)];
}

function projectRequiredCatalogNodes(
  project
) {
  const graph =
    projectTypedRuntimeGraph(
      project
    );

  const graphViews =
    projectRuntimeGraphViews(graph);
  const registry =
    window.RMLModNodeRegistry;
  const definitions =
    registry
      ?.getNodeDefinitions?.() || {};
  const requirements = new Map();
  for (const view of graphViews) {
    const operatorByNodeId = new Map();
    const nodes = Array.isArray(
      view.graph.nodes
    )
      ? view.graph.nodes
      : [];

    for (const node of nodes) {
      const operatorId = String(
        node?.operatorId || ""
      ).trim();
      const apiContract =
        node?.apiContract &&
        typeof node.apiContract === "object" &&
        !Array.isArray(node.apiContract)
          ? node.apiContract
          : null;
      const hasPortableApiIdentity =
        Boolean(
          String(apiContract?.ownerType || "").trim() &&
          String(apiContract?.kind || "").trim()
        );
      const definition =
        definitions[operatorId];
      const integratedNode =
        typeof registry
          ?.isIntegratedNode ===
            "function"
          ? registry.isIntegratedNode(
              operatorId
            )
          : Boolean(
              definition &&
              definition
                .catalogGenerated !== true &&
              definition
                .unavailableApiContract !==
                  true &&
              definition
                .legacyCatalogAlias !== true
            );
      const missingCatalogObject =
        node?.kind === "operator" &&
        (
          !definition ||
          definition
            .unavailableApiContract ===
              true
        );

      if (
        integratedNode ||
        node?.kind !== "operator"
      ) {
        continue;
      }

      if (
        !operatorId.startsWith("api.") &&
        !hasPortableApiIdentity &&
        !missingCatalogObject
      ) {
        continue;
      }

      operatorByNodeId.set(
        String(node.id || ""),
        operatorId
      );

      if (!requirements.has(operatorId)) {
        requirements.set(operatorId, {
          operatorId,
          apiContract:
            apiContract
              ? clone(apiContract)
              : null,
          missingCatalogObject,
          catalogScope:
            operatorId.startsWith("api.") ||
            hasPortableApiIdentity
              ? "api"
              : "all",
          nodeParameters:
            node?.parameters &&
            typeof node.parameters ===
              "object" &&
            !Array.isArray(
              node.parameters
            )
              ? clone(node.parameters)
              : {},
          nodeLabels: new Set(),
          inputPorts: new Set(),
          outputPorts: new Set()
        });
      }

      const storedLabel = String(
        node?.label || ""
      ).trim();
      if (storedLabel) {
        requirements
          .get(operatorId)
          .nodeLabels.add(storedLabel);
      }
    }

    for (const connection of
      Array.isArray(view.graph.connections)
        ? view.graph.connections
        : []) {
      const sourceOperator =
        operatorByNodeId.get(
          String(
            connection?.fromNode || ""
          )
        );
      const targetOperator =
        operatorByNodeId.get(
          String(
            connection?.toNode || ""
          )
        );

      if (sourceOperator) {
        requirements
          .get(sourceOperator)
          .outputPorts.add(
            String(
              connection?.fromPort || ""
            )
          );
      }

      if (targetOperator) {
        requirements
          .get(targetOperator)
          .inputPorts.add(
            String(
              connection?.toPort || ""
            )
          );
      }
    }

    for (const boundary of
      Array.isArray(
        view.graph.boundaryPorts
      )
        ? view.graph.boundaryPorts
        : []) {
      const operatorId =
        operatorByNodeId.get(
          String(
            boundary?.internalNodeId ||
            ""
          )
        );
      const portId = String(
        boundary?.internalPortId || ""
      );
      if (!operatorId || !portId) {
        continue;
      }
      if (
        boundary.direction === "input"
      ) {
        requirements
          .get(operatorId)
          ?.inputPorts.add(portId);
      } else if (
        boundary.direction === "output"
      ) {
        requirements
          .get(operatorId)
          ?.outputPorts.add(portId);
      }
    }
  }

  return [...requirements.values()]
    .map(requirement => ({
      operatorId:
        requirement.operatorId,
      apiContract:
        requirement.apiContract,
      missingCatalogObject:
        requirement
          .missingCatalogObject === true,
      catalogScope:
        requirement.catalogScope,
      nodeParameters:
        clone(
          requirement.nodeParameters || {}
        ),
      nodeLabels:
        [...requirement.nodeLabels]
          .filter(Boolean)
          .sort((left, right) =>
            left.localeCompare(right)
          ),
      inputPorts:
        [...requirement.inputPorts]
          .filter(Boolean)
          .sort((left, right) =>
            left.localeCompare(right)
          ),
      outputPorts:
        [...requirement.outputPorts]
          .filter(Boolean)
          .sort((left, right) =>
            left.localeCompare(right)
          )
    }))
    .sort((left, right) =>
      left.operatorId.localeCompare(
        right.operatorId
      )
    );
}

function promiseWithBuilderTimeout(
  promise,
  timeout,
  message
) {
  return new Promise(
    (resolve, reject) => {
      let settled = false;
      const finish = callback => value => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        callback(value);
      };
      const timer = window.setTimeout(
        finish(reject),
        timeout,
        new Error(message)
      );

      Promise.resolve(promise).then(
        finish(resolve),
        finish(reject)
      );
    }
  );
}

async function ensureProjectRuntimePrerequisites(
  project,
  workSession,
  {
    catalogOnly = false,
    catalogPreflight = null
  } = {}
) {
  const graph =
    projectTypedRuntimeGraph(
      project
    );

  if (!graph) {
    return {
      graph: null,
      catalog: null,
      runtimeActive: false
    };
  }

  updateBuilderWork(
    workSession,
    {
      title:
        "Checking whether the stored graph is repairable…",
      message:
        "Node, connection, wire-point and branch identities are being checked once before any catalog lookup or replacement dialog.",
      detail:
        "This is a linear structure pass. It does not generate C# and does not test replacement combinations.",
      progress: 34
    }
  );
  await paintBuilderUi();

  const structuralRepairability =
    catalogPreflight
      ?.structuralRepairability ||
    validateProjectStructureForRepair(
      project
    );
  if (!structuralRepairability.valid) {
    throw irreparableProjectJsonError(
      "its graph structure is damaged and cannot be restored by replacing operators.",
      structuralRepairability.diagnostics
    );
  }

  updateBuilderWork(
    workSession,
    {
      title:
        "Stored graph structure is intact…",
      message:
        `${structuralRepairability.nodeCount.toLocaleString("de-DE")} nodes and ${structuralRepairability.connectionCount.toLocaleString("de-DE")} connections passed the repairability structure check.`,
      detail:
        `Completed in ${Math.max(0.1, structuralRepairability.elapsedMilliseconds).toLocaleString("de-DE", { maximumFractionDigits: 1 })} ms. Catalog contracts are checked next.`,
      progress: 35
    }
  );
  await paintBuilderUi();

  let requiredCatalogNodes =
    Array.isArray(
      catalogPreflight
        ?.requiredCatalogNodes
    )
      ? catalogPreflight
          .requiredCatalogNodes
      : [];
  let catalogResult =
    catalogPreflight?.catalog || null;
  let appliedCatalogMigrations =
    structuredClone(
      catalogPreflight
        ?.appliedCatalogMigrations ||
      {}
    );
  let appliedPortMigrations =
    structuredClone(
      catalogPreflight
        ?.appliedPortMigrations ||
      {}
    );

  if (!catalogPreflight) {

  updateBuilderWork(
    workSession,
    {
      title:
        "Loading Runtime Graph modules…",
      message:
        "The node registry, runtime generator and graph host must be completely available before the project can be installed.",
      detail:
        "The current project is still unchanged.",
      progress: 36
    }
  );
  await paintBuilderUi();

  const modulesReady =
    window.RMLBaseModNodesReady ||
    window.RMLModNodesReady;

  if (
    !modulesReady ||
    typeof modulesReady.then !==
      "function"
  ) {
    throw new Error(
      "The Runtime Graph module loader is unavailable. The JSON was not loaded."
    );
  }

  await promiseWithBuilderTimeout(
    modulesReady,
    60000,
    "The Runtime Graph modules did not become ready within 60 seconds. The JSON was not loaded."
  );

  const legacyMigration =
    window.RMLDynamicGraphHost
      ?.migrateLegacyOperatorsForImport?.(
        graph
      );

  if (
    Number(
      legacyMigration
        ?.migratedNodeCount || 0
    ) > 0
  ) {
    updateBuilderWork(
      workSession,
      {
        title:
          "Upgraded known legacy node contracts…",
        message:
          `${Number(legacyMigration.migratedNodeCount).toLocaleString("de-DE")} node${Number(legacyMigration.migratedNodeCount) === 1 ? " was" : "s were"} mapped to their exact current catalog definitions before missing-node discovery.`,
        detail:
          "Only operator contracts, parameters and necessary port IDs were migrated; node placement and complete wire routing geometry remained unchanged.",
        progress: 40
      }
    );
    await paintBuilderUi();
  }

  requiredCatalogNodes =
    projectRequiredCatalogNodes(
      project
    );

  if (requiredCatalogNodes.length > 0) {
    updateBuilderWork(
      workSession,
      {
        title:
          "Checking the scanner's source fingerprint…",
        message:
          `This project uses ${requiredCatalogNodes.length.toLocaleString("de-DE")} catalog operator${requiredCatalogNodes.length === 1 ? "" : "s"}. The scanner fingerprint is being compared with the cache before any replacement is selected; scanner v1.7 uses the authoritative semantic contract, while older scanners remain available in compatibility mode.`,
        detail:
          "A matching source fingerprint reuses the Live-confirmed cache without downloading or rebuilding the catalog. A changed fingerprint downloads, verifies and replaces the cache exactly once.",
        progress: 44
      }
    );
    await paintBuilderUi();

    const gate =
      window.RMLCatalogImportGate;

    if (
      !gate ||
      typeof gate.ensureForImport !==
        "function"
    ) {
      throw new Error(
        "The API catalog import gate is unavailable. The JSON was not loaded."
      );
    } else try {
      catalogResult =
        await gate.ensureForImport({
          requiredNodes:
            requiredCatalogNodes,
          onLiveLookup() {
            updateBuilderWork(
              workSession,
              {
                title:
                  "Comparing source and cached fingerprints…",
                message:
                  "All already known scanner and Builder-bridge health paths are checked concurrently. The first verified Live fingerprint wins.",
                detail:
                  "There is no serial URL wait. Port discovery remains manual, and the health phase never downloads the complete catalog.",
                progress: 48
              }
            );
          },
          onFingerprintMatch(detail) {
            updateBuilderWork(
              workSession,
              {
                title:
                  "Fingerprint matches · reusing catalog…",
                message:
                  String(
                    detail?.message ||
                    "The cached catalog is already current."
                  ),
                detail:
                  "No catalog download or semantic full comparison is performed. An already matching factory is reused; only a not-yet-initialized factory may still finish once.",
                progress: 49
              }
            );
          },
          onCatalogRefresh(detail) {
            updateBuilderWork(
              workSession,
              {
                title:
                  "Catalog fingerprint changed · downloading update…",
                message:
                  String(
                    detail?.message ||
                    "Downloading the changed Live catalog."
                  ),
                detail:
                  "This full transfer occurs only because the source fingerprint is different. There is no automatic time limit; the Builder remains here until the scanner transfer completes or reports an error.",
                progress: 50
              }
            );
          },
          onCatalogCacheWrite(detail) {
            updateBuilderWork(
              workSession,
              {
                title:
                  "Catalog downloaded · updating cache…",
                message:
                  String(
                    detail?.message ||
                    "The verified Live catalog is being persisted as the new cached snapshot."
                  ),
                detail:
                  "The uncached Live payload is never activated. Import continues only after the synchronized cache snapshot has been written successfully.",
                progress: 50.5
              }
            );
          },
          onFactoryActivation(detail) {
            updateBuilderWork(
              workSession,
              {
                title:
                  "Preparing required API node contracts…",
                message:
                  String(
                    detail?.message ||
                    "The API node factory is completing the contracts needed by this import."
                  ),
                detail:
                  "This phase is separate from scanner discovery and cannot trigger additional scanner probes.",
                progress: 51
              }
            );
          },
          onContractResolution(detail) {
            updateBuilderWork(
              workSession,
              {
                title:
                  String(
                    detail?.title ||
                    "Resolving required catalog contracts…"
                  ),
                message:
                  String(
                    detail?.message ||
                    "The required project operators are being matched against the prepared catalog index."
                  ),
                detail:
                  String(
                    detail?.detail ||
                    "Only unresolved operator families are checked; repeated node instances do not repeat this work."
                  ),
                progress:
                  Number(
                    detail?.progress
                  ) || 51.5
              }
            );
          },
          onCacheFallback() {
            updateBuilderWork(
              workSession,
              {
                title:
                  "Live unavailable · activating cached fallback…",
                message:
                  "No known Live health path returned a usable fingerprint. The last available cached scanner catalog is being activated immediately.",
                detail:
                  "No serial retry or port-range discovery delays this import.",
                progress: 49
              }
            );
          }
        });
    } catch (error) {
      throw new Error(
        `The scanner source-fingerprint comparison and cached fallback failed: ${String(error?.message || error)} The JSON was not loaded.`
      );
    }

    const migrations =
      catalogResult?.migrations &&
      typeof catalogResult.migrations === "object" &&
      !Array.isArray(catalogResult.migrations)
        ? catalogResult.migrations
        : {};
    const portMigrations =
      catalogResult?.portMigrations &&
      typeof catalogResult.portMigrations === "object" &&
      !Array.isArray(catalogResult.portMigrations)
        ? catalogResult.portMigrations
        : {};
    appliedCatalogMigrations = structuredClone(migrations);
    appliedPortMigrations = structuredClone(portMigrations);
    if (
      Object.keys(migrations).length > 0 ||
      Object.keys(portMigrations).length > 0
    ) {
      const replacementTransaction =
        window.RMLDynamicGraphHost
          ?.applyCatalogMigrationsPreservingGeometry;

      if (
        typeof replacementTransaction !==
          "function"
      ) {
        throw new Error(
          "The atomic graph replacement transaction is unavailable. The JSON was not loaded."
        );
      }

      const transaction =
        replacementTransaction(
          graph,
          migrations,
          portMigrations
        );
      transaction.assertGeometry();
      transaction.commit();
    }

    const unresolvedRequirements =
      Array.isArray(
        catalogResult
          ?.unresolvedRequirements
      )
        ? catalogResult
            .unresolvedRequirements
        : [];

    if (unresolvedRequirements.length > 0) {
      if (catalogResult?.available !== true) {
        throw new Error(
          "Neither the Live scanner nor its cached fallback could provide a usable API node factory. The JSON was not loaded."
        );
      }

      const graphHost =
        window.RMLDynamicGraphHost;
      const candidateResolver =
        graphHost
          ?.compatibleImportReplacementCandidates;
      const replacementTransaction =
        graphHost
          ?.applyCatalogMigrationsPreservingGeometry;

      if (
        typeof candidateResolver !==
          "function" ||
        typeof replacementTransaction !==
          "function"
      ) {
        throw new Error(
          "The pre-import API replacement resolver is unavailable. The JSON was not loaded."
        );
      }

      const manualMigrations = {};
      const manualPortMigrations = {};
      const matchingNodesByOperator =
        new Map();
      for (const view of
        projectRuntimeGraphViews(graph)) {
        for (const node of
          Array.isArray(view.graph.nodes)
            ? view.graph.nodes
            : []) {
          if (node?.kind !== "operator") {
            continue;
          }
          const operatorId = String(
            node.operatorId || ""
          );
          if (
            !matchingNodesByOperator.has(
              operatorId
            )
          ) {
            matchingNodesByOperator.set(
              operatorId,
              []
            );
          }
          matchingNodesByOperator
            .get(operatorId)
            .push({
              node,
              path: view.path
            });
        }
      }

      const replacementQueue = [];
      for (
        let index = 0;
        index <
          unresolvedRequirements.length;
        index += 1
      ) {
        const requirement =
          unresolvedRequirements[index];
        const operatorId = String(
          requirement?.operatorId || ""
        );
        updateBuilderWork(
          workSession,
          {
            title:
              "Indexing compatible replacement contracts…",
            message:
              `Checking contract ${(index + 1).toLocaleString("de-DE")} of ${unresolvedRequirements.length.toLocaleString("de-DE")}: ${operatorId}`,
            detail:
              "The definition index is built once for this catalog fingerprint and reused for every repeated node instance.",
            progress:
              52 + Math.round(
                8 * index /
                Math.max(
                  1,
                  unresolvedRequirements.length
                )
              )
          }
        );
        await paintBuilderUi();
        let resolution = null;
        let resolutionError = null;
        try {
          resolution =
            candidateResolver(
              requirement
            );
        } catch (error) {
          resolutionError = error;
        }
        const candidates =
          Array.isArray(
            resolution?.candidates
          )
            ? resolution.candidates
            : [];
        const matchingNodes =
          matchingNodesByOperator.get(
            operatorId
          ) || [];
        replacementQueue.push({
          requirement,
          operatorId,
          candidates,
          resolution,
          resolutionError,
          instanceCount:
            matchingNodes.length,
          nodeLabels:
            matchingNodes.map(item =>
              `${item.node.label || item.node.id || operatorId} (${item.path})`
            ),
          status:
            candidates.length > 0
              ? "pending"
              : "unavailable"
        });
      }

      const unresolvedWithoutCandidates =
        replacementQueue.filter(entry =>
          entry.candidates.length === 0
        );
      if (
        unresolvedWithoutCandidates.length > 0
      ) {
        const details =
          unresolvedWithoutCandidates
            .map(entry => {
              const reason = String(
                entry.resolutionError
                  ?.message || ""
              ).trim();
              return `'${entry.operatorId}' (${Math.max(1, entry.instanceCount).toLocaleString("de-DE")} node${entry.instanceCount === 1 ? "" : "s"})${reason ? `: ${reason}` : ""}`;
            });
        throw irreparableProjectJsonError(
          `${unresolvedWithoutCandidates.length.toLocaleString("de-DE")} of ${replacementQueue.length.toLocaleString("de-DE")} missing operator families have no semantically proven replacement with a complete port contract. No replacement dialog was opened.`,
          details
        );
      }

      let selectedPlanDiagnostics = [];
      let selectedPlanAccepted = false;

      while (!selectedPlanAccepted) {
        for (
          let index = 0;
          index < replacementQueue.length;
          index += 1
        ) {
          const entry =
            replacementQueue[index];
          const {
            requirement,
            operatorId,
            candidates,
            nodeLabels
          } = entry;

          entry.status = "current";
          const selected =
            await requestBuilderReplacementChoice(
              workSession,
              {
                requirement,
                candidates,
                index,
                total:
                  replacementQueue.length,
                catalogResult,
                nodeLabels,
                replacementQueue,
                initialOperatorId:
                  entry.selectedOperatorId ||
                  "",
                validationDiagnostics:
                  selectedPlanDiagnostics
              }
            );

          manualMigrations[operatorId] =
            selected.operatorId;
          manualPortMigrations[operatorId] = {
            input:
              structuredClone(
                selected.inputMap || {}
              ),
            output:
              structuredClone(
                selected.outputMap || {}
              )
          };
          entry.status = "selected";
          entry.selectedOperatorId =
            selected.operatorId;
        }

        const transaction =
          replacementTransaction(
            graph,
            manualMigrations,
            manualPortMigrations
          );
        let geometryVerified = false;
        try {
          transaction.assertGeometry();
          geometryVerified = true;
          selectedPlanDiagnostics =
            validateRuntimeGraphViewsFast(
              graph
            );
          if (
            selectedPlanDiagnostics.length ===
              0
          ) {
            transaction.commit();
            selectedPlanAccepted = true;
          }
        } finally {
          if (!selectedPlanAccepted) {
            transaction.rollback();
          }
        }

        if (
          geometryVerified &&
          !selectedPlanAccepted
        ) {
          updateBuilderWork(
            workSession,
            {
              title:
                "Selected replacements need revision…",
              message:
                "The explicitly selected nodes do not form a type-safe complete Runtime Graph. Review the choices; nothing has been imported or changed automatically.",
              detail:
                `${selectedPlanDiagnostics.slice(0, 3).join(" | ")}${selectedPlanDiagnostics.length > 3 ? ` | and ${selectedPlanDiagnostics.length - 3} more` : ""}`,
              progress: 61
            }
          );
          await paintBuilderUi();
        }
      }

      Object.assign(
        appliedCatalogMigrations,
        manualMigrations
      );
      Object.assign(
        appliedPortMigrations,
        manualPortMigrations
      );
      catalogResult = Object.freeze({
        ...catalogResult,
        verified: true,
        unresolved: 0,
        unresolvedRequirements:
          Object.freeze([]),
        userConfirmedReplacements:
          unresolvedRequirements.length,
        migrations:
          Object.freeze(
            structuredClone(
              appliedCatalogMigrations
            )
          ),
        portMigrations:
          Object.freeze(
            structuredClone(
              appliedPortMigrations
            )
          )
      });
    }
  }

  }

  if (catalogOnly) {
    return {
      graph,
      catalog: catalogResult,
      runtimeActive:
        graph.active === true,
      compatibilityMode: false,
      unresolvedNodeCount: 0,
      requiredCatalogNodes,
      appliedCatalogMigrations,
      appliedPortMigrations,
      structuralRepairability,
      catalogOnly: true
    };
  }

  if (
    !window.RMLDynamicGraphHost ||
    !window.RMLTypedNodeGraphGenerator ||
    typeof window
      .RMLTypedNodeGraphGenerator
      .build !== "function"
  ) {
    throw new Error(
      "The Runtime Graph host or C# generator is not fully initialized. The JSON was not loaded."
    );
  }

  const definitions =
    window.RMLModNodeRegistry
      ?.getNodeDefinitions?.() || {};
  const graphNodes =
    projectRuntimeGraphViews(graph)
      .flatMap(view =>
        (Array.isArray(view.graph.nodes)
          ? view.graph.nodes
          : [])
          .map(node => ({
            node,
            path: view.path
          }))
      );
  const unavailable =
    graphNodes
      .filter(item =>
        item.node?.kind === "operator" &&
        !definitions[
          item.node.operatorId
        ]
      )
      .map(item => ({
        nodeId:
          String(item.node.id || "<unnamed>"),
        operatorId:
          String(
            item.node.operatorId ||
            "<missing>"
          ),
        path: item.path
      }));

  const unresolvedApiNodes =
    graphNodes
      .filter(item =>
        definitions[item.node?.operatorId]
          ?.unavailableApiContract ===
            true
      )
      .map(item => ({
        nodeId:
          String(item.node.id || ""),
        operatorId:
          String(
            item.node.operatorId || ""
          ),
        stableContractId:
          String(
            item.node.apiContract
              ?.stableContractId || ""
          ),
        path: item.path
      }));

  if (
    unavailable.length > 0 ||
    unresolvedApiNodes.length > 0
  ) {
    const visible = [
      ...unavailable.map(item =>
        `'${item.operatorId}' on '${item.nodeId}' (${item.path})`
      ),
      ...unresolvedApiNodes.map(item =>
        `'${item.operatorId}' on '${item.nodeId}' (${item.path})`
      )
    ].slice(0, 12);
    const total =
      unavailable.length +
      unresolvedApiNodes.length;

    throw new Error(
      `The project still contains ${total.toLocaleString("de-DE")} unavailable operator${total === 1 ? "" : "s"} after the pre-import replacement phase: ${visible.join(", ")}${total > visible.length ? ` and ${(total - visible.length).toLocaleString("de-DE")} more` : ""}. The JSON was not loaded.`
    );
  }

  const compatibilityEntry = {
    schemaVersion: 1,
    catalogFingerprint: String(
      window.RMLResoniteApiCatalog
        ?.catalogFingerprint || ""
    ),
    engineVersion: String(
      window.RMLResoniteApiCatalog
        ?.engineVersion || ""
    ),
    catalogRevision: String(
      window.RMLResoniteApiCatalog?.contractRevision ||
      window.RMLResoniteApiCatalog?.catalogFingerprint ||
      "unavailable"
    ),
    operatorMigrations: appliedCatalogMigrations,
    portMigrations: appliedPortMigrations,
    unresolvedApiNodes,
    status:
      Object.keys(
        appliedCatalogMigrations
      ).length > 0
        ? "migrated"
        : "verified"
  };
  const compatibility = graph.apiCompatibility && typeof graph.apiCompatibility === "object"
    ? graph.apiCompatibility
    : { schemaVersion: 1, history: [] };
  const history = Array.isArray(compatibility.history) ? compatibility.history : [];
  const entryKey = JSON.stringify(compatibilityEntry);
  if (!history.some(entry => JSON.stringify(entry) === entryKey)) history.push(compatibilityEntry);
  graph.apiCompatibility = {
    schemaVersion: 1,
    history: history.slice(-32)
  };
  const integratedNodeCompatibility =
    window.RMLModNodeRegistry
      ?.getIntegratedNodeContract?.();
  if (integratedNodeCompatibility) {
    graph.integratedNodeCompatibility =
      structuredClone(
        integratedNodeCompatibility
      );
  }

  const graphValidation =
    window.RMLTypedNodeGraphGenerator
      .validateDocument?.({
        state: project
      });
  const graphValidationDiagnostics =
    Array.isArray(
      graphValidation?.diagnostics
    )
      ? graphValidation.diagnostics
          .filter(Boolean)
      : [];

  if (
    graphValidationDiagnostics.length > 0
  ) {
    throw new Error(
      `Runtime Graph validation failed: ${graphValidationDiagnostics.slice(0, 8).join(" | ")}${graphValidationDiagnostics.length > 8 ? ` | and ${graphValidationDiagnostics.length - 8} more` : ""}. The JSON was not loaded.`
    );
  }
  return {
    graph,
    catalog: catalogResult,
    runtimeActive:
      graph.active === true,
    compatibilityMode: false,
    unresolvedNodeCount: 0
  };
}

async function resolveSavedApiCompositeGraph(
  graphDocument,
  {
    name = "Saved API Composite",
    context = "saved-composite"
  } = {}
) {
  const openGraph =
    context === "open-runtime-graph";
  if (
    !graphDocument ||
    typeof graphDocument !== "object" ||
    Array.isArray(graphDocument) ||
    !Array.isArray(graphDocument.nodes) ||
    !Array.isArray(
      graphDocument.connections
    )
  ) {
    throw new TypeError(
      "Saved API Composite catalog resolution requires a complete graph document."
    );
  }
  const project = {
    extensions: {
      typedNodeGraph:
        structuredClone(graphDocument)
    }
  };
  const workSession = beginBuilderWork({
    kicker:
      openGraph
        ? "Runtime Graph compatibility"
        : "Saved API Composite compatibility",
    title:
      "Checking the current catalog contracts…",
    message:
      `Preparing '${String(name || "Saved API Composite")}' without changing the open project.`,
    detail:
      "The source fingerprint and cached catalog are checked first. Missing operator identities use this same explicit replacement dialog for project import, open graphs and Saved API Composites.",
    progress: 32,
    timeout: 120000
  });
  try {
    const result =
      await ensureProjectRuntimePrerequisites(
        project,
        workSession,
        { catalogOnly: true }
      );
    updateBuilderWork(
      workSession,
      {
        kicker:
          openGraph
            ? "Runtime Graph replacements ready"
            : "Saved API Composite ready",
        title:
          "Catalog contracts verified…",
        message:
          "Every internal API node and exposed boundary port is compatible with the current catalog.",
        detail:
          openGraph
            ? "The open Runtime Graph has not been changed yet. The resolved copy now awaits the graph-level atomic confirmation."
            : "The open Runtime Graph has not been changed yet. The caller can now create an atomic instance with fresh identities.",
        progress: 100
      }
    );
    await paintBuilderUi();
    finishBuilderWork(workSession);
    return structuredClone(
      result.graph ||
      project.extensions.typedNodeGraph
    );
  } catch (error) {
    finishBuilderWork(workSession);
    const message = String(
      error instanceof Error
        ? error.message
        : error
    )
      .replaceAll(
        "The JSON was not loaded.",
        openGraph
          ? "The open Runtime Graph was preserved unchanged."
          : "The Saved API Composite was not changed or inserted."
      )
      .replaceAll(
        "project JSON",
        openGraph
          ? "open Runtime Graph"
          : "Saved API Composite JSON"
      );
    const resolvedError =
      new Error(message);
    resolvedError.code =
      error?.code ||
      "RML_SAVED_API_COMPOSITE_RESOLUTION_FAILED";
    resolvedError.cancelSource =
      error?.cancelSource;
    throw resolvedError;
  }
}

Object.defineProperty(
  window,
  "RMLSavedApiCompositeResolver",
  {
    value: Object.freeze({
      version: 1,
      resolveGraph:
        resolveSavedApiCompositeGraph
    }),
    writable: false,
    enumerable: true,
    configurable: true
  }
);

function assertImportedGraphDocumentIdentity(
  expectedGraph
) {
  const actualGraph =
    projectTypedRuntimeGraph(state);
  assertRuntimeGraphViewsIdentity(
    expectedGraph,
    actualGraph,
    "The imported Runtime Graph document was not preserved exactly"
  );
}

function assertRuntimeGraphViewsIdentity(
  expectedGraph,
  actualGraph,
  message
) {
  const expectedViews =
    projectRuntimeGraphViews(
      expectedGraph
    );
  const exactCompositeGeometry =
    expectedViews.some(view =>
      view.path.includes(
        "/api-composite:"
      )
    );
  const actualViewsByPath = new Map(
    projectRuntimeGraphViews(
      actualGraph
    ).map(view => [
      view.path,
      view.graph
    ])
  );
  const failures = [];

  for (const expectedView of
    expectedViews) {
    const actualView =
      actualViewsByPath.get(
        expectedView.path
      );
    if (!actualView) {
      failures.push(
        `${expectedView.path}: graph missing`
      );
      continue;
    }

    const expectedNodes =
      expectedView.graph.nodes;
    const expectedConnections =
      expectedView.graph.connections;
    const actualNodes =
      actualView.nodes;
    const actualConnections =
      actualView.connections;
    const actualNodeIds = new Set(
      actualNodes.map(node =>
        String(node?.id || "")
      )
    );
    const actualConnectionIds = new Set(
      actualConnections.map(connection =>
        String(connection?.id || "")
      )
    );
    const missingNodeIds =
      expectedNodes
        .map(node =>
          String(node?.id || "")
        )
        .filter(id =>
          !actualNodeIds.has(id)
        );
    const missingConnectionIds =
      expectedConnections
        .map(connection =>
          String(
            connection?.id || ""
          )
        )
        .filter(id =>
          !actualConnectionIds.has(id)
        );

    if (
      actualNodes.length !==
        expectedNodes.length ||
      actualConnections.length !==
        expectedConnections.length ||
      missingNodeIds.length > 0 ||
      missingConnectionIds.length > 0
    ) {
      failures.push(
        `${expectedView.path}: expected ${expectedNodes.length.toLocaleString("de-DE")}/${expectedConnections.length.toLocaleString("de-DE")}, stored ${actualNodes.length.toLocaleString("de-DE")}/${actualConnections.length.toLocaleString("de-DE")}; missing nodes ${missingNodeIds.slice(0, 6).join(", ") || "none"}; missing connections ${missingConnectionIds.slice(0, 6).join(", ") || "none"}`
      );
    }
    if (exactCompositeGeometry) {
      const geometrySignature = value =>
        JSON.stringify({
          nodes: [...value.nodes]
            .map(node => ({
              id: String(node?.id || ""),
              x: Number(node?.x),
              y: Number(node?.y),
              width:
                node?.width == null
                  ? null
                  : Number(node.width),
              height:
                node?.height == null
                  ? null
                  : Number(node.height)
            }))
            .sort((left, right) =>
              left.id.localeCompare(
                right.id
              )
            ),
          connections: [
            ...value.connections
          ]
            .map(connection => ({
              id: String(
                connection?.id || ""
              ),
              fromNode: String(
                connection?.fromNode ||
                ""
              ),
              fromPort: String(
                connection?.fromPort ||
                ""
              ),
              toNode: String(
                connection?.toNode || ""
              ),
              toPort: String(
                connection?.toPort || ""
              ),
              points:
                connection?.points || [],
              branchFrom:
                connection?.branchFrom ||
                null
            }))
            .sort((left, right) =>
              left.id.localeCompare(
                right.id
              )
            ),
          boundaryPorts:
            value.boundaryPorts || [],
          branchRouting:
            value.branchRouting || {}
        });
      if (
        geometrySignature(
          expectedView.graph
        ) !==
        geometrySignature(actualView)
      ) {
        failures.push(
          `${expectedView.path}: API Composite node placement, proxy mapping or stored wire routing changed`
        );
      }
    }
    actualViewsByPath.delete(
      expectedView.path
    );
  }

  for (const path of
    actualViewsByPath.keys()) {
    failures.push(
      `${path}: unexpected graph`
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `${message}: ${failures.slice(0, 8).join("; ")}. The JSON was not loaded.`
    );
  }
}

function assertImportedGraphIdentity(
  expectedGraph,
  expectedProjectEpoch =
    projectApplicationEpoch
) {
  const host =
    window.RMLDynamicGraphHost;
  const actualGraph =
    host?.getRootState?.() ||
    host?.getState?.();
  const expectedNodes =
    Array.isArray(expectedGraph?.nodes)
      ? expectedGraph.nodes
      : [];
  const expectedConnections =
    Array.isArray(
      expectedGraph?.connections
    )
      ? expectedGraph.connections
      : [];
  const actualNodes =
    Array.isArray(actualGraph?.nodes)
      ? actualGraph.nodes
      : [];
  const actualConnections =
    Array.isArray(
      actualGraph?.connections
    )
      ? actualGraph.connections
      : [];
  const actualProjectEpoch =
    Number(
      host?.getProjectEpoch?.()
    ) || 0;

  if (
    Number(expectedProjectEpoch) > 0 &&
    actualProjectEpoch !==
      Number(expectedProjectEpoch)
  ) {
    throw new Error(
      `The Runtime Graph belongs to stale project epoch ${actualProjectEpoch}; epoch ${Number(expectedProjectEpoch)} is required. The JSON was not loaded.`
    );
  }

  if (
    actualNodes.length !==
      expectedNodes.length ||
    actualConnections.length !==
      expectedConnections.length
  ) {
    throw new Error(
      `The Runtime Graph did not preserve the imported project exactly: expected ${expectedNodes.length.toLocaleString("de-DE")} nodes and ${expectedConnections.length.toLocaleString("de-DE")} connections, but initialized ${actualNodes.length.toLocaleString("de-DE")} and ${actualConnections.length.toLocaleString("de-DE")}. The JSON was not loaded.`
    );
  }

  const actualNodeIds =
    new Set(
      actualNodes.map(node =>
        String(node?.id || "")
      )
    );
  const actualConnectionIds =
    new Set(
      actualConnections.map(
        connection =>
          String(
            connection?.id || ""
          )
      )
    );
  const missingNodeIds =
    expectedNodes
      .map(node =>
        String(node?.id || "")
      )
      .filter(id =>
        !actualNodeIds.has(id)
      );
  const missingConnectionIds =
    expectedConnections
      .map(connection =>
        String(connection?.id || "")
      )
      .filter(id =>
        !actualConnectionIds.has(id)
      );

  if (
    missingNodeIds.length > 0 ||
    missingConnectionIds.length > 0
  ) {
    throw new Error(
      `The Runtime Graph changed imported identities during initialization. Missing nodes: ${missingNodeIds.slice(0, 8).join(", ") || "none"}; missing connections: ${missingConnectionIds.slice(0, 8).join(", ") || "none"}. The JSON was not loaded.`
    );
  }

  assertRuntimeGraphViewsIdentity(
    expectedGraph,
    actualGraph,
    "The Runtime Graph changed an embedded Custom C# graph during initialization"
  );
}

function waitForGraphCodegenSettlement(
  expectedProjectEpoch =
    projectApplicationEpoch
) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = (
      callback,
      value
    ) => {
      if (settled) return;
      settled = true;
      document.removeEventListener(
        "rml-builder:graph-codegen-settled",
        handleSettled
      );
      document.removeEventListener(
        "rml-builder:project-replacement",
        handleReplacement
      );
      callback(value);
    };
    const handleSettled = event => {
      const detail =
        event.detail || {};
      if (
        Number(expectedProjectEpoch) > 0 &&
        Number(detail.projectEpoch) !==
          Number(expectedProjectEpoch)
      ) {
        return;
      }
      finish(resolve, detail);
    };
    const handleReplacement = event => {
      if (
        Number(expectedProjectEpoch) > 0 &&
        Number(
          event?.detail?.projectEpoch
        ) === Number(expectedProjectEpoch)
      ) {
        return;
      }
      finish(
        reject,
        new Error(
          "The project changed while Runtime Graph code generation was running."
        )
      );
    };

    document.addEventListener(
      "rml-builder:graph-codegen-settled",
      handleSettled
    );
    document.addEventListener(
      "rml-builder:project-replacement",
      handleReplacement
    );
  });
}

async function waitForImportedCodegen(
  expectedGraph,
  workSession,
  _catalogResult = null,
  projectEpoch =
    projectApplicationEpoch
) {
  let contribution = null;
  const graphViews =
    projectRuntimeGraphViews(
      expectedGraph
    );
  const expectedNodeCount =
    graphViews.reduce(
      (total, view) =>
        total +
        (view.graph.nodes?.length || 0),
      0
    );
  const expectedConnectionCount =
    graphViews.reduce(
      (total, view) =>
        total +
        (view.graph.connections?.length ||
          0),
      0
    );

  while (true) {
    contribution =
      getTypedNodeGraphContribution();

    if (
      contribution?.pending !== true
    ) {
      break;
    }

    updateBuilderWork(
      workSession,
      {
        title:
          "Generating the complete Runtime Graph…",
        message:
          "The background generator is building and validating every generated project file.",
        detail:
          `${expectedNodeCount.toLocaleString("de-DE")} nodes · ${expectedConnectionCount.toLocaleString("de-DE")} connections including embedded graphs`,
        progress: 90
      }
    );

    await waitForGraphCodegenSettlement(
      projectEpoch
    );
  }

  const graphDiagnostics =
    Array.isArray(
      contribution?.diagnostics
    )
      ? contribution.diagnostics
          .filter(Boolean)
      : [];

  if (graphDiagnostics.length > 0) {
    throw new Error(
      `Runtime Graph validation failed: ${graphDiagnostics.slice(0, 8).join(" | ")}${graphDiagnostics.length > 8 ? ` | and ${graphDiagnostics.length - 8} more` : ""}. The JSON was not loaded.`
    );
  }

  const diagnostics =
    getDiagnostics();

  if (diagnostics.length > 0) {
    throw new Error(
      `Project validation failed: ${diagnostics.slice(0, 8).join(" | ")}${diagnostics.length > 8 ? ` | and ${diagnostics.length - 8} more` : ""}. The JSON was not loaded.`
    );
  }

  const packedGraph = Boolean(
    expectedGraph?.configSnapshot &&
    Array.isArray(
      expectedGraph.configSnapshot.nodes
    )
  );

  if (
    packedGraph &&
    getAdditionalGeneratedSourceFiles()
      .length === 0
  ) {
    throw new Error(
      "The Runtime Graph completed without producing its required generated source files. The JSON was not loaded."
    );
  }

  return contribution;
}

function waitForImportedGraphUi(
  expectedNodes,
  expectedConnections,
  timeout = 30000,
  {
    strict = false,
    projectEpoch =
      projectApplicationEpoch
  } = {}
) {
  const graph =
    state.extensions?.typedNodeGraph;

  if (
    graph?.active !== true ||
    !window.RMLDynamicGraphHost
  ) {
    if (strict && graph?.active === true) {
      return Promise.reject(
        new Error(
          "The Runtime Graph host is unavailable. The JSON was not loaded."
        )
      );
    }

    return Promise.resolve({
      ready: true,
      timedOut: false
    });
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = 0;
    const expectedProjectEpoch =
      Number(projectEpoch) || 0;

    const finish = (
      timedOut,
      error = null
    ) => {
      if (settled) return;
      settled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
      document.removeEventListener(
        "rml-graph:render-complete",
        handleComplete
      );
      document.removeEventListener(
        "rml-builder:rendered",
        handleBuilderRendered
      );
      document.removeEventListener(
        "rml-builder:project-replacement",
        handleReplacement
      );
      if (error) {
        reject(error);
        return;
      }

      resolve({
        ready: !timedOut,
        timedOut
      });
    };

    const hostStateMatches = () => {
      const host =
        window.RMLDynamicGraphHost;
      const hostGraph =
        host?.getRootState?.() ||
        host?.getState?.();
      const nodeCount =
        Array.isArray(hostGraph?.nodes)
          ? hostGraph.nodes.length
          : -1;
      const connectionCount =
        Array.isArray(
          hostGraph?.connections
        )
          ? hostGraph.connections.length
          : -1;
      const hostProjectEpoch =
        Number(
          host?.getProjectEpoch?.()
        ) || 0;

      return {
        matches:
          nodeCount ===
            Number(expectedNodes) &&
          connectionCount ===
            Number(expectedConnections) &&
          (
            expectedProjectEpoch <= 0 ||
            hostProjectEpoch ===
              expectedProjectEpoch
          ),
        nodeCount,
        connectionCount,
        hostProjectEpoch,
        graphViewActive:
          host
            ?.getPresentationState?.()
            ?.graphViewActive === true ||
          document.body.classList.contains(
            "rml-node-graph-mode"
          )
      };
    };

    const handleBuilderRendered = event => {
      const renderedProjectEpoch =
        Number(
          event?.detail
            ?.projectEpoch
        ) || 0;
      if (
        expectedProjectEpoch > 0 &&
        renderedProjectEpoch !==
          expectedProjectEpoch
      ) {
        return;
      }
      const current =
        hostStateMatches();

      if (
        current.matches &&
        !current.graphViewActive
      ) {
        
        
        
        finish(false);
      } else if (
        strict &&
        !current.matches
      ) {
        finish(
          false,
          new Error(
            `The Runtime Graph initialized a different project state: expected ${Number(expectedNodes).toLocaleString("de-DE")} nodes and ${Number(expectedConnections).toLocaleString("de-DE")} connections for project epoch ${expectedProjectEpoch}, but received ${Number(current.nodeCount).toLocaleString("de-DE")} and ${Number(current.connectionCount).toLocaleString("de-DE")} for epoch ${Number(current.hostProjectEpoch) || 0}. The JSON was not loaded.`
          )
        );
      }
    };

    const handleComplete = event => {
      const detail = event.detail || {};
      const renderedProjectEpoch =
        Number(
          detail.projectEpoch
        ) || 0;
      if (
        expectedProjectEpoch > 0 &&
        renderedProjectEpoch !==
          expectedProjectEpoch
      ) {
        return;
      }
      const current = hostStateMatches();
      if (current.matches) {
        finish(false);
      }
    };
    const handleReplacement = event => {
      const replacementProjectEpoch =
        Number(
          event?.detail
            ?.projectEpoch
        ) || 0;
      if (
        expectedProjectEpoch > 0 &&
        replacementProjectEpoch ===
          expectedProjectEpoch
      ) {
        return;
      }
      return strict
        ? finish(
            false,
            new Error(
              "The project changed while the Runtime Graph was initializing."
            )
          )
        : finish(false);
    };

    if (
      Number.isFinite(Number(timeout)) &&
      Number(timeout) > 0
    ) {
      timer = window.setTimeout(
        () =>
          strict
            ? finish(
                true,
                new Error(
                  `The Runtime Graph did not finish rendering within ${Math.round(Number(timeout) / 1000)} seconds. The JSON was not loaded.`
                )
              )
            : finish(true),
        Number(timeout)
      );
    }

    document.addEventListener(
      "rml-graph:render-complete",
      handleComplete
    );
    document.addEventListener(
      "rml-builder:rendered",
      handleBuilderRendered
    );
    document.addEventListener(
      "rml-builder:project-replacement",
      handleReplacement
    );

  });
}

async function applyLoadedProjectWithFeedback(
  project,
  {
    displayName = "project",
    workSession = 0,
    prevalidatedPrerequisites = null
  } = {}
) {
  const session =
    workSession ||
    beginBuilderWork({
      kicker: "Project loading",
      title: "Validating project requirements…",
      message:
        "The current project remains unchanged until every required subsystem has passed its readiness check.",
      detail:
        "JSON structure, available catalog contracts and Runtime Graph modules are checked first.",
      progress: 32,
      timeout: 120000
    });
  let previousProject = null;
  let projectApplied = false;

  try {
    updateBuilderWork(
      session,
      {
        kicker: "Project loading",
        title:
          "Validating project requirements…",
        message:
          "The current project remains unchanged until every required subsystem has passed its readiness check.",
        detail:
          "JSON structure, available catalog contracts and Runtime Graph modules are checked first.",
        progress: 32
      }
    );
    await paintBuilderUi();

    const prerequisites =
      await ensureProjectRuntimePrerequisites(
        project,
        session,
        prevalidatedPrerequisites
          ? {
              catalogPreflight:
                prevalidatedPrerequisites
            }
          : {}
      );

    updateBuilderWork(
      session,
      {
        title:
          "Installing the validated project…",
        message:
          "All required modules and catalog contracts are available. The project can now be installed atomically.",
        detail:
          "If any later Runtime Graph or generator check fails, the previous project is restored automatically.",
        progress: 55
      }
    );
    await paintBuilderUi();

    previousProject =
      createProjectDocument(
        false,
        true
      );

    const importedProjectEpoch =
      applyLoadedProject(
        project,
        { render: false }
      );
    projectApplied = true;

    if (prerequisites.graph) {
      assertImportedGraphDocumentIdentity(
        prerequisites.graph
      );
    }

    updateBuilderWork(
      session,
      {
        title: "Preparing the interface…",
        message:
          "Metadata and the universal node palette are being synchronized.",
        detail:
          "The full Runtime Graph remains intact in the project.",
        progress: 64
      }
    );
    renderMetadata();
    renderPalette();

    await paintBuilderUi();

    const typedGraph =
      project.extensions?.typedNodeGraph;
    const expectedNodes =
      Array.isArray(typedGraph?.nodes)
        ? typedGraph.nodes.length
        : 0;
    const expectedConnections =
      Array.isArray(typedGraph?.connections)
        ? typedGraph.connections.length
        : 0;
    const graphUiReady =
      waitForImportedGraphUi(
        expectedNodes,
        expectedConnections,
        null,
        {
          strict: true,
          projectEpoch:
            importedProjectEpoch
        }
      );

    updateBuilderWork(
      session,
      {
        title: "Preparing the Runtime Graph…",
        message:
          expectedNodes > 1000 ||
          expectedConnections > 2000
            ? `Validating ${expectedNodes.toLocaleString()} nodes and ${expectedConnections.toLocaleString()} connections, then materializing only the visible graph area when the Runtime Graph page is open.`
            : "Validating graph types and connections, initializing the complete graph model and rendering it only when its page is visible.",
        detail:
          "Large generated C# output runs in the background worker, but the import remains open until it finishes.",
        progress: 78
      }
    );

    renderAll();

    const graphResult =
      await graphUiReady;

    if (prerequisites.graph) {
      assertImportedGraphDocumentIdentity(
        prerequisites.graph
      );
    }

    if (
      prerequisites.graph &&
      prerequisites.runtimeActive
    ) {
      assertImportedGraphIdentity(
        prerequisites.graph,
        importedProjectEpoch
      );
    }

    updateBuilderWork(
      session,
      {
        title:
          prerequisites.compatibilityMode
            ? "Preserving unresolved graph paths…"
            : "Validating generated output…",
        message:
          prerequisites.compatibilityMode
            ? `${Number(prerequisites.unresolvedNodeCount || 0).toLocaleString("de-DE")} unresolved node${Number(prerequisites.unresolvedNodeCount || 0) === 1 ? " remains" : "s remain"} visible and editable. Their affected execution paths are disabled until a compatible replacement is selected.`
            : "The import remains locked until the complete Runtime Graph contribution and every generated source check have finished.",
        detail:
          prerequisites.compatibilityMode
            ? "The project opens without waiting for code generation that cannot succeed while an Unavailable API node is present."
            : "No background generator work is left behind after a successful import.",
        progress: 88
      }
    );

    if (
      prerequisites.graph &&
      prerequisites.runtimeActive &&
      !prerequisites.compatibilityMode
    ) {
      await waitForImportedCodegen(
        prerequisites.graph,
        session,
        prerequisites.catalog,
        importedProjectEpoch
      );
    } else if (
      !prerequisites.compatibilityMode
    ) {
      const diagnostics =
        getDiagnostics();

      if (diagnostics.length > 0) {
        throw new Error(
          `Project validation failed: ${diagnostics.slice(0, 8).join(" | ")}${diagnostics.length > 8 ? ` | and ${diagnostics.length - 8} more` : ""}. The JSON was not loaded.`
        );
      }
    }

    updateGeneratedOutput();

    await commitSuccessfulProjectStorage(
      previousProject?.projectId,
      `loaded:${displayName}`
    );

    updateBuilderWork(
      session,
      {
        title: "Project ready",
        message:
          `Loaded ${displayName} successfully.`,
        detail:
          prerequisites.compatibilityMode
            ? `${Number(prerequisites.unresolvedNodeCount || 0).toLocaleString("de-DE")} unavailable node${Number(prerequisites.unresolvedNodeCount || 0) === 1 ? " was" : "s were"} preserved with all stored ports and connections. Search for a verified compatible replacement in each node's inspector. Export remains blocked only for affected execution paths.`
            : prerequisites.catalog
            ?.cacheSatisfied === true
            ? "No known Live health path could be confirmed, so the cached fallback resolved the required contracts and confirmed replacements. The complete Runtime Graph model and generated sources are ready without opening its page."
            : prerequisites.graph
              ? "Catalog contracts, the complete Runtime Graph model, generated sources, dialogs and controls are all ready without requiring a page switch."
              : "Project data, dialogs and controls are all ready.",
        progress: 100
      }
    );
    await paintBuilderUi();
    return graphResult;
  } catch (error) {
    if (projectApplied) {
      updateBuilderWork(
        session,
        {
          title:
            "Import failed · restoring the previous project…",
          message:
            error instanceof Error
              ? error.message
              : String(error),
          detail:
            "The incomplete imported state is being discarded.",
          progress: 96
        }
      );

      try {
        const rollbackProjectEpoch =
          applyLoadedProject(
            previousProject,
            {
              render: false,
              reason:
                "failed-import-rollback",
              useJsonPageAssociation:
                false
            }
          );
        renderMetadata();
        renderPalette();
        await paintBuilderUi();
        const previousGraph =
          projectTypedRuntimeGraph(
            previousProject
          );
        const rollbackGraphReady =
          previousGraph?.active
            ? waitForImportedGraphUi(
                previousGraph.nodes
                  ?.length || 0,
                previousGraph
                  .connections?.length || 0,
                null,
                {
                  strict: true,
                  projectEpoch:
                    rollbackProjectEpoch
                }
              )
            : Promise.resolve({
                ready: true,
                timedOut: false
              });
        renderAll();
        await rollbackGraphReady;
        if (previousGraph?.active) {
          assertImportedGraphIdentity(
            previousGraph,
            rollbackProjectEpoch
          );
        }
        await paintBuilderUi();
      } catch (restoreError) {
        console.error(
          "The previous project could not be restored after a failed import.",
          restoreError
        );
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} The automatic rollback also failed: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`
        );
      }

      throw new Error(
        `${error instanceof Error ? error.message : String(error)} The previous project was restored unchanged.`
      );
    }

    throw error;
  } finally {
    finishBuilderWork(session);
  }
}

function openProjectDialog() {
  setProjectFileStatus("");

  if (
    typeof elements.projectDialog.showModal ===
    "function"
  ) {
    elements.projectDialog.showModal();
  } else {
    elements.projectDialog.setAttribute(
      "open",
      ""
    );
  }

  stabilizeDialogFocus(
    elements.projectDialog
  );

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateAdaptiveUtilityDialog(
        elements.projectDialog
      );
    });
  });
}

function closeProjectDialog() {
  elements.projectDialog.classList.remove(
    "mobile-full-modal"
  );

  if (
    typeof elements.projectDialog.close ===
    "function"
  ) {
    elements.projectDialog.close();
  } else {
    elements.projectDialog.removeAttribute(
      "open"
    );
  }
}

let activeBuilderMessageResolver = null;

function normalizedBuilderMessageTone(tone) {
  return ["warning", "danger", "info", "success"].includes(tone)
    ? tone
    : "info";
}

function resolveBuilderMessage(
  accepted,
  closeDialog = true
) {
  const resolve =
    activeBuilderMessageResolver;
  activeBuilderMessageResolver = null;

  if (
    closeDialog &&
    elements.builderMessageDialog?.open
  ) {
    elements.builderMessageDialog.close();
  }

  resolve?.(Boolean(accepted));
}

function showBuilderMessage({
  tone = "info",
  kicker = "Builder message",
  title = "Continue?",
  message = "",
  details = "",
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  showCancel = true
} = {}) {
  const dialog =
    elements.builderMessageDialog;

  if (!dialog) {
    console.warn(
      "Builder message dialog is not available."
    );
    return Promise.resolve(false);
  }

  if (activeBuilderMessageResolver) {
    resolveBuilderMessage(false);
  }

  const normalizedTone =
    normalizedBuilderMessageTone(tone);
  dialog.dataset.tone = normalizedTone;
  elements.builderMessageKicker.textContent =
    kicker;
  elements.builderMessageTitle.textContent =
    title;
  elements.builderMessageCopy.textContent =
    message;
  elements.builderMessageDetails.textContent =
    details;
  elements.builderMessageDetails.hidden =
    !details;
  elements.builderMessageConfirm.textContent =
    confirmLabel;
  elements.builderMessageConfirm.dataset.tone =
    normalizedTone;
  elements.builderMessageCancel.textContent =
    cancelLabel;
  elements.builderMessageCancel.hidden =
    !showCancel;

  const result = new Promise(resolve => {
    activeBuilderMessageResolver =
      resolve;
  });

  if (
    typeof dialog.showModal ===
    "function"
  ) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }

  requestAnimationFrame(() => {
    const focusTarget = showCancel
      ? elements.builderMessageCancel
      : elements.builderMessageConfirm;

    try {
      focusTarget.focus({
        preventScroll: true
      });
    } catch {
      focusTarget.focus();
    }
  });

  return result;
}

function confirmBuilderAction(options) {
  return showBuilderMessage({
    tone: "warning",
    kicker: "Confirm action",
    title: "Continue?",
    message:
      "Confirm this action before the builder changes the current project.",
    ...options,
    showCancel: true
  });
}

function showBuilderNotice(options) {
  return showBuilderMessage({
    tone: "info",
    kicker: "Builder notice",
    title: "Notice",
    confirmLabel: "OK",
    ...options,
    showCancel: false
  });
}

function exposeBuilderDialogBridge() {
  Object.defineProperty(
    window,
    "RMLBuilderDialog",
    {
      value: Object.freeze({
        confirm: options =>
          confirmBuilderAction(options),
        notice: options =>
          showBuilderNotice(options)
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );
}

function builderHasActiveProject() {
  if (state.nodes.length > 0) {
    return true;
  }

  if (
    Object.keys(
      state.extensions || {}
    ).length > 0
  ) {
    return true;
  }

  return Object.keys(
    DEFAULT_METADATA
  ).some(
    key =>
      String(
        state.metadata?.[key] ?? ""
      ) !==
      String(
        DEFAULT_METADATA[key] ?? ""
      )
  );
}

async function saveProjectJson() {
  try {
    setProjectFileStatus(
      "Preparing project JSON…"
    );

    
    
    captureVisibleBuilderPage(
      "save-json",
      true
    );
    recordPageState(
      "json.save-snapshot",
      { page: state.activePage }
    );

    const portableProject =
      createProjectDocument(
        true,
        false,
        {
          includePresentationState:
            false
        }
      );
    const fingerprint =
      projectIdentityFingerprint(
        state.projectId
      );
    rememberJsonPage(
      fingerprint,
      state.activePage,
      "save-json"
    );
    recordPageState(
      "json.save-fingerprint",
      {
        fingerprint,
        page: state.activePage
      }
    );

    const response =
      await projectIoRequest(
        "stringify",
        {
          value: portableProject,
          space: 2
        }
      );
    const projectJson =
      `${response.text}\n`;
    const filename =
      `${projectFileBaseName()}` +
      ".json";

    downloadBlob(
      new Blob(
        [projectJson],
        {
          type:
            "application/json;charset=utf-8"
        }
      ),
      filename
    );

    setProjectFileStatus(
      `Saved ${filename}.`,
      "success"
    );
  } catch (error) {
    setProjectFileStatus(
      error instanceof Error
        ? error.message
        : String(error),
      "error"
    );
  }
}

async function loadProjectJsonFile(
  file
) {
  if (!file) {
    return;
  }

  const loadSession =
    ++activeProjectLoadSession;
  let documentKind = "project";

  setProjectFileStatus(
    `Reading and validating ${file.name}…`
  );
  setProjectLoadProgress(
    true,
    {
      progress: 8,
      stage:
        "Reading the file in a background worker…"
    }
  );

  try {
    if (
      file.size >
      PROJECT_FILE_MAX_BYTES
    ) {
      throw new Error(
        `The selected file is larger than the ${formatProjectByteLimit(PROJECT_FILE_MAX_BYTES)} project limit.`
      );
    }

    await paintBuilderUi();

    const projectSource =
      await readJsonFileSource(
        file,
        file.name
      );

    if (
      loadSession !==
        activeProjectLoadSession
    ) {
      return;
    }

    documentKind =
      projectModalJsonDocumentKind(
        projectSource
      );

    if (
      documentKind ===
        "saved-api-composites"
    ) {
      setProjectLoadProgress(
        true,
        {
          progress: 32,
          stage:
            "Saved API Composite JSON detected. Verifying its catalog contracts…"
        }
      );
      closeProjectDialog();
      setProjectLoadProgress(false);
      await paintBuilderUi();

      const host =
        window.RMLDynamicGraphHost;
      if (
        file.size >
          SAVED_API_COMPOSITE_IMPORT_MAX_BYTES
      ) {
        throw new Error(
          "The Saved API Composite JSON is larger than 32 MiB."
        );
      }
      if (
        !host ||
        typeof host.importSavedApiComposites !==
          "function"
      ) {
        throw new Error(
          "The Runtime Graph Composite library is not ready. Open the Runtime Graph once and retry the JSON import."
        );
      }

      const imported =
        await host.importSavedApiComposites(
          projectSource
        );
      if (
        loadSession !==
          activeProjectLoadSession
      ) {
        return;
      }

      openProjectDialog();
      const importSummary =
        imported?.summary || null;
      setProjectFileStatus(
        importSummary
          ? `Composite import completed: ${Number(importSummary.added || 0).toLocaleString("de-DE")} new, ${Number(importSummary.updated || 0).toLocaleString("de-DE")} updated, ${Number(importSummary.unchanged || 0).toLocaleString("de-DE")} unchanged and ${Number(importSummary.discarded || 0).toLocaleString("de-DE")} discarded. The open project was not changed.`
          : `Imported ${Number(imported?.length || 0).toLocaleString("de-DE")} Saved API Composite${imported?.length === 1 ? "" : "s"}. The open project was not changed.`,
        "success"
      );
      return;
    }

    assertProjectDocumentEnvelope(
      projectSource
    );

    setProjectLoadProgress(
      true,
      {
        progress: 28,
        stage:
          "JSON syntax and project envelope validated successfully."
      }
    );

    if (
      builderHasActiveProject()
    ) {
      closeProjectDialog();
      setProjectLoadProgress(false);
      await paintBuilderUi();

      const confirmed =
        await confirmBuilderAction({
          tone: "warning",
          kicker: "Project replacement",
          title: "Replace the current project?",
          message:
            "Loading the selected JSON project replaces the open Configuration Outline, Typed Runtime Graph and project metadata.",
          details:
            "Save the current project as JSON first if you want to keep a portable backup.",
          confirmLabel: "Load JSON"
        });

      if (
        loadSession !==
          activeProjectLoadSession
      ) {
        return;
      }

      if (!confirmed) {
        openProjectDialog();
        setProjectFileStatus(
          "Loading was cancelled."
        );
        return;
      }
    } else {
      closeProjectDialog();
    }

    const workSession =
      beginBuilderWork({
        kicker:
          "Pre-import compatibility check",
        title:
          "Checking API contracts before project construction…",
        message:
          "No imported graph, outline, generated source or project UI is built until every required API replacement has been resolved.",
        detail:
          "Only the JSON syntax and lightweight project envelope have been read so far.",
        progress: 32,
        timeout: 120000
      });

    try {
      const prerequisites =
        await ensureProjectRuntimePrerequisites(
          projectSource,
          workSession,
          { catalogOnly: true }
        );

      updateBuilderWork(
        workSession,
        {
          kicker:
            "Project loading",
          title:
            "Constructing the validated project…",
          message:
            "Every API contract and replacement has been confirmed. The Configuration Outline and Runtime Graph can now be normalized.",
          detail:
            "This is the first construction pass for the imported project.",
          progress: 54
        }
      );
      await paintBuilderUi();

      const project =
        parseProjectDocument(
          projectSource
        );
      Object.defineProperty(
        project,
        "__rmlJsonFingerprint",
        {
          value:
            projectIdentityFingerprint(
              project.projectId
            ),
          writable: false,
          enumerable: false,
          configurable: true
        }
      );

      await applyLoadedProjectWithFeedback(
        project,
        {
          displayName: file.name,
          workSession,
          prevalidatedPrerequisites:
            prerequisites
        }
      );
    } catch (error) {
      finishBuilderWork(
        workSession
      );
      throw error;
    }
  } catch (error) {
    if (
      loadSession !==
        activeProjectLoadSession
    ) {
      return;
    }

    const importCancelled =
      error?.code ===
        "RML_PROJECT_IMPORT_CANCELLED";
    if (importCancelled) {
      console.info(
        "Builder project import cancelled.",
        {
          source:
            error.cancelSource ||
            "explicit user action"
        }
      );
    } else {
      console.warn(
        documentKind ===
          "saved-api-composites"
          ? "Could not import the Saved API Composite JSON."
          : "Could not load the builder project.",
        error
      );
    }
    if (!elements.projectDialog.open) {
      openProjectDialog();
    }
    setProjectFileStatus(
      importCancelled
        ? String(
            error?.message ||
            "Project import cancelled."
          )
        : `${documentKind === "saved-api-composites" ? "Could not import these Saved API Composites" : "Could not load this project"}: ${
            error instanceof Error
              ? error.message
              : "Invalid JSON file."
          }`,
      importCancelled ? "" : "error"
    );
  } finally {
    if (
      loadSession ===
        activeProjectLoadSession
    ) {
      setProjectLoadProgress(false);
    }
    elements.projectFileInput.value =
      "";
  }
}

let crc32Table = null;

function getCrc32Table() {
  if (crc32Table) {
    return crc32Table;
  }

  crc32Table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value =
        (value & 1) !== 0
          ? 0xedb88320 ^ (value >>> 1)
          : value >>> 1;
    }
    crc32Table[index] = value >>> 0;
  }
  return crc32Table;
}

function crc32(bytes) {
  const table = getCrc32Table();
  let value = 0xffffffff;
  for (const byte of bytes) {
    value =
      table[(value ^ byte) & 0xff] ^
      (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function zipDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date:
      ((year - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate()
  };
}

function createZipBlob(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  const timestamp = zipDateTime();
  let localOffset = 0;
  let centralSize = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const contentBytes = encoder.encode(file.content);
    const checksum = crc32(contentBytes);

    const localHeader = new Uint8Array(
      30 + nameBytes.length
    );
    const localView = new DataView(
      localHeader.buffer
    );
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, timestamp.time, true);
    localView.setUint16(12, timestamp.date, true);
    localView.setUint32(14, checksum, true);
    localView.setUint32(18, contentBytes.length, true);
    localView.setUint32(22, contentBytes.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(
      localHeader,
      contentBytes
    );

    const centralHeader = new Uint8Array(
      46 + nameBytes.length
    );
    const centralView = new DataView(
      centralHeader.buffer
    );
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, timestamp.time, true);
    centralView.setUint16(14, timestamp.date, true);
    centralView.setUint32(16, checksum, true);
    centralView.setUint32(20, contentBytes.length, true);
    centralView.setUint32(24, contentBytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset +=
      localHeader.length +
      contentBytes.length;
    centralSize += centralHeader.length;
  }

  const endRecord = new Uint8Array(22);
  const endView = new DataView(
    endRecord.buffer
  );
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, localOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob(
    [
      ...localParts,
      ...centralParts,
      endRecord
    ],
    {
      type: "application/zip"
    }
  );
}

function safeArchiveSegment(
  value,
  fallback = "Generated"
) {
  const normalized = String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);

  return normalized || fallback;
}

function safeArchiveRelativePath(
  value,
  fallback = "Generated.cs"
) {
  const parts = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .map(part => part.trim())
    .filter(part =>
      part &&
      part !== "." &&
      part !== ".."
    )
    .map(part =>
      safeArchiveSegment(
        part,
        "Generated"
      )
    );

  return parts.join("/") ||
    safeArchiveSegment(
      fallback,
      "Generated.cs"
    );
}

function auxiliaryProjectFolder(
  project,
  index
) {
  return safeArchiveRelativePath(
    project?.folder ||
      project?.name ||
      `Library-${index + 1}`,
    `Library-${index + 1}`
  );
}

function generateMultiProjectReadme(
  baseName,
  auxiliaryProjects
) {
  const projectLines = auxiliaryProjects
    .map((project, index) => {
      const folder = auxiliaryProjectFolder(
        project,
        index
      );
      const name = safeArchiveSegment(
        project.name ||
        project.assemblyName,
        `Library-${index + 1}`
      );
      const deployment = String(
        project.deployDirectory ||
        "rml_libs"
      );

      return `- \`${folder}/${name}.csproj\` → builds \`${name}.dll\` and deploys it to \`${deployment}\`.`;
    })
    .join("\n");

  return `# ${baseName} generated RML project

This archive contains independently compiled projects because early Harmony patches must be loaded before normal RML mods.

## Projects

- \`Mod/${baseName}.csproj\` → builds \`${baseName}.dll\` and deploys it to \`rml_mods\`.
${projectLines}

## Build

Run \`build.ps1\` on Windows or \`build.sh\` on Linux/macOS. Each project also supports a custom Resonite path:

\`dotnet build <project.csproj> -c Release -p:ResonitePath="<Resonite installation>"\`

Set \`-p:DeployToResonite=false\` to compile without copying the resulting DLL.

## Harmony load phases

- Graph-driven Harmony Patch Event and scanner-generated Harmony API calls remain in the main mod DLL and register at mod \`OnEngineInit\`.
- Early Harmony Patch Library sources compile into the separate \`rml_libs\` DLL and are discovered through \`RmlPatchAssemblyAttribute\` before \`rml_mods\` are loaded.
- Early patch libraries cannot call generated graph \`Emit...\` methods or depend on runtime configuration values from the main mod.
`;
}

function generateBuildPowerShell(
  baseName,
  auxiliaryProjects
) {
  const projects = [
    ...auxiliaryProjects.map((project, index) => {
      const folder = auxiliaryProjectFolder(
        project,
        index
      );
      const name = safeArchiveSegment(
        project.name ||
        project.assemblyName,
        `Library-${index + 1}`
      );
      return `./${folder}/${name}.csproj`;
    }),
    `./Mod/${baseName}.csproj`
  ];

  return `$ErrorActionPreference = "Stop"

$projects = @(
${projects.map(project => `    "${project}"`).join(",\n")}
)

foreach ($project in $projects) {
    dotnet build $project -c Release @args
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
`;
}

function generateBuildShell(
  baseName,
  auxiliaryProjects
) {
  const projects = [
    ...auxiliaryProjects.map((project, index) => {
      const folder = auxiliaryProjectFolder(
        project,
        index
      );
      const name = safeArchiveSegment(
        project.name ||
        project.assemblyName,
        `Library-${index + 1}`
      );
      return `./${folder}/${name}.csproj`;
    }),
    `./Mod/${baseName}.csproj`
  ];

  return `#!/usr/bin/env sh
set -eu

${projects
    .map(project =>
      `dotnet build "${project}" -c Release "$@"`
    )
    .join("\n")}
`;
}

function buildSelectedExportFiles(
  includeCs,
  includeCsproj
) {
  const baseName = generatedBaseName();
  const graphFiles =
    getAdditionalGeneratedSourceFiles();
  const auxiliaryProjects =
    getAdditionalGeneratedProjects();

  if (!includeCs && !includeCsproj) {
    return {
      files: [],
      multiProject:
        auxiliaryProjects.length > 0,
      auxiliaryProjects
    };
  }

  if (auxiliaryProjects.length === 0) {
    const files = [];

    if (includeCs) {
      files.push({
        name: `${baseName}.cs`,
        content: generateCode(),
        type:
          "text/plain;charset=utf-8"
      });
      files.push(...graphFiles);
    }

    if (includeCsproj) {
      files.push({
        name: `${baseName}.csproj`,
        content: generateProjectFile(),
        type:
          "application/xml;charset=utf-8"
      });
    }

    return {
      files,
      multiProject: false,
      auxiliaryProjects
    };
  }

  const root = safeArchiveSegment(
    `${baseName}-RML-Project`,
    "RML-Project"
  );
  const files = [];
  const usedPaths = new Set();

  const addFile = file => {
    const requested = safeArchiveRelativePath(
      file.name,
      "Generated.txt"
    );
    const extensionIndex =
      requested.lastIndexOf(".");
    const stem = extensionIndex > 0
      ? requested.slice(0, extensionIndex)
      : requested;
    const extension = extensionIndex > 0
      ? requested.slice(extensionIndex)
      : "";
    let unique = requested;
    let suffix = 2;

    while (
      usedPaths.has(
        unique.toLowerCase()
      )
    ) {
      unique = `${stem}-${suffix}${extension}`;
      suffix += 1;
    }

    usedPaths.add(
      unique.toLowerCase()
    );
    files.push({
      ...file,
      name: `${root}/${unique}`
    });
  };

  if (includeCs) {
    addFile({
      name: `Mod/${baseName}.cs`,
      content: generateCode(),
      type:
        "text/plain;charset=utf-8"
    });

    for (const graphFile of graphFiles) {
      addFile({
        ...graphFile,
        name:
          `Mod/${safeArchiveRelativePath(
            graphFile.name,
            `${baseName}.NodeGraph.cs`
          )}`
      });
    }

    auxiliaryProjects.forEach(
      (project, index) => {
        const folder =
          auxiliaryProjectFolder(
            project,
            index
          );

        for (const file of
          project.files || []) {
          addFile({
            ...file,
            name:
              `${folder}/${safeArchiveRelativePath(
                file.name,
                "GeneratedPatch.cs"
              )}`
          });
        }
      }
    );
  }

  if (includeCsproj) {
    addFile({
      name: `Mod/${baseName}.csproj`,
      content: generateProjectFile(),
      type:
        "application/xml;charset=utf-8"
    });

    auxiliaryProjects.forEach(
      (project, index) => {
        const folder =
          auxiliaryProjectFolder(
            project,
            index
          );
        const projectName =
          safeArchiveSegment(
            project.name ||
            project.assemblyName,
            `Library-${index + 1}`
          );

        addFile({
          name:
            `${folder}/${projectName}.csproj`,
          content:
            generateAuxiliaryProjectFile(
              project
            ),
          type:
            "application/xml;charset=utf-8"
        });
      }
    );

    addFile({
      name: "build.ps1",
      content:
        generateBuildPowerShell(
          baseName,
          auxiliaryProjects
        ),
      type:
        "text/plain;charset=utf-8"
    });
    addFile({
      name: "build.sh",
      content:
        generateBuildShell(
          baseName,
          auxiliaryProjects
        ),
      type:
        "text/plain;charset=utf-8"
    });
  }

  addFile({
    name: "README.md",
    content:
      generateMultiProjectReadme(
        baseName,
        auxiliaryProjects
      ),
    type:
      "text/markdown;charset=utf-8"
  });

  return {
    files,
    multiProject: true,
    auxiliaryProjects
  };
}

function generatedArtifactKind(
  fileName,
  mimeType = ""
) {
  const name = String(fileName || "")
    .toLowerCase();
  const type = String(mimeType || "")
    .toLowerCase();

  if (name.endsWith(".cs")) {
    return {
      kind: "source",
      kindLabel: "C# source",
      badge: "CS"
    };
  }

  if (
    name.endsWith(".csproj") ||
    type.includes("xml")
  ) {
    return {
      kind: "project",
      kindLabel: ".NET project",
      badge: "PROJ"
    };
  }

  if (
    name.endsWith(".ps1") ||
    name.endsWith(".sh")
  ) {
    return {
      kind: "build",
      kindLabel: "Build script",
      badge: "BUILD"
    };
  }

  if (
    name.endsWith(".md") ||
    type.includes("markdown")
  ) {
    return {
      kind: "documentation",
      kindLabel: "Documentation",
      badge: "DOC"
    };
  }

  return {
    kind: "file",
    kindLabel: "Generated file",
    badge: "FILE"
  };
}

function stripGeneratedArchiveRoot(
  archivePath,
  multiProject
) {
  const normalized =
    String(archivePath || "")
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

  if (!multiProject) {
    return normalized;
  }

  const separator =
    normalized.indexOf("/");

  return separator >= 0
    ? normalized.slice(separator + 1)
    : normalized;
}

function generatedProjectDescriptors(
  result
) {
  const baseName = generatedBaseName();
  const descriptors = [
    {
      id: "main-mod",
      folder: result.multiProject
        ? "Mod"
        : "",
      label: `${baseName} · Main mod`,
      assemblyName: baseName,
      deployDirectory: "rml_mods",
      role: "rml-mod"
    }
  ];

  result.auxiliaryProjects.forEach(
    (project, index) => {
      descriptors.push({
        id:
          String(
            project.id ||
            `auxiliary-${index + 1}`
          ),
        folder:
          auxiliaryProjectFolder(
            project,
            index
          ),
        label:
          String(
            project.name ||
            project.assemblyName ||
            `Library ${index + 1}`
          ),
        assemblyName:
          String(
            project.assemblyName ||
            project.name ||
            `Library-${index + 1}`
          ),
        deployDirectory:
          String(
            project.deployDirectory ||
            "rml_libs"
          ),
        role:
          String(
            project.role ||
            "auxiliary-library"
          )
      });
    }
  );

  return descriptors;
}

function buildGeneratedArtifactCatalog(
  includeCs = true,
  includeCsproj = true
) {
  const result =
    buildSelectedExportFiles(
      includeCs,
      includeCsproj
    );
  const projects =
    generatedProjectDescriptors(result);
  const projectFolders = projects
    .filter(project => project.folder)
    .sort(
      (left, right) =>
        right.folder.length -
        left.folder.length
    );

  const artifacts = result.files.map(
    (file, index) => {
      const relativePath =
        stripGeneratedArchiveRoot(
          file.name,
          result.multiProject
        );
      const normalizedPath =
        relativePath.replace(/\\/g, "/");
      let project = null;

      if (!result.multiProject) {
        project = projects[0];
      } else {
        project = projectFolders.find(
          candidate =>
            normalizedPath ===
              candidate.folder ||
            normalizedPath.startsWith(
              `${candidate.folder}/`
            )
        ) || null;
      }

      const kind =
        generatedArtifactKind(
          normalizedPath,
          file.type
        );

      return {
        key:
          String(file.name ||
            `generated-${index}`),
        archivePath:
          String(file.name || ""),
        relativePath:
          normalizedPath,
        fileName:
          normalizedPath
            .split("/")
            .pop() ||
          normalizedPath,
        content:
          String(file.content || ""),
        type:
          file.type ||
          "text/plain;charset=utf-8",
        ...kind,
        projectId:
          project?.id ||
          "support",
        projectLabel:
          project?.label ||
          "Build & documentation",
        deployDirectory:
          project?.deployDirectory ||
          "",
        projectRole:
          project?.role ||
          "support",
        requiresResonitePath:
          kind.kind === "project"
      };
    }
  );

  return {
    ...result,
    projects,
    artifacts
  };
}

function renderExportProjectSummary(
  catalog
) {
  const host =
    elements.exportProjectSummary;

  if (!host) {
    return;
  }

  const fragment =
    document.createDocumentFragment();
  const projectPaths = new Set(
    catalog.artifacts
      .map(artifact => artifact.projectId)
  );

  for (const project of catalog.projects) {
    if (!projectPaths.has(project.id)) {
      continue;
    }

    const card =
      document.createElement("div");
    const title =
      document.createElement("strong");
    const detail =
      document.createElement("small");
    const target =
      document.createElement("b");

    card.className =
      "export-generated-project";
    title.textContent =
      project.label;
    detail.textContent =
      project.folder
        ? `${project.folder}/${project.assemblyName}.csproj`
        : `${project.assemblyName}.csproj`;
    target.textContent =
      `→ ${project.deployDirectory}`;

    card.append(
      title,
      detail,
      target
    );
    fragment.appendChild(card);
  }

  host.replaceChildren(fragment);
  host.hidden =
    host.childElementCount === 0;
}

function renderExportGeneratedFiles(
  catalog
) {
  const host =
    elements.exportGeneratedFiles;

  if (!host) {
    return;
  }

  if (catalog.artifacts.length === 0) {
    const empty =
      document.createElement("p");

    empty.className =
      "export-generated-empty";
    empty.textContent =
      "No files are selected for export.";
    host.replaceChildren(empty);
    return;
  }

  const fragment =
    document.createDocumentFragment();

  for (const artifact of
    catalog.artifacts) {
    const row =
      document.createElement("button");
    const badge =
      document.createElement("span");
    const copy =
      document.createElement("span");
    const path =
      document.createElement("strong");
    const detail =
      document.createElement("small");
    const target =
      document.createElement("b");

    row.type = "button";
    row.className =
      "export-generated-file";
    row.dataset.kind = artifact.kind;
    row.dataset.artifactKey =
      artifact.key;
    row.title =
      `Select ${artifact.relativePath} for copying`;

    badge.className =
      "export-generated-file-badge";
    badge.textContent = artifact.badge;
    copy.className =
      "export-generated-file-copy";
    path.textContent =
      artifact.relativePath;
    detail.textContent =
      `${artifact.kindLabel} · ${artifact.projectLabel}`;
    copy.append(path, detail);

    target.className =
      "export-generated-file-target";
    target.textContent =
      artifact.deployDirectory
        ? artifact.deployDirectory
        : "support";

    row.append(
      badge,
      copy,
      target
    );
    row.addEventListener(
      "click",
      () => {
        exportCopyArtifactKey =
          artifact.key;

        updateExportCopyButtonState(
          catalog
        );
      }
    );
    fragment.appendChild(row);
  }

  host.replaceChildren(fragment);
}

function currentExportCopyArtifact(
  existingCatalog = null
) {
  const catalog =
    existingCatalog ||
    buildGeneratedArtifactCatalog(
      true,
      true
    );
  let artifact = catalog.artifacts.find(
    candidate =>
      candidate.key ===
      exportCopyArtifactKey
  );

  if (!artifact) {
    const graphFiles =
      getAdditionalGeneratedSourceFiles();

    artifact =
      preferredGraphArtifact(
        catalog.artifacts,
        graphFiles
      ) ||
      catalog.artifacts[0] ||
      null;
  }

  exportCopyArtifactKey =
    artifact?.key || "";

  return {
    catalog,
    artifact
  };
}

function updateExportCopyButtonState(
  existingCatalog = null,
  existingPathAvailable = null,
  existingHasDiagnostics = null
) {
  const { catalog, artifact } =
    currentExportCopyArtifact(
      existingCatalog
    );
  const pathAvailable =
    existingPathAvailable === null
      ? Boolean(
          elements.exportResonitePath
            ?.value.trim()
        )
      : existingPathAvailable;
  const hasDiagnostics =
    existingHasDiagnostics === null
      ? getDiagnostics().length > 0
      : existingHasDiagnostics;

  elements.exportGeneratedFiles
    ?.querySelectorAll(
      ".export-generated-file"
    )
    .forEach(row => {
      const selected =
        row.dataset.artifactKey ===
          artifact?.key;

      row.classList.toggle(
        "selected",
        selected
      );

      row.setAttribute(
        "aria-pressed",
        String(selected)
      );
    });

  if (elements.exportCopySelectedFile) {
    elements.exportCopySelectedFile.disabled =
      hasDiagnostics ||
      !artifact ||
      (
        artifact.requiresResonitePath &&
        !pathAvailable
      );
    elements.exportCopySelectedFile.textContent =
      artifact
        ? `Copy ${artifact.fileName}`
        : "Copy selected file";
    elements.exportCopySelectedFile.title =
      artifact
        ? artifact.relativePath
        : "No generated file is available.";
  }
}

async function validateGeneratedCSharp14Files(files) {
  const sources = (Array.isArray(files) ? files : [])
    .filter(file => /\.cs$/i.test(String(file?.name || "")));
  if (sources.length === 0) return;
  const parser = window.RMLCSharp14Roslyn;
  if (!parser?.validate || parser.languageVersion !== "14.0") {
    throw new Error("The bundled .NET 10 Roslyn C# 14 validator is unavailable. Export is blocked instead of emitting unchecked source.");
  }
  const failures = [];
  for (const file of sources) {
    const result = await parser.validate(String(file.content || ""));
    if (result?.ok === true) continue;
    const details = typeof window.RMLVisualCSharp?.formatRoslynDiagnostics === "function"
      ? window.RMLVisualCSharp.formatRoslynDiagnostics(result?.diagnostics)
      : (result?.diagnostics || []).map(diagnostic => `${diagnostic?.id || "C#14"}: ${diagnostic?.message || "Invalid syntax."}`);
    failures.push(`${file.name}: ${details.slice(0, 8).join(" | ") || "Roslyn rejected the generated C# 14 source."}`);
  }
  if (failures.length > 0) {
    throw new Error(`C# 14 export validation failed. ${failures.join(" | ")}`);
  }
}

function setExportValidationFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  elements.exportDownloadSelected.disabled = true;
  elements.exportCopySelectedFile.disabled = true;
  elements.exportDownloadHint.textContent = message;
  elements.exportDownloadHint.classList.add("error");
}

async function copySelectedExportArtifact(
  button
) {
  const { artifact } =
    currentExportCopyArtifact();

  if (
    !artifact ||
    button.disabled ||
    getDiagnostics().length > 0
  ) {
    return;
  }

  const originalLabel = button.textContent;
  let failed = false;
  try {
    button.disabled = true;
    button.textContent = "Validating C# 14…";
    elements.exportDownloadHint.classList.remove("error");
    const complete = buildSelectedExportFiles(true, false);
    await validateGeneratedCSharp14Files(complete.files);
    await copyText(artifact.content, button);
  } catch (error) {
    failed = true;
    setExportValidationFailure(error);
  } finally {
    button.textContent = originalLabel;
    if (!failed) updateExportDialog();
  }
}

function currentApiExportCompatibilityWarning() {
  const graph =
    state.extensions
      ?.typedNodeGraph;

  if (
    !graph ||
    !graph.configSnapshot ||
    !Array.isArray(
      graph.configSnapshot.nodes
    ) ||
    !Array.isArray(graph.nodes)
  ) {
    return null;
  }

  const apiNodes =
    graph.nodes.filter(node =>
      node?.kind === "operator" &&
      String(
        node.operatorId || ""
      ).startsWith("api.")
    );

  if (apiNodes.length === 0) {
    return null;
  }

  const report =
    window.RMLApiNodeFactoryReport;
  const definitions =
    window.RMLModNodeRegistry
      ?.getNodeDefinitions?.() || {};
  const liveFactoryVerified =
    Boolean(
      report &&
      typeof report === "object" &&
      report.liveCatalogVerified ===
        true &&
      report.catalogSource ===
        "scanner" &&
      report.verificationPassed ===
        true
    );
  const contractsVerified =
    liveFactoryVerified &&
    apiNodes.every(node => {
      const definition =
        definitions[
          node.operatorId
        ];
      const contract =
        definition?.apiVerification;

      return Boolean(
        definition
          ?.catalogGenerated === true &&
        contract &&
        typeof contract === "object" &&
        String(contract.nodeId || "") ===
          String(node.operatorId) &&
        String(
          contract.catalogFingerprint ||
          ""
        ) ===
          String(
            report.catalogFingerprint ||
            ""
          ) &&
        String(
          contract.engineVersion || ""
        ) ===
          String(
            report.engineVersion || ""
          ) &&
        String(
          contract.contractFingerprint ||
          ""
        ).trim()
      );
    });

  if (contractsVerified) {
    return null;
  }

  return Object.freeze({
    apiNodeCount:
      apiNodes.length,
    catalogSource:
      String(
        report?.catalogSource ||
        "unavailable"
      )
  });
}

function renderExportApiCompatibilityWarning() {
  const host =
    elements.exportApiCompatibilityWarning;
  const message =
    elements.exportApiCompatibilityWarningMessage;

  if (!host || !message) {
    return;
  }

  const warning =
    currentApiExportCompatibilityWarning();

  host.hidden = !warning;

  if (!warning) {
    message.textContent = "";
    return;
  }

  message.textContent =
    `This export uses ${warning.apiNodeCount.toLocaleString()} catalog-generated API node${warning.apiNodeCount === 1 ? "" : "s"}. Export remains fully available, but the nodes are based on cached or otherwise not currently Live-verified API metadata. Compatibility with the installed Resonite and RML versions cannot be guaranteed; build and test the generated mod against the matching environment.`;
}

function updateExportDialog() {
  elements.exportDownloadHint.classList.remove("error");
  const platform =
    elements.exportPlatform.value;
  const includeCs =
    elements.exportIncludeCs.checked;
  const includeCsproj =
    elements.exportIncludeCsproj.checked;
  const catalog =
    buildGeneratedArtifactCatalog(
      includeCs,
      includeCsproj
    );
  const completeCatalog =
    buildGeneratedArtifactCatalog(
      true,
      true
    );
  const pathAvailable =
    elements.exportResonitePath.value
      .trim()
      .length > 0;
  const hasSelection =
    catalog.artifacts.length > 0;
  const projectPathMissing =
    includeCsproj &&
    !pathAvailable;
  const hasDiagnostics =
    getDiagnostics().length > 0;
  const sourceCount =
    completeCatalog.artifacts.filter(
      artifact =>
        artifact.kind === "source"
    ).length;
  const projectBuildCount =
    completeCatalog.artifacts.filter(
      artifact =>
        artifact.kind !== "source"
    ).length;
  const activeProjectIds = new Set(
    catalog.artifacts
      .map(artifact => artifact.projectId)
      .filter(projectId =>
        projectId !== "support"
      )
  );
  const activeProjectCount =
    activeProjectIds.size;
  const effectiveMultiProject =
    activeProjectCount > 1;

  renderExportApiCompatibilityWarning();

  elements.exportCsFilename.textContent =
    `${sourceCount} generated source file${
      sourceCount === 1 ? "" : "s"
    }`;
  elements.exportCsprojFilename.textContent =
    `${projectBuildCount} project/build/support file${
      projectBuildCount === 1
        ? ""
        : "s"
    }`;

  if (elements.exportPackageSummary) {
    elements.exportPackageSummary.textContent =
      `${activeProjectCount} project${activeProjectCount === 1 ? "" : "s"} · ${catalog.artifacts.length} file${catalog.artifacts.length === 1 ? "" : "s"}`;
  }

  if (elements.exportPackageMode) {
    elements.exportPackageMode.textContent =
      catalog.artifacts.length === 0
        ? "No files selected"
        : effectiveMultiProject
          ? "Multi-project ZIP"
          : "Single project";
    elements.exportPackageMode.dataset.mode =
      effectiveMultiProject
        ? "multi"
        : "single";
  }

  renderExportProjectSummary(catalog);
  renderExportGeneratedFiles(catalog);
  updateExportCopyButtonState(
    catalog,
    pathAvailable,
    hasDiagnostics
  );

  elements.exportResonitePath.setAttribute(
    "aria-invalid",
    String(projectPathMissing)
  );
  elements.exportDownloadSelected.disabled =
    hasDiagnostics ||
    !hasSelection ||
    projectPathMissing;

  const platformNotes = {
    windows:
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The Windows Steam path is selected.",
    linux:
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The Linux preset uses the MSBuild <code>$(HOME)</code> property.",
    "linux-flatpak":
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The Flatpak Steam sandbox path remains editable.",
    macos:
      "The generated project itself is valid on macOS with <strong>.NET 10</strong> and matching assemblies. Resonite currently has no official macOS client distribution.",
    custom:
      "Project target: <strong>.NET 10</strong>, matching current Resonite and RML. The custom assembly path remains editable."
  };

  elements.exportCompatibilityHint.innerHTML =
    platformNotes[platform] ||
    platformNotes.custom;

  if (!hasSelection) {
    elements.exportDownloadSelected.textContent =
      "Select a file";
    elements.exportDownloadHint.textContent =
      "Select at least one generated file group to download.";
    return;
  }

  if (effectiveMultiProject) {
    const destinations = [
      ...new Set(
        catalog.projects
          .filter(project =>
            catalog.artifacts.some(
              artifact =>
                artifact.projectId ===
                project.id
            )
          )
          .map(project =>
            project.deployDirectory
          )
      )
    ];

    elements.exportDownloadSelected.textContent =
      "Download multi-project ZIP";
    elements.exportDownloadHint.textContent =
      `The live manifest above is the exact ZIP content: ${catalog.artifacts.length} files across ${activeProjectCount} independently compiled projects${destinations.length > 0 ? `, deploying to ${destinations.join(" and ")}` : ""}.`;
    return;
  }

  if (catalog.artifacts.length === 1) {
    const artifact =
      catalog.artifacts[0];
    const extension =
      artifact.fileName.includes(".")
        ? artifact.fileName.slice(
            artifact.fileName.lastIndexOf(".")
          )
        : " file";

    elements.exportDownloadSelected.textContent =
      `Download ${extension}`;
    elements.exportDownloadHint.textContent =
      artifact.requiresResonitePath &&
      !pathAvailable
        ? "Enter the Resonite installation path to create the selected project file."
        : `${artifact.relativePath} will be downloaded directly.`;
    return;
  }

  elements.exportDownloadSelected.textContent =
    "Download ZIP";
  elements.exportDownloadHint.textContent =
    `The live manifest above contains the exact ${catalog.artifacts.length} files that will be bundled into the ZIP.`;
}

function syncExportOptions() {
  state.exportOptions = {
    platform:
      elements.exportPlatform.value,
    resonitePath:
      elements.exportResonitePath.value,
    includeCs:
      elements.exportIncludeCs.checked,
    includeCsproj:
      elements.exportIncludeCsproj.checked
  };
  persist();
  updateExportDialog();
}

function applyExportPlatformPreset() {
  const presetPath =
    EXPORT_PLATFORM_PRESETS[
      elements.exportPlatform.value
    ];

  if (presetPath) {
    elements.exportResonitePath.value =
      presetPath;
  }

  syncExportOptions();
}

function syncEditedResonitePath() {
  const selectedPlatform =
    elements.exportPlatform.value;
  const presetPath =
    EXPORT_PLATFORM_PRESETS[
      selectedPlatform
    ];

  if (
    presetPath &&
    normalizedResonitePath(
      elements.exportResonitePath.value
    ) !==
      normalizedResonitePath(
        presetPath
      )
  ) {
    elements.exportPlatform.value =
      "custom";
  }

  syncExportOptions();
}

let exportDialogOpenSequence = 0;

async function openExportDialog() {
  const sequence =
    ++exportDialogOpenSequence;
  elements.exportPlatform.value =
    state.exportOptions.platform ||
    inferExportPlatform(
      state.exportOptions.resonitePath
    );
  elements.exportResonitePath.value =
    state.exportOptions.resonitePath;
  elements.exportIncludeCs.checked =
    Boolean(state.exportOptions.includeCs);
  elements.exportIncludeCsproj.checked =
    Boolean(state.exportOptions.includeCsproj);
  elements.exportDialog.classList.add(
    "rml-dialog-loading"
  );
  elements.exportPackageSummary.textContent =
    "Preparing generated files…";
  elements.exportPackageMode.textContent =
    "Please wait";
  elements.exportProjectSummary.replaceChildren();
  elements.exportGeneratedFiles.innerHTML =
    '<div class="rml-inline-dialog-loading">Preparing the exact generated package…</div>';
  elements.exportCopySelectedFile.disabled = true;
  elements.exportDownloadSelected.disabled = true;

  if (typeof elements.exportDialog.showModal === "function") {
    elements.exportDialog.showModal();
  } else {
    elements.exportDialog.setAttribute("open", "");
  }

  stabilizeDialogFocus(
    elements.exportDialog
  );

  await paintBuilderUi();

  if (
    sequence !==
      exportDialogOpenSequence ||
    !elements.exportDialog.open
  ) {
    return;
  }

  try {
    updateExportDialog();

    const exportSelectUi =
      ensureUniversalCustomSelect(
        elements.exportPlatform
      );
    exportSelectUi?.refresh?.();
  } catch (error) {
    console.error(
      "Export dialog preparation failed.",
      error
    );
    elements.exportGeneratedFiles.innerHTML =
      '<div class="rml-inline-dialog-loading">The export summary could not be prepared. Close this dialog and review Diagnostics.</div>';
    elements.exportCopySelectedFile.disabled = true;
    elements.exportDownloadSelected.disabled = true;
  } finally {
    elements.exportDialog.classList.remove(
      "rml-dialog-loading"
    );
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      updateAdaptiveUtilityDialog(
        elements.exportDialog
      );
    });
  });
}

function closeExportDialog() {
  exportDialogOpenSequence += 1;
  elements.exportDialog.classList.remove(
    "mobile-full-modal",
    "rml-dialog-loading"
  );

  if (typeof elements.exportDialog.close === "function") {
    elements.exportDialog.close();
  } else {
    elements.exportDialog.removeAttribute("open");
  }
}

async function downloadSelectedExport() {
  syncExportOptions();

  if (
    elements.exportDownloadSelected
      .disabled ||
    getDiagnostics().length > 0
  ) {
    return;
  }

  const baseName =
    generatedBaseName();
  const originalLabel = elements.exportDownloadSelected.textContent;
  elements.exportDownloadSelected.disabled = true;
  elements.exportDownloadSelected.textContent = "Validating C# 14…";
  elements.exportDownloadHint.classList.remove("error");
  let result;
  try {
    const complete = buildSelectedExportFiles(true, false);
    await validateGeneratedCSharp14Files(complete.files);
    result = buildSelectedExportFiles(
      state.exportOptions.includeCs,
      state.exportOptions.includeCsproj
    );
  } catch (error) {
    setExportValidationFailure(error);
    elements.exportDownloadSelected.textContent = originalLabel;
    return;
  }
  const files = result.files;

  if (files.length === 0) {
    elements.exportDownloadSelected.textContent = originalLabel;
    updateExportDialog();
    return;
  }

  if (
    files.length === 1 &&
    !result.multiProject
  ) {
    const file = files[0];

    downloadBlob(
      new Blob(
        [file.content],
        {
          type:
            file.type ||
            "text/plain;charset=utf-8"
        }
      ),
      file.name
    );
    elements.exportDownloadSelected.textContent = originalLabel;
    updateExportDialog();
    return;
  }

  downloadBlob(
    createZipBlob(files),
    `${baseName}-RML-Project.zip`
  );
  elements.exportDownloadSelected.textContent = originalLabel;
  updateExportDialog();
}

async function loadExampleProject() {
  closeProjectDialog();
  const workSession = beginBuilderWork({
    kicker: "Example project",
    title: "Reading the example…",
    message:
      `${EXAMPLE_PROJECT_FILE_NAME} is being read and validated in the background worker.`,
    detail:
      "The current project remains intact until validation succeeds.",
    progress: 10
  });

  try {
    await paintBuilderUi();
    const project =
      await readExampleProjectDocument();

    updateBuilderWork(
      workSession,
      {
        title: "Example validated",
        message:
          "The complete example is ready to be installed.",
        progress: 30
      }
    );

    await applyLoadedProjectWithFeedback(
      project,
      {
        displayName:
          EXAMPLE_PROJECT_FILE_NAME,
        workSession
      }
    );
  } catch (error) {
    finishBuilderWork(workSession);
    throw error;
  }
}

async function newBlank() {
  const previousProjectId =
    state.projectId;

  if (builderHasActiveProject()) {
    closeProjectDialog();
    await paintBuilderUi();

    const confirmed =
      await confirmBuilderAction({
        tone: "danger",
        kicker: "Project reset",
        title: "Start with a blank project?",
        message:
          "This clears the open Configuration Outline, Typed Runtime Graph and project metadata.",
        details:
          "Save the current project as JSON first if you may need it again.",
        confirmLabel: "Start Blank"
      });

    if (!confirmed) {
      openProjectDialog();
      setProjectFileStatus(
        "Starting a blank project was cancelled."
      );
      return;
    }
  } else {
    closeProjectDialog();
  }

  const workSession = beginBuilderWork({
    kicker: "Project reset",
    title: "Starting a blank project…",
    message:
      "The current interface and Runtime Graph are being reset safely.",
    detail:
      "The blank project will be usable as soon as its first frame is ready.",
    progress: 35
  });

  try {
    await paintBuilderUi();

    if (
      document.body.classList.contains(
        "rml-node-graph-mode"
      )
    ) {
      const packButton =
        document.getElementById(
          "pack-into-node"
        ) ||
        document.querySelector(
          ".rml-pack-button"
        );

      packButton?.click();
    }

    state.metadata = { ...DEFAULT_METADATA };
    state.projectId =
      createFreshProjectId();
    state.extensions = {};
    state.activePage =
      "configuration-outline";
    state.nodes = [];
    state.selectedId = null;
    state.activeContainerId = ROOT_CONTAINER;
    writePageStateMarker(
      state.activePage,
      "new-blank"
    );
    renderMetadata();
    renderPalette();

    updateBuilderWork(
      workSession,
      {
        title: "Preparing the blank interface…",
        message:
          "Controls and dialogs are being synchronized.",
        progress: 75
      }
    );
    await paintBuilderUi();
    renderAll();

    await commitSuccessfulProjectStorage(
      previousProjectId,
      "new-blank"
    );

    updateBuilderWork(
      workSession,
      {
        title: "Blank project ready",
        message:
          "The builder is ready for a new project.",
        progress: 100
      }
    );
    await paintBuilderUi();
  } finally {
    finishBuilderWork(workSession);
  }
}

function setTopMenuOpen(open) {
  const expanded = Boolean(open);

  elements.topActions?.classList.toggle(
    "mobile-menu-open",
    expanded
  );

  if (elements.topMenuToggle) {
    elements.topMenuToggle.setAttribute(
      "aria-expanded",
      String(expanded)
    );
    elements.topMenuToggle.setAttribute(
      "aria-label",
      expanded
        ? "Close menu"
        : "Open menu"
    );
  }
}

function toggleTopMenu() {
  setTopMenuOpen(
    !elements.topActions?.classList.contains(
      "mobile-menu-open"
    )
  );
}

function nodeReferencePortText(port) {
  if (!port || typeof port !== "object") {
    return "";
  }

  const label = String(port.label || port.id || "Value");
  const type = String(port.type || port.typeVar || "T");
  return `${label}: ${type}`;
}

function informationNodeIsAdvanced(definition) {
  return Boolean(
    definition?.expertOnly === true ||
    String(definition?.group || "") === "Advanced / Raw C#"
  );
}

function informationNodeCard(operatorId, definition) {
  const card = document.createElement("article");
  card.className = "information-node-card";

  if (informationNodeIsAdvanced(definition)) {
    card.classList.add("information-node-card-advanced");
  }
  if (definition.hiddenFromPalette === true) {
    card.classList.add("information-node-card-internal");
  }

  const symbol = document.createElement("span");
  symbol.className = "information-node-symbol";
  symbol.textContent = String(definition.symbol || "•");

  const content = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "information-node-card-heading";

  const title = document.createElement("strong");
  title.textContent = String(definition.title || operatorId);
  heading.appendChild(title);

  if (definition.hiddenFromPalette === true) {
    const badge = document.createElement("span");
    badge.className = "information-node-badge internal";
    badge.textContent = "Internal helper";
    badge.title = "This registered node is intentionally not shown as a normal palette button, but it is part of the runtime node system and is documented here for completeness.";
    heading.appendChild(badge);
  }

  if (informationNodeIsAdvanced(definition)) {
    const badge = document.createElement("span");
    badge.className = "information-node-badge advanced";
    badge.textContent = "Advanced / Raw C#";
    badge.title = "Expert-level node: this bypasses part of the normal typed/safe abstraction and can require exact C#, reflection, compiler, assembly or load-phase knowledge.";
    heading.appendChild(badge);
  }

  if (
    definition.customCSharpSyntaxNode === true ||
    definition.customCSharpSubgraphOnly === true
  ) {
    const badge = document.createElement("span");
    badge.className = "information-node-badge file-graph";
    badge.textContent = "Custom C# File Graph only";
    badge.title = "This node is available only inside the isolated graph opened from a Custom C# File node.";
    heading.appendChild(badge);
  }

  const id = document.createElement("small");
  id.textContent = operatorId;
  const description = document.createElement("p");
  description.textContent = String(
    definition.description || "Built-in typed runtime node."
  );

  content.append(heading, id, description);

  const inputs = Array.isArray(definition.inputs)
    ? definition.inputs.map(nodeReferencePortText).filter(Boolean)
    : [];
  const outputs = Array.isArray(definition.outputs)
    ? definition.outputs.map(nodeReferencePortText).filter(Boolean)
    : [];

  if (inputs.length || outputs.length || definition.variadicInputs || definition.variadicOutputs) {
    const ports = document.createElement("div");
    ports.className = "information-node-ports";

    if (inputs.length) {
      const row = document.createElement("span");
      row.innerHTML = `<b>In</b> ${escapeHtml(inputs.join(" · "))}`;
      ports.appendChild(row);
    }
    if (outputs.length) {
      const row = document.createElement("span");
      row.innerHTML = `<b>Out</b> ${escapeHtml(outputs.join(" · "))}`;
      ports.appendChild(row);
    }
    if (definition.variadicInputs || definition.variadicOutputs) {
      const row = document.createElement("span");
      row.innerHTML = `<b>Dynamic</b> ${definition.variadicInputs ? "inputs" : "outputs"} can be extended in the Node Inspector.`;
      ports.appendChild(row);
    }
    content.appendChild(ports);
  }

  card.append(symbol, content);
  return card;
}

function appendInformationNodeSection(fragment, title, entries, options = {}) {
  if (!entries.length) {
    return;
  }

  const section = document.createElement("section");
  section.className = "information-node-group";
  if (options.advanced) {
    section.classList.add("information-node-group-advanced");
  }
  if (options.runtimeGenerated) {
    section.classList.add(
      "information-node-group-runtime-generated"
    );
  }

  const heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);

  if (options.description) {
    const note = document.createElement("p");
    note.className = "information-node-group-note";
    note.textContent = options.description;
    section.appendChild(note);
  }

  const grid = document.createElement("div");
  grid.className = "information-node-grid";

  entries
    .slice()
    .sort((left, right) =>
      String(left.definition.title || left.operatorId).localeCompare(
        String(right.definition.title || right.operatorId)
      )
    )
    .forEach(({ operatorId, definition }) => {
      grid.appendChild(informationNodeCard(operatorId, definition));
    });

  section.appendChild(grid);
  fragment.appendChild(section);
}

function renderInformationNodeReference() {
  const host = elements.informationNodeReference;
  const registry = window.RMLModNodeRegistry;

  if (!host) {
    return;
  }

  if (!registry || typeof registry.getNodeDefinitions !== "function") {
    host.innerHTML = `
      <p class="information-node-reference-status">
        The runtime node registry is still loading. The complete built-in node reference will appear automatically when the node library has initialized.
      </p>`;
    window.RMLBaseModNodesReady?.then?.(() => renderInformationNodeReference()).catch?.(() => {});
    return;
  }

  if (
    !informationBuiltInRegistryReady &&
    window.RMLBaseModNodesReady &&
    typeof window.RMLBaseModNodesReady.then === "function"
  ) {
    host.innerHTML = `
      <p class="information-node-reference-status">
        Loading every fixed built-in node before creating the complete reference…
      </p>`;
    if (!informationBuiltInRegistryWaitPromise) {
      informationBuiltInRegistryWaitPromise = Promise.resolve(
        window.RMLBaseModNodesReady
      )
        .then(() => {
          informationBuiltInRegistryReady = true;
          renderInformationNodeReference();
        })
        .catch(error => {
          informationBuiltInRegistryWaitPromise = null;
          console.error("The complete built-in Help node reference could not be initialized.", error);
        });
    }
    return;
  }

  const definitions = registry.getNodeDefinitions();
  const builtInEntries = Object.entries(definitions || {})
    .filter(([, definition]) =>
      definition &&
      typeof definition === "object" &&
      definition.catalogGenerated !== true &&
      definition.internalFamilyImplementation !== true
    )
    .map(([operatorId, definition]) => ({ operatorId, definition }));

  const standardEntries = builtInEntries.filter(
    entry => !informationNodeIsAdvanced(entry.definition)
  );
  const advancedEntries = builtInEntries.filter(
    entry => informationNodeIsAdvanced(entry.definition)
  );

  const standardGroups = new Map();
  for (const entry of standardEntries) {
    const group = String(entry.definition.group || "Other");
    if (!standardGroups.has(group)) {
      standardGroups.set(group, []);
    }
    standardGroups.get(group).push(entry);
  }

  const groupOrder = Array.isArray(window.RMLModNodeRegistryGroupOrder)
    ? window.RMLModNodeRegistryGroupOrder
    : [];
  const orderedStandardGroups = [...standardGroups.keys()].sort((left, right) => {
    const leftIndex = groupOrder.indexOf(left);
    const rightIndex = groupOrder.indexOf(right);
    if (leftIndex >= 0 || rightIndex >= 0) {
      if (leftIndex < 0) return 1;
      if (rightIndex < 0) return -1;
      return leftIndex - rightIndex;
    }
    return left.localeCompare(right);
  });

  const fragment = document.createDocumentFragment();

  const summary = document.createElement("section");
  summary.className = "information-node-reference-summary";
  summary.innerHTML = `
    <div>
      <strong>${builtInEntries.length + 1}</strong>
      <span>documented built-in nodes</span>
    </div>
    <div>
      <strong>${standardEntries.length + 1}</strong>
      <span>typed / normal</span>
    </div>
    <div class="advanced">
      <strong>${advancedEntries.length}</strong>
      <span>Advanced / Raw C#</span>
    </div>`;
  fragment.appendChild(summary);

  const standardIntro = document.createElement("div");
  standardIntro.className = "information-node-tier-note standard";
  standardIntro.innerHTML = `
    <strong>Typed / normal nodes</strong>
    <span>These are the preferred building blocks. They use the graph's typed sockets, compatibility checks and generated runtime helpers so invalid combinations are rejected wherever the builder can determine that safely.</span>`;
  fragment.appendChild(standardIntro);

  const configurationGroup = document.createElement("section");
  configurationGroup.className = "information-node-group";
  configurationGroup.innerHTML = `
    <h4>Configuration</h4>
    <div class="information-node-grid">
      <article class="information-node-card">
        <span class="information-node-symbol">◆</span>
        <div>
          <div class="information-node-card-heading"><strong>Configuration</strong></div>
          <small>Packed configuration source</small>
          <p>Publishes the typed RML configuration values. Stored sockets provide values; Startup and Saved variants can also emit impulses according to the configured runtime behavior.</p>
        </div>
      </article>
    </div>`;
  fragment.appendChild(configurationGroup);

  for (const groupName of orderedStandardGroups) {
    appendInformationNodeSection(
      fragment,
      groupName,
      standardGroups.get(groupName) || []
    );
  }

  const advancedIntro = document.createElement("div");
  advancedIntro.className = "information-node-tier-note advanced";
  advancedIntro.innerHTML = `
    <strong>Advanced / Raw C# — intentionally separate</strong>
    <span>Use these only when the typed node library cannot express the required behavior. They expose exact source, reflection, references, compiler/build settings or Harmony load-phase control. That flexibility also means the builder cannot guarantee the same type-safety, dependency safety or runtime correctness as it can for normal typed nodes.</span>`;
  fragment.appendChild(advancedIntro);

  const harmonySourceIds = new Set([
    "harmony.exactPatchSource",
    "harmony.earlyPatchSource"
  ]);
  const harmonySourceEntries = advancedEntries.filter(entry =>
    harmonySourceIds.has(entry.operatorId)
  );
  const customCSharpFileGraphEntries = advancedEntries.filter(entry =>
    entry.definition.customCSharpSyntaxNode === true ||
    entry.definition.customCSharpSubgraphOnly === true
  );
  const remainingAdvanced = advancedEntries.filter(entry =>
    !harmonySourceIds.has(entry.operatorId) &&
    !customCSharpFileGraphEntries.includes(entry)
  );

  appendInformationNodeSection(
    fragment,
    "Harmony source & load phase",
    harmonySourceEntries,
    {
      advanced: true,
      description:
        "These two nodes deliberately look similar but solve different load phases: Harmony Exact Patch Source is compiled into the normal rml_mods DLL and PatchAll is invoked from OnEngineInit; Early Harmony Patch Library creates a separate rml_libs DLL for patches that must exist before normal mods load. The early library cannot use graph sockets or generated main-mod state."
    }
  );

  appendInformationNodeSection(
    fragment,
    "Advanced · Custom C# File Graph Nodes",
    customCSharpFileGraphEntries,
    {
      advanced: true,
      description:
        "C# 14 syntax, Roslyn AST/token/trivia and file-output building blocks available exclusively inside the isolated graph of a Custom C# File node. They construct the file's complete source and do not appear in the normal Runtime Graph palette."
    }
  );

  appendInformationNodeSection(
    fragment,
    "Advanced / Raw C#",
    remainingAdvanced,
    {
      advanced: true,
      description:
        "Expert fallbacks for exact C#, reflection, manual dependency declarations and build/project overrides. They are documented even when a node is hidden from the normal palette."
    }
  );

  const catalogNote = document.createElement("div");
  catalogNote.className = "information-node-tier-note catalog";
  catalogNote.innerHTML = `
    <strong>Scanner catalog intentionally excluded</strong>
    <span>This Help list contains every fixed built-in node and no scanner-generated catalog nodes. Use Node Search for the version-derived Resonite, FrooxEngine and HarmonyLib API catalog.</span>`;
  fragment.appendChild(catalogNote);

  host.replaceChildren(fragment);
  window.RMLHelpNodeReferenceReport = Object.freeze({
    complete: true,
    catalogNodesIncluded: false,
    syntheticConfigurationNodes: 1,
    builtInNodeCount: builtInEntries.length,
    documentedNodeCount: builtInEntries.length + 1,
    operatorIds: Object.freeze(builtInEntries.map(entry => entry.operatorId).sort())
  });
}

function renderInformationOutlineNodeReference() {
  const host =
    elements.informationOutlineNodeReference;

  if (!host) {
    return;
  }

  const settingEntries =
    TYPE_DEFINITIONS.map(item => ({
      operatorId:
        `outline.${item.type}`,
      group: item.group,
      definition: {
        title: item.label,
        symbol: item.badge,
        description:
          outlineTypeDescription(
            item.type
          )
      }
    }));

  const structureEntries =
    OUTLINE_STRUCTURE_REFERENCE.map(
      item => ({
        operatorId:
          `outline.${item.type}`,
        definition: {
          title: item.label,
          symbol: item.badge,
          description:
            item.description
        }
      })
    );

  const dynamicEntries = [
    {
      operatorId:
        "outline.dynamicChoice",
      definition: {
        title:
          "Dynamic Choice (Runtime collection)",
        symbol: "DYN",
        description:
          "Runtime-generated choice control whose labels and stable values come from a Collect To List node marked Editable."
      }
    }
  ];

  const fragment =
    document.createDocumentFragment();

  const summary =
    document.createElement("section");
  summary.className =
    "information-node-reference-summary";
  summary.innerHTML = `
    <div>
      <strong>${settingEntries.length}</strong>
      <span>setting &amp; control nodes</span>
    </div>
    <div>
      <strong>${structureEntries.length}</strong>
      <span>structure nodes</span>
    </div>
    <div>
      <strong>${dynamicEntries.length}</strong>
      <span>runtime-generated control</span>
    </div>`;
  fragment.appendChild(summary);

  const intro =
    document.createElement("div");
  intro.className =
    "information-node-tier-note standard";
  intro.innerHTML = `
    <strong>Configuration Outline nodes</strong>
    <span>These nodes define the actual RML settings menu. Click to add to the active container or drag to choose an exact position. Properties configure keys, defaults, validation, visibility, reactions, Inline Row widths and labels.</span>`;
  fragment.appendChild(intro);

  for (const groupName of
    PALETTE_GROUP_NAMES.filter(
      name => name !== "Structure"
    )) {
    appendInformationNodeSection(
      fragment,
      groupName,
      settingEntries.filter(
        entry =>
          entry.group === groupName
      )
    );
  }

  appendInformationNodeSection(
    fragment,
    "Structure",
    structureEntries,
    {
      description:
        "Structure nodes own child items and therefore change nesting, page selection or same-row layout rather than storing a normal scalar value."
    }
  );

  const runtimeGeneratedIntro =
    document.createElement("div");
  runtimeGeneratedIntro.className =
    "information-node-tier-note runtime-generated";
  runtimeGeneratedIntro.innerHTML = `
    <strong>Runtime Graph → Configuration Outline</strong>
    <span>These green-marked controls are supplied by compatible Runtime Graph nodes. They bridge live graph collections into the Configuration Outline palette, but the builder never inserts them automatically. Add them deliberately where the runtime-created menu control should appear.</span>`;
  fragment.appendChild(runtimeGeneratedIntro);

  appendInformationNodeSection(
    fragment,
    "Runtime-generated Outline controls",
    dynamicEntries,
    {
      runtimeGenerated: true,
      description:
        "Available only while the required editable Runtime Graph output exists. Their values are populated at runtime and their placement, Inline Row width, label and visibility remain controlled by the Configuration Outline."
    }
  );

  host.replaceChildren(fragment);
}

let delayedButtonHelpTimer = 0;
let delayedButtonHelpTarget = null;
let delayedButtonHelpBubble = null;

function normalizeBuilderHelpTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const nativeTitle =
    target.getAttribute("title");

  if (nativeTitle) {
    target.dataset.help = nativeTitle;
    target.removeAttribute("title");
  }

  return target;
}

function buttonHelpText(target) {
  return String(
    target?.dataset?.help ||
    target?.getAttribute?.("aria-label") ||
    target?.textContent ||
    ""
  ).replace(/\s+/g, " ").trim();
}

function builderHelpTone(target) {
  const explicitTone =
    target?.dataset?.helpTone;

  if (
    ["warning", "danger", "info", "runtime"].includes(
      explicitTone
    )
  ) {
    return explicitTone;
  }

  const text =
    buttonHelpText(target);

  if (
    target?.classList?.contains("danger") ||
    /\b(delete|remove|clear|discard)\b/i.test(text)
  ) {
    return "danger";
  }

  if (
    /\b(replace|overwrite|example|reset)\b/i.test(text)
  ) {
    return "warning";
  }

  return "info";
}

function builderHelpKicker(target) {
  const explicitKicker =
    String(
      target?.dataset?.helpKicker ||
      ""
    ).trim();

  if (explicitKicker) {
    return explicitKicker;
  }

  if (
    target?.matches?.(
      ".rml-graph-socket, [data-socket], [data-port]"
    )
  ) {
    return "Node signal";
  }

  if (
    target?.matches?.(
      "input, select, textarea"
    )
  ) {
    return "Field tip";
  }

  return "Control tip";
}

function hideDelayedButtonHelp() {
  window.clearTimeout(delayedButtonHelpTimer);
  delayedButtonHelpTimer = 0;
  delayedButtonHelpTarget = null;
  delayedButtonHelpBubble?.remove();
  delayedButtonHelpBubble = null;
}

function showDelayedButtonHelp(target) {
  const text = buttonHelpText(target);
  if (!text || !target?.isConnected) {
    return;
  }

  hideDelayedButtonHelp();

  const bubble = document.createElement("div");
  bubble.className = "rml-button-help-bubble";
  bubble.dataset.tone =
    builderHelpTone(target);
  bubble.setAttribute("role", "tooltip");

  const icon = document.createElement("span");
  icon.className = "rml-help-bubble-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent =
    bubble.dataset.tone === "danger"
      ? "!"
      : bubble.dataset.tone === "warning"
        ? "△"
        : "i";

  const copy = document.createElement("span");
  copy.className = "rml-help-bubble-copy";

  const kicker = document.createElement("small");
  kicker.className = "rml-help-bubble-kicker";
  kicker.textContent =
    builderHelpKicker(target);

  const content = document.createElement("span");
  content.className = "rml-help-bubble-text";
  content.textContent = text;

  copy.append(kicker, content);
  bubble.append(icon, copy);
  document.body.appendChild(bubble);

  const rect = target.getBoundingClientRect();
  const bubbleRect = bubble.getBoundingClientRect();
  const gap = 9;
  const left = Math.min(
    window.innerWidth - bubbleRect.width - 8,
    Math.max(8, rect.left + rect.width / 2 - bubbleRect.width / 2)
  );
  let top = rect.bottom + gap;
  if (top + bubbleRect.height > window.innerHeight - 8) {
    top = Math.max(8, rect.top - bubbleRect.height - gap);
  }

  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
  delayedButtonHelpBubble = bubble;
}

function scheduleDelayedButtonHelp(target, delay = 620) {
  hideDelayedButtonHelp();
  delayedButtonHelpTarget = target;
  delayedButtonHelpTimer = window.setTimeout(() => {
    if (delayedButtonHelpTarget === target) {
      showDelayedButtonHelp(target);
    }
  }, delay);
}

function installDelayedButtonHelp() {
  const targetSelector =
    "button, [data-help], [title]";

  document
    .querySelectorAll("[title]")
    .forEach(normalizeBuilderHelpTarget);

  document.addEventListener("pointerover", event => {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }

    const target =
      normalizeBuilderHelpTarget(
        event.target.closest?.(
          targetSelector
        )
      );

    if (
      !target ||
      (target instanceof HTMLButtonElement &&
        target.disabled)
    ) {
      return;
    }

    if (target.contains(event.relatedTarget)) {
      return;
    }

    scheduleDelayedButtonHelp(target);
  });

  document.addEventListener("pointerout", event => {
    const target =
      event.target.closest?.(
        "button, [data-help]"
      );

    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.contains(event.relatedTarget)) {
      return;
    }

    hideDelayedButtonHelp();
  });

  document.addEventListener("focusin", event => {
    const target =
      normalizeBuilderHelpTarget(
        event.target.closest?.(
          targetSelector
        )
      );

    if (target) {
      scheduleDelayedButtonHelp(
        target,
        180
      );
    }
  });

  document.addEventListener(
    "focusout",
    hideDelayedButtonHelp
  );

  document.addEventListener("pointerdown", hideDelayedButtonHelp, true);
  document.addEventListener("scroll", hideDelayedButtonHelp, true);
  window.addEventListener("blur", hideDelayedButtonHelp);
}

function setInformationNodeScope(
  scopeName,
  resetScroll = false
) {
  const dialog =
    elements.informationDialog;

  if (!dialog) {
    return;
  }

  const targetScope =
    scopeName === "runtime"
      ? "runtime"
      : "outline";

  dialog.dataset.informationNodeScope =
    targetScope;

  dialog
    .querySelectorAll(
      "[data-information-node-scope-target]"
    )
    .forEach(button => {
      const active =
        button.dataset
          .informationNodeScopeTarget ===
        targetScope;
      button.classList.toggle(
        "active",
        active
      );
      button.setAttribute(
        "aria-selected",
        String(active)
      );
    });

  dialog
    .querySelectorAll(
      "[data-information-node-scope-copy]"
    )
    .forEach(copy => {
      copy.hidden =
        copy.dataset
          .informationNodeScopeCopy !==
        targetScope;
    });

  dialog
    .querySelectorAll(
      "[data-information-node-scope-panel]"
    )
    .forEach(panel => {
      const active =
        panel.dataset
          .informationNodeScopePanel ===
        targetScope;
      panel.hidden = !active;

      if (active && resetScroll) {
        panel.scrollTo({
          top: 0,
          left: panel.scrollLeft,
          behavior: "smooth"
        });
      }
    });

  if (targetScope === "runtime") {
    renderInformationNodeReference();
  } else {
    renderInformationOutlineNodeReference();
  }
}

function setInformationPage(pageName) {
  const dialog = elements.informationDialog;
  if (!dialog) {
    return;
  }

  const targetName = ["general", "technical", "shortcuts", "nodes"].includes(pageName)
    ? pageName
    : "general";

  dialog.querySelectorAll("[data-information-page]").forEach(page => {
    const active = page.dataset.informationPage === targetName;
    page.hidden = !active;
    page.classList.toggle("active", active);
  });

  dialog.querySelectorAll("[data-information-page-target]").forEach(button => {
    const active = button.dataset.informationPageTarget === targetName;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  const activeContent = dialog.querySelector(
    `[data-information-page="${targetName}"] .information-content, ` +
    `[data-information-page="${targetName}"] .information-node-page-content`
  );

  if (activeContent) {
    activeContent.scrollTo({
      top: 0,
      left: activeContent.scrollLeft,
      behavior: "smooth"
    });
  }

  if (targetName === "nodes") {
    setInformationNodeScope("runtime", true);
  }
}

function loadLazyTemplateScript(fileName, marker, globalName) {
  if (typeof window[globalName] === "string") {
    return Promise.resolve(window[globalName]);
  }

  return new Promise((resolve, reject) => {
    const attribute = `data-rml-${marker}`;
    let script = document.querySelector(`script[${attribute}="true"]`);

    const finish = () => {
      const markup = window[globalName];
      if (typeof markup === "string") {
        resolve(markup);
      } else {
        reject(new Error(`${fileName} loaded without exposing ${globalName}.`));
      }
    };

    if (script) {
      if (script.dataset.loaded === "true") {
        finish();
        return;
      }
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => reject(new Error(`${fileName} could not be loaded.`)), { once: true });
      return;
    }

    script = document.createElement("script");
    script.src = new URL(fileName, APP_SCRIPT_BASE_URL).href;
    script.async = true;
    script.setAttribute(attribute, "true");
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      finish();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`${fileName} could not be loaded.`)), { once: true });
    document.body.appendChild(script);
  });
}

function loadLazyHtmlTemplate(htmlFileName, jsFileName, marker, globalName) {
  if (window.location.protocol === "file:") {
    return loadLazyTemplateScript(jsFileName, marker, globalName);
  }

  return fetch(
    new URL(htmlFileName, APP_SCRIPT_BASE_URL).href,
    { cache: "no-store" }
  )
    .then(response => {
      if (!response.ok) {
        throw new Error(`${htmlFileName}: ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
    .catch(() =>
      loadLazyTemplateScript(jsFileName, marker, globalName)
    );
}

async function ensureInformationDialogLoaded() {
  if (elements.informationDialog?.isConnected) {
    return elements.informationDialog;
  }

  if (informationTemplateLoadPromise) {
    return informationTemplateLoadPromise;
  }

  informationTemplateLoadPromise = loadLazyHtmlTemplate(
    "help_template.html?v=62-section-buttons-v603f13",
    "help_template.js?v=62-section-buttons-v603f13",
    "help-template",
    "RMLHelpTemplateMarkup"
  )
    .then(markup => {
      const host = document.getElementById("lazy-dialog-host") || document.body;
      host.insertAdjacentHTML("beforeend", markup);
      elements.informationDialog = document.getElementById("information-dialog");
      elements.informationClose = document.getElementById("information-close");
      elements.informationNodeReference = document.getElementById("information-node-reference");
      elements.informationOutlineNodeReference = document.getElementById(
        "information-outline-node-reference"
      );
      const nodeReferenceIntro = elements.informationDialog?.querySelector(
        ".information-node-page-intro .information-api-note"
      );
      if (nodeReferenceIntro) {
        nodeReferenceIntro.textContent =
          "This Help list documents every fixed built-in node and intentionally contains no scanner-generated catalog nodes. Use Node Search for the version-derived Resonite, FrooxEngine and HarmonyLib API catalog.";
      }
      bindInformationDialogEvents();
      return elements.informationDialog;
    })
    .catch(error => {
      informationTemplateLoadPromise = null;
      console.error("Help could not be loaded.", error);
      throw error;
    });

  return informationTemplateLoadPromise;
}

function bindInformationDialogEvents() {
  const dialog = elements.informationDialog;
  if (!dialog || dialog.dataset.bound === "true") {
    return;
  }
  dialog.dataset.bound = "true";
  elements.informationClose?.addEventListener("click", closeInformationDialog);
  dialog.addEventListener("click", event => {
    const sectionButton = event.target.closest(
      ".information-nav [data-information-section-target]"
    );
    if (sectionButton) {
      const targetId =
        sectionButton.dataset
          .informationSectionTarget || "";
      const page = sectionButton.closest(
        "[data-information-page]"
      );
      const content = page?.querySelector(
        ".information-content"
      );
      const section = targetId
        ? page?.querySelector(
            `#${CSS.escape(targetId)}`
          )
        : null;

      if (content && section) {
        const contentRect =
          content.getBoundingClientRect();
        const sectionRect =
          section.getBoundingClientRect();

        content.scrollTo({
          top:
            content.scrollTop +
            sectionRect.top -
            contentRect.top,
          left: content.scrollLeft,
          behavior: "smooth"
        });
      }
      return;
    }

    const scopeButton = event.target.closest(
      "[data-information-node-scope-target]"
    );
    if (scopeButton) {
      setInformationNodeScope(
        scopeButton.dataset
          .informationNodeScopeTarget,
        true
      );
      return;
    }

    const pageButton = event.target.closest("[data-information-page-target]");
    if (pageButton) {
      setInformationPage(pageButton.dataset.informationPageTarget);
      return;
    }
    if (event.target === dialog) {
      closeInformationDialog();
    }
  });
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    closeInformationDialog();
  });
}

async function openInformationDialog() {
  const workSession = beginBuilderWork({
    kicker: "Help",
    title: "Preparing documentation…",
    message:
      "The help template and node references are being loaded before the dialog opens.",
    detail:
      "The dialog will open automatically when its content is ready.",
    progress: 35
  });

  try {
    await paintBuilderUi();
    const dialog =
      await ensureInformationDialogLoaded();
    setInformationPage("general");

    updateBuilderWork(
      workSession,
      {
        title: "Documentation ready",
        message:
          "Opening the complete Help dialog…",
        progress: 100
      }
    );
    await paintBuilderUi();
    finishBuilderWork(workSession);

    if (!dialog?.open) {
      dialog.showModal();
    }

    try {
      dialog.focus({ preventScroll: true });
    } catch {
      dialog.focus();
    }
  } catch (error) {
    finishBuilderWork(workSession);
    console.error(
      "Information dialog preparation failed.",
      error
    );
    void showBuilderNotice({
      tone: "warning",
      kicker: "Help unavailable",
      title: "The Help dialog could not be opened",
      message:
        error instanceof Error
          ? error.message
          : String(error),
      details:
        "The builder itself remains available.",
      confirmLabel: "OK"
    });
  }
}

function closeInformationDialog() {
  if (elements.informationDialog?.open) {
    elements.informationDialog.close();
  }
}

function setupAssistantCompleted() {
  try {
    return window.localStorage?.getItem(ACTIVE_SETUP_ASSISTANT_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function ensureSetupAssistantLoaded(firstRun = false) {
  if (firstRun && setupAssistantCompleted()) {
    return Promise.resolve(false);
  }

  if (window.RMLBuilderSetupAssistant?.start) {
    window.RMLBuilderSetupAssistant.start({ firstRun });
    return Promise.resolve(true);
  }

  if (setupAssistantLoadPromise) {
    return setupAssistantLoadPromise.then(() => {
      window.RMLBuilderSetupAssistant?.start?.({ firstRun });
      return true;
    });
  }

  setupAssistantLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("setup_assistant.js?v=192-complete-legacy-api-reconciliation-v401f1", APP_SCRIPT_BASE_URL).href;
    script.async = true;
    script.dataset.rmlSetupAssistant = "true";
    script.addEventListener("load", () => resolve(true), { once: true });
    script.addEventListener("error", () => {
      setupAssistantLoadPromise = null;
      reject(new Error("setup_assistant.js could not be loaded."));
    }, { once: true });
    document.body.appendChild(script);
  });

  return setupAssistantLoadPromise
    .then(() => {
      window.RMLBuilderSetupAssistant?.start?.({ firstRun });
      return true;
    })
    .catch(error => {
      console.warn("Guided tour could not be loaded.", error);
      return false;
    });
}

function installSetupAssistantBridge() {
  if (window.RMLBuilderSetupBridge) {
    return;
  }

  Object.defineProperty(window, "RMLBuilderSetupBridge", {
    value: Object.freeze({
      capture() {
        return clone({
          metadata: state.metadata,
          exportOptions: state.exportOptions,
          nodes: state.nodes,
          extensions: state.extensions,
          selectedId: state.selectedId,
          activeContainerId: state.activeContainerId,
          collapsedPaletteGroups: state.collapsedPaletteGroups
        });
      },
      restore(snapshot) {
        if (!snapshot || typeof snapshot !== "object") return;
        state.metadata = clone(snapshot.metadata || DEFAULT_METADATA);
        state.exportOptions = clone(snapshot.exportOptions || DEFAULT_EXPORT_OPTIONS);
        state.nodes = normalizeNodes(clone(snapshot.nodes || []));
        state.extensions = clone(snapshot.extensions || {});
        state.selectedId = snapshot.selectedId || null;
        state.activeContainerId = snapshot.activeContainerId || ROOT_CONTAINER;
        state.collapsedPaletteGroups = clone(snapshot.collapsedPaletteGroups || []);
        renderMetadata();
        renderPalette();
        renderAll();
        persist();
      },
      prepareTourDemo() {
        const nested = makeController();
        nested.fieldName = "DetailSection";
        nested.keyName = "detail_section";
        nested.enumName = "DetailSectionPage";
        nested.options[0].name = "Visual";
        nested.options[1].name = "Behavior";
        nested.defaultOption = "Visual";
        nested.options[0].children = [makeSetting("colorX")];
        nested.options[0].children[0].fieldName = "Tint";
        nested.options[0].children[0].keyName = "tint";
        nested.options[1].children = [makeSetting("bool")];
        nested.options[1].children[0].fieldName = "Interactable";
        nested.options[1].children[0].keyName = "interactable";

        const controller = makeController();
        controller.fieldName = "DisplayMode";
        controller.keyName = "display_mode";
        controller.enumName = "DisplayModePage";
        controller.options[0].name = "General";
        controller.options[1].name = "Advanced";
        controller.defaultOption = "General";

        const enabled = makeSetting("bool");
        enabled.fieldName = "Enabled";
        enabled.keyName = "enabled";
        enabled.reaction = "startup-saved";

        const scale = makeSetting("float");
        scale.fieldName = "Scale";
        scale.keyName = "scale";
        scale.defaultValue = "1";
        scale.validatorMode = "range";
        scale.useSlider = true;
        scale.minimum = "0.1";
        scale.maximum = "10";

        const quality = makeSetting("enum");
        quality.fieldName = "Quality";
        quality.keyName = "quality";
        quality.enumName = "QualityOption";
        quality.enumOptions = ["Low", "Medium", "High"];
        quality.defaultValue = "Medium";

        controller.options[0].children = [enabled, scale];
        controller.options[1].children = [quality, nested];

        const resource = makeSetting("Uri");
        resource.fieldName = "ResourceUri";
        resource.keyName = "resource_uri";

        const actionButton = makeSetting("button");
        actionButton.fieldName = "ApplyPreset";
        actionButton.keyName = "apply_preset";
        actionButton.description =
          "Applies the currently selected runtime preset.";
        actionButton.buttonLabel = "Apply preset";

        state.nodes = [controller, resource, actionButton];
        state.selectedId = enabled.id;
        state.activeContainerId = controller.options[0].id;
        state.collapsedPaletteGroups = [];
        state.extensions = {};
        flattenedNodesCacheSource = null;
        renderPalette();
        renderAll();
      },
      ensureTourOutlineVerticalRange(minimumRange = 180) {
        const requested = Math.max(80, Number(minimumRange) || 180);
        const scroller = document.scrollingElement || document.documentElement;
        const helperIds = [];
        const currentRange = () => Math.max(
          0,
          (scroller?.scrollHeight || 0) - (scroller?.clientHeight || 0)
        );

        for (
          let index = 0;
          currentRange() < requested && index < 14;
          index += 1
        ) {
          const helper = makeSetting("string");
          helper.fieldName = `TourScrollAnchor${index + 1}`;
          helper.keyName = `tour_scroll_anchor_${index + 1}`;
          helper.description = "Temporary guided-tour scroll anchor";
          helper.__rmlTourScrollHelper = true;
          state.nodes.push(helper);
          helperIds.push(helper.id);
          renderAll();
        }

        return {
          ok: currentRange() >= Math.min(requested, 80),
          helperIds,
          range: currentRange()
        };
      },
      removeTourOutlineVerticalRange(helperIds = []) {
        const ids = new Set(
          Array.isArray(helperIds) ? helperIds.filter(Boolean) : []
        );
        if (ids.size === 0) {
          return { ok: true, removed: 0 };
        }
        const before = state.nodes.length;
        state.nodes = state.nodes.filter(node => !ids.has(node.id));
        if (state.selectedId && ids.has(state.selectedId)) {
          state.selectedId = state.nodes[0]?.id || null;
        }
        flattenedNodesCacheSource = null;
        renderAll();
        return {
          ok: true,
          removed: before - state.nodes.length
        };
      },
      armHeldOptionHorizontal(
        host,
        clientX,
        clientY
      ) {
        if (
          !optionPointerDragActive ||
          !activeDraggedOptionId ||
          !activeDraggedOptionControllerId ||
          !(host instanceof HTMLElement) ||
          !host.isConnected
        ) {
          return {
            accepted: false,
            index: null,
            maximumIndex: 0,
            reason: "No live held option drag is active."
          };
        }

        const controllerCard = host.closest(
          ".node-card.controller[data-node-id]"
        );
        const controllerId =
          controllerCard?.dataset.nodeId || "";

        if (!controllerId) {
          return {
            accepted: false,
            index: null,
            maximumIndex: 0,
            reason: "The live controller could not be resolved."
          };
        }

        const feedbackEvent = {
          clientX: Number.isFinite(clientX)
            ? clientX
            : host.getBoundingClientRect().left,
          clientY: Number.isFinite(clientY)
            ? clientY
            : host.getBoundingClientRect().top,
          dataTransfer: { dropEffect: "move" },
          preventDefault() {},
          stopPropagation() {}
        };

        setOptionInsertFeedback(
          controllerId,
          host,
          feedbackEvent
        );

        const accepted =
          optionWheelTargetHost === host &&
          optionWheelTargetControllerId === controllerId &&
          state.dragInsertContainer ===
            `controller:${controllerId}` &&
          Number.isFinite(state.dragInsertIndex) &&
          optionDragFeedbackPlaceholder?.isConnected === true;

        return {
          accepted,
          index: accepted ? state.dragInsertIndex : null,
          maximumIndex: directOptionLanes(host).length,
          reason: accepted
            ? ""
            : "The native horizontal insertion target rejected the held option."
        };
      },
      setHeldOptionHorizontalIndex(
        host,
        requestedIndex
      ) {
        if (
          !optionPointerDragActive ||
          !activeDraggedOptionId ||
          !activeDraggedOptionControllerId ||
          !(host instanceof HTMLElement) ||
          !host.isConnected
        ) {
          return {
            accepted: false,
            beforeIndex: null,
            afterIndex: null,
            reason: "No live held option drag is active."
          };
        }

        const controllerCard = host.closest(
          ".node-card.controller[data-node-id]"
        );
        const controllerId = controllerCard?.dataset.nodeId || "";
        if (!controllerId) {
          return {
            accepted: false,
            beforeIndex: null,
            afterIndex: null,
            reason: "The live controller could not be resolved."
          };
        }

        const maximumIndex = directOptionLanes(host).length;
        const numericIndex = Number(requestedIndex);
        if (!Number.isFinite(numericIndex)) {
          return {
            accepted: false,
            beforeIndex: null,
            afterIndex: null,
            maximumIndex,
            reason: "The requested horizontal insertion index is invalid."
          };
        }

        const beforeIndex =
          state.dragInsertContainer === `controller:${controllerId}` &&
          Number.isFinite(state.dragInsertIndex)
            ? state.dragInsertIndex
            : null;
        const afterIndex = clamp(
          Math.trunc(numericIndex),
          0,
          maximumIndex
        );
        const placeholder = ensureOptionDragPlaceholder();

        if (optionPointerVisualFrame) {
          cancelAnimationFrame(optionPointerVisualFrame);
          optionPointerVisualFrame = 0;
        }
        optionPointerQueuedX = optionPointerX;
        optionPointerQueuedY = optionPointerY;

        optionContainerWheelTargetHost = null;
        optionContainerWheelTargetContainerId = null;
        optionContainerWheelDelta = 0;
        optionContainerWheelManualIndex = null;
        optionContainerWheelManualHost = null;
        optionWheelTargetHost = host;
        optionWheelTargetControllerId = controllerId;
        optionWheelDelta = 0;
        optionWheelManualHost = host;
        optionWheelManualIndex = afterIndex;
        state.dragInsertContainer = `controller:${controllerId}`;
        state.dragInsertIndex = afterIndex;

        document.querySelectorAll(
          ".controller-options.option-drag-over"
        ).forEach(currentHost => {
          if (currentHost !== host) {
            currentHost.classList.remove("option-drag-over");
          }
        });
        host.classList.add("option-drag-over");
        if (placeholder.parentElement !== host) {
          host.appendChild(placeholder);
        }
        positionOptionInsertPlaceholder(host, afterIndex);
        requestDragPlaceholderVisibility();

        const accepted = Boolean(
          optionWheelTargetHost === host &&
          optionWheelTargetControllerId === controllerId &&
          state.dragInsertContainer === `controller:${controllerId}` &&
          state.dragInsertIndex === afterIndex &&
          optionDragFeedbackPlaceholder?.isConnected === true
        );
        return {
          accepted,
          beforeIndex,
          afterIndex: accepted ? afterIndex : null,
          maximumIndex,
          moved: accepted && beforeIndex !== afterIndex,
          authoritative:
            accepted && heldOptionWheelTargetIsAuthoritative(),
          reason: accepted
            ? ""
            : "The exact native horizontal insertion index was not retained."
        };
      },
      stepHeldOptionHorizontal(
        host,
        direction,
        clientX,
        clientY
      ) {
        const normalizedDirection =
          Math.sign(Number(direction) || 0);

        if (
          !optionPointerDragActive ||
          !activeDraggedOptionId ||
          !activeDraggedOptionControllerId ||
          !(host instanceof HTMLElement) ||
          !host.isConnected ||
          normalizedDirection === 0
        ) {
          return {
            accepted: false,
            moved: false,
            reason: "No live held option drag is active."
          };
        }

        const controllerCard = host.closest(
          ".node-card.controller[data-node-id]"
        );
        const controllerId =
          controllerCard?.dataset.nodeId || "";

        if (!controllerId) {
          return {
            accepted: false,
            moved: false,
            reason: "The live controller could not be resolved."
          };
        }

        const markerBeforeFeedback =
          optionDragFeedbackPlaceholder;
        const anchoredTop =
          markerBeforeFeedback?.style.getPropertyValue(
            "--rml-setup-option-anchor-top"
          ) ||
          markerBeforeFeedback?.style.getPropertyValue(
            "--option-placeholder-top"
          ) ||
          "";
        const anchoredHeight =
          markerBeforeFeedback?.style.getPropertyValue(
            "--rml-setup-option-anchor-height"
          ) ||
          markerBeforeFeedback?.style.getPropertyValue(
            "--option-placeholder-height"
          ) ||
          "";
        if (markerBeforeFeedback?.isConnected) {
          if (anchoredTop) {
            markerBeforeFeedback.style.setProperty(
              "--rml-setup-option-anchor-top",
              anchoredTop
            );
          }
          if (anchoredHeight) {
            markerBeforeFeedback.style.setProperty(
              "--rml-setup-option-anchor-height",
              anchoredHeight
            );
          }
        }

        let accepted =
          optionWheelTargetHost === host &&
          optionWheelTargetControllerId === controllerId &&
          state.dragInsertContainer ===
            `controller:${controllerId}` &&
          Number.isFinite(state.dragInsertIndex);

        if (!accepted) {
          const feedbackEvent = {
            clientX: Number.isFinite(clientX)
              ? clientX
              : host.getBoundingClientRect().left,
            clientY: Number.isFinite(clientY)
              ? clientY
              : host.getBoundingClientRect().top,
            dataTransfer: { dropEffect: "move" },
            preventDefault() {},
            stopPropagation() {}
          };
          setOptionInsertFeedback(
            controllerId,
            host,
            feedbackEvent
          );
          accepted =
            optionWheelTargetHost === host &&
            optionWheelTargetControllerId === controllerId &&
            state.dragInsertContainer ===
              `controller:${controllerId}` &&
            Number.isFinite(state.dragInsertIndex);
        }

        if (!accepted) {
          return {
            accepted: false,
            moved: false,
            reason: "The native horizontal insertion target rejected the held option."
          };
        }

        const marker =
          optionDragFeedbackPlaceholder;
        const beforeIndex = state.dragInsertIndex;

        stepOptionInsertWithWheel(
          controllerId,
          host,
          normalizedDirection
        );
        if (marker?.isConnected) {
          if (anchoredTop) {
            marker.style.setProperty(
              "--option-placeholder-top",
              anchoredTop
            );
            marker.style.setProperty(
              "--rml-setup-option-anchor-top",
              anchoredTop
            );
          }
          if (anchoredHeight) {
            marker.style.setProperty(
              "--option-placeholder-height",
              anchoredHeight
            );
            marker.style.setProperty(
              "--rml-setup-option-anchor-height",
              anchoredHeight
            );
          }
        }
        requestDragPlaceholderVisibility();

        const afterIndex = state.dragInsertIndex;

        return {
          accepted: true,
          moved: afterIndex !== beforeIndex,
          beforeIndex,
          afterIndex,
          maximumIndex: directOptionLanes(host).length
        };
      },
      inspectHeldOptionHorizontal(host) {
        if (
          !optionPointerDragActive ||
          !activeDraggedOptionId ||
          !(host instanceof HTMLElement) ||
          optionWheelTargetHost !== host ||
          !optionWheelTargetControllerId ||
          state.dragInsertContainer !==
            `controller:${optionWheelTargetControllerId}` ||
          !Number.isFinite(state.dragInsertIndex)
        ) {
          return {
            accepted: false,
            index: null,
            maximumIndex: 0
          };
        }

        return {
          accepted: true,
          index: state.dragInsertIndex,
          maximumIndex: directOptionLanes(host).length
        };
      },
      armHeldOptionContainer(
        host,
        clientX,
        clientY
      ) {
        if (
          !optionPointerDragActive ||
          !activeDraggedOptionId ||
          !activeDraggedOptionControllerId ||
          !(host instanceof HTMLElement) ||
          !host.isConnected
        ) {
          return {
            accepted: false,
            index: null,
            maximumIndex: 0,
            reason: "No live held option drag is active."
          };
        }

        const lane = host.closest(
          OUTLINE_CONTAINER_LANE_SELECTOR
        );
        const containerId = lane?.dataset.container || "";
        const authoritativeHost = lane?.querySelector(
          ":scope > .drop-zone"
        );
        const source = findControllerOption(
          state.nodes,
          activeDraggedOptionId
        );

        if (
          !containerId ||
          authoritativeHost !== host ||
          !source ||
          optionContainsContainer(
            source.option,
            containerId
          )
        ) {
          return {
            accepted: false,
            index: null,
            maximumIndex: directNodeCards(host).length,
            reason: "The live nested container rejected the held option."
          };
        }

        const cards = directNodeCards(host);
        const pointX = Number.isFinite(clientX)
          ? clientX
          : host.getBoundingClientRect().left + 8;
        const pointY = Number.isFinite(clientY)
          ? clientY
          : host.getBoundingClientRect().top + 8;
        const insertionIndex = nodeInsertionIndexAtPoint(
          host,
          cards,
          pointX,
          pointY
        );
        const feedbackEvent = {
          clientX: pointX,
          clientY: pointY,
          dataTransfer: { dropEffect: "move" },
          preventDefault() {},
          stopPropagation() {}
        };

        setPointerContainerTarget(
          containerId,
          host,
          insertionIndex,
          feedbackEvent
        );
        requestDragPlaceholderVisibility();

        const accepted =
          optionContainerWheelTargetHost === host &&
          optionContainerWheelTargetContainerId === containerId &&
          state.dragInsertContainer === containerId &&
          Number.isFinite(state.dragInsertIndex) &&
          dragFeedbackPlaceholder?.isConnected === true;

        return {
          accepted,
          index: accepted ? state.dragInsertIndex : null,
          maximumIndex: cards.length,
          containerId,
          reason: accepted
            ? ""
            : "The native nested insertion target rejected the held option."
        };
      },
      setHeldOptionContainerIndex(
        host,
        requestedIndex
      ) {
        if (
          !optionPointerDragActive ||
          !activeDraggedOptionId ||
          !activeDraggedOptionControllerId ||
          !(host instanceof HTMLElement) ||
          !host.isConnected
        ) {
          return {
            accepted: false,
            beforeIndex: null,
            afterIndex: null,
            authoritative: false,
            reason: "No live held option drag is active."
          };
        }

        const lane = host.closest(
          OUTLINE_CONTAINER_LANE_SELECTOR
        );
        const containerId = lane?.dataset.container || "";
        const authoritativeHost = lane?.querySelector(
          ":scope > .drop-zone"
        );
        const source = findControllerOption(
          state.nodes,
          activeDraggedOptionId
        );
        const maximumIndex = directNodeCards(host).length;
        const numericIndex = Number(requestedIndex);

        if (
          !containerId ||
          authoritativeHost !== host ||
          !source ||
          optionContainsContainer(source.option, containerId) ||
          !Number.isFinite(numericIndex)
        ) {
          return {
            accepted: false,
            beforeIndex: null,
            afterIndex: null,
            maximumIndex,
            authoritative: false,
            reason: "The exact nested insertion target was invalid."
          };
        }

        const beforeIndex =
          state.dragInsertContainer === containerId &&
          Number.isFinite(state.dragInsertIndex)
            ? state.dragInsertIndex
            : null;
        const afterIndex = clamp(
          Math.trunc(numericIndex),
          0,
          maximumIndex
        );

        if (optionPointerVisualFrame) {
          cancelAnimationFrame(optionPointerVisualFrame);
          optionPointerVisualFrame = 0;
        }
        optionPointerQueuedX = optionPointerX;
        optionPointerQueuedY = optionPointerY;

        setPointerContainerTarget(
          containerId,
          host,
          afterIndex,
          pointerOptionFeedbackEvent(
            optionPointerX,
            optionPointerY
          )
        );
        optionContainerWheelDelta = 0;
        optionContainerWheelManualHost = host;
        optionContainerWheelManualIndex = afterIndex;
        state.dragOverContainer = containerId;
        state.dragInsertContainer = containerId;
        state.dragInsertIndex = afterIndex;
        positionNodeInsertPlaceholder(host, afterIndex);
        requestDragPlaceholderVisibility();

        const accepted = Boolean(
          optionContainerWheelTargetHost === host &&
          optionContainerWheelTargetContainerId === containerId &&
          optionContainerWheelManualHost === host &&
          optionContainerWheelManualIndex === afterIndex &&
          state.dragInsertContainer === containerId &&
          state.dragInsertIndex === afterIndex &&
          dragFeedbackPlaceholder?.isConnected === true
        );
        return {
          accepted,
          beforeIndex,
          afterIndex: accepted ? afterIndex : null,
          maximumIndex,
          moved: accepted && beforeIndex !== afterIndex,
          authoritative: accepted,
          containerId,
          reason: accepted
            ? ""
            : "The exact native nested insertion index was not retained."
        };
      },
      inspectHeldOptionContainer(host) {
        const accepted =
          optionPointerDragActive &&
          activeDraggedOptionId &&
          host instanceof HTMLElement &&
          optionContainerWheelTargetHost === host &&
          optionContainerWheelTargetContainerId &&
          state.dragInsertContainer ===
            optionContainerWheelTargetContainerId &&
          Number.isFinite(state.dragInsertIndex);

        return {
          accepted: Boolean(accepted),
          index: accepted ? state.dragInsertIndex : null,
          maximumIndex: directNodeCards(host).length,
          containerId: accepted
            ? optionContainerWheelTargetContainerId
            : ""
        };
      },
      markComplete() {
        try {
          window.localStorage?.setItem(ACTIVE_SETUP_ASSISTANT_STORAGE_KEY, "true");
        } catch {}
      }
    }),
    writable: false,
    configurable: true
  });
}

function cacheElements() {
  Object.assign(elements, {
    workspaceRestoreState: document.getElementById(
      "workspace-restore-state"
    ),
    paletteContent: document.getElementById("palette-content"),
    itemCount: document.getElementById("item-count"),
    builderCanvas: document.getElementById("builder-canvas"),
    activeContainerName: document.getElementById("active-container-name"),
    inspectorContent: document.getElementById("inspector-content"),
    includeGuide: document.getElementById("include-guide"),
    generatedCode: document.getElementById("generated-code"),
    generatedCodeTitle: document.getElementById(
      "generated-code-title"
    ),
    generatedFileSwitcher: document.getElementById(
      "generated-file-switcher"
    ),
    generatedFileSelect: document.getElementById(
      "generated-file-select"
    ),
    diagnostics: document.getElementById("diagnostics"),
    codeSummary: document.getElementById("code-summary"),
    copyCodeBottom: document.getElementById("copy-code-bottom"),
    downloadCode: document.getElementById("download-code"),
    topMenuToggle: document.getElementById("top-menu-toggle"),
    topActions: document.getElementById("top-actions"),
    informationOpen: document.getElementById("information-open"),
    setupGuideOpen: document.getElementById("setup-guide-open"),
    informationDialog: document.getElementById("information-dialog"),
    informationClose: document.getElementById("information-close"),
    informationNodeReference: document.getElementById("information-node-reference"),
    informationOutlineNodeReference: document.getElementById(
      "information-outline-node-reference"
    ),
    settingsPreviewOpen: document.getElementById("preview-open"),
    settingsPreviewDialog: document.getElementById(
      "settings-preview-dialog"
    ),
    settingsPreviewTitle: document.getElementById(
      "settings-preview-title"
    ),
    settingsPreviewClose: document.getElementById(
      "settings-preview-close"
    ),
    settingsPreviewRuntimeActions: document.getElementById(
      "settings-preview-runtime-actions"
    ),
    settingsPreviewContent: document.getElementById(
      "settings-preview-content"
    ),
    settingsPreviewSavePanel: document.querySelector(
      ".rml-preview-save-panel"
    ),
    settingsPreviewStatus: document.getElementById(
      "settings-preview-status"
    ),
    projectManager: document.getElementById("project-manager"),
    projectDialog: document.getElementById("project-dialog"),
    projectClose: document.getElementById("project-close"),
    projectDone: document.getElementById("project-done"),
    projectSaveJson: document.getElementById("project-save-json"),
    projectLoadJson: document.getElementById("project-load-json"),
    projectFileInput: document.getElementById("project-file-input"),
    projectFileStatus: document.getElementById("project-file-status"),
    projectLoadProgress: document.getElementById(
      "project-load-progress"
    ),
    projectLoadProgressFill: document.getElementById(
      "project-load-progress-fill"
    ),
    projectLoadProgressStage: document.getElementById(
      "project-load-progress-stage"
    ),
    builderWorkOverlay: document.getElementById(
      "builder-work-overlay"
    ),
    builderWorkKicker: document.getElementById(
      "builder-work-kicker"
    ),
    builderWorkTitle: document.getElementById(
      "builder-work-title"
    ),
    builderWorkMessage: document.getElementById(
      "builder-work-message"
    ),
    builderWorkProgress: document.getElementById(
      "builder-work-progress"
    ),
    builderWorkProgressFill: document.getElementById(
      "builder-work-progress-fill"
    ),
    builderWorkDetail: document.getElementById(
      "builder-work-detail"
    ),
    builderWorkReplacement: document.getElementById(
      "builder-work-replacement"
    ),
    builderWorkReplacementQueue: document.getElementById(
      "builder-work-replacement-queue"
    ),
    builderWorkReplacementSearch: document.getElementById(
      "builder-work-replacement-search"
    ),
    builderWorkReplacementList: document.getElementById(
      "builder-work-replacement-list"
    ),
    builderWorkReplacementSummary: document.getElementById(
      "builder-work-replacement-summary"
    ),
    builderWorkReplacementCancel: document.getElementById(
      "builder-work-replacement-cancel"
    ),
    builderWorkReplacementConfirm: document.getElementById(
      "builder-work-replacement-confirm"
    ),
    builderMessageDialog: document.getElementById(
      "builder-message-dialog"
    ),
    builderMessageKicker: document.getElementById(
      "builder-message-kicker"
    ),
    builderMessageTitle: document.getElementById(
      "builder-message-title"
    ),
    builderMessageCopy: document.getElementById(
      "builder-message-copy"
    ),
    builderMessageDetails: document.getElementById(
      "builder-message-details"
    ),
    builderMessageCancel: document.getElementById(
      "builder-message-cancel"
    ),
    builderMessageConfirm: document.getElementById(
      "builder-message-confirm"
    ),
    exportDialog: document.getElementById("export-dialog"),
    exportClose: document.getElementById("export-close"),
    exportCancel: document.getElementById("export-cancel"),
    exportPlatform: document.getElementById("export-platform"),
    exportResonitePath: document.getElementById(
      "export-resonite-path"
    ),
    exportCompatibilityHint: document.getElementById(
      "export-compatibility-hint"
    ),
    exportApiCompatibilityWarning: document.getElementById(
      "export-api-compatibility-warning"
    ),
    exportApiCompatibilityWarningMessage: document.getElementById(
      "export-api-compatibility-warning-message"
    ),
    exportIncludeCs: document.getElementById("export-include-cs"),
    exportIncludeCsproj: document.getElementById(
      "export-include-csproj"
    ),
    exportCsFilename: document.getElementById("export-cs-filename"),
    exportCsprojFilename: document.getElementById(
      "export-csproj-filename"
    ),
    exportPackageSummary: document.getElementById(
      "export-package-summary"
    ),
    exportPackageMode: document.getElementById(
      "export-package-mode"
    ),
    exportProjectSummary: document.getElementById(
      "export-project-summary"
    ),
    exportGeneratedFiles: document.getElementById(
      "export-generated-files"
    ),
    exportDownloadHint: document.getElementById(
      "export-download-hint"
    ),
    exportCopySelectedFile: document.getElementById(
      "export-copy-selected-file"
    ),
    exportDownloadSelected: document.getElementById(
      "export-download-selected"
    )
  });
}

const DOUBLE_ACTIVATION_MAX_DELAY = 420;
const DOUBLE_ACTIVATION_MAX_DISTANCE = 24;

let lastActivationTime = 0;
let lastActivationX = 0;
let lastActivationY = 0;
let lastActivationTarget = null;

function isEditableSelectionTarget(
  target
) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLElement &&
    target.isContentEditable
  );
}

function collapseEditableSelection(
  target,
  clientX = null,
  clientY = null
) {
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  ) {
    const selectionEnd =
      Number.isInteger(
        target.selectionEnd
      )
        ? target.selectionEnd
        : target.value.length;

    try {
      target.setSelectionRange(
        selectionEnd,
        selectionEnd,
        "none"
      );
    } catch {
      
    }

    return;
  }

  if (
    target instanceof HTMLElement &&
    target.isContentEditable
  ) {
    const selection =
      window.getSelection();

    if (!selection) {
      return;
    }

    selection.removeAllRanges();

    const caretRange =
      clientX !== null &&
      clientY !== null &&
      document.caretRangeFromPoint
        ? document.caretRangeFromPoint(
            clientX,
            clientY
          )
        : null;

    if (
      caretRange &&
      target.contains(
        caretRange.startContainer
      )
    ) {
      caretRange.collapse(true);
      selection.addRange(
        caretRange
      );
      return;
    }

    const range =
      document.createRange();

    range.selectNodeContents(
      target
    );
    range.collapse(false);

    selection.addRange(
      range
    );
  }
}

function preventGlobalDoubleSelection() {
  document.addEventListener(
    "dblclick",
    event => {
      event.preventDefault();

      const target =
        event.target;

      if (
        isEditableSelectionTarget(
          target
        )
      ) {
        collapseEditableSelection(
          target,
          event.clientX,
          event.clientY
        );
      } else {
        window
          .getSelection()
          ?.removeAllRanges();
      }
    },
    {
      capture: true,
      passive: false
    }
  );

  document.addEventListener(
    "pointerdown",
    event => {
      if (
        event.isPrimary === false
      ) {
        return;
      }

      const now =
        performance.now();

      const distance =
        Math.hypot(
          event.clientX -
            lastActivationX,
          event.clientY -
            lastActivationY
        );

      const sameTarget =
        event.target ===
        lastActivationTarget;

      const isDoubleActivation =
        sameTarget &&
        now -
          lastActivationTime <=
          DOUBLE_ACTIVATION_MAX_DELAY &&
        distance <=
          DOUBLE_ACTIVATION_MAX_DISTANCE;

      if (isDoubleActivation) {
        event.preventDefault();

        const target =
          event.target;

        if (
          isEditableSelectionTarget(
            target
          )
        ) {
          target.focus?.({
            preventScroll: true
          });

          collapseEditableSelection(
            target,
            event.clientX,
            event.clientY
          );
        } else {
          window
            .getSelection()
            ?.removeAllRanges();
        }

        lastActivationTime = 0;
        lastActivationTarget = null;
        return;
      }

      lastActivationTime = now;
      lastActivationX =
        event.clientX;
      lastActivationY =
        event.clientY;
      lastActivationTarget =
        event.target;
    },
    {
      capture: true,
      passive: false
    }
  );

  document.addEventListener(
    "selectionchange",
    () => {
      const active =
        document.activeElement;

      if (
        !(
          active instanceof
            HTMLInputElement ||
          active instanceof
            HTMLTextAreaElement
        )
      ) {
        return;
      }

      const selectionStart =
        active.selectionStart;
      const selectionEnd =
        active.selectionEnd;

      const selectedEverything =
        selectionStart === 0 &&
        selectionEnd ===
          active.value.length &&
        active.value.length > 0;

      if (!selectedEverything) {
        return;
      }

      const recentDoubleActivation =
        performance.now() -
          lastActivationTime <=
          DOUBLE_ACTIVATION_MAX_DELAY;

      if (
        recentDoubleActivation &&
        active ===
          lastActivationTarget
      ) {
        collapseEditableSelection(
          active
        );
      }
    }
  );
}

function createReusableColorXEditor(
  options = {}
) {
  const expression =
    String(
      options.expression ||
        "colorX.White"
    );
  const profile =
    normalizeColorProfile(
      options.profile
    );
  const strength =
    clamp(
      Number(options.strength) || 1,
      1,
      10
    );
  const onChange =
    typeof options.onChange ===
      "function"
      ? options.onChange
      : null;

  const host =
    document.createElement("div");
  host.innerHTML =
    colorDefaultValueMarkup({
      defaultValue: expression,
      colorProfile: profile,
      colorStrength: strength
    });

  const editor =
    host.firstElementChild;

  if (!(editor instanceof HTMLElement)) {
    return host;
  }

  editor.classList.add(
    "rml-shared-colorx-editor"
  );

  const legend =
    editor.querySelector("legend");

  if (legend) {
    legend.textContent =
      String(
        options.label ||
          "Color value"
      );
  }

  const expressionInput =
    editor.querySelector(
      '[data-field="defaultValue"]'
    );

  if (expressionInput) {
    expressionInput.removeAttribute(
      "data-field"
    );
    expressionInput.setAttribute(
      "data-color-expression",
      "true"
    );
  }

  const currentState = () => {
    const inlinePicker =
      editor.querySelector(
        "[data-color-picker-inline]"
      );

    return {
      profile:
        normalizeColorProfile(
          inlinePicker?.dataset
            .colorProfile ||
            profile
        ),
      strength:
        clamp(
          Number(
            inlinePicker?.dataset
              .colorStrength
          ) || strength,
          1,
          10
        )
    };
  };

  const notify = state => {
    onChange?.({
      expression:
        String(
          state.expression ||
            "colorX.White"
        ),
      profile:
        normalizeColorProfile(
          state.profile
        ),
      strength:
        clamp(
          Number(state.strength) || 1,
          1,
          10
        ),
      source:
        state.source ||
        "expression"
    });
  };

  bindCustomColorPickerInteractions(
    editor,
    {
      onCommit: notify
    }
  );

  expressionInput?.addEventListener(
    "input",
    () => {
      const state =
        currentState();
      const nextExpression =
        expressionInput.value;

      updateColorPreview(
        editor,
        nextExpression
      );

      notify({
        expression:
          nextExpression,
        profile:
          state.profile,
        strength:
          state.strength,
        source:
          "expression"
      });
    }
  );

  return editor;
}

function builderStateSnapshot() {
  return clone({
    metadata:
      state.metadata,
    exportOptions:
      state.exportOptions,
    nodes:
      state.nodes,
    extensions:
      isPlainObject(state.extensions)
        ? state.extensions
        : {},
    workspace: {
      activePage:
        normalizeBuilderPage(
          state.activePage
        ),
      selectedId:
        state.selectedId,
      activeContainerId:
        state.activeContainerId,
      collapsedPaletteGroups:
        state.collapsedPaletteGroups
    }
  });
}

function builderCodegenStateSnapshot() {
  const typedNodeGraph =
    isPlainObject(state.extensions)
      ? state.extensions.typedNodeGraph
      : null;

  return {
    metadata: {
      ...state.metadata
    },
    exportOptions: {
      ...state.exportOptions
    },
    nodes: state.nodes,
    extensions: typedNodeGraph
      ? {
          typedNodeGraph
        }
      : {},
    workspace: {
      activePage:
        normalizeBuilderPage(
          state.activePage
        ),
      selectedId:
        state.selectedId,
      activeContainerId:
        state.activeContainerId,
      collapsedPaletteGroups:
        state.collapsedPaletteGroups
    }
  };
}

function exposeBuilderBridge() {
  const bridge = {
    version: 5,

    getStorageContract() {
      return {
        visualTest: RML_VISUAL_TOUR_TEST,
        activeStorageKey: ACTIVE_STORAGE_KEY,
        activePreviewStorageKey: ACTIVE_PREVIEW_STORAGE_KEY,
        requestedStorageKey: RML_VISUAL_TOUR_STORAGE_KEY
      };
    },

    getStateSnapshot() {
      return builderStateSnapshot();
    },

    getFlattenedEntries() {
      return clone(
        currentFlattenedNodes()
      );
    },

    getTypeDefinitions() {
      return clone(
        TYPE_DEFINITIONS
      );
    },

    getRuntimeBehaviors() {
      return [
        "stored",
        "startup",
        "saved",
        "startup-saved"
      ];
    },

    createColorXEditor(options) {
      return createReusableColorXEditor(
        options
      );
    },

    getPreviewValueSnapshot() {
      let draft =
        settingsPreviewDraft;

      if (!draft) {
        let savedDraft = null;

        try {
          const saved =
            localStorage.getItem(
              ACTIVE_PREVIEW_STORAGE_KEY
            );

          if (saved) {
            savedDraft =
              JSON.parse(saved);
          }
        } catch {
          savedDraft = null;
        }

        draft =
          mergeSettingsPreviewDraft(
            savedDraft
          );
      }

      return clone(draft);
    },

    applyPreviewConfigurationMenuAction(
      action,
      payload
    ) {
      return clone(
        applySettingsPreviewRuntimeMenuAction(
          action,
          payload
        )
      );
    },

    getExtensionState(name) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return null;
      }

      const value =
        isPlainObject(state.extensions)
          ? state.extensions[name]
          : undefined;

      return value === undefined
        ? null
        : clone(value);
    },

    getExtensionStateReference(name) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        return null;
      }

      const value =
        isPlainObject(state.extensions)
          ? state.extensions[name]
          : undefined;

      return value === undefined
        ? null
        : value;
    },

    getActivePage() {
      return normalizeBuilderPage(
        state.activePage
      );
    },

    getProjectEpoch() {
      return projectApplicationEpoch;
    },

    setActivePage(
      page,
      options = {}
    ) {
      const normalized =
        setBuilderActivePage(
          page,
          {
            persistImmediately:
              options.immediate === true,
            reason:
              projectString(
                options.reason,
                "graph-bridge"
              )
          }
        );
      recordPageState(
        "bridge.page-committed",
        {
          page: normalized,
          immediate:
            options.immediate === true
        }
      );
      return normalized;
    },

    setExtensionState(
      name,
      value,
      options = {}
    ) {
      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        throw new TypeError(
          "Extension name must be a non-empty string."
        );
      }

      if (!isPlainObject(state.extensions)) {
        state.extensions = {};
      }

      if (
        value === null ||
        value === undefined
      ) {
        delete state.extensions[name];
      } else {
        state.extensions[name] =
          options.assumeDetached === true
            ? value
            : clone(value);
      }

      recordPageState(
        "bridge.extension-state",
        {
          name,
          extensionPage:
            value?.lastOpenPage || null,
          workspacePage:
            state.activePage
        }
      );
      persist(
        options.persistImmediately ===
          true
      );

      document.dispatchEvent(
        new CustomEvent(
          "rml-builder:extension-state-changed",
          {
            detail: {
              name
            }
          }
        )
      );
    },

    requestRender() {
      renderAll();
    },

    requestPaletteRender() {
      renderPalette();
    },

    requestGeneratedOutputRefresh() {
      requestGeneratedOutputUpdate();

      if (
        elements.exportDialog?.open
      ) {
        updateExportDialog();
      }
    },

    persist() {
      persist();
    }
  };

  Object.defineProperty(
    window,
    "RMLBuilderBridge",
    {
      value:
        Object.freeze(bridge),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  document.dispatchEvent(
    new CustomEvent(
      "rml-builder:bridge-ready",
      {
        detail: {
          version: bridge.version
        }
      }
    )
  );
}

function installUniversalScrollLayerSelector() {
  if (window.RMLUniversalScrollLayers) {
    return;
  }

  const HTML_KEY = "html-root";
  const DOCUMENT_KEY = "document-scroll-root";
  const scrollDebug = window.RMLScrollHierarchy?.debug || null;
  const dbg = (type, payload = {}) =>
    scrollDebug?.log?.(`universal:${type}`, payload);
  const dbgTable = (type, rows = []) =>
    scrollDebug?.table?.(`universal:${type}`, rows);

  let selection = null;
  let selectionCandidates = null;
  let session = null;
  const cyclicWheelStepper =
    window.RMLScrollManager
      ?.createCyclicWheelStepper?.({
        threshold: 40
      }) || null;
  let visualFrame = 0;
  let visualFollowFrame = 0;
  let indicatorTimer = 0;
  let outline = null;
  let indicator = null;

  const sharedWheelClaims = (() => {
    const existing =
      window.__RMLScrollLayerWheelClaims;

    if (existing instanceof WeakSet) {
      return existing;
    }

    const value = new WeakSet();

    Object.defineProperty(
      window,
      "__RMLScrollLayerWheelClaims",
      {
        value,
        writable: false,
        enumerable: false,
        configurable: true
      }
    );

    return value;
  })();

  const claimWheelEvent = event => {
    if (
      !event ||
      sharedWheelClaims.has(event)
    ) {
      return false;
    }

    sharedWheelClaims.add(event);

    if (event.cancelable) {
      event.preventDefault();
    }

    event.stopImmediatePropagation();

    return true;
  };

  const htmlElement = () =>
    document.documentElement;

  const editModeScrollElement = () => {
    if (
      !document.body.classList.contains(
        "rml-graph-edit-mode"
      )
    ) {
      return null;
    }

    const workspace =
      document.querySelector(
        "body.rml-graph-edit-mode > main > .workspace"
      );

    return workspace instanceof HTMLElement
      ? workspace
      : null;
  };

  const documentScrollElement = () =>
    editModeScrollElement() ||
    document.scrollingElement ||
    document.documentElement;

  const visibleViewportRectangle = () => {
    const visual =
      window.visualViewport;

    const left =
      visual?.offsetLeft || 0;
    const top =
      visual?.offsetTop || 0;
    const width =
      Math.max(
        1,
        visual?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        1
      );
    const height =
      Math.max(
        1,
        visual?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        1
      );

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    };
  };

  const scrollableOverflow = value =>
    value === "auto" ||
    value === "scroll" ||
    value === "overlay";

  const scrollLayerMode = element =>
    String(
      element?.getAttribute?.(
        "data-rml-scroll-layer"
      ) || ""
    )
      .trim()
      .toLowerCase();

  const scrollLayerAlwaysSelectable =
    element =>
      [
        "always",
        "true",
        "empty",
        "virtual",
        "programmatic"
      ].includes(
        scrollLayerMode(element)
      );

  const scrollLayerProgrammatic =
    element =>
      [
        "auto",
        "always",
        "true",
        "programmatic"
      ].includes(
        scrollLayerMode(element)
      );

  const scrollAxesForElement =
    element => {
      if (!(element instanceof HTMLElement)) {
        return {
          x: false,
          y: false
        };
      }

      const style =
        getComputedStyle(element);
      const programmatic =
        scrollLayerProgrammatic(element);

      return {
        x:
          element.scrollWidth >
            element.clientWidth &&
          (
            scrollableOverflow(
              style.overflowX
            ) ||
            programmatic
          ),
        y:
          element.scrollHeight >
            element.clientHeight &&
          (
            scrollableOverflow(
              style.overflowY
            ) ||
            programmatic
          )
      };
    };

  const visibleElement = element => {
    if (
      !(element instanceof HTMLElement) ||
      !element.isConnected
    ) {
      return false;
    }

    const rectangle =
      element.getBoundingClientRect();
    const style =
      getComputedStyle(element);

    return (
      rectangle.width > 0 &&
      rectangle.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  };

  const elementHitTestVisibleAt = (
    element,
    clientX,
    clientY
  ) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const viewport = visibleViewportRectangle();

    if (
      clientX < viewport.left ||
      clientX >= viewport.right ||
      clientY < viewport.top ||
      clientY >= viewport.bottom
    ) {
      return false;
    }

    const stack =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(clientX, clientY)
        : [document.elementFromPoint(clientX, clientY)].filter(Boolean);

    return stack.some(hit =>
      hit === element ||
      element.contains(hit)
    );
  };

  const elementHasExposedPixels = (
    element,
    rectangle = null
  ) => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = rectangle || element.getBoundingClientRect();
    const viewport = visibleViewportRectangle();
    const left = Math.max(viewport.left, rect.left);
    const top = Math.max(viewport.top, rect.top);
    const right = Math.min(viewport.right, rect.right);
    const bottom = Math.min(viewport.bottom, rect.bottom);

    if (right - left < 1 || bottom - top < 1) {
      return false;
    }

    const epsilon = 1;
    const xs = [
      left + epsilon,
      left + (right - left) * 0.25,
      left + (right - left) * 0.5,
      left + (right - left) * 0.75,
      right - epsilon
    ];
    const ys = [
      top + epsilon,
      top + (bottom - top) * 0.25,
      top + (bottom - top) * 0.5,
      top + (bottom - top) * 0.75,
      bottom - epsilon
    ];

    let probeCount = 0;
    for (const y of ys) {
      for (const x of xs) {
        probeCount += 1;
        const hit = elementHitTestVisibleAt(element, x, y);
        dbg("exposure-probe", {
          element: scrollDebug?.describeElement?.(element),
          x: Number(x.toFixed(3)),
          y: Number(y.toFixed(3)),
          hit,
          probe: probeCount
        });
        if (hit) {
          dbg("exposure-result", { result: true, method: "25-point", probes: probeCount });
          return true;
        }
      }
    }

    const boundedAxis = (start, end) => {
      const span = Math.max(0, end - start);
      const count = Math.max(
        3,
        Math.min(15, Math.ceil(span / 48) + 1)
      );
      const inset = Math.min(0.5, span / 4);
      const first = start + inset;
      const last = end - inset;
      if (count <= 1 || last <= first) {
        return [(start + end) / 2];
      }
      return Array.from(
        { length: count },
        (_, index) =>
          first + (last - first) * index / (count - 1)
      );
    };
    const boundedXs = boundedAxis(left, right);
    const boundedYs = boundedAxis(top, bottom);
    let boundedProbeCount = 0;

    for (const y of boundedYs) {
      for (const x of boundedXs) {
        boundedProbeCount += 1;
        if (elementHitTestVisibleAt(element, x, y)) {
          dbg("exposure-bounded-grid-hit", {
            x: Number(x.toFixed(3)),
            y: Number(y.toFixed(3)),
            boundedProbeCount,
            element: scrollDebug?.describeElement?.(element)
          });
          return true;
        }
      }
    }

    dbg("exposure-result", {
      result: false,
      method: "bounded-15x15-grid",
      probes: probeCount,
      boundedProbeCount,
      element: scrollDebug?.describeElement?.(element)
    });
    return false;
  };

  const elementCanScroll = element => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (element === htmlElement()) {
      return true;
    }

    if (
      element === documentScrollElement() &&
      element !== htmlElement()
    ) {
      return true;
    }

    if (!visibleElement(element)) {
      return false;
    }

    const axes =
      scrollAxesForElement(element);

    return (
      axes.x ||
      axes.y ||
      scrollLayerAlwaysSelectable(element)
    );
  };

  const normalizedWheelDelta = (
    event,
    referenceElement
  ) => {
    const scale =
      event.deltaMode ===
        WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode ===
            WheelEvent.DOM_DELTA_PAGE
          ? Math.max(
              1,
              referenceElement?.clientHeight ||
              visibleViewportRectangle().height
            )
          : 1;

    return {
      x: event.deltaX * scale,
      y: event.deltaY * scale
    };
  };

  const semanticElementLabel =
    element => {
      if (
        element ===
          editModeScrollElement()
      ) {
        return "Edit Mode · Workspace ROOT";
      }

      if (element === htmlElement()) {
        return "<html> · Page ROOT";
      }

      if (
        element === documentScrollElement() &&
        element !== htmlElement()
      ) {
        return `${
          element.tagName.toLowerCase()
        } · Document scroll surface`;
      }

      const labelledBy =
        String(
          element.getAttribute(
            "aria-labelledby"
          ) ||
          ""
        )
          .split(/\s+/)
          .filter(Boolean)
          .map(id =>
            document.getElementById(id)
              ?.textContent
          )
          .filter(Boolean)
          .join(" ");

      const nearestPanel =
        element.closest(
          ".panel, dialog, section, aside, nav, main"
        );

      const panelTitle =
        nearestPanel?.querySelector(
          ":scope > .panel-title, :scope > header h2, :scope > h2, :scope > h3"
        )?.textContent ||
        "";

      const wrappingLabel =
        element.closest("label");

      const explicit =
        element.getAttribute(
          "aria-label"
        ) ||
        labelledBy ||
        element.getAttribute(
          "data-scroll-label"
        ) ||
        element.getAttribute(
          "title"
        ) ||
        element.getAttribute(
          "placeholder"
        ) ||
        (wrappingLabel !== element
          ? wrappingLabel?.childNodes?.[0]
              ?.textContent
          : "") ||
        panelTitle ||
        "";

      let label =
        String(explicit)
          .replace(/\s+/g, " ")
          .trim();

      if (!label) {
        if (
          element instanceof
            HTMLTextAreaElement
        ) {
          label = "Text editor";
        } else if (
          element.getAttribute(
            "role"
          ) === "listbox"
        ) {
          label = "Scrollable list";
        } else if (
          element.matches(
            ".palette"
          )
        ) {
          label = "Add controls";
        } else if (
          element.matches(
            ".inspector"
          )
        ) {
          label = "Properties";
        } else if (
          element.matches(
            ".code-panel pre"
          )
        ) {
          label = "Generated code";
        } else if (
          element.matches(
            ".information-content"
          )
        ) {
          label = "Help content";
        } else {
          label = "Scrollable area";
        }
      }

      return label.slice(0, 84);
    };

  const stableScrollLayerIdentity =
    element => {
      const explicitKey =
        String(
          element.getAttribute(
            "data-rml-scroll-layer-key"
          ) || ""
        ).trim();

      if (explicitKey) {
        return {
          kind: "declared-key",
          value: explicitKey
        };
      }

      if (element.id) {
        return {
          kind: "dom-id",
          value: element.id
        };
      }

      const nodeScrollId =
        String(
          element.getAttribute(
            "data-node-scroll-id"
          ) || ""
        ).trim();

      if (nodeScrollId) {
        return {
          kind: "node-scroll-id",
          value: nodeScrollId
        };
      }

      const containerId =
        String(
          element.getAttribute(
            "data-container"
          ) || ""
        ).trim();

      if (containerId) {
        return {
          kind: "container-id",
          value: containerId
        };
      }

      return null;
    };

  const resolveStableScrollLayerIdentity =
    identity => {
      if (!identity?.value) {
        return null;
      }

      if (identity.kind === "dom-id") {
        return document.getElementById(
          identity.value
        );
      }

      const attribute =
        identity.kind === "declared-key"
          ? "data-rml-scroll-layer-key"
          : identity.kind === "node-scroll-id"
            ? "data-node-scroll-id"
            : identity.kind === "container-id"
              ? "data-container"
              : "";

      return attribute
        ? document.querySelector(
            `[${attribute}="${CSS.escape(identity.value)}"]`
          )
        : null;
    };

  const descriptorFor =
    element => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      if (element === htmlElement()) {
        return {
          kind: "html-root",
          key: HTML_KEY,
          label:
            semanticElementLabel(
              element
            ),
          element
        };
      }

      if (
        element === documentScrollElement() &&
        element !== htmlElement()
      ) {
        return {
          kind: "document-root",
          key: DOCUMENT_KEY,
          label:
            semanticElementLabel(
              element
            ),
          element
        };
      }

      const stableIdentity =
        stableScrollLayerIdentity(
          element
        );

      let elementId =
        element.dataset
          .rmlScrollLayerId;

      if (!stableIdentity && !elementId) {
        elementId =
          createId(
            "scroll-layer"
          );
        element.dataset
          .rmlScrollLayerId =
          elementId;
      }

      return {
        kind: "element",
        key:
          stableIdentity
            ? `element:${stableIdentity.kind}:${stableIdentity.value}`
            : `element:${elementId}`,
        label:
          semanticElementLabel(
            element
          ),
        stableIdentity,
        elementId,
        element
      };
    };

  const resolveDescriptor =
    descriptor => {
      if (!descriptor) {
        return null;
      }

      if (
        descriptor.kind ===
          "html-root"
      ) {
        return htmlElement();
      }

      if (
        descriptor.kind ===
          "document-root"
      ) {
        const scrolling =
          documentScrollElement();

        return scrolling !==
          htmlElement()
          ? scrolling
          : null;
      }

      if (
        descriptor.element
          ?.isConnected
      ) {
        return descriptor.element;
      }

      const stable =
        resolveStableScrollLayerIdentity(
          descriptor.stableIdentity
        );

      if (stable) {
        descriptor.element = stable;
        return stable;
      }

      if (
        descriptor.elementId
      ) {
        return document.querySelector(
          `[data-rml-scroll-layer-id="${CSS.escape(descriptor.elementId)}"]`
        );
      }

      return null;
    };

  const descriptorUsable =
    descriptor => {
      const element =
        resolveDescriptor(
          descriptor
        );

      if (!element) {
        return false;
      }

      if (
        descriptor.kind ===
          "html-root"
      ) {
        return true;
      }

      if (
        descriptor.kind ===
          "document-root"
      ) {
        return true;
      }

      return (
        elementCanScroll(element) &&
        elementHasExposedPixels(
          element,
          clippedRectangle(element, descriptor)
        )
      );
    };

  const dynamicAncestorElements =
    (
      target,
      composedPath = null
    ) => {
      const result = [];
      const seen = new Set();

      const add = element => {
        if (
          element instanceof HTMLElement &&
          !seen.has(element)
        ) {
          seen.add(element);
          result.push(element);
        }
      };

      if (Array.isArray(composedPath)) {
        for (const item of composedPath) {
          if (item === htmlElement()) {
            break;
          }
          add(item);
        }
      }

      let current =
        target instanceof Element
          ? target
          : null;

      while (
        current &&
        current !== htmlElement()
      ) {
        add(current);

        const root =
          current.getRootNode?.();

        current =
          current.parentElement ||
          (
            root instanceof ShadowRoot
              ? root.host
              : null
          );
      }

      return result;
    };

  const viewportVisibleScrollElements = () => {
    const values = [];

    for (const element of document.querySelectorAll("*")) {
      if (
        !(element instanceof HTMLElement) ||
        element === htmlElement() ||
        element === document.body ||
        !elementCanScroll(element)
      ) {
        continue;
      }

      const descriptor = descriptorFor(element);
      if (!descriptor) continue;

      const clipped = clippedRectangle(element, descriptor);
      const width = Math.max(0, clipped.right - clipped.left);
      const height = Math.max(0, clipped.bottom - clipped.top);

      if (
        width < 1 ||
        height < 1 ||
        !elementHasExposedPixels(element, clipped)
      ) {
        continue;
      }

      const generatedCode = element.matches(".code-panel pre");

      values.push({
        element,
        priority: generatedCode ? 1000 : 0,
        visibleArea: Math.max(1, width * height),
        top: clipped.top,
        left: clipped.left
      });
    }

    values.sort((left, right) =>
      left.priority - right.priority ||
      left.visibleArea - right.visibleArea ||
      left.top - right.top ||
      left.left - right.left
    );

    return values.map(value => value.element);
  };

  const candidatesFor =
    (
      target,
      composedPath = null,
      options = {}
    ) => {
      const candidates = [];
      const keys = new Set();

      const add = element => {
        const descriptor =
          descriptorFor(
            element
          );

        if (
          descriptor &&
          !keys.has(
            descriptor.key
          )
        ) {
          keys.add(
            descriptor.key
          );
          candidates.push(
            descriptor
          );
        }
      };

      for (
        const current of
        dynamicAncestorElements(
          target,
          composedPath
        )
      ) {
        if (
          elementCanScroll(
            current
          )
        ) {
          add(current);
        }
      }

      if (options.includeViewportWide === true) {
        for (const current of viewportVisibleScrollElements()) {
          add(current);
        }
      }

      const scrolling =
        documentScrollElement();

      if (
        scrolling instanceof
          HTMLElement &&
        scrolling !==
          htmlElement()
      ) {
        add(scrolling);
      }

      if (!editModeScrollElement()) {
        add(htmlElement());
      }

      dbgTable(
        options.includeViewportWide === true
          ? "candidates-viewport-wide"
          : "candidates-local",
        candidates.map((descriptor, index) => {
          const element = resolveDescriptor(descriptor);
          const rect = element instanceof HTMLElement
            ? element.getBoundingClientRect()
            : null;
          const clipped = element instanceof HTMLElement
            ? clippedRectangle(element, descriptor)
            : null;
          const axes = element instanceof HTMLElement
            ? scrollAxesForElement(element)
            : { x: false, y: false };
          return {
            index,
            key: descriptor.key,
            label: descriptor.label,
            kind: descriptor.kind,
            rawLeft: rect?.left ?? null,
            rawTop: rect?.top ?? null,
            rawRight: rect?.right ?? null,
            rawBottom: rect?.bottom ?? null,
            clippedLeft: clipped?.left ?? null,
            clippedTop: clipped?.top ?? null,
            clippedRight: clipped?.right ?? null,
            clippedBottom: clipped?.bottom ?? null,
            scrollLeft: element?.scrollLeft ?? null,
            scrollTop: element?.scrollTop ?? null,
            scrollWidth: element?.scrollWidth ?? null,
            scrollHeight: element?.scrollHeight ?? null,
            clientWidth: element?.clientWidth ?? null,
            clientHeight: element?.clientHeight ?? null,
            axisX: axes.x,
            axisY: axes.y
          };
        })
      );

      return candidates;
    };

  const orderCandidatesByReadingHierarchy =
    descriptors => {
      const hierarchy =
        window.RMLScrollHierarchy;

      if (
        !hierarchy ||
        typeof hierarchy.orderByReadingHierarchy !==
          "function"
      ) {
        return Array.isArray(descriptors)
          ? descriptors
          : [];
      }

      return hierarchy.orderByReadingHierarchy(
        descriptors,
        {
          resolveElement: resolveDescriptor,
          kindRank(descriptor) {
            return descriptor?.kind === "html-root"
              ? -5000
              : descriptor?.kind === "document-root"
                ? -4000
                : 0;
          }
        }
      );
    };

  const refreshCandidateChain =
    descriptors => {
      const refreshed = [];
      const keys = new Set();

      const add = descriptor => {
        if (
          !descriptor ||
          keys.has(descriptor.key)
        ) {
          return;
        }

        keys.add(descriptor.key);
        refreshed.push(descriptor);
      };

      for (
        const descriptor of
        Array.isArray(descriptors)
          ? descriptors
          : []
      ) {
        const element =
          resolveDescriptor(descriptor);
        const rebound =
          element
            ? descriptorFor(element)
            : null;

        add(rebound || descriptor);
      }

      dbgTable("candidate-chain-refreshed-preserving-order",
        refreshed.map((descriptor, index) => ({
          index, key: descriptor.key, label: descriptor.label, kind: descriptor.kind
        }))
      );

      return refreshed;
    };

  const ensureVisuals = () => {
    if (!document.body) {
      return;
    }

    if (
      !outline?.isConnected
    ) {
      outline =
        document.createElement(
          "div"
        );
      outline.className =
        "rml-scroll-layer-outline";
      outline.hidden = true;
      outline.setAttribute(
        "aria-hidden",
        "true"
      );
      document.body.appendChild(
        outline
      );
    }

  };

  const hideIndicator = (
    immediate = false
  ) => {
    window.clearTimeout(
      indicatorTimer
    );
    indicatorTimer = 0;

    if (!indicator) {
      return;
    }

    indicator.classList.remove(
      "visible"
    );

    if (immediate) {
      indicator.hidden = true;
      return;
    }

    indicatorTimer =
      window.setTimeout(
        () => {
          if (indicator) {
            indicator.hidden = true;
          }
        },
        180
      );
  };

  const showIndicator = (
    mode,
    descriptor,
    options = {}
  ) => {
    hideIndicator(true);
  };

  const clippedRectangle =
    (
      element,
      descriptor
    ) => {
      const viewport =
        visibleViewportRectangle();

      if (
        descriptor.kind ===
          "html-root" ||
        descriptor.kind ===
          "document-root"
      ) {
        return {
          ...viewport
        };
      }

      const rectangle =
        element.getBoundingClientRect();

      let left =
        Math.max(
          viewport.left,
          rectangle.left
        );
      let top =
        Math.max(
          viewport.top,
          rectangle.top
        );
      let right =
        Math.min(
          viewport.right,
          rectangle.right
        );
      let bottom =
        Math.min(
          viewport.bottom,
          rectangle.bottom
        );

      let ancestor =
        element.parentElement;

      while (
        ancestor &&
        ancestor !==
          document.body &&
        ancestor !==
          htmlElement()
      ) {
        const style =
          getComputedStyle(
            ancestor
          );
        const clips =
          style.overflowX !==
            "visible" ||
          style.overflowY !==
            "visible";

        if (clips) {
          const clip =
            ancestor
              .getBoundingClientRect();

          left =
            Math.max(
              left,
              clip.left
            );
          top =
            Math.max(
              top,
              clip.top
            );
          right =
            Math.min(
              right,
              clip.right
            );
          bottom =
            Math.min(
              bottom,
              clip.bottom
            );
        }

        ancestor =
          ancestor.parentElement;
      }

      return {
        left,
        top,
        right,
        bottom,
        width:
          Math.max(
            0,
            right - left
          ),
        height:
          Math.max(
            0,
            bottom - top
          )
      };
    };

  const positionVisual = () => {
    visualFrame = 0;

    const preview =
      session?.candidates?.[
        session.index
      ] ||
      null;
    const descriptor =
      preview ||
      selection;

    if (!descriptor) {
      if (outline) {
        outline.hidden = true;
      }
      return;
    }

    const element =
      resolveDescriptor(
        descriptor
      );

    const renderable =
      element &&
      (
        descriptor.kind ===
          "html-root" ||
        descriptor.kind ===
          "document-root" ||
        (
          visibleElement(element) &&
          elementHasExposedPixels(
            element,
            clippedRectangle(element, descriptor)
          )
        )
      );

    if (!renderable) {
      if (outline) {
        outline.hidden = true;
      }
      return;
    }

    ensureVisuals();

    const rectangle =
      clippedRectangle(
        element,
        descriptor
      );

    const inset =
      descriptor.kind ===
        "html-root"
        ? 5
        : descriptor.kind ===
            "document-root"
          ? 8
          : 0;

    const left =
      rectangle.left +
      inset;
    const top =
      rectangle.top +
      inset;
    const right =
      rectangle.right -
      inset;
    const bottom =
      rectangle.bottom -
      inset;
    const width =
      Math.max(
        0,
        right - left
      );
    const height =
      Math.max(
        0,
        bottom - top
      );

    if (
      !outline ||
      width < 4 ||
      height < 4
    ) {
      if (outline) {
        outline.hidden = true;
      }
      return;
    }

    const computed =
      getComputedStyle(
        element
      );

    outline.style.left =
      `${left}px`;
    outline.style.top =
      `${top}px`;
    outline.style.width =
      `${width}px`;
    outline.style.height =
      `${height}px`;
    outline.style.borderRadius =
      descriptor.kind ===
        "html-root"
        ? "12px"
        : computed.borderRadius ===
            "0px"
          ? "8px"
          : computed.borderRadius;

    outline.dataset.label =
      descriptor.label;
    outline.dataset.kind =
      descriptor.kind;
    outline.classList.toggle(
      "preview",
      Boolean(preview)
    );
    outline.classList.toggle(
      "selected",
      !preview
    );
    outline.hidden = false;
  };

  const scheduleVisualRefresh =
    () => {
      if (visualFrame) {
        return;
      }

      visualFrame =
        requestAnimationFrame(
          positionVisual
        );
    };

  const followVisualDuringViewportMotion =
    descriptor => {
      if (visualFollowFrame) {
        cancelAnimationFrame(visualFollowFrame);
        visualFollowFrame = 0;
      }

      const startedAt = performance.now();
      let lastLeft = Number.NaN;
      let lastTop = Number.NaN;
      let stableFrames = 0;

      const tick = () => {
        visualFollowFrame = 0;

        if (
          !selection ||
          !descriptor ||
          selection.key !== descriptor.key
        ) {
          return;
        }

        positionVisual();

        const element = resolveDescriptor(descriptor);
        if (!element?.isConnected) {
          return;
        }

        const rectangle = element.getBoundingClientRect();
        const unchanged =
          Number.isFinite(lastLeft) &&
          Math.abs(rectangle.left - lastLeft) < 0.1 &&
          Math.abs(rectangle.top - lastTop) < 0.1;

        stableFrames = unchanged
          ? stableFrames + 1
          : 0;
        lastLeft = rectangle.left;
        lastTop = rectangle.top;

        if (
          stableFrames < 4 &&
          performance.now() - startedAt < 1600
        ) {
          visualFollowFrame =
            requestAnimationFrame(tick);
        } else {
          positionVisual();
        }
      };

      visualFollowFrame =
        requestAnimationFrame(tick);
    };

  const clearSelection = (
    options = {}
  ) => {
    selection = null;
    selectionCandidates = null;
    session = null;
    cyclicWheelStepper?.reset?.();

    if (visualFrame) {
      cancelAnimationFrame(
        visualFrame
      );
      visualFrame = 0;
    }

    if (visualFollowFrame) {
      cancelAnimationFrame(
        visualFollowFrame
      );
      visualFollowFrame = 0;
    }

    if (outline) {
      outline.hidden = true;
    }

    if (
      options.keepIndicator !==
        true
    ) {
      hideIndicator(true);
    }
  };

  const focusSelectionInViewport = descriptor => {
    if (
      !descriptor ||
      descriptor.kind === "html-root" ||
      descriptor.kind === "document-root"
    ) {
      return;
    }

    const element = resolveDescriptor(descriptor);
    if (!element?.isConnected) return;

    followVisualDuringViewportMotion(descriptor);

    if (window.RMLScrollManager?.revealElement) {
      window.RMLScrollManager.revealElement(
        element,
        {
          reason: "ctrl-scroll-commit",
          margin: 18,
          behavior: "smooth"
        }
      );
      return;
    }

    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth"
    });
  };

  const commitSelection = () => {
    const frozenChain =
      refreshCandidateChain(
        session?.candidates ||
        selectionCandidates ||
        (
          selection
            ? [selection]
            : []
        )
      );

    const candidate =
      session
        ?.candidates?.[
          session.index
        ] ||
      selection ||
      null;

    session = null;
    cyclicWheelStepper?.reset?.();

    if (!candidate) {
      scheduleVisualRefresh();
      return selection;
    }

    selection = candidate;
    selectionCandidates =
      frozenChain.length > 0
        ? frozenChain
        : [candidate];

    dbg("commit-selection", {
      key: selection.key,
      label: selection.label,
      kind: selection.kind,
      frozenChain: selectionCandidates.map((value, index) => ({
        index,
        key: value.key,
        label: value.label,
        kind: value.kind
      }))
    });

    focusSelectionInViewport(selection);
    scheduleVisualRefresh();

    showIndicator(
      "GLOBAL SCROLL OVERRIDE LOCKED",
      selection,
      {
        variant:
          "selected",
        duration:
          1650
      }
    );

    return selection;
  };

  const cycleSelection =
    event => {
      if (!claimWheelEvent(event)) {
        return;
      }

      const previousActiveKey =
        session
          ?.candidates?.[
            session.index
          ]?.key ||
        selection?.key ||
        "";

      let candidates;

      if (
        session?.candidates?.length
      ) {
        candidates =
          refreshCandidateChain(
            session.candidates
          );
      } else {
        candidates =
          candidatesFor(
            event.target,
            event.composedPath?.(),
            { includeViewportWide: true }
          );
      }

      if (
        candidates.length === 0
      ) {
        candidates = [
          descriptorFor(
            documentScrollElement()
          )
        ].filter(Boolean);
      }

      const startingSession =
        !session;

      dbg("cycle-wheel-event", {
        startingSession,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target instanceof HTMLElement
          ? scrollDebug?.describeElement?.(event.target)
          : null,
        previousActiveKey,
        candidateCountBeforeOrder: candidates.length
      });

      if (startingSession) {
        candidates =
          orderCandidatesByReadingHierarchy(
            candidates
          );
        dbgTable("cycle-ordered-candidates", candidates.map((candidate, index) => ({
          index,
          key: candidate.key,
          label: candidate.label,
          kind: candidate.kind
        })));
      }

      const selectedIndex =
        candidates.findIndex(
          candidate =>
            candidate.key ===
            previousActiveKey
        );

      if (startingSession) {
        session = {
          candidates,
          index: 0,
          modifierLabel:
            event.metaKey &&
            !event.ctrlKey
              ? "COMMAND + WHEEL"
              : "CTRL + WHEEL"
        };
        cyclicWheelStepper?.reset?.();
      } else {
        session.candidates =
          candidates;
        session.index =
          selectedIndex >= 0
            ? selectedIndex
            : clamp(
                session.index,
                0,
                candidates.length - 1
              );
      }

      const reference =
        event.target instanceof
          HTMLElement
          ? event.target
          : documentScrollElement();
      const delta =
        normalizedWheelDelta(
          event,
          reference
        );
      const dominant =
        Math.abs(delta.y) >=
          Math.abs(delta.x)
          ? delta.y
          : delta.x;
      const direction =
        Math.sign(
          dominant
        );

      if (
        direction !== 0 &&
        !startingSession
      ) {
        const stepped =
          cyclicWheelStepper?.step?.(
            session.index,
            candidates.length,
            dominant
          );

        if (stepped) {
          session.index =
            stepped.index;
        } else {
          session.index =
            (
              session.index +
              (direction > 0 ? 1 : -1) +
              candidates.length
            ) % candidates.length;
        }
      }

      const active =
        candidates[
          session.index
        ];

      dbg("cycle-state-after-wheel", {
        index: session.index,
        count: candidates.length,
        activeKey: active?.key || "",
        activeLabel: active?.label || "",
        dominant,
        direction,
        normalizedDelta: delta
      });

      scheduleVisualRefresh();
      showIndicator(
        `${session.modifierLabel} · GLOBAL OVERRIDE · ↓ INNER / ↑ OUTER`,
        active,
        {
          position:
            `Layer ${session.index + 1}/${candidates.length}`,
          variant:
            "preview",
          sticky: true
        }
      );
    };

  const rootScrollBlockedByDialog =
    target => {
      const dialog =
        target instanceof Element
          ? target.closest(
              "dialog[open]"
            )
          : null;

      return Boolean(dialog);
    };

  const scrollDescriptor = (
    event,
    descriptor,
    element,
    options = {}
  ) => {
    const delta =
      normalizedWheelDelta(
        event,
        element
      );

    let horizontal =
      delta.x;
    let vertical =
      delta.y;

    if (
      event.shiftKey &&
      Math.abs(horizontal) <
        Math.abs(vertical)
    ) {
      horizontal =
        vertical;
      vertical = 0;
    }

    let target =
      element;
    let allowsX = false;
    let allowsY = false;
    let blocked = false;

    if (
      descriptor.kind ===
        "html-root"
    ) {
      target =
        documentScrollElement() ===
          htmlElement()
          ? htmlElement()
          : null;

      blocked =
        options.overdrive === true
          ? false
          : rootScrollBlockedByDialog(
              event.target
            );
    } else if (
      descriptor.kind ===
        "document-root"
    ) {
      target =
        documentScrollElement();

      blocked =
        options.overdrive === true
          ? false
          : rootScrollBlockedByDialog(
              event.target
            );
    }

    if (!target || blocked) {
      dbg("scroll-blocked", {
        key: descriptor?.key || "",
        label: descriptor?.label || "",
        kind: descriptor?.kind || "",
        targetExists: Boolean(target),
        blocked,
        delta,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey
      });
      return {
        moved: false,
        empty:
          !target,
        blocked
      };
    }

    if (
      descriptor.kind ===
        "html-root" ||
      descriptor.kind ===
        "document-root"
    ) {
      allowsX =
        target.scrollWidth >
        target.clientWidth + 1;
      allowsY =
        target.scrollHeight >
        target.clientHeight + 1;
    } else {
      const axes =
        scrollAxesForElement(
          target
        );

      allowsX = axes.x;
      allowsY = axes.y;
    }

    if (
      !allowsY &&
      allowsX &&
      Math.abs(horizontal) <
        Math.abs(vertical)
    ) {
      horizontal =
        vertical;
      vertical = 0;
    }

    if (!allowsX) {
      horizontal = 0;
    }
    if (!allowsY) {
      vertical = 0;
    }

    const empty =
      !allowsX &&
      !allowsY;
    const beforeLeft =
      target.scrollLeft;
    const beforeTop =
      target.scrollTop;

    target.scrollLeft +=
      horizontal;
    target.scrollTop +=
      vertical;

    const moved =
      Math.abs(
        target.scrollLeft -
        beforeLeft
      ) > .25 ||
      Math.abs(
        target.scrollTop -
        beforeTop
      ) > .25;

    dbg("scroll-applied", {
      key: descriptor?.key || "",
      label: descriptor?.label || "",
      kind: descriptor?.kind || "",
      rawDeltaX: event.deltaX,
      rawDeltaY: event.deltaY,
      deltaMode: event.deltaMode,
      normalizedDelta: delta,
      requestedHorizontal: horizontal,
      requestedVertical: vertical,
      allowsX,
      allowsY,
      beforeLeft,
      beforeTop,
      afterLeft: target.scrollLeft,
      afterTop: target.scrollTop,
      moved,
      empty,
      element: scrollDebug?.describeElement?.(target)
    });

    scheduleVisualRefresh();

    return {
      moved,
      empty,
      blocked: false
    };
  };

  const selectedFor =
    (
      target,
      composedPath = null
    ) => {
      if (selection) {
        return {
          descriptor:
            selection,
          element:
            resolveDescriptor(
              selection
            ),
          explicit: true
        };
      }

      const candidates =
        candidatesFor(
          target,
          composedPath,
          { includeViewportWide: false }
        );
      const descriptor =
        candidates[0] ||
        descriptorFor(
          documentScrollElement()
        );

      return {
        descriptor,
        element:
          resolveDescriptor(
            descriptor
          ),
        explicit: false
      };
    };

  const handleWheel =
    event => {
      const target =
        event.target instanceof
          Element
          ? event.target
          : null;
      const universalOwnsWheel =
        Boolean(
          selection ||
          session
        );
      const graphState =
        window
          .RMLTypedNodeGraphScrollLayers
          ?.getState?.();
      const graphOwnsWheel =
        Boolean(
          graphState?.active ||
          graphState?.cycling ||
          graphState?.selected
        );
      const insideGraph =
        Boolean(
          target?.closest(
            ".rml-graph-viewport"
          )
        );
      const modifierCycling =
        event.ctrlKey ||
        event.metaKey;
      const insideInformationDialog =
        Boolean(
          target?.closest(
            ".information-dialog[open]"
          )
        );

      if (modifierCycling) {
        if (session) {
          cycleSelection(event);
          return;
        }

        const graphViewport =
          document.querySelector(
            ".rml-graph-viewport"
          );
        const visibleViewport =
          visibleViewportRectangle();
        const graphRectangle =
          graphViewport?.getBoundingClientRect();
        const graphVisible =
          Boolean(
            graphRectangle &&
            graphRectangle.right > visibleViewport.left &&
            graphRectangle.left < visibleViewport.right &&
            graphRectangle.bottom > visibleViewport.top &&
            graphRectangle.top < visibleViewport.bottom
          );

        if (insideGraph || graphVisible) {
          if (selection) {
            clearSelection();
          }
          return;
        }

        if (graphState?.cycling) {
          return;
        }

        if (
          graphState?.selected ||
          graphState?.globalOverride
        ) {
          window
            .RMLTypedNodeGraphScrollLayers
            ?.clear?.();
        }

        cycleSelection(event);
        return;
      }

      



      if (
        insideInformationDialog &&
        !universalOwnsWheel
      ) {
        return;
      }

      if (
        !universalOwnsWheel &&
        (
          graphOwnsWheel ||
          insideGraph
        )
      ) {
        return;
      }

      if (
        !universalOwnsWheel &&
        !event.ctrlKey &&
        !event.metaKey &&
        (
          dragScrollActive ||
          nodePointerDragActive ||
          optionPointerDragActive
        )
      ) {
        return;
      }

      if (session) {
        commitSelection();
      }

      if (!claimWheelEvent(event)) {
        return;
      }

      const selected =
        selectedFor(
          target,
          event.composedPath?.()
        );
      const descriptor =
        selected.descriptor;
      const element =
        selected.element ||
        resolveDescriptor(
          descriptor
        );

      if (!descriptor) {
        return;
      }

      if (!element) {
        scheduleVisualRefresh();

        if (selected.explicit) {
          showIndicator(
            "GLOBAL OVERRIDE · SELECTED LEVEL UNAVAILABLE",
            descriptor,
            {
              variant: "empty",
              duration: 1100
            }
          );
        }
        return;
      }

      const result =
        scrollDescriptor(
          event,
          descriptor,
          element,
          {
            overdrive:
              selected.explicit
          }
        );

      if (
        selected.explicit
      ) {
        showIndicator(
          result.moved
            ? "GLOBAL OVERRIDE · SCROLLING LOCKED LEVEL"
            : result.blocked
              ? "GLOBAL OVERRIDE · PAGE ROOT BLOCKED"
              : result.empty
                ? "GLOBAL OVERRIDE · LOCKED LEVEL EMPTY"
                : "GLOBAL OVERRIDE · LOCKED LEVEL EDGE",
          descriptor,
          {
            variant:
              result.moved
                ? "selected"
                : result.empty ||
                    result.blocked
                  ? "empty"
                  : "edge",
            duration: 900
          }
        );
      }
    };

  const descriptorHasHorizontalScroll =
    descriptor => {
      if (!descriptor) {
        return false;
      }

      let element =
        resolveDescriptor(
          descriptor
        );

      if (
        descriptor.kind ===
          "html-root"
      ) {
        element =
          documentScrollElement() ===
            htmlElement()
            ? htmlElement()
            : null;
      } else if (
        descriptor.kind ===
          "document-root"
      ) {
        element =
          documentScrollElement();
      }

      if (!(element instanceof HTMLElement)) {
        return false;
      }

      if (
        descriptor.kind ===
          "html-root" ||
        descriptor.kind ===
          "document-root"
      ) {
        return (
          element.scrollWidth >
          element.clientWidth + 1
        );
      }

      return scrollAxesForElement(
        element
      ).x;
    };

  const activeSelectionDescriptor =
    () =>
      session
        ?.candidates?.[
          session.index
        ] ||
      selection ||
      null;

  const releaseSelectionFromInput =
    () => {
      const previous =
        activeSelectionDescriptor();

      if (!previous) {
        return false;
      }

      clearSelection({
        keepIndicator: true
      });

      showIndicator(
        "SCROLL LEVEL RELEASED",
        previous,
        {
          variant: "cancelled",
          duration: 900
        }
      );

      return true;
    };

  const handleSelectionCancelClick =
    () => {
      releaseSelectionFromInput();
    };

  const handleSelectionCancelKeyDown =
    event => {
      if (!selection && !session) {
        return;
      }

      if (
        event.key === "Control" ||
        event.key === "Meta"
      ) {
        return;
      }

      if (
        event.key === "Shift" &&
        descriptorHasHorizontalScroll(
          activeSelectionDescriptor()
        )
      ) {
        return;
      }

      releaseSelectionFromInput();
    };

  const handleModifierKeyUp =
    event => {
      if (
        !session
      ) {
        return;
      }

      if (
        event.key === "Control" ||
        event.key === "Meta"
      ) {
        commitSelection();
      }
    };

  if (window.RMLScrollManager?.registerWheelHandler) {
    window.RMLScrollManager.registerWheelHandler(
      "universal-scroll-layers",
      event => {
        const before = event.defaultPrevented;
        handleWheel(event);
        return !before && event.defaultPrevented;
      },
      100
    );
  } else {
    window.addEventListener(
      "wheel",
      handleWheel,
      {
        capture: true,
        passive: false
      }
    );
  }

  document.addEventListener(
    "keydown",
    handleSelectionCancelKeyDown,
    {
      capture: true
    }
  );

  document.addEventListener(
    "keyup",
    handleModifierKeyUp,
    {
      capture: true
    }
  );

  document.addEventListener(
    "pointerdown",
    handleSelectionCancelClick,
    {
      capture: true
    }
  );

  document.addEventListener(
    "click",
    handleSelectionCancelClick,
    {
      capture: true
    }
  );

  document.addEventListener(
    "scroll",
    scheduleVisualRefresh,
    {
      capture: true,
      passive: true
    }
  );

  window.addEventListener(
    "resize",
    scheduleVisualRefresh,
    {
      passive: true
    }
  );

  window.visualViewport
    ?.addEventListener(
      "resize",
      scheduleVisualRefresh,
      {
        passive: true
      }
    );

  window.visualViewport
    ?.addEventListener(
      "scroll",
      scheduleVisualRefresh,
      {
        passive: true
      }
    );

  window.addEventListener(
    "blur",
    () => {
      if (session) {
        commitSelection();
      }
    }
  );

  Object.defineProperty(
    window,
    "RMLUniversalScrollLayers",
    {
      value: Object.freeze({
        clear() {
          clearSelection();
          return true;
        },
        commit() {
          return Boolean(
            commitSelection()
          );
        },
        refresh() {
          scheduleVisualRefresh();
          return true;
        },
        getState() {
          const preview =
            session
              ?.candidates?.[
                session.index
              ] ||
            null;

          return Object.freeze({
            active:
              Boolean(
                selection ||
                session
              ),
            cycling:
              Boolean(session),
            preview:
              preview?.label ||
              "",
            previewKey:
              preview?.key ||
              "",
            selected:
              selection?.label ||
              "",
            selectedKey:
              selection?.key ||
              "",
            globalOverride:
              Boolean(selection),
            outermost:
              "<html> · Page ROOT"
          });
        }
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );
}

async function initialize() {
  if (
    document.documentElement.dataset
      .rmlBuilderInitialized === "true"
  ) {
    return;
  }

  document.documentElement.dataset
    .rmlBuilderInitialized = "true";
  exposeRmlBuilderBuildId();

  ensureColorPickerAdaptiveFitLoaded();
  installUniversalScrollLayerSelector();
  installPalettePointerDragBridge();

  cacheElements();
  exposeBuilderDialogBridge();

  const startupWork =
    beginStartupStatus(
      "Restoring local workspace…"
    );
  await paintBuilderUi();

  preventGlobalDoubleSelection();
  await restore();
  startupWork.update({
      title: "Preparing controls and dialogs…",
      message:
        "Project metadata, palettes and interaction handlers are being synchronized.",
      progress: 46
    });
  renderMetadata();
  renderPalette();
  installSetupAssistantBridge();

  document
    .querySelectorAll(
      '.palette-group.structure [data-palette]'
    )
    .forEach(structureButton => {
      const type =
        structureButton.dataset.palette;

      structureButton.addEventListener("click", event => {
        if (
          consumePalettePointerClick(
            structureButton,
            event
          )
        ) {
          return;
        }

        addPaletteItem(
          type,
          state.activeContainerId
        );
      });

      const pointerBound =
        bindPalettePointerDrag(
          structureButton,
          {
            paletteType: type
          }
        );

      if (!pointerBound) {
        structureButton.addEventListener("dragstart", event => {
          beginDragScrolling(event);
          event.dataTransfer.setData(
            "application/x-rml-palette",
            type
          );
          event.dataTransfer.effectAllowed = "copy";
        });
        structureButton.addEventListener("dragend", finishDragInteraction);
      }
    });

  document.addEventListener(
    "dragover",
    updateDragScrolling,
    true
  );

  document.addEventListener(
    "pointermove",
    event => {
      if (
        !palettePointerDragActive &&
        palettePointerPendingButton &&
        event.pointerId ===
          palettePointerPendingId
      ) {
        if (
          event.pointerType === "mouse" &&
          (event.buttons & 1) !== 1
        ) {
          clearPendingPalettePointerDrag();
          return;
        }

        const distance =
          Math.hypot(
            event.clientX -
              palettePointerPendingStartX,
            event.clientY -
              palettePointerPendingStartY
          );

        if (distance >= 5) {
          startPalettePointerDrag(
            palettePointerPendingButton,
            palettePointerPendingPayload,
            event
          );
        }
      }

      if (
        !nodePointerDragActive &&
        nodePointerPendingCard &&
        event.pointerId ===
          nodePointerPendingId
      ) {
        if (
          event.pointerType === "mouse" &&
          (event.buttons & 1) !== 1
        ) {
          clearPendingNodePointerDrag();
          return;
        }

        const distance =
          Math.hypot(
            event.clientX -
              nodePointerPendingStartX,
            event.clientY -
              nodePointerPendingStartY
          );

        if (distance >= 5) {
          startNodePointerDrag(
            nodePointerPendingCard,
            event
          );
        }
      }

      if (
        !optionPointerDragActive &&
        optionPointerPendingLane &&
        event.pointerId ===
          optionPointerPendingId
      ) {
        if (
          event.pointerType === "mouse" &&
          (event.buttons & 1) !== 1
        ) {
          clearPendingOptionPointerDrag();
          return;
        }

        const distance =
          Math.hypot(
            event.clientX -
              optionPointerPendingStartX,
            event.clientY -
              optionPointerPendingStartY
          );

        if (distance >= 5) {
          startOptionPointerDrag(
            optionPointerPendingLane,
            event
          );
        }
      }

      const optionDrag =
        optionPointerDragActive &&
        event.pointerId ===
          optionPointerId;

      const nodeDrag =
        nodePointerDragActive &&
        event.pointerId ===
          nodePointerId;

      const paletteDrag =
        palettePointerDragActive &&
        event.pointerId ===
          palettePointerId;

      if (
        !optionDrag &&
        !nodeDrag &&
        !paletteDrag
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      dragPointerY =
        event.clientY;

      requestDragPlaceholderVisibility();

      if (optionDrag) {
        scheduleOptionPointerTargetUpdate(
          event.clientX,
          event.clientY
        );
      } else if (paletteDrag) {
        schedulePalettePointerTargetUpdate(
          event.clientX,
          event.clientY
        );
      } else {
        scheduleNodePointerTargetUpdate(
          event.clientX,
          event.clientY
        );
      }
    },
    {
      capture: true,
      passive: false
    }
  );

  document.addEventListener(
    "pointerup",
    event => {
      if (
        palettePointerPendingButton &&
        event.pointerId ===
          palettePointerPendingId &&
        !palettePointerDragActive
      ) {
        clearPendingPalettePointerDrag();
        return;
      }

      if (
        optionPointerPendingLane &&
        event.pointerId ===
          optionPointerPendingId &&
        !optionPointerDragActive
      ) {
        clearPendingOptionPointerDrag();
        return;
      }

      if (
        nodePointerPendingCard &&
        event.pointerId ===
          nodePointerPendingId &&
        !nodePointerDragActive
      ) {
        clearPendingNodePointerDrag();
        return;
      }

      const optionDrag =
        optionPointerDragActive &&
        event.pointerId ===
          optionPointerId;

      const nodeDrag =
        nodePointerDragActive &&
        event.pointerId ===
          nodePointerId;

      const paletteDrag =
        palettePointerDragActive &&
        event.pointerId ===
          palettePointerId;

      if (
        !optionDrag &&
        !nodeDrag &&
        !paletteDrag
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (optionDrag) {
        if (!heldOptionWheelTargetIsAuthoritative()) {
          updateOptionPointerTarget(
            event.clientX,
            event.clientY
          );
        }

        finishOptionPointerDrag(
          true
        );
      } else if (paletteDrag) {
        updatePalettePointerTarget(
          event.clientX,
          event.clientY
        );

        finishPalettePointerDrag(
          true
        );
      } else {
        updateNodePointerTarget(
          event.clientX,
          event.clientY
        );

        finishNodePointerDrag(
          true
        );
      }
    },
    {
      capture: true,
      passive: false
    }
  );

  document.addEventListener(
    "pointercancel",
    event => {
      if (
        palettePointerPendingButton &&
        event.pointerId ===
          palettePointerPendingId &&
        !palettePointerDragActive
      ) {
        clearPendingPalettePointerDrag();
        return;
      }

      if (
        optionPointerPendingLane &&
        event.pointerId ===
          optionPointerPendingId &&
        !optionPointerDragActive
      ) {
        clearPendingOptionPointerDrag();
        return;
      }

      if (
        nodePointerPendingCard &&
        event.pointerId ===
          nodePointerPendingId &&
        !nodePointerDragActive
      ) {
        clearPendingNodePointerDrag();
        return;
      }

      const optionDrag =
        optionPointerDragActive &&
        event.pointerId ===
          optionPointerId;

      const nodeDrag =
        nodePointerDragActive &&
        event.pointerId ===
          nodePointerId;

      const paletteDrag =
        palettePointerDragActive &&
        event.pointerId ===
          palettePointerId;

      if (
        !optionDrag &&
        !nodeDrag &&
        !paletteDrag
      ) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (optionDrag) {
        finishOptionPointerDrag(
          false
        );
      } else if (paletteDrag) {
        finishPalettePointerDrag(
          false
        );
      } else {
        finishNodePointerDrag(
          false
        );
      }
    },
    {
      capture: true,
      passive: false
    }
  );

  document.addEventListener(
    "keydown",
    event => {
      if (event.key !== "Escape") {
        return;
      }

      const dragIsActive =
        dragScrollActive ||
        nodePointerDragActive ||
        palettePointerDragActive ||
        optionPointerDragActive ||
        Boolean(activeDraggedNodeId) ||
        Boolean(activeDraggedOptionId);

      if (!dragIsActive) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      const restoreX =
        dragScrollOriginX;

      const restoreY =
        dragScrollOriginY;

      if (nodePointerDragActive) {
        finishNodePointerDrag(false);
      }
      else if (palettePointerDragActive) {
        finishPalettePointerDrag(false);
      }
      else if (optionPointerDragActive) {
        finishOptionPointerDrag(false);
      }
      else {
        finishDragInteraction();
      }

      clearPendingNodePointerDrag();
      clearPendingOptionPointerDrag();
      clearPendingPalettePointerDrag();

      window.scrollTo({
        left: restoreX,
        top: restoreY,
        behavior: "auto"
      });

      requestAnimationFrame(() => {
        window.scrollTo({
          left: restoreX,
          top: restoreY,
          behavior: "auto"
        });
      });
    },
    {
      capture: true
    }
  );

  document.addEventListener(
    "wheel",
    event => {
      const dominantWheelDelta =
        Math.abs(event.deltaX) >
        Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;

      const direction =
        Math.sign(dominantWheelDelta);

      if (direction === 0) {
        return;
      }

      if (
        (
          (
            nodePointerDragActive &&
            activeDraggedNodeId
          ) ||
          (
            palettePointerDragActive &&
            palettePointerPayload
          )
        ) &&
        nodeWheelTargetHost &&
        nodeWheelTargetHost.isConnected &&
        nodeWheelTargetContainerId
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();

        nodeWheelDelta +=
          dominantWheelDelta;

        if (
          Math.abs(nodeWheelDelta) < 30
        ) {
          return;
        }

        nodeWheelDelta = 0;
        stepNodeInsertWithWheel(direction);
        requestDragPlaceholderVisibility();
        return;
      }

      if (
        optionPointerDragActive &&
        activeDraggedOptionId &&
        activeDraggedOptionControllerId
      ) {
        if (
          optionWheelTargetHost &&
          optionWheelTargetHost.isConnected &&
          optionWheelTargetControllerId
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          optionWheelDelta +=
            dominantWheelDelta;

          if (
            Math.abs(optionWheelDelta) < 30
          ) {
            return;
          }

          optionWheelDelta = 0;

          stepOptionInsertWithWheel(
            optionWheelTargetControllerId,
            optionWheelTargetHost,
            direction
          );

          requestDragPlaceholderVisibility();
          return;
        }

        if (
          optionContainerWheelTargetHost &&
          optionContainerWheelTargetHost.isConnected &&
          optionContainerWheelTargetContainerId
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();

          optionContainerWheelDelta +=
            dominantWheelDelta;

          if (
            Math.abs(
              optionContainerWheelDelta
            ) < 30
          ) {
            return;
          }

          optionContainerWheelDelta = 0;

          stepOptionContainerInsertWithWheel(
            direction
          );

          requestDragPlaceholderVisibility();
        }
      }
    },
    {
      capture: true,
      passive: false
    }
  );


  document.addEventListener(
    "drop",
    event => {
      if (!event.defaultPrevented) {
        finishDragInteraction();
      }
    }
  );

  document.addEventListener(
    "dragend",
    finishDragInteraction,
    true
  );

  document
    .getElementById("load-example")
    .addEventListener(
      "click",
      async () => {
        if (builderHasActiveProject()) {
          closeProjectDialog();
          await paintBuilderUi();

          const confirmed =
            await confirmBuilderAction({
              tone: "warning",
              kicker: "Project replacement",
              title: "Replace the current project with the complete example?",
              message:
                "The complete example replaces the open Configuration Outline, Typed Runtime Graph and project metadata.",
              details:
                "This action is intentionally blocked until you confirm it. Save the current project as JSON first if you want to keep a portable backup.",
              confirmLabel: "Load Complete Example"
            });

          if (!confirmed) {
            openProjectDialog();
            setProjectFileStatus(
              "Example loading was cancelled."
            );
            return;
          }
        }

        try {
          await loadExampleProject();
        } catch (error) {
          console.warn(
            "Could not load the external example project.",
            error
          );
          const message =
            error instanceof Error
              ? error.message
              : `${EXAMPLE_PROJECT_FILE_NAME} could not be loaded.`;
          setProjectFileStatus(
            `Could not load the example: ${message}`,
            "error"
          );
          await showBuilderNotice({
            tone: "warning",
            kicker: "Example project unavailable",
            title: `${EXAMPLE_PROJECT_FILE_NAME} could not be loaded`,
            message,
            details:
              "Keep Load Example.json beside index.html. For a local Windows start, use Start Builder.cmd instead of opening index.html directly.",
            confirmLabel: "OK"
          });
        }
      }
    );
  document
    .getElementById("new-blank")
    .addEventListener("click", newBlank);
  elements.copyCodeBottom.addEventListener("click", () =>
    copyGeneratedCodeForCurrentView(
      elements.copyCodeBottom
    )
  );
  elements.generatedFileSelect.addEventListener(
    "change",
    () => {
      const graphViewActive =
        Boolean(
          state.extensions?.typedNodeGraph
            ?.active === true
        );

      if (graphViewActive) {
        generatedGraphArtifactKey =
          elements.generatedFileSelect.value;
      } else {
        generatedOutlineArtifactKey =
          elements.generatedFileSelect.value;
      }

      updateGeneratedOutput();
    }
  );
  elements.topMenuToggle?.addEventListener(
    "click",
    toggleTopMenu
  );

  elements.topActions?.addEventListener(
    "click",
    event => {
      const actionButton = event.composedPath().find(
        candidate =>
          candidate instanceof HTMLButtonElement &&
          elements.topActions?.contains(candidate)
      );
      if (
        actionButton &&
        window.matchMedia(
          "(max-width: 780px)"
        ).matches
      ) {
        setTopMenuOpen(false);
      }
    }
  );

  window.addEventListener(
    "resize",
    () => {
      if (
        window.innerWidth > 780
      ) {
        setTopMenuOpen(false);
      }
    },
    { passive: true }
  );

  installDelayedButtonHelp();

  elements.informationOpen.addEventListener(
    "click",
    () => void openInformationDialog()
  );
  elements.setupGuideOpen?.addEventListener(
    "click",
    () => void ensureSetupAssistantLoaded(false)
  );
  elements.settingsPreviewOpen.addEventListener(
    "click",
    openSettingsPreview
  );
  elements.settingsPreviewClose.addEventListener(
    "click",
    () => closeSettingsPreview()
  );
  elements.settingsPreviewRuntimeActions?.addEventListener(
    "click",
    event => {
      const actionButton =
        event.target instanceof Element
          ? event.target.closest(
              "[data-preview-runtime-action]"
            )
          : null;

      if (!actionButton) {
        return;
      }

      const messages = {
        deactivate:
          "Preview only: Deactivate stops a compatible generated mod at runtime.",
        reload:
          "Preview only: Reload loads the updated generated mod DLL.",
        quarantine:
          "Preview only: Quarantine removes the mod from the list and moves its DLL safely."
      };
      const action =
        actionButton.dataset.previewRuntimeAction;

      setSettingsPreviewStatus(
        messages[action] ||
          "This runtime action is shown for layout preview only."
      );
    }
  );
  elements.settingsPreviewContent.addEventListener(
    "click",
    handleSettingsPreviewClick
  );
  elements.settingsPreviewContent.addEventListener(
    "input",
    handleSettingsPreviewInput
  );
  elements.settingsPreviewSavePanel.addEventListener(
    "click",
    event => {
      if (
        event.target.closest(
          "[data-preview-color-cancel]"
        )
      ) {
        closeSettingsPreviewColor(false);
        return;
      }

      if (
        event.target.closest(
          "[data-preview-color-apply]"
        )
      ) {
        closeSettingsPreviewColor(true);
        return;
      }

      if (
        event.target.closest(
          "#settings-preview-save"
        )
      ) {
        saveSettingsPreview();
      }
    }
  );
  elements.settingsPreviewDialog.addEventListener(
    "cancel",
    event => {
      event.preventDefault();

      if (settingsPreviewColorSession) {
        closeSettingsPreviewColor(false);
      } else {
        closeSettingsPreview();
      }
    }
  );
  elements.settingsPreviewDialog.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        elements.settingsPreviewDialog
      ) {
        closeSettingsPreview();
      }
    }
  );
  elements.projectManager.addEventListener(
    "click",
    openProjectDialog
  );
  elements.projectClose.addEventListener(
    "click",
    () => {
      cancelActiveProjectLoad();
      closeProjectDialog();
    }
  );
  elements.projectDone.addEventListener(
    "click",
    () => {
      cancelActiveProjectLoad();
      closeProjectDialog();
    }
  );
  elements.projectSaveJson.addEventListener(
    "click",
    saveProjectJson
  );
  elements.projectLoadJson.addEventListener(
    "click",
    () =>
      elements.projectFileInput.click()
  );
  elements.projectFileInput.addEventListener(
    "change",
    () =>
      loadProjectJsonFile(
        elements.projectFileInput.files?.[0]
      )
  );
  elements.projectDialog.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        elements.projectDialog
      ) {
        cancelActiveProjectLoad();
        closeProjectDialog();
      }
    }
  );
  elements.projectDialog.addEventListener(
    "cancel",
    cancelActiveProjectLoad
  );
  elements.builderMessageCancel.addEventListener(
    "click",
    () => resolveBuilderMessage(false)
  );
  elements.builderMessageConfirm.addEventListener(
    "click",
    () => resolveBuilderMessage(true)
  );
  elements.builderMessageDialog.addEventListener(
    "cancel",
    event => {
      event.preventDefault();
      resolveBuilderMessage(false);
    }
  );
  elements.builderMessageDialog.addEventListener(
    "click",
    event => {
      if (
        event.target ===
        elements.builderMessageDialog
      ) {
        resolveBuilderMessage(false);
      }
    }
  );
  elements.builderMessageDialog.addEventListener(
    "close",
    () => {
      if (activeBuilderMessageResolver) {
        resolveBuilderMessage(
          false,
          false
        );
      }
    }
  );
  elements.downloadCode.addEventListener("click", openExportDialog);
  elements.exportClose.addEventListener("click", closeExportDialog);
  elements.exportCancel.addEventListener("click", closeExportDialog);
  elements.exportPlatform.addEventListener(
    "change",
    applyExportPlatformPreset
  );
  elements.exportResonitePath.addEventListener(
    "input",
    syncEditedResonitePath
  );
  elements.exportResonitePath.addEventListener("change", () => {
    elements.exportResonitePath.value =
      normalizedResonitePath(
        elements.exportResonitePath.value
      );
    syncEditedResonitePath();
  });
  elements.exportIncludeCs.addEventListener(
    "change",
    syncExportOptions
  );
  elements.exportIncludeCsproj.addEventListener(
    "change",
    syncExportOptions
  );
  elements.exportCopySelectedFile.addEventListener(
    "click",
    () => {
      syncExportOptions();
      copySelectedExportArtifact(
        elements.exportCopySelectedFile
      );
    }
  );
  elements.exportDownloadSelected.addEventListener(
    "click",
    downloadSelectedExport
  );
  elements.exportDialog.addEventListener("click", event => {
    if (event.target === elements.exportDialog) {
      closeExportDialog();
    }
  });

  window.addEventListener(
    "resize",
    scheduleAdaptiveUtilityDialogs,
    {
      passive: true
    }
  );

  window.addEventListener(
    "orientationchange",
    scheduleAdaptiveUtilityDialogs,
    {
      passive: true
    }
  );

  window.visualViewport?.addEventListener(
    "resize",
    scheduleAdaptiveUtilityDialogs,
    {
      passive: true
    }
  );

  ensureUniversalCustomSelect(
    elements.exportPlatform
  );
  startUniversalCustomSelectObserver();

  exposeBuilderBridge();
  beginTypedNodeGraphModulesTracking();

  const startupGraph =
    state.extensions?.typedNodeGraph;
  const startupExpectedNodes =
    Array.isArray(startupGraph?.nodes)
      ? startupGraph.nodes.length
      : 0;
  const startupExpectedConnections =
    Array.isArray(startupGraph?.connections)
      ? startupGraph.connections.length
      : 0;
  const startupGraphReady =
    waitForImportedGraphUi(
      startupExpectedNodes,
      startupExpectedConnections
    );
  startupWork.update({
      title: "Rendering the first usable frame…",
      message:
        startupExpectedNodes > 1000 ||
        startupExpectedConnections > 2000
          ? `Preparing the complete ${startupExpectedNodes.toLocaleString()}-node and ${startupExpectedConnections.toLocaleString()}-connection scene.`
          : "The restored project and all utility dialogs are ready to enter the interface.",
      progress: 76
    });
  if (startupWork.visible) {
    await paintBuilderUi();
  }
  renderAll();

  const startupGraphResult =
    await startupGraphReady;
  startupWork.update({
      title: "Builder ready",
      message:
        "The first interface frame and all dialog handlers are ready.",
      detail:
        startupGraphResult.timedOut
          ? "The graph renderer did not confirm completion before its safety deadline; its persistent Runtime Graph control reports the current readiness state."
          : "Workspace restoration completed successfully.",
      progress: 100
    });
  if (startupWork.visible) {
    await paintBuilderUi();
  }
  startupWork.finish();

  document.dispatchEvent(
    new CustomEvent(
      "rml-builder:ready"
    )
  );

  if (initialExampleProjectLoadError) {
    const error =
      initialExampleProjectLoadError;
    initialExampleProjectLoadError = null;

    await showBuilderNotice({
      tone: "warning",
      kicker: "First-start example unavailable",
      title: `${EXAMPLE_PROJECT_FILE_NAME} was not loaded`,
      message: error.message,
      details:
        "The builder started with a blank project and did not use any embedded fallback. Keep Load Example.json beside index.html and launch Start Builder.cmd for automatic local loading.",
      confirmLabel: "OK"
    });
  }

  
  
  
  
  await paintBuilderUi();
  const visualTourTest =
    new URLSearchParams(
      window.location.search
    ).has("rmlTourTest") ||
    window.location.hash.includes(
      "rmlTourTest"
    );
  void ensureSetupAssistantLoaded(
    !visualTourTest
  );
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    { once: true }
  );
} else {
  initialize();
}

const RML_RUNTIME_DISPLAY_VALUE_TYPE =
  "runtimeDisplay";

function rmlRuntimeDisplayIsNode(node) {
  return Boolean(
    node &&
    node.kind === "setting" &&
    node.valueType ===
      RML_RUNTIME_DISPLAY_VALUE_TYPE
  );
}

function rmlRuntimeDisplayWalk(
  nodes = state.nodes,
  result = []
) {
  for (const node of
    Array.isArray(nodes) ? nodes : []) {
    if (rmlRuntimeDisplayIsNode(node)) {
      result.push(node);
    }

    if (node?.kind === "controller") {
      for (const option of
        Array.isArray(node.options)
          ? node.options
          : []) {
        rmlRuntimeDisplayWalk(
          option.children,
          result
        );
      }
    } else if (node?.kind === LAYOUT_ROW_KIND) {
      rmlRuntimeDisplayWalk(
        node.children,
        result
      );
    }
  }

  return result;
}

function rmlRuntimeDisplayFindNode(
  id,
  nodes = state.nodes
) {
  for (const node of
    Array.isArray(nodes) ? nodes : []) {
    if (node?.id === id) {
      return node;
    }

    if (node?.kind === "controller") {
      for (const option of
        Array.isArray(node.options)
          ? node.options
          : []) {
        const found =
          rmlRuntimeDisplayFindNode(
            id,
            option.children
          );

        if (found) {
          return found;
        }
      }
    } else if (
      node?.kind === LAYOUT_ROW_KIND
    ) {
      const found =
        rmlRuntimeDisplayFindNode(
          id,
          node.children
        );

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function rmlRuntimeDisplayRemoveNode(
  id,
  nodes = state.nodes
) {
  const list =
    Array.isArray(nodes)
      ? nodes
      : [];

  const index =
    list.findIndex(
      node =>
        node?.id === id
    );

  if (index >= 0) {
    list.splice(index, 1);
    return true;
  }

  for (const node of list) {
    if (node?.kind === "controller") {
      for (const option of
        Array.isArray(node.options)
          ? node.options
          : []) {
        if (
          rmlRuntimeDisplayRemoveNode(
            id,
            option.children
          )
        ) {
          return true;
        }
      }
    } else if (
      node?.kind === LAYOUT_ROW_KIND &&
      rmlRuntimeDisplayRemoveNode(
        id,
        node.children
      )
    ) {
      return true;
    }
  }

  return false;
}

function rmlRuntimeDisplayGraphBindings() {
  const graph =
    state.extensions?.typedNodeGraph;
  const nodes =
    Array.isArray(graph?.nodes)
      ? graph.nodes
      : [];
  const connections =
    Array.isArray(graph?.connections)
      ? graph.connections
      : [];
  const configurationIds =
    new Set(
      nodes
        .filter(node =>
          node?.kind === "configuration"
        )
        .map(node => String(node.id || ""))
        .filter(Boolean)
    );
  const monitors =
    new Map(
      nodes
        .filter(node =>
          node?.kind === "operator" &&
          (
            node.operatorId ===
              "resonite.displayValue" ||
            node.operatorId ===
              "debug.displayImpulse"
          )
        )
        .map(node => [
          String(node.id || ""),
          node
        ])
        .filter(([id]) => Boolean(id))
    );
  const bindings = new Map();

  for (const connection of connections) {
    if (
      !configurationIds.has(
        String(connection?.fromNode || "")
      ) ||
      connection?.toPort !== "rmlMenu" ||
      !String(connection?.fromPort || "")
        .startsWith("config-")
    ) {
      continue;
    }

    const monitor =
      monitors.get(
        String(connection.toNode || "")
      );
    const outlineId =
      String(connection.fromPort)
        .slice("config-".length);
    const outlineNode =
      rmlRuntimeDisplayFindNode(
        outlineId
      );

    if (
      !monitor ||
      !rmlRuntimeDisplayIsNode(
        outlineNode
      )
    ) {
      continue;
    }

    const list =
      bindings.get(outlineId) || [];

    list.push({
      outlineId,
      monitorId:
        String(monitor.id || ""),
      label:
        String(
          monitor.label ||
          (
            monitor.operatorId ===
              "debug.displayImpulse"
              ? "Display Impulse"
              : "Display Value"
          )
        ),
      connectionId:
        String(connection.id || ""),
      sequence:
        Number(monitor.sequence) || 0
    });

    bindings.set(
      outlineId,
      list
    );
  }

  for (const [outlineId, list] of bindings) {
    const unique = [];
    const seen = new Set();

    for (const binding of list) {
      if (
        !binding.monitorId ||
        seen.has(binding.monitorId)
      ) {
        continue;
      }

      seen.add(binding.monitorId);
      unique.push(binding);
    }

    unique.sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.monitorId.localeCompare(
          right.monitorId
        )
    );

    bindings.set(
      outlineId,
      unique
    );
  }

  return bindings;
}

function rmlRuntimeDisplayBindingsFor(
  node
) {
  const bindings =
    rmlRuntimeDisplayGraphBindings()
      .get(String(node?.id || "")) ||
    [];

  const order =
    Array.isArray(
      node?.runtimeDisplayOrder
    )
      ? node.runtimeDisplayOrder
          .map(value =>
            String(value || "")
          )
          .filter(Boolean)
      : [];
  const rank =
    new Map(
      order.map(
        (monitorId, index) => [
          monitorId,
          index
        ]
      )
    );

  return [...bindings].sort(
    (left, right) => {
      const leftRank =
        rank.has(left.monitorId)
          ? rank.get(left.monitorId)
          : Number.MAX_SAFE_INTEGER;
      const rightRank =
        rank.has(right.monitorId)
          ? rank.get(right.monitorId)
          : Number.MAX_SAFE_INTEGER;

      return (
        leftRank - rightRank ||
        left.sequence - right.sequence ||
        left.monitorId.localeCompare(
          right.monitorId
        )
      );
    }
  );
}

function rmlRuntimeDisplayBindingFor(
  node
) {
  return (
    rmlRuntimeDisplayBindingsFor(node)[0] ||
    null
  );
}

function rmlRuntimeDisplaySyncOrder(
  node,
  bindings =
    rmlRuntimeDisplayBindingsFor(node)
) {
  if (!rmlRuntimeDisplayIsNode(node)) {
    return [];
  }

  const available =
    bindings.map(binding =>
      String(binding.monitorId || "")
    ).filter(Boolean);
  const availableSet =
    new Set(available);
  const existing =
    Array.isArray(node.runtimeDisplayOrder)
      ? node.runtimeDisplayOrder
          .map(value =>
            String(value || "")
          )
          .filter(value =>
            availableSet.has(value)
          )
      : [];
  const seen =
    new Set(existing);

  for (const monitorId of available) {
    if (!seen.has(monitorId)) {
      existing.push(monitorId);
      seen.add(monitorId);
    }
  }

  node.runtimeDisplayOrder =
    existing;
  return existing;
}

function rmlRuntimeDisplayNormalizeNode(
  node
) {
  if (!rmlRuntimeDisplayIsNode(node)) {
    return node;
  }

  node.fieldName =
    String(
      node.fieldName ||
      "RuntimeDisplay"
    ).trim() ||
    "RuntimeDisplay";

  node.keyName =
    String(
      node.keyName ||
      "runtime_display"
    ).trim() ||
    "runtime_display";

  node.description =
    String(
      node.description ||
      "Read-only value published by the generated Typed Runtime Graph."
    );

  node.customValidator =
    String(
      node.customValidator ||
      "Runtime value unavailable"
    );

  node.runtimeDisplayOrder =
    [...new Set(
      (Array.isArray(node.runtimeDisplayOrder)
        ? node.runtimeDisplayOrder
        : [])
        .map(value =>
          String(value || "")
        )
        .filter(Boolean)
    )];

  node.runtimeDisplayStacked =
    node.runtimeDisplayStacked === true;

  node.layoutWidthPercent =
    Number.isFinite(
      Number(node.layoutWidthPercent)
    ) &&
    Number(node.layoutWidthPercent) > 0
      ? clamp(
          Number(node.layoutWidthPercent),
          1,
          100
        )
      : undefined;

  node.hideLabel =
    node.hideLabel === true;

  node.defaultValue = "";

  node.reaction = "stored";
  node.validatorMode = "none";
  node.useSlider = false;
  node.hidden = false;

  return node;
}

function rmlRuntimeDisplayEscapeCSharp(
  value
) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/\t/g, "\\t")
    .replace(/\0/g, "\\0")
    .replace(/"/g, '\\"');
}

function rmlRuntimeDisplayIdentifier(
  value,
  fallback = "RuntimeDisplay"
) {
  let identifier =
    String(value || "")
      .replace(/[^A-Za-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");

  if (!identifier) {
    identifier = fallback;
  }

  if (/^[0-9]/.test(identifier)) {
    identifier =
      `Value_${identifier}`;
  }

  return identifier;
}

function rmlRuntimeDisplayToken(
  value
) {
  let hash = 2166136261;

  for (const character of
    String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(
      hash,
      16777619
    ) >>> 0;
  }

  return hash
    .toString(16)
    .padStart(8, "0");
}

function rmlRuntimeDisplayFlattenOrder(
  nodes = state.nodes,
  result = []
) {
  for (const node of
    Array.isArray(nodes) ? nodes : []) {
    result.push(node);

    if (node?.kind === "controller") {
      for (const option of
        Array.isArray(node.options)
          ? node.options
          : []) {
        rmlRuntimeDisplayFlattenOrder(
          option.children,
          result
        );
      }
    } else if (node?.kind === LAYOUT_ROW_KIND) {
      rmlRuntimeDisplayFlattenOrder(
        node.children,
        result
      );
    }
  }

  return result;
}

function rmlRuntimeDisplayApplyAbsoluteConfigurationOrder(
  source
) {
  let result = String(source || "");
  const ordered =
    rmlRuntimeDisplayFlattenOrder();

  for (
    let order = 0;
    order < ordered.length;
    order += 1
  ) {
    const node = ordered[order];

    if (
      !node ||
      node.kind === LAYOUT_ROW_KIND ||
      rmlRuntimeDisplayIsNode(node)
    ) {
      continue;
    }

    const field = toPascalCase(
      node.fieldName,
      "Setting"
    );
    const escapedField =
      field.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );
    const branch =
      new RegExp(
        `(if\\s*\\(ReferenceEquals\\(\\s*key,\\s*${escapedField}\\s*\\)\\)\\s*\\{\\s*return\\s+)\\d+(\\s*;)`,
        "m"
      );

    result = result.replace(
      branch,
      `$1${order}$2`
    );
  }

  return result;
}

function rmlRuntimeDisplaySetCoreDirty() {
  try { persist(); } catch {}
  try { renderAll(); } catch {}
  try { updateGeneratedOutput(); } catch {}
  try {
    scheduleTypedNodeGraphOutputRefresh();
  } catch {
  }
}

let rmlRuntimeDisplayInspectorRendering =
  false;

function rmlRuntimeDisplayInspector() {
  if (
    document.body.classList.contains(
      "rml-node-graph-mode"
    )
  ) {
    return false;
  }

  const selected =
    rmlRuntimeDisplayFindNode(
      state.selectedId
    );

  if (!rmlRuntimeDisplayIsNode(
        selected)) {
    return false;
  }

  rmlRuntimeDisplayNormalizeNode(
    selected
  );

  const host =
    document.getElementById(
      "inspector-content"
    );

  if (!host) {
    return false;
  }

  const bindings =
    rmlRuntimeDisplayBindingsFor(
      selected
    );

  rmlRuntimeDisplaySyncOrder(
    selected,
    bindings
  );

  const orderedBindings =
    rmlRuntimeDisplayBindingsFor(
      selected
    );

  const signature =
    JSON.stringify({
      id: selected.id,
      fieldName: selected.fieldName,
      keyName: selected.keyName,
      description:
        selected.description,
      fallback:
        selected.customValidator,
      order:
        selected.runtimeDisplayOrder,
      stacked:
        selected.runtimeDisplayStacked,
      layoutWidthPercent:
        selected.layoutWidthPercent,
      hideLabel:
        selected.hideLabel,
      bindings:
        orderedBindings.map(
          binding => [
            binding.monitorId,
            binding.label,
            binding.connectionId
          ]
        )
    });

  if (
    !rmlRuntimeDisplayInspectorRendering &&
    host.dataset
      .rmlRuntimeDisplaySignature ===
        signature &&
    host.querySelector(
      ".rml-runtime-display-inspector"
    )
  ) {
    return true;
  }

  if (rmlRuntimeDisplayInspectorRendering) {
    return true;
  }

  rmlRuntimeDisplayInspectorRendering =
    true;
  host.dataset
    .rmlRuntimeDisplaySignature =
      signature;
  host.replaceChildren();

  const form =
    document.createElement(
      "div"
    );
  form.className =
    "inspector-form rml-runtime-display-inspector";

  const heading =
    document.createElement(
      "div"
    );
  heading.className =
    "selection-type";

  const type =
    document.createElement(
      "span"
    );
  type.textContent =
    "RML MENU DISPLAY";

  const remove =
    document.createElement(
      "button"
    );
  remove.type = "button";
  remove.textContent =
    "Delete";
  remove.addEventListener(
    "click",
    async () => {
      if (
        !(await confirmBuilderAction({
          tone: "danger",
          kicker: "Runtime display",
          title: "Delete this Runtime Display?",
          message:
            "The display item and its configured runtime values are removed from the Configuration Outline.",
          details:
            "Runtime Graph references to this item may become invalid.",
          confirmLabel: "Delete Display"
        }))
      ) {
        return;
      }

      rmlRuntimeDisplayRemoveNode(
        selected.id
      );
      state.selectedId = null;
      rmlRuntimeDisplaySetCoreDirty();
    }
  );

  heading.append(
    type,
    remove
  );
  form.appendChild(heading);

  const createTextField = (
    labelText,
    value,
    onInput,
    options = {}
  ) => {
    const label =
      document.createElement(
        "label"
      );
    label.textContent =
      labelText;

    const input =
      options.multiline
        ? document.createElement(
            "textarea"
          )
        : document.createElement(
            "input"
          );

    input.value =
      String(value || "");

    if (options.placeholder) {
      input.placeholder =
        options.placeholder;
    }

    input.addEventListener(
      "input",
      () => {
        onInput(input.value);
        rmlRuntimeDisplaySetCoreDirty();
      }
    );

    label.appendChild(input);
    return label;
  };

  form.appendChild(
    createTextField(
      "Display label",
      selected.fieldName,
      value => {
        selected.fieldName =
          value.slice(0, 120);
      },
      {
        placeholder:
          "Runtime value"
      }
    )
  );

  form.appendChild(
    createTextField(
      "Description",
      selected.description,
      value => {
        selected.description =
          value.slice(0, 500);
      },
      {
        multiline: true,
        placeholder:
          "Read-only runtime value shown in the RML mod menu."
      }
    )
  );

  const bindingStatus =
    document.createElement("div");
  bindingStatus.className =
    "rml-runtime-display-source-status";
  bindingStatus.dataset.state =
    orderedBindings.length > 0
      ? "ready"
      : "missing";

  if (orderedBindings.length === 0) {
    bindingStatus.textContent =
      "Not connected yet. In Typed Runtime Graph, connect this Start-node output to the RML Menu input of one or more Display Value nodes.";
  } else {
    const bindingTitle =
      document.createElement("strong");
    bindingTitle.className =
      "rml-runtime-display-source-title";
    bindingTitle.textContent =
      orderedBindings.length === 1
        ? "Displayed value"
        : `Displayed values · ${orderedBindings.length}`;

    const bindingHint =
      document.createElement("small");
    bindingHint.textContent =
      orderedBindings.length === 1
        ? "Connect more Display Value nodes to the same Start output. They stay side by side by default."
        : selected.runtimeDisplayStacked
          ? "Order here controls the top-to-bottom order in the RML menu."
          : "Order here controls the left-to-right order in one RML menu row.";

    const bindingList =
      document.createElement("div");
    bindingList.className =
      "rml-runtime-display-source-list";

    orderedBindings.forEach(
      (binding, index) => {
        const row =
          document.createElement("div");
        row.className =
          "rml-runtime-display-source-row";

        const position =
          document.createElement("span");
        position.className =
          "rml-runtime-display-source-index";
        position.textContent =
          String(index + 1);

        const label =
          document.createElement("span");
        label.className =
          "rml-runtime-display-source-label";
        label.textContent =
          binding.label ||
          "Display Value";

        const controls =
          document.createElement("div");
        controls.className =
          "rml-runtime-display-order-controls";

        const move = delta => {
          const order =
            rmlRuntimeDisplaySyncOrder(
              selected,
              orderedBindings
            );
          const currentIndex =
            order.indexOf(
              binding.monitorId
            );
          const nextIndex =
            currentIndex + delta;

          if (
            currentIndex < 0 ||
            nextIndex < 0 ||
            nextIndex >= order.length
          ) {
            return;
          }

          [
            order[currentIndex],
            order[nextIndex]
          ] = [
            order[nextIndex],
            order[currentIndex]
          ];

          selected.runtimeDisplayOrder =
            [...order];
          rmlRuntimeDisplaySetCoreDirty();
        };

        const up =
          document.createElement("button");
        up.type = "button";
        up.textContent =
          selected.runtimeDisplayStacked
            ? "↑"
            : "←";
        up.title =
          selected.runtimeDisplayStacked
            ? "Move this value up"
            : "Move this value left";
        up.disabled =
          index === 0;
        up.addEventListener(
          "click",
          () => move(-1)
        );

        const down =
          document.createElement("button");
        down.type = "button";
        down.textContent =
          selected.runtimeDisplayStacked
            ? "↓"
            : "→";
        down.title =
          selected.runtimeDisplayStacked
            ? "Move this value down"
            : "Move this value right";
        down.disabled =
          index ===
          orderedBindings.length - 1;
        down.addEventListener(
          "click",
          () => move(1)
        );

        controls.append(
          up,
          down
        );
        row.append(
          position,
          label,
          controls
        );
        bindingList.appendChild(
          row
        );
      }
    );

    bindingStatus.append(
      bindingTitle,
      bindingHint,
      bindingList
    );
  }

  form.appendChild(bindingStatus);

  const stackToggle =
    document.createElement("label");
  stackToggle.className =
    "toggle-row rml-runtime-display-layout-toggle";

  const stackToggleText =
    document.createElement("span");
  const stackToggleTitle =
    document.createElement("strong");
  stackToggleTitle.textContent =
    "Stack values vertically";
  const stackToggleHelp =
    document.createElement("small");
  stackToggleHelp.textContent =
    "Off (default): every connected Display Value stays beside the others in one row. On: values are intentionally shown underneath each other.";
  stackToggleText.append(
    stackToggleTitle,
    stackToggleHelp
  );

  const stackToggleInput =
    document.createElement("input");
  stackToggleInput.type =
    "checkbox";
  stackToggleInput.checked =
    selected.runtimeDisplayStacked === true;
  stackToggleInput.addEventListener(
    "change",
    () => {
      selected.runtimeDisplayStacked =
        stackToggleInput.checked;
      rmlRuntimeDisplaySetCoreDirty();
    }
  );

  stackToggle.append(
    stackToggleText,
    stackToggleInput
  );
  form.appendChild(stackToggle);

  form.appendChild(
    createTextField(
      "Offline / waiting text",
      selected.customValidator,
      value => {
        selected.customValidator =
          value.slice(0, 240);
      },
      {
        placeholder:
          "Runtime value unavailable"
      }
    )
  );

  const keyLabel =
    createTextField(
      "Internal configuration key",
      selected.keyName,
      value => {
        selected.keyName =
          value
            .replace(
              /[^A-Za-z0-9_.-]+/g,
              "_"
            )
            .slice(0, 160);
      },
      {
        placeholder:
          "runtime_display"
      }
    );
  const keyHelp =
    document.createElement(
      "small"
    );
  keyHelp.textContent =
    "Used only as the stable RML configuration key. The displayed row is continuously synchronized from the graph and manual edits are overwritten.";
  keyLabel.appendChild(keyHelp);
  form.appendChild(keyLabel);


  host.appendChild(form);
  window.RMLInlineRowLayout
    ?.appendInspectorControls?.(
      form,
      selected,
      rmlRuntimeDisplaySetCoreDirty
    );
  rmlRuntimeDisplayInspectorRendering =
    false;
  return true;
}

const rmlRuntimeDisplayBaseRenderInspector =
  renderInspector;

renderInspector =
  function (...args) {
    const result =
      rmlRuntimeDisplayBaseRenderInspector
        .apply(
          this,
          args
        );

    if (
      !document.body.classList.contains(
        "rml-node-graph-mode"
      )
    ) {
      queueMicrotask(
        rmlRuntimeDisplayInspector
      );
    }

    return result;
  };

function rmlRuntimeDisplayUpdatePaletteAvailability() {
  const button =
    document.querySelector(
      '[data-palette="runtimeDisplay"]'
    );

  if (!button) {
    return;
  }

  button.disabled = false;
  button.title =
    "Add a read-only RML menu display. After packing, connect its Start-node output to the RML Menu input of one or more Display Value nodes. Multiple values stay side by side in one row by default; Properties can reorder them or intentionally stack them vertically.";
  button.dataset.help =
    button.title;
}

function rmlRuntimeDisplayInjectCSharp(
  source
) {
  const bindings =
    rmlRuntimeDisplayGraphBindings();
  const displays =
    rmlRuntimeDisplayWalk()
      .map(rmlRuntimeDisplayNormalizeNode)
      .filter(node =>
        bindings.has(
          String(node.id || "")
        )
      );

  if (
    displays.length === 0 ||
    typeof source !== "string" ||
    !source.includes(
      "public override void OnEngineInit"
    )
  ) {
    return source;
  }

  if (
    source.includes(
      "RML_RUNTIME_MENU_DISPLAY_BRIDGE_V4"
    )
  ) {
    return source;
  }

  if (
    !source.includes(
      "using System.Linq;"
    )
  ) {
    const usingAnchor =
      source.match(
        /^using\s+[^;]+;\s*$/m
      );

    if (usingAnchor) {
      source =
        source.replace(
          usingAnchor[0],
          `${usingAnchor[0]}\nusing System.Linq;`
        );
    }
  }

  const graphClassName =
    `${rmlRuntimeDisplayIdentifier(
      state.metadata.className,
      "YourMod"
    )}NodeGraph`;

  const ordered =
    rmlRuntimeDisplayFlattenOrder();
  const descriptors =
    displays.map((node, index) => {
      const token =
        rmlRuntimeDisplayToken(
          node.id
        );
      const field =
        `RuntimeDisplay_${token}_${index}`;
      const sourceBindings =
        rmlRuntimeDisplayBindingsFor(
          node
        );
      rmlRuntimeDisplaySyncOrder(
        node,
        sourceBindings
      );
      const orderedSourceBindings =
        rmlRuntimeDisplayBindingsFor(
          node
        );
      const sources =
        orderedSourceBindings
          .map((binding, sourceIndex) => {
            const monitorId =
              String(
                binding.monitorId || ""
              );

            if (!monitorId) {
              return null;
            }

            return {
              monitorId,
              label:
                String(
                  binding.label ||
                  `Display Value ${sourceIndex + 1}`
                ),
              field:
                `${field}_Value${sourceIndex}`,
              key:
                `${String(
                  node.keyName ||
                  `runtime_display_${token}`
                )}.${sourceIndex + 1}.${rmlRuntimeDisplayToken(monitorId)}`
            };
          })
          .filter(Boolean);
      const sourceIds =
        sources.map(source =>
          source.monitorId
        );
      const label =
        String(
          node.fieldName ||
          `Runtime Display ${index + 1}`
        );
      const key =
        String(
          node.keyName ||
          `runtime_display_${token}`
        );
      const description =
        String(
          node.description ||
          "Read-only value published by the Typed Runtime Graph."
        );
      const fallback =
        String(
          node.customValidator ||
          "Runtime value unavailable"
        );
      const orderIndex =
        ordered.indexOf(node);

      return {
        node,
        token,
        field,
        sources,
        sourceIds,
        label,
        key,
        description,
        fallback,
        orderIndex,
        stackVertically:
          node.runtimeDisplayStacked === true
      };
    });

  const runtimeValueFields =
    descriptors.flatMap(item =>
      item.sources.map(source => ({
        item,
        source
      }))
    );

  const fields =
    runtimeValueFields.map(({ item, source }) =>
`    [AutoRegisterConfigKey]
    private static readonly ModConfigurationKey<string> ${source.field} =
        new(
            "${rmlRuntimeDisplayEscapeCSharp(source.key)}",
            "${rmlRuntimeDisplayEscapeCSharp(item.label)} / ${rmlRuntimeDisplayEscapeCSharp(source.label)} — ${rmlRuntimeDisplayEscapeCSharp(item.description)} Read-only live value; manual edits are overwritten by the generated runtime.",
            () => "${rmlRuntimeDisplayEscapeCSharp(item.fallback)}",
            internalAccessOnly: true);
`
    ).join("\n");

  const sourceText =
    (item, source) =>
      `${graphClassName}.GetDisplayTextByMonitorId("${rmlRuntimeDisplayEscapeCSharp(source.monitorId)}", "${rmlRuntimeDisplayEscapeCSharp(item.fallback)}")`;

  const switchGroups =
    new Map();

  for (const item of descriptors) {
    for (const source of item.sources) {
      const list =
        switchGroups.get(
          source.monitorId
        ) || [];

      list.push({
        item,
        source
      });

      switchGroups.set(
        source.monitorId,
        list
      );
    }
  }

  const switchCases =
    [...switchGroups.entries()]
      .map(([sourceId, entries]) =>
`            case "${rmlRuntimeDisplayEscapeCSharp(sourceId)}":
${entries.map(({ item, source }) =>
`                RuntimeDisplayWrite(
                    ${source.field},
                    ${sourceText(item, source)});`
).join("\n")}
                break;`
      ).join("\n");

  const refreshCalls =
    runtimeValueFields
      .map(({ item, source }) =>
`        RuntimeDisplayWrite(
            ${source.field},
            ${sourceText(item, source)});`
      ).join("\n");

  const providerDisplays =
    descriptors.map(item => {
      const keys =
        item.sources
          .map(source =>
            `                        ${source.field}`
          )
          .join(",\n");

      const order =
        Number.isInteger(item.orderIndex) &&
        item.orderIndex >= 0
          ? item.orderIndex
          : 2147483647;

      return `            new ModConfigurationRuntimeDisplay
            {
                Id = "${rmlRuntimeDisplayEscapeCSharp(item.node.id)}",
                Name = "${rmlRuntimeDisplayEscapeCSharp(item.label)}",
                Description = "${rmlRuntimeDisplayEscapeCSharp(item.description)}",
                Keys =
                    new ModConfigurationKey[]
                    {
${keys}
                    },
                StackValuesVertically = ${item.stackVertically ? "true" : "false"},
                Order = ${order}
            }`;
    }).join(",\n");

  const providerMembers =
`    public System.Collections.Generic.IReadOnlyList<
        ModConfigurationRuntimeDisplay>
        GetRuntimeDisplays()
    {
        return new ModConfigurationRuntimeDisplay[]
        {
${providerDisplays}
        };
    }
`;


  const runtimeMembers =
`
    // RML_RUNTIME_MENU_DISPLAY_BRIDGE_V4
    private static object? _runtimeDisplayConfiguration;
    private static int _runtimeDisplayBridgeStarted;

${providerMembers}

    private void InitializeRuntimeMenuDisplays()
    {
        _runtimeDisplayConfiguration =
            GetConfiguration();

        ${graphClassName}.DisplayValueChangedByMonitorId +=
            OnRuntimeMenuDisplayChanged;

        RefreshRuntimeMenuDisplays();

        if (System.Threading.Interlocked.Exchange(
                ref _runtimeDisplayBridgeStarted,
                1) == 0)
        {
            _ = System.Threading.Tasks.Task.Run(
                async () =>
                {
                    while (
                        System.Threading.Volatile.Read(
                            ref _runtimeDisplayBridgeStarted) != 0 &&
                        FrooxEngine.Engine.Current is not null)
                    {
                        try
                        {
                            FrooxEngine.World? world =
                                FrooxEngine.Engine.Current
                                    ?.WorldManager
                                    ?.FocusedWorld ??
                                FrooxEngine.Userspace
                                    .UserspaceWorld;

                            if (
                                world is not null &&
                                !world.IsDisposed &&
                                world.RootSlot is not null)
                            {
                                world.RunSynchronously(
                                    RefreshRuntimeMenuDisplays,
                                    immediatellyIfPossible: true);
                            }
                        }
                        catch
                        {
                        }

                        await System.Threading.Tasks.Task
                            .Delay(750)
                            .ConfigureAwait(false);
                    }

                    System.Threading.Interlocked.Exchange(
                        ref _runtimeDisplayBridgeStarted,
                        0);
                });
        }
    }

    private static void OnRuntimeMenuDisplayChanged(
        string monitorId,
        string label,
        object? value)
    {
        switch (monitorId)
        {
${switchCases}
        }
    }

    private static void RefreshRuntimeMenuDisplays()
    {
${refreshCalls}
    }

    private static System.Reflection.MethodInfo?
        RuntimeDisplayConfigurationMethod(
            object configuration,
            string name,
            ModConfigurationKey<string> key,
            bool requiresValueParameter)
    {
        foreach (
            System.Reflection.MethodInfo candidate in
            configuration
                .GetType()
                .GetMethods(
                    System.Reflection.BindingFlags.Public |
                    System.Reflection.BindingFlags.Instance))
        {
            if (!string.Equals(
                    candidate.Name,
                    name,
                    System.StringComparison.Ordinal))
            {
                continue;
            }

            System.Reflection.MethodInfo method =
                candidate;

            if (method.IsGenericMethodDefinition)
            {
                if (method
                        .GetGenericArguments()
                        .Length != 1)
                {
                    continue;
                }

                try
                {
                    method =
                        method.MakeGenericMethod(
                            typeof(string));
                }
                catch
                {
                    continue;
                }
            }

            System.Reflection.ParameterInfo[] parameters =
                method.GetParameters();

            if (
                parameters.Length <
                    (requiresValueParameter
                        ? 2
                        : 1) ||
                !parameters[0]
                    .ParameterType
                    .IsInstanceOfType(key))
            {
                continue;
            }

            if (
                requiresValueParameter &&
                !parameters[1]
                    .ParameterType
                    .IsAssignableFrom(
                        typeof(string)))
            {
                continue;
            }

            bool supported = true;

            for (
                int index =
                    requiresValueParameter
                        ? 2
                        : 1;
                index < parameters.Length;
                index++)
            {
                if (
                    !parameters[index]
                        .HasDefaultValue &&
                    parameters[index]
                        .ParameterType !=
                        typeof(bool))
                {
                    supported = false;
                    break;
                }
            }

            if (supported)
            {
                return method;
            }
        }

        return null;
    }

    private static string? RuntimeDisplayRead(
        ModConfigurationKey<string> key)
    {
        object? configuration =
            _runtimeDisplayConfiguration;

        if (configuration is null)
        {
            return null;
        }

        try
        {
            System.Reflection.MethodInfo? method =
                RuntimeDisplayConfigurationMethod(
                    configuration,
                    "GetValue",
                    key,
                    requiresValueParameter: false);

            if (method is null)
            {
                return null;
            }

            System.Reflection.ParameterInfo[] parameters =
                method.GetParameters();
            object?[] arguments =
                new object?[parameters.Length];

            arguments[0] = key;

            for (int index = 1;
                 index < arguments.Length;
                 index++)
            {
                arguments[index] =
                    parameters[index].HasDefaultValue
                        ? parameters[index].DefaultValue
                        : parameters[index].ParameterType ==
                              typeof(bool)
                            ? false
                            : parameters[index].ParameterType
                                .IsValueType
                                ? System.Activator.CreateInstance(
                                    parameters[index].ParameterType)
                                : null;
            }

            return method.Invoke(
                       configuration,
                       arguments) as string;
        }
        catch
        {
            return null;
        }
    }

    private static void RuntimeDisplayWrite(
        ModConfigurationKey<string> key,
        string value)
    {
        object? configuration =
            _runtimeDisplayConfiguration;

        if (configuration is null)
        {
            return;
        }

        if (string.Equals(
                RuntimeDisplayRead(key),
                value,
                System.StringComparison.Ordinal))
        {
            return;
        }

        try
        {
            System.Reflection.MethodInfo? method =
                RuntimeDisplayConfigurationMethod(
                    configuration,
                    "Set",
                    key,
                    requiresValueParameter: true);

            if (method is null)
            {
                return;
            }

            System.Reflection.ParameterInfo[] parameters =
                method.GetParameters();
            object?[] arguments =
                new object?[parameters.Length];

            arguments[0] = key;
            arguments[1] = value;

            for (int index = 2;
                 index < arguments.Length;
                 index++)
            {
                arguments[index] =
                    parameters[index].ParameterType ==
                        typeof(bool)
                        ? false
                        : parameters[index].HasDefaultValue
                            ? parameters[index].DefaultValue
                            : parameters[index].ParameterType
                                .IsValueType
                                ? System.Activator.CreateInstance(
                                    parameters[index].ParameterType)
                                : null;
            }

            method.Invoke(
                configuration,
                arguments);
        }
        catch
        {
        }
    }
`;

  if (
    !source.includes(
      "IModConfigurationRuntimeDisplayProvider"
    )
  ) {
    const classHeaderPattern =
      /(public\s+(?:sealed\s+)?(?:partial\s+)?class\s+[A-Za-z_][A-Za-z0-9_]*\s*\n\s*:\s*ResoniteMod,[\s\S]*?)(\n\s*\{)/;

    if (classHeaderPattern.test(source)) {
      source =
        source.replace(
          classHeaderPattern,
          (_match, header, brace) =>
            `${header.trimEnd()},\n      IModConfigurationRuntimeDisplayProvider${brace}`
        );
    }
  }

  const initPattern =
    /public\s+override\s+void\s+OnEngineInit\s*\(\s*\)\s*\{/;

  if (!initPattern.test(source)) {
    return source;
  }

  source =
    source.replace(
      initPattern,
      match =>
        `${fields}\n${match}\n        InitializeRuntimeMenuDisplays();`
    );

  const finalBrace =
    source.lastIndexOf("\n}");

  if (finalBrace < 0) {
    return source;
  }

  source =
    source.slice(0, finalBrace) +
    runtimeMembers +
    source.slice(finalBrace);

  source =
    rmlRuntimeDisplayApplyAbsoluteConfigurationOrder(
      source
    );

  return source;
}

function rmlRuntimeDisplayTransformGeneratedResult(
  result
) {
  if (typeof result === "string") {
    return rmlRuntimeDisplayInjectCSharp(
      result
    );
  }

  if (
    result &&
    typeof result === "object"
  ) {
    if (
      typeof result.source === "string"
    ) {
      result.source =
        rmlRuntimeDisplayInjectCSharp(
          result.source
        );
    }

    if (
      Array.isArray(result.files)
    ) {
      for (const file of result.files) {
        if (
          file &&
          typeof file.content === "string" &&
          /\.cs$/i.test(
            String(
              file.name ||
              file.path ||
              ""
            )
          ) &&
          file.content.includes(
            "public override void OnEngineInit"
          )
        ) {
          file.content =
            rmlRuntimeDisplayInjectCSharp(
              file.content
            );
        }
      }
    }

    if (result.files instanceof Map) {
      for (const [key, value] of
        result.files) {
        if (
          typeof value === "string" &&
          /\.cs$/i.test(
            String(key)
          ) &&
          value.includes(
            "public override void OnEngineInit"
          )
        ) {
          result.files.set(
            key,
            rmlRuntimeDisplayInjectCSharp(
              value
            )
          );
        }
      }
    }
  }

  return result;
}

const rmlRuntimeDisplayBaseMainGenerator =
  generateCode;

generateCode =
  function (...args) {
    const originalNodes =
      state.nodes;

    state.nodes =
      (function filter(nodes) {
        return (
          Array.isArray(nodes)
            ? nodes
            : []
        )
          .filter(node =>
            !rmlRuntimeDisplayIsNode(
              node
            )
          )
          .map(node => {
            if (node?.kind === LAYOUT_ROW_KIND) {
              const sourceChildren =
                Array.isArray(node.children)
                  ? node.children
                  : [];
              const layoutContext = {
                row: node,
                children: sourceChildren,
                index: 0
              };

              return {
                ...node,
                layoutItemIds:
                  sourceChildren
                    .map(child =>
                      String(child?.id || "")
                    )
                    .filter(Boolean),
                layoutItemMetadata:
                  sourceChildren
                    .map(child => ({
                      id:
                        String(
                          child?.id || ""
                        ),
                      widthPercent:
                        effectiveInlineRowWidthPercent(
                          child,
                          layoutContext
                        ),
                      hideLabel:
                        child?.hideLabel === true
                    }))
                    .filter(item => item.id),
                children:
                  filter(
                    node.children
                  )
              };
            }

            if (node?.kind !== "controller") {
              return node;
            }

            return {
              ...node,
              options:
                (
                  Array.isArray(node.options)
                    ? node.options
                    : []
                ).map(option => ({
                  ...option,
                  children:
                    filter(
                      option.children
                    )
                }))
            };
          });
      })(originalNodes);

    let result;

    try {
      result =
        rmlRuntimeDisplayBaseMainGenerator
          .apply(
            this,
            args
          );
    } finally {
      state.nodes =
        originalNodes;
    }

    if (
      result &&
      typeof result.then ===
        "function"
    ) {
      return result.then(
        rmlRuntimeDisplayTransformGeneratedResult
      );
    }

    return rmlRuntimeDisplayTransformGeneratedResult(
      result
    );
  };

const rmlRuntimeDisplayObserver =
  new MutationObserver(() => {
    rmlRuntimeDisplayUpdatePaletteAvailability();

    if (
      !document.body.classList.contains(
        "rml-node-graph-mode"
      ) &&
      rmlRuntimeDisplayIsNode(
        rmlRuntimeDisplayFindNode(
          state.selectedId
        )
      )
    ) {
      rmlRuntimeDisplayInspector();
    }
  });

rmlRuntimeDisplayObserver.observe(
  document.documentElement,
  {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      "class",
      "hidden"
    ]
  }
);

window.addEventListener(
  "rml-api-node-factory-ready",
  () => {
    rmlRuntimeDisplayUpdatePaletteAvailability();

    try {
      updateGeneratedOutput();
    } catch (error) {
      console.error(
        "Generated output refresh after API-node registration failed.",
        error
      );
    }
  }
);

document.addEventListener(
  "rml-catalog:loaded",
  rmlRuntimeDisplayUpdatePaletteAvailability
);

queueMicrotask(() => {
  for (const node of
    rmlRuntimeDisplayWalk()) {
    rmlRuntimeDisplayNormalizeNode(
      node
    );
  }

  rmlRuntimeDisplayUpdatePaletteAvailability();
  rmlRuntimeDisplayInspector();
  try { updateGeneratedOutput(); } catch {}
});

let rmlRuntimeDisplayPreviewUnsubscribe =
  null;
let rmlRuntimeDisplayPreviewChannel =
  "";

function rmlRuntimeDisplayPreviewText(
  record,
  fallback
) {
  if (!record) {
    return fallback;
  }

  if (
    record.valueKind === "sequence" &&
    Array.isArray(record.value)
  ) {
    return record.value.length > 0
      ? record.value
          .map(value =>
            typeof value === "object"
              ? value?.display ||
                JSON.stringify(value)
              : String(value)
          )
          .join("\n")
      : "[]";
  }

  if (
    record.valueKind === "map" &&
    record.value &&
    typeof record.value === "object" &&
    !Array.isArray(record.value)
  ) {
    const entries =
      Object.entries(record.value);

    return entries.length > 0
      ? entries
          .map(([key, value]) =>
            `${key}: ${
              typeof value === "object"
                ? value?.display ||
                  JSON.stringify(value)
                : String(value)
            }`
          )
          .join("\n")
      : "{}";
  }

  return String(
    record.display ??
    record.value ??
    (
      record.isNull
        ? "<null>"
        : fallback
    )
  );
}

function rmlRuntimeDisplayPreviewItems(
  value
) {
  const normalized =
    String(value ?? "")
      .replace(/\r\n?/g, "\n");

  const items =
    normalized.split("\n");

  return items.length > 0
    ? items
    : [""];
}

function rmlRuntimeDisplayPreviewCopyIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2"></rect>
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
    </svg>
  `;
}

function rmlRuntimeDisplayEnsurePreviewBridge() {
  const channel =
    `${state.metadata.namespaceName}.${state.metadata.className}`;

  if (
    rmlRuntimeDisplayPreviewUnsubscribe &&
    rmlRuntimeDisplayPreviewChannel ===
      channel
  ) {
    return;
  }

  try {
    rmlRuntimeDisplayPreviewUnsubscribe
      ?.();
  } catch {
  }

  rmlRuntimeDisplayPreviewUnsubscribe =
    null;
  rmlRuntimeDisplayPreviewChannel =
    channel;

  if (
    window.RMLRuntimeBridge &&
    typeof window.RMLRuntimeBridge
      .subscribe === "function"
  ) {
    try {
      rmlRuntimeDisplayPreviewUnsubscribe =
        window.RMLRuntimeBridge
          .subscribe(
            channel,
            () =>
              rmlRuntimeDisplayRenderPreviewRows()
          );
    } catch {
    }
  }
}

function rmlPreviewVisibleOrderedNodeIds() {
  const flattened =
    typeof flattenNodes === "function"
      ? flattenNodes(state?.nodes || [])
      : [];

  const visibleNodes = flattened
    .filter(entry =>
      entry &&
      entry.node &&
      (
        !Array.isArray(entry.conditions) ||
        entry.conditions.every(condition =>
          settingsPreviewDraft
            ?.controllers?.[
              condition.controller.id
            ] ===
              condition.option.name
        )
      )
    )
    .map(entry => entry.node)
    .filter(node =>
      settingsPreviewNodeVisible(node) &&
      (
        !window.RMLInlineRowLayout
          ?.findContext?.(node?.id)
          ?.row ||
        settingsPreviewNodeVisible(
          window.RMLInlineRowLayout
            ?.findContext?.(node?.id)
            ?.row
        )
      )
    );

  return settingsPreviewOrderedNodes(
    visibleNodes
  )
    .map(node => String(node?.id || ""))
    .filter(Boolean);
}

function rmlPreviewElementNodeId(element) {
  if (!(element instanceof HTMLElement)) {
    return "";
  }

  return String(
    element.dataset?.previewNodeId ||
    element.dataset?.rmlDynamicPreview ||
    element.dataset?.rmlRuntimeDisplayPreview ||
    ""
  );
}

function rmlPreviewInsertByOutlineOrder(
  host,
  element,
  nodeId
) {
  if (
    !(host instanceof HTMLElement) ||
    !(element instanceof HTMLElement)
  ) {
    return;
  }

  const orderedIds =
    rmlPreviewVisibleOrderedNodeIds();

  const currentId =
    String(nodeId || "");

  const currentIndex =
    orderedIds.indexOf(currentId);

  if (currentIndex < 0) {
    host.appendChild(element);
    return;
  }

  const children =
    [...host.children];

  for (
    let index = currentIndex + 1;
    index < orderedIds.length;
    index += 1
  ) {
    const nextId = orderedIds[index];

    const nextElement =
      children.find(candidate =>
        candidate !== element &&
        rmlPreviewElementNodeId(candidate) ===
          nextId
      );

    if (nextElement) {
      host.insertBefore(
        element,
        nextElement
      );
      return;
    }
  }

  host.appendChild(element);
}

function rmlRuntimeDisplayRenderPreviewRows() {
  const dialog =
    document.getElementById(
      "settings-preview-dialog"
    );
  const host =
    document.getElementById(
      "settings-preview-content"
    );

  if (
    !dialog?.open ||
    !host
  ) {
    return;
  }

  host
    .querySelectorAll(
      "[data-rml-runtime-display-preview]"
    )
    .forEach(element =>
      element.remove()
    );

  const displays =
    rmlRuntimeDisplayWalk()
      .map(rmlRuntimeDisplayNormalizeNode);

  if (displays.length === 0) {
    return;
  }

  rmlRuntimeDisplayEnsurePreviewBridge();

  const channel =
    `${state.metadata.namespaceName}.${state.metadata.className}`;

  for (const node of displays) {
    const row =
      window.RMLInlineRowLayout
        ?.findContext?.(node.id)
        ?.row;

    if (
      !settingsPreviewNodeVisible(node) ||
      (
        row &&
        !settingsPreviewNodeVisible(row)
      )
    ) {
      continue;
    }

    const section =
      document.createElement(
        "section"
      );

    section.className =
      "rml-preview-runtime-display";

    window.RMLInlineRowLayout
      ?.applyPreviewLayout?.(
        node,
        section
      );

    section.classList.toggle(
      "label-hidden",
      !settingsPreviewNodeLabelVisible(
        node
      )
    );

    section.dataset
      .rmlRuntimeDisplayPreview =
        node.id;

    section.dataset.previewNodeId =
      String(node.id || "");

    const heading =
      document.createElement(
        "div"
      );

    heading.className =
      "rml-preview-runtime-display-heading";

    const label =
      document.createElement(
        "strong"
      );

    label.textContent =
      node.fieldName ||
      "Runtime Display";

    heading.appendChild(
      label
    );

    const output =
      document.createElement(
        "div"
      );

    output.className =
      "rml-preview-runtime-display-values";

    output.classList.toggle(
      "stacked",
      node.runtimeDisplayStacked === true
    );

    const bindings =
      rmlRuntimeDisplayBindingsFor(
        node
      );

    rmlRuntimeDisplaySyncOrder(
      node,
      bindings
    );

    const orderedBindings =
      rmlRuntimeDisplayBindingsFor(
        node
      );

    const fallback =
      node.customValidator ||
      "Runtime value unavailable";

    const columns =
      orderedBindings.length > 0
        ? orderedBindings.map(binding => {
            const record =
              window.RMLRuntimeBridge
                ?.getValue?.(
                  channel,
                  binding.monitorId
                ) ||
              null;

            return {
              label:
                binding.label ||
                "Display Value",

              monitorId:
                binding.monitorId,

              items:
                rmlRuntimeDisplayPreviewItems(
                  rmlRuntimeDisplayPreviewText(
                    record,
                    fallback
                  )
                )
            };
          })
        : [
            {
              label:
                "Runtime Display",

              monitorId:
                "",

              items:
                rmlRuntimeDisplayPreviewItems(
                  fallback
                )
            }
          ];

    const rowCount =
      Math.max(
        1,
        ...columns.map(column =>
          column.items.length
        )
      );

    output.style.setProperty(
      "--rml-runtime-display-column-count",
      String(
        Math.max(
          1,
          columns.length
        )
      )
    );

    for (
      let row = 0;
      row < rowCount;
      row += 1
    ) {
      const rowElement =
        document.createElement(
          "div"
        );

      rowElement.className =
        "rml-preview-runtime-display-row";

      for (
        let columnIndex = 0;
        columnIndex < columns.length;
        columnIndex += 1
      ) {
        const column =
          columns[columnIndex];

        const cellValue =
          row < column.items.length
            ? column.items[row]
            : "";

        const cell =
          document.createElement(
            "div"
          );

        cell.className =
          "rml-preview-runtime-display-cell";

        cell.dataset.monitorId =
          column.monitorId;

        const value =
          document.createElement(
            "span"
          );

        value.className =
          "rml-preview-runtime-display-value";

        value.textContent =
          cellValue;

        value.title =
          column.label;

        const copyButton =
          document.createElement(
            "button"
          );

        copyButton.type =
          "button";

        copyButton.className =
          "code-copy-button " +
          "rml-preview-runtime-display-value-copy";

        copyButton.innerHTML =
          rmlRuntimeDisplayPreviewCopyIcon();

        copyButton.setAttribute(
          "aria-label",
          `Copy ${column.label}, item ${row + 1}`
        );

        copyButton.title =
          "Copy this value";

        copyButton.addEventListener(
          "click",
          () => {
            void copyText(
              cellValue,
              copyButton
            );
          }
        );

        cell.append(
          value,
          copyButton
        );

        rowElement.appendChild(
          cell
        );
      }

      output.appendChild(
        rowElement
      );
    }

    if (
      !settingsPreviewNodeLabelVisible(
        node
      )
    ) {
      section.append(output);
    } else {
      section.append(
        heading,
        output
      );
    }

    const containerId =
      findNodeContainerId(
        state.nodes,
        node.id
      );
    const containerNode =
      containerId
        ? findNode(
            state.nodes,
            containerId
          )
        : null;
    const targetHost =
      containerNode?.kind ===
        LAYOUT_ROW_KIND
        ? host.querySelector(
            `[data-preview-layout-row="${CSS.escape(containerId)}"]`
          ) || host
        : host;

    rmlPreviewInsertByOutlineOrder(
      targetHost,
      section,
      node.id
    );
  }
}

const rmlRuntimeDisplayBasePreviewRenderer =
  renderSettingsPreview;

renderSettingsPreview =
  function (...args) {
    const originalNodes =
      state.nodes;

    state.nodes =
      (function filter(nodes) {
        return (
          Array.isArray(nodes)
            ? nodes
            : []
        )
          .filter(node =>
            !rmlRuntimeDisplayIsNode(
              node
            )
          )
          .map(node => {
            if (node?.kind === LAYOUT_ROW_KIND) {
              const sourceChildren =
                Array.isArray(node.children)
                  ? node.children
                  : [];

              return {
                ...node,
                previewLayoutChildren:
                  sourceChildren.map(child => ({
                    id: child?.id,
                    layoutWidthPercent:
                      child?.layoutWidthPercent
                  })),
                children:
                  filter(
                    node.children
                  )
              };
            }

            if (node?.kind !== "controller") {
              return node;
            }

            return {
              ...node,
              options:
                (
                  Array.isArray(node.options)
                    ? node.options
                    : []
                ).map(option => ({
                  ...option,
                  children:
                    filter(
                      option.children
                    )
                }))
            };
          });
      })(originalNodes);

    let result;

    try {
      result =
        rmlRuntimeDisplayBasePreviewRenderer
          .apply(
            this,
            args
          );
    } finally {
      state.nodes =
        originalNodes;
    }

    const finish = value => {
      queueMicrotask(
        rmlRuntimeDisplayRenderPreviewRows
      );
      return value;
    };

    return result &&
      typeof result.then === "function"
      ? result.then(finish)
      : finish(result);
  };

Object.defineProperty(
  window,
  "RMLDynamicOutlineHost",
  {
    value: Object.freeze({
      version: 2,
      getState() {
        return state;
      },
      getElements() {
        return elements;
      },
      getFlatNodes() {
        const result = [];
        const visit = nodes => {
          for (const node of Array.isArray(nodes) ? nodes : []) {
            if (!node || typeof node !== "object") continue;
            result.push(node);
            if (node.kind === "controller") {
              for (const option of Array.isArray(node.options) ? node.options : []) {
                visit(option?.children);
              }
            }
            if (node.kind === LAYOUT_ROW_KIND) {
              visit(node.children);
            }
          }
        };
        visit(state.nodes);
        return result;
      },
      getSelectedNode() {
        const selected = String(state.selectedId || "");
        return this.getFlatNodes().find(node => String(node.id || "") === selected) || null;
      },
      appendRootNode(node) {
        if (!node || typeof node !== "object") return false;
        if (!Array.isArray(state.nodes)) state.nodes = [];
        if (this.getFlatNodes().some(value => value.id === node.id)) return false;
        state.nodes.push(node);
        return true;
      },
      removeNodeById(id) {
        const wanted = String(id || "");
        let removed = false;
        const filter = nodes => (Array.isArray(nodes) ? nodes : []).filter(node => {
          if (!node || typeof node !== "object") return false;
          if (String(node.id || "") === wanted) {
            removed = true;
            return false;
          }
          if (node.kind === "controller") {
            for (const option of Array.isArray(node.options) ? node.options : []) {
              option.children = filter(option?.children);
            }
          }
          if (node.kind === LAYOUT_ROW_KIND) {
            node.children = filter(node.children);
          }
          return true;
        });
        state.nodes = filter(state.nodes);
        if (state.selectedId === wanted) state.selectedId = null;
        return removed;
      },
      commit() {
        try { if (typeof saveState === "function") saveState(); } catch {}
        try { if (typeof persistState === "function") persistState(); } catch {}
        try { if (typeof render === "function") render(); } catch {}
        try { if (typeof renderAll === "function") renderAll(); } catch {}
        try { if (typeof renderCanvas === "function") renderCanvas(); } catch {}
        try { if (typeof renderBuilderCanvas === "function") renderBuilderCanvas(); } catch {}
        try { if (typeof renderInspector === "function") renderInspector(); } catch {}
        try { if (typeof updateGeneratedOutput === "function") updateGeneratedOutput(); } catch {}
        try { if (typeof updateCounts === "function") updateCounts(); } catch {}
        window.dispatchEvent(new CustomEvent("rml-dynamic-outline-commit"));
      }
    }),
    writable: false,
    enumerable: false,
    configurable: true
  }
);
